# Signature provider - checks

Profile: standard
Plan: `.specs/features/signature-provider/plan.md`

69 checks in 6 slices · 8 one-way doors · 2 open, 0 block (1 blocks go-live)

## How proofs run

- **vitest** runs from `web/` as `npx vitest run <file> -t "<id>:"`. Every test name starts with its check id and a colon
  (`C1652:`). This feature numbers from C1652, because contract-generation owns up to `C1651`.
  - Pure code (`signingState`, the adapter's mapping, the use case with fakes) is tested with literal values.
  - Supabase adapters are tested with the recording `stubClient` (`infrastructure/supabase/stub-client.ts`).
  - Components are asserted with `renderToStaticMarkup`; the repo has no DOM test library, so a stateful control is
    proven by rendering the control itself in its initial state and its prompt in each state (L-014).
  - The DocuSeal adapter is tested with a fake `fetch` passed in; no test reaches the network.
- **test:db** means `npm run test:db transitions` in `web/` (AD-026): the assertions go into `transitions.sql`, beside
  `create_contract`, because `runner.test.ts` pins 23 recipes and 25 files (C830, C1045). It runs against project `gnxebrtcpbujhvcamtoe`, rolled back, and passes only once the migration is applied there.
  Each assertion is labelled with its check id. Named hints use `tests.expect_hint` (L-025, L-030).
- **mcp** means a Supabase MCP `get_advisors` or `execute_sql` call on that project; the result goes in the Handoff.
- **live** means an author-side Playwright run in one signed-in context (playwright-single-context) at 375, 768 and
  1440 px with touch, plus the owner's DocuSeal key in `web/.env.local`; the result goes in the Handoff.

Terms:
- "the roles" are uA (owner), uD (admin), uE (estimator), uV (viewer) of org A and uB (owner of org B).
- "the contract fixture" is a contract of org A made by `create_contract` on an accepted fixture whose site contact is
  `Pat Lee` `pat@customer.ca`, status `pending_signature`, `parties` schema 1.
- "the request fixture" is a request created by `begin_signature_request` as uD with name `Dana Admin` and the token
  hash `h1` (64 lowercase hex characters).
- "the use case" is `makeSendForSignature(store, renderer, provider, tokens, reader)`; "the fakes" record every call.
- "the document" is the `ContractDocument` of the fixture `AG-1052`; "the PDF" is its bytes `[1, 2, 3]` in unit tests.

## Checks

### S1 - the provider port and the DocuSeal adapter · 4 files · 30 KB · ~8k

**C1652** - `createRequest` sends one `POST https://api.docuseal.com/submissions/pdf` (the configured URL, no trailing
slash doubled) with header `X-Auth-Token: <key>` and a JSON body whose `order` is `"preserved"`, `send_email` is `false`,
`remove_tags` is `true`, whose one document is `{name: "AG-1052-contract.pdf", file: "AQID"}` (base64 of `[1, 2, 3]`), and
whose `submitters` are, in this order, `{role: "Customer", name: "Pat Lee", email: "pat@example.com", external_id: "<contractId>:customer"}`
then `{role: "Contractor", name: "Dana Admin", email: "dana@example.com", external_id: "<contractId>:contractor"}` (AC 2, door 1)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1652:"`

**C1653** - Given the answer `{id: 13226499, submitters: [{id: 17214316, role: "Customer", embed_src: "https://docuseal.com/s/a"}, {id: 17214317, role: "Contractor", embed_src: "https://docuseal.com/s/b"}]}`
`createRequest` returns `{ok: true, submissionId: "13226499", signers: [{role: "customer", submitterId: "17214316", embedSrc: "https://docuseal.com/s/a"}, {role: "contractor", submitterId: "17214317", embedSrc: "https://docuseal.com/s/b"}]}`,
and returns the same when the submitters arrive in the other order (AC 1, AC 2, door 1)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1653:"`

**C1654** - An answer of `400`, `401`, `403`, `404` or `422` gives `{ok: false, code: "rejected"}` (AC 3)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1654:"`

**C1655** - An answer of `429`, `500`, `502` or `503`, a rejected `fetch`, and no answer after 30 000 ms (fake timers, the
request is aborted) each give `{ok: false, code: "unavailable"}` (AC 3)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1655:"`

**C1656** - On a `4xx` and on a `5xx` the adapter logs one `console.error` line that contains neither the API key nor
any byte of the PDF's base64 (AC 3)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1656:"`

**C1657** - With the key unset, with the URL unset, and with both unset, `createRequest` and `void` return
`{ok: false, code: "not_configured"}` and `fetch` is called 0 times (AC 4)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1657:"`

**C1658** - `void("13226499")` sends `DELETE https://api.docuseal.com/submissions/13226499` with `X-Auth-Token` and returns
`{ok: true}` on `200`; `404` gives `rejected`, `500` and a rejected `fetch` give `unavailable`, and none of them throws (AC 5)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1658:"`

**C1659** - An answer missing `id`, missing the Contractor submitter, missing a submitter's `id`, or with an empty
`embed_src` gives `{ok: false, code: "unavailable"}` (AC 6)
Proof: `npx vitest run infrastructure/docuseal/docuseal.test.ts -t "C1659:"`

**C1660** - No file under `web/application` imports `@/infrastructure/docuseal`, and no file outside `web/composition` and
`web/infrastructure/docuseal` imports it (AC 1, door 1)
Proof: `npx vitest run boundaries.test.ts -t "C1660:"`

**C1661** - `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL` and `SIGNING_LINK_KEY` are read by no file outside `web/composition`,
and none is named `NEXT_PUBLIC_*` (AC 27, door 4)
Proof: `npx vitest run boundaries.test.ts -t "C1661:"`

### S2 - the database stores the request and guards every write · 6 files · 95 KB · ~24k

**C1662** - As uD, `begin_signature_request(<contract fixture>, 'Dana Admin', 'h1')` returns a uuid, and exactly one
`contract_signature_requests` row exists with `status = 'creating'`, `contract_id` the fixture and `org_id` org A, plus two
`contract_signers`: `customer` with `name = 'Pat Lee'`, `email = 'pat@customer.ca'` and `token_hash = 'h1'`, and `contractor`
with `name = 'Dana Admin'`, the email of uD in `auth.users` and `token_hash` null (AC 9, door 2)
Proof: `npm run test:db transitions` (assertions `C1662`)

**C1663** - `begin_signature_request` as uE and as uV raises `42501`; as uB, and for a random uuid, raises `P0002`; as uA
(owner) it succeeds (AC 15, AC 7)
Proof: `npm run test:db transitions` (assertions `C1663`)

**C1664** - For a contract whose status is `client_signed`, `completed`, `declined` or `voided`, `begin_signature_request`
raises `55000` with hint `not_pending` (AC 15)
Proof: `npm run test:db transitions` (assertions `C1664`)

**C1665** - For a contract whose `parties` is `{}`, `begin_signature_request` raises `55000` with hint `parties_missing`
(AC 15)
Proof: `npm run test:db transitions` (assertions `C1665`)

**C1666** - A name that is empty, only spaces, or 121 characters raises `23514` with hint `invalid_name`; a 120-character
name succeeds and is stored trimmed (AC 15, AC 8)
Proof: `npm run test:db transitions` (assertions `C1666`)

**C1667** - A second `begin_signature_request` for a contract with a `creating` request, and one for a contract with an
`open` request, each raise `55000` with hint `already_open` and leave one row (AC 14)
Proof: `npm run test:db transitions` (assertions `C1667`)

**C1668** - After every refusal of C1663 to C1667, the counts of `contract_signature_requests`, `contract_signers` and
`events` are unchanged (AC 15)
Proof: `npm run test:db transitions` (assertions `C1668`)

**C1669** - As the table owner, inserting a second `creating` or `open` request for a contract that already has one raises
`23505` on `contract_signature_requests_one_live`, and inserting one when the only other request is `failed` or `voided`
succeeds (AC 14, AC 12, door 2)
Proof: `npm run test:db transitions` (assertions `C1669`)

**C1670** - As uD, `complete_signature_request(<request fixture>, '13226499', <signers>, <sealed token>, <64 hex>)` sets the
request to `open` with `provider_submission_id = '13226499'`, `provider = 'docuseal'` and the `document_sha256`; stores each
signer's `provider_submitter_id` and `embed_sealed` and the customer's `link_sealed`; and writes exactly one `events` row
`entity_type = 'contract'`, `type = 'contract.sent_for_signature'`, `payload = {"requestId": <id>, "provider": "docuseal", "versionNo": 1}`,
`actor_id` uD, and no `outbox` row (AC 9, AC 10, doors 3 and 8)
Proof: `npm run test:db transitions` (assertions `C1670`)

**C1671** - `complete_signature_request` raises `55000` for a request that is `open` or `failed`, `22023` for a signers
document with one signer, with three signers, with an unknown role, or with an `embed_sealed` that does not match
`^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$`, `42501` as uE and uV, and `P0002` as uB; each leaves the request unchanged
(AC 9, door 3)
Proof: `npm run test:db transitions` (assertions `C1671`)

**C1672** - `fail_signature_request` turns a `creating` request into `failed`, called again it changes nothing and raises
nothing, called on an `open` request it leaves it `open`; it raises `42501` as uE and uV and `P0002` as uB; and a new
`begin_signature_request` for the contract then succeeds (AC 12, AC 13)
Proof: `npm run test:db transitions` (assertions `C1672`)

**C1673** - As uD, `insert`, `update` and `delete` on `contract_signature_requests` and on `contract_signers` each raise
`42501`; `select embed_sealed`, `select token_hash` and `select link_sealed` raise `42501`; `select id, status, name, email`
returns the org's rows; as uB the same `select` returns 0 rows of org A (AC 16, door 2)
Proof: `npm run test:db transitions` (assertions `C1673`)

**C1674** - Called as `anon` with the hash `h1` of an `open` request on a `pending_signature` contract, `signature_view`
returns an object whose `tenant.name` is the org's legal name, `agreement.number` is the agreement number, `signer.name` is
`Pat Lee`, `contractStatus` is `pending_signature`, `requestStatus` is `open` and `embedSealed` is the customer's sealed
value; for an unknown hash, for the contractor signer's (null) hash and for a hash whose request is `creating` it returns
null (AC 18, AC 21, door 3)
Proof: `npm run test:db transitions` (assertions `C1674`)

**C1675** - `signature_view` returns `embedSealed` null and the real `requestStatus` and `contractStatus` when the request is
`failed`, when it is `voided`, and when the contract is `client_signed`, `completed`, `declined` or `voided` (AC 19, AC 20)
Proof: `npm run test:db transitions` (assertions `C1675`)

**C1676** - `signature_view` changes nothing: the counts of `contract_signature_requests`, `contract_signers`, `events`
and `outbox` are the same after 3 calls (AC 22)
Proof: `npm run test:db transitions` (assertions `C1676`)

**C1677** - `contractor_signing_source` as uD on a `client_signed` contract with an `open` request returns the contractor's
`embed_sealed`; as uE and uV it raises `42501`; as uB `P0002`; on a `pending_signature` or `completed` contract
`55000` with hint `not_client_signed`; on a `client_signed` contract with no request, and on the demo's `client_signed`
contract AG-1031 after `seed.sql`, `55000` with hint `no_request` (AC 26, AC 28, AC 29)
Proof: `npm run test:db transitions` (assertions `C1677`)

**C1678** - `customer_signing_link` as uD and uA on a contract with an `open` request returns the customer's `link_sealed`;
as uE and uV it raises `42501`; as uB `P0002`; with no `open` request `55000` with hint `no_request` (AC 11)
Proof: `npm run test:db transitions` (assertions `C1678`)

**C1679** - For each of the six functions, `has_function_privilege` is false for `public`, and true for `authenticated`; it is
true for `anon` on `signature_view` only (AC 22, door 3)
Proof: `npm run test:db transitions` (assertions `C1679`)

**C1680** - `get_advisors` (security) lists the previous set plus exactly `anon_security_definer_function_executable` and
`authenticated_security_definer_function_executable` for `public.signature_view`, and no lint for the other five
functions beyond the `authenticated` one each (AC 22, door 3)
Proof: `mcp get_advisors security` on project `gnxebrtcpbujhvcamtoe`, result in the Handoff

**C1681** - `npm run test:db` passes every recipe, including `staff_screens` (its contract count stays 3) and `demo_seed`
(Impact, stored data)
Proof: `npm run test:db`

### S3 - staff send a contract for signature · 9 files · 120 KB · ~30k

**C1682** - The use case, given a `pending_signature` contract, calls in this order `reader.get`, `tokens.create`, `store.begin(contractId, name, hash)`,
`renderer.renderContract(document)`, `provider.createRequest({contractId, number, pdf, signers: [customer, contractor]})`,
`store.complete(requestId, submissionId, signers, sealedToken, sha256)`, and returns `{ok: true, link: "<base>/sign/<token>"}`;
each `embed_sealed` unseals to the provider's `embedSrc` and `link_sealed` unseals to the token (AC 9, doors 1 and 4)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1682:"`

**C1683** - `sha256` passed to `store.complete` is the lowercase hex SHA-256 of the exact bytes the renderer returned
(`[1, 2, 3]` gives `039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81`) (AC 9)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1683:"`

**C1684** - When the provider answers `rejected`, `unavailable` or `not_configured`, the use case calls `store.fail(requestId)`,
never calls `store.complete` or `provider.void`, and returns `{ok: false, code}` with that code (AC 12)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1684:"`

**C1685** - When `store.complete` fails after a successful `createRequest`, the use case calls `provider.void(submissionId)`
once and `store.fail(requestId)` once and returns `unavailable`; when that `void` also fails it still returns
`unavailable` and logs the submission id (AC 13)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1685:"`

**C1686** - When `store.begin` answers `forbidden`, `not_found`, `not_pending`, `parties_missing`, `invalid_name`,
`already_open` or `unavailable`, the use case returns that code and calls neither the renderer nor the provider (AC 14, AC 15)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1686:"`

**C1687** - When the renderer rejects, the use case calls `store.fail(requestId)`, never calls the provider and returns
`unavailable` (AC 9, AC 12)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1687:"`

**C1688** - When sealing throws (no `SIGNING_LINK_KEY`) the use case returns `unavailable` before `store.begin` is called
(AC 9, door 4)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1688:"`

**C1689** - The Supabase store maps `begin_signature_request` answers: `42501` to `forbidden`, `P0002` to `not_found`,
`55000` with hint `not_pending`, `parties_missing` or `already_open` to that code, `23514` to `invalid_name`, anything
else to `unavailable`; and its `complete` and `fail` map `55000`, `22023`, `42501`, `P0002` the same way (AC 14, AC 15)
Proof: `npx vitest run infrastructure/supabase/signing.test.ts -t "C1689:"`

**C1690** - `ContractReader.get` returns `signing: null` for a contract with no request and
`signing: {requestId, status}` of the newest request otherwise; the `Send for signature` rule reads a request as live
only when its status is `creating` or `open` (AC 7, AC 11)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C1690:"`

**C1691** - `sendForSignatureAction(contractId, name)`: a signed-out visitor is redirected to `/login`, an estimator and a
viewer get `{status: "forbidden"}` with the use case not called, a malformed id gets `{status: "not_found"}`, and an owner or
admin calls the use case once with the trimmed name (AC 7, AC 15)
Proof: `npx vitest run "app/(app)/signing-actions.test.ts" -t "C1691:"`

**C1692** - The contract page shows a `Send for signature` button for an owner and an admin when the status is
`pending_signature` and no live request exists, and shows none for an estimator, a viewer, a `creating` or `open` request,
or any other status (AC 7)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1692:"`

**C1693** - Pressing `Send for signature` shows a prompt that names `Pat Lee · pat@customer.ca`, the member's email, and a
required input labelled `Your name` with `maxLength` 120 and `required`; in its initial state the control renders no input
and calls no action (AC 8)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1693:"`

**C1694** - A refusal shows exactly one message: `rejected` `DocuSeal rejected the document.`, `unavailable`
`DocuSeal could not be reached. Try again.`, `not_configured` `E-signature is not set up for this workspace.`; a `failed`
request leaves `Send for signature` visible again (AC 12)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1694:"`

**C1695** - For an owner or admin and an `open` request the page shows the link `https://app.test/sign/<token>` and a
`Copy` button and no `Send for signature`; an estimator and a viewer see neither (AC 11)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1695:"`

**C1696** - The page unseals `customer_signing_link` and builds the link only for an owner or admin with an `open` request;
for any other state the RPC is called 0 times (AC 11)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/page.test.ts" -t "C1696:"`

### S4 - the customer signs on our page · 8 files · 70 KB · ~18k

**C1697** - `signingState({requestStatus, contractStatus})` returns `open` for `(open, pending_signature)`; `signed` for
`(open, client_signed)` and `(open, completed)`; `closed` for `(open, declined)`, `(open, voided)`, `(failed, pending_signature)`,
`(failed, client_signed)`, `(voided, pending_signature)` and `(voided, completed)` (AC 18, AC 19, AC 20)
Proof: `npx vitest run domain/contract/signing.test.ts -t "C1697:"`

**C1698** - `/sign/<token>` answers a real `404` page with the three headers for a malformed token (not 43 base64url
characters) without calling the database, and for a well-formed token whose `signature_view` answer is null (AC 21)
Proof: `npx vitest run infrastructure/supabase/signing-gate.test.ts -t "C1698:"`

**C1699** - The gate lets `/sign/<token>` through (returns null) when `signature_view` answers an object, when the call
fails or answers non-2xx, and for any non-GET method; it posts the lowercase hex SHA-256 of the token as `p_token_hash` to
`/rest/v1/rpc/signature_view` (AC 21)
Proof: `npx vitest run infrastructure/supabase/signing-gate.test.ts -t "C1699:"`

**C1700** - A signed-out `GET /sign/<token>` is not redirected to `/login`, while `/signx` and `/sign` are (AC 21, door 7)
Proof: `npx vitest run infrastructure/supabase/session.test.ts -t "C1700:"`

**C1701** - `proxy` runs the signing gate before the session refresh, and `next.config.ts` sets
`Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` for `/sign/:path*` (AC 24, door 7)
Proof: `npx vitest run next.config.test.ts -t "C1701:"` and `npx vitest run proxy.test.ts -t "C1701:"`

**C1702** - The `signature_view` adapter returns the typed view for an object, `null` for null, and `null` for an object
missing `embedSealed`, `contractStatus` or `requestStatus` (AC 18, AC 21)
Proof: `npx vitest run infrastructure/supabase/signing.test.ts -t "C1702:"`

**C1703** - `makeViewSigning(reader, tokens)` hashes the token, calls `reader.view` once, unseals `embedSealed`, and returns
`{state: "open", embedSrc, ...}`; it calls no other port and returns `{state: "unavailable"}` when unsealing throws (AC 18, AC 23)
Proof: `npx vitest run application/use-cases/signing.test.ts -t "C1703:"`

**C1704** - In the `open` state the page shows the tenant's name, the accent colour on its button text via `contrastText`,
`Contract AG-1052`, the signer's name `Pat Lee`, and a `DocusealForm` whose `src` is the unsealed `embed_src` and which has
an `onComplete` handler; it shows no `Send` or `Accept` control (AC 18)
Proof: `npx vitest run components/signing/signing.test.ts -t "C1704:"`

**C1705** - In the `signed` state the page shows `You have signed this contract.` and no form; in the `closed` state it
shows `This contract is no longer open for signature.` and no form; in the `unavailable` state it shows
`This link is not working right now.` and no form (AC 19, AC 20)
Proof: `npx vitest run components/signing/signing.test.ts -t "C1705:"`

**C1706** - The completion handler only refreshes the route: it calls `router.refresh()` once and no server action, and the
signing components import no file under `app/**/actions` (AC 23)
Proof: `npx vitest run components/signing/signing.test.ts -t "C1706:"`

**C1707** - The `/sign/[token]` page route renders the state from `viewSigning` for a token and calls `notFound()` for
`null` (AC 21)
Proof: `npx vitest run "app/sign/[token]/page.test.ts" -t "C1707:"`

**C1708** - At 375, 768 and 1440 px the page has no horizontal scroll and every control is at least 44 px tall at 375 and 768
(AC 25)
Proof: `live` Playwright run on `/sign/<token>`, result in the Handoff

### S5 - the tenant countersigns inside the app · 4 files · 40 KB · ~10k

**C1709** - For an owner and an admin the contract page embeds a `DocusealForm` with the unsealed contractor `embed_src`
when the status is `client_signed` and a request is `open` (AC 26)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1709:"`

**C1710** - A `pending_signature` contract with an `open` request shows `Waiting for the customer to sign.` and no
contractor form; a `client_signed` or `completed` contract with no request shows
`No signature request was recorded for this contract.` and no form; an estimator and a viewer see no form in any state (AC 27, AC 28)
Proof: `npx vitest run components/contracts/signing.test.ts -t "C1710:"`

**C1711** - The page calls `contractor_signing_source` only for an owner or admin on a `client_signed` contract with an
`open` request, and 0 times in every other combination of role (4) and status (5) (AC 26, AC 29)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/page.test.ts" -t "C1711:"`

**C1712** - The Supabase store maps `contractor_signing_source` and `customer_signing_link` answers: `42501` to
`forbidden`, `P0002` to `not_found`, `55000` with hint `not_client_signed` or `no_request` to that code, anything else to
`unavailable` (AC 29)
Proof: `npx vitest run infrastructure/supabase/signing.test.ts -t "C1712:"`

### S6 - the PDF carries the tags and the app is wired · 6 files · 55 KB · ~14k

**C1713** - The contract PDF text holds, with whitespace and line-break hyphens removed, the tags `{{Sig;role=Customer;type=signature}}`,
`{{Date;role=Customer;type=date}}`, `{{Sig;role=Contractor;type=signature}}` and `{{Date;role=Contractor;type=date}}`, each
once, the Customer pair after the heading `For the Customer: Pat Lee` and before the Contractor pair (AC 17, door 5)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1713:"`

**C1714** - The signature blocks stay on one page together with their tags: with 40 clauses the last page holds all four
tags and both headings (AC 17)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1714:"`

**C1715** - Every assertion of `contract-pdf.test.ts` and `composition/contract-pdf.test.ts` that existed before this
feature (C1597 to C1651 and earlier) is unchanged in the diff and passes (AC 17)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts composition/contract-pdf.test.ts -t "C16"`

**C1716** - `@docuseal/react` is imported only by files under `web/components/signing`, and its version in `package.json`
is the exact string `1.0.76` (door 6)
Proof: `npx vitest run boundaries.test.ts -t "C1716:"`

**C1717** - `getContainer()` returns `sendForSignature` wired to the DocuSeal adapter with `DOCUSEAL_API_KEY` and
`DOCUSEAL_API_URL`, and to sealing with `SIGNING_LINK_KEY`; with the first two unset the use case returns `not_configured`
and with the key unset `unavailable`, and a value sealed with `PORTAL_LINK_KEY` does not unseal with `SIGNING_LINK_KEY` (AC 4, AC 27, door 4)
Proof: `npx vitest run composition/signing.test.ts -t "C1717:"`

**C1718** - Sent through DocuSeal with the owner's key, the real contract PDF of the demo's AG-1035 produces a submission with
two `signature` fields and two `date` fields (one pair per role), and the downloaded document carries no `{{` text
(`remove_tags`) (AC 2, AC 17, door 5)
Proof: `live` Playwright and `curl` run against `https://api.docuseal.com` with the submission archived afterwards, result in the Handoff

**C1719** - Live, as the owner in one signed-in context: `Send for signature` on the demo's contract shows the confirm step,
the link appears after sending, the link opened in a private window renders the embedded DocuSeal form, and DocuSeal shows
the request with the customer signer first, at 375, 768 and 1440 px with touch (AC 7, AC 8, AC 11, AC 18)
Proof: `live` Playwright run, result in the Handoff

**C1720** - `npm test`, `npm run lint` and `npx tsc --noEmit` pass in `web/` after `database.types.ts` is regenerated
(AC 1, Impact)
Proof: `npm test`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `begin_signature_request` outcomes (8) | success C1662 · `P0002` C1663 · `42501` C1663 · `not_pending` C1664 · `parties_missing` C1665 · `invalid_name` C1666 · `already_open` C1667 · nothing written C1668 | - |
| `complete_signature_request` outcomes (5) | success C1670 · `55000` C1671 · `22023` C1671 · `42501` C1671 · `P0002` C1671 | - |
| `fail_signature_request` outcomes (4) | `creating` to `failed` C1672 · repeat no-op C1672 · `42501` C1672 · `P0002` C1672 | - |
| `signature_view` outcomes (3) | object C1674 · null for an unknown hash, the contractor hash and a `creating` request C1674 · embed withheld in a closed state C1675 | - |
| `contractor_signing_source` outcomes (5) | success C1677 · `42501` C1677 · `P0002` C1677 · `not_client_signed` C1677 · `no_request` C1677 | - |
| `customer_signing_link` outcomes (4) | success C1678 · `42501` C1678 · `P0002` C1678 · `no_request` C1678 | - |
| `GET /sign/[token]` statuses (5) | `200` open C1704 · `200` signed C1705 · `200` closed C1705 · `404` malformed C1698 · `404` unknown C1698 | - |
| DocuSeal `POST /submissions/pdf` outcomes (6) | `2xx` C1653 · `4xx` C1654 · `429` C1655 · `5xx` C1655 · network error C1655 · timeout C1655 | - |
| DocuSeal `DELETE /submissions/{id}` outcomes (4) | `200` C1658 · `404` C1658 · `5xx` C1658 · network error C1658 | - |
| contract statuses that block `begin_signature_request` (4) | `client_signed` C1664 · `completed` C1664 · `declined` C1664 · `voided` C1664 | - |
| request statuses (4) | `creating` C1662 · `open` C1670 · `failed` C1672 · `voided` C1675 | - |
| roles on `begin_signature_request` (4) | owner C1663 · admin C1662 · estimator C1663 · viewer C1663 | - |
| `signingState` combinations (8) | table-driven over all 8 C1697 | - |
| refusal messages on the send prompt (3) | `rejected` C1694 · `unavailable` C1694 · `not_configured` C1694 | - |
| contract page signing area states (5) | send button C1692 · open link C1695 · countersign embed C1709 · waiting C1710 · no request C1710 | - |
| roles by contract status for `contractor_signing_source` calls (20) | table-driven over all 20 (4 roles x 5 statuses) C1711 | - |
| the eight `Landing` doors (8) | door 1 C1652 · door 2 C1673 · door 3 C1679 · door 4 C1717 · door 5 C1713 · door 6 C1716 · door 7 C1701 · door 8 C1670 | - |
| `Relations` entities (3) | `contract_signature_requests` C1669 · `contract_signers` C1662 · `events` C1670 | - |
| the three signing headers (3) | `Cache-Control` C1701 · `Referrer-Policy` C1701 · `X-Robots-Tag` C1701 | - |
| startup config, environment names (3) | `DOCUSEAL_API_KEY` C1717 · `DOCUSEAL_API_URL` C1717 · `SIGNING_LINK_KEY` C1717 | - |
| startup config, places that wire the signing container (1) | `getContainer` C1717 | - |
| PDF tags (4) | customer signature C1713 · customer date C1713 · contractor signature C1713 · contractor date C1713 | - |

- Claims naming a status code, route or response shape: C1654, C1655, C1663 to C1667, C1671, C1674, C1677, C1678, C1698
and C1699, each of which has a proof that crosses the boundary (the database, or the gate's `Response`)
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the RPCs, the DocuSeal adapter, the gate) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (`signingState`, the use cases) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (the Server Action, the page route) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs (the container wiring, the supabase view adapter) | none of its own | covered by its consumer's proof |

Evidence:

- `signature_view` and the guards of `begin_signature_request`: nine and eleven branch points -> decide; the closest
  analogue is `portal_decide`, proven at the boundary (`customer_portal.sql`) and in its adapter
- `docuseal.ts`: maps six answer classes and a malformed body to three codes -> decides; closest analogue
  `infrastructure/email` (Resend), proven with a fake `fetch` over each status class
- `signingState`: 8 combinations -> decides; closest analogue `portalState` in `domain/portal`, proven table-driven
- `signing-gate.ts`: 4 outcomes -> decides; closest analogue `portal-gate.ts`, proven in `portal-gate.test.ts`

Cost: 31 proofs at their own layer across 10 files. Without these rows, 6 decision tables are proven only by a path that
happens to traverse them.

## Swept

- validation: C1666, C1688, C1693
- failure modes: C1684, C1685, C1687
- idempotency: C1667, C1669, C1672
- authorization: C1663, C1673, C1679, C1691
- concurrency: C1669
- data lifecycle: n/a - nothing here expires or deletes; a `failed` request stays as the record and request expiry is out of scope
- dependency failure: C1655, C1685, C1659
- state transitions: C1664, C1672, C1697
- observability: C1656, C1685

## Out of scope

- The plan's `Out of scope` table stands: webhook and status moves, signed PDF and audit log (item 3); W2, W4 and emailing
  the link (item 4); decline, void, regenerate and cancelling a request; expiry and reminders; other countersigners;
  SMS, 2FA, DocuSeal templates; self-hosted DocuSeal and the EU region; a Contracts list; tenant logo on the PDF.
- The two-session race behind AC 14 is proven structurally (C1669: the unique index, and C1667: the guard after the lock),
  not with two sessions, as for AC 8 of contract-generation.

## Handoff

Size, with the arithmetic (`wc -c` of the files each slice touches, divided by four; budget 150k from `AGENTS..md`):

- S1: 4 new files, ~30 KB written, none touched -> ~8k
- S2: `fixture.sql` 18 KB read, `runner.mts` 5 KB, `customer_portal.sql` 57 KB skimmed for the pattern, new migration ~14 KB and
  `signing.sql` ~35 KB written; `database.types.ts` (43 KB) is regenerated by `generate_typescript_types`, not read -> ~30k
- S3: `ports/index.ts` 41 KB, `use-cases/index.ts` 3 KB, `contracts.ts` 3 KB, `contract-view.tsx` 6 KB, `page.tsx` + `page.test.ts` 4 KB,
  `composition/index.ts` 11 KB read; about 40 KB of new use case, adapter, action, component and tests -> ~28k
- S4: `portal-gate.ts` + test 7 KB, `session.ts` 3 KB, `proxy.test.ts` 2 KB, `next.config.ts` 1 KB, `review-view.tsx` 9 KB for the pattern;
  about 30 KB new (domain, gate, view use case, page, components, tests) -> ~16k
- S5: reuses S3's component and page; about 12 KB new tests -> ~6k
- S6: `contract-pdf.tsx` 3 KB + its test 8 KB, `boundaries.test.ts` 10 KB, `composition.test.ts` 22 KB skimmed, `eslint.config.mjs` 5 KB,
  `.env.example`, plus `CONTEXT.md` and STATE entries -> ~16k
- Total ~104k, under the 150k budget -> one builder, no ask. Batches follow the slices: S1, S2, S3, S4 and S5, S6.
- Mechanism: one builder (the orchestrator builds; a fresh Verifier is dispatched after the last commit)
- Commits carry no attribution trailer, as `build.md` says.

### Batch S1: C1652-C1660

- **Boundary:** C1652-C1660 closed at `8d4ed02` (C1661 waits for S6, when `composition` reads the three names)
- **Settled mid-build:** none
- **Abandoned:** none

### Batch S2: C1662-C1680

- **Boundary:** C1662-C1680 closed in the commit after `8d4ed02`; migration `20261106154448_signature_provider` applied to `gnxebrtcpbujhvcamtoe` with the owner's go-ahead (2026-11-06)
- **Settled mid-build:** the SQL proofs run as `npm run test:db transitions`, not a new `signing` recipe, because `runner.test.ts` pins 23 recipes and 25 files (C830, C1045); `rls_isolation.sql` C35 lists the public tables, so it now names the two new ones (23); `demo_seed.sql` carries the demo half of C1677 and clears the JWT claim after `act_as`, which the seed's frozen-line triggers need; plan door 9 (`contracts unique (id, org_id)`) and the new hints `parties_missing` for a signer-less `parties` and `not_creating` were added to the plan before the code. C1680 measured: `anon` lints 5 -> 6 (`signature_view`), `authenticated` 19 -> 25 (the six functions), nothing else changed
- **Abandoned:** a `signing` recipe with its own file

### Batch S3: C1682-C1696

- **Boundary:** C1682-C1696 closed in the commit after `bb4ee2d`; C1709-C1712 (S5) closed with them, because the countersign area and the secret readers are the same component and page
- **Settled mid-build:** `ContractDetail.signing` is optional in the type, as `contract` and `signer` were, so the four older fixtures compile; `linkBase` moved from `agreement-actions.ts` to `app/(app)/link-base.ts` so the signing action shares it; the composition keeps the original `agreementReader` and `contractReader` lines because C745 and C1648 pin that source text, so the document loader builds its own two stateless readers; the use case reads `documents.load` where C1682 says `reader.get`, the loader being `makeContractDocuments(reader, agreementReader, settings)`; `@docuseal/react` is matched by the existing `react` lint pattern in every layer that forbids React, so C1716 asserts an error there and the naming message only in the UI places; ESLint now also forbids the DocuSeal adapter from `domain`
- **Abandoned:** returning the link from the action (the page re-reads it from the sealed token)
