# Agreement template switch checks

Profile: ui

## Intent

Today the agreement page never says which template the agreement is using, and the template cannot be changed once the agreement is created. This shows the template's name on every version of the page, and lets a writer switch the template of a draft's current version. Only the pin changes: the service lines, term and scope stay as they are, and the PDF preview redraws with the new layout and wording. A sent, accepted or older version keeps its pin (the database already freezes it).

14 checks · 1 migration (applied by the owner) · 0 open

## Checks

**C7101** - `set_agreement_template` pins the current version of a draft to an org template, then to the system template, leaving an older version's pin alone
Proof: `npm run test:db agreement_template_switch` (assertions `C7101`; against the hosted objects of the applied migration `20261116150000_agreement_template_switch.sql`, rolled back)

**C7102** - Choosing the template the version already has succeeds and changes nothing
Proof: `npm run test:db agreement_template_switch` (assertions `C7102`)

**C7103** - A sent agreement refuses with `P0001` and keeps its pin; an unknown agreement raises `P0002`
Proof: `npm run test:db agreement_template_switch` (assertions `C7103`)

**C7104** - A template version of another org, and an id that is no agreement template, raise `22023` and pin nothing
Proof: `npm run test:db agreement_template_switch` (assertions `C7104`)

**C7105** - A viewer, another org's owner and an anonymous caller raise `42501` and pin nothing
Proof: `npm run test:db agreement_template_switch` (assertions `C7105`)

**C7106** - The reader returns `templateVersionId` for the shown version: the pinned id, `null` for a version nobody pinned (the system template)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C7106:"`

**C7107** - The store calls `set_agreement_template` with the agreement id, the template version id and nothing else, and maps `42501` to `forbidden`, `P0002` to `not_found`, `P0001` to `locked`, `22023` to `invalid_template` and any other error to `unavailable`
Proof: `npx vitest run infrastructure/supabase/agreement-template.test.ts -t "C7107:"`

**C7108** - `setAgreementTemplateAction` refuses a viewer with `forbidden` before any call, answers `not_found` for a malformed id, calls the store once for a writer and revalidates the agreement page and the pipeline, and returns the store's refusal code otherwise
Proof: `npx vitest run "app/(app)/agreement-template.test.ts" -t "C7108:"`

**C7109** - The agreement page shows `Template: <name>` for a draft and for a sent agreement (from the pinned body, the system name when nothing is pinned)
Proof: `npx vitest run components/agreements/template-picker.test.tsx -t "C7109:"`

**C7110** - A writer on an editable version sees a template choice listing every template offered, the current one selected, and a Change template button; a viewer, a sent agreement and an older version see the name only
Proof: `npx vitest run components/agreements/template-picker.test.tsx -t "C7110:"`

**C7111** - Pressing Change template asks the action for the chosen template version, does nothing when the current one is chosen, and shows the refusal message when the action refuses
Proof: `npx vitest run components/agreements/template-picker.click.test.tsx -t "C7111:"`

**C7112** - The PDF preview's revision key differs when only the template differs
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C7112:"`

**C7113** - A live browser run of a draft's page at 375, 768 and 1440 shows the name, the choice and the button with no horizontal scroll and no console errors, and a change redraws the preview (run 2026-11-16 on the hosted project after the owner applied the migration: panel at 375, 768 and 1440 without horizontal scroll or console errors; at 375 a click switched the real draft AG-1001 to the org copy of Standard agreement and back to the built-in one, the name updated and no alert showed. AG-1001 is now pinned to the built-in template, which is what an unpinned draft means)
Proof: live Playwright run

**C7114** - The full test set is no worse than the failures that existed before (kanban, shell, pricing, purity listing agreements-list and pipeline-view, vocabulary C2019)
Proof: `npx vitest run` (compared with the known list)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `set_agreement_template` outcomes (6) | pinned C7101 · same C7102 · `P0001` C7103 · `P0002` C7103 · `22023` C7104 · `42501` C7105 | - |
| store error mapping (5) | `42501` C7107 · `P0002` C7107 · `P0001` C7107 · `22023` C7107 · other C7107 | - |
| views of the template (4) | writer on editable draft C7110 · viewer C7110 · sent agreement C7110 · older version C7110 | - |
| action outcomes (4) | forbidden C7108 · not_found C7108 · saved C7108 · store refusal C7108 | - |

- Claims naming a status or error code: C7103, C7104, C7105, C7107 - each proof crosses the boundary

## Swept

- validation: C7104, C7108
- failure modes: C7107
- idempotency: C7102
- authorization: C7105, C7108
- concurrency: n/a - the pin trigger already refuses a version that stopped being the current draft meanwhile (`55000`), and a lost race reads as `unavailable`
- data lifecycle: n/a - nothing new is stored; the pin column exists
- dependency failure: C7107
- state transitions: C7103
- observability: n/a - no logging requirement

## Known limits

- Switching changes the layout, wording and terms text only. A template's preset service lines are copied once, when an agreement is created from it; switching later never adds or removes lines.
- A template that was edited after the agreement pinned an older version is not upgraded automatically; picking the same template again picks its latest version, so it is offered under the same name.

## Handoff

- one builder, about 10 files, about 25k, under the 150k budget
