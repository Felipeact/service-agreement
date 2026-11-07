# Contract automation verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 0557e89..b6c529d
**Round**: 2 - full
**Verifier**: independent sub-agent (author != verifier)

Summary: 39 checks. 37 PASS, 0 FAIL, 2 Unproven (C1818 advisors, C1819 live run; both open by design, and the Verifier has no Supabase MCP and must not run advisors). The FAIL verdict comes only from those two rows; no code or test finding is open. The round-1 gaps (C1796 order, C1797 discovery, C1789 key guard) are fixed and each fix kills its round-1 mutant. Residual weak assertions, not failures: C1792 tenant and site unasserted, C1810 and C1811 written-nothing breadth, C1812 anon half, C1794 running count.

## Binding sources

No binding source: the plan marks none; Step 1 does not run (verified at b6c529d).

## Checks

Proofs verified at b6c529d. The TypeScript proofs ran in one batched vitest invocation across 8 files (43 tests, each listed individually). The SQL proofs ran as `npm run test:db outbox_dispatch` from `web/` (PASS, rolled back). Every `tests.ok` raises on a false condition, so a PASS means every labelled assertion executed and held. Labels C1782, C1783, C1784, C1786, C1787, C1790, C1792, C1794, C1798, C1801, C1803, C1804, C1806 and C1810-C1815 all appear in `supabase/tests/outbox_dispatch.sql` (found with `rg`).

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
| C1818 | advisors after the migration show no new lints | not run (open by design; no Supabase MCP for the Verifier) | no evidence | Unproven - open by design |
| C1819 | live run | not run (open by design; needs the owner's sandbox and Resend keys) | no evidence | Unproven - open by design |

### SQL reading and fixture assumptions

- The migration is applied and the recipe passes, so the fixture assumptions round 1 flagged are settled by a real run: direct `update public.contracts set status`, `update public.contract_signature_requests set status = 'creating'` and `insert into public.contract_signed_documents` are not blocked by any trigger or constraint (C1794 and C1801 pass).
- Execution proof: with the last assertion (`C1786`, `outbox_dispatch.sql:1779`) mutated to expect `no_recipientX`, `npm run test:db outbox_dispatch` fails with `C1786: gave {"reason": "no_recipient"...}`. The script therefore runs through to its end and no labelled block is skipped. The recipe was restored byte-for-byte (`git diff` empty).
- Weak, not failing: C1792 does not assert tenant or site name; C1810 "nothing written" counts contracts and notifications only; C1811 "nothing claimed" is one `like` on a single key; C1812 anon half also fails with 42501 if anon lacks schema `private` USAGE, so only the authenticated half isolates the function revoke; C1794 `= i` running count holds only while no earlier block leaves a `not_signable` link row.
- SQL fault injection into the migration was not done: the project cannot be mutated safely (no scratch database, no MCP writes), so SQL assertions are judged by reading plus the passing run, and no SQL mutant kills are claimed.

## Coverage

Members recomputed from the migration, the TypeScript unions and the plan `Surface` (verified at b6c529d; SQL members now run).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `create_contract` refusals (5) | migration `make_contract` hints | 5 x C1784 (run); words C1785 | - |
| not-signable situations (9) | request statuses (6) and contract statuses (5) minus open and pending_signature | 9 x C1794 (run) | - |
| new request kinds (3) | `automation_request` kind list | `contract_ready` C1782 · `customer_signing_link` C1792 · `contract_signed_copy` C1801 | - |
| new notification kinds (4) | `notifications_kind_check` and domain union | C1782 · C1792 · C1801 (copy and staff) · constraint C1815; builders C1788, C1799, C1809 | - |
| new idempotency keys (4) | migration keys | `w2:<e>:ready` C1787 · `w2:<e>:link` C1798 · `w4:<e>:copy` C1806 · `w4:<e>:staff` C1814 | - |
| bad-signature faults per kind (6) | 3 kinds x {bad, stale} | all C1810 | - |
| event/entity mismatches (4) | `claim_*` lookups | all C1811 | - |
| key/kind mismatches (3) | `automation_request` | all C1813 | - |
| roles that may not call the private creators (2) | revokes in migration | `anon`, `authenticated` C1812 | - |
| outcomes of `makeNotify` for the new kinds (5) | `NotifyResult`, `notify.ts` | sent C1793 · skipped reserved C1805 · duplicate C1816 · in_flight C1816 · unavailable C1795, C1816 | - |
| `POST /api/automation/notify` statuses (6) | plan `Surface`, `route.ts` | 200 C1793 · 400 C1813 · 401 C1810 · 404 C1811 (SQL raises, run) · 409 C1816 · 503 C1795; mapping pre-existing `route.test.ts:60-112` | - |
| delivery line states (3) | AC 13 | sent, not sent, none C1797 (now discovered); reader C1796 with newest-first and limit 1 | - |
| attachments (3 cases) | `EmailMessage.attachments` | present C1807 · absent C1807 · over cap C1808 | - |
| `Landing` doors (5) | plan `Landing` | door 1 C1815 · door 2 C1812 · door 3 C1790 · door 4 C1807, C1808 · door 5 C1781, C1791, C1800 | - |
| `Relations` entities (1) | plan `Relations` | `notifications` kinds C1815 | - |
| n8n exports (4) | `automation/n8n/` | W2a C1781 · W2b C1791 · W4 C1800 · routes C1781, C1791, C1800 | - |
| startup config, places that build notify (1) | `rg "makeNotify\("`: `composition/index.ts:250` is the only non-test call | C1817 | - |
| startup config, environment names (2) | `composition/index.ts:253`, `:250` | `SIGNING_LINK_KEY` C1817 · `PORTAL_LINK_KEY` C1817 | - |

Door 2 also names advisors (C1818), which stays open and is reported as its own Unproven row above, not as a coverage member.

## Test policy rows

`checks.md` adds no `Test policy` rows; its evidence rows are judged against the repo convention (verified at b6c529d).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `automation_claim` new branches decide, one assertion per branch | `supabase/migrations/20261108100000_contract_automation.sql` | SQL assertion per branch in `outbox_dispatch.sql` | yes - ran and passed against the applied migration |
| `notify.ts` content and deliver gain 3 cases, proven with fakes | `application/use-cases/notify.ts` | fake-based test per case | yes - `notify-contract.test.ts` C1793, C1795, C1802, C1805, C1816 |

## Faults injected

Real tree mutated (no shared node_modules in a worktree), each file restored with `git checkout --` and confirmed by an empty `git diff` and unchanged porcelain. The first three rows were run in round 2 at b6c529d; the rest are carried from 7caae17 and were all killed.

| Mutation | Location | Killed |
| --- | --- | --- |
| reader orders events ascending (`ascending: false` to `true`), re-run at b6c529d | `web/infrastructure/supabase/contracts.ts:88` | yes (C1796, 1 failed 5 passed) |
| `staff_contract_signed` `!key` guard removed, re-run at b6c529d | `web/infrastructure/supabase/automation.ts:148` | yes (C1789, 1 failed 6 passed) |
| last SQL assertion expectation changed (`no_recipient` to `no_recipientX`), proves the recipe executes to its end | `supabase/tests/outbox_dispatch.sql:1779` | yes (test:db FAIL at C1786) |
| carried from 7caae17: signing link opened with portal tokens | `notify.ts:95` | yes (C1793, C1795) |
| carried from 7caae17: attachment names swapped, attachments removed, added to staff, copy provider key dropped | `notify.ts` | yes (C1802) |
| carried from 7caae17: error text changed, sealed link logged | `notify.ts:168-169` | yes (C1795) |
| carried from 7caae17: reserved filter removed, reason changed | `notify.ts` deliver | yes (C1805) |
| carried from 7caae17: email builder links, subjects, sentences, filenames (8 mutants) | `domain/notifications/index.ts` | yes (C1785, C1788, C1799, C1809) |
| carried from 7caae17: documents count, refusal guards, sealed-link guard (4 mutants) | `automation.ts` | yes (C1789) |
| carried from 7caae17: size cap `>` to `>=`, field rename, empty array posted | `infrastructure/email/index.ts` | yes (C1807, C1808) |
| carried from 7caae17: container passes portal tokens as signing | `composition/index.ts:253` | yes (C1817) |
| carried from 7caae17: reader wrong event type, wrong kind, failed branch dropped | `contracts.ts` | yes (C1796) |
| carried from 7caae17: page line shown for pending, text changed | `contract-view.tsx` | yes (C1797) |
| carried from 7caae17: n8n key, kind, routing, HMAC mutants (4) | `automation/n8n/*.json` | yes (C1781, C1791, C1800) |

## Gate

`cd web && npx vitest run` - 175 files, 3,370 tests passed, 0 failed (contract-view test now included)
`cd web && npx tsc --noEmit` - exit 0
`cd web && npx eslint .` - exit 0
Named proofs, batched: 8 files, 43 passed, 0 failed (`-t "C17(8[1589]|9[1-9])|C18(0[0-9]|1[67])"`)
`cd web && npm run test:db outbox_dispatch` - 1 passed, 0 failed
