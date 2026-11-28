/* ==========================================================================
   Global Multi-Tenant Organisation Switcher (`assets/js/org-switcher.js`)
   Mounts into `.dash-top` across every authenticated workspace page so users
   can switch organisations instantly without logging out.
   ========================================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function mountSwitcher() {
    var topbar = document.querySelector('.dash-top');
    if (!topbar || document.getElementById('qf-org-switcher')) return;
    if (/^\/(login|get-started|onboarding)/.test(window.location.pathname)) return;

    fetch('/api/orgs', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return;
        window.__qfOrgContext = data;

        var wrap = document.createElement('div');
        wrap.id = 'qf-org-switcher';
        wrap.className = 'qf-org-sw';

        var active = data.activeOrg;
        var orgs = data.organizations || [];
        var label = active ? active.name : 'Create Organisation';
        var badge = active && active.logoUrl
          ? '<span class="qf-org-sw__badge"><img src="' + esc(active.logoUrl) + '" alt="" /></span>'
          : '<span class="qf-org-sw__badge">' + esc((label || 'O').charAt(0).toUpperCase()) + '</span>';

        wrap.innerHTML =
          '<button type="button" class="qf-org-sw__btn" id="qf-org-sw-btn" aria-haspopup="menu" aria-expanded="false" title="Switch Organisation">' +
            badge +
            '<span class="qf-org-sw__name">' + esc(label) + '</span>' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="qf-org-sw__menu" id="qf-org-sw-menu" role="menu" hidden></div>';

        var menu = wrap.querySelector('#qf-org-sw-menu');
        var btn = wrap.querySelector('#qf-org-sw-btn');

        var itemsHtml = '<div class="qf-org-sw__hdr">Organisations</div>';
        if (orgs.length) {
          itemsHtml += orgs.map(function (o) {
            var isAct = active && o.id === active.id;
            return '<button type="button" class="qf-org-sw__item' + (isAct ? ' is-active' : '') + '" data-switch-org="' + esc(o.id) + '" role="menuitem">' +
              '<span class="qf-org-sw__badge">' + esc(o.name.charAt(0).toUpperCase()) + '</span>' +
              '<span class="qf-org-sw__name">' + esc(o.name) + '</span>' +
              '<span class="qf-org-sw__role">' + esc(o.role || 'MEMBER') + '</span>' +
            '</button>';
          }).join('');
        } else {
          itemsHtml += '<div style="padding:8px 10px;font-size:12.5px;color:#64748b">No organisation yet.</div>';
        }
        itemsHtml +=
          '<div class="qf-org-sw__div"></div>' +
          '<a class="qf-org-sw__item" href="/dashboard/people/" role="menuitem"><span>People &amp; Teams</span></a>' +
          '<a class="qf-org-sw__item" href="/onboarding/" role="menuitem" style="color:#2563eb;font-weight:600"><span>+ Create New Organisation</span></a>';
        menu.innerHTML = itemsHtml;

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = menu.hidden;
          menu.hidden = !open;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        menu.addEventListener('click', function (e) {
          var item = e.target.closest('[data-switch-org]');
          if (!item) return;
          var orgId = item.getAttribute('data-switch-org');
          if (active && orgId === active.id) { menu.hidden = true; return; }
          fetch('/api/orgs/switch', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: orgId })
          })
            .then(function (r) { if (r.ok) window.location.reload(); });
        });

        document.addEventListener('click', function (e) {
          if (!wrap.contains(e.target)) {
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
          }
        });

        var topRight = topbar.querySelector('.dash-top__right');
        if (topRight) {
          topRight.insertBefore(wrap, topRight.firstChild);
        } else {
          topbar.appendChild(wrap);
        }
      })
      .catch(function () {});

    // Hydrate topbar Profile avatar & name on every workspace page consistently
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.user) return;
        var u = d.user;
        var name = (u.name && u.name.trim()) ? u.name.trim() : (u.email || 'Profile');
        var nameEl = document.getElementById('dash-profile-name');
        var initEl = document.getElementById('dash-initial');
        if (nameEl && (nameEl.textContent === 'Profile' || !nameEl.textContent.trim())) {
          nameEl.textContent = name;
        }
        if (initEl) {
          var imgUrl = u.avatar_url || u.avatarUrl || u.imageUrl || '';
          if (imgUrl && !initEl.querySelector('img')) {
            initEl.textContent = '';
            var img = document.createElement('img');
            img.src = imgUrl;
            img.alt = '';
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
            initEl.appendChild(img);
          } else if (!initEl.querySelector('img')) {
            initEl.textContent = name.charAt(0).toUpperCase();
          }
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountSwitcher);
  else mountSwitcher();
})();
