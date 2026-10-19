# Catalog seed - checks

Profile: light
Plan: `.specs/features/catalog-seed/plan.md`

29 checks in 4 slices · 6 one-way doors · 0 open, of which 0 block

## How proofs run

As in supabase-init, there is no CLI, Docker or psql, so proofs run through the Supabase MCP against `service-agreement` (`gnxebrtcpbujhvcamtoe`). There are four proof kinds:

- **sql** - `sql <file>#C<n>` is one `execute_sql` call whose query is `supabase/tests/fixture.sql`, then `<file>`.
  - Before the migration is applied on the remote, the text of `supabase/migrations/*_catalog_template.sql` is inserted between the two. It runs inside the fixture's transaction and is rolled back with it.
  - The block tagged `-- C<n>` raises `C<n>: <reason>` on failure. The file ends in `rollback` and returns one row, `<file>: pass`.
- **seed** - `seed <file>#C<n>` is one `execute_sql` call. Its query is `fixture.sql`, then the **body** of `supabase/seed.sql` (the file without its first line `begin;` and its last line `commit;`), then `supabase/tests/demo_seed.sql`, then the body again, then `supabase/tests/demo_seed_rerun.sql`.
  - The body is used because the real wrapper would commit the fixture.
  - `demo_seed_rerun.sql` ends in `rollback` and returns `demo_seed: pass`.
  - Before the migration is applied, its text goes after the fixture, as for **sql**.
- **mcp** - `mcp <tool>(<args>): <expression> => <expected>` is one Supabase MCP call. It passes when the stated value matches.
- **shell** - a command run from the repo root. It passes when it exits 0.

"The 14 tenant tables" are `tests.tenant_tables()` in `fixture.sql`. The demo org id is `00000000-0000-4000-8000-00000000de30`, written `D` below.

## Checks

### S1 - Catalog template · 3 files · ~55 KB · ~14k

**C1** - `private.catalog_asset_types` holds exactly the 40 `(code, name)` pairs of plan S1, compared as sets in both directions against a literal list in the test (AC 1)
Proof: `sql supabase/tests/catalog_seed.sql#C1`

**C2** - `private.catalog_asset_type_tasks` holds exactly 174 rows. For each of the 40 codes, the row count equals the plan's `Tasks` value (AC 2)
Proof: `sql supabase/tests/catalog_seed.sql#C2`

**C3** - The set of `(code, position, description)` triples equals, in both directions, a 174-row literal list in the test, written from the source's "Service included" section. Positions run `1..n` per code with no gap. The literal has "Backflow preventer" as a name and "Visually check electrical connections for hot spots" under `UNIT_HEATER_ELECTRIC` (AC 3)
Proof: `sql supabase/tests/catalog_seed.sql#C3`

**C4** - 0 template names or descriptions match `enviroware`, `byrne`, `metro tower` or `604 803` (case-insensitive) (AC 4)
Proof: `sql supabase/tests/catalog_seed.sql#C4`

**C5** - As `anon` and as `authenticated` (`uA`), each of these fails with SQLSTATE `42501`: `select` from `private.catalog_asset_types`, `select` from `private.catalog_asset_type_tasks`, and `select private.seed_org_catalog(<org A>)` (AC 5)
Proof: `sql supabase/tests/catalog_seed.sql#C5`

**C6** - An insert into `public.asset_types` with code `rtu`, `Rooftop unit`, `1RTU` or `RTU-2` fails with SQLSTATE `23514`, while codes `RTU_2` and `A` succeed. An insert of `rtu` into `private.catalog_asset_types` also fails with `23514` (AC 6, door 3)
Proof: `sql supabase/tests/catalog_seed.sql#C6`

**C25** - A second `private.catalog_asset_types` row with code `RTU` fails with SQLSTATE `23505`, and so does a second task with `(code, position) = ('RTU', 1)` (door 1)
Proof: `sql supabase/tests/catalog_seed.sql#C25`

### S2 - Copy the catalog into an org · 2 files · ~30 KB · ~8k

**C7** - For a new org C with no asset types, `private.seed_org_catalog(C)` returns `40`. Org C then has 40 `asset_types` and 174 `asset_type_tasks`. Its `(code, name)` set and its `(code, position, description)` set each equal the template's in both directions (AC 7, door 2)
Proof: `sql supabase/tests/catalog_seed.sql#C7`

**C8** - A second `private.seed_org_catalog(C)` returns `0`, and org C still has 40 `asset_types` and 174 `asset_type_tasks` (AC 8)
Proof: `sql supabase/tests/catalog_seed.sql#C8`

**C9** - Org B has the fixture's `RTU` row, named `Rooftop unit` with 1 task `Replace filters`. `private.seed_org_catalog(B)` returns `39`. Afterwards org B's `RTU` row is still named `Rooftop unit` with exactly that 1 task, and org B has 40 `asset_types` and `174 - 10 + 1 = 165` `asset_type_tasks` (AC 9)
Proof: `sql supabase/tests/catalog_seed.sql#C9`

**C10** - After org C's `BOILER` task 1 description is updated to `edited`, the template's `BOILER` task 1 and org B's `BOILER` task 1 both still equal the source text (AC 10)
Proof: `sql supabase/tests/catalog_seed.sql#C10`

**C11** - `private.seed_org_catalog(<random uuid not in orgs>)` fails with SQLSTATE `23503`, and afterwards 0 `asset_types` rows have that `org_id` (AC 11)
Proof: `sql supabase/tests/catalog_seed.sql#C11`

**C26** - `private.seed_org_catalog` has return type `integer`, `prosecdef = false` (security invoker) and `proconfig` containing `search_path=""` (door 2)
Proof: `sql supabase/tests/catalog_seed.sql#C26`

### S3 - Fictitious demo org · 4 files · ~35 KB · ~9k

**C12** - After the seed, exactly 1 `orgs` row has id `D`, and its `name` is `Kettle Ridge Mechanical Ltd.` (AC 12, door 4)
Proof: `seed supabase/tests/demo_seed.sql#C12`

**C13** - Org `D`'s `org_settings` has `repair_discount_pct = 10`, `cpi_cap_pct = 5`, `cancellation_notice_days = 30`, `payment_days = 30` and `governing_province = 'BC'`. Each of `legal_name`, `address`, `phone`, `accent_color` and `tax_note` is non-null and non-blank (AC 13)
Proof: `seed supabase/tests/demo_seed.sql#C13`

**C14** - Org `D` has 40 `asset_types` and 174 `asset_type_tasks`. Its `(code, position, description)` set equals the template's in both directions (AC 14)
Proof: `seed supabase/tests/demo_seed.sql#C14`

**C15** - Org `D` has 12 customers. Their name set equals, in both directions, the 12-name literal in `demo_seed.sql`. Each customer has exactly 1 contact and 1 site, and that site's `site_contact_id` is that contact. The literal itself equals the `customer:` values in `web/lib/sample-pipeline.ts` (AC 15)
Proof: `seed supabase/tests/demo_seed.sql#C15`
Proof: `shell diff <(grep -o 'customer: "[^"]*"' web/lib/sample-pipeline.ts | sed 's/customer: "\(.*\)"/\1/' | sort) <(sed -n '/-- C15 names/,/-- end C15 names/p' supabase/tests/demo_seed.sql | grep -o "'[^']*'" | tr -d "'" | sort)`

**C16** - Each of org `D`'s 12 sites has between 2 and 8 assets. Every demo asset has `source = 'manual'`, a non-blank `unit_no`, `type_model` and `location`, and an `asset_type_id` whose `asset_types.org_id` is `D`. The assets use at least 12 distinct `asset_type_id` values (AC 16)
Proof: `seed supabase/tests/demo_seed.sql#C16`

**C17** - Org `D` has 0 `memberships`, 0 `agreements` and 0 `events` (AC 17)
Proof: `seed supabase/tests/demo_seed.sql#C17`

**C18** - 0 text values in org `D`'s `orgs`, `org_settings`, `customers`, `contacts`, `sites` and `assets` rows match `enviroware`, `byrne` or `604 803` (case-insensitive). Every org `D` contact `email` ends in `@example.com`. Every non-null `phone` in org `D`'s `org_settings` and `contacts` matches `555-01[0-9]{2}$` (AC 18)
Proof: `seed supabase/tests/demo_seed.sql#C18`

**C19** - After the seed body runs a second time, the count of `orgs` rows with id `D` and of rows with `org_id = D` in each of the 14 tenant tables equals the count after the first run (AC 19, door 4)
Proof: `seed supabase/tests/demo_seed.sql#C19`

**C20** - `supabase/seed.sql`'s first non-comment line is `begin;` and its last line is `commit;`, and no other line is `begin`, `commit`, `rollback` or `end` as a statement. So a failing statement aborts the one transaction and nothing persists (AC 20, door 5)
Proof: `shell test "$(grep -v '^\s*--' supabase/seed.sql | grep -v '^\s*$' | head -1)" = "begin;" && test "$(grep -v '^\s*$' supabase/seed.sql | tail -1)" = "commit;" && test "$(grep -ciE '^\s*(begin|commit|rollback|end)\s*;' supabase/seed.sql)" = "2"`

**C27** - No migration contains demo data: 0 files in `supabase/migrations/` match `Kettle Ridge` or `00000000-0000-4000-8000-00000000de30` (door 5)
Proof: `shell ! grep -rlE "Kettle Ridge|00000000-0000-4000-8000-00000000de30" supabase/migrations/`

**C28** - On the remote, after the real seed run, one read-only query returns: 1 org `D` named `Kettle Ridge Mechanical Ltd.`, 40 types, 174 tasks, 12 customers, 12 contacts, 12 sites, between 24 and 96 assets, and 0 memberships, agreements and events for `D` (AC 12-17 on the live project)
Proof: `mcp execute_sql(project_id, "<count query in demo_seed.sql header comment>"): row => {orgs:1, name:"Kettle Ridge Mechanical Ltd.", types:40, tasks:174, customers:12, contacts:12, sites:12, assets in [24,96], memberships:0, agreements:0, events:0}`

### S4 - Applied and nothing regressed · 6 files · ~60 KB · ~15k

**C21** - `list_migrations` returns exactly two migrations, `init` and `catalog_template`. `supabase/migrations/` holds exactly `<v1>_init.sql` and `<v2>_catalog_template.sql` with those versions (AC 21, door 6)
Proof: `mcp list_migrations(project_id): [{version: V1, name: "init"}, {version: V2, name: "catalog_template"}]`
Proof: `shell test "$(ls supabase/migrations | tr '\n' ' ')" = "${V1}_init.sql ${V2}_catalog_template.sql "`

**C22** - With the migration applied and the updated fixture, each of `rls_isolation.sql`, `rls_roles.sql`, `domain_constraints.sql` and `events_outbox.sql` returns its `pass` row (AC 22)
Proof: `sql supabase/tests/rls_isolation.sql`
Proof: `sql supabase/tests/rls_roles.sql`
Proof: `sql supabase/tests/domain_constraints.sql`
Proof: `sql supabase/tests/events_outbox.sql`

**C23** - `get_advisors(type: security)` returns 0 lints at level `ERROR` or `WARN` whose metadata schema is `public` or `private` (AC 23)
Proof: `mcp get_advisors(project_id, "security"): lints filtered to level in (ERROR, WARN) and metadata.schema in (public, private) => []`

**C24** - `public` still contains exactly the 15 tables of supabase-init AC 35 (AC 24)
Proof: `sql supabase/tests/rls_isolation.sql#C35`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| catalog types (40) | C1, table-driven over all 40 (literal list); counts per type C2, table-driven over all 40 | - |
| catalog tasks (174) | C3, table-driven over all 174 (literal list) | - |
| source corrections (2) | `Backflow preventer` C3 · `hot spots` C3 | - |
| source exclusions (4) | `enviroware` C4 C18 · `byrne` C4 C18 · `metro tower` C4 · `604 803` C4 C18 | - |
| private objects x roles (6) | `catalog_asset_types` anon C5 · `catalog_asset_types` authenticated C5 · `catalog_asset_type_tasks` anon C5 · `catalog_asset_type_tasks` authenticated C5 · `seed_org_catalog` anon C5 · `seed_org_catalog` authenticated C5 | - |
| code format values (7) | `rtu` rejected C6 · `Rooftop unit` rejected C6 · `1RTU` rejected C6 · `RTU-2` rejected C6 · `RTU_2` accepted C6 · `A` accepted C6 · template `rtu` rejected C6 | - |
| `seed_org_catalog` paths (5) | empty org C7 · second call C8 · code already present C9 · edit after copy C10 · org missing C11 | - |
| demo settings fields (10) | `repair_discount_pct` C13 · `cpi_cap_pct` C13 · `cancellation_notice_days` C13 · `payment_days` C13 · `governing_province` C13 · `legal_name` C13 · `address` C13 · `phone` C13 C18 · `accent_color` C13 · `tax_note` C13 | - |
| demo customers (12) | C15, table-driven over all 12 (literal list, pinned to `sample-pipeline.ts` by the shell proof) | - |
| demo re-run counts (15) | C19, table-driven over all 15 (`orgs` plus the 14 tenant tables) | - |
| existing suites (4) | `rls_isolation` C22 · `rls_roles` C22 · `domain_constraints` C22 · `events_outbox` C22 | - |
| Landing doors (6) | door 1 C1 C2 C5 C25 · door 2 C7 C8 C9 C11 C26 · door 3 C6 · door 4 C12 C19 · door 5 C20 C27 · door 6 C21 | - |
| Relations entities (4) | `catalog_asset_types` C1 · `catalog_asset_type_tasks` C2 C3 · copy into `asset_types` C7 · copy into `asset_type_tasks` C7 C10 | - |

- Claims naming a SQLSTATE compare it exactly, through `tests.expect_error`, never as "any error".
- Set claims (C1, C3, C7, C14, C15) compare in both directions with `except` each way, so an extra row fails as surely as a missing one.
- The literal lists in `catalog_seed.sql` are written from the source text, not copied from the migration. The Verifier compares them against the source.

## Swept

- validation: C6, C25
- failure modes: C11, C20
- idempotency: C8, C9, C19
- authorization: C5, C17 (the demo org has no member, so the existing RLS hides it from every `authenticated` user)
- concurrency: C9. The skip is decided by the existing unique index `(org_id, code)` through `on conflict do nothing`, so two concurrent calls for one org serialise on the key. Tasks are copied only for the rows that call's `returning` produced, so a concurrent pair cannot duplicate tasks
- data lifecycle: C10 (an org's copy is independent of the template), C27 (demo rows live only in `seed.sql`). Org deletion still cascades through supabase-init C27
- dependency failure: n/a - nothing calls an external service. The PDF source is read once, at authoring time
- state transitions: n/a - no status is written. The demo org has 0 agreements (C17)
- observability: n/a - the seed and the function write no events by design (C17). The function's return value is its only signal (C7, C8, C9)

## Handoff

- S1-S4 touch one new migration (~22 KB: 40 types and 174 tasks), `seed.sql` (~15 KB), three test files (~40 KB, the 174-row literal included), `fixture.sql` (~8 KB, one line changes), and CONTEXT.md, ROADMAP.md and STATE.md (~28 KB read, ~3 KB written). With plan and checks (~30 KB), that is about 145 KB, roughly 36k tokens, under the 150k budget - one builder
- Remote writes: `apply_migration` and the real `seed.sql` run wait for the user's go-ahead (plan Assumptions). C1-C27 are proven first with the migration text inlined and rolled back
