# Checkout email in use verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: e641241..HEAD (7f2f5e0)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 (at d7195fe) failed on one gap: C4309's rendered-message half had no assertion. Fix commit 7f2f5e0 added a test in `web/app/register/register.test.ts` and a second Proof line on C4309. All proofs were re-run in full at 7f2f5e0. Sections not touched by the fix are marked `carried from d7195fe` (round 1, range e641241..d7195fe, fix diff 5c08713..d7195fe contains no change to them).

## Binding sources

carried from d7195fe

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - no binding source (plan `Sources` lists only ROADMAP decision 9 and AD-131/174/182/183, none marked binding; the plan's Surface and Landing still feed the Coverage recompute) | n/a | none | - |

## Checks

Proofs re-run at 7f2f5e0 (verified at 7f2f5e0): whole suite `npx vitest run` and `npm run test:db checkout_email_in_use workspace_provisioning` (2 passed, 0 failed). Citations for checks other than C4308 and C4309 are carried from d7195fe; the fix touched no file they cite, and their tests passed again in the full run.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4300 | check `true` -> `email_in_use`, starter 0 calls | whole-suite run, pass (carried citation from d7195fe) | `web/application/use-cases/start-trial.test.ts:145-146` - `toEqual({ status: "email_in_use" })`, `expect(start).not.toHaveBeenCalled()` | PASS |
| C4301 | check `false` -> starter once, redirect, one check | same | `start-trial.test.ts:150-152` - `toEqual({ status: "redirect", url: URL_OK })`, `inUse` times 1, `start` times 1 | PASS |
| C4302 | a `not.toMatch` over owner, admin, member, invit, org and digitsship email -> `true` | `test:db` pass | `supabase/tests/checkout_email_in_use.sql:31` - `tests.ok('C4302 membership', tests.ceu_has('ua@example.test'), ...)` | PASS |
| C4303 | live a `not.toMatch` over owner, admin, member, invit, org and digitsation -> `true` | same | `checkout_email_in_use.sql:37` - `tests.ok('C4303 live invitation', ...)` | PASS |
| C4304 | expired / accepted-no-a `not.toMatch` over owner, admin, member, invit, org and digitsship / unknown -> `false` | same | `checkout_email_in_use.sql:43,44,45` - `not tests.ceu_has(...)` x3 | PASS |
| C4305 | padded mixed case matches, use case asks lower-cased | whole-suite + `test:db` pass | `start-trial.test.ts:157` - `toHaveBeenCalledWith("owner@shop.ca")`; `checkout_email_in_use.sql:51,52` - `tests.ceu_has(' UA@Example.Test ')`, `'  Live@Elsewhere.TEST '` | PASS |
| C4306 | invalid selections never ask the check | whole-suite pass | `start-trial.test.ts:165-167` - `toEqual(expected)`, `inUse` not called, `start` not called (3 rows) | PASS |
| C4307 | check throws -> `unavailable`, starter 0, one log line without email or message | whole-suite pass | `start-trial.test.ts:175-178` - `toEqual({ status: "unavailable" })`, `errorSpy` times 1, a `not.toMatch` over the email and the thrown text | PASS |
| C4308 | RegisterFields copy, `/login` "Sign in", aria-invalid + described-by, values kept | `register.test.ts -t C4308:` pass at 7f2f5e0 (refreshed) | `web/app/register/register.test.ts:200` - `toContain("This email already has a workspace.")`; `:201` - `toMatch(/<a [^>]*href="\/login"[^>]*>Sign in<\/a>/)`; `:202-205` aria-invalid and describedby id; `:206-211` values, radios, checkboxes kept | PASS |
| C4309 | action state is exactly `{status,trades,values,fields:{email:true}}`; rendered message names no role, org or count | `register-action.test.ts -t C4309:` and `register.test.ts -t C4309:` both pass at 7f2f5e0 (both listed individually in verbose output) | State half: `web/app/register/register-action.test.ts:102` - `toEqual({ status: "email_in_use", trades: ["hvac"], values: {...}, fields: { email: true } })`. Rendered half (new): `web/app/register/register.test.ts:218` - `expect(message).toBe("This email already has a workspace. Sign in")` and `:219` - a `not.toMatch` over owner, admin, member, invit, org and digits, where `message` is the text of the `<p id="register-email-message">` element (`:217`). Re-judged: the exact-string assertion plus the negative match settle the "names none" claim at the rendered level. | PASS |
| C4314 | composition branches (none, free, taken, no Supabase vars) | whole-suite pass | `web/composition/billing-container.stripe.test.ts:77-81` (one anon client, one rpc, one Stripe), `:88-89`, `:97-98`, `:104-106`; sole assembly `web/composition/index.ts:366-381`, only `makeStartTrial` call at `:381` | PASS |
| C4315 | adapter payload, replies, errors | whole-suite pass | `web/infrastructure/supabase/workspace-email.test.ts:13-15`, `:21` (`toBe("email_has_workspace failed: 57014")`), `:27` | PASS |
| C4310 | grants, stable, predicate not executable | `test:db` pass | `checkout_email_in_use.sql:58-65` | PASS |
| C4311 | null, '', blank, malformed, 300 chars -> `false`, no error | `test:db` pass | `checkout_email_in_use.sql:71-75` | PASS |
| C4312 | whole `workspace_provisioning.sql` passes with the migration | `test:db workspace_provisioning` pass | recipe in `web/scripts/test-db/runner.mts`; `supabase/tests/workspace_provisioning.sql:252,254` untouched | PASS |
| C4313 | two events, same email: first processes, second `email_in_use`, one a `not.toMatch` over owner, admin, member, invit, org and digits | `test:db` pass | `checkout_email_in_use.sql:97-105` (two `process_checkout_event` calls; `:102-103` second `process_error = 'email_in_use'`) | PASS |

Checks proven: 15/15.

Carried sweeps (from d7195fe, unchanged by the fix): startup config has a single assembly (`composition/index.ts:366-381`); level notes (Server Action and RPC proven below HTTP, per the Test policy rows and repo convention); `Swept` rows cite existing checks that assert what they name; the four Deviations (C2512, runner counts, optional second parameter, C4312 recipe) are honest and no assertion was weakened.

## Coverage

AC 8 / register-form copy row re-judged at 7f2f5e0; other rows carried from d7195fe.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `startTrialAction` states (7) | `state.ts`, `start-trial.ts` outcome union, plan Surface | redirect C4301 · no_trade, invalid_choice, invalid_details C4306 · not_configured C4314 · unavailable C4307 · email_in_use C4300, C4309 | - |
| `email_has_workspace` answers (2) and status (1) | `migration.sql:23-30` | true C4302, C4303 · false C4304, C4311 · 200 never an error C4311 | - |
| email situations (6) | `migration.sql:8-15` | a `not.toMatch` over owner, admin, member, invit, org and digitsship C4302 · live invitation C4303 · expired C4304 · accepted C4304 · none C4304 · padded mixed case C4305 | - |
| grants (3 roles) and predicate execution (2) | `migration.sql:17,32-33` | C4310 | - |
| doors (2) | plan Landing | door 1 C4310, C4311, C4315 · door 2 C4310, C4312 | - |
| startup config: anon client assembly (1) | `composition/index.ts:366-381` | C4314 | - |
| register-form copy states (4) plus AC 8 | plan AC 7 and AC 8 | message C4308 · Sign in link C4308 · email field in error C4308 · values kept C4308 · message names no role, a `not.toMatch` over owner, admin, member, invit, org and digits or count: state C4309 (`register-action.test.ts:102`), rendered copy C4309 (`register.test.ts:218-219`) | - |
| AC 1-12 (plan Criteria) | plan.md | AC1 C4300, C4302 · AC2 C4300, C4303 · AC3 C4301, C4304 · AC4 C4305 · AC5 C4306 · AC6 C4307 · AC7 C4308 · AC8 C4309 · AC9 C4310 · AC10 C4311 · AC11 C4312 · AC12 C4313 | - |

## Test policy rows

carried from d7195fe, except the entry-point row re-judged at 7f2f5e0.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `application/use-cases/start-trial.ts` | `start-trial.test.ts` C4300, C4301, C4305, C4306, C4307 | yes |
| Entry point that decides nothing | `app/register/actions.ts`, `register-fields.tsx` | `register-action.test.ts` C4309 state; `register.test.ts` C4308 and C4309 rendered copy | yes |
| Adapter | `workspace-email.ts` | `workspace-email.test.ts` C4315 | yes |
| SQL function that decides | `20261112210000_checkout_email_in_use.sql` | C4302-C4305, C4310, C4311, C4313, C4312 replay | yes |
| Composition | `composition/index.ts` | C4314, 4 branches | yes |
| Instrumentation, pass-throughs | `ports/index.ts`, `database.types.ts`, `state.ts`, `runner.mts` | none of its own; consumer proofs | yes |

## Faults injected

Round 1 (carried from d7195fe, all killed): use case ignores the check result (`start-trial.ts:33`, C4300); composition builds the check without Stripe (`composition/index.ts:372`, C4314); SQL drops a `not.toMatch` over owner, admin, member, invit, org and digitsation expiry (`migration.sql:15`, C4304); SQL drops lower-case and trim (`migration.sql:31`, C4305); Sign in link removed (`register-fields.tsx:103`, C4308).

Round 2 (verified at 7f2f5e0), on the new surface, in a `git worktree add --detach` scratch under the scratchpad (removed afterwards; real-tree `git status --porcelain` before and after identical, only `?? node_modules/`):

| Mutation | Location | Killed |
| --- | --- | --- |
| rendered message made to mention the a `not.toMatch` over owner, admin, member, invit, org and digits (`This email already has a workspace.` -> `... in your org.`) | `web/app/register/register-fields.tsx` `EMAIL_IN_USE` constant | yes - the new `C4309: the rendered email_in_use message names no role, org, invitation or count` failed (C4308 failed too, on its exact text) |

6 injected in total, 6 killed.

## Gate

`cd web && npx vitest run` at 7f2f5e0 - 260 files, 4462 passed, 0 failed (4461 at round 1 plus the new test). `npm run test:db checkout_email_in_use workspace_provisioning` - 2 passed, 0 failed.
