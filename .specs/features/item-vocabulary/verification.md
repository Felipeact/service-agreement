# Item vocabulary verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: df11ced..8eeb42f
**Round**: 2 - full (every check C2001-C2032 re-run over the whole range, verified at 8eeb42f; nothing carried from round 1)
**Verifier**: independent sub-agent, Verifier for round 2 (author != verifier). I did not build this feature and did not write round 1.

## Summary

- 32 checks: 30 PASS with located evidence, C2025 withdrawn by the owner (recorded, not a check to prove), C2022 PASS with a precision gap in its Proof line.
- Faults: 21 source faults ran and 13 were killed. 8 survived (R2b, R5b, R6b, N1b, N3, N4, N5b, N7). 6 SQL faults ran (1 control, 5 mutants) and all 5 mutants were killed. Not run, because the coordinator stopped the run early: R8 (`itemText` leading `\b`) and N1c (`signing.ts`), whose patterns did not apply, and N9, H1 and H2. These are marked not run, not killed.
- Gate: vitest 183 files, 3487 passed. `tsc --noEmit` exit 0. `eslint` exit 0. `npm run test:db item_vocabulary` 1 passed. `npm run test:db type_editor catalog_seed` 2 passed.
- The verdict is FAIL because mutants survived. Every survivor is in wiring, in a defensive default, or in a place the owner added on 2026-11-09 that no check names.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2001 | validator trims and lowercases | `npx vitest run --reporter=verbose` (shown individually, passed) | `web/domain/org-settings/org-settings.test.ts:193` `toEqual(["station", "stations"])` | PASS |
| C2002 | owner and admin each update 1 row, values read back | `npm run test:db item_vocabulary` PASS | `supabase/tests/item_vocabulary.sql:38` `n = 1`, `:39` `= 'station/stations'`, `:50`, `:51` | PASS |
| C2003 | 7 rejected and 4 accepted shapes x 2 fields | same vitest run | `web/domain/org-settings/org-settings.test.ts:200` `toEqual({ [field]: WORD_MESSAGE })`, `:204` `.toBe(true)` | PASS |
| C2004 | 4 bad values x 2 columns raise 23514; value unchanged | test:db | `supabase/tests/item_vocabulary.sql:76`, `:78` `expect_error(..., '23514')`, `:81` | PASS |
| C2005 | the save action refuses Station1, keeps the input, never calls the store | vitest | `web/components/settings/save-action.test.ts:58` `not.toHaveBeenCalled()`, `:61`, `:62` | PASS |
| C2006 | estimator and viewer update 0 rows | test:db | `supabase/tests/item_vocabulary.sql:61`, `:65` `n = 0`, `:66` | PASS |
| C2007 | default on insert; demo org reads equipment | test:db | `supabase/tests/item_vocabulary.sql:20-24`, `:25-28` (not null, default) | PASS |
| C2008 | two labelled fields, values, error beside the field | vitest | `web/components/settings/settings.test.ts:220-224`, `:229-230` | PASS |
| C2009 | store save and get; the default reads equipment | vitest (2 tests) | `web/infrastructure/supabase/settings.test.ts:119`, `:128`, `:130`; reader `web/application/use-cases/item-words.test.ts:8`, `:10` | PASS |
| C2010 | 4 forms, hyphen, mass noun, counts 1/0/2, itemText | vitest (3 tests) | `web/domain/org-settings/org-settings.test.ts:209`, `:211`, `:213`, `:215`, `:222-228`, `:236-239` | PASS |
| C2011 | sidebar link "Sites & stations" | vitest (2 tests) | `web/components/shell/nav-items.test.ts:92`; shell wiring `web/app/(app)/layout.test.ts:104` `toContain("Sites &amp; stations")`, `:105` `toHaveBeenCalledWith("org-9")` | PASS |
| C2012 | Sites page copy | vitest | `web/components/vocabulary.test.ts:54-56` (the page empty and no-match states never named the item: `git show df11ced:web/components/sites/sites-list.tsx`) | PASS |
| C2013 | site register: search label and placeholder, import button, empty and no-match | vitest | `web/components/vocabulary.test.ts:64`, `:67`, `:68` `'placeholder="Search stations…"'`, `:71` | PASS |
| C2014 | import flow incl. progress words and review grid | vitest (3 tests) | `web/components/vocabulary.test.ts:97-100`; grid `:161` `"<span>Station type</span>"`, `:163`; progress `:167-170` (helper `phaseLine`; the dialog's call is unproven, R2b) | PASS |
| C2015 | legend, launcher, list-failed, validation message | vitest (3 tests) | `web/components/agreements/agreements.test.ts:715`, `:716`; `web/components/vocabulary.test.ts:105-106`, `:174-175` (helper `listNotice`; the dialog's call is unproven, R5b) | PASS |
| C2016 | agreement view heading, empty lines, diff label | vitest (2 tests) | `web/components/agreements/agreements.test.ts:726`, `:727`, `:731`, `:739` | PASS |
| C2017 | search heading, prompt, no-match line; query verbatim | vitest | `web/components/vocabulary.test.ts:114`, `:116`, `:121`, `:124` `"match “equipment”."` | PASS |
| C2018 | task library | vitest | `web/components/vocabulary.test.ts:131-136` | PASS |
| C2019 | Pipeline subtitle and recent imports | vitest | `web/components/vocabulary.test.ts:143-144`. Precision gap carried: the claim's "empty line" and "Extract stations" do not exist in `recent-imports.tsx` | PASS |
| C2020 | page and loading titles, set and default | vitest (3 tests) | `web/app/(app)/vocabulary.test.ts:23-27`, `:33-34`; `web/components/vocabulary.test.ts:149-152` | PASS |
| C2021 | no unlocalised "equipment" literal outside the allowlist | vitest | `web/domain/purity.test.ts:104` `expect(offenders).toEqual([])`. Killed N5 (a single-line literal). **Partly hollow**: N7 survived, because JSX text on its own line is not matched by `/>([^<>{}\n]*equipment…)</`, and `ITEM_COPY_LITERALS` (`:63`) exempts "Equipment type" in every file (N4) | PASS |
| C2022 | extraction prompt, login page and root layout unchanged | vitest | `web/infrastructure/claude/extractor.test.ts:167`; `web/app/product-copy.test.ts:10-12`. Precision gap: the checks.md Proof line `npx vitest run infrastructure/claude app/login` does not select `app/product-copy.test.ts` (I ran it: 2 files, only the extractor C2022 hit) | PASS |
| C2023 | agreement PDF heading "Stations"; contract PDF the same | vitest (2 tests) | `web/infrastructure/documents/agreement-pdf.test.ts:251-252`; `web/infrastructure/documents/contract-pdf.test.ts:229-231` | PASS |
| C2024 | not-recorded sentence, set and default | vitest | `web/infrastructure/documents/agreement-pdf.test.ts:257`, `:260` | PASS |
| C2025 | withdrawn by the owner on 2026-11-09 (the visit schedule has no item column); replaced by the C2023 contract test | `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C2023:"` (in the full run) | withdrawal recorded at `.specs/features/item-vocabulary/checks.md:106`, `:139`, `:197-198`; `.specs/features/item-vocabulary/plan.md:93`, `:126`; replacement proof `web/infrastructure/documents/contract-pdf.test.ts:229` | PASS (withdrawn) |
| C2026 | default PDF output unchanged; existing suites pass unedited | full vitest run | `web/infrastructure/documents/agreement-pdf.test.ts:103`, `:157`; no pre-existing expect was removed (see Other reviews) | PASS |
| C2027 | re-render after a word change: Equipment, then Stations | vitest | `web/composition/pdf-route.test.ts:120`, `:124`, `:125` | PASS |
| C2028 | portal_view returns the words beside the branding | test:db | `supabase/tests/item_vocabulary.sql:101-104` (values are `area`/`areas`, literal at the assertion) | PASS |
| C2029 | default org returns equipment | test:db | `supabase/tests/item_vocabulary.sql:115` | PASS |
| C2030 | unknown token null; one jsonb overload; anon may execute | test:db | `supabase/tests/item_vocabulary.sql:117`, `:123-126`, `:127`, `:129` | PASS |
| C2031 | adapter maps the keys; absence gives equipment | vitest | `web/infrastructure/supabase/portal.test.ts:206`, `:208` | PASS |
| C2032 | review page heading and empty line | vitest | `web/components/review/schedule.test.ts:62-64` | PASS |

## Coverage

Recomputed from the authorities: plan AC 6, AC 9, Surface and Landing, the owner's 2026-11-09 decision for the added places, and the code and database for discovered sets.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| AC 6 places (9) | plan AC 6 | C2011-C2019 (citations above) | import progress words and builder list-failed message, as the dialog renders them: only the helpers are proven (R2b, R5b) |
| staff wiring hops (3) | plan Flow hop 4 | MemberGate -> AppShell C2011 (`layout.test.ts:104`, killed R7); reader C2009 (`item-words.test.ts:8`, killed R6a) | the container line `getItemWords: itemWordsReader(settings.get)` (`web/composition/index.ts:151`): R6b survived, and every suite mocks `@/composition` |
| places the owner added on 2026-11-09 (4) | owner decision, `checks.md:197` | contract PDF renderer C2023 (`contract-pdf.test.ts:229`); add-asset page literal C2021 (N5) | contract PDF route words (N1b); asset form label (N4); add-asset page words wiring (N5b); Settings link (N7). No check names these places, and plan AC 6 still says "and no others" |
| page titles (4) | `app/(app)/sites/**` | C2020 | - |
| places AC 6 leaves out (3) | plan AC 6 | C2022 `extractor.test.ts:167`, `product-copy.test.ts:10-12` | - |
| PDF places (3, as amended) | plan AC 9 | heading C2023, sentence C2024, contract section C2023 | - |
| word shapes (7 rejected + 4 accepted) x 2 fields | checks C2003, migration regex | `org-settings.test.ts:197-205`; DB `item_vocabulary.sql:75-79` (killed m1, m5) | - |
| word forms (4), count forms (3) | `domain/org-settings/index.ts:220-260` | C2010 | - |
| roles (4) | `org_settings_update` policy | C2002, C2006 | - |
| `portal_view` statuses (2) and tenant keys (6) | plan Surface; migration `:39-41` | C2028-C2030 (killed m3, m4) | - |
| doors (3) | plan Landing | door 1 C2004/C2007 (killed m1, m2, m5); door 2 C2028-C2031; door 3 C2010/C2021 | - |
| settings store read without the words (1) | `web/infrastructure/supabase/settings.ts:31-32` (`?? DEFAULT_ITEM_WORD`, added by the fix) | none | the default branch (N3) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/org-settings/index.ts` | own layer C2001, C2003, C2010 (killed N8, N8b) | yes |
| Decides, reached across a boundary | the migration's checks, `portal_view` | boundary C2004, C2028-C2030 (SQL mutants m1-m5 killed) and own layer C2003, C2031 | yes |
| Instrumentation | screens, PDF, adapter, the store, the composition | one render with non-default words per place, plus the default suite | no - gap: the dialog's progress and notice wiring (R2b, R5b), the container wiring (R6b), the contract PDF route (N1b), the store default (N3), the asset form, add-asset page and Settings link (N4, N5b, N7) |

## Faults injected

Source faults ran in a scratch `git worktree` at 8eeb42f, with node_modules linked by junction. Each fault ran the full vitest suite and was reverted with `git checkout -- <file>`. The driver is `scratchpad/faults.cjs`. SQL faults ran in a single rolled-back transaction: fixture `begin;`, the mutation, the seed body, then `item_vocabulary.sql` ending in `rollback`. The harness refused any `commit`. After the SQL runs, a read-only query shows the remote with the original constraints and default.

| Mutation | Location | Killed |
| --- | --- | --- |
| R1 register placeholder uses the singular | `web/components/sites/site-register-view.tsx:78` | yes - C2013 |
| R2a `phaseLine` skips itemText | `web/components/agreements/new-agreement-state.ts:49` | yes - C2014 |
| R2b dialog progress line passes the default words | `web/components/agreements/new-agreement-dialog.tsx:191` | no - survived |
| R3 review grid column skips itemText | `web/components/imports/review-view.tsx:163` | yes - C2014 |
| R4 review grid cell label skips itemText | `web/components/imports/review-view.tsx:174` | yes - C2014 |
| R5a `listNotice` skips itemText | `web/components/agreements/new-agreement-state.ts:54` | yes - C2015 |
| R5b dialog list-failed notice passes the default words | `web/components/agreements/new-agreement-dialog.tsx:177` | no - survived |
| R6a `itemWordsReader` ignores stored words | `web/application/use-cases/item-words.ts:8` | yes - C2009 |
| R6b container wires the reader to a null getter | `web/composition/index.ts:151` | no - survived |
| R7 MemberGate drops `words` | `web/app/(app)/member-gate.tsx:27` | yes - C2011 (layout) |
| R8 itemText loses its leading `\b` | `web/domain/org-settings/index.ts:237` | not run - pattern did not apply; a manual probe shows "Scan equipment lists" -> "Sca station lists" with the mutant, and no current copy string has a word character before "(an )equipment" |
| N1 contract PDF drops `words` | `web/infrastructure/documents/contract-pdf.tsx:59` | yes - C2023 |
| N1b contract PDF route passes no words | `web/app/(app)/contracts/[contractId]/pdf/route.ts:30` | no - survived |
| N1c signing contract documents pass no words | `web/application/use-cases/signing.ts:126` | not run - pattern did not apply |
| N2 search line rewrites the query | `web/components/search/search-view.tsx:50` | yes - C2017 |
| N3 store default for a row without the words | `web/infrastructure/supabase/settings.ts:31` | no - survived |
| N4 asset form label literal | `web/components/records/asset-form.tsx:32` | no - survived (the literal is exempt in C2021) |
| N5 add-asset empty title literal | `web/app/(app)/sites/[siteId]/assets/new/page.tsx:26` | yes - C2021 |
| N5b add-asset page reads the wrong org's words | `web/app/(app)/sites/[siteId]/assets/new/page.tsx:20` | no - survived |
| N6 nav label ignores the words | `web/components/shell/nav-items.ts:21` | yes - C2011 (2 tests) |
| N7 Settings link text literal | `web/components/settings/settings-view.tsx:35` | no - survived (C2021 misses JSX text on its own line) |
| N8 validator stops lowercasing | `web/domain/org-settings/index.ts:123` | yes - C2003, C2005 |
| N8b validator allows digits | `web/domain/org-settings/index.ts:120` | yes - C2003, C2005 |
| N9 portal adapter swaps the keys | `web/infrastructure/supabase/portal.ts:107` | not run - stopped mid-run, file restored |
| H1, H2 C2021 hollowness probes (literal in sites-list, register) | `web/components/sites/*` | not run - stopped; N5 and N7 answer the question instead |
| m1 loosen the `item_plural` check | migration `:6` (DB) | yes - C2004 plural |
| m5 drop the `item_singular` check | migration `:5` (DB) | yes - C2004 singular |
| m2 default changed to unit/units | migration `:5-6` (DB) | yes - C2007 |
| m3 revoke anon on portal_view | migration `:83` (DB) | yes - C2028 setup (permission denied) |
| m4 portal_view without `itemPlural` | migration `:40` (DB) | yes - C2028 plural |

## Findings outside the checks

1. **Records drift.** C2025's withdrawal is recorded at plan AC 9 (`plan.md:93`), the Assumptions row (`:126`), checks C2025 (`checks.md:106`), the Coverage row (`:139`) and the Handoff (`:197-198`). Five places are stale or contradict it. Plan AC 6 (`plan.md:83`) still says "and no others", although the owner had the asset form, the add-asset page and the Settings link localised. The Handoff "Abandoned" line (`checks.md:198`) says those places "stay in the C2021 allowlist", which is false: `web/domain/purity.test.ts:51-59` removed them. Test policy evidence (`checks.md:170`) still cites C2025. The C2026 claim still names a "column". The Boundary line (`checks.md:196`) says the migration is not applied.
2. **The migration is applied but not recorded.** The remote has the columns and checks, but `supabase_migrations.schema_migrations` has no `20261109140000` row (newest `20261108195141`, read-only query). A later `supabase db push` would re-run `add column` and fail, because the migration is not idempotent.
3. **Article grammar.** `itemText` chooses "an" by the first letter (`web/domain/org-settings/index.ts:239`), so a "unit" org reads "Choose an unit list". The same rule gives "an user" and "a hour".
4. **`itemVerb` mass-noun heuristic** (`index.ts:227`): an invariant countable word such as "sheep" gets "was". Cosmetic, carried from round 1.
5. **Crash risk is closed.** The store default (`settings.ts:31-32`), the portal fallback and the `signing.ts` guard remove round 1's deploy-order crash. None of the three is proven (N3; N1c not run).

## Other reviews

- **AC 8 (default output byte-identical):** every templated replacement in the diff reproduces the old string with the default words ("was", "is", "appears", "it is", "matches", "an"). The existing suites that assert today's copy all pass (3487/3487).
- **Weakened tests:** the removed lines in test files across df11ced..HEAD are fixture lines, each replaced with the same line plus the item-word fields, and the runner counts went from 24/26 to 25/27 (`web/scripts/test-db/runner.test.ts:148`). No `expect` or `test` line was dropped, and no `.skip`, `.only` or `.todo` was added.
- **Flow and Impact:** hops 1-6 match the code. The contract PDF now carries the words, as the amended Assumptions row says. `domain/notifications`, the extraction prompt, login and `app/layout.tsx` are untouched.
- **Out of scope:** no identifier renames (`canAddEquipment` is kept), no words frozen into versions, and no pack or synonym work.
- **Swept "existing" (authorization):** `org_settings_update` holds, as proven by C2002 and C2006.
- **Lessons (step 7):** not written, because this run had to leave only verification.md modified. Suggested lessons: (a) extracting a pure helper proves the helper, not the component's call to it; (b) a source scan with a line-bound regex misses multi-line JSX text.

## Gate

`npx vitest run --reporter=verbose` - 3487 passed, 0 failed (183 files). `npx tsc --noEmit` exit 0. `npx eslint` exit 0. `npm run test:db item_vocabulary` - 1 passed, 0 failed. `npm run test:db type_editor catalog_seed` - 2 passed, 0 failed.

## Ranked gaps

1. Surviving wiring faults: R6b `web/composition/index.ts:151`; R2b and R5b `web/components/agreements/new-agreement-dialog.tsx:191`, `:177`; N1b `web/app/(app)/contracts/[contractId]/pdf/route.ts:30`.
2. Owner-added places with no check: N4 `web/components/records/asset-form.tsx:32`, N5b `web/app/(app)/sites/[siteId]/assets/new/page.tsx:20`, N7 `web/components/settings/settings-view.tsx:35`. Add them to AC 6 or to a check.
3. C2021 is partly hollow: multi-line JSX text, and the global `ITEM_COPY_LITERALS` (`web/domain/purity.test.ts:63`).
4. N3 store default unproven (`web/infrastructure/supabase/settings.ts:31`).
5. Faults not run: R8, N1c, N9.
6. Records drift (finding 1), and the migration absent from `schema_migrations` (finding 2).
