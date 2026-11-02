/* ==========================================================================
   QuantalFlow clone — site-wide interactions
   Loaded on every page. Each block guards for the elements it needs, so the
   same file is safe on the homepage, marketing pages, and auth pages.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- Sticky header shadow + measured chrome height ---------- */
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // The sticky subnav and every anchored scroll offset are derived from the
    // real header height, so publish it as a custom property instead of
    // hard-coding 76px in several places.
    var syncHeaderHeight = function () {
      var h = Math.round(header.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--header-h', h + 'px');
    };
    syncHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(syncHeaderHeight).observe(header);
    window.addEventListener('resize', syncHeaderHeight);
  }

  /* ---------- Mega menu dropdowns ---------- */
  var items = $$('[data-dropdown]');
  // Pointer-capable devices open menus on hover; touch devices rely on taps.
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var closeAll = function (except) {
    items.forEach(function (item) {
      if (item === except) return;
      item.classList.remove('is-open');
      item._hoverOpened = false;
      var btn = $('.nav__link', item);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  };

  items.forEach(function (item) {
    var btn = $('.nav__link', item);
    if (!btn) return;
    var timer;

    var open = function () {
      clearTimeout(timer);
      closeAll(item);
      item.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    };
    var close = function () {
      timer = setTimeout(function () {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }, 140);
    };

    if (canHover) {
      item.addEventListener('mouseenter', function () {
        open();
        item._hoverOpened = true;
      });
      item.addEventListener('mouseleave', function () {
        close();
        item._hoverOpened = false;
      });
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();

      // Hover already opened the menu; the first click just confirms it so the
      // menu does not snap shut under the pointer. Touch devices never set this.
      if (item._hoverOpened) {
        item._hoverOpened = false;
        return;
      }

      if (item.classList.contains('is-open')) {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        open();
      }
    });

    // Keyboard support: ArrowDown opens the panel from the trigger, arrows move
    // through its links, Escape closes and hands focus back to the trigger.
    var panelLinks = function () { return $$('.mega a', item); };

    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      open();
      var first = panelLinks()[0];
      if (first) first.focus();
    });

    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return;

      var links = panelLinks();
      var i = links.indexOf(document.activeElement);
      if (i < 0 || !links.length) return;

      e.preventDefault();
      var next = e.key === 'Home' ? 0
        : e.key === 'End' ? links.length - 1
        : (i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links[next].focus();
    });

    // Tabbing out of the menu closes it.
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) close();
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-dropdown]')) closeAll(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll(null);
  });

  /* ---------- In-page subnav: scrollspy + overflow hint ---------- */
  var subnav = $('.subnav');
  if (subnav) {
    var subnavInner = $('.subnav__inner', subnav);
    var subnavLinks = $$('.subnav__inner a', subnav);
    var spyTargets = subnavLinks.map(function (a) {
      var id = (a.getAttribute('href') || '').replace(/^#/, '');
      return id ? document.getElementById(id) : null;
    });
    var prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Only fade the ends of the row while it can actually be scrolled.
    var syncOverflow = function () {
      if (!subnavInner) return;
      subnav.classList.toggle('is-scrollable', subnavInner.scrollWidth > subnavInner.clientWidth + 4);
    };

    var lastActive = null;
    var setActive = function (link) {
      if (link === lastActive) return;
      lastActive = link;
      subnavLinks.forEach(function (a) {
        if (a === link) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      // Keep the current section's chip centred when the row is scrollable.
      if (link && subnavInner && subnav.classList.contains('is-scrollable')) {
        var left = link.offsetLeft - subnavInner.clientWidth / 2 + link.offsetWidth / 2;
        subnavInner.scrollTo({ left: Math.max(0, left), behavior: prefersStill ? 'auto' : 'smooth' });
      }
    };

    // The active section is the last one whose top has passed just under the
    // pinned subnav — matching where a click would actually scroll to.
    var spy = function () {
      var line = subnav.getBoundingClientRect().bottom + 32;
      var active = subnavLinks[0];
      spyTargets.forEach(function (el, i) {
        if (el && el.getBoundingClientRect().top <= line) active = subnavLinks[i];
      });
      setActive(active);
    };

    var pending = false;
    var queueSpy = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; spy(); });
    };

    window.addEventListener('scroll', queueSpy, { passive: true });
    window.addEventListener('resize', function () { syncOverflow(); queueSpy(); });
    subnavLinks.forEach(function (a) {
      a.addEventListener('click', function () { setActive(a); });
    });

    syncOverflow();
    spy();
  }

  /* ---------- Mobile drawer ---------- */
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  if (burger && drawer) {
    var setDrawer = function (open) {
      drawer.hidden = !open;
      drawer.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      // The drawer is a full-height sheet on phones: lock the page behind it
      // so a swipe scrolls the menu, not the page.
      document.body.classList.toggle('is-drawer-open', open);
    };

    burger.addEventListener('click', function () {
      setDrawer(drawer.hidden);
    });

    drawer.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setDrawer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) setDrawer(false);
    });
  }

  /* ---------- Use-case tabs ---------- */
  var tabs = $$('.tab');
  var panels = $$('.tabpanel');

  function activateTab(key) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.classList.toggle('is-active', on);
      // Roving tabindex: only the selected tab is in the tab order, so Tab
      // moves past the row and the arrow keys move within it.
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      // Inactive panels are display:none, which already drops them out of the
      // accessibility tree, so no aria-hidden bookkeeping is needed here.
      p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
    });
  }

  // Arrow-key traversal across the tab row (WAI-ARIA tabs pattern).
  tabs.forEach(function (tab, i) {
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      var target = tabs[next];
      target.focus();
      var key = target.getAttribute('data-tab');
      activateTab(key);
      if (window.SaveState) window.SaveState.set('home.tab', key);
    });
  });

  // Rehydrate the last selected tab, falling back to the first one.
  var savedTab = window.SaveState && window.SaveState.get('home.tab');
  if (savedTab && tabs.some(function (t) { return t.getAttribute('data-tab') === savedTab; })) {
    activateTab(savedTab);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-tab');
      activateTab(key);
      if (window.SaveState) window.SaveState.set('home.tab', key);
    });
  });

  /* ---------- Billing toggle (pricing) ---------- */
  var billingButtons = $$('[data-billing]');

  function applyBilling(mode) {
    billingButtons.forEach(function (b) {
      var on = b.getAttribute('data-billing') === mode;
      b.classList.toggle('is-active', on);
      // A toggle button is announced by its pressed state, not its styling.
      b.setAttribute('aria-pressed', String(on));
    });
    $$('.plan__amount[data-' + mode + ']').forEach(function (el) {
      el.textContent = el.getAttribute('data-' + mode);
    });
  }

  // Rehydrate the saved billing period, if present.
  var savedBilling = window.SaveState && window.SaveState.get('pricing.billing');
  if (savedBilling && billingButtons.some(function (b) { return b.getAttribute('data-billing') === savedBilling; })) {
    applyBilling(savedBilling);
  }

  billingButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-billing');
      applyBilling(mode);
      if (window.SaveState) window.SaveState.set('pricing.billing', mode);
    });
  });

  /* ---------- Scroll reveal ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = Math.min(i * 60, 240) + 'ms';
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -60px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Animated counters ---------- */
  var counters = $$('[data-count]');
  var fmt = function (n) { return n.toLocaleString('en-US'); };
  var runCounter = function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var start = null;
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 1400, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        co.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = fmt(parseFloat(el.getAttribute('data-count'))) +
        (el.getAttribute('data-suffix') || '');
    });
  }

  /* ---------- Hero board parallax ---------- */
  var parallaxEls = $$('[data-parallax]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var board = $('.board');
  if (!reduce && parallaxEls.length && board) {
    var ticking = false;
    board.addEventListener('mousemove', function (e) {
      var rect = board.getBoundingClientRect();
      var cx = (e.clientX - rect.left) / rect.width - 0.5;
      var cy = (e.clientY - rect.top) / rect.height - 0.5;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        parallaxEls.forEach(function (el) {
          var depth = parseFloat(el.getAttribute('data-parallax')) || 0.02;
          el.style.translate = (cx * depth * 200).toFixed(2) + 'px ' +
            (cy * depth * 200).toFixed(2) + 'px';
        });
        ticking = false;
      });
    });
  }

  /* ---------- Shared form helpers ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function showMessage(el, text, ok) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', Boolean(text) && !ok);
    el.classList.toggle('is-ok', Boolean(text) && Boolean(ok));
  }

  function setBusy(btn, busy, busyLabel) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = busyLabel || 'Please wait…';
      btn.disabled = true;
    } else {
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
      btn.disabled = false;
    }
  }

  function markField(input, message) {
    if (!input) return;
    var field = input.closest('.field');
    if (!field) return;
    field.classList.toggle('has-error', Boolean(message));
    var err = field.querySelector('.field__error');
    if (message) {
      if (!err) {
        err = document.createElement('p');
        err.className = 'field__error';
        field.appendChild(err);
      }
      err.textContent = message;
    } else if (err) {
      err.remove();
    }
  }

  function clearFieldErrors(form) {
    $$('.field.has-error', form).forEach(function (f) { f.classList.remove('has-error'); });
    $$('.field__error', form).forEach(function (e) { e.remove(); });
  }

  // Wire every "Show / Hide" password toggle on the page.
  $$('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-toggle-pass'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  /* ---------- Homepage hero email capture ---------- */
  var heroForm = document.getElementById('hero-email-form');
  if (heroForm) {
    heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = heroForm.querySelector('input');
      var value = (input.value || '').trim();

      if (!EMAIL_RE.test(value)) {
        heroForm.classList.add('is-error');
        input.focus();
        return;
      }

      heroForm.classList.remove('is-error');
      var btn = heroForm.querySelector('button');
      var original = btn.textContent;
      btn.textContent = 'Check your inbox';
      btn.disabled = true;
      if (window.SaveState) window.SaveState.clear(heroForm);
      setTimeout(function () {
        btn.textContent = original;
        btn.disabled = false;
        heroForm.reset();
      }, 2200);
    });
  }

  /* ---------- Sign-up form (get-started page) ---------- */
  var signupForm = document.getElementById('signup-form');
  if (signupForm) {
    var nameInput = document.getElementById('s-name');
    var emailInput = document.getElementById('s-email');
    var passInput = document.getElementById('s-password');
    var signupMsg = document.getElementById('signup-msg');
    var signupBtn = document.getElementById('signup-submit');

    var strengthWrap = document.getElementById('strength');
    var strengthBar = document.getElementById('strength-bar');
    var strengthLabel = document.getElementById('strength-label');

    // Length is weighted heaviest; variety adds the rest.
    function scorePassword(v) {
      if (!v) return 0;
      var score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      return Math.min(score, 4);
    }

    var LEVELS = [
      { label: 'Too short', color: '#c0392b', width: '12%' },
      { label: 'Weak', color: '#c0392b', width: '30%' },
      { label: 'Fair', color: '#d68910', width: '55%' },
      { label: 'Good', color: '#2e86de', width: '78%' },
      { label: 'Strong', color: '#1a7f4b', width: '100%' }
    ];

    if (passInput && strengthWrap) {
      passInput.addEventListener('input', function () {
        var v = passInput.value;
        strengthWrap.hidden = !v;
        if (!v) return;
        var level = LEVELS[scorePassword(v)];
        strengthBar.style.width = level.width;
        strengthBar.style.background = level.color;
        strengthLabel.textContent = level.label;
      });
    }

    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearFieldErrors(signupForm);
      showMessage(signupMsg, '');

      var payload = {
        name: (nameInput.value || '').trim(),
        email: (emailInput.value || '').trim(),
        password: passInput.value || ''
      };

      var ok = true;
      if (!payload.name) { markField(nameInput, 'Enter your name.'); ok = false; }
      if (!EMAIL_RE.test(payload.email)) { markField(emailInput, 'Enter a valid email address.'); ok = false; }
      if (payload.password.length < 6) { markField(passInput, 'Use at least 6 characters.'); ok = false; }
      if (!ok) return;

      setBusy(signupBtn, true, 'Creating account…');

      try {
        var res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
        var data = await res.json().catch(function () { return {}; });

        if (!res.ok) {
          if (data.fields) {
            var map = { name: nameInput, email: emailInput, password: passInput };
            Object.keys(data.fields).forEach(function (key) {
              markField(map[key], data.fields[key]);
            });
          }
          showMessage(signupMsg, data.error || 'Something went wrong. Please try again.');
          setBusy(signupBtn, false);
          return;
        }

        showMessage(signupMsg, 'Account created. Taking you to your dashboard…', true);
        if (window.SaveState) window.SaveState.clear(signupForm);
        window.location.assign('/dashboard/');
      } catch (err) {
        showMessage(signupMsg, 'We could not reach the server. Please try again.');
        setBusy(signupBtn, false);
      }
    });
  }

  /* ---------- Contact sales form (enterprise page) ---------- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var contactMsg = document.getElementById('contact-msg');

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFieldErrors(contactForm);
      showMessage(contactMsg, '');

      var name = document.getElementById('c-name');
      var email = document.getElementById('c-email');
      var company = document.getElementById('c-company');

      var ok = true;
      if (!(name.value || '').trim()) { markField(name, 'Enter your name.'); ok = false; }
      if (!EMAIL_RE.test((email.value || '').trim())) { markField(email, 'Enter a valid work email.'); ok = false; }
      if (!(company.value || '').trim()) { markField(company, 'Enter your company name.'); ok = false; }
      if (!ok) return;

      // No CRM is wired up in this clone, so acknowledge locally.
      showMessage(contactMsg, 'Thanks — we\'ll be in touch within one business day.', true);
      if (window.SaveState) window.SaveState.clear(contactForm);
      contactForm.reset();
    });
  }

  /* ---------- Clerk & Auth Controls + SSO buttons ---------- */
  var authConfigCache = null;

  function renderSignedInHeader(user) {
    $$('[data-auth-signed-out]').forEach(function (el) { el.hidden = true; });
    $$('[data-auth-signed-in]').forEach(function (el) { el.hidden = false; });
    var initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
    var imgUrl = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
    ['header-profile-initial', 'drawer-profile-initial'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        if (imgUrl) {
          el.innerHTML = '<img src="' + imgUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
        } else {
          el.textContent = initial;
        }
      }
    });
    var userBox = document.getElementById('header-user-button');
    if (userBox && user && !userBox.hasChildNodes()) {
      userBox.innerHTML =
        '<button class="btn btn--dark" type="button" id="header-logout-btn" style="padding:6px 14px;font-size:13px;">Log out</button>';
      var btn = document.getElementById('header-logout-btn');
      if (btn) {
        btn.addEventListener('click', async function () {
          btn.disabled = true;
          try {
            if (window.Clerk && window.Clerk.signOut) await window.Clerk.signOut();
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
          } catch (e) {}
          window.location.href = '/login/';
        });
      }
    }
  }

  function loadClerkSdk(publishableKey) {
    if (!publishableKey || window.Clerk) return Promise.resolve(window.Clerk || null);
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-clerk-publishable-key', publishableKey);
      script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
      script.onload = function () {
        if (window.Clerk && typeof window.Clerk.load === 'function') {
          window.Clerk.load().then(function () { resolve(window.Clerk); }).catch(function () { resolve(null); });
        } else {
          resolve(null);
        }
      };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });
  }

  function syncClerkUserToServer(clerkUser) {
    if (!clerkUser) return Promise.resolve(null);
    var email = '';
    if (clerkUser.primaryEmailAddress && clerkUser.primaryEmailAddress.emailAddress) {
      email = clerkUser.primaryEmailAddress.emailAddress;
    } else if (clerkUser.emailAddresses && clerkUser.emailAddresses[0]) {
      email = clerkUser.emailAddresses[0].emailAddress;
    }
    if (!email) return Promise.resolve(null);
    var name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0];
    return fetch('/api/auth/clerk-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email, name: name, clerkId: clerkUser.id })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // Check current session & Clerk config
  Promise.all([
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch('/api/auth/config', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (results) {
    var meData = results[0];
    authConfigCache = results[1] || {};
    if (meData && meData.user) {
      renderSignedInHeader(meData.user);
    }
    if (authConfigCache.clerkPublishableKey) {
      loadClerkSdk(authConfigCache.clerkPublishableKey).then(function (clerk) {
        if (!clerk) return;
        if (clerk.user) {
          var userBtnMount = document.getElementById('header-user-button');
          if (userBtnMount && typeof clerk.mountUserButton === 'function') {
            userBtnMount.innerHTML = '';
            clerk.mountUserButton(userBtnMount);
          }
          if (!meData || !meData.user) {
            syncClerkUserToServer(clerk.user).then(function (synced) {
              if (synced && synced.user) renderSignedInHeader(synced.user);
            });
          }
        }
      });
    }
  });

  $$('[data-sso]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var provider = btn.getAttribute('data-sso') || 'sso';
      if (window.Clerk && typeof window.Clerk.openSignIn === 'function') {
        window.Clerk.openSignIn({ afterSignInUrl: '/dashboard/', afterSignUpUrl: '/dashboard/' });
        return;
      }
      if (authConfigCache && authConfigCache.clerkPublishableKey) {
        loadClerkSdk(authConfigCache.clerkPublishableKey).then(function (clerk) {
          if (clerk && typeof clerk.openSignIn === 'function') {
            clerk.openSignIn({ afterSignInUrl: '/dashboard/', afterSignUpUrl: '/dashboard/' });
          }
        });
        return;
      }
      showMessage(
        document.getElementById('login-msg'),
        'Clerk SSO (' + provider.toUpperCase() + ') is ready — link your Clerk publishable key or sign in with your email and password below.'
      );
    });
  });
})();
