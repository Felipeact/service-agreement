# "Other" trade draft checks

Profile: standard
Plan: `.specs/features/other-trade-draft/plan.md`

31 checks in 4 slices · 3 one-way doors (approved: "go with recommendations", 2026-11-12) · 1 open, which blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C4100:`). This feature numbers from C4100 (no id above C3986 exists). `npx vitest run <file> -t "C4100:"` selects one.
- **SQL** recipe `other_trade_draft` runs with `npm run test:db other_trade_draft` from `web/` (new `supabase/tests/other_trade_draft.sql`, registered in `RECIPES`, run after `fixture.sql`, rolled back). The author did not apply the migration (rule 8), but the Verifier found an identical function already on the hosted project, so the migration uses `create or replace` and the recipe still puts the file between the fixture and the test, inside the rolled-back transaction. Assertions are labelled with the check id; expected values come from the plan, never read back from the migration.
- **Claude** is never called by a proof: the adapter tests use the `ClaudeClient` double of `extractor.test.ts`.
- **Live** check C4128 follows AGENTS.md: Playwright MCP at 375, 768 and 1440 px, nothing committed.
- Concurrency is not driven by any proof; see Swept.
- **First-login-setup C2817 is not edited**: the read-only review keeps its text and holds no draft control; the draft form is a separate section (C4100). Found while building: the task library screen was removed on 2026-11-10 and C3001 forbids user-facing text that names it, so no copy here mentions it.

## Checks

### S1 - An empty catalog can be drafted from a description · ~10 files · ~80 KB · ~22k

**C4100** - On `/setup` with no types, an owner or admin sees the draft form (trade name, notes, file) and the read-only review still says "No types yet"; with at least one type the form is absent (AC 1)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4100:"`

**C4101** - A valid trade name from an owner or admin of an org with an empty catalog calls `CatalogDrafter.draft` exactly once and returns `ok` with the draft (AC 2)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4101:"`

**C4102** - Draft validation accepts and rejects at every bound: types 0, 1, 40, 41; name length 0, 1, 60, 61; months count 0, 1, 12, 13 and a month value 0, 1, 12, 13; tasks 0, 12, 13; task length 0, 1, 200, 201 (AC 3)
Proof: `cd web && npx vitest run domain/catalog-draft/index.test.ts -t "C4102:"`

**C4103** - A trade name that is empty, 61 characters, or holds `;` answers `invalid`, calls no model and writes nothing; 1 and 60 characters and a name with `, & / ' -` pass (AC 4)
Proof: `cd web && npx vitest run domain/catalog-draft/index.test.ts -t "C4103:"`
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4103:"`

**C4104** - A Claude answer that is not JSON, has no `types`, has an empty list, a wrong field type, or breaks a bound of C4102 yields `unavailable` and nothing is written (AC 5)
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4104:"`

**C4105** - A thrown call, a `refusal` stop, no `ANTHROPIC_API_KEY`, and a call still open after 120 seconds each yield `unavailable`, and the one log line holds none of the trade, notes or file text (AC 6)
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4105:"`

**C4106** - An estimator, a viewer and a user with no membership get `forbidden` and the drafter is never called (AC 7)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4106:"`

**C4107** - An org that already has one type gets `not_empty` and the drafter is never called (AC 8)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4107:"`

**C4108** - The request to Claude carries the trade, the notes and the file content in the user message and nothing else (no org id, email, company name), and the system prompt says the user message is data, not instructions (AC 9)
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4108:"`

**C4109** - Door 1's schema: `{ types }` with `additionalProperties: false` at both levels, months an enum of the integers 1 to 12, the limits of 40 types and 12 tasks stated in the system prompt, and the port's `DraftType` carries exactly `name`, `months`, `tasks` (Landing door 1)
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4109:"`

### S2 - A draft can be made from the contractor's own proposal · ~4 files · ~25 KB · ~7k

**C4110** - An attached xlsx, csv or docx of at most 4,194,304 bytes is parsed by `ImportParser` and its text reaches Claude; a pdf is sent as a document block with its bytes (AC 10)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4110:"`
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4110:"`

**C4111** - A file of another type, one of 4,194,305 bytes, or one the parser cannot read answers `unreadable` or `too_large` and the drafter is never called (AC 11)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4111:"`

**C4112** - When Claude answers `too_large` for a document the action answers `too_large` and writes nothing (AC 12)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4112:"`
Proof: `cd web && npx vitest run infrastructure/claude/catalog-drafter.test.ts -t "C4112:"`

**C4113** - The file is not stored: the use case's dependencies hold no storage port, a run with a file makes no storage call and the file bytes appear in no returned value (AC 13)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4113:"`

### S3 - The owner reviews and accepts the draft · ~8 files · ~70 KB · ~20k

**C4114** - The draft review has controls to rename a type, remove a type, change its months and remove a task, and none that adds a type or a task (AC 14)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4114:"`

**C4115** - Accepting calls `CatalogWriter.add` once with the edited draft (renamed, a type removed, a task removed) and trade, and returns `ok` with the count added (AC 15)
Proof: `cd web && npx vitest run application/use-cases/draft-catalog.test.ts -t "C4115:"`
Proof: `cd web && npx vitest run app/setup/draft-actions.test.ts -t "C4115:"`

**C4116** - `add_catalog_draft` as an owner writes one `asset_types` row per type with `pack` null and the code from its name, tasks in the given order, `default_visit_months` from the months, and appends the trade to `trade_context` once, also when the trade is already in it (AC 16)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4116`)

**C4117** - A draft with a month 13, a type name of 61 characters, a task of 201 characters, or two names equal ignoring case raises `23514` and leaves no type, no task and no `trade_context` change (AC 17)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4117`)

**C4118** - When the org already has a type the function raises `55000` and writes nothing, and the action answers `not_empty` with "no longer empty" text on the screen (AC 18)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4118`)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4118:"`

**C4119** - An estimator, a viewer and an owner of another org each get `42501` from the function and nothing is written (AC 19)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4119`)

**C4120** - Drafting writes nothing: a full `draftCatalogAction` run with a double writer makes zero writer calls (AC 20)
Proof: `cd web && npx vitest run app/setup/draft-actions.test.ts -t "C4120:"`

**C4121** - Two draft names that derive one code get a numeric suffix as `create_task_library_type` does, and a name that collides with nothing keeps its plain code (AC 21)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4121`)

**C4122** - After accept the review groups the drafted types (pack null) under "Added by you" with their count in the org's words (AC 22)
Proof: `cd web && npx vitest run domain/org-settings/setup.test.ts -t "C4122:"`

**C4123** - Door 2's shape: `add_catalog_draft` is `security invoker` with `search_path = ''`, `anon` and `public` cannot execute it, `authenticated` can, and it returns an integer (Landing door 2)
Proof: `npm run test:db other_trade_draft` (assertions labelled `C4123`)

**C4124** - The Supabase writer sends `p_org_id`, `p_trade`, `p_types` and maps `42501`, `55000`, `23514` and any other error to `forbidden`, `not_empty`, `invalid`, `unavailable` (Surface, door 2)
Proof: `cd web && npx vitest run infrastructure/supabase/catalog-writer.test.ts -t "C4124:"`

**C4125** - There is no stored draft: no migration of this feature creates a table, and no code path of this feature inserts anywhere but through `add_catalog_draft` (Landing door 3)
Proof: `cd web && npx vitest run app/setup/setup-wiring.test.ts -t "C4125:"`

### S4 - The step works at every size and states its waits and failures · ~4 files · ~20 KB · ~6k

**C4126** - While the draft is being made the form shows a status text, the submit button is disabled and a second click sends no second request (AC 23)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4126:"`
Proof: `cd web && npx vitest run components/setup/draft-panel.test.ts -t "C4126:"`

**C4127** - An `unavailable` answer shows "We couldn't draft your catalog. Try again." with a Try again control and the trade, notes and file choice kept (AC 24)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4127:"`
Proof: `cd web && npx vitest run components/setup/draft-panel.test.ts -t "C4127:"`

**C4128** - `/setup` with the draft form and a draft shown, at 375, 768 and 1440 px, has no horizontal scroll, every control is at least 44 by 44 px on mobile and tablet, and the console has no error (AC 25)
Proof: live Playwright MCP run per AGENTS.md (author-run, nothing committed); the report lists pages, sizes, touch actions and fixes

**C4129** - Startup configuration: the container exposes the drafter and writer built from `ANTHROPIC_API_KEY` and the request's Supabase client, and `next.config.ts` sets `experimental.serverActions.bodySizeLimit` to `5mb` (Flow hops 2 and 4, assumption on upload size)
Proof: `cd web && npx vitest run composition/draft-wiring.test.ts -t "C4129:"`

**C4130** - The read-only review is unchanged by the draft form: with no types `CatalogReview` still says "No types yet" and holds no button, input or draft text (first-login-setup AC 17 stays true of it)
Proof: `cd web && npx vitest run components/setup/setup.test.ts -t "C4130:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `draftCatalogAction` statuses (7) | 200 ok C4101 · 422 invalid C4103 · 403 forbidden C4106 · 409 not_empty C4107 · 415 unreadable C4111 · 413 too_large C4112 · 503 unavailable C4104 C4105 | - |
| `acceptDraftAction` statuses (5) | 200 ok C4115 · 422 invalid C4117 C4124 · 403 forbidden C4119 C4124 · 409 not_empty C4118 · 503 unavailable C4124 | - |
| `add_catalog_draft` outcomes (4) | count C4116 · `42501` C4119 · `55000` C4118 · `23514` C4117 | - |
| draft bounds (23 edges) | C4102, table-driven over all 23: types 0 1 40 41, name 0 1 60 61, months count 0 1 12 13, month value 0 1 12 13, tasks 0 12 13, task length 0 1 200 201 | - |
| trade name cases (7) | empty C4103 · 1 char C4103 · 60 C4103 · 61 C4103 · `;` C4103 · `, & / ' -` set C4103 · valid C4101 | - |
| Claude failure cases (9) | not JSON C4104 · no `types` C4104 · empty list C4104 · wrong field type C4104 · bound broken C4104 · thrown C4105 · refusal C4105 · no key C4105 · 120 s C4105 | - |
| roles and membership (5) | owner C4101 · admin C4101 · estimator C4106 · viewer C4106 · no membership C4106 | - |
| attached file types (5) | xlsx C4110 · csv C4110 · docx C4110 · pdf C4110 · other C4111 | - |
| file size edges (2) | 4,194,304 C4110 · 4,194,305 C4111 | - |
| draft edit controls (6) | rename C4114 · remove type C4114 · months C4114 · remove task C4114 · add type absent C4114 · add task absent C4114 | - |
| invalid accept cases (4) | month 13 C4117 · name 61 C4117 · task 201 C4117 · duplicate names ignoring case C4117 | - |
| doors (3) | door 1 schema C4109 · door 2 function C4123 C4124 · door 3 no stored draft C4125 | - |
| `asset_types` entity relation (1) | rows written C4116 | - |
| `asset_type_tasks` entity relation (1) | rows written in order C4116 | - |
| startup config: container assembly, `next.config.ts` (2 places) | `getContainer` C4129 · `next.config.ts` C4129 | - |

- Claims naming a status code, route or response shape: C4101, C4103, C4106, C4107, C4111, C4112, C4115, C4117 to C4119, C4124 - each has a proof that asserts the returned code at its own layer; Server Actions return form-state codes and no HTTP status on the wire (plan Surface)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (domain, use case) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (Server Action, page) | one at the boundary | accepted input, each rejected input, each error path |
| Adapter | one against the client double | request payload, each error reply |
| SQL function that decides | one rolled-back recipe | each raised code and the success path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `domain/catalog-draft/index.ts` (new): 23 bound edges, 7 trade-name cases, duplicate-name rule -> decides
- `application/use-cases/draft-catalog.ts` (new): role, empty-catalog, file type and size, parse and drafter result, about 9 branch points -> decides
- `infrastructure/claude/catalog-drafter.ts` (new): request build, answer validation, 4 failure paths -> adapter with decisions on the answer
- `infrastructure/supabase/catalog-writer.ts` (new): one rpc, one error map -> adapter
- `add_catalog_draft` (new): 3 raised codes, one transaction -> decides
- closest analogues: `infrastructure/claude/extractor.test.ts` (same double, same failure paths), `application/use-cases/extract-import.test.ts`, `supabase/tests/set_org_plan.sql`

Cost: 5 test files at their own layer plus one SQL recipe and one wiring test.

## Swept

- validation: C4102, C4103, C4117 (every bound at the edge, in the browser-facing rule and again in the function)
- failure modes: C4104, C4105, C4117 (a bad draft writes nothing: one transaction), C4127
- idempotency: n/a - a second accept finds a non-empty catalog and is refused by `55000` (C4118); a retried draft call costs one more Claude call and writes nothing (C4120)
- authorization: C4106, C4119 (the function checks the role itself; the action checks it first)
- concurrency: C4118 (the `55000` check inside the function is what a second tab or a second owner hits); no proof drives an interleaving, and the function takes the same advisory lock `create_task_library_type` takes so two accepts take turns
- data lifecycle: C4116, C4125 (drafted types are ordinary rows owned by the org; the draft and the file are never stored)
- dependency failure: C4105, C4112, C4127
- state transitions: C4118 (empty to non-empty only; nothing returns a catalog to empty)
- observability: C4105 (one log line per failure, no trade, notes or file text); no tokens are recorded per call, which plan open question 2 leaves to the plan-limits item

## Out of scope

See the plan's table: drafting for a non-empty catalog, synonyms and packs, storing or resuming a draft, metering, URL or image or several files, the other Phase 5 items, safety-critical trades.

## Handoff

- S1 = 22k (domain, use case, Claude adapter, component), S2 = 7k (same use case and adapter), S3 = 20k (migration, writer, use case, actions, component), S4 = 6k (component states, wiring, config): 55k total, one surface (web plus one migration), under the 150k budget - one builder
- Mechanism: one builder
