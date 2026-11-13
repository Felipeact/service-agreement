# Setup template preview

## Problem

A new owner finishes paying, lands on `/setup`, confirms their company profile and reviews the starter catalog, and has still not seen the thing the product exists to produce: the agreement their customer will receive and the contract wording they will be asked to sign. The first time they see either is after they have imported a list and built an agreement. If the layout or the wording is not what they expected, they learn that late, after the trial clock has been running, and the only way to find it out is to do the work.

The roadmap names this as the third part of the Phase 5 setup-screen item ("a preview of the starter templates", Onboarding step 4) and recorded it as blocked on Phase 5.5 templates, which now exist. The source gives no volume figure and no measured drop-off; this is a product-shape gap, not a measured one.

When this ships, `/setup` shows an owner or admin, between the profile and the catalog review, the agreement PDF of the system template drawn on sample data with their own letterhead, and the system contract wording with their own terms filled in. Each links to where they can change it (`/templates`). Nothing is saved or created by looking.

## Flow

Reuses the editor's preview path instead of a second one: `TemplatePreviewFrame`, `POST /templates/preview`, `buildTemplatePreviewDocument` and `reactPdfDocumentRenderer` for the agreement, and `renderBlocks` with `templateValues` and `SYSTEM_CONTRACT_BODY` for the contract wording.

1. Owner or admin opens `/setup` -> `SetupForRequest` (exists) already reads the org's settings; it passes them on with the starter-template section data to `SetupView` (exists).
2. `SetupView` (exists) mounts a new `StarterTemplates` section (new, no door - placement per conventions) between the profile card and the catalog review.
3. Agreement half: `StarterTemplates` mounts `TemplatePreviewFrame` (exists) with `templateFormFromBody(SYSTEM_AGREEMENT_BODY)` (exists) -> `POST /templates/preview` (exists, unchanged) -> `canWriteTemplates` gate (exists) -> `buildTemplatePreviewDocument` (exists) -> `reactPdfDocumentRenderer.renderAgreement` (exists) -> `application/pdf` shown in the frame.
4. Contract half: `StarterTemplates` calls `buildStarterContractPreview` (new, domain, no door - placement), which fills `SYSTEM_CONTRACT_BODY` (exists) through `templateValues` (exists) with the org's settings as terms and sample customer and site names, and `renderBlocks` (exists) returns the blocks; `StarterTemplates` draws them as text.
5. out: a link to `/templates` under each half (the screen where the org copies and edits the system template).

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: "starter template" - on this screen, the system agreement template and the system contract wording. Packs carry no template text of their own (Phase 5.5 item 4, which needs the lawyer), so every trade sees the same two |
| existing callers | `SetupView` props do not change: `StarterTemplates` builds the contract blocks from the `settings` it already receives. `TemplatePreviewFrame` is reused unchanged |
| existing callers | The setup page's three actions, `setupAction`, `draftCatalogAction` and `acceptDraftAction`, are untouched, as is Skip |
| stored data | nothing to migrate: no migration, no new table, no new column |
| existing checks | first-login-setup's claims about the order of the profile and catalog sections (the section list in `components/setup/setup.test.ts`) stay true for those two; the new section sits between them, so any assertion that the catalog follows the profile directly is re-read by the builder and listed in the Handoff before it changes |

## Relations

None - no stored-data shape change.

## Surface

None - nothing consumed outside. `POST /templates/preview` is reused with its signature and statuses unchanged (401, 403, 422, 503, `application/pdf`).

## Landing

None - nothing here is one-way. No schema, no new dependency, no new route and no persisted choice; the section is derived from constants and the org's own settings on every request, so removing it later reverses everything.

- Nothing else in this change is hard to reverse

## Criteria

### S1: The owner sees their agreement on the setup screen (P1)

`/setup` draws the system agreement template as the customer's PDF, with the org's letterhead, before the owner leaves.

**Acceptance Criteria**

1. WHEN an owner or admin opens `/setup` THEN the system SHALL show a "Your starter templates" section between the profile card and the catalog review.
2. WHEN the section mounts THEN the system SHALL request `POST /templates/preview` once at once, with the fields of `SYSTEM_AGREEMENT_BODY`, and show the returned PDF in the frame.
3. WHILE the PDF is being made the system SHALL show "Updating preview…" in the frame and keep the rest of the screen usable.
4. IF the preview request fails or does not return a PDF THEN the system SHALL show "Preview unavailable." with a Try again control, and Save and Skip SHALL still work.
5. The system SHALL draw the agreement preview with the org's saved legal name, address, phone, logo and terms, and the mark TEMPLATE PREVIEW on every page.
6. WHEN the owner has typed in the profile form but not saved THEN the preview SHALL still show the saved values, and the section SHALL say "Shown with the details you have saved so far."

### S2: The owner sees their contract wording (P1)

The system contract clauses are shown as text with the org's own terms filled in.

**Acceptance Criteria**

7. WHEN the section renders THEN the system SHALL list the blocks of `SYSTEM_CONTRACT_BODY` in order, each variable filled from the org's saved terms (for a new org: `30 days`, `5%`, its province, and so on) and `Sample Customer Ltd.` and `Sample Site` for the customer and site.
8. IF a variable has no value for the org (a setting that is not set) THEN the system SHALL leave out the clause that uses it, the same rule the contract PDF follows.
9. The system SHALL label the contract half as a sample ("Sample wording, not a signed contract") and SHALL NOT offer a PDF or a signing control for it.

### S3: The section changes nothing and is reachable (P2)

**Acceptance Criteria**

10. The system SHALL create, update or delete no row, object or event when the section is viewed, and Save and Skip SHALL behave as they did before this feature.
11. WHERE the section is shown THEN each half SHALL link to `/templates` with the text "Customize in Templates", and the link SHALL be at least 44 px high at 375 px.
12. WHILE the viewport is 375 px wide the system SHALL show the two halves stacked, with no horizontal scroll.
13. IF the member is not an owner or admin THEN the system SHALL NOT show the section, because the screen already redirects them away (first-login-setup).
14. WHEN the org's catalog is empty (the "Other" trade) THEN the system SHALL still show the section after the profile card and before the empty-catalog notice.

**Independent test:** sign in as the demo owner with `setup_completed_at` null, open `/setup`, see the PDF and the clauses, change nothing, press Skip.

## Out of scope

| Excluded | Why |
| --- | --- |
| Editing a template from `/setup` | `/templates` owns editing and the editor needs the full width; a link is enough |
| Per-trade or per-province starter text | Phase 5.5 item 4; needs the lawyer (decision 14). Every trade sees the same system template until then |
| Previewing unsaved profile edits | Needs the profile fields posted to the preview route and a second input type; the roadmap item asks for a preview, not a live one |
| A contract PDF preview | No sample-contract renderer exists, and a contract PDF carries signature fields that mean nothing before sending |
| Showing the preview again after setup | Setup is shown once; `/templates` is the permanent home |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| What "starter templates" are | The system agreement template and the system contract wording, since packs hold no template text yet | Item 4 of 5.5 (pack templates) is open and needs the lawyer | n |
| Where in the screen | Between the profile card and the catalog review | The owner has just confirmed their company, and the preview uses it; the catalog is reference material | n |
| Contract half as text, not PDF | Rendered blocks on the page | No contract preview renderer exists and a text list needs none | n |
| Preview uses saved settings | Yes, with a visible note | The route reads settings from the database; posting unsaved ones widens a route that is otherwise unchanged | n |
| Visibility | Every owner or admin of a pending org, with no way to hide it | Setup is shown once and Skip leaves it | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/setup` section | loading state | AC 3 |
| screen `/setup` section | error state | AC 4 |
| screen `/setup` section | empty state | n/a - the system template always exists, so the section always has content |
| screen `/setup` section | unauthorised | AC 13 |
| screen `/setup` section | density, ordering and arrangement at 375 px | AC 1, AC 12 |
| screen `/setup` section | destructive action confirms | n/a - nothing in the section changes data |
| API `POST /templates/preview` | error shape, codes, who may call, rate limit | existing - signature unchanged; 401, 403, 422, 503 as built in template-flow, no limiter (accepted there) |

## Sources

- `ROADMAP.md` Phase 5, "Setup screen: the starter template preview (needs Phase 5.5 templates)" and the Onboarding section step 4 - the item and its wording.
- `.specs/features/first-login-setup/plan.md` Out of scope, "Template preview" - where it was deferred.
- `.specs/features/template-flow/plan.md` Flow 5 - the preview path this reuses.
