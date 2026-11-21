/**
 * QuantalFlow Whiteboarding Visual Workspace (window.WhiteboardSuite)
 * Clean, progressive-disclosure visual workspace combining Miro + FigJam +
 * Notion + ClickUp + Airtable + AI Assistant.
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
  var RELATIONS = [
    { id: 'depends_on', label: 'Depends On', color: '#dc2626', dash: '5 4' },
    { id: 'blocks',     label: 'Blocks',     color: '#b91c1c', dash: '3 3' },
    { id: 'supports',   label: 'Supports',   color: '#16a34a', dash: '' },
    { id: 'related_to', label: 'Related To', color: '#6366f1', dash: '3 4' },
    { id: 'references', label: 'References', color: '#9333ea', dash: '5 3' }
  ];
  var ORG_LEVELS = ['All', 'Company', 'Department', 'Team', 'Project', 'Task', 'Document'];
  var STICKY_COLORS = ['#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#ffedd5'];

  var rootEl = null;
  var boardId = '';
  var boardTitle = 'Visual Strategy Workspace';
  var callbacks = {};
  var state = null;
  var selectedId = null;
  var activeTool = 'select'; // select | pan | connect | pen
  var pendingConnectFrom = null;
  var openDrawer = null; // null | 'inspector' | 'layers' | 'ai'
  var dockPopover = null; // null | 'shapes' | 'pen' | 'cards' | 'process'
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
  var isPanning = false;
  var panStartX = 0;
  var panStartY = 0;
  var dragging = null;
  var penColor = '#1a1a2e';
  var penWidth = 4;
  var isDrawingPen = false;
  var penPoints = [];
  var activePenPathEl = null;
  var historyStack = [];
  var redoStack = [];
  var saveTimer = null;
  var currentCaps = { canEdit: true, canComment: true, canView: true };
  var currentUser = 'You';
  var aiChat = [];

  var PEN_COLORS = ['#1a1a2e', '#4262ff', '#10b981', '#ef4444', '#f59e0b', '#7c3aed'];

  function pushHistory() {
    if (!state) return;
    historyStack.push(JSON.stringify(state));
    if (historyStack.length > 35) historyStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!historyStack.length) { toast('Nothing to undo'); return; }
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(historyStack.pop());
    selectedId = null;
    render();
    persist();
  }

  function redo() {
    if (!redoStack.length) { toast('Nothing to redo'); return; }
    historyStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    selectedId = null;
    render();
    persist();
  }

  function uid(p) { return (p || 'o') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function addDays(d) {
    var dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  }
  function toast(m) { if (callbacks.onToast) callbacks.onToast(m); }

  function makeObj(ov) {
    return Object.assign({
      id: uid('wb'),
      kind: 'sticky', // sticky|task|kpi|decision|doc|process|diamond|swimlane|section
      x: 240, y: 160, w: 224, h: 150,
      bg: '#fef9c3',
      layer: 'strategy',
      orgLevel: 'Project',
      title: 'New Smart Sticky',
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
    var sec1 = makeObj({ id: 'wb_sec_1', kind: 'section', x: 60, y: 60, w: 540, h: 360, title: 'Strategy & Discovery', layer: 'strategy', orgLevel: 'Company' });
    var st1 = makeObj({ id: 'wb_st_1', kind: 'sticky', x: 90, y: 115, bg: '#fef9c3', title: 'Customer Onboarding Revamp', description: 'Cut time-to-first-value from 14 days to 2 days with guided templates.', status: 'In Progress', priority: 'High', assignee: 'Alex', department: 'Product', tags: ['growth', 'q4'], layer: 'strategy', orgLevel: 'Project' });
    var dec1 = makeObj({ id: 'wb_dec_1', kind: 'decision', x: 340, y: 115, title: 'Approve AI Copilot Rollout', description: 'Unanimous sign-off to ship AI assistant across all workspaces.', status: 'Completed', priority: 'High', assignee: 'Sam', department: 'Engineering', layer: 'strategy', orgLevel: 'Document', decision: { summary: 'Ship persistent AI assistant in Whiteboarding', discussion: 'Reviewed latency and enterprise security controls.', participants: 'Alex, Sam, Jordan', votes: '5 Approve / 0 Reject', approval: 'Approved', date: addDays(-2) } });
    var tsk1 = makeObj({ id: 'wb_tsk_1', kind: 'task', x: 660, y: 115, title: 'Build Workflow Automation Engine', description: 'Trigger notifications and escalations automatically on status change.', status: 'In Progress', priority: 'Critical', assignee: 'Sam', dueDate: addDays(5), department: 'Engineering', layer: 'operations', orgLevel: 'Task' });
    var kpi1 = makeObj({ id: 'wb_kpi_1', kind: 'kpi', x: 660, y: 310, title: 'Activation Rate KPI', description: 'Teams creating 2+ boards in week 1.', kpiValue: '64%', kpiTarget: '75%', status: 'Planned', department: 'Finance', layer: 'finance', orgLevel: 'Department' });
    return {
      version: 1,
      activeView: 'canvas', // canvas|table|kanban|timeline|dashboard
      layers: JSON.parse(JSON.stringify(LAYERS)),
      objects: [sec1, st1, dec1, tsk1, kpi1],
      links: [
        { id: uid('lk'), fromId: 'wb_st_1', toId: 'wb_tsk_1', type: 'depends_on' },
        { id: uid('lk'), fromId: 'wb_dec_1', toId: 'wb_tsk_1', type: 'supports' },
        { id: uid('lk'), fromId: 'wb_tsk_1', toId: 'wb_kpi_1', type: 'supports' }
      ],
      automations: [
        { id: uid('au'), name: 'Notify Team on Completion', enabled: true, trigger: 'Completed', action: 'notify', detail: 'Team notified in activity stream', runs: 1 },
        { id: uid('au'), name: 'Alert Manager on Blocker', enabled: true, trigger: 'Blocked', action: 'escalate', detail: 'Escalated to Department Lead', runs: 0 }
      ],
      activity: [
        { id: uid('ac'), actor: currentUser, text: 'Opened "' + (title || 'Visual Strategy Workspace') + '"', at: new Date().toISOString() }
      ]
    };
  }

  function getObj(id) {
    return (state && state.objects || []).find(function (o) { return o.id === id; }) || null;
  }

  function getLayer(id) {
    return (state && state.layers || []).find(function (l) { return l.id === id; }) || LAYERS[0];
  }

  function isObjVisible(o) {
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

  /* ---------- Mount Clean Progressive-Disclosure Shell ---------- */
  function ensureDom() {
    if (rootEl) return rootEl;
    rootEl = document.createElement('div');
    rootEl.id = 'whiteboard-suite';
    rootEl.className = 'wb-root';
    rootEl.hidden = true;
    rootEl.innerHTML =
      // Unified Single-Row Floating Top Pill (matching QuantalFlow visual language)
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
      // Unified Left Tool Dock: Common Canvas Tools + Whiteboarding Tools
      '<nav class="wb-dock" data-wb-dock aria-label="Whiteboard and canvas tools">' +
        '<button type="button" class="wb-dock__btn" data-wb-tool="select" title="Select (V)" aria-label="Select">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-tool="pan" title="Hand / Pan (H)" aria-label="Hand pan">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-add="sticky" title="Sticky Note (N)" aria-label="Sticky note">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-popover="shapes" title="Shapes (S)" aria-label="Shapes">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-tool="connect" title="Connectors / Knowledge Graph Link (L)" aria-label="Connectors">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2" fill="currentColor"/><path d="M7 6h5v12h5"/><circle cx="19" cy="18" r="2" fill="currentColor"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-add="text" title="Text Box (T)" aria-label="Text">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-add="section" title="Frame / Section (F)" aria-label="Frame or section">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-tool="pen" title="Pen / Freehand Draw (P)" aria-label="Pen draw">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-add="comment" title="Comment Pin (C)" aria-label="Comment pin">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' +
        '</button>' +
        '<div class="wb-dock__sep"></div>' +
        '<button type="button" class="wb-dock__btn" data-wb-popover="cards" title="Whiteboard Smart Cards (Task, KPI, Decision, Doc)" aria-label="Smart cards">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn" data-wb-popover="process" title="Business Process Designer (BPMN, Swimlane, Decision Tree)" aria-label="Business process">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 12 12 22 2 12"/></svg>' +
        '</button>' +
        '<div class="wb-dock__sep"></div>' +
        '<button type="button" class="wb-dock__btn wb-dock__btn--accent" data-wb-add-workspace title="Add Workspace &amp; Templates (+)" aria-label="Add workspace">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
        '</button>' +
        '<button type="button" class="wb-dock__btn wb-dock__btn--danger" data-wb-clear title="Clear Canvas" aria-label="Clear canvas">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>' +
        '</button>' +
      '</nav>' +
      // Popover Menu for Shapes / Pen / Smart Cards / Process Designer
      '<div class="wb-popover" data-wb-popover-box hidden></div>' +
      // Main Stage
      '<div class="wb-stage" data-wb-stage></div>' +
      // Floating Slide-Over Drawer (Inspector / Layers / AI Assistant)
      '<aside class="wb-drawer" data-wb-drawer-box hidden></aside>' +
      // Modal Backdrop (Doc Gen / Presentation / Automations / Org Map)
      '<div class="wb-modal-bd" data-wb-modal hidden><div class="wb-modal" data-wb-modal-box></div></div>';

    (document.querySelector('.quantalflow-app') || document.body).appendChild(rootEl);
    bindEvents();
    return rootEl;
  }

  /* ---------- Render Stage & Active View ---------- */
  function render() {
    if (!rootEl || !state) return;
    rootEl.querySelectorAll('[data-wb-view]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wbView === state.activeView);
    });
    rootEl.querySelectorAll('[data-wb-tool]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wbTool === activeTool);
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

    renderDrawer();
  }

  function renderCanvas(stage) {
    var gridCls = gridMode === 1 ? ' grid-lines' : (gridMode === 2 ? ' grid-clean' : '');
    var gridLabel = gridMode === 0 ? 'Dots' : (gridMode === 1 ? 'Lines' : 'Clean');
    var toolCls = (activeTool === 'pan' ? ' is-pan-tool' : (activeTool === 'pen' ? ' is-pen-tool' : (activeTool === 'connect' ? ' is-connect-tool' : '')));
    stage.innerHTML =
      '<div class="wb-viewport' + toolCls + gridCls + '" data-wb-vp>' +
        '<div class="wb-world" data-wb-world style="transform:translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px) scale(' + zoom + ');">' +
          '<svg class="wb-edges-svg" data-wb-svg></svg>' +
          '<svg class="wb-drawings-svg" data-wb-drawings></svg>' +
          '<div class="wb-guide-x" data-wb-gx></div>' +
          '<div class="wb-guide-y" data-wb-gy></div>' +
        '</div>' +
        '<div class="wb-bottom-left">' +
          '<button type="button" class="wb-pill-btn" data-wb-undo title="Undo (Ctrl+Z)">↶</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-redo title="Redo (Ctrl+Y)">↷</button>' +
          '<span class="wb-divider"></span>' +
          '<button type="button" class="wb-pill-btn" data-wb-grid-mode title="Toggle Grid Style">' + gridLabel + '</button>' +
          '<button type="button" class="wb-pill-btn' + (snapGrid ? ' is-active' : '') + '" data-wb-snap title="Toggle Auto-Grid Snap">Snap</button>' +
          '<span class="wb-divider"></span>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="out">−</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="reset">' + Math.round(zoom * 100) + '%</button>' +
          '<button type="button" class="wb-pill-btn" data-wb-zoom="in">+</button>' +
          '<button type="button" class="wb-pill-btn' + (minimapOpen ? ' is-active' : '') + '" data-wb-minimap-toggle title="Toggle Mini-map">Map</button>' +
        '</div>' +
        '<div class="wb-minimap" data-wb-minimap' + (minimapOpen ? '' : ' hidden') + '></div>' +
      '</div>';

    var world = stage.querySelector('[data-wb-world]');
    var svg = stage.querySelector('[data-wb-svg]');
    var drawingsSvg = stage.querySelector('[data-wb-drawings]');
    var minimap = stage.querySelector('[data-wb-minimap]');
    var visibleObjs = (state.objects || []).filter(isObjVisible);

    // Render Freehand Pen Drawings
    if (drawingsSvg) {
      drawingsSvg.innerHTML = (state.paths || []).map(function (p) {
        return '<path d="' + esc(p.d || '') + '" fill="none" stroke="' + esc(p.stroke || '#1a1a2e') + '" stroke-width="' + (Number(p.strokeWidth) || 4) + '" stroke-linecap="round" stroke-linejoin="round" />';
      }).join('');
    }

    // Draw Knowledge Graph SVG links
    var svgParts = [
      '<defs><marker id="wb-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b"></path></marker></defs>'
    ];
    (state.links || []).forEach(function (lk) {
      var a = getObj(lk.fromId);
      var b = getObj(lk.toId);
      if (!a || !b || !isObjVisible(a) || !isObjVisible(b)) return;
      var rm = RELATIONS.find(function (r) { return r.id === lk.type; }) || RELATIONS[3];
      var x1 = a.x + (a.w || 224) / 2;
      var y1 = a.y + (a.h || 140) / 2;
      var x2 = b.x + (b.w || 224) / 2;
      var y2 = b.y + (b.h || 140) / 2;
      var mx = Math.round((x1 + x2) / 2);
      var my = Math.round((y1 + y2) / 2) - 26;
      svgParts.push(
        '<path d="M ' + x1 + ' ' + y1 + ' Q ' + mx + ' ' + my + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="' + rm.color + '" stroke-width="2" ' +
        (rm.dash ? 'stroke-dasharray="' + rm.dash + '" ' : '') + 'marker-end="url(#wb-arr)" opacity="0.82"/>' +
        '<text x="' + mx + '" y="' + (my + 8) + '" text-anchor="middle" style="font-size:10px;font-weight:700;fill:#334155;paint-order:stroke;stroke:#f6f7fb;stroke-width:3px;">' + esc(rm.label) + '</text>'
      );
    });
    svg.innerHTML = svgParts.join('');

    // Render Objects (sections & swimlanes first so cards sit cleanly on top)
    visibleObjs.slice().sort(function (a, b) {
      var bgA = (a.kind === 'section' || a.kind === 'swimlane') ? 0 : 1;
      var bgB = (b.kind === 'section' || b.kind === 'swimlane') ? 0 : 1;
      return bgA - bgB;
    }).forEach(function (o) {
      var el = document.createElement('div');
      el.className = 'wb-obj wb-obj--' + o.kind + (selectedId === o.id ? ' is-selected' : '');
      el.dataset.objId = o.id;
      el.style.left = Math.round(o.x) + 'px';
      el.style.top = Math.round(o.y) + 'px';
      if (o.kind === 'section' || o.kind === 'swimlane') {
        el.style.width = (o.w || 520) + 'px';
        el.style.height = (o.h || 320) + 'px';
      }
      if (o.kind === 'sticky' || o.kind === 'shape') el.style.setProperty('--wb-bg', o.bg || (o.kind === 'shape' ? '#eef2ff' : '#fef9c3'));
      if (o.kind === 'shape' && o.shapeType) el.dataset.shapeType = o.shapeType;

      var stSlug = STATUS_SLUGS[o.status] || 'idea';
      var extraHtml = '';
      if (o.kind === 'kpi') {
        extraHtml = '<div class="wb-obj__kpi-val">' + esc(o.kpiValue || '0%') + ' <span style="font-size:11px;font-weight:600;color:#64748b;">/ ' + esc(o.kpiTarget || '100%') + '</span></div>';
      } else if (o.kind === 'decision' && o.decision) {
        extraHtml = '<div class="wb-chip" style="margin-bottom:6px;background:#fef3c7;color:#92400e;">' + esc(o.decision.approval || 'Pending') + ' · ' + esc(o.decision.votes || '') + '</div>';
      }

      if (o.kind === 'section' || o.kind === 'swimlane') {
        el.innerHTML = '<div class="wb-obj__top"><div class="wb-obj__title">' + esc(o.title) + '</div><span class="wb-chip">' + esc(o.layer) + '</span></div>';
      } else if (o.kind === 'text') {
        el.innerHTML = '<div class="wb-obj__title">' + esc(o.title || 'Text') + '</div>' + (o.description ? '<div class="wb-obj__desc" style="margin:4px 0 0;">' + esc(o.description) + '</div>' : '');
      } else if (o.kind === 'shape') {
        el.innerHTML = '<div class="wb-obj__title" style="margin:0;">' + esc(o.title || 'Shape') + '</div>' + (o.description ? '<div class="wb-obj__desc" style="margin:4px 0 0;">' + esc(o.description) + '</div>' : '');
      } else if (o.kind === 'comment') {
        el.innerHTML =
          '<div class="wb-obj__top"><span class="wb-obj__kind">Comment</span><span class="wb-chip">' + esc(o.owner || currentUser) + '</span></div>' +
          '<div class="wb-obj__title">' + esc(o.title || 'Comment') + '</div>' +
          (o.description ? '<div class="wb-obj__desc">' + esc(o.description) + '</div>' : '');
      } else {
        el.innerHTML =
          '<div class="wb-obj__top">' +
            '<span class="wb-obj__kind">' + esc(o.kind) + '</span>' +
            '<span class="wb-chip wb-status--' + stSlug + '">' + esc(o.status || 'Idea') + '</span>' +
          '</div>' +
          '<div class="wb-obj__title">' + esc(o.title) + '</div>' +
          extraHtml +
          (o.description ? '<div class="wb-obj__desc">' + esc(o.description) + '</div>' : '') +
          '<div class="wb-obj__meta">' +
            '<span>' + (o.assignee ? '👤 ' + esc(o.assignee) : esc(o.department || '')) + '</span>' +
            '<span>' +
              ((o.attachments && o.attachments.length) ? '📎' + o.attachments.length + ' ' : '') +
              ((o.comments && o.comments.length) ? '💬' + o.comments.length + ' ' : '') +
              (o.dueDate ? '📅 ' + esc(o.dueDate.slice(5)) : '') +
            '</span>' +
          '</div>';
      }
      world.appendChild(el);

      if (minimap && minimapOpen) {
        var dot = document.createElement('div');
        dot.className = 'wb-minimap__dot';
        dot.style.left = Math.max(2, Math.min(158, Math.round(o.x * 0.09))) + 'px';
        dot.style.top = Math.max(2, Math.min(96, Math.round(o.y * 0.09))) + 'px';
        dot.style.width = Math.max(8, Math.round((o.w || 220) * 0.09)) + 'px';
        dot.style.height = Math.max(6, Math.round((o.h || 140) * 0.09)) + 'px';
        minimap.appendChild(dot);
      }
    });

    bindCanvasPointer(stage);
  }

  function bindCanvasPointer(stage) {
    var vp = stage.querySelector('[data-wb-vp]');
    var world = stage.querySelector('[data-wb-world]');
    if (!vp || !world) return;

    vp.addEventListener('mousedown', function (e) {
      if (e.target.closest('.wb-bottom-left, .wb-minimap')) return;
      if (activeTool === 'pen' && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        var rect = vp.getBoundingClientRect();
        var wx = Math.round((e.clientX - rect.left - panX) / zoom);
        var wy = Math.round((e.clientY - rect.top - panY) / zoom);
        isDrawingPen = true;
        penPoints = [[wx, wy]];
        var dSvg = stage.querySelector('[data-wb-drawings]');
        if (dSvg) {
          activePenPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          activePenPathEl.setAttribute('fill', 'none');
          activePenPathEl.setAttribute('stroke', penColor);
          activePenPathEl.setAttribute('stroke-width', String(penWidth));
          activePenPathEl.setAttribute('stroke-linecap', 'round');
          activePenPathEl.setAttribute('stroke-linejoin', 'round');
          activePenPathEl.setAttribute('d', 'M ' + wx + ' ' + wy);
          dSvg.appendChild(activePenPathEl);
        }
        return;
      }
      var card = e.target.closest('.wb-obj');
      if (card && activeTool !== 'pan') {
        e.stopPropagation();
        var id = card.dataset.objId;
        if (activeTool === 'connect') {
          if (!pendingConnectFrom) {
            pendingConnectFrom = id;
            toast('Now click the target object to connect');
          } else if (pendingConnectFrom !== id) {
            state.links.push({ id: uid('lk'), fromId: pendingConnectFrom, toId: id, type: 'depends_on' });
            logAct('Linked objects in Knowledge Graph');
            pendingConnectFrom = null;
            activeTool = 'select';
            render();
            persist();
          }
          return;
        }
        selectedId = id;
        openDrawer = 'inspector';
        renderDrawer();
        stage.querySelectorAll('.wb-obj').forEach(function (n) { n.classList.toggle('is-selected', n.dataset.objId === id); });
        var obj = getObj(id);
        var lyr = obj && getLayer(obj.layer);
        if (!obj || !currentCaps.canEdit || reviewMode || (lyr && lyr.locked)) return;
        dragging = {
          obj: obj, el: card, moved: false,
          ox: (e.clientX - panX) / zoom - obj.x,
          oy: (e.clientY - panY) / zoom - obj.y
        };
        return;
      }
      // Clicked empty canvas: close inspector drawer cleanly & pan
      if (openDrawer === 'inspector') { openDrawer = null; selectedId = null; renderDrawer(); }
      isPanning = true;
      panStartX = e.clientX - panX;
      panStartY = e.clientY - panY;
      vp.classList.add('is-panning');
    });

    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoom = Math.max(0.35, Math.min(1.8, Math.round((zoom + (e.deltaY < 0 ? 0.08 : -0.08)) * 100) / 100));
      } else {
        panX -= e.deltaX;
        panY -= e.deltaY;
      }
      world.style.transform = 'translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px) scale(' + zoom + ')';
      var zb = stage.querySelector('[data-wb-zoom="reset"]');
      if (zb) zb.textContent = Math.round(zoom * 100) + '%';
    }, { passive: false });
  }

  window.addEventListener('mousemove', function (e) {
    if (isDrawingPen && rootEl && !rootEl.hidden) {
      var vpPen = rootEl.querySelector('[data-wb-vp]');
      if (!vpPen) return;
      var rect = vpPen.getBoundingClientRect();
      var wx = Math.round((e.clientX - rect.left - panX) / zoom);
      var wy = Math.round((e.clientY - rect.top - panY) / zoom);
      penPoints.push([wx, wy]);
      if (activePenPathEl) {
        var dStr = 'M ' + penPoints.map(function (pt) { return pt[0] + ' ' + pt[1]; }).join(' L ');
        activePenPathEl.setAttribute('d', dStr);
      }
      return;
    }
    if (dragging) {
      dragging.moved = true;
      var nx = (e.clientX - panX) / zoom - dragging.ox;
      var ny = (e.clientY - panY) / zoom - dragging.oy;
      if (snapGrid) { nx = Math.round(nx / 20) * 20; ny = Math.round(ny / 20) * 20; }

      // Smart Alignment Guides
      var gx = rootEl && rootEl.querySelector('[data-wb-gx]');
      var gy = rootEl && rootEl.querySelector('[data-wb-gy]');
      var snapX = null, snapY = null;
      if (showGuides) {
        (state.objects || []).forEach(function (other) {
          if (other.id === dragging.obj.id || !isObjVisible(other)) return;
          if (Math.abs(other.x - nx) < 10) snapX = other.x;
          if (Math.abs(other.y - ny) < 10) snapY = other.y;
        });
      }
      if (snapX !== null) { nx = snapX; if (gx) { gx.style.left = snapX + 'px'; gx.style.display = 'block'; } }
      else if (gx) gx.style.display = 'none';
      if (snapY !== null) { ny = snapY; if (gy) { gy.style.top = snapY + 'px'; gy.style.display = 'block'; } }
      else if (gy) gy.style.display = 'none';

      dragging.obj.x = Math.round(nx);
      dragging.obj.y = Math.round(ny);
      dragging.el.style.left = dragging.obj.x + 'px';
      dragging.el.style.top = dragging.obj.y + 'px';
      return;
    }
    if (isPanning && rootEl && !rootEl.hidden) {
      panX = e.clientX - panStartX;
      panY = e.clientY - panStartY;
      var w = rootEl.querySelector('[data-wb-world]');
      if (w) w.style.transform = 'translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px) scale(' + zoom + ')';
    }
  });

  window.addEventListener('mouseup', function () {
    if (isDrawingPen) {
      isDrawingPen = false;
      if (penPoints.length > 1 && state) {
        pushHistory();
        if (!Array.isArray(state.paths)) state.paths = [];
        var dFinal = 'M ' + penPoints.map(function (pt) { return pt[0] + ' ' + pt[1]; }).join(' L ');
        state.paths.push({ id: uid('path'), d: dFinal, stroke: penColor, strokeWidth: penWidth });
        persist();
      }
      penPoints = [];
      activePenPathEl = null;
      return;
    }
    if (dragging) {
      var moved = dragging.moved;
      dragging = null;
      var gx = rootEl && rootEl.querySelector('[data-wb-gx]');
      var gy = rootEl && rootEl.querySelector('[data-wb-gy]');
      if (gx) gx.style.display = 'none';
      if (gy) gy.style.display = 'none';
      if (moved) { render(); persist(); }
    }
    if (isPanning) {
      isPanning = false;
      var vp = rootEl && rootEl.querySelector('[data-wb-vp]');
      if (vp) vp.classList.remove('is-panning');
    }
  });

  /* ---------- Synchronized Views: Table, Kanban, Timeline, Dashboard ---------- */
  function contentObjects() {
    return (state.objects || []).filter(function (o) { return o.kind !== 'section' && o.kind !== 'swimlane' && isObjVisible(o); });
  }

  function renderTable(stage) {
    var rows = contentObjects();
    stage.innerHTML = '<div class="wb-alt-view"><div class="wb-table-wrap"><table class="wb-table">' +
      '<thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Priority</th><th>Department</th><th>Assignee</th><th>Due Date</th><th>Layer</th></tr></thead>' +
      '<tbody>' + rows.map(function (o) {
        return '<tr data-wb-pick="' + esc(o.id) + '" style="cursor:pointer;">' +
          '<td><strong>' + esc(o.title) + '</strong></td>' +
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
            '<div style="font-size:13px;font-weight:700;margin-bottom:4px;">' + esc(o.title) + '</div>' +
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
          '<span><span class="wb-chip">' + esc(o.dueDate || 'TBD') + '</span> <strong>' + esc(o.title) + '</strong></span>' +
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

  /* ---------- Progressive Slide-Over Drawer (Inspector / Layers / AI) ---------- */
  function renderDrawer() {
    var box = rootEl && rootEl.querySelector('[data-wb-drawer-box]');
    if (!box) return;
    if (!openDrawer) { box.hidden = true; return; }
    box.hidden = false;

    if (openDrawer === 'layers') {
      box.innerHTML =
        '<div class="wb-drawer__head"><h3>Multi-Layer Workspaces</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:24px;padding:0 7px;">×</button></div>' +
        '<div class="wb-drawer__body">' +
          (state.layers || []).map(function (l) {
            return '<div class="wb-card-row">' +
              '<span style="display:flex;align-items:center;gap:7px;"><i style="width:10px;height:10px;border-radius:50%;background:' + l.color + ';display:inline-block;"></i><strong>' + esc(l.label) + '</strong></span>' +
              '<span style="display:flex;gap:4px;">' +
                '<button type="button" class="wb-btn" data-wb-lyr-vis="' + l.id + '" style="height:24px;padding:0 7px;">' + (l.visible ? '👁' : '🚫') + '</button>' +
                '<button type="button" class="wb-btn" data-wb-lyr-lock="' + l.id + '" style="height:24px;padding:0 7px;">' + (l.locked ? '🔒' : '🔓') + '</button>' +
              '</span>' +
            '</div>';
          }).join('') +
        '</div>';
      return;
    }

    if (openDrawer === 'ai') {
      var cmds = ['Expand idea', 'Generate workflow', 'Generate roadmap', 'Generate SOP', 'Generate project plan', 'Summarise board', 'Find risks', 'Find bottlenecks', 'Generate KPIs', 'Create action plan'];
      if (!aiChat.length) {
        aiChat.push({ role: 'bot', text: 'I can see all ' + contentObjects().length + ' objects on your whiteboard. Pick a command or ask anything.' });
      }
      box.innerHTML =
        '<div class="wb-drawer__head"><h3>✨ AI Whiteboard Assistant</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:24px;padding:0 7px;">×</button></div>' +
        '<div class="wb-drawer__body">' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
            cmds.map(function (c) { return '<button type="button" class="wb-btn" data-wb-ai-cmd="' + esc(c) + '" style="height:24px;font-size:11px;padding:0 8px;">' + esc(c) + '</button>'; }).join('') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;flex:1;">' +
            aiChat.map(function (m, idx) {
              return '<div class="wb-card-row" style="flex-direction:column;align-items:stretch;background:' + (m.role === 'user' ? '#eff6ff' : '#f8fafc') + ';">' +
                '<div style="white-space:pre-wrap;line-height:1.45;">' + esc(m.text) + '</div>' +
                (m.cards ? '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">' + m.cards.map(function (c, ci) {
                  return '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:5px 7px;border-radius:6px;border:1px solid #cbd5e1;"><span>' + esc(c.title) + '</span><button type="button" class="wb-btn wb-btn--primary" data-wb-ai-add="' + idx + ':' + ci + '" style="height:22px;padding:0 7px;font-size:11px;">+ Board</button></div>';
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

    // Smart Object Inspector
    var o = getObj(selectedId);
    if (!o) { box.hidden = true; return; }
    var dis = (currentCaps.canEdit && !reviewMode) ? '' : ' disabled';
    box.innerHTML =
      '<div class="wb-drawer__head"><h3>' + esc(o.kind.toUpperCase()) + ' Properties</h3><button type="button" class="wb-btn" data-wb-close-drawer style="height:24px;padding:0 7px;">×</button></div>' +
      '<div class="wb-drawer__body">' +
        '<div class="wb-field"><label>Title</label><input type="text" data-wb-f="title" value="' + esc(o.title) + '"' + dis + ' /></div>' +
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
        '<div class="wb-grid-2">' +
          '<div class="wb-field"><label>Org Level</label><select data-wb-f="orgLevel"' + dis + '>' + ORG_LEVELS.slice(1).map(function (lv) { return '<option' + (o.orgLevel === lv ? ' selected' : '') + '>' + lv + '</option>'; }).join('') + '</select></div>' +
          '<div class="wb-field"><label>Convert To</label><select data-wb-f="kind"' + dis + '>' + ['sticky', 'task', 'kpi', 'decision', 'doc', 'process', 'diamond'].map(function (k) { return '<option value="' + k + '"' + (o.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        (o.kind === 'sticky' ? '<div style="display:flex;gap:6px;">' + STICKY_COLORS.map(function (c) { return '<button type="button" data-wb-bg="' + c + '" style="width:22px;height:22px;border-radius:50%;border:1px solid #94a3b8;background:' + c + ';cursor:pointer;"></button>'; }).join('') + '</div>' : '') +
        (o.kind === 'kpi' ? '<div class="wb-grid-2"><div class="wb-field"><label>Current Value</label><input type="text" data-wb-f="kpiValue" value="' + esc(o.kpiValue) + '"' + dis + '/></div><div class="wb-field"><label>Target</label><input type="text" data-wb-f="kpiTarget" value="' + esc(o.kpiTarget) + '"' + dis + '/></div></div>' : '') +
        (o.kind === 'decision' ? '<div class="wb-field"><label>Decision Approval &amp; Votes</label><div class="wb-grid-2"><input type="text" data-wb-dec="approval" value="' + esc(o.decision?.approval || '') + '" placeholder="Approved / Pending"/><input type="text" data-wb-dec="votes" value="' + esc(o.decision?.votes || '') + '" placeholder="Vote results"/></div></div>' : '') +
        '<div class="wb-field"><label>Comments (@mentions)</label>' +
          ((o.comments || []).map(function (c) { return '<div class="wb-card-row"><span><strong>' + esc(c.author) + ':</strong> ' + esc(c.text) + '</span></div>'; }).join('') || '<span style="font-size:11.5px;color:#94a3b8;">No comments yet.</span>') +
          '<form data-wb-cmt-form style="display:flex;gap:5px;margin-top:4px;"><input type="text" id="wb-cmt-in" placeholder="Add comment (@name)…"/><button type="submit" class="wb-btn wb-btn--primary">Post</button></form>' +
        '</div>' +
        (currentCaps.canEdit && !reviewMode ? '<div style="display:flex;gap:6px;"><button type="button" class="wb-btn" data-wb-dup>Duplicate</button><button type="button" class="wb-btn wb-btn--danger" data-wb-del>Delete</button></div>' : '') +
      '</div>';
  }

  /* ---------- Generators: Document, Presentation, Automations, Org Map ---------- */
  function openModal(title, body, foot) {
    var bd = rootEl.querySelector('[data-wb-modal]');
    var box = rootEl.querySelector('[data-wb-modal-box]');
    box.innerHTML =
      '<div class="wb-modal__head"><h3>' + esc(title) + '</h3><button type="button" class="wb-btn" data-wb-modal-close style="height:24px;padding:0 7px;">×</button></div>' +
      '<div class="wb-modal__body">' + body + '</div>' +
      (foot ? '<div class="wb-modal__foot">' + foot + '</div>' : '');
    bd.hidden = false;
  }

  function openDocGenerator() {
    var items = contentObjects();
    function buildDoc(docType) {
      return '<h1>' + esc(boardTitle) + ' — ' + esc(docType) + '</h1>' +
        '<p><em>Generated from QuantalFlow Whiteboarding (' + items.length + ' smart objects)</em></p>' +
        '<h2>Executive Summary</h2><p>This ' + esc(docType.toLowerCase()) + ' synthesizes active strategy items, tasks, KPIs, and decisions captured on the visual workspace.</p>' +
        '<h2>Key Items &amp; Action Plan</h2><ul>' +
        items.map(function (o) {
          return '<li><strong>' + esc(o.title) + '</strong> (' + esc(o.status) + (o.assignee ? ' · ' + esc(o.assignee) : '') + '): ' + esc(o.description || 'In progress') + '</li>';
        }).join('') + '</ul>' +
        '<h2>Decisions &amp; Risks</h2><ul>' +
        items.filter(function (o) { return o.kind === 'decision' || o.status === 'Blocked'; }).map(function (o) {
          return '<li><strong>' + esc(o.title) + ':</strong> ' + esc(o.decision?.summary || o.description || o.status) + '</li>';
        }).join('') + '</ul>';
    }
    var docTypes = ['Meeting Minutes', 'Executive Report', 'Business Plan', 'SOP', 'Project Charter', 'Research Brief', 'Strategic Plan'];
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
      { title: boardTitle, bullets: ['Visual Strategy & Execution Deck', items.length + ' smart items synthesized from whiteboard', 'Live status & decisions included'], notes: 'Welcome everyone. This deck was auto-generated directly from our live QuantalFlow whiteboard.' },
      { title: 'Agenda & Focus Areas', bullets: ['Executive Overview & KPIs', 'Active Workstreams & Owners', 'Key Decisions & Next Steps'], notes: 'Walk through the core agenda in 10 minutes, then confirm next-week owners.' },
      { title: 'Active Workstreams', bullets: items.slice(0, 5).map(function (o) { return o.title + ' — ' + o.status + (o.assignee ? ' (' + o.assignee + ')' : ''); }), notes: 'Highlight progress across active tasks and call out any blockers.' },
      { title: 'Decisions & Next Steps', bullets: items.filter(function (o) { return o.kind === 'decision' || o.kind === 'kpi'; }).map(function (o) { return o.title + ': ' + (o.kpiValue || o.decision?.approval || o.status); }), notes: 'Confirm approvals and align on target KPIs before closing.' }
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
      '<p style="margin:0;font-size:13px;color:#475569;">Filter your whiteboard seamlessly across organisational levels:</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
        ORG_LEVELS.map(function (lv) {
          return '<button type="button" class="wb-btn' + (orgLevelFilter === lv ? ' wb-btn--primary' : '') + '" data-wb-org-set="' + lv + '">' + lv + '</button>';
        }).join('') +
      '</div>',
      '<button type="button" class="wb-btn" data-wb-modal-close>Done</button>'
    );
    rootEl.querySelectorAll('[data-wb-org-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        orgLevelFilter = b.dataset.wbOrgSet;
        render();
        openOrgModal();
      });
    });
  }

  function runAiCommand(prompt) {
    aiChat.push({ role: 'user', text: prompt });
    var items = contentObjects();
    var lower = prompt.toLowerCase();
    var replyText = 'Analyzed ' + items.length + ' whiteboard objects for "' + prompt + '". Suggested additions:';
    var cards = [
      { kind: 'task', title: 'Action: ' + prompt, description: 'Generated by QuantalFlow AI Assistant.', status: 'Planned', layer: 'ai' },
      { kind: 'kpi', title: 'Success Metric', kpiValue: '0%', kpiTarget: '90%', description: 'Track outcome for ' + prompt, status: 'Planned', layer: 'ai' }
    ];
    if (lower.indexOf('risk') !== -1 || lower.indexOf('bottleneck') !== -1) {
      var blk = items.filter(function (o) { return o.status === 'Blocked'; });
      replyText = blk.length ? 'Found ' + blk.length + ' blocked item(s): ' + blk.map(function (b) { return b.title; }).join(', ') : 'No blocked items right now. Add a risk checkpoint to protect delivery.';
      cards = [{ kind: 'sticky', bg: '#fce7f3', title: 'Risk Mitigation Checkpoint', description: 'Review dependencies and unblock owners early.', status: 'Planned', layer: 'ai' }];
    } else if (lower.indexOf('summaris') !== -1) {
      replyText = 'Board Summary: ' + items.length + ' items (' + items.filter(function (o) { return o.status === 'Completed'; }).length + ' completed, ' + items.filter(function (o) { return o.status === 'In Progress'; }).length + ' in progress).';
      cards = null;
    } else if (lower.indexOf('workflow') !== -1 || lower.indexOf('sop') !== -1) {
      cards = [
        { kind: 'process', title: '1. Intake & Triage', description: 'Capture request and validate scope.', status: 'Planned', layer: 'operations' },
        { kind: 'diamond', title: 'Approved?', description: 'Stakeholder decision gate.', status: 'Review', layer: 'operations' },
        { kind: 'process', title: '2. Execute & QA', description: 'Deliver and verify quality.', status: 'Planned', layer: 'operations' }
      ];
    }
    aiChat.push({ role: 'bot', text: replyText, cards: cards });
    renderDrawer();
  }

  function addObjectToCenter(kind, extra) {
    if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
    pushHistory();
    var cx = Math.round((-panX + 380) / zoom);
    var cy = Math.round((-panY + 220) / zoom);
    var obj = makeObj(Object.assign({ kind: kind, x: cx, y: cy }, extra || {}));
    if (kind === 'section') { obj.w = 500; obj.h = 320; obj.title = 'New Frame / Section'; }
    if (kind === 'swimlane') { obj.w = 640; obj.h = 200; obj.title = 'Operations Swimlane'; obj.layer = 'operations'; }
    if (kind === 'kpi') { obj.title = 'New KPI Card'; }
    if (kind === 'decision') { obj.title = 'New Decision Card'; }
    if (kind === 'task') { obj.title = 'New Tracked Task'; obj.status = 'Planned'; }
    if (kind === 'doc') { obj.title = 'Document Brief'; obj.layer = 'documentation'; }
    if (kind === 'process') { obj.title = 'Process Step'; obj.layer = 'operations'; }
    if (kind === 'diamond') { obj.title = 'Decision Gate?'; obj.layer = 'operations'; }
    if (kind === 'shape') {
      obj.shapeType = (extra && extra.shapeType) || 'rect';
      obj.bg = (extra && extra.bg) || '#eef2ff';
      obj.w = obj.shapeType === 'circle' ? 132 : 170;
      obj.h = obj.shapeType === 'circle' ? 132 : 84;
      obj.title = (extra && extra.title) || (obj.shapeType === 'diamond' ? 'Decision?' : obj.shapeType === 'cylinder' ? 'Data Store' : 'Shape');
    }
    if (kind === 'text') { obj.w = 220; obj.h = 56; obj.title = 'Heading or Note'; obj.description = ''; }
    if (kind === 'comment') { obj.w = 220; obj.h = 96; obj.title = 'Feedback Note'; obj.description = 'Add a comment for the team…'; }
    state.objects.push(obj);
    selectedId = obj.id;
    openDrawer = 'inspector';
    logAct('Added ' + kind + ' "' + obj.title + '"');
    render();
    persist();
  }

  function showDockPopover(kind) {
    var box = rootEl.querySelector('[data-wb-popover-box]');
    if (!box) return;
    if (dockPopover === kind) { dockPopover = null; box.hidden = true; return; }
    dockPopover = kind;
    box.hidden = false;
    if (kind === 'shapes') {
      box.innerHTML =
        '<div class="wb-popover__head">Shapes</div>' +
        '<button type="button" class="wb-popover__item" data-wb-add-shape="rect"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/></svg> Rectangle</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add-shape="round"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="6"/></svg> Rounded Pill</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add-shape="circle"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg> Circle Node</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add-shape="diamond"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 12 12 22 2 12"/></svg> Decision Diamond</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add-shape="cylinder"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/></svg> Database Cylinder</button>';
    } else if (kind === 'pen') {
      box.innerHTML =
        '<div class="wb-popover__head">Pen &amp; Freehand Draw</div>' +
        '<div class="wb-popover__swatches">' +
          PEN_COLORS.map(function (c) {
            return '<button type="button" class="wb-swatch-btn' + (penColor === c ? ' is-selected' : '') + '" data-wb-pen-color="' + c + '" style="background:' + c + ';" title="' + c + '"></button>';
          }).join('') +
        '</div>' +
        '<div style="padding:4px 8px 6px;display:flex;gap:6px;">' +
          [2, 4, 8].map(function (w) {
            return '<button type="button" class="wb-btn' + (penWidth === w ? ' wb-btn--primary' : '') + '" data-wb-pen-width="' + w + '" style="flex:1;height:26px;font-size:11px;">' + (w === 2 ? 'Thin' : w === 4 ? 'Medium' : 'Marker') + '</button>';
          }).join('') +
        '</div>';
    } else if (kind === 'cards') {
      box.innerHTML =
        '<div class="wb-popover__head">Smart Cards</div>' +
        '<button type="button" class="wb-popover__item" data-wb-add="task"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg> Task Card</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add="kpi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#059669" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg> KPI Card</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add="decision"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#b45309" stroke-width="2"><path d="M12 3v18M5 8h14M7 16h10"/></svg> Decision Card</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add="doc"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0284c7" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg> Document Card</button>';
    } else if (kind === 'process') {
      box.innerHTML =
        '<div class="wb-popover__head">Business Process Designer</div>' +
        '<button type="button" class="wb-popover__item" data-wb-add="process"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0d9488" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/></svg> Process / BPMN Step</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add="diamond"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#d97706" stroke-width="2"><polygon points="12 2 22 12 12 22 2 12"/></svg> Decision Diamond</button>' +
        '<button type="button" class="wb-popover__item" data-wb-add="swimlane"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0d9488" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18"/></svg> Swimlane Container</button>' +
        '<button type="button" class="wb-popover__item" data-wb-validate-flow><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#4262ff" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg> Validate Workflow Logic</button>';
    }
  }

  /* ---------- Delegated Event Binding ---------- */
  function bindEvents() {
    rootEl.addEventListener('click', function (e) {
      var vBtn = e.target.closest('[data-wb-view]');
      if (vBtn) { state.activeView = vBtn.dataset.wbView; render(); persist(); return; }

      var tBtn = e.target.closest('[data-wb-tool]');
      if (tBtn) {
        var nextTool = tBtn.dataset.wbTool;
        activeTool = nextTool;
        pendingConnectFrom = null;
        if (nextTool === 'pen') {
          showDockPopover('pen');
        } else {
          dockPopover = null;
          rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        }
        
        // Update the cursor and UI state immediately
        var vp = rootEl.querySelector('[data-wb-vp]');
        if (vp) {
            vp.classList.remove('is-pan-tool', 'is-pen-tool');
            if (activeTool === 'pan') vp.classList.add('is-pan-tool');
            else if (activeTool === 'pen') vp.classList.add('is-pen-tool');
        }
        
        render();
        return;
      }

      var popBtn = e.target.closest('[data-wb-popover]');
      if (popBtn) { showDockPopover(popBtn.dataset.wbPopover); return; }

      var shapeBtn = e.target.closest('[data-wb-add-shape]');
      if (shapeBtn) {
        dockPopover = null;
        rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        addObjectToCenter('shape', { shapeType: shapeBtn.dataset.wbAddShape });
        return;
      }

      var penColBtn = e.target.closest('[data-wb-pen-color]');
      if (penColBtn) {
        penColor = penColBtn.dataset.wbPenColor;
        dockPopover = null;
        showDockPopover('pen');
        return;
      }

      var penWidBtn = e.target.closest('[data-wb-pen-width]');
      if (penWidBtn) {
        penWidth = Number(penWidBtn.dataset.wbPenWidth) || 4;
        dockPopover = null;
        showDockPopover('pen');
        return;
      }

      if (e.target.closest('[data-wb-add-workspace]')) {
        if (window.QuantalFlowApp && typeof window.QuantalFlowApp.openAddWorkspaceModal === 'function') {
          window.QuantalFlowApp.openAddWorkspaceModal();
        }
        return;
      }

      if (e.target.closest('[data-wb-clear]')) {
        if (!currentCaps.canEdit || reviewMode) { toast('Board is in read-only / review mode'); return; }
        if (confirm('Clear all items and drawings from this whiteboard? (You can Undo with Ctrl+Z)')) {
          pushHistory();
          state.objects = [];
          state.links = [];
          state.paths = [];
          selectedId = null;
          openDrawer = null;
          render();
          persist();
          toast('Whiteboard cleared');
        }
        return;
      }

      if (e.target.closest('[data-wb-undo]')) { undo(); return; }
      if (e.target.closest('[data-wb-redo]')) { redo(); return; }
      if (e.target.closest('[data-wb-grid-mode]')) {
        gridMode = (gridMode + 1) % 3;
        render();
        toast(gridMode === 0 ? 'Dot Grid' : gridMode === 1 ? 'Line Grid' : 'Clean Canvas');
        return;
      }

      var addBtn = e.target.closest('[data-wb-add]');
      if (addBtn) { dockPopover = null; rootEl.querySelector('[data-wb-popover-box]').hidden = true; addObjectToCenter(addBtn.dataset.wbAdd); return; }

      if (e.target.closest('[data-wb-validate-flow]')) {
        dockPopover = null; rootEl.querySelector('[data-wb-popover-box]').hidden = true;
        var procs = (state.objects || []).filter(function (o) { return o.kind === 'process' || o.kind === 'diamond'; });
        toast(procs.length ? 'Workflow validated: ' + procs.length + ' process steps, ' + (state.links || []).length + ' connections.' : 'Add Process or Decision blocks first to validate workflow logic.');
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
        toast(reviewMode ? 'Review Mode ON (canvas locked, comments enabled)' : 'Review Mode OFF (collaborative editing active)');
        renderDrawer();
        return;
      }
      if (e.target.closest('[data-wb-huddle]')) {
        toast('🎙 Voice & Video Huddle ready — share the board link to invite teammates live');
        return;
      }
      if (e.target.closest('[data-wb-snap]')) { snapGrid = !snapGrid; render(); return; }
      if (e.target.closest('[data-wb-minimap-toggle]')) { minimapOpen = !minimapOpen; render(); return; }

      var zBtn = e.target.closest('[data-wb-zoom]');
      if (zBtn) {
        var a = zBtn.dataset.wbZoom;
        if (a === 'in') zoom = Math.min(1.8, Math.round((zoom + 0.1) * 100) / 100);
        else if (a === 'out') zoom = Math.max(0.35, Math.round((zoom - 0.1) * 100) / 100);
        else { zoom = 0.95; panX = 110; panY = 90; }
        render();
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
        var card = aiChat[Number(pts[0])]?.cards?.[Number(pts[1])];
        if (card) { addObjectToCenter(card.kind || 'sticky', card); aiAdd.disabled = true; aiAdd.textContent = 'Added ✓'; }
        return;
      }

      var pick = e.target.closest('[data-wb-pick]');
      if (pick && !e.target.closest('select')) { selectedId = pick.dataset.wbPick; openDrawer = 'inspector'; renderDrawer(); return; }

      var bgBtn = e.target.closest('[data-wb-bg]');
      if (bgBtn) { var o = getObj(selectedId); if (o) { o.bg = bgBtn.dataset.wbBg; render(); persist(); } return; }
      if (e.target.closest('[data-wb-dup]')) {
        var orig = getObj(selectedId);
        if (orig) { var cp = JSON.parse(JSON.stringify(orig)); cp.id = uid('wb'); cp.x += 36; cp.y += 36; state.objects.push(cp); selectedId = cp.id; render(); persist(); }
        return;
      }
      if (e.target.closest('[data-wb-del]')) {
        state.objects = state.objects.filter(function (x) { return x.id !== selectedId; });
        state.links = state.links.filter(function (x) { return x.fromId !== selectedId && x.toId !== selectedId; });
        selectedId = null; openDrawer = null; render(); persist();
      }
    });

    rootEl.addEventListener('input', function (e) {
      var o = getObj(selectedId);
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

    rootEl.addEventListener('change', function (e) {
      var qs = e.target.closest('[data-wb-qstatus]');
      if (qs && currentCaps.canEdit && !reviewMode) {
        var o = getObj(qs.dataset.wbQstatus);
        if (o) { o.status = qs.value; triggerAutomations(o, o.status); render(); persist(); }
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
        var o = getObj(selectedId);
        var ci = document.getElementById('wb-cmt-in');
        var txt = (ci && ci.value || '').trim();
        if (o && txt) {
          if (!Array.isArray(o.comments)) o.comments = [];
          o.comments.push({ id: uid('c'), author: currentUser, text: txt, at: new Date().toISOString() });
          logAct('Commented on "' + o.title + '"');
          render();
          persist();
        }
      }
    });

    window.addEventListener('keydown', function (e) {
      if (!rootEl || rootEl.hidden) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;

      if (e.key === 'Escape') {
        dockPopover = null;
        var pb = rootEl.querySelector('[data-wb-popover-box]');
        if (pb) pb.hidden = true;
        var md = rootEl.querySelector('[data-wb-modal]');
        if (md && !md.hidden) { md.hidden = true; return; }
        activeTool = 'select';
        pendingConnectFrom = null;
        selectedId = null;
        openDrawer = null;
        render();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault();
        var orig = getObj(selectedId);
        if (orig) { pushHistory(); var cp = JSON.parse(JSON.stringify(orig)); cp.id = uid('wb'); cp.x += 36; cp.y += 36; state.objects.push(cp); selectedId = cp.id; render(); persist(); }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && currentCaps.canEdit && !reviewMode) {
        e.preventDefault();
        pushHistory();
        state.objects = state.objects.filter(function (x) { return x.id !== selectedId; });
        state.links = state.links.filter(function (x) { return x.fromId !== selectedId && x.toId !== selectedId; });
        selectedId = null; openDrawer = null; render(); persist();
        return;
      }
      var k = e.key.toLowerCase();
      if (k === 'v') { activeTool = 'select'; render(); }
      else if (k === 'h') { activeTool = 'pan'; render(); }
      else if (k === 'n') { addObjectToCenter('sticky'); }
      else if (k === 's') { showDockPopover('shapes'); }
      else if (k === 'l') { activeTool = 'connect'; pendingConnectFrom = null; render(); }
      else if (k === 't') { addObjectToCenter('text'); }
      else if (k === 'f') { addObjectToCenter('section'); }
      else if (k === 'p') { activeTool = 'pen'; showDockPopover('pen'); render(); }
      else if (k === 'c') { addObjectToCenter('comment'); }
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
      selectedId = null;
      openDrawer = null;
      rootEl.hidden = false;
      render();
    },
    close: function () { if (rootEl) rootEl.hidden = true; },
    isOpen: function () { return Boolean(rootEl && !rootEl.hidden); },
    getState: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
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
