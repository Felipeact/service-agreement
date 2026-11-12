# Contract templates verification, round 1 (superseded by verification.md round 2)

**Verdict**: FAIL
**Profile**: standard
**Diff range**: d3d2e84..HEAD (b47a6b1)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Reasons for FAIL (details below): (1) a surviving mutant, M4: the orphan-heading arm "a heading followed directly by another heading is dropped" can be deleted and all 28 template tests stay green (`web/domain/contract/template.ts:133`); the plan states that rule (plan.md:56). (2) A Coverage member with no proof: the trigger's cascade-on-org-delete exception (`supabase/migrations/20261112230000_contract_templates.sql:51-53`) is named in the migration's own prose (lines 5-6, 44-45) and appears nowhere in plan.md or checks.md and in no assertion of `supabase/tests/contract_templates.sql`. It is correct today (verified with a throwaway assertion, below) but nothing would catch a regression. All 26 checks themselves PASS.

State at the time of the run: the owner has applied the migration to the hosted project and the coordinator changed the recipe (`web/scripts/test-db/runner.mts:66` is now `plain("contract_templates")`, header of `supabase/tests/contract_templates.sql` edited). Those two uncommitted edits were left in place. `npm run test:db contract_templates` therefore ran against the hosted objects without replaying the migration (first run, before the apply, replayed it: also PASS). Migration-side mutants were not injectable after the apply; SQL faults were injected into the expected values of the SQL test and the migration was judged by reading (see Faults injected).

## Binding sources

Profile is standard, so step 1 does not run. The plan lists no binding design source (Sources are ROADMAP and `contractClauses`). `git show d3d2e84:web/domain/contract/document.ts` was opened for the word-for-word comparison below.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `contractClauses` at d3d2e84 (`document.ts:25-46`) | yes - `git show d3d2e84:web/domain/contract/document.ts` | none: possessive (`days'`/`day's`), `day`/`days`, `formatSettingNumber(..)%`, province name or raw code, `termMonthsLabel`, the repairDiscount/cpiCap always-printed (non-null in `AgreementTerms`, `domain/agreement/index.ts:204-205`), renewal needing both notice and threshold (`template.ts:131-133` plus two variables in one clause), `null` terms giving `[]` (C5218) all reproduce the old output | - |

## Checks

Proofs run at HEAD. Vitest: one invocation over the six files with `-t "C52(1[1-9]|2[0-5]):"` gave 42 passed, each named test listed individually as run. SQL: `npm run test:db contract_templates` gave `PASS contract_templates`, 1 passed, 0 failed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5200 | one system contract template, v1 = schema 1, heading "Terms" + six clauses, readable by org A and B | test:db exit 0 | `supabase/tests/contract_templates.sql:36` count = 1, `:40` schema = '1', `:41` heading 'Terms', `:42` 7 blocks / 6 clauses, `:44` first and `:45` last sentence, `:51` and `:56` org A/B read. Fault S7 (count = 2) killed | PASS |
| C5201 | no org template -> system latest version | test:db exit 0 | `:77` `ct_template_of(...) = (system v1 id)` | PASS |
| C5202 | org template -> its latest version | test:db exit 0 | `:88` `= tests.id('tplA:v1')`. Fault C5202 (expect v2) killed | PASS |
| C5203 | newer version later leaves the contract unchanged | test:db exit 0 | `:97` unchanged `= tplA:v1` after v2 inserted; `:103` next contract takes v2. Fault C5203 killed | PASS |
| C5204 | update/delete refused for table owner and owner member | test:db exit 0 | `:121-123` owner update/delete and system delete `'55000'`; `:125-126` member `'42501'` (grant refusal, not the trigger; the trigger is what the owner rows prove). Fault S4b (code 23505) killed | PASS |
| C5205 | member insert into templates / versions refused `42501` | test:db exit 0 | `:131-132` `'42501'`. Fault S2 killed | PASS |
| C5206 | no null version; omitted column -> system v1; explicit null `23502` | test:db exit 0 | `:64` count null = 0, `:65` `bool_and(template_version_id = sys)`, `:66-67` `'23502'`. Fault S5 (23503) killed | PASS |
| C5207 | org B sees none of org A's template/versions, still sees system | test:db exit 0 | `:139-141` counts 0, 0, >= 1. Fault S3 (expect 1) killed | PASS |
| C5208 | second system template, second org template, same `version_no` each `23505` | test:db exit 0 | `:146-148` `'23505'`. Fault C5208 (23503) killed | PASS |
| C5209 | unknown version id `23503` | test:db exit 0 | `:69-70` `'23503'` | PASS |
| C5210 | automation path records system version | test:db exit 0 | `:116` `ct_template_of(v_contract) = (system v1)` via `private.create_contract_for_system`. Fault S6 (`<>`) killed | PASS |
| C5211 | system v1 renders heading + exact six sentences | `vitest ... -t "C5211:"` 2 tests ran | `web/domain/contract/template.test.ts:41` `toEqual([{heading Terms}, ...SENTENCES])` with concrete strings at `:31-36`; parity `:47` `JSON.parse($body$ JSON) toEqual(SYSTEM_CONTRACT_BODY)`. Parity is non-vacuous: M16 (SQL "Terms" -> "Term") killed by `:47`; an absent match parses "null" and fails | PASS |
| C5212 | each of 5 null terms omits exactly its clause | 5 tests ran | `template.test.ts:60` `toEqual(SENTENCES.filter(index !== dropped))`. M1 (omit rule off) killed (7 failures) | PASS |
| C5213 | heading/paragraph with missing value printed with empty replacement | ran | `template.test.ts:67-70` `[{heading "Pay "},{paragraph "Within  of invoice."}]`. M18 (paragraph dropped) killed | PASS |
| C5214 | unknown variable rejected naming it; renders as omitted/empty | ran | `template.test.ts:79` `reason toContain("terms.unknown")`, `:80` `[{paragraph "See ."}]`. M7 (unknown -> "") killed | PASS |
| C5215 | schema 2, type image, 61 blocks, 2,001 chars rejected each with own reason; 60 and 2,000 accepted | 3 tests ran | `:91` 4 distinct reasons, `:92-95` contain schema/image/61/2001; `:99-100` accept 60 and 2000. M2 (61) and M3 (2001) killed | PASS |
| C5216 | `1 day`/`30 days`, `1 day's`/`60 days'`, `10%`, `10%`, `7.5%` | ran | `template.test.ts:114-120`. M6 and M19 killed | PASS |
| C5217 | `{{terms.paymentDays}}` customer name not re-expanded | ran | `template.test.ts:126-128` `[{paragraph "For {{terms.paymentDays}}."}]`. M8 (re-expansion) killed | PASS |
| C5218 | no terms -> no blocks, heading dropped | ran | `template.test.ts:132` `toEqual([])`. M5 (trailing heading kept) killed. The other orphan arm is not asserted (see Faults M4) | PASS |
| C5219 | 11 whitelisted variables, exactly | 13 tests ran | `template.test.ts:136-150` sorted list of 11; `:153-160` each resolves non-empty and is accepted by `validateBlocks` (also with spaces) | PASS |
| C5220 | org body rendered in order; no template -> system | ran | `web/domain/contract/document.test.ts:131-147` (own body toEqual three blocks with party values; `system[0]` heading, length 7). M9 killed | PASS |
| C5221 | blocks after scope, before Signatures; heading h2 + accent, others 4pt | 2 tests ran | `web/infrastructure/documents/contract-pdf.test.ts:265` order Equipment < Our agreement < Paragraph < Clause < For the Customer; `:276` `[styles.h2, accent]`, `:277-278` `{ marginBottom: 4 }`. M10 and M11 killed | PASS |
| C5222 | empty body -> no Terms section | ran | `contract-pdf.test.ts:282-283` `not.toContain("Terms")`, still ends with signatures. M20 (heading always drawn) killed | PASS |
| C5223 | reader returns the version's body; throws on missing/malformed/read error | 5 tests ran | `web/infrastructure/supabase/contracts.test.ts:106` `template toEqual(body)`, `:108` select contains the join, `:118` `rejects.toThrow("tv-1")` for four bad joins. M12 and M17 killed. The read-error leg is asserted only by the pre-existing `:135` (`XX000`), not by a C5223-named test: precision note, the claim is still proven | PASS |
| C5224 | route draws the reader's template; read failure propagates, no PDF | 2 tests ran | `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:115` `body toEqual([{paragraph "Org wording for Fernwood Dental."}])`, `:121-122` `rejects.toThrow` and `renderContract not called`. M13 and M21 killed | PASS |
| C5225 | `makeContractDocuments` builds from the contract's own template; throw propagates | 3 tests ran | `web/application/use-cases/signing-documents.test.ts:114` `toHaveBeenCalledWith(agreement, PARTIES, "#1f6f8b", undefined, body)`, `:121` same with words, `:127-128` rejects and not built. M14 and M15 killed (each branch of `signing.ts:129-134`) | PASS |

## Coverage

Recomputed from the code and the plan's Landing, Relations and Surface, not from checks.md's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| system sentences (6) | migration `$body$` (lines 74-81) and `SYSTEM_CONTRACT_BODY` (`template.ts:43-59`) | all six exact strings C5211 (`template.test.ts:31-36`); parity `:47` | - |
| optional terms dropping a clause (5) | `templateValues` (`template.ts:72-86`) | paymentDays, cancellationNoticeDays, governingProvince, renewalNoticeDays, cpiRenegotiationThresholdPct C5212 | - |
| whitelisted variables (11) | `TEMPLATE_VARIABLES` (`template.ts:9-21`) | each C5219 (`template.test.ts:153`) | - |
| block types (3) | `BLOCK_TYPES` (`template.ts:28`) | heading C5213, paragraph C5213, clause C5212; draw styles C5221 | - |
| render rules (5): omit clause, blank in heading/paragraph, unknown = no value, single pass, orphan heading | `renderBlocks` (`template.ts:117-134`) | C5212, C5213, C5214, C5217; orphan: trailing heading C5218 only | orphan heading directly before another heading (plan.md:56; `template.ts:133`) - survives M4 |
| invalid body reasons (4) + non-object/blocks/type/text guards | `validateBlocks` (`template.ts:91-109`) | schema, type, 61 blocks, 2001 chars C5215; 60/2000 accepted | - |
| template version mutations and writes (5) | migration trigger (`:43-57`), grants and policies (`:62-68`) | update C5204, delete C5204, member insert templates C5205, member insert versions C5205 | delete when the owning org is deleted (cascade exception, `:51-53`; named in migration prose `:5-6`, `:44-45`): no assertion in the repo, not in plan or checks. Verified correct by my throwaway assertion, so it is a proof gap, not a defect |
| read access (3): member of own org, other org, anon | policies `:65-68`, grant `:64` | own/system C5200, other org C5207; anon: no repo assertion (throwaway assertion passed `42501`; grants make it unreachable) | - (not claimed by any check or AC) |
| uniqueness constraints (3) | `:19-20`, `:34` | each C5208 | - |
| contract table constraints (3) | `:91-93` | not null C5206, FK C5209, default C5206 | - |
| ways a contract is created (2) | `make_contract` callers: `create_contract` (20261108220000:28), `create_contract_for_system` (20261108100000:81) | member C5201/C5202/C5203, automation C5210 | - |
| contract template consumers (3) | `buildContractDocument` callers by grep: route (`route.ts:31`), `signing.ts:129-134`, tests; `.clauses` no longer read anywhere (grep) | PDF route C5224, signing documents C5225, PDF drawing C5221 | - |
| reader paths (1) | only `ContractReader.get` exists (`ports/index.ts:799-801`); the one select includes `template_version_id` (`contracts.ts:125`) | C5223 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (`make_contract` template choice, immutability, RLS) | `supabase/migrations/20261112230000_contract_templates.sql` | one at the boundary (SQL as the role) | yes for the choice (C5201, C5202, C5210), immutability (C5204) and RLS (C5205, C5207); the cascade-on-org-delete branch of the trigger has no asserted case |
| Decides, not reached across a boundary (`renderBlocks`, `validateBlocks`, values) | `web/domain/contract/template.ts` | one at its own layer, one asserted case per row of the decision table | no: the orphan-heading row "heading directly followed by a heading" has no asserted case (mutant M4 survives); every other row is asserted |
| Instrumentation (reader mapping, route and signing wiring, PDF drawing) | `contracts.ts`, `route.ts`, `signing.ts`, `contract-pdf.tsx` | one proof each at the consumer | yes: C5223, C5224, C5225, C5221/C5222 |

## Faults injected

Real tree used (the coordinator's two uncommitted edits made a worktree of HEAD unrepresentative); each fault applied, proof run, file reverted with `git checkout -- <file>` (SQL test file restored from a byte copy, since it carries the coordinator's edit). Final `git status --porcelain`: ` M supabase/tests/contract_templates.sql`, ` M web/scripts/test-db/runner.mts` (the coordinator's, untouched in content), `?? node_modules/`.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1 clause omission off (`if (false && missing)`) | `web/domain/contract/template.ts:130` -> C5212 x5, C5214, C5218 | yes |
| M2 `MAX_BLOCKS` 60 -> 61 | `template.ts:39` -> C5215 | yes |
| M3 `MAX_TEXT` 2000 -> 2001 | `template.ts:40` -> C5215 | yes |
| M4 drop the "next block is a heading" arm of the orphan rule | `template.ts:133` | no - survived: 28/28 template tests passed |
| M5 trailing heading kept (`=== undefined \|\| ...`) | `template.ts:133` -> C5218 | yes |
| M6 `1 day` singular off | `template.ts:65` -> C5216 | yes |
| M7 unknown variable gives empty string instead of no value | `template.ts:123` -> C5214 | yes |
| M8 values re-expanded after substitution | `template.ts:128` -> C5217 | yes |
| M18 paragraph dropped when value missing | `template.ts:130` -> C5213, C5214 | yes |
| M19 possessive `days'` -> `days` | `template.ts:66` -> C5211, C5212, C5216 | yes |
| M9 builder ignores the contract's template | `web/domain/contract/document.ts:60` -> C5220 | yes |
| M10 heading drawn as body text | `web/infrastructure/documents/contract-pdf.tsx:41` -> C5221 | yes |
| M11 body margin 4 -> 6 | `contract-pdf.tsx:48` -> C5221 | yes |
| M20 Terms heading drawn for an empty body | `contract-pdf.tsx:81` -> C5222 | yes |
| M12 reader returns undefined (system wording) on an invalid body | `web/infrastructure/supabase/contracts.ts:88` -> C5223 x3 | yes |
| M17 reader select drops the version join | `contracts.ts:125` -> C5223 | yes |
| M13 route does not pass the reader's template | `web/app/(app)/contracts/[contractId]/pdf/route.ts:31` -> C5224 | yes |
| M21 route swallows the contract read failure | `route.ts:23` -> C5224, C1638 | yes |
| M14 signing drops the template (words branch) | `web/application/use-cases/signing.ts:130` -> C5225 | yes |
| M15 signing drops the template (no-words branch) | `signing.ts:132` -> C5225 | yes |
| M16 parity: SQL heading text "Terms" -> "Term" | `supabase/migrations/20261112230000_contract_templates.sql:75` -> C5211 parity | yes |
| S2 C5205 expected state 42501 -> 23505 | `supabase/tests/contract_templates.sql:131` | yes |
| S3 C5207 expected 0 -> 1 | `contract_templates.sql:139` | yes |
| S4b C5204 expected 55000 -> 23505 (system delete) | `contract_templates.sql:123` | yes |
| S5 C5206 expected 23502 -> 23503 | `contract_templates.sql:66` | yes |
| S6 C5210 equality -> inequality | `contract_templates.sql:116` | yes |
| S7 C5200 count 1 -> 2 | `contract_templates.sql:36` | yes |
| C5202, C5203, C5208 expected values flipped | `contract_templates.sql:88`, `:97`, `:148` | yes (each) |

The SQL rows mutate the test's expected values because the migration can no longer be replayed. They show the assertions are live and discriminating, not that the migration's logic is mutation-tested; the migration was judged by reading (next section).

## Adversarial notes

(a) Migration, by reading plus a throwaway block appended to the SQL test inside the rolled-back run (then removed; it passed): anon select on both tables refused `42501`; a member `truncate` and a member `update contracts set template_version_id` refused `42501`; `delete from orgs` for org A with two of its versions and a contract pointing at one cascades cleanly (versions 0, templates 0, system version still 1). Trigger (`:43-57`): UPDATE always raises `55000`; DELETE raises unless the owning org row is already gone, system versions (org_id null) never deletable, and a version whose org exists cannot be deleted even by the table owner (C5204 owner rows). Residual, low: the owner/superuser can `truncate` or disable the trigger; members cannot (grants `:62-64` revoke all, grant select only). RLS (`:65-68`): `org_id is null or is_org_member(org_id)` to `authenticated`; no insert/update/delete policy. `contracts.template_version_id` default (`:91-93`) is the system v1 for any insert that does not name one; `make_contract` always names it. `make_contract` (`:96-154`) diffed against `20261108100000_contract_automation.sql:20-75`: the added pieces are `v_template` (`:109`), the template pick (`:140-149`) and the insert column (`:151-152`); the `for update` lock, the existing-contract early return, the five checks and hints, and the event insert are unchanged, and no other migration redefines it (grep). The pick takes the org's latest version, else the system's (`order by version_no desc limit 1` in both branches). Observation, low: C5201's "latest" for the system branch has one system version, so its ordering is unproven; the org branch ordering is proven by C5203 `:103`.

(b) `renderBlocks` and `validateBlocks`: single pass proven (M8 killed); function replacer so `$` sequences in values are literal; the unknown variable counts as no value (M7); bounds 60/61 and 2000/2001 asserted at `template.test.ts:87-88`, `:99-100`. Formats against the pre-feature `contractClauses`: `days`, possessive, percent, province, term label, null-terms output and the some-fields-set cases are identical (C1639 untouched, `document.test.ts:43-90`, still pass, and C5212 covers each null).

(c) Reader: `templateOf` returns `undefined` only when `row.template_version_id === undefined` (`contracts.ts:87`); the only production select names the column (`:125`) and the column is not null, so no production path omits the key. A row that names a version and has no readable body throws (M12 killed). Low observation: `ContractDetail.template` is optional (`ports/index.ts:774`), so a future reader that forgets the select would silently draw the system wording in `signing.ts:129-134` and `route.ts:31`; the type does not force it.

(d) Edits to existing tests, `git diff d3d2e84..HEAD`: `document.test.ts` C1640 compares clause blocks with `contractClauses` (which is now `renderBlocks` of the system wording, so the comparison is partly circular, as it was before; the sentences are independently pinned by C1639 and C5211) and keeps `body toEqual([])` for null terms; the heading is covered by C5220. `contract-pdf.test.ts` C1643 and C1714 only wrap the same sentences in a helper `termsBody` that adds the heading; assertions unchanged. `logo.test.ts` swaps `clauses: ["One clause."]` for a heading and a clause; assertions unchanged. `route.test.ts` changes `document.clauses toContain(...)` to `body.map(text) toContain(...)`, the same sentence. `runner.test.ts` changes only counts 36->37 and 38->39 and adds the name. No assertion weakened beyond the mechanical change in the Handoff.

(e) Plan versus code: Flow step 1 names `create_contract`; the code writes through `private.make_contract` (corrected in the Handoff, matches). AC 17 and AC 19 as corrected: the signing flow's document is built in `makeContractDocuments`, the route and the signing flow let a failed read propagate (`route.ts:23` is outside the `try`). Impact says `contractClauses` is "replaced"; it stays as a thin wrapper (`document.ts:30-34`), declared in Handoff (4). Door 1 says "a trigger that refuses both"; as built the delete branch has the cascade exception, which the plan does not mention (finding above).

(f) Other: grep finds no remaining reader of `.clauses`. `database.types.ts` gains `template_version_id` for contracts only; the two new tables have no generated types (the reader selects by string, so tsc is unaffected). Not covered by any check and low: no check or assertion for anon access to the new tables.

## Gate

- `npm test` (web, full): 271 files passed, 4552 tests passed, 0 failed (run before the coordinator's recipe edit); `scripts/test-db/runner.test.ts` re-run after it: 26 passed.
- `npx tsc --noEmit -p .`: only the known errors, `.next/types/validator.ts` and `app/setup/draft-actions.test.ts(62,64)` and `(104,64)`; none in files the feature touched.
- `npx eslint` over the 16 touched ts/tsx/mts files: exit 0, no output.
- `npm run test:db contract_templates`: PASS, 1 passed, 0 failed (before the apply with the migration replayed; after the apply against the hosted objects).
- Known and accepted, not counted: the `customer_portal` and `rls_isolation` recipes fail without this feature; no live browser pass is claimed.

Ranked gaps:

1. M4 survives: delete the `rendered[index + 1].type !== "heading"` arm at `web/domain/contract/template.ts:133` and the suite stays green. Add a case in `web/domain/contract/template.test.ts` for a heading followed directly by another heading (the first is dropped) and for a heading whose clauses were all omitted but which is followed by a paragraph.
2. Trigger cascade branch unproven: add a labelled assertion to `supabase/tests/contract_templates.sql` that deleting an org removes its templates and versions while the system version stays, and add it to checks.md (a new check or a clause on C5204), or remove the exception from `supabase/migrations/20261112230000_contract_templates.sql:51-53` and the plan's Landing.
