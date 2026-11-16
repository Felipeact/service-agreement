# Agreement template switch verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 4b79d13..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| - | none marked in checks.md (bounded batch with an Intent section, no plan.md) | none | - |

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7101 | pins current version of a draft to org then system template, older version untouched | `npm run test:db agreement_template_switch` exit 1: `function "set_agreement_template" already exists with same argument types` (the function is already on the hosted project with a body identical to the migration, so the replayed `create function` collides). The same recipe with `create or replace`, in the rolled-back transaction: `agreement_template_switch: pass` | `supabase/tests/agreement_template_switch.sql` - `C7101 pinned`, `C7101 older version untouched`, `C7101 system` | FAIL (proof as written is red; modified copy green) |
| C7102 | same template succeeds, changes nothing | as C7101 | `agreement_template_switch.sql` - `tests.ok('C7102 same', ... = SYS)` | FAIL (as C7101) |
| C7103 | sent refuses P0001 and keeps pin; unknown agreement P0002 | as C7101 | `expect_error('C7103 sent', ..., 'P0001')`, `expect_error('C7103 missing', ..., 'P0002')` | FAIL (as C7101) |
| C7104 | other-org version and non-template id raise 22023, pin nothing | as C7101 | `expect_error('C7104 other org template', ..., '22023')`, `'C7104 not a template'` | FAIL (as C7101) |
| C7105 | viewer, other org owner, anon raise 42501, pin nothing | as C7101 | `expect_error('C7105 viewer' / 'C7105 other org' / 'C7105 anon', ..., '42501')` | FAIL (as C7101) |
| C7106 | reader returns templateVersionId (pinned id, null for unpinned) | `npx vitest run infrastructure/supabase/agreements.test.ts -t "C7106:"` 2 passed | `infrastructure/supabase/agreements.test.ts:310` - `expect(detail?.templateVersionId).toBe(expected)` | PASS |
| C7107 | store calls the rpc with two ids; maps 42501/P0002/P0001/22023/other | `agreement-template.test.ts -t "C7107:"` 7 passed | `infrastructure/supabase/agreement-template.test.ts:11` and the per-SQLSTATE tests (P0001 to locked confirmed by mutant) | PASS |
| C7108 | action: forbidden before call, not_found malformed, calls store once and revalidates, returns refusal | `app/(app)/agreement-template.test.ts -t "C7108:"` 11 passed | `app/(app)/agreement-template.test.ts:33` `toEqual({ status: "forbidden" })`, `:41` not_found, `:47` saved, `:56` `{ status: code }` | PASS |
| C7109 | page shows `Template: <name>` for draft and sent | `template-picker.test.tsx -t "C7109:"` 1 passed; page-level `components/agreements/agreements.test.ts -t "C7109:"` 1 passed | `template-picker.test.tsx:18` `toContain("Template: Quarterly HVAC")`; `agreements.test.ts:843-844` draft and sent | PASS |
| C7110 | writer on editable version sees choices, current selected, button; viewer, sent, older version name only | `template-picker.test.tsx -t "C7110:"` 4 and `template-choices.test.ts -t "C7110:"` 5 passed | `template-picker.test.tsx:24-26` option, selected, `Change template` button; `:34` name-only cases | PASS (see finding 6 on the sent/older gate) |
| C7111 | asks action for chosen version; nothing when current; shows refusal | `template-picker.click.test.tsx -t "C7111:"` 5 passed | `:50` `toHaveBeenCalledWith("v-hvac")`, `:57` `expect(button.disabled).toBe(true)`, `:67` refusal messages in an alert | PASS |
| C7112 | preview revision differs when only template differs | stated command `template-picker.test.tsx -t "C7112:"` runs 0 tests (5 skipped): the test is not in that file. In the right file, `components/agreements/agreements.test.ts -t "C7112:"`, 1 passed | `components/agreements/agreements.test.ts:833-837` `expect(previewRevision({ ...base, templateVersionId: "v-two" })).not.toBe(a)` | PASS (proof path in checks.md is wrong, finding 2) |
| C7113 | live browser run at 375/768/1440, redraw on change | not observed: the migration is absent from the hosted migration history, the page needs a signed-in session, and Change template was not to be pressed. Dev server answers 200 on `/` | none | FAIL (not observed) |
| C7114 | full test set no worse than known failures | `npx vitest run` from `web/` in PowerShell: 33 failed in 6 files, all known: kanban/pipeline-view (28), kanban/expiring-view (1), shell/app-shell (1), pricing-catalog (1), vocabulary C2019 (1), purity C2021 (1; lists only `agreements-list.tsx` and `pipeline-view.tsx`). `tsc --noEmit` and eslint on the new component and page folder: no output | no failure in any file this feature touched | PASS |

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
| drop `and v.template_version_id is distinct from ...` | migration update (SQL) | yes, by reasoning only: survives C7102 but the mutant is equivalent (same-value write unobservable), not counted as a gap |

Two more TypeScript mutants were equivalent and are not counted (the redundant `chosen === selectedVersionId` guard in `apply`, behind a disabled button; `??` to `||` on the pinned id). TypeScript mutants restored exactly; `git status --porcelain` afterwards shows only the pre-existing `?? node_modules/`. The scratch runner placed in `web/scripts/test-db/` was deleted.

## Gate

`npx vitest run` - 33 failed (all in the known list), feature proofs C7106-C7112 35 passed, 0 failed.

## Findings

1. C7101-C7105: the stated proof is red. `npm run test:db agreement_template_switch` exits 1 with `function "set_agreement_template" already exists`. The hosted project already has `public.set_agreement_template(uuid, uuid)` with a body identical to the migration (read-only `pg_proc` check), although checks.md and the brief say the migration is not applied and `list_migrations` does not show it. So the "not applied" claim is wrong or the function was applied outside the migration history, and the recipe cannot be re-run because the migration uses `create function`, not `create or replace function`. A `create or replace` copy inside the rolled-back transaction passes in full.
2. C7112: the proof path in checks.md matches nothing. `template-picker.test.tsx -t "C7112:"` exits 0 with 5 skipped. The test is `components/agreements/agreements.test.ts:833`. A vacuous green command as written.
3. C7113 not observed (author-declared limit). Not loaded: the page needs a session and the only draft on hosted is real.
4. Design: only the pin changes. The update touches the max `version_no` of a draft; older versions are guarded by `agreement_version_pin_frozen` (mutant 1 showed it refuses) and sent agreements refuse with P0001. Other readers of the pin: the staff PDF route reads `agreement.template` live from the shown version (`pdf/route.ts:32`) so a draft PDF follows the switch after revalidation; the portal and contracts read the pin of a sent or frozen version (`portal.ts`, `contracts.ts`) and a draft has no live link. No stale PDF or portal view found.
5. System template reachable: `list` returns the org's templates and the system one (`templates.ts:30-56`), `templateChoicesOf` offers all and selects the system version when the pin is null, and re-adds a pinned version that is no longer the latest. If the reader fails the picker silently falls back to the name only.
6. Minor: the sent and older-version gate (`agreement.editable` in `agreement-view.tsx:167-171`) has no view-level assertion with choices supplied; C7110 proves only the picker with no choices.

FAIL stands on findings 1, 2 and 3. The code behaved correctly in every run, every killable mutant was killed, and C7114 holds.
