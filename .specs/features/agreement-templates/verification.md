# Agreement templates verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: f762140..HEAD (f764963)
**Round**: 2 (scoped) - proofs re-run in full at f764963; the rest carried from round 1 at 6765ffe (kept in `verification-round1.md`, verdict FAIL)
**Verifier**: independent sub-agent (author != verifier)

Round 2 scope: the fix commit f764963 touched `web/components/templates/templates-view.test.tsx`, `template-card.test.tsx`, `web/domain/agreement/template.ts` and `template.test.ts` (plus a line in checks.md). Everything else is `carried from 6765ffe` and marked so. Uncommitted edits by the orchestrator (`web/scripts/test-db/runner.mts`, `supabase/tests/agreement_builder.sql`, `contract_templates.sql`, the header of `agreement_templates.sql`) were left untouched; the migration is now applied to the hosted project, so `npm run test:db agreement_templates` ran against the hosted objects.

Result: 54 of 54 checks proven; round 1's three surviving layout mutants are now killed; finding F1 is closed except a residual multibyte case recorded as a low observation (R2-1), which does not contradict a check.

## Binding sources

verified at f764963 for the Templates screen; opened `.specs/features/agreement-templates/binding/templates-screen.png` again with the Read tool in round 1 (carried from 6765ffe, image seen). Re-enumeration after the fix: the code of the screen did not change (`git diff 6765ffe HEAD` touches only tests and the validator), so the enumeration of round 1 stands; the members that were uncovered now have assertions:

| Element or arrangement | Check | Assertion now |
| --- | --- | --- |
| Header: title, subtitle, New template at the right | C5340 | `web/components/templates/templates-view.test.tsx:34-44` (placement from shared `PageHeader`, `web/components/shell/page-header.tsx:20-33`); low note kept |
| Two regions, preview a sibling of the grid section | C5341 | `web/components/templates/templates-view.test.tsx:130-138`: `html.indexOf('aria-label="Template preview"')).toBeGreaterThan(sectionEnd)` |
| Container flex column, grid from xl with two tracks, no sm/md/lg grid | C5341 | `templates-view.test.tsx:136-137`: `container.split(" ")` contains `flex`, `flex-col`, `xl:grid`, `xl:grid-cols-[minmax(0,1fr)_22rem]`; `not.toMatch(/(?:^| )(?:sm\|md\|lg):grid\b/)` |
| Grid list: one li and one article per template inside the section, none after | C5341 | `templates-view.test.tsx:140-147` (`section.match(/<li>/g)).toHaveLength(2)`) |
| Two-column grid from md, one column stacked | C5341 | `templates-view.test.tsx:65-70` (round 1) matches code `templates-view.tsx:49` |
| Card icon tile left and menu right in one justified row; read-only member has the tile alone | C5342 | `web/components/templates/template-card.test.tsx:95-99` (`justify-between` div wrapping the tile span then `<details`) |
| Card footer: frequency first at the left, Updated second at the right, one justified row | C5342 | `template-card.test.tsx:101-104` |
| Selected card's own border and ring, others without | C5342 | `template-card.test.tsx:106-109` (`border-action`, `ring-1` on the selected `<article>` only) |
| Deliberate differences (eyebrow, Preset lines row, one tint, sidebar/bell/branding, nav link) | - | unchanged, not findings |

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/features/agreement-templates/binding/templates-screen.png` | yes - Read tool, image seen (round 1, carried from 6765ffe; screen code unchanged since) | none | - |

## Checks

Proofs ran at f764963: full `npx vitest run --reporter=verbose` (web/, PowerShell because the bash sandbox breaks vitest workers): 286 files, 4785 tests passed, 0 failed (6 more than round 1: the 6 new tests). `npm run test:db agreement_templates`: PASS, 1 passed, 0 failed, against the hosted objects. Rows marked `carried` have their assertion text and line numbers from round 1 and their tests re-ran green in this run; the files they live in were not touched by f764963 except where stated.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5300 | one system agreement template, readable by both orgs | `npm run test:db agreement_templates` exit 0 (hosted) | `supabase/tests/agreement_templates.sql:119`, `:125`, `:131` | PASS |
| C5301 | save creates template and v1; admin adds v2; v1 unchanged | same | `supabase/tests/agreement_templates.sql:151`, `:158`, `:160`, `:166` | PASS |
| C5302 | estimator, viewer, non-member, anon get 42501 | same | `supabase/tests/agreement_templates.sql:180-182`, `:186-187`, `:189` | PASS |
| C5303 | 8 invalid bodies raise 22023 | same | `supabase/tests/agreement_templates.sql:216`, `:218`, `:219` | PASS |
| C5304 | name uniqueness among non-archived | same | `supabase/tests/agreement_templates.sql:230-231`, `:234`, `:243` | PASS |
| C5305 | create pins own and system version; viewer 42501 | same | `supabase/tests/agreement_templates.sql:270-271`, `:275` | PASS |
| C5306 | foreign, contract, unknown version raise 22023 | same | `supabase/tests/agreement_templates.sql:294`, `:297` | PASS |
| C5307 | no version leaves null pin; P0002; 23505 | same | `supabase/tests/agreement_templates.sql:306`, `:308`, `:309` | PASS |
| C5308 | send pins system latest when null, keeps a pin | same | `supabase/tests/agreement_templates.sql:325`, `:328` | PASS |
| C5309 | revise copies the pin, pinned and null | same | `supabase/tests/agreement_templates.sql:346-347` | PASS |
| C5310 | pin of a sent version refused, draft not blocked | same | `supabase/tests/agreement_templates.sql:359-360`, `:362`, `:366` | PASS |
| C5311 | three agreement templates; second contract 23505 | same | `supabase/tests/agreement_templates.sql:250`, `:253`, `:254` | PASS |
| C5312 | archive once, versions and pin stay | same | `supabase/tests/agreement_templates.sql:379-381`, `:386`, `:388-390` | PASS |
| C5313 | cross-org reads empty, member insert 42501, anon refused | same | `supabase/tests/agreement_templates.sql:398-400`, `:405-406`, `:409-412` | PASS |
| C5314 | preset copies two lines, null price is 0 | same (fault S1 kills it) | `supabase/tests/agreement_templates.sql:432`, `:434`, `:437` | PASS |
| C5315 | RTU linked, NOPE left off | same | `supabase/tests/agreement_templates.sql:439` | PASS |
| C5316 | preset term 24; null leaves default | same | `supabase/tests/agreement_templates.sql:443`, `:449` | PASS |
| C5317 | at limit 55000 `plan_limit_agreements` | same | `supabase/tests/agreement_templates.sql:498`, `:500` | PASS |
| C5318 | editing a copied line leaves the template | same | `supabase/tests/agreement_templates.sql:457-458` | PASS |
| C5320 | intro/footer rendered; PDF order | vitest ran (carried, files untouched) | `web/domain/agreement/document.test.ts:199-200`; `web/infrastructure/documents/agreement-pdf.test.ts:334-347` | PASS |
| C5321 | sections hidden, 4 combinations | vitest ran (carried) | `web/domain/agreement/document.test.ts:215-224`; `web/infrastructure/documents/agreement-pdf.test.ts:355-361` | PASS |
| C5322 | draft today's settings, sent frozen terms | vitest ran (carried) | `web/domain/agreement/document.test.ts:236`, `:242` | PASS |
| C5323 | clause omitted, paragraph empty | vitest ran (carried) | `web/domain/agreement/template.test.ts:202-215` | PASS |
| C5324 | validation rules incl. what the SQL refuses (code over 80, price over 1e12 cents, body over the size cap) | `npx vitest run domain/agreement/template.test.ts -t "C5324:"` ran, 41 tests in file passed | `web/domain/agreement/template.test.ts:40-61` table; new `:77-87`: `expect(!code.ok && code.errors[0].message).toContain("80")`, `price.errors[0].field).toBe("preset.lines.0.costPerVisitCents")`, `big.errors.at(-1)).toEqual({ field: "body", message: expect.stringContaining("too long") })`; code `web/domain/agreement/template.ts:127,132,185` | PASS |
| C5325 | editor text round trip | vitest ran (carried) | `web/domain/agreement/template.test.ts:90-103` | PASS |
| C5326 | frequency labels | vitest ran (carried) | `web/domain/agreement/template.test.ts:111-121`; `web/components/templates/template-card.test.tsx:73-77` | PASS |
| C5327 | preview summary | vitest ran (carried) | `web/domain/agreement/template.test.ts:150-171` | PASS |
| C5328 | reader returns pin body, system for null, throws | vitest ran (carried) | `web/infrastructure/supabase/agreements.test.ts:863-880` | PASS |
| C5329 | PDF route fails, nothing drawn | vitest ran (carried) | `web/app/(app)/agreements/[agreementId]/pdf/route.test.ts:238-243` | PASS |
| C5330 | portal_view body; use case fails on missing/invalid | SQL + vitest ran | `supabase/tests/agreement_templates.sql:477`, `:481`; `web/application/use-cases/portal.test.ts:126-129` | PASS |
| C5331 | review page intro/closing/hidden sections | vitest ran (carried) | `web/components/review/template.test.ts:35-36`, `:44-49` | PASS |
| C5332 | system body PDF identical; existing tests unedited | vitest ran (carried) | `web/infrastructure/documents/agreement-pdf.test.ts:363-367` | PASS |
| C5333 | SYSTEM_AGREEMENT_BODY equals stored JSON | vitest ran (carried) | `web/domain/agreement/template.test.ts:224-229` | PASS |
| C5334 | staff preview pin and frozen pin | vitest ran (carried) | `web/app/(app)/agreements/[agreementId]/pdf/route.test.ts:245-263` | PASS |
| C5340 | header, subtitle, New template primary link by role | vitest ran | `web/components/templates/templates-view.test.tsx:36-43`, `:46-51` | PASS |
| C5341 | two regions in order; side by side from xl, grid two columns; stacked one column | `npx vitest run components/templates/templates-view.test.tsx -t "C5341:"` ran (4 tests); M1, M2 killed | `web/components/templates/templates-view.test.tsx:55-63`, `:65-70`, `:130-138` (preview after `</section>`; container class list), `:140-147` (one li and one article per template inside the section) | PASS |
| C5342 | card parts in order, menu top right, footer left/right, aria-current, own border | `npx vitest run components/templates/template-card.test.tsx -t "C5342:"` ran; M3 killed | `web/components/templates/template-card.test.tsx:39-48`, `:68-71`, `:95-99`, `:101-104` (`<span[^>]*>Quarterly</span><span[^>]*>Updated 2 weeks ago</span>`), `:106-109` | PASS |
| C5343 | preview order, four rows, buttons | vitest ran (carried) | `web/components/templates/template-preview.test.tsx:46`, `:51`, `:62-63` | PASS |
| C5344 | controls by role | vitest ran | `web/components/templates/templates-view.test.tsx:83-95` | PASS |
| C5345 | system template as only selected card | vitest ran | `web/components/templates/templates-view.test.tsx:102-112` | PASS |
| C5346 | load error with retry; loading screen | vitest ran | `web/components/templates/templates-view.test.tsx:120-125`; `web/app/(app)/templates/page.test.ts:65-86` | PASS |
| C5347 | selected card by `?selected` | vitest ran (carried) | `web/app/(app)/templates/page.test.ts:49-62` | PASS |
| C5348 | nav link after Agreements | vitest ran (carried) | `web/components/shell/nav-items.test.ts:25-26`, `:35-42` | PASS |
| C5349 | editor field order | vitest ran (carried) | `web/components/templates/template-editor.test.tsx:29`, `:56`, `:91` | PASS |
| C5350 | invalid field keeps typed values | vitest ran (carried) | `web/components/templates/template-editor.test.tsx:109-130` | PASS |
| C5351 | estimator forbidden; invalid answers errors; valid saves once | vitest ran (carried) | `web/app/(app)/templates/template-actions.test.ts:30`, `:46-60` | PASS |
| C5352 | duplicate naming and opens editor | vitest ran (carried) | `web/app/(app)/templates/template-actions.test.ts:100-105`; `web/domain/agreement/template-form.test.ts:50-57` | PASS |
| C5353 | archive confirms, once | vitest ran (carried) | `web/components/templates/archive-control.test.tsx:63-82`; `web/app/(app)/templates/template-actions.test.ts:122-129` | PASS |
| C5354 | redirects and 404s | vitest ran (carried) | `web/app/(app)/templates/page.test.ts:87`, `:103-111`; `web/app/(app)/templates/[templateId]/page.test.ts:47-67` | PASS |
| C5355 | store maps codes | vitest ran (carried) | `web/infrastructure/supabase/templates.test.ts:17`, `:70`, `:76`, `:88` | PASS |
| C5356 | create sends version only when given; maps 22023 | vitest ran (carried) | `web/infrastructure/supabase/agreements.test.ts:176`, `:187`, `:194` | PASS |
| C5357 | Use template link, From template, action passes version | vitest ran (carried) | `web/components/templates/template-preview.test.tsx:67`; `web/components/agreements/agreements-list.test.ts:167`; `web/app/(app)/plan-limit-actions.test.ts:74`, `:85` | PASS |
| C5358 | skippedCodes and the page note | vitest ran (carried) | `web/domain/agreement/template.test.ts:175`; `web/components/agreements/agreements.test.ts:747-763` | PASS |
| C5359 | container wiring | vitest ran (carried) | `web/composition/templates-wiring.test.ts:33`, `:45`, `:56`, `:66` | PASS |

## Coverage

Round 2 recomputed the rows whose authority the fix touched (arrangement of the screen from the binding source, body rules from the SQL function); the other rows are `carried from 6765ffe`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| arrangement of the Templates screen (6: two regions with nesting, side-by-side from xl, grid two columns, stacked one column, card top row left/right, card footer left/right) | binding source screenshot | nesting `templates-view.test.tsx:130-138`; xl grid and no sm/md/lg grid `:136-137`; two columns and one column `:65-70`; card top row `template-card.test.tsx:95-99`; footer `:101-104`; selected border `:106-109` | - |
| rules the SQL body check refuses with 22023 (13: not an object, size, exact keys, schema 1, name 1-80, description 300, intro/footer list and 30 blocks, block shape/type/1-2000, sections shape, preset shape, termMonths 1-60, lines 20, line keys and description, 1-12 unique months, code string 1-80, price 0-1e12) | `supabase/migrations/20261112240000_agreement_templates.sql:90-182` | each has a TS counterpart: `web/domain/agreement/template.ts:137-185` (size at `:185` as JSON characters, code length `:127`, price ceiling `:132`); C5324 `template.test.ts:40-87` | - |
| statuses, roles, pin ways, read failures, consumers, frequency labels, preview rows, card parts, editor fields, validation rules, name rules | carried from 6765ffe | as round 1 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration functions, `templates.ts`, `agreements.ts` | boundary SQL as the role (re-ran PASS against hosted) and adapter mapping `templates.test.ts:70`, `agreements.test.ts:187` | yes |
| Decides, not reached across a boundary | `template.ts`, `template-form.ts`, `document.ts` | one at own layer, one case per rule, now including code, price and size at `template.test.ts:77-87` | yes |
| Screens | `templates-view.tsx`, `template-card.tsx`, `template-preview.tsx`, `template-editor.tsx` | one render test per region asserting controls, order, count and arrangement | yes - arrangement members now asserted structurally (`templates-view.test.tsx:130-147`, `template-card.test.tsx:95-109`) and the three mutants are killed |
| Instrumentation | actions, composition, PDF lists | one proof at the consumer | yes (carried) |

## Faults injected

Round 1 results carried from 6765ffe (killed unless stated): SQL role list with estimator (killed), preset null price (killed), PDF schedule always shown (killed), term bound 61 (killed), `canWriteTemplates` loosened (killed), adapter 23505 mapping (killed); round 1's M1, M2, M3 survived there and are re-injected below. Round 2, verified at f764963, on the real tree and reverted with `git checkout -- <file>` on exactly the touched files (`git status --short` afterwards shows only the orchestrator's uncommitted edits, `verification-round1.md`, `verification.md` and `node_modules/`):

| Mutation | Location | Killed |
| --- | --- | --- |
| M1: preview moved inside the card `<section>` | `web/components/templates/templates-view.tsx:60-61` | yes - `C5341: the preview sits beside the grid section, not inside it ...` failed (1 failed, 14 passed) |
| M2: `xl:grid` deleted from the container | `web/components/templates/templates-view.tsx:48` | yes - the same C5341 test failed |
| M3: `justify-between` removed from the icon/menu row and the footer row | `web/components/templates/template-card.tsx:62,84` | yes - `C5342: the icon tile and the menu share one row ...` and `C5342: the footer is one justified row ...` failed |
| M4: price ceiling raised to 9e15 and body size cap to 600000 characters | `web/domain/agreement/template.ts:132,185` | yes - `C5324: what the save function refuses with 22023 ...` failed |
| S1: expected null price 0 changed to 1 in the SQL test (the migration is applied, so SQL faults go into expected values) | `supabase/tests/agreement_templates.sql:437` | yes - `FAIL agreement_templates: C5314 line 2 null price is 0: line 2 is ("Annual boiler check",{10},1,0)` against the hosted project; restored by editing the line back, `git diff` shows no C5314 change |

## Gate

- `npx vitest run --reporter=verbose` (web/): 286 files, 4785 tests passed, 0 failed; the new tests ran individually (C5324 at `template.test.ts:77`, C5341 at `templates-view.test.tsx:130,140`, C5342 at `template-card.test.tsx:95,101,106`).
- `npm run test:db agreement_templates` (web/, hosted objects): PASS, 1 passed, 0 failed.
- `npx tsc --noEmit -p .`: 2 errors, the known pre-existing set (`.next/`, `app/setup/draft-actions.test.ts`); none new.
- `npx eslint` was not re-run in round 2: f764963 changes only test files and a validator constant/branches (`template.ts:43-46,127,132,185`); eslint was clean on those files' round 1 versions (carried from 6765ffe).

## Round 2 judgments

- C5341, C5342 and the Test policy row "Screens": met. B1 and B2 are closed: the assertions now reach nesting, the grid class list, the xl side-by-side, the justified rows, their child order and the selected card's border and ring, and each of M1, M2, M3 fails a named test. The screen code did not change, so the binding-source enumeration is as in round 1; no element is drawn that the design does not draw, no design element is without an assertion.
- F1: closed for the three rules named. A code over 80 characters (`template.ts:127`, SQL `:172`), a price above 1e12 cents (`template.ts:132`, SQL `:179`) and an oversized body (`template.ts:185`) are refused by the app first. Compared the SQL function again: every other rule has a TS rule at least as strict (name and text lengths are measured untrimmed in TS and trimmed or equal in SQL; the description, block count, visit months, sections, preset keys and term bound match). The direction SQL-accepts, TS-refuses (unknown variable, whitespace-only text) is harmless to saving and was reported in round 1 as an observation.
- R2-1 (low, residual, does not contradict a check): the SQL cap is `octet_length(p_body::text) > 65536` (bytes, `migration:93`) and the TS cap is `JSON.stringify(input).length > 60_000` (UTF-16 characters, `template.ts:185`). For multibyte text the two diverge: about 25,000 characters of 3-byte text (for example CJK) is about 75,000 bytes and is refused by the SQL with 22023, while the app accepts it (JSON length near 25,000); likewise 2-byte accented text above about 32,700 characters. The database still refuses it, so nothing bad is stored; the owner sees the generic "unavailable" instead of a field message. Measuring bytes (`new TextEncoder().encode(json).length`) would close it. A `\u0000` in a text has the same shape (the database refuses it at the jsonb cast, not with 22023). O1 to O6 and the other low items stay accepted.

## Ranked gaps

None blocking. Low: R2-1 above.
