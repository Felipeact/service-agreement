# Database-level freeze verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: d8cdc1f..94e88a7
**Round**: 3 - scoped to F4 (proofs re-run in full at 94e88a7; everything else carried from rounds 1 and 2)
**Verifier**: independent sub-agent (author != verifier)

No screen changes, so the screen steps are one line each: no screen in the diff, no arrangement to enumerate, no user walk (step 5 not owed). Every proof below was run at HEAD (bdd6b12). The FAIL rests on two Coverage rows whose Unproven cell was written `-` but is not empty (see Coverage).

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` Phase 5 (lines 57, 323, 326; diff hunk at 322-326) | yes - read at HEAD | none: line 323 says "Not built: database-level enforcement"; line 326 records the freeze as built, not yet applied to hosted. Statuses match (canceled, unpaid, expired). The diff also flips the unrelated AI-import-token item to `[x]`, not this feature's and not a contradiction | - |
| `supabase/migrations/20261113130000_frozen_workspace.sql` | yes - lines 1-2, 26, 48-64 | none: status set `('canceled','unpaid','incomplete_expired')` (line 55) equals plan door and C5613/C5614; no `org_billing` row means never frozen (line 2) equals C5608; `subscription.deleted` sets `canceled` (line 26) equals C5612 | - |

Screens: none drawn or changed, so there is no per-screen enumeration. Plan Observable row "screen Billing, frozen owner's access" lands on AC 6, covered by C5609.

## Checks

All SQL checks: `cd web && npm run test:db db_freeze` exit 0, `PASS db_freeze`, 1 passed, 0 failed. The recipe raises on first failed assertion, so a pass means every labelled assertion ran and held. Recipe is registered at `web/scripts/test-db/runner.mts:69`. TS checks run from PowerShell.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5601 | frozen gate false for 4 roles, true when active | `test:db db_freeze` exit 0 | `supabase/tests/db_freeze.sql:60` `(select private.has_org_role(tests.id('orgA'), array[u.rol])) = false`; `:66` `= true` | PASS |
| C5602 | frozen insert 42501 per tenant table; unfrozen control inserts | same | `db_freeze.sql:91` `tests.fz_as('uA', v_sql) = 'err:42501'`; `:94` `v_ok >= 8`. Measured: 12 of 14 ran unfrozen, `contracts` is refused 42501 unfrozen and skipped (`:84-88`), so 13 frozen assertions. Control threshold is 8, the check says "at least 10" | PASS with findings F1, F3 |
| C5603 | frozen update/delete change 0 rows; control changes at least 1 | same | `db_freeze.sql:127` `v_frozen in ('rows:0','err:42501')`; `:129` same for delete; `:135` `v_exercised >= 11`. Measured 11 of 16 | PASS as worded ("every table that has fixture rows"); see Coverage F2 |
| C5604 | 6 write functions raise 42501 frozen, pass role check active | same | `db_freeze.sql:155` `r = 'err:42501'`; `:158` `r <> 'err:42501'` | PASS |
| C5605 | 37 writers contain `has_org_role(`, none the twin; none unlisted | same | `db_freeze.sql:180` `cardinality(v_names) = 37`; `:184` `p.prosrc ~ 'has_org_role\s*\('`; `:188` `not exists ... 'has_org_role_any_state'`; `:196` `v_unlisted = '{}'`. The check text says a count of 39 is asserted; the test asserts an unlisted-set empty instead, equivalent but not the stated form | PASS |
| C5606 | frozen storage insert/delete refused in `imports` and `logos`; control accepts | same | `db_freeze.sql:213` `like 'err:%'`; `:218` `= 'rows:0'`; `:215` `= 'rows:1'`; `:220` `= 'rows:1'` | PASS |
| C5607 | frozen reads return rows on every tenant table except outbox | same | `db_freeze.sql:232` `tests.count(...) >= 1` | PASS |
| C5608 | no billing row means writable | same | `db_freeze.sql:242` `private.org_is_frozen(tests.id('orgB')) = false`; `:244` `= 'rows:1'` | PASS |
| C5609 | frozen owner reads billing, invitations, list_invitations, usage, logo; estimator and viewer read no billing | same | `db_freeze.sql:261` `count(*) from public.org_billing) = 1`; `:263`; `:264` `public.org_usage() ->> 'plan' = 'starter'`; `:265`; `:269` `= 0`; `:272` `= 0` | PASS |
| C5610 | read set exactly five | same | `db_freeze.sql:285` `v_pol = array['invitations_select','logos_select','org_billing_select']`; `:289` `v_fn = array['list_invitations','org_usage']` | PASS |
| C5611 | renewal event thaws; owner writes after | same | `db_freeze.sql:301` `status ... = 'active'`; `:303` `= 'rows:1'` | PASS |
| C5612 | other org's cancel freezes only that org | same | `db_freeze.sql:316` `= 'rows:0'`; `:318` `= 'rows:1'` | PASS |
| C5613 | 8 statuses through `org_is_frozen` and `my_org_frozen` | same | `db_freeze.sql:327-328` table of 8 expected values; `:332` `org_is_frozen(...) = v_expect`; `:334` `public.my_org_frozen() = v_expect` | PASS |
| C5614 | `isEnded` over 8 statuses; `ENDED_STATUSES` has 3 members | `npx vitest run domain/billing/overview.test.ts -t "freeze status set"` - 9 passed, 37 skipped (each of the 8 rows listed individually plus the set test) | `web/domain/billing/overview.test.ts:138` `expect(isEnded(status)).toBe(frozen)`; `:141` `expect([...ENDED_STATUSES].sort()).toEqual(["canceled","incomplete_expired","unpaid"])` | PASS |
| C5615 | unknown status writable in both layers | `test:db` (same run) and `-t "unknown status"` - 1 passed | `db_freeze.sql:331-332` (label `C5615 unknown status`, `org_is_frozen = false`); `overview.test.ts:148` `expect(isEnded("something_new")).toBe(false)` | PASS |
| C5616 | doors are definer, stable, empty search_path, anon refused, authenticated allowed; signature kept | `test:db` exit 0 | `db_freeze.sql:346-350` definer/stable/search_path/anon `= false`/authenticated `= true`; `:352` signature; `:354` `= 'err:42501'` | PASS |

Also run: `npx vitest run scripts/test-db/runner.test.ts` - 26 passed (recipe count 40, 42 SQL files, `db_freeze` in `ALL`). Every named test exists in the tree (hits above) and ran; the vitest and SQL names appear in the output individually. The feature's diff touches all of them (`db_freeze.sql` new, `overview.test.ts` +28 lines).

## Coverage

Recomputed from the code and the plan, not read from checks.md. I instrumented `db_freeze.sql` with a throwaway edit (restored with `git checkout`) to expose which members the table-driven loops skip.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| roles asked of the gate (4) | plan AC 1 | all four, C5601 `:58,:64` | - |
| tenant tables inserted into (13, narrowed in round 2) | `tests.insert_sql` list; `contracts` excluded (members have no insert path, grants revoked at `20261105194705_contract_generation.sql:12`) | org_settings, customers, contacts, sites, asset_types, asset_type_tasks, assets, agreements, agreement_versions, service_lines, events, import_jobs, import_rows -> C5602 `db_freeze.sql:91` | - |
| tables with a `has_org_role` write policy and a member update or delete path (14, round 3) | init `:273-321`, `import_extract.sql:56-62`, `cadence.sql:127-133`; `contracts` and `events` excluded (grants revoked, 42501 observed) | 13 tables C5603 (control floor `>= 13`), plus `agreement_versions` delete-only C5603 (frozen `= 'rows:0'`, control `<> 'err:42501'`) | - |
| storage buckets with write policies (2) | init + storage migrations | imports C5606 `:213-220`, logos C5606 | - |
| public write functions (30) + private helpers (7) | `db_freeze.sql:165-175` | 6 end to end (C5604); 31 by source regex (C5605); level gap stated in checks.md and accepted (a gate call in a skipped branch would pass C5605) | - |
| read set kept open (5) | `db_freeze.sql:285,289` | org_billing_select, invitations_select, logos_select, list_invitations, org_usage -> C5609 `:261-265`; exactness C5610 | - |
| Stripe statuses (8) + outside (1) | plan AC 10, 11; `20261113130000:55` | C5613 over all 8 in SQL; C5614 over all 8 in TS; `something_new` C5615 in both | - |
| Stripe event types that move the status (3) | `20261113130000:26` | subscription.deleted C5612; checkout.session.completed C5611; subscription.updated via table value C5613 (existing trigger, not this change) | - |
| Landing doors (2) | plan Landing | door 1 C5601 + C5616 + `:352`; door 2 C5609 + C5610 + C5616 | - |
| roles reading `org_billing` while frozen (3) | checks.md row | owner `:261`, estimator `:269`, viewer `:272` | - |

Plan sweep for sets with no row: Impact names "16 policies in init" (the 16 above, row exists) and "about 60 call sites" (covered by the 39 count/unlisted check). Plan AC 3 buckets and AC 4 select policies have rows. No unnamed set found.

Judgment on the two stated level gaps:
- C5604 6 of 37: the Coverage rows assigning the other 31 to C5605 are earned as a source-level claim ("calls the gate"), not as behaviour. The checks say so openly, and C5601 proves the gate itself. I accept that as stated; residual risk is a gate call in a dead branch.
- C5603 11 of 16: the rows claiming all 16 tables are not earned. The check's own wording ("every table that has fixture rows") is met, but the Coverage row lists 16 members with Unproven `-`, which overstates it. For 3 of the 5 (`agreement_versions`, `contracts`, `events`) the freeze adds nothing because members have no write path. For `import_rows` and `service_line_asset_types` a member write policy on the gate exists and no freeze assertion reaches it. That is a real coverage gap, so this fails.

## Test policy rows

checks.md carries no `Test policy` rows; its section says the house pattern (`rls_roles.sql`, table-driven, one assertion per member) answers both questions and adds no rows. No section to judge. Checked against that stated convention: `db_freeze.sql` is table-driven per member and labels one assertion each, but the control floor in C5602 (8) is below the stated 10.

## Faults injected

Edits made to `supabase/migrations/20261115100000_db_freeze.sql` (the recipe replays it in a rolled-back transaction) and `web/domain/billing/overview.ts`; each restored with `git checkout -- <file>`; porcelain checked afterwards.

| Mutation | Location | Killed |
| --- | --- | --- |
| remove `and not private.org_is_frozen(p_org)` | migration `:45` | yes - `C5601 frozen owner` |
| `org_is_frozen` ignores `unpaid` | migration `:12` | yes - `C5613 org_is_frozen unpaid` |
| `org_billing_select` back to `has_org_role` | migration `:64-65` | yes - `C5609 org_billing owner` |
| `my_org_frozen` returns false | migration `:55` | yes - `C5613 my_org_frozen canceled` |
| `incomplete` added to the frozen set | migration `:12` | yes - `C5613 org_is_frozen incomplete` |
| `org_usage` back to `has_org_role` | migration `:107` | yes - `C5605 unlisted: {public.org_usage}` (first failure ends the recipe; whether `C5609 org_usage` also catches it was not isolated) |
| `logos_select` back to `has_org_role` | migration `:70-71` | yes - `C5609 logos select` |
| `has_org_role_any_state` made frozen-aware | migration `:22-31` | yes - `C5609 org_billing owner` |
| `org_is_frozen` made volatile | migration `:6` | yes - `C5616 ... stable` |
| `org_is_frozen` revoke from `anon` removed (equivalent mutant, replaced by the two grant rows below) | migration `:15` | yes - equivalent: no default grant to `anon` in `private`, so the replacement faults carry the check |
| add `grant execute ... org_is_frozen to anon` | appended to migration | yes - `C5616 private.org_is_frozen(uuid) anon` |
| add `grant execute ... has_org_role_any_state to anon` | appended to migration | yes - `C5616 private.has_org_role_any_state(uuid, text[]) anon` |
| `ENDED_STATUSES` drops `unpaid` | `web/domain/billing/overview.ts:113` | yes - `unpaid freezes: true` and the three-member set test |
| `ENDED_STATUSES` adds `incomplete` | `overview.ts:113` | yes - `incomplete freezes: false` and the set test |
| `ENDED_STATUSES` adds `something_new` | `overview.ts:113` | yes - `unknown status` test |

| Round 2: `import_rows_update` and `import_rows_delete` pointed at `has_org_role_any_state` | appended to migration | yes - `C5603 update import_rows: got rows:1` |
| Round 2: `service_line_asset_types_delete` pointed at the twin | appended to migration | yes - `C5603 delete service_line_asset_types: got rows:1` |
| Round 2: `service_line_asset_types_update` pointed at the twin | appended to migration | yes - `C5603 update service_line_asset_types: got rows:1` |
| Round 2 probe: `agreement_versions_delete` pointed at the twin | appended to migration | round 3: yes - `C5603 delete agreement_versions` (round 2 only C5610) |

Not injected: a write function with its gate swapped for the twin, because that needs editing older migrations outside the replayed copy; the C5605 twin scan is the proof there and is source-level.

After the run `git status --porcelain` shows only `?? .specs/features/reporting/` (a `plan.md` in an unrelated feature directory that was not present in the starting snapshot and is not from this run); no tracked file is modified.

## Round 2 (scoped to commits 9084380, 71ed0e7, 27a9cce)

- `cd web && npm run test:db db_freeze` at 27a9cce: exit 0, `PASS db_freeze`, 1 passed, 0 failed. The C5603 control now asserts `v_exercised >= 13` (`db_freeze.sql` C5603 block), so all 13 named tables are exercised or the recipe fails; C5602 control floor is `v_ok >= 10` (matches checks.md). C5606 uses its own `fz_job` uploading job.
- F1 resolved: C5602 set narrowed to 13 without `contracts`. Legitimate: `20261105194705_contract_generation.sql:12` revokes insert/update/delete on `contracts` from authenticated, and my diagnostic showed unfrozen insert is already 42501, so the freeze adds nothing; the writer `create_contract` is in the C5605 list. Earned.
- F3 resolved: floor is 10, measured 12.
- F2 partly resolved. `import_rows` and `service_line_asset_types` are now exercised (fixtures at `db_freeze.sql` before C5603). `events` is legitimately outside: `20261019174738_init.sql:246` revokes update, delete from authenticated (diagnostic: delete is 42501). `contracts` is legitimately outside (grants revoked, delete 42501 observed). `agreement_versions` is NOT legitimately outside for delete: `20261105`/`service_included.sql:62` revokes only `update`; the `agreement_versions_delete` policy (`init.sql:312`, `has_org_role`) remains and a member delete reaches the policy. Diagnostic as uA, unfrozen: `delete from agreement_versions` returned `err:23503` (foreign key, which is past the policy), `update` returned 42501. So the claim in checks.md C5603 and the added Coverage note, "no member update or delete path" on agreement_versions, is false for delete, and the member set should be 14, not 13.

## Findings

- F4 resolved at 94e88a7. The new C5603 block (`supabase/tests/db_freeze.sql`, after the C5603 loop) asserts `tests.fz_as('uA', v_del) <> 'err:42501'` unfrozen (control) and `tests.fz_as('uA', v_del) = 'rows:0'` frozen for `delete from public.agreement_versions`. checks.md C5603 and the Coverage row now list `agreement_versions C5603 (delete only)` as a member of a set of 14, with `contracts` and `events` as the stated exclusions (grants revoked, observed 42501 in round 2). That narrowing is now legitimate.
- Re-injected the round 2 probe, `agreement_versions_delete` pointed at `has_org_role_any_state`: killed by `C5603 delete agreement_versions: got err:23503`, a freeze-behaviour assertion, no longer only C5610. Restored with `git checkout`.
- F1, F2, F3 resolved in round 2. No open findings. Cosmetic: none left (the C5602 message now says "of 13").

## Gate

`cd web && npm run test:db db_freeze` - 1 passed, 0 failed; `npx vitest run domain/billing/overview.test.ts -t "freeze status set"` - 9 passed; `-t "unknown status"` - 1 passed; `npx vitest run scripts/test-db/runner.test.ts` - 26 passed, 0 failed. The known unrelated baseline failures were not re-run.
