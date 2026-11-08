# Contract automation - checks

Profile: standard
Plan: `.specs/features/contract-automation/plan.md`

39 checks in 4 slices · 5 one-way doors · 3 open, 0 block, 2 block go-live

## How proofs run

- **vitest** runs from `web/` as `npx vitest run <file> -t "<id>:"`. Every test name starts with its check id and a colon
  (`C1781:`). This feature numbers from C1781, because signature-webhook owns up to `C1780`. Pure code and the use case are
  tested with literal values and fakes (a fake `AutomationCallbacks`, a recording `EmailSender`, a fake `fetch`); components
  with `renderToStaticMarkup` (L-014); the n8n exports as data in `web/n8n-workflows.test.ts`.
- **test:db** means `npm run test:db outbox_dispatch` in `web/` (AD-026): the assertions go into
  `supabase/tests/outbox_dispatch.sql` beside the W7/W8 rows, because `runner.test.ts` pins 23 recipes and 25 files (C830,
  C1045). The run is rolled back against project `gnxebrtcpbujhvcamtoe` and passes only once the migration is applied there,
  which needs the owner's go-ahead. Each assertion is labelled with its check id so a Verifier finds it by `rg "C1782"`.
- **mcp** means a Supabase MCP `get_advisors` call on that project; the result goes in the Handoff.

Terms:

- "the contract fixture" is `tests.sg_contract(name)` and "the open request" `tests.sg_open(contract)` from
  `transitions.sql`, re-created in `outbox_dispatch.sql` for the signing events; "the managers" are the owners and admins of
  org A with an email; the sealed link is a value of the `v1.<16>.<rest>` shape.

## Checks

### S1 - Accept makes the contract and tells the office (W2a) · 5 files · ~70 KB · ~18k

**C1781** - `W2a-contract-ready.json` is Set -> Crypto HMAC (`__SA_HMAC_SECRET__`) -> HTTP Request to `__SA_APP_BASE_URL__/api/automation/notify` with body kind `contract_ready`, key `w2:<eventId>:ready`, `eventId` and `agreementId`, and AD-079's retry loop; `events.json` routes `agreement.accepted` to it (AC 1)
Proof: `npx vitest run n8n-workflows.test.ts -t "C1781:"`

**C1782** - A signed `contract_ready` claim for an accepted agreement with a site contact creates one contract, writes one `contract.pending_signature` event with `actor_id` null and payload `via: "w2"`, and returns one `staff_contract_ready` message to the managers' emails (AC 2)
Proof: `npm run test:db outbox_dispatch` (assertion `C1782`)

**C1783** - A claim for an agreement whose highest version already has a contract creates nothing and returns the same contract id in the message (AC 3)
Proof: `npm run test:db outbox_dispatch` (assertion `C1783`)

**C1784** - Each refusal of `create_contract` (`not_accepted`, `auto_renewal`, `site_inactive`, `no_term_start`, `no_signer`) makes the claim create nothing and return a `staff_contract_ready` message whose `refusal` is that hint (AC 4)
Proof: `npm run test:db outbox_dispatch` (assertion `C1784`, table-driven over the 5)

**C1785** - The contract-ready email builder says in plain words, for each of the five hints, why the contract could not be made, links to `/agreements/<id>`, and for a made contract links to `/contracts/<id>`; neither contains `/sign/` (AC 4, AC 7)
Proof: `npx vitest run domain/notifications/contract-email.test.ts -t "C1785:"`

**C1786** - An org with no owner or admin email gets `skip` / `no_recipient` after the contract is made (AC 5)
Proof: `npm run test:db outbox_dispatch` (assertion `C1786`)

**C1787** - The same event delivered twice answers `duplicate` the second time, with one contract, one event and one notification row (AC 6)
Proof: `npm run test:db outbox_dispatch` (assertion `C1787`)

**C1788** - The contract-ready email carries the tenant's name in the subject, the agreement number, the site name and one button (AC 7)
Proof: `npx vitest run domain/notifications/contract-email.test.ts -t "C1788:"`

**C1789** - `supabaseAutomationCallbacks` turns a `staff_contract_ready` message into the app's type and throws `automation_claim returned a malformed staff_contract_ready message` when its key, agreement or contract is missing (AC 2)
Proof: `npx vitest run infrastructure/supabase/automation-contract.test.ts -t "C1789:"`

### S2 - The customer's signer is emailed the signing link (W2b) · 6 files · ~80 KB · ~20k

**C1790** - Completing a signature request writes exactly one `contract.sent_for_signature` event and exactly one `pending` outbox row for it, in one transaction (AC 8)
Proof: `npm run test:db outbox_dispatch` (assertion `C1790`)

**C1791** - `W2b-signing-link.json` calls notify with kind `customer_signing_link`, key `w2:<eventId>:link`, `eventId` and `contractId`, with the retry loop; `events.json` routes `contract.sent_for_signature` to it (AC 9)
Proof: `npx vitest run n8n-workflows.test.ts -t "C1791:"`

**C1792** - A signed `customer_signing_link` claim for an `open` request on a `pending_signature` contract returns one message to the customer signer's address with the tenant, agreement number, site name and the signer's `link_sealed` (AC 10)
Proof: `npm run test:db outbox_dispatch` (assertion `C1792`)

**C1793** - `makeNotify` unseals `linkSealed` with the signing tokens (not the portal tokens), sends one email whose button is `<base>/sign/<token>`, in the contractor's name, and answers `sent` (AC 10)
Proof: `npx vitest run application/use-cases/notify-contract.test.ts -t "C1793:"`

**C1794** - A claim where the request is `creating`, `failed`, `voided`, `declined` or `completed`, or the contract is `client_signed`, `completed`, `declined` or `voided`, answers `skip` / `not_signable` and writes the notification `skipped` (AC 11)
Proof: `npm run test:db outbox_dispatch` (assertion `C1794`, table-driven over the 9 situations)

**C1795** - When `linkSealed` cannot be opened `makeNotify` records the message `failed` with `could not build the email`, answers `unavailable`, and no log line contains the sealed value (AC 12)
Proof: `npx vitest run application/use-cases/notify-contract.test.ts -t "C1795:"`

**C1796** - The contract reader returns, for the contract's latest `contract.sent_for_signature` event, `sent` with the address and time, `not_sent` (`failed` or the skip reason) or `pending`, and `null` for a contract never sent (AC 13)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C1796:"`

**C1797** - The contract page shows `Signing link emailed to <address>`, `The signing link email did not go out: <reason>` or nothing, in the section beside the signing state (AC 13)
Proof: `npx vitest run components/contracts/contract-view.test.ts -t "C1797:"`

**C1798** - A second delivery of the same `customer_signing_link` answers `duplicate` with one notification row (AC 14)
Proof: `npm run test:db outbox_dispatch` (assertion `C1798`)

**C1799** - The signing-link email builder names the tenant, the agreement number and the site, carries one button to the address it is given, and says the customer signs on that page (AC 10)
Proof: `npx vitest run domain/notifications/contract-email.test.ts -t "C1799:"`

### S3 - Both parties get the signed copy (W4) · 6 files · ~90 KB · ~23k

**C1800** - `W4-contract-signed.json` calls notify with kind `contract_signed_copy`, key `w4:<eventId>:copy`, `eventId` and `contractId`, with the retry loop; `events.json` routes `contract.completed` to it (AC 15)
Proof: `npx vitest run n8n-workflows.test.ts -t "C1800:"`

**C1801** - A claim for a `completed` contract with both documents returns one `contract_signed_copy` message for each signer and one `staff_contract_signed` for the managers, with each document's bytes as base64 and `sha256` equal to the stored value for the two party messages, and no document on the staff message (AC 16)
Proof: `npm run test:db outbox_dispatch` (assertion `C1801`)

**C1802** - `makeNotify` sends each party message with attachments `<number>-signed.pdf` and `<number>-audit-log.pdf` whose bytes equal the claim's base64, and the staff message with none (AC 16)
Proof: `npx vitest run application/use-cases/notify-contract.test.ts -t "C1802:"`

**C1803** - A claim for a contract that is not `completed` answers `skip` / `not_completed`, and one missing either document `no_documents`; neither sends (AC 17)
Proof: `npm run test:db outbox_dispatch` (assertion `C1803`)

**C1804** - When the customer signer and the contractor signer share an address (compared lower-case) the claim returns one party message, not two (AC 18)
Proof: `npm run test:db outbox_dispatch` (assertion `C1804`)

**C1805** - With one recipient on a reserved domain, `makeNotify` still sends the other, records the reserved one `skipped` / `reserved_domain`, and answers `sent` (AC 19)
Proof: `npx vitest run application/use-cases/notify-contract.test.ts -t "C1805:"`

**C1806** - A second delivery of `contract_signed_copy` answers `duplicate` and writes no second notification row (AC 20)
Proof: `npm run test:db outbox_dispatch` (assertion `C1806`)

**C1807** - `resendEmailSender` posts `attachments: [{filename, content}]` with the base64 content for each attachment and no `attachments` key when there are none (AC 21)
Proof: `npx vitest run infrastructure/email/resend-attachments.test.ts -t "C1807:"`

**C1808** - `resendEmailSender` returns `{ok: false, code: "rejected"}` and calls no `fetch` when an attachment decodes to more than 10,485,760 bytes (AC 21)
Proof: `npx vitest run infrastructure/email/resend-attachments.test.ts -t "C1808:"`

**C1809** - The signed-copy email builder tells the party the contract is fully signed, names both attachments, and links nothing that signs; the staff note links to `/contracts/<id>` (AC 16)
Proof: `npx vitest run domain/notifications/contract-email.test.ts -t "C1809:"`

### S4 - Only the signed HMAC reaches any of it · 5 files · ~60 KB · ~15k

**C1810** - A `contract_ready`, `customer_signing_link` or `contract_signed_copy` body with a bad signature or a timestamp 301 s old makes `automation_claim` raise `42501`, creating, claiming and reading nothing (AC 22)
Proof: `npm run test:db outbox_dispatch` (assertion `C1810`, 3 kinds x 2 faults)

**C1811** - An event that does not exist, belongs to another agreement or contract, or is not of the type the kind needs raises `P0002` and writes nothing (AC 23)
Proof: `npm run test:db outbox_dispatch` (assertion `C1811`, table-driven)

**C1812** - `anon` and `authenticated` calling `private.create_contract_for_system` and `private.make_contract` get `42501` (AC 24)
Proof: `npm run test:db outbox_dispatch` (assertion `C1812`)

**C1813** - A key that does not match its kind and event (`w2:<event>:ready` for a signing link, a wrong event id, a missing `contractId`) raises `22023` (AC 22, Surface `400`)
Proof: `npm run test:db outbox_dispatch` (assertion `C1813`)

**C1814** - `automation_complete` accepts results for the W4 staff notification (`w4:<event>:staff`) under the request key `w4:<event>:copy` and still refuses a result naming another event's notification with `P0002` (door 1)
Proof: `npm run test:db outbox_dispatch` (assertion `C1814`)

**C1815** - `notifications.kind` accepts the four new kinds and still refuses an unknown one with `23514` (door 1)
Proof: `npm run test:db outbox_dispatch` (assertion `C1815`)

**C1816** - `makeNotify` answers `in_flight` (route `409`) and `unavailable` (route `503`) for the new kinds exactly as for the old, and the route maps `401`, `404` and `400` through (Surface)
Proof: `npx vitest run application/use-cases/notify-contract.test.ts -t "C1816:"`

**C1817** - `getAutomationContainer` builds `notify` with the signing tokens made from `SIGNING_LINK_KEY` and the portal tokens from `PORTAL_LINK_KEY`; a link sealed with the first does not open with the second (door 4, startup config)
Proof: `npx vitest run composition/automation-container.test.ts -t "C1817:"`

**C1818** - The advisors list after the migration shows the lints it already had and none for `create_contract_for_system` or `make_contract` (door 2)
Proof: Supabase MCP `get_advisors` (security) on `gnxebrtcpbujhvcamtoe`, result in the Handoff

**C1819** - The live run: accept the demo agreement, see the managers' email, press Send, see the signing-link email, sign both sides in the sandbox, see the two copies with attachments (AC 1, 8, 15)
Proof: live author-side run with the owner's DocuSeal sandbox and Resend keys (open question 3); result in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `create_contract` refusals (5) | `not_accepted` C1784 · `auto_renewal` C1784 · `site_inactive` C1784 · `no_term_start` C1784 · `no_signer` C1784 · words for each C1785 | - |
| not-signable situations (9) | request `creating` C1794 · `failed` C1794 · `voided` C1794 · `declined` C1794 · `completed` C1794 · contract `client_signed` C1794 · `completed` C1794 · `declined` C1794 · `voided` C1794 | - |
| new request kinds (3) | `contract_ready` C1782 · `customer_signing_link` C1792 · `contract_signed_copy` C1801 | - |
| new notification kinds (4) | `staff_contract_ready` C1782 · `customer_signing_link` C1792 · `contract_signed_copy` C1801 · `staff_contract_signed` C1801 · constraint C1815 | - |
| new idempotency keys (4) | `w2:<e>:ready` C1787 · `w2:<e>:link` C1798 · `w4:<e>:copy` C1806 · `w4:<e>:staff` C1814 | - |
| bad-signature faults per kind (6) | `contract_ready` bad signature C1810 · `contract_ready` stale C1810 · `customer_signing_link` bad signature C1810 · `customer_signing_link` stale C1810 · `contract_signed_copy` bad signature C1810 · `contract_signed_copy` stale C1810 | - |
| event/entity mismatches (4) | no such event C1811 · another entity's event C1811 · wrong type C1811 · wrong contract C1811 | - |
| key/kind mismatches (3) | ready key on a link kind C1813 · wrong event id C1813 · missing `contractId` C1813 | - |
| roles that may not call the private creators (2) | `anon` C1812 · `authenticated` C1812 | - |
| outcomes of `makeNotify` for the new kinds (5) | sent C1793 · skipped reserved C1805 · duplicate C1816 · in_flight C1816 · unavailable C1795, C1816 | - |
| `POST /api/automation/notify` statuses (6) | 200 C1793 · 400 C1813 · 401 C1810 · 404 C1811 · 409 C1816 · 503 C1795 | - |
| delivery line states (3) | sent C1797 · not sent C1797 · none C1797; reader C1796 | - |
| attachments (3 cases) | present C1807 · absent C1807 · over cap C1808 | - |
| `Landing` doors (5) | door 1 C1815 · door 2 C1812 · door 3 C1790 · door 4 C1807 · door 5 C1781, C1791, C1800 | - |
| `Relations` entities (1) | `notifications` kinds C1815 | - |
| n8n exports (4) | W2a C1781 · W2b C1791 · W4 C1800 · `events.json` routes C1781, C1791, C1800 | - |
| startup config, places that build the notify use case (1) | `getAutomationContainer` C1817 | - |
| startup config, environment names (2) | `SIGNING_LINK_KEY` C1817 · `PORTAL_LINK_KEY` C1817 | - |

- Claims naming a status code, route or response shape: C1793, C1795, C1810, C1811, C1813, C1816, each of which has a proof that crosses the boundary (the database, or the use case that the route calls)
- No other check claims more than the single case its proof exercises

## Test policy

The repo answers the level question for this code: `automation_claim` and its helpers are decisions proven in SQL with one case per row (C1020-C1031, C1470-C1473 for W7), `notify.ts` is proven with fakes (`notify.test.ts`), the n8n exports are proven as data (`n8n-workflows.test.ts`). No new rows.

Evidence:

- `automation_claim` (new branches): dispatches over 3 new kinds, about 14 branch points -> decides; closest analogue `claim_expiries` (W8), proven in `outbox_dispatch.sql` with one assertion per branch
- `notify.ts` `content` and `deliver`: gains 3 cases -> decides; analogue the renewal cases in `notify.test.ts`

## Swept

- validation: C1813, C1808, C1789
- failure modes: C1795, C1805, C1816
- idempotency: C1787, C1798, C1806
- authorization: C1810, C1812 (and existing - the contract routes keep their member guard from item 3)
- concurrency: C1787 (the notification key is unique; `create_contract` locks the agreement `for update`, as `create_contract` does, so two deliveries make one contract)
- data lifecycle: n/a - no stored-data shape change; no row is deleted or expired by this feature
- dependency failure: C1795, C1805, C1816 (Resend refusal and an unreadable link both answer `503`, so n8n retries)
- state transitions: C1794, C1803
- observability: C1795 (a failure is logged without the sealed value); every contract made by W2 writes its event (C1782)

## Out of scope

- The product-level exclusions are the plan's `Out of scope` table; nothing is added here.

## Handoff

Size, with the arithmetic (`wc -c` of the files each slice touches, divided by four; budget 150k from `AGENTS..md`, profile `standard`, no `budget:` line so the default):

- S1: `outbox_dispatch.sql` 140 KB (read for helpers, new assertions about 12 KB), `20261104203234_contact_roles.sql` 14 KB and `20261102222043_proposal_expiry.sql` 30 KB read, about 25 KB of new migration, `notify.ts` 8 KB, `automation.ts` 7 KB, `domain/notifications/index.ts` 13 KB, `n8n-workflows.test.ts` 12 KB -> ~45k
- S2: `contracts.ts` 5 KB, `contract-view.tsx` 6 KB, `signing.ts` 10 KB read, about 10 KB new SQL and 12 KB of new TypeScript -> ~14k
- S3: `resend` adapter 4 KB, about 8 KB new SQL, 6 KB of TypeScript -> ~8k
- S4: tests only, about 10 KB -> ~3k
- Docs and wiring: `ports/index.ts` 46 KB (the message union read), `composition/index.ts` 13 KB, `database.types.ts` (constraint unchanged; `Database` untouched), `CONTEXT.md`, `ROADMAP.md`, `STATE.md` -> ~25k
- Total ~95k, under the 150k budget -> one builder, no ask.
- Mechanism: one builder (the orchestrator builds; a fresh Verifier is dispatched after the last commit)
- Applying the migration to `gnxebrtcpbujhvcamtoe` is a production schema change: it needs the owner's go-ahead, which the SQL proofs (C1782 to C1815) and C1818 wait for.

### Build: C1781-C1817 (C1782-C1815 SQL halves written, not run; C1818, C1819 open)

- **Boundary:** TypeScript, n8n exports and migration closed locally; proofs: `npx vitest run` 174 files and 3,363 tests, `tsc --noEmit` and `eslint .` clean. The SQL proofs are written in `supabase/tests/outbox_dispatch.sql` and parse (pglast), but have **not run**: they need migration `20261108100000_contract_automation` applied to `gnxebrtcpbujhvcamtoe`, which needs the owner's go-ahead (blast radius). C1818 (advisors) and C1819 (live run) wait on the same go-ahead and on the owner's n8n import.
- **Settled mid-build, amendments to approved text (no assertion weakened or removed):**
  - Existing pins that counted the n8n exports changed because the exports changed: `web/n8n-workflows.test.ts` C1033 (the folder holds the listed exports, nine now), C1034 (routes six types, seven router outputs, the fallback is output 6), C1035 (ten notify calls) and C1260 (nine exports, ten calls); the C1052 table gained W2a, W2b and W4.
  - `notify` takes the signing tokens as an optional fifth argument that defaults to the portal tokens, so every old call site is unchanged; C1817 proves the container passes the right ones.
  - C1801 and C1814 are proven in one block of `outbox_dispatch.sql` (the staff note is completed under the copy's key in the same test); C1806 follows in that block.
  - The party message has its own provider key `w4:<eventId>:copy:<role>` (AD-150), so Resend dedupes each email separately.
- **Found by the parser, not by a test:** an unparenthesised `CASE` inside an `IF` condition in `automation_request` ended the condition at the first inner `THEN`; wrapped in parentheses before the commit.
- **Abandoned:** one workflow with a Switch for all three events (door 5's rejected alternative stands); a Storage link for the signed copy (door 4).


### Measured after the migration was applied (2026-11-08)

- **C1782-C1815 (SQL):** `npm run test:db outbox_dispatch` passes against `gnxebrtcpbujhvcamtoe` (author run, then Verifier round 2).
- **C1818:** `get_advisors` (security) lists 7 `anon` and 26 `authenticated` `SECURITY DEFINER` findings, the baseline plus item 3's `signature_webhook`, and nothing for `private.make_contract` or `private.create_contract_for_system` (private schema, `execute` revoked). The result's `observed_at` is 2026-11-07T18:45Z, so it may be cached from before the migration; the two new functions would not appear either way, because the linter reads the exposed schema only.
- **Verifier round 2:** 37 of 39 proven, 0 failed, no surviving mutant; C1819 (live run) open. Weak spots it listed and I left: C1792 does not assert tenant or site name; C1810 and C1811 check "nothing written" narrowly; C1812's anon half also gives 42501 without schema USAGE; C1794 counts skipped rows with a running total.

### Found in the live run (2026-11-08): amendment to item 3, additive checks

- The live DocuSeal account sends `combined_document_url: null` on `submission.completed`; the signed PDF is `documents[0].url`. `signature_webhook` raised `22023` ("has no document urls"), so the contract stayed `client_signed` after both parties signed. Fixed by migration `20261108210000_signature_webhook_documents_fallback`.

**C1820** - With `combined_document_url` null, `signature_webhook` asks for `documents[0].url` as the signed file; a non-null `combined_document_url` is still preferred, and the first call writes nothing
Proof: `npm run test:db transitions` (assertion `C1820`)

**C1821** - With `combined_document_url` null and no `documents`, an empty `documents` or a non-string `documents[0].url`, `signature_webhook` raises `22023` and writes nothing
Proof: `npm run test:db transitions` (assertion `C1821`, 3 cases)


### Regression found when `transitions` was first run after the migration (2026-11-08)

- Neither the author nor Verifier round 2 ran `npm run test:db transitions` after `20261108100000`; only `outbox_dispatch` was run. `transitions` fails at **C1604** (contract-generation, structural: `create_contract`'s own source must hold `for update` before `from public.contracts`), because the body moved to `private.make_contract`. The check is correct and unchanged. Migration `20261108220000_create_contract_lock_order` puts the lock and the existing-contract lookup back in `create_contract` (drafted, not applied). Lesson for the next round: run every recipe whose subject a migration touches, not only the feature's own.

- **Applied and measured (2026-11-08, with the owner's go-ahead):** `20261108210000_signature_webhook_documents_fallback` and `20261108220000_create_contract_lock_order`. `npm run test:db`: all 23 recipes pass (C1604 green again, C1820 and C1821 green).
- **Amendment to an existing assertion, listed:** `transitions.sql` C1670 `no outbox` ("an outbox row was written" must not happen) pinned what door 3 / AD-152 deliberately reverses; it is now `one outbox row`: exactly one more row than before and exactly one `pending` row for the send event. Stricter, not weaker.
