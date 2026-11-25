/* ==========================================================================
   QuantalFlow Canvas Application (mirrors https://quantalflow.com/app)
   Full Interactive Whiteboard Engine:
   - Tools: Select (V), Hand (H), Sticky (N), Shapes (S), SVG Connectors (L),
     Text (T), Frame (F), Freehand Pen (P), Comment Pins (C)
   - Floating Selection Context Bar: Color, AI Expand, Connect, Vote, Duplicate, Delete
   - Undo/Redo History Stack (Ctrl+Z / Ctrl+Y)
   - Live Sprint Timer, Dot Voting Mode, Frame Presentation Mode, Minimap, Grid Toggle
   - Multi-Mode DeepSeek AI Studio (Stickies, Mind Map, Flowchart, Kanban, AI Expand)
   - Real Cloud Persistence via SQLite (/api/boards/:id) + localStorage fallback
   ========================================================================== */
(function () {
  'use strict';

  /* One friendly line for every AI/provider failure. Raw upstream text can name
     the provider or leak deployment configuration, so it never reaches the UI. */
  var AI_UNAVAILABLE_MESSAGE =
    'Unable to use ai at this time, try later. If the persist, contact the support team';

  function aiUnavailableError() {
    var err = new Error(AI_UNAVAILABLE_MESSAGE);
    err.aiUnavailable = true;
    return err;
  }

  var viewport = document.getElementById('quantalflow-viewport');
  var world = document.getElementById('quantalflow-world');
  var connectorsGroup = document.getElementById('quantalflow-connectors-group');
  var drawingsGroup = document.getElementById('quantalflow-drawings-group');
  if (!viewport || !world) return;

  /* ---------- Hierarchical Path Router (Parent: /app, Child: /:slug/:code/:template) ---------- */
  var KNOWN_TEMPLATES = ['whiteboard', 'project-planning', 'mindmap', 'flow', 'kanban', 'perspective', 'retro', 'brainstorm', 'swot', 'journey', 'blank'];
  var PROJECT_MODULES = ['whiteboard', 'project-planning', 'mindmap', 'kanban', 'perspective', 'brainstorm'];
  var DEFAULT_WORKSPACE_MODULE = 'project-planning';
  var currentActiveModule = DEFAULT_WORKSPACE_MODULE;
  /* The module saved in the board's own state, as distinct from the one the
     URL asks to view. A deep link (?module=...) may open a different module
     for this visit, but only an explicit switch (switchWorkspaceModule) may
     overwrite what the board itself remembers — otherwise one bad link
     silently converts a mind-map board into a planning board. */
  var savedActiveModule = DEFAULT_WORKSPACE_MODULE;
  /* Snapshot of the board's own saved state (server/localStorage). While a URL
     module override is active, this is the truth serializeBoardState reports
     back, so a deep-link visit cannot rewrite the board's saved canvas. */
  var loadedStateRef = null;
  var boardModules = {};
  var enabledModules = [];

  var WORKSPACE_META = {
    'whiteboard': {
      label: 'Whiteboarding',
      blurb: 'Visual workspace with smart stickies, layers, AI, workflows & dashboards',
      tint: '#eef2ff',
      ink: '#4f46e5',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9h4m-4 4h10"/></svg>'
    },
    'project-planning': {
      label: 'Project Planning',
      blurb: 'Gantt, WBS, Kanban, timesheets and RAID in one plan',
      tint: '#ecfdf5',
      ink: '#059669',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h10"/><path d="M6 12h9"/><path d="M11 18h7"/></svg>'
    },
    'mindmap': {
      label: 'Mind Map',
      blurb: 'Connected central idea with branch nodes',
      tint: '#eef2ff',
      ink: '#4262ff',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>'
    },
    'kanban': {
      label: 'Kanban Board',
      blurb: 'To Do, In Progress and Done workflow columns',
      tint: '#fff7ed',
      ink: '#ea580c',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>'
    },
    'perspective': {
      label: 'Perspective',
      blurb: 'Strategic vision, objectives, risks and roadmap matrix',
      tint: '#faf5ff',
      ink: '#7c3aed',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
    },
    'brainstorm': {
      label: 'Brainstorm',
      blurb: 'Central topic ringed with collaborative idea notes',
      tint: '#fef9c3',
      ink: '#ca8a04',
      icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>'
    }
  };

  /** Human-readable URL slug for a board title: "Data Quantals Plan" -> "data-quantals-plan". */
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
    var cleanId = String(id || 'new-collaborative-board').trim();
    var tpl = (template && KNOWN_TEMPLATES.indexOf(template) !== -1 && template !== 'project-planning') ? '/' + template : '';

    // Prefer the readable title so the address bar reads /app/data-quantals-plan.
    var slug = slugify(title);
    if (slug) return '/app/' + encodeURIComponent(slug) + tpl;

    // Fall back to the id form: split "assap-002c5f" -> "/app/assap/002c5f"
    var tokenMatch = cleanId.match(/^(.+)-([0-9a-f]{6})$/i);
    if (tokenMatch) {
      return '/app/' + encodeURIComponent(tokenMatch[1]) + '/' + encodeURIComponent(tokenMatch[2]) + tpl;
    }
    return '/app/' + encodeURIComponent(cleanId) + tpl;
  }

  /** Keep the address bar in sync with the board title and active workspace module without a reload. */
  function syncUrlToTitle(title, modOverride) {
    if (!title) return;
    var activeMod = modOverride || currentActiveModule || DEFAULT_WORKSPACE_MODULE;
    var nextPath = buildBoardPath(boardId, '', title);
    var next = nextPath + '?module=' + encodeURIComponent(activeMod);
    if (next !== window.location.pathname + window.location.search) {
      try {
        window.history.replaceState({ boardId: boardId, module: activeMod, template: activeMod }, '', next);
      } catch (e) {}
    }
  }

  function parseAppRoute(pathname, search) {
    var params = new URLSearchParams(search || '');
    var qBoard = params.get('board');
    var qMod = (params.get('module') || '').toLowerCase();
    var qTpl = (params.get('template') || '').toLowerCase();
    var explicitMod = (PROJECT_MODULES.indexOf(qMod) !== -1) ? qMod : ((PROJECT_MODULES.indexOf(qTpl) !== -1) ? qTpl : '');

    var segments = String(pathname || '/app/')
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);

    // segments[0] is 'app'
    var rest = segments.slice(1).map(function (s) {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });

    if (qBoard) {
      return {
        boardId: qBoard,
        template: explicitMod || qTpl,
        explicitModule: explicitMod,
        needsCanonicalReplace: true
      };
    }

    if (rest.length === 0) {
      return {
        boardId: 'new-collaborative-board',
        template: explicitMod || qTpl,
        explicitModule: explicitMod,
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/board/q4-intelligent-canvas/mindmap
    if (rest[0] === 'board' && rest.length >= 2) {
      var segTpl = (rest[2] || '').toLowerCase();
      return {
        boardId: rest[1],
        template: explicitMod || segTpl,
        explicitModule: explicitMod || (PROJECT_MODULES.indexOf(segTpl) !== -1 ? segTpl : ''),
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/assap/002c5f/mindmap (3 segments after /app)
    if (rest.length >= 3) {
      var seg3 = rest[2].toLowerCase();
      return {
        boardId: rest[0] + '-' + rest[1],
        template: explicitMod || seg3,
        explicitModule: explicitMod || (PROJECT_MODULES.indexOf(seg3) !== -1 ? seg3 : ''),
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/assap/002c5f OR /app/q4-intelligent-canvas/mindmap (2 segments after /app)
    if (rest.length === 2) {
      var seg2 = rest[1].toLowerCase();
      if (KNOWN_TEMPLATES.indexOf(seg2) !== -1) {
        return {
          boardId: rest[0],
          template: explicitMod || seg2,
          explicitModule: explicitMod || (PROJECT_MODULES.indexOf(seg2) !== -1 ? seg2 : ''),
          needsCanonicalReplace: false
        };
      }
      return {
        boardId: rest[0] + '-' + rest[1],
        template: explicitMod || '',
        explicitModule: explicitMod,
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/q4-intelligent-canvas (1 segment after /app)
    return {
      boardId: rest[0],
      template: explicitMod || '',
      explicitModule: explicitMod,
      needsCanonicalReplace: false
    };
  }

  var initialRoute = parseAppRoute(window.location.pathname, window.location.search);
  var boardId = initialRoute.boardId;
  var initialTemplate = initialRoute.template;
  currentActiveModule = initialRoute.explicitModule || DEFAULT_WORKSPACE_MODULE;

  /* ---------- Canvas State ---------- */
  var currentTool = 'select'; // select, hand, sticky, shape, connector, text, frame, pen, comment, icon, clipart
  var currentColor = 'yellow';
  var currentShapeType = 'rect'; // rect, round, circle, diamond, cylinder
  var currentConnectorType = 'orthogonal'; // orthogonal, curved, straight, freeform, points
  var connectorCurrentToolOnly = false;
  var connectorAutoRouting = true;
  var currentPenColor = '#1a1a2e';
  var currentPenWidth = 5;
  var currentIconId = 'rocket';   // selected canvas icon (Lucide id)
  var currentIconColor = 'ink';   // ink, blue, mint, violet, pink, orange
  var currentClipartId = '1f600'; // last-picked clipart (Twemoji hexcode)
  var currentAiMode = 'stickies';
  var gridMode = 0; // 0 = dots, 1 = lines, 2 = clean

  var zoom = 1;
  var panX = 80;
  var panY = 50;
  var isPanning = false;
  var spacePressed = false;
  var startPanX = 0;
  var startPanY = 0;

  var selectedEl = null;
  var selectedEls = [];
  var isMarqueeSelecting = false;
  var marqueeStartX = 0;
  var marqueeStartY = 0;
  var marqueeEl = null;
  var activeDragEl = null;
  var dragGroupOffsets = [];
  var dragOffsetX = 0;
  var dragOffsetY = 0;
  var dragMoved = false;

  var activeResizeEl = null;
  var resizeStartW = 0;
  var resizeStartH = 0;
  var resizeStartX = 0;
  var resizeStartY = 0;

  // Connectors: array of { id, fromId, toId, label } — starts empty on new boards
  var connectors = [];
  var pendingConnectorFromId = null;

  // Empty board starter overlay state
  var emptyStarterEl = document.getElementById('empty-board-starter');
  var starterDismissedByUser = false;
  var isHydratingBoard = true;

  function hasCanvasItems() {
    var count = world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc').length;
    var hasPaths = drawingsGroup && drawingsGroup.children.length > 0;
    return count > 0 || Boolean(hasPaths);
  }

  function syncEmptyBoardStarter() {
    if (!emptyStarterEl) return;
    if (isHydratingBoard || currentActiveModule === 'project-planning' || hasCanvasItems() || starterDismissedByUser) {
      emptyStarterEl.hidden = true;
      emptyStarterEl.style.display = 'none';
    } else {
      emptyStarterEl.hidden = false;
      emptyStarterEl.style.display = 'grid';
    }
  }

  function clearCanvasElementsOnly() {
    selectElement(null);
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc').forEach(function (el) {
      el.remove();
    });
    connectors = [];
    renderConnectors();
    if (drawingsGroup) drawingsGroup.innerHTML = '';
    updateMinimap();
  }

  // Freehand Pen Drawing state
  var isDrawingPen = false;
  var activePathEl = null;
  var penPoints = [];

  // Voting session state
  var votingActive = false;
  var votesRemaining = 5;

  // Presentation state
  var presentActive = false;
  var presentFrameIdx = 0;

  // Undo / Redo History
  var historyStack = [];
  var redoStack = [];
  var isRestoringHistory = false;
  var idCounter = 100;

  function nextId(prefix) {
    idCounter += 1;
    return (prefix || 'item') + '-' + Date.now().toString(36) + '-' + idCounter;
  }

  /* ---------- Transform & Viewport ---------- */
  function updateTransform(smooth) {
    if (smooth) {
      world.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
      setTimeout(function () { world.style.transition = ''; }, 450);
    }
    world.style.transform = 'translate(' + Math.round(panX) + 'px, ' + Math.round(panY) + 'px) scale(' + zoom.toFixed(3) + ')';
    var zoomLabel = document.getElementById('zoom-val');
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    updateContextToolbarPosition();
    updateMinimap();
  }

  function screenToWorld(clientX, clientY) {
    var rect = world.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom
    };
  }

  /* ---------- SVG Connectors Engine ---------- */
  function getElementBounds(el) {
    var x = parseFloat(el.style.left) || 0;
    var y = parseFloat(el.style.top) || 0;
    var w = el.offsetWidth || parseFloat(el.style.width) || 160;
    var h = el.offsetHeight || parseFloat(el.style.height) || 100;
    return { x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
  }

  function computeAnchorPoints(fromEl, toEl, conn) {
    var a = getElementBounds(fromEl);
    var b = getElementBounds(toEl);
    var dx = b.cx - a.cx;
    var dy = b.cy - a.cy;
    var cType = (conn && conn.type) ? conn.type : 'curved';
    var autoRoute = (conn && conn.autoRoute !== undefined) ? Boolean(conn.autoRoute) : true;

    var startX, startY, endX, endY, c1x, c1y, c2x, c2y;
    var isHorizontal = !autoRoute || Math.abs(dx) > Math.abs(dy);
    if (isHorizontal) {
      startX = dx >= 0 ? a.x + a.w : a.x;
      startY = a.cy;
      endX = dx >= 0 ? b.x : b.x + b.w;
      endY = b.cy;
    } else {
      startX = a.cx;
      startY = dy >= 0 ? a.y + a.h : a.y;
      endX = b.cx;
      endY = dy >= 0 ? b.y : b.y + b.h;
    }

    if (cType === 'straight') {
      return 'M ' + Math.round(startX) + ' ' + Math.round(startY) +
             ' L ' + Math.round(endX) + ' ' + Math.round(endY);
    }

    if (cType === 'orthogonal' || cType === 'points') {
      if (isHorizontal) {
        var midX = Math.round((startX + endX) / 2);
        return 'M ' + Math.round(startX) + ' ' + Math.round(startY) +
               ' L ' + midX + ' ' + Math.round(startY) +
               ' L ' + midX + ' ' + Math.round(endY) +
               ' L ' + Math.round(endX) + ' ' + Math.round(endY);
      }
      var midY = Math.round((startY + endY) / 2);
      return 'M ' + Math.round(startX) + ' ' + Math.round(startY) +
             ' L ' + Math.round(startX) + ' ' + midY +
             ' L ' + Math.round(endX) + ' ' + midY +
             ' L ' + Math.round(endX) + ' ' + Math.round(endY);
    }

    if (cType === 'freeform') {
      var qx = Math.round((startX + endX) / 2 - (endY - startY) * 0.28);
      var qy = Math.round((startY + endY) / 2 + (endX - startX) * 0.18);
      return 'M ' + Math.round(startX) + ' ' + Math.round(startY) +
             ' Q ' + qx + ' ' + qy + ', ' + Math.round(endX) + ' ' + Math.round(endY);
    }

    if (isHorizontal) {
      var offset = Math.max(40, Math.abs(endX - startX) * 0.45);
      c1x = startX + (dx >= 0 ? offset : -offset);
      c1y = startY;
      c2x = endX - (dx >= 0 ? offset : -offset);
      c2y = endY;
    } else {
      var vOffset = Math.max(40, Math.abs(endY - startY) * 0.45);
      c1x = startX;
      c1y = startY + (dy >= 0 ? vOffset : -vOffset);
      c2x = endX;
      c2y = endY - (dy >= 0 ? vOffset : -vOffset);
    }

    return 'M ' + Math.round(startX) + ' ' + Math.round(startY) +
           ' C ' + Math.round(c1x) + ' ' + Math.round(c1y) + ', ' +
                   Math.round(c2x) + ' ' + Math.round(c2y) + ', ' +
                   Math.round(endX) + ' ' + Math.round(endY);
  }

  function renderConnectors() {
    if (!connectorsGroup) return;
    connectorsGroup.innerHTML = '';
    connectors = connectors.filter(function (conn) {
      var fromEl = world.querySelector('[data-id="' + conn.fromId + '"]');
      var toEl = world.querySelector('[data-id="' + conn.toId + '"]');
      if (!fromEl || !toEl) return false;
      var d = computeAnchorPoints(fromEl, toEl, conn);
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'quantalflow-connector-path');
      path.setAttribute('data-conn-id', conn.id);
      path.setAttribute('marker-end', 'url(#quantalflow-arrow)');
      path.addEventListener('click', async function (e) {
        e.stopPropagation();
        var ok = await window.QFDialog.confirm({
          title: 'Remove connector line?',
          message: 'This connection between items will be removed.',
          confirmLabel: 'Remove',
          cancelLabel: 'Cancel',
          tone: 'danger'
        });
        if (ok) {
          pushHistory();
          connectors = connectors.filter(function (c) { return c.id !== conn.id; });
          renderConnectors();
          scheduleSave();
        }
      });
      connectorsGroup.appendChild(path);
      return true;
    });
  }

  /* ---------- Flatten Initial Frame Children into World Coordinates ---------- */
  function normalizeInitialElements() {
    // Move any sticky/shape inside a frame into direct children of #quantalflow-world
    // so dragging, connecting, and serializing use unified world coordinates.
    world.querySelectorAll('.canvas-frame').forEach(function (frame) {
      if (!frame.dataset.id) frame.dataset.id = nextId('frame');
      ensureResizeHandle(frame);
      var children = frame.querySelectorAll('.canvas-sticky, .canvas-shape, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc');
      children.forEach(function (child) {
        if (!child.dataset.id) child.dataset.id = nextId('item');
        world.appendChild(child);
      });
    });

    world.querySelectorAll('.canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc').forEach(function (el) {
      if (!el.dataset.id) el.dataset.id = nextId('item');
      bindInteractiveElement(el);
    });

    world.querySelectorAll('.canvas-frame').forEach(function (el) {
      bindInteractiveElement(el);
    });

    renderConnectors();
  }

  function ensureResizeHandle(el) {
    if (el.classList.contains('canvas-comment')) return;
    if (!el.querySelector('.resize-handle')) {
      var handle = document.createElement('span');
      handle.className = 'resize-handle';
      handle.title = 'Drag to resize';
      handle.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        pushHistory();
        activeResizeEl = el;
        resizeStartW = el.offsetWidth;
        resizeStartH = el.offsetHeight;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        selectElement(el);
      });
      el.appendChild(handle);
    }
  }

  /* ---------- Selection & Floating Context Toolbar ---------- */
  var contextToolbar = document.getElementById('context-toolbar');

  function setSelectedElements(list) {
    selectedEls.forEach(function (item) {
      if (item) item.classList.remove('is-selected');
    });
    if (selectedEl) selectedEl.classList.remove('is-selected');
    selectedEls = (list || []).filter(Boolean);
    selectedEls.forEach(function (item) {
      item.classList.add('is-selected');
    });
    selectedEl = selectedEls.length ? selectedEls[selectedEls.length - 1] : null;
    if (contextToolbar) {
      if (selectedEls.length === 1) {
        contextToolbar.hidden = false;
        contextToolbar.style.display = 'flex';
        updateContextToolbarPosition();
      } else {
        contextToolbar.hidden = true;
        contextToolbar.style.display = 'none';
      }
    }
  }

  function selectElement(el) {
    setSelectedElements(el ? [el] : []);
  }

  function updateContextToolbarPosition() {
    if (!selectedEl || !contextToolbar || contextToolbar.hidden) return;
    var rect = selectedEl.getBoundingClientRect();
    var vpRect = viewport.getBoundingClientRect();
    var tbW = contextToolbar.offsetWidth || 280;
    var halfW = Math.min(tbW / 2, Math.max(0, vpRect.width / 2 - 12));
    var left = Math.max(halfW + 12, Math.min(vpRect.width - halfW - 12, rect.left - vpRect.left + rect.width / 2));
    var top = Math.max(12, Math.min(vpRect.height - 64, rect.top - vpRect.top - 52));
    contextToolbar.style.left = Math.round(left) + 'px';
    contextToolbar.style.top = Math.round(top) + 'px';
  }

  /* ---------- Bind Drag, Select, Connect & Vote on Elements ---------- */
  function bindInteractiveElement(el) {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    ensureResizeHandle(el);

    el.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      if (e.target.classList.contains('resize-handle')) return;
      if (currentTool === 'hand' || spacePressed) return;
      if (e.pointerType === 'touch' && viewportActivePointers && viewportActivePointers.size >= 1) return;

      // Connector tool or pending connector mode
      if ((currentTool === 'connector' || pendingConnectorFromId) && !el.classList.contains('canvas-frame')) {
        e.stopPropagation();
        if (!pendingConnectorFromId) {
          pendingConnectorFromId = el.dataset.id;
          el.classList.add('is-connecting');
          showToast('Now click a second item to connect with an arrow');
        } else if (pendingConnectorFromId !== el.dataset.id) {
          pushHistory();
          var prev = world.querySelector('[data-id="' + pendingConnectorFromId + '"]');
          if (prev) prev.classList.remove('is-connecting');
          connectors.push({
            id: nextId('conn'),
            fromId: pendingConnectorFromId,
            toId: el.dataset.id,
            type: currentConnectorType === 'points' ? 'orthogonal' : currentConnectorType,
            autoRoute: connectorAutoRouting
          });
          pendingConnectorFromId = null;
          renderConnectors();
          if (!connectorCurrentToolOnly) {
            setTool('select');
          }
          scheduleSave();
        }
        return;
      }

      // Voting mode
      if (votingActive && !el.classList.contains('canvas-frame')) {
        e.stopPropagation();
        upvoteElement(el);
        return;
      }

      if (e.shiftKey) {
        var nextSel = selectedEls.slice();
        var sIdx = nextSel.indexOf(el);
        if (sIdx === -1) nextSel.push(el);
        else nextSel.splice(sIdx, 1);
        setSelectedElements(nextSel);
      } else if (selectedEls.length <= 1 || selectedEls.indexOf(el) === -1) {
        selectElement(el);
      }

      // Excel-like spreadsheet table: clicking inside the grid or formula bar
      // interacts with cells instead of dragging the whole table. Dragging the
      // top .xl-ribbon bar (outside buttons) moves the table on the canvas.
      if (el.classList.contains('canvas-table')) {
        if (e.target.closest('.canvas-table__scroll, .xl-formulabar, .xl-ribbon__btn')) {
          e.stopPropagation();
          return;
        }
      }

      // Word / Confluence-like Document: clicking inside the formatting toolbar,
      // outline sidebar, page surface, or status bar interacts with the document.
      // Dragging the top .doc-ribbon bar (outside buttons/status/inputs) moves it.
      if (el.classList.contains('canvas-doc')) {
        if (el.classList.contains('is-fullscreen')) {
          e.stopPropagation();
          return;
        }
        if (e.target.closest('.doc-toolbar, .doc-workspace, .doc-statusbar, .doc-ribbon__btn, .doc-status-pill, .doc-ribbon__title')) {
          e.stopPropagation();
          return;
        }
      }

      // Allow inline text editing on double-click, when clicking inside focused contenteditable,
      // or tapping an already-selected element's editable text on touch devices
      var editable = e.target.closest('[contenteditable="true"]');
      if (editable && (document.activeElement === editable || (e.pointerType === 'touch' && el.classList.contains('is-selected')))) {
        e.stopPropagation();
        if (document.activeElement !== editable) editable.focus();
        return;
      }

      activeDragEl = el;
      dragMoved = false;
      var rect = el.getBoundingClientRect();
      dragOffsetX = (e.clientX - rect.left) / zoom;
      dragOffsetY = (e.clientY - rect.top) / zoom;
      var dragOriginX = parseFloat(el.style.left) || 0;
      var dragOriginY = parseFloat(el.style.top) || 0;
      dragGroupOffsets = selectedEls
        .filter(function (item) { return item && item !== el; })
        .map(function (item) {
          return {
            el: item,
            dx: (parseFloat(item.style.left) || 0) - dragOriginX,
            dy: (parseFloat(item.style.top) || 0) - dragOriginY
          };
        });
      e.stopPropagation();
    });

    el.addEventListener('dblclick', function (e) {
      // Focus the editable the user actually double-clicked (matters for
      // multi-cell elements like the spreadsheet table, not just the first one).
      var editable = e.target && e.target.closest ? e.target.closest('[contenteditable="true"]') : null;
      if (editable) {
        e.stopPropagation();
        editable.focus();
      }
    });

    // Save when inline text changes
    var editableEl = el.querySelector('[contenteditable="true"]');
    if (editableEl) {
      editableEl.addEventListener('input', function () {
        scheduleSave();
      });
    }
  }

  /* ---------- Element Creators ---------- */
  function createSticky(x, y, text, color, votes, customId) {
    var el = document.createElement('div');
    var c = color || currentColor || 'yellow';
    el.className = 'canvas-sticky canvas-sticky--' + c;
    el.dataset.id = customId || nextId('sticky');
    el.dataset.color = c;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    var vCount = Number(votes) || 0;
    var voteHtml = vCount > 0 ? ('&#9733; ' + vCount) : '&#10003;';
    el.innerHTML =
      '<div class="canvas-sticky__text" contenteditable="true">' + (text || 'New sticky note') + '</div>' +
      '<div class="canvas-sticky__footer"><span>Updated just now</span><span class="vote-pill" data-votes="' + vCount + '">' + voteHtml + '</span></div>';

    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  function createShape(x, y, text, shapeType, color, w, h, customId) {
    var el = document.createElement('div');
    var st = shapeType || currentShapeType || 'rect';
    el.className = 'canvas-shape canvas-shape--' + st;
    if (color && color !== 'white') el.classList.add('canvas-shape--fill-' + color);
    el.dataset.id = customId || nextId('shape');
    el.dataset.shapeType = st;
    el.dataset.color = color || 'white';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = (w || (st === 'circle' || st === 'diamond' ? 130 : 160)) + 'px';
    if (h) el.style.height = h + 'px';
    el.innerHTML = '<div class="canvas-shape__text" contenteditable="true">' + (text || 'System Node') + '</div>';
    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  function createText(x, y, text, color, customId) {
    var el = document.createElement('div');
    el.className = 'canvas-text';
    el.dataset.id = customId || nextId('text');
    el.dataset.color = color || 'ink';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.innerHTML = '<div class="canvas-text__content" contenteditable="true">' + (text || 'Heading or annotation') + '</div>';
    world.appendChild(el);
    bindInteractiveElement(el);
    syncEmptyBoardStarter();
    return el;
  }

  /* Canvas icon: a scalable Lucide glyph. `iconId` looks up the lazily-loaded
     window.CanvasIcons library; an unknown id falls back to a circle so a
     restore can never leave an empty box behind. */
  function createIcon(x, y, iconId, color, size, customId) {
    var lib = window.CanvasIcons;
    var icon = lib && lib.byId ? lib.byId(iconId) : null;
    var el = document.createElement('div');
    var c = color || currentIconColor || 'ink';
    el.className = 'canvas-icon canvas-icon--' + c;
    el.dataset.id = customId || nextId('icon');
    el.dataset.icon = icon ? icon.id : (iconId || 'rocket');
    el.dataset.color = c;
    var px = Number(size) || 48;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = px + 'px';
    el.style.height = px + 'px';
    el.title = icon ? icon.label + ' icon' : 'Icon';
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (icon ? icon.body : '<circle cx="12" cy="12" r="9"/>') +
      '</svg>';
    if (!icon && iconId) {
      // Library may not have loaded yet (e.g. a restored board on first paint).
      // Keep the id and refresh the glyph as soon as it arrives.
      ensureIconLibrary(function () {
        var ic = window.CanvasIcons.byId(el.dataset.icon);
        if (!ic) return;
        var svg = el.querySelector('svg');
        if (svg) svg.innerHTML = ic.body;
        el.title = ic.label + ' icon';
      });
    }
    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  /* Canvas clipart: a full-color Twemoji artwork. `clipartId` looks up the
     lazily-loaded window.CanvasCliparts library; an unknown id falls back to a
     plain smiley so a restore can never leave an empty box behind. */
  function createClipart(x, y, clipartId, size, customId) {
    var lib = window.CanvasCliparts;
    var art = lib && lib.byId ? lib.byId(clipartId) : null;
    var el = document.createElement('div');
    el.className = 'canvas-clipart';
    el.dataset.id = customId || nextId('clipart');
    el.dataset.clipart = art ? art.id : (clipartId || '1f600');
    var px = Number(size) || 64;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = px + 'px';
    el.style.height = px + 'px';
    el.title = art ? art.label : 'Clipart';
    el.innerHTML =
      '<svg viewBox="' + (art ? art.viewBox : '0 0 36 36') + '" width="100%" height="100%" aria-hidden="true">' +
      (art ? art.body : '<circle cx="18" cy="18" r="17" fill="#ffcc4d"/><circle cx="12" cy="15" r="1.8" fill="#664500"/><circle cx="24" cy="15" r="1.8" fill="#664500"/><path d="M11 24c1.5 2.4 4 3.5 7 3.5s5.5-1.1 7-3.5" fill="none" stroke="#664500" stroke-width="2" stroke-linecap="round"/>') +
      '</svg>';
    if (!art && clipartId) {
      // Library may not have loaded yet (e.g. a restored board on first paint).
      // Keep the id and swap in the real artwork as soon as it arrives.
      ensureClipartLibrary(function () {
        var c = window.CanvasCliparts.byId(el.dataset.clipart);
        if (!c) return;
        var svg = el.querySelector('svg');
        if (svg) {
          svg.setAttribute('viewBox', c.viewBox);
          svg.innerHTML = c.body;
        }
        el.title = c.label;
      });
    }
    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  /* Spreadsheet table (Excel-like): ribbon, Name Box + fx formula bar,
     A/B/C column headers (with column resize), numbered rows, cell selection,
     formula evaluation (=SUM, =AVERAGE, =MIN, =MAX, =COUNT, arithmetic),
     keyboard navigation (Enter/Tab/Arrows/F2/Esc), CSV export & status bar. */
  function createTable(x, y, cells, customId) {
    var rows = Math.max(1, cells ? cells.length : 6);
    var cols = Math.max(1, cells && cells[0] ? cells[0].length : 5);
    var colWidths = [];
    for (var wi = 0; wi < cols; wi++) colWidths.push(110);

    var el = document.createElement('div');
    el.className = 'canvas-table';
    el.dataset.id = customId || nextId('table');
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    function updateTableWidth() {
      var total = 36;
      for (var i = 0; i < cols; i++) total += (colWidths[i] || 110);
      el.style.width = Math.max(360, total + 2) + 'px';
    }
    updateTableWidth();

    var selRow = 0;
    var selCol = 0;
    var editingTd = null;
    var editOriginalRaw = '';

    function colName(i) {
      var s = '';
      i += 1;
      while (i > 0) {
        var m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
      }
      return s;
    }

    function colIndexFromLetters(letters) {
      var up = String(letters || '').toUpperCase();
      var idx = 0;
      for (var i = 0; i < up.length; i++) {
        idx = idx * 26 + (up.charCodeAt(i) - 64);
      }
      return idx - 1;
    }

    function cellRef(r, c) {
      return colName(c) + String(r + 1);
    }

    function getTd(r, c) {
      var tr = tableEl.querySelectorAll('tbody tr')[r];
      if (!tr) return null;
      return tr.querySelectorAll('td')[c] || null;
    }

    function readCells() {
      return Array.prototype.map.call(tableEl.querySelectorAll('tbody tr'), function (tr) {
        return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
          return td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
        });
      });
    }

    function evalCellValue(r, c, visited) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return '#REF!';
      var td = getTd(r, c);
      if (!td) return '';
      var raw = td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
      raw = String(raw || '');
      if (raw.charAt(0) !== '=') return raw;

      var key = r + ':' + c;
      if (visited[key]) return '#CYCLE!';
      visited[key] = true;

      var expr = raw.slice(1).trim();
      if (!expr) return '';

      function expandRange(aRef, bRef) {
        var m1 = /^([A-Za-z]+)(\d+)$/.exec(aRef);
        var m2 = /^([A-Za-z]+)(\d+)$/.exec(bRef);
        if (!m1 || !m2) return [];
        var c1 = colIndexFromLetters(m1[1]);
        var r1 = parseInt(m1[2], 10) - 1;
        var c2 = colIndexFromLetters(m2[1]);
        var r2 = parseInt(m2[2], 10) - 1;
        var rMin = Math.min(r1, r2), rMax = Math.max(r1, r2);
        var cMin = Math.min(c1, c2), cMax = Math.max(c1, c2);
        var vals = [];
        for (var rr = rMin; rr <= rMax; rr++) {
          for (var cc = cMin; cc <= cMax; cc++) {
            var v = evalCellValue(rr, cc, Object.assign({}, visited));
            var n = parseFloat(v);
            if (!isNaN(n) && isFinite(n)) vals.push(n);
          }
        }
        return vals;
      }

      function collectArgs(argStr) {
        var nums = [];
        argStr.split(',').forEach(function (part) {
          var p = part.trim();
          if (!p) return;
          if (p.indexOf(':') !== -1) {
            var bounds = p.split(':');
            nums = nums.concat(expandRange(bounds[0].trim(), bounds[1].trim()));
          } else {
            var refM = /^([A-Za-z]+)(\d+)$/.exec(p);
            if (refM) {
              var rv = evalCellValue(parseInt(refM[2], 10) - 1, colIndexFromLetters(refM[1]), Object.assign({}, visited));
              var rn = parseFloat(rv);
              if (!isNaN(rn) && isFinite(rn)) nums.push(rn);
            } else {
              var lit = parseFloat(p);
              if (!isNaN(lit) && isFinite(lit)) nums.push(lit);
            }
          }
        });
        return nums;
      }

      try {
        var replaced = expr.replace(/\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\s*\(([^()]*)\)/gi, function (_, fn, args) {
          var nums = collectArgs(args);
          var f = fn.toUpperCase();
          if (f === 'COUNT') return String(nums.length);
          if (!nums.length) return '0';
          if (f === 'SUM') return String(nums.reduce(function (a, b) { return a + b; }, 0));
          if (f === 'AVERAGE' || f === 'AVG') return String(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
          if (f === 'MIN') return String(Math.min.apply(null, nums));
          if (f === 'MAX') return String(Math.max.apply(null, nums));
          return '0';
        });

        replaced = replaced.replace(/\b([A-Za-z]+)(\d+)\b/g, function (full, colL, rowN) {
          var rr = parseInt(rowN, 10) - 1;
          var cc = colIndexFromLetters(colL);
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return 'NaN';
          var v = evalCellValue(rr, cc, Object.assign({}, visited));
          var n = parseFloat(v);
          return isNaN(n) ? '0' : String(n);
        });

        if (!/^[0-9+\-*/().\sEe]+$/.test(replaced)) return '#ERR!';
        var out = Function('"use strict"; return (' + replaced + ')')();
        if (typeof out === 'number' && isFinite(out)) {
          return Number.isInteger(out) ? String(out) : String(Math.round(out * 10000) / 10000);
        }
        return '#ERR!';
      } catch (e) {
        return '#ERR!';
      }
    }

    function recalcAll() {
      var bodyRows = tableEl.querySelectorAll('tbody tr');
      for (var r = 0; r < bodyRows.length; r++) {
        var tds = bodyRows[r].querySelectorAll('td');
        for (var c = 0; c < tds.length; c++) {
          var td = tds[c];
          if (td === editingTd) continue;
          var raw = td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
          td.dataset.raw = raw;
          var display = raw.charAt(0) === '=' ? evalCellValue(r, c, {}) : raw;
          td.textContent = display;
          if (td.classList.contains('is-cell-selected')) {
            var fh = document.createElement('span');
            fh.className = 'xl-fill-handle';
            td.appendChild(fh);
          }
          var isNumeric = display !== '' && !isNaN(Number(display)) && isFinite(Number(display));
          if (isNumeric) td.setAttribute('data-num', '1');
          else td.removeAttribute('data-num');
        }
      }
      updateStatusBar();
    }

    // Ribbon (Excel Green)
    var ribbon = document.createElement('div');
    ribbon.className = 'xl-ribbon';
    ribbon.innerHTML =
      '<div class="xl-ribbon__left">' +
        '<span class="xl-ribbon__badge" aria-hidden="true">X</span>' +
        '<span class="xl-ribbon__title">Spreadsheet</span>' +
      '</div>' +
      '<div class="xl-ribbon__actions">' +
        '<button type="button" class="xl-ribbon__btn" data-xl-bold title="Bold selected cell (Ctrl+B)"><strong>B</strong></button>' +
        '<button type="button" class="xl-ribbon__btn" data-tbl-add-col title="Add column">+ Col</button>' +
        '<button type="button" class="xl-ribbon__btn" data-tbl-add-row title="Add row">+ Row</button>' +
        '<button type="button" class="xl-ribbon__btn" data-xl-clear title="Clear selected cell">Clear</button>' +
        '<button type="button" class="xl-ribbon__btn" data-xl-csv title="Export sheet as CSV">CSV</button>' +
      '</div>';

    // Formula bar (Name Box + fx input)
    var formulaBar = document.createElement('div');
    formulaBar.className = 'xl-formulabar';
    var nameBox = document.createElement('div');
    nameBox.className = 'xl-namebox';
    nameBox.textContent = 'A1';
    var fxLabel = document.createElement('span');
    fxLabel.className = 'xl-fx-label';
    fxLabel.textContent = 'fx';
    var fxInput = document.createElement('input');
    fxInput.type = 'text';
    fxInput.className = 'xl-fx-input';
    fxInput.placeholder = 'Value or formula (e.g. =SUM(A1:A4))';
    fxInput.setAttribute('aria-label', 'Formula bar');
    formulaBar.appendChild(nameBox);
    formulaBar.appendChild(fxLabel);
    formulaBar.appendChild(fxInput);

    var tableEl = document.createElement('table');

    var scroll = document.createElement('div');
    scroll.className = 'canvas-table__scroll';
    scroll.appendChild(tableEl);

    // Bottom status bar (Sheet1 tab + live stats)
    var statusBar = document.createElement('div');
    statusBar.className = 'xl-statusbar';
    statusBar.innerHTML =
      '<span class="xl-sheet-tab">Sheet1</span>' +
      '<span class="xl-statusbar__stats" data-xl-stats>6 &times; 5</span>';

    el.appendChild(ribbon);
    el.appendChild(formulaBar);
    el.appendChild(scroll);
    el.appendChild(statusBar);

    function updateStatusBar() {
      var statsEl = statusBar.querySelector('[data-xl-stats]');
      if (!statsEl) return;
      var nums = [];
      var tds = tableEl.querySelectorAll('tbody td');
      tds.forEach(function (td) {
        var n = parseFloat(td.textContent);
        if (!isNaN(n) && isFinite(n)) nums.push(n);
      });
      var parts = [rows + ' \u00d7 ' + cols];
      if (nums.length > 0) {
        var sum = nums.reduce(function (a, b) { return a + b; }, 0);
        var avg = sum / nums.length;
        parts.push('COUNT: ' + nums.length);
        parts.push('SUM: ' + (Number.isInteger(sum) ? sum : (Math.round(sum * 100) / 100)));
        parts.push('AVG: ' + (Math.round(avg * 100) / 100));
      }
      statsEl.textContent = parts.join('  |  ');
    }

    function updateSelectionUI() {
      tableEl.querySelectorAll('.is-cell-selected').forEach(function (cell) {
        cell.classList.remove('is-cell-selected');
        var fh = cell.querySelector('.xl-fill-handle');
        if (fh) fh.remove();
      });
      tableEl.querySelectorAll('.is-col-active').forEach(function (th) { th.classList.remove('is-col-active'); });
      tableEl.querySelectorAll('.is-row-active').forEach(function (th) { th.classList.remove('is-row-active'); });

      selRow = Math.max(0, Math.min(rows - 1, selRow));
      selCol = Math.max(0, Math.min(cols - 1, selCol));

      var colTh = tableEl.querySelectorAll('thead th.tbl-col-head')[selCol];
      if (colTh) colTh.classList.add('is-col-active');
      var rowTr = tableEl.querySelectorAll('tbody tr')[selRow];
      if (rowTr) {
        var rTh = rowTr.querySelector('th.tbl-row-head');
        if (rTh) rTh.classList.add('is-row-active');
      }

      var td = getTd(selRow, selCol);
      if (td) {
        td.classList.add('is-cell-selected');
        if (td !== editingTd) {
          var fh = document.createElement('span');
          fh.className = 'xl-fill-handle';
          td.appendChild(fh);
        }
        nameBox.textContent = cellRef(selRow, selCol);
        fxInput.value = td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
        var boldBtn = ribbon.querySelector('[data-xl-bold]');
        if (boldBtn) boldBtn.classList.toggle('is-active', td.getAttribute('data-bold') === '1');
      }
    }

    function commitEdit(td, keepRaw) {
      if (!td) return;
      var newRaw = keepRaw !== undefined ? keepRaw : td.textContent;
      td.contentEditable = 'false';
      td.classList.remove('is-cell-editing');
      td.dataset.raw = newRaw;
      editingTd = null;
      recalcAll();
      updateSelectionUI();
      scheduleSave();
    }

    function enterEditMode(td, initialChar) {
      if (!td) return;
      if (editingTd && editingTd !== td) commitEdit(editingTd);
      editingTd = td;
      var raw = td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
      editOriginalRaw = raw;
      var fh = td.querySelector('.xl-fill-handle');
      if (fh) fh.remove();
      td.classList.add('is-cell-editing');
      td.contentEditable = 'true';
      td.textContent = initialChar !== undefined ? initialChar : raw;
      td.focus();
      // Place caret at end
      try {
        var range = document.createRange();
        range.selectNodeContents(td);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {}
    }

    function build() {
      tableEl.innerHTML = '';
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      var corner = document.createElement('th');
      corner.className = 'tbl-corner';
      headRow.appendChild(corner);

      for (var c = 0; c < cols; c++) {
        var th = document.createElement('th');
        th.className = 'tbl-col-head';
        var w = colWidths[c] || 110;
        th.style.width = w + 'px';
        th.style.minWidth = w + 'px';

        var lbl = document.createElement('span');
        lbl.textContent = colName(c);
        th.appendChild(lbl);

        var delCol = document.createElement('button');
        delCol.type = 'button';
        delCol.className = 'cell-x';
        delCol.dataset.delCol = String(c);
        delCol.title = 'Delete column';
        delCol.innerHTML = '&times;';
        th.appendChild(delCol);

        var resizer = document.createElement('span');
        resizer.className = 'xl-col-resizer';
        resizer.dataset.colIndex = String(c);
        th.appendChild(resizer);

        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      tableEl.appendChild(thead);

      var tbody = document.createElement('tbody');
      for (var r = 0; r < rows; r++) {
        var tr = document.createElement('tr');
        var rowHead = document.createElement('th');
        rowHead.className = 'tbl-row-head';
        var num = document.createElement('span');
        num.textContent = String(r + 1);
        rowHead.appendChild(num);
        var delRow = document.createElement('button');
        delRow.type = 'button';
        delRow.className = 'cell-x';
        delRow.dataset.delRow = String(r);
        delRow.title = 'Delete row';
        delRow.innerHTML = '&times;';
        rowHead.appendChild(delRow);
        tr.appendChild(rowHead);

        for (var cc = 0; cc < cols; cc++) {
          var td = document.createElement('td');
          td.tabIndex = 0;
          var initialRaw = (cells && cells[r] && cells[r][cc]) ? String(cells[r][cc]) : '';
          td.dataset.raw = initialRaw;
          td.textContent = initialRaw;
          td.dataset.r = String(r);
          td.dataset.c = String(cc);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      tableEl.appendChild(tbody);
      recalcAll();
      updateSelectionUI();
    }

    build();

    // Column resizer drag
    var resizingCol = -1;
    var resizeStartX = 0;
    var resizeStartW = 110;
    tableEl.addEventListener('mousedown', function (e) {
      var resizer = e.target.closest('.xl-col-resizer');
      if (!resizer) return;
      e.preventDefault();
      e.stopPropagation();
      resizingCol = Number(resizer.dataset.colIndex);
      resizeStartX = e.clientX;
      resizeStartW = colWidths[resizingCol] || 110;
    });
    window.addEventListener('mousemove', function (e) {
      if (resizingCol < 0) return;
      var delta = (e.clientX - resizeStartX) / zoom;
      var nextW = Math.max(64, Math.round(resizeStartW + delta));
      colWidths[resizingCol] = nextW;
      var th = tableEl.querySelectorAll('thead th.tbl-col-head')[resizingCol];
      if (th) {
        th.style.width = nextW + 'px';
        th.style.minWidth = nextW + 'px';
      }
      updateTableWidth();
    });
    window.addEventListener('mouseup', function () {
      if (resizingCol >= 0) resizingCol = -1;
    });

    // Click cell to select, dblclick to edit
    tableEl.addEventListener('mousedown', function (e) {
      var td = e.target.closest('td');
      if (!td) return;
      if (editingTd && editingTd !== td) commitEdit(editingTd);
      selRow = Number(td.dataset.r) || 0;
      selCol = Number(td.dataset.c) || 0;
      updateSelectionUI();
      if (td !== editingTd) td.focus();
    });

    tableEl.addEventListener('dblclick', function (e) {
      var td = e.target.closest('td');
      if (!td) return;
      e.stopPropagation();
      selRow = Number(td.dataset.r) || 0;
      selCol = Number(td.dataset.c) || 0;
      enterEditMode(td);
    });

    tableEl.addEventListener('focusout', function (e) {
      var td = e.target.closest('td');
      if (td && td === editingTd) {
        commitEdit(td);
      }
    });

    tableEl.addEventListener('input', function (e) {
      if (e.target && e.target.tagName === 'TD' && e.target === editingTd) {
        fxInput.value = e.target.textContent;
      }
    });

    // Keyboard navigation & Excel shortcuts inside the grid
    tableEl.addEventListener('keydown', function (e) {
      var td = e.target.closest('td');
      if (!td) return;

      if (e.key === 'Escape' && editingTd === td) {
        e.preventDefault();
        e.stopPropagation();
        td.textContent = editOriginalRaw;
        commitEdit(td, editOriginalRaw);
        td.focus();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (editingTd === td) commitEdit(td);
        selRow = Math.min(rows - 1, selRow + 1);
        updateSelectionUI();
        var nextDown = getTd(selRow, selCol);
        if (nextDown) nextDown.focus();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (editingTd === td) commitEdit(td);
        if (e.shiftKey) {
          if (selCol > 0) selCol -= 1;
          else if (selRow > 0) { selRow -= 1; selCol = cols - 1; }
        } else {
          if (selCol + 1 < cols) selCol += 1;
          else if (selRow + 1 < rows) { selRow += 1; selCol = 0; }
        }
        updateSelectionUI();
        var nextTab = getTd(selRow, selCol);
        if (nextTab) nextTab.focus();
        return;
      }

      if (editingTd === td) return;

      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        enterEditMode(td);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'ArrowUp') selRow = Math.max(0, selRow - 1);
        else if (e.key === 'ArrowDown') selRow = Math.min(rows - 1, selRow + 1);
        else if (e.key === 'ArrowLeft') selCol = Math.max(0, selCol - 1);
        else if (e.key === 'ArrowRight') selCol = Math.min(cols - 1, selCol + 1);
        updateSelectionUI();
        var navTd = getTd(selRow, selCol);
        if (navTd) navTd.focus();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        pushHistory();
        td.dataset.raw = '';
        td.textContent = '';
        recalcAll();
        updateSelectionUI();
        scheduleSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        var isBold = td.getAttribute('data-bold') === '1';
        if (isBold) td.removeAttribute('data-bold');
        else td.setAttribute('data-bold', '1');
        updateSelectionUI();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        enterEditMode(td, e.key);
      }
    });

    // Formula bar editing
    fxInput.addEventListener('input', function () {
      var td = getTd(selRow, selCol);
      if (!td) return;
      td.dataset.raw = fxInput.value;
      if (fxInput.value.charAt(0) !== '=') {
        td.textContent = fxInput.value;
      }
    });
    fxInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var td = getTd(selRow, selCol);
        if (td) {
          pushHistory();
          td.dataset.raw = fxInput.value;
          recalcAll();
          scheduleSave();
        }
        selRow = Math.min(rows - 1, selRow + 1);
        updateSelectionUI();
        var nextTd = getTd(selRow, selCol);
        if (nextTd) nextTd.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        updateSelectionUI();
        var curTd = getTd(selRow, selCol);
        if (curTd) curTd.focus();
      }
    });
    fxInput.addEventListener('blur', function () {
      var td = getTd(selRow, selCol);
      if (td) {
        td.dataset.raw = fxInput.value;
        recalcAll();
        updateSelectionUI();
        scheduleSave();
      }
    });

    el.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var isAddCol = btn.hasAttribute('data-tbl-add-col');
      var isAddRow = btn.hasAttribute('data-tbl-add-row');
      var isDelCol = btn.hasAttribute('data-del-col');
      var isDelRow = btn.hasAttribute('data-del-row');
      var isBold = btn.hasAttribute('data-xl-bold');
      var isClear = btn.hasAttribute('data-xl-clear');
      var isCsv = btn.hasAttribute('data-xl-csv');
      if (!isAddCol && !isAddRow && !isDelCol && !isDelRow && !isBold && !isClear && !isCsv) return;
      e.stopPropagation();

      if (isBold) {
        var bTd = getTd(selRow, selCol);
        if (bTd) {
          if (bTd.getAttribute('data-bold') === '1') bTd.removeAttribute('data-bold');
          else bTd.setAttribute('data-bold', '1');
          updateSelectionUI();
        }
        return;
      }
      if (isClear) {
        var cTd = getTd(selRow, selCol);
        if (cTd) {
          pushHistory();
          cTd.dataset.raw = '';
          cTd.textContent = '';
          recalcAll();
          updateSelectionUI();
          scheduleSave();
        }
        return;
      }
      if (isCsv) {
        var rowsData = Array.prototype.map.call(tableEl.querySelectorAll('tbody tr'), function (tr) {
          return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
            var val = String(td.textContent || '');
            return '"' + val.replace(/"/g, '""') + '"';
          }).join(',');
        }).join('\n');
        var blob = new Blob([rowsData], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'spreadsheet.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        showToast('Exported spreadsheet.csv');
        return;
      }

      if (isDelCol || isDelRow) {
        var what = isDelCol ? 'column' : 'row';
        window.QFDialog.confirm({
          title: 'Delete this ' + what + '?',
          message: 'All values in this ' + what + ' will be removed.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          tone: 'danger'
        }).then(function (ok) {
          if (!ok) return;
          pushHistory();
          cells = readCells();
          if (isDelCol) {
            var dc = Number(btn.dataset.delCol);
            if (cols > 1) {
              cols -= 1;
              colWidths.splice(dc, 1);
            }
          } else if (isDelRow) {
            var dr = Number(btn.dataset.delRow);
            if (rows > 1) rows -= 1;
          }
          renderTable();
          markEdited();
        });
        return;
      }
      pushHistory();
      cells = readCells();
      if (isAddCol) {
        cols += 1;
        colWidths.push(110);
      } else if (isAddRow) {
        rows += 1;
      } else if (isDelCol) {
        var dc = Number(btn.dataset.delCol);
        if (cols > 1) {
          cols -= 1;
          colWidths.splice(dc, 1);
          cells = cells.map(function (rowArr) {
            return rowArr.filter(function (_, i) { return i !== dc; });
          });
        }
      } else {
        var dr = Number(btn.dataset.delRow);
        if (rows > 1) {
          rows -= 1;
          cells = cells.filter(function (_, i) { return i !== dr; });
        }
      }
      build();
      updateTableWidth();
      scheduleSave();
    });

    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  function createDoc(x, y, docData, w, h, customId) {
    var data = (docData && typeof docData === 'object') ? docData : {};
    var docTitle = typeof data.title === 'string' && data.title.trim() ? data.title : 'Untitled Document';
    var docIcon = typeof data.icon === 'string' && data.icon ? data.icon : '📄';
    var docStatus = typeof data.status === 'string' && data.status ? data.status : 'Draft';
    var docWide = Boolean(data.wide);
    var outlineOpen = data.outlineOpen !== undefined ? Boolean(data.outlineOpen) : false;

    var DEFAULT_DOC_HTML =
      '<div class="doc-callout doc-callout--info" data-callout="info">' +
        '<span class="doc-callout__icon" contenteditable="false">ℹ️</span>' +
        '<div class="doc-callout__body"><strong>Summary:</strong> Capture objectives, decisions, specs, or meeting notes in this live Confluence &amp; Word-style page.</div>' +
      '</div>' +
      '<h2>Overview</h2>' +
      '<p>Write your opening summary, project context, and goals here. Use the toolbar above for headings, tables, callouts, checklists, alignment, and Word export.</p>' +
      '<h2>Key Decisions</h2>' +
      '<ul>' +
        '<li>Define scope, owners, and target launch date.</li>' +
        '<li>Align stakeholders on open questions and trade-offs.</li>' +
      '</ul>' +
      '<h2>Action Items</h2>' +
      '<div class="doc-check-item"><input type="checkbox" class="doc-check-input"><span>Finalize architecture spec and share for review</span></div>' +
      '<div class="doc-check-item"><input type="checkbox" class="doc-check-input"><span>Confirm delivery milestones with engineering &amp; design</span></div>' +
      '<h2>Milestones</h2>' +
      '<table class="doc-inline-table"><thead><tr><th>Milestone</th><th>Owner</th><th>Target Date</th></tr></thead>' +
      '<tbody><tr><td>Discovery &amp; PRD</td><td>Product</td><td>Week 1</td></tr>' +
      '<tr><td>Build &amp; QA</td><td>Engineering</td><td>Week 3</td></tr></tbody></table>';

    var docHtml = typeof data.html === 'string' ? data.html : DEFAULT_DOC_HTML;

    var el = document.createElement('div');
    el.className = 'canvas-doc' + (docWide ? ' is-wide' : '');
    el.dataset.id = customId || nextId('doc');
    el.dataset.docIcon = docIcon;
    el.dataset.docStatus = docStatus;
    el.dataset.docWide = docWide ? '1' : '0';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = Math.max(540, Math.round(w || 780)) + 'px';
    el.style.height = Math.max(440, Math.round(h || 660)) + 'px';

    var DOC_ICONS = ['📄', '📋', '📝', '📘', '🚀', '💡', '✅', '📊', '📌', '🗂️'];
    var DOC_STATUSES = ['Draft', 'In Review', 'Approved'];

    function statusClass(st) {
      if (st === 'Approved') return 'doc-status-pill--approved';
      if (st === 'In Review') return 'doc-status-pill--review';
      return 'doc-status-pill--draft';
    }

    // 1. Word / Confluence Header Ribbon (draggable handle)
    var ribbon = document.createElement('div');
    ribbon.className = 'doc-ribbon';
    ribbon.innerHTML =
      '<div class="doc-ribbon__left">' +
        '<span class="doc-ribbon__badge" aria-hidden="true">W</span>' +
        '<span class="doc-ribbon__title" data-doc-ribbon-title></span>' +
        '<button type="button" class="doc-status-pill ' + statusClass(docStatus) + '" data-doc-status title="Click to change document status"></button>' +
      '</div>' +
      '<div class="doc-ribbon__actions">' +
        '<button type="button" class="doc-ribbon__btn' + (outlineOpen ? ' is-active' : '') + '" data-doc-outline title="Toggle Table of Contents outline">Outline</button>' +
        '<button type="button" class="doc-ribbon__btn" data-doc-fullscreen title="Expand to full-page Word / Confluence editor">⤢ Full page</button>' +
        '<button type="button" class="doc-ribbon__btn" data-doc-export-word title="Download as Microsoft Word (.doc)">.doc</button>' +
        '<button type="button" class="doc-ribbon__btn" data-doc-print title="Print or Save as PDF">Print</button>' +
      '</div>';

    var ribbonTitleEl = ribbon.querySelector('[data-doc-ribbon-title]');
    var statusBtn = ribbon.querySelector('[data-doc-status]');
    ribbonTitleEl.textContent = docTitle;
    statusBtn.textContent = docStatus;

    // 2. Rich Word-Processing Formatting Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'doc-toolbar';
    toolbar.innerHTML =
      '<select class="doc-tb-select" data-doc-block title="Paragraph style" aria-label="Paragraph style">' +
        '<option value="P">Normal text</option>' +
        '<option value="H1">Heading 1</option>' +
        '<option value="H2">Heading 2</option>' +
        '<option value="H3">Heading 3</option>' +
        '<option value="BLOCKQUOTE">Quote</option>' +
        '<option value="PRE">Code block</option>' +
      '</select>' +
      '<select class="doc-tb-select doc-tb-select--font" data-doc-font title="Font family" aria-label="Font family">' +
        '<option value="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Sans</option>' +
        '<option value="Georgia, Cambria, Times New Roman, serif">Serif</option>' +
        '<option value="Consolas, Monaco, Courier New, monospace">Mono</option>' +
      '</select>' +
      '<select class="doc-tb-select doc-tb-select--size" data-doc-size title="Font size" aria-label="Font size">' +
        '<option value="2">12px</option>' +
        '<option value="3" selected>14px</option>' +
        '<option value="4">18px</option>' +
        '<option value="5">24px</option>' +
      '</select>' +
      '<span class="doc-tb-sep"></span>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="italic" title="Italic (Ctrl+I)"><em>I</em></button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>' +
      '<label class="doc-tb-color" title="Text color"><span>A</span><input type="color" data-doc-forecolor value="#0f172a" aria-label="Text color"></label>' +
      '<button type="button" class="doc-tb-btn" data-doc-highlight title="Highlight text">🖍</button>' +
      '<span class="doc-tb-sep"></span>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="justifyLeft" title="Align left">≡</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="justifyCenter" title="Align center">≣</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="justifyRight" title="Align right">⫤</button>' +
      '<span class="doc-tb-sep"></span>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="insertUnorderedList" title="Bullet list">• List</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="insertOrderedList" title="Numbered list">1. List</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-insert="checklist" title="Insert checklist item">☑ Check</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="outdent" title="Decrease indent">⇤</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="indent" title="Increase indent">⇥</button>' +
      '<span class="doc-tb-sep"></span>' +
      '<button type="button" class="doc-tb-btn" data-doc-insert="callout" title="Insert Confluence info callout">ⓘ Callout</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-insert="table" title="Insert 3×3 table">⊞ Table</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="insertHorizontalRule" title="Insert divider">—</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-insert="link" title="Insert hyperlink">🔗</button>' +
      '<span class="doc-tb-sep"></span>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="undo" title="Undo (Ctrl+Z)">↶</button>' +
      '<button type="button" class="doc-tb-btn" data-doc-cmd="redo" title="Redo (Ctrl+Y)">↷</button>';

    // 3. Workspace: Optional Confluence Outline Sidebar + Paper Page Surface
    var workspace = document.createElement('div');
    workspace.className = 'doc-workspace';

    var outlineEl = document.createElement('aside');
    outlineEl.className = 'doc-outline';
    outlineEl.hidden = !outlineOpen;
    outlineEl.innerHTML =
      '<div class="doc-outline__head">Outline</div>' +
      '<nav class="doc-outline__list" data-doc-outline-list></nav>';

    var scrollWrap = document.createElement('div');
    scrollWrap.className = 'doc-scroll';

    var page = document.createElement('article');
    page.className = 'doc-page';

    var pageHeader = document.createElement('header');
    pageHeader.className = 'doc-page__header';
    pageHeader.innerHTML =
      '<div class="doc-page__title-row">' +
        '<button type="button" class="doc-page__icon" data-doc-icon-btn title="Click to change page icon"></button>' +
        '<h1 class="doc-page__title" contenteditable="true" data-placeholder="Untitled Document"></h1>' +
      '</div>' +
      '<div class="doc-page__meta">' +
        '<span class="doc-page__meta-item" data-doc-meta-author>QuantalFlow Doc</span>' +
        '<span class="doc-page__meta-dot">•</span>' +
        '<span class="doc-page__meta-item" data-doc-meta-updated>Edited just now</span>' +
      '</div>';

    var iconBtn = pageHeader.querySelector('[data-doc-icon-btn]');
    var pageTitleEl = pageHeader.querySelector('.doc-page__title');
    iconBtn.textContent = docIcon;
    pageTitleEl.textContent = docTitle;

    var editor = document.createElement('div');
    editor.className = 'doc-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-label', 'Document content');
    editor.innerHTML = docHtml;

    page.appendChild(pageHeader);
    page.appendChild(editor);
    scrollWrap.appendChild(page);
    workspace.appendChild(outlineEl);
    workspace.appendChild(scrollWrap);

    // 4. Bottom Word-style Status Bar
    var statusBar = document.createElement('div');
    statusBar.className = 'doc-statusbar';
    statusBar.innerHTML =
      '<div class="doc-statusbar__left">' +
        '<span data-doc-words>0 words</span>' +
        '<span class="doc-statusbar__sep">·</span>' +
        '<span data-doc-chars>0 chars</span>' +
        '<span class="doc-statusbar__sep">·</span>' +
        '<span data-doc-readtime>1 min read</span>' +
      '</div>' +
      '<div class="doc-statusbar__right">' +
        '<button type="button" class="doc-statusbar__btn" data-doc-width-toggle title="Toggle Standard / Full width page">' +
          (docWide ? 'Full width' : 'Standard width') +
        '</button>' +
      '</div>';

    el.appendChild(ribbon);
    el.appendChild(toolbar);
    el.appendChild(workspace);
    el.appendChild(statusBar);

    var wordsEl = statusBar.querySelector('[data-doc-words]');
    var charsEl = statusBar.querySelector('[data-doc-chars]');
    var readTimeEl = statusBar.querySelector('[data-doc-readtime]');
    var widthBtn = statusBar.querySelector('[data-doc-width-toggle]');
    var outlineListEl = outlineEl.querySelector('[data-doc-outline-list]');
    var metaUpdatedEl = pageHeader.querySelector('[data-doc-meta-updated]');
    var fullscreenBtn = ribbon.querySelector('[data-doc-fullscreen]');
    var outlineBtn = ribbon.querySelector('[data-doc-outline]');

    function syncStatsAndOutline() {
      var rawText = ((pageTitleEl.textContent || '') + ' ' + (editor.innerText || '')).trim();
      var words = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
      var chars = (editor.innerText || '').replace(/\n/g, '').length;
      var mins = Math.max(1, Math.ceil(words / 220));
      wordsEl.textContent = words + (words === 1 ? ' word' : ' words');
      charsEl.textContent = chars + ' chars';
      readTimeEl.textContent = mins + ' min read';

      // Build Confluence-style Outline from H1/H2/H3 headings
      if (outlineListEl) {
        outlineListEl.innerHTML = '';
        var headings = editor.querySelectorAll('h1, h2, h3');
        if (!headings.length) {
          var empty = document.createElement('div');
          empty.className = 'doc-outline__empty';
          empty.textContent = 'Add H1–H3 headings to build an outline.';
          outlineListEl.appendChild(empty);
        } else {
          headings.forEach(function (h, idx) {
            var txt = (h.textContent || '').trim();
            if (!txt) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'doc-outline__item doc-outline__item--' + h.tagName.toLowerCase();
            btn.textContent = txt;
            btn.addEventListener('click', function (ev) {
              ev.stopPropagation();
              h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            outlineListEl.appendChild(btn);
          });
        }
      }
    }

    function updateToolbarStates() {
      ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'].forEach(function (cmd) {
        var btn = toolbar.querySelector('[data-doc-cmd="' + cmd + '"]');
        if (!btn) return;
        try {
          btn.classList.toggle('is-active', document.queryCommandState(cmd));
        } catch (_) {}
      });
    }

    function markEdited() {
      if (metaUpdatedEl) {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        metaUpdatedEl.textContent = 'Saved ' + hh + ':' + mm;
      }
      syncStatsAndOutline();
      scheduleSave();
    }

    // Keep checkboxes serialized as attributes in innerHTML
    editor.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('doc-check-input')) {
        if (e.target.checked) e.target.setAttribute('checked', 'checked');
        else e.target.removeAttribute('checked');
        var row = e.target.closest('.doc-check-item');
        if (row) row.classList.toggle('is-checked', e.target.checked);
        markEdited();
      }
    });

    // Hydrate checked classes on load
    editor.querySelectorAll('.doc-check-input').forEach(function (cb) {
      var row = cb.closest('.doc-check-item');
      if (row) row.classList.toggle('is-checked', cb.checked || cb.hasAttribute('checked'));
    });

    pageTitleEl.addEventListener('input', function () {
      var t = (pageTitleEl.textContent || '').trim() || 'Untitled Document';
      ribbonTitleEl.textContent = t;
      markEdited();
    });

    pageTitleEl.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        editor.focus();
      }
    });

    editor.addEventListener('input', markEdited);
    editor.addEventListener('keyup', updateToolbarStates);
    editor.addEventListener('mouseup', updateToolbarStates);
    editor.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null);
        markEdited();
      }
    });

    // Smooth vertical scroll inside the document without panning the canvas
    scrollWrap.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
      }
    }, { passive: true });
    outlineEl.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
    }, { passive: true });

    // Prevent toolbar buttons from stealing text selection
    toolbar.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) {
        e.preventDefault();
      }
      e.stopPropagation();
    });

    toolbar.addEventListener('click', function (e) {
      var cmdBtn = e.target.closest('[data-doc-cmd]');
      if (cmdBtn) {
        e.stopPropagation();
        if (currentBoardCaps && !currentBoardCaps.canEdit) return;
        editor.focus();
        document.execCommand(cmdBtn.dataset.docCmd, false, null);
        updateToolbarStates();
        markEdited();
        return;
      }

      var hlBtn = e.target.closest('[data-doc-highlight]');
      if (hlBtn) {
        e.stopPropagation();
        if (currentBoardCaps && !currentBoardCaps.canEdit) return;
        editor.focus();
        var cur = '';
        try { cur = document.queryCommandValue('hiliteColor') || ''; } catch (_) {}
        var isLit = cur && cur !== 'transparent' && cur !== 'rgba(0, 0, 0, 0)' && cur !== 'rgb(255, 255, 255)';
        document.execCommand('hiliteColor', false, isLit ? 'transparent' : '#fef08a');
        markEdited();
        return;
      }

      var insBtn = e.target.closest('[data-doc-insert]');
      if (insBtn) {
        e.stopPropagation();
        if (currentBoardCaps && !currentBoardCaps.canEdit) return;
        editor.focus();
        var kind = insBtn.dataset.docInsert;
        if (kind === 'callout') {
          document.execCommand('insertHTML', false,
            '<div class="doc-callout doc-callout--info" data-callout="info">' +
              '<span class="doc-callout__icon" contenteditable="false">💡</span>' +
              '<div class="doc-callout__body"><strong>Note:</strong> Highlight key context, risks, or decisions here.</div>' +
            '</div><p><br></p>');
        } else if (kind === 'table') {
          document.execCommand('insertHTML', false,
            '<table class="doc-inline-table"><thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead>' +
            '<tbody><tr><td>Item A</td><td>Owner</td><td>Status</td></tr>' +
            '<tr><td>Item B</td><td>Owner</td><td>Status</td></tr></tbody></table><p><br></p>');
        } else if (kind === 'checklist') {
          document.execCommand('insertHTML', false,
            '<div class="doc-check-item"><input type="checkbox" class="doc-check-input"><span>New action item</span></div>');
        } else if (kind === 'link') {
          window.QFDialog.prompt({
            title: 'Insert link',
            message: 'Enter the destination URL (https://...).',
            defaultValue: 'https://',
            placeholder: 'https://example.com',
            confirmLabel: 'Insert',
            cancelLabel: 'Cancel'
          }).then(function (url) {
            if (url && /^https?:\/\//i.test(url.trim())) {
              editor.focus();
              document.execCommand('createLink', false, url.trim());
              markEdited();
            }
          });
          return;
        }
        markEdited();
      }
    });

    toolbar.querySelector('[data-doc-block]')?.addEventListener('change', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      editor.focus();
      document.execCommand('formatBlock', false, '<' + e.target.value + '>');
      markEdited();
    });

    toolbar.querySelector('[data-doc-font]')?.addEventListener('change', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      editor.focus();
      document.execCommand('fontName', false, e.target.value);
      markEdited();
    });

    toolbar.querySelector('[data-doc-size]')?.addEventListener('change', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      editor.focus();
      document.execCommand('fontSize', false, e.target.value);
      markEdited();
    });

    toolbar.querySelector('[data-doc-forecolor]')?.addEventListener('input', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      editor.focus();
      document.execCommand('foreColor', false, e.target.value);
      markEdited();
    });

    // Cycle Confluence page icon
    iconBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      var curIdx = DOC_ICONS.indexOf(el.dataset.docIcon || '📄');
      var nextIcon = DOC_ICONS[(curIdx + 1) % DOC_ICONS.length];
      el.dataset.docIcon = nextIcon;
      iconBtn.textContent = nextIcon;
      scheduleSave();
    });

    // Cycle Document status pill
    statusBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentBoardCaps && !currentBoardCaps.canEdit) return;
      var idx = DOC_STATUSES.indexOf(el.dataset.docStatus || 'Draft');
      var next = DOC_STATUSES[(idx + 1) % DOC_STATUSES.length];
      el.dataset.docStatus = next;
      statusBtn.textContent = next;
      statusBtn.className = 'doc-status-pill ' + statusClass(next);
      scheduleSave();
    });

    // Toggle Outline sidebar
    outlineBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      outlineEl.hidden = !outlineEl.hidden;
      outlineBtn.classList.toggle('is-active', !outlineEl.hidden);
      syncStatsAndOutline();
    });

    // Toggle Standard / Full width page
    widthBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isWide = el.classList.toggle('is-wide');
      el.dataset.docWide = isWide ? '1' : '0';
      widthBtn.textContent = isWide ? 'Full width' : 'Standard width';
      scheduleSave();
    });

    // Full-page Focus Mode (portals to document.body so canvas transform doesn't clip fixed overlay)
    var savedRect = null;
    function setFullscreen(open) {
      if (open && !el.classList.contains('is-fullscreen')) {
        savedRect = {
          left: el.style.left,
          top: el.style.top,
          width: el.style.width,
          height: el.style.height
        };
        document.body.appendChild(el);
        el.classList.add('is-fullscreen');
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.height = '';
        fullscreenBtn.textContent = '⤡ Back to canvas';
        fullscreenBtn.classList.add('is-active');
        outlineEl.hidden = false;
        outlineBtn.classList.add('is-active');
        syncStatsAndOutline();
        editor.focus();
      } else if (!open && el.classList.contains('is-fullscreen')) {
        el.classList.remove('is-fullscreen');
        if (savedRect) {
          el.style.left = savedRect.left;
          el.style.top = savedRect.top;
          el.style.width = savedRect.width;
          el.style.height = savedRect.height;
        }
        world.appendChild(el);
        fullscreenBtn.textContent = '⤢ Full page';
        fullscreenBtn.classList.remove('is-active');
        updateMinimap();
      }
    }

    fullscreenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setFullscreen(!el.classList.contains('is-fullscreen'));
    });

    // Export as Microsoft Word (.doc)
    function buildExportHtml() {
      var safeTitle = (pageTitleEl.textContent || 'Untitled Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return (
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8"><title>' + safeTitle + '</title>' +
        '<style>' +
        'body{font-family:Calibri,Segoe UI,Arial,sans-serif;color:#111827;line-height:1.65;max-width:760px;margin:32px auto;padding:0 24px;}' +
        'h1{font-size:26pt;margin:0 0 12px;color:#0f172a;}' +
        'h2{font-size:16pt;margin:22px 0 8px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;}' +
        'h3{font-size:13pt;margin:16px 0 6px;color:#334155;}' +
        'table{border-collapse:collapse;width:100%;margin:14px 0;}' +
        'th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left;}' +
        'th{background:#f1f5f9;font-weight:700;}' +
        'blockquote{border-left:3px solid #2563eb;margin:12px 0;padding:6px 14px;color:#475569;background:#f8fafc;}' +
        '.doc-callout{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin:12px 0;}' +
        'pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;font-family:Consolas,monospace;}' +
        '</style></head><body>' +
        '<h1>' + (el.dataset.docIcon || '') + ' ' + safeTitle + '</h1>' +
        editor.innerHTML +
        '</body></html>'
      );
    }

    ribbon.querySelector('[data-doc-export-word]')?.addEventListener('click', function (e) {
      e.stopPropagation();
      var htmlDoc = buildExportHtml();
      var blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var slug = ((pageTitleEl.textContent || 'document').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'document');
      a.href = url;
      a.download = slug + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded ' + slug + '.doc');
    });

    ribbon.querySelector('[data-doc-print]')?.addEventListener('click', function (e) {
      e.stopPropagation();
      var win = window.open('', '_blank', 'width=900,height=720');
      if (!win) { showToast('Allow popups to print document'); return; }
      win.document.open();
      win.document.write(buildExportHtml());
      win.document.close();
      setTimeout(function () { win.focus(); win.print(); }, 250);
    });

    // Respect board read-only / viewer permissions
    if (currentBoardCaps && !currentBoardCaps.canEdit) {
      pageTitleEl.contentEditable = 'false';
      editor.contentEditable = 'false';
    }

    el._exitFullscreen = function () { setFullscreen(false); };
    syncStatsAndOutline();

    world.appendChild(el);
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  function createFrame(x, y, title, w, h, customId) {
    var el = document.createElement('div');
    el.className = 'canvas-frame';
    el.dataset.id = customId || nextId('frame');
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = (w || 560) + 'px';
    el.style.height = (h || 340) + 'px';
    el.innerHTML = '<span class="canvas-frame__title" contenteditable="true">' + (title || 'New Section Frame') + '</span>';
    world.insertBefore(el, world.querySelector('.canvas-sticky, .canvas-shape, .canvas-text, .live-cursor'));
    bindInteractiveElement(el);
    updateMinimap();
    syncEmptyBoardStarter();
    return el;
  }

  function createCommentPin(x, y, text, author, customId) {
    var el = document.createElement('div');
    el.className = 'canvas-comment';
    el.dataset.id = customId || nextId('comment');
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    var pinNum = world.querySelectorAll('.canvas-comment').length + 1;
    var noteText = text || 'Add a note or question here…';
    var user = author || 'You';
    el.innerHTML =
      '<button class="canvas-comment__pin" type="button" title="Toggle comment thread">' + pinNum + '</button>' +
      '<div class="canvas-comment__card">' +
        '<div class="canvas-comment__meta"><strong>' + user + '</strong><span>Just now</span></div>' +
        '<div class="canvas-comment__body" contenteditable="true">' + noteText + '</div>' +
        '<div class="canvas-comment__actions">' +
          '<button class="comment-resolve-btn" type="button">Resolve &#10003;</button>' +
        '</div>' +
      '</div>';

    var pinBtn = el.querySelector('.canvas-comment__pin');
    pinBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      el.classList.toggle('is-open');
    });
    var resolveBtn = el.querySelector('.comment-resolve-btn');
    resolveBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      pushHistory();
      el.remove();
      syncEmptyBoardStarter();
      scheduleSave();
    });
    el.classList.add('is-open');
    world.appendChild(el);
    bindInteractiveElement(el);
    syncEmptyBoardStarter();
    return el;
  }

  /* ---------- Tool Switching ---------- */
  var toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
  var colorPopover = document.getElementById('color-popover');
  var shapePopover = document.getElementById('shape-popover');
  var connectorPopover = document.getElementById('connector-popover');
  var penPopover = document.getElementById('pen-popover');
  var iconModal = document.getElementById('modal-icons');

  function setTool(toolName) {
    currentTool = toolName;
    toolBtns.forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tool === toolName);
    });

    if (['sticky', 'shape', 'text', 'frame', 'pen', 'comment', 'connector'].indexOf(toolName) !== -1) {
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
    }

    if (colorPopover) colorPopover.hidden = (toolName !== 'sticky');
    if (shapePopover) shapePopover.hidden = (toolName !== 'shape');
    if (connectorPopover) connectorPopover.hidden = (toolName !== 'connector');
    if (penPopover) penPopover.hidden = (toolName !== 'pen');
    world.classList.toggle('show-connection-points', toolName === 'connector' && currentConnectorType === 'points');

    if (toolName === 'icon') {
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
      openIconPicker();
    }

    if (toolName === 'clipart') {
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
      openClipartPicker();
    }

    viewport.classList.toggle('is-panning', toolName === 'hand');
    viewport.classList.toggle('is-crosshair', ['sticky', 'shape', 'text', 'frame', 'pen', 'comment', 'connector', 'icon', 'clipart'].indexOf(toolName) !== -1);

    if (toolName !== 'connector' && pendingConnectorFromId) {
      var prev = world.querySelector('[data-id="' + pendingConnectorFromId + '"]');
      if (prev) prev.classList.remove('is-connecting');
      pendingConnectorFromId = null;
    }
  }

  toolBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTool(btn.dataset.tool);
    });
  });

  /* ---------- More Tools Popover (Miro-style extended tool library) ---------- */
  var moreToolsBtn = document.getElementById('btn-more-tools');
  var moreToolsPopover = document.getElementById('more-tools-popover');

  function toggleMoreTools(show) {
    if (!moreToolsPopover) return;
    if (show && moreToolsPopover.hidden) {
      // Anchor next to the "+" button, clamped within viewport so mobile never clips.
      var host = moreToolsPopover.offsetParent;
      if (host && moreToolsBtn) {
        var br = moreToolsBtn.getBoundingClientRect();
        var hr = host.getBoundingClientRect();
        var popW = 240;
        var rawLeft = Math.round(br.right - hr.left + 10);
        var clampedLeft = Math.max(8, Math.min(hr.width - popW - 8, rawLeft));
        var rawTop = Math.max(8, Math.round(br.top - hr.top));
        var clampedTop = Math.min(Math.max(8, hr.height - 260), rawTop);
        moreToolsPopover.style.left = clampedLeft + 'px';
        moreToolsPopover.style.top = clampedTop + 'px';
      }
    }
    moreToolsPopover.hidden = !show;
    if (moreToolsBtn) moreToolsBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  moreToolsBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMoreTools(moreToolsPopover.hidden);
  });

  document.addEventListener('click', function (e) {
    if (moreToolsPopover && !moreToolsPopover.hidden && !moreToolsPopover.contains(e.target)) {
      toggleMoreTools(false);
    }
  });

  document.querySelectorAll('[data-more-tool]').forEach(function (item) {
    item.addEventListener('click', function () {
      toggleMoreTools(false);
      var kind = item.dataset.moreTool;
      // Place below any existing content so the new tool never overlaps
      // components the user already has on the canvas (mirrors the template
      // picker behaviour above).
      var offset = hasCanvasItems() ? { x: 180, y: 540 } : { x: 180, y: 120 };
      insertTemplateByType(kind, offset.x, offset.y);
    });
  });

  /* ---------- Popover Controls ---------- */
  document.querySelectorAll('.swatch[data-color]').forEach(function (s) {
    s.addEventListener('click', function () {
      document.querySelectorAll('.swatch[data-color]').forEach(function (sw) { sw.classList.remove('is-selected'); });
      s.classList.add('is-selected');
      currentColor = s.dataset.color || 'yellow';
    });
  });

  document.querySelectorAll('.shape-option[data-shape-type]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.shape-option').forEach(function (b) { b.classList.remove('is-selected'); });
      btn.classList.add('is-selected');
      currentShapeType = btn.dataset.shapeType || 'rect';
    });
  });

  document.querySelectorAll('.connector-menu__item[data-connector-type]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.connector-menu__item[data-connector-type]').forEach(function (b) {
        b.classList.remove('is-selected');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-selected');
      btn.setAttribute('aria-checked', 'true');
      currentConnectorType = btn.dataset.connectorType || 'orthogonal';
      world.classList.toggle('show-connection-points', currentTool === 'connector' && currentConnectorType === 'points');
      showToast('Selected ' + btn.innerText.trim() + ' — click two items to connect');
    });
  });

  document.getElementById('conn-current-tool-only')?.addEventListener('change', function (e) {
    connectorCurrentToolOnly = Boolean(e.target.checked);
  });

  document.getElementById('conn-auto-routing')?.addEventListener('change', function (e) {
    connectorAutoRouting = Boolean(e.target.checked);
    renderConnectors();
  });

  document.querySelectorAll('.pen-swatch[data-pen-color]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      document.querySelectorAll('.pen-swatch').forEach(function (b) { b.classList.remove('is-selected'); });
      sw.classList.add('is-selected');
      currentPenColor = sw.dataset.penColor || '#1a1a2e';
    });
  });

  var penWidthSelect = document.getElementById('pen-width-select');
  if (penWidthSelect) {
    penWidthSelect.addEventListener('change', function () {
      currentPenWidth = Number(penWidthSelect.value) || 5;
    });
  }

  /* ---------- Icon Picker (Lucide library, lazy-loaded, multi-select) ---------- */
  var iconGrid = document.getElementById('icon-grid');
  var iconSearch = document.getElementById('icon-search');
  var iconGridCount = document.getElementById('icon-grid-count');
  var iconInsertBtn = document.getElementById('modal-icons-insert');
  var iconClearBtn = document.getElementById('modal-icons-clear');
  var iconLibraryState = 'idle'; // idle | loading | ready | failed
  var iconLibraryCallbacks = [];
  var selectedIconIds = [];
  var ICON_RENDER_LIMIT = 360; // cap DOM size; search narrows instead of listing everything

  function syncIconSelectionControls() {
    var count = selectedIconIds.length;
    if (iconInsertBtn) {
      iconInsertBtn.disabled = count === 0;
      iconInsertBtn.textContent = count > 0 ? ('Insert Selected (' + count + ')') : 'Insert Selected (0)';
    }
    if (iconClearBtn) {
      iconClearBtn.hidden = count === 0;
    }
  }

  function ensureIconLibrary(done) {
    if (window.CanvasIcons) { done(); return; }
    if (iconLibraryState === 'failed') {
      showToast('Could not load the icon library');
      return;
    }
    iconLibraryCallbacks.push(done);
    if (iconLibraryState === 'loading') return;
    iconLibraryState = 'loading';
    var src = (iconModal && iconModal.dataset.iconsSrc) || '/assets/js/canvas-icons.js';
    var script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', function () {
      iconLibraryState = 'ready';
      iconLibraryCallbacks.forEach(function (cb) { cb(); });
      iconLibraryCallbacks = [];
    });
    script.addEventListener('error', function () {
      iconLibraryState = 'failed';
      iconLibraryCallbacks = [];
      showToast('Could not load the icon library');
    });
    document.head.appendChild(script);
  }

  function iconMatchesQuery(searchStr, q) {
    // Per-word prefix match against space-separated tokens. Plain substring
    // matching made "rocket" hit every icon tagged "sprocket" (c-o-g etc.).
    var tokens = searchStr.split(' ');
    var words = q.split(/\s+/).filter(Boolean);
    return words.every(function (w) {
      return tokens.some(function (t) { return t.indexOf(w) === 0; });
    });
  }

  function renderIconGrid(query) {
    if (!iconGrid) return;
    var lib = window.CanvasIcons;
    if (!lib) return;
    var q = String(query || '').trim().toLowerCase();
    var matches = lib.list;
    if (q) {
      matches = lib.list.filter(function (ic) { return iconMatchesQuery(ic.search, q); });
    }
    var shown = matches.slice(0, ICON_RENDER_LIMIT);
    iconGrid.innerHTML = shown.map(function (ic) {
      var isSel = selectedIconIds.indexOf(ic.id) !== -1;
      return '<button class="icon-option' + (isSel ? ' is-selected' : '') + '"' +
        ' data-icon-id="' + ic.id + '" type="button" role="option" aria-selected="' + (isSel ? 'true' : 'false') + '"' +
        ' title="' + ic.label + '">' +
        '<span class="icon-option__check" aria-hidden="true">&#10003;</span>' +
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic.body + '</svg>' +
        '<span class="icon-option__label">' + ic.label + '</span>' +
        '</button>';
    }).join('');

    if (iconGridCount) {
      var selPrefix = selectedIconIds.length ? (selectedIconIds.length + ' selected \u2022 ') : '';
      iconGridCount.textContent = selPrefix + (shown.length === matches.length
        ? 'Showing ' + shown.length + ' of ' + lib.count + ' icons'
        : 'Showing ' + shown.length + ' of ' + matches.length + ' matches (' + lib.count + ' total) — keep typing to narrow');
    }
    syncIconSelectionControls();
  }

  function placeIconsAtWorld(x, y, iconIdsToPlace) {
    var list = Array.isArray(iconIdsToPlace) && iconIdsToPlace.length
      ? iconIdsToPlace.slice()
      : (selectedIconIds.length ? selectedIconIds.slice() : [currentIconId || 'rocket']);
    pushHistory();
    var size = 48;
    var gap = 68;
    var cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(list.length))));
    var rows = Math.ceil(list.length / cols);
    var startX = x - ((Math.min(list.length, cols) - 1) * gap) / 2;
    var startY = y - ((rows - 1) * gap) / 2;
    var lastIcon = null;
    list.forEach(function (id, idx) {
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      lastIcon = createIcon(startX + col * gap - size / 2, startY + row * gap - size / 2, id, currentIconColor, size);
    });
    if (lastIcon) selectElement(lastIcon);
    setTool('select');
    scheduleSave();
    if (list.length > 1) {
      showToast('Placed ' + list.length + ' icons on the canvas');
    }
  }

  function placeIconAtWorld(x, y) {
    placeIconsAtWorld(x, y);
  }

  function openIconPicker() {
    if (!iconModal) return;
    openModal(iconModal);
    syncIconSelectionControls();
    if (iconSearch) setTimeout(function () { iconSearch.focus(); }, 50);
    ensureIconLibrary(function () {
      renderIconGrid(iconSearch ? iconSearch.value : '');
    });
  }

  if (iconSearch) {
    var iconSearchTimer = null;
    iconSearch.addEventListener('input', function () {
      clearTimeout(iconSearchTimer);
      iconSearchTimer = setTimeout(function () {
        ensureIconLibrary(function () { renderIconGrid(iconSearch.value); });
      }, 120);
    });
  }

  iconGrid?.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-icon-id]');
    if (!opt) return;
    var id = opt.dataset.iconId;
    if (!id) return;
    var idx = selectedIconIds.indexOf(id);
    if (idx === -1) {
      selectedIconIds.push(id);
      currentIconId = id;
    } else {
      selectedIconIds.splice(idx, 1);
      if (selectedIconIds.length) {
        currentIconId = selectedIconIds[selectedIconIds.length - 1];
      }
    }
    var isSel = selectedIconIds.indexOf(id) !== -1;
    opt.classList.toggle('is-selected', isSel);
    opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
    syncIconSelectionControls();
    if (iconGridCount && window.CanvasIcons) {
      var shownCount = iconGrid.querySelectorAll('.icon-option').length;
      var selPrefix = selectedIconIds.length ? (selectedIconIds.length + ' selected \u2022 ') : '';
      iconGridCount.textContent = selPrefix + 'Showing ' + shownCount + ' of ' + window.CanvasIcons.count + ' icons';
    }
  });

  iconGrid?.addEventListener('dblclick', function (e) {
    var opt = e.target.closest('[data-icon-id]');
    if (!opt) return;
    var id = opt.dataset.iconId;
    if (!id) return;
    if (selectedIconIds.indexOf(id) === -1) selectedIconIds.push(id);
    currentIconId = id;
    var toInsert = selectedIconIds.slice();
    selectedIconIds = [];
    syncIconSelectionControls();
    closeModal(iconModal);
    var rect = viewport.getBoundingClientRect();
    var pt = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    placeIconsAtWorld(pt.x, pt.y, toInsert);
  });

  iconInsertBtn?.addEventListener('click', function () {
    if (!selectedIconIds.length) return;
    var toInsert = selectedIconIds.slice();
    selectedIconIds = [];
    syncIconSelectionControls();
    closeModal(iconModal);
    var rect = viewport.getBoundingClientRect();
    var pt = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    placeIconsAtWorld(pt.x, pt.y, toInsert);
  });

  iconClearBtn?.addEventListener('click', function () {
    selectedIconIds = [];
    iconGrid?.querySelectorAll('.icon-option.is-selected').forEach(function (b) {
      b.classList.remove('is-selected');
      b.setAttribute('aria-selected', 'false');
    });
    syncIconSelectionControls();
    renderIconGrid(iconSearch ? iconSearch.value : '');
  });

  document.querySelectorAll('.icon-swatch[data-icon-color]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      document.querySelectorAll('.icon-swatch').forEach(function (b) { b.classList.remove('is-selected'); });
      sw.classList.add('is-selected');
      currentIconColor = sw.dataset.iconColor || 'ink';
    });
  });

  document.getElementById('modal-icons-close')?.addEventListener('click', function () { closeModal(iconModal); });
  document.getElementById('modal-icons-done')?.addEventListener('click', function () { closeModal(iconModal); });
  iconModal?.addEventListener('click', function (e) {
    if (e.target === iconModal) closeModal(iconModal);
  });

  /* ---------- Clipart Picker (Twemoji library, lazy-loaded, multi-select) ---------- */
  var clipartModal = document.getElementById('modal-clipart');
  var clipartGrid = document.getElementById('clipart-grid');
  var clipartSearch = document.getElementById('clipart-search');
  var clipartGridCount = document.getElementById('clipart-grid-count');
  var clipartInsertBtn = document.getElementById('modal-clipart-insert');
  var clipartClearBtn = document.getElementById('modal-clipart-clear');
  var clipartLibraryState = 'idle'; // idle | loading | ready | failed
  var clipartLibraryCallbacks = [];
  var selectedClipartIds = [];
  var CLIPART_RENDER_LIMIT = 360; // cap DOM size; search narrows instead of listing everything

  function syncClipartSelectionControls() {
    var count = selectedClipartIds.length;
    if (clipartInsertBtn) {
      clipartInsertBtn.disabled = count === 0;
      clipartInsertBtn.textContent = count > 0 ? ('Insert Selected (' + count + ')') : 'Insert Selected (0)';
    }
    if (clipartClearBtn) {
      clipartClearBtn.hidden = count === 0;
    }
  }

  function ensureClipartLibrary(done) {
    if (window.CanvasCliparts) { done(); return; }
    if (clipartLibraryState === 'failed') {
      showToast('Could not load the clipart library');
      return;
    }
    clipartLibraryCallbacks.push(done);
    if (clipartLibraryState === 'loading') return;
    clipartLibraryState = 'loading';
    var src = (clipartModal && clipartModal.dataset.clipartSrc) || '/assets/js/canvas-clipart.js';
    var script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', function () {
      clipartLibraryState = 'ready';
      clipartLibraryCallbacks.forEach(function (cb) { cb(); });
      clipartLibraryCallbacks = [];
    });
    script.addEventListener('error', function () {
      clipartLibraryState = 'failed';
      clipartLibraryCallbacks = [];
      showToast('Could not load the clipart library');
    });
    document.head.appendChild(script);
  }

  function clipartMatchesQuery(searchStr, q) {
    // Per-word prefix match against space-separated tokens (same rule the
    // icon picker uses) so "dog" never hits "hot dog"-less false tokens.
    var tokens = searchStr.split(' ');
    var words = q.split(/\s+/).filter(Boolean);
    return words.every(function (w) {
      return tokens.some(function (t) { return t.indexOf(w) === 0; });
    });
  }

  function renderClipartGrid(query) {
    if (!clipartGrid) return;
    var lib = window.CanvasCliparts;
    if (!lib) return;
    var q = String(query || '').trim().toLowerCase();
    var matches = lib.list;
    if (q) {
      matches = lib.list.filter(function (c) { return clipartMatchesQuery(c.search, q); });
    }
    var shown = matches.slice(0, CLIPART_RENDER_LIMIT);
    clipartGrid.innerHTML = shown.map(function (c) {
      var isSel = selectedClipartIds.indexOf(c.id) !== -1;
      return '<button class="icon-option clipart-option' + (isSel ? ' is-selected' : '') + '"' +
        ' data-clipart-id="' + c.id + '" type="button" role="option" aria-selected="' + (isSel ? 'true' : 'false') + '"' +
        ' title="' + c.label + '">' +
        '<span class="icon-option__check" aria-hidden="true">&#10003;</span>' +
        '<svg viewBox="' + c.viewBox + '" width="28" height="28" aria-hidden="true">' + c.body + '</svg>' +
        '<span class="icon-option__label">' + c.label + '</span>' +
        '</button>';
    }).join('');

    if (clipartGridCount) {
      var selPrefix = selectedClipartIds.length ? (selectedClipartIds.length + ' selected \u2022 ') : '';
      clipartGridCount.textContent = selPrefix + (shown.length === matches.length
        ? 'Showing ' + shown.length + ' of ' + lib.count + ' cliparts'
        : 'Showing ' + shown.length + ' of ' + matches.length + ' matches (' + lib.count + ' total) — keep typing to narrow');
    }
    syncClipartSelectionControls();
  }

  function placeClipartsAtWorld(x, y, clipartIdsToPlace) {
    var list = Array.isArray(clipartIdsToPlace) && clipartIdsToPlace.length
      ? clipartIdsToPlace.slice()
      : (selectedClipartIds.length ? selectedClipartIds.slice() : [currentClipartId || '1f600']);
    pushHistory();
    var size = 64;
    var gap = 84;
    var cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(list.length))));
    var rows = Math.ceil(list.length / cols);
    var startX = x - ((Math.min(list.length, cols) - 1) * gap) / 2;
    var startY = y - ((rows - 1) * gap) / 2;
    var lastArt = null;
    list.forEach(function (id, idx) {
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      lastArt = createClipart(startX + col * gap - size / 2, startY + row * gap - size / 2, id, size);
    });
    if (lastArt) selectElement(lastArt);
    setTool('select');
    scheduleSave();
    if (list.length > 1) {
      showToast('Placed ' + list.length + ' cliparts on the canvas');
    }
  }

  function openClipartPicker() {
    if (!clipartModal) return;
    openModal(clipartModal);
    syncClipartSelectionControls();
    if (clipartSearch) setTimeout(function () { clipartSearch.focus(); }, 50);
    ensureClipartLibrary(function () {
      renderClipartGrid(clipartSearch ? clipartSearch.value : '');
    });
  }

  if (clipartSearch) {
    var clipartSearchTimer = null;
    clipartSearch.addEventListener('input', function () {
      clearTimeout(clipartSearchTimer);
      clipartSearchTimer = setTimeout(function () {
        ensureClipartLibrary(function () { renderClipartGrid(clipartSearch.value); });
      }, 120);
    });
  }

  clipartGrid?.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-clipart-id]');
    if (!opt) return;
    var id = opt.dataset.clipartId;
    if (!id) return;
    var idx = selectedClipartIds.indexOf(id);
    if (idx === -1) {
      selectedClipartIds.push(id);
      currentClipartId = id;
    } else {
      selectedClipartIds.splice(idx, 1);
      if (selectedClipartIds.length) {
        currentClipartId = selectedClipartIds[selectedClipartIds.length - 1];
      }
    }
    var isSel = selectedClipartIds.indexOf(id) !== -1;
    opt.classList.toggle('is-selected', isSel);
    opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
    syncClipartSelectionControls();
    if (clipartGridCount && window.CanvasCliparts) {
      var shownCount = clipartGrid.querySelectorAll('.clipart-option').length;
      var selPrefix = selectedClipartIds.length ? (selectedClipartIds.length + ' selected \u2022 ') : '';
      clipartGridCount.textContent = selPrefix + 'Showing ' + shownCount + ' of ' + window.CanvasCliparts.count + ' cliparts';
    }
  });

  clipartGrid?.addEventListener('dblclick', function (e) {
    var opt = e.target.closest('[data-clipart-id]');
    if (!opt) return;
    var id = opt.dataset.clipartId;
    if (!id) return;
    if (selectedClipartIds.indexOf(id) === -1) selectedClipartIds.push(id);
    currentClipartId = id;
    var toInsert = selectedClipartIds.slice();
    selectedClipartIds = [];
    syncClipartSelectionControls();
    closeModal(clipartModal);
    var rect = viewport.getBoundingClientRect();
    var pt = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    placeClipartsAtWorld(pt.x, pt.y, toInsert);
  });

  clipartInsertBtn?.addEventListener('click', function () {
    if (!selectedClipartIds.length) return;
    var toInsert = selectedClipartIds.slice();
    selectedClipartIds = [];
    syncClipartSelectionControls();
    closeModal(clipartModal);
    var rect = viewport.getBoundingClientRect();
    var pt = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    placeClipartsAtWorld(pt.x, pt.y, toInsert);
  });

  clipartClearBtn?.addEventListener('click', function () {
    selectedClipartIds = [];
    clipartGrid?.querySelectorAll('.clipart-option.is-selected').forEach(function (b) {
      b.classList.remove('is-selected');
      b.setAttribute('aria-selected', 'false');
    });
    syncClipartSelectionControls();
    renderClipartGrid(clipartSearch ? clipartSearch.value : '');
  });

  document.getElementById('modal-clipart-close')?.addEventListener('click', function () { closeModal(clipartModal); });
  document.getElementById('modal-clipart-done')?.addEventListener('click', function () { closeModal(clipartModal); });
  clipartModal?.addEventListener('click', function (e) {
    if (e.target === clipartModal) closeModal(clipartModal);
  });

  /* ---------- Viewport Unified Pointer Interaction (Create, Pan, Pinch-Zoom, Draw, Drag, Resize) ---------- */
  var viewportActivePointers = new Map();
  var viewportPinch = null;
  var VIEWPORT_CHROME_SELECTOR = '.quantalflow-toolbar, .color-picker-popover, .shape-picker-popover, .connector-picker-popover, .pen-picker-popover, .more-tools-popover, .context-toolbar, .quantalflow-timer-widget, .quantalflow-voting-banner, .quantalflow-present-bar, .quantalflow-minimap, .quantalflow-bottom-left, .quantalflow-bottom-right, .empty-board-starter';

  viewport.addEventListener('pointerdown', function (e) {
    // Never hijack clicks/taps on floating toolbar, popovers, zoom/undo controls, modals, or starter hub
    if (e.target.closest(VIEWPORT_CHROME_SELECTOR)) return;

    // Multi-touch tracking for smooth two-finger pinch-to-zoom & two-finger pan
    if (e.pointerType === 'touch') {
      viewportActivePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (viewportActivePointers.size === 2) {
        // Cancel any single-finger drag/marquee/pen in progress
        isDrawingPen = false; activePathEl = null; penPoints = [];
        isMarqueeSelecting = false; if (marqueeEl) { marqueeEl.remove(); marqueeEl = null; }
        activeDragEl = null; dragGroupOffsets = []; dragMoved = false;
        isPanning = false;
        var pair = Array.from(viewportActivePointers.values());
        viewportPinch = {
          dist: Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) || 1,
          midX: (pair[0].x + pair[1].x) / 2,
          midY: (pair[0].y + pair[1].y) / 2,
          startZoom: zoom,
          startPanX: panX,
          startPanY: panY
        };
        viewport.classList.add('is-dragging-pan');
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
    }

    var isBackground = (e.target === viewport || e.target === world || e.target.classList.contains('quantalflow-svg-layer') || e.target.classList.contains('canvas-frame'));

    if (currentTool === 'pen') {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      pushHistory();
      isDrawingPen = true;
      var pt = screenToWorld(e.clientX, e.clientY);
      penPoints = [pt];
      activePathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      activePathEl.setAttribute('fill', 'none');
      activePathEl.setAttribute('stroke', currentPenColor);
      activePathEl.setAttribute('stroke-width', String(currentPenWidth));
      activePathEl.setAttribute('stroke-linecap', 'round');
      activePathEl.setAttribute('stroke-linejoin', 'round');
      activePathEl.setAttribute('d', 'M ' + Math.round(pt.x) + ' ' + Math.round(pt.y));
      drawingsGroup.appendChild(activePathEl);
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    if (isBackground && currentTool === 'sticky') {
      pushHistory();
      var posS = screenToWorld(e.clientX, e.clientY);
      var newSticky = createSticky(posS.x - 90, posS.y - 65, 'Type your idea…', currentColor);
      selectElement(newSticky);
      setTool('select');
      scheduleSave();
      return;
    }

    if (isBackground && currentTool === 'shape') {
      pushHistory();
      var posSh = screenToWorld(e.clientX, e.clientY);
      var newShape = createShape(posSh.x - 75, posSh.y - 40, 'Architecture Block', currentShapeType, 'white');
      selectElement(newShape);
      setTool('select');
      scheduleSave();
      return;
    }

    if (isBackground && currentTool === 'text') {
      pushHistory();
      var posT = screenToWorld(e.clientX, e.clientY);
      var newText = createText(posT.x - 60, posT.y - 18, 'Double-click to edit heading');
      selectElement(newText);
      setTool('select');
      scheduleSave();
      return;
    }

    if (isBackground && currentTool === 'frame') {
      pushHistory();
      var posF = screenToWorld(e.clientX, e.clientY);
      var frameNum = world.querySelectorAll('.canvas-frame').length + 1;
      var newFrame = createFrame(posF.x - 240, posF.y - 150, 'Frame ' + frameNum + ': New Workshop Section', 520, 320);
      selectElement(newFrame);
      setTool('select');
      scheduleSave();
      return;
    }

    if (isBackground && currentTool === 'comment') {
      pushHistory();
      var posC = screenToWorld(e.clientX, e.clientY);
      createCommentPin(posC.x, posC.y, 'Add feedback or tag @team…', 'You');
      setTool('select');
      scheduleSave();
      return;
    }

    if (isBackground && currentTool === 'icon') {
      var posI = screenToWorld(e.clientX, e.clientY);
      placeIconsAtWorld(posI.x, posI.y);
      return;
    }

    if (isBackground && currentTool === 'clipart') {
      var posA = screenToWorld(e.clientX, e.clientY);
      placeClipartsAtWorld(posA.x, posA.y);
      return;
    }

    // Pan when Hand tool is active, Space is held, middle mouse button is used,
    // OR single-finger touch drag on empty canvas background in Select mode (natural mobile sliding).
    var isTouchBackgroundPan = (e.pointerType === 'touch' && isBackground && currentTool === 'select');
    if (currentTool === 'hand' || spacePressed || e.button === 1 || isTouchBackgroundPan) {
      if (e.button === 1 || isTouchBackgroundPan) e.preventDefault();
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      viewport.classList.add('is-dragging-pan');
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // Select (V) tool on empty canvas / background (mouse/pen): start marquee highlight selection!
    if (currentTool === 'select' && isBackground) {
      selectElement(null);
      isMarqueeSelecting = true;
      var vpRect = viewport.getBoundingClientRect();
      marqueeStartX = e.clientX - vpRect.left;
      marqueeStartY = e.clientY - vpRect.top;
      marqueeEl = document.createElement('div');
      marqueeEl.className = 'canvas-marquee';
      marqueeEl.style.left = Math.round(marqueeStartX) + 'px';
      marqueeEl.style.top = Math.round(marqueeStartY) + 'px';
      marqueeEl.style.width = '0px';
      marqueeEl.style.height = '0px';
      viewport.appendChild(marqueeEl);
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  function updateMarqueeSelection(clientX, clientY) {
    if (!isMarqueeSelecting || !marqueeEl) return;
    var vpRect = viewport.getBoundingClientRect();
    var curX = clientX - vpRect.left;
    var curY = clientY - vpRect.top;
    var left = Math.min(marqueeStartX, curX);
    var top = Math.min(marqueeStartY, curY);
    var width = Math.abs(curX - marqueeStartX);
    var height = Math.abs(curY - marqueeStartY);
    marqueeEl.style.left = Math.round(left) + 'px';
    marqueeEl.style.top = Math.round(top) + 'px';
    marqueeEl.style.width = Math.round(width) + 'px';
    marqueeEl.style.height = Math.round(height) + 'px';

    if (width < 4 && height < 4) return;
    var boxLeft = vpRect.left + left;
    var boxTop = vpRect.top + top;
    var boxRight = boxLeft + width;
    var boxBottom = boxTop + height;

    var hits = [];
    world.querySelectorAll('.canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc, .canvas-frame').forEach(function (item) {
      var r = item.getBoundingClientRect();
      var intersects = !(r.right < boxLeft || r.left > boxRight || r.bottom < boxTop || r.top > boxBottom);
      if (intersects) hits.push(item);
    });
    setSelectedElements(hits);
  }

  window.addEventListener('pointermove', function (e) {
    if (viewportActivePointers.has(e.pointerId)) {
      viewportActivePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (viewportPinch && viewportActivePointers.size >= 2) {
      e.preventDefault();
      var pair = Array.from(viewportActivePointers.values());
      var newDist = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) || 1;
      var newMidX = (pair[0].x + pair[1].x) / 2;
      var newMidY = (pair[0].y + pair[1].y) / 2;
      var vpRect = viewport.getBoundingClientRect();
      var nextZoom = Math.max(0.25, Math.min(3.0, viewportPinch.startZoom * (newDist / viewportPinch.dist)));
      var worldMidX = (viewportPinch.midX - vpRect.left - viewportPinch.startPanX) / viewportPinch.startZoom;
      var worldMidY = (viewportPinch.midY - vpRect.top - viewportPinch.startPanY) / viewportPinch.startZoom;
      zoom = nextZoom;
      panX = (newMidX - vpRect.left) - worldMidX * zoom;
      panY = (newMidY - vpRect.top) - worldMidY * zoom;
      updateTransform();
      return;
    }

    if (isDrawingPen && activePathEl) {
      var pt = screenToWorld(e.clientX, e.clientY);
      penPoints.push(pt);
      var d = penPoints.map(function (p, i) {
        return (i === 0 ? 'M ' : 'L ') + Math.round(p.x) + ' ' + Math.round(p.y);
      }).join(' ');
      activePathEl.setAttribute('d', d);
      return;
    }

    if (activeResizeEl) {
      var dw = (e.clientX - resizeStartX) / zoom;
      var dh = (e.clientY - resizeStartY) / zoom;
      activeResizeEl.style.width = Math.max(110, Math.round(resizeStartW + dw)) + 'px';
      activeResizeEl.style.height = Math.max(70, Math.round(resizeStartH + dh)) + 'px';
      renderConnectors();
      updateContextToolbarPosition();
      return;
    }

    if (isMarqueeSelecting) {
      updateMarqueeSelection(e.clientX, e.clientY);
      return;
    }

    if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      updateTransform();
      return;
    }

    if (activeDragEl) {
      if (!dragMoved) {
        pushHistory();
        dragMoved = true;
      }
      var worldRect = world.getBoundingClientRect();
      var x = (e.clientX - worldRect.left) / zoom - dragOffsetX;
      var y = (e.clientY - worldRect.top) / zoom - dragOffsetY;
      var nextX = Math.max(0, Math.round(x));
      var nextY = Math.max(0, Math.round(y));
      activeDragEl.style.left = nextX + 'px';
      activeDragEl.style.top = nextY + 'px';
      dragGroupOffsets.forEach(function (entry) {
        entry.el.style.left = Math.max(0, Math.round(nextX + entry.dx)) + 'px';
        entry.el.style.top = Math.max(0, Math.round(nextY + entry.dy)) + 'px';
      });
      renderConnectors();
      updateContextToolbarPosition();
      updateMinimap();
    }
  });

  function finishViewportPointer(e) {
    viewportActivePointers.delete(e.pointerId);
    if (viewportPinch && viewportActivePointers.size < 2) {
      viewportPinch = null;
      viewport.classList.remove('is-dragging-pan');
    }
    if (isDrawingPen) {
      isDrawingPen = false;
      activePathEl = null;
      penPoints = [];
      scheduleSave();
    }
    if (activeResizeEl) {
      activeResizeEl = null;
      scheduleSave();
    }
    if (isMarqueeSelecting) {
      updateMarqueeSelection(e.clientX, e.clientY);
      isMarqueeSelecting = false;
      if (marqueeEl) {
        marqueeEl.remove();
        marqueeEl = null;
      }
    }
    if (isPanning) {
      isPanning = false;
      viewport.classList.remove('is-dragging-pan');
    }
    if (activeDragEl) {
      if (dragMoved) scheduleSave();
      activeDragEl = null;
      dragGroupOffsets = [];
      dragMoved = false;
    }
  }
  window.addEventListener('pointerup', finishViewportPointer);
  window.addEventListener('pointercancel', finishViewportPointer);
  viewport.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length >= 2) e.preventDefault();
  }, { passive: false });

  /* ---------- Context Toolbar Actions ---------- */
  document.querySelectorAll('[data-ctx-color]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!selectedEl) return;
      pushHistory();
      var color = btn.dataset.ctxColor;
      if (selectedEl.classList.contains('canvas-sticky')) {
        ['yellow', 'mint', 'blue', 'violet', 'pink', 'orange'].forEach(function (c) {
          selectedEl.classList.remove('canvas-sticky--' + c);
        });
        selectedEl.classList.add('canvas-sticky--' + color);
        selectedEl.dataset.color = color;
      } else if (selectedEl.classList.contains('canvas-shape')) {
        ['yellow', 'mint', 'blue', 'violet', 'pink', 'orange', 'white'].forEach(function (c) {
          selectedEl.classList.remove('canvas-shape--fill-' + c);
        });
        selectedEl.classList.add('canvas-shape--fill-' + color);
        selectedEl.dataset.color = color;
      } else if (selectedEl.classList.contains('canvas-icon')) {
        selectedEl.className = selectedEl.className.replace(/canvas-icon--\S+/, 'canvas-icon--' + color);
        selectedEl.dataset.color = color;
      }
      scheduleSave();
    });
  });

  function upvoteElement(el) {
    if (!el) return;
    var pill = el.querySelector('.vote-pill');
    if (!pill) {
      var footer = el.querySelector('.canvas-sticky__footer');
      if (footer) {
        pill = document.createElement('span');
        pill.className = 'vote-pill';
        pill.dataset.votes = '0';
        footer.appendChild(pill);
      } else {
        pill = document.createElement('span');
        pill.className = 'vote-pill vote-pill--floating';
        pill.dataset.votes = '0';
        el.appendChild(pill);
      }
    }
    var count = (Number(pill.dataset.votes) || 0) + 1;
    pill.dataset.votes = String(count);
    pill.innerHTML = '&#9733; ' + count;
    pill.classList.add('is-voted');
    if (votingActive && votesRemaining > 0) {
      votesRemaining -= 1;
      var remEl = document.getElementById('votes-remaining');
      if (remEl) remEl.textContent = String(votesRemaining);
      if (votesRemaining === 0) showToast('All 5 votes cast!');
    }
    scheduleSave();
  }

  function duplicateElement(el) {
    if (!el) return;
    pushHistory();
    var x = (parseFloat(el.style.left) || 100) + 32;
    var y = (parseFloat(el.style.top) || 100) + 32;
    var clone = null;
    if (el.classList.contains('canvas-sticky')) {
      var text = el.querySelector('.canvas-sticky__text')?.innerHTML || '';
      var color = el.dataset.color || 'yellow';
      clone = createSticky(x, y, text, color, 0);
    } else if (el.classList.contains('canvas-shape')) {
      var sText = el.querySelector('.canvas-shape__text')?.innerHTML || '';
      clone = createShape(x, y, sText, el.dataset.shapeType || 'rect', el.dataset.color || 'white', el.offsetWidth, el.offsetHeight);
    } else if (el.classList.contains('canvas-text')) {
      var tText = el.querySelector('.canvas-text__content')?.innerHTML || '';
      clone = createText(x, y, tText);
    } else if (el.classList.contains('canvas-icon')) {
      clone = createIcon(x, y, el.dataset.icon, el.dataset.color, el.offsetWidth);
    } else if (el.classList.contains('canvas-clipart')) {
      clone = createClipart(x, y, el.dataset.clipart, el.offsetWidth);
    } else if (el.classList.contains('canvas-table')) {
      var tblCells = Array.prototype.map.call(el.querySelectorAll('tbody tr'), function (tr) {
        return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
          return td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
        });
      });
      clone = createTable(x, y, tblCells);
    } else if (el.classList.contains('canvas-doc')) {
      clone = createDoc(x, y, {
        title: el.querySelector('.doc-page__title')?.textContent || 'Untitled Document',
        icon: el.dataset.docIcon || '📄',
        status: el.dataset.docStatus || 'Draft',
        wide: el.dataset.docWide === '1',
        html: el.querySelector('.doc-editor')?.innerHTML || ''
      }, el.offsetWidth, el.offsetHeight);
    } else if (el.classList.contains('canvas-frame')) {
      var fTitle = el.querySelector('.canvas-frame__title')?.textContent || 'Copied Frame';
      clone = createFrame(x, y, fTitle, el.offsetWidth, el.offsetHeight);
    }
    if (clone) selectElement(clone);
    scheduleSave();
  }

  function deleteElement(el) {
    var targets = (selectedEls.length > 1 && (!el || selectedEls.indexOf(el) !== -1))
      ? selectedEls.slice()
      : (el ? [el] : []);
    if (!targets.length) return;
    pushHistory();
    var removedIds = {};
    targets.forEach(function (item) {
      if (item && item.dataset && item.dataset.id) removedIds[item.dataset.id] = true;
      if (item) item.remove();
    });
    connectors = connectors.filter(function (c) {
      return !removedIds[c.fromId] && !removedIds[c.toId];
    });
    selectElement(null);
    renderConnectors();
    updateMinimap();
    syncEmptyBoardStarter();
    scheduleSave();
  }

  function addChildBranch(sourceEl) {
    if (!sourceEl || sourceEl.classList.contains('canvas-frame')) return;
    pushHistory();
    var b = getElementBounds(sourceEl);
    var existingChildren = connectors.filter(function (c) { return c.fromId === sourceEl.dataset.id; }).length;
    var palette = ['yellow', 'mint', 'violet', 'orange', 'pink', 'blue'];
    var branchColor = palette[existingChildren % palette.length];
    var dir = (existingChildren % 2 === 0) ? 1 : -1;
    var row = Math.floor(existingChildren / 2);
    var childX = Math.max(40, Math.round(b.cx + dir * (b.w / 2 + 170) - 80));
    var childY = Math.max(40, Math.round(b.cy + (row % 2 === 0 ? -1 : 1) * (40 + row * 55) - 35));
    var child = createShape(childX, childY, 'New Idea', 'round', branchColor, 160);
    connectors.push({
      id: nextId('conn'),
      fromId: sourceEl.dataset.id,
      toId: child.dataset.id
    });
    renderConnectors();
    selectElement(child);
    scheduleSave();
    showToast('Added connected branch');
  }

  var ctxAddChildBtn = document.getElementById('ctx-add-child');
  if (ctxAddChildBtn) {
    ctxAddChildBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (selectedEl) addChildBranch(selectedEl);
    });
  }

  var ctxConnectBtn = document.getElementById('ctx-connect');
  if (ctxConnectBtn) {
    ctxConnectBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!selectedEl) return;
      pendingConnectorFromId = selectedEl.dataset.id;
      selectedEl.classList.add('is-connecting');
      setTool('connector');
      showToast('Click another sticky note or shape to connect');
    });
  }

  var ctxVoteBtn = document.getElementById('ctx-vote');
  if (ctxVoteBtn) {
    ctxVoteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (selectedEl) upvoteElement(selectedEl);
    });
  }

  var ctxDupBtn = document.getElementById('ctx-duplicate');
  if (ctxDupBtn) {
    ctxDupBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (selectedEl) duplicateElement(selectedEl);
    });
  }

  var ctxDelBtn = document.getElementById('ctx-delete');
  if (ctxDelBtn) {
    ctxDelBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (selectedEl) deleteElement(selectedEl);
    });
  }

  /* Contextual AI Expand on Selected Item */
  var ctxAiExpandBtn = document.getElementById('ctx-ai-expand');
  if (ctxAiExpandBtn) {
    ctxAiExpandBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!selectedEl) return;
      var sourceEl = selectedEl;
      var sourceText = sourceEl.innerText.replace(/\s+/g, ' ').trim();
      var origLabel = ctxAiExpandBtn.innerHTML;
      ctxAiExpandBtn.disabled = true;
      ctxAiExpandBtn.innerHTML = '<span>Thinking…</span>';
      showToast('DeepSeek AI is expanding "' + sourceText.slice(0, 32) + '…"');

      try {
        var result = await requestDeepSeek(sourceText, 'expand');
        var ideas = (result.ideas || []).slice(0, 4);
        pushHistory();
        var baseBounds = getElementBounds(sourceEl);
        var palette = ['mint', 'blue', 'violet', 'orange'];
        ideas.forEach(function (idea, idx) {
          var childX = baseBounds.x + baseBounds.w + 90;
          var childY = baseBounds.y + (idx - 1.5) * 165;
          var child = createSticky(childX, Math.max(40, childY), idea, palette[idx % palette.length]);
          connectors.push({
            id: nextId('conn'),
            fromId: sourceEl.dataset.id,
            toId: child.dataset.id
          });
        });
        renderConnectors();
        scheduleSave();
        showToast('Expanded into ' + ideas.length + ' connected sticky notes!');
      } catch (err) {
        showToast(err && err.aiUnavailable ? AI_UNAVAILABLE_MESSAGE : 'AI Expand error: ' + err.message);
      } finally {
        ctxAiExpandBtn.disabled = false;
        ctxAiExpandBtn.innerHTML = origLabel;
      }
    });
  }

  /* ---------- Zoom & Fit Controls ---------- */
  function zoomAt(newZoom, focalClientX, focalClientY) {
    var clamped = Math.max(0.25, Math.min(3.0, newZoom));
    var vpRect = viewport.getBoundingClientRect();
    var fx = (focalClientX !== undefined ? focalClientX : vpRect.left + vpRect.width / 2) - vpRect.left;
    var fy = (focalClientY !== undefined ? focalClientY : vpRect.top + vpRect.height / 2) - vpRect.top;

    var worldX = (fx - panX) / zoom;
    var worldY = (fy - panY) / zoom;

    zoom = clamped;
    panX = fx - worldX * zoom;
    panY = fy - worldY * zoom;
    updateTransform();
  }

  window.QFMobileCanvasBridge = {
    getScale: function () { return zoom; },
    panBy: function (dx, dy) { panX += dx; panY += dy; updateTransform(); },
    zoomAt: function (nextZoom, fx, fy) { zoomAt(nextZoom, fx, fy); }
  };

  function resetZoom() {
    zoom = 1;
    panX = 80;
    panY = 50;
    updateTransform(true);
  }

  function fitToScreen() {
    var items = world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc');
    if (!items.length) return resetZoom();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(function (el) {
      var b = getElementBounds(el);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    });
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;
    var contentW = Math.max(400, maxX - minX + 160);
    var contentH = Math.max(300, maxY - minY + 160);
    zoom = Math.max(0.35, Math.min(1.2, Math.min(vpW / contentW, vpH / contentH)));
    panX = (vpW - (maxX - minX) * zoom) / 2 - minX * zoom;
    panY = (vpH - (maxY - minY) * zoom) / 2 - minY * zoom;
    updateTransform(true);
  }

  document.getElementById('zoom-in')?.addEventListener('click', function () { zoomAt(zoom + 0.15); });
  document.getElementById('zoom-out')?.addEventListener('click', function () { zoomAt(zoom - 0.15); });
  document.getElementById('zoom-val')?.addEventListener('click', resetZoom);
  document.getElementById('zoom-fit')?.addEventListener('click', fitToScreen);

  viewport.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 0.12 : -0.12;
      zoomAt(zoom + delta, e.clientX, e.clientY);
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });

  /* ---------- Undo / Redo History Engine ---------- */
  function serializeBoardState() {
    // Deep-link view (?module=... different from the board's own module):
    // report the saved state untouched so this visit cannot rewrite the
    // board's canvas, modules or activeModule behind the user's back.
    if (currentActiveModule !== savedActiveModule && loadedStateRef) {
      return loadedStateRef;
    }
    var items = [];
    // Include any fullscreen doc currently portaled to document.body alongside world items
    var nodeList = Array.prototype.slice.call(
      world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc')
    );
    document.querySelectorAll('body > .canvas-doc.is-fullscreen').forEach(function (fsDoc) {
      if (nodeList.indexOf(fsDoc) === -1) nodeList.push(fsDoc);
    });
    nodeList.forEach(function (el) {
      var type = 'sticky';
      if (el.classList.contains('canvas-frame')) type = 'frame';
      else if (el.classList.contains('canvas-shape')) type = 'shape';
      else if (el.classList.contains('canvas-text')) type = 'text';
      else if (el.classList.contains('canvas-comment')) type = 'comment';
      else if (el.classList.contains('canvas-icon')) type = 'icon';
      else if (el.classList.contains('canvas-clipart')) type = 'clipart';
      else if (el.classList.contains('canvas-table')) type = 'table';
      else if (el.classList.contains('canvas-doc')) type = 'doc';

      var text = '';
      if (type === 'frame') text = el.querySelector('.canvas-frame__title')?.textContent || '';
      else if (type === 'sticky') text = el.querySelector('.canvas-sticky__text')?.innerHTML || '';
      else if (type === 'shape') text = el.querySelector('.canvas-shape__text')?.innerHTML || '';
      else if (type === 'text') text = el.querySelector('.canvas-text__content')?.innerHTML || '';
      else if (type === 'comment') text = el.querySelector('.canvas-comment__body')?.innerHTML || '';

      var docPayload = type === 'doc' ? {
        title: el.querySelector('.doc-page__title')?.textContent || 'Untitled Document',
        icon: el.dataset.docIcon || '📄',
        status: el.dataset.docStatus || 'Draft',
        wide: el.dataset.docWide === '1',
        html: el.querySelector('.doc-editor')?.innerHTML || ''
      } : undefined;

      var votes = Number(el.querySelector('.vote-pill')?.dataset.votes) || 0;

      items.push({
        id: el.dataset.id,
        type: type,
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        w: el.style.width ? parseFloat(el.style.width) : undefined,
        h: el.style.height ? parseFloat(el.style.height) : undefined,
        color: el.dataset.color || 'yellow',
        shapeType: el.dataset.shapeType || 'rect',
        iconId: el.dataset.icon || 'rocket',
        clipartId: el.dataset.clipart || '',
        cells: type === 'table'
          ? Array.prototype.map.call(el.querySelectorAll('tbody tr'), function (tr) {
              return Array.prototype.map.call(tr.querySelectorAll('td'), function (td) {
                return td.dataset.raw !== undefined ? td.dataset.raw : td.textContent;
              });
            })
          : undefined,
        doc: docPayload,
        text: text,
        votes: votes
      });
    });

    var paths = [];
    if (drawingsGroup) {
      drawingsGroup.querySelectorAll('path').forEach(function (p) {
        paths.push({
          d: p.getAttribute('d'),
          stroke: p.getAttribute('stroke'),
          strokeWidth: p.getAttribute('stroke-width')
        });
      });
    }

    var canvasSnapshot = {
      version: 2,
      items: items,
      connectors: JSON.parse(JSON.stringify(connectors)),
      paths: paths
    };

    if (currentActiveModule && currentActiveModule !== 'project-planning') {
      var prevWb = (boardModules[currentActiveModule] && boardModules[currentActiveModule].whiteboardState) ? boardModules[currentActiveModule].whiteboardState : undefined;
      if (currentActiveModule === 'whiteboard' && window.WhiteboardSuite && window.WhiteboardSuite.isOpen()) {
        prevWb = window.WhiteboardSuite.getState();
      }
      if (prevWb) canvasSnapshot.whiteboardState = prevWb;
      boardModules[currentActiveModule] = canvasSnapshot;
    }

    return {
      version: 2,
      // Persist the board's own module, not the URL view override — a visit
      // with ?module=... must never rewrite which workspace this board opens
      // with by default.
      workspaceMode: savedActiveModule === 'project-planning' ? 'project-planning' : 'canvas',
      activeModule: savedActiveModule || DEFAULT_WORKSPACE_MODULE,
      enabledModules: enabledModules.slice(),
      modules: boardModules,
      items: items,
      connectors: JSON.parse(JSON.stringify(connectors)),
      paths: paths
    };
  }

  function restoreBoardState(state) {
    if (!state || !Array.isArray(state.items)) return;
    isRestoringHistory = true;
    selectElement(null);

    document.querySelectorAll('body > .canvas-doc.is-fullscreen').forEach(function (el) { el.remove(); });
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc').forEach(function (el) {
      el.remove();
    });
    if (drawingsGroup) drawingsGroup.innerHTML = '';

    state.items.forEach(function (item) {
      if (item.type === 'frame') {
        createFrame(item.x, item.y, item.text, item.w, item.h, item.id);
      } else if (item.type === 'sticky') {
        var st = createSticky(item.x, item.y, item.text, item.color, item.votes, item.id);
        if (item.w) st.style.width = item.w + 'px';
        if (item.h) st.style.height = item.h + 'px';
      } else if (item.type === 'shape') {
        createShape(item.x, item.y, item.text, item.shapeType, item.color, item.w, item.h, item.id);
      } else if (item.type === 'text') {
        createText(item.x, item.y, item.text, item.color, item.id);
      } else if (item.type === 'comment') {
        createCommentPin(item.x, item.y, item.text, 'You', item.id);
      } else if (item.type === 'icon') {
        createIcon(item.x, item.y, item.iconId, item.color, item.w, item.id);
      } else if (item.type === 'clipart') {
        createClipart(item.x, item.y, item.clipartId, item.w, item.id);
      } else if (item.type === 'table') {
        createTable(item.x, item.y, item.cells, item.id);
      } else if (item.type === 'doc') {
        createDoc(item.x, item.y, item.doc, item.w, item.h, item.id);
      }
    });

    connectors = Array.isArray(state.connectors) ? state.connectors : [];
    renderConnectors();

    if (Array.isArray(state.paths) && drawingsGroup) {
      state.paths.forEach(function (p) {
        var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', p.stroke || '#1a1a2e');
        pathEl.setAttribute('stroke-width', p.strokeWidth || '5');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.setAttribute('d', p.d || '');
        drawingsGroup.appendChild(pathEl);
      });
    }

    isRestoringHistory = false;
    updateMinimap();
    syncEmptyBoardStarter();
  }

  function pushHistory() {
    if (isRestoringHistory) return;
    historyStack.push(serializeBoardState());
    if (historyStack.length > 35) historyStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!historyStack.length) {
      showToast('Nothing to undo');
      return;
    }
    redoStack.push(serializeBoardState());
    var prev = historyStack.pop();
    restoreBoardState(prev);
    scheduleSave();
  }

  function redo() {
    if (!redoStack.length) {
      showToast('Nothing to redo');
      return;
    }
    historyStack.push(serializeBoardState());
    var next = redoStack.pop();
    restoreBoardState(next);
    scheduleSave();
  }

  document.getElementById('btn-undo')?.addEventListener('click', undo);
  document.getElementById('btn-redo')?.addEventListener('click', redo);

  /* ---------- Cloud & LocalStorage Persistence ---------- */
  var titleInput = document.getElementById('board-title-input');
  var starBtn = document.getElementById('board-star');
  var saveText = document.getElementById('board-save-text');
  var saveDot = document.getElementById('board-save-dot');
  var saveTimer = null;
  var serverBoardVersion = null;

  function setSaveStatus(status) {
    if (!saveDot) return;
    if (status === 'saving') {
      if (saveText) saveText.textContent = 'Saving changes…';
      saveDot.style.background = '#f59e0b';
    } else if (status === 'error') {
      if (saveText) saveText.textContent = 'Sync error — retrying';
      saveDot.style.background = '#ef4444';
    } else {
      if (saveText) saveText.textContent = 'Saved to Cloud';
      saveDot.style.background = '#10b981';
    }
  }

  var currentBoardRole = 'owner';
  var currentBoardCaps = { canView: true, canComment: true, canEdit: true, canManageMembers: true, canDelete: true };
  var boardDirty = false;

  function scheduleSave() {
    if (currentBoardCaps && !currentBoardCaps.canEdit) return;
    boardDirty = true;
    setSaveStatus('saving');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistBoardNow, 500);
  }

  async function persistBoardNow() {
    if (currentBoardCaps && !currentBoardCaps.canEdit) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    boardDirty = false;
    var payload = {
      title: titleInput ? titleInput.value.trim() : 'New Collaborative Board',
      starred: starBtn ? starBtn.classList.contains('is-starred') : false,
      state: serializeBoardState()
    };
    if (serverBoardVersion != null) {
      payload.expectedVersion = serverBoardVersion;
    }

    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      if (res.status === 403) {
        pollBoardAccess();
        showToast('Read-only access: your changes were not saved.');
        return;
      }
      if (res.status === 409) {
        var conflict = await res.json().catch(function () { return null; });
        if (conflict && conflict.serverBoard) {
          serverBoardVersion = conflict.serverBoard.version || serverBoardVersion;
          if (conflict.serverBoard.state) {
            restoreBoardState(conflict.serverBoard.state);
          }
        }
        setSaveStatus('saved');
        return;
      }
      if (!res.ok) {
        boardDirty = true;
        setSaveStatus('error');
        return;
      }
      var data = await res.json().catch(function () { return null; });
      if (data && data.board && data.board.version != null) {
        serverBoardVersion = data.board.version;
      }
      setSaveStatus('saved');
    } catch (e) {
      boardDirty = true;
      setSaveStatus('error');
    }
  }

  function flushBoardOnUnload() {
    if (currentBoardCaps && !currentBoardCaps.canEdit) return;
    if (window.WhiteboardSuite && typeof window.WhiteboardSuite.flush === 'function') {
      window.WhiteboardSuite.flush();
    }
    if (!boardDirty && !saveTimer) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    boardDirty = false;
    try {
      var body = JSON.stringify({
        title: titleInput ? titleInput.value.trim() : 'New Collaborative Board',
        starred: starBtn ? starBtn.classList.contains('is-starred') : false,
        state: serializeBoardState()
      });
      fetch('/api/boards/' + encodeURIComponent(boardId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: body
      });
    } catch (e) {}
  }

  window.addEventListener('pagehide', flushBoardOnUnload);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushBoardOnUnload();
  });

  /* A board may be requested by id (/app/assap/002c5f) or by its pretty slug
     (/app/data-quantals-plan). Try the id first, then fall back to a slug lookup
     so shared links survive a title change. */
  async function fetchBoardByAnyId(requestedId) {
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(requestedId));
      if (res.ok) {
        var data = await res.json();
        if (data.board) return data.board;
      }
    } catch (e) {}

    try {
      var slugRes = await fetch('/api/boards?slug=' + encodeURIComponent(requestedId));
      if (slugRes.ok) {
        var slugData = await slugRes.json();
        if (slugData.board) return slugData.board;
      }
    } catch (e) {}

    return null;
  }

  function ensureModuleEnabled(mod) {
    var normalized = String(mod || '').toLowerCase();
    if (PROJECT_MODULES.indexOf(normalized) === -1) return;
    if (enabledModules.indexOf(normalized) === -1) {
      enabledModules.push(normalized);
    }
  }

  function resolveInitialEnabledModules(stateObj, activeMod) {
    var list = [];
    if (stateObj && Array.isArray(stateObj.enabledModules) && stateObj.enabledModules.length) {
      stateObj.enabledModules.forEach(function (m) {
        var norm = String(m || '').toLowerCase();
        if (PROJECT_MODULES.indexOf(norm) !== -1 && list.indexOf(norm) === -1) {
          list.push(norm);
        }
      });
    } else if (stateObj && stateObj.modules && typeof stateObj.modules === 'object' && Object.keys(stateObj.modules).length) {
      Object.keys(stateObj.modules).forEach(function (k) {
        var norm = String(k || '').toLowerCase();
        if (PROJECT_MODULES.indexOf(norm) !== -1 && list.indexOf(norm) === -1) {
          list.push(norm);
        }
      });
    } else {
      list = PROJECT_MODULES.slice();
    }
    if (stateObj && stateObj.workspaceMode === 'project-planning' && list.indexOf('project-planning') === -1) {
      list.push('project-planning');
    }
    if (activeMod && PROJECT_MODULES.indexOf(activeMod) !== -1 && list.indexOf(activeMod) === -1) {
      list.push(activeMod);
    }
    if (!list.length) {
      list = PROJECT_MODULES.slice();
    }
    enabledModules = list;
  }

  var topbarWsDropdown = document.getElementById('topbar-ws-dropdown');
  var topbarWsBtn = document.getElementById('topbar-ws-dropdown-btn');
  var topbarWsIcon = document.getElementById('topbar-ws-icon');
  var topbarWsLabel = document.getElementById('topbar-ws-label');
  var topbarWsMenu = document.getElementById('topbar-ws-dropdown-menu');

  function closeTopbarWsDropdown() {
    if (!topbarWsDropdown || !topbarWsMenu) return;
    topbarWsMenu.hidden = true;
    topbarWsDropdown.classList.remove('is-open');
    topbarWsBtn?.setAttribute('aria-expanded', 'false');
  }

  function buildWsDropdownMenuHtml() {
    var otherModules = enabledModules.filter(function (mod) {
      return mod !== currentActiveModule;
    });
    var itemsHtml = '';
    if (otherModules.length > 0) {
      itemsHtml = enabledModules.map(function (mod) {
        var meta = WORKSPACE_META[mod] || { label: mod, icon: '' };
        var isAct = mod === currentActiveModule;
        return '<div class="topbar-ws-dropdown__row">' +
          '<button class="topbar-ws-dropdown__item' + (isAct ? ' is-active' : '') + '"' +
            ' data-ws-module="' + mod + '" type="button" role="menuitem">' +
            '<span class="topbar-ws-dropdown__icon" aria-hidden="true">' + meta.icon + '</span>' +
            '<span>' + meta.label + '</span>' +
            (isAct ? '<span class="topbar-ws-dropdown__item-check" aria-hidden="true">&#10003;</span>' : '') +
          '</button>' +
          '<button class="topbar-ws-dropdown__remove" data-remove-ws-module="' + mod + '" type="button" title="Remove ' + meta.label + ' from this board" aria-label="Remove ' + meta.label + '">&times;</button>' +
        '</div>';
      }).join('') + '<div class="topbar-ws-dropdown__divider"></div>';
    }
    itemsHtml +=
      '<button class="topbar-ws-dropdown__item topbar-ws-dropdown__item--add" data-dropdown-add-ws="true" type="button" role="menuitem">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
        '<span>Add Workspace</span>' +
      '</button>' +
      '<div class="topbar-ws-dropdown__divider"></div>' +
      '<button class="topbar-ws-dropdown__item topbar-ws-dropdown__item--danger" data-dropdown-delete-ws="true" type="button" role="menuitem">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>' +
        '<span>Delete Workspace</span>' +
      '</button>';
    return itemsHtml;
  }

  async function removeWorkspaceModule(modToRemove) {
    var modMeta = WORKSPACE_META[modToRemove] || { label: modToRemove };
    var confirmed = await window.QFDialog.confirm({
      title: "Remove '" + modMeta.label + "' from this workspace?",
      message: 'Its items in this module will be cleared.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    enabledModules = enabledModules.filter(function (m) { return m !== modToRemove; });
    if (boardModules && boardModules[modToRemove]) {
      delete boardModules[modToRemove];
    }
    if (!enabledModules.length) {
      enabledModules = [DEFAULT_WORKSPACE_MODULE];
    }
    if (currentActiveModule === modToRemove) {
      switchWorkspaceModule(enabledModules[0], true);
    } else {
      renderSideNavWorkspaces();
    }
    scheduleSave();
    showToast('Removed ' + modMeta.label + ' from this workspace');
  }

  async function deleteCurrentWorkspace() {
    var titleEl = document.getElementById('board-title-input');
    var wsName = (titleEl && titleEl.value.trim()) || 'this workspace';
    var confirmed = await window.QFDialog.confirm({
      title: 'Delete "' + wsName + '"?',
      message: 'This will permanently delete this workspace and all its data. This cannot be undone.',
      confirmLabel: 'Delete Workspace',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    if (!boardId) {
      window.location.href = '/dashboard/';
      return;
    }
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId), { method: 'DELETE' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json().catch(function () { return {}; });
      if (!data.ok) throw new Error('Delete rejected');
      try {
        localStorage.removeItem('quantalflow_pp_state_v2_' + boardId);
      } catch (err) {}
      window.location.href = '/dashboard/';
    } catch (err) {
      await window.QFDialog.alert({
        title: 'Delete failed',
        message: 'Could not delete this workspace. Please try again.',
        buttonLabel: 'OK',
        tone: 'danger'
      });
    }
  }

  function renderSideNavWorkspaces() {
    var activeMeta = WORKSPACE_META[currentActiveModule] || { label: 'Mind Map', icon: '' };
    if (topbarWsLabel) topbarWsLabel.textContent = activeMeta.label;
    if (topbarWsIcon) topbarWsIcon.innerHTML = activeMeta.icon || '';

    // The project-planning suite renders its own workspace dropdown in its header.
    if (topbarWsMenu) {
      topbarWsMenu.innerHTML = buildWsDropdownMenuHtml();
    }

    if (window.ProjectPlanningSuite && window.ProjectPlanningSuite.syncWorkspaceTabs) {
      window.ProjectPlanningSuite.syncWorkspaceTabs();
    }
  }

  topbarWsBtn?.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!topbarWsMenu || !topbarWsDropdown) return;
    var willOpen = topbarWsMenu.hidden;
    if (willOpen) {
      renderSideNavWorkspaces();
      topbarWsMenu.hidden = false;
      topbarWsDropdown.classList.add('is-open');
      topbarWsBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeTopbarWsDropdown();
    }
  });

  topbarWsMenu?.addEventListener('click', async function (e) {
    var addBtn = e.target.closest('[data-dropdown-add-ws]');
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeTopbarWsDropdown();
      renderAddWorkspaceGrid();
      openModal(document.getElementById('modal-add-workspace'));
      return;
    }

    var removeModBtn = e.target.closest('[data-remove-ws-module]');
    if (removeModBtn) {
      e.preventDefault();
      e.stopPropagation();
      removeWorkspaceModule(removeModBtn.getAttribute('data-remove-ws-module'));
      return;
    }

    var deleteWsBtn = e.target.closest('[data-dropdown-delete-ws]');
    if (deleteWsBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeTopbarWsDropdown();
      deleteCurrentWorkspace();
      return;
    }

    var wsItem = e.target.closest('[data-ws-module]');
    if (wsItem) {
      e.preventDefault();
      e.stopPropagation();
      var targetMod = wsItem.getAttribute('data-ws-module');
      closeTopbarWsDropdown();
      if (targetMod) {
        switchWorkspaceModule(targetMod, true);
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (topbarWsDropdown && !topbarWsDropdown.contains(e.target)) {
      closeTopbarWsDropdown();
    }
  });

  function renderAddWorkspaceGrid() {
    var grid = document.getElementById('add-workspace-grid');
    if (!grid) return;
    var cardsHtml = PROJECT_MODULES.map(function (mod) {
      var meta = WORKSPACE_META[mod] || { label: mod, blurb: '', tint: '#eef2ff', ink: '#4262ff', icon: '' };
      var isAdded = enabledModules.indexOf(mod) !== -1;
      var isCurrent = mod === currentActiveModule;
      var badgeText = isCurrent ? 'Active' : (isAdded ? 'Added' : '+ Add');
      return '<button class="add-ws-card' + (isAdded ? ' is-added' : '') + '" data-add-ws-module="' + mod + '" type="button">' +
        '<span class="template-pick-card__icon" style="background:' + meta.tint + '; color:' + meta.ink + ';" aria-hidden="true">' + meta.icon + '</span>' +
        '<span class="template-pick-card__content">' +
          '<span class="template-pick-card__top">' +
            '<strong>' + meta.label + '</strong>' +
            '<span class="add-ws-card__badge">' + badgeText + '</span>' +
          '</span>' +
          '<small>' + meta.blurb + '</small>' +
        '</span>' +
      '</button>';
    }).join('');

    cardsHtml +=
      '<button class="add-ws-card" data-open-templates-modal="true" type="button">' +
        '<span class="template-pick-card__icon" style="background:#f1f5f9; color:#475569;" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>' +
        '</span>' +
        '<span class="template-pick-card__content">' +
          '<span class="template-pick-card__top">' +
            '<strong>Templates</strong>' +
            '<span class="add-ws-card__badge">Library</span>' +
          '</span>' +
          '<small>Insert structural frameworks &amp; starter layouts onto the canvas</small>' +
        '</span>' +
      '</button>';

    grid.innerHTML = cardsHtml;
  }

  function addWorkspaceModule(mod) {
    var normalized = String(mod || '').toLowerCase();
    if (PROJECT_MODULES.indexOf(normalized) === -1) return;
    var already = enabledModules.indexOf(normalized) !== -1;
    ensureModuleEnabled(normalized);
    renderSideNavWorkspaces();
    switchWorkspaceModule(normalized, true);
    if (!already) {
      var meta = WORKSPACE_META[normalized];
      showToast('Added ' + (meta ? meta.label : normalized) + ' to this workspace');
    }
  }

  function syncWorkspaceSwitcherUI(activeMod) {
    var target = activeMod || currentActiveModule || DEFAULT_WORKSPACE_MODULE;
    ensureModuleEnabled(target);
    renderSideNavWorkspaces();
    document.querySelectorAll('[data-ws-module]').forEach(function (btn) {
      var isMatch = btn.dataset.wsModule === target;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
  }

  function openWhiteboardSuiteForCurrentBoard(boardTitle) {
    if (!window.WhiteboardSuite) return false;
    starterDismissedByUser = true;
    syncEmptyBoardStarter();
    if (window.ProjectPlanningSuite) window.ProjectPlanningSuite.close();
    var existingWb = (boardModules.whiteboard && boardModules.whiteboard.whiteboardState) ? boardModules.whiteboard.whiteboardState : null;
    window.WhiteboardSuite.open(boardId, boardTitle || 'Visual Strategy Workspace', existingWb, {
      getCaps: function () { return currentBoardCaps; },
      onToast: function (msg) { showToast(msg); },
      onSave: function (wbState) {
        if (!boardModules.whiteboard || typeof boardModules.whiteboard !== 'object') {
          boardModules.whiteboard = { version: 2, items: [], connectors: [], paths: [] };
        }
        boardModules.whiteboard.whiteboardState = wbState;
        scheduleSave();
      }
    });
    return true;
  }

  function switchWorkspaceModule(targetMod, pushHistoryEntry) {
    var normalized = String(targetMod || DEFAULT_WORKSPACE_MODULE).toLowerCase();
    if (PROJECT_MODULES.indexOf(normalized) === -1) {
      normalized = DEFAULT_WORKSPACE_MODULE;
    }

    // Save current canvas module items before switching away — but only when
    // the canvas actually belongs to the module we are leaving. During a URL
    // override view the canvas is not the board's own content.
    if (currentActiveModule && currentActiveModule !== 'project-planning' && currentActiveModule === savedActiveModule) {
      var keepWb = (currentActiveModule === 'whiteboard' && window.WhiteboardSuite && window.WhiteboardSuite.isOpen())
        ? window.WhiteboardSuite.getState()
        : (boardModules[currentActiveModule] && boardModules[currentActiveModule].whiteboardState);
      boardModules[currentActiveModule] = {
        version: 2,
        items: serializeBoardState().items,
        connectors: JSON.parse(JSON.stringify(connectors)),
        paths: serializeBoardState().paths
      };
      if (keepWb) boardModules[currentActiveModule].whiteboardState = keepWb;
    }

    currentActiveModule = normalized;
    savedActiveModule = normalized; // an explicit switch is what the board remembers
    ensureModuleEnabled(currentActiveModule);
    syncWorkspaceSwitcherUI(currentActiveModule);

    var currentTitle = titleInput ? titleInput.value.trim() : 'Project Workspace';
    var nextPath = buildBoardPath(boardId, '', currentTitle);
    var nextUrl = nextPath + '?module=' + encodeURIComponent(currentActiveModule);
    try {
      if (pushHistoryEntry !== false && window.history && window.history.pushState) {
        window.history.pushState({ boardId: boardId, module: currentActiveModule, template: currentActiveModule }, '', nextUrl);
      } else if (window.history && window.history.replaceState) {
        window.history.replaceState({ boardId: boardId, module: currentActiveModule, template: currentActiveModule }, '', nextUrl);
      }
    } catch (e) {}

    if (currentActiveModule === 'project-planning') {
      if (window.WhiteboardSuite) window.WhiteboardSuite.close();
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
      if (window.ProjectPlanningSuite) {
        window.ProjectPlanningSuite.open(boardId, currentTitle || 'Project Planning Workspace');
      }
    } else if (currentActiveModule === 'whiteboard' && openWhiteboardSuiteForCurrentBoard(currentTitle || 'Visual Strategy Workspace')) {
      // Mounted Whiteboarding Visual Workspace
    } else {
      if (window.WhiteboardSuite) window.WhiteboardSuite.close();
      if (window.ProjectPlanningSuite) {
        window.ProjectPlanningSuite.close();
      }
      clearCanvasElementsOnly();
      var savedModState = boardModules[currentActiveModule];
      if (
        savedModState &&
        Array.isArray(savedModState.items) &&
        (savedModState.items.length > 0 || (Array.isArray(savedModState.paths) && savedModState.paths.length > 0))
      ) {
        restoreBoardState(savedModState);
        starterDismissedByUser = true;
        syncEmptyBoardStarter();
      } else if (
        loadedStateRef &&
        (loadedStateRef.activeModule || '') === currentActiveModule &&
        Array.isArray(loadedStateRef.items) &&
        (loadedStateRef.items.length > 0 || (Array.isArray(loadedStateRef.paths) && loadedStateRef.paths.length > 0))
      ) {
        // Canvas lived at the top level (older save shape): restore it rather
        // than stamping a fresh template over the board's original content.
        restoreBoardState(loadedStateRef);
        starterDismissedByUser = true;
        syncEmptyBoardStarter();
      } else {
        insertTemplateByType(currentActiveModule, 180, 110);
      }
    }

    scheduleSave();
  }

  document.addEventListener('click', function (e) {
    var wsBtn = e.target.closest('[data-ws-module]');
    if (!wsBtn) return;
    e.preventDefault();
    var targetMod = wsBtn.dataset.wsModule;
    if (targetMod) {
      switchWorkspaceModule(targetMod, true);
    }
  });

  async function loadBoardFromServer() {
    isHydratingBoard = true;
    clearCanvasElementsOnly();
    starterDismissedByUser = false;
    boardModules = {};

    var shareInput = document.getElementById('share-link-input');
    var routeNow = parseAppRoute(window.location.pathname, window.location.search);
    var explicitMod = routeNow.explicitModule;
    if (explicitMod) {
      currentActiveModule = explicitMod;
      ensureModuleEnabled(currentActiveModule);
      renderSideNavWorkspaces();
      if (explicitMod !== 'project-planning' && window.ProjectPlanningSuite) {
        window.ProjectPlanningSuite.close();
      }
    }

    try {
      try {
        var board = await fetchBoardByAnyId(boardId);
        if (board) {
          boardId = board.id || boardId;
          serverBoardVersion = board.version || 1;
          loadedStateRef = (board.state && board.state.version === 2) ? board.state : null;
          if (titleInput && board.title) {
            titleInput.value = board.title;
            document.title = board.title + ' | QuantalFlow App';
          }
          if (shareInput) {
            shareInput.value = window.location.origin + buildBoardPath(boardId, '', board.title);
          }
          if (starBtn) starBtn.classList.toggle('is-starred', Boolean(board.starred));

          if (board.state && board.state.modules && typeof board.state.modules === 'object') {
            boardModules = board.state.modules;
          }

          // Determine active module:
          // 1. Explicit module in URL (?module=...) wins.
          // 2. Otherwise default to board's activeModule or 'project-planning'.
          var stateActiveMod = (board.state && board.state.activeModule && PROJECT_MODULES.indexOf(board.state.activeModule) !== -1)
            ? board.state.activeModule
            : '';
          var resolvedModule = explicitMod || stateActiveMod || DEFAULT_WORKSPACE_MODULE;
          currentActiveModule = resolvedModule;
          savedActiveModule = stateActiveMod || resolvedModule;

          // Deep-link view (?module=... differing from the board's own module):
          // keep the board's saved canvas under its own module key so switching
          // modules later in this session cannot lose it and no save can wipe it.
          if (
            explicitMod &&
            savedActiveModule !== explicitMod &&
            loadedStateRef &&
            Array.isArray(loadedStateRef.items) &&
            (loadedStateRef.items.length > 0 || (Array.isArray(loadedStateRef.paths) && loadedStateRef.paths.length > 0))
          ) {
            var stashKey = savedActiveModule;
            var existingStash = boardModules[stashKey];
            if (!existingStash || !Array.isArray(existingStash.items) || existingStash.items.length === 0) {
              boardModules[stashKey] = {
                version: 2,
                items: loadedStateRef.items,
                connectors: Array.isArray(loadedStateRef.connectors) ? loadedStateRef.connectors : [],
                paths: Array.isArray(loadedStateRef.paths) ? loadedStateRef.paths : []
              };
            }
          }
          resolveInitialEnabledModules(board.state, currentActiveModule);
          syncWorkspaceSwitcherUI(currentActiveModule);
          syncUrlToTitle(board.title, currentActiveModule);

          if (currentActiveModule === 'project-planning') {
            if (window.WhiteboardSuite) window.WhiteboardSuite.close();
            starterDismissedByUser = true;
            syncEmptyBoardStarter();
            if (window.ProjectPlanningSuite) {
              window.ProjectPlanningSuite.open(board.id || boardId, board.title || 'Project Planning Workspace');
            }
            return;
          }

          if (currentActiveModule === 'whiteboard' && openWhiteboardSuiteForCurrentBoard(board.title || 'Visual Strategy Workspace')) {
            return;
          }

          if (window.WhiteboardSuite) window.WhiteboardSuite.close();
          if (window.ProjectPlanningSuite) {
            window.ProjectPlanningSuite.close();
          }

          var moduleSpecificState = boardModules[currentActiveModule];
          if (
            moduleSpecificState &&
            Array.isArray(moduleSpecificState.items) &&
            (moduleSpecificState.items.length > 0 || (Array.isArray(moduleSpecificState.paths) && moduleSpecificState.paths.length > 0))
          ) {
            restoreBoardState(moduleSpecificState);
            starterDismissedByUser = true;
            syncEmptyBoardStarter();
            return;
          }

          if (
            board.state &&
            board.state.version === 2 &&
            Array.isArray(board.state.items) &&
            (board.state.items.length > 0 || (Array.isArray(board.state.paths) && board.state.paths.length > 0))
          ) {
            restoreBoardState(board.state);
            starterDismissedByUser = true;
            syncEmptyBoardStarter();
            return;
          }

          insertTemplateByType(currentActiveModule, 180, 110);
          return;
        } else if (shareInput) {
          shareInput.value = window.location.origin + buildBoardPath(boardId, '');
        }
      } catch (e) {}

      serverBoardVersion = null;
      var fallbackMod = explicitMod || DEFAULT_WORKSPACE_MODULE;
      currentActiveModule = fallbackMod;
      savedActiveModule = fallbackMod;
      resolveInitialEnabledModules(null, currentActiveModule);
      syncWorkspaceSwitcherUI(currentActiveModule);

      if (currentActiveModule === 'project-planning' && window.ProjectPlanningSuite) {
        if (window.WhiteboardSuite) window.WhiteboardSuite.close();
        starterDismissedByUser = true;
        syncEmptyBoardStarter();
        window.ProjectPlanningSuite.open(boardId, (titleInput && titleInput.value) || 'Project Planning Workspace');
        return;
      }

      if (currentActiveModule === 'whiteboard' && openWhiteboardSuiteForCurrentBoard((titleInput && titleInput.value) || 'Visual Strategy Workspace')) {
        return;
      }

      if (window.WhiteboardSuite) window.WhiteboardSuite.close();
      if (window.ProjectPlanningSuite) {
        window.ProjectPlanningSuite.close();
      }
      insertTemplateByType(currentActiveModule, 180, 110);
    } finally {
      isHydratingBoard = false;
      syncEmptyBoardStarter();
    }
  }

  /* Client-Side SPA Navigation & Browser History Support (popstate) */
  function navigateToBoardRoute(targetBoardId, targetModule, pushHistoryEntry) {
    var nextId = targetBoardId || 'new-collaborative-board';
    // No explicit module (e.g. a history entry saved before one existed):
    // keep the board's own module instead of forcing the planning default,
    // which would persist a module flip on the next save.
    var nextMod = (targetModule && PROJECT_MODULES.indexOf(targetModule) !== -1)
      ? targetModule
      : (savedActiveModule || DEFAULT_WORKSPACE_MODULE);
    var sameBoard = String(nextId) === String(boardId);
    boardId = nextId;
    initialTemplate = nextMod;

    if (sameBoard) {
      switchWorkspaceModule(nextMod, pushHistoryEntry);
      return;
    }

    var nextUrl = buildBoardPath(boardId, '') + '?module=' + encodeURIComponent(nextMod);
    if (pushHistoryEntry !== false && window.history && window.history.pushState) {
      window.history.pushState({ boardId: boardId, module: nextMod, template: nextMod }, '', nextUrl);
    }
    loadBoardFromServer();
  }

  window.addEventListener('popstate', function (e) {
    var route = parseAppRoute(window.location.pathname, window.location.search);
    var targetBoard = (e.state && e.state.boardId) ? e.state.boardId : route.boardId;
    var targetMod = (e.state && (e.state.module || e.state.template)) || route.explicitModule || DEFAULT_WORKSPACE_MODULE;
    navigateToBoardRoute(targetBoard, targetMod, false);
  });

  window.QuantalFlowApp = {
    getBoardId: function () { return boardId; },
    getActiveModule: function () { return currentActiveModule; },
    getEnabledModules: function () { return enabledModules.slice(); },
    addWorkspaceModule: addWorkspaceModule,
    openAddWorkspaceModal: function () {
      renderAddWorkspaceGrid();
      openModal(document.getElementById('modal-add-workspace'));
    },
    switchModule: function (mod, pushHistory) { switchWorkspaceModule(mod, pushHistory); },
    switchWorkspaceModule: function (mod, pushHistory) { switchWorkspaceModule(mod, pushHistory); },
    removeWorkspaceModule: removeWorkspaceModule,
    deleteCurrentWorkspace: deleteCurrentWorkspace,
    buildWsDropdownMenuHtml: buildWsDropdownMenuHtml,
    loadBoard: function (id, mod) { navigateToBoardRoute(id, mod, true); }
  };

  if (titleInput) {
    titleInput.addEventListener('input', scheduleSave);
    // Commit the readable URL once the name settles, not on every keystroke.
    titleInput.addEventListener('change', function () {
      syncUrlToTitle(titleInput.value.trim());
    });
  }
  if (starBtn) {
    starBtn.addEventListener('click', function () {
      starBtn.classList.toggle('is-starred');
      scheduleSave();
    });
  }

  /* ---------- Sprint Countdown Timer Widget ---------- */
  var timerWidget = document.getElementById('timer-widget');
  var timerDisplay = document.getElementById('timer-display');
  var timerStartBtn = document.getElementById('timer-start');
  var timerResetBtn = document.getElementById('timer-reset');
  var timerCloseBtn = document.getElementById('timer-close');
  var timerTotalSec = 300;
  var timerRemainingSec = 300;
  var timerInterval = null;

  function formatTimer(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function renderTimer() {
    if (timerDisplay) timerDisplay.textContent = formatTimer(timerRemainingSec);
  }

  function playChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch (e) {}
  }

  document.getElementById('btn-timer')?.addEventListener('click', function () {
    if (!timerWidget) return;
    var isHidden = timerWidget.hidden;
    timerWidget.hidden = !isHidden;
    timerWidget.style.display = isHidden ? 'block' : 'none';
  });

  timerCloseBtn?.addEventListener('click', function () {
    timerWidget.hidden = true;
    timerWidget.style.display = 'none';
  });

  document.querySelectorAll('[data-timer-sec]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      timerTotalSec = Number(btn.dataset.timerSec) || 300;
      timerRemainingSec = timerTotalSec;
      renderTimer();
    });
  });

  document.querySelectorAll('[data-timer-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      timerRemainingSec += Number(btn.dataset.timerAdd) || 60;
      renderTimer();
    });
  });

  timerStartBtn?.addEventListener('click', function () {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerStartBtn.textContent = 'Resume';
    } else {
      timerStartBtn.textContent = 'Pause';
      timerInterval = setInterval(function () {
        if (timerRemainingSec > 0) {
          timerRemainingSec -= 1;
          renderTimer();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          timerStartBtn.textContent = 'Start';
          playChime();
          showToast('Time is up! Wrap up your thoughts.');
        }
      }, 1000);
    }
  });

  timerResetBtn?.addEventListener('click', function () {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerRemainingSec = timerTotalSec;
    if (timerStartBtn) timerStartBtn.textContent = 'Start';
    renderTimer();
  });

  /* ---------- Dot Voting Session ---------- */
  var votingBanner = document.getElementById('voting-banner');
  document.getElementById('btn-vote')?.addEventListener('click', function () {
    votingActive = !votingActive;
    if (votingActive) {
      votesRemaining = 5;
      var rem = document.getElementById('votes-remaining');
      if (rem) rem.textContent = '5';
    }
    if (votingBanner) {
      votingBanner.hidden = !votingActive;
      votingBanner.style.display = votingActive ? 'flex' : 'none';
    }
  });

  document.getElementById('voting-end')?.addEventListener('click', function () {
    votingActive = false;
    if (votingBanner) {
      votingBanner.hidden = true;
      votingBanner.style.display = 'none';
    }
    showToast('Voting session completed!');
  });

  /* ---------- Fullscreen Frame Presentation Mode ---------- */
  var presentBar = document.getElementById('present-bar');
  var presentCounter = document.getElementById('present-counter');

  function focusOnFrame(index) {
    var frames = Array.from(world.querySelectorAll('.canvas-frame'));
    if (!frames.length) {
      showToast('Add a Frame (F) to present your board');
      return;
    }
    presentFrameIdx = (index + frames.length) % frames.length;
    var f = frames[presentFrameIdx];
    var b = getElementBounds(f);
    var vpW = viewport.clientWidth;
    var vpH = viewport.clientHeight;
    zoom = Math.max(0.5, Math.min(1.35, Math.min((vpW - 120) / b.w, (vpH - 140) / b.h)));
    panX = (vpW - b.w * zoom) / 2 - b.x * zoom;
    panY = (vpH - b.h * zoom) / 2 - b.y * zoom;
    updateTransform(true);
    if (presentCounter) {
      var title = f.querySelector('.canvas-frame__title')?.textContent || ('Frame ' + (presentFrameIdx + 1));
      presentCounter.textContent = (presentFrameIdx + 1) + ' / ' + frames.length + ' — ' + title.slice(0, 32);
    }
  }

  document.getElementById('btn-present')?.addEventListener('click', function () {
    presentActive = !presentActive;
    if (presentBar) {
      presentBar.hidden = !presentActive;
      presentBar.style.display = presentActive ? 'flex' : 'none';
    }
    document.body.classList.toggle('is-presenting', presentActive);
    if (presentActive) focusOnFrame(0);
  });

  document.getElementById('present-prev')?.addEventListener('click', function () {
    focusOnFrame(presentFrameIdx - 1);
  });
  document.getElementById('present-next')?.addEventListener('click', function () {
    focusOnFrame(presentFrameIdx + 1);
  });
  document.getElementById('present-exit')?.addEventListener('click', function () {
    presentActive = false;
    if (presentBar) {
      presentBar.hidden = true;
      presentBar.style.display = 'none';
    }
    document.body.classList.remove('is-presenting');
  });

  /* ---------- Export Board JSON ---------- */
  document.getElementById('btn-export')?.addEventListener('click', function () {
    var data = {
      boardId: boardId,
      title: titleInput ? titleInput.value : 'QuantalFlow Board',
      exportedAt: new Date().toISOString(),
      state: serializeBoardState()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (boardId || 'quantalflow-board') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Board exported as JSON');
  });

  /* ---------- Minimap & Grid Toggle ---------- */
  var minimap = document.getElementById('quantalflow-minimap');
  var minimapStage = document.getElementById('minimap-stage');

  function updateMinimap() {
    if (!minimap || minimap.hidden || !minimapStage) return;
    minimapStage.querySelectorAll('.minimap-dot').forEach(function (d) { d.remove(); });
    var scale = 0.085;
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment, .canvas-icon, .canvas-clipart, .canvas-table, .canvas-doc').forEach(function (el) {
      var b = getElementBounds(el);
      var dot = document.createElement('div');
      dot.className = 'minimap-dot';
      if (el.classList.contains('canvas-frame')) dot.classList.add('minimap-dot--frame');
      dot.style.left = Math.round(b.x * scale) + 'px';
      dot.style.top = Math.round(b.y * scale) + 'px';
      dot.style.width = Math.max(4, Math.round(b.w * scale)) + 'px';
      dot.style.height = Math.max(4, Math.round(b.h * scale)) + 'px';
      minimapStage.appendChild(dot);
    });
    var vpBox = document.getElementById('minimap-viewport');
    if (vpBox) {
      var vx = (-panX / zoom) * scale;
      var vy = (-panY / zoom) * scale;
      var vw = (viewport.clientWidth / zoom) * scale;
      var vh = (viewport.clientHeight / zoom) * scale;
      vpBox.style.left = Math.max(0, Math.round(vx)) + 'px';
      vpBox.style.top = Math.max(0, Math.round(vy)) + 'px';
      vpBox.style.width = Math.min(180, Math.round(vw)) + 'px';
      vpBox.style.height = Math.min(110, Math.round(vh)) + 'px';
    }
  }

  function toggleMinimap() {
    if (!minimap) return;
    var show = minimap.hidden;
    minimap.hidden = !show;
    minimap.style.display = show ? 'block' : 'none';
    if (show) updateMinimap();
  }

  document.getElementById('btn-minimap')?.addEventListener('click', toggleMinimap);
  document.getElementById('minimap-close')?.addEventListener('click', toggleMinimap);

  document.getElementById('btn-grid')?.addEventListener('click', function () {
    gridMode = (gridMode + 1) % 3;
    viewport.classList.remove('grid-lines', 'grid-clean');
    if (gridMode === 1) viewport.classList.add('grid-lines');
    else if (gridMode === 2) viewport.classList.add('grid-clean');
    showToast(gridMode === 0 ? 'Dot Grid' : gridMode === 1 ? 'Line Grid' : 'Clean Canvas');
  });

  /* ---------- Modal Management ---------- */
  var allModals = document.querySelectorAll('.quantalflow-modal-backdrop');

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove('is-open');
    modal.style.display = 'none';
  }

  function closeAllModals() {
    allModals.forEach(closeModal);
  }

  function openModal(modal) {
    if (!modal) return;
    closeAllModals();
    modal.hidden = false;
    modal.classList.add('is-open');
    modal.style.display = 'grid';
  }

  closeAllModals();

  function setupModal(triggerId, modalId, closeIds) {
    var trigger = document.getElementById(triggerId);
    var modal = document.getElementById(modalId);
    if (!modal) return;

    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(modal);
        var input = modal.querySelector('input');
        if (input) setTimeout(function () { input.focus(); }, 50);
      });
    }

    (Array.isArray(closeIds) ? closeIds : [closeIds]).forEach(function (cid) {
      var btn = document.getElementById(cid);
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          closeModal(modal);
        });
      }
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal(modal);
    });
  }

  setupModal('btn-share', 'modal-share', ['modal-share-close', 'modal-share-done']);
  setupModal('btn-templates', 'modal-templates', ['modal-templates-close', 'modal-templates-done']);
  setupModal('btn-ai', 'modal-ai', ['modal-ai-close', 'modal-ai-cancel']);
  setupModal('btn-shortcuts', 'modal-shortcuts', ['modal-shortcuts-close', 'modal-shortcuts-done']);

  /* ---------- Board Collaboration: Share Modal, RBAC Locks & Live Presence ---------- */
  var shareMembersState = { canManage: false, members: [] };

  function escapeCollabHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function applyBoardPermissionState(role, caps) {
    var prevRole = currentBoardRole;
    currentBoardRole = role || 'owner';
    currentBoardCaps = caps || { canView: true, canComment: true, canEdit: true, canManageMembers: true, canDelete: true };

    var appRoot = document.getElementById('quantalflow-app') || document.body;
    var isViewer = !currentBoardCaps.canEdit && !currentBoardCaps.canComment;
    var isCommenter = !currentBoardCaps.canEdit && currentBoardCaps.canComment;

    appRoot.classList.toggle('is-readonly', isViewer);
    appRoot.classList.toggle('is-commenter', isCommenter);

    if (titleInput) titleInput.readOnly = !currentBoardCaps.canEdit;
    document.querySelectorAll('.canvas-doc .doc-page__title, .canvas-doc .doc-editor').forEach(function (node) {
      node.contentEditable = currentBoardCaps.canEdit ? 'true' : 'false';
    });
    if (window.WhiteboardSuite) {
      window.WhiteboardSuite.setCapabilities(currentBoardCaps);
    }
    var permBadge = document.getElementById('board-perm-badge');
    if (permBadge) {
      if (isViewer) {
        permBadge.textContent = 'View only';
        permBadge.hidden = false;
      } else if (isCommenter) {
        permBadge.textContent = 'Can comment';
        permBadge.hidden = false;
      } else {
        permBadge.hidden = true;
      }
    }

    if (prevRole && prevRole !== currentBoardRole) {
      var labelMap = { owner: 'Owner', admin: 'Admin', editor: 'Can Edit', commenter: 'Can Comment', viewer: 'Can View' };
      showToast('Your access changed to ' + (labelMap[currentBoardRole] || currentBoardRole));
    }
  }

  function renderPresenceAvatars(presenceList) {
    var mount = document.getElementById('collab-presence');
    if (!mount) return;
    var list = Array.isArray(presenceList) ? presenceList : [];
    if (!list.length) {
      mount.innerHTML = '';
      return;
    }
    var visible = list.slice(0, 5);
    var html = visible.map(function (p) {
      var initial = escapeCollabHtml((p.name || p.email || 'U').charAt(0).toUpperCase());
      var tip = escapeCollabHtml((p.name || p.email || 'Collaborator') + ' (' + (p.role || 'member') + ')');
      var inner = p.avatarUrl
        ? '<img src="' + escapeCollabHtml(p.avatarUrl) + '" alt="" />'
        : initial;
      return '<span class="collab-avatar" title="' + tip + '">' + inner + '</span>';
    }).join('');
    if (list.length > 5) {
      html += '<span class="collab-avatar collab-avatar--more">+' + (list.length - 5) + '</span>';
    }
    mount.innerHTML = html;
  }

  function setShareStatus(msg, isError) {
    var el = document.getElementById('share-invite-status');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'share-invite-status ' + (isError ? 'is-error' : 'is-success');
  }

  function renderShareMembers() {
    var listEl = document.getElementById('share-members-list');
    var formEl = document.getElementById('share-invite-form');
    if (!listEl) return;
    if (formEl) formEl.hidden = !shareMembersState.canManage;

    var members = shareMembersState.members || [];
    if (!members.length) {
      listEl.innerHTML = '<div style="font-size:13px; color:var(--ink-soft); padding:8px 0;">Only you have access to this board.</div>';
      return;
    }
    listEl.innerHTML = members.map(function (m) {
      var initial = escapeCollabHtml((m.name || m.email || 'U').charAt(0).toUpperCase());
      var av = m.avatarUrl ? '<img src="' + escapeCollabHtml(m.avatarUrl) + '" alt="" />' : initial;
      var badge = m.status === 'pending'
        ? '<span class="team-status-pill is-pending">Pending</span>'
        : '<span class="team-status-pill is-active">Active</span>';
      var rightHtml = '';
      if (m.isOwner) {
        rightHtml = '<span class="team-role-pill">Owner</span>';
      } else if (shareMembersState.canManage) {
        rightHtml =
          '<select class="team-perm-select" data-board-member-perm="' + escapeCollabHtml(m.id) + '" aria-label="Permission for ' + escapeCollabHtml(m.email) + '">' +
            '<option value="admin"' + (m.permission === 'admin' ? ' selected' : '') + '>Admin</option>' +
            '<option value="editor"' + (m.permission === 'editor' ? ' selected' : '') + '>Can Edit</option>' +
            '<option value="commenter"' + (m.permission === 'commenter' ? ' selected' : '') + '>Can Comment</option>' +
            '<option value="viewer"' + (m.permission === 'viewer' ? ' selected' : '') + '>Can View</option>' +
          '</select>' +
          '<button class="team-remove-btn" data-board-member-remove="' + escapeCollabHtml(m.id) + '" type="button" aria-label="Remove ' + escapeCollabHtml(m.email) + '">&times;</button>';
      } else {
        rightHtml = '<span class="team-role-pill">' + escapeCollabHtml(m.permissionLabel || m.permission) + '</span>';
      }
      return '<div class="share-member-row">' +
        '<div class="team-member-info">' +
          '<span class="team-member-avatar" aria-hidden="true">' + av + '</span>' +
          '<div class="team-member-text">' +
            '<div class="team-member-name">' + escapeCollabHtml(m.name || m.email) + ' ' + badge + '</div>' +
            '<div class="team-member-email">' + escapeCollabHtml(m.email) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="team-member-controls">' + rightHtml + '</div>' +
      '</div>';
    }).join('');
  }

  async function loadShareMembers() {
    if (!boardId) return;
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId) + '/members', { credentials: 'same-origin' });
      if (!res.ok) return;
      var data = await res.json();
      shareMembersState = { canManage: Boolean(data.canManage), members: data.members || [] };
      applyBoardPermissionState(data.permission, data.capabilities);
      renderPresenceAvatars(data.presence);
      renderShareMembers();
    } catch (e) {}
  }

  async function pollBoardAccess() {
    if (!boardId) return;
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId) + '/access', { credentials: 'same-origin' });
      if (res.status === 403) {
        var errData = await res.json().catch(function () { return {}; });
        if (errData && errData.revoked) {
          await window.QFDialog.alert({
            title: 'Access removed',
            message: 'Your access to this board was removed by the Owner.',
            buttonLabel: 'Return to Dashboard',
            tone: 'danger'
          });
          window.location.replace('/dashboard/');
        }
        return;
      }
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.permission) {
        applyBoardPermissionState(data.permission, data.capabilities);
      }
      if (data && data.presence) {
        renderPresenceAvatars(data.presence);
      }
    } catch (e) {}
  }

  document.getElementById('btn-share')?.addEventListener('click', function () {
    setShareStatus('', false);
    loadShareMembers();
  });

  document.getElementById('share-invite-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!boardId) return;
    var emailInput = document.getElementById('share-email-input');
    var permSelect = document.getElementById('share-permission-select');
    var inviteBtn = document.getElementById('btn-share-invite');
    if (!emailInput || !permSelect) return;
    var emails = emailInput.value.trim();
    if (!emails) return;

    if (inviteBtn) { inviteBtn.disabled = true; inviteBtn.textContent = 'Inviting\u2026'; }
    setShareStatus('', false);
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId) + '/invitations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emails, permission: permSelect.value || 'editor' })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Could not invite collaborator.');
      shareMembersState = { canManage: Boolean(data.canManage), members: data.members || [] };
      renderShareMembers();
      emailInput.value = '';
      var summary = (data.invited || []).filter(function (x) { return !x.skipped; }).map(function (x) {
        return x.email + ' (' + (x.status === 'active' ? 'Active' : 'Pending signup') + ')';
      }).join(', ');
      setShareStatus(summary ? 'Added: ' + summary : 'Permissions updated.', false);
    } catch (err) {
      setShareStatus(err.message || 'Invite failed.', true);
    } finally {
      if (inviteBtn) { inviteBtn.disabled = false; inviteBtn.textContent = 'Invite'; }
    }
  });

  document.getElementById('share-members-list')?.addEventListener('change', async function (e) {
    var sel = e.target.closest('[data-board-member-perm]');
    if (!sel || !boardId) return;
    var memberId = sel.getAttribute('data-board-member-perm');
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId) + '/members/' + encodeURIComponent(memberId), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: sel.value })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Failed to update permission.');
      shareMembersState = { canManage: Boolean(data.canManage), members: data.members || [] };
      renderShareMembers();
      setShareStatus('Permission updated in real time.', false);
    } catch (err) {
      setShareStatus(err.message, true);
      loadShareMembers();
    }
  });

  document.getElementById('share-members-list')?.addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-board-member-remove]');
    if (!btn || !boardId) return;
    var memberId = btn.getAttribute('data-board-member-remove');
    try {
      var res = await fetch('/api/boards/' + encodeURIComponent(boardId) + '/members/' + encodeURIComponent(memberId), {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Failed to remove collaborator.');
      shareMembersState = { canManage: Boolean(data.canManage), members: data.members || [] };
      renderShareMembers();
      setShareStatus('Collaborator removed.', false);
    } catch (err) {
      setShareStatus(err.message, true);
    }
  });

  setTimeout(pollBoardAccess, 1200);
  setInterval(function () {
    if (document.visibilityState === 'visible') pollBoardAccess();
  }, 8000);
  window.addEventListener('focus', pollBoardAccess);

  var btnAddWs = document.getElementById('btn-add-workspace');
  var modalAddWs = document.getElementById('modal-add-workspace');
  if (btnAddWs && modalAddWs) {
    btnAddWs.addEventListener('click', function (e) {
      e.preventDefault();
      renderAddWorkspaceGrid();
      openModal(modalAddWs);
    });
    ['modal-add-ws-close', 'modal-add-ws-cancel'].forEach(function (cid) {
      document.getElementById(cid)?.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal(modalAddWs);
      });
    });
    modalAddWs.addEventListener('click', function (e) {
      if (e.target === modalAddWs) closeModal(modalAddWs);
    });
    document.getElementById('add-workspace-grid')?.addEventListener('click', function (e) {
      var tplCard = e.target.closest('[data-open-templates-modal]');
      if (tplCard) {
        closeModal(modalAddWs);
        openModal(document.getElementById('modal-templates'));
        return;
      }
      var card = e.target.closest('[data-add-ws-module]');
      if (!card) return;
      var mod = card.dataset.addWsModule;
      closeModal(modalAddWs);
      if (mod) addWorkspaceModule(mod);
    });
  }

  /* Copy Share Link */
  var copyBtn = document.getElementById('copy-share-link');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var linkInput = document.getElementById('share-link-input');
      if (linkInput) {
        linkInput.select();
        navigator.clipboard?.writeText(linkInput.value).catch(function () {});
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1800);
      }
    });
  }

  /* ---------- Multi-Mode DeepSeek AI Studio ---------- */
  var aiModeTabs = document.querySelectorAll('.ai-mode-tab[data-ai-mode]');
  aiModeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      aiModeTabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      currentAiMode = tab.dataset.aiMode || 'stickies';
    });
  });

  document.querySelectorAll('.ai-chip[data-ai-prompt]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var input = document.getElementById('ai-prompt-input');
      if (input) input.value = chip.dataset.aiPrompt;
    });
  });

  async function requestDeepSeek(prompt, mode) {
    var res;
    try {
      res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, mode: mode })
      });
    } catch (e) {
      // Offline, DNS failure, CORS, aborted request.
      throw aiUnavailableError();
    }
    if (res.ok) return await res.json();

    // The DeepSeek key stays on the server — never call the API from the
    // browser, and never surface the server/provider detail in the UI.
    throw aiUnavailableError();
  }

  var aiGenerateBtn = document.getElementById('ai-generate-btn');
  var aiPromptInput = document.getElementById('ai-prompt-input');
  var aiStatus = document.getElementById('ai-status');

  async function runDeepSeekAi() {
    var prompt = (aiPromptInput && aiPromptInput.value.trim()) || 'Brainstorm 5 growth experiments for Q4';

    if (aiGenerateBtn) {
      aiGenerateBtn.disabled = true;
      aiGenerateBtn.innerHTML = '<span>DeepSeek generating…</span>';
    }
    if (aiStatus) {
      aiStatus.textContent = 'DeepSeek AI is building your ' + currentAiMode + ' layout…';
      aiStatus.className = 'ai-status-msg is-loading';
    }

    try {
      var data = await requestDeepSeek(prompt, currentAiMode);
      pushHistory();

      var baseStartX = 880;
      var baseStartY = 530;
      var colors = ['yellow', 'mint', 'blue', 'violet', 'pink', 'orange'];
      var ideas = data.ideas || ['DeepSeek AI: ' + prompt];

      if (currentAiMode === 'mindmap') {
        var rootTitle = (data.structured && data.structured.root) || prompt.slice(0, 36);
        createFrame(baseStartX - 60, baseStartY - 60, 'DeepSeek Mind Map: ' + prompt.slice(0, 32), 780, 420);
        var hub = createShape(baseStartX + 40, baseStartY + 130, '<strong>' + rootTitle + '</strong>', 'round', 'blue', 190);
        ideas.slice(0, 4).forEach(function (branchText, idx) {
          var child = createSticky(baseStartX + 360, baseStartY + idx * 92 - 10, branchText, colors[idx % colors.length]);
          child.style.minHeight = '76px';
          connectors.push({ id: nextId('conn'), fromId: hub.dataset.id, toId: child.dataset.id });
        });
        renderConnectors();
      } else if (currentAiMode === 'flow') {
        createFrame(baseStartX - 40, baseStartY - 50, 'DeepSeek Flowchart: ' + prompt.slice(0, 32), Math.max(760, ideas.length * 220 + 60), 260);
        var prevNode = null;
        ideas.slice(0, 5).forEach(function (stepText, idx) {
          var stType = idx === 0 ? 'round' : (idx === ideas.length - 1 ? 'cylinder' : 'rect');
          var node = createShape(baseStartX + idx * 215, baseStartY + 60, stepText, stType, idx % 2 === 0 ? 'blue' : 'mint', 165);
          if (prevNode) {
            connectors.push({ id: nextId('conn'), fromId: prevNode.dataset.id, toId: node.dataset.id });
          }
          prevNode = node;
        });
        renderConnectors();
      } else if (currentAiMode === 'kanban') {
        createFrame(baseStartX - 40, baseStartY - 50, 'DeepSeek Agile Kanban: ' + prompt.slice(0, 32), 740, 380);
        var cols = data.structured || {
          todo: ideas.slice(0, 2),
          doing: ideas.slice(2, 3),
          done: ideas.slice(3, 5)
        };
        var colDefs = [
          { title: 'TO DO', items: cols.todo || ideas.slice(0, 2), color: 'yellow', x: baseStartX },
          { title: 'IN PROGRESS', items: cols.doing || ideas.slice(2, 3), color: 'blue', x: baseStartX + 235 },
          { title: 'DONE', items: cols.done || ideas.slice(3, 4), color: 'mint', x: baseStartX + 470 }
        ];
        colDefs.forEach(function (col) {
          createText(col.x + 10, baseStartY - 10, col.title);
          (col.items || []).forEach(function (task, idx) {
            createSticky(col.x, baseStartY + 35 + idx * 155, task, col.color);
          });
        });
      } else {
        createFrame(baseStartX - 30, baseStartY - 50, 'DeepSeek AI: ' + prompt.slice(0, 42), (ideas.length * 210) + 40, 250);
        ideas.forEach(function (text, idx) {
          createSticky(baseStartX + (idx * 210), baseStartY, text, colors[idx % colors.length]);
        });
      }

      scheduleSave();

      if (aiStatus) {
        aiStatus.textContent = 'Created ' + currentAiMode + ' on canvas!';
        aiStatus.className = 'ai-status-msg is-success';
      }

      setTimeout(function () {
        closeModal(document.getElementById('modal-ai'));
        if (aiStatus) aiStatus.textContent = '';
        panX = -baseStartX + (window.innerWidth / 3);
        panY = -baseStartY + (window.innerHeight / 3);
        updateTransform(true);
      }, 550);

    } catch (err) {
      if (aiStatus) {
        aiStatus.textContent =
          err && err.aiUnavailable ? AI_UNAVAILABLE_MESSAGE : 'Error: ' + err.message;
        aiStatus.className = 'ai-status-msg is-error';
      }
    } finally {
      if (aiGenerateBtn) {
        aiGenerateBtn.disabled = false;
        aiGenerateBtn.innerHTML = '<span>Generate on Canvas</span>';
      }
    }
  }

  aiGenerateBtn?.addEventListener('click', runDeepSeekAi);
  aiPromptInput?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runDeepSeekAi();
    }
  });

  /* ---------- Clean Structural Starter Templates ---------- */
  function insertTemplateByType(type, startX, startY) {
    if (type === 'project-planning') {
      pushHistory();
      starterDismissedByUser = true;
      var sx = startX !== undefined ? startX : 180;
      var sy = startY !== undefined ? startY : 120;
      createFrame(sx - 50, sy - 55, 'Project Planning & Milestones', 940, 420);
      var m1 = createShape(sx, sy + 15, 'Phase 1: Discovery', 'round', 'blue', 180);
      var m2 = createShape(sx + 230, sy + 15, 'Phase 2: Planning', 'round', 'violet', 180);
      var m3 = createShape(sx + 460, sy + 15, 'Phase 3: Execution', 'round', 'mint', 180);
      var m4 = createShape(sx + 690, sy + 15, 'Phase 4: Launch', 'round', 'yellow', 180);
      connectors.push(
        { id: nextId('conn'), fromId: m1.dataset.id, toId: m2.dataset.id },
        { id: nextId('conn'), fromId: m2.dataset.id, toId: m3.dataset.id },
        { id: nextId('conn'), fromId: m3.dataset.id, toId: m4.dataset.id }
      );
      createSticky(sx, sy + 120, 'Requirements & Scope', 'blue');
      createSticky(sx, sy + 240, 'Stakeholder sign-off', 'yellow');
      createSticky(sx + 230, sy + 120, 'Architecture & Design', 'violet');
      createSticky(sx + 460, sy + 120, 'Sprint Backlog & Dev', 'mint');
      createSticky(sx + 460, sy + 240, 'Testing & QA', 'orange');
      createSticky(sx + 690, sy + 120, 'Release & Review', 'mint');
      renderConnectors();
      syncEmptyBoardStarter();
      scheduleSave();
      showToast('Project Planning template added to canvas');
      return;
    }
    if (type === 'blank') {
      pushHistory();
      clearCanvasElementsOnly();
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
      scheduleSave();
      showToast('Blank canvas ready — choose any tool on the left');
      return;
    }

    pushHistory();
    starterDismissedByUser = true;
    var sx = startX !== undefined ? startX : 180;
    var sy = startY !== undefined ? startY : 120;
    var focusNode = null;

    if (type === 'mindmap') {
      var edrawId = new URLSearchParams(window.location.search || '').get('edraw');
      var edrawTpl = null;
      if (edrawId && Array.isArray(window.QFEdrawMindMapTemplates)) {
        for (var ei = 0; ei < window.QFEdrawMindMapTemplates.length; ei += 1) {
          if (window.QFEdrawMindMapTemplates[ei].id === edrawId) {
            edrawTpl = window.QFEdrawMindMapTemplates[ei];
            break;
          }
        }
      }
      if (edrawTpl && Array.isArray(edrawTpl.nodes) && edrawTpl.nodes.length) {
        createFrame(sx - 50, sy - 50, edrawTpl.label || 'Mind Map', Math.max(960, Number(edrawTpl.width) || 1080), Math.max(540, Number(edrawTpl.height) || 680));
        var idMap = {};
        edrawTpl.nodes.forEach(function (node) {
          var el = createShape(
            sx + (Number(node.x) || 0),
            sy + (Number(node.y) || 0),
            node.isRoot ? ('<strong>' + escapeHtml(node.text || '') + '</strong>') : escapeHtml(node.text || ''),
            node.shapeType || 'round',
            node.color || 'white',
            Number(node.w) || 156
          );
          idMap[node.id] = el.dataset.id;
          if (node.isRoot && !focusNode) focusNode = el;
        });
        (edrawTpl.connectors || []).forEach(function (c) {
          var fId = idMap[c.fromId];
          var tId = idMap[c.toId];
          if (fId && tId) connectors.push({ id: nextId('conn'), fromId: fId, toId: tId });
        });
        renderConnectors();
      } else {
        // Mind Map: Empty starter with "Main Idea" in the exact middle and connected empty branch nodes around it
        createFrame(sx - 60, sy - 60, 'Mind Map', 860, 460);
        var center = createShape(sx + 275, sy + 135, '<strong>Main Idea</strong>', 'round', 'blue', 190);
        var b1 = createShape(sx + 20, sy + 35, 'Topic 1', 'round', 'yellow', 155);
        var b2 = createShape(sx + 20, sy + 235, 'Topic 2', 'round', 'mint', 155);
        var b3 = createShape(sx + 565, sy + 35, 'Topic 3', 'round', 'violet', 155);
        var b4 = createShape(sx + 565, sy + 235, 'Topic 4', 'round', 'orange', 155);
        connectors.push(
          { id: nextId('conn'), fromId: center.dataset.id, toId: b1.dataset.id },
          { id: nextId('conn'), fromId: center.dataset.id, toId: b2.dataset.id },
          { id: nextId('conn'), fromId: center.dataset.id, toId: b3.dataset.id },
          { id: nextId('conn'), fromId: center.dataset.id, toId: b4.dataset.id }
        );
        renderConnectors();
        focusNode = center;
      }
    } else if (type === 'flow') {
      // Flowchart: Clean Start -> Process -> Decision? -> Outcomes structure
      createFrame(sx - 50, sy - 50, 'Flowchart', 880, 360);
      var n1 = createShape(sx + 10, sy + 95, '<strong>Start</strong>', 'round', 'mint', 135);
      var n2 = createShape(sx + 205, sy + 95, 'Process Step', 'rect', 'blue', 160);
      var n3 = createShape(sx + 430, sy + 65, '<span>Decision?</span>', 'diamond', 'yellow', 120, 120);
      var n4 = createShape(sx + 625, sy + 25, 'Yes / Path A', 'rect', 'white', 155);
      var n5 = createShape(sx + 625, sy + 165, 'No / Path B', 'rect', 'white', 155);
      connectors.push(
        { id: nextId('conn'), fromId: n1.dataset.id, toId: n2.dataset.id },
        { id: nextId('conn'), fromId: n2.dataset.id, toId: n3.dataset.id },
        { id: nextId('conn'), fromId: n3.dataset.id, toId: n4.dataset.id },
        { id: nextId('conn'), fromId: n3.dataset.id, toId: n5.dataset.id }
      );
      renderConnectors();
      focusNode = n1;
    } else if (type === 'kanban') {
      // Kanban Board: Clean To Do, In Progress, Done columns with empty starter cards
      createFrame(sx - 50, sy - 55, 'Kanban Board', 760, 400);
      createText(sx + 10, sy - 10, 'TO DO');
      createText(sx + 245, sy - 10, 'IN PROGRESS');
      createText(sx + 480, sy - 10, 'DONE');
      var k1 = createSticky(sx, sy + 35, 'Task 1', 'yellow');
      createSticky(sx, sy + 195, 'Task 2', 'yellow');
      createSticky(sx + 235, sy + 35, 'In progress…', 'blue');
      createSticky(sx + 470, sy + 35, 'Completed…', 'mint');
      focusNode = k1;
    } else if (type === 'retro') {
      // Retrospective: Clean Went Well, To Improve, Action Items columns with blank notes
      createFrame(sx - 50, sy - 55, 'Retrospective', 760, 400);
      createText(sx + 10, sy - 10, 'WENT WELL');
      createText(sx + 245, sy - 10, 'TO IMPROVE');
      createText(sx + 480, sy - 10, 'ACTION ITEMS');
      var r1 = createSticky(sx, sy + 35, 'Add note…', 'mint');
      createSticky(sx, sy + 195, 'Add note…', 'mint');
      createSticky(sx + 235, sy + 35, 'Add note…', 'orange');
      createSticky(sx + 470, sy + 35, 'Add action item…', 'pink');
      focusNode = r1;
    } else if (type === 'brainstorm') {
      // Brainstorming: Central Topic in the middle surrounded by blank sticky notes
      createFrame(sx - 50, sy - 55, 'Brainstorming', 820, 450);
      var topic = createShape(sx + 265, sy + 135, '<strong>Central Topic</strong>', 'round', 'blue', 190);
      createSticky(sx + 20, sy + 20, 'Idea 1…', 'yellow');
      createSticky(sx + 20, sy + 200, 'Idea 2…', 'mint');
      createSticky(sx + 530, sy + 20, 'Idea 3…', 'pink');
      createSticky(sx + 530, sy + 200, 'Idea 4…', 'violet');
      focusNode = topic;
    } else if (type === 'perspective') {
      // Perspective Matrix: Strategic Vision, Key Objectives, Critical Risks, High-level Roadmap
      createFrame(sx - 40, sy - 40, 'Strategic Vision & Scope', 420, 240);
      createFrame(sx + 410, sy - 40, 'Key Objectives & OKRs', 420, 240);
      createFrame(sx - 40, sy + 230, 'Critical Risks & Mitigation', 420, 240);
      createFrame(sx + 410, sy + 230, 'High-Level Roadmap & Milestones', 420, 240);
      var p1 = createSticky(sx + 20, sy + 20, 'Core Vision & Purpose', 'blue');
      createSticky(sx + 200, sy + 20, 'Target Outcomes', 'mint');
      createSticky(sx + 470, sy + 20, 'Strategic Objective 1', 'yellow');
      createSticky(sx + 650, sy + 20, 'Key Results (KRs)', 'violet');
      createSticky(sx + 20, sy + 290, 'Dependencies & Blockers', 'orange');
      createSticky(sx + 200, sy + 290, 'Mitigation Protocol', 'pink');
      createSticky(sx + 470, sy + 290, 'Milestone M1: Architecture', 'blue');
      createSticky(sx + 650, sy + 290, 'Milestone M2: Delivery', 'mint');
      focusNode = p1;
    } else if (type === 'swot') {
      // SWOT Analysis: Clean 2x2 quadrants with empty starter sticky notes
      createFrame(sx - 40, sy - 40, 'Strengths', 380, 230);
      createFrame(sx + 365, sy - 40, 'Weaknesses', 380, 230);
      createFrame(sx - 40, sy + 215, 'Opportunities', 380, 230);
      createFrame(sx + 365, sy + 215, 'Threats', 380, 230);
      var sw1 = createSticky(sx + 60, sy, 'Strength…', 'mint');
      createSticky(sx + 465, sy, 'Weakness…', 'orange');
      createSticky(sx + 60, sy + 255, 'Opportunity…', 'blue');
      createSticky(sx + 465, sy + 255, 'Threat…', 'pink');
      focusNode = sw1;
    } else if (type === 'journey') {
      // Customer Journey Map: 4 connected stages with blank touchpoint notes below
      createFrame(sx - 50, sy - 55, 'Customer Journey Map', 920, 380);
      var s1 = createShape(sx, sy + 15, '1. Awareness', 'round', 'blue', 170);
      var s2 = createShape(sx + 215, sy + 15, '2. Consideration', 'round', 'violet', 170);
      var s3 = createShape(sx + 430, sy + 15, '3. Onboarding', 'round', 'mint', 170);
      var s4 = createShape(sx + 645, sy + 15, '4. Retention', 'round', 'yellow', 170);
      connectors.push(
        { id: nextId('conn'), fromId: s1.dataset.id, toId: s2.dataset.id },
        { id: nextId('conn'), fromId: s2.dataset.id, toId: s3.dataset.id },
        { id: nextId('conn'), fromId: s3.dataset.id, toId: s4.dataset.id }
      );
      createSticky(sx, sy + 120, 'Touchpoint / note…', 'blue');
      createSticky(sx + 215, sy + 120, 'Touchpoint / note…', 'violet');
      createSticky(sx + 430, sy + 120, 'Touchpoint / note…', 'mint');
      createSticky(sx + 645, sy + 120, 'Touchpoint / note…', 'yellow');
      renderConnectors();
      focusNode = s1;
    } else if (type === 'prototype') {
      // Mobile App Prototype: three connected phone screens with header + CTA
      createFrame(sx - 50, sy - 55, 'App Prototype', 900, 470);
      var scrNames = ['Screen 1 · Home', 'Screen 2 · Detail', 'Screen 3 · Checkout'];
      var scrColors = ['blue', 'violet', 'mint'];
      var prevScreen = null;
      for (var pi = 0; pi < 3; pi++) {
        var px = sx + pi * 290;
        var phone = createFrame(px, sy + 35, scrNames[pi], 230, 360);
        createShape(px + 18, sy + 62, 'Header bar', 'rect', scrColors[pi], 194);
        createText(px + 18, sy + 150, 'Screen content…');
        createShape(px + 18, sy + 335, 'CTA Button', 'round', 'mint', 194);
        if (prevScreen) {
          connectors.push({ id: nextId('conn'), fromId: prevScreen.dataset.id, toId: phone.dataset.id });
        }
        prevScreen = phone;
      }
      renderConnectors();
      focusNode = prevScreen;
    } else if (type === 'diagram') {
      // Diagram: Trigger → Process → Automation → Outcome pipeline
      createFrame(sx - 50, sy - 55, 'Diagram', 900, 380);
      var d1 = createShape(sx + 10, sy + 105, '<strong>Trigger</strong>', 'round', 'mint', 145);
      var d2 = createShape(sx + 215, sy + 105, 'Process Step', 'rect', 'blue', 165);
      var d3 = createShape(sx + 440, sy + 105, 'Automation', 'cylinder', 'violet', 165);
      var d4 = createShape(sx + 665, sy + 105, '<strong>Outcome</strong>', 'round', 'yellow', 155);
      connectors.push(
        { id: nextId('conn'), fromId: d1.dataset.id, toId: d2.dataset.id },
        { id: nextId('conn'), fromId: d2.dataset.id, toId: d3.dataset.id },
        { id: nextId('conn'), fromId: d3.dataset.id, toId: d4.dataset.id }
      );
      renderConnectors();
      focusNode = d1;
    } else if (type === 'table') {
      // Spreadsheet table (Excel-like grid with A/B/C headers and row numbers)
      var grid = createTable(sx, sy, null);
      focusNode = grid;
    } else if (type === 'timeline') {
      // Timeline: milestone dots chained along the months with note slots
      createFrame(sx - 50, sy - 55, 'Timeline', 960, 330);
      var tlMonths = ['Jan', 'Mar', 'Jun', 'Sep'];
      var tlColors = ['blue', 'violet', 'mint', 'yellow'];
      var prevMilestone = null;
      for (var tmi = 0; tmi < 4; tmi++) {
        var tmx = sx + tmi * 235;
        var dot = createShape(tmx + 60, sy + 40, '<strong>' + tlMonths[tmi] + '</strong>', 'circle', tlColors[tmi], 64);
        createText(tmx + 15, sy + 165, 'Milestone ' + (tmi + 1));
        if (prevMilestone) {
          connectors.push({ id: nextId('conn'), fromId: prevMilestone.dataset.id, toId: dot.dataset.id });
        }
        prevMilestone = dot;
      }
      renderConnectors();
      focusNode = prevMilestone;
    } else if (type === 'matrix') {
      // Prioritization Matrix: Impact × Effort quadrants with starter notes
      createText(sx + 390, sy - 65, '<strong>IMPACT &uarr;</strong>');
      createFrame(sx - 55, sy - 20, 'Quick Wins · High Impact, Low Effort', 430, 250);
      createFrame(sx + 405, sy - 20, 'Big Bets · High Impact, High Effort', 430, 250);
      createFrame(sx - 55, sy + 260, 'Fill-ins · Low Impact, Low Effort', 430, 250);
      createFrame(sx + 405, sy + 260, 'Money Pits · Low Impact, High Effort', 430, 250);
      createSticky(sx - 15, sy + 25, 'Easy win…', 'mint');
      createSticky(sx + 445, sy + 25, 'Strategic bet…', 'blue');
      createSticky(sx - 15, sy + 305, 'Nice to have…', 'yellow');
      createSticky(sx + 445, sy + 305, 'Revisit later…', 'pink');
      createText(sx + 450, sy + 545, '<strong>EFFORT &rarr;</strong>');
    } else if (type === 'doc') {
      // Doc: real Word / Confluence-style rich document editor on the canvas
      var docEl = createDoc(sx - 40, sy - 40, {
        title: 'Untitled Document',
        icon: '📄',
        status: 'Draft'
      }, 820, 680);
      focusNode = docEl;
    } else if (type === 'slides') {
      // Slides: two 16:9 deck frames ready to present
      createFrame(sx - 50, sy - 40, 'Slide 1 · Title &amp; Hook', 500, 300);
      createText(sx + 55, sy + 70, '<strong>Presentation title</strong>');
      createText(sx + 55, sy + 150, 'One-line hook that frames the story…');
      createFrame(sx + 510, sy - 40, 'Slide 2 · Key Points', 500, 300);
      createSticky(sx + 555, sy + 5, 'Point one…', 'blue');
      createSticky(sx + 555, sy + 105, 'Point two…', 'violet');
      createSticky(sx + 555, sy + 205, 'Point three…', 'mint');
    } else if (type === 'engage') {
      // Engage Activities: warm-up wall for icebreakers, polls and word clouds
      createFrame(sx - 50, sy - 55, 'Engagement Activities', 880, 420);
      createText(sx + 10, sy - 8, '<strong>ICEBREAKER</strong>');
      createText(sx + 295, sy - 8, '<strong>POLL</strong>');
      createText(sx + 580, sy - 8, '<strong>WORD CLOUD</strong>');
      createSticky(sx, sy + 40, 'Two truths and a lie…', 'pink');
      createSticky(sx, sy + 200, 'My weekend in 3 emojis…', 'pink');
      createSticky(sx + 285, sy + 40, 'Poll question here?', 'blue');
      createSticky(sx + 285, sy + 200, 'Option A / Option B…', 'blue');
      createSticky(sx + 570, sy + 40, 'One word on the topic…', 'violet');
      createSticky(sx + 570, sy + 200, 'Biggest open question…', 'violet');
    } else if (type === 'talktrack') {
      // Talk Track: five guided conversation steps sellers can follow live
      createFrame(sx - 50, sy - 55, 'Talk Track', 980, 340);
      var ttSteps = ['1. Opening', '2. Discovery', '3. Value Story', '4. Objections', '5. Next Steps'];
      var ttColors = ['blue', 'violet', 'mint', 'yellow', 'pink'];
      var prevStep = null;
      for (var tsi = 0; tsi < 5; tsi++) {
        var tsx = sx + tsi * 200;
        var stepNode = createShape(tsx, sy + 35, '<strong>' + ttSteps[tsi] + '</strong>', 'round', ttColors[tsi], 175);
        createSticky(tsx + 5, sy + 150, 'Say: …', 'yellow');
        if (prevStep) {
          connectors.push({ id: nextId('conn'), fromId: prevStep.dataset.id, toId: stepNode.dataset.id });
        }
        prevStep = stepNode;
      }
      renderConnectors();
      focusNode = prevStep;
    }

    syncEmptyBoardStarter();
    fitToScreen();
    if (focusNode) {
      setTimeout(function () { selectElement(focusNode); }, 100);
    }
    scheduleSave();
  }

  document.querySelectorAll('[data-insert-template]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var type = btn.dataset.insertTemplate;
      closeModal(document.getElementById('modal-templates'));
      if (window.history && window.history.pushState) {
        window.history.pushState({ boardId: boardId, template: type }, '', buildBoardPath(boardId, type));
      }
      var offset = hasCanvasItems() ? { x: 180, y: 540 } : { x: 180, y: 120 };
      insertTemplateByType(type, offset.x, offset.y);
      if (type !== 'blank') showToast('Started ' + type + ' layout');
    });
  });

  document.querySelectorAll('[data-starter-template]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var type = btn.dataset.starterTemplate;
      if (window.history && window.history.pushState) {
        window.history.pushState({ boardId: boardId, template: type }, '', buildBoardPath(boardId, type));
      }
      insertTemplateByType(type, 180, 120);
      if (type !== 'blank') showToast('Started ' + type + ' layout');
    });
  });

  document.getElementById('btn-starter-blank')?.addEventListener('click', function () {
    starterDismissedByUser = true;
    syncEmptyBoardStarter();
    showToast('Blank canvas ready — pick any tool on the left');
  });

  document.getElementById('btn-starter-ai')?.addEventListener('click', function () {
    openModal(document.getElementById('modal-ai'));
    var input = document.getElementById('ai-prompt-input');
    if (input) setTimeout(function () { input.focus(); }, 50);
  });

  /* ---------- Clear Canvas ---------- */
  document.getElementById('btn-clear')?.addEventListener('click', async function () {
    var ok = await window.QFDialog.confirm({
      title: 'Clear all items from the canvas?',
      message: 'You can undo this action with Ctrl+Z.',
      confirmLabel: 'Clear Canvas',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (ok) {
      pushHistory();
      clearCanvasElementsOnly();
      starterDismissedByUser = false;
      syncEmptyBoardStarter();
      scheduleSave();
    }
  });

  /* ---------- Keyboard Shortcuts ---------- */
  window.addEventListener('keydown', function (e) {
    // Do not double-fire main canvas shortcuts when WhiteboardSuite or ProjectPlanningSuite owns the stage
    if (window.WhiteboardSuite && typeof window.WhiteboardSuite.isOpen === 'function' && window.WhiteboardSuite.isOpen()) return;
    if (window.ProjectPlanningSuite && typeof window.ProjectPlanningSuite.isOpen === 'function' && window.ProjectPlanningSuite.isOpen()) return;

    var tag = (e.target && e.target.tagName) || '';
    var isEditingText = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

    if (e.key === 'Escape') {
      document.querySelectorAll('body > .canvas-doc.is-fullscreen').forEach(function (fsDoc) {
        if (typeof fsDoc._exitFullscreen === 'function') fsDoc._exitFullscreen();
      });
      closeAllModals();
      toggleMoreTools(false);
      selectElement(null);
      if (presentActive) document.getElementById('present-exit')?.click();
      if (pendingConnectorFromId) {
        var prev = world.querySelector('[data-id="' + pendingConnectorFromId + '"]');
        if (prev) prev.classList.remove('is-connecting');
        pendingConnectorFromId = null;
      }
      return;
    }

    if (isEditingText) return;

    if (e.key === 'Tab' && selectedEl && !selectedEl.classList.contains('canvas-frame') && !selectedEl.classList.contains('canvas-doc')) {
      e.preventDefault();
      addChildBranch(selectedEl);
      return;
    }

    if (e.code === 'Space') {
      spacePressed = true;
      viewport.classList.add('is-panning');
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (selectedEl) duplicateElement(selectedEl);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedEl) {
        e.preventDefault();
        deleteElement(selectedEl);
      }
      return;
    }

    var k = e.key.toLowerCase();
    if (k === 'v') setTool('select');
    else if (k === 'h') setTool('hand');
    else if (k === 'n') setTool('sticky');
    else if (k === 's') setTool('shape');
    else if (k === 'l') setTool('connector');
    else if (k === 't') setTool('text');
    else if (k === 'f') setTool('frame');
    else if (k === 'p') setTool('pen');
    else if (k === 'c') setTool('comment');
    else if (k === 'i') setTool('icon');
    else if (k === 'a') setTool('clipart');
    else if (k === 'm') toggleMinimap();
    else if (k === 'g') document.getElementById('btn-grid')?.click();
    else if (e.key === '?') openModal(document.getElementById('modal-shortcuts'));
  });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'Space') {
      spacePressed = false;
      if (currentTool !== 'hand') viewport.classList.remove('is-panning');
    }
  });

  /* ---------- Toast Feedback Notification ---------- */
  var toastEl = null;
  var toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'quantalflow-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2600);
  }

  /* ---------- Boot ---------- */
  updateTransform();
  loadBoardFromServer();

})();
