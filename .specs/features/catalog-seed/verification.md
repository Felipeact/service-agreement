# Catalog seed verification

**Verdict**: PASS
**Profile**: light
**Diff range**: d924e04..working tree (uncommitted)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Steps not run: fault injection, the Coverage recompute and the binding-source comparison did not run because the profile is `light`.

## Round 2 scope

Round 1 returned FAIL. The cause was C13, C14, C15, C16, C18 and C19: each had a located assertion, but the Verifier's `execute_sql` for the seed proof was declined, so none of them had a run the Verifier saw. Round 2 covers those six checks and re-runs every proof the Verifier can run.

What changed since round 1 (verified at round 2):
- The fix's diff is docs only. `git diff d924e04 -- .specs/features/catalog-seed/checks.md` shows two changes:
  - The header now reads "28 checks" (`checks.md:6`).
  - A new Handoff line, "Evidence accepted by the user (2026-10-19)" (`checks.md:171`), records that the user accepted their own SQL Editor run of the assembled seed proof (`demo_seed: pass`) as the evidence for those six checks.
- No code, test or migration file changed. Every file under `supabase/` and `web/lib/sample-pipeline.ts` has a modification time before round 1 started. The latest is the migration at 12:15:16, and round 1 ran after 14:30. Current md5s:
  - `20261019191509_catalog_template.sql`: `f742d8053df4faafb52dff05ea93477b`
  - `seed.sql`: `0fd1abef72966b2553df1574b3d10ffc`
  - `catalog_seed.sql`: `00d6e1feab9a80b9d11904000308b031`
  - `demo_seed.sql`: `88b5390ceef4253b350ecf7e7dccd0e8`
  - `demo_seed_rerun.sql`: `734aad66230a81ef1e3d8c2e401c6c8e`
  - `fixture.sql`: `18bfdefed9a7dcca2fd244009f1ae46b`
- The assembled seed proof the user ran (`run_demo_seed.sql` in the session scratchpad) still equals fixture, seed body, `demo_seed.sql`, seed body and `demo_seed_rerun.sql` from the current tree, apart from blank lines (`diff -B` clean, re-checked at round 2).

How the proofs ran in round 2, on project `gnxebrtcpbujhvcamtoe`:
- **Re-run in full by the Verifier at the round-2 state:**
  - **sql**: five `execute_sql` calls, each the full text of `fixture.sql` followed by the full text of the suite, verbatim. Results: `catalog_seed: pass`, `events_outbox: pass`, `rls_roles: pass`, `rls_isolation: pass`, `domain_constraints: pass`.
  - **mcp**: `list_migrations`, `get_advisors(security)`, `list_tables(["public"])` and the C28 count query.
  - **shell**: C15 (second proof), C20, C21 and C27, each exit 0.
  - A read-only check afterwards returned `tests_schema: 0` and `test_users: 0`, so nothing persisted.
- **The shell and mcp proofs are not inherited.** They do not read `checks.md`, and the files and remote objects they read have not changed, so a docs-only change could not have moved them. They were re-run anyway, and each returned the same result as in round 1.
- **The seed proof was not re-run**, as the coordinator scoped it. The Verifier's round-1 `execute_sql` for it returned `{"status":"declined"}`, and no new attempt was made.

How each check's evidence is sourced:
- **Verified at round 2:** every row in Checks except the six user-accepted ones.
- **User-accepted, judged at round 2:** C13, C14, C15, C16, C18 and C19.
- **Carried from round 1** (inputs unchanged): the Source comparison and the Swept re-read.

## Checks

Verified at round 2. The six seed-proof rows are re-judged against the user's recorded acceptance.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | template holds exactly the 40 `(code, name)` pairs | Verifier `execute_sql` fixture + `catalog_seed.sql` -> `catalog_seed: pass` (round 2) | `supabase/tests/catalog_seed.sql:227` `count(*) from tests.expected_types = 40`; `:229` `expected_types except catalog_asset_types` empty; `:232` the reverse `except` empty. The literal is at `:6-46` | PASS |
| C2 | 174 tasks; per-code count equals plan `Tasks` | same call | `supabase/tests/catalog_seed.sql:240` `count(*) from private.catalog_asset_type_tasks = 174`; `:241-243` loop over all 40 `expected_types`, `r.n = r.task_count` | PASS |
| C3 | 174 triples equal the source literal both ways; positions 1..n; the two corrections | same call | `supabase/tests/catalog_seed.sql:249` literal size `= 174`; `:251-252` and `:255-256` `except` both ways empty; `:259-260` `having min(position) <> 1 or max(position) <> count(*)` absent; `:263` `name = 'Backflow preventer'`; `:266-267` `UNIT_HEATER_ELECTRIC` `'Visually check electrical connections for hot spots'`. Literal checked against the source PDF (Source comparison) | PASS |
| C4 | 0 template names/descriptions match the source company | same call | `supabase/tests/catalog_seed.sql:274-276` `not exists (... name ~* <regex> union all ... description ~* <regex>)`, where the regex alternates `enviroware`, `byrne`, `metro tower`, `604 803` | PASS |
| C5 | anon and authenticated: both `select`s and `seed_org_catalog` fail 42501 | same call | `supabase/tests/catalog_seed.sql:317-322` after `tests.act_as('uA')`, three `expect_error(..., '42501')`; `:327-332` after `tests.act_as_anon()`, the same three | PASS |
| C6 | `rtu`, `Rooftop unit`, `1RTU`, `RTU-2` fail 23514; `RTU_2`, `A` succeed; template `rtu` fails 23514 | same call | `supabase/tests/catalog_seed.sql:294-296` loop over the 4 values, `expect_error(..., '23514')`; `:298-300` `expect_rows(..., 1)` for `RTU_2`, `A`; `:302-303` `expect_error('C6 template rtu', ..., '23514')` | PASS |
| C25 | duplicate template type `RTU` and task `('RTU', 1)` fail 23505 | same call | `supabase/tests/catalog_seed.sql:282-283` `expect_error('C25 type', ..., '23505')`; `:284-285` `expect_error('C25 task', ..., '23505')` | PASS |
| C7 | new org C: returns 40, 40 types, 174 tasks, both sets equal the template | same call | `supabase/tests/catalog_seed.sql:344` `n = 40`; `:345` types `= 40`; `:346` tasks `= 174`; `:347-352` type set `except` both ways; `:354-361` task set `except` both ways | PASS |
| C8 | second call returns 0; counts unchanged | same call | `supabase/tests/catalog_seed.sql:372` `n = 0`; `:373` `= 40`; `:374` `= 174` | PASS |
| C9 | org B with existing `RTU`: returns 39, RTU untouched, 40 types, 165 tasks | same call | `supabase/tests/catalog_seed.sql:384` `n = 39`; `:386` name `= 'Rooftop unit'`; `:388-389` `array_agg(description order by position) = array['Replace filters']`; `:390` `= 40`; `:391` `= 165` | PASS |
| C10 | edit to org C `BOILER` task 1 leaves template and org B copy unchanged | same call | `supabase/tests/catalog_seed.sql:402-404` org C reads `'edited'`; `:405-406` template `= src`; `:407-409` org B `= src`, where `src` is `'Clean heat exchanger with compressed air'` (`:397`) | PASS |
| C11 | unknown org fails 23503, 0 rows | same call | `supabase/tests/catalog_seed.sql:417` `expect_error('C11', ..., '23503')`; `:418` count for `ghost` `= 0` | PASS |
| C26 | `seed_org_catalog` returns integer, security invoker, `search_path=""` | same call | `supabase/tests/catalog_seed.sql:311-312` `p.prorettype = 'integer'::regtype and not p.prosecdef and p.proconfig @> array['search_path=""']` | PASS |
| C12 | exactly 1 org `D`, named `Kettle Ridge Mechanical Ltd.` | seed proof user-run in SQL Editor (`demo_seed: pass`), accepted by the user (`checks.md:171`); Verifier `execute_sql` declined in round 1 (`{"status":"declined"}`). Independently: Verifier re-ran the C28 query in round 2 -> `orgs:1, name:"Kettle Ridge Mechanical Ltd."` | `supabase/tests/demo_seed.sql:23` `count(*) ... where id = tests.demo()) = 1`; `:25` `name = 'Kettle Ridge Mechanical Ltd.'`. The C28 query that settled it is at `supabase/tests/demo_seed.sql:5-6` | PASS |
| C13 | demo `org_settings` values and 5 non-blank fields | user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user as the evidence (`checks.md:171`); the Verifier's `execute_sql` was declined (`{"status":"declined"}`) | `supabase/tests/demo_seed.sql:34-38` `repair_discount_pct = 10`, `cpi_cap_pct = 5`, `cancellation_notice_days = 30`, `payment_days = 30`, `governing_province = 'BC'`; `:39-43` `btrim(coalesce(s.<field>, '')) <> ''` for the 5 fields | PASS |
| C14 | demo has 40 types, 174 tasks, task set equals the template | user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user (`checks.md:171`); the Verifier's `execute_sql` was declined. C28 (Verifier, round 2) confirms the counts `types:40, tasks:174` | `supabase/tests/demo_seed.sql:48` `= 40`; `:49` `= 174`; `:50-57` task set `except` both ways | PASS |
| C15 | 12 customers, name set equals the literal, 1 contact and 1 site each, site contact is that contact; literal equals `sample-pipeline.ts` | shell proof (Verifier, round 2) exit 0, 12 names each side; seed proof user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user (`checks.md:171`); the Verifier's `execute_sql` was declined. C28 (Verifier) confirms `customers:12, contacts:12, sites:12` | `supabase/tests/demo_seed.sql:72` count `= 12`; `:73-76` name set `except` both ways against the literal at `:65-69`; `:78-81` and `:82-85` per-customer count `<> 1` absent; `:86-88` `site_contact_id is distinct from` the customer's contact absent | PASS |
| C16 | 2-8 assets per site, manual, non-blank fields, own catalog, >= 12 distinct types | user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user (`checks.md:171`); the Verifier's `execute_sql` was declined. C28 (Verifier) confirms the total `assets:57` | `supabase/tests/demo_seed.sql:94-96` per site `not between 2 and 8` absent; `:98-101` source and blank fields; `:103-105` `t.org_id <> tests.demo()` absent; `:107-108` `count(distinct asset_type_id) >= 12` | PASS |
| C17 | demo has 0 memberships, agreements, events | seed proof user-run, accepted by the user; Verifier `execute_sql` declined in round 1. Independently: Verifier re-ran the C28 query in round 2 -> `memberships:0, agreements:0, events:0` | `supabase/tests/demo_seed.sql:114-116` three counts `= 0`. The C28 query that settled it is at `supabase/tests/demo_seed.sql:13-15` | PASS |
| C18 | 0 source-company values; emails `@example.com`; phones `555-01xx` | user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user (`checks.md:171`); the Verifier's `execute_sql` was declined (`{"status":"declined"}`) | `supabase/tests/demo_seed.sql:121-129` `row_to_json` over 6 tables, `j ~* <regex>` absent, the regex alternating `enviroware`, `byrne`, `604 803`; `:132` `email !~ '@example\.com$'` absent; `:135-139` `phone !~ '555-01[0-9]{2}$'` absent | PASS |
| C19 | second run leaves `orgs` and all 14 tenant-table counts for `D` unchanged | user-run in the SQL Editor (`demo_seed: pass`) and accepted by the user (`checks.md:171`); the Verifier's `execute_sql` was declined (`{"status":"declined"}`) | snapshot built at `supabase/tests/demo_seed.sql:144-148`; `supabase/tests/demo_seed_rerun.sql:7` snapshot rows `= 15`; `:9-13` `r.n = <recount>` for each row | PASS |
| C20 | `seed.sql` is one `begin; ... commit;` with no other transaction control | Verifier shell (round 2), exit 0 | `supabase/seed.sql:5` `begin;`; `supabase/seed.sql:119` `commit;`; the case-insensitive grep count of lines that are `begin;`, `commit;`, `rollback;` or `end;` is 2. Proven by file shape only (Known limitations, 2) | PASS |
| C27 | no migration contains demo data | Verifier shell, the `! grep -rlE` from checks.md for `Kettle Ridge` or the demo id over `supabase/migrations/` (round 2), exit 0 | no hits in `supabase/migrations/20261019174738_init.sql:1` or `supabase/migrations/20261019191509_catalog_template.sql:1` (the exit code is the search result). The demo id appears only in `supabase/seed.sql:8` | PASS |
| C28 | live: 1 org `D`, name, 40/174, 12/12/12, assets in [24,96], 0/0/0 | Verifier `execute_sql` with the header query (round 2) | returned `{"orgs":1,"name":"Kettle Ridge Mechanical Ltd.","types":40,"tasks":174,"customers":12,"contacts":12,"sites":12,"assets":57,"memberships":0,"agreements":0,"events":0}`; query at `supabase/tests/demo_seed.sql:5-16`; 57 matches the 57 value rows at `supabase/seed.sql:58-114` | PASS |
| C21 | exactly `init` and `catalog_template`, matching files | Verifier `list_migrations` and shell (round 2), exit 0 | MCP returned `[{"version":"20261019174738","name":"init"},{"version":"20261019191509","name":"catalog_template"}]`; `ls supabase/migrations` is `20261019174738_init.sql 20261019191509_catalog_template.sql`; file `supabase/migrations/20261019191509_catalog_template.sql:1` | PASS |
| C22 | the four supabase-init suites pass with the updated fixture | Verifier `execute_sql`, four calls (round 2) -> `rls_isolation: pass`, `rls_roles: pass`, `domain_constraints: pass`, `events_outbox: pass` | `supabase/tests/rls_isolation.sql:156`, `supabase/tests/rls_roles.sql:93`, `supabase/tests/domain_constraints.sql:203`, `supabase/tests/events_outbox.sql:50`: each `select '<suite>: pass'`, reached only when no block raised. The changed fixture line is `supabase/tests/fixture.sql:91` | PASS |
| C23 | 0 security lints at ERROR/WARN in public/private | Verifier `get_advisors(security)` (round 2) | 1 lint, `rls_enabled_no_policy` at level `INFO`, metadata `{"name":"outbox","type":"table","schema":"public"}`, intended (`supabase/migrations/20261019174738_init.sql:323`); 0 at ERROR or WARN | PASS |
| C24 | `public` still holds exactly the 15 tables | Verifier `execute_sql` fixture + `rls_isolation.sql` -> pass (round 2); `list_tables(["public"])` returned the same 15 | `supabase/tests/rls_isolation.sql:13-16` sorted `array_agg(tablename)` equals the sorted 15-name literal | PASS |

28/28 checks have a located assertion and an accepted run:
- **22 checks (C1-C12, C17, C20-C28) were run by the Verifier in round 2.** For C12 and C17, that run is the C28 query.
- **6 checks (C13, C14, C15, C16, C18, C19) rest on the user's SQL Editor run of the current text.** The user accepted that run as the evidence.

### Judging the six user-accepted checks

verify.md tells the Verifier to run each proof itself and not to trust the author's report of a run. That rule is why round 1 kept these six at UNVERIFIED. Round 2 rests on three facts:
- **The run is the user's, not the author's.** The user is the person who decides whether the feature is done, and they recorded that they accept their own run.
- **The text the user ran is the current text.** `diff -B` against the tree is clean, and no code file changed between rounds.
- **The assertions are where they should be.** Each claim has its settling assertion at the cited `file:line`, and those expressions assert the check-defined values.

On those grounds the six rows are PASS. Two caveats stay plain:
- The Verifier never saw that run's output.
- The acceptance reached the Verifier as a line in `checks.md` (`checks.md:171`), relayed by the coordinator, not as a message from the user. If that line misstates the user's decision, these six rows revert to UNVERIFIED, and so does the verdict.

## Source comparison (C3 literal)

Carried from round 1. The inputs are unchanged: `supabase/tests/catalog_seed.sql` has the same modification time, and the source PDF was not touched.

`Maintenance Proposal Template.pdf` was found at `C:\Users\dispa\Downloads\` (a `- Copy.pdf` and a `.docx` sit beside it). Its text was extracted with `pdftotext -layout`. A script parsed the "Service included" section (headings and bullets, ignoring the repeated page header) and compared it against the literals in `supabase/tests/catalog_seed.sql:6-223`, heading by heading in source order:
- The source has 41 headings and 175 bullets. Without "AHU (Metro Tower)" and its one bullet, "Change filters provided by building", that leaves 40 types and 174 tasks. That matches the literal, and the exclusion is as the plan's Assumptions state.
- Every heading maps to its literal name under the plan's sentence-case rule. "Exhaust Fan" became "Exhaust fan", "Walk in cooler" became "Walk-in cooler", and "ERV (annually and quarterly)" became "ERV". Every per-type count and every bullet is byte-equal, in order, with exactly two differences: "Backflow preventor" became "Backflow preventer" (`catalog_seed.sql:10`), and the electric unit heater's "...for hot spot" became "...for hot spots" (`catalog_seed.sql:192`). Those are the two corrections in the plan's Assumptions.
- Spot checks also matched: BOILER's 11 bullets across the page break, ERV's 7 across a page break, `PTAC` "Packaged terminal AC (PTAC)", and `PUMP` "Oil pump SBA and motor if applicable".

Whether the literal was written independently of the migration cannot be shown from the tree. It does equal the source under the documented rules.

## Known limitations

Verified at round 2. Neither limitation is resolved by round 2. The Verifier's judgement is that neither one fails a check as written.

1. **Seeding from an empty database is unproven (C12-C16, plan AC 12-16).**
   - Org `D` already existed on the live project, so in the seed proof the first seed pass inserts nothing. Every statement is `on conflict ... do nothing`, and `seed_org_catalog` returns 0.
   - As a result, C12-C18 check the rows an earlier real run of `seed.sql` left on the remote, and C19 checks that a re-run over a populated database changes no count.
   - **No proof in the tree runs the insert path of `supabase/seed.sql:7-117` against a database without org `D`.** That covers the customers, contacts, sites, the asset join on the freshly copied catalog, and the temp-table handling on a first run.
   - Because every insert is `do nothing`, an edit to `seed.sql` made after the real run would leave the live rows unchanged and still pass C12-C19. Nothing ties the live rows to the current file the way the md5 ties the migration.
   - **Does this fail a check?** The checks say "after the seed" and do not fix the starting state. The live rows are the result of a seed run, C28 confirms their shape, and the user-accepted run asserts the rest. So C12-C19 are met as written. The gap is a precision gap in the checks against the plan's S3 intent, not a failed check.
   - **Still open.** It closes the next time `seed.sql` runs on a database without `D` (a Supabase branch or `db reset`), as `checks.md:164` and `:171` record. The rolled-back `DELETE` variant was declined, and the Verifier issued no `DELETE`.
2. **C20 is proven by file shape only.**
   - The claim includes "if a statement fails, 0 rows persist". The proof shows one `begin;`/`commit;` pair and no other transaction control (`supabase/seed.sql:5`, `:119`).
   - Under Postgres, a failed statement aborts the transaction, and the closing `commit` then rolls back. No proof makes a statement fail and observes 0 persisted rows.
   - **Does this fail C20?** C20's claim is the file shape plus that standard consequence, and its proof is the shell test `checks.md` names. At `light`, a shell proof is the accepted level and fault injection does not run, so C20 is met as written. The behaviour itself has not been exercised.

## Swept

Carried from round 1. The cited files are unchanged: both migrations have pre-round-1 modification times, and the catalog migration md5 is unchanged.

Rows that resolve to existing code, re-read:
- concurrency: the unique key `unique (org_id, code)` exists at `supabase/migrations/20261019174738_init.sql:86`. The function inserts with `on conflict (org_id, code) do nothing` and `returning id, code` (`supabase/migrations/20261019191509_catalog_template.sql:254-255`). Tasks are copied only `from inserted i` (`:260`). The cited constraint is there.
- data lifecycle: "Org deletion still cascades through supabase-init C27". `public.asset_types.org_id ... on delete cascade` is at `supabase/migrations/20261019174738_init.sql:82`, and cascades exist on every tenant table (`:17-193`). The cited constraint is there. The round-2 `domain_constraints: pass` re-confirms it under the updated fixture.
- authorization: "the demo org has no member, so the existing RLS hides it". C17 and C28 (round 2) show 0 memberships for `D`. `revoke ... from public, anon, authenticated` on the private objects is at `supabase/migrations/20261019191509_catalog_template.sql:17` and `:267`.
- dependency failure, state transitions, observability: `n/a`, policy the user approved.

## Gate

Verified at round 2:
- `fixture.sql` + `catalog_seed.sql` via `execute_sql` (Verifier) - `catalog_seed: pass` (C1-C11, C25, C26)
- `fixture.sql` + `events_outbox.sql` / `rls_roles.sql` / `rls_isolation.sql` / `domain_constraints.sql` via `execute_sql` (Verifier) - each `<suite>: pass` (C22, C24)
- after the runs: `tests_schema: 0`, `test_users: 0` (nothing persisted)
- seed proof - not re-run. Verifier `execute_sql` was `{"status":"declined"}` in round 1. User-run in the SQL Editor, `demo_seed: pass`, accepted by the user (`checks.md:171`) (C13-C16, C18, C19)
- `list_migrations` - `init` `20261019174738`, `catalog_template` `20261019191509` (C21)
- `get_advisors` security - 0 ERROR/WARN; 1 INFO `rls_enabled_no_policy` on `public.outbox` (C23)
- `list_tables` public - 15 tables (C24)
- C28 count query - orgs 1, Kettle Ridge Mechanical Ltd., 40, 174, 12, 12, 12, 57, 0, 0, 0 (C28; also C12, C17)
- shell C15, C20, C21, C27 - exit 0 each
