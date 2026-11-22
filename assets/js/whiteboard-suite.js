/**
 * QuantalFlow Whiteboarding Visual Workspace (window.WhiteboardSuite)
 * Professional Miro / FigJam-grade infinite canvas with unified Pointer Events,
 * strict pan isolation, 13 full-featured toolbar tools, multi-view sync & AI.
 */
(function () {
  'use strict';

  var LAYERS = [
    { id: 'strategy',      label: 'Strategy Layer',      color: '#4f46e5', visible: true, locked: false },
    { id: 'operations',    label: 'Operations Layer',    color: '#0d9488', visible: true, locked: false },
    { id: 'finance',       label: 'Finance Layer',       color: '#059669', visible: true, locked: false },
    { id: 'research',      label: 'Research Layer',      color: '#7c3aed', visible: true, locked: false },
    { id: 'documentation', label: 'Documentation Layer', color: '#0284c7', visible: true, locked: false },
    { id: 'ai',            label: 'AI Layer',            color: '#2563eb', visible: true, locked: false }
  ];

  var STATUSES = ['Idea', 'Planned', 'In Progress', 'Review', 'Completed', 'Blocked'];
  var STATUS_SLUGS = {
    'Idea': 'idea', 'Planned': 'planned', 'In Progress': 'in-progress',
    'Review': 'review', 'Completed': 'completed', 'Blocked': 'blocked'
  };
  var ORG_LEVELS = ['All', 'Company', 'Department', 'Team', 'Project', 'Task', 'Document'];
  var STICKY_COLORS = ['#fef9c3', '#fce7f3', '#dbeafe', '#dcfce7', '#f3e8ff', '#ffedd5'];
  var SHAPE_FILLS = ['#eef2ff', '#ffffff', '#fef9c3', '#dcfce7', '#fce7f3', '#ffedd5', '#e0f2fe', '#f3e8ff', 'transparent'];
  var STROKE_COLORS = ['#334155', '#4262ff', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0f172a'];
  var PEN_COLORS = ['#1a1a2e', '#4262ff', '#10b981', '#ef4444', '#f59e0b', '#7c3aed'];
  var EMOJI_REACTIONS = ['👍', '❤️', '🔥', '🎉', '👀'];
  var STICKERS = ['🚀', '💡', '🎯', '⚡', '✅', '🔥', '⭐', '🧠', '📌', '🎉', '❤️', '👀'];

  var SHAPE_DEFS = [
    { id: 'rect',      label: 'Rectangle' },
    { id: 'round',     label: 'Rounded' },
    { id: 'circle',    label: 'Circle' },
    { id: 'triangle',  label: 'Triangle' },
    { id: 'diamond',   label: 'Diamond' },
    { id: 'pill',      label: 'Pill' },
    { id: 'star',      label: 'Star' },
    { id: 'cylinder',  label: 'Cylinder' },
    { id: 'callout',   label: 'Callout' }
  ];

  var FLOWCHART_DEFS = [
    { id: 'diamond',       label: 'Decision Diamond',   w: 170, h: 110, fill: '#fffbeb', stroke: '#d97706', title: 'Decision?' },
    { id: 'rect',          label: 'Process Rectangle',  w: 180, h: 86,  fill: '#eef2ff', stroke: '#4262ff', title: 'Process Step' },
    { id: 'terminator',    label: 'Start / End',        w: 170, h: 68,  fill: '#dcfce7', stroke: '#059669', title: 'Start / End' },
    { id: 'parallelogram', label: 'Data Input/Output',  w: 184, h: 82,  fill: '#e0f2fe', stroke: '#0284c7', title: 'Data I/O' },
    { id: 'document',      label: 'Document',           w: 176, h: 94,  fill: '#f3e8ff', stroke: '#7c3aed', title: 'Document' }
  ];

  var FRAME_PRESETS = [
    { id: 'custom',  label: 'Custom Drag',        w: 0,    h: 0 },
    { id: '16:9',    label: '16:9 Presentation',  w: 960,  h: 540 },
    { id: 'mobile',  label: 'Mobile (390×844)',   w: 390,  h: 844 },
    { id: 'desktop', label: 'Desktop (1280×800)', w: 1280, h: 800 },
    { id: 'a4',      label: 'A4 Page (595×842)',  w: 595,  h: 842 }
  ];

  var TEMPLATE_BLUEPRINTS = [
    { id: 'mindmap',      cat: 'Ideation',     name: 'Mind Map',              desc: 'Central topic connected to 4 color-coded idea branches.' },
    { id: 'flowchart',    cat: 'Diagrams',     name: 'Flowchart',             desc: 'Start, process, decision diamond, and Yes/No outcome paths.' },
    { id: 'kanban',       cat: 'Planning',     name: 'Kanban Board',          desc: 'To Do, In Progress, and Done frames with starter cards.' },
    { id: 'journey',      cat: 'UX Research',  name: 'Customer Journey Map',  desc: 'Discover, Consider, Onboard, and Retain stage columns.' },
    { id: 'swot',         cat: 'Strategy',     name: 'SWOT Analysis',         desc: '2×2 Strengths, Weaknesses, Opportunities, and Threats grid.' },
    { id: 'retro',        cat: 'Agile',        name: 'Retrospective',         desc: 'Went Well, To Improve, and Action Items team board.' },
    { id: 'wireframe',    cat: 'Product',      name: 'App Wireframe',         desc: 'Desktop frame with navigation, hero, and feature card blocks.' },
    { id: 'architecture', cat: 'Engineering',  name: 'System Architecture',   desc: 'Client, API Gateway, Service, and Database Cylinder diagram.' }
  ];

  var PORT_NAMES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  var HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  // Module state
  var rootEl = null;
  var boardId = '';
  var boardTitle = 'Visual Strategy Workspace';
  var callbacks = {};
  var state = null;

  var selectedIds = [];
  var selectedLinkId = null;
  var activeTool = 'select'; // select | hand | sticky | shape | connector | text | frame | pen | comment | flowchart
  var toolBeforeSpace = null;
  var spacePressed = false;
  var selectedShapeType = 'rect';
  var selectedFlowchartType = 'diamond';
  var selectedFramePreset = 'custom';
  var connectorDefaults = { routing: 'elbow', startHead: 'none', endHead: 'arrow-filled', lineStyle: 'solid', color: '#4262ff', width: 2.2 };
  var pendingConnector = null; // supports click-to-connect in addition to drag-to-connect

  var openDrawer = null; // null | 'inspector' | 'layers' | 'ai'
  var dockPopover = null; // null | 'shapes' | 'connector' | 'pen' | 'frame' | 'flowchart' | 'insert'
  var openCommentId = null;
  var showResolvedComments = false;

  var snapGrid = true;
  var gridMode = 0; // 0 = dots, 1 = lines, 2 = clean
  var showGuides = true;
  var minimapOpen = true;
  var reviewMode = false;
  var orgLevelFilter = 'All';
  var searchQuery = '';

  var panX = 110;
  var panY = 90;
  var zoom = 0.95;

  // Photoshop-style Pen / Brush state
  var penMode = 'brush'; // brush | pencil | highlighter | eraser
  var penColor = '#1a1a2e';
  var penWidth = 5;
  var penOpacity = 1;
  var penSoft = false;
  var penSmartShape = false;
  var insertStagger = 0;

  // Interaction state (single authoritative pointer state machine)
  var interaction = null; // { mode, pointerId, ... }
  var activePointers = new Map();
  var pinchState = null;

  var historyStack = [];
  var redoStack = [];
  var saveTimer = null;
  var currentCaps = { canEdit: true, canComment: true, canView: true };
  var currentUser = 'You';
  var aiChat = [];
  var eventsBound = false;

  /* ---------- Utilities ---------- */
  function normalizeTool(t) {
    if (t === 'pan') return 'hand';
    if (t === 'connect') return 'connector';
    return t || 'select';
  }
  function uid(p) { return (p || 'o') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function addDays(d) {
    var dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  }
  function toast(m) { if (callbacks.onToast) callbacks.onToast(m); }

  function primarySelectedId() { return selectedIds.length ? selectedIds[selectedIds.length - 1] : null; }
  function isSelected(id) { return selectedIds.indexOf(id) !== -1; }
  function setSelection(ids, keepDrawer) {
    selectedIds = (ids || []).filter(Boolean);
    if (selectedIds.length) selectedLinkId = null;
    if (!selectedIds.length && !keepDrawer && openDrawer === 'inspector') openDrawer = null;
    syncSelectionDom();
    renderCtxBar();
    renderDrawer();
  }

  function pushHistory() {
    if (!state) return;
    historyStack.push(JSON.stringify(state));
    if (historyStack.length > 40) historyStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!historyStack.length) { toast('Nothing to undo'); return; }
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(historyStack.pop());
    selectedIds = [];
    selectedLinkId = null;
    render();
    persist();
  }

  function redo() {
    if (!redoStack.length) { toast('Nothing to redo'); return; }
    historyStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    selectedIds = [];
    selectedLinkId = null;
    render();
    persist();
  }

  function makeObj(ov) {
    return Object.assign({
      id: uid('wb'),
      kind: 'sticky', // sticky|shape|flowchart|text|section|comment|task|kpi|decision|doc|process|diamond|swimlane|image|code|table|embed|sticker
      x: 240, y: 160, w: 200, h: 200,
      rotate: 0,
      z: 10,
      bg: '#fef9c3',
      stroke: '#334155',
      strokeWidth: 2,
      strokeStyle: 'solid', // solid | dashed
      opacity: 1,
      fontFamily: 'Inter, sans-serif',
      fontSize: 15,
      textAlign: 'left',
      bold: false, italic: false, underline: false, strike: false,
      textColor: '#0f172a',
      highlightColor: 'transparent',
      listStyle: 'none', // none | bullet | number
      reactions: {},
      layer: 'strategy',
      orgLevel: 'Project',
      title: '',
      description: '',
      assignee: '',
      owner: currentUser,
      priority: 'Medium',
      status: 'Idea',
      dueDate: addDays(10),
      department: 'Product',
      tags: [],
      kpiValue: '78%',
      kpiTarget: '100%',
      decision: { summary: '', discussion: '', participants: '', votes: '4 Yes / 0 No', approval: 'Pending', date: addDays(0) },
      attachments: [],
      comments: []
    }, ov || {});
  }

  function createStarterState(title) {
    var sec1 = makeObj({ id: 'wb_sec_1', kind: 'section', x: 60, y: 80, w: 560, h: 360, title: 'Frame 1: Strategy & Discovery', layer: 'strategy', orgLevel: 'Company', bg: 'rgba(255,255,255,0.72)' });
    var st1 = makeObj({ id: 'wb_st_1', kind: 'sticky', x: 90, y: 120, w: 200, h: 190, bg: '#fef9c3', title: 'Customer Onboarding Revamp — cut time-to-first-value to 2 days', status: 'In Progress', priority: 'High', assignee: 'Alex', department: 'Product', layer: 'strategy', orgLevel: 'Project' });
    var dec1 = makeObj({ id: 'wb_dec_1', kind: 'decision', x: 330, y: 120, w: 250, h: 165, title: 'Approve AI Copilot Rollout', description: 'Unanimous sign-off to ship AI assistant across all workspaces.', status: 'Completed', priority: 'High', assignee: 'Sam', department: 'Engineering', layer: 'strategy', orgLevel: 'Document', decision: { summary: 'Ship persistent AI assistant in Whiteboarding', discussion: 'Reviewed latency and enterprise security controls.', participants: 'Alex, Sam, Jordan', votes: '5 Approve / 0 Reject', approval: 'Approved', date: addDays(-2) } });
    var tsk1 = makeObj({ id: 'wb_tsk_1', kind: 'task', x: 680, y: 120, w: 240, h: 155, title: 'Build Workflow Automation Engine', description: 'Trigger notifications automatically on status change.', status: 'In Progress', priority: 'Critical', assignee: 'Sam', dueDate: addDays(5), department: 'Engineering', layer: 'operations', orgLevel: 'Task' });
    var kpi1 = makeObj({ id: 'wb_kpi_1', kind: 'kpi', x: 680, y: 315, w: 230, h: 145, title: 'Activation Rate KPI', description: 'Teams creating 2+ boards in week 1.', kpiValue: '64%', kpiTarget: '75%', status: 'Planned', department: 'Finance', layer: 'finance', orgLevel: 'Department' });
    return {
      version: 2,
      activeView: 'canvas',
      layers: JSON.parse(JSON.stringify(LAYERS)),
      objects: [sec1, st1, dec1, tsk1, kpi1],
      links: [
        { id: uid('lk'), fromId: 'wb_st_1', fromPort: 'e', toId: 'wb_tsk_1', toPort: 'w', routing: 'elbow', endHead: 'arrow-filled', lineStyle: 'solid', color: '#4262ff', width: 2.2, label: 'Depends On' },
        { id: uid('lk'), fromId: 'wb_dec_1', fromPort: 'e', toId: 'wb_tsk_1', toPort: 'w', routing: 'curved', endHead: 'arrow-filled', lineStyle: 'solid', color: '#16a34a', width: 2.2, label: 'Supports' },
        { id: uid('lk'), fromId: 'wb_tsk_1', fromPort: 's', toId: 'wb_kpi_1', toPort: 'n', routing: 'straight', endHead: 'arrow-filled', lineStyle: 'dashed', color: '#6366f1', width: 2.2, label: 'Drives' }
      ],
      paths: [],
      automations: [
        { id: uid('au'), name: 'Notify Team on Completion', enabled: true, trigger: 'Completed', action: 'notify', detail: 'Team notified in activity stream', runs: 1 },
        { id: uid('au'), name: 'Alert Manager on Blocker', enabled: true, trigger: 'Blocked', action: 'escalate', detail: 'Escalated to Department Lead', runs: 0 }
      ],
      activity: [
        { id: uid('ac'), actor: currentUser, text: 'Opened "' + (title || 'Visual Strategy Workspace') + '"', at: new Date().toISOString() }
      ]
    };
  }

  function getObj(id) { return (state && state.objects || []).find(function (o) { return o.id === id; }) || null; }
  function getLink(id) { return (state && state.links || []).find(function (l) { return l.id === id; }) || null; }
  function getLayer(id) { return (state && state.layers || []).find(function (l) { return l.id === id; }) || LAYERS[0]; }

  function isObjVisible(o) {
    if (o.kind === 'comment' && o.resolved && !showResolvedComments) return false;
    var lyr = getLayer(o.layer);
    if (lyr && !lyr.visible) return false;
    if (orgLevelFilter !== 'All' && o.orgLevel !== orgLevelFilter) return false;
    if (searchQuery) {
      var hay = ((o.title || '') + ' ' + (o.description || '') + ' ' + (o.assignee || '') + ' ' + (o.department || '') + ' ' + (o.tags || []).join(' ')).toLowerCase();
      if (hay.indexOf(searchQuery) === -1) return false;
    }
    return true;
  }

  function logAct(text) {
    if (!state) return;
    if (!Array.isArray(state.activity)) state.activity = [];
    state.activity.unshift({ id: uid('ac'), actor: currentUser, text: text, at: new Date().toISOString() });
    if (state.activity.length > 50) state.activity.length = 50;
  }

  function triggerAutomations(obj, statusVal) {
    (state.automations || []).forEach(function (rule) {
      if (!rule.enabled || rule.trigger !== statusVal) return;
      rule.runs = (rule.runs || 0) + 1;
      var msg = '⚡ ' + rule.name + ' → "' + obj.title + '" (' + rule.detail + ')';
      logAct(msg);
      toast(msg);
    });
  }

  function persist() {
    if (!state) return;
    try { localStorage.setItem('quantalflow_wb_v1_' + boardId, JSON.stringify(state)); } catch (_) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (callbacks.onSave) callbacks.onSave(JSON.parse(JSON.stringify(state)));
    }, 350);
  }

  /* ---------- Coordinate & Geometry Helpers ---------- */
  function getVpEl() { return rootEl ? rootEl.querySelector('[data-wb-vp]') : null; }
  function getWorldEl() { return rootEl ? rootEl.querySelector('[data-wb-world]') : null; }

  function clientToWorld(cx, cy) {
    var vp = getVpEl();
    if (!vp) return { x: 0, y: 0 };
    var r = vp.getBoundingClientRect();
    return { x: (cx - r.left - panX) / zoom, y: (cy - r.top - panY) / zoom };
  }

  function viewportCenterWorld() {
    var vp = getVpEl();
    if (!vp) return { x: 360, y: 240 };
    return { x: (vp.clientWidth / 2 - panX) / zoom, y: (vp.clientHeight / 2 - panY) / zoom };
  }

  function applyWorldTransform() {
    var w = getWorldEl();
    if (w) w.style.transform = 'translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px) scale(' + zoom + ')';
    var zb = rootEl && rootEl.querySelector('[data-wb-zoom="reset"]');
    if (zb) zb.textContent = Math.round(zoom * 100) + '%';
    positionCtxBar();
  }

  function zoomAt(nextZoom, clientX, clientY) {
    var vp = getVpEl();
    if (!vp) return;
    var clamped = clamp(Math.round(nextZoom * 100) / 100, 0.25, 2.5);
    var r = vp.getBoundingClientRect();
    var fx = (clientX !== undefined ? clientX : r.left + r.width / 2) - r.left;
    var fy = (clientY !== undefined ? clientY : r.top + r.height / 2) - r.top;
    var wx = (fx - panX) / zoom;
    var wy = (fy - panY) / zoom;
    zoom = clamped;
    panX = fx - wx * zoom;
    panY = fy - wy * zoom;
    applyWorldTransform();
  }

  function getObjBox(o) {
    return { x: Number(o.x) || 0, y: Number(o.y) || 0, w: Number(o.w) || 200, h: Number(o.h) || 140 };
  }

  function getPortCoord(o, port) {
    var b = getObjBox(o);
    switch (port) {
      case 'n':  return { x: b.x + b.w / 2, y: b.y };
      case 'ne': return { x: b.x + b.w,     y: b.y };
      case 'e':  return { x: b.x + b.w,     y: b.y + b.h / 2 };
      case 'se': return { x: b.x + b.w,     y: b.y + b.h };
      case 's':  return { x: b.x + b.w / 2, y: b.y + b.h };
      case 'sw': return { x: b.x,           y: b.y + b.h };
      case 'w':  return { x: b.x,           y: b.y + b.h / 2 };
      case 'nw': return { x: b.x,           y: b.y };
      default:   return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
  }

  function nearestPortFor(o, wx, wy) {
    var best = { port: 'e', dist: Infinity, x: 0, y: 0 };
    PORT_NAMES.forEach(function (p) {
      var c = getPortCoord(o, p);
      var d = Math.hypot(c.x - wx, c.y - wy);
      if (d < best.dist) best = { port: p, dist: d, x: c.x, y: c.y };
    });
    return best;
  }

  function findSnapPort(wx, wy, excludeObjId) {
    var threshold = 26 / zoom;
    var best = null;
    (state.objects || []).forEach(function (o) {
      if (o.id === excludeObjId || !isObjVisible(o) || o.kind === 'comment') return;
      var np = nearestPortFor(o, wx, wy);
      if (np.dist <= threshold && (!best || np.dist < best.dist)) {
        best = { objId: o.id, port: np.port, x: np.x, y: np.y, dist: np.dist };
      }
    });
    return best;
  }

  function autoChoosePorts(a, b) {
    var ba = getObjBox(a), bb = getObjBox(b);
    var acx = ba.x + ba.w / 2, acy = ba.y + ba.h / 2;
    var bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
    var dx = bcx - acx, dy = bcy - acy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { from: 'e', to: 'w' } : { from: 'w', to: 'e' };
    }
    return dy >= 0 ? { from: 's', to: 'n' } : { from: 'n', to: 's' };
  }

  function computeConnectorPath(lk) {
    var p1, p2, fp = lk.fromPort, tp = lk.toPort;
    var a = lk.fromId ? getObj(lk.fromId) : null;
    var b = lk.toId ? getObj(lk.toId) : null;
    if (a && b && (!fp || !tp)) {
      var auto = autoChoosePorts(a, b);
      fp = fp || auto.from;
      tp = tp || auto.to;
    }
    p1 = a ? getPortCoord(a, fp || 'e') : { x: Number(lk.x1) || 0, y: Number(lk.y1) || 0 };
    p2 = b ? getPortCoord(b, tp || 'w') : { x: Number(lk.x2) || 0, y: Number(lk.y2) || 0 };

    var routing = lk.routing || 'elbow';
    var d, lx, ly;
    if (routing === 'straight') {
      d = 'M ' + Math.round(p1.x) + ' ' + Math.round(p1.y) + ' L ' + Math.round(p2.x) + ' ' + Math.round(p2.y);
      lx = (p1.x + p2.x) / 2;
      ly = (p1.y + p2.y) / 2;
    } else if (routing === 'curved') {
      var dx = p2.x - p1.x, dy = p2.y - p1.y;
      var c1x = p1.x + dx * 0.45, c1y = p1.y;
      var c2x = p2.x - dx * 0.45, c2y = p2.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        c1x = p1.x; c1y = p1.y + dy * 0.45;
        c2x = p2.x; c2y = p2.y - dy * 0.45;
      }
      d = 'M ' + Math.round(p1.x) + ' ' + Math.round(p1.y) + ' C ' + Math.round(c1x) + ' ' + Math.round(c1y) + ', ' + Math.round(c2x) + ' ' + Math.round(c2y) + ', ' + Math.round(p2.x) + ' ' + Math.round(p2.y);
      lx = (p1.x + 3 * c1x + 3 * c2x + p2.x) / 8;
      ly = (p1.y + 3 * c1y + 3 * c2y + p2.y) / 8;
    } else {
      // Orthogonal / Elbow stepped routing
      var horiz = (fp === 'e' || fp === 'w' || (!fp && Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)));
      if (horiz) {
        var mx = Math.round((p1.x + p2.x) / 2);
        d = 'M ' + Math.round(p1.x) + ' ' + Math.round(p1.y) + ' L ' + mx + ' ' + Math.round(p1.y) + ' L ' + mx + ' ' + Math.round(p2.y) + ' L ' + Math.round(p2.x) + ' ' + Math.round(p2.y);
        lx = mx;
        ly = (p1.y + p2.y) / 2;
      } else {
        var my = Math.round((p1.y + p2.y) / 2);
        d = 'M ' + Math.round(p1.x) + ' ' + Math.round(p1.y) + ' L ' + Math.round(p1.x) + ' ' + my + ' L ' + Math.round(p2.x) + ' ' + my + ' L ' + Math.round(p2.x) + ' ' + Math.round(p2.y);
        lx = (p1.x + p2.x) / 2;
        ly = my;
      }
    }
    return { d: d, p1: p1, p2: p2, lx: Math.round(lx), ly: Math.round(ly) };
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function smoothPathD(pts) {
    if (!pts || !pts.length) return '';
    if (pts.length === 1) {
      var x0 = round1(pts[0][0]), y0 = round1(pts[0][1]);
      return 'M ' + x0 + ' ' + y0 + ' L ' + round1(x0 + 0.1) + ' ' + y0;
    }
    if (pts.length === 2) {
      return 'M ' + round1(pts[0][0]) + ' ' + round1(pts[0][1]) + ' L ' + round1(pts[1][0]) + ' ' + round1(pts[1][1]);
    }
    var d = 'M ' + round1(pts[0][0]) + ' ' + round1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = round1((pts[i][0] + pts[i + 1][0]) / 2);
      var my = round1((pts[i][1] + pts[i + 1][1]) / 2);
      d += ' Q ' + round1(pts[i][0]) + ' ' + round1(pts[i][1]) + ' ' + mx + ' ' + my;
    }
    var last = pts[pts.length - 1];
    d += ' L ' + round1(last[0]) + ' ' + round1(last[1]);
    return d;
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    var t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function shapeSvgMarkup(shapeType, w, h, fill, stroke, sw, dash) {
    var f = esc(fill || '#eef2ff');
    var s = esc(stroke || '#4262ff');
    var swVal = Number(sw) || 2;
    var da = dash === 'dashed' ? ' stroke-dasharray="7 5"' : (dash === 'dotted' ? ' stroke-dasharray="2 5"' : '');
    var pad = Math.max(2, swVal);
    var W = Math.max(20, w), H = Math.max(20, h);
    var inner = '';
    if (shapeType === 'round') {
      inner = '<rect x="' + pad + '" y="' + pad + '" width="' + (W - pad * 2) + '" height="' + (H - pad * 2) + '" rx="16" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'pill' || shapeType === 'terminator') {
      var rx = Math.round((H - pad * 2) / 2);
      inner = '<rect x="' + pad + '" y="' + pad + '" width="' + (W - pad * 2) + '" height="' + (H - pad * 2) + '" rx="' + rx + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'circle') {
      inner = '<ellipse cx="' + (W / 2) + '" cy="' + (H / 2) + '" rx="' + ((W - pad * 2) / 2) + '" ry="' + ((H - pad * 2) / 2) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'triangle') {
      inner = '<polygon points="' + (W / 2) + ',' + pad + ' ' + (W - pad) + ',' + (H - pad) + ' ' + pad + ',' + (H - pad) + '" stroke-linejoin="round" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'diamond') {
      inner = '<polygon points="' + (W / 2) + ',' + pad + ' ' + (W - pad) + ',' + (H / 2) + ' ' + (W / 2) + ',' + (H - pad) + ' ' + pad + ',' + (H / 2) + '" stroke-linejoin="round" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'parallelogram') {
      var skew = Math.min(28, W * 0.18);
      inner = '<polygon points="' + (pad + skew) + ',' + pad + ' ' + (W - pad) + ',' + pad + ' ' + (W - pad - skew) + ',' + (H - pad) + ' ' + pad + ',' + (H - pad) + '" stroke-linejoin="round" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'document') {
      var by = H - pad - 12;
      inner = '<path d="M ' + pad + ' ' + pad + ' H ' + (W - pad) + ' V ' + by + ' Q ' + (W * 0.75) + ' ' + (by - 14) + ' ' + (W / 2) + ' ' + by + ' T ' + pad + ' ' + by + ' Z" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'star') {
      var cx = W / 2, cy = H / 2, rox = (W - pad * 2) / 2, roy = (H - pad * 2) / 2;
      var rix = rox * 0.42, riy = roy * 0.42, pts = [];
      for (var i = 0; i < 10; i++) {
        var ang = (Math.PI / 5) * i - Math.PI / 2;
        var rx2 = i % 2 === 0 ? rox : rix;
        var ry2 = i % 2 === 0 ? roy : riy;
        pts.push(Math.round(cx + Math.cos(ang) * rx2) + ',' + Math.round(cy + Math.sin(ang) * ry2));
      }
      inner = '<polygon points="' + pts.join(' ') + '" stroke-linejoin="round" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'cylinder') {
      var ry3 = Math.min(18, H * 0.18);
      inner =
        '<path d="M ' + pad + ' ' + (pad + ry3) + ' V ' + (H - pad - ry3) + ' A ' + ((W - pad * 2) / 2) + ' ' + ry3 + ' 0 0 0 ' + (W - pad) + ' ' + (H - pad - ry3) + ' V ' + (pad + ry3) + ' Z" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>' +
        '<ellipse cx="' + (W / 2) + '" cy="' + (pad + ry3) + '" rx="' + ((W - pad * 2) / 2) + '" ry="' + ry3 + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else if (shapeType === 'callout') {
      var ch = H - pad - 16;
      inner = '<path d="M ' + (pad + 12) + ' ' + pad + ' H ' + (W - pad - 12) + ' Q ' + (W - pad) + ' ' + pad + ' ' + (W - pad) + ' ' + (pad + 12) + ' V ' + (ch - 12) + ' Q ' + (W - pad) + ' ' + ch + ' ' + (W - pad - 12) + ' ' + ch + ' H ' + (pad + 44) + ' L ' + (pad + 22) + ' ' + (H - pad) + ' L ' + (pad + 26) + ' ' + ch + ' H ' + (pad + 12) + ' Q ' + pad + ' ' + ch + ' ' + pad + ' ' + (ch - 12) + ' V ' + (pad + 12) + ' Q ' + pad + ' ' + pad + ' ' + (pad + 12) + ' ' + pad + ' Z" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    } else {
      inner = '<rect x="' + pad + '" y="' + pad + '" width="' + (W - pad * 2) + '" height="' + (H - pad * 2) + '" rx="4" fill="' + f + '" stroke="' + s + '" stroke-width="' + swVal + '"' + da + '/>';
    }
    return '<svg class="wb-shape-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + inner + '</svg>';
  }

  function autoStickyFontSize(text, w, h) {
    var len = (text || '').length;
    var area = Math.max(12000, (w || 200) * (h || 200));
    var base = Math.sqrt(area) / 11;
    if (len > 140) return Math.max(11, Math.round(base * 0.65));
    if (len > 85)  return Math.max(12, Math.round(base * 0.78));
    if (len > 45)  return Math.max(13, Math.round(base * 0.9));
    return clamp(Math.round(base), 14, 22);
  }

  function formatMentions(text) {
    return esc(text).replace(/(^|\s)(@[a-zA-Z0-9_.-]+)/g, '$1<span class="wb-mention">$2</span>');
  }

  function renderSimpleMermaidSvg(code) {
    var lines = String(code || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var edges = [];
    lines.forEach(function (line) {
      var m = line.match(/^([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(([^)]+)\))?\s*--[>-]+(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(([^)]+)\))?/);
      if (m) {
        edges.push({
          from: m[1], fromLbl: m[2] || m[3] || m[4] || m[1],
          lbl: m[5] || '',
          to: m[6], toLbl: m[7] || m[8] || m[9] || m[6]
        });
      }
    });
    if (!edges.length) {
      return '<div style="font-size:11px;color:#64748b;">Tip: write Mermaid arrows like <code>A[Start] --&gt; B[Process]</code></div>';
    }
    var nodes = [];
    var nodeMap = {};
    edges.forEach(function (e) {
      if (!nodeMap[e.from]) { nodeMap[e.from] = { id: e.from, label: e.fromLbl }; nodes.push(nodeMap[e.from]); }
      if (!nodeMap[e.to])   { nodeMap[e.to]   = { id: e.to,   label: e.toLbl };   nodes.push(nodeMap[e.to]); }
    });
    var w = Math.max(240, nodes.length * 126 + 20);
    var pos = {};
    nodes.forEach(function (n, idx) { pos[n.id] = { x: 16 + idx * 124, y: 24 }; });
    var parts = ['<svg width="' + w + '" height="78" viewBox="0 0 ' + w + ' 78">'];
    edges.forEach(function (e) {
      var a = pos[e.from], b = pos[e.to];
      parts.push('<line x1="' + (a.x + 96) + '" y1="42" x2="' + b.x + '" y2="42" stroke="#4262ff" stroke-width="2" />');
      if (e.lbl) parts.push('<text x="' + ((a.x + 96 + b.x) / 2) + '" y="36" text-anchor="middle" font-size="9" fill="#475569">' + esc(e.lbl) + '</text>');
    });
    nodes.forEach(function (n) {
      var p = pos[n.id];
      parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="96" height="36" rx="8" fill="#eef2ff" stroke="#4262ff" stroke-width="1.5"/>');
      parts.push('<text x="' + (p.x + 48) + '" y="' + (p.y + 22) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">' + esc(n.label.slice(0, 14)) + '</text>');
    });
    parts.push('</svg>');
    return parts.join('');
  }

  /* ---------- Authoritative Tool-State Setter ---------- */
  function setActiveTool(nextTool, opts) {
    var t = normalizeTool(nextTool);
    if (activeTool !== t && pendingConnector) {
      pendingConnector = null;
      renderEdgesSvg();
    }
    activeTool = t;
    if (opts && opts.closePopover !== false) {
      dockPopover = null;
      var pb = rootEl && rootEl.querySelector('[data-wb-popover-box]');
      if (pb) pb.hidden = true;
    }
    syncToolUi();
  }

  function syncToolUi() {
    if (!rootEl) return;
    var effectiveTool = spacePressed ? 'hand' : activeTool;
    rootEl.querySelectorAll('[data-wb-tool]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wbTool === effectiveTool);
    });
    var vp = getVpEl();
    if (vp) {
      vp.dataset.wbActiveTool = effectiveTool;
      vp.classList.toggle('is-pan-tool', effectiveTool === 'hand');
      vp.classList.toggle('is-pen-tool', effectiveTool === 'pen');
      vp.classList.toggle('is-connect-tool', effectiveTool === 'connector');
      vp.classList.toggle('is-place-tool', ['sticky', 'shape', 'frame', 'comment', 'flowchart'].indexOf(effectiveTool) !== -1);
      var bCur = vp.querySelector('[data-wb-brush-cursor]');
      if (bCur && effectiveTool !== 'pen') bCur.hidden = true;
    }
    var drawSvg = rootEl.querySelector('[data-wb-drawings]');
    if (drawSvg) drawSvg.classList.toggle('is-eraser-mode', effectiveTool === 'pen' && penMode === 'eraser');
  }

  /* ---------- Shell DOM ---------- */
  function ensureDom() {
    if (rootEl) return rootEl;
    rootEl = document.createElement('div');
    rootEl.id = 'whiteboard-suite';
    rootEl.className = 'wb-root';
    rootEl.hidden = true;
    rootEl.innerHTML =
      '<div class="wb-top-pill">' +
        '<div class="wb-seg" role="tablist">' +
          '<button type="button" class="wb-seg__btn" data-wb-view="canvas">Canvas</button>' +
          '<button type="button" class="wb-seg__btn" data-wb-view="table">Table</button>' +
          '<button type="button" class="wb-seg__btn" data-wb-view="kanban">Kanban</button>' +
          '<button type="button" class="wb-seg__btn" data-wb-view="timeline">Timeline</button>' +
          '<button type="button" class="wb-seg__btn" data-wb-view="dashboard">Dashboard</button>' +
        '</div>' +
        '<span class="wb-divider"></span>' +
        '<button type="button" class="wb-pill-btn" data-wb-drawer="layers" title="Multi-Layer Workspace">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>' +
          '<span>Layers</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn" data-wb-org-modal title="Organisational Map Mode">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/></svg>' +
          '<span>Org Map</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn" data-wb-gen-doc title="Generate Editable Document from Board">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 17H8"/></svg>' +
          '<span>Gen Doc</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn" data-wb-gen-deck title="Generate Presentation Deck &amp; Speaker Notes">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"/><path d="M4 3v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3"/><path d="m9 21 3-3 3 3"/></svg>' +
          '<span>Gen Slides</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn" data-wb-auto-modal title="No-Code Workflow Automations">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' +
          '<span>Auto</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn" data-wb-review title="Toggle Review Mode">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<span>Review</span>' +
        '</button>' +
        '<button type="button" class="wb-pill-btn wb-pill-btn--ai" data-wb-drawer="ai" title="AI Whiteboard Assistant">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>' +
          '<span>AI</span>' +
        '</button>' +
      '</div>' +

      // 13-Tool Left Vertical Dock (Top to Bottom)
      '<nav class="wb-dock" data-wb-dock aria-label="Whiteboard tools">' +
        // 1. Select / Pointer (V)
        '<button type="button" class="wb-dock__btn" data-wb-tool="select" title="Select / Pointer (V)" aria-label="Select tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>' +
        '</button>' +
        // 2. Hand / Pan (H)
        '<button type="button" class="wb-dock__btn" data-wb-tool="hand" title="Hand / Pan (H or Space)" aria-label="Hand pan tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>' +
        '</button>' +
        // 3. Sticky Note (S / N)
        '<button type="button" class="wb-dock__btn" data-wb-tool="sticky" title="Sticky Note (S or N)" aria-label="Sticky note tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>' +
        '</button>' +
        // 4. Shape (R)
        '<button type="button" class="wb-dock__btn" data-wb-tool="shape" data-wb-open-pop="shapes" title="Shapes (R)" aria-label="Shape tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>' +
        '</button>' +
        // 5. Connector / Line (L / C)
        '<button type="button" class="wb-dock__btn" data-wb-tool="connector" data-wb-open-pop="connector" title="Connectors &amp; Lines (L or C)" aria-label="Connector tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2" fill="currentColor"/><path d="M7 6h5v12h5"/><circle cx="19" cy="18" r="2" fill="currentColor"/></svg>' +
        '</button>' +
        // 6. Text (T)
        '<button type="button" class="wb-dock__btn" data-wb-tool="text" title="Text (T)" aria-label="Text tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>' +
        '</button>' +
        // 7. Frame / Section (F)
        '<button type="button" class="wb-dock__btn" data-wb-tool="frame" data-wb-open-pop="frame" title="Frame / Section (F)" aria-label="Frame tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/></svg>' +
        '</button>' +
        // 8. Pen / Freehand Drawing (P)
        '<button type="button" class="wb-dock__btn" data-wb-tool="pen" data-wb-open-pop="pen" title="Pen / Freehand Draw (P)" aria-label="Pen draw tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>' +
        '</button>' +
        // 9. Comment / Annotation (M)
        '<button type="button" class="wb-dock__btn" data-wb-tool="comment" title="Comment Pin (M)" aria-label="Comment tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' +
        '</button>' +
        '<div class="wb-dock__sep"></div>' +
        // 10. Templates / Diagram Blueprints Picker (4-Squares)
        '<button type="button" class="wb-dock__btn" data-wb-templates title="Templates &amp; Smart Cards" aria-label="Templates picker">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
        '</button>' +
        // 11. Flowchart / Decision Node (Diamond)
        '<button type="button" class="wb-dock__btn" data-wb-tool="flowchart" data-wb-open-pop="flowchart" title="Flowchart / Decision Nodes" aria-label="Flowchart tool">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 12 12 22 2 12"/></svg>' +
        '</button>' +
        '<div class="wb-dock__sep"></div>' +
        // 12. Insert / Add Assets (+)
        '<button type="button" class="wb-dock__btn wb-dock__btn--accent" data-wb-popover="insert" title="Insert Assets (Image, Mermaid, Table, Embed, Stickers)" aria-label="Insert assets">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
        '</button>' +
        // 13. Delete / Clear (Trash)
        '<button type="button" class="wb-dock__btn wb-dock__btn--danger" data-wb-trash title="Delete Selection or Clear Canvas" aria-label="Delete or clear">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>' +
        '</button>' +
      '</nav>' +

      '<div class="wb-popover" data-wb-popover-box hidden></div>' +
      '<div class="wb-ctx-bar" data-wb-ctx-bar hidden></div>' +
      '<div class="wb-stage" data-wb-stage></div>' +
      '<aside class="wb-drawer" data-wb-drawer-box hidden></aside>' +
      '<div class="wb-modal-bd" data-wb-modal hidden><div class="wb-modal" data-wb-modal-box></div></div>' +
      '<input type="file" id="wb-asset-upload" class="wb-sr-file" accept="image/*,.svg,.pdf" multiple />';

    (document.querySelector('.quantalflow-app') || document.body).appendChild(rootEl);
    if (!eventsBound) {
      eventsBound = true;
      bindEvents();
    }
    return rootEl;
  }

  /* ---------- Render Stage ---------- */
  function render() {
    if (!rootEl || !state) return;
    rootEl.querySelectorAll('[data-wb-view]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wbView === state.activeView);
    });
    rootEl.querySelectorAll('[data-wb-drawer]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wbDrawer === openDrawer);
    });
    var dock = rootEl.querySelector('[data-wb-dock]');
    if (dock) dock.hidden = state.activeView !== 'canvas';

    var stage = rootEl.querySelector('[data-wb-stage]');
    if (state.activeView === 'canvas') renderCanvas(stage);
    else if (state.activeView === 'table') renderTable(stage);
    else if (state.activeView === 'kanban') renderKanban(stage);
    else if (state.activeView === 'timeline') renderTimeline(stage);
    else if (state.activeView === 'dashboard') renderDashboard(stage);

    syncToolUi();
    renderCtxBar();
    renderDrawer();
  }

  function renderEdgesSvg() {
    var svg = rootEl && rootEl.querySelector('[data-wb-svg]');
    if (!svg || !state) return;
    var parts = [
      '<defs>' +
        '<marker id="wb-m-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="context-stroke" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>' +
        '<marker id="wb-m-arrow-filled" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0.5 1 L 9.5 5 L 0.5 9 z" fill="context-stroke"/></marker>' +
        '<marker id="wb-m-diamond" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><polygon points="1,6 6,1 11,6 6,11" fill="context-stroke"/></marker>' +
        '<marker id="wb-m-circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><circle cx="5" cy="5" r="3.5" fill="context-stroke"/></marker>' +
      '</defs>'
    ];
    (state.links || []).forEach(function (lk) {
      if (lk.fromId) {
        var a = getObj(lk.fromId);
        if (!a || !isObjVisible(a)) return;
      }
      if (lk.toId) {
        var b = getObj(lk.toId);
        if (!b || !isObjVisible(b)) return;
      }
      var geom = computeConnectorPath(lk);
      var col = lk.color || '#4262ff';
      var sw = Number(lk.width) || 2.2;
      var dash = lk.lineStyle === 'dashed' ? '7 5' : (lk.lineStyle === 'dotted' ? '2 5' : '');
      var sHead = lk.startHead || 'none';
      var eHead = lk.endHead || 'arrow-filled';
      var startAttr = sHead === 'none' ? '' : ' marker-start="url(#wb-m-' + sHead + ')"';
      var endAttr = eHead === 'none' ? '' : ' marker-end="url(#wb-m-' + eHead + ')"';
      var sel = selectedLinkId === lk.id;

      parts.push(
        '<g data-wb-link-id="' + esc(lk.id) + '">' +
          (sel ? '<path d="' + geom.d + '" fill="none" stroke="rgba(66,98,255,0.28)" stroke-width="' + (sw + 7) + '" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
          '<path class="wb-edge-hit" data-wb-link-hit="' + esc(lk.id) + '" d="' + geom.d + '" fill="none" stroke="transparent" stroke-width="18"/>' +
          '<path d="' + geom.d + '" fill="none" stroke="' + esc(col) + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + startAttr + endAttr + '/>' +
          (lk.label ? '<g class="wb-edge-label-g" data-wb-link-hit="' + esc(lk.id) + '"><rect x="' + (geom.lx - Math.max(24, lk.label.length * 4 + 10)) + '" y="' + (geom.ly - 11) + '" width="' + Math.max(48, lk.label.length * 8 + 20) + '" height="22" rx="6" fill="#ffffff" stroke="' + (sel ? '#4262ff' : '#e2e8f0') + '" stroke-width="1.2"/><text x="' + geom.lx + '" y="' + (geom.ly + 4) + '" text-anchor="middle" style="font-size:11px;font-weight:700;fill:#1e293b;">' + esc(lk.label) + '</text></g>' : '') +
          (sel ? '<circle class="wb-edge-handle" data-wb-lk-end="' + esc(lk.id) + ':start" cx="' + Math.round(geom.p1.x) + '" cy="' + Math.round(geom.p1.y) + '" r="6" fill="#ffffff" stroke="#2563eb" stroke-width="2.2"/>' +
                 '<circle class="wb-edge-handle" data-wb-lk-end="' + esc(lk.id) + ':end" cx="' + Math.round(geom.p2.x) + '" cy="' + Math.round(geom.p2.y) + '" r="6" fill="#ffffff" stroke="#2563eb" stroke-width="2.2"/>' : '') +
        '</g>'
      );
    });
    // Live connector preview (drag-to-connect OR click-to-connect)
    var liveLink = (interaction && interaction.mode === 'draw-connector' && interaction.previewLink) ? interaction.previewLink : pendingConnector;
    if (liveLink) {
      var pg = computeConnectorPath(liveLink);
      var pDash = liveLink.lineStyle === 'dashed' ? '7 5' : (liveLink.lineStyle === 'dotted' ? '2 5' : '6 4');
      var pStart = (liveLink.startHead && liveLink.startHead !== 'none') ? ' marker-start="url(#wb-m-' + liveLink.startHead + ')"' : '';
      var pEnd = (liveLink.endHead && liveLink.endHead !== 'none') ? ' marker-end="url(#wb-m-' + liveLink.endHead + ')"' : '';
      parts.push(
        '<path d="' + pg.d + '" fill="none" stroke="' + esc(liveLink.color || connectorDefaults.color) + '" stroke-width="' + (Number(liveLink.width) || 2.4) + '" stroke-dasharray="' + pDash + '" stroke-linecap="round" stroke-linejoin="round"' + pStart + pEnd + '/>' +
        '<circle cx="' + Math.round(pg.p1.x) + '" cy="' + Math.round(pg.p1.y) + '" r="4.5" fill="#4262ff" stroke="#ffffff" stroke-width="1.5"/>'
      );
    }
    svg.innerHTML = parts.join('');
  }

  function renderDrawingsSvg() {
    var dSvg = rootEl && rootEl.querySelector('[data-wb-drawings]');
    if (!dSvg || !state) return;
    var defs = '<defs><filter id="wb-brush-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>';
    dSvg.innerHTML = defs + (state.paths || []).map(function (p) {
      var filterAttr = p.soft ? ' filter="url(#wb-brush-soft)"' : '';
      var blendStyle = p.blend === 'multiply' ? ' style="mix-blend-mode:multiply;"' : '';
      return '<path data-wb-path-id="' + esc(p.id) + '" d="' + esc(p.d || '') + '" fill="none" stroke="' + esc(p.stroke || '#1a1a2e') + '" stroke-width="' + (Number(p.strokeWidth) || 4) + '" stroke-opacity="' + (p.opacity != null ? p.opacity : 1) + '" stroke-linecap="round" stroke-linejoin="round"' + filterAttr + blendStyle + ' />';
    }).join('');
  }

  function renderCanvas(stage) {
    var gridCls = gridMode === 1 ? ' grid-lines' : (gridMode === 2 ? ' grid-clean' : '');
    var gridLabel = gridMode === 0 ? 'Dots' : (gridMode === 1 ? 'Lines' : 'Clean');
    var effectiveTool = spacePressed ? 'hand' : activeTool;

    stage.innerHTML =
      '<div class="wb-viewport' + gridCls + '" data-wb-vp data-wb-active-tool="' + effectiveTool + '">' +
        '<div class="wb-world" data-wb-world style="transform:translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px) scale(' + zoom + ');">' +
          '<svg class="wb-edges-svg" data-wb-svg></svg>' +
          '<svg class="wb-drawings-svg" data-wb-drawings></svg>' +
          '<div class="wb-guide-x" data-wb-gx></div>' +
          '<div class="wb-guide-y" data-wb-gy></div>' +
        '</div>' +
        '<div class="wb-brush-cursor" data-wb-brush-cursor hidden></div>' +
        '<div class="wb-bottom-left">' +
          '<button type="button" class="wb-pill-btn" data-wb-undo title="Undo (Ctrl+Z)">↶</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-redo title="Redo (Ctrl+Y)">↷</button>' +
          '<span class="wb-divider"></span>' +
          '<button type="button" class="wb-pill-btn" data-wb-grid-mode title="Toggle Grid Style">' + gridLabel + '</button>' +
          '<button type="button" class="wb-pill-btn' + (snapGrid ? ' is-active' : '') + '" data-wb-snap title="Toggle Auto-Grid Snap">Snap</button>' +
          '<span class="wb-divider"></span>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="out" aria-label="Zoom out">−</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="reset" title="Reset zoom">' + Math.round(zoom * 100) + '%</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="in" aria-label="Zoom in">+</button>' +
          '<button type="button" class="wb-pill-btn' + (minimapOpen ? ' is-active' : '') + '" data-wb-minimap-toggle title="Toggle Mini-map">Map</button>' +
        '</div>' +
        '<div class="wb-minimap" data-wb-minimap' + (minimapOpen ? '' : ' hidden') + '></div>' +
      '</div>';

    var world = stage.querySelector('[data-wb-world]');
    var minimap = stage.querySelector('[data-wb-minimap]');
    var visibleObjs = (state.objects || []).filter(isObjVisible);

    // Sync anchored comment pins to their host object
    visibleObjs.forEach(function (o) {
      if (o.kind === 'comment' && o.anchorId) {
        var host = getObj(o.anchorId);
        if (host) {
          o.x = Math.round(host.x + (o.anchorDx || 0));
          o.y = Math.round(host.y + (o.anchorDy || 0));
        }
      }
    });

    renderDrawingsSvg();
    renderEdgesSvg();

    // Frame slide numbering
    var frameCounter = 0;
    var commentCounter = 0;

    visibleObjs.slice().sort(function (a, b) {
      var zA = (a.kind === 'section' || a.kind === 'swimlane') ? 1 : (a.z || 10);
      var zB = (b.kind === 'section' || b.kind === 'swimlane') ? 1 : (b.z || 10);
      return zA - zB;
    }).forEach(function (o) {
      var el = document.createElement('div');
      var sel = isSelected(o.id);
      el.className = 'wb-obj wb-obj--' + o.kind + (sel ? ' is-selected' : '') + (o.collapsed ? ' is-collapsed' : '') + (o.resolved ? ' is-resolved' : '');
      el.dataset.objId = o.id;
      el.style.left = Math.round(o.x) + 'px';
      el.style.top = Math.round(o.y) + 'px';
      if (o.kind !== 'comment') {
        if (o.w) el.style.width = Math.round(o.w) + 'px';
        if (o.h && o.kind !== 'text') el.style.height = Math.round(o.h) + 'px';
      }
      if (o.rotate) el.style.transform = 'rotate(' + o.rotate + 'deg)';
      if (o.opacity != null && o.opacity < 1) el.style.opacity = String(o.opacity);
      if (o.z && o.kind !== 'section' && o.kind !== 'swimlane') el.style.zIndex = String(sel ? Math.max(20, o.z) : o.z);
      if (o.bg) el.style.setProperty('--wb-bg', o.bg);

      var textStyle =
        'font-family:' + esc(o.fontFamily || 'Inter, sans-serif') + ';' +
        'text-align:' + esc(o.textAlign || (o.kind === 'shape' || o.kind === 'flowchart' ? 'center' : 'left')) + ';' +
        (o.bold ? 'font-weight:800;' : '') +
        (o.italic ? 'font-style:italic;' : '') +
        ((o.underline || o.strike) ? 'text-decoration:' + [o.underline ? 'underline' : '', o.strike ? 'line-through' : ''].filter(Boolean).join(' ') + ';' : '') +
        (o.textColor ? 'color:' + esc(o.textColor) + ';' : '') +
        (o.highlightColor && o.highlightColor !== 'transparent' ? 'background:' + esc(o.highlightColor) + ';padding:2px 4px;border-radius:4px;' : '');

      if (o.kind === 'sticky') {
        var fs = autoStickyFontSize(o.title, o.w || 200, o.h || 200);
        var reactionsHtml = Object.keys(o.reactions || {}).filter(function (k) { return o.reactions[k] > 0; }).map(function (em) {
          return '<button type="button" class="wb-reaction-chip" data-wb-react="' + esc(o.id) + ':' + esc(em) + '">' + em + ' ' + o.reactions[em] + '</button>';
        }).join('');
        el.innerHTML =
          '<div class="wb-sticky-body" data-wb-editable="' + esc(o.id) + '" contenteditable="false" data-placeholder="Type your idea…" style="font-size:' + fs + 'px;' + textStyle + '">' + esc(o.title || '') + '</div>' +
          (reactionsHtml ? '<div class="wb-sticky-reactions">' + reactionsHtml + '</div>' : '');
      } else if (o.kind === 'shape' || o.kind === 'flowchart') {
        var stype = o.shapeType || (o.kind === 'flowchart' ? 'diamond' : 'rect');
        el.dataset.shapeType = stype;
        el.innerHTML =
          shapeSvgMarkup(stype, o.w || 170, o.h || 100, o.bg || '#eef2ff', o.stroke || '#4262ff', o.strokeWidth || 2, o.strokeStyle || 'solid') +
          '<div class="wb-shape-label" data-wb-editable="' + esc(o.id) + '" contenteditable="false" data-placeholder="Double-click…" style="font-size:' + (o.fontSize || 13.5) + 'px;' + textStyle + '">' + esc(o.title || '') + '</div>' +
          (o.kind === 'flowchart'
            ? '<button type="button" class="wb-fc-plus wb-fc-plus--top" data-wb-fc-spawn="' + esc(o.id) + ':top" title="Add connected node above">+</button>' +
              '<button type="button" class="wb-fc-plus wb-fc-plus--right" data-wb-fc-spawn="' + esc(o.id) + ':right" title="Add connected node right">+</button>' +
              '<button type="button" class="wb-fc-plus wb-fc-plus--bottom" data-wb-fc-spawn="' + esc(o.id) + ':bottom" title="Add connected node below">+</button>' +
              '<button type="button" class="wb-fc-plus wb-fc-plus--left" data-wb-fc-spawn="' + esc(o.id) + ':left" title="Add connected node left">+</button>'
            : '');
      } else if (o.kind === 'text') {
        el.innerHTML =
          '<div class="wb-text-editor" data-wb-editable="' + esc(o.id) + '" contenteditable="false" style="font-size:' + (o.fontSize || 18) + 'px;' + textStyle + '">' + esc(o.title || '') + '</div>';
      } else if (o.kind === 'section') {
        frameCounter += 1;
        el.innerHTML =
          '<div class="wb-frame-head">' +
            '<span class="wb-frame-slide-badge">Slide ' + frameCounter + '</span>' +
            '<span class="wb-frame-title" data-wb-editable="' + esc(o.id) + '" contenteditable="false">' + esc(o.title || ('Frame ' + frameCounter)) + '</span>' +
          '</div>';
      } else if (o.kind === 'swimlane') {
        el.innerHTML = '<div class="wb-obj__top"><div class="wb-obj__title" data-wb-editable="' + esc(o.id) + '" contenteditable="false">' + esc(o.title) + '</div><span class="wb-chip">' + esc(o.layer) + '</span></div>';
      } else if (o.kind === 'comment') {
        commentCounter += 1;
        var replies = Array.isArray(o.comments) ? o.comments : [];
        var threadHtml = '';
        if (openCommentId === o.id) {
          threadHtml =
            '<div class="wb-comment-thread" data-wb-stop-canvas>' +
              '<div class="wb-comment-thread__head">' +
                '<strong style="font-size:12px;">Comment #' + commentCounter + (o.resolved ? ' (Resolved)' : '') + '</strong>' +
                '<div style="display:flex;gap:4px;">' +
                  '<button type="button" class="wb-btn" data-wb-cmt-resolve="' + esc(o.id) + '" style="height:24px;padding:0 7px;font-size:11px;" title="Resolve thread">' + (o.resolved ? '↩ Reopen' : '✓ Resolve') + '</button>' +
                  '<button type="button" class="wb-btn" data-wb-cmt-close style="height:24px;padding:0 7px;">×</button>' +
                '</div>' +
              '</div>' +
              '<div style="max-height:170px;overflow-y:auto;">' +
                (replies.length ? replies.map(function (c) {
                  return '<div class="wb-comment-msg"><strong>' + esc(c.author || currentUser) + ':</strong> ' + formatMentions(c.text) + '</div>';
                }).join('') : '<div style="font-size:11.5px;color:#94a3b8;margin-bottom:6px;">Start the discussion… use @name to mention.</div>') +
              '</div>' +
              '<div style="display:flex;gap:4px;margin:4px 0 6px;">' +
                EMOJI_REACTIONS.map(function (em) {
                  var cnt = (o.reactions && o.reactions[em]) || 0;
                  return '<button type="button" class="wb-reaction-chip" data-wb-react="' + esc(o.id) + ':' + esc(em) + '">' + em + (cnt ? ' ' + cnt : '') + '</button>';
                }).join('') +
              '</div>' +
              '<form data-wb-pin-cmt-form="' + esc(o.id) + '" style="display:flex;gap:5px;">' +
                '<input type="text" class="wb-pin-cmt-in" placeholder="Reply (@mention)…" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:12px;" />' +
                '<button type="submit" class="wb-btn wb-btn--primary" style="height:30px;padding:0 10px;">Post</button>' +
              '</form>' +
            '</div>';
        }
        el.innerHTML = '<span>' + (o.resolved ? '✓' : commentCounter) + '</span>' + threadHtml;
      } else if (o.kind === 'image') {
        el.innerHTML = o.src
          ? '<img src="' + esc(o.src) + '" alt="' + esc(o.title || 'Uploaded asset') + '" />'
          : '<div style="padding:16px;text-align:center;font-size:12px;color:#475569;"><strong>📄 ' + esc(o.title || 'Document') + '</strong><div style="margin-top:4px;">' + esc(o.description || 'PDF / File') + '</div></div>';
      } else if (o.kind === 'code') {
        el.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:#94a3b8;"><span>Mermaid / Code Block</span><span style="color:#60a5fa;">Live Diagram</span></div>' +
          '<textarea class="wb-code-area" data-wb-code-id="' + esc(o.id) + '" spellcheck="false">' + esc(o.code || 'A[Start] --> B[Review]\nB -->|Yes| C[Ship]') + '</textarea>' +
          '<div class="wb-mermaid-preview">' + renderSimpleMermaidSvg(o.code || 'A[Start] --> B[Review]\nB -->|Yes| C[Ship]') + '</div>';
      } else if (o.kind === 'table') {
        var rows = Array.isArray(o.rows) && o.rows.length ? o.rows : [['Item', 'Owner', 'Status'], ['Discovery', 'Alex', 'Done'], ['Build', 'Sam', 'In Progress']];
        el.innerHTML =
          '<table class="wb-inline-table" data-wb-table-id="' + esc(o.id) + '">' +
            rows.map(function (r, ri) {
              var tag = ri === 0 ? 'th' : 'td';
              return '<tr>' + r.map(function (cell, ci) {
                return '<' + tag + ' contenteditable="true" data-wb-cell="' + esc(o.id) + ':' + ri + ':' + ci + '">' + esc(cell) + '</' + tag + '>';
              }).join('') + '</tr>';
            }).join('') +
          '</table>';
      } else if (o.kind === 'embed') {
        el.innerHTML =
          '<div class="wb-obj__top"><span class="wb-obj__kind">Embed Link</span><a href="' + esc(o.url || '#') + '" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:#4262ff;">Open ↗</a></div>' +
          '<div class="wb-obj__title">' + esc(o.title || 'Embedded Resource') + '</div>' +
          '<div class="wb-obj__desc" style="word-break:break-all;">' + esc(o.url || 'https://quantalflow.com') + '</div>';
      } else if (o.kind === 'sticker') {
        el.innerHTML = '<span>' + esc(o.title || '🚀') + '</span>';
      } else {
        // Smart Cards: task, kpi, decision, doc, process, diamond
        var stSlug = STATUS_SLUGS[o.status] || 'idea';
        var extraHtml = '';
        if (o.kind === 'kpi') {
          extraHtml = '<div class="wb-obj__kpi-val">' + esc(o.kpiValue || '0%') + ' <span style="font-size:11px;font-weight:600;color:#64748b;">/ ' + esc(o.kpiTarget || '100%') + '</span></div>';
        } else if (o.kind === 'decision' && o.decision) {
          extraHtml = '<div class="wb-chip" style="margin-bottom:6px;background:#fef3c7;color:#92400e;">' + esc(o.decision.approval || 'Pending') + ' · ' + esc(o.decision.votes || '') + '</div>';
        }
        el.innerHTML =
          '<div class="wb-obj__top"><span class="wb-obj__kind">' + esc(o.kind) + '</span><span class="wb-chip wb-status--' + stSlug + '">' + esc(o.status || 'Idea') + '</span></div>' +
          '<div class="wb-obj__title" data-wb-editable="' + esc(o.id) + '" contenteditable="false">' + esc(o.title) + '</div>' +
          extraHtml +
          (o.description ? '<div class="wb-obj__desc">' + esc(o.description) + '</div>' : '') +
          '<div class="wb-obj__meta"><span>' + (o.assignee ? '👤 ' + esc(o.assignee) : esc(o.department || '')) + '</span><span>' + (o.dueDate ? '📅 ' + esc(o.dueDate.slice(5)) : '') + '</span></div>';
      }

      // Add 8 magnetic connection ports to connectable objects
      if (o.kind !== 'comment') {
        var portsWrap = document.createElement('div');
        portsWrap.className = 'wb-ports';
        portsWrap.innerHTML = PORT_NAMES.map(function (pn) {
          return '<span class="wb-port wb-port--' + pn + '" data-wb-port="' + esc(o.id) + ':' + pn + '"></span>';
        }).join('');
        el.appendChild(portsWrap);
      }

      // Add 8 resize handles + rotation handle when uniquely selected
      if (sel && selectedIds.length === 1 && o.kind !== 'comment' && currentCaps.canEdit && !reviewMode) {
        HANDLE_NAMES.forEach(function (hn) {
          var hEl = document.createElement('span');
          hEl.className = 'wb-handle wb-handle--' + hn;
          hEl.dataset.wbResize = hn;
          el.appendChild(hEl);
        });
        var rotEl = document.createElement('span');
        rotEl.className = 'wb-handle wb-handle--rot';
        rotEl.dataset.wbRotate = '1';
        rotEl.title = 'Rotate';
        rotEl.textContent = '↻';
        el.appendChild(rotEl);
      }

      world.appendChild(el);

      if (minimap && minimapOpen) {
        var dot = document.createElement('div');
        dot.className = 'wb-minimap__dot';
        dot.style.left = clamp(Math.round(o.x * 0.08 + 10), 2, 158) + 'px';
        dot.style.top = clamp(Math.round(o.y * 0.08 + 10), 2, 96) + 'px';
        dot.style.width = Math.max(6, Math.round((o.w || 200) * 0.08)) + 'px';
        dot.style.height = Math.max(5, Math.round((o.h || 140) * 0.08)) + 'px';
        minimap.appendChild(dot);
      }
    });

    bindViewportPointer(stage);
    positionCtxBar();
  }

  function syncSelectionDom() {
    var stage = rootEl && rootEl.querySelector('[data-wb-stage]');
    if (!stage) return;
    if (state && state.activeView === 'canvas') {
      // Re-render canvas cleanly so 8 resize handles & connector selection highlight stay exact
      renderCanvas(stage);
    }
  }

  /* ---------- Floating Contextual Formatting Toolbar ---------- */
  function renderCtxBar() {
    var bar = rootEl && rootEl.querySelector('[data-wb-ctx-bar]');
    if (!bar) return;
    if (!state || state.activeView !== 'canvas' || !currentCaps.canEdit || reviewMode) {
      bar.hidden = true;
      return;
    }

    if (selectedLinkId) {
      var lk = getLink(selectedLinkId);
      if (!lk) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.innerHTML =
        '<select class="wb-ctx-select" data-wb-lk-prop="routing" title="Routing style">' +
          '<option value="elbow"' + ((lk.routing || 'elbow') === 'elbow' ? ' selected' : '') + '>Elbow</option>' +
          '<option value="curved"' + (lk.routing === 'curved' ? ' selected' : '') + '>Curved</option>' +
          '<option value="straight"' + (lk.routing === 'straight' ? ' selected' : '') + '>Straight</option>' +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-lk-prop="startHead" title="Start endpoint">' +
          '<option value="none"' + ((!lk.startHead || lk.startHead === 'none') ? ' selected' : '') + '>Start: None</option>' +
          '<option value="arrow-filled"' + (lk.startHead === 'arrow-filled' ? ' selected' : '') + '>Start: Arrow</option>' +
          '<option value="arrow"' + (lk.startHead === 'arrow' ? ' selected' : '') + '>Start: Open</option>' +
          '<option value="diamond"' + (lk.startHead === 'diamond' ? ' selected' : '') + '>Start: Diamond</option>' +
          '<option value="circle"' + (lk.startHead === 'circle' ? ' selected' : '') + '>Start: Circle</option>' +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-lk-prop="endHead" title="End endpoint">' +
          '<option value="arrow-filled"' + ((lk.endHead || 'arrow-filled') === 'arrow-filled' ? ' selected' : '') + '>End: Arrow</option>' +
          '<option value="arrow"' + (lk.endHead === 'arrow' ? ' selected' : '') + '>End: Open</option>' +
          '<option value="diamond"' + (lk.endHead === 'diamond' ? ' selected' : '') + '>End: Diamond</option>' +
          '<option value="circle"' + (lk.endHead === 'circle' ? ' selected' : '') + '>End: Circle</option>' +
          '<option value="none"' + (lk.endHead === 'none' ? ' selected' : '') + '>End: None</option>' +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-lk-prop="lineStyle" title="Line style">' +
          '<option value="solid"' + ((lk.lineStyle || 'solid') === 'solid' ? ' selected' : '') + '>Solid</option>' +
          '<option value="dashed"' + (lk.lineStyle === 'dashed' ? ' selected' : '') + '>Dashed</option>' +
          '<option value="dotted"' + (lk.lineStyle === 'dotted' ? ' selected' : '') + '>Dotted</option>' +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-lk-prop="width" title="Stroke width">' +
          '<option value="1.5"' + (Number(lk.width) === 1.5 ? ' selected' : '') + '>Thin</option>' +
          '<option value="2.2"' + ((Number(lk.width) || 2.2) === 2.2 ? ' selected' : '') + '>Med</option>' +
          '<option value="4"' + (Number(lk.width) === 4 ? ' selected' : '') + '>Thick</option>' +
        '</select>' +
        '<span class="wb-ctx-sep"></span>' +
        STROKE_COLORS.slice(0, 6).map(function (c) {
          return '<button type="button" class="wb-ctx-swatch' + (lk.color === c ? ' is-selected' : '') + '" data-wb-lk-color="' + c + '" style="background:' + c + ';" title="Line color"></button>';
        }).join('') +
        '<span class="wb-ctx-sep"></span>' +
        '<button type="button" class="wb-ctx-btn" data-wb-lk-edit-label title="Edit connector label">Label</button>' +
        '<button type="button" class="wb-ctx-btn wb-ctx-btn--danger" data-wb-del title="Delete connector">Delete</button>';
      positionCtxBar();
      return;
    }

    if (!selectedIds.length) { bar.hidden = true; return; }
    var o = getObj(primarySelectedId());
    if (!o || o.kind === 'comment') { bar.hidden = true; return; }

    bar.hidden = false;
    var html = [];

    if (o.kind === 'sticky') {
      STICKY_COLORS.forEach(function (c) {
        html.push('<button type="button" class="wb-ctx-swatch' + (o.bg === c ? ' is-selected' : '') + '" data-wb-bg="' + c + '" style="background:' + c + ';"></button>');
      });
      html.push('<span class="wb-ctx-sep"></span>');
      html.push(
        '<select class="wb-ctx-select" data-wb-obj-prop="fontFamily" title="Font style">' +
          '<option value="Inter, sans-serif"' + ((o.fontFamily || '').indexOf('Inter') !== -1 ? ' selected' : '') + '>Sans</option>' +
          '<option value="Georgia, serif"' + ((o.fontFamily || '').indexOf('Georgia') !== -1 ? ' selected' : '') + '>Serif</option>' +
          '<option value="Fragment Mono, monospace"' + ((o.fontFamily || '').indexOf('Mono') !== -1 ? ' selected' : '') + '>Mono</option>' +
        '</select>'
      );
      html.push('<button type="button" class="wb-ctx-btn' + (o.textAlign === 'left' ? ' is-active' : '') + '" data-wb-align="left" title="Align left">≡L</button>');
      html.push('<button type="button" class="wb-ctx-btn' + (o.textAlign === 'center' ? ' is-active' : '') + '" data-wb-align="center" title="Align center">≡C</button>');
      html.push('<button type="button" class="wb-ctx-btn' + (o.textAlign === 'right' ? ' is-active' : '') + '" data-wb-align="right" title="Align right">≡R</button>');
      html.push('<button type="button" class="wb-ctx-btn" data-wb-bullet title="Toggle bullet list">• List</button>');
      html.push('<span class="wb-ctx-sep"></span>');
      EMOJI_REACTIONS.slice(0, 4).forEach(function (em) {
        html.push('<button type="button" class="wb-ctx-btn" data-wb-react="' + esc(o.id) + ':' + esc(em) + '" title="React ' + em + '">' + em + '</button>');
      });
    } else if (o.kind === 'shape' || o.kind === 'flowchart') {
      SHAPE_FILLS.slice(0, 6).forEach(function (c) {
        html.push('<button type="button" class="wb-ctx-swatch' + (o.bg === c ? ' is-selected' : '') + '" data-wb-bg="' + c + '" style="background:' + (c === 'transparent' ? '#fff' : c) + ';" title="Fill color"></button>');
      });
      html.push('<span class="wb-ctx-sep"></span>');
      html.push(
        '<select class="wb-ctx-select" data-wb-obj-prop="stroke" title="Border color">' +
          STROKE_COLORS.map(function (c) { return '<option value="' + c + '"' + (o.stroke === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-obj-prop="strokeWidth" title="Border width">' +
          '<option value="1"' + (Number(o.strokeWidth) === 1 ? ' selected' : '') + '>1px</option>' +
          '<option value="2"' + ((Number(o.strokeWidth) || 2) === 2 ? ' selected' : '') + '>2px</option>' +
          '<option value="4"' + (Number(o.strokeWidth) === 4 ? ' selected' : '') + '>4px</option>' +
        '</select>' +
        '<button type="button" class="wb-ctx-btn' + (o.strokeStyle === 'dashed' ? ' is-active' : '') + '" data-wb-toggle-dash title="Dashed border">---</button>' +
        '<select class="wb-ctx-select" data-wb-obj-prop="opacity" title="Opacity">' +
          '<option value="1"' + ((o.opacity == null || o.opacity === 1) ? ' selected' : '') + '>100%</option>' +
          '<option value="0.75"' + (o.opacity === 0.75 ? ' selected' : '') + '>75%</option>' +
          '<option value="0.45"' + (o.opacity === 0.45 ? ' selected' : '') + '>45%</option>' +
        '</select>'
      );
    } else if (o.kind === 'text') {
      html.push(
        '<select class="wb-ctx-select" data-wb-obj-prop="fontFamily">' +
          '<option value="Inter, sans-serif"' + ((o.fontFamily || '').indexOf('Inter') !== -1 ? ' selected' : '') + '>Sans</option>' +
          '<option value="Georgia, serif"' + ((o.fontFamily || '').indexOf('Georgia') !== -1 ? ' selected' : '') + '>Serif</option>' +
          '<option value="Fragment Mono, monospace"' + ((o.fontFamily || '').indexOf('Mono') !== -1 ? ' selected' : '') + '>Mono</option>' +
        '</select>' +
        '<select class="wb-ctx-select" data-wb-obj-prop="fontSize">' +
          [14, 18, 24, 32, 42].map(function (sz) { return '<option value="' + sz + '"' + ((Number(o.fontSize) || 18) === sz ? ' selected' : '') + '>' + sz + 'px</option>'; }).join('') +
        '</select>' +
        '<button type="button" class="wb-ctx-btn' + (o.bold ? ' is-active' : '') + '" data-wb-fmt="bold"><strong>B</strong></button>' +
        '<button type="button" class="wb-ctx-btn' + (o.italic ? ' is-active' : '') + '" data-wb-fmt="italic"><em>I</em></button>' +
        '<button type="button" class="wb-ctx-btn' + (o.underline ? ' is-active' : '') + '" data-wb-fmt="underline"><u>U</u></button>' +
        '<button type="button" class="wb-ctx-btn' + (o.strike ? ' is-active' : '') + '" data-wb-fmt="strike"><s>S</s></button>' +
        '<button type="button" class="wb-ctx-btn" data-wb-align="left">L</button>' +
        '<button type="button" class="wb-ctx-btn" data-wb-align="center">C</button>' +
        '<button type="button" class="wb-ctx-btn" data-wb-align="right">R</button>' +
        '<button type="button" class="wb-ctx-btn" data-wb-bullet>• List</button>' +
        '<span class="wb-ctx-sep"></span>' +
        ['#0f172a', '#4262ff', '#dc2626', '#059669'].map(function (c) {
          return '<button type="button" class="wb-ctx-swatch' + (o.textColor === c ? ' is-selected' : '') + '" data-wb-text-color="' + c + '" style="background:' + c + ';" title="Text color"></button>';
        }).join('') +
        '<button type="button" class="wb-ctx-btn' + (o.highlightColor && o.highlightColor !== 'transparent' ? ' is-active' : '') + '" data-wb-hl-toggle title="Toggle highlight">HL</button>'
      );
    } else if (o.kind === 'section') {
      html.push(
        '<button type="button" class="wb-ctx-btn" data-wb-frame-fill title="Toggle background fill">Fill</button>' +
        '<button type="button" class="wb-ctx-btn' + (o.collapsed ? ' is-active' : '') + '" data-wb-frame-collapse title="Collapse/expand frame">' + (o.collapsed ? 'Expand' : 'Collapse') + '</button>'
      );
    }

    html.push(
      '<span class="wb-ctx-sep"></span>' +
      '<button type="button" class="wb-ctx-btn" data-wb-z="front" title="Bring to front">↑</button>' +
      '<button type="button" class="wb-ctx-btn" data-wb-z="back" title="Send to back">↓</button>' +
      '<button type="button" class="wb-ctx-btn" data-wb-dup title="Duplicate (Ctrl+D)">Dup</button>' +
      '<button type="button" class="wb-ctx-btn" data-wb-open-insp title="Open properties inspector">Props</button>' +
      '<button type="button" class="wb-ctx-btn wb-ctx-btn--danger" data-wb-del title="Delete (Del)">Del</button>'
    );

    bar.innerHTML = html.join('');
    positionCtxBar();
  }

  function positionCtxBar() {
    var bar = rootEl && rootEl.querySelector('[data-wb-ctx-bar]');
    var vp = getVpEl();
    if (!bar || bar.hidden || !vp) return;
    var vpRect = vp.getBoundingClientRect();
    var targetX = vpRect.width / 2;
    var targetY = 66;

    if (selectedLinkId) {
      var lk = getLink(selectedLinkId);
      if (lk) {
        var g = computeConnectorPath(lk);
        targetX = g.lx * zoom + panX;
        targetY = g.ly * zoom + panY - 46;
      }
    } else if (selectedIds.length) {
      var o = getObj(primarySelectedId());
      if (o) {
        var b = getObjBox(o);
        targetX = (b.x + b.w / 2) * zoom + panX;
        targetY = b.y * zoom + panY - 50;
      }
    }
    var halfW = Math.min((bar.offsetWidth || 260) / 2, vpRect.width / 2 - 12);
    targetX = clamp(targetX, halfW + 12, vpRect.width - halfW - 12);
    targetY = clamp(targetY, 64, vpRect.height - 68);
    bar.style.left = Math.round(targetX) + 'px';
    bar.style.top = Math.round(targetY) + 'px';
  }

  /* ---------- Inline Editing Helpers ---------- */
  function focusInlineEdit(objId, selectAll) {
    setTimeout(function () {
      var ed = rootEl && rootEl.querySelector('[data-wb-editable="' + objId + '"]');
      if (!ed) return;
      ed.setAttribute('contenteditable', 'true');
      ed.focus();
      if (selectAll && window.getSelection && document.createRange) {
        var range = document.createRange();
        range.selectNodeContents(ed);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      var onInput = function () {
        var o = getObj(objId);
        if (!o) return;
        o.title = ed.innerText;
        if (o.kind === 'sticky') {
          ed.style.fontSize = autoStickyFontSize(o.title, o.w, o.h) + 'px';
        }
        persist();
      };
      var onKeyDown = function (ke) {
        var o = getObj(objId);
        if (!o) return;
        if (o.kind === 'sticky' && (ke.key === 'Tab' || ((ke.ctrlKey || ke.metaKey) && ke.key === 'Enter'))) {
          ke.preventDefault();
          ed.blur();
          spawnAdjacentSticky(o);
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          ed.blur();
        }
      };
      var onBlur = function () {
        ed.setAttribute('contenteditable', 'false');
        ed.removeEventListener('input', onInput);
        ed.removeEventListener('keydown', onKeyDown);
        ed.removeEventListener('blur', onBlur);
        var o = getObj(objId);
        if (o) {
          o.title = ed.innerText.trim();
          // Auto-remove empty text boxes on blur!
          if (o.kind === 'text' && !o.title) {
            state.objects = state.objects.filter(function (x) { return x.id !== o.id; });
            selectedIds = selectedIds.filter(function (x) { return x !== o.id; });
            render();
            persist();
            return;
          }
          persist();
        }
      };
      ed.addEventListener('input', onInput);
      ed.addEventListener('keydown', onKeyDown);
      ed.addEventListener('blur', onBlur);
    }, 20);
  }

  function spawnAdjacentSticky(refObj) {
    if (!currentCaps.canEdit || reviewMode) return;
    pushHistory();
    var next = makeObj({
      kind: 'sticky',
      x: Math.round(refObj.x + (refObj.w || 200) + 24),
      y: Math.round(refObj.y),
      w: refObj.w || 200,
      h: refObj.h || 200,
      bg: refObj.bg || '#fef9c3',
      title: ''
    });
    state.objects.push(next);
    selectedIds = [next.id];
    render();
    persist();
    focusInlineEdit(next.id, false);
  }

  function openConnectorLabelEditor(linkId) {
    var lk = getLink(linkId);
    var vp = getVpEl();
    if (!lk || !vp || !currentCaps.canEdit || reviewMode) return;
    var old = vp.querySelector('.wb-edge-editor');
    if (old) old.remove();
    var geom = computeConnectorPath(lk);
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'wb-edge-editor';
    inp.value = lk.label || '';
    inp.placeholder = 'Label (e.g. Yes, No)…';
    inp.style.left = Math.round(geom.lx * zoom + panX) + 'px';
    inp.style.top = Math.round(geom.ly * zoom + panY) + 'px';
    vp.appendChild(inp);
    inp.focus();
    inp.select();
    function commit() {
      pushHistory();
      lk.label = inp.value.trim();
      inp.remove();
      renderEdgesSvg();
      persist();
    }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      else if (e.key === 'Escape') { inp.removeEventListener('blur', commit); inp.remove(); }
    });
  }

  /* ---------- Smart Shape Recognition for Freehand Pen ---------- */
  function recognizeSmartShape(pts) {
    if (!pts || pts.length < 6) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pathLen = 0;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][0] < minX) minX = pts[i][0];
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][0] > maxX) maxX = pts[i][0];
      if (pts[i][1] > maxY) maxY = pts[i][1];
      if (i > 0) pathLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    var w = maxX - minX, h = maxY - minY;
    var startEnd = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    if (pathLen < 35) return null;
    // Straight line?
    if (startEnd > pathLen * 0.86) {
      return { kind: 'line', x1: pts[0][0], y1: pts[0][1], x2: pts[pts.length - 1][0], y2: pts[pts.length - 1][1] };
    }
    // Closed loop -> circle vs rect
    if (w > 30 && h > 30 && startEnd < Math.max(w, h) * 0.45) {
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      var rx = w / 2, ry = h / 2;
      var errSum = 0;
      for (var j = 0; j < pts.length; j++) {
        var nx = (pts[j][0] - cx) / rx, ny = (pts[j][1] - cy) / ry;
        errSum += Math.abs(Math.hypot(nx, ny) - 1);
      }
      var avgErr = errSum / pts.length;
      return { kind: 'shape', shapeType: avgErr < 0.24 ? 'circle' : 'rect', x: Math.round(minX), y: Math.round(minY), w: Math.round(w), h: Math.round(h) };
    }
    return null;
  }

  /* ---------- Unified Pointer Events on Viewport (Mouse + Trackpad + Touch) ---------- */
  function bindViewportPointer(stage) {
    var vp = stage.querySelector('[data-wb-vp]');
    var world = stage.querySelector('[data-wb-world]');
    if (!vp || !world) return;

    function resolveConnectorPoint(target, wPt, excludeObjId) {
      var portEl = target && target.closest ? target.closest('[data-wb-port]') : null;
      if (portEl) {
        var pp = portEl.dataset.wbPort.split(':');
        if (pp[0] !== excludeObjId) {
          var pHost = getObj(pp[0]);
          if (pHost) {
            var pc = getPortCoord(pHost, pp[1]);
            return { objId: pHost.id, port: pp[1], x: Math.round(pc.x), y: Math.round(pc.y) };
          }
        }
      }
      var snap = findSnapPort(wPt.x, wPt.y, excludeObjId);
      if (snap) return { objId: snap.objId, port: snap.port, x: Math.round(snap.x), y: Math.round(snap.y) };
      var cardUnder = target && target.closest ? target.closest('.wb-obj') : null;
      if (cardUnder) {
        var hostObj = getObj(cardUnder.dataset.objId);
        if (hostObj && hostObj.kind !== 'comment' && hostObj.id !== excludeObjId) {
          var np = nearestPortFor(hostObj, wPt.x, wPt.y);
          return { objId: hostObj.id, port: np.port, x: Math.round(np.x), y: Math.round(np.y) };
        }
      }
      return { objId: null, port: null, x: Math.round(wPt.x), y: Math.round(wPt.y) };
    }

    function updateBrushCursor(clientX, clientY) {
      var bCur = vp.querySelector('[data-wb-brush-cursor]');
      if (!bCur) return;
      var effectiveTool = spacePressed ? 'hand' : activeTool;
      if (effectiveTool !== 'pen') { bCur.hidden = true; return; }
      var r = vp.getBoundingClientRect();
      var baseSize = penMode === 'highlighter' ? Math.max(16, penWidth * 3) : (penMode === 'eraser' ? Math.max(14, penWidth * 2.5) : Math.max(4, penWidth));
      var diam = clamp(Math.round(baseSize * zoom), 6, 140);
      bCur.hidden = false;
      bCur.style.width = diam + 'px';
      bCur.style.height = diam + 'px';
      bCur.style.left = Math.round(clientX - r.left) + 'px';
      bCur.style.top = Math.round(clientY - r.top) + 'px';
      bCur.style.borderColor = penMode === 'eraser' ? '#ef4444' : penColor;
      bCur.classList.toggle('is-eraser', penMode === 'eraser');
    }

    vp.addEventListener('pointerleave', function () {
      var bCur = vp.querySelector('[data-wb-brush-cursor]');
      if (bCur) bCur.hidden = true;
    });

    vp.addEventListener('pointerdown', function (e) {
      var effectiveTool = spacePressed ? 'hand' : activeTool;
      // Never intercept floating canvas controls; allow pen to draw over content cards/inputs
      if (e.target.closest('.wb-bottom-left, .wb-minimap')) return;
      if (effectiveTool !== 'pen') {
        if (e.target.closest('.wb-comment-thread, .wb-edge-editor, .wb-fc-plus, .wb-reaction-chip, textarea, input, select, a')) {
          return;
        }
        var activeEditable = e.target.closest('[contenteditable="true"]');
        if (activeEditable) return;
      }

      // Track active pointers for two-finger pinch-zoom & pan on touchscreens
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        // Cancel any single-finger drag/draw and start smooth pinch/two-finger pan
        cancelActiveInteraction();
        var pair = Array.from(activePointers.values());
        pinchState = {
          dist: Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) || 1,
          midX: (pair[0].x + pair[1].x) / 2,
          midY: (pair[0].y + pair[1].y) / 2,
          startZoom: zoom,
          startPanX: panX,
          startPanY: panY
        };
        vp.classList.add('is-panning');
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // Close dock popover when interacting directly with canvas (fade it while drawing with pen)
      var pb = rootEl.querySelector('[data-wb-popover-box]');
      if (dockPopover && activeTool !== 'pen') {
        dockPopover = null;
        if (pb) pb.hidden = true;
      }

      var wPt = clientToWorld(e.clientX, e.clientY);

      // 1. STRICT PAN ISOLATION: ONLY pan when Hand tool is active, Spacebar held, or middle mouse button
      if (effectiveTool === 'hand' || e.button === 1) {
        e.preventDefault();
        interaction = { mode: 'pan', pointerId: e.pointerId, startPanX: e.clientX - panX, startPanY: e.clientY - panY };
        vp.classList.add('is-panning');
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      if (e.button && e.button !== 0) return;

      // 2. Connector tool (Supports BOTH Drag-to-Connect AND Click-to-Connect -> NEVER PANS!)
      if (effectiveTool === 'connector') {
        if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
        e.preventDefault();
        // Complete an in-progress click-to-connect
        if (pendingConnector) {
          var endPt = resolveConnectorPoint(e.target, wPt, pendingConnector.fromId);
          pendingConnector.toId = endPt.objId;
          pendingConnector.toPort = endPt.port;
          pendingConnector.x2 = endPt.x;
          pendingConnector.y2 = endPt.y;
          var pDist = Math.hypot((pendingConnector.x2 || 0) - (pendingConnector.x1 || 0), (pendingConnector.y2 || 0) - (pendingConnector.y1 || 0));
          var finished = pendingConnector;
          pendingConnector = null;
          vp.classList.remove('is-connecting-drag');
          vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
          if (pDist >= 8 || (finished.fromId && finished.toId && finished.fromId !== finished.toId)) {
            pushHistory();
            state.links.push(finished);
            selectedIds = [];
            selectedLinkId = finished.id;
            logAct('Created connector');
            render();
            persist();
          } else {
            renderEdgesSvg();
          }
          return;
        }
        var startPt = resolveConnectorPoint(e.target, wPt, null);
        vp.classList.add('is-connecting-drag');
        interaction = {
          mode: 'draw-connector',
          pointerId: e.pointerId,
          startX: startPt.x, startY: startPt.y,
          previewLink: {
            id: uid('lk'),
            fromId: startPt.objId, fromPort: startPt.port,
            toId: null, toPort: null,
            x1: startPt.x, y1: startPt.y, x2: startPt.x, y2: startPt.y,
            routing: connectorDefaults.routing,
            startHead: connectorDefaults.startHead || 'none',
            endHead: connectorDefaults.endHead || 'arrow-filled',
            lineStyle: connectorDefaults.lineStyle || 'solid',
            color: connectorDefaults.color || '#4262ff',
            width: connectorDefaults.width || 2.2,
            label: ''
          }
        };
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        renderEdgesSvg();
        return;
      }

      // 3. Photoshop-style Pen / Brush / Pencil / Highlighter / Stroke Eraser
      if (effectiveTool === 'pen') {
        if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
        e.preventDefault();
        if (pb && !pb.hidden) pb.classList.add('is-drawing-fade');
        updateBrushCursor(e.clientX, e.clientY);
        if (penMode === 'eraser') {
          interaction = { mode: 'erase-pen', pointerId: e.pointerId, erased: false };
          eraseStrokeAt(wPt.x, wPt.y);
          try { vp.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
        var dSvg = rootEl.querySelector('[data-wb-drawings]');
        var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var sw = penMode === 'highlighter' ? Math.max(16, penWidth * 3) : Math.max(1, penWidth);
        var op = penMode === 'highlighter' ? clamp(penOpacity * 0.38, 0.1, 0.6) : (penMode === 'pencil' ? 1 : clamp(penOpacity, 0.1, 1));
        var isSoft = (penMode === 'brush' && penSoft);
        var blend = penMode === 'highlighter' ? 'multiply' : 'normal';
        var px0 = round1(wPt.x), py0 = round1(wPt.y);
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', penColor);
        pathEl.setAttribute('stroke-width', String(sw));
        pathEl.setAttribute('stroke-opacity', String(op));
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        if (isSoft) pathEl.setAttribute('filter', 'url(#wb-brush-soft)');
        if (blend === 'multiply') pathEl.style.mixBlendMode = 'multiply';
        pathEl.setAttribute('d', smoothPathD([[px0, py0]]));
        if (dSvg) dSvg.appendChild(pathEl);
        interaction = {
          mode: 'draw-pen',
          pointerId: e.pointerId,
          points: [[px0, py0]],
          pathEl: pathEl,
          stroke: penColor,
          strokeWidth: sw,
          opacity: op,
          soft: isSoft,
          blend: blend
        };
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // 4. Sticky Note Tool (Single Click drops sticky + immediately focuses text!)
      if (effectiveTool === 'sticky') {
        if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
        e.preventDefault();
        pushHistory();
        var st = makeObj({
          kind: 'sticky',
          x: Math.round(wPt.x - 100),
          y: Math.round(wPt.y - 100),
          w: 200, h: 200,
          bg: STICKY_COLORS[0],
          title: ''
        });
        state.objects.push(st);
        selectedIds = [st.id];
        selectedLinkId = null;
        setActiveTool('select');
        render();
        persist();
        focusInlineEdit(st.id, false);
        return;
      }

      // 5. Comment Pin Tool (Click canvas or element -> drop anchored numbered pin + open thread)
      if (effectiveTool === 'comment') {
        if (!currentCaps.canComment) { toast('Commenting disabled on this board'); return; }
        e.preventDefault();
        pushHistory();
        var anchorCard = e.target.closest('.wb-obj');
        var anchorObj = anchorCard ? getObj(anchorCard.dataset.objId) : null;
        var pin = makeObj({
          kind: 'comment',
          x: Math.round(wPt.x - 18),
          y: Math.round(wPt.y - 18),
          w: 36, h: 36,
          anchorId: (anchorObj && anchorObj.kind !== 'comment') ? anchorObj.id : null,
          anchorDx: (anchorObj && anchorObj.kind !== 'comment') ? Math.round(wPt.x - 18 - anchorObj.x) : 0,
          anchorDy: (anchorObj && anchorObj.kind !== 'comment') ? Math.round(wPt.y - 18 - anchorObj.y) : 0,
          resolved: false,
          comments: []
        });
        state.objects.push(pin);
        openCommentId = pin.id;
        selectedIds = [pin.id];
        setActiveTool('select');
        render();
        persist();
        setTimeout(function () {
          var inp = rootEl && rootEl.querySelector('.wb-pin-cmt-in');
          if (inp) inp.focus();
        }, 30);
        return;
      }

      // 6. Shape / Flowchart / Frame / Text Creation (Click OR Click & Drag!)
      if (effectiveTool === 'shape' || effectiveTool === 'flowchart' || effectiveTool === 'frame' || effectiveTool === 'text') {
        if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
        e.preventDefault();
        var draftEl = document.createElement('div');
        draftEl.className = 'wb-draft-box';
        draftEl.style.left = Math.round(wPt.x) + 'px';
        draftEl.style.top = Math.round(wPt.y) + 'px';
        draftEl.style.width = '0px';
        draftEl.style.height = '0px';
        world.appendChild(draftEl);
        interaction = {
          mode: 'draft-create',
          createTool: effectiveTool,
          pointerId: e.pointerId,
          startX: wPt.x,
          startY: wPt.y,
          curX: wPt.x,
          curY: wPt.y,
          draftEl: draftEl
        };
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // 7. SELECT TOOL: Connector endpoint handle, Magnetic Port drag, Resize handle, Rotation handle, Connector hit, Object drag, or Empty-Canvas Marquee!
      var lkEndHandle = e.target.closest('[data-wb-lk-end]');
      if (lkEndHandle && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        e.stopPropagation();
        var ep = lkEndHandle.dataset.wbLkEnd.split(':');
        var editLk = getLink(ep[0]);
        if (editLk) {
          pushHistory();
          vp.classList.add('is-connecting-drag');
          interaction = { mode: 'drag-link-end', pointerId: e.pointerId, link: editLk, end: ep[1] };
          try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        }
        return;
      }

      var selPortEl = e.target.closest('[data-wb-port]');
      if (selPortEl && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        e.stopPropagation();
        var spPt = resolveConnectorPoint(selPortEl, wPt, null);
        vp.classList.add('is-connecting-drag');
        interaction = {
          mode: 'draw-connector',
          pointerId: e.pointerId,
          startX: spPt.x, startY: spPt.y,
          previewLink: {
            id: uid('lk'),
            fromId: spPt.objId, fromPort: spPt.port,
            toId: null, toPort: null,
            x1: spPt.x, y1: spPt.y, x2: spPt.x, y2: spPt.y,
            routing: connectorDefaults.routing,
            startHead: connectorDefaults.startHead || 'none',
            endHead: connectorDefaults.endHead || 'arrow-filled',
            lineStyle: connectorDefaults.lineStyle || 'solid',
            color: connectorDefaults.color || '#4262ff',
            width: connectorDefaults.width || 2.2,
            label: ''
          }
        };
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        renderEdgesSvg();
        return;
      }

      var resizeHandle = e.target.closest('[data-wb-resize]');
      if (resizeHandle && selectedIds.length === 1 && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        e.stopPropagation();
        var rObj = getObj(selectedIds[0]);
        if (rObj) {
          pushHistory();
          interaction = {
            mode: 'resize',
            pointerId: e.pointerId,
            obj: rObj,
            dir: resizeHandle.dataset.wbResize,
            startX: wPt.x, startY: wPt.y,
            origX: rObj.x, origY: rObj.y,
            origW: rObj.w || 200, origH: rObj.h || 140
          };
          try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        }
        return;
      }

      var rotHandle = e.target.closest('[data-wb-rotate]');
      if (rotHandle && selectedIds.length === 1 && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        e.stopPropagation();
        var rotObj = getObj(selectedIds[0]);
        if (rotObj) {
          pushHistory();
          var rb = getObjBox(rotObj);
          interaction = {
            mode: 'rotate',
            pointerId: e.pointerId,
            obj: rotObj,
            cx: rb.x + rb.w / 2,
            cy: rb.y + rb.h / 2
          };
          try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        }
        return;
      }

      var linkHit = e.target.closest('[data-wb-link-hit]');
      if (linkHit) {
        e.stopPropagation();
        selectedIds = [];
        selectedLinkId = linkHit.dataset.wbLinkHit;
        openCommentId = null;
        renderEdgesSvg();
        renderCtxBar();
        return;
      }

      var card = e.target.closest('.wb-obj');
      if (card) {
        e.stopPropagation();
        var id = card.dataset.objId;
        var obj = getObj(id);
        if (!obj) return;

        if (obj.kind === 'comment') {
          openCommentId = (openCommentId === id) ? null : id;
          selectedIds = [id];
          selectedLinkId = null;
          render();
          return;
        }
        openCommentId = null;
        selectedLinkId = null;

        if (e.shiftKey) {
          if (isSelected(id)) selectedIds = selectedIds.filter(function (x) { return x !== id; });
          else selectedIds = selectedIds.concat([id]);
          syncSelectionDom();
          renderCtxBar();
          return;
        }
        if (!isSelected(id)) {
          selectedIds = [id];
          syncSelectionDom();
          renderCtxBar();
          renderDrawer();
        }

        var lyr = getLayer(obj.layer);
        if (!currentCaps.canEdit || reviewMode || (lyr && lyr.locked)) return;

        // Collect all moving objects (selected items + any children inside selected Frames!)
        var movingSet = new Set(selectedIds);
        selectedIds.forEach(function (sid) {
          var so = getObj(sid);
          if (so && (so.kind === 'section' || so.kind === 'swimlane') && !so.collapsed) {
            var fb = getObjBox(so);
            (state.objects || []).forEach(function (child) {
              if (child.id === so.id || child.kind === 'section') return;
              var cb = getObjBox(child);
              var ccx = cb.x + cb.w / 2, ccy = cb.y + cb.h / 2;
              if (ccx >= fb.x && ccx <= fb.x + fb.w && ccy >= fb.y && ccy <= fb.y + fb.h) {
                movingSet.add(child.id);
              }
            });
          }
        });
        // Also move comment pins anchored to any moving object
        (state.objects || []).forEach(function (c) {
          if (c.kind === 'comment' && c.anchorId && movingSet.has(c.anchorId)) movingSet.add(c.id);
        });

        var items = [];
        movingSet.forEach(function (mid) {
          var mo = getObj(mid);
          if (mo) items.push({ obj: mo, el: world.querySelector('[data-obj-id="' + mid + '"]'), startX: mo.x, startY: mo.y });
        });
        interaction = {
          mode: 'drag-objs',
          pointerId: e.pointerId,
          primary: obj,
          startWX: wPt.x,
          startWY: wPt.y,
          moved: false,
          items: items
        };
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // Empty canvas click in Select tool -> Clear selection + start Marquee box (NEVER PAN!)
      openCommentId = null;
      selectedLinkId = null;
      if (selectedIds.length) {
        selectedIds = [];
        if (openDrawer === 'inspector') openDrawer = null;
        render();
        // Refresh vp reference after render
        vp = getVpEl();
        world = getWorldEl();
      }
      var vpRect = vp.getBoundingClientRect();
      var mq = document.createElement('div');
      mq.className = 'wb-marquee';
      var mx0 = e.clientX - vpRect.left, my0 = e.clientY - vpRect.top;
      mq.style.left = Math.round(mx0) + 'px';
      mq.style.top = Math.round(my0) + 'px';
      mq.style.width = '0px';
      mq.style.height = '0px';
      vp.appendChild(mq);
      interaction = { mode: 'marquee', pointerId: e.pointerId, startX: mx0, startY: my0, mqEl: mq, moved: false };
      try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    });

    vp.addEventListener('pointermove', function (e) {
      updateBrushCursor(e.clientX, e.clientY);

      // Update multi-touch tracking
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pinchState && activePointers.size >= 2) {
        e.preventDefault();
        var pair = Array.from(activePointers.values());
        var newDist = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) || 1;
        var newMidX = (pair[0].x + pair[1].x) / 2;
        var newMidY = (pair[0].y + pair[1].y) / 2;
        var r = vp.getBoundingClientRect();
        var nextZoom = clamp(pinchState.startZoom * (newDist / pinchState.dist), 0.25, 2.5);
        var worldMidX = (pinchState.midX - r.left - pinchState.startPanX) / pinchState.startZoom;
        var worldMidY = (pinchState.midY - r.top - pinchState.startPanY) / pinchState.startZoom;
        zoom = Math.round(nextZoom * 100) / 100;
        panX = (newMidX - r.left) - worldMidX * zoom;
        panY = (newMidY - r.top) - worldMidY * zoom;
        applyWorldTransform();
        return;
      }

      // Live rubber-band preview for click-to-connect
      if (!interaction && pendingConnector) {
        var cPt = clientToWorld(e.clientX, e.clientY);
        var cSnap = findSnapPort(cPt.x, cPt.y, pendingConnector.fromId);
        vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
        if (cSnap) {
          pendingConnector.toId = cSnap.objId;
          pendingConnector.toPort = cSnap.port;
          pendingConnector.x2 = cSnap.x;
          pendingConnector.y2 = cSnap.y;
          var cpe = vp.querySelector('[data-wb-port="' + cSnap.objId + ':' + cSnap.port + '"]');
          if (cpe) cpe.classList.add('is-snapped');
        } else {
          pendingConnector.toId = null;
          pendingConnector.toPort = null;
          pendingConnector.x2 = Math.round(cPt.x);
          pendingConnector.y2 = Math.round(cPt.y);
        }
        renderEdgesSvg();
        return;
      }

      if (!interaction || interaction.pointerId !== e.pointerId) return;
      var wPt = clientToWorld(e.clientX, e.clientY);

      if (interaction.mode === 'pan') {
        panX = e.clientX - interaction.startPanX;
        panY = e.clientY - interaction.startPanY;
        applyWorldTransform();
        return;
      }

      if (interaction.mode === 'drag-link-end') {
        var dlk = interaction.link;
        var excludeId = interaction.end === 'start' ? dlk.toId : dlk.fromId;
        var dSnap = findSnapPort(wPt.x, wPt.y, excludeId);
        vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
        if (interaction.end === 'start') {
          if (dSnap) {
            dlk.fromId = dSnap.objId; dlk.fromPort = dSnap.port; dlk.x1 = dSnap.x; dlk.y1 = dSnap.y;
            var spe = vp.querySelector('[data-wb-port="' + dSnap.objId + ':' + dSnap.port + '"]');
            if (spe) spe.classList.add('is-snapped');
          } else {
            dlk.fromId = null; dlk.fromPort = null; dlk.x1 = Math.round(wPt.x); dlk.y1 = Math.round(wPt.y);
          }
        } else {
          if (dSnap) {
            dlk.toId = dSnap.objId; dlk.toPort = dSnap.port; dlk.x2 = dSnap.x; dlk.y2 = dSnap.y;
            var epe = vp.querySelector('[data-wb-port="' + dSnap.objId + ':' + dSnap.port + '"]');
            if (epe) epe.classList.add('is-snapped');
          } else {
            dlk.toId = null; dlk.toPort = null; dlk.x2 = Math.round(wPt.x); dlk.y2 = Math.round(wPt.y);
          }
        }
        renderEdgesSvg();
        positionCtxBar();
        return;
      }

      if (interaction.mode === 'draw-connector') {
        var lk = interaction.previewLink;
        var snap = findSnapPort(wPt.x, wPt.y, lk.fromId);
        // Clear previous snap highlight
        vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
        if (snap) {
          lk.toId = snap.objId;
          lk.toPort = snap.port;
          lk.x2 = snap.x;
          lk.y2 = snap.y;
          var pe = vp.querySelector('[data-wb-port="' + snap.objId + ':' + snap.port + '"]');
          if (pe) pe.classList.add('is-snapped');
        } else {
          lk.toId = null;
          lk.toPort = null;
          lk.x2 = Math.round(wPt.x);
          lk.y2 = Math.round(wPt.y);
        }
        renderEdgesSvg();
        return;
      }

      if (interaction.mode === 'draw-pen') {
        var wx = round1(wPt.x), wy = round1(wPt.y);
        if (e.shiftKey) {
          // Shift+Drag draws a crisp straight line, just like Photoshop!
          interaction.points = [interaction.points[0], [wx, wy]];
          if (interaction.pathEl) interaction.pathEl.setAttribute('d', smoothPathD(interaction.points));
          return;
        }
        var last = interaction.points[interaction.points.length - 1];
        if (Math.hypot(wx - last[0], wy - last[1]) >= 1.5) {
          interaction.points.push([wx, wy]);
          if (interaction.pathEl) interaction.pathEl.setAttribute('d', smoothPathD(interaction.points));
        }
        return;
      }

      if (interaction.mode === 'erase-pen') {
        eraseStrokeAt(wPt.x, wPt.y);
        return;
      }

      if (interaction.mode === 'draft-create') {
        interaction.curX = wPt.x;
        interaction.curY = wPt.y;
        var dx = wPt.x - interaction.startX, dy = wPt.y - interaction.startY;
        if (e.shiftKey) {
          var side = Math.max(Math.abs(dx), Math.abs(dy));
          dx = dx >= 0 ? side : -side;
          dy = dy >= 0 ? side : -side;
        }
        var x = dx >= 0 ? interaction.startX : interaction.startX + dx;
        var y = dy >= 0 ? interaction.startY : interaction.startY + dy;
        var w = Math.abs(dx), h = Math.abs(dy);
        interaction.box = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
        interaction.draftEl.style.left = Math.round(x) + 'px';
        interaction.draftEl.style.top = Math.round(y) + 'px';
        interaction.draftEl.style.width = Math.round(w) + 'px';
        interaction.draftEl.style.height = Math.round(h) + 'px';
        interaction.draftEl.textContent = (w > 40 && h > 24) ? (Math.round(w) + ' × ' + Math.round(h)) : '';
        return;
      }

      if (interaction.mode === 'resize') {
        var o = interaction.obj, dir = interaction.dir;
        var ddx = wPt.x - interaction.startX, ddy = wPt.y - interaction.startY;
        var nx = interaction.origX, ny = interaction.origY, nw = interaction.origW, nh = interaction.origH;
        if (dir.indexOf('e') !== -1) nw = Math.max(60, interaction.origW + ddx);
        if (dir.indexOf('s') !== -1) nh = Math.max(44, interaction.origH + ddy);
        if (dir.indexOf('w') !== -1) { nw = Math.max(60, interaction.origW - ddx); nx = interaction.origX + (interaction.origW - nw); }
        if (dir.indexOf('n') !== -1) { nh = Math.max(44, interaction.origH - ddy); ny = interaction.origY + (interaction.origH - nh); }
        if (e.shiftKey && dir.length === 2) {
          var sMax = Math.max(nw, nh);
          nw = sMax; nh = sMax;
        }
        o.x = Math.round(nx); o.y = Math.round(ny); o.w = Math.round(nw); o.h = Math.round(nh);
        var oEl = world.querySelector('[data-obj-id="' + o.id + '"]');
        if (oEl) {
          oEl.style.left = o.x + 'px'; oEl.style.top = o.y + 'px';
          oEl.style.width = o.w + 'px'; oEl.style.height = o.h + 'px';
          if (o.kind === 'shape' || o.kind === 'flowchart') {
            var oldSvg = oEl.querySelector('.wb-shape-svg');
            if (oldSvg) oldSvg.outerHTML = shapeSvgMarkup(o.shapeType || 'rect', o.w, o.h, o.bg, o.stroke, o.strokeWidth, o.strokeStyle);
          }
        }
        renderEdgesSvg();
        positionCtxBar();
        return;
      }

      if (interaction.mode === 'rotate') {
        var ang = Math.atan2(wPt.y - interaction.cy, wPt.x - interaction.cx) * (180 / Math.PI) + 90;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        interaction.obj.rotate = Math.round(ang);
        var rotDom = world.querySelector('[data-obj-id="' + interaction.obj.id + '"]');
        if (rotDom) rotDom.style.transform = 'rotate(' + interaction.obj.rotate + 'deg)';
        return;
      }

      if (interaction.mode === 'drag-objs') {
        var moveDx = wPt.x - interaction.startWX;
        var moveDy = wPt.y - interaction.startWY;
        if (!interaction.moved && Math.hypot(moveDx, moveDy) < 3) return;
        if (!interaction.moved) {
          pushHistory();
          interaction.moved = true;
        }
        var pItem = interaction.items.find(function (it) { return it.obj.id === interaction.primary.id; }) || interaction.items[0];
        var targetX = pItem.startX + moveDx;
        var targetY = pItem.startY + moveDy;
        if (snapGrid && !e.altKey) {
          targetX = Math.round(targetX / 20) * 20;
          targetY = Math.round(targetY / 20) * 20;
        }
        var gx = rootEl.querySelector('[data-wb-gx]');
        var gy = rootEl.querySelector('[data-wb-gy]');
        var snapX = null, snapY = null;
        if (showGuides) {
          (state.objects || []).forEach(function (other) {
            if (isSelected(other.id) || !isObjVisible(other)) return;
            if (Math.abs(other.x - targetX) < 10) snapX = other.x;
            if (Math.abs(other.y - targetY) < 10) snapY = other.y;
          });
        }
        if (snapX !== null) { targetX = snapX; if (gx) { gx.style.left = snapX + 'px'; gx.style.display = 'block'; } }
        else if (gx) gx.style.display = 'none';
        if (snapY !== null) { targetY = snapY; if (gy) { gy.style.top = snapY + 'px'; gy.style.display = 'block'; } }
        else if (gy) gy.style.display = 'none';

        var finalDx = Math.round(targetX - pItem.startX);
        var finalDy = Math.round(targetY - pItem.startY);
        interaction.items.forEach(function (it) {
          it.obj.x = Math.round(it.startX + finalDx);
          it.obj.y = Math.round(it.startY + finalDy);
          if (it.el) {
            it.el.style.left = it.obj.x + 'px';
            it.el.style.top = it.obj.y + 'px';
          }
        });
        renderEdgesSvg();
        positionCtxBar();
        return;
      }

      if (interaction.mode === 'marquee') {
        var r2 = vp.getBoundingClientRect();
        var cx = e.clientX - r2.left, cy = e.clientY - r2.top;
        var ml = Math.min(interaction.startX, cx), mt = Math.min(interaction.startY, cy);
        var mw = Math.abs(cx - interaction.startX), mh = Math.abs(cy - interaction.startY);
        if (mw > 4 || mh > 4) interaction.moved = true;
        interaction.mqEl.style.left = Math.round(ml) + 'px';
        interaction.mqEl.style.top = Math.round(mt) + 'px';
        interaction.mqEl.style.width = Math.round(mw) + 'px';
        interaction.mqEl.style.height = Math.round(mh) + 'px';
        interaction.screenBox = { left: r2.left + ml, top: r2.top + mt, right: r2.left + ml + mw, bottom: r2.top + mt + mh };
      }
    });

    function finishPointer(e) {
      activePointers.delete(e.pointerId);
      if (pinchState && activePointers.size < 2) {
        pinchState = null;
        vp.classList.remove('is-panning');
      }
      if (!interaction || interaction.pointerId !== e.pointerId) return;
      var act = interaction;
      interaction = null;
      try { vp.releasePointerCapture(e.pointerId); } catch (_) {}
      var pbFade = rootEl && rootEl.querySelector('[data-wb-popover-box]');
      if (pbFade) pbFade.classList.remove('is-drawing-fade');

      if (act.mode === 'pan') {
        vp.classList.remove('is-panning');
        return;
      }

      if (act.mode === 'drag-link-end') {
        vp.classList.remove('is-connecting-drag');
        vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
        render();
        persist();
        return;
      }

      if (act.mode === 'draw-connector') {
        var lk = act.previewLink;
        var dist = Math.hypot((lk.x2 || 0) - (lk.x1 || 0), (lk.y2 || 0) - (lk.y1 || 0));
        if (dist >= 12 || (lk.fromId && lk.toId && lk.fromId !== lk.toId)) {
          vp.classList.remove('is-connecting-drag');
          vp.querySelectorAll('.wb-port.is-snapped').forEach(function (p) { p.classList.remove('is-snapped'); });
          pushHistory();
          state.links.push(lk);
          selectedIds = [];
          selectedLinkId = lk.id;
          logAct('Created connector');
          render();
          persist();
        } else if (activeTool === 'connector') {
          // Click-to-connect mode: keep rubber-band active until second click
          pendingConnector = lk;
          renderEdgesSvg();
          toast('Click another node or point to finish connector (Esc to cancel)');
        } else {
          vp.classList.remove('is-connecting-drag');
          renderEdgesSvg();
        }
        return;
      }

      if (act.mode === 'draw-pen') {
        if (act.points.length >= 1) {
          pushHistory();
          var smart = (penSmartShape && act.points.length >= 6) ? recognizeSmartShape(act.points) : null;
          if (smart && smart.kind === 'shape') {
            var sObj = makeObj({ kind: 'shape', shapeType: smart.shapeType, x: smart.x, y: smart.y, w: smart.w, h: smart.h, bg: 'transparent', stroke: act.stroke, strokeWidth: act.strokeWidth, title: '' });
            state.objects.push(sObj);
            toast('Smart Shape recognized: ' + smart.shapeType);
          } else if (smart && smart.kind === 'line') {
            state.links.push({ id: uid('lk'), fromId: null, toId: null, x1: smart.x1, y1: smart.y1, x2: smart.x2, y2: smart.y2, routing: 'straight', startHead: 'none', endHead: 'none', lineStyle: 'solid', color: act.stroke, width: act.strokeWidth, label: '' });
            toast('Smart Line recognized');
          } else {
            if (!Array.isArray(state.paths)) state.paths = [];
            state.paths.push({
              id: uid('path'),
              d: smoothPathD(act.points),
              points: act.points,
              stroke: act.stroke,
              strokeWidth: act.strokeWidth,
              opacity: act.opacity,
              soft: Boolean(act.soft),
              blend: act.blend || 'normal'
            });
          }
          render();
          persist();
        } else if (act.pathEl) {
          act.pathEl.remove();
        }
        return;
      }

      if (act.mode === 'erase-pen') {
        if (act.erased) { render(); persist(); }
        return;
      }

      if (act.mode === 'draft-create') {
        if (act.draftEl) act.draftEl.remove();
        var box = act.box || { x: Math.round(act.startX), y: Math.round(act.startY), w: 0, h: 0 };
        var dragged = box.w > 16 || box.h > 16;
        pushHistory();
        var created = null;

        if (act.createTool === 'shape') {
          var sw2 = dragged ? Math.max(60, box.w) : (selectedShapeType === 'circle' || selectedShapeType === 'star' ? 130 : 170);
          var sh2 = dragged ? Math.max(50, box.h) : (selectedShapeType === 'circle' || selectedShapeType === 'star' ? 130 : 96);
          var sx2 = dragged ? box.x : Math.round(act.startX - sw2 / 2);
          var sy2 = dragged ? box.y : Math.round(act.startY - sh2 / 2);
          created = makeObj({ kind: 'shape', shapeType: selectedShapeType, x: sx2, y: sy2, w: sw2, h: sh2, bg: '#eef2ff', stroke: '#4262ff', strokeWidth: 2, title: '' });
        } else if (act.createTool === 'flowchart') {
          var fdef = FLOWCHART_DEFS.find(function (d) { return d.id === selectedFlowchartType; }) || FLOWCHART_DEFS[0];
          var fw = dragged ? Math.max(100, box.w) : fdef.w;
          var fh = dragged ? Math.max(60, box.h) : fdef.h;
          var fx = dragged ? box.x : Math.round(act.startX - fw / 2);
          var fy = dragged ? box.y : Math.round(act.startY - fh / 2);
          created = makeObj({ kind: 'flowchart', shapeType: fdef.id, x: fx, y: fy, w: fw, h: fh, bg: fdef.fill, stroke: fdef.stroke, strokeWidth: 2, title: fdef.title, layer: 'operations' });
        } else if (act.createTool === 'frame') {
          var preset = FRAME_PRESETS.find(function (p) { return p.id === selectedFramePreset; });
          var frW = dragged ? Math.max(220, box.w) : (preset && preset.w ? preset.w : 640);
          var frH = dragged ? Math.max(160, box.h) : (preset && preset.h ? preset.h : 400);
          var frX = dragged ? box.x : Math.round(act.startX - frW / 2);
          var frY = dragged ? box.y : Math.round(act.startY - frH / 2);
          var count = (state.objects || []).filter(function (x) { return x.kind === 'section'; }).length + 1;
          created = makeObj({ kind: 'section', x: frX, y: frY, w: frW, h: frH, title: 'Frame ' + count, bg: 'rgba(255,255,255,0.72)' });
        } else if (act.createTool === 'text') {
          var tw = dragged ? Math.max(120, box.w) : 220;
          var tx = dragged ? box.x : Math.round(act.startX);
          var ty = dragged ? box.y : Math.round(act.startY - 14);
          created = makeObj({ kind: 'text', x: tx, y: ty, w: tw, h: 42, fontSize: 18, bold: false, title: '' });
        }

        if (created) {
          state.objects.push(created);
          selectedIds = [created.id];
          selectedLinkId = null;
          setActiveTool('select');
          render();
          persist();
          if (created.kind === 'text') focusInlineEdit(created.id, false);
        }
        return;
      }

      if (act.mode === 'resize' || act.mode === 'rotate') {
        render();
        persist();
        return;
      }

      if (act.mode === 'drag-objs') {
        var gx = rootEl.querySelector('[data-wb-gx]');
        var gy = rootEl.querySelector('[data-wb-gy]');
        if (gx) gx.style.display = 'none';
        if (gy) gy.style.display = 'none';
        if (act.moved) { render(); persist(); }
        return;
      }

      if (act.mode === 'marquee') {
        if (act.mqEl) act.mqEl.remove();
        if (act.moved && act.screenBox) {
          var sb = act.screenBox;
          var hits = [];
          world.querySelectorAll('.wb-obj').forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (!(r.right < sb.left || r.left > sb.right || r.bottom < sb.top || r.top > sb.bottom)) {
              hits.push(el.dataset.objId);
            }
          });
          selectedIds = hits;
          syncSelectionDom();
          renderCtxBar();
        }
      }
    }

    function cancelActiveInteraction() {
      if (!interaction) return;
      if (interaction.draftEl) interaction.draftEl.remove();
      if (interaction.mqEl) interaction.mqEl.remove();
      if (interaction.pathEl) interaction.pathEl.remove();
      vp.classList.remove('is-panning', 'is-connecting-drag');
      interaction = null;
    }

    function eraseStrokeAt(wx, wy) {
      if (!state || !Array.isArray(state.paths)) return;
      var before = state.paths.length;
      var eraserRadius = Math.max(12, penWidth * 1.4) / zoom;
      state.paths = state.paths.filter(function (p) {
        if (!Array.isArray(p.points) || !p.points.length) return true;
        var hitR = eraserRadius + (Number(p.strokeWidth) || 4) / 2;
        if (p.points.length === 1) {
          return Math.hypot(p.points[0][0] - wx, p.points[0][1] - wy) > hitR;
        }
        for (var i = 0; i < p.points.length - 1; i++) {
          if (pointToSegmentDist(wx, wy, p.points[i][0], p.points[i][1], p.points[i + 1][0], p.points[i + 1][1]) <= hitR) {
            return false;
          }
        }
        return true;
      });
      if (state.paths.length !== before) {
        if (interaction && !interaction.erased) { pushHistory(); interaction.erased = true; }
        renderDrawingsSvg();
      }
    }

    vp.addEventListener('pointerup', finishPointer);
    vp.addEventListener('pointercancel', finishPointer);

    // Drag-and-drop images / SVGs / PDFs directly onto the whiteboard canvas
    vp.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).indexOf('Files') !== -1) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    vp.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault();
      var dropPt = clientToWorld(e.clientX, e.clientY);
      handleUploadedFiles(files, dropPt);
    });

    // Double-click: edit shape/sticky/frame/text inline OR edit connector label!
    vp.addEventListener('dblclick', function (e) {
      var linkHit = e.target.closest('[data-wb-link-hit]');
      if (linkHit) {
        e.stopPropagation();
        openConnectorLabelEditor(linkHit.dataset.wbLinkHit);
        return;
      }
      var card = e.target.closest('.wb-obj');
      if (card && currentCaps.canEdit && !reviewMode) {
        var id = card.dataset.objId;
        var o = getObj(id);
        if (o && o.kind !== 'comment' && o.kind !== 'image' && o.kind !== 'sticker') {
          e.stopPropagation();
          focusInlineEdit(id, true);
        }
      }
    });

    // Wheel: two-finger trackpad scroll pans; Ctrl/Meta+wheel zooms around pointer
    vp.addEventListener('wheel', function (e) {
      if (e.target.closest('.wb-code-area, .wb-comment-thread')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(zoom + (e.deltaY < 0 ? 0.1 : -0.1), e.clientX, e.clientY);
      } else {
        panX -= e.deltaX;
        panY -= e.deltaY;
        applyWorldTransform();
      }
    }, { passive: false });

    // Minimap click-to-pan
    var mm = stage.querySelector('[data-wb-minimap]');
    if (mm) {
      mm.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        var r = mm.getBoundingClientRect();
        var wx = (e.clientX - r.left - 10) / 0.08;
        var wy = (e.clientY - r.top - 10) / 0.08;
        panX = vp.clientWidth / 2 - wx * zoom;
        panY = vp.clientHeight / 2 - wy * zoom;
        applyWorldTransform();
      });
    }
  }

  /* ---------- Flowchart Quick-Connect (+) Spawner ---------- */
  function spawnFlowchartBranch(fromId, dir) {
    if (!currentCaps.canEdit || reviewMode) return;
    var src = getObj(fromId);
    if (!src) return;
    pushHistory();
    var sb = getObjBox(src);
    var gap = 90;
    var nw = 180, nh = 86;
    var nx = sb.x, ny = sb.y, fp = 'e', tp = 'w';
    if (dir === 'right')  { nx = sb.x + sb.w + gap; ny = sb.y + (sb.h - nh) / 2; fp = 'e'; tp = 'w'; }
    if (dir === 'left')   { nx = sb.x - nw - gap;   ny = sb.y + (sb.h - nh) / 2; fp = 'w'; tp = 'e'; }
    if (dir === 'bottom') { nx = sb.x + (sb.w - nw) / 2; ny = sb.y + sb.h + gap; fp = 's'; tp = 'n'; }
    if (dir === 'top')    { nx = sb.x + (sb.w - nw) / 2; ny = sb.y - nh - gap;   fp = 'n'; tp = 's'; }

    var nextNode = makeObj({
      kind: 'flowchart',
      shapeType: src.shapeType === 'diamond' ? 'rect' : 'diamond',
      x: Math.round(nx), y: Math.round(ny), w: nw, h: nh,
      bg: src.shapeType === 'diamond' ? '#eef2ff' : '#fffbeb',
      stroke: src.shapeType === 'diamond' ? '#4262ff' : '#d97706',
      strokeWidth: 2,
      title: src.shapeType === 'diamond' ? 'Next Step' : 'Decision?',
      layer: 'operations'
    });
    state.objects.push(nextNode);
    state.links.push({
      id: uid('lk'),
      fromId: src.id, fromPort: fp,
      toId: nextNode.id, toPort: tp,
      routing: 'elbow', endHead: 'arrow-filled', lineStyle: 'solid', color: '#4262ff', width: 2.2,
      label: src.shapeType === 'diamond' ? (dir === 'right' ? 'Yes' : (dir === 'bottom' ? 'No' : '')) : ''
    });
    selectedIds = [nextNode.id];
    render();
    persist();
    focusInlineEdit(nextNode.id, true);
  }

  /* ---------- Popovers (Shapes, Frame Presets, Pen, Flowchart, Insert Assets) ---------- */
  function showDockPopover(kind, forceOpen) {
    var box = rootEl && rootEl.querySelector('[data-wb-popover-box]');
    if (!box) return;
    if (!forceOpen && dockPopover === kind) { dockPopover = null; box.hidden = true; return; }
    dockPopover = kind;
    box.hidden = false;

    if (kind === 'shapes') {
      box.innerHTML =
        '<div class="wb-popover__head"><span>Shapes (Click or Drag)</span></div>' +
        '<div class="wb-popover__grid">' +
          SHAPE_DEFS.map(function (sh) {
            return '<button type="button" class="wb-popover__tile' + (selectedShapeType === sh.id ? ' is-selected' : '') + '" data-wb-pick-shape="' + sh.id + '">' +
              '<div style="width:28px;height:20px;position:relative;">' + shapeSvgMarkup(sh.id, 28, 20, '#eef2ff', '#4262ff', 1.8, 'solid') + '</div>' +
              '<span>' + sh.label + '</span>' +
            '</button>';
          }).join('') +
        '</div>';
    } else if (kind === 'frame') {
      box.innerHTML =
        '<div class="wb-popover__head"><span>Frame / Section Presets</span></div>' +
        FRAME_PRESETS.map(function (p) {
          return '<button type="button" class="wb-popover__item' + (selectedFramePreset === p.id ? ' is-selected' : '') + '" data-wb-pick-frame="' + p.id + '">' + esc(p.label) + '</button>';
        }).join('');
    } else if (kind === 'connector') {
      var curHeadKey = (connectorDefaults.startHead || 'none') + ':' + (connectorDefaults.endHead || 'arrow-filled');
      var headPresets = [
        { key: 'none:arrow-filled',         label: 'Arrow →' },
        { key: 'arrow-filled:arrow-filled', label: 'Bi-dir ↔' },
        { key: 'none:arrow',                label: 'Open ⟶' },
        { key: 'none:none',                 label: 'Line —' },
        { key: 'diamond:arrow-filled',      label: 'Diamond ◆→' },
        { key: 'circle:arrow-filled',       label: 'Dot ●→' }
      ];
      box.innerHTML =
        '<div class="wb-popover__head"><span>Connectors &amp; Lines</span></div>' +
        '<div style="display:flex;gap:4px;padding:0 4px 6px;">' +
          '<button type="button" class="wb-btn' + ((connectorDefaults.routing || 'elbow') === 'elbow' ? ' wb-btn--primary' : '') + '" data-wb-conn-route="elbow" style="flex:1;height:28px;font-size:11px;">Elbow</button>' +
          '<button type="button" class="wb-btn' + (connectorDefaults.routing === 'curved' ? ' wb-btn--primary' : '') + '" data-wb-conn-route="curved" style="flex:1;height:28px;font-size:11px;">Curved</button>' +
          '<button type="button" class="wb-btn' + (connectorDefaults.routing === 'straight' ? ' wb-btn--primary' : '') + '" data-wb-conn-route="straight" style="flex:1;height:28px;font-size:11px;">Straight</button>' +
        '</div>' +
        '<div class="wb-popover__grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:6px;">' +
          headPresets.map(function (hp) {
            return '<button type="button" class="wb-popover__tile' + (curHeadKey === hp.key ? ' is-selected' : '') + '" data-wb-conn-heads="' + hp.key + '" style="padding:6px 4px;font-size:11px;">' + hp.label + '</button>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:4px;padding:0 4px 6px;">' +
          '<button type="button" class="wb-btn' + ((connectorDefaults.lineStyle || 'solid') === 'solid' ? ' wb-btn--primary' : '') + '" data-wb-conn-style="solid" style="flex:1;height:26px;font-size:11px;">Solid</button>' +
          '<button type="button" class="wb-btn' + (connectorDefaults.lineStyle === 'dashed' ? ' wb-btn--primary' : '') + '" data-wb-conn-style="dashed" style="flex:1;height:26px;font-size:11px;">Dashed</button>' +
          '<button type="button" class="wb-btn' + (connectorDefaults.lineStyle === 'dotted' ? ' wb-btn--primary' : '') + '" data-wb-conn-style="dotted" style="flex:1;height:26px;font-size:11px;">Dotted</button>' +
        '</div>' +
        '<div class="wb-popover__swatches">' +
          STROKE_COLORS.slice(0, 6).map(function (c) {
            return '<button type="button" class="wb-swatch-btn' + (connectorDefaults.color === c ? ' is-selected' : '') + '" data-wb-conn-color="' + c + '" style="background:' + c + ';"></button>';
          }).join('') +
        '</div>' +
        '<div style="padding:2px 4px 4px;display:flex;gap:4px;">' +
          [1.5, 2.2, 4].map(function (w) {
            return '<button type="button" class="wb-btn' + (Number(connectorDefaults.width) === w ? ' wb-btn--primary' : '') + '" data-wb-conn-width="' + w + '" style="flex:1;height:26px;font-size:11px;">' + (w === 1.5 ? 'Thin' : w === 2.2 ? 'Med' : 'Thick') + '</button>';
          }).join('') +
        '</div>' +
        '<div style="padding:4px 6px 2px;font-size:11px;color:#64748b;line-height:1.35;">Drag between nodes/canvas, or click start &amp; end points.</div>';
    } else if (kind === 'pen') {
      box.innerHTML =
        '<div class="wb-popover__head"><span>Freehand Brush Studio</span><span style="font-size:10px;opacity:0.75;">[ / ] size</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:0 2px 6px;">' +
          '<button type="button" class="wb-btn' + ((penMode === 'brush' || penMode === 'pen') ? ' wb-btn--primary' : '') + '" data-wb-pen-mode="brush" style="height:28px;padding:0 4px;font-size:11px;">Brush</button>' +
          '<button type="button" class="wb-btn' + (penMode === 'pencil' ? ' wb-btn--primary' : '') + '" data-wb-pen-mode="pencil" style="height:28px;padding:0 4px;font-size:11px;">Pencil</button>' +
          '<button type="button" class="wb-btn' + (penMode === 'highlighter' ? ' wb-btn--primary' : '') + '" data-wb-pen-mode="highlighter" style="height:28px;padding:0 4px;font-size:11px;">Marker</button>' +
          '<button type="button" class="wb-btn' + (penMode === 'eraser' ? ' wb-btn--primary' : '') + '" data-wb-pen-mode="eraser" style="height:28px;padding:0 4px;font-size:11px;">Eraser</button>' +
        '</div>' +
        '<div class="wb-popover__swatches" style="align-items:center;">' +
          PEN_COLORS.map(function (c) {
            return '<button type="button" class="wb-swatch-btn' + (penColor === c ? ' is-selected' : '') + '" data-wb-pen-color="' + c + '" style="background:' + c + ';"></button>';
          }).join('') +
          '<label title="Custom brush color" style="display:inline-flex;align-items:center;cursor:pointer;">' +
            '<input type="color" data-wb-pen-custom-color value="' + esc(penColor) + '" style="width:24px;height:24px;padding:0;border:1.5px solid #cbd5e1;border-radius:50%;cursor:pointer;background:transparent;" />' +
          '</label>' +
        '</div>' +
        '<div style="padding:4px 6px;display:flex;flex-direction:column;gap:6px;">' +
          '<label style="display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:#475569;">' +
            '<span style="display:flex;justify-content:space-between;"><span>Size</span><span data-wb-pen-size-val>' + Math.round(penWidth) + ' px</span></span>' +
            '<input type="range" min="1" max="60" step="1" value="' + Math.round(penWidth) + '" data-wb-pen-size-range style="width:100%;accent-color:#4262ff;" />' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:#475569;">' +
            '<span style="display:flex;justify-content:space-between;"><span>Opacity</span><span data-wb-pen-op-val>' + Math.round(penOpacity * 100) + '%</span></span>' +
            '<input type="range" min="10" max="100" step="5" value="' + Math.round(penOpacity * 100) + '" data-wb-pen-op-range style="width:100%;accent-color:#4262ff;" />' +
          '</label>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:7px;padding:5px 6px 2px;font-size:12px;font-weight:600;cursor:pointer;border-top:1px solid #f1f5f9;">' +
          '<input type="checkbox" data-wb-pen-soft' + (penSoft ? ' checked' : '') + ' /> Soft / Feathered Brush' +
        '</label>' +
        '<label style="display:flex;align-items:center;gap:7px;padding:4px 6px 4px;font-size:12px;font-weight:600;cursor:pointer;">' +
          '<input type="checkbox" data-wb-smart-shape' + (penSmartShape ? ' checked' : '') + ' /> Smart Shape Recognition' +
        '</label>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 2px;border-top:1px solid #f1f5f9;">' +
          '<span style="font-size:10.5px;color:#64748b;">Hold Shift for straight line</span>' +
          '<button type="button" class="wb-btn wb-btn--danger" data-wb-clear-drawings style="height:24px;padding:0 8px;font-size:11px;">Clear Ink</button>' +
        '</div>';
    } else if (kind === 'flowchart') {
      box.innerHTML =
        '<div class="wb-popover__head"><span>Flowchart Nodes (Click or Drag)</span></div>' +
        FLOWCHART_DEFS.map(function (f) {
          return '<button type="button" class="wb-popover__item' + (selectedFlowchartType === f.id ? ' is-selected' : '') + '" data-wb-pick-fc="' + f.id + '">' +
            '<span style="width:22px;height:16px;position:relative;display:inline-block;flex-shrink:0;">' + shapeSvgMarkup(f.id, 22, 16, f.fill, f.stroke, 1.8, 'solid') + '</span>' +
            '<span>' + esc(f.label) + '</span>' +
          '</button>';
        }).join('') +
        '<div class="wb-dock__sep"></div>' +
        '<button type="button" class="wb-popover__item" data-wb-add="swimlane">Swimlane Container</button>' +
        '<button type="button" class="wb-popover__item" data-wb-validate-flow>✓ Validate Workflow Logic</button>';
    } else if (kind === 'insert') {
      box.innerHTML =
        '<div class="wb-popover__head"><span>Insert Rich Assets</span></div>' +
        '<button type="button" class="wb-popover__item" data-wb-insert="upload">🖼 Upload Image / SVG / PDF</button>' +
        '<button type="button" class="wb-popover__item" data-wb-insert="image-url">🌐 Insert Image from URL</button>' +
        '<button type="button" class="wb-popover__item" data-wb-insert="code">💻 Code / Mermaid Diagram</button>' +
        '<button type="button" class="wb-popover__item" data-wb-insert="table">📊 Table / Grid</button>' +
        '<button type="button" class="wb-popover__item" data-wb-insert="embed">🔗 Embed Link / Card</button>' +
        '<div class="wb-popover__head" style="padding-top:6px;"><span>Smart Cards</span></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:0 4px 4px;">' +
          '<button type="button" class="wb-btn" data-wb-add="task" style="height:28px;font-size:11.5px;">✓ Task Card</button>' +
          '<button type="button" class="wb-btn" data-wb-add="kpi" style="height:28px;font-size:11.5px;">📈 KPI Card</button>' +
          '<button type="button" class="wb-btn" data-wb-add="decision" style="height:28px;font-size:11.5px;">⚖ Decision</button>' +
          '<button type="button" class="wb-btn" data-wb-add="doc" style="height:28px;font-size:11.5px;">📄 Doc Brief</button>' +
        '</div>' +
        '<div class="wb-popover__head" style="padding-top:6px;"><span>Stickers &amp; Icons</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:0 4px 6px;">' +
          STICKERS.map(function (st) {
            return '<button type="button" class="wb-btn" data-wb-insert-sticker="' + st + '" style="width:34px;height:34px;padding:0;font-size:17px;">' + st + '</button>';
          }).join('') +
        '</div>' +
        '<div class="wb-dock__sep"></div>' +
        '<button type="button" class="wb-popover__item" data-wb-add-workspace>+ Add Workspace / Module</button>';
    }
  }

  /* ---------- Templates & Blueprints Insertion (Appends at Viewport Center Without Overwriting) ---------- */
  function insertTemplateBlueprint(tplId) {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    pushHistory();
    var c = viewportCenterWorld();
    var ox = Math.round(c.x - 300), oy = Math.round(c.y - 190);
    var addedObjs = [], addedLinks = [];

    function addO(ov) { var o = makeObj(ov); addedObjs.push(o); return o; }
    function addL(a, b, lbl, routing, col) {
      addedLinks.push({ id: uid('lk'), fromId: a.id, toId: b.id, routing: routing || 'elbow', endHead: 'arrow-filled', lineStyle: 'solid', color: col || '#4262ff', width: 2.2, label: lbl || '' });
    }

    if (tplId === 'mindmap') {
      var root = addO({ kind: 'shape', shapeType: 'pill', x: ox + 220, y: oy + 140, w: 170, h: 66, bg: '#4262ff', stroke: '#304ffe', textColor: '#ffffff', title: 'Central Topic' });
      var b1 = addO({ kind: 'sticky', x: ox,       y: oy,       w: 165, h: 110, bg: '#fef9c3', title: 'Branch 1: Goals' });
      var b2 = addO({ kind: 'sticky', x: ox,       y: oy + 230, w: 165, h: 110, bg: '#dcfce7', title: 'Branch 2: Users' });
      var b3 = addO({ kind: 'sticky', x: ox + 450, y: oy,       w: 165, h: 110, bg: '#dbeafe', title: 'Branch 3: Tech' });
      var b4 = addO({ kind: 'sticky', x: ox + 450, y: oy + 230, w: 165, h: 110, bg: '#fce7f3', title: 'Branch 4: Risks' });
      addL(root, b1, '', 'curved'); addL(root, b2, '', 'curved'); addL(root, b3, '', 'curved'); addL(root, b4, '', 'curved');
    } else if (tplId === 'flowchart') {
      var s = addO({ kind: 'flowchart', shapeType: 'terminator', x: ox,       y: oy + 110, w: 140, h: 62, bg: '#dcfce7', stroke: '#059669', title: 'Start' });
      var p = addO({ kind: 'flowchart', shapeType: 'rect',       x: ox + 190, y: oy + 100, w: 160, h: 80, bg: '#eef2ff', stroke: '#4262ff', title: 'Evaluate Input' });
      var d = addO({ kind: 'flowchart', shapeType: 'diamond',    x: ox + 400, y: oy + 90,  w: 150, h: 100, bg: '#fffbeb', stroke: '#d97706', title: 'Approved?' });
      var y = addO({ kind: 'flowchart', shapeType: 'terminator', x: ox + 600, y: oy + 40,  w: 140, h: 62, bg: '#dcfce7', stroke: '#059669', title: 'Ship Live' });
      var n = addO({ kind: 'flowchart', shapeType: 'rect',       x: ox + 600, y: oy + 170, w: 140, h: 72, bg: '#fee2e2', stroke: '#dc2626', title: 'Revise Draft' });
      addL(s, p); addL(p, d); addL(d, y, 'Yes', 'elbow', '#059669'); addL(d, n, 'No', 'elbow', '#dc2626');
    } else if (tplId === 'kanban') {
      addO({ kind: 'section', x: ox,       y: oy, w: 230, h: 340, title: 'To Do',       bg: 'rgba(248,250,252,0.85)' });
      addO({ kind: 'section', x: ox + 250, y: oy, w: 230, h: 340, title: 'In Progress', bg: 'rgba(239,246,255,0.85)' });
      addO({ kind: 'section', x: ox + 500, y: oy, w: 230, h: 340, title: 'Done',        bg: 'rgba(236,253,245,0.85)' });
      addO({ kind: 'sticky', x: ox + 18,  y: oy + 24,  w: 194, h: 120, bg: '#fef9c3', title: 'Define requirements' });
      addO({ kind: 'sticky', x: ox + 268, y: oy + 24,  w: 194, h: 120, bg: '#dbeafe', title: 'Build core canvas' });
      addO({ kind: 'sticky', x: ox + 518, y: oy + 24,  w: 194, h: 120, bg: '#dcfce7', title: 'Kickoff alignment' });
    } else if (tplId === 'journey') {
      var stages = ['1. Discover', '2. Evaluate', '3. Onboard', '4. Retain'];
      var cols = ['#fef9c3', '#dbeafe', '#f3e8ff', '#dcfce7'];
      var prev = null;
      stages.forEach(function (st, i) {
        var hd = addO({ kind: 'shape', shapeType: 'round', x: ox + i * 200, y: oy, w: 170, h: 56, bg: '#eef2ff', stroke: '#4262ff', title: st });
        addO({ kind: 'sticky', x: ox + i * 200, y: oy + 84, w: 170, h: 140, bg: cols[i], title: 'Touchpoint & user emotion…' });
        if (prev) addL(prev, hd);
        prev = hd;
      });
    } else if (tplId === 'swot') {
      var quads = [
        { t: 'Strengths',     x: 0,   y: 0,   bg: 'rgba(220,252,231,0.7)', sb: '#dcfce7' },
        { t: 'Weaknesses',    x: 310, y: 0,   bg: 'rgba(255,237,213,0.7)', sb: '#ffedd5' },
        { t: 'Opportunities', x: 0,   y: 240, bg: 'rgba(219,234,254,0.7)', sb: '#dbeafe' },
        { t: 'Threats',       x: 310, y: 240, bg: 'rgba(252,231,243,0.7)', sb: '#fce7f3' }
      ];
      quads.forEach(function (q) {
        addO({ kind: 'section', x: ox + q.x, y: oy + q.y, w: 290, h: 210, title: q.t, bg: q.bg });
        addO({ kind: 'sticky', x: ox + q.x + 24, y: oy + q.y + 24, w: 170, h: 120, bg: q.sb, title: q.t + ' point…' });
      });
    } else if (tplId === 'retro') {
      var rCols = [
        { t: 'Went Well',    x: 0,   bg: '#dcfce7' },
        { t: 'To Improve',   x: 240, bg: '#ffedd5' },
        { t: 'Action Items', x: 480, bg: '#dbeafe' }
      ];
      rCols.forEach(function (rc) {
        addO({ kind: 'section', x: ox + rc.x, y: oy, w: 220, h: 310, title: rc.t, bg: 'rgba(255,255,255,0.78)' });
        addO({ kind: 'sticky', x: ox + rc.x + 18, y: oy + 24, w: 184, h: 120, bg: rc.bg, title: 'Add team note…' });
      });
    } else if (tplId === 'wireframe') {
      addO({ kind: 'section', x: ox, y: oy, w: 680, h: 420, title: 'Desktop App Wireframe', bg: '#ffffff' });
      addO({ kind: 'shape', shapeType: 'rect', x: ox + 20, y: oy + 20, w: 640, h: 48, bg: '#f1f5f9', stroke: '#94a3b8', title: 'Top Navigation Bar' });
      addO({ kind: 'shape', shapeType: 'round', x: ox + 20, y: oy + 86, w: 640, h: 130, bg: '#eef2ff', stroke: '#4262ff', title: 'Hero Value Proposition + Primary CTA' });
      addO({ kind: 'shape', shapeType: 'round', x: ox + 20,  y: oy + 236, w: 200, h: 150, bg: '#f8fafc', stroke: '#cbd5e1', title: 'Feature Card 1' });
      addO({ kind: 'shape', shapeType: 'round', x: ox + 240, y: oy + 236, w: 200, h: 150, bg: '#f8fafc', stroke: '#cbd5e1', title: 'Feature Card 2' });
      addO({ kind: 'shape', shapeType: 'round', x: ox + 460, y: oy + 236, w: 200, h: 150, bg: '#f8fafc', stroke: '#cbd5e1', title: 'Feature Card 3' });
    } else if (tplId === 'architecture') {
      var cli = addO({ kind: 'shape', shapeType: 'round',    x: ox,       y: oy + 110, w: 150, h: 78,  bg: '#e0f2fe', stroke: '#0284c7', title: 'Web / Mobile App' });
      var api = addO({ kind: 'shape', shapeType: 'rect',     x: ox + 210, y: oy + 110, w: 150, h: 78,  bg: '#eef2ff', stroke: '#4262ff', title: 'API Gateway' });
      var svc = addO({ kind: 'shape', shapeType: 'rect',     x: ox + 420, y: oy + 40,  w: 150, h: 78,  bg: '#f3e8ff', stroke: '#7c3aed', title: 'Core Service' });
      var db  = addO({ kind: 'shape', shapeType: 'cylinder', x: ox + 420, y: oy + 180, w: 150, h: 96,  bg: '#dcfce7', stroke: '#059669', title: 'Primary DB' });
      addL(cli, api, 'HTTPS'); addL(api, svc, 'RPC'); addL(api, db, 'Query');
    }

    addedObjs.forEach(function (o) { state.objects.push(o); });
    addedLinks.forEach(function (l) { state.links.push(l); });
    selectedIds = addedObjs.map(function (o) { return o.id; });
    selectedLinkId = null;
    setActiveTool('select');
    rootEl.querySelector('[data-wb-modal]').hidden = true;
    logAct('Inserted template: ' + tplId);
    render();
    persist();
    toast('Inserted template — drag to reposition!');
  }

  function openTemplatesModal() {
    openModal('📐 Templates & Diagram Blueprints',
      '<div class="wb-tpl-grid">' +
        TEMPLATE_BLUEPRINTS.map(function (t) {
          return '<button type="button" class="wb-tpl-card" data-wb-insert-tpl="' + t.id + '">' +
            '<span class="wb-tpl-card__badge">' + esc(t.cat) + '</span>' +
            '<strong>' + esc(t.name) + '</strong>' +
            '<small>' + esc(t.desc) + '</small>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div style="border-top:1px solid #e2e8f0;padding-top:12px;">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Quick Smart Cards</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
          '<button type="button" class="wb-btn" data-wb-add="task">+ Task Card</button>' +
          '<button type="button" class="wb-btn" data-wb-add="kpi">+ KPI Card</button>' +
          '<button type="button" class="wb-btn" data-wb-add="decision">+ Decision Card</button>' +
          '<button type="button" class="wb-btn" data-wb-add="doc">+ Document Card</button>' +
        '</div>' +
      '</div>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Close</button>'
    );
  }

  function openClearConfirmModal() {
    openModal('🗑 Clear Canvas?',
      '<p style="margin:0;font-size:13.5px;color:#334155;">Remove all objects, connectors, and freehand drawings from this whiteboard? You can undo immediately with <strong>Ctrl+Z</strong>.</p>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Cancel</button>' +
      '<button type="button" class="wb-btn wb-btn--danger" data-wb-confirm-clear>Clear Entire Canvas</button>'
    );
  }

  /* ---------- Synchronized Views (Table, Kanban, Timeline, Dashboard) ---------- */
  function contentObjects() {
    return (state.objects || []).filter(function (o) { return o.kind !== 'section' && o.kind !== 'swimlane' && o.kind !== 'comment' && isObjVisible(o); });
  }

  function renderTable(stage) {
    var rows = contentObjects();
    stage.innerHTML = '<div class="wb-alt-view"><div class="wb-table-wrap"><table class="wb-table">' +
      '<thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Department</th><th>Assignee</th><th>Due Date</th><th>Layer</th></tr></thead>' +
      '<tbody>' + rows.map(function (o) {
        return '<tr data-wb-pick="' + esc(o.id) + '" style="cursor:pointer;">' +
          '<td><strong>' + esc(o.title || '(Untitled)') + '</strong></td>' +
          '<td><span class="wb-chip">' + esc(o.kind) + '</span></td>' +
          '<td><span class="wb-chip wb-status--' + (STATUS_SLUGS[o.status] || 'idea') + '">' + esc(o.status) + '</span></td>' +
          '<td>' + esc(o.priority) + '</td>' +
          '<td>' + esc(o.department) + '</td>' +
          '<td>' + esc(o.assignee || '—') + '</td>' +
          '<td>' + esc(o.dueDate || '—') + '</td>' +
          '<td>' + esc(o.layer) + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function renderKanban(stage) {
    var rows = contentObjects();
    stage.innerHTML = '<div class="wb-alt-view"><div class="wb-kanban">' + STATUSES.map(function (st) {
      var list = rows.filter(function (o) { return (o.status || 'Idea') === st; });
      return '<div class="wb-kanban-col"><div class="wb-kanban-col__head"><span>' + st + '</span><span>' + list.length + '</span></div>' +
        list.map(function (o) {
          return '<div class="wb-kanban-card" data-wb-pick="' + esc(o.id) + '">' +
            '<div style="font-size:13px;font-weight:700;margin-bottom:4px;">' + esc(o.title || '(Untitled)') + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">' +
              '<span class="wb-chip">' + esc(o.kind) + '</span>' +
              '<select data-wb-qstatus="' + esc(o.id) + '" style="font-size:11px;border:1px solid #cbd5e1;border-radius:5px;padding:2px 4px;">' +
                STATUSES.map(function (opt) { return '<option' + (opt === st ? ' selected' : '') + '>' + opt + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
    }).join('') + '</div></div>';
  }

  function renderTimeline(stage) {
    var rows = contentObjects().slice().sort(function (a, b) { return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')); });
    stage.innerHTML = '<div class="wb-alt-view"><div class="wb-panel"><h3>🗓 Execution Timeline</h3>' +
      rows.map(function (o) {
        return '<div class="wb-card-row" data-wb-pick="' + esc(o.id) + '" style="margin-bottom:7px;cursor:pointer;">' +
          '<span><span class="wb-chip">' + esc(o.dueDate || 'TBD') + '</span> <strong>' + esc(o.title || '(Untitled)') + '</strong></span>' +
          '<span class="wb-chip wb-status--' + (STATUS_SLUGS[o.status] || 'idea') + '">' + esc(o.status) + '</span>' +
        '</div>';
      }).join('') + '</div></div>';
  }

  function renderDashboard(stage) {
    var rows = contentObjects();
    var open = rows.filter(function (o) { return o.status !== 'Completed'; }).length;
    var done = rows.filter(function (o) { return o.status === 'Completed'; }).length;
    var blocked = rows.filter(function (o) { return o.status === 'Blocked'; }).length;
    var decisions = rows.filter(function (o) { return o.kind === 'decision'; }).length;
    var pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

    stage.innerHTML = '<div class="wb-alt-view">' +
      '<div class="wb-dash-kpis">' +
        '<div class="wb-kpi"><span>Total Objects</span><strong>' + rows.length + '</strong></div>' +
        '<div class="wb-kpi"><span>Open Items</span><strong>' + open + '</strong></div>' +
        '<div class="wb-kpi"><span>Completed</span><strong style="color:#16a34a;">' + done + '</strong></div>' +
        '<div class="wb-kpi"><span>Blocked / Risks</span><strong style="color:#dc2626;">' + blocked + '</strong></div>' +
        '<div class="wb-kpi"><span>Decisions</span><strong>' + decisions + '</strong></div>' +
        '<div class="wb-kpi"><span>Completion</span><strong style="color:#2563eb;">' + pct + '%</strong></div>' +
      '</div>' +
      '<div class="wb-dash-grid">' +
        '<div class="wb-panel"><h3>📊 Live KPIs</h3>' +
          (rows.filter(function (o) { return o.kind === 'kpi'; }).map(function (k) {
            return '<div class="wb-card-row" style="margin-bottom:6px;"><strong>' + esc(k.title) + '</strong><span style="color:#059669;font-weight:800;">' + esc(k.kpiValue) + ' / ' + esc(k.kpiTarget) + '</span></div>';
          }).join('') || '<p style="font-size:12.5px;color:#64748b;">Add KPI Cards on the canvas to monitor live metrics here.</p>') +
        '</div>' +
        '<div class="wb-panel"><h3>⚡ Team &amp; Automation Activity</h3>' +
          ((state.activity || []).slice(0, 7).map(function (a) {
            return '<div class="wb-card-row" style="margin-bottom:6px;"><span><strong>' + esc(a.actor) + ':</strong> ' + esc(a.text) + '</span></div>';
          }).join('') || '<p style="font-size:12.5px;color:#64748b;">No recent activity.</p>') +
        '</div>' +
      '</div></div>';
  }

  /* ---------- Slide-Over Drawer (Inspector / Layers / AI) ---------- */
  function renderDrawer() {
    var box = rootEl && rootEl.querySelector('[data-wb-drawer-box]');
    if (!box) return;
    if (!openDrawer) { box.hidden = true; return; }
    box.hidden = false;

    if (openDrawer === 'layers') {
      box.innerHTML =
        '<div class="wb-drawer__head"><h3>Multi-Layer Workspaces</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:28px;padding:0 9px;">×</button></div>' +
        '<div class="wb-drawer__body">' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;padding:4px 2px;">' +
            '<input type="checkbox" data-wb-show-resolved' + (showResolvedComments ? ' checked' : '') + ' /> Show Resolved Comment Pins' +
          '</label>' +
          (state.layers || []).map(function (l) {
            return '<div class="wb-card-row">' +
              '<span style="display:flex;align-items:center;gap:7px;"><i style="width:10px;height:10px;border-radius:50%;background:' + l.color + ';display:inline-block;"></i><strong>' + esc(l.label) + '</strong></span>' +
              '<span style="display:flex;gap:4px;">' +
                '<button type="button" class="wb-btn" data-wb-lyr-vis="' + l.id + '" style="height:28px;padding:0 8px;">' + (l.visible ? '👁' : '🚫') + '</button>' +
                '<button type="button" class="wb-btn" data-wb-lyr-lock="' + l.id + '" style="height:28px;padding:0 8px;">' + (l.locked ? '🔒' : '🔓') + '</button>' +
              '</span>' +
            '</div>';
          }).join('') +
        '</div>';
      return;
    }

    if (openDrawer === 'ai') {
      var cmds = ['Expand idea', 'Generate workflow', 'Generate roadmap', 'Generate SOP', 'Summarise board', 'Find risks', 'Generate KPIs'];
      if (!aiChat.length) {
        aiChat.push({ role: 'bot', text: 'I can see all ' + contentObjects().length + ' objects on your whiteboard. Pick a command or ask anything.' });
      }
      box.innerHTML =
        '<div class="wb-drawer__head"><h3>✨ AI Whiteboard Assistant</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:28px;padding:0 9px;">×</button></div>' +
        '<div class="wb-drawer__body">' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
            cmds.map(function (c) { return '<button type="button" class="wb-btn" data-wb-ai-cmd="' + esc(c) + '" style="height:28px;font-size:11px;padding:0 8px;">' + esc(c) + '</button>'; }).join('') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;flex:1;">' +
            aiChat.map(function (m, idx) {
              return '<div class="wb-card-row" style="flex-direction:column;align-items:stretch;background:' + (m.role === 'user' ? '#eff6ff' : '#f8fafc') + ';">' +
                '<div style="white-space:pre-wrap;line-height:1.45;">' + esc(m.text) + '</div>' +
                (m.cards ? '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">' + m.cards.map(function (c, ci) {
                  return '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:5px 7px;border-radius:6px;border:1px solid #cbd5e1;"><span>' + esc(c.title) + '</span><button type="button" class="wb-btn wb-btn--primary" data-wb-ai-add="' + idx + ':' + ci + '" style="height:26px;padding:0 8px;font-size:11px;">+ Board</button></div>';
                }).join('') + '</div>' : '') +
              '</div>';
            }).join('') +
          '</div>' +
          '<form data-wb-ai-form style="display:flex;gap:6px;">' +
            '<input type="text" id="wb-ai-input" placeholder="Ask AI about this whiteboard…" style="flex:1;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;" />' +
            '<button type="submit" class="wb-btn wb-btn--primary">Send</button>' +
          '</form>' +
        '</div>';
      return;
    }

    var o = getObj(primarySelectedId());
    if (!o) { box.hidden = true; return; }
    var dis = (currentCaps.canEdit && !reviewMode) ? '' : ' disabled';
    box.innerHTML =
      '<div class="wb-drawer__head"><h3>' + esc(o.kind.toUpperCase()) + ' Properties</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:28px;padding:0 9px;">×</button></div>' +
      '<div class="wb-drawer__body">' +
        '<div class="wb-field"><label>Title / Text</label><input type="text" data-wb-f="title" value="' + esc(o.title) + '"' + dis + ' /></div>' +
        '<div class="wb-field"><label>Description</label><textarea data-wb-f="description"' + dis + '>' + esc(o.description) + '</textarea></div>' +
        '<div class="wb-grid-2">' +
          '<div class="wb-field"><label>Status</label><select data-wb-f="status"' + dis + '>' + STATUSES.map(function (s) { return '<option' + (o.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
          '<div class="wb-field"><label>Priority</label><select data-wb-f="priority"' + dis + '>' + ['Low', 'Medium', 'High', 'Critical'].map(function (p) { return '<option' + (o.priority === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="wb-grid-2">' +
          '<div class="wb-field"><label>Assignee</label><input type="text" data-wb-f="assignee" value="' + esc(o.assignee) + '" placeholder="Name…"' + dis + ' /></div>' +
          '<div class="wb-field"><label>Due Date</label><input type="date" data-wb-f="dueDate" value="' + esc(o.dueDate) + '"' + dis + ' /></div>' +
        '</div>' +
        '<div class="wb-grid-2">' +
          '<div class="wb-field"><label>Department</label><input type="text" data-wb-f="department" value="' + esc(o.department) + '"' + dis + ' /></div>' +
          '<div class="wb-field"><label>Layer</label><select data-wb-f="layer"' + dis + '>' + (state.layers || []).map(function (l) { return '<option value="' + l.id + '"' + (o.layer === l.id ? ' selected' : '') + '>' + esc(l.label) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        (o.kind === 'kpi' ? '<div class="wb-grid-2"><div class="wb-field"><label>Current Value</label><input type="text" data-wb-f="kpiValue" value="' + esc(o.kpiValue) + '"' + dis + '/></div><div class="wb-field"><label>Target</label><input type="text" data-wb-f="kpiTarget" value="' + esc(o.kpiTarget) + '"' + dis + '/></div></div>' : '') +
        (o.kind === 'decision' ? '<div class="wb-field"><label>Decision Approval &amp; Votes</label><div class="wb-grid-2"><input type="text" data-wb-dec="approval" value="' + esc(o.decision && o.decision.approval || '') + '" placeholder="Approved / Pending"/><input type="text" data-wb-dec="votes" value="' + esc(o.decision && o.decision.votes || '') + '" placeholder="Vote results"/></div></div>' : '') +
        '<div class="wb-field"><label>Comments (@mentions)</label>' +
          ((o.comments || []).map(function (c) { return '<div class="wb-card-row"><span><strong>' + esc(c.author) + ':</strong> ' + formatMentions(c.text) + '</span></div>'; }).join('') || '<span style="font-size:11.5px;color:#94a3b8;">No comments yet.</span>') +
          '<form data-wb-cmt-form style="display:flex;gap:5px;margin-top:4px;"><input type="text" id="wb-cmt-in" placeholder="Add comment (@name)…"/><button type="submit" class="wb-btn wb-btn--primary">Post</button></form>' +
        '</div>' +
        (currentCaps.canEdit && !reviewMode ? '<div style="display:flex;gap:6px;"><button type="button" class="wb-btn" data-wb-dup>Duplicate</button><button type="button" class="wb-btn wb-btn--danger" data-wb-del>Delete</button></div>' : '') +
      '</div>';
  }

  /* ---------- Modals (Doc Gen, Presentation, Automations, Org Map) ---------- */
  function openModal(title, body, foot) {
    var bd = rootEl.querySelector('[data-wb-modal]');
    var box = rootEl.querySelector('[data-wb-modal-box]');
    box.innerHTML =
      '<div class="wb-modal__head"><h3>' + esc(title) + '</h3><button type="button" class="wb-btn" data-wb-modal-close style="height:28px;padding:0 9px;">×</button></div>' +
      '<div class="wb-modal__body">' + body + '</div>' +
      (foot ? '<div class="wb-modal__foot">' + foot + '</div>' : '');
    bd.hidden = false;
  }

  function openDocGenerator() {
    var items = contentObjects();
    function buildDoc(docType) {
      return '<h1>' + esc(boardTitle) + ' — ' + esc(docType) + '</h1>' +
        '<p><em>Generated from QuantalFlow Whiteboarding (' + items.length + ' objects)</em></p>' +
        '<h2>Executive Summary</h2><p>This ' + esc(docType.toLowerCase()) + ' synthesizes active strategy items, tasks, KPIs, and decisions captured on the visual workspace.</p>' +
        '<h2>Key Items &amp; Action Plan</h2><ul>' +
        items.map(function (o) {
          return '<li><strong>' + esc(o.title || '(Untitled)') + '</strong> (' + esc(o.status) + (o.assignee ? ' · ' + esc(o.assignee) : '') + '): ' + esc(o.description || 'In progress') + '</li>';
        }).join('') + '</ul>';
    }
    var docTypes = ['Meeting Minutes', 'Executive Report', 'Business Plan', 'SOP', 'Project Charter'];
    openModal('📄 Whiteboard → Document Generator',
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + docTypes.map(function (t) { return '<button type="button" class="wb-btn" data-wb-doctype="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<div class="wb-doc-editable" id="wb-gen-doc-area" contenteditable="true">' + buildDoc('Executive Report') + '</div>',
      '<button type="button" class="wb-btn wb-btn--primary" id="wb-dl-doc">Download .doc</button><button type="button" class="wb-btn" data-wb-modal-close>Close</button>'
    );
    rootEl.querySelectorAll('[data-wb-doctype]').forEach(function (b) {
      b.addEventListener('click', function () {
        var area = document.getElementById('wb-gen-doc-area');
        if (area) area.innerHTML = buildDoc(b.dataset.wbDoctype);
      });
    });
    document.getElementById('wb-dl-doc')?.addEventListener('click', function () {
      var html = '<html><head><meta charset="utf-8"></head><body>' + (document.getElementById('wb-gen-doc-area')?.innerHTML || '') + '</body></html>';
      var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'whiteboard-document.doc';
      a.click();
      toast('Downloaded Word document (.doc)');
    });
  }

  function openPresentationGenerator() {
    var items = contentObjects();
    var slides = [
      { title: boardTitle, bullets: ['Visual Strategy & Execution Deck', items.length + ' items synthesized from whiteboard'], notes: 'Welcome everyone. Generated live from QuantalFlow.' },
      { title: 'Active Workstreams', bullets: items.slice(0, 6).map(function (o) { return (o.title || '(Untitled)') + ' — ' + o.status; }), notes: 'Review owners and blockers.' }
    ];
    var idx = 0;
    function renderSlide() {
      var s = slides[idx];
      openModal('🎬 Presentation Deck (' + (idx + 1) + ' / ' + slides.length + ')',
        '<div class="wb-slide-card"><h2>' + esc(s.title) + '</h2><ul>' + (s.bullets.length ? s.bullets : ['No items yet']).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="wb-panel" style="padding:12px;"><strong style="font-size:11.5px;color:#64748b;text-transform:uppercase;">Speaker Notes</strong><p style="margin:6px 0 0;font-size:13px;">' + esc(s.notes) + '</p></div>',
        '<button type="button" class="wb-btn" id="wb-sl-prev">← Prev</button><button type="button" class="wb-btn wb-btn--primary" id="wb-sl-next">Next →</button><button type="button" class="wb-btn" data-wb-modal-close>Close</button>'
      );
      document.getElementById('wb-sl-prev')?.addEventListener('click', function () { idx = (idx - 1 + slides.length) % slides.length; renderSlide(); });
      document.getElementById('wb-sl-next')?.addEventListener('click', function () { idx = (idx + 1) % slides.length; renderSlide(); });
    }
    renderSlide();
  }

  function openAutomationsModal() {
    var rules = state.automations || [];
    openModal('⚡ No-Code Whiteboard Automations',
      rules.map(function (r) {
        return '<div class="wb-card-row"><span><strong>' + esc(r.name) + '</strong> · When <code>' + esc(r.trigger) + '</code> → ' + esc(r.detail) + ' (' + (r.runs || 0) + ' runs)</span><button type="button" class="wb-btn" data-wb-auto-tog="' + r.id + '">' + (r.enabled ? 'On' : 'Off') + '</button></div>';
      }).join('') +
      '<div class="wb-grid-2" style="margin-top:6px;"><input type="text" id="wb-au-name" placeholder="Rule name…" style="padding:7px;border:1px solid #cbd5e1;border-radius:8px;"/><select id="wb-au-trig" style="padding:7px;border:1px solid #cbd5e1;border-radius:8px;">' + STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>',
      '<button type="button" class="wb-btn wb-btn--primary" id="wb-au-add">+ Add Rule</button><button type="button" class="wb-btn" data-wb-modal-close>Done</button>'
    );
    rootEl.querySelectorAll('[data-wb-auto-tog]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = rules.find(function (x) { return x.id === b.dataset.wbAutoTog; });
        if (r) { r.enabled = !r.enabled; persist(); openAutomationsModal(); }
      });
    });
    document.getElementById('wb-au-add')?.addEventListener('click', function () {
      var n = (document.getElementById('wb-au-name')?.value || '').trim() || 'Status Trigger';
      var t = document.getElementById('wb-au-trig')?.value || 'Completed';
      state.automations.push({ id: uid('au'), name: n, enabled: true, trigger: t, action: 'notify', detail: 'Automated notification sent', runs: 0 });
      persist();
      openAutomationsModal();
    });
  }

  function openOrgModal() {
    openModal('🏢 Organisational Map Mode',
      '<p style="margin:0;font-size:13px;color:#475569;">Filter your whiteboard across organisational levels:</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
        ORG_LEVELS.map(function (lv) {
          return '<button type="button" class="wb-btn' + (orgLevelFilter === lv ? ' wb-btn--primary' : '') + '" data-wb-org-set="' + lv + '">' + lv + '</button>';
        }).join('') +
      '</div>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Done</button>'
    );
    rootEl.querySelectorAll('[data-wb-org-set]').forEach(function (b) {
      b.addEventListener('click', function () { orgLevelFilter = b.dataset.wbOrgSet; render(); openOrgModal(); });
    });
  }

  function runAiCommand(prompt) {
    aiChat.push({ role: 'user', text: prompt });
    var items = contentObjects();
    var lower = prompt.toLowerCase();
    var replyText = 'Analyzed ' + items.length + ' whiteboard objects for "' + prompt + '". Suggested additions:';
    var cards = [
      { kind: 'task', title: 'Action: ' + prompt, description: 'Generated by QuantalFlow AI.', status: 'Planned', layer: 'ai' },
      { kind: 'kpi', title: 'Success Metric', kpiValue: '0%', kpiTarget: '90%', description: 'Track outcome for ' + prompt, status: 'Planned', layer: 'ai' }
    ];
    if (lower.indexOf('risk') !== -1) {
      var blk = items.filter(function (o) { return o.status === 'Blocked'; });
      replyText = blk.length ? 'Found ' + blk.length + ' blocked item(s): ' + blk.map(function (b) { return b.title; }).join(', ') : 'No blocked items right now.';
      cards = [{ kind: 'sticky', bg: '#fce7f3', title: 'Risk Mitigation Checkpoint', status: 'Planned', layer: 'ai' }];
    } else if (lower.indexOf('summaris') !== -1) {
      replyText = 'Board Summary: ' + items.length + ' items (' + items.filter(function (o) { return o.status === 'Completed'; }).length + ' completed).';
      cards = null;
    }
    aiChat.push({ role: 'bot', text: replyText, cards: cards });
    renderDrawer();
  }

  function addObjectToCenter(kind, extra) {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    pushHistory();
    var c = viewportCenterWorld();
    var offset = (insertStagger % 5) * 24;
    insertStagger += 1;
    var baseX = (extra && extra.x != null) ? extra.x : Math.round(c.x - 110 + offset);
    var baseY = (extra && extra.y != null) ? extra.y : Math.round(c.y - 75 + offset);
    var obj = makeObj(Object.assign({ kind: kind, x: baseX, y: baseY }, extra || {}));
    if (kind === 'section')  { obj.w = 520; obj.h = 340; obj.title = 'New Frame'; }
    if (kind === 'swimlane') { obj.w = 640; obj.h = 200; obj.title = 'Operations Swimlane'; obj.layer = 'operations'; }
    if (kind === 'kpi')      { obj.w = 230; obj.h = 145; obj.title = (extra && extra.title) || 'New KPI Card'; }
    if (kind === 'decision') { obj.w = 250; obj.h = 160; obj.title = (extra && extra.title) || 'New Decision Card'; }
    if (kind === 'task')     { obj.w = 240; obj.h = 150; obj.title = (extra && extra.title) || 'New Tracked Task'; obj.status = 'Planned'; }
    if (kind === 'doc')      { obj.w = 245; obj.h = 150; obj.title = (extra && extra.title) || 'Document Brief'; obj.layer = 'documentation'; }
    if (kind === 'code')     { obj.w = 340; obj.h = 260; obj.code = 'A[User] --> B[API]\nB -->|OK| C[Response]'; }
    if (kind === 'table')    { obj.w = 360; obj.h = 180; obj.rows = [['Task', 'Owner', 'Status'], ['Research', 'Alex', 'Done'], ['Prototype', 'Sam', 'In Progress']]; }
    if (kind === 'embed')    { obj.w = 280; obj.h = 120; obj.url = (extra && extra.url) || 'https://quantalflow.com'; obj.title = (extra && extra.title) || 'Embedded Link'; }
    if (kind === 'sticker')  { obj.w = 88; obj.h = 88; }
    state.objects.push(obj);
    selectedIds = [obj.id];
    selectedLinkId = null;
    setActiveTool('select');
    logAct('Added ' + kind);
    render();
    persist();
    return obj;
  }

  function handleUploadedFiles(fileList, atWorldPt) {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    var files = Array.from(fileList || []);
    if (!files.length) return;
    files.forEach(function (f, idx) {
      var posOv = atWorldPt ? { x: Math.round(atWorldPt.x - 150 + idx * 28), y: Math.round(atWorldPt.y - 110 + idx * 28) } : {};
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')) {
        addObjectToCenter('image', Object.assign({ w: 240, h: 120, title: f.name || 'Document.pdf', description: Math.max(1, Math.round(f.size / 1024)) + ' KB PDF' }, posOv));
        toast('Inserted PDF: ' + (f.name || 'Document.pdf'));
      } else {
        var reader = new FileReader();
        reader.onload = function () {
          addObjectToCenter('image', Object.assign({ w: 320, h: 230, title: f.name || 'Image', src: String(reader.result || '') }, posOv));
          toast('Inserted image: ' + (f.name || 'Image'));
        };
        reader.readAsDataURL(f);
      }
    });
  }

  function openEmbedModal() {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    openModal('🔗 Embed Link / Card',
      '<div class="wb-field"><label for="wb-embed-url">URL</label><input type="url" id="wb-embed-url" value="https://quantalflow.com" placeholder="https://example.com" /></div>' +
      '<div class="wb-field"><label for="wb-embed-title">Card Title (optional)</label><input type="text" id="wb-embed-title" placeholder="Leave blank to use domain name" /></div>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Cancel</button><button type="button" class="wb-btn wb-btn--primary" id="wb-embed-confirm">Insert Card</button>'
    );
    var urlInp = document.getElementById('wb-embed-url');
    if (urlInp) { urlInp.focus(); urlInp.select(); }
    function submitEmbed() {
      var raw = (document.getElementById('wb-embed-url')?.value || '').trim();
      if (!raw) { toast('Enter a valid URL'); return; }
      var url = /^https?:\/\//i.test(raw) ? raw : ('https://' + raw);
      var title = (document.getElementById('wb-embed-title')?.value || '').trim() || url.replace(/^https?:\/\//i, '').split('/')[0];
      rootEl.querySelector('[data-wb-modal]').hidden = true;
      addObjectToCenter('embed', { url: url, title: title });
      toast('Inserted embed card');
    }
    document.getElementById('wb-embed-confirm')?.addEventListener('click', submitEmbed);
    urlInp?.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitEmbed(); } });
    document.getElementById('wb-embed-title')?.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitEmbed(); } });
  }

  function openImageUrlModal() {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    openModal('🌐 Insert Image from URL',
      '<div class="wb-field"><label for="wb-img-url">Image / SVG URL</label><input type="url" id="wb-img-url" placeholder="https://example.com/diagram.png" /></div>' +
      '<div class="wb-field"><label for="wb-img-title">Caption (optional)</label><input type="text" id="wb-img-title" placeholder="Asset title" /></div>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Cancel</button><button type="button" class="wb-btn wb-btn--primary" id="wb-img-confirm">Insert Image</button>'
    );
    var urlInp = document.getElementById('wb-img-url');
    if (urlInp) urlInp.focus();
    function submitImg() {
      var raw = (document.getElementById('wb-img-url')?.value || '').trim();
      if (!raw) { toast('Enter an image URL'); return; }
      var title = (document.getElementById('wb-img-title')?.value || '').trim() || 'Linked Image';
      rootEl.querySelector('[data-wb-modal]').hidden = true;
      addObjectToCenter('image', { w: 320, h: 230, title: title, src: raw });
      toast('Inserted image');
    }
    document.getElementById('wb-img-confirm')?.addEventListener('click', submitImg);
    urlInp?.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitImg(); } });
  }

  function deleteSelection() {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    if (selectedLinkId) {
      pushHistory();
      state.links = state.links.filter(function (l) { return l.id !== selectedLinkId; });
      selectedLinkId = null;
      render();
      persist();
      toast('Deleted connector (Ctrl+Z to undo)');
      return true;
    }
    if (selectedIds.length) {
      pushHistory();
      var delSet = new Set(selectedIds);
      state.objects = state.objects.filter(function (x) { return !delSet.has(x.id); });
      state.links = state.links.filter(function (l) { return !delSet.has(l.fromId) && !delSet.has(l.toId); });
      selectedIds = [];
      openDrawer = null;
      render();
      persist();
      toast('Deleted selection (Ctrl+Z to undo)');
      return true;
    }
    return false;
  }

  /* ---------- Delegated Events & Keyboard Shortcuts ---------- */
  function bindEvents() {
    var fileInp = rootEl.querySelector('#wb-asset-upload');
    if (fileInp) {
      fileInp.addEventListener('change', function () {
        if (fileInp.files && fileInp.files.length) {
          handleUploadedFiles(fileInp.files);
        }
        fileInp.value = '';
      });
    }

    // Paste images directly from clipboard onto the whiteboard
    window.addEventListener('paste', function (e) {
      if (!rootEl || rootEl.hidden || !currentCaps.canEdit || reviewMode) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      var imgFiles = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) imgFiles.push(f);
        }
      }
      if (imgFiles.length) {
        e.preventDefault();
        handleUploadedFiles(imgFiles);
      }
    });

    rootEl.addEventListener('click', function (e) {
      var vBtn = e.target.closest('[data-wb-view]');
      if (vBtn) { state.activeView = vBtn.dataset.wbView; render(); persist(); return; }

      // Dock tool button click
      var tBtn = e.target.closest('[data-wb-tool]');
      if (tBtn) {
        var nextTool = normalizeTool(tBtn.dataset.wbTool);
        var popKind = tBtn.dataset.wbOpenPop;
        var wasSame = (activeTool === nextTool);
        setActiveTool(nextTool, { closePopover: !popKind });
        if (popKind) {
          showDockPopover(popKind, !wasSame);
        }
        return;
      }

      var popBtn = e.target.closest('[data-wb-popover]');
      if (popBtn) { showDockPopover(popBtn.dataset.wbPopover); return; }

      var pickShape = e.target.closest('[data-wb-pick-shape]');
      if (pickShape) {
        selectedShapeType = pickShape.dataset.wbPickShape;
        setActiveTool('shape');
        toast('Click or drag on canvas to draw ' + selectedShapeType);
        return;
      }

      var pickFrame = e.target.closest('[data-wb-pick-frame]');
      if (pickFrame) {
        selectedFramePreset = pickFrame.dataset.wbPickFrame;
        setActiveTool('frame');
        toast('Click or drag on canvas to place Frame');
        return;
      }

      var pickFc = e.target.closest('[data-wb-pick-fc]');
      if (pickFc) {
        selectedFlowchartType = pickFc.dataset.wbPickFc;
        setActiveTool('flowchart');
        toast('Click or drag on canvas to place flowchart node');
        return;
      }

      var penModeBtn = e.target.closest('[data-wb-pen-mode]');
      if (penModeBtn) { penMode = penModeBtn.dataset.wbPenMode; syncToolUi(); showDockPopover('pen', true); return; }
      var penColBtn = e.target.closest('[data-wb-pen-color]');
      if (penColBtn) { penColor = penColBtn.dataset.wbPenColor; showDockPopover('pen', true); return; }
      var penWidBtn = e.target.closest('[data-wb-pen-width]');
      if (penWidBtn) { penWidth = Number(penWidBtn.dataset.wbPenWidth) || 4; showDockPopover('pen', true); return; }

      if (e.target.closest('[data-wb-templates]')) {
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        openTemplatesModal();
        return;
      }

      var tplPick = e.target.closest('[data-wb-insert-tpl]');
      if (tplPick) { insertTemplateBlueprint(tplPick.dataset.wbInsertTpl); return; }

      var fcSpawn = e.target.closest('[data-wb-fc-spawn]');
      if (fcSpawn) {
        e.stopPropagation();
        var sp = fcSpawn.dataset.wbFcSpawn.split(':');
        spawnFlowchartBranch(sp[0], sp[1]);
        return;
      }

      var insBtn = e.target.closest('[data-wb-insert]');
      if (insBtn) {
        var kind = insBtn.dataset.wbInsert;
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        if (kind === 'upload') {
          if (fileInp) fileInp.click();
        } else if (kind === 'embed') {
          var url = window.prompt('Enter URL to embed as a card:', 'https://quantalflow.com');
          if (url && url.trim()) addObjectToCenter('embed', { url: url.trim(), title: url.trim().replace(/^https?:\/\//, '').split('/')[0] });
        } else {
          addObjectToCenter(kind);
        }
        return;
      }

      var stBtn = e.target.closest('[data-wb-insert-sticker]');
      if (stBtn) {
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        addObjectToCenter('sticker', { title: stBtn.dataset.wbInsertSticker });
        return;
      }

      if (e.target.closest('[data-wb-add-workspace]')) {
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        if (window.QuantalFlowApp && typeof window.QuantalFlowApp.openAddWorkspaceModal === 'function') {
          window.QuantalFlowApp.openAddWorkspaceModal();
        }
        return;
      }

      // 13. Trash button: delete selection if any, else confirm clear canvas
      if (e.target.closest('[data-wb-trash]')) {
        if (!deleteSelection()) openClearConfirmModal();
        return;
      }
      if (e.target.closest('[data-wb-confirm-clear]')) {
        pushHistory();
        state.objects = [];
        state.links = [];
        state.paths = [];
        selectedIds = [];
        selectedLinkId = null;
        openDrawer = null;
        rootEl.querySelector('[data-wb-modal]').hidden = true;
        render();
        persist();
        toast('Canvas cleared (Ctrl+Z to undo)');
        return;
      }

      // Comment actions
      var cmtRes = e.target.closest('[data-wb-cmt-resolve]');
      if (cmtRes) {
        e.stopPropagation();
        var co = getObj(cmtRes.dataset.wbCmtResolve);
        if (co) {
          pushHistory();
          co.resolved = !co.resolved;
          if (co.resolved && !showResolvedComments) openCommentId = null;
          render();
          persist();
          toast(co.resolved ? 'Comment resolved' : 'Comment reopened');
        }
        return;
      }
      if (e.target.closest('[data-wb-cmt-close]')) { e.stopPropagation(); openCommentId = null; render(); return; }

      var reactBtn = e.target.closest('[data-wb-react]');
      if (reactBtn) {
        e.stopPropagation();
        var rp = reactBtn.dataset.wbReact.split(':');
        var ro = getObj(rp[0]);
        if (ro) {
          if (!ro.reactions) ro.reactions = {};
          ro.reactions[rp[1]] = (ro.reactions[rp[1]] || 0) + 1;
          render();
          persist();
        }
        return;
      }

      // Context toolbar actions
      var bgBtn = e.target.closest('[data-wb-bg]');
      if (bgBtn) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.bg = bgBtn.dataset.wbBg; });
        render(); persist(); return;
      }
      var tcBtn = e.target.closest('[data-wb-text-color]');
      if (tcBtn) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.textColor = tcBtn.dataset.wbTextColor; });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-hl-toggle]')) {
        pushHistory();
        selectedIds.forEach(function (sid) {
          var o = getObj(sid);
          if (o) o.highlightColor = (o.highlightColor && o.highlightColor !== 'transparent') ? 'transparent' : '#fef08a';
        });
        render(); persist(); return;
      }
      var alBtn = e.target.closest('[data-wb-align]');
      if (alBtn) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.textAlign = alBtn.dataset.wbAlign; });
        render(); persist(); return;
      }
      var fmtBtn = e.target.closest('[data-wb-fmt]');
      if (fmtBtn) {
        pushHistory();
        var fk = fmtBtn.dataset.wbFmt;
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o[fk] = !o[fk]; });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-bullet]')) {
        pushHistory();
        selectedIds.forEach(function (sid) {
          var o = getObj(sid);
          if (!o) return;
          var lines = String(o.title || '').split('\n');
          var hasB = lines.every(function (l) { return !l.trim() || l.trim().indexOf('• ') === 0; });
          o.title = lines.map(function (l) {
            if (!l.trim()) return l;
            return hasB ? l.replace(/^\s*•\s*/, '') : ('• ' + l);
          }).join('\n');
        });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-toggle-dash]')) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.strokeStyle = o.strokeStyle === 'dashed' ? 'solid' : 'dashed'; });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-frame-fill]')) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.bg = o.bg === 'transparent' ? 'rgba(255,255,255,0.72)' : 'transparent'; });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-frame-collapse]')) {
        pushHistory();
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o.collapsed = !o.collapsed; });
        render(); persist(); return;
      }
      var zBtn2 = e.target.closest('[data-wb-z]');
      if (zBtn2) {
        pushHistory();
        var maxZ = (state.objects || []).reduce(function (m, x) { return Math.max(m, x.z || 10); }, 10);
        var minZ = (state.objects || []).reduce(function (m, x) { return Math.min(m, x.z || 10); }, 10);
        selectedIds.forEach(function (sid) {
          var o = getObj(sid);
          if (o) o.z = zBtn2.dataset.wbZ === 'front' ? maxZ + 1 : Math.max(2, minZ - 1);
        });
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-open-insp]')) { openDrawer = openDrawer === 'inspector' ? null : 'inspector'; renderDrawer(); return; }

      var lkCol = e.target.closest('[data-wb-lk-color]');
      if (lkCol && selectedLinkId) {
        var lk2 = getLink(selectedLinkId);
        if (lk2) { pushHistory(); lk2.color = lkCol.dataset.wbLkColor; connectorDefaults.color = lk2.color; renderEdgesSvg(); renderCtxBar(); persist(); }
        return;
      }
      if (e.target.closest('[data-wb-lk-edit-label]') && selectedLinkId) { openConnectorLabelEditor(selectedLinkId); return; }

      if (e.target.closest('[data-wb-dup]')) {
        if (!selectedIds.length) return;
        pushHistory();
        var newIds = [];
        selectedIds.forEach(function (sid) {
          var orig = getObj(sid);
          if (orig) {
            var cp = JSON.parse(JSON.stringify(orig));
            cp.id = uid('wb'); cp.x += 32; cp.y += 32;
            state.objects.push(cp);
            newIds.push(cp.id);
          }
        });
        selectedIds = newIds;
        render(); persist(); return;
      }
      if (e.target.closest('[data-wb-del]')) { deleteSelection(); return; }

      // Bottom & top pill controls
      if (e.target.closest('[data-wb-undo]')) { undo(); return; }
      if (e.target.closest('[data-wb-redo]')) { redo(); return; }
      if (e.target.closest('[data-wb-grid-mode]')) { gridMode = (gridMode + 1) % 3; render(); toast(gridMode === 0 ? 'Dot Grid' : gridMode === 1 ? 'Line Grid' : 'Clean Canvas'); return; }
      if (e.target.closest('[data-wb-snap]')) { snapGrid = !snapGrid; render(); return; }
      if (e.target.closest('[data-wb-minimap-toggle]')) { minimapOpen = !minimapOpen; render(); return; }

      var addBtn = e.target.closest('[data-wb-add]');
      if (addBtn) {
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        rootEl.querySelector('[data-wb-modal]').hidden = true;
        addObjectToCenter(addBtn.dataset.wbAdd);
        return;
      }

      if (e.target.closest('[data-wb-validate-flow]')) {
        dockPopover = null; rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        var procs = (state.objects || []).filter(function (o) { return o.kind === 'flowchart' || o.kind === 'process' || o.kind === 'diamond'; });
        toast(procs.length ? 'Workflow validated: ' + procs.length + ' flowchart nodes, ' + (state.links || []).length + ' connectors.' : 'Add flowchart nodes first to validate workflow logic.');
        return;
      }

      var drBtn = e.target.closest('[data-wb-drawer]');
      if (drBtn) { openDrawer = openDrawer === drBtn.dataset.wbDrawer ? null : drBtn.dataset.wbDrawer; render(); return; }
      if (e.target.closest('[data-wb-close-drawer]')) { openDrawer = null; render(); return; }

      if (e.target.closest('[data-wb-gen-doc]')) { openDocGenerator(); return; }
      if (e.target.closest('[data-wb-gen-deck]')) { openPresentationGenerator(); return; }
      if (e.target.closest('[data-wb-auto-modal]')) { openAutomationsModal(); return; }
      if (e.target.closest('[data-wb-org-modal]')) { openOrgModal(); return; }
      if (e.target.closest('[data-wb-modal-close]') || e.target.matches('[data-wb-modal]')) { rootEl.querySelector('[data-wb-modal]').hidden = true; return; }

      if (e.target.closest('[data-wb-review]')) {
        reviewMode = !reviewMode;
        e.target.closest('[data-wb-review]').classList.toggle('is-active', reviewMode);
        toast(reviewMode ? 'Review Mode ON (canvas locked, comments enabled)' : 'Review Mode OFF');
        render();
        return;
      }

      var zBtn = e.target.closest('[data-wb-zoom]');
      if (zBtn) {
        var a = zBtn.dataset.wbZoom;
        if (a === 'in') zoomAt(zoom + 0.12);
        else if (a === 'out') zoomAt(zoom - 0.12);
        else { zoom = 0.95; panX = 110; panY = 90; applyWorldTransform(); }
        return;
      }

      var lv = e.target.closest('[data-wb-lyr-vis]');
      if (lv) { var l = getLayer(lv.dataset.wbLyrVis); l.visible = !l.visible; render(); persist(); return; }
      var ll = e.target.closest('[data-wb-lyr-lock]');
      if (ll) { var l2 = getLayer(ll.dataset.wbLyrLock); l2.locked = !l2.locked; render(); persist(); return; }

      var aiCmd = e.target.closest('[data-wb-ai-cmd]');
      if (aiCmd) { runAiCommand(aiCmd.dataset.wbAiCmd); return; }
      var aiAdd = e.target.closest('[data-wb-ai-add]');
      if (aiAdd) {
        var pts = aiAdd.dataset.wbAiAdd.split(':');
        var card = aiChat[Number(pts[0])] && aiChat[Number(pts[0])].cards && aiChat[Number(pts[0])].cards[Number(pts[1])];
        if (card) { addObjectToCenter(card.kind || 'sticky', card); aiAdd.disabled = true; aiAdd.textContent = 'Added ✓'; }
        return;
      }

      var pick = e.target.closest('[data-wb-pick]');
      if (pick && !e.target.closest('select')) { selectedIds = [pick.dataset.wbPick]; openDrawer = 'inspector'; renderDrawer(); }
    });

    rootEl.addEventListener('change', function (e) {
      if (e.target.matches('[data-wb-smart-shape]')) { penSmartShape = e.target.checked; return; }
      if (e.target.matches('[data-wb-show-resolved]')) { showResolvedComments = e.target.checked; render(); return; }

      var lkProp = e.target.closest('[data-wb-lk-prop]');
      if (lkProp && selectedLinkId) {
        var lk = getLink(selectedLinkId);
        if (lk) {
          pushHistory();
          var prop = lkProp.dataset.wbLkProp;
          lk[prop] = prop === 'width' ? Number(lkProp.value) : lkProp.value;
          connectorDefaults[prop] = lk[prop];
          renderEdgesSvg();
          persist();
        }
        return;
      }

      var objProp = e.target.closest('[data-wb-obj-prop]');
      if (objProp && selectedIds.length) {
        pushHistory();
        var op = objProp.dataset.wbObjProp;
        var val = (op === 'strokeWidth' || op === 'fontSize' || op === 'opacity') ? Number(objProp.value) : objProp.value;
        selectedIds.forEach(function (sid) { var o = getObj(sid); if (o) o[op] = val; });
        render();
        persist();
        return;
      }

      var qs = e.target.closest('[data-wb-qstatus]');
      if (qs && currentCaps.canEdit && !reviewMode) {
        var o2 = getObj(qs.dataset.wbQstatus);
        if (o2) { o2.status = qs.value; triggerAutomations(o2, o2.status); render(); persist(); }
      }
    });

    rootEl.addEventListener('input', function (e) {
      // Live Mermaid/Code block editing
      var codeArea = e.target.closest('[data-wb-code-id]');
      if (codeArea) {
        var co = getObj(codeArea.dataset.wbCodeId);
        if (co) {
          co.code = codeArea.value;
          var prev = codeArea.parentElement && codeArea.parentElement.querySelector('.wb-mermaid-preview');
          if (prev) prev.innerHTML = renderSimpleMermaidSvg(co.code);
          persist();
        }
        return;
      }
      // Inline table editing
      var cell = e.target.closest('[data-wb-cell]');
      if (cell) {
        var cp = cell.dataset.wbCell.split(':');
        var to = getObj(cp[0]);
        if (to && Array.isArray(to.rows) && to.rows[Number(cp[1])]) {
          to.rows[Number(cp[1])][Number(cp[2])] = cell.innerText;
          persist();
        }
        return;
      }

      var o = getObj(primarySelectedId());
      if (!o || !currentCaps.canEdit || reviewMode) return;
      if (e.target.matches('[data-wb-f]')) {
        var f = e.target.dataset.wbF;
        o[f] = e.target.value;
        if (f === 'status') triggerAutomations(o, o.status);
        render();
        persist();
      } else if (e.target.matches('[data-wb-dec]')) {
        if (!o.decision) o.decision = {};
        o.decision[e.target.dataset.wbDec] = e.target.value;
        render();
        persist();
      }
    });

    rootEl.addEventListener('submit', function (e) {
      if (e.target.matches('[data-wb-ai-form]')) {
        e.preventDefault();
        var inp = document.getElementById('wb-ai-input');
        var v = (inp && inp.value || '').trim();
        if (v) { inp.value = ''; runAiCommand(v); }
      } else if (e.target.matches('[data-wb-cmt-form]')) {
        e.preventDefault();
        var o = getObj(primarySelectedId());
        var ci = document.getElementById('wb-cmt-in');
        var txt = (ci && ci.value || '').trim();
        if (o && txt) {
          if (!Array.isArray(o.comments)) o.comments = [];
          o.comments.push({ id: uid('c'), author: currentUser, text: txt, at: new Date().toISOString() });
          render(); persist();
        }
      } else if (e.target.matches('[data-wb-pin-cmt-form]')) {
        e.preventDefault();
        var pid = e.target.dataset.wbPinCmtForm;
        var pin = getObj(pid);
        var pi = e.target.querySelector('.wb-pin-cmt-in');
        var ptxt = (pi && pi.value || '').trim();
        if (pin && ptxt) {
          pushHistory();
          if (!Array.isArray(pin.comments)) pin.comments = [];
          pin.comments.push({ id: uid('c'), author: currentUser, text: ptxt, at: new Date().toISOString() });
          render(); persist();
        }
      }
    });

    // Keyboard shortcuts + Spacebar temporary Hand pan
    window.addEventListener('keydown', function (e) {
      if (!rootEl || rootEl.hidden) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;

      if (e.code === 'Space' && !spacePressed) {
        e.preventDefault();
        spacePressed = true;
        toolBeforeSpace = activeTool;
        syncToolUi();
        return;
      }

      if (e.key === 'Escape') {
        dockPopover = null;
        var pb = rootEl.querySelector('[data-wb-popover-box]');
        if (pb) pb.hidden = true;
        var md = rootEl.querySelector('[data-wb-modal]');
        if (md && !md.hidden) { md.hidden = true; return; }
        openCommentId = null;
        selectedIds = [];
        selectedLinkId = null;
        openDrawer = null;
        setActiveTool('select');
        render();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectedIds = (state.objects || []).filter(isObjVisible).map(function (o) { return o.id; });
        selectedLinkId = null;
        syncSelectionDom();
        renderCtxBar();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length) {
        e.preventDefault();
        pushHistory();
        var added = [];
        selectedIds.forEach(function (sid) {
          var orig = getObj(sid);
          if (orig) { var cp = JSON.parse(JSON.stringify(orig)); cp.id = uid('wb'); cp.x += 32; cp.y += 32; state.objects.push(cp); added.push(cp.id); }
        });
        selectedIds = added;
        render(); persist();
        return;
      }
      if (e.key === 'Tab' && selectedIds.length === 1) {
        var so = getObj(selectedIds[0]);
        if (so && so.kind === 'sticky') { e.preventDefault(); spawnAdjacentSticky(so); return; }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedIds.length || selectedLinkId)) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      var k = e.key.toLowerCase();
      if (k === 'v')      setActiveTool('select');
      else if (k === 'h') setActiveTool('hand');
      else if (k === 's' || k === 'n') setActiveTool('sticky');
      else if (k === 'r') { setActiveTool('shape', { closePopover: false }); showDockPopover('shapes', true); }
      else if (k === 'l' || k === 'c') setActiveTool('connector');
      else if (k === 't') setActiveTool('text');
      else if (k === 'f') setActiveTool('frame');
      else if (k === 'p') { setActiveTool('pen', { closePopover: false }); showDockPopover('pen', true); }
      else if (k === 'm') setActiveTool('comment');
    });

    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space' && spacePressed) {
        spacePressed = false;
        if (toolBeforeSpace) activeTool = toolBeforeSpace;
        toolBeforeSpace = null;
        syncToolUi();
      }
    });
  }

  window.WhiteboardSuite = {
    open: function (id, title, savedState, opts) {
      boardId = id || 'whiteboard';
      boardTitle = title || 'Visual Strategy Workspace';
      callbacks = opts || {};
      if (callbacks.getCaps) currentCaps = callbacks.getCaps() || currentCaps;
      ensureDom();
      var hydrated = null;
      if (savedState && Array.isArray(savedState.objects) && savedState.objects.length) {
        hydrated = JSON.parse(JSON.stringify(savedState));
      } else {
        try {
          var cached = localStorage.getItem('quantalflow_wb_v1_' + boardId);
          if (cached) { var p = JSON.parse(cached); if (p && Array.isArray(p.objects)) hydrated = p; }
        } catch (_) {}
      }
      state = hydrated || createStarterState(boardTitle);
      if (!Array.isArray(state.paths)) state.paths = [];
      if (!Array.isArray(state.links)) state.links = [];
      selectedIds = [];
      selectedLinkId = null;
      openDrawer = null;
      openCommentId = null;
      activeTool = 'select';
      // Default minimap hidden on narrow mobile screens
      if (window.innerWidth <= 768) minimapOpen = false;
      rootEl.hidden = false;
      render();
    },
    close: function () { if (rootEl) rootEl.hidden = true; },
    isOpen: function () { return Boolean(rootEl && !rootEl.hidden); },
    getState: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    getActiveTool: function () { return activeTool; },
    getViewportTransform: function () { return { panX: panX, panY: panY, zoom: zoom }; },
    flush: function () {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (state && callbacks.onSave) {
          callbacks.onSave(JSON.parse(JSON.stringify(state)));
        }
      }
    },
    setCapabilities: function (caps) { if (caps) currentCaps = caps; if (rootEl && !rootEl.hidden) render(); }
  };
})();
