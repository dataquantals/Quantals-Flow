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
  var KNOWN_TEMPLATES = ['project-planning', 'mindmap', 'flow', 'kanban', 'retro', 'brainstorm', 'swot', 'journey', 'blank'];

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
    var tpl = (template && KNOWN_TEMPLATES.indexOf(template) !== -1) ? '/' + template : '';

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

  /** Keep the address bar in sync with the board title without a reload. */
  function syncUrlToTitle(title, template) {
    if (!title) return;
    var nextPath = buildBoardPath(boardId, template || initialTemplate, title);
    var next = nextPath + window.location.search;
    if (next !== window.location.pathname + window.location.search) {
      try { window.history.replaceState({ boardId: boardId, template: initialTemplate }, '', next); } catch (e) {}
    }
  }

  function parseAppRoute(pathname, search) {
    var params = new URLSearchParams(search || '');
    var qBoard = params.get('board');
    var qTpl = params.get('template') || '';

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
        template: qTpl,
        needsCanonicalReplace: true
      };
    }

    if (rest.length === 0) {
      return { boardId: 'new-collaborative-board', template: '', needsCanonicalReplace: false };
    }

    // e.g. /app/board/q4-intelligent-canvas/mindmap
    if (rest[0] === 'board' && rest.length >= 2) {
      return {
        boardId: rest[1],
        template: rest[2] || '',
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/assap/002c5f/mindmap (3 segments after /app)
    if (rest.length >= 3) {
      return {
        boardId: rest[0] + '-' + rest[1],
        template: rest[2],
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/assap/002c5f OR /app/q4-intelligent-canvas/mindmap (2 segments after /app)
    if (rest.length === 2) {
      if (KNOWN_TEMPLATES.indexOf(rest[1].toLowerCase()) !== -1) {
        return {
          boardId: rest[0],
          template: rest[1].toLowerCase(),
          needsCanonicalReplace: false
        };
      }
      return {
        boardId: rest[0] + '-' + rest[1],
        template: '',
        needsCanonicalReplace: false
      };
    }

    // e.g. /app/q4-intelligent-canvas (1 segment after /app)
    return {
      boardId: rest[0],
      template: '',
      needsCanonicalReplace: false
    };
  }

  var initialRoute = parseAppRoute(window.location.pathname, window.location.search);
  var boardId = initialRoute.boardId;
  var initialTemplate = initialRoute.template;

  // Automatically upgrade legacy query-string URLs (/app/?board=assap-002c5f&template=mindmap)
  // to clean hierarchical paths (/app/assap/002c5f/mindmap) without reloading
  if (initialTemplate === 'project-planning' || initialRoute.needsCanonicalReplace) {
    if (window.history && window.history.replaceState) {
      var targetTpl = (initialTemplate === 'project-planning') ? '' : initialTemplate;
      var canonicalUrl = buildBoardPath(boardId, targetTpl);
      var workspaceModule = new URLSearchParams(window.location.search || '').get('module');
      if (workspaceModule && targetTpl) {
        canonicalUrl += '?module=' + encodeURIComponent(workspaceModule);
      }
      window.history.replaceState({ boardId: boardId, template: targetTpl }, '', canonicalUrl);
    }
  }

  /* ---------- Canvas State ---------- */
  var currentTool = 'select'; // select, hand, sticky, shape, connector, text, frame, pen, comment
  var currentColor = 'yellow';
  var currentShapeType = 'rect'; // rect, round, circle, diamond, cylinder
  var currentPenColor = '#1a1a2e';
  var currentPenWidth = 5;
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
  var activeDragEl = null;
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

  function hasCanvasItems() {
    var count = world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment').length;
    var hasPaths = drawingsGroup && drawingsGroup.children.length > 0;
    return count > 0 || Boolean(hasPaths);
  }

  function syncEmptyBoardStarter() {
    if (!emptyStarterEl) return;
    if (hasCanvasItems() || starterDismissedByUser) {
      emptyStarterEl.hidden = true;
      emptyStarterEl.style.display = 'none';
    } else {
      emptyStarterEl.hidden = false;
      emptyStarterEl.style.display = 'grid';
    }
  }

  function clearCanvasElementsOnly() {
    selectElement(null);
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment').forEach(function (el) {
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

  function computeAnchorPoints(fromEl, toEl) {
    var a = getElementBounds(fromEl);
    var b = getElementBounds(toEl);
    var dx = b.cx - a.cx;
    var dy = b.cy - a.cy;

    var startX, startY, endX, endY, c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      startX = dx > 0 ? a.x + a.w : a.x;
      startY = a.cy;
      endX = dx > 0 ? b.x : b.x + b.w;
      endY = b.cy;
      var offset = Math.max(40, Math.abs(endX - startX) * 0.45);
      c1x = startX + (dx > 0 ? offset : -offset);
      c1y = startY;
      c2x = endX - (dx > 0 ? offset : -offset);
      c2y = endY;
    } else {
      startX = a.cx;
      startY = dy > 0 ? a.y + a.h : a.y;
      endX = b.cx;
      endY = dy > 0 ? b.y : b.y + b.h;
      var vOffset = Math.max(40, Math.abs(endY - startY) * 0.45);
      c1x = startX;
      c1y = startY + (dy > 0 ? vOffset : -vOffset);
      c2x = endX;
      c2y = endY - (dy > 0 ? vOffset : -vOffset);
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
      var d = computeAnchorPoints(fromEl, toEl);
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'quantalflow-connector-path');
      path.setAttribute('data-conn-id', conn.id);
      path.setAttribute('marker-end', 'url(#quantalflow-arrow)');
      path.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Remove this connector line?')) {
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
      var children = frame.querySelectorAll('.canvas-sticky, .canvas-shape');
      children.forEach(function (child) {
        if (!child.dataset.id) child.dataset.id = nextId('item');
        world.appendChild(child);
      });
    });

    world.querySelectorAll('.canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment').forEach(function (el) {
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
      handle.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        pushHistory();
        activeResizeEl = el;
        resizeStartW = el.offsetWidth;
        resizeStartH = el.offsetHeight;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        selectElement(el);
      });
      el.appendChild(handle);
    }
  }

  /* ---------- Selection & Floating Context Toolbar ---------- */
  var contextToolbar = document.getElementById('context-toolbar');

  function selectElement(el) {
    if (selectedEl && selectedEl !== el) {
      selectedEl.classList.remove('is-selected');
    }
    selectedEl = el;
    if (!el) {
      if (contextToolbar) {
        contextToolbar.hidden = true;
        contextToolbar.style.display = 'none';
      }
      return;
    }
    el.classList.add('is-selected');
    if (contextToolbar) {
      contextToolbar.hidden = false;
      contextToolbar.style.display = 'flex';
      updateContextToolbarPosition();
    }
  }

  function updateContextToolbarPosition() {
    if (!selectedEl || !contextToolbar || contextToolbar.hidden) return;
    var rect = selectedEl.getBoundingClientRect();
    var vpRect = viewport.getBoundingClientRect();
    var left = rect.left - vpRect.left + rect.width / 2;
    var top = Math.max(12, rect.top - vpRect.top - 52);
    contextToolbar.style.left = Math.round(left) + 'px';
    contextToolbar.style.top = Math.round(top) + 'px';
  }

  /* ---------- Bind Drag, Select, Connect & Vote on Elements ---------- */
  function bindInteractiveElement(el) {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    ensureResizeHandle(el);

    el.addEventListener('mousedown', function (e) {
      if (e.target.classList.contains('resize-handle')) return;
      if (currentTool === 'hand' || spacePressed) return;

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
            toId: el.dataset.id
          });
          pendingConnectorFromId = null;
          renderConnectors();
          setTool('select');
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

      selectElement(el);

      // Allow inline text editing on double-click or when clicking inside focused contenteditable
      var editable = e.target.closest('[contenteditable="true"]');
      if (editable && document.activeElement === editable) {
        e.stopPropagation();
        return;
      }

      activeDragEl = el;
      dragMoved = false;
      var rect = el.getBoundingClientRect();
      dragOffsetX = (e.clientX - rect.left) / zoom;
      dragOffsetY = (e.clientY - rect.top) / zoom;
      e.stopPropagation();
    });

    el.addEventListener('dblclick', function (e) {
      var editable = el.querySelector('[contenteditable="true"]');
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
  var penPopover = document.getElementById('pen-popover');

  function setTool(toolName) {
    currentTool = toolName;
    toolBtns.forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tool === toolName);
    });

    if (['sticky', 'shape', 'text', 'frame', 'pen', 'comment'].indexOf(toolName) !== -1) {
      starterDismissedByUser = true;
      syncEmptyBoardStarter();
    }

    if (colorPopover) colorPopover.hidden = (toolName !== 'sticky');
    if (shapePopover) shapePopover.hidden = (toolName !== 'shape');
    if (penPopover) penPopover.hidden = (toolName !== 'pen');

    viewport.classList.toggle('is-panning', toolName === 'hand');
    viewport.classList.toggle('is-crosshair', ['sticky', 'shape', 'text', 'frame', 'pen', 'comment', 'connector'].indexOf(toolName) !== -1);

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

  /* ---------- Viewport Mouse Interaction (Create, Pan, Draw, Drag, Resize) ---------- */
  viewport.addEventListener('mousedown', function (e) {
    var isBackground = (e.target === viewport || e.target === world || e.target.classList.contains('quantalflow-svg-layer') || e.target.classList.contains('canvas-frame'));

    if (currentTool === 'pen') {
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

    if (e.target === viewport || e.target === world || e.target.classList.contains('quantalflow-svg-layer') || currentTool === 'hand' || spacePressed) {
      selectElement(null);
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      viewport.classList.add('is-dragging-pan');
    }
  });

  window.addEventListener('mousemove', function (e) {
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
      activeDragEl.style.left = Math.max(0, Math.round(x)) + 'px';
      activeDragEl.style.top = Math.max(0, Math.round(y)) + 'px';
      renderConnectors();
      updateContextToolbarPosition();
      updateMinimap();
    }
  });

  window.addEventListener('mouseup', function () {
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
    if (isPanning) {
      isPanning = false;
      viewport.classList.remove('is-dragging-pan');
    }
    if (activeDragEl) {
      if (dragMoved) scheduleSave();
      activeDragEl = null;
      dragMoved = false;
    }
  });

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
    } else if (el.classList.contains('canvas-frame')) {
      var fTitle = el.querySelector('.canvas-frame__title')?.textContent || 'Copied Frame';
      clone = createFrame(x, y, fTitle, el.offsetWidth, el.offsetHeight);
    }
    if (clone) selectElement(clone);
    scheduleSave();
  }

  function deleteElement(el) {
    if (!el) return;
    pushHistory();
    var id = el.dataset.id;
    connectors = connectors.filter(function (c) {
      return c.fromId !== id && c.toId !== id;
    });
    el.remove();
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
    var clamped = Math.max(0.25, Math.min(2.5, newZoom));
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

  function resetZoom() {
    zoom = 1;
    panX = 80;
    panY = 50;
    updateTransform(true);
  }

  function fitToScreen() {
    var items = world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape');
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
    var items = [];
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment').forEach(function (el) {
      var type = 'sticky';
      if (el.classList.contains('canvas-frame')) type = 'frame';
      else if (el.classList.contains('canvas-shape')) type = 'shape';
      else if (el.classList.contains('canvas-text')) type = 'text';
      else if (el.classList.contains('canvas-comment')) type = 'comment';

      var text = '';
      if (type === 'frame') text = el.querySelector('.canvas-frame__title')?.textContent || '';
      else if (type === 'sticky') text = el.querySelector('.canvas-sticky__text')?.innerHTML || '';
      else if (type === 'shape') text = el.querySelector('.canvas-shape__text')?.innerHTML || '';
      else if (type === 'text') text = el.querySelector('.canvas-text__content')?.innerHTML || '';
      else if (type === 'comment') text = el.querySelector('.canvas-comment__body')?.innerHTML || '';

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

    return {
      version: 2,
      items: items,
      connectors: JSON.parse(JSON.stringify(connectors)),
      paths: paths
    };
  }

  function restoreBoardState(state) {
    if (!state || !Array.isArray(state.items)) return;
    isRestoringHistory = true;
    selectElement(null);

    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape, .canvas-text, .canvas-comment').forEach(function (el) {
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

  function setSaveStatus(status) {
    if (!saveText || !saveDot) return;
    if (status === 'saving') {
      saveText.textContent = 'Saving changes…';
      saveDot.style.background = '#f59e0b';
    } else {
      saveText.textContent = 'Saved to Cloud';
      saveDot.style.background = '#10b981';
    }
  }

  function scheduleSave() {
    setSaveStatus('saving');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistBoardNow, 500);
  }

  async function persistBoardNow() {
    var payload = {
      title: titleInput ? titleInput.value.trim() : 'New Collaborative Board',
      starred: starBtn ? starBtn.classList.contains('is-starred') : false,
      state: serializeBoardState()
    };
    try {
      localStorage.setItem('quantalflow_board_' + boardId, JSON.stringify(payload));
    } catch (e) {}

    try {
      await fetch('/api/boards/' + encodeURIComponent(boardId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}
    setSaveStatus('saved');
  }

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

  async function loadBoardFromServer() {
    clearCanvasElementsOnly();
    starterDismissedByUser = false;

    var shareInput = document.getElementById('share-link-input');

    try {
      var board = await fetchBoardByAnyId(boardId);
      if (board) {
        // Adopt the canonical id, then show the readable title path in the URL.
        boardId = board.id || boardId;
        if (titleInput && board.title) {
          titleInput.value = board.title;
          document.title = board.title + ' | QuantalFlow App';
        }
        if (shareInput) {
          shareInput.value = window.location.origin + buildBoardPath(boardId, '', board.title);
        }
        syncUrlToTitle(board.title);
        if (starBtn) starBtn.classList.toggle('is-starred', Boolean(board.starred));
        if (board.state && board.state.workspaceMode === 'project-planning' && window.ProjectPlanningSuite) {
          window.ProjectPlanningSuite.open(board.id || boardId, board.title || 'Project Planning Workspace');
          return;
        }
        if (
          board.state &&
          board.state.version === 2 &&
          Array.isArray(board.state.items) &&
          (board.state.items.length > 0 || (Array.isArray(board.state.paths) && board.state.paths.length > 0))
        ) {
          restoreBoardState(board.state);
          syncEmptyBoardStarter();
          return;
        }
      } else if (shareInput) {
        shareInput.value = window.location.origin + buildBoardPath(boardId, '');
      }
    } catch (e) {}

    // Fallback to localStorage if server had no saved items yet
    try {
      var cached = localStorage.getItem('quantalflow_board_' + boardId);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.title && titleInput) {
          titleInput.value = parsed.title;
          document.title = parsed.title + ' | QuantalFlow App';
        }
        if (
          parsed.state &&
          parsed.state.version === 2 &&
          Array.isArray(parsed.state.items) &&
          (parsed.state.items.length > 0 || (Array.isArray(parsed.state.paths) && parsed.state.paths.length > 0))
        ) {
          restoreBoardState(parsed.state);
          syncEmptyBoardStarter();
          return;
        }
      }
    } catch (e) {}

    // If URL asked for a starter template on a new/empty board, inject it automatically
    if (initialTemplate) {
      var tplToInsert = initialTemplate;
      initialTemplate = '';
      if (tplToInsert === 'blank') {
        starterDismissedByUser = true;
        syncEmptyBoardStarter();
      } else {
        insertTemplateByType(tplToInsert, 180, 110);
      }
      return;
    }

    // Otherwise keep the board empty and show the Empty Collaborative Board Starter options
    syncEmptyBoardStarter();
  }

  /* Client-Side SPA Navigation & Browser History Support (popstate) */
  function navigateToBoardRoute(targetBoardId, targetTemplate, pushHistoryEntry) {
    boardId = targetBoardId || 'new-collaborative-board';
    initialTemplate = targetTemplate || '';
    var nextUrl = buildBoardPath(boardId, initialTemplate);
    if (pushHistoryEntry !== false && window.history && window.history.pushState) {
      window.history.pushState({ boardId: boardId, template: initialTemplate }, '', nextUrl);
    }
    loadBoardFromServer();
  }

  window.addEventListener('popstate', function (e) {
    var route = (e.state && e.state.boardId)
      ? { boardId: e.state.boardId, template: e.state.template || '' }
      : parseAppRoute(window.location.pathname, window.location.search);
    navigateToBoardRoute(route.boardId, route.template, false);
  });

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
    world.querySelectorAll('.canvas-frame, .canvas-sticky, .canvas-shape').forEach(function (el) {
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
  document.getElementById('btn-clear')?.addEventListener('click', function () {
    if (confirm('Clear all items from the canvas? (You can Undo with Ctrl+Z)')) {
      pushHistory();
      clearCanvasElementsOnly();
      starterDismissedByUser = false;
      syncEmptyBoardStarter();
      scheduleSave();
    }
  });

  /* ---------- Keyboard Shortcuts ---------- */
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var isEditingText = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

    if (e.key === 'Escape') {
      closeAllModals();
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

    if (e.key === 'Tab' && selectedEl && !selectedEl.classList.contains('canvas-frame')) {
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
