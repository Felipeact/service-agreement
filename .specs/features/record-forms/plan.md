# Customer, site and asset forms: staff add and edit customers, contacts, sites and assets

## Problem

Staff can read customers, contacts, sites and equipment but cannot change any of them. `/customers`,
`/customers/[customerId]` and `/sites/[siteId]` are read-only (CONTEXT.md: "no screen creates
customers yet"). The only rows in the database are the demo org's 12 customers, 12 contacts, 12 sites
and 57 assets, which `supabase/seed.sql` wrote. A contractor who signs up today cannot record a new
client, the client's facility manager, the building, or the rooftop units on it. Asset import is
Phase 2, and the agreement builder (Phase 3) needs a site with equipment before it can price a visit.
So until this ships, no real tenant can reach the first step of the product.

A typo has the same problem: a wrong unit number or a facility manager's old email can only be fixed
in SQL by someone with the database password. An estimator who mistypes an asset has no way to remove
it.

The source (ROADMAP.md Phase 1, last item) gives no user evidence or date. It is the missing write
half of M3 and M4 (`source: manual`).

When this ships, an owner, admin or estimator can create a customer, then add its contacts and
sites, then add equipment to a site, all from the pages they already use. They can edit each of
those records, and they can delete a contact or an asset they entered by mistake. Viewers see the
same pages with no write controls.

## Flow

This reuses the `/settings` write shape (AD-025: a Server Action, then a pure `validate…` function,
then a store port, then a Supabase update that RLS decides). It also reuses the read ports (AD-023),
`getContainer()`, `TextInput`, `Select`, `Button`, `EmptyPanel` and the `(app)` `not-found.tsx` /
`error.tsx`. No new dependency and no migration.

1. `GET` a form route -> `web/proxy.ts` (exists) refreshes the session -> `MemberGate` (exists) resolves the member or redirects to `/login`.
2. The form page (new Server Component under `web/app/(app)`, placement per door 1) -> `getContainer()` (exists) -> the read ports `CustomerDirectory` and `SiteRegister` (exist, grow per AD-023) plus an asset-type read for the type `Select` (placement per AD-023). The page loads the record or its parent as the member under RLS. A malformed, missing or foreign id calls `notFound()`.
3. Submit -> the page's Server Action (new, placement per AD-025) -> `currentMember()` (exists). The action refuses a viewer before any write. `org_id` comes from the member, the parent id from the route, never from the form.
4. The action -> pure `validate…` for that entity (new, placement per AD-025) -> field errors go back as form state with the typed values.
5. The action -> the entity's store port (door 2) -> its Supabase adapter runs `insert` / `update` / `delete` as the member. RLS (exists, AD-004) and the composite foreign keys (exist, AD-003) refuse a foreign parent, a viewer, a site contact from another customer, and deleting a contact some site still names.
6. Out: a redirect to the parent record page, which re-reads on the next request. Or the form state `invalid`, `forbidden`, `not_found`, `in_use` or `unavailable`.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: **record writer**, meaning the roles allowed to write customers, contacts, sites and assets: owner, admin, estimator. This mirrors the existing RLS policies in `20261019174738_init.sql`. A TS helper decides which controls to show and which actions run; RLS still has the last word |
| domain | existing term: asset `source` stays `manual` for every row this creates, and an edit never changes it, so an imported asset stays `import` after a manual correction. Today nothing branches on `source`; the Phase 2 review grid will |
| stored data | nothing to migrate: no table, column, constraint or policy changes. The **live demo org** does gain rows during live validation (see Assumptions) |
| screens | `/customers` gains "New customer"; `/customers/[customerId]` gains "Edit", "Add contact", "Add site" and per-contact "Edit"; `/sites/[siteId]` gains "Edit site", "Add asset" and per-asset "Edit". Each is shown to writers only, so `CustomersView`, `CustomerDetailView` and `SiteRegisterView` start taking the member's role |
| read ports | `CustomerDirectory` and `SiteRegister` grow by-id reads for one contact and one asset (with the ids an edit form needs: `customerId`, `siteId`, `assetTypeId`, `siteContactId`). The existing view types keep their fields, so the three current screens are unchanged |
| composition | `getContainer()` gains four store ports and the asset-type read; its return type grows |
| decisions | doors 1–3 reach past this feature and get `AD-NNN` rows in `.specs/STATE.md` |
| docs | `CONTEXT.md` Customer, Contact, Site and Asset entries lose "read-only" and gain the forms; Build log line; ROADMAP Phase 1 item ticked |

## Relations

None - no stored-data shape change. The forms write the existing `customers`, `contacts`, `sites`
and `assets` tables, and their constraints are unchanged: composite parent keys (AD-003),
`sites (site_contact_id, customer_id) -> contacts (id, customer_id)`, and
`assets.source in ('manual', 'import')`.

## Surface

Every route below is new. Each `GET` answers `307` to `/login` when signed out (proxy, AD-018).
Each Server Action posts to its own page route, and the response is the form state or a redirect
instruction.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /customers/new` | session | empty customer form | `200`, `307` |
| `GET /customers/[customerId]/edit` | `customerId` | customer form, prefilled | `200`, `404`, `307` |
| `GET /customers/[customerId]/contacts/new` | `customerId` | empty contact form | `200`, `404`, `307` |
| `GET /contacts/[contactId]/edit` | `contactId` | contact form, prefilled, with Delete | `200`, `404`, `307` |
| `GET /customers/[customerId]/sites/new` | `customerId` | site form, contact `Select` of that customer's contacts | `200`, `404`, `307` |
| `GET /sites/[siteId]/edit` | `siteId` | site form, prefilled | `200`, `404`, `307` |
| `GET /sites/[siteId]/assets/new` | `siteId` | asset form, type `Select` of the org's asset types | `200`, `404`, `307` |
| `GET /assets/[assetId]/edit` | `assetId` | asset form, prefilled, with Delete | `200`, `404`, `307` |
| `POST` Server Actions `createCustomer`, `updateCustomer` | `name` | redirect to `/customers/<id>` · state `invalid` · `forbidden` · `not_found` · `unavailable` | `200` |
| `POST` Server Actions `createContact`, `updateContact` | `name`, `email`, `phone` | redirect to `/customers/<customerId>` · state `invalid` · `forbidden` · `not_found` · `unavailable` | `200` |
| `POST` Server Action `deleteContact` | none (id from the route) | redirect to `/customers/<customerId>` · state `forbidden` · `not_found` · `in_use` · `unavailable` | `200` |
| `POST` Server Actions `createSite`, `updateSite` | `name`, `address`, `siteContactId` | redirect to `/sites/<id>` · state `invalid` · `forbidden` · `not_found` · `unavailable` | `200` |
| `POST` Server Actions `createAsset`, `updateAsset` | `assetTypeId`, `unitNo`, `typeModel`, `location` | redirect to `/sites/<siteId>` · state `invalid` · `forbidden` · `not_found` · `unavailable` | `200` |
| `POST` Server Action `deleteAsset` | none (id from the route) | redirect to `/sites/<siteId>` · state `forbidden` · `not_found` · `unavailable` | `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. the form URL shape (import review, agreement builder and emails will link to these; extends AD-024) | create nests under the parent that owns the new row: `/customers/new`, `/customers/[customerId]/contacts/new`, `/customers/[customerId]/sites/new`, `/sites/[siteId]/assets/new`. Edit is flat by the record's own uuid: `/customers/[customerId]/edit`, `/contacts/[contactId]/edit`, `/sites/[siteId]/edit`, `/assets/[assetId]/edit`. Delete is a Server Action on the edit page, with no route of its own | a drawer over the record page with `?edit=` (user chose pages on 2026-10-26: cramped at 375 px and needs a focus-trapped client dialog); parent as a query param (`/contacts/new?customerId=`), because a missing param needs its own error state and the parent looks optional; nested edit (`/customers/[c]/contacts/[id]/edit`), because the Phase 2 review grid must link to an asset knowing only its id |
| 2. the write-port shape (every later entity form copies it) | one port per entity in `web/application/ports`: `CustomerStore`, `ContactStore`, `SiteStore`, `AssetStore`. Each has `create(orgId, parentId, value)` returning `{ ok: true, id } \| { ok: false, code }` and `update(id, value)` returning `{ ok: true } \| { ok: false, code }`; `ContactStore` and `AssetStore` also have `delete(id)`. The adapter maps SQLSTATE `42501` to `forbidden`, `23503` on create or update to `not_found`, `23503` on delete to `in_use`, an update or delete that returns no row to `not_found`, and anything else to `unavailable` (logged with `console.error`, as `OrgSettingsStore.save` does). `org_id` is a parameter, never a field of `value` | one `RecordWriter` with every method (AGENTS.md ISP, and AD-023 already split reads per screen); a generic `TableStore<T>`, because it puts table names in `application/`, which AD-014 keeps database-free; an RPC per form, because AD-025 settled that one statement is already atomic |
| 3. hard delete for contacts and assets | `delete from public.contacts / public.assets where id = $1` as the member, under the existing delete policies. A contact that a site still names is refused by the existing FK `sites (site_contact_id, customer_id)` with SQLSTATE `23503`, and nothing is cascaded or nulled | an `archived_at` column, because it is a migration plus a filter in every reader, for two entities with nothing to keep yet (Phase 3 agreements snapshot the equipment list, so deleting an asset never changes a sent agreement); clearing `site_contact_id` on delete (`on delete set null`), because it silently removes who approves the agreement for that site. This closes nothing later: an archive column can still be added when customers and sites become deletable |

- Nothing else in this change is hard to reverse: field length bounds, labels and messages are app-side only, with no database constraint.

## Criteria

"Writer" means a member whose role is owner, admin or estimator. Every text field is trimmed, and an
empty optional field is stored as `null`.

### S1: Create and rename a customer (P1)

A writer records a new client company and fixes its name.

**Acceptance Criteria**

1. WHEN a writer opens `/customers` THEN the system SHALL show a "New customer" link to `/customers/new` in the page header, and in the "No customers yet" empty state when the list is empty
2. WHEN a writer submits `/customers/new` with a name of 1 to 120 characters THEN the system SHALL insert one `customers` row with that name and the member's `org_id`, and redirect to `/customers/<new id>`
3. IF the customer name is empty or longer than 120 characters THEN the system SHALL write nothing and show "Customer name must be 1 to 120 characters" under the field, keeping the typed value
4. WHEN a writer opens `/customers/<id>` THEN the system SHALL show an "Edit" link to `/customers/<id>/edit`, whose form is prefilled with the current name
5. WHEN a writer saves `/customers/<id>/edit` with a valid name THEN the system SHALL update that row's `name` and redirect to `/customers/<id>`

**Independent test:** sign in as the demo owner, create "Validation Test Co", land on its empty detail page, then rename it.

### S2: Add, edit and delete contacts (P1)

A writer records who at the customer reviews and approves the agreement.

**Acceptance Criteria**

6. WHEN a writer opens `/customers/<id>` THEN the system SHALL show an "Add contact" link to `/customers/<id>/contacts/new`, and an "Edit" link on each contact row to `/contacts/<contactId>/edit`
7. WHEN a writer submits a contact with a valid name, email and phone THEN the system SHALL insert one `contacts` row for that customer, with an empty email or phone stored as `null`, and redirect to `/customers/<customerId>`
8. IF the contact name is empty or longer than 120 characters THEN the system SHALL write nothing and show "Contact name must be 1 to 120 characters"
9. IF the contact email is not empty and either does not match `^[^\s@]+@[^\s@]+\.[^\s@]+$` or is longer than 254 characters THEN the system SHALL write nothing and show "Enter an email like name@company.com"
10. IF the contact phone is longer than 40 characters THEN the system SHALL write nothing and show "Phone must be 40 characters or fewer"
11. WHEN a writer saves `/contacts/<id>/edit` with valid values THEN the system SHALL update that contact's name, email and phone and redirect to `/customers/<customerId>`
12. WHEN a writer presses "Delete contact" on `/contacts/<id>/edit` THEN the system SHALL show "Delete <name>? This can't be undone." with "Delete" and "Cancel" buttons, and SHALL delete nothing until "Delete" is pressed
13. WHEN the writer confirms deleting a contact that no site names as its site contact THEN the system SHALL delete that row and redirect to `/customers/<customerId>`
14. IF the contact being deleted is the site contact of any site THEN the system SHALL delete nothing and show "This contact is a site contact. Choose another site contact for that site first."

**Independent test:** add a contact to "Validation Test Co", fix its email, then delete it.

### S3: Add and edit sites (P1)

A writer records the buildings where the equipment is installed, and who approves for each.

**Acceptance Criteria**

15. WHEN a writer opens `/customers/<id>` THEN the system SHALL show an "Add site" link to `/customers/<id>/sites/new`, and WHEN a writer opens `/sites/<id>` THEN the system SHALL show an "Edit site" link to `/sites/<id>/edit`
16. The site form's "Site contact" `Select` SHALL offer "No site contact" followed by that customer's contacts ordered by name, and only those
17. WHEN a writer submits a site with a valid name, address and site contact THEN the system SHALL insert one `sites` row for that customer and redirect to `/sites/<new id>`
18. IF the site name is empty or longer than 120 characters THEN the system SHALL write nothing and show "Site name must be 1 to 120 characters"
19. IF the site address is longer than 300 characters THEN the system SHALL write nothing and show "Address must be 300 characters or fewer"
20. IF the submitted site contact id is neither empty nor the id of one of that customer's contacts THEN the system SHALL write nothing and show "Choose a contact of this customer" under the field
21. WHEN a writer saves `/sites/<id>/edit` with valid values THEN the system SHALL update the site's name, address and site contact, leave its `customer_id` unchanged, and redirect to `/sites/<id>`

**Independent test:** add a site to "Validation Test Co" with its contact as site contact, open the empty register, then change the address.

### S4: Add, edit and delete equipment (P1)

A writer fills a site's equipment register by hand.

**Acceptance Criteria**

22. WHEN a writer opens `/sites/<id>` THEN the system SHALL show an "Add asset" link to `/sites/<id>/assets/new` in the page header and in the empty register, and an "Edit" link on each asset row to `/assets/<assetId>/edit`
23. The asset form's "Equipment type" `Select` SHALL list the org's `asset_types` ordered by name, each labelled `<name> (<code>)`, with no type preselected on create
24. WHEN a writer submits an asset with a valid type, unit #, type/model and location/access THEN the system SHALL insert one `assets` row on that site with `source = 'manual'` and redirect to `/sites/<siteId>`
25. IF no equipment type is chosen, or the submitted id is not one of the org's asset types THEN the system SHALL write nothing and show "Choose an equipment type"
26. IF the unit # is longer than 40, the type/model longer than 120, or the location/access longer than 300 characters THEN the system SHALL write nothing and show "<Label> must be <n> characters or fewer" under that field
27. WHEN a writer saves `/assets/<id>/edit` with valid values THEN the system SHALL update the type, unit #, type/model and location/access, leave `source` unchanged, and redirect to `/sites/<siteId>`
28. WHEN the writer confirms "Delete asset" through the same two-step prompt as criterion 12 THEN the system SHALL delete that row and redirect to `/sites/<siteId>`
29. WHILE the org has no asset types the system SHALL show "Your equipment catalog is empty." on `/sites/<id>/assets/new` and no submit button

**Independent test:** add an RTU with unit # 1 to the new site, see it under its type group, change its location, then delete it.

### S5: Who may write, and what failure looks like (P1)

Only writers change records, only in their own org, and a failed save never loses what was typed.

**Acceptance Criteria**

30. WHILE the member's role is viewer the system SHALL show none of the "New customer", "Add …", "Edit" or "Delete" controls on `/customers`, `/customers/<id>` or `/sites/<id>`
31. WHEN a viewer opens any of the eight form routes THEN the system SHALL show "Only owners, admins and estimators can change customer records." and no form
32. IF a viewer's request reaches any create, update or delete Server Action THEN the system SHALL write nothing and return state `forbidden`, shown as "You don't have permission to change customer records."
33. IF a form route's id is not a uuid, matches no row, or belongs to another org THEN the system SHALL respond `404` with the existing not-found page
34. IF a create targets a parent customer or site that no longer exists or belongs to another org, or an update or delete matches no row, THEN the system SHALL write nothing and show "This record no longer exists." with a link to `/customers`
35. The system SHALL write `org_id` from the signed-in member and the parent id from the route, and SHALL ignore any `org_id`, `customer_id`, `site_id` or `source` field in the submitted form
36. IF a write fails with an unexpected database or network error THEN the system SHALL keep the typed values and show "We couldn't save your changes. Try again."
37. WHILE a save or delete is pending the system SHALL disable its button and label it "Saving…" or "Deleting…"
38. The system SHALL show on every form page a "Cancel" link back to the record page the form came from (the customer page for customer, contact and site forms; the site page for asset forms)

**Independent test:** sign in as a viewer; no write controls appear, `/customers/new` shows the permission message, and a replayed action returns `forbidden` with no row written (SQL proof under RLS).

## Out of scope

| Excluded | Why |
| --- | --- |
| Deleting customers and sites | agreements hang off sites, so this needs an archive or lifecycle decision first (user, 2026-10-26) |
| Moving a site to another customer, or an asset to another site | changes who approves and which agreement covers the equipment; no request for it |
| Editing the equipment-type catalog or task library | M6 catalog screen, its own item |
| Bulk entry or paste of many assets | Phase 2 asset import |
| Marking a primary contact, or contact roles | no column for it; the list keeps "earliest contact" |
| Recording record edits in `events` | `events` is the transition audit trail (AD-015); record history is M15 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Two people editing the same record | last write wins; no version column | the tables have no `updated_at`, and `/settings` already works this way (AD-025); a stale-write guard needs a migration | n |
| Duplicate customer, site or contact names | allowed, with no warning | two strata corporations can share a name, and names are not unique in the schema | n |
| Double submit of a create | the disabled pending button (AC 37) is the only guard; a retried request can create a second row | no idempotency key exists for single-row forms; a duplicate is visible and deletable for contacts and assets, renamable for customers and sites | n |
| Feedback after a save | redirect to the record page with no toast; the new or changed row is the feedback | there is no toast component, and the settings form's inline "saved" fits a page that stays put, which these do not | n |
| Email case | stored as trimmed, not lower-cased | the portal (Phase 3) sends to it as entered; matching is not needed yet | n |
| Live validation writes to the live demo org | the Playwright journey creates "Validation Test Co" with one contact, one site and one asset, and deletes the asset and contact through the UI. The leftover customer and site are removed by one SQL `delete` that runs only after the user's go-ahead | AGENTS..md requires a live journey, and the app cannot delete customers or sites (out of scope) | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/customers` | empty state | AC 1 |
| screens `/customers`, `/customers/<id>`, `/sites/<id>` | unauthorised (viewer) | AC 30 |
| screens `/customers/<id>`, `/sites/<id>` | empty sections with a write control | AC 6, 15, 22; existing "No contacts yet" / "No sites yet" / empty register text stays |
| all eight form screens | empty state | AC 29 (no asset types); AC 16 (customer with no contacts offers only "No site contact"); otherwise n/a - a create form starts empty by definition |
| all eight form screens | loading state | existing - a `loading.tsx` per route like the current `(app)` pages |
| all eight form screens | error state | AC 36 for a failed save; existing `(app)/error.tsx` for a failed read |
| all eight form screens | unauthorised | AC 31, 32; signed out: existing proxy `307` (AD-018) |
| all eight form screens | not found / foreign id | AC 33, 34 |
| all eight form screens | density and ordering | AC 16, 23; field order follows the register columns (type, unit #, type/model, location) |
| edit contact, edit asset | destructive action confirms | AC 12, 28 |
| all eight form screens | way out without saving | AC 38 |
| all eight form screens | pending state | AC 37 |
| collection: asset types in the `Select` | grouping, naming, ordering | AC 23 |
| collection: customers, sites, contacts | duplicates | Assumptions - allowed |
| all Server Actions | error shape and codes | Landing door 2; AC 32, 34, 36, 14 |
| all Server Actions | versioning, rate limits | n/a - same-origin Server Actions behind a staff session, consumed by nothing outside this app |

## Sources

- ROADMAP.md Phase 1: "Customer, site and asset forms: staff add and edit customers, contacts, sites and assets by hand (M3, M4 `source: manual`)"
- User decisions, 2026-10-26: dedicated form pages; delete for assets and contacts only
- `.specs/STATE.md` AD-023, AD-024, AD-025: the read-port, URL and single-row-write precedents this extends
