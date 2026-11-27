/* ==========================================================================
   People & Teams, Visual Org Chart, Expert Finder, Invites & Billing Controller
   (`assets/js/people.js`)
   ========================================================================== */
(function () {
  'use strict';

  var data = null;
  var activeTab = 'directory';
  var root = document.getElementById('ppl-content');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function initials(name) {
    return String(name || 'U').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  }

  function loadDirectory() {
    fetch('/api/orgs/current/directory', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/login/?next=/dashboard/people/'; return null; }
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) return;
        if (d.needsOnboarding || !d.organization) {
          root.innerHTML =
            '<div class="ppl-card" style="text-align:center;padding:42px 24px">' +
              '<h2>No Organisation Yet</h2>' +
              '<p style="color:#64748b;margin:8px 0 18px">Create your first multi-tenant organisation to unlock Departments, Teams, Expert Finder, and Role-Based Access Control.</p>' +
              '<a class="btn btn--blue" href="/onboarding/" style="text-decoration:none">Create Organisation &rarr;</a>' +
            '</div>';
          return;
        }
        data = d;
        renderHeaderAndKpis();
        renderTab();
      });
  }

  function renderHeaderAndKpis() {
    var o = data.organization;
    var a = data.analytics || {};
    document.getElementById('ppl-org-name').textContent = o.name + ' — People & Teams';
    document.getElementById('ppl-org-meta').innerHTML =
      '<span class="ppl-pill ppl-pill--blue">' + esc(o.orgType) + '</span>' +
      '<span class="ppl-pill ppl-pill--green">Role: ' + esc(data.permissions.role) + '</span>' +
      '<span class="ppl-pill">Plan: ' + esc((o.planDetails && o.planDetails.name) || o.plan) + '</span>' +
      (o.clerkOrgId ? '<span class="ppl-pill">Clerk Org Linked ✓</span>' : '');

    document.getElementById('ppl-kpis').innerHTML =
      '<div class="ppl-kpi"><span>Total Users</span><strong>' + a.totalUsers + ' / ' + o.seatLimit + '</strong></div>' +
      '<div class="ppl-kpi"><span>Departments</span><strong>' + a.totalDepartments + '</strong></div>' +
      '<div class="ppl-kpi"><span>Teams</span><strong>' + a.totalTeams + '</strong></div>' +
      '<div class="ppl-kpi"><span>Available Now</span><strong>' + a.availableUsers + '</strong></div>' +
      '<div class="ppl-kpi"><span>Avg Workload</span><strong>' + a.avgWorkload + '%</strong></div>' +
      '<div class="ppl-kpi"><span>Org Memory</span><strong>' + a.totalMemoryAssets + '</strong></div>';
  }

  function renderTab() {
    document.querySelectorAll('.ppl-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === activeTab);
    });
    if (!data) return;
    if (activeTab === 'directory') renderDirectoryTab();
    else if (activeTab === 'orgchart') renderOrgChartTab();
    else if (activeTab === 'experts') renderExpertsTab();
    else if (activeTab === 'invites') renderInvitesTab();
    else if (activeTab === 'memory') renderMemoryTab();
    else if (activeTab === 'billing') renderBillingTab();
  }

  function renderDirectoryTab() {
    var deptMap = Object.fromEntries((data.departments || []).map(function (d) { return [d.id, d.name]; }));
    var teamMap = Object.fromEntries((data.teams || []).map(function (t) { return [t.id, t.name]; }));
    var canManage = data.permissions && data.permissions.canManageRoles;

    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>User Directory &amp; Role Management (' + data.members.length + ')</h2>' +
        '<div class="ppl-grid">' +
          data.members.map(function (m) {
            var allSk = [].concat(m.skills.technical || [], m.skills.business || [], m.skills.research || [], m.skills.tools || []);
            return '<div class="ppl-member">' +
              '<div class="ppl-member__top">' +
                '<span class="ppl-av">' + (m.avatarUrl ? '<img src="' + esc(m.avatarUrl) + '" alt="" />' : esc(initials(m.name))) + '</span>' +
                '<div><span class="ppl-member__name">' + esc(m.name) + '</span><span class="ppl-member__sub">' + esc(m.jobTitle || m.email) + '</span></div>' +
              '</div>' +
              '<div class="ppl-tags">' +
                '<span class="ppl-tag" style="background:#eff6ff;color:#1d4ed8">' + esc(m.role) + '</span>' +
                '<span class="ppl-tag">' + esc(deptMap[m.departmentId] || 'No Dept') + '</span>' +
                '<span class="ppl-tag">' + esc(teamMap[m.teamId] || 'No Team') + '</span>' +
                '<span class="ppl-tag" style="background:#ecfdf5;color:#047857">' + esc(m.availability) + '</span>' +
              '</div>' +
              '<div><small style="color:#64748b;font-size:11.5px">Workload: ' + m.workload + '%</small><div class="ppl-bar"><span style="width:' + m.workload + '%"></span></div></div>' +
              (allSk.length ? '<div class="ppl-tags">' + allSk.slice(0, 6).map(function (s) { return '<span class="ppl-tag">' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
              (canManage ? (
                '<div class="ppl-form-row" style="margin:4px 0 0">' +
                  '<select data-role-user="' + m.userId + '" style="flex:1;min-height:34px;font-size:12.5px">' +
                    data.roles.map(function (r) { return '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
                  '</select>' +
                  '<select data-dept-user="' + m.userId + '" style="flex:1;min-height:34px;font-size:12.5px">' +
                    '<option value="">Department…</option>' +
                    data.departments.map(function (d) { return '<option value="' + esc(d.id) + '"' + (m.departmentId === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') +
                  '</select>' +
                '</div>'
              ) : '') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    root.querySelectorAll('[data-role-user]').forEach(function (sel) {
      sel.onchange = function () {
        fetch('/api/orgs/current/members/' + sel.dataset.roleUser, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: sel.value })
        }).then(loadDirectory);
      };
    });
    root.querySelectorAll('[data-dept-user]').forEach(function (sel) {
      sel.onchange = function () {
        fetch('/api/orgs/current/members/' + sel.dataset.deptUser, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId: sel.value })
        }).then(loadDirectory);
      };
    });
  }

  function renderOrgChartTab() {
    var canDept = data.permissions && data.permissions.canManageDepartments;
    var canTeam = data.permissions && data.permissions.canManageTeams;
    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>Visual Organisational Structure</h2>' +
        (canDept ? (
          '<form id="ppl-add-dept" class="ppl-form-row">' +
            '<input id="dept-name" placeholder="New Department (e.g. Technology, Finance, Research)" style="flex:1" required />' +
            '<button type="submit" class="btn btn--blue">+ Add Department</button>' +
          '</form>'
        ) : '') +
        (canTeam ? (
          '<form id="ppl-add-team" class="ppl-form-row">' +
            '<input id="team-name" placeholder="New Team (e.g. Frontend Team, Sales Team)" style="flex:1" required />' +
            '<select id="team-dept"><option value="">No Department</option>' +
              data.departments.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join('') +
            '</select>' +
            '<button type="submit" class="btn btn--ghost">+ Add Team</button>' +
          '</form>'
        ) : '') +
        '<div style="margin-top:12px">' +
          '<strong>🏢 ' + esc(data.organization.name) + '</strong>' +
          data.departments.map(function (d) {
            var dTeams = data.teams.filter(function (t) { return t.departmentId === d.id; });
            var dMembers = data.members.filter(function (m) { return m.departmentId === d.id; });
            return '<div class="ppl-org-node">' +
              '<strong>🏛️ ' + esc(d.name) + '</strong> <small style="color:#64748b">(' + dMembers.length + ' members, ' + dTeams.length + ' teams)</small>' +
              dTeams.map(function (t) {
                var tMems = data.members.filter(function (m) { return m.teamId === t.id; });
                return '<div class="ppl-team-node"><strong>👥 ' + esc(t.name) + '</strong> <small style="color:#64748b">(' + tMems.length + ' members)</small></div>';
              }).join('') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    var df = document.getElementById('ppl-add-dept');
    if (df) df.onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/orgs/current/departments', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: document.getElementById('dept-name').value })
      }).then(loadDirectory);
    };
    var tf = document.getElementById('ppl-add-team');
    if (tf) tf.onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/orgs/current/teams', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: document.getElementById('team-name').value, departmentId: document.getElementById('team-dept').value })
      }).then(loadDirectory);
    };
  }

  function renderExpertsTab() {
    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>Expert Finder &amp; Skills Directory</h2>' +
        '<p style="color:#64748b;font-size:13.5px;margin:0 0 12px">Search by skill, tool, certification, or research expertise (e.g. React, Convex, Healthcare, Strategy).</p>' +
        '<div class="ppl-form-row">' +
          '<input id="ppl-exp-q" type="search" placeholder="Who knows React, Convex, Payment Integrations, Healthcare Research…?" style="flex:1" />' +
          '<button type="button" class="btn btn--blue" id="ppl-exp-go">Find Experts</button>' +
        '</div>' +
        '<div id="ppl-exp-res" class="ppl-grid"></div>' +
      '</div>';

    function runSearch() {
      var q = document.getElementById('ppl-exp-q').value || '';
      fetch('/api/orgs/current/experts?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var list = (d && d.experts) || [];
          document.getElementById('ppl-exp-res').innerHTML = list.length
            ? list.map(function (m) {
                return '<div class="ppl-member">' +
                  '<div class="ppl-member__top"><span class="ppl-av">' + esc(initials(m.name)) + '</span><div><span class="ppl-member__name">' + esc(m.name) + '</span><span class="ppl-member__sub">' + esc(m.jobTitle || m.role) + ' &middot; ' + esc(m.departmentName) + '</span></div></div>' +
                  '<div class="ppl-tags">' + (m.allSkills.length ? m.allSkills.map(function (s) { return '<span class="ppl-tag">' + esc(s) + '</span>'; }).join('') : '<span class="ppl-tag">Generalist</span>') + '</div>' +
                  '<small style="color:#047857;font-weight:600">' + esc(m.availability) + ' &middot; Workload ' + m.workload + '%</small>' +
                '</div>';
              }).join('')
            : '<p style="color:#64748b">No matching experts found. Members can add skills to their profile.</p>';
        });
    }
    document.getElementById('ppl-exp-go').onclick = runSearch;
    document.getElementById('ppl-exp-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
    runSearch();
  }

  function renderInvitesTab() {
    var canInv = data.permissions && data.permissions.canManageUsers;
    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>Invite Members (Email, Bulk CSV, or Share Link)</h2>' +
        (canInv ? (
          '<form id="ppl-inv-form">' +
            '<div class="ppl-form-row">' +
              '<textarea id="inv-emails" rows="2" placeholder="Enter one or multiple emails separated by commas, spaces, or new lines (CSV paste supported)…" style="flex:1;width:100%"></textarea>' +
            '</div>' +
            '<div class="ppl-form-row">' +
              '<select id="inv-role">' + data.roles.map(function (r) { return '<option value="' + r + '"' + (r === 'MEMBER' ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>' +
              '<select id="inv-dept"><option value="">Assign Department…</option>' + data.departments.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join('') + '</select>' +
              '<select id="inv-team"><option value="">Assign Team…</option>' + data.teams.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('') + '</select>' +
              '<button type="submit" class="btn btn--blue">Send Invitations</button>' +
              '<button type="button" class="btn btn--ghost" id="inv-link-btn">Generate Share Link</button>' +
            '</div>' +
          '</form>'
        ) : '<p style="color:#64748b">Only Owners and Administrators can invite users.</p>') +
        '<h3 style="font-size:14px;margin:16px 0 8px">Recent Invitations (' + data.invitations.length + ')</h3>' +
        (data.invitations.length
          ? data.invitations.map(function (inv) {
              var shareUrl = window.location.origin + '/get-started/?invite=' + encodeURIComponent(inv.token);
              return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px;font-size:13px">' +
                '<span><strong>' + esc(inv.email || 'Share Invite Link') + '</strong> &middot; ' + esc(inv.role) + ' &middot; <em>' + esc(inv.status) + '</em></span>' +
                '<code style="font-size:11.5px;color:#2563eb">' + esc(shareUrl) + '</code>' +
              '</div>';
            }).join('')
          : '<p style="color:#64748b;font-size:13px">No invitations sent yet.</p>') +
      '</div>';

    var f = document.getElementById('ppl-inv-form');
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/orgs/current/invitations', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: document.getElementById('inv-emails').value,
          role: document.getElementById('inv-role').value,
          departmentId: document.getElementById('inv-dept').value,
          teamId: document.getElementById('inv-team').value
        })
      }).then(loadDirectory);
    };
    var lb = document.getElementById('inv-link-btn');
    if (lb) lb.onclick = function () {
      fetch('/api/orgs/current/invitations', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteType: 'link',
          role: document.getElementById('inv-role').value,
          departmentId: document.getElementById('inv-dept').value,
          teamId: document.getElementById('inv-team').value
        })
      }).then(loadDirectory);
    };
  }

  function renderMemoryTab() {
    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>Organisational Memory &amp; Knowledge Feed</h2>' +
        '<form id="ppl-mem-form" class="ppl-form-row">' +
          '<select id="mem-type"><option value="decision">Decision</option><option value="sop">SOP</option><option value="meeting">Meeting</option><option value="research">Research</option><option value="project">Project</option></select>' +
          '<input id="mem-title" placeholder="Capture decision, SOP, meeting outcome, or insight…" style="flex:1" required />' +
          '<button type="submit" class="btn btn--blue">Save to Org Memory</button>' +
        '</form>' +
        data.memory.map(function (k) {
          return '<div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px">' +
            '<span class="ppl-tag" style="background:#eff6ff;color:#1d4ed8">' + esc(k.sourceType) + '</span> ' +
            '<strong>' + esc(k.title) + '</strong>' +
            (k.summary ? '<p style="margin:6px 0 4px;font-size:13px;color:#475569">' + esc(k.summary) + '</p>' : '') +
            '<small style="color:#64748b">By ' + esc(k.authorName) + ' &middot; ' + new Date(k.createdAt).toLocaleString() + '</small>' +
          '</div>';
        }).join('') +
      '</div>';

    document.getElementById('ppl-mem-form').onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/orgs/current/memory', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: document.getElementById('mem-type').value, title: document.getElementById('mem-title').value })
      }).then(loadDirectory);
    };
  }

  function renderBillingTab() {
    var o = data.organization;
    var isOwner = data.permissions && data.permissions.canManageBilling;
    var plans = Object.values(data.plans || {});
    root.innerHTML =
      '<div class="ppl-card">' +
        '<h2>Billing, Subscription Plans &amp; Security</h2>' +
        '<p style="color:#64748b;font-size:13.5px;margin:0 0 14px">Seats used: <strong>' + data.analytics.totalUsers + ' / ' + o.seatLimit + '</strong> &middot; ' + (isOwner ? 'As Owner you can upgrade or downgrade anytime.' : 'Only the Organisation Owner can change plans.') + '</p>' +
        '<div class="ppl-plans">' +
          plans.map(function (p) {
            var cur = o.plan === p.id;
            return '<div class="ppl-plan' + (cur ? ' is-current' : '') + '">' +
              '<strong>' + esc(p.name) + '</strong>' +
              '<div class="ppl-plan__price">$' + p.priceMonthly + '<small style="font-size:12px;font-weight:500;color:#64748b">/user/mo</small></div>' +
              '<small style="color:#475569">Up to ' + p.seatLimit.toLocaleString() + ' seats &middot; ' + (p.sso ? 'SSO + SAML + MFA' : 'Standard Auth + MFA') + '</small>' +
              (isOwner ? '<button type="button" class="btn ' + (cur ? 'btn--ghost' : 'btn--blue') + '" data-plan="' + p.id + '" ' + (cur ? 'disabled' : '') + '>' + (cur ? 'Current Plan' : 'Switch Plan') + '</button>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    root.querySelectorAll('[data-plan]').forEach(function (btn) {
      btn.onclick = function () {
        fetch('/api/orgs/current', {
          method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: btn.dataset.plan })
        }).then(loadDirectory);
      };
    });
  }

  document.querySelectorAll('.ppl-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.dataset.tab;
      renderTab();
    });
  });

  loadDirectory();
})();
