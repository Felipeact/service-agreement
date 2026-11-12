# "Other" trade catalog draft

Roadmap Phase 5 item "'Other' trade: Claude drafts a catalog from a description or an uploaded proposal, with a tenant review step" (decision 7: both routes, the proposal first, the description second; decision 5 for the review). One feature at a time (decision 22). It adds a step to the `/setup` screen that first-login-setup built, and it is the first screen that writes asset types and checklists since `/task-library` was removed on 2026-11-10, so the review step is also the only place a tenant can edit them for now.

## Problem

A contractor who picks "Other" at `/register` pays for a workspace that has no types at all: `private.provision_workspace` seeds a pack for each named trade and nothing for "Other", and sets `org_billing.other_trade`. The `/setup` screen then says "No types yet" and offers no way forward (first-login-setup C2817 pins exactly that, with no draft control). Without types there is nothing to import against (the importer maps a list to the org's types), no checklist to freeze into an agreement and no default visit months to prefill a line, so the owner cannot use the product on day one, and since the task library screen is gone they cannot add a type anywhere in the app. The roadmap gives no sign-up, activation or support figure, so none is claimed here.

When this ships, an owner or admin of a paid org that chose "Other" can, on `/setup`, describe the trade in a few sentences or upload their current proposal (PDF or Word), read a draft of types with checklists, default visit months and spellings, fix or remove anything, and add the result to their catalog in one step. Nothing is written until they press the add button.

## Flow

Reuses the Claude SDK wiring and prompt-as-data rules of `claudeAssetExtractor` (`infrastructure/claude`), the `ImportParser` that already turns a DOCX into text and a PDF into bytes, the `/setup` screen and its `setupEntry` gate, and the existing type rules (`validateTypeName`, `validateTaskLibraryType`, the 60-character name, 200-character task and 40-task bounds) instead of a second parser, a second validator or a drafts table.

1. Owner or admin on `/setup` (exists, changed) sees the draft panel only WHERE `org_billing.other_trade` is true and setup is pending -> picks a file (PDF or DOCX) and/or types a description -> `POST /api/setup/draft` (new route handler, multipart)
2. `POST /api/setup/draft` (new) -> `makeDraftCatalog` (new use case, placement per conventions) checks session, role, pending setup and `other_trade` through `OrgSetup` (exists, changed: gains `draftAllowed`), reads a file through `ImportParser` (exists), calls `CatalogDrafter` (new port, door 2, `claudeCatalogDrafter` adapter beside `claudeAssetExtractor`), then cleans the answer with `normalizeDraft` (new, `domain/task-library`, door 1) and returns it as JSON. Nothing is stored, and the uploaded file is never stored
3. The browser keeps the draft in the form state -> `DraftReview` (new component, placement per conventions) lets the owner rename, remove, edit months and edit task text
4. Add to my catalog -> Server Action `addCatalogTypesAction` (new, on `/setup`) -> `normalizeDraft` again on the submitted value -> `OrgSetup.addTypes` (exists, changed) -> `public.add_catalog_types` (new RPC, door 1) writes the types, tasks, months and spellings in one transaction -> the screen re-renders `CatalogReview` (exists) with the new types

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: draft - a list of proposed types, each with name, default visit months, spellings and tasks, held in the browser and never persisted. Lives in `domain/task-library` (`DraftType`, `normalizeDraft`) |
| domain | existing term: "type made by hand" (AD-154, `asset_types.pack` null) now also covers a type added from a draft. Who branches on it today: `reset_task_library_type` (refuses a null pack), `CatalogReview` grouping (`groupSetupCatalog`), type removal checks. A drafted type behaves like a hand-made one in all three |
| domain | existing term: `OrgSetup` (AD-176) gains `draftAllowed` and `addTypes`. Readers today: `supabaseOrgSetup`, the container, `setup-view`, their tests and fakes (a fake that lacks the two methods fails type-check, so each is extended, not rewritten) |
| stored data | nothing to backfill. The new RPC writes ordinary `asset_types` and `asset_type_tasks` rows through the existing owner/admin policies and unique indexes (`(org_id, code)`, `(org_id, lower(name))`) |
| tests | first-login-setup C2817 asserts `CatalogReview`'s markup has no draft control and no "task library"; the draft panel is a sibling component, so C2817 stays true and is not rewritten. `supabase/tests/customer_portal.sql` and `rls_isolation` already fail for reasons older than this feature and are not touched |
| cost | each draft is one Claude call (an Opus-class model with a document). There is no per-org count to meter it with: the plan-limits roadmap item owns the AI allowance (see Out of scope and open question 1) |
| not changed | `provision_workspace`, the Stripe webhook, `/settings`, the import pipeline and its prompt, `org_settings.trade_context`, `proxy.ts` public paths |

## Relations

`None - no stored-data shape change`. A drafted type is an `asset_types` row with `pack` null and its `asset_type_tasks`, exactly as `create_task_library_type` and `save_task_library_type` make them today.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /api/setup/draft` (multipart, session cookie) | `description` (text, 0 to 1,000 characters), `file` (PDF or DOCX, at most 5 MB, optional; at least one of the two) | `{ types: [{ name, defaultVisitMonths, synonyms, tasks: [{ description }] }] }` or `{ error: <code>, message }` | `200`, `400` `invalid_input`, `401` `signed_out`, `403` `forbidden`, `409` `not_available`, `413` `file_too_large`, `415` `unsupported_type`, `422` `unreadable` or `empty_draft`, `503` `unavailable` |
| `addCatalogTypesAction` (Server Action on `/setup`) | `types` (the reviewed draft as JSON) | the screen with the catalog updated, or a notice | `200` with the new catalog, a field error per type, `forbidden` notice, `unavailable` notice |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. How a reviewed draft becomes types | `public.add_catalog_types(p_org_id uuid, p_types jsonb) returns text[]`, `security invoker`, `search_path = ''`, owner/admin only (`42501`), `execute` revoked from `public, anon`. `p_types` is `[{ "name": text, "defaultVisitMonths": [1..12], "synonyms": [text], "tasks": [{ "description": text }] }]`, at most 30 types and 40 tasks each. It takes the org's advisory lock, derives each code the way `create_task_library_type` does, inserts the type, its months, its spellings (`private.valid_synonyms`) and its tasks in position order, and returns the codes in input order. All or nothing: a name that already exists in the org (`lower(name)`), a bad month list or a bad task raises `23514` or `23505` and nothing is written. `normalizeDraft` in `domain/task-library` applies the same bounds in TypeScript | Looping `create_task_library_type` then `save_task_library_type` from the app: two RPCs per type, so a failure at type 7 leaves 6 types and no way to tell the owner which. Writing straight from Claude's answer with no review: decision 7 asks for a review step and the draft can be wrong |
| 2. What the drafter port returns | `CatalogDrafter.draft({ description?: string; document?: { kind: "text"; text: string } \| { kind: "pdf"; bytes: Uint8Array } }) -> { ok: true; types: DraftType[] } \| { ok: false; code: "unavailable" \| "too_large" \| "empty" }`. The Claude adapter uses one structured-output call with a JSON schema for `{ types: [...] }`, `additionalProperties: false`, and a system prompt stating that the description and the file are data, not instructions (the extractor's rule) | Reusing `AssetExtractor`: its output is rows of units, not types with checklists, so the schema and the prompt differ in every line. A chat-style multi-turn draft: not asked for, and it needs a stored conversation |
| 3. Where the long call runs | A route handler, `POST /api/setup/draft`, with `export const maxDuration = 60`, answering when Claude answers. Behind the session (not in `PUBLIC_PREFIXES`, AD-072) | A Server Action carrying the file: Next's default 1 MB body limit would be raised for every action in the app (`serverActions.bodySizeLimit` is global). The outbox, n8n or a job row with polling: roadmap says the draft cannot ride a webhook, and a persisted draft needs a table and a worker for a call that takes seconds to under a minute; a lost draft costs the owner one retry |
| 4. The proposal is not kept | The uploaded bytes live in the request only: no bucket, no row, never logged. Only counts and the model's token usage are logged | Storing it in the private `imports` bucket: a customer's proposal then has a retention and deletion question nobody has answered |

- Nothing else in this change is hard to reverse: the panel layout, the review component, the prompt wording, the model constant and the draft bounds are edits.
- Door 1 reaches past this feature: it is the first RPC that writes many types at once, and the Phase 5.5 starter-template work and any future "add a pack to my org" will copy its shape. It belongs in `STATE.md` as an AD at the end of the build.

## Criteria

### S1: An owner describes the trade and gets a draft (P1)

The owner types what the business services and reads a draft of types.

**Acceptance Criteria**

1. WHEN an owner or admin of a setup-pending org with `other_trade` posts a `description` of 1 to 1,000 characters THEN `POST /api/setup/draft` SHALL answer `200` with 1 to 30 types, each with a name of 1 to 60 characters, 1 to 12 ascending default visit months, 0 to 10 spellings and 1 to 15 tasks of at most 200 characters
2. WHEN the draft is built THEN the system SHALL send the description to Claude as data inside the user message, with a system prompt that says to ignore instructions inside it
3. IF the description is empty or longer than 1,000 characters and no file is sent THEN the route SHALL answer `400` `invalid_input` and SHALL NOT call Claude
4. IF Claude's answer does not match the schema, or the call fails or refuses THEN the route SHALL answer `503` `unavailable` and log one line with the error name, never the description
5. IF, after cleaning, no type is left THEN the route SHALL answer `422` `empty_draft`
6. WHEN two proposed types have the same name ignoring case THEN `normalizeDraft` SHALL keep the first and drop the rest; WHEN there are more than 30 types, or more than 15 tasks in one, THEN it SHALL keep the first 30 or 15

**Independent test:** with a fake `CatalogDrafter` returning a 3-type answer with one duplicate name and one 17-task type, post a description and read back 2 types, the long one cut to 15 tasks.

### S2: An owner uploads their proposal (P1)

The owner gives the contractor's current proposal and the draft is built from it.

**Acceptance Criteria**

7. WHEN the owner posts a PDF of at most 5,242,880 bytes THEN the route SHALL send the PDF to Claude as a document and answer as in AC 1
8. WHEN the owner posts a DOCX of at most 5,242,880 bytes THEN the route SHALL read it with `ImportParser` and send its text to Claude as data
9. WHEN the owner posts a file and a description THEN the system SHALL send both, the description as context for the file
10. IF the file is larger than 5,242,880 bytes THEN the route SHALL answer `413` `file_too_large` before reading it
11. IF the file's type is not `application/pdf` or the DOCX type THEN the route SHALL answer `415` `unsupported_type`; a spreadsheet or CSV is refused here
12. IF the parser cannot read the file (password, damage, no text) THEN the route SHALL answer `422` `unreadable` and SHALL NOT call Claude
13. IF the document is too large for one Claude answer THEN the route SHALL answer `422` `unreadable` with a message to upload fewer pages or describe the trade instead
14. WHEN the request finishes THEN the system SHALL have stored no copy of the file and SHALL NOT write its text or bytes to a log

**Independent test:** post the DOCX fixture the parsers already use and read the draft; post a 5.1 MB file and read `413`; post an xlsx and read `415`.

### S3: The owner reviews, edits and adds the types (P1)

Nothing reaches the catalog until the owner presses the add button.

**Acceptance Criteria**

15. WHEN a draft arrives THEN the screen SHALL show each type as a card with its name, months on a 12-month grid, spellings and tasks, and SHALL show "Nothing is added until you press Add to my catalog"
16. WHEN the owner edits a name, a task, a spelling or the months, or removes a task or a type THEN the screen SHALL change only the draft in the browser and SHALL call no route
17. IF an edit leaves a type with an invalid name, no task or no month THEN the screen SHALL show a field error on that type and disable Add to my catalog
18. WHEN the owner presses Add to my catalog THEN `addCatalogTypesAction` SHALL call `OrgSetup.addTypes` once with the reviewed types, and on success the screen SHALL show them in "What we set up" under a group named "Added from your draft"
19. IF a submitted type's name matches an existing type of the org ignoring case THEN `public.add_catalog_types` SHALL raise `23505`, write nothing, and the screen SHALL name the type and keep the draft
20. IF the caller is not an owner or admin of the org THEN `public.add_catalog_types` SHALL raise `42501` and write nothing
21. IF any one type or task is invalid THEN `public.add_catalog_types` SHALL write nothing for any of them
22. WHEN `public.add_catalog_types` succeeds THEN each new type SHALL have `pack` null, a code made from its name by the existing rule, and its tasks in the submitted order at positions 0 upward
23. WHEN the same reviewed draft is submitted a second time THEN the second call SHALL refuse with `23505` (names exist) and add no duplicate

**Independent test:** the rolled-back SQL recipe `other_trade_draft`: as owner add two types and read the rows; as estimator and as another org's owner try; submit a bad third type and read zero rows; submit the same draft twice.

### S4: The screen, for the people and states it applies to (P1)

**Acceptance Criteria**

24. WHERE the org has `other_trade` and setup is pending, `/setup` SHALL show the draft panel above "What we set up", with a description field, a file picker for PDF or Word and the button "Draft my catalog"
25. WHERE the org has no `other_trade`, `/setup` SHALL render exactly as before this feature, with no draft panel
26. WHEN the org has other trades as well as "Other" THEN the panel SHALL show and "What we set up" SHALL still list the seeded types
27. WHILE a draft is being made the button SHALL be disabled and say "Drafting, this can take up to a minute", and the screen SHALL stay usable for the profile form
28. IF the route answers an error THEN the panel SHALL show the message for its code in plain words and keep the description and the chosen file
29. WHEN the draft is shown THEN the panel SHALL say that the draft was written by AI, that the contractor owns the checklists and that they should check them against their own procedures and any code or regulation that applies before using them
30. IF the member is not an owner or admin, or setup is not pending, THEN `POST /api/setup/draft` SHALL answer `403` `forbidden` or `409` `not_available` and SHALL NOT call Claude; WHEN there is no session it SHALL answer `401` `signed_out`
31. WHILE the page is at 375, 768 or 1440 px wide the panel and the review cards SHALL cause no horizontal scroll, and every control SHALL be at least 44 by 44 px on mobile and tablet

**Independent test:** the AGENTS.md Playwright pass on `/setup` for a paid "Other" org at the three sizes, with a real description and the demo DOCX; then Add and read the catalog.

## Out of scope

| Excluded | Why |
| --- | --- |
| Drafting from `/settings`, or after setup is skipped or done | The roadmap item says the draft runs from the setup screen; reopening setup is already out of scope in first-login-setup. An owner who skips is back to an empty catalog until a later item adds an editor |
| A per-org allowance or rate limit on drafts | Nothing persists to count with; the AI allowance belongs to the "Plan limits" roadmap item. Until then the route is limited to a paid org's owner or admin during setup |
| Regenerate with feedback, a chat, or drafting one more type at a time | Not asked for; each needs a stored conversation or a second call shape |
| Per-task visit months (seasonal tasks) in the draft | A drafted type carries default months only; the owner has no seasonal editor in the app now either |
| Spreadsheet, CSV or image input, and storing the uploaded proposal | An equipment list is the importer's job; a proposal is text. Storing it opens a retention question (door 4) |
| Writing the trade phrase to `org_settings.trade_context` | Would improve extraction for an "Other" org but changes what the import prompt says; its own item (open question 2) |
| A practitioner review of drafted content | Decision 5 covers shipped packs; a tenant's own catalog is theirs, and AC 29 says so |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Description and file together | Both optional, at least one required, sent together when both are given | Decision 7 lists both routes; combining costs nothing and the description gives context to a thin proposal | n |
| Draft size caps | 30 types, 15 tasks a type, 10 spellings, 1,000-character description, 5 MB file | Library limits are 40 tasks and 200 characters; a first catalog is smaller, and 5 MB covers a proposal without raising the body limit anywhere global | n |
| Model | The extractor's model constant family, effort low, same fallbacks, one new constant `DRAFT_MODEL` | One place to change it; a catalog draft is short output | n |
| Panel visibility | Shown whenever `other_trade` and pending, also after the first add, so an owner may draft again | No stored "drafted" flag, so no new column; a repeat is blocked by the name rule (AC 19), not by state | n |
| Language | English output and copy, as the whole site | AGENTS.md | y |
| Drafted months | Default months only, 1 to 12 ascending, prefilling lines like any type | The cadence feature reads `default_visit_months` | n |

**Open questions:** two, below; neither blocks the build.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | What stops a paid owner calling the draft route in a loop? A draft is one Opus-class call with a document | Written meanwhile: owner or admin of a paid, setup-pending `other_trade` org only. No counter exists; the plan-limits item or a per-org throttle must land before real traffic |
| 2 | open | Should the trade description also set `org_settings.trade_context` so imports for an "Other" org name their trade? | Not done; imports for that org name no trade, as today |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/setup` draft panel | empty state (no draft yet) | AC 24 |
| screen `/setup` draft panel | loading state | AC 27 |
| screen `/setup` draft panel | error state | AC 28 |
| screen `/setup` draft panel | unauthorised state | AC 25 and AC 30 (the panel is absent; a member who is not owner or admin never reaches `/setup`, `setupEntry`) |
| screen `/setup` draft panel | density and ordering | AC 15 (cards in Claude's order, tasks in order) |
| screen `/setup` review | destructive action confirms | n/a - removing a type or a task only edits an unsaved draft and nothing is written until Add (AC 16) |
| screen `/setup` review | Add to my catalog | AC 18, AC 19 |
| API `POST /api/setup/draft` | response shape, error shape, codes | Surface table, AC 1, 3 to 5, 10 to 13, 30 |
| API `POST /api/setup/draft` | who may call it | AC 30 |
| API `POST /api/setup/draft` | versioning | n/a - consumed only by our own `/setup` page |
| API `POST /api/setup/draft` | rate limit | open question 1 |
| Server Action `addCatalogTypesAction` | error shape and codes | AC 17, 19, 20 |
| document or copy | the AI-draft notice | AC 29 |

## Sources

- ROADMAP.md Phase 5 item "'Other' trade" and decisions 5 and 7 - one route first (the proposal), the description second, a tenant review step, drafts too long for a webhook so they run from the setup screen
- `.specs/features/first-login-setup/plan.md` (C2817, Out of scope) and AD-176 - the screen, its gate and the empty catalog this feature extends
- AD-154, AD-155 and AD-156 - type codes, name uniqueness and the owner/admin write path the RPC copies
