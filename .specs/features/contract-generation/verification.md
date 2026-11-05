# Contract generation verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: f80ad4d..13cad3d646cbeccb0a8a5ad763392574789eff77
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2 is scoped by the fix diff `a138450..13cad3d` (commits `964eb4e` tests and `13cad3d` docs) and by the two round 1 verdicts that were not PASS (C1601, C1650). Every proof was re-run in full at `13cad3d`.

Result: 54 of 55 checks are proven with located evidence. C1601 is now proven. C1650 still fails on one clause the owner did not waive: at 375 and 768 px the agreement page was never measured while it showed the Generate button and the confirm step.

Proof runs (verified at 13cad3d):
- **V** = `cd web && npx vitest run infrastructure/supabase/contracts.test.ts components/agreements/contract-state.test.ts "app/(app)/contract-actions.test.ts" infrastructure/supabase/agreements.test.ts components/agreements/agreements.test.ts "app/(app)/agreements/[agreementId]/page.test.ts" domain/contract/parties.test.ts components/contracts/contracts.test.ts "app/(app)/contracts/[contractId]/page.test.ts" "app/(app)/contracts/[contractId]/pdf/route.test.ts" domain/contract/document.test.ts infrastructure/documents/contract-pdf.test.ts composition/contract-pdf.test.ts boundaries.test.ts composition/composition.test.ts infrastructure/documents --reporter=verbose`: exit 0, 19 files, 472 passed. Every check id C1619..C1648 appears in the verbose output with a check mark (for example C1641 x5, including the new accent test, and C1643 x2).
- **D** = `cd web && npm run test:db`: exit 0, `23 passed, 0 failed`, including `PASS transitions`, `PASS rls_roles`, `PASS domain_constraints` and `PASS demo_seed`.

## Binding sources

none (the plan marks no source binding). Carried from a138450; the fix did not touch the plan.

## Checks

Proofs verified at 13cad3d. Citations refreshed for every file in `git diff a138450..HEAD --stat`: `supabase/tests/transitions.sql`, `web/boundaries.test.ts`, `web/composition/composition.test.ts`, `web/composition/contract-pdf.test.ts`, `web/infrastructure/documents/contract-pdf.test.ts`, `web/infrastructure/supabase/contracts.test.ts` and `checks.md`. Assertion judgments for files the fix did not touch are carried from a138450.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1597 | uE gets one contract on the highest version (v2), pending_signature, org A | D, `PASS transitions` | `supabase/tests/transitions.sql:305` - `(select agreement_version_id from public.contracts where id = c) = tests.id('cg1:v2')`; `:303` count = 1; `:307` status = 'pending_signature'; `:308` org_id = orgA | PASS |
| C1598 | parties equals the schema 1 literal; unset keys are present and null | D, `PASS transitions` | `supabase/tests/transitions.sql:319` - `(tests.cg_contract('cg2a')).parties = jsonb_build_object('schema', 1, 'contractor', ... 'Legal A','1 Main St','604-555-0100' ... 'signer', ... 'Avery','avery@customer.ca')`; `:332` the same with `'address', null::text, 'phone', null::text` | PASS |
| C1599 | signer pick over 5 cases | D, `PASS transitions` | `supabase/tests/transitions.sql:347-360` - a table over cg3a..cg3e, `parties -> 'signer' = jsonb_build_object('name', c.want_name, 'email', c.want_email)` | PASS |
| C1600 | customer_recipient: trimmed, null, falls back | D, `PASS transitions` | `supabase/tests/transitions.sql:369` - `private.customer_recipient(tests.id('cg4a:site')) = 'avery@customer.ca'`; `:371` `is null`; `:373` `= 'pat@customer.ca'` | PASS |
| C1601 | one event, payload `{"from": null, "to": "pending_signature", "versionNo": 2}`, actor uE, no outbox | D, `PASS transitions` (re-verified at 13cad3d) | `supabase/tests/transitions.sql:382-383` adds version 2 (`tests.id('cg5:v2')`, version_no 2); `:391` - `e.payload = jsonb_build_object('from', null::text, 'to', 'pending_signature', 'versionNo', 2)`; `:388` exactly one event; `:390` entity/type; `:392` `e.actor_id = tests.id('uE')`; `:393` outbox count unchanged. A hard-coded 1 now fails | PASS |
| C1602 | later edits leave parties unchanged | D, `PASS transitions` | `supabase/tests/transitions.sql:409` - `(tests.cg_contract('cg6')).parties = before_parties` | PASS |
| C1603 | repeat returns the same id, writes nothing; client_signed kept | D, `PASS transitions` | `supabase/tests/transitions.sql:426` - `again = c`; `:427` `tests.cg_state() = state_after_first`; `:432` status stays 'client_signed'; `:434` one pending_signature event | PASS |
| C1604 | lock before the contracts read; unique index; 23505 (structural) | D, `PASS transitions` | `supabase/tests/transitions.sql:443` - `def := regexp_replace(pg_get_functiondef(...), '--[^\n]*', '', 'g')`; `:444` `position('for update' in def) < position('from public.contracts' in def)`; `:446` unique constraint on `agreement_version_id`; `:450` `'23505'` | PASS |
| C1605 | 6 non-accepted statuses: not_accepted, nothing written | D, `PASS transitions` | `supabase/tests/transitions.sql:458-465` - loops over all 6 statuses with `tests.expect_hint(..., '55000', 'not_accepted')` and `tests.cg_state() = before_state` | PASS |
| C1606 | renewed: auto_renewal, nothing written; renegotiated succeeds | D, `PASS transitions` | `supabase/tests/transitions.sql:478` - `expect_hint('C1606 renewed', ..., '55000', 'auto_renewal')`; `:480` state unchanged; `:488` `public.create_contract(b) is not null` | PASS |
| C1607 | inactive site: site_inactive, nothing written | D, `PASS transitions` | `supabase/tests/transitions.sql:500` - `expect_hint('C1607', ..., '55000', 'site_inactive')`; `:502` state unchanged | PASS |
| C1608 | null term_start on the highest version: no_term_start, nothing written | D, `PASS transitions` | `supabase/tests/transitions.sql:513` - `expect_hint('C1608 none', ..., 'no_term_start')`; `:515` `tests.cg_state() = before_state` (new); `:521` `C1608 highest`; `:523` state unchanged | PASS |
| C1609 | 3 no-signer cases | D, `PASS transitions` | `supabase/tests/transitions.sql:536-538` - three `expect_hint(..., '55000', 'no_signer')`; `:540` state unchanged | PASS |
| C1610 | roles: owner/admin ok, viewer 42501, other org and unknown P0002, anon 42501, nothing written | D, `PASS transitions` | `supabase/tests/transitions.sql:551`, `:554` `is not null`; `:558` `'42501'`; `:561-562` `'P0002'`; `:565` `'42501'`; `:567` state unchanged | PASS |
| C1611 | refusal order, 4 pairs | D, `PASS transitions` | `supabase/tests/transitions.sql:590-593` - `expect_hint` gives not_accepted, auto_renewal, site_inactive and no_term_start | PASS |
| C1612 | direct table writes refused; status update affects 1 row; estimator insert refused | D, `PASS transitions` | `supabase/tests/transitions.sql:602-606` - `expect_error(..., '42501')` for 5 writes; `:607` `expect_rows('C1612 status', ..., 1)`; `:610` `'42501'` | PASS |
| C1613 | viewer update/delete contracts give 42501 in C12; C10/C11 unchanged | D, `PASS rls_roles` | `supabase/tests/rls_roles.sql:64-65` - the loop over `array['customers', 'sites', 'assets', 'contracts']` with `expect_error('C12 update ' ..., '42501')`; `:70` `expect_error('C12 delete contracts', ..., '42501')` | PASS |
| C1614 | parties not null, default `{}`, object only | D, `PASS domain_constraints` | `supabase/tests/domain_constraints.sql:299` - `parties = '{}'::jsonb`; `:300` `'23502'`; `:301-303` `'23514'`; `:304-305` `expect_rows(..., 1)` | PASS |
| C1615 | definer, empty search_path, execute rights | D, `PASS transitions` | `supabase/tests/transitions.sql:619` - `prosecdef and proconfig @> array['search_path=""']`; `:620` authenticated can execute; `:621` anon cannot; `:624` the private functions cannot be executed by authenticated or anon | PASS |
| C1616 | contract_signer returns the signer; null for another org or no email; anon 42501 | D, `PASS transitions` | `supabase/tests/transitions.sql:636` - `= jsonb_build_object('name', 'Pat cg1', 'email', 'pat@customer.ca')`; `:637`, `:638` `is null`; `:641` `'42501'` | PASS |
| C1617 | demo backfill and rerun | D, `PASS demo_seed` | `supabase/tests/demo_seed.sql:254` - count = 3; `:255` none `= '{}'`; `:256` contents match; `supabase/tests/demo_seed_rerun.sql:85` refilled; `:88` marker kept | PASS |
| C1618 | a pending contract blocks deactivation after the term has ended | D, `PASS transitions` | `supabase/tests/transitions.sql:656` - `expect_hint('C1618 contract', ..., '55000', 'in_term')`; `:655` the same past term without a contract deactivates | PASS |
| C1619 | ContractStore.create maps each outcome | V | `web/infrastructure/supabase/contracts.test.ts:19` - `toHaveBeenCalledWith("create_contract", { p_agreement_id: AGR })`; `:25` `toEqual({ ok: false, code: hint })` over 5 hints (name now "comes back as that code", `:22`); `:34` 42501/P0002; `:45-46` unavailable, logged once | PASS |
| C1620 | contract messages, exact | V | `web/components/agreements/contract-state.test.ts:6-10` - `toBe("Only an accepted agreement can become a contract.")` etc.; `:15-16`; `:20` idle is null | PASS |
| C1621 | action outcomes | V | `web/app/(app)/contract-actions.test.ts:30-31` - `toEqual({ status: "forbidden" })`, store not called; `:35`; `:42` `rejects.toThrow("NEXT_REDIRECT /contracts/${CON}")`; `:52` `toEqual({ status: code })`; `:59` `/login` | PASS |
| C1622 | reader: contract and signer | V | `web/infrastructure/supabase/agreements.test.ts:772` - `contract).toEqual({ id: "con-1", status: "client_signed" })`; `:782` `toHaveBeenCalledWith("contract_signer", { p_site_id: "s1" })`; `:789` signer null; `:795`, `:802` not called | PASS |
| C1623 | Generate control by role and status | V | `web/components/agreements/agreements.test.ts:622` - `toBe(true)` for 3 roles; `:626` viewer; `:630` with a contract; `:634` 6 statuses | PASS |
| C1624 | Contract line label and href | V | `web/components/agreements/agreements.test.ts:646` - ``toContain(`Contract: ${label}`)``; `:647` `href="\/contracts\/con-1"`; `:648` no button | PASS |
| C1625 | generate prompt states | V | `web/components/agreements/agreements.test.ts:660-662` - one `<button`, no `<form`; `:668-670` signer, term, total; `:671` submit; `:677` `"No signer with an email yet."`; `:683-684` | PASS |
| C1626 | refusals in role=alert; idle none | V | `web/components/agreements/agreements.test.ts:690` - `` toMatch(new RegExp(`<p[^>]*role="alert"[^>]*>...`)) ``; `:695` no alert | PASS |
| C1627 | page binds generate for writers only | V | `web/app/(app)/agreements/[agreementId]/page.test.ts:42-44` - `typeof actions?.generate).toBe("function")`, `create).toHaveBeenCalledWith(AGR)`; `:49` viewer `toBeUndefined()` | PASS |
| C1628 | parseContractParties | V | `web/domain/contract/parties.test.ts:14` - `toEqual({...})`; `:29` missing keys become null; `:49` `toBeNull()` over the invalid inputs | PASS |
| C1629 | ContractReader.get | V | `web/infrastructure/supabase/contracts.test.ts:86` - `view).toEqual({...})`; `:105` parties null; `:110-112` malformed id or no row gives null | PASS |
| C1630 | ContractView content and links | V | `web/components/contracts/contracts.test.ts:67` - `">Contract · AG-1052</h1>"`; `:70-71` anchors; `:73-74` total, Before tax; `:76` `href="\/contracts\/con-1\/pdf"[^>]*>Download PDF` | PASS |
| C1631 | status pill labels with tone | V | `web/components/contracts/contracts.test.ts:96` - `` toMatch(new RegExp(`<span[^>]*data-tone="${tone}"[^>]*>${label}</span>`)) `` | PASS |
| C1632 | lines, schedule, set terms only | V | `web/components/contracts/contracts.test.ts:102-107` - `"Quarterly visit"`, `"Mar, Jun, Sep, Dec"`, `"$1,800.00"`, Visit schedule; `:112-113` null terms absent | PASS |
| C1633 | no form, no button, each role | V | `web/components/contracts/contracts.test.ts:120-121` - `not.toContain("<form")`, `not.toContain("<button")` | PASS |
| C1634 | parties null view | V | `web/components/contracts/contracts.test.ts:127` - `"Parties not recorded for this contract."`; `:128-132` | PASS |
| C1635 | page 404 / login / version | V | `web/app/(app)/contracts/[contractId]/page.test.ts:37` - `rejects.toThrow("NEXT_NOT_FOUND")`; `:50` `/login`; `:56` `toHaveBeenCalledWith(AGR, 2)` | PASS |
| C1636 | 200 headers and bytes, 4 roles | V | `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:92-96` - `toBe(200)`, `"application/pdf"`, `"private, no-store"`, `'attachment; filename="AG-1052-contract.pdf"'`, bytes equal | PASS |
| C1637 | empty 404s; 307 to /login | V | `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:123-125` - `toBe(404)`, `toBe("")`, not rendered; `:138-141` `307`, `/login` | PASS |
| C1638 | empty 503 logged once; reader rejection not caught | V | `web/app/(app)/contracts/[contractId]/pdf/route.test.ts:153-156` - `toBe(503)`, empty body, `log).toHaveBeenCalledTimes(1)`; `:161` `rejects.toThrow("db down")` | PASS |
| C1639 | clause sentences | V | `web/domain/contract/document.test.ts:44-51` - `contractClauses(TERMS, 12)).toEqual([...6 sentences])`; `:85-99` 13 names; `:103` `XX` | PASS |
| C1640 | parties only; terms from the source; mark null | V | `web/domain/contract/document.test.ts:120` - `customerName).toBe("Fernwood Dental")` with `source.customer.name` `"Other"` (`:27`); `:126-127`; `:137` `mark: null` | PASS |
| C1641 | Letter, title, number, parties (and the AC 26 accent colour) | V | `web/infrastructure/documents/contract-pdf.test.ts:73` - `/\/MediaBox \[\s*0 0 612 792\s*\]/`; `:79-90` title, number, contractor, customer, site, signer; `:96` `pdfColours(await render()).has("#1f6f8b")).toBe(true)`, `:98-99` another accent replaces it | PASS |
| C1642 | section order | V | `web/infrastructure/documents/contract-pdf.test.ts:116-132` (test at `:114`) - `inOrder(indexOfIn(all, "Term: ...", "Quarterly visit", "Total per year", "before tax", "GST extra", "Visit schedule", "Service included", "Equipment", "Invoices are payable within 30 days.", "For the Customer: Pat Lee"))` | PASS |
| C1643 | each clause once, in full; 4 nulls absent | V | `web/infrastructure/documents/contract-pdf.test.ts:141` - `all.split(squeezed).length - 1).toBe(1)` with the whole clause, whitespace removed on both sides; `:143` `"Repairworkisdiscountedby10%."`; the null-terms test follows with `not.toContain` for the 4 prefixes | PASS |
| C1644 | signature blocks on the last of 3 pages | V | `web/infrastructure/documents/contract-pdf.test.ts:166` (test at `:155`) - `toHaveLength(3)`; `inOrder([customer, customerSignature, customerDate, contractor, contractorSignature, contractorDate])` | PASS |
| C1645 | Page x of 3 and number on every page; no DRAFT | V | `web/infrastructure/documents/contract-pdf.test.ts:169-177` - ``toContain(`Page ${index + 1} of 3`)``, `"AG-1052"`, `not.toContain("DRAFT")` | PASS |
| C1646 | real route and real renderer | V | `web/composition/contract-pdf.test.ts:87` - filename; `:89` `"%PDF-"`; `:93-94` `"ServiceContract"`, `"PatLee"`; `:95` `toContain(clause.replace(/\s+/g, ""))` for every clause, in full | PASS |
| C1647 | ContractRenderer body is exactly one method; DocumentRenderer pinned; no react | V | `web/boundaries.test.ts:84` - `expect(contract.trim()).toBe("renderContract(document: ContractDocument): Promise<Uint8Array>;")`; DocumentRenderer contains renderAgreement and not renderContract; no react import | PASS |
| C1648 | container wiring; generateContract reaches no other store | V | `web/composition/composition.test.ts:71` - `toContain("contractStore: supabaseContractStore(supabase)")`; `:78` `expect([...reached].sort()).toEqual(["contractStore", "currentMember"])` over the `container.<name>` uses in `contract-actions.ts` | PASS |
| C1649 | advisors | mcp `get_advisors` security (carried from a138450) | verified by recorded evidence at a138450: anon 5 (neither contract function), authenticated 19 including `public.contract_signer` and `public.create_contract`, which matches `.specs/features/contract-generation/checks.md:422`. The fix touched no SQL function | PASS |
| C1650 | live run at 375/768/1440 with touch: Generate shown, confirm creates nothing, lands on the contract, Contract line, PDF, no horizontal scroll, controls >= 44 px at 375/768, no console error; contract deleted afterwards | live, author-side; Verifier read-only `select` at 13cad3d | `.specs/features/contract-generation/checks.md:425` records the run (contract id, count 3 then 4, 7,154-byte `AG-1035-contract.pdf`). `:430` records the owner's two decisions: touch measured by size, not emulated, and the row deleted by `execute_sql`, with resulting counts 3 / 0 / 0. The Verifier's select agrees: 3 contracts, 0 contract events, 0 contracts with `parties = '{}'`, 0 rows and 0 events for `70b2d79a-48e4-4d45-990a-8810d23b379f`. Still unmet: the Generate button and the confirm step (`Generate contract` submit, `Cancel`) were only on screen at 1440 px. At 375 and 768 px the agreement page was measured after the contract existed, with no button. So "every control at least 44 px tall on 375 and 768" and "no page scrolls horizontally" are unproven for that state, and the owner's decisions did not waive it | FAIL |
| C1651 | npm test, tsc, lint, test:db all pass | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run test:db` at 13cad3d | `npm test`: 144 files, 2855 passed, exit 0; tsc exit 0; lint exit 0; test:db `23 passed, 0 failed` | PASS |

## Swept existing re-read

Carried from a138450; the fix touched neither cited file region.
- RLS select on `contracts` for every role: `supabase/tests/rls_roles.sql:26-27` loops `tests.tenant_tables()`, which includes `'contracts'` (`supabase/tests/fixture.sql:15-16`).
- The contract transition assertions: `supabase/tests/transitions.sql:36`, `:220`, `:246` (above the fix's first changed line, 381) still pass.

## Existing tests the feature touched

Verified at 13cad3d. The fix diff `a138450..HEAD` only strengthens assertions:
- `versionNo` 1 became 2 on a two-version fixture.
- C1604 now strips comments before comparing positions.
- C1608 gained an assertion.
- C1647 went from contains to an exact match.
- C1648 gained an assertion.
- The 40-character prefix matches became full-clause matches.
- C1641 gained an accent test.
- One C1619 test name was renamed.

No assertion was removed or loosened. The C1646 change from `"Service Contract"` to `"ServiceContract"` is a whitespace-free match of the same text.

## Round 1 gaps, re-judged at 13cad3d

| # | Round 1 gap | Status |
| --- | --- | --- |
| 1 | C1601 versionNo 1 vs 2 | closed - `supabase/tests/transitions.sql:382-383,391` |
| 2 | C1650 touch not emulated; row not deleted; flow only at 1440 | touch: waived by the owner (`checks.md:430`); deletion: done and confirmed by select; flow at 375/768: **open** |
| 3 | C1604 comments could satisfy the lock-order check | closed - `transitions.sql:443` strips `--` comments. The runtime two-session race (AC 8) remains a disclosed structural limit, stated in the check, not a defect |
| 4 | C1647 contains instead of exact | closed - `web/boundaries.test.ts:84` |
| 5 | C1648 key-name proxy | closed - `web/composition/composition.test.ts:78` reads the action source |
| 6 | C1633 role loop ignores its parameter | **open, minor** - `web/components/contracts/contracts.test.ts:117` unchanged. Not a FAIL: the view takes no role, and the proof fails if a form or button is added |
| 7 | C1608 first case's "writes nothing" | closed - `transitions.sql:515` |
| 8 | C1643/C1646 40-character prefixes | closed - `web/infrastructure/documents/contract-pdf.test.ts:141`, `web/composition/contract-pdf.test.ts:95`. The matching ignores whitespace, so a missing space between words would not be caught. Minor |
| 9 | AC 26 accent colour on the PDF | closed - `web/infrastructure/documents/contract-pdf.test.ts:95-99` |
| 10 | C1619 test name "is undefined" | closed - `web/infrastructure/supabase/contracts.test.ts:22` |
| 11 | plan's "40 PDF tests" count | carried, imprecise number only; all unchanged and green |

## Gaps

1. **C1650 (FAIL)**: the pre-contract state of the agreement page was never measured at 375 or 768 px. That state is the `Generate contract` button and the confirm step with its `Generate contract` submit and `Cancel`. The check requires no horizontal scroll and controls at least 44 px tall at those widths, but the Handoff (`.specs/features/contract-generation/checks.md:425`) shows the flow only at 1440 px. The later 375 and 768 px measurements came after the contract existed. The owner's decisions (`checks.md:430`) cover touch emulation and the deletion only. Two things would close it: a re-run of the press-and-confirm steps at 375 and 768 px (that needs another generate-and-delete with the owner's go-ahead), or an owner waiver recorded in the Handoff.
2. **C1604 (PASS, disclosed limit)**: AC 8's two-session race is proven structurally only (`supabase/tests/transitions.sql:443-450`).
3. **C1633 (PASS, minor)**: the role parameter is unused (`web/components/contracts/contracts.test.ts:117`).
4. **C1643/C1646 (PASS, minor)**: the clause matches ignore whitespace (`web/infrastructure/documents/contract-pdf.test.ts:141`, `web/composition/contract-pdf.test.ts:95`).

## Gate

Verified at 13cad3d:
- `npx vitest run <16 contract paths> --reporter=verbose` - 19 files, 472 passed, 0 failed
- `npm test` - 144 files, 2855 passed, 0 failed
- `npx tsc --noEmit` - exit 0
- `npm run lint` - exit 0
- `npm run test:db` - 23 passed, 0 failed
- mcp `execute_sql` (read-only select) - contracts 3, contract events 0, `parties = '{}'` 0, live-run row 0, live-run events 0
- mcp `get_advisors` (security) - carried from a138450 (anon 5, authenticated 19)
