# Contact roles - checks

Profile: light
Plan: `.specs/features/contact-roles/plan.md`

38 checks in 2 slices · 2 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1440:`). This feature numbers
  from C1440, because task-library-page owns up to `C1439:`.
  - Pure rules: `domain/records/records.test.ts` (exists, appended).
  - Stores: `infrastructure/supabase/records.test.ts`; readers: `infrastructure/supabase/readers.test.ts` (both exist, appended).
  - Views and forms: `components/customers/customers.test.ts`, `components/records/records.test.ts`, `components/sites/*.test.ts`
    (exist, appended), with `renderToStaticMarkup`.
  - Actions: `app/(app)/record-forms.test.ts` (exists, appended), with the same mocked container.
- **sql** (C1463-C1467) runs with `npm run test:db contact_roles` from `web/`: `supabase/tests/contact_roles.sql` (new file, recipe added to
  `scripts/test-db/runner.mts`), after `fixture.sql`, in one rolled-back transaction. It needs the migration applied to the
  database the script targets. Assertions are labelled `C1463 ...` and the recipe fails on any false one.
- **sql** (C1468-C1474) is appended to `supabase/tests/outbox_dispatch.sql` and runs with `npm run test:db outbox_dispatch`,
  because the claim helpers, the Vault setup and the renewal fixture live there.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- One migration adds the two columns and `private.customer_recipient` (doors 1 and 2) and re-creates `public.automation_claim`
  and `private.claim_renewals` with the resolver in place of the inline join. `database.types.ts` gains the two columns.

Terms:
- "approver" is `sites.approver_contact_id`; "billing contact" is `customers.billing_contact_id`; "site contact" is the existing
  `sites.site_contact_id`.
- "the allowed ids" are the ids of the contacts of the site's (or customer's) customer.

## Checks

### S1 - Staff assign roles · ~16 files · ~110 KB · ~28k

**C1440** - `validateSite` with an approver id among the allowed ids returns `approverContactId` equal to that id (AC 1)
Proof: `npx vitest run domain/records/records.test.ts -t "C1440:"` in `web/`

**C1441** - `validateSite` with a blank approver returns `approverContactId: null` (AC 3)
Proof: `npx vitest run domain/records/records.test.ts -t "C1441:"` in `web/`

**C1442** - `validateSite` with an approver id not among the allowed ids returns `ok: false` and
`errors.approverContactId === "Choose a contact of this customer"` (AC 4)
Proof: `npx vitest run domain/records/records.test.ts -t "C1442:"` in `web/`

**C1443** - `validateCustomer` with a billing contact id among the allowed ids returns `billingContactId` equal to that id (AC 2)
Proof: `npx vitest run domain/records/records.test.ts -t "C1443:"` in `web/`

**C1444** - `validateCustomer` with a blank billing contact returns `billingContactId: null` (AC 3)
Proof: `npx vitest run domain/records/records.test.ts -t "C1444:"` in `web/`

**C1445** - `validateCustomer` with a billing contact id not among the allowed ids returns `ok: false` and
`errors.billingContactId === "Choose a contact of this customer"` (AC 4)
Proof: `npx vitest run domain/records/records.test.ts -t "C1445:"` in `web/`

**C1446** - A site update sends exactly `name`, `address`, `site_contact_id` and `approver_contact_id` for that id (AC 1)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1446:"` in `web/`

**C1447** - A site insert carries `org_id`, `customer_id`, `name`, `address`, `site_contact_id` and `approver_contact_id` (AC 1)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1447:"` in `web/`

**C1448** - A customer update sends exactly `name` and `billing_contact_id` for that id (AC 2)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1448:"` in `web/`

**C1449** - A customer insert still carries only `org_id` and `name` (a new customer has no contacts yet)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1449:"` in `web/`

**C1450** - The customer reader returns, for each contact, the roles it holds (`billing`, and `approver` / `site` with the site
name), taken from `customers.billing_contact_id`, `sites.approver_contact_id` and `sites.site_contact_id` (AC 6)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1450:"` in `web/`

**C1451** - The site reader returns `approverContactId` and `approverName` of the site's approver, both null when none (AC 1)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1451:"` in `web/`

**C1452** - The customer page shows the label `Billing` beside the billing contact's name (AC 6)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1452:"` in `web/`

**C1453** - The customer page shows `Approver · <site>` and `Site · <site>` beside a contact for each site it serves (AC 6)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1453:"` in `web/`

**C1454** - A contact holding no role shows none of the labels `Billing`, `Approver ·`, `Site ·` (AC 6, empty state)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1454:"` in `web/`

**C1455** - For a viewer the customer page shows the role labels and no `Add contact` link and no edit link (AC 7)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1455:"` in `web/`

**C1456** - The site register shows `Approver: <name>` after the site contact, and `Approver: -` when there is none (AC 1)
Proof: `npx vitest run components/sites/sites.test.ts -t "C1456:"` in `web/`

**C1457** - The site form renders an Approver select named `approverContactId` whose first option is `No approver`, then the
customer's contacts by name, with the saved one selected (AC 1, 3)
Proof: `npx vitest run components/records/records.test.ts -t "C1457:"` in `web/`

**C1458** - With no contacts the site form's Approver select has only the option `No approver` (empty state)
Proof: `npx vitest run components/records/records.test.ts -t "C1458:"` in `web/`

**C1459** - The site form shows `Choose a contact of this customer` under Approver when the state carries that error (AC 4)
Proof: `npx vitest run components/records/records.test.ts -t "C1459:"` in `web/`

**C1460** - The customer form given contacts renders a Billing contact select named `billingContactId` whose first option is
`No billing contact`, with the saved one selected; given none it renders no such select (AC 2, 3, empty state)
Proof: `npx vitest run components/records/records.test.ts -t "C1460:"` in `web/`

**C1461** - A site save naming an approver outside the customer's contacts comes back `invalid` with the
`approverContactId` message and calls no store (AC 4)
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1461:"` in `web/`

**C1462** - A customer save naming a billing contact outside the customer's contacts comes back `invalid` with the
`billingContactId` message and calls no store (AC 4)
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1462:"` in `web/`

**C1463** - `sites.approver_contact_id` and `customers.billing_contact_id` each store a contact of the same customer and each
refuse, with `23503`, a contact of another customer (AC 4, door 1)
Proof: `npm run test:db contact_roles` in `web/`, assertion `C1463`

**C1464** - Deleting a contact that is some site's approver is refused with `23503`, and so is deleting a customer's billing
contact; the contact row remains (AC 5)
Proof: `npm run test:db contact_roles` in `web/`, assertion `C1464`

**C1465** - An estimator can set `approver_contact_id` on a site and `billing_contact_id` on a customer of their org; a viewer's
update of either changes no row (door 1, grants)
Proof: `npm run test:db contact_roles` in `web/`, assertion `C1465`

### S2 - Customer emails follow the approver · 3 files · ~35 KB · ~9k

**C1466** - `private.customer_recipient` returns the email for each of six cases: approver and site contact both with email gives
the approver's; approver with email and no site contact gives the approver's; approver blank and site contact with email gives
the site contact's; no approver and site contact with email gives the site contact's; no approver and no site contact gives
null; blank approver and blank site contact gives null (AC 8, 9, 10, door 2)
Proof: `npm run test:db contact_roles` in `web/`, assertion `C1466`

**C1467** - `anon` and `authenticated` cannot execute `private.customer_recipient` (door 2)
Proof: `npm run test:db contact_roles` in `web/`, assertion `C1467`

**C1468** - The agreement link email (`customer_link`) of a site with an approver is addressed to the approver's email (AC 8)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1468`

**C1469** - The day-3 reminder (`customer_reminder`) of a site with an approver is addressed to the approver's email (AC 8)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1469`

**C1470** - The renewal notice (`customer_renewal`) of a site with an approver is addressed to the approver's email (AC 8)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1470`

**C1471** - The link email and the reminder of a site with no approver are addressed to the site contact, and so are those
whose approver has a blank email (AC 9)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1471`

**C1472** - The renewal notice of a site with no approver is addressed to the site contact (AC 9)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1472`

**C1473** - A link email, a reminder and a renewal notice of a site where neither approver nor site contact has an email are skipped with
`no_recipient` and send no message (AC 10)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1473`

**C1474** - When approver and site contact both have an email, the notification row holds exactly one recipient, the
approver's (AC 11)
Proof: `npm run test:db outbox_dispatch` in `web/`, assertion `C1474`

**C1475** - The existing notification behaviour is unchanged: every assertion of the outbox dispatch recipe, including
staff-addressed kinds and the expiry notice, still passes
Proof: `npm run test:db outbox_dispatch` in `web/`

### Whole feature

**C1476** - The types compile and lint is clean with the new fields: `database.types.ts`, ports, readers, forms and pages agree
Proof: `npx tsc --noEmit` and `npm run lint` in `web/`, and `npm test` in `web/` with no failure

**C1477** - Signed in as the demo owner, editing a site sets its approver and the customer page shows `Approver · <site>`;
editing the customer sets a billing contact and the page shows `Billing`; the console has no errors at 375, 768 and 1440 px
(AC 1, 2, 6)
Proof: live, recorded in the Handoff (author-side Playwright, one signed-in context)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| roles shown as a label (3) | site C1453 · approver C1453 · billing C1452 | - |
| role selects in a form (2) | approver C1457 · billing C1460 | - |
| role-holding references (2) | `sites.approver_contact_id` C1463 · `customers.billing_contact_id` C1463 | - |
| role validation outcomes (6) | approver accepted C1440 · blank C1441 · foreign C1442 · billing accepted C1443 · blank C1444 · foreign C1445 | - |
| recipient resolution cases (6) | both emails C1466 · approver only C1466 · approver blank, site email C1466 · no approver, site email C1466 · neither C1466 · both blank C1466 | - |
| customer-addressed notification kinds (3) | `customer_link` C1468 · `customer_reminder` C1469 · `customer_renewal` C1470 | - |
| fallback and skip, per kind (6) | link fallback C1471 · reminder fallback C1471 · renewal fallback C1472 · link skip C1473 · reminder skip C1473 · renewal skip C1473 | - |
| viewer vs writer (2) | writer C1457, C1465 · viewer C1455, C1465 | - |
| `Surface` routes (0) | none in the plan | - |
| startup configuration (0) | none | - |

- Claims naming a status code or reason: C1463 (`23503`), C1464 (`23503`), C1473 (`no_recipient`); each proof crosses the
  boundary (SQL against the real constraint and the real claim function).
- No other check claims more than the single case its proof exercises.

## Swept

- validation: C1442, C1445
- failure modes: C1464 (delete refused), C1473 (no usable email)
- idempotency: n/a - assigning a role overwrites one nullable column; notification idempotency keys are untouched and held by C1475
- authorization: C1465, C1467
- concurrency: n/a - last write wins on one nullable column, as `site_contact_id` does today; no ordering rule exists
- data lifecycle: C1464, C1471 (existing sites have no approver and keep emailing the site contact; no backfill)
- dependency failure: n/a - no external call is added; Resend and n8n paths are unchanged (C1475)
- state transitions: n/a - no status machine is touched
- observability: C1474 (the stored `notifications.recipients` is the evidence of who was addressed)

## Out of scope

- Billing contact receiving anything, several approvers or CC recipients, contact deactivation, and role-specific portal
  permissions - as in the plan.

## Handoff

- S1 = 16 files, ~110 KB (domain 5 KB, ports 36 KB, records 7 KB, readers 23 KB, actions 11 KB, forms 4 KB, views 14 KB,
  pages 4 KB) and S2 = the migration (re-created functions, ~35 KB read) plus one new SQL test, ~35 KB. Total ~145 KB / 4 = ~36k
  tokens, under the 150k budget - one builder.
- Mechanism: one builder (fits, no ask).
- **Settled mid-build:** C1468-C1474 moved from the `contact_roles` recipe to `outbox_dispatch` (same claims, same assertion
  labels); the helpers they need exist only in that file.
