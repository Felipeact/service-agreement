# P0 launch fixes verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: 88017a0^..HEAD (HEAD 6699518)
**Round**: 3 - full (all 26 checks re-run at HEAD; round 2 failures re-judged)
**Verifier**: independent sub-agent (author != verifier)

Residual risk accepted, not hidden: C6021 and the "byte-for-byte" half of C6012 cannot be replayed against the migration itself (applied once to the hosted project). They are proven by restated conditions and catalog assertions, judged below as adequate but not a proof of the migration run. See the C6021 and C6012 rows.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan `Landing` doors 1-3 vs `supabase/migrations/20261116120000_p0_launch_fixes.sql` and `supabase/tests/p0_launch_fixes.sql` | yes - read both | none | - |
| plan `Surface` (3 public routes, 2 RPCs) | yes | none | - |
| plan AC 1-26 vs checks C6001-C6026 | yes | none | - |

Door 2 version-side cascade, uncovered in round 2, is now asserted at `p0_launch_fixes.sql:245`. No design-file source is marked binding in the plan. Not observed by me: the live browser runs the author reports (legal pages at 375/768/1440, Settings banner, Send gate refusal). C6026's no-horizontal-scroll half therefore rests on the author's word. I also did not read the hosted `org_settings` rows (the demo org reading null); that is the author's claim.

## Checks

Proofs at HEAD: `npm run test:db p0_launch_fixes` (PASS, 1 passed 0 failed, rolled back); one vitest invocation over 10 files / 36 matched C60xx names (61 tests passed, 0 failed, each C60xx name listed individually as passed). The C6007 adapter table (`agreement-scope.test.ts:33`) was filtered out by my C6009-C6026 pattern and is not counted; C6007 is carried by test:db.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C6001 | scope = AHU+RTU, uncovered = 3 with counts | test:db | `p0_launch_fixes.sql:66` `tests.p0_codes(doc,'types') = array['AHU','RTU']`, `:67` uncovered = BACKFLOW,BOILER,CHILLER, `:68` counts = 1 | PASS |
| C6002 | dropping RTU coverage drops it; assets stay | test:db | `:91` types = `array['AHU']`, `:93` 2 RTU assets remain | PASS |
| C6003 | exclusion removes one asset, asset live, other agreement keeps it | test:db | `:105` RTU = 1, `:106` `deactivated_at is null`, `:107` other agreement RTU = 2 | PASS |
| C6004 | include restores, double exclude = one row | test:db | `:114` RTU = 2, `:119` count = 1 | PASS |
| C6005 | snapshot types = draft scope, exclusion respected, no `uncovered` | test:db | `:127` snapshot types = shown, `:129` no `uncovered`/`controls`, `:131` no `RTU-1` | PASS |
| C6006 | non-current / non-draft version raises P0001, no row | test:db | `:143-145` P0001 x3, `:148` count = 1 | PASS |
| C6007 | viewer, other org, anon refused 42501, no row | test:db | `:153` viewer 42501, `:155` other org 42501, `:157` anon 42501, `:161` count = 0; anon scope `:81` | PASS |
| C6008 | revise copies exclusions; cascade both ways | test:db | `:177` copied = `array[R-1]`, `:179` old kept, `:200` asset cascade = 0, `:245` version cascade = 0 | PASS |
| C6009 | no line -> "No equipment is covered until you add a service line" | vitest `-t "C6009:"` | `components/agreements/scope-controls.test.ts:46,52,58` (3 tests passed) | PASS |
| C6010 | 3 uncovered, no flag -> `needs_confirmation`, no send | vitest | `app/(app)/sendAgreement.test.ts:126`; adapter `infrastructure/supabase/agreement-scope.test.ts:12`; dialog `components/agreements/scope-controls.test.ts:79` | PASS |
| C6011 | with flag sends | vitest | `sendAgreement.test.ts:138` | PASS |
| C6012 | frozen version read as `frozen`; no snapshot rewritten | vitest + test:db | `infrastructure/supabase/agreements.test.ts:320` (frozen, never asks live scope); `p0_launch_fixes.sql:229-233` `array_agg(proname) of functions whose source updates agreement_versions snapshot = array['freeze_agreement_version']`, `:234` `not has_table_privilege('authenticated','public.agreement_versions','update')`. Migration text read: its only snapshot write is inside the freeze function (`migration:196`) and the revision insert copy (`:252`); no UPDATE of existing snapshots | PASS (see C6012 judgment) |
| C6013 | exclude/include buttons per asset, none for viewer/frozen | vitest | `scope-controls.test.ts:24,32,42`; click wiring `scope-controls.click.test.tsx:42` `toHaveBeenLastCalledWith("a1", true)`, `:44` `("a2", false)`, `:50` alert text; adapter `agreement-scope.test.ts:19`; reader `agreements.test.ts:332` | PASS |
| C6014 | 3 empties each named | vitest | `domain/org-settings/company-details.test.ts:12` table over 3, `:16` | PASS |
| C6015 | unconfirmed | vitest | `company-details.test.ts:20` | PASS |
| C6016 | 4 placeholders refuse, 3 real accepted | vitest | `company-details.test.ts:29` (table), `:33`, `:37` | PASS |
| C6017 | company_unconfirmed, touches neither store | vitest | `sendAgreement.test.ts:151` (table: no row, never confirmed, demo, empty phone) | PASS |
| C6018 | confirmedAt set / omitted; role | vitest + test:db | `settings.test.ts:56` (set to clock now), `:67` (omitted for 3 shapes); `p0_launch_fixes.sql:251` estimator 0 rows, `:255` viewer 0, `:259` owner 1 | PASS |
| C6019 | dialog names failing details + `/settings` link | vitest | `components/agreements/scope-controls.test.ts:68,75` | PASS |
| C6020 | banner while unconfirmed/placeholder, absent otherwise | vitest | `app/(app)/settings/page.test.ts:81` (table), `:85` no banner | PASS |
| C6021 | backfill sets real, leaves demo and phoneless null | test:db | `p0_launch_fixes.sql:222` real org confirmed, `:223` demo `is distinct from true`, `:224` phoneless `is distinct from true`. WHERE restated at `:220-221`; byte-compared to `migration:11-17`: identical (four patterns, three non-empty guards) | PASS (see C6021 judgment) |
| C6022 | /terms /privacy /security not redirected, /terms/x redirected | vitest | `session.test.ts:59` table, 4 cases passed | PASS |
| C6023 | notice present, no "reviewed by a lawyer" | vitest | `app/legal-pages.test.ts:22` x3 | PASS |
| C6024 | footer links | vitest | `legal-pages.test.ts:29` | PASS |
| C6025 | /register links | vitest | `legal-pages.test.ts:34` | PASS |
| C6026 | no region; claims sourced; no horizontal scroll | vitest + live | `legal-pages.test.ts:41,50`; live run not observed by me | PASS (live half: author-reported, not observed) |

### Judgment on the two round-2 DB gaps

- **C6012 (DB half)**: adequate. The claim is "the freeze function is the only code that updates a snapshot, and members hold no update" and the assertion tests exactly that over the live catalog (`pg_proc.prosrc`) and privileges, which is checkable at HEAD without replay. Weak points: the regex only catches `update public.agreement_versions ... snapshot` written in one statement with that spelling, so an aliased or dynamic-SQL writer would slip past; a SECURITY DEFINER function owned by postgres could still write. The migration text shows no snapshot UPDATE outside the freeze function, which covers the apply-time half by reading rather than by run.
- **C6021**: partial but acceptable. The assertion is a copy of the WHERE, so it would still pass if the migration's WHERE were mutated (a surviving mutant by construction, unkillable without replay). I compared the two texts and they are identical, and the TS gate (`company-details.ts:18-22`) states the same four patterns. The evidence reaches the condition's behaviour on three org shapes, not the executed UPDATE. Accepted because the migration cannot be replayed and the demo org's hosted null is the author's observation, not mine.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| public routes (3) | plan Surface | /terms /privacy /security: C6022 (redirect), C6023 (page) | - |
| `agreement_service_scope` statuses (2) | plan Surface | 200 `:66`; anon 42501 `:81` | - |
| `set_scope_exclusion` outcomes (5) | plan Surface + migration | ok `:101`; anon/viewer/other org 42501 `:153-157`; P0001 `:143-145`; re-include `:112` | - |
| scope paths on freeze (3) | plan Flow | line removed `:91`; excluded `:127`; frozen untouched C6012 | - |
| `companyDetailsReady` problems (4) | `company-details.ts:2` | legalName, address, phone C6014; unconfirmed C6015 | - |
| placeholder patterns (4) | `company-details.ts:18-22` | each in the C6016 table (`company-details.test.ts:29`) | - |
| send outcomes added (3) | `agreement-actions.ts` | needs_confirmation C6010; confirmed C6011; company_unconfirmed C6017 | - |
| `agreement_scope_exclusions` (unique pair, cascade x2, copy) | plan Landing door 2 | `:119` one row; `:200` asset cascade; `:245` version cascade; `:177` copy | - |
| `company_confirmed_at` writers (set on save, role, backfill) | plan door 3 | C6018 (`settings.test.ts:56`, `p0_launch_fixes.sql:251-259`); C6021 | - |
| door 1 `uncovered` never stored (1) | plan door 1 | `:129` | - |
| ScopeControls buttons (exclude, include, refusal) | `scope-controls.tsx:68-76` | `scope-controls.click.test.tsx:42,44,50` | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides (`companyDetailsReady`, scope function) | `company-details.ts`, `agreement_service_scope` | one at own layer; one asserted case per decision-table row | yes - 3 empties, unconfirmed, 4 placeholders (C6014-16); covered/excluded/uncovered/inactive/foreign-org (`:66-93,189-192,77`) |
| Entry point that decides nothing (legal pages) | `terms/page.tsx`, `privacy/page.tsx`, `security/page.tsx` | one at the boundary, each rendered page | yes - `legal-pages.test.ts:22` renders all three |

## Faults injected

Run in the real tree (restored from git each time; `git status --porcelain` after each shows only `?? node_modules/`, identical to baseline). No scratch worktree was used.

| Mutation | Location | Killed |
| --- | --- | --- |
| Exclude button asks `row.excluded` instead of `!row.excluded` | `web/components/agreements/scope-controls.tsx:72` | yes - `scope-controls.click.test.tsx` C6013 failed |
| Placeholder legal name pattern `/kettle ridge/i` -> `/kettle ridgeX/i` | `web/domain/org-settings/company-details.ts:19` | yes - C6016 placeholder legalName failed |
| Uncovered gate `uncovered.length > 0` -> `> 3` | `web/app/(app)/agreement-actions.ts:210` | yes - C6010 failed |

SQL mutants (reasoned, not run, hosted schema not altered): dropping the exclusion anti-join fails `:105`; setting the freeze types from `site_service_scope` fails `:127`/`:131`; the migration's backfill WHERE is not killable (see C6021).

## Gate

`npx vitest run <10 files> -t "C60(09|1\d|2[0-6]):"` - 61 passed, 0 failed; `npm run test:db p0_launch_fixes` - 1 passed, 0 failed. Not run: `validate_verification.py`, the full suite. Known unrelated failures not touched.
