# Item vocabulary verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: df11ced..c5cd684
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier). I did not build this feature; every proof below was run by me at c5cd684.

## Summary

- 32 checks. 27 proven with located evidence (C2019 carries a precision gap; C2026 is proven for the parts that exist). 3 partly proven (C2013, C2014, C2015). 2 not proven (C2022, C2025).
- 19 source faults injected (F1-F18, with F7 split into a and b). 11 killed, 8 survived (F7a is an equivalent mutant on current copy). The SQL faults could not run (see "Database state").
- Gate: `npx vitest run` 181 files, 3479 tests passed. `npx tsc --noEmit` exit 0. `npx eslint` exit 0. SQL recipe `item_vocabulary: pass` through the rolled-back dry-run harness. `npm run test:db type_editor catalog_seed`: 2 passed, 0 failed.
- Out-of-check bugs: the search no-match line rewrites the user's query, the code crashes every staff page if it ships before the migration, and the contract PDF contradicts a plan assumption. Details are in "Findings outside the checks".

## Database state (read this first)

- At the start of the run the migration `20261109140000_item_vocabulary.sql` was not applied. The author's dry-run harness (`scratchpad/dry.cjs`) runs fixture.sql (`begin;`), then the migration, the seed body and `supabase/tests/item_vocabulary.sql` (which ends in `rollback;`), and refuses any script that contains `commit`. I ran it at HEAD and it printed `{"result":"item_vocabulary: pass"}`, exit 0. Its `alter table ... add column` would have raised had the columns existed, which confirms they were absent at that point.
- About an hour later the same harness failed with `column "item_singular" of relation "org_settings" already exists`. A read-only query (`begin read only` ... `rollback`) shows that the remote now has `item_singular` and `item_plural` (default `'equipment'`) and a `portal_view` that returns `itemSingular`. `supabase_migrations.schema_migrations` has no row for the change; its newest row is 20261108195141. **Someone other than me applied the DDL outside the migration table during this run.** All of my database work was the harness (rolled back), `npm run test:db type_editor catalog_seed` (rolled back) and read-only selects.
- I then tried `npm run test:db item_vocabulary`. The column problem was gone, but the permission layer denied the command, so I stopped all further database work. That includes the SQL fault injections. The SQL checks therefore rest on the harness run at HEAD, made before the remote changed.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2001 | validator trims and lowercases the words | `npx vitest run -t "C20" --reporter=verbose` (shown individually, passed) | `web/domain/org-settings/org-settings.test.ts:193` - `expect(result.ok && [result.value.itemSingular, result.value.itemPlural]).toEqual(["station", "stations"])` | PASS |
| C2002 | owner and admin update one row each, and the values read back | dry-run harness, `item_vocabulary: pass` | `supabase/tests/item_vocabulary.sql:38` `n = 1`, `:39` `= 'station/stations'`, `:50` `n = 1`, `:51` `= 'area/areas'` | PASS |
| C2003 | 7 rejected and 4 accepted shapes, for both fields | same vitest run (both `test.each` rows) | `web/domain/org-settings/org-settings.test.ts:200` - `expect(result.errors).toEqual({ [field]: WORD_MESSAGE })`; `:204` - `.toBe(true)` | PASS |
| C2004 | 4 bad values x 2 columns raise 23514; stored value unchanged | dry-run harness | `supabase/tests/item_vocabulary.sql:76` / `:78` - `tests.expect_error(..., '23514')`; `:81` unchanged | PASS |
| C2005 | the save action refuses Station1, keeps the input, never calls the store | same vitest run | `web/components/settings/save-action.test.ts:58` - `expect(saveOrgSettings).not.toHaveBeenCalled()`; `:61` errors equal the message on itemSingular; `:62` `.toBe("Station1")` | PASS |
| C2006 | estimator and viewer update 0 rows; words unchanged | dry-run harness | `supabase/tests/item_vocabulary.sql:61` `n = 0`, `:65` `n = 0`, `:66` unchanged | PASS |
| C2007 | a row inserted without the words, and the demo org, read equipment | dry-run harness | `supabase/tests/item_vocabulary.sql:20-25`. The harness covers both the add-column backfill (fixture orgs A and B) and the insert-default path (the seeded demo org) | PASS |
| C2008 | two labelled fields, default and set values, error beside the field | same vitest run | `web/components/settings/settings.test.ts:220-224` (labels and values), `:229-230` (message and kept input) | PASS |
| C2009 | store save writes both words; get reads back and keeps the default | same vitest run | `web/infrastructure/supabase/settings.test.ts:119` `toMatchObject({ item_singular: "station", item_plural: "stations" })`; `:128`; `:130` | PASS |
| C2010 | four forms, hyphen, mass noun, counts 1/0/2 | same vitest run (3 C2010 tests) | `web/domain/org-settings/org-settings.test.ts:209`, `:211`, `:213`, `:215` - `["1 station", "0 stations", "2 stations"]`; itemText `:222-228`, `:236-239` | PASS |
| C2011 | sidebar link reads "Sites & stations" | same vitest run, plus `components/shell` suite | `web/components/shell/nav-items.test.ts:92` - link regex `Sites &amp; stations`; `:93` no `equipment` | PASS |
| C2012 | Sites page title, subtitle, note, column, empty and no-match states | same vitest run, plus the full suite | `web/components/vocabulary.test.ts:53` (title, subtitle, note, "No stations"), `:54` `>Stations<`, `:55-56` no `equipment`. The Sites search placeholder ("Search this list…") never named the item, so it is n/a | PASS |
| C2013 | site register: panel heading, search label and placeholder, import button, empty and no-match | same vitest run | `web/components/vocabulary.test.ts:63`, `:66` `"Search stations"`, `:69`. **Placeholder not proven**: F9 (placeholder switched to the singular) survived, because `"Search stations"` is satisfied by the label. No "panel heading" exists in the register before or after the change (`git show df11ced:...site-register-view.tsx`) | PARTIAL - placeholder unproven |
| C2014 | import flow: dropzone, banners, progress words, extract button, review grid column and type label, mapping heading, row and error messages | same vitest run | `web/components/vocabulary.test.ts:95-98`. **Not proven**: progress words (F10 survived; `PHASE_TEXT` "Sending the equipment list…" / "Finding the equipment…" is never rendered); review grid column heading and cell label (F17 and F18 survived; the test renders `ReviewView` with `rows: []`, so the grid is never drawn). The "Station type" hit comes from `RowEditor` | PARTIAL - 3 members unproven |
| C2015 | legend, launcher text, list-failed message, validation message | same vitest run | `web/components/agreements/agreements.test.ts:715` "Stations covered", `:716` "Choose at least one station type", `:719`; `web/components/vocabulary.test.ts:103-105`. **List-failed message not proven**: F11 (notice skips `itemText`) survived, because no test reaches the failed-upload notice | PARTIAL - list-failed unproven |
| C2016 | agreement view: panel heading, two empty lines, diff field label | same vitest run | `web/components/agreements/agreements.test.ts:726` `<h2[^>]*>Stations</h2>`, `:727`, `:731` "No stations were recorded for this version.", `:739` `Stations: ` | PASS |
| C2017 | search: heading, prompt, no-match line | same vitest run | `web/components/vocabulary.test.ts:112`, `:114` "No customers, sites or stations match “zzz”.", `:119` `>Stations<` | PASS |
| C2018 | task library: nav label, empty state, new-type field | same vitest run | `web/components/vocabulary.test.ts:127-128`, `:130` `aria-label="Station types"`, `:132` | PASS |
| C2019 | Pipeline subtitle and recent-imports block | same vitest run | `web/components/vocabulary.test.ts:139` "from station list to signature", `:140` "Recent station imports". Precision gap: the check names an "empty line" and "Extract stations" in the recent-imports block. Neither exists in `recent-imports.tsx` (the block renders null when empty and has no Extract button) | PASS |
| C2020 | page titles and loading titles, set and default | same vitest run (3 C2020 tests) | `web/app/(app)/vocabulary.test.ts:23-27`; `web/components/vocabulary.test.ts:145-148` | PASS |
| C2021 | no unlocalised "equipment" string under components/ and app/ outside the allowlist | same vitest run | `web/domain/purity.test.ts:107` - `expect(offenders).toEqual([])`. The allowlist is judged in Findings: it hides nothing AC 6 lists, but `ITEM_COPY_LITERALS` exempts five strings in every file, not only where they are localised | PASS |
| C2022 | extraction prompt, login page and root layout still print today's wording | `npx vitest run infrastructure/claude app/login ...` (passed) | **No located assertion.** `extractor.test.ts:146` compares `system` to the `SYSTEM_PROMPT` constant itself (tautological); `login.test.ts` asserts nothing about the "from equipment list to signature" line; `app/layout.tsx` has no test. The claim is true by diff (none of the three files is touched in df11ced..HEAD), but no proof asserts it | NOT PROVEN |
| C2023 | PDF covered-items heading is "Stations" | same vitest run | `web/infrastructure/documents/agreement-pdf.test.ts:251` `toContain("Stations\n")`, `:252` | PASS |
| C2024 | not-recorded sentence, set and default | same vitest run | `web/infrastructure/documents/agreement-pdf.test.ts:257` "The stations covered by this version were not recorded"; `:260` default sentence | PASS |
| C2025 | the visit schedule's item column is headed "Stations" | none (no test named C2025 anywhere in the tree; grep shows no hit) | `web/infrastructure/documents/pdf-sections.tsx:94-117` - `ScheduleSection` prints month and names with no column heading, so the claim cannot be met without a new heading. This is a pending stop-and-ask with the owner. AC 9's third clause is unsatisfiable as written | NOT PROVEN |
| C2026 | default PDF prints today's heading, sentence and column; existing suites unedited | `npx vitest run infrastructure/documents composition/pdf-route.test.ts app/(app)/agreements/[agreementId]/pdf/route.test.ts` - 9 files, 105 tests passed | `web/infrastructure/documents/agreement-pdf.test.ts:103` slices from `lastIndexOf("Equipment")`; `:157` default sentence; existing PDF assertions unedited (diff shows only the added `words`/settings fixture fields). There is no "column" to keep (see C2025) | PASS |
| C2027 | re-render after a word change: Equipment, then Stations | same vitest run | `web/composition/pdf-route.test.ts:120` `toContain("Equipment\n")`, `:124` `toContain("Stations\n")`, `:125` | PASS |
| C2028 | portal_view returns the words beside unchanged branding | dry-run harness | `supabase/tests/item_vocabulary.sql:101-103` (values `area`/`areas`, not the claim's `station`/`stations`, but literal at the assertion; branding is a key-presence check plus `name = 'Legal A'`) | PASS |
| C2029 | default org returns equipment for both keys | dry-run harness | `supabase/tests/item_vocabulary.sql:115` | PASS |
| C2030 | unknown token null; one jsonb overload; anon may execute | dry-run harness | `supabase/tests/item_vocabulary.sql:117`, `:123`, `:127`, `:129` `has_function_privilege('anon', ...)`; calls made as `anon` at `:96`/`:111` | PASS |
| C2031 | adapter maps the keys; absence gives equipment | same vitest run | `web/infrastructure/supabase/portal.test.ts:206`, `:208` - `.toEqual({ singular: "equipment", ... })` | PASS |
| C2032 | review page heading and empty line with the words; default text otherwise | same vitest run | `web/components/review/schedule.test.ts:62` `<h2[^>]*>Stations</h2>`, `:63`, `:64`. The default is proven on the shared `ServiceScopeSections` at `web/components/agreements/agreements.test.ts:330` ("No equipment was recorded for this version."); no review-page test renders the default heading | PASS |

## Coverage

Recomputed from the authority over each set: the plan's AC text, Surface and Landing for the sets the code must satisfy, and the code or the database for the sets it discovers.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| AC 6 places (9) | plan AC 6 text | sidebar C2011; Sites page C2012; register C2013; import flow C2014; builder C2015; agreement view C2016; search C2017; task library C2018; pipeline C2019 | register placeholder (F9); import progress words (F10); review grid column and type label (F17, F18); builder list-failed message (F11) |
| AC 6 sub-elements of the import flow (11 named) | plan AC 6 text | page/meta title C2020; dropzone, banners, row and error messages, mapping heading C2014 | progress words; review grid column; type label |
| page titles (4) | `app/(app)/sites/**` page.tsx and loading.tsx | Sites meta, import meta (`app/(app)/vocabulary.test.ts:23-27`); Sites and import loading (`components/vocabulary.test.ts:145-148`) | - |
| places AC 6 leaves out (3) | plan AC 6 "and no others" | extraction prompt, login page, root layout: unchanged by diff | all 3 - no assertion (C2022) |
| PDF places (3) | plan AC 9 | heading C2023; sentence C2024 | schedule column (C2025; does not exist) |
| rejected and accepted word shapes (7+4) x fields (2) | checks C2003 / migration regex | table-driven at `org-settings.test.ts:197-205` over both fields; DB side 4 values x 2 columns at `item_vocabulary.sql:75-79` | - |
| word forms (4) and count forms (3) | `domain/org-settings/index.ts` `itemWords`, `countItems` | C2010 `:209`, `:215` | - (AC 7 proven at the helper only; no AC 6 place prints an item count) |
| roles writing the words (4) | `org_settings_update` policy, memberships roles | owner and admin C2002; estimator and viewer C2006 | - |
| `portal_view` statuses (2) | plan Surface | 200 object C2028, C2029; 200 null C2030 | - |
| `portal_view` tenant keys (6) | migration diff vs `20261102222043_proposal_expiry.sql` | name, address, phone, accent (C2028 `:103`); itemSingular, itemPlural (C2028) | - (body otherwise identical to proposal_expiry by `diff`; grant and revoke identical) |
| doors (3) | plan Landing | door 1 C2004, C2007; door 2 C2028-C2031; door 3 C2010, C2021 | - |
| staff wiring hops (2) | plan Flow hop 4 | container `getItemWords` (composition/index.ts:150-154); `MemberGate` -> `AppShell` -> `ItemWordsProvider` (member-gate.tsx:24-27, app-shell.tsx:191) | both - F13 and F14 survived. Every client-screen test injects the provider directly, so a broken wiring would leave every staff screen saying "equipment" with the suite green |
| startup configuration (0) | n/a | no env var or flag added | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/org-settings/index.ts` (validator, `itemWords`, `itemText`, `countItems`) | own layer, one per decision row: C2001, C2003, C2010 | yes |
| Decides, reached across a boundary | migration column checks; `portal_view` | boundary C2004, C2028-C2030 (harness, at HEAD) and own layer C2003, C2031 | yes - but the SQL faults could not run (database work denied), so the boundary proofs were never made to fail |
| Instrumentation (screens, PDF, adapter) | the 41 screen/PDF/adapter files | one non-default render per place and each empty/error state, plus the default suite | no - gap: 5 named AC 6 elements are never rendered with non-default words (F9, F10, F11, F17, F18), and the hop-4 wiring has no proof (F13, F14) |

## Faults injected

All faults were applied in a scratch `git worktree` at HEAD (node_modules linked by junction) and reverted with `git checkout -- <file>` after each run. The real tree's porcelain matched the empty baseline after both worktree sessions. Script: `scratchpad/faults.cjs`.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 `itemText` always writes "an" (ignores the new word) | `web/domain/org-settings/index.ts:239` | yes - C2010 articles, C2014 |
| F2 plural skips the shape check | `web/domain/org-settings/index.ts:173` | yes - C2003 (itemPlural) |
| F3 PDF `ScopeSections` heading ignores `words` | `web/infrastructure/documents/pdf-sections.tsx:142` | yes - C2023, C2027 |
| F4 portal adapter ignores the keys | `web/infrastructure/supabase/portal.ts:107` | yes - C2031 |
| F5 review page drops `words` | `web/components/review/review-view.tsx:97` | yes - C2032 |
| F6 `AgreementView` drops `words` to the scope panel | `web/components/agreements/agreement-view.tsx:220` | yes - C2015, C2016 |
| F7a `itemText` regex loses its leading `\b` | `web/domain/org-settings/index.ts:237` | no - survived (equivalent on all current copy: no "equipment" follows a word character) |
| F7b `itemText` loses the `import` alternative | `web/domain/org-settings/index.ts:237` | yes - C2019 |
| F8 `mainNav` keeps the label | `web/components/shell/nav-items.ts:21` | yes - C2011 |
| F9 register search placeholder uses the singular | `web/components/sites/site-register-view.tsx:78` | no - survived (C2013 placeholder unasserted) |
| F10 New-agreement progress words skip `itemText` | `web/components/agreements/new-agreement-dialog.tsx:200` | no - survived (C2014 progress words) |
| F11 New-agreement notice (list-failed) skips `itemText` | `web/components/agreements/new-agreement-dialog.tsx:328` | no - survived (C2015 list-failed) |
| F12 `itemWas` always "was" | `web/domain/org-settings/index.ts:230` | yes - C2016, C2024, C2032 |
| F13 container `getItemWords` ignores stored words | `web/composition/index.ts:152` | no - survived (hop 4 unproven) |
| F14 `MemberGate` does not pass `words` to `AppShell` | `web/app/(app)/member-gate.tsx:27` | no - survived (hop 4 unproven) |
| F15 `buildAgreementDocument` ignores settings words | `web/domain/agreement/document.ts:112` | yes - C2027 |
| F16 settings store `get` drops `item_plural` | `web/infrastructure/supabase/settings.ts:31` | yes - C2009 |
| F17 review grid column headings skip `itemText` | `web/components/imports/review-view.tsx:163` | no - survived (C2014 review grid column) |
| F18 review grid cell label skips `itemText` | `web/components/imports/review-view.tsx:174` | no - survived (C2014 type label) |

The planned SQL faults did not run because database commands were denied after the remote changed: dropping `itemPlural` from `portal_view`, loosening the `item_plural` check, revoking `anon`, and changing the default. The verify.md cap of five was exceeded on purpose, because the orchestrator asked for one fault per listed surface.

## Findings outside the checks

1. **The contract PDF contradicts a plan assumption.** The plan says "The contract PDF and signing page carry no item word ... checks confirm it by search", and no check does. `web/infrastructure/documents/contract-pdf.tsx:59` renders `ScopeSections` without `words`, and `web/infrastructure/documents/contract-pdf.test.ts:127` asserts "Equipment" in it. For a station org the customer sees "Stations" on the proposal PDF and the review page, and "Equipment" on the contract they sign. This does not break AC 6 or AC 9 (neither lists the contract), but the assumption is false. AD-159 records it.
2. **The search no-match line rewrites the user's query.** `web/components/search/search-view.tsx:50` passes the whole sentence, including `“${query}”`, through `itemText`. For a station org a search for "equipment" displays as `match “stations”`, and "an equipment" as "a stations". Default output is unaffected. C2017 does not exercise it.
3. **Every staff page crashes if the code ships before the migration.** `web/infrastructure/supabase/settings.ts:30-31` maps `data.item_singular` straight through. Without the columns the values are `undefined`, and `itemWords` calls `capitalise(undefined)`, which throws a TypeError (`web/domain/org-settings/index.ts:217`). `MemberGate` calls `getItemWords` on every page (`web/app/(app)/member-gate.tsx:24`), so all staff pages would fail. This is moot on the remote now (the columns exist), but it is a deploy-order hazard for any other environment. The portal adapter does fall back safely (AC 13).
4. **C2021's literal exemption applies everywhere.** `ITEM_COPY_LITERALS` (`web/domain/purity.test.ts:66`) lets "Equipment", "Equipment type" and "Sites & equipment" pass in any file as an attribute or string. Each current occurrence is localised at display (version-compare `FIELD_LABELS`, review-view `COLUMNS`, `MAIN_NAV`, `PHASE_TEXT`), so nothing is hidden today. The allowlisted files (login, the add-asset page, `asset-form.tsx`, the Settings link and help text, the illustrations comment) are all outside the AC 6 list. The allowlist hides nothing that AC 6 requires.
5. **Grammar heuristic.** `itemVerb` treats `singular === plural` as a mass noun (`web/domain/org-settings/index.ts:227`), so a countable invariant word ("sheep") gets "was" and "appears". This is cosmetic and arguably out of scope.
6. **Line form ignores the domain error text.** `web/components/agreements/line-form.tsx:104` prints a fixed `Choose at least one ${words.singular} type` instead of `errors.assetTypeIds`. Today the domain has only that one message (`web/domain/agreement/index.ts:123`), so default output is identical. A future second message would be masked.
7. **Duplicate settings reads.** Every staff request reads `org_settings` again in `MemberGate`, sequentially after the follow-up count, and again in each page. This is a performance note, not a correctness issue.

## Other reviews

- **AC 8 (default output is byte-identical):** existing suites assert today's copy across the AC 6 places. Examples: `components/sites/sites.test.ts:66,72,163`, `components/imports/imports.test.ts:219`, `components/imports/review.test.ts:160`, `components/agreements/agreements.test.ts:305,330`, `components/task-library/task-library.test.ts:72`, `components/shell/nav-items.test.ts:18`, `infrastructure/documents/agreement-pdf.test.ts:157`. All 3479 tests pass. Reading every grammar helper with the default words ("was", "appears", "it is", "matches", the article) reproduces the old strings. The aria-labels (`section aria-label={words.Plural}`, `nav aria-label`) reproduce "Equipment" and "Equipment types".
- **Edited existing tests:** the diff of every pre-existing test file removes only fixture lines, which are replaced by the same line plus `itemSingular`/`itemPlural`, `words: DEFAULT_ITEM_WORDS` or a `getItemWords` stub. The one exception is the recipe counts in `web/scripts/test-db/runner.test.ts`, which went from 24/26 to 25/27 (one recipe and one file added). No `expect`, `test` or `.skip` line was removed or weakened.
- **EARS to checks:** AC 1 C2001/C2002/C2009; AC 2 C2003/C2005/C2008; AC 3 C2006; AC 4 C2007/C2009/C2029; AC 5 C2010-C2019; AC 6 C2011-C2022; AC 7 C2010 (helper only); AC 8 C2020/C2024/C2026 plus the existing suites; AC 9 C2023-C2025; AC 10 C2027; AC 11 C2028-C2030; AC 12 C2032; AC 13 C2031. Every AC lands in a check. AC 9's column clause lands in C2025, which cannot be met.
- **Out of scope:** nothing out of scope was built. Identifiers, `/sites` and the extraction prompt are unchanged, and no words are frozen into a version.
- **Flow and Impact:** hops 1-3 and 6 match the code. Hop 4 (server props plus `ItemWordsProvider` from `AppShell`) and hop 5 (`AgreementDocument.words` top-level) match the code as the author changed them. The Impact row "nothing to backfill" holds because the add-column default fills existing rows; the harness covers that path.
- **Swept rows that resolve to existing:** authorization cites `org_settings_update` (owner and admin) and `org_settings_select`. C2002 and C2006 prove the effect, and the fixture's estimator and viewer get 0 rows. Holds.
- **Lessons (verify.md step 7):** not distilled, because `lessons.py` would write project files and this run had to leave only `verification.md` in the tree. The orchestrator should record: (a) a static render with empty rows does not prove a grid column, and (b) a test that injects a context provider does not prove the layout mounts it.

## Gate

`npx vitest run` - 3479 passed, 0 failed (181 files). `npx tsc --noEmit` exit 0. `npx eslint` exit 0. SQL: dry-run harness `item_vocabulary: pass` (at HEAD, before the remote changed). `npm run test:db type_editor catalog_seed` - 2 passed, 0 failed.

## Ranked gaps

1. C2025 not proven: the schedule has no item column - `web/infrastructure/documents/pdf-sections.tsx:94-117` (stop-and-ask).
2. Hop-4 wiring unproven: F13 and F14 survived - `web/composition/index.ts:150-154`, `web/app/(app)/member-gate.tsx:24-27`.
3. C2014 partly proven: progress words and the review grid column and type label are unrendered with words (F10, F17, F18) - `web/components/vocabulary.test.ts:89-92`.
4. C2015 partly proven: the list-failed message (F11) - `web/components/agreements/new-agreement-dialog.tsx:328`.
5. C2013 partly proven: the placeholder (F9) - `web/components/sites/site-register-view.tsx:78`.
6. C2022 has no assertion - the proof files contain none for the claimed wording.
7. Out of checks: the query rewrite (`search-view.tsx:50`), the deploy-order crash (`settings.ts:30-31`), and the false contract-PDF assumption (`contract-pdf.tsx:59`).
8. The remote database had the DDL applied outside `schema_migrations` during verification, by someone other than the Verifier.
