# "Other" trade catalog draft checks

Profile: standard
Plan: `.specs/features/other-trade-draft/plan.md`

41 checks in 4 slices · 4 one-way doors (approved by "build") · 2 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C3400:`). This feature numbers from C3400 (the highest id used so far is C3339). `npx vitest run <file> -t "C3400:"` selects one.
- **SQL** recipe `other_trade_draft` runs with `npm run test:db other_trade_draft` from `web/` (new `supabase/tests/other_trade_draft.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the recipe, inside the rolled-back transaction, until the owner applies it). The migration is **not applied to the hosted project** without the owner's go-ahead.
- **Live** checks (C3435, C3436) follow AGENTS.md: Playwright MCP at 375, 768 and 1440 px, nothing committed. C3436 needs the migration applied and `ANTHROPIC_API_KEY`.
- Concurrency is not driven by any proof; see Swept.
- New test files: `domain/task-library/draft.test.ts`, `infrastructure/claude/drafter.test.ts`, `application/use-cases/draft-catalog.test.ts`, `app/api/setup/draft/route.test.ts`, `app/setup/add-types.test.ts`, `components/setup/draft.test.ts`, `infrastructure/supabase/setup-types.test.ts`, `composition/draft.test.ts`. No existing test is edited.

## Checks

### S1 - An owner describes the trade and gets a draft · 8 files · ~45 KB · ~12k

**C3400** - `normalizeDraft` returns only types whose name is 1 to 60 characters with a letter or digit, whose months are unique ascending integers 1 to 12 (at least one), whose spellings are lowercase, trimmed, 1 to 60 characters, unique and at most 10, and whose tasks are 1 to 15 non-empty descriptions of at most 200 characters; an invalid piece is dropped, and a type left with no valid task or month is dropped (AC 1)
Proof: `cd web && npx vitest run domain/task-library/draft.test.ts -t "C3400:"`

**C3401** - `normalizeDraft` keeps the first of two types whose names match ignoring case, keeps the first 30 of 31 types, and keeps the first 15 of 17 tasks (AC 6)
Proof: `cd web && npx vitest run domain/task-library/draft.test.ts -t "C3401:"`

**C3402** - `normalizeDraft` of an answer where every type is invalid returns an empty list (AC 5)
Proof: `cd web && npx vitest run domain/task-library/draft.test.ts -t "C3402:"`

**C3403** - The Claude drafter sends the description inside the user message as data, a system prompt that says to ignore instructions inside the description and the document, model `DRAFT_MODEL`, and an output schema with `additionalProperties: false` on every object (AC 2)
Proof: `cd web && npx vitest run infrastructure/claude/drafter.test.ts -t "C3403:"`

**C3404** - The Claude drafter answers `{ ok: false, code: "unavailable" }` when the API key is missing (no request sent), the call throws, the stop reason is `refusal`, or the answer is not JSON or does not match the schema, and `"too_large"` for a document whose answer stops at `max_tokens`; the one line it logs contains neither the description nor the document text (AC 4, AC 13)
Proof: `cd web && npx vitest run infrastructure/claude/drafter.test.ts -t "C3404:"`

**C3405** - `POST /api/setup/draft` with no file answers `400` `invalid_input` and never calls Claude for a description that is missing, empty or whitespace, and for one of 1,001 characters; it accepts 1 and 1,000 characters (AC 3)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3405:"`

**C3406** - `POST /api/setup/draft` by an owner and by an admin of a pending `other_trade` org with a valid description answers `200` with `{ types }` holding the cleaned draft (AC 1)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3406:"`

**C3407** - `POST /api/setup/draft` answers `503` `unavailable` when the drafter answers `unavailable`, and `422` `empty_draft` when the cleaned draft has no type (AC 4, AC 5)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3407:"`

### S2 - An owner uploads their proposal · 4 files · ~25 KB · ~7k

**C3408** - A PDF of exactly 5,242,880 bytes is passed to the drafter as `{ kind: "pdf", bytes }` and the route answers `200` (AC 7)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3408:"`

**C3409** - A DOCX read by the real `importParser` (fixture `text-only.docx`) reaches the drafter as `{ kind: "text", text }` holding the document's text, and the route answers `200` (AC 8)
Proof: `cd web && npx vitest run infrastructure/import-parsers/draft-catalog.test.ts -t "C3409:"`

**C3410** - A request with a file and a description passes both to the drafter, and a file alone or a description alone passes only that one (AC 9)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C3410:"`

**C3411** - A file of 5,242,881 bytes answers `413` `file_too_large` before the parser or Claude is called (AC 10)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3411:"`

**C3412** - A file of type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`, `image/png` or `text/plain` answers `415` `unsupported_type` and neither the parser nor Claude is called (AC 11)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3412:"`

**C3413** - A PDF or DOCX the parser refuses (`corrupt`, `password_protected`, a DOCX with no text) answers `422` `unreadable` and Claude is not called (AC 12)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C3413:"`

**C3414** - A drafter answer `too_large` becomes `422` `unreadable` with a message that tells the owner to upload fewer pages or describe the trade (AC 13)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3414:"`

**C3415** - After a request that carried a file, nothing was stored (the use case holds no storage port and the container passes it none) and no `console` call received the description, the file's text or its bytes; a successful draft logs one line with the type count and the token usage (AC 14)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C3415:"`

### S3 - The owner reviews, edits and adds the types · 10 files · ~60 KB · ~18k

**C3416** - The review shows each drafted type as a card with its name, a 12-month grid with its months marked, its spellings and its tasks in order, and the text "Nothing is added until you press Add to my catalog" (AC 15)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3416:"`

**C3417** - The draft reducer changes only the draft for each of: rename a type, edit a task, edit a spelling, toggle a month, remove a task, remove a type; none calls `fetch` or the action (AC 16)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3417:"`

**C3418** - A type with an invalid name, no task or no month shows a field error on that type and the Add to my catalog button is disabled; with every type valid it is enabled (AC 17)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3418:"`

**C3419** - `addCatalogTypesAction` for an owner calls `OrgSetup.addTypes` once with the org id and the reviewed types after `normalizeDraft`, and on success returns the new catalog; the catalog shows a type with no pack under the group "Added from your draft" (AC 18)
Proof: `cd web && npx vitest run app/setup/add-types.test.ts -t "C3419:"`

**C3420** - `public.add_catalog_types` with a name equal to an existing type of the org ignoring case (including a case difference and a duplicate inside the submitted list) raises `23505` and leaves the org's type count unchanged (AC 19)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3420`)

**C3421** - `public.add_catalog_types` raises `42501` and writes nothing for an estimator, a viewer, the owner of another org and `anon` (AC 20)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3421`)

**C3422** - `public.add_catalog_types` writes nothing for any of the types, and raises `23514`, when one type has a month list that is not ascending 1 to 12, a task over 200 characters, no task, a bad spelling or an empty name, when the list holds 31 types, and when a type holds 41 tasks (AC 21)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3422`)

**C3423** - `public.add_catalog_types` for an owner and for an admin of a pending org creates each type with `pack` null, the code the name rule makes (`create_task_library_type`'s rule: upper-case, runs outside A-Z0-9 as `_`), its `default_visit_months`, its spellings and its tasks at positions 0 upward in submitted order, returns the codes in input order, and leaves `setup_completed_at` null (AC 22)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3423`)

**C3424** - Submitting the same list twice raises `23505` the second time and the org holds one row per name (AC 23)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3424`)

**C3425** - `addCatalogTypesAction` returns a notice and keeps the draft for each of: `forbidden` ("You don't have permission to change this."), `duplicate` (names the type whose name exists), `invalid` and `unavailable`; a member who is not an owner or admin never reaches the store (AC 19, AC 20)
Proof: `cd web && npx vitest run app/setup/add-types.test.ts -t "C3425:"`

**C3426** - The Supabase adapter `addTypes` calls `add_catalog_types` with `p_org_id` and the camel-cased JSON shape of door 1, and maps `42501` to `forbidden`, `23505` to `duplicate` with the offending name when the error names it, `23514` to `invalid`, and any other error to `unavailable` (AC 19, AC 20, AC 21)
Proof: `cd web && npx vitest run infrastructure/supabase/setup-types.test.ts -t "C3426:"`

### S4 - The screen, for the people and states it applies to · 9 files · ~55 KB · ~16k

**C3427** - The adapter's `draftAllowed(orgId)` is true only when setup is pending and `org_billing.other_trade` is true; false when setup is done, when `other_trade` is false and when the org has no `org_billing` row; it throws on a database error (AC 24, AC 25, AC 30)
Proof: `cd web && npx vitest run infrastructure/supabase/setup-types.test.ts -t "C3427:"`

**C3428** - `/setup` for a pending `other_trade` org renders the draft panel above "What we set up", with a description field, a file input accepting PDF and Word, and the button "Draft my catalog" (AC 24)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3428:"`

**C3429** - `/setup` for an org without `other_trade` renders no "Draft my catalog" and a "What we set up" section identical to the one `CatalogReview` renders today (AC 25)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3429:"`

**C3430** - `/setup` for an org with `other_trade` and seeded types renders both the panel and the seeded types in "What we set up" (AC 26)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3430:"`

**C3431** - While a draft request is pending the button is disabled and reads "Drafting, this can take up to a minute", and the profile form's Save and Skip stay enabled (AC 27)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3431:"`

**C3432** - For each error code (`invalid_input`, `file_too_large`, `unsupported_type`, `unreadable`, `empty_draft`, `unavailable`, `forbidden`, `not_available`, `signed_out`) the panel shows its own plain-words message and keeps the description and the chosen file name (AC 28)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3432:"`

**C3433** - When a draft is shown the panel says that it was written by AI, that the contractor owns the checklists and that they should check them against their own procedures and any code or regulation that applies (AC 29)
Proof: `cd web && npx vitest run components/setup/draft.test.ts -t "C3433:"`

**C3434** - `POST /api/setup/draft` answers `401` `signed_out` with no session, `403` `forbidden` for an estimator, a viewer and a user with no membership, and `409` `not_available` for an owner whose setup is done and for an owner whose org has no `other_trade`; Claude is called in none of them (AC 30)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3434:"`

**C3435** - Live, at 375, 768 and 1440 px on `/setup` for a paid "Other" org: no horizontal scroll, controls at least 44 by 44 px on 375 and 768, the panel and the review cards readable, console with no errors (AC 31)
Proof: AGENTS.md Playwright pass by the author, reported in `verification.md` as a self-report (a Verifier cannot observe it)

**C3436** - Live, with the migration applied and `ANTHROPIC_API_KEY` set: a real description of a trade produces a draft with at least one type, which after Add to my catalog appears under "Added from your draft" (AC 1, AC 18)
Proof: author-run through Playwright on `/setup`, reported as a self-report

**C3437** - `maxDuration` of the draft route is at least 60, and `proxy.ts` treats `/api/setup/draft` as a protected path (not in the public paths) (door 3)
Proof: `cd web && npx vitest run app/api/setup/draft/route.test.ts -t "C3437:"`

**C3438** - The container exposes `draftCatalog` built over `claudeCatalogDrafter({ apiKey: process.env.ANTHROPIC_API_KEY })` and the same `importParser` as the importer, and with no key set a draft request answers `503` (door 2)
Proof: `cd web && npx vitest run composition/draft.test.ts -t "C3438:"`

**C3439** - The `CatalogDrafter` result type admits exactly `ok: true` with `types`, and `ok: false` with `unavailable`, `too_large` or `empty` (door 2)
Proof: `cd web && npx vitest run infrastructure/claude/drafter.test.ts -t "C3439:"`

**C3440** - `private.seed_org_catalog` and the existing type functions are unchanged: `reset_task_library_type` refuses a drafted type (pack null) as it does any hand-made one (Impact, AD-154)
Proof: `cd web && npm run test:db other_trade_draft` (assertions labelled `C3440`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/setup/draft` statuses (9) | 200 C3406, C3408 · 400 C3405 · 401 C3434 · 403 C3434 · 409 C3434 · 413 C3411 · 415 C3412 · 422 C3407, C3413, C3414 · 503 C3407 | - |
| `addCatalogTypesAction` outcomes (5) | success C3419 · forbidden C3425 · duplicate C3425 · invalid C3425 · unavailable C3425 | - |
| description length edges (4) | 0 C3405 · 1 C3405 · 1000 C3405 · 1001 C3405 | - |
| file size edges (2) | 5242880 C3408 · 5242881 C3411 | - |
| accepted file types (2) | pdf C3408 · docx C3409 | - |
| refused file types (4) | xlsx C3412 · csv C3412 · png C3412 · plain text C3412 | - |
| parser refusals (3) | corrupt C3413 · password protected C3413 · docx with no text C3413 | - |
| drafter outcomes (5) | ok C3406 · unavailable C3404, C3407 · too_large C3404, C3414 · empty C3402, C3407 · unreadable file never reaches it C3413 | - |
| drafter failure modes (5) | no key C3404 · throw C3404 · refusal C3404 · bad JSON or schema C3404 · `max_tokens` C3404 | - |
| `normalizeDraft` rules (8) | name bounds C3400 · months C3400 · spellings C3400 · task bounds C3400 · drop empty type C3400 · duplicate names C3401 · 30 types C3401 · 15 tasks C3401 | - |
| callers refused by `add_catalog_types` (4) | estimator C3421 · viewer C3421 · other org's owner C3421 · anon C3421 | - |
| callers allowed by `add_catalog_types` (2) | owner C3423 · admin C3423 | - |
| invalid submissions to `add_catalog_types` (8) | months C3422 · task over 200 C3422 · no task C3422 · bad spelling C3422 · empty name C3422 · 31 types C3422 · 41 tasks C3422 · duplicate name C3420 | - |
| adapter error mappings (4) | `42501` C3426 · `23505` C3426 · `23514` C3426 · other C3426 | - |
| `draftAllowed` cases (4) | pending and other_trade C3427 · setup done C3427 · no other_trade C3427 · no billing row C3427 | - |
| roles for `POST /api/setup/draft` (5) | owner C3406 · admin C3406 · estimator C3434 · viewer C3434 · no membership C3434 | - |
| panel states (6) | no draft C3428 · drafting C3431 · error C3432 · draft shown C3416 · absent C3429 · with seeded types C3430 | - |
| error codes with a message (9) | each of `invalid_input`, `file_too_large`, `unsupported_type`, `unreadable`, `empty_draft`, `unavailable`, `forbidden`, `not_available`, `signed_out` C3432 (table-driven over all 9) | - |
| review edit operations (6) | rename C3417 · edit task C3417 · edit spelling C3417 · toggle month C3417 · remove task C3417 · remove type C3417 | - |
| doors (4) | 1 C3420 to C3424, C3426 · 2 C3438, C3439 · 3 C3437 · 4 C3415 | - |
| startup config: `ANTHROPIC_API_KEY` for the drafter (1 assembly) | the container in `composition` C3438 (the route reads the drafter only through it) | - |

- Claims naming a status code, route or response shape: C3405 to C3408, C3411, C3412, C3414, C3434 - each has a proof that crosses the boundary (the route handler is called with a real `Request`)
- C3416 to C3418 and C3428 to C3433 assert rendered markup and a pure reducer; the interactive wiring of the file input and `fetch` is proven by C3435 and C3436 live
- No other check claims more than the single case its proof exercises

## Test policy

Omitted. The repo already answers both questions for these layers: the closest analogues (first-login-setup, tenant-logo, synonyms-as-data) prove decisions in domain files at their own layer with one asserted case per row, the route at its boundary with a real `Request`, and SQL at the recipe; no new rows are proposed.

## Swept

- validation: C3400, C3405, C3411, C3412, C3422
- failure modes: C3404, C3407, C3413, C3414, C3422
- idempotency: C3424 (a second submit of the same draft adds nothing); the draft route keeps no state, so a retry is a fresh call
- authorization: C3421, C3434, existing - the `asset_types` and `asset_type_tasks` owner/admin write policies still decide who may write
- concurrency: n/a - two simultaneous adds of the same names are serialised by the org's advisory lock and the `(org_id, lower(name))` unique index, which C3420 and C3424 observe only sequentially; no proof drives two sessions
- data lifecycle: n/a - the draft is never persisted and the uploaded file is never stored (C3415); a drafted type is an ordinary row with no new retention rule
- dependency failure: C3404, C3407, C3414, C3438 (a missing key or a Claude outage answers `503`, never a partial write)
- state transitions: C3423 (adding types does not stamp `setup_completed_at`); no status exists here
- observability: C3404 (one line on failure, no content), C3415 (one line with counts and token usage on success)

## Out of scope

None beyond the plan's `Out of scope`.

## Handoff

- Files: S1 about 8 files, 45 KB = 12k; S2 about 4 files, 25 KB = 7k; S3 about 10 files, 60 KB = 18k (the migration, the recipe, the port, the adapter, the action, the review component); S4 about 9 files, 55 KB = 16k. Reading cost of the files touched: `application/ports/index.ts` 58 KB, `composition/index.ts` 19 KB, `claude/index.ts` 7 KB, `setup-view.tsx` 7 KB, setup action, page and adapter 8 KB = 99 KB = 25k. Total 12k + 7k + 18k + 16k + 25k = 78k, under the 150k budget - one builder
- Mechanism: one builder
- **Boundary:** C3400-C3440 built; all vitest and SQL proofs green at the last feature commit. C3435 and C3436 not run (see below)
- **Settled mid-build:** (1) C3409's proof moved from `application/use-cases/draft-catalog.test.ts` to `infrastructure/import-parsers/draft-catalog.test.ts`, because the application layer may not import the parser adapter (eslint `no-restricted-imports`); the claim is unchanged, and C3410 and C3413 use a fake parser in the application test, with a real-parser C3413 beside C3409. (2) C3419's "group Added from your draft" holds for the types added in this visit only: an existing first-login-setup test pins "Added by you" for every pack-less type, so `CatalogReview` takes an `added` list and `groupSetupCatalog` is untouched; the action answers the added names, not the whole catalog. (3) Existing test doubles were extended, no assertion changed: `app/setup/page.test.ts` gained `catalogDraftAllowed`, and `scripts/test-db/runner.test.ts` counts moved from 32 to 33 recipes and 34 to 35 files. (4) Constants named `MAX_DRAFT_SPELLINGS` and `MAX_SPELLING_LENGTH`, because an existing scan (C2108) forbids the word SYNONYMS in new source
- **Abandoned:** the live Playwright pass (C3435): the worktree's Tailwind build produced no utility classes (also from a copy outside the ignored folder), so measurements were meaningless; a temporary preview page was deleted. C3436 needs the migration applied
