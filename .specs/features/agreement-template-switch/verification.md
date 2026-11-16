# Agreement template switch verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: 4b79d13..HEAD (round 2 fix range 62c762c..4cbf777)
**Round**: 2 - scoped (proofs re-run in full at HEAD 4cbf777; unchanged sections carried from 62c762c)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| - | none marked in checks.md (bounded batch with an Intent section, no plan.md) | none | - |

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7101 | pins current version of a draft to org then system template, older version untouched | `npm run test:db agreement_template_switch` exit 0: `PASS agreement_template_switch`, 1 passed, 0 failed (recipe now `fixture.sql` + `agreement_template_switch.sql` against the applied hosted function; hosted body md5 unchanged `4268d0d7...`, migration file unchanged since 62c762c) | `agreement_template_switch.sql` - `C7101 pinned`, `C7101 older version untouched`, `C7101 system`; round 1 SQL mutants (current-version filter, org scope, viewer role, draft check) were killed against the same body (carried from 62c762c) | PASS |
| C7102 | same template succeeds, changes nothing | `npm run test:db agreement_template_switch` exit 0: `PASS agreement_template_switch`, 1 passed, 0 failed (recipe now `fixture.sql` + `agreement_template_switch.sql` against the applied hosted function; hosted body md5 unchanged `4268d0d7...`, migration file unchanged since 62c762c) | `agreement_template_switch.sql` - `tests.ok('C7102 same', ... = SYS)`; round 1 SQL mutants (current-version filter, org scope, viewer role, draft check) were killed against the same body (carried from 62c762c) | PASS |
| C7103 | sent refuses P0001 and keeps pin; unknown agreement P0002 | `npm run test:db agreement_template_switch` exit 0: `PASS agreement_template_switch`, 1 passed, 0 failed (recipe now `fixture.sql` + `agreement_template_switch.sql` against the applied hosted function; hosted body md5 unchanged `4268d0d7...`, migration file unchanged since 62c762c) | `expect_error('C7103 sent', ..., 'P0001')`, `expect_error('C7103 missing', ..., 'P0002')`; round 1 SQL mutants (current-version filter, org scope, viewer role, draft check) were killed against the same body (carried from 62c762c) | PASS |
| C7104 | other-org version and non-template id raise 22023, pin nothing | `npm run test:db agreement_template_switch` exit 0: `PASS agreement_template_switch`, 1 passed, 0 failed (recipe now `fixture.sql` + `agreement_template_switch.sql` against the applied hosted function; hosted body md5 unchanged `4268d0d7...`, migration file unchanged since 62c762c) | `expect_error('C7104 other org template', ..., '22023')`, `'C7104 not a template'`; round 1 SQL mutants (current-version filter, org scope, viewer role, draft check) were killed against the same body (carried from 62c762c) | PASS |
| C7105 | viewer, other org owner, anon raise 42501, pin nothing | `npm run test:db agreement_template_switch` exit 0: `PASS agreement_template_switch`, 1 passed, 0 failed (recipe now `fixture.sql` + `agreement_template_switch.sql` against the applied hosted function; hosted body md5 unchanged `4268d0d7...`, migration file unchanged since 62c762c) | `expect_error('C7105 viewer' / 'C7105 other org' / 'C7105 anon', ..., '42501')`; round 1 SQL mutants (current-version filter, org scope, viewer role, draft check) were killed against the same body (carried from 62c762c) | PASS |
| C7106 | reader returns templateVersionId (pinned id, null for unpinned) | `npx vitest run infrastructure/supabase/agreements.test.ts -t "C7106:"` 2 passed | `infrastructure/supabase/agreements.test.ts:310` - `expect(detail?.templateVersionId).toBe(expected)` | PASS |
| C7107 | store calls the rpc with two ids; maps 42501/P0002/P0001/22023/other | `agreement-template.test.ts -t "C7107:"` 7 passed | `infrastructure/supabase/agreement-template.test.ts:11` and the per-SQLSTATE tests (P0001 to locked confirmed by mutant) | PASS |
| C7108 | action: forbidden before call, not_found malformed, calls store once and revalidates, returns refusal | `app/(app)/agreement-template.test.ts -t "C7108:"` 11 passed | `app/(app)/agreement-template.test.ts:33` `toEqual({ status: "forbidden" })`, `:41` not_found, `:47` saved, `:56` `{ status: code }` | PASS |
| C7109 | page shows `Template: <name>` for draft and sent | `template-picker.test.tsx -t "C7109:"` 1 passed; page-level `components/agreements/agreements.test.ts -t "C7109:"` 1 passed | `template-picker.test.tsx:18` `toContain("Template: Quarterly HVAC")`; `agreements.test.ts:843-844` draft and sent | PASS |
| C7110 | writer on editable version sees choices, current selected, button; viewer, sent, older version name only | `template-picker.test.tsx`, `template-choices.test.ts` (6) and the new view-level `agreements.test.ts -t "C7110:"` all pass | `template-picker.test.tsx:24-26`; new `agreements.test.ts:840-849` `toContain("Change template")` for the draft and `not.toContain(...)` for sent, older version (`shownNo: 1`) and viewer; `template-choices.test.ts` `toEqual(["Standard agreement", "Standard agreement (built in)"])` | PASS |
| C7111 | asks action for chosen version; nothing when current; shows refusal | `template-picker.click.test.tsx -t "C7111:"` 5 passed | `:50` `toHaveBeenCalledWith("v-hvac")`, `:57` `expect(button.disabled).toBe(true)`, `:67` refusal messages in an alert | PASS |
| C7112 | preview revision differs when only template differs | `npx vitest run components/agreements/agreements.test.ts -t "C7112:"` 1 passed (checks.md path corrected) | `components/agreements/agreements.test.ts:833-837` `expect(previewRevision({ ...base, templateVersionId: "v-two" })).not.toBe(a)` | PASS |
| C7113 | live browser run at 375/768/1440, redraw on change | Verifier loaded the signed-in dev server read-only (no click on Change template) at 375, 768, 1440: AG-1001 (draft) shows `Template: Standard agreement`, a select with options `Standard agreement` and `Standard agreement (built in)` (selected: built in) and a `Change template` button, `scrollWidth <= clientWidth` at all three widths, 0 console errors; AG-1002 (not a draft) shows the name only, no select, no button. The redraw after a change was not reproduced (writing to the real draft is out of bounds); it rests on the author's run in checks.md plus C7112 and the C7108 revalidate proof | observed values above (Playwright evaluate, this session) | PASS (render, choice, button, no scroll, no errors observed; the click-and-redraw leg is author-reported) |
| C7114 | full test set no worse than known failures | `npx vitest run` (PowerShell) at 4cbf777: 33 failed, 5483 passed, 6 files, all known: kanban/pipeline-view (28), kanban/expiring-view (1), shell/app-shell (1), pricing-catalog (1), vocabulary C2019 (1), purity C2021 (1). Same 33 as round 1 | no failing file is one this feature touched | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `set_agreement_template` outcomes (6) | migration `20261116150000` branches | pinned C7101 · same C7102 · P0001 and P0002 C7103 · 22023 C7104 · 42501 C7105 | - |
| store error mapping (5) | `TEMPLATE_CODES` in `infrastructure/supabase/agreements.ts` plus the fallback | C7107 per-code tests incl. XX000 and a thrown call | - |
| views of the template (4) | `agreement-view.tsx:167-171` (`editable` gate) and the picker props | writer, viewer, no-choices C7110; sent and older version rely on `agreement.editable` with no view-level test | - |
| action outcomes (4) | `setAgreementTemplateAction` | forbidden, not_found, saved, store refusal (all 5 codes) C7108 | - |
| DB denied callers (3) | role list in the migration | viewer, other org, anon C7105 | - |

## Test policy rows

No `Test policy` section in checks.md: nothing to judge; the repo convention (DB proof for the function, a unit proof per layer) was met.

## Faults injected

| Mutation | Location | Killed |
| --- | --- | --- |
| drop the current-version filter (`and true`) | migration update (SQL, rolled-back copy) | yes (the pin trigger refuses the older version, C7101 fails) |
| drop the org scope of the template check (`true`) | migration template exists check | yes (C7104 other org: statement succeeded) |
| add `viewer` to the role list | migration role check | yes (C7105 viewer) |
| draft check never fires (`false`) | migration status check | yes (C7103 sent got 55000) |
| P0001 mapped to invalid_template | `infrastructure/supabase/agreements.ts` TEMPLATE_CODES | yes (C7107) |
| drop template pin from the revision key | `agreement-view.tsx:176` | yes (C7112, agreements.test.ts) |
| drop `revalidatePath("/pipeline")` | `agreement-actions.ts` | yes (C7108, 3 failed) |
| `(built in)` label removed from the choice name | `template-choices.ts` | yes (2 tests in `template-choices.test.ts`, round 2) |
| unguard `choices` and `change` by `agreement.editable` together | `agreement-view.tsx` | yes (new view-level C7110, round 2; unguarding only one of the two survives, the other guard still hides the picker: equivalent) |
| drop `and v.template_version_id is distinct from ...` | migration update (SQL) | yes, by reasoning only: survives C7102 but the mutant is equivalent (same-value write unobservable), not counted as a gap |

Two more TypeScript mutants were equivalent and are not counted (the redundant `chosen === selectedVersionId` guard in `apply`, behind a disabled button; `??` to `||` on the pinned id). TypeScript mutants restored exactly; `git status --porcelain` afterwards shows only the pre-existing `?? node_modules/`. The scratch runner placed in `web/scripts/test-db/` was deleted.

## Gate

Round 2: `npm run test:db agreement_template_switch` 1 passed, 0 failed; feature proofs C7106-C7112 39 passed in 7 files; full `npx vitest run` 33 failed, all known.

Round 1 gate (carried): 
`npx vitest run` - 33 failed (all in the known list), feature proofs C7106-C7112 35 passed, 0 failed.

## Findings

Round 2 status of the round 1 findings:

1. Resolved: C7101-C7105 proof now runs against the applied function and passes; mutants carried from round 1.
2. Resolved: C7112 proof path corrected and the test runs.
3. Resolved (render legs): C7113 observed by the Verifier read-only; the click-and-redraw leg stays author-reported.
4. Design review stands: only the pin changes, older and sent pins stay frozen, the staff PDF reads the pin live, the portal and contracts read frozen or sent pins, the system template is offered ("(built in)" label, an org copy of the same name is told apart).
5. Resolved: view-level gate test added.

Remaining, none blocking:
- The hosted `supabase_migrations.schema_migrations` has no row for `20261116150000` (the function exists with the migration's exact body), so the history table and the migration folder disagree; the same holds for other recent migrations. Hygiene for the owner.
- The SQL mutants were not re-run after the recipe stopped replaying the migration; the function body is unchanged (md5 equal), so the round 1 kills carry.
