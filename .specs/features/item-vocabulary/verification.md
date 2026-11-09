# Item vocabulary verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: df11ced..16af25b (fix under review: 8eeb42f..16af25b)
**Round**: 3 - scoped (every proof re-run in full at 16af25b; faults re-injected on every surface the fix touched and on every round-2 survivor or not-run fault; citations refreshed for the files the fix touched, the rest carried from 8eeb42f and marked)
**Verifier**: Verifier, independent sub-agent for round 3 (author != verifier). I did not build this feature and did not write rounds 1 or 2.

## Summary

- 32 checks: 31 PASS with located evidence; C2025 withdrawn by the owner (recorded, replaced by the contract claim under C2023).
- Faults: 24 run in a scratch worktree at 16af25b, each against the full vitest suite. 19 killed, 1 equivalent (R8), **4 survived**: R2b-d and R5b-d (the dialog bypassing `<ProgressLine>` / `<NoticeText>`), N1c (the contract sent for signature built with the default words), P4 (C2021 misses JSX text that sits next to an expression).
- Every one of the 8 round-2 survivors, injected at the surface the fix moved it to, is now killed: R6b, R2b-c, R5b-c, N1b, N3, N4, N5b, N7.
- Gate: vitest 184 files, 3494 passed, 0 failed. `tsc --noEmit` exit 0. `eslint` exit 0. `npm run test:db item_vocabulary` 1 passed. `npm run test:db type_editor catalog_seed` 2 passed.
- The verdict is FAIL because 4 non-equivalent mutants survived. This is the third round; per the bound it goes to the user, not back to a builder.

## Checks

Verified at 16af25b: every row's proof ran and passed in the one full run (`npx vitest run --reporter=verbose`, each `C20xx:` name shown individually with a pass mark, 0 non-passing hits) or in `npm run test:db`. Citations in files the fix touched are refreshed; the others are carried from 8eeb42f (those files are unchanged since, `git diff --stat 8eeb42f..HEAD`).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2001 | validator trims and lowercases | full vitest run, passed | `web/domain/org-settings/org-settings.test.ts:193` `toEqual(["station", "stations"])` (carried) | PASS |
| C2002 | owner and admin each update 1 row, values read back | `npm run test:db item_vocabulary` PASS | `supabase/tests/item_vocabulary.sql:38` `n = 1`, `:39`, `:50`, `:51` (carried) | PASS |
| C2003 | 7 rejected and 4 accepted shapes x 2 fields | full vitest run | `web/domain/org-settings/org-settings.test.ts:200` `toEqual({ [field]: WORD_MESSAGE })`, `:204` (carried) | PASS |
| C2004 | 4 bad values x 2 columns raise 23514, value unchanged | test:db | `supabase/tests/item_vocabulary.sql:76`, `:78` `expect_error(..., '23514')`, `:81` (carried) | PASS |
| C2005 | save action refuses Station1, keeps input, never calls the store | full vitest run | `web/components/settings/save-action.test.ts:58` `not.toHaveBeenCalled()`, `:61`, `:62` (carried) | PASS |
| C2006 | estimator and viewer update 0 rows | test:db | `supabase/tests/item_vocabulary.sql:61`, `:65` `n = 0`, `:66` (carried) | PASS |
| C2007 | default on insert; demo org reads equipment | test:db | `supabase/tests/item_vocabulary.sql:20-24`, `:25-28` (carried) | PASS |
| C2008 | two labelled fields, values, error beside the field | full vitest run | `web/components/settings/settings.test.ts:220-224`, `:229-230` (carried) | PASS |
| C2009 | store save/get; default reads equipment; row without the columns reads equipment | full vitest run (3 tests) | `web/infrastructure/supabase/settings.test.ts:128`, `:130`; new `:143` `toEqual(["equipment", "equipment"])` (killed N3s, N3p); reader `web/application/use-cases/item-words.test.ts:8`, `:10` | PASS |
| C2010 | 4 forms, hyphen, mass noun, counts, itemText, article by sound, catalog modifier | full vitest run (4 tests) | `web/domain/org-settings/org-settings.test.ts:209-215`, `:222-228`, `:236-239`; new `:245` `toBe("Choose a unit list")`, `:246` `toBe("Choose an hour list")`, `:248` `toBe("Your station catalog is empty.")`, `:249` default unchanged (killed A1, A2, A3) | PASS |
| C2011 | sidebar link "Sites & stations", shell and container wiring | full vitest run (3 tests) | `web/components/shell/nav-items.test.ts:92`; `web/app/(app)/layout.test.ts:104`, `:105`; new `web/composition/item-words-wiring.test.ts:18` `.Plural).toBe("Stations")`, `:19` `toHaveBeenCalledWith("org-1")`, `:20` (killed R6b) | PASS |
| C2012 | Sites page copy | full vitest run | `web/components/vocabulary.test.ts:56`, `:57` `toContain(">Stations<")` | PASS |
| C2013 | site register; asset form; add-asset page | full vitest run (3 tests) | `web/components/vocabulary.test.ts:66`, `:69`, `:70` `'placeholder="Search stations…"'`, `:73`; asset form `:191` `toContain("Station type")`, `:192` `toContain("Choose a station type")` (killed N4, N4b); add-asset `web/app/(app)/vocabulary.test.ts:46`, `:47`, `:48` `toHaveBeenCalledWith("org-1")` (killed N5b, N5c) | PASS |
| C2014 | import flow incl. progress words and review grid | full vitest run (3 tests) | `web/components/vocabulary.test.ts:100`; grid `:163` `"<span>Station type</span>"`; progress `:169-172` | PASS |
| C2015 | legend, launcher, list-failed, validation message | full vitest run (3 tests) | `web/components/agreements/agreements.test.ts:715`, `:716`; `web/components/vocabulary.test.ts:107-108`; new `:176` NoticeText(LIST_FAILED) `toBe("...station list...")`, `:178` ProgressLine `toBe("Finding the stations… 2 of 5")` (killed R2b-c, R5b-c; the dialog's use of the two components is unproven, R2b-d, R5b-d) | PASS |
| C2016 | agreement view heading, empty lines, diff label | full vitest run (2 tests) | `web/components/agreements/agreements.test.ts:726`, `:727`, `:731`, `:739` (carried) | PASS |
| C2017 | search heading, prompt, no-match; query verbatim | full vitest run | `web/components/vocabulary.test.ts:116`, `:118`, `:123`, `:126` `"match “equipment”."` | PASS |
| C2018 | task library; Settings link | full vitest run (2 tests) | `web/components/vocabulary.test.ts:133-138`; new `:199` `toContain("Task library: station types and checklists")` (killed N7) | PASS |
| C2019 | Pipeline subtitle and recent imports | full vitest run | `web/components/vocabulary.test.ts:145-146`. Precision gap carried: "empty line" and "Extract stations" do not exist in `recent-imports.tsx` | PASS |
| C2020 | page and loading titles, set and default | full vitest run (3 tests) | `web/app/(app)/vocabulary.test.ts:23-27`, `:33-34`; `web/components/vocabulary.test.ts:151-154` | PASS |
| C2021 | no unlocalised "equipment" literal or JSX text outside the allowlist | full vitest run | `web/domain/purity.test.ts:110` `expect(offenders).toEqual([])`; per-file literals `:63-69`; JSX regex `:95` `/>([^<>{}=]*equipment[^<>{}=]*)</gi`. Killed P1 (multi-line JSX text), P2 ("Equipment type" in a new file), P3, P5, and N4, N5c, N7. **Still partly hollow**: P4 survived (JSX text followed or preceded by `{expr}`) | PASS |
| C2022 | extraction prompt, login page and root layout unchanged | full vitest run | `web/infrastructure/claude/extractor.test.ts:167`; `web/app/product-copy.test.ts:10-12`. The Proof line now names `app/product-copy.test.ts` (`checks.md:96`), closing round 2's precision gap | PASS |
| C2023 | agreement PDF heading; contract PDF renderer; contract PDF route passes the words | full vitest run (3 tests) | `web/infrastructure/documents/agreement-pdf.test.ts:251-252`; `web/infrastructure/documents/contract-pdf.test.ts:229-231`; new `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:169` `.words).toEqual({ singular: "station", ... Plural: "Stations" })`, `:173` default `toBe("Equipment")` (killed N1b). The signing flow's contract is unproven (N1c) | PASS |
| C2024 | not-recorded sentence, set and default | full vitest run | `web/infrastructure/documents/agreement-pdf.test.ts:257`, `:260` (carried) | PASS |
| C2025 | withdrawn by the owner on 2026-11-09; replaced by the C2023 contract test | `contract-pdf.test.ts -t "C2023:"` in the full run | withdrawal at `.specs/features/item-vocabulary/checks.md:106`, `:139`, `:197-198`; `.specs/features/item-vocabulary/plan.md:93`; replacement `web/infrastructure/documents/contract-pdf.test.ts:229` | PASS (withdrawn) |
| C2026 | default PDF output unchanged; existing suites unedited | full vitest run | `web/infrastructure/documents/agreement-pdf.test.ts:103`, `:157` (carried); no pre-existing assertion removed since 8eeb42f (see Other reviews) | PASS |
| C2027 | re-render after a word change: Equipment, then Stations | full vitest run | `web/composition/pdf-route.test.ts:120`, `:124`, `:125` (carried) | PASS |
| C2028 | portal_view returns the words beside the branding | test:db | `supabase/tests/item_vocabulary.sql:101-104` (carried) | PASS |
| C2029 | default org returns equipment | test:db | `supabase/tests/item_vocabulary.sql:115` (carried) | PASS |
| C2030 | unknown token null; one jsonb overload; anon may execute | test:db | `supabase/tests/item_vocabulary.sql:117`, `:123-126`, `:127`, `:129` (carried) | PASS |
| C2031 | adapter maps the keys; absence gives equipment | full vitest run | `web/infrastructure/supabase/portal.test.ts:206`, `:208` (carried; killed N9, not run in round 2) | PASS |
| C2032 | review page heading and empty line | full vitest run | `web/components/review/schedule.test.ts:62-64` (carried) | PASS |

## Coverage

Recomputed at 16af25b for the rows whose authority the fix touched; the rest carried from 8eeb42f (no file in their authority changed).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| AC 6 places (9) | plan AC 6 (`plan.md:83`) | C2011-C2019 (citations above) | the New agreement dialog's progress line and list-failed notice as the dialog renders them: only `ProgressLine`/`NoticeText` are rendered, the dialog only in its idle state where `phaseLine("idle")` is `""` (`web/components/vocabulary.test.ts:171`); R2b-d, R5b-d survived |
| places the owner added on 2026-11-09 (4, now in AC 6) | `plan.md:83`, `checks.md:197` | asset form label and error C2013 (`vocabulary.test.ts:191-192`); add-asset panel C2013 (`app/(app)/vocabulary.test.ts:46-48`); Settings link C2018 (`vocabulary.test.ts:199`); contract PDF route C2023 (`route.test.ts:169`) | - (precision gap: the claims of C2013 and C2018 in checks.md do not name these places; the tests borrow the ids) |
| contract PDF producers (2) | `composition/index.ts:215` and the route, both build the contract document | route C2023 (`route.test.ts:169`, killed N1b) | `makeContractDocuments` in `web/application/use-cases/signing.ts:126`, the document sent to the signature provider: N1c survived |
| staff wiring hops (3) | plan Flow hop 4 | container C2011 (`item-words-wiring.test.ts:18-20`, killed R6b); MemberGate -> AppShell C2011 (`layout.test.ts:104`); reader C2009 (`item-words.test.ts:8`) | - |
| settings store read without the words (2 fields) | `web/infrastructure/supabase/settings.ts:31-32` | C2009 `settings.test.ts:143` (killed N3s, N3p) | - |
| article choice (3 branches) | `web/domain/org-settings/index.ts:218` (`startsWithVowelSound`) | silent-h C2010 `:246`; consonant-sound u C2010 `:245`, `:247`; vowel letter carried `:236-239` | - |
| itemText modifiers (4: list, type, import, catalog) | `web/domain/org-settings/index.ts:240` | list/type carried `:222-239`; catalog `:248` (killed A3); import carried `:222-228` | - |
| JSX text shapes the C2021 scan claims (4) | C2021 claim "JSX text" | same-line C2021 (P3), own-line C2021 (P1, P5), literal C2021 (P2) | JSX text adjacent to an expression, e.g. `<p>No equipment at {n}</p>` (P4 survived) |
| page titles (4) | `app/(app)/sites/**` | C2020 | - |
| places AC 6 leaves out (3) | plan AC 6 | C2022 | - |
| PDF places (3, as amended) | plan AC 9 | C2023, C2024, contract C2023 | - |
| word shapes, fields, forms, counts, roles, portal statuses and keys, doors | carried from 8eeb42f (authorities unchanged) | C2001-C2010, C2028-C2031 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary | `domain/org-settings/index.ts` (touched: article rule, catalog) | own layer C2001, C2003, C2010 (killed A1, A2, A3) | yes |
| Decides, reached across a boundary | migration checks, `portal_view` (untouched, carried) | boundary C2004, C2028-C2030; own layer C2003, C2031 | yes |
| Instrumentation | screens, PDF, adapter, store, composition | one render with non-default words per place plus the default suite | no - gap: the dialog's use of `ProgressLine`/`NoticeText` (R2b-d, R5b-d) and the signing flow's contract document (N1c) have no render or round trip with non-default words |

## Faults injected

Scratch `git worktree` at 16af25b (node_modules by junction), driver `scratchpad/faults3.cjs`. Each fault ran the full vitest suite, then `git checkout -- <file>` (and deletion of probe files); the worktree's porcelain was checked empty after every fault, and the real tree's porcelain matched its empty baseline after the worktree was removed. No SQL faults: the fix touched no SQL.

| Mutation | Location | Killed |
| --- | --- | --- |
| R6b container wires the reader to `async () => null` | `web/composition/index.ts:151` | yes - C2011 `item-words-wiring.test.ts` |
| R2b-c `ProgressLine` uses the default words | `web/components/agreements/new-agreement-text.tsx:9` | yes - C2015, C2021 |
| R2b-d dialog renders `phaseLine(phase, progress, itemWords("equipment","equipment"))` instead of `<ProgressLine>` | `web/components/agreements/new-agreement-dialog.tsx:315` | no - survived (dialog only rendered idle) |
| R5b-c `NoticeText` returns the text unchanged | `web/components/agreements/new-agreement-text.tsx:14` | yes - C2015 |
| R5b-d dialog renders `{notice.text}` instead of `<NoticeText>` | `web/components/agreements/new-agreement-dialog.tsx:319` | no - survived |
| N1b contract PDF route builds the document without words | `web/app/(app)/contracts/[contractId]/pdf/route.ts:30` | yes - C2023 route test |
| N1c signing's contract document built with the default words | `web/application/use-cases/signing.ts:126` | no - survived |
| N3s store drops `?? DEFAULT_ITEM_WORD` (singular) | `web/infrastructure/supabase/settings.ts:31` | yes - C2009 |
| N3p same, plural | `web/infrastructure/supabase/settings.ts:32` | yes - C2009 |
| N4 asset form label literal `"Equipment type"` | `web/components/records/asset-form.tsx:32` | yes - C2013, C2021 |
| N4b asset form error not passed through itemText | `web/components/records/asset-form.tsx:32` | yes - C2013 |
| N5b add-asset page reads `getItemWords("org-0")` | `web/app/(app)/sites/[siteId]/assets/new/page.tsx:20` | yes - C2013 (app) |
| N5c add-asset panel text literal | `web/app/(app)/sites/[siteId]/assets/new/page.tsx:26` | yes - C2013, C2021 |
| N7 Settings link as bare JSX text on its own line | `web/components/settings/settings-view.tsx:35` | yes - C2018, C2021 |
| N9 portal adapter swaps the keys (not run in round 2) | `web/infrastructure/supabase/portal.ts:107` | yes - C2031 |
| A1 article by first letter only | `web/domain/org-settings/index.ts:218` | yes - C2010 |
| A2 "hour" dropped from the silent-h list | `web/domain/org-settings/index.ts:218` | yes - C2010 |
| A3 `catalog` dropped from the modifiers | `web/domain/org-settings/index.ts:240` | yes - C2010, C2013 |
| R8 itemText loses its leading `\b` (not run in round 2) | `web/domain/org-settings/index.ts:240` | equivalent - no copy string under components/app/domain/infrastructure/application has a word character before "(an )equipment" (a grep over non-test sources for a word character, then optional "an "/"An ", then "equipment": 0 hits) |
| P1 new file, `<p>` / `equipment here` / `</p>` on separate lines | `web/components/zz-probe1.tsx` (probe) | yes - C2021 |
| P2 new file, `"Equipment type"` literal | `web/components/zz-probe2.tsx` (probe) | yes - C2021 |
| P3 new file, `<p>equipment here</p>` on its own line | `web/components/zz-probe3.tsx` (probe) | yes - C2021 |
| P4 new file, `<p>No equipment at {n}</p>` | `web/components/zz-probe4.tsx` (probe) | no - survived (regex excludes `{}`) |
| P5 new file under app/(app), "Equipment type" as own-line JSX text | `web/app/(app)/zz-probe5.tsx` (probe) | yes - C2021 |

## Findings outside the checks

1. **The contract sent for signature still says Equipment if its words are lost.** `makeContractDocuments` (`web/application/use-cases/signing.ts:126`, wired at `web/composition/index.ts:215`) builds the PDF handed to the signature provider. Its words are correct today, but no test asserts them (N1c). AC 9 as amended covers the contract PDF.
2. **Allowlist note is slightly off.** `checks.md:197-198` say the C2021 allowlist keeps "only the login copy and the settings help text". `web/domain/purity.test.ts:51-60` also lists three message tables and `components/ui/illustrations.tsx`. The illustrations file names equipment only in a comment, and comments are stripped (`:82`), so that entry does nothing.
3. **The JSX regex now excludes `=`** (`purity.test.ts:95`). This also hides JSX text containing `=` that round 2's regex caught. No such copy exists today. It is a narrowing, not a removed assertion.
4. **Migration still not recorded in `schema_migrations`** (carried from round 2; the Boundary line `checks.md:196` now says so). A later `supabase db push` would re-run a non-idempotent `add column`.
5. **`itemVerb` mass-noun heuristic** (carried): an invariant countable word such as "sheep" gets "was". Cosmetic.

## Other reviews

- **Weakened tests since 8eeb42f:** the only removed lines in test files are the `@/composition` mock (widened), the `listNotice` import and its two assertions, and the old purity-scan lines. The two `listNotice` strings are asserted again, unchanged, through `NoticeText` (`web/components/vocabulary.test.ts:176-177`). The scan's allowlist changed from global to per-file, which is stricter. No `.skip`, `.only` or `.todo` was added in df11ced..HEAD. The suite went from 3487 to 3494 tests.
- **Spec consistency:** no stale mention remains of C2025's column (`checks.md:109` fixed), the Test policy's C2025 (`:170` fixed), the allowlist placement (`:198` fixed) or the migration status (`:196` fixed). Plan AC 6 now names the owner's added places (`plan.md:83`). The remaining drift is finding 2.
- **Default-word output (AC 8):** `startsWithVowelSound("equipment")` is true, so "an equipment" is kept. With the default words, "catalog" maps equipment to equipment. `NoticeText` and `ProgressLine` apply `itemText` to the same strings the dialog used to pass. `uploadMessage(sent) ?? LIST_FAILED` is the old expression. Existing default-copy assertions pass unedited (`web/components/vocabulary.test.ts:179`, `web/domain/org-settings/org-settings.test.ts:249`, full suite).
- **Lessons (step 7):** not written, because this run must leave only verification.md modified. Suggested lessons: (a) moving the words into a child component proves the child, not that the parent renders it; a stateful dialog needs an interaction render, or a structural assertion, to prove its wiring. (b) A second producer of the same document (the signing flow beside the PDF route) needs its own proof.

## Gate

`npx vitest run --reporter=verbose`: 3494 passed, 0 failed (184 files). `npx tsc --noEmit` exit 0. `npx eslint` exit 0. `npm run test:db item_vocabulary`: 1 passed, 0 failed. `npm run test:db type_editor catalog_seed`: 2 passed, 0 failed.

## Ranked gaps

1. N1c: the contract document sent for signature has no words proof (`web/application/use-cases/signing.ts:126`).
2. R5b-d, R2b-d: nothing proves that the New agreement dialog renders `<NoticeText>` and `<ProgressLine>` (`web/components/agreements/new-agreement-dialog.tsx:319`, `:315`).
3. P4: C2021 misses JSX text next to an expression (`web/domain/purity.test.ts:95`).
4. Precision gaps: the claims of C2013 and C2018 do not name the owner-added places their tests now cover. The C2019 claim names copy that does not exist.
5. Records: the allowlist note (finding 2) and the `schema_migrations` row (finding 4).
