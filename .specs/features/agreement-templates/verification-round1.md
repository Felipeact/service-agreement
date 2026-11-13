# Agreement templates verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: f762140..HEAD (6765ffe)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Summary: 52 of 54 checks proven at HEAD; C5341 and C5342 are not proven because the screen's arrangement claims are asserted only by source order or class-substring and three layout mutants survive. No SQL, domain, PDF, adapter or action fault survived. The migration is correct on every adversarial point below except the observations listed under "Other findings" (none contradicts a check).

## Binding sources

Opened `.specs/features/agreement-templates/binding/templates-screen.png` with the Read tool: title "Agreement templates", subtitle, New template button at the right of the header; below, a 2x2 grid of four cards on the left and one preview panel on the right; the selected card (third) has its own border.

Enumeration of what the design decides, per region, against the checks and the code:

| Element or arrangement | Design | Check | Code | Status |
| --- | --- | --- | --- | --- |
| Header: title, one-line subtitle, New template at the right | yes | C5340 | `web/components/templates/templates-view.tsx:33-43` through `PageHeader` (`web/components/shell/page-header.tsx:20-33`, existing, flex row from md) | covered by order assertions at `web/components/templates/templates-view.test.tsx:34-44`; the "at the right" placement comes from the shared header |
| Eyebrow "Reusable pricing" above the title | drawn | none | not rendered | documented deliberate difference |
| Two regions below the header, card grid then preview, side by side | drawn | C5341 | `templates-view.tsx:48-60` (`xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]`) | UNCOVERED: see finding B1 |
| Card grid two columns, 2x2 | drawn | C5341 | `templates-view.tsx:49` (`grid-cols-1 md:grid-cols-2`) | class substring only, see B1 |
| Stack on mobile, one column | derived | C5341 | `templates-view.tsx:48,49` | class substring only, see B1 |
| Card: icon tile top-left, menu top-right in one row | drawn | C5342 | `template-card.tsx:62-66` (`justify-between`) | UNCOVERED: order only, see B2 |
| Card: name, two-line description, divider, footer | drawn | C5342 | `template-card.tsx:67-87` | covered (order, `<hr`, text) at `template-card.test.tsx:32-49` |
| Card footer: frequency left, "Updated ..." right | drawn | C5342 | `template-card.tsx:84-87` (`justify-between`) | UNCOVERED: order only, see B2 |
| Selected card has its own border | drawn | C5342 asserts `aria-current` only | `template-card.tsx:56` (`border-action ring-1`) | low: the selector-reachable indicator is `aria-current` (asserted at `template-card.test.tsx:68-71`); the border is a token style |
| Preview: eyebrow, name, description, four-row box, Use template (primary), Duplicate (secondary) | drawn | C5343 | `template-preview.tsx:36-58` | covered at `template-preview.test.tsx:35-64` |
| Fourth preview row | "Pricing model" | C5343 reads Preset lines | `template-preview.tsx:50` | documented deliberate difference |
| Icon tint (four tints in the design) | four | none | one token tint, `template-card.tsx:62` | documented deliberate difference |
| Sidebar, workspace card, bell, Maintain branding | drawn | none | not rendered; nav link after Agreements | documented deliberate difference, C5348 at `web/components/shell/nav-items.test.ts:24-26` |
| Menu "...", Duplicate and New template visible while the signed-in persona is an Estimator | drawn | C5344 hides them from estimators | `template-card.tsx:76`, `template-preview.tsx:53` | not a finding: the persona label sits in the sidebar card the plan excludes, and AC 21 decides roles; recorded as low observation O5 |
| Element the code draws that the design does not | n/a | n/a | "No preset lines" in the card footer for a template without lines (`template-card.tsx:86`), "Not set" in the preview (`template-preview.tsx:48`); a section/ul wrapper | benign fallbacks, no finding |

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/features/agreement-templates/binding/templates-screen.png` | yes - Read tool, image seen | none | B1: two-region arrangement (preview a sibling of the card section, not inside it) and the side-by-side and stacked layout have no structural assertion; B2: card top row (icon left, menu right) and card footer (frequency left, Updated right) have no structural assertion |

Findings (each fails at the weight of a wrong label, per verify.md):

- **B1 (C5341).** The claim "exactly two regions ... at 1440 px side by side with the grid two columns wide, at 375 px stack with the grid one column" is proven by `web/components/templates/templates-view.test.tsx:55-63` (indexOf order of two `aria-label` strings and one occurrence of each) and `:65-70` (`toMatch(/class="[^"]*xl:grid-cols-\[minmax\(0,1fr\)_22rem\]/)`, `<ul class="...grid-cols-1...md:grid-cols-2"`). The classes in the code do match the claim (grid is two columns from `md` 768 px, so two at 1440; grid and preview sit side by side only from `xl` 1280 px; below that everything is one column or, between 768 and 1279 px, a two-column grid with the preview stacked below). But the proofs do not reach the arrangement. Mutants M1 and M2 below survived: moving `<TemplatePreview>` inside the card `<section>` (breaks "two regions"; still passes because only index order is asserted) and deleting `xl:grid` from the container (the layout would never go side by side; still passes because the regex asserts only the `xl:grid-cols-` token). The test title says 1280 px while the check says 1440 px; either is fine with the classes, but no test ties the claim to a width.
- **B2 (C5342).** "a menu button at the top right" and "a footer with the frequency label at the left and Updated at the right" are proven only by source order (`web/components/templates/template-card.test.tsx:39-48`). Mutant M3 (remove `justify-between` from the icon/menu row and from the footer row) survived. Order in source does not distinguish left and right from stacked.
- Ranked low, not failing: the selected-card border is asserted by `aria-current` only; C5340's "at the right of the title" depends on the shared `PageHeader` and is asserted by order only (`templates-view.test.tsx:41`). No blanket "visual fidelity is unproven" clause exists in checks.md; the checks name the screen's structure but do not enumerate the exempt values (spacing, colour, weight), which is a gap in the checks text (checks.md:18-22).

## Checks

All Vitest proofs ran as part of `npx vitest run --reporter=verbose` at HEAD (286 files, 4779 tests, 0 failed; each named test appears individually in the verbose output, 35 distinct ids C5320-C5359 found, saved at the scratchpad `c53.txt`). The SQL recipe ran as `npm run test:db agreement_templates` (PASS, 1 passed, 0 failed); every SQL check has a labelled assertion in `supabase/tests/agreement_templates.sql` asserting the claim's concrete value. Tests were run from PowerShell because the bash sandbox in this session breaks vitest workers; this is an environment matter, not a repo one.

Where a check names a file that does not exist the proof is present elsewhere (not a finding): C5331 in `web/components/review/template.test.ts`, C5334 in `web/app/(app)/agreements/[agreementId]/pdf/route.test.ts`, C5348 in `web/components/shell/nav-items.test.ts`, C5357 additionally in `web/app/(app)/agreements-list.test.ts` and `web/components/agreements/new-agreement-template.test.tsx`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5300 | one system agreement template, v1 body, readable by both orgs | `npm run test:db agreement_templates` exit 0 | `supabase/tests/agreement_templates.sql:119` body equals the literal; `:125`, `:131` org A and B read it | PASS |
| C5301 | save creates template and v1, admin adds v2, v1 byte for byte | same run | `supabase/tests/agreement_templates.sql:151` (`r.version_no = 1`), `:158` (`version_no = 2`), `:160` v1 text unchanged, `:166` other org `P0002` | PASS |
| C5302 | estimator, viewer, non-member, anon get 42501 on save and archive | same run (fault M4 kills it) | `supabase/tests/agreement_templates.sql:180-182`, `:186-187`, `:189` nothing written | PASS |
| C5303 | 8 invalid bodies raise 22023 | same run | `supabase/tests/agreement_templates.sql:216` loop of cases, `:218` nothing written, `:219` null body | PASS |
| C5304 | name unique ignoring case among non-archived | same run | `supabase/tests/agreement_templates.sql:230-231` `23505`, `:234` own name ok, `:243` archived name reused | PASS |
| C5305 | create with own and system version pins it; viewer 42501 | same run | `supabase/tests/agreement_templates.sql:270-271`, `:275` | PASS |
| C5306 | other org, contract, unknown id raise 22023 | same run | `supabase/tests/agreement_templates.sql:294`, `:297` nothing created | PASS |
| C5307 | no version leaves null pin, P0002, 23505 | same run | `supabase/tests/agreement_templates.sql:306`, `:308`, `:309` | PASS |
| C5308 | send pins system latest when null, keeps an existing pin | same run | `supabase/tests/agreement_templates.sql:325`, `:328` | PASS |
| C5309 | revise copies the pin, pinned and null | same run | `supabase/tests/agreement_templates.sql:346-347` | PASS |
| C5310 | pin of a sent version refused for owner and member, draft not blocked | same run | `supabase/tests/agreement_templates.sql:359-360` hint `template_pin_frozen`, `:362`, `:364`, `:366` | PASS |
| C5311 | three agreement templates; second contract template 23505 | same run | `supabase/tests/agreement_templates.sql:250`, `:253`, `:254` | PASS |
| C5312 | archive sets archived_at once, keeps versions and pin | same run | `supabase/tests/agreement_templates.sql:379-381`, `:386`, `:388-390` | PASS |
| C5313 | cross-org reads empty, member insert 42501, anon refused | same run | `supabase/tests/agreement_templates.sql:398-400`, `:405-406`, `:409-412` | PASS |
| C5314 | preset copies two lines, null price becomes 0 | same run (fault M5 kills it) | `supabase/tests/agreement_templates.sql:432`, `:434`, `:437` (`cost_per_visit_cents = 0`) | PASS |
| C5315 | RTU linked, NOPE left off | same run | `supabase/tests/agreement_templates.sql:439` | PASS |
| C5316 | term 24 sets 24, null leaves default | same run | `supabase/tests/agreement_templates.sql:443`, `:449` | PASS |
| C5317 | at limit raises 55000 `plan_limit_agreements` | same run | `supabase/tests/agreement_templates.sql:498`, `:500` | PASS |
| C5318 | editing a copied line leaves the template | same run | `supabase/tests/agreement_templates.sql:457-458` | PASS |
| C5320 | intro/footer rendered with names; PDF order title, intro, price, terms, closing, page footer | vitest document.test.ts + agreement-pdf.test.ts `-t C5320:` ran | `web/domain/agreement/document.test.ts:199-200`; `web/infrastructure/documents/agreement-pdf.test.ts:334-347` (`inOrder(positions)`) | PASS |
| C5321 | schedule/scope hidden, 4 combinations, always-drawn parts | same | `web/domain/agreement/document.test.ts:215-224`; `web/infrastructure/documents/agreement-pdf.test.ts:355-361` (`all.includes("Visit schedule")` toBe schedule) (fault M6 kills it) | PASS |
| C5322 | draft uses settings, sent uses frozen terms | vitest `-t C5322:` ran (3 tests) | `web/domain/agreement/document.test.ts:236`, `:242` ("Payment 30 days; 24 months.") | PASS |
| C5323 | clause omitted, paragraph empty replacement | vitest template.test.ts ran | `web/domain/agreement/template.test.ts:202-215` | PASS |
| C5324 | 12 validation rules; 30/20/80/60 accepted | vitest template.test.ts ran (21 cases) | `web/domain/agreement/template.test.ts:40-61` table, `:67-75` (fault M7 kills `:56`) | PASS |
| C5325 | editor text round trip | vitest ran | `web/domain/agreement/template.test.ts:90-103` | PASS |
| C5326 | frequency labels, card shows it | vitest ran | `web/domain/agreement/template.test.ts:111-121` (`derivedFrequency(input)).toBe(expected)`), `web/components/templates/template-card.test.tsx:73-77` | PASS |
| C5327 | preview summary strings | vitest ran | `web/domain/agreement/template.test.ts:150-171`; `web/components/templates/template-preview.test.tsx:52-57` | PASS |
| C5328 | reader returns the pin body, system body for null, throws on unreadable | vitest agreements.test.ts ran (7 tests) | `web/infrastructure/supabase/agreements.test.ts:863-880` (`rejects.toThrow(TEMPLATE_VERSION)`) | PASS |
| C5329 | PDF route fails with nothing drawn | vitest route.test.ts ran | `web/app/(app)/agreements/[agreementId]/pdf/route.test.ts:238-243` (`renderAgreement` not called) | PASS |
| C5330 | portal_view returns body; portal use case fails on missing or invalid | SQL run + vitest portal tests ran | `supabase/tests/agreement_templates.sql:477`, `:481`; `web/application/use-cases/portal.test.ts:126-129` (`toThrow()` for null, string, schema 2, unknown variable); `web/infrastructure/supabase/portal.test.ts:104` | PASS |
| C5331 | review page intro before price, closing after terms, hidden sections omitted | vitest review/template.test.ts ran | `web/components/review/template.test.ts:35-36`, `:44-49` (`out.includes("Visit schedule")).toBe(schedule)`) | PASS |
| C5332 | system body PDF text identical to no-body and to before | vitest ran; existing agreement-pdf and review tests unedited (only an import line changed, see Adversarial c) | `web/infrastructure/documents/agreement-pdf.test.ts:363-367` (`expect(withSystem).toEqual(without)`) | PASS |
| C5333 | `SYSTEM_AGREEMENT_BODY` equals stored JSON | vitest ran | `web/domain/agreement/template.test.ts:224-229` (`JSON.parse(stored![1])).toEqual(SYSTEM_AGREEMENT_BODY)`) | PASS |
| C5334 | staff preview draws pin with today's settings while editable, frozen once sent | vitest route.test.ts ran (3 tests; named file `agreement-detail.test.ts` does not carry it) | `web/app/(app)/agreements/[agreementId]/pdf/route.test.ts:250-252`, `:259` | PASS |
| C5340 | header title, subtitle, New template primary link for owner/admin only | vitest templates-view.test.tsx ran | `web/components/templates/templates-view.test.tsx:36-43` (one link, `data-variant="primary"`), `:46-51` | PASS (low note B-low: right placement by order only) |
| C5341 | two regions in order; side by side with a two-column grid at 1440, stacked one column at 375 | vitest ran; mutants M1 and M2 survive | `web/components/templates/templates-view.test.tsx:55-63`, `:65-70` | FAIL (arrangement not proven, finding B1) |
| C5342 | card parts in order, menu top right, footer left/right, aria-current | vitest template-card.test.tsx ran; mutant M3 survives | `web/components/templates/template-card.test.tsx:39-48` (order only), `:68-71` | FAIL (arrangement not proven, finding B2) |
| C5343 | preview order, four rows, buttons | vitest ran | `web/components/templates/template-preview.test.tsx:51` (`dt` labels toEqual the four), `:46` order, `:62-63` | PASS |
| C5344 | controls by role | vitest ran (fault M8 kills it) | `web/components/templates/templates-view.test.tsx:83-95` (`toEqual({ newButton: true, menu: 2, edit: 2, duplicate: 3, archive: 2, use: true })`) | PASS |
| C5345 | system template as only selected card | vitest ran | `web/components/templates/templates-view.test.tsx:102-112` | PASS |
| C5346 | load error text with retry link; loading screen | vitest templates-view + page.test.ts ran | `web/components/templates/templates-view.test.tsx:120-125`; `web/app/(app)/templates/page.test.ts:65-86` | PASS |
| C5347 | selected card by `?selected`, first otherwise | vitest page.test.ts ran | `web/app/(app)/templates/page.test.ts:49-62` (`props.selectedId).toBe("t-a")`) | PASS |
| C5348 | Templates link after Agreements, current on sub-pages | vitest nav-items.test.ts ran | `web/components/shell/nav-items.test.ts:25-26`, `:35-42` | PASS |
| C5349 | editor field order, preset rows, Save/Cancel | vitest template-editor.test.tsx ran | `web/components/templates/template-editor.test.tsx:29` (order test), `:56`, `:91`; route 200s at `web/app/(app)/templates/page.test.ts:113`, `web/app/(app)/templates/[templateId]/page.test.ts:72` | PASS |
| C5350 | invalid field keeps typed values and message beside field | vitest ran | `web/components/templates/template-editor.test.tsx:109-130`; `web/domain/agreement/template-form.test.ts:24` | PASS |
| C5351 | estimator forbidden no store; invalid answers errors; valid saves once and redirects | vitest template-actions.test.ts ran (fault M8 kills it) | `web/app/(app)/templates/template-actions.test.ts:30`, `:46-60` (`toHaveBeenCalledTimes(1)`, `NEXT_REDIRECT /templates?selected=`) | PASS |
| C5352 | duplicate names `<name> (copy)`, `(copy 2)` and opens the editor | vitest ran | `web/app/(app)/templates/template-actions.test.ts:100-105`; `web/domain/agreement/template-form.test.ts:50-57` (`copyName`) | PASS |
| C5353 | archive confirms, once, cancel calls nothing | vitest archive-control + template-actions ran | `web/components/templates/archive-control.test.tsx:63-82` (`expect(archive).toHaveBeenCalledTimes(1)`); `web/app/(app)/templates/template-actions.test.ts:122-129` | PASS |
| C5354 | redirects to /login and /templates, 404 for bad, unknown, foreign ids | vitest page tests ran (fault M8 kills it) | `web/app/(app)/templates/page.test.ts:87`, `:103-111`; `web/app/(app)/templates/[templateId]/page.test.ts:47`, `:53`, `:63`, `:67` | PASS |
| C5355 | store lists, maps 42501/22023/23505/P0002, unknown to unavailable | vitest templates.test.ts ran (fault M9 kills it) | `web/infrastructure/supabase/templates.test.ts:17`, `:70` (`save maps %s to %s`), `:76`, `:88` | PASS |
| C5356 | create sends version only when given, 22023 to invalid_template, plan limit as before | vitest agreements.test.ts ran | `web/infrastructure/supabase/agreements.test.ts:176`, `:187`, `:194` | PASS |
| C5357 | Use template link, "From template", action passes version, plan-limit message | vitest ran (5 files) | `web/components/templates/template-preview.test.tsx:67` (href `/agreements/new?template=7777...`); `web/components/agreements/agreements-list.test.ts:167`; `web/app/(app)/plan-limit-actions.test.ts:74`, `:85` | PASS |
| C5358 | skippedCodes and the agreement page note | vitest ran | `web/domain/agreement/template.test.ts:175`; `web/components/agreements/agreements.test.ts:747-763` | PASS |
| C5359 | container exposes list, save, archive, duplicate; store takes the version | vitest templates-wiring.test.ts ran | `web/composition/templates-wiring.test.ts:33`, `:45`, `:56`, `:66` | PASS |

## Coverage

Recomputed from the plan's Surface, Landing and Relations and the code, not from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| invalid bodies SQL refuses (plan AC 4, door 4: 8) | `supabase/migrations/20261112240000_agreement_templates.sql:90-182` | each case in the loop at `supabase/tests/agreement_templates.sql:216` plus null body `:219` | - |
| `save_agreement_template` statuses (4) | Surface; migration `:205-224,236` | 200 `:151`; 42501 `:180`; P0002 `:166`; 22023 `:216`; (also 23505 `:230`, not in Surface, proven) | - |
| `archive_agreement_template` statuses (3) | Surface; migration `:261-271` | 200 `:379`; 42501 `:182`; P0002 `:388-390` | - |
| `create_agreement` statuses with a template (6) | Surface; migration `:329-353` | 200 `:270`; P0002 `:308`; 42501 `:275`; 23505 `:309`; 55000 `:498` (site_inactive is the unchanged plan-limits path, SQL recipes `agreement_builder`/`plan_limits`); 22023 `:294` | - |
| routes (3 plus `?selected` and `?template`) | plan Surface | `/templates` `web/app/(app)/templates/page.test.ts:49,87`; `/templates/new` `:103-113`; `/templates/[templateId]` `[templateId]/page.test.ts:47-72`; `/agreements/new?template` `web/app/(app)/agreements-list.test.ts:76,85` | - |
| roles on the screen (4) and writers (4) | plan Assumptions | `templates-view.test.tsx:83-95`; SQL `:180-182`, `:151-158` | - |
| optional sections (4 combinations) and always-drawn parts (3) | plan AC 10, 11 | `agreement-pdf.test.ts:355-361`; `document.test.ts:215-224`; review `template.test.ts:44-49` | - |
| frequency labels (6) | `derivedFrequency` code `web/domain/agreement/template.ts:203-211` | `template.test.ts:111-121` (also the `?? "Mixed"` fallback for 3, 5 visits is unasserted, benign) | - |
| preview rows (4), card parts (6), editor fields (9) | binding source, plan AC 16, 18 | `template-preview.test.tsx:51`; `template-card.test.tsx:39-48`; `template-editor.test.tsx:29` | - |
| ways the pin is set (4) and sent-pin freeze | plan door 3, 5 | create `:270`, create without `:306`, send `:325`, revise `:346`, trigger `:359` | - |
| template read failures (3) | plan AC 14 | reader `agreements.test.ts:876-880`; PDF route `route.test.ts:238`; portal `portal.test.ts:126` | - |
| consumers of the document (4) | plan Impact | PDF `agreement-pdf.test.ts:334`; staff preview `route.test.ts:245`; review `template.test.ts:31`; portal `portal.test.ts:102` | - |
| arrangement of the Templates screen: regions (2), grid columns (2), stacked (1), nesting, card top row (icon left, menu right), card footer (left, right) | binding source screenshot | C5341, C5342 assert only order and class substrings (mutants M1-M3 survive) | two-region nesting; side by side from xl; stacked below xl; card top-row left/right; footer left/right |
| body rules both sides agree on (plan door 2, door 4, AC 4) | migration `:90-182` vs `web/domain/agreement/template.ts:135-180` | see Other findings F1: TS has no 64 KB rule, no 80-char code rule, no price ceiling; SQL has no variable whitelist | 64 KB cap in `validateAgreementTemplate` (no check names it in TS); not a check member, reported as finding F1 |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration `save_agreement_template`, `archive_agreement_template`, `create_agreement`, `send_agreement` pin, pin trigger, RLS; adapters `web/infrastructure/supabase/templates.ts`, `agreements.ts` | boundary SQL as the role `supabase/tests/agreement_templates.sql`; adapter mapping `web/infrastructure/supabase/templates.test.ts:70`, `agreements.test.ts:187` | yes (pin trigger, RLS and the send pin have no adapter that maps a code, so SQL is the whole proof) |
| Decides, not reached across a boundary | `web/domain/agreement/template.ts`, `template-form.ts`, `document.ts` | one at own layer, one case per row: 12 validation rules at `template.test.ts:40-61`, frequency 6, preview, skippedCodes, document sections 4 | yes |
| Screens | `templates-view.tsx`, `template-card.tsx`, `template-preview.tsx`, `template-editor.tsx`, review sections | one render test per region asserting controls, order and count; each member of the binding-source enumeration | no - arrangement members (two-region structure, side-by-side/stacked, card row left/right) are not asserted structurally; mutants M1-M3 survive (finding B1, B2) |
| Instrumentation | `template-actions.ts`, `composition/index.ts`, PDF drawing of rendered lists | one proof each at the consumer | yes: `template-actions.test.ts:46-60`, `templates-wiring.test.ts:33-66`, `agreement-pdf.test.ts:334` |

## Faults injected

Mutants were applied on the real tree and reverted with `git checkout -- <file>` on exactly the touched files; `git status --short` showed only the untracked `node_modules/` afterwards (baseline identical). No worktree was used.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1: move `<TemplatePreview>` inside the card `<section>` (breaks two regions) | `web/components/templates/templates-view.tsx:60-61` | no - `templates-view.test.tsx` 13 passed |
| M2: delete `xl:grid` from the container (never side by side) | `web/components/templates/templates-view.tsx:48` | no - `templates-view.test.tsx` passed |
| M3: remove `justify-between` from card top row and footer row | `web/components/templates/template-card.tsx:62,84` | no - `template-card.test.tsx` passed (21 tests across M2 and M3 passed) |
| M4: `save_agreement_template` role list adds `estimator` | `supabase/migrations/20261112240000_agreement_templates.sql:217` | yes - `FAIL agreement_templates: C5302 save new uE: expected SQLSTATE 42501, statement succeeded` |
| M5: preset null price becomes 1 instead of 0 | `supabase/migrations/20261112240000_agreement_templates.sql:295` | yes - `C5314 line 2 null price is 0` |
| M6: PDF always draws the schedule (`showSchedule = true`) | `web/infrastructure/documents/agreement-pdf.tsx:12` | yes - `agreement-pdf.test.ts` C5321 schedule hidden, both hidden |
| M7: `MAX_PRESET_TERM_MONTHS` 60 to 61 | `web/domain/agreement/template.ts:41` | yes - C5324 `rejects a term of 0`/`61` fail |
| M8: `canWriteTemplates` becomes `role !== "viewer"` | `web/components/templates/state.ts:18-19` | yes - C5340, C5344, C5345, C5351, C5352, C5353, C5354 fail (13 tests) |
| M9: adapter maps `23505` to unavailable | `web/infrastructure/supabase/templates.ts:14` | yes - `C5355: save maps 23505 to name_taken` fails |

Surfaces covered: SQL role gate, SQL preset copy, PDF section gating, domain bound, server-side role gate and screens by role, adapter code mapping. The three surviving mutants are all on the arrangement surface.

## Gate

- `npx vitest run --reporter=verbose` (web/): 286 files, 4779 tests passed, 0 failed.
- `npm run test:db agreement_templates` (web/): PASS agreement_templates, 1 passed, 0 failed (replayed in a rolled-back transaction; the hosted project is untouched).
- `npx tsc --noEmit -p .`: 2 errors, both in the known pre-existing set (`.next/`, `app/setup/draft-actions.test.ts`); none in the feature.
- `npx eslint` on the 71 added or modified .ts/.tsx/.mts files under `web/` in the diff: exit 0, no output.
- Not run, by instruction: browser pass, the other SQL recipes (`customer_portal`, `rls_isolation` fail with or without the feature; `agreement_builder` and `contract_templates` hold the known stale assertions).

## Adversarial checks

(a) Migration `supabase/migrations/20261112240000_agreement_templates.sql`.
- `create_agreement` (`:315-369`) against `20261112220000_plan_limits.sql:60-87`: site lookup `P0002` (`:329`), role check `42501` (`:333`), site-inactive `55000` with a `for share` lock (`:337-340`), advisory lock (`:343`), `assert_agreement_capacity` (`:344`) before template validation (`:346`), numbering (`:355`) and default term (`:358-359`) all kept; the one-argument call still resolves through the default parameter and the PostgREST adapter sends the version only when given (`web/infrastructure/supabase/agreements.ts` diff). The old overload is dropped (`:313`), so there is one function; the stale recipe assertions naming `create_agreement(uuid)` are the known, accepted ones.
- `send_agreement` (`:399-429`) differs from `20261102222043_proposal_expiry.sql:53-82` only by `perform private.pin_system_agreement_template(...)` before the transition. It pins only a draft, only the latest version, only a null pin, only for a role that may send (`:384-392`); a viewer or a non-draft still gets the transition's `42501`/`40001`; a failing send rolls the pin back with the transaction.
- `apply_agreement_transition` (`:435-512`) against `20261104090000_versioning.sql:39-116`: diff is exactly the `template_version_id` column added to the revise insert (diffed line by line).
- `portal_view` (`:519-592`) against `20261111100000_tenant_logo.sql:37-109`: diff is exactly the `template` key (`:588-589`), read from the link's own version pin, falling back to the system v1.
- Pin trigger (`:38-60`): `before update of template_version_id`, fires only on change, refuses unless the version is the latest of a draft agreement; members have no update grant on `agreement_versions` (`20261027212052_service_included.sql:62`), so the trigger is the second guard; proven at `supabase/tests/agreement_templates.sql:359-366`.
- RLS and grants: save and archive are `security definer`, `revoke from public, anon`, `grant to authenticated` (`:247-248`, `:275-276`), role checked with `has_org_role(owner, admin)` after resolving the template's own org (`:213-219`), so an estimator, a viewer, a non-member and anon get `42501` (SQL `:180-187`) and an id of another org reads as `P0002` (`:166`); `document_templates` and versions have select-only policies for members (`20261112230000_contract_templates.sql:62-66`), no function returns another org's template to a member (the reader is RLS-bound, C5313).
- Name uniqueness under concurrency: both saves take the per-org advisory lock (`:227`) before the name comparison (`:228-236`), and a rename, a new template and the version number all happen under it; no unique index backs it, but no other writer exists (members have no insert on the tables, C5313).
- Preset (`:280-304`): null price becomes 0 (`:295`, fault M5), codes match by `t.code` within `p_org` (`:300-302`), term override only when not null (`:358`), line trigger rules apply because the helper is `security invoker`.

(b) `validateAgreementTemplate` (`web/domain/agreement/template.ts:135-180`) against the SQL body check (`...sql:90-182`): the term bound agrees at 1-60 (`template.ts:41,166`; `...sql:135-139`). Differences: see F1.

(c) AC 9 output unchanged: `git diff f762140 --stat` shows edits to existing test files only in these mechanical places: `web/composition/composition.test.ts` (C748 signature text gains the optional parameter), `web/app/(app)/agreements-list.test.ts` and `web/app/(app)/agreements/[agreementId]/page.test.ts` (one container member each), `web/scripts/test-db/runner.test.ts` (recipe and file counts 37 to 38, 39 to 40), `web/infrastructure/supabase/agreements.test.ts` (`agreementRow` fixture signature), `web/application/use-cases/portal.test.ts` and `web/infrastructure/documents/agreement-pdf.test.ts` (import lines only); `web/domain/agreement/document.test.ts`, `web/infrastructure/supabase/portal.test.ts`, `web/components/agreements/*.test.ts`, `plan-limit-actions.test.ts`, `pdf/route.test.ts` and `nav-items.test.ts` have additions only (no removed lines). No existing assertion was weakened. All pre-existing agreement PDF and review tests pass unedited in the full run. Caveat: C5332's "document of before" arm builds the legacy document with the same builder (`agreement-pdf.test.ts:365-367`), so the real "unchanged" evidence is the unedited existing tests, which pass.

(d) Portal path: `portal_view` reads the template only through the link's own `agreement_versions.template_version_id` (`...sql:588-589`); a token holder gets no template of another org through any application path, because `create_agreement` validates org and kind (`:349`) and members cannot update the pin. See O1 for the one bypass.

(e) Editor and actions: role gating is server-side in `web/app/(app)/templates/template-actions.ts:14-19,29-31,52-53,63-64` (`writer()` returns null for estimator and viewer, tested at `template-actions.test.ts:30,107,132`) and again in the definer functions; `/templates/new` and `/[templateId]` redirect non-writers (`web/app/(app)/templates/new/page.tsx:17`, `[templateId]/page.tsx:20`); a forged template id of another org: save and archive answer `P0002` (SQL `:166`, `:388`), the editor route finds nothing in the RLS-bound list and answers 404 (`[templateId]/page.tsx:32-33`, `page.test.ts:67`), duplicate looks the id up in the same list (`web/application/use-cases/templates.ts:24-29`); a forged `templateVersionId` at create: `isUuid` guard (`web/app/(app)/agreement-actions.ts` diff), then `22023` from the database (SQL `:294`); duplicate naming `<name> (copy N)` with the 80-char cut (`web/domain/agreement/template.ts:284-291`); archive asks first (C5353).

(f) Plan Impact and Flow versus code: Flow step 1-5 hold (reader, save action, create action with version, send pin, reader/portal/document/PDF/review); Impact rows hold (create_agreement optional second argument, `startAgreementAction` plain with `invalid_template` mapped to unavailable at `web/app/(app)/new-agreement-actions.ts` diff, send/portal/reader read one more column). The plan's "AC 12 pin is read as system v1 when null" is `SYSTEM_AGREEMENT_BODY` in the reader (`web/infrastructure/supabase/agreements.ts` `templateOf`) and the `coalesce` to `c102` in the database; the two are asserted equal by C5333.

## Other findings and observations (none contradicts a check)

- **F1 (medium, defect the checks do not cover; plan door 2 vs door 4).** `validateAgreementTemplate` accepts bodies the database refuses with `22023`: (i) no 64 KB cap (`migration:93-95`), although door 2's limits alone allow 30+30 blocks of 2,000 characters = 120,000 characters, so a body the plan's door 2 calls valid can exceed door 4's 64 KB; (ii) no 80-character limit on an equipment type code (`migration:172`, TS at `template.ts:120`); (iii) no price ceiling (`migration:179` caps cents at 1e12; `parseCents` and `template.ts:125` do not). The action maps the store's `invalid` to `unavailable` (`web/app/(app)/templates/template-actions.ts:42-43`), so the owner sees a generic failure instead of a field message. Needs a precision decision: add the size cap and the two bounds to the TS rule (and a C5324 case) or drop door 4's 64 KB. Conversely the database does not check the variable whitelist (comment at `migration:62-63`), so a body written straight through the RPC with an unknown variable is stored and then makes `supabaseAgreementTemplateReader.list` return unavailable for the whole org (`web/infrastructure/supabase/templates.ts:46-49`), blocking the Templates screen; only an owner or admin can write it.
- **O1 (low).** The pin is validated for org and kind only in `create_agreement`. `agreement_versions` accepts inserts from owner, admin and estimator (`20261019174738_init.sql:302-309`), and the FK `template_version_id` is not org-scoped, so a member who knows another org's template version uuid could insert a version pinned to it, and the definer `portal_view` would hand that body to the token holder. The uuid is unguessable and no page does this; a composite FK or insert trigger would close it.
- **O2 (low).** `create_agreement` accepts a version of an archived template (`migration:346-353`); the UI hides archived templates and ignores unlisted versions, so only a stale link is affected.
- **O3 (low).** `save_agreement_template(null, ...)` picks the first membership with `limit 1` (`migration:209`), the same single-org assumption as `20261110190000_set_org_plan.sql:15`.
- **O4 (low).** `portal_view` returns the whole template body (internal name, description, preset prices) to the review request; it is server-side and the review page draws only intro, footer and sections, so nothing is displayed.
- **O5 (low).** The screenshot's persona is an Estimator who sees New template, the card menu and Duplicate; AC 21 and C5344 hide them from estimators, and the plan does not list it among the deliberate differences. Judged out of the binding scope because the persona label belongs to the excluded sidebar card.
- **O6 (low).** Preview row 2's label follows the org's item words (`template-preview.tsx:49`; test `template-preview.test.tsx:78-84`), so C5343's "Equipment types" holds for the default words only.

## Failing checks and gaps, ranked

1. C5341 - `web/components/templates/templates-view.test.tsx:55-70` - arrangement (two regions, side by side from xl, stacked, grid columns) unproven; mutants M1, M2 survive; code classes match the claim (`templates-view.tsx:48-49`).
2. C5342 - `web/components/templates/template-card.test.tsx:39-48` - menu top right and footer left/right unproven; mutant M3 survives (`template-card.tsx:62,84`).
3. Test policy row "Screens" unmet for the same members.
4. F1 - `web/domain/agreement/template.ts:135-180` vs `supabase/migrations/20261112240000_agreement_templates.sql:93,172,179` - validation parity gap (not a check member).
