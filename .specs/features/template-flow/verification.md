# Template flow verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: edc7216..e0cbb32 (HEAD); round 2 scope 4534d9d..e0cbb32
**Round**: 2 - scoped (round 1 is kept in `verification-round1.md`, verdict FAIL at 4534d9d)
**Verifier**: independent sub-agent (author != verifier)

Round 1 failed on 12 surviving mutants, two retired claims without a replacement, and two unmet Test policy rows. The fix round (9133f3c, 4a7d2aa, e0262c6, e0cbb32) changed tests, CONTEXT.md and checks.md only (`git diff 4534d9d..HEAD --stat`: 10 files, none production code). Every round 1 survivor was re-injected and is now killed; proofs re-ran in full at HEAD. Sections marked "carried from 4534d9d" were not re-derived because no production file changed.

## Binding sources

No screenshot binds this feature; plan.md's Criteria, Observable and Flow are the binding source (carried from 4534d9d; no interface file changed since).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan.md Criteria AC 1-29, Observable, Flow, Impact | yes - carried from 4534d9d | none (observation unchanged: AC 29 "WHERE the browser cannot show a PDF" versus the always-shown link at `template-preview-frame.tsx:107-111`, compatible with C5439) | - |

## Checks

All 31 checks: the round 1 evidence below is carried from 4534d9d. Production code is unchanged and every proof re-ran at HEAD in round 2: `npm test` 297 files, 4927 passed, 0 failed (includes every C5400-C5439 test), and the touched files by name: 54 passed, 43 skipped. The fix round strengthened C5410 and C5415 (page wiring), C5420 (control), C5433 (server 422) and C5437 (cap).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5400 | Template select above Customer/Site; Standard first and selected; org templates in name order; description under it | `new-agreement-template-choice.test.tsx -t "C5400:"` exit 0, 2 tests | `new-agreement-template-choice.test.tsx:52` `expect(markup.indexOf('for="newAgreementTemplate"')).toBeLessThan(markup.indexOf('for="newAgreementCustomer"'))`; `:55` `expect(texts).toEqual(["Standard agreement", "Annual plan", "Blank wording", "Quarterly HVAC"])`; `:56` selected `["Standard agreement"]`; description `:60-63` | PASS |
| C5401 | no own template: one option, Standard, selected | same file `-t "C5401:"` | `:68` `expect(texts).toEqual(["Standard agreement"])`; `:69` selected | PASS |
| C5402 | "3 lines · 12 months term", "3 lines", "No preset lines" (and Standard) | same file `-t "C5402:"`, 4 tests | `:77` `expect(html([template], {...})).toContain(expected)` over the three rows; `:82` `toContain("No preset lines")` | PASS |
| C5403 | `templates: null`: only Standard, message, Create enabled | same file `-t "C5403:"` | `:88` texts `["Standard agreement"]`; `:89` message string; `:92` `expect(create).not.toMatch(/\sdisabled=""/)` | PASS |
| C5404 | version passed to `agreementStore.create(siteId, versionId)`; Standard calls it with no version; `started` | `new-agreement-actions.test.ts -t "C5404:"` (4) + choice test | `new-agreement-actions.test.ts:38` `toHaveBeenCalledWith(SITE, VERSION)`; `:45` `expect(create.mock.calls[0]).toEqual([SITE])`; `:39` state `started`; dialog sends `""`: `new-agreement-template-choice.test.tsx:164` | PASS |
| C5405 | `invalid_template` from the store -> action answers it; dialog says the sentence and keeps fields | action test + choice test `-t "C5405:"` | `new-agreement-actions.test.ts:58` `expect(state).toEqual({ status: "invalid_template" })`; `:60-61` customer/site not created; dialog `new-agreement-template-choice.test.tsx:142` alert `toContain("That template is no longer available. Choose another.")`, `:144-148` fields kept | PASS |
| C5406 | Agreements/Pipeline launcher and Imports banner get the same `templates` from one function | `new-agreement-launcher.test.tsx -t "C5406:"` (2) | `new-agreement-launcher.test.tsx:36-38` `expect(launcher.props.templates).toEqual(expected)`, `expect(banner.props.templates).toEqual(expected)`; `:45-46` null for all. Proves `dialogProps`/`Dialog`/`Banner` only; the pages' use of them is not proven (F1) | PASS |
| C5407 | `templateVersionId` optional UUID, `""` is none, else refused with the field named; action re-validates | `new-agreement.test.ts -t "C5407:"` (8) + action test | `new-agreement.test.ts:50-67` (UUID carried; undefined/""; not-a-uuid, short, padded, `__new` refused with `templateVersionId`); `new-agreement-actions.test.ts:51` `{ status: "invalid", errors: { templateVersionId: "Choose a template from the list" } }`, `:52` store not called | PASS |
| C5410 | Use template is a `button` with no href calling `onUse(versionId)`; with the dialog mounted it opens with that template; URL unchanged | `template-use-dialog.test.tsx -t "C5410:"` (3) + `template-preview.test.tsx -t "C5410:"` | `template-use-dialog.test.tsx:79` `toHaveBeenCalledWith(VERSION)`; `:88-92` `dialogEl().hasAttribute("open")` true, `chosen()` equals VERSION, `window.location.href` unchanged, `push` not called; `template-preview.test.tsx:63,65` button primary and no `<a>` | PASS |
| C5411 | closing without creating: open false, same card, no action | `template-use-dialog.test.tsx -t "C5411:"` | `:106` `hasAttribute("open")` false; `:107` heading still "Light commercial essentials"; `:108-109` `noop`/`push` not called | PASS |
| C5412 | viewer sees no Use template; estimator, admin, owner do | `template-preview.test.tsx -t "C5412:"` (4) + `template-use-dialog.test.tsx` | `template-preview.test.tsx:76-77` `expect(html.includes("Use template")).toBe(shown)` for the four roles; `template-use-dialog.test.tsx:125-127` no dialog without props | PASS |
| C5413 | page and `NewAgreementForm` gone, route answers 404 | `routes.test.ts -t "C5413:"` | `routes.test.ts:21-24` `existsSync(...)` false for page, loading, the directory and `new-agreement-form.tsx`; `:26` `[agreementId]/page.tsx` exists. The 404 itself rests on the existing `agreements.test.ts:336` (C741, malformed id and missing agreement are 404) and `[agreementId]/page.tsx:36` `if (!isUuid(agreementId)) notFound()`; no test requests `/agreements/new` | PASS |
| C5414 | no non-test source under app/components/application/domain contains `/agreements/new` | `routes.test.ts -t "C5414:"` | `routes.test.ts:31` `/\/agreements\/new(?![\w-])/`, `:33` `files.length > 100`, `:35` `expect(offenders).toEqual([])`. Non-vacuous: M34, M35 killed (below); `rg` over lib, infrastructure, proxy, config also finds none | PASS |
| C5415 | writer sees the launcher, never a link, on the agreements list without a slot and in the Pipeline empty state; viewer none | `agreements-list.test.ts -t "C5415:"` (2) + `pipeline-view.test.ts -t "C5415:"` | `agreements-list.test.ts:112-114` launcher present, `not.toMatch(/<a[^>]*>...New agreement</)`, no `href="/agreements/new"`; `:117` no slot -> no "New agreement"; `pipeline-view.test.ts:91-93,96` both boards. View level only; the Agreements page slot is unproven (F1) | PASS |
| C5420 | Customize: owner saves "Standard agreement" and redirects; clash -> "(copy)"; estimator forbidden, nothing saved | `template-actions.test.ts -t "C5420:"` (8) | `template-actions.test.ts:177` `rejects.toThrow("NEXT_REDIRECT /templates/${COPY}")`, `:179` `name: "Standard agreement"`, `:188` `"Standard agreement (copy)"`, `:192` `(copy 2)`, `:206-208` forbidden and `save` not called | PASS |
| C5421 | Edit link for owner/admin on org template, none for estimator/viewer; card menu Edit same address; system shows Customize not Edit | `template-preview.test.tsx -t "C5421:"` (5) + `template-card.test.tsx -t "C5421:"` | `template-preview.test.tsx:110` `<a href="/templates/t-1">Edit</a>`, `:116-117` no Edit for estimator/viewer, `:122-123` Customize button, no Edit; `template-card.test.tsx:69` `href="/templates/t-1"` | PASS |
| C5422 | saved body reopens identically; after save the page selects that template | `template-form.test.ts -t "C5422:"` (2) + `page.test.ts -t "C5422:"` | `template-form.test.ts:83` `expect(bodyFromTemplateForm(templateFormFromBody(body))).toEqual({ ok: true, body })`; `page.test.ts:62` `selectedId` `"t-new"`, `:65-66` renamed card and `h2` | PASS |
| C5423 | every templates route dir with a page has a `loading.tsx`; titles "New template"/"Edit template" | `loading.test.ts -t "C5423:"` (4) | `loading.test.ts:19` the three dirs listed `[".", "[templateId]", "new"]`, `:20` `missing` `toEqual([])`, `:34-35` titles contained. Live half is the orchestrator's | PASS |
| C5424 | forbidden / not_found / unavailable save messages, values kept, Save re-enabled | `template-editor.test.tsx -t "C5424:"` (4) | `template-editor.test.tsx:158` `test.each` over the three statuses with their message strings; mutant M29 (message edit) killed | PASS |
| C5425 | own templates -> only they are cards; dialog choices still start with Standard | `use-cases/templates.test.ts -t "C5425:"` (3) + choice test | `templates.test.ts:20` names `["Annual plan","Quarterly HVAC"]`; `new-agreement-template-choice.test.tsx:105` `["Standard agreement", "Quarterly HVAC"]` | PASS |
| C5430 | form then preview, in a container that is a column below xl and two tracks from xl; region labelled Preview | `template-editor.test.tsx -t "C5430:"` (2) | `:188-189` `preview` index > `form` index, `:190` one `aria-label="Preview"`, `:193-194` fields inside region 1; `:201-203` `flex-col`, `xl:grid`, `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`, `:204` no bare `grid-cols-`. Code `template-editor.tsx:239,240,261` (container, form region, `<TemplatePreviewFrame>`). Structural, not label-only | PASS |
| C5431 | no request before 700 ms, one at 700, two changes 300 apart -> one at 1,000 | `template-preview-frame.test.tsx -t "C5431:"` (3) | `:77-79` 699 ms -> 1 call, +1 -> 2 calls; `:81-82` url/method; `:96-100` `bodyOf(1).intro` is "Second." and still 2 calls at +2000 | PASS |
| C5432 | in flight: "Updating preview…" and last PDF kept; newer change aborts older and late answer ignored; URLs released | `template-preview-frame.test.tsx -t "C5432:"` (4) | `:124-125` text and `frameSrc()` `blob:preview-1#toolbar=0&view=FitH`; `:138,141` older `signal.aborted` false then true; `:150-151` second PDF only; `:157-163` `revoked` `["blob:preview-1","blob:preview-2"]`; `:171-172` unmount aborts, no URL | PASS |
| C5433 | invalid values: last PDF kept, message shown, no request | `template-preview-frame.test.tsx -t "C5433:"` (3) | `:181` `calls` length 1, `:182` message, `:183` last PDF kept; `:207-210` editor shows field messages with no alert banner | PASS |
| C5434 | saved and new template each request once on mount | `template-preview-frame.test.tsx -t "C5434:"` (2) | `:216-217` one call, `bodyOf(0)` equals SAVED; `:224-225` new form `EMPTY_TEMPLATE_FORM`, `:229` still 1 | PASS |
| C5435 | route: owner/admin -> renderer once with the sample document, 200 pdf, `Cache-Control: private, no-store`, no write | `preview/route.test.ts -t "C5435:"` (7) | `route.test.ts:82-84` 200, `application/pdf`, `private, no-store`; `:93` `toMatchObject({ number: "AG-0000", customerName: "Sample Customer Ltd.", siteName: "Sample Site", mark: "TEMPLATE PREVIEW" })`; `:94` tenant fields; `:104-105` `getOrgSettings(ORG)`, `tenantLogo(ORG)`; `:62-66` `noWrites` | PASS |
| C5436 | PDF text: intro before price table, `$450.00` and `$0.00` rows, schedule/service-included only when on, terms, closing text | `template-preview.test.ts` (10) + `agreement-pdf.test.ts -t "C5436:"` (5) | `agreement-pdf.test.ts:395-397` `positions.every(p >= 0)` and `inOrder(positions)` over intro, "Service and price", "$450.00", "$0.00", "Visit schedule", "Service included", "Terms", closing; `:410-413` per-switch `includes(...)` `toBe(schedule/scope)`; `template-preview.test.ts:53-57` lines and total 180000 | PASS |
| C5437 | 401 signed out, 403 estimator and viewer, 422 `{ errors: [{field,message}] }`, 503 renderer throws; nothing written | `preview/route.test.ts -t "C5437:"` (9) | `route.test.ts:131` 401, `:140` 403 (estimator, viewer), `:149,152` 422 and fields `["name","preset.lines.0.costPerVisitCents","preset.termMonths"]`, `:189` 503, `noWrites()` after each. The oversize case is asserted only as a 422 (F3) | PASS |
| C5438 | request fails -> "Preview unavailable." + Try again, last PDF kept, form editable | `template-preview-frame.test.tsx -t "C5438:"` (5) | `:239` text, `:241` `retry` defined; `:251-259` Try again requests at once and replaces the PDF; `:267,269` fields and Save not disabled; M26 (non-PDF accepted) killed | PASS |
| C5439 | after a PDF, "Open the preview in a new tab" with href = object URL, `_blank`, `noopener noreferrer` | `template-preview-frame.test.tsx -t "C5439:"` | `:274` absent before, `:277-279` `href` `blob:preview-1`, `target` `_blank`, `rel` `noopener noreferrer`; M25, M56 killed | PASS |

Round 2 additions to the evidence (located assertions):

| Check | New assertion | Evidence | Result |
| --- | --- | --- | --- |
| C5415 | Agreements page hands writers the launcher slot, a viewer none | `app/(app)/agreements-list.test.ts` `expect(view.props.newAgreement !== undefined).toBe(shown)` and `.type` is `NewAgreementLauncher` (owner, admin, estimator, viewer) | PASS |
| C5415 | Imports page hands writers the banner | `app/(app)/imports-history.test.ts` `expect(view.props.banner !== undefined).toBe(shown)` and `.type` is `ImportBannerLauncher` | PASS |
| C5410 | Templates page mounts the dialog for owner, admin, estimator and not viewer; passes `customize` to owner and admin only | `app/(app)/templates/page.test.ts` `expect(element.props.dialog !== undefined).toBe(shown)`; `expect(typeof element.props.actions?.customize === "function").toBe(shown)` | PASS |
| C5437 | a 200,001-character closing text answers the too-large message, not a validator message | `app/(app)/templates/preview/route.test.ts` `expect(await response.json()).toEqual({ errors: [{ field: "body", message: "The template is too large to preview." }] })` | PASS |
| C5420 | Customize control calls the action with the template id; pending label; failure alert for forbidden, not_found, unavailable | `components/templates/customize-control.test.tsx:39` `toHaveBeenCalledWith("tpl-1")`, `:45` "Customizing…", `:55` `role="alert"` message | PASS |
| C5433 | a server 422 keeps the last PDF and shows the invalid message | `components/templates/template-preview-frame.test.tsx` `expect(text()).toContain("Fix the highlighted fields to refresh the preview.")`, `not.toContain("Preview unavailable.")`, `frameSrc()` is `blob:preview-1#toolbar=0&view=FitH` | PASS |
| C1362 (retired) | live-agreement site shown disabled with its number; only free sites selectable | `components/agreements/new-agreement-dialog.test.tsx:55` `expect(options).toEqual([...])` | PASS |
| C1364 (retired) | open_exists names the agreement, links to it, creates nothing more, keeps choices; not_found, unavailable, forbidden messages | `new-agreement-dialog.test.tsx:74` `toContain("AG-0042 is already in progress for this site.")`, `:76` href `/agreements/ag-live`, `:77` "Open AG-0042", `:92` message per status; action `app/(app)/new-agreement-actions.test.ts` `toEqual({ status: "open_exists", agreementId: "ag-live", number: "AG-0042" })` plus not_found (two causes), unavailable and forbidden cases | PASS |

## Coverage

Recomputed from the plan's Surface, Impact, Criteria and Flow and the code at HEAD; the members unproven in round 1 were re-probed with the same mutants.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| places the dialog opens (4: Pipeline, Agreements, Imports banner, Templates page) | `pipeline/page.tsx:31`, `agreements/page.tsx:21`, `imports/page.tsx:26`, `templates/page.tsx:23` | Pipeline `pipeline.test.ts:49-51`; Agreements `agreements-list.test.ts` C5415 (X5 killed); Imports `imports-history.test.ts` C5415 (X12 killed); Templates `page.test.ts` C5410 (X7 killed); one props function C5406 | - |
| Customize path (5) | plan AC 14, `customize-control.tsx`, `template-actions.ts:61-70` | drawn C5421; action C5420; page passes `customize` C5410 (X8 killed); button -> action `customize-control.test.tsx:39` (X9 killed); failure text `:55` (X10 killed) | - |
| `startAgreementAction` and dialog outcomes (9 statuses) | `new-agreement-state.ts:14-21`, `new-agreement-actions.ts:19-56` | started, invalid, invalid_template, forbidden (role and store), not_found (two causes), unavailable, open_exists in `new-agreement-actions.test.ts`; plan_limit existing `plan-limit-views.test.tsx`; dialog messages and the open_exists notice in `new-agreement-dialog.test.tsx` (X1-X4 killed) | - |
| dialog site options | `new-agreement-dialog.tsx:338-349` | C1362 `new-agreement-dialog.test.tsx:55` (X3 killed) | - |
| Template choice states (4), preset summaries (4), `/agreements/new` references (4), Use template roles (4), Edit roles (4), save failures (3), route statuses (5) and roles (4), PDF parts (6), route directories (3), editor regions (2) | carried from 4534d9d | C5400-C5403, C5405, C5402, C5413-C5415, C5412, C5421, C5424, C5435, C5437, C5436, C5423, C5430 | - |
| preview route input shapes (5) | `route.ts:28-34` | not JSON, array, wrong type, too many lines (`route.test.ts` test.each) and the over-cap body with its own message (M16 killed) | - |
| preview frame states (9) | `template-preview-frame.tsx` | C5431, C5432, C5433 (client and server 422; M57 killed), C5438, C5439 | - |
| retired tests (16) | `## Retired tests` in `verification-round1.md` | every retired claim has a replacement: C1362 and C1364 by `new-agreement-dialog.test.tsx` and the extended action test; the rest as in round 1 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (`POST /templates/preview`, the actions) | `preview/route.ts`, `template-actions.ts`, `new-agreement-actions.ts` | boundary tests with a container double | yes - route: 200, 401, 403 (two roles), 422 and the cap with its own message (M16 killed); Customize: four roles, malformed id, failure, signed out; `startAgreementAction`: every status has a case (X1 killed) |
| Decides, not reached across a boundary | `template-preview.ts`, `template-form.ts`, dialog summary, frame | own layer, one case per branch | yes - every branch has a case: valid, invalid, in flight, superseded, request error, server 422 (M57 killed) |
| Screens | dialog, editor, frame, preview, Use dialog, `CustomizeControl` | one render test per region: controls, order, count, classes | yes - the Customize control now has its own render tests (button, pending, three failure alerts, none when idle; X9, X10 killed); the rest as in round 1 |
| Instrumentation (launcher wiring, route and loading conventions, deleted files) | launcher, pages, `loading.tsx`, deleted files | one proof each | yes - C5406, C5413, C5414, C5423 and now each page's wiring (Agreements, Imports, Templates dialog and customize; Pipeline already) |

## Faults injected

Round 2 re-injected every round 1 survivor with the full `npm test` (4,927 tests) as the covering run, reverting each with `git checkout -- <file>`. Final `git status --porcelain` shows only this report, `verification-round1.md`, `node_modules/` and an untracked `.specs/features/setup-template-preview/` that is not mine. Round 1's other killed mutants are in `verification-round1.md` and carried, since no production file changed.

| Mutation | Location | Killed |
| --- | --- | --- |
| X5 Agreements page passes no launcher slot | `agreements/page.tsx:21` | yes - 3 tests fail (C5415 page tests) |
| X12 Imports page passes no banner | `imports/page.tsx:26` | yes - 3 tests fail (C5415 banner tests) |
| X7 Templates page mounts no dialog | `templates/page.tsx:23` | yes - 3 tests fail (C5410 dialog tests) |
| X8 Templates page passes no `customize` | `templates/page.tsx:35` | yes - 2 tests fail (C5410 customize tests) |
| X1 open_exists mapped to unavailable | `new-agreement-actions.ts:51` | yes - 1 fails (C1364 action) |
| X2 dialog open_exists notice text changed | `new-agreement-dialog.tsx:176` | yes - 1 fails (C1364 dialog) |
| X3 site with a live agreement selectable | `new-agreement-dialog.tsx:346` | yes - 1 fails (C1362) |
| X4 open_exists link target changed | `new-agreement-dialog.tsx:176` | yes - 1 fails (C1364 dialog) |
| X9 Customize calls `action("")` | `customize-control.tsx:11` | yes - 1 fails (C5420) |
| X10 Customize failure message never shown | `customize-control.tsx:18` | yes - 3 fail (C5420 alerts) |
| M16 body size cap removed | `preview/route.ts:28` | yes - 1 fails (C5437 cap) |
| M57 server 422 treated as unavailable | `template-preview-frame.tsx:54` | yes - 1 fails (C5433 server 422) |

Counts: 12 re-injected, 12 killed. Cumulative: 66 executed across both rounds; the only two round 1 survivors not re-injected were judged equivalent or superseded (M11 superseded by M43, killed; M59 equivalent), the other 64 are killed.

## Screen enumeration

| Screen | Plan decides | Check | Code |
| --- | --- | --- | --- |
| New agreement dialog, Template choice | a select labelled Template (assumption row 1) | C5400 `:51` label `for="newAgreementTemplate"` | `new-agreement-dialog.tsx:273-291` native `Select` |
| | position: above Customer and Site | C5400 `:52-53` | Template block `:272-300` between the dropzone `:260` and the "Who is it for?" fieldset `:302` |
| | options: Standard first and selected, then org templates by name | C5400 `:55-56`; C5401 `:68-69`; C5425 `:105` | `:285-290` Standard then `offered` sorted `:71` |
| | description of the chosen option | C5400 `:60-63` | `:296` |
| | preset summary text | C5402 | `:297` `presetLabel(...)` |
| | unavailable text beside the choice, Create enabled | C5403 | `:292-293`, button `:393` |
| | invalid_template sentence | C5405 | `:186` + `START_MESSAGES` |
| | the field error `templateVersionId` on the select | none (only reachable by a forged request; low) | `:278` |
| Templates preview | Use template button (primary) for writers and estimators, none for viewer | C5410, C5412 | `template-preview.tsx:54-59` |
| | Edit link for owner/admin on an org template | C5421 | `:61-65` |
| | Customize (button) for owner/admin on the system template | C5421 `:122` | `:66` + `customize-control.tsx` (control behaviour unchecked: X9, X10) |
| | Duplicate for writers | existing C5344, C5410 `:64` | `:67` |
| Templates card | menu Edit for org templates to the same address; system menu Duplicate only | C5421 card `:69`; existing C5344 | `template-card.tsx:48-58` |
| Use dialog | dialog mounted over the page, template chosen, no navigation, same card after close | C5410, C5411 | `template-use-dialog.tsx:25-33` |
| Editor | two regions, form then preview | C5430 `:188-195` | `template-editor.tsx:240,261` |
| | arrangement: column below xl, two equal tracks from xl | C5430 `:201-204` (asserts the class string on the rendered container) | `:239` |
| | the preview region carries the label Preview | C5430 `:190,195` | `template-preview-frame.tsx:81,83` |
| Preview frame | updating / invalid / unavailable texts, Try again, new-tab link | C5432, C5433, C5438, C5439 | `:85-99,107-111` |
| | the frame (iframe with `#toolbar=0&view=FitH`) | C5432 `:125` asserts `frameSrc()` | `:103` |
| | an empty dashed placeholder before the first PDF | none; the plan does not draw it | `:105` rendered, `aria-hidden`, low (observation) |
| | the "Open in a new tab" link is conditional on the browser (AC 29 "WHERE") | C5439 asserts it appears after a PDF | `:107` always after a PDF; compatible with the check, wider than the plan's wording (observation) |

Round 2: unchanged by the fix round (no interface file changed). The Customize control's behaviour, previously unchecked, now has tests (`components/templates/customize-control.test.tsx`). Still low observations, not findings: the select's `templateVersionId` field error (`new-agreement-dialog.tsx:278`, reachable only by a forged request) and the dashed placeholder before the first PDF (`template-preview-frame.tsx:105`, not drawn by the plan).

## Gate

- Round 2 touched-file run (PowerShell, one invocation, 8 files): 54 passed, 43 skipped, 0 failed; each named test (C5410 x8, C5415 x8, C1362, C1364 x4, C5404, C5405, C5420 x6, C5433 x4, C5437 x12) listed individually.
- `npm test` - 297 files, 4927 passed, 0 failed.
- `npx tsc --noEmit -p .` - no errors outside `.next/` and `app/setup/draft-actions.test.ts`.
- Tree after fault injection: no mutant left behind (`git checkout -- <file>` after each).
