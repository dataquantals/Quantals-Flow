/* ==========================================================================
   QuantalFlow Headless Clerk Auth Bridge (`assets/js/clerk-auth-bridge.js`)
   - Goes DIRECTLY from QuantalFlow -> Google / Microsoft / SSO -> QuantalFlow
   - Never opens or redirects to `*.accounts.dev/sign-in`
   - Automatically completes OAuth sign-in AND first-time OAuth sign-up transfers
     headless on `/login/?clerk_callback=1`, then syncs the verified JWT to
     POST /api/auth/clerk-sync.
   ========================================================================== */
(function () {
  'use strict';

  var clerkReady = null;
  var msgEl = document.getElementById('login-msg') || document.getElementById('signup-msg');

  function setMsg(text, state) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = (msgEl.id === 'signup-msg' ? 'form-msg' : 'auth__msg') + (state ? ' is-' + state : '');
  }

  function decodeFrontendApi(pk) {
    try {
      var parts = String(pk || '').split('_');
      var encoded = parts.slice(2).join('_');
      return atob(encoded).replace(/\$$/, '');
    } catch {
      return '';
    }
  }

  function safeNextTarget() {
    var raw = new URLSearchParams(window.location.search || '').get('next');
    if (!raw || raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.charAt(1) === '\\') {
      return '/dashboard/';
    }
    try {
      if (new URL(raw, window.location.origin).origin !== window.location.origin) return '/dashboard/';
    } catch {
      return '/dashboard/';
    }
    return raw;
  }

  async function syncClerkSession(clerk) {
    if (!clerk || !clerk.session) return false;
    try {
      var token = await clerk.session.getToken();
      if (!token) return false;
      var res = await fetch('/api/auth/clerk-sync', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok && data.user) {
        setMsg('Signed in — redirecting…', 'ok');
        window.location.replace(data.needsOnboarding ? '/onboarding/' : safeNextTarget());
        return true;
      }
      if (data && data.error) {
        setMsg(data.error, 'error');
      }
    } catch {}
    return false;
  }

  function loadClerkHeadless() {
    if (clerkReady) return clerkReady;
    clerkReady = fetch('/api/auth/config', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || !cfg.clerkPublishableKey) return null;
        var pk = cfg.clerkPublishableKey;
        var fapi = decodeFrontendApi(pk);
        if (!fapi) return null;
        return new Promise(function (resolve) {
          if (window.Clerk && typeof window.Clerk.load === 'function') {
            window.Clerk.load({
              signInUrl: '/login/',
              signUpUrl: '/get-started/',
              afterSignInUrl: '/dashboard/',
              afterSignUpUrl: '/onboarding/'
            }).then(function () { resolve(window.Clerk); }).catch(function () { resolve(null); });
            return;
          }
          var script = document.createElement('script');
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.dataset.clerkPublishableKey = pk;
          script.src = 'https://' + fapi + '/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
          script.onload = async function () {
            if (!window.Clerk) return resolve(null);
            try {
              // Explicitly pin signInUrl & signUpUrl to local routes so Clerk NEVER redirects to *.accounts.dev/sign-in
              await window.Clerk.load({
                signInUrl: '/login/',
                signUpUrl: '/get-started/',
                afterSignInUrl: '/dashboard/',
                afterSignUpUrl: '/onboarding/'
              });
              resolve(window.Clerk);
            } catch {
              resolve(null);
            }
          };
          script.onerror = function () { resolve(null); };
          document.head.appendChild(script);
        });
      })
      .catch(function () { return null; })
      .then(function (instance) {
        // Never permanently memoize a failed load so subsequent clicks can retry cleanly.
        if (!instance) clerkReady = null;
        return instance;
      });
    return clerkReady;
  }

  /* ---- Complete OAuth Callback Headless (including Sign-In -> Sign-Up transfer) ---- */
  async function completeHeadlessOAuthCallback(clerk) {
    if (!clerk || !clerk.client) return;
    setMsg('Completing Google / SSO sign-in…', '');
    try {
      var signIn = clerk.client.signIn;
      var signUp = clerk.client.signUp;

      // Case 1: Existing user completed OAuth on signIn
      if (signIn && signIn.status === 'complete' && signIn.createdSessionId) {
        await clerk.setActive({ session: signIn.createdSessionId });
        if (await syncClerkSession(clerk)) return;
      }

      // Case 2: First-time OAuth user — transfer from signIn -> signUp seamlessly in headless JS
      var ffv = signIn && signIn.firstFactorVerification;
      if (ffv && ffv.status === 'transferable' && signUp) {
        var transferred = await signUp.create({ transfer: true });
        if (transferred.status === 'complete' && transferred.createdSessionId) {
          await clerk.setActive({ session: transferred.createdSessionId });
          if (await syncClerkSession(clerk)) return;
        }
        // If Clerk requires a username on sign-up, auto-supply a guaranteed non-numeric handle (>= 6 chars)
        if (transferred.status === 'missing_requirements' && Array.isArray(transferred.missingFields) && transferred.missingFields.indexOf('username') !== -1) {
          var rawLocal = ((transferred.emailAddress || 'user').split('@')[0] || 'user')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 15);
          var safePrefix = /^[a-z]/.test(rawLocal) ? rawLocal : ('qf_' + rawLocal);
          var completed = await signUp.update({
            username: safePrefix + '_' + Math.floor(100 + Math.random() * 900)
          });
          if (completed.status === 'complete' && completed.createdSessionId) {
            await clerk.setActive({ session: completed.createdSessionId });
            if (await syncClerkSession(clerk)) return;
          }
        }
      }

      // Case 3: Standard Clerk redirect callback handler pinned strictly to local URLs
      if (typeof clerk.handleRedirectCallback === 'function') {
        await clerk.handleRedirectCallback({
          signInUrl: '/login/',
          signUpUrl: '/login/',
          continueSignUpUrl: '/login/',
          afterSignInUrl: '/login/?clerk_synced=1',
          afterSignUpUrl: '/login/?clerk_synced=1'
        });
      }
      if (clerk.user && clerk.session) {
        await syncClerkSession(clerk);
      }
    } catch (err) {
      var emsg = (err && err.errors && err.errors[0] && err.errors[0].longMessage) ||
        (err && err.message) ||
        'Could not complete SSO callback.';
      setMsg(emsg, 'error');
    }
  }

  /* ---- Headless Email + Password Sign-In fallback for Clerk-registered users ---- */
  window.QFClerkPasswordSignIn = async function (email, password) {
    var clerk = await loadClerkHeadless();
    if (!clerk || !clerk.client || !clerk.client.signIn) return false;
    try {
      var attempt = await clerk.client.signIn.create({
        identifier: email,
        password: password
      });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await clerk.setActive({ session: attempt.createdSessionId });
        return await syncClerkSession(clerk);
      }
    } catch {}
    return false;
  };

  /* ---- Wire QuantalFlow's own Google / Microsoft / SSO buttons DIRECTLY to OAuth ---- */
  function wireSsoButtons() {
    var buttons = document.querySelectorAll('[data-sso]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var provider = btn.getAttribute('data-sso');
        setMsg('Redirecting directly to ' + (provider === 'sso' ? 'SSO' : provider.charAt(0).toUpperCase() + provider.slice(1)) + '…', '');
        var clerk = await loadClerkHeadless();
        if (!clerk || !clerk.client || !clerk.client.signIn) {
          setMsg('SSO provider is not ready yet. Please try again in a moment.', 'error');
          return;
        }
        var nextParam = new URLSearchParams(window.location.search || '').get('next');
        var callbackUrl = window.location.origin + '/login/?clerk_callback=1' +
          (nextParam ? '&next=' + encodeURIComponent(nextParam) : '');
        try {
          if (provider === 'google') {
            await clerk.client.signIn.authenticateWithRedirect({
              strategy: 'oauth_google',
              redirectUrl: callbackUrl,
              redirectUrlComplete: callbackUrl
            });
          } else if (provider === 'microsoft') {
            await clerk.client.signIn.authenticateWithRedirect({
              strategy: 'oauth_microsoft',
              redirectUrl: callbackUrl,
              redirectUrlComplete: callbackUrl
            });
          } else if (provider === 'sso') {
            var emailEl = document.getElementById('login-email') || document.getElementById('s-email');
            var workEmail = emailEl ? emailEl.value.trim() : '';
            if (!workEmail || workEmail.indexOf('@') === -1) {
              setMsg('Enter your work email below first, then click Continue with SSO.', 'error');
              if (emailEl) emailEl.focus();
              return;
            }
            await clerk.client.signIn.authenticateWithRedirect({
              strategy: 'enterprise_sso',
              identifier: workEmail,
              redirectUrl: callbackUrl,
              redirectUrlComplete: callbackUrl
            });
          }
        } catch (err) {
          var emsg = (err && err.errors && err.errors[0] && err.errors[0].longMessage) ||
            (err && err.message) ||
            'Could not start OAuth flow. Confirm this provider is enabled in Clerk SSO connections.';
          setMsg(emsg, 'error');
        }
      }, true);
    });
  }

  wireSsoButtons();
  loadClerkHeadless().then(async function (clerk) {
    if (!clerk) return;
    var params = new URLSearchParams(window.location.search || '');
    if (params.get('logged_out') === '1') {
      try {
        if (clerk.session && typeof clerk.signOut === 'function') {
          await clerk.signOut({ redirectUrl: '/login/' });
        }
      } catch {}
      try {
        window.history.replaceState({}, '', '/login/');
      } catch {}
      return;
    }
    if (params.get('clerk_callback') === '1' || params.get('clerk_synced') === '1') {
      await completeHeadlessOAuthCallback(clerk);
      return;
    }
    if (clerk.user && clerk.session) {
      await syncClerkSession(clerk);
    }
  });
})();
