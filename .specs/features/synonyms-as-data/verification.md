# Synonyms as data verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: c29fe10..94d1d80 (HEAD); round 2 scope 62cf32d..94d1d80
**Round**: 2 - scoped (round 1 below, carried from 62cf32d)
**Verifier**: independent sub-agent (author != verifier), no inherited context


## Round 2 (scoped, verified at 94d1d80)

Scope: the fix diff (62cf32d..94d1d80) is tests only, plus a Handoff note in `checks.md`; no source or migration changed
(`git diff 62cf32d..HEAD --stat`: `synonyms_as_data.sql`, `extract.test.ts`, `extractor.test.ts`, `readers.test.ts`, `checks.md`,
`verification.md`). Everything outside the touched proofs carries forward from round 1 unchanged.

Proofs re-run in full at 94d1d80: `npm test` 184 files, 3518 tests passed; the 25 tests selected by `-t "C2101:|...|C2123:"` each printed
and passed (new: `C2101` x4 (last of several spellings `extract.test.ts:112`, middle spelling of the second of two types, punctuated
spelling, capitalised hyphenated spelling), `C2102` multi-spelling ambiguity `extract.test.ts:120-122`, `C2107` list test
`readers.test.ts:437-442`); `npm run test:db synonyms_as_data` `PASS`; lint exit 0; tsc exit 0.

New assertions located: `extract.test.ts:113-123` (`expect(matchAssetType(raw, types)).toBe(expected)` over the added rows),
`extractor.test.ts:187` `expect(system.split("
")[0]).toBe("You extract ... in these trades: ${context}.")`,
`extractor.test.ts:196-197` first sentence for null equals `"... for a service contractor."` and contains none of `null`,
`undefined`, `these trades`, `readers.test.ts:440` `expect(await ...list()).toEqual(rows)` with three spellings,
`synonyms_as_data.sql:177-180` seven bad-after-good arrays through the same table loop (both tables), `synonyms_as_data.sql:390`
org B's context must equal its own and differ from org A's.

### Faults re-injected (round 2)

| Mutation | Location | Killed |
| --- | --- | --- |
| S1: only a type's first spelling is read | `web/domain/imports/index.ts:148` | yes - C2101 (last of several, middle of the second type) |
| S2: spelling compared without `normalized` | `web/domain/imports/index.ts:148` | yes - C2101 (punctuated, capitalised hyphenated) |
| S3a: null context gives `... in these trades: .` | `web/infrastructure/claude/index.ts:15` | yes - C2121 |
| S3b: null context gives `... in these trades: null.` | `web/infrastructure/claude/index.ts:15` | yes - C2121 |
| context printed twice (round 1 non-breaching) | `web/infrastructure/claude/index.ts:15` | yes - C2120 x3 now |
| `list()` returns only each type's first spelling | `web/infrastructure/supabase/readers.ts:435` | yes - C2107 list test and C323 |
| S4: `valid_synonyms` checks only the first element | migration `:14` | yes - `C2114 catalog '{fine,Rooftop}'` |
| `valid_synonyms` drops the null-element rule (re-check) | migration `:15` | yes - `C2114 catalog '{NULL}'` |
| permissive select policy on `org_settings` | `public.org_settings` | yes - `C2127 owner context` (by row order; see G2) |
| permissive select policy on `asset_types` | `public.asset_types` | yes - `C2115 other org reads` |

SQL mutants ran through the rolled-back harness (baseline of the same harness passes). After all runs `git status --short` and
`git diff --stat` are empty. Surviving mutants: none.

### Round 1 items, judged

| Item | Round 2 status |
| --- | --- |
| S1, S2, S3, S4 (surviving mutants) | closed: each killed above |
| Test policy row 1 (decides, own layer) | met |
| Test policy row 2 (decides across a boundary) | met: S4 closed; every listed rejected shape and transition has a proof; seed and backfill are private functions with no client path, so running them as the table owner is their boundary |
| G3 (C2107 proof command misses the `list()` half) | closed: the list test now carries the `C2107:` id (`readers.test.ts:437`) |
| G1 (C2101 claim text: `ROOF-TOP  UNIT` against `rooftop unit`) | acceptable as a recorded note: the claim's wording is arithmetically false but every variant it names (case, double space, full stop, hyphen) is proven by its own row (`extract.test.ts:108-111`), so no behaviour is unproven; note is in `checks.md` Handoff |
| G4 (door 3 "letters" is ASCII only) | acceptable as a recorded note: no check claims either behaviour, so nothing is proven wrongly; it is a product question for the owner (an accented trade phrase such as "Refrigeração" is refused today), now written in `checks.md` Handoff |
| G2 (C2127 and Test policy row 3, the real adapter against the database) | still a FAIL. See below |

G2 stays a FAIL. The check's claim names "the real `supabaseAssetTypeCatalog` against the database as that role"; the proofs are
a stub for the adapter (`readers.test.ts:430-446`) and two hand-written selects in SQL (`synonyms_as_data.sql:377-390`). A wrong
column name or a PostgREST shape the adapter sends that the database refuses would pass both. The coordinator's note leaves the claim
text as approved while recording that the proof is shorter, which is a self-granted waiver; the only way this gate accepts a lower
level is the route used for C2114: the owner corrects the claim text (to "the two selects the adapter makes, run as the member, and
the adapter against a stub"), or a proof that runs the adapter against the database is added. Test policy row 3 ("one round trip") is
unmet for the same reason. The org-B context assertion is now stricter (`ctx` must equal org B's own context), but a leak is still
caught only when the leaked row happens to be read first (`limit 1`, no order). With the owner's corrected claim text, G2 and row 3
would be met and the verdict would turn PASS with no other change.


## Round 1 (carried from 62cf32d; items above supersede it where they say so)

Summary: all 27 checks have a located assertion and every named proof ran green at HEAD (3512 vitest, 26 SQL recipes
minus one known stale one). The work fails on proof strength, not on behaviour. Fault injection found 4 surviving
mutants (S1 to S4 below), 2 checks whose proof does not reach the claim as written (C2127 level gap, C2101 claim text
contradicted by the code), and 1 member the checks never pinned. The behaviours themselves were each implemented as
planned: every SQL fault on the seed, reset, backfill, registry, grants and column rules was killed, and the live demo
org matches the migration.

## Binding sources

n/a - profile `standard`, no binding design source. The plan's own text is the authority; `.specs/STATE.md` AD-160 to AD-162
and `ROADMAP.md` Phase 4.5 item 4 were read for context only and decide nothing the checks contradict.

## Proofs run at HEAD

| Command (from `web/`) | Result |
| --- | --- |
| `npx vitest run domain/imports application/use-cases/extract-import.test.ts infrastructure/claude infrastructure/supabase/readers.test.ts -t "C2101:\|...\|C2123:"` | 19 passed, each named test printed individually (C2101 x4, C2102, C2103, C2104, C2108, C2105, C2106 x2, C2122 x2, C2107, C2120 x3, C2121, C2123) |
| `npm run test:db synonyms_as_data` | `PASS synonyms_as_data` (the recipe reports one pass/fail; every labelled assertion is a `tests.ok`/`expect_error` that raises, so a pass means all ran; fault injection below shows the labels firing) |
| `npm run test:db catalog_seed type_editor task_library import_extract import_review demo_seed customer_portal` | 6 passed, 1 failed: `customer_portal` on `view tenant` (see Known failure) |
| `npm test` | 184 files, 3512 tests passed |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |

Known failure, confirmed from the code and not counted: `supabase/tests/customer_portal.sql:322` asserts the tenant object is
exactly four keys; `supabase/migrations/20261109140000_item_vocabulary.sql` (commit 7487630, an ancestor of base c29fe10)
added `itemSingular`/`itemPlural` to the portal view; the failing output shows exactly those two extra keys. The assertion at
line 322 is identical at c29fe10 and HEAD, and this feature's diff touches neither `customer_portal.sql` nor `portal_view`
(`git diff c29fe10..HEAD --stat` lists one migration, which never mentions `itemSingular` or `portal_view`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2101 | one type holding the spelling is returned after `normalized` | vitest `C2101:` x4 ran | `web/domain/imports/extract.test.ts:113` `expect(matchAssetType(raw, types)).toBe(expected)`; claim text contradicted, see Gaps G1; S1 and S2 survive | FAIL |
| C2102 | two distinct types holding a spelling give null; one type listing it twice gives the id | vitest `C2102:` ran | `extract.test.ts:117` `.toBeNull()` and `:118` `.toBe("id-CIRC")`; codes changed from the check text, disclosed and honest (see Handoff verdicts) | PASS |
| C2103 | a code or name wins over a spelling | vitest `C2103:` ran | `extract.test.ts:122` `toBe("id-CP")`, `:123` `toBe("id-RTU")` | PASS |
| C2104 | no spellings inherited by sharing a pack code | vitest `C2104:` ran | `extract.test.ts:128` `expect(matchAssetType("rooftop unit", types)).toBeNull()` | PASS |
| C2105 | rows typed through the catalog's spellings, unknown wording untyped | vitest `C2105:` ran | `web/application/use-cases/extract-import.test.ts:307` `expect(stored.map(r => [r.assetTypeRaw, r.assetTypeId])).toEqual([[...,"t-rtu"],[...,"t-ahu"],[...,null]])` | PASS |
| C2106 | either catalog read failing gives `unavailable`, no extractor call, no rows, one `Extracting import` log | vitest `C2106:` x2 ran | `extract-import.test.ts:321` `toEqual({ ok: false, code: "unavailable" })`, `:322` `extract not.toHaveBeenCalled`, `:324` `log toHaveBeenCalledTimes(1)`, `:325` `toMatch(/^Extracting import/)` | PASS |
| C2107 | adapter maps `synonyms`, reads `trade_context` (only that column) or null, throws on error | vitest `C2107:` ran (tradeContext half and both error cases); the `list()` mapping half sits in `C323:` | `web/infrastructure/supabase/readers.test.ts:440` `args: ["trade_context"]`, `:445` `rejects.toThrow("XX001")`, `:446` `rejects.toThrow("XX002")`; list mapping at `:430-433` under the name `C323`, which the check's proof command `-t "C2107:"` does not select (precision gap G3) | PASS |
| C2108 | `SYNONYMS` exported nowhere and in no `.ts`/`.tsx` under `web/` | vitest `C2108:` ran | `extract.test.ts:133` `expect("SYNONYMS" in imports).toBe(false)`, `:146` `expect(found.filter(...)).toEqual([])`; mutants S-a and S-b below killed | PASS |
| C2109 | hvac pack: 40 types, 27 with spellings equal to base `SYNONYMS`, 59 spellings, 13 empty | `synonyms_as_data` | `supabase/tests/synonyms_as_data.sql:91-93` per-code set equality loop; `:96` `= 40`; `:97` `= 27`; `:100` `total = 59`; `:105-107` 13 empties | PASS |
| C2110 | seed copies spellings; conflict keeps its own | `synonyms_as_data` | `synonyms_as_data.sql:240` `sd_syn(x,'SUMP') = {pit pump, sump}`; `:246` `sd_syn(w,'SUMP') = array['mine']` | PASS |
| C2111 | reset restores the pack's spellings, empty stays empty | `synonyms_as_data` | `synonyms_as_data.sql:265` `sd_syn(a,'RTU') = six`; `:269` `sd_syn(a,'GREASE') = '{}'` | PASS |
| C2112 | removing org A's type leaves org B's and the pack's | `synonyms_as_data` | `synonyms_as_data.sql:272-274` | PASS |
| C2113 | backfill copies pack spellings onto `hvac` types, leaves hand-made empty; live demo org equal | `synonyms_as_data`; live read re-run by the Verifier (read-only, rolled back) | `synonyms_as_data.sql:125-128` and `:131`; live: 40 types, 27 with spellings, 59 spellings, 0 differing from the pack, 0 non-hvac | PASS |
| C2114 | spelling rule: 7 bad shapes raise `23514`, whole NULL `23502`, 5 good shapes accepted, on both tables | `synonyms_as_data` | `synonyms_as_data.sql:175-185` (loop over both tables), `:181` whole null `23502`; S4 survives (every bad shape is a one-element array) | FAIL |
| C2115 | owner/admin write, estimator/viewer read only, other org and anon see and change nothing | `synonyms_as_data` | `synonyms_as_data.sql:195` `expect_rows ... 1`, `:201` `expect_rows ... 0`, `:206` other org reads 0, `:207` other org write 0, `:219` anon reads, `:226` anon writes | PASS |
| C2116 | registry holds `hvac`, unregistered pack gives `23503`, every template pack registered | `synonyms_as_data` | `synonyms_as_data.sql:282` `trade_context = 'HVAC and mechanical'`, `:283` `expect_error(... '23503')`, `:284-285` | PASS |
| C2117 | seed appends the pack phrase once; second pack appended; no settings row still seeds | `synonyms_as_data` | `synonyms_as_data.sql:299` three times, `:301` `'HVAC and mechanical, plumbing'`, `:303` again, `:306-307` no settings row | PASS |
| C2118 | backfill context: hvac org, hand-made org, empty org; live demo org | `synonyms_as_data`; live read | `synonyms_as_data.sql:133-135`; live demo org `trade_context` = `HVAC and mechanical` | PASS |
| C2119 | trade-context rule: 6 bad values `23514`, 3 good, default null | `synonyms_as_data` | `synonyms_as_data.sql:334` default null, `:337-342` six rejected, `:335-336` and `:344` accepted | PASS |
| C2120 | for 3 contexts the system prompt holds the context verbatim and 7 fixed pieces | vitest `C2120:` x3 ran | `web/infrastructure/claude/extractor.test.ts:186` `toContain(context)`, `:187` `for (piece of FIXED_PIECES) toContain(piece)` | PASS |
| C2121 | null context names no trade and keeps the 7 pieces | vitest `C2121:` ran | `extractor.test.ts:193` `for (word of ["HVAC","mechanical","plumbing","electrical"]) not.toContain(word)`, `:194`; S3 survives | FAIL |
| C2122 | extractor receives the chunk and the catalog's exact context, or null | vitest `C2122:` x2 ran | `extract-import.test.ts:336` `toHaveBeenCalledWith({ kind: "pdf", bytes: BYTES }, context)` | PASS |
| C2123 | contexts alpha/beta differ only by the context; no metadata or extra keys; arity 2 | vitest `C2123:` ran | `extractor.test.ts:203` `JSON.stringify(alpha...).replaceAll("alpha","beta") toBe JSON.stringify(beta...)`, `:204` key list, `:205` no metadata, `:206` `toHaveLength(2)` | PASS |
| C2124 | touched suites pass, only superseded assertions edited | the batched SQL and vitest runs above | six SQL recipes green; 3512 vitest green; `git diff c29fe10..HEAD -- supabase/tests/type_editor.sql` is +2 lines of setup, no assertion changed; superseded edits judged under Handoff verdicts | PASS |
| C2125 | `npm test`, lint, tsc exit 0; types list the two columns | `npm test`, lint, tsc | exit 0 each; `web/infrastructure/supabase/database.types.ts:186` `synonyms: string[]`, `:962` `trade_context: string \| null` | PASS |
| C2126 | seed and reset keep shape and grants | `synonyms_as_data` | `synonyms_as_data.sql:350-363` (shape and grants for both); mutants M13, M14, M15 killed | PASS |
| C2127 | an owner reads own spellings and context "through the app's two catalog reads (the real `supabaseAssetTypeCatalog` against the database as that role)"; org B gets none | `synonyms_as_data` | `synonyms_as_data.sql:379` spellings digest equal, `:381` `ctx = 'HVAC and mechanical'`, `:385` org B sees 0 of org A's types, `:387` `ctx is distinct from 'HVAC and mechanical'`; the real adapter is never run against the database: level gap G2 | FAIL |

## Coverage

Recomputed. The 27 hvac members were taken from `git show c29fe10:web/domain/imports/index.ts` (parsed by script: 27 keys, 59
spellings) and compared to the migration (`20261109154806_synonyms_as_data.sql:49-77`: 27 keys, 59 spellings, set-equal per
code) and to the test's copy (`synonyms_as_data.sql:62-88`: 27, 59, set-equal). The 13 empty codes were read from the live
pack (`ACID_NEUTRALIZER AIR_SEPARATOR BACKFLOW_PREVENTER CASE_COOLER CASE_FREEZER CO_SENSOR EXPANSION_TANK FIRE_DAMPER
HWT_HIGH_EFFICIENCY HWT_MID_EFFICIENCY INDIRECT_TANK PRESSURE_REGULATING_VALVE SIDE_STREAM_FILTER`) and equal the test's list at
`synonyms_as_data.sql:102-104`. The other sets come from the plan's Landing, Relations and Acceptance Criteria.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| hvac pack types with spellings (27) | base `SYNONYMS` via git, migration, test | each code, `synonyms_as_data.sql:91-93`, table-driven (data faults M23 and M25 killed) | - |
| hvac pack types without spellings (13) | live pack | each code, `synonyms_as_data.sql:105-107` (M24 killed, by the 27-count assertion first) | - |
| `matchAssetType` decision rows (6: blank, one direct, several direct, one spelling, several spelling, none) | `domain/imports/index.ts:141-151` | blank/none/several direct `extract.test.ts` C517 (existing); one direct C515; one spelling C2101; several spelling C2102 | a type holding more than one distinct spelling (S1); a spelling that itself contains punctuation or a double space (S2) |
| wording variants (4) | plan AC 1 and C2101 | `extract.test.ts:113` x4 | - |
| catalog read failures (2) | `extract-import.ts:55-60` | types and context, `extract-import.test.ts:317-325` (U2 killed) | - |
| use case to extractor (2) | `extract-import.ts:74` | string and null, `extract-import.test.ts:336` (U1 killed) | - |
| invalid spellings (6 shapes in the plan's rule + null element = 7; plus whole NULL) | plan Landing door 1, `valid_synonyms` | 7 single-element members `synonyms_as_data.sql:175-179`, whole NULL `:181` | a bad member at position 2 or later of a multi-element array (S4) |
| valid spellings (5) | plan door 1 | `synonyms_as_data.sql:182-185` | - |
| tables carrying the spelling rule (2) | migration `:25-28` | loop over both, `synonyms_as_data.sql:170-173` | - |
| roles on spellings (6) | plan AC 13 | `synonyms_as_data.sql:195-226` (M11, M12b, M21 killed) | - |
| roles on `org_settings.trade_context` writes | Swept `authorization` row | not proven by C2115 or C2127 as the Swept row says; proven for the whole row by the existing `rls_roles.sql` C12 (mutant M17 killed there) | - (Swept row wording overstated, see Swept) |
| paths that set spellings (4) | migration `:94`, `:124`, `:168`, `:151-175` | seed C2110, conflict C2110, reset C2111, backfill C2113 (M3, M5, M6, M8b killed) | - |
| paths that remove spellings (1) | `remove_task_library_type` (untouched) | C2112 `synonyms_as_data.sql:272-274` | - |
| `seed_org_catalog` context transitions (5) | migration `:139-147` | first, same again, second pack, second again, no settings row: `synonyms_as_data.sql:296-307` (M4, M18, M22 killed) | - |
| `seed_org_catalog` unknown pack (1) | migration `:120` | `type_editor.sql:328` `22023`, kept green (the check also cites `catalog_seed`, which has no `22023` assertion; the `type_editor` one is the real proof) | - |
| invalid trade contexts (6) | plan door 3 | `synonyms_as_data.sql:337-342` (M9, M9b killed) | - |
| valid trade contexts (3) | plan door 3 | `synonyms_as_data.sql:335,336,344` | - |
| backfill orgs (3) | migration `:98-102` | `synonyms_as_data.sql:133-135` (M7, M8 killed) | - |
| fixed prompt pieces (7) | `claude/index.ts` prompt array | `extractor.test.ts:187` and `:194` loop each piece with the piece as the failure label (P7 killed) | - |
| trade-context values sent (4) | plan AC 17, 18 | three values `extractor.test.ts:183-187`, null `:191-194` | the form the prompt takes for null: only a 4-word denylist is asserted (S3) |
| doors (3): 1 spellings on the type, 2 packs registered, 3 org context | plan Landing | door 1 C2109/C2114/C2115/C2113; door 2 C2116 (M10 killed); door 3 C2119/C2117 | - |
| `Relations` entities (5): pack, pack type, spelling, org type, trade context | plan Relations | C2116, C2109, C2114, C2110, C2117/C2119 | - |
| functions replaced in place (2) | migration `:111`, `:151` | C2126 `synonyms_as_data.sql:350-363` (M13 M14 M15 killed) | - |
| the app's two catalog reads against the database as a member (2) | Flow hop 1, AC 13 | SQL replicas of the two selects, `synonyms_as_data.sql:377-387`; the adapter itself only against a stub, `readers.test.ts:430-446` | the real adapter run against the database (G2) |
| startup configuration (0 assemblies) | `composition/index.ts:188` | `makeExtractImport(importJobs, importParser, claudeAssetExtractor({apiKey}), supabaseAssetTypeCatalog(supabase))` is the one assembly; no env var added; row is honest n/a | - |

Unproven members, in one list: S1, S2, S4, the null form (S3), the real adapter against the database (G2).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`matchAssetType`, prompt builder, use case hand-off) | `domain/imports/index.ts`, `claude/index.ts` (`systemPromptFor`), `extract-import.ts` | one at its own layer; one asserted case per row of the decision table | partly: every table row has a case (6 for `matchAssetType`, 2 for the prompt, 2 for the hand-off), but the cases are single-spelling and single-shape and let S1, S2 and S3 survive, so "one asserted case per row" was met by the letter and not by the decision the row makes |
| Decides, reached across a boundary (column checks, `seed_org_catalog`, `reset_task_library_type`, backfill) | `20261109154806_synonyms_as_data.sql`, `synonyms_as_data.sql` | one at the boundary and one at its own layer; the contract at the boundary; each rejected shape and each transition at the layer | partly: every transition and every listed rejected shape has a proof (all SQL faults but S4 killed), and `reset` and the write roles run as the real role (`synonyms_as_data.sql:257-276`, `:190-229`). The invalid-shape writes and the seed and backfill run only as the table owner (`reset role`, `:6`), so the two layers the row asks for collapse into one; and one rejected shape (a bad later element) is unproven (S4) |
| Instrumentation (`supabaseAssetTypeCatalog` mapping, `database.types.ts`) | `readers.ts`, `database.types.ts` | one round trip, plus the existing suite | no: "one round trip" is not there. The adapter runs only against a stub (`readers.test.ts:430-446`); the SQL recipe runs two hand-written selects, not the adapter (G2). `database.types.ts` is covered by tsc |

Verdict on the rows: the first and third are not met, the second is met for every listed transition and unmet for S4. The
build is FAIL on this alone.

## Swept re-read

- validation: C2114, C2119, C2101 exist; the cited constraints are in the migration (`:7-20`, `:42`). Precision gap G4: "letters" in
  door 3 and AC 19 is implemented as ASCII `[A-Za-z0-9]` (`:33`, `:42`), while door 1 uses `[[:alnum:]]` (`:18`, locale-dependent).
  No check says whether an accented trade phrase ("Refrigeração") must be accepted; nothing proves either behaviour.
- authorization: the Swept row says writes limited to owner/admin and "proven for the new columns by C2115 and C2127". The policies
  exist (`supabase/migrations/20261019174738_init.sql:287-293`, row-level, no column grants anywhere) and cover the new column, but
  C2115 proves it only for the spellings and C2127 proves reads only. Writes of `trade_context` by an estimator are proven only by the
  existing `rls_roles.sql` (mutant M17, a permissive update policy on `org_settings`, was killed there by `C12 update org_settings`
  and survived this feature's recipe). Overstated, not wrong.
- failure modes, idempotency, dependency failure, observability: C2106, C2117, C2110, C2107 are as cited; the `Extracting import`
  log is asserted at `extract-import.test.ts:325`.
- data lifecycle: C2113 and C2118 verified live by a Verifier read; C2112 as cited. The live read: 40 types, 27 with spellings,
  59 spellings, 0 differing from the pack, 0 non-hvac, context `HVAC and mechanical`.
- concurrency, state transitions: `n/a` rows, policy the user approved.

## Handoff verdicts (deviations the builder recorded)

- C2114 NULL case is `23502`: honest. NOT NULL is checked before CHECK (the column is `not null`, migration `:26`, `:28`), the test
  asserts `23502` at `synonyms_as_data.sql:181`, the claim text was corrected with the owner's word. Not a weakening.
- C2102 and C2103 test data (codes `CIRC`, `CP`): honest. A type coded `PUMP` matches the wording `pump` directly
  (`normalized` of the code), hiding the spelling, so the check text as first written could not exercise the claim. Same claim,
  same wordings, different codes; `extract.test.ts:117-123`.
- Superseded assertions (C2022, C520, C538 arity, C516 fixtures, C323 rows, C508/C509 second argument, C518/C519 fixtures, C551 pinned text,
  runner counts, `type_editor.sql` setup line): each rewritten from the new checks or adapted by the least change; none weakened.
  C2022 (full HVAC first sentence) is replaced by C2120 and C2121, which pin the first-sentence prefix and the other six pieces; C520 is
  replaced by C2108 and C2109 (a strictly larger claim); C538 arity goes 1 to 2 (stronger, not weaker); C508/C509 gain `, null` in the
  matcher; C518/C519 now carry the spelling they used to get from the constant with the same expected ids. One note: `extractor.test.ts:146`
  now compares the request's `system` to `systemPromptFor(null)`, computed by the code under test (the old line compared to the exported
  constant, equally self-referential), with C2121 supplying the literal pieces.
- C2127 SQL half is "the two selects the adapter makes as the member": disclosed, but not honest to the claim, see G2.
- C2124 command correction (`demo_seed`): correct, the recipe exists in `runner.mts`.

## Faults injected

TypeScript faults were applied to the real tree and reverted with the original file text (verified with `git status --short` and
`git diff --stat` after each: empty). SQL faults were run through `scratchpad` harness that sends `fixture.sql`, a `create or replace` or
`alter` mutation, then `synonyms_as_data.sql` as one rolled-back query on the hosted project (baseline run of the same harness with
no mutation: recipe passed, so the harness is faithful). Afterwards the hosted project was read: no `zz_mut` policy, original
`trade_context` constraint, original `valid_synonyms` body, `tests` schema absent. Nothing persisted.

| Mutation | Location | Killed |
| --- | --- | --- |
| spellings ignored in `matchAssetType` (`t.synonyms.some(...)` -> `false`) | `web/domain/imports/index.ts:148` | yes - C2101 x4, C2102, C2104, C516 |
| spelling match by code (hard-coded `RTU` inherits `rooftop unit`) | `web/domain/imports/index.ts:148` | yes - C2104 |
| spelling before code or name | `web/domain/imports/index.ts:145` | yes - C2103, C516 |
| two types sharing a spelling return the first | `web/domain/imports/index.ts:150` | yes - C2102 |
| `some` -> `every` | `web/domain/imports/index.ts:148` | yes - C2101, C2104, C518 |
| S1: only a type's first spelling is read (`slice(0,1).some`) | `web/domain/imports/index.ts:148` | no - survived all of domain, application, infrastructure, composition (1765 tests green) |
| S2: spelling compared without `normalized` (`synonym === wanted`) | `web/domain/imports/index.ts:148` | no - survived all of the above (1765 green) |
| `SYNONYMS` constant reintroduced in `domain/imports`; the word added as a comment in another file | `web/domain/imports/index.ts`, `web/application/use-cases/extract-import.ts` | yes - C2108 (both) |
| trade context dropped from the system prompt | `web/infrastructure/claude/index.ts:15` | yes - C2120 x3 |
| extractor ignores the context argument (`requestFor(chunk, null)`) | `web/infrastructure/claude/index.ts:139` | yes - C2120 x3 |
| a fixed sentence altered | `web/infrastructure/claude/index.ts:17` | yes - C2120 x3, C2121 |
| extra request key `metadata` carrying the context | `web/infrastructure/claude/index.ts:83` | yes - C2123, C538 x3 |
| context printed twice in the prompt | `web/infrastructure/claude/index.ts:15` | no - survived (27 green); not an AC breach, recorded for information |
| S3a: null context gives `... in these trades: .` | `web/infrastructure/claude/index.ts:15` | no - survived C2121 |
| S3b: null context gives `... in these trades: null.` | `web/infrastructure/claude/index.ts:15` | no - survived C2121 (the denylist has four trade words, none is `null`) |
| `extractImport` does not pass the context | `web/application/use-cases/extract-import.ts:74` | yes - C2122 x2, C508, C509 |
| context read failure swallowed | `web/application/use-cases/extract-import.ts:60` | yes - C2106 |
| adapter selects `id, code, name` only | `web/infrastructure/supabase/readers.ts:433` | yes - C323 (not C2107, G3) |
| context read selects `*` | `web/infrastructure/supabase/readers.ts:439` | yes - C2107 |
| context read ignores a database error | `web/infrastructure/supabase/readers.ts:439` | yes - C2107 |
| `valid_synonyms` drops the null-element rule | migration `:15` | yes - `C2114 catalog '{NULL}'` |
| `valid_synonyms` drops the lowercase rule | migration `:16` | yes - `C2114 catalog '{Rooftop}'` |
| `valid_synonyms` drops the trim rule | migration `:16` | yes - `C2114 catalog '{" rtu"}'` |
| `valid_synonyms` drops the letter-or-digit rule | migration `:18` | yes - `C2114 catalog '{"--"}'` |
| length bound 60 -> 61 and 60 -> 59 | migration `:17` | yes - `C2114` 61-character case; and a 60-character write refused |
| length lower bound 1 -> 0 | migration `:17` | no - equivalent: the alphanumeric rule already refuses an empty string |
| S4: `valid_synonyms` checks only the first element (`unnest(p_synonyms[1:1])`) | migration `:14` | no - survived the recipe |
| `execute` on `valid_synonyms` revoked from `authenticated` | migration `:23` | yes - `permission denied for function valid_synonyms` (C2115 writes as owner) |
| seed does not copy spellings | migration `:124-125` | yes - `C2110 SUMP: SUMP holds {}` |
| seed overwrites on conflict | migration `:128` | yes - `C2110 skipped return` |
| seed appends the phrase every time | migration `:143` | yes - `C2117 three times` |
| seed guard compares the whole string, not the list | migration `:143` | yes - `C2117 second again` |
| seed prepends instead of appends | migration `:144` | yes - `C2117 second pack` |
| reset does not restore spellings | migration `:168` | yes - `C2111 restored` |
| backfill does not set the context | migration `:98-102` | yes - `C2118 hvac org` |
| backfill sets the context on every org | migration `:102` | yes - `C2118 hand-made org` |
| backfill does not copy spellings | migration `:94` | yes - `C2113 RTU` |
| trade-context check allows a semicolon | migration `:42` | yes - `C2119 semicolon` |
| trade-context upper bound 200 -> 201 | migration `:42` | yes - `C2119 201` |
| foreign key from template types to packs dropped | migration `:38` | yes - `C2116 unregistered` |
| hvac pack data: a spelling removed, one added to an empty type, two swapped | the applied pack rows | yes - `C2109 HEAT_EXCHANGER`, `C2109 with spellings`, `C2109 HRV` |
| `seed_org_catalog` made `security definer`; execute granted to `authenticated` | migration `:113` | yes - both `C2126` |
| `reset_task_library_type` granted to `anon` | migration `:151` | yes - `C2126 reset grants` |
| permissive update policy on `asset_types` | policy on `public.asset_types` | yes - `C2115 uE write refused` |
| permissive select policy on `asset_types` | policy on `public.asset_types` | yes - `C2115 other org reads` |
| permissive select policy on `org_settings` | policy on `public.org_settings` | yes - `C2127 owner context` (by row order: the owner read another org's row first; the org-B context assertion at `synonyms_as_data.sql:387` allows any value but one, see G2) |
| permissive update policy on `org_settings` | policy on `public.org_settings` | no in this feature's recipe; yes in the existing `rls_roles` (`C12 update org_settings`), see Swept |

Surviving mutants that count against the feature: S1, S2, S3 (a and b), S4. The "context printed twice" mutant and the
lower-bound-0 mutant are recorded as non-breaching (the first does not violate AC 17 as written; the second is an equivalent
mutant).

Working tree after all injections: `git status --short` empty, `git diff --stat` empty.

## Gaps, ranked

1. S1 - `matchAssetType` is proven only on one-spelling lists - `web/domain/imports/index.ts:148` - C2101, C2102, C2105. A type holds up to six spellings
   (`RTU`), so reading only the first one passes all 1765 tests, including the real hvac data's shape. AC 1 says a type "holds" spellings.
   Proof needed: a type with at least two distinct spellings matched by the second.
2. S2 - the spelling is not normalised before comparing - `web/domain/imports/index.ts:148`. The DB accepts `make-up air`, `o'brien unit`
   (C2114 accepts `o'brien unit` at `synonyms_as_data.sql:183`), but the wording is `normalized` to `make up air`, so a spelling holding
   punctuation never matches once normalisation of the spelling is removed; the prior code normalised both sides. Every test spelling is already
   plain, so removing it is invisible. AC 1 reads "equal to it after `normalized`" and does not say which side. Proof needed: a spelling with a hyphen
   or a double space matched by its own wording.
3. S3 - the null prompt form is unpinned - `web/infrastructure/claude/index.ts:15`, `extractor.test.ts:193`. `... for a service contractor in these trades: null.`
   passes C2121. AC 18 says "name no trade", the check turns it into a four-word denylist. Proof needed: the exact first sentence for null.
4. S4 - the spelling rule is proven on single-element arrays only - migration `:14`, `synonyms_as_data.sql:175-179`. A validator that
   checks only element 1 passes. Proof needed: a bad element after a good one.
5. G2 - C2127 claims "the real `supabaseAssetTypeCatalog` against the database as that role"; the SQL half runs two hand-written selects
   (`synonyms_as_data.sql:377-387`) and the adapter runs only on a stub, so the adapter's real query is never executed against the database. A
   typo in a column name or a PostgREST shape error would pass both halves. The builder disclosed this (Handoff 6) but left the check text
   unchanged. The org-B context assertion (`:387`) also only requires "not org A's value", so it kills a leak only when the leaked row is read first.
6. G1 - C2101 as written ("`ROOF-TOP  UNIT` ... against spelling `rooftop unit`") cannot be true: `normalized` gives `roof top unit`, not `rooftop unit`
   (`domain/imports/index.ts:136-140`). The test quietly uses the spelling `roof top unit` (`extract.test.ts:109`). The change is right but is not in the Handoff.
7. G3 - C2107's proof command (`-t "C2107:"`) selects only the context half and the error cases; the `list()` mapping of `synonyms` is asserted under the name `C323`
   (`readers.test.ts:430-433`). Both pass, but the named proof does not reach the first half of the claim.
8. G4 - door 3 and AC 19 say "letters"; the constraint is ASCII only (`:42`). No check decides it.

Observation (not a finding): `composition/index.ts:155` exposes the same adapter's `list` as `listAssetTypes`, so spellings now ride along into
every caller of that list; tsc and the suites accept it.

## Gate

`npm test` - 3512 passed, 0 failed; `npm run lint` and `npx tsc --noEmit` exit 0; `npm run test:db` for the six touched recipes plus
`synonyms_as_data` - 7 passed; `customer_portal` fails on the pre-existing `view tenant` assertion (`supabase/tests/customer_portal.sql:322`),
not counted.
