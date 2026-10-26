# Phase 1 validation - checks

Profile: light
Plan: `.specs/features/phase1-validation/plan.md`

22 checks in 3 slices · 2 one-way doors · 3 open, of which 2 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C201:`). This
  feature numbers from C201 because earlier features own `C1:`-`C34:` and `C101:`-`C162:`. The
  runner is tested through an exported function that takes its argv, environment, file reads,
  connection factory and output as arguments, so no test opens a socket.
- **shell** - a command run from the repo root or `web/` that passes when it exits as stated.
- **db** - `npm run test:db ...` in `web/` against the live project, with `SUPABASE_DB_URL` in
  `web/.env.local` (open question 2). Every recipe rolls back. Runs only with the user's go-ahead
  in that session.
- **mcp** - one Supabase MCP call on project `gnxebrtcpbujhvcamtoe`.
- **live** - a real browser on `npm run dev` (`http://localhost:3000`) through the Playwright MCP,
  signed in as the demo owner (open question 1). Not committed (AGENTS..md).

## Checks

### S1 - The SQL suite runs from one command · 5 files · ~150 KB read · ~38k

**C201** - the recipe list is exactly, in this order: `catalog_seed`, `domain_constraints`,
`events_outbox`, `rls_isolation`, `rls_roles`, `transitions` (each `fixture.sql` then
`<name>.sql`), `demo_owner`, `staff_screens` (each `fixture.sql` then `<name>.sql` with its
`SEED_BODY` line replaced), and `demo_seed` = `fixture.sql`, seed body, `demo_seed.sql`, seed body,
`demo_seed_rerun.sql` (AC 1, door 2)
Proof: `npx vitest run scripts -t "C201:"`

**C202** - the seed body is `supabase/seed.sql` with its `begin;` and `commit;` lines removed and
every other line kept; a test file's line that is exactly `SEED_BODY` is replaced by it, and
no other line changes; parts are joined in recipe order (door 2)
Proof: `npx vitest run scripts -t "C202:"`

**C203** - with no recipe argument, the runner opens 9 connections, one per recipe, in the C201
order, sends each recipe as one query, closes each connection, and prints `PASS <recipe>` for each
(AC 1)
Proof: `npx vitest run scripts -t "C203:"`

**C204** - when all recipes pass, the last line is `9 passed, 0 failed` and the exit code is 0 (AC 2)
Proof: `npx vitest run scripts -t "C204:"`

**C205** - when the third recipe's query rejects with `C3: anon can read`, the runner prints
`FAIL events_outbox: C3: anon can read`, still runs the other 8, prints `8 passed, 1 failed` and
exits 1 (AC 3)
Proof: `npx vitest run scripts -t "C205:"`

**C206** - a recipe counts as passed only when the last result row's first value equals
`<last test file without .sql>: pass` (`demo_seed` expects `demo_seed: pass`, from
`demo_seed_rerun.sql`); no rows, a different text, or a result that is not last all print `FAIL`
and count as failed (AC 4)
Proof: `npx vitest run scripts -t "C206:"`

**C207** - `test:db rls_roles rls_isolation` runs exactly those two, `rls_roles` first, and prints
`2 passed, 0 failed` (AC 5)
Proof: `npx vitest run scripts -t "C207:"`

**C208** - `test:db nope` prints `Unknown recipe: nope` and the 9 recipe names, exits 2, and opens
0 connections (AC 6)
Proof: `npx vitest run scripts -t "C208:"`

**C209** - with `SUPABASE_DB_URL` unset, and again set to `""` and to `"  "`, the runner prints
`SUPABASE_DB_URL is not set (see web/.env.example)`, exits 2, and opens 0 connections (AC 7)
Proof: `npx vitest run scripts -t "C209:"`

**C210** - with an extra `supabase/tests/orphan.sql`, the runner prints `Not in any recipe:
orphan.sql`, exits 2 and opens 0 connections; and every one of the 11 `.sql` files in the real
`supabase/tests/` belongs to a recipe (AC 8, door 2)
Proof: `npx vitest run scripts -t "C210:"`

**C211** - when an assembled recipe contains a `commit` statement (any case, `commit;` or
`commit work;`, on its own line), the runner prints `Refusing <recipe>: it would commit`, exits 2
and opens 0 connections; and none of the 9 recipes assembled from the real files trips the guard
(AC 9)
Proof: `npx vitest run scripts -t "C211:"`

**C212** - when the connection for one recipe rejects with `connect ECONNREFUSED`, the runner
prints `FAIL <recipe>: connect ECONNREFUSED`, runs the rest, and exits 1 (AC 10)
Proof: `npx vitest run scripts -t "C212:"`

**C213** - with `SUPABASE_DB_URL=postgresql://u:s3cr3t-pw@h:5432/postgres`, the full output of a
passing run, a failing run and a connection-error run whose error message contains the whole URL
contains neither `s3cr3t-pw` nor the URL (AC 11)
Proof: `npx vitest run scripts -t "C213:"`

**C214** - `web/package.json` has the script `test:db`, `pg` in `devDependencies` at an exact
version (no `^` or `~`), and no `pg` in `dependencies`; `web/.env.example` has the line
`SUPABASE_DB_URL=`; no file under `web/` outside `node_modules` names `NEXT_PUBLIC_SUPABASE_DB_URL`;
and `npm run test:db nope` from `web/` exits 2 with `Unknown recipe: nope` (door 1)
Proof: `npx vitest run scripts -t "C214:"`
Proof: shell - `cd web && npm run test:db nope; test $? -eq 2`

**C215** - against the live project, `npm run test:db` prints 9 `PASS` lines and
`9 passed, 0 failed` and exits 0, and a second run straight after prints the same (AC 1, 2, door 1)
Proof: db - `npm run test:db` twice

### S2 - Tenant isolation and the security advisors · 1 file · ~30 KB · ~8k

**C216** - against the live project, `npm run test:db rls_isolation rls_roles transitions
staff_screens` prints `4 passed, 0 failed` and exits 0 (AC 12)
Proof: db - `npm run test:db rls_isolation rls_roles transitions staff_screens`

**C217** - `get_advisors` with type `security` returns exactly two lints:
`rls_enabled_no_policy` with one finding on `public.outbox`, and `auth_leaked_password_protection`
(AC 13)
Proof: mcp - `get_advisors(project_id, "security")`

**C218** - `CONTEXT.md` names `rls_enabled_no_policy` and `auth_leaked_password_protection` each
with its reason (AD-016 for `outbox`; magic link only for passwords), and a "How to run the tests"
section gives the three commands `npm test`, `npm run test:db` and the live Playwright procedure
(AC 13)
Proof: `npx vitest run scripts -t "C218:"`

### S3 - The signed-in journey works end to end · 0 files · ~5k

**C219** - live, at 1440x900 and again at 375x812 with touch emulation, the demo owner signs in
with an emailed link and opens `/pipeline`, `/customers`, a demo customer, one of its sites and
`/settings`; each document request answers `200`, and every page shows the demo org's name in the
shell (AC 14)
Proof: live - `browser_navigate` through the journey, read `browser_network_requests` and `browser_snapshot`

**C220** - live, over the whole journey of C219 at both sizes, `browser_console_messages` holds no
error and no warning, and `browser_network_requests` holds no request with status >= 400 or a
failed status (AC 15)
Proof: live - `browser_console_messages` and `browser_network_requests` after each size

**C221** - live, saving `/settings` with no field changed shows "Settings saved" (AC 16)
Proof: live - `browser_click` "Save changes", then `browser_snapshot`

**C222** - live, "Sign out" lands on `/login`, and a following `GET /pipeline` answers `307` with
`location` ending in `/login` (AC 17)
Proof: live - `browser_click` "Sign out", then `browser_navigate` to `/pipeline` and read `browser_network_requests`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| recipes (9) | C201, table-driven over all 9 · each run against Postgres C215 | - |
| recipe part kinds (3) | `fixture.sql` C202 · test file C202 · `SEED_BODY` C202 | - |
| `supabase/tests/*.sql` files -> a recipe (11) | C210, table-driven over all 11 in the real directory | - |
| exit codes (3) | 0 C204 · 1 C205, C212 · 2 C208, C209, C210, C211 | - |
| reasons to exit 2 without connecting (4) | unknown recipe C208 · missing URL C209 · orphan file C210 · commit C211 | - |
| outcomes of one recipe (4) | pass C203 · query error C205 · wrong last row C206 · connection error C212 | - |
| `SUPABASE_DB_URL` empty values (3) | unset C209 · `""` C209 · whitespace C209 | - |
| output paths that could leak the URL (3) | pass C213 · fail C213 · connection error C213 | - |
| startup config: `SUPABASE_DB_URL` (2 places) | `web/.env.local` via the `test:db` script C214, C215 · `web/.env.example` C214 | - |
| accepted advisor findings (2) | `rls_enabled_no_policy` C217, C218 · `auth_leaked_password_protection` C217, C218 | - |
| journey pages (6) | `/login` C219 · `/pipeline` C219 · `/customers` C219 · customer C219 · site C219 · `/settings` C219, C221 | - |
| journey sizes (2) | 1440x900 C219, C220 · 375x812 touch C219, C220 | - |
| Landing doors (2) | door 1 C214, C215 · door 2 C201, C202, C210 | - |

- Claims naming a command's output or exit code: C203-C214 assert through the exported runner
  function; C214 and C215 cross the real `npm run` boundary
- No other check claims more than the single case its proof exercises

## Swept

- validation: C208 (recipe names), C209 (empty URL), C210 (every file in a recipe), C211 (no commit)
- failure modes: C205 (a recipe fails, the rest still run), C212 (connection fails); a recipe that raises aborts its own transaction, so nothing half-applies
- idempotency: C215 (two runs in a row give the same result, because every recipe rolls back)
- authorization: C216 (RLS isolation and roles against the live project), C213 (the secret never reaches output)
- concurrency: n/a - recipes run one after another; two people running the suite at once each get their own transaction, and the fixed demo ids make the second wait for the first to roll back rather than collide
- data lifecycle: C211 (nothing can commit); the suite creates nothing that outlives its run
- dependency failure: C212 (database unreachable)
- state transitions: C216 (`transitions` recipe against the live RPCs)
- observability: C203, C205 (one named line per recipe and a summary); no metric or tracing requirement

## Handoff

- S1 writes the runner and its test (~20 KB), edits `web/package.json` and `web/.env.example`, and
  reads the 11 SQL test files plus `seed.sql` (~110 KB); S2 edits `CONTEXT.md` (30 KB); S3 writes
  no code; records in `ROADMAP.md`, `STATE.md` (~25 KB). About 190 KB, roughly 48k tokens, under
  the 150k budget - one builder
- After this feature: run the pending proofs of auth-magic-link (C8, C18, C21, C22, C23) and
  staff-screens (12), re-verify both scoped, then tick the ROADMAP auth item and this item

- **Boundary:** C201-C214 and C218 closed in the feature commit (vitest 25/25, plus `npm run test:db nope` exit 2); C217 run on 2026-10-26 (two lints, both accepted). Open: C215, C216 need `SUPABASE_DB_URL` (open question 2); C219-C222 need the demo owner (open question 1)
- **Settled mid-build:** `tsconfig.json` gains `allowImportingTsExtensions` so Vitest and `tsc` accept the `./runner.mts` import Node needs; files are CRLF on this machine, so `SEED_BODY` matching ignores a trailing `
`
- **Abandoned:** a test-only `onRecipe` hook on `SuiteIO` - the fake derives the recipe order from argv instead
- **Boundary:** C215 (9/9, two runs) and C216 (4/4) green against the live project on 2026-10-26. The first run failed `staff_screens`: its start guard assumed no demo org (live has one) and it re-inserted the fixture's `orgB`. `supabase/tests/staff_screens.sql` now deletes the demo org inside its transaction and reuses the fixture's `orgB`; no assertion changed. The same runs settle staff-screens C101 (SQL half), C120 and auth-magic-link C22, C23. Open: C219-C222 (demo owner)
- **Boundary:** live, 2026-10-26, signed in as the demo owner with an emailed link (dev server, Playwright MCP). Seed run on the live project with the user's go-ahead (12 agreements, 3 contracts, owner membership)
  - C220 first failed: every `(app)` page logged "Next.js encountered the unstable value `Date.now()` while prerendering" (Supabase `getClaims` reads the clock; Partial Prefetching renders the layout ahead of the request). Fixed by `await connection()` at the top of `getContainer()` (AD-027); `composition.test.ts` stubs `next/server` like it already stubs `next/headers`. 416/416 vitest, lint green
  - 1440x900, after the fix: `/pipeline`, `/customers`, `/customers/ec1bd569-…`, `/sites/7a6378e8-…`, `/settings` each document `200`, shell shows "Kettle Ridge Mechanical Ltd.", no horizontal overflow; 0 console errors or warnings; 0 responses >= 400, 0 failed requests (C219, C220); unchanged save shows "Settings saved" (C221)
  - 375x812, `hasTouch` + `isMobile`, every hop by `tap()`: same five pages, no overflow, no control under 44x44, 0 console errors or warnings, 0 responses >= 400; the org name sits in the navigation drawer (in the DOM, visible after tapping "Open navigation"). Each client navigation's `?_rsc=` stream got `200` and was then closed by Next's router (`ERR_ABORTED` while the page stayed) - a client-side cancel, not a failed response (C219, C220). Save shows "Settings saved" (C221). "Sign out" lands on `/login`; then `GET /pipeline` answers `307`, `location: /login` (C222)
  - The same session settles auth-magic-link C8 (a real emailed link signs in), C18 (the demo owner sees the org) and C21 (sign out over HTTP)
- **Boundary:** Verifier round 2 (FAIL) found C215 stale: after the demo owner was seeded, `demo_owner` C23 and `demo_seed` C17 failed (they assume a demo org with no members). `supabase/tests/fixture.sql` now deletes the demo org inside its transaction, so every recipe starts without it; no assertion changed. `npm run test:db`: 9 passed twice; the four C216 recipes: 4 passed; the live demo org still has 12 agreements and 1 member afterwards. C220 (`ERR_ABORTED` on `?_rsc=` streams at 375 px) waits on the user's decision
