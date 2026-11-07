# Signature webhook - checks

Profile: standard
Plan: `.specs/features/signature-webhook/plan.md`

55 checks in 6 slices · 6 one-way doors · 4 open, 1 blocks, 1 blocks go-live

## How proofs run

- **vitest** runs from `web/` as `npx vitest run <file> -t "<id>:"`. Every test name starts with its check id and a colon
  (`C1727:`). This feature numbers from C1727, because signature-provider owns up to `C1726`.
  - Pure code, the use case and the adapters are tested with literal values and fakes: a fake `fetch`, a recording
    `stubClient` (`infrastructure/supabase/stub-client.ts`), a fake `SignatureWebhooks` and a fake `SignedDocuments`.
  - Components are asserted with `renderToStaticMarkup`; the repo has no DOM test library (L-014).
  - Routes are tested by calling the exported handler with a `NextRequest`, as `app/api/automation/notify/route.test.ts` does.
- **test:db** means `npm run test:db transitions` in `web/` (AD-026): the assertions go into `supabase/tests/transitions.sql`
  beside the signature-provider rows, because `runner.test.ts` pins 23 recipes and 25 files (C830, C1045). The run is rolled
  back, against project `gnxebrtcpbujhvcamtoe`, and passes only once the migration is applied there (which needs the owner's
  go-ahead). Each assertion is labelled with its check id so a Verifier finds it by `rg "C1729"`. The HMAC secret the tests
  use is a Vault secret created inside the rolled-back transaction (`tests.sw_secret`, as `outbox_dispatch.sql` does).
- **mcp** means a Supabase MCP `get_advisors` call on that project; the result goes in the Handoff.
- **live** means an author-side Playwright run in one signed-in context at 375, 768 and 1440 px with touch, with the owner's
  DocuSeal sandbox key in `web/.env.local`, a DocuSeal webhook pointed at a reachable URL and the Vault secret set (open
  question 2); the result goes in the Handoff.

Terms:

- "the roles" are uA (owner), uD (admin), uE (estimator), uV (viewer) of org A and uB (owner of org B).
- "the contract fixture" is `tests.sg_contract(name)`: an accepted org A agreement made into a `pending_signature` contract
  whose signer is `Pat Lee` `pat@customer.ca`; "the open request" is `tests.sg_open(contract)`: begun by uD and completed
  with submission `13226499`, submitters `101` (customer) and `102` (contractor).
- "a signed delivery" is `public.signature_webhook(body, '<ts>.<hex>')` with the hex computed by the test from the Vault
  secret `whsec_test` and the body text; `ts` is `extract(epoch from now())` unless a check says otherwise.
- "the events" are `form.completed`, `form.declined` and `submission.completed`; "the ignored events" are `form.viewed`,
  `form.started`, `submission.created`, `submission.expired`, `submission.archived`, `template.created` and `x.unknown`.
- "the PDF" is the bytes of `%PDF-1.4 signed` (and `%PDF-1.4 audit` for the audit log) in tests; "its base64" is that
  text base64-encoded.
- "the use case" is `makeReceiveSignatureEvent(webhooks, documents)`; "the fakes" record every call.

## Checks

### S1 - the webhook is believed only when DocuSeal signed it · 8 files · 70 KB · ~18k

**C1727** - `POST /api/webhooks/docuseal` with header `X-Docuseal-Signature: 1790000000.<64 hex>` and body text
`{"event_type":"form.viewed","a":"é"}` calls the use case once with exactly that body string and that header string,
unchanged (AC 1)
Proof: `npx vitest run app/api/webhooks/docuseal/route.test.ts -t "C1727:"`

**C1728** - A missing header, `abc`, `1790000000` (no dot), `.` + 64 hex (no seconds), `1790000000.` + 63 hex, `1790000000.`
+ 64 upper-case hex, and a 13-digit seconds value each give `401 {"error":"unauthorized"}` and call the use case 0 times (AC 2)
Proof: `npx vitest run app/api/webhooks/docuseal/route.test.ts -t "C1728:"`

**C1729** - A delivery whose hex differs from `HMAC-SHA256(secret, ts + "." + body)` in its last character raises `42501`, and
so does one signed over the body with one character changed; the counts of requests, signers, documents, events and outbox
rows are what they were (AC 3)
Proof: `npm run test:db transitions` (assertions `C1729`)

**C1730** - A correct signature with `ts` 300 s before and 300 s after the database clock is accepted (answer `ignored` for
`x.unknown`); 301 s before and 301 s after raise `42501` (AC 3)
Proof: `npm run test:db transitions` (assertions `C1730`)

**C1731** - With the Vault secret `docuseal_webhook_secret` absent, a delivery signed with `whsec_test` raises `42501`, and
so does one signed with the empty string (AC 4)
Proof: `npm run test:db transitions` (assertions `C1731`)

**C1732** - With a correct signature, the bodies `[]`, `"x"`, `7`, `{}`, `{"event_type": 5}` and `not json` each raise `22023` and
write nothing (AC 5)
Proof: `npm run test:db transitions` (assertions `C1732`)

**C1733** - The Supabase adapter calls `rpc("signature_webhook", {p_body, p_signature, p_documents})` with `p_documents` null on a
first call, maps `42501` to `{ok: false, code: "unauthorized"}` and `22023` to `{ok: false, code: "malformed"}`, returns the
parsed answer for `{outcome: "applied"}`, `{outcome: "duplicate"}`, `{outcome: "ignored", reason: "unknown_submission"}` and
`{outcome: "documents_needed", documents: [{kind: "signed", url: "https://docuseal.com/file/a/d.pdf"}, {kind: "audit_log", url: "https://docuseal.com/file/a/audit-log.pdf"}]}`,
and throws on any other error code (AC 3, 5, 16)
Proof: `npx vitest run infrastructure/supabase/signature-webhook.test.ts -t "C1733:"`

**C1734** - The route answers `200 {"outcome":"applied"}`, `200 {"outcome":"duplicate"}`, `200 {"outcome":"ignored","reason":"unknown_submission"}`,
`401 {"error":"unauthorized"}` (use case `unauthorized`), `400 {"error":"malformed"}` and `503 {"error":"unavailable"}` for the six
use-case results (AC 3, 5, 6, 7, 8)
Proof: `npx vitest run app/api/webhooks/docuseal/route.test.ts -t "C1734:"`

**C1735** - When the use case throws `Error("db down")` with the body `{"secret":"BODY-MARKER"}` and the header
`1790000000.<hex>`, the route answers `503 {"error":"unavailable"}` and logs exactly one `console.error` whose text contains
neither `BODY-MARKER` nor the header (AC 8)
Proof: `npx vitest run app/api/webhooks/docuseal/route.test.ts -t "C1735:"`

**C1736** - The answers `200`, `400`, `401` and `503` of the route each carry `Cache-Control: no-store` (AC 9)
Proof: `npx vitest run app/api/webhooks/docuseal/route.test.ts -t "C1736:"`

**C1737** - The proxy lets `POST /api/webhooks/docuseal` through with no session and no redirect to `/login`, while
`/api/webhooks` (no trailing slash) and `/api/other/docuseal` still redirect a signed-out request to `/login` (AC 9, door 4)
Proof: `npx vitest run proxy.webhooks.test.ts -t "C1737:"`

**C1738** - A signed delivery of each of the ignored events returns `{"outcome":"ignored","reason":"event_not_handled"}` and the
counts of requests, signers, documents, events and outbox rows do not change (AC 6)
Proof: `npm run test:db transitions` (assertions `C1738`)

**C1739** - `form.completed`, `form.declined` and `submission.completed` naming submission `999` (no request), and
`form.completed` with no `data.submission.id`, return `{"outcome":"ignored","reason":"unknown_submission"}` and write nothing (AC 7)
Proof: `npm run test:db transitions` (assertions `C1739`)

### S2 - the customer signs and the contract moves · 1 file · 14 KB · ~4k

**C1740** - `form.completed` for submitter `101` of the open request on a `pending_signature` contract returns `{"outcome":"applied"}`;
the contract is `client_signed`; exactly one new event `contract.client_signed` (entity `contract`, payload
`{from: "pending_signature", to: "client_signed", versionNo: 1, via: "docuseal", requestId: <request>}`, `actor_id` null) and exactly
one `pending` outbox row exist; the request is still `open` (AC 10)
Proof: `npm run test:db transitions` (assertions `C1740`)

**C1741** - `form.completed` for submitter `101` with `completed_at` `2026-11-07T22:14:00Z`, `ip` `203.0.113.9`, `ua` `UA/1` stores
`signed_at`, `signed_ip`, `signed_ua` on the customer signer; the same for submitter `102` on the contractor signer; a second
delivery with `completed_at` `2026-11-08T00:00:00Z`, `ip` `198.51.100.1` leaves the first values (AC 11)
Proof: `npm run test:db transitions` (assertions `C1741`)

**C1742** - `form.completed` for the contractor submitter `102` while the contract is `client_signed` leaves the contract `client_signed`
and writes no event and no outbox row (AC 12)
Proof: `npm run test:db transitions` (assertions `C1742`)

**C1743** - `form.completed` for submitter `555` (neither signer), for submitter `101` with `external_id` `<contractId>:contractor`, and
for submitter `101` with `external_id` `<another contract id>:customer` each return `{"outcome":"ignored","reason":"signer_mismatch"}`
and write nothing; submitter `101` with `external_id` `<contractId>:customer`, with `external_id` null and with the key absent
are applied (AC 13)
Proof: `npm run test:db transitions` (assertions `C1743`)

**C1744** - For `form.completed` (customer), `form.completed` (contractor), `submission.completed` and `form.declined`, the second
identical delivery returns `{"outcome":"duplicate"}` and the counts of events, outbox rows and documents equal those after the
first (AC 14, 22)
Proof: `npm run test:db transitions` (assertions `C1744`)

**C1745** - The body of `public.signature_webhook` reads the request `for update` and then the contract `for update`, before any
`insert` or `update` of a table (structural proof of the lock order that makes two concurrent deliveries take turns; the two-session
race itself is not run) (AC 15)
Proof: `npm run test:db transitions` (assertions `C1745`)

### S3 - both parties signed: completed with the signed copy · 6 files · 55 KB · ~14k

**C1746** - `submission.completed` for submission `13226499` of the open request, with `combined_document_url` `https://docuseal.com/file/a/document.pdf` and
`audit_log_url` `https://docuseal.com/file/a/audit-log.pdf` and no documents, returns
`{"outcome":"documents_needed","documents":[{"kind":"signed","url":"https://docuseal.com/file/a/document.pdf"},{"kind":"audit_log","url":"https://docuseal.com/file/a/audit-log.pdf"}]}`
and the counts of documents, events and outbox rows and the contract status are what they were (AC 16)
Proof: `npm run test:db transitions` (assertions `C1746`)

**C1747** - `submission.completed` with `combined_document_url` missing, with `audit_log_url` null and with `audit_log_url` the number 7 raises `22023` (AC 17)
Proof: `npm run test:db transitions` (assertions `C1747`)

**C1748** - `fetch(urls)` requests `https://docuseal.com/file/a/document.pdf` and `https://cdn.docuseal.com/file/b/audit-log.pdf` with `redirect: "manual"`, `cache: "no-store"` and no
`X-Auth-Token`, no `Authorization` and no `Cookie` header, and refuses without calling `fetch` the URLs `http://docuseal.com/x`,
`https://evil-docuseal.com/x`, `https://docuseal.com.evil.net/x`, `https://docuseal.com@evil.net/x`, `https://user:pw@docuseal.com/x`,
`ftp://docuseal.com/x` and `not a url` with `{ok: false, code: "rejected"}` (AC 18)
Proof: `npx vitest run infrastructure/docuseal/signed-documents.test.ts -t "C1748:"`

**C1749** - Given an allowed URL, an answer of `302`, `404` and `500`, a rejected `fetch`, no answer after 30 000 ms (fake timers, aborted),
a body streamed past 10 485 760 bytes and an answer `200` whose bytes do not begin `%PDF-` each give `{ok: false, code: "unavailable"}`,
and an answer `200` with the bytes `%PDF-1.4 signed` gives `{ok: true, files: [{kind: "signed", bytes}]}` with those exact bytes (AC 18, 19)
Proof: `npx vitest run infrastructure/docuseal/signed-documents.test.ts -t "C1749:"`

**C1750** - On `404`, a redirect and a rejected `fetch` the adapter logs one `console.error` line that names the host `docuseal.com` and, for an
answer, the status, and contains neither the path and query of the URL (`/file/SECRET-PATH`, `?sig=SECRET-QUERY`) nor any byte of the body (AC 19)
Proof: `npx vitest run infrastructure/docuseal/signed-documents.test.ts -t "C1750:"`

**C1751** - On `documents_needed` the use case calls `fetch` once with the two documents of the answer, then calls the webhook again with
the same body and header and `documents` `[{kind: "signed", content: "<base64 of the PDF>"}, {kind: "audit_log", content: "<base64 of the audit PDF>"}]`, and returns that call's answer (AC 16, 20)
Proof: `npx vitest run application/use-cases/signature-webhook.test.ts -t "C1751:"`

**C1752** - When `fetch` gives `{ok: false, code: "rejected"}` or `unavailable`, the use case returns `{ok: false, code: "unavailable"}` and the webhook is called once only;
an answer `unauthorized` or `malformed` from the first call is returned as it is with `fetch` called 0 times, and so is every outcome
other than `documents_needed` (AC 19, 3, 5)
Proof: `npx vitest run application/use-cases/signature-webhook.test.ts -t "C1752:"`

**C1753** - From `client_signed` with the open request, `submission.completed` with the two documents returns `{"outcome":"applied"}`: two document rows
exist whose `content` equals the bytes sent, whose `size_bytes` is their length and whose `sha256` equals the independently computed
SHA-256 of the bytes; the request is `completed` with `completed_at` within 5 s of now; the contract is `completed`; exactly one new event
`contract.completed` (payload `{from: "client_signed", to: "completed", versionNo: 1, via: "docuseal", requestId}`, `actor_id` null) and one `pending` outbox row (AC 20)
Proof: `npm run test:db transitions` (assertions `C1753`)

**C1754** - From `pending_signature` with the open request, the same call writes two events in this order, `contract.client_signed` then `contract.completed`
(`from` of the second is `client_signed`), two `pending` outbox rows, and ends with the contract `completed` and two documents (AC 20)
Proof: `npm run test:db transitions` (assertions `C1754`)

**C1755** - Documents with one entry, three entries, two `signed` entries, a kind `other`, content `!!not base64!!`, empty content, content of 10 485 761 bytes
and content not beginning `%PDF-` each raise `22023` and write nothing; content of exactly 10 485 760 bytes beginning `%PDF-` is stored (AC 21)
Proof: `npm run test:db transitions` (assertions `C1755`)

**C1756** - For a request `creating`, `failed`, `voided` or `declined`, each of the events returns `{"outcome":"ignored","reason":"request_closed"}`; for an `open` request whose
contract is `declined` or `voided`, each of the events returns the same; nothing is written in any of the 18 cases (4 request statuses and 2 contract statuses, 3 events each) (AC 23)
Proof: `npm run test:db transitions` (assertions `C1756`)

### S4 - the customer declines inside the form · 1 file · 4 KB · ~1k

**C1757** - `form.declined` with `decline_reason` `  Wrong price  ` on an open request returns `{"outcome":"applied"}` from a `pending_signature` contract and from a `client_signed` one: the request is
`declined`, the contract `declined`, one `contract.declined` event whose payload is `{from, to: "declined", versionNo: 1, via: "docuseal", requestId, reason: "Wrong price"}` and one `pending` outbox row each;
a reason of 501 characters is stored as its first 500 and an absent reason as JSON null (AC 24)
Proof: `npm run test:db transitions` (assertions `C1757`)

### S5 - staff see the result and download the signed copy · 9 files · 60 KB · ~15k

**C1758** - The contract reader, for a contract whose newest request is `completed` with both documents, returns `signed` with `documents` `[{kind: "signed", sizeBytes, sha256}, {kind: "audit_log", ...}]` and
`signers` `[{role: "customer", name: "Pat Lee", signedAt: <Date of 2026-11-07T22:14:00Z>, ip: "203.0.113.9"}, {role: "contractor", ...}]`, returns `signed: null` for a request that is `open`, and
selects no `content` column (AC 25)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C1758:"`

**C1759** - The signed-copy reader returns `{bytes, sha256}` with the exact bytes decoded from PostgREST's `\x2550444f...` hex for an existing document, returns `null` for a malformed id, for no row, and queries by the
contract's id and the kind (AC 26, 27)
Proof: `npx vitest run infrastructure/supabase/signed-copy.test.ts -t "C1759:"`

**C1760** - For a `completed` contract with a completed request and a stored copy, the signing section renders for each of the roles owner, admin, estimator and viewer a link `Signed contract` to
`/contracts/<id>/signed-pdf`, a link `Audit log` to `/contracts/<id>/audit-log-pdf`, and for the customer signer `Pat Lee · Nov 7, 2026, 2:14 PM · 203.0.113.9` (22:14 UTC shown in America/Vancouver) (AC 25)
Proof: `npx vitest run components/contracts/signed-copy.test.ts -t "C1760:"`

**C1761** - For a `declined` contract the signing section renders `This contract was declined.` and no signing form and no `Send for signature` button for each of the four roles, and `signingAreaKind` returns
`declined` for it with a `failed`, a `voided`, a `declined` request and no request (AC 28)
Proof: `npx vitest run components/contracts/signed-copy.test.ts -t "C1761:"`

**C1762** - `GET /contracts/<id>/signed-pdf` for a member of the org with a stored copy answers `200` with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="AG-1052-signed.pdf"`,
`Cache-Control: private, no-store` and a body equal to the stored bytes (AC 26)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/signed-pdf/route.test.ts" -t "C1762:"`

**C1763** - `GET /contracts/<id>/audit-log-pdf` answers `200` with the same headers and `filename="AG-1052-audit-log.pdf"` and the stored audit-log bytes (AC 26)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/audit-log-pdf/route.test.ts" -t "C1763:"`

**C1764** - Both routes answer an empty `404` for the id `not-a-uuid`, for a contract the reader does not return and for a contract with no stored document, and redirect a signed-out request to `/login` (AC 27)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/signed-pdf/route.test.ts" "app/(app)/contracts/[contractId]/audit-log-pdf/route.test.ts" -t "C1764:"`

### S6 - nobody on staff can mark a contract signed by hand · 3 files · 18 KB · ~5k

**C1765** - As uA, uD, uE and uV, `update public.contracts set status = 'completed'` is refused with `42501`, `has_function_privilege('authenticated', 'public.apply_contract_transition(uuid, text, text, text, jsonb)', 'execute')` is false, and
calling it as uE raises `42501`; the contract status is unchanged (AC 29)
Proof: `npm run test:db transitions` (assertions `C1765`)

**C1766** - Over the five contract statuses and the events (`form.completed` customer, `form.completed` contractor, `submission.completed`, `form.declined`) the contract ends as follows: `pending_signature` -> `client_signed`, `pending_signature`, `completed`, `declined`;
`client_signed` -> `client_signed`, `client_signed`, `completed`, `declined`; `completed`, `declined` and `voided` -> unchanged with every event (20 cases) (AC 30)
Proof: `npm run test:db transitions` (assertions `C1766`)

**C1767** - `applyContractCommand` allows `client_sign` only from `pending_signature`, `countersign` only from `client_signed`, `decline` from those two and no other status, which is the set of moves of C1766 (AC 30, door 3)
Proof: `npx vitest run domain/contract/contract.test.ts -t "C1767:"`

### The doors and the rest

**C1768** - `public.signature_webhook(text, text, jsonb)` is the only function of that name, is `security definer` with `search_path=""`, `anon` and `authenticated` may execute it and `public` may not (door 1)
Proof: `npm run test:db transitions` (assertions `C1768`)

**C1769** - `contract_signature_requests.status` accepts `creating`, `open`, `failed`, `voided`, `completed`, `declined` and refuses `signed` (`contract_signature_requests_status_check`); `completed_at` set on an `open` request and null on a
`completed` one are refused (`contract_signature_requests_completed_at_iff_completed`); `contract_signed_documents` refuses kind `other` , sizes 0 and 10 485 761 and accepts 1 and 10 485 760, a `sha256` of `abc`, a second row of the same
kind for a request (`23505`), and a row whose `org_id` differs from the request's (`23503`); `contract_signers` has `signed_at`, `signed_ip`, `signed_ua` (door 2, Relations)
Proof: `npm run test:db transitions` (assertions `C1769`)

**C1770** - As the table owner an `update` and a `delete` of a `contract_signed_documents` row raise `55000`, while deleting its request removes the row (cascade); uA, uD, uE and uV get `42501` on `insert`, `update` and `delete` of the table;
uA selects 1 row of org A's and uB selects 0 of them; a member reads `signed_ip` of `contract_signers` and still cannot select `embed_sealed` (`42501`) (door 2)
Proof: `npm run test:db transitions` (assertions `C1770`)

**C1771** - `SIGNATURE_REQUEST_STATUSES` lists the six statuses in the order of the check; `isLiveRequest` is true for `creating` and `open` only; `signingState` over the 6 request statuses x 5 contract statuses (30) returns `open` only for
(`open`, `pending_signature`), `signed` for (`open`, `client_signed`) and (`open`, `completed`), and `closed` for the other 27 (Impact)
Proof: `npx vitest run domain/contract/signing.test.ts -t "C1771:"`

**C1772** - `getWebhookContainer()` builds the receive function from only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: with `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL` and `SIGNING_LINK_KEY` unset it still returns a callable `receive`, and the client it makes persists no session (startup config)
Proof: `npx vitest run composition/webhook-wiring.test.ts -t "C1772:"`

**C1773** - After the migration, `get_advisors` (security) lists `signature_webhook` under `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable` and no other new finding: `anon` lints 6 -> 7, `authenticated` 25 -> 26 (door 1)
Proof: Supabase MCP `get_advisors` type `security` on `gnxebrtcpbujhvcamtoe`, counts recorded in the Handoff

**C1774** - `npm run test:db` runs every recipe and each passes, including the rows of `transitions.sql` that C14, C15, C1597-C1618 now answer for `apply_contract_transition` (`42501`) and the pins C11 and C13 (Impact)
Proof: `npm run test:db`

**C1775** - `npm test`, `npx tsc --noEmit` and `npx eslint .` exit 0 in `web/`
Proof: `npm test`

**C1776** - live: with the webhook configured, the customer signs on `/sign/<token>` in the sandbox, and within 60 s the contract page reads `Client signed` and shows the contractor's form (AC 10, 11)
Proof: live (Playwright, 375 / 768 / 1440 px), result in the Handoff

**C1777** - live: the owner countersigns; the contract page reads `Completed`, offers `Signed contract` and `Audit log`, shows both signers with their IP, and the SHA-256 of each downloaded file equals the stored `sha256`; the signed file begins `%PDF-` (AC 20, 25, 26)
Proof: live (Playwright, 375 / 768 / 1440 px, touch targets at least 44 px), result in the Handoff

**C1778** - live: resending the completed delivery from the DocuSeal console answers `200 {"outcome":"duplicate"}` and the contract's events do not change (AC 14)
Proof: live (DocuSeal console resend), result in the Handoff

**C1779** - live: declining inside the sandbox form on a second contract moves it to `Declined` and the page reads `This contract was declined.` (AC 24, 28)
Proof: live (Playwright), result in the Handoff

**C1780** - The SHA-256 of the unsigned PDF sent in item 2 is unchanged in `document_sha256` after completion, and `completed_at` is set exactly when the request is `completed`, for the request of C1753 (door 2)
Proof: `npm run test:db transitions` (assertions `C1780`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/webhooks/docuseal` statuses (4) | `200` C1734 · `400` C1734 · `401` C1728 · `503` C1735 | - |
| `rpc signature_webhook` outcomes (7) | `applied` C1740 · `duplicate` C1744 · `ignored` C1738 · `documents_needed` C1746 · `42501` C1729 · `22023` C1732 · `anon` may call C1768 | - |
| `GET /contracts/[contractId]/signed-pdf` statuses (3) | `200` C1762 · `404` C1764 · redirect to `/login` C1764 | - |
| `GET /contracts/[contractId]/audit-log-pdf` statuses (3) | `200` C1763 · `404` C1764 · redirect to `/login` C1764 | - |
| DocuSeal file URL answers (consumed) (7) | `2xx` C1749 · redirect C1749 · `404` C1749 · `500` C1749 · network error C1749 · timeout C1749 · over the cap C1749 | - |
| handled events (4) | customer `form.completed` C1740 · contractor `form.completed` C1742 · `submission.completed` C1753 · `form.declined` C1757 | - |
| ignored events (7) | `form.viewed` C1738 · `form.started` C1738 · `submission.created` C1738 · `submission.expired` C1738 · `submission.archived` C1738 · `template.created` C1738 · `x.unknown` C1738 | - |
| signature header shapes refused (7) | missing C1728 · `abc` C1728 · no dot C1728 · no seconds C1728 · 63 hex C1728 · upper-case hex C1728 · 13-digit seconds C1728 | - |
| signature checks refused by the database (5) | wrong hex C1729 · changed body C1729 · 301 s old C1730 · 301 s ahead C1730 · no secret C1731 | - |
| bodies refused with `22023` (6) | `[]` C1732 · `"x"` C1732 · `7` C1732 · `{}` C1732 · `{"event_type": 5}` C1732 · `not json` C1732 | - |
| `ignored` reasons (4) | `event_not_handled` C1738 · `unknown_submission` C1739 · `signer_mismatch` C1743 · `request_closed` C1756 | - |
| signer mismatch inputs (6) | unknown submitter C1743 · other role's `external_id` C1743 · other contract's `external_id` C1743 · matching `external_id` applied C1743 · null `external_id` applied C1743 · absent `external_id` applied C1743 | - |
| request statuses (6) | `creating` C1756 · `open` C1740 · `failed` C1756 · `voided` C1756 · `completed` C1753 · `declined` C1757 | - |
| closed situations (6) | request `creating` C1756 · request `failed` C1756 · request `voided` C1756 · request `declined` C1756 · contract `declined` C1756 · contract `voided` C1756 | - |
| contract status x event moves (20) | table-driven over all 20 C1766 · parity with `applyContractCommand` C1767 | - |
| document validation refusals (8) | one entry C1755 · three entries C1755 · two `signed` C1755 · kind `other` C1755 · bad base64 C1755 · empty C1755 · 10 485 761 bytes C1755 · no `%PDF-` C1755 | - |
| document size bounds (4 edges) | 0 C1769 · 1 C1769 · 10 485 760 C1769 · 10 485 761 C1769 | - |
| URL allowlist refusals (7) | `http` C1748 · `evil-docuseal.com` C1748 · `docuseal.com.evil.net` C1748 · `@evil.net` C1748 · userinfo C1748 · `ftp` C1748 · not a URL C1748 | - |
| file URLs missing from `submission.completed` (3) | URL missing C1747 · null C1747 · number C1747 | - |
| roles on the download page (4) | owner C1760 · admin C1760 · estimator C1760 · viewer C1760 | - |
| `signingAreaKind` additions (2) | `declined` C1761 · `signed` C1760 | - |
| `signingState` combinations (30) | table-driven over all 30 C1771 | - |
| `Landing` doors (6) | door 1 C1729 · door 2 C1769 · door 3 C1765 · door 4 C1737 · door 5 C1748 · door 6 C1762 | - |
| `Relations` entities (3) | `contract_signature_requests` C1753 · `contract_signed_documents` C1769 · `events` C1740 | - |
| `Relations` one-way constraints (5) | one document per kind per request C1769 · documents never updated or deleted C1770 · `completed_at` only with `completed` C1769 · composite references C1769 · signer facts first write wins C1741 | - |
| events written (3) | `contract.client_signed` C1740 · `contract.completed` C1753 · `contract.declined` C1757 | - |
| startup config, places that wire the webhook (1) | `getWebhookContainer` C1772 | - |
| startup config, environment names (2) | `NEXT_PUBLIC_SUPABASE_URL` C1772 · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` C1772 | - |

- Claims naming a status code, route or response shape: C1728, C1729, C1730, C1731, C1732, C1734, C1735, C1736, C1762, C1763, C1764, each of which has a proof that crosses the boundary (the route handler, or the database)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1728, C1732, C1743, C1747, C1755, C1769
- failure modes: C1735, C1752, C1753 (one transaction), C1756
- idempotency: C1744, C1741 (first write wins)
- authorization: C1729, C1765, C1770 (and existing - `signature_view`, `contractor_signing_source` keep their owner/admin guards from item 2)
- concurrency: C1745 (structural lock order; the two-session race is not run, as item 2's AC 14)
- data lifecycle: C1770 (documents never updated or deleted; the org's cascade removes them) - no retention or deletion path, listed in the plan's Out of scope
- dependency failure: C1749, C1750, C1752, C1735
- state transitions: C1766, C1767, C1756, C1771
- observability: C1735 (a failure is logged without the body), C1750 (host and status only), C1740 (every move writes an event)

## Out of scope

- The product-level exclusions are the plan's `Out of scope` table; nothing is added here.

## Handoff

Size, with the arithmetic (`wc -c` of the files each slice touches, divided by four; budget 150k from `AGENTS..md`, no `budget:` line so the default):

- S1: `ports/index.ts` 46 KB, `session.ts` 3 KB, `notify/route.ts` + test 12 KB and `proxy.automation.test.ts` 1 KB read for the pattern; about 22 KB of new route, use case, port types and Supabase adapter, 30 KB of new SQL (migration function) and tests -> ~28k
- S2: SQL only, 14 KB of tests; the function is in S1's migration -> ~4k
- S3: `docuseal/index.ts` 5 KB read, about 12 KB of new adapter and 25 KB of tests, 20 KB of SQL tests -> ~16k
- S4: 4 KB of SQL tests -> ~1k
- S5: `contracts.ts` 4 KB, `signing-area.tsx` 8 KB, `contract-view.tsx` 6 KB, `contracts.test.ts` 7 KB, `pdf/route.ts` + test 9 KB, `page.tsx` 3 KB read; about 30 KB new (reader, two routes, section, tests) -> ~20k
- S6: `transitions.sql` 69 KB (the affected rows and helpers read, not all), `contract.test.ts` -> ~8k
- Docs and wiring: `composition/index.ts` 13 KB, `database.types.ts` hand-edited at four places, `CONTEXT.md` entries, `ROADMAP.md`, `STATE.md` handoff -> ~12k
- Total ~89k, under the 150k budget -> one builder, no ask.
- Mechanism: one builder (the orchestrator builds; a fresh Verifier is dispatched after the last commit)
- Applying the migration to `gnxebrtcpbujhvcamtoe` is a production schema change: it needs the owner's go-ahead, which the SQL proofs (C1729 to C1757, C1765 to C1770, C1774, C1780) and C1773 wait for.
