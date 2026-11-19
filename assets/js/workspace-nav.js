/* Mobile workspace navigation drawer (hamburger menu).
   Shared across dashboard, quotation, invoice, notepad, and files pages. */
(function () {
  'use strict';

  var MOBILE_MQ = '(max-width: 960px)';

  function initWorkspaceNav() {
    var sidebar = document.querySelector('.dash-sidebar');
    var topbar = document.querySelector('.dash-top');
    if (!sidebar || !topbar) return;

    if (!sidebar.id) sidebar.id = 'dash-sidebar';

    // Ensure hamburger button exists in the topbar left group
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

    // Ensure mobile drawer header (logo + close button) exists inside sidebar
    var drawerHead = sidebar.querySelector('.dash-sidebar__mobile-head');
    if (!drawerHead) {
      drawerHead = document.createElement('div');
      drawerHead.className = 'dash-sidebar__mobile-head';
      drawerHead.innerHTML =
        '<a class="logo" href="/" aria-label="QuantalFlow home">' +
          '<img class="logo__mark" src="/assets/img/logo.png" width="26" height="26" alt="" />' +
          '<span class="logo__word">QuantalFlow</span>' +
        '</a>' +
        '<button type="button" class="dash-sidebar__close" aria-label="Close navigation menu">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
            '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '<line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>';
      sidebar.insertBefore(drawerHead, sidebar.firstChild);
    }

    // Ensure backdrop overlay exists
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
      backdrop.classList.add('is-visible');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close navigation menu');
      document.body.classList.add('dash-drawer-locked');
      if (closeBtn) closeBtn.focus();
    }

    function closeDrawer(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      sidebar.classList.remove('is-drawer-open');
      backdrop.classList.remove('is-visible');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open navigation menu');
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
      var item = e.target.closest('.dash-nav__item, .dash-sidebar__create');
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
