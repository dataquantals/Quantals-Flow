/* ==========================================================================
   QuantalFlow Visual Project Operating System — Views & Intelligence Engine
   Exposes window.ProjectOSViews for assets/js/project-planning.js
   ========================================================================== */
(function () {
  'use strict';

  var ALL_STATUSES = [
    'Not Started',
    'Planned',
    'In Progress',
    'On Hold',
    'Review',
    'Completed',
    'Cancelled'
  ];

  var KANBAN_COLUMNS = [
    { key: 'Backlog', label: 'Backlog', matches: ['Not Started', 'On Hold', 'Backlog'] },
    { key: 'Planned', label: 'Planned', matches: ['Planned', 'Todo', 'To Do'] },
    { key: 'In Progress', label: 'In Progress', matches: ['In Progress'] },
    { key: 'Review', label: 'Review', matches: ['Review', 'In Review'] },
    { key: 'Completed', label: 'Completed', matches: ['Completed', 'Done'] }
  ];

  var DEP_TYPES = ['Blocks', 'Depends On', 'Related To', 'Precedes', 'Supports'];

  var DOC_CATEGORIES = [
    'Requirements Documents',
    'Meeting Notes',
    'Contracts',
    'Research',
    'Technical Documentation',
    'Presentations'
  ];

  var AI_COMMANDS = [
    'Create Project Plan',
    'Generate Sprint',
    'Generate Milestones',
    'Generate Roadmap',
    'Identify Bottlenecks',
    'Perform Risk Analysis',
    'Estimate Delivery Date',
    'Generate Status Report',
    'Generate Executive Summary',
    'Suggest Resource Allocation'
  ];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysIso(baseIso, days) {
    var d = baseIso ? new Date(baseIso + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    if (!parts[0]) return '?';
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function normalizeStatus(st) {
    var raw = String(st || 'Not Started').trim();
    var lower = raw.toLowerCase();
    if (lower === 'done' || lower === 'completed') return 'Completed';
    if (lower === 'todo' || lower === 'to do' || lower === 'planned') return 'Planned';
    if (lower === 'in-progress' || lower === 'in progress') return 'In Progress';
    if (lower === 'review' || lower === 'in review') return 'Review';
    if (lower === 'blocked' || lower === 'on hold' || lower === 'on-hold') return 'On Hold';
    if (lower === 'cancelled' || lower === 'canceled') return 'Cancelled';
    if (lower === 'backlog' || lower === 'not started' || lower === 'not-started') return 'Not Started';
    if (ALL_STATUSES.indexOf(raw) !== -1) return raw;
    return 'Not Started';
  }

  function normalizePriority(pr) {
    var lower = String(pr || 'Medium').trim().toLowerCase();
    if (lower === 'critical' || lower === 'urgent') return 'Critical';
    if (lower === 'high') return 'High';
    if (lower === 'low') return 'Low';
    return 'Medium';
  }

  function parseIsoDate(iso) {
    if (!iso || typeof iso !== 'string') return null;
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function diffDays(isoA, isoB) {
    var a = parseIsoDate(isoA);
    var b = parseIsoDate(isoB);
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function normalizeTask(t, state) {
    if (!t || typeof t !== 'object') return t;
    t.status = normalizeStatus(t.status);
    t.priority = normalizePriority(t.priority);
    if (t.status === 'Completed') t.progress = 100;
    else t.progress = Math.max(0, Math.min(100, Number(t.progress) || 0));

    // Synchronize start / dueDate / end across Kanban, Timeline, Calendar & Table
    var anchor = (state && parseIsoDate(state.startDate)) ? state.startDate : todayIso();
    var startIso = parseIsoDate(t.start) ? t.start.slice(0, 10) : null;
    var endIso = parseIsoDate(t.dueDate) ? t.dueDate.slice(0, 10) : (parseIsoDate(t.end) ? t.end.slice(0, 10) : null);

    if (!startIso && !endIso) {
      var sd = Math.max(0, (Number(t.startDay) || 1) - 1);
      var dur = Math.max(1, Number(t.durationDays) || 5);
      startIso = addDaysIso(anchor, sd);
      endIso = addDaysIso(startIso, dur - 1);
    } else if (startIso && !endIso) {
      endIso = addDaysIso(startIso, Math.max(1, Number(t.durationDays) || 5) - 1);
    } else if (!startIso && endIso) {
      startIso = addDaysIso(endIso, -(Math.max(1, Number(t.durationDays) || 5) - 1));
    }
    if (endIso < startIso) endIso = startIso;

    t.start = startIso;
    t.dueDate = endIso;
    t.end = endIso;
    t.durationDays = Math.max(1, diffDays(startIso, endIso) + 1);

    // Sync assignee name <-> assigneeId
    var resources = (state && Array.isArray(state.resources)) ? state.resources : [];
    if (t.assigneeId && !t.assignee) {
      var foundById = resources.find(function (r) { return r.id === t.assigneeId; });
      if (foundById) t.assignee = foundById.name;
    } else if (t.assignee && !t.assigneeId) {
      var foundByName = resources.find(function (r) { return r.name === t.assignee || r.id === t.assignee; });
      if (foundByName) {
        t.assigneeId = foundByName.id;
        t.assignee = foundByName.name;
      }
    }

    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    if (!Array.isArray(t.comments)) t.comments = [];
    if (!Array.isArray(t.tags)) t.tags = [];
    return t;
  }

  function isCompleted(task) {
    var s = normalizeStatus(task && task.status);
    return s === 'Completed' || Number(task && task.progress) >= 100;
  }

  function isOverdue(task) {
    if (!task || isCompleted(task)) return false;
    var due = task.dueDate || task.end;
    if (!due) return false;
    return String(due) < todayIso();
  }

  function ensureOSState(state) {
    if (!state || typeof state !== 'object') return state;
    if (state.projectOwner == null) state.projectOwner = '';
    if (state.department == null) state.department = '';
    if (state.projectStatus == null) state.projectStatus = 'Active';
    if (state.projectPriority == null) state.projectPriority = 'High';
    if (state.startDate == null) state.startDate = '';
    if (state.endDate == null) state.endDate = '';
    if (state.budgetSpent == null) state.budgetSpent = 0;
    if (state.companyName == null) state.companyName = 'QuantalFlow';
    if (state.portfolioName == null) state.portfolioName = 'Core Portfolio';
    if (!Array.isArray(state.objectives)) state.objectives = [];
    if (!Array.isArray(state.dependencies)) state.dependencies = [];
    if (!Array.isArray(state.documents)) state.documents = [];
    if (!Array.isArray(state.decisions)) state.decisions = [];
    if (!Array.isArray(state.automations)) state.automations = [];
    if (!Array.isArray(state.activityFeed)) state.activityFeed = [];
    if (!Array.isArray(state.whiteboardNodes)) state.whiteboardNodes = [];
    if (!Array.isArray(state.knowledgeLinks)) state.knowledgeLinks = [];
    if (!Array.isArray(state.aiHistory)) state.aiHistory = [];
    if (!state.clientPortal || typeof state.clientPortal !== 'object') {
      state.clientPortal = {
        enabled: false,
        expose: { progress: true, milestones: true, files: true, approvals: true, comments: false },
        roles: [
          { id: 'role-1', name: 'Executive Sponsor', role: 'Approver', email: '' },
          { id: 'role-2', name: 'Client Stakeholder', role: 'Viewer', email: '' }
        ]
      };
    }
    if (!state.hierarchyPath || typeof state.hierarchyPath !== 'object') {
      state.hierarchyPath = { level: 'project', objectiveId: null, milestoneId: null, taskId: null };
    }
    if (!state.calendarCursor) state.calendarCursor = todayIso().slice(0, 7);
    if (!state.universeZoom) state.universeZoom = 100;
    if (!state.docCategoryFilter) state.docCategoryFilter = 'ALL';
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach(function (t) { normalizeTask(t, state); });
    }
    return state;
  }

  function logActivity(state, actor, action, target, type) {
    ensureOSState(state);
    state.activityFeed.unshift({
      id: uid('act'),
      actor: actor || state.projectOwner || 'Workspace User',
      action: action,
      target: target || state.projectName || 'Project',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: todayIso(),
      type: type || 'update'
    });
    if (state.activityFeed.length > 60) state.activityFeed.length = 60;
  }

  function computeMetrics(state) {
    ensureOSState(state);
    var tasks = state.tasks || [];
    var total = tasks.length;
    var completed = tasks.filter(isCompleted).length;
    var overdue = tasks.filter(isOverdue).length;
    var milestones = (state.milestones || []).length;
    var milestonesDone = (state.milestones || []).filter(function (m) {
      return String(m.status || '').toLowerCase() === 'completed' || m.done;
    }).length;
    var team = (state.resources || []).length;
    var openRisks = (state.raidItems || []).filter(function (r) {
      var kind = String(r.type || 'Risk').toLowerCase();
      var closed = String(r.status || '').toLowerCase() === 'closed' || String(r.status || '').toLowerCase() === 'mitigated';
      return (kind === 'risk' || !r.type) && !closed;
    }).length;

    var progress = 0;
    if (total > 0) {
      var sum = tasks.reduce(function (acc, t) {
        if (isCompleted(t)) return acc + 100;
        return acc + Math.max(0, Math.min(100, Number(t.progress) || 0));
      }, 0);
      progress = Math.round(sum / total);
    }

    var baseBudget = Number(state.baseBudget) || 0;
    var spent = Number(state.budgetSpent) || 0;
    if (!spent && tasks.length) {
      spent = tasks.reduce(function (acc, t) {
        return acc + (Number(t.actualHours || 0) * 110);
      }, 0);
    }
    var budgetPct = baseBudget > 0 ? Math.round((spent / baseBudget) * 100) : 0;

    return {
      totalTasks: total,
      completedTasks: completed,
      overdueTasks: overdue,
      milestones: milestones,
      milestonesDone: milestonesDone,
      teamMembers: team,
      openRisks: openRisks,
      progress: progress,
      baseBudget: baseBudget,
      budgetSpent: spent,
      budgetPct: budgetPct
    };
  }

  function computeHealth(state) {
    var m = computeMetrics(state);
    var tasks = state.tasks || [];
    var resources = state.resources || [];
    var deps = state.dependencies || [];
    var risks = state.raidItems || [];

    // 1. Schedule Health
    var schedule = { label: 'Green', tone: 'green', note: 'On track with no overdue tasks.' };
    if (m.overdueTasks >= 3 || (m.totalTasks > 0 && m.overdueTasks / m.totalTasks > 0.25)) {
      schedule = { label: 'Red', tone: 'red', note: m.overdueTasks + ' tasks past due date.' };
    } else if (m.overdueTasks > 0) {
      schedule = { label: 'Yellow', tone: 'yellow', note: m.overdueTasks + ' task(s) overdue.' };
    }

    // 2. Budget Health
    var budget = { label: 'Green', tone: 'green', note: m.baseBudget ? m.budgetPct + '% of budget consumed.' : 'No budget ceiling set.' };
    if (m.baseBudget > 0 && m.budgetPct > 100) {
      budget = { label: 'Red', tone: 'red', note: 'Over budget (' + m.budgetPct + '%).' };
    } else if (m.baseBudget > 0 && m.budgetPct >= 85) {
      budget = { label: 'Yellow', tone: 'yellow', note: 'Approaching budget limit (' + m.budgetPct + '%).' };
    }

    // 3. Resource Health
    var overloaded = 0;
    resources.forEach(function (r) {
      var cap = Number(r.capacityHours || r.capacity || 40);
      var assigned = tasks.filter(function (t) {
        return !isCompleted(t) && (t.assignee === r.id || t.assignee === r.name);
      }).reduce(function (a, t) { return a + (Number(t.estHours || t.estimatedTime || 8)); }, 0);
      if (cap > 0 && (assigned / cap) > 1) overloaded++;
    });
    var resource = { label: 'Green', tone: 'green', note: resources.length ? 'All team workloads within capacity.' : 'No team members assigned yet.' };
    if (overloaded >= 2) resource = { label: 'Red', tone: 'red', note: overloaded + ' team members overloaded (>100%).' };
    else if (overloaded === 1) resource = { label: 'Yellow', tone: 'yellow', note: '1 team member above 100% capacity.' };

    // 4. Risk Level
    var highRisks = risks.filter(function (r) {
      var sev = (Number(r.impact) || 3) * (Number(r.probability) || 2);
      var closed = String(r.status || '').toLowerCase() === 'closed';
      return !closed && (sev >= 15 || String(r.severity || '').toLowerCase() === 'critical' || String(r.severity || '').toLowerCase() === 'high');
    }).length;
    var risk = { label: 'Green', tone: 'green', note: m.openRisks ? m.openRisks + ' low/moderate open risk(s).' : 'No open risks logged.' };
    if (highRisks >= 2) risk = { label: 'Red', tone: 'red', note: highRisks + ' high-severity risks active.' };
    else if (highRisks === 1 || m.openRisks >= 3) risk = { label: 'Yellow', tone: 'yellow', note: m.openRisks + ' open risk(s) require mitigation.' };

    // 5. Dependency Conflicts
    var conflicts = 0;
    var taskById = {};
    tasks.forEach(function (t) { taskById[t.id] = t; });
    deps.forEach(function (d) {
      var a = taskById[d.fromId];
      var b = taskById[d.toId];
      if (!a || !b) return;
      if ((d.type === 'Blocks' || d.type === 'Precedes') && !isCompleted(a) && normalizeStatus(b.status) === 'In Progress') {
        conflicts++;
      }
    });
    var depHealth = { label: 'Green', tone: 'green', note: deps.length ? deps.length + ' mapped links, 0 conflicts.' : 'No dependency conflicts.' };
    if (conflicts >= 2) depHealth = { label: 'Red', tone: 'red', note: conflicts + ' active blocking conflicts.' };
    else if (conflicts === 1) depHealth = { label: 'Yellow', tone: 'yellow', note: '1 task running while blocked.' };

    return {
      schedule: schedule,
      budget: budget,
      resource: resource,
      risk: risk,
      dependencies: depHealth
    };
  }

  function triggerAutomations(state, eventName, payload, ctx) {
    ensureOSState(state);
    var fired = 0;
    (state.automations || []).forEach(function (rule) {
      if (!rule.enabled) return;
      if (rule.trigger !== eventName) return;
      rule.runCount = (rule.runCount || 0) + 1;
      rule.lastRun = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      fired++;
      logActivity(state, 'Automation', rule.action + ' (' + rule.name + ')', payload && payload.title ? payload.title : state.projectName, 'automation');
      if (rule.action === 'Create Next Phase Tasks' && payload && payload.title) {
        state.tasks.push({
          id: uid('TSK'),
          title: 'Follow-up after ' + payload.title,
          status: 'Planned',
          priority: 'Medium',
          progress: 0,
          dueDate: addDaysIso(todayIso(), 7),
          start: todayIso(),
          end: addDaysIso(todayIso(), 7),
          estHours: 8,
          actualHours: 0,
          tags: ['automated'],
          subtasks: [],
          comments: []
        });
      }
    });
    if (fired > 0 && ctx && ctx.notify) {
      ctx.notify('Automation triggered (' + fired + ' rule' + (fired > 1 ? 's' : '') + ')');
    }
  }

  /* ========================================================================
     VIEW 1: EXECUTIVE DASHBOARD & HEALTH MONITOR
     ======================================================================== */
  function renderDashboardPane(container, state, ctx) {
    ensureOSState(state);
    var m = computeMetrics(state);
    var h = computeHealth(state);

    var healthRows = [
      { key: 'Schedule Health', data: h.schedule },
      { key: 'Budget Health', data: h.budget },
      { key: 'Resource Health', data: h.resource },
      { key: 'Risk Level', data: h.risk },
      { key: 'Dependency Conflicts', data: h.dependencies }
    ];

    container.innerHTML =
      '<div class="pos-folio">' +
        '<div>' +
          '<h1 class="pos-folio__title">' + esc(state.projectName || 'Untitled Project') + '</h1>' +
          '<div class="pos-folio__meta">' +
            '<span class="pos-meta-item">Owner: <input class="pos-inline-input" data-meta="projectOwner" value="' + esc(state.projectOwner) + '" placeholder="Assign owner" style="width:130px;font-weight:600;" /></span>' +
            '<span class="pos-meta-item">Department: <input class="pos-inline-input" data-meta="department" value="' + esc(state.department) + '" placeholder="Department" style="width:120px;font-weight:600;" /></span>' +
            '<span class="pos-meta-item">Status: ' +
              '<select class="pos-select" data-meta="projectStatus" style="min-height:26px;padding:2px 6px;font-size:12px;">' +
                ['Planned', 'Active', 'On Hold', 'Completed'].map(function (s) {
                  return '<option value="' + s + '"' + (state.projectStatus === s ? ' selected' : '') + '>' + s + '</option>';
                }).join('') +
              '</select>' +
            '</span>' +
            '<span class="pos-meta-item">Priority: ' +
              '<select class="pos-select" data-meta="projectPriority" style="min-height:26px;padding:2px 6px;font-size:12px;">' +
                ['Low', 'Medium', 'High', 'Critical'].map(function (p) {
                  return '<option value="' + p + '"' + (state.projectPriority === p ? ' selected' : '') + '>' + p + '</option>';
                }).join('') +
              '</select>' +
            '</span>' +
            '<span class="pos-meta-item">Start: <input type="date" class="pos-inline-input" data-meta="startDate" value="' + esc(state.startDate) + '" style="width:130px;" /></span>' +
            '<span class="pos-meta-item">End: <input type="date" class="pos-inline-input" data-meta="endDate" value="' + esc(state.endDate) + '" style="width:130px;" /></span>' +
            '<span class="pos-meta-item">Budget ($): <input type="number" class="pos-inline-input" data-meta="baseBudget" value="' + esc(state.baseBudget || 0) + '" style="width:100px;font-variant-numeric:tabular-nums;" /></span>' +
          '</div>' +
        '</div>' +
        '<div class="pos-folio__progress">' +
          '<div class="pos-folio__pct">' + m.progress + '%</div>' +
          '<div class="pos-folio__pct-label">Project Progress</div>' +
          '<div class="pos-progress-track" style="margin-top:8px;"><div class="pos-progress-fill" style="width:' + m.progress + '%;"></div></div>' +
        '</div>' +
      '</div>' +

      '<!-- 7 Executive KPI Cards -->' +
      '<div class="pos-kpi-grid" role="region" aria-label="Project KPIs">' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Total Tasks</span><span class="pos-kpi__val">' + m.totalTasks + '</span><span class="pos-kpi__sub">Across all phases</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Completed Tasks</span><span class="pos-kpi__val pos-kpi__val--green">' + m.completedTasks + '</span><span class="pos-kpi__sub">' + (m.totalTasks ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0) + '% completion</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Overdue Tasks</span><span class="pos-kpi__val ' + (m.overdueTasks ? 'pos-kpi__val--red' : '') + '">' + m.overdueTasks + '</span><span class="pos-kpi__sub">' + (m.overdueTasks ? 'Needs immediate review' : 'On schedule') + '</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Milestones</span><span class="pos-kpi__val pos-kpi__val--accent">' + m.milestonesDone + '/' + m.milestones + '</span><span class="pos-kpi__sub">Completed / Total</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Team Members</span><span class="pos-kpi__val">' + m.teamMembers + '</span><span class="pos-kpi__sub">Active contributors</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Open Risks</span><span class="pos-kpi__val ' + (m.openRisks ? 'pos-kpi__val--amber' : '') + '">' + m.openRisks + '</span><span class="pos-kpi__sub">Tracked in register</span></div>' +
        '<div class="pos-kpi"><span class="pos-kpi__label">Budget Used</span><span class="pos-kpi__val ' + (m.budgetPct > 90 ? 'pos-kpi__val--red' : '') + '">' + m.budgetPct + '%</span><span class="pos-kpi__sub">$' + Math.round(m.budgetSpent).toLocaleString() + ' / $' + Math.round(m.baseBudget).toLocaleString() + '</span></div>' +
      '</div>' +

      '<!-- Project Health Monitor -->' +
      '<section class="pos-panel" style="margin-bottom:20px;">' +
        '<div class="pos-panel__head">' +
          '<div><h2 class="pos-panel__title">Project Health Monitor</h2><span class="pos-panel__sub">Automatically calculated from schedule, budget, workload, risks, and dependencies</span></div>' +
          '<button class="pos-btn pos-btn--sm pos-btn--ai" data-open-ai="Perform Risk Analysis" type="button">Run AI Health Audit</button>' +
        '</div>' +
        '<div class="pos-health-list">' +
          healthRows.map(function (row) {
            return '<div class="pos-health-card">' +
              '<span class="pos-health-card__name">' + esc(row.key) + '</span>' +
              '<span class="pos-health-pill pos-health-pill--' + row.data.tone + '">' + esc(row.data.label) + '</span>' +
              '<span class="pos-health-card__note">' + esc(row.data.note) + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</section>' +

      '<!-- Hierarchy & Milestones Split -->' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head">' +
            '<div><h2 class="pos-panel__title">Project Hierarchy</h2><span class="pos-panel__sub">Project &rarr; Objective &rarr; Milestone &rarr; Task &rarr; Subtask</span></div>' +
            '<button class="pos-btn pos-btn--sm" id="pos-add-objective" type="button">+ Objective</button>' +
          '</div>' +
          (state.objectives.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No objectives defined yet. Add an objective to structure milestones and tasks, or use the AI Project Manager to generate a complete plan.</p>'
            : state.objectives.map(function (obj) {
                var linkedTasks = (state.tasks || []).filter(function (t) { return t.objectiveId === obj.id; });
                var pct = linkedTasks.length
                  ? Math.round(linkedTasks.reduce(function (a, t) { return a + (isCompleted(t) ? 100 : (Number(t.progress) || 0)); }, 0) / linkedTasks.length)
                  : (Number(obj.progress) || 0);
                return '<div style="padding:10px 0;border-bottom:1px solid var(--pos-border);display:flex;flex-direction:column;gap:6px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                    '<strong style="font-size:13px;">' + esc(obj.title) + '</strong>' +
                    '<span class="pos-tag pos-tag--blue">' + pct + '%</span>' +
                  '</div>' +
                  '<div class="pos-progress-track"><div class="pos-progress-fill" style="width:' + pct + '%;"></div></div>' +
                  '<div style="font-size:11.5px;color:var(--pos-muted);display:flex;justify-content:space-between;">' +
                    '<span>Owner: ' + esc(obj.owner || 'Unassigned') + '</span>' +
                    '<span>' + linkedTasks.length + ' task(s) &middot; Target: ' + esc(obj.targetDate || 'TBD') + '</span>' +
                  '</div>' +
                '</div>';
              }).join('')) +
        '</section>' +

        '<section class="pos-panel">' +
          '<div class="pos-panel__head">' +
            '<div><h2 class="pos-panel__title">Milestone Tracker</h2><span class="pos-panel__sub">Target dates, dependencies, and success criteria</span></div>' +
            '<button class="pos-btn pos-btn--sm" id="pos-add-milestone" type="button">+ Milestone</button>' +
          '</div>' +
          ((state.milestones || []).length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No milestones yet. Add a milestone to track phase gates and delivery dates.</p>'
            : (state.milestones || []).map(function (ms) {
                var done = String(ms.status || '').toLowerCase() === 'completed' || ms.done;
                return '<div style="padding:10px 0;border-bottom:1px solid var(--pos-border);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
                  '<div>' +
                    '<div style="font-size:13px;font-weight:600;">' + esc(ms.title) + '</div>' +
                    '<div style="font-size:11.5px;color:var(--pos-muted);margin-top:2px;">Target: ' + esc(ms.date || 'TBD') + (ms.successCriteria ? ' &middot; Criteria: ' + esc(ms.successCriteria) : '') + '</div>' +
                  '</div>' +
                  '<button class="pos-btn pos-btn--sm" data-toggle-ms="' + esc(ms.id) + '" type="button">' + (done ? 'Completed' : 'Mark Reached') + '</button>' +
                '</div>';
              }).join('')) +
        '</section>' +
      '</div>' +

      '<!-- Activity Feed -->' +
      '<section class="pos-panel">' +
        '<div class="pos-panel__head">' +
          '<div><h2 class="pos-panel__title">Live Activity Feed</h2><span class="pos-panel__sub">All project updates, approvals, and automation executions</span></div>' +
        '</div>' +
        (state.activityFeed.length === 0
          ? '<p class="pos-panel__sub" style="margin:0;">No activity recorded yet. Create tasks, update milestones, or run an AI command to populate the live feed.</p>'
          : state.activityFeed.slice(0, 8).map(function (ev) {
              return '<div style="padding:8px 0;border-bottom:1px solid var(--pos-border);display:flex;justify-content:space-between;font-size:12.5px;">' +
                '<span><strong>' + esc(ev.actor) + '</strong> ' + esc(ev.action) + ' &mdash; <em>' + esc(ev.target) + '</em></span>' +
                '<span style="color:var(--pos-muted);font-variant-numeric:tabular-nums;">' + esc(ev.time) + '</span>' +
              '</div>';
            }).join('')) +
      '</section>';

    // Bind inline project metadata inputs
    container.querySelectorAll('[data-meta]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.dataset.meta;
        state[key] = key === 'baseBudget' ? Number(el.value || 0) : el.value;
        logActivity(state, state.projectOwner || 'User', 'updated ' + key, state.projectName);
        ctx.saveAndRender();
      });
    });

    container.querySelectorAll('[data-open-ai]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ctx.openAiDock(btn.dataset.openAi);
      });
    });

    container.querySelector('#pos-add-objective')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New Objective', message: 'Enter objective title:', confirmLabel: 'Add Objective', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      state.objectives.push({
        id: uid('OBJ'),
        title: title.trim(),
        owner: state.projectOwner || '',
        progress: 0,
        targetDate: state.endDate || addDaysIso(todayIso(), 30)
      });
      logActivity(state, state.projectOwner || 'User', 'added objective', title.trim());
      ctx.saveAndRender();
    });

    container.querySelector('#pos-add-milestone')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New Milestone', message: 'Enter milestone name:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      var criteria = (await window.QFDialog.prompt({ title: 'Success criteria (optional)', message: 'Define measurable completion criteria:', confirmLabel: 'Add Milestone', cancelLabel: 'Skip' })) || '';
      state.milestones.push({
        id: uid('MS'),
        title: title.trim(),
        date: addDaysIso(todayIso(), 14),
        successCriteria: criteria.trim(),
        dependencies: [],
        status: 'Planned',
        done: false
      });
      logActivity(state, state.projectOwner || 'User', 'added milestone', title.trim());
      ctx.saveAndRender();
    });

    container.querySelectorAll('[data-toggle-ms]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ms = (state.milestones || []).find(function (x) { return x.id === btn.dataset.toggleMs; });
        if (!ms) return;
        var nowDone = !(String(ms.status || '').toLowerCase() === 'completed' || ms.done);
        ms.done = nowDone;
        ms.status = nowDone ? 'Completed' : 'Planned';
        logActivity(state, state.projectOwner || 'User', nowDone ? 'reached milestone' : 'reopened milestone', ms.title);
        if (nowDone) triggerAutomations(state, 'When Milestone Reached', ms, ctx);
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     VIEW 2: KANBAN BOARD (5 Columns + Drag & Drop + Smart Task Cards)
     ======================================================================== */
  function renderKanbanPane(container, state, ctx) {
    ensureOSState(state);
    var tasks = state.tasks || [];
    var deps = state.dependencies || [];

    function colForTask(t) {
      var st = normalizeStatus(t.status);
      for (var i = 0; i < KANBAN_COLUMNS.length; i++) {
        if (KANBAN_COLUMNS[i].matches.indexOf(st) !== -1) return KANBAN_COLUMNS[i].key;
      }
      return 'Backlog';
    }

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Kanban Board</h1><span class="pos-panel__sub">Drag cards across stages or trigger quick actions directly from Smart Task Cards</span></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-kb-new-task" type="button">+ New Task</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-kanban">' +
        KANBAN_COLUMNS.map(function (col) {
          var items = tasks.filter(function (t) { return colForTask(t) === col.key; });
          return '<div class="pos-kanban-col" data-kb-col="' + esc(col.key) + '">' +
            '<div class="pos-kanban-col__head">' +
              '<span class="pos-kanban-col__title">' + esc(col.label) + '</span>' +
              '<span class="pos-kanban-col__count">' + items.length + '</span>' +
            '</div>' +
            items.map(function (t) {
              var prio = t.priority || 'Medium';
              var pct = isCompleted(t) ? 100 : Math.max(0, Math.min(100, Number(t.progress) || 0));
              var depCount = deps.filter(function (d) { return d.fromId === t.id || d.toId === t.id; }).length;
              var assigneeName = t.assignee || t.owner || 'Unassigned';
              var res = (state.resources || []).find(function (r) { return r.id === t.assignee || r.name === t.assignee; });
              if (res) assigneeName = res.name;
              return '<article class="pos-task-card pos-task-card--' + esc(prio) + '" draggable="true" data-task-id="' + esc(t.id) + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">' +
                  '<span class="pos-task-card__title">' + esc(t.title) + '</span>' +
                  '<span class="pos-tag pos-tag--' + esc(prio.toLowerCase()) + '">' + esc(prio) + '</span>' +
                '</div>' +
                '<div class="pos-task-card__bar" title="Progress ' + pct + '%"><span style="width:' + pct + '%;"></span></div>' +
                '<div class="pos-task-card__meta">' +
                  '<span style="display:inline-flex;align-items:center;gap:6px;">' +
                    '<span class="pos-avatar" title="' + esc(assigneeName) + '">' + esc(initials(assigneeName)) + '</span>' +
                    '<span>' + esc(t.dueDate || t.end || 'No due date') + '</span>' +
                  '</span>' +
                  '<span>' + pct + '%' + (depCount ? ' &middot; ' + depCount + ' link' + (depCount > 1 ? 's' : '') : '') + '</span>' +
                '</div>' +
                '<div class="pos-task-card__actions">' +
                  '<button class="pos-card-act" data-kb-inspect="' + esc(t.id) + '" type="button">Inspect</button>' +
                  (!isCompleted(t) ? '<button class="pos-card-act" data-kb-done="' + esc(t.id) + '" type="button">Complete</button>' : '') +
                  '<button class="pos-card-act" data-kb-sub="' + esc(t.id) + '" type="button">+ Subtask</button>' +
                '</div>' +
              '</article>';
            }).join('') +
          '</div>';
        }).join('') +
      '</div>';

    container.querySelector('#pos-kb-new-task')?.addEventListener('click', function () { ctx.promptNewTask(); });

    container.querySelectorAll('[data-kb-inspect]').forEach(function (btn) {
      btn.addEventListener('click', function () { ctx.openTaskDrawer(btn.dataset.kbInspect); });
    });

    container.querySelectorAll('[data-kb-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = (state.tasks || []).find(function (x) { return x.id === btn.dataset.kbDone; });
        if (!t) return;
        t.status = 'Completed';
        t.progress = 100;
        logActivity(state, state.projectOwner || 'User', 'completed task', t.title);
        triggerAutomations(state, 'When Task Completed', t, ctx);
        ctx.saveAndRender();
      });
    });

    container.querySelectorAll('[data-kb-sub]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var t = (state.tasks || []).find(function (x) { return x.id === btn.dataset.kbSub; });
        if (!t) return;
        var stTitle = await window.QFDialog.prompt({ title: 'Add subtask', message: 'Subtask title for "' + t.title + '":', confirmLabel: 'Add Subtask', cancelLabel: 'Cancel' });
        if (!stTitle || !stTitle.trim()) return;
        if (!Array.isArray(t.subtasks)) t.subtasks = [];
        t.subtasks.push({ id: uid('SUB'), title: stTitle.trim(), done: false });
        logActivity(state, state.projectOwner || 'User', 'added subtask', stTitle.trim());
        ctx.saveAndRender();
      });
    });

    var draggedId = null;
    container.querySelectorAll('.pos-task-card[draggable="true"]').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        draggedId = card.dataset.taskId;
        if (e.dataTransfer) e.dataTransfer.setData('text/plain', draggedId);
      });
    });

    container.querySelectorAll('.pos-kanban-col').forEach(function (colEl) {
      colEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        colEl.classList.add('is-drag-over');
      });
      colEl.addEventListener('dragleave', function () {
        colEl.classList.remove('is-drag-over');
      });
      colEl.addEventListener('drop', function (e) {
        e.preventDefault();
        colEl.classList.remove('is-drag-over');
        var id = draggedId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        var targetCol = colEl.dataset.kbCol;
        var t = (state.tasks || []).find(function (x) { return x.id === id; });
        if (!t) return;
        var nextStatus = targetCol === 'Backlog' ? 'Not Started' : targetCol;
        t.status = nextStatus;
        if (nextStatus === 'Completed') t.progress = 100;
        else if (nextStatus === 'In Progress' && (!t.progress || t.progress === 0)) t.progress = 35;
        else if (nextStatus === 'Review' && (Number(t.progress) || 0) < 80) t.progress = 85;
        logActivity(state, state.projectOwner || 'User', 'moved to ' + nextStatus, t.title);
        if (nextStatus === 'Completed') triggerAutomations(state, 'When Task Completed', t, ctx);
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     VIEW 3: UNIFIED TIMELINE (GANTT) VIEW — Real Calendar Dates + Milestones
     ======================================================================== */
  function renderTimelinePane(container, state, ctx) {
    ensureOSState(state);
    var tasks = state.tasks || [];
    var milestones = state.milestones || [];
    var scale = state.ganttScale || 'days';
    var pxPerDay = scale === 'days' ? 34 : (scale === 'weeks' ? 18 : 9);
    var today = todayIso();

    // Compute visible date window spanning all tasks & milestones (minimum 28 days)
    var allDates = [today];
    tasks.forEach(function (t) {
      if (t.start) allDates.push(t.start);
      if (t.dueDate) allDates.push(t.dueDate);
    });
    milestones.forEach(function (m) {
      if (m.date) allDates.push(m.date);
    });
    allDates.sort();
    var windowStart = addDaysIso(allDates[0], -2);
    var windowEnd = addDaysIso(allDates[allDates.length - 1], 7);
    var totalDays = Math.max(28, Math.min(120, diffDays(windowStart, windowEnd) + 1));
    var trackWidth = totalDays * pxPerDay;

    var dayHeaders = [];
    for (var i = 0; i < totalDays; i++) {
      var iso = addDaysIso(windowStart, i);
      var dObj = parseIsoDate(iso);
      var dow = dObj ? dObj.getDay() : 1;
      var isWknd = dow === 0 || dow === 6;
      var label = scale === 'days'
        ? (dObj ? (dObj.getDate() === 1 || i === 0 ? dObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) : String(dObj.getDate())) : iso.slice(8))
        : (i % 7 === 0 && dObj ? dObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');
      dayHeaders.push(
        '<div class="pos-tl-day' + (isWknd ? ' is-weekend' : '') + (iso === today ? ' is-today' : '') + '" style="width:' + pxPerDay + 'px;" title="' + iso + '">' + esc(label) + '</div>'
      );
    }

    var todayOffset = diffDays(windowStart, today);
    var todayLineHtml = (todayOffset >= 0 && todayOffset < totalDays)
      ? '<div class="pos-tl-today-line" style="left:' + Math.round(todayOffset * pxPerDay + pxPerDay / 2) + 'px;" title="Today (' + today + ')"></div>'
      : '';

    var rowsHtml = '';
    if (tasks.length === 0 && milestones.length === 0) {
      rowsHtml = '<div style="padding:28px;color:var(--pos-muted);font-size:13px;">No scheduled tasks or milestones yet. Click <strong>+ New Task</strong> or open the <strong>AI Project Manager</strong> to generate a timeline.</div>';
    } else {
      // Render all tasks (every task from Kanban / Table / Calendar / AI appears here)
      tasks.forEach(function (t) {
        var offsetDays = Math.max(0, diffDays(windowStart, t.start));
        var spanDays = Math.max(1, diffDays(t.start, t.dueDate) + 1);
        var leftPx = offsetDays * pxPerDay;
        var widthPx = Math.max(Math.max(26, pxPerDay), spanDays * pxPerDay - 2);
        var st = normalizeStatus(t.status);
        var barMod = 'pos-tl-bar--' + st.replace(/\s+/g, '');
        var pct = isCompleted(t) ? 100 : (Number(t.progress) || 0);
        rowsHtml +=
          '<div class="pos-tl-row">' +
            '<div class="pos-tl-row__left">' +
              '<div style="min-width:0;flex:1;">' +
                '<div class="pos-tl-row__title" data-tl-open="' + esc(t.id) + '" title="' + esc(t.title) + '">' + esc(t.title) + '</div>' +
                '<div style="font-size:11px;color:var(--pos-muted);font-variant-numeric:tabular-nums;">' + esc(t.start) + ' &rarr; ' + esc(t.dueDate) + ' &middot; ' + esc(st) + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:3px;flex-shrink:0;">' +
                '<button class="pos-card-act" data-tl-shift="-1" data-tl-id="' + esc(t.id) + '" type="button" title="Shift 1 day earlier">&larr;</button>' +
                '<button class="pos-card-act" data-tl-shift="1" data-tl-id="' + esc(t.id) + '" type="button" title="Shift 1 day later">&rarr;</button>' +
              '</div>' +
            '</div>' +
            '<div class="pos-tl-track" style="width:' + trackWidth + 'px;background-size:' + pxPerDay + 'px 100%;">' +
              todayLineHtml +
              '<div class="pos-tl-bar ' + barMod + '" data-tl-open="' + esc(t.id) + '" style="left:' + leftPx + 'px;width:' + widthPx + 'px;" title="' + esc(t.title) + ' (' + esc(t.start) + ' to ' + esc(t.dueDate) + ', ' + pct + '%)">' +
                '<span class="pos-tl-bar__fill" style="width:' + pct + '%;"></span>' +
                '<span style="position:relative;z-index:1;">' + esc(t.title) + ' (' + pct + '%)</span>' +
              '</div>' +
            '</div>' +
          '</div>';
      });

      // Render milestones row(s)
      milestones.forEach(function (ms) {
        var msDate = parseIsoDate(ms.date) ? ms.date.slice(0, 10) : today;
        var offsetDays = Math.max(0, diffDays(windowStart, msDate));
        var leftPx = offsetDays * pxPerDay + Math.floor(pxPerDay / 2) - 7;
        rowsHtml +=
          '<div class="pos-tl-row pos-tl-row--group">' +
            '<div class="pos-tl-row__left">' +
              '<div style="min-width:0;flex:1;">' +
                '<div class="pos-tl-row__title" style="color:var(--pos-amber);">Milestone: ' + esc(ms.title) + '</div>' +
                '<div style="font-size:11px;color:var(--pos-muted);font-variant-numeric:tabular-nums;">Target: ' + esc(msDate) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="pos-tl-track" style="width:' + trackWidth + 'px;background-size:' + pxPerDay + 'px 100%;">' +
              todayLineHtml +
              '<div class="pos-tl-diamond" style="left:' + leftPx + 'px;" title="Milestone: ' + esc(ms.title) + ' (' + esc(msDate) + ')"></div>' +
            '</div>' +
          '</div>';
      });
    }

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:16px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Timeline (Gantt)</h1><span class="pos-panel__sub">Synchronized live with Kanban, Calendar, and Table &mdash; click any bar to inspect or use arrows to reschedule</span></div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<div class="pos-view-strip">' +
            ['days', 'weeks', 'months'].map(function (sc) {
              return '<button class="pos-view-pill' + (scale === sc ? ' is-active' : '') + '" data-tl-scale="' + sc + '" type="button" style="text-transform:capitalize;">' + sc + '</button>';
            }).join('') +
          '</div>' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-tl-add-task" type="button">+ New Task</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-tl-wrap">' +
        '<div class="pos-tl-grid">' +
          '<div class="pos-tl-head">' +
            '<div class="pos-tl-head__left"><span>Deliverable / Milestone (' + tasks.length + ')</span><span>Shift</span></div>' +
            '<div class="pos-tl-dates" style="width:' + trackWidth + 'px;">' + dayHeaders.join('') + '</div>' +
          '</div>' +
          rowsHtml +
        '</div>' +
      '</div>';

    container.querySelector('#pos-tl-add-task')?.addEventListener('click', function () { ctx.promptNewTask(); });
    container.querySelectorAll('[data-tl-scale]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.ganttScale = b.dataset.tlScale;
        ctx.saveAndRender();
      });
    });
    container.querySelectorAll('[data-tl-open]').forEach(function (el) {
      el.addEventListener('click', function () { ctx.openTaskDrawer(el.dataset.tlOpen); });
    });
    container.querySelectorAll('[data-tl-shift]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = (state.tasks || []).find(function (x) { return x.id === b.dataset.tlId; });
        if (!t) return;
        var delta = Number(b.dataset.tlShift) || 0;
        t.start = addDaysIso(t.start, delta);
        t.dueDate = addDaysIso(t.dueDate, delta);
        t.end = t.dueDate;
        logActivity(state, state.projectOwner || 'User', 'rescheduled to ' + t.start + ' – ' + t.dueDate, t.title);
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     VIEW 4: CALENDAR VIEW (Tasks & Milestones Synchronized by Date & Span)
     ======================================================================== */
  function renderCalendarPane(container, state, ctx) {
    ensureOSState(state);
    var ym = String(state.calendarCursor || todayIso().slice(0, 7)).split('-');
    var year = parseInt(ym[0], 10) || new Date().getFullYear();
    var month = (parseInt(ym[1], 10) || (new Date().getMonth() + 1)) - 1;
    var firstDay = new Date(year, month, 1);
    var startDow = firstDay.getDay();
    var startDate = new Date(year, month, 1 - startDow);
    var monthName = firstDay.toLocaleDateString([], { month: 'long', year: 'numeric' });
    var today = todayIso();

    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var dayTasks = (state.tasks || []).filter(function (t) {
        var s = t.start || t.dueDate;
        var e = t.dueDate || t.end || s;
        return s && e && iso >= s && iso <= e;
      });
      var dayMs = (state.milestones || []).filter(function (m) { return m.date === iso; });
      cells.push({
        iso: iso,
        day: d.getDate(),
        outside: d.getMonth() !== month,
        isToday: iso === today,
        tasks: dayTasks,
        milestones: dayMs
      });
    }

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Calendar &mdash; ' + esc(monthName) + '</h1><span class="pos-panel__sub">Synchronized with Kanban &amp; Timeline &mdash; shows full task spans, due dates, and milestones</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button class="pos-btn pos-btn--sm" id="pos-cal-prev" type="button">&larr; Prev</button>' +
          '<button class="pos-btn pos-btn--sm" id="pos-cal-today" type="button">Today</button>' +
          '<button class="pos-btn pos-btn--sm" id="pos-cal-next" type="button">Next &rarr;</button>' +
          ((state.tasks || []).length ? '<button class="pos-btn pos-btn--sm" id="pos-cal-jump" type="button">Jump to First Task</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="pos-cal-grid">' +
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (dow) {
          return '<div class="pos-cal-dow">' + dow + '</div>';
        }).join('') +
        cells.map(function (c) {
          return '<div class="pos-cal-cell' + (c.outside ? ' is-outside' : '') + (c.isToday ? ' is-today' : '') + '">' +
            '<div class="pos-cal-cell__head">' +
              '<span class="pos-cal-day">' + c.day + '</span>' +
              '<button class="pos-cal-add" data-cal-add="' + c.iso + '" type="button" title="Add task on ' + c.iso + '" aria-label="Add task on ' + c.iso + '">+</button>' +
            '</div>' +
            c.milestones.map(function (m) {
              return '<div class="pos-cal-chip pos-cal-chip--milestone" title="Milestone: ' + esc(m.title) + '">Milestone: ' + esc(m.title) + '</div>';
            }).join('') +
            c.tasks.slice(0, 4).map(function (t) {
              var isDue = t.dueDate === c.iso;
              var cls = isCompleted(t) ? ' pos-cal-chip--done' : (isDue ? '' : ' pos-cal-chip--span');
              var prefix = isDue ? 'Due: ' : '';
              return '<div class="pos-cal-chip' + cls + '" data-cal-task="' + esc(t.id) + '" title="' + esc(t.title) + ' (' + esc(t.start) + ' to ' + esc(t.dueDate) + ')">' + esc(prefix + t.title) + '</div>';
            }).join('') +
            (c.tasks.length > 4 ? '<div style="font-size:10.5px;color:var(--pos-muted);font-weight:600;">+' + (c.tasks.length - 4) + ' more</div>' : '') +
          '</div>';
        }).join('') +
      '</div>';

    function shiftMonth(delta) {
      var next = new Date(year, month + delta, 1);
      state.calendarCursor = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
      ctx.renderAll();
    }
    container.querySelector('#pos-cal-prev')?.addEventListener('click', function () { shiftMonth(-1); });
    container.querySelector('#pos-cal-next')?.addEventListener('click', function () { shiftMonth(1); });
    container.querySelector('#pos-cal-today')?.addEventListener('click', function () {
      state.calendarCursor = todayIso().slice(0, 7);
      ctx.renderAll();
    });
    container.querySelector('#pos-cal-jump')?.addEventListener('click', function () {
      var first = (state.tasks || []).find(function (t) { return t.start || t.dueDate; });
      if (first) {
        state.calendarCursor = (first.start || first.dueDate).slice(0, 7);
        ctx.renderAll();
      }
    });
    container.querySelectorAll('[data-cal-task]').forEach(function (el) {
      el.addEventListener('click', function () { ctx.openTaskDrawer(el.dataset.calTask); });
    });
    container.querySelectorAll('[data-cal-add]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var iso = btn.dataset.calAdd;
        var title = await window.QFDialog.prompt({ title: 'New task', message: 'Task title for ' + iso + ':', confirmLabel: 'Create Task', cancelLabel: 'Cancel' });
        if (!title || !title.trim()) return;
        var nt = normalizeTask({
          id: uid('TSK'),
          title: title.trim(),
          status: 'Planned',
          priority: 'Medium',
          start: iso,
          dueDate: addDaysIso(iso, 2),
          end: addDaysIso(iso, 2),
          estHours: 8,
          actualHours: 0,
          progress: 0
        }, state);
        state.tasks.push(nt);
        logActivity(state, state.projectOwner || 'User', 'scheduled task on ' + iso, nt.title);
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     VIEW 5: TABLE VIEW (Spreadsheet-Style Inline Editable)
     ======================================================================== */
  function renderTablePane(container, state, ctx) {
    ensureOSState(state);
    var tasks = state.tasks || [];
    var q = String(state.searchQuery || '').toLowerCase();
    var filtered = tasks.filter(function (t) {
      if (!q) return true;
      return String(t.title || '').toLowerCase().indexOf(q) !== -1 ||
        String(t.department || '').toLowerCase().indexOf(q) !== -1 ||
        String(t.assignee || '').toLowerCase().indexOf(q) !== -1;
    });

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:16px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Project Table</h1><span class="pos-panel__sub">Spreadsheet-style inline editing across all task fields</span></div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input class="pos-input" id="pos-tbl-search" value="' + esc(state.searchQuery || '') + '" placeholder="Filter tasks..." style="width:200px;" />' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-tbl-add" type="button">+ Add Row</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-table-wrap">' +
        '<table class="pos-table">' +
          '<thead><tr>' +
            '<th>Task Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Department</th><th>Est (h)</th><th>Actual (h)</th><th>Due Date</th><th>Progress</th><th>Actions</th>' +
          '</tr></thead>' +
          '<tbody>' +
            (filtered.length === 0
              ? '<tr><td colspan="10" style="color:var(--pos-muted);padding:20px;">No tasks match the current view. Click "+ Add Row" to create a task.</td></tr>'
              : filtered.map(function (t) {
                  var st = normalizeStatus(t.status);
                  return '<tr data-row-id="' + esc(t.id) + '">' +
                    '<td><input class="pos-inline-input" data-field="title" value="' + esc(t.title) + '" /></td>' +
                    '<td><select class="pos-select" data-field="status" style="min-height:26px;padding:2px 6px;font-size:12px;">' +
                      ALL_STATUSES.map(function (s) {
                        return '<option value="' + s + '"' + (st === s ? ' selected' : '') + '>' + s + '</option>';
                      }).join('') +
                    '</select></td>' +
                    '<td><select class="pos-select" data-field="priority" style="min-height:26px;padding:2px 6px;font-size:12px;">' +
                      ['Low', 'Medium', 'High', 'Critical'].map(function (p) {
                        return '<option value="' + p + '"' + ((t.priority || 'Medium') === p ? ' selected' : '') + '>' + p + '</option>';
                      }).join('') +
                    '</select></td>' +
                    '<td><input class="pos-inline-input" data-field="assignee" value="' + esc(t.assignee || '') + '" placeholder="Assignee" style="width:110px;" /></td>' +
                    '<td><input class="pos-inline-input" data-field="department" value="' + esc(t.department || '') + '" placeholder="Dept" style="width:100px;" /></td>' +
                    '<td><input type="number" class="pos-inline-input" data-field="estHours" value="' + esc(t.estHours || 0) + '" style="width:64px;font-variant-numeric:tabular-nums;" /></td>' +
                    '<td><input type="number" class="pos-inline-input" data-field="actualHours" value="' + esc(t.actualHours || 0) + '" style="width:64px;font-variant-numeric:tabular-nums;" /></td>' +
                    '<td><input type="date" class="pos-inline-input" data-field="dueDate" value="' + esc(t.dueDate || t.end || '') + '" style="width:130px;" /></td>' +
                    '<td><input type="number" min="0" max="100" class="pos-inline-input" data-field="progress" value="' + esc(Number(t.progress) || 0) + '" style="width:64px;font-variant-numeric:tabular-nums;" /></td>' +
                    '<td><button class="pos-card-act" data-tbl-open="' + esc(t.id) + '" type="button">Inspect</button></td>' +
                  '</tr>';
                }).join('')) +
          '</tbody>' +
        '</table>' +
      '</div>';

    container.querySelector('#pos-tbl-search')?.addEventListener('input', function (e) {
      state.searchQuery = e.target.value;
      renderTablePane(container, state, ctx);
    });
    container.querySelector('#pos-tbl-add')?.addEventListener('click', function () { ctx.promptNewTask(); });
    container.querySelectorAll('[data-tbl-open]').forEach(function (b) {
      b.addEventListener('click', function () { ctx.openTaskDrawer(b.dataset.tblOpen); });
    });
    container.querySelectorAll('tr[data-row-id] [data-field]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var rowId = inp.closest('tr').dataset.rowId;
        var t = (state.tasks || []).find(function (x) { return x.id === rowId; });
        if (!t) return;
        var f = inp.dataset.field;
        var val = (f === 'estHours' || f === 'actualHours' || f === 'progress') ? Number(inp.value || 0) : inp.value;
        t[f] = val;
        if (f === 'dueDate') t.end = val;
        if (f === 'status' && val === 'Completed') {
          t.progress = 100;
          triggerAutomations(state, 'When Task Completed', t, ctx);
        }
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     VIEW 6: MIND MAP VIEW (Interactive Hierarchical SVG Tree)
     ======================================================================== */
  function renderMindMapPane(container, state, ctx) {
    ensureOSState(state);
    var nodes = [];
    var edges = [];
    var rootX = 80, rootY = 250;
    nodes.push({ id: 'ROOT', label: state.projectName || 'Project', kind: 'Project', x: rootX, y: rootY, accent: true });

    var branches = state.objectives.length
      ? state.objectives.map(function (o) { return { id: o.id, label: o.title, kind: 'Objective' }; })
      : (state.milestones || []).map(function (m) { return { id: m.id, label: m.title, kind: 'Milestone' }; });

    if (branches.length === 0 && (state.tasks || []).length > 0) {
      branches = [{ id: 'DEFAULT-BRANCH', label: 'Core Deliverables', kind: 'Phase' }];
    }

    var bGap = branches.length ? Math.max(72, Math.floor(440 / Math.max(1, branches.length))) : 90;
    branches.forEach(function (b, bi) {
      var bx = 330;
      var by = 60 + bi * bGap;
      nodes.push({ id: b.id, label: b.label, kind: b.kind, x: bx, y: by });
      edges.push({ x1: rootX + 165, y1: rootY + 22, x2: bx, y2: by + 20 });

      var childTasks = (state.tasks || []).filter(function (t) {
        if (b.id === 'DEFAULT-BRANCH') return true;
        return t.objectiveId === b.id || t.milestoneId === b.id;
      });
      if (childTasks.length === 0 && bi === 0 && (state.tasks || []).length > 0) {
        childTasks = (state.tasks || []).slice(0, 6);
      }
      childTasks.slice(0, 6).forEach(function (t, ti) {
        var tx = 610;
        var ty = Math.max(30, by - 24 + ti * 56);
        nodes.push({ id: t.id, label: t.title, kind: normalizeStatus(t.status), x: tx, y: ty, taskId: t.id });
        edges.push({ x1: bx + 165, y1: by + 20, x2: tx, y2: ty + 18 });
      });
    });

    var svgH = Math.max(520, nodes.reduce(function (mx, n) { return Math.max(mx, n.y + 80); }, 520));

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:16px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Mind Map View</h1><span class="pos-panel__sub">Intelligent project hierarchy &mdash; click any task node to inspect or add branches</span></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="pos-btn pos-btn--sm" id="pos-mm-add-obj" type="button">+ Add Objective Node</button>' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-mm-add-task" type="button">+ Add Task Node</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-canvas-stage" style="height:auto;min-height:520px;overflow:auto;">' +
        '<svg width="960" height="' + svgH + '" viewBox="0 0 960 ' + svgH + '" role="img" aria-label="Project Mind Map">' +
          edges.map(function (e) {
            var cx = (e.x1 + e.x2) / 2;
            return '<path d="M ' + e.x1 + ' ' + e.y1 + ' C ' + cx + ' ' + e.y1 + ', ' + cx + ' ' + e.y2 + ', ' + e.x2 + ' ' + e.y2 + '" fill="none" stroke="#9ca3af" stroke-width="1.5" />';
          }).join('') +
          nodes.map(function (n) {
            var fill = n.accent ? '#002fa7' : '#ffffff';
            var stroke = n.accent ? '#002fa7' : '#111827';
            var textCol = n.accent ? '#ffffff' : '#111827';
            var subCol = n.accent ? '#dbeafe' : '#4b5563';
            return '<g ' + (n.taskId ? 'data-mm-task="' + esc(n.taskId) + '" style="cursor:pointer;"' : '') + '>' +
              '<rect x="' + n.x + '" y="' + n.y + '" width="175" height="44" rx="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.25" />' +
              '<text x="' + (n.x + 10) + '" y="' + (n.y + 17) + '" font-size="10" font-weight="700" fill="' + subCol + '">' + esc(n.kind.toUpperCase()) + '</text>' +
              '<text x="' + (n.x + 10) + '" y="' + (n.y + 33) + '" font-size="12" font-weight="600" fill="' + textCol + '">' + esc(String(n.label).slice(0, 22)) + '</text>' +
            '</g>';
          }).join('') +
        '</svg>' +
      '</div>';

    container.querySelector('#pos-mm-add-obj')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New Objective node', message: 'Enter node title:', confirmLabel: 'Add Node', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      state.objectives.push({ id: uid('OBJ'), title: title.trim(), owner: state.projectOwner || '', progress: 0 });
      ctx.saveAndRender();
    });
    container.querySelector('#pos-mm-add-task')?.addEventListener('click', function () { ctx.promptNewTask(); });
    container.querySelectorAll('[data-mm-task]').forEach(function (g) {
      g.addEventListener('click', function () { ctx.openTaskDrawer(g.getAttribute('data-mm-task')); });
    });
  }

  /* ========================================================================
     VIEW 7: WHITEBOARD VIEW (Visual Planning Canvas)
     ======================================================================== */
  function renderWhiteboardPane(container, state, ctx) {
    ensureOSState(state);
    var nodes = state.whiteboardNodes;

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:16px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Visual Planning Whiteboard</h1><span class="pos-panel__sub">Drag notes freely to map architecture, sprint ideas, and decisions</span></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-wb-add-note" type="button">+ Sticky Note</button>' +
          '<button class="pos-btn pos-btn--sm" id="pos-wb-add-frame" type="button">+ Planning Frame</button>' +
          '<button class="pos-btn pos-btn--sm" id="pos-wb-sync-tasks" type="button">Pull Tasks to Board</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-canvas-stage" id="pos-wb-stage">' +
        (nodes.length === 0
          ? '<div style="padding:36px;color:var(--pos-muted);font-size:13px;">Whiteboard is empty. Add a sticky note, planning frame, or pull existing project tasks onto the canvas.</div>'
          : nodes.map(function (n) {
              var toneCls = n.tone ? ' pos-wb-node--' + n.tone : '';
              return '<div class="pos-wb-node' + toneCls + '" data-wb-id="' + esc(n.id) + '" style="left:' + (Number(n.x) || 40) + 'px;top:' + (Number(n.y) || 40) + 'px;">' +
                '<div class="pos-wb-node__head">' +
                  '<span>' + esc(n.type || 'Note') + '</span>' +
                  '<button class="pos-card-act" data-wb-del="' + esc(n.id) + '" type="button" aria-label="Delete node">&times;</button>' +
                '</div>' +
                '<div style="font-size:13px;font-weight:700;margin-bottom:4px;">' + esc(n.title) + '</div>' +
                (n.body ? '<div style="font-size:12px;color:var(--pos-ink-2);line-height:1.4;">' + esc(n.body) + '</div>' : '') +
              '</div>';
            }).join('')) +
      '</div>';

    container.querySelector('#pos-wb-add-note')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New sticky note', message: 'Note headline:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      var body = (await window.QFDialog.prompt({ title: 'Note details (optional)', message: 'Add supporting details:', confirmLabel: 'Add Note', cancelLabel: 'Skip' })) || '';
      var tones = ['', 'blue', 'amber', 'green'];
      state.whiteboardNodes.push({
        id: uid('WB'),
        type: 'Sticky Note',
        title: title.trim(),
        body: body.trim(),
        x: 40 + (state.whiteboardNodes.length % 4) * 210,
        y: 40 + Math.floor(state.whiteboardNodes.length / 4) * 130,
        tone: tones[state.whiteboardNodes.length % tones.length]
      });
      ctx.saveAndRender();
    });

    container.querySelector('#pos-wb-add-frame')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New planning frame', message: 'Frame title:', confirmLabel: 'Add Frame', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      state.whiteboardNodes.push({
        id: uid('WB'),
        type: 'Frame',
        title: title.trim(),
        body: 'Group related tasks or decisions inside this zone.',
        x: 60 + (state.whiteboardNodes.length % 3) * 240,
        y: 60 + Math.floor(state.whiteboardNodes.length / 3) * 140,
        tone: 'blue'
      });
      ctx.saveAndRender();
    });

    container.querySelector('#pos-wb-sync-tasks')?.addEventListener('click', function () {
      var existingLinked = {};
      state.whiteboardNodes.forEach(function (n) { if (n.linkedTaskId) existingLinked[n.linkedTaskId] = true; });
      (state.tasks || []).slice(0, 8).forEach(function (t, idx) {
        if (existingLinked[t.id]) return;
        state.whiteboardNodes.push({
          id: uid('WB'),
          type: 'Task Card',
          title: t.title,
          body: normalizeStatus(t.status) + ' · ' + (t.priority || 'Medium') + ' priority',
          x: 40 + (idx % 4) * 215,
          y: 40 + Math.floor(idx / 4) * 125,
          tone: isCompleted(t) ? 'green' : '',
          linkedTaskId: t.id
        });
      });
      ctx.saveAndRender();
    });

    container.querySelectorAll('[data-wb-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.whiteboardNodes = state.whiteboardNodes.filter(function (n) { return n.id !== btn.dataset.wbDel; });
        ctx.saveAndRender();
      });
    });

    // Pointer drag for whiteboard nodes
    var stage = container.querySelector('#pos-wb-stage');
    if (stage) {
      stage.querySelectorAll('.pos-wb-node').forEach(function (el) {
        el.addEventListener('mousedown', function (e) {
          if (e.target.closest('button')) return;
          var id = el.dataset.wbId;
          var node = state.whiteboardNodes.find(function (n) { return n.id === id; });
          if (!node) return;
          var startX = e.clientX, startY = e.clientY;
          var origX = Number(node.x) || 40, origY = Number(node.y) || 40;
          function onMove(ev) {
            node.x = Math.max(8, origX + (ev.clientX - startX));
            node.y = Math.max(8, origY + (ev.clientY - startY));
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';
          }
          function onUp() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            ctx.saveOnly();
          }
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });
      });
    }
  }

  /* ========================================================================
     OPERATING MODULE: TEAM WORKSPACE & WORKLOAD BALANCING
     ======================================================================== */
  function renderTeamPane(container, state, ctx) {
    ensureOSState(state);
    var resources = state.resources || [];
    var tasks = state.tasks || [];

    var rows = resources.map(function (r) {
      var memberTasks = tasks.filter(function (t) { return t.assignee === r.id || t.assignee === r.name; });
      var current = memberTasks.filter(function (t) { return !isCompleted(t); });
      var done = memberTasks.filter(isCompleted);
      var cap = Number(r.capacityHours || r.capacity || 40);
      var hours = current.reduce(function (a, t) { return a + (Number(t.estHours || 8)); }, 0);
      var util = cap > 0 ? Math.round((hours / cap) * 100) : 0;
      var avail = Math.max(0, cap - hours);
      return { res: r, current: current.length, done: done.length, cap: cap, hours: hours, util: util, avail: avail };
    });

    var overloaded = rows.filter(function (x) { return x.util > 100; });
    var underloaded = rows.filter(function (x) { return x.util < 60; });

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Team Workspace</h1><span class="pos-panel__sub">Workload, capacity, availability, and automatic balancing insights</span></div>' +
        '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-team-add" type="button">+ Add Team Member</button>' +
      '</div>' +
      '<section class="pos-panel" style="margin-bottom:18px;">' +
        '<div class="pos-panel__head"><h2 class="pos-panel__title">Workload Balancing Insights</h2>' +
          '<button class="pos-btn pos-btn--sm pos-btn--ai" data-open-ai="Suggest Resource Allocation" type="button">AI Rebalance Plan</button>' +
        '</div>' +
        '<p class="pos-panel__sub" style="margin:0;">' +
          (rows.length === 0
            ? 'Add team members to compute real-time capacity utilization and detect bottlenecks.'
            : (overloaded.length
                ? overloaded.length + ' member(s) exceed 100% weekly capacity (' + overloaded.map(function (x) { return x.res.name + ' ' + x.util + '%'; }).join(', ') + '). ' +
                  (underloaded.length ? 'Reassign tasks to ' + underloaded.map(function (x) { return x.res.name + ' (' + x.avail + 'h free)'; }).join(', ') + '.' : 'Consider extending timeline or adding capacity.')
                : 'Team workload is balanced. No member currently exceeds 100% capacity.')) +
        '</p>' +
      '</section>' +
      '<div class="pos-table-wrap">' +
        '<table class="pos-table">' +
          '<thead><tr><th>Team Member</th><th>Position</th><th>Current Tasks</th><th>Completed</th><th>Workload</th><th>Capacity</th><th>Availability</th></tr></thead>' +
          '<tbody>' +
            (rows.length === 0
              ? '<tr><td colspan="7" style="color:var(--pos-muted);padding:20px;">No team members added yet.</td></tr>'
              : rows.map(function (r) {
                  var barCls = r.util > 100 ? 'pos-progress-fill--red' : (r.util > 80 ? 'pos-progress-fill--amber' : 'pos-progress-fill--green');
                  return '<tr>' +
                    '<td style="display:flex;align-items:center;gap:8px;"><span class="pos-avatar">' + esc(initials(r.res.name)) + '</span><strong>' + esc(r.res.name) + '</strong></td>' +
                    '<td>' + esc(r.res.role || r.res.position || 'Contributor') + '</td>' +
                    '<td style="font-variant-numeric:tabular-nums;">' + r.current + '</td>' +
                    '<td style="font-variant-numeric:tabular-nums;">' + r.done + '</td>' +
                    '<td style="min-width:160px;">' +
                      '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;"><span>' + r.hours + 'h</span><strong>' + r.util + '%</strong></div>' +
                      '<div class="pos-progress-track"><div class="pos-progress-fill ' + barCls + '" style="width:' + Math.min(100, r.util) + '%;"></div></div>' +
                    '</td>' +
                    '<td style="font-variant-numeric:tabular-nums;">' + r.cap + 'h / wk</td>' +
                    '<td><span class="pos-tag ' + (r.avail > 0 ? 'pos-tag--green' : 'pos-tag--red') + '">' + (r.avail > 0 ? r.avail + 'h available' : 'At capacity') + '</span></td>' +
                  '</tr>';
                }).join('')) +
          '</tbody>' +
        '</table>' +
      '</div>';

    container.querySelector('#pos-team-add')?.addEventListener('click', async function () {
      var name = await window.QFDialog.prompt({ title: 'Add team member', message: 'Team member name:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!name || !name.trim()) return;
      var role = (await window.QFDialog.prompt({ title: 'Position / Role', defaultValue: 'Product Engineer', confirmLabel: 'Next', cancelLabel: 'Skip' })) || 'Product Engineer';
      var cap = Number(await window.QFDialog.prompt({ title: 'Weekly capacity (hours)', defaultValue: '40', confirmLabel: 'Add Member', cancelLabel: 'Cancel' })) || 40;
      state.resources.push({ id: uid('res'), name: name.trim(), role: role.trim(), capacityHours: cap });
      logActivity(state, state.projectOwner || 'User', 'added team member', name.trim());
      ctx.saveAndRender();
    });
    container.querySelectorAll('[data-open-ai]').forEach(function (b) {
      b.addEventListener('click', function () { ctx.openAiDock(b.dataset.openAi); });
    });
  }

  /* ========================================================================
     OPERATING MODULE: DEPENDENCY ENGINE & KNOWLEDGE GRAPH
     ======================================================================== */
  function renderDependenciesPane(container, state, ctx) {
    ensureOSState(state);
    var tasks = state.tasks || [];
    var deps = state.dependencies || [];
    var taskMap = {};
    tasks.forEach(function (t) { taskMap[t.id] = t; });

    // Knowledge Graph nodes
    var kgNodes = [
      { id: 'kg-proj', label: state.projectName || 'Project', type: 'Project', x: 420, y: 170, accent: true },
      { id: 'kg-dept', label: state.department || 'Department', type: 'Department', x: 120, y: 70 },
      { id: 'kg-team', label: (state.resources || []).length + ' Team Members', type: 'Teams', x: 120, y: 180 },
      { id: 'kg-goals', label: state.objectives.length + ' Objectives', type: 'Goals', x: 120, y: 290 },
      { id: 'kg-tasks', label: tasks.length + ' Tasks', type: 'Tasks', x: 720, y: 70 },
      { id: 'kg-files', label: (state.documents.length + (state.sharedFiles || []).length) + ' Documents', type: 'Files', x: 720, y: 180 },
      { id: 'kg-client', label: state.clientPortal.enabled ? 'Client Portal Active' : 'Client Stakeholders', type: 'Clients', x: 720, y: 290 }
    ];

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Dependency Engine &amp; Knowledge Graph</h1><span class="pos-panel__sub">Map task dependencies (Blocks, Depends On, Related To, Precedes, Supports) and organizational relationships</span></div>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Dependency Mapping</h2></div>' +
          (tasks.length < 2
            ? '<p class="pos-panel__sub">Add at least two tasks to map dependencies between deliverables.</p>'
            : '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">' +
                '<select class="pos-select" id="pos-dep-from">' + tasks.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>'; }).join('') + '</select>' +
                '<select class="pos-select" id="pos-dep-type">' + DEP_TYPES.map(function (dt) { return '<option value="' + dt + '">' + dt + '</option>'; }).join('') + '</select>' +
                '<select class="pos-select" id="pos-dep-to">' + tasks.map(function (t, i) { return '<option value="' + esc(t.id) + '"' + (i === 1 ? ' selected' : '') + '>' + esc(t.title) + '</option>'; }).join('') + '</select>' +
                '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-dep-add" type="button">Add Link</button>' +
              '</div>') +
          (deps.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No dependency links created yet.</p>'
            : deps.map(function (d) {
                var f = taskMap[d.fromId], t = taskMap[d.toId];
                return '<div style="padding:8px 0;border-bottom:1px solid var(--pos-border);display:flex;justify-content:space-between;align-items:center;font-size:12.5px;">' +
                  '<span><strong>' + esc(f ? f.title : d.fromId) + '</strong> <span class="pos-tag pos-tag--blue">' + esc(d.type) + '</span> <strong>' + esc(t ? t.title : d.toId) + '</strong></span>' +
                  '<button class="pos-card-act" data-dep-del="' + esc(d.id) + '" type="button">Remove</button>' +
                '</div>';
              }).join('')) +
        '</section>' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Knowledge Graph</h2><span class="pos-panel__sub">Connected entities across the QuantalFlow ecosystem</span></div>' +
          '<svg width="100%" height="360" viewBox="0 0 920 360" role="img" aria-label="Knowledge Graph">' +
            kgNodes.slice(1).map(function (n) {
              return '<line x1="' + (kgNodes[0].x + 80) + '" y1="' + (kgNodes[0].y + 22) + '" x2="' + (n.x + 80) + '" y2="' + (n.y + 22) + '" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3" />';
            }).join('') +
            kgNodes.map(function (n) {
              var fill = n.accent ? '#002fa7' : '#ffffff';
              var stroke = n.accent ? '#002fa7' : '#111827';
              var fg = n.accent ? '#ffffff' : '#111827';
              var sub = n.accent ? '#dbeafe' : '#4b5563';
              return '<g>' +
                '<rect x="' + n.x + '" y="' + n.y + '" width="165" height="46" rx="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.25" />' +
                '<text x="' + (n.x + 10) + '" y="' + (n.y + 17) + '" font-size="10" font-weight="700" fill="' + sub + '">' + esc(n.type.toUpperCase()) + '</text>' +
                '<text x="' + (n.x + 10) + '" y="' + (n.y + 34) + '" font-size="12" font-weight="600" fill="' + fg + '">' + esc(String(n.label).slice(0, 22)) + '</text>' +
              '</g>';
            }).join('') +
          '</svg>' +
        '</section>' +
      '</div>';

    container.querySelector('#pos-dep-add')?.addEventListener('click', function () {
      var fromId = container.querySelector('#pos-dep-from').value;
      var toId = container.querySelector('#pos-dep-to').value;
      var type = container.querySelector('#pos-dep-type').value;
      if (fromId === toId) return;
      state.dependencies.push({ id: uid('DEP'), fromId: fromId, toId: toId, type: type });
      logActivity(state, state.projectOwner || 'User', 'mapped dependency (' + type + ')', (taskMap[fromId] ? taskMap[fromId].title : fromId));
      ctx.saveAndRender();
    });
    container.querySelectorAll('[data-dep-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.dependencies = state.dependencies.filter(function (d) { return d.id !== b.dataset.depDel; });
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     OPERATING MODULE: DOCUMENT HUB & DECISION CENTRE
     ======================================================================== */
  function renderDocsDecisionsPane(container, state, ctx) {
    ensureOSState(state);
    var cat = state.docCategoryFilter || 'ALL';
    var docs = state.documents.filter(function (d) { return cat === 'ALL' || d.category === cat; });

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Document Hub &amp; Decision Centre</h1><span class="pos-panel__sub">Centralized project knowledge, specifications, and immutable architectural decision records</span></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-doc-add" type="button">+ New Document</button>' +
          '<button class="pos-btn pos-btn--sm" id="pos-dec-add" type="button">+ Log Decision</button>' +
        '</div>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head">' +
            '<h2 class="pos-panel__title">Project Document Hub</h2>' +
            '<select class="pos-select" id="pos-doc-filter" style="min-height:28px;font-size:12px;">' +
              '<option value="ALL"' + (cat === 'ALL' ? ' selected' : '') + '>All Categories</option>' +
              DOC_CATEGORIES.map(function (c) { return '<option value="' + c + '"' + (cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          (docs.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No documents in this category yet. Store Requirements, Meeting Notes, Contracts, Research, Technical Docs, and Presentations here.</p>'
            : docs.map(function (d) {
                return '<div style="padding:10px 0;border-bottom:1px solid var(--pos-border);">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                    '<strong style="font-size:13px;">' + esc(d.title) + '</strong>' +
                    '<span class="pos-tag">' + esc(d.category) + '</span>' +
                  '</div>' +
                  (d.content ? '<p style="margin:6px 0 4px;font-size:12.5px;color:var(--pos-ink-2);">' + esc(d.content) + '</p>' : '') +
                  '<div style="font-size:11px;color:var(--pos-muted);">Author: ' + esc(d.author || 'Workspace User') + ' &middot; Updated ' + esc(d.updatedAt || todayIso()) + '</div>' +
                '</div>';
              }).join('')) +
        '</section>' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Decision Centre</h2><span class="pos-panel__sub">Historical governance &amp; approvals</span></div>' +
          (state.decisions.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No decision records logged yet. Capture summary, participants, risk assessment, and approval status.</p>'
            : state.decisions.map(function (dec) {
                var tone = dec.approvalStatus === 'Approved' ? 'green' : (dec.approvalStatus === 'Rejected' ? 'red' : 'amber');
                return '<div style="padding:10px 0;border-bottom:1px solid var(--pos-border);">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                    '<strong style="font-size:13px;">' + esc(dec.summary) + '</strong>' +
                    '<span class="pos-tag pos-tag--' + tone + '">' + esc(dec.approvalStatus || 'Proposed') + '</span>' +
                  '</div>' +
                  '<div style="font-size:12px;color:var(--pos-ink-2);margin-top:4px;">Participants: ' + esc(dec.participants || 'Team') + ' &middot; Risk: ' + esc(dec.riskAssessment || 'Low') + '</div>' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">' +
                    '<span style="font-size:11px;color:var(--pos-muted);">Recorded ' + esc(dec.date || todayIso()) + '</span>' +
                    (dec.approvalStatus !== 'Approved' ? '<button class="pos-card-act" data-approve-dec="' + esc(dec.id) + '" type="button">Approve</button>' : '') +
                  '</div>' +
                '</div>';
              }).join('')) +
        '</section>' +
      '</div>';

    container.querySelector('#pos-doc-filter')?.addEventListener('change', function (e) {
      state.docCategoryFilter = e.target.value;
      renderDocsDecisionsPane(container, state, ctx);
    });
    container.querySelector('#pos-doc-add')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'New document', message: 'Document title:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      var category = (await window.QFDialog.prompt({ title: 'Document category', message: 'Choose: ' + DOC_CATEGORIES.join(' / '), defaultValue: DOC_CATEGORIES[0], confirmLabel: 'Next', cancelLabel: 'Skip' })) || DOC_CATEGORIES[0];
      var content = (await window.QFDialog.prompt({ title: 'Summary / Notes', message: 'Optional document notes:', confirmLabel: 'Create Document', cancelLabel: 'Skip' })) || '';
      state.documents.unshift({
        id: uid('DOC'),
        title: title.trim(),
        category: DOC_CATEGORIES.indexOf(category) !== -1 ? category : DOC_CATEGORIES[0],
        author: state.projectOwner || 'Workspace User',
        updatedAt: todayIso(),
        content: content.trim()
      });
      logActivity(state, state.projectOwner || 'User', 'added document', title.trim());
      ctx.saveAndRender();
    });
    container.querySelector('#pos-dec-add')?.addEventListener('click', async function () {
      var summary = await window.QFDialog.prompt({ title: 'Log decision', message: 'Decision summary:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!summary || !summary.trim()) return;
      var participants = (await window.QFDialog.prompt({ title: 'Participants', message: 'Comma-separated names:', defaultValue: state.projectOwner || 'Leadership', confirmLabel: 'Next', cancelLabel: 'Skip' })) || state.projectOwner || 'Leadership';
      var riskAssessment = (await window.QFDialog.prompt({ title: 'Risk assessment', defaultValue: 'Low impact', confirmLabel: 'Log Decision', cancelLabel: 'Skip' })) || 'Low impact';
      state.decisions.unshift({
        id: uid('DEC'),
        summary: summary.trim(),
        participants: participants.trim(),
        riskAssessment: riskAssessment.trim(),
        approvalStatus: 'Proposed',
        date: todayIso()
      });
      logActivity(state, state.projectOwner || 'User', 'logged decision', summary.trim());
      ctx.saveAndRender();
    });
    container.querySelectorAll('[data-approve-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dec = state.decisions.find(function (d) { return d.id === b.dataset.approveDec; });
        if (!dec) return;
        dec.approvalStatus = 'Approved';
        logActivity(state, state.projectOwner || 'User', 'approved decision', dec.summary, 'approval');
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     OPERATING MODULE: RISK REGISTER & 5x5 HEATMAP
     ======================================================================== */
  function renderRiskHeatmapPane(container, state, ctx) {
    ensureOSState(state);
    var risks = (state.raidItems || []).filter(function (r) {
      return !r.type || String(r.type).toLowerCase() === 'risk';
    });

    function scoreTone(score) {
      if (score >= 16) return 'crit';
      if (score >= 10) return 'high';
      if (score >= 5) return 'med';
      return 'low';
    }

    var matrixHtml = '';
    for (var imp = 5; imp >= 1; imp--) {
      matrixHtml += '<div style="display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--pos-muted);">I' + imp + '</div>';
      for (var prob = 1; prob <= 5; prob++) {
        var score = imp * prob;
        var cellRisks = risks.filter(function (r) {
          return (Number(r.impact) || 3) === imp && (Number(r.probability) || 3) === prob;
        });
        matrixHtml += '<div class="pos-hm-cell pos-hm-cell--' + scoreTone(score) + '">' +
          '<span>' + score + '</span>' +
          '<span>' + (cellRisks.length ? cellRisks.length + ' risk' + (cellRisks.length > 1 ? 's' : '') : '') + '</span>' +
        '</div>';
      }
    }

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Risk Register &amp; Heatmap</h1><span class="pos-panel__sub">Impact &times; Probability scoring with live 5&times;5 severity matrix</span></div>' +
        '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-risk-add" type="button">+ Log Risk</button>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">5&times;5 Risk Heatmap</h2><span class="pos-panel__sub">Vertical: Impact (1&ndash;5) &middot; Horizontal: Probability (1&ndash;5)</span></div>' +
          '<div class="pos-heatmap">' + matrixHtml + '</div>' +
        '</section>' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Active Risk Register (' + risks.length + ')</h2></div>' +
          (risks.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">No risks logged yet. Click "+ Log Risk" to add a risk and populate the heatmap.</p>'
            : risks.map(function (r) {
                var impV = Number(r.impact) || 3;
                var probV = Number(r.probability) || 3;
                var score = impV * probV;
                var sevLabel = score >= 16 ? 'Critical' : (score >= 10 ? 'High' : (score >= 5 ? 'Medium' : 'Low'));
                return '<div style="padding:10px 0;border-bottom:1px solid var(--pos-border);">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                    '<strong style="font-size:13px;">' + esc(r.title || r.name) + '</strong>' +
                    '<span class="pos-tag pos-tag--' + sevLabel.toLowerCase() + '">' + sevLabel + ' (' + score + ')</span>' +
                  '</div>' +
                  '<div style="font-size:12px;color:var(--pos-ink-2);margin-top:4px;">Impact ' + impV + '/5 &middot; Probability ' + probV + '/5 &middot; Owner: ' + esc(r.owner || 'Unassigned') + '</div>' +
                  (r.mitigation ? '<div style="font-size:12px;color:var(--pos-muted);margin-top:3px;">Mitigation: ' + esc(r.mitigation) + '</div>' : '') +
                '</div>';
              }).join('')) +
        '</section>' +
      '</div>';

    container.querySelector('#pos-risk-add')?.addEventListener('click', async function () {
      var title = await window.QFDialog.prompt({ title: 'Add risk', message: 'Risk name:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!title || !title.trim()) return;
      var impact = Math.max(1, Math.min(5, Number(await window.QFDialog.prompt({ title: 'Impact (1-5)', defaultValue: '4', confirmLabel: 'Next', cancelLabel: 'Skip' })) || 3));
      var probability = Math.max(1, Math.min(5, Number(await window.QFDialog.prompt({ title: 'Probability (1-5)', defaultValue: '3', confirmLabel: 'Next', cancelLabel: 'Skip' })) || 3));
      var mitigation = (await window.QFDialog.prompt({ title: 'Mitigation plan', message: 'Optional mitigation strategy:', confirmLabel: 'Add Risk', cancelLabel: 'Skip' })) || '';
      var score = impact * probability;
      var severity = score >= 16 ? 'Critical' : (score >= 10 ? 'High' : (score >= 5 ? 'Medium' : 'Low'));
      var item = {
        id: uid('RSK'),
        type: 'Risk',
        title: title.trim(),
        impact: impact,
        probability: probability,
        severity: severity,
        owner: state.projectOwner || 'Project Owner',
        mitigation: mitigation.trim(),
        status: 'Open'
      };
      state.raidItems.unshift(item);
      logActivity(state, state.projectOwner || 'User', 'logged risk (' + severity + ')', title.trim());
      triggerAutomations(state, 'When Risk Created', item, ctx);
      ctx.saveAndRender();
    });
  }

  /* ========================================================================
     OPERATING MODULE: NO-CODE AUTOMATION BUILDER
     ======================================================================== */
  function renderAutomationsPane(container, state, ctx) {
    ensureOSState(state);
    var presets = [
      { name: 'Task Completion Alert', trigger: 'When Task Completed', action: 'Notify Team' },
      { name: 'Phase Gate Rollout', trigger: 'When Milestone Reached', action: 'Create Next Phase Tasks' },
      { name: 'Deadline Escalation', trigger: 'When Deadline Missed', action: 'Escalate To Manager' },
      { name: 'Risk Stakeholder Alert', trigger: 'When Risk Created', action: 'Notify Stakeholders' }
    ];

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Automation Builder</h1><span class="pos-panel__sub">No-code event-driven workflow rules executed automatically on project state changes</span></div>' +
        '<button class="pos-btn pos-btn--sm pos-btn--primary" id="pos-auto-new" type="button">+ Custom Rule</button>' +
      '</div>' +
      '<section class="pos-panel" style="margin-bottom:18px;">' +
        '<div class="pos-panel__head"><h2 class="pos-panel__title">One-Click Workflow Templates</h2></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
          presets.map(function (p, idx) {
            return '<button class="pos-btn pos-btn--sm" data-auto-preset="' + idx + '" type="button">+ ' + esc(p.trigger) + ' &rarr; ' + esc(p.action) + '</button>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<div class="pos-grid-2">' +
        (state.automations.length === 0
          ? '<section class="pos-panel"><p class="pos-panel__sub" style="margin:0;">No active automation rules. Add a template above or build a custom rule.</p></section>'
          : state.automations.map(function (r) {
              return '<div class="pos-auto-card">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                  '<strong style="font-size:13.5px;">' + esc(r.name) + '</strong>' +
                  '<span class="pos-tag ' + (r.enabled ? 'pos-tag--green' : '') + '">' + (r.enabled ? 'Active' : 'Paused') + '</span>' +
                '</div>' +
                '<div class="pos-auto-flow">' +
                  '<span class="pos-auto-step">' + esc(r.trigger) + '</span>' +
                  '<span>&rarr;</span>' +
                  '<span class="pos-auto-step pos-auto-step--action">' + esc(r.action) + '</span>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--pos-muted);">' +
                  '<span>Runs: ' + (r.runCount || 0) + (r.lastRun ? ' &middot; Last: ' + esc(r.lastRun) : '') + '</span>' +
                  '<div style="display:flex;gap:6px;">' +
                    '<button class="pos-card-act" data-auto-test="' + esc(r.id) + '" type="button">Test Run</button>' +
                    '<button class="pos-card-act" data-auto-toggle="' + esc(r.id) + '" type="button">' + (r.enabled ? 'Pause' : 'Enable') + '</button>' +
                    '<button class="pos-card-act" data-auto-del="' + esc(r.id) + '" type="button">Delete</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('')) +
      '</div>';

    container.querySelectorAll('[data-auto-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = presets[Number(btn.dataset.autoPreset)];
        if (!p) return;
        state.automations.push({ id: uid('AUTO'), name: p.name, trigger: p.trigger, action: p.action, enabled: true, runCount: 0 });
        ctx.saveAndRender();
      });
    });
    container.querySelector('#pos-auto-new')?.addEventListener('click', async function () {
      var name = await window.QFDialog.prompt({ title: 'New automation rule', message: 'Rule name:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!name || !name.trim()) return;
      var trigger = (await window.QFDialog.prompt({ title: 'Trigger event', message: 'e.g. When Task Completed / When Milestone Reached / When Deadline Missed / When Risk Created', defaultValue: 'When Task Completed', confirmLabel: 'Next', cancelLabel: 'Skip' })) || 'When Task Completed';
      var action = (await window.QFDialog.prompt({ title: 'Action', message: 'e.g. Notify Team / Create Next Phase Tasks / Escalate To Manager / Notify Stakeholders', defaultValue: 'Notify Team', confirmLabel: 'Create Rule', cancelLabel: 'Skip' })) || 'Notify Team';
      state.automations.push({ id: uid('AUTO'), name: name.trim(), trigger: trigger.trim(), action: action.trim(), enabled: true, runCount: 0 });
      ctx.saveAndRender();
    });
    container.querySelectorAll('[data-auto-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = state.automations.find(function (x) { return x.id === b.dataset.autoToggle; });
        if (r) { r.enabled = !r.enabled; ctx.saveAndRender(); }
      });
    });
    container.querySelectorAll('[data-auto-test]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = state.automations.find(function (x) { return x.id === b.dataset.autoTest; });
        if (r) {
          r.enabled = true;
          triggerAutomations(state, r.trigger, { title: 'Test Simulation' }, ctx);
          ctx.saveAndRender();
        }
      });
    });
    container.querySelectorAll('[data-auto-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.automations = state.automations.filter(function (x) { return x.id !== b.dataset.autoDel; });
        ctx.saveAndRender();
      });
    });
  }

  /* ========================================================================
     OPERATING MODULE: PROJECT ANALYTICS (Interactive SVG Charts)
     ======================================================================== */
  function renderAnalyticsPane(container, state) {
    ensureOSState(state);
    var m = computeMetrics(state);
    var tasks = state.tasks || [];
    var statusCounts = ALL_STATUSES.map(function (st) {
      return { label: st, count: tasks.filter(function (t) { return normalizeStatus(t.status) === st; }).length };
    });
    var maxCount = Math.max(1, statusCounts.reduce(function (a, b) { return Math.max(a, b.count); }, 1));

    var workloads = (state.resources || []).map(function (r) {
      var hrs = tasks.filter(function (t) { return !isCompleted(t) && (t.assignee === r.id || t.assignee === r.name); })
        .reduce(function (a, t) { return a + (Number(t.estHours) || 8); }, 0);
      var cap = Number(r.capacityHours || 40);
      return { name: r.name, pct: cap ? Math.round((hrs / cap) * 100) : 0 };
    });

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Project Analytics</h1><span class="pos-panel__sub">Real-time completion rate, productivity, utilization, milestone performance, and risk trends</span></div>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Task Distribution by Status</h2><span class="pos-panel__sub">' + m.completedTasks + ' of ' + m.totalTasks + ' completed</span></div>' +
          '<svg width="100%" height="230" viewBox="0 0 520 230" role="img" aria-label="Task Distribution Bar Chart">' +
            statusCounts.map(function (s, idx) {
              var y = 14 + idx * 30;
              var w = Math.round((s.count / maxCount) * 280);
              var fill = s.label === 'Completed' ? '#0e7a45' : (s.label === 'In Progress' ? '#002fa7' : '#374151');
              return '<text x="4" y="' + (y + 15) + '" font-size="11.5" font-weight="600" fill="#374151">' + esc(s.label) + '</text>' +
                '<rect x="120" y="' + y + '" width="280" height="20" fill="#f3f4f6" />' +
                '<rect x="120" y="' + y + '" width="' + w + '" height="20" fill="' + fill + '" />' +
                '<text x="' + (412) + '" y="' + (y + 15) + '" font-size="12" font-weight="700" fill="#111827">' + s.count + '</text>';
            }).join('') +
          '</svg>' +
        '</section>' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Resource Utilisation &amp; Workload</h2><span class="pos-panel__sub">Allocated hours vs weekly capacity</span></div>' +
          (workloads.length === 0
            ? '<p class="pos-panel__sub" style="margin:0;">Add team members in Team Workspace to visualize workload distribution.</p>'
            : '<svg width="100%" height="230" viewBox="0 0 520 230" role="img" aria-label="Workload Distribution Chart">' +
                workloads.slice(0, 7).map(function (wl, idx) {
                  var y = 14 + idx * 30;
                  var w = Math.round((Math.min(120, wl.pct) / 120) * 280);
                  var fill = wl.pct > 100 ? '#c81e1e' : (wl.pct > 80 ? '#b45309' : '#002fa7');
                  return '<text x="4" y="' + (y + 15) + '" font-size="11.5" font-weight="600" fill="#374151">' + esc(wl.name.slice(0, 14)) + '</text>' +
                    '<rect x="120" y="' + y + '" width="280" height="20" fill="#f3f4f6" />' +
                    '<rect x="120" y="' + y + '" width="' + w + '" height="20" fill="' + fill + '" />' +
                    '<text x="412" y="' + (y + 15) + '" font-size="12" font-weight="700" fill="#111827">' + wl.pct + '%</text>';
                }).join('') +
              '</svg>') +
        '</section>' +
      '</div>' +
      '<div class="pos-grid-3">' +
        '<section class="pos-panel"><span class="pos-kpi__label">Milestone Performance</span><div class="pos-kpi__val pos-kpi__val--accent" style="margin:8px 0;">' + (m.milestones ? Math.round((m.milestonesDone / m.milestones) * 100) : 0) + '%</div><span class="pos-panel__sub">' + m.milestonesDone + ' of ' + m.milestones + ' milestones reached</span></section>' +
        '<section class="pos-panel"><span class="pos-kpi__label">Task Completion Rate</span><div class="pos-kpi__val pos-kpi__val--green" style="margin:8px 0;">' + (m.totalTasks ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0) + '%</div><span class="pos-panel__sub">' + m.completedTasks + ' completed deliverables</span></section>' +
        '<section class="pos-panel"><span class="pos-kpi__label">Open Risk Exposure</span><div class="pos-kpi__val ' + (m.openRisks ? 'pos-kpi__val--amber' : '') + '" style="margin:8px 0;">' + m.openRisks + '</div><span class="pos-panel__sub">Active risks in register</span></section>' +
      '</div>';
  }

  /* ========================================================================
     OPERATING MODULE: ORGANISATIONAL PROJECT MAP (Project Universe View)
     ======================================================================== */
  function renderUniversePane(container, state, ctx) {
    ensureOSState(state);
    var zoom = Number(state.universeZoom) || 100;
    var levels = [
      { label: 'Company', value: state.companyName || 'QuantalFlow' },
      { label: 'Department', value: state.department || 'Unassigned Department' },
      { label: 'Portfolio', value: state.portfolioName || 'Core Portfolio' },
      { label: 'Project', value: state.projectName || 'Untitled Project', accent: true },
      { label: 'Milestones', value: (state.milestones || []).length + ' Milestone(s)' },
      { label: 'Tasks', value: (state.tasks || []).length + ' Task(s)' },
      { label: 'Documents', value: (state.documents.length + (state.sharedFiles || []).length) + ' Document(s)' }
    ];

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:16px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Project Universe Map</h1><span class="pos-panel__sub">Zoom across Company &rarr; Department &rarr; Portfolio &rarr; Project &rarr; Milestone &rarr; Task &rarr; Document</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<label for="pos-uni-zoom" style="font-size:12px;font-weight:600;">Zoom ' + zoom + '%</label>' +
          '<input id="pos-uni-zoom" type="range" min="60" max="140" value="' + zoom + '" />' +
        '</div>' +
      '</div>' +
      '<div class="pos-canvas-stage" style="overflow:auto;display:flex;align-items:center;justify-content:center;">' +
        '<div style="transform:scale(' + (zoom / 100) + ');transform-origin:center center;display:flex;align-items:center;gap:14px;padding:40px;">' +
          levels.map(function (lv, idx) {
            return (idx > 0 ? '<span style="font-weight:700;color:var(--pos-muted);">&rarr;</span>' : '') +
              '<div style="min-width:136px;padding:14px;border:1px solid ' + (lv.accent ? 'var(--pos-accent)' : 'var(--pos-ink)') + ';background:' + (lv.accent ? 'var(--pos-accent)' : '#ffffff') + ';color:' + (lv.accent ? '#ffffff' : 'var(--pos-ink)') + ';">' +
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75;">' + esc(lv.label) + '</div>' +
                '<div style="font-size:13px;font-weight:700;margin-top:6px;">' + esc(lv.value) + '</div>' +
              '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    container.querySelector('#pos-uni-zoom')?.addEventListener('input', function (e) {
      state.universeZoom = Number(e.target.value) || 100;
      renderUniversePane(container, state, ctx);
    });
  }

  /* ========================================================================
     OPERATING MODULE: CLIENT PORTAL (Role-Based External Sharing)
     ======================================================================== */
  function renderPortalPane(container, state, ctx) {
    ensureOSState(state);
    var portal = state.clientPortal;
    var m = computeMetrics(state);

    container.innerHTML =
      '<div class="pos-panel__head" style="border-bottom:2px solid var(--pos-ink);margin-bottom:18px;">' +
        '<div><h1 class="pos-folio__title" style="font-size:22px;margin:0;">Client Portal</h1><span class="pos-panel__sub">Controlled external visibility with role-based permissions</span></div>' +
        '<button class="pos-btn pos-btn--sm ' + (portal.enabled ? 'pos-btn--primary' : '') + '" id="pos-portal-toggle" type="button">' + (portal.enabled ? 'Portal Active' : 'Enable Client Portal') + '</button>' +
      '</div>' +
      '<div class="pos-grid-2">' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">Exposed Modules &amp; Role Permissions</h2></div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">' +
            ['progress', 'milestones', 'files', 'approvals', 'comments'].map(function (key) {
              var checked = Boolean(portal.expose[key]);
              return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">' +
                '<input type="checkbox" data-portal-exp="' + key + '"' + (checked ? ' checked' : '') + ' />' +
                '<span style="text-transform:capitalize;font-weight:600;">' + key + '</span>' +
              '</label>';
            }).join('') +
          '</div>' +
          '<div class="pos-panel__head"><h3 class="pos-panel__title">Stakeholder Roles</h3><button class="pos-btn pos-btn--sm" id="pos-portal-add-role" type="button">+ Add Role</button></div>' +
          (portal.roles || []).map(function (r) {
            return '<div style="padding:8px 0;border-bottom:1px solid var(--pos-border);display:flex;justify-content:space-between;font-size:12.5px;">' +
              '<span><strong>' + esc(r.name) + '</strong>' + (r.email ? ' (' + esc(r.email) + ')' : '') + '</span>' +
              '<span class="pos-tag pos-tag--blue">' + esc(r.role) + '</span>' +
            '</div>';
          }).join('') +
        '</section>' +
        '<section class="pos-panel">' +
          '<div class="pos-panel__head"><h2 class="pos-panel__title">External Stakeholder Preview</h2><span class="pos-tag ' + (portal.enabled ? 'pos-tag--green' : '') + '">' + (portal.enabled ? 'Live' : 'Draft') + '</span></div>' +
          '<h3 style="margin:0 0 10px;font-size:16px;">' + esc(state.projectName || 'Project') + '</h3>' +
          (portal.expose.progress ? '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;margin-bottom:4px;">Overall Progress: ' + m.progress + '%</div><div class="pos-progress-track"><div class="pos-progress-fill" style="width:' + m.progress + '%;"></div></div></div>' : '') +
          (portal.expose.milestones ? '<div style="margin-bottom:12px;font-size:12.5px;"><strong>Milestones:</strong> ' + m.milestonesDone + ' / ' + m.milestones + ' reached</div>' : '') +
          (portal.expose.files ? '<div style="margin-bottom:12px;font-size:12.5px;"><strong>Shared Files:</strong> ' + (state.documents.length + (state.sharedFiles || []).length) + ' available</div>' : '') +
          (portal.expose.approvals ? '<div style="margin-bottom:12px;font-size:12.5px;"><strong>Decisions &amp; Approvals:</strong> ' + state.decisions.length + ' recorded</div>' : '') +
        '</section>' +
      '</div>';

    container.querySelector('#pos-portal-toggle')?.addEventListener('click', function () {
      portal.enabled = !portal.enabled;
      ctx.saveAndRender();
    });
    container.querySelectorAll('[data-portal-exp]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        portal.expose[cb.dataset.portalExp] = cb.checked;
        ctx.saveAndRender();
      });
    });
    container.querySelector('#pos-portal-add-role')?.addEventListener('click', async function () {
      var name = await window.QFDialog.prompt({ title: 'Add stakeholder', message: 'Stakeholder name:', confirmLabel: 'Next', cancelLabel: 'Cancel' });
      if (!name || !name.trim()) return;
      var role = (await window.QFDialog.prompt({ title: 'Role', message: 'Viewer / Commenter / Approver', defaultValue: 'Viewer', confirmLabel: 'Add Stakeholder', cancelLabel: 'Skip' })) || 'Viewer';
      portal.roles.push({ id: uid('role'), name: name.trim(), role: role.trim(), email: '' });
      ctx.saveAndRender();
    });
  }

  /* ========================================================================
     PERSISTENT AI PROJECT MANAGER (10 Commands + Context-Aware Engine)
     ======================================================================== */
  function buildDeterministicAiResponse(command, state) {
    ensureOSState(state);
    var m = computeMetrics(state);
    var h = computeHealth(state);
    var cmd = String(command || '').trim();
    var lower = cmd.toLowerCase();

    if (lower.indexOf('create project plan') !== -1) {
      return {
        text: 'Generated a structured 3-objective, 3-milestone, 6-task starter plan for "' + (state.projectName || 'this project') + '". Click "Apply to Project" to insert it.',
        apply: function (st) {
          var o1 = { id: uid('OBJ'), title: 'Discovery & Architecture', owner: st.projectOwner || 'Lead', progress: 0, targetDate: addDaysIso(todayIso(), 14) };
          var o2 = { id: uid('OBJ'), title: 'Core Build & Integration', owner: st.projectOwner || 'Lead', progress: 0, targetDate: addDaysIso(todayIso(), 35) };
          var o3 = { id: uid('OBJ'), title: 'QA, Launch & Handover', owner: st.projectOwner || 'Lead', progress: 0, targetDate: addDaysIso(todayIso(), 50) };
          st.objectives.push(o1, o2, o3);
          st.milestones.push(
            { id: uid('MS'), title: 'Architecture Sign-Off', date: addDaysIso(todayIso(), 14), status: 'Planned', successCriteria: 'Spec approved in Decision Centre' },
            { id: uid('MS'), title: 'Feature Complete Beta', date: addDaysIso(todayIso(), 35), status: 'Planned', successCriteria: 'All core tasks verified' },
            { id: uid('MS'), title: 'Production Release', date: addDaysIso(todayIso(), 50), status: 'Planned', successCriteria: 'Zero critical risks open' }
          );
          var newTasks = [
            { title: 'Requirements & Scope Specification', objectiveId: o1.id, status: 'Planned', priority: 'High', estHours: 16, dueDate: addDaysIso(todayIso(), 7) },
            { title: 'System Architecture & Data Model', objectiveId: o1.id, status: 'Planned', priority: 'Critical', estHours: 20, dueDate: addDaysIso(todayIso(), 14) },
            { title: 'Core Module Implementation', objectiveId: o2.id, status: 'Not Started', priority: 'High', estHours: 32, dueDate: addDaysIso(todayIso(), 28) },
            { title: 'API & Workflow Integration', objectiveId: o2.id, status: 'Not Started', priority: 'High', estHours: 24, dueDate: addDaysIso(todayIso(), 35) },
            { title: 'End-to-End QA & Accessibility Audit', objectiveId: o3.id, status: 'Not Started', priority: 'High', estHours: 16, dueDate: addDaysIso(todayIso(), 44) },
            { title: 'Production Rollout & Documentation', objectiveId: o3.id, status: 'Not Started', priority: 'Medium', estHours: 12, dueDate: addDaysIso(todayIso(), 50) }
          ];
          newTasks.forEach(function (nt) {
            st.tasks.push(Object.assign({ id: uid('TSK'), progress: 0, actualHours: 0, start: todayIso(), end: nt.dueDate, subtasks: [], comments: [], tags: ['ai-plan'] }, nt));
          });
        }
      };
    }

    if (lower.indexOf('generate sprint') !== -1) {
      return {
        text: 'Prepared a focused 2-week Sprint with 4 executable deliverables aligned to current priorities.',
        apply: function (st) {
          st.activeSprint = 'Sprint (' + todayIso() + ' to ' + addDaysIso(todayIso(), 14) + ')';
          ['Sprint Kickoff & Backlog Grooming', 'Primary Feature Build', 'Automated Test Coverage', 'Sprint Review & Demo'].forEach(function (t, i) {
            st.tasks.push({ id: uid('TSK'), title: t, status: i === 0 ? 'In Progress' : 'Planned', priority: i === 1 ? 'High' : 'Medium', progress: i === 0 ? 25 : 0, estHours: 12, actualHours: 0, start: todayIso(), end: addDaysIso(todayIso(), 4 + i * 3), dueDate: addDaysIso(todayIso(), 4 + i * 3), subtasks: [], comments: [], tags: ['sprint'] });
          });
        }
      };
    }

    if (lower.indexOf('generate milestones') !== -1) {
      return {
        text: 'Drafted 3 phase-gate milestones with measurable success criteria.',
        apply: function (st) {
          st.milestones.push(
            { id: uid('MS'), title: 'Phase 1 Gate: Plan Approved', date: addDaysIso(todayIso(), 10), status: 'Planned', successCriteria: 'All stakeholders signed off' },
            { id: uid('MS'), title: 'Phase 2 Gate: Integration Ready', date: addDaysIso(todayIso(), 25), status: 'Planned', successCriteria: 'Core dependencies unblocked' },
            { id: uid('MS'), title: 'Phase 3 Gate: Final Delivery', date: addDaysIso(todayIso(), 40), status: 'Planned', successCriteria: 'Client acceptance complete' }
          );
        }
      };
    }

    if (lower.indexOf('generate roadmap') !== -1) {
      return {
        text: 'Roadmap Summary for ' + (state.projectName || 'Project') + ':\n• Now (Days 1–14): Complete ' + (state.tasks || []).filter(function (t) { return !isCompleted(t); }).slice(0, 3).map(function (t) { return t.title; }).join(', ') + '\n• Next (Days 15–30): Reach ' + (state.milestones.length ? state.milestones[0].title : 'next milestone') + '\n• Later (Days 31+): Scale, document, and close open risks (' + m.openRisks + ').'
      };
    }

    if (lower.indexOf('bottleneck') !== -1) {
      return {
        text: 'Bottleneck Analysis:\n• Schedule: ' + h.schedule.note + '\n• Resources: ' + h.resource.note + '\n• Dependencies: ' + h.dependencies.note
      };
    }

    if (lower.indexOf('risk analysis') !== -1) {
      return {
        text: 'Risk Analysis (' + h.risk.label + '): ' + h.risk.note + ' Schedule is ' + h.schedule.label + ', Budget is ' + h.budget.label + '. Recommend logging mitigation owners for any task with high dependency fan-out.'
      };
    }

    if (lower.indexOf('estimate delivery') !== -1) {
      var remainingHours = (state.tasks || []).filter(function (t) { return !isCompleted(t); }).reduce(function (a, t) { return a + (Number(t.estHours) || 8); }, 0);
      var teamCap = Math.max(20, (state.resources || []).reduce(function (a, r) { return a + (Number(r.capacityHours) || 40); }, 0));
      var weeks = Math.max(1, Math.ceil(remainingHours / teamCap));
      var estDate = addDaysIso(todayIso(), weeks * 7);
      return {
        text: 'Estimated Delivery Date: ' + estDate + ' (~' + weeks + ' week(s) based on ' + remainingHours + 'h remaining across ' + teamCap + 'h/wk effective capacity).'
      };
    }

    if (lower.indexOf('status report') !== -1 || lower.indexOf('executive summary') !== -1) {
      return {
        text: 'Executive Digest — ' + (state.projectName || 'Project') + ' (' + state.projectStatus + '):\n• Progress: ' + m.progress + '% (' + m.completedTasks + '/' + m.totalTasks + ' tasks complete, ' + m.overdueTasks + ' overdue)\n• Milestones: ' + m.milestonesDone + '/' + m.milestones + ' reached\n• Budget: ' + m.budgetPct + '% consumed\n• Health: Schedule ' + h.schedule.label + ' | Budget ' + h.budget.label + ' | Resources ' + h.resource.label + ' | Risks ' + h.risk.label
      };
    }

    if (lower.indexOf('resource allocation') !== -1) {
      return {
        text: 'Resource Allocation Advice: ' + h.resource.note + ' Balance high-priority tasks across available team capacity in Team Workspace before starting the next sprint.'
      };
    }

    return {
      text: 'Analyzed "' + cmd + '" against ' + m.totalTasks + ' tasks, ' + m.milestones + ' milestones, and ' + m.openRisks + ' open risks. Project progress is ' + m.progress + '% (' + h.schedule.label + ' schedule health).'
    };
  }

  function renderAiDock(dockEl, state, ctx) {
    ensureOSState(state);
    var body = dockEl.querySelector('#pos-ai-log');
    if (!body) return;
    if (state.aiHistory.length === 0) {
      body.innerHTML = '<div class="pos-ai-msg pos-ai-msg--assistant"><strong>AI Project Manager</strong><p style="margin:6px 0 0;color:var(--pos-muted);">Select a command above or ask anything about this project. Generated plan changes always require your approval before applying.</p></div>';
      return;
    }
    body.innerHTML = state.aiHistory.map(function (msg, idx) {
      return '<div class="pos-ai-msg pos-ai-msg--' + esc(msg.role) + '">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--pos-muted);margin-bottom:4px;">' + (msg.role === 'user' ? 'You' : 'AI Project Manager') + '</div>' +
        '<div style="white-space:pre-line;">' + esc(msg.text) + '</div>' +
        (msg.hasApply && !msg.applied ? '<div style="margin-top:8px;"><button class="pos-btn pos-btn--sm pos-btn--primary" data-ai-apply="' + idx + '" type="button">Apply to Project</button></div>' : '') +
        (msg.applied ? '<div style="margin-top:6px;font-size:11.5px;color:var(--pos-green);font-weight:600;">Applied to project workspace.</div>' : '') +
      '</div>';
    }).join('');
    body.scrollTop = body.scrollHeight;

    body.querySelectorAll('[data-ai-apply]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var entry = state.aiHistory[Number(btn.dataset.aiApply)];
        if (!entry || !entry._applyFn || entry.applied) return;
        entry._applyFn(state);
        entry.applied = true;
        logActivity(state, 'AI Project Manager', 'applied generated plan', entry.command || state.projectName, 'ai');
        ctx.saveAndRender();
        renderAiDock(dockEl, state, ctx);
      });
    });
  }

  function executeAiCommand(dockEl, command, state, ctx) {
    ensureOSState(state);
    var cmd = String(command || '').trim();
    if (!cmd) return;
    state.aiHistory.push({ role: 'user', text: cmd });
    var res = buildDeterministicAiResponse(cmd, state);
    state.aiHistory.push({
      role: 'assistant',
      command: cmd,
      text: res.text,
      hasApply: typeof res.apply === 'function',
      applied: false,
      _applyFn: res.apply || null
    });
    renderAiDock(dockEl, state, ctx);
  }

  window.ProjectOSViews = {
    ALL_STATUSES: ALL_STATUSES,
    AI_COMMANDS: AI_COMMANDS,
    normalizeStatus: normalizeStatus,
    normalizeTask: normalizeTask,
    ensureOSState: ensureOSState,
    computeMetrics: computeMetrics,
    computeHealth: computeHealth,
    logActivity: logActivity,
    triggerAutomations: triggerAutomations,
    renderDashboardPane: renderDashboardPane,
    renderKanbanPane: renderKanbanPane,
    renderTimelinePane: renderTimelinePane,
    renderCalendarPane: renderCalendarPane,
    renderTablePane: renderTablePane,
    renderMindMapPane: renderMindMapPane,
    renderWhiteboardPane: renderWhiteboardPane,
    renderTeamPane: renderTeamPane,
    renderDependenciesPane: renderDependenciesPane,
    renderDocsDecisionsPane: renderDocsDecisionsPane,
    renderRiskHeatmapPane: renderRiskHeatmapPane,
    renderAutomationsPane: renderAutomationsPane,
    renderAnalyticsPane: renderAnalyticsPane,
    renderUniversePane: renderUniversePane,
    renderPortalPane: renderPortalPane,
    renderAiDock: renderAiDock,
    executeAiCommand: executeAiCommand
  };
})();
