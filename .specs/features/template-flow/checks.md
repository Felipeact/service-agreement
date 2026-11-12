# Template flow checks

Profile: ui
Plan: `.specs/features/template-flow/plan.md`

31 checks in 4 slices · 0 one-way doors (approved: "write the checks and build", 2026-11-12) · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C5400:`). This feature numbers from C5400 (C5359 is the highest id in use). `npx vitest run <file> -t "C5400:"` selects one. On this machine vitest runs reliably from PowerShell.
- No SQL recipe: the feature has no migration. The existing `agreement_templates` recipe (`npm run test:db agreement_templates`) must stay green.
- Supabase and the PDF renderer are never real in a proof: use cases take fakes, the preview route takes a container double, components render with `renderToStaticMarkup`, the editor's timing is proven with fake timers and a fake `fetch`.
- No screenshot binds this feature; the screen checks enumerate the structure the plan states (what is present, in what order, how arranged), and the orchestrator runs the live pass afterwards.
- Existing approved checks stay true except the ones the owner's instruction removes with the `/agreements/new` page (listed in `## Retired by instruction` below, which the builder completes with exact file and test names before deleting anything).

## Retired by instruction

The owner said `/agreements/new` is not supposed to exist anymore (2026-11-12). The surface and its tests go together; each retired test is replaced by the launcher-based checks C5413-C5415 or removed with its surface. Candidates found by search (the builder confirms and records the exact test names here before deleting): the `NewAgreementFormView` tests and the link assertions in `components/agreements/agreements-list.test.ts` (C1360 link half, C1362, C1363), `app/(app)/agreements-list.test.ts`, `components/agreements/new-agreement-template.test.tsx` and the form halves of `components/agreements/plan-limit-views.test.tsx` (C5112) and C5357, the page test for `app/(app)/agreements/new`, and the string scans in `components/vocabulary.test.ts` and `domain/purity.test.ts` if they name the form.

## Checks

### S1 - The New agreement dialog asks for a template · ~8 files · ~70 KB · ~18k

**C5400** - The dialog draws a Template select above the Customer and Site fields; its options are "Standard agreement" first and selected, then each org template by name in name order; and under the select the chosen option's description is shown (AC 1)
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5400:"`

**C5401** - For an org with no template of its own the Template select has exactly one option, "Standard agreement", selected (AC 4)
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5401:"`

**C5402** - Under the choice the dialog reads "3 lines · 12 months term" for a template with three preset lines and a 12-month term, "3 lines" with no term, and "No preset lines" for a template with none and for Standard agreement (AC 5)
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5402:"`

**C5403** - When the templates are unavailable (`templates: null`) the select shows only Standard agreement, the dialog says "Templates are unavailable. You can still start a standard agreement.", and the Create button is still enabled (AC 6)
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5403:"`

**C5404** - `startAgreementAction` with a `templateVersionId` calls `agreementStore.create(siteId, templateVersionId)`, with Standard agreement (no version) calls it with no version, and a created agreement answers `started` in both (AC 2, AC 3)
Proof: `npx vitest run "app/(app)/new-agreement-actions.test.ts" -t "C5404:"`

**C5405** - When the store answers `invalid_template` the action answers `{ status: "invalid_template" }` creating nothing further, and the dialog shows "That template is no longer available. Choose another." and keeps its fields (AC 7)
Proof: `npx vitest run "app/(app)/new-agreement-actions.test.ts" -t "C5405:"`
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5405:"`

**C5406** - The dialog's props come from one function used by the three places it opens: the Agreements and Pipeline launcher and the Imports drop banner each receive the same `templates` list (AC 8)
Proof: `npx vitest run "app/(app)/new-agreement-launcher.test.tsx" -t "C5406:"`

**C5407** - `validateNewAgreement` accepts an optional `templateVersionId` that is a UUID, treats an empty one as none, and rejects anything else with the field named; the server action re-validates, so a forged non-UUID never reaches the store (AC 2, validation)
Proof: `npx vitest run domain/agreement/new-agreement.test.ts -t "C5407:"`

### S2 - Use template opens the dialog and the old page is gone · ~10 files · ~80 KB · ~20k

**C5410** - On the Templates preview, Use template is a `button` (no `href`) that calls its `onUse` with the selected template's latest version id; pressing it on a page with the dialog mounted opens the dialog (controlled `open` true) with that version chosen, and the page URL is unchanged (AC 9)
Proof: `npx vitest run components/templates/template-use-dialog.test.tsx -t "C5410:"`

**C5411** - Closing the dialog without creating sets `open` false, keeps the same card selected and calls no action (AC 10)
Proof: `npx vitest run components/templates/template-use-dialog.test.tsx -t "C5411:"`

**C5412** - A viewer sees no Use template button, an estimator, an admin and an owner do (AC 11)
Proof: `npx vitest run components/templates/template-preview.test.tsx -t "C5412:"`

**C5413** - The file `app/(app)/agreements/new/page.tsx` and its `NewAgreementForm` component no longer exist, so the route answers 404 (AC 12)
Proof: `npx vitest run "app/(app)/agreements/routes.test.ts" -t "C5413:"`

**C5414** - No non-test source file under `app`, `components`, `application` or `domain` contains the string `/agreements/new` (AC 12)
Proof: `npx vitest run "app/(app)/agreements/routes.test.ts" -t "C5414:"`

**C5415** - A writer sees the dialog launcher, never a link, as the New agreement control on the agreements list without a launcher slot and in the Pipeline empty state; a viewer sees none (AC 13)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C5415:"`
Proof: `npx vitest run components/kanban/pipeline-view.test.ts -t "C5415:"`

### S3 - A member can see and edit templates · ~9 files · ~70 KB · ~18k

**C5420** - `customizeSystemTemplateAction` for an owner saves a copy of the system template named "Standard agreement" and redirects to `/templates/<newId>`; when "Standard agreement" is taken it saves "Standard agreement (copy)"; for an estimator it answers `forbidden` and saves nothing (AC 14)
Proof: `npx vitest run "app/(app)/templates/template-actions.test.ts" -t "C5420:"`

**C5421** - On the preview of an org template an owner and an admin see an Edit link to `/templates/<templateId>`, an estimator and a viewer do not; the card menu's Edit goes to the same address; on the system template the preview shows Customize, not Edit (AC 14, AC 15)
Proof: `npx vitest run components/templates/template-preview.test.tsx -t "C5421:"`
Proof: `npx vitest run components/templates/template-card.test.tsx -t "C5421:"`

**C5422** - A saved body opened in the editor gives back the same body: `bodyFromTemplateForm(formFromBody(body))` equals `body` for a body with an intro, a closing text, both switches and two preset lines, and after saving the page selects that template and shows its name (AC 16)
Proof: `npx vitest run domain/agreement/template-form.test.ts -t "C5422:"`
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "C5422:"`

**C5423** - Each route directory under `app/(app)/templates` that has a `page.tsx` also has a `loading.tsx`, and the ones for `new` and `[templateId]` render the titles "New template" and "Edit template" (AC 17; the live absence of the blocking-route error is checked by the orchestrator in the dev server console)
Proof: `npx vitest run "app/(app)/templates/loading.test.ts" -t "C5423:"`

**C5424** - When saving answers `forbidden`, `not_found` or `unavailable` the editor shows, respectively, "You don't have permission to save templates.", "This template no longer exists." and "We couldn't save the template. Try again.", keeps every typed value and re-enables Save (AC 18)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "C5424:"`

**C5425** - When the org has its own templates the list shows only those as cards, and the dialog's choices still start with "Standard agreement" (AC 19)
Proof: `npx vitest run application/use-cases/templates.test.ts -t "C5425:"`
Proof: `npx vitest run components/agreements/new-agreement-template-choice.test.tsx -t "C5425:"`

### S4 - The editor shows the PDF · ~10 files · ~80 KB · ~22k

**C5430** - The editor draws two regions in this order, the form and then the preview, inside a container that is a column below 1280 px and two tracks from `xl`; the preview region carries the label "Preview" (AC 20)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "C5430:"`

**C5431** - After a field change no request is made before 700 ms; at 700 ms exactly one request is made carrying the latest values; two changes 300 ms apart make one request at 1,000 ms (AC 21)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5431:"`

**C5432** - While a request is in flight the frame says "Updating preview…" and keeps the last PDF; a newer change aborts the older request and its late answer is never shown (AC 22)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5432:"`

**C5433** - With invalid values the frame keeps the last good PDF, shows "Fix the highlighted fields to refresh the preview." and makes no request (AC 23)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5433:"`

**C5434** - An editor opened on a saved template, and one opened on a new template, each request a PDF once on mount without any edit (AC 24)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5434:"`

**C5435** - `POST /templates/preview` with valid values from an owner calls the renderer once with a document whose `number` is "AG-0000", `customerName` "Sample Customer Ltd.", `siteName` "Sample Site", `mark` "TEMPLATE PREVIEW", `tenant.name` the org's legal name, the posted intro, closing text and switches, one price line per preset line, and today's org terms; it answers 200 `application/pdf` with `Cache-Control: private, no-store` and calls no store write (AC 25)
Proof: `npx vitest run "app/(app)/templates/preview/route.test.ts" -t "C5435:"`

**C5436** - The preview PDF text shows the intro before the price table, a price row with the preset's price (`$450.00`) and one with `$0.00` for a preset line with no price, the Visit schedule only when its switch is on, the Service included section only when its switch is on, the Terms, then the closing text (AC 26)
Proof: `npx vitest run domain/agreement/template-preview.test.ts -t "C5436:"`
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5436:"`

**C5437** - The route answers 401 signed out, 403 for an estimator and for a viewer, 422 with `{ errors: [{ field, message }] }` for invalid values, 503 when the renderer throws, and in each case writes nothing (AC 27)
Proof: `npx vitest run "app/(app)/templates/preview/route.test.ts" -t "C5437:"`

**C5438** - When the request fails the frame says "Preview unavailable." with a Try again button that requests again, keeps the last good PDF if there was one, and the form fields stay editable (AC 28)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5438:"`

**C5439** - Once a PDF has been shown the frame offers "Open the preview in a new tab" linking to its object URL with `target="_blank"` and `rel="noopener noreferrer"` (AC 29)
Proof: `npx vitest run components/templates/template-preview-frame.test.tsx -t "C5439:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| places the dialog opens (3) | Pipeline C5406 · Agreements C5406 · Imports drop banner C5406 | - |
| Template choice states (4) | org templates listed C5400 · none of its own C5401 · templates unavailable C5403 · rejected version C5405 | - |
| preset summaries (3) | lines and term C5402 · lines without term C5402 · no lines C5402 | - |
| legacy `/agreements/new` references (4) | the page C5413 · source links C5414 · agreements list fallback C5415 · Pipeline empty state C5415 | - |
| Use template roles (4) | owner C5412 · admin C5412 · estimator C5412 · viewer C5412 | - |
| Edit controls by role (4) | owner C5421 · admin C5421 · estimator C5421 · viewer C5421 | - |
| editor save failures (3) | forbidden C5424 · not found C5424 · unavailable C5424 | - |
| `POST /templates/preview` statuses (5) | 200 C5435 · 401 C5437 · 403 C5437 · 422 C5437 · 503 C5437 | - |
| roles on the preview route (4) | owner C5435 · admin C5435 · estimator C5437 · viewer C5437 | - |
| preview frame states (6) | updating C5432 · invalid values C5433 · unavailable C5438 · opened on mount C5434 · new-tab link C5439 · debounce C5431 | - |
| preview PDF parts (6) | intro C5436 · price rows C5436 · schedule switch C5436 · service included switch C5436 · terms C5436 · closing text C5436 | - |
| route directories with a page (3) | `/templates` C5423 · `/templates/new` C5423 · `/templates/[templateId]` C5423 | - |

- Claims naming a status code, route or response shape: C5404, C5435, C5437 - each has a proof that crosses the boundary (the route test calls the handler; the action test calls the action with a container double)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`POST /templates/preview`, the actions) | one at the boundary (handler or action called with a container double) | one asserted case per row of the status table and the role table |
| Decides, not reached across a boundary (`buildTemplatePreviewDocument`, `formFromBody`, the dialog's summary text, the debounce and abort logic) | one at its own layer | one asserted case per branch: valid, invalid, in flight, superseded, failed |
| Screens (the dialog's Template choice, the editor's two regions, the preview frame, Use template) | one render test per region asserting the controls, their order and their count, and the container classes that arrange them | each member of the plan's enumeration (AC 1, 20, 22, 23, 28, 29) |
| Instrumentation (launcher wiring, route and loading file conventions, deleted files) | one proof each | the three launchers share the list (C5406); no loading screen is missing (C5423); the old page is gone (C5413, C5414) |

Evidence:

- the preview route: auth, role, validation, render, failure: 5 branch points -> decides
- the frame: idle, debounce, in flight, superseded, invalid, failed, fallback: 7 branch points -> decides
- the dialog: 4 template states -> decides
- closest analogues in the repo: `agreement-templates` C5340-C5354 (screens, actions, route gates) and the contract PDF route tests (C1636, C1637, C5224) for a PDF route

Cost: about 22 proofs at their own layer across about 18 files. Without these rows the debounce and abort rules and the route's status table would be proven only by a page that happens to render.

## Swept

- validation: C5407 (the version id), C5437 (invalid values 422), C5433 (invalid values in the editor)
- failure modes: C5405, C5403, C5438, C5424, C5437 (503)
- idempotency: n/a - the preview route is a pure render and writes nothing; a repeated request returns the same PDF (C5435); Use template creates an agreement only when the dialog is submitted
- authorization: C5412, C5421, C5437 (401, 403), C5420
- concurrency: C5432 (a newer request supersedes an older one and a late answer is ignored)
- data lifecycle: n/a - nothing is stored by this feature; object URLs are released when replaced or when the editor unmounts (asserted in C5432)
- dependency failure: C5403 (template list), C5437 (renderer), C5438 (request)
- state transitions: C5411 (dialog closed leaves the page), C5400-C5405 (dialog states)
- observability: n/a - no logging requirement beyond the existing route and adapter logging

## Out of scope

Same as the plan's `Out of scope`: click-on-the-page editing, choosing a template for an existing agreement, drag reordering of preset lines, a rate limiter on the preview route, contract wording editing, restoring or deleting the Standard agreement.

## Handoff

- S1 = ~18k (dialog, launcher, action, validation), S2 = ~20k (Use template dialog wrapper, page, deleting the old page and its tests), S3 = ~18k (customize action, Edit controls, loading files, editor messages), S4 = ~22k (preview route, preview document builder, frame component, editor layout). About 78k to write plus about 25k of existing files to read (about 100 KB: `new-agreement-dialog.tsx` 15 KB, `new-agreement-launcher.tsx`, the templates components and actions, `agreements-list.tsx`, `pipeline-view.tsx`, the agreement PDF and the contract PDF route as the route precedent). About 100k, under the 150k budget - one builder
- Mechanism: one builder
