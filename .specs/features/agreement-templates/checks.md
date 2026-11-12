# Agreement templates checks

Profile: ui
Plan: `.specs/features/agreement-templates/plan.md`

54 checks in 3 slices (plan S1 and S2 in the first two, S3 and S4 in the third) · 4 one-way doors (approved: "APPROVE, go with recommendation", 2026-11-12) · 2 open, 1 blocks go-live

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C5300:`). This feature numbers from C5300 (C5225 is the highest id in use). `npx vitest run <file> -t "C5320:"` selects one.
- **SQL** recipe `agreement_templates` runs with `npm run test:db agreement_templates` from `web/` (new `supabase/tests/agreement_templates.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `contract_templates` first did, so the hosted project needs no change until the owner applies it). Every run is rolled back; each assertion label starts with its check id.
- Supabase, Claude and Stripe are never called by a vitest proof: adapters take a client double, use cases take fakes, components render with `renderToStaticMarkup`.
- Existing approved checks stay true and unedited. The agreement PDF, review page and builder tests that exist today keep their expected text; only fixtures that must carry the new fields may change, as the plan's Impact row says.
- `create_agreement` keeps its plan-limit and site-inactive behaviour (C5100-C5106, C4xxx): the new argument is optional and the guard order is unchanged.

## Binding sources

The one binding source is the owner's screenshot of the Templates screen, kept at `.specs/features/agreement-templates/binding/templates-screen.png`. It decides **layout and fields**; DESIGN.md decides colours, type and components.

What the screenshot draws that the checks hold the code to (per screen, as enumerated in C5340-C5349): a header with the title "Agreement templates", the one-line subtitle and a primary New template button at the right; below it two regions side by side, a two-column grid of cards on the left and one preview panel on the right; each card has an icon tile top-left, a menu button top-right, a name, a two-line description, a divider, and a footer with the frequency label at the left and "Updated <relative time>" at the right; the selected card has its own border; the preview has an eyebrow "Template preview", the name, the description, a four-row box (Default frequency, Equipment types, Sections and a fourth row), a primary Use template button and a secondary Duplicate button under it, in that order.

Deliberate differences, recorded in the plan's Assumptions and not findings: no eyebrow above the page title; the fourth preview row reads Preset lines, not Pricing model; one icon-tile tint from the tokens; the screenshot's sidebar, workspace card, bell and Maintain branding are out of this feature; the nav gets a Templates link after Agreements.

## Checks

### S1 - Templates are stored, versioned, pinned and applied (database) · ~12 files · ~140 KB · ~35k

**C5300** - There is exactly one system `agreement` template (no org) whose version 1 body is `schema` 1 with an empty `intro`, an empty `footer`, `sections` `{ "schedule": true, "scope": true }`, a `preset` of `{ "termMonths": null, "lines": [] }` and the name "Standard agreement"; a member of org A and a member of org B both read it (AC 1)
Proof: `npm run test:db agreement_templates` (label C5300)

**C5301** - An owner calling `save_agreement_template(null, body)` creates one `agreement` template of the org and its version 1 and returns that id and `1`; an admin calling it with that id adds version 2; version 1's body is byte for byte unchanged after the second call (AC 2)
Proof: `npm run test:db agreement_templates` (label C5301)

**C5302** - An estimator, a viewer and a non-member calling `save_agreement_template` or `archive_agreement_template` get `42501` and no row is written or changed (AC 3)
Proof: `npm run test:db agreement_templates` (label C5302)

**C5303** - `save_agreement_template` raises `22023` and writes nothing for each of: `schema` 2, an unknown top-level key, a body over 64 KB, 21 preset lines, 31 blocks in `intro`, a text of 2,001 characters, an empty `name`, and a body that is not an object (AC 4)
Proof: `npm run test:db agreement_templates` (label C5303)

**C5304** - Saving a second non-archived template with an existing name in any letter case raises `23505`; a new version of the same template under its own name succeeds; the name of an archived template can be used again (plan Assumptions)
Proof: `npm run test:db agreement_templates` (label C5304)

**C5305** - `create_agreement(site, version)` with an org's own agreement template version writes that id on version 1 of the new agreement, and so does the system version, and a viewer calling it gets `42501` and creates nothing (AC 5)
Proof: `npm run test:db agreement_templates` (label C5305)

**C5306** - `create_agreement` with a version of another org, a version of a contract template, and an unknown id each raises `22023` and creates no agreement and no version (AC 5)
Proof: `npm run test:db agreement_templates` (label C5306)

**C5307** - `create_agreement(site)` with no version leaves `template_version_id` null on version 1, a missing site raises `P0002`, and a site that already has a live agreement raises `23505` (AC 9, database side)
Proof: `npm run test:db agreement_templates` (label C5307)

**C5308** - `send_agreement` on a draft whose pin is null sets the system agreement template's latest version, and on a draft pinned to an org version leaves that version (AC 6)
Proof: `npm run test:db agreement_templates` (label C5308)

**C5309** - Reviving a change request into a new version copies the pin of the version it copies, for a pinned and for an unpinned (null) version (AC 7)
Proof: `npm run test:db agreement_templates` (label C5309)

**C5310** - Updating `template_version_id` of a sent version is refused for the table owner and for an owner member, and the value is unchanged; on a draft it is not blocked (AC 8)
Proof: `npm run test:db agreement_templates` (label C5310)

**C5311** - An org may hold three `agreement` templates, and a second `contract` template for the same org still raises `23505` (door 1)
Proof: `npm run test:db agreement_templates` (label C5311)

**C5312** - `archive_agreement_template` sets `archived_at` once, leaves its versions, leaves an agreement pinned to it unchanged, and a second call leaves the first `archived_at` as it was (AC 20, database side)
Proof: `npm run test:db agreement_templates` (label C5312)

**C5313** - A member of org B reads none of org A's agreement templates or versions and reads the system ones; an authenticated member inserting into either table gets `42501`; anon reads and inserts are refused with `42501` (Relations, Surface)
Proof: `npm run test:db agreement_templates` (label C5313)

**C5314** - `create_agreement` from a preset with two lines copies them into version 1 as two service lines with the preset's description and visit months, `visits_per_year` equal to the number of months, and the preset's price per visit, or `0` when the preset price is null (AC 24)
Proof: `npm run test:db agreement_templates` (label C5314)

**C5315** - A preset line naming the codes `RTU` and `NOPE` links the org's type with code `RTU` to the line and leaves `NOPE` off; the line is still created (AC 24, AC 25)
Proof: `npm run test:db agreement_templates` (label C5315)

**C5316** - A preset `termMonths` of 24 sets version 1's term months to 24, and a null `termMonths` leaves the org's default term (AC 24)
Proof: `npm run test:db agreement_templates` (label C5316)

**C5317** - With the org at its live-agreement limit, `create_agreement(site, version)` raises `55000` with hint `plan_limit_agreements` and creates nothing (AC 26)
Proof: `npm run test:db agreement_templates` (label C5317)

**C5318** - A member editing a copied service line changes that line, and the template version's body is unchanged (AC 27)
Proof: `npm run test:db agreement_templates` (label C5318)

### S2 - The agreement draws its pinned template (domain, PDF, portal) · ~14 files · ~150 KB · ~38k

**C5320** - `buildAgreementDocument` for a pinned body with an intro "Welcome {{customer.name}}." and a closing text "Thank you, {{tenant.legalName}}." yields `intro` and `footer` rendered blocks with the names filled in, and the PDF text shows them in this order: title block, intro, price table, terms, closing text, page footer (AC 10)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5320:"`
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5320:"`

**C5321** - A body with `schedule` false and `scope` false yields a document with no schedule rows and a scope marked hidden, and the PDF text has no "Visit schedule" and no "Service included"; with both true both appear; the price table, the Terms section and the page footer appear in all four combinations (AC 11)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5321:"`
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5321:"`

**C5322** - For an editable draft the intro and terms variables are filled from today's settings; for a sent version they are filled from the version's frozen terms and its pin, and a change to the settings or a newer template version changes nothing (AC 12)
Proof: `npx vitest run domain/agreement/document.test.ts -t "C5322:"`

**C5323** - In an agreement intro, a clause using a variable with no value is omitted and a paragraph using it prints with an empty replacement (AC 13)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5323:"`

**C5324** - `validateAgreementTemplate` rejects each of: an empty name, a name over 80 characters, a description over 300, more than 30 blocks in `intro`, more than 30 in `footer`, a text over 2,000, an unknown variable (named in the reason), a preset with 21 lines, a visit month outside 1 to 12 or repeated, a price per visit that is negative or not a whole number of cents, a `termMonths` outside 1 to 60 (the product's own term cap), and an unknown key; and accepts 30 blocks, 20 lines, 80 characters and 60 months (AC 4, door 2)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5324:"`

**C5325** - The editor text format round-trips: a line `# Scope` is a heading block, `- Payment is due.` a clause, `Hello.` a paragraph, blank lines are dropped, and `blocksToText(textToBlocks(t))` equals the text for those three line kinds (plan Assumptions)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5325:"`

**C5326** - The derived frequency label is Monthly for 12 visit months, Quarterly for 4, Semiannual for 2, Annual for 1, Mixed for lines that differ, and no label when the preset has no lines; a card shows it (plan Assumptions)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5326:"`

**C5327** - The preview summary reads "N sections" and "M clauses" from the body, names the equipment types for the preset's codes in the org's own type names (a code with no type is shown as the code), and reads "3 lines · 12 months term" or "No preset lines" (AC 16)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5327:"`

**C5328** - The agreement reader returns the body of the version the agreement version is pinned to, the system body for a sent version whose pin is null, and throws, never answering other wording, when a pin cannot be read (AC 14)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C5328:"`

**C5329** - The agreement PDF route fails the request, with nothing drawn, when the reader throws (AC 14)
Proof: `npx vitest run "app/(app)/agreements/[agreementId]/pdf/route.test.ts" -t "C5329:"`

**C5330** - `portal_view` returns the frozen version's body with the agreement, and the portal use case builds the document from it and fails, drawing nothing, when the body is missing or invalid (AC 14, AC 15)
Proof: `npm run test:db agreement_templates` (label C5330)
Proof: `npx vitest run application/use-cases/portal.test.ts -t "C5330:"`

**C5331** - The customer's review page shows the intro before the price table, the closing text after the terms, and leaves out a hidden section, the same as the PDF for that version (AC 15)
Proof: `npx vitest run components/portal/review-page.test.tsx -t "C5331:"`

**C5332** - The agreement PDF page text for a document built with the system body is identical to the text of the document built before this feature (the existing agreement PDF tests pass unedited) and to a document built with no body argument (AC 9)
Proof: `npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C5332:"`

**C5333** - The code's `SYSTEM_AGREEMENT_BODY` equals the system version 1 JSON stored by the migration (parity)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5333:"`

**C5334** - The staff agreement page and its preview draw from the version's pin with today's settings while editable, and from the frozen pin once sent (AC 12, screen)
Proof: `npx vitest run application/use-cases/agreement-detail.test.ts -t "C5334:"`

### S3 - The Templates screen and Use template · ~22 files · ~160 KB · ~45k

**C5340** - `/templates` draws a header with the title "Agreement templates", the subtitle "Standardize scope and pricing without making every customer agreement feel generic." and, at the right of the title for an owner or admin only, one primary New template button linking to `/templates/new` (AC 16, AC 21, binding source)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5340:"`

**C5341** - Below the header the page has exactly two regions in this order: the card grid, then the preview panel; at 1440 px they sit side by side with the grid two columns wide, and at 375 px they stack with the grid one column wide (arrangement, binding source)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5341:"`

**C5342** - Each card has in order: an icon tile, a menu button (owner and admin only) at the top right, the name, the description, a divider, and a footer with the frequency label at the left and "Updated" with a relative time at the right; the selected card carries `aria-current="true"`; the others do not (AC 16, binding source)
Proof: `npx vitest run components/templates/template-card.test.tsx -t "C5342:"`

**C5343** - The preview shows in order: the eyebrow "Template preview", the name, the description, a box of four rows labelled Default frequency, Equipment types, Sections and Preset lines, then a primary Use template button and a secondary Duplicate button (AC 16, binding source)
Proof: `npx vitest run components/templates/template-preview.test.tsx -t "C5343:"`

**C5344** - Controls by role: owner and admin see New template, the card menu (Edit, Duplicate, Archive), Duplicate and Use template; an estimator sees Use template and none of the others; a viewer sees none of them and still sees the list and preview (AC 21)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5344:"`

**C5345** - For an org with no template of its own the page shows the system template as the only card, selected, with its preview, and the New template button for an owner or admin (AC 17)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5345:"`

**C5346** - When the list cannot be read the page shows "We couldn't load templates. Try again." with a link back to `/templates` and no cards; and the route has a loading screen that names the page and says it is loading (AC 22, AC 23)
Proof: `npx vitest run components/templates/templates-view.test.tsx -t "C5346:"`
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "C5346:"`

**C5347** - The selected card is the one named by `?selected=<templateId>`, the first card when the parameter is absent, and the first card when it names no listed template (AC 16)
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "C5347:"`

**C5348** - The main navigation has a Templates link to `/templates` directly after Agreements, for every role, and it is current on `/templates` and its sub-pages (binding source, arrangement)
Proof: `npx vitest run components/shell/shell.test.tsx -t "C5348:"`

**C5349** - The editor shows in order: Name, Description, Intro, a Visit schedule switch, a Scope switch, Closing text, Term length, then a Preset lines list whose rows each have a description, a month grid, equipment types and a price per visit with Add line and Remove; then Save and Cancel (AC 18)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "C5349:"`

**C5350** - When a field fails validation the editor stays open, shows each field's message beside it, and every field keeps what was typed (AC 18)
Proof: `npx vitest run components/templates/template-editor.test.tsx -t "C5350:"`

**C5351** - `saveAgreementTemplateAction` for an estimator answers `forbidden` and calls no store; for an invalid body answers the field errors and calls no store; for a valid body calls `save_agreement_template` once with the validated body and redirects to `/templates?selected=<id>` (AC 18, AC 21)
Proof: `npx vitest run "app/(app)/templates/template-actions.test.ts" -t "C5351:"`

**C5352** - `duplicateTemplateAction` saves a copy of the latest version named `<name> (copy)`, `<name> (copy 2)` when that is taken, and redirects to the copy's editor (AC 19)
Proof: `npx vitest run "app/(app)/templates/template-actions.test.ts" -t "C5352:"`

**C5353** - Archive asks for confirmation naming the template before it acts; confirming calls `archive_agreement_template` once and the card leaves the list; cancelling calls nothing (AC 20)
Proof: `npx vitest run components/templates/archive-control.test.tsx -t "C5353:"`
Proof: `npx vitest run "app/(app)/templates/template-actions.test.ts" -t "C5353:"`

**C5354** - Signed out, `/templates`, `/templates/new` and `/templates/[templateId]` redirect to `/login`; an estimator and a viewer are redirected to `/templates` from `/templates/new` and from `/templates/[templateId]`; a malformed id, an unknown id and another org's id answer 404 (Surface, AC 21)
Proof: `npx vitest run "app/(app)/templates/page.test.ts" -t "C5354:"`
Proof: `npx vitest run "app/(app)/templates/[templateId]/page.test.ts" -t "C5354:"`

**C5355** - The template store lists the org's non-archived agreement templates with their latest version, newest first by name, and maps `42501` to forbidden, `22023` to invalid, `23505` to name_taken, `P0002` to not_found, and anything else to unavailable with the code logged (Surface)
Proof: `npx vitest run infrastructure/supabase/templates.test.ts -t "C5355:"`

**C5356** - `supabaseAgreementStore.create(siteId, templateVersionId)` sends `p_template_version_id` only when given, maps `22023` to `invalid_template`, and still maps the plan-limit refusal as before (AC 24, AC 26)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C5356:"`

**C5357** - The preview's Use template is a link to `/agreements/new?template=<versionId>`; that page shows "From template: <name>" above the site choice; `createAgreementAction(siteId, templateVersionId)` passes the version to the store; and a plan-limit refusal shows the New agreement flow's message (AC 24, AC 26)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C5357:"`
Proof: `npx vitest run "app/(app)/plan-limit-actions.test.ts" -t "C5357:"`

**C5358** - `skippedCodes` returns the preset codes with no type in the org, and the agreement page shows "These equipment types are not in your catalog and were left off: NOPE" when there are any and nothing when there are none (AC 25)
Proof: `npx vitest run domain/agreement/template.test.ts -t "C5358:"`
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C5358:"`

**C5359** - The container exposes the template list, save, archive and duplicate use cases built on the member's own client, and the agreement store takes the optional version (wiring)
Proof: `npx vitest run composition/templates-wiring.test.ts -t "C5359:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| invalid bodies the save refuses in SQL (8) | schema 2 C5303 · unknown key C5303 · over 64 KB C5303 · 21 lines C5303 · 31 blocks C5303 · text 2,001 C5303 · empty name C5303 · not an object C5303 | - |
| `save_agreement_template` statuses (4) | 200 C5301 · 403 `42501` C5302 · 404 `P0002` C5301 (an id of another org) · 422 `22023` C5303 | - |
| `archive_agreement_template` statuses (3) | 200 C5312 · 403 `42501` C5302 · 404 `P0002` C5312 | - |
| `create_agreement` statuses with a template (6) | 200 C5305 · 404 `P0002` C5307 · 403 `42501` C5305 · 409 `23505` C5307 · 409 `55000` C5317 · 422 `22023` C5306 | - |
| template routes (3) | `/templates` C5340 (200), C5354 (302) · `/templates/new` C5349 (200), C5354 (302) · `/templates/[templateId]` C5349 (200), C5354 (302 and 404) | - |
| roles on the screen (4) | owner C5344 · admin C5344 · estimator C5344 · viewer C5344 | - |
| roles on the writers (4) | owner C5301 · admin C5301 · estimator C5302 · viewer C5302 | - |
| optional sections (4 combinations) | schedule shown, scope shown C5321 · schedule hidden, scope shown C5321 · schedule shown, scope hidden C5321 · both hidden C5321 | - |
| parts always drawn (3) | price table C5321 · Terms C5321 · page footer C5321 | - |
| frequency labels (6) | Monthly C5326 · Quarterly C5326 · Semiannual C5326 · Annual C5326 · Mixed C5326 · none C5326 | - |
| preview rows (4) | Default frequency C5343 · Equipment types C5343 · Sections C5343 · Preset lines C5343 | - |
| card parts (6) | icon tile C5342 · menu C5342 · name C5342 · description C5342 · divider C5342 · footer (frequency, updated) C5342 | - |
| editor fields (9) | Name C5349 · Description C5349 · Intro C5349 · Visit schedule C5349 · Scope C5349 · Closing text C5349 · Term length C5349 · Preset lines C5349 · Save and Cancel C5349 | - |
| editor validation rules (12) | empty name C5324 · name over 80 C5324 · description over 300 C5324 · intro over 30 blocks C5324 · footer over 30 blocks C5324 · text over 2,000 C5324 · unknown variable C5324 · 21 lines C5324 · bad visit month C5324 · bad price C5324 · bad term length C5324 · unknown key C5324 | - |
| ways the pin is set (4) | create with a template C5305 · create without C5307 · send fills null C5308 · revise copies C5309 | - |
| template read failures (3) | reader C5328 · PDF route C5329 · portal C5330 | - |
| consumers of the document (4) | PDF C5320 · staff page and preview C5334 · review page C5331 · portal use case C5330 | - |
| name rules (3) | duplicate among non-archived C5304 · same template's new version C5304 · archived name reused C5304 | - |
| redirect and error cases of the routes (6) | signed out C5354 · estimator on new C5354 · viewer on new C5354 · estimator on edit C5354 · viewer on edit C5354 · bad or foreign id C5354 | - |
| uniqueness and keys (3) | several agreement templates per org C5311 · one contract template per org C5311 · one system template per kind C5300 | - |

- Claims naming a status code, route or response shape: C5302, C5303, C5304, C5306, C5310, C5313, C5317, C5354, C5355, C5356 - each has a proof that crosses the boundary (SQL as the role; the page tests call the page function with the container double)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`save_agreement_template`, `archive_agreement_template`, `create_agreement` with a version, `send_agreement` pin, the pin trigger, RLS) | one at the boundary (SQL as the role) **and** one at the adapter that maps its codes | the contract at the boundary; one asserted case per row of the decision table |
| Decides, not reached across a boundary (`validateAgreementTemplate`, `textToBlocks`, derived frequency, preview summary, `skippedCodes`, `buildAgreementDocument`'s intro, footer and sections) | one at its own layer | one asserted case per row of the decision table |
| Screens (templates list and preview, editor, review page sections) | one render test per region that asserts the controls, their order and their count | each member of the binding-source enumeration in C5340-C5349 |
| Instrumentation (server action pass-through after its role gate, composition wiring, PDF drawing of rendered lists) | one proof each at the consumer | the validated body reaches the store; a read failure reaches the response |

Evidence:

- `save_agreement_template`: role, kind, body shape, size, name uniqueness, new or existing: 7 branch points -> decides
- `validateAgreementTemplate`: 12 rules -> decides
- `create_agreement`: version ownership, kind, preset lines, type match, term, plan limit: 6 new branch points -> decides
- `templates-view`: 4 roles, empty, error, selection -> decides
- closest analogues in the repo: `contract_templates` (tables, pin, render, 26 checks) and `plan_limits` (RPC, adapter, use case, view, 31 checks), proven at the same levels

Cost: about 30 proofs at their own layer across about 26 files. Without these rows the role matrix, the 12 validation rules and the screen arrangement would be proven only by a page that happens to render.

## Swept

- validation: C5303, C5324 (body shape and limits, both sides), C5304 (names)
- failure modes: C5328, C5329, C5330 (the pinned version cannot be read), C5346 (the list cannot be read), C5350 (invalid input kept)
- idempotency: C5312 (a second archive changes nothing); C5308 (a send on a pinned draft changes nothing)
- authorization: C5302, C5313, C5344, C5354
- concurrency: n/a - a template version is immutable and numbered inside one definer call; two owners saving at once get two versions (the unique `(template_id, version_no)` decides), and a name clash is `23505` (C5304); `create_agreement` already serialises per org
- data lifecycle: C5312 (archive keeps versions), C5309 (revise copies the pin), C5310 (a sent pin is frozen), C5307 (existing agreements keep a null pin)
- dependency failure: C5328, C5329, C5330, C5346
- state transitions: C5308, C5309, C5310 (the pin across draft, sent, revised)
- observability: n/a - no logging requirement; a failed read is logged by the existing route and adapter paths

## Out of scope

Same as the plan's `Out of scope`: a per-asset plus base fee pricing model, moving or hiding the price table, terms or signatures, starter templates per trade and province, upload of an existing proposal, contract template editing, sharing templates between orgs, restoring an archived template, a live PDF preview in the editor.

## Handoff

- S1 = ~35k (migration, the SQL recipe, ports and the agreement store), S2 = ~38k (document builder, PDF, portal read path, reader), S3 = ~45k (nine new components and pages, actions, adapters, navigation, composition). About 118k to write plus about 190k of existing files to read (about 760 KB: `ports/index.ts` 60 KB, `infrastructure/supabase/agreements.ts` 26 KB, `portal.ts`, `document.ts`, `agreement-pdf.tsx`, the agreement and portal tests, the shell and the New agreement files), so about 300k in one context against the 150k budget. Over budget.
- Proposed cut at the surface boundary already written: **batch 1 = S1 + S2** (database and documents, C5300-C5334, about 75k: everything a user cannot see), **batch 2 = S3** (screens, actions and adapters, C5340-C5359, about 55k). Batch 2 starts from batch 1's diff and the `agreement_templates` recipe.
- Mechanism: handoff (the owner's recommendation accepted on 2026-11-12: "APPROVE, go with recommendation")

- **Boundary (batch 1):** C5300-C5318 closed at `a89725f` (migration, recipe `agreement_templates`, runner counts 37 to 38 recipes and 39 to 40 files); C5320-C5334 closed at `3b728f0` (domain, PDF, reader, portal, review page); migration not applied. Batch 2 starts at C5340 from this diff.
- **Settled mid-build (batch 1):** (1) The pin is set by `send_agreement` before the transition, and "sent" for the pin trigger means "not the latest version of a draft agreement" (plan Landing doors 5 and 6). (2) The SQL body check limits `preset.termMonths` to 1-60 (`agreement_versions.term_months`), while C5324 says TS accepts 1-120: built as written, flagged for the orchestrator. (3) `AgreementDocument.intro`, `footer` and `sections`, `AgreementDetail.template` and `PortalView.template` are optional in the types so older fixtures compile; the builders and readers always set them. (4) Where a check names a file that does not exist: C5331 is in `components/review/template.test.ts` (the review page is `components/review/review-view.tsx`), C5334 is in the PDF route test (the staff preview is that route; the agreement page itself draws no template text). (5) `domain/contract/template.ts` now imports `termMonthsLabel` from `../agreement/term` instead of the agreement index, to keep a runtime import cycle out; behaviour unchanged. (6) Not edited, because they would fail against the hosted project until the migration is applied: `agreement_builder.sql` (C708 and C751 name `create_agreement(uuid)`) and `contract_templates.sql` (C5200, C5204, C5206, C5208, C5210 count or select system versions without a kind); both pass with the edits listed in the batch 1 report when the migration is replayed.
- **Abandoned (batch 1):** returning a dedicated `private` view for the preset copy (a definer would bypass the caller's RLS; the helper is an invoker); backfilling a pin on existing sent versions (null is read as the system version 1).
- **Settled by the orchestrator after batch 1:** C5324's term bound was written 1 to 120 and is 1 to 60, because `agreement_versions.term_months` is `check between 1 and 60` and `MAX_TERM_MONTHS` is 60 (a preset above that could pass the app and fail on save). The check text, the constant `MAX_PRESET_TERM_MONTHS` and the C5324 test boundaries were changed together (60 accepted, 61 rejected); no other assertion moved. Two stale existing assertions are to be edited **when the owner applies the migration** and not before (they pass against the hosted project today): `supabase/tests/agreement_builder.sql` C708 and C751 name `create_agreement(uuid)` and become `(uuid, uuid)`; `supabase/tests/contract_templates.sql` C5200, C5204, C5206 and C5208 must scope their system-template queries to the contract template (`00000000-0000-4000-8000-00000000c001`) now that a system agreement template exists.
