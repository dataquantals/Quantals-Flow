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
    'files': '/dashboard/files/',
    'AI & Product Strategy': '/dashboard/space/ai-strategy/',
    'Engineering & Delivery': '/dashboard/space/engineering/',
    'UX & Discovery': '/dashboard/space/ux-discovery/'
  };

  function parseDashboardRoute(pathname) {
    var clean = String(pathname || '/dashboard/').replace(/\/+$/, '');
    if (clean === '/dashboard/starred') return 'starred';
    if (clean === '/dashboard/files') return 'files';
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
    // Only append ?module= when the caller asks for a specific module. A bare
    // link lets app.js open the board's own saved activeModule — defaulting to
    // 'project-planning' here is what made canvas boards (mind maps etc.) jump
    // into the planning suite, and the next save then persisted that flip.
    var querySuffix = template ? '?module=' + encodeURIComponent(template) : '';

    // Readable URLs win: /app/data-quantals-plan rather than /app/<slug>/<code>.
    var slug = slugify(title);
    if (slug) return '/app/' + encodeURIComponent(slug) + querySuffix;

    var tokenMatch = cleanId.match(/^(.+)-([0-9a-f]{6})$/i);
    if (tokenMatch) {
      return '/app/' + encodeURIComponent(tokenMatch[1]) + '/' + encodeURIComponent(tokenMatch[2]) + querySuffix;
    }
    return '/app/' + encodeURIComponent(cleanId) + querySuffix;
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

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      var isActive = btn.dataset.filter === activeFilter;
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    var boardsView = document.getElementById('dash-boards-view');
    var filesView = document.getElementById('dash-files-view');
    var isFiles = activeFilter === 'files';
    if (boardsView) boardsView.hidden = isFiles;
    if (filesView) filesView.hidden = !isFiles;

    var heading = document.getElementById('dash-boards-heading');
    if (heading) {
      heading.textContent = activeFilter === 'all'
        ? 'Boards in this workspace'
        : activeFilter === 'starred'
          ? 'Starred boards'
          : activeFilter;
    }

    document.title = (activeFilter === 'all' ? 'Dashboard' : activeFilter === 'files' ? 'Files' : activeFilter) + ' | QuantalFlow';

    var targetUrl = SPACE_ROUTE_MAP[activeFilter] || '/dashboard/';
    if (pushHistoryEntry && window.history && window.history.pushState && window.location.pathname !== targetUrl) {
      window.history.pushState({ filter: activeFilter }, '', targetUrl);
    }

    if (isFiles) {
      if (window.DashboardFiles && typeof window.DashboardFiles.onShow === 'function') {
        window.DashboardFiles.onShow();
      }
    } else {
      renderBoards();
    }
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

    var html =
      '<a class="dash-card dash-card--new" href="/app/" id="card-new-blank">' +
        '<span class="dash-card__plus" aria-hidden="true">+</span>' +
        '<p class="dash-card__new-title"><span>Start New</span><span>Collaborative Board</span></p>' +
      '</a>';
    var tintMap = buildTintMap(allBoards);

    filtered.forEach(function (b) {
      var starClass = b.starred ? 'is-starred' : '';
      var safeTitle = escapeHtml(b.title || 'Untitled Board');
      var safeId = escapeHtml(b.id || '');
      var starLabel = (b.starred ? 'Unstar ' : 'Star ') + safeTitle;
      var delLabel = 'Delete ' + safeTitle;
      var boardHref = buildBoardPath(b.id, b.activeModule || '', b.title);
      html +=
        '<div class="dash-card dash-card--interactive dash-card--tinted" data-board-id="' + safeId + '" style="--dash-tint:' + (tintMap[b.id] || CARD_HUES[0]) + '">' +
          '<div class="dash-card__actions">' +
            '<button class="dash-icon-btn ' + starClass + '" data-star-id="' + safeId + '" type="button" aria-pressed="' + (b.starred ? 'true' : 'false') + '" title="' + starLabel + '" aria-label="' + starLabel + '">&#9733;</button>' +
            '<button class="dash-icon-btn dash-icon-btn--del" data-del-id="' + safeId + '" type="button" title="' + delLabel + '" aria-label="' + delLabel + '">&times;</button>' +
          '</div>' +
          '<a class="dash-card__link" href="' + boardHref + '">' +
            '<p>' + safeTitle + '</p>' +
            '<span class="dash-card__meta">' + timeAgo(b.updatedAt) + ' &bull; Open in App &rarr;</span>' +
          '</a>' +
        '</div>';
    });

    if (filtered.length === 0 && (searchQuery || activeFilter !== 'all')) {
      var emptyMsg = searchQuery
        ? 'No boards match “' + escapeHtml(searchQuery) + '”. Try a different search term or start a new board.'
        : activeFilter === 'starred'
          ? 'No starred boards yet. Star any board card to pin it here for quick access.'
          : 'No boards in this space yet. Start a new collaborative board to begin.';
      html += '<div class="dash-empty-state" role="status">' + emptyMsg + '</div>';
    }

    grid.innerHTML = html;

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
  var modalHeadingEl = document.getElementById('modal-create-heading');
  var modalSubtitleEl = document.getElementById('modal-create-subtitle');
  var modalServicePillEl = document.getElementById('modal-service-pill');
  var modalTemplatesHeadingEl = document.getElementById('modal-templates-heading');
  var modalSubmitBtnEl = document.getElementById('modal-create-submit');
  var newBoardTitleLabelEl = document.getElementById('new-board-title-label');
  var newBoardDescLabelEl = document.getElementById('new-board-desc-label');
  var newBoardTitleInput = document.getElementById('new-board-title');
  var newBoardCategorySelect = document.getElementById('new-board-category');
  var newBoardDescInput = document.getElementById('new-board-description');
  var frameworkGrid = document.getElementById('create-board-frameworks');
  var templatesGrid = document.getElementById('create-board-templates');
  var createSpaceEl = document.getElementById('create-board-space');
  var frameworkList = Array.isArray(window.WorkspaceFrameworks) ? window.WorkspaceFrameworks : [];
  var selectedFrameworkId = frameworkList.length ? frameworkList[0].id : '';
  var selectedTemplateId = '';
  var boardNameTouched = false;
  var boardCategoryTouched = false;

  function selectedFramework() {
    if (window.WorkspaceFrameworks && window.WorkspaceFrameworks.byId) {
      return window.WorkspaceFrameworks.byId(selectedFrameworkId) || frameworkList[0] || null;
    }
    return frameworkList[0] || null;
  }

  function selectedSuggestedTemplate() {
    var f = selectedFramework();
    if (!f || !Array.isArray(f.templates) || !f.templates.length) return null;
    for (var i = 0; i < f.templates.length; i++) {
      if (f.templates[i].id === selectedTemplateId) return f.templates[i];
    }
    return f.templates[0];
  }

  function renderFrameworkCards() {
    if (!frameworkGrid) return;
    frameworkGrid.innerHTML = frameworkList.map(function (f) {
      var selected = f.id === selectedFrameworkId;
      return '<button class="service-tab-chip' + (selected ? ' is-selected' : '') + '"' +
        ' data-framework="' + f.id + '" type="button" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '">' +
        '<span class="service-tab-chip__icon" style="background:' + f.tint + '; color:' + f.ink + ';" aria-hidden="true">' + f.icon + '</span>' +
        '<span class="service-tab-chip__label">' + escapeHtml(f.label) + '</span>' +
        (f.badge ? '<span class="service-tab-chip__badge" style="background:' + (f.badgeBg || f.tint) + '; color:' + (f.badgeColor || f.ink) + ';">' + escapeHtml(f.badge) + '</span>' : '') +
      '</button>';
    }).join('');
  }

  function renderSuggestedTemplates() {
    if (!templatesGrid) return;
    var f = selectedFramework();
    var list = (f && Array.isArray(f.templates)) ? f.templates : [];
    if (!list.length) {
      templatesGrid.innerHTML = '';
      return;
    }
    var currentTpl = selectedSuggestedTemplate();
    var activeId = currentTpl ? currentTpl.id : list[0].id;
    templatesGrid.innerHTML = list.map(function (tpl) {
      var selected = tpl.id === activeId;
      var previewHtml = tpl.previewSvg ||
        '<div style="width:100%;height:100%;display:grid;place-items:center;background:' + (f.tint || '#eef2ff') + ';color:' + (f.ink || '#4262ff') + ';">' + (f.icon || '') + '</div>';

      return '<button class="template-pick-card template-pick-card--visual' + (selected ? ' is-selected' : '') + '"' +
        ' data-suggested-template="' + escapeHtml(tpl.id) + '" type="button" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '" aria-label="' + escapeHtml(tpl.label) + '" title="' + escapeHtml(tpl.label) + '">' +
        '<div class="template-pick-card__preview">' + previewHtml + '</div>' +
      '</button>';
    }).join('');
  }

  function updateModalCopyForService(f) {
    if (!f) return;
    if (modalServicePillEl) {
      modalServicePillEl.textContent = f.label + (f.badge ? ' \u2022 ' + f.badge : '');
      modalServicePillEl.style.background = f.badgeBg || f.tint || '#eef2ff';
      modalServicePillEl.style.color = f.badgeColor || f.ink || '#4262ff';
    }
    if (modalHeadingEl) {
      modalHeadingEl.textContent = f.heading || ('Create ' + f.label + ' Workspace');
    }
    if (modalSubtitleEl) {
      modalSubtitleEl.textContent = f.subtitle || ('Enter your ' + f.label + ' details and choose a suggested template to get started.');
    }
    if (newBoardTitleLabelEl) {
      newBoardTitleLabelEl.textContent = f.label + ' project name';
    }
    if (newBoardTitleInput && f.namePlaceholder) {
      newBoardTitleInput.placeholder = f.namePlaceholder;
    }
    if (newBoardDescLabelEl) {
      newBoardDescLabelEl.textContent = f.label + ' description / goal';
    }
    if (newBoardDescInput && f.descPlaceholder) {
      newBoardDescInput.placeholder = f.descPlaceholder;
    }
    if (modalTemplatesHeadingEl) {
      modalTemplatesHeadingEl.textContent = 'Suggested ' + f.label + ' Templates';
    }
    if (modalSubmitBtnEl) {
      modalSubmitBtnEl.textContent = f.submitLabel || ('Create ' + f.label + ' \u2192');
    }
  }

  function selectSuggestedTemplate(templateId) {
    var f = selectedFramework();
    if (!f || !Array.isArray(f.templates)) return;
    var found = null;
    for (var i = 0; i < f.templates.length; i++) {
      if (f.templates[i].id === templateId) {
        found = f.templates[i];
        break;
      }
    }
    if (!found) return;
    selectedTemplateId = found.id;
    if (newBoardTitleInput && !boardNameTouched) {
      newBoardTitleInput.value = found.defaultTitle || f.defaultTitle;
    }
    renderSuggestedTemplates();
  }

  function selectFramework(id) {
    var f = window.WorkspaceFrameworks && window.WorkspaceFrameworks.byId
      ? window.WorkspaceFrameworks.byId(id)
      : null;
    if (!f) return;
    selectedFrameworkId = f.id;
    var firstTpl = (Array.isArray(f.templates) && f.templates[0]) ? f.templates[0] : null;
    selectedTemplateId = firstTpl ? firstTpl.id : '';
    if (newBoardCategorySelect && !boardCategoryTouched) {
      newBoardCategorySelect.value = f.category;
    }
    var activeSpace = (newBoardCategorySelect && newBoardCategorySelect.value) || f.category;
    if (createSpaceEl) createSpaceEl.textContent = activeSpace;
    if (newBoardTitleInput && !boardNameTouched) {
      newBoardTitleInput.value = (firstTpl && firstTpl.defaultTitle) || f.defaultTitle;
    }
    updateModalCopyForService(f);
    renderFrameworkCards();
    renderSuggestedTemplates();
  }

  function closeCreateBoardModal() {
    if (!createModal) return;
    createModal.hidden = true;
    createModal.classList.remove('is-open');
    createModal.style.display = 'none';
  }

  function openCreateBoardModal(defaultFrameworkId) {
    var fallback = defaultFrameworkId || (frameworkList[0] && frameworkList[0].id) || '';
    var framework = window.WorkspaceFrameworks && window.WorkspaceFrameworks.byId
      ? window.WorkspaceFrameworks.byId(fallback)
      : null;

    if (!createModal || !frameworkList.length) {
      createNewBoard(framework || { module: 'project-planning', category: 'Strategy & Planning' }, framework ? framework.defaultTitle : null);
      return;
    }

    var activeFw = framework || frameworkList[0];
    selectedFrameworkId = activeFw.id;
    var firstTpl = (Array.isArray(activeFw.templates) && activeFw.templates[0]) ? activeFw.templates[0] : null;
    selectedTemplateId = firstTpl ? firstTpl.id : '';
    boardNameTouched = false;
    boardCategoryTouched = false;
    if (newBoardTitleInput) {
      newBoardTitleInput.value = (firstTpl && firstTpl.defaultTitle) || activeFw.defaultTitle || 'New Collaborative Board';
    }
    if (newBoardCategorySelect) {
      newBoardCategorySelect.value = activeFw.category;
    }
    if (newBoardDescInput) {
      newBoardDescInput.value = '';
    }
    if (createSpaceEl) createSpaceEl.textContent = activeFw.category;
    updateModalCopyForService(activeFw);
    renderFrameworkCards();
    renderSuggestedTemplates();

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

  async function createNewBoard(framework, titleText, categoryText, descriptionText, templateId) {
    var f = framework || {
      id: 'project-planning',
      module: 'project-planning',
      category: 'Strategy & Planning',
      defaultTitle: 'New Collaborative Board'
    };
    var mod = f.module || 'project-planning';
    var title = String(titleText || f.defaultTitle || 'New Collaborative Board').trim() || 'New Collaborative Board';
    var category = String(categoryText || f.category || 'AI & Product Strategy').trim();
    var description = String(descriptionText || '').trim();
    var built = (window.WorkspaceFrameworks && window.WorkspaceFrameworks.buildInitialWorkspace)
      ? window.WorkspaceFrameworks.buildInitialWorkspace(f.id || mod, templateId, title, description)
      : { items: [], connectors: [], plan: null };

    var initialItems = Array.isArray(built.items) ? built.items : [];
    var initialConnectors = Array.isArray(built.connectors) ? built.connectors : [];
    var modulesMap = {};
    if (mod !== 'project-planning' && initialItems.length) {
      modulesMap[mod] = {
        version: 2,
        items: initialItems,
        connectors: initialConnectors,
        paths: []
      };
    }

    try {
      var res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          category: category,
          state: {
            version: 2,
            items: initialItems,
            connectors: initialConnectors,
            paths: [],
            modules: modulesMap,
            enabledModules: [mod],
            description: description,
            selectedTemplate: templateId || '',
            workspaceMode: mod === 'project-planning' ? 'project-planning' : 'canvas',
            activeModule: mod
          }
        })
      });
      if (res.ok) {
        var data = await res.json();
        var id = data.board && data.board.id;
        if (id) {
          if (mod === 'project-planning' && built.plan) {
            try {
              localStorage.setItem('quantalflow_pp_state_v2_' + id, JSON.stringify(built.plan));
            } catch (e) {}
            try {
              await fetch('/api/projects/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: built.plan, stateVersion: 2 })
              });
            } catch (e) {}
          }
          window.location.href = '/app/?board=' + encodeURIComponent(id) +
            '&template=' + encodeURIComponent(mod) +
            '&module=' + encodeURIComponent(mod);
          return;
        }
      }
    } catch (e) {}
    window.location.href = '/app/?module=' + encodeURIComponent(mod);
  }

  document.getElementById('modal-create-close')?.addEventListener('click', closeCreateBoardModal);
  document.getElementById('modal-create-cancel')?.addEventListener('click', closeCreateBoardModal);
  createModal?.addEventListener('click', function (e) {
    if (e.target === createModal) closeCreateBoardModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && createModal && !createModal.hidden) {
      closeCreateBoardModal();
    }
  });

  frameworkGrid?.addEventListener('click', function (e) {
    var card = e.target.closest('[data-framework]');
    if (!card) return;
    selectFramework(card.dataset.framework);
  });

  templatesGrid?.addEventListener('click', function (e) {
    var card = e.target.closest('[data-suggested-template]');
    if (!card) return;
    selectSuggestedTemplate(card.dataset.suggestedTemplate);
  });

  templatesGrid?.addEventListener('dblclick', function (e) {
    var card = e.target.closest('[data-suggested-template]');
    if (!card) return;
    selectSuggestedTemplate(card.dataset.suggestedTemplate);
    document.getElementById('modal-create-submit')?.click();
  });

  document.getElementById('modal-create-submit')?.addEventListener('click', function () {
    var framework = selectedFramework();
    var tpl = selectedSuggestedTemplate();
    var title = (newBoardTitleInput && newBoardTitleInput.value.trim()) ||
      (tpl && tpl.defaultTitle) ||
      (framework && framework.defaultTitle) ||
      'New Collaborative Board';
    var category = (newBoardCategorySelect && newBoardCategorySelect.value) ||
      (framework && framework.category) ||
      'Strategy & Planning';
    var description = (newBoardDescInput && newBoardDescInput.value.trim()) || '';
    closeCreateBoardModal();
    createNewBoard(framework, title, category, description, tpl ? tpl.id : '');
  });

  newBoardTitleInput?.addEventListener('input', function () {
    boardNameTouched = true;
  });

  newBoardCategorySelect?.addEventListener('change', function () {
    boardCategoryTouched = true;
    if (createSpaceEl) createSpaceEl.textContent = newBoardCategorySelect.value;
  });

  newBoardTitleInput?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('modal-create-submit')?.click();
    }
  });

  newBoardDescInput?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('modal-create-submit')?.click();
    }
  });

  /* Intercept sidebar "Workspaces & Pages" clicks (Project Planning WBS,
     Mind Map Ideas, Kanban Board Agile, Perspective Matrix, Brainstorm Canvas)
     so they open the service-specific project details & template dialog
     rather than navigating straight to the canvas. */
  document.querySelectorAll('[data-create-framework]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var fwId = link.getAttribute('data-create-framework') || 'project-planning';
      openCreateBoardModal(fwId);
    });
  });

  /* The "Start New Collaborative Board" card exists twice: as static markup for
     the first paint, then again inside renderBoards() after the boards load.
     Delegating on the grid keeps one handler for both copies instead of
     rebinding after every render, and the static href stays as a no-JS fallback. */
  var boardsGrid = document.getElementById('dash-boards-grid');
  if (boardsGrid) {
    boardsGrid.addEventListener('click', function (e) {
      var card = e.target.closest('.dash-card--new');
      if (!card) return;
      e.preventDefault();
      openCreateBoardModal('project-planning');
    });
  }

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
      openCreateBoardModal('project-planning');
    });
  }

  document.getElementById('nav-service-ai')?.addEventListener('click', function () {
    openCreateBoardModal('brainstorm');
  });
  document.getElementById('nav-service-workshop')?.addEventListener('click', function () {
    openCreateBoardModal('kanban');
  });
  document.getElementById('nav-service-assets')?.addEventListener('click', function () {
    applyFilterState('files', true);
  });

  // Immediately sync active tab and panel based on URL pathname
  applyFilterState(parseDashboardRoute(window.location.pathname), false);

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
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf('quantalflow_') === 0) localStorage.removeItem(k);
          });
          sessionStorage.clear();
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
