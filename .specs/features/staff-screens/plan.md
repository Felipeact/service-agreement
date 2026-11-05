# Staff screens on real data: pipeline, customers, customer detail, site register, company settings

## Problem

A signed-in estimator sees nothing of their own company's data. `/pipeline` draws twelve fictitious
cards from `web/lib/sample-pipeline.ts` under a "Sample data" badge, the Customers and Settings nav
items are disabled, and the demo org's 12 customers, 12 sites, 57 assets and company settings
exist only in the database (CONTEXT.md: "No screen yet"). The estimator cannot check which
equipment is on a site, cannot read the terms a future agreement will carry, and cannot correct
the company name, address or default terms that M2 says every PDF will be branded with.

Nobody can see whether the schema, RLS and read paths work for a real session either: the
ports-adapters write path and the sign-in are proven, but no page has read an org row through a
member's cookies yet. The source (ROADMAP.md Phase 1, item 6) gives no user-facing evidence; it is
the last foundation step before the agreement builder (Phase 3) and the import review grid
(Phase 2) need pages to hang from.

When this ships, a member opens `/pipeline` and sees their org's agreements by stage with real
totals and age; opens `/customers`, then a customer, then one of its sites, and reads the
equipment register; and an owner or admin edits the company profile and default terms.

## Flow

Reuses `getContainer()`, the `Clock` port (deal age is its first reader, as CONTEXT.md says),
`pipelineStage`, `lineAnnualCents` / `sumCents`, `formatCad`, the `MemberGate` + `AppShell`, and the
existing `PageHeader`, `SearchInput`, `TextInput`, `StatusPill` and `Button`. No new dependency.

1. any `(app)` route -> `web/proxy.ts` (exists) refreshes the session -> `MemberGate` (exists) resolves the member, redirects to `/login`, or shows No workspace.
2. the page (new Server Component under `web/app/(app)`, placement) -> `getContainer()` (exists, gains the read ports, door 1) -> a read port (door 1) -> its Supabase adapter (door 1) queries as the signed-in member under RLS and hands a plain view model back. The container passes `Clock` to the pipeline reader.
3. `/pipeline`: the reader's rows pass through `pipelineStage` (exists), `lineAnnualCents` and `sumCents` (exist) and `Clock.now()` to derive stage, totals and age, then `PipelineView` (exists, loses its sample-data prop) renders them. Agreements whose stage is `null` are dropped.
4. `/customers`, `/customers/[customerId]`, `/sites/[siteId]`: the page renders its view model with the existing UI components; an unknown or foreign id calls `notFound()`.
5. `/settings`: the form posts to a Server Action -> `validateOrgSettings` (door 3, pure domain) -> `OrgSettingsStore.save` (door 1) -> the adapter updates `org_settings` under RLS -> the action returns form state and the page re-reads.
6. out: HTML; an unexpected read error reaches `app/(app)/error.tsx`, a missing record reaches `not-found.tsx` (both placement).

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: **primary contact** - a customer's earliest contact by `created_at`, ties by name; used only on the Customers list (no column marks a primary contact today) |
| domain | new term: **deal age** - whole days from `agreements.updated_at` to `Clock.now()`; `updated_at` moves only on a status transition (the RPC sets it), so it means "days since the last status change". Nothing branches on it yet |
| domain | existing term: pipeline card `meta` was free text ("Sent 9 days ago"); it becomes `<number> · v<n>` plus a separate age line. Only `PipelineView`, `KanbanCard` and `lib/sample-pipeline.ts` read it |
| stored data | `supabase/seed.sql` gains demo agreements, one version each, service lines and contracts for the 12 demo sites so the board has something to show. Re-running changes nothing (`on conflict do nothing`, fixed ids, AD-009). The live demo org gets them only when the user runs the seed (action needs their go-ahead). No migration, no existing row changes |
| files removed | `web/lib/sample-pipeline.ts`; the "Sample data" badge on `/pipeline` |
| navigation | `MAIN_NAV` "Customers" and `FOOTER_NAV` "Settings" gain an `href`; "Agreements", "Sites & equipment", "Imports", "Task library" stay disabled (no page) |
| composition | `getContainer()` gains the read ports and the settings store; its return type grows, so every `Container` consumer keeps compiling |
| UI | new `Select` (native `<select>`, same label and field-error contract as `TextInput`); `DESIGN.md` "Deferred: Select" is replaced and the ROADMAP `Select` line is ticked |
| decisions | doors 1, 2 and 4 reach past this feature, so each gets an `AD-NNN` in `.specs/STATE.md` |
| docs | `CONTEXT.md` entries for Tenant, Company profile, Customer, Contact, Site, Asset, Pipeline and Design system, plus a Build log line |

## Relations

None - no stored-data shape change. Every screen reads the existing `customers`, `contacts`,
`sites`, `assets`, `asset_types`, `agreements`, `agreement_versions`, `service_lines`, `contracts`
and `org_settings` tables; only `org_settings` is written, and only by update.

## Surface

Only routes this adds or whose behaviour changes.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /pipeline` | session cookies | the five-stage board built from the member's org | `200`; `307` -> `/login` (signed out) |
| `GET /customers` | session cookies | customer list | `200`; `307` -> `/login` |
| `GET /customers/[customerId]` | `customerId` | customer, contacts, sites, agreements | `200`; `404` (not a uuid, not found, or another org's); `307` -> `/login` |
| `GET /sites/[siteId]` | `siteId` | site, customer link, equipment register | `200`; `404`; `307` -> `/login` |
| `GET /settings` | session cookies | company settings form | `200`; `307` -> `/login` |
| `POST /settings` (Server Action `saveSettings`) | the form fields | form state `saved` · `invalid` with per-field messages · `forbidden` · `unavailable` | `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. the read-port pattern (every later list and detail page copies it) | one narrow port per screen in `web/application/ports`: `PipelineReader.board()`, `CustomerDirectory.list()` / `.detail(id)`, `SiteRegister.get(id)` and `OrgSettingsStore.get()` / `.save(input)`. Each returns plain view types (no Supabase types), `null` for a missing record, and throws on unexpected errors. Adapters live in `web/infrastructure/supabase`, use PostgREST embedded selects, and read at most 500 rows per list (`.limit(500)`). Pages get them only from `getContainer()` | pages or components querying Supabase - AD-014 forbids `@supabase/*` in `app/`; one `Repository` with every read - AGENTS.md ISP, and the next screen would widen it for callers that never use the rest; SQL views per screen - a migration for every layout change |
| 2. the URL shape (links, emails and import jobs will point at it) | `/customers`, `/customers/[customerId]`, `/sites/[siteId]`, `/settings`, with uuid ids. A site page is not nested under its customer | `/customers/[id]/sites/[id]` - an agreement, an import job or a "Sites & equipment" list must link to a site without knowing its customer; slugs - customer names are not unique per org |
| 3. how a single-row write is shaped (the precedent for customer, site and asset forms) | a Server Action reads `FormData`, calls a pure `validateOrgSettings(input)` in `web/domain/org-settings` returning `{ ok: true, value } \| { ok: false, errors: Record<field, message> }`, then calls the store port; the adapter runs `update(...).eq("org_id", orgId).select()` under RLS and maps an empty result to `forbidden`. No RPC | an RPC per form - AD-015's RPC exists for multi-statement transitions; one update is already atomic; validating only in the browser or only in the database check - the form needs field messages and the check constraint reports one failure at a time |
| 4. how a province is stored | `org_settings.governing_province` holds the two-letter code: `AB BC MB NB NL NS NT NU ON PE QC SK YT`. The list lives in `web/domain/org-settings` and feeds the `Select` | full names - the seed already stores `BC`, and the contract generator will print the code; free text - the contract text names the province, so a typo ships in a legal document |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Every screen reads the member's org safely (P1)

The behaviour shared by all five screens.

**Acceptance Criteria**

1. The system SHALL read every screen's data through `getContainer()` as the signed-in member, so no screen shows a row of another org.
2. WHILE a screen's data is loading the system SHALL show the page header and a content area with `role="status"` and the text "Loading…".
3. IF a read throws an unexpected error THEN the system SHALL show "Something went wrong" with a "Try again" button that re-renders the segment, and SHALL log the error digest on the server.
4. IF `customerId` or `siteId` is not a uuid, names no row, or names a row of another org THEN the system SHALL respond `404` with the page "Not found" and a link back to the list, and SHALL NOT tell the three cases apart.
5. The system SHALL build with `next build` without a Cache Components request-data error on any of the five routes (AD-022).
6. The system SHALL NOT scroll the page horizontally at 375, 768 and 1440 px on any of the five screens.

**Independent test:** open each route as the demo owner, then as a member of a second org.

### S2: The pipeline shows the org's real agreements (P1)

**Acceptance Criteria**

7. WHEN a member opens `/pipeline` THEN the system SHALL show one card per agreement of their org whose `pipelineStage(status, contractStatus)` is not `null`, in the column of that stage.
8. IF an agreement is `withdrawn`, or its contract is `voided`, THEN the system SHALL NOT show it on the board.
9. The system SHALL show on each column header the number of its cards and the sum of their annual amounts as `formatCad(total)` followed by `/yr`.
10. The system SHALL show on each card the customer name, `<number> · v<versionNo>` (or `Unnumbered · v<versionNo>` when `number` is null), and the age as "Updated today" for 0 days or "Updated N days ago" for N >= 1, where N is the whole days from `updated_at` to `Clock.now()`.
11. The system SHALL compute a card's annual amount as `sumCents` of `lineAnnualCents(visits_per_year, cost_per_visit_cents)` over the service lines of the agreement's highest `version_no`, and its visits as the highest `visits_per_year` among those lines.
12. IF an agreement's latest version has no service lines THEN the system SHALL show the card without visits and amount, and count it as 0 in its column total.
13. WHERE an agreement is `changes_requested` the system SHALL show the attention pill "Changes requested", and WHERE its contract is `client_signed` the pill "Awaiting countersignature".
14. IF the org has no agreements THEN the system SHALL show the empty panel "No agreements yet" with the text "Agreements you create appear here by stage." and SHALL keep "New agreement" disabled.
15. The system SHALL NOT show the "Sample data" badge, and SHALL NOT import `lib/sample-pipeline`.

**Independent test:** run the extended seed, open `/pipeline`, compare each column to the seeded rows.

### S3: The customers list (P1)

**Acceptance Criteria**

16. WHEN a member opens `/customers` THEN the system SHALL list the org's customers ordered by name, case-insensitive ascending, each with its primary contact's name, its number of sites and its number of assets, and the name SHALL link to `/customers/<id>`.
17. IF a customer has no contact THEN the system SHALL show "-" as its primary contact.
18. The system SHALL show the total as a neutral badge in the header, "12 customers" or "1 customer".
19. WHEN the member types in the search field THEN the system SHALL keep the customers whose name or primary contact name contains the text, case-insensitively, after trimming.
20. IF no customer matches the search THEN the system SHALL show `No customers match "<text>"` and a "Clear search" button that empties the field and focuses it.
21. IF the org has no customers THEN the system SHALL show the empty panel "No customers yet" with the text "Customers appear here once they are added or imported." and no action button.

**Independent test:** open the list with the demo seed, search for "dana" and for "zzz".

### S4: The customer detail (P2)

**Acceptance Criteria**

22. WHEN a member opens `/customers/<id>` THEN the system SHALL show the customer name as the title, a "Customers" link back, and three sections: Contacts, Sites and Agreements.
23. The system SHALL show each contact's name, its email as a `mailto:` link and its phone as a `tel:` link, and "-" for a missing value.
24. The system SHALL show each site's name as a link to `/sites/<id>`, its address, its site contact's name and its asset count.
25. The system SHALL show each agreement of the customer's sites with its site name, `<number> · v<versionNo>`, its `StatusPill` stage and its annual amount, as in AC 10-11.
26. IF a section has no rows THEN the system SHALL show its own empty line: "No contacts yet", "No sites yet" or "No agreements yet".

**Independent test:** open Harbourview Towers Strata from the demo seed.

### S5: The site equipment register (P2)

**Acceptance Criteria**

27. WHEN a member opens `/sites/<id>` THEN the system SHALL show the site name as the title, the address, a link to its customer, its site contact, and the total as a neutral badge ("5 assets" or "1 asset").
28. The system SHALL group the site's assets by asset type, order the groups by type name, show each group header as `<code> - <name>` with its count, and order the rows by `unit_no` with numeric-aware comparison (`B-2` before `B-10`), rows without a unit last.
29. The system SHALL show on each row the unit, type/model, location/access and the source as "Manual" or "Imported", and "-" for a missing value.
30. WHEN the member types in the search field THEN the system SHALL keep the rows whose unit, type/model, location or type name contains the text, case-insensitively, and hide groups left empty.
31. IF no row matches the search THEN the system SHALL show `No equipment matches "<text>"` and a "Clear search" button.
32. IF the site has no assets THEN the system SHALL show the empty panel "No equipment recorded yet" with the text "Equipment appears here once it is added or imported."

**Independent test:** open a demo site with several asset types and search by a location.

### S6: Company settings, and the Select control (P1)

**Acceptance Criteria**

33. WHEN a member opens `/settings` THEN the system SHALL show the org's legal name, address, phone, accent colour, repair discount %, CPI cap %, cancellation notice days, payment days, governing province and tax note, each with a visible label and its current value.
34. The system SHALL show percentages with at most two decimals and no trailing zeros ("10", "5.5"), and a null number as an empty field.
35. WHILE the member's role is `owner` or `admin` the system SHALL make the fields editable and show a "Save changes" button.
36. WHILE the member's role is `estimator` or `viewer` the system SHALL make the fields read-only, show "Only owners and admins can edit company settings." and show no Save button.
37. IF the org has no `org_settings` row THEN the system SHALL show "Company settings have not been set up for this workspace." and no form.
38. IF a field is invalid THEN the system SHALL show a message under that field, mark it `aria-invalid`, write nothing, and keep every value the member typed. The rules are: legal name 1-120 characters after trimming; address up to 300; phone up to 40; accent colour empty or `#rrggbb` (case-insensitive, stored lowercase); the two percentages decimal numbers from 0 to 100 with at most two decimals, and not empty; the two day counts empty or integers from 0 to 365; province empty or one of the codes in door 4; tax note up to 500.
39. WHEN the member saves valid values THEN the system SHALL trim text, store empty text as null, update the `org_settings` row with `updated_at = Clock.now()`, and show "Settings saved".
40. IF the update changes no row because RLS refuses it THEN the system SHALL show "You don't have permission to change company settings." and keep the typed values.
41. IF the update fails for any other reason THEN the system SHALL show "We couldn't save your settings. Try again.", keep the typed values and log the error code on the server.
42. WHILE the save is in flight the system SHALL disable the Save button and show "Saving…".
43. The `Select` control SHALL render a visible label, a native `<select>`, 44px height below 1024px and 34px above, and, with an error, a Danger border, a message under it, `aria-invalid` and `aria-describedby`, as `TextInput` does.

**Independent test:** save the demo org's settings as the owner, then open `/settings` as a viewer.

## Out of scope

| Excluded | Why |
| --- | --- |
| Creating, editing or deleting customers, contacts, sites and assets | no roadmap item covers manual entry (see open question 1); every list here is read-only, and Phase 2's import is the first writer of assets |
| Logo upload and preview | needs Storage buckets, which M15 delivers; `logo_path` is not shown or written |
| "Not viewed" and "Viewed" on pipeline cards | needs the portal's `agreement.viewed` event (Phase 3) |
| Drag-and-drop between stages, stage filters, deal-age sorting | the status engine is the only mover (AD-015); the board stays a view |
| Pagination and server-side search | the demo org has 12 customers; lists read at most 500 rows (door 1) |
| An Agreements list page, a Sites list page, an org switcher | no roadmap item; their nav entries stay disabled |
| The "New agreement" action | Phase 3 builder |
| Accent contrast fallback to Ink | binds the first customer-facing surface, not this staff screen |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Several settings writers at once | last write wins; no version check | one row per org, edited rarely by two roles | n |
| What a card's "visits" means with several service lines | the highest `visits_per_year` among the lines | the card has one slot; the sum would overstate visits | n |
| Shell title after a legal-name change | the shell keeps showing `orgs.name`; `legal_name` is branding only | two different columns today, and merging them is an onboarding decision (Phase 5) | n |
| Wide tables on mobile | rows reflow into stacked blocks below 768px, no table scroll | AC 6 forbids page scroll and DESIGN.md keeps controls at 44px | n |
| Demo agreements | the seed adds one agreement per demo site, mirroring the twelve sample cards, each with 1-3 service lines; two have contracts (`client_signed`, `completed`) | the board needs every stage populated to be reviewed | n |
| Tax note input | a single-line `TextInput` | the seed value is one sentence | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | Nothing in the roadmap lets staff add a customer, site or asset by hand (M3, M4 "source: manual"); Phase 2 only imports assets. Add a "Customer, site and asset forms" item to Phase 1? Recommended: yes, as the item right after this one | the lists stay read-only and the empty panels say "added or imported" |

## Observable

Worksheet, not the review. The nine system dimensions are swept in `checks.md`.

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/pipeline` | empty state | AC 14 |
| screen `/pipeline` | loading state | AC 2 |
| screen `/pipeline` | error state | AC 3 |
| screen `/pipeline` | unauthorised | existing - `MemberGate` redirects signed-out visitors (auth-magic-link AC 13) |
| screen `/pipeline` | density and ordering | AC 7, 9 (stage order is AD-001); cards keep their `Updated` age line |
| screen `/pipeline` | destructive action confirms | n/a - the board has no destructive action |
| screen `/customers` | empty state | AC 21 |
| screen `/customers` | loading, error | AC 2, 3 |
| screen `/customers` | unauthorised | existing - `MemberGate`; viewers may read (RLS select for every member) |
| screen `/customers` | density and ordering | AC 16 |
| screen `/customers` | destructive action confirms | n/a - read-only list |
| screen `/customers/[customerId]` | empty states | AC 26 |
| screen `/customers/[customerId]` | loading, error, not found | AC 2, 3, 4 |
| screen `/customers/[customerId]` | unauthorised | existing - `MemberGate`; another org's id gives `404` (AC 4) |
| screen `/customers/[customerId]` | density and ordering | AC 22-25 (contacts and sites in database order by `created_at`, agreements by `updated_at` descending) |
| screen `/customers/[customerId]` | destructive action confirms | n/a - read-only |
| screen `/sites/[siteId]` | empty state | AC 32 |
| screen `/sites/[siteId]` | loading, error, not found | AC 2, 3, 4 |
| screen `/sites/[siteId]` | unauthorised | existing - `MemberGate`; another org's id gives `404` |
| screen `/sites/[siteId]` | density and ordering | AC 28 |
| screen `/sites/[siteId]` | destructive action confirms | n/a - read-only |
| screen `/settings` | empty state | AC 37 |
| screen `/settings` | loading, error | AC 2, 3 |
| screen `/settings` | unauthorised | AC 36 (read-only) and AC 40 (RLS refusal) |
| screen `/settings` | density and ordering | AC 33 (identity, then contact, then terms, in the order the proposal template prints them) |
| screen `/settings` | destructive action confirms | n/a - saving is an edit, not a delete; nothing is removed |
| Server Action `POST /settings` | error shape and codes | AC 38, 40, 41 (`invalid`, `forbidden`, `unavailable`) |
| Server Action `POST /settings` | versioning, rate limits | n/a - an internal form action behind a session; no external caller |

## Sources

- ROADMAP.md Phase 1 item 6 and the `Select` item - the five screens and the control
- DESIGN.md (binding for tokens, layout, pill and input rules) and PRODUCT.md - plain trade language, 44px touch targets
- CONTEXT.md "Company profile and default terms", "Pipeline / status engine" - the default terms list and the "Not built yet: real data, deal age"
