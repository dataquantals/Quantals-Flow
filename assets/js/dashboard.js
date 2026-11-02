/* ==========================================================================
   Dashboard — Workspace Hub & Hierarchical Client Router
   - Authenticates user session via /api/auth/me
   - Hierarchical sub-routes:
       /dashboard/                      -> All Boards
       /dashboard/starred/              -> Starred Boards
       /dashboard/space/ai-strategy/    -> AI & Product Strategy
       /dashboard/space/engineering/    -> Engineering & Delivery
       /dashboard/space/ux-discovery/   -> UX & Discovery
   - Generates clean hierarchical board routes:
       /app/<slug>/<code>/<template>    (e.g. /app/assap/002c5f/mindmap)
       /app/<boardId>                   (e.g. /app/q4-intelligent-canvas)
   ========================================================================== */
(function () {
  'use strict';

  var allBoards = [];
  var activeFilter = 'all';
  var searchQuery = '';

  var SPACE_ROUTE_MAP = {
    'all': '/dashboard/',
    'starred': '/dashboard/starred/',
    'AI & Product Strategy': '/dashboard/space/ai-strategy/',
    'Engineering & Delivery': '/dashboard/space/engineering/',
    'UX & Discovery': '/dashboard/space/ux-discovery/'
  };

  function parseDashboardRoute(pathname) {
    var clean = String(pathname || '/dashboard/').replace(/\/+$/, '');
    if (clean === '/dashboard/starred') return 'starred';
    if (clean === '/dashboard/space/ai-strategy') return 'AI & Product Strategy';
    if (clean === '/dashboard/space/engineering') return 'Engineering & Delivery';
    if (clean === '/dashboard/space/ux-discovery') return 'UX & Discovery';
    return 'all';
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function buildBoardPath(id, template, title) {
    var cleanId = String(id || 'q4-intelligent-canvas').trim();
    var tpl = template ? '/' + encodeURIComponent(template) : '';

    // Readable URLs win: /app/data-quantals-plan rather than /app/<slug>/<code>.
    var slug = slugify(title);
    if (slug) return '/app/' + encodeURIComponent(slug) + tpl;

    var tokenMatch = cleanId.match(/^(.+)-([0-9a-f]{6})$/i);
    if (tokenMatch) {
      return '/app/' + encodeURIComponent(tokenMatch[1]) + '/' + encodeURIComponent(tokenMatch[2]) + tpl;
    }
    return '/app/' + encodeURIComponent(cleanId) + tpl;
  }

  function goToLogin() {
    var currentPath = window.location.pathname || '/dashboard/';
    window.location.replace('/login/?next=' + encodeURIComponent(currentPath));
  }

  function timeAgo(ts) {
    var diffSec = Math.max(1, Math.floor((Date.now() - (ts || Date.now())) / 1000));
    if (diffSec < 60) return 'Edited just now';
    var m = Math.floor(diffSec / 60);
    if (m < 60) return 'Edited ' + m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return 'Edited ' + h + 'h ago';
    return 'Edited ' + Math.floor(h / 24) + 'd ago';
  }

  /* ---------- Card tints ----------
     Every board card gets its own colour, assigned automatically: the hue is
     derived from a hash of the board id, so a board keeps the same colour
     across reloads, filters and searches, and a board created later gets one
     with no extra bookkeeping. When two boards hash to the same hue the later
     one walks to the next free slot, so a visible grid never shows the same
     colour twice. The map is built from the full board list (not the filtered
     one) so switching space or searching cannot shuffle anyone's colour. */
  var CARD_HUES = [210, 245, 275, 305, 335, 8, 32, 78, 148, 180];

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function buildTintMap(boards) {
    var map = {};
    var taken = {};
    var count = CARD_HUES.length;
    (boards || []).forEach(function (b) {
      var slot = hashString(String(b.id || b.title || '')) % count;
      for (var step = 0; step < count && taken[slot]; step++) {
        slot = (slot + 1) % count;
      }
      taken[slot] = true;
      map[b.id] = CARD_HUES[slot];
    });
    return map;
  }

  function applyFilterState(filterName, pushHistoryEntry) {
    activeFilter = filterName || 'all';
    document.querySelectorAll('.dash-nav__item[data-filter]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.filter === activeFilter);
    });

    var heading = document.getElementById('dash-boards-heading');
    if (heading) {
      heading.textContent = activeFilter === 'all'
        ? 'Boards in this workspace'
        : activeFilter === 'starred'
          ? 'Starred boards'
          : activeFilter;
    }

    document.title = (activeFilter === 'all' ? 'Dashboard' : activeFilter) + ' | QuantalFlow';

    var targetUrl = SPACE_ROUTE_MAP[activeFilter] || '/dashboard/';
    if (pushHistoryEntry && window.history && window.history.pushState && window.location.pathname !== targetUrl) {
      window.history.pushState({ filter: activeFilter }, '', targetUrl);
    }

    renderBoards();
  }

  function renderBoards() {
    var grid = document.getElementById('dash-boards-grid');
    if (!grid) return;

    var filtered = allBoards.filter(function (b) {
      if (activeFilter === 'starred' && !b.starred) return false;
      if (activeFilter !== 'all' && activeFilter !== 'starred' && b.category !== activeFilter) return false;
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        return (b.title || '').toLowerCase().indexOf(q) !== -1 ||
               (b.category || '').toLowerCase().indexOf(q) !== -1;
      }
      return true;
    });

    var countEl = document.getElementById('dash-board-count');
    var starCountEl = document.getElementById('dash-starred-count');
    if (countEl) countEl.textContent = String(allBoards.length);
    if (starCountEl) starCountEl.textContent = String(allBoards.filter(function (b) { return b.starred; }).length);

    /* The sidebar shortcut always opens the dedicated blank Project Planning
       workspace (`project-planning-workspace`), never whichever demo-filled
       board happens to be newest. The static href already points at that route
       so it still resolves if the board row is missing; preferring the exact id
       keeps the shortcut deterministic once the row exists. */
    var ppNav = document.getElementById('nav-project-planning');
    if (ppNav) {
      var BLANK_PP_ID = 'project-planning-workspace';
      var ppBoard = null;
      for (var pp = 0; pp < allBoards.length; pp++) {
        if (String(allBoards[pp].id || '') === BLANK_PP_ID) { ppBoard = allBoards[pp]; break; }
      }
      ppNav.setAttribute('href', ppBoard ? buildBoardPath(ppBoard.id, '') : '/app/' + BLANK_PP_ID);
    }

    var html =
      '<a class="dash-card dash-card--new" href="/app/" id="card-new-blank">' +
        '<span class="dash-card__plus" aria-hidden="true">+</span>' +
        '<p class="dash-card__new-title"><span>Start New</span><span>Collaborative Board</span></p>' +
      '</a>';
    var tintMap = buildTintMap(allBoards);

    filtered.forEach(function (b) {
      var starClass = b.starred ? 'is-starred' : '';
      var boardHref = buildBoardPath(b.id, '', b.title);
      html +=
        '<div class="dash-card dash-card--interactive dash-card--tinted" data-board-id="' + b.id + '" style="--dash-tint:' + (tintMap[b.id] || CARD_HUES[0]) + '">' +
          '<div class="dash-card__actions">' +
            '<button class="dash-icon-btn ' + starClass + '" data-star-id="' + b.id + '" type="button" title="Star board" aria-label="Star board">&#9733;</button>' +
            '<button class="dash-icon-btn dash-icon-btn--del" data-del-id="' + b.id + '" type="button" title="Delete board" aria-label="Delete board">&times;</button>' +
          '</div>' +
          '<a class="dash-card__link" href="' + boardHref + '">' +
            '<p>' + b.title + '</p>' +
            '<span class="dash-card__meta">' + timeAgo(b.updatedAt) + ' &bull; Open in App &rarr;</span>' +
          '</a>' +
        '</div>';
    });

    grid.innerHTML = html;

    var newBlankBtn = document.getElementById('card-new-blank');
    if (newBlankBtn) {
      newBlankBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openCreateBoardModal('New Collaborative Board', 'AI & Product Strategy');
      });
    }

    grid.querySelectorAll('[data-star-id]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.dataset.starId;
        var board = allBoards.find(function (item) { return item.id === id; });
        if (!board) return;
        board.starred = !board.starred;
        renderBoards();
        await fetch('/api/boards/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ starred: board.starred })
        });
      });
    });

    grid.querySelectorAll('[data-del-id]').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.dataset.delId;
        var board = allBoards.find(function (item) { return item.id === id; });
        var label = board ? '“' + board.title + '”' : 'this board';
        if (!confirm('Delete ' + label + ' from your workspace?\n\nIts plan and Convex records are removed too.')) return;

        var removed = allBoards.slice();
        allBoards = allBoards.filter(function (item) { return item.id !== id; });
        renderBoards();

        try {
          var res = await fetch('/api/boards/' + encodeURIComponent(id), { method: 'DELETE' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json().catch(function () { return {}; });
          if (!data.ok) throw new Error('Delete rejected');
          if (data.convexSynced === false) {
            console.warn('[dashboard] board removed locally but Convex mirror failed for', id);
          }
        } catch (err) {
          // Put the card back rather than showing a delete that did not happen.
          allBoards = removed;
          renderBoards();
          alert('Could not delete that board. Please try again.');
        }
      });
    });
  }

  async function loadBoards() {
    try {
      var res = await fetch('/api/boards');
      if (res.ok) {
        var data = await res.json();
        allBoards = data.boards || [];
        applyFilterState(parseDashboardRoute(window.location.pathname), false);
      }
    } catch (e) {}
  }

  var createModal = document.getElementById('modal-create-board');
  var newBoardTitleInput = document.getElementById('new-board-title');
  var newBoardSpaceSelect = document.getElementById('new-board-space');

  function closeCreateBoardModal() {
    if (!createModal) return;
    createModal.hidden = true;
    createModal.classList.remove('is-open');
    createModal.style.display = 'none';
  }

  function openCreateBoardModal(defaultTitle, defaultCategory) {
    if (!createModal) {
      createNewBoard(defaultTitle || 'New Collaborative Board', defaultCategory || 'AI & Product Strategy');
      return;
    }
    if (newBoardTitleInput) {
      newBoardTitleInput.value = defaultTitle || 'New Collaborative Board';
    }
    if (newBoardSpaceSelect && defaultCategory) {
      newBoardSpaceSelect.value = defaultCategory;
    }
    createModal.hidden = false;
    createModal.classList.add('is-open');
    createModal.style.display = 'grid';
    if (newBoardTitleInput) {
      setTimeout(function () {
        newBoardTitleInput.focus();
        newBoardTitleInput.select();
      }, 40);
    }
  }

  async function createNewBoard(titleText, category) {
    var title = String(titleText || 'New Collaborative Board').trim() || 'New Collaborative Board';
    try {
      var res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          category: category || 'AI & Product Strategy',
          state: {}
        })
      });
      if (res.ok) {
        var data = await res.json();
        window.location.href = buildBoardPath(data.board.id, '', data.board.title);
        return;
      }
    } catch (e) {}
    window.location.href = '/app/';
  }

  document.getElementById('modal-create-close')?.addEventListener('click', closeCreateBoardModal);
  document.getElementById('modal-create-cancel')?.addEventListener('click', closeCreateBoardModal);
  createModal?.addEventListener('click', function (e) {
    if (e.target === createModal) closeCreateBoardModal();
  });

  document.getElementById('modal-create-submit')?.addEventListener('click', function () {
    var title = (newBoardTitleInput && newBoardTitleInput.value.trim()) || 'New Collaborative Board';
    var space = (newBoardSpaceSelect && newBoardSpaceSelect.value) || 'AI & Product Strategy';
    closeCreateBoardModal();
    createNewBoard(title, space);
  });

  newBoardTitleInput?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('modal-create-submit')?.click();
    }
  });

  /* Sidebar filters with Client-Side History API Navigation */
  document.querySelectorAll('.dash-nav__item[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyFilterState(btn.dataset.filter || 'all', true);
    });
  });

  window.addEventListener('popstate', function (e) {
    var filter = (e.state && e.state.filter) || parseDashboardRoute(window.location.pathname);
    applyFilterState(filter, false);
  });

  var searchInput = document.getElementById('dash-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value.trim();
      renderBoards();
    });
  }

  var createBoardBtn = document.getElementById('btn-create-board');
  if (createBoardBtn) {
    createBoardBtn.addEventListener('click', function () {
      openCreateBoardModal('New Collaborative Board', 'AI & Product Strategy');
    });
  }

  /* Auth Check */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (res) {
      if (res.status === 401) {
        goToLogin();
        return null;
      }
      if (!res.ok) throw new Error('Request failed');
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.user) return;

      var user = data.user;
      var name = user.name || user.email;

      var emailEl = document.getElementById('dash-email');
      if (emailEl) emailEl.textContent = user.email;

      var nameEl = document.getElementById('dash-name');
      if (nameEl) nameEl.textContent = name;

      var initialEl = document.getElementById('dash-initial');
      if (initialEl) {
        var imgUrl = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
        if (imgUrl) {
          initialEl.innerHTML = '<img src="' + imgUrl + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />';
        } else {
          initialEl.textContent = name.charAt(0).toUpperCase();
        }
      }

      var roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      var roleEl = document.getElementById('dash-role');
      if (roleEl) roleEl.textContent = roleLabel;

      var roleStatEl = document.getElementById('dash-role-stat');
      if (roleStatEl) roleStatEl.textContent = roleLabel;

      loadBoards();

      var logout = document.getElementById('logout');
      logout.addEventListener('click', async function () {
        logout.disabled = true;
        logout.textContent = 'Logging out…';
        try {
          if (window.Clerk && window.Clerk.signOut) {
            await window.Clerk.signOut();
          }
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
          });
        } catch (e) {}
        goToLogin();
      });
    })
    .catch(function () {
      document.getElementById('dash-name').textContent = 'Unavailable';
      document.querySelector('.dash__hero p').textContent =
        'We could not reach the server. Please refresh to try again.';
    });
})();
