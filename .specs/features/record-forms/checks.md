# Customer, site and asset forms - checks

Profile: light
Plan: `.specs/features/record-forms/plan.md`

48 checks in 5 slices plus doors and delivery · 3 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C301:`).
  This feature numbers from C301, because earlier features own `C1:`-`C218:`. React output is
  asserted with `renderToStaticMarkup`. Supabase is the recording `stubClient`
  (`infrastructure/supabase/stub-client.ts`, which gains `insert`, `delete` and `single`).
  `@/composition` and `next/navigation` are mocked where a page or action is called directly,
  as `app/(app)/screens.test.ts` does. A client component's interactive state is proven through
  the presentational component it renders, with that state passed as props.
- **test:db** - `npm run test:db record_forms` in `web/` (AD-026) runs `fixture.sql` and then
  `supabase/tests/record_forms.sql` against the live project, rolled back. The new file joins
  `RECIPES` as `plain("record_forms")`. Each assertion is labelled with its check id, and the
  recipe passes only when its last row is `record_forms: pass`. Fixture: org A has owner `uA`,
  estimator `uE` and viewer `uV`; `siteA` names `ctA` (of `custA`) as its site contact; `ct2A`
  belongs to `cust2A` and no site names it.
- **shell** - a command run from `web/` that passes when it exits 0.
- **live** - a real browser on `npm run dev` through the Playwright MCP, signed in as the demo
  owner. Not committed (AGENTS..md). It writes "Validation Test Co" into the live demo org (plan
  Assumptions); removing the leftover customer and site is a production-data action that waits
  for the user's go-ahead.

"Writer" means role owner, admin or estimator. "Writer view" means the view rendered with role
`estimator`, and "viewer view" means it rendered with role `viewer`.

## Checks

### S1 - Create and rename a customer · ~12 files · ~22k

**C301** - the writer view of `/customers` renders an `<a href="/customers/new">` with text "New
customer" in the page header, and with zero customers the "No customers yet" panel also contains
an `<a href="/customers/new">` (AC 1)
Proof: `npx vitest run components/customers -t "C301:"`

**C302** - `validateCustomer({ name })` returns `{ ok: true, value: { name: "Acme" } }` for
`"  Acme  "` and accepts a 120-character name. For `""`, `"   "` and a 121-character name it
returns `{ ok: false, errors: { name: "Customer name must be 1 to 120 characters" } }` (AC 2, 3)
Proof: `npx vitest run domain/records -t "C302:"`

**C303** - as a writer, `createCustomer` with `name = "Acme"` calls `createCustomer` on the store
exactly once with `(member.orgId, { name: "Acme" })`. When the store returns
`{ ok: true, id: "<uuid>" }`, it calls `redirect("/customers/<uuid>")` (AC 2)
Proof: `npx vitest run "app/(app)" -t "C303:"`

**C304** - `createCustomer` with a 121-character name returns
`{ status: "invalid", errors: { name: "Customer name must be 1 to 120 characters" }, values: { name: <typed> } }`
and calls no store method (AC 3)
Proof: `npx vitest run "app/(app)" -t "C304:"`

**C305** - the customer form rendered with an `invalid` state shows the field message in an
element whose id is in the input's `aria-describedby`, sets `aria-invalid="true"` on the input,
and its `value` is the typed text (AC 3)
Proof: `npx vitest run components/records -t "C305:"`

**C306** - the writer view of `/customers/<id>` renders `<a href="/customers/<id>/edit">` with text
"Edit". The page `/customers/<id>/edit`, with `customerDetail` returning name "Kettle Test",
renders a `name` input whose `value` is "Kettle Test" (AC 4)
Proof: `npx vitest run components/customers -t "C306:"`
Proof: `npx vitest run "app/(app)" -t "C306:"`

**C307** - as a writer, `updateCustomer` bound to customer `<id>` with a valid name calls
`updateCustomer(<id>, { name })` once, and on `{ ok: true }` calls `redirect("/customers/<id>")`
(AC 5)
Proof: `npx vitest run "app/(app)" -t "C307:"`

### S2 - Add, edit and delete contacts · ~8 files · ~18k

**C308** - the writer view of `/customers/<id>` renders `<a href="/customers/<id>/contacts/new">`
"Add contact", and on each contact row `<a href="/contacts/<contactId>/edit">` "Edit" (AC 6)
Proof: `npx vitest run components/customers -t "C308:"`

**C309** - `validateContact` (all messages exact):
- Empty email and phone become `null`.
- `name` of 1 and 120 characters is accepted; `""` and 121 characters give `name: "Contact name must be 1 to 120 characters"`.
- Emails `a@b.co`, `" a@b.co "` (stored `a@b.co`) and a 254-character address are accepted. `ab.co`, `a@b`, `a b@c.co` and a 255-character address give `email: "Enter an email like name@company.com"`.
- A phone of 40 characters is accepted; 41 characters give `phone: "Phone must be 40 characters or fewer"`.

(AC 7, 8, 9, 10)
Proof: `npx vitest run domain/records -t "C309:"`

**C310** - as a writer, `createContact` bound to customer `<customerId>` with name "Dana", email
"" and phone "604-555-0111" calls `createContact(member.orgId, <customerId>, { name: "Dana", email: null, phone: "604-555-0111" })`
once, and on success calls `redirect("/customers/<customerId>")` (AC 7)
Proof: `npx vitest run "app/(app)" -t "C310:"`

**C311** - as a writer, `updateContact` bound to contact `<contactId>` (whose `customerId` is
`<customerId>`) with valid values calls `updateContact(<contactId>, value)` once, and on success
calls `redirect("/customers/<customerId>")` (AC 11)
Proof: `npx vitest run "app/(app)" -t "C311:"`

**C312** - the delete control:
- With `confirming = false`, it renders a `type="button"` "Delete contact" (or "Delete asset") and no element of `type="submit"`.
- With `confirming = true` and name "Dana", it renders "Delete Dana? This can't be undone.", a `type="submit"` "Delete" inside a `<form>`, and a `type="button"` "Cancel".
- Live, on `/contacts/<id>/edit`: pressing "Delete contact" shows the prompt, pressing "Cancel" hides it, and the contact is still listed on its customer page.

(AC 12)
Proof: `npx vitest run components/records -t "C312:"`
Proof: live - the S2 journey of C343, before the confirmed delete

**C313** - as a writer, `deleteContact` bound to contact `<contactId>` calls
`deleteContact(<contactId>)` once and, on `{ ok: true }`, calls
`redirect("/customers/<customerId>")` (AC 13)
Proof: `npx vitest run "app/(app)" -t "C313:"`

**C314** - when the store returns `{ ok: false, code: "in_use" }`, `deleteContact` returns state
`{ status: "in_use" }`, and the edit form rendered with that state shows "This contact is a site
contact. Choose another site contact for that site first." in a `role="alert"` element (AC 14)
Proof: `npx vitest run "app/(app)" -t "C314:"`
Proof: `npx vitest run components/records -t "C314:"`

**C315** - in SQL as `uE` (estimator of org A), `delete from public.contacts where id = ct2A`
deletes 1 row, and `delete ... where id = ctA` (the site contact of `siteA`) fails with SQLSTATE
`23503` and leaves `ctA` in place (AC 13, 14, door 3)
Proof: `npm run test:db record_forms`

### S3 - Add and edit sites · ~8 files · ~18k

**C316** - the writer view of `/customers/<id>` renders `<a href="/customers/<id>/sites/new">` "Add
site", and the writer view of `/sites/<id>` renders `<a href="/sites/<id>/edit">` "Edit site"
(AC 15)
Proof: `npx vitest run components/customers -t "C316:"`
Proof: `npx vitest run components/sites -t "C316:"`

**C317** - the site form's `siteContactId` `<select>`:
- Given the contacts "Zed" and "Amy", in that order, it renders exactly three options: `value=""` "No site contact", then Amy's id "Amy", then Zed's id "Zed".
- Given no contacts, it renders exactly one option, `value=""`.

(AC 16)
Proof: `npx vitest run components/records -t "C317:"`

**C318** - `validateSite(input, allowedContactIds)` (all messages exact):
- A name of 1 or 120 characters is accepted; `""` and 121 characters give `name: "Site name must be 1 to 120 characters"`.
- An address of 300 characters is accepted; 301 characters give `address: "Address must be 300 characters or fewer"`.
- `siteContactId` of `""` gives `null`, and an id in `allowedContactIds` is kept. Any other id gives `siteContactId: "Choose a contact of this customer"`.

(AC 18, 19, 20)
Proof: `npx vitest run domain/records -t "C318:"`

**C319** - as a writer, `createSite` bound to customer `<customerId>`:
- It reads the allowed contact ids from `customerDetail(<customerId>).contacts`.
- It calls `createSite(member.orgId, <customerId>, { name, address, siteContactId })` once.
- On `{ ok: true, id }`, it calls `redirect("/sites/<id>")`.
- With a `siteContactId` not in that customer's contacts, it returns `invalid` with `siteContactId` set and makes no store call.

(AC 17, 20)
Proof: `npx vitest run "app/(app)" -t "C319:"`

**C320** - as a writer, `updateSite` bound to site `<siteId>` calls `updateSite(<siteId>, value)`
once and on success calls `redirect("/sites/<siteId>")`. The adapter's `update` payload for sites
has exactly the keys `name`, `address` and `site_contact_id` (AC 21)
Proof: `npx vitest run "app/(app)" -t "C320:"`
Proof: `npx vitest run infrastructure/supabase -t "C320:"`

**C321** - in SQL as `uE`, inserting a site for `custA` with `site_contact_id = ct2A` (a contact of
`cust2A`) fails with SQLSTATE `23503`. Updating `siteA` to `site_contact_id = ct2A` fails with
`23503` too (AC 20 mechanism)
Proof: `npm run test:db record_forms`

### S4 - Add, edit and delete equipment · ~10 files · ~22k

**C322** - the writer view of `/sites/<id>`:
- With assets, it renders `<a href="/sites/<id>/assets/new">` "Add asset" in the header, and on each asset row `<a href="/assets/<assetId>/edit">` "Edit".
- With zero assets, the empty register also contains `<a href="/sites/<id>/assets/new">`.

(AC 22)
Proof: `npx vitest run components/sites -t "C322:"`

**C323** - `listAssetTypes()` queries `asset_types` with `.order("name")` and maps rows to
`{ id, code, name }`. The asset form's `assetTypeId` `<select>`, on create:
- Its first option is `value=""` and is selected.
- Then one option per type, labelled `<name> (<code>)`, for example "Rooftop unit (RTU)", in the order given.

(AC 23)
Proof: `npx vitest run infrastructure/supabase -t "C323:"`
Proof: `npx vitest run components/records -t "C323:"`

**C324** - `validateAsset(input, allowedTypeIds)` (all messages exact):
- An `assetTypeId` of `""` or not in `allowedTypeIds` gives `assetTypeId: "Choose an equipment type"`.
- Unit # of 40 / 41 characters: accepted / `unitNo: "Unit # must be 40 characters or fewer"`.
- Type/model of 120 / 121: accepted / `typeModel: "Type/model must be 120 characters or fewer"`.
- Location of 300 / 301: accepted / `location: "Location/access must be 300 characters or fewer"`.
- An empty optional field becomes `null`.

(AC 24, 25, 26)
Proof: `npx vitest run domain/records -t "C324:"`

**C325** - as a writer, `createAsset` bound to site `<siteId>` calls
`createAsset(member.orgId, <siteId>, value)` once and on success calls
`redirect("/sites/<siteId>")`. The adapter's `insert` payload for assets has
`source: "manual"`, `org_id` and `site_id` from its arguments (AC 24)
Proof: `npx vitest run "app/(app)" -t "C325:"`
Proof: `npx vitest run infrastructure/supabase -t "C325:"`

**C326** - as a writer, `updateAsset` bound to asset `<assetId>` (on site `<siteId>`) calls
`updateAsset(<assetId>, value)` once and on success calls `redirect("/sites/<siteId>")`. The
adapter's `update` payload for assets has exactly the keys `asset_type_id`, `unit_no`,
`type_model` and `location`, with no `source` (AC 27)
Proof: `npx vitest run "app/(app)" -t "C326:"`
Proof: `npx vitest run infrastructure/supabase -t "C326:"`

**C327** - as a writer, `deleteAsset` bound to asset `<assetId>` calls `deleteAsset(<assetId>)`
once and on `{ ok: true }` calls `redirect("/sites/<siteId>")`. In SQL as `uE`,
`delete from public.assets where id = assetA` deletes 1 row (AC 28, door 3)
Proof: `npx vitest run "app/(app)" -t "C327:"`
Proof: `npm run test:db record_forms`

**C328** - the page `/sites/<id>/assets/new`, with `listAssetTypes` returning `[]`, renders "Your
equipment catalog is empty." and no element of `type="submit"` (AC 29)
Proof: `npx vitest run "app/(app)" -t "C328:"`

### S5 - Who may write, and what failure looks like · ~10 files · ~20k

**C329** - `canWriteRecords(role)` is `true` for `owner`, `admin` and `estimator` and `false` for
`viewer`. The viewer views of `/customers`, `/customers/<id>` and `/sites/<id>`, rendered with
records present and with empty lists, contain none of these:
- an `href` ending in `/new` or `/edit`;
- the text "New customer", "Add contact", "Add site", "Add asset", "Edit" or "Delete".

(AC 30)
Proof: `npx vitest run components/records components/customers components/sites -t "C329:"`

**C330** - each of the eight form pages, rendered for a viewer (table-driven over all 8), shows
"Only owners, admins and estimators can change customer records." and contains no `<form>` (AC 31)
Proof: `npx vitest run "app/(app)" -t "C330:"`

**C331** - each of the ten Server Actions, called for a member with role `viewer`, returns
`{ status: "forbidden" }` and calls no store method (table-driven over all 10). A form rendered
with that state shows "You don't have permission to change customer records." in `role="alert"`
(AC 32)
Proof: `npx vitest run "app/(app)" -t "C331:"`
Proof: `npx vitest run components/records -t "C331:"`

**C332** - each of the seven form pages that take an id calls `notFound()` when its reader returns
`null` (table-driven over all 7). The new by-id readers `contactForEdit("not-a-uuid")` and
`assetForEdit("not-a-uuid")` return `null` with 0 calls to the stubbed client, and return `null`
when the stub answers with no row (AC 33)
Proof: `npx vitest run "app/(app)" -t "C332:"`
Proof: `npx vitest run infrastructure/supabase -t "C332:"`

**C333** - when a store returns `{ ok: false, code: "not_found" }`, the action returns
`{ status: "not_found", values }`. A form rendered with that state shows "This record no longer
exists." and an `<a href="/customers">` (AC 34)
Proof: `npx vitest run "app/(app)" -t "C333:"`
Proof: `npx vitest run components/records -t "C333:"`

**C334** - the record stores map a Supabase result (table-driven over the 6 rows):

| Supabase result | Store result |
| --- | --- |
| insert error `42501` | `forbidden` |
| error `23503` on create or update | `not_found` |
| error `23503` on delete | `in_use` |
| update or delete returning `[]` | `not_found` |
| any other error code (`XX000`) | `unavailable`, with `console.error` called with a string containing `XX000` |
| a thrown `TypeError("fetch failed")` | `unavailable`, with `console.error` containing "fetch failed" |

(door 2)
Proof: `npx vitest run infrastructure/supabase -t "C334:"`

**C335** - a create action given a `FormData` that also carries `org_id`, `orgId`, `customer_id`,
`customerId`, `site_id`, `siteId` and `source` with foreign values calls the store with
`member.orgId` and the route-bound parent id. The `value` object it passes has none of those
keys (AC 35)
Proof: `npx vitest run "app/(app)" -t "C335:"`

**C336** - in SQL:
- As `uE`, inserts into `customers`, `contacts` (for `custA`), `sites` (for `custA`) and `assets` (on `siteA`, type `typeA`) with `org_id = orgA` each insert 1 row.
- As `uV`, the same four inserts each fail with SQLSTATE `42501`.
- As `uV`, `update` and `delete` on `custA`, `ctA`, `siteA` and `assetA` affect 0 rows.
- As `uA`, inserting a contact with `org_id = orgA, customer_id = custB` fails with `23503`.
- As `uA`, updating `assetB` affects 0 rows.

(AC 32, 34, 35 mechanism; door 2)
Proof: `npm run test:db record_forms`

**C337** - when a store returns `{ ok: false, code: "unavailable" }`, the action returns
`{ status: "unavailable", values }` with the typed values. A form rendered with that state shows
"We couldn't save your changes. Try again." in `role="alert"`, and its inputs hold the typed
values (AC 36)
Proof: `npx vitest run "app/(app)" -t "C337:"`
Proof: `npx vitest run components/records -t "C337:"`

**C338** - a form rendered with `pending = true` has a `type="submit"` button with the `disabled`
attribute and text "Saving…". The delete control rendered with `confirming = true` and
`pending = true` has its "Delete" button `disabled`, with text "Deleting…" (AC 37)
Proof: `npx vitest run components/records -t "C338:"`

**C339** - each form renders a "Cancel" link:
- New customer: `href="/customers"`.
- Edit customer, new and edit contact, new and edit site: `href="/customers/<customerId>"`.
- New and edit asset: `href="/sites/<siteId>"`.

(table-driven over all 8; AC 38)
Proof: `npx vitest run components/records -t "C339:"`

### Doors and delivery · ~8 files · ~15k

**C340** - `getContainer()` returns the functions:
- `createCustomer`, `updateCustomer`;
- `createContact`, `updateContact`, `deleteContact`;
- `createSite`, `updateSite`;
- `createAsset`, `updateAsset`, `deleteAsset`;
- `listAssetTypes`, `contactForEdit`, `assetForEdit`.

`web/application/ports/index.ts` exports the interfaces `CustomerStore`, `ContactStore`,
`SiteStore` and `AssetStore`, and only `ContactStore` and `AssetStore` declare `delete`. No file
under `web/app` or `web/components` imports `@supabase/*` or `@/infrastructure` (door 2, AD-014)
Proof: `npx vitest run composition -t "C340:"`
Proof: `npm run lint`

**C341** - the `loading.tsx` of each of the eight form routes renders an `<h1>` and an element
with `role="status"` containing "Loading…" (table-driven over all 8; Observable loading state)
Proof: `npx vitest run "app/(app)" -t "C341:"`

**C342** - `npx next build` exits 0, and its route list contains these eight routes (door 1):
- `/customers/new`, `/customers/[customerId]/edit`;
- `/customers/[customerId]/contacts/new`, `/contacts/[contactId]/edit`;
- `/customers/[customerId]/sites/new`, `/sites/[siteId]/edit`;
- `/sites/[siteId]/assets/new`, `/assets/[assetId]/edit`.

Proof: `npx next build`

**C343** - live as the demo owner, at 375x812, 768x1024 and 1440x900:
- **S1:** create "Validation Test Co" (lands on `/customers/<id>`) and rename it.
- **S2:** add contact "Dana Test" (`dana@example.com`), fix the email, then delete it after the prompt.
- **S3:** add site "Validation Site" with that contact (before deleting it), and change the address.
- **S4:** add an RTU with unit # "1" (appears under Rooftop unit), change its location, then delete it.

At each size: no horizontal scroll; every touched control at least 44x44 px below 1024 px (touch
taps on mobile and tablet); `browser_console_messages` has no error or warning;
`browser_network_requests` has no failed request (AC 1-29, 36-38; Surface `200`)
Proof: live - Playwright MCP `browser_navigate`, `browser_resize`, `browser_click`, `browser_snapshot`, `browser_console_messages`

**C344** - `.specs/STATE.md` has three new `active` AD rows: the form URL shape (door 1), the
per-entity store port (door 2) and hard delete for contacts and assets (door 3). `CONTEXT.md`
mentions `record-forms` and no longer calls the customer screens read-only. `ROADMAP.md` shows
the Phase 1 item as `- [x] Customer, site and asset forms` (doors 1-3, AGENTS..md)
Proof: `grep -c "record-forms" ../CONTEXT.md`
Proof: `grep -c -E "^- \[x\] Customer, site and asset forms" ../ROADMAP.md`
Proof: `grep -c -E "^\| AD-0(28|29|30) \|.*\| active \|" ../.specs/STATE.md`

**C345** - signed out, `updateSession` responds `307` with `Location` path `/login` for each of
the eight form routes, filled with a uuid where the route takes one (table-driven over all 8;
Surface `307`)
Proof: `npx vitest run infrastructure/supabase -t "C345:"`

**C346** - `npm run test:db` with no argument exits 0, and `record_forms` is among the recipes it
runs (AD-026: no orphan test file)
Proof: `npm run test:db`

**C347** - the whole Vitest suite passes, including the earlier features' tests (no regression
from the views now taking `role`)
Proof: `npm test`

**C348** - the customer-detail and site-register views, rendered for a writer, still show the
same contact, site, agreement and asset rows as the earlier staff-screens proofs (the role prop
adds controls and removes nothing)
Proof: `npx vitest run components/customers components/sites -t "C348:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /customers/new` statuses (2) | `200` C330 · C343 · `307` C345 | - |
| `GET /customers/[customerId]/edit` statuses (3) | `200` C306 · C343 · `404` C332 · `307` C345 | - |
| `GET /customers/[customerId]/contacts/new` statuses (3) | `200` C343 · `404` C332 · `307` C345 | - |
| `GET /contacts/[contactId]/edit` statuses (3) | `200` C343 · `404` C332 · `307` C345 | - |
| `GET /customers/[customerId]/sites/new` statuses (3) | `200` C343 · `404` C332 · `307` C345 | - |
| `GET /sites/[siteId]/edit` statuses (3) | `200` C343 · `404` C332 · `307` C345 | - |
| `GET /sites/[siteId]/assets/new` statuses (3) | `200` C328 · C343 · `404` C332 · `307` C345 | - |
| `GET /assets/[assetId]/edit` statuses (3) | `200` C343 · `404` C332 · `307` C345 | - |
| `createCustomer`, `updateCustomer` outcomes (5) | redirect C303 · C307 · `invalid` C304 · `forbidden` C331 · `not_found` C333 · `unavailable` C337 | - |
| `createContact`, `updateContact` outcomes (5) | redirect C310 · C311 · `invalid` C309 · `forbidden` C331 · `not_found` C333 · `unavailable` C337 | - |
| `deleteContact` outcomes (5) | redirect C313 · `forbidden` C331 · `not_found` C333 · `in_use` C314 · `unavailable` C337 | - |
| `createSite`, `updateSite` outcomes (5) | redirect C319 · C320 · `invalid` C319 · `forbidden` C331 · `not_found` C333 · `unavailable` C337 | - |
| `createAsset`, `updateAsset` outcomes (5) | redirect C325 · C326 · `invalid` C324 · `forbidden` C331 · `not_found` C333 · `unavailable` C337 | - |
| `deleteAsset` outcomes (4) | redirect C327 · `forbidden` C331 · `not_found` C333 · `unavailable` C337 | - |
| Server Actions refusing a viewer (10) | C331, table-driven over all 10 | - |
| form pages, viewer message (8) | C330, table-driven over all 8 | - |
| form pages, not found (7) | C332, table-driven over all 7 | - |
| form pages, Cancel target (8) | C339, table-driven over all 8 | - |
| form routes, loading state (8) | C341, table-driven over all 8 | - |
| roles (4) | `owner` C329 · `admin` C329 · `estimator` C329 · C336 · `viewer` C329 · C336 | - |
| store error mapping (6) | C334, table-driven over all 6 | - |
| field bounds (10 edges) | customer name C302 · contact name C309 · email C309 · phone C309 · site name C318 · address C318 · site contact C318 · asset type C324 · unit # C324 · type/model and location C324 | - |
| write controls shown to writers (8) | New customer C301 · Edit customer C306 · Add contact C308 · Edit contact C308 · Add site C316 · Edit site C316 · Add asset C322 · Edit asset C322 | - |
| entities written (4) | customers C303 · C336 · contacts C310 · C315 · C336 · sites C319 · C321 · C336 · assets C325 · C327 · C336 | - |
| Landing doors (3) | door 1 URLs C342 · C344 · door 2 stores C334 · C340 · C344 · door 3 hard delete C315 · C327 · C344 | - |
| startup config: container assembly (1) | `getContainer()` C340 | - |

- Claims naming a status code, route or response shape (C330, C332, C342, C343, C345) each have a
  proof that crosses that boundary: the rendered page, the proxy, the build or a real browser.
- Claims about RLS or FK refusals (C315, C321, C336) are proven in SQL as the role in question,
  not through a stub. The stub proofs (C334) prove only the mapping.

## Swept

- validation: C302, C309, C318, C324 (every field bound), C332 (a non-uuid id), C335 (foreign ids in the form are ignored)
- failure modes: C333 (record gone), C337 (save fails, typed values kept), C334 (every Supabase error mapped)
- idempotency: n/a - no idempotency key for single-row forms; a retried create can add a second row, the plan's Assumptions accept it, and the only guard is the disabled pending button (C338)
- authorization: C329, C330, C331 (app refuses viewers), C336 (RLS refuses viewers and foreign parents), C345 (signed out)
- concurrency: n/a - last write wins with no version column (plan Assumptions); a delete racing an edit lands on `not_found` (C333, C334)
- data lifecycle: C313, C315, C327 (contacts and assets are hard-deleted; a site contact cannot be); customers and sites are never deleted (plan Out of scope)
- dependency failure: C334 (Supabase unreachable -> `unavailable`), C337 (what the user sees)
- state transitions: n/a - customers, contacts, sites and assets have no status
- observability: C334 (`console.error` carries the SQLSTATE or the thrown message); no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` (ports, readers and their test, stub client, composition and its
  test, customers, sites and settings components with tests, `screens.test.ts`, the settings
  action, `session.test.ts`, `fixture.sql`, the test-db runner, `CONTEXT.md`, `STATE.md`,
  `ROADMAP.md`): 152 KB, about 38k tokens.
- Written:
  - `domain/records` and its test: ~14 KB.
  - Store adapter and its test, plus reader additions: ~22 KB.
  - Ports and composition: ~4 KB.
  - Four forms, the delete control, state and their tests: ~35 KB.
  - Ten actions and their test: ~25 KB.
  - Eight pages, eight loadings and their test: ~26 KB.
  - `record_forms.sql`: ~7 KB.
  - Docs: ~5 KB.
  - Total ~138 KB, about 35k tokens.
- Live validation (C343, three sizes, four journeys) at ~35k tokens of snapshots.
- S1-S5 plus doors: about 108k tokens in total, under the 150k budget, so one builder.
- Live proofs (C312 live half, C343) write to the live demo org. Removing "Validation Test Co"
  and "Validation Site" afterwards needs the user's go-ahead.

- **Boundary:** C301-C311, C313-C342, C345-C348 closed at `459d218` (one builder). C344 partly: AD-028 to AD-030 and `CONTEXT.md` in the docs commit; the ROADMAP tick waits for C343. Not run: C343 and the live half of C312, because live writes to the demo org need the user's go-ahead, the Playwright browser profile is held by another process, and a dev server not started by this session holds :3000
- **Settled mid-build:** phase1-validation's pinned recipe list and counts (C201, C203-C205, C210-C212) extended from 9 recipes / 11 files to 10 / 12, approved by the user; `cancelHrefFor` added so C339 is provable at the component layer; the three views take an optional `role` (absent means read-only), and the list, detail and site pages now read `currentMember()`; `screens.test.ts` sets a member in `beforeEach` for that; the delete actions take only the bound id
- **Abandoned:** nothing
