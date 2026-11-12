# Contract templates checks

Profile: standard
Plan: `.specs/features/contract-templates/plan.md`

26 checks in 3 slices · 4 one-way doors (approved: "implement", 2026-11-12) · 1 open, 0 block (blocks go-live only)

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C5200:`). This feature numbers from C5200 (C5146 is the highest id in use). `npx vitest run <file> -t "C5211:"` selects one.
- **SQL** recipe `contract_templates` runs with `npm run test:db contract_templates` from `web/` (new `supabase/tests/contract_templates.sql`, registered in `RECIPES` with the migration between `fixture.sql` and the test, as `plan_limits` did, so the hosted project needs no change until the owner applies it). Every run is rolled back; each assertion label starts with its check id.
- Supabase is never called by a vitest proof: adapters take a client double, use cases take fakes.
- Existing approved checks that name `clauses` (C1640, C1642, C1643, C1714 and the route and signing-document tests) keep their expected sentences and orderings; only the field they read or pass changes from `clauses: string[]` to `body: RenderedBlock[]`, as the plan's Impact row says.
- The plan's Flow named `create_contract`; contracts are written by `private.make_contract` (called by `create_contract` and by the automation), so the SQL proofs call `create_contract` and the migration redefines `make_contract`.

## Checks

### S1 - A contract freezes the template version it used · 3 files · ~30 KB · ~10k

**C5200** - There is exactly one system contract template (no org) with a version 1 whose body is `schema` 1 and whose blocks are one `heading` "Terms" followed by the six sentences as `clause` blocks, and a member of org A and a member of org B both read it (AC 1)
Proof: `npm run test:db contract_templates` (label C5200)

**C5201** - `create_contract` for an org with no template of its own writes the system template's latest version id on the new contract (AC 2)
Proof: `npm run test:db contract_templates` (label C5201)

**C5202** - `create_contract` for an org that has its own contract template writes that template's latest version id, not the system one (AC 3)
Proof: `npm run test:db contract_templates` (label C5202)

**C5203** - After a contract exists, inserting a newer version of the template it used leaves the contract's `template_version_id` unchanged (AC 4)
Proof: `npm run test:db contract_templates` (label C5203)

**C5204** - Updating or deleting a template version fails for the table owner and for an owner member of the org (AC 5)
Proof: `npm run test:db contract_templates` (label C5204)

**C5205** - An authenticated member inserting into `document_templates` or into `document_template_versions` is refused with `42501` (AC 6)
Proof: `npm run test:db contract_templates` (label C5205)

**C5206** - No `contracts` row has a null `template_version_id`, a row inserted without naming it points at the system version 1, and inserting an explicit null fails with `23502` (AC 7, door 2)
Proof: `npm run test:db contract_templates` (label C5206)

**C5207** - A member of org B does not see org A's own template or its versions, and still sees the system template (AC 8)
Proof: `npm run test:db contract_templates` (label C5207)

**C5208** - A second system contract template, a second contract template for one org, and a second version with the same `version_no` each fail with `23505` (door 1)
Proof: `npm run test:db contract_templates` (label C5208)

**C5209** - `contracts.template_version_id` names a real version: inserting a contract with an unknown id fails with `23503` (door 2)
Proof: `npm run test:db contract_templates` (label C5209)

**C5210** - `private.make_contract` run by the automation path (no signed-in user) also records the system version (AC 2, the W2 path)
Proof: `npm run test:db contract_templates` (label C5210)

### S2 - Blocks and merge variables render into the contract's terms · 2 files · ~15 KB · ~6k

**C5211** - Rendering the system version 1 with terms `paymentDays 30`, `cancellationNoticeDays 60`, `repairDiscountPct 10`, `cpiCapPct 5`, `governingProvince BC`, `renewalNoticeDays 30`, `cpiRenegotiationThresholdPct 5` and a 12 month term gives the heading "Terms" then exactly: "Invoices are payable within 30 days.", "Either party may cancel this contract with 60 days' written notice.", "Repair work is discounted by 10%.", "The annual price may rise with CPI, capped at 5%.", "This contract is governed by the laws of British Columbia.", "This contract renews for successive 12 months terms unless CPI is at or above 5%, when the parties renegotiate; the customer is notified 30 days before the end date." (AC 9)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5211:"`

**C5212** - A null `paymentDays`, a null `cancellationNoticeDays`, a null `governingProvince`, a null `renewalNoticeDays` and a null `cpiRenegotiationThresholdPct` each omit exactly their clause and keep the other five in order (AC 10)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5212:"`

**C5213** - A heading or a paragraph that uses a variable with no value is printed with the variable replaced by an empty string, and is not dropped (AC 11)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5213:"`

**C5214** - A block using `{{terms.unknown}}` is rejected by `validateBlocks` with the message naming `terms.unknown`, and `renderBlocks` renders a clause with it as omitted and a paragraph with it as an empty replacement (AC 12)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5214:"`

**C5215** - `validateBlocks` rejects schema 2, a block type `image`, 61 blocks and a text of 2,001 characters, each with its own reason, and accepts 60 blocks and a text of 2,000 characters (AC 13)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5215:"`

**C5216** - Days read `1 day` and `30 days`, the cancellation notice reads `1 day's` and `60 days'`, and a percentage reads `10%` for 10, `10%` for 10.0 and `7.5%` for 7.5 (AC 14)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5216:"`

**C5217** - A customer name of `{{terms.paymentDays}}` is printed as that text and not expanded (AC 15)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5217:"`

**C5218** - With no frozen terms the system version renders no blocks at all: the heading "Terms" has no clause under it and is dropped (AC 18, render side)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5218:"`

**C5219** - Every one of the eleven whitelisted variables resolves to a value for a full context, and the whitelist is exactly those eleven names (door 4)
Proof: `npx vitest run domain/contract/template.test.ts -t "C5219:"`

### S3 - The contract PDF and the signing documents draw from the stored version · ~10 files · ~70 KB · ~18k

**C5220** - `buildContractDocument` for a contract carrying an org template body renders that body's blocks in order (a heading, a paragraph using `{{customer.name}}`, a clause using `{{site.name}}`), and for a contract carrying no template renders the system version (AC 16 data)
Proof: `npx vitest run domain/contract/document.test.ts -t "C5220:"`

**C5221** - The contract PDF prints the rendered blocks after the scope and before the Signatures block, a heading in the second-level heading style and a clause or paragraph in the body style with 4 points below it (AC 16, AC 20)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5221:"`

**C5222** - A document whose body is empty prints no Terms section (AC 18)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C5222:"`

**C5223** - The contract reader returns the template body of the contract's own version, and throws (never answering the system wording) when the version row is missing, malformed or the read errors (AC 19, reader)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C5223:"`

**C5224** - The PDF route draws the template the reader returned, and when reading the contract throws the request fails the way any read failure does (the error propagates, as for the agreement read) and no PDF is drawn (AC 16, AC 19)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/pdf/route.test.ts" -t "C5224:"`

**C5225** - The document the signing flow hands to the provider (`makeContractDocuments`) is built from the contract's own template version, and a read that throws propagates (AC 17, AC 19)
Proof: `npx vitest run application/use-cases/signing-documents.test.ts -t "C5225:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| system sentences (6) | payment C5211 · cancellation C5211 · repair discount C5211 · CPI cap C5211 · province C5211 · renewal C5211 | - |
| optional terms that drop a clause (5) | `paymentDays` C5212 · `cancellationNoticeDays` C5212 · `governingProvince` C5212 · `renewalNoticeDays` C5212 · `cpiRenegotiationThresholdPct` C5212 | - |
| whitelisted variables (11) | `terms.paymentDays` C5219 · `terms.cancellationNoticeDays` C5219 · `terms.repairDiscountPct` C5219 · `terms.cpiCapPct` C5219 · `terms.cpiRenegotiationThresholdPct` C5219 · `terms.renewalNoticeDays` C5219 · `province` C5219 · `term.label` C5219 · `tenant.legalName` C5219 · `customer.name` C5219 · `site.name` C5219 | - |
| block types (3) | `heading` C5213 · `paragraph` C5213 · `clause` C5212 | - |
| invalid body reasons (4) | unknown schema C5215 · unknown block type C5215 · more than 60 blocks C5215 · text over 2,000 characters C5215 | - |
| template version mutations and writes (4) | update C5204 · delete C5204 · member insert into templates C5205 · member insert into versions C5205 | - |
| uniqueness constraints (3) | one system template per kind C5208 · one template per org per kind C5208 · `version_no` per template C5208 | - |
| contract table constraints (3) | not null C5206 · foreign key C5209 · default to system v1 C5206 | - |
| ways a contract is created (2) | `create_contract` by a member C5201, C5202 · automation path C5210 | - |
| consumers of the document (3) | PDF route C5224 · signing documents C5225 · PDF drawing C5221 | - |

- Claims naming a status code or response shape: C5205 (`42501`), C5206 (`23502`), C5208 (`23505`), C5209 (`23503`) - each has a proof that crosses the boundary (the SQL runs as the role; the route test calls the handler)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (`make_contract` template choice, template immutability and RLS) | one at the boundary (SQL as the role) | one asserted case per row of the decision table |
| Decides, not reached across a boundary (`renderBlocks`, `validateBlocks`, variable values) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (reader mapping, route and signing wiring, PDF drawing of a rendered list) | one proof each at the consumer | the rendered blocks reach the output; a read failure reaches the response |

Evidence:

- `renderBlocks`: 3 block types, missing-value rule, whitelist check, single-pass substitution, orphan-heading rule: 6 branch points -> decides
- `make_contract` template pick: org template or system, one branch point -> decides
- `contract-pdf.tsx` Terms section: maps a list to text with two styles -> instrumentation
- closest analogue in the repo: `plan_limits` (SQL function, adapter, use case, view), proven at the same levels with 31 checks

Cost: 9 proofs at their own layer across 4 files. Without these rows, the sentence table and the omission rule would be proven only by a PDF that happens to traverse them.

## Swept

- validation: C5215 (block, text and schema bounds), C5214 (unknown variable)
- failure modes: C5223, C5224, C5225 (the template read fails)
- idempotency: existing - `make_contract` returns the existing contract of a version before it writes (a repeat never changes the recorded version; C5203 covers a later version)
- authorization: C5205, C5207 (members read, nobody writes)
- concurrency: n/a - a template version is immutable and `make_contract` already locks the agreement row; there is no editor to race yet
- data lifecycle: C5206, C5203 (existing contracts are pointed at v1 by the column default; versions are never deleted)
- dependency failure: C5223, C5224
- state transitions: n/a - a contract's status machine is untouched; the version is written once at creation (C5201 to C5203)
- observability: n/a - no logging requirement; a failed read already logs through the existing route and use-case paths

## Out of scope

Same as the plan's `Out of scope`: the editor, the agreement-side template, system-block moves, starter wording per trade and province, upload, any member write path, re-rendering signed contracts.

## Handoff

- S1 = ~10k (one migration, one SQL recipe), S2 = ~6k (one new domain file and its test), S3 = ~18k (document builder, PDF, reader, route, signing documents and their tests, about 70 KB of existing files to read). About 34k, plus about 25k of new tests; all in Contracts. Under the 150k budget - one builder
- Mechanism: one builder

- **Boundary:** C5200-C5225 closed at the commit that adds this line (database half at `3ad2447`)
- **Settled mid-build:** (1) C5211's expected renewal sentence was written "12 month terms" and is "12 months terms" (the existing wording, which the existing C1639 pins); corrected before any code. (2) C5224's "503" contradicted the approved AC 19 ("as other read failures today"): the route reads the contract outside its `try`, so a failed read fails the request like the agreement read does; the check now says that. (3) The Flow names corrected to the code: contracts are written by `private.make_contract`, and the signing flow's document is the one `makeContractDocuments` builds for the provider (there is no separate signing-page rendering of the clauses). (4) `contractClauses(terms, months)` stays as a thin function over the system wording so C1639 and its siblings are untouched; tests that read or passed `clauses: string[]` (C1640, C1642, C1643, C1714, C3329 and the route test) now use `body` with the same expected sentences. (5) The reader sets `template` only when its row carries a `template_version_id`; older fixtures without one mean the system wording, a real row without a readable version throws. (6) Existing registries updated mechanically: the `test:db` counts (36 to 37 recipes, 38 to 39 files) and `contract_templates` in the recipe list.
- **Abandoned:** failing the migration's backfill as a separate UPDATE (the column default backfills every row at once); a `ContractTemplateReader` port (the existing contract reader carries the body)
