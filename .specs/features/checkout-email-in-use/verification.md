# Checkout email in use verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: e641241..HEAD (d7195fe)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - no binding source (plan `Sources` lists only ROADMAP decision 9 and AD-131/174/182/183, none marked binding; the plan's Surface and Landing still feed the Coverage recompute) | n/a | none | - |

## Checks

All vitest proofs ran in one invocation (6 files, 126 passed, each C43xx name listed individually as passing); the SQL recipes ran in one invocation `npm run test:db checkout_email_in_use workspace_provisioning` (2 passed, 0 failed, rolled back). Every named test was found in the tree with grep.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C4300 | check `true` -> `email_in_use`, starter 0 calls | vitest `start-trial.test.ts -t C4300:` pass | `web/application/use-cases/start-trial.test.ts:145-146` - `expect(await checked(SELECTION)).toEqual({ status: "email_in_use" }); expect(start).not.toHaveBeenCalled()` | PASS |
| C4301 | check `false` -> starter once, redirect, one check | same run | `start-trial.test.ts:150-152` - `toEqual({ status: "redirect", url: URL_OK })`, `inUse` times 1, `start` times 1 | PASS |
| C4302 | membership email -> `true` | `test:db checkout_email_in_use` pass | `supabase/tests/checkout_email_in_use.sql:31` - `tests.ok('C4302 membership', tests.ceu_has('ua@example.test'), ...)` (anon role, rolled back) | PASS |
| C4303 | live invitation -> `true` | same | `checkout_email_in_use.sql:37` - `tests.ok('C4303 live invitation', tests.ceu_has('live@elsewhere.test'), ...)` | PASS |
| C4304 | expired / accepted-no-membership / unknown -> `false` | same | `checkout_email_in_use.sql:43,44,45` - `not tests.ceu_has('expired@...')`, `'accepted@...'`, `'nobody@nowhere.test'` | PASS |
| C4305 | padded mixed case: use case asks lower-cased; SQL matches padded | vitest `-t C4305:` pass + SQL | `start-trial.test.ts:157` - `expect(inUse).toHaveBeenCalledWith("owner@shop.ca")` (input `"  Owner@Shop.CA "`); `checkout_email_in_use.sql:51,52` - `tests.ceu_has(' UA@Example.Test ')`, `'  Live@Elsewhere.TEST '` | PASS |
| C4306 | invalid selections never ask the check | vitest `-t C4306:` pass (3 rows) | `start-trial.test.ts:165-167` - `toEqual(expected)`, `expect(inUse).not.toHaveBeenCalled()`, `expect(start).not.toHaveBeenCalled()` over no_trade, invalid_choice, invalid_details | PASS |
| C4307 | check throws (Error, non-error) -> `unavailable`, starter 0, one log line without email or message | vitest `-t C4307:` pass (2 rows) | `start-trial.test.ts:175-178` - `toEqual({ status: "unavailable" })`, `start` not called, `errorSpy` times 1, `not.toMatch(/owner@shop\.ca\|row 42/)` | PASS |
| C4308 | RegisterFields copy, `/login` "Sign in" link, `aria-invalid` plus described-by element, values and trades kept | vitest `register.test.ts -t C4308:` pass | `web/app/register/register.test.ts:200` - `toContain("This email already has a workspace.")`; `:201` - `toMatch(/<a [^>]*href="\/login"[^>]*>Sign in<\/a>/)`; `:202-205` - `aria-invalid="true"` and the describedby id present in the html; `:206-211` values, radios, checkboxes kept | PASS |
| C4309 | action state is exactly `{status,trades,values,fields:{email:true}}`; rendered message names no role, org or count | vitest `register-action.test.ts -t C4309:` pass | State half: `web/app/register/register-action.test.ts:102` - `toEqual({ status: "email_in_use", trades: ["hvac"], values: {...}, fields: { email: true } })`. Rendered half: NO assertion anywhere (grep for owner/member/invit negations in `register.test.ts` finds none; C4308 asserts only the positive text). The claim "the rendered message names none" is unasserted. The copy is a constant so the risk is low, but the check's own claim is not proven. | FAIL |
| C4314 | composition: no env -> check skipped, no client; configured -> one anon client from the publishable key, one rpc before Stripe; taken -> 0 Stripe | vitest `billing-container.stripe.test.ts -t C4314:` pass (4 tests) | `billing-container.stripe.test.ts:77-81` - `createClient` times 1, args `["https://db.example.com","sb_publishable_x"]`, `rpc` times 1 with `("email_has_workspace",{p_email:"owner@shop.ca"})`, fetch times 1; `:88-89` taken -> `{status:"email_in_use"}` and fetch not called; `:97-98` no Supabase vars -> `unavailable`, fetch not called; `:104-106` no env -> `not_configured`, createClient and rpc not called. "Before any Stripe request" is proven by the taken case, not by call order in the free case (acceptable). | PASS |
| C4315 | adapter: rpc name and arg, boolean returned, error names function and code only, non-boolean throws | vitest `workspace-email.test.ts -t C4315:` pass (7) | `web/infrastructure/supabase/workspace-email.test.ts:13-15` - `toBe(answer)`, rpc times 1, `toHaveBeenCalledWith("email_has_workspace",{p_email:"owner@shop.ca"})`; `:21` - message `toBe("email_has_workspace failed: 57014")`; `:27` - `rejects.toThrow("email_has_workspace answered a value it should not")` for null, "true", 1, undefined | PASS |
| C4310 | grants anon/authenticated, not public, stable, predicate not executable by anon/authenticated | `test:db checkout_email_in_use` pass | `checkout_email_in_use.sql:58,59` anon and authenticated `has_function_privilege`; `:60-62` no `aclexplode` grantee 0; `:63` `provolatile = 's'`; `:64,65` predicate not executable by anon or authenticated | PASS |
| C4311 | null, '', blank, malformed, 300 chars -> `false`, no error | same | `checkout_email_in_use.sql:71-75` - `tests.ceu_has(null) = false`, `''`, `'   '`, `'not-an-email'`, `repeat('a',300)\|\|'@example.test'` (an error would abort the DO block and fail the recipe) | PASS |
| C4312 | whole `workspace_provisioning.sql` passes with the migration | `test:db workspace_provisioning` pass | `web/scripts/test-db/runner.mts` recipe parts `["fixture.sql","../migrations/20261112210000_checkout_email_in_use.sql","workspace_provisioning.sql"]`; unchanged file `supabase/tests/workspace_provisioning.sql:252,254` (membership and live invitation refused `email_in_use`); `git diff e641241..HEAD` shows that file untouched | PASS |
| C4313 | two events, same email, different subscriptions: first processes, second `email_in_use`, one org | `test:db checkout_email_in_use` pass | `checkout_email_in_use.sql:97-98` two `process_checkout_event` calls on `evt_ceu_1`, `evt_ceu_2` (distinct `sub_ceu_*`, email `Racer@Shop.Test` for both); `:99-100` first `processed_at is not null and process_error is null`; `:101` one owner invitation; `:102-103` second `v_second is null` and `process_error = 'email_in_use'`; `:104-105` no org for the second, exactly one racer org | PASS |

Checks proven: 14/15 (C4309 fails on the rendered-message half).

Sweeps:

- Startup config: `web/composition/index.ts:366-381` is the only assembly. A grep for `makeStartTrial` over non-test sources finds only the definition (`start-trial.ts:25`), the barrel export, and `composition/index.ts:381` - `return { startTrial: makeStartTrial(checkout, emailCheck) };` with `emailCheck` built only under `secretKey && appBaseUrl` (lines 370-379). The second parameter is optional, so a future assembly could omit the check silently; no test forbids that, but there is no second assembly today.
- Level: statuses and states (AC 1, 5, 6 at the Server Action; AC 10 at the RPC) are proven at the Server Action function (`register-action.test.ts:102`, composition mocked) and the RPC called as `anon` in SQL. Neither crosses an HTTP or PostgREST boundary; this matches the Test policy rows (entry point at the boundary, SQL recipe) and the repo convention, so it is recorded, not failed. AC 7 is proven on the rendered markup of `RegisterFields` (`register.test.ts:200-205`), not in a browser; same convention.
- `Swept` rows that cite checks: validation C4305/C4306/C4311, failure C4307/C4315, authorization C4310, concurrency C4313, dependency failure C4307/C4314, observability C4307 - all exist and assert what the row names. The existing C2422 (no environment) still passes and is re-covered by `billing-container.stripe.test.ts:104-106`.
- Deviations: (a) C2512 amended - honest. The diff removes only `expect(createClient).not.toHaveBeenCalled()` and the title words "or Supabase client", and adds the Supabase env stubs; cookie, connection, `createServerClient`, one-Stripe-call and URL assertions are intact, and the new block asserts the anon client positively (`:77-78`). The removed assertion is superseded by the plan's Impact row, not silently weakened. (b) `runner.test.ts` counts 34->35 and 36->37: every changed number is a count, `ALL` gained the new recipe, no assertion was relaxed (diff read in full). (c) Optional second parameter: true (`start-trial.ts:25`), and the older one-argument tests are unedited. (d) C4312 via the `workspace_provisioning` recipe with the migration inserted: true (`runner.mts` diff).
- Precision notes (not failures): the regex and length guard in `email_has_workspace` is behaviourally redundant with `private.email_in_use` returning `false` for non-emails, so C4311 cannot tell a dropped guard from the real one (equivalent mutant, no wrong behaviour reachable). C4310 "writes nothing" is proven only by `provolatile = 's'`.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `startTrialAction` states (7) | `web/app/register/state.ts`, `start-trial.ts` outcome union, plan Surface | redirect C4301 · no_trade, invalid_choice, invalid_details C4306 · not_configured C4314 (`:104-106`) · unavailable C4307 · email_in_use C4300, C4309 | - |
| `email_has_workspace` answers (2) and status (1) | `migration.sql:23-30` | true C4302, C4303 (`sql:31,37`) · false C4304, C4311 (`sql:43-45,71-75`) · 200 never an error C4311 | - |
| email situations (6) | `migration.sql:8-15` (two exists arms and the window) | membership C4302 · live invitation C4303 · expired C4304 · accepted C4304 · none C4304 · padded mixed case C4305 | - |
| grants (3 roles) and predicate execution (2) | `migration.sql:17,32-33` revokes and grants | anon, authenticated, public C4310 (`sql:58-62`) · predicate anon, authenticated C4310 (`sql:64-65`) | - |
| doors (2) | plan Landing | door 1 C4310, C4311, C4315 · door 2 C4310, C4312 | - |
| startup config: anon client assembly (1) | `composition/index.ts:366-381`, the only `makeStartTrial` call | C4314 (all 4 branches) | - |
| register-form copy states (4) plus AC 8 | plan AC 7 and AC 8 | message C4308 · Sign in link C4308 · email field in error C4308 · values kept C4308 · message names no role, org or count: state shape C4309, rendered copy not asserted | AC 8 rendered-message half (named by C4309's claim) has no assertion |
| AC 1-12 (plan Criteria) | plan.md | AC1 C4300, C4302 · AC2 C4300, C4303 · AC3 C4301, C4304 · AC4 C4305 · AC5 C4306 · AC6 C4307 · AC7 C4308 · AC8 C4309 (partial) · AC9 C4310 · AC10 C4311 · AC11 C4312 · AC12 C4313 | AC 8 as above |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `application/use-cases/start-trial.ts` | own layer: `start-trial.test.ts` C4300, C4301, C4305, C4306, C4307 - one asserted case per row of the decision table (taken, free, normalised, 3 invalid, throw x2) | yes |
| Entry point that decides nothing | `app/register/actions.ts`, `register-fields.tsx` | boundary: `register-action.test.ts` C4309, `register.test.ts` C4308 - accepted input, each rejected input, the error path | yes (the missing AC 8 rendered-copy assertion is recorded on C4309) |
| Adapter | `infrastructure/supabase/workspace-email.ts` | against client double: `workspace-email.test.ts` C4315 - payload, both replies, error, non-boolean | yes |
| SQL function that decides | `20261112210000_checkout_email_in_use.sql` | rolled-back recipe: C4302-C4305, C4310, C4311, C4313 plus the C4312 replay; each answer, each excluded input, the grants | yes |
| Composition | `composition/index.ts` | fakes at the environment: C4314, 4 assembly branches (none, no Supabase vars, free, taken) | yes |
| Instrumentation, pass-throughs | `application/ports/index.ts`, `database.types.ts`, `state.ts`, `runner.mts` | none of its own; consumer proofs plus `runner.test.ts` (counts and file coverage, passes) | yes |

## Faults injected

Worktree `git worktree add --detach` under the scratchpad, `web/node_modules` junctioned, `.env.local` copied; removed afterwards (`git worktree list` shows no scratch entry). Real-tree `git status --porcelain` before and after: identical, only `?? node_modules/`.

| Mutation | Location | Killed |
| --- | --- | --- |
| use case ignores the check result (`if (await inUse(...)) return ...` became a bare `await inUse(...)`) | `web/application/use-cases/start-trial.ts:33` | yes - C4300 failed |
| composition builds the check even when Stripe is unconfigured (`secretKey && appBaseUrl` became `true`) | `web/composition/index.ts:372` | yes - C4314 "no environment" failed |
| `email_in_use` drops the invitation expiry (`and i.expires_at > now()` removed) | `supabase/migrations/20261112210000_checkout_email_in_use.sql:15` | yes - `FAIL checkout_email_in_use: C4304 expired invitation` |
| `email_has_workspace` drops lower-case and trim | `20261112210000_checkout_email_in_use.sql:31` | yes - `FAIL checkout_email_in_use: C4305 padded mixed case membership` |
| Sign in link removed from the form (`<Link href="/login">` became `<span>`) | `web/app/register/register-fields.tsx:103` | yes - C4308 failed |

5 injected, 5 killed. Not injected (cap of five): the adapter error-message mutation (C4315's assertion is an exact-string equality) and the redundant malformed-input guard (equivalent mutant, see precision notes).

## Gate

`cd web && npx vitest run` - 260 files, 4461 passed, 0 failed. `npx tsc --noEmit` - no errors outside the pre-existing `.next/types` and `app/setup/draft-actions.test.ts`. `npm run test:db checkout_email_in_use workspace_provisioning` - 2 passed, 0 failed.

## Gaps

1. C4309 claims "the rendered message names none (AC 8)" but only the state shape is asserted; no test checks the rendered `email_in_use` message for role, org or count words. Fix: add to C4308 or C4309 an assertion that the rendered text equals `This email already has a workspace. Sign in` or does not match `/owner|member|invit|org/i`. Evidence: `register.test.ts:198-211` and `register-action.test.ts:99-104` contain no such assertion.
