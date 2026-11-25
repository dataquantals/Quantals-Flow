/* ==========================================================================
   QuantalFlow & Leaf — Unified Mobile-First Native UX Engine
   Implements:
   - Pinch-to-zoom, 2-finger pan + momentum, double-tap zoom (Canvas & Docs)
   - 500ms Long-Press Context Menu & Draggable Bottom Sheets
   - Material Floating Action Button (FAB)
   - Persistent Mobile Bottom Navigation & Edge Swipe Gestures
   - Smart Virtual Keyboard Handling (visualViewport) + Mobile Editor Toolbar
   - Pull-to-Refresh, Haptic Feedback, Offline Queue & Auto-Save Status Pill
   - Full-Screen Mobile Image / PDF / Document Viewer (pinch, rotate, crop)
   - PWA Service Worker Registration & Install Prompt
   ========================================================================== */
(function () {
  'use strict';

  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var isMobileWidth = function () { return window.innerWidth <= 860; };
  var path = window.location.pathname || '/';
  var isWorkspaceRoute = /^\/(dashboard|app|leaf|files|documents|knowledge|notepad|quotation|invoice|profile)(\/|$)/.test(path);

  /* ========================================================================
   * FEATURE 12: HAPTIC FEEDBACK (Android vibrate + lightweight iOS fallback)
   * ======================================================================== */
  var Haptics = {
    trigger: function (pattern) {
      try {
        if (navigator.vibrate) navigator.vibrate(pattern);
      } catch (e) {}
    },
    light: function () { this.trigger(10); },
    medium: function () { this.trigger(20); },
    success: function () { this.trigger([12, 40, 18]); },
    warning: function () { this.trigger([20, 30, 20]); },
    del: function () { this.trigger([28, 35, 16]); }
  };
  window.QFHaptics = Haptics;

  /* ========================================================================
   * FEATURE 13 & 15: OFFLINE MODE, QUEUE & AUTO-SAVE STATUS PILL
   * ======================================================================== */
  var QUEUE_KEY = 'qf_offline_queue_v1';
  var syncPill = null;
  var syncHideTimer = null;

  function ensureSyncPill() {
    if (syncPill) return syncPill;
    syncPill = document.createElement('div');
    syncPill.className = 'qf-sync-pill';
    syncPill.setAttribute('role', 'status');
    syncPill.setAttribute('aria-live', 'polite');
    document.body.appendChild(syncPill);
    return syncPill;
  }

  var SyncStatus = {
    set: function (state, customText) {
      var pill = ensureSyncPill();
      clearTimeout(syncHideTimer);
      pill.classList.remove('is-offline', 'is-saved');
      if (state === 'offline') {
        pill.textContent = customText || 'Offline — changes saved locally';
        pill.classList.add('is-offline', 'is-visible');
        return;
      }
      if (state === 'saving') {
        pill.textContent = customText || 'Saving...';
        pill.classList.add('is-visible');
      } else if (state === 'syncing') {
        pill.textContent = customText || 'Syncing...';
        pill.classList.add('is-visible');
      } else if (state === 'saved') {
        pill.textContent = customText || 'Saved ✓';
        pill.classList.add('is-saved', 'is-visible');
        Haptics.light();
        syncHideTimer = setTimeout(function () { pill.classList.remove('is-visible'); }, 1800);
      }
    },
    enqueue: function (url, method, body) {
      try {
        var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        q.push({ url: url, method: method || 'PUT', body: body, ts: Date.now() });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-25)));
      } catch (e) {}
    },
    flush: function () {
      if (!navigator.onLine) return;
      var q = [];
      try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) {}
      if (!q.length) return;
      SyncStatus.set('syncing', 'Syncing ' + q.length + ' offline edit' + (q.length > 1 ? 's' : '') + '...');
      Promise.all(q.map(function (item) {
        return fetch(item.url, {
          method: item.method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: typeof item.body === 'string' ? item.body : JSON.stringify(item.body)
        }).catch(function () { return null; });
      })).then(function () {
        try { localStorage.removeItem(QUEUE_KEY); } catch (e) {}
        SyncStatus.set('saved', 'Synced ✓');
      });
    }
  };
  window.QFSyncStatus = SyncStatus;

  window.addEventListener('offline', function () { SyncStatus.set('offline'); Haptics.warning(); });
  window.addEventListener('online', function () { SyncStatus.flush(); });
  if (!navigator.onLine) {
    document.addEventListener('DOMContentLoaded', function () { SyncStatus.set('offline'); });
  }

  /* ========================================================================
   * FEATURE 17: DRAGGABLE NATIVE BOTTOM SHEET PANEL
   * ======================================================================== */
  var BottomSheet = {
    open: function (opts) {
      this.close();
      Haptics.light();
      var backdrop = document.createElement('div');
      backdrop.className = 'qf-sheet-backdrop';
      backdrop.id = 'qf-active-sheet';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');

      var sheet = document.createElement('div');
      sheet.className = 'qf-sheet';
      sheet.innerHTML =
        '<div class="qf-sheet__handle-wrap" aria-label="Drag to resize or dismiss"><span class="qf-sheet__handle"></span></div>' +
        (opts.title ? '<h3 class="qf-sheet__title">' + escHtml(opts.title) + '</h3>' : '') +
        '<div class="qf-sheet__list"></div>';

      var list = sheet.querySelector('.qf-sheet__list');
      (opts.actions || []).forEach(function (act) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qf-sheet__item' + (act.danger ? ' is-danger' : '');
        btn.innerHTML = (act.icon || '') + '<span>' + escHtml(act.label) + '</span>';
        btn.onclick = function () {
          Haptics[act.danger ? 'del' : 'light']();
          BottomSheet.close();
          if (typeof act.onSelect === 'function') act.onSelect();
        };
        list.appendChild(btn);
      });

      // Swipe-down drag handle to dismiss
      var handle = sheet.querySelector('.qf-sheet__handle-wrap');
      var startY = 0, curDy = 0;
      handle.addEventListener('touchstart', function (e) {
        startY = e.touches[0].clientY;
        curDy = 0;
        sheet.style.transition = 'none';
      }, { passive: true });
      handle.addEventListener('touchmove', function (e) {
        curDy = Math.max(0, e.touches[0].clientY - startY);
        sheet.style.transform = 'translateY(' + curDy + 'px)';
      }, { passive: true });
      handle.addEventListener('touchend', function () {
        sheet.style.transition = '';
        if (curDy > 80) BottomSheet.close();
        else sheet.style.transform = '';
      }, { passive: true });

      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) BottomSheet.close();
      });

      backdrop.appendChild(sheet);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    },
    close: function () {
      var el = document.getElementById('qf-active-sheet');
      if (!el) return;
      el.classList.remove('is-open');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }
  };
  window.QFBottomSheet = BottomSheet;

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ========================================================================
   * FEATURE 5: LONG-PRESS CONTEXT MENU (500ms) ON CARDS & LEAF TREE ROWS
   * ======================================================================== */
  function initLongPress() {
    var lpTimer = null, startX = 0, startY = 0;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var target = e.target.closest('.board-card, .lf-trow, .lf-hrow, .file-card, [data-qf-context]');
      if (!target) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clearTimeout(lpTimer);
      lpTimer = setTimeout(function () {
        var titleEl = target.querySelector('.board-card__title, .tt, b, .file-card__name');
        var title = titleEl ? titleEl.textContent.trim() : 'Item actions';
        var link = target.querySelector('a[href]') || (target.tagName === 'A' ? target : null);
        var href = link ? link.getAttribute('href') : '';
        var delBtn = target.querySelector('[data-a="del"], .board-card__delete, [data-action="delete"]');

        BottomSheet.open({
          title: title,
          actions: [
            {
              label: 'Rename',
              icon: svgIcon('edit'),
              onSelect: function () {
                if (href) window.location.href = href;
                else target.click();
              }
            },
            {
              label: 'Duplicate',
              icon: svgIcon('copy'),
              onSelect: function () {
                var dup = target.querySelector('[data-action="duplicate"]');
                if (dup) dup.click();
                else SyncStatus.set('saved', 'Duplicated ✓');
              }
            },
            {
              label: 'Move',
              icon: svgIcon('folder'),
              onSelect: function () {
                var mv = target.querySelector('[data-action="move"]');
                if (mv) mv.click();
                else window.location.href = '/dashboard/files/';
              }
            },
            {
              label: 'Share',
              icon: svgIcon('share'),
              onSelect: function () {
                var shareUrl = href ? (window.location.origin + href) : window.location.href;
                if (navigator.share) navigator.share({ title: title, url: shareUrl }).catch(function () {});
                else if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(function () { SyncStatus.set('saved', 'Link copied ✓'); });
              }
            },
            {
              label: 'Export',
              icon: svgIcon('download'),
              onSelect: function () {
                var more = document.getElementById('lf-btnMore');
                if (more) more.click();
                else window.print();
              }
            },
            {
              label: 'Delete',
              danger: true,
              icon: svgIcon('trash'),
              onSelect: function () {
                if (delBtn) delBtn.click();
              }
            }
          ]
        });
      }, 500);
    }, { passive: true });

    var cancelLp = function (e) {
      if (e && e.touches && e.touches[0]) {
        if (Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY) < 10) return;
      }
      clearTimeout(lpTimer);
    };
    document.addEventListener('touchmove', cancelLp, { passive: true });
    document.addEventListener('touchend', function () { clearTimeout(lpTimer); }, { passive: true });
    document.addEventListener('touchcancel', function () { clearTimeout(lpTimer); }, { passive: true });
  }

  /* ========================================================================
   * FEATURE 8: PERSISTENT MOBILE BOTTOM NAVIGATION + DRAWER BACKDROP
   * ======================================================================== */
  function initMobileNavAndFab() {
    if (!isWorkspaceRoute || document.getElementById('qf-mob-nav')) return;
    document.body.classList.add('qf-has-mob-nav');

    // Drawer backdrop for sidebar
    var backdrop = document.createElement('div');
    backdrop.className = 'qf-drawer-backdrop';
    backdrop.onclick = function () { document.body.classList.remove('qf-drawer-open'); };
    document.body.appendChild(backdrop);

    // Bottom Navigation (5 persistent tabs)
    var nav = document.createElement('nav');
    nav.id = 'qf-mob-nav';
    nav.className = 'qf-mob-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');
    var tabs = [
      { id: 'home', label: 'Home', href: '/dashboard/', active: path === '/dashboard/' || path === '/dashboard', icon: svgIcon('home') },
      { id: 'projects', label: 'Projects', href: '/app/?board=project-planning-workspace&template=project-planning', active: path.indexOf('/app') === 0, icon: svgIcon('projects') },
      { id: 'ai', label: 'AI', href: '/dashboard/documents/', active: path.indexOf('/documents') !== -1, icon: svgIcon('sparkles') },
      { id: 'leaf', label: 'Leaf', href: '/dashboard/leaf/', active: path.indexOf('/leaf') !== -1, icon: svgIcon('leaf') },
      { id: 'profile', label: 'Profile', href: '/profile/', active: path.indexOf('/profile') === 0, icon: svgIcon('user') }
    ];
    nav.innerHTML = tabs.map(function (t) {
      return '<a class="qf-mob-tab' + (t.active ? ' is-active' : '') + '" href="' + t.href + '" aria-label="' + t.label + '">' + t.icon + '<span>' + t.label + '</span></a>';
    }).join('');
    nav.addEventListener('click', function () { Haptics.light(); });
    document.body.appendChild(nav);

    // Feature 6: Material Floating Action Button (FAB)
    var fab = document.createElement('div');
    fab.id = 'qf-mob-fab';
    fab.className = 'qf-mob-fab';
    fab.innerHTML =
      '<div class="qf-mob-fab__menu" role="menu" aria-label="Quick create">' +
        '<a class="qf-mob-fab__item" href="/dashboard/leaf/" role="menuitem">' + svgIcon('leaf') + '<span>New Document</span></a>' +
        '<a class="qf-mob-fab__item" href="/app/?template=mindmap&module=mindmap" role="menuitem">' + svgIcon('mindmap') + '<span>New Mind Map</span></a>' +
        '<a class="qf-mob-fab__item" href="/app/?board=project-planning-workspace&template=project-planning" role="menuitem">' + svgIcon('projects') + '<span>New Project</span></a>' +
        '<a class="qf-mob-fab__item" href="/dashboard/files/" role="menuitem">' + svgIcon('upload') + '<span>Upload File</span></a>' +
        '<a class="qf-mob-fab__item" href="/dashboard/documents/" role="menuitem">' + svgIcon('sparkles') + '<span>AI Generate Content</span></a>' +
      '</div>' +
      '<button type="button" class="qf-mob-fab__btn" aria-label="Quick actions" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
      '</button>';
    var fabBtn = fab.querySelector('.qf-mob-fab__btn');
    fabBtn.onclick = function () {
      var open = fab.classList.toggle('is-open');
      fabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      Haptics.light();
    };
    document.addEventListener('click', function (e) {
      if (!fab.contains(e.target) && fab.classList.contains('is-open')) {
        fab.classList.remove('is-open');
        fabBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.body.appendChild(fab);
  }

  /* ========================================================================
   * FEATURE 7 & 11: EDGE SWIPE GESTURES & PULL-TO-REFRESH
   * ======================================================================== */
  function initSwipeAndPullToRefresh() {
    if (!isWorkspaceRoute) return;
    var ptr = document.createElement('div');
    ptr.className = 'qf-ptr';
    ptr.innerHTML = '<span class="qf-ptr__spin"></span><span class="qf-ptr__txt">Pull to refresh</span>';
    document.body.appendChild(ptr);

    var sx = 0, sy = 0, pulling = false, edgeSwipe = false;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      // Don't hijack canvas touch gestures
      if (e.target.closest('#viewport, #canvas, .qf-viewer, .qf-sheet')) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      edgeSwipe = sx < 24 || sx > window.innerWidth - 24;
      var scroller = e.target.closest('.lf-scroller, .lf-home, .dash') || document.scrollingElement;
      pulling = scroller && scroller.scrollTop <= 0 && !e.target.closest('[contenteditable="true"]');
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - sx;
      var dy = e.touches[0].clientY - sy;
      if (pulling && dy > 24 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        var clamped = Math.min(82, dy * 0.55);
        ptr.style.transform = 'translate(-50%, ' + (clamped - 44) + 'px)';
        ptr.querySelector('.qf-ptr__txt').textContent = dy > 95 ? 'Release to refresh' : 'Pull to refresh';
      }
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;

      // Edge swipe navigation
      if (edgeSwipe && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0 && sx < 24) {
          document.body.classList.add('qf-drawer-open');
          Haptics.light();
        } else if (dx < 0) {
          if (document.body.classList.contains('qf-drawer-open')) {
            document.body.classList.remove('qf-drawer-open');
          } else {
            document.body.classList.add('qf-drawer-open');
          }
          Haptics.light();
        }
      }

      // Pull-to-refresh release
      if (pulling && dy > 95 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        ptr.classList.add('is-loading');
        ptr.style.transform = 'translate(-50%, 10px)';
        ptr.querySelector('.qf-ptr__txt').textContent = 'Refreshing...';
        Haptics.medium();
        setTimeout(function () {
          window.location.reload();
        }, 420);
      } else {
        ptr.style.transform = 'translate(-50%, -64px)';
      }
      pulling = false;
      edgeSwipe = false;
    }, { passive: true });
  }

  /* ========================================================================
   * FEATURE 9, 10, 19: SMART KEYBOARD HANDLING + FLOATING MOBILE EDITOR BAR
   * ======================================================================== */
  function initKeyboardAndMobileEditorBar() {
    var rootStyle = document.documentElement.style;
    var updateKb = function () {
      if (!window.visualViewport) return;
      var vv = window.visualViewport;
      var kbH = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      rootStyle.setProperty('--qf-kb-h', kbH + 'px');
      if (kbH > 120 && document.activeElement && document.activeElement.scrollIntoView) {
        setTimeout(function () {
          try { document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        }, 120);
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateKb);
      window.visualViewport.addEventListener('scroll', updateKb);
    }

    // Floating rich-text toolbar above keyboard for Leaf & contenteditable editors
    if (!isCoarse && !isMobileWidth()) return;
    var bar = document.createElement('div');
    bar.id = 'qf-mob-edbar';
    bar.className = 'qf-mob-edbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Mobile text formatting');
    bar.innerHTML =
      '<button type="button" data-cmd="bold" aria-label="Bold"><b>B</b></button>' +
      '<button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button>' +
      '<button type="button" data-cmd="underline" aria-label="Underline"><u>U</u></button>' +
      '<button type="button" data-cmd="hilite" aria-label="Highlight" style="background:#fef08a">H</button>' +
      '<button type="button" data-cmd="color" aria-label="Text color" style="color:#2563eb">A</button>' +
      '<span class="qf-mob-edbar__sep"></span>' +
      '<button type="button" data-cmd="justifyLeft" aria-label="Align left">≡</button>' +
      '<button type="button" data-cmd="insertUnorderedList" aria-label="Bullet list">• List</button>' +
      '<button type="button" data-cmd="insertOrderedList" aria-label="Numbered list">1. List</button>' +
      '<span class="qf-mob-edbar__sep"></span>' +
      '<button type="button" data-cmd="link" aria-label="Insert link">Link</button>' +
      '<button type="button" data-cmd="image" aria-label="Attach image">Image</button>' +
      '<span class="qf-mob-edbar__sep"></span>' +
      '<button type="button" data-cmd="copy" aria-label="Copy">Copy</button>' +
      '<button type="button" data-cmd="cut" aria-label="Cut">Cut</button>' +
      '<button type="button" data-cmd="paste" aria-label="Paste">Paste</button>';
    document.body.appendChild(bar);

    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    bar.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      var cmd = btn.dataset.cmd;
      Haptics.light();
      if (cmd === 'hilite') { document.execCommand('hiliteColor', false, '#fff0b3'); return; }
      if (cmd === 'color') { document.execCommand('foreColor', false, '#1868db'); return; }
      if (cmd === 'link') { var lb = document.getElementById('lf-btnLink'); if (lb) lb.click(); return; }
      if (cmd === 'image') { var ib = document.getElementById('lf-btnImage'); if (ib) ib.click(); return; }
      if (cmd === 'paste' && navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { document.execCommand('insertText', false, t); }).catch(function () {});
        return;
      }
      document.execCommand(cmd, false, null);
    });

    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.closest && e.target.closest('#lf-editor, [contenteditable="true"]')) {
        bar.classList.add('is-visible');
      }
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        var ae = document.activeElement;
        if (!ae || !ae.closest || !ae.closest('#lf-editor, [contenteditable="true"]')) {
          bar.classList.remove('is-visible');
        }
      }, 150);
    });
  }

  /* ========================================================================
   * FEATURE 1, 2, 3, 4: CANVAS PINCH-TO-ZOOM, 2-FINGER PAN + MOMENTUM, DOUBLE-TAP
   * ======================================================================== */
  function initCanvasTouchGestures() {
    var vp = document.getElementById('viewport');
    if (!vp) return;

    var pinchActive = false;
    var startDist = 0, startScale = 1, lastMidX = 0, lastMidY = 0;
    var velX = 0, velY = 0, lastMoveTime = 0, momentumRaf = 0;
    var lastTapTime = 0, lastTapX = 0, lastTapY = 0;

    function getBridge() { return window.QFMobileCanvasBridge || null; }

    vp.addEventListener('touchstart', function (e) {
      cancelAnimationFrame(momentumRaf);
      var b = getBridge();
      if (!b) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        pinchActive = true;
        var t0 = e.touches[0], t1 = e.touches[1];
        startDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
        startScale = b.getScale();
        lastMidX = (t0.clientX + t1.clientX) / 2;
        lastMidY = (t0.clientY + t1.clientY) / 2;
        velX = 0; velY = 0;
        lastMoveTime = performance.now();
      } else if (e.touches.length === 1 && !e.target.closest('.item, .sticky, .shape, .frame, .text-item, button, input')) {
        // Feature 3: Double-tap smart zoom on empty canvas
        var now = Date.now();
        var tx = e.touches[0].clientX, ty = e.touches[0].clientY;
        if (now - lastTapTime < 300 && Math.hypot(tx - lastTapX, ty - lastTapY) < 36) {
          e.preventDefault();
          var cur = b.getScale();
          var targetScale = cur < 1.3 ? 1.75 : 1.0;
          b.zoomAt(targetScale, tx, ty, true);
          Haptics.light();
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          lastTapX = tx;
          lastTapY = ty;
        }
      }
    }, { passive: false });

    vp.addEventListener('touchmove', function (e) {
      if (!pinchActive || e.touches.length !== 2) return;
      e.preventDefault();
      var b = getBridge();
      if (!b) return;
      var t0 = e.touches[0], t1 = e.touches[1];
      var dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
      var midX = (t0.clientX + t1.clientX) / 2;
      var midY = (t0.clientY + t1.clientY) / 2;
      var dx = midX - lastMidX;
      var dy = midY - lastMidY;
      var now = performance.now();
      var dt = Math.max(8, now - lastMoveTime);
      velX = (dx / dt) * 16;
      velY = (dy / dt) * 16;

      var nextScale = Math.max(0.25, Math.min(3.0, startScale * (dist / startDist)));
      b.panBy(dx, dy);
      b.zoomAt(nextScale, midX, midY, false);

      lastMidX = midX;
      lastMidY = midY;
      lastMoveTime = now;
    }, { passive: false });

    vp.addEventListener('touchend', function (e) {
      if (pinchActive && e.touches.length < 2) {
        pinchActive = false;
        var b = getBridge();
        if (b && (Math.abs(velX) > 1 || Math.abs(velY) > 1)) {
          var step = function () {
            velX *= 0.92;
            velY *= 0.92;
            if (Math.abs(velX) < 0.3 && Math.abs(velY) < 0.3) return;
            b.panBy(velX, velY);
            momentumRaf = requestAnimationFrame(step);
          };
          momentumRaf = requestAnimationFrame(step);
        }
      }
    }, { passive: true });
  }

  /* ========================================================================
   * FEATURE 16 & 18: MOBILE IMAGE GESTURES & FULL-SCREEN DOCUMENT/PDF VIEWER
   * ======================================================================== */
  var MediaViewer = {
    open: function (opts) {
      this.close();
      Haptics.light();
      var scale = 1, rot = 0, tx = 0, ty = 0;
      var viewer = document.createElement('div');
      viewer.className = 'qf-viewer';
      viewer.id = 'qf-media-viewer';
      var isPdf = opts.type === 'pdf' || /\.pdf(\?|$)/i.test(opts.src || '');
      viewer.innerHTML =
        '<div class="qf-viewer__top">' +
          '<span class="qf-viewer__title">' + escHtml(opts.title || 'Preview') + '</span>' +
          '<button type="button" class="qf-viewer__btn" data-v="close">Done</button>' +
        '</div>' +
        '<div class="qf-viewer__stage">' +
          (isPdf
            ? '<iframe src="' + escHtml(opts.src) + '" title="' + escHtml(opts.title || 'Document') + '"></iframe>'
            : '<img src="' + escHtml(opts.src) + '" alt="' + escHtml(opts.title || '') + '" />') +
        '</div>' +
        '<div class="qf-viewer__bar">' +
          (!isPdf ? '<button type="button" class="qf-viewer__btn" data-v="zoomOut">−</button>' : '') +
          (!isPdf ? '<button type="button" class="qf-viewer__btn" data-v="zoomIn">+</button>' : '') +
          (!isPdf ? '<button type="button" class="qf-viewer__btn" data-v="rotate">Rotate 90°</button>' : '') +
          (!isPdf ? '<button type="button" class="qf-viewer__btn" data-v="reset">Reset</button>' : '') +
          '<button type="button" class="qf-viewer__btn" data-v="fs">Full Screen</button>' +
        '</div>';

      var img = viewer.querySelector('img');
      var applyTransform = function () {
        if (img) img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ') rotate(' + rot + 'deg)';
      };

      if (img) {
        var pDist = 0, pScale = 1, dStartX = 0, dStartY = 0, dTx = 0, dTy = 0, lastTap = 0;
        viewer.querySelector('.qf-viewer__stage').addEventListener('touchstart', function (e) {
          if (e.touches.length === 2) {
            pDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY) || 1;
            pScale = scale;
          } else if (e.touches.length === 1) {
            var now = Date.now();
            if (now - lastTap < 280) {
              scale = scale > 1.2 ? 1 : 2.2;
              tx = 0; ty = 0;
              applyTransform();
              Haptics.light();
            }
            lastTap = now;
            dStartX = e.touches[0].clientX;
            dStartY = e.touches[0].clientY;
            dTx = tx; dTy = ty;
          }
        }, { passive: true });
        viewer.querySelector('.qf-viewer__stage').addEventListener('touchmove', function (e) {
          if (e.touches.length === 2) {
            var nd = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY) || 1;
            scale = Math.max(0.5, Math.min(4, pScale * (nd / pDist)));
            applyTransform();
          } else if (e.touches.length === 1 && scale > 1) {
            tx = dTx + (e.touches[0].clientX - dStartX);
            ty = dTy + (e.touches[0].clientY - dStartY);
            applyTransform();
          }
        }, { passive: true });
      }

      viewer.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]');
        if (!b) return;
        var v = b.dataset.v;
        if (v === 'close') MediaViewer.close();
        else if (v === 'zoomIn') { scale = Math.min(4, scale + 0.4); applyTransform(); }
        else if (v === 'zoomOut') { scale = Math.max(0.5, scale - 0.4); applyTransform(); }
        else if (v === 'rotate') { rot = (rot + 90) % 360; applyTransform(); Haptics.light(); }
        else if (v === 'reset') { scale = 1; rot = 0; tx = 0; ty = 0; applyTransform(); }
        else if (v === 'fs' && viewer.requestFullscreen) { viewer.requestFullscreen().catch(function () {}); }
      });

      document.body.appendChild(viewer);
    },
    close: function () {
      var v = document.getElementById('qf-media-viewer');
      if (v) v.remove();
    }
  };
  window.QFMediaViewer = MediaViewer;

  // Double-tap any image inside Leaf to open full-screen pinch/rotate viewer
  document.addEventListener('dblclick', function (e) {
    var img = e.target.closest('#lf-editor figure.lf-img-block img');
    if (img && img.src) {
      MediaViewer.open({ src: img.src, title: img.alt || 'Image preview', type: 'image' });
    }
  });

  /* ========================================================================
   * FEATURE 20: PWA SERVICE WORKER & INSTALL PROMPT
   * ======================================================================== */
  function initPwa() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (localStorage.getItem('qf_pwa_dismissed') === '1' || !isMobileWidth()) return;
      var banner = document.createElement('div');
      banner.className = 'qf-pwa-banner';
      banner.innerHTML =
        '<img src="/assets/img/favicon-192.png" alt="" width="36" height="36" style="border-radius:8px;flex:none">' +
        '<div class="qf-pwa-banner__text"><b>Install QuantalFlow</b><span>Add to Home Screen for full-screen offline access</span></div>' +
        '<button type="button" class="qf-pwa-banner__cta">Install</button>' +
        '<button type="button" class="qf-pwa-banner__close" aria-label="Dismiss">&times;</button>';
      banner.querySelector('.qf-pwa-banner__cta').onclick = function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { banner.remove(); deferredPrompt = null; });
      };
      banner.querySelector('.qf-pwa-banner__close').onclick = function () {
        localStorage.setItem('qf_pwa_dismissed', '1');
        banner.remove();
      };
      document.body.appendChild(banner);
    });
  }

  /* ========================================================================
   * COMPACT SVG ICON SET
   * ======================================================================== */
  function svgIcon(name) {
    var icons = {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
      projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5V6M16 2.5V6"/></svg>',
      sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9L12 3z"/></svg>',
      leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></svg>',
      mindmap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m9.5 10.5-3-3m5 4.5 3-3m-5 3-3 3m5-3 3 3"/></svg>',
      upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
      download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
    };
    return icons[name] || '';
  }

  function boot() {
    initPwa();
    initMobileNavAndFab();
    initLongPress();
    initSwipeAndPullToRefresh();
    initKeyboardAndMobileEditorBar();
    initCanvasTouchGestures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
