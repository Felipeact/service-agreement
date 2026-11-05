# Contract generation - checks

Profile: light
Plan: `.specs/features/contract-generation/plan.md`

55 checks in 5 slices · 6 one-way doors · 1 open, 0 block (1 blocks go-live)

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1597:`). This feature numbers
  from C1597, because global-search owns up to `C1596`.
  - Pure domain code (`parseContractParties`, `contractClauses`, `buildContractDocument`, the contract status labels) is
    tested with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient` of `agreements.test.ts`.
  - Components are asserted with `renderToStaticMarkup`. The repo has no DOM test library, so a stateful control is
    proven by rendering the control itself in its initial state (extract.test.ts, L-014) and its prompt in each state.
  - PDFs are read with `pdf-text.testing.ts` (AD-066). A route proven against the real renderer lives in
    `composition/` only (AD-111).
- **test:db** means `npm run test:db <recipe>` in `web/` (AD-026). It runs against project `gnxebrtcpbujhvcamtoe` and is
  rolled back, so it passes only once the migration is applied there.
  - The `create_contract` and `contract_signer` assertions go into `transitions.sql`, beside `apply_contract_transition`.
    The moved viewer assertion goes into `rls_roles.sql`. The demo backfill goes into `demo_seed.sql`. No new recipe, so
    the runner's pinned recipe counts do not move. Each assertion is labelled with its check id.
  - SQL tests that name a hint use `tests.expect_hint(label, sql, state, hint)`, added to `fixture.sql`, because
    `tests.expect_error` compares the SQLSTATE only (L-025, L-030).
- **mcp** means a Supabase MCP `execute_sql` or `get_advisors` call on project `gnxebrtcpbujhvcamtoe`. The query and its
  result go in the Handoff.
- **live** means an author-side Playwright run in one signed-in context (playwright-single-context), recorded in the
  Handoff, at 375, 768 and 1440 px with touch.

Terms:
- "the accepted fixture `<name>`" is `tests.rn_agreement('<name>')` (accepted agreement of org A on its own site, version 1
  from 2027-01-01 for 12 months, frozen terms, one site contact with the email `pat@customer.ca`), with org A's settings
  set to address `1 Main St`, phone `604-555-0100`, and the site's address set to `2 Dock Rd`. It is created as the table
  owner with no signed-in user.
- "the roles" are uA (owner), uD (admin), uE (estimator) and uV (viewer) of org A, uB (owner of org B).
- "the document" is the `ContractDocument` that `buildContractDocument` returns.
- "the contract fixture" for the UI checks is a `ContractView` for `AG-1052`, version 1, `pending_signature`, with
  parties: contractor `Kettle Ridge Mechanical Ltd.` (`100 Sample Street, Burnaby, BC`, `604-555-0100`), customer
  `Fernwood Dental`, site `Fernwood Dental, Main` (`12 Oak Ave`), signer `Pat Lee` `pat@example.com`.

## Checks

### S1 - the database writes one contract and freezes its parties · 7 files · 105 KB · ~26k

**C1597** - As uE, `create_contract(<accepted fixture with versions 1 and 2>)` returns a uuid. Exactly one `contracts`
row exists for the agreement. Its `agreement_version_id` is version 2, the highest, its `status` is
`pending_signature` and its `org_id` is org A (AC 3, door 2)
Proof: `npm run test:db transitions` (assertions `C1597`)

**C1598** - For the accepted fixture whose site has an approver `Avery` (`avery@customer.ca`) and a site contact `Pat`
(`pat@customer.ca`), the new contract's `parties` equals the literal
`{"schema": 1, "contractor": {"legalName": "Legal A", "address": "1 Main St", "phone": "604-555-0100"}, "customer": {"name": "Customer A"}, "site": {"name": "<site name>", "address": "2 Dock Rd"}, "signer": {"name": "Avery", "email": "avery@customer.ca"}}`.
When the settings have no address and no phone, and the site has no address, those three keys are present and `null`
(AC 4, door 1)
Proof: `npm run test:db transitions` (assertions `C1598`)

**C1599** - The signer is picked as follows, and `parties.signer` carries the picked contact's own name:
- approver with an email, site contact with an email: the approver
- approver with a null email, site contact `pat@customer.ca`: the site contact
- approver with the email `'   '`, site contact `pat@customer.ca`: the site contact
- no approver, site contact `pat@customer.ca`: the site contact
- approver `avery@customer.ca`, no site contact: the approver

(AC 4, door 5)
Proof: `npm run test:db transitions` (assertions `C1599`)

**C1600** - `private.customer_recipient(<site>)` still returns the trimmed email of the same contact the signer rule picks:
`'  avery@customer.ca '` returns `avery@customer.ca`; a site with neither contact email returns null; an approver with a
blank email falls back to the site contact's email. W1, W7 and the reminder keep their recipient (AC 4, door 5)
Proof: `npm run test:db transitions` (assertions `C1600`)

**C1601** - A successful `create_contract` writes exactly one `events` row with `entity_type` `contract`, `entity_id` the
contract id, `type` `contract.pending_signature`, payload `{"from": null, "to": "pending_signature", "versionNo": 2}` and
`actor_id` uE. It writes no `outbox` row: the org's outbox count is unchanged (AC 5, door 3)
Proof: `npm run test:db transitions` (assertions `C1601`)

**C1602** - After `create_contract`, setting org A's `legal_name`, `address` and `phone`, the customer's `name`, the site's
`name` and `address`, and the signer contact's `name` and `email` to other values leaves the contract's `parties`
equal to what it was (AC 6)
Proof: `npm run test:db transitions` (assertions `C1602`)

**C1603** - A second `create_contract` for the same agreement returns the first call's id. The count of `contracts` for the
agreement stays 1 and the count of `contract.pending_signature` events stays 1. A call made after the first contract
was moved to `client_signed` returns the same id and leaves its status `client_signed` (AC 7)
Proof: `npm run test:db transitions` (assertions `C1603`)

**C1604** - `create_contract` takes the agreement row `for update` before it reads the version's contract: in
`pg_get_functiondef` the first `for update` comes before the first `from public.contracts`. A unique index on
`contracts (agreement_version_id)` exists, and a direct insert of a second contract for the same version, made as the
table owner, fails with `23505` (AC 8). This is a structural proof at the database's own level; a two-session race
cannot run inside the rolled-back recipe, and the Handoff records that gap
Proof: `npm run test:db transitions` (assertions `C1604`)

**C1605** - For each agreement status other than `accepted` (`draft`, `sent`, `refused`, `changes_requested`, `expired`,
`withdrawn`), `create_contract` fails with `55000` and the hint `not_accepted`, and the counts of `contracts` and of
`events` are unchanged (AC 10)
Proof: `npm run test:db transitions` (assertions `C1605`)

**C1606** - An accepted agreement with an `agreement.renewed` event fails with `55000` and the hint `auto_renewal`, and writes
no contract and no event. An accepted agreement whose events are `agreement.renewal_drafted`, `agreement.sent` and
`agreement.accepted` (a renegotiated renewal the customer accepted) and no `agreement.renewed` succeeds (AC 11)
Proof: `npm run test:db transitions` (assertions `C1606`)

**C1607** - An accepted agreement on a site whose `deactivated_at` is set fails with `55000` and the hint `site_inactive`,
and writes nothing (AC 12)
Proof: `npm run test:db transitions` (assertions `C1607`)

**C1608** - An accepted agreement whose highest version has a null `term_start` fails with `55000` and the hint
`no_term_start`, and writes nothing. When version 1 has a `term_start` and the highest version 2 has none, it still
fails, so the highest version is the one read (AC 13)
Proof: `npm run test:db transitions` (assertions `C1608`)

**C1609** - `create_contract` fails with `55000` and the hint `no_signer`, writing nothing, when the site has:
- no approver and no site contact
- a site contact whose email is null
- a site contact and an approver whose emails are both `'  '`

(AC 14)
Proof: `npm run test:db transitions` (assertions `C1609`)

**C1610** - uA (owner) and uD (admin) can `create_contract` on an accepted org A agreement. uV (viewer) fails with `42501`.
uB (owner of org B) on the org A agreement fails with `P0002`, as does an unknown uuid. `anon` fails with `42501`. Every
failure writes nothing (AC 15)
Proof: `npm run test:db transitions` (assertions `C1610`)

**C1611** - When two refusals apply at once, the earlier hint in the order `not_accepted`, `auto_renewal`, `site_inactive`,
`no_term_start`, `no_signer` is the one raised:
- a `draft` agreement on an inactive site: `not_accepted`
- an accepted agreement with an `agreement.renewed` event on an inactive site: `auto_renewal`
- an accepted agreement on an inactive site with no `term_start`: `site_inactive`
- an accepted agreement with no `term_start` and no signer: `no_term_start`

(door 2)
Proof: `npm run test:db transitions` (assertions `C1611`)

**C1612** - As uA, directly through the table: `insert into contracts` fails with `42501`; `delete from contracts` fails with
`42501`; `update contracts set parties = '{}'`, `set org_id = org_id` and `set agreement_version_id = agreement_version_id`
each fail with `42501`; `update contracts set status = 'client_signed'` where it is `pending_signature` succeeds on 1 row.
As uE, `insert into contracts` fails with `42501` (AC 16, door 2)
Proof: `npm run test:db transitions` (assertions `C1612`)

**C1613** - As uV, `update public.contracts set org_id = org_id where org_id = <org A>` and `delete from public.contracts
where org_id = <org A>` each fail with `42501`, in the loop of `rls_roles.sql` C12 that already expects `42501` for
customers, sites and assets. `rls_roles.sql` C10 (a viewer reads org A's contracts) and C11 (a viewer's insert fails
with `42501`) stay as they are (AC 16, Impact)
Proof: `npm run test:db rls_roles` (assertions `C12 update contracts`, `C12 delete contracts`)

**C1614** - `contracts.parties` is `not null` and has the default `{}`: a contract inserted with two columns, as the owner,
reads back `{}`. A null is refused with `23502`. `'[]'`, `'"x"'` and `'1'` are refused with `23514`. `{}` and
`{"schema": 1}` are accepted (door 1)
Proof: `npm run test:db domain_constraints` (assertions `C1614`)

**C1615** - `create_contract(uuid)` and `contract_signer(uuid)` are `security definer` with `search_path` set to the empty
string and are executable by `authenticated` and not by `anon` or `public`. `private.customer_signer(uuid)` and
`private.customer_recipient(uuid)` are executable by none of `anon`, `authenticated` and `public` (doors 2, 5, 6)
Proof: `npm run test:db transitions` (assertions `C1615`)

**C1616** - As uE, `contract_signer(<org A site>)` returns `{"name": "Pat", "email": "pat@customer.ca"}` for the site contact of
the accepted fixture. It returns null for an org B site, and null for an org A site with no contact that has an email.
As `anon` it fails with `42501` (door 6, AC 2)
Proof: `npm run test:db transitions` (assertions `C1616`)

**C1617** - On a database where `seed.sql` ran, none of the 3 demo contracts has `parties = '{}'`: each has `schema` 1,
`contractor.legalName` equal to the demo org's legal name, and `customer.name` and `site.name` equal to those of its
agreement's site. After the seed runs a second time, a demo contract whose `parties` was set to `{}` is filled again and
one whose `parties` was set to `{"schema": 1, "marker": true}` keeps it (Impact, stored data)
Proof: `npm run test:db demo_seed` (assertions `C1617`)

**C1618** - A site deactivation (`set_site_active(<site>, false)`) is refused with `55000` and the hint `in_term` while the
site's contract is `pending_signature`, even when the accepted agreement's `term_end` is in the past (Impact, domain)
Proof: `npm run test:db transitions` (assertions `C1618`)

### S2 - staff generate the contract from the agreement page · 9 files · 140 KB · ~34k

**C1619** - `ContractStore.create(agreementId)` calls `rpc create_contract` with `{ p_agreement_id }` and maps each outcome:
- success returns `{ ok: true, id }`
- `55000` with hint `not_accepted`, `auto_renewal`, `site_inactive`, `no_term_start`, `no_signer` return
  `{ ok: false, code: <that hint> }`
- `42501` returns `forbidden`, `P0002` returns `not_found`
- `55000` with an unknown hint, and any other error, return `unavailable` and log once

(AC 3, AC 15, AC 17)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C1619:"`

**C1620** - The contract messages are exactly: `not_accepted` "Only an accepted agreement can become a contract.";
`auto_renewal` "This agreement was renewed automatically, so there is nothing to sign."; `site_inactive` "This site is
inactive."; `no_term_start` "This agreement has no term start date, so it cannot become a contract."; `no_signer` "Add
an email to the site's approver or site contact, then try again."; `forbidden`, `not_found` and `unavailable` have their
own non-empty text; `idle` has none (AC 17)
Proof: `npx vitest run components/agreements/contract-state.test.ts -t "C1620:"`

**C1621** - `generateContractAction(agreementId)` returns `{ status: "forbidden" }` for a viewer and never calls the store.
It returns `{ status: "not_found" }` for `"not-a-uuid"` and never calls the store. For a writer, a store result `ok` with
id `X` redirects to `/contracts/X`. Each store refusal code is returned as the action's `status` with the same word.
Signed out goes to `/login` (AC 3, AC 15, AC 17)
Proof: `npx vitest run "app/(app)/contract-actions.test.ts" -t "C1621:"`

**C1622** - `AgreementReader.get` returns `contract: { id, status }` for an agreement whose latest version has a contract, and
`contract: null` when it has none. It calls `rpc contract_signer` with the site id only for an `accepted` agreement with
no contract: not for `draft`, `sent`, `refused`, `changes_requested`, `expired`, `withdrawn`, and not for an accepted one
that has a contract. It returns the rpc's `{ name, email }` as `signer`, and `signer: null` when the rpc returns null
(AC 1, AC 2, AC 9, door 6)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1622:"`

**C1623** - `AgreementView` shows a `Generate contract` control only for an `accepted` agreement with `contract: null` and a role of
`owner`, `admin` or `estimator`. It shows none for a `viewer`, none for an accepted agreement that has a contract, and
none for each of the six other statuses (AC 1, AC 9)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1623:"`

**C1624** - For an accepted agreement with a contract, `AgreementView` shows a `Contract` line whose link `href` is exactly
`/contracts/<contract id>` and whose label is `Pending signature`, `Client signed`, `Completed`, `Declined` or `Voided`
for the matching status, to every role including `viewer` (AC 9)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1624:"`

**C1625** - The generate prompt, not confirming, renders one `Generate contract` button and no `<form` and no submit button. Confirming,
it renders the signer as `Pat Lee · pat@example.com`, the term line `Jan 1, 2027 – Dec 31, 2027 · 12 months`, `Total per
year $1,800.00`, a submit button `Generate contract` and a `Cancel` button. With `signer: null` it renders `No signer
with an email yet.` in place of the signer. The stateful `GenerateContractControl`, rendered in its initial state, shows
the not-confirming markup (AC 2, L-014)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1625:"`

**C1626** - Each refusal state of the generate prompt renders its C1620 message in an element with `role="alert"`, and the
`idle` state renders no alert (AC 17)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1626:"`

**C1627** - The agreement page route passes a bound `generate` action to `AgreementView` for owner, admin and estimator, and none
for a viewer (AC 1)
Proof: `npx vitest run "app/(app)/agreements/[agreementId]/page.test.ts" -t "C1627:"`

### S3 - staff open the contract · 8 files · 70 KB · ~17k

**C1628** - `parseContractParties` returns the typed parties for a schema 1 object, with every missing optional key as `null`. It
returns `null` for `{}`, for `{"schema": 2}`, for an array, for a string, and for a schema 1 object with no
`contractor.legalName` (AC 21, door 1)
Proof: `npx vitest run domain/contract/parties.test.ts -t "C1628:"`

**C1629** - `ContractReader.get(id)` returns `{ id, status, agreementId, versionNo, number, createdAt, parties }` for a contract of
the member's org, with `parties` parsed by C1628's rule (`null` for a stored `{}`). It returns `null` for a malformed
id, for no row, and for a row the member cannot see (AC 18, AC 21, AC 22)
Proof: `npx vitest run infrastructure/supabase/contracts.test.ts -t "C1629:"`

**C1630** - `ContractView` renders for the contract fixture: the heading `Contract · AG-1052`; the signer `Pat Lee` and
`pat@example.com`; the customer `Fernwood Dental` as a link to `/customers/<customer id>` and the site as a link to
`/sites/<site id>`; the term line; `Total per year $1,800.00` and `Before tax`; a link to `/agreements/<agreement id>`; and
a `Download PDF` anchor whose `href` is exactly `/contracts/<contract id>/pdf` (AC 18, door 4)
Proof: `npx vitest run components/contracts/contracts.test.ts -t "C1630:"`

**C1631** - The status pill of `ContractView` reads `Pending signature`, `Client signed`, `Completed`, `Declined` and `Voided` for
`pending_signature`, `client_signed`, `completed`, `declined` and `voided`, with the tone attribute on the pill element
itself (AC 18, L-011)
Proof: `npx vitest run components/contracts/contracts.test.ts -t "C1631:"`

**C1632** - `ContractView` lists each service line of the accepted version with its description, its months and its annual amount
(`Quarterly visit`, `Mar, Jun, Sep, Dec`, `$1,800.00`), a `Visit schedule` with one row per visited month, and the frozen terms
that are set; a term that is null is not listed (AC 19)
Proof: `npx vitest run components/contracts/contracts.test.ts -t "C1632:"`

**C1633** - For each role, including `viewer`, `ContractView` renders and contains no `<form` and no `<button` (AC 20)
Proof: `npx vitest run components/contracts/contracts.test.ts -t "C1633:"`

**C1634** - With `parties: null`, `ContractView` renders `Parties not recorded for this contract.`, renders no signer and no `Download PDF`
anchor, and still renders the heading and status (AC 21)
Proof: `npx vitest run components/contracts/contracts.test.ts -t "C1634:"`

**C1635** - The contract page route answers `404` through `notFound()` for a malformed id and for a reader that returns `null`
(one and the other do not reach the agreement reader), redirects to `/login` when signed out, and reads the agreement at
the contract's own version: `agreementReader.get(<agreementId>, <versionNo>)` (AC 22)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/page.test.ts" -t "C1635:"`

### S4 - the contract PDF · 8 files · 75 KB · ~19k

**C1636** - `GET /contracts/[contractId]/pdf` answers `200` with `Content-Type: application/pdf`, `Cache-Control: private,
no-store`, the renderer's bytes untouched, and `Content-Disposition: attachment; filename="AG-1052-contract.pdf"`, for each of
the four roles (AC 24, door 4)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/pdf/route.test.ts" -t "C1636:"`

**C1637** - The pdf route answers an empty `404` and renders nothing for a malformed id, for a reader that returns `null`, and for a
contract whose `parties` is `null`. Signed out answers `307` to `/login` and reads nothing (AC 21, AC 25)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/pdf/route.test.ts" -t "C1637:"`

**C1638** - The pdf route answers an empty `503`, logs once and sends no PDF when the renderer rejects, when the settings read rejects,
and when the org has no settings row. A reader that rejects is not caught (AC 25)
Proof: `npx vitest run "app/(app)/contracts/[contractId]/pdf/route.test.ts" -t "C1638:"`

**C1639** - `contractClauses(terms, termMonths)` returns these sentences, one per term, in this order, and none for a term that is null:
- payment 30: `Invoices are payable within 30 days.`; payment 1: `Invoices are payable within 1 day.`
- cancellation 60: `Either party may cancel this contract with 60 days' written notice.`
- repair discount 10: `Repair work is discounted by 10%.`; 0 prints `Repair work is discounted by 0%.`
- CPI cap 3: `The annual price may rise with CPI, capped at 3%.`
- governing province `BC`: `This contract is governed by the laws of British Columbia.`; each of the 13 codes in `PROVINCES` prints its name; `XX` prints `XX`
- renewal notice 30, threshold 5, term 12: `This contract renews for successive 12 months terms unless CPI is at or above 5%, when the parties renegotiate; the customer is notified 30 days before the end date.`; with either renewal value null, no renewal clause

(AC 28)
Proof: `npx vitest run domain/contract/document.test.ts -t "C1639:"`

**C1640** - `buildContractDocument(source, parties, accent)` takes the contractor name, address and phone, the customer, the site and the signer
from `parties` only: with `source.customer.name` `Other` and `parties.customer.name` `Fernwood Dental`, the document says
`Fernwood Dental`. Its terms come from `source.terms` only, so a `source` with `terms: null` yields no clauses. The document
carries `mark: null` for an accepted agreement (AC 30, AC 31)
Proof: `npx vitest run domain/contract/document.test.ts -t "C1640:"`

**C1641** - The rendered PDF has Letter-size pages, the title `Service Contract`, the agreement number `AG-1052`, the contractor's name,
address and phone, the customer, the site with its address, and the signer's name and email (AC 26)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1641:"`

**C1642** - The PDF text contains, in this order: the term line, the service lines, `Total per year`, `before tax`, the tax note, `Visit
schedule`, `Service included`, `Equipment`, the clauses and the signature blocks (AC 27)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1642:"`

**C1643** - For frozen terms with every term set, the PDF text contains each C1639 sentence once; for terms with payment, cancellation,
governing province and the renewal values null, it contains none of those four sentences (AC 28)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1643:"`

**C1644** - The last page of a PDF long enough for three pages holds both `For the Customer: Pat Lee` and `For Kettle Ridge Mechanical Ltd.`,
and each is followed by a `Signature` line and a `Date` line on that same page (AC 29)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1644:"`

**C1645** - Every page of a three-page PDF carries `Page x of 3` with its own number and `AG-1052`, and the text contains no `DRAFT` (AC 30)
Proof: `npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C1645:"`

**C1646** - Through the real route and the real renderer, a contract returns bytes that start with `%PDF-`, whose text holds `Service
Contract`, the signer and every C1639 clause, and whose filename is `AG-1052-contract.pdf` (AC 24, AC 26, AC 28)
Proof: `npx vitest run composition/contract-pdf.test.ts -t "C1646:"`

**C1647** - `ContractRenderer` in the ports file has exactly the body `renderContract(document: ContractDocument): Promise<Uint8Array>;`,
`DocumentRenderer` keeps the body C874 pins, and `domain/contract/document.ts` imports neither `react` nor `@react-pdf` (door 4)
Proof: `npx vitest run boundaries.test.ts -t "C1647:"`

**C1648** - `getContainer()` exposes `contractReader`, `contractStore` and `contractRenderer`, built from the member's client and the
document adapter, and `generateContract` reaches no other store (Impact, application)
Proof: `npx vitest run composition/composition.test.ts -t "C1648:"`

### S5 - the whole system · 6 files · 0 KB new · ~8k

**C1649** - After the migration, `get_advisors` (security) lists `authenticated_security_definer_function_executable` for
`public.create_contract` and `public.contract_signer`, lists no `anon_security_definer_function_executable` for them, and
shows no other finding that the baseline recorded before the migration did not have (door 2, door 6)
Proof: mcp `get_advisors` (before and after, recorded in the Handoff)

**C1650** - At 375, 768 and 1440 px, with touch emulation, signed in as the demo owner: the accepted AG-1035 shows `Generate
contract`; its first press shows the confirm step and creates nothing (`select count(*) from contracts` unchanged); confirming
lands on `/contracts/<id>` showing `Pending signature`; the agreement page then shows the `Contract` line and no button; `Download
PDF` returns a PDF; no page scrolls horizontally, every control is at least 44 px tall on 375 and 768, the console has no
error and no request fails. The run's contract is deleted by the owner's SQL afterwards, with the owner's go-ahead
(AC 1, AC 2, AC 3, AC 9, AC 23)
Proof: live (recorded in the Handoff)

**C1651** - Against the baseline `f80ad4d`, the web suite and every SQL recipe still pass: `npm test` ends with 0 failed, `npx tsc
--noEmit` and `npm run lint` exit 0, and `npm run test:db` ends `23 passed, 0 failed` (Impact)
Proof: `npm test`
Proof: `npx tsc --noEmit`
Proof: `npm run lint`
Proof: `npm run test:db`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `rpc create_contract` outcomes (8) | 200 C1597 · `P0002` C1610 · `42501` C1610 · `55000` `not_accepted` C1605 · `auto_renewal` C1606 · `site_inactive` C1607 · `no_term_start` C1608 · `no_signer` C1609 | - |
| `rpc contract_signer` outcomes (4) | signer C1616 · null other org C1616 · null no email C1616 · `42501` anon C1616 | - |
| non-accepted agreement statuses (6) | `draft` C1605 · `sent` C1605 · `refused` C1605 · `changes_requested` C1605 · `expired` C1605 · `withdrawn` C1605, table-driven over all 6 | - |
| refusal order pairs (4) | draft+inactive C1611 · renewed+inactive C1611 · inactive+no start C1611 · no start+no signer C1611 | - |
| signer picks (5) | both emails C1599 · approver null email C1599 · approver blank email C1599 · no approver C1599 · no site contact C1599 | - |
| member roles at `create_contract` (5) | owner C1610 · admin C1610 · estimator C1597 · viewer C1610 · other org owner C1610 | - |
| member roles at the Generate control (4) | owner C1623 · admin C1623 · estimator C1623 · viewer C1623 | - |
| direct table writes on `contracts` (6) | insert C1612 · delete C1612 · update `parties` C1612 · update `org_id` C1612 · update `agreement_version_id` C1612 · update `status` allowed C1612 | - |
| `parties` column bounds (6) | default `{}` C1614 · null C1614 · `[]` C1614 · `"x"` C1614 · `1` C1614 · object accepted C1614 | - |
| `ContractStore.create` outcomes (9) | ok C1619 · `not_accepted` C1619 · `auto_renewal` C1619 · `site_inactive` C1619 · `no_term_start` C1619 · `no_signer` C1619 · `42501` C1619 · `P0002` C1619 · other C1619, table-driven over all 9 | - |
| `generateContractAction` outcomes (9) | forbidden C1621 · not_found C1621 · redirect C1621 · `not_accepted` C1621 · `auto_renewal` C1621 · `site_inactive` C1621 · `no_term_start` C1621 · `no_signer` C1621 · signed out C1621 | - |
| contract statuses (5) | `pending_signature` C1624 C1631 · `client_signed` C1624 C1631 · `completed` C1624 C1631 · `declined` C1624 C1631 · `voided` C1624 C1631 | - |
| agreement statuses at the Generate control (7) | `accepted` C1623 · `draft` C1623 · `sent` C1623 · `refused` C1623 · `changes_requested` C1623 · `expired` C1623 · `withdrawn` C1623 | - |
| clauses (6) | payment C1639 · cancellation C1639 · repair discount C1639 · CPI cap C1639 · governing law C1639 · renewal C1639 | - |
| provinces (13) | `AB` C1639 · `BC` C1639 · `MB` C1639 · `NB` C1639 · `NL` C1639 · `NS` C1639 · `NT` C1639 · `NU` C1639 · `ON` C1639 · `PE` C1639 · `QC` C1639 · `SK` C1639 · `YT` C1639, table-driven over `PROVINCES` | - |
| `GET /contracts/[contractId]` statuses (3) | 200 C1630 C1635 · 404 C1635 · redirect `/login` C1635 | - |
| `GET /contracts/[contractId]/pdf` statuses (4) | 200 C1636 · 404 C1637 · 503 C1638 · redirect `/login` C1637 | - |
| doors (6) | 1 `parties` C1598 C1614 · 2 writer C1597 C1612 C1615 · 3 event C1601 · 4 URLs C1630 C1636 C1647 · 5 signer pick C1599 C1600 · 6 preview C1616 C1622 | - |
| startup config: the container's contract wiring (1 assembly) | `getContainer` C1648 | - |

- Claims naming a status code, route or response shape: C1636, C1637, C1638, C1635 and C1646 each have a proof that crosses the
  boundary (the real route handler; C1646 with the real renderer).
- C1604 is a structural proof of a concurrency claim; its limit is stated in the check and in the Handoff.
- No other check claims more than the single case its proof exercises.

## Swept

- validation: C1605, C1606, C1607, C1608, C1609 (the five refusals), C1614 (`parties` shape), C1621 (uuid)
- failure modes: C1619 (unexpected database error becomes `unavailable`, logged), C1638 (renderer and settings failure), C1605 to C1609 (a refusal writes nothing)
- idempotency: C1603 (a repeat returns the same contract, no second event)
- authorization: C1610, C1612, C1613, C1615, C1616 (roles, grants, execute rights); existing - RLS select on `contracts` for every role (the viewer-read loop in `rls_roles.sql`)
- concurrency: C1604 (the agreement row lock and the unique index, structural)
- data lifecycle: C1617 (the demo contracts are backfilled and the seed reruns safely), C1618 (a contract blocks site deactivation)
- dependency failure: C1638 (renderer rejects, settings read rejects), C1619 (database down)
- state transitions: C1597 (starts `pending_signature`), C1605 (only `accepted` can generate), C1612 (`status` stays updatable for `apply_contract_transition`); existing - the contract transition assertions in `transitions.sql`
- observability: C1601 (the `contract.pending_signature` event is the audit record), C1638 (a failed render is logged once)

## Out of scope

- The Out of scope table of `plan.md` stands: signature, DocuSeal, signed PDF and audit log, W2 and W4, void and regenerate, a tenant
  template, automatic creation on accept, a contract number, a Contracts list, the activity timeline entry, moving the term for
  renewals, the logo on the PDF.

## Handoff

Size, with the arithmetic (`wc -c` of the files each slice touches, divided by four, plus an allowance for new files):

- S1 = 26k: `transitions.sql` 11 KB, `rls_roles.sql` 5 KB, `demo_seed.sql` 15 KB, `seed.sql` 15 KB, `fixture.sql` 17 KB, the contact-roles
  migration read for the redefinition 11 KB, a new migration of about 12 KB. All in Supabase.
- S2 = 34k, entering the app: `ports/index.ts` 39 KB, `infrastructure/supabase/agreements.ts` 25 KB, `agreements.test.ts` 43 KB and 34 KB
  (read in part), `agreement-view.tsx` 10 KB, `agreement-actions.ts` 9 KB, `composition/index.ts` 11 KB.
- S3 = 17k and S4 = 19k: new page, view, reader and tests, `document.ts` 6 KB, `agreement-pdf.tsx` 9 KB and its test 14 KB.
- S5 = 8k: CONTEXT.md and ROADMAP edits, advisors, live run.
- Total 104k, under the 150k budget - one builder, no ask.

Known level gaps, recorded here instead of hidden:
- C1604 proves the lock and the unique index, not a two-session race.
- C1650 is an author-side live run, not a committed test (AGENTS.md).
- Applying the migration to the project is a production change: it needs the owner's explicit go-ahead before `apply_migration`, and the
  SQL proofs pass only after it. The demo contract the live run creates is deleted by SQL only with a second go-ahead.

- **Boundary:** C1597-C1618 closed at the commit that adds `20261105194705_contract_generation.sql`; `npm run test:db` ends 23 passed, 0 failed. The migration was applied to the project with the owner's go-ahead on 2026-11-05; the file carries the version `apply_migration` recorded (AD-006).
- **Advisors (C1649):** before 5 anon and 17 authenticated findings, after 5 and 19; the two new ones are `public.contract_signer` and `public.create_contract` (authenticated, security definer). No other change.
- **Settled mid-build:** C1614's block uses the C1220 org (`tests.id('orgA')` has no row at that point in `domain_constraints.sql`) and the version of the C1232 agreement; the claim is unchanged.
- **Boundary:** C1619-C1648 closed at the commit that adds the contract page, PDF route and generate control (`91cfa98`), and the `termSummary` move that followed; `npm test` 144 files, 2,854 tests passed, `npx tsc --noEmit` and `npm run lint` exit 0, `npm run test:db` 23 passed, 0 failed.
- **Live (C1650):** run in the existing signed-in Playwright page on the dev server already on port 3000, as the demo owner, on AG-1035 (the accepted demo agreement). At 1440 px: `Generate contract` -> confirm step (Tomas Reyes · tomas.reyes@example.com, Nov 23, 2025 – Nov 22, 2026 · 12 months, $8,800.00) -> `select count(*) from contracts` still 3 -> confirm -> `/contracts/70b2d79a-48e4-4d45-990a-8810d23b379f` (4 contracts, one `contract.pending_signature` event, parties frozen). The first render crashed (a Server Component called `termSummary`, exported from a `"use client"` file); fixed by moving it to `web/domain/agreement/term.ts`, then the page rendered with no console error. Then at 375, 768 and 1440 px: no horizontal scroll (`scrollWidth` below `innerWidth`), every control on the contract and agreement pages at least 44 px tall at 375 and 768 (the compact 19 px links at 1440 are the desktop size every page uses), the agreement page reads `Contract: Pending signature · Open contract` with no Generate button, `Download PDF` answers 200 `application/pdf` named `AG-1035-contract.pdf` (7,154 bytes, `%PDF-`). Touch was measured by size and clicked, not emulated (playwright-single-context). The contract row is still in the project: deleting it is a production data change that needs the owner's go-ahead.
- **Settled mid-build:** the contract page takes no role (it has no write control), so C1633's four roles render the same markup; the `ContractView` component is named after the `AgreementView` pair and the port type is `ContractDetail`.
- **Abandoned:** a second method on `DocumentRenderer` (C874 pins that body); copying the agreement's PDF layout (the sections moved into `pdf-sections.tsx` instead, and the 40 PDF tests stayed green).
- **Round 1 (Verifier, f80ad4d..a138450): FAIL on C1601 and C1650.** C1601: the test asserted `versionNo` 1 on a one-version fixture while the check says 2; the fixture now has two versions and asserts 2 (`supabase/tests/transitions.sql`). The same fix commit closed the PASS-level gaps: C1604 strips SQL comments before comparing the lock position, C1608 asserts the first refusal wrote nothing, C1647 asserts the exact one-method body, C1648 reads the action's source for the containers it reaches, C1643 and C1646 compare each clause in full (whitespace-insensitive), the accent colour has a PDF-level assertion under C1641, and the C1619 test names read correctly.
- **Settled with the owner (2026-11-05), C1650:** (1) touch is accepted as measured by size at 375 and 768 px and clicked, not emulated, to keep the signed-in session (playwright-single-context); the wording of C1650 is unchanged and this line is the recorded deviation. (2) The owner approved deleting the live run's contract: one `delete` of `contracts` id `70b2d79a-48e4-4d45-990a-8810d23b379f` and its one `contract.pending_signature` event, run by `execute_sql`; afterwards `select count(*) from contracts` is 3, contract events 0, contracts with `parties = '{}'` 0.
