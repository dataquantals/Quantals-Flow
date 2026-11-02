/* ==========================================================================
   Login page — talks to the real /api/auth endpoints.
   The password is verified server-side; nothing here can be bypassed by
   editing the page.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('login-form');
  if (!form) return;

  var emailInput = document.getElementById('login-email');
  var passInput = document.getElementById('login-password');
  var msg = document.getElementById('login-msg');
  var submit = document.getElementById('login-submit');
  var toggle = document.getElementById('toggle-pass');

  var setMsg = function (text, state) {
    msg.textContent = text || '';
    msg.className = 'auth__msg' + (state ? ' is-' + state : '');
  };

  /* ---------- Where to land after a successful login ----------
     The server sends unauthenticated /dashboard/ visitors here with
     ?next=/dashboard/ so the deep link survives the round trip. Only
     same-origin relative paths are honoured — an absolute URL or a
     protocol-relative //host value would turn this into an open redirect. */
  var nextTarget = (function () {
    var raw = new URLSearchParams(window.location.search).get('next');
    if (!raw || raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.charAt(1) === '\\') {
      return '/dashboard/';
    }
    // Reject anything that parses to a different origin.
    try {
      if (new URL(raw, window.location.origin).origin !== window.location.origin) return '/dashboard/';
    } catch (e) {
      return '/dashboard/';
    }
    return raw;
  })();

  var setBusy = function (busy) {
    submit.disabled = busy;
    submit.textContent = busy ? 'Logging in…' : 'Log in';
  };

  /* ---------- Show / hide password ---------- */
  if (toggle && passInput) {
    toggle.addEventListener('click', function () {
      var show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }

  /* ---------- Already signed in? Skip the form. ---------- */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (data && data.user) window.location.replace(nextTarget);
    })
    .catch(function () { /* offline: let them try to log in */ });

  /* ---------- Submit ---------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setMsg('');

    var email = (emailInput.value || '').trim();
    var password = passInput.value || '';

    if (!email) {
      setMsg('Please enter your email address.', 'error');
      emailInput.focus();
      return;
    }
    if (!password) {
      setMsg('Please enter your password.', 'error');
      passInput.focus();
      return;
    }

    setBusy(true);

    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        setBusy(false);
        setMsg(data.error || 'Incorrect email or password.', 'error');
        passInput.value = '';
        passInput.focus();
        return;
      }

      setMsg('Success — redirecting…', 'ok');
      submit.textContent = 'Redirecting…';
      if (window.SaveState) window.SaveState.clear(form);
      window.location.assign(nextTarget);
    } catch (err) {
      setBusy(false);
      setMsg('We could not reach the server. Please try again.', 'error');
    }
  });

  /* ---------- Clear the error as the user corrects it ---------- */
  [emailInput, passInput].forEach(function (el) {
    el.addEventListener('input', function () {
      if (msg.classList.contains('is-error')) setMsg('');
    });
  });
})();
