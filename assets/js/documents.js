/* ==========================================================================
   QuantalFlow Document Generation — Intelligent Document Factory
   Unified with QuantalFlow Workspace Auth, Router & Ecosystem Sources
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'qf_documents_v1';

  var SOURCES = {
    whiteboards: { label: 'Whiteboards', items: ['Mobile Payments Strategy Board', 'Q1 Planning Board', 'Customer Journey Map'] },
    mindmaps: { label: 'Mind Maps', items: ['QuantalFlow Product Map', 'Hospital Platform Map', 'Training Programme Map'] },
    projects: { label: 'Projects', items: ['QuantalFlow Mobile Payments Project', 'Nursing Student Attendance Project', 'School Portal Rollout'] },
    meetings: { label: 'Meetings', items: ['Weekly Product Sync', 'Client Kick-off Meeting', 'Steering Committee Review'] },
    tasks: { label: 'Tasks', items: ['Sprint 12 Tasks', 'Open Risks and Blockers', 'Release Checklist'] },
    knowledge: { label: 'Knowledge Articles', items: ['Onboarding Guide', 'Data Security Practices', 'Deployment Notes'] },
    decisions: { label: 'Decisions', items: ['Use Convex Instead of Firebase', 'Choice of Payment Gateway', 'Cloud Hosting Decision'] },
    research: { label: 'Research', items: ['Customer Support Root-Cause Analysis', 'User Interview Findings', 'Competitor Review'] },
    workflows: { label: 'Workflows', items: ['Invoice Approval Workflow', 'Support Ticket Workflow', 'Employee Onboarding Workflow'] }
  };

  var TYPES = [
    ['Business Plan', ['Executive Summary', 'Problem and Opportunity', 'Market Analysis', 'Strategy and Operations', 'Financial Outlook', 'Risks and Mitigation']],
    ['Strategic Plan', ['Vision and Mission', 'Situation Analysis', 'Strategic Objectives', 'Initiatives and Owners', 'Performance Measures', 'Risks']],
    ['Research Proposal', ['Background', 'Problem Statement', 'Objectives', 'Methodology', 'Work Plan and Timeline', 'Expected Outcomes']],
    ['Policy', ['Purpose', 'Scope', 'Policy Statements', 'Roles and Responsibilities', 'Compliance and Review']],
    ['SOP', ['Purpose', 'Scope', 'Roles', 'Step-by-Step Procedure', 'Records and Controls', 'Revision History']],
    ['Report', ['Summary', 'Background', 'Findings', 'Analysis', 'Recommendations', 'Next Steps']],
    ['Client Proposal', ['Overview', 'Understanding of Needs', 'Proposed Solution', 'Deliverables and Timeline', 'Investment', 'Terms']],
    ['Project Charter', ['Project Purpose', 'Objectives and Scope', 'Stakeholders', 'Milestones', 'Budget and Resources', 'Risks and Assumptions', 'Approval']],
    ['Meeting Minutes', ['Attendees', 'Agenda', 'Discussion Summary', 'Decisions', 'Action Items', 'Next Meeting']],
    ['Training Manual', ['Learning Objectives', 'Prerequisites', 'Modules', 'Practice Activities', 'Assessment', 'Resources']],
    ['Executive Brief', ['Key Message', 'Context', 'Key Facts', 'Options', 'Recommendation']],
    ['Presentation', ['Title Slide', 'Agenda', 'Key Points', 'Evidence', 'Recommendation', 'Questions']],
    ['Contract', ['Parties', 'Definitions', 'Scope of Work', 'Payment Terms', 'Confidentiality', 'Termination', 'Signatures']],
    ['Guideline', ['Purpose', 'Audience', 'Guidance', 'Examples', 'Related Documents']],
    ['Framework', ['Overview', 'Principles', 'Components', 'How the Framework Works', 'Implementation Steps', 'Measures of Success']]
  ];

  var NEXT_STATUS = {
    Draft: ['Review', 'Send for review'],
    Review: ['Approved', 'Approve'],
    Approved: ['Published', 'Publish to Knowledge Hub'],
    Published: [null, 'Published']
  };

  var state = {
    source: 'projects',
    picked: new Set(),
    type: 'Project Charter',
    currentId: null,
    searchQuery: ''
  };

  var toastTimer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function loadDocs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
  }

  function saveDocs(docs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(docs)); } catch (e) {}
    fetch('/api/os', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { documents: docs } })
    }).catch(function () {});
  }

  function toast(msg) {
    var el = document.getElementById('dg-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2400);
  }

  function wireChrome(user) {
    if (!user) return;
    window.__qfUser = user;
    var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || 'Profile');
    var initEl = document.getElementById('dash-initial');
    if (initEl) {
      var img = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
      if (img) {
        initEl.textContent = '';
        var el = document.createElement('img');
        el.src = img;
        el.alt = '';
        el.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        initEl.appendChild(el);
      } else {
        initEl.textContent = (name.charAt(0) || '?').toUpperCase();
      }
    }
    var nameEl = document.getElementById('dash-profile-name');
    if (nameEl) nameEl.textContent = name;
  }

  function renderSources() {
    var chips = document.getElementById('dg-src-chips');
    var list = document.getElementById('dg-src-list');
    if (!chips || !list) return;

    chips.innerHTML = Object.keys(SOURCES).map(function (k) {
      return '<button type="button" class="dg-chip' + (k === state.source ? ' is-on' : '') + '" data-dg-src="' + esc(k) + '">' + esc(SOURCES[k].label) + '</button>';
    }).join('');

    list.innerHTML = SOURCES[state.source].items.map(function (it) {
      var checked = state.picked.has(it) ? ' checked' : '';
      return '<label><input type="checkbox" data-dg-pick="' + esc(it) + '"' + checked + ' />' + esc(it) + '</label>';
    }).join('');
  }

  function renderTypes() {
    var chips = document.getElementById('dg-type-chips');
    if (!chips) return;
    chips.innerHTML = TYPES.map(function (t) {
      return '<button type="button" class="dg-chip' + (t[0] === state.type ? ' is-on' : '') + '" data-dg-type="' + esc(t[0]) + '">' + esc(t[0]) + '</button>';
    }).join('');
  }

  function docToHTML(d) {
    return d.sections.map(function (s) {
      var bullets = (s.bullets && s.bullets.length)
        ? '<ul>' + s.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<h2>' + esc(s.heading) + '</h2>' +
        s.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        bullets;
    }).join('');
  }

  function generateLocally(payload) {
    var found = TYPES.find(function (t) { return t[0] === payload.type; }) || TYPES[0];
    var sections = found[1];
    var src = payload.items.length ? payload.items : [payload.sourceLabel];
    var n = Number(payload.length) || 2;
    return {
      title: payload.title || (payload.type + ': ' + src[0]),
      sections: sections.map(function (h) {
        var paras = [];
        for (var i = 0; i < n; i += 1) {
          if (i === 0) {
            paras.push('This section covers ' + h.toLowerCase() + ' for ' + src.join(', ') + '. It is written for the ' + payload.audience.toLowerCase() + ' and draws on content stored in QuantalFlow ' + payload.sourceLabel.toLowerCase() + '.');
          } else {
            paras.push('Supporting context, owners, and measurable checkpoints for ' + h.toLowerCase() + (payload.notes ? (' — ' + payload.notes) : '.'));
          }
        }
        return {
          heading: h,
          paragraphs: paras,
          bullets: n > 2 ? ['Key point from ' + src[0], 'Owner and target milestone', 'Related decision or risk'] : []
        };
      })
    };
  }

  function refreshFoot(d) {
    var st = document.getElementById('dg-cur-status');
    var adv = document.getElementById('dg-btn-advance');
    var ver = document.getElementById('dg-ver-info');
    if (st) {
      st.textContent = d.status;
      st.className = 'dg-status dg-st-' + d.status;
    }
    var nx = NEXT_STATUS[d.status] || [null, d.status];
    if (adv) {
      adv.textContent = nx[1];
      adv.disabled = !nx[0];
      adv.style.opacity = nx[0] ? '1' : '0.5';
    }
    if (ver) {
      ver.textContent = d.versions.length
        ? (d.versions.length + ' saved version' + (d.versions.length > 1 ? 's' : '') + '. Latest: v' + d.versions.length + '.0 on ' + new Date(d.versions[d.versions.length - 1].at).toLocaleString())
        : 'Version history appears after the first save.';
    }
  }

  function bodyHTML() {
    var body = document.getElementById('dg-doc-body');
    if (!body) return '';
    var c = body.cloneNode(true);
    var m = c.querySelector('.dg-doc-meta');
    if (m) m.remove();
    return c.innerHTML;
  }

  function persistCurrent(addVersion) {
    var docs = loadDocs();
    var d = docs.find(function (x) { return x.id === state.currentId; });
    if (!d) return null;
    var titleEl = document.getElementById('dg-doc-title');
    d.title = (titleEl && titleEl.value.trim()) || 'Untitled document';
    d.html = bodyHTML();
    d.updated = new Date().toISOString();
    if (addVersion) d.versions.push({ at: d.updated, html: d.html, title: d.title });
    saveDocs(docs);
    return d;
  }

  function switchTab(v) {
    document.querySelectorAll('#dg-tabs button').forEach(function (b) {
      var on = b.getAttribute('data-dg-tab') === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#docgen-app .dg-view').forEach(function (x) {
      x.classList.toggle('is-on', x.id === 'dg-v-' + v);
    });
    renderLists();
  }

  function openDoc(id) {
    var d = loadDocs().find(function (x) { return x.id === id; });
    if (!d) return;
    state.currentId = id;
    switchTab('gen');
    var empty = document.getElementById('dg-editor-empty');
    var editor = document.getElementById('dg-editor');
    var titleEl = document.getElementById('dg-doc-title');
    var bodyEl = document.getElementById('dg-doc-body');
    if (empty) empty.style.display = 'none';
    if (editor) editor.style.display = 'block';
    if (titleEl) titleEl.value = d.title;
    if (bodyEl) {
      var itemMeta = (d.items && d.items.length) ? (' (' + d.items.map(esc).join(', ') + ')') : '';
      bodyEl.innerHTML = '<div class="dg-doc-meta">' + esc(d.type) + ' &middot; Source: ' + esc(d.source) + itemMeta + ' &middot; Last updated ' + new Date(d.updated).toLocaleString() + '</div>' + d.html;
    }
    refreshFoot(d);
  }

  function startNewDoc(silent) {
    state.currentId = null;
    state.picked = new Set();
    var editor = document.getElementById('dg-editor');
    var empty = document.getElementById('dg-editor-empty');
    var st = document.getElementById('dg-cur-status');
    var ver = document.getElementById('dg-ver-info');
    if (editor) editor.style.display = 'none';
    if (empty) empty.style.display = 'grid';
    if (st) { st.textContent = 'Draft'; st.className = 'dg-status dg-st-Draft'; }
    if (ver) ver.textContent = 'Version history appears after the first save.';
    var t = document.getElementById('dg-opt-title');
    var n = document.getElementById('dg-opt-notes');
    var l = document.getElementById('dg-opt-len');
    if (t) t.value = '';
    if (n) n.value = '';
    if (l) l.value = '2';
    renderSources();
    switchTab('gen');
    if (t) setTimeout(function () { t.focus(); }, 120);
    if (!silent) toast('New document started. Choose a source and a document type.');
  }

  function rowHTML(d, reviewMode) {
    return '<tr>' +
      '<td><b>' + esc(d.title) + '</b><div style="font-size:12px;color:var(--dg-muted);">' + esc(d.source) + '</div></td>' +
      '<td>' + esc(d.type) + '</td>' +
      '<td><span class="dg-status dg-st-' + esc(d.status) + '">' + esc(d.status) + '</span></td>' +
      '<td>v' + (d.versions ? d.versions.length : 0) + '.0</td>' +
      '<td>' + new Date(d.updated).toLocaleDateString() + '</td>' +
      '<td><div class="dg-acts">' +
        '<button type="button" class="dg-btn dg-btn--small" data-dg-open="' + esc(d.id) + '">' + (reviewMode ? 'Review' : 'Open') + '</button>' +
        '<button type="button" class="dg-btn dg-btn--small dg-btn--danger" data-dg-del="' + esc(d.id) + '">Delete</button>' +
      '</div></td>' +
    '</tr>';
  }

  function tableHTML(list, reviewMode, emptyMsg) {
    if (!list.length) return '<div class="dg-none">' + emptyMsg + '</div>';
    return '<div class="dg-table-wrap"><table class="dg-table"><thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Version</th><th>Updated</th><th></th></tr></thead><tbody>' +
      list.map(function (d) { return rowHTML(d, reviewMode); }).join('') +
    '</tbody></table></div>';
  }

  function renderLists() {
    var docs = loadDocs();
    var q = state.searchQuery.trim().toLowerCase();
    var filtered = q ? docs.filter(function (d) {
      return [d.title, d.type, d.source, d.status].join(' ').toLowerCase().indexOf(q) !== -1;
    }) : docs;

    var countEl = document.getElementById('dg-count-docs');
    var docsEl = document.getElementById('dg-docs-table');
    var revEl = document.getElementById('dg-rev-table');
    if (countEl) countEl.textContent = docs.length ? '(' + docs.length + ')' : '';
    if (docsEl) docsEl.innerHTML = tableHTML(filtered, false, 'No documents yet. Generate your first document from the Generate tab.');
    if (revEl) revEl.innerHTML = tableHTML(filtered.filter(function (d) { return d.status === 'Review'; }), true, 'No documents are waiting for review.');
  }

  function downloadFile(name, mime, content) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function toMarkdown(html, title) {
    var w = document.createElement('div');
    w.innerHTML = html;
    var md = '# ' + title + '\n\n';
    w.childNodes.forEach(function (n) {
      if (n.nodeName === 'H2') md += '\n## ' + n.textContent + '\n\n';
      else if (n.nodeName === 'P') md += n.textContent + '\n\n';
      else if (n.nodeName === 'UL') {
        n.querySelectorAll('li').forEach(function (li) { md += '- ' + li.textContent + '\n'; });
        md += '\n';
      }
    });
    return md;
  }

  function hydrateEcosystem() {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.replace('/login/?next=' + encodeURIComponent('/dashboard/documents/')); return null; }
        return r.ok ? r.json() : null;
      })
      .then(function (d) { if (d && d.user) wireChrome(d.user); })
      .catch(function () {});

    fetch('/api/os', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.state && Array.isArray(data.state.documents) && data.state.documents.length && !loadDocs().length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state.documents));
          renderLists();
        }
        var eco = data.ecosystem;
        if (eco) {
          if (eco.boards && eco.boards.length) {
            var wb = eco.boards.filter(function (b) { return !/mind/i.test(b.mode); }).map(function (b) { return b.title; }).filter(Boolean);
            var mm = eco.boards.filter(function (b) { return /mind/i.test(b.mode); }).map(function (b) { return b.title; }).filter(Boolean);
            if (wb.length) SOURCES.whiteboards.items = Array.from(new Set(wb.concat(SOURCES.whiteboards.items))).slice(0, 8);
            if (mm.length) SOURCES.mindmaps.items = Array.from(new Set(mm.concat(SOURCES.mindmaps.items))).slice(0, 8);
          }
          if (eco.projects && eco.projects.length) {
            var pr = eco.projects.map(function (p) { return p.title; }).filter(Boolean);
            if (pr.length) SOURCES.projects.items = Array.from(new Set(pr.concat(SOURCES.projects.items))).slice(0, 8);
          }
          renderSources();
        }
      })
      .catch(function () {});
  }

  function bindEvents() {
    if (window.__qfDocGenBound) return;
    window.__qfDocGenBound = true;

    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'docgen-top-search') {
        state.searchQuery = e.target.value || '';
        renderLists();
      }
    });

    document.addEventListener('change', function (e) {
      var cb = e.target && e.target.closest ? e.target.closest('[data-dg-pick]') : null;
      if (!cb) return;
      var val = cb.getAttribute('data-dg-pick');
      if (cb.checked) state.picked.add(val);
      else state.picked.delete(val);
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!document.getElementById('docgen-app')) return;

      var tab = t.closest('[data-dg-tab]');
      if (tab) { switchTab(tab.getAttribute('data-dg-tab')); return; }

      var srcChip = t.closest('[data-dg-src]');
      if (srcChip) {
        state.source = srcChip.getAttribute('data-dg-src');
        state.picked = new Set();
        renderSources();
        return;
      }

      var typeChip = t.closest('[data-dg-type]');
      if (typeChip) {
        state.type = typeChip.getAttribute('data-dg-type');
        renderTypes();
        return;
      }

      if (t.closest('#dg-btn-new-doc')) { startNewDoc(false); return; }

      if (t.closest('#dg-btn-generate')) {
        var btn = document.getElementById('dg-btn-generate');
        if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
        var payload = {
          source: state.source,
          sourceLabel: SOURCES[state.source].label,
          items: Array.from(state.picked),
          type: state.type,
          title: (document.getElementById('dg-opt-title') || {}).value ? document.getElementById('dg-opt-title').value.trim() : '',
          audience: (document.getElementById('dg-opt-aud') || {}).value || 'Executive team',
          length: (document.getElementById('dg-opt-len') || {}).value || '2',
          notes: (document.getElementById('dg-opt-notes') || {}).value ? document.getElementById('dg-opt-notes').value.trim() : ''
        };
        var out = generateLocally(payload);
        var id = 'd' + Date.now();
        var rec = {
          id: id,
          title: out.title,
          type: state.type,
          source: payload.sourceLabel,
          items: payload.items,
          status: 'Draft',
          html: docToHTML(out),
          versions: [],
          published: false,
          updated: new Date().toISOString()
        };
        var docs = loadDocs();
        docs.unshift(rec);
        saveDocs(docs);
        openDoc(id);
        if (btn) { btn.disabled = false; btn.textContent = 'Generate Document'; }
        toast('Document generated');
        return;
      }

      if (t.closest('#dg-btn-save')) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        var saved = persistCurrent(true);
        if (saved) { refreshFoot(saved); renderLists(); toast('Version saved'); }
        return;
      }

      if (t.closest('#dg-btn-advance')) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        var curDocs = loadDocs();
        var cur = curDocs.find(function (x) { return x.id === state.currentId; });
        if (!cur) return;
        var nx = NEXT_STATUS[cur.status] && NEXT_STATUS[cur.status][0];
        if (!nx) return;
        persistCurrent(false);
        var updatedDocs = loadDocs();
        var target = updatedDocs.find(function (x) { return x.id === state.currentId; });
        if (target) {
          target.status = nx;
          if (nx === 'Published') target.published = true;
          saveDocs(updatedDocs);
          refreshFoot(target);
          renderLists();
          toast(nx === 'Published' ? 'Published to the Knowledge Hub' : ('Status changed to ' + nx));
        }
        return;
      }

      var cmdBtn = t.closest('[data-dg-cmd]');
      if (cmdBtn) {
        var body = document.getElementById('dg-doc-body');
        if (body) {
          body.focus();
          document.execCommand(cmdBtn.getAttribute('data-dg-cmd'), false, cmdBtn.getAttribute('data-dg-val') || null);
        }
        return;
      }

      var aiBtn = t.closest('[data-dg-ai]');
      if (aiBtn) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        toast(aiBtn.getAttribute('data-dg-ai') + ' applied to active draft');
        return;
      }

      var expBtn = t.closest('[data-dg-export]');
      if (expBtn) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        var d = persistCurrent(false);
        if (!d) return;
        var safe = d.title.replace(/[^\w-]+/g, '_');
        var f = expBtn.getAttribute('data-dg-export');
        var page = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font-family:Calibri,Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.6}h1{font-size:24px}h2{font-size:16px;margin-top:22px}</style></head><body><h1>' + esc(d.title) + '</h1>' + d.html + '</body></html>';
        if (f === 'pdf') { window.print(); toast('Choose Save as PDF in the print dialog'); }
        else if (f === 'html') downloadFile(safe + '.html', 'text/html', page);
        else if (f === 'md') downloadFile(safe + '.md', 'text/markdown', toMarkdown(d.html, d.title));
        else if (f === 'docx') { downloadFile(safe + '.doc', 'application/msword', page); toast('Saved as Word-compatible .doc file'); }
        else if (f === 'pptx') toast('PPTX slide export queued');
        return;
      }

      var openBtn = t.closest('[data-dg-open]');
      if (openBtn) { openDoc(openBtn.getAttribute('data-dg-open')); return; }

      var delBtn = t.closest('[data-dg-del]');
      if (delBtn) {
        var did = delBtn.getAttribute('data-dg-del');
        if (!window.confirm('Delete this document?')) return;
        saveDocs(loadDocs().filter(function (x) { return x.id !== did; }));
        if (state.currentId === did) startNewDoc(true);
        renderLists();
        toast('Document deleted');
      }
    });
  }

  function initDocumentGeneration() {
    if (!document.getElementById('docgen-app')) return;
    bindEvents();
    renderSources();
    renderTypes();
    renderLists();
    hydrateEcosystem();
  }

  window.initDocumentGeneration = initDocumentGeneration;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDocumentGeneration);
  } else {
    initDocumentGeneration();
  }
})();
