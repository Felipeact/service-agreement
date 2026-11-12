# Template flow

## Problem

The Templates feature shipped on 2026-11-12 does not work as one flow. Four things, reported by the owner after using it:

1. Starting an agreement never asks which template to use. The New agreement dialog (the one every page opens) has no template choice; only a leftover page, `/agreements/new?template=<id>`, knows about templates.
2. A member cannot see or edit a template. The only card an org has is the system "Standard agreement", which has no Edit, and `/templates/new` and `/templates/[templateId]` have no loading screen, so Next.js logs a blocking-route error ("Route /templates/new: Next.js encountered uncached data during prerendering") on every visit. The Supabase API log for the last 24 hours holds no `save_agreement_template` call, and the database holds no org template: nothing the owner tried reached the database.
3. Use template navigates to `/agreements/new`, a page that is no longer part of the product (the New agreement button opens a dialog everywhere it is shown; the page survives only as a fallback link in the agreements list and the Pipeline empty state and as the target of Use template).
4. The editor is a plain form. The owner expects it to work like a PDF editor: see the agreement as the customer gets it while editing.

Evidence the source gives: the owner's message of 2026-11-12, the API log and the console error above, and `SELECT` on `document_templates` showing only the system row. No volume figure.

When this ships, the New agreement dialog asks for a template (Standard agreement by default), Use template opens that dialog with the template chosen, a member can open and edit their own templates (the system one is customised into an org copy), and the editor shows the real agreement PDF next to the form, refreshed as they type.

## Flow

Reuses the controlled `NewAgreementDialog` (it already has `open`, `onClose` and an `initialFile`, driven by the Imports drop banner), `listAgreementTemplates`, the batch-1 `buildAgreementDocument` with a template body, `reactPdfDocumentRenderer` (the agreement PDF), `validateAgreementTemplate` and `bodyFromTemplateForm`, and the save, duplicate and archive actions, instead of a second dialog, a second renderer or a second validator.

1. A writer opens the dialog from Pipeline, Agreements or the Imports banner -> `NewAgreementLauncher` / `dialogProps` (exist) now also load the org's templates through `listAgreementTemplates` (exists) -> `NewAgreementDialog` (exists) shows the Template choice and sends `templateVersionId` in the input of `startAgreementAction` (exists) -> `agreementStore.create(siteId, templateVersionId)` (exists) -> `create_agreement` (exists, unchanged).
2. On `/templates`, Use template (exists) becomes a button that mounts the dialog in controlled mode (new `TemplateUseDialog`, no door - placement; it wraps the preview and the dialog, and the page reads the dialog's props through the launcher's `dialogProps`, reusing the list it already read) with that template selected; the dialog's actions are the same ones the launcher passes.
3. `/agreements/new` (exists) and `NewAgreementForm` (exists) are deleted; the two fallback links become the launcher.
4. The system template's preview Customize (the card menu keeps Duplicate only) -> `customizeSystemTemplateAction` (new, no door) -> `duplicateAgreementTemplate` (exists; gains the option `asOwn`, which keeps the system name unless it is taken) -> the editor of the copy.
5. Editor change -> after 700 ms `POST /templates/preview` (new route handler, no door) -> `canWriteTemplates` gate (exists) -> `readTemplateFormInput` (new, types the posted JSON) + `previewBodyFromTemplateForm` (new, `bodyFromTemplateForm` with a placeholder name so a new template draws) -> `buildTemplatePreviewDocument` (new, domain) -> `buildAgreementDocument` (exists) with sample customer and site, the org's settings and logo (exist) -> `reactPdfDocumentRenderer.renderAgreement` (exists) -> `application/pdf` -> the editor shows it in a frame.

## Impact

| Front | What changes |
| --- | --- |
| domain | existing term: "template choice" - an agreement can be started from a template in the dialog; Standard agreement means no pin, the same as today |
| existing callers | `NewAgreementDialog` props gain `templates`; callers: `NewAgreementLauncher`, `ImportBanner` (through `dialogProps`), and the Templates page. `StartAgreementState`/`NewAgreementInput` gain an optional template version |
| existing callers | `startAgreementAction` passes the version to the store (the store already takes it) |
| existing callers | links to `/agreements/new`: `components/agreements/agreements-list.tsx` (fallback when no launcher slot), `components/kanban/pipeline-view.tsx` (empty state), `components/templates/template-preview.tsx` (Use template) |
| existing checks retired by the owner's instruction that `/agreements/new` no longer exists | the assertions that the agreements list renders a link to `/agreements/new` (C1360's link half and its fallback), `NewAgreementFormView` and its tests (C1362, C1363 and the form half of C5357, C5112's form half) and the page test for `/agreements/new`; each is replaced by the launcher-based equivalent or removed with the surface it tested, and the builder lists every one in the Handoff before deleting it |
| stored data | nothing to migrate: no migration, no new table, no new column |

## Relations

None - no stored-data shape change.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /templates/preview` | JSON: the editor's form values | `application/pdf` bytes | 200, 401, 403, 422 with `{ errors: [{ field, message }] }`, 503 |
| `GET /agreements/new` | - | removed | 404 |
| `GET /templates/new`, `GET /templates/[templateId]` | session | the editor with a loading screen | 200, 302 (unchanged), 404 (unchanged) |

Added while building (additive): a signed-out `POST /templates/preview` is redirected to `/login` by the session proxy before the handler can answer 401, so the editor treats any answer that is not `application/pdf` as "Preview unavailable."; the handler's own 401 stays for a request that reaches it. A body over 200,000 characters, or one that is not the editor's shape, answers 422 with one `{ field, message }`.

## Landing

None - nothing here is one-way: no migration, no stored shape, no external consumer. The preview route is consumed only by the editor of this app and can change shape freely; removing `/agreements/new` is reversed by adding a route.

- Nothing else in this change is hard to reverse

## Criteria

### S1: The New agreement dialog asks for a template (P1)

Choosing a template is part of starting an agreement, wherever the dialog opens.

**Acceptance Criteria**

1. WHEN the New agreement dialog opens THEN it SHALL show a Template choice above the customer and site fields, listing "Standard agreement" first and selected, then each non-archived agreement template of the org by name, each with its description under the name
2. WHEN a template is chosen and the agreement is created THEN `startAgreementAction` SHALL create it pinned to that template's latest version with its preset lines and open it
3. WHEN "Standard agreement" is chosen THEN the agreement SHALL be created with no template pin, as today
4. WHILE the org has no template of its own the Template choice SHALL show Standard agreement alone, selected
5. WHEN a template with preset lines is chosen THEN the dialog SHALL say under the choice how many lines and which term the agreement starts with, and "No preset lines" for none
6. IF the templates cannot be listed THEN the dialog SHALL still start a Standard agreement and say "Templates are unavailable. You can still start a standard agreement." beside the choice
7. IF the database rejects the chosen version (`invalid_template`) THEN the dialog SHALL say "That template is no longer available. Choose another." and create nothing
8. WHERE the dialog is opened from Pipeline, Agreements or the Imports drop banner THEN it SHALL show the same Template choice

**Independent test:** open New agreement on Pipeline, pick a saved template, create, and read the new agreement's lines.

### S2: Use template opens the dialog, and the old page is gone (P1)

**Acceptance Criteria**

9. WHEN a writer presses Use template on the Templates preview THEN the New agreement dialog SHALL open over the Templates page with that template selected, and the browser SHALL NOT navigate
10. WHEN the dialog is closed without creating an agreement THEN the Templates page SHALL be as it was, with the same card selected
11. WHERE the member is a viewer THEN Use template SHALL NOT be shown, as today
12. The route `/agreements/new` SHALL answer 404, and no link, redirect or test fixture in the app SHALL point to it
13. WHEN a page shows a New agreement control for a writer THEN it SHALL be the dialog launcher, including the agreements list without a launcher slot and the Pipeline empty state

**Independent test:** on `/templates` press Use template on a card and see the dialog with that template chosen; request `/agreements/new` and get 404.

### S3: A member can see and edit templates (P1)

**Acceptance Criteria**

14. WHEN an owner or admin presses Customize on the system template THEN the system SHALL save a copy named "Standard agreement" as the org's own template and open it in the editor, and WHERE that name is taken it SHALL use `Standard agreement (copy)`, `(copy 2)` and so on
15. WHEN an org's own template is selected THEN the preview SHALL show an Edit button to an owner or admin linking to `/templates/<id>`, and the card menu's Edit SHALL go to the same address
16. WHEN a template is saved THEN the list SHALL show it selected with its new name and "Updated" just now, and Edit SHALL open the editor with the saved values exactly
17. WHEN `/templates/new` or `/templates/[templateId]` loads THEN each SHALL show its own loading screen ("New template", "Edit template") and the server SHALL log no blocking-route error for it
18. IF a save fails for a reason other than a field error THEN the editor SHALL say so in words, naming forbidden ("You don't have permission to save templates."), not found ("This template no longer exists.") and unavailable ("We couldn't save the template. Try again.")
19. WHEN the org has its own templates THEN the Standard agreement SHALL stay available in the dialog's Template choice but SHALL NOT be listed as a card

**Independent test:** as the owner press Customize on the Standard card, save, and find the template in the list with Edit.

### S4: The editor shows the PDF (P1)

The form on one side and the real agreement PDF on the other, like a PDF editor.

**Acceptance Criteria**

20. WHEN the editor opens THEN it SHALL show the form at the left and the PDF preview at the right, and below each other under 1280 px
21. WHEN a field changes and stays unchanged for 700 ms THEN the editor SHALL request a PDF of the form's current values and show it in the preview
22. WHILE a request is in flight THEN the preview SHALL say "Updating preview…" and keep showing the last PDF, and WHEN a newer change starts a request THEN the older one SHALL be cancelled and its answer ignored
23. IF the current values are not valid THEN the preview SHALL keep the last good PDF and say "Fix the highlighted fields to refresh the preview.", and the form SHALL show its field messages as today
24. WHEN an existing template is opened THEN its PDF SHALL be shown without any edit
25. WHEN an owner or admin posts valid values THEN `POST /templates/preview` SHALL build the agreement PDF with `buildAgreementDocument` from the posted values as the template body and sample data: customer "Sample Customer Ltd.", site "Sample Site", number "AG-0000", the mark "TEMPLATE PREVIEW", the org's legal name, address, phone, accent colour and logo, and today's org terms; and SHALL write nothing
26. WHEN the preview PDF is drawn THEN it SHALL print the intro before the price table, one price row per preset line with its price (`$0.00` for none), the schedule and the service-included section only when their switches are on, the terms, and the closing text
27. IF the caller is signed out THEN the route SHALL answer 401; IF not an owner or admin 403; IF the values fail validation 422 with the field errors as JSON; IF rendering fails 503; and in each case it SHALL write nothing
28. IF the preview cannot be had THEN the preview area SHALL say "Preview unavailable." with a Try again button and the form SHALL keep working
29. WHERE the browser cannot show a PDF in a frame THEN the preview area SHALL offer "Open the preview in a new tab" for the last good PDF

**Independent test:** open `/templates/new`, type an intro, and watch the PDF show it within about a second.

## Out of scope

| Excluded | Why |
| --- | --- |
| Click-on-the-page editing of the PDF (an HTML page the member edits in place) | The owner chose the live PDF preview first; in-place editing is a follow-up feature on top of it |
| Choosing a template when sending or revising an existing agreement | The pin is chosen at creation (agreement-templates door 3) |
| Reordering preset lines by dragging | Lines can be added and removed; ordering by drag is a later improvement |
| A rate limiter on the preview route | The product has no limiter yet; the route is for owners and admins only and the body is capped by the validator |
| Editing the contract wording | Its own template keeps its own editor later |
| Restoring or deleting the Standard agreement system template | It is the default layout and never changes |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Template choice in the dialog | A native select under the label Template, with the description and preset summary beneath the chosen option | Matches the dialog's other selects; no new component | n |
| Customize naming | The copy is named "Standard agreement" (the system name), not "(copy)" | It becomes the org's own Standard agreement; `copyName` handles a clash | n |
| Preview debounce | 700 ms after the last change, one request at a time, older ones aborted | Feels live without a render per keystroke | n |
| How the PDF is shown | A frame on a blob URL of the response, with `#toolbar=0&view=FitH`, and an "Open in a new tab" link as the fallback | The browser's own PDF viewer; no PDF library in the client | n |
| Sample price when a preset line has none | `$0.00`, as the real agreement shows an unpriced line | The preview must match what the customer gets | n |
| Mobile | The preview sits under the form and refreshes the same way | One layout, two arrangements | n |
| Standard agreement while the org has its own templates | Still the first choice in the dialog | An agreement can always start plain | n |
| Profile | `ui` (project floor) | The editor is a screen; there is no screenshot of it, so the checks enumerate its structure from this plan | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen New agreement dialog | empty state (no org templates) | AC 4 |
| screen New agreement dialog | error state | AC 6, AC 7 |
| screen New agreement dialog | loading | n/a - the dialog loads with its launcher's existing skeleton |
| screen New agreement dialog | density and ordering | AC 1 |
| screen Templates preview | unauthorised | AC 11, AC 15 |
| screen Templates preview and card | destructive action confirms | n/a - nothing destructive is added (Archive keeps its confirmation) |
| screen template editor | loading | AC 17 |
| screen template editor | error state | AC 18, AC 23, AC 28 |
| screen template editor | empty state | AC 24 (a new template shows the Standard layout's PDF) |
| screen template editor | unauthorised | existing - `/templates/new` and `/templates/[templateId]` redirect a non-writer to `/templates` |
| screen template editor | density and ordering, arrangement | AC 20 |
| api `POST /templates/preview` | error shape and codes, who may call | AC 27 |
| api `POST /templates/preview` | versioning, rate limits | n/a - consumed only by this app's editor; no rate limiter exists in the product (Out of scope) |
| route `/agreements/new` | removed | AC 12 |
| document the preview PDF | structure, tone, next step | AC 25, AC 26 (the same document the customer receives, marked as a preview) |

## Sources

- The owner's message of 2026-11-12: the four points, "it should be like a pdf editor", and the choice of "Live PDF preview beside the form"
- `.specs/features/agreement-templates/` - the tables, actions, editor and the binding screenshot of the Templates list this builds on
- The Supabase API log (no `save_agreement_template` call in 24 hours) and the dev server console (blocking-route error on `/templates/new`) - the evidence for point 2
