/* Note Pad page shell: header auth/logout + ConvexNotes bridge to /api/notepad. */
(function () {
  'use strict';

  function goToLogin() {
    window.location.replace('/login/?next=' + encodeURIComponent(window.location.pathname || '/dashboard/notepad/'));
  }

  function wireChrome(user) {
    var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || '');
    var initialEl = document.getElementById('dash-initial');
    if (initialEl) {
      var img = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
      if (img) {
        var el = document.createElement('img');
        el.src = img;
        el.alt = '';
        el.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        initialEl.textContent = '';
        initialEl.appendChild(el);
      } else {
        initialEl.textContent = (name.charAt(0) || '?').toUpperCase();
      }
    }
    var profileNameEl = document.getElementById('dash-profile-name') || document.querySelector('.dash-profile-btn span:last-child');
    if (profileNameEl && name) {
      profileNameEl.textContent = name;
    }
  }

  // Bridge for notepad.js cloud sync via QuantalFlow's authenticated /api/notepad endpoint.
  window.ConvexNotes = {
    isAvailable: function () {
      return true;
    },
    load: function () {
      return fetch('/api/notepad', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (res) {
          if (res.status === 401) { goToLogin(); return null; }
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (data) {
          if (!data || !Array.isArray(data.notes)) return null;
          return data.notes;
        })
        .catch(function () {
          return null;
        });
    },
    save: function (notes, opts) {
      var req = {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: Array.isArray(notes) ? notes : [] })
      };
      if (opts && opts.keepalive) req.keepalive = true;
      return fetch('/api/notepad', req).then(function (res) {
        if (res.status === 401) { goToLogin(); throw new Error('Not authenticated'); }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
    }
  };

  function bootChrome() {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) { goToLogin(); return null; }
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && data.user) wireChrome(data.user);
      })
      .catch(function () {});

    var logout = document.getElementById('logout');
    if (logout) {
      logout.addEventListener('click', function () {
        logout.disabled = true;
        logout.textContent = 'Logging out\u2026';
        var done = function () {
          try {
            Object.keys(localStorage).forEach(function (k) {
              if (k.indexOf('quantalflow_') === 0 || k === 'co_notepad_notes_v1') localStorage.removeItem(k);
            });
            sessionStorage.clear();
          } catch (e) {}
          goToLogin();
        };
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(done, done);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootChrome);
  } else {
    bootChrome();
  }
})();
