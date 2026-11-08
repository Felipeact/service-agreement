# Contract automation verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 0557e89..d9fc0fe
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

Summary: 42 checks (C1781-C1822). 42 PASS, 0 FAIL, 0 Unproven. Round 3 left one open row, C1818, an evidence-timing gap. Commit d9fc0fe recorded a fresh advisors reading taken after the migrations were applied, and it holds up (judged below). `git diff --stat caa7f88..HEAD` touches only `checks.md` (2 lines) and `verification.md`: no code, test or migration changed, so every other row is carried from round 3.

## Binding sources

No binding source: the plan marks none; Step 1 does not run (verified at d9fc0fe).

## Checks

Proofs re-run in full at d9fc0fe: `cd web && npx vitest run` (175 files, 3,372 tests passed) and `npm run test:db` (all 23 recipes PASS, rolled back). Rows C1781-C1817 and C1819-C1822 are carried from round 3 (verified at caa7f88; C1781-C1817 originally from b6c529d). Carrying is safe: `git diff --stat caa7f88..HEAD` lists only `.specs/features/contract-automation/checks.md` and `verification.md`, so every file those rows cite is unchanged since b6c529d..caa7f88's last change. Only C1818 is re-judged here (verified at d9fc0fe).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1781 | W2a Set, HMAC, notify contract_ready, key, retry loop, route | `n8n-workflows.test.ts -t "C1781:"` exit 0, listed | `web/n8n-workflows.test.ts:481` `expect(body).toContain(\`kind: '${kind}'\`)`; `:487` url `__SA_APP_BASE_URL__/api/automation/notify`; `:489` `routeOf(type)` | PASS |
| C1782 | SQL: one contract, event via w2, managers message | `npm run test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1475-1490` `tests.ok('C1782 event', e.actor_id is null and e.payload ->> 'via' = 'w2' ...)` and `'C1782 message'` `m ->> 'kind' = 'staff_contract_ready'` | PASS |
| C1783 | SQL: existing contract, same id, nothing created | test:db PASS | `outbox_dispatch.sql:1496` `tests.ok('C1783', ... -> 'contract' ->> 'id' = c::text and count(*) = 1 ...)` | PASS |
| C1784 | SQL: 5 refusals give the hint and create nothing | test:db PASS | `outbox_dispatch.sql:1527` `m ->> 'refusal' = h and not exists (select 1 from public.contracts ...)`, looped over the 5 hints | PASS |
| C1785 | refusal words, links agreement, no /sign/ | `contract-email.test.ts -t "C1785:"` 6 tests, exit 0 | `web/domain/notifications/contract-email.test.ts:29` `toContain(\`because ${words}.\`)`; `:32-34` no `/contracts/`, no `/sign/` | PASS |
| C1786 | SQL: no managers gives skip/no_recipient after the contract is made | test:db PASS; mutating this last assertion made the run FAIL at C1786 | `outbox_dispatch.sql:1779` `r ->> 'reason' = 'no_recipient' and exists (select 1 from public.contracts ...)` | PASS |
| C1787 | SQL: second delivery duplicate, 1 contract, 1 event, 1 notification | test:db PASS | `outbox_dispatch.sql:1544` `r ->> 'decision' = 'duplicate' ... tests.ca_notifications(ev) = 1` | PASS |
| C1788 | contract-ready email: tenant in subject, number, site, one button | `contract-email.test.ts -t "C1788:"` exit 0 | `contract-email.test.ts:19` `expect(email.subject).toBe("AG-1052 was accepted: ... (Northwind Mechanical Ltd.)")`; `:24` one `<a ` | PASS |
| C1789 | adapter maps message; malformed throws the exact text | `automation-contract.test.ts -t "C1789:"` 7 tests, exit 0 | `web/infrastructure/supabase/automation-contract.test.ts:55` `rejects.toThrow('automation_claim returned a malformed staff_contract_ready message')`; new `:88` `claimOf({ ...staff, idempotencyKey: undefined })` rejects | PASS |
| C1790 | SQL: one sent_for_signature event and one pending outbox row | test:db PASS | `outbox_dispatch.sql:1557` `(select count(*) from public.outbox where event_id = ev and status = 'pending') = 1` | PASS |
| C1791 | W2b notify customer_signing_link, key :link, contractId, route | `n8n-workflows.test.ts -t "C1791:"` 2 tests, exit 0 | `n8n-workflows.test.ts:482` key regex `:link`; `:483` contractId; `:493-495` events Set hands `.entityId` | PASS |
| C1792 | SQL: link claim carries signer address, tenant, number, site, link_sealed | test:db PASS | `outbox_dispatch.sql:1570` `m -> 'to' = '["pat@customer.ca"]' and m ->> 'linkSealed' = tests.ca_sealed('linkca92') and m -> 'agreement' ->> 'number' = 'AG-ca92'`; tenant and site name are not asserted, `signerName is not null` only (weak) | PASS |
| C1793 | unseal with signing tokens, /sign/<token>, contractor name, sent | `notify-contract.test.ts -t "C1793:"` exit 0 | `web/application/use-cases/notify-contract.test.ts:80` `toContain(\`href="${BASE}/sign/tok-abc"\`)`; `:75` `outcome: "sent"` | PASS |
| C1794 | SQL: 9 not-signable situations skip/not_signable, notification skipped | test:db PASS | `outbox_dispatch.sql:1596` `r ->> 'decision' = 'skip' and r ->> 'reason' = 'not_signable' and (select count(*) ... skip_reason = 'not_signable') = i`, 9 cases | PASS |
| C1795 | unreadable link: failed, unavailable, sealed value not logged | `notify-contract.test.ts -t "C1795:"` exit 0 | `notify-contract.test.ts:93` `toEqual({ ok: false, code: "unavailable" })`; `:95` `error: "could not build the email"`; `:96` `not.toContain("sealed-secret-value")` | PASS |
| C1796 | reader: sent, not_sent, pending, null for the latest send event | `contracts.test.ts -t "C1796:"` 6 tests, exit 0; mutant `ascending: true` now fails 1 | `web/infrastructure/supabase/contracts.test.ts:229` `toEqual({ status: "sent", to: ..., sentAt: ... })`; new `:232` `order ["created_at", {ascending:false}]`, `:233` `limit [1]` | PASS |
| C1797 | contract page line: sent, not sent, none | `components/contracts/contract-view.test.ts -t "C1797:"` 7 tests listed and passed (file now discovered) | `web/components/contracts/contract-view.test.ts:54` `toContain("Signing link emailed to pat@customer.ca on Nov 8, 2026")`; `:64` `The signing link email did not go out: ${words}`; `:73` `not.toContain("data-signing-link-email")` | PASS |
| C1798 | SQL: second link delivery duplicate, one row | test:db PASS | `outbox_dispatch.sql:1613` `r ->> 'decision' = 'duplicate' and tests.ca_notifications(ev) = 1` | PASS |
| C1799 | signing-link builder: tenant, number, site, one button, how | `contract-email.test.ts -t "C1799:"` 2 tests, exit 0 | `contract-email.test.ts:49` subject `Please sign service agreement AG-1052 from Northwind Mechanical Ltd.`; `:51` `href="${BASE}/sign/tok-1"`; `:54` `You read it and sign it on that page.` | PASS |
| C1800 | W4 notify contract_signed_copy, key :copy, route contract.completed | `n8n-workflows.test.ts -t "C1800:"` exit 0 | `n8n-workflows.test.ts:481-489` kind, key, url, `routeOf(type)`; retry loop via the C1052 W4 row | PASS |
| C1801 | SQL: 2 party messages with base64 and sha256, staff message without documents | test:db PASS | `outbox_dispatch.sql:1628-1637` `decode(d ->> 'contentBase64','base64') = s.content and s.sha256 = d ->> 'sha256'` guarded by `jsonb_array_length = 2`; `:1642` `not (m ? 'documents')` | PASS |
| C1802 | attachments named by number with the claim's bytes; none on staff | `notify-contract.test.ts -t "C1802:"` exit 0 | `notify-contract.test.ts:103-106` `attachments toEqual([{filename: "AG-1052-audit-log.pdf", contentBase64: PDF_AUDIT}, ...])`; `:112` staff `toBeUndefined()` | PASS |
| C1803 | SQL: not_completed and no_documents skip | test:db PASS | `outbox_dispatch.sql:1667` `r ->> 'reason' = 'not_completed'`; `:1673` `'no_documents'` | PASS |
| C1804 | SQL: same address in either case gives one party message | test:db PASS | `outbox_dispatch.sql:1683` `jsonb_array_length(r -> 'messages') = 2 and (select count(*) ... kind = 'contract_signed_copy') = 1` after `set email = 'PAT@customer.ca'` | PASS |
| C1805 | reserved recipient skipped, other sent, answer sent | `notify-contract.test.ts -t "C1805:"` exit 0 | `notify-contract.test.ts:121` `to` equals `["dana@northwind.ca"]`; `:122-125` `reason: "reserved_domain"`, `outcome: "sent"` | PASS |
| C1806 | SQL: second copy delivery duplicate, no new row | test:db PASS | `outbox_dispatch.sql:1655` `r ->> 'decision' = 'duplicate' and tests.ca_notifications(ev) = 2` | PASS |
| C1807 | Resend posts attachments {filename, content}, none when absent | `resend-attachments.test.ts -t "C1807:"` exit 0 | `web/infrastructure/email/resend-attachments.test.ts:45` `attachments toEqual([{ filename: "AG-1052-signed.pdf", content: "JVBERi0=" }, ...])`; `:52`, `:54` `"attachments" in sentBody()` false | PASS |
| C1808 | over 10,485,760 bytes gives rejected and no fetch | `resend-attachments.test.ts -t "C1808:"` exit 0 | `resend-attachments.test.ts:57` `toEqual({ ok: false, code: "rejected" })`; `:58` `fetchMock not.toHaveBeenCalled()`; `:59` exact cap sent | PASS |
| C1809 | signed-copy email: both signed, names attachments, no signing link; staff links contract | `contract-email.test.ts -t "C1809:"` 2 tests, exit 0 | `contract-email.test.ts:70-74` attachment names, `not.toContain("<a ")`, no `/sign/`; `:80` `Open the contract: ${BASE}/contracts/con-9` | PASS |
| C1810 | SQL: bad signature and 301 s stale give 42501 for 3 kinds | test:db PASS | `outbox_dispatch.sql:1701-1702` `tests.od_state(...) = '42501'` for wrong and stale over 3 bodies; `:1704` contracts and notifications counts unchanged (reads and claims beyond that unasserted) | PASS |
| C1811 | SQL: 4 bad events give P0002 and write nothing | test:db PASS | `outbox_dispatch.sql:1724` `... = 'P0002'` over 4 bodies; `:1727` written-nothing is one `like` on `ea` (weak) | PASS |
| C1812 | SQL: anon and authenticated get 42501 on the private creators | test:db PASS | `outbox_dispatch.sql:1735-1740` four `... = '42501'` (anon x2, owner uA x2); the anon half also fails if anon lacks schema USAGE (not isolated) | PASS |
| C1813 | SQL: key/kind/event mismatch and missing contractId give 22023 | test:db PASS | `outbox_dispatch.sql:1755` `... = '22023'` over the 3 bodies | PASS |
| C1814 | SQL: staff result accepted under the copy key; other event's notification P0002 | test:db PASS | `outbox_dispatch.sql:1646` `... = 'P0002'`; `:1651-1655` `count(*) ... status = 'sent') = 2` | PASS |
| C1815 | SQL: four kinds accepted, unknown 23514 | test:db PASS | `outbox_dispatch.sql:1764` `... = 'ok'` per kind; `:1773` `... = '23514'` for `staff_made_up` | PASS |
| C1816 | in_flight, unavailable, duplicate for the new kinds; route maps through | `notify-contract.test.ts -t "C1816:"` exit 0 | `notify-contract.test.ts:131-143` `{ ok: false, code: "in_flight" }`, `duplicate`, `unavailable`, `unauthorized`, `not_found`; route map is pre-existing `route.test.ts:60-112` | PASS |
| C1817 | container: signing tokens from SIGNING_LINK_KEY, portal from PORTAL_LINK_KEY | `automation-container.test.ts -t "C1817:"` exit 0 | assembly read: `web/composition/index.ts:253` `makePortalTokens(process.env.SIGNING_LINK_KEY)`, `:250` portal `PORTAL_LINK_KEY`; test drives the real `getAutomationContainer` | PASS |
| C1818 | advisors after the migrations show the lints they already had and none for the private functions (re-judged at d9fc0fe) | not re-runnable by the Verifier (no Supabase MCP); recorded in `checks.md` line 266 (commit d9fc0fe) | Specific: `observed_at` 2026-11-08T20:02:33Z, after migrations 20261108100000, 20261108210000 and 20261108220000 were applied (the earlier 2026-11-07T18:45Z reading is superseded); lists 7 anon names (automation_claim, automation_complete, portal_decide, portal_record_view, portal_view, signature_view, signature_webhook) and 26 authenticated; names the five private functions as absent. Consistent with the baseline: AD-143 (`.specs/STATE.md:149`) gives 6 anon / 25 authenticated after `signature_view`, AD-148 (`:154`) adds `signature_webhook` (anon 7, authenticated 26), and the 7 recorded anon names are exactly that set; migrations 100000/210000/220000 add no public function (`create_contract` and `signature_webhook` are redefinitions, `create_contract` already listed), so 7/26 is the expected count. Consistent with the code: `supabase/migrations/20261108100000_contract_automation.sql:75,82,341,406,522` carry `revoke execute ... from public, anon, authenticated` for make_contract, create_contract_for_system, claim_contract_ready, claim_signing_link, claim_signed_copy, and they live in `private`, which the linter does not read. Limit: the 26 authenticated names are not enumerated in the record, only stated as no new name against the earlier reading; the count arithmetic closes it. | PASS (recorded evidence) |
| C1819 | live run end to end (judged from recorded evidence at caa7f88) | cannot be re-observed (test rows deleted); evidence in `checks.md` lines 253-261 | specific and consistent with the code: n8n execution 23; event `via: "w2"` (matches `supabase/tests/outbox_dispatch.sql` C1782); three `400 malformed` refusals with `combined_document_url: null` (matches `web/infrastructure/supabase/signature-webhook.ts:49` 22023 to malformed, and the pre-fix raise "has no document urls"); after migration 20261108210000 the contract is `completed` with `signed` 97,544 bytes and `audit_log` 129,963 bytes stored and W4 `contract_signed_copy` and `staff_contract_signed` both `sent` (matches C1801 and C1814); same-address case (C1804); cleanup stated. Sizes, execution id, status sequence and root cause all line up with the code and with C1820. | PASS (recorded evidence) |
| C1820 | null combined_document_url falls back to documents[0].url; a non-null combined is still preferred; first call writes nothing (verified at caa7f88) | `npm run test:db transitions` PASS (23/23) | `supabase/tests/transitions.sql:1787-1789` `tests.sw_post(tests.sw_done('2001', null_combined)) = jsonb_build_object('outcome','documents_needed','documents', ... 'url','https://docuseal.com/file/b/contract.pdf' ...)`; `:1790` `tests.sw_state() = before_state`; `:1791-1792` `-> 'documents' -> 0 ->> 'url' = 'https://docuseal.com/file/a/document.pdf'`; code `supabase/migrations/20261108210000_signature_webhook_documents_fallback.sql:157` `coalesce(nullif(v_data -> 'combined_document_url','null'::jsonb), v_data #> '{documents,0,url}')` | PASS |
| C1821 | null combined with no documents, empty documents, non-string url each raise 22023 and write nothing (verified at caa7f88) | `npm run test:db transitions` PASS | `transitions.sql:1799-1801` three `tests.expect_error(..., '22023')` (no `documents`, `"documents": []`, `"url": 7`); `:1802` `tests.sw_state() = before_state` | PASS |
| C1822 | contract page passes `signed` (or null) and `contractId` to the signing section (verified at caa7f88) | `npx vitest run "app/(app)/contracts/[contractId]/page.test.ts" -t "C1822:"` 2 tests, in the full run | `web/app/(app)/contracts/[contractId]/page.test.ts:175-176` `expect(signing.signed).toEqual(SIGNED)` and `expect(signing.contractId).toBe(CON)`; `:181` `expect(signing.signed).toBeNull()`; code `page.tsx:53-54` `contractId: contract.id`, `signed: contract.signed ?? null` | PASS |

### Judgment of the C1670 amendment

`supabase/tests/transitions.sql:887-888` `'C1670 one outbox row'`: `count(*) from public.outbox where org_id = orgA = outbox_before + 1 and (select count(*) from public.outbox o where o.event_id = e.id and o.status = 'pending') = 1`. This is a legitimate amendment and stricter, not weaker: the old `= outbox_before` pinned the behaviour AD-152 reverses (door 3 gives the send event one outbox row for W2b), and the new form is exact (a delta of exactly 1 and exactly one pending row bound to that event), so a duplicate, a missing or a non-pending row all fail it. C1790 (`outbox_dispatch.sql:1557`) independently asserts the same one pending row. Sweep (`rg "no outbox|outbox_before|sent_for_signature"` over `supabase/tests`): C1601 (`transitions.sql:371-388`, event `contract.pending_signature`) and C1742 (`:1415-1425`, contractor `form.completed`) concern other events and still hold; `customer_portal.sql` outbox counts are agreement events. All 23 recipes pass, so no other assertion pins the old behaviour.

### C1604 regression fix

`supabase/migrations/20261108220000_create_contract_lock_order.sql` defines `create_contract` with `perform 1 from public.agreements a where a.id = p_agreement_id for update;` before `from public.contracts c`, which is what C1604 requires of its own source. C1604 is unchanged (the `transitions.sql` diff touches only C1670, C1820, C1821) and `transitions` passes; `outbox_dispatch` (C1782-C1784, through `private.make_contract`) still passes.

## Coverage

Recomputed for the rows whose authority the diff touched (verified at caa7f88); every other row is carried from b6c529d and nothing it enumerates changed.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| signed-url sources in `signature_webhook` (2) | migration `20261108210000...sql:157` | `documents[0].url` C1820 fallback · `combined_document_url` C1820 combined wins | - |
| no-usable-url cases (3) | no `documents`, empty array, non-string url | all C1821 | - |
| props the contract page hands the signing section (2) | `page.tsx:53-54` | `contractId` C1822 · `signed` C1822 (value and null) | - |
| recipes in `npm run test:db` (23) | runner output | all 23 PASS | - |
| the rest of the round-2 sets | carried from b6c529d | unchanged | - |

## Test policy rows

`checks.md` adds no `Test policy` rows; judged against the repo convention (verified at caa7f88).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `automation_claim` new branches decide, one assertion per branch | `supabase/migrations/20261108100000_contract_automation.sql` | SQL assertion per branch in `outbox_dispatch.sql` | yes - `outbox_dispatch` PASS at caa7f88 |
| `notify.ts` content and deliver gain 3 cases, proven with fakes | `application/use-cases/notify.ts` | fake-based test per case | yes - `notify-contract.test.ts` in the full run |

## Faults injected

Edits were made in the real tree and restored (`git checkout --` or a byte copy); `git status --porcelain` and `git diff` are empty afterwards. Nothing was applied to the project. Round 4 changed no code, so no new faults were injected; every row below is carried from round 3 (verified at caa7f88).

| Mutation | Location | Killed |
| --- | --- | --- |
| C1820 fallback expectation `contract.pdf` to `contractX.pdf` | `supabase/tests/transitions.sql:1788` | yes (FAIL `C1820 fallback: wrong answer`) |
| C1820 combined-wins expectation `document.pdf` to `documentX.pdf` | `transitions.sql:1792` | yes (FAIL `C1820 combined wins`) |
| C1820 unchanged expectation inverted (`=` to `<>`) | `transitions.sql:1790` | yes (FAIL `C1820 unchanged`) |
| C1821 empty-documents expects 22024 instead of 22023 | `transitions.sql:1800` | yes (FAIL, got 22023) |
| C1821 non-string url expects 22024 | `transitions.sql:1801` | yes (FAIL, got 22023) |
| `signed: contract.signed ?? null` to `signed: undefined` | `web/app/(app)/contracts/[contractId]/page.tsx:54` | yes (both C1822 tests fail) |
| `contractId: contract.id` to `contractId: ""` | `page.tsx:53` | yes (first C1822 test fails) |
| `signed: contract.signed ?? null` to `signed: contract.signed` | `page.tsx:54` | yes (null C1822 test fails) |
| carried from b6c529d and earlier: round-2 mutants (reader order, `!key` guard, last SQL assertion, notify.ts, email builders, adapter, Resend, container, n8n, page line) | see round 2 | yes (all killed) |

Method note: SQL mutants flip a recipe expectation, because the applied migration cannot be mutated and the Verifier may not apply anything. They show the C1820 and C1821 assertions execute and can fail; the first two flips distinguish the fallback and the combined-wins branches (removing either behaviour changes the answer those expectations compare). The C1821 "no documents" case was not flipped separately; it shares the helper with the two that were.

## Changed status since round 3

C1818 moved from Unproven to PASS on the post-migration advisors reading recorded in d9fc0fe. Nothing else changed; no recipe or test changed status.

## Changed status since round 2 (carried from round 3)

Recipes: none changed status in the wrong direction. 23 of 23 PASS now; in round 2 only `outbox_dispatch` had been run against the applied migration, and `transitions` was red at C1604 until `20261108220000`, now green. Tests: 3,370 to 3,372 passed (+2, C1822), no test went red. C1670 amended (judged above). C1818 moved from "open by design" to "measured, observation predates the migration" (still Unproven). C1819 moved from Unproven to PASS on recorded evidence.

## Gate

`cd web && npx vitest run` - 175 files, 3,372 tests passed, 0 failed
`cd web && npx tsc --noEmit` - exit 0
`cd web && npx eslint .` - exit 0
`cd web && npm run test:db` - 23 passed, 0 failed
