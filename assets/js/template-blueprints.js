/* ==========================================================================
   QuantalFlow Unified Template Blueprint Engine (`/assets/js/template-blueprints.js`)
   Single source of truth for:
   1. Card thumbnails & Preview modals on `/resources/templates/` and `/dashboard/`
   2. `WhiteboardSuite` (`module=whiteboard`) objects & connector links
   3. `QuantalFlowApp` Canvas (`mindmap`, `kanban`, `perspective`, `brainstorm`) items & connectors
   4. `ProjectPlanningSuite` (`module=project-planning`) WBS, Gantt, Calendar & Table plans
   5. `Documents` (`/dashboard/documents/`) structured HTML templates
   ========================================================================== */
(function () {
  'use strict';

  var COLOR_MAP = {
    blue:   { hex: '#2563eb', fill: '#dbeafe', soft: '#eff6ff', wbSticky: '#dbeafe', app: 'blue' },
    teal:   { hex: '#0d9488', fill: '#ccfbf1', soft: '#f0fdfa', wbSticky: '#dcfce7', app: 'mint' },
    mint:   { hex: '#059669', fill: '#dcfce7', soft: '#ecfdf5', wbSticky: '#dcfce7', app: 'mint' },
    green:  { hex: '#16a34a', fill: '#dcfce7', soft: '#f0fdf4', wbSticky: '#dcfce7', app: 'mint' },
    violet: { hex: '#7c3aed', fill: '#f3e8ff', soft: '#faf5ff', wbSticky: '#f3e8ff', app: 'violet' },
    indigo: { hex: '#4f46e5', fill: '#eef2ff', soft: '#eef2ff', wbSticky: '#dbeafe', app: 'blue' },
    amber:  { hex: '#d97706', fill: '#fef3c7', soft: '#fffbeb', wbSticky: '#fef9c3', app: 'yellow' },
    yellow: { hex: '#ca8a04', fill: '#fef9c3', soft: '#fefce8', wbSticky: '#fef9c3', app: 'yellow' },
    orange: { hex: '#ea580c', fill: '#ffedd5', soft: '#fff7ed', wbSticky: '#ffedd5', app: 'orange' },
    pink:   { hex: '#db2777', fill: '#fce7f3', soft: '#fdf2f8', wbSticky: '#fce7f3', app: 'pink' },
    red:    { hex: '#e5484d', fill: '#fee2e2', soft: '#fef2f2', wbSticky: '#fce7f3', app: 'pink' },
    slate:  { hex: '#475569', fill: '#f1f5f9', soft: '#f8fafc', wbSticky: '#dbeafe', app: 'white' },
    white:  { hex: '#334155', fill: '#ffffff', soft: '#f8fafc', wbSticky: '#fef9c3', app: 'white' }
  };

  function resolveTone(input) {
    if (!input) return COLOR_MAP.blue;
    var s = String(input).toLowerCase();
    if (COLOR_MAP[s]) return COLOR_MAP[s];
    if (s.indexOf('0d9488') !== -1 || s.indexOf('0891b2') !== -1 || s.indexOf('0e7490') !== -1) return COLOR_MAP.teal;
    if (s.indexOf('16a34a') !== -1 || s.indexOf('15803d') !== -1 || s.indexOf('059669') !== -1) return COLOR_MAP.green;
    if (s.indexOf('7c3aed') !== -1) return COLOR_MAP.violet;
    if (s.indexOf('4f46e5') !== -1 || s.indexOf('4338ca') !== -1) return COLOR_MAP.indigo;
    if (s.indexOf('d97706') !== -1 || s.indexOf('a16207') !== -1) return COLOR_MAP.amber;
    if (s.indexOf('db2777') !== -1 || s.indexOf('be185d') !== -1) return COLOR_MAP.pink;
    if (s.indexOf('e5484d') !== -1 || s.indexOf('dc2626') !== -1) return COLOR_MAP.red;
    if (s.indexOf('475569') !== -1 || s.indexOf('57534e') !== -1) return COLOR_MAP.slate;
    return COLOR_MAP.blue;
  }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function stripHtml(str) {
    return String(str == null ? '' : str).replace(/<[^>]*>/g, '').trim();
  }

  function resolveModule(tpl) {
    var type = String((tpl && tpl.type) || '').toLowerCase();
    var mod = String((tpl && tpl.module) || '').toLowerCase();
    if (mod && ['whiteboard', 'project-planning', 'mindmap', 'kanban', 'perspective', 'brainstorm', 'documents'].indexOf(mod) !== -1) {
      return mod;
    }
    if (type === 'document') return 'documents';
    if (type === 'project plan' || type === 'project-planning') return 'project-planning';
    if (type === 'mind map' || type === 'mindmap') return 'mindmap';
    if (type === 'kanban') return 'kanban';
    if (type === 'perspective') return 'perspective';
    if (type === 'brainstorm') return 'brainstorm';
    return 'whiteboard';
  }

  function inferKind(tpl) {
    if (tpl && tpl.kind) return tpl.kind;
    var id = String((tpl && tpl.id) || '').toLowerCase();
    if (id.indexOf('edraw') !== -1 || id.indexOf('mm-') === 0 || id.indexOf('mind') !== -1 || id === 'brainstorm' || id === 'study-map' || id === 'concept-map') return 'mind';
    if (id === 'wb-process-bpmn' || id.indexOf('swim') !== -1 || id === 'support-flow' || id === 'procurement' || id === 'order-fulfilment' || id === 'recruitment-flow' || id === 'invoice-process') return 'swim';
    if (id === 'wb-org-twin' || id.indexOf('org') !== -1 || id === 'mm-architecture' || id === 'wbs' || id === 'team-structure' || id === 'strategy-map' || id === 'goal-cascade' || id === 'decision-tree' || id === 'sitemap' || id === 'family-tree') return 'org';
    if (id.indexOf('kb-') === 0 || id === 'bs-retro' || id === 'retro' || id === 'standup' || id === 'sprint-board' || id === 'sales-pipeline' || id === 'start-stop-continue' || id === 'backlog' || id === 'issue-tracker') return 'kanban';
    if (id === 'ps-swot' || id.indexOf('swot') !== -1) return 'swot';
    if (id.indexOf('fish') !== -1 || id === 'incident') return 'fish';
    if (id.indexOf('funnel') !== -1 || id === 'recruit-pipeline' || id === 'fundraising-plan') return 'funnel';
    if (id.indexOf('wire') !== -1 || id === 'design-system') return 'wire';
    if (id.indexOf('calendar') !== -1 || id === 'timetable' || id === 'leave-tracker' || id === 'shift-roster' || id === 'exam-schedule' || id === 'revision-planner' || id === 'ward-roster') return 'cal';
    if (id === 'erd' || id === 'db-schema') return 'erd';
    if (id.indexOf('uml') !== -1) return 'uml';
    if (id.indexOf('seq') !== -1) return 'seq';
    if (id.indexOf('floor') !== -1 || id === 'seating-plan') return 'floor';
    if (id.indexOf('persona') !== -1) return 'persona';
    if (id === 'pdca' || id === 'dmaic' || id === 'referral-program' || id.indexOf('cycle') !== -1) return 'cycle';
    if (id === 'pitch-outline' || id === 'north-star' || id === 'competency-framework' || id === 'blooms' || id.indexOf('pyramid') !== -1) return 'pyramid';
    if (id === 'advantage-map' || id.indexOf('venn') !== -1 || id.indexOf('bubble') !== -1 || id.indexOf('onion') !== -1) return 'venn';
    if (id.indexOf('network') !== -1 || id === 'dependency-map' || id === 'cloud-architecture') return 'network';
    if (id.indexOf('check') !== -1 || id === 'seo-plan' || id === 'dev-onboarding' || id.indexOf('brain-dump') !== -1) return 'check';
    if (id.indexOf('table') !== -1 || id === 'competitor-compare' || id === 'budget-tracker') return 'table';
    if (id.indexOf('kpi') !== -1 || id === 'burndown' || id === 'blue-ocean' || id === 'break-even' || id.indexOf('chart') !== -1) return 'chart';
    if (id.indexOf('ps-') === 0 || id.indexOf('matrix') !== -1 || id === 'pestel' || id === 'raci' || id === 'ansoff' || id === 'rose-bud-thorn' || id === 'four-ls' || id === 'stakeholder-map') return 'matrix';
    if (id === 'bs-journey' || id.indexOf('journey') !== -1 || id.indexOf('roadmap') !== -1 || id === 'three-horizons' || id === 'workshop') return 'timeline';
    if (id.indexOf('pp-') === 0 || id === 'project-plan' || id === 'onboarding' || id === 'resource-plan' || id === 'training-plan') return 'gantt';
    return 'flow';
  }

  function findEdraw(id) {
    if (!id || !Array.isArray(window.QFEdrawMindMapTemplates)) return null;
    for (var i = 0; i < window.QFEdrawMindMapTemplates.length; i++) {
      if (window.QFEdrawMindMapTemplates[i].id === id) return window.QFEdrawMindMapTemplates[i];
    }
    return null;
  }

  /* ---------- Canonical Scene Graph Builder ---------- */
  function compile(rawTpl) {
    var tpl = rawTpl || {};
    var id = String(tpl.id || 'template').toLowerCase();
    var title = String(tpl.title || tpl.label || tpl.defaultTitle || 'Workspace Template').trim();
    var desc = String(tpl.desc || tpl.blurb || '').trim();
    var cat = String(tpl.cat || tpl.category || 'Strategy').trim();
    var mod = resolveModule(tpl);
    var kind = inferKind(tpl);
    var tone = resolveTone(tpl.color);

    var frames = []; // { id, kind:'section'|'swimlane', x, y, w, h, title, bg, stroke }
    var nodes = [];  // { id, role:'sticky'|'shape'|'flowchart'|'text'|'kpi'|'task'|'decision', shapeType, x, y, w, h, title, sub, tone, filled }
    var tables = []; // { id, x, y, w, h, rows: [[...]] }
    var edges = [];  // { id, fromId, toId, label, routing, color }
    var summary = [];

    var ox = 120;
    var oy = 100;

    function addFrame(fid, x, y, w, h, fTitle, fBg, isSwimlane) {
      frames.push({
        id: fid,
        kind: isSwimlane ? 'swimlane' : 'section',
        x: x, y: y, w: w, h: h,
        title: fTitle,
        bg: fBg || 'rgba(248,250,252,0.82)'
      });
    }

    function addNode(nid, role, shapeType, x, y, w, h, nTitle, toneKey, filled, extra) {
      var t = resolveTone(toneKey || tpl.color);
      nodes.push(Object.assign({
        id: nid,
        role: role || 'shape',
        shapeType: shapeType || 'round',
        x: x, y: y, w: w, h: h,
        title: nTitle,
        tone: t,
        filled: Boolean(filled)
      }, extra || {}));
    }

    function addEdge(fromId, toId, label, routing, colorHex) {
      edges.push({
        id: 'edge-' + (edges.length + 1),
        fromId: fromId,
        toId: toId,
        label: label || '',
        routing: routing || 'elbow',
        color: colorHex || tone.hex
      });
    }

    // 1. EdrawMax Mind Map exact node + connector graph
    var edraw = findEdraw(tpl.edrawId || id);
    if (edraw && Array.isArray(edraw.nodes) && edraw.nodes.length) {
      var ew = Math.max(960, Number(edraw.width) || 1100) + 100;
      var eh = Math.max(540, Number(edraw.height) || 640) + 100;
      addFrame('fr-main', ox - 50, oy - 50, ew, eh, title);
      edraw.nodes.forEach(function (n) {
        var nw = Number(n.w) || 156;
        addNode(
          n.id,
          'shape',
          n.shapeType || 'round',
          ox + (Number(n.x) || 0),
          oy + (Number(n.y) || 0),
          nw,
          n.isRoot ? 56 : 44,
          n.text || title,
          n.color || (n.isRoot ? tpl.color : 'white'),
          Boolean(n.isRoot)
        );
      });
      (edraw.connectors || []).forEach(function (c) {
        addEdge(c.fromId, c.toId, '', 'curved', tone.hex);
      });
      summary = [
        edraw.nodes.length + ' positioned mind map topic nodes',
        (edraw.connectors || []).length + ' pre-wired branch connectors',
        'Outer presentation frame ready to expand with Tab'
      ];
      return finalizeBlueprint();
    }

    // 2. Named Domain Frameworks (Lean Canvas, Business Model Canvas, Value Prop, SIPOC, 5 Forces, Strategy Hub)
    if (id === 'lean-canvas' || id === 'business-model') {
      var isLean = id === 'lean-canvas';
      var blocks = isLean
        ? [
            { id: 'b1', t: '1. Problem', note: 'Top 3 customer problems', x: 0, y: 0, w: 210, h: 320, c: 'red' },
            { id: 'b2', t: '4. Solution', note: 'Top 3 core features', x: 220, y: 0, w: 210, h: 155, c: 'blue' },
            { id: 'b3', t: '8. Key Metrics', note: 'Activation & retention KPIs', x: 220, y: 165, w: 210, h: 155, c: 'teal' },
            { id: 'b4', t: '3. Unique Value Prop', note: 'Single clear compelling message', x: 440, y: 0, w: 220, h: 320, c: 'violet' },
            { id: 'b5', t: '9. Unfair Advantage', note: 'Moat that cannot be easily copied', x: 670, y: 0, w: 210, h: 155, c: 'amber' },
            { id: 'b6', t: '5. Channels', note: 'Path to target customers', x: 670, y: 165, w: 210, h: 155, c: 'green' },
            { id: 'b7', t: '2. Customer Segments', note: 'Target users & early adopters', x: 890, y: 0, w: 210, h: 320, c: 'blue' },
            { id: 'b8', t: '7. Cost Structure', note: 'Hosting, people & acquisition costs', x: 0, y: 332, w: 545, h: 155, c: 'orange' },
            { id: 'b9', t: '6. Revenue Streams', note: 'Pricing model, LTV & margins', x: 555, y: 332, w: 545, h: 155, c: 'mint' }
          ]
        : [
            { id: 'b1', t: 'Key Partners', note: 'Strategic suppliers & alliances', x: 0, y: 0, w: 210, h: 320, c: 'slate' },
            { id: 'b2', t: 'Key Activities', note: 'Core operational activities', x: 220, y: 0, w: 210, h: 155, c: 'blue' },
            { id: 'b3', t: 'Key Resources', note: 'Team, IP & infrastructure', x: 220, y: 165, w: 210, h: 155, c: 'teal' },
            { id: 'b4', t: 'Value Propositions', note: 'Why customers choose us', x: 440, y: 0, w: 220, h: 320, c: 'violet' },
            { id: 'b5', t: 'Customer Relationships', note: 'Self-serve, dedicated & community', x: 670, y: 0, w: 210, h: 155, c: 'pink' },
            { id: 'b6', t: 'Channels', note: 'Distribution & sales touchpoints', x: 670, y: 165, w: 210, h: 155, c: 'amber' },
            { id: 'b7', t: 'Customer Segments', note: 'Core buyer & user personas', x: 890, y: 0, w: 210, h: 320, c: 'green' },
            { id: 'b8', t: 'Cost Structure', note: 'Fixed & variable cost drivers', x: 0, y: 332, w: 545, h: 155, c: 'orange' },
            { id: 'b9', t: 'Revenue Streams', note: 'Recurring subscriptions & services', x: 555, y: 332, w: 545, h: 155, c: 'mint' }
          ];
      blocks.forEach(function (b) {
        var bt = resolveTone(b.c);
        addFrame('fr-' + b.id, ox + b.x, oy + b.y, b.w, b.h, b.t, bt.soft);
        addNode('nd-' + b.id, 'sticky', 'rect', ox + b.x + 16, oy + b.y + 44, Math.min(220, b.w - 32), 92, b.note, b.c, false);
      });
      summary = ['All 9 canonical canvas building blocks', 'Pre-labelled starter notes in each block', 'Ready for collaborative sticky ideation'];
      return finalizeBlueprint();
    }

    if (id === 'wb-strategy-hub') {
      addFrame('fr-1', ox, oy, 980, 440, title, tone.soft);
      addNode('n-vis', 'sticky', 'rect', ox + 30, oy + 60, 210, 150, desc || ('Core strategic thesis for ' + title), 'amber', false);
      addNode('n-dec', 'decision', 'round', ox + 290, oy + 55, 250, 155, 'Key Architecture & Scope Decision', 'indigo', false, { sub: 'Approved · Ready for execution' });
      addNode('n-tsk', 'task', 'round', ox + 600, oy + 55, 240, 150, 'Primary Execution Deliverable', 'blue', false, { sub: 'In Progress · Assigned' });
      addNode('n-kpi', 'kpi', 'round', ox + 600, oy + 245, 240, 145, 'Target Outcome KPI', 'mint', false, { kpiValue: '75%', kpiTarget: '100%' });
      addNode('n-rsk', 'sticky', 'rect', ox + 290, oy + 250, 250, 135, 'Dependencies & open questions to resolve', 'pink', false);
      addEdge('n-vis', 'n-dec', 'Informs', 'elbow');
      addEdge('n-dec', 'n-tsk', 'Approves', 'elbow');
      addEdge('n-tsk', 'n-kpi', 'Drives', 'elbow');
      summary = ['Strategic thesis note & Decision card', 'Linked Execution Task & KPI card', 'Pre-wired dependency connectors'];
      return finalizeBlueprint();
    }

    if (id === 'value-proposition') {
      addFrame('fr-vp', ox, oy, 450, 400, 'Value Map (Your Offer)', '#eff6ff');
      addFrame('fr-cs', ox + 500, oy, 450, 400, 'Customer Profile (Target Segment)', '#fefce8');
      addNode('vp-1', 'shape', 'round', ox + 30, oy + 165, 180, 74, 'Products & Services', 'blue', true);
      addNode('vp-2', 'sticky', 'rect', ox + 245, oy + 55, 175, 130, 'Gain Creators: How we create customer value', 'mint', false);
      addNode('vp-3', 'sticky', 'rect', ox + 245, oy + 225, 175, 130, 'Pain Relievers: How we eliminate friction', 'violet', false);
      addNode('cs-1', 'sticky', 'rect', ox + 530, oy + 55, 175, 130, 'Customer Gains: Desired outcomes & benefits', 'green', false);
      addNode('cs-2', 'sticky', 'rect', ox + 530, oy + 225, 175, 130, 'Customer Pains: Risks, blockers & frustrations', 'red', false);
      addNode('cs-3', 'shape', 'round', ox + 740, oy + 165, 180, 74, 'Customer Jobs', 'amber', true);
      addEdge('vp-1', 'vp-2', '', 'elbow');
      addEdge('vp-1', 'vp-3', '', 'elbow');
      addEdge('vp-2', 'cs-1', 'Fit', 'straight', '#16a34a');
      addEdge('vp-3', 'cs-2', 'Fit', 'straight', '#2563eb');
      addEdge('cs-1', 'cs-3', '', 'elbow');
      addEdge('cs-2', 'cs-3', '', 'elbow');
      summary = ['Value Map & Customer Profile dual frames', 'Jobs, Pains, Gains & Fit connectors', 'Editable sticky notes & core nodes'];
      return finalizeBlueprint();
    }

    if (id === 'sipoc') {
      addFrame('fr-sipoc', ox, oy, 1060, 360, title, tone.soft);
      var sipocCols = [
        ['Suppliers', 'Internal & external providers', 'slate'],
        ['Inputs', 'Materials, data & specs required', 'blue'],
        ['Process', 'High-level 4–5 value steps', 'teal'],
        ['Outputs', 'Deliverables & artifacts produced', 'violet'],
        ['Customers', 'End recipients & SLA targets', 'green']
      ];
      sipocCols.forEach(function (sc, idx) {
        var cx = ox + 24 + idx * 204;
        addNode('sp-h-' + idx, 'shape', 'round', cx, oy + 54, 184, 54, sc[0], sc[2], idx === 2);
        addNode('sp-c-' + idx, 'sticky', 'rect', cx, oy + 140, 184, 165, sc[1], sc[2], false);
        if (idx > 0) addEdge('sp-h-' + (idx - 1), 'sp-h-' + idx, '', 'straight');
      });
      summary = ['5 connected SIPOC columns (Suppliers to Customers)', 'Header nodes + detail cards per stage', 'End-to-end process framing'];
      return finalizeBlueprint();
    }

    if (id === 'five-forces') {
      addFrame('fr-5f', ox, oy, 920, 520, title, tone.soft);
      addNode('ff-c', 'shape', 'round', ox + 340, oy + 215, 240, 86, 'Competitive Rivalry\nIntensity & differentiation', 'violet', true);
      addNode('ff-n', 'shape', 'rect', ox + 340, oy + 48, 240, 78, 'Threat of New Entrants\nBarriers & capital needs', 'blue', false);
      addNode('ff-s', 'shape', 'rect', ox + 340, oy + 385, 240, 78, 'Threat of Substitutes\nAlternative solutions', 'amber', false);
      addNode('ff-w', 'shape', 'rect', ox + 40, oy + 215, 220, 82, 'Supplier Power\nSwitching costs & concentration', 'teal', false);
      addNode('ff-e', 'shape', 'rect', ox + 660, oy + 215, 220, 82, 'Buyer Power\nVolume & price sensitivity', 'pink', false);
      addEdge('ff-n', 'ff-c', 'Pressures');
      addEdge('ff-s', 'ff-c', 'Substitutes');
      addEdge('ff-w', 'ff-c', 'Inputs');
      addEdge('ff-e', 'ff-c', 'Demand');
      summary = ['Central Competitive Rivalry hub', '4 surrounding market force nodes', 'Directional pressure connectors'];
      return finalizeBlueprint();
    }

    // 3. Layout-Kind Specific Compilers (All 27 Gallery Kinds!)
    if (mod === 'project-planning') {
      var plan = buildProjectPlan(tpl, title, desc, kind);
      // Also populate visual preview blocks so thumbnail matches the exact plan
      if (kind === 'cal') {
        addFrame('fr-cal', ox, oy, 920, 460, title + ' (Calendar Schedule)', tone.soft);
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d, di) {
          addNode('cal-h-' + di, 'shape', 'rect', ox + 20 + di * 178, oy + 50, 166, 38, d, tpl.color, true);
          var taskForCol = plan.tasks[di % plan.tasks.length];
          addNode('cal-c-' + di, 'sticky', 'rect', ox + 20 + di * 178, oy + 104 + (di % 2) * 90, 166, 110, taskForCol ? taskForCol.title : ('Scheduled block ' + (di + 1)), di % 2 ? 'teal' : 'blue', false);
        });
      } else if (kind === 'table') {
        tables.push({
          id: 'tbl-pp',
          x: ox, y: oy, w: 860, h: 360,
          rows: [
            ['WBS', 'Deliverable / Package', 'Owner', 'Planned Budget', 'Status'],
            ['1.1', plan.tasks[0].title, 'Project Lead', '$18,000', 'Done'],
            ['2.1', plan.tasks[1].title, 'Delivery Lead', '$26,000', 'In Progress'],
            ['3.1', plan.tasks[2].title, 'Operations', '$32,000', 'Planned'],
            ['4.1', (plan.tasks[3] && plan.tasks[3].title) || 'Final Sign-off', 'Sponsor', '$14,000', 'Planned']
          ]
        });
      } else {
        addFrame('fr-pp', ox, oy, 940, 420, title, tone.soft);
        plan.tasks.slice(0, 4).forEach(function (tsk, idx) {
          var bx = ox + 30 + idx * 170;
          var by = oy + 65 + idx * 78;
          addNode('pp-t-' + idx, 'shape', 'round', bx, by, 260, 52, tsk.wbs + ' · ' + tsk.title, idx === 0 ? 'green' : (idx === 1 ? tpl.color : 'violet'), idx <= 1);
          if (idx > 0) addEdge('pp-t-' + (idx - 1), 'pp-t-' + idx, 'FS', 'elbow');
        });
      }
      summary = [
        plan.wbsPhases.length + ' structured WBS phases & ' + plan.tasks.length + ' scheduled tasks',
        plan.milestones.length + ' tracked milestones with owners',
        'Opens in Project Planning (' + (plan.activeModule === 'calendar' ? 'Calendar' : plan.activeModule === 'table' ? 'Table & Budget' : 'Gantt & WBS') + ' view)'
      ];
      return finalizeBlueprint(plan);
    }

    if (mod === 'documents') {
      var docSpec = buildDocumentSpec(tpl, title, desc, kind, cat);
      addFrame('fr-doc', ox, oy, 680, 520, title, '#ffffff');
      addNode('doc-h', 'shape', 'rect', ox + 36, oy + 52, 608, 54, title + ' — ' + docSpec.docType, tpl.color, true);
      docSpec.sections.slice(0, 3).forEach(function (s, idx) {
        addNode('doc-s-' + idx, 'sticky', 'rect', ox + 36, oy + 124 + idx * 116, 608, 98, (idx + 1) + '. ' + s.heading + ': ' + s.prompt, idx === 0 ? 'slate' : 'white', false);
      });
      summary = [
        docSpec.sections.length + ' structured document sections (' + docSpec.docType + ')',
        docSpec.hasTable ? 'Pre-formatted register table ready to fill' : (docSpec.hasChecklist ? 'Interactive sign-off checklist items' : 'Executive summary & sign-off block'),
        'Opens directly in QuantalFlow Documents editor'
      ];
      return finalizeBlueprint(null, docSpec);
    }

    // Visual Canvas & Whiteboard Layout Kinds
    switch (kind) {
      case 'swot': {
        var quads = [
          { k: 's', t: 'Strengths (Internal)', n1: 'Core advantage in ' + title.toLowerCase(), n2: 'Proven team capability & assets', c: 'green', x: 0, y: 0 },
          { k: 'w', t: 'Weaknesses (Internal)', n1: 'Current capacity or process gaps', n2: 'Areas needing tooling investment', c: 'amber', x: 480, y: 0 },
          { k: 'o', t: 'Opportunities (External)', n1: 'Untapped segment or workflow expansion', n2: 'Strategic partnership leverage', c: 'blue', x: 0, y: 290 },
          { k: 't', t: 'Threats (External)', n1: 'Competitive, market or timing risks', n2: 'Mitigation & contingency plan', c: 'red', x: 480, y: 290 }
        ];
        quads.forEach(function (q) {
          var qt = resolveTone(q.c);
          addFrame('sw-f-' + q.k, ox + q.x, oy + q.y, 460, 270, q.t, qt.soft);
          addNode('sw-1-' + q.k, 'sticky', 'rect', ox + q.x + 22, oy + q.y + 56, 198, 175, q.n1, q.c, false);
          addNode('sw-2-' + q.k, 'sticky', 'rect', ox + q.x + 238, oy + q.y + 56, 198, 175, q.n2, q.c, false);
        });
        summary = ['4 colour-coded SWOT quadrants', '8 domain-prompted internal & external cards', 'Ready for team voting & prioritization'];
        break;
      }

      case 'kanban': {
        var cols = getKanbanColumns(id, title, desc);
        addFrame('kb-main', ox - 20, oy - 48, cols.length * 255 + 30, 470, title, tone.soft);
        cols.forEach(function (col, ci) {
          var cx = ox + ci * 255;
          var ct = resolveTone(col.c);
          addFrame('kb-col-' + ci, cx, oy + 10, 238, 395, col.t, ct.soft);
          col.cards.forEach(function (txt, ri) {
            addNode('kb-c-' + ci + '-' + ri, 'sticky', 'rect', cx + 16, oy + 62 + ri * 155, 206, 135, txt, col.c, false);
          });
        });
        summary = [cols.length + ' workflow columns (' + cols.map(function (c) { return c.t; }).join(' · ') + ')', 'Pre-populated starter cards per column', 'Drag cards across stages in real time'];
        break;
      }

      case 'swim': {
        var lanes = getSwimlanes(id, title);
        lanes.forEach(function (ln, li) {
          var ly = oy + li * 175;
          var lt = resolveTone(ln.c);
          addFrame('swm-ln-' + li, ox, ly, 980, 162, ln.role, lt.soft, true);
        });
        addNode('swm-1', 'flowchart', 'terminator', ox + 60, oy + 48, 165, 68, lanes[0].step1, lanes[0].c, true);
        addNode('swm-2', 'flowchart', 'rect', ox + 295, oy + 44, 185, 76, lanes[0].step2, lanes[0].c, false);
        addNode('swm-3', 'flowchart', 'diamond', ox + 305, oy + 208, 165, 102, lanes[1].step1, 'amber', false);
        addNode('swm-4', 'flowchart', 'rect', ox + 555, oy + 221, 185, 76, lanes[1].step2, lanes[1].c, false);
        addNode('swm-5', 'flowchart', 'terminator', ox + 775, oy + 398, 175, 68, lanes[2].step1, 'green', true);
        addEdge('swm-1', 'swm-2', '', 'elbow');
        addEdge('swm-2', 'swm-3', 'Handoff', 'elbow');
        addEdge('swm-3', 'swm-4', 'Approved', 'elbow', '#16a34a');
        addEdge('swm-3', 'swm-2', 'Revise', 'elbow', '#e5484d');
        addEdge('swm-4', 'swm-5', 'Complete', 'elbow');
        summary = ['3 horizontal role swimlanes (' + lanes.map(function (l) { return l.role; }).join(', ') + ')', 'Cross-lane handoffs & approval decision diamond', 'End-to-end connected process flow'];
        break;
      }

      case 'flow': {
        addFrame('fl-main', ox, oy, 980, 440, title, tone.soft);
        if (id === 'five-whys') {
          var whys = ['Problem Statement: ' + title, '1st Why — Immediate symptom', '2nd Why — Process trigger', '3rd Why — Missing safeguard', 'Root Cause & Countermeasure'];
          whys.forEach(function (wTxt, wi) {
            addNode('fw-' + wi, 'flowchart', wi === 0 || wi === 4 ? 'terminator' : 'rect', ox + 34 + wi * 186, oy + 170, 166, 82, wTxt, wi === 4 ? 'green' : (wi === 0 ? 'red' : tpl.color), wi === 0 || wi === 4);
            if (wi > 0) addEdge('fw-' + (wi - 1), 'fw-' + wi, 'Why?', 'straight');
          });
        } else {
          var fSteps = getFlowSteps(id, title);
          addNode('fl-1', 'flowchart', 'terminator', ox + 36, oy + 176, 155, 68, fSteps[0], tpl.color, true);
          addNode('fl-2', 'flowchart', 'rect', ox + 245, oy + 170, 178, 80, fSteps[1], tpl.color, false);
          addNode('fl-3', 'flowchart', 'diamond', ox + 480, oy + 155, 168, 110, fSteps[2], 'amber', false);
          addNode('fl-4', 'flowchart', 'rect', ox + 715, oy + 76, 205, 78, fSteps[3], 'green', false);
          addNode('fl-5', 'flowchart', 'rect', ox + 715, oy + 266, 205, 78, fSteps[4], 'red', false);
          addEdge('fl-1', 'fl-2', '', 'elbow');
          addEdge('fl-2', 'fl-3', '', 'elbow');
          addEdge('fl-3', 'fl-4', 'Yes', 'elbow', '#16a34a');
          addEdge('fl-3', 'fl-5', 'No', 'elbow', '#e5484d');
        }
        summary = ['Start terminator, process steps & decision diamond', 'Labelled Yes / No outcome branches', '8-port flowchart nodes with quick-spawn (+)'];
        break;
      }

      case 'org': {
        addFrame('org-main', ox, oy, 1020, 520, title, tone.soft);
        var org = getOrgHierarchy(id, title);
        addNode('org-root', 'shape', 'round', ox + 380, oy + 46, 260, 68, org.root, tpl.color, true);
        org.leads.forEach(function (ld, li) {
          var lx = ox + 70 + li * 320;
          addNode('org-l-' + li, 'shape', 'rect', lx, oy + 185, 240, 66, ld.title, ld.c, false);
          addEdge('org-root', 'org-l-' + li, '', 'elbow');
          ld.children.forEach(function (ch, ci) {
            var cx = lx - 10 + ci * 135;
            addNode('org-c-' + li + '-' + ci, 'sticky', 'rect', cx, oy + 320, 125, 125, ch, ld.c, false);
            addEdge('org-l-' + li, 'org-c-' + li + '-' + ci, '', 'elbow');
          });
        });
        summary = ['3-tier hierarchical tree (' + org.root + ')', '3 primary pillars & 6 leaf units', 'Clean top-down orthogonal reporting lines'];
        break;
      }

      case 'mind': {
        addFrame('mm-main', ox, oy, 1040, 540, title, tone.soft);
        var branches = getMindBranches(id, title, cat);
        addNode('mm-root', 'shape', 'pill', ox + 390, oy + 230, 260, 76, title, tpl.color, true);
        var bCoords = [
          { x: ox + 150, y: oy + 70, sx: ox + 20, sy: oy + 62 },
          { x: ox + 150, y: oy + 235, sx: ox + 20, sy: oy + 227 },
          { x: ox + 150, y: oy + 400, sx: ox + 20, sy: oy + 392 },
          { x: ox + 660, y: oy + 70, sx: ox + 865, sy: oy + 62 },
          { x: ox + 660, y: oy + 235, sx: ox + 865, sy: oy + 227 },
          { x: ox + 660, y: oy + 400, sx: ox + 865, sy: oy + 392 }
        ];
        branches.forEach(function (br, bi) {
          var pos = bCoords[bi];
          addNode('mm-b-' + bi, 'shape', 'round', pos.x, pos.y, 185, 54, br.t, br.c, false);
          addNode('mm-s-' + bi, 'sticky', 'rect', pos.sx, pos.sy - 10, 148, 86, br.sub, br.c, false);
          addEdge('mm-root', 'mm-b-' + bi, '', 'curved');
          addEdge('mm-b-' + bi, 'mm-s-' + bi, '', 'curved');
        });
        summary = ['Central topic hub + 6 themed primary branches', '6 connected sub-topic notes', 'Curved radial mind-map connectors'];
        break;
      }

      case 'fish': {
        addFrame('fsh-main', ox, oy, 1020, 520, title, tone.soft);
        addNode('fsh-head', 'shape', 'round', ox + 780, oy + 220, 210, 82, 'Effect / Problem:\n' + title, 'red', true);
        addNode('fsh-tail', 'shape', 'pill', ox + 30, oy + 236, 130, 50, 'Root Factors', 'slate', false);
        addEdge('fsh-tail', 'fsh-head', 'Main Spine', 'straight', tone.hex);
        var ribs = [
          { t: 'People & Skills', sub: 'Training, handoffs & load', x: 160, y: 55, c: 'blue' },
          { t: 'Process & SOPs', sub: 'Workflow steps & approvals', x: 400, y: 55, c: 'violet' },
          { t: 'Tools & Systems', sub: 'Software, infra & latency', x: 620, y: 55, c: 'teal' },
          { t: 'Environment', sub: 'External context & timing', x: 160, y: 380, c: 'amber' },
          { t: 'Materials & Data', sub: 'Input quality & specs', x: 400, y: 380, c: 'orange' },
          { t: 'Measurement', sub: 'Metrics, alerts & telemetry', x: 620, y: 380, c: 'green' }
        ];
        ribs.forEach(function (rb, ri) {
          addNode('fsh-r-' + ri, 'sticky', 'rect', ox + rb.x, oy + rb.y, 195, 96, rb.t + '\n• ' + rb.sub, rb.c, false);
          addEdge('fsh-r-' + ri, 'fsh-head', '', 'straight');
        });
        summary = ['Problem / Effect head + central spine', '6 classic Ishikawa cause categories', 'Pre-linked cause-to-effect ribs'];
        break;
      }

      case 'funnel': {
        addFrame('fn-main', ox, oy, 820, 540, title, tone.soft);
        var stages = [
          { t: 'Stage 1 · Awareness & Reach', sub: '100% top-of-funnel intake', w: 660, c: 'blue' },
          { t: 'Stage 2 · Qualification & Engagement', sub: '48% engaged prospects', w: 540, c: 'indigo' },
          { t: 'Stage 3 · Proposal & Evaluation', sub: '24% active opportunities', w: 420, c: 'violet' },
          { t: 'Stage 4 · Conversion & Retention', sub: '12% closed / committed', w: 300, c: 'green' }
        ];
        stages.forEach(function (st, si) {
          var sx = ox + Math.round((820 - st.w) / 2);
          var sy = oy + 58 + si * 114;
          addNode('fn-s-' + si, 'shape', 'round', sx, sy, st.w, 82, st.t + ' — ' + st.sub, st.c, si === 0 || si === 3);
          if (si > 0) addEdge('fn-s-' + (si - 1), 'fn-s-' + si, '', 'straight');
        });
        summary = ['4 progressive narrowing funnel stages', 'Conversion benchmark placeholders per tier', 'Connected top-to-bottom stage flow'];
        break;
      }

      case 'wire': {
        addFrame('wr-shell', ox, oy, 940, 560, title + ' — Viewport 1280×800', '#ffffff');
        addNode('wr-top', 'shape', 'rect', ox + 24, oy + 48, 892, 52, 'Top Navigation · Brand · Search · User Profile', 'slate', false);
        addFrame('wr-side', ox + 24, oy + 116, 200, 416, 'Sidebar Nav', '#f8fafc');
        addNode('wr-nav1', 'sticky', 'rect', ox + 38, oy + 162, 172, 82, '• Overview\n• Projects\n• Analytics\n• Settings', 'blue', false);
        [0, 1, 2].forEach(function (ki) {
          addNode('wr-k-' + ki, 'shape', 'round', ox + 244 + ki * 228, oy + 116, 214, 108, ['Primary Metric Card', 'Active Pipeline Card', 'Conversion Summary'][ki], ki === 0 ? tpl.color : 'slate', ki === 0);
        });
        addFrame('wr-body', ox + 244, oy + 242, 672, 290, 'Main Interactive Content Region', tone.soft);
        addNode('wr-cta', 'sticky', 'rect', ox + 268, oy + 294, 295, 195, 'Primary data table / interactive list view', 'yellow', false);
        addNode('wr-panel', 'sticky', 'rect', ox + 588, oy + 294, 304, 195, 'Detail inspector / contextual actions', 'mint', false);
        summary = ['App window frame with Topbar & Sidebar', '3 header metric cards + 2 main content regions', 'Ready for low-to-mid fidelity UI critique'];
        break;
      }

      case 'timeline': {
        addFrame('tl-main', ox, oy, 1060, 470, title, tone.soft);
        var milestones = getTimelineStages(id, title);
        milestones.forEach(function (ms, mi) {
          var mx = ox + 36 + mi * 250;
          var up = mi % 2 === 0;
          addNode('tl-m-' + mi, 'shape', 'pill', mx, oy + 205, 210, 56, ms.stage, ms.c, mi === 0);
          addNode('tl-n-' + mi, 'sticky', 'rect', mx + 8, oy + (up ? 52 : 288), 194, 130, ms.note, ms.c, false);
          if (mi > 0) addEdge('tl-m-' + (mi - 1), 'tl-m-' + mi, '', 'straight');
          addEdge('tl-m-' + mi, 'tl-n-' + mi, '', 'straight');
        });
        summary = ['4 sequential timeline milestones along central axis', 'Alternating upper & lower deliverable notes', 'Connected stage-by-stage progression'];
        break;
      }

      case 'gantt': {
        addFrame('gt-main', ox, oy, 980, 460, title, tone.soft);
        var gPhases = [
          ['Phase 1 · Discovery & Scope', 40, 260, 'blue'],
          ['Phase 2 · Design & Specification', 240, 300, 'violet'],
          ['Phase 3 · Core Build & Execution', 470, 320, 'teal'],
          ['Phase 4 · QA, Handover & Launch', 720, 220, 'green']
        ];
        gPhases.forEach(function (gp, gi) {
          addNode('gt-p-' + gi, 'shape', 'round', ox + gp[1], oy + 72 + gi * 90, gp[2], 62, gp[0], gp[3], gi === 0 || gi === 3);
          if (gi > 0) addEdge('gt-p-' + (gi - 1), 'gt-p-' + gi, 'FS', 'elbow');
        });
        summary = ['4 staggered Gantt schedule bars', 'Finish-to-Start milestone connectors', 'Editable durations & phase labels'];
        break;
      }

      case 'cal': {
        addFrame('cal-main', ox, oy, 980, 480, title, tone.soft);
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(function (day, di) {
          var dx = ox + 22 + di * 190;
          addNode('cal-d-' + di, 'shape', 'rect', dx, oy + 52, 176, 44, day, tpl.color, true);
          addNode('cal-a-' + di, 'sticky', 'rect', dx, oy + 112, 176, 155, 'Morning slot:\nKey scheduled item', di % 2 === 0 ? 'blue' : 'mint', false);
          addNode('cal-b-' + di, 'sticky', 'rect', dx, oy + 284, 176, 155, 'Afternoon slot:\nReview / publish', di % 2 === 0 ? 'yellow' : 'violet', false);
        });
        summary = ['5-day weekly schedule columns', 'Morning & afternoon editable slot cards', 'Colour-coded channel / owner blocks'];
        break;
      }

      case 'matrix': {
        if (id === 'pestel') {
          var pest = [
            ['Political', 'Policy, trade & regulatory stability', 'blue'],
            ['Economic', 'Growth, inflation & budget shifts', 'teal'],
            ['Social', 'Demographics & buyer behaviour', 'pink'],
            ['Technological', 'AI, automation & platform shifts', 'violet'],
            ['Environmental', 'Sustainability & resource impact', 'green'],
            ['Legal', 'Compliance, privacy & IP rules', 'amber']
          ];
          pest.forEach(function (p, pi) {
            var px = ox + (pi % 3) * 325;
            var py = oy + Math.floor(pi / 3) * 255;
            addFrame('pst-f-' + pi, px, py, 308, 238, p[0] + ' Factors', resolveTone(p[2]).soft);
            addNode('pst-n-' + pi, 'sticky', 'rect', px + 20, py + 56, 268, 152, p[1], p[2], false);
          });
          summary = ['6 PESTEL macro-environment frames', 'Prompted factor analysis cards', '2×3 strategic scan layout'];
        } else if (id === 'raci' || id === 'decision-matrix') {
          addFrame('mtx-f', ox, oy, 900, 520, title, tone.soft);
          tables.push({
            id: 'mtx-tbl',
            x: ox + 28, y: oy + 58, w: 844, h: 290,
            rows: id === 'raci'
              ? [
                  ['Deliverable / Activity', 'Project Lead', 'Engineering / Ops', 'Design / SME', 'Executive Sponsor'],
                  ['1. Define scope & charter', 'R', 'C', 'C', 'A'],
                  ['2. Build core solution', 'A', 'R', 'C', 'I'],
                  ['3. Verification & QA sign-off', 'A', 'R', 'R', 'I'],
                  ['4. Production launch & handover', 'R', 'C', 'I', 'A']
                ]
              : [
                  ['Option / Candidate', 'Impact (40%)', 'Effort / Cost (30%)', 'Risk (30%)', 'Weighted Score'],
                  ['Option A — Core Platform', '9 / 10', '7 / 10', '8 / 10', '8.1 (Recommended)'],
                  ['Option B — Incremental Patch', '6 / 10', '9 / 10', '7 / 10', '7.2'],
                  ['Option C — Custom Vendor', '7 / 10', '4 / 10', '5 / 10', '5.5']
                ]
          });
          addNode('mtx-k1', 'sticky', 'rect', ox + 28, oy + 372, 410, 118, id === 'raci' ? 'R = Responsible (does the work)\nA = Accountable (one final approver per row)' : 'Scoring Rule: Weight each criterion before scoring options', 'blue', false);
          addNode('mtx-k2', 'sticky', 'rect', ox + 462, oy + 372, 410, 118, id === 'raci' ? 'C = Consulted (two-way input)\nI = Informed (kept updated on progress)' : 'Final Decision & Owner: Record chosen option and sign-off date', 'green', false);
          summary = ['Framed evaluation matrix table', 'Pre-labelled headers & scoring criteria', 'Legend & decision sign-off notes'];
        } else {
          var mQuads = getMatrixQuadrants(id, title);
          mQuads.forEach(function (mq, qi) {
            var qx = ox + (qi % 2) * 475;
            var qy = oy + Math.floor(qi / 2) * 285;
            addFrame('mq-f-' + qi, qx, qy, 455, 265, mq.t, resolveTone(mq.c).soft);
            addNode('mq-1-' + qi, 'sticky', 'rect', qx + 22, qy + 56, 196, 170, mq.n1, mq.c, false);
            addNode('mq-2-' + qi, 'sticky', 'rect', qx + 236, qy + 56, 196, 170, mq.n2, mq.c, false);
          });
          summary = ['2×2 strategic evaluation quadrants', '8 pre-structured comparison cards', 'Ready for prioritization & alignment'];
        }
        break;
      }

      case 'table': {
        addFrame('tb-main', ox, oy, 920, 520, title, tone.soft);
        tables.push({
          id: 'tb-grid',
          x: ox + 28, y: oy + 58, w: 864, h: 295,
          rows: getTableRows(id, title)
        });
        addNode('tb-n1', 'sticky', 'rect', ox + 28, oy + 378, 420, 112, 'Key Takeaways: Highlight standout rows or gaps', 'yellow', false);
        addNode('tb-n2', 'sticky', 'rect', ox + 472, oy + 378, 420, 112, 'Next Actions: Assign owner & target review date', 'mint', false);
        summary = ['Editable multi-column structured table', 'Domain-tailored column headers & starter rows', 'Takeaways & next-action notes'];
        break;
      }

      case 'check': {
        addFrame('chk-main', ox, oy, 760, 520, title, '#ffffff');
        var checks = [
          '[x] 1. Confirm scope, objectives & responsible owners for ' + title,
          '[x] 2. Gather required inputs, credentials & baseline documentation',
          '[ ] 3. Execute core verification checks & record findings',
          '[ ] 4. Review exceptions or blockers with stakeholders',
          '[ ] 5. Final sign-off, archive evidence & publish update'
        ];
        checks.forEach(function (line, ci) {
          addNode('chk-' + ci, 'sticky', 'rect', ox + 36, oy + 58 + ci * 86, 688, 72, line, ci < 2 ? 'green' : (ci === 2 ? 'blue' : 'yellow'), false);
        });
        summary = ['5 sequential sign-off checklist items', 'Completed vs open visual status cues', 'Editable owner & verification notes'];
        break;
      }

      case 'venn': {
        addFrame('vn-main', ox, oy, 920, 520, title, tone.soft);
        addNode('vn-a', 'shape', 'circle', ox + 120, oy + 70, 290, 290, 'Perspective A\nCore Strengths', 'blue', false);
        addNode('vn-b', 'shape', 'circle', ox + 510, oy + 70, 290, 290, 'Perspective B\nMarket / User Needs', 'amber', false);
        addNode('vn-c', 'shape', 'circle', ox + 315, oy + 215, 290, 270, 'Perspective C\nOperational Feasibility', 'green', false);
        addNode('vn-core', 'sticky', 'rect', ox + 365, oy + 175, 190, 110, 'Sweet Spot:\nShared high-value overlap', 'violet', false);
        summary = ['3 intersecting comparison zones', 'Highlighted central overlap card', 'Editable labels for shared vs distinct traits'];
        break;
      }

      case 'pyramid': {
        addFrame('pyr-main', ox, oy, 840, 540, title, tone.soft);
        var tiers = getPyramidTiers(id, title);
        tiers.forEach(function (tr, ti) {
          var tw = 260 + ti * 150;
          var tx = ox + Math.round((840 - tw) / 2);
          var ty = oy + 58 + ti * 112;
          addNode('pyr-' + ti, 'shape', 'round', tx, ty, tw, 84, tr.t, tr.c, ti === 0);
          if (ti < tiers.length - 1) addEdge('pyr-' + (ti + 1), 'pyr-' + ti, '', 'straight');
        });
        summary = ['4 hierarchical pyramid tiers (Apex to Foundation)', 'Proportional tier widths & upward links', 'Editable level definitions'];
        break;
      }

      case 'cycle': {
        addFrame('cyc-main', ox, oy, 880, 540, title, tone.soft);
        var cSteps = id === 'pdca'
          ? ['1. Plan\nObjectives & hypothesis', '2. Do\nSmall-scale execution', '3. Check\nMeasure vs baseline', '4. Act\nStandardize & scale']
          : ['1. Define & Plan', '2. Execute & Measure', '3. Analyze Insights', '4. Improve & Control'];
        addNode('cyc-hub', 'shape', 'circle', ox + 355, oy + 215, 170, 120, title, tpl.color, true);
        var cPos = [
          [ox + 330, oy + 52, 'blue'],
          [ox + 615, oy + 225, 'teal'],
          [ox + 330, oy + 405, 'amber'],
          [ox + 45, oy + 225, 'violet']
        ];
        cSteps.forEach(function (st, si) {
          addNode('cyc-' + si, 'shape', 'round', cPos[si][0], cPos[si][1], 220, 82, st, cPos[si][2], false);
        });
        addEdge('cyc-0', 'cyc-1', '', 'curved');
        addEdge('cyc-1', 'cyc-2', '', 'curved');
        addEdge('cyc-2', 'cyc-3', '', 'curved');
        addEdge('cyc-3', 'cyc-0', '', 'curved');
        summary = ['4-stage continuous improvement loop', 'Central objective hub + curved cycle links', 'Ready for iterative sprint tracking'];
        break;
      }

      case 'network': {
        addFrame('net-main', ox, oy, 960, 540, title, tone.soft);
        addNode('net-hub', 'shape', 'circle', ox + 385, oy + 215, 190, 115, 'Core Hub\n' + title, tpl.color, true);
        var spokes = [
          ['Edge / Client App', 80, 70, 'blue'],
          ['Auth & Identity', 385, 48, 'violet'],
          ['Analytics / BI', 690, 70, 'teal'],
          ['Primary Database', 80, 385, 'green'],
          ['Async Queue / Workers', 385, 412, 'amber'],
          ['External Integrations', 690, 385, 'pink']
        ];
        spokes.forEach(function (sp, si) {
          addNode('net-s-' + si, 'shape', 'round', ox + sp[1], oy + sp[2], 190, 68, sp[0], sp[3], false);
          addEdge('net-hub', 'net-s-' + si, '', 'straight');
        });
        summary = ['Central gateway hub + 6 connected topology nodes', 'Radial service/dependency connectors', 'Editable architecture labels'];
        break;
      }

      case 'erd':
      case 'uml': {
        addFrame('erd-main', ox, oy, 1020, 520, title, tone.soft);
        tables.push(
          {
            id: 'ent-1', x: ox + 40, y: oy + 65, w: 280, h: 195,
            rows: kind === 'uml'
              ? [['User (Class)', 'Type / Signature'], ['+ id', 'UUID'], ['+ email', 'String'], ['+ authenticate()', 'Session']]
              : [['users', 'Key · Type'], ['id', 'PK · uuid'], ['org_id', 'FK · uuid'], ['email', 'unique · text']]
          },
          {
            id: 'ent-2', x: ox + 380, y: oy + 65, w: 290, h: 195,
            rows: kind === 'uml'
              ? [['Workspace (Class)', 'Type / Signature'], ['+ id', 'UUID'], ['+ ownerId', 'UUID'], ['+ syncState()', 'Boolean']]
              : [['workspaces', 'Key · Type'], ['id', 'PK · uuid'], ['owner_id', 'FK · users.id'], ['state_json', 'jsonb']]
          },
          {
            id: 'ent-3', x: ox + 720, y: oy + 65, w: 260, h: 195,
            rows: kind === 'uml'
              ? [['BoardItem (Class)', 'Type / Signature'], ['+ id', 'UUID'], ['+ kind', 'Enum'], ['+ render()', 'SVG']]
              : [['board_items', 'Key · Type'], ['id', 'PK · uuid'], ['workspace_id', 'FK · workspaces.id'], ['payload', 'jsonb']]
          }
        );
        addNode('erd-n1', 'sticky', 'rect', ox + 40, oy + 310, 280, 145, '1 : N relationship — Users own or collaborate on Workspaces', 'blue', false);
        addNode('erd-n2', 'sticky', 'rect', ox + 380, oy + 310, 290, 145, 'Indexes & constraints — Optimistic version lock on updates', 'teal', false);
        addEdge('ent-1', 'ent-2', '1 : N', 'elbow');
        addEdge('ent-2', 'ent-3', '1 : N', 'elbow');
        summary = ['3 linked schema / class entity tables', 'Primary & foreign key field definitions', '1:N relationship connectors & notes'];
        break;
      }

      case 'seq': {
        addFrame('seq-main', ox, oy, 980, 520, title, tone.soft);
        var actors = ['Client UI', 'API Gateway', 'Core Service', 'Database'];
        actors.forEach(function (act, ai) {
          var ax = ox + 45 + ai * 232;
          addNode('seq-a-' + ai, 'shape', 'rect', ax, oy + 52, 180, 54, act, ai === 0 ? tpl.color : 'slate', ai === 0);
        });
        addNode('seq-m1', 'shape', 'round', ox + 140, oy + 150, 220, 52, '1. POST /request (Auth)', 'blue', false);
        addNode('seq-m2', 'shape', 'round', ox + 375, oy + 230, 220, 52, '2. Validate & Execute', 'violet', false);
        addNode('seq-m3', 'shape', 'cylinder', ox + 610, oy + 310, 220, 58, '3. Commit Transaction', 'teal', false);
        addNode('seq-m4', 'shape', 'round', ox + 140, oy + 400, 220, 52, '4. 200 OK JSON Payload', 'green', true);
        addEdge('seq-a-0', 'seq-m1', '', 'elbow');
        addEdge('seq-m1', 'seq-m2', '', 'elbow');
        addEdge('seq-m2', 'seq-m3', '', 'elbow');
        addEdge('seq-m3', 'seq-m4', 'Response', 'elbow');
        summary = ['4 system actor headers across the top', '4 chronological request/commit/response steps', 'Sequential call-flow connectors'];
        break;
      }

      case 'floor': {
        addFrame('flr-outer', ox, oy, 960, 540, title + ' — Layout Plan', '#ffffff');
        addFrame('flr-z1', ox + 28, oy + 56, 430, 220, 'Zone A · Collaborative Studio', '#eff6ff');
        addFrame('flr-z2', ox + 482, oy + 56, 450, 220, 'Zone B · Focus & Review Pods', '#f0fdf4');
        addFrame('flr-z3', ox + 28, oy + 298, 904, 214, 'Zone C · Main Commons / Presentation Area', '#fefce8');
        addNode('flr-d1', 'shape', 'rect', ox + 56, oy + 112, 170, 68, 'Table / Group 1 (6 seats)', 'blue', false);
        addNode('flr-d2', 'shape', 'rect', ox + 256, oy + 112, 170, 68, 'Table / Group 2 (6 seats)', 'blue', false);
        addNode('flr-d3', 'shape', 'rect', ox + 512, oy + 112, 185, 68, 'Pod 1 · Quiet Station', 'green', false);
        addNode('flr-d4', 'shape', 'rect', ox + 718, oy + 112, 185, 68, 'Pod 2 · Quiet Station', 'green', false);
        addNode('flr-stage', 'shape', 'round', ox + 60, oy + 356, 260, 110, 'Primary Stage / Display Wall', tpl.color, true);
        addNode('flr-seat', 'sticky', 'rect', ox + 360, oy + 356, 530, 110, 'Flexible seating rows, circulation path & equipment notes', 'amber', false);
        summary = ['Outer boundary + 3 zoned room frames', 'Movable desk, pod & stage blocks', 'Ready to rearrange to scale'];
        break;
      }

      case 'persona': {
        addFrame('per-main', ox, oy, 960, 520, title, '#ffffff');
        addNode('per-bio', 'shape', 'round', ox + 36, oy + 62, 270, 185, 'Persona Profile\nRole · Segment · Context', tpl.color, true);
        addNode('per-quote', 'sticky', 'rect', ox + 36, oy + 272, 270, 205, '"I need one clear workspace where decisions, plans, and docs stay in sync."', 'yellow', false);
        addFrame('per-g', ox + 334, oy + 62, 290, 200, 'Goals & Motivations', '#f0fdf4');
        addNode('per-gn', 'sticky', 'rect', ox + 354, oy + 114, 250, 125, '• Ship faster with fewer handoffs\n• Clear visibility for stakeholders', 'green', false);
        addFrame('per-p', ox + 644, oy + 62, 286, 200, 'Frustrations & Pains', '#fef2f2');
        addNode('per-pn', 'sticky', 'rect', ox + 664, oy + 114, 246, 125, '• Scattered notes across tools\n• Rebuilding diagrams from scratch', 'red', false);
        addFrame('per-b', ox + 334, oy + 280, 596, 198, 'Behaviours, Channels & Decision Triggers', '#eff6ff');
        addNode('per-bn', 'sticky', 'rect', ox + 354, oy + 332, 556, 124, 'Evaluates templates first · Collaborates live with 4–10 teammates · Values speed & clarity', 'blue', false);
        summary = ['Persona bio card + verbatim quote block', 'Dedicated Goals, Frustrations & Behaviours frames', 'Ready for user interview synthesis'];
        break;
      }

      case 'chart':
      case 'radar':
      default: {
        addFrame('ch-main', ox, oy, 960, 500, title, tone.soft);
        addNode('ch-k1', 'kpi', 'round', ox + 36, oy + 62, 275, 138, 'Primary North Star Metric', tpl.color, true, { kpiValue: '84%', kpiTarget: '90%' });
        addNode('ch-k2', 'kpi', 'round', ox + 342, oy + 62, 275, 138, 'Execution Velocity', 'teal', false, { kpiValue: '92%', kpiTarget: '100%' });
        addNode('ch-k3', 'kpi', 'round', ox + 648, oy + 62, 275, 138, 'Quality / Retention Score', 'violet', false, { kpiValue: '4.8 / 5', kpiTarget: '5.0' });
        tables.push({
          id: 'ch-tbl', x: ox + 36, y: oy + 228, w: 888, h: 235,
          rows: [
            ['Dimension / Measure', 'Baseline', 'Current', 'Target', 'Owner'],
            ['1. Core Adoption & Reach', '42%', '68%', '80%', 'Growth Lead'],
            ['2. Cycle Time / Throughput', '14 days', '8 days', '5 days', 'Ops Lead'],
            ['3. Net Outcome Score', '71', '84', '90', 'Product Lead']
          ]
        });
        summary = ['3 live KPI scorecards across the top', 'Comparative baseline-to-target data table', 'Editable metrics & owner assignments'];
        break;
      }
    }

    return finalizeBlueprint();

    function finalizeBlueprint(planObj, docObj) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      frames.concat(nodes).concat(tables).forEach(function (item) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + (item.w || 200));
        maxY = Math.max(maxY, item.y + (item.h || 120));
      });
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 960; maxY = 540; }
      return {
        id: id,
        title: title,
        desc: desc,
        cat: cat,
        mod: mod,
        kind: kind,
        tone: tone,
        frames: frames,
        nodes: nodes,
        tables: tables,
        edges: edges,
        plan: planObj || null,
        docSpec: docObj || null,
        summary: summary,
        bounds: { x: minX, y: minY, w: Math.max(200, maxX - minX), h: Math.max(160, maxY - minY) }
      };
    }
  }

  /* ---------- Domain Content Helpers ---------- */
  function getKanbanColumns(id, title, desc) {
    if (id === 'standup') {
      return [
        { t: 'Yesterday', c: 'slate', cards: ['Completed API & schema checks', 'Reviewed open pull requests'] },
        { t: 'Today', c: 'blue', cards: [desc || ('Advance ' + title + ' priorities'), 'Sync with design & QA'] },
        { t: 'Blockers', c: 'red', cards: ['List any dependency or environment blocker…'] }
      ];
    }
    if (id === 'retro' || id === 'bs-retro') {
      return [
        { t: 'Went Well', c: 'green', cards: ['Smooth cross-team collaboration', 'Clear milestone delivery'] },
        { t: 'To Improve', c: 'amber', cards: ['Earlier spec sign-off before sprint start'] },
        { t: 'Action Items', c: 'blue', cards: ['Assign owner & due date for top improvement'] }
      ];
    }
    if (id === 'start-stop-continue') {
      return [
        { t: 'Start Doing', c: 'green', cards: ['Async pre-reads before review meetings'] },
        { t: 'Stop Doing', c: 'red', cards: ['Context-switching mid-sprint'] },
        { t: 'Continue Doing', c: 'blue', cards: ['Shared visual canvas for planning'] }
      ];
    }
    if (id === 'sales-pipeline') {
      return [
        { t: 'New Leads', c: 'slate', cards: ['Inbound enterprise inquiry', 'Partner referral account'] },
        { t: 'Discovery & Demo', c: 'blue', cards: ['Technical stakeholder walkthrough'] },
        { t: 'Proposal Sent', c: 'amber', cards: ['Annual workspace quotation #108'] },
        { t: 'Closed Won', c: 'green', cards: ['Signed multi-team rollout'] }
      ];
    }
    if (id === 'kb-bug-triage' || id === 'issue-tracker') {
      return [
        { t: 'Reported', c: 'red', cards: ['Reproduce issue & capture logs', 'Customer-reported edge case'] },
        { t: 'Investigating', c: 'amber', cards: ['Root-cause analysis underway'] },
        { t: 'Fix in Progress', c: 'blue', cards: ['Patch & automated regression test'] },
        { t: 'Verified', c: 'green', cards: ['Staging & production check passed'] }
      ];
    }
    return [
      { t: 'Backlog', c: 'violet', cards: [desc || ('Define scope for ' + title)] },
      { t: 'To Do', c: 'amber', cards: ['Primary deliverable #1', 'Supporting workflow setup'] },
      { t: 'In Progress', c: 'blue', cards: ['Active execution item'] },
      { t: 'Done', c: 'green', cards: ['Workspace initialized & aligned'] }
    ];
  }

  function getSwimlanes(id, title) {
    if (id.indexOf('support') !== -1) {
      return [
        { role: 'Customer / Requester', c: 'blue', step1: 'Submit Ticket', step2: 'Provide Context' },
        { role: 'Support Tier 1 & 2', c: 'teal', step1: 'Escalation Needed?', step2: 'Diagnose & Resolve' },
        { role: 'Engineering / QA', c: 'violet', step1: 'Verify Fix & Close Ticket' }
      ];
    }
    if (id.indexOf('recruit') !== -1) {
      return [
        { role: 'Candidate', c: 'pink', step1: 'Submit Application', step2: 'Complete Interview' },
        { role: 'Hiring Manager', c: 'blue', step1: 'Meets Bar?', step2: 'Team Debrief & Score' },
        { role: 'People & HR', c: 'green', step1: 'Extend Offer & Onboard' }
      ];
    }
    return [
      { role: 'Requester / Intake', c: 'blue', step1: 'Initiate ' + title, step2: 'Prepare Specification' },
      { role: 'Reviewer / Approver', c: 'teal', step1: 'Approved?', step2: 'Validate & Sign Off' },
      { role: 'Operations / Delivery', c: 'violet', step1: 'Execute & Publish Record' }
    ];
  }

  function getFlowSteps(id, title) {
    if (id.indexOf('approval') !== -1) {
      return ['Submit Request', 'Manager & Finance Review', 'Approved?', 'Trigger Fulfilment', 'Return with Feedback'];
    }
    if (id.indexOf('incident') !== -1 || id.indexOf('escalation') !== -1) {
      return ['Alert Triggered', 'Triage & Contain Impact', 'Severity P1?', 'Page On-Call & Mitigate', 'Standard Resolution Queue'];
    }
    if (id.indexOf('deploy') !== -1 || id.indexOf('api') !== -1) {
      return ['Commit / Request', 'Build & Automated Checks', 'Checks Pass?', 'Deploy to Production', 'Rollback & Notify'];
    }
    return ['Start: ' + title, 'Execute Core Step', 'Meets Criteria?', 'Approve & Advance', 'Revise & Retry'];
  }

  function getOrgHierarchy(id, title) {
    if (id === 'wbs') {
      return {
        root: title,
        leads: [
          { title: '1.0 Planning & Scope', c: 'blue', children: ['1.1 Charter', '1.2 Schedule'] },
          { title: '2.0 Core Execution', c: 'teal', children: ['2.1 Build', '2.2 Integration'] },
          { title: '3.0 Verification & Launch', c: 'violet', children: ['3.1 QA Sign-off', '3.2 Handover'] }
        ]
      };
    }
    return {
      root: title,
      leads: [
        { title: 'Product & Strategy', c: 'blue', children: ['Research & UX', 'Roadmap Lead'] },
        { title: 'Engineering & Ops', c: 'teal', children: ['Platform Team', 'Delivery & QA'] },
        { title: 'Growth & Client Success', c: 'violet', children: ['Partnerships', 'Account Ops'] }
      ]
    };
  }

  function getMindBranches(id, title, cat) {
    if (/study|course|lesson|book|concept|education/i.test(id + ' ' + title + ' ' + cat)) {
      return [
        { t: 'Core Concepts', sub: 'Definitions & principles', c: 'blue' },
        { t: 'Key Examples', sub: 'Case studies & proofs', c: 'green' },
        { t: 'Open Questions', sub: 'Topics to clarify', c: 'amber' },
        { t: 'Connections', sub: 'Links to prior modules', c: 'violet' },
        { t: 'Practice Tasks', sub: 'Exercises & application', c: 'pink' },
        { t: 'Summary Notes', sub: 'Exam / review takeaways', c: 'teal' }
      ];
    }
    return [
      { t: 'Objectives & Goals', sub: 'Desired outcomes & KPIs', c: 'blue' },
      { t: 'Target Audience', sub: 'Users & stakeholders', c: 'pink' },
      { t: 'Key Initiatives', sub: 'Primary workstreams', c: 'teal' },
      { t: 'Resources & Tools', sub: 'Team, budget & stack', c: 'violet' },
      { t: 'Risks & Blockers', sub: 'Assumptions to test', c: 'amber' },
      { t: 'Next Actions', sub: 'Immediate owners & dates', c: 'green' }
    ];
  }

  function getTimelineStages(id, title) {
    if (id.indexOf('journey') !== -1) {
      return [
        { stage: '1. Awareness', note: 'First touchpoint, channel & expectation', c: 'blue' },
        { stage: '2. Evaluation', note: 'Comparing options & trying templates', c: 'violet' },
        { stage: '3. Onboarding', note: 'First value achieved with team', c: 'teal' },
        { stage: '4. Expansion', note: 'Habitual adoption & advocacy', c: 'green' }
      ];
    }
    if (id === 'three-horizons') {
      return [
        { stage: 'Horizon 1 · Now', note: 'Optimize & defend core product', c: 'blue' },
        { stage: 'Horizon 2 · Next', note: 'Scale emerging growth bets', c: 'teal' },
        { stage: 'Horizon 3 · Future', note: 'R&D experiments & new category', c: 'violet' },
        { stage: 'Milestone Review', note: 'Portfolio reallocation checkpoint', c: 'green' }
      ];
    }
    return [
      { stage: 'Q1 · Foundation', note: 'Scope alignment & architecture baseline for ' + title, c: 'blue' },
      { stage: 'Q2 · Core Delivery', note: 'Primary release & stakeholder validation', c: 'violet' },
      { stage: 'Q3 · Scale & Polish', note: 'Workflow automation & integrations', c: 'teal' },
      { stage: 'Q4 · Optimization', note: 'Outcome review & next-year planning', c: 'green' }
    ];
  }

  function getMatrixQuadrants(id, title) {
    if (id === 'rose-bud-thorn') {
      return [
        { t: 'Roses (Highlights)', n1: 'Wins & positive outcomes', n2: 'What energized the team', c: 'pink' },
        { t: 'Buds (Opportunities)', n1: 'New ideas worth nurturing', n2: 'Untapped potential', c: 'green' },
        { t: 'Thorns (Challenges)', n1: 'Friction points & bottlenecks', n2: 'Risks needing attention', c: 'red' },
        { t: 'Next Commitments', n1: 'Owner & action for top bud', n2: 'Fix for sharpest thorn', c: 'blue' }
      ];
    }
    if (id === 'four-ls') {
      return [
        { t: 'Liked', n1: 'Practices worth keeping', n2: 'Standout contributions', c: 'green' },
        { t: 'Learned', n1: 'Technical & customer discoveries', n2: 'Validated hypotheses', c: 'blue' },
        { t: 'Lacked', n1: 'Missing clarity or tooling', n2: 'Handoff gaps', c: 'amber' },
        { t: 'Longed For', n1: 'Capabilities for next cycle', n2: 'Support needed from leadership', c: 'violet' }
      ];
    }
    if (id === 'bcg-matrix') {
      return [
        { t: 'Stars (High Growth · High Share)', n1: 'Flagship growth offering', n2: 'Invest to sustain leadership', c: 'amber' },
        { t: 'Question Marks (High Growth · Low Share)', n1: 'New market experiment', n2: 'Validate unit economics', c: 'violet' },
        { t: 'Cash Cows (Low Growth · High Share)', n1: 'Mature recurring line', n2: 'Harvest & automate efficiency', c: 'green' },
        { t: 'Dogs (Low Growth · Low Share)', n1: 'Legacy low-margin item', n2: 'Sunset or consolidate', c: 'slate' }
      ];
    }
    if (id === 'ansoff') {
      return [
        { t: 'Market Penetration (Existing × Existing)', n1: 'Increase adoption & retention', n2: 'Win competitor share', c: 'blue' },
        { t: 'Product Development (New × Existing)', n1: 'Launch adjacent capabilities', n2: 'Upsell existing accounts', c: 'violet' },
        { t: 'Market Development (Existing × New)', n1: 'Expand into new geographies/segments', n2: 'New distribution channels', c: 'teal' },
        { t: 'Diversification (New × New)', n1: 'Strategic long-horizon bet', n2: 'Validate via pilot cohort', c: 'amber' }
      ];
    }
    if (id.indexOf('stakeholder') !== -1) {
      return [
        { t: 'High Influence · High Interest (Manage Closely)', n1: 'Executive Sponsors', n2: 'Core Product & Ops Leads', c: 'blue' },
        { t: 'High Influence · Low Interest (Keep Satisfied)', n1: 'Finance & Legal Approvers', n2: 'Security Governance', c: 'violet' },
        { t: 'Low Influence · High Interest (Keep Informed)', n1: 'Champion Users & Advisory', n2: 'Partner Teams', c: 'teal' },
        { t: 'Low Influence · Low Interest (Monitor)', n1: 'General Observers', n2: 'Periodic digest updates', c: 'slate' }
      ];
    }
    return [
      { t: 'High Impact · Low Effort (Quick Wins)', n1: 'Immediate high-value improvement', n2: 'Fast team unlock', c: 'green' },
      { t: 'High Impact · High Effort (Strategic Bets)', n1: 'Core initiative for ' + title, n2: 'Multi-sprint investment', c: 'blue' },
      { t: 'Low Impact · Low Effort (Fill-Ins)', n1: 'Incremental polish & hygiene', n2: 'Delegate or batch', c: 'amber' },
      { t: 'Low Impact · High Effort (Defer)', n1: 'Deprioritize out-of-scope work', n2: 'Revisit only if data changes', c: 'red' }
    ];
  }

  function getTableRows(id, title) {
    if (id.indexOf('competitor') !== -1 || id.indexOf('pricing') !== -1) {
      return [
        ['Capability / Tier', 'QuantalFlow', 'Alternative A', 'Alternative B', 'Strategic Advantage'],
        ['Unified Canvas + WBS', 'Included', 'Canvas only', 'Tasks only', 'Zero context-switching'],
        ['Board-linked Docs & Quotes', 'Included', 'Add-on', 'Not available', '1:1 commercial traceability'],
        ['Real-time + Offline Sync', 'SQLite + Convex', 'Cloud only', 'Cloud only', 'Resilient field work'],
        ['Pricing Transparency', 'Predictable tiers', 'Per-seat spikes', 'Enterprise lock', 'Fast team rollout']
      ];
    }
    return [
      ['ID', 'Item / Workstream (' + title + ')', 'Owner', 'Target Date', 'Status'],
      ['01', 'Baseline scope & success metrics', 'Lead', 'Week 1', 'Complete'],
      ['02', 'Core execution & team review', 'Team', 'Week 2', 'In Progress'],
      ['03', 'Stakeholder sign-off & rollout', 'Sponsor', 'Week 3', 'Planned'],
      ['04', 'Outcome measurement & retrospective', 'Lead', 'Week 4', 'Planned']
    ];
  }

  function getPyramidTiers(id, title) {
    if (id === 'blooms') {
      return [
        { t: '1. Create — Design original work', c: 'violet' },
        { t: '2. Evaluate & Analyze — Critique & compare', c: 'blue' },
        { t: '3. Apply & Understand — Execute & explain', c: 'teal' },
        { t: '4. Remember — Recall foundational facts', c: 'green' }
      ];
    }
    if (id === 'north-star') {
      return [
        { t: 'North Star Metric — Core Customer Value Delivered', c: 'blue' },
        { t: 'Breadth, Depth & Frequency Input Levers', c: 'indigo' },
        { t: 'Active Product & Growth Experiments', c: 'teal' },
        { t: 'Foundational Data, Reliability & Team Rituals', c: 'slate' }
      ];
    }
    return [
      { t: 'Apex · Vision & North Star (' + title + ')', c: 'blue' },
      { t: 'Strategic Pillars & Annual Objectives', c: 'violet' },
      { t: 'Quarterly Programs & Key Results', c: 'teal' },
      { t: 'Foundational Systems, Cadence & Standards', c: 'green' }
    ];
  }

  function buildProjectPlan(tpl, title, desc, kind) {
    var activeView = kind === 'cal' ? 'calendar' : (kind === 'table' ? 'table' : 'gantt');
    var phases = [
      { wbs: '1.0', title: 'Initiation & Alignment', packages: [{ wbs: '1.1', title: 'Scope & Success Criteria' }] },
      { wbs: '2.0', title: 'Planning & Design', packages: [{ wbs: '2.1', title: 'Specification & Schedule' }] },
      { wbs: '3.0', title: 'Execution & Delivery', packages: [{ wbs: '3.1', title: 'Core Work Packages' }] },
      { wbs: '4.0', title: 'Review & Handover', packages: [{ wbs: '4.1', title: 'Verification & Sign-off' }] }
    ];
    var tasks = [
      { id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0', title: title + ' — Kickoff & Scope Charter', status: 'done', priority: 'high', assigneeId: 'res-1', sprint: 'Phase 1', storyPoints: 5, startDay: 1, durationDays: 4, progress: 100, budget: 18000, dependencies: [] },
      { id: 'TSK-201', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0', title: 'Detailed Schedule & Resource Allocation', status: 'in-progress', priority: 'high', assigneeId: 'res-2', sprint: 'Phase 1', storyPoints: 8, startDay: 5, durationDays: 6, progress: 55, budget: 26000, dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }] },
      { id: 'TSK-301', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0', title: 'Primary Deliverable Execution', status: 'todo', priority: 'critical', assigneeId: 'res-1', sprint: 'Phase 2', storyPoints: 13, startDay: 11, durationDays: 8, progress: 0, budget: 32000, dependencies: [{ fromTaskId: 'TSK-201', type: 'FS' }] },
      { id: 'TSK-401', wbs: '4.1.1', parentWbs: '4.1', phaseWbs: '4.0', title: 'Quality Review, Sign-off & Launch', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Phase 3', storyPoints: 5, startDay: 19, durationDays: 5, progress: 0, budget: 14000, dependencies: [{ fromTaskId: 'TSK-301', type: 'FS' }] }
    ];
    var milestones = [
      { id: 'MS-1', title: 'M1: Scope & Baseline Approved', day: 4, phaseWbs: '1.0', status: 'completed', owner: 'Project Lead' },
      { id: 'MS-2', title: 'M2: Mid-Project Readiness Review', day: 11, phaseWbs: '2.0', status: 'on-track', owner: 'Delivery Lead' },
      { id: 'MS-3', title: 'M3: Final Delivery & Handover', day: 24, phaseWbs: '4.0', status: 'on-track', owner: 'Project Lead' }
    ];
    return {
      workspaceMode: 'project-planning',
      stateVersion: 2,
      projectName: title,
      projectCode: String(tpl.id || 'PLN').slice(0, 4).toUpperCase() + '-2026',
      projectDescription: desc,
      activeSprint: 'Phase 1',
      baseBudget: 90000,
      activeModule: activeView,
      ganttScale: kind === 'timeline' ? 'weeks' : 'days',
      taskSubView: 'wbs',
      wbsPhases: phases,
      resources: [
        { id: 'res-1', name: 'Project Lead', role: 'Program Lead', category: 'Personnel — Leadership', maxHours: 40, rate: 140, availability: 'Available', avatar: 'PL' },
        { id: 'res-2', name: 'Delivery Lead', role: 'Operations & Delivery', category: 'Personnel — Execution', maxHours: 40, rate: 130, availability: 'Available', avatar: 'DL' }
      ],
      tasks: tasks,
      milestones: milestones,
      timesheets: [],
      wikiPages: desc ? [{ id: 'wiki-1', title: title + ' — Brief', updatedAt: 'Just now', author: 'Project Lead', content: desc }] : [],
      sharedFiles: [],
      raidItems: [],
      changeRequests: []
    };
  }

  function buildDocumentSpec(tpl, title, desc, kind, cat) {
    var hay = (title + ' ' + cat).toLowerCase();
    var docType = 'Report';
    if (/charter/.test(hay)) docType = 'Project Charter';
    else if (/sop|procedure|runbook/.test(hay)) docType = 'SOP';
    else if (/contract|nda|sla|agreement/.test(hay)) docType = 'Contract';
    else if (/policy|privacy|terms/.test(hay)) docType = 'Policy';
    else if (/proposal|pitch|rfp|statement of work/.test(hay)) docType = /research|thesis|grant/.test(hay) ? 'Research Proposal' : 'Client Proposal';
    else if (/strategic|strategy/.test(hay)) docType = 'Strategic Plan';
    else if (/business plan|business case/.test(hay)) docType = 'Business Plan';
    else if (/agenda|minutes|notes|one-on-one|retro/.test(hay)) docType = 'Meeting Minutes';
    else if (/syllabus|lesson|training|handbook|onboarding|guide/.test(hay)) docType = 'Training Manual';
    else if (/summary|brief|poster/.test(hay)) docType = 'Executive Brief';

    return {
      docType: docType,
      hasTable: kind === 'table' || kind === 'matrix' || kind === 'chart',
      hasChecklist: kind === 'check',
      sections: [
        { heading: 'Purpose & Context', prompt: desc || ('Define the objective, audience, and scope for ' + title + '.') },
        { heading: 'Core Structure & Deliverables', prompt: 'Detail the key workstreams, responsibilities, and measurable criteria.' },
        { heading: 'Decisions, Risks & Sign-Off', prompt: 'Record approvals, open risks, and next review dates.' }
      ]
    };
  }

  /* ---------- Translators to Each QuantalFlow Runtime Engine ---------- */

  function bestPorts(a, b) {
    var acx = a.x + (a.w || 180) / 2;
    var acy = a.y + (a.h || 80) / 2;
    var bcx = b.x + (b.w || 180) / 2;
    var bcy = b.y + (b.h || 80) / 2;
    var dx = bcx - acx;
    var dy = bcy - acy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { fp: 'e', tp: 'w' } : { fp: 'w', tp: 'e' };
    }
    return dy >= 0 ? { fp: 's', tp: 'n' } : { fp: 'n', tp: 's' };
  }

  function toWhiteboardState(bp) {
    var objects = [];
    var posLookup = {};

    bp.frames.forEach(function (f, idx) {
      var o = {
        id: f.id,
        kind: f.kind === 'swimlane' ? 'swimlane' : 'section',
        x: f.x, y: f.y, w: f.w, h: f.h,
        z: 1 + idx,
        bg: f.bg || 'rgba(248,250,252,0.82)',
        stroke: '#cbd5e1',
        strokeWidth: 1.5,
        strokeStyle: 'solid',
        opacity: 1,
        layer: 'strategy',
        orgLevel: 'Company',
        title: f.title
      };
      objects.push(o);
      posLookup[f.id] = o;
    });

    bp.tables.forEach(function (tb) {
      var o = {
        id: tb.id,
        kind: 'table',
        x: tb.x, y: tb.y, w: tb.w, h: tb.h,
        z: 12,
        bg: '#ffffff',
        stroke: '#cbd5e1',
        layer: 'operations',
        orgLevel: 'Project',
        title: bp.title,
        rows: tb.rows.map(function (r) { return r.slice(); })
      };
      objects.push(o);
      posLookup[tb.id] = o;
    });

    bp.nodes.forEach(function (n, idx) {
      var isFc = n.role === 'flowchart';
      var isSmart = n.role === 'kpi' || n.role === 'task' || n.role === 'decision';
      var kind = isSmart ? n.role : (n.role === 'sticky' ? 'sticky' : (isFc ? 'flowchart' : (n.role === 'text' ? 'text' : 'shape')));
      var bg = kind === 'sticky'
        ? n.tone.wbSticky
        : (n.filled ? n.tone.hex : (isSmart ? '#ffffff' : n.tone.fill));
      var textCol = (kind !== 'sticky' && !isSmart && n.filled) ? '#ffffff' : '#0f172a';
      var o = {
        id: n.id,
        kind: kind,
        shapeType: n.shapeType || 'round',
        x: n.x, y: n.y, w: n.w, h: n.h,
        rotate: 0,
        z: 15 + idx,
        bg: bg,
        stroke: n.tone.hex,
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        fontFamily: 'Inter, sans-serif',
        fontSize: kind === 'sticky' ? 14 : 13.5,
        textAlign: (kind === 'shape' || kind === 'flowchart') ? 'center' : 'left',
        bold: Boolean(n.filled),
        textColor: textCol,
        layer: 'strategy',
        orgLevel: 'Project',
        title: stripHtml(n.title),
        description: n.sub || '',
        status: 'In Progress',
        priority: 'High',
        kpiValue: n.kpiValue || '80%',
        kpiTarget: n.kpiTarget || '100%',
        decision: { summary: n.title, approval: 'Approved', votes: 'Aligned' },
        reactions: {},
        comments: []
      };
      objects.push(o);
      posLookup[n.id] = o;
    });

    var links = bp.edges.map(function (e, idx) {
      var a = posLookup[e.fromId];
      var b = posLookup[e.toId];
      var ports = (a && b) ? bestPorts(a, b) : { fp: 'e', tp: 'w' };
      return {
        id: e.id || ('lk_' + (idx + 1)),
        fromId: e.fromId,
        fromPort: ports.fp,
        toId: e.toId,
        toPort: ports.tp,
        routing: e.routing || 'elbow',
        startHead: 'none',
        endHead: 'arrow-filled',
        lineStyle: 'solid',
        color: e.color || bp.tone.hex,
        width: 2.2,
        label: e.label || ''
      };
    });

    return {
      version: 2,
      activeView: 'canvas',
      templateId: bp.id,
      objects: objects,
      links: links,
      paths: [],
      automations: [],
      activity: [{ id: 'ac_init', actor: 'Templates', text: 'Created from template "' + bp.title + '"', at: new Date().toISOString() }]
    };
  }

  function mapAppShape(st) {
    if (st === 'diamond') return 'diamond';
    if (st === 'circle') return 'circle';
    if (st === 'cylinder') return 'cylinder';
    if (st === 'rect') return 'rect';
    return 'round';
  }

  function toCanvasState(bp) {
    var items = [];
    bp.frames.forEach(function (f) {
      items.push({
        id: f.id,
        type: 'frame',
        x: f.x, y: f.y, w: f.w, h: f.h,
        color: bp.tone.app || 'blue',
        shapeType: 'rect',
        text: f.title,
        votes: 0
      });
    });

    bp.tables.forEach(function (tb) {
      items.push({
        id: tb.id,
        type: 'table',
        x: tb.x, y: tb.y,
        cells: tb.rows.map(function (r) { return r.slice(); }),
        votes: 0
      });
    });

    bp.nodes.forEach(function (n) {
      if (n.role === 'sticky') {
        items.push({
          id: n.id,
          type: 'sticky',
          x: n.x, y: n.y, w: n.w, h: n.h,
          color: n.tone.app || 'yellow',
          shapeType: 'rect',
          text: esc(n.title).replace(/\n/g, '<br>'),
          votes: 0
        });
      } else if (n.role === 'text') {
        items.push({
          id: n.id,
          type: 'text',
          x: n.x, y: n.y,
          color: 'yellow',
          shapeType: 'rect',
          text: esc(n.title),
          votes: 0
        });
      } else {
        var htmlTxt = esc(n.title).replace(/\n/g, '<br>');
        if (n.filled) htmlTxt = '<strong>' + htmlTxt + '</strong>';
        items.push({
          id: n.id,
          type: 'shape',
          x: n.x, y: n.y, w: n.w, h: n.h,
          color: n.tone.app || 'blue',
          shapeType: mapAppShape(n.shapeType),
          text: htmlTxt,
          votes: 0
        });
      }
    });

    var connectors = bp.edges.map(function (e, idx) {
      return {
        id: e.id || ('conn-' + (idx + 1)),
        fromId: e.fromId,
        toId: e.toId,
        label: e.label || ''
      };
    });

    return {
      version: 2,
      items: items,
      connectors: connectors,
      paths: []
    };
  }

  function toDocumentHtml(bp) {
    var spec = bp.docSpec || buildDocumentSpec({ id: bp.id }, bp.title, bp.desc, bp.kind, bp.cat);
    var extra = '';
    if (spec.hasTable) {
      var rows = getTableRows(bp.id, bp.title);
      extra = '<h2>Structured Register</h2>' +
        '<table style="width:100%;border-collapse:collapse;margin:12px 0;">' +
          '<thead><tr style="background:#f8fafc;">' +
            rows[0].map(function (h) { return '<th style="border:1px solid #cbd5e1;padding:8px 10px;text-align:left;">' + esc(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
            rows.slice(1).map(function (r) {
              return '<tr>' + r.map(function (c) { return '<td style="border:1px solid #cbd5e1;padding:8px 10px;">' + esc(c) + '</td>'; }).join('') + '</tr>';
            }).join('') +
          '</tbody></table>';
    } else if (spec.hasChecklist) {
      extra = '<h2>Verification &amp; Sign-Off Checklist</h2><ul>' +
        '<li>[ ] Confirm scope, stakeholders, and target dates for ' + esc(bp.title) + '</li>' +
        '<li>[ ] Complete required quality and compliance checks</li>' +
        '<li>[ ] Record final approval and archive supporting links</li>' +
      '</ul>';
    }
    return '<h1>' + esc(bp.title) + '</h1>' +
      '<p><em>Category: ' + esc(bp.cat) + ' &bull; Document Type: ' + esc(spec.docType) + '</em></p>' +
      spec.sections.map(function (s, idx) {
        return '<h2>' + (idx + 1) + '. ' + esc(s.heading) + '</h2><p>' + esc(s.prompt) + '</p>';
      }).join('') +
      extra +
      '<h2>Approvals &amp; Next Actions</h2>' +
      '<p>Owner: ______________________ &nbsp;&nbsp; Review Date: ______________________</p>';
  }

  /* ---------- Build Complete Persistable Workspace Bundle ---------- */
  function buildWorkspaceBundle(rawTpl) {
    var bp = compile(rawTpl);
    var mod = bp.mod;
    var canvasSnap = toCanvasState(bp);
    var wbSnap = toWhiteboardState(bp);
    var modulesMap = {};

    if (mod === 'whiteboard') {
      modulesMap.whiteboard = {
        version: 2,
        items: canvasSnap.items,
        connectors: canvasSnap.connectors,
        paths: [],
        whiteboardState: wbSnap
      };
    } else if (mod !== 'project-planning' && mod !== 'documents') {
      modulesMap[mod] = {
        version: 2,
        items: canvasSnap.items,
        connectors: canvasSnap.connectors,
        paths: []
      };
      // Also pre-seed whiteboardState so switching to Whiteboard later preserves the layout
      modulesMap.whiteboard = {
        version: 2,
        items: [],
        connectors: [],
        paths: [],
        whiteboardState: wbSnap
      };
    }

    return {
      blueprint: bp,
      module: mod,
      items: canvasSnap.items,
      connectors: canvasSnap.connectors,
      whiteboardState: wbSnap,
      plan: bp.plan,
      docType: bp.docSpec ? bp.docSpec.docType : 'Report',
      docHtml: mod === 'documents' ? toDocumentHtml(bp) : '',
      boardState: {
        version: 2,
        items: canvasSnap.items,
        connectors: canvasSnap.connectors,
        paths: [],
        modules: modulesMap,
        enabledModules: [mod === 'documents' ? 'whiteboard' : mod],
        description: bp.desc || '',
        selectedTemplate: bp.id,
        workspaceMode: mod === 'project-planning' ? 'project-planning' : 'canvas',
        activeModule: mod === 'documents' ? 'whiteboard' : mod
      }
    };
  }

  /* ---------- Live SVG Preview Renderer (1:1 Projection of Compiled Blueprint) ---------- */
  function renderPreviewSvg(rawTpl) {
    var bp = compile(rawTpl);
    var vw = 240;
    var vh = 170;
    var pad = 12;
    var b = bp.bounds;
    var scale = Math.min((vw - pad * 2) / b.w, (vh - pad * 2) / b.h);
    var tx = function (x) { return +(pad + (x - b.x) * scale + ((vw - pad * 2) - b.w * scale) / 2).toFixed(1); };
    var ty = function (y) { return +(pad + (y - b.y) * scale + ((vh - pad * 2) - b.h * scale) / 2).toFixed(1); };
    var tw = function (w) { return Math.max(4, +(w * scale).toFixed(1)); };

    var posMap = {};
    var svg = ['<svg viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'];
    svg.push('<rect width="240" height="170" fill="#ffffff"/>');

    bp.frames.forEach(function (f) {
      var x = tx(f.x), y = ty(f.y), w = tw(f.w), h = tw(f.h);
      posMap[f.id] = { x: x, y: y, w: w, h: h };
      var fill = f.bg && f.bg.indexOf('#') === 0 ? f.bg : '#f8fafc';
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + fill + '" stroke="#dde3ee" stroke-width="1"/>');
      if (f.kind === 'swimlane') {
        svg.push('<rect x="' + x + '" y="' + y + '" width="' + Math.min(16, w * 0.12) + '" height="' + h + '" rx="2" fill="' + bp.tone.hex + '" fill-opacity="0.82"/>');
      } else {
        svg.push('<rect x="' + (x + 5) + '" y="' + (y + 4) + '" width="' + Math.min(44, Math.max(14, w * 0.35)) + '" height="3.5" rx="1.5" fill="#94a3b8"/>');
      }
    });

    bp.tables.forEach(function (tb) {
      var x = tx(tb.x), y = ty(tb.y), w = tw(tb.w), h = tw(tb.h);
      posMap[tb.id] = { x: x, y: y, w: w, h: h };
      var rCount = Math.max(2, (tb.rows || []).length);
      var cCount = Math.max(2, (tb.rows && tb.rows[0] ? tb.rows[0].length : 3));
      var rh = h / rCount;
      var cw = w / cCount;
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.1"/>');
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + rh.toFixed(1) + '" rx="3" fill="' + bp.tone.hex + '"/>');
      for (var r = 1; r < rCount; r++) {
        var ly = +(y + r * rh).toFixed(1);
        svg.push('<line x1="' + x + '" y1="' + ly + '" x2="' + (x + w) + '" y2="' + ly + '" stroke="#e2e8f0" stroke-width="0.9"/>');
      }
      for (var c = 1; c < cCount; c++) {
        var lx = +(x + c * cw).toFixed(1);
        svg.push('<line x1="' + lx + '" y1="' + y + '" x2="' + lx + '" y2="' + (y + h) + '" stroke="#e2e8f0" stroke-width="0.9"/>');
      }
    });

    bp.nodes.forEach(function (n) {
      posMap[n.id] = { x: tx(n.x), y: ty(n.y), w: tw(n.w), h: tw(n.h) };
    });

    bp.edges.forEach(function (e) {
      var a = posMap[e.fromId];
      var bNode = posMap[e.toId];
      if (!a || !bNode) return;
      var x1 = +(a.x + a.w / 2).toFixed(1);
      var y1 = +(a.y + a.h / 2).toFixed(1);
      var x2 = +(bNode.x + bNode.w / 2).toFixed(1);
      var y2 = +(bNode.y + bNode.h / 2).toFixed(1);
      var col = e.color || bp.tone.hex;
      if (e.routing === 'curved') {
        var mx = +((x1 + x2) / 2).toFixed(1);
        svg.push('<path d="M' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="' + col + '" stroke-opacity="0.65" stroke-width="1.4"/>');
      } else if (e.routing === 'elbow') {
        var ex = +((x1 + x2) / 2).toFixed(1);
        svg.push('<path d="M' + x1 + ' ' + y1 + ' L ' + ex + ' ' + y1 + ' L ' + ex + ' ' + y2 + ' L ' + x2 + ' ' + y2 + '" fill="none" stroke="' + col + '" stroke-opacity="0.65" stroke-width="1.3"/>');
      } else {
        svg.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '" stroke-opacity="0.65" stroke-width="1.3"/>');
      }
    });

    bp.nodes.forEach(function (n) {
      var p = posMap[n.id];
      var fill = n.role === 'sticky' ? n.tone.wbSticky : (n.filled ? n.tone.hex : '#ffffff');
      var stroke = n.tone.hex;
      var lineCol = (n.role !== 'sticky' && n.filled) ? '#ffffffcc' : n.tone.hex + '99';

      if (n.shapeType === 'diamond') {
        var cx = +(p.x + p.w / 2).toFixed(1), cy = +(p.y + p.h / 2).toFixed(1);
        svg.push('<polygon points="' + cx + ',' + p.y + ' ' + (p.x + p.w) + ',' + cy + ' ' + cx + ',' + (p.y + p.h) + ' ' + p.x + ',' + cy + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.3"/>');
      } else if (n.shapeType === 'circle') {
        var rx = +(p.w / 2).toFixed(1), ry = +(p.h / 2).toFixed(1);
        svg.push('<ellipse cx="' + +(p.x + rx).toFixed(1) + '" cy="' + +(p.y + ry).toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2" fill-opacity="' + (n.filled ? '1' : '0.32') + '"/>');
      } else {
        var rad = (n.shapeType === 'pill' || n.shapeType === 'terminator') ? Math.round(p.h / 2) : (n.role === 'sticky' ? 2.5 : 4);
        svg.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + rad + '" fill="' + fill + '" stroke="' + stroke + '" stroke-opacity="' + (n.role === 'sticky' ? '0.45' : '0.9') + '" stroke-width="1.2"/>');
      }
      if (p.w > 16 && p.h > 8) {
        var barW = Math.max(8, +(p.w * 0.58).toFixed(1));
        var bx = +(p.x + (p.w - barW) / 2).toFixed(1);
        var by = +(p.y + p.h / 2 - 1.5).toFixed(1);
        svg.push('<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="3" rx="1.5" fill="' + lineCol + '"/>');
      }
    });

    svg.push('</svg>');
    return svg.join('');
  }

  function createBlankWhiteboardState(title) {
    return {
      version: 2,
      isBlank: true,
      activeView: 'canvas',
      objects: [],
      links: [],
      paths: [],
      automations: [],
      activity: [{ id: 'ac_blank', actor: 'You', text: 'Started blank whiteboard "' + (title || 'Untitled Whiteboard') + '"', at: new Date().toISOString() }]
    };
  }

  window.QFTemplateBlueprints = {
    compile: compile,
    buildWorkspaceBundle: buildWorkspaceBundle,
    toWhiteboardState: toWhiteboardState,
    toCanvasState: toCanvasState,
    toDocumentHtml: toDocumentHtml,
    renderPreviewSvg: renderPreviewSvg,
    createBlankWhiteboardState: createBlankWhiteboardState,
    describeIncluded: function (tpl) {
      var bp = compile(tpl);
      return bp.summary && bp.summary.length ? bp.summary : ['Structured frames & nodes', 'Connected layout', 'Ready to edit'];
    }
  };
})();
