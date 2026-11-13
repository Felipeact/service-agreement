# Setup template preview verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: c40c4df..e32c435
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

FAIL for one reason that blocks: C5513 (live pass at 375/768/1440 px) was not run, so AC 11's 44 px height and AC 12's stacked, no-horizontal-scroll layout at 375 px have no proof. Every other check (16/17) is proven at HEAD with located evidence, and all 5 injected faults were killed.

## Binding sources

No screenshot binds this feature. The binding source is `plan.md` Criteria, Observable and Flow. I opened and read all three in full, together with `checks.md`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `plan.md` Criteria AC 1-14 | yes - read in full | none | AC 11 "at least 44 px high at 375 px" and AC 12 "two halves stacked, no horizontal scroll" are proven only by C5513, which was not run |
| `plan.md` Observable (`/setup` section states, `POST /templates/preview`) | yes - read in full | none | arrangement at 375 px (Observable row "density, ordering and arrangement at 375 px" -> AC 12) has no Verifier-runnable proof |
| `plan.md` Flow 1-5 | yes - read in full | none | the order of the halves (agreement, then contract, Flow 3 then 4) is not asserted; the code also renders `<h3>` labels "Agreement" and "Contract" that the plan does not decide |

### Per-screen enumeration - `/setup`, starter templates section

What the plan decides that a selector can reach, compared with the code (`web/components/setup/starter-templates.tsx`, `web/components/setup/setup-view.tsx`):

| Element / arrangement | Plan source | Code | Check |
| --- | --- | --- | --- |
| Screen regions in order: profile card -> starter section -> catalog review (or empty notice) | AC 1, AC 14 | `setup-view.tsx:135` `<StarterTemplates>` between the profile `</section>` and `setup-view.tsx:137` `<CatalogReview>` | C5500, C5501 |
| Section heading "Your starter templates" | AC 1 | `starter-templates.tsx` `STARTER_COPY.title` in `<h2 id="starter-title">` | C5500, C5501, C5511 |
| Note "Shown with the details you have saved so far." | AC 6 | `STARTER_COPY.saved` | C5506 |
| Two halves inside the section (count 2) | Flow 3-4, AC 11 "each half" | `data-half="agreement"`, `data-half="contract"` (`starter-templates.tsx:39`, `:46`) | C5514 (both halves are split on, so each must exist) |
| Order of the halves: agreement then contract | Flow 3 then 4 (implied) | agreement first | **none** - C5514's split passes in either order |
| Halves stacked at 375 px | AC 12 | `grid grid-cols-1` (`starter-templates.tsx:38`), stacked at every width | C5513 only (not run) |
| No horizontal scroll at 375 px | AC 12 | `min-w-0` on each half | C5513 only (not run) |
| Agreement half: PDF in an `iframe` on a blob URL | AC 2, AC 5 | `TemplatePreviewFrame values={SYSTEM_FORM}` | C5502 |
| Agreement half: "Updating preview…" while loading | AC 3 | frame `COPY.updating` | C5503 |
| Agreement half: "Preview unavailable." plus a "Try again" button | AC 4 | frame `COPY.unavailable`, button | C5504 |
| Contract half: note "Sample wording, not a signed contract" | AC 9 | `STARTER_COPY.contractNote` | C5510 |
| Contract half: 7 blocks in order (heading + 6 clauses) | AC 7 | `blocks.map` as `h4`/`p` | C5507 (domain), C5506 (one clause in rendered markup) |
| Contract half: no iframe, no button, no pdf or sign link | AC 9 | none rendered | C5510 |
| One "Customize in Templates" link to `/templates` per half | AC 11 | `Link href="/templates"` x2 | C5514 |
| Link at least 44 px high at 375 px | AC 11 | `py-3.5 -my-3.5 lg:py-0 lg:my-0` classes | C5514 (classes), C5513 (pixels, not run) |
| Unauthorised: no section, redirect | AC 13 | `page.tsx` redirects | C5515 |
| `<h3>` "Agreement" / "Contract" sub-labels | not decided by the plan | rendered | none (element the plan does not draw) |

## Checks

Proofs run in one invocation from `web/`:
`npx vitest run components/setup/setup.test.ts components/setup/starter-templates.test.tsx domain/contract/starter-preview.test.ts app/setup/page.test.ts -t "C55(0[0-9]|1[0-6]):" --reporter=verbose` - exit 0, 4 files, 19 passed, 22 skipped. Each named test below appears in the verbose output individually as passed (checkmark).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5500 | section after `profile-title`, before `catalog-title` | `C5500: Your starter templates sits after the profile card and before the catalog review` passed | `web/components/setup/setup.test.ts:181` - `expect(profile).toBeGreaterThan(-1)`; `:182` `expect(starter).toBeGreaterThan(profile)`; `:183` `expect(catalog).toBeGreaterThan(starter)` | PASS |
| C5501 | empty catalog: section still shown, before the empty notice | `C5501: with an empty catalog the section is still shown, before the empty-catalog notice` passed | `web/components/setup/setup.test.ts:189` - `expect(starter).toBeGreaterThan(profile)`; `:190` `expect(notice).toBeGreaterThan(starter)` (notice = "No types yet") | PASS |
| C5502 | one POST with `templateFormFromBody(SYSTEM_AGREEMENT_BODY)`, PDF in an iframe on a blob URL | `C5502: one POST /templates/preview on mount ...` passed | `web/components/setup/starter-templates.test.tsx:73` `expect(calls).toHaveLength(1)`; `:74` url `/templates/preview`; `:75` method `POST`; `:76` `expect(JSON.parse(String(calls[0].init.body))).toEqual(templateFormFromBody(SYSTEM_AGREEMENT_BODY))`; `:78` iframe `src` contains `blob:starter-1` | PASS |
| C5503 | "Updating preview…" while unanswered; profile inputs not disabled | `C5503: while the request is unanswered ...` passed | `web/components/setup/starter-templates.test.tsx:84` `expect(text()).toContain("Updating preview…")`; `:85` `#legalName`, `#phone`, `#address` `.disabled` is `false` | PASS |
| C5504 | 503 / rejected / 200 text/html -> "Preview unavailable.", Try again, Save and Skip enabled, retry re-requests | `C5504: a 503 ...`, `C5504: a rejected fetch ...`, `C5504: 200 with text/html ...` each passed | `web/components/setup/starter-templates.test.tsx:99` `toContain("Preview unavailable.")`; `:100` Try again button defined; `:101` `button("Continue")!.disabled` false; `:102` `button("Skip for now")!.disabled` false; `:104` `expect(calls).toHaveLength(2)`. Save is labelled "Continue" on screen (`setup-view.tsx:141`) | PASS |
| C5505 | preview document carries legal name, address, phone, logo, `TEMPLATE PREVIEW`, saved terms | `C5505: letterhead, logo, mark and saved terms come from the org` passed | `web/domain/contract/starter-preview.test.ts:69` name; `:70` address; `:71` phone; `:72` `tenant.logo` equals logo; `:73` `expect(document.mark).toBe("TEMPLATE PREVIEW")`; `:74` terms joined contain `"30"` (precision gap, see findings) | PASS |
| C5506 | saved-details note; unsaved province does not reach contract half | `C5506: it says the details are the saved ones ...` passed | `web/components/setup/setup.test.ts:197` `toContain("Shown with the details you have saved so far.")`; `:198` `toContain("governed by the laws of British Columbia.")`; `:199` `not.toContain("governed by the laws of Ontario")` with form state `invalid` holding `governingProvince: "ON"` (`:195`) | PASS |
| C5507 | new-org settings -> 7 blocks in order, every variable filled | `C5507: a new org's terms fill every variable ...` passed | `web/domain/contract/starter-preview.test.ts:41` `toHaveLength(7)`; `:42` `expect(blocks.slice(0, 6)).toEqual(EXPECTED)` (heading "Terms" and the five sentences, `:30-37`); `:44` renewal sentence regex | PASS |
| C5508 | each of 3 unset settings drops only its clause, others remain in order | `C5508: paymentDays ...`, `C5508: cancellationNoticeDays ...`, `C5508: governingProvince ...` each passed | `web/domain/contract/starter-preview.test.ts:53` `blocks.some(... includes(start))` is false; `:54` `toHaveLength(6)`; `:56` `blocks.slice(0, 5)` equals EXPECTED minus that clause | PASS |
| C5509 | `{{customer.name}}`/`{{site.name}}` -> sample names | `C5509: sample customer and site names fill their variables` passed | `web/domain/contract/starter-preview.test.ts:61` `toEqual([{ type: "paragraph", text: "Sample Customer Ltd. at Sample Site." }])` | PASS |
| C5510 | contract half: note text, no iframe, no button, no pdf/sign link | `C5510: the contract half says it is sample wording ...` passed | `web/components/setup/starter-templates.test.tsx:109` `toContain("Sample wording, not a signed contract")`; `:110` no `<iframe`; `:111` no `<button`; `:112` hrefs matching `/pdf\|sign/i` equal `[]` | PASS |
| C5511 | owner render with every non-read container member throwing; section appears | `C5511: an owner gets the starter templates section ...` passed | `web/app/setup/page.test.ts:99` `expect(markup).toContain("Your starter templates")`; `:100` `expect(strayCalls).not.toHaveBeenCalled()`; Proxy at `:16-27` throws on any member outside `reads` | PASS |
| C5512 | `actions.ts`, `draft-actions.ts` byte-identical to c40c4df | `git diff --exit-code c40c4df -- web/app/setup/actions.ts web/app/setup/draft-actions.ts` exit 0 | `web/app/setup/actions.ts:1` and `web/app/setup/draft-actions.ts:1` exist at HEAD; diff empty, exit code 0 | PASS |
| C5513 | live 375/768/1440: PDF shows, halves stacked, no h-scroll, link >= 44 px, no console errors | not run - author-run Playwright check; the Handoff records it was not run because it needs the demo org's `setup_completed_at` set null, a hosted data change waiting for the owner's go-ahead. A Verifier cannot observe it | no evidence - `.specs/features/setup-template-preview/checks.md:131` records "C5513 (live pass) not run"; no `## Live run` section exists | NOT RUN |
| C5514 | each half: one "Customize in Templates" link to `/templates` with `py-3.5 -my-3.5 lg:py-0 lg:my-0` | `C5514: each half has one Customize in Templates link ...` passed | `web/components/setup/starter-templates.test.tsx:120` `expect(links).toHaveLength(1)` per half; `:121` `toContain("py-3.5 -my-3.5")`; `:122` `toContain("lg:py-0 lg:my-0")` | PASS |
| C5515 | estimator -> `/pipeline`, signed out -> `/login`, no settings read | `C5515: an estimator ...`, `C5515: a signed-out visitor ...` each passed | `web/app/setup/page.test.ts:108` `rejects.toThrow(\`NEXT_REDIRECT ${to}\`)`; `:109` `expect(getOrgSettings).not.toHaveBeenCalled()`; `:110` `expect(strayCalls).not.toHaveBeenCalled()` | PASS |
| C5516 | preview `route.ts` and `route.test.ts` byte-identical to c40c4df | `git diff --exit-code c40c4df -- "web/app/(app)/templates/preview/route.ts" "web/app/(app)/templates/preview/route.test.ts"` exit 0 | `web/app/(app)/templates/preview/route.ts:24` `empty(401)`, `:25` `empty(403)`, `:48` `empty(503)` unchanged; diff empty, exit code 0 | PASS |

Every test touched by the proofs is new in `c40c4df..HEAD` (`starter-templates.test.tsx`, `starter-preview.test.ts` are new files; the C5500/C5501/C5506 and C5511/C5515 cases are additions in the diff).

### First-login-setup assertions not weakened

`git diff c40c4df..HEAD -- web/app/setup/page.test.ts web/components/setup/setup.test.ts` contains only additions: the new `describe` blocks, an import of `toSetupInput`, `renderToStaticMarkup`, and the container mock. The mock changed from a plain object to a Proxy over the same six members (`page.test.ts:15`); members outside them now throw instead of being `undefined`, which is stricter. `vi.clearAllMocks()` in `beforeEach` (`page.test.ts:44`) resets `strayCalls` between tests. No existing assertion line (C2806, C2807, C2808, C2810, C2811, C2817, C2818, C41xx) was edited or removed. All of them pass in the gate run.

## Coverage

Recomputed from the plan's Criteria and Observable sections and the code, not copied from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Criteria (14) | `plan.md` Criteria | AC1 C5500 · AC2 C5502 · AC3 C5503 · AC4 C5504 · AC5 C5505 · AC6 C5506 · AC7 C5507, C5509 · AC8 C5508 · AC9 C5510 · AC10 C5511, C5512 · AC11 C5514 (link, href, classes) · AC13 C5515 · AC14 C5501 | AC 11 (44 px at 375 px, only C5513, not run) · AC 12 (stacked, no h-scroll, only C5513, not run) |
| Unset settings that drop a clause (3) | `starter-preview.ts` -> `templateValues`/`renderBlocks`; checks name 3 | paymentDays, cancellationNoticeDays, governingProvince -> C5508 (table-driven, all 3 ran) | - |
| Failure modes of the preview request (3) | `template-preview-frame.tsx:55` (`!response.ok`, non-pdf content type) and the catch | 503, rejected fetch, 200 text/html -> C5504 (3 parametrised cases ran) | - |
| Viewports (3) | plan AC 11/12, checks | 375, 768, 1440 -> C5513 only | 375 px, 768 px, 1440 px (C5513 not run) |
| Roles at `/setup` (3) | `page.tsx` branches | owner C5511 · estimator C5515 · signed out C5515 | - |
| `POST /templates/preview` statuses (5) | `route.ts:24,25,48` plus 422 and 200 | all pinned unchanged by C5516; 200 and 503 also crossed by C5502, C5504 | - |
| Screen sections in order (3) | `setup-view.tsx:107-137` | profile, starter, catalog/empty notice -> C5500, C5501 | - |
| Halves of the section (2) | plan Flow 3-4, `starter-templates.tsx:39,46` | agreement, contract exist -> C5514; their order is not asserted | order of halves (minor, not named as a set in checks) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`buildStarterContractPreview`) | `web/domain/contract/starter-preview.ts` | own layer: C5507 filled case, C5508 one case per unset setting (3) | yes |
| Entry point that decides nothing (`SetupForRequest`, the new section) | `web/app/setup/page.tsx`, `web/components/setup/starter-templates.tsx` | boundary: each role C5511, C5515 (owner, estimator, signed out); each frame state C5502 (pdf), C5503 (updating), C5504 (unavailable) | yes |
| Instrumentation, pass-throughs (`SetupView` passing props on) | `web/components/setup/setup-view.tsx` | none of its own; covered by C5500, C5501 | yes |

## Swept existing (re-read)

- authorization: `route.ts:25` `if (!canWriteTemplates(member.role)) return empty(403);` - present.
- observability: `route.ts:47` `console.error(\`Template preview failed for org ${member.orgId}\`, error)` - present.
- concurrency: `template-preview-frame.tsx:38` `new AbortController()`, `:68` `controller.abort()`; proven by `template-preview-frame.test.tsx:132` (C5432) - present.

## Faults injected

Scratch worktree at HEAD (`git worktree add <scratchpad>/wt HEAD`, `web/node_modules` junctioned in). Baseline proofs were green there first (19 passed). Each mutation was reverted with `git checkout -- .` before the next. Afterwards I removed the worktree, and the real tree's `git status --porcelain` matched the baseline (`?? node_modules/`).

| Mutation | Location | Killed |
| --- | --- | --- |
| settings passed to `templateValues` defaulted (`paymentDays ?? 30`, `cancellationNoticeDays ?? 30`, `governingProvince ?? "BC"`), so no clause can drop | `web/domain/contract/starter-preview.ts:12` | yes - C5508 x3 failed |
| contract note text `"Sample wording, not a signed contract"` -> `"Sample wording"` | `web/components/setup/starter-templates.tsx:14` | yes - C5510 failed |
| `<StarterTemplates>` moved after `<CatalogReview>` | `web/components/setup/setup-view.tsx:135` | yes - C5500 and C5501 failed |
| `SYSTEM_FORM` posts an extra field (`{ ...templateFormFromBody(SYSTEM_AGREEMENT_BODY), injected: "x" }`) | `web/components/setup/starter-templates.tsx:22` | yes - C5502 failed |
| link classes `py-3.5 -my-3.5` dropped | `web/components/setup/starter-templates.tsx:19` | yes - C5514 failed |

Not faulted (cap of five reached): C5503, C5504, C5505, C5506, C5509, C5511, C5515. C5512 and C5516 are diff proofs and fail by construction on any byte change.

## Gate

`npx vitest run components/setup/setup.test.ts components/setup/starter-templates.test.tsx domain/contract/starter-preview.test.ts app/setup/page.test.ts "app/(app)/templates/preview/route.test.ts" components/templates` (from `web/`) - 13 files, 153 passed, 0 failed. `git diff --exit-code` for C5512 and C5516 both returned exit 0.

## Findings (ranked)

1. **C5513 not run, so AC 11 (44 px) and AC 12 (stacked, no h-scroll at 375 px) are unproven** - C5513 - no evidence; `checks.md:131`. This is the only arrangement claim for the section, and nothing a Verifier can run proves it. The code uses `grid grid-cols-1` (`starter-templates.tsx:38`), which suggests the layout stacks, but a class does not prove pixels. Blocks the verdict until the owner approves the hosted data change and the author records a `## Live run`.
2. **Order of the two halves is not asserted** - C5514 - `web/components/setup/starter-templates.test.tsx:118`. The split on `data-half=` passes whether agreement or contract comes first. Flow puts agreement first. This is a minor arrangement gap.
3. **Precision gap in C5505's "saved terms" assertion** - C5505 - `web/domain/contract/starter-preview.test.ts:74`. `terms ... join(" ")` containing `"30"` is weak. The defaults for a new org are also 30, so a document drawn with default terms instead of the org's would still pass. It needs a distinctive settings value (e.g. `paymentDays: 45`) to assert against.
4. **Unspecified sub-labels** - none - `web/components/setup/starter-templates.tsx:40` (`<h3>Agreement</h3>`) and the contract `<h3>Contract</h3>`. The code renders copy the plan does not decide. This is cosmetic, but no check pins it.
