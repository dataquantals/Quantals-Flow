/* ==========================================================================
   Organisational Memory Register & Side Panel Controller (`assets/js/memory.js`)
   ========================================================================== */
(function () {
  'use strict';

  var activeTab = 'all';
  var selectedId = null;
  var state = { items: [], counts: {}, totalAll: 0, needsReviewCount: 0, archivedCount: 0, types: [], settings: { minEvidenceThreshold: 3 }, orgName: '' };

  var els = {
    nav: document.getElementById('mem-nav'),
    content: document.getElementById('mem-content'),
    filters: document.getElementById('mem-filters'),
    search: document.getElementById('mem-search'),
    source: document.getElementById('mem-source'),
    status: document.getElementById('mem-status'),
    threshold: document.getElementById('mem-threshold'),
    totalLabel: document.getElementById('mem-total-label'),
    reviewBtn: document.getElementById('mem-needs-review-btn'),
    synthBtn: document.getElementById('mem-synthesize'),
    addBtn: document.getElementById('mem-add-btn'),
    panelBg: document.getElementById('mem-panel-bg'),
    panelClose: document.getElementById('mem-panel-close'),
    panelStatus: document.getElementById('mem-panel-status'),
    panelTitle: document.getElementById('mem-panel-title'),
    panelMeta: document.getElementById('mem-panel-meta'),
    panelBody: document.getElementById('mem-panel-body'),
    panelFoot: document.getElementById('mem-panel-foot'),
    modalBg: document.getElementById('mem-modal-bg'),
    modalClose: document.getElementById('mem-modal-close'),
    modalHeading: document.getElementById('mem-modal-h'),
    form: document.getElementById('mem-capture-form'),
    formSubmit: document.getElementById('mem-form-submit'),
    formGeneralErr: document.getElementById('mem-form-general-err')
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function typeLabel(id) {
    var found = (state.types || []).find(function (t) { return t.id === id; });
    return found ? found.label : id;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch { return '—'; }
  }

  function isGibberish(text) {
    var s = String(text || '').trim();
    if (!s) return true;
    if (/(.)\1{4,}/i.test(s)) return true;
    if (/\b(asdf|sdf|sdfs|qwer|zxcv|lkj|jkl|hjkl|fghj|test123|aaaa|xxxx|zzzz)\b/i.test(s)) return true;
    var words = s.split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var clean = words[i].replace(/[^a-zA-Z]/g, '');
      if (clean.length >= 6 && clean !== clean.toUpperCase() && /[bcdfghjklmnpqrstvwxz]{6,}/i.test(clean)) return true;
    }
    var letters = s.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 6) {
      var vowels = (letters.match(/[aeiouy]/gi) || []).length;
      if (vowels / letters.length < 0.14) return true;
    }
    return false;
  }

  function clearFormErrors() {
    els.form.querySelectorAll('[data-err]').forEach(function (el) { el.textContent = ''; });
    els.formGeneralErr.textContent = '';
  }

  function showFormErrors(errs) {
    clearFormErrors();
    Object.keys(errs || {}).forEach(function (k) {
      var slot = els.form.querySelector('[data-err="' + k + '"]');
      if (slot) slot.textContent = errs[k];
    });
  }

  function renderHeader() {
    var scopeWord = els.status.value === 'Archived' ? 'archived' : 'active';
    els.totalLabel.textContent = state.totalAll + ' ' + scopeWord + ' record' + (state.totalAll === 1 ? '' : 's') + ' · ' + state.orgName;
    els.reviewBtn.textContent = 'Needs review: ' + state.needsReviewCount;
    els.reviewBtn.classList.toggle('has-pending', state.needsReviewCount > 0);
    if (state.settings && state.settings.minEvidenceThreshold) {
      els.threshold.value = String(state.settings.minEvidenceThreshold);
    }
  }

  function renderNav() {
    var tabs = [{ id: 'all', label: 'All', count: state.totalAll }]
      .concat((state.types || []).map(function (t) {
        return { id: t.id, label: t.plural, count: state.counts[t.id] || 0, hint: t.hint };
      }))
      .concat([{ id: 'assistant', label: 'AI Assistant', count: '' }]);

    els.nav.innerHTML = tabs.map(function (t) {
      var isEmpty = typeof t.count === 'number' && t.count === 0 && t.id !== 'all';
      return '<button type="button" class="mem-nav__btn' + (activeTab === t.id ? ' is-active' : '') + (isEmpty ? ' is-empty' : '') + '" data-tab="' + esc(t.id) + '">' +
        '<span>' + esc(t.label) + '</span>' +
        (t.count !== '' ? '<span class="mem-nav__cnt">' + esc(t.count) + '</span>' : '') +
      '</button>';
    }).join('');
  }

  function renderRegister() {
    els.filters.hidden = false;
    if (!state.items.length) {
      var typeMeta = (state.types || []).find(function (t) { return t.id === activeTab; });
      els.content.innerHTML =
        '<div class="mem-register"><div class="mem-empty">' +
          '<h3>No records in this view</h3>' +
          '<p>' + esc(typeMeta ? typeMeta.hint : 'Run the AI Memory Engine once enough activity events accumulate, or capture a validated insight manually.') + '</p>' +
          '<button type="button" class="btn btn--ghost" id="mem-empty-reset">Show all active records</button>' +
        '</div></div>';
      var resetBtn = document.getElementById('mem-empty-reset');
      if (resetBtn) resetBtn.onclick = function () {
        activeTab = 'all';
        els.search.value = '';
        els.source.value = 'all';
        els.status.value = 'active';
        loadRegister();
      };
      return;
    }

    var rowsHtml = state.items.map(function (m) {
      var confText = m.aiGenerated
        ? (m.confidence + '% (' + m.evidenceCount + ' events)')
        : 'Manual (100%)';
      return (
        '<tr tabindex="0" data-mem-id="' + esc(m.id) + '"' + (selectedId === m.id ? ' class="is-selected"' : '') + '>' +
          '<td><span class="mem-rec-title">' + esc(m.title) + '</span><span class="mem-rec-sub">' + esc(m.summary.slice(0, 96) + (m.summary.length > 96 ? '…' : '')) + '</span></td>' +
          '<td>' + esc(typeLabel(m.category)) + '</td>' +
          '<td>' + esc(m.projectName || 'Workspace') + '</td>' +
          '<td><span class="mem-status mem-status--' + esc(m.status) + '">' + esc(m.status) + '</span></td>' +
          '<td class="mem-num">' + esc(confText) + '</td>' +
          '<td class="mem-num mem-muted">' + esc(formatDate(m.lastObservedAt)) + '</td>' +
        '</tr>'
      );
    }).join('');

    els.content.innerHTML =
      '<div class="mem-register"><div class="mem-table-wrap">' +
        '<table class="mem-table">' +
          '<thead><tr>' +
            '<th scope="col">Record</th>' +
            '<th scope="col">Type</th>' +
            '<th scope="col">Project</th>' +
            '<th scope="col">Status</th>' +
            '<th scope="col">Confidence</th>' +
            '<th scope="col">Date</th>' +
          '</tr></thead>' +
          '<tbody id="mem-tbody">' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div></div>';
  }

  function renderAssistant() {
    els.filters.hidden = true;
    els.content.innerHTML =
      '<div class="mem-ai-box">' +
        '<h2 style="margin:0 0 8px;font-size:16px">AI Memory Assistant</h2>' +
        '<p class="mem-muted" style="margin:0">Ask questions grounded in your active Organisational Memory register.</p>' +
        '<form id="mem-ai-form" class="mem-ai-form">' +
          '<input id="mem-ai-input" placeholder="e.g. What lessons have we learned about scope changes or security?" required />' +
          '<button type="submit" class="btn btn--blue" id="mem-ai-go">Ask</button>' +
        '</form>' +
        '<div id="mem-ai-out"></div>' +
      '</div>';

    document.getElementById('mem-ai-form').onsubmit = function (e) {
      e.preventDefault();
      var q = document.getElementById('mem-ai-input').value;
      var out = document.getElementById('mem-ai-out');
      out.innerHTML = '<div class="mem-ai-answer">Searching register…</div>';
      fetch('/api/memory/ask', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          out.innerHTML = '<div class="mem-ai-answer">' + esc((d && d.answer) || 'No answer available.') + '</div>';
        });
    };
  }

  function openDetailPanel(id) {
    selectedId = id;
    renderRegister();
    fetch('/api/memory/' + encodeURIComponent(id), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.record) return;
        var m = d.record;
        els.panelStatus.className = 'mem-status mem-status--' + m.status;
        els.panelStatus.textContent = m.status;
        els.panelTitle.textContent = m.title;
        els.panelMeta.textContent = typeLabel(m.category) + ' · ' + m.projectName + ' · Source: ' + (m.aiGenerated ? 'AI Engine (' + m.confidence + '%)' : 'Manual (' + m.authorName + ')') +
          ' · First observed ' + formatDate(m.firstObservedAt) + ' · Updated ' + formatDate(m.lastObservedAt);

        var evHtml = (m.evidenceEvents && m.evidenceEvents.length)
          ? '<div class="mem-ev-list">' + m.evidenceEvents.map(function (ev) {
              return '<div class="mem-ev-item"><strong>' + esc(ev.action_type) + '</strong> — ' + esc(ev.description) + '<br><span class="mem-muted">' + esc(ev.actor_name) + ' · ' + esc(formatDate(ev.timestamp)) + '</span></div>';
            }).join('') + '</div>'
          : '<p class="mem-muted">' + (m.aiGenerated ? 'Supporting events linked in Activity Log.' : 'Captured manually by ' + esc(m.authorName) + '.') + '</p>';

        els.panelBody.innerHTML =
          '<section class="mem-panel__section"><h4>Summary</h4><p>' + esc(m.summary || '—') + '</p></section>' +
          '<section class="mem-panel__section"><h4>Why it happened</h4><p>' + esc(m.whyHappened || '—') + '</p></section>' +
          '<section class="mem-panel__section"><h4>What was learned</h4><p>' + esc(m.lessonLearned || '—') + '</p></section>' +
          '<section class="mem-panel__section"><h4>What future teams should know / Recommendation</h4><p>' + esc(m.recommendation || '—') + '</p></section>' +
          '<section class="mem-panel__section"><h4>Supporting Evidence (' + m.evidenceCount + ')</h4>' + evHtml +
            '<p style="margin-top:8px"><a class="mem-audit-link" href="' + esc(m.sourceLink || '/dashboard/activity/') + '">Inspect in Activity Log &rarr;</a></p>' +
          '</section>';

        var btns = [];
        if (m.status === 'Proposed') btns.push('<button type="button" class="btn btn--blue" data-act="validate">Validate</button>');
        if (m.status !== 'Archived') btns.push('<button type="button" class="btn btn--ghost" data-act="archive">Archive</button>');
        else btns.push('<button type="button" class="btn btn--blue" data-act="restore">Restore</button>');
        btns.push('<button type="button" class="btn btn--ghost" data-act="edit">Edit</button>');
        btns.push('<button type="button" class="btn btn--ghost" data-act="delete" style="color:#dc2626;margin-left:auto">Delete</button>');
        els.panelFoot.innerHTML = btns.join('');

        els.panelFoot.onclick = function (e) {
          var b = e.target.closest('[data-act]');
          if (!b) return;
          var act = b.dataset.act;
          if (act === 'validate') patchRecord(m.id, { status: 'Validated' });
          else if (act === 'archive') patchRecord(m.id, { status: 'Archived' }, true);
          else if (act === 'restore') patchRecord(m.id, { status: 'Validated' });
          else if (act === 'edit') openEditModal(m);
          else if (act === 'delete') deleteRecord(m.id);
        };

        els.panelBg.classList.add('is-open');
        els.panelBg.setAttribute('aria-hidden', 'false');
      });
  }

  function closeDetailPanel() {
    selectedId = null;
    els.panelBg.classList.remove('is-open');
    els.panelBg.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('#mem-tbody tr.is-selected').forEach(function (r) { r.classList.remove('is-selected'); });
  }

  function patchRecord(id, patch, closeAfter) {
    fetch('/api/memory/' + encodeURIComponent(id), {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          if (closeAfter) closeDetailPanel();
          loadRegister(function () { if (!closeAfter && selectedId === id) openDetailPanel(id); });
        }
      });
  }

  function deleteRecord(id) {
    fetch('/api/memory/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { closeDetailPanel(); loadRegister(); }
      });
  }

  function openCaptureModal() {
    clearFormErrors();
    els.form.reset();
    document.getElementById('mem-edit-id').value = '';
    els.modalHeading.textContent = 'Capture Insight';
    els.formSubmit.textContent = 'Save Validated Record';
    els.modalBg.hidden = false;
  }

  function openEditModal(m) {
    clearFormErrors();
    document.getElementById('mem-edit-id').value = m.id;
    els.form.elements.category.value = m.category;
    els.form.elements.projectName.value = m.projectName || 'Workspace';
    els.form.elements.title.value = m.title || '';
    els.form.elements.summary.value = m.summary || '';
    els.form.elements.whyHappened.value = m.whyHappened || '';
    els.form.elements.lessonLearned.value = m.lessonLearned || '';
    els.form.elements.recommendation.value = m.recommendation || '';
    els.modalHeading.textContent = 'Edit Record';
    els.formSubmit.textContent = 'Save Changes';
    els.modalBg.hidden = false;
  }

  function loadRegister(cb) {
    var qs = new URLSearchParams();
    qs.set('category', activeTab === 'assistant' ? 'all' : activeTab);
    if (els.search.value.trim()) qs.set('q', els.search.value.trim());
    qs.set('source', els.source.value);
    qs.set('status', els.status.value);

    fetch('/api/memory?' + qs.toString(), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/login/?next=/dashboard/memory/'; return null; }
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) return;
        state = d;
        renderHeader();
        renderNav();
        if (activeTab === 'assistant') renderAssistant();
        else renderRegister();
        if (typeof cb === 'function') cb();
      });
  }

  // Event Wiring
  els.nav.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    activeTab = b.dataset.tab;
    if (activeTab === 'assistant') { renderNav(); renderAssistant(); }
    else loadRegister();
  });

  els.content.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-mem-id]');
    if (tr) openDetailPanel(tr.dataset.memId);
  });

  els.content.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr[data-mem-id]');
    if (tr) { e.preventDefault(); openDetailPanel(tr.dataset.memId); }
  });

  els.reviewBtn.addEventListener('click', function () {
    activeTab = 'all';
    els.status.value = 'Proposed';
    loadRegister();
  });

  var searchTimer = null;
  els.search.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(loadRegister, 220); });
  els.source.addEventListener('change', loadRegister);
  els.status.addEventListener('change', loadRegister);

  els.threshold.addEventListener('change', function () {
    fetch('/api/memory/settings', {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minEvidenceThreshold: Number(els.threshold.value) })
    }).then(loadRegister);
  });

  els.synthBtn.addEventListener('click', function () {
    els.synthBtn.disabled = true;
    els.synthBtn.textContent = 'Analysing Activity…';
    fetch('/api/memory/synthesize', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function () {
        els.synthBtn.disabled = false;
        els.synthBtn.textContent = 'Run AI Memory Engine';
        loadRegister();
      })
      .catch(function () {
        els.synthBtn.disabled = false;
        els.synthBtn.textContent = 'Run AI Memory Engine';
      });
  });

  els.addBtn.addEventListener('click', openCaptureModal);
  els.modalClose.addEventListener('click', function () { els.modalBg.hidden = true; });
  els.modalBg.addEventListener('click', function (e) { if (e.target === els.modalBg) els.modalBg.hidden = true; });
  els.panelClose.addEventListener('click', closeDetailPanel);
  els.panelBg.addEventListener('click', function (e) { if (e.target === els.panelBg) closeDetailPanel(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!els.modalBg.hidden) els.modalBg.hidden = true;
      else if (els.panelBg.classList.contains('is-open')) closeDetailPanel();
    }
  });

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearFormErrors();
    var fd = new FormData(els.form);
    var payload = {
      category: fd.get('category'),
      projectName: String(fd.get('projectName') || 'Workspace').trim(),
      title: String(fd.get('title') || '').trim(),
      summary: String(fd.get('summary') || '').trim(),
      whyHappened: String(fd.get('whyHappened') || '').trim(),
      lessonLearned: String(fd.get('lessonLearned') || '').trim(),
      recommendation: String(fd.get('recommendation') || '').trim()
    };

    // Client-side validation matching server rules
    var errs = {};
    if (payload.title.length < 8) errs.title = 'Title must be at least 8 characters.';
    else if (isGibberish(payload.title)) errs.title = 'Enter a meaningful title (placeholder or random text is rejected).';
    if (payload.summary.length < 20) errs.summary = 'Summary must be at least 20 characters.';
    else if (isGibberish(payload.summary)) errs.summary = 'Enter a clear summary rather than placeholder text.';
    if (payload.whyHappened.length < 10) errs.whyHappened = 'Explain why it happened (at least 10 characters).';
    else if (isGibberish(payload.whyHappened)) errs.whyHappened = 'Enter a meaningful explanation.';

    if (Object.keys(errs).length) { showFormErrors(errs); return; }

    var editId = String(fd.get('editId') || '').trim();
    var url = editId ? '/api/memory/' + encodeURIComponent(editId) : '/api/memory';
    var method = editId ? 'PATCH' : 'POST';

    fetch(url, {
      method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          if (res.d && res.d.fieldErrors) showFormErrors(res.d.fieldErrors);
          else els.formGeneralErr.textContent = (res.d && res.d.error) || 'Could not save record.';
          return;
        }
        els.modalBg.hidden = true;
        loadRegister(function () { if (editId) openDetailPanel(editId); });
      });
  });

  loadRegister();
})();
