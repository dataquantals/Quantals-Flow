/*
 * NEW FOLDER — fluid composer for the Files panel.
 *
 * Desktop : a popover anchored to the "+ New Folder" trigger, scaling from
 *           its origin (spatial consistency). No scrim: it does not block flow.
 * Mobile  : a bottom sheet over a dimming scrim, drag-to-dismiss.
 *
 * Motion is a real spring (not a CSS transition) so it is interruptible at any
 * frame and starts from the presentation value. Drag release projects momentum
 * and hands the finger's velocity to the spring, so there is no seam between
 * dragging and animating. Reduced motion resolves instantly.
 *
 * Public API: window.NewFolderUI.mount(options) -> { open, close, isOpen }
 */
(function (global) {
  'use strict';

  var reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
  var mobile = global.matchMedia('(max-width: 720px)');

  function params(response, dampingRatio) {
    var omega = (2 * Math.PI) / response;
    return { stiffness: omega * omega, damping: 2 * dampingRatio * omega };
  }

  /* Apple's exponential-decay momentum projection (WWDC 2018 sample code). */
  function project(velocity, rate) {
    var d = rate || 0.998;
    return (velocity / 1000) * (d / (1 - d));
  }

  function rubberband(overshoot, dimension, constant) {
    var c = constant || 0.55;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  /* Critically-damped-friendly spring integrator (semi-implicit Euler). */
  function makeSpring(config) {
    var value = config.from || 0;
    var velocity = 0;
    var target = value;
    var raf = 0;
    var last = 0;

    function emit() {
      if (config.onUpdate) config.onUpdate(value, velocity);
    }

    function rest() {
      value = target;
      velocity = 0;
      emit();
      raf = 0;
      if (config.onRest) config.onRest();
    }

    function tick(now) {
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      var force = -config.stiffness * (value - target);
      var damper = -config.damping * velocity;
      velocity += (force + damper) * dt;
      value += velocity * dt;
      emit();
      if (
        Math.abs(velocity) < (config.restVelocity || 0.5) &&
        Math.abs(value - target) < (config.restDelta || 0.5)
      ) {
        rest();
        return;
      }
      raf = global.requestAnimationFrame(tick);
    }

    return {
      set: function (next, v0) {
        target = next;
        if (typeof v0 === 'number') velocity = v0;
        if (reduceMotion.matches) {
          value = target;
          velocity = 0;
          emit();
          if (config.onRest) config.onRest();
          return;
        }
        if (!raf) {
          last = 0;
          raf = global.requestAnimationFrame(tick);
        }
      },
      jump: function (v) {
        value = v;
        velocity = 0;
        emit();
      },
      stop: function () {
        if (raf) global.cancelAnimationFrame(raf);
        raf = 0;
      },
      get value() { return value; },
      get target() { return target; },
      get velocity() { return velocity; }
    };
  }

  function mount(opts) {
    var form = opts.form;
    var trigger = opts.trigger;
    var input = opts.input;
    var createBtn = opts.createBtn;
    var cancelBtn = opts.cancelBtn;
    var errorEl = opts.errorEl;
    var scrim = opts.scrim;
    var grab = opts.grab;
    if (!form || !trigger) return null;

    /* position:fixed is relative to the nearest ancestor with a transform,
       filter or backdrop-filter (the Files card has one), which would pin the
       sheet inside the card instead of the screen. Re-parent to <body>. */
    if (document.body) {
      if (scrim && scrim.parentNode !== document.body) document.body.appendChild(scrim);
      if (form.parentNode !== document.body) document.body.appendChild(form);
    }

    var open = false;
    var busy = false;
    var restoreFocus = false;
    var dragStart = null;
    var dragSamples = [];
    var lastPointerId = null;

    var p = makeSpring(Object.assign({
      from: 0,
      restDelta: 0.002,
      restVelocity: 0.02,
      onUpdate: function (v) { form.style.setProperty('--nf-p', String(v)); },
      onRest: maybeFinishClose
    }, params(0.32, 1.0)));

    var drag = makeSpring(Object.assign({
      from: 0,
      restDelta: 0.5,
      restVelocity: 8,
      onUpdate: function (v) { form.style.setProperty('--nf-drag', v + 'px'); }
    }, params(0.28, 0.92)));

    function maybeFinishClose() {
      if (open || p.value > 0.0001) return;
      form.hidden = true;
      form.style.removeProperty('--nf-drag');
      form.classList.remove('is-dragging');
      drag.jump(0);
      if (scrim) {
        scrim.classList.remove('is-visible');
        scrim.hidden = true;
      }
      if (restoreFocus) {
        restoreFocus = false;
        trigger.focus({ preventScroll: true });
      }
    }

    function setError(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.hidden = !message;
      if (message) {
        form.classList.remove('is-error');
        void form.offsetWidth; /* restart the shake */
        form.classList.add('is-error');
      }
    }

    function setBusy(next) {
      busy = next;
      form.setAttribute('aria-busy', next ? 'true' : 'false');
      if (input) input.disabled = next;
      if (createBtn) {
        createBtn.disabled = next || !input || !input.value.trim();
        createBtn.textContent = next ? 'Creating…' : 'Create Folder';
      }
      if (cancelBtn) cancelBtn.disabled = false;
    }

    /* On phones the on-screen keyboard shrinks only the *visual* viewport, so a
       sheet pinned to bottom:0 of the layout viewport ends up hidden behind it.
       Lift the sheet by exactly the keyboard's height. */
    function syncKeyboardInset() {
      var vv = global.visualViewport;
      var inset = 0;
      if (vv && mobile.matches) {
        inset = Math.max(0, global.innerHeight - vv.height - vv.offsetTop);
      }
      form.style.setProperty('--nf-kb', Math.round(inset) + 'px');
    }

    function position() {
      if (mobile.matches) {
        form.style.left = '';
        form.style.top = '';
        form.style.transformOrigin = '';
        syncKeyboardInset();
        return;
      }
      form.style.removeProperty('--nf-kb');
      var r = trigger.getBoundingClientRect();
      var w = form.offsetWidth || 360;
      var h = form.offsetHeight || 220;
      var gap = 10;
      var margin = 12;
      var left = Math.min(Math.max(margin, r.right - w), global.innerWidth - w - margin);
      var top = r.bottom + gap;
      if (top + h > global.innerHeight - margin) {
        top = Math.max(margin, r.top - h - gap);
      }
      form.style.left = left + 'px';
      form.style.top = top + 'px';
      var origin = Math.min(Math.max(18, r.left + r.width / 2 - left), w - 18);
      form.style.transformOrigin = origin + 'px 0px';
    }

    function attach() {
      document.addEventListener('pointerdown', onOutsidePointer, true);
      document.addEventListener('keydown', onKeydown);
      global.addEventListener('resize', position);
      global.addEventListener('orientationchange', position);
      global.addEventListener('scroll', position, true);
      if (global.visualViewport) {
        global.visualViewport.addEventListener('resize', syncKeyboardInset);
        global.visualViewport.addEventListener('scroll', syncKeyboardInset);
      }
      mobile.addEventListener('change', onViewportChange);
    }

    function detach() {
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      document.removeEventListener('keydown', onKeydown);
      global.removeEventListener('resize', position);
      global.removeEventListener('orientationchange', position);
      global.removeEventListener('scroll', position, true);
      if (global.visualViewport) {
        global.visualViewport.removeEventListener('resize', syncKeyboardInset);
        global.visualViewport.removeEventListener('scroll', syncKeyboardInset);
      }
      mobile.removeEventListener('change', onViewportChange);
    }

    function onOutsidePointer(event) {
      if (!open || busy) return;
      if (form.contains(event.target) || trigger.contains(event.target)) return;
      close(false);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy) close(true);
      }
    }

    function onViewportChange() {
      if (!open) return;
      position();
      if (scrim) {
        if (mobile.matches) {
          scrim.hidden = false;
          global.requestAnimationFrame(function () { scrim.classList.add('is-visible'); });
        } else {
          scrim.classList.remove('is-visible');
          scrim.hidden = true;
        }
      }
      form.setAttribute('aria-modal', mobile.matches ? 'true' : 'false');
    }

    function openUI() {
      if (open) return;
      open = true;
      restoreFocus = false;
      drag.jump(0);
      form.hidden = false;
      form.classList.add('is-open');
      form.setAttribute('aria-modal', mobile.matches ? 'true' : 'false');
      setError('');
      setBusy(false);
      if (input) input.value = '';
      if (createBtn) createBtn.disabled = true;
      position();
      if (scrim && mobile.matches) {
        scrim.hidden = false;
        global.requestAnimationFrame(function () {
          if (open) scrim.classList.add('is-visible');
        });
      }
      trigger.setAttribute('aria-expanded', 'true');
      if (opts.onOpen) opts.onOpen();
      p.set(1);
      attach();
      global.requestAnimationFrame(function () {
        if (open && input) input.focus({ preventScroll: true });
      });
      if (navigator.vibrate) navigator.vibrate(6);
    }

    function close(returnFocus) {
      if (!open || busy) return;
      open = false;
      restoreFocus = !!returnFocus;
      form.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (scrim) scrim.classList.remove('is-visible');
      detach();
      drag.set(0, drag.velocity);
      p.set(0, p.velocity);
    }

    /* ---- Drag-to-dismiss (sheet only) ---------------------------------- */

    function sampleVelocity() {
      if (dragSamples.length < 2) return 0;
      var first = dragSamples[0];
      var last = dragSamples[dragSamples.length - 1];
      var dt = (last.t - first.t) / 1000;
      if (dt <= 0) return 0;
      return Math.max(-3000, Math.min(3000, (last.y - first.y) / dt));
    }

    function onGrabDown(event) {
      if (!open || !mobile.matches || busy) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      lastPointerId = event.pointerId;
      dragStart = event.clientY;
      dragSamples = [{ t: event.timeStamp, y: drag.value }];
      drag.stop();
      form.classList.add('is-dragging');
      grab.setPointerCapture(event.pointerId);
      grab.addEventListener('pointermove', onGrabMove);
      grab.addEventListener('pointerup', onGrabUp);
      grab.addEventListener('pointercancel', onGrabUp);
    }

    function onGrabMove(event) {
      if (dragStart === null || event.pointerId !== lastPointerId) return;
      var dy = event.clientY - dragStart;
      if (dy < 0) dy = rubberband(dy, global.innerHeight, 0.55);
      drag.jump(dy);
      dragSamples.push({ t: event.timeStamp, y: dy });
      if (dragSamples.length > 6) dragSamples.shift();
    }

    function onGrabUp(event) {
      if (dragStart === null || event.pointerId !== lastPointerId) return;
      var velocity = sampleVelocity();
      var current = drag.value;
      dragStart = null;
      lastPointerId = null;
      form.classList.remove('is-dragging');
      grab.removeEventListener('pointermove', onGrabMove);
      grab.removeEventListener('pointerup', onGrabUp);
      grab.removeEventListener('pointercancel', onGrabUp);
      if (grab.hasPointerCapture && grab.hasPointerCapture(event.pointerId)) {
        grab.releasePointerCapture(event.pointerId);
      }

      var projected = current + project(velocity);
      var sheetHeight = form.offsetHeight || 260;
      if (projected > sheetHeight * 0.35 || velocity > 700) {
        /* Fling out: keep the finger's velocity, fade the material. */
        open = false;
        restoreFocus = false;
        trigger.setAttribute('aria-expanded', 'false');
        detach();
        p.set(0, Math.min(0, p.velocity));
        drag.set(sheetHeight + 40, Math.max(velocity, 400));
        if (scrim) scrim.classList.remove('is-visible');
      } else {
        drag.set(0, velocity);
      }
    }

    /* ---- Wire up -------------------------------------------------------- */

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (open) close(true);
      else openUI();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy) return;
      var name = String(input ? input.value : '').replace(/\s+/g, ' ').trim();
      if (!name) {
        setError('Give the folder a name first.');
        if (input) input.focus();
        return;
      }
      setError('');
      setBusy(true);
      Promise.resolve(opts.onSubmit ? opts.onSubmit(name, { setError: setError }) : false)
        .then(function (result) {
          setBusy(false);
          var ok = result && typeof result === 'object' ? Boolean(result.ok) : Boolean(result);
          var errMsg = result && typeof result === 'object' && result.message ? String(result.message) : '';
          if (!ok) {
            if (errMsg) setError(errMsg);
            if (input) {
              input.focus();
              input.select();
            }
            return;
          }
          if (navigator.vibrate) navigator.vibrate(12);
          close(true);
        })
        .catch(function () {
          setBusy(false);
          setError("We couldn't create that folder right now. Please try again.");
        });
    });

    if (input) {
      input.addEventListener('input', function () {
        if (createBtn) createBtn.disabled = busy || !input.value.trim();
        if (errorEl && !errorEl.hidden) setError('');
      });
      input.addEventListener('animationend', function () {
        form.classList.remove('is-error');
      });
    }

    if (createBtn) {
      createBtn.addEventListener('animationend', function () {
        form.classList.remove('is-error');
      });
    }

    if (cancelBtn) cancelBtn.addEventListener('click', function () { close(true); });
    if (scrim) scrim.addEventListener('click', function () { close(false); });
    if (grab) grab.addEventListener('pointerdown', onGrabDown);

    return {
      open: openUI,
      close: function () { close(true); },
      isOpen: function () { return open; }
    };
  }

  global.NewFolderUI = { mount: mount };
})(window);
