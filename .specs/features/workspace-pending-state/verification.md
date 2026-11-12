# Workspace pending state verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: a2535ef..766c428 (round 3 scope: fix commit 3bb1851..766c428, which changes only `web/app/register/success/success-status.test.ts`)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

All 25 checks are proven. Round 2's one failure is closed.

- **Round 2's failure:** fault 7 (deleting the hero's Sign in button) survived C4201, because the site header's own "Sign in" link satisfied the assertion.
- **This round's change:** both C4201 tests now look for the Sign in link only inside the hero section, so the site header's link no longer counts.
- **Fault 7 again:** deleting the hero's Sign in button is now killed by both C4201 tests.
- **Fault 8 (new):** changing the hero link's href from `/login` to `/logon` is also killed by both C4201 tests.

## Binding sources

Carried from fc29839: no source in the plan is marked binding, and step 1 runs only under `ui`.

## Checks

All proofs were re-run in full at 766c428.

- **Vitest:** one batched run from `web/` over the 12 proof files with `--reporter=verbose`. 12 files, 151 tests passed, 0 failed. Every `C42xx:` test is listed individually as passed.
- **SQL:** `npm run test:db workspace_pending_state` printed `PASS workspace_pending_state`, 1 passed, 0 failed.

The C4201 and C4202 citations were refreshed at 766c428, because the fix changed line numbers in that file. Every other evidence cell is carried from fc29839: the fix touched no other file, and those proofs passed again at 766c428.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4200 | success_url with literal braces for 3 plans; cancel_url unchanged | vitest batch at 766c428, passed | carried from fc29839: `web/infrastructure/stripe/checkout.test.ts:102` - `expect(form().get("success_url")).toBe("https://app.example.com/register/success?session_id={CHECKOUT_SESSION_ID}")`; `:103` cancel_url | PASS |
| C4201 | `/register/success` with no session_id renders "Your trial is registered." and the Sign in link; action never called | vitest batch at 766c428: both `C4201:` tests in success-status.test.ts passed, plus the panel-level one | verified at 766c428: `web/app/register/success/success-status.test.ts:55` - `expect(container.textContent).toContain("Your trial is registered.")` on the real `Page`; `:58-59` find the hero `section` whose `h1` reads "Your trial is registered." and its `Sign in` anchors; `:60` - `expect(signIn).toHaveLength(1)`; `:61` - `expect(signIn[0].getAttribute("href")).toBe("/login")`; `:63` - `expect(checkWorkspaceAction).not.toHaveBeenCalled()`; SSR `:69-70` - the hero slice `toMatch(/<a\b[^>]*href="\/login"[^>]*>\s*Sign in\s*<\/a>/)`. Faults 7 and 8 were both killed | PASS |
| C4202 | with a session_id the panel renders "Setting up your workspace" and calls the action once, at once, with that id | vitest batch at 766c428, passed | verified at 766c428: `success-status.test.ts:41` - `toHaveBeenCalledTimes(1)`; `:42` - `toHaveBeenCalledWith("cs_test_abc")`; `:43` - `toContain("Setting up your workspace")`; `:49` - near-miss names `not.toHaveBeenCalled()`; panel level `status-panel.test.ts:49-52` | PASS |
| C4203 | ready panel, Sign in to /login, stops asking | vitest batch at 766c428, passed | carried from fc29839: `status-panel.test.ts:58-60`, `:62` | PASS |
| C4204 | refused panel, /contact, no codes, stops asking | vitest batch at 766c428, passed | carried from fc29839: `status-panel.test.ts:68-71`, `:73` | PASS |
| C4205 | every 3000 ms, exactly 20 calls | vitest batch at 766c428, passed | carried from fc29839: `status-panel.test.ts:91`, `:93`, `:95` - `toHaveBeenCalledTimes(20)` | PASS |
| C4206 | after 20 pending, taking-longer wording with Sign in and contact | vitest batch at 766c428, passed | carried from fc29839: `status-panel.test.ts:105-108` | PASS |
| C4207 | reject or unavailable, C4206 wording, stops, no throw | vitest batch at 766c428, passed | carried from fc29839: `status-panel.test.ts:117-118`, `:120` | PASS |
| C4208 | action returns the port's answer; unavailable on throw | vitest batch at 766c428, passed | carried from fc29839: `web/app/register/success/actions.test.ts:13`, `:20`, `:24-26` | PASS |
| C4209 | panelFor history table | vitest batch at 766c428, passed | carried from fc29839: `web/domain/billing/workspace-state.test.ts:24` - `expect(panelFor(answers)).toBe(panel)` over rows `:13-22`; `:8-9` | PASS |
| C4210 | ready for a processed match | test:db at 766c428 PASS | carried from fc29839: `supabase/tests/workspace_pending_state.sql:50` | PASS |
| C4211 | exactly refused, no code | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:59-60` | PASS |
| C4212 | 7 inputs answer pending | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:71`, `:74`, `:77`, `:78` | PASS |
| C4213 | processed plus refused answers ready | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:85` | PASS |
| C4214 | definer, search_path, grants, no write | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:97-104`, `:111-112` | PASS |
| C4215 | my_workspace_state answers refused | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:121`, `:123` | PASS |
| C4216 | answers pending | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:130` | PASS |
| C4217 | none cases, no read across emails | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:137-145` | PASS |
| C4218 | anon gets 42501 | test:db at 766c428 PASS | carried from fc29839: `workspace_pending_state.sql:153` | PASS |
| C4219 | NoWorkspace states | vitest batch at 766c428, passed | carried from fc29839: `web/components/shell/no-workspace.test.ts:13`, `:21`, `:28`, `:31` | PASS |
| C4220 | MemberGate calls | vitest batch at 766c428, passed | carried from fc29839: `web/app/(app)/layout.test.ts:99`, `:107`, `:113`, `:120-121` | PASS |
| C4221 | adapters | vitest batch at 766c428, passed | carried from fc29839: `web/infrastructure/supabase/workspace-state.test.ts:14`, `:19`, `:31`, `:36`, `:41`, `:47-48` | PASS |
| C4222 | client wiring | vitest batch at 766c428, passed | carried from fc29839: `web/composition/workspace-state-wiring.test.ts:28-29`, `:37-39` | PASS |
| C4223 | public paths unchanged | vitest batch at 766c428, passed | carried from fc29839: `web/infrastructure/supabase/workspace-state-public.test.ts:25-26`, `:33-34`; `session.ts:10` unchanged | PASS |
| C4224 | recipe registered, every file in a recipe | vitest batch at 766c428, runner.test.ts passed | carried from fc29839: `web/scripts/test-db/runner.test.ts:105` with `:43`; `:252` | PASS |

**Checks proven: 25/25.**

## Coverage

The `session_id` row was carried from 3bb1851; this fix changed neither `success-status.tsx` nor the C4202 assertions, only their line numbers. Every other row is carried from fc29839.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `/register/success` `session_id` read from the address (2, plus a near-miss name) | carried from 3bb1851: `success-status.tsx:10` `useSearchParams().get("session_id")`, `:11` passes `checkWorkspaceAction` | present -> C4202 `success-status.test.ts:41-43`; near-miss name -> `:49-50`; absent -> C4201 `:55`, `:60-61`, `:63` | - |
| plans in `success_url` (3) | carried from fc29839 | C4200 `checkout.test.ts:102` | - |
| `GET /register/success` statuses (1) | carried from fc29839 | without id -> C2530 `proxy.billing.test.ts:28`; with id -> C4223 `workspace-state-public.test.ts:25` | - |
| Server Action answers (4) | carried from fc29839 | C4208 `actions.test.ts:13`, `:20`, `:24-25` | - |
| `checkout_workspace_status` answers (3) | carried from fc29839 | C4210 `:50`, C4211 `:59`, C4212 `:74` | - |
| `checkout_workspace_status` pending inputs (7) | carried from fc29839 | C4212 `workspace_pending_state.sql:71,74,77` | - |
| `my_workspace_state` answers and statuses (4) | carried from fc29839 | C4217 `:137`, C4216 `:130`, C4215 `:121`, C4218 `:153` | - |
| `my_workspace_state` precedence branches (3) | carried from fc29839 | C4217 `:141`, C4215, C4216 | - |
| `panelFor` history table | carried from fc29839 | C4209 `workspace-state.test.ts:13-22`, `:24` | - |
| `NoWorkspace` states (3) | carried from fc29839 | C4219 `no-workspace.test.ts:13`, `:19-21`, `:28-31` | - |
| `MemberGate` cases (4) | carried from fc29839 | C4220 `layout.test.ts:99`, `:107`, `:113`, `:120` | - |
| adapter replies and errors (8) | carried from fc29839 | C4221 `workspace-state.test.ts:19`, `:31`, `:36`, `:41`, `:47`, `:50` | - |
| startup config: Supabase clients (2 assemblies) | carried from fc29839: `web/composition/index.ts:110` `createServerClient<Database>(url, key, { cookies ... })` with `:182` `workspaceState: supabaseMemberWorkspace(supabase).mine`; `index.ts:352` `createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })` with `:353` `supabaseWorkspaceStatus(supabase)` | C4222 `workspace-state-wiring.test.ts:28-29`, `:37-39` | - |
| doors in Landing (3) | carried from fc29839 | C4200; C4210-C4214; C4215-C4218 | - |

These spot checks are carried from fc29839, since the fix touched none of these files:

- `PUBLIC_PATHS` is unchanged.
- Neither RPC returns a stored body or error code: migration `:13-15` and `:39-42` return literals only.
- The status panel asks at most 20 times: `status-panel.tsx:37`.
- The Server Action is the only path to the anonymous read: `actions.ts:13` -> `index.ts:353` -> `workspace-state.ts:16`.
- `MemberGate` calls `workspaceState` only for a person with no membership: the call at `member-gate.tsx:21` sits inside the branch at `:17`.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`panelFor`) | `domain/billing/workspace-state.ts` | own layer C4209 | yes (carried from fc29839) |
| Entry point that decides nothing (Server Action, page, `MemberGate`) | `actions.ts`, `page.tsx` + `success-status.tsx`, `member-gate.tsx` | boundary: C4208, C4201/C4202 (`success-status.test.ts`), C4220 | yes (verified at 766c428) - accepted input `session_id` `:41-43`; near-miss name `:49`; absent with the hero's Sign in `:60-61`; action error path `actions.test.ts:20`; MemberGate 4 cases |
| Client component with timers | `status-panel.tsx` | action injected: C4201-C4207 | yes (carried from fc29839) |
| Adapter | `infrastructure/supabase/workspace-state.ts` | client double: C4221 | yes (carried from fc29839) |
| SQL function that decides | migration `20261112200000_workspace_pending_state.sql` | rolled-back recipe C4210-C4218 | yes (carried from fc29839) |
| Instrumentation, pass-throughs | `composition/index.ts` additions, `database.types.ts`, `runner.mts` | consumer's proof | yes (carried from fc29839) |

## Faults injected

Faults 7 and 8 ran this round in a scratch worktree, `git worktree add --detach <scratchpad>\wt3 766c428`, with `web/node_modules` reached through a junction.

- The real tree's `git status --porcelain` was the same before and after: ` M .specs/features/workspace-pending-state/verification.md` (this report, still uncommitted from the earlier rounds) and `?? node_modules/`.
- The worktree was removed after the junction was unlinked, and `git worktree list` no longer shows it.
- Faults 1-5 are carried from fc29839 and fault 6 from 3bb1851. Neither fix touched the files those faults mutate, nor the assertions that killed them; only line numbers moved.

| Mutation | Location | Killed |
| --- | --- | --- |
| poll bound `asked + 1 <` -> `asked <` (carried from fc29839) | `web/app/register/success/status-panel.tsx:37` | yes - C4205 `status-panel.test.ts:95` |
| `answers.length >=` -> `>` (carried from fc29839) | `web/domain/billing/workspace-state.ts:21` | yes - C4209 `workspace-state.test.ts:24` |
| success_url braces encoded (carried from fc29839) | `web/infrastructure/stripe/checkout.ts:55` | yes - C4200 x3 `checkout.test.ts:102` |
| MemberGate asks for every status (carried from fc29839) | `web/app/(app)/member-gate.tsx:14` | yes - C4220 `layout.test.ts:99`, `:107`, `:113` |
| door 2 checks refused before ready (carried from fc29839) | `supabase/migrations/20261112200000_workspace_pending_state.sql:13-14` | yes - `FAIL workspace_pending_state: C4213` |
| `get("session_id")` -> `get("sessionId")` (carried from 3bb1851) | `web/app/register/success/success-status.tsx:10` | yes - C4202 `success-status.test.ts:41`, `:49` |
| hero `<div><LinkButton href="/login" variant="primary">Sign in</LinkButton></div>` deleted (verified at 766c428; survived at 3bb1851) | `web/app/register/success/page.tsx:21-25` | yes - both C4201 tests: `success-status.test.ts:60` "expected [] to have a length of 1 but got +0"; `:70` the hero slice does not match the Sign in anchor |
| hero link `href="/login"` -> `href="/logon"` (verified at 766c428) | `web/app/register/success/page.tsx:22` | yes - both C4201 tests: `success-status.test.ts:61` "expected '/logon' to be '/login'"; `:70` no match |

## Gate

All results are at 766c428:

- `npx vitest run <12 proof files> --reporter=verbose`: 151 passed, 0 failed.
- `npm run test:db workspace_pending_state`: 1 passed, 0 failed.
- Full suite, `npx vitest run` from `web/`: 259 files, 4440 passed, 0 failed.

## Observations (non-failing, carried)

- C2533's title, "reads no search params" (`success.test.ts:33`), no longer describes the page. The page now reads a query value through its child `success-status.tsx`, as plan Impact row 3 states.
- No test is named `C4224:`. Its evidence is in C201 and C210.
- The `C4209: %s -> %s` titles print the input history rather than the expected panel.
