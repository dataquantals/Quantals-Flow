/* Mobile workspace navigation drawer (hamburger menu) & pinned profile footer.
   Shared across dashboard, quotation, invoice, notepad, and files pages. */
(function () {
  'use strict';

  var MOBILE_MQ = '(max-width: 960px)';

  function renderUserInFooter(user, footer) {
    if (!user || !footer) return;
    var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || 'Account');
    var role = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Member';
    var imgUrl = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar || '';

    var avEl = footer.querySelector('.dash-drawer-user__avatar');
    var nameEl = footer.querySelector('.dash-drawer-user__name');
    var roleEl = footer.querySelector('.dash-drawer-user__role');

    if (avEl) {
      if (imgUrl) {
        avEl.textContent = '';
        var img = document.createElement('img');
        img.src = imgUrl;
        img.alt = '';
        avEl.appendChild(img);
      } else {
        avEl.textContent = (name.charAt(0) || 'U').toUpperCase();
      }
    }
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
  }

  function hydrateFooterUser(footer) {
    if (window.__qfUser) {
      renderUserInFooter(window.__qfUser, footer);
      return;
    }
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.user) {
          window.__qfUser = data.user;
          renderUserInFooter(data.user, footer);
        }
      })
      .catch(function () {});
  }

  var WORKSPACE_CHILD_LABELS = [
    'whiteboarding',
    'project planning',
    'mind map',
    'kanban board',
    'perspective',
    'brainstorm',
    'document generation'
  ];

  function initWorkspacesDropdown(sidebar) {
    if (!sidebar) return;
    var navEl = sidebar.querySelector('.dash-nav');
    if (!navEl || navEl.querySelector('.dash-nav-group[data-ws-group="workspaces-pages"]')) return;

    var labels = Array.prototype.slice.call(navEl.querySelectorAll('.dash-sidebar__section-label'));
    var wsLabel = null;
    for (var i = 0; i < labels.length; i += 1) {
      if ((labels[i].textContent || '').trim().toLowerCase() === 'workspaces & pages') {
        wsLabel = labels[i];
        break;
      }
    }
    if (!wsLabel) return;

    // Collect the exact 7 child links belonging to Workspaces & Pages (leaving Templates outside)
    var foundMap = Object.create(null);
    var node = wsLabel.nextElementSibling;
    while (node && !node.classList.contains('dash-sidebar__section-label')) {
      var next = node.nextElementSibling;
      if (node.tagName === 'A' && node.classList.contains('dash-nav__item')) {
        var text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (WORKSPACE_CHILD_LABELS.indexOf(text) !== -1 && !foundMap[text]) {
          foundMap[text] = node;
        }
      }
      node = next;
    }

    var childLinks = [];
    for (var j = 0; j < WORKSPACE_CHILD_LABELS.length; j += 1) {
      var key = WORKSPACE_CHILD_LABELS[j];
      if (foundMap[key]) childLinks.push(foundMap[key]);
    }
    if (!childLinks.length) return;

    // Build the collapsible dropdown group
    var group = document.createElement('div');
    group.className = 'dash-nav-group';
    group.setAttribute('data-ws-group', 'workspaces-pages');

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dash-nav__item dash-nav-group__trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'dash-ws-children');
    trigger.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polygon points="12 2 2 7 12 12 22 7 12 2"/>' +
        '<polyline points="2 17 12 22 22 17"/>' +
        '<polyline points="2 12 12 17 22 12"/>' +
      '</svg>' +
      '<span class="dash-nav-group__label">Workspaces &amp; Pages</span>' +
      '<span class="dash-nav-group__chevron" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="6 9 12 15 18 9"/>' +
        '</svg>' +
      '</span>';

    var list = document.createElement('div');
    list.className = 'dash-nav-group__list';
    list.id = 'dash-ws-children';
    list.hidden = true;

    wsLabel.parentNode.insertBefore(group, wsLabel);
    wsLabel.remove();
    group.appendChild(trigger);
    group.appendChild(list);

    var hasActiveChild = false;
    childLinks.forEach(function (link) {
      link.classList.add('dash-nav-group__child');
      if (link.classList.contains('is-active')) hasActiveChild = true;
      list.appendChild(link);
    });

    function setInlineExpanded(expanded) {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      group.classList.toggle('is-open', expanded);
      list.hidden = !expanded;
    }

    if (hasActiveChild) {
      trigger.classList.add('has-active-child');
      setInlineExpanded(true);
    }

    // Build floating hover dialog popup mounted on document.body (never clipped by sidebar scroll)
    var existingPopover = document.getElementById('dash-ws-popover');
    if (existingPopover) existingPopover.remove();

    var popover = document.createElement('div');
    popover.id = 'dash-ws-popover';
    popover.className = 'dash-ws-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Workspaces & Pages');
    popover.hidden = true;

    var popHead = document.createElement('div');
    popHead.className = 'dash-ws-popover__head';
    popHead.innerHTML =
      '<span class="dash-ws-popover__title">Workspaces &amp; Pages</span>' +
      '<span class="dash-ws-popover__count">' + childLinks.length + '</span>';

    var popList = document.createElement('div');
    popList.className = 'dash-ws-popover__list';

    var popoverPairs = [];
    childLinks.forEach(function (origLink) {
      var item = document.createElement('a');
      item.className = 'dash-ws-popover__item';
      item.href = origLink.getAttribute('href') || '#';
      if (origLink.hasAttribute('data-create-framework')) {
        item.setAttribute('data-create-framework', origLink.getAttribute('data-create-framework'));
      }
      var svg = origLink.querySelector('svg');
      var labelSpan = origLink.querySelector('span');
      if (svg) item.appendChild(svg.cloneNode(true));
      var textSpan = document.createElement('span');
      textSpan.className = 'dash-ws-popover__item-label';
      textSpan.textContent = labelSpan ? labelSpan.textContent.trim() : (origLink.textContent || '').trim();
      item.appendChild(textSpan);

      item.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        hidePopover(true);
        origLink.click();
      });

      popList.appendChild(item);
      popoverPairs.push({ orig: origLink, item: item });
    });

    popover.appendChild(popHead);
    popover.appendChild(popList);
    document.body.appendChild(popover);

    var closeTimer = null;
    var popoverVisible = false;
    var finePointerMq = window.matchMedia('(hover: hover) and (pointer: fine)');

    function syncPopoverActive() {
      var anyActive = false;
      popoverPairs.forEach(function (pair) {
        var active = pair.orig.classList.contains('is-active');
        pair.item.classList.toggle('is-active', active);
        if (active) anyActive = true;
      });
      trigger.classList.toggle('has-active-child', anyActive);
    }

    function positionPopover() {
      var triggerRect = trigger.getBoundingClientRect();
      var sidebarRect = sidebar.getBoundingClientRect();
      var gap = 10;
      var left = Math.round(sidebarRect.right + gap);
      var popHeight = popover.offsetHeight || 320;
      var popWidth = popover.offsetWidth || 248;

      if (left + popWidth > window.innerWidth - 12) {
        left = Math.max(12, Math.round(triggerRect.right + 8));
      }
      var top = Math.round(triggerRect.top - 8);
      if (top + popHeight > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - popHeight - 12);
      }
      if (top < 12) top = 12;

      popover.style.left = left + 'px';
      popover.style.top = top + 'px';
    }

    function showPopover() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      syncPopoverActive();
      popover.hidden = false;
      positionPopover();
      popoverVisible = true;
      requestAnimationFrame(function () {
        if (popoverVisible) popover.classList.add('is-open');
      });
    }

    function hidePopover(immediate) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (!popoverVisible && popover.hidden) return;
      popoverVisible = false;
      popover.classList.remove('is-open');
      if (immediate) {
        popover.hidden = true;
      } else {
        closeTimer = setTimeout(function () {
          if (!popoverVisible) popover.hidden = true;
          closeTimer = null;
        }, 160);
      }
    }

    function scheduleHidePopover() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        hidePopover(false);
      }, 180);
    }

    trigger.addEventListener('mouseenter', function () {
      if (!finePointerMq.matches) return;
      if (sidebar.classList.contains('is-drawer-open')) return;
      showPopover();
    });

    trigger.addEventListener('mouseleave', function () {
      if (!finePointerMq.matches) return;
      scheduleHidePopover();
    });

    popover.addEventListener('mouseenter', function () {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    });

    popover.addEventListener('mouseleave', function () {
      scheduleHidePopover();
    });

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      var nextExpanded = trigger.getAttribute('aria-expanded') !== 'true';
      hidePopover(true);
      setInlineExpanded(nextExpanded);
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popoverVisible) {
        hidePopover(true);
        trigger.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!popoverVisible) return;
      if (popover.contains(e.target) || trigger.contains(e.target)) return;
      hidePopover(true);
    });

    window.addEventListener('resize', function () {
      if (popoverVisible) positionPopover();
    });
  }

  function initWorkspaceNav() {
    var sidebar = document.querySelector('.dash-sidebar');
    var topbar = document.querySelector('.dash-top');
    if (!sidebar || !topbar) return;

    if (!sidebar.id) sidebar.id = 'dash-sidebar';

    // 1. Ensure hamburger button exists in the sticky top header
    var btn = document.getElementById('dash-menu-toggle') || topbar.querySelector('.dash-hamburger');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'dash-menu-toggle';
      btn.className = 'dash-hamburger';
      btn.setAttribute('aria-label', 'Open navigation menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', sidebar.id);
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<line x1="3" y1="6" x2="21" y2="6"/>' +
          '<line x1="3" y1="12" x2="21" y2="12"/>' +
          '<line x1="3" y1="18" x2="21" y2="18"/>' +
        '</svg>';

      var leftWrap = topbar.querySelector('.dash-top__left');
      if (leftWrap) {
        leftWrap.insertBefore(btn, leftWrap.firstChild);
      } else {
        var logo = topbar.querySelector('.logo');
        leftWrap = document.createElement('div');
        leftWrap.className = 'dash-top__left';
        topbar.insertBefore(leftWrap, topbar.firstChild);
        leftWrap.appendChild(btn);
        if (logo) leftWrap.appendChild(logo);
      }
    }

    // 2. Ensure mobile drawer top header (brand logo + close 'X' button)
    var drawerHead = sidebar.querySelector('.dash-sidebar__mobile-head');
    if (!drawerHead) {
      drawerHead = document.createElement('div');
      drawerHead.className = 'dash-sidebar__mobile-head';
      drawerHead.innerHTML =
        '<a class="logo" href="/" aria-label="QuantalFlow home">' +
          '<img class="logo__mark" src="/assets/img/logo.png" width="28" height="28" alt="" />' +
          '<span class="logo__word">QuantalFlow</span>' +
        '</a>' +
        '<button type="button" class="dash-sidebar__close" aria-label="Close navigation menu">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
            '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '<line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>';
      sidebar.insertBefore(drawerHead, sidebar.firstChild);
    }

    // 3. Ensure "Main" category label sits above primary links when grouped
    var navEl = sidebar.querySelector('.dash-nav');
    if (navEl && navEl.children.length > 5 && !navEl.firstElementChild.classList.contains('dash-sidebar__section-label')) {
      var mainLabel = document.createElement('div');
      mainLabel.className = 'dash-sidebar__section-label dash-sidebar__section-label--first';
      mainLabel.textContent = 'Main';
      navEl.insertBefore(mainLabel, navEl.firstChild);
    }

    // 3b. Convert "Workspaces & Pages" into a dropdown group with hover popup dialog
    initWorkspacesDropdown(sidebar);

    // 4. Wrap scrollable body (CTA + nav) so header & footer stay pinned on mobile
    if (!sidebar.querySelector('.dash-sidebar__scroll')) {
      var scrollWrap = document.createElement('div');
      scrollWrap.className = 'dash-sidebar__scroll';
      var cta = sidebar.querySelector('.dash-sidebar__create');
      if (cta) scrollWrap.appendChild(cta);
      if (navEl) scrollWrap.appendChild(navEl);
      sidebar.appendChild(scrollWrap);
    }

    // 5. Pinned bottom footer: user profile summary + Settings & Log out actions
    var footer = sidebar.querySelector('.dash-sidebar__footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'dash-sidebar__footer';
      footer.innerHTML =
        '<a class="dash-drawer-user" href="/profile/" aria-label="Open profile settings">' +
          '<span class="dash-drawer-user__avatar" aria-hidden="true">&mdash;</span>' +
          '<span class="dash-drawer-user__meta">' +
            '<span class="dash-drawer-user__name">Loading&hellip;</span>' +
            '<span class="dash-drawer-user__role">Workspace</span>' +
          '</span>' +
        '</a>' +
        '<div class="dash-drawer-footer__actions">' +
          '<a class="dash-drawer-footer__btn" href="/profile/" aria-label="Settings">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
            '<span>Settings</span>' +
          '</a>' +
          '<button type="button" class="dash-drawer-footer__btn dash-drawer-footer__btn--logout" aria-label="Log out">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
            '<span>Log out</span>' +
          '</button>' +
        '</div>';
      sidebar.appendChild(footer);
      hydrateFooterUser(footer);

      var drawerLogout = footer.querySelector('.dash-drawer-footer__btn--logout');
      if (drawerLogout) {
        drawerLogout.addEventListener('click', async function () {
          drawerLogout.disabled = true;
          try {
            Object.keys(localStorage).forEach(function (k) {
              if (k.indexOf('quantalflow_') === 0) localStorage.removeItem(k);
            });
            sessionStorage.clear();
            if (window.Clerk && window.Clerk.signOut) await window.Clerk.signOut();
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
          } catch (e) {}
          window.location.replace('/login/');
        });
      }
    }

    // 6. Ensure semi-transparent dark backdrop exists
    var backdrop = document.querySelector('.dash-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'dash-sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    var closeBtn = drawerHead.querySelector('.dash-sidebar__close');
    var isOpen = false;

    function openDrawer() {
      if (isOpen) return;
      isOpen = true;
      sidebar.classList.add('is-drawer-open');
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      backdrop.classList.add('is-visible');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close navigation menu');
      document.documentElement.classList.add('dash-drawer-locked');
      document.body.classList.add('dash-drawer-locked');
      if (closeBtn) closeBtn.focus();
    }

    function closeDrawer(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      sidebar.classList.remove('is-drawer-open');
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      backdrop.classList.remove('is-visible');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open navigation menu');
      document.documentElement.classList.remove('dash-drawer-locked');
      document.body.classList.remove('dash-drawer-locked');
      if (restoreFocus) btn.focus();
    }

    btn.addEventListener('click', function () {
      if (isOpen) closeDrawer(true);
      else openDrawer();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { closeDrawer(true); });
    }

    backdrop.addEventListener('click', function () { closeDrawer(true); });

    sidebar.addEventListener('click', function (e) {
      if (!isOpen) return;
      if (e.target.closest('.dash-nav-group__trigger')) return;
      var item = e.target.closest('.dash-nav__item, .dash-sidebar__create, .dash-drawer-user, .dash-drawer-footer__btn');
      if (item) closeDrawer(false);
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer(true);
      }
    });

    var mq = window.matchMedia(MOBILE_MQ);
    var onMqChange = function (e) {
      if (!e.matches && isOpen) closeDrawer(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onMqChange);
    else if (mq.addListener) mq.addListener(onMqChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkspaceNav);
  } else {
    initWorkspaceNav();
  }
})();
