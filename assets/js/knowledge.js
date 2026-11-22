/* ==========================================================================
   QuantalFlow Knowledge Hub — Organisational Brain Engine
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'quantalflow_knowledge_hub_v1';
  var state = null;
  var ecosystem = { boards: [], projects: [], files: [], notes: [], members: [], syncedAt: null };
  var currentTab = 'overview';
  var feedMode = 'recent';
  var activeWikiId = 'WIKI-01';
  var selectedGraphNodeId = 'KO-PRJ-01';
  var saveTimer = null;
  var toastTimer = null;

  var TYPE_COLORS = {
    Project: '#4262ff',
    Document: '#0e6f78',
    Task: '#7c3aed',
    Meeting: '#d97706',
    Decision: '#147a4c',
    'Research Paper': '#db2777',
    Policy: '#475569',
    SOP: '#2563eb',
    'Training Material': '#059669',
    Client: '#ea580c',
    Department: '#6366f1',
    Product: '#1c1c1e',
    Workflow: '#9333ea',
    Template: '#0284c7'
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function todayPretty() {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function ensurePortals() {
    var host = document.getElementById('km-app') || document.body;
    if (!host) return;

    if (!document.getElementById('km-inspector-drawer')) {
      var inspWrap = document.createElement('div');
      inspWrap.innerHTML =
        '<div class="km-backdrop" id="km-inspector-backdrop" hidden></div>' +
        '<aside class="km-drawer" id="km-inspector-drawer" role="dialog" aria-modal="true" aria-labelledby="km-inspector-title" hidden>' +
          '<div class="km-drawer__head">' +
            '<div><span class="km-pill" id="km-inspector-type">Object</span><h2 class="km-drawer__title" id="km-inspector-title">Knowledge Object</h2></div>' +
            '<button type="button" class="km-icon-btn" id="km-inspector-close" aria-label="Close inspector"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
          '</div>' +
          '<div class="km-drawer__body" id="km-inspector-body"></div>' +
        '</aside>';
      while (inspWrap.firstChild) host.appendChild(inspWrap.firstChild);
    }

    if (!document.getElementById('km-assistant-drawer')) {
      var asstWrap = document.createElement('div');
      asstWrap.innerHTML =
        '<div class="km-backdrop" id="km-assistant-backdrop" hidden></div>' +
        '<aside class="km-drawer km-drawer--ai" id="km-assistant-drawer" role="dialog" aria-modal="true" aria-labelledby="km-assistant-title" hidden>' +
          '<div class="km-drawer__head">' +
            '<div><div class="km-ai-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9L12 3z"/></svg><span>AI Knowledge Assistant</span></div><h2 class="km-drawer__title" id="km-assistant-title">Organisational Brain Copilot</h2></div>' +
            '<button type="button" class="km-icon-btn" id="km-assistant-close" aria-label="Close AI Assistant"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
          '</div>' +
          '<div class="km-assistant-commands" aria-label="Quick AI Knowledge commands">' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Summarise Knowledge">Summarise Knowledge</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Generate SOP">Generate SOP</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Find Missing Documentation">Find Missing Docs</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Identify Knowledge Gaps">Identify Gaps</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Find Experts">Find Experts</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Generate Training Course">Generate Course</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Generate Wiki Article">Generate Wiki</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Generate Project Summary">Project Summary</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Connect Related Knowledge">Connect Knowledge</button>' +
            '<button type="button" class="km-cmd-chip" data-ai-cmd="Answer Organisation Questions">Ask Organisation</button>' +
          '</div>' +
          '<div class="km-assistant-log" id="km-assistant-log" aria-live="polite"></div>' +
          '<form class="km-assistant-form" id="km-assistant-form">' +
            '<input type="text" id="km-assistant-input" class="km-input" placeholder="Ask a question or give a command…" autocomplete="off" aria-label="Message AI Knowledge Assistant" />' +
            '<button type="submit" class="km-btn km-btn--primary">Send</button>' +
          '</form>' +
        '</aside>';
      while (asstWrap.firstChild) host.appendChild(asstWrap.firstChild);
    }

    if (!document.getElementById('km-modal-backdrop')) {
      var modWrap = document.createElement('div');
      modWrap.innerHTML =
        '<div class="km-modal-backdrop" id="km-modal-backdrop" hidden>' +
          '<div class="km-modal" id="km-modal" role="dialog" aria-modal="true" aria-labelledby="km-modal-title">' +
            '<div class="km-modal__head">' +
              '<h2 class="km-modal__title" id="km-modal-title">Create Knowledge Asset</h2>' +
              '<button type="button" class="km-icon-btn" id="km-modal-close" aria-label="Close dialog"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
            '</div>' +
            '<div class="km-modal__body" id="km-modal-body"></div>' +
          '</div>' +
        '</div>';
      while (modWrap.firstChild) host.appendChild(modWrap.firstChild);
    }

    if (!document.getElementById('km-toast')) {
      var toast = document.createElement('div');
      toast.className = 'km-toast';
      toast.id = 'km-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.hidden = true;
      host.appendChild(toast);
    }
  }

  function showToast(msg) {
    ensurePortals();
    var el = document.getElementById('km-toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function setSyncLabel(text) {
    var el = document.getElementById('km-sync-label');
    if (el) el.textContent = text;
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    clearTimeout(saveTimer);
    setSyncLabel('Saving to Organisational Brain…');
    saveTimer = setTimeout(function () {
      fetch('/api/knowledge', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: state })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function () { setSyncLabel('Organisational Brain Synced'); })
        .catch(function () { setSyncLabel('Saved Locally'); });
    }, 500);
  }

  function wireChrome(user) {
    if (!user) return;
    window.__qfUser = user;
    var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || 'Profile');
    var initialEl = document.getElementById('dash-initial');
    if (initialEl) {
      var img = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
      if (img) {
        initialEl.textContent = '';
        var el = document.createElement('img');
        el.src = img;
        el.alt = '';
        el.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        initialEl.appendChild(el);
      } else {
        initialEl.textContent = (name.charAt(0) || '?').toUpperCase();
      }
    }
    var nameEl = document.getElementById('dash-profile-name');
    if (nameEl) nameEl.textContent = name;
  }

  function cleanTitle(raw) {
    var s = String(raw || '').trim();
    if (!s) return 'Untitled Asset';
    s = s.replace(/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|mp4|mp3|txt|md)$/i, '');
    s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/\bwhite\s+boarding\b/ig, 'Whiteboarding');
    // Normalize ALL-CAPS strings into readable Title Case
    if (s.length > 4 && s === s.toUpperCase() && /[A-Z]/.test(s)) {
      s = s.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    return s;
  }

  function mergeEcosystemIntoState(eco) {
    if (!eco) return 0;
    ecosystem = eco;
    var added = 0;
    var existingIds = new Set(state.objects.map(function (o) { return o.id; }));

    (eco.boards || []).forEach(function (b) {
      var id = 'ECO-BRD-' + b.id;
      if (existingIds.has(id)) return;
      var modeLabel = String(b.mode || 'whiteboard');
      var type = modeLabel.indexOf('project') !== -1 ? 'Project' : 'Workflow';
      var source = modeLabel.indexOf('mindmap') !== -1 ? 'Mind Map' :
                   modeLabel.indexOf('project') !== -1 ? 'Project Planning' : 'Whiteboard';
      state.objects.push({
        id: id,
        type: type,
        title: cleanTitle(b.title || 'QuantalFlow Board'),
        summary: 'Live ' + source + ' board synced from QuantalFlow workspace (' + (b.category || 'Workspace') + ').',
        content: 'Automatically synced from QuantalFlow ' + source + '. Open directly in /app/?board=' + b.id,
        department: b.category || 'Workspace',
        project: cleanTitle(b.title || 'QuantalFlow Core'),
        author: (window.__qfUser && window.__qfUser.name) || 'Workspace Member',
        updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString().slice(0, 10) : todayIso(),
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : todayIso(),
        permission: 'Project',
        status: 'Synced',
        views: 12,
        source: source,
        tags: [source.toLowerCase().replace(/\s+/g, '-')],
        versions: [{ v: 'Live', date: todayIso(), by: 'QuantalFlow Sync', note: 'Auto-ingested from canvas' }],
        comments: []
      });
      existingIds.add(id);
      added += 1;
    });

    (eco.files || []).forEach(function (f) {
      var id = 'ECO-FILE-' + f.id;
      if (existingIds.has(id)) return;
      state.objects.push({
        id: id,
        type: 'Document',
        title: cleanTitle(f.name || 'Uploaded File'),
        summary: 'Cloud document synced from QuantalFlow Files (' + (f.mimeType || 'file') + ').',
        content: 'Stored in QuantalFlow Files vault. Available for preview and relationship linking.',
        department: 'Workspace Files',
        project: 'QuantalFlow Core',
        author: (window.__qfUser && window.__qfUser.name) || 'Workspace Member',
        updatedAt: f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : todayIso(),
        createdAt: f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : todayIso(),
        permission: 'Department',
        status: 'Synced',
        views: 8,
        source: 'Files',
        tags: ['document'],
        versions: [{ v: 'v1.0', date: todayIso(), by: 'Files Sync', note: 'Uploaded to QuantalFlow Files' }],
        comments: []
      });
      existingIds.add(id);
      added += 1;
    });

    (eco.notes || []).forEach(function (n, idx) {
      var id = 'ECO-NOTE-' + (n.id || idx);
      if (existingIds.has(id)) return;
      state.objects.push({
        id: id,
        type: 'Document',
        title: cleanTitle(n.title || 'Workspace Note'),
        summary: n.body || 'Synced note from QuantalFlow Note Pad.',
        content: n.body || 'Synced directly from Note Pad.',
        department: 'Workspace Notes',
        project: 'QuantalFlow Core',
        author: (window.__qfUser && window.__qfUser.name) || 'Workspace Member',
        updatedAt: todayIso(),
        createdAt: todayIso(),
        permission: 'Private',
        status: 'Synced',
        views: 5,
        source: 'Note Pad',
        tags: ['notes'],
        versions: [{ v: 'Live', date: todayIso(), by: 'Note Pad Sync', note: 'Auto-synced' }],
        comments: []
      });
      existingIds.add(id);
      added += 1;
    });

    return added;
  }

  function loadInitialData() {
    var cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {}
    state = (cached && Array.isArray(cached.objects)) ? cached : window.QFKnowledgeSeed.createInitialState();
    renderAll();

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.replace('/login/?next=' + encodeURIComponent('/dashboard/knowledge/'));
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (data) { if (data && data.user) wireChrome(data.user); })
      .catch(function () {});

    fetch('/api/knowledge', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.state && Array.isArray(data.state.objects)) {
          state = data.state;
        }
        if (data.ecosystem) {
          mergeEcosystemIntoState(data.ecosystem);
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        setSyncLabel('Organisational Brain Synced');
        renderAll();
      })
      .catch(function () {
        setSyncLabel('Local Knowledge Mode');
      });
  }

  /* ========================================================================
     AI-FIRST SEMANTIC SEARCH & CROSS-PLATFORM SYNTHESIS
     ======================================================================== */
  function scoreMatch(haystack, tokens) {
    var text = String(haystack || '').toLowerCase();
    var score = 0;
    tokens.forEach(function (t) {
      if (t.length < 2) return;
      if (text.indexOf(t) !== -1) score += 2;
    });
    return score;
  }

  function runLocalSemanticSearch(query) {
    var q = String(query || '').trim().toLowerCase();
    var stop = new Set(['show', 'me', 'all', 'what', 'did', 'we', 'from', 'the', 'for', 'and', 'with', 'related', 'to', 'everything', 'about', 'find', 'summarise', 'summarize', 'every', 'involving', 'information', 'issues']);
    var tokens = q.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2 && !stop.has(w); });
    if (!tokens.length) tokens = q.split(/\s+/).filter(Boolean);

    var matchedObjects = state.objects.map(function (o) {
      var blob = [o.title, o.summary, o.content, o.type, o.department, o.project, o.author, o.source, (o.tags || []).join(' ')].join(' ');
      return { item: o, score: scoreMatch(blob, tokens) };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.item; });

    var matchedDecisions = state.decisions.filter(function (d) {
      return scoreMatch([d.title, d.project, d.description, d.reason, (d.alternatives || []).join(' ')].join(' '), tokens) > 0;
    });
    var matchedMeetings = state.meetings.filter(function (m) {
      return scoreMatch([m.title, m.project, m.summary, (m.decisions || []).join(' ')].join(' '), tokens) > 0;
    });
    var matchedLessons = state.lessons.filter(function (l) {
      return scoreMatch([l.project, l.whatWorked, l.whatFailed, l.challenges, l.recommendations].join(' '), tokens) > 0;
    });
    var matchedSops = state.sops.filter(function (s) {
      return scoreMatch([s.id, s.title, s.department, (s.steps || []).join(' ')].join(' '), tokens) > 0;
    });
    var matchedExperts = state.experts.filter(function (e) {
      return scoreMatch([e.name, e.role, e.department, (e.areas || []).join(' ')].join(' '), tokens) > 0;
    });
    var matchedCourses = state.courses.filter(function (c) {
      return scoreMatch([c.title, c.category, c.sourceKnowledge, c.certification].join(' '), tokens) > 0;
    });

    // Build executive synthesis text grounded in matched records
    var lines = [];
    if (q.indexOf('nursing') !== -1 || q.indexOf('attendance') !== -1) {
      lines.push('<strong>Nursing Student Attendance Project — Complete Organisational Intelligence:</strong>');
      lines.push('Active clinical attendance automation system across 14 hospital wards (1,200 students) built on <strong>Convex</strong> (Decision DEC-2026-01: <em>Use Convex Instead of Firebase</em>, approved 15 March 2026). Morning roll-call dropped from 18 minutes to 90 seconds.');
      lines.push('<strong>Key Lessons Learned:</strong> Field/clinical apps must be offline-first from Sprint 1 (IndexedDB queue solved basement Wi-Fi drops), and midnight shift-handover timestamps must be tested explicitly. Operational recovery is codified in <strong>SOP-021</strong> and taught in the <strong>Supervisor Certification</strong> course.');
    } else if (q.indexOf('airtel') !== -1 || q.indexOf('payment') !== -1) {
      lines.push('<strong>Airtel Money &amp; Payment Integration Intelligence:</strong>');
      lines.push('Led by <strong>David Banda</strong> (Payment Integration Expert — 12 projects, 45 documents, 7 decisions). Collections use an <strong>Idempotent Webhook Queue</strong> (DEC-2026-02) with HMAC-SHA256 verification and nightly reconciliation achieving a 99.94% ledger match rate.');
      lines.push('<strong>Support &amp; Risk Insight:</strong> Q1 root-cause analysis showed 34% of escalations were caused by 90s USSD timeout messaging; resolved via <strong>SOP-029</strong> and the 15-minute escalation workflow (KO-WFL-01).');
    } else if (q.indexOf('onboarding') !== -1) {
      lines.push('<strong>Onboarding Procedures &amp; Enablement:</strong>');
      lines.push('Governed by <strong>SOP-014: Employee &amp; Clinical Coordinator Onboarding (v2.2)</strong> owned by Chileshe Mulenga. Covers SSO provisioning, Department Wiki reading paths, an 85%-pass Security &amp; Governance Quiz, and 14-day mentorship.');
    } else if (q.indexOf('support') !== -1 || q.indexOf('customer') !== -1) {
      lines.push('<strong>Customer Support Issues Summary (Q1 2026 — 412 Tickets):</strong>');
      lines.push('75% of escalations stem from three root causes: <strong>Airtel Money callback delays (34%)</strong>, <strong>passwordless SSO confusion (22%)</strong>, and <strong>hospital ward offline sync alerts (19%)</strong>. Remediations are active in KO-WFL-01 (15-min SLA), SOP-029, and Supervisor Quickstart training.');
    } else {
      var totalFound = matchedObjects.length + matchedDecisions.length + matchedMeetings.length + matchedLessons.length + matchedSops.length + matchedExperts.length;
      lines.push('Found <strong>' + totalFound + '</strong> connected knowledge assets across QuantalFlow matching <em>&ldquo;' + esc(query) + '&rdquo;</em>.');
      if (matchedObjects[0]) {
        lines.push('Top match: <strong>' + esc(matchedObjects[0].title) + '</strong> (' + esc(matchedObjects[0].type) + ', ' + esc(matchedObjects[0].department) + ') — ' + esc(matchedObjects[0].summary));
      }
    }

    var groups = [
      { label: 'Projects & Objects', items: matchedObjects.filter(function (o) { return o.type === 'Project' || o.type === 'Task' || o.type === 'Client' || o.type === 'Product'; }).map(function (o) { return { title: o.title, id: o.id, kind: 'object' }; }) },
      { label: 'Documents & Research', items: matchedObjects.filter(function (o) { return o.type === 'Document' || o.type === 'Research Paper' || o.type === 'Policy'; }).map(function (o) { return { title: o.title, id: o.id, kind: 'object' }; }) },
      { label: 'Whiteboards & Mind Maps', items: matchedObjects.filter(function (o) { return o.type === 'Workflow' || (o.source && /whiteboard|mind/i.test(o.source)); }).map(function (o) { return { title: o.title, id: o.id, kind: 'object' }; }) },
      { label: 'Decisions', items: matchedDecisions.map(function (d) { return { title: d.title, id: d.id, kind: 'tab', tab: 'decisions', sub: 'decisions' }; }) },
      { label: 'Meetings', items: matchedMeetings.map(function (m) { return { title: m.title, id: m.id, kind: 'tab', tab: 'decisions', sub: 'meetings' }; }) },
      { label: 'SOPs', items: matchedSops.map(function (s) { return { title: s.id + ': ' + s.title, id: s.id, kind: 'tab', tab: 'sops', sub: 'sops' }; }) },
      { label: 'Lessons Learned', items: matchedLessons.map(function (l) { return { title: l.project + ' (' + l.date + ')', id: l.id, kind: 'tab', tab: 'decisions', sub: 'lessons' }; }) },
      { label: 'Team Experts', items: matchedExperts.map(function (e) { return { title: e.name + ' — ' + e.role, id: e.id, kind: 'tab', tab: 'learning', sub: 'experts' }; }) },
      { label: 'Training Materials', items: matchedCourses.map(function (c) { return { title: c.title, id: c.id, kind: 'tab', tab: 'learning', sub: 'courses' }; }) }
    ].filter(function (g) { return g.items.length > 0; });

    return { html: lines.join('<br><br>'), groups: groups };
  }

  function executeAiSearch(query) {
    var q = String(query || '').trim();
    if (!q) return;
    var input = document.getElementById('km-ai-search-input');
    if (input) input.value = q;

    var panel = document.getElementById('km-ai-results');
    var body = document.getElementById('km-ai-results-body');
    var groupsEl = document.getElementById('km-ai-results-groups');
    var metaEl = document.getElementById('km-ai-results-meta');
    if (!panel || !body || !groupsEl) return;

    panel.hidden = false;
    metaEl.textContent = 'Searching Projects, Whiteboards, Mind Maps, Decisions, SOPs & Experts…';
    body.innerHTML = '<em>Synthesising organisational intelligence for &ldquo;' + esc(q) + '&rdquo;…</em>';
    groupsEl.innerHTML = '';

    var local = runLocalSemanticSearch(q);
    body.innerHTML = local.html;
    metaEl.textContent = 'Grounded in ' + state.objects.length + ' Knowledge Objects & ' + state.relationships.length + ' Graph Links';

    groupsEl.innerHTML = local.groups.map(function (g) {
      return '<div class="km-ai-group">' +
        '<div class="km-ai-group__title"><span>' + esc(g.label) + '</span><span>' + g.items.length + '</span></div>' +
        g.items.slice(0, 4).map(function (it) {
          return '<button type="button" class="km-ai-group__item" data-search-hit-kind="' + esc(it.kind) + '" data-search-hit-id="' + esc(it.id) + '" data-search-hit-tab="' + esc(it.tab || '') + '" data-search-hit-sub="' + esc(it.sub || '') + '">' + esc(it.title) + '</button>';
        }).join('') +
      '</div>';
    }).join('');

    // Track search analytics
    var existingSearch = state.analytics.topSearches.find(function (s) { return s.term.toLowerCase() === q.toLowerCase(); });
    if (existingSearch) existingSearch.count += 1;
    else state.analytics.topSearches.unshift({ term: q.slice(0, 48), count: 1 });
    persistState();

    // Optional live DeepSeek enrichment when configured on backend
    fetch('/api/ai/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'knowledge',
        prompt: q,
        plan: {
          objects: state.objects.slice(0, 18).map(function (o) { return { id: o.id, type: o.type, title: o.title, summary: o.summary, project: o.project, author: o.author }; }),
          decisions: state.decisions,
          lessons: state.lessons,
          sops: state.sops.map(function (s) { return { id: s.id, title: s.title, department: s.department }; }),
          experts: state.experts
        }
      })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.result && data.result.answer) {
          body.innerHTML = esc(data.result.answer).replace(/\n/g, '<br>');
          metaEl.textContent = 'AI-Synthesised via DeepSeek • Grounded in Knowledge Graph';
        }
      })
      .catch(function () {});
  }

  /* ========================================================================
     RENDERERS: OVERVIEW DASHBOARD
     ======================================================================== */
  function countByType(type) {
    return state.objects.filter(function (o) { return o.type === type; }).length;
  }

  function typeBadgeClass(type) {
    if (type === 'Decision') return 'km-pill--green';
    if (type === 'SOP' || type === 'Policy') return 'km-pill--blue';
    if (type === 'Meeting') return 'km-pill--amber';
    if (type === 'Research Paper' || type === 'Workflow') return 'km-pill--purple';
    if (type === 'Document') return 'km-pill--teal';
    return 'km-pill--blue';
  }

  function renderOverview() {
    // Strictly ONE row of 4 high-signal KPI tiles with trends (Templates excluded from Knowledge Assets)
    var kpiEl = document.getElementById('km-kpi-grid');
    if (kpiEl) {
      var knowledgeObjects = state.objects.filter(function (o) { return o.type !== 'Template'; });
      var totalKnowledgeAssets = knowledgeObjects.length + state.wiki.length + state.documents.length;
      var activeProjectsAndSops = countByType('Project') + state.sops.length;
      var decisionsAndMeetings = state.decisions.length + state.meetings.length + state.lessons.length;

      var kpis = [
        { label: 'Knowledge Assets', val: totalKnowledgeAssets, meta: '↑ +14% vs last month', filter: 'all' },
        { label: 'Projects & SOPs', val: activeProjectsAndSops, meta: '↑ +3 published this month', filter: 'SOP' },
        { label: 'Decisions, Meetings & Lessons', val: decisionsAndMeetings, meta: '↑ +5 captured this month', filter: 'Decision' },
        { label: 'Knowledge Reuse Rate', val: state.analytics.reuseRate + '%', meta: '↑ +6 pts vs last month', filter: 'all' }
      ];
      kpiEl.innerHTML = kpis.map(function (k) {
        return '<button type="button" class="km-kpi" data-kpi-filter="' + esc(k.filter) + '">' +
          '<div class="km-kpi__label">' + esc(k.label) + '</div>' +
          '<div class="km-kpi__val">' + esc(k.val) + '</div>' +
          '<div class="km-kpi__meta">' + esc(k.meta) + '</div>' +
        '</button>';
      }).join('');
    }

    // Large Focal Knowledge Health Score Card with explicit trends & targets
    var healthEl = document.getElementById('km-overview-health');
    if (healthEl) {
      var score = Math.max(60, 94 - state.gaps.length * 3);
      var circ = 2 * Math.PI * 66;
      var dash = Math.round((score / 100) * circ);
      healthEl.innerHTML =
        '<div class="km-health-focal__ring">' +
          '<svg viewBox="0 0 160 160" width="156" height="156" role="img" aria-label="Knowledge Health Score ' + score + ' percent">' +
            '<circle cx="80" cy="80" r="66" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="13"/>' +
            '<circle cx="80" cy="80" r="66" fill="none" stroke="#5b7bff" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + Math.round(circ) + '" transform="rotate(-90 80 80)"/>' +
            '<text x="80" y="78" text-anchor="middle" font-size="34" font-weight="700" fill="#ffffff">' + score + '%</text>' +
            '<text x="80" y="100" text-anchor="middle" font-size="13" font-weight="600" fill="#b4bcd0">Target 90%</text>' +
          '</svg>' +
          '<span class="km-health-focal__trend">↑ +4 pts vs last month</span>' +
        '</div>' +
        '<div class="km-health-focal__metrics">' +
          '<div class="km-focal-metric"><div class="km-focal-metric__label">Knowledge Coverage</div><div class="km-focal-metric__val">91%</div><div class="km-focal-metric__delta">↑ +3% &bull; Target 95%</div></div>' +
          '<div class="km-focal-metric"><div class="km-focal-metric__label">Document Freshness</div><div class="km-focal-metric__val">89%</div><div class="km-focal-metric__delta">↑ +2% &bull; 90-day cycle</div></div>' +
          '<div class="km-focal-metric"><div class="km-focal-metric__label">Open Knowledge Gaps</div><div class="km-focal-metric__val">' + state.gaps.length + '</div><div class="km-focal-metric__delta">↓ -2 resolved this week</div></div>' +
          '<div class="km-focal-metric"><div class="km-focal-metric__label">Asset Reuse Rate</div><div class="km-focal-metric__val">' + state.analytics.reuseRate + '%</div><div class="km-focal-metric__delta">↑ +6 pts &bull; Target 80%</div></div>' +
        '</div>';
    }

    // Actionable Knowledge Gaps Card
    var gapsBadge = document.getElementById('km-gaps-badge');
    if (gapsBadge) gapsBadge.textContent = state.gaps.length + ' Open';
    var gapsEl = document.getElementById('km-overview-gaps');
    if (gapsEl) {
      gapsEl.innerHTML = state.gaps.map(function (g) {
        var pillCls = g.severity === 'High' ? 'km-pill--red' : g.severity === 'Medium' ? 'km-pill--amber' : 'km-pill--blue';
        return '<div class="km-gap-item">' +
          '<div>' +
            '<div class="km-gap-item__title">' + esc(g.title) + '</div>' +
            '<div class="km-gap-item__meta"><span class="km-pill ' + pillCls + '">' + esc(g.severity) + '</span> <span>' + esc(g.dept) + '</span></div>' +
          '</div>' +
          '<button type="button" class="km-btn km-btn--secondary km-btn--sm" data-resolve-gap="' + esc(g.id) + '">' + esc(g.action) + '</button>' +
        '</div>';
      }).join('') || '<p class="km-card__sub">All detected knowledge gaps have been resolved.</p>';
    }

    // Varied Recent Knowledge (enforce type diversity — never repeat the same badge down the list)
    var feedEl = document.getElementById('km-overview-feed');
    if (feedEl) {
      var sorted = state.objects.filter(function (o) { return o.type !== 'Template' && !String(o.id).startsWith('ECO-'); }).slice();
      sorted.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      var diverse = [];
      var seenTypes = {};
      sorted.forEach(function (o) {
        if (diverse.length >= 6) return;
        if (!seenTypes[o.type]) {
          diverse.push(o);
          seenTypes[o.type] = 1;
        }
      });
      if (diverse.length < 6) {
        sorted.forEach(function (o) {
          if (diverse.length < 6 && diverse.indexOf(o) === -1) diverse.push(o);
        });
      }
      feedEl.innerHTML = diverse.map(function (o) {
        var accent = TYPE_COLORS[o.type] || '#4262ff';
        return '<button type="button" class="km-row" style="border-left:3px solid ' + accent + ';" data-open-object="' + esc(o.id) + '">' +
          '<div class="km-row__main">' +
            '<div class="km-row__title">' + esc(cleanTitle(o.title)) + '</div>' +
            '<div class="km-row__meta"><span>' + esc(o.department) + '</span><span>&bull;</span><span>' + esc(o.author) + '</span><span>&bull;</span><span>' + esc(o.updatedAt) + '</span></div>' +
          '</div>' +
          '<span class="km-pill ' + typeBadgeClass(o.type) + '">' + esc(o.type) + '</span>' +
        '</button>';
      }).join('');
    }

    // Ranked Top 5 Topics (clean ranked list replacing noisy tag pills)
    var topicsEl = document.getElementById('km-overview-topics');
    if (topicsEl) {
      var top5 = (state.analytics.topSearches || []).slice(0, 5);
      topicsEl.innerHTML = top5.map(function (item, idx) {
        return '<li><button type="button" class="km-ranked-item" data-topic-search="' + esc(item.term) + '">' +
          '<span class="km-ranked-num">0' + (idx + 1) + '</span>' +
          '<span class="km-ranked-name">' + esc(item.term) + '</span>' +
          '<span class="km-ranked-count">' + item.count + ' queries</span>' +
        '</button></li>';
      }).join('');
    }

    // Top Contributors
    var expEl = document.getElementById('km-overview-experts');
    if (expEl) {
      expEl.innerHTML = state.experts.slice(0, 3).map(function (e) {
        var initials = e.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        return '<div class="km-expert-mini">' +
          '<span class="km-avatar">' + esc(initials) + '</span>' +
          '<div class="km-row__main"><div class="km-row__title">' + esc(e.name) + '</div><div class="km-row__meta">' + esc(e.role) + ' &bull; Score ' + e.score + '</div></div>' +
        '</div>';
      }).join('');
    }
  }

  /* ========================================================================
     RENDERER: KNOWLEDGE OBJECTS & SMART SEARCH (Redesigned Scannable Cards)
     ======================================================================== */
  var objFilter = {
    q: '',
    type: 'all',
    dept: 'all',
    project: 'all',
    perm: 'all',
    sort: 'recent',
    view: 'grid',
    cleanupOnly: false
  };

  var TYPE_VISUALS = {
    Document:          { bg: '#e8f4f6', fg: '#0e6f78', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    Project:           { bg: '#eef1ff', fg: '#3652e1', svg: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v6"/>' },
    Task:              { bg: '#f3eeff', fg: '#6b38d4', svg: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    Meeting:           { bg: '#fff4df', fg: '#9a5b00', svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' },
    Decision:          { bg: '#e8f7ef', fg: '#147a4c', svg: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>' },
    'Research Paper':  { bg: '#fceef5', fg: '#a61b60', svg: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>' },
    Policy:            { bg: '#eef1f6', fg: '#3b4254', svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    SOP:               { bg: '#eaf2ff', fg: '#1d58c8', svg: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/>' },
    'Training Material': { bg: '#e9f7f0', fg: '#0f764a', svg: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>' },
    Client:            { bg: '#fff1e6', fg: '#b54708', svg: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>' },
    Department:        { bg: '#eef0ff', fg: '#4338ca', svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>' },
    Product:           { bg: '#f0f1f5', fg: '#272932', svg: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>' },
    Workflow:          { bg: '#f5edff', fg: '#7828c8', svg: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 7.5 15.5 16.5"/>' },
    Template:          { bg: '#e6f4fe', fg: '#0369a1', svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>' }
  };

  function getTypeVisual(type) {
    return TYPE_VISUALS[type] || TYPE_VISUALS.Document;
  }

  var BOILERPLATE_RE = /^(live\s+(whiteboard|mind\s*map|project\s*planning)\s+board\s+synced|cloud\s+document\s+synced\s+from\s+quantalflow|synced\s+(note\s+from|directly\s+from)\s+(quantalflow\s+)?note\s*pad|automatically\s+(synced|ingested)\s+from\s+quantalflow|stored\s+in\s+quantalflow\s+files\s+vault|cloned\s+from\s+quantalflow\s+template\s+library)/i;

  function isBoilerplateLine(line) {
    var s = String(line || '').trim();
    if (!s) return true;
    return BOILERPLATE_RE.test(s);
  }

  function getMeaningfulPreview(obj) {
    var candidates = [];
    if (obj.summary) candidates = candidates.concat(String(obj.summary).split(/\r?\n/));
    if (obj.content) candidates = candidates.concat(String(obj.content).split(/\r?\n/));
    for (var i = 0; i < candidates.length; i += 1) {
      var line = candidates[i].trim();
      if (line && !isBoilerplateLine(line) && line.toLowerCase() !== String(obj.title || '').trim().toLowerCase()) {
        return line;
      }
    }
    return '';
  }

  function isNeedsCleanup(obj) {
    var t = String((obj && obj.title) || '').trim();
    if (!t) return true;
    return /^(new\s+project|untitled|new\s+board|workspace\s+note|note\s*pad\s+entry|quantalflow\s+board|test\b|draft\b|sample\b)/i.test(t) ||
           !getMeaningfulPreview(obj);
  }

  function parseDateValue(raw) {
    if (!raw) return null;
    if (typeof raw === 'number') return new Date(raw);
    var s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var parts = s.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatRelativeDate(raw) {
    var d = parseDateValue(raw);
    if (!d) return 'Recently';
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diffDays = Math.round((todayStart - targetStart) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var dayMonth = d.getDate() + ' ' + months[d.getMonth()];
    if (d.getFullYear() !== now.getFullYear()) {
      return dayMonth + ' ' + d.getFullYear();
    }
    return dayMonth;
  }

  function formatFullDateTooltip(raw) {
    var d = parseDateValue(raw);
    if (!d) return 'Updated recently';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return 'Updated ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function renderPermissionIndicator(perm) {
    if (perm === 'Private') {
      return '<span class="km-perm-lock" title="Private" aria-label="Private">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '</span>';
    }
    if (perm === 'Confidential') {
      return '<span class="km-perm-conf" title="Confidential">Confidential</span>';
    }
    return '';
  }

  function canDeleteObject(obj) {
    var user = window.__qfUser;
    var role = (user && (user.workspaceRole || user.role)) ? String(user.workspaceRole || user.role).toLowerCase() : 'owner';
    if (obj.permission === 'Confidential' || obj.permission === 'Executive') {
      return role === 'owner' || role === 'admin';
    }
    return true;
  }

  function buildDropdownOptions(key, options, currentVal, defaultLabel) {
    var menu = document.getElementById('km-dd-menu-' + key);
    var labelEl = document.getElementById('km-dd-label-' + key);
    if (!menu || !labelEl) return;

    var selectedOpt = options.find(function (o) { return o.value === currentVal; });
    var btn = menu.parentElement.querySelector('.km-dd__btn');
    if (currentVal !== 'all' && key !== 'sort' && selectedOpt) {
      labelEl.textContent = selectedOpt.label;
      if (btn) btn.classList.add('is-filtered');
    } else {
      labelEl.textContent = selectedOpt ? (key === 'sort' ? selectedOpt.label : defaultLabel) : defaultLabel;
      if (btn) btn.classList.remove('is-filtered');
    }

    menu.innerHTML = options.map(function (opt) {
      var sel = opt.value === currentVal;
      return '<button type="button" class="km-dd__opt' + (sel ? ' is-selected' : '') + '" role="option" aria-selected="' + (sel ? 'true' : 'false') + '" data-km-dd-pick="' + esc(key) + '" data-km-dd-val="' + esc(opt.value) + '">' +
        '<span>' + esc(opt.label) + '</span>' +
        (sel ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' : '') +
      '</button>';
    }).join('');
  }

  function populateObjectFilters() {
    var types = [{ value: 'all', label: 'All types' }].concat(
      window.QFKnowledgeSeed.OBJECT_TYPES.map(function (t) { return { value: t, label: t }; })
    );
    var depts = [{ value: 'all', label: 'All departments' }].concat(
      Array.from(new Set(state.objects.map(function (o) { return o.department; }).filter(Boolean))).sort().map(function (d) { return { value: d, label: d }; })
    );
    var prjs = [{ value: 'all', label: 'All projects' }].concat(
      Array.from(new Set(state.objects.map(function (o) { return o.project; }).filter(Boolean))).sort().map(function (p) { return { value: p, label: p }; })
    );
    var perms = [
      { value: 'all', label: 'All permissions' },
      { value: 'Public', label: 'Public' },
      { value: 'Department', label: 'Department' },
      { value: 'Project', label: 'Project' },
      { value: 'Private', label: 'Private' },
      { value: 'Executive', label: 'Executive' },
      { value: 'Confidential', label: 'Confidential' }
    ];
    var sorts = [
      { value: 'recent', label: 'Recently updated' },
      { value: 'oldest', label: 'Oldest' },
      { value: 'title', label: 'Title A to Z' }
    ];

    buildDropdownOptions('type', types, objFilter.type, 'Type');
    buildDropdownOptions('dept', depts, objFilter.dept, 'Department');
    buildDropdownOptions('project', prjs, objFilter.project, 'Project');
    buildDropdownOptions('perm', perms, objFilter.perm, 'Permission');
    buildDropdownOptions('sort', sorts, objFilter.sort, 'Recently updated');

    // Populate "+ New" type-picker menu
    var newMenu = document.getElementById('km-new-type-menu');
    if (newMenu && !newMenu.children.length) {
      newMenu.innerHTML = window.QFKnowledgeSeed.OBJECT_TYPES.map(function (t) {
        var vis = getTypeVisual(t);
        return '<button type="button" class="km-popover-menu__item" role="menuitem" data-km-new-type="' + esc(t) + '">' +
          '<span class="km-type-icon" style="width:22px;height:22px;background:' + vis.bg + ';color:' + vis.fg + ';"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + vis.svg + '</svg></span>' +
          '<span>' + esc(t) + '</span>' +
        '</button>';
      }).join('');
    }
  }

  function renderCardOrRow(o) {
    var vis = getTypeVisual(o.type);
    var titleText = cleanTitle(o.title);
    var preview = getMeaningfulPreview(o);
    var relDate = formatRelativeDate(o.updatedAt);
    var dateTip = formatFullDateTooltip(o.updatedAt);
    var permVal = o.permission || 'Public';
    var headerTip = (permVal === 'Public' || permVal === 'Project' || permVal === 'Department' || permVal === 'Executive')
      ? ('Permission: ' + permVal)
      : '';
    var permHtml = renderPermissionIndicator(permVal);
    var pinIcon = o.pinned
      ? '<span class="km-pin-indicator" title="Pinned" aria-label="Pinned"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="m15 4.5 4.5 4.5-9 9-4.5-4.5 9-9Z"/></svg></span>'
      : '';
    var allowDelete = canDeleteObject(o);

    var menuHtml =
      '<div class="km-card-menu-wrap">' +
        '<button type="button" class="km-card-more-btn" data-km-card-menu-btn="' + esc(o.id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ' + esc(titleText) + '" title="Actions">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>' +
        '</button>' +
        '<div class="km-popover-menu km-popover-menu--right km-card-menu" id="km-card-menu-' + esc(o.id) + '" role="menu" hidden>' +
          '<button type="button" class="km-popover-menu__item" role="menuitem" data-km-card-act="open" data-obj-id="' + esc(o.id) + '">Open</button>' +
          '<button type="button" class="km-popover-menu__item" role="menuitem" data-km-card-act="copy" data-obj-id="' + esc(o.id) + '">Copy link</button>' +
          '<button type="button" class="km-popover-menu__item" role="menuitem" data-km-card-act="pin" data-obj-id="' + esc(o.id) + '">' + (o.pinned ? 'Unpin' : 'Pin') + '</button>' +
          (allowDelete
            ? '<button type="button" class="km-popover-menu__item km-popover-menu__item--danger" role="menuitem" data-km-card-act="delete" data-obj-id="' + esc(o.id) + '">Delete</button>'
            : '') +
        '</div>' +
      '</div>';

    if (objFilter.view === 'list') {
      return '<div class="km-obj-row" role="article" tabindex="0" data-open-object="' + esc(o.id) + '">' +
        '<div class="km-obj-row__main" ' + (headerTip ? 'title="' + esc(headerTip) + '"' : '') + '>' +
          '<span class="km-type-icon" style="background:' + vis.bg + ';color:' + vis.fg + ';"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + vis.svg + '</svg></span>' +
          '<span class="km-obj-row__title">' + esc(titleText) + '</span>' +
          pinIcon +
          permHtml +
        '</div>' +
        '<div class="km-obj-row__type">' + esc(o.type) + '</div>' +
        '<div class="km-obj-row__owner">' + esc(o.author || 'Workspace Member') + '</div>' +
        '<div class="km-obj-row__date" title="' + esc(dateTip) + '">' + esc(relDate) + '</div>' +
        menuHtml +
      '</div>';
    }

    return '<div class="km-obj-card" role="article" tabindex="0" data-open-object="' + esc(o.id) + '">' +
      '<div class="km-obj-card__top" ' + (headerTip ? 'title="' + esc(headerTip) + '"' : '') + '>' +
        '<span class="km-type-badge">' +
          '<span class="km-type-icon" style="background:' + vis.bg + ';color:' + vis.fg + ';"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + vis.svg + '</svg></span>' +
          '<span>' + esc(o.type) + '</span>' +
        '</span>' +
        '<div class="km-obj-card__right">' +
          pinIcon +
          permHtml +
          menuHtml +
        '</div>' +
      '</div>' +
      '<div class="km-obj-card__title">' + esc(titleText) + '</div>' +
      (preview ? '<div class="km-obj-card__summary">' + esc(preview) + '</div>' : '') +
      '<div class="km-obj-card__foot">' +
        '<span class="km-obj-card__owner">' + esc(o.author || 'Workspace Member') + '</span>' +
        '<span class="km-obj-card__date" title="' + esc(dateTip) + '">' + esc(relDate) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderObjects() {
    populateObjectFilters();
    var grid = document.getElementById('km-objects-grid');
    var pinnedSection = document.getElementById('km-pinned-section');
    var pinnedGrid = document.getElementById('km-pinned-grid');
    var meta = document.getElementById('km-objects-meta');
    if (!grid) return;

    var qInput = document.getElementById('km-filter-q');
    if (qInput) objFilter.q = String(qInput.value || '').trim().toLowerCase();

    // Cleanup count badge
    var cleanupCount = state.objects.filter(isNeedsCleanup).length;
    var cleanupCountEl = document.getElementById('km-cleanup-count');
    var cleanupBtn = document.getElementById('km-btn-cleanup-filter');
    if (cleanupCountEl) cleanupCountEl.textContent = String(cleanupCount);
    if (cleanupBtn) cleanupBtn.setAttribute('aria-pressed', objFilter.cleanupOnly ? 'true' : 'false');

    // Active filter count
    var activeCount = 0;
    if (objFilter.q) activeCount += 1;
    if (objFilter.type !== 'all') activeCount += 1;
    if (objFilter.dept !== 'all') activeCount += 1;
    if (objFilter.project !== 'all') activeCount += 1;
    if (objFilter.perm !== 'all') activeCount += 1;
    if (objFilter.cleanupOnly) activeCount += 1;

    var activeWrap = document.getElementById('km-active-filters');
    var activeBadge = document.getElementById('km-active-filters-count');
    if (activeWrap && activeBadge) {
      activeWrap.hidden = activeCount === 0;
      activeBadge.textContent = activeCount + ' active';
    }

    var filtered = state.objects.filter(function (o) {
      if (objFilter.type !== 'all' && o.type !== objFilter.type) return false;
      if (objFilter.dept !== 'all' && o.department !== objFilter.dept) return false;
      if (objFilter.project !== 'all' && o.project !== objFilter.project) return false;
      if (objFilter.perm !== 'all' && o.permission !== objFilter.perm) return false;
      if (objFilter.cleanupOnly && !isNeedsCleanup(o)) return false;
      if (objFilter.q) {
        var hay = [o.id, o.title, o.summary, o.content, o.author, o.department, o.project, (o.tags || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(objFilter.q) === -1) return false;
      }
      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      if (objFilter.sort === 'title') {
        return cleanTitle(a.title).localeCompare(cleanTitle(b.title));
      }
      var da = parseDateValue(a.updatedAt);
      var db = parseDateValue(b.updatedAt);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      return objFilter.sort === 'oldest' ? (ta - tb) : (tb - ta);
    });

    if (meta) {
      meta.textContent = filtered.length + (filtered.length === 1 ? ' item' : ' items');
    }

    var isList = objFilter.view === 'list';
    grid.classList.toggle('is-list', isList);
    if (pinnedGrid) pinnedGrid.classList.toggle('is-list', isList);

    var pinnedItems = filtered.filter(function (o) { return Boolean(o.pinned); });
    var unpinnedItems = filtered.filter(function (o) { return !o.pinned; });

    if (pinnedSection && pinnedGrid) {
      if (pinnedItems.length > 0) {
        pinnedSection.hidden = false;
        pinnedGrid.innerHTML = pinnedItems.map(renderCardOrRow).join('');
      } else {
        pinnedSection.hidden = true;
        pinnedGrid.innerHTML = '';
      }
    }

    grid.innerHTML = unpinnedItems.map(renderCardOrRow).join('') ||
      (pinnedItems.length ? '' : '<p class="km-card__sub">No items match the current filters.</p>');
  }

  /* ========================================================================
     RENDERER: INTERACTIVE KNOWLEDGE GRAPH, ORGANISATIONAL BRAIN & TIMELINE
     ======================================================================== */
  function renderGraph() {
    var canvas = document.getElementById('km-graph-canvas');
    var legend = document.getElementById('km-graph-legend');
    if (!canvas) return;

    var relFilter = (document.getElementById('km-rel-filter') || {}).value || 'all';
    var rels = state.relationships.filter(function (r) { return relFilter === 'all' || r.type === relFilter; });
    var nodes = state.objects.slice(0, 16);
    var W = 820;
    var H = 460;
    var cx = W / 2;
    var cy = H / 2;

    var pos = {};
    nodes.forEach(function (n, idx) {
      if (idx === 0) {
        pos[n.id] = { x: cx - 120, y: cy };
      } else if (idx === 1) {
        pos[n.id] = { x: cx + 140, y: cy };
      } else {
        var angle = ((idx - 2) / Math.max(1, nodes.length - 2)) * Math.PI * 2;
        var rx = 310 + ((idx % 2) * 38);
        var ry = 175 + ((idx % 2) * 18);
        pos[n.id] = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
      }
    });

    var edgesSvg = rels.map(function (r) {
      var a = pos[r.source];
      var b = pos[r.target];
      if (!a || !b) return '';
      var isHighlighted = r.source === selectedGraphNodeId || r.target === selectedGraphNodeId;
      var mx = (a.x + b.x) / 2;
      var my = (a.y + b.y) / 2;
      return '<g>' +
        '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + (isHighlighted ? '#4262ff' : '#cbd5e1') + '" stroke-width="' + (isHighlighted ? 2.4 : 1.4) + '" stroke-opacity="' + (isHighlighted ? 0.95 : 0.75) + '"/>' +
        '<rect x="' + (mx - 38) + '" y="' + (my - 9) + '" width="76" height="17" rx="8" fill="#ffffff" stroke="' + (isHighlighted ? '#4262ff' : '#e2e8f0') + '"/>' +
        '<text x="' + mx + '" y="' + (my + 3) + '" text-anchor="middle" font-size="9.5" font-weight="600" fill="' + (isHighlighted ? '#4262ff' : '#5f6370') + '">' + esc(r.type) + '</text>' +
      '</g>';
    }).join('');

    var nodesSvg = nodes.map(function (n) {
      var p = pos[n.id];
      var color = TYPE_COLORS[n.type] || '#4262ff';
      var active = n.id === selectedGraphNodeId;
      var shortTitle = n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title;
      return '<g class="km-graph-node" data-graph-node="' + esc(n.id) + '" transform="translate(' + p.x + ',' + p.y + ')">' +
        '<circle r="' + (active ? 22 : 17) + '" fill="' + color + '" stroke="' + (active ? '#1c1c1e' : '#ffffff') + '" stroke-width="' + (active ? 3 : 2.5) + '"/>' +
        '<text y="4" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">' + esc(n.type.slice(0, 3).toUpperCase()) + '</text>' +
        '<rect x="-66" y="23" width="132" height="20" rx="6" fill="rgba(255,255,255,0.94)" stroke="rgba(28,28,30,0.1)"/>' +
        '<text y="36" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1c1c1e">' + esc(shortTitle) + '</text>' +
      '</g>';
    }).join('');

    canvas.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Interactive Organisational Knowledge Graph">' + edgesSvg + nodesSvg + '</svg>';

    if (legend) {
      legend.innerHTML = ['Project', 'Document', 'Meeting', 'Decision', 'SOP', 'Workflow', 'Training Material'].map(function (t) {
        return '<span class="km-legend-item"><span class="km-legend-dot" style="background:' + (TYPE_COLORS[t] || '#4262ff') + '"></span>' + esc(t) + '</span>';
      }).join('');
    }

    renderGraphInspector();
    renderBrainTree();
    renderTimeline();
  }

  function renderGraphInspector() {
    var el = document.getElementById('km-graph-inspector');
    if (!el) return;
    var node = state.objects.find(function (o) { return o.id === selectedGraphNodeId; }) || state.objects[0];
    if (!node) return;
    var links = state.relationships.filter(function (r) { return r.source === node.id || r.target === node.id; });
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<span class="km-pill km-pill--blue">' + esc(node.type) + '</span>' +
        '<span class="km-pill">' + esc(node.permission) + '</span>' +
      '</div>' +
      '<h3 class="km-card__title" style="margin-bottom:6px;">' + esc(node.title) + '</h3>' +
      '<p class="km-card__sub" style="margin-bottom:14px;">' + esc(node.summary) + '</p>' +
      '<div class="km-detail-box__label">Connected Relationships (' + links.length + ')</div>' +
      '<div class="km-list" style="margin-top:8px;margin-bottom:14px;">' +
        (links.map(function (r) {
          var otherId = r.source === node.id ? r.target : r.source;
          var other = state.objects.find(function (o) { return o.id === otherId; });
          if (!other) return '';
          return '<button type="button" class="km-row" data-graph-node="' + esc(other.id) + '">' +
            '<div class="km-row__main"><div class="km-row__title">' + esc(other.title) + '</div><div class="km-row__meta">' + esc(r.type) + ' &bull; ' + esc(other.type) + '</div></div>' +
          '</button>';
        }).join('') || '<p class="km-card__sub">No links yet.</p>') +
      '</div>' +
      '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-open-object="' + esc(node.id) + '">Open Full Inspector &rarr;</button>';
  }

  function renderBrainTree() {
    var el = document.getElementById('km-brain-tree');
    if (!el) return;
    var branches = [
      { title: 'Departments', items: Array.from(new Set(state.objects.map(function (o) { return o.department; }))).map(function (d) { return { label: d, action: 'search', query: d }; }) },
      { title: 'Projects', items: state.objects.filter(function (o) { return o.type === 'Project'; }).map(function (o) { return { label: o.title, action: 'object', id: o.id }; }) },
      { title: 'Documents', items: state.documents.map(function (d) { return { label: d.name, action: 'tab', tab: 'sops', sub: 'documents' }; }) },
      { title: 'Decisions', items: state.decisions.map(function (d) { return { label: d.title, action: 'tab', tab: 'decisions', sub: 'decisions' }; }) },
      { title: 'SOPs', items: state.sops.map(function (s) { return { label: s.id + ': ' + s.title, action: 'tab', tab: 'sops', sub: 'sops' }; }) },
      { title: 'Training', items: state.courses.map(function (c) { return { label: c.title, action: 'tab', tab: 'learning', sub: 'courses' }; }) },
      { title: 'Experts', items: state.experts.map(function (e) { return { label: e.name + ' (' + e.role + ')', action: 'tab', tab: 'learning', sub: 'experts' }; }) }
    ];

    el.innerHTML =
      '<div class="km-brain-root">Company — QuantalFlow Organisational Brain</div>' +
      '<div class="km-brain-branches">' +
        branches.map(function (b) {
          return '<div class="km-brain-branch">' +
            '<div class="km-brain-branch__head"><span>' + esc(b.title) + '</span><span class="km-pill">' + b.items.length + '</span></div>' +
            b.items.slice(0, 6).map(function (it) {
              return '<button type="button" class="km-brain-leaf" data-brain-action="' + esc(it.action) + '" data-brain-id="' + esc(it.id || '') + '" data-brain-query="' + esc(it.query || '') + '" data-brain-tab="' + esc(it.tab || '') + '" data-brain-sub="' + esc(it.sub || '') + '">' + esc(it.label) + '</button>';
            }).join('') +
          '</div>';
        }).join('') +
      '</div>';
  }

  function renderTimeline() {
    var sel = document.getElementById('km-timeline-project');
    var list = document.getElementById('km-timeline-list');
    if (!sel || !list) return;
    var keys = Object.keys(state.timelines);
    var cur = sel.value && state.timelines[sel.value] ? sel.value : keys[0];
    sel.innerHTML = keys.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
    sel.value = cur;

    var events = state.timelines[cur] || [];
    list.innerHTML = events.map(function (ev) {
      return '<li class="km-timeline__item">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<span class="km-timeline__date">' + esc(ev.date) + '</span>' +
          '<span class="km-pill km-pill--blue">' + esc(ev.stage) + '</span>' +
        '</div>' +
        '<div class="km-timeline__title">' + esc(ev.title) + '</div>' +
        '<div class="km-timeline__desc">' + esc(ev.desc) + '</div>' +
      '</li>';
    }).join('');
  }

  /* ========================================================================
     RENDERER: DECISIONS, MEETINGS & LESSONS LEARNED
     ======================================================================== */
  function renderDecisionsAndMeetings() {
    var decEl = document.getElementById('km-view-decisions');
    if (decEl) {
      decEl.innerHTML = state.decisions.map(function (d) {
        return '<article class="km-rich-card">' +
          '<div class="km-rich-card__head">' +
            '<div>' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">' +
                '<span class="km-pill km-pill--green">' + esc(d.status || 'Approved') + '</span>' +
                '<span class="km-pill km-pill--blue">' + esc(d.project) + '</span>' +
                '<span class="km-timeline__date">' + esc(d.id) + ' &bull; Approved ' + esc(d.approvalDate) + '</span>' +
              '</div>' +
              '<h3 class="km-card__title">' + esc(d.title) + '</h3>' +
              '<p class="km-card__sub" style="margin-top:4px;">' + esc(d.description) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="km-detail-grid">' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Reason</div><div class="km-detail-box__val">' + esc(d.reason) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Alternatives Considered</div><div class="km-detail-box__val">' + (d.alternatives || []).map(function (a) { return '<span class="km-pill" style="margin:2px;">' + esc(a) + '</span>'; }).join('') + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Approver(s)</div><div class="km-detail-box__val"><strong>' + esc(d.approver) + '</strong><br>' + esc((d.approvers || []).join(', ')) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Risks</div><div class="km-detail-box__val">' + esc(d.risks) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Expected Outcomes</div><div class="km-detail-box__val">' + esc(d.outcomes) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Supporting Evidence &amp; Attachments</div><div class="km-detail-box__val">' + esc(d.evidence) + '<div style="margin-top:6px;">' + (d.attachments || []).map(function (f) { return '<span class="km-tag" style="margin-right:4px;">' + esc(f) + '</span>'; }).join('') + '</div></div></div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    var mtgEl = document.getElementById('km-view-meetings');
    if (mtgEl) {
      mtgEl.innerHTML = state.meetings.map(function (m, mIdx) {
        return '<article class="km-rich-card">' +
          '<div class="km-rich-card__head">' +
            '<div>' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">' +
                '<span class="km-pill km-pill--amber">Meeting Knowledge</span>' +
                '<span class="km-pill km-pill--blue">' + esc(m.project) + '</span>' +
                '<span class="km-timeline__date">' + esc(m.date) + '</span>' +
              '</div>' +
              '<h3 class="km-card__title">' + esc(m.title) + '</h3>' +
              '<p class="km-card__sub" style="margin-top:4px;">' + esc(m.summary) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="km-detail-grid">' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Decisions Captured</div><ul class="km-bullet-list">' + (m.decisions || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Action Items</div><div class="km-list" style="gap:6px;">' + (m.actionItems || []).map(function (a, aIdx) {
              return '<label style="display:flex;align-items:flex-start;gap:7px;font-size:12.5px;cursor:pointer;">' +
                '<input type="checkbox" data-toggle-action="' + mIdx + ':' + aIdx + '" ' + (a.done ? 'checked' : '') + ' />' +
                '<span style="' + (a.done ? 'text-decoration:line-through;color:var(--km-ink-muted);' : '') + '">' + esc(a.text) + ' <strong>(' + esc(a.owner) + ')</strong></span>' +
              '</label>';
            }).join('') + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Risks</div><ul class="km-bullet-list">' + (m.risks || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Participants &amp; Attachments</div><div class="km-detail-box__val">' + esc((m.participants || []).join(', ')) + '<div style="margin-top:6px;">' + (m.attachments || []).map(function (f) { return '<span class="km-tag" style="margin-right:4px;">' + esc(f) + '</span>'; }).join('') + '</div></div></div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    var lesEl = document.getElementById('km-view-lessons');
    if (lesEl) {
      lesEl.innerHTML = state.lessons.map(function (l) {
        return '<article class="km-rich-card">' +
          '<div class="km-rich-card__head">' +
            '<div>' +
              '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><span class="km-pill km-pill--teal">Lessons Learned</span><span class="km-timeline__date">' + esc(l.date) + ' &bull; ' + esc(l.author) + '</span></div>' +
              '<h3 class="km-card__title">' + esc(l.project) + '</h3>' +
            '</div>' +
          '</div>' +
          '<div class="km-detail-grid">' +
            '<div class="km-detail-box"><div class="km-detail-box__label">What Worked</div><div class="km-detail-box__val">' + esc(l.whatWorked) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">What Failed</div><div class="km-detail-box__val">' + esc(l.whatFailed) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Unexpected Challenges</div><div class="km-detail-box__val">' + esc(l.challenges) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Recommendations</div><div class="km-detail-box__val">' + esc(l.recommendations) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Best Practices</div><div class="km-detail-box__val">' + esc(l.bestPractices) + '</div></div>' +
            '<div class="km-detail-box"><div class="km-detail-box__label">Success Factors</div><div class="km-detail-box__val">' + esc(l.successFactors) + '</div></div>' +
          '</div>' +
        '</article>';
      }).join('');
    }
  }

  /* ========================================================================
     RENDERER: SOP MANAGEMENT, ENTERPRISE WIKI & DOCUMENT MANAGEMENT
     ======================================================================== */
  function renderSopsWikiDocs() {
    var sopEl = document.getElementById('km-view-sops');
    if (sopEl) {
      sopEl.innerHTML = state.sops.map(function (s) {
        var stCls = s.status === 'Approved' ? 'km-pill--green' : 'km-pill--amber';
        return '<article class="km-rich-card">' +
          '<div class="km-rich-card__head">' +
            '<div>' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">' +
                '<span class="km-pill km-pill--blue">' + esc(s.id) + ' &bull; ' + esc(s.version) + '</span>' +
                '<span class="km-pill ' + stCls + '">' + esc(s.status) + '</span>' +
                '<span class="km-timeline__date">Dept: ' + esc(s.department) + ' &bull; Owner: ' + esc(s.owner) + ' &bull; Next Review: ' + esc(s.nextReview) + '</span>' +
              '</div>' +
              '<h3 class="km-card__title">' + esc(s.title) + '</h3>' +
            '</div>' +
            '<div class="km-hero__actions">' +
              (s.status !== 'Approved' ? '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-approve-sop="' + esc(s.id) + '">Approve SOP</button>' : '') +
              '<button type="button" class="km-btn km-btn--secondary km-btn--sm" data-bump-sop="' + esc(s.id) + '">New Version</button>' +
            '</div>' +
          '</div>' +
          '<ol class="km-bullet-list" style="list-style:decimal;padding-left:20px;">' +
            (s.steps || []).map(function (st) { return '<li style="margin-bottom:4px;">' + esc(st) + '</li>'; }).join('') +
          '</ol>' +
        '</article>';
      }).join('');
    }

    // Enterprise Wiki
    var treeEl = document.getElementById('km-wiki-tree');
    var artEl = document.getElementById('km-wiki-article');
    if (treeEl && artEl) {
      var sections = ['Company', 'Departments', 'Products', 'Clients', 'Projects', 'Policies', 'Training', 'Operations'];
      treeEl.innerHTML = sections.map(function (sec) {
        var pages = state.wiki.filter(function (w) { return w.section === sec; });
        return '<div class="km-wiki-section-title">' + esc(sec) + '</div>' +
          pages.map(function (p) {
            return '<button type="button" class="km-wiki-link' + (p.id === activeWikiId ? ' is-active' : '') + '" data-wiki-open="' + esc(p.id) + '">' + esc(p.title) + '</button>';
          }).join('');
      }).join('');

      var page = state.wiki.find(function (w) { return w.id === activeWikiId; }) || state.wiki[0];
      if (page) {
        var formatted = esc(page.body).replace(/\[\[([^\]]+)\]\]/g, function (_, ref) {
          return '<button type="button" class="km-wikilink-ref" data-wikilink="' + esc(ref) + '">' + esc(ref) + '</button>';
        }).replace(/\n/g, '<br><br>');
        artEl.innerHTML =
          '<div class="km-card__head">' +
            '<div>' +
              '<span class="km-pill km-pill--blue" style="margin-bottom:8px;">' + esc(page.section) + '</span>' +
              '<h2 class="km-card__title" style="font-size:20px;">' + esc(page.title) + '</h2>' +
              '<p class="km-card__sub">Maintained by ' + esc(page.author) + ' &bull; Updated ' + esc(page.updatedAt) + '</p>' +
            '</div>' +
            '<button type="button" class="km-btn km-btn--secondary km-btn--sm" data-wiki-edit="' + esc(page.id) + '">Edit Article</button>' +
          '</div>' +
          '<div style="font-size:14.5px;line-height:1.7;color:var(--km-ink);">' + formatted + '</div>';
      }
    }

    // Documents Vault
    var docsEl = document.getElementById('km-docs-grid');
    if (docsEl) {
      var fmt = (document.getElementById('km-doc-format-filter') || {}).value || 'all';
      var docs = state.documents.filter(function (d) { return fmt === 'all' || d.format === fmt; });
      docsEl.innerHTML = docs.map(function (d) {
        var stCls = d.status === 'Approved' ? 'km-pill--green' : 'km-pill--amber';
        return '<div class="km-doc-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<span class="km-doc-badge">' + esc(d.format) + '</span>' +
            '<span class="km-pill ' + stCls + '">' + esc(d.status) + ' &bull; ' + esc(d.version) + '</span>' +
          '</div>' +
          '<div class="km-obj-card__title" style="font-size:14.5px;">' + esc(d.name) + '</div>' +
          '<div class="km-obj-card__summary">' + esc(d.summary) + '</div>' +
          '<div class="km-row__meta"><span>' + esc(d.size) + '</span><span>&bull;</span><span>' + esc(d.permission) + '</span><span>&bull;</span><span>' + esc(d.author) + '</span></div>' +
          '<div style="margin-top:auto;padding-top:8px;display:flex;gap:8px;">' +
            '<button type="button" class="km-btn km-btn--secondary km-btn--sm" data-preview-doc="' + esc(d.id) + '">Preview &amp; History</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  /* ========================================================================
     RENDERER: EXPERTS, LEARNING CENTRE & TEMPLATE LIBRARY
     ======================================================================== */
  function renderExpertsLearningTemplates() {
    var expEl = document.getElementById('km-view-experts');
    if (expEl) {
      expEl.innerHTML = state.experts.map(function (e) {
        var initials = e.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        return '<article class="km-card">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
            '<span class="km-avatar" style="width:44px;height:44px;font-size:15px;">' + esc(initials) + '</span>' +
            '<div><div class="km-card__title">' + esc(e.name) + '</div><div class="km-card__sub">' + esc(e.role) + ' &bull; ' + esc(e.department) + '</div></div>' +
          '</div>' +
          '<div class="km-health-metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px;">' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Projects</div><div class="km-mini-metric__val">' + e.projects + '</div></div>' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Documents</div><div class="km-mini-metric__val">' + e.documents + '</div></div>' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Decisions</div><div class="km-mini-metric__val">' + e.decisions + '</div></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:5px;"><span>Knowledge Score</span><span>' + e.score + '/100</span></div>' +
          '<div class="km-score-bar" style="margin-bottom:12px;"><div class="km-score-bar__fill" style="width:' + e.score + '%;"></div></div>' +
          '<div class="km-obj-card__tags">' + (e.areas || []).map(function (a) { return '<span class="km-tag">' + esc(a) + '</span>'; }).join('') + '</div>' +
        '</article>';
      }).join('');
    }

    var crsEl = document.getElementById('km-view-courses');
    if (crsEl) {
      crsEl.innerHTML = state.courses.map(function (c) {
        return '<article class="km-rich-card">' +
          '<div class="km-rich-card__head">' +
            '<div>' +
              '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">' +
                '<span class="km-pill km-pill--green">' + esc(c.category) + '</span>' +
                '<span class="km-pill">' + esc(c.duration) + ' &bull; ' + c.modules + ' Modules</span>' +
                '<span class="km-pill km-pill--purple">Cert: ' + esc(c.certification) + '</span>' +
              '</div>' +
              '<h3 class="km-card__title">' + esc(c.title) + '</h3>' +
              '<p class="km-card__sub">Generated from: ' + esc(c.sourceKnowledge) + ' &bull; ' + c.enrolled + ' enrolled (' + c.completion + '% avg completion)</p>' +
            '</div>' +
            '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-start-quiz="' + esc(c.id) + '">Take Assessment &amp; Certify</button>' +
          '</div>' +
          '<div class="km-score-bar"><div class="km-score-bar__fill" style="width:' + c.completion + '%;"></div></div>' +
        '</article>';
      }).join('');
    }

    var tplEl = document.getElementById('km-view-templates');
    if (tplEl) {
      tplEl.innerHTML = state.templates.map(function (t) {
        return '<article class="km-card" style="display:flex;flex-direction:column;gap:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;"><span class="km-pill km-pill--blue">' + esc(t.category) + '</span><span class="km-timeline__date">' + t.uses + ' clones</span></div>' +
          '<h3 class="km-card__title">' + esc(t.title) + '</h3>' +
          '<p class="km-card__sub">' + esc(t.desc) + '</p>' +
          '<div style="margin-top:auto;padding-top:8px;"><button type="button" class="km-btn km-btn--secondary km-btn--sm" data-clone-template="' + esc(t.id) + '">Clone &amp; Customise</button></div>' +
        '</article>';
      }).join('');
    }
  }

  /* ========================================================================
     RENDERER: HEALTH, PERMISSIONS, AUTOMATION & ANALYTICS
     ======================================================================== */
  function renderGovernance() {
    var healthEl = document.getElementById('km-view-health');
    if (healthEl) {
      healthEl.innerHTML =
        '<div class="km-kpi-grid">' +
          '<div class="km-kpi"><div class="km-kpi__label">Knowledge Coverage</div><div class="km-kpi__val">91%</div><div class="km-kpi__meta">Across 6 depts</div></div>' +
          '<div class="km-kpi"><div class="km-kpi__label">Outdated Docs</div><div class="km-kpi__val">1</div><div class="km-kpi__meta" style="color:var(--km-amber);">Needs refresh</div></div>' +
          '<div class="km-kpi"><div class="km-kpi__label">Missing SOPs</div><div class="km-kpi__val">' + state.gaps.filter(function (g) { return /SOP/i.test(g.title); }).length + '</div><div class="km-kpi__meta" style="color:var(--km-red);">Actionable</div></div>' +
          '<div class="km-kpi"><div class="km-kpi__label">Duplicate Content</div><div class="km-kpi__val">1</div><div class="km-kpi__meta">Merge ready</div></div>' +
          '<div class="km-kpi"><div class="km-kpi__label">Unused Assets</div><div class="km-kpi__val">2</div><div class="km-kpi__meta">&lt;5 views / 90d</div></div>' +
          '<div class="km-kpi"><div class="km-kpi__label">Doc Quality Index</div><div class="km-kpi__val">93/100</div><div class="km-kpi__meta">Verified metadata</div></div>' +
        '</div>' +
        '<div class="km-card"><div class="km-card__head"><div><h3 class="km-card__title">Recommended Health Actions</h3><p class="km-card__sub">Resolve missing SOPs, outdated files, and duplicates with one click</p></div></div>' +
        '<div class="km-gap-list">' +
          state.gaps.map(function (g) {
            return '<div class="km-gap-item"><div><div class="km-gap-item__title">' + esc(g.title) + '</div><div class="km-gap-item__meta">' + esc(g.dept) + ' &bull; Severity: ' + esc(g.severity) + '</div></div><button type="button" class="km-btn km-btn--primary km-btn--sm" data-resolve-gap="' + esc(g.id) + '">' + esc(g.action) + '</button></div>';
          }).join('') +
        '</div></div>';
    }

    var permEl = document.getElementById('km-view-permissions');
    if (permEl) {
      permEl.innerHTML =
        '<div class="km-card__head"><div><h2 class="km-card__title">Role-Based Knowledge Permissions &amp; Inheritance</h2><p class="km-card__sub">Six enterprise classification tiers synced with QuantalFlow Workspace RBAC</p></div></div>' +
        '<div class="km-table-wrap"><table class="km-table"><thead><tr><th>Level</th><th>Scope</th><th>Inheritance Rule</th><th>Viewers</th><th>Editors</th><th>Approvers</th></tr></thead><tbody>' +
          window.QFKnowledgeSeed.PERMISSION_LEVELS.map(function (p) {
            return '<tr><td><span class="km-pill km-pill--blue">' + esc(p.level) + '</span></td><td>' + esc(p.scope) + '</td><td>' + esc(p.inheritance) + '</td><td>' + esc(p.viewers) + '</td><td>' + esc(p.editors) + '</td><td>' + esc(p.approvers) + '</td></tr>';
          }).join('') +
        '</tbody></table></div>';
    }

    var autoEl = document.getElementById('km-view-automation');
    if (autoEl) {
      autoEl.innerHTML = state.automations.map(function (a) {
        return '<div class="km-card" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;"><span class="km-pill km-pill--purple">Automation Rule</span><span class="km-timeline__date">' + a.runs + ' runs &bull; Last: ' + esc(a.lastRun) + '</span></div>' +
            '<div class="km-card__title">' + esc(a.name) + '</div>' +
            '<div class="km-card__sub"><strong>' + esc(a.trigger) + '</strong> &rarr; ' + esc(a.action) + '</div>' +
          '</div>' +
          '<div class="km-hero__actions">' +
            '<button type="button" class="km-btn km-btn--secondary km-btn--sm" data-run-auto="' + esc(a.id) + '">Test Run</button>' +
            '<button type="button" class="km-switch" role="switch" aria-checked="' + (a.enabled ? 'true' : 'false') + '" aria-label="Toggle ' + esc(a.name) + '" data-toggle-auto="' + esc(a.id) + '"></button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var anEl = document.getElementById('km-view-analytics');
    if (anEl) {
      var maxGrowth = Math.max.apply(null, state.analytics.growth.map(function (g) { return g.count; })) || 1;
      var maxDept = Math.max.apply(null, state.analytics.departments.map(function (d) { return d.count; })) || 1;
      var barsSvg = state.analytics.growth.map(function (g, i) {
        var h = Math.round((g.count / maxGrowth) * 140);
        var x = 24 + i * 64;
        return '<g>' +
          '<rect x="' + x + '" y="' + (165 - h) + '" width="36" height="' + h + '" rx="6" fill="#4262ff"/>' +
          '<text x="' + (x + 18) + '" y="' + (158 - h) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#1c1c1e">' + g.count + '</text>' +
          '<text x="' + (x + 18) + '" y="185" text-anchor="middle" font-size="11" fill="#5f6370">' + esc(g.month) + '</text>' +
        '</g>';
      }).join('');

      anEl.innerHTML =
        '<article class="km-card"><h3 class="km-card__title">Knowledge Growth Trend</h3><p class="km-card__sub" style="margin-bottom:12px;">Total indexed Knowledge Objects over the last 6 months</p>' +
          '<svg viewBox="0 0 420 198" style="width:100%;height:auto;" role="img" aria-label="Knowledge growth chart">' + barsSvg + '</svg>' +
        '</article>' +
        '<article class="km-card"><h3 class="km-card__title">Department Contributions</h3><p class="km-card__sub" style="margin-bottom:12px;">Knowledge assets published per department</p>' +
          '<div class="km-stack" style="gap:10px;">' +
            state.analytics.departments.map(function (d) {
              var pct = Math.round((d.count / maxDept) * 100);
              return '<div><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:4px;"><span>' + esc(d.name) + '</span><span>' + d.count + '</span></div><div class="km-score-bar"><div class="km-score-bar__fill" style="width:' + pct + '%;"></div></div></div>';
            }).join('') +
          '</div>' +
        '</article>' +
        '<article class="km-card"><h3 class="km-card__title">Search Analytics — Top Queries</h3><p class="km-card__sub" style="margin-bottom:12px;">Most frequent organisational AI searches</p>' +
          '<div class="km-list">' +
            state.analytics.topSearches.slice(0, 6).map(function (s) {
              return '<button type="button" class="km-row" data-topic-search="' + esc(s.term) + '"><span class="km-row__title" style="font-size:13px;">' + esc(s.term) + '</span><span class="km-pill km-pill--blue">' + s.count + ' queries</span></button>';
            }).join('') +
          '</div>' +
        '</article>' +
        '<article class="km-card"><h3 class="km-card__title">Learning Progress &amp; Knowledge Reuse</h3><p class="km-card__sub" style="margin-bottom:14px;">Organisational adoption metrics</p>' +
          '<div class="km-health-metrics">' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Knowledge Reuse Rate</div><div class="km-mini-metric__val">' + state.analytics.reuseRate + '%</div></div>' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Avg Learning Completion</div><div class="km-mini-metric__val">' + state.analytics.avgLearningCompletion + '%</div></div>' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">Graph Density</div><div class="km-mini-metric__val">' + state.relationships.length + ' links</div></div>' +
            '<div class="km-mini-metric"><div class="km-mini-metric__label">AI Search Resolution</div><div class="km-mini-metric__val">94%</div></div>' +
          '</div>' +
        '</article>';
    }
  }

  function renderAll() {
    renderOverview();
    renderObjects();
    renderGraph();
    renderDecisionsAndMeetings();
    renderSopsWikiDocs();
    renderExpertsLearningTemplates();
    renderGovernance();
  }

  /* ========================================================================
     KNOWLEDGE OBJECT INSPECTOR DRAWER (with Context-Aware Recommendations)
     ======================================================================== */
  function openObjectInspector(id) {
    ensurePortals();
    var obj = state.objects.find(function (o) { return o.id === id; });
    if (!obj) return;
    obj.views = (obj.views || 0) + 1;

    var drawer = document.getElementById('km-inspector-drawer');
    var backdrop = document.getElementById('km-inspector-backdrop');
    var typeEl = document.getElementById('km-inspector-type');
    var titleEl = document.getElementById('km-inspector-title');
    var bodyEl = document.getElementById('km-inspector-body');
    if (!drawer || !bodyEl) return;

    typeEl.textContent = obj.type + ' • ' + obj.id;
    titleEl.textContent = obj.title;

    // Context-aware recommendations (same project, department, or overlapping tags)
    var recs = state.objects.filter(function (other) {
      if (other.id === obj.id) return false;
      if (other.project && other.project === obj.project) return true;
      return (other.tags || []).some(function (t) { return (obj.tags || []).indexOf(t) !== -1; });
    }).slice(0, 4);

    var expertRec = state.experts.find(function (e) {
      return e.department === obj.department || e.name === obj.author;
    }) || state.experts[0];

    bodyEl.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<span class="km-pill km-pill--blue">' + esc(obj.department) + '</span>' +
        '<span class="km-pill">' + esc(obj.project) + '</span>' +
        '<span class="km-pill km-pill--green">' + esc(obj.permission) + '</span>' +
        '<span class="km-pill">' + esc(obj.source || 'Knowledge Hub') + '</span>' +
      '</div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Summary &amp; Content</div><div class="km-detail-box__val">' + esc(obj.summary) + '<br><br>' + esc(obj.content).replace(/\n/g, '<br>') + '</div></div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Context-Aware Knowledge Recommendations</div>' +
        '<div class="km-list" style="margin-top:6px;">' +
          recs.map(function (r) {
            return '<button type="button" class="km-row" data-open-object="' + esc(r.id) + '"><div class="km-row__main"><div class="km-row__title">' + esc(r.title) + '</div><div class="km-row__meta">Related ' + esc(r.type) + ' &bull; ' + esc(r.author) + '</div></div></button>';
          }).join('') +
          (expertRec ? '<div class="km-expert-mini" style="margin-top:4px;"><span class="km-avatar">' + esc(expertRec.name.slice(0, 2).toUpperCase()) + '</span><div><div class="km-row__title">Recommended Expert: ' + esc(expertRec.name) + '</div><div class="km-row__meta">' + esc(expertRec.role) + '</div></div></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Version History</div>' +
        '<ul class="km-bullet-list">' + (obj.versions || []).map(function (v) { return '<li><strong>' + esc(v.v) + '</strong> (' + esc(v.date) + ' by ' + esc(v.by) + ') — ' + esc(v.note) + '</li>'; }).join('') + '</ul>' +
      '</div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Comments (' + (obj.comments || []).length + ')</div>' +
        '<div class="km-list" style="margin-bottom:8px;">' + ((obj.comments || []).map(function (c) {
          return '<div style="font-size:12.5px;"><strong>' + esc(c.author) + '</strong> <span style="color:var(--km-ink-muted);">(' + esc(c.date) + ')</span>: ' + esc(c.text) + '</div>';
        }).join('') || '<span class="km-card__sub">No comments yet.</span>') + '</div>' +
        '<form id="km-comment-form" data-obj-id="' + esc(obj.id) + '" style="display:flex;gap:6px;"><input type="text" id="km-comment-input" class="km-input" placeholder="Add a comment…" required /><button type="submit" class="km-btn km-btn--primary km-btn--sm">Post</button></form>' +
      '</div>';

    backdrop.hidden = false;
    drawer.hidden = false;
  }

  function closeInspector() {
    var d = document.getElementById('km-inspector-drawer');
    var b = document.getElementById('km-inspector-backdrop');
    if (d) d.hidden = true;
    if (b) b.hidden = true;
  }

  /* ========================================================================
     PERSISTENT AI KNOWLEDGE ASSISTANT DRAWER
     ======================================================================== */
  function openAssistant() {
    ensurePortals();
    var d = document.getElementById('km-assistant-drawer');
    var b = document.getElementById('km-assistant-backdrop');
    var log = document.getElementById('km-assistant-log');
    if (log && !log.children.length) {
      appendAssistantMsg('ai', 'Hello! I am the <strong>QuantalFlow AI Knowledge Assistant</strong>. I understand all projects, decisions, SOPs, meetings, whiteboards, mind maps, and experts in your Organisational Brain. Choose a command above or ask any question.');
    }
    if (b) b.hidden = false;
    if (d) d.hidden = false;
    var inp = document.getElementById('km-assistant-input');
    if (inp) inp.focus();
  }

  function closeAssistant() {
    var d = document.getElementById('km-assistant-drawer');
    var b = document.getElementById('km-assistant-backdrop');
    if (d) d.hidden = true;
    if (b) b.hidden = true;
  }

  function appendAssistantMsg(role, html, actionBtn) {
    var log = document.getElementById('km-assistant-log');
    if (!log) return;
    var div = document.createElement('div');
    div.className = 'km-msg ' + (role === 'user' ? 'km-msg--user' : 'km-msg--ai');
    div.innerHTML = html + (actionBtn ? '<div class="km-msg__actions">' + actionBtn + '</div>' : '');
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function runAssistantCommand(prompt) {
    var q = String(prompt || '').trim();
    if (!q) return;
    appendAssistantMsg('user', esc(q));

    var lower = q.toLowerCase();
    var reply = '';
    var actionBtn = '';

    if (lower.indexOf('generate sop') !== -1) {
      reply = '<strong>AI SOP Draft — Payment Callback Recovery &amp; Escalation</strong><br>1. Verify Airtel Money transaction reference in QuantalFlow Ledger.<br>2. Check HMAC signature &amp; idempotency status.<br>3. Trigger status inquiry if pending &gt; 90 seconds.<br>4. Escalate unresolved disputes to FinTech Engineering within 15 minutes.';
      actionBtn = '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-ai-save="sop">Save SOP to Knowledge Hub</button>';
    } else if (lower.indexOf('missing doc') !== -1 || lower.indexOf('gap') !== -1) {
      reply = '<strong>Identified Knowledge Gaps (' + state.gaps.length + '):</strong><br>' + state.gaps.map(function (g) { return '&bull; <strong>' + esc(g.title) + '</strong> (' + esc(g.dept) + ' — ' + esc(g.severity) + ')'; }).join('<br>');
    } else if (lower.indexOf('expert') !== -1) {
      reply = '<strong>Top Organisational Experts:</strong><br>' + state.experts.slice(0, 4).map(function (e) { return '&bull; <strong>' + esc(e.name) + '</strong> — ' + esc(e.role) + ' (Score ' + e.score + ', ' + e.projects + ' projects, ' + e.documents + ' docs)'; }).join('<br>');
    } else if (lower.indexOf('training') !== -1 || lower.indexOf('course') !== -1) {
      reply = '<strong>AI Training Course Outline — Offline-First Clinical Rollouts:</strong><br>Module 1: QR Geofencing &amp; Supervisor Flow<br>Module 2: IndexedDB Offline Queue &amp; SOP-021 Recovery<br>Module 3: Convex Sync Architecture (DEC-2026-01)<br>Assessment: 3-question certification quiz.';
      actionBtn = '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-ai-save="course">Publish to Learning Centre</button>';
    } else if (lower.indexOf('wiki') !== -1) {
      reply = '<strong>AI Wiki Article Draft — Payment Resilience Architecture:</strong><br>Summarises [[Airtel Money Payment Integration]], [[Use Convex Instead of Firebase]], and [[Customer Support Escalation &amp; Payment Dispute Flow]] into a cross-linked Engineering playbook.';
      actionBtn = '<button type="button" class="km-btn km-btn--primary km-btn--sm" data-ai-save="wiki">Save to Enterprise Wiki</button>';
    } else if (lower.indexOf('connect') !== -1) {
      reply = '<strong>Suggested Knowledge Graph Connections:</strong><br>&bull; Link <em>Customer Support Root-Cause Analysis Q1 2026</em> &rarr; <strong>Supports</strong> &rarr; <em>SOP-029 Payment Dispute Reconciliation</em>.<br>&bull; Link <em>Nursing Clinical Attendance Whiteboard</em> &rarr; <strong>References</strong> &rarr; <em>Use Convex Instead of Firebase</em>.';
    } else if (lower.indexOf('project summary') !== -1 || lower.indexOf('summarise') !== -1 || lower.indexOf('summarize') !== -1) {
      reply = '<strong>Organisational Knowledge Brief:</strong><br>&bull; <strong>Nursing Student Attendance Project</strong>: Active across 14 wards; Convex backend approved (DEC-2026-01); SOP-021 &amp; Lessons Learned (LL-2026-01) published.<br>&bull; <strong>Airtel Money Payment Integration</strong>: 99.94% ledger reconciliation match; Idempotent Webhook Queue approved (DEC-2026-02).';
    } else {
      var res = runLocalSemanticSearch(q);
      reply = res.html;
    }

    appendAssistantMsg('ai', reply, actionBtn);
  }

  /* ========================================================================
     MODALS (Create Object, Decision, Meeting, Lesson, AI SOP, Link, Quiz, Doc Preview)
     ======================================================================== */
  function openModal(title, html) {
    ensurePortals();
    var backdrop = document.getElementById('km-modal-backdrop');
    var titleEl = document.getElementById('km-modal-title');
    var bodyEl = document.getElementById('km-modal-body');
    if (!backdrop || !titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    backdrop.hidden = false;
  }

  function closeModal() {
    var backdrop = document.getElementById('km-modal-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function openNewObjectModal(presetType) {
    var types = window.QFKnowledgeSeed.OBJECT_TYPES;
    var selectedType = (typeof presetType === 'string' && types.indexOf(presetType) !== -1) ? presetType : types[0];
    openModal('New ' + selectedType,
      '<form id="km-form-new-object" class="km-stack">' +
        '<div class="km-form-group"><label for="ko-title">Title</label><input id="ko-title" class="km-input" required placeholder="e.g. Q2 Payment Gateway Architecture Review" /></div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="ko-type">Knowledge Type</label><select id="ko-type" class="km-select">' + types.map(function (t) { return '<option value="' + esc(t) + '"' + (t === selectedType ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
          '<div class="km-form-group"><label for="ko-perm">Permission Level</label><select id="ko-perm" class="km-select"><option>Public</option><option>Department</option><option>Project</option><option>Private</option><option>Executive</option><option>Confidential</option></select></div>' +
        '</div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="ko-dept">Department</label><input id="ko-dept" class="km-input" value="Product Engineering" required /></div>' +
          '<div class="km-form-group"><label for="ko-project">Linked Project</label><input id="ko-project" class="km-input" value="Nursing Student Attendance Project" /></div>' +
        '</div>' +
        '<div class="km-form-group"><label for="ko-tags">Tags (comma separated)</label><input id="ko-tags" class="km-input" placeholder="attendance, architecture, sop" /></div>' +
        '<div class="km-form-group"><label for="ko-summary">Summary &amp; Knowledge Content</label><textarea id="ko-summary" class="km-textarea" required placeholder="Capture key insights, context, or documentation…"></textarea></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Save to Knowledge Hub</button></div>' +
      '</form>'
    );
  }

  function openNewDecisionModal() {
    openModal('Record Architectural / Business Decision',
      '<form id="km-form-new-decision" class="km-stack">' +
        '<div class="km-form-group"><label for="dec-title">Decision Title</label><input id="dec-title" class="km-input" required placeholder="e.g. Adopt Biometric Fallback for Rural Clinics" /></div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="dec-project">Project</label><input id="dec-project" class="km-input" value="Nursing Student Attendance Project" required /></div>' +
          '<div class="km-form-group"><label for="dec-approver">Approver</label><input id="dec-approver" class="km-input" value="Richard Mumba" required /></div>' +
        '</div>' +
        '<div class="km-form-group"><label for="dec-reason">Reason</label><textarea id="dec-reason" class="km-textarea" required placeholder="Why this option was selected…"></textarea></div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="dec-alts">Alternatives Considered (comma separated)</label><input id="dec-alts" class="km-input" placeholder="Option A, Option B" /></div>' +
          '<div class="km-form-group"><label for="dec-risks">Risks</label><input id="dec-risks" class="km-input" placeholder="Key risks & mitigations" /></div>' +
        '</div>' +
        '<div class="km-form-group"><label for="dec-outcomes">Expected Outcomes</label><input id="dec-outcomes" class="km-input" placeholder="Measurable impact…" /></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Archive Decision</button></div>' +
      '</form>'
    );
  }

  function openNewMeetingModal() {
    openModal('Capture Meeting Knowledge',
      '<form id="km-form-new-meeting" class="km-stack">' +
        '<div class="km-form-group"><label for="mtg-title">Meeting Title</label><input id="mtg-title" class="km-input" required placeholder="e.g. Sprint 14 Payment Reconciliation Sync" /></div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="mtg-project">Linked Project</label><input id="mtg-project" class="km-input" value="Airtel Money Payment Integration" /></div>' +
          '<div class="km-form-group"><label for="mtg-parts">Participants (comma separated)</label><input id="mtg-parts" class="km-input" value="David Banda, Thandiwe Zulu" /></div>' +
        '</div>' +
        '<div class="km-form-group"><label for="mtg-summary">Summary</label><textarea id="mtg-summary" class="km-textarea" required placeholder="Key outcomes and takeaways…"></textarea></div>' +
        '<div class="km-form-group"><label for="mtg-dec">Decisions Made</label><input id="mtg-dec" class="km-input" placeholder="Decision 1" /></div>' +
        '<div class="km-form-group"><label for="mtg-act">Action Item</label><input id="mtg-act" class="km-input" placeholder="Next step to track" /></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Save Meeting Knowledge</button></div>' +
      '</form>'
    );
  }

  function openNewLessonModal() {
    openModal('Capture Project Lessons Learned',
      '<form id="km-form-new-lesson" class="km-stack">' +
        '<div class="km-form-group"><label for="ll-project">Project Name</label><input id="ll-project" class="km-input" required value="Nursing Student Attendance Project" /></div>' +
        '<div class="km-form-group"><label for="ll-worked">What Worked</label><textarea id="ll-worked" class="km-textarea" required></textarea></div>' +
        '<div class="km-form-group"><label for="ll-failed">What Failed / Challenges</label><textarea id="ll-failed" class="km-textarea" required></textarea></div>' +
        '<div class="km-form-group"><label for="ll-rec">Recommendations &amp; Best Practices</label><textarea id="ll-rec" class="km-textarea" required></textarea></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Save Lesson Learned</button></div>' +
      '</form>'
    );
  }

  function openAiSopModal() {
    openModal('AI Workflow → SOP Generator',
      '<form id="km-form-ai-sop" class="km-stack">' +
        '<div class="km-form-group"><label for="sop-proc">Describe the Process or Workflow</label><textarea id="sop-proc" class="km-textarea" required placeholder="e.g. Monthly MTN MoMo fallback settlement & finance sign-off when Airtel Money gateway has scheduled maintenance…"></textarea></div>' +
        '<div class="km-form-row">' +
          '<div class="km-form-group"><label for="sop-dept">Owning Department</label><input id="sop-dept" class="km-input" value="Payments & FinTech" required /></div>' +
          '<div class="km-form-group"><label for="sop-owner">Owner</label><input id="sop-owner" class="km-input" value="David Banda" required /></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Generate Structured SOP</button></div>' +
      '</form>'
    );
  }

  function openLinkModal() {
    var opts = state.objects.slice(0, 20).map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.title) + ' (' + esc(o.type) + ')</option>'; }).join('');
    var relOpts = window.QFKnowledgeSeed.RELATIONSHIP_TYPES.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');
    openModal('Link Knowledge Graph Nodes',
      '<form id="km-form-add-link" class="km-stack">' +
        '<div class="km-form-group"><label for="lnk-src">Source Object</label><select id="lnk-src" class="km-select">' + opts + '</select></div>' +
        '<div class="km-form-group"><label for="lnk-type">Relationship Type</label><select id="lnk-type" class="km-select">' + relOpts + '</select></div>' +
        '<div class="km-form-group"><label for="lnk-tgt">Target Object</label><select id="lnk-tgt" class="km-select">' + opts + '</select></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Add Graph Edge</button></div>' +
      '</form>'
    );
  }

  function openQuizModal(courseId) {
    var course = state.courses.find(function (c) { return c.id === courseId; });
    if (!course) return;
    openModal('Assessment: ' + course.title,
      '<form id="km-form-quiz" data-course-id="' + esc(course.id) + '" class="km-stack">' +
        '<p class="km-card__sub">Pass this assessment to earn <strong>' + esc(course.certification) + '</strong>.</p>' +
        (course.quiz || []).map(function (q, idx) {
          return '<div class="km-detail-box"><div class="km-detail-box__label">Question ' + (idx + 1) + '</div><div style="font-weight:600;margin-bottom:8px;">' + esc(q.q) + '</div>' +
            q.options.map(function (opt, oIdx) {
              return '<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:13px;cursor:pointer;"><input type="radio" name="q_' + idx + '" value="' + oIdx + '" required /><span>' + esc(opt) + '</span></label>';
            }).join('') +
          '</div>';
        }).join('') +
        '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Submit Assessment</button></div>' +
      '</form>'
    );
  }

  function openDocPreviewModal(docId) {
    var d = state.documents.find(function (x) { return x.id === docId; });
    if (!d) return;
    openModal(d.name,
      '<div style="display:flex;gap:8px;flex-wrap:wrap;"><span class="km-doc-badge">' + esc(d.format) + '</span><span class="km-pill km-pill--green">' + esc(d.status) + '</span><span class="km-pill km-pill--blue">' + esc(d.version) + '</span><span class="km-pill">' + esc(d.permission) + '</span></div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Document Preview</div><div class="km-detail-box__val">' + esc(d.summary) + '<br><br><em>Project: ' + esc(d.project) + ' &bull; Size: ' + esc(d.size) + ' &bull; Author: ' + esc(d.author) + '</em></div></div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Version History &amp; Change Tracking</div><ul class="km-bullet-list">' + (d.changes || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="km-detail-box"><div class="km-detail-box__label">Review Comments</div><div class="km-detail-box__val">' + ((d.comments || []).join('<br>') || 'No comments yet.') + '</div></div>'
    );
  }

  /* ========================================================================
     TAB SWITCHING & EVENT BINDING
     ======================================================================== */
  function switchTab(tabKey, subKey) {
    currentTab = tabKey;
    document.querySelectorAll('[data-km-tab]').forEach(function (btn) {
      var active = btn.getAttribute('data-km-tab') === tabKey;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });
    document.querySelectorAll('[data-km-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-km-panel') !== tabKey;
    });
    if (subKey) {
      var subBtn = document.querySelector('[data-graph-view="' + subKey + '"], [data-dec-view="' + subKey + '"], [data-doc-view="' + subKey + '"], [data-learn-view="' + subKey + '"], [data-gov-view="' + subKey + '"]');
      if (subBtn) subBtn.click();
    }
  }

  function closeAllPopovers() {
    document.querySelectorAll('.km-dd__menu, #km-new-type-menu, .km-card-menu').forEach(function (m) {
      m.hidden = true;
    });
    document.querySelectorAll('.km-dd__btn, #km-btn-new-type-trigger, .km-card-more-btn').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  function bindEvents() {
    if (window.__kmDocEventsBound) return;
    window.__kmDocEventsBound = true;

    // Focus-in handler for AI search suggestions dropdown
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.id === 'km-ai-search-input') {
        var dd = document.getElementById('km-search-dropdown');
        if (dd) {
          dd.hidden = false;
          e.target.setAttribute('aria-expanded', 'true');
        }
      }
    });

    // Keyboard navigation: Ctrl+K, Escape, Tab roving, Card Enter/Space
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        var inp = document.getElementById('km-ai-search-input');
        if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
        return;
      }
      if (e.key === 'Escape') {
        closeAllPopovers();
        var sdd = document.getElementById('km-search-dropdown');
        if (sdd) sdd.hidden = true;
        closeModal();
        closeInspector();
        closeAssistant();
        return;
      }

      // Roving tabindex on primary tabs
      var tablist = document.getElementById('km-tablist');
      if (tablist && tablist.contains(document.activeElement)) {
        var tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        var idx = tabs.indexOf(document.activeElement);
        if (idx !== -1) {
          if (e.key === 'ArrowRight') { e.preventDefault(); var next = tabs[(idx + 1) % tabs.length]; next.focus(); next.click(); return; }
          if (e.key === 'ArrowLeft') { e.preventDefault(); var prev = tabs[(idx - 1 + tabs.length) % tabs.length]; prev.focus(); prev.click(); return; }
          if (e.key === 'Home') { e.preventDefault(); tabs[0].focus(); tabs[0].click(); return; }
          if (e.key === 'End') { e.preventDefault(); tabs[tabs.length - 1].focus(); tabs[tabs.length - 1].click(); return; }
        }
      }

      // Keyboard Enter / Space on focused Knowledge Object card or row
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement) {
        var activeCard = document.activeElement.closest('.km-obj-card[data-open-object], .km-obj-row[data-open-object]');
        if (activeCard && document.activeElement === activeCard) {
          e.preventDefault();
          openObjectInspector(activeCard.getAttribute('data-open-object'));
        }
      }
    });

    // Delegated live search & select filters
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'km-filter-q') {
        renderObjects();
      }
    });

    // Delegated clicks across the whole Knowledge Hub (works on direct load & SPA navigation)
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      // Close search dropdown when clicking outside search wrap
      if (!t.closest('.km-search-wrap')) {
        var sdd = document.getElementById('km-search-dropdown');
        var sinp = document.getElementById('km-ai-search-input');
        if (sdd) sdd.hidden = true;
        if (sinp) sinp.setAttribute('aria-expanded', 'false');
      }

      // Close custom popovers when clicking outside
      if (!t.closest('.km-dd, .km-new-menu-wrap, .km-card-menu-wrap')) {
        closeAllPopovers();
      }

      // Top / Hero primary buttons
      if (t.closest('#km-btn-new-object, #km-btn-new-object-2')) {
        openNewObjectModal();
        return;
      }

      if (t.closest('#km-open-assistant, #km-btn-hero-assistant')) {
        openAssistant();
        return;
      }

      if (t.closest('#km-assistant-close') || t.id === 'km-assistant-backdrop') {
        closeAssistant();
        return;
      }

      if (t.closest('#km-inspector-close') || t.id === 'km-inspector-backdrop') {
        closeInspector();
        return;
      }

      if (t.closest('#km-modal-close, [data-close-modal]') || t.id === 'km-modal-backdrop') {
        closeModal();
        return;
      }

      if (t.closest('#km-ai-results-close')) {
        var aiRes = document.getElementById('km-ai-results');
        if (aiRes) aiRes.hidden = true;
        return;
      }

      if (t.closest('#km-btn-sync-ecosystem')) {
        setSyncLabel('Syncing QuantalFlow Ecosystem…');
        fetch('/api/knowledge', { credentials: 'same-origin', cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            var added = data && data.ecosystem ? mergeEcosystemIntoState(data.ecosystem) : 0;
            setSyncLabel('Organisational Brain Synced');
            renderAll();
            showToast(added > 0 ? ('Synced ' + added + ' new QuantalFlow assets into Knowledge Hub.') : 'Organisational Brain is up to date with all boards, projects, files & notes.');
          })
          .catch(function () { showToast('Ecosystem sync completed locally.'); });
        return;
      }

      if (t.closest('#km-btn-new-decision')) { openNewDecisionModal(); return; }
      if (t.closest('#km-btn-new-meeting')) { openNewMeetingModal(); return; }
      if (t.closest('#km-btn-new-lesson')) { openNewLessonModal(); return; }
      if (t.closest('#km-btn-ai-sop')) { openAiSopModal(); return; }
      if (t.closest('#km-btn-add-link')) { openLinkModal(); return; }

      if (t.closest('#km-btn-new-wiki')) {
        openModal('New Enterprise Wiki Article',
          '<form id="km-form-new-wiki" class="km-stack">' +
            '<div class="km-form-group"><label for="wk-title">Article Title</label><input id="wk-title" class="km-input" required /></div>' +
            '<div class="km-form-group"><label for="wk-sec">Section</label><select id="wk-sec" class="km-select"><option>Company</option><option>Departments</option><option>Products</option><option>Clients</option><option>Projects</option><option>Policies</option><option>Training</option><option>Operations</option></select></div>' +
            '<div class="km-form-group"><label for="wk-body">Content (use [[Page Title]] to cross-link)</label><textarea id="wk-body" class="km-textarea" required></textarea></div>' +
            '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Publish Wiki Page</button></div>' +
          '</form>'
        );
        return;
      }

      if (t.closest('#km-btn-ai-course')) {
        var newCourse = {
          id: 'CRS-' + (state.courses.length + 1),
          title: 'AI-Generated: Customer Support Escalation & SLA Certification',
          category: 'AI Training Course',
          duration: '20 mins',
          modules: 3,
          enrolled: 1,
          completion: 0,
          certification: 'Certified Support Triage Specialist',
          sourceKnowledge: 'KO-RES-01 + KO-WFL-01 + SOP-029',
          quiz: [{ q: 'What is the maximum escalation window for Airtel Money pending disputes?', options: ['15 minutes', '24 hours', '3 days'], answer: 0 }]
        };
        state.courses.unshift(newCourse);
        persistState();
        renderAll();
        switchTab('learning', 'courses');
        showToast('AI generated a new training course from your Support & SOP knowledge.');
        return;
      }

      // "+ New" type-picker dropdown trigger & menu items
      var newTypeTrig = t.closest('#km-btn-new-type-trigger');
      if (newTypeTrig) {
        var newMenu = document.getElementById('km-new-type-menu');
        if (newMenu) {
          var willOpen = newMenu.hidden;
          closeAllPopovers();
          newMenu.hidden = !willOpen;
          newTypeTrig.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        }
        return;
      }

      var newTypePick = t.closest('[data-km-new-type]');
      if (newTypePick) {
        var chosenType = newTypePick.getAttribute('data-km-new-type');
        closeAllPopovers();
        openNewObjectModal(chosenType);
        return;
      }

      // Custom filter & sort popover triggers
      var ddBtn = t.closest('.km-dd__btn');
      if (ddBtn) {
        var ddWrap = ddBtn.closest('.km-dd');
        var ddMenu = ddWrap ? ddWrap.querySelector('.km-dd__menu') : null;
        if (ddMenu) {
          var openNext = ddMenu.hidden;
          closeAllPopovers();
          ddMenu.hidden = !openNext;
          ddBtn.setAttribute('aria-expanded', openNext ? 'true' : 'false');
        }
        return;
      }

      var ddPick = t.closest('[data-km-dd-pick]');
      if (ddPick) {
        var fKey = ddPick.getAttribute('data-km-dd-pick');
        var fVal = ddPick.getAttribute('data-km-dd-val');
        objFilter[fKey] = fVal;
        closeAllPopovers();
        renderObjects();
        return;
      }

      // Needs cleanup filter toggle
      if (t.closest('#km-btn-cleanup-filter')) {
        objFilter.cleanupOnly = !objFilter.cleanupOnly;
        renderObjects();
        return;
      }

      // Clear all filters
      if (t.closest('#km-btn-clear-filters')) {
        objFilter.q = '';
        objFilter.type = 'all';
        objFilter.dept = 'all';
        objFilter.project = 'all';
        objFilter.perm = 'all';
        objFilter.cleanupOnly = false;
        var qEl = document.getElementById('km-filter-q');
        if (qEl) qEl.value = '';
        renderObjects();
        return;
      }

      // Grid / List view toggle
      var viewBtn = t.closest('[data-km-view-mode]');
      if (viewBtn) {
        objFilter.view = viewBtn.getAttribute('data-km-view-mode') || 'grid';
        document.querySelectorAll('[data-km-view-mode]').forEach(function (b) {
          var isAct = b.getAttribute('data-km-view-mode') === objFilter.view;
          b.classList.toggle('is-active', isAct);
          b.setAttribute('aria-pressed', isAct ? 'true' : 'false');
        });
        renderObjects();
        return;
      }

      // Card three-dots overflow menu trigger
      var cardMoreBtn = t.closest('[data-km-card-menu-btn]');
      if (cardMoreBtn) {
        e.stopPropagation();
        var cid = cardMoreBtn.getAttribute('data-km-card-menu-btn');
        var cMenu = document.getElementById('km-card-menu-' + cid);
        if (cMenu) {
          var willShow = cMenu.hidden;
          closeAllPopovers();
          cMenu.hidden = !willShow;
          cardMoreBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
        }
        return;
      }

      // Card overflow menu action (Open, Copy link, Pin, Delete)
      var cardActBtn = t.closest('[data-km-card-act]');
      if (cardActBtn) {
        e.stopPropagation();
        var actName = cardActBtn.getAttribute('data-km-card-act');
        var targetId = cardActBtn.getAttribute('data-obj-id');
        closeAllPopovers();
        var targetObj = state.objects.find(function (o) { return o.id === targetId; });
        if (!targetObj) return;

        if (actName === 'open') {
          openObjectInspector(targetId);
        } else if (actName === 'copy') {
          var url = window.location.origin + '/dashboard/knowledge/#ko=' + encodeURIComponent(targetId);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).catch(function () {});
          }
          showToast('Link copied to clipboard.');
        } else if (actName === 'pin') {
          targetObj.pinned = !targetObj.pinned;
          persistState();
          renderObjects();
          showToast(targetObj.pinned ? 'Pinned to top.' : 'Unpinned.');
        } else if (actName === 'delete') {
          if (!canDeleteObject(targetObj)) {
            showToast('Permission required to delete ' + targetObj.permission + ' items.');
            return;
          }
          state.objects = state.objects.filter(function (o) { return o.id !== targetId; });
          persistState();
          renderAll();
          showToast('Deleted "' + cleanTitle(targetObj.title) + '".');
        }
        return;
      }

      // Prompt suggestions inside search dropdown
      var chip = t.closest('[data-km-prompt]');
      if (chip) {
        var dd = document.getElementById('km-search-dropdown');
        if (dd) dd.hidden = true;
        executeAiSearch(chip.getAttribute('data-km-prompt'));
        return;
      }

      // Topic search
      var topicBtn = t.closest('[data-topic-search]');
      if (topicBtn) { executeAiSearch(topicBtn.getAttribute('data-topic-search')); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

      // Primary tabs
      var tabBtn = t.closest('[data-km-tab]');
      if (tabBtn) { switchTab(tabBtn.getAttribute('data-km-tab')); return; }

      var jumpBtn = t.closest('[data-jump-tab]');
      if (jumpBtn) { switchTab(jumpBtn.getAttribute('data-jump-tab')); return; }

      // KPI quick filter
      var kpiBtn = t.closest('[data-kpi-filter]');
      if (kpiBtn) {
        var f = kpiBtn.getAttribute('data-kpi-filter');
        switchTab('objects');
        objFilter.type = f || 'all';
        renderObjects();
        return;
      }

      // Sub-view switchers
      [
        { attr: 'data-graph-view', map: { network: 'km-view-network', brain: 'km-view-brain', timeline: 'km-view-timeline' } },
        { attr: 'data-dec-view', map: { decisions: 'km-view-decisions', meetings: 'km-view-meetings', lessons: 'km-view-lessons' } },
        { attr: 'data-doc-view', map: { sops: 'km-view-sops', wiki: 'km-view-wiki', documents: 'km-view-documents' } },
        { attr: 'data-learn-view', map: { experts: 'km-view-experts', courses: 'km-view-courses', templates: 'km-view-templates' } },
        { attr: 'data-gov-view', map: { health: 'km-view-health', permissions: 'km-view-permissions', automation: 'km-view-automation', analytics: 'km-view-analytics' } }
      ].forEach(function (group) {
        var btn = t.closest('[' + group.attr + ']');
        if (!btn) return;
        var val = btn.getAttribute(group.attr);
        btn.parentElement.querySelectorAll('.km-seg__btn').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        Object.keys(group.map).forEach(function (k) {
          var el = document.getElementById(group.map[k]);
          if (el) el.hidden = k !== val;
        });
      });

      // Open object inspector
      var objBtn = t.closest('[data-open-object]');
      if (objBtn) { openObjectInspector(objBtn.getAttribute('data-open-object')); return; }

      // Search hit click
      var hit = t.closest('[data-search-hit-kind]');
      if (hit) {
        var kind = hit.getAttribute('data-search-hit-kind');
        if (kind === 'object') openObjectInspector(hit.getAttribute('data-search-hit-id'));
        else switchTab(hit.getAttribute('data-search-hit-tab'), hit.getAttribute('data-search-hit-sub'));
        return;
      }

      // Graph node select
      var gNode = t.closest('[data-graph-node]');
      if (gNode) {
        selectedGraphNodeId = gNode.getAttribute('data-graph-node');
        renderGraph();
        return;
      }

      // Brain leaf click
      var bLeaf = t.closest('[data-brain-action]');
      if (bLeaf) {
        var act = bLeaf.getAttribute('data-brain-action');
        if (act === 'object') openObjectInspector(bLeaf.getAttribute('data-brain-id'));
        else if (act === 'search') executeAiSearch(bLeaf.getAttribute('data-brain-query'));
        else switchTab(bLeaf.getAttribute('data-brain-tab'), bLeaf.getAttribute('data-brain-sub'));
        return;
      }

      // Wiki open / edit / cross-link
      var wkOpen = t.closest('[data-wiki-open]');
      if (wkOpen) { activeWikiId = wkOpen.getAttribute('data-wiki-open'); renderSopsWikiDocs(); return; }

      var wkRef = t.closest('[data-wikilink]');
      if (wkRef) {
        var refTitle = wkRef.getAttribute('data-wikilink');
        var foundObj = state.objects.find(function (o) { return o.title.toLowerCase() === refTitle.toLowerCase(); });
        if (foundObj) openObjectInspector(foundObj.id);
        else executeAiSearch(refTitle);
        return;
      }

      var wkEdit = t.closest('[data-wiki-edit]');
      if (wkEdit) {
        var wp = state.wiki.find(function (w) { return w.id === wkEdit.getAttribute('data-wiki-edit'); });
        if (wp) {
          openModal('Edit Wiki Article',
            '<form id="km-form-edit-wiki" data-wiki-id="' + esc(wp.id) + '" class="km-stack">' +
              '<div class="km-form-group"><label for="ewk-title">Title</label><input id="ewk-title" class="km-input" value="' + esc(wp.title) + '" required /></div>' +
              '<div class="km-form-group"><label for="ewk-body">Content</label><textarea id="ewk-body" class="km-textarea" style="min-height:150px;" required>' + esc(wp.body) + '</textarea></div>' +
              '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="km-btn km-btn--secondary" data-close-modal>Cancel</button><button type="submit" class="km-btn km-btn--primary">Save Changes</button></div>' +
            '</form>'
          );
        }
        return;
      }

      // SOP Approve & Bump Version
      var appSop = t.closest('[data-approve-sop]');
      if (appSop) {
        var s1 = state.sops.find(function (s) { return s.id === appSop.getAttribute('data-approve-sop'); });
        if (s1) { s1.status = 'Approved'; persistState(); renderAll(); showToast(s1.id + ' approved.'); }
        return;
      }
      var bumpSop = t.closest('[data-bump-sop]');
      if (bumpSop) {
        var s2 = state.sops.find(function (s) { return s.id === bumpSop.getAttribute('data-bump-sop'); });
        if (s2) {
          var parts = String(s2.version || 'v1.0').replace(/^v/, '').split('.');
          s2.version = 'v' + parts[0] + '.' + ((parseInt(parts[1], 10) || 0) + 1);
          persistState(); renderAll(); showToast('Published ' + s2.id + ' ' + s2.version);
        }
        return;
      }

      // Document Preview
      var prevDoc = t.closest('[data-preview-doc]');
      if (prevDoc) { openDocPreviewModal(prevDoc.getAttribute('data-preview-doc')); return; }

      // Quiz
      var quizBtn = t.closest('[data-start-quiz]');
      if (quizBtn) { openQuizModal(quizBtn.getAttribute('data-start-quiz')); return; }

      // Clone template
      var cloneBtn = t.closest('[data-clone-template]');
      if (cloneBtn) {
        var tpl = state.templates.find(function (x) { return x.id === cloneBtn.getAttribute('data-clone-template'); });
        if (tpl) {
          tpl.uses += 1;
          state.objects.unshift({
            id: 'KO-CLN-' + Date.now().toString().slice(-4),
            type: tpl.category === 'SOP' ? 'SOP' : tpl.category === 'Policy' ? 'Policy' : 'Document',
            title: tpl.title + ' (Cloned Copy)',
            summary: tpl.desc,
            content: 'Cloned from QuantalFlow Template Library (' + tpl.id + '). Ready for team customisation.',
            department: 'Product Engineering',
            project: 'QuantalFlow Core',
            author: (window.__qfUser && window.__qfUser.name) || 'Workspace Owner',
            updatedAt: todayIso(),
            createdAt: todayIso(),
            permission: 'Department',
            status: 'Draft',
            views: 1,
            source: 'Template Library',
            tags: ['cloned', tpl.category.toLowerCase()],
            versions: [{ v: 'v1.0', date: todayIso(), by: 'Template Clone', note: 'Cloned from ' + tpl.id }],
            comments: []
          });
          persistState(); renderAll(); showToast('Cloned "' + tpl.title + '" into Knowledge Base.');
        }
        return;
      }

      // Resolve Knowledge Gap
      var gapBtn = t.closest('[data-resolve-gap]');
      if (gapBtn) {
        var gid = gapBtn.getAttribute('data-resolve-gap');
        var gap = state.gaps.find(function (g) { return g.id === gid; });
        if (gap) {
          state.gaps = state.gaps.filter(function (g) { return g.id !== gid; });
          if (/SOP/i.test(gap.title)) {
            state.sops.unshift({
              id: 'SOP-0' + (30 + state.sops.length),
              title: gap.title.replace(/^Missing SOP:\s*/i, ''),
              department: gap.dept,
              version: 'v1.0',
              status: 'In Review',
              owner: (window.__qfUser && window.__qfUser.name) || 'AI Assistant',
              nextReview: '2026-09-20',
              steps: ['Detect primary payment rail outage via health monitor.', 'Activate fallback settlement channel & notify Finance.', 'Run automated ledger reconciliation upon recovery.']
            });
          }
          persistState(); renderAll(); showToast('Resolved gap: ' + gap.title);
        }
        return;
      }

      // Automation Toggle & Test Run
      var autoTog = t.closest('[data-toggle-auto]');
      if (autoTog) {
        var au = state.automations.find(function (a) { return a.id === autoTog.getAttribute('data-toggle-auto'); });
        if (au) { au.enabled = !au.enabled; persistState(); renderGovernance(); showToast(au.name + (au.enabled ? ' enabled.' : ' paused.')); }
        return;
      }
      var autoRun = t.closest('[data-run-auto]');
      if (autoRun) {
        var ar = state.automations.find(function (a) { return a.id === autoRun.getAttribute('data-run-auto'); });
        if (ar) { ar.runs += 1; ar.lastRun = todayPretty(); persistState(); renderGovernance(); showToast('Executed automation: ' + ar.name); }
        return;
      }

      // AI Assistant Commands & Save actions
      var cmdChip = t.closest('[data-ai-cmd]');
      if (cmdChip) { runAssistantCommand(cmdChip.getAttribute('data-ai-cmd')); return; }

      var aiSave = t.closest('[data-ai-save]');
      if (aiSave) {
        var stype = aiSave.getAttribute('data-ai-save');
        if (stype === 'sop') {
          state.sops.unshift({ id: 'SOP-0' + (31 + state.sops.length), title: 'Payment Callback Recovery & Escalation', department: 'Payments & FinTech', version: 'v1.0', status: 'In Review', owner: 'AI Knowledge Assistant', nextReview: '2026-09-20', steps: ['Verify Airtel Money transaction reference.', 'Check HMAC signature & idempotency status.', 'Trigger status inquiry if pending > 90s.', 'Escalate to FinTech Engineering within 15 mins.'] });
        } else if (stype === 'course') {
          state.courses.unshift({ id: 'CRS-' + (state.courses.length + 1), title: 'Offline-First Clinical Rollouts', category: 'AI Training Course', duration: '20 mins', modules: 3, enrolled: 1, completion: 0, certification: 'Clinical Rollout Specialist', sourceKnowledge: 'SOP-021 + DEC-2026-01', quiz: [{ q: 'Which storage queues offline clinical attendance?', options: ['IndexedDB', 'Cookies'], answer: 0 }] });
        } else if (stype === 'wiki') {
          state.wiki.unshift({ id: 'WIKI-' + (state.wiki.length + 1), section: 'Operations', title: 'Payment Resilience Architecture', updatedAt: todayIso(), author: 'AI Knowledge Assistant', body: 'Synthesises [[Airtel Money Payment Integration]], [[Use Convex Instead of Firebase]], and [[Customer Support Escalation & Payment Dispute Flow]].' });
        }
        persistState(); renderAll(); showToast('Saved AI-generated asset to Knowledge Hub.');
        return;
      }

      if (t.closest('[data-close-modal]')) { closeModal(); return; }
    });

    // Delegated change events (graph/timeline/doc selects & meeting action item checkboxes)
    document.addEventListener('change', function (e) {
      var target = e.target;
      if (!target) return;
      if (target.id === 'km-rel-filter') { renderGraph(); return; }
      if (target.id === 'km-timeline-project') { renderTimeline(); return; }
      if (target.id === 'km-doc-format-filter') { renderSopsWikiDocs(); return; }

      var cb = target.closest ? target.closest('[data-toggle-action]') : null;
      if (!cb) return;
      var parts = cb.getAttribute('data-toggle-action').split(':');
      var m = state.meetings[Number(parts[0])];
      if (m && m.actionItems[Number(parts[1])]) {
        m.actionItems[Number(parts[1])].done = cb.checked;
        persistState();
        renderDecisionsAndMeetings();
      }
    });

    // Delegated form submissions (AI search, AI assistant, modals & comments)
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.id) return;

      if (form.id === 'km-ai-search-form') {
        e.preventDefault();
        var sdd = document.getElementById('km-search-dropdown');
        var sinp = document.getElementById('km-ai-search-input');
        if (sdd) sdd.hidden = true;
        if (sinp) sinp.setAttribute('aria-expanded', 'false');
        executeAiSearch((sinp || {}).value);
        return;
      }

      if (form.id === 'km-assistant-form') {
        e.preventDefault();
        var ainp = document.getElementById('km-assistant-input');
        if (!ainp || !ainp.value.trim()) return;
        var val = ainp.value.trim();
        ainp.value = '';
        runAssistantCommand(val);
        return;
      }

      if (form.id === 'km-comment-form') {
        e.preventDefault();
        var obj = state.objects.find(function (o) { return o.id === form.getAttribute('data-obj-id'); });
        var inp = document.getElementById('km-comment-input');
        if (obj && inp && inp.value.trim()) {
          obj.comments = obj.comments || [];
          obj.comments.push({ author: (window.__qfUser && window.__qfUser.name) || 'Member', date: todayIso(), text: inp.value.trim() });
          persistState();
          openObjectInspector(obj.id);
        }
      } else if (form.id === 'km-form-new-object') {
        e.preventDefault();
        var newObj = {
          id: 'KO-' + Date.now().toString().slice(-5),
          type: document.getElementById('ko-type').value,
          title: document.getElementById('ko-title').value.trim(),
          summary: document.getElementById('ko-summary').value.trim(),
          content: document.getElementById('ko-summary').value.trim(),
          department: document.getElementById('ko-dept').value.trim(),
          project: document.getElementById('ko-project').value.trim() || 'QuantalFlow Core',
          author: (window.__qfUser && window.__qfUser.name) || 'Workspace Owner',
          updatedAt: todayIso(),
          createdAt: todayIso(),
          permission: document.getElementById('ko-perm').value,
          status: 'Active',
          views: 1,
          source: 'Knowledge Hub',
          tags: document.getElementById('ko-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          versions: [{ v: 'v1.0', date: todayIso(), by: 'Author', note: 'Initial capture' }],
          comments: []
        };
        state.objects.unshift(newObj);
        persistState(); renderAll(); closeModal(); showToast('Captured "' + newObj.title + '"');
      } else if (form.id === 'km-form-new-decision') {
        e.preventDefault();
        var dec = {
          id: 'DEC-' + Date.now().toString().slice(-4),
          title: document.getElementById('dec-title').value.trim(),
          project: document.getElementById('dec-project').value.trim(),
          description: document.getElementById('dec-reason').value.trim(),
          reason: document.getElementById('dec-reason').value.trim(),
          alternatives: document.getElementById('dec-alts').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          approver: document.getElementById('dec-approver').value.trim(),
          approvers: [document.getElementById('dec-approver').value.trim()],
          approvalDate: todayPretty(),
          status: 'Approved',
          risks: document.getElementById('dec-risks').value.trim() || 'Reviewed and accepted.',
          outcomes: document.getElementById('dec-outcomes').value.trim() || 'Tracked in Project Timeline.',
          evidence: 'Archived via Decision Repository',
          attachments: []
        };
        state.decisions.unshift(dec);
        persistState(); renderAll(); closeModal(); switchTab('decisions', 'decisions'); showToast('Decision archived into repository.');
      } else if (form.id === 'km-form-new-meeting') {
        e.preventDefault();
        state.meetings.unshift({
          id: 'MTG-' + Date.now().toString().slice(-4),
          title: document.getElementById('mtg-title').value.trim(),
          date: todayPretty(),
          project: document.getElementById('mtg-project').value.trim(),
          participants: document.getElementById('mtg-parts').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          summary: document.getElementById('mtg-summary').value.trim(),
          decisions: [document.getElementById('mtg-dec').value.trim()].filter(Boolean),
          actionItems: [{ text: document.getElementById('mtg-act').value.trim() || 'Follow up with team', owner: 'Team Lead', done: false }],
          risks: ['Tracked in Project RAID'],
          attachments: []
        });
        persistState(); renderAll(); closeModal(); switchTab('decisions', 'meetings'); showToast('Meeting knowledge stored permanently.');
      } else if (form.id === 'km-form-new-lesson') {
        e.preventDefault();
        state.lessons.unshift({
          id: 'LL-' + Date.now().toString().slice(-4),
          project: document.getElementById('ll-project').value.trim(),
          date: todayPretty(),
          author: (window.__qfUser && window.__qfUser.name) || 'Project Lead',
          whatWorked: document.getElementById('ll-worked').value.trim(),
          whatFailed: document.getElementById('ll-failed').value.trim(),
          challenges: document.getElementById('ll-failed').value.trim(),
          recommendations: document.getElementById('ll-rec').value.trim(),
          bestPractices: document.getElementById('ll-rec').value.trim(),
          successFactors: 'Cross-functional alignment & documentation.'
        });
        persistState(); renderAll(); closeModal(); switchTab('decisions', 'lessons'); showToast('Lesson Learned added to Organisational Intelligence.');
      } else if (form.id === 'km-form-ai-sop') {
        e.preventDefault();
        var proc = document.getElementById('sop-proc').value.trim();
        state.sops.unshift({
          id: 'SOP-0' + (32 + state.sops.length),
          title: proc.slice(0, 62),
          department: document.getElementById('sop-dept').value.trim(),
          version: 'v1.0',
          status: 'In Review',
          owner: document.getElementById('sop-owner').value.trim(),
          nextReview: '2026-09-22',
          steps: [
            'Validate trigger conditions and scope for: ' + proc.slice(0, 80) + '.',
            'Verify required QuantalFlow permissions and audit logging.',
            'Execute primary operational steps and capture verification telemetry.',
            'Notify department owner and archive run summary in Knowledge Hub.'
          ]
        });
        persistState(); renderAll(); closeModal(); switchTab('sops', 'sops'); showToast('AI converted workflow into a structured SOP draft.');
      } else if (form.id === 'km-form-add-link') {
        e.preventDefault();
        var src = document.getElementById('lnk-src').value;
        var tgt = document.getElementById('lnk-tgt').value;
        var rtype = document.getElementById('lnk-type').value;
        if (src !== tgt) {
          state.relationships.push({ id: 'REL-' + Date.now().toString().slice(-4), source: src, target: tgt, type: rtype });
          persistState(); renderGraph(); closeModal(); showToast('Added "' + rtype + '" relationship to Knowledge Graph.');
        }
      } else if (form.id === 'km-form-new-wiki') {
        e.preventDefault();
        var wid = 'WIKI-' + (state.wiki.length + 1);
        state.wiki.push({ id: wid, section: document.getElementById('wk-sec').value, title: document.getElementById('wk-title').value.trim(), updatedAt: todayIso(), author: (window.__qfUser && window.__qfUser.name) || 'Contributor', body: document.getElementById('wk-body').value.trim() });
        activeWikiId = wid;
        persistState(); renderSopsWikiDocs(); closeModal(); switchTab('sops', 'wiki'); showToast('Wiki article published.');
      } else if (form.id === 'km-form-edit-wiki') {
        e.preventDefault();
        var wp = state.wiki.find(function (w) { return w.id === form.getAttribute('data-wiki-id'); });
        if (wp) {
          wp.title = document.getElementById('ewk-title').value.trim();
          wp.body = document.getElementById('ewk-body').value.trim();
          wp.updatedAt = todayIso();
          persistState(); renderSopsWikiDocs(); closeModal(); showToast('Wiki article updated.');
        }
      } else if (form.id === 'km-form-quiz') {
        e.preventDefault();
        var crs = state.courses.find(function (c) { return c.id === form.getAttribute('data-course-id'); });
        if (crs) {
          var correct = 0;
          (crs.quiz || []).forEach(function (q, idx) {
            var checked = form.querySelector('input[name="q_' + idx + '"]:checked');
            if (checked && Number(checked.value) === q.answer) correct += 1;
          });
          var pct = Math.round((correct / Math.max(1, crs.quiz.length)) * 100);
          closeModal();
          if (pct >= 80) {
            crs.completion = Math.min(100, Math.max(crs.completion, 96));
            persistState(); renderExpertsLearningTemplates();
            showToast('Passed (' + pct + '%)! Awarded: ' + crs.certification);
          } else {
            showToast('Scored ' + pct + '% — review the source SOP and retry to earn certification.');
          }
        }
      }
    });
  }

  function initKnowledgeHub() {
    if (!document.getElementById('km-app')) return;
    bindEvents();
    loadInitialData();
  }

  window.initKnowledgeHub = initKnowledgeHub;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKnowledgeHub);
  } else {
    initKnowledgeHub();
  }
})();
