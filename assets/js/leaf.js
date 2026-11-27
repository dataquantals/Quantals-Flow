/* ==========================================================================
   QuantalFlow Leaf — Collaborative Docs & Knowledge Pages
   Unified with QuantalFlow Workspace Auth, Router & Local Persistence
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'qf_leaf_workspace_v1';

  function initLeafWorkspace() {
    var root = document.getElementById('leaf-app');
    if (!root || root.dataset.leafBound === '1') return;
    root.dataset.leafBound = '1';

    var $ = function (s, r) { return (r || root).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
    var ic = function (n) { return '<i data-lucide="' + n + '"></i>'; };
    var icons = function () {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (e) {}
      }
    };
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    };

    var ed = $('#lf-editor');
    var titleEl = $('#lf-pageTitle');
    var subEl = $('#lf-pageSub');
    var scroller = $('#lf-scroller');
    if (!ed || !titleEl || !subEl || !scroller) return;

    /* ---------- users & chrome auth ---------- */
    var USERS = [
      { n: 'Alex Morgan', c: '#1868db' },
      { n: 'Priya Nair', c: '#6e5dc6' },
      { n: 'Sam Rivera', c: '#c25100' },
      { n: 'Jordan Lee', c: '#1f845a' },
      { n: 'Mei Tanaka', c: '#ae2e24' }
    ];
    var ME = { n: 'You', c: '#0b6e99' };

    function wireChrome(user) {
      if (!user) return;
      window.__qfUser = user;
      var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || 'You');
      ME.n = name;
      var initEl = document.getElementById('dash-initial');
      if (initEl) {
        var img = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
        if (img) {
          initEl.textContent = '';
          var el = document.createElement('img');
          el.src = img;
          el.alt = '';
          el.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
          initEl.appendChild(el);
        } else {
          initEl.textContent = (name.charAt(0) || '?').toUpperCase();
        }
      }
      var nameEl = document.getElementById('dash-profile-name');
      if (nameEl) nameEl.textContent = name;
      var meAv = $('#lf-meAv');
      if (meAv) meAv.innerHTML = avatar(ME.n, 32);
    }

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.replace('/login/?next=' + encodeURIComponent('/dashboard/leaf/')); return null; }
        return r.ok ? r.json() : null;
      })
      .then(function (d) { if (d && d.user) wireChrome(d.user); })
      .catch(function () {});

    var ini = function (n) { return String(n || 'U').split(' ').map(function (x) { return x[0] || ''; }).join('').slice(0, 2).toUpperCase(); };
    var colorOf = function (n) {
      if (n === ME.n) return ME.c;
      var found = USERS.find(function (u) { return u.n === n; });
      return found ? found.c : '#626f86';
    };
    var avatar = function (n, s) {
      s = s || 24;
      return '<span class="lf-av" style="width:' + s + 'px;height:' + s + 'px;background:' + colorOf(n) + ';font-size:' + Math.round(s * 0.4) + 'px" title="' + esc(n) + '">' + ini(n) + '</span>';
    };
    function rel(d) {
      var dateObj = d instanceof Date ? d : new Date(d);
      var s = (Date.now() - dateObj.getTime()) / 1000;
      if (s < 45) return 'just now';
      if (s < 3600) { var m = Math.round(s / 60); return m + (m === 1 ? ' minute ago' : ' minutes ago'); }
      if (s < 86400) { var h = Math.round(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function toast(m) {
      var t = document.getElementById('leaf-toast');
      if (t) t.remove();
      t = document.createElement('div');
      t.id = 'leaf-toast';
      t.textContent = m;
      document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.remove(); }, 2400);
    }

    /* ---------- page store + localStorage persistence ---------- */
    var pages = {};
    var spaces = {
      kb: { id: 'kb', name: 'Knowledge Base', icon: '📚', color: '#1868db', desc: 'Company-wide documentation, project plans, and team handbooks.', roots: [] },
      eng: { id: 'eng', name: 'Engineering', icon: '🛠️', color: '#6e5dc6', desc: 'Runbooks, architecture decisions, and release processes.', roots: [] },
      hr: { id: 'hr', name: 'People and Culture', icon: '🌱', color: '#1f845a', desc: 'Benefits, policies, and onboarding resources for every team member.', roots: [] },
      mkt: { id: 'mkt', name: 'Marketing', icon: '📣', color: '#c25100', desc: 'Campaign calendars, brand guidelines, and launch assets.', roots: [] }
    };
    var uid = 100, cid = 10, cur = 'q4', curSpace = 'kb', view = 'page';
    var rootsOf = function () { return spaces[curSpace].roots; };

    /* ---------- Board-Scoped Workspace Connection (?board=<id>&title=<title>) ---------- */
    var urlParams = new URLSearchParams(window.location.search || '');
    var linkedBoardId = (urlParams.get('board') || '').trim();
    var linkedBoardTitle = (urlParams.get('title') || '').trim() || 'Workspace Docs';
    var linkedModulesParam = (urlParams.get('modules') || '').trim();
    var isBoardScoped = Boolean(linkedBoardId);
    var boardSpaceId = isBoardScoped
      ? ('board_' + linkedBoardId.replace(/[^a-zA-Z0-9_-]/g, '_'))
      : null;

    function getVisibleSpaces() {
      if (isBoardScoped && boardSpaceId && spaces[boardSpaceId]) {
        return [spaces[boardSpaceId]];
      }
      return Object.values(spaces).filter(function (s) { return !s.boardId; });
    }

    function getVisiblePages() {
      if (isBoardScoped && boardSpaceId) {
        return Object.values(pages).filter(function (p) { return p.space === boardSpaceId; });
      }
      return Object.values(pages).filter(function (p) {
        return spaces[p.space] && !spaces[p.space].boardId;
      });
    }

    function ensureBoardSpace(titleOverride) {
      if (!isBoardScoped || !boardSpaceId) return false;
      if (titleOverride && String(titleOverride).trim()) {
        linkedBoardTitle = String(titleOverride).trim();
      }
      var created = false;
      if (!spaces[boardSpaceId]) {
        spaces[boardSpaceId] = {
          id: boardSpaceId,
          name: linkedBoardTitle,
          icon: '🌿',
          color: '#15803d',
          desc: 'Collaborative Leaf pages linked to ' + linkedBoardTitle + '.',
          boardId: linkedBoardId,
          roots: []
        };
        created = true;
      } else {
        spaces[boardSpaceId].name = linkedBoardTitle;
        spaces[boardSpaceId].boardId = linkedBoardId;
      }
      if (!spaces[boardSpaceId].roots || !spaces[boardSpaceId].roots.length) {
        var pid = 'bp_' + boardSpaceId + '_home';
        if (!pages[pid]) {
          mk(pid, '🌿', linkedBoardTitle, {
            sp: boardSpaceId,
            sub: 'Workspace documentation linked to ' + linkedBoardTitle + '.',
            status: 'Draft',
            author: ME.n,
            ago: 0,
            html: '<h1>' + esc(linkedBoardTitle) + '</h1><p>This Leaf workspace is linked directly to <b>' + esc(linkedBoardTitle) + '</b>. Only pages created in this board appear here. Press <b>/</b> on a new line to insert blocks.</p>'
          });
        }
        spaces[boardSpaceId].roots = [pid];
        created = true;
      }
      curSpace = boardSpaceId;
      if (!pages[cur] || pages[cur].space !== boardSpaceId) {
        cur = spaces[boardSpaceId].roots[0];
      }
      var titleBadge = document.getElementById('leaf-board-title');
      if (titleBadge) titleBadge.textContent = linkedBoardTitle;
      return created;
    }

    function initBoardTopnavSwitcher() {
      if (!isBoardScoped) return;
      var bar = document.getElementById('leaf-board-bar');
      var titleElTop = document.getElementById('leaf-board-title');
      var dd = document.getElementById('leaf-ws-dropdown');
      var btn = document.getElementById('leaf-ws-dropdown-btn');
      var menu = document.getElementById('leaf-ws-dropdown-menu');
      if (!bar || !dd || !btn || !menu) return;

      bar.hidden = false;
      if (titleElTop) titleElTop.textContent = linkedBoardTitle;

      var ALL_MODS = [
        { id: 'whiteboard', label: 'Whiteboarding', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9h4m-4 4h10"/></svg>' },
        { id: 'project-planning', label: 'Project Planning', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h10"/><path d="M6 12h9"/><path d="M11 18h7"/></svg>' },
        { id: 'mindmap', label: 'Mind Map', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>' },
        { id: 'kanban', label: 'Kanban Board', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>' },
        { id: 'perspective', label: 'Perspective', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' },
        { id: 'brainstorm', label: 'Brainstorm', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>' },
        { id: 'leaf', label: 'Leaf', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>' }
      ];
      var allowedSet = linkedModulesParam
        ? new Set(linkedModulesParam.split(',').map(function (m) { return m.trim().toLowerCase(); }).filter(Boolean))
        : null;
      if (allowedSet) allowedSet.add('leaf');

      var modsToShow = allowedSet
        ? ALL_MODS.filter(function (m) { return allowedSet.has(m.id); })
        : ALL_MODS;

      menu.innerHTML = modsToShow.map(function (m) {
        var isAct = m.id === 'leaf';
        return '<div class="topbar-ws-dropdown__row">' +
          '<button class="topbar-ws-dropdown__item' + (isAct ? ' is-active' : '') + '" data-leaf-switch-mod="' + m.id + '" type="button" role="menuitem">' +
            '<span class="topbar-ws-dropdown__icon" aria-hidden="true">' + m.icon + '</span>' +
            '<span>' + esc(m.label) + '</span>' +
            (isAct ? '<span class="topbar-ws-dropdown__item-check" aria-hidden="true">&#10003;</span>' : '') +
          '</button>' +
        '</div>';
      }).join('');

      var closeDd = function () {
        menu.hidden = true;
        dd.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      };

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = menu.hidden;
        if (willOpen) {
          menu.hidden = false;
          dd.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          closeDd();
        }
      });

      menu.addEventListener('click', function (e) {
        var item = e.target.closest('[data-leaf-switch-mod]');
        if (!item) return;
        var mod = item.getAttribute('data-leaf-switch-mod');
        closeDd();
        if (!mod || mod === 'leaf') return;
        saveCur();
        pushWorkspaceToConvex(true);
        window.location.href = '/app/?board=' + encodeURIComponent(linkedBoardId) +
          '&module=' + encodeURIComponent(mod) +
          '&template=' + encodeURIComponent(mod);
      });

      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) closeDd();
      });

      // Sync exact live board title from server in case the board was renamed
      fetch('/api/boards/' + encodeURIComponent(linkedBoardId), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.board && d.board.title && d.board.title.trim()) {
            ensureBoardSpace(d.board.title.trim());
            renderSpace();
            renderCrumbs();
          }
        })
        .catch(function () {});
    }

    function stub(t) {
      return '<h1>' + esc(t || 'Untitled') + '</h1><p>This page has no content yet. Press <b>/</b> on a new line to insert a block, or use the ribbon above to format text.</p>';
    }
    function mk(id, icon, title, o) {
      o = o || {};
      pages[id] = {
        id: id, icon: icon, title: title, space: o.sp || 'kb', sub: o.sub || '',
        html: o.html || stub(title), status: o.status || 'Draft', author: o.author || 'Alex Morgan',
        updated: o.updated || new Date(Date.now() - 864e5 * (o.ago || 3)),
        children: [], parent: null, expanded: Boolean(o.exp), threads: [], pc: [], versions: [],
        star: false, watch: false, published: o.pub !== false
      };
      return pages[id];
    }
    function link(p, c) {
      pages[c].parent = p;
      if (p) pages[p].children.push(c);
      else spaces[pages[c].space].roots.push(c);
    }

    function seedDefaults() {
      var sampleTpl = document.getElementById('leafSampleQ4');
      var sampleHtml = sampleTpl ? sampleTpl.innerHTML : stub('Q4 Platform Launch Plan');
      mk('home', '🏠', 'Knowledge Base Home', { sub: 'Start here to find team documentation.', ago: 12 });
      mk('proj', '🚀', 'Project Docs', { exp: true, status: 'Verified', ago: 6, sub: 'Plans, specifications, and decisions for active projects.' });
      mk('q4', '📝', 'Q4 Platform Launch Plan', { sub: 'Scope, milestones, and owners for the December launch.', status: 'In review', ago: 0, html: sampleHtml });
      mk('road', '🧭', 'Roadmap');
      mk('arch', '📐', 'Architecture', { exp: true, status: 'Verified' });
      mk('api', '🔌', 'API Guidelines');
      mk('team', '👥', 'Team Handbook', { exp: true, status: 'Verified' });
      mk('leave', '🌴', 'Leave Policy', { status: 'Verified' });
      mk('onb', '🎓', 'Onboarding Guide');
      mk('meet', '🧪', 'Meeting Notes');
      mk('sprint', '📅', 'Sprint Review', { status: 'Draft', pub: false });
      link(null, 'home'); link(null, 'proj'); link('proj', 'q4'); link('proj', 'road'); link('proj', 'arch'); link('arch', 'api');
      link(null, 'team'); link('team', 'leave'); link('team', 'onb'); link(null, 'meet'); link('meet', 'sprint');

      mk('ehome', '🛠️', 'Engineering Home', { sp: 'eng', author: 'Sam Rivera', ago: 9, status: 'Verified', sub: 'Start here for engineering processes and tools.' });
      mk('runb', '📘', 'Runbooks', { sp: 'eng', exp: true, author: 'Sam Rivera', ago: 2, status: 'Verified' });
      mk('inc', '🚨', 'Incident Response', { sp: 'eng', author: 'Jordan Lee', ago: 1, status: 'In review', html: '<h1>Incident Response</h1><p>When an alert fires, the on-call engineer acknowledges the page within 5 minutes and opens a dedicated incident channel.</p><h2>Severity levels</h2><ul><li>SEV1: customer-facing outage</li><li>SEV2: degraded performance</li><li>SEV3: minor issue with a workaround</li></ul>' });
      mk('dep', '🚢', 'Deploy Process', { sp: 'eng', author: 'Sam Rivera', ago: 4, html: '<h1>Deploy Process</h1><p>Every release passes the automated test suite, a canary rollout to 5% of traffic, and a health check before full rollout.</p><h2>Rollback</h2><p>If the error rate exceeds 1% during the canary stage, the pipeline rolls back automatically.</p>' });
      mk('hhome', '🌱', 'People and Culture Home', { sp: 'hr', author: 'Mei Tanaka', ago: 15, status: 'Verified' });
      mk('ben', '🩺', 'Benefits Guide', { sp: 'hr', author: 'Mei Tanaka', ago: 7, status: 'Verified', html: '<h1>Benefits Guide</h1><p>All full-time employees receive health insurance, a retirement plan with employer matching, and 25 days of annual leave.</p><h2>Enrollment</h2><p>New employees must complete enrollment within 30 days of their start date.</p>' });
      mk('mhome', '📣', 'Marketing Home', { sp: 'mkt', author: 'Priya Nair', ago: 20 });
      mk('camp', '🗓️', 'Campaign Calendar', { sp: 'mkt', author: 'Priya Nair', ago: 1, status: 'In review', html: '<h1>Campaign Calendar</h1><p>The Q4 platform launch campaign starts on Dec 2 with a teaser email, followed by a webinar on Dec 9.</p><h2>Channels</h2><ul><li>Email newsletter</li><li>Product blog</li><li>Social media</li></ul>' });
      link(null, 'ehome'); link(null, 'runb'); link('runb', 'inc'); link('runb', 'dep'); link(null, 'hhome'); link('hhome', 'ben'); link(null, 'mhome'); link('mhome', 'camp');

      pages.q4.threads = [{ id: 'c1', quote: 'median page load time', resolved: false, msgs: [{ by: 'Priya Nair', text: 'Should this target the 75th percentile instead of the median? Our dashboards report p75.', t: Date.now() - 36e5 * 5 }, { by: 'Alex Morgan', text: 'Good point. I will confirm with the performance team.', t: Date.now() - 36e5 * 3 }] }];
      pages.q4.pc = [{ by: 'Sam Rivera', text: 'The load test environment is ready. I will share the first results on Dec 1.', t: Date.now() - 864e5 }];
      pages.q4.versions = [
        { n: 2, t: new Date(Date.now() - 864e5 * 2), by: 'Priya Nair', title: 'Q4 Platform Launch Plan', html: '<h1>Overview</h1><p>Draft scope for the Q4 Platform Launch. Milestones and owners are still being confirmed.</p><h2>Goals</h2><ul><li>Reduce median page load time</li><li>Keep the error rate low</li></ul>' },
        { n: 1, t: new Date(Date.now() - 864e5 * 6), by: 'Alex Morgan', title: 'Q4 launch notes', html: '<h1>Overview</h1><p>Initial notes for the launch. This page will be expanded after the planning workshop.</p>' }
      ];
    }

    var convexSyncTimer = null;
    var localUpdatedAt = 0;

    function buildWorkspaceSnapshot() {
      return { pages: pages, spaces: spaces, cur: cur, curSpace: curSpace, uid: uid, cid: cid, updatedAt: localUpdatedAt || Date.now() };
    }

    function pushWorkspaceToConvex(keepalive) {
      var snapshot = buildWorkspaceSnapshot();
      if (!navigator.onLine) {
        if (window.QFSyncStatus) {
          window.QFSyncStatus.enqueue('/api/leaf', 'PUT', snapshot);
          window.QFSyncStatus.set('offline');
        }
        return Promise.resolve();
      }
      if (window.QFSyncStatus && !keepalive) window.QFSyncStatus.set('syncing');
      return fetch('/api/leaf', {
        method: 'PUT',
        credentials: 'same-origin',
        keepalive: Boolean(keepalive),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      })
        .then(function (r) {
          if (r && r.ok && window.QFSyncStatus && !keepalive) window.QFSyncStatus.set('saved');
          return r;
        })
        .catch(function () {
          if (window.QFSyncStatus) {
            window.QFSyncStatus.enqueue('/api/leaf', 'PUT', snapshot);
            if (!navigator.onLine) window.QFSyncStatus.set('offline');
          }
        });
    }

    function persistStore() {
      localUpdatedAt = Date.now();
      var snapshot = buildWorkspaceSnapshot();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (e) {}
      if (window.QFSyncStatus) window.QFSyncStatus.set(navigator.onLine ? 'saving' : 'offline');
      clearTimeout(convexSyncTimer);
      convexSyncTimer = setTimeout(function () {
        pushWorkspaceToConvex(false);
      }, 750);
    }

    window.addEventListener('beforeunload', function () {
      if (convexSyncTimer) {
        clearTimeout(convexSyncTimer);
        convexSyncTimer = null;
        pushWorkspaceToConvex(true);
      }
    });

    function applyWorkspaceData(parsed) {
      if (!parsed || !parsed.pages || !parsed.spaces || !Object.keys(parsed.pages).length) return false;
      pages = parsed.pages;
      spaces = parsed.spaces;
      Object.keys(pages).forEach(function (k) {
        if (pages[k].updated) pages[k].updated = new Date(pages[k].updated);
      });
      cur = parsed.cur && pages[parsed.cur] ? parsed.cur : Object.keys(pages)[0];
      curSpace = parsed.curSpace && spaces[parsed.curSpace] ? parsed.curSpace : pages[cur].space;
      uid = Number(parsed.uid) || 100;
      cid = Number(parsed.cid) || 10;
      localUpdatedAt = Number(parsed.updatedAt) || 0;
      return true;
    }

    function hydrateStore() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw && applyWorkspaceData(JSON.parse(raw))) return;
      } catch (e) {}
      seedDefaults();
    }
    hydrateStore();

    function hydrateFromConvex() {
      fetch('/api/leaf', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return;
          if (!d.workspace) {
            // First time connecting this account to Convex — push existing local spaces/pages up
            localUpdatedAt = localUpdatedAt || Date.now();
            pushWorkspaceToConvex(false);
            return;
          }
          var remoteTs = Number(d.workspace.updatedAt) || 0;
          if (!localUpdatedAt || remoteTs > localUpdatedAt) {
            if (applyWorkspaceData(d.workspace)) {
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d.workspace)); } catch (e) {}
              if (isBoardScoped) {
                ensureBoardSpace();
                load();
              } else if (view === 'home') showHome(true);
              else load();
            }
          } else if (localUpdatedAt > remoteTs) {
            // Local has newer unsynced edits — push them to Convex
            pushWorkspaceToConvex(false);
          }
        })
        .catch(function () {});
    }

    /* ---------- selection helpers ---------- */
    var savedRange = null;
    var inEd = function () { var s = getSelection(); return s.rangeCount && ed.contains(s.anchorNode); };
    function restore() {
      var s = getSelection();
      var had = inEd();
      var keep = had ? s.getRangeAt(0).cloneRange() : null;
      if (document.activeElement !== ed) ed.focus({ preventScroll: true });
      if (keep) { s.removeAllRanges(); s.addRange(keep); }
      else if (savedRange) { s.removeAllRanges(); s.addRange(savedRange); }
    }
    function selEl() {
      var s = getSelection();
      var n = s.rangeCount ? s.anchorNode : (savedRange && savedRange.startContainer);
      if (n && n.nodeType === 3) n = n.parentNode;
      return n && ed.contains(n) ? n : null;
    }
    var closestEl = function (sel) { var e = selEl(); return e ? e.closest(sel) : null; };
    function blockOf(n) {
      while (n && n !== ed) {
        if (n.nodeType === 1 && /^(P|H[1-6]|BLOCKQUOTE|LI|DIV|PRE|TD|TH)$/.test(n.tagName) && !n.classList.contains('callout')) return n;
        n = n.parentNode;
      }
      return null;
    }
    function selectedBlocks() {
      var s = getSelection();
      if (!s.rangeCount) return [];
      var r = s.getRangeAt(0);
      var all = $$('p,h1,h2,h3,h4,h5,h6,blockquote,li,pre', ed).filter(function (b) { return r.intersectsNode(b); });
      if (!all.length) { var b = blockOf(s.anchorNode); return b ? [b] : []; }
      return all.filter(function (b) { return !(b.tagName === 'LI' && b.querySelector('li')); });
    }

    /* ---------- exec ---------- */
    function exec(cmd, val) {
      restore();
      document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor');
      document.execCommand(cmd, false, val == null ? null : val);
      changed();
    }
    function insertBlock(html, trail) {
      if (trail === undefined) trail = true;
      restore();
      var sel = getSelection();
      var top = sel.anchorNode;
      while (top && top.parentNode !== ed) top = top.parentNode;
      var r = document.createRange();
      if (top && top.nodeType === 1 && !top.textContent.trim() && !top.querySelector('img,table,hr,pre,.pill,.callout,.blk')) r.selectNode(top);
      else if (top) { r.setStartAfter(top); r.collapse(true); }
      else { r.selectNodeContents(ed); r.collapse(false); }
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('insertHTML', false, html + (trail ? '<p><br></p>' : ''));
      changed();
    }
    function insertInline(html) {
      restore();
      document.execCommand('insertHTML', false, html + '&nbsp;');
      changed();
    }

    /* ---------- popovers & modals ---------- */
    var openPop = null;
    function closePop() { if (openPop) { openPop.el.remove(); openPop = null; } }
    function pop(anchor, html, mount) {
      if (openPop && openPop.anchor === anchor) { closePop(); return null; }
      closePop();
      var p = document.createElement('div');
      p.className = 'leaf-pop';
      p.innerHTML = html;
      document.body.appendChild(p);
      var r = anchor.getBoundingClientRect();
      p.style.top = (r.bottom + 4) + 'px';
      p.style.left = r.left + 'px';
      var pr = p.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8) p.style.left = Math.max(8, window.innerWidth - pr.width - 8) + 'px';
      if (pr.bottom > window.innerHeight - 8) p.style.top = Math.max(8, r.top - pr.height - 4) + 'px';
      p.addEventListener('mousedown', function (e) { if (!e.target.closest('input,textarea,select')) e.preventDefault(); });
      openPop = { el: p, anchor: anchor };
      icons();
      if (mount) mount(p);
      return p;
    }
    function modal(title, body, opts) {
      opts = opts || {};
      var o = document.createElement('div');
      o.className = 'leaf-ovl';
      o.innerHTML =
        '<div class="lf-mdl" style="width:' + (opts.w || 480) + 'px">' +
          '<div class="lf-mh"><h3>' + title + '</h3><button class="lf-ib" data-x>' + ic('x') + '</button></div>' +
          '<div class="lf-mb">' + body + '</div>' +
          (opts.footer ? '<div class="lf-mf">' + opts.footer + '</div>' : '') +
        '</div>';
      document.body.appendChild(o);
      icons();
      var close = function () { o.remove(); };
      o.addEventListener('mousedown', function (e) { if (e.target === o) close(); });
      o.querySelector('[data-x]').onclick = close;
      if (opts.mount) opts.mount(o, close);
      return { o: o, close: close };
    }

    /* ---------- ribbon ---------- */
    var B = function (cmd, icon, title, st) {
      return '<button class="lf-tb" data-cmd="' + cmd + '"' + (st ? ' data-st="' + st + '"' : '') + ' title="' + title + '">' + ic(icon) + '</button>';
    };
    var SEP = '<span class="lf-sep"></span>';
    var opt = function (a, sel) {
      return a.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === sel ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
    };
    var FONTS = ['Segoe UI', 'Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New'];
    var SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

    $('#lf-ribbon').innerHTML = [
      [B('undo', 'undo-2', 'Undo (Ctrl+Z)'), B('redo', 'redo-2', 'Redo (Ctrl+Y)'), '<button class="lf-tb" id="lf-btnPainter" title="Format Painter">' + ic('paintbrush') + '</button>'],
      [
        '<select id="lf-blockSel" class="lf-sel" style="width:104px" title="Paragraph style">' + opt([['p', 'Normal'], ['title', 'Title'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['blockquote', 'Quote']], 'p') + '</select>',
        '<select id="lf-fontSel" class="lf-sel" style="width:116px" title="Font family">' + FONTS.map(function (f) { return '<option style="font-family:\'' + f + '\'">' + f + '</option>'; }).join('') + '</select>',
        '<select id="lf-sizeSel" class="lf-sel" style="width:52px" title="Font size">' + opt(SIZES.map(function (s) { return [s, s]; }), 16) + '</select>'
      ],
      [B('bold', 'bold', 'Bold (Ctrl+B)', 'bold'), B('italic', 'italic', 'Italic (Ctrl+I)', 'italic'), B('underline', 'underline', 'Underline (Ctrl+U)', 'underline'), B('strikeThrough', 'strikethrough', 'Strikethrough', 'strikeThrough'), B('subscript', 'subscript', 'Subscript', 'subscript'), B('superscript', 'superscript', 'Superscript', 'superscript')],
      [
        '<button class="lf-tb" id="lf-btnFore" title="Text color"><span style="position:relative;display:inline-flex;">' + ic('baseline') + '<span class="lf-cbar" id="lf-foreBar" style="background:#c9372c"></span></span></button><button class="lf-tb caret" id="lf-btnForeC">' + ic('chevron-down') + '</button>',
        '<button class="lf-tb" id="lf-btnHi" title="Highlight color"><span style="position:relative;display:inline-flex;">' + ic('highlighter') + '<span class="lf-cbar" id="lf-hiBar" style="background:#f5cd47"></span></span></button><button class="lf-tb caret" id="lf-btnHiC">' + ic('chevron-down') + '</button>',
        '<button class="lf-tb" id="lf-btnClear" title="Clear formatting">' + ic('remove-formatting') + '</button>'
      ],
      [B('justifyLeft', 'align-left', 'Align left', 'justifyLeft'), B('justifyCenter', 'align-center', 'Center', 'justifyCenter'), B('justifyRight', 'align-right', 'Align right', 'justifyRight'), B('justifyFull', 'align-justify', 'Justify', 'justifyFull'), '<button class="lf-tb" id="lf-btnSpace" title="Line and paragraph spacing">' + ic('chevrons-up-down') + '</button>', B('outdent', 'indent-decrease', 'Decrease indent'), B('indent', 'indent-increase', 'Increase indent')],
      [B('insertUnorderedList', 'list', 'Bulleted list', 'insertUnorderedList'), B('insertOrderedList', 'list-ordered', 'Numbered list', 'insertOrderedList'), '<button class="lf-tb" id="lf-btnMulti" title="Multi-level list">' + ic('list-tree') + '</button>', '<button class="lf-tb" id="lf-btnCheck" title="Action item / checklist">' + ic('list-todo') + '</button>'],
      ['<button class="lf-tb" id="lf-btnTable" title="Insert table">' + ic('table') + '</button>', '<button class="lf-tb" id="lf-btnLink" title="Insert link (Ctrl+K)">' + ic('link') + '</button>', '<button class="lf-tb" id="lf-btnImage" title="Insert image">' + ic('image') + '</button>', '<button class="lf-tb" id="lf-btnCode" title="Code block">' + ic('code') + '</button><button class="lf-tb caret" id="lf-btnCodeC">' + ic('chevron-down') + '</button>', '<button class="lf-tb" id="lf-btnCallout" title="Callout panel">' + ic('info') + '<span>Panel</span></button>', '<button class="lf-tb" id="lf-btnHr" title="Horizontal divider">' + ic('minus') + '</button>', '<button class="lf-tb" id="lf-btnDate" title="Date pill">' + ic('calendar') + '</button>', '<button class="lf-tb" id="lf-btnMention" title="Mention a person">' + ic('at-sign') + '</button>']
    ].map(function (g) { return '<div class="lf-grp">' + g.join('') + '</div>'; }).join(SEP) +
    '<span class="lf-sep lf-hidden" id="lf-ttSep"></span><div class="lf-grp lf-hidden" id="lf-tableTools">' +
      '<button class="lf-tb" data-t="addRow" title="Add row below">' + ic('between-horizontal-end') + '</button>' +
      '<button class="lf-tb" data-t="addCol" title="Add column right">' + ic('between-vertical-end') + '</button>' +
      '<button class="lf-tb" data-t="delRow" title="Delete row">' + ic('rows-3') + ic('minus') + '</button>' +
      '<button class="lf-tb" data-t="delCol" title="Delete column">' + ic('columns-3') + ic('minus') + '</button>' +
      '<button class="lf-tb" data-t="delTable" title="Delete table" style="color:#ae2e24">' + ic('trash-2') + '</button>' +
    '</div>' +
    '<div class="lf-grp" style="margin-left:auto">' +
      '<button class="lf-tb" id="lf-btnFind" title="Find and replace (Ctrl+H)">' + ic('search') + '<span>Find</span></button>' +
      '<button class="lf-tb" id="lf-btnWidth" title="Toggle fixed or full width">' + ic('maximize-2') + '<span id="lf-widthLbl">Full width</span></button>' +
    '</div>';

    $('#lf-ribbon').addEventListener('mousedown', function (e) { if (!e.target.closest('select,input')) e.preventDefault(); });
    $('#lf-ribbon').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]'); if (b) exec(b.dataset.cmd);
      var t = e.target.closest('[data-t]'); if (t) tableOp(t.dataset.t);
    });

    /* state */
    var painter = null;
    function updateState() {
      var q = function (c) { try { return document.queryCommandState(c); } catch (e) { return false; } };
      $$('[data-st]').forEach(function (b) { b.classList.toggle('on', q(b.dataset.st)); });
      var b = blockOf(getSelection().anchorNode);
      var v = 'p';
      if (b) {
        if (/^H[1-3]$/.test(b.tagName)) v = b.tagName.toLowerCase();
        else if (b.tagName === 'BLOCKQUOTE') v = 'blockquote';
        else if (b.classList.contains('is-title')) v = 'title';
      }
      $('#lf-blockSel').value = v;
      var el = selEl();
      if (el) {
        var fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
        if (SIZES.indexOf(fs) !== -1) $('#lf-sizeSel').value = fs;
        var ff = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (FONTS.indexOf(ff) !== -1) $('#lf-fontSel').value = ff;
      }
      var inT = Boolean(closestEl('td,th'));
      $('#lf-tableTools').classList.toggle('lf-hidden', !inT);
      $('#lf-ttSep').classList.toggle('lf-hidden', !inT);
      $('#lf-btnPainter').classList.toggle('on', Boolean(painter));
    }

    /* paragraph / font */
    $('#lf-blockSel').onchange = function (e) {
      var v = e.target.value;
      restore();
      if (v === 'title') {
        document.execCommand('formatBlock', false, '<p>');
        var b = blockOf(getSelection().anchorNode);
        if (b) b.classList.add('is-title');
      } else {
        document.execCommand('formatBlock', false, '<' + v + '>');
        selectedBlocks().forEach(function (b) { b.classList.remove('is-title'); });
      }
      changed();
    };
    $('#lf-fontSel').onchange = function (e) { exec('fontName', e.target.value); };
    function fixFonts(px) {
      px = px || $('#lf-sizeSel').value;
      $$('font[size="7"]', ed).forEach(function (f) {
        var s = document.createElement('span');
        s.style.fontSize = px + 'px';
        s.innerHTML = f.innerHTML;
        f.replaceWith(s);
      });
    }
    $('#lf-sizeSel').onchange = function (e) {
      restore();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontSize', false, '7');
      fixFonts(e.target.value);
      changed();
    };

    /* colors */
    var PAL = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff', '#c9372c', '#e56910', '#cf9f02', '#1f845a', '#1868db', '#6e5dc6', '#fd9891', '#fec195', '#f5cd47', '#7ee2b8', '#8fb8f6', '#b8acf6'];
    var foreC = '#c9372c', hiC = '#f5cd47';
    var palette = function (cb) {
      return function (p) {
        $$('.lf-sw,[data-none]', p).forEach(function (s) {
          s.onclick = function () { cb(s.dataset.c || null); closePop(); };
        });
      };
    };
    var palHTML = function (lbl) {
      return '<div class="lf-swgrid">' + PAL.map(function (c) { return '<button class="lf-sw" data-c="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div><button class="lf-pi" data-none="1">' + ic('ban') + lbl + '</button>';
    };
    $('#lf-btnFore').onclick = function () { exec('foreColor', foreC); };
    $('#lf-btnForeC').onclick = function (e) { pop(e.currentTarget, palHTML('Automatic'), palette(function (c) { foreC = c || '#172b4d'; $('#lf-foreBar').style.background = foreC; exec('foreColor', foreC); })); };
    $('#lf-btnHi').onclick = function () { exec('hiliteColor', hiC); };
    $('#lf-btnHiC').onclick = function (e) { pop(e.currentTarget, palHTML('No color'), palette(function (c) { if (c) { hiC = c; $('#lf-hiBar').style.background = c; } exec('hiliteColor', c || 'transparent'); })); };
    $('#lf-btnClear').onclick = function () {
      restore();
      document.execCommand('removeFormat');
      document.execCommand('formatBlock', false, '<p>');
      selectedBlocks().forEach(function (b) { b.classList.remove('is-title'); b.removeAttribute('style'); });
      changed();
    };

    /* format painter */
    $('#lf-btnPainter').onclick = function () {
      if (painter) { painter = null; ed.classList.remove('painting'); updateState(); return; }
      restore();
      var q = function (c) { return document.queryCommandState(c); };
      painter = { bold: q('bold'), italic: q('italic'), underline: q('underline'), strikeThrough: q('strikeThrough'), foreColor: document.queryCommandValue('foreColor'), fontName: document.queryCommandValue('fontName') };
      ed.classList.add('painting');
      toast('Format Painter: select the text to format');
      updateState();
    };
    ed.addEventListener('mouseup', function () {
      if (!painter) return;
      setTimeout(function () {
        var s = getSelection();
        if (s.isCollapsed) return;
        ['bold', 'italic', 'underline', 'strikeThrough'].forEach(function (c) { if (document.queryCommandState(c) !== painter[c]) document.execCommand(c); });
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, painter.foreColor);
        document.execCommand('fontName', false, painter.fontName.replace(/"/g, ''));
        painter = null;
        ed.classList.remove('painting');
        changed();
        updateState();
      }, 0);
    });

    /* spacing */
    $('#lf-btnSpace').onclick = function (e) {
      pop(e.currentTarget, [1, 1.15, 1.5, 2].map(function (v) {
        return '<button class="lf-pi" data-lh="' + v + '">' + ic('check') + '<span>' + v.toFixed(v % 1 ? 2 : 1).replace(/0$/, '') + ' line spacing</span></button>';
      }).join('') + '<div style="height:1px;background:#ebecf0;margin:4px 0"></div><button class="lf-pi" data-mb="16">Add space after paragraph</button><button class="lf-pi" data-mb="0">Remove space after paragraph</button>', function (p) {
        var cb = selectedBlocks()[0];
        var curLh = cb ? parseFloat(cb.style.lineHeight) || 0 : 0;
        $$('[data-lh]', p).forEach(function (b) { if (+b.dataset.lh !== curLh) { var svg = b.querySelector('svg'); if (svg) svg.style.visibility = 'hidden'; } });
        p.onclick = function (ev) {
          var b = ev.target.closest('button'); if (!b) return;
          restore();
          var bl = selectedBlocks();
          if (b.dataset.lh) bl.forEach(function (x) { x.style.lineHeight = String(1.7 * Number(b.dataset.lh)); });
          if (b.dataset.mb != null) bl.forEach(function (x) { x.style.marginBottom = b.dataset.mb + 'px'; });
          changed(); closePop();
        };
      });
    };

    /* lists */
    $('#lf-btnMulti').onclick = function () {
      restore();
      var ol = closestEl('ol');
      if (!ol) { document.execCommand('insertOrderedList'); ol = closestEl('ol'); }
      if (ol) {
        while (ol.parentElement && ol.parentElement.closest('ol')) ol = ol.parentElement.closest('ol');
        ol.classList.toggle('multi');
        var on = ol.classList.contains('multi');
        $$('ol', ol).forEach(function (o) { o.classList.toggle('multi', on); });
      }
      changed();
    };
    $('#lf-btnCheck').onclick = function () {
      restore();
      var ul = closestEl('ul.checklist');
      if (ul) { $$('.cb', ul).forEach(function (c) { c.remove(); }); ul.classList.remove('checklist'); changed(); return; }
      insertBlock('<ul class="checklist"><li><span class="cb" contenteditable="false"></span>Action item</li></ul>', false);
    };

    /* inserts */
    var lastLang = 'javascript';
    function insertTable(r, c) {
      var h = '<table>';
      for (var i = 0; i < r; i++) {
        h += '<tr>' + Array.from({ length: c }, function () { return i ? '<td><br></td>' : '<th><br></th>'; }).join('') + '</tr>';
      }
      insertBlock(h + '</table>');
    }
    $('#lf-btnTable').onclick = function (e) {
      pop(e.currentTarget, '<div class="lf-tgrid">' + Array.from({ length: 48 }, function (_, i) {
        return '<span class="lf-tg" data-r="' + (Math.floor(i / 8) + 1) + '" data-c="' + (i % 8 + 1) + '"></span>';
      }).join('') + '</div><div id="lf-tgl" style="text-align:center;padding:2px 0 4px;color:#626f86">Insert table</div>', function (p) {
        var cells = $$('.lf-tg', p);
        p.onmouseover = function (ev) {
          var t = ev.target.closest('.lf-tg'); if (!t) return;
          var r = +t.dataset.r, c = +t.dataset.c;
          cells.forEach(function (x) { x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c); });
          p.querySelector('#lf-tgl').textContent = r + ' x ' + c;
        };
        p.onclick = function (ev) {
          var t = ev.target.closest('.lf-tg'); if (!t) return;
          insertTable(+t.dataset.r, +t.dataset.c); closePop();
        };
      });
    };

    var LANGS = ['javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'sql', 'html', 'css', 'bash', 'json', 'plain text'];
    function insertCode(l) {
      lastLang = l || lastLang;
      var pre = closestEl('pre.code');
      if (pre) { pre.dataset.lang = lastLang; changed(); return; }
      insertBlock('<pre class="code" data-lang="' + lastLang + '"><code>// Write code here</code></pre>');
    }
    $('#lf-btnCode').onclick = function () { insertCode(); };
    $('#lf-btnCodeC').onclick = function (e) {
      pop(e.currentTarget, LANGS.map(function (l) { return '<button class="lf-pi" data-l="' + l + '">' + l + '</button>'; }).join(''), function (p) {
        p.onclick = function (ev) { var b = ev.target.closest('[data-l]'); if (b) { insertCode(b.dataset.l); closePop(); } };
      });
    };

    var CALL = [['info', 'Info', '#1868db'], ['note', 'Note', '#6e5dc6'], ['warning', 'Warning', '#b38600'], ['success', 'Success', '#1f845a'], ['error', 'Error', '#c9372c']];
    function insertCallout(t) {
      var info = CALL.find(function (x) { return x[0] === t; }) || CALL[0];
      insertBlock('<div class="callout ' + t + ' blk" contenteditable="false"><span class="ci"></span><div class="cbody" contenteditable="true"><p>' + info[1] + ' text goes here</p></div></div>');
    }
    $('#lf-btnCallout').onclick = function (e) {
      pop(e.currentTarget, CALL.map(function (c) {
        return '<button class="lf-pi" data-k="' + c[0] + '"><span style="width:14px;height:14px;border-radius:50%;background:' + c[2] + ';display:inline-block"></span>' + c[1] + ' panel</button>';
      }).join(''), function (p) {
        p.onclick = function (ev) { var b = ev.target.closest('[data-k]'); if (b) { insertCallout(b.dataset.k); closePop(); } };
      });
    };

    $('#lf-btnHr').onclick = function () { insertBlock('<hr>'); };
    var fmtDate = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    function insertDate() { insertInline('<span class="pill date" contenteditable="false">' + fmtDate(new Date()) + '</span>'); }
    $('#lf-btnDate').onclick = insertDate;
    function insertMention(n) { insertInline('<span class="pill mention" contenteditable="false">@' + esc(n) + '</span>'); }
    $('#lf-btnMention').onclick = function (e) {
      pop(e.currentTarget, '<input class="lf-inp" id="lf-mq" placeholder="Search people" style="margin-bottom:4px;width:200px"><div id="lf-ml"></div>', function (p) {
        var draw = function () {
          var q = p.querySelector('#lf-mq').value.toLowerCase();
          p.querySelector('#lf-ml').innerHTML = USERS.filter(function (u) { return u.n.toLowerCase().indexOf(q) !== -1; })
            .map(function (u) { return '<button class="lf-pi" data-n="' + esc(u.n) + '">' + avatar(u.n, 22) + esc(u.n) + '</button>'; }).join('') || '<div style="padding:6px 10px;color:#626f86">No matches</div>';
        };
        draw();
        p.querySelector('#lf-mq').oninput = draw;
        p.onclick = function (ev) { var b = ev.target.closest('[data-n]'); if (b) { insertMention(b.dataset.n); closePop(); } };
      });
    };

    ed.addEventListener('click', function (e) {
      var d = e.target.closest('.pill.date');
      if (d) {
        pop(d, '<input type="date" class="lf-inp" id="lf-dp" style="width:170px">', function (p) {
          p.querySelector('#lf-dp').onchange = function (ev) {
            if (ev.target.value) { d.textContent = fmtDate(new Date(ev.target.value + 'T12:00:00')); changed(); closePop(); }
          };
        });
      }
    });

    /* link & image */
    function openLink() {
      restore();
      var txt = getSelection().toString();
      var keep = savedRange && savedRange.cloneRange();
      modal('Insert link', '<label class="lf-lbl">Text to display</label><input class="lf-inp" id="lf-lkT" value="' + esc(txt) + '"><label class="lf-lbl">Address</label><input class="lf-inp" id="lf-lkU" placeholder="https://">', {
        footer: '<button class="lf-btn lf-btn-g" data-c>Cancel</button><button class="lf-btn lf-btn-p" data-ok>Insert</button>',
        w: 440,
        mount: function (o, close) {
          setTimeout(function () { o.querySelector('#lf-lkU').focus(); }, 30);
          o.querySelector('[data-c]').onclick = close;
          var ok = function () {
            var u = o.querySelector('#lf-lkU').value.trim(); if (!u) return;
            if (!/^(https?:|mailto:|#)/.test(u)) u = 'https://' + u;
            var t = o.querySelector('#lf-lkT').value || u;
            close(); savedRange = keep; restore();
            if (txt && txt === t) document.execCommand('createLink', false, u);
            else document.execCommand('insertHTML', false, '<a href="' + esc(u) + '">' + esc(t) + '</a>&nbsp;');
            $$('a[href]', ed).forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; a.title = 'Ctrl+click to open'; });
            changed();
          };
          o.querySelector('[data-ok]').onclick = ok;
          o.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ok(); });
        }
      });
    }
    $('#lf-btnLink').onclick = openLink;
    ed.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
    });
    /* ---------- image upload (Convex) + rich image figure builder ---------- */
    function buildImgFigureHtml(src, alt) {
      return '<figure class="lf-img-block" data-align="center" contenteditable="false" style="width:100%">' +
        '<div class="lf-img-frame">' +
          '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '">' +
          '<span class="lf-img-h nw" data-h="nw"></span>' +
          '<span class="lf-img-h ne" data-h="ne"></span>' +
          '<span class="lf-img-h sw" data-h="sw"></span>' +
          '<span class="lf-img-h se" data-h="se"></span>' +
          '<span class="lf-img-h w" data-h="w"></span>' +
          '<span class="lf-img-h e" data-h="e"></span>' +
        '</div>' +
        '<figcaption class="lf-img-cap" contenteditable="true" data-placeholder="Add a caption..."></figcaption>' +
      '</figure>';
    }

    function uploadLeafImage(file) {
      return new Promise(function (resolve, reject) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
          reject(new Error('Not an image file'));
          return;
        }
        var readFallback = function () {
          var r = new FileReader();
          r.onload = function () { resolve(r.result); };
          r.onerror = function () { reject(new Error('Failed to read image')); };
          r.readAsDataURL(file);
        };
        fetch('/api/leaf/image', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': file.type },
          body: file
        })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) {
            if (data && data.url) resolve(data.url);
            else readFallback();
          })
          .catch(readFallback);
      });
    }

    function insertImageFigure(src, alt) {
      insertBlock(buildImgFigureHtml(src, alt));
    }

    $('#lf-btnImage').onclick = function () {
      restore();
      var keep = savedRange && savedRange.cloneRange();
      modal('Insert image', '<label class="lf-lbl">Image address</label><input class="lf-inp" id="lf-imU" placeholder="https://example.com/image.png"><label class="lf-lbl">Alt text (optional)</label><input class="lf-inp" id="lf-imA" placeholder="Describe this image"><label class="lf-lbl">Or upload from your device</label><input type="file" id="lf-imF" accept="image/*" class="lf-inp" style="padding-top:4px">', {
        footer: '<button class="lf-btn lf-btn-g" data-c>Cancel</button><button class="lf-btn lf-btn-p" data-ok>Insert</button>',
        w: 460,
        mount: function (o, close) {
          o.querySelector('[data-c]').onclick = close;
          var okBtn = o.querySelector('[data-ok]');
          var put = function (src, alt) { close(); savedRange = keep; restore(); insertImageFigure(src, alt); };
          okBtn.onclick = function () {
            var alt = o.querySelector('#lf-imA').value.trim();
            var f = o.querySelector('#lf-imF').files[0];
            if (f) {
              okBtn.disabled = true;
              okBtn.textContent = 'Uploading...';
              uploadLeafImage(f).then(function (url) {
                put(url, alt || f.name);
              }, function () {
                okBtn.disabled = false;
                okBtn.textContent = 'Insert';
                toast('Could not upload image');
              });
            } else if (o.querySelector('#lf-imU').value.trim()) {
              put(o.querySelector('#lf-imU').value.trim(), alt);
            }
          };
        }
      });
    };

    /* tables */
    function activeTableCell(tbl) {
      var c = closestEl('td,th');
      if (c && (!tbl || tbl.contains(c))) return c;
      if (lastCell && (!tbl || tbl.contains(lastCell))) return lastCell;
      return tbl ? (tbl.rows[0] && tbl.rows[0].cells[0]) : null;
    }

    function tableOp(op, tblArg) {
      var c = activeTableCell(tblArg); if (!c) return;
      var tr = c.parentElement, tbl = c.closest('table'), ci = c.cellIndex;
      if (!tr || !tbl) return;
      if (op === 'addRowAbove' || op === 'addRow' || op === 'addRowBelow') {
        var n = document.createElement('tr');
        var totalCols = Array.prototype.reduce.call(tr.cells, function (sum, cell) { return sum + (cell.colSpan || 1); }, 0);
        n.innerHTML = Array.from({ length: totalCols }, function () { return '<td><br></td>'; }).join('');
        if (op === 'addRowAbove') tr.before(n); else tr.after(n);
      } else if (op === 'addColLeft' || op === 'addCol' || op === 'addColRight') {
        $$('tr', tbl).forEach(function (r) {
          var ref = r.cells[Math.min(ci, r.cells.length - 1)];
          if (!ref) return;
          var x = document.createElement(ref.tagName === 'TH' ? 'th' : 'td');
          x.innerHTML = '<br>';
          if (op === 'addColLeft') ref.before(x); else ref.after(x);
        });
      } else if (op === 'delRow') {
        tr.remove();
        if (!$('tr', tbl)) { tbl.remove(); hideBar(); }
      } else if (op === 'delCol') {
        $$('tr', tbl).forEach(function (r) { if (r.cells[ci]) r.cells[ci].remove(); });
        if (!$('td,th', tbl)) { tbl.remove(); hideBar(); }
      } else if (op === 'toggleHeader') {
        var r0 = tbl.rows[0];
        if (r0 && r0.cells.length) {
          var isTh = r0.cells[0].tagName === 'TH';
          Array.prototype.slice.call(r0.cells).forEach(function (cell) {
            var rep = document.createElement(isTh ? 'td' : 'th');
            rep.innerHTML = cell.innerHTML;
            rep.style.cssText = cell.style.cssText;
            if (cell.colSpan > 1) rep.colSpan = cell.colSpan;
            if (cell.rowSpan > 1) rep.rowSpan = cell.rowSpan;
            cell.replaceWith(rep);
          });
        }
      } else if (op === 'mergeRight') {
        var next = c.nextElementSibling;
        if (!next) { toast('No adjacent cell to the right to merge'); return; }
        var extra = next.innerHTML.replace(/^<br\s*\/?>$/i, '').trim();
        if (extra) c.innerHTML = (c.innerHTML.replace(/^<br\s*\/?>$/i, '').trim() ? c.innerHTML + ' ' : '') + extra;
        c.colSpan = (c.colSpan || 1) + (next.colSpan || 1);
        next.remove();
      } else if (op === 'splitCell') {
        var cs = c.colSpan || 1;
        if (cs <= 1) { toast('Select a merged cell to split'); return; }
        c.colSpan = 1;
        for (var k = 1; k < cs; k++) {
          var nc = document.createElement(c.tagName === 'TH' ? 'th' : 'td');
          nc.innerHTML = '<br>';
          c.after(nc);
        }
      } else if (op === 'delTable') {
        tbl.remove(); hideBar();
      }
      changed(); updateState();
    }

    /* ---------- slash command registry (all categories A-E) ---------- */
    var CATS = ['Text & Formatting', 'Layout', 'Callouts', 'Inline & Badges', 'Media & Code'];
    var REG = [];
    var R = function (o) {
      REG.push(Object.assign({ keywords: [] }, o, { onInsert: o.onInsert || function () { insertBlock(o.renderComponent()); } }));
    };
    var TX = CATS[0], LY = CATS[1], CL = CATS[2];
    R({ id: 'p', title: 'Paragraph', description: 'Plain body text', category: TX, icon: 'pilcrow', keywords: ['text', 'normal'], onInsert: function () { exec('formatBlock', '<p>'); } });
    ['Page section', 'Sub-section', 'Small heading', 'Minor heading', 'Fine heading', 'Smallest heading'].forEach(function (d, k) {
      R({ id: 'h' + (k + 1), title: 'Heading ' + (k + 1), description: d, category: TX, icon: 'heading-' + (k + 1), keywords: ['heading', 'title', 'header'], onInsert: function () { exec('formatBlock', '<h' + (k + 1) + '>'); } });
    });
    R({ id: 'bullets', title: 'Bulleted list', description: 'Simple list of points', category: TX, icon: 'list', keywords: ['ul', 'unordered', 'bullet'], onInsert: function () { exec('insertUnorderedList'); } });
    R({ id: 'numbered', title: 'Numbered list', description: 'Ordered list of steps', category: TX, icon: 'list-ordered', keywords: ['ol', 'ordered', 'numbers'], onInsert: function () { exec('insertOrderedList'); } });
    R({ id: 'tasks', title: 'Task list', description: 'Action items with assignee and due date', category: TX, icon: 'list-todo', keywords: ['todo', 'action', 'checklist', 'checkbox'], renderComponent: function () { return '<ul class="checklist"><li><span class="cb" contenteditable="false"></span>Action item<span class="tmeta" contenteditable="false" data-k="who">@ Assignee</span><span class="tmeta" contenteditable="false" data-k="due">Due date</span></li></ul>'; } });
    R({ id: 'quote', title: 'Blockquote', description: 'Call out a quotation', category: TX, icon: 'quote', keywords: ['blockquote', 'cite'], onInsert: function () { exec('formatBlock', '<blockquote>'); } });
    R({ id: 'pullquote', title: 'Pull quote', description: 'Large stylized quote', category: TX, icon: 'message-square-quote', keywords: ['quote', 'highlight', 'pull'], renderComponent: function () { return '<blockquote class="pull"><p>A memorable line worth highlighting</p></blockquote>'; } });

    R({ id: 'divider', title: 'Divider', description: 'Horizontal line', category: LY, icon: 'minus', keywords: ['hr', 'line', 'rule', 'separator'], renderComponent: function () { return '<hr>'; } });
    R({ id: 'table', title: 'Table', description: 'Rows and columns, header and cell colors', category: LY, icon: 'table', keywords: ['grid', 'rows', 'columns'], onInsert: function () { insertTable(3, 3); } });
    var lay = function (cols, n) {
      return function () { return '<div class="blk layout" data-type="layout" style="grid-template-columns:' + cols + '" contenteditable="false">' + '<div class="lcell" contenteditable="true"><p>Column text</p></div>'.repeat(n) + '</div>'; };
    };
    [
      ['cols2', '2-column layout', 'Two equal columns', '1fr 1fr', 2, 'columns-2', ['two', 'col', 'split']],
      ['cols3', '3-column layout', 'Three equal columns', '1fr 1fr 1fr', 3, 'columns-3', ['three', 'col']],
      ['sidebar-left', 'Left sidebar layout', 'Narrow left, wide right', '1fr 3fr', 2, 'panel-left', ['sidebar', '2 column left']],
      ['sidebar-right', 'Right sidebar layout', 'Wide left, narrow right', '3fr 1fr', 2, 'panel-right', ['sidebar', '2 column right']]
    ].forEach(function (x) {
      R({ id: x[0], title: x[1], description: x[2], category: LY, icon: x[5], keywords: ['layout'].concat(x[6]), renderComponent: lay(x[3], x[4]) });
    });
    R({ id: 'accordion', title: 'Expand (accordion)', description: 'Collapsible section with editable title', category: LY, icon: 'chevrons-up-down', keywords: ['expand', 'collapse', 'collapsible', 'details', 'toggle'], renderComponent: function () { return '<div class="blk acc open" data-type="acc" contenteditable="false"><div class="ahead"><span class="chev">&#9656;</span><span class="atitle" contenteditable="true">Click to edit title</span></div><div class="abody" contenteditable="true"><p>Hidden content goes here</p></div></div>'; } });
    R({ id: 'tabs', title: 'Tabs container', description: 'Switchable horizontal tabs', category: LY, icon: 'app-window', keywords: ['tab', 'panes'], renderComponent: function () { return '<div class="blk tabs" data-type="tabs" contenteditable="false"><div class="tabbar"><span class="xtab on" contenteditable="true">Tab 1</span><span class="xtab" contenteditable="true">Tab 2</span></div><div class="tpane on" contenteditable="true"><p>First tab content</p></div><div class="tpane" contenteditable="true"><p>Second tab content</p></div></div>'; } });
    R({ id: 'cards', title: 'Card grid', description: 'Responsive grid of cards', category: LY, icon: 'layout-grid', keywords: ['card', 'grid', 'container'], renderComponent: function () { return '<div class="blk xcards" data-type="cards" contenteditable="false">' + '<div class="gcard" contenteditable="true"><p><b>Card title</b></p><p>Card text</p></div>'.repeat(3) + '</div>'; } });
    R({ id: 'pagebreak', title: 'Page break', description: 'Visual print divider', category: LY, icon: 'scissors', keywords: ['print', 'break', 'pdf'], renderComponent: function () { return '<div class="blk pbreak" data-type="pbreak" contenteditable="false"><span>Page break</span></div>'; } });

    var panel = function (t, x, ico) {
      return '<div class="callout ' + t + ' blk" ' + (x || '') + ' contenteditable="false"><span class="ci">' + (ico || '') + '</span><div class="cbody" contenteditable="true"><p>Panel text goes here</p></div></div>';
    };
    var PK = { info: 'blue information callout', note: 'purple memo callout', warning: 'caution alert amber callout', success: 'tip check green callout', error: 'danger cross red fail callout' };
    [['info', 'Info panel', 'Highlight helpful information', 'info'], ['note', 'Note panel', 'Capture a side note', 'sticky-note'], ['warning', 'Warning panel', 'Draw attention to a risk', 'triangle-alert'], ['success', 'Success / tip panel', 'Confirm a positive result or tip', 'circle-check'], ['error', 'Error / danger panel', 'Flag a danger or failure', 'circle-x']]
      .forEach(function (x) {
        R({ id: x[0], title: x[1], description: x[2], category: CL, icon: x[3], keywords: PK[x[0]].split(' '), renderComponent: function () { return panel(x[0]); } });
      });
    R({ id: 'custom', title: 'Custom panel', description: 'Pick your own color and emoji', category: CL, icon: 'palette', keywords: ['callout', 'color', 'emoji'], renderComponent: function () { return panel('custom', 'style="background:#fff0e6"', '&#128161;'); } });
    R({ id: 'code', title: 'Code block', description: 'Monospaced code snippet', category: CATS[4], icon: 'code', keywords: ['snippet'], onInsert: function () { insertCode(); } });
    R({ id: 'image', title: 'Image', description: 'Upload or link an image', category: CATS[4], icon: 'image', keywords: ['picture'], onInsert: function () { $('#lf-btnImage').click(); } });
    R({ id: 'date', title: 'Date', description: 'Insert today as a date pill', category: CATS[3], icon: 'calendar', keywords: ['today'], onInsert: insertDate });

    function slashItems(q) {
      var sc = function (s) {
        s = s.toLowerCase();
        if (s.indexOf(q) === 0) return 100 - s.length * 0.1;
        var i = s.indexOf(q); if (i >= 0) return 60 - i;
        var j = 0, g = 0;
        for (var k = 0; k < s.length; k++) { if (s[k] === q[j]) j++; else if (j) g++; }
        return j === q.length ? 20 - g * 0.2 : -1;
      };
      var L = REG.map(function (c) {
        var scores = [c.id, c.title].concat(c.keywords).map(sc);
        scores.push(c.description.toLowerCase().indexOf(q) !== -1 ? 25 : -1);
        return { n: c.title, d: c.description, i: c.icon, cat: c.category, run: c.onInsert, s: q ? Math.max.apply(null, scores) : 0 };
      });
      return q ? L.filter(function (x) { return x.s >= 0; }).sort(function (a, b) { return b.s - a.s; }) : L.sort(function (a, b) { return CATS.indexOf(a.cat) - CATS.indexOf(b.cat); });
    }

    /* ---------- interactive block hover toolbar (#leaf-blkBar) ---------- */
    var oldBar = document.getElementById('leaf-blkBar');
    if (oldBar) oldBar.remove();
    var bar = document.createElement('div');
    bar.id = 'leaf-blkBar';
    bar.className = 'lf-hidden';
    document.body.appendChild(bar);

    var barEl = null, barT = null, lastCell = null;
    var BLK = '.blk,.callout,#lf-editor table';
    var T_ORDER = ['info', 'note', 'warning', 'success', 'error'];
    var BPAL = ['#ffffff', '#e9f2ff', '#dcfff1', '#fff7d6', '#ffeceb', '#f3f0ff', '#fff0e6', '#e6fcff', '#f1f2f4', '#fce4f3', '#e6f7e6', '#ffe9a8'];
    var swatches = function (a, fn) {
      pop(a, '<div class="lf-swgrid">' + BPAL.map(function (c) { return '<button class="lf-sw" data-c="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>', function (p) {
        p.onclick = function (e) { var b = e.target.closest('[data-c]'); if (b) { fn(b.dataset.c); closePop(); changed(); } };
      });
    };
    var selTab = function (el, i) {
      $$('.xtab', el).forEach(function (t, k) { t.classList.toggle('on', k === i); });
      $$(':scope>.tpane', el).forEach(function (t, k) { t.classList.toggle('on', k === i); });
    };
    function barActs(el) {
      var a = [];
      if (el.matches('.callout.custom')) {
        a.push(['Color', 'palette', function (b) { swatches(b, function (c) { el.style.background = c; }); }]);
        a.push(['Emoji', 'smile', function (b) {
          pop(b, '<div class="lf-egrid">' + ['💡', '📌', '🚀', '⚠️', '✅', '❓', '🔥', '📣'].map(function (x) { return '<button data-e="' + x + '">' + x + '</button>'; }).join('') + '</div>', function (p) {
            p.onclick = function (e) { var x = e.target.closest('[data-e]'); if (x) { el.querySelector('.ci').textContent = x.dataset.e; closePop(); changed(); } };
          });
        }]);
      } else if (el.matches('.callout')) {
        a.push(['Type', 'repeat', function () {
          var c = T_ORDER.find(function (t) { return el.classList.contains(t); }) || 'info';
          el.classList.replace(c, T_ORDER[(T_ORDER.indexOf(c) + 1) % T_ORDER.length]);
          changed();
        }]);
      } else if (el.matches('table')) {
        a.push(['+Row ↑', 'arrow-up', function () { tableOp('addRowAbove', el); }]);
        a.push(['+Row ↓', 'arrow-down', function () { tableOp('addRowBelow', el); }]);
        a.push(['-Row', 'minus', function () { tableOp('delRow', el); }]);
        a.push(['+Col ←', 'arrow-left', function () { tableOp('addColLeft', el); }]);
        a.push(['+Col →', 'arrow-right', function () { tableOp('addColRight', el); }]);
        a.push(['-Col', 'columns-2', function () { tableOp('delCol', el); }]);
        a.push(['Header', 'table-properties', function () { tableOp('toggleHeader', el); }]);
        a.push(['Merge →', 'merge', function () { tableOp('mergeRight', el); }]);
        a.push(['Split', 'split', function () { tableOp('splitCell', el); }]);
        a.push(['Color', 'paint-bucket', function (b) { swatches(b, function (c) { var cell = activeTableCell(el); if (cell) cell.style.background = c; }); }]);
      } else if (el.matches('.tabs')) {
        a.push(['Add tab', 'plus', function () {
          var n = $$('.xtab', el).length;
          el.querySelector('.tabbar').insertAdjacentHTML('beforeend', '<span class="xtab" contenteditable="true">Tab ' + (n + 1) + '</span>');
          el.insertAdjacentHTML('beforeend', '<div class="tpane" contenteditable="true"><p>Tab ' + (n + 1) + ' content</p></div>');
          selTab(el, n); changed();
        }]);
      } else if (el.matches('.xcards')) {
        a.push(['Add card', 'plus', function () { el.insertAdjacentHTML('beforeend', '<div class="gcard" contenteditable="true"><p><b>Card title</b></p><p>Card text</p></div>'); changed(); }]);
      } else if (el.matches('.acc')) {
        a.push(['Expand / collapse', 'chevrons-up-down', function () { el.classList.toggle('open'); changed(); }]);
      }
      a.push(['Delete', 'trash-2', function () { el.remove(); hideBar(); changed(); }, 'del']);
      return a;
    }
    function showBar(el) {
      barEl = el;
      var acts = barActs(el);
      bar.innerHTML = acts.map(function (x, i) { return '<button class="' + (x[3] || '') + '" data-i="' + i + '" title="' + x[0] + '">' + ic(x[1]) + '<span>' + x[0] + '</span></button>'; }).join('');
      bar.onmousedown = function (e) { e.preventDefault(); };
      bar.onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) acts[+b.dataset.i][2](b); };
      bar.classList.remove('lf-hidden');
      icons();
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { hideBar(); return; }
      bar.style.top = Math.max(r.top + 4, 8) + 'px';
      bar.style.left = Math.max(8, r.right - bar.offsetWidth - 6) + 'px';
    }
    function hideBar() { barEl = null; bar.classList.add('lf-hidden'); }
    var hideSoon = function () { clearTimeout(barT); barT = setTimeout(hideBar, 350); };
    ed.addEventListener('mouseover', function (e) {
      var el = e.target.closest(BLK);
      if (el && ed.contains(el)) { clearTimeout(barT); if (el !== barEl) showBar(el); } else hideSoon();
    });
    ed.addEventListener('mouseleave', hideSoon);
    bar.addEventListener('mouseenter', function () { clearTimeout(barT); });
    bar.addEventListener('mouseleave', hideSoon);
    scroller.addEventListener('scroll', hideBar);

    /* ---------- image selection, drag-to-resize & floating toolbar (#leaf-imgBar) ---------- */
    var oldImgBar = document.getElementById('leaf-imgBar');
    if (oldImgBar) oldImgBar.remove();
    var imgBar = document.createElement('div');
    imgBar.id = 'leaf-imgBar';
    imgBar.className = 'lf-hidden';
    document.body.appendChild(imgBar);

    var selectedImgFig = null;
    var selectedRichBlk = null;
    var SELECTABLE_BLKS = 'figure.lf-img-block, pre.code, blockquote, hr, .callout, .cols, .acc, .tabs, .xcards, .pbreak';

    function clearBlockSelections() {
      if (selectedImgFig) {
        selectedImgFig.classList.remove('is-selected');
        selectedImgFig = null;
      }
      if (selectedRichBlk) {
        selectedRichBlk.classList.remove('lf-blk-selected');
        selectedRichBlk = null;
      }
      $$('.lf-cell-active', ed).forEach(function (c) { c.classList.remove('lf-cell-active'); });
      imgBar.classList.add('lf-hidden');
    }

    function positionImgBar() {
      if (!selectedImgFig || !ed.contains(selectedImgFig)) {
        imgBar.classList.add('lf-hidden');
        return;
      }
      var r = selectedImgFig.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        imgBar.classList.add('lf-hidden');
        return;
      }
      imgBar.classList.remove('lf-hidden');
      var bw = imgBar.offsetWidth || 360;
      var left = Math.max(8, Math.min(r.left + (r.width - bw) / 2, window.innerWidth - bw - 8));
      var top = r.top - 42;
      if (top < 8) top = Math.min(window.innerHeight - 44, r.bottom + 8);
      imgBar.style.left = left + 'px';
      imgBar.style.top = top + 'px';
    }

    function renderImgBar() {
      if (!selectedImgFig) return;
      var align = selectedImgFig.getAttribute('data-align') || 'center';
      var curW = selectedImgFig.style.width || '100%';
      imgBar.innerHTML =
        '<button type="button" data-ia="left" class="' + (align === 'left' ? 'on' : '') + '" title="Align left">' + ic('align-left') + '</button>' +
        '<button type="button" data-ia="center" class="' + (align === 'center' ? 'on' : '') + '" title="Align center">' + ic('align-center') + '</button>' +
        '<button type="button" data-ia="right" class="' + (align === 'right' ? 'on' : '') + '" title="Align right">' + ic('align-right') + '</button>' +
        '<button type="button" data-ia="wrap-left" class="' + (align === 'wrap-left' ? 'on' : '') + '" title="Wrap text right">Wrap L</button>' +
        '<button type="button" data-ia="wrap-right" class="' + (align === 'wrap-right' ? 'on' : '') + '" title="Wrap text left">Wrap R</button>' +
        '<span class="lf-ibar-sep"></span>' +
        '<button type="button" data-iw="25%" class="' + (curW === '25%' ? 'on' : '') + '">25%</button>' +
        '<button type="button" data-iw="50%" class="' + (curW === '50%' ? 'on' : '') + '">50%</button>' +
        '<button type="button" data-iw="100%" class="' + (curW === '100%' ? 'on' : '') + '">100%</button>' +
        '<button type="button" data-iw="reset" title="Reset original size">Reset</button>' +
        '<span class="lf-ibar-sep"></span>' +
        '<button type="button" data-iact="alt" title="Edit alt text">Alt</button>' +
        '<button type="button" data-iact="cap" title="Edit caption">Caption</button>' +
        '<button type="button" data-iact="del" class="del" title="Delete image">' + ic('trash-2') + '</button>';
      icons();
      positionImgBar();
    }

    function selectImageFig(fig) {
      clearBlockSelections();
      selectedImgFig = fig;
      selectedRichBlk = fig;
      fig.classList.add('is-selected');
      renderImgBar();
    }

    imgBar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    imgBar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !selectedImgFig) return;
      var img = selectedImgFig.querySelector('img');
      if (btn.dataset.ia) {
        selectedImgFig.setAttribute('data-align', btn.dataset.ia);
        if ((btn.dataset.ia === 'wrap-left' || btn.dataset.ia === 'wrap-right') && (!selectedImgFig.style.width || selectedImgFig.style.width === '100%')) {
          selectedImgFig.style.width = '45%';
        }
        renderImgBar();
        changed();
      } else if (btn.dataset.iw) {
        if (btn.dataset.iw === 'reset') {
          selectedImgFig.style.width = img && img.naturalWidth ? Math.min(img.naturalWidth, ed.clientWidth) + 'px' : 'auto';
          if (img) img.style.height = 'auto';
        } else {
          selectedImgFig.style.width = btn.dataset.iw;
          if (img) img.style.height = 'auto';
        }
        renderImgBar();
        changed();
      } else if (btn.dataset.iact === 'alt' && img) {
        modal('Image alt text', '<label class="lf-lbl">Alternative text (for accessibility)</label><input class="lf-inp" id="lf-altIn" value="' + esc(img.alt || '') + '" placeholder="Describe this image">', {
          footer: '<button class="lf-btn lf-btn-g" data-c>Cancel</button><button class="lf-btn lf-btn-p" data-ok>Save</button>',
          w: 420,
          mount: function (o, close) {
            setTimeout(function () { o.querySelector('#lf-altIn').focus(); }, 20);
            o.querySelector('[data-c]').onclick = close;
            o.querySelector('[data-ok]').onclick = function () {
              img.alt = o.querySelector('#lf-altIn').value.trim();
              close(); changed(); toast('Alt text updated');
            };
          }
        });
      } else if (btn.dataset.iact === 'cap') {
        var cap = selectedImgFig.querySelector('figcaption.lf-img-cap');
        if (cap) { cap.focus(); }
      } else if (btn.dataset.iact === 'del') {
        var fig = selectedImgFig;
        clearBlockSelections();
        fig.remove();
        changed();
      }
    });

    scroller.addEventListener('scroll', positionImgBar);
    window.addEventListener('resize', positionImgBar);

    /* Drag-to-resize on image handles (preserves aspect ratio; Shift = free resize) */
    ed.addEventListener('mousedown', function (e) {
      var handle = e.target.closest('.lf-img-h');
      if (!handle) return;
      var fig = handle.closest('figure.lf-img-block');
      var img = fig && fig.querySelector('img');
      if (!fig || !img) return;
      e.preventDefault();
      e.stopPropagation();
      selectImageFig(fig);

      var dir = handle.dataset.h;
      var startX = e.clientX, startY = e.clientY;
      var rect = img.getBoundingClientRect();
      var startW = rect.width, startH = rect.height;
      var maxW = ed.clientWidth || 760;

      var dim = document.createElement('span');
      dim.className = 'lf-img-dim';
      dim.textContent = Math.round(startW) + ' × ' + Math.round(startH);
      fig.querySelector('.lf-img-frame').appendChild(dim);

      var onMove = function (mv) {
        var dx = mv.clientX - startX;
        var dy = mv.clientY - startY;
        var signX = (dir === 'nw' || dir === 'sw' || dir === 'w') ? -1 : 1;
        var newW = Math.max(60, Math.min(maxW, startW + dx * signX));
        fig.style.width = Math.round(newW) + 'px';
        if (mv.shiftKey && (dir === 'nw' || dir === 'ne' || dir === 'sw' || dir === 'se')) {
          var signY = (dir === 'nw' || dir === 'ne') ? -1 : 1;
          var newH = Math.max(40, startH + dy * signY);
          img.style.height = Math.round(newH) + 'px';
          dim.textContent = Math.round(newW) + ' × ' + Math.round(newH) + ' (free)';
        } else {
          img.style.height = 'auto';
          var pct = Math.round((newW / maxW) * 100);
          dim.textContent = Math.round(newW) + 'px (' + pct + '%)';
        }
        positionImgBar();
      };
      var onUp = function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (dim.parentNode) dim.remove();
        renderImgBar();
        changed();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    /* ---------- Table Column Border Resizing ---------- */
    ed.addEventListener('mousemove', function (e) {
      if (ed.classList.contains('lf-col-resizing')) return;
      var cell = e.target.closest('td,th');
      if (!cell || !ed.contains(cell)) { ed.style.cursor = ''; return; }
      var r = cell.getBoundingClientRect();
      ed.style.cursor = (r.right - e.clientX <= 6 && r.right - e.clientX >= -2) ? 'col-resize' : '';
    });

    ed.addEventListener('mousedown', function (e) {
      var cell = e.target.closest('td,th');
      if (!cell || !ed.contains(cell)) return;
      var r = cell.getBoundingClientRect();
      if (r.right - e.clientX > 6 || r.right - e.clientX < -2) return;
      e.preventDefault();
      var tbl = cell.closest('table');
      var ci = cell.cellIndex;
      var startX = e.clientX;
      var startW = r.width;
      ed.classList.add('lf-col-resizing');

      var onMove = function (mv) {
        var newW = Math.max(44, Math.round(startW + (mv.clientX - startX)));
        $$('tr', tbl).forEach(function (row) {
          if (row.cells[ci]) row.cells[ci].style.width = newW + 'px';
        });
      };
      var onUp = function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        ed.classList.remove('lf-col-resizing');
        ed.style.cursor = '';
        changed();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    /* ---------- Sanitized HTML Paste + Image Paste & Drag-Drop ---------- */
    var ALLOWED_TAGS = new Set(['P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'IMG', 'HR', 'FIGURE', 'FIGCAPTION', 'SPAN', 'DIV']);

    function sanitizePastedHtml(rawHtml) {
      var doc = new DOMParser().parseFromString(rawHtml, 'text/html');
      $$('script,style,meta,link,iframe,object,embed,noscript,xml,o\\:p', doc.body).forEach(function (n) { n.remove(); });
      var cleanNode = function (node) {
        if (node.nodeType === 3) return document.createTextNode(node.textContent);
        if (node.nodeType !== 1) return document.createDocumentFragment();
        var tag = node.tagName.toUpperCase();
        if (tag === 'IMG') {
          var src = node.getAttribute('src') || '';
          if (!src || /^javascript:/i.test(src)) return document.createDocumentFragment();
          var wrap = document.createElement('div');
          wrap.innerHTML = buildImgFigureHtml(src, node.getAttribute('alt') || '');
          return wrap.firstChild;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          var frag = document.createDocumentFragment();
          Array.prototype.slice.call(node.childNodes).forEach(function (ch) { frag.appendChild(cleanNode(ch)); });
          return frag;
        }
        var out = document.createElement(tag === 'DIV' ? 'p' : tag.toLowerCase());
        if (tag === 'A') {
          var href = node.getAttribute('href') || '';
          if (/^(https?:|mailto:|#)/i.test(href)) {
            out.setAttribute('href', href);
            out.setAttribute('target', '_blank');
            out.setAttribute('rel', 'noopener');
          }
        }
        if (tag === 'TD' || tag === 'TH') {
          var cs = parseInt(node.getAttribute('colspan'), 10);
          var rs = parseInt(node.getAttribute('rowspan'), 10);
          if (cs > 1) out.setAttribute('colspan', String(cs));
          if (rs > 1) out.setAttribute('rowspan', String(rs));
        }
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) { out.appendChild(cleanNode(ch)); });
        if ((tag === 'TD' || tag === 'TH') && !out.innerHTML.trim()) out.innerHTML = '<br>';
        return out;
      };
      var container = document.createElement('div');
      Array.prototype.slice.call(doc.body.childNodes).forEach(function (ch) { container.appendChild(cleanNode(ch)); });
      return container.innerHTML;
    }

    ed.addEventListener('paste', function (e) {
      var dt = e.clipboardData;
      if (!dt) return;
      // 1. Intercept raw pasted image files (screenshots, copied images)
      var items = Array.prototype.slice.call(dt.items || []);
      var imgItem = items.find(function (it) { return it.kind === 'file' && it.type && it.type.indexOf('image/') === 0; });
      if (imgItem) {
        e.preventDefault();
        var file = imgItem.getAsFile();
        if (file) {
          toast('Uploading image...');
          uploadLeafImage(file).then(function (url) {
            insertImageFigure(url, file.name || 'Pasted image');
            toast('Image inserted');
          }, function () { toast('Failed to paste image'); });
        }
        return;
      }
      // 2. Intercept pasted raw image URL
      var plain = (dt.getData('text/plain') || '').trim();
      var html = dt.getData('text/html') || '';
      if (!html && /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(plain)) {
        e.preventDefault();
        insertImageFigure(plain, '');
        return;
      }
      // 3. Sanitize pasted HTML (Excel/Sheets tables, Word/Docs, web pages)
      if (html) {
        e.preventDefault();
        var cleaned = sanitizePastedHtml(html);
        document.execCommand('insertHTML', false, cleaned);
        changed();
      }
    });

    ed.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) {
        e.preventDefault();
        ed.classList.add('is-dragover');
      }
    });
    ed.addEventListener('dragleave', function () { ed.classList.remove('is-dragover'); });
    ed.addEventListener('drop', function (e) {
      ed.classList.remove('is-dragover');
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      var imgFiles = files.filter(function (f) { return f.type && f.type.indexOf('image/') === 0; });
      if (!imgFiles.length) return;
      e.preventDefault();
      toast('Uploading ' + imgFiles.length + (imgFiles.length > 1 ? ' images...' : ' image...'));
      imgFiles.forEach(function (f) {
        uploadLeafImage(f).then(function (url) {
          insertImageFigure(url, f.name);
        }, function () { toast('Could not upload ' + f.name); });
      });
    });

    function handleTmeta(m) {
      if (m.dataset.k === 'who') {
        pop(m, USERS.map(function (u) { return '<button class="lf-pi" data-n="' + esc(u.n) + '">' + esc(u.n) + '</button>'; }).join(''), function (p) {
          p.onclick = function (e) { var b = e.target.closest('[data-n]'); if (b) { m.textContent = '@ ' + b.dataset.n; closePop(); changed(); } };
        });
      } else {
        pop(m, '<input type="date" class="lf-inp" id="lf-tdp" style="width:170px">', function (p) {
          p.querySelector('#lf-tdp').onchange = function (ev) { if (ev.target.value) { m.textContent = 'Due ' + fmtDate(new Date(ev.target.value + 'T12:00:00')); closePop(); changed(); } };
        });
      }
    }

    /* ---------- slash & mention menu ---------- */
    var oldMenu = document.getElementById('leaf-slashMenu');
    if (oldMenu) oldMenu.remove();
    var menuEl = document.createElement('div');
    menuEl.id = 'leaf-slashMenu';
    menuEl.className = 'lf-hidden';
    document.body.appendChild(menuEl);

    var menu = { open: false, items: [], idx: 0, mode: '', len: 0, q: '' };
    function hideMenu() { menu.open = false; menuEl.classList.add('lf-hidden'); }
    function detectMenu() {
      var s = getSelection();
      if (!s.rangeCount || !s.isCollapsed || !ed.contains(s.anchorNode)) { hideMenu(); return; }
      var b = blockOf(s.anchorNode); if (!b || b.tagName === 'PRE') { hideMenu(); return; }
      var r = document.createRange(); r.setStart(b, 0); r.setEnd(s.anchorNode, s.anchorOffset);
      var t = r.toString(), m;
      if ((m = t.match(/^\/([\w \-]{0,20})$/))) openMenu('slash', m[1], b);
      else if ((m = t.match(/(?:^|\s)@(\w{0,20})$/))) openMenu('mention', m[1], b);
      else hideMenu();
    }
    function openMenu(mode, q, b) {
      var ql = q.toLowerCase().trim();
      var src = mode === 'slash'
        ? slashItems(ql)
        : USERS.filter(function (u) { return u.n.toLowerCase().indexOf(ql) !== -1; }).map(function (u) { return { n: u.n, d: 'Mention in this page', av: true, run: function () { insertMention(u.n); } }; });
      if (!src.length) { hideMenu(); return; }
      if (!(menu.open && menu.mode === mode)) menu.idx = 0;
      menu.open = true; menu.mode = mode; menu.items = src; menu.len = q.length + 1; menu.q = ql;
      if (menu.idx >= src.length) menu.idx = 0;
      drawMenu();
      var rc = getSelection().getRangeAt(0).getBoundingClientRect();
      if (!rc.height) rc = b.getBoundingClientRect();
      menuEl.classList.remove('lf-hidden');
      menuEl.style.left = Math.max(8, Math.min(rc.left, window.innerWidth - 340)) + 'px';
      var h = menuEl.offsetHeight;
      menuEl.style.top = (rc.bottom + h + 12 > window.innerHeight ? Math.max(8, rc.top - h - 6) : rc.bottom + 6) + 'px';
    }
    function drawMenu() {
      menuEl.innerHTML = menu.items.map(function (x, i) {
        var head = x.cat && !menu.q && (i === 0 || menu.items[i - 1].cat !== x.cat) ? '<div class="lf-mh2">' + esc(x.cat) + '</div>' : '';
        return head + '<div class="lf-mi ' + (i === menu.idx ? 'act' : '') + '" data-i="' + i + '"><span class="mic">' + (x.av ? avatar(x.n, 24) : ic(x.i)) + '</span><span><b>' + esc(x.n) + '</b><small>' + esc(x.d) + '</small></span></div>';
      }).join('');
      icons();
      var a = menuEl.querySelector('.act');
      if (a) a.scrollIntoView({ block: 'nearest' });
    }
    menuEl.addEventListener('mousedown', function (e) { e.preventDefault(); var i = e.target.closest('.lf-mi'); if (i) chooseItem(+i.dataset.i); });
    function chooseItem(i) {
      var it = menu.items[i], n = menu.len;
      hideMenu();
      var s = getSelection();
      for (var k = 0; k < n; k++) s.modify('extend', 'backward', 'character');
      document.execCommand('delete');
      it.run();
    }

    /* ---------- editor events ---------- */
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    ed.addEventListener('input', function () { fixFonts(); changed(); });
    ed.addEventListener('click', function (e) {
      var imgFig = e.target.closest('figure.lf-img-block');
      if (imgFig && !e.target.closest('figcaption')) {
        selectImageFig(imgFig);
        return;
      }
      var cell = e.target.closest('td,th');
      if (cell) {
        clearBlockSelections();
        lastCell = cell;
        cell.classList.add('lf-cell-active');
        var tbl = cell.closest('table');
        if (tbl) showBar(tbl);
      } else {
        clearBlockSelections();
        var blk = e.target.closest(SELECTABLE_BLKS);
        if (blk && ed.contains(blk) && !blk.matches('figure.lf-img-block')) {
          selectedRichBlk = blk;
          blk.classList.add('lf-blk-selected');
        }
      }
      if (e.target.classList.contains('cb')) { e.target.parentElement.classList.toggle('done'); changed(); return; }
      var ch = e.target.closest('.chev'); if (ch) { ch.closest('.acc').classList.toggle('open'); changed(); return; }
      var tb = e.target.closest('.xtab'); if (tb) { var t = tb.closest('.tabs'); selTab(t, $$('.xtab', t).indexOf(tb)); changed(); return; }
      var tm = e.target.closest('.tmeta'); if (tm) { handleTmeta(tm); return; }
      var m = e.target.closest('.cmark'); if (m) { showPanel('comments'); focusThread(m.dataset.id, false); }
    });
    ed.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.closest && e.target.closest('.xtab,.atitle')) { e.preventDefault(); return; }
      if (menu.open) {
        if (e.key === 'ArrowDown') { e.preventDefault(); menu.idx = (menu.idx + 1) % menu.items.length; drawMenu(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); menu.idx = (menu.idx - 1 + menu.items.length) % menu.items.length; drawMenu(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseItem(menu.idx); return; }
        if (e.key === 'Escape') { e.preventDefault(); hideMenu(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); toggleFind(true); return; }
      var li = closestEl('li');
      if (e.key === 'Enter' && li && li.parentElement.classList.contains('checklist')) {
        if (!li.textContent.trim()) {
          e.preventDefault();
          var ul = li.parentElement, p = document.createElement('p'); p.innerHTML = '<br>';
          ul.after(p); li.remove(); if (!ul.querySelector('li')) ul.remove();
          var r = document.createRange(); r.setStart(p, 0); r.collapse(true);
          getSelection().removeAllRanges(); getSelection().addRange(r); changed(); return;
        }
        setTimeout(function () { var n = blockOf(getSelection().anchorNode); if (n && n.tagName === 'LI') n.classList.remove('done'); changed(); }, 0);
      }
      if (e.key === 'Enter' && !e.shiftKey && closestEl('pre.code')) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
      if (e.key === 'Tab') {
        var cell = closestEl('td,th');
        if (cell) {
          e.preventDefault();
          var nx = cell.nextElementSibling || (cell.parentElement.nextElementSibling && cell.parentElement.nextElementSibling.cells[0]);
          if (!nx) { tableOp('addRow'); nx = cell.parentElement.nextElementSibling.cells[0]; }
          var r2 = document.createRange(); r2.selectNodeContents(nx); r2.collapse(true);
          getSelection().removeAllRanges(); getSelection().addRange(r2); return;
        }
        if (li) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); changed(); }
        else if (closestEl('pre.code')) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
      }
    });
    titleEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); subEl.focus(); } });
    subEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ed.focus(); } });
    titleEl.addEventListener('input', function () {
      var p = pages[cur]; p.title = titleEl.textContent.trim(); p.dirty = true;
      renderTree(); renderCrumbs(); document.title = (p.title || 'Untitled') + ' | Leaf | QuantalFlow'; touch();
    });
    subEl.addEventListener('input', function () { pages[cur].sub = subEl.textContent.trim(); touch(); });

    var saveT, outT;
    function normalize() {
      $$('ul.checklist li', ed).forEach(function (li) {
        if (!li.querySelector(':scope>.cb')) {
          var s = document.createElement('span'); s.className = 'cb'; s.contentEditable = 'false'; li.prepend(s);
          var sel = getSelection();
          if (sel.rangeCount && sel.anchorNode === li && sel.isCollapsed) {
            var r = document.createRange(); r.setStart(li, 1); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
          }
        }
      });
      $$('.cb', ed).forEach(function (c) { if (!c.parentElement.matches('ul.checklist>li')) c.remove(); });
      $$('ol.multi ol', ed).forEach(function (o) { o.classList.add('multi'); });
      $$('a[href]', ed).forEach(function (a) { if (!a.target) { a.target = '_blank'; a.rel = 'noopener'; a.title = 'Ctrl+click to open'; } });
      $$('img', ed).forEach(function (img) {
        if (!img.closest('figure.lf-img-block')) {
          var tmp = document.createElement('div');
          tmp.innerHTML = buildImgFigureHtml(img.getAttribute('src') || '', img.getAttribute('alt') || '');
          img.replaceWith(tmp.firstChild);
        }
      });
    }
    function cleanHTML() {
      var c = ed.cloneNode(true);
      $$('mark.fh', c).forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); });
      $$('.lf-img-dim', c).forEach(function (d) { d.remove(); });
      $$('.is-selected,.lf-blk-selected,.lf-cell-active', c).forEach(function (el) {
        el.classList.remove('is-selected', 'lf-blk-selected', 'lf-cell-active');
      });
      return c.innerHTML;
    }
    function touch() {
      var p = pages[cur]; p.updated = new Date(); p.dirty = true;
      var saveEl = $('#lf-saveState');
      if (saveEl) saveEl.textContent = 'Saving...';
      clearTimeout(saveT);
      saveT = setTimeout(function () { if (saveEl) saveEl.textContent = 'Saved'; p.html = cleanHTML(); persistStore(); }, 600);
      $('#lf-updated').textContent = 'Last updated ' + rel(p.updated);
    }
    function changed() {
      normalize(); touch();
      clearTimeout(outT);
      outT = setTimeout(function () { buildOutline(); readTime(); }, 250);
    }
    function readTime() {
      var w = (ed.innerText || '').trim().split(/\s+/).filter(Boolean).length;
      $('#lf-readtime').innerHTML = ic('clock') + Math.max(1, Math.ceil(w / 200)) + ' min read';
      icons();
    }

    /* ---------- find & replace ---------- */
    var fh = [], fi = -1;
    function clearFind() {
      if (!$('mark.fh', ed)) { fh = []; fi = -1; return; }
      $$('mark.fh', ed).forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); });
      ed.normalize(); fh = []; fi = -1;
    }
    var reOf = function () { return new RegExp($('#lf-fq').value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('#lf-fcase').checked ? 'g' : 'gi'); };
    function textNodes() {
      var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT), a = [], n;
      while ((n = w.nextNode())) a.push(n);
      return a;
    }
    function doFind(keep) {
      clearFind();
      var q = $('#lf-fq').value;
      if (!q) { $('#lf-fcount').textContent = ''; return; }
      var re = reOf();
      textNodes().forEach(function (n) {
        var t = n.nodeValue, ms = Array.from(t.matchAll(re));
        if (!ms.length) return;
        var f = document.createDocumentFragment(), last = 0;
        ms.forEach(function (m) {
          f.append(t.slice(last, m.index));
          var k = document.createElement('mark'); k.className = 'fh'; k.textContent = m[0]; f.append(k);
          last = m.index + m[0].length;
        });
        f.append(t.slice(last));
        n.replaceWith(f);
      });
      fh = $$('mark.fh', ed);
      if (fh.length) gotoFind(Math.min(keep || 0, fh.length - 1));
      else $('#lf-fcount').textContent = 'No results';
    }
    function gotoFind(i) {
      if (!fh.length) return;
      fh.forEach(function (m) { m.classList.remove('cur'); });
      fi = (i + fh.length) % fh.length;
      fh[fi].classList.add('cur');
      fh[fi].scrollIntoView({ block: 'center', behavior: 'smooth' });
      $('#lf-fcount').textContent = (fi + 1) + ' of ' + fh.length;
    }
    function toggleFind(show) {
      var f = $('#lf-findbar');
      var on = show === undefined ? f.classList.contains('lf-hidden') : show;
      f.classList.toggle('lf-hidden', !on);
      $('#lf-btnFind').classList.toggle('on', on);
      if (on) {
        $('#lf-fq').focus(); $('#lf-fq').select();
        var s = savedRange && savedRange.toString();
        if (s && s.length < 60 && s.indexOf('\n') === -1) { $('#lf-fq').value = s; doFind(); }
      } else { clearFind(); $('#lf-fcount').textContent = ''; }
    }
    $('#lf-btnFind').onclick = function () { toggleFind(); };
    $('#lf-fClose').onclick = function () { toggleFind(false); };
    $('#lf-fq').oninput = function () { doFind(); };
    $('#lf-fcase').onchange = function () { doFind(); };
    $('#lf-fNext').onclick = function () { gotoFind(fi + 1); };
    $('#lf-fPrev').onclick = function () { gotoFind(fi - 1); };
    $('#lf-fq').onkeydown = function (e) { if (e.key === 'Enter') gotoFind(e.shiftKey ? fi - 1 : fi + 1); if (e.key === 'Escape') toggleFind(false); };
    $('#lf-fRep').onclick = function () { if (fi < 0 || !fh[fi]) return; var k = fi; fh[fi].replaceWith(document.createTextNode($('#lf-fr').value)); ed.normalize(); changed(); doFind(k); };
    $('#lf-fRepAll').onclick = function () {
      if (!$('#lf-fq').value) return;
      clearFind();
      var re = reOf(), n = 0, rep = $('#lf-fr').value;
      textNodes().forEach(function (t) { var v = t.nodeValue.replace(re, function () { n++; return rep; }); if (v !== t.nodeValue) t.nodeValue = v; });
      changed(); $('#lf-fcount').textContent = '';
      toast(n ? ('Replaced ' + n + ' occurrence' + (n > 1 ? 's' : '')) : 'No matches found');
    };

    /* ---------- outline ---------- */
    function buildOutline() {
      var hs = $$('h1,h2,h3', ed);
      $('#lf-outline').innerHTML = hs.length
        ? hs.map(function (h, i) {
            return '<button class="lf-olitem" data-i="' + i + '" style="padding-left:' + (8 + (+h.tagName[1] - 1) * 14) + 'px;' + (h.tagName === 'H1' ? 'font-weight:600;color:#172b4d' : '') + '">' + esc(h.textContent.trim() || 'Untitled heading') + '</button>';
          }).join('')
        : '<p style="color:#626f86;line-height:1.5;font-size:13px">Add headings (Heading 1 to Heading 3) and they appear here as an outline.</p>';
      markOutline();
    }
    $('#lf-outline').addEventListener('click', function (e) {
      var b = e.target.closest('.lf-olitem');
      if (b) { var hs = $$('h1,h2,h3', ed); if (hs[+b.dataset.i]) hs[+b.dataset.i].scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    function markOutline() {
      var hs = $$('h1,h2,h3', ed), top = scroller.getBoundingClientRect().top + 90, a = -1;
      hs.forEach(function (h, i) { if (h.getBoundingClientRect().top <= top) a = i; });
      $$('.lf-olitem').forEach(function (o, i) { o.classList.toggle('on', i === a); });
    }
    scroller.addEventListener('scroll', markOutline);

    /* ---------- right panel & comments ---------- */
    function showPanel(tab) {
      $('#lf-rpanel').classList.remove('lf-hidden');
      $('#lf-btnPanel').classList.add('on');
      $$('.lf-rtab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab); });
      $('#lf-tabOutline').classList.toggle('lf-hidden', tab !== 'outline');
      $('#lf-tabComments').classList.toggle('lf-hidden', tab !== 'comments');
    }
    $$('.lf-rtab').forEach(function (t) { t.onclick = function () { showPanel(t.dataset.tab); }; });
    $('#lf-btnPanel').onclick = function () { var r = $('#lf-rpanel'); r.classList.toggle('lf-hidden'); $('#lf-btnPanel').classList.toggle('on', !r.classList.contains('lf-hidden')); };
    $('#lf-btnPanelClose').onclick = function () { $('#lf-rpanel').classList.add('lf-hidden'); $('#lf-btnPanel').classList.remove('on'); };

    var cFilter = 'open', activeThread = null, pending = null;
    $$('.lf-cf').forEach(function (b) {
      b.onclick = function () {
        cFilter = b.dataset.f;
        $$('.lf-cf').forEach(function (x) { x.classList.toggle('on', x === b); x.style.background = x === b ? '#e9f2ff' : ''; });
        renderThreads();
      };
    });
    var initCf = $('.lf-cf.on');
    if (initCf) initCf.style.background = '#e9f2ff';

    var oldCBtn = document.getElementById('leaf-cBtn');
    if (oldCBtn) oldCBtn.remove();
    var cBtn = document.createElement('button');
    cBtn.id = 'leaf-cBtn';
    cBtn.className = 'lf-hidden';
    cBtn.innerHTML = ic('message-square-plus') + 'Comment';
    document.body.appendChild(cBtn);

    function selButton() {
      var s = getSelection();
      if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode) || !s.toString().trim()) { cBtn.classList.add('lf-hidden'); return; }
      var rc = s.getRangeAt(0).getBoundingClientRect();
      cBtn.classList.remove('lf-hidden');
      cBtn.style.left = Math.max(8, Math.min(rc.right + 6, window.innerWidth - 120)) + 'px';
      cBtn.style.top = (rc.top - 40 < 60 ? rc.bottom + 8 : rc.top - 40) + 'px';
    }
    cBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    cBtn.onclick = function () {
      if (!savedRange) return;
      var r = savedRange.cloneRange();
      if (blockOf(r.startContainer) !== blockOf(r.endContainer)) { toast('Select text within a single paragraph to comment'); return; }
      pending = { range: r, quote: r.toString() };
      cBtn.classList.add('lf-hidden');
      showPanel('comments'); renderThreads();
      setTimeout(function () { $('#lf-composerText').focus(); }, 30);
    };
    $('#lf-composerNo').onclick = function () { pending = null; renderThreads(); };
    $('#lf-composerOk').onclick = function () {
      var t = $('#lf-composerText').value.trim(); if (!t || !pending) return;
      var id = 'c' + (++cid), sp = document.createElement('span'); sp.className = 'cmark'; sp.dataset.id = id;
      try { pending.range.surroundContents(sp); } catch (e) { sp.appendChild(pending.range.extractContents()); pending.range.insertNode(sp); }
      pages[cur].threads.unshift({ id: id, quote: pending.quote, resolved: false, msgs: [{ by: ME.n, text: t, t: Date.now() }] });
      pending = null; $('#lf-composerText').value = ''; changed(); renderThreads(); toast('Comment added');
    };
    function renderThreads() {
      var p = pages[cur], open = p.threads.filter(function (t) { return !t.resolved; }).length;
      $('#lf-cCount').textContent = open || '';
      $('#lf-composer').classList.toggle('lf-hidden', !pending);
      if (pending) $('#lf-composerQuote').textContent = pending.quote;
      var list = p.threads.filter(function (t) { return cFilter === 'open' ? !t.resolved : t.resolved; });
      $('#lf-threads').innerHTML = list.length ? list.map(function (t) {
        return '<div class="lf-th ' + (t.id === activeThread ? 'active' : '') + '" data-id="' + t.id + '"><div class="q">' + esc(t.quote) + '</div>' +
          t.msgs.map(function (m) { return '<div class="lf-msg">' + avatar(m.by, 26) + '<div><b>' + esc(m.by) + '</b><span class="t">' + rel(new Date(m.t)) + '</span><p>' + esc(m.text) + '</p></div></div>'; }).join('') +
          '<input class="lf-inp rin" placeholder="Reply" style="margin-top:6px;height:30px">' +
          '<div style="display:flex;gap:4px;margin-top:8px"><button class="lf-lk" data-a="res">' + ic(t.resolved ? 'rotate-ccw' : 'check') + (t.resolved ? 'Reopen' : 'Resolve') + '</button><button class="lf-lk" data-a="del">' + ic('trash-2') + 'Delete</button></div></div>';
      }).join('') : '<p style="color:#626f86;line-height:1.5;padding:6px 2px;font-size:13px">' + (cFilter === 'open' ? 'No open comments. Select text in the page and choose Comment to start a thread.' : 'No resolved comments.') + '</p>';
      icons();
    }
    function setMarks() {
      var p = pages[cur];
      $$('.cmark', ed).forEach(function (m) {
        var t = p.threads.find(function (x) { return x.id === m.dataset.id; });
        m.classList.toggle('resolved', Boolean(t && t.resolved));
        m.classList.toggle('active', m.dataset.id === activeThread);
      });
    }
    function focusThread(id, scroll) {
      if (scroll === undefined) scroll = true;
      activeThread = id;
      var t = pages[cur].threads.find(function (x) { return x.id === id; });
      if (t && t.resolved && cFilter !== 'resolved') {
        cFilter = 'resolved';
        $$('.lf-cf').forEach(function (x) { x.classList.toggle('on', x.dataset.f === cFilter); x.style.background = x.dataset.f === cFilter ? '#e9f2ff' : ''; });
      }
      renderThreads(); setMarks();
      var m = ed.querySelector('.cmark[data-id="' + id + '"]'); if (scroll && m) m.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var c = root.querySelector('.lf-th[data-id="' + id + '"]'); if (c) c.scrollIntoView({ block: 'nearest' });
    }
    $('#lf-threads').addEventListener('click', function (e) {
      var c = e.target.closest('.lf-th'); if (!c) return;
      var t = pages[cur].threads.find(function (x) { return x.id === c.dataset.id; });
      var a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'res') { t.resolved = !t.resolved; activeThread = null; changed(); renderThreads(); setMarks(); return; }
      if (a && a.dataset.a === 'del') {
        var m = ed.querySelector('.cmark[data-id="' + t.id + '"]');
        if (m) m.replaceWith.apply(m, Array.prototype.slice.call(m.childNodes));
        pages[cur].threads = pages[cur].threads.filter(function (x) { return x !== t; });
        changed(); renderThreads(); return;
      }
      if (!e.target.closest('input') && activeThread !== c.dataset.id) focusThread(c.dataset.id);
    });
    $('#lf-threads').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList.contains('rin') && e.target.value.trim()) {
        var c = e.target.closest('.lf-th');
        var t = pages[cur].threads.find(function (x) { return x.id === c.dataset.id; });
        t.msgs.push({ by: ME.n, text: e.target.value.trim(), t: Date.now() });
        persistStore(); renderThreads();
      }
    });

    /* page comments */
    function renderPC() {
      var p = pages[cur];
      $('#lf-pcCount').textContent = p.pc.length ? '(' + p.pc.length + ')' : '';
      $('#lf-pcList').innerHTML = p.pc.map(function (c, i) {
        return '<div class="lf-msg" style="margin:12px 0">' + avatar(c.by, 32) + '<div><b>' + esc(c.by) + '</b><span class="t">' + rel(new Date(c.t)) + '</span><p style="font-size:14px">' + esc(c.text) + '</p>' + (c.by === ME.n ? '<button class="lf-lk" data-d="' + i + '" style="margin-left:-6px">Delete</button>' : '') + '</div></div>';
      }).join('') || '<p style="color:#626f86;margin:8px 0">No comments yet. Start the discussion below.</p>';
    }
    $('#lf-pcSend').onclick = function () { var v = $('#lf-pcInput').value.trim(); if (!v) return; pages[cur].pc.push({ by: ME.n, text: v, t: Date.now() }); $('#lf-pcInput').value = ''; persistStore(); renderPC(); };
    $('#lf-pcList').onclick = function (e) { var d = e.target.closest('[data-d]'); if (d) { pages[cur].pc.splice(+d.dataset.d, 1); persistStore(); renderPC(); } };

    /* ---------- tree ---------- */
    function renderTree() {
      var q = $('#lf-treeFilter').value.trim().toLowerCase(), vis = null;
      if (q) {
        vis = new Set();
        var walk = function (id) {
          var p = pages[id];
          var m = (p.title || 'untitled').toLowerCase().indexOf(q) !== -1;
          p.children.forEach(function (c) { if (walk(c)) m = true; });
          if (m) vis.add(id);
          return m;
        };
        rootsOf().forEach(walk);
      }
      var node = function (id, d) {
        if (vis && !vis.has(id)) return '';
        var p = pages[id], has = p.children.length, open = vis ? true : p.expanded;
        return '<div><div class="lf-trow ' + (id === cur && view === 'page' ? 'sel' : '') + '" data-id="' + id + '" style="padding-left:' + (6 + d * 16) + 'px">' +
          '<button class="caret" data-a="tog">' + (has ? ic(open ? 'chevron-down' : 'chevron-right') : '') + '</button>' +
          '<span class="ti">' + p.icon + '</span><span class="tt">' + esc(p.title || 'Untitled') + '</span>' +
          '<button class="tadd" data-a="add" title="Add child page">' + ic('plus') + '</button>' +
          '<button class="tadd" data-a="del" title="Delete page">' + ic('trash-2') + '</button></div>' +
          (has && open ? p.children.map(function (c) { return node(c, d + 1); }).join('') : '') + '</div>';
      };
      var h = rootsOf().map(function (r) { return node(r, 0); }).join('');
      $('#lf-tree').innerHTML = h || '<p style="padding:12px 16px;color:#626f86;font-size:13px">No pages match your filter.</p>';
      icons();
    }
    $('#lf-tree').addEventListener('click', function (e) {
      var r = e.target.closest('.lf-trow'); if (!r) return;
      var id = r.dataset.id, a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'tog') { pages[id].expanded = !pages[id].expanded; persistStore(); renderTree(); return; }
      if (a && a.dataset.a === 'add') { addPage(id); return; }
      if (a && a.dataset.a === 'del') { deletePage(id); return; }
      selectPage(id);
    });
    $('#lf-treeFilter').oninput = renderTree;
    $('#lf-btnRootAdd').onclick = function () { addPage(null); };
    function addPage(parent) {
      var id = 'p' + (++uid);
      mk(id, '📄', '', { sp: curSpace, html: '<p><br></p>', pub: false, author: ME.n, ago: 0 });
      pages[id].updated = new Date();
      link(parent, id);
      if (parent) pages[parent].expanded = true;
      $('#lf-treeFilter').value = '';
      persistStore();
      selectPage(id);
      setTimeout(function () { titleEl.focus(); }, 30);
    }
    function saveCur() {
      var p = pages[cur]; if (!p || view !== 'page') return;
      clearFind(); p.html = cleanHTML(); p.title = titleEl.textContent.trim(); p.sub = subEl.textContent.trim();
      persistStore();
    }
    function selectPage(id) { if (view === 'page' && id === cur && ed.innerHTML) return; if (view === 'page') saveCur(); cur = id; load(); }
    function renderCrumbs() {
      if (view === 'home' || !pages[cur]) { $('#lf-crumbs').innerHTML = '<span class="lf-crumb-cur">Leaf Workspace</span>'; return; }
      var p = pages[cur], chain = [], x = p;
      while (x) { chain.unshift(x); x = x.parent ? pages[x.parent] : null; }
      var parts = [
        '<a data-home="1" title="Workspace home">Leaf</a>',
        '<a data-spacemenu="1" title="Switch space">' + esc(spaces[p.space].name) + '</a>'
      ];
      chain.forEach(function (c, i) {
        parts.push(i === chain.length - 1
          ? '<span class="lf-crumb-cur">' + esc(c.title || 'Untitled') + '</span>'
          : '<a data-go="' + c.id + '">' + esc(c.title || 'Untitled') + '</a>');
      });
      $('#lf-crumbs').innerHTML = parts.join('<span class="lf-crumb-sep">/</span>');
    }
    $('#lf-crumbs').addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]'); if (a) return selectPage(a.dataset.go);
      var h = e.target.closest('[data-home]'); if (h) return showHome();
      var s = e.target.closest('[data-spacemenu]'); if (s) spaceMenu(s);
    });
    function renderMeta() {
      var p = pages[cur];
      $('#lf-btnEmoji').textContent = p.icon;
      $('#lf-authorAv').innerHTML = avatar(p.author, 24);
      $('#lf-authorName').textContent = p.author;
      $('#lf-updated').textContent = 'Last updated ' + rel(p.updated);
      $('#lf-statusBadge').innerHTML = '<span class="lf-stb lf-s-' + p.status.replace(' ', '-') + '">' + (p.status === 'Verified' ? ic('badge-check') : '') + p.status + ic('chevron-down') + '</span>';
      $('#lf-btnStar').classList.toggle('on', p.star);
      $('#lf-btnWatch').innerHTML = ic(p.watch ? 'eye' : 'eye-off');
      $('#lf-btnWatch').classList.toggle('on', p.watch);
      $('#lf-btnWatch').title = p.watch ? 'Stop watching' : 'Watch this page';
      var pubBtn = $('#lf-btnPublish');
      if (pubBtn) pubBtn.textContent = p.published ? 'Update' : 'Publish';
      icons(); readTime();
    }
    function load() {
      hideHome();
      var p = pages[cur];
      curSpace = p.space;
      renderSpace();
      titleEl.textContent = p.title;
      subEl.textContent = p.sub;
      ed.innerHTML = p.html;
      pending = null; activeThread = null;
      $('#lf-fcount').textContent = '';
      document.title = (p.title || 'Untitled') + ' | Leaf | QuantalFlow';
      renderCrumbs(); renderTree(); renderMeta(); buildOutline(); renderThreads(); setMarks(); renderPC();
      scroller.scrollTop = 0;
      var saveEl = $('#lf-saveState');
      if (saveEl) saveEl.textContent = 'Saved';
      if ($('#lf-fq').value && !$('#lf-findbar').classList.contains('lf-hidden')) doFind();
    }
    $('#lf-btnSide').onclick = function () { $('#lf-sidebar').classList.toggle('lf-hidden'); };

    /* status & emoji */
    $('#lf-statusBadge').onclick = function (e) {
      pop(e.currentTarget, ['Draft', 'In review', 'Verified'].map(function (s) {
        return '<button class="lf-pi" data-s="' + s + '"><span class="lf-stb lf-s-' + s.replace(' ', '-') + '">' + s + '</span></button>';
      }).join(''), function (p) {
        p.onclick = function (ev) { var b = ev.target.closest('[data-s]'); if (b) { pages[cur].status = b.dataset.s; touch(); renderMeta(); closePop(); toast('Status changed to ' + b.dataset.s); } };
      });
    };
    var EMO = '📄 📝 📋 📚 🚀 🧭 📐 🔌 👥 🌴 🎓 🧪 📅 💡 🎯 🛠️ 🔒 📊 📈 🗂️ ⭐ ✅ ❓ 🔥 🌍 💬 📣 🧩 🏁 📌 🔍 🧠 💰 🛡️ ⚙️ 🎨 🧾 📦 🤝 🗓️'.split(' ');
    $('#lf-btnEmoji').onclick = function (e) {
      pop(e.currentTarget, '<div class="lf-egrid">' + EMO.map(function (x) { return '<button data-e="' + x + '">' + x + '</button>'; }).join('') + '</div><button class="lf-pi" data-e="📄">' + ic('rotate-ccw') + 'Reset icon</button>', function (p) {
        p.onclick = function (ev) { var b = ev.target.closest('[data-e]'); if (b) { pages[cur].icon = b.dataset.e; $('#lf-btnEmoji').textContent = b.dataset.e; renderTree(); touch(); closePop(); } };
      });
    };

    /* header actions */
    $('#lf-meAv').innerHTML = avatar(ME.n, 32);

    $('#lf-btnStar').onclick = function () { var p = pages[cur]; p.star = !p.star; $('#lf-btnStar').classList.toggle('on', p.star); persistStore(); toast(p.star ? 'Added to favorites' : 'Removed from favorites'); };
    $('#lf-btnWatch').onclick = function () { var p = pages[cur]; p.watch = !p.watch; persistStore(); renderMeta(); toast(p.watch ? 'You are now watching this page' : 'You stopped watching this page'); };

    /* more menu */
    $('#lf-btnMore').onclick = function (e) {
      pop(e.currentTarget, '<button class="lf-pi" data-m="copy">' + ic('link') + 'Copy link</button><button class="lf-pi" data-m="pdf">' + ic('file-down') + 'Export to PDF</button><button class="lf-pi" data-m="word">' + ic('file-text') + 'Export to Word</button><button class="lf-pi" data-m="hist">' + ic('history') + 'Page history</button><div style="height:1px;background:#ebecf0;margin:4px 0"></div><button class="lf-pi danger" data-m="del">' + ic('trash-2') + 'Delete page</button>', function (p) {
        p.onclick = function (ev) {
          var b = ev.target.closest('[data-m]'); if (!b) return;
          closePop();
          ({
            copy: function () {
              var u = location.href.split('#')[0] + '#' + cur;
              (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('Link copied'); }, function () { toast('Link: ' + u); });
            },
            pdf: exportPdf,
            word: exportWord,
            hist: openHistory,
            del: function () { deletePage(cur); }
          })[b.dataset.m]();
        };
      });
    };
    function exportPdf() { toggleFind(false); toast('Opening the print dialog. Choose Save as PDF.'); setTimeout(function () { try { window.print(); } catch (e) { toast('Printing is blocked in this preview'); } }, 400); }
    function exportWord() {
      saveCur();
      var p = pages[cur];
      var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(p.title) + '</title><style>body{font-family:Calibri,Arial;font-size:11pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style></head><body><h1>' + esc(p.title || 'Untitled') + '</h1><p><i>' + esc(p.sub) + '</i></p>' + p.html.replace(/<span class="cb"[^>]*><\/span>/g, '&#9744; ') + '</body></html>';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }));
      a.download = (p.title || 'Untitled').replace(/[^\w\- ]+/g, '') + '.doc';
      document.body.appendChild(a); a.click(); a.remove(); toast('Exported to Word');
    }
    function openHistory() {
      saveCur();
      var p = pages[cur], cur0 = { n: 'Current', t: p.updated, by: p.author, title: p.title, html: p.html };
      var vs = [cur0].concat(p.versions), sel = 0;
      modal('Page history', '<div style="display:flex;gap:16px;height:60vh"><div id="lf-hvL" style="width:230px;overflow:auto;flex:none"></div><div id="lf-hvP" style="flex:1;overflow:auto;border:1px solid #dcdfe4;border-radius:8px;padding:20px;line-height:1.6"></div></div>', {
        footer: '<button class="lf-btn lf-btn-g" data-c>Close</button><button class="lf-btn lf-btn-p" data-r>Restore this version</button>',
        w: 880,
        mount: function (o, close) {
          var draw = function () {
            o.querySelector('#lf-hvL').innerHTML = vs.map(function (v, i) {
              return '<button class="lf-pi" data-i="' + i + '" style="' + (i === sel ? 'background:#e9f2ff;' : '') + 'flex-direction:column;align-items:flex-start;gap:2px;margin-bottom:2px;display:flex;width:100%;padding:8px 10px;border-radius:6px;text-align:left"><b>' + (v.n === 'Current' ? 'Current version' : 'Version ' + v.n) + '</b><span style="color:#626f86;font-size:12px">' + esc(v.by) + ' &middot; ' + rel(new Date(v.t)) + '</span></button>';
            }).join('');
            o.querySelector('#lf-hvP').innerHTML = '<h2 style="font-size:1.4em;font-weight:700;margin-bottom:8px">' + esc(vs[sel].title || 'Untitled') + '</h2>' + vs[sel].html;
            o.querySelector('[data-r]').disabled = sel === 0;
            o.querySelector('[data-r]').style.opacity = sel === 0 ? '.4' : '1';
          };
          draw();
          o.querySelector('#lf-hvL').onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) { sel = +b.dataset.i; draw(); } };
          o.querySelector('[data-c]').onclick = close;
          o.querySelector('[data-r]').onclick = function () {
            if (!sel) return;
            var v = vs[sel]; ed.innerHTML = v.html; titleEl.textContent = v.title; p.title = v.title;
            changed(); renderCrumbs(); renderTree(); close(); toast('Restored version ' + v.n);
          };
        }
      });
    }
    function deletePage(id) {
      id = typeof id === 'string' ? id : cur;
      var p = pages[id]; if (!p) return;
      if (Object.keys(pages).length < 2) { toast('You cannot delete the last page'); return; }
      var count = function (n) { return 1 + pages[n].children.reduce(function (a, c) { return a + count(c); }, 0); };
      var n = count(id);
      var msg = '"' + (p.title || 'Untitled') + '" ' + (n > 1 ? ('and its ' + (n - 1) + ' child page' + (n > 2 ? 's' : '') + ' will') : 'will') + ' be permanently deleted. This cannot be undone.';
      var doDelete = function () {
        var gone = new Set();
        var rm = function (x) { pages[x].children.forEach(rm); gone.add(x); delete pages[x]; };
        var par = p.parent;
        var sibs = par ? pages[par].children : spaces[p.space].roots;
        sibs.splice(sibs.indexOf(id), 1);
        rm(id);
        if (gone.has(cur)) {
          cur = par || spaces[p.space].roots[0] || Object.keys(pages)[0];
          if (view === 'home') renderHome(); else load();
        } else {
          renderTree();
          if (view === 'home') renderHome();
        }
        persistStore();
        toast('Page deleted');
      };
      if (window.QFDialog) {
        window.QFDialog.confirm({ title: 'Delete this page?', message: msg, confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger' }).then(function (ok) { if (ok) doDelete(); });
      } else {
        modal('Delete this page?', '<p style="line-height:1.6">' + esc(msg) + '</p>', {
          footer: '<button class="lf-btn lf-btn-g" data-c>Cancel</button><button class="lf-btn lf-btn-d" data-ok>Delete</button>',
          w: 440,
          mount: function (o, close) { o.querySelector('[data-c]').onclick = close; o.querySelector('[data-ok]').onclick = function () { close(); doDelete(); }; }
        });
      }
    }

    /* ---------- spaces, home & search ---------- */
    var pageCount = function (sid) { return Object.values(pages).filter(function (p) { return p.space === sid; }).length; };
    var stClass = function (s) { return 'lf-s-' + s.replace(/\s/g, '-'); };
    function renderSpace() {
      var s = spaces[curSpace];
      $('#lf-spaceBtn').innerHTML = '<span>' + s.icon + '</span><span class="lf-space-name">' + esc(s.name) + '</span>' + ic('chevron-down');
      icons();
    }
    function spaceMenu(anchor) {
      var visSpaces = getVisibleSpaces();
      var footerHtml = isBoardScoped
        ? ''
        : '<div style="height:1px;background:#ebecf0;margin:4px 0"></div><button class="lf-pi" data-sp="__home">' + ic('layout-grid') + 'Browse all spaces</button><button class="lf-pi" data-sp="__new">' + ic('plus') + 'Create space</button>';
      pop(anchor, visSpaces.map(function (s) {
        return '<button class="lf-pi" data-sp="' + s.id + '"><span style="width:26px;height:26px;border-radius:6px;background:' + s.color + '22;display:flex;align-items:center;justify-content:center">' + s.icon + '</span><span style="flex:1"><b style="font-weight:600;display:block">' + esc(s.name) + '</b><small style="color:#626f86">' + pageCount(s.id) + ' pages</small></span>' + (s.id === curSpace && view === 'page' ? ic('check') : '') + '</button>';
      }).join('') + footerHtml, function (p) {
        p.style.minWidth = '270px';
        p.onclick = function (ev) {
          var b = ev.target.closest('[data-sp]'); if (!b) return;
          closePop();
          var v = b.dataset.sp;
          if (v === '__home') showHome(); else if (v === '__new') createSpace(); else openSpace(v);
        };
      });
    }
    function openSpace(id) {
      var s = spaces[id];
      if (!s.roots.length) {
        var pid = 'p' + (++uid);
        mk(pid, s.icon, s.name + ' Home', { sp: id, pub: false, author: ME.n, ago: 0, sub: s.desc, html: '<h1>' + esc(s.name) + ' Home</h1><p>' + esc(s.desc) + '</p>' });
        pages[pid].updated = new Date();
        link(null, pid);
        persistStore();
      }
      selectPage(s.roots[0]);
    }
    function createSpace() {
      modal('Create space', '<label class="lf-lbl">Space name</label><input class="lf-inp" id="lf-csN" placeholder="For example, Finance"><label class="lf-lbl">Icon</label><input class="lf-inp" id="lf-csI" value="📁" style="width:80px"><label class="lf-lbl">Description</label><textarea class="lf-inp" id="lf-csD" rows="2" placeholder="What is this space for?"></textarea>', {
        footer: '<button class="lf-btn lf-btn-g" data-c>Cancel</button><button class="lf-btn lf-btn-p" data-ok>Create</button>',
        w: 440,
        mount: function (o, close) {
          setTimeout(function () { o.querySelector('#lf-csN').focus(); }, 30);
          o.querySelector('[data-c]').onclick = close;
          var ok = function () {
            var n = o.querySelector('#lf-csN').value.trim(); if (!n) { o.querySelector('#lf-csN').focus(); return; }
            var id = 's' + (++uid), cols = ['#1868db', '#6e5dc6', '#1f845a', '#c25100', '#ae2e24', '#0b6e99'];
            spaces[id] = { id: id, name: n, icon: o.querySelector('#lf-csI').value.trim() || '📁', color: cols[Object.keys(spaces).length % cols.length], desc: o.querySelector('#lf-csD').value.trim(), roots: [] };
            persistStore(); close(); openSpace(id); toast('Space created');
          };
          o.querySelector('[data-ok]').onclick = ok;
          o.querySelector('#lf-csN').onkeydown = function (e) { if (e.key === 'Enter') ok(); };
        }
      });
    }

    var panelWas = true;
    function showHome(isInit) {
      if (!isInit && view === 'home') return;
      if (!isInit) saveCur();
      toggleFind(false); closePop(); view = 'home';
      panelWas = isInit ? true : !$('#lf-rpanel').classList.contains('lf-hidden');
      renderSpace();
      ['#lf-ribbon', '#lf-scroller', '#lf-rpanel', '#lf-pageActions'].forEach(function (s) { $(s).classList.add('lf-hidden'); });
      $('#lf-home').classList.remove('lf-hidden');
      renderTree(); renderCrumbs(); renderHome();
      document.title = 'Leaf Workspace | QuantalFlow';
    }
    function hideHome() {
      if (view !== 'home') return;
      view = 'page';
      $('#lf-home').classList.add('lf-hidden');
      ['#lf-ribbon', '#lf-scroller', '#lf-pageActions'].forEach(function (s) { $(s).classList.remove('lf-hidden'); });
      if (panelWas) $('#lf-rpanel').classList.remove('lf-hidden');
    }
    function renderHome() {
      var all = getVisiblePages();
      var visSpaces = getVisibleSpaces();
      var recent = all.slice().sort(function (a, b) { return new Date(b.updated) - new Date(a.updated); }).slice(0, 8);
      var stars = all.filter(function (p) { return p.star; });
      var card = function (s) { return '<button class="lf-spc" data-space="' + s.id + '"><span class="spi" style="background:' + s.color + '1f">' + s.icon + '</span><b>' + esc(s.name) + '</b><span class="spd">' + esc(s.desc || '') + '</span><span class="spm">' + pageCount(s.id) + ' pages</span></button>'; };
      var row = function (p) { return '<button class="lf-hrow" data-page="' + p.id + '"><span class="ti">' + p.icon + '</span><span class="lf-hrt"><b>' + esc(p.title || 'Untitled') + '</b><small>' + esc(spaces[p.space].name) + ' &middot; ' + esc(p.author) + ' &middot; ' + rel(new Date(p.updated)) + '</small></span><span class="lf-stb ' + stClass(p.status) + '">' + p.status + '</span></button>'; };
      $('#lf-home').innerHTML = '<div class="lf-home-inner"><h1 style="font-size:26px;font-weight:700;margin:0">Leaf Workspace</h1><p style="color:#626f86;margin:4px 0 18px">Spaces, favorites, and recent collaborative docs across your workspace.</p>' +
        '<button id="lf-homeSearch" class="lf-hs">' + ic('search') + '<span>Search pages in all spaces</span><kbd>Ctrl Shift F</kbd></button>' +
        '<div class="lf-hh"><h2>Spaces</h2></div><div class="lf-spgrid">' + visSpaces.map(card).join('') + '<button class="lf-spc new" id="lf-newSpace">' + ic('plus') + '<b>Create space</b></button></div>' +
        '<div class="lf-hh"><h2>Starred</h2></div>' + (stars.length ? '<div class="lf-hlist">' + stars.map(row).join('') + '</div>' : '<p style="color:#626f86">No starred pages yet. Select the star in a page header to add one.</p>') +
        '<div class="lf-hh"><h2>Recently updated</h2></div><div class="lf-hlist">' + recent.map(row).join('') + '</div></div>';
      icons();
    }
    $('#lf-home').addEventListener('click', function (e) {
      var s = e.target.closest('[data-space]'); if (s) return openSpace(s.dataset.space);
      var pg = e.target.closest('[data-page]'); if (pg) return selectPage(pg.dataset.page);
      if (e.target.closest('#lf-homeSearch')) return openSearch();
      if (e.target.closest('#lf-newSpace')) createSpace();
    });

    var hl = function (t, ws) {
      if (!ws.length) return esc(t);
      var re = new RegExp('(' + ws.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
      return t.split(re).map(function (s, i) { return i % 2 ? '<mark class="sh">' + esc(s) + '</mark>' : esc(s); }).join('');
    };
    function pageText(p) { var d = document.createElement('div'); d.innerHTML = p.html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
    function openSearch(initialQ) {
      if (document.querySelector('.leaf-ovl')) return;
      closePop(); saveCur();
      var st = { f: 'all', i: 0, q: initialQ || '', res: [], ws: [] };
      var o = document.createElement('div');
      o.className = 'leaf-ovl';
      o.style.cssText = 'align-items:flex-start;padding-top:11vh';
      o.innerHTML = '<div class="lf-mdl" style="width:700px"><div class="lf-sbar">' + ic('search') + '<input id="lf-sin" placeholder="Search pages in every space" autocomplete="off" spellcheck="false" value="' + esc(st.q) + '"><button class="lf-ib" data-x>' + ic('x') + '</button></div><div class="lf-chips" id="lf-schips"></div><div class="lf-sres" id="lf-sres"></div><div class="lf-sfoot"><span>Up and Down to move</span><span>Enter to open</span><span>Esc to close</span></div></div>';
      document.body.appendChild(o);
      var close = function () { o.remove(); };
      o.addEventListener('mousedown', function (e) { if (e.target === o) close(); });
      o.querySelector('[data-x]').onclick = close;
      var draw = function () {
        var chipList = isBoardScoped
          ? getVisibleSpaces().map(function (s) { return [s.id, s.name, s.icon]; })
          : [['all', 'All spaces', '']].concat(getVisibleSpaces().map(function (s) { return [s.id, s.name, s.icon]; }));
        o.querySelector('#lf-schips').innerHTML = chipList.map(function (c) {
          return '<button class="lf-chip ' + (st.f === c[0] ? 'on' : '') + '" data-f="' + c[0] + '">' + c[2] + ' ' + esc(c[1]) + '</button>';
        }).join('');
        o.querySelector('#lf-sres').innerHTML = st.res.length
          ? '<div style="padding:6px 8px;font-size:12px;color:#626f86;font-weight:600">' + (st.ws.length ? st.res.length + ' result' + (st.res.length > 1 ? 's' : '') : 'Recently updated') + '</div>' + st.res.map(function (r, i) {
              return '<div class="lf-sri ' + (i === st.i ? 'act' : '') + '" data-i="' + i + '"><span class="ti">' + r.p.icon + '</span><div class="lf-srt"><b>' + hl(r.p.title || 'Untitled', st.ws) + '</b><small>' + spaces[r.p.space].icon + ' ' + esc(spaces[r.p.space].name) + ' &middot; ' + esc(r.p.author) + ' &middot; ' + rel(new Date(r.p.updated)) + '</small>' + (r.snip ? '<p>' + hl(r.snip, st.ws) + '</p>' : '') + '</div><span class="lf-stb ' + stClass(r.p.status) + '">' + r.p.status + '</span></div>';
            }).join('')
          : '<p style="padding:24px;text-align:center;color:#626f86">No pages match "' + esc(st.q) + '"' + (st.f !== 'all' ? ' in this space' : '') + '.</p>';
        icons();
        var a = o.querySelector('.lf-sri.act'); if (a) a.scrollIntoView({ block: 'nearest' });
      };
      var run = function () {
        var ws = st.q.toLowerCase().split(/\s+/).filter(Boolean); st.ws = ws;
        var list = getVisiblePages().filter(function (p) { return st.f === 'all' || p.space === st.f; });
        if (!ws.length) st.res = list.sort(function (a, b) { return new Date(b.updated) - new Date(a.updated); }).slice(0, 8).map(function (p) { return { p: p, snip: '' }; });
        else st.res = list.map(function (p) {
          var t = (p.title || 'Untitled').toLowerCase(), sb = (p.sub || '').toLowerCase(), txt = pageText(p), tl = txt.toLowerCase();
          if (!ws.every(function (w) { return t.indexOf(w) !== -1 || sb.indexOf(w) !== -1 || tl.indexOf(w) !== -1; })) return null;
          var sc = 0; ws.forEach(function (w) { if (t.indexOf(w) !== -1) sc += 10; if (t.indexOf(w) === 0) sc += 5; if (sb.indexOf(w) !== -1) sc += 3; if (tl.indexOf(w) !== -1) sc += 1; });
          var firstW = ws.find(function (w) { return tl.indexOf(w) !== -1; });
          var ix = firstW ? tl.indexOf(firstW) : -1;
          var snip = ix >= 0 ? (ix > 50 ? '...' : '') + txt.slice(Math.max(0, ix - 50), ix + 100) + '...' : '';
          return { p: p, sc: sc, snip: snip };
        }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 30);
        if (st.i >= st.res.length) st.i = 0;
        draw();
      };
      var open = function (i) {
        var r = st.res[i]; if (!r) return;
        var q = st.q.trim(); close(); selectPage(r.p.id);
        if (q && r.snip) setTimeout(function () { toggleFind(true); $('#lf-fq').value = q; doFind(); }, 60);
      };
      o.querySelector('#lf-sin').oninput = function (e) { st.q = e.target.value; st.i = 0; run(); };
      o.querySelector('#lf-schips').onclick = function (e) { var b = e.target.closest('[data-f]'); if (b) { st.f = b.dataset.f; st.i = 0; run(); o.querySelector('#lf-sin').focus(); } };
      o.querySelector('#lf-sres').onclick = function (e) { var it = e.target.closest('.lf-sri'); if (it) open(+it.dataset.i); };
      o.querySelector('#lf-sres').onmousemove = function (e) {
        var it = e.target.closest('.lf-sri');
        if (it && +it.dataset.i !== st.i) { st.i = +it.dataset.i; $$('.lf-sri', o).forEach(function (x, k) { x.classList.toggle('act', k === st.i); }); }
      };
      o.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!st.res.length) return; st.i = (st.i + (e.key === 'ArrowDown' ? 1 : -1) + st.res.length) % st.res.length; $$('.lf-sri', o).forEach(function (x, k) { x.classList.toggle('act', k === st.i); }); }
        if (e.key === 'Enter') { e.preventDefault(); open(st.i); }
      });
      run(); o.querySelector('#lf-sin').focus();
    }

    var searchBtn = $('#lf-btnSearch');
    if (searchBtn) searchBtn.onclick = function () { openSearch(); };
    $('#lf-btnLogo').onclick = function () {
      if (isBoardScoped && boardSpaceId && spaces[boardSpaceId] && spaces[boardSpaceId].roots.length) {
        selectPage(spaces[boardSpaceId].roots[0]);
      } else {
        showHome();
      }
    };
    $('#lf-spaceBtn').onclick = function (e) { spaceMenu(e.currentTarget); };

    var topSearch = document.getElementById('leaf-top-search');
    if (topSearch) {
      topSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); openSearch(topSearch.value); }
      });
    }

    /* width toggle */
    var wide = false;
    $('#lf-btnWidth').onclick = function () {
      wide = !wide;
      $('#lf-sheetWrap').style.maxWidth = wide ? 'none' : '882px';
      $('#lf-btnWidth').classList.toggle('on', wide);
      $('#lf-btnWidth').innerHTML = ic(wide ? 'minimize-2' : 'maximize-2') + '<span id="lf-widthLbl">' + (wide ? 'Fixed width' : 'Full width') + '</span>';
      icons();
    };

    /* global listeners scoped to active #leaf-app */
    document.addEventListener('selectionchange', function () {
      if (!document.getElementById('leaf-app')) return;
      var s = getSelection();
      if (s.rangeCount && ed.contains(s.anchorNode)) { savedRange = s.getRangeAt(0).cloneRange(); updateState(); detectMenu(); }
      else hideMenu();
      selButton();
    });
    document.addEventListener('mousedown', function (e) {
      if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop();
      if (selectedImgFig && !ed.contains(e.target) && !imgBar.contains(e.target) && !e.target.closest('.leaf-ovl')) {
        clearBlockSelections();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('leaf-app')) return;
      if (e.key === 'Escape') {
        closePop(); hideMenu(); clearBlockSelections();
        var m = document.querySelector('.leaf-ovl'); if (m) m.remove();
        if (painter) { painter = null; ed.classList.remove('painting'); updateState(); }
      }
      if (selectedRichBlk && !e.target.closest('input,textarea,[contenteditable="true"]:not(#lf-editor)')) {
        var isAtomic = selectedRichBlk.matches('figure.lf-img-block, hr, .pbreak');
        if ((e.key === 'Backspace' || e.key === 'Delete') && isAtomic) {
          e.preventDefault();
          var targetBlk = selectedRichBlk;
          var nextFocus = targetBlk.nextElementSibling || targetBlk.previousElementSibling;
          clearBlockSelections();
          targetBlk.remove();
          if (nextFocus) {
            var r = document.createRange();
            r.selectNodeContents(nextFocus);
            r.collapse(true);
            getSelection().removeAllRanges();
            getSelection().addRange(r);
          }
          changed();
          return;
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && isAtomic) {
          e.preventDefault();
          var sib = e.key === 'ArrowUp' ? selectedRichBlk.previousElementSibling : selectedRichBlk.nextElementSibling;
          if (!sib) {
            sib = document.createElement('p');
            sib.innerHTML = '<br>';
            if (e.key === 'ArrowUp') selectedRichBlk.before(sib); else selectedRichBlk.after(sib);
          }
          clearBlockSelections();
          var rNav = document.createRange();
          rNav.selectNodeContents(sib);
          rNav.collapse(e.key === 'ArrowDown');
          getSelection().removeAllRanges();
          getSelection().addRange(rNav);
          ed.focus({ preventScroll: true });
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (e.shiftKey) { e.preventDefault(); openSearch(); }
        else if (inEd() && view === 'page') { e.preventDefault(); toggleFind(true); }
      }
    });

    if (isBoardScoped) {
      var createdBoardSpace = ensureBoardSpace();
      initBoardTopnavSwitcher();
      load();
      if (createdBoardSpace) persistStore();
    } else {
      showHome(true);
    }
    icons();
    hydrateFromConvex();
  }

  window.initLeafWorkspace = initLeafWorkspace;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLeafWorkspace);
  } else {
    initLeafWorkspace();
  }
})();
