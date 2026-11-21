/* ==========================================================================
   QuantalFlow Tool & Service Page Enhancer (assets/js/tool-pages.js)
   ==========================================================================
   Turns /product/*, /solutions/*, and /resources/* subpages into live
   Miro-style interactive tool launchers:
     1. Rewrites generic /app/ CTAs to deep-link into the exact matching tool.
     2. Replaces the generic static "Discover -> Align -> Deliver" graphic
        with a live interactive mini-tool (Kanban, Mind Map, Gantt Timeline,
        Sticky Whiteboard, or Flowchart Builder).
     3. Injects a curated 1-click "Launch a Starter Template" strip tailored
        to each tool, use case, or industry solution.
   ========================================================================== */
(function () {
  'use strict';

  var path = (window.location.pathname || '/').replace(/\/+$/, '') + '/';
  if (!/^\/(product|solutions|resources)\//.test(path)) return;
  // /resources/templates/ already has its own full interactive template gallery.
  if (path === '/resources/templates/') return;

  var PROFILES = {
    kanban: {
      toolName: 'Kanban Board',
      launchUrl: '/app/?template=kanban&module=kanban',
      sandbox: 'kanban',
      templates: [
        { title: 'Sprint Kanban Board', desc: 'Track Backlog, In Progress, Review, and Done', url: '/app/?template=kanban&module=kanban', tag: 'Kanban' },
        { title: 'Project Planning Suite', desc: 'Connect Kanban tasks directly to Gantt timelines', url: '/app/?board=project-planning-workspace&template=project-planning', tag: 'Gantt + WBS' },
        { title: 'Sprint Retrospective', desc: 'Run team retros with sticky notes and dot voting', url: '/app/?template=retro&module=brainstorm', tag: 'Workshop' }
      ]
    },
    mindmap: {
      toolName: 'Mind Map',
      launchUrl: '/app/?template=mindmap&module=mindmap',
      sandbox: 'mindmap',
      templates: [
        { title: 'Blank Mind Map', desc: 'Expand central ideas into structured visual branches', url: '/app/?template=mindmap&module=mindmap', tag: 'Mind Map' },
        { title: 'Brainstorm Canvas', desc: 'Capture rapid team ideas and cluster by theme', url: '/app/?template=brainstorm&module=brainstorm', tag: 'Ideation' },
        { title: 'SWOT Analysis', desc: 'Evaluate Strengths, Weaknesses, Opportunities, Threats', url: '/app/?template=swot&module=perspective', tag: 'Strategy' }
      ]
    },
    gantt: {
      toolName: 'Project Planning & Timelines',
      launchUrl: '/app/?board=project-planning-workspace&template=project-planning',
      sandbox: 'gantt',
      templates: [
        { title: 'Project Planning Suite', desc: 'Full WBS, interactive Gantt chart, milestones & RAID log', url: '/app/?board=project-planning-workspace&template=project-planning', tag: 'Planning' },
        { title: 'Delivery Kanban Board', desc: 'Manage sprint execution alongside project phases', url: '/app/?template=kanban&module=kanban', tag: 'Execution' },
        { title: 'Strategic Perspective', desc: 'Align leadership goals, OKRs, and quarterly roadmaps', url: '/app/?template=perspective&module=perspective', tag: 'Roadmap' }
      ]
    },
    flow: {
      toolName: 'Diagrams & Flowcharts',
      launchUrl: '/app/?template=flow&module=perspective',
      sandbox: 'flow',
      templates: [
        { title: 'Process Flowchart', desc: 'Map decision trees, swimlanes, and system workflows', url: '/app/?template=flow&module=perspective', tag: 'Diagram' },
        { title: 'Customer Journey Map', desc: 'Visualise end-to-end touchpoints and pain points', url: '/app/?template=journey&module=perspective', tag: 'Journey' },
        { title: 'Mind Map Architecture', desc: 'Structure technical hierarchies and dependencies', url: '/app/?template=mindmap&module=mindmap', tag: 'Hierarchy' }
      ]
    },
    whiteboard: {
      toolName: 'Online Whiteboard',
      launchUrl: '/app/?template=brainstorm&module=brainstorm',
      sandbox: 'whiteboard',
      templates: [
        { title: 'Freeform Whiteboard', desc: 'Infinite canvas with stickies, shapes, pen & voting', url: '/app/?template=blank&module=brainstorm', tag: 'Whiteboard' },
        { title: 'Brainstorm Workshop', desc: 'Facilitate live ideation with timer and dot voting', url: '/app/?template=brainstorm&module=brainstorm', tag: 'Workshop' },
        { title: 'Note Pad (Type & Draw)', desc: 'Quick typed and handwritten notes synced to Convex', url: '/dashboard/notepad/', tag: 'Note Pad' }
      ]
    },
    docs: {
      toolName: 'Docs & Note Pad',
      launchUrl: '/dashboard/notepad/',
      sandbox: 'whiteboard',
      templates: [
        { title: 'Open Note Pad', desc: 'Type or handwrite notes with auto-save and Convex sync', url: '/dashboard/notepad/', tag: 'Note Pad' },
        { title: 'Quotation Builder', desc: 'Draft, price, and export customer quotations as PDF', url: '/dashboard/quotation/', tag: 'Quotation' },
        { title: 'Invoice Builder', desc: 'Create branded customer invoices with live totals', url: '/dashboard/invoice/', tag: 'Invoice' }
      ]
    }
  };

  function pickProfile(p) {
    if (/kanban|agile/.test(p)) return PROFILES.kanban;
    if (/mind-maps|concept-maps|org-design/.test(p)) return PROFILES.mindmap;
    if (/timelines|roadmapping|planning-delivery|goals|product-management|product-leadership|product-operating-system|project/.test(p)) return PROFILES.gantt;
    if (/diagrams|diagramming|flows|flowcharts|process-mapping|technical-design|engineering|cloud|it|customer-journeys|customer-experience|prototypes|connectors|mcp|integrations|blueprints/.test(p)) return PROFILES.flow;
    if (/docs|tables|slides|playbooks|academy|help|blog|developers|apps/.test(p)) return PROFILES.docs;
    return PROFILES.whiteboard;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderKanbanSandbox(mount, profile) {
    var tasks = [
      { id: 1, title: 'Define Q4 milestones', col: 'todo' },
      { id: 2, title: 'Design interactive canvas', col: 'doing' },
      { id: 3, title: 'Publish team workspace', col: 'done' }
    ];
    var nextId = 4;
    var cols = [
      { key: 'todo', label: 'To Do', next: 'doing' },
      { key: 'doing', label: 'In Progress', next: 'done' },
      { key: 'done', label: 'Done', next: 'todo' }
    ];

    function draw() {
      mount.innerHTML =
        '<div class="tool-sandbox">' +
          '<div class="tool-sandbox__bar">' +
            '<span class="tool-sandbox__badge">Interactive ' + escapeHtml(profile.toolName) + ' Preview</span>' +
            '<a class="tool-sandbox__open" href="' + profile.launchUrl + '">Open Full Tool &rarr;</a>' +
          '</div>' +
          '<div class="tool-sb-kanban">' +
            cols.map(function (c) {
              var items = tasks.filter(function (t) { return t.col === c.key; });
              return '<div class="tool-sb-col">' +
                '<div class="tool-sb-col__head">' + c.label + ' <span>' + items.length + '</span></div>' +
                items.map(function (t) {
                  return '<button type="button" class="tool-sb-card" data-move-id="' + t.id + '" title="Click to move to next column">' +
                    '<span>' + escapeHtml(t.title) + '</span>' +
                    '<small>Move &rarr;</small>' +
                  '</button>';
                }).join('') +
              '</div>';
            }).join('') +
          '</div>' +
          '<form class="tool-sandbox__add" data-sb-form>' +
            '<input type="text" placeholder="Try adding a task card…" maxlength="60" />' +
            '<button type="submit">+ Add Card</button>' +
          '</form>' +
        '</div>';
    }

    draw();
    mount.addEventListener('click', function (e) {
      var card = e.target.closest('[data-move-id]');
      if (!card) return;
      var id = Number(card.getAttribute('data-move-id'));
      var t = tasks.find(function (x) { return x.id === id; });
      if (!t) return;
      var cur = cols.find(function (c) { return c.key === t.col; });
      t.col = cur ? cur.next : 'todo';
      draw();
    });
    mount.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-sb-form]')) return;
      e.preventDefault();
      var input = e.target.querySelector('input');
      var val = input ? input.value.trim() : '';
      if (!val) return;
      tasks.push({ id: nextId++, title: val, col: 'todo' });
      draw();
    });
  }

  function renderMindmapSandbox(mount, profile) {
    var branches = [
      { label: 'Core Strategy', color: '#eef2ff', ink: '#3730a3' },
      { label: 'User Research', color: '#ecfdf3', ink: '#027a48' },
      { label: 'Launch Plan', color: '#fff7ed', ink: '#c2410c' },
      { label: 'AI Automation', color: '#f5f3ff', ink: '#6d28d9' }
    ];
    var palette = [
      { color: '#eef2ff', ink: '#3730a3' },
      { color: '#ecfdf3', ink: '#027a48' },
      { color: '#fff7ed', ink: '#c2410c' },
      { color: '#fdf2f8', ink: '#be185d' }
    ];

    function draw() {
      mount.innerHTML =
        '<div class="tool-sandbox">' +
          '<div class="tool-sandbox__bar">' +
            '<span class="tool-sandbox__badge">Interactive ' + escapeHtml(profile.toolName) + ' Preview</span>' +
            '<a class="tool-sandbox__open" href="' + profile.launchUrl + '">Open Full Tool &rarr;</a>' +
          '</div>' +
          '<div class="tool-sb-mindmap">' +
            '<div class="tool-sb-mm-root">Central Idea</div>' +
            '<div class="tool-sb-mm-branches">' +
              branches.map(function (b, idx) {
                return '<button type="button" class="tool-sb-mm-node" data-del-branch="' + idx + '" style="background:' + b.color + ';color:' + b.ink + ';" title="Click to remove branch">' +
                  escapeHtml(b.label) + ' <span aria-hidden="true">&times;</span>' +
                '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<form class="tool-sandbox__add" data-sb-form>' +
            '<input type="text" placeholder="Add a new mind map branch…" maxlength="40" />' +
            '<button type="submit">+ Add Branch</button>' +
          '</form>' +
        '</div>';
    }

    draw();
    mount.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del-branch]');
      if (!btn || branches.length <= 1) return;
      branches.splice(Number(btn.getAttribute('data-del-branch')), 1);
      draw();
    });
    mount.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-sb-form]')) return;
      e.preventDefault();
      var input = e.target.querySelector('input');
      var val = input ? input.value.trim() : '';
      if (!val) return;
      var p = palette[branches.length % palette.length];
      branches.push({ label: val, color: p.color, ink: p.ink });
      draw();
    });
  }

  function renderGanttSandbox(mount, profile) {
    var rows = [
      { id: 1, name: 'Discovery & Charter', start: 4, width: 32, done: true },
      { id: 2, name: 'Architecture & Design', start: 26, width: 36, done: true },
      { id: 3, name: 'Build & QA Sprint', start: 52, width: 34, done: false },
      { id: 4, name: 'Production Launch', start: 78, width: 20, done: false }
    ];

    function draw() {
      var doneCount = rows.filter(function (r) { return r.done; }).length;
      var pct = Math.round((doneCount / rows.length) * 100);
      mount.innerHTML =
        '<div class="tool-sandbox">' +
          '<div class="tool-sandbox__bar">' +
            '<span class="tool-sandbox__badge">Interactive Timeline (' + pct + '% Complete)</span>' +
            '<a class="tool-sandbox__open" href="' + profile.launchUrl + '">Open Project Suite &rarr;</a>' +
          '</div>' +
          '<div class="tool-sb-gantt">' +
            rows.map(function (r) {
              return '<button type="button" class="tool-sb-gantt-row" data-toggle-gantt="' + r.id + '" title="Click to toggle completion">' +
                '<span class="tool-sb-gantt-label">' + (r.done ? '&#10003; ' : '&#9675; ') + escapeHtml(r.name) + '</span>' +
                '<span class="tool-sb-gantt-track">' +
                  '<span class="tool-sb-gantt-bar' + (r.done ? ' is-done' : '') + '" style="left:' + r.start + '%;width:' + r.width + '%;"></span>' +
                '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          '<div class="tool-sandbox__hint">Click any phase bar to toggle status, or launch the full WBS &amp; Gantt suite.</div>' +
        '</div>';
    }

    draw();
    mount.addEventListener('click', function (e) {
      var row = e.target.closest('[data-toggle-gantt]');
      if (!row) return;
      var id = Number(row.getAttribute('data-toggle-gantt'));
      var r = rows.find(function (x) { return x.id === id; });
      if (r) { r.done = !r.done; draw(); }
    });
  }

  function renderFlowSandbox(mount, profile) {
    var steps = ['Trigger Event', 'Validate Input', 'Run AI Agent', 'Publish Result'];

    function draw() {
      mount.innerHTML =
        '<div class="tool-sandbox">' +
          '<div class="tool-sandbox__bar">' +
            '<span class="tool-sandbox__badge">Interactive ' + escapeHtml(profile.toolName) + ' Preview</span>' +
            '<a class="tool-sandbox__open" href="' + profile.launchUrl + '">Open Diagram Canvas &rarr;</a>' +
          '</div>' +
          '<div class="tool-sb-flow">' +
            steps.map(function (s, i) {
              return '<div class="tool-sb-flow-node">' + escapeHtml(s) + '</div>' +
                (i < steps.length - 1 ? '<span class="tool-sb-flow-arrow" aria-hidden="true">&rarr;</span>' : '');
            }).join('') +
          '</div>' +
          '<form class="tool-sandbox__add" data-sb-form>' +
            '<input type="text" placeholder="Add next workflow step…" maxlength="36" />' +
            '<button type="submit">+ Add Step</button>' +
          '</form>' +
        '</div>';
    }

    draw();
    mount.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-sb-form]')) return;
      e.preventDefault();
      var input = e.target.querySelector('input');
      var val = input ? input.value.trim() : '';
      if (!val) return;
      if (steps.length >= 6) steps.shift();
      steps.push(val);
      draw();
    });
  }

  function renderWhiteboardSandbox(mount, profile) {
    var colors = ['#fef08a', '#bbf7d0', '#ddd6fe', '#bfdbfe', '#fecdd3'];
    var stickies = [
      { id: 1, text: 'Capture ideas fast', c: 0 },
      { id: 2, text: 'Group by theme', c: 1 },
      { id: 3, text: 'Vote on priorities', c: 2 },
      { id: 4, text: 'Turn into action items', c: 3 }
    ];
    var nextId = 5;

    function draw() {
      mount.innerHTML =
        '<div class="tool-sandbox">' +
          '<div class="tool-sandbox__bar">' +
            '<span class="tool-sandbox__badge">Interactive ' + escapeHtml(profile.toolName) + ' Preview</span>' +
            '<a class="tool-sandbox__open" href="' + profile.launchUrl + '">Open Full Canvas &rarr;</a>' +
          '</div>' +
          '<div class="tool-sb-stickies">' +
            stickies.map(function (s) {
              return '<button type="button" class="tool-sb-sticky" data-cycle-sticky="' + s.id + '" style="background:' + colors[s.c % colors.length] + ';" title="Click to change color">' +
                escapeHtml(s.text) +
              '</button>';
            }).join('') +
          '</div>' +
          '<form class="tool-sandbox__add" data-sb-form>' +
            '<input type="text" placeholder="Write a sticky note and press Enter…" maxlength="50" />' +
            '<button type="submit">+ Add Sticky</button>' +
          '</form>' +
        '</div>';
    }

    draw();
    mount.addEventListener('click', function (e) {
      var st = e.target.closest('[data-cycle-sticky]');
      if (!st) return;
      var id = Number(st.getAttribute('data-cycle-sticky'));
      var item = stickies.find(function (x) { return x.id === id; });
      if (item) { item.c = (item.c + 1) % colors.length; draw(); }
    });
    mount.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-sb-form]')) return;
      e.preventDefault();
      var input = e.target.querySelector('input');
      var val = input ? input.value.trim() : '';
      if (!val) return;
      if (stickies.length >= 8) stickies.shift();
      stickies.push({ id: nextId++, text: val, c: stickies.length % colors.length });
      draw();
    });
  }

  function enhancePage() {
    var profile = pickProfile(path);

    // 1. Upgrade generic /app/ CTAs to launch the exact tool/template for this page
    document.querySelectorAll('main a[href="/app/"]').forEach(function (a) {
      a.setAttribute('href', profile.launchUrl);
      if (/Try on canvas|Launch interactive board|Try in QuantalFlow App/i.test(a.textContent || '')) {
        a.innerHTML = 'Launch ' + escapeHtml(profile.toolName) + ' <span aria-hidden="true">&rarr;</span>';
      }
    });

    // 2. Replace the generic static board box with a real interactive mini-tool
    var staticBoard = document.querySelector('.split__art .board--static');
    if (staticBoard && staticBoard.parentElement) {
      var mount = document.createElement('div');
      mount.className = 'tool-sandbox-mount';
      staticBoard.replaceWith(mount);
      if (profile.sandbox === 'kanban') renderKanbanSandbox(mount, profile);
      else if (profile.sandbox === 'mindmap') renderMindmapSandbox(mount, profile);
      else if (profile.sandbox === 'gantt') renderGanttSandbox(mount, profile);
      else if (profile.sandbox === 'flow') renderFlowSandbox(mount, profile);
      else renderWhiteboardSandbox(mount, profile);
    }

    // 3. Inject curated 1-click Starter Templates strip right after #overview
    var overview = document.getElementById('overview');
    if (overview && !document.getElementById('tool-starter-kit')) {
      var sec = document.createElement('section');
      sec.id = 'tool-starter-kit';
      sec.className = 'section tool-starter-section';
      sec.innerHTML =
        '<div class="container">' +
          '<div class="tool-starter-head">' +
            '<div>' +
              '<p class="eyebrow">Ready-to-Use Workspace Tools</p>' +
              '<h2>Start immediately with a live ' + escapeHtml(profile.toolName) + ' template</h2>' +
            '</div>' +
            '<a class="btn btn--blue" href="' + profile.launchUrl + '">Launch ' + escapeHtml(profile.toolName) + '</a>' +
          '</div>' +
          '<div class="tool-starter-grid">' +
            profile.templates.map(function (t) {
              return '<a class="tool-starter-card" href="' + t.url + '">' +
                '<span class="tool-starter-card__tag">' + escapeHtml(t.tag) + '</span>' +
                '<strong>' + escapeHtml(t.title) + '</strong>' +
                '<p>' + escapeHtml(t.desc) + '</p>' +
                '<span class="tool-starter-card__cta">Open template &rarr;</span>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>';
      overview.insertAdjacentElement('afterend', sec);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhancePage);
  } else {
    enhancePage();
  }
})();
