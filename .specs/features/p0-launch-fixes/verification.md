# P0 launch fixes verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 88017a0^..HEAD (HEAD 2126db2)
**Round**: 2 - full (all 26 checks re-run; round 1 findings re-judged)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Landing` doors 1-3 vs `supabase/migrations/20261116120000_p0_launch_fixes.sql` and `supabase/tests/p0_launch_fixes.sql` | yes - read both | none | Door 2 cascade "deleting the version" has no assertion (only the asset side, `p0_launch_fixes.sql:198-200`) |
| plan `Surface` (3 public routes, 2 RPCs) | yes | none | - |
| plan AC 1-26 vs checks C6001-C6026 | yes | none | - |

No design-file source is marked binding in the plan. Not observed by me: the live browser runs the author reports (legal pages at 375/768/1440, Settings banner, Send gate refusal on production). C6026's second half (no horizontal scroll) and the Scope control's click path therefore rest on the author's word.

## Checks

Proofs run at HEAD: `npm run test:db p0_launch_fixes` (PASS, 1 passed 0 failed, rolled back) and one vitest invocation over 8 files, 17 files / 424 tests passed, every C60xx name listed individually as passed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C6001 | scope = AHU+RTU, uncovered = 3 with counts | test:db | `p0_launch_fixes.sql:66` `tests.p0_codes(doc,'types') = array['AHU','RTU']`, `:67` uncovered = BACKFLOW,BOILER,CHILLER, `:68` counts = 1 | PASS |
| C6002 | dropping RTU coverage drops it; assets stay | test:db | `:91` types = `array['AHU']`, `:93` 2 RTU assets remain | PASS |
| C6003 | exclusion removes one asset, asset live, other agreement keeps it | test:db | `:105` RTU = 1, `:106` `deactivated_at is null`, `:107` other agreement RTU = 2 | PASS |
| C6004 | include restores, double exclude = one row | test:db | `:114` RTU = 2, `:119` count = 1 | PASS |
| C6005 | snapshot types = draft scope, exclusion respected, no `uncovered` | test:db | `:127` snapshot types = shown, `:129` no `uncovered`/`controls`, `:131` no `RTU-1` | PASS |
| C6006 | non-current / non-draft version raises P0001, no row | test:db | `:143-145` P0001 x3, `:148` count = 1 | PASS |
| C6007 | viewer, other org, anon raise 42501 | test:db | `:153,155,157` 42501, `:161` nothing written; anon scope `:81` | PASS |
| C6008 | revise copies exclusions | test:db | `:177` copied array = `array[tests.id('p0r:R-1')]` | PASS (version-delete cascade unasserted, see Coverage) |
| C6009 | empty-line copy | vitest `-t "C6009:"` | `components/agreements/scope-controls.test.ts:46-50,52-56` `toContain("No equipment is covered until you add a service line.")` | PASS |
| C6010 | 3 uncovered -> `needs_confirmation`, no send | vitest | `app/(app)/sendAgreement.test.ts:126`; killed by mutant 2 | PASS |
| C6011 | `confirmUncovered` proceeds | vitest | `sendAgreement.test.ts:138` | PASS |
| C6012 | frozen version read from snapshot; migration leaves snapshots unchanged | vitest + (none repeatable) | App half: `infrastructure/supabase/agreements.test.ts:320-329` `source: "frozen"`, rpc not called with `agreement_service_scope`. Snapshot-unchanged half: only a one-time pre-apply replay that is not committed or replayable. Reasoned from the migration: the only `update` of `agreement_versions` is in the freeze function (`migration:195-196`), so existing snapshots are not rewritten, but no assertion proves it. | FAIL (DB half unproven) |
| C6013 | exclude / include button per asset, none for viewer / frozen | vitest | `scope-controls.test.ts:26-27` buttons by aria-label, `:34` `not.toContain("<button")`, `:43` `toBe("")`. Click handler never asserted (mutant 6 survived). | FAIL (surviving mutant) |
| C6014 | 3 empties named, table-driven | vitest | `company-details.test.ts:12-16` | PASS |
| C6015 | unconfirmed | vitest | `company-details.test.ts:20` | PASS |
| C6016 | 4 placeholders refused, 3 real values ready | vitest | `company-details.test.ts:29,33,37`; killed by mutant 1 | PASS |
| C6017 | `company_unconfirmed`, recipient and sender untouched | vitest | `sendAgreement.test.ts:151` (4 cases); killed by mutant 5 | PASS |
| C6018 | confirmedAt stamped only with real values; only owner/admin can stamp | vitest + test:db | `settings.test.ts:56,67`; killed by mutant 4. Role: `p0_launch_fixes.sql:207` estimator 0 rows, `:211` viewer 0 rows, `:215` owner 1 row | PASS |
| C6019 | dialog names failing details and links /settings | vitest | `scope-controls.test.ts:68,75` | PASS |
| C6020 | settings banner | vitest | `settings/page.test.ts:81,85` | PASS |
| C6021 | backfill confirms real org, leaves demo and phoneless null | none repeatable | Declared one-time pre-apply replay on 2026-11-16, not committed, cannot be re-run now the migration is applied (a rolled-back recipe cannot re-run an `update` that already ran at migration time). The only located artifact is the migration `UPDATE` text (`migration:9-18`), which is the code, not a proof. Demo org "null after apply" is a production read I did not repeat. | FAIL (no replayable evidence) |
| C6022 | 3 paths not redirected, `/terms/x` still is | vitest | `session.test.ts:59`; killed by mutant 3 | PASS |
| C6023 | notice on each page, no "reviewed by a lawyer" | vitest | `legal-pages.test.ts:22-28` | PASS |
| C6024 | footer links | vitest | `legal-pages.test.ts:31` | PASS |
| C6025 | `/register` links, beside the button | vitest | `legal-pages.test.ts:36-38` | PASS |
| C6026 | no region on /security; claims traceable; no horizontal scroll | vitest + live | `legal-pages.test.ts:41-48` region list absent, `:50-61` source files exist, `signed_ip` present, no card-number field. Live scroll check: not observed by me. | PASS (scroll half author-observed only) |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| legal pages (3) | `web/app/{terms,privacy,security}/page.tsx` | each C6023 (`test.each` over 3) | - |
| rpc `agreement_service_scope` statuses (2) | plan `Surface` | 200 C6001, anon 42501 `:81` | - |
| rpc `set_scope_exclusion` statuses (5) | plan `Surface` | ok C6003, 42501 C6007, P0001 C6006, re-include C6004 | - |
| scope paths on freeze (3) | plan `Landing` door 1 | line removed C6002 (draft only), asset excluded C6005, frozen untouched C6012 | frozen-untouched DB half (C6012) has no replayable proof |
| `companyDetailsReady` problems (4 values) | `company-details.ts:4` | legalName/address/phone C6014, unconfirmed C6015 | - |
| placeholder patterns (4) | `company-details.ts:19-23` | each C6016 | - |
| new send outcomes (3) | `agreement-actions.ts` | C6010, C6011, C6017 | - |
| entity `agreement_scope_exclusions` (2 constraints + copy) | plan `Relations` / door 2 | unique pair C6004, copy C6008, cascade from asset `:200` | cascade from version delete: no assertion anywhere |
| entity `org_settings.company_confirmed_at` (2) | door 3 | set on save C6018 | backfill C6021 not replayable |
| `uncovered` never stored (1) | door 1 | C6005 `:129` | - |
| startup config: public paths (2 places) | `session.ts` PUBLIC_PATHS (read) and `content.ts` FOOTER_LINKS | C6022, C6024 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides (`companyDetailsReady`, scope function) | `company-details.ts`, `agreement_service_scope` | own-layer proof, one asserted case per decision-table row | yes - 3 empties + unconfirmed + 4 placeholders (C6014-16); join, anti-join, uncovered, inactive filter (`:189,191`) and per-version exclusion (C6001-C6004) |
| Entry point that decides nothing (legal pages) | the 3 `page.tsx` | one at the boundary, each rendered page | yes - C6023 over all 3, C6026 on /security |

## Round 1 findings re-judged

- (a) DB proofs not replayable: the recipe now targets hosted objects and passes at HEAD, so C6001-C6008 are replayable. Adequate. C6012 DB half and C6021 are NOT adequate. A "one-time pre-apply replay" leaves no committed artifact; only the author's statement says it ran. I call both unproven, not an accepted gap, because evidence-or-zero requires a located assertion. The honest exit is an owner-signed acceptance recorded in checks.md, or a rolled-back recipe that runs the backfill predicate against fixture orgs (real, demo-shaped, phoneless); it would test a copy of the `WHERE`, which is a weaker but replayable proof.
- (b) inactive-asset filter: now asserted (`:189,191`). Asset cascade now asserted (`:198-200`). Version-delete cascade still not asserted.
- (c) AC 17 role: adequate (`:207,211,215`, estimator and viewer 0 rows, owner 1 row). AC 25 traceability: adequate as a repo-existence check (`legal-pages.test.ts:50-61`); it proves the source file exists, not that each prose sentence matches it.

## Faults injected

Baseline `git status --porcelain` = `?? node_modules/`; identical after every restore (`git checkout -- <file>`; no stash).

| Mutation | Location | Killed |
| --- | --- | --- |
| placeholder phone pattern `555-01xx` -> `555-09xx` | `domain/org-settings/company-details.ts:22` | yes (C6016 placeholder phone) |
| `uncovered.length > 0` -> `> 5` | `app/(app)/agreement-actions.ts` send gate | yes (C6010) |
| drop `/privacy` from `PUBLIC_PATHS` | `infrastructure/supabase/session.ts:10` | yes (C6022 /privacy) |
| stamp `company_confirmed_at` even for a placeholder | `infrastructure/supabase/settings.ts:62` | yes (3 C6018 tests) |
| delete the `company_unconfirmed` return | `app/(app)/agreement-actions.ts` | yes (4 C6017 tests) |
| Leave out / Include button click passes `row.excluded` instead of `!row.excluded` | `components/agreements/scope-controls.tsx:72` | NO - C6013 survived (4 passed) |

SQL mutants (anti-join removed, `P0001` guard removed, role check removed, backfill predicate) were reasoned only, not injected (hosted database not touched, no scratch run). Each has a located assertion in `p0_launch_fixes.sql` that would fail, except the backfill predicate (C6021) and the version-cascade, which have none.

## Gate

`npm run test:db p0_launch_fixes` - 1 passed, 0 failed. `npx vitest run` over the 8 C60xx files - 17 files, 424 passed, 0 failed.

## Findings (all gaps)

1. C6021 - backfill has no replayable proof (`migration:9-18`); declared one-time replay is not evidence in the repo.
2. C6012 - "migration leaves every existing snapshot byte-for-byte unchanged" has no replayable proof; app half passes.
3. C6013 - surviving mutant: the click handler's `excluded` argument is never asserted; the client-to-RPC path (`setScopeExclusionAction` in `agreement-actions.ts`, `infrastructure/supabase/agreement-scope.ts`, both new) has no unit test, only the author's live run.
4. Door 2 / C6008 - cascade on version delete has no assertion (plan names both directions).
5. Not observed by me: the live browser runs (C6026 scroll at 3 widths, Settings banner, Send refusal on production, demo org null after apply).
