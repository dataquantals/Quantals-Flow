/* ==========================================================================
   Clerk Authentication & Organisations Browser Bridge (`assets/js/clerk-auth-bridge.js`)
   Loads ClerkJS using CLERK_PUBLISHABLE_KEY from /api/auth/config (Google,
   Microsoft, Email, Magic Links, Password, SSO, MFA) and syncs the verified
   Clerk session JWT to POST /api/auth/clerk-sync.
   ========================================================================== */
(function () {
  'use strict';

  var mount = document.getElementById('clerk-auth-mount');
  if (!mount) return;

  function decodeFrontendApi(pk) {
    try {
      var parts = String(pk || '').split('_');
      var encoded = parts.slice(2).join('_');
      return atob(encoded).replace(/\$$/, '');
    } catch {
      return '';
    }
  }

  async function syncClerkSession(clerk) {
    if (!clerk || !clerk.session) return;
    try {
      var token = await clerk.session.getToken();
      if (!token) return;
      var res = await fetch('/api/auth/clerk-sync', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok && data.user) {
        window.location.assign(data.needsOnboarding ? '/onboarding/' : '/dashboard/');
      }
    } catch {}
  }

  fetch('/api/auth/config', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.clerkPublishableKey) return;
      var pk = cfg.clerkPublishableKey;
      var fapi = decodeFrontendApi(pk);
      if (!fapi) return;

      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.clerkPublishableKey = pk;
      script.src = 'https://' + fapi + '/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
      script.onload = async function () {
        if (!window.Clerk) return;
        try {
          await window.Clerk.load();
          if (window.Clerk.user && window.Clerk.session) {
            await syncClerkSession(window.Clerk);
            return;
          }
          var mode = mount.dataset.clerkMode || 'signIn';
          mount.hidden = false;
          if (mode === 'signUp' && typeof window.Clerk.mountSignUp === 'function') {
            window.Clerk.mountSignUp(mount, { afterSignUpUrl: '/onboarding/', afterSignInUrl: '/dashboard/' });
          } else if (typeof window.Clerk.mountSignIn === 'function') {
            window.Clerk.mountSignIn(mount, { afterSignInUrl: '/dashboard/', afterSignUpUrl: '/onboarding/' });
          }
          window.Clerk.addListener(function (ev) {
            if (ev && ev.session) syncClerkSession(window.Clerk);
          });
        } catch {}
      };
      document.head.appendChild(script);
    })
    .catch(function () {});
})();
