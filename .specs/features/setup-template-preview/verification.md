# Setup template preview verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: c40c4df..c8eda93 (fix diff e32c435..c8eda93)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

FAIL for one reason only: C5513 (live pass at 375/768/1440 px) is still NOT RUN. It needs the demo org's `setup_completed_at` set to null, which is a change to hosted demo data. That change is waiting for the owner's go-ahead. Until it runs, AC 11's 44 px link height and AC 12's stacked, no-horizontal-scroll layout at 375 px have no proof. Everything else holds at `c8eda93`:

- All 16 checks a Verifier can run are proven, with located evidence.
- Both round-1 findings the fix addressed are closed: the C5505 precision gap and the order of the halves.
- Both faults injected on the fix's surfaces were killed.

Round 1 is preserved at `.specs/features/setup-template-preview/verification-round1.md`.

**Scope of this round.** The fix diff `e32c435..c8eda93` touches two test files only:
- `web/domain/contract/starter-preview.test.ts`: C5505 now uses `paymentDays: 45` and `cancellationNoticeDays: 14` and asserts both are printed.
- `web/components/setup/starter-templates.test.tsx`: a new C5514 test asserts the agreement half comes before the contract half.

It also commits the round-1 `verification.md`. No production file changed (`git diff --stat e32c435..c8eda93 -- web/` lists only the two test files).

This round did the following at `c8eda93`:
- Re-ran every proof in full.
- Refreshed the citations in the two touched files.
- Re-injected faults on the two touched surfaces.
- Recomputed the halves-order coverage row.

Everything else is marked `carried from e32c435`.

## Binding sources

carried from e32c435. The fix touched no interface, only tests, so step 1 was not re-run. The one change is that the Flow row's "order of halves" gap is now covered by the new C5514 test (verified at c8eda93).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `plan.md` Criteria AC 1-14 | yes - read in full in round 1 (carried from e32c435) | none | AC 11 "at least 44 px high at 375 px" and AC 12 "two halves stacked, no horizontal scroll" are proven only by C5513, which was not run |
| `plan.md` Observable (`/setup` section states, `POST /templates/preview`) | yes - read in full in round 1 (carried from e32c435) | none | arrangement at 375 px (AC 12) has no Verifier-runnable proof; only C5513, not run |
| `plan.md` Flow 1-5 | yes - read in full in round 1 (carried from e32c435) | none | - (the order of the halves, agreement then contract, is now asserted by `web/components/setup/starter-templates.test.tsx:118`, verified at c8eda93) |

The per-screen enumeration is carried from e32c435 (see `verification-round1.md`), with one change. The row "Order of the halves: agreement then contract" now maps to C5514 (`starter-templates.test.tsx:115-118`) instead of "none".

## Checks

Proofs were re-run in full at `c8eda93` in one invocation from `web/`:

`npx vitest run components/setup/setup.test.ts components/setup/starter-templates.test.tsx domain/contract/starter-preview.test.ts app/setup/page.test.ts -t "C55(0[0-9]|1[0-6]):" --reporter=verbose`

Result: exit 0, 4 files, 20 passed, 22 skipped. That is one more than round 1, which is the new C5514 order test. Each test named below appears individually in the verbose output as passed.

The diff proofs were re-run at `c8eda93`, and both exited 0:
- `git diff --exit-code c40c4df -- web/app/setup/actions.ts web/app/setup/draft-actions.ts`
- `git diff --exit-code c40c4df -- "web/app/(app)/templates/preview/route.ts" "web/app/(app)/templates/preview/route.test.ts"`

Citations in the two touched files were refreshed at c8eda93. The fix did not touch any other file, so the other citations are carried from e32c435 and their line numbers are unchanged.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5500 | section after `profile-title`, before `catalog-title` | passed at c8eda93 | `web/components/setup/setup.test.ts:182` `expect(starter).toBeGreaterThan(profile)`; `:183` `expect(catalog).toBeGreaterThan(starter)` (carried from e32c435) | PASS |
| C5501 | empty catalog: section still shown, before the empty notice | passed at c8eda93 | `web/components/setup/setup.test.ts:189` `expect(starter).toBeGreaterThan(profile)`; `:190` `expect(notice).toBeGreaterThan(starter)` (carried from e32c435) | PASS |
| C5502 | one POST with `templateFormFromBody(SYSTEM_AGREEMENT_BODY)`, PDF in an iframe on a blob URL | passed at c8eda93 | `web/components/setup/starter-templates.test.tsx:73` `expect(calls).toHaveLength(1)`; `:76` `expect(JSON.parse(String(calls[0].init.body))).toEqual(templateFormFromBody(SYSTEM_AGREEMENT_BODY))`; `:78` iframe `src` `toContain("blob:starter-1")` (refreshed at c8eda93, unchanged) | PASS |
| C5503 | "Updating preview…" while unanswered; profile inputs not disabled | passed at c8eda93 | `web/components/setup/starter-templates.test.tsx:84` `expect(text()).toContain("Updating preview…")`; `:85` inputs `.disabled` false (refreshed at c8eda93, unchanged) | PASS |
| C5504 | 503 / rejected / 200 text/html -> "Preview unavailable.", Try again, Save and Skip enabled, retry re-requests | 3 cases passed at c8eda93 | `web/components/setup/starter-templates.test.tsx:99` `toContain("Preview unavailable.")`; `:104` `expect(calls).toHaveLength(2)` (refreshed at c8eda93, unchanged) | PASS |
| C5505 | preview document carries legal name, address, phone, logo, `TEMPLATE PREVIEW`, the org's saved terms | passed at c8eda93 | `web/domain/contract/starter-preview.test.ts:68` `own = { ...settings, paymentDays: 45, cancellationNoticeDays: 14 }`; `:70` `tenant.name` `toBe("Flow Plumbing Ltd.")`; `:73` `tenant.logo` `toEqual(logo)`; `:74` `expect(document.mark).toBe("TEMPLATE PREVIEW")`; `:76` `expect(printed).toContain("45")`; `:77` `expect(printed).toContain("14")` (verified at c8eda93). The round-1 precision gap is closed: 45 and 14 differ from the new-org default of 30 | PASS |
| C5506 | saved-details note; unsaved province does not reach contract half | passed at c8eda93 | `web/components/setup/setup.test.ts:197` `toContain("Shown with the details you have saved so far.")`; `:199` `not.toContain("governed by the laws of Ontario")` (carried from e32c435) | PASS |
| C5507 | new-org settings -> 7 blocks in order, every variable filled | passed at c8eda93 | `web/domain/contract/starter-preview.test.ts:41` `toHaveLength(7)`; `:42` `expect(blocks.slice(0, 6)).toEqual(EXPECTED)` (refreshed at c8eda93; lines unchanged, because the fix edited only lines 66-77) | PASS |
| C5508 | each of 3 unset settings drops only its clause, others remain in order | 3 cases passed at c8eda93 | `web/domain/contract/starter-preview.test.ts:53` the clause is absent; `:54` `toHaveLength(6)`; `:56` remaining blocks in order (refreshed at c8eda93, unchanged) | PASS |
| C5509 | `{{customer.name}}`/`{{site.name}}` -> sample names | passed at c8eda93 | `web/domain/contract/starter-preview.test.ts:61` `toEqual([{ type: "paragraph", text: "Sample Customer Ltd. at Sample Site." }])` (refreshed at c8eda93, unchanged) | PASS |
| C5510 | contract half: note text, no iframe, no button, no pdf/sign link | passed at c8eda93 | `web/components/setup/starter-templates.test.tsx:109` `toContain("Sample wording, not a signed contract")`; `:110` `not.toContain("<iframe")`; `:111` `not.toContain("<button")`; `:112` pdf/sign hrefs `toEqual([])` (refreshed at c8eda93) | PASS |
| C5511 | owner render with every non-read container member throwing; section appears | passed at c8eda93 | `web/app/setup/page.test.ts:99` `toContain("Your starter templates")`; `:100` `expect(strayCalls).not.toHaveBeenCalled()` (carried from e32c435) | PASS |
| C5512 | `actions.ts`, `draft-actions.ts` byte-identical to c40c4df | `git diff --exit-code` exit 0 at c8eda93 | `web/app/setup/actions.ts:1`, `web/app/setup/draft-actions.ts:1`; diff empty | PASS |
| C5513 | live 375/768/1440: PDF shows, halves stacked, no h-scroll, link >= 44 px, no console errors | NOT RUN - author-run Playwright. It needs the demo org's `setup_completed_at` set to null, a hosted demo-data change awaiting the owner's go-ahead | no evidence - `.specs/features/setup-template-preview/checks.md:131` records "C5513 (live pass) not run"; there is still no `## Live run` section | NOT RUN |
| C5514 | each half: one "Customize in Templates" link to `/templates` with `py-3.5 -my-3.5 lg:py-0 lg:my-0`; agreement half before contract half | 2 tests passed at c8eda93 | `web/components/setup/starter-templates.test.tsx:117` `expect(html.indexOf('data-half="agreement"')).toBeGreaterThan(-1)`; `:118` `expect(html.indexOf('data-half="contract"')).toBeGreaterThan(html.indexOf('data-half="agreement"'))`; `:126` `expect(links).toHaveLength(1)`; `:127` `toContain("py-3.5 -my-3.5")`; `:128` `toContain("lg:py-0 lg:my-0")` (verified at c8eda93) | PASS |
| C5515 | estimator -> `/pipeline`, signed out -> `/login`, no settings read | 2 cases passed at c8eda93 | `web/app/setup/page.test.ts:108` ``rejects.toThrow(`NEXT_REDIRECT ${to}`)``; `:109` `expect(getOrgSettings).not.toHaveBeenCalled()` (carried from e32c435) | PASS |
| C5516 | preview `route.ts` and `route.test.ts` byte-identical to c40c4df | `git diff --exit-code` exit 0 at c8eda93 | `web/app/(app)/templates/preview/route.ts:24` `empty(401)`, `:25` `empty(403)`, `:48` `empty(503)`; diff empty | PASS |

The fix did not weaken any assertion. In `starter-preview.test.ts` it removed two assertions:
- `toContain("30")`, which the round-1 report had flagged as weak.
- `document.terms.length > 0`, which is now implied by the two `toContain` checks on the joined terms.

It replaced them with the two distinctive-value assertions. In `starter-templates.test.tsx` it only added lines.

## Coverage

Only the row the fix touched was recomputed: "Halves of the section", verified at c8eda93. The other rows are carried from e32c435.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Criteria (14) | `plan.md` Criteria (carried from e32c435) | AC1 C5500 · AC2 C5502 · AC3 C5503 · AC4 C5504 · AC5 C5505 · AC6 C5506 · AC7 C5507, C5509 · AC8 C5508 · AC9 C5510 · AC10 C5511, C5512 · AC11 C5514 (link, href, classes) · AC13 C5515 · AC14 C5501 | AC 11 (44 px at 375 px, only C5513, not run) · AC 12 (stacked, no h-scroll, only C5513, not run) |
| Unset settings that drop a clause (3) | `starter-preview.ts` (carried from e32c435) | paymentDays, cancellationNoticeDays, governingProvince -> C5508 | - |
| Failure modes of the preview request (3) | `template-preview-frame.tsx:55` (carried from e32c435) | 503, rejected fetch, 200 text/html -> C5504 | - |
| Viewports (3) | plan AC 11/12 (carried from e32c435) | 375, 768, 1440 -> C5513 only | 375 px, 768 px, 1440 px (C5513 not run) |
| Roles at `/setup` (3) | `page.tsx` branches (carried from e32c435) | owner C5511 · estimator C5515 · signed out C5515 | - |
| `POST /templates/preview` statuses (5) | `route.ts:24,25,48` (carried from e32c435) | all pinned by C5516; 200 and 503 also by C5502, C5504 | - |
| Screen sections in order (3) | `setup-view.tsx:107-137` (carried from e32c435) | profile, starter, catalog/empty notice -> C5500, C5501 | - |
| Halves of the section, in order (2) | plan Flow 3-4; `web/components/setup/starter-templates.tsx:39` agreement, `:46` contract (verified at c8eda93) | both exist and the agreement half comes first -> C5514 (`starter-templates.test.tsx:117-118`); one link per half -> C5514 (`:126`) | - |
| Org saved terms printed on the preview (2) | `template-preview.ts:42` passes `settings` to `buildAgreementDocument` (verified at c8eda93) | paymentDays -> C5505 `:76` ("45") · cancellationNoticeDays -> C5505 `:77` ("14") | - |

## Test policy rows

No row was unmet in round 1. The fix touched only test files, so no row classifying production code changed. Carried from e32c435.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`buildStarterContractPreview`) | `web/domain/contract/starter-preview.ts` | own layer: C5507, C5508 x3 | yes |
| Entry point that decides nothing (`SetupForRequest`, the new section) | `web/app/setup/page.tsx`, `web/components/setup/starter-templates.tsx` | boundary: roles C5511, C5515; frame states C5502, C5503, C5504 | yes |
| Instrumentation, pass-throughs (`SetupView`) | `web/components/setup/setup-view.tsx` | covered by C5500, C5501 | yes |

## Swept existing (re-read)

carried from e32c435. The fix touched none of the cited files.

- authorization: `route.ts:25` `if (!canWriteTemplates(member.role)) return empty(403);`
- observability: `route.ts:47` `console.error(...)` with the org id
- concurrency: `template-preview-frame.tsx:38` `new AbortController()`, `:68` `controller.abort()`

## Faults injected

Verified at c8eda93. The faults were injected only on the surfaces the fix touched or created.

Setup:
- I ran `git worktree add --detach <scratchpad>/wt2 HEAD`, with `web/node_modules` junctioned in.
- I recorded the baseline `git status --porcelain` of the real tree: `?? .specs/features/setup-template-preview/verification-round1.md`, `?? node_modules/`.
- C5505 and C5514 passed in the scratch worktree before any mutation.

Each mutation was reverted with `git checkout -- .`, and the scratch porcelain was empty after each revert. Afterwards I deleted the junction and ran `git worktree remove --force`. The real tree's porcelain then matched the baseline.

| Mutation | Location | Killed |
| --- | --- | --- |
| preview document ignores the org's terms: `buildAgreementDocument(source, { ...settings, paymentDays: 30, cancellationNoticeDays: 30 }, body)` | `web/domain/agreement/template-preview.ts:42` | yes - C5505 failed: `expected '0% 5% 30 days 30 days BC Renews autom…' to contain '45'` |
| variant: only `cancellationNoticeDays: 30` hard-coded (paymentDays left from the org) | `web/domain/agreement/template-preview.ts:42` | yes - C5505 failed: `expected '0% 5% 30 days 45 days BC Renews autom…' to contain '14'`, so the "14" assertion bites on its own |
| the two halves swapped: the contract `<div data-half="contract">` block moved before the agreement block | `web/components/setup/starter-templates.tsx:39-60` | yes - `C5514: the agreement half comes before the contract half` failed (`expected 451 to be greater than 1399`). The other C5514 test still passed under this mutant, as round 1 predicted, which is why the order test was needed |

The round-1 faults on C5508, C5510, C5500/C5501, C5502 and C5514's link classes are carried from e32c435, all killed. The fix did not touch those surfaces.

## Gate

At c8eda93, from `web/`:

`npx vitest run components/setup/setup.test.ts components/setup/starter-templates.test.tsx domain/contract/starter-preview.test.ts app/setup/page.test.ts -t "C55(0[0-9]|1[0-6]):"`

Result: 4 files, 20 passed, 0 failed (22 skipped by the filter). The `git diff --exit-code` proofs for C5512 and C5516 both returned exit 0.

## Findings (ranked)

1. **C5513 not run, so AC 11 (44 px) and AC 12 (stacked, no h-scroll at 375 px) are unproven.** Check C5513. No evidence; see `checks.md:131`. This is the only remaining blocker. It is waiting for the owner's go-ahead on the hosted demo-data change (`setup_completed_at` set to null for the run, restored after). Once the run is recorded under `## Live run`, the feature can go to round 3.
2. Closed in this round: the C5505 precision gap. `web/domain/contract/starter-preview.test.ts:76-77` asserts 45 and 14, and the fault that hard-codes 30 is killed.
3. Closed in this round: the order of the halves. `web/components/setup/starter-templates.test.tsx:118` asserts it, and the swap mutant is killed.
4. Carried from e32c435, cosmetic, not blocking: the `<h3>` "Agreement" / "Contract" sub-labels at `web/components/setup/starter-templates.tsx:40` are copy the plan does not decide.
