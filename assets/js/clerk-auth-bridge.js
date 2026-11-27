/* ==========================================================================
   Clerk Authentication & Organisations Browser Bridge (`assets/js/clerk-auth-bridge.js`)
   Loads ClerkJS using CLERK_PUBLISHABLE_KEY from /api/auth/config (Google,
   Microsoft, Email, Magic Links, Password, SSO, MFA) and syncs the verified
   Clerk session JWT to POST /api/auth/clerk-sync.
   When Clerk mounts cleanly, hides the legacy form so there is only ONE
   unified sign-in UI (with a subtle fallback link for local accounts).
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

  function activateSingleClerkLayout() {
    var card = mount.closest('.auth__card');
    if (!card) return;
    var legacyEls = card.querySelectorAll('.auth__title, .auth__sub, .auth__sso, .auth__divider, #login-form, .auth__foot');
    legacyEls.forEach(function (el) { el.hidden = true; });
    card.style.background = 'transparent';
    card.style.boxShadow = 'none';
    card.style.border = 'none';
    card.style.padding = '0';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';

    if (!document.getElementById('qf-local-fallback-toggle')) {
      var toggle = document.createElement('button');
      toggle.id = 'qf-local-fallback-toggle';
      toggle.type = 'button';
      toggle.textContent = 'Sign in with local workspace password instead';
      toggle.style.cssText = 'margin-top:14px;background:none;border:0;color:#64748b;font-size:12.5px;cursor:pointer;text-decoration:underline;';
      toggle.onclick = function () {
        var showingLegacy = toggle.dataset.legacy === '1';
        toggle.dataset.legacy = showingLegacy ? '0' : '1';
        mount.hidden = !showingLegacy;
        legacyEls.forEach(function (el) { el.hidden = showingLegacy; });
        if (!showingLegacy) {
          card.style.background = '';
          card.style.boxShadow = '';
          card.style.border = '';
          card.style.padding = '';
          card.style.display = '';
          toggle.textContent = '← Back to Clerk Sign-In';
        } else {
          card.style.background = 'transparent';
          card.style.boxShadow = 'none';
          card.style.border = 'none';
          card.style.padding = '0';
          card.style.display = 'flex';
          toggle.textContent = 'Sign in with local workspace password instead';
        }
      };
      card.appendChild(toggle);
    }
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
          var appearance = {
            variables: {
              colorPrimary: '#2563eb',
              fontFamily: 'Inter, system-ui, sans-serif',
              borderRadius: '12px'
            }
          };
          mount.hidden = false;
          activateSingleClerkLayout();
          if (mode === 'signUp' && typeof window.Clerk.mountSignUp === 'function') {
            window.Clerk.mountSignUp(mount, { afterSignUpUrl: '/onboarding/', afterSignInUrl: '/dashboard/', appearance: appearance });
          } else if (typeof window.Clerk.mountSignIn === 'function') {
            window.Clerk.mountSignIn(mount, { afterSignInUrl: '/dashboard/', afterSignUpUrl: '/onboarding/', appearance: appearance });
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
