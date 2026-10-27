# Service included: generate what each agreement covers from the equipment on its site, and freeze it when the agreement leaves draft - checks

Profile: standard
Plan: `.specs/features/service-included/plan.md`

32 checks in 4 slices plus doors and delivery · 5 one-way doors · 0 open

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C801:`).
  This feature numbers from C801, because agreement-builder owns up to `C757:`. Proofs name the
  folder their test file sits in; the file inside it is the builder's call.
  - The scope parser is pure domain code in `domain/agreement`, tested with literal documents.
  - The reader is tested in `infrastructure/supabase` with the recording `stubClient`
    (`stub-client.ts`), whose `rpc` is a `vi.fn()`.
  - The agreement view is asserted with `renderToStaticMarkup`, as `components/agreements` does.
- **test:db** - `npm run test:db service_included` in `web/` (AD-026) runs `fixture.sql` and then
  the new `supabase/tests/service_included.sql`, rolled back. The file joins `RECIPES` as
  `plain("service_included")` and passes only when its last row is `service_included: pass`. Each
  assertion is labelled with its check id. Fixture: org A owner `uA`, estimator `uE`, viewer `uV`;
  org B owner `uB`; `siteA` with type `typeA` (`RTU`, "Rooftop unit", task "Replace filters") and
  asset `RTU-1`; `agrA` (`draft`, versions 1 and 2); the same for org B. The test file inserts
  further sites, types, tasks, assets and agreements as the table owner (`auth.uid()` null).
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, with the result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context
  as the demo owner (memory: one context only). Not committed (AGENTS..md).

Terms:

- "the scope function" is `public.site_service_scope`.
- "the freeze function" is `private.freeze_agreement_version`.
- "the transition RPC" is `public.apply_agreement_transition`.
- "the parser" is `parseServiceScope` in `domain/agreement`.
- "the reader" is `AgreementReader`'s adapter.
- "the view" is the agreement view component the page renders.
- "writer view" and "viewer view" are the view rendered with role `estimator` and with role `viewer`.
- **Render order** is types by name, then units compared as numbers, with no unit last. It uses `localeCompare(…, "en", { numeric: true, sensitivity: "base" })`, the comparison `groupAssets` uses.
- **The date format** is the `Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" })` that the view's versions list already uses. Expected text is computed with that formatter in the test, never typed out.

## Checks

### S1 - A draft shows what it covers, live from the site · ~8 files · ~30k

**C801** - The scope function, called by `uE` on a site that holds `RTU-2` and `RTU-10` (type `RTU`) and `B-1` (type `BOILER`, with no tasks), returns exactly the following. `RTU` has tasks at positions 2 and 1. One `RTU` asset has a null `type_model` and `location`.
- top-level keys `schema` and `types`, with `schema` = `1`
- no `takenAt` key
- exactly 2 entries in `types`, each with keys `code`, `name`, `tasks` and `assets`
- `RTU` `tasks` equal to its two descriptions in position order
- `BOILER` `tasks` = `[]`
- each asset an object with keys `unitNo`, `typeModel` and `location`, nulls kept as JSON `null`
- 2 `RTU` assets and 1 `BOILER` asset
(AC 1, AC 2, AC 4, door 1, door 2)
Proof: `npm run test:db service_included` (assertions `C801`)

**C802** - The scope function excludes every row that is not on the site. Called by `uE` on `siteA`, it returns no type that has assets only on another site of org A, and no type of org A that has no asset on `siteA`. Called by `uE` on `siteB` (org B), it returns exactly `{"schema": 1, "types": []}` and raises no error (AC 6, door 2)
Proof: `npm run test:db service_included` (assertions `C802`)

**C803** - The parser, given a valid document whose types and assets are out of order, returns types and assets in **render order**. The types are `"Unit heater (gas)"`, `"AHU"` and `"boiler"`. The units are `RTU-10`, `RTU-2`, null and `rtu-1`. The result is `AHU`, `boiler`, `Unit heater (gas)`, and `rtu-1`, `RTU-2`, `RTU-10`, null, with tasks in stored order. The parser returns `null` for each of these 7 inputs, table-driven:
1. `{}`
2. `{"schema": 2, "types": []}`
3. `{"schema": 1}`
4. `types` not an array
5. a type with no `name`
6. a task that is not a string
7. an asset that is not an object
(AC 1, AC 2, AC 11, door 1)
Proof: `npx vitest run domain/agreement -t "C803:"`

**C804** - The reader picks the scope source. The table runs over these 6 cases:

| Case | Expected |
| --- | --- |
| draft, current version shown | calls `rpc("site_service_scope", { p_site_id: <site id> })` once; returns `{ source: "live", takenAt: null, types }` |
| draft, version 1 of 2 shown | makes no `site_service_scope` call; returns `source: "frozen"` from version 1's `snapshot`, with `takenAt` a `Date` equal to the document's `takenAt` |
| `sent`, current version shown | frozen, as in the previous row |
| frozen version whose snapshot is `{}` | `{ source: "not_recorded" }` and no `console.error` |
| frozen version with a malformed snapshot (`{"schema": 1, "types": 3}`) | `{ source: "not_recorded" }` and exactly one `console.error` |
| the rpc answers an error | `get` rejects |

(AC 3, AC 9, AC 10, AC 11, door 4)
Proof: `npx vitest run infrastructure/supabase -t "C804:"`

**C805** - The view, given a live scope with `RTU` "Rooftop unit" (2 assets, tasks "Replace filters" then "Check belts") and `BOILER` "Boiler" (1 asset), renders:
- a section labelled `Service included` containing `Boiler, 1 unit` before `Rooftop unit, 2 units`, with the `RTU` tasks as list items in that order
- a section labelled `Equipment` with one `<details>` per type, headed by a `<summary>` reading `Boiler · 1` and `Rooftop unit · 2`
- no `open` attribute on any `<details>`
- each asset's unit #, type/model and location, with `—` for a null field
- no `<details>` inside `Service included`

(AC 1, AC 2, AC 16)
Proof: `npx vitest run components/agreements -t "C805:"`

**C806** - The view, given a live scope where `BOILER` has `tasks: []`, renders `Boiler, 1 unit` followed by `No checklist for this type yet.` in `Service included` (AC 4)
Proof: `npx vitest run components/agreements -t "C806:"`

**C807** - The view, given a live scope with `types: []`, renders `No equipment on this site yet.` in both sections. In the writer view it adds a link with text `Add equipment` and `href` exactly `/sites/<siteId>`. In the viewer view it renders no `Add equipment` (AC 5, AC 18)
Proof: `npx vitest run components/agreements -t "C807:"`

**C808** - The scope function reflects the site on every call. On a site of org A, after `uE` inserts an asset of a new type `CHILLER` with task "Check oil", the next call includes `CHILLER` with `["Check oil"]`. After a task of `RTU` is updated, the next call shows the new text. After the `CHILLER` asset is deleted, the next call has no `CHILLER` (AC 3, door 2)
Proof: `npm run test:db service_included` (assertions `C808`)

**C809** - Under `web/`, the string `site_service_scope` appears in application code (not tests, not `database.types.ts`) only in the reader's adapter file, and `snapshot` is read only there (AC 6)
Proof: shell `grep -rln "site_service_scope" --include=*.ts --include=*.tsx app components lib application domain infrastructure composition | grep -v "\.test\.\|database\.types" | wc -l` prints `1`
Proof: shell `grep -rln "snapshot" --include=*.ts --include=*.tsx app components lib application composition infrastructure | grep -v "\.test\.\|database\.types" | wc -l` prints `1`

### S2 - Leaving draft freezes the scope into the version · ~6 files · ~25k

**C810** - The transition RPC, called by `uE` to move a `draft` agreement with versions 1 and 2 to `sent` (`agreement.sent`), leaves the following. Its site holds `RTU-1` and `B-1`.
- version 2's `snapshot` minus `takenAt` equals the scope function's result for the site
- `takenAt` cast to `timestamptz` equals `now()` in the same transaction
- version 1's `snapshot` is still `{}`
- the event row exists
(AC 7, door 3)
Proof: `npm run test:db service_included` (assertions `C810`)

**C811** - The transition RPC, called by `uE` to move a `draft` agreement to `withdrawn` (`agreement.withdrawn`), writes the site's scope with `takenAt` into its highest version, exactly as C810 does (AC 7, door 3)
Proof: `npm run test:db service_included` (assertions `C811`)

**C812** - The transition RPC writes no new scope on any transition whose expected status is not `draft`. This is table-driven over 6 transitions, each starting from a highest version whose snapshot is the literal `{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}`:
- 5 transitions from `sent`: `accepted`, `refused`, `changes_requested`, `expired` and `withdrawn`. Each leaves that snapshot byte-for-byte equal.
- `changes_requested` -> `draft` (`agreement.revised`). Version n's snapshot stays unchanged, and version n + 1's snapshot equals version n's literal, the existing copy.

(AC 7, AC 10, door 3)
Proof: `npm run test:db service_included` (assertions `C812`)

**C813** - A refused transition writes no snapshot. Each of these 3 calls leaves the highest version's `snapshot` = `{}`:
- `40001`: expected `draft` on an agreement now `sent`, called by `uE`
- `42501`: called by `uV`
- `P0002`: a missing agreement id, which reaches no version at all

(AC 8)
Proof: `npm run test:db service_included` (assertions `C813`)

**C814** - After C810's freeze, the sent version's `snapshot` stays byte-for-byte unchanged when the table owner inserts an asset on the site, updates an `RTU` task's description, or deletes `B-1` (AC 9)
Proof: `npm run test:db service_included` (assertions `C814`)

**C815** - The view, given a frozen scope with `takenAt` `2026-10-27T18:00:00Z` and one type, renders the types and assets as C805 does. Both sections show `As recorded on ` followed by **the date format** of that instant. In the writer view it renders no `Add equipment` (AC 9)
Proof: `npx vitest run components/agreements -t "C815:"`

**C816** - The view, given `{ source: "not_recorded" }`, renders `Not recorded for this version.` in both sections. It renders no `As recorded on` and no `Add equipment` (AC 11)
Proof: `npx vitest run components/agreements -t "C816:"`

**C817** - Members cannot update `agreement_versions`:
- `update public.agreement_versions set snapshot = '{}'` raises `42501` as `uE`, as `uA` and as `uV`, on a version of their own org
- `has_table_privilege('authenticated', 'public.agreement_versions', 'update')` is false
- `has_table_privilege('authenticated', 'public.agreement_versions', 'insert')` is true

(AC 12, door 3)
Proof: `npm run test:db service_included` (assertions `C817`)

**C818** - The view, given a frozen scope with `types: []`, renders `No equipment was recorded for this version.` in both sections, and no `Add equipment` in the writer view (AC 13)
Proof: `npx vitest run components/agreements -t "C818:"`

**C819** - The freeze function is a security definer, and its `proconfig` contains `search_path=""`. `anon` cannot execute it. Called directly as `uV` on an org A agreement, it raises `42501` and writes nothing. Its only caller in `supabase/migrations/*_service_included.sql` is the transition RPC (door 3).
Proof: `npm run test:db service_included` (assertions `C819`)
Proof: shell `grep -c "freeze_agreement_version(" ../supabase/migrations/*_service_included.sql` prints `2` (its definition and the transition RPC's one call)

### S3 - Existing agreements have a scope to show · ~3 files · ~12k

**C820** - On the live project after the migration, `execute_sql` shows two counts:
- 0 versions that are not the highest version of a `draft` agreement and still hold `{}`
- 0 highest versions of `draft` agreements whose snapshot changed

The second count is checked against a list of those versions' ids and snapshots taken before the migration and recorded in the Handoff. Every backfilled snapshot has `schema` 1 and a `takenAt` (AC 14, door 5).
Proof: mcp `execute_sql` before and after `apply_migration`, recorded in the Handoff

**C821** - The `demo_seed` recipe runs `SEED_BODY` twice. After the first run:
- every demo version that is not the highest of a `draft` agreement has `snapshot->>'schema'` = `1`
- the 3 demo `draft` agreements' current versions hold `{}`

After the second run, every snapshot is byte-for-byte equal to its value after the first run, so the `takenAt` values are unchanged (AC 15, door 5).
Proof: `npm run test:db demo_seed` (assertions `C821`)

### S4 - The sections are readable at every width · ~2 files · ~5k

**C822** - Live, as the demo owner, at 1440, 768 and 375 px:
- draft AG-1046 shows `Service included` and `Equipment` with its site's types
- adding an asset of a type not yet on that site and reloading shows the new type with its checklist
- sent AG-1039 shows `As recorded on`
- an agreement on a site with 300+ assets shows its `Equipment` groups closed, and one opens on tap
- `document.documentElement.scrollWidth <= window.innerWidth` at each width
- each `<summary>` is at least 44 px tall

(AC 1, AC 3, AC 9, AC 16, AC 17)
Proof: live, recorded in the Handoff

### Doors and delivery · ~8 files · ~15k

**C823** - Grants:
- `anon` cannot execute the scope function (`42501`)
- `has_function_privilege('authenticated', 'public.site_service_scope(uuid)', 'execute')` is true
- the scope function is `security invoker` (`prosecdef` false), `stable`, with `search_path=""`
- the transition RPC keeps `anon` refused and `authenticated` allowed

(door 2, door 3, Surface `401`)
Proof: `npm run test:db service_included` (assertions `C823`)

**C824** - `AgreementDetail` in `application/ports` has a `serviceScope` member, and the page passes the reader's value to the view unchanged. A page test with a reader double returning a frozen scope renders `As recorded on` (door 4)
Proof: `npx vitest run "app/(app)" -t "C824:"`

**C825** - The migration file is `supabase/migrations/<version>_service_included.sql`, where `<version>` is the version `list_migrations` reports for `service_included` (AD-006)
Proof: mcp `list_migrations` compared with `ls ../supabase/migrations`

**C826** - `database.types.ts` equals `generate_typescript_types` after the migration, apart from the file's header, and it contains `site_service_scope` (types)
Proof: mcp `generate_typescript_types`, diff recorded in the Handoff

**C827** - `get_advisors` type `security` reports exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` (security advisors)
Proof: mcp `get_advisors`

**C828** - Every SQL recipe passes, now 16 with `service_included`. This includes `transitions` (C5, the revise snapshot copy), `rls_isolation` (C4, a cross-org update raising `42501`) and `rls_roles` (C13, writer insert into `agreement_versions`), each with every earlier assertion kept (Impact: privileges, domain)
Proof: shell `npm run test:db`

**C829** - `npx tsc --noEmit`, `npm run lint` and `npx next build` each exit 0, and `npm test` passes with no earlier test changed except where `AgreementDetail` fixtures gain `serviceScope` (types, screens)
Proof: shell `npx tsc --noEmit`
Proof: shell `npm run lint`
Proof: shell `npx next build`
Proof: shell `npm test`

**C830** - The recipe runner pins move to 16 recipes and 18 files, and `service_included` is a `plain` recipe (AD-026)
Proof: `npx vitest run scripts/test-db -t "C830:"`

**C831** - Docs:
- `CONTEXT.md` names `site_service_scope` and `freeze_agreement_version` and has a dated Build log line for this feature
- ROADMAP Phase 3 item 2 is `[x]`
- `STATE.md` has `AD-058` onwards for doors 1 to 5

(docs, decisions)
Proof: shell `grep -c "site_service_scope\|freeze_agreement_version" ../CONTEXT.md` prints at least `2`
Proof: shell `grep -c '\[x\] "Service included"' ../ROADMAP.md` prints `1`
Proof: shell `grep -c "^| AD-06[0-2] \|^| AD-05[89] " ../.specs/STATE.md` prints `5`

**C832** - What freezes is what the draft showed. Right after C810's send, with nothing changed in between, version 2's `snapshot - 'takenAt'` equals `public.site_service_scope(<site>)` as `jsonb`, so the live and frozen sources hand the parser the same document (door 1, door 2)
Proof: `npm run test:db service_included` (assertions `C832`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| RPC `POST /rest/v1/rpc/site_service_scope` statuses (2) | `200` C801 · C802 · `401` anon C823 | - |
| scope document keys: 2 top, 4 per type, 3 per asset (9) | `schema` C801 · `types` C801 · `code` C801 · `name` C801 · `tasks` C801 · `assets` C801 · `unitNo` C801 · `typeModel` C801 · `location` C801 | - |
| rows excluded from a scope (3) | other site C802 · type without assets C802 · other org C802 | - |
| parser rejections (7) | C803, table-driven over all 7 | - |
| render order (2 rules) | types by name C803 · C805 · units natural, no unit last C803 | - |
| reader cases (6) | C804, table-driven over all 6 | - |
| view states (7) | live types C805 · type without tasks C806 · live empty writer C807 · live empty viewer C807 · frozen C815 · not recorded C816 · frozen empty C818 | - |
| transitions from `draft` that freeze (2) | `sent` C810 · `withdrawn` C811 | - |
| transitions not from `draft` (6) | C812, table-driven over all 6 | - |
| refused transitions (3) | `40001` C813 · `42501` C813 · `P0002` C813 | - |
| changes after freeze (3) | asset insert C814 · task update C814 · asset delete C814 | - |
| changes reflected while live (3) | asset insert C808 · task update C808 · asset delete C808 | - |
| version update refused, roles (3) | `uE` C817 · `uA` C817 · `uV` C817 | - |
| backfill places (2) | live migration C820 · `seed.sql` C821 | - |
| widths (3) | 1440 C822 · 768 C822 · 375 C822 | - |
| Landing doors (5) | door 1 C801 · C803 · C832 · door 2 C801 · C802 · C808 · C823 · door 3 C810 · C811 · C812 · C817 · C819 · door 4 C804 · C824 · door 5 C820 · C821 | - |
| startup config: container assembly (1 place) | `getContainer()`, unchanged; the reader it already builds gains the call C804 · C824 | - |

- Relations is `None` in the plan, so there is no entity row.
- Claims about the database are proven in SQL as the role in question. The stub proofs prove only the reader's calls and its mapping.
- C810's same-transaction claim rests on the freeze running inside the transition RPC's single function call, with C813 showing that a refused call writes nothing.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the scope function, the freeze inside the transition RPC, the reader) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (the parser, the view's state table) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (the page passing `serviceScope` through, the container) | none of its own | covered by its consumer's proof, with C824 as the one pass-through check |

Evidence:

- the parser: 7 rejection rows plus 2 ordering rules -> decides
- the reader: 6 cases over editable × snapshot content -> decides
- the transition RPC freeze: 8 transitions plus 3 refusals -> decides
- the view: 7 states × 2 roles -> decides
- closest analogues: `service_lines_frozen` (C735), `validateServiceLine` (C720) and the reader's `editable` (C716), each proven at its own layer

Cost: about 20 proofs at their own layer across 4 files. Without these rows, the parser's rejections and the 6 non-freezing transitions would be proven only by the live run, which crosses two of them.

## Swept

- validation: C803 (a malformed or unknown-schema document is rejected), C804 (rejection becomes `not_recorded`)
- failure modes: C813 (a refused transition writes no snapshot), C810 (freeze and status in one function call), C804 (a scope read error rejects, so the page's error boundary shows it)
- idempotency: C821 (re-running the seed changes no snapshot), C820 (the backfill touches only `{}`)
- authorization: C817 (no member updates a version), C819 (the freeze function refuses a viewer), C823 (anon cannot call the scope function), C802 (another org's site gives nothing)
- concurrency: C810, C813 (the freeze runs after the compare-and-set in the same transaction, so a stale send writes nothing). A site edit committing during the send is in the snapshot or not according to commit order, and nothing else depends on it.
- data lifecycle: C814 (a frozen scope survives asset deletes and checklist edits), C820, C821 (backfill)
- dependency failure: C804 (database error). n/a for external services, because none is called.
- state transitions: C810, C811 (freeze on leaving draft), C812 (no freeze on the other 6)
- observability: C804 (`console.error` on a malformed snapshot), C810 (`takenAt` records when). There is no metric or tracing requirement.

## Handoff

- Read set measured with `wc -c` before building: the ports, the agreements adapter and its test, the stub client, `domain/agreement` and its test, `components/agreements/*`, `components/sites/assets.ts`, the agreement page and its test, the agreement-builder migration, `fixture.sql`, `agreement_builder.sql`, `transitions.sql`, `seed.sql`, and the test-db runner and its test. Together they are 180,573 bytes, about 45k tokens. `database.types.ts` (28,640 bytes, about 7k) is regenerated rather than read.
- Writing: a migration of about 6k, the SQL test of about 8k, the parser, reader, view and tests of about 15k, and docs of about 4k.
- Live validation (C822): about 35k tokens of snapshots.
- Total: S1-S2 with the read set come to about 95k. S3 enters at about 102k, S4 and delivery at about 115k, and the live run brings it to about 150k, at the 150k budget. The live run is screenshots, not reading, so this is one builder.
- Mechanism: one builder (fits the budget, no ask).
