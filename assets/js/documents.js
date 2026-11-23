/* ==========================================================================
   QuantalFlow Document Generation — Intelligent Document Factory
   Unified with QuantalFlow Workspace Auth, Router & Ecosystem Sources
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'qf_documents_v1';

  var SOURCES = {
    perspective: { label: 'Perspective', items: [] },
    brainstorm: { label: 'Brainstorm', items: [] },
    whiteboards: { label: 'Whiteboards', items: [] },
    mindmaps: { label: 'Mind Maps', items: [] },
    projects: { label: 'Projects', items: [] },
    meetings: { label: 'Meetings', items: [] },
    tasks: { label: 'Tasks', items: [] },
    knowledge: { label: 'Knowledge Articles', items: [] },
    decisions: { label: 'Decisions', items: [] },
    research: { label: 'Research', items: [] },
    workflows: { label: 'Workflows', items: [] }
  };

  function normalizeSourceItem(it, sourceKey) {
    if (it && typeof it === 'object') {
      var id = String(it.id || it.title || '').trim();
      var title = String(it.title || it.label || it.name || id).trim();
      return {
        key: id || title,
        id: String(it.id || '').trim(),
        boardId: String(it.boardId || '').trim(),
        moduleKey: String(it.moduleKey || '').trim(),
        itemId: String(it.itemId || '').trim(),
        title: title,
        source: sourceKey,
        meta: String(it.meta || '').trim(),
        context: String(it.context || '').trim()
      };
    }
    var str = String(it || '').trim();
    return { key: str, id: '', boardId: '', moduleKey: '', itemId: '', title: str, source: sourceKey, meta: '', context: '' };
  }

  function getPickedSourceItems() {
    var list = (SOURCES[state.source] && SOURCES[state.source].items) || [];
    var out = [];
    list.forEach(function (raw) {
      var norm = normalizeSourceItem(raw, state.source);
      if (state.picked.has(norm.key)) out.push(norm);
    });
    return out;
  }

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
    searchQuery: '',
    lastPreAiHtml: null
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

    var items = (SOURCES[state.source] && SOURCES[state.source].items) || [];
    if (!items.length) {
      list.innerHTML = '<div style="padding:10px 4px;font-size:12.5px;color:var(--dg-muted);">No items found in ' + esc(SOURCES[state.source].label) + ' yet. Create one in your workspace or choose another source.</div>';
      return;
    }

    list.innerHTML = items.map(function (raw) {
      var it = normalizeSourceItem(raw, state.source);
      var checked = state.picked.has(it.key) ? ' checked' : '';
      var metaHtml = it.meta ? '<span style="margin-left:auto;font-size:11px;color:var(--dg-muted);">' + esc(it.meta) + '</span>' : '';
      return '<label><input type="checkbox" data-dg-pick="' + esc(it.key) + '"' + checked + ' /><span>' + esc(it.title) + '</span>' + metaHtml + '</label>';
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

    Promise.all([
      fetch('/api/os', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/knowledge', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (results) {
      var data = results[0];
      var knData = results[1];
      if (data && data.state && Array.isArray(data.state.documents) && data.state.documents.length && !loadDocs().length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state.documents));
        renderLists();
      }

      var eco = data && data.ecosystem ? data.ecosystem : null;
      if (eco) {
        var wsDocs = Array.isArray(eco.workspaceDocs) ? eco.workspaceDocs : [];
        var boards = Array.isArray(eco.boards) ? eco.boards : [];

        var buildModuleSource = function (modKey, fallbackBoards) {
          var list = [];
          var seenKeys = new Set();
          wsDocs.filter(function (d) { return (d.moduleKey || '').toLowerCase() === modKey; }).forEach(function (d) {
            var k = d.id || (d.boardId + ':' + d.title);
            if (!seenKeys.has(k)) {
              seenKeys.add(k);
              list.push({
                id: d.id,
                boardId: d.boardId,
                moduleKey: modKey,
                itemId: d.itemId || '',
                title: d.title,
                meta: d.boardTitle || modKey
              });
            }
          });
          fallbackBoards.forEach(function (b) {
            var k = b.id || b.title;
            if (!seenKeys.has(k)) {
              seenKeys.add(k);
              list.push({
                id: b.id,
                boardId: b.id,
                moduleKey: modKey,
                title: b.title || 'Untitled Board',
                meta: b.mode || modKey
              });
            }
          });
          return list;
        };

        var hasMod = function (b, mod) {
          var mods = Array.isArray(b.enabledModules) ? b.enabledModules : [];
          return mods.indexOf(mod) !== -1 || String(b.mode || '').toLowerCase() === mod;
        };

        SOURCES.perspective.items = buildModuleSource('perspective', boards.filter(function (b) { return hasMod(b, 'perspective'); }));
        SOURCES.brainstorm.items = buildModuleSource('brainstorm', boards.filter(function (b) { return hasMod(b, 'brainstorm'); }));
        SOURCES.whiteboards.items = buildModuleSource('whiteboard', boards.filter(function (b) { return !/mind/i.test(b.mode || ''); }));
        SOURCES.mindmaps.items = buildModuleSource('mindmap', boards.filter(function (b) { return /mind/i.test(b.mode || '') || hasMod(b, 'mindmap'); }));

        // Also surface embedded workspace docs at the top of Whiteboards if not already present so users can pick them there too
        wsDocs.forEach(function (d) {
          var already = SOURCES.whiteboards.items.some(function (x) { return x.title === d.title; });
          if (!already) {
            SOURCES.whiteboards.items.unshift({
              id: d.id,
              boardId: d.boardId,
              moduleKey: d.moduleKey,
              itemId: d.itemId || '',
              title: d.title,
              meta: (d.boardTitle || 'Workspace') + ' · ' + (d.moduleKey || 'doc')
            });
          }
        });

        if (Array.isArray(eco.projects)) {
          SOURCES.projects.items = eco.projects.map(function (p) {
            return {
              id: p.id,
              title: p.title || 'Untitled Project',
              meta: (p.taskCount || 0) + ' tasks'
            };
          });
          SOURCES.tasks.items = eco.projects
            .filter(function (p) { return (p.taskCount || 0) > 0; })
            .map(function (p) {
              return {
                id: p.id,
                title: p.title + ' Tasks',
                meta: p.taskCount + ' tasks',
                context: (p.tasks || []).map(function (t) {
                  return '- [' + (t.status || 'todo') + '] ' + (t.title || 'Task') + (t.assignee ? (' (' + t.assignee + ')') : '');
                }).join('\n')
              };
            });
        }
        if (Array.isArray(eco.notes) && eco.notes.length) {
          SOURCES.meetings.items = eco.notes
            .filter(function (n) { return /meeting|sync|kick|review/i.test((n.title || '') + ' ' + (n.body || '')); })
            .map(function (n) {
              return { id: n.id, title: n.title || 'Note', meta: 'Note', context: n.body || '' };
            });
        }
      }

      var knState = knData && knData.state ? knData.state : null;
      if (knState) {
        var objs = Array.isArray(knState.objects) ? knState.objects : [];
        var decs = Array.isArray(knState.decisions) ? knState.decisions : [];
        var sops = Array.isArray(knState.sops) ? knState.sops : [];

        SOURCES.knowledge.items = objs.map(function (o) {
          return {
            id: o.id || '',
            title: o.title || 'Knowledge Object',
            meta: o.type || 'Document',
            context: [o.description, o.content].filter(Boolean).join('\n')
          };
        });

        var decisionItems = decs.concat(objs.filter(function (o) { return /decision/i.test(o.type || ''); }));
        SOURCES.decisions.items = decisionItems.map(function (d) {
          return {
            id: d.id || '',
            title: d.title || 'Decision',
            meta: d.status || 'Decision',
            context: [d.description, d.rationale, d.content].filter(Boolean).join('\n')
          };
        });

        var workflowItems = sops.concat(objs.filter(function (o) { return /workflow|sop/i.test(o.type || ''); }));
        SOURCES.workflows.items = workflowItems.map(function (w) {
          return {
            id: w.id || '',
            title: w.title || 'Workflow',
            meta: w.type || 'Workflow',
            context: [w.description, w.content].filter(Boolean).join('\n')
          };
        });

        SOURCES.research.items = objs
          .filter(function (o) { return /research|analysis|note/i.test(o.type || ''); })
          .map(function (r) {
            return {
              id: r.id || '',
              title: r.title || 'Research',
              meta: r.type || 'Research',
              context: [r.description, r.content].filter(Boolean).join('\n')
            };
          });
      }

      renderSources();
    }).catch(function () {});
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
        var foundType = TYPES.find(function (x) { return x[0] === state.type; }) || TYPES[0];
        var pickedObjs = getPickedSourceItems();
        var notesVal = (document.getElementById('dg-opt-notes') || {}).value ? document.getElementById('dg-opt-notes').value.trim() : '';

        if (!pickedObjs.length && !notesVal) {
          if (window.QFDialog) {
            window.QFDialog.alert({
              title: 'Select a source item',
              message: 'Choose at least one item from "' + SOURCES[state.source].label + '" (or enter instructions in Notes) before generating.',
              buttonLabel: 'OK',
              tone: 'primary'
            });
          } else {
            toast('Select a source item before generating');
          }
          return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Synthesising with AI…'; }
        var combinedClientContext = pickedObjs
          .filter(function (o) { return o.context; })
          .map(function (o) { return '=== ' + o.title + ' ===\n' + o.context; })
          .join('\n\n');

        var payload = {
          source: state.source,
          sourceLabel: SOURCES[state.source].label,
          sourceItems: pickedObjs.map(function (o) {
            return {
              id: o.id,
              boardId: o.boardId,
              moduleKey: o.moduleKey,
              itemId: o.itemId,
              title: o.title,
              source: o.source
            };
          }),
          items: pickedObjs.map(function (o) { return o.title; }),
          sourceContext: combinedClientContext,
          type: state.type,
          defaultSections: foundType[1],
          title: (document.getElementById('dg-opt-title') || {}).value ? document.getElementById('dg-opt-title').value.trim() : '',
          audience: (document.getElementById('dg-opt-aud') || {}).value || 'Executive team',
          length: (document.getElementById('dg-opt-len') || {}).value || '2',
          notes: notesVal
        };

        fetch('/api/documents/generate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (json) {
              if (!r.ok) {
                throw new Error(json.error || ('Generation failed (HTTP ' + r.status + ')'));
              }
              return json;
            });
          })
          .then(function (res) {
            if (!res || !res.document || !Array.isArray(res.document.sections)) {
              throw new Error('Invalid document response from server.');
            }
            var out = res.document;
            var id = 'd' + Date.now();
            var rec = {
              id: id,
              title: out.title,
              type: state.type,
              source: payload.sourceLabel,
              audience: payload.audience,
              items: payload.items,
              sections: out.sections,
              aiProvider: out.aiProvider || 'local-engine',
              status: 'Draft',
              html: docToHTML(out),
              versions: [],
              published: false,
              updated: new Date().toISOString()
            };
            var docs = loadDocs();
            docs.unshift(rec);
            saveDocs(docs);
            state.lastPreAiHtml = null;
            var undoBtn = document.getElementById('dg-btn-undo-ai');
            if (undoBtn) undoBtn.hidden = true;
            openDoc(id);
            toast(out.aiProvider && out.aiProvider !== 'local-engine'
              ? ('Document generated with ' + out.aiProvider)
              : 'Executive document generated');
          })
          .catch(function (err) {
            var errMsg = (err && err.message) ? err.message : 'Could not generate document from the selected source.';
            if (window.QFDialog) {
              window.QFDialog.alert({
                title: 'Cannot generate document',
                message: errMsg,
                buttonLabel: 'OK',
                tone: 'danger'
              });
            } else {
              toast(errMsg);
            }
          })
          .finally(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Generate Document'; }
          });
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

      if (t.closest('#dg-btn-undo-ai')) {
        if (!state.currentId || !state.lastPreAiHtml) return;
        var curDocsUndo = loadDocs();
        var curDocUndo = curDocsUndo.find(function (x) { return x.id === state.currentId; });
        if (curDocUndo) {
          curDocUndo.html = state.lastPreAiHtml;
          saveDocs(curDocsUndo);
          state.lastPreAiHtml = null;
          var ub = document.getElementById('dg-btn-undo-ai');
          if (ub) ub.hidden = true;
          openDoc(curDocUndo.id);
          toast('Reverted AI edit');
        }
        return;
      }

      var aiBtn = t.closest('[data-dg-ai]');
      if (aiBtn) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        var action = aiBtn.getAttribute('data-dg-ai');
        var prevDoc = persistCurrent(false);
        if (!prevDoc) return;
        state.lastPreAiHtml = prevDoc.html;
        var origText = aiBtn.textContent;
        aiBtn.disabled = true;
        aiBtn.textContent = 'Refining…';
        fetch('/api/documents/ai-edit', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, title: prevDoc.title, html: prevDoc.html })
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (res) {
            if (res && res.html) {
              var allDocs = loadDocs();
              var item = allDocs.find(function (x) { return x.id === state.currentId; });
              if (item) {
                item.html = res.html;
                item.sections = null;
                item.updated = new Date().toISOString();
                saveDocs(allDocs);
                openDoc(item.id);
                var ub2 = document.getElementById('dg-btn-undo-ai');
                if (ub2) ub2.hidden = false;
                toast(action + ' complete — click Undo AI to revert');
              }
            } else {
              toast('Could not refine document right now');
            }
          })
          .catch(function () { toast('AI refinement failed'); })
          .finally(function () { aiBtn.disabled = false; aiBtn.textContent = origText; });
        return;
      }

      var expBtn = t.closest('[data-dg-export]');
      if (expBtn) {
        if (!state.currentId) { toast('Generate a document first'); return; }
        var d = persistCurrent(false);
        if (!d) return;
        var safe = d.title.replace(/[^\w-]+/g, '_');
        var f = expBtn.getAttribute('data-dg-export');

        if (f === 'pdf') {
          if (typeof window.html2pdf === 'function') {
            toast('Generating executive PDF…');
            var wrap = document.createElement('div');
            wrap.style.cssText = 'font-family:Inter,Calibri,Arial,sans-serif;color:#111827;padding:24px 28px;line-height:1.6;max-width:720px;';
            wrap.innerHTML =
              '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;margin-bottom:6px;">QuantalFlow &bull; ' + esc(d.type) + '</div>' +
              '<h1 style="font-size:24px;color:#0c1630;margin:0 0 8px;padding-bottom:10px;border-bottom:2px solid #2563eb;">' + esc(d.title) + '</h1>' +
              '<div style="font-size:11px;color:#525866;margin-bottom:20px;">Audience: ' + esc(d.audience || 'Executive team') + ' &middot; Source: ' + esc(d.source) + ' &middot; Status: ' + esc(d.status) + '</div>' +
              d.html;
            window.html2pdf().set({
              margin: [12, 12, 12, 12],
              filename: safe + '.pdf',
              image: { type: 'jpeg', quality: 0.96 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(wrap).save().then(function () {
              toast('Exported ' + safe + '.pdf');
            }).catch(function () {
              window.print();
            });
          } else {
            window.print();
            toast('Choose Save as PDF in the print dialog');
          }
          return;
        }

        // Server-side top-standard OpenXML PPTX, DOCX, HTML, and Markdown export
        var expLabel = expBtn.textContent;
        expBtn.disabled = true;
        expBtn.textContent = 'Exporting…';
        fetch('/api/documents/export', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: f, document: d })
        })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.blob();
          })
          .then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = safe + '.' + f;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
            toast('Exported ' + safe + '.' + f);
          })
          .catch(function () {
            toast('Export failed for ' + f.toUpperCase());
          })
          .finally(function () {
            expBtn.disabled = false;
            expBtn.textContent = expLabel;
          });
        return;
      }

      var openBtn = t.closest('[data-dg-open]');
      if (openBtn) { openDoc(openBtn.getAttribute('data-dg-open')); return; }

      var delBtn = t.closest('[data-dg-del]');
      if (delBtn) {
        var did = delBtn.getAttribute('data-dg-del');
        window.QFDialog.confirm({
          title: 'Delete this document?',
          message: 'This document will be permanently removed from your Document Generation library.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          tone: 'danger'
        }).then(function (ok) {
          if (!ok) return;
          saveDocs(loadDocs().filter(function (x) { return x.id !== did; }));
          if (state.currentId === did) startNewDoc(true);
          renderLists();
          toast('Document deleted');
        });
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
