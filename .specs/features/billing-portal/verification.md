# Stripe Customer Portal verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 6822c5a..3814306
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope of this round: the fix's diff (`089a7cb..3814306`, one commit: new tests `web/components/settings/billing-in-settings.test.ts` and `web/app/(app)/settings/page.test.ts`, the C2916 row in `checks.md`; no production code touched) plus every verdict that was not PASS in round 1 (C2915, the `GET /settings` coverage and binding-source cells, the Test policy row "Entry point (page)", fault X1). All proofs re-ran in full at `3814306`. Everything else is carried from round 1 and marked so.

Real tree `git status --porcelain` before fault injection: `?? .specs/features/billing-portal/verification.md` (the round-1 report, untracked); after: identical. During this round the author began unrelated uncommitted work in the real tree (task-library removal: staged deletions under `web/app/(app)/task-library*` and `web/components/task-library/`, edits to `settings-view.tsx`, `settings.test.ts`, setup, vocabulary, `month-grid.tsx`, `purity.test.ts`, new `task-library-removed.test.ts`). It is outside the diff range. To keep it out of the evidence, the proofs and the Gate were re-run from a second fresh detached worktree of `3814306` (`wt-r2b`, clean porcelain), and those are the numbers reported below. Real tree porcelain was recorded immediately before and after that second worktree's life and was identical (author's paths plus this report). Faults ran in a detached `git worktree` of `3814306` under the scratchpad with a junction to `web/node_modules`; the junction was removed with `rmdir` (target intact) and the worktree removed and pruned. No `git stash`. Nothing committed, pushed, applied to a database or sent to Stripe. No Playwright run was made by me.

Round-1 gap 2 (page mount unproven, X1 survived) is closed: X1 is now killed. Round-1 gap 1 remains: C2915's live half is author-run evidence I did not observe, and even as reported it does not cover the touch tap the check names. That alone keeps the verdict FAIL.

## Binding sources

Carried from 089a7cb, except the Surface `GET /settings` row, verified at 3814306 (the only row with a non-empty cell in round 1). The fix touched no interface, so Step 1 is not re-run otherwise.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| Landing door 1 (`OrgBilling.get`, member's own client) - carried from 089a7cb | yes - plan.md:54 | none | - |
| Landing door 2 (`BillingPortal.open`, raw `fetch`) - carried from 089a7cb | yes - plan.md:55 | none | - |
| Relations (`ORG \|\|--o\| ORG_BILLING`) - carried from 089a7cb | yes - plan.md:35-40 | none | - |
| Surface `GET /settings` (200 with a Billing section when subscribed; 303 /login) - verified at 3814306 | yes - plan.md:46 | none | - |
| Surface `openBillingPortalAction` - carried from 089a7cb | yes - plan.md:47 | none | - |
| Surface Stripe `POST /v1/billing_portal/sessions` - carried from 089a7cb | yes - plan.md:48 | none | - |

`GET /settings` 200 with the section is now proven at two levels: the page hands the container's section and the portal action to `SettingsView` (`web/app/(app)/settings/page.test.ts:30-34`), and `SettingsView` renders it (`web/components/settings/billing-in-settings.test.ts:44-54`). The responsive/touch half of AC 12 is not a binding-source element here; it is tracked under C2915 and Coverage.

## Checks

Verified at 3814306. All named proofs in one invocation from PowerShell, in the clean detached worktree of `3814306` (`<scratchpad>\wt-r2b\web`, node_modules junctioned):

`npx vitest run domain/billing/portal.test.ts components/settings/billing-section.test.ts infrastructure/stripe/billing-portal.test.ts "app/(app)/settings/billing-action.test.ts" application/use-cases/billing-portal.test.ts infrastructure/supabase/org-billing.test.ts composition/billing-portal-wiring.test.ts infrastructure/stripe/billing-boundaries.test.ts components/settings/billing-in-settings.test.ts "app/(app)/settings/page.test.ts" -t "C29(0[0-9]|1[0-6]):|C251[01]:" --reporter=verbose` - exit 0, 10 files, 74 passed, 1 skipped (C2529, not named by this feature). Every test cited below appeared individually as passed in the verbose output, including the five `C2916:` tests.

Citations for C2900-C2914 are carried from 089a7cb: `git diff --stat 089a7cb..3814306` touches none of their files, so their line numbers are unchanged. C2915 and C2916 are verified at 3814306.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2900 | section decision over role x subscription x configured; plan names | batch, 16 + 3 passed | `web/domain/billing/portal.test.ts:14` `toEqual({ kind: "hidden" })`; `:15` `toEqual({ kind: configured ? "ready" : "unavailable", planName: "Team" })`; `:23` `toEqual({ kind: "ready", planName: name })` (carried from 089a7cb) | PASS |
| C2901 | ready: plan + submit button; unavailable: text, no button; hidden: nothing | batch, 3 passed | `web/components/settings/billing-section.test.ts:12-14`, `:19-21`, `:25` (carried from 089a7cb) | PASS |
| C2902 | one POST, bearer key, `Stripe-Version`, body exactly `customer` + `return_url`, trailing slash removed, key nowhere else | batch, 2 passed | `web/infrastructure/stripe/billing-portal.test.ts:38-39`, `:42-43`, `:46-48`, `:49-51`, `:56` (carried from 089a7cb) | PASS |
| C2903 | owner/admin: one portal request for the stored id, redirect to Stripe's url | batch, action 2 + use case 4 passed | `web/app/(app)/settings/billing-action.test.ts:37-39`; `web/application/use-cases/billing-portal.test.ts:16-19` (carried from 089a7cb) | PASS |
| C2904 | selects only `stripe_customer_id`, `plan` by org id on the given client; null for no row | batch, 3 passed | `web/infrastructure/supabase/org-billing.test.ts:11,13,14,15,20`; assembly `web/composition/index.ts:137` (carried from 089a7cb) | PASS |
| C2905 | browser fields ignored; source reads no form data | batch, 1 passed | `web/app/(app)/settings/billing-action.test.ts:46`, `:48` (carried from 089a7cb) | PASS |
| C2906 | 200 + non-empty string url ok; 8 other answers `unavailable` | batch, 8 passed | `web/infrastructure/stripe/billing-portal.test.ts:60-67`, `:70` (carried from 089a7cb) | PASS |
| C2907 | estimator/viewer forbidden, no read, no portal call | batch, 3 passed | `web/application/use-cases/billing-portal.test.ts:24-26`, `:68-69` (carried from 089a7cb) | PASS |
| C2908 | permission notice; signed out / no membership -> /login, no Stripe | batch, 4 passed | `web/app/(app)/settings/billing-action.test.ts:54-55`, `:60-61`, `:66-67` (carried from 089a7cb) | PASS |
| C2909 | key or base url missing: `unavailable` / `not_configured`, no fetch; both set: adapter built from them | batch, 4 passed | `web/composition/billing-portal-wiring.test.ts:37-39`, `:47-53` (carried from 089a7cb) | PASS |
| C2910 | 500 / refused / 10 s timeout log one line, status + code only | batch, 3 passed | `web/infrastructure/stripe/billing-portal.test.ts:77-84`, `:92-95`, `:107-113` (carried from 089a7cb) | PASS |
| C2911 | try-again notice for `unavailable`; permission text for `forbidden` | batch, component 2 + action 3 passed | `web/components/settings/billing-section.test.ts:30`, `:35`; `web/app/(app)/settings/billing-action.test.ts:72-73` (carried from 089a7cb) | PASS |
| C2912 | read error: `unavailable`, no portal call; page renders without the button | batch, use case 3 + action 1 passed | `web/application/use-cases/billing-portal.test.ts:36-38`, `:62`; `web/app/(app)/settings/billing-action.test.ts:78` (carried from 089a7cb) | PASS |
| C2913 | pending: disabled, pending label, one submit path | batch, 1 passed | `web/components/settings/billing-section.test.ts:40-44` (carried from 089a7cb) | PASS |
| C2914 | container exposes summary + portal; page and action read `getContainer()`; key only under `composition/` | batch, C2914 + C2510 + C2511 passed | `web/composition/billing-portal-wiring.test.ts:58-63`; `web/infrastructure/stripe/billing-boundaries.test.ts:25,29,34,36` (carried from 089a7cb). Round-1 caveat (source grep would pass a page that drops `billing`) is now covered by C2916 | PASS |
| C2915 | live `/settings` at 375/768/1440: no h-scroll, button >= 44 px on mobile and tablet, a touch tap responds, no console error | markup half: C2913 passed (above). Live half: AUTHOR-RUN on 2026-11-10, not re-run and not observed by me (needs a signed-in browser). See "C2915 author-run evidence" below | markup: `web/components/settings/billing-section.test.ts:40-44`. Live: no verifier-observed evidence. As reported by the author, the touch tap was not done (a mouse click, no touch-emulated context), console errors were reported only at 1440 px, and the Stripe happy path was not run | NOT PROVEN (author-run, unobserved; touch tap not done) |
| C2916 | page asks the container for the section of the member's org and role and hands it, with the portal action, to `SettingsView`; `SettingsView` mounts `ready`/`unavailable`, no Billing heading for `hidden`/none; signed-out -> `/login`, no billing read | batch, 5 passed | `web/app/(app)/settings/page.test.ts:30` `expect(billingSection).toHaveBeenCalledWith("org-1", "admin")`; `:31` `expect(element.type).toBe(SettingsView)`; `:32` `expect(element.props.billing).toEqual({ kind: "ready", planName: "Team" })`; `:33` `expect(element.props.billingAction).toBe(openBillingPortalAction)`; `:39-40` `rejects.toThrow("NEXT_REDIRECT /login")`, `expect(billingSection).not.toHaveBeenCalled()`. `web/components/settings/billing-in-settings.test.ts:46-48` `toContain("Your plan:")`, `toContain("Team")`, `toContain("Manage billing")`; `:53-54` `toContain("Billing isn't available yet")`, `not.toContain("Manage billing")`; `:58-61` for `{ kind: "hidden" }` and `undefined`: `not.toContain('id="billing-title"')`, `not.toContain("Manage billing")` (the id is real: `web/components/settings/billing-section.tsx:28` `<h2 id="billing-title"`, so the negative is not vacuous). Faults X1, P1-P4 killed | PASS |

### C2915 author-run evidence (not observed by the verifier)

I did not run, see or capture any of the following. It is the author's report of a live run on 2026-11-10, quoted verbatim from the brief:

> on `/settings` as the demo owner (org given a temporary `org_billing` row, plan `team`, test-mode Stripe key and `APP_BASE_URL=http://localhost:3000`), at 1440x900 the Billing section showed "Billing / Your plan: Team / Manage billing / Update your card, see invoices, change plan or cancel on Stripe's secure page.", button 126x34 px, no horizontal scroll, 0 console errors; at 768x1024 the button was 126x44, no horizontal scroll; at 375x812 the button was 126x44, no horizontal scroll, button inside the card. Pressing "Manage billing" (via a click; no touch-emulated context was created) made exactly one `POST /settings` and one Stripe request, Stripe answered 400 `resource_missing` (the customer id was a fake `cus_TEMP_...`), the page stayed on `/settings` and showed the alert "We couldn't open billing. Try again in a moment."; the server log held one line per press, `Stripe billing portal failed: HTTP 400, resource_missing`, with no customer id or key in it.

Not done live, per the author: the happy path to `billing.stripe.com` (needs a real Stripe customer and the saved portal configuration, which are the owner's) and true touch emulation.

Judgment under verify.md section 2 ("Run them yourself at HEAD. Never trust a report that the author already ran them"): an author's report I did not observe cannot make a check PASS in this report. Taken at face value it would still fall short of the claim on its own terms:

- "a touch tap on it responds": not done - a mouse click in a non-touch context is not a touch tap; the plan's independent test (plan.md:96) also asks for touch emulation on the two smaller sizes.
- "the console has no error": reported for 1440 px only; nothing reported for 768, 375, or after the press.
- 44 px target on mobile and tablet (126x44 at 375 and 768) and no horizontal scroll at all three sizes: reported and consistent with the claim, but unobserved.
- The Stripe leg "to Stripe, or to the notice when Stripe refuses": the refusal branch was reported; the redirect to `billing.stripe.com` was not run (checks.md already scopes it to the owner's keys).

Outstanding for C2915: a live run with a touch-emulated context at 375 and 768 (tap "Manage billing", record the response), console errors read at all three sizes and after the press, and evidence the verifier (or the owner) can inspect - or an explicit owner sign-off recorded against those items. Not my concern but noted: the fake `org_billing` row (`cus_TEMP_...`) remains in the hosted database pending the owner's cleanup; I did not touch the database.

## Coverage

`GET /settings` statuses and the responsive/touch row verified at 3814306 (the rows the fix touched or round 1 left unproven); every other row carried from 089a7cb (its authority - the plan and the production code - is unchanged by `3814306`).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| section decision role x subscription x configured (16) - carried from 089a7cb | AC 1, 5, 6, 9; `domain/billing/portal.ts:13-16` | all 16, `domain/billing/portal.test.ts:7-16` | - |
| plan names (3) - carried from 089a7cb | `PLANS`, AC 1 | `portal.test.ts:18-24` | - |
| section render states (3) - carried from 089a7cb | `BillingSectionView` kinds | `billing-section.test.ts:10,17,24` | - |
| `GET /settings` statuses (3: 200 with section, 200 without, 303 /login) - verified at 3814306 | Surface plan.md:46; `web/app/(app)/settings/page.tsx:13,15-16`; `web/components/settings/settings-view.tsx:47` | 200 with section: page hands it over `page.test.ts:30-33`, view mounts it `billing-in-settings.test.ts:46-48` (ready) and `:53` (unavailable). 200 without: `billing-in-settings.test.ts:58-61` (hidden and undefined), `billing-section.test.ts:25`, use case hidden `use-cases/billing-portal.test.ts:62,69`. 303 /login: `page.test.ts:39-40` (C2916, at the page, with no billing read) plus pre-existing C12 `infrastructure/supabase/session.test.ts:38` | - |
| `openBillingPortalAction` outcomes (3) - carried from 089a7cb | Surface plan.md:47 | `billing-action.test.ts:39`; `:54,72,78`; `:60,66` | - |
| use-case outcomes (5) - carried from 089a7cb | `use-cases/billing-portal.ts:18-27` | `use-cases/billing-portal.test.ts:16,24,44,36,50` | - |
| action code -> form state (4) - carried from 089a7cb | `billing-actions.ts:21` | `billing-action.test.ts:54,70-72` | - |
| Stripe statuses (2) - carried from 089a7cb | Surface plan.md:48, AC 4 | `billing-portal.test.ts:37`; `:60-70` | - |
| Stripe answers that are `unavailable` (8) - carried from 089a7cb | AC 4 | `billing-portal.test.ts:60-67` | - |
| failure paths that log one line (3) - carried from 089a7cb | AC 10 | `billing-portal.test.ts:77,92,112` | - |
| request fields (2) - carried from 089a7cb | Landing door 2 | `billing-portal.test.ts:47,48` | - |
| browser-supplied fields ignored (4) - carried from 089a7cb | AC 3 | `billing-action.test.ts:44,46` | - |
| roles reaching the action / use case (4) - carried from 089a7cb | `MemberRole` | `billing-action.test.ts:34,51`; `use-cases/billing-portal.test.ts:14,22` | - |
| no-session cases (2) - carried from 089a7cb | `CurrentMember` non-member statuses | `billing-action.test.ts:59,65` | - |
| notices (2) - carried from 089a7cb | AC 7, AC 10 | `billing-section.test.ts:35,30` | - |
| `OrgBilling` columns (2) + adapter branches - carried from 089a7cb | Landing door 1 | `org-billing.test.ts:13,10,20,25` | - |
| `org_billing` relation (1) - carried from 089a7cb | Relations | `composition/index.ts:137`; `org-billing.test.ts:14` | - |
| Landing door 2: `fetch`, no SDK (2) - carried from 089a7cb | Landing | `billing-portal.test.ts:38`; `billing-boundaries.test.ts:34-36` | - |
| startup config: container assembly (1) - carried from 089a7cb | `composition/index.ts:132-140,172-173` | read directly; `billing-portal-wiring.test.ts:37-53` | - |
| responsive / touch (AC 12: 375, 768, 1440 px; 44 px; touch tap) - verified at 3814306 | AC 12, C2915 | none automated by design; author-run report only (C2915 section) | all five members unobserved by the verifier; touch tap not done even in the author's run; console at 375/768 not reported |

Artifact note (no member unproven by it): the `checks.md` Coverage row for `GET /settings` still reads "(2) ... 303 /login unchanged C2908" and does not name C2916; C2908 is the action, not the page. The real proofs are listed above.

Swept rows that resolve to existing guards: carried from 089a7cb (RLS `org_billing_select`, `stripe_customer_id` unique/not null; no migration or policy touched by `3814306`).

## Test policy rows

Unmet row from round 1 and any row classifying a touched file: verified at 3814306. Others carried from 089a7cb.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary - carried from 089a7cb | `domain/billing/portal.ts`, `application/use-cases/billing-portal.ts` | own layer | yes |
| Entry point that decides nothing (Server Action, page) - verified at 3814306 | `app/(app)/settings/billing-actions.ts`, `app/(app)/settings/page.tsx`, `components/settings/settings-view.tsx` (mount) | boundary: accepted input, each rejected input, each error path | yes - action as in round 1 (`billing-action.test.ts:34,51,58,64,70,76`). Page: accepted member -> container read with org and role and the section + action handed to `SettingsView` (`page.test.ts:30-34`); rejected signed-out -> `/login` with no billing read (`page.test.ts:39-40`); the page's only error path (billing read failure) is absorbed by the use case into `hidden` (`use-cases/billing-portal.test.ts:62`), whose render is `billing-in-settings.test.ts:58-61`. Mount in `SettingsView`: `billing-in-settings.test.ts:44-61`. Faults X1, P1-P4 all killed. Minor: `no_membership` is not driven at the page, but it shares the unchanged `member.status !== "member"` branch (`page.tsx:13`) that predates the feature |
| Adapter (Supabase, Stripe) - carried from 089a7cb | `infrastructure/stripe/billing-portal.ts`, `infrastructure/supabase/org-billing.ts` | against `fetch` double / stub client | yes |
| Instrumentation, pass-throughs - carried from 089a7cb | `infrastructure/stripe/http.ts` | none of its own | yes |

## Faults injected

F1-F5 carried from 089a7cb (no production code and no existing test changed in `3814306`, so those experiments are unchanged). X1 and P1-P4 verified at 3814306, in a detached worktree of `3814306`, each reverted with `git checkout -- .` before the next. Round 1's X1 survived; this round it is killed. P1-P4 target the page test's distinct assertions, the surface the fix created.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 role check admits estimator - carried from 089a7cb | `web/domain/billing/portal.ts:5` | yes |
| F2 trailing slash kept - carried from 089a7cb | `web/infrastructure/stripe/billing-portal.ts:12` | yes |
| F3 failure log carries the customer id - carried from 089a7cb | `web/infrastructure/stripe/billing-portal.ts:34` | yes |
| F4 customer id taken from `input.orgId` - carried from 089a7cb | `web/application/use-cases/billing-portal.ts:27` | yes |
| F5 `stripeKey && stripeBase` -> `\|\|` - carried from 089a7cb | `web/composition/index.ts:136` | yes |
| X1 the `{props.billing && props.billingAction && <BillingSection .../>}` line deleted | `web/components/settings/settings-view.tsx:47` | yes - `C2916: a ready section is mounted ...` (`expected '<div class="flex flex-col gap-6">...' to contain 'Billing'`) and `C2916: an unavailable section is mounted ...` (`to contain 'Billing isn't available yet'`) failed; 2 failed, 3 passed |
| P1 page passes `billing={undefined}` | `web/app/(app)/settings/page.tsx:16` | yes - `C2916: it asks the container ...` (`expected undefined to deeply equal { kind: 'ready', planName: 'Team' }`) |
| P2 page drops `billingAction={openBillingPortalAction}` | `web/app/(app)/settings/page.tsx:16` | yes - same test (`expected undefined to be [AsyncFunction openBillingPortalAction]`) |
| P3 page reads the section for `"owner"` instead of `member.role` | `web/app/(app)/settings/page.tsx:15` | yes - same test (`expected "vi.fn()" to be called with arguments: [ 'org-1', 'admin' ]`) |
| P4 a billing read before the session check | `web/app/(app)/settings/page.tsx:12` (line inserted) | yes - `C2916: a signed-out visitor goes to /login and no billing read happens` (`expected "vi.fn()" to not be called at all, but actually been called 1 times`) |

Observation from P4: the first page test still passed with the extra call, because `toHaveBeenCalledWith` matches any call and there is no call-count assertion; the second test kills it. Not a survivor, noted as a minor tightening.

## Gate

Verified at 3814306: `npx vitest run` (full web suite, PowerShell, in the clean detached worktree of `3814306`, not the real tree, which carries the author's unrelated uncommitted edits) - 226 files, 4016 passed, 0 failed (round 1: 224 files, 4011; +2 files, +5 tests = the C2916 tests).

Feature proofs (one invocation, above) - 74 passed, 0 failed, 1 skipped (C2529, not a billing-portal proof).

## Ranked gaps

1. C2915 live half not proven - C2915 - no verifier-observed evidence. The author's run (quoted above) is unobserved, and even as reported it lacks the touch tap the claim names (click only, no touch-emulated context), console results at 375/768 and after the press, and the Stripe happy path. Needs a touch-emulated live run at 375 and 768 with console checks at all three sizes, recorded so it can be inspected, or an explicit owner sign-off on those items.
2. Minor, no verdict change: `checks.md` Coverage row `GET /settings` is stale (says size 2, names C2908 for the 303, omits C2916). `page.test.ts:30` lacks `toHaveBeenCalledTimes(1)` (P4 showed an extra read passes that test). `no_membership` is not driven at the page (pre-existing shared branch). Carried from round 1: C2913's `useActionState` wrapper (`components/settings/billing-section.tsx:61-62`) is unexercised.
