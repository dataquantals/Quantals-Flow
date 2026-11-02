# AGENTS.md

QuantalFlow homepage clone with a real backend, auth, and a routed multi-page site.

## Commands

```bash
npm run build   # src/pages/*.html -> route tree at repo root
npm start       # serve on http://localhost:12000
npm test        # node --test server/tests/*.test.js
npm run seed    # create the owner account
npm run audit:links   # every internal href + #anchor resolves
npm run convex:push   # deploy convex/ schema + functions to the dev deployment
npm run convex:backfill  # re-push every SQLite user/board/plan into Convex
```

## Layout

```
src/pages/       page bodies with front matter (the source of truth)
src/partials/    header.html, footer.html
src/templates/   base.html (marketing), standalone.html (auth/dashboard)
src/tools/       build.js, link-audit.mjs
server/          config, db, auth, http helpers, routes, index, seed
assets/          css, js, img — served as-is
<route>/index.html   generated; never edit by hand
```

`src/pages/404.html` is both a real `/404/` route and the page the server
streams (with a 404 status) for any unknown navigation; asset misses keep a
JSON 404 so a missing image never returns HTML.

`assets/css/styles.css` holds the original design tokens and homepage styles.
`assets/css/pages.css` holds the routed-site components (page heroes, plans,
compare table, FAQ, forms) and builds on the same tokens.

## Conventions

- Front matter keys: `title`, `description`, `route`, `nav`, `layout`,
  `body_class`, `scripts`. `layout` is `base` (default) or `standalone`.
- The builder fails the build on any unreplaced `{{PLACEHOLDER}}`, so a typo in
  a template key is caught immediately rather than shipping as literal text.
- Asset URLs get a `?v=<sha1>` suffix at build time. Edit the file, re-run the
  build, and the browser picks it up — no manual cache clearing.
- `data-nav` on a header item must match the page's `nav` front-matter value or
  the active state silently does nothing.

## Backend notes

- Node built-ins only: `node:sqlite`, `node:crypto`, `node:http`. No npm deps.
- Passwords are scrypt-hashed (`scrypt$N$r$p$salt$hash`); sessions are HttpOnly
  cookies with the token stored hashed in SQLite.
- Static serving blocks `server/`, `src/`, and `data/` so source and the
  database are never reachable over HTTP. Directory routes 301 to a trailing
  slash so relative links resolve.
- `/dashboard/` is gated in `server/index.js`, not just by the page script: no
  session cookie means a 302 to `/login/?next=/dashboard/`, and `login.js`
  validates `next` is a same-origin path before honouring it (an unvalidated
  value would be an open redirect).

## Data model

- SQLite (`data/app.db`) is the source of truth: `users`, `sessions`, `boards`,
  `project_plans`.
- `boards.state_json` holds canvas state only. A Project Planning board instead
  carries the marker `{"workspaceMode":"project-planning"}`, which is what makes
  `app.js` open the planning suite instead of a blank canvas.
- `project_plans` (PK `board_id`, `plan_json`, `created_at`, `updated_at`) holds
  the full plan snapshot. Plans are read/written through
  `GET|PUT|DELETE /api/projects/:boardId`; `POST /api/boards` and its siblings
  do not touch them.
- The browser also caches the plan in `localStorage` (`quantalflow_pp_state_v2_<boardId>`)
  for instant first paint. On a cold browser, `project-planning.js` hydrates from
  `/api/projects/:boardId` and skips the restore if the user already started
  typing.
- Convex (`convex/`) is a mirror, not the source of truth: `users`, `sessions`,
  `boards`, plus the planning projection `projectPlans` (snapshot + counts) and
  one table per plan section — `projectPhases`, `projectTasks`,
  `projectMilestones`, `projectResources`, `projectTimesheets`,
  `projectWikiPages`, `projectFiles`, `projectRaidItems`,
  `projectChangeRequests`. Rows are keyed by `(boardId, entityId)` and pruned
  when an entity disappears from the plan.
- Convex sync is fire-and-forget for boards/users; the plan sync is awaited in
  `PUT /api/projects/:boardId` so a schema/function mismatch shows up as
  `convexSynced: false` plus a server warning instead of silently doing nothing.
- The canonical blank workspace (`BLANK_PROJECT_PLANNING_BOARD_ID`, board slug
  `project-planning-workspace`) must stay blank: `saveProjectPlan` rejects a
  demo snapshot (`WBS-2026` / `PRJ-2026-Q4` / "Construction of a House" /
  "Enterprise Release") with a 409, and `project-planning.js` refuses to PUT or
  hydrate those fingerprints there. Without both guards, a stale server copy or
  an already-open tab re-seeds the sample plan into every new visit.
- The configured Convex deploy key is a `preview:` key, which cannot be used as
  an `Authorization: Convex <key>` bearer token, so `server/convex.js`
  deliberately sends no auth header. Preview deployments serve their functions
  publicly; a production key would be sent.
- Because those functions are public, the mirror only ever receives non-secret
  fields: password hashes and session tokens stay in SQLite (`convex/sessions.js`
  is unused on purpose). Nothing that could authenticate a request is mirrored.
- `convex/schema.js` is the source of truth for the remote tables, so a new
  planning section needs a schema field, a `PLAN_SECTIONS` entry in
  `server/convex.js`, a `SECTIONS` entry in `convex/projectPlanning.js`, and the
  matching `LIST_KEYS` entry in `assets/js/project-planning.js`. Miss one and the
  data silently stops at best, or the save throws at worst.
- `npm run convex:backfill` re-pushes every SQLite user, board and plan into
  Convex (idempotent upserts). Add `--prune-boards` to also delete convex boards
  that no longer exist locally — a seed such as `convex/seed.js` leaves demo
  boards behind that the app never reads.

## Gotchas

- Hover and click both open the mega menus. A click while `_hoverOpened` is set
  just confirms the menu instead of toggling it shut; without that guard the
  menu closes the moment a mouse user clicks it.
- `data/` is gitignored because it holds password hashes and session tokens.
- `readJson` caps bodies at 16KB by default, which is right for auth/profile but
  far too small for a canvas or a plan. Document endpoints pass
  `DOCUMENT_MAX_BYTES` (4MB) explicitly — a new board/plan route that forgets
  this will fail with a confusing 413 on a large board.
- `npx convex dev --once` refuses to run while `.env.local` holds the preview
  deploy key ("Use `npx convex deploy` to use preview deployments"), and
  `npx convex deploy` would target production. `npm run convex:push` passes
  `.env.convex-dev` (deployment name only) so the dev deployment gets the schema
  and functions the server actually talks to.
- Chrome height is published to CSS by `main.js` as `--header-h` (measured via
  `getBoundingClientRect`, re-synced on resize and by a `ResizeObserver`).
  `scroll-padding-top`, `.subnav { top }` and the mobile drawer's `max-height`
  all derive from it — never hard-code 76px in a stylesheet.
- Routed pages pin a `.subnav` under the header, so `html:has(.subnav)` adds the
  subnav's height to the anchor offset. A page that gains or loses a subnav
  changes its anchor clearance automatically.
- Stateful controls carry ARIA state, not just a class: `.tab` gets
  `aria-selected` + a roving `tabindex` (arrow/Home/End traverse the row) and
  the billing toggle gets `aria-pressed`. Inactive `.tabpanel`s are `display:none`,
  which already hides them from assistive tech.
