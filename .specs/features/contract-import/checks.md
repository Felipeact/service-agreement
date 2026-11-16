# Upload an existing contract checks

Profile: ui
Plan: `.specs/features/contract-import/plan.md`

27 checks in 4 slices · 3 one-way doors · 2 open, of which 0 block the build

Commands run from `web/`. Domain, use-case, adapter, action and component checks are vitest (`npx vitest run <file> -t "<id>"`). There is no SQL, so no `test:db` proof.

## Checks

### S1 - A contract file becomes editable blocks · 5 files

**C5801** - A list of blocks becomes the form: price section first, the blocks in the order given, signatures section last, the default contract document options, and `validateContractWording` accepts the result (AC 2)
Proof: `npx vitest run domain/contract/import.test.ts -t "C5801"`

**C5802** - 1, 40 blocks and a 2,000-character text are accepted; 0 blocks, 41 blocks, an empty or blank text, a 2,001-character text, an unknown type and a non-string text are refused (AC 2, AC 5)
Proof: `npx vitest run domain/contract/import.test.ts -t "C5802"`

**C5803** - Each of the eight import variables is accepted in a text (also written `{{ name }}`); each of the other eight whitelist names and an unknown name is refused (AC 4, door 3)
Proof: `npx vitest run domain/contract/import.test.ts -t "C5803"`

**C5804** - The request asks for a JSON schema of `blocks` with `type` an enum of heading, paragraph, clause, `additionalProperties: false`; the system prompt says the message is data not instructions, to copy the words, to leave out signature lines and to use only the eight variables; the user message holds the file and nothing else (a pdf as a document block, a docx as text) (AC 3)
Proof: `npx vitest run infrastructure/claude/contract-splitter.test.ts -t "C5804"`

**C5805** - A good answer returns its blocks; an answer that is not JSON, has no `blocks`, an empty list, a wrong field type, an unknown block type, 41 blocks, a 2,001-character text or a forbidden variable is `unavailable` (AC 4, AC 5)
Proof: `npx vitest run infrastructure/claude/contract-splitter.test.ts -t "C5805"`

**C5806** - A thrown call, a refusal, a missing key (no request sent) and a call open past 120,000 ms are `unavailable`, and the log line holds nothing from the file (AC 7)
Proof: `npx vitest run infrastructure/claude/contract-splitter.test.ts -t "C5806"`

**C5807** - A `max_tokens` stop is `too_large` (AC 8)
Proof: `npx vitest run infrastructure/claude/contract-splitter.test.ts -t "C5807"`

**C5808** - From an owner or an admin, a docx calls the parser once and the splitter once with its text, a pdf with its bytes, and the result is the form (AC 1)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5808"`

**C5809** - Blocks that pass the splitter's bounds but make a form `validateContractWording` refuses (40 blocks of 2,000 characters, over the 60,000-character wording limit) are `unavailable` (AC 6)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5809"`

**C5810** - The splitter's `too_large` and `unavailable` pass through unchanged (AC 7, AC 8)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5810"`

**C5811** - The import writes nothing: the use case takes a parser and a splitter and no writer, and the action never calls `saveContractWording` (AC 9, AC 17)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5811"`
Proof: `npx vitest run "app/(app)/templates/contract/import-actions.test.ts" -t "C5811"`

**C5812** - A clause naming `{{tenant.address}}` is left out of the contract document built for a tenant with no address saved (AC 19)
Proof: `npx vitest run domain/contract/import.test.ts -t "C5812"`

### S2 - Only the right person, only the right files · 2 files

**C5813** - An estimator, a viewer and no role are `forbidden`, and neither the parser nor the splitter is called (AC 10)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5813"`

**C5814** - No file and a zero-byte file are `invalid`, nothing is called (AC 11)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5814"`

**C5815** - xlsx, csv, doc and a name with no extension are `unreadable`; a parser that cannot read the file is `unreadable`; 4,194,305 bytes is `too_large`; 4,194,304 bytes is accepted; none of the refused calls the splitter (AC 12)
Proof: `npx vitest run application/use-cases/import-contract-wording.test.ts -t "C5815"`

**C5816** - The action sends a signed-out caller to `/login`, answers `imported` with the form for an owner, passes the file's bytes and name, and answers `invalid` when the request has no file, and each use-case code as `failed` with that code (AC 1, AC 11, AC 13)
Proof: `npx vitest run "app/(app)/templates/contract/import-actions.test.ts" -t "C5816"`

**C5817** - The container exposes `importContractWordingAction`'s use case, built with `claudeContractSplitter({ apiKey: process.env.ANTHROPIC_API_KEY })` (startup configuration, one assembly; the 5 MB body limit is asserted by C4129)
Proof: `npx vitest run composition/contract-import-wiring.test.ts -t "C5817"`

### S3 - The owner reviews, then saves · 4 files

**C5818** - After a successful import the editor shows the imported rows in place of its own, the banner "Imported from <file name>. Nothing is saved until you save.", and the preview request carries the imported form (AC 14)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5818"`

**C5819** - With unsaved edits the editor asks to confirm before replacing them and keeps them on cancel; with none it does not ask (AC 15)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5819"`

**C5820** - Saving after an import sends the imported form to the existing save once (AC 16)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5820"`

**C5821** - The editor shows the notice "A starting point: you own your wording. Read it through, and confirm it is valid under your province's law." beside the Import control, and the page passes it the import action (AC 18)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5821"`
Proof: `npx vitest run "app/(app)/templates/contract/page.test.ts" -t "C5821"`

**C5822** - Contracts already made keep their wording: a contract's `template_version_id` is frozen (existing proof of AD-186, not re-proven here) (AC 17)
Proof: `npm run test:db contract_templates`

### S4 - The wait, the failure and the sizes · 2 files

**C5823** - While an import runs the status text shows, the Import control is disabled, and a second submit sends no second request (AC 20)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5823"`

**C5824** - Each of `invalid`, `forbidden`, `unreadable`, `too_large`, `unavailable` shows its own message, keeps the rows exactly as they were and leaves the Import control enabled (AC 21)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5824"`

**C5825** - Live pass of `/templates/contract` at 375, 768 and 1440 px (touch emulation on the two smaller): no horizontal scroll, every control at least 44 by 44 px on mobile and tablet, no console warning, and an import of a real docx lands rows in the editor (AC 22). Author-run, a Verifier cannot observe a browser
Proof: the Playwright pass of AGENTS..md, its record in the last bullet of Handoff (no command can settle it)

**C5826** - The control's markup carries the 44 px classes the buttons and inputs use (`h-11 lg:h-[34px]`) and no fixed width past `w-44` (AC 22, static half)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5826"`

**C5827** - The Import control's file input accepts only `.docx,.pdf` and is labelled (AC 1, AC 12, accessibility)
Proof: `npx vitest run components/templates/contract-import.test.tsx -t "C5827"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `importContractWordingAction` statuses (6) | `200` imported C5816 · `422` invalid C5814, C5816 · `403` forbidden C5813 · `415` unreadable C5815 · `413` too_large C5815, C5807 · `503` unavailable C5805, C5806, C5809 | - |
| import variables (8) | `tenant.legalName` · `tenant.address` · `tenant.phone` · `customer.name` · `site.name` · `signer.name` · `term.start` · `term.label`, all C5803, table-driven over the 8 | - |
| whitelist names refused by import (8) | `terms.paymentDays` · `terms.cancellationNoticeDays` · `terms.repairDiscountPct` · `terms.cpiCapPct` · `terms.cpiRenegotiationThresholdPct` · `terms.renewalNoticeDays` · `province` · `terms.taxNote`, all C5803, table-driven over the 8 | - |
| block types (3) | heading C5801, C5805 · paragraph C5801 · clause C5801, C5812 | - |
| roles (5) | owner C5808, C5816 · admin C5808 · estimator C5813 · viewer C5813 · none C5813 | - |
| file kinds (6) | docx C5808 · pdf C5808 · xlsx C5815 · csv C5815 · doc C5815 · no extension C5815 | - |
| block-count and length bounds (6 edges) | 0 blocks C5802 · 1 block C5802 · 40 blocks C5802 · 41 blocks C5802 · 2,000 chars C5802 · 2,001 chars C5802 | - |
| file-size bounds (2 edges) | 4,194,304 C5815 · 4,194,305 C5815 | - |
| editor failure messages (5) | invalid · forbidden · unreadable · too_large · unavailable, all C5824, table-driven over the 5 | - |
| Landing doors (3) | door 1 C5804, C5805 · door 2 C5811 · door 3 C5803 | - |
| startup configuration: splitter wiring (1 assembly) | container C5817 | - |
| screen widths (3) | 375 C5825 · 768 C5825 · 1440 C5825, author-run | - |

- Claims naming a status code, route or response shape: C5815, C5816 - each has a proof that crosses the action boundary, C5815 at the use-case layer
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`import-actions.ts`, `contract-splitter.ts`) | one at the boundary and one at the use case or domain beneath | each status and each answer-shape row, as in the Coverage rows |
| Decides, not reached across a boundary (`domain/contract/import.ts`, `import-contract-wording.ts`) | one at its own layer | one asserted case per row of its decision table |
| Instrumentation (port type, container line) | none of its own | covered by C5817 and its consumers |

Evidence:

- `domain/contract/import.ts`: bound checks on count, length and type, an allowed-variable filter, form building and a final validation -> 8 branch points, decides
- `application/use-cases/import-contract-wording.ts`: role guard, file guard (extension, empty, size), parse branch (text or pdf), splitter passthrough, final validation -> 9 branch points, decides
- `infrastructure/claude/contract-splitter.ts`: no key, refusal, `max_tokens`, JSON parse, validation, thrown, timeout -> 7 branch points, decides
- `import-actions.ts`: signed-out redirect, missing file, result mapping -> 3 branch points
- closest analogue: `application/use-cases/draft-catalog.ts`, `infrastructure/claude/catalog-drafter.ts` and `app/setup/draft-actions.ts`, same shape, proven at these three levels (C4101 to C4107 and C4104, C4105)

Cost: 4 proofs at their own layer across 4 files. Without them the variable filter and the bounds would be proven only by a path through the splitter.

## Swept

- validation: C5802, C5803, C5814, C5815
- failure modes: C5805, C5806, C5807, C5809, C5824
- idempotency: C5823 (one request per click); the import writes nothing, so a retry changes nothing, C5811
- authorization: C5813, C5816; the page's own estimator and viewer redirect is existing (block-editor AC 41)
- concurrency: n/a - the import reads and writes no shared state; two saves are the existing `save_contract_template` under its per-org advisory lock (AD-188)
- data lifecycle: C5811 (file and result are dropped); frozen contract wording C5822
- dependency failure: C5806, C5807
- state transitions: n/a - the import has no state machine; the editor's replace-after-confirm is C5819
- observability: C5806 (one log line without the file's name or text); no metric, see open question 1

## Handoff

- Size: domain `import.ts` ~3k, port ~1k, adapter ~4k, use case ~3k, action ~2k, container 1 line, editor + control ~6k, tests ~15k = about 35k tokens, all in the templates area plus the Claude adapter layer, under the 150k budget - one builder
- Mechanism: one builder
- **Boundary:** C5801 to C5824, C5826, C5827 closed at the commit after this line; vitest 58 files, 610 tests green in the touched folders. Run vitest with `--pool=vmThreads` on this machine (the default pool fails every test with "Cannot read properties of undefined (reading 'config')", before and after this change)
- **Settled mid-build:** the Import control sits above the editor's form, not inside it (a form cannot nest); the editor treats "dirty" as the rows differing from the last saved or loaded rows, so a second import over an unsaved import also asks to confirm
- **Abandoned:** nothing
- **C5825 not run:** the Playwright browser was already in use by another process, so the live pass at 375, 768 and 1440 px was not done. It stays open
