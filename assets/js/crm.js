/* ==========================================================================
   QuantalFlow CRM — Contacts, Pipeline, Conversations, Calendar,
   Automations, Campaigns & Reports (Convex-Backed + Offline-First)
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'qf_crm_v3';

  function initCrmWorkspace() {
    var root = document.getElementById('crm-app');
    if (!root || root.dataset.crmBound === '1') return;
    root.dataset.crmBound = '1';

    var $ = function (s, ctx) { return (ctx || root).querySelector(s); };
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    };
    var uid = function () { return Math.random().toString(36).slice(2, 9); };
    var money = function (n) { return 'ZMW ' + Math.round(Number(n) || 0).toLocaleString('en-US'); };
    var initials = function (n) {
      return String(n || 'U').split(' ').map(function (x) { return x[0] || ''; }).slice(0, 2).join('').toUpperCase();
    };
    var COLORS = ['#2563eb', '#7c3aed', '#0d9488', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#16a34a'];
    var colorOf = function (s) {
      var sum = 0;
      var str = String(s || 'x');
      for (var i = 0; i < str.length; i++) sum += str.charCodeAt(i);
      return COLORS[sum % COLORS.length];
    };
    var ago = function (iso) {
      var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (m < 1) return 'now';
      if (m < 60) return m + 'm';
      if (m < 1440) return Math.round(m / 60) + 'h';
      return Math.round(m / 1440) + 'd';
    };
    var dstr = function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    var daysAgo = function (n) { return new Date(Date.now() - n * 864e5).toISOString(); };
    function toast(m) {
      var t = $('#crm-toast');
      if (!t) return;
      t.textContent = m;
      t.classList.add('show');
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }

    function confirmAction(title, message, confirmLabel, onConfirm) {
      if (window.QFDialog && typeof window.QFDialog.confirm === 'function') {
        window.QFDialog.confirm({
          title: title,
          message: message,
          confirmLabel: confirmLabel || 'Confirm',
          cancelLabel: 'Cancel',
          tone: 'danger'
        }).then(function (ok) { if (ok) onConfirm(); });
      } else {
        onConfirm();
      }
    }

    var STAGES = ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
    var SOURCES = ['Website', 'Facebook Ads', 'Referral', 'WhatsApp', 'Walk-in', 'LinkedIn', 'Event'];
    var OWNERS = ['Owner'];
    var CHANNELS = ['SMS', 'Email', 'WhatsApp'];
    var bookingSlug = 'workspace';

    /* ---------- Auth Hydration ---------- */
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.replace('/login/?next=' + encodeURIComponent('/dashboard/crm/')); return null; }
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d || !d.user) return;
        window.__qfUser = d.user;
        var name = (d.user.name && d.user.name.trim()) ? d.user.name.trim() : (d.user.email || 'Member');
        OWNERS[0] = name;
        bookingSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
        var initEl = document.getElementById('dash-initial');
        if (initEl) {
          var img = d.user.avatar_url || d.user.avatarUrl || d.user.imageUrl || d.user.avatar;
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
        if (tab === 'calendar') render();
      })
      .catch(function () {});

    /* ---------- Data Store + Two-Way Convex Sync ---------- */
    var db = null;
    var localUpdatedAt = 0;
    var syncTimer = null;

    function emptyDb() {
      return { contacts: [], deals: [], messages: [], appts: [], tasks: [], workflows: [], campaigns: [], activity: [], notes: {} };
    }

    function isLegacyDemoData(data) {
      if (!data || !Array.isArray(data.contacts) || data.contacts.length !== 12) return false;
      return Boolean(data.contacts[0] && data.contacts[0].name === 'Chanda Mulenga' && data.contacts[0].company === 'Lusaka Medical Centre');
    }

    function pushToConvex(keepalive) {
      var payload = { data: db, updatedAt: localUpdatedAt || Date.now() };
      if (!navigator.onLine) {
        if (window.QFSyncStatus) {
          window.QFSyncStatus.enqueue('/api/crm', 'PUT', payload);
          window.QFSyncStatus.set('offline');
        }
        return Promise.resolve();
      }
      if (window.QFSyncStatus && !keepalive) window.QFSyncStatus.set('syncing');
      return fetch('/api/crm', {
        method: 'PUT',
        credentials: 'same-origin',
        keepalive: Boolean(keepalive),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          if (r && r.ok && window.QFSyncStatus && !keepalive) window.QFSyncStatus.set('saved');
          return r;
        })
        .catch(function () {
          if (window.QFSyncStatus) window.QFSyncStatus.enqueue('/api/crm', 'PUT', payload);
        });
    }

    function loadLocal() {
      try { localStorage.removeItem('qf_crm_v2'); } catch (e) {}
      try {
        var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (raw && raw.data && Array.isArray(raw.data.contacts) && !isLegacyDemoData(raw.data)) {
          db = raw.data;
          localUpdatedAt = Number(raw.updatedAt) || 0;
          return;
        }
      } catch (e) {}
      db = emptyDb();
    }

    function save() {
      localUpdatedAt = Date.now();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: db, updatedAt: localUpdatedAt })); } catch (e) {}
      if (window.QFSyncStatus) window.QFSyncStatus.set(navigator.onLine ? 'saving' : 'offline');
      clearTimeout(syncTimer);
      syncTimer = setTimeout(function () { pushToConvex(false); }, 650);
    }

    window.addEventListener('beforeunload', function () {
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; pushToConvex(true); }
    });

    function hydrateFromConvex() {
      fetch('/api/crm', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (!res) return;
          if (!res.data || !Array.isArray(res.data.contacts) || isLegacyDemoData(res.data)) {
            if (isLegacyDemoData(res.data)) {
              db = emptyDb();
              localUpdatedAt = Date.now();
              pushToConvex(false);
              render();
            }
            return;
          }
          var remoteTs = Number(res.updatedAt) || 0;
          if (!localUpdatedAt || remoteTs > localUpdatedAt) {
            db = res.data;
            localUpdatedAt = remoteTs;
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: db, updatedAt: localUpdatedAt })); } catch (e) {}
            render();
          } else if (localUpdatedAt > remoteTs) {
            pushToConvex(false);
          }
        })
        .catch(function () {});
    }

    loadLocal();

    var C = function (id) { return db.contacts.find(function (c) { return c.id === id; }); };
    var log = function (t) { db.activity.unshift({ text: t, at: new Date().toISOString() }); db.activity = db.activity.slice(0, 60); };

    /* ---------- Messaging + Automation Engine ---------- */
    function deliver(contactId, channel, text) {
      db.messages.push({ id: uid(), contactId: contactId, channel: channel, dir: 'out', text: text, at: new Date().toISOString() });
    }
    var fill = function (t, c) {
      return String(t || '').replace(/{{name}}/g, (c.name || '').split(' ')[0]).replace(/{{company}}/g, c.company || '');
    };
    function runWorkflow(w, c, sandbox) {
      var out = [];
      w.steps.forEach(function (s, i) {
        var txt = fill(s.text, c);
        if (s.type.indexOf('Send ') === 0) {
          var ch = s.type.replace('Send ', '');
          if (!sandbox) deliver(c.id, ch, txt);
          out.push((i + 1) + '. ' + ch + ' to ' + c.name + ': ' + txt);
        } else if (s.type === 'Add tag') {
          var tg = txt.trim().toLowerCase();
          if (!sandbox && tg && c.tags.indexOf(tg) === -1) c.tags.push(tg);
          out.push((i + 1) + '. Tag added: ' + tg);
        } else if (s.type === 'Create task') {
          if (!sandbox) db.tasks.push({ id: uid(), contactId: c.id, text: txt, due: dstr(new Date(Date.now() + 864e5)), done: false });
          out.push((i + 1) + '. Task created: ' + txt);
        } else if (s.type === 'Notify team') {
          if (!sandbox) toast('Team notified: ' + txt);
          out.push((i + 1) + '. Team notified: ' + txt);
        } else if (s.type === 'Wait') {
          out.push((i + 1) + '. Wait ' + (txt || '1') + ' day(s)');
        }
      });
      if (!sandbox) { w.runs = (w.runs || 0) + 1; log('Automation "' + w.name + '" ran for ' + c.name); }
      return out;
    }
    function fire(ev, c, stage) {
      db.workflows.filter(function (w) { return w.active; }).forEach(function (w) {
        var t = w.trigger;
        if ((ev === 'contact_created' && t.type === 'contact_created') ||
            (ev === 'stage' && t.type === 'stage' && t.stage === stage) ||
            (ev === 'tag' && t.type === 'tag')) {
          runWorkflow(w, c, false);
        }
      });
    }

    /* ---------- Sub-page Router ---------- */
    var TABS = [
      ['dash', 'Dashboard'],
      ['contacts', 'Contacts'],
      ['pipeline', 'Pipeline'],
      ['inbox', 'Conversations'],
      ['calendar', 'Calendar'],
      ['auto', 'Automations'],
      ['camp', 'Campaigns'],
      ['reports', 'Reports']
    ];
    var tab = (location.hash || '#dash').slice(1);
    if (!TABS.find(function (t) { return t[0] === tab; })) tab = 'dash';
    var ui = { q: '', status: '', tag: '', sel: new Set(), conv: null, cal: new Date(), wf: null };

    function go(t) {
      tab = t;
      history.replaceState(null, '', '#' + t);
      if (window.QFHaptics) window.QFHaptics.light();
      render();
    }

    function render() {
      $('#crm-modtabs').innerHTML = TABS.map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (t[0] === tab ? 'true' : 'false') + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="go" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('');
      var views = { dash: vDash, contacts: vContacts, pipeline: vPipeline, inbox: vInbox, calendar: vCalendar, auto: vAuto, camp: vCamp, reports: vReports };
      $('#crm-view').innerHTML = (views[tab] || vDash)();
      if (tab === 'contacts') refreshContacts();
      if (tab === 'inbox') { var m = $('.msgs'); if (m) m.scrollTop = m.scrollHeight; }
    }

    /* ---------- 1. Dashboard ---------- */
    function monthsBack(n) {
      var a = [], t = new Date();
      for (var i = n - 1; i >= 0; i--) {
        var d = new Date(t.getFullYear(), t.getMonth() - i, 1);
        a.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString('en', { month: 'short' }), v: 0 });
      }
      return a;
    }
    function revenueSeries() {
      var s = monthsBack(6);
      db.deals.filter(function (d) { return d.stage === 'Won' && d.closed; }).forEach(function (d) {
        var x = new Date(d.closed);
        var r = s.find(function (k) { return k.y === x.getFullYear() && k.m === x.getMonth(); });
        if (r) r.v += d.value;
      });
      return s;
    }
    function vDash() {
      var open = db.deals.filter(function (d) { return ['Won', 'Lost'].indexOf(d.stage) === -1; });
      var won = db.deals.filter(function (d) { return d.stage === 'Won'; });
      var lost = db.deals.filter(function (d) { return d.stage === 'Lost'; });
      var rate = (won.length + lost.length) ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
      var rev = revenueSeries();
      var mx = Math.max.apply(null, [1].concat(rev.map(function (r) { return r.v; })));
      var fun = STAGES.slice(0, 5).map(function (s) { return { s: s, n: db.deals.filter(function (d) { return d.stage === s; }).length }; });
      var fm = Math.max.apply(null, [1].concat(fun.map(function (f) { return f.n; })));
      var today = dstr(new Date());
      var tk = db.tasks.filter(function (t) { return !t.done; }).sort(function (a, b) { return a.due.localeCompare(b.due); }).slice(0, 5);
      var ap = db.appts.filter(function (a) { return a.date >= today; }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).slice(0, 4);

      return '<div class="crm-grid g4" style="margin-bottom:14px">' +
        '<div class="crm-card kpi"><div class="lbl">Contacts</div><div class="val">' + db.contacts.length + '</div><div class="sub"><span class="up">' + db.contacts.filter(function (c) { return c.status === 'Lead'; }).length + '</span> active leads</div></div>' +
        '<div class="crm-card kpi"><div class="lbl">Open pipeline</div><div class="val">' + money(open.reduce(function (a, d) { return a + d.value; }, 0)) + '</div><div class="sub">' + open.length + ' open deals</div></div>' +
        '<div class="crm-card kpi"><div class="lbl">Revenue won</div><div class="val">' + money(won.reduce(function (a, d) { return a + d.value; }, 0)) + '</div><div class="sub">' + won.length + ' deals won</div></div>' +
        '<div class="crm-card kpi"><div class="lbl">Win rate</div><div class="val">' + rate + '%</div><div class="sub">' + won.length + ' won, ' + lost.length + ' lost</div></div>' +
      '</div>' +
      '<div class="crm-grid g21" style="margin-bottom:14px">' +
        '<div class="crm-card"><h3>Revenue won, last 6 months</h3><div class="bars">' + rev.map(function (r) { return '<div class="b"><em>' + (r.v ? Math.round(r.v / 1000) + 'k' : '') + '</em><i style="height:' + (r.v / mx * 100) + '%"></i><span>' + r.label + '</span></div>'; }).join('') + '</div></div>' +
        '<div class="crm-card"><h3>Pipeline funnel</h3>' + fun.map(function (f) { return '<div class="hbar"><div class="t"><span>' + f.s + '</span><b>' + f.n + '</b></div><div class="tr"><i style="width:' + (f.n / fm * 100) + '%"></i></div></div>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="crm-grid g3">' +
        '<div class="crm-card"><h3>Tasks <button type="button" class="crm-btn sm" data-act="add-task">+ Task</button></h3><div class="list">' + (tk.length ? tk.map(function (t) { var ct = C(t.contactId); return '<div class="it"><input type="checkbox" data-act="task-done" data-id="' + t.id + '"><div><div>' + esc(t.text) + '</div><div class="small muted">' + esc(ct ? ct.name : '') + ' &middot; due ' + t.due + '</div></div></div>'; }).join('') : '<div class="none">No open tasks</div>') + '</div></div>' +
        '<div class="crm-card"><h3>Upcoming appointments <button type="button" class="crm-btn sm" data-act="go" data-v="calendar">Calendar</button></h3><div class="list">' + (ap.length ? ap.map(function (a) { var ct = C(a.contactId); return '<div class="it"><span class="dot"></span><div><b>' + esc(a.title) + '</b><div class="small muted">' + a.date + ' ' + a.time + ' &middot; ' + esc(ct ? ct.name : '') + '</div></div></div>'; }).join('') : '<div class="none">Nothing booked</div>') + '</div></div>' +
        '<div class="crm-card"><h3>Recent activity</h3><div class="list">' + (db.activity.length ? db.activity.slice(0, 6).map(function (a) { return '<div class="it"><span class="dot"></span><div>' + esc(a.text) + '<div class="small muted">' + ago(a.at) + ' ago</div></div></div>'; }).join('') : '<div class="none">No activity yet</div>') + '</div></div>' +
      '</div>';
    }

    /* ---------- 2. Contacts ---------- */
    function vContacts() {
      var tags = Array.from(new Set(db.contacts.reduce(function (a, c) { return a.concat(c.tags || []); }, []))).sort();
      return '<div class="toolbar">' +
        '<input data-bind="q" placeholder="Search name, company, email, phone" value="' + esc(ui.q) + '">' +
        '<select data-bind="status"><option value="">All statuses</option>' + ['Lead', 'Customer', 'Inactive'].map(function (s) { return '<option ' + (ui.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<select data-bind="tag"><option value="">All tags</option>' + tags.map(function (s) { return '<option ' + (ui.tag === s ? 'selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
        '<span class="sp"></span>' +
        '<button type="button" class="crm-btn" data-act="bulk-tag">Tag selected</button>' +
        '<button type="button" class="crm-btn" data-act="bulk-msg">Message selected</button>' +
        '<button type="button" class="crm-btn danger" data-act="bulk-del">Delete selected</button>' +
        '<button type="button" class="crm-btn" data-act="import">Import CSV</button>' +
        '<button type="button" class="crm-btn" data-act="export">Export CSV</button>' +
        '<input type="file" id="crm-csvfile" accept=".csv" style="display:none">' +
      '</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" data-act="sel-all" aria-label="Select all contacts"></th><th>Contact</th><th>Company</th><th>Status</th><th>Tags</th><th>Source</th><th>Score</th><th>Owner</th><th>Added</th></tr></thead><tbody id="crm-ct-body"></tbody></table></div>' +
      '<div class="small muted" id="crm-ct-count" style="margin-top:8px"></div>';
    }
    function filteredContacts() {
      var q = ui.q.toLowerCase();
      return db.contacts.filter(function (c) {
        return (!q || [c.name, c.company, c.email, c.phone].join(' ').toLowerCase().indexOf(q) !== -1) &&
          (!ui.status || c.status === ui.status) &&
          (!ui.tag || (c.tags || []).indexOf(ui.tag) !== -1);
      });
    }
    var scoreColor = function (s) { return s >= 70 ? 'var(--crm-green)' : s >= 40 ? 'var(--crm-amber)' : 'var(--crm-red)'; };
    function refreshContacts() {
      var l = filteredContacts();
      var body = $('#crm-ct-body');
      if (!body) return;
      body.innerHTML = l.length ? l.map(function (c) {
        return '<tr class="row" data-act="open-contact" data-id="' + c.id + '">' +
          '<td data-stop="1"><input type="checkbox" data-act="sel" data-id="' + c.id + '" ' + (ui.sel.has(c.id) ? 'checked' : '') + '></td>' +
          '<td><div class="who"><span class="av" style="background:' + colorOf(c.name) + '">' + initials(c.name) + '</span><div><b>' + esc(c.name) + '</b><small>' + esc(c.email) + '</small></div></div></td>' +
          '<td>' + esc(c.company) + '</td>' +
          '<td><span class="badge ' + (c.status === 'Customer' ? 'b-green' : c.status === 'Lead' ? 'b-blue' : '') + '">' + esc(c.status) + '</span></td>' +
          '<td>' + (c.tags || []).map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</td>' +
          '<td>' + esc(c.source) + '</td>' +
          '<td><span class="score"><i><b style="width:' + c.score + '%;background:' + scoreColor(c.score) + '"></b></i>' + c.score + '</span></td>' +
          '<td>' + esc(c.owner) + '</td><td class="muted">' + ago(c.created) + '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="none">No contacts match the filters.</td></tr>';
      var cnt = $('#crm-ct-count');
      if (cnt) cnt.textContent = l.length + ' of ' + db.contacts.length + ' contacts';
    }
    function contactForm(c) {
      c = c || { name: '', company: '', email: '', phone: '', source: 'Website', tags: [], owner: OWNERS[0], status: 'Lead', score: 50 };
      return '<div class="two"><div class="fld"><label>Full name *</label><input name="name" required value="' + esc(c.name) + '"></div><div class="fld"><label>Company</label><input name="company" value="' + esc(c.company) + '"></div></div>' +
        '<div class="two"><div class="fld"><label>Email</label><input name="email" type="email" value="' + esc(c.email) + '"></div><div class="fld"><label>Phone</label><input name="phone" value="' + esc(c.phone) + '"></div></div>' +
        '<div class="two"><div class="fld"><label>Source</label><select name="source">' + SOURCES.map(function (s) { return '<option ' + (c.source === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="fld"><label>Owner</label><select name="owner">' + OWNERS.map(function (s) { return '<option ' + (c.owner === s ? 'selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="two"><div class="fld"><label>Status</label><select name="status">' + ['Lead', 'Customer', 'Inactive'].map(function (s) { return '<option ' + (c.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="fld"><label>Lead score (0 to 100)</label><input name="score" type="number" min="0" max="100" value="' + c.score + '"></div></div>' +
        '<div class="fld"><label>Tags (comma separated)</label><input name="tags" value="' + esc((c.tags || []).join(', ')) + '"></div>';
    }
    var parseTags = function (s) { return Array.from(new Set(String(s || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean))); };

    /* ---------- Contact 360 Drawer ---------- */
    function openContact(id) {
      var c = C(id); if (!c) return;
      var deals = db.deals.filter(function (d) { return d.contactId === id; });
      var tasks = db.tasks.filter(function (t) { return t.contactId === id; });
      var tl = db.messages.filter(function (m) { return m.contactId === id; }).map(function (m) {
        return { at: m.at, t: (m.dir === 'in' ? 'Received ' : 'Sent ') + m.channel + ': ' + m.text };
      }).concat(db.appts.filter(function (a) { return a.contactId === id; }).map(function (a) {
        return { at: a.date + 'T' + a.time, t: 'Appointment: ' + a.title + ' (' + a.date + ' ' + a.time + ')' };
      })).sort(function (a, b) { return b.at.localeCompare(a.at); });

      $('#crm-drawer').innerHTML =
        '<div class="hd"><span class="av" style="background:' + colorOf(c.name) + ';width:46px;height:46px;font-size:15px">' + initials(c.name) + '</span><div style="flex:1"><b style="font-size:16px">' + esc(c.name) + '</b><div class="muted small">' + esc(c.company) + '</div></div><button type="button" class="crm-btn sm" data-act="close-drawer">Close</button></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="crm-btn sm primary" data-act="msg-contact" data-id="' + id + '">Message</button><button type="button" class="crm-btn sm" data-act="book" data-id="' + id + '">Book appointment</button><button type="button" class="crm-btn sm" data-act="add-deal" data-id="' + id + '">Add deal</button><button type="button" class="crm-btn sm" data-act="edit-contact" data-id="' + id + '">Edit</button><button type="button" class="crm-btn sm danger" data-act="del-contact" data-id="' + id + '">Delete</button></div>' +
        '<h3>Details</h3><div class="kv"><span>Email</span><span>' + (esc(c.email) || '-') + '</span><span>Phone</span><span>' + (esc(c.phone) || '-') + '</span><span>Status</span><span>' + esc(c.status) + '</span><span>Source</span><span>' + esc(c.source) + '</span><span>Owner</span><span>' + esc(c.owner) + '</span><span>Lead score</span><span>' + c.score + '</span><span>Tags</span><span>' + ((c.tags || []).map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') || '-') + '</span></div>' +
        '<h3>Deals</h3>' + (deals.length ? deals.map(function (d) { return '<div style="padding:6px 0;font-size:12.5px"><b>' + esc(d.title) + '</b> &middot; ' + money(d.value) + ' &middot; <span class="badge b-blue">' + esc(d.stage) + '</span></div>'; }).join('') : '<div class="muted small">No deals</div>') +
        '<h3>Tasks</h3>' + (tasks.length ? tasks.map(function (t) { return '<div style="font-size:12.5px;padding:4px 0"><input type="checkbox" data-act="task-done" data-id="' + t.id + '" ' + (t.done ? 'checked' : '') + '> ' + esc(t.text) + ' <span class="muted small">(' + t.due + ')</span></div>'; }).join('') : '<div class="muted small">No tasks</div>') +
        '<h3>Notes</h3><div class="fld"><textarea id="crm-note-box" placeholder="Write a note...">' + esc((db.notes && db.notes[id]) || '') + '</textarea></div><button type="button" class="crm-btn sm" data-act="save-note" data-id="' + id + '">Save note</button>' +
        '<h3>Timeline</h3><div class="tl">' + (tl.length ? tl.map(function (x) { return '<div class="it">' + esc(x.t) + '</div>'; }).join('') : '<div class="muted small">No activity yet</div>') + '</div>';
      $('#crm-drawer').classList.add('show');
    }

    /* ---------- 3. Pipeline ---------- */
    function vPipeline() {
      return '<div class="toolbar"><span class="muted small">Drag a deal card to another column. Moving a deal triggers any matching active automation.</span><span class="sp"></span><button type="button" class="crm-btn primary" data-act="add-deal">+ Add Deal</button></div>' +
        '<div class="kanban">' + STAGES.map(function (s) {
          var ds = db.deals.filter(function (d) { return d.stage === s; });
          return '<div class="col" data-stage="' + s + '"><h4><span>' + s + '</span><span>' + ds.length + '</span></h4><div class="tot">' + money(ds.reduce(function (a, d) { return a + d.value; }, 0)) + '</div>' +
            ds.map(function (d) {
              var c = C(d.contactId);
              return '<div class="deal" draggable="true" data-id="' + d.id + '"><b>' + esc(d.title) + '</b><div class="v">' + money(d.value) + '</div><div class="ft"><span>' + esc(c ? c.name : '') + '</span><span class="av" style="background:' + colorOf(c ? c.name : 'x') + ';width:22px;height:22px;font-size:9px">' + (c ? initials(c.name) : '') + '</span></div></div>';
            }).join('') + '</div>';
        }).join('') + '</div>';
    }

    /* ---------- 4. Conversations ---------- */
    function threads() {
      var m = {};
      db.messages.forEach(function (x) { (m[x.contactId] = m[x.contactId] || []).push(x); });
      return Object.keys(m).map(function (id) {
        return { id: id, a: m[id].sort(function (x, y) { return x.at.localeCompare(y.at); }) };
      }).filter(function (t) { return Boolean(C(t.id)); }).sort(function (x, y) {
        return y.a[y.a.length - 1].at.localeCompare(x.a[x.a.length - 1].at);
      });
    }
    var SNIPPETS = ['Thank you for your interest. How can we help?', 'Can we schedule a call this week?', 'Your quotation is attached. Please review.', 'We have received your payment. Thank you.'];
    function vInbox() {
      var th = threads();
      if (!ui.conv || !C(ui.conv)) ui.conv = th[0] ? th[0].id : null;
      var cur = ui.conv ? C(ui.conv) : null;
      var msgs = ui.conv ? db.messages.filter(function (m) { return m.contactId === ui.conv; }).sort(function (a, b) { return a.at.localeCompare(b.at); }) : [];
      return '<div class="toolbar"><span class="muted small">Unified inbox for SMS, Email, and WhatsApp</span><span class="sp"></span><button type="button" class="crm-btn primary" data-act="new-convo">+ New Message</button></div>' +
        '<div class="inbox">' +
          '<div class="lst">' + (th.length ? th.map(function (t) {
            var c = C(t.id), l = t.a[t.a.length - 1];
            return '<div class="conv ' + (t.id === ui.conv ? 'on' : '') + '" data-act="pick-conv" data-id="' + t.id + '"><span class="av" style="background:' + colorOf(c.name) + '">' + initials(c.name) + '</span><div class="tx"><b><span>' + esc(c.name) + '</span><span class="muted small">' + ago(l.at) + '</span></b><p>' + (l.dir === 'out' ? 'You: ' : '') + esc(l.text) + '</p></div></div>';
          }).join('') : '<div class="none">No conversations yet</div>') + '</div>' +
          '<div class="thread">' + (cur
            ? '<div class="hd"><span>' + esc(cur.name) + ' <span class="badge">' + esc(cur.phone) + '</span></span><button type="button" class="crm-btn sm" data-act="open-contact" data-id="' + cur.id + '">View contact</button></div>' +
              '<div class="msgs">' + msgs.map(function (m) { return '<div class="msg ' + m.dir + '">' + esc(m.text) + '<small>' + esc(m.channel) + ' &middot; ' + ago(m.at) + ' ago</small></div>'; }).join('') + '</div>' +
              '<div class="composer"><div class="r"><select id="crm-cv-ch">' + CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select><select id="crm-cv-snip"><option value="">Snippets</option>' + SNIPPETS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
              '<div class="r"><input id="crm-cv-text" placeholder="Type a message"><button type="button" class="crm-btn primary" data-act="send-msg">Send</button></div></div>'
            : '<div class="none" style="margin:auto">Select or start a conversation</div>') + '</div>' +
          '<div class="info">' + (cur
            ? '<b style="font-size:14px">' + esc(cur.name) + '</b><div class="muted">' + esc(cur.company) + '</div><dl><dt>Email</dt><dd>' + esc(cur.email) + '</dd><dt>Phone</dt><dd>' + esc(cur.phone) + '</dd><dt>Status</dt><dd>' + esc(cur.status) + '</dd><dt>Tags</dt><dd>' + (cur.tags || []).map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</dd><dt>Open deals</dt><dd>' + (db.deals.filter(function (d) { return d.contactId === cur.id && ['Won', 'Lost'].indexOf(d.stage) === -1; }).map(function (d) { return esc(d.title) + ' (' + money(d.value) + ')'; }).join('<br>') || 'None') + '</dd></dl>'
            : '') + '</div>' +
        '</div>';
    }

    /* ---------- 5. Calendar ---------- */
    function vCalendar() {
      var y = ui.cal.getFullYear(), m = ui.cal.getMonth(), first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), today = dstr(new Date());
      var cells = '';
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var ds = dstr(d);
        var ap = db.appts.filter(function (a) { return a.date === ds; }).sort(function (a, b) { return a.time.localeCompare(b.time); });
        cells += '<div class="day ' + (d.getMonth() !== m ? 'out' : '') + ' ' + (ds === today ? 'today' : '') + '" data-act="day" data-d="' + ds + '"><span class="n">' + d.getDate() + '</span>' + ap.map(function (a) { return '<div class="ap" data-act="appt" data-id="' + a.id + '">' + esc(a.time) + ' ' + esc(a.title) + '</div>'; }).join('') + '</div>';
      }
      return '<div class="cal-h"><div style="display:flex;gap:6px;align-items:center"><button type="button" class="crm-btn sm" data-act="cal-prev">&lt;</button><button type="button" class="crm-btn sm" data-act="cal-today">Today</button><button type="button" class="crm-btn sm" data-act="cal-next">&gt;</button><b style="margin-left:10px;font-size:15px">' + ui.cal.toLocaleString('en', { month: 'long', year: 'numeric' }) + '</b></div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="muted small">Booking link:</span><code style="font-size:12px">/book/' + esc(bookingSlug) + '</code><button type="button" class="crm-btn sm" data-act="copy-book">Copy</button><button type="button" class="crm-btn sm primary" data-act="book">+ Appointment</button></div></div>' +
        '<div class="cal">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) { return '<div class="dh">' + d + '</div>'; }).join('') + cells + '</div>';
    }

    /* ---------- 6. Automations ---------- */
    var STEP_TYPES = ['Send SMS', 'Send Email', 'Send WhatsApp', 'Add tag', 'Create task', 'Notify team', 'Wait'];
    var trigLabel = function (t) { return t.type === 'contact_created' ? 'Contact is created' : t.type === 'stage' ? ('Deal moves to ' + t.stage) : 'Tag is added'; };
    function vAuto() {
      if (!ui.wf || !db.workflows.find(function (w) { return w.id === ui.wf; })) ui.wf = db.workflows[0] ? db.workflows[0].id : null;
      var w = db.workflows.find(function (x) { return x.id === ui.wf; });
      return '<div class="wf-wrap"><div><button type="button" class="crm-btn primary" style="width:100%;margin-bottom:10px" data-act="new-wf">+ New Workflow</button>' +
        db.workflows.map(function (x) {
          return '<div class="wf-item ' + (x.id === ui.wf ? 'on' : '') + '" data-act="pick-wf" data-id="' + x.id + '"><div><b>' + esc(x.name) + '</b><small>' + esc(trigLabel(x.trigger)) + ' &middot; ' + x.steps.length + ' steps &middot; ' + (x.runs || 0) + ' runs</small></div><button type="button" class="sw ' + (x.active ? 'on' : '') + '" data-act="toggle-wf" data-id="' + x.id + '" title="Toggle workflow"></button></div>';
        }).join('') + '</div>' +
        '<div class="crm-card" style="background:#f9fafb">' + (w
          ? '<div class="toolbar"><input data-wf="name" value="' + esc(w.name) + '" style="flex:1"><button type="button" class="crm-btn" data-act="test-wf">Test run</button><button type="button" class="crm-btn danger" data-act="del-wf">Delete</button></div>' +
            '<div class="node trig"><div class="tag" style="color:var(--crm-blue)">Trigger</div><div class="r"><select data-wf="ttype"><option value="contact_created" ' + (w.trigger.type === 'contact_created' ? 'selected' : '') + '>Contact is created</option><option value="stage" ' + (w.trigger.type === 'stage' ? 'selected' : '') + '>Deal moves to stage</option><option value="tag" ' + (w.trigger.type === 'tag' ? 'selected' : '') + '>Tag is added</option></select>' +
            (w.trigger.type === 'stage' ? '<select data-wf="tstage">' + STAGES.map(function (s) { return '<option ' + (w.trigger.stage === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' : '') + '</div></div>' +
            w.steps.map(function (s, i) {
              return '<div class="link"></div><div class="node"><div class="tag" style="color:var(--crm-violet)">Action ' + (i + 1) + '</div><div class="r"><select data-wf="stype" data-i="' + i + '">' + STEP_TYPES.map(function (t) { return '<option ' + (s.type === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') + '</select><button type="button" class="crm-btn sm danger" data-act="del-step" data-i="' + i + '">Remove</button></div><input data-wf="stext" data-i="' + i + '" value="' + esc(s.text) + '" placeholder="' + (s.type === 'Add tag' ? 'Tag name' : s.type === 'Wait' ? 'Number of days' : 'Message or task text. Use {{name}} and {{company}}') + '"></div>';
            }).join('') +
            '<div class="link"></div><button type="button" class="addstep" data-act="add-step">+ Add action</button><div id="crm-wf-log"></div>'
          : '<div class="none">Create a workflow to begin.</div>') + '</div></div>';
    }

    /* ---------- 7. Campaigns ---------- */
    function vCamp() {
      return '<div class="toolbar"><span class="muted small">Send bulk SMS, Email, or WhatsApp messages to a tagged audience</span><span class="sp"></span><button type="button" class="crm-btn primary" data-act="new-camp">+ New Campaign</button></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Campaign</th><th>Channel</th><th>Audience</th><th>Status</th><th>Sent</th><th>Opened</th><th>Clicked</th><th></th></tr></thead><tbody>' +
        (db.campaigns.length ? db.campaigns.map(function (c) {
          return '<tr><td><b>' + esc(c.name) + '</b><div class="small muted">' + esc(c.subject) + '</div></td><td>' + esc(c.channel) + '</td><td>' + (c.tag ? 'Tag: ' + esc(c.tag) : 'All contacts') + '</td><td><span class="badge ' + (c.status === 'Sent' ? 'b-green' : 'b-amber') + '">' + esc(c.status) + '</span></td><td>' + c.sent + '</td><td>' + (c.sent ? Math.round((c.opened / c.sent) * 100) + '%' : '-') + '</td><td>' + (c.sent ? Math.round((c.clicked / c.sent) * 100) + '%' : '-') + '</td><td>' + (c.status === 'Draft' ? '<button type="button" class="crm-btn sm primary" data-act="send-camp" data-id="' + c.id + '">Send now</button> ' : '') + '<button type="button" class="crm-btn sm danger" data-act="del-camp" data-id="' + c.id + '">Delete</button></td></tr>';
        }).join('') : '<tr><td colspan="8" class="none">No campaigns yet</td></tr>') + '</tbody></table></div>';
    }

    /* ---------- 8. Reports ---------- */
    function vReports() {
      var won = db.deals.filter(function (d) { return d.stage === 'Won'; }), all = db.deals;
      var bySrc = SOURCES.map(function (s) {
        var cs = db.contacts.filter(function (c) { return c.source === s; }).map(function (c) { return c.id; });
        var w = won.filter(function (d) { return cs.indexOf(d.contactId) !== -1; });
        return { s: s, n: cs.length, rev: w.reduce(function (a, d) { return a + d.value; }, 0) };
      });
      var mxS = Math.max.apply(null, [1].concat(bySrc.map(function (x) { return x.n; })));
      var byOwn = OWNERS.map(function (o) {
        var cs = db.contacts.filter(function (c) { return c.owner === o; }).map(function (c) { return c.id; });
        var w = won.filter(function (d) { return cs.indexOf(d.contactId) !== -1; });
        return { o: o, n: cs.length, w: w.length, rev: w.reduce(function (a, d) { return a + d.value; }, 0) };
      });
      var fun = STAGES.slice(0, 5).map(function (s, i) {
        return { s: s, n: all.filter(function (d) { return (STAGES.indexOf(d.stage) >= i && d.stage !== 'Lost') || (d.stage === 'Lost' && i === 0); }).length };
      });
      var avg = won.length ? won.reduce(function (a, d) { return a + d.value; }, 0) / won.length : 0;
      var rev = revenueSeries();
      var mx = Math.max.apply(null, [1].concat(rev.map(function (r) { return r.v; })));

      return '<div class="toolbar"><span class="sp"></span><button type="button" class="crm-btn" data-act="export-deals">Export deals CSV</button></div>' +
        '<div class="crm-grid g4" style="margin-bottom:14px">' +
          '<div class="crm-card kpi"><div class="lbl">Average deal size</div><div class="val">' + money(avg) + '</div></div>' +
          '<div class="crm-card kpi"><div class="lbl">Total deals</div><div class="val">' + all.length + '</div></div>' +
          '<div class="crm-card kpi"><div class="lbl">Messages sent</div><div class="val">' + db.messages.filter(function (m) { return m.dir === 'out'; }).length + '</div></div>' +
          '<div class="crm-card kpi"><div class="lbl">Automation runs</div><div class="val">' + db.workflows.reduce(function (a, w) { return a + (w.runs || 0); }, 0) + '</div></div>' +
        '</div>' +
        '<div class="crm-grid g2" style="margin-bottom:14px">' +
          '<div class="crm-card"><h3>Leads by source</h3>' + bySrc.map(function (x) { return '<div class="hbar"><div class="t"><span>' + x.s + '</span><span><b>' + x.n + '</b> leads &middot; ' + money(x.rev) + ' won</span></div><div class="tr"><i style="width:' + (x.n / mxS * 100) + '%"></i></div></div>'; }).join('') + '</div>' +
          '<div class="crm-card"><h3>Revenue won by month</h3><div class="bars">' + rev.map(function (r) { return '<div class="b"><em>' + (r.v ? Math.round(r.v / 1000) + 'k' : '') + '</em><i style="height:' + (r.v / mx * 100) + '%"></i><span>' + r.label + '</span></div>'; }).join('') + '</div></div>' +
        '</div>' +
        '<div class="crm-grid g2">' +
          '<div class="crm-card"><h3>Team performance</h3><table><thead><tr><th>Owner</th><th>Contacts</th><th>Won</th><th>Revenue</th></tr></thead><tbody>' + byOwn.map(function (x) { return '<tr><td>' + esc(x.o) + '</td><td>' + x.n + '</td><td>' + x.w + '</td><td>' + money(x.rev) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="crm-card"><h3>Stage conversion</h3>' + fun.map(function (f, i) { return '<div class="hbar"><div class="t"><span>' + f.s + '</span><span><b>' + f.n + '</b>' + (i ? (' &middot; ' + (fun[i - 1].n ? Math.round((f.n / fun[i - 1].n) * 100) : 0) + '% of previous') : '') + '</span></div><div class="tr"><i style="width:' + (fun[0].n ? (f.n / fun[0].n * 100) : 0) + '%"></i></div></div>'; }).join('') + '</div>' +
        '</div>';
    }

    /* ---------- Modal & Helpers ---------- */
    function openModal(title, body, onSubmit, okLabel) {
      $('#crm-modal').innerHTML = '<h2>' + esc(title) + '</h2><form id="crm-mform">' + body + '<div class="mfoot"><button type="button" class="crm-btn" data-act="close-modal">Cancel</button><button class="crm-btn primary" type="submit">' + esc(okLabel || 'Save') + '</button></div></form>';
      $('#crm-overlay').classList.add('show');
      $('#crm-mform').onsubmit = function (e) {
        e.preventDefault();
        var fd = new FormData(e.target);
        var obj = {};
        fd.forEach(function (v, k) { obj[k] = v; });
        onSubmit(obj);
      };
      var first = $('#crm-modal input, #crm-modal select, #crm-modal textarea');
      if (first) first.focus();
    }
    var closeModal = function () { $('#crm-overlay').classList.remove('show'); };
    var closeDrawer = function () { $('#crm-drawer').classList.remove('show'); };
    var contactOptions = function (sel) {
      return db.contacts.map(function (c) { return '<option value="' + c.id + '" ' + (sel === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    };
    var wf = function () { return db.workflows.find(function (w) { return w.id === ui.wf; }); };
    function afterChange() { save(); render(); }

    function bookForm(cid, date) {
      openModal('Book appointment',
        '<div class="fld"><label>Contact</label><select name="cid">' + contactOptions(cid) + '</select></div>' +
        '<div class="fld"><label>Title</label><input name="title" required value="Meeting"></div>' +
        '<div class="two"><div class="fld"><label>Date</label><input name="date" type="date" value="' + date + '" required></div><div class="fld"><label>Time</label><input name="time" type="time" value="10:00" required></div></div>' +
        '<div class="fld"><label>Duration (minutes)</label><input name="dur" type="number" value="30" min="5"></div>',
        function (f) {
          db.appts.push({ id: uid(), contactId: f.cid, title: f.title, date: f.date, time: f.time, duration: +f.dur || 30 });
          var c = C(f.cid);
          if (c) {
            log('Appointment booked with ' + c.name);
            deliver(c.id, 'SMS', 'Hello ' + c.name.split(' ')[0] + ', your appointment "' + f.title + '" is booked for ' + f.date + ' at ' + f.time + '.');
          }
          closeModal(); afterChange(); toast('Appointment booked and confirmation sent');
        });
    }

    function csv(name, rows) {
      var t = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
    }

    var A = {
      go: function (el) { go(el.dataset.v); },
      'close-modal': closeModal,
      'close-drawer': closeDrawer,
      'add-contact': function () {
        openModal('Add contact', contactForm(), function (f) {
          var c = { id: 'c' + uid(), name: f.name.trim(), company: f.company, email: f.email, phone: f.phone, source: f.source, tags: parseTags(f.tags), score: +f.score || 0, owner: f.owner, status: f.status, created: new Date().toISOString() };
          db.contacts.unshift(c); log('Contact ' + c.name + ' added'); fire('contact_created', c); closeModal(); afterChange(); toast('Contact added');
        });
      },
      'open-contact': function (el) { openContact(el.dataset.id); },
      'edit-contact': function (el) {
        var c = C(el.dataset.id); if (!c) return;
        openModal('Edit contact', contactForm(c), function (f) {
          Object.assign(c, { name: f.name.trim(), company: f.company, email: f.email, phone: f.phone, source: f.source, owner: f.owner, status: f.status, score: +f.score || 0, tags: parseTags(f.tags) });
          closeModal(); save(); render(); openContact(c.id); toast('Contact updated');
        });
      },
      'del-contact': function (el) {
        var c = C(el.dataset.id); if (!c) return;
        confirmAction('Delete contact?', 'Delete ' + c.name + ' and all related deals, tasks, and messages?', 'Delete', function () {
          db.contacts = db.contacts.filter(function (x) { return x.id !== c.id; });
          db.deals = db.deals.filter(function (d) { return d.contactId !== c.id; });
          db.messages = db.messages.filter(function (m) { return m.contactId !== c.id; });
          db.tasks = db.tasks.filter(function (t) { return t.contactId !== c.id; });
          db.appts = db.appts.filter(function (a) { return a.contactId !== c.id; });
          closeDrawer(); afterChange(); toast('Contact deleted');
        });
      },
      'save-note': function (el) { db.notes = db.notes || {}; db.notes[el.dataset.id] = $('#crm-note-box').value; save(); toast('Note saved'); },
      sel: function (el) { if (el.checked) ui.sel.add(el.dataset.id); else ui.sel.delete(el.dataset.id); },
      'sel-all': function (el) { filteredContacts().forEach(function (c) { if (el.checked) ui.sel.add(c.id); else ui.sel.delete(c.id); }); refreshContacts(); },
      'bulk-del': function () {
        if (!ui.sel.size) return toast('Select contacts first');
        confirmAction('Delete selected contacts?', 'Permanently delete ' + ui.sel.size + ' selected contacts and their deals/messages?', 'Delete', function () {
          var s = ui.sel;
          db.contacts = db.contacts.filter(function (c) { return !s.has(c.id); });
          db.deals = db.deals.filter(function (d) { return !s.has(d.contactId); });
          db.messages = db.messages.filter(function (m) { return !s.has(m.contactId); });
          ui.sel = new Set(); afterChange(); toast('Contacts deleted');
        });
      },
      'bulk-tag': function () {
        if (!ui.sel.size) return toast('Select contacts first');
        openModal('Tag selected contacts', '<div class="fld"><label>Tag</label><input name="tag" required></div>', function (f) {
          var t = f.tag.trim().toLowerCase();
          db.contacts.filter(function (c) { return ui.sel.has(c.id); }).forEach(function (c) { if (c.tags.indexOf(t) === -1) { c.tags.push(t); fire('tag', c); } });
          closeModal(); afterChange(); toast('Tag applied');
        });
      },
      'bulk-msg': function () {
        if (!ui.sel.size) return toast('Select contacts first');
        openModal('Message selected contacts', '<div class="fld"><label>Channel</label><select name="ch">' + CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div><div class="fld"><label>Message (use {{name}})</label><textarea name="text" required></textarea></div>', function (f) {
          db.contacts.filter(function (c) { return ui.sel.has(c.id); }).forEach(function (c) { deliver(c.id, f.ch, fill(f.text, c)); });
          log('Bulk ' + f.ch + ' sent to ' + ui.sel.size + ' contacts');
          closeModal(); afterChange(); toast('Messages sent');
        }, 'Send');
      },
      export: function () {
        csv('contacts.csv', [['Name', 'Company', 'Email', 'Phone', 'Source', 'Status', 'Tags', 'Score', 'Owner']].concat(db.contacts.map(function (c) { return [c.name, c.company, c.email, c.phone, c.source, c.status, (c.tags || []).join('|'), c.score, c.owner]; })));
      },
      'export-deals': function () {
        csv('deals.csv', [['Title', 'Contact', 'Value', 'Stage']].concat(db.deals.map(function (d) { var ct = C(d.contactId); return [d.title, ct ? ct.name : '', d.value, d.stage]; })));
      },
      import: function () { var f = $('#crm-csvfile'); if (f) f.click(); },
      'add-deal': function (el) {
        openModal('Add deal',
          '<div class="fld"><label>Contact</label><select name="cid">' + contactOptions(el && el.dataset && el.dataset.id) + '</select></div>' +
          '<div class="fld"><label>Deal title</label><input name="title" required></div>' +
          '<div class="two"><div class="fld"><label>Value (ZMW)</label><input name="value" type="number" min="0" value="0"></div><div class="fld"><label>Stage</label><select name="stage">' + STAGES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div></div>',
          function (f) {
            var d = { id: 'd' + uid(), contactId: f.cid, title: f.title, value: +f.value || 0, stage: f.stage, created: new Date().toISOString(), closed: ['Won', 'Lost'].indexOf(f.stage) !== -1 ? new Date().toISOString() : null };
            db.deals.push(d); log('Deal ' + d.title + ' created');
            var c = C(d.contactId); if (c) fire('stage', c, d.stage);
            closeModal(); afterChange(); toast('Deal added');
          });
      },
      'add-task': function () {
        openModal('Add task',
          '<div class="fld"><label>Contact</label><select name="cid">' + contactOptions() + '</select></div>' +
          '<div class="fld"><label>Task</label><input name="text" required></div>' +
          '<div class="fld"><label>Due date</label><input name="due" type="date" value="' + dstr(new Date()) + '"></div>',
          function (f) { db.tasks.push({ id: uid(), contactId: f.cid, text: f.text, due: f.due, done: false }); closeModal(); afterChange(); });
      },
      'task-done': function (el) {
        var t = db.tasks.find(function (x) { return x.id === el.dataset.id; });
        if (t) { t.done = el.checked; log('Task completed: ' + t.text); save(); if (tab === 'dash') render(); }
      },
      'msg-contact': function (el) { ui.conv = el.dataset.id; closeDrawer(); go('inbox'); },
      'pick-conv': function (el) { ui.conv = el.dataset.id; render(); },
      'new-convo': function () {
        openModal('New message',
          '<div class="fld"><label>Contact</label><select name="cid">' + contactOptions() + '</select></div>' +
          '<div class="fld"><label>Channel</label><select name="ch">' + CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
          '<div class="fld"><label>Message</label><textarea name="text" required></textarea></div>',
          function (f) { deliver(f.cid, f.ch, f.text); ui.conv = f.cid; closeModal(); afterChange(); }, 'Send');
      },
      'send-msg': function () {
        var inp = $('#crm-cv-text');
        var t = inp ? inp.value.trim() : '';
        if (!t || !ui.conv) return;
        deliver(ui.conv, $('#crm-cv-ch').value, t); save(); render();
      },
      book: function (el) { bookForm(el && el.dataset && el.dataset.id, dstr(new Date())); },
      day: function (el) { bookForm(null, el.dataset.d); },
      appt: function (el) {
        var a = db.appts.find(function (x) { return x.id === el.dataset.id; });
        if (!a) return;
        confirmAction('Delete appointment?', a.title + ' on ' + a.date + ' at ' + a.time + '.', 'Delete', function () {
          db.appts = db.appts.filter(function (x) { return x !== a; }); afterChange(); toast('Appointment removed');
        });
      },
      'cal-prev': function () { ui.cal = new Date(ui.cal.getFullYear(), ui.cal.getMonth() - 1, 1); render(); },
      'cal-next': function () { ui.cal = new Date(ui.cal.getFullYear(), ui.cal.getMonth() + 1, 1); render(); },
      'cal-today': function () { ui.cal = new Date(); render(); },
      'copy-book': function () {
        var url = location.origin + '/book/' + bookingSlug;
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
        toast('Booking link copied');
      },
      'pick-wf': function (el) { ui.wf = el.dataset.id; render(); },
      'toggle-wf': function (el) {
        var w = db.workflows.find(function (x) { return x.id === el.dataset.id; });
        if (!w) return;
        w.active = !w.active; save(); render(); toast('Workflow ' + (w.active ? 'activated' : 'paused'));
      },
      'new-wf': function () {
        var w = { id: uid(), name: 'New workflow', active: false, runs: 0, trigger: { type: 'contact_created' }, steps: [{ type: 'Send SMS', text: 'Hello {{name}}' }] };
        db.workflows.unshift(w); ui.wf = w.id; afterChange();
      },
      'del-wf': function () {
        confirmAction('Delete workflow?', 'Delete this automation workflow permanently?', 'Delete', function () {
          db.workflows = db.workflows.filter(function (w) { return w.id !== ui.wf; }); ui.wf = null; afterChange();
        });
      },
      'add-step': function () { var w = wf(); if (w) { w.steps.push({ type: 'Send SMS', text: '' }); afterChange(); } },
      'del-step': function (el) { var w = wf(); if (w) { w.steps.splice(+el.dataset.i, 1); afterChange(); } },
      'test-wf': function () {
        var w = wf(), c = db.contacts[0];
        if (!w || !c) return toast('Add a contact first');
        $('#crm-wf-log').innerHTML = '<div class="log">Test run for "' + esc(w.name) + '" using ' + esc(c.name) + ' (no data changed)\nTrigger: ' + esc(trigLabel(w.trigger)) + '\n' + esc(runWorkflow(w, c, true).join('\n')) + '</div>';
      },
      'new-camp': function () {
        openModal('New campaign',
          '<div class="fld"><label>Name</label><input name="name" required></div>' +
          '<div class="two"><div class="fld"><label>Channel</label><select name="ch">' + CHANNELS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div><div class="fld"><label>Audience tag (blank = all)</label><input name="tag"></div></div>' +
          '<div class="fld"><label>Subject</label><input name="subject"></div>' +
          '<div class="fld"><label>Message (use {{name}}, {{company}})</label><textarea name="body" required></textarea></div>',
          function (f) {
            db.campaigns.unshift({ id: uid(), name: f.name, channel: f.ch, tag: f.tag.trim().toLowerCase(), subject: f.subject, body: f.body, status: 'Draft', sent: 0, opened: 0, clicked: 0, at: new Date().toISOString() });
            closeModal(); afterChange();
          });
      },
      'send-camp': function (el) {
        var c = db.campaigns.find(function (x) { return x.id === el.dataset.id; }); if (!c) return;
        var aud = db.contacts.filter(function (x) { return !c.tag || (x.tags || []).indexOf(c.tag) !== -1; });
        if (!aud.length) return toast('No contacts match the audience tag');
        aud.forEach(function (x) { deliver(x.id, c.channel, fill(c.body, x)); });
        c.sent = aud.length; c.opened = Math.round(aud.length * 0.55); c.clicked = Math.round(aud.length * 0.2); c.status = 'Sent';
        log('Campaign "' + c.name + '" sent to ' + aud.length + ' contacts');
        afterChange(); toast('Sent to ' + aud.length + ' contacts');
      },
      'del-camp': function (el) {
        db.campaigns = db.campaigns.filter(function (x) { return x.id !== el.dataset.id; }); afterChange();
      }
    };

    /* ---------- Scoped Event Listeners ---------- */
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-stop]')) {
        if (e.target.dataset && e.target.dataset.act && A[e.target.dataset.act]) A[e.target.dataset.act](e.target);
        return;
      }
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var inner = e.target.closest('button[data-act], input[data-act]');
      if (inner) el = inner;
      var fn = A[el.dataset.act];
      if (fn) { e.stopPropagation(); fn(el); }
    });

    root.addEventListener('input', function (e) {
      var b = e.target.dataset && e.target.dataset.bind;
      if (b) { ui[b] = e.target.value; refreshContacts(); }
    });

    root.addEventListener('change', function (e) {
      var t = e.target;
      var b = t.dataset && t.dataset.bind;
      if (b) { ui[b] = t.value; refreshContacts(); return; }
      if (t.id === 'crm-cv-snip' && t.value) { $('#crm-cv-text').value = t.value; t.value = ''; return; }
      if (t.id === 'crm-csvfile' && t.files && t.files[0]) {
        var r = new FileReader();
        r.onload = function () {
          var lines = String(r.result).split(/\r?\n/).filter(Boolean), n = 0;
          lines.forEach(function (l, i) {
            var p = l.split(',').map(function (x) { return x.replace(/^"|"$/g, '').trim(); });
            if (i === 0 && /name/i.test(p[0])) return;
            if (!p[0]) return;
            var c = { id: 'c' + uid(), name: p[0], company: p[1] || '', email: p[2] || '', phone: p[3] || '', source: SOURCES.indexOf(p[4]) !== -1 ? p[4] : 'Website', tags: ['imported'], score: 50, owner: OWNERS[0], status: 'Lead', created: new Date().toISOString() };
            db.contacts.unshift(c); fire('contact_created', c); n++;
          });
          save(); render(); toast(n + ' contacts imported');
        };
        r.readAsText(t.files[0]); t.value = ''; return;
      }
      var wKey = t.dataset && t.dataset.wf;
      if (wKey) {
        var x = wf(); if (!x) return;
        if (wKey === 'name') x.name = t.value;
        if (wKey === 'ttype') { x.trigger = { type: t.value }; if (t.value === 'stage') x.trigger.stage = 'Won'; }
        if (wKey === 'tstage') x.trigger.stage = t.value;
        if (wKey === 'stype') x.steps[+t.dataset.i].type = t.value;
        if (wKey === 'stext') x.steps[+t.dataset.i].text = t.value;
        save(); render();
      }
    });

    /* Pipeline Drag & Drop */
    root.addEventListener('dragstart', function (e) {
      var d = e.target.closest && e.target.closest('.deal');
      if (d) { e.dataTransfer.setData('text/plain', d.dataset.id); d.classList.add('drag'); }
    });
    root.addEventListener('dragend', function () {
      root.querySelectorAll('.deal.drag').forEach(function (x) { x.classList.remove('drag'); });
      root.querySelectorAll('.col.over').forEach(function (x) { x.classList.remove('over'); });
    });
    root.addEventListener('dragover', function (e) {
      var c = e.target.closest && e.target.closest('.col');
      if (c) { e.preventDefault(); root.querySelectorAll('.col.over').forEach(function (x) { x.classList.remove('over'); }); c.classList.add('over'); }
    });
    root.addEventListener('drop', function (e) {
      var col = e.target.closest && e.target.closest('.col'); if (!col) return;
      e.preventDefault();
      var d = db.deals.find(function (x) { return x.id === e.dataTransfer.getData('text/plain'); });
      if (!d || d.stage === col.dataset.stage) return render();
      d.stage = col.dataset.stage;
      d.closed = ['Won', 'Lost'].indexOf(d.stage) !== -1 ? new Date().toISOString() : null;
      var c = C(d.contactId);
      log('Deal ' + d.title + ' moved to ' + d.stage);
      if (c) { if (d.stage === 'Won') c.status = 'Customer'; fire('stage', c, d.stage); }
      if (window.QFHaptics) window.QFHaptics.medium();
      save(); render(); toast('Moved to ' + d.stage);
    });

    $('#crm-overlay').addEventListener('mousedown', function (e) { if (e.target.id === 'crm-overlay') closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('crm-app')) return;
      if (e.key === 'Escape') { closeModal(); closeDrawer(); }
      if (e.key === 'Enter' && e.target && e.target.id === 'crm-cv-text') A['send-msg']();
    });

    var topSearch = document.getElementById('crm-gsearch');
    if (topSearch) {
      topSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { ui.q = topSearch.value; ui.status = ''; ui.tag = ''; go('contacts'); }
      });
    }

    render();
    hydrateFromConvex();
  }

  window.initCrmWorkspace = initCrmWorkspace;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCrmWorkspace);
  } else {
    initCrmWorkspace();
  }
})();
