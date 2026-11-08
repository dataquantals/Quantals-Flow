/* ==========================================================================
   Save State — persistent UI/state drafts backed by localStorage.

   Auto-captures form inputs, textareas and selects (never passwords), plus any
   element that opts in with `data-state`. Writes are debounced so fast typing
   does not hammer localStorage, and every read/write is wrapped so a full or
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

  var STORAGE = 'localStorage';
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

  /* In-memory mirror of the page state, flushed to storage on a debounce so we
     only touch localStorage once per burst of edits. Form fields live under a
     `forms` namespace so two forms with the same field name never collide. */
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

  /* ---------- Convex Auth & Serverless API Bridge ----------
     Persists the Convex session token in localStorage so every same-origin
     `/api/*` call carries `Authorization: Bearer <token>` alongside the
     HttpOnly session cookie, and falls back directly to Convex Cloud
     (`convex/auth.js`) if a serverless function route is ever unreachable. */
  var CONVEX_URL = global.QUANTALFLOW_CONVEX_URL || 'https://agreeable-starfish-202.convex.cloud';
  var TOKEN_KEY = 'quantalflow_convex_token';
  var USER_KEY = 'quantalflow_convex_user';

  function getAuthToken() {
    return readRaw(TOKEN_KEY) || '';
  }

  function setAuthSession(token, user) {
    if (token) writeRaw(TOKEN_KEY, String(token));
    if (user && typeof user === 'object') writeRaw(USER_KEY, JSON.stringify(user));
  }

  function clearAuthSession() {
    try {
      global[STORAGE].removeItem(TOKEN_KEY);
      global[STORAGE].removeItem(USER_KEY);
    } catch (e) {}
  }

  function convexRpc(kind, path, args) {
    return origFetch(CONVEX_URL + '/api/' + kind, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path, args: args || {}, format: 'json' })
    }).then(function (r) {
      return r.json().then(function ( payload ) {
        if (!r.ok || payload.status === 'error') {
          var err = new Error((payload && payload.errorMessage) || ('Convex ' + path + ' failed'));
          err.data = payload;
          throw err;
        }
        return payload ? payload.value : null;
      });
    });
  }

  function jsonResponse(status, obj) {
    return new Response(JSON.stringify(obj), {
      status: status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function parseRequestBody(init) {
    if (!init || !init.body || typeof init.body !== 'string') return {};
    try { return JSON.parse(init.body); } catch (e) { return {}; }
  }

  function fallbackToConvex(pathname, searchParams, method, init) {
    var body = parseRequestBody(init);
    var token = getAuthToken();

    if (method === 'POST' && pathname === '/api/auth/login') {
      return convexRpc('mutation', 'auth:login', {
        email: body.email || '',
        password: body.password || ''
      }).then(function (res) {
        if (!res || !res.ok) {
          return jsonResponse((res && res.status) || 401, { error: (res && res.error) || 'Invalid email or password.' });
        }
        setAuthSession(res.token, res.user);
        try {
          document.cookie = 'qf_session=' + encodeURIComponent(res.token) + '; Path=/; Max-Age=2592000; SameSite=Lax';
        } catch (e) {}
        return jsonResponse(200, { user: res.user, token: res.token, authProvider: 'convex' });
      });
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      return convexRpc('mutation', 'auth:register', {
        name: body.name || '',
        email: body.email || '',
        password: body.password || ''
      }).then(function (res) {
        if (!res || !res.ok) {
          return jsonResponse((res && res.status) || 400, {
            error: (res && res.error) || 'Registration failed.',
            field: res && res.field
          });
        }
        setAuthSession(res.token, res.user);
        try {
          document.cookie = 'qf_session=' + encodeURIComponent(res.token) + '; Path=/; Max-Age=2592000; SameSite=Lax';
        } catch (e) {}
        return jsonResponse(201, { user: res.user, token: res.token, authProvider: 'convex' });
      });
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      if (!token) return Promise.resolve(jsonResponse(200, { user: null }));
      return convexRpc('query', 'auth:me', { token: token }).then(function (res) {
        var user = (res && res.user) || null;
        if (user) setAuthSession(token, user);
        return jsonResponse(200, { user: user, authProvider: 'convex' });
      });
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      clearAuthSession();
      try {
        document.cookie = 'qf_session=; Path=/; Max-Age=0; SameSite=Lax';
      } catch (e) {}
      if (!token) return Promise.resolve(jsonResponse(200, { ok: true }));
      return convexRpc('mutation', 'auth:logout', { token: token }).then(function () {
        return jsonResponse(200, { ok: true });
      });
    }

    if (method === 'PATCH' && pathname === '/api/auth/profile') {
      return convexRpc('mutation', 'auth:updateProfile', {
        token: token,
        name: body.name,
        email: body.email,
        title: body.title,
        company: body.company,
        bio: body.bio,
        avatarUrl: body.avatarUrl,
        avatarStorageId: body.avatarStorageId
      }).then(function (res) {
        if (!res || !res.ok) {
          return jsonResponse((res && res.status) || 400, { error: (res && res.error) || 'Profile update failed.' });
        }
        setAuthSession(token, res.user);
        return jsonResponse(200, { user: res.user });
      });
    }

    if (method === 'POST' && pathname === '/api/auth/password') {
      return convexRpc('mutation', 'auth:changePassword', {
        token: token,
        currentPassword: body.currentPassword || '',
        newPassword: body.newPassword || ''
      }).then(function (res) {
        if (!res || !res.ok) {
          return jsonResponse((res && res.status) || 400, {
            error: (res && res.error) || 'Password update failed.',
            field: res && res.field
          });
        }
        return jsonResponse(200, { ok: true });
      });
    }

    if (method === 'GET' && pathname === '/api/boards') {
      return convexRpc('query', 'auth:listBoards', {
        token: token,
        filter: searchParams.get('filter') || 'all',
        search: searchParams.get('q') || ''
      }).then(function (res) {
        if (!res || !res.ok) return jsonResponse((res && res.status) || 401, { error: 'Authentication required.' });
        return jsonResponse(200, { boards: res.boards || [] });
      });
    }

    if (method === 'POST' && pathname === '/api/boards') {
      return convexRpc('mutation', 'auth:upsertBoard', {
        token: token,
        boardId: body.id ? String(body.id) : undefined,
        title: body.title,
        template: body.template,
        starred: body.starred,
        state: body.state
      }).then(function (res) {
        if (!res || !res.ok) return jsonResponse((res && res.status) || 400, { error: (res && res.error) || 'Failed to save board.' });
        return jsonResponse(201, { board: res.board });
      });
    }

    var boardMatch = pathname.match(/^\/api\/boards\/([^/]+)$/);
    if (boardMatch) {
      var boardId = decodeURIComponent(boardMatch[1]);
      if (method === 'GET') {
        return convexRpc('query', 'auth:getBoard', { token: token, boardId: boardId }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 404, { error: (res && res.error) || 'Board not found.' });
          return jsonResponse(200, { board: res.board });
        });
      }
      if (method === 'PATCH' || method === 'PUT') {
        return convexRpc('mutation', 'auth:upsertBoard', {
          token: token,
          boardId: boardId,
          title: body.title,
          template: body.template,
          starred: body.starred,
          state: body.state
        }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 400, { error: (res && res.error) || 'Failed to update board.' });
          return jsonResponse(200, { board: res.board });
        });
      }
      if (method === 'DELETE') {
        return convexRpc('mutation', 'auth:deleteBoard', { token: token, boardId: boardId }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 404, { error: 'Board not found.' });
          return jsonResponse(200, { ok: true });
        });
      }
    }

    var projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      var projBoardId = decodeURIComponent(projectMatch[1]);
      if (method === 'GET') {
        return convexRpc('query', 'auth:getProjectPlan', { token: token, boardId: projBoardId }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 401, { error: 'Authentication required.' });
          return jsonResponse(200, { boardId: res.boardId, plan: res.plan, updatedAt: res.updatedAt });
        });
      }
      if (method === 'PUT' || method === 'PATCH') {
        var planPayload = body && typeof body.plan === 'object' && body.plan !== null ? body.plan : body;
        return convexRpc('mutation', 'auth:saveProjectPlan', {
          token: token,
          boardId: projBoardId,
          title: body && body.title ? String(body.title) : undefined,
          plan: planPayload
        }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 400, { error: (res && res.error) || 'Failed to save plan.' });
          return jsonResponse(200, {
            boardId: res.boardId,
            plan: res.plan,
            updatedAt: res.updatedAt,
            convexSynced: true
          });
        });
      }
      if (method === 'DELETE') {
        return convexRpc('mutation', 'auth:deleteProjectPlan', { token: token, boardId: projBoardId }).then(function (res) {
          if (!res || !res.ok) return jsonResponse((res && res.status) || 404, { error: 'Project plan not found.' });
          return jsonResponse(200, { ok: true });
        });
      }
    }

    return null;
  }

  var origFetch = typeof global.fetch === 'function' ? global.fetch.bind(global) : null;
  if (origFetch) {
    global.fetch = function (input, init) {
      var rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
      var urlObj = null;
      try {
        urlObj = new URL(rawUrl, global.location.origin);
      } catch (e) {}

      if (!urlObj || urlObj.origin !== global.location.origin || urlObj.pathname.indexOf('/api/') !== 0) {
        return origFetch(input, init);
      }

      var pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var nextInit = Object.assign({}, init || {});
      var headers = new Headers((init && init.headers) || (input && input.headers) || {});
      var token = getAuthToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + token);
      }
      nextInit.headers = headers;

      return origFetch(input, nextInit).then(function (res) {
        if (
          res.status === 404 ||
          res.status === 405 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504
        ) {
          var fb = fallbackToConvex(pathname, urlObj.searchParams, method, nextInit);
          if (fb) return fb.catch(function () { return res; });
        }

        if (pathname === '/api/auth/logout' && res.ok) {
          clearAuthSession();
        } else if (
          (pathname === '/api/auth/login' || pathname === '/api/auth/register' || pathname === '/api/auth/clerk-sync') &&
          res.ok
        ) {
          try {
            res.clone().json().then(function (data) {
              if (data && data.token) setAuthSession(data.token, data.user);
            }).catch(function () {});
          } catch (e) {}
        }
        return res;
      }, function (networkErr) {
        var fb = fallbackToConvex(pathname, urlObj.searchParams, method, nextInit);
        if (fb) return fb;
        throw networkErr;
      });
    };
  }

  global.ConvexAuth = {
    getToken: getAuthToken,
    setSession: setAuthSession,
    clearSession: clearAuthSession,
    rpc: convexRpc
  };

  // Don't lose the final keystroke if the user navigates away before the
  // debounce timer fires. `pagehide` covers back/forward, close and reload.
  global.addEventListener('pagehide', flush);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
