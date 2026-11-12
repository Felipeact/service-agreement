# Workspace pending state verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a2535ef..fc29839
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Two gaps fail the feature. Both concern the one file that joins the page to the panel:

1. `web/app/register/success/success-status.tsx` is the only code that reads `session_id` from the address (`:10`) and the only place the real Server Action is handed to the panel (`:11`). No proof covers it: a search of every `*.test.ts*` under `web/` for `SuccessStatus|success-status|session_id"` returns no match. If the read were `get("sessionId")`, every proof in this feature would still be green. That leaves the `Test policy` row for an entry point (the page) unmet and a coverage member unproven.
2. C4201 claims the behaviour of `/register/success` with no `session_id`: the static copy *and* the Sign in link. Its proof renders `WorkspaceStatus` with a stand-in fallback, `createElement("p", null, "Your trial is registered. We will email a sign-in link.")` at `status-panel.test.ts:26`. It never renders the page's hero, and it asserts no Sign in link. The claim names a route, so this is a level gap, and because the link half is never asserted it is also a precision gap.

Every other check is proven with a located assertion. All five injected faults were killed.

## Binding sources

None. The plan marks no source as binding, and step 1 runs only under `ui`.

## Checks

The vitest proofs ran in one batched invocation from `web/`: `npx vitest run infrastructure/stripe/checkout.test.ts app/register/success/status-panel.test.ts app/register/success/actions.test.ts domain/billing/workspace-state.test.ts components/shell/no-workspace.test.ts "app/(app)/layout.test.ts" infrastructure/supabase/workspace-state.test.ts composition/workspace-state-wiring.test.ts infrastructure/supabase/workspace-state-public.test.ts scripts/test-db/runner.test.ts app/register/success/success.test.ts --reporter=verbose`. Result: 11 files, 147 tests passed, 0 failed, and every `C42xx:` test is listed individually as passed.

The SQL proofs ran with `npm run test:db workspace_pending_state`, which printed `PASS workspace_pending_state` / `1 passed, 0 failed`. The runner prints one line per recipe, not per case. The cases are still settled individually: `tests.ok` raises on the first false condition (`supabase/tests/fixture.sql:34-40`), so the recipe can only PASS if every labelled case held. Fault 5 shows a single case failing under its own label.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4200 | success_url `<base>/register/success?session_id={CHECKOUT_SESSION_ID}`, braces literal, for each of 3 plans; cancel_url unchanged | vitest batch; `C4200: starter/team/business ...` all passed | `web/infrastructure/stripe/checkout.test.ts:102` - `expect(form().get("success_url")).toBe("https://app.example.com/register/success?session_id={CHECKOUT_SESSION_ID}")`; `:103` - `expect(form().get("cancel_url")).toBe(\`https://app.example.com/register?plan=${plan}\`)` (test.each over PLAN_CASES) | PASS |
| C4201 | `/register/success` with no session_id renders "Your trial is registered." and the Sign in link; action never called | vitest batch; `C4201: with no session id ...` passed | `web/app/register/success/status-panel.test.ts:41` - `expect(text()).toContain("Your trial is registered.")`, but that text comes from the stand-in fallback at `:26`, not from the page's hero; `:43` - `expect(check).not.toHaveBeenCalled()`. No Sign in link is asserted, and the proof never reaches the page or `success-status.tsx`. The page hero's link is asserted only by the earlier C2532 (`success.test.ts:21`), which renders `Page` without separating the Suspense fallback from `SuccessStatus` with a null id | FAIL - level and precision gap: the route claim and its "Sign in link" half are unproven by the named proof |
| C4202 | with a session_id the panel renders "Setting up your workspace" and calls the action once, at once, with that id | vitest batch; passed | `status-panel.test.ts:49` - `expect(text()).toContain("Setting up your workspace")`; `:51` - `toHaveBeenCalledTimes(1)`; `:52` - `toHaveBeenCalledWith("cs_test_1")` | PASS |
| C4203 | ready: workspace ready, sign-in link emailed, Sign in to /login, stops asking | vitest batch; passed | `status-panel.test.ts:58` - `toContain("Your workspace is ready.")`; `:59` - `toContain("We emailed a sign-in link")`; `:60` - `expect(link("Sign in")?.getAttribute("href")).toBe("/login")`; `:62` - `toHaveBeenCalledTimes(1)` after 60 s | PASS |
| C4204 | refused: could not be set up, /contact link, no `email_in_use`/`invalid_metadata`, stops asking | vitest batch; passed (2 tests) | `status-panel.test.ts:68` - `toContain("We could not set up your workspace.")`; `:69` - `link("Contact us")?.getAttribute("href")).toBe("/contact")`; `:70-71` - `not.toContain("email_in_use")`, `not.toContain("invalid_metadata")`; `:73` - `toHaveBeenCalledTimes(1)` | PASS |
| C4205 | pending: asks every 3000 ms, exactly 20 calls, never a 21st | vitest batch; passed (2 tests) | `status-panel.test.ts:91` - `toHaveBeenCalledTimes(1)` at 2999 ms; `:93` - `toHaveBeenCalledTimes(2)` at 3000 ms; `:95` - `expect(check).toHaveBeenCalledTimes(20)` after 120 s | PASS |
| C4206 | after 20 pending: taking longer than usual, Sign in and contact links | vitest batch; passed | `status-panel.test.ts:102` - `toHaveBeenCalledTimes(19)`; `:105` - `toHaveBeenCalledTimes(20)`; `:106` - `toContain("This is taking longer than usual.")`; `:107` - `link("Sign in")...toBe("/login")`; `:108` - `link("Contact us")...toBe("/contact")` | PASS |
| C4207 | action rejects or answers unavailable: C4206 wording, stops asking, does not throw | vitest batch; passed (rejects, answers unavailable) | `status-panel.test.ts:117` - `toContain("This is taking longer than usual.")`; `:118` - `expect(link("Sign in")).toBeTruthy()`; `:120` - `toHaveBeenCalledTimes(1)` after 60 s | PASS |
| C4208 | action returns the port's pending/ready/refused; unavailable when the port throws | vitest batch; passed (5 tests) | `web/app/register/success/actions.test.ts:13` - `expect(await checkWorkspaceAction("cs_test_1")).toBe(answer)` (each of 3); `:20` - `.toBe("unavailable")` on reject; `:24-26` - a non-string id gives `unavailable` and the port is never called | PASS |
| C4209 | panelFor history table: 1/19 pending waiting, 20 pending slow, ready (also after pendings), refused, unavailable slow | vitest batch; passed (11 tests) | `web/domain/billing/workspace-state.test.ts:24` - `expect(panelFor(answers)).toBe(panel)` over rows `:13-22`; `:16` - `"20 pending", pending(20), "slow"`; `:8-9` - `WORKSPACE_POLL_MS` 3000, `WORKSPACE_MAX_POLLS` 20 | PASS |
| C4210 | `checkout_workspace_status` ready for a matching processed event | `npm run test:db workspace_pending_state` PASS | `supabase/tests/workspace_pending_state.sql:50` - `tests.ok('C4210', tests.wps_status('cs_wps_ready') = 'ready', ...)` | PASS |
| C4211 | exactly `refused`, no code | test:db PASS | `workspace_pending_state.sql:59` - `v = 'refused'`; `:60` - `v not like '%invalid_metadata%' and length(v) = 7` | PASS |
| C4212 | pending, no raise, for unprocessed, unknown, '', null, 5000 chars, `%`, other event type | test:db PASS | `workspace_pending_state.sql:71` - the input array `['cs_wps_pending','cs_wps_unknown','','%',repeat('x',5000),'cs_wps_other']`; `:74` - `tests.ok('C4212 ' \|\| n, v = 'pending', ...)`; `:77` - null gives `pending`; `:78` - `n = 6` | PASS |
| C4213 | one session, processed and refused: ready | test:db PASS | `workspace_pending_state.sql:85` - `tests.wps_status('cs_wps_both') = 'ready'` (events `:39-40`) | PASS |
| C4214 | definer, empty search_path, anon+authenticated execute, not public, no write | test:db PASS | `workspace_pending_state.sql:97` - `prosecdef`; `:98` - `proconfig @> array['search_path=""']`; `:99-100` - `has_function_privilege('anon'/'authenticated', f, 'execute')`; `:101-103` - no `EXECUTE` aclitem for grantee 0; `:104` - `provolatile = 's'` (Postgres refuses data-modifying statements in a non-volatile SQL function, which covers "every other table"); `:111-112` - row count and processed count unchanged | PASS |
| C4215 | `my_workspace_state` refused for a caller with only refused events | test:db PASS | `workspace_pending_state.sql:121` - `tests.wps_mine() = 'refused'`; `:123` - also matches a mixed-case, padded stored email | PASS |
| C4216 | pending for a caller with an unstamped event | test:db PASS | `workspace_pending_state.sql:130` - `tests.wps_mine() = 'pending'` | PASS |
| C4217 | none for no event, for a processed email, and no read of another email's events | test:db PASS | `workspace_pending_state.sql:137` - nobody gives `none` while other emails hold refused and pending events; `:139` - processed gives `none`; `:141` - refused then processed gives `none`; `:143` - other type gives `none`; `:145` - no email claim gives `none` | PASS |
| C4218 | anon gets 42501 | test:db PASS | `workspace_pending_state.sql:153` - `tests.expect_error('C4218', 'select public.my_workspace_state()', '42501')` | PASS |
| C4219 | NoWorkspace refused/pending/none copy and links | vitest batch; passed (4 tests) | `web/components/shell/no-workspace.test.ts:13` - exact text `toBe("Service Agreement No workspace yet Your account isn't part ... Sign out")` for undefined and none; `:21` - `toMatch(/<a\b[^>]*href=""[^>]*>\s*Refresh\s*<\/a>/)`; `:28` - `toContain("Your payment was received")`; `:31` - `toMatch(/<a\b[^>]*href="\/contact"[^>]*>\s*Contact us\s*<\/a>/)` | PASS |
| C4220 | MemberGate calls workspaceState once for no_membership, never for a member, falls back to none on throw | vitest batch; passed (4 tests) | `web/app/(app)/layout.test.ts:99` - `expect(workspaceState).toHaveBeenCalledTimes(1)`; `:107` - `expect(workspaceState).not.toHaveBeenCalled()` (member); `:113` - same for signed out; `:120-121` - `toContain("No workspace yet")`, `not.toContain("Setting up your workspace")` on reject | PASS |
| C4221 | adapters map replies, send p_session_id, throw on db error or unknown reply | vitest batch; passed (16 tests) | `web/infrastructure/supabase/workspace-state.test.ts:14` - `toHaveBeenCalledWith("checkout_workspace_status", { p_session_id: "cs_test_1" })`; `:19`, `:31` - each reply passed on; `:36`, `:41` - `rejects.toThrow()` on unknown replies; `:47-48` - the message carries `57014` and not the session id | PASS |
| C4222 | status read on a cookie-less client; getContainer exposes workspaceState on the cookie client | vitest batch; passed (2 tests) | `web/composition/workspace-state-wiring.test.ts:28` - `createClient.mock.calls[0]).toEqual([url, "sb_publishable_test", { auth: { persistSession: false, autoRefreshToken: false } }])`; `:29` - `createServerClient).not.toHaveBeenCalled()`; `:37` - `createServerClient).toHaveBeenCalledTimes(1)`; `:39` - `rpc).toHaveBeenCalledWith("my_workspace_state")` | PASS |
| C4223 | /register/success public, /register/success/x not; no path added | vitest batch; passed (5 tests) | `web/infrastructure/supabase/workspace-state-public.test.ts:25-26` - GET and POST `/register/success?session_id=...` give `status 200`, `location null`; `:33-34` - `/register/success/x`, `/register/success/status`, `/api/register/status` give `307` to `/login`. `git diff a2535ef..HEAD -- web/infrastructure/supabase/session.ts` is empty; `session.ts:10` still lists `"/register", "/register/success"` | PASS |
| C4224 | recipe registered; every SQL file in a recipe | vitest batch; runner.test.ts 26 passed. No test is named `C4224:`; the evidence sits in C201/C210 | `web/scripts/test-db/runner.test.ts:105` - `expect(RECIPES.map((recipe) => recipe.name)).toEqual(ALL)` with `"workspace_pending_state"` at `:43`; `:252` - `for (const file of REAL_FILES) expect(covered.has(file), file).toBe(true)`; `runner.mts:63` registers `fixture.sql`, the migration, `workspace_pending_state.sql` | PASS |

**Checks proven: 24/25.**

Notes that do not change a Result:

- C4224 breaks the convention stated in checks.md ("every new test name starts with its check id"). Its proof is a whole-file run with no `C4224:` test.
- The `C4209: %s -> %s` titles print the input history instead of the expected panel (for example, "one pending -> pending"). This is cosmetic, and the assertion at `:24` uses the right column.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plans in `success_url` (3) | `PLAN_CASES` in checkout.test.ts; plans starter, team, business | starter, team, business -> C4200 `checkout.test.ts:102` (test.each) | - |
| `GET /register/success` statuses (1) | plan Surface; `proxy.ts` and `session.ts:10` | 200 without session_id -> C2530 `proxy.billing.test.ts:28`; 200 with session_id -> C4223 `workspace-state-public.test.ts:25`. checks.md attributes both to C4201 and C4202, but those are component tests and assert no status | - |
| `/register/success` `session_id` read from the address (2) | plan Surface "optional session_id query" and Flow step 2; the reader is `success-status.tsx:10` `useSearchParams().get("session_id")` | absent -> C2532 (`success.test.ts:19-21`, page hero) plus C4201 at panel level; present -> the panel at the route: no proof reaches `success-status.tsx` (search for `SuccessStatus\|success-status\|session_id"` in `*.test.ts*` returns no match) | present, read from the URL and passed to the panel with the real action |
| Server Action answers (4) | `actions.ts:10-17`, `WorkspaceAnswer` in `workspace-state.ts:11` | pending, ready, refused -> C4208 `actions.test.ts:13`; unavailable -> C4208 `:20`, `:24-25`; panel side C4205/C4203/C4204/C4207 | - |
| `checkout_workspace_status` answers (3) | migration `20261112200000_workspace_pending_state.sql:12-16` | ready -> C4210 `:50`; refused -> C4211 `:59`; pending -> C4212 `:74` | - |
| `checkout_workspace_status` pending inputs (7) | plan AC 8 and door 2 | unprocessed, unknown, '', `%`, 5000 chars, other type -> C4212 `workspace_pending_state.sql:71,74`; null -> `:77` | - |
| `my_workspace_state` answers and statuses (4) | migration `:38-43`, grant `:52` | none -> C4217 `:137`; pending -> C4216 `:130`; refused -> C4215 `:121`; 42501 -> C4218 `:153` | - |
| `my_workspace_state` precedence branches (3) | migration `:39-42` (processed gives none, then refused, then pending) | processed wins over refused -> C4217 `:141`; refused -> C4215; pending -> C4216 | - |
| `panelFor` history table (7 plus 3 extra rows) | `workspace-state.ts:16-22` | every row -> C4209 `workspace-state.test.ts:13-22`, asserted at `:24` | - |
| `NoWorkspace` states (3) | `no-workspace.tsx` `COPY` record | none -> C4219 `no-workspace.test.ts:13`; pending -> `:19-21`; refused -> `:28-31` | - |
| `MemberGate` cases (4: member, no_membership, throw, signed_out) | `member-gate.tsx:16-26` | member -> C4220 `layout.test.ts:107`; no_membership -> `:99`; throw -> `:120`; signed_out -> `:113` | - |
| adapter replies and errors (8) | `infrastructure/supabase/workspace-state.ts:13-33` | status pending/ready/refused -> C4221 `workspace-state.test.ts:19`; mine none/pending/refused -> `:31`; unknown reply -> `:36`, `:41`; database error -> `:47`, `:50` | - |
| startup config: Supabase clients (2 assemblies) | read directly: `web/composition/index.ts:110` - `const supabase = createServerClient<Database>(url, key, { cookies: ... })` with `:182` - `workspaceState: supabaseMemberWorkspace(supabase).mine`; `index.ts:352` - `const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })` with `:353` - `return { workspaceStatus: supabaseWorkspaceStatus(supabase) }`; `key` is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`:351`) | cookie client -> C4222 `workspace-state-wiring.test.ts:37-39`; cookie-less anon -> C4222 `:28-29`. The test imports the real `./index` and replaces only the client constructors | - |
| doors in Landing (3) | plan Landing | door 1 -> C4200; door 2 -> C4210-C4214; door 3 -> C4215-C4218 | - |

Other requested checks:

- **Neither RPC returns a stored body or error code.** Both `case` expressions return only literals: `'ready' / 'refused' / 'pending'` at migration `:13-15` and `'none' / 'refused' / 'pending' / 'none'` at `:39-42`. Neither function selects `body` or `process_error`. C4211 (`:60`, `length(v) = 7`) proves this for door 2. Door 3 has no equivalent assertion, but its code is literal-only.
- **The Server Action is the only caller path for the anonymous read.** `checkout_workspace_status` appears in app code only at `infrastructure/supabase/workspace-state.ts:16`. `supabaseWorkspaceStatus` is built only at `composition/index.ts:353`, inside `getWorkspaceStatusContainer`, and that function's only caller is `app/register/success/actions.ts:13`. At the database level `anon` may call it by design (door 2).
- **`status-panel.tsx` makes at most 20 asks.** `status-panel.tsx:37`: `if (answer === "pending" && asked + 1 < WORKSPACE_MAX_POLLS)` re-arms the timer only while `asked` runs 0..18, so at most 20 asks happen. Fault 1 shows C4205 catches a 21st.
- **`MemberGate` never calls `workspaceState` for a member.** The call at `member-gate.tsx:21` sits inside `if (member.status === "no_membership")` at `:17`. Fault 4 shows C4220 catches a call made for every member.
- **`PUBLIC_PATHS` is unchanged.** The diff for `web/infrastructure/supabase/session.ts` over `a2535ef..HEAD` is empty.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`panelFor`) | `domain/billing/workspace-state.ts` | own layer C4209 | yes - every history row asserted at `workspace-state.test.ts:24` |
| Entry point that decides nothing (Server Action, page, `MemberGate`) | `app/register/success/actions.ts`, `app/register/success/page.tsx` + `success-status.tsx`, `app/(app)/member-gate.tsx` | boundary: C4208, C4220, and for the page C2532 only | unmet - the page's accepted input (`session_id` read at `success-status.tsx:10`) has no proof. Action (accepted, rejected non-string, error) and MemberGate (all 4 cases) are covered |
| Client component with timers | `app/register/success/status-panel.tsx` | action injected: C4201-C4207 | yes - waiting, ready, refused and slow panels plus the 20-call bound and the unmount stop |
| Adapter | `infrastructure/supabase/workspace-state.ts` | client double: C4221 | yes - payload `:14`, `:26`; each reply `:19`, `:31`; unknown `:36`, `:41`; db error `:47` |
| SQL function that decides | migration `20261112200000_workspace_pending_state.sql` | rolled-back recipe C4210-C4218 | yes - each answer, the 7 pending inputs, door 2 grants (`:99-103`), door 3 anon 42501 (anon is a member of PUBLIC, so PUBLIC holds execute only if anon does) |
| Instrumentation, pass-throughs | `composition/index.ts` additions, `database.types.ts`, `runner.mts` | consumer's proof | yes - C4222 and C4224 |

## Faults injected

Isolation: `git worktree add --detach <scratchpad>\wt HEAD`. `web/node_modules` was a junction and `.env.local` was copied. Baseline `git status --porcelain` of the real tree was `?? node_modules/` before and after. The worktree was removed with the junction unlinked first, and `git worktree list` no longer shows it.

| Mutation | Location | Killed |
| --- | --- | --- |
| poll bound `asked + 1 < WORKSPACE_MAX_POLLS` -> `asked < WORKSPACE_MAX_POLLS` (21 asks) | `web/app/register/success/status-panel.tsx:37` | yes - C4205 `status-panel.test.ts:95` "expected 20 times, but got 21" |
| `answers.length >= WORKSPACE_MAX_POLLS` -> `>` | `web/domain/billing/workspace-state.ts:21` | yes - C4209 "20 pending" `workspace-state.test.ts:24` expected 'slow', got 'waiting' |
| success_url braces encoded `{CHECKOUT_SESSION_ID}` -> `%7BCHECKOUT_SESSION_ID%7D` | `web/infrastructure/stripe/checkout.ts:55` | yes - C4200 x3 `checkout.test.ts:102` |
| MemberGate asks `workspaceState()` for every status before branching | `web/app/(app)/member-gate.tsx:14` | yes - C4220 `layout.test.ts:99`, `:107`, `:113` |
| door 2 precedence swapped: refused checked before ready | `supabase/migrations/20261112200000_workspace_pending_state.sql:13-14` | yes - `FAIL workspace_pending_state: C4213: the processed event did not win` |

The first run of fault 5 swapped a line in door 3 by mistake. It was discarded and rerun with only door 2 changed, and the result above is from that rerun. The cap of 5 left the adapter (C4221), action (C4208), NoWorkspace (C4219), wiring (C4222) and door 3 surfaces without an injected fault.

## Deviations judged

- **C2504's amended line (`checkout.test.ts:96`).** Legitimate. Only the `success_url` expectation changed, in commit `9297485`, the same commit that changed the starter, and plan AC 1 requires that exact value. The `cancel_url` line `:97` is untouched.
- **Runner counts 33/35 -> 34/36.** Legitimate. The only change is the count, and the recipe list `ALL` gained `workspace_pending_state` (`runner.test.ts:43`).
- **`success.test.ts` mock and dynamic import.** Legitimate as recorded: the assertions at `:17-43` are untouched. One related observation: C2533 ("reads no search params", `success.test.ts:33`) still passes only because the read moved from `page.tsx` into the child `success-status.tsx`. The page now reads a query value, as plan Impact row 3 says, so C2533's title no longer describes the page. It should be reworded rather than left as a guarantee it no longer gives.

## Gate

- `npx vitest run <11 proof files> --reporter=verbose`: 147 passed, 0 failed.
- `npm run test:db workspace_pending_state`: 1 passed, 0 failed.
- Full suite `npx vitest run` (from `web/`): 258 files, 4436 passed, 0 failed.

## Ranked gaps

1. No proof covers `success-status.tsx`, the only reader of `session_id` and the only place the real action is wired in. The page's `Test policy` row is unmet and a coverage member is unproven. Evidence: `web/app/register/success/success-status.tsx:10-11`, with no test reference anywhere.
2. C4201 is a level and precision gap. Its proof asserts a stand-in fallback (`status-panel.test.ts:26`, `:41`) instead of the page's static copy, and asserts no Sign in link. checks.md also says C4201 and C4202 "cross the boundary"; they do not.
3. Observation: C2533's title "reads no search params" is now narrower than what the page does (`success.test.ts:33`).
