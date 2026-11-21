/* ==========================================================================
   Save State — ephemeral UI/form draft helper backed by sessionStorage.

   Auto-captures form inputs, textareas and selects (never passwords), plus any
   element that opts in with `data-state`. Writes are debounced so fast typing
   does not hammer storage, and every read/write is wrapped so a full or
   blocked store fails silently and the app keeps working from clean defaults.

   Public surface (global `window.SaveState`):
     SaveState.restore()            rehydrate the current page once
     SaveState.clear(form)          wipe the draft for a specific form
     SaveState.set(key, value)      write a single named value (top-level)
     SaveState.get(key)             read a single named value (top-level)
     SaveState.remove(key)          delete a single named value
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE = 'sessionStorage';
  var DEBOUNCE_MS = 400;
  var PAGE_KEY = 'quantalflow:state:' + location.pathname.replace(/[^a-z0-9]+/gi, '_');

  /* Passwords and anything the browser already manages are intentionally never
     serialised so sensitive values never sit in storage. */
  var SKIP_INPUT = function (el) {
    return el.type === 'password' || el.type === 'hidden';
  };

  /* ---------- Safe storage primitives ---------- */
  function readRaw(key) {
    try {
      return global[STORAGE].getItem(key);
    } catch (err) {
      console.warn('[save-state] read blocked:', err && err.message);
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      global[STORAGE].setItem(key, value);
      return true;
    } catch (err) {
      console.warn('[save-state] write blocked:', err && err.message);
      return false;
    }
  }

  function readJSON(key) {
    var raw = readRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[save-state] corrupt payload ignored for', key);
      return null;
    }
  }

  /* In-memory mirror of the page state, flushed to sessionStorage on a debounce. */
  var page = readJSON(PAGE_KEY) || {};
  if (!page.forms) page.forms = {};

  var flushTimer = null;

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    writeRaw(PAGE_KEY, JSON.stringify(page));
  }

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, DEBOUNCE_MS);
  }

  /* ---------- Field serialisation ---------- */
  function readValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return el.checked ? el.value : null;
    return el.value;
  }

  function applyValue(el, value) {
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value == null ? '' : String(value);
  }

  function fieldKey(el) {
    return el.name || el.id;
  }

  function formKey(form) {
    return form.id || form.getAttribute('name');
  }

  function fields(form) {
    var bag = page.forms[formKey(form)] || (page.forms[formKey(form)] = {});
    return bag;
  }

  function captureField(form, el) {
    var key = fieldKey(el);
    if (!key || SKIP_INPUT(el)) return;
    var value = readValue(el);
    if (value === null) return;
    fields(form)[key] = value;
    scheduleFlush();
  }

  /* ---------- Auto-wire every form + data-state element ---------- */
  function init() {
    document.querySelectorAll('form').forEach(function (form) {
      var fkey = formKey(form);
      if (!fkey) return;

      // 1. Rehydrate this form's saved fields, if any, before the user sees it.
      var saved = page.forms[fkey] || {};
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        var key = fieldKey(el);
        if (!key || SKIP_INPUT(el)) return;
        if (saved[key] !== undefined) applyValue(el, saved[key]);
      });

      // 2. Capture edits. Browsers fire `input` for text and `change` for
      //    selects/radios/checkboxes, so listening to both covers every case.
      form.addEventListener('input', function (e) { captureField(form, e.target); });
      form.addEventListener('change', function (e) { captureField(form, e.target); });
    });

    // 3. Non-form controls opt in via `data-state`, e.g. tabs and toggles.
    document.querySelectorAll('[data-state]').forEach(function (el) {
      var key = el.getAttribute('data-state');
      if (!key) return;
      var saved = page[key];
      if (saved !== undefined && saved !== null && saved !== '') applyValue(el, saved);

      el.addEventListener('change', function () {
        var value = readValue(el);
        if (value === null) return;
        page[key] = value;
        scheduleFlush();
      });
      el.addEventListener('input', function () {
        var value = readValue(el);
        if (value === null) return;
        page[key] = value;
        scheduleFlush();
      });
    });
  }

  /* ---------- Public API ---------- */
  var api = {
    init: init,
    restore: init,
    clear: function (form) {
      if (form) {
        delete page.forms[formKey(form)];
      } else {
        page.forms = {};
      }
      flush();
    },
    set: function (key, value) {
      page[key] = value;
      scheduleFlush();
    },
    get: function (key) {
      return page[key];
    },
    remove: function (key) {
      delete page[key];
      scheduleFlush();
    }
  };

  global.SaveState = api;

  /* ---------- Auth Session Cleanup ----------
     Authentication relies strictly on HttpOnly session cookies managed by
     the backend. Purge any legacy tokens/user objects from localStorage on
     startup so XSS vectors cannot read credentials from browser storage. */
  (function purgeLegacyClientAuth() {
    try {
      global.localStorage.removeItem('quantalflow_convex_token');
      global.localStorage.removeItem('quantalflow_convex_user');
    } catch (e) {}
  })();

  /* ---------- Global fetch interceptors ----------
     One wrapper, two concerns, every page (this file is loaded in both the
     base and standalone layouts):

     1. Vercel serverless /api/router fallback — a static edge deployment can
        return a platform 404 (text/plain) for /api/<subpath>; retry via
        /api/router?__api_path=<subpath>.

     2. Auth 401 handling — the session cookie is HttpOnly and the server
        enforces a rolling 10-minute idle timeout. Any 401 on a non-auth
        /api/ route means the session expired (or the browser purged the
        non-persistent cookie), so send the user to login with ?next= pointing
        back at where they were. Auth endpoints own their 401s (e.g. a wrong
        password) and are deliberately left alone. */
  (function installGlobalFetchInterceptors() {
    if (typeof global.fetch !== 'function') return;
    var nativeFetch = global.fetch.bind(global);
    var AUTH_ENDPOINTS = [
      '/api/auth/login', '/api/auth/register', '/api/auth/me',
      '/api/auth/config', '/api/auth/clerk-sync'
    ];
    var REDIRECTING_KEY = 'quantalflow_redirecting';

    global.fetch = function (input, init) {
      var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      return nativeFetch(input, init).then(function (res) {
        // 1. Vercel fallback (unchanged behaviour).
        if (
          res.status === 404 &&
          typeof urlStr === 'string' &&
          urlStr.indexOf('/api/') === 0 &&
          urlStr.indexOf('/api/router') !== 0
        ) {
          var ct = (res.headers && res.headers.get('content-type')) || '';
          if (ct.indexOf('application/json') === -1) {
            var qIdx = urlStr.indexOf('?');
            var pathPart = (qIdx >= 0 ? urlStr.slice(0, qIdx) : urlStr).replace(/^\/api\/+/, '');
            var queryPart = qIdx >= 0 ? '&' + urlStr.slice(qIdx + 1) : '';
            var fallbackUrl = '/api/router?__api_path=' + encodeURIComponent(pathPart) + queryPart;
            return nativeFetch(fallbackUrl, init);
          }
        }

        // 2. Idle-timeout / closed-session 401 -> login with a safe ?next=.
        if (
          res.status === 401 &&
          !global[REDIRECTING_KEY] &&
          typeof urlStr === 'string' &&
          urlStr.indexOf('/api/') === 0
        ) {
          var isAuthEndpoint = false;
          for (var i = 0; i < AUTH_ENDPOINTS.length; i++) {
            if (urlStr.indexOf(AUTH_ENDPOINTS[i]) === 0) { isAuthEndpoint = true; break; }
          }
          if (!isAuthEndpoint) {
            // Single in-flight guard so N parallel 401s don't queue N logins.
            global[REDIRECTING_KEY] = true;
            try { global.localStorage.removeItem('quantalflow_pp_state_v2_'); } catch (e) {}
            var next = location.pathname + location.search;
            location.href = '/login/?next=' + encodeURIComponent(next);
          }
        }

        return res;
      });
    };
  })();

  // Don't lose the final keystroke if the user navigates away before the
  // debounce timer fires. `pagehide` covers back/forward, close and reload.
  global.addEventListener('pagehide', flush);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
