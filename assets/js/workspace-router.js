/* ==========================================================================
   QuantalFlow Workspace Client Router (History API + Lazy Asset Loader)
   ==========================================================================
   Provides zero-reload client-side navigation across /dashboard/ and its
   hierarchical child modules (/dashboard/starred/, /dashboard/files/,
   /dashboard/notepad/, /dashboard/quotation/, /dashboard/invoice/), while
   preserving the persistent header + sidebar shell, server-side auth guards,
   deep links, browser Back/Forward, and 404 fallback.
   ========================================================================== */
(function () {
  'use strict';

  var ROUTE_TABLE = [
    { path: '/dashboard/',           key: 'boards',    shell: 'dashboard', filter: 'all' },
    { path: '/dashboard/starred/',   key: 'starred',   shell: 'dashboard', filter: 'starred' },
    { path: '/dashboard/files/',     key: 'files',     shell: 'dashboard', filter: 'files' },
    { path: '/dashboard/notepad/',   key: 'notepad',   shell: 'notepad' },
    { path: '/dashboard/quotation/', key: 'quotation', shell: 'quotation' },
    { path: '/dashboard/invoice/',   key: 'invoice',   shell: 'invoice' }
  ];

  var LEGACY_ALIASES = {
    '/notepad/': '/dashboard/notepad/',
    '/quotation/': '/dashboard/quotation/',
    '/invoice/': '/dashboard/invoice/'
  };

  // Shared shell scripts that are already loaded and should never be re-executed on swap.
  var SHARED_SCRIPT_PATTERNS = [
    /workspace-nav\.js/i,
    /workspace-router\.js/i
  ];

  // Heavy libraries loaded lazily once and reused across route visits.
  var ONCE_LIBS = [
    { match: /html2pdf\.bundle\.min\.js/i, globalCheck: function () { return typeof window.html2pdf !== 'undefined'; } },
    { match: /notepad-page\.js/i,          globalCheck: function () { return Boolean(window.ConvexNotes); } },
    { match: /\/assets\/js\/notepad\.js/i, globalCheck: function () { return typeof window.initNotepad === 'function'; }, reinit: function () { window.initNotepad(); } }
  ];

  var htmlCache = new Map();
  var loadedStyles = new Set();
  var navInFlight = 0;

  function normalizePath(rawPath) {
    var p = String(rawPath || '/').split('?')[0].split('#')[0];
    if (!p.startsWith('/')) p = '/' + p;
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  function resolveRoute(pathname) {
    var norm = normalizePath(pathname);
    var canonical = LEGACY_ALIASES[norm] || norm;
    for (var i = 0; i < ROUTE_TABLE.length; i += 1) {
      if (ROUTE_TABLE[i].path === canonical) return ROUTE_TABLE[i];
    }
    return null;
  }

  function recordExistingStyles() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href) loadedStyles.add(href.split('?')[0]);
    });
  }

  function ensureStyles(doc) {
    var links = doc.querySelectorAll('link[rel="stylesheet"]');
    var promises = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var key = href.split('?')[0];
      if (loadedStyles.has(key)) return;
      loadedStyles.add(key);
      promises.push(new Promise(function (resolve) {
        var el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = href;
        el.onload = resolve;
        el.onerror = resolve;
        document.head.appendChild(el);
      }));
    });
    return Promise.all(promises);
  }

  function loadScriptTag(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.setAttribute('data-ws-dynamic-script', 'true');
      s.onload = resolve;
      s.onerror = resolve;
      document.body.appendChild(s);
    });
  }

  async function runRouteScripts(doc) {
    // Clean up previous dynamic script tags from DOM (keeps head/body tidy)
    document.querySelectorAll('script[data-ws-dynamic-script="true"]').forEach(function (s) {
      s.remove();
    });

    var scripts = Array.from(doc.querySelectorAll('script[src]'));
    for (var i = 0; i < scripts.length; i += 1) {
      var src = scripts[i].getAttribute('src');
      if (!src) continue;
      if (SHARED_SCRIPT_PATTERNS.some(function (re) { return re.test(src); })) continue;

      var once = ONCE_LIBS.find(function (lib) { return lib.match.test(src); });
      if (once && once.globalCheck()) {
        if (typeof once.reinit === 'function') once.reinit();
        continue;
      }

      await loadScriptTag(src);
    }
  }

  function syncSidebarActive(route) {
    var sidebar = document.querySelector('.dash-sidebar');
    if (!sidebar || !route) return;
    sidebar.querySelectorAll('.dash-nav__item').forEach(function (item) {
      var href = item.getAttribute('href');
      var filter = item.getAttribute('data-filter');
      var isMatch = false;
      if (href) {
        var itemRoute = resolveRoute(href);
        if (itemRoute && itemRoute.path === route.path) isMatch = true;
      } else if (filter && route.shell === 'dashboard' && route.filter === filter) {
        isMatch = true;
      }
      item.classList.toggle('is-active', isMatch);
      if (isMatch) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function syncMetadata(doc) {
    if (doc.title) document.title = doc.title;
    var nextDesc = doc.querySelector('meta[name="description"]');
    var curDesc = document.querySelector('meta[name="description"]');
    if (nextDesc && curDesc) {
      curDesc.setAttribute('content', nextDesc.getAttribute('content') || '');
    }
    if (doc.body && doc.body.className) {
      var locked = document.body.classList.contains('dash-drawer-locked');
      document.body.className = doc.body.className;
      if (locked) document.body.classList.add('dash-drawer-locked');
    }
  }

  async function fetchRouteHtml(path) {
    if (htmlCache.has(path)) return htmlCache.get(path);
    var res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'X-QuantalFlow-Router': '1' }
    });
    if (res.status === 401 || (res.redirected && res.url && res.url.indexOf('/login/') !== -1)) {
      window.location.replace('/login/?next=' + encodeURIComponent(path));
      return null;
    }
    if (res.status === 404) {
      window.location.assign(path);
      return null;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var text = await res.text();
    htmlCache.set(path, text);
    return text;
  }

  function prefetch(url) {
    var route = resolveRoute(url);
    if (!route || htmlCache.has(route.path)) return;
    fetchRouteHtml(route.path).catch(function () {});
  }

  async function navigate(targetUrl, opts) {
    opts = opts || {};
    var parsed;
    try {
      parsed = new URL(targetUrl, window.location.origin);
    } catch (e) {
      return false;
    }
    if (parsed.origin !== window.location.origin) return false;

    var route = resolveRoute(parsed.pathname);
    if (!route) return false;

    var targetFull = route.path + (parsed.search || '') + (parsed.hash || '');
    var currentRoute = resolveRoute(window.location.pathname);

    // If staying inside the dashboard boards/starred/files shell, delegate to
    // the already-mounted in-page filter handler for zero-latency switching.
    if (
      route.shell === 'dashboard' &&
      currentRoute &&
      currentRoute.shell === 'dashboard' &&
      document.getElementById('dash-boards-view')
    ) {
      var filterBtn = document.querySelector('.dash-sidebar [data-filter="' + route.filter + '"]');
      if (filterBtn) {
        if (opts.push !== false && window.history && window.history.pushState) {
          window.history.pushState({ wsRoute: route.path }, '', targetFull);
        }
        filterBtn.click();
        syncSidebarActive(route);
        return true;
      }
    }

    // Navigating from a child page (quotation/invoice/notepad) back to /dashboard/*:
    // dashboard.html owns several workspace modals + multi-script state, so
    // fall back to full navigation into dashboard to guarantee clean state.
    if (route.shell === 'dashboard' && (!currentRoute || currentRoute.shell !== 'dashboard')) {
      window.location.assign(targetFull);
      return true;
    }

    var token = ++navInFlight;
    var currentMain = document.querySelector('main.dash');
    if (!currentMain) {
      window.location.assign(targetFull);
      return true;
    }

    currentMain.setAttribute('aria-busy', 'true');
    currentMain.style.opacity = '0.6';

    try {
      var html = await fetchRouteHtml(route.path);
      if (!html || token !== navInFlight) return true;

      var doc = new DOMParser().parseFromString(html, 'text/html');
      var nextMain = doc.querySelector('main.dash');
      if (!nextMain) {
        window.location.assign(targetFull);
        return true;
      }

      await ensureStyles(doc);
      if (token !== navInFlight) return true;

      if (opts.push !== false && window.history && window.history.pushState) {
        window.history.pushState({ wsRoute: route.path }, '', targetFull);
      }

      syncMetadata(doc);
      currentMain.replaceWith(document.importNode(nextMain, true));
      syncSidebarActive(route);
      window.scrollTo({ top: 0, behavior: 'instant' });

      await runRouteScripts(doc);
      return true;
    } catch (err) {
      console.warn('[WorkspaceRouter] Falling back to full navigation:', err.message);
      window.location.assign(targetFull);
      return true;
    }
  }

  function initRouter() {
    recordExistingStyles();

    // Canonicalize legacy top-level URLs (/notepad/, /quotation/, /invoice/)
    // or ensure initial history state carries the active route.
    var initialRoute = resolveRoute(window.location.pathname);
    if (initialRoute) {
      syncSidebarActive(initialRoute);
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(
            { wsRoute: initialRoute.path },
            '',
            window.location.pathname + window.location.search + window.location.hash
          );
        }
      } catch (e) {}
    }

    // Intercept clicks on workspace navigation links
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      var link = e.target.closest('.dash-sidebar a[href], a[data-ws-route]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      var href = link.getAttribute('href');
      if (!href || !href.startsWith('/')) return;

      var route = resolveRoute(href);
      if (!route) return;

      e.preventDefault();
      navigate(href, { push: true });
    });

    // Warm the cache on hover/focus so route transitions feel instantaneous
    document.addEventListener('pointerenter', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('.dash-sidebar a[href], a[data-ws-route]') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (href && href.startsWith('/')) prefetch(href);
    }, true);

    // Support browser Back / Forward buttons
    window.addEventListener('popstate', function () {
      var route = resolveRoute(window.location.pathname);
      if (route) {
        navigate(window.location.pathname + window.location.search + window.location.hash, { push: false });
      }
    });
  }

  window.QuantalFlowRouter = {
    routes: ROUTE_TABLE.slice(),
    navigate: navigate,
    prefetch: prefetch,
    getCurrentRoute: function () { return resolveRoute(window.location.pathname); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
  } else {
    initRouter();
  }
})();
