# Template flow verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: edc7216..4534d9d (HEAD)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 31 proofs run green at HEAD and each has a located assertion. The verdict is FAIL because of what the proofs do not hold: 12 non-equivalent surviving mutants (page wiring of the dialog launcher and Use template, the retired form's open_exists and busy-site claims, the preview body cap, the Customize control, one frame branch), two unmet Test policy rows, and two retired claims with no replacement. Ranked gaps are in `## Findings`.

## Binding sources

No screenshot binds this feature (checks.md line 13, plan.md `Assumptions` row "Profile"). plan.md's `Criteria`, `Observable` and `Flow` are the binding source for the screens; the checks and the code were compared against them (enumeration under `## Screen enumeration`).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan.md Criteria AC 1-29 (screens: dialog Template choice, Templates preview and card, editor, preview frame) | yes - read in full, compared with the code and the checks | none: no check contradicts a decision the plan makes concretely. Observation: AC 29 says "WHERE the browser cannot show a PDF" and C5439/`template-preview-frame.tsx:107-111` show the link whenever a PDF exists (plan wording is conditional, check and code are unconditional; judged compatible, a "shall" for the fallback is met) | none for the enumerated elements; wiring gaps are in Coverage |
| plan.md Observable table (empty, error, loading, density, unauthorised, arrangement) | yes | none | none: dialog empty C5401, error C5403/C5405, editor loading C5423, error C5424/C5433/C5438, empty C5434, arrangement C5430 |
| plan.md Flow 1-5 and Impact | yes - compared with the code | none | none beyond Findings F1 |

## Checks

Proof run (PowerShell, one invocation, 20 files, `-t "C54[0-3][0-9]:"`): `Test Files 20 passed (20)`, `Tests 127 passed | 155 skipped (282)`; every named test below appeared individually as a pass in the verbose output. Each check id exists in the tree (`rg -n "C54[0-3][0-9]:"`; no id missing; no proof resolves only to an untouched test: every file is in the diff).

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

## Coverage

Recomputed from the plan's `Surface`, `Impact`, `Criteria` and `Flow` and from the code (the places the dialog opens were taken from `rg "NewAgreementLauncher|ImportBannerLauncher|dialogProps"`; the retired list from `git diff edc7216`), not from checks.md's table. Page-wiring members were probed with mutants run against the whole suite (X5-X8, X12).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| places the dialog opens (4: Pipeline, Agreements, Imports banner, Templates page) | code `pipeline/page.tsx:31`, `agreements/page.tsx:21`, `imports/page.tsx:26`, `templates/page.tsx:23`; plan Impact | Pipeline: `pipeline.test.ts:49-51` (X6 killed). dialog props from one function: C5406. Agreements page slot: none (X5 survived). Imports page banner: none (X12 survived). Templates page `dialog` prop: none (X7 survived) | Agreements page slot `agreements/page.tsx:21`; Imports page banner `imports/page.tsx:26`; Templates page dialog `templates/page.tsx:23` |
| Customize path (5: button drawn by role, button -> action call, action roles, action outcomes, failure text) | plan AC 14, code `customize-control.tsx`, `template-actions.ts:61-70` | drawn: C5421; action roles and outcomes: C5420; page passes `customize`: none (X8 survived); button calls `action(templateId)`: none (X9 survived); failure text shown: none (X10 survived) | page passes the action `templates/page.tsx:35`; control glue `customize-control.tsx:11`; failure message `customize-control.tsx:18` |
| `startAgreementAction`/dialog outcomes (9 statuses: idle, forbidden, not_found, unavailable, started, invalid, invalid_template, open_exists, plan_limit) | `new-agreement-state.ts:14-21`, `new-agreement-actions.ts:19-56` | started C5404; invalid C5407; invalid_template C5405; plan_limit existing `plan-limit-views.test.tsx` startNotice; forbidden (viewer) C5404 `:72-75` | open_exists (action `new-agreement-actions.ts:51`, dialog `new-agreement-dialog.tsx:175-178`: X1-X4 survive the full suite); not_found / unavailable messages `new-agreement-state.ts:25-27` (no assertion) |
| dialog site options (free sites, busy sites shown disabled with their number) | `new-agreement-dialog.tsx:338-349`; retired C1362 | none (X3 survived the full suite) | busy sites disabled `new-agreement-dialog.tsx:343-349` |
| Template choice states (4) | plan AC 1, 4, 6, 7 | org templates C5400, none C5401, unavailable C5403, rejected version C5405 | - |
| preset summaries (3 + Standard) | `presetLabel` `template.ts` | C5402 (4 rows) | - |
| `/agreements/new` references (4: page, source links, agreements list fallback, Pipeline empty state) | plan AC 12, 13 | page C5413; links C5414 (M34, M35 killed); list C5415 (M32 killed); Pipeline C5415 (M33 killed) | - (the 404 itself is inferred from existing C741) |
| Use template roles (4), Edit roles (4) | `canUseTemplates`/`canWriteTemplates` `state.ts:21-28` | C5412 and C5421 each assert owner, admin, estimator, viewer (Edit: owner/admin vs estimator/viewer) | - |
| editor save failures (3) | `SAVE_MESSAGES` `state.ts:38-42` | C5424 x3 | - |
| `POST /templates/preview` statuses (5), roles (4) | plan Surface | 200 `route.test.ts:82`, 401 `:131`, 403 `:140`, 422 `:149`, 503 `:189`; owner/admin `:79` test.each, estimator/viewer `:137` test.each | - |
| `POST /templates/preview` input shapes (5: not JSON, array, wrong type, too many lines, over 200,000 chars) | `route.ts:28-34`, `template-form.ts:102-135` | first four `route.test.ts:170` test.each (asserted as 422 naming a field); over-cap: asserted only as a 422 (`:181`); M16 (cap removed) survived | the cap itself `route.ts:28` |
| preview frame states (idle, debounced, updating, superseded, invalid, unavailable, server-422, new-tab, retry) (9) | `template-preview-frame.tsx` | C5431, C5432, C5433, C5438, C5439, retry C5438 `:245-259` | server 422 -> "invalid" `template-preview-frame.tsx:54` (M57 survived) |
| preview PDF parts (6) | plan AC 26 | C5436 x6 (domain and PDF text) | - |
| route directories with a page (3) | `rg --files -g page.tsx app/(app)/templates` | C5423 | - |
| editor regions and arrangement (2 regions, 2 arrangements) | plan AC 20 | C5430 (structure and classes) | - |
| retired tests (see `## Retired tests`) (16 listed tests/blocks) | `git diff edc7216` over 25 test files | 12 have a replacement or a surviving equivalent; 2 retired claims have none | open_exists notice (C1364); busy-site options (C1362) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (`POST /templates/preview`, the actions) | `preview/route.ts`, `template-actions.ts` (`customizeSystemTemplateAction`), `new-agreement-actions.ts` | boundary: handler/action called with a container double: present for the route (`route.test.ts`), Customize (`template-actions.test.ts:173-225`), `startAgreementAction` (`new-agreement-actions.test.ts`) | no - the route and Customize rows are met except the route's size cap (M16 survived); `startAgreementAction` has no case for open_exists, not_found and unavailable (X1 survived the full suite), so "one asserted case per row of the status table" is not met for the changed action |
| Decides, not reached across a boundary (`buildTemplatePreviewDocument`, `formFromBody`, dialog summary, debounce and abort logic) | `template-preview.ts`, `template-form.ts`, `new-agreement-dialog.tsx` summary, `template-preview-frame.tsx` | own layer, one case per branch (valid, invalid, in flight, superseded, failed) | yes for the five named branches (C5431-C5434, C5438; M21-M27, M42, M44, M45 killed). The server-422 branch (`template-preview-frame.tsx:54`) is a sixth branch with no case (M57); recorded under Findings as low |
| Screens (dialog Template choice, editor two regions, preview frame, Use template) | `new-agreement-dialog.tsx`, `template-editor.tsx`, `template-preview-frame.tsx`, `template-preview.tsx`, `template-use-dialog.tsx` | one render test per region: controls, order, count, container classes | yes - dialog options order and count `:55`, editor order and classes `:188-204`, frame texts and link `:274-279`, Use template `:63-65`. `CustomizeControl` (a control on the preview) has no render test of its own beyond its button being present (X9, X10) |
| Instrumentation (launcher wiring, route/loading conventions, deleted files) | `new-agreement-launcher.tsx`, pages, `loading.tsx`, deleted files | one proof each: three launchers share the list (C5406), no loading screen missing (C5423), old page gone (C5413, C5414) | no - C5423, C5413, C5414 are met; C5406 proves the three launcher functions but not that the Agreements, Imports and Templates pages mount them (X5, X12, X7 survived) |

## Faults injected

Method: the brief allowed mutation in the real tree with `git checkout -- <file>` instead of a worktree (a worktree has no `node_modules`). Baseline `git status --porcelain` was `?? node_modules/`; after every mutant the file was restored with `git checkout -- <file>` (created file removed, deleted file restored); final porcelain is `?? node_modules/` plus this report. M-series ran the 20 proof files with `-t "C54[0-3][0-9]:"`; X-series ran the full `npm test` (4,893 tests). 66 mutants executed, 52 killed, 14 survived: 2 equivalent or superseded (M11, M59) and 12 real (marked `no`).

| Mutation | Location | Killed |
| --- | --- | --- |
| M01 dialog starts on first org template, not Standard | `new-agreement-dialog.tsx:72` | yes - C5400/C5401/C5410 |
| M02 action never passes the version to the store | `new-agreement-actions.ts:48` | yes - C5404 |
| M03 invalid_template answered as unavailable | `new-agreement-actions.ts:54` | yes - C5405 (2) |
| M04 invalid_template message changed | `new-agreement-state.ts:28` | yes - C5405 dialog |
| M05 version UUID check removed | `new-agreement.ts:58` | yes - C5407 (6) |
| M06 system template passed to the dialog | `new-agreement-launcher.tsx:18` | yes - C5406, C5425 |
| M07 Imports banner gets `templates={null}` | `new-agreement-launcher.tsx:51` | yes - C5406 |
| M08 Use template opens without the template chosen | `template-use-dialog.tsx:32` | yes - C5410, C5411 |
| M09 closing leaves `open` true | `template-use-dialog.tsx:32` | yes - C5411 |
| M10 Edit shown to an estimator | `template-preview.tsx:61` | yes - C5421 |
| M11 `{canUse && (` -> `{(canUse \|\| true) && (` (viewer) | `template-preview.tsx:54` | no - equivalent: the outer guard at `:52` already hides the block from a viewer; re-run as M43 below |
| M12 Customize never keeps the system name | `use-cases/templates.ts:34` | yes - C5420 (3) |
| M13 Customize role gate removed | `template-actions.ts:63` | yes - C5420 estimator, viewer |
| M14 preview route lets an estimator through | `preview/route.ts:25` | yes - C5437 |
| M15 `Cache-Control` weakened to `public` | `preview/route.ts:45` | yes - C5435 (2) |
| M16 body size cap removed (`if (false)`) | `preview/route.ts:28` | no - survived: `route.test.ts:179-183` asserts only status 422 and no render; the 250,000-character body is also rejected by the validator, so the cap is unobservable |
| M17 signed-out answers 403 | `preview/route.ts:24` | yes - C5437 |
| M18 render failure answers 500 | `preview/route.ts:48` | yes - C5437 |
| M19 unpriced line drawn `$0.01` | `template-preview.ts:19` | yes - C5436 domain, PDF, route |
| M20 PDF heading text changed | `pdf-sections.tsx:136` | yes - C5436 PDF (3) |
| M21 debounce 600 ms | `template-preview-frame.tsx:8` | yes - C5431 (3) |
| M22 superseded request not aborted | `template-preview-frame.tsx:68` | yes - C5432, C5433 |
| M23 object URLs never revoked | `template-preview-frame.tsx:77` | yes - C5432 |
| M24 invalid values still request | `template-preview-frame.tsx:37` | yes - C5433 (3) |
| M25 `rel` loses `noreferrer` | `template-preview-frame.tsx:108` | yes - C5439 |
| M26 non-PDF answer accepted | `template-preview-frame.tsx:55` | yes - C5438 |
| M27 first request waits for the debounce | `template-preview-frame.tsx:40` | yes - 17 tests |
| M28 two tracks from `lg` instead of `xl` | `template-editor.tsx:239` | yes - C5430 |
| M29 unavailable save message changed | `state.ts:41` | yes - C5424 |
| M30 saved intro opens as the closing text | `template-form.ts:33` | yes - C5422 |
| M31 saved template not selected after save | `templates/page.tsx:25` | yes - C5422 |
| M32 link fallback restored on the agreements list | `agreements-list.tsx:103` | yes - C5415 and C5414 |
| M33 Pipeline header loses the control | `pipeline-view.tsx:80` | yes - C5415 |
| M34 source links `/agreements/new?template=1` | `template-card.tsx` (appended) | yes - C5414 |
| M35 source mentions `/agreements/new` exactly | `domain/agreement/index.ts` (appended) | yes - C5414 |
| M36 `/templates/new/loading.tsx` deleted | `templates/new/loading.tsx` | yes - C5423 (2) |
| M37 old page file recreated | `agreements/new/page.tsx` | yes - C5413 |
| M38 description under the choice removed | `new-agreement-dialog.tsx:296` | yes - C5400 |
| M39 unavailable message never shown | `new-agreement-dialog.tsx:292` | yes - C5403 |
| M40 Customize button not drawn | `template-preview.tsx:66` | yes - C5421 |
| M41 dialog never sends the chosen version | `new-agreement-dialog.tsx:167` | yes - C5405 dialog |
| M42 nameless template not drawn by the preview | `template-form.ts:145` | yes - C5434, C5435, C5431 |
| M43 Use template shown to a viewer (both guards) | `template-preview.tsx:52,54` | yes - C5412 viewer, `template-use-dialog.test.tsx` |
| M44 Try again waits for the debounce | `template-preview-frame.tsx:92` | yes - C5438 |
| M45 last PDF dropped while updating | `template-preview-frame.tsx:44` | yes - C5432, C5438 |
| M46 Use template passes the template id, not the version | `template-preview.tsx:55` | yes - C5410 (3) |
| M47 preset summary wording | `template.ts` `presetLabel` | yes - C5402, C5410 |
| M49 validation answers 400 | `preview/route.ts` (422 responses) | yes - C5437 (6) |
| M53 Create disabled when templates unavailable | `new-agreement-dialog.tsx:393` | yes - C5403 |
| M54 preview region label changed | `template-preview-frame.tsx:81` | yes - C5430 |
| M56 new-tab link `target` changed | `template-preview-frame.tsx:108` | yes - C5439 |
| M57 server 422 treated as unavailable | `template-preview-frame.tsx:54` | no - survived: no test makes the server answer 422 to the frame |
| M58 preview region removed from the editor | `template-editor.tsx:261` | yes - C5430, C5431, C5433, C5434, C5438 |
| M59 post-fetch abort guard removed | `template-preview-frame.tsx:52` | no - equivalent: the fake and a real `fetch` reject on abort, and the guard after `blob()` (`:57`) remains; the superseded-answer claim is killed by M22 |
| X1 `startAgreementAction` maps open_exists to unavailable | `new-agreement-actions.ts:51` | no - survived the full suite (4,893 pass) |
| X2 dialog open_exists notice text changed | `new-agreement-dialog.tsx:176` | no - survived the full suite |
| X3 site with a live agreement selectable in the dialog | `new-agreement-dialog.tsx:346` | no - survived the full suite |
| X4 open_exists link target changed | `new-agreement-dialog.tsx:176` | no - survived the full suite |
| X5 Agreements page passes no launcher slot | `agreements/page.tsx:21` | no - survived the full suite: a writer would have no New agreement on `/agreements` |
| X6 Pipeline page passes no launcher slot | `pipeline/page.tsx:31` | yes - `pipeline.test.ts:51` (3 tests) |
| X7 Templates page mounts no dialog | `templates/page.tsx:23` | no - survived the full suite: Use template would do nothing |
| X8 Templates page passes no `customize` action | `templates/page.tsx:35` | no - survived the full suite: no Customize button |
| X9 Customize button calls `action("")` | `customize-control.tsx:11` | no - survived the full suite |
| X10 Customize failure message never shown | `customize-control.tsx:18` | no - survived the full suite |
| X11 frame previews the initial values, not the typed ones | `template-editor.tsx:261` | yes - C5431 editor |
| X12 Imports page passes no banner | `imports/page.tsx:26` | no - survived the full suite |

Adversarial result on (b): M34 and M35 confirm the C5414 scan is not vacuous for a link with a query string and for the bare path; the scan does not see a path built from two string pieces (inherent to a static scan, noted).

## Retired tests

`git diff edc7216 --stat` lists 25 test files; every deleted or changed assertion was compared with `## Retired by instruction`.

| Retired or changed | On the list | Replacement | Judgement |
| --- | --- | --- | --- |
| `agreements-list.test.ts` describe "/agreements/new": C1363 viewer forbidden panel; C1363 writer site picker; two C5357 | item 1 | C5413/C5414, C5404 viewer `new-agreement-actions.test.ts:72-75`, C5410 | acceptable: the page is gone; the viewer refusal is held by the action |
| same file C1357: only the `NewAgreementPage()` line removed | item 1 mechanical | assertions kept | acceptable |
| `components/agreements/agreements-list.test.ts` C1360 (link half) | item 2 | C5415 keeps the viewer half | acceptable |
| same: C1362 (only sites without a live agreement are options; busy sites shown) | item 2 | claimed "the dialog covers the site choice" | NOT acceptable: no dialog test exists (`rg "NewAgreementDialog" --glob "*.test.*"` finds only the C5400-C5425 file and `vocabulary.test.ts`); X3 survives the full suite |
| same: C1363 submit calls the action once with the chosen site | item 2 | C5404 dialog `new-agreement-template-choice.test.tsx:164` | acceptable |
| same: C1364 (open_exists names the live agreement; failure messages) | item 2 | claimed `START_MESSAGES` in `new-agreement-state.ts` | NOT acceptable: `rg "START_MESSAGES\|already in progress"` finds no test; X1, X2, X4 survive the full suite |
| same: C1365 (no eligible site -> panel linking to Customers) | item 2 | none, removed with the form | acceptable: behaviour belongs to the removed surface (the dialog offers "Add a new site" instead, `new-agreement-dialog.tsx:141`) |
| same: four C5357 form tests | item 2 | C5400, C5405, existing `startNotice` test | acceptable |
| `new-agreement-template.test.tsx` (whole file) | item 3 | C5404 | acceptable |
| `plan-limit-views.test.tsx` C5112 form half | item 4 | unchanged "C5112: the start dialog turns the same state into its notice" | acceptable |
| `pipeline-view.test.ts` C1359 | item 5 | C5415 | acceptable |
| `pipeline-view.test.ts` C118 adapted | item 5b | same claim with the launcher slot | acceptable: assertions kept |
| `templates-view.test.tsx` C5344 Edit count 2 -> 3 | item 5c | AC 15 adds the preview's Edit | acceptable |
| `template-preview.test.tsx` C5357, C5343 | item 6 | C5410 | acceptable |
| `vocabulary.test.ts` two fixtures gain `templates: []` | not listed (mechanical) | assertions kept (`git diff` shows only the prop added) | acceptable; checks.md says `vocabulary.test.ts` "do[es] not name the form" but it needed the new prop |
| `page.test.ts`, `template-editor.test.tsx`, `template-form.test.ts` | not listed | only an unused import/const removed | acceptable |

## Screen enumeration

What the plan decides per screen, whether a check asserts it, and whether the code renders it (and nothing else).

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

Nothing the code renders that the plan does not draw, other than the placeholder. Every element the plan decides has a check; the field error on the select and the Customize control behaviour have none.

## Findings

Ranked. 1-5 are FAIL reasons.

1. **Page wiring of the dialog and of Customize is unproven** (coverage members and Test policy row 4). X5 (Agreements page `agreements/page.tsx:21`), X12 (Imports page `imports/page.tsx:26`), X7 (Templates page dialog `templates/page.tsx:23`) and X8 (Templates page `customize`, `templates/page.tsx:35`) each survive the full suite. With the link fallback gone (`agreements-list.tsx:103`, `pipeline-view.tsx:80`), the page slot is the only way a writer gets New agreement, and a dropped slot or dialog silently removes the control or makes Use template do nothing. Only Pipeline is covered (`pipeline.test.ts:49-51`, X6 killed). Affects the claims of C5406, C5410, C5415, C5420/C5421.
2. **Two retired claims have no replacement** (`## Retired tests`): C1362 (busy sites shown disabled with their agreement number, `new-agreement-dialog.tsx:343-349`) and C1364 (open_exists names the live agreement with a link, action `new-agreement-actions.ts:51`, dialog `:175-178`, `:176`). checks.md says "the dialog covers" them; nothing does, and X1-X4 survive all 4,893 tests. The owner's instruction removes the page, not these behaviours of the dialog, which is the only place they now live. Test policy row 1 ("one asserted case per row of the status table") is unmet for `startAgreementAction`: open_exists, not_found, unavailable have no case.
3. **The preview body cap is untested** (M16). `route.test.ts:179-183` is titled "without being read as JSON" but asserts only `status` 422 and no render; the validator also rejects the 250,000-character intro, so removing `if (posted.length > MAX_REQUEST_CHARS)` (`route.ts:28`) changes nothing observable. Needs an assertion on the answer's field and message ("body", "The template is too large to preview.") or a parse spy. Precision gap on C5437.
4. **The Customize control's behaviour is unproven** (X9, X10). `customize-control.tsx:11` (`() => action(templateId)`) and `:18` (the failure message) have no test; C5420 tests the action in isolation and C5421 only that the button is drawn. AC 14 "presses Customize ... SHALL save a copy" is proven at the action, not at the button.
5. **A frame branch has no case** (M57). A 422 from the route (`template-preview-frame.tsx:54`) maps to the "Fix the highlighted fields" state; no test makes the server answer 422 to the frame. Low weight, listed because Test policy row 2 asks for one case per branch.

Observations, not FAIL reasons:

- (c) Preview route: role gate is server-side (`route.ts:25`, M14 killed); the org comes from the member only (`:35-36` `getOrgSettings(member.orgId)`, `tenantLogo(member.orgId)`); nothing is written (only reads in the handler; `noWrites` doubles the four container writes); `Cache-Control: private, no-store` (`:45`, M15 killed); input is typed by `readTemplateFormInput` (`template-form.ts:102-135`: every field type-checked, at most 20 lines, per-line shape), then `validateAgreementTemplate` caps text, codes and total JSON at 60,000 characters (`template.ts:46,185`); `{{...}}` in the intro is not a smuggling path because the same variable whitelist as a saved template applies and sample names are the only values. The body is read with `request.text()` before the length check (`:27-28`), so the cap limits parsing, not memory. A superseded request keeps rendering on the server (the handler ignores `request.signal`); bounded by the 700 ms debounce and the owner/admin gate; the plan's out-of-scope row accepts no limiter.
- (b) Strict-mode double request: with React strict mode the first effect run requests at once and is aborted by the cleanup, and the second run waits 700 ms because `requested.current` persists (`template-preview-frame.tsx:40`); in development the first PDF appears after about 700 ms and the aborted request still renders on the server. No effect in production. No test uses `StrictMode`.
- (b) Signed-out: the session proxy redirects `/templates/preview` to `/login` before the handler (`proxy.ts:6-8`, matcher at `:12`); the frame treats a 200 HTML answer as unavailable (`template-preview-frame.tsx:55`, M26 killed), and the handler's own 401 stays (`route.ts:24`, M17 killed).
- (b) C5434's `previewBodyFromTemplateForm` (`template-form.ts:144-146`): Save still requires a name because the action calls `bodyFromTemplateForm` (`template-actions.ts` `saveAgreementTemplateAction`) and `template-actions.test.ts:42` builds a form with `name: ""` for the save action; the editor shows the name error after a save attempt (`template-editor.test.tsx:106,116`). M42 killed.
- (b) C5415: the real pages pass the launcher: `agreements/page.tsx:21` and `pipeline/page.tsx:31` for writers, `undefined` for others; the empty Pipeline board and empty agreements list both render the header slot (`pipeline-view.tsx:80`, `agreements-list.tsx:112,169`). On the empty agreements list the launcher is rendered twice (header and empty panel), so two dialogs with the same element ids are in the DOM; this duplication predates the feature (the slot was already used in both places) and is now also true of `newAgreementTemplate`.
- (d) A forged `templateVersionId` of another org: the dialog lists the member's org list only (`new-agreement-launcher.tsx:14-23`, reader under RLS); a non-UUID is refused at `new-agreement.ts:58`; a foreign UUID reaches `create_agreement`, which raises `22023` (`20261112240000_agreement_templates.sql:351`), mapped by `infrastructure/supabase/agreements.ts:432` to `invalid_template` (test `infrastructure/supabase/agreements.test.ts:187`, C5356), by the action `new-agreement-actions.ts:52-55` (C5405) and by the dialog `new-agreement-dialog.tsx:186` (C5405). Standard agreement sends `""` and the action passes no version (`:48`).
- (e) Customize: owner/admin gate `template-actions.ts:63` (M13 killed); a clash falls back to the copy naming, case-insensitive (`use-cases/templates.ts:34`; M12 killed); a template that is not the system one is never saved under its own name (`template-actions.test.ts:214-215`).
- (f) Plan Impact and Flow versus code: matches (dialog props, launcher, Banner, Templates page via `dialogProps(list)`, links removed, `asOwn`, route, `buildTemplatePreviewDocument`). `CONTEXT.md:228` still describes `/agreements/new` as the site picker (not marked superseded like line 191); documentation only.
- (g) Frame: object URLs are revoked on replace and on unmount (`:75-78`, M23 killed, C5432 `:157-163`), superseded requests are aborted (`:68`, M22 killed), no state update or object URL after unmount (`:52,57` and the cleanup; C5432 `:171-172`). During the 700 ms debounce after a failure the old "Preview unavailable." text stays.
- Known and accepted, not counted: no live browser pass yet; `customer_portal` and `rls_isolation` SQL recipes; AC 16 "Updated just now" versus `updatedAgo` "Updated today" (`page.test.ts:67` asserts "Updated today").

## Gate

- Proofs: `npx vitest run <20 files> -t "C54[0-3][0-9]:"` (PowerShell) - 20 files passed, 127 tests passed, 155 skipped, 0 failed; all 31 check ids appear.
- `npm test` - 295 files, 4893 passed, 0 failed.
- `npx tsc --noEmit -p .` - no errors outside `.next/` and `app/setup/draft-actions.test.ts` (lines 62 and 104, predating this work).
- `npx eslint` on the 48 added or modified `.ts`/`.tsx` files of the range - exit 0, no output.
- `npm run test:db agreement_templates` - PASS, 1 passed, 0 failed.
- Tree after fault injection: `git status --porcelain` is `?? node_modules/` plus this report; no mutant left behind.
