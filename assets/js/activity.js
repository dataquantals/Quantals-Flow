/* ==========================================================================
   Activity Log — Read-Only UI Controller (`assets/js/activity.js`)
   ========================================================================== */
(function () {
  'use strict';

  var state = {
    q: '',
    actionType: 'all',
    actorId: 'all',
    from: '',
    to: '',
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    isAdmin: false,
    items: [],
    selectedId: null
  };

  var els = {
    search: document.getElementById('act-search'),
    from: document.getElementById('act-from'),
    to: document.getElementById('act-to'),
    action: document.getElementById('act-action'),
    actorWrap: document.getElementById('act-actor-wrap'),
    actor: document.getElementById('act-actor'),
    clearBtn: document.getElementById('act-clear'),
    exportBtn: document.getElementById('act-export'),
    scopeBadge: document.getElementById('act-scope-badge'),
    tbody: document.getElementById('act-tbody'),
    empty: document.getElementById('act-empty'),
    emptyReset: document.getElementById('act-empty-reset'),
    tableWrap: document.getElementById('act-table-wrap'),
    pagerInfo: document.getElementById('act-pager-info'),
    prevBtn: document.getElementById('act-prev'),
    nextBtn: document.getElementById('act-next'),
    pageNum: document.getElementById('act-page-num'),
    drawerBackdrop: document.getElementById('act-drawer-backdrop'),
    drawerClose: document.getElementById('act-drawer-close'),
    drawerBadge: document.getElementById('act-drawer-badge'),
    drawerTitle: document.getElementById('act-drawer-title'),
    drawerId: document.getElementById('act-drawer-id'),
    drawerBody: document.getElementById('act-drawer-body')
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function initials(name) {
    var parts = String(name || 'S').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name || 'S').slice(0, 2).toUpperCase();
  }

  function relativeTime(ts) {
    var diff = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
    if (diff < 10) return 'Just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function formatExactTime(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return String(ts);
    }
  }

  function buildQueryString(includePage) {
    var params = new URLSearchParams();
    if (state.q.trim()) params.set('q', state.q.trim());
    if (state.actionType && state.actionType !== 'all') params.set('actionType', state.actionType);
    if (state.isAdmin && state.actorId && state.actorId !== 'all') params.set('actorId', state.actorId);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    if (includePage) {
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
    }
    return params.toString();
  }

  function renderSkeletons() {
    els.empty.hidden = true;
    els.tableWrap.hidden = false;
    var rows = [];
    for (var i = 0; i < 6; i++) {
      rows.push(
        '<tr class="act-skel-row" aria-hidden="true">' +
          '<td><div class="act-skel act-skel--md"></div></td>' +
          '<td><div class="act-skel act-skel--md"></div></td>' +
          '<td><div class="act-skel act-skel--sm"></div></td>' +
          '<td><div class="act-skel act-skel--lg"></div></td>' +
          '<td><div class="act-skel act-skel--md"></div></td>' +
        '</tr>'
      );
    }
    els.tbody.innerHTML = rows.join('');
  }

  function renderTable() {
    if (!state.items.length) {
      els.tableWrap.hidden = true;
      els.empty.hidden = false;
      els.tbody.innerHTML = '';
      renderPager();
      return;
    }
    els.tableWrap.hidden = false;
    els.empty.hidden = true;

    els.tbody.innerHTML = state.items.map(function (item) {
      var isSys = item.actor_id === 'System';
      var avatarHtml = isSys
        ? '<span class="act-avatar act-avatar--system" aria-hidden="true">SYS</span>'
        : item.actor_avatar
          ? '<span class="act-avatar"><img src="' + esc(item.actor_avatar) + '" alt="" /></span>'
          : '<span class="act-avatar" aria-hidden="true">' + esc(initials(item.actor_name)) + '</span>';

      var target = item.target_resource || {};
      var targetHtml = target.link
        ? '<a class="act-target-link" href="' + esc(target.link) + '" onclick="event.stopPropagation()">' +
            '<span>' + esc(target.name || target.id || target.link) + '</span>' +
          '</a>'
        : '<span class="act-target-plain">' + esc(target.name || target.id || '—') + '</span>';

      return (
        '<tr tabindex="0" data-act-id="' + esc(item.id) + '"' + (state.selectedId === item.id ? ' class="is-selected"' : '') + '>' +
          '<td class="act-time">' +
            '<span class="act-time__rel">' + esc(relativeTime(item.timestamp)) + '</span>' +
            '<span class="act-time__abs">' + esc(formatExactTime(item.timestamp)) + '</span>' +
          '</td>' +
          '<td>' +
            '<div class="act-actor">' +
              avatarHtml +
              '<div>' +
                '<span class="act-actor__name">' + esc(item.actor_name) + '</span>' +
                (item.actor_email ? '<span class="act-actor__sub">' + esc(item.actor_email) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><span class="act-badge act-badge--' + esc(item.action_type) + '">' + esc(item.action_type) + '</span></td>' +
          '<td class="act-desc">' + esc(item.description) + '</td>' +
          '<td>' + targetHtml + '</td>' +
        '</tr>'
      );
    }).join('');

    renderPager();
  }

  function renderPager() {
    var start = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    var end = Math.min(state.total, state.page * state.pageSize);
    els.pagerInfo.textContent = state.total === 0
      ? '0 events'
      : 'Showing ' + start + '–' + end + ' of ' + state.total + ' events';
    els.pageNum.textContent = 'Page ' + state.page + ' of ' + state.totalPages;
    els.prevBtn.disabled = state.page <= 1;
    els.nextBtn.disabled = state.page >= state.totalPages;
  }

  function populateActors(actors) {
    if (!state.isAdmin) {
      els.actorWrap.hidden = true;
      return;
    }
    els.actorWrap.hidden = false;
    var cur = state.actorId;
    var html = '<option value="all">All Users &amp; System</option>';
    (actors || []).forEach(function (a) {
      var label = a.name + (a.email ? ' (' + a.email + ')' : '');
      html += '<option value="' + esc(a.id) + '">' + esc(label) + '</option>';
    });
    els.actor.innerHTML = html;
    els.actor.value = cur;
  }

  function renderBeforeAfter(meta) {
    var before = meta && meta.before && typeof meta.before === 'object' ? meta.before : null;
    var after = meta && meta.after && typeof meta.after === 'object' ? meta.after : null;
    if (!before && !after) return '';

    var keys = Array.from(new Set(
      (before ? Object.keys(before) : []).concat(after ? Object.keys(after) : [])
    ));
    if (!keys.length) return '';

    var rows = keys.map(function (k) {
      var bVal = before && before[k] !== undefined ? JSON.stringify(before[k]) : '—';
      var aVal = after && after[k] !== undefined ? JSON.stringify(after[k]) : '—';
      return (
        '<div class="act-diff__row">' +
          '<div class="act-diff__cell"><strong>' + esc(k) + '</strong></div>' +
          '<div class="act-diff__cell act-diff__before">' + esc(bVal) + '</div>' +
          '<div class="act-diff__cell act-diff__after">' + esc(aVal) + '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<section class="act-sec">' +
        '<h4>Before &amp; After Changes</h4>' +
        '<div class="act-diff">' +
          '<div class="act-diff__row act-diff__row--head">' +
            '<div class="act-diff__cell">Field</div>' +
            '<div class="act-diff__cell">Before</div>' +
            '<div class="act-diff__cell">After</div>' +
          '</div>' +
          rows +
        '</div>' +
      '</section>'
    );
  }

  function openDrawer(item) {
    if (!item) return;
    state.selectedId = item.id;
    renderTable();

    els.drawerBadge.className = 'act-badge act-badge--' + item.action_type;
    els.drawerBadge.textContent = item.action_type;
    els.drawerTitle.textContent = item.description;
    els.drawerId.textContent = item.id + ' · ' + formatExactTime(item.timestamp);

    var target = item.target_resource || {};
    var meta = item.metadata || {};
    var rawJson = JSON.stringify(meta, null, 2);

    els.drawerBody.innerHTML =
      '<section class="act-sec">' +
        '<h4>Event Summary</h4>' +
        '<div class="act-kv-grid">' +
          '<div class="act-kv-box"><span>Actor</span><strong>' + esc(item.actor_name) + (item.actor_email ? '<br><small style="font-weight:400;color:#64748b">' + esc(item.actor_email) + '</small>' : '') + '</strong></div>' +
          '<div class="act-kv-box"><span>Target Resource</span><strong>' +
            (target.link ? '<a href="' + esc(target.link) + '" style="color:#2563eb;text-decoration:none">' + esc(target.name || target.link) + ' &rarr;</a>' : esc(target.name || target.id || '—')) +
          '</strong></div>' +
          '<div class="act-kv-box"><span>IP Address</span><strong>' + esc(meta.ip || '—') + '</strong></div>' +
          '<div class="act-kv-box"><span>Device / Client</span><strong>' + esc(meta.device || '—') + '</strong></div>' +
        '</div>' +
      '</section>' +
      renderBeforeAfter(meta) +
      '<section class="act-sec">' +
        '<h4><span>Raw Metadata (JSON)</span><button type="button" class="btn btn--ghost" id="act-copy-json" style="height:28px;padding:0 10px;font-size:12px">Copy JSON</button></h4>' +
        '<pre class="act-json"><code>' + esc(rawJson) + '</code></pre>' +
      '</section>';

    var copyBtn = document.getElementById('act-copy-json');
    if (copyBtn) {
      copyBtn.onclick = function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(rawJson).then(function () {
            copyBtn.textContent = 'Copied ✓';
            setTimeout(function () { copyBtn.textContent = 'Copy JSON'; }, 1500);
          });
        }
      };
    }

    els.drawerBackdrop.classList.add('is-open');
    els.drawerBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    state.selectedId = null;
    els.drawerBackdrop.classList.remove('is-open');
    els.drawerBackdrop.setAttribute('aria-hidden', 'true');
    var rows = els.tbody.querySelectorAll('tr.is-selected');
    rows.forEach(function (r) { r.classList.remove('is-selected'); });
  }

  function loadLogs() {
    renderSkeletons();
    fetch('/api/activity?' + buildQueryString(true), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname);
          return null;
        }
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        state.items = data.items || [];
        state.total = data.total || 0;
        state.page = data.page || 1;
        state.totalPages = data.totalPages || 1;
        state.isAdmin = Boolean(data.isAdmin);
        els.scopeBadge.textContent = state.isAdmin ? 'All System Activity (Admin)' : 'My Activity Only';
        els.scopeBadge.className = 'act-pill' + (state.isAdmin ? ' act-pill--admin' : '');
        populateActors(data.actors || []);
        renderTable();
      })
      .catch(function () {
        state.items = [];
        state.total = 0;
        renderTable();
      });
  }

  function loadProfileHeader() {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.user) return;
        var nameEl = document.getElementById('dash-profile-name');
        var initEl = document.getElementById('dash-initial');
        if (nameEl) nameEl.textContent = d.user.name || d.user.email || 'Profile';
        if (initEl) initEl.textContent = initials(d.user.name || d.user.email);
      })
      .catch(function () {});
  }

  // Event Wiring
  var searchTimer = null;
  els.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = els.search.value;
      state.page = 1;
      loadLogs();
    }, 240);
  });

  els.from.addEventListener('change', function () { state.from = els.from.value; state.page = 1; loadLogs(); });
  els.to.addEventListener('change', function () { state.to = els.to.value; state.page = 1; loadLogs(); });
  els.action.addEventListener('change', function () { state.actionType = els.action.value; state.page = 1; loadLogs(); });
  els.actor.addEventListener('change', function () { state.actorId = els.actor.value; state.page = 1; loadLogs(); });

  function resetFilters() {
    state.q = '';
    state.actionType = 'all';
    state.actorId = 'all';
    state.from = '';
    state.to = '';
    state.page = 1;
    els.search.value = '';
    els.from.value = '';
    els.to.value = '';
    els.action.value = 'all';
    els.actor.value = 'all';
    loadLogs();
  }

  els.clearBtn.addEventListener('click', resetFilters);
  els.emptyReset.addEventListener('click', resetFilters);

  els.exportBtn.addEventListener('click', function () {
    window.location.href = '/api/activity/export?' + buildQueryString(false);
  });

  els.prevBtn.addEventListener('click', function () {
    if (state.page > 1) { state.page -= 1; loadLogs(); }
  });
  els.nextBtn.addEventListener('click', function () {
    if (state.page < state.totalPages) { state.page += 1; loadLogs(); }
  });

  els.tbody.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var row = e.target.closest('tr[data-act-id]');
    if (!row) return;
    var id = row.getAttribute('data-act-id');
    var found = state.items.find(function (it) { return it.id === id; });
    if (found) openDrawer(found);
  });

  els.tbody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('tr[data-act-id]');
    if (!row) return;
    e.preventDefault();
    var id = row.getAttribute('data-act-id');
    var found = state.items.find(function (it) { return it.id === id; });
    if (found) openDrawer(found);
  });

  els.drawerClose.addEventListener('click', closeDrawer);
  els.drawerBackdrop.addEventListener('click', function (e) {
    if (e.target === els.drawerBackdrop) closeDrawer();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && els.drawerBackdrop.classList.contains('is-open')) closeDrawer();
  });

  loadProfileHeader();
  loadLogs();
})();
