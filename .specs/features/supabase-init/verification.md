# Supabase init verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 7b44e92..6c021f7a0ebeafc1fdbe1317fcdb6fb26bff62be
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Steps not run: fault injection, the Coverage recompute and the binding-source comparison did not run because the profile is `light`.

All proofs ran at HEAD `6c021f7` against project `gnxebrtcpbujhvcamtoe`. Each SQL proof was one `execute_sql` call whose query was `supabase/tests/fixture.sql` followed by the test file, both verbatim. All four test files and the fixture are new in the diff range (`git diff --stat 7b44e92..HEAD`), so no proof resolves to a test the feature did not touch. Every `#C<n>` named in `checks.md` has a matching `-- C<n>` block in the named file. The assertion helpers compare exactly: `tests.expect_error` returns only when `sqlstate = p_state` (`supabase/tests/fixture.sql:57`), and `tests.expect_rows` raises when `row_count <> p_rows` (`supabase/tests/fixture.sql:72`). The fixture checks that every tenant table holds rows for both orgs (`supabase/tests/fixture.sql:146-156`), so the zero-row assertions cannot pass on empty tables.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 0 `public` tables with RLS disabled | `execute_sql` fixture + `rls_isolation.sql` -> `rls_isolation: pass` | `supabase/tests/rls_isolation.sql:5` - `tests.ok('C1', (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0, ...)` | PASS |
| C2 | uA sees 0 org B rows in 13 tenant tables (not outbox) and 0 org B `orgs` rows | same call | `supabase/tests/rls_isolation.sql:95-97` - loop over `array_remove(tests.tenant_tables(), 'outbox')` (13 tables, list at `supabase/tests/fixture.sql:15-16`), `tests.count('select count(*) ... where org_id = orgB') = 0`; `:100-101` - `orgs where id = orgB` count `= 0` | PASS |
| C3 | uA insert with org B `org_id` fails 42501 in all 14 tenant tables | same call | `supabase/tests/rls_isolation.sql:109-110` - loop over `tests.tenant_tables()` (14), `tests.expect_error('C3 ' + t, tests.insert_sql(t, 'B'), '42501')` | PASS |
| C4 | uA update of org A row to org B fails 42501 in 12 tables (not events, outbox) | same call | `supabase/tests/rls_isolation.sql:120-127` - `expect_error` with `'42501'` on memberships (:120), org_settings (:122) and a loop over the 10 tables at :124-125; 2 + 10 = 12 | PASS |
| C5 | Same-org composite FKs reject an org A child pointing at an org B parent with 23503 | same call | `supabase/tests/rls_isolation.sql:60-79` - 10 `tests.expect_error(..., '23503')` calls (contacts, sites, asset_type_tasks, assets x2, agreements, agreement_versions, service_lines, contracts, outbox). The 11th composite FK (`sites (site_contact_id, customer_id)`, `supabase/migrations/20261019174738_init.sql:74`) is asserted in the C6 block at `:84`. See finding 1 | PASS |
| C6 | Site contact of another customer fails 23503 | same call | `supabase/tests/rls_isolation.sql:84-86` - `tests.expect_error('C6', insert into sites (... custA, ct2A ...), '23503')`; `ct2A` belongs to `cust2A` (`supabase/tests/fixture.sql:129`) | PASS |
| C7 | anon select returns 0 rows on 14 `public` tables (not outbox) | same call | `supabase/tests/rls_isolation.sql:138-141` - literal 14-table array (orgs + 13), `tests.ok('C7 ' + t, tests.count('select count(*) from public.' + t) = 0, ...)` | PASS |
| C43 | anon insert fails 42501 on all 15 `public` tables | same call | `supabase/tests/rls_isolation.sql:149-150` - loop over `array['orgs']` concatenated with `tests.tenant_tables()` (15), `tests.expect_error('C43 ' + t, tests.insert_sql(t, 'A'), '42501')` | PASS |
| C41 | `org_id` not null in 14 tenant tables | same call | `supabase/tests/rls_isolation.sql:47-50` - loop over `tests.tenant_tables()`, `exists (... column_name = 'org_id' and is_nullable = 'NO')` | PASS |
| C36 | helpers exist, security definer, `search_path=""`, no anon execute | same call | `supabase/tests/rls_isolation.sql:24-26` - count of the two helpers `= 2`; `:33` `f.prosecdef`; `:34` `'search_path=""' = any(f.proconfig)`; `:35` `not has_function_privilege('anon', f.oid, 'execute')`; `:37-40` `to_regprocedure('private.is_org_member(uuid)')` and `('private.has_org_role(uuid, text[])')` not null | PASS |
| C35 | exactly the 15 named tables in `public` | same call | `supabase/tests/rls_isolation.sql:12-16` - sorted `array_agg(tablename)` from `pg_tables where schemaname = 'public'` equals the sorted 15-name literal | PASS |
| C8 | role `contractor` fails 23514; the 4 valid roles are accepted | `execute_sql` fixture + `rls_roles.sql` -> `rls_roles: pass` | `supabase/tests/rls_roles.sql:5-6` - `tests.expect_error('C8 contractor', ..., '23514')`; `:7-11` - a plain insert of `owner`, `admin`, `estimator`, `viewer` that would abort the call if rejected | PASS |
| C9 | second membership for uV in org A fails 23505 | same call | `supabase/tests/rls_roles.sql:16-17` - `tests.expect_error('C9', insert (orgA, uV, 'admin'), '23505')` | PASS |
| C10 | uV reads at least 1 org A row in 13 tenant tables (not outbox) | same call | `supabase/tests/rls_roles.sql:26-28` - loop over `array_remove(tests.tenant_tables(), 'outbox')`, `tests.count(... where org_id = orgA) >= 1` | PASS |
| C11 | uV insert fails 42501 in 13 tenant tables (not outbox) | same call | `supabase/tests/rls_roles.sql:37-38` - same 13-table loop, `tests.expect_error('C11 ' + t, tests.insert_sql(t, 'A'), '42501')` | PASS |
| C12 | uV update and delete affect 0 rows in 12 tables (not events, outbox) | same call | `supabase/tests/rls_roles.sql:48-52` - loop over `tenant_tables()` without `outbox` and `events` (12), `tests.expect_rows('C12 update ' + t, ..., 0)` and `tests.expect_rows('C12 delete ' + t, ..., 0)`; not vacuous because C10 (`:27`) shows uV sees those rows | PASS |
| C13 | uE insert succeeds in the 7 domain tables | same call | `supabase/tests/rls_roles.sql:63-64` - literal 7-table array, `tests.expect_rows('C13 ' + t, tests.insert_sql(t, 'A'), 1)` | PASS |
| C14 | uE: org_settings update 0 rows, memberships update/delete 0 rows, memberships insert 42501 | same call | `supabase/tests/rls_roles.sql:72` `expect_rows('C14 org_settings update', ..., 0)`; `:74` `expect_error('C14 memberships insert', ..., '42501')`; `:75` `expect_rows('C14 memberships update', ..., 0)`; `:77` `expect_rows('C14 memberships delete', ..., 0)` | PASS |
| C15 | uA updates org_settings (1 row) and inserts a membership | same call | `supabase/tests/rls_roles.sql:86-87` `expect_rows('C15 org_settings update', ..., 1)`; `:88` `expect_rows('C15 memberships insert', tests.insert_sql('memberships', 'A'), 1)` | PASS |
| C16 | agreements.status accepts its 7 values, rejects `pending` 23514, defaults to `draft` | `execute_sql` fixture + `domain_constraints.sql` -> `domain_constraints: pass` | `supabase/tests/domain_constraints.sql:11-12` - inserts each of the 7 values; `:14-15` `expect_error('C16 pending', ..., '23514')`; `:16-17` `returning status into got`, `tests.ok('C16 default', got = 'draft', ...)` | PASS |
| C17 | contracts.status accepts its 5 values, rejects `signed` 23514, defaults to `pending_signature` | same call | `supabase/tests/domain_constraints.sql:29,39` - inserts each of the 5 values; `:33-34` `expect_error('C17 signed', ..., '23514')`; `:36-37` `tests.ok('C17 default', got = 'pending_signature', ...)` | PASS |
| C18 | agreement with null `site_id` fails 23502 | same call | `supabase/tests/domain_constraints.sql:46-47` - `expect_error('C18', insert ... site_id null, '23502')` | PASS |
| C39 | agreements has no `customer_id` | same call | `supabase/tests/domain_constraints.sql:52-54` - `tests.ok('C39', not exists (... table_name = 'agreements' and column_name = 'customer_id'), ...)` | PASS |
| C19 | duplicate `(agreement_id, version_no)` 23505; `version_no` 0 fails 23514 | same call | `supabase/tests/domain_constraints.sql:60-61` `expect_error('C19 duplicate', ... version_no 1, '23505')` (verA already holds version 1, `supabase/tests/fixture.sql:135`); `:62-63` `expect_error('C19 zero', ... 0, '23514')` | PASS |
| C20 | second contract for same `agreement_version_id` fails 23505 | same call | `supabase/tests/domain_constraints.sql:68-69` - `expect_error('C20', insert contracts (orgA, verA), '23505')`; conA already uses verA (`supabase/tests/fixture.sql:138`) | PASS |
| C40 | `agreement_version_id` not null on service_lines and contracts | same call | `supabase/tests/domain_constraints.sql:76-79` - loop over both tables, `exists (... column_name = 'agreement_version_id' and is_nullable = 'NO')` | PASS |
| C21 | each `_cents` column rejects -1 with 23514; `visits_per_year` 0 fails 23514 | same call | `supabase/tests/domain_constraints.sql:88-93` - loop over `information_schema.columns` where `column_name like '%\_cents'`, `expect_error(..., 'update ... set col = -1', '23514')`; `:95-96` `expect_error('C21 visits_per_year', ... = 0, '23514')` | PASS |
| C22 | 0 `_cents` columns are not bigint, and at least 1 exists | same call | `supabase/tests/domain_constraints.sql:101-102` count `>= 1`; `:104-106` count with `data_type <> 'bigint'` `= 0` | PASS |
| C23 | duplicate `(org_id, code)` 23505; same code in org B succeeds | same call | `supabase/tests/domain_constraints.sql:112-113` `expect_error('C23 duplicate', ... 'RTU', '23505')`; `:114-115` inserts `ZZ1` in org A and org B (a failure would abort the call) | PASS |
| C24 | assets.source accepts `manual`, `import`; rejects `excel` 23514 | same call | `supabase/tests/domain_constraints.sql:122-123` updates to `manual`, `import`; `:124-125` `expect_error('C24 excel', ..., '23514')` | PASS |
| C25 | both pct columns accept 0 and 100, reject -0.01 and 100.01 with 23514 | same call | `supabase/tests/domain_constraints.sql:135-142` - for each column, `expect_rows(..., 1)` for `0, 100` (:137) and `expect_error(..., '23514')` for `-0.01, 100.01` (:141) | PASS |
| C26 | deleting a site that has an agreement fails 23503 | same call | `supabase/tests/domain_constraints.sql:149-150` - `expect_error('C26', 'delete from public.sites where id = siteA', '23503')`; siteA has agrA (`supabase/tests/fixture.sql:134`). See finding 2 | PASS |
| C27 | deleting org A leaves 0 rows in 14 tenant tables and 0 `orgs` rows | same call | `supabase/tests/domain_constraints.sql:193` `delete from public.orgs where id = a`; `:194-196` loop over `tests.tenant_tables()`, count `= 0`; `:199` `not exists (select 1 from public.orgs where id = a)` | PASS |
| C37 | `id` of the 14 tables other than org_settings is uuid default `gen_random_uuid()` | same call | `supabase/tests/domain_constraints.sql:157-161` - loop over `array['orgs']` plus `tenant_tables()` without `org_settings` (14), `data_type = 'uuid' and column_default = 'gen_random_uuid()'` | PASS |
| C38 | both status columns are text; 0 enum types in `public` | same call | `supabase/tests/domain_constraints.sql:168-170` count of text `status` columns `= 2`; `:172-174` count of `pg_type` with `typtype = 'e'` in `public` `= 0` | PASS |
| C42 | org_settings primary key is exactly `(org_id)` | same call | `supabase/tests/domain_constraints.sql:180-183` - `array_agg(a.attname)` over the `indisprimary` index `= array['org_id']` | PASS |
| C28 | uA update and delete of an events row fail 42501 | `execute_sql` fixture + `events_outbox.sql` -> `events_outbox: pass` | `supabase/tests/events_outbox.sql:13-14` `expect_error('C28 update', ..., '42501')`; `:15-16` `expect_error('C28 delete', ..., '42501')` | PASS |
| C29 | uA inserts an org A event and reads it back (1 row) | same call | `supabase/tests/events_outbox.sql:23-26` - insert `returning id into e`, `tests.ok('C29', (select count(*) from public.events where id = e) = 1, ...)` | PASS |
| C30 | select/insert/update/delete on outbox fail 42501 as uA and as anon | same call | `supabase/tests/events_outbox.sql:31-34` - four `expect_error('C30 authenticated ...', ..., '42501')`; `:42-45` - four `expect_error('C30 anon ...', ..., '42501')` | PASS |
| C31 | second outbox row for same `event_id` fails 23505 | same call | `supabase/tests/events_outbox.sql:5-6` - `expect_error('C31', insert outbox (orgA, evtA), '23505')`; outA already uses evtA (`supabase/tests/fixture.sql:141`) | PASS |
| C32 | project `service-agreement` in `ca-central-1`, `ACTIVE_HEALTHY` | `list_projects()` | MCP returned `{"id":"gnxebrtcpbujhvcamtoe","name":"service-agreement","region":"ca-central-1","status":"ACTIVE_HEALTHY"}`; expected value at `.specs/features/supabase-init/checks.md:158` | PASS |
| C33 | exactly 1 migration `init`; repo holds exactly `<version>_init.sql` | `list_migrations(gnxebrtcpbujhvcamtoe)` and the shell proof | MCP returned `[{"version":"20261019174738","name":"init"}]`; `test "$(ls supabase/migrations)" = "20261019174738_init.sql"` exit 0; file `supabase/migrations/20261019174738_init.sql:1` | PASS |
| C34 | 0 security lints at ERROR or WARN on schema public or private | `get_advisors(gnxebrtcpbujhvcamtoe, security)` | MCP returned 1 lint, `rls_enabled_no_policy` at level `INFO` on `public.outbox`, which is intended (`supabase/migrations/20261019174738_init.sql:323`); 0 at ERROR or WARN | PASS |

## Level and sampling

- Every SQLSTATE claim runs the statement as the role it names (`tests.act_as` / `tests.act_as_anon`, `supabase/tests/fixture.sql:19-32`) at the Postgres boundary that PostgREST enforces. No claim names an HTTP status, so there is no level gap.
- Table-driven loops iterate over the sets the claims name: 13 tables (`array_remove(..., 'outbox')`) for C2, C10, C11; 14 for C3, C27, C41; 12 for C4 (2 explicit + 10 in a loop) and C12; 14 for C7 and C37; 15 for C43. C35 pins the 15-table catalog the loops are drawn from.
- C21 loops over `information_schema`, which today yields 1 `_cents` column (`service_lines.cost_per_visit_cents`); C22 asserts at least 1 exists, so the loop cannot be empty.

## Swept

No `Swept` row in `checks.md` resolves to "existing": the rows cite checks or say `n/a`, so there was no cited constraint to re-read. The plan's `Observable` row that says "existing" (PostgREST maps SQLSTATE to its standard error body) is platform behaviour with no artifact in this tree.

## Findings (non-blocking)

1. C5 precision: the claim says "each of the 11 same-org composite foreign keys", but the `-- C5` block (`supabase/tests/rls_isolation.sql:60-79`) asserts 10. The 11th, `sites (site_contact_id, customer_id)` (`supabase/migrations/20261019174738_init.sql:74`), is scoped to the customer, not the org. It is asserted by the C6 block (`supabase/tests/rls_isolation.sql:84`), which is how the checks' Coverage table maps it. All 11 FKs are proven. The C5 wording overstates its own block.
2. C26 attribution: `siteA` is referenced by both `agrA` and `assetA` (`supabase/tests/fixture.sql:133-134`), and both FKs use `no action`. So `23503` would still be raised if the agreements->sites FK were missing or cascaded. The literal claim holds, but the test does not isolate the agreement FK. A site with an agreement and no assets would. Fault injection, which would expose this, does not run at `light`.

## Gate

- `fixture.sql` + `rls_isolation.sql` via `execute_sql` - returned `rls_isolation: pass` (C1-C7, C35, C36, C41, C43)
- `fixture.sql` + `rls_roles.sql` via `execute_sql` - returned `rls_roles: pass` (C8-C15)
- `fixture.sql` + `domain_constraints.sql` via `execute_sql` - returned `domain_constraints: pass` (C16-C27, C37-C40, C42)
- `fixture.sql` + `events_outbox.sql` via `execute_sql` - returned `events_outbox: pass` (C28-C31)
- `list_projects` - `service-agreement`, `ca-central-1`, `ACTIVE_HEALTHY` (C32)
- `list_migrations` - one migration, `20261019174738` `init` (C33)
- shell `test "$(ls supabase/migrations)" = "20261019174738_init.sql"` - exit 0 (C33)
- `get_advisors` security - 0 ERROR/WARN lints; 1 INFO (`rls_enabled_no_policy` on `public.outbox`, by design) (C34)

43/43 checks proven with located evidence.
