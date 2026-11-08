# Item vocabulary checks

Profile: standard
Plan: `.specs/features/item-vocabulary/plan.md`

32 checks in 4 slices · 3 one-way doors · 0 open, 0 block

## How proofs run

- **SQL** recipes run with `npm run test:db item_vocabulary` from `web/` (one file, `supabase/tests/item_vocabulary.sql`, after `fixture.sql`, rolled back). Every assertion is labelled with its check id (`C2002 ...`). They need the new migration applied. `portal_view` assertions reuse the token helpers of `customer_portal.sql`.
- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C2001:`). This feature numbers from C2001 (no id above C1999 exists). `npx vitest run -t "C2001:"` selects one; a file path may be added to narrow it.
- **Default-wording proofs** (AC 8) re-run suites that already exist and assert today's copy; they must pass without an edit to any existing assertion.
- Words used by the new tests: singular `station`, plural `stations`. The forms the copy takes, fixed here so tests and code agree: the plural names the item after "&", "Search", "No ... recorded" and as a panel heading; the singular modifies a noun ("Import station list", "Station type", "Choose a station type").

## Checks

### S1 - An owner or admin sets the words · 1 migration, 5 web files · ~40 KB · ~12k

**C2001** - `validateOrgSettings` with the words `  Station ` and `STATIONS` returns `itemSingular: "station"` and `itemPlural: "stations"` (AC 1)
Proof: `npx vitest run domain/org-settings -t "C2001:"`

**C2002** - An owner and an admin each updating `org_settings` with `item_singular = 'station'`, `item_plural = 'stations'` get one row updated and the two values read back (AC 1, door 1)
Proof: `npm run test:db item_vocabulary` (assertions `C2002 ...`)

**C2003** - For both `itemSingular` and `itemPlural`, the inputs empty, spaces only, 31 letters, `Station1`, `-station`, `Sta<b>` and `Étage` each return the field message "Use 1 to 30 letters, spaces, hyphens or apostrophes, starting with a letter", and the inputs `a`, thirty letters, `walk-in` and `O'Brien area` each return no error (AC 2)
Proof: `npx vitest run domain/org-settings -t "C2003:"`

**C2004** - A direct `update` of `item_singular` to `Station`, to the empty string, to 31 letters and to `1station`, and of `item_plural` to the same four, each raises `23514` and leaves the stored value unchanged (door 1)
Proof: `npm run test:db item_vocabulary` (assertions `C2004 ...`)

**C2005** - The settings save action given `Station1` as the singular returns the field error from C2003 on `itemSingular`, keeps what the member typed, and does not call the store (AC 2)
Proof: `npx vitest run components/settings/save-action.test.ts -t "C2005:"`

**C2006** - An estimator and a viewer updating the words get zero rows updated and the stored words are unchanged (AC 3)
Proof: `npm run test:db item_vocabulary` (assertions `C2006 ...`)

**C2007** - An `org_settings` row inserted without the words reads `equipment` for `item_singular` and for `item_plural`, and the seeded demo org reads `equipment` for both (AC 4, door 1)
Proof: `npm run test:db item_vocabulary` (assertions `C2007 ...`)

**C2008** - The Company settings screen shows two fields labelled "Item, singular" and "Item, plural" holding `equipment` for a default org and `station`, `stations` for one that set them, and shows the C2003 message beside the field that failed (AC 2, AC 4)
Proof: `npx vitest run components/settings -t "C2008:"`

**C2009** - `OrgSettingsStore.save` then `get` returns the words saved, and `get` of a row holding the default returns `equipment`, `equipment` (AC 1, AC 4)
Proof: `npx vitest run infrastructure/supabase/settings.test.ts -t "C2009:"`

**C2010** - `itemWords("station", "stations")` returns `{ singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" }`, `itemWords("walk-in", "walk-ins")` capitalises to `Walk-in` and `Walk-ins`, `itemWords("equipment", "equipment")` returns `Equipment` for both capitalised forms, and the count helper returns `1 station`, `0 stations` and `2 stations` (AC 5, AC 7, door 3)
Proof: `npx vitest run domain/org-settings -t "C2010:"`

### S2 - Staff screens say the word · 0 migrations, ~30 web files · ~190 KB · ~50k

Each place check has two proofs: the new test (words `station`/`stations`: the rendered output holds no `equipment` in any casing, holds the expected word forms, and every place's empty, no-match and error states are included) and the existing suites of that place unchanged (AC 8).

**C2011** - Sidebar: the link reads "Sites & stations" (AC 5, AC 6)
Proof: `npx vitest run components/shell -t "C2011:"`
Proof: `npx vitest run components/shell`

**C2012** - Sites page: subtitle, "Ready to quote" note, "Stations" column heading, search placeholder, empty state and no-match state use the words (AC 5, AC 6)
Proof: `npx vitest run -t "C2012:"`
Proof: `npx vitest run components/sites app/(app)/sites`

**C2013** - Site register: panel heading, search label and placeholder, "Import station list" button, "No stations recorded yet" and the no-match state (AC 5, AC 6)
Proof: `npx vitest run -t "C2013:"`
Proof: `npx vitest run components/records components/sites`

**C2014** - Import flow: dropzone text, banners, progress words, extract button, review grid "Station type" label and column, the "types not recognised" heading, row messages and error messages (AC 5, AC 6)
Proof: `npx vitest run -t "C2014:"`
Proof: `npx vitest run components/imports components/review app/(app)/import-review.test.ts`

**C2015** - Agreement builder: the "Stations covered" legend, the new-agreement launcher text and its list-failed message, and the validation message "Choose at least one station type" (AC 5, AC 6)
Proof: `npx vitest run -t "C2015:"`
Proof: `npx vitest run components/agreements app/(app)/agreements.test.ts`

**C2016** - Agreement view: the "Stations" panel heading, "No stations on this site yet", "No stations were recorded for this version" and the diff field label (AC 5, AC 6)
Proof: `npx vitest run -t "C2016:"`
Proof: `npx vitest run components/agreements domain/agreement/version-diff.test.ts`

**C2017** - Global search: the heading, the prompt, and the no-match line "No customers, sites or stations match ..." (AC 5, AC 6)
Proof: `npx vitest run -t "C2017:"`
Proof: `npx vitest run components/search app/(app)/search.test.ts`

**C2018** - Task library: page, nav label "Station types", empty state and the "New station type" field (AC 5, AC 6)
Proof: `npx vitest run -t "C2018:"`
Proof: `npx vitest run components/task-library`

**C2019** - Pipeline: the subtitle and the recent-imports block (heading, empty line, "Extract stations") (AC 5, AC 6)
Proof: `npx vitest run -t "C2019:"`
Proof: `npx vitest run components/kanban`

**C2020** - The page title of Sites, of the import page, and of both their loading skeletons read "Sites & stations" and "Import station list" for the station org and today's titles for the default org (AC 6, AC 8)
Proof: `npx vitest run -t "C2020:"`

**C2021** - No string literal or JSX text under `components/` and `app/(app)/` outside tests contains the word `equipment`, except the files on a named allowlist in the test (identifiers are not strings and are not scanned) (AC 6, door 3)
Proof: `npx vitest run domain/purity.test.ts -t "C2021:"`

**C2022** - The places outside the feature still print today's wording: the extraction prompt (`infrastructure/claude`), the login page and the root layout (AC 6 "and no others")
Proof: `npx vitest run infrastructure/claude app/product-copy.test.ts`

### S3 - The agreement PDF says the word · 0 migrations, 3 web files · ~22 KB · ~7k

**C2023** - With the words `station`/`stations`, the PDF's covered-items section heading is "Stations" (AC 9)
Proof: `npx vitest run infrastructure/documents -t "C2023:"`

**C2024** - With the words set, the "not recorded" sentence reads "The stations covered by this version were not recorded", and with the default words it reads today's sentence "The equipment covered by this version was not recorded" (AC 9, AC 8)
Proof: `npx vitest run infrastructure/documents -t "C2024:"`

**C2025** - Withdrawn by the owner on 2026-11-09 ("go with recommendations"): the PDF visit schedule has no item column or heading, so the claim cannot be met without changing the default output. AC 9's schedule clause is dropped with it. Replaced by the contract PDF claim in C2023's second test: the contract's covered-items section is headed with the org's plural (AC 9 as amended)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C2023:"`

**C2026** - With the default words the PDF prints today's section heading and sentence, so the existing PDF suites pass unedited (AC 8)
Proof: `npx vitest run infrastructure/documents composition/pdf-route.test.ts app/(app)/agreements/[agreementId]/pdf/route.test.ts`

**C2027** - Rendering the PDF of a sent version, changing the org's words, then rendering again prints "Equipment" in the first and "Stations" in the second (AC 10)
Proof: `npx vitest run composition/pdf-route.test.ts -t "C2027:"`

### S4 - The customer's page says the word · 1 migration, 3 web files · ~20 KB · ~6k

**C2028** - `portal_view` for a known token on an org that set `station`/`stations` returns `tenant.itemSingular = "station"` and `tenant.itemPlural = "stations"`, beside the unchanged `name`, `address`, `phone` and `accent` (AC 11, door 2)
Proof: `npm run test:db item_vocabulary` (assertions `C2028 ...`)

**C2029** - `portal_view` for a known token on a default org returns `equipment` for both keys (AC 11, AC 4)
Proof: `npm run test:db item_vocabulary` (assertions `C2029 ...`)

**C2030** - `portal_view` for an unknown token returns SQL `null`, and `portal_view(text)` still returns `jsonb`, is executable by `anon`, and has no second overload (door 2)
Proof: `npm run test:db item_vocabulary` (assertions `C2030 ...`)

**C2031** - The portal adapter turns `tenant.itemSingular`/`itemPlural` into the view's words, and a `tenant` without the two keys gives `equipment` for both (AC 13)
Proof: `npx vitest run infrastructure/supabase -t "C2031:"`

**C2032** - The customer review page with the words set prints "Stations" as the covered-items panel heading and "No stations were recorded for this version", and with the default prints today's text (AC 12)
Proof: `npx vitest run components/review app/review -t "C2032:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| AC 6 places (9) | sidebar C2011 · Sites page C2012 · site register C2013 · import flow C2014 · agreement builder C2015 · agreement view C2016 · search C2017 · task library C2018 · pipeline C2019 | - |
| page titles (4) | Sites metadata C2020 · import metadata C2020 · Sites loading C2020 · import loading C2020 | - |
| places AC 6 leaves out (3) | extraction prompt C2022 · login page C2022 · root layout C2022 | - |
| PDF places (3) | section heading C2023 · "not recorded" sentence C2024 · contract PDF section C2023 (replaces the schedule column, C2025 withdrawn) | - |
| rejected word shapes (7) | empty C2003 · spaces only C2003 · 31 letters C2003 · `Station1` C2003 · `-station` C2003 · `Sta<b>` C2003 · `Étage` C2003 | - |
| accepted word shapes (4) | `a` C2003 · thirty letters C2003 · `walk-in` C2003 · `O'Brien area` C2003 | - |
| fields carrying the rule (2) | `item_singular` C2003 C2004 · `item_plural` C2003 C2004 | - |
| word forms (4) | singular C2010 · plural C2010 · Singular C2010 · Plural C2010 | - |
| count forms (3) | one C2010 · zero C2010 · many C2010 | - |
| roles writing the words (4) | owner C2002 · admin C2002 · estimator C2006 · viewer C2006 | - |
| `portal_view` statuses (2) | 200 object C2028 C2029 · 200 `null` C2030 | - |
| `portal_view` new keys (2) | `tenant.itemSingular` C2028 · `tenant.itemPlural` C2028 | - |
| door 1 columns (2) | `item_singular` C2004 C2007 · `item_plural` C2004 C2007 | - |
| door 2 `portal_view` contract (3) | new keys C2028 · signature and `anon` grant C2030 · adapter fallback C2031 | - |
| door 3 helper (2) | forms C2010 · no hand-made case change in screens C2021 | - |
| startup configuration (0 assemblies) | n/a - no env var, flag or assembly step is added; the migration is the only prerequisite (see Handoff) | - |

- Claims naming a status code, route or response shape: C2004 (`23514`), C2028, C2029, C2030 - each has a proof that crosses the boundary (SQL call as the real role)
- AC 7 is proven at the helper (C2010); no place in AC 6 prints a count of the item today. If the build finds one, a check is added to the place's row before the code that prints it (stop-and-ask, not an edit of C2010)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (the words validator, the helper) | one at its own layer | one asserted case per row of the decision table |
| Decides, reached across a boundary (the column check, `portal_view`) | one at the boundary **and** one at its own layer | the contract at the boundary; each rejected shape at the layer |
| Instrumentation (a screen that prints a stored word, an adapter mapping) | one render or round trip with the non-default words, plus the existing suite for the default | each place, each empty and error state of the place |

Evidence:

- `validateOrgSettings` gains 2 fields x 3 rules (empty, length, shape) = 6 branch points -> decides (C2001, C2003)
- the words helper has 2 branch points (capitalise the first letter; count equals 1) -> decides (C2010)
- the column check is one pattern on 2 columns -> decides at the database (C2004)
- screens and PDF sections replace a literal by a helper call with no conditional -> instrumentation, proven by one render each (C2011 to C2019, C2023 and C2024)
- closest analogue in the repo: the term and renewal settings (`proposalValidityDays`), validated in `domain/org-settings` and checked by a column constraint, proven at both layers

Cost: 4 decision proofs at their own layer (C2001, C2003, C2004, C2010), 1 source scan (C2021). Without these rows, a rejected word shape would be proven only by the settings screen that happens to pass through the validator.

## Swept

- validation: C2003, C2004
- failure modes: C2005 (a refused save stores nothing and keeps the member's input), C2031 (a `tenant` without the keys prints `equipment`)
- idempotency: n/a - saving the same two words again updates one row to the same values; nothing is created
- authorization: existing - `org_settings_update` limits writes to owner and admin and `org_settings_select` limits reads to the org; proven for this column by C2002, C2006
- concurrency: n/a - last write wins on a single settings row, as for every other setting; no ordering between two saves is promised
- data lifecycle: C2007 (default on insert, so no backfill); n/a for deletion - the columns go with the row (`on delete cascade`)
- dependency failure: C2031 (a deploy that serves the old `portal_view`, or any `tenant` without the keys)
- state transitions: n/a - the words have no states; there is no state machine in this feature
- observability: n/a - no logging requirement; a failed save already logs through `OrgSettingsStore.save`

## Out of scope

- Per-trade wording beyond the one noun, freezing the words into a sent version, the extraction prompt and synonym table, choosing words from a pack at signup, renaming `equipment` identifiers - see the plan's `Out of scope`

## Handoff

- Files touched: 41 non-test files under `app/`, `components/`, `infrastructure/documents`, plus `portal.ts`, `domain/agreement/document.ts`, `domain/org-settings`, `infrastructure/supabase/settings.ts` = 215 KB by `wc -c` -> ~54k tokens; new tests, the migration and `item_vocabulary.sql` ~15k; total ~70k, S1 12k + S2 50k + S3 7k + S4 6k, under the 150k budget - one builder
- Mechanism: one builder (fits)

- **Boundary:** C2001-C2024, C2026-C2032 closed at the feature's last commit; the database recipe was run with the migration inside its rolled-back transaction (`item_vocabulary: pass`), the owner applied the migration to the project on 2026-11-09 and `npm run test:db item_vocabulary` passes there (it has no `schema_migrations` row yet)
- **Settled mid-build:** 2026-11-09, owner: "go with recommendations": drop the schedule-column clause of AC 9 and C2025; localise the contract PDF, the asset form, the add-asset page and the Settings link (the C2021 allowlist keeps only the login copy and the settings help text). Verifier round 1 survivors closed with C2009 (item-words reader), C2011 (shell wiring), C2013 (placeholder), C2014 (progress words, review grid), C2015 (list-failed), C2022 (wording) and a search-query-verbatim assertion
- **Abandoned:** C2025 ("the visit schedule's item column is headed Stations"): the PDF visit schedule has no item column or heading, so the check cannot be met without a new heading that would change the default output. Not built, not edited; a stop-and-ask. Also found: the contract PDF prints the covered-items section through the same `ScopeSections` component and still says Equipment for a station org, and the asset form, the add-asset page and the Settings link were outside AC 6 and were localised on the owner's call, so the C2021 allowlist keeps only the login copy and the settings help text
