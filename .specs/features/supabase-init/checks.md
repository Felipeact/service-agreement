# Supabase init - checks

Profile: light
Plan: `.specs/features/supabase-init/plan.md`

43 checks in 5 slices · 13 one-way doors · 1 open, of which 0 block

## How proofs run

The Supabase CLI, Docker and psql are not installed, so proofs run through the Supabase MCP against the
`service-agreement` project. There are three proof kinds:

- **sql** - `sql <file>#C<n>` means one MCP `execute_sql` call whose query is the text of
  `supabase/tests/fixture.sql` followed by the text of `<file>`. The fixture opens a transaction, inserts the
  orgs, users and one row per table, and defines the `tests.*` assertion helpers. Each test file ends in
  `rollback`, so nothing persists. The block tagged `-- C<n>` asserts that check and raises `C<n>: <reason>`
  on failure, which makes the call return an error. A passing file returns one row,
  `<file>: pass`. The check passes when the call returns that row.
- **mcp** - `mcp <tool>(<args>): <expression> => <expected>` means one Supabase MCP call, and the check passes
  when the stated value matches.
- **shell** - a command run from the repo root that passes when it exits 0.

Fixture users: `uA` owner of org A, `uB` owner of org B, `uV` viewer in A, `uE` estimator in A. As in
the plan, "tenant tables" are the 14 `public` tables with `org_id`: `memberships`, `org_settings`, `customers`,
`contacts`, `sites`, `asset_types`, `asset_type_tasks`, `assets`, `agreements`, `agreement_versions`,
`service_lines`, `contracts`, `events`, `outbox`.

## Checks

### S1 - Tenant isolation · 3 files · ~40 KB · ~10k

**C1** - 0 tables in schema `public` have row level security disabled (AC 1)
Proof: `sql supabase/tests/rls_isolation.sql#C1`

**C2** - As `uA`, a select on each of the 13 tenant tables other than `outbox` returns 0 rows with org B's `org_id`, and `orgs` returns 0 rows with org B's `id` (AC 2). `outbox` rejects every select (C30)
Proof: `sql supabase/tests/rls_isolation.sql#C2`

**C3** - As `uA`, inserting a row with org B's `org_id` into each of the 14 tenant tables fails with SQLSTATE `42501` (AC 3)
Proof: `sql supabase/tests/rls_isolation.sql#C3`

**C4** - As `uA`, updating an org A row to org B's `org_id` fails with SQLSTATE `42501` in each of the 12 tenant tables other than `events` and `outbox` (AC 4). Those two are covered by C28 and C30
Proof: `sql supabase/tests/rls_isolation.sql#C4`

**C5** - Each of the 11 same-org composite foreign keys rejects a child in org A that points at a parent in org B with SQLSTATE `23503` (AC 5, door 1)
Proof: `sql supabase/tests/rls_isolation.sql#C5`

**C6** - A site whose `site_contact_id` names a contact of another customer in the same org fails with SQLSTATE `23503` (AC 6, door 1)
Proof: `sql supabase/tests/rls_isolation.sql#C6`

**C7** - As `anon`, a select on each of the 14 `public` tables other than `outbox` returns 0 rows (AC 7)
Proof: `sql supabase/tests/rls_isolation.sql#C7`

**C43** - As `anon`, an insert into each of the 15 `public` tables fails with SQLSTATE `42501` (AC 7)
Proof: `sql supabase/tests/rls_isolation.sql#C43`

**C41** - `org_id` is `not null` in each of the 14 tenant tables (door 1)
Proof: `sql supabase/tests/rls_isolation.sql#C41`

**C36** - `private.is_org_member(uuid)` and `private.has_org_role(uuid, text[])` exist, are `security definer`, have `search_path=""`, and `execute` on them is not granted to `anon` (door 2)
Proof: `sql supabase/tests/rls_isolation.sql#C36`

### S2 - Roles · 2 files · ~30 KB · ~8k

**C8** - A membership with role `contractor` fails with SQLSTATE `23514`, and each of `owner`, `admin`, `estimator`, `viewer` is accepted (AC 8, door 5)
Proof: `sql supabase/tests/rls_roles.sql#C8`

**C9** - A second membership for `uV` in org A fails with SQLSTATE `23505` (AC 9, door 5)
Proof: `sql supabase/tests/rls_roles.sql#C9`

**C10** - As `uV`, a select on each of the 13 tenant tables other than `outbox` returns at least one org A row (AC 10)
Proof: `sql supabase/tests/rls_roles.sql#C10`

**C11** - As `uV`, an insert of an org A row into each of the 13 tenant tables other than `outbox` fails with SQLSTATE `42501` (AC 11)
Proof: `sql supabase/tests/rls_roles.sql#C11`

**C12** - As `uV`, an update and a delete of an org A row affect 0 rows in each of the 12 tenant tables other than `events` and `outbox` (AC 12). C28 covers `events`
Proof: `sql supabase/tests/rls_roles.sql#C12`

**C13** - As `uE`, an insert of an org A row succeeds in each of `customers`, `contacts`, `sites`, `assets`, `agreements`, `agreement_versions`, `service_lines` (AC 13)
Proof: `sql supabase/tests/rls_roles.sql#C13`

**C14** - As `uE`, an update of `org_settings` and an update and a delete of `memberships` affect 0 rows, and an insert into `memberships` fails with SQLSTATE `42501` (AC 14)
Proof: `sql supabase/tests/rls_roles.sql#C14`

**C15** - As `uA`, an update of org A's `org_settings` affects 1 row and an insert into org A's `memberships` succeeds (AC 15)
Proof: `sql supabase/tests/rls_roles.sql#C15`

### S3 - Domain shape · 2 files · ~35 KB · ~9k

**C16** - `agreements.status` accepts each of its 7 values, rejects `pending` with SQLSTATE `23514`, and defaults to `draft` (AC 16, door 4)
Proof: `sql supabase/tests/domain_constraints.sql#C16`

**C17** - `contracts.status` accepts each of its 5 values, rejects `signed` with SQLSTATE `23514`, and defaults to `pending_signature` (AC 17, door 4)
Proof: `sql supabase/tests/domain_constraints.sql#C17`

**C18** - An agreement inserted with `site_id` null fails with SQLSTATE `23502` (AC 18, door 6)
Proof: `sql supabase/tests/domain_constraints.sql#C18`

**C39** - `agreements` has no `customer_id` column (door 6)
Proof: `sql supabase/tests/domain_constraints.sql#C39`

**C19** - A duplicate `(agreement_id, version_no)` fails with SQLSTATE `23505`, and `version_no` 0 fails with `23514` (AC 19, door 7)
Proof: `sql supabase/tests/domain_constraints.sql#C19`

**C20** - A second contract for the same `agreement_version_id` fails with SQLSTATE `23505` (AC 20, door 7)
Proof: `sql supabase/tests/domain_constraints.sql#C20`

**C40** - `service_lines.agreement_version_id` and `contracts.agreement_version_id` are `not null` (door 7)
Proof: `sql supabase/tests/domain_constraints.sql#C40`

**C21** - Each `_cents` column rejects `-1` with SQLSTATE `23514`, and `service_lines.visits_per_year` rejects `0` with `23514` (AC 21, door 8)
Proof: `sql supabase/tests/domain_constraints.sql#C21`

**C22** - 0 columns in `public` named `%_cents` have a data type other than `bigint`, and at least 1 such column exists (AC 22, door 8)
Proof: `sql supabase/tests/domain_constraints.sql#C22`

**C23** - A second `asset_types` row with the same `(org_id, code)` fails with SQLSTATE `23505`, and the same `code` in org B succeeds (AC 23, door 11)
Proof: `sql supabase/tests/domain_constraints.sql#C23`

**C24** - `assets.source` accepts `manual` and `import` and rejects `excel` with SQLSTATE `23514` (AC 24)
Proof: `sql supabase/tests/domain_constraints.sql#C24`

**C25** - `org_settings.repair_discount_pct` and `cpi_cap_pct` each accept `0` and `100` and reject `-0.01` and `100.01` with SQLSTATE `23514` (AC 25)
Proof: `sql supabase/tests/domain_constraints.sql#C25`

**C26** - Deleting a site that has an agreement fails with SQLSTATE `23503` (AC 26)
Proof: `sql supabase/tests/domain_constraints.sql#C26`

**C27** - Deleting org A as the table owner leaves 0 rows with org A's `org_id` in each of the 14 tenant tables, and 0 `orgs` rows with its id (AC 27)
Proof: `sql supabase/tests/domain_constraints.sql#C27`

**C37** - The `id` column of each of the 14 `public` tables other than `org_settings` is `uuid` with default `gen_random_uuid()` (door 3)
Proof: `sql supabase/tests/domain_constraints.sql#C37`

**C38** - `agreements.status` and `contracts.status` are of type `text`, and 0 enum types exist in schema `public` (door 4)
Proof: `sql supabase/tests/domain_constraints.sql#C38`

**C42** - The primary key of `org_settings` is exactly `(org_id)` (door 13)
Proof: `sql supabase/tests/domain_constraints.sql#C42`

### S4 - Event log and outbox · 2 files · ~15 KB · ~4k

**C28** - As `uA`, both an update and a delete of an org A `events` row fail with SQLSTATE `42501` (AC 28, door 9)
Proof: `sql supabase/tests/events_outbox.sql#C28`

**C29** - As `uA`, an insert into `events` for org A succeeds and a select by its id returns 1 row (AC 29)
Proof: `sql supabase/tests/events_outbox.sql#C29`

**C30** - On `outbox`, each of `select`, `insert`, `update`, `delete` fails with SQLSTATE `42501` as `authenticated` (`uA`) and as `anon` (AC 30, door 9)
Proof: `sql supabase/tests/events_outbox.sql#C30`

**C31** - A second `outbox` row for the same `event_id` fails with SQLSTATE `23505` (AC 31, door 9)
Proof: `sql supabase/tests/events_outbox.sql#C31`

### S5 - Project applied and clean · 2 files · ~25 KB · ~6k

**C32** - The project `service-agreement` exists in region `ca-central-1` with status `ACTIVE_HEALTHY` (AC 32, door 12)
Proof: `mcp list_projects(): the project named service-agreement => region "ca-central-1", status "ACTIVE_HEALTHY"`

**C33** - `list_migrations` returns exactly 1 migration, named `init`, and `supabase/migrations/` holds exactly 1 file, `<that version>_init.sql` (AC 33, door 10)
Proof: `mcp list_migrations(project_id): migrations => [{version: V, name: "init"}]`
Proof: `shell test "$(ls supabase/migrations)" = "${V}_init.sql"`

**C34** - `get_advisors(type: security)` returns 0 lints at level `ERROR` or `WARN` whose metadata schema is `public` or `private` (AC 34)
Proof: `mcp get_advisors(project_id, "security"): lints filtered to level in (ERROR, WARN) and metadata.schema in (public, private) => []`

**C35** - `public` contains exactly these 15 tables: `orgs`, `memberships`, `org_settings`, `customers`, `contacts`, `sites`, `asset_types`, `asset_type_tasks`, `assets`, `agreements`, `agreement_versions`, `service_lines`, `contracts`, `events`, `outbox` (AC 35)
Proof: `sql supabase/tests/rls_isolation.sql#C35`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `public` tables with RLS enabled (15) | C1, table-driven over all 15 (read from `pg_tables`; the set is pinned by C35) | - |
| uA cannot see org B (15) | `orgs` C2 · `memberships` C2 · `org_settings` C2 · `customers` C2 · `contacts` C2 · `sites` C2 · `asset_types` C2 · `asset_type_tasks` C2 · `assets` C2 · `agreements` C2 · `agreement_versions` C2 · `service_lines` C2 · `contracts` C2 · `events` C2 · `outbox` C30 | - |
| uA cannot insert into org B (14) | C3, table-driven over all 14 | - |
| uA cannot move a row to org B (14) | `memberships` C4 · `org_settings` C4 · `customers` C4 · `contacts` C4 · `sites` C4 · `asset_types` C4 · `asset_type_tasks` C4 · `assets` C4 · `agreements` C4 · `agreement_versions` C4 · `service_lines` C4 · `contracts` C4 · `events` C28 · `outbox` C30 | - |
| same-org composite FKs (11) | `contacts->customers` C5 · `sites->customers` C5 · `asset_type_tasks->asset_types` C5 · `assets->sites` C5 · `assets->asset_types` C5 · `agreements->sites` C5 · `agreement_versions->agreements` C5 · `service_lines->agreement_versions` C5 · `contracts->agreement_versions` C5 · `outbox->events` C5 · `sites->contacts (same customer)` C6 | - |
| anon reads nothing (15) | `orgs` C7 · `memberships` C7 · `org_settings` C7 · `customers` C7 · `contacts` C7 · `sites` C7 · `asset_types` C7 · `asset_type_tasks` C7 · `assets` C7 · `agreements` C7 · `agreement_versions` C7 · `service_lines` C7 · `contracts` C7 · `events` C7 · `outbox` C30 | - |
| anon writes nothing (15) | C43, table-driven over all 15 | - |
| membership roles (5) | `owner` C8 · `admin` C8 · `estimator` C8 · `viewer` C8 · `contractor` rejected C8 | - |
| viewer reads (13) | C10, table-driven over all 13 | - |
| viewer cannot insert (13) | C11, table-driven over all 13 | - |
| viewer cannot update or delete (13) | `memberships` C12 · `org_settings` C12 · `customers` C12 · `contacts` C12 · `sites` C12 · `asset_types` C12 · `asset_type_tasks` C12 · `assets` C12 · `agreements` C12 · `agreement_versions` C12, update since 2026-10-27 service-included C817 (`42501`; user-approved) · `service_lines` C12 · `contracts` C12 · `events` C28 | - |
| estimator writes domain data (7) | `customers` C13 · `contacts` C13 · `sites` C13 · `assets` C13 · `agreements` C13 · `agreement_versions` C13 · `service_lines` C13 | - |
| estimator cannot change company policy (4) | `org_settings` update C14 · `memberships` insert C14 · `memberships` update C14 · `memberships` delete C14 | - |
| owner manages the org (2) | `org_settings` update C15 · `memberships` insert C15 | - |
| agreement statuses (9) | `draft` C16 · `sent` C16 · `accepted` C16 · `refused` C16 · `changes_requested` C16 · `expired` C16 · `withdrawn` C16 · `pending` rejected C16 · default C16 | - |
| contract statuses (7) | `pending_signature` C17 · `client_signed` C17 · `completed` C17 · `declined` C17 · `voided` C17 · `signed` rejected C17 · default C17 | - |
| `_cents` columns (1) | `service_lines.cost_per_visit_cents` C21 C22 (C22 fails if a `_cents` column is not `bigint`; C21 loops over `information_schema`, so a new one is covered) | - |
| percent bounds (8) | `repair_discount_pct=0` C25 · `repair_discount_pct=100` C25 · `repair_discount_pct=-0.01` C25 · `repair_discount_pct=100.01` C25 · `cpi_cap_pct=0` C25 · `cpi_cap_pct=100` C25 · `cpi_cap_pct=-0.01` C25 · `cpi_cap_pct=100.01` C25 | - |
| `assets.source` (3) | `manual` C24 · `import` C24 · `excel` rejected C24 | - |
| outbox operations (8) | `select` as authenticated C30 · `insert` as authenticated C30 · `update` as authenticated C30 · `delete` as authenticated C30 · `select` as anon C30 · `insert` as anon C30 · `update` as anon C30 · `delete` as anon C30 | - |
| org cascade (15) | C27, table-driven over all 15 (the 14 tenant tables plus `orgs`) | - |
| Landing doors (13) | door 1 C5 C6 C41 · door 2 C36 · door 3 C37 · door 4 C16 C17 C38 · door 5 C8 C9 · door 6 C18 C39 · door 7 C19 C20 C40 · door 8 C21 C22 · door 9 C28 C30 C31 · door 10 C33 · door 11 C23 · door 12 C32 · door 13 C42 | - |
| Relations entities (15) | C35, table-driven over all 15 (each is also isolated by C2) | - |

- Claims naming a SQLSTATE: each proof runs the statement as the role the claim names and compares the
  returned SQLSTATE exactly, never "any error"
- Table-driven proofs read their table list from a literal array in the test, and C35 pins that list to
  the catalog, so a 16th table cannot slip past the loops

## Swept

- validation: C16, C17, C21, C24, C25
- failure modes: n/a - this feature adds no runtime write path. Every test transaction ends in `rollback`, and `apply_migration` either records `init` or does not (C33)
- idempotency: C31 (`outbox.event_id` unique, so a retried dispatch cannot double-send), C9
- authorization: C2, C3, C4, C7, C43, C10, C11, C12, C13, C14, C15, C28, C30
- concurrency: C19, C20, C23 - uniqueness is enforced by unique indexes, which serialise concurrent inserts of the same key
- data lifecycle: C26, C27
- dependency failure: n/a - nothing in the schema calls an external service
- state transitions: n/a - transitions belong to the Phase 1 state machine. C16 and C17 constrain only the value set
- observability: C29 - `events` is the audit log. There is no logging requirement on the schema itself

## Handoff

- S1-S5 touch one migration (~25 KB), a fixture and four test files (~35 KB), and CONTEXT.md, ROADMAP.md and STATE.md (~20 KB read, ~3 KB written): about 80 KB, roughly 20k tokens, under the 150k budget - one builder

- **Boundary:** C1-C43 closed at the `feat(db)` commit that adds `supabase/` (one builder)
- **Settled mid-build:** the user approved creating `service-agreement` in `ca-central-1` and applying the migration. C2 and plan AC 2 / AC 7 now exclude `outbox`, because outbox rejects every select (C30), so "returns 0 rows" cannot hold there; nothing is weakened. The "Deletes inside an org" assumption became `no action`, because `restrict` would block the org cascade (C27)
- **Abandoned:** none. Builder runs of `rls_roles`, `domain_constraints` and `events_outbox` used a trimmed copy of the fixture (comments, the fixture sanity block, and for `events_outbox` the tables it does not touch were left out); the Verifier runs the committed files whole
