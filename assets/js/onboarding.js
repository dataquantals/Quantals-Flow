/* ==========================================================================
   5-Step Organisation Creation Wizard (`assets/js/onboarding.js`)
   ========================================================================== */
(function () {
  'use strict';

  var ORG_TYPES = [
    { name: 'Business', desc: 'Startups, SMEs & commercial teams' },
    { name: 'University', desc: 'Faculties, labs & academic groups' },
    { name: 'Government', desc: 'Ministries, agencies & public sector' },
    { name: 'NGO', desc: 'Non-profits & humanitarian missions' },
    { name: 'Consultancy', desc: 'Client engagements & advisory' },
    { name: 'Healthcare', desc: 'Hospitals, clinics & health systems' },
    { name: 'Research Institute', desc: 'Labs, grants & R&D teams' },
    { name: 'Educational Institution', desc: 'Schools, colleges & training' },
    { name: 'Personal Workspace', desc: 'Solo creator or individual use' }
  ];

  var MODULES = [
    { name: 'Projects', desc: 'Gantt, WBS, Kanban & milestones' },
    { name: 'Knowledge Hub', desc: 'Organisational memory & Leaf docs' },
    { name: 'Document Studio', desc: 'AI documents, quotations & invoices' },
    { name: 'Whiteboards', desc: 'Infinite visual collaboration' },
    { name: 'Mind Maps', desc: 'Structured brainstorming & diagrams' },
    { name: 'Workflow Studio', desc: 'Automations & CRM pipelines' },
    { name: 'Analytics', desc: 'Org KPIs, workload & audit insights' },
    { name: 'Learning Centre', desc: 'Onboarding, SOPs & team training' }
  ];

  var step = 1;
  var state = {
    name: '',
    logoUrl: '',
    industry: '',
    country: '',
    timezone: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })(),
    teamSize: '1-10',
    website: '',
    description: '',
    orgType: 'Business',
    modules: ['Projects', 'Knowledge Hub', 'Document Studio', 'Whiteboards', 'Mind Maps'],
    invites: []
  };

  var bodyEl = document.getElementById('ob-step-body');
  var errEl = document.getElementById('ob-err');
  var prevBtn = document.getElementById('ob-prev');
  var nextBtn = document.getElementById('ob-next');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function setError(msg) {
    if (errEl) errEl.textContent = msg || '';
  }

  function updateStepper() {
    document.querySelectorAll('.ob-step-pill').forEach(function (el) {
      var n = Number(el.dataset.step);
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-done', n < step);
    });
    prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
    nextBtn.textContent = step === 5 ? 'Launch Workspace →' : 'Continue →';
  }

  function render() {
    setError('');
    updateStepper();

    if (step === 1) {
      bodyEl.innerHTML =
        '<h1>Create Your Organisation</h1>' +
        '<p class="ob-sub">Set up your isolated multi-tenant workspace backed by Clerk Organisations.</p>' +
        '<div class="ob-grid">' +
          '<div class="ob-field ob-field--full"><label for="ob-name">Organisation Name *</label><input id="ob-name" value="' + esc(state.name) + '" placeholder="e.g. Data Quantals Solution, University of Lusaka" required /></div>' +
          '<div class="ob-field"><label for="ob-industry">Industry</label><input id="ob-industry" value="' + esc(state.industry) + '" placeholder="e.g. Technology, Education, Healthcare" /></div>' +
          '<div class="ob-field"><label for="ob-country">Country</label><input id="ob-country" value="' + esc(state.country) + '" placeholder="e.g. Zambia, United Kingdom, USA" /></div>' +
          '<div class="ob-field"><label for="ob-tz">Timezone</label><input id="ob-tz" value="' + esc(state.timezone) + '" /></div>' +
          '<div class="ob-field"><label for="ob-size">Team Size</label><select id="ob-size">' +
            ['1 (Solo)', '2-10', '11-50', '51-250', '251-1000', '1000+'].map(function (s) {
              return '<option value="' + esc(s) + '"' + (state.teamSize === s ? ' selected' : '') + '>' + esc(s) + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="ob-field"><label for="ob-web">Website</label><input id="ob-web" type="url" value="' + esc(state.website) + '" placeholder="https://yourorganisation.com" /></div>' +
          '<div class="ob-field"><label for="ob-logo">Organisation Logo URL (optional)</label><input id="ob-logo" type="url" value="' + esc(state.logoUrl) + '" placeholder="https://.../logo.png" /></div>' +
          '<div class="ob-field ob-field--full"><label for="ob-desc">Description</label><textarea id="ob-desc" rows="2" placeholder="What does your organisation build or deliver?">' + esc(state.description) + '</textarea></div>' +
        '</div>';
    } else if (step === 2) {
      bodyEl.innerHTML =
        '<h1>Select Organisation Type</h1>' +
        '<p class="ob-sub">Tailor departments, roles, and governance templates to your sector.</p>' +
        '<div class="ob-pick-grid">' +
          ORG_TYPES.map(function (t) {
            var sel = state.orgType === t.name;
            return '<button type="button" class="ob-pick' + (sel ? ' is-selected' : '') + '" data-org-type="' + esc(t.name) + '"><strong>' + esc(t.name) + '</strong><small>' + esc(t.desc) + '</small></button>';
          }).join('') +
        '</div>';
      bodyEl.querySelectorAll('[data-org-type]').forEach(function (b) {
        b.onclick = function () { state.orgType = b.dataset.orgType; render(); };
      });
    } else if (step === 3) {
      bodyEl.innerHTML =
        '<h1>Configure Initial Workspace</h1>' +
        '<p class="ob-sub">Choose the modules to activate for your organisation (you can change these anytime).</p>' +
        '<div class="ob-pick-grid">' +
          MODULES.map(function (m) {
            var sel = state.modules.indexOf(m.name) !== -1;
            return '<button type="button" class="ob-pick' + (sel ? ' is-selected' : '') + '" data-mod="' + esc(m.name) + '"><strong>' + (sel ? '✓ ' : '') + esc(m.name) + '</strong><small>' + esc(m.desc) + '</small></button>';
          }).join('') +
        '</div>';
      bodyEl.querySelectorAll('[data-mod]').forEach(function (b) {
        b.onclick = function () {
          var mod = b.dataset.mod;
          var idx = state.modules.indexOf(mod);
          if (idx >= 0) state.modules.splice(idx, 1);
          else state.modules.push(mod);
          render();
        };
      });
    } else if (step === 4) {
      bodyEl.innerHTML =
        '<h1>Invite Team Members</h1>' +
        '<p class="ob-sub">Invite colleagues now or skip and invite anytime from People &amp; Teams.</p>' +
        '<div class="ob-invite-row">' +
          '<input id="ob-inv-email" type="email" placeholder="colleague@organisation.com" />' +
          '<select id="ob-inv-role">' +
            ['ADMINISTRATOR', 'MANAGER', 'MEMBER', 'VIEWER', 'GUEST'].map(function (r) {
              return '<option value="' + r + '"' + (r === 'MEMBER' ? ' selected' : '') + '>' + r + '</option>';
            }).join('') +
          '</select>' +
          '<button type="button" class="btn btn--blue" id="ob-inv-add">Add</button>' +
        '</div>' +
        '<div class="ob-invite-list" id="ob-inv-list">' +
          (state.invites.length
            ? state.invites.map(function (inv, i) {
                return '<div class="ob-invite-chip"><span><strong>' + esc(inv.email) + '</strong> &middot; ' + esc(inv.role) + '</span><button type="button" class="btn btn--ghost" data-rm-inv="' + i + '" style="height:30px;padding:0 10px">Remove</button></div>';
              }).join('')
            : '<p style="font-size:13px;color:#64748b">No invitations queued yet (optional).</p>') +
        '</div>';
      document.getElementById('ob-inv-add').onclick = function () {
        var em = (document.getElementById('ob-inv-email').value || '').trim().toLowerCase();
        var role = document.getElementById('ob-inv-role').value;
        if (!em || em.indexOf('@') === -1) { setError('Enter a valid email address.'); return; }
        state.invites.push({ email: em, role: role });
        render();
      };
      bodyEl.querySelectorAll('[data-rm-inv]').forEach(function (b) {
        b.onclick = function () { state.invites.splice(Number(b.dataset.rmInv), 1); render(); };
      });
    } else if (step === 5) {
      bodyEl.innerHTML =
        '<h1>Ready to Launch</h1>' +
        '<p class="ob-sub">Review your organisation setup. All data will be strictly isolated to this tenant.</p>' +
        '<div class="ob-summary">' +
          '<div class="ob-summary-box"><span>Organisation</span><strong>' + esc(state.name) + '</strong></div>' +
          '<div class="ob-summary-box"><span>Type &amp; Size</span><strong>' + esc(state.orgType) + ' &middot; ' + esc(state.teamSize) + '</strong></div>' +
          '<div class="ob-summary-box"><span>Location &amp; Timezone</span><strong>' + esc((state.country || 'Global') + ' (' + state.timezone + ')') + '</strong></div>' +
          '<div class="ob-summary-box"><span>Initial Invites</span><strong>' + state.invites.length + ' member(s)</strong></div>' +
          '<div class="ob-summary-box" style="grid-column:1/-1"><span>Enabled Modules</span><strong>' + esc(state.modules.join(', ')) + '</strong></div>' +
        '</div>';
    }
  }

  function captureStep1() {
    state.name = (document.getElementById('ob-name').value || '').trim();
    state.industry = (document.getElementById('ob-industry').value || '').trim();
    state.country = (document.getElementById('ob-country').value || '').trim();
    state.timezone = (document.getElementById('ob-tz').value || 'UTC').trim();
    state.teamSize = document.getElementById('ob-size').value;
    state.website = (document.getElementById('ob-web').value || '').trim();
    state.logoUrl = (document.getElementById('ob-logo').value || '').trim();
    state.description = (document.getElementById('ob-desc').value || '').trim();
  }

  prevBtn.addEventListener('click', function () {
    if (step === 1) return;
    step -= 1;
    render();
  });

  nextBtn.addEventListener('click', function () {
    setError('');
    if (step === 1) {
      captureStep1();
      if (!state.name) { setError('Please enter your Organisation Name.'); return; }
    }
    if (step === 3 && !state.modules.length) {
      setError('Select at least one workspace module.');
      return;
    }
    if (step < 5) {
      step += 1;
      render();
      return;
    }
    nextBtn.disabled = true;
    nextBtn.textContent = 'Launching Workspace…';
    fetch('/api/orgs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.d && res.d.error) || 'Could not create organisation');
        window.location.assign('/dashboard/');
      })
      .catch(function (err) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Launch Workspace →';
        setError(err.message);
      });
  });

  render();
})();
