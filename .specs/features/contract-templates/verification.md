# Contract templates verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: d3d2e84..HEAD (3b3f1cc)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 (FAIL: surviving mutant M4 and the unproven org-delete cascade member) is kept in `.specs/features/contract-templates/verification-round1.md`. Scope of this round: the fix's diff (`git diff b47a6b1..HEAD`: `web/domain/contract/template.test.ts`, `supabase/tests/contract_templates.sql`, checks.md C5204/C5205/C5218 and the Coverage row, plan.md Landing door 1, the recipe line `web/scripts/test-db/runner.mts:66`) and every round 1 verdict that was not PASS. No source file changed (`git diff b47a6b1..HEAD -- web/domain web/infrastructure web/application web/app supabase/migrations` is empty), so the round 1 results for the rest carry forward, marked below. Proofs, `npm test` and tsc were re-run in full at the new HEAD.

## Binding sources

No binding design source (carried from round 1 at b47a6b1): the plan's Sources are ROADMAP and `contractClauses`; the word-for-word comparison against `git show d3d2e84:web/domain/contract/document.ts` found no contradiction. Source files are unchanged since, so it carries.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `contractClauses` at d3d2e84 (`document.ts:25-46`) | yes - carried from b47a6b1 | none | - |

## Checks

Re-run at 3b3f1cc: one vitest invocation over the six files with `-t "C52(1[1-9]|2[0-5]):"` gave 43 passed (round 1: 42; the added test is the new C5218 case), each named test shown as run. `npm run test:db contract_templates` gave `PASS contract_templates`, 1 passed, 0 failed (against the hosted objects, migration applied, not replayed). Rows not touched by the fix cite lines carried from b47a6b1 (files unchanged); touched files were re-cited.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5200 | one system contract template, v1 = schema 1, heading + six clauses, readable by org A and B | test:db exit 0 | `supabase/tests/contract_templates.sql:36` count = 1, `:41` heading 'Terms', `:42` 7 blocks / 6 clauses, `:44`, `:45` sentences, `:51`, `:56` org A/B read | PASS |
| C5201 | no org template -> system latest version | test:db exit 0 | `contract_templates.sql:77` `ct_template_of(...) = (system v1 id)` | PASS |
| C5202 | org template -> its latest version | test:db exit 0 | `:88` `= tests.id('tplA:v1')` | PASS |
| C5203 | newer version later leaves the contract unchanged | test:db exit 0 | `:97` unchanged `= tplA:v1`; `:103` next contract `= tplA:v2` | PASS |
| C5204 | update/delete of a version refused for table owner and owner member; exception: an org's versions go with the org, the system version stays | test:db exit 0 | `:121-123` owner update/delete and system delete `'55000'`; `:125-126` member `'42501'`; new `:170` `not exists (select 1 from public.document_template_versions where org_id = tests.id('orgB'))`, `:171` same for templates, `:172` `(select count(*) ... where org_id is null) = 1`. Faults A, B, E killed | PASS |
| C5205 | member insert into templates / versions refused `42501`; anon reads and inserts refused | test:db exit 0 | `:131-132` member `'42501'`; new `:158` anon read versions `'42501'`, `:159` anon read templates `'42501'`, `:160` anon insert `'42501'`. Faults C, D2 killed. Note (low): the C5205 claim text in checks.md still names only the member insert; the anon part is stated in the Coverage row and the Handoff | PASS |
| C5206 | no null version; omitted column -> system v1; explicit null `23502` | test:db exit 0 | `:64`, `:65`, `:66-67` `'23502'` | PASS |
| C5207 | org B sees none of org A's template/versions, still sees system | test:db exit 0 | `:139-141` counts 0, 0, >= 1 | PASS |
| C5208 | second system template, second org template, same `version_no` each `23505` | test:db exit 0 | `:146-148` `'23505'` | PASS |
| C5209 | unknown version id `23503` | test:db exit 0 | `:69-70` `'23503'` | PASS |
| C5210 | automation path records system version | test:db exit 0 | `:116` `ct_template_of(v_contract) = (system v1)` | PASS |
| C5211 | system v1 renders heading + exact six sentences; parity with the migration body | `-t "C5211:"` 2 tests ran | `web/domain/contract/template.test.ts:41` `toEqual([heading, ...SENTENCES])`, `:47` parity `JSON.parse($body$) toEqual(SYSTEM_CONTRACT_BODY)` (the migration file is unchanged, so the parity still reads the real SQL) | PASS |
| C5212 | each of 5 null terms omits exactly its clause | 5 tests ran | `template.test.ts:60` `toEqual(SENTENCES.filter(...))` | PASS |
| C5213 | heading/paragraph with missing value printed with empty replacement | ran | `template.test.ts:67-70` `"Pay "`, `"Within  of invoice."` | PASS |
| C5214 | unknown variable rejected naming it; renders as omitted/empty | ran | `template.test.ts:79`, `:80` | PASS |
| C5215 | schema 2, image, 61 blocks, 2,001 chars rejected each with own reason; 60 and 2,000 accepted | 3 tests ran | `template.test.ts:91-95`, `:99-100` | PASS |
| C5216 | `1 day`/`30 days`, `1 day's`/`60 days'`, `10%`, `7.5%` | ran | `template.test.ts:114-120` | PASS |
| C5217 | `{{terms.paymentDays}}` customer name not re-expanded | ran | `template.test.ts:126-128` | PASS |
| C5218 | no terms -> no blocks; a heading before another heading or before nothing is dropped, before any other block kept | 2 tests ran | `template.test.ts:132` new case: `render(A, B, paragraph "under B", C, D)` then `toEqual([{heading B},{paragraph "under B"}])` (A and D-before-end dropped, B kept before a paragraph, C dropped before D); `:148` `render(SYSTEM_CONTRACT_BODY, null) toEqual([])`. M4 and M5 killed | PASS |
| C5219 | 11 whitelisted variables, exactly | 13 tests ran | `template.test.ts:152-166` sorted list of 11; `:169-176` each resolves and validates | PASS |
| C5220 | org body rendered in order; no template -> system | ran | `web/domain/contract/document.test.ts:131-147` | PASS |
| C5221 | blocks after scope, before Signatures; heading h2 + accent, others 4pt | 2 tests ran | `web/infrastructure/documents/contract-pdf.test.ts:265`, `:276-278` | PASS |
| C5222 | empty body -> no Terms section | ran | `contract-pdf.test.ts:282-283` | PASS |
| C5223 | reader returns the version's body; throws on missing/malformed/read error | 5 tests ran | `web/infrastructure/supabase/contracts.test.ts:106`, `:108`, `:118` (read-error leg by the pre-existing `:135`, low note carried) | PASS |
| C5224 | route draws the reader's template; read failure propagates, no PDF | 2 tests ran | `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:115`, `:121-122` | PASS |
| C5225 | `makeContractDocuments` builds from the contract's own template; throw propagates | 3 tests ran | `web/application/use-cases/signing-documents.test.ts:114`, `:121`, `:127-128` | PASS |

Are the amended claims honest and proven? C5204's exception matches the migration (`supabase/migrations/20261112230000_contract_templates.sql:51-53`: a delete passes only when the system flag is absent and the owning org row is gone) and the plan Landing door 1 now says the same (plan.md:49). The assertion deletes a real org with a real template and version (`contract_templates.sql:163-167`, run as the table owner after `reset role`), so a trigger that always raised on delete would make the `delete from public.orgs` statement itself error and fail the recipe, and a trigger that let org-less deletes through would fail the earlier owner delete rows (`:122-123`). "System version stays" is partly trivial (an org delete cannot reach an `org_id is null` row), but the refusal of a system delete is asserted separately at `:123`. C5218's amended text is exactly what the new case asserts, including the kept case.

## Coverage

Recomputed from the code and the plan's Landing, Relations and Surface (not from checks.md's table). Rows whose authority the fix touched were recomputed at 3b3f1cc; the others carry from b47a6b1 (their code files are unchanged).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| system sentences (6) - carried | migration `$body$` (lines 74-81), `SYSTEM_CONTRACT_BODY` (`template.ts:43-59`) | C5211 `template.test.ts:31-36`, parity `:47` | - |
| optional terms dropping a clause (5) - carried | `templateValues` (`template.ts:72-86`) | C5212 x5 | - |
| whitelisted variables (11) - carried | `TEMPLATE_VARIABLES` (`template.ts:9-21`) | C5219 x11 | - |
| block types (3) - carried | `BLOCK_TYPES` (`template.ts:28`) | C5213, C5212, C5221 | - |
| render rules (6): omit clause, blank in heading/paragraph, unknown = no value, single pass, heading before heading dropped, trailing heading dropped | `renderBlocks` (`template.ts:117-134`), recomputed | C5212, C5213, C5214, C5217; C5218 new case `template.test.ts:132` (heading before heading) and `:148` (all dropped); trailing heading dropped is also in the new case (D) | - |
| invalid body reasons (4) - carried | `validateBlocks` (`template.ts:91-109`) | C5215 | - |
| template version mutations and writes (6), recomputed | migration trigger (`:43-57`), grants and policies (`:62-68`) | update C5204 (`:121`), delete C5204 (`:122`, `:123`), delete with the owning org C5204 (`:170-172`), member insert templates C5205 (`:131`), member insert versions C5205 (`:132`), anon read and insert C5205 (`:158-160`) | - |
| read access (3), recomputed | policies `:65-68`, grant `:64` | own org and system C5200, other org C5207, anon C5205 (`:158-159`) | - |
| uniqueness constraints (3) - carried | `:19-20`, `:34` | C5208 | - |
| contract table constraints (3) - carried | `:91-93` | C5206, C5209 | - |
| ways a contract is created (2) - carried | `create_contract` (20261108220000:28), `create_contract_for_system` (20261108100000:81) | C5201/C5202/C5203, C5210 | - |
| contract template consumers (3) - carried | `buildContractDocument` callers by grep (`route.ts:31`, `signing.ts:129-134`) | C5224, C5225, C5221 | - |
| reader paths (1) - carried | `ContractReader.get` only (`ports/index.ts:799-801`), select at `contracts.ts:125` | C5223 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (`make_contract` template choice, immutability, RLS) | `supabase/migrations/20261112230000_contract_templates.sql` | one at the boundary (SQL as the role) | yes: choice C5201, C5202, C5210; immutability C5204 including the org-delete branch; RLS C5205 (member, anon), C5207; each asserts a concrete value or SQLSTATE |
| Decides, not reached across a boundary (`renderBlocks`, `validateBlocks`, values) | `web/domain/contract/template.ts` | one at its own layer, one asserted case per row of the decision table | yes: every row of the render table now has an asserted case, including heading before heading (C5218) |
| Instrumentation (reader mapping, route and signing wiring, PDF drawing) | `contracts.ts`, `route.ts`, `signing.ts`, `contract-pdf.tsx` | one proof each at the consumer | yes: C5223, C5224, C5225, C5221/C5222 (carried, files unchanged) |

## Faults injected

Real tree, each fault applied, proof run, file reverted (`git checkout -- <file>`; the SQL test file restored from a byte copy). Final `git status --porcelain`: `?? node_modules/` only. The migration cannot be mutated through the recipe now that it is applied, so the SQL faults change the expected values of the new assertions; the migration was judged by reading (round 1 and above). Round 1's other faults (M1-M3, M5-M21, S2-S7, C5202, C5203, C5208 faults) were killed at b47a6b1 and are carried: no source file changed.

| Mutation | Location | Killed |
| --- | --- | --- |
| M4 (re-injected) drop the "next block is a heading" arm | `web/domain/contract/template.ts:133` -> new C5218 case fails (1 failed, 28 passed) | yes |
| A: org delete expected to leave its versions (`not exists` -> `exists`) | `supabase/tests/contract_templates.sql:170` | yes |
| B: system version count 1 -> 2 | `contract_templates.sql:172` | yes |
| E: org delete expected to leave its template | `contract_templates.sql:171` | yes |
| C: anon read of templates expected `23505` instead of `42501` | `contract_templates.sql:159` | yes |
| D2: anon insert expected `23505` instead of `42501` | `contract_templates.sql:160` | yes |
| (carried, round 1, b47a6b1) M1-M3, M5-M21 on source, S2-S7, C5202, C5203, C5208 on SQL expected values; M4 was the sole survivor and is now killed | see `verification-round1.md` | yes |

## Gate

- `npm test` (web, full) at 3b3f1cc: 271 files passed, 4553 tests passed, 0 failed.
- `npx tsc --noEmit -p .`: only the known `.next/` errors and `app/setup/draft-actions.test.ts(62,64)` and `(104,64)`; none in touched files.
- `npx eslint`: no TS source changed since round 1 except `web/domain/contract/template.test.ts` (test-only addition); carried clean from round 1 for the rest.
- `npm run test:db contract_templates`: PASS, 1 passed, 0 failed.
- Known and accepted, not counted: the migration is now applied by the owner; the `customer_portal` and `rls_isolation` recipes fail without this feature; no live browser pass is claimed.
- Low notes, not FAIL reasons: C5205's check text does not name the anon cases (Coverage row and Handoff do); `ContractDetail.template` is optional in the type (`ports/index.ts:774`); the C5201 "latest" ordering for the system branch is unproven with a single system version.
