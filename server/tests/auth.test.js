import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the app at a throwaway database before importing anything that opens one.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quantalflow-test-'));
process.env.DB_FILE = path.join(tmpDir, 'test.db');

process.env.PORT = '0'; // ephemeral port so tests never collide with a dev server
const { server } = await import('../index.js');
const { createUser, hashPassword, findUserByEmail, createSession } = await import('../auth.js');

let base;
let owner;
const ownerCookie = () => `quantalflow_sid=${createSession(owner.id)}`;

before(async () => {
  await new Promise((resolve) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  owner = createUser({
    email: 'dataquantals@gmail.com',
    name: 'Owner',
    role: 'owner',
    passwordHash: await hashPassword('123456')
  });
});

after(async () => {
  // fetch keeps connections alive, so close() alone would never resolve.
  await new Promise((resolve) => server.close(resolve));
  server.closeAllConnections();
  // Windows can still hold the SQLite WAL handle for a moment; temp cleanup is
  // best effort and must not fail an otherwise green suite.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    /* the OS reclaims the temp directory */
  }
});

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

const sidFrom = (res) => {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('quantalflow_sid='));
  return raw ? raw.split(';')[0] : null;
};

test('owner can log in and receives a session cookie', async () => {
  const res = await post('/api/auth/login', {
    email: 'dataquantals@gmail.com',
    password: '123456'
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.email, 'dataquantals@gmail.com');
  assert.equal(body.user.role, 'owner');
  assert.ok(!('password_hash' in body.user), 'must not leak the password hash');

  const cookie = sidFrom(res);
  assert.ok(cookie, 'expected a session cookie');
  assert.match(res.headers.getSetCookie()[0], /HttpOnly/);
  assert.match(res.headers.getSetCookie()[0], /SameSite=Strict/);
});

test('login is case-insensitive on email', async () => {
  const res = await post('/api/auth/login', {
    email: 'DataQuantals@Gmail.com',
    password: '123456'
  });
  assert.equal(res.status, 200);
});

test('wrong password is rejected', async () => {
  const res = await post('/api/auth/login', {
    email: 'dataquantals@gmail.com',
    password: 'not-the-password'
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Incorrect email or password.');
});

test('unknown account returns the same message as a wrong password', async () => {
  const res = await post('/api/auth/login', {
    email: 'nobody@example.com',
    password: 'whatever'
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Incorrect email or password.');
});

test('session cookie authenticates /api/auth/me', async () => {
  const login = await post('/api/auth/login', {
    email: 'dataquantals@gmail.com',
    password: '123456'
  });
  const cookie = sidFrom(login);

  const res = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.email, 'dataquantals@gmail.com');
});

test('/api/auth/me without a cookie is 401', async () => {
  const res = await fetch(base + '/api/auth/me');
  assert.equal(res.status, 401);
});

test('registering creates an account and logs the user in', async () => {
  const res = await post('/api/auth/register', {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'hunter2secret'
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.user.name, 'Ada Lovelace');
  assert.equal(body.user.role, 'member');
  assert.ok(sidFrom(res), 'expected a session cookie on register');

  // The stored password must be a salted hash, never the plaintext.
  const stored = findUserByEmail('ada@example.com');
  assert.notEqual(stored.password_hash, 'hunter2secret');
  assert.match(stored.password_hash, /^scrypt\$/);
});

test('duplicate email is rejected with 409', async () => {
  const res = await post('/api/auth/register', {
    name: 'Someone Else',
    email: 'ada@example.com',
    password: 'anotherpass'
  });
  assert.equal(res.status, 409);
});

test('registration validates its input', async () => {
  const res = await post('/api/auth/register', {
    name: '',
    email: 'not-an-email',
    password: '123'
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.fields.email, 'expected an email error');
  assert.ok(body.fields.name, 'expected a name error');
  assert.ok(body.fields.password, 'expected a password error');
});

test('logout invalidates the session', async () => {
  const login = await post('/api/auth/login', {
    email: 'dataquantals@gmail.com',
    password: '123456'
  });
  const cookie = sidFrom(login);

  const out = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(out.status, 200);
  assert.match(out.headers.getSetCookie().join(';'), /Max-Age=0/);

  const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 401, 'session should be dead after logout');
});

test('a forged session token is rejected', async () => {
  const res = await fetch(base + '/api/auth/me', {
    headers: { Cookie: 'quantalflow_sid=totally-made-up-token' }
  });
  assert.equal(res.status, 401);
});

test('cross-origin POSTs are blocked', async () => {
  const res = await post(
    '/api/auth/login',
    { email: 'dataquantals@gmail.com', password: '123456' },
    { Origin: 'https://evil.example.com' }
  );
  assert.equal(res.status, 403);
});

test('static path traversal cannot reach the database or source', async () => {
  for (const attempt of [
    '/../data/app.db',
    '/..%2fdata%2fapp.db',
    '/%2e%2e/data/app.db',
    '/server/index.js',
    '/server/auth.js',
    '/src/pages/home.html',
    '/data/app.db'
  ]) {
    const res = await fetch(base + attempt, { redirect: 'manual' });
    assert.ok(res.status >= 400, `${attempt} should not be served (got ${res.status})`);
  }
});

test('every routed page is served', async () => {
  const routes = [
    '/',
    '/index.html',
    '/product/',
    '/solutions/',
    '/resources/',
    '/enterprise/',
    '/pricing/',
    '/get-started/',
    '/login/',
    '/404/'
  ];

  for (const route of routes) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200, `${route} should be 200`);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>'), `${route} should return HTML`);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), `${route} has an unreplaced placeholder`);
  }
});

test('the dashboard is gated server-side', async () => {
  // No cookie: a redirect to the login page that remembers where we came from.
  const anon = await fetch(base + '/dashboard/', { redirect: 'manual' });
  assert.equal(anon.status, 302);
  assert.equal(anon.headers.get('location'), '/login/?next=%2Fdashboard%2F');
  assert.equal(anon.headers.get('cache-control'), 'no-store');

  // Same for the extension-less form, which would otherwise 301 first.
  const bare = await fetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(bare.status, 302);
  assert.equal(bare.headers.get('location'), '/login/?next=%2Fdashboard%2F');

  // With a real session the page is served.
  const login = await post('/api/auth/login', { email: owner.email, password: '123456' });
  const sid = sidFrom(login);
  assert.ok(sid, 'expected a session cookie');

  const authed = await fetch(base + '/dashboard/', {
    headers: { cookie: sid },
    redirect: 'manual'
  });
  assert.equal(authed.status, 200);
  assert.ok((await authed.text()).includes('<!DOCTYPE html>'));
});

test('directory routes redirect to a trailing slash', async () => {
  for (const route of ['/pricing', '/product', '/login']) {
    const res = await fetch(base + route, { redirect: 'manual' });
    assert.equal(res.status, 301, `${route} should redirect`);
    assert.equal(res.headers.get('location'), route + '/');
  }
});

test('unknown routes render the branded 404 page', async () => {
  const res = await fetch(base + '/this-route-does-not-exist/');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  const html = await res.text();
  assert.ok(html.includes('This board is empty'), 'expected the 404 page body');
  assert.ok(html.includes('class="header"'), 'expected the shared header on the 404 page');

  // Asset misses stay machine-readable rather than returning a full page.
  const asset = await fetch(base + '/assets/img/missing.png');
  assert.equal(asset.status, 404);
  assert.match(asset.headers.get('content-type') || '', /application\/json/);
});

test('every page carries the shared header and footer', async () => {
  for (const route of ['/pricing/', '/solutions/', '/resources/', '/enterprise/', '/product/']) {
    const html = await (await fetch(base + route)).text();
    assert.ok(html.includes('class="header"'), `${route} missing header`);
    assert.ok(html.includes('class="footer"'), `${route} missing footer`);
    assert.ok(html.includes('id="main"'), `${route} missing main landmark`);
  }
});

test('internal navigation links point at real routes', async () => {
  const pages = ['/', '/pricing/', '/solutions/', '/resources/', '/enterprise/', '/product/'];
  const seen = new Set();
  let total = 0;

  for (const route of pages) {
    const html = await (await fetch(base + route)).text();
    // Capture the path portion of absolute links, ignoring any #fragment or ?query.
    const hrefs = [...html.matchAll(/href="(\/[^"?#]*)["?#]/g)].map((m) => m[1]);
    total += hrefs.length;

    for (const href of hrefs) {
      if (seen.has(href)) continue;
      seen.add(href);

      const res = await fetch(base + href, { redirect: 'manual' });
      // A 302 is only acceptable as the session gate (which points at /login/);
      // anything else redirecting still counts as a broken destination.
      const gated =
        res.status === 302 && (res.headers.get('location') || '').startsWith('/login/');
      assert.ok(
        res.status === 200 || res.status === 301 || gated,
        `broken link ${href} (from ${route}) returned ${res.status}`
      );
    }
  }

  assert.ok(seen.size >= 10, `expected at least 10 distinct routes, saw ${seen.size}`);
  assert.ok(total >= 100, `expected to have checked 100+ links, checked ${total}`);
});

test('hierarchical nested routes under /app and /dashboard resolve and guard properly', async () => {
  // Direct deep link to /app/<slug>/<code>/<template> renders the canvas app
  const deepApp = await fetch(base + '/app/assap/002c5f/mindmap');
  assert.equal(deepApp.status, 200);
  const appHtml = await deepApp.text();
  assert.ok(appHtml.includes('id="quantalflow-viewport"'), 'expected canvas viewport on nested /app route');

  // Protected nested /dashboard/starred/ redirects unauthenticated users with ?next= preserved
  const anonDash = await fetch(base + '/dashboard/starred/', { redirect: 'manual' });
  assert.equal(anonDash.status, 302);
  assert.equal(anonDash.headers.get('location'), '/login/?next=%2Fdashboard%2Fstarred%2F');

  // Invalid deeply nested route under /dashboard/ falls back to branded 404
  const login = await post('/api/auth/login', { email: owner.email, password: '123456' });
  const sid = sidFrom(login);
  const authedNestedDash = await fetch(base + '/dashboard/starred/', { headers: { cookie: sid } });
  assert.equal(authedNestedDash.status, 200);

  const invalidNestedDash = await fetch(base + '/dashboard/nonexistent-section/', { headers: { cookie: sid } });
  assert.equal(invalidNestedDash.status, 404);
});

test('new collaborative board starts empty; templates live in the template library', async () => {
  const sid = ownerCookie();

  const created = await post('/api/boards', {
    title: 'New Collaborative Board',
    category: 'AI & Product Strategy',
    state: {}
  }, { cookie: sid });
  assert.equal(created.status, 201);
  const { board } = await created.json();
  assert.equal(board.title, 'New Collaborative Board');
  assert.equal(board.state, null, 'newly created board state should be empty');

  const appRes = await fetch(base + '/app/');
  assert.equal(appRes.status, 200);
  const html = await appRes.text();
  assert.ok(html.includes('id="empty-board-starter"'), 'expected empty board starter hub');
  assert.ok(html.includes('data-starter-template="mindmap"'), 'expected Mind Map starter option');
  assert.ok(html.includes('data-starter-template="flow"'), 'expected Flowchart starter option');
  assert.ok(html.includes('data-starter-template="kanban"'), 'expected Kanban Board starter option');
  assert.ok(html.includes('data-starter-template="retro"'), 'expected Retrospective starter option');
  assert.ok(html.includes('data-starter-template="brainstorm"'), 'expected Brainstorming starter option');
  assert.ok(html.includes('data-starter-template="swot"'), 'expected SWOT starter option');
  assert.ok(html.includes('data-starter-template="journey"'), 'expected Customer Journey starter option');
  assert.ok(html.includes('data-starter-template="project-planning"'), 'expected Project Planning Workspace starter option');
  assert.ok(!html.includes('data-id="frame-1"'), 'canvas should not come preloaded with demo frames');

  // The dashboard keeps only board naming; templates and agile workspaces live in the library.
  const dashRes = await fetch(base + '/dashboard/', { headers: { cookie: sid } });
  assert.equal(dashRes.status, 200);
  const dashHtml = await dashRes.text();
  assert.ok(!dashHtml.includes('data-modal-tpl='), 'dashboard modal should not offer starter templates');
  assert.ok(!dashHtml.includes('data-open-project-planning'), 'agile workspace launchers moved to the template library');
  assert.ok(dashHtml.includes('/resources/templates/'), 'dashboard should point at the template library');

  const tplRes = await fetch(base + '/resources/templates/');
  assert.equal(tplRes.status, 200);
  const tplHtml = await tplRes.text();
  assert.ok(tplHtml.includes('template=project-planning&amp;module=gantt'), 'expected Project Planning Suite link');
  assert.ok(tplHtml.includes('template=project-planning&amp;module=tasks'), 'expected Kanban & WBS Tree link');
  assert.ok(tplHtml.includes('template=project-planning&amp;module=resources'), 'expected Resources & Timesheets link');
  assert.ok(tplHtml.includes('template=project-planning&amp;module=risk'), 'expected RAID & Change Control link');
  assert.ok(tplHtml.includes('template=mindmap'), 'expected Mind Map template');
  assert.ok(tplHtml.includes('template=journey'), 'expected Customer Journey template');

  // Verify Project Planning script & stylesheet are served
  const ppJs = await fetch(base + '/assets/js/project-planning.js');
  assert.equal(ppJs.status, 200);
  const ppJsText = await ppJs.text();
  assert.ok(ppJsText.includes('ProjectPlanningSuite'), 'expected ProjectPlanningSuite engine');
  assert.ok(ppJsText.includes('Work Breakdown Structure (WBS)'), 'expected WBS module');
  assert.ok(ppJsText.includes('Resource Breakdown Structure (RBS)'), 'expected RBS module');
  assert.ok(ppJsText.includes('Cumulative Flow Diagram (CFD)'), 'expected CFD reporting chart');
  assert.ok(ppJsText.includes('Change Management Request Pipeline'), 'expected Change Management workflow');
});

test('Clerk auth sync, auth config, and Convex status endpoints work and convex source is blocked from static serving', async () => {
  const cfgRes = await fetch(base + '/api/auth/config');
  assert.equal(cfgRes.status, 200);
  const cfg = await cfgRes.json();
  assert.equal(cfg.convexCloudUrl, 'https://agreeable-starfish-202.convex.cloud');
  assert.equal(cfg.convexSiteUrl, 'https://agreeable-starfish-202.convex.site');
  assert.equal(cfg.clerkSecretKey, undefined, 'secret key must never be exposed');
  assert.equal(cfg.convexDeployKey, undefined, 'deploy key must never be exposed');

  const syncRes = await post('/api/auth/clerk-sync', {
    email: `clerk-user-${Date.now()}@example.com`,
    name: 'Clerk Synced User',
    clerkId: 'user_clerk_test_123'
  });
  assert.equal(syncRes.status, 200);
  const syncBody = await syncRes.json();
  assert.equal(syncBody.provider, 'clerk');
  assert.equal(syncBody.user.name, 'Clerk Synced User');
  const clerkSid = sidFrom(syncRes);
  assert.ok(clerkSid, 'expected session cookie from Clerk sync');

  const meRes = await fetch(base + '/api/auth/me', { headers: { cookie: clerkSid } });
  assert.equal(meRes.status, 200);

  const convexBlocked = await fetch(base + '/convex/schema.js');
  assert.ok(convexBlocked.status >= 400, '/convex/schema.js must not be served statically');
});

test('Profile route is gated, PATCH /api/auth/me updates info, and POST /api/auth/change-password works', async () => {
  // 1. Unauthenticated /profile/ redirects to login
  const unauthRes = await fetch(base + '/profile/', { redirect: 'manual' });
  assert.equal(unauthRes.status, 302);
  assert.ok(unauthRes.headers.get('location').includes('/login/?next=%2Fprofile%2F'));

  // 2. Log in as owner
  const login = await post('/api/auth/login', { email: owner.email, password: '123456' });
  assert.equal(login.status, 200);
  const sid = sidFrom(login);
  assert.ok(sid, 'expected session cookie from login');

  // 3. Authenticated /profile/ serves 200 with profile HTML
  const profRes = await fetch(base + '/profile/', { headers: { cookie: sid } });
  assert.equal(profRes.status, 200);
  const profHtml = await profRes.text();
  assert.ok(profHtml.includes('Account &amp; Profile'));

  // 4. PATCH /api/auth/me updates name, job title, company, and bio
  const patchRes = await fetch(base + '/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: sid },
    body: JSON.stringify({
      name: 'Elena Rostova',
      title: 'Principal Product Architect',
      company: 'Core Experience',
      bio: 'Leading collaborative canvas systems and agile planning.'
    })
  });
  assert.equal(patchRes.status, 200);
  const patchData = await patchRes.json();
  assert.equal(patchData.user.name, 'Elena Rostova');
  assert.equal(patchData.user.title, 'Principal Product Architect');
  assert.equal(patchData.user.company, 'Core Experience');
  assert.equal(patchData.user.bio, 'Leading collaborative canvas systems and agile planning.');

  // 5. GET /api/auth/me reflects the updated fields
  const meRes = await fetch(base + '/api/auth/me', { headers: { cookie: sid } });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.name, 'Elena Rostova');
  assert.equal(meData.user.title, 'Principal Product Architect');

  // 6. POST /api/auth/change-password with wrong current password is rejected
  const badPassRes = await fetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: sid },
    body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'new-secure-pass' })
  });
  assert.equal(badPassRes.status, 400);

  // 7. POST /api/auth/change-password with valid credentials succeeds
  const changePassRes = await fetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: sid },
    body: JSON.stringify({ currentPassword: '123456', newPassword: 'new-secure-pass-2026' })
  });
  assert.equal(changePassRes.status, 200);

  // 8. Log in with the new password works
  const newLogin = await post('/api/auth/login', { email: owner.email, password: 'new-secure-pass-2026' });
  assert.equal(newLogin.status, 200);

  // Restore owner password back to 123456 so subsequent tests/runs stay consistent
  const newSid = sidFrom(newLogin);
  await fetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: newSid },
    body: JSON.stringify({ currentPassword: 'new-secure-pass-2026', newPassword: '123456' })
  });
});

test('profile avatar upload enforces 5MB limit and supports upload/delete', async () => {
  // 1. Unauthenticated upload is rejected with 401
  const unauthRes = await fetch(base + '/api/profile/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.from([137, 80, 78, 71])
  });
  assert.equal(unauthRes.status, 401);

  // Log in as owner to get session
  const loginRes = await post('/api/auth/login', { email: owner.email, password: '123456' });
  const sid = sidFrom(loginRes);

  // 2. Non-image MIME type is rejected with 400
  const badMimeRes = await fetch(base + '/api/profile/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', cookie: sid },
    body: Buffer.from('not-an-image')
  });
  assert.equal(badMimeRes.status, 400);

  // 3. Image exceeding 5MB is rejected with 413
  const oversizeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB
  const oversizeRes = await fetch(base + '/api/profile/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', cookie: sid },
    body: oversizeBuffer
  });
  assert.ok(oversizeRes.status === 413 || oversizeRes.status === 400);

  // 4. JSON upload with storageId updates avatar and GET /api/auth/me returns it
  const updateJsonRes = await fetch(base + '/api/profile/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: sid },
    body: JSON.stringify({ storageId: 'test_storage_id_123' })
  });
  assert.equal(updateJsonRes.status, 200);
  const updateData = await updateJsonRes.json();
  assert.equal(updateData.ok, true);

  const meRes = await fetch(base + '/api/auth/me', { headers: { cookie: sid } });
  const meData = await meRes.json();
  assert.ok(meData.user.avatar_url !== undefined);

  // 5. DELETE /api/profile/avatar removes the avatar
  const delRes = await fetch(base + '/api/profile/avatar', {
    method: 'DELETE',
    headers: { cookie: sid }
  });
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.ok, true);
  assert.equal(delData.user.avatar_url, '');
});

test('repeated bad logins eventually rate limit', async () => {
  const email = `bruteforce-${Date.now()}@example.com`;
  let sawLimit = false;

  for (let i = 0; i < 14; i++) {
    const res = await post('/api/auth/login', { email, password: 'wrong' });
    if (res.status === 429) {
      sawLimit = true;
      assert.ok(Number(res.headers.get('Retry-After')) > 0, 'expected Retry-After header');
      break;
    }
  }

  assert.ok(sawLimit, 'expected a 429 after repeated failures');
});

test('project plans persist to SQLite and Convex; the blank workspace refuses demo templates', async () => {
  // Convex sync is disabled under config.isTest, so the mirror is verified at the
  // payload level here; the live round trip is exercised against the dev
  // deployment by the app itself.
  const { buildProjectPlanPayload } = await import('../convex.js');
  const boardId = `plan-test-${Date.now()}`;
  const plan = {
    projectName: 'Plan Persistence Test',
    projectCode: `TEST-${Date.now()}`,
    wbsPhases: [{ id: 'phase-1', name: 'Phase One' }],
    tasks: [{ id: 'task-1', title: 'Real work' }],
    milestones: [],
    resources: [],
    timesheets: [],
    wikiPages: [],
    sharedFiles: [],
    raidItems: [],
    changeRequests: []
  };

  const sid = ownerCookie();

  const putPlan = (id, body) =>
    fetch(`${base}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: sid },
      body: JSON.stringify({ plan: body, stateVersion: 2 })
    });

  // 1. A real plan round-trips through SQLite...
  const saved = await putPlan(boardId, plan);
  assert.equal(saved.status, 200);
  const savedBody = await saved.json();
  assert.equal(savedBody.ok, true);
  assert.equal(typeof savedBody.convexSynced, 'boolean');

  const read = await fetch(`${base}/api/projects/${boardId}`, { headers: { cookie: sid } });
  const readBody = await read.json();
  assert.equal(readBody.plan.projectCode, plan.projectCode);
  assert.equal(readBody.plan.tasks.length, 1);

  // ...and the same state flattens into the nine Convex section tables, so the
  // mirror carries real rows rather than only the local snapshot.
  const payload = buildProjectPlanPayload(boardId, plan);
  assert.equal(payload.boardId, boardId);
  assert.equal(payload.projectCode, plan.projectCode);
  assert.equal(payload.tasks.length, 1);
  assert.equal(payload.tasks[0].entityId, 'task-1');
  assert.equal(payload.phases.length, 1);
  assert.equal(payload.phases[0].entityId, 'phase-1');
  assert.equal(JSON.parse(payload.snapshotJson).projectCode, plan.projectCode);
  for (const key of ['milestones', 'resources', 'timesheets', 'wikiPages', 'files', 'raidItems', 'changeRequests']) {
    assert.deepEqual(payload[key], [], `section ${key} should flatten to an empty list`);
  }

  // 2. The canonical blank workspace must never adopt a shipped demo template.
  const demo = await putPlan('project-planning-workspace', {
    projectName: 'Data Quantals Plan',
    projectCode: 'WBS-2026',
    wbsPhases: [],
    tasks: [{ id: 'task-1', title: 'Demo task' }]
  });
  assert.equal(demo.status, 409, 'demo template must be rejected for the blank workspace');
  const blank = await fetch(`${base}/api/projects/project-planning-workspace`, { headers: { cookie: sid } });
  const blankBody = await blank.json();
  assert.equal(blankBody.plan, null, 'blank workspace must stay empty');

  // 3. Deleting the plan clears the local store.
  const removed = await fetch(`${base}/api/projects/${boardId}`, { method: 'DELETE', headers: { cookie: sid } });
  assert.equal(removed.status, 200);
  const afterDelete = await fetch(`${base}/api/projects/${boardId}`, { headers: { cookie: sid } });
  assert.equal((await afterDelete.json()).plan, null);
});

test('Row-Level Security (RLS): anonymous requests are blocked and users cannot access or modify each other data', async () => {
  // 1. Unauthenticated requests to protected endpoints return 401
  const unauthListBoards = await fetch(`${base}/api/boards`);
  assert.equal(unauthListBoards.status, 401);

  const unauthCreateBoard = await post('/api/boards', { title: 'Hacker Board' });
  assert.equal(unauthCreateBoard.status, 401);

  const unauthGetPlan = await fetch(`${base}/api/projects/some-board`);
  assert.equal(unauthGetPlan.status, 401);

  const unauthPutPlan = await fetch(`${base}/api/projects/some-board`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: { projectName: 'Hacked' } })
  });
  assert.equal(unauthPutPlan.status, 401);

  // 2. Set up two separate users
  const userAEmail = `user-a-${Date.now()}@example.com`;
  const userBEmail = `user-b-${Date.now()}@example.com`;

  const regA = await post('/api/auth/register', {
    email: userAEmail,
    password: 'password123',
    name: 'Alice Agent'
  });
  assert.equal(regA.status, 201);
  const sidA = sidFrom(regA);

  const regB = await post('/api/auth/register', {
    email: userBEmail,
    password: 'password123',
    name: 'Bob Builder'
  });
  assert.equal(regB.status, 201);
  const sidB = sidFrom(regB);

  // 3. User A creates a board
  const boardAId = `alice-board-${Date.now()}`;
  const createA = await post('/api/boards', {
    id: boardAId,
    title: 'Alice Secret Project',
    category: 'Strategy & Planning'
  }, { cookie: sidA });
  assert.equal(createA.status, 201);

  // 4. User B cannot see User A's board in their board list
  const listB = await fetch(`${base}/api/boards`, { headers: { cookie: sidB } });
  assert.equal(listB.status, 200);
  const { boards: bBoards } = await listB.json();
  assert.ok(!bBoards.some((b) => b.id === boardAId), 'User B must not see User A board in list');

  // 5. User B cannot update User A's board
  const updateByB = await fetch(`${base}/api/boards/${boardAId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: sidB },
    body: JSON.stringify({ title: 'Bob Attempted Hijack' })
  });
  assert.ok(updateByB.status === 403 || updateByB.status === 404, 'User B must not modify User A board');

  // 6. User B cannot delete User A's board
  const deleteByB = await fetch(`${base}/api/boards/${boardAId}`, {
    method: 'DELETE',
    headers: { cookie: sidB }
  });
  assert.ok(deleteByB.status === 403 || deleteByB.status === 404, 'User B must not delete User A board');

  // 7. User A saves a project plan for their board
  const planPayload = {
    projectName: 'Alice Confidential Plan',
    projectCode: 'SEC-001',
    tasks: [{ id: 'task-sec-1', title: 'Top Secret Research' }]
  };
  const savePlanA = await fetch(`${base}/api/projects/${boardAId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: sidA },
    body: JSON.stringify({ plan: planPayload, stateVersion: 2 })
  });
  assert.equal(savePlanA.status, 200);

  // 8. User B cannot read User A's project plan
  const readPlanB = await fetch(`${base}/api/projects/${boardAId}`, {
    headers: { cookie: sidB }
  });
  const planDataB = await readPlanB.json();
  assert.equal(planDataB.plan, null, 'User B reading User A plan must receive null');

  // 9. User B cannot overwrite User A's project plan
  const overwritePlanB = await fetch(`${base}/api/projects/${boardAId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: sidB },
    body: JSON.stringify({ plan: { projectName: 'Bob Hijacked Plan' }, stateVersion: 2 })
  });
  assert.equal(overwritePlanB.status, 403, 'User B attempting to overwrite User A plan must return 403');

  // 10. User B cannot delete User A's project plan
  const deletePlanB = await fetch(`${base}/api/projects/${boardAId}`, {
    method: 'DELETE',
    headers: { cookie: sidB }
  });
  assert.equal(deletePlanB.status, 403, 'User B attempting to delete User A plan must return 403');

  // 11. User A can still read and delete their own plan and board
  const readPlanA = await fetch(`${base}/api/projects/${boardAId}`, {
    headers: { cookie: sidA }
  });
  const planDataA = await readPlanA.json();
  assert.equal(planDataA.plan.projectName, 'Alice Confidential Plan');

  const deletePlanA = await fetch(`${base}/api/projects/${boardAId}`, {
    method: 'DELETE',
    headers: { cookie: sidA }
  });
  assert.equal(deletePlanA.status, 200);

  const deleteBoardA = await fetch(`${base}/api/boards/${boardAId}`, {
    method: 'DELETE',
    headers: { cookie: sidA }
  });
  assert.equal(deleteBoardA.status, 200);
});
