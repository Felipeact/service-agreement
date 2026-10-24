# Staff screens on real data: pipeline, customers, customer detail, site register, company settings - checks

Profile: light
Plan: `.specs/features/staff-screens/plan.md`

63 checks in 6 slices · 4 one-way doors · 1 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C101:`). This
  feature numbers from C101 because earlier features already own `C1:`-`C34:` test names and
  `-t "C1:"` would match them too. React output is asserted with `renderToStaticMarkup` from
  `react-dom/server`; Supabase is a stubbed client that records its calls (as in
  `infrastructure/supabase/repositories.test.ts`); `@/composition`, `next/navigation` and
  `next/headers` are mocked where a page, route or action is called directly. A server-only
  page is tested through the plain view it renders.
- **seed** - `seed supabase/tests/staff_screens.sql#C<n>` is one MCP `execute_sql` call: the text of
  `supabase/tests/fixture.sql`, then the block of `supabase/tests/staff_screens.sql` marked for that
  check. A block that needs the demo data runs the **body** of `supabase/seed.sql` (the file
  without its first line `begin;` and its last line `commit;`) where it says so, on the
  database fixture state (no demo org). Each run ends in `rollback` and returns `staff_screens: pass`.
- **shell** - a command run from the repo root or `web/` that passes when it exits 0.
- **live** - a real browser on `npm run dev` (`http://localhost:3000`) through the Playwright MCP,
  signed in as the demo owner after the auth item's dashboard steps. Not committed (AGENTS..md).
  The live data is the demo org after the user runs the extended `seed.sql` (a production-data
  action that waits for their go-ahead).

Contract used by C109-C116: an agreement's contract is the one attached to its highest
`version_no`; "latest version" always means that version.

## Checks

### S1 - Every screen reads the member's org safely · 14 files · ~35 KB · ~9k

**C101** - read through the member's session only: `getContainer()` exposes `pipelineBoard`,
`listCustomers`, `customerDetail`, `siteRegister`, `getOrgSettings` and `saveOrgSettings`; no file
under `web/app/(app)` or `web/components` imports `@supabase/*` or `@/infrastructure`; and, as a
member of org B in SQL, the embedded-select shapes the readers use (customers with contacts and
sites, sites with assets and asset types, agreements with versions, service lines and contracts,
`org_settings`) return 0 rows of org A's demo data (AC 1, 4, door 1)
Proof: `npx vitest run composition boundaries -t "C101:"`
Proof: `seed supabase/tests/staff_screens.sql#C101`

**C102** - the loading state of each of `/pipeline`, `/customers`, `/customers/[customerId]`,
`/sites/[siteId]` and `/settings` renders a page header titled "Pipeline", "Customers", "Customer",
"Site" and "Settings", and an element with `role="status"` containing "Loading…" (AC 2)
Proof: `npx vitest run "app/(app)" -t "C102:"`

**C103** - the error boundary renders "Something went wrong" and a "Try again" button whose
`onClick` calls the `reset` prop once; and live, with `NEXT_PUBLIC_SUPABASE_URL` pointed at an
unreachable host, opening `/customers` shows "Something went wrong" and the dev server's output
contains a `digest` for that error (AC 3)
Proof: `npx vitest run "app/(app)" -t "C103:"`
Proof: live - restart `npm run dev` with the bad URL, open `/customers`, read the page and the server log

**C104** - `customerDetail("not-a-uuid")` and `siteRegister("not-a-uuid")` return `null` and make
0 calls to the stubbed client; both return `null` when the stub answers with no row; and a reader
that gets an unexpected error from the stub (code `XX000`) throws instead of returning `null` (AC 4, door 1)
Proof: `npx vitest run infrastructure/supabase -t "C104:"`

**C105** - the customer and site pages call `notFound()` when their reader returns `null`, and do
not when it returns a record; the not-found page contains "Not found" and a link to `/customers`;
and live, signed in, `GET /customers/not-a-uuid` and `GET /sites/00000000-0000-4000-8000-000000000000`
each answer 404 with the same page (AC 4)
Proof: `npx vitest run "app/(app)" -t "C105:"`
Proof: live - `browser_navigate` to both URLs, read `browser_network_requests`

**C106** - `next build` in `web/` exits 0, and its route table lists `/pipeline`, `/customers`,
`/customers/[customerId]`, `/sites/[siteId]` and `/settings` and no route matching
`/customers/[customerId]/sites` (AC 5, door 2)
Proof: `cd web && npx next build` and `grep -E "^[├└┌] .* /customers/\[customerId\]" ` on its output returns the line; `grep -c "customerId\]/sites"` returns 0

**C107** - live, at 375, 768 and 1440 px wide, on each of the five screens with the demo data,
`document.documentElement.scrollWidth` is at most `window.innerWidth` (AC 6)
Proof: live - `browser_resize` then `browser_evaluate` for each of the 15 combinations

**C108** - a signed-out `updateSession` responds `307` with `Location` path `/login` for each of
`/pipeline`, `/customers`, `/customers/00000000-0000-4000-8000-000000000001`,
`/sites/00000000-0000-4000-8000-000000000002` and `/settings` (Surface `307`)
Proof: `npx vitest run infrastructure/supabase -t "C108:"`

**C109** - live, signed in as the demo owner, `/pipeline`, `/customers`, a demo customer's page, a
demo site's page and `/settings` each answer 200 (Surface `200`)
Proof: live - `browser_navigate` to each, read `browser_network_requests`

### S2 - The pipeline shows the org's real agreements · 9 files · ~28 KB · ~7k

**C110** - `pipelineBoard()` over a stub returning nine agreements with a stage-deciding status maps
each to its column: `draft` -> `in_progress`; `changes_requested` -> `in_progress`; `sent` -> `sent`;
`accepted` with no contract -> `accepted`; `accepted` with a `pending_signature` contract -> `accepted`;
`accepted` with a `client_signed` contract -> `accepted`; `accepted` with a `completed` contract ->
`completed`; `refused` -> `refused`; `expired` -> `refused`; and `accepted` with a `declined`
contract -> `refused` (AC 7)
Proof: `npx vitest run infrastructure/supabase -t "C110:"`

**C111** - `pipelineBoard()` returns no card for an agreement with status `withdrawn`, and none for
an `accepted` agreement whose contract is `voided` (AC 8)
Proof: `npx vitest run infrastructure/supabase -t "C111:"`

**C112** - `PipelineView` rendered with two `in_progress` cards of 1428050 and 2160000 cents shows,
in the "In progress" column header, the count 2 and the text `$35,880.50/yr`, and a column with no
cards shows its count 0 and no total (AC 9)
Proof: `npx vitest run components/kanban -t "C112:"`

**C113** - a card with customer "Harbourview Towers Strata", number "AG-1048", version 3 and age 9
days renders "AG-1048 · v3" and "Updated 9 days ago"; with age 1 it renders "Updated 1 day ago"
(the singular reads the plan's "N days ago" for N = 1); with age 0 it renders "Updated today"; with
number `null` and version 2 it renders "Unnumbered · v2" (AC 10)
Proof: `npx vitest run components/kanban -t "C113:"`

**C114** - with `fixedClock(2026-10-24T12:00:00Z)`, `pipelineBoard()` gives age 9 for
`updated_at` 2026-10-15T09:00:00Z, age 0 for 2026-10-23T12:00:01Z (23 h 59 min 59 s), age 1 for
2026-10-23T12:00:00Z (exactly 24 h), and age 0 for a future `updated_at` 2026-10-25T00:00:00Z (AC 10)
Proof: `npx vitest run infrastructure/supabase -t "C114:"`

**C115** - for an agreement whose version 2 has service lines (4 visits at 100000 cents) and
(2 visits at 50000 cents), and whose version 1 has one line (12 visits at 999999 cents),
`pipelineBoard()` returns annual 500000 cents and visits 4, using version 2 only (AC 11)
Proof: `npx vitest run infrastructure/supabase -t "C115:"`

**C116** - an agreement whose latest version has no service lines yields a card with `visitsPerYear`
and `annualCents` undefined, and the board's column for it totals `$4,000/yr` when another card in
that column has one line of 4 visits at 100000 cents (AC 12)
Proof: `npx vitest run infrastructure/supabase -t "C116:"`
Proof: `npx vitest run components/kanban -t "C116:"`

**C117** - a `changes_requested` agreement yields the attention label "Changes requested"; an
`accepted` agreement with a `client_signed` contract yields "Awaiting countersignature"; `draft`,
`sent`, and `accepted` with a `pending_signature` contract yield none; and the view renders each label as an
attention pill (AC 13)
Proof: `npx vitest run infrastructure/supabase -t "C117:"`
Proof: `npx vitest run components/kanban -t "C117:"`

**C118** - `PipelineView` rendered with no cards contains "No agreements yet" and "Agreements you
create appear here by stage.", has the "New agreement" button disabled, and does not contain
"No agreements match" (AC 14)
Proof: `npx vitest run components/kanban -t "C118:"`

**C119** - `PipelineView` markup contains no "Sample data"; `web/lib/sample-pipeline.ts` does not
exist; and no file under `web/` imports `lib/sample-pipeline` (AC 15)
Proof: `npx vitest run components/kanban -t "C119:"`
Proof: `grep -rn "sample-pipeline" web --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next` prints nothing

**C120** - starting from the fixture state (no demo org), the body of `supabase/seed.sql` adds 12
agreements (numbers `AG-1048`, `AG-1046`, `AG-1051`, `AG-1039`, `AG-1042`, `AG-1044`, `AG-1031`,
`AG-1035`, `AG-1022`, `AG-1019`, `AG-1027`, `AG-1029`), each with one version numbered 1; nine
service lines, one each, and none on `AG-1051`, `AG-1027` and `AG-1029`; and three contracts
(`client_signed` for `AG-1031`, `completed` for `AG-1022` and `AG-1019`); by `pipelineStage` they
fall 3 `in_progress`, 3 `sent`, 2 `accepted`, 2 `completed`, 2 `refused`; and running the body a
second time changes none of those counts (Impact: stored data). Settled before the build: the
plan's "two have contracts" could not give two `completed` agreements, so the seed has three.
Proof: `seed supabase/tests/staff_screens.sql#C120`

### S3 - The customers list · 7 files · ~22 KB · ~6k

**C121** - the customers view rendered with customers "bravo", "Alpha", "charlie" in that input
order lists Alpha, bravo, charlie; each name is a link whose `href` is `/customers/<id>`; and
`listCustomers()` orders by name case-insensitively (AC 16)
Proof: `npx vitest run components/customers -t "C121:"`

**C122** - `listCustomers()` over a stub with a customer having 2 sites (3 and 4 assets) returns
sites 2 and assets 7, and the view renders both numbers in that customer's row (AC 16)
Proof: `npx vitest run infrastructure/supabase -t "C122:"`

**C123** - `listCustomers()` returns as primary contact the contact with the earliest `created_at`,
and, for two contacts with the same `created_at`, the one with the lower name in `localeCompare`
order (AC 16, Impact: primary contact)
Proof: `npx vitest run infrastructure/supabase -t "C123:"`

**C124** - a customer with no contact renders "-" in the primary contact cell (AC 17)
Proof: `npx vitest run components/customers -t "C124:"`

**C125** - the header badge reads "12 customers" for 12 customers and "1 customer" for 1 (AC 18)
Proof: `npx vitest run components/customers -t "C125:"`

**C126** - `filterCustomers` over Harbourview Towers Strata (contact Dana Whitfield) and Pinecrest
Office Park (contact Marcus Ilunga) keeps Harbourview for "harbour", for "  DANA " and for
"HARBOURVIEW TOWERS STRATA", keeps Pinecrest for "marcus", keeps both for "" and "   ", and none for
"zzz"; and live, typing "dana" in the search field leaves one row (AC 19)
Proof: `npx vitest run components/customers -t "C126:"`
Proof: live - `browser_type` "dana" into the search field on `/customers`, count rows

**C127** - the list view with search text "zzz" contains `No customers match "zzz"` and a "Clear
search" button; and live, clicking it empties the field, shows all rows and focuses the field (AC 20)
Proof: `npx vitest run components/customers -t "C127:"`
Proof: live - search "zzz", click "Clear search", read the focused element

**C128** - the list view with no customers contains "No customers yet" and "Customers appear here
once they are added or imported." and no button (AC 21)
Proof: `npx vitest run components/customers -t "C128:"`

### S4 - The customer detail · 5 files · ~18 KB · ~5k

**C129** - the detail view rendered for "Harbourview Towers Strata" contains the title, a link
"Customers" to `/customers`, and the section headings "Contacts", "Sites" and "Agreements" (AC 22)
Proof: `npx vitest run components/customers -t "C129:"`

**C130** - a contact with email `dana.whitfield@example.com` and phone `604-555-0101` renders
`href="mailto:dana.whitfield@example.com"` and `href="tel:604-555-0101"`; a contact with neither
renders "-" twice (AC 23)
Proof: `npx vitest run components/customers -t "C130:"`

**C131** - a site "Harbourview Towers" with address "2150 Harbour Lane, North Vancouver, BC", site
contact "Dana Whitfield" and 5 assets renders its name as a link with `href` `/sites/<id>`, the
address, the contact name and the count 5 (AC 24)
Proof: `npx vitest run components/customers -t "C131:"`

**C132** - an agreement row renders the site name, "AG-1048 · v1", the `sent` stage label "Sent to
customer" and `$16,000/yr` for 4 visits at 400000 cents, and `customerDetail()` computes that
amount with the same rule as C115 (AC 25)
Proof: `npx vitest run components/customers -t "C132:"`
Proof: `npx vitest run infrastructure/supabase -t "C132:"`

**C133** - a customer with no contacts, no sites and no agreements renders "No contacts yet", "No
sites yet" and "No agreements yet" (AC 26)
Proof: `npx vitest run components/customers -t "C133:"`

**C134** - `customerDetail()` returns contacts and sites in `created_at` ascending order, and
agreements in `updated_at` descending order (Observable: ordering)
Proof: `npx vitest run infrastructure/supabase -t "C134:"`

### S5 - The site equipment register · 5 files · ~18 KB · ~5k

**C135** - the register view for site "Harbourview Towers" renders the title, the address, a link
to the customer with `href` `/customers/<id>`, the site contact name, and the badge "5 assets" for
5 assets and "1 asset" for 1 (AC 27)
Proof: `npx vitest run components/sites -t "C135:"`

**C136** - `groupAssets` over assets of types "Rooftop unit" (RTU), "Boiler" (BOILER) and
"Expansion tank" (EXPANSION_TANK) returns groups in the order Boiler, Expansion tank, Rooftop unit,
each with header text `<code> - <name>` and its row count (AC 28)
Proof: `npx vitest run components/sites -t "C136:"`

**C137** - `groupAssets` orders the rows of one group `B-1`, `B-2`, `B-10` for the input `B-10`,
`B-2`, `B-1`, and puts two rows without a unit last (AC 28)
Proof: `npx vitest run components/sites -t "C137:"`

**C138** - a row with unit `B-1`, type/model "Condensing boiler, 1,000 MBH", location "Mechanical
room P1" and source `manual` renders all three values and "Manual"; with source `import` it renders
"Imported"; a missing value renders "-" (AC 29)
Proof: `npx vitest run components/sites -t "C138:"`

**C139** - `filterAssets` keeps a row for text matching its unit ("b-2"), its type/model
("condensing"), its location ("MECHANICAL room") and its type name ("expansion"), each
case-insensitively, drops the rows that match none, and removes a group left with no rows; and
live, typing a location into the search field narrows the visible rows (AC 30)
Proof: `npx vitest run components/sites -t "C139:"`
Proof: live - `browser_type` a location into the search field on a demo site

**C140** - the register view with search text "zzz" contains `No equipment matches "zzz"` and a
"Clear search" button (AC 31)
Proof: `npx vitest run components/sites -t "C140:"`

**C141** - the register view for a site with no assets contains "No equipment recorded yet" and
"Equipment appears here once it is added or imported." (AC 32)
Proof: `npx vitest run components/sites -t "C141:"`

### S6 - Company settings and the Select control · 12 files · ~42 KB · ~11k

**C142** - the settings form rendered with the demo org's values shows ten visible labels - "Legal
name", "Address", "Phone", "Accent colour", "Repair discount (%)", "CPI cap (%)", "Cancellation
notice (days)", "Payment terms (days)", "Governing province", "Tax note" - each tied to a control
holding its value (`Kettle Ridge Mechanical Ltd.`, `100 Sample Street, Burnaby, BC V5A 0A0`,
`604-555-0100`, `#1f6f8b`, `10`, `5`, `30`, `30`, `BC`, `Prices exclude applicable taxes (GST and PST).`) (AC 33)
Proof: `npx vitest run components/settings -t "C142:"`

**C143** - the number formatter returns "10" for 10, "5.5" for 5.5, "5.25" for 5.25, "0" for 0, and ""
for a null day count (AC 34)
Proof: `npx vitest run domain/org-settings -t "C143:"`

**C144** - for role `owner` and for role `admin` the form's controls are not read-only or disabled and a
"Save changes" button is present (AC 35)
Proof: `npx vitest run components/settings -t "C144:"`

**C145** - for role `estimator` and for role `viewer` every control is read-only or disabled, the
text "Only owners and admins can edit company settings." is present, and no "Save changes" button
is present (AC 36)
Proof: `npx vitest run components/settings -t "C145:"`

**C146** - when `getOrgSettings()` returns `null` the settings view contains "Company settings have
not been set up for this workspace." and no form element; and `getOrgSettings()` returns `null`
when the stub answers with no row (AC 37)
Proof: `npx vitest run components/settings -t "C146:"`
Proof: `npx vitest run infrastructure/supabase -t "C146:"`

**C147** - `validateOrgSettings` returns the error for the named field for each rejected input and
the value for each accepted one: legal name `""`, `"   "` and 121 characters rejected, 120 accepted;
address 301 rejected, 300 and `""` accepted; phone 41 rejected, 40 accepted; accent `"1f6f8b"`,
`"#12345"` and `"#12345g"` rejected, `""` and `"#1F6F8B"` accepted (stored `#1f6f8b`); for both
percentages `"100.01"`, `"-0.01"`, `"5.123"`, `""` and `"abc"` rejected, `"0"` and `"100"` accepted;
for both day counts `"366"`, `"-1"` and `"1.5"` rejected, `""`, `"0"` and `"365"` accepted;
province `"XX"` and `"bc"` rejected, `""` and `"BC"` accepted; tax note 501 rejected, 500 accepted (AC 38)
Proof: `npx vitest run domain/org-settings -t "C147:"`

**C148** - the form rendered with state `invalid` and errors for `legal_name` and `cpi_cap_pct` shows
each message directly under its field, marks exactly those two controls `aria-invalid`, keeps
every typed value, and the `saveSettings` action given an invalid `FormData` makes 0 calls to
`saveOrgSettings` (AC 38, door 3)
Proof: `npx vitest run "app/(app)" components/settings -t "C148:"`

**C149** - `validateOrgSettings` given `"  Acme Ltd.  "` for legal name and `"   "` for address returns
legal name `"Acme Ltd."` and address `null`; `saveOrgSettings` over a stub calls `update` on
`org_settings` once with those values, `updated_at` equal to the fixed clock's ISO time and filter
`org_id = <the member's org>`, and calls `rpc` 0 times; the form rendered with state `saved`
contains "Settings saved" (AC 39, door 3)
Proof: `npx vitest run domain/org-settings infrastructure/supabase components/settings -t "C149:"`

**C150** - `saveOrgSettings` returns `{ ok: false, code: "forbidden" }` when the stubbed `update ...
select` returns no row and no error; the form rendered with state `forbidden` contains "You don't
have permission to change company settings." and keeps the typed values (AC 40)
Proof: `npx vitest run infrastructure/supabase components/settings -t "C150:"`

**C151** - `saveOrgSettings` returns `{ ok: false, code: "unavailable" }` and calls `console.error`
with a message containing the code when the stub returns an error with code `XX000`, and when it
rejects with `TypeError("fetch failed")`; the form rendered with state `unavailable` contains "We
couldn't save your settings. Try again." and keeps the typed values (AC 41)
Proof: `npx vitest run infrastructure/supabase components/settings -t "C151:"`

**C152** - the form rendered with `pending: true` has a disabled submit button reading "Saving…",
and with `pending: false` an enabled one reading "Save changes" (AC 42)
Proof: `npx vitest run components/settings -t "C152:"`

**C153** - `Select` rendered with label "Governing province" and no error has a `<label>` tied to a
`<select>`, no `aria-invalid`, and the same height classes as `TextInput`; rendered with an error
it has `aria-invalid="true"`, an `aria-describedby` equal to the id of a message under it, and the
`border-danger` class (AC 43)
Proof: `npx vitest run components/ui -t "C153:"`

**C154** - the province list holds exactly `AB`, `BC`, `MB`, `NB`, `NL`, `NS`, `NT`, `NU`, `ON`, `PE`,
`QC`, `SK`, `YT`, and the `Select` on the settings form renders those 13 options plus an empty one
(door 4)
Proof: `npx vitest run domain/org-settings components/settings -t "C154:"`

### Doors and impact · 6 files · ~25 KB · ~6k

**C155** - each list reader applies `.limit(500)` to its query: `listCustomers`, the assets query of
`siteRegister` and the agreements query of `pipelineBoard` (door 1)
Proof: `npx vitest run infrastructure/supabase -t "C155:"`

**C156** - `MAIN_NAV` gives "Customers" the `href` `/customers` and still gives "Agreements",
"Sites & equipment", "Imports" and "Task library" none, and "Pipeline" keeps `/pipeline`;
`FOOTER_NAV` gives "Settings" the `href` `/settings` (Impact: navigation)
Proof: `npx vitest run components/shell -t "C156:"`

**C157** - `ROADMAP.md` shows `- [x]` on the "Screens built to DESIGN.md" line and on the "Form
control `Select`" line (docs)
Proof: `grep -c -E "^- \[x\] (Screens built to DESIGN.md|Form control \`Select\`)" ROADMAP.md` prints 2

**C158** - `.specs/STATE.md` has three new rows `AD-023`, `AD-024`, `AD-025`, each `active`, for
doors 1, 2 and 4 (Impact: decisions)
Proof: `grep -c -E "^\| AD-02[345] \|.*\| active \|" .specs/STATE.md` prints 3

**C159** - `CONTEXT.md` has a Build log line linking `.specs/features/staff-screens/`, and its
Customer, Site, Asset, Company profile and Pipeline entries no longer say "No screen yet" or "Not
built yet: real data"; `DESIGN.md` no longer contains "Select is built with the Phase 1" and
documents `Select` under Inputs / Fields (docs)
Proof: `grep -c "staff-screens" CONTEXT.md` prints at least 1; `grep -c -E "No screen yet|Not built yet: real data" CONTEXT.md` prints 0; `grep -c "Select is built with the Phase 1" DESIGN.md` prints 0

**C160** - live, on the five screens at 375 and 768 px wide, every link, button, input and select the
page shows has a bounding box at least 44 px high, and every control responds to a tap; no control
depends on hover (Playwright rule, DESIGN.md)
Proof: live - `browser_resize`, `browser_evaluate` over interactive elements, `browser_click`

**C161** - live, on the five screens at 375, 768 and 1440 px, `browser_console_messages` shows no
error or warning and `browser_network_requests` shows no failed request (Playwright rule)
Proof: live - read both after loading each screen

**C162** - after the build, `get_advisors` with type `security` reports no lint that was not
reported before it (this feature adds no migration; the seed adds only rows)
Proof: `mcp get_advisors(type: "security")` - same lint names as before the build

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /pipeline` statuses (2) | `200` C109 · `307` C108 | - |
| `GET /customers` statuses (2) | `200` C109 · `307` C108 | - |
| `GET /customers/[customerId]` statuses (3) | `200` C109 · `404` C105 · `307` C108 | - |
| `GET /sites/[siteId]` statuses (3) | `200` C109 · `404` C105 · `307` C108 | - |
| `GET /settings` statuses (2) | `200` C109 · `307` C108 | - |
| `POST /settings` form states (4) | `saved` C149 · `invalid` C148 · `forbidden` C150 · `unavailable` C151 | - |
| screen loading states (5) | C102, table-driven over all 5 | - |
| `404` causes (3) | not a uuid C104 · no row C104 · another org's C101 | - |
| agreement -> stage inputs (10) | C110, table-driven over all 10 | - |
| agreements off the board (2) | `withdrawn` C111 · `voided` contract C111 | - |
| card age edges (4) | 9 days C114 · 23 h 59 min 59 s C114 · exactly 24 h C114 · future C114 | - |
| card age labels (3) | N days C113 · 1 day C113 · today C113 | - |
| attention labels (3) | "Changes requested" C117 · "Awaiting countersignature" C117 · none C117 | - |
| card meta forms (2) | number C113 · unnumbered C113 | - |
| roles (4) | `owner` C144 · `admin` C144 · `estimator` C145 · `viewer` C145 | - |
| settings fields (10) | C142, table-driven over all 10 | - |
| number formats (5) | 10 C143 · 5.5 C143 · 5.25 C143 · 0 C143 · null C143 | - |
| settings validation inputs (33) | C147, table-driven over all 33 | - |
| provinces (13) | C154, table-driven over all 13 | - |
| empty states (7) | pipeline C118 · customers C128 · contacts C133 · sites C133 · agreements C133 · site register C141 · no settings row C146 | - |
| search no-match states (2) | customers C127 · site register C140 | - |
| navigation items (7) | Pipeline C156 · Customers C156 · Agreements C156 · Sites & equipment C156 · Imports C156 · Task library C156 · Settings C156 | - |
| lists with a row cap (3) | customers C155 · assets C155 · agreements C155 | - |
| doors (4) | 1 C101, C104, C155 · 2 C106 · 3 C148, C149 · 4 C154 | - |
| impact rows (6) | domain terms C113, C114, C123 · stored data C120 · files removed C119 · navigation C156 · composition C101 · docs C157, C158, C159 | - |

- Claims naming a status or a response: C105, C108, C109 and C103. C108 calls the real
  `updateSession`; C105 and C109 cross the real boundary live
- No other check claims more than the cases its proof exercises

## Swept

- validation: C147 (every field's bound), C104 (a non-uuid id)
- failure modes: C103 (unexpected read error), C151 (save fails), C150 (RLS refuses the save)
- idempotency: C120 (seed re-run adds nothing); a settings save is a full overwrite of one row, so repeating it leaves the same values (C149)
- authorization: C101 (another org's rows), C108 (signed out), C144, C145 (role decides editability), C150 (RLS has the last word)
- concurrency: n/a - the only write is one `org_settings` row edited rarely, and the plan's Assumptions record last write wins; no check
- data lifecycle: n/a - nothing is deleted or retained; the seed only adds rows (C120)
- dependency failure: C103 (Supabase unreachable on a read), C151 (Supabase unreachable on a write)
- state transitions: C110, C111, C117 (agreement and contract status -> board column, pill)
- observability: C103 (the server logs the error digest), C151 (the server logs the Supabase error code); no metric or tracing requirement

## Handoff

- S1-S6 and the doors touch about 40 new or changed files: `web/` sources and tests (~150 KB
  written), reading `composition/index.ts`, ports, `infrastructure/supabase`, `components/kanban`,
  `components/ui`, `components/shell`, `database.types.ts` and the existing tests (~100 KB), plus
  `supabase/seed.sql` and `fixture.sql` (~20 KB), a new `staff_screens.sql` (~8 KB), and edits to
  `CONTEXT.md`, `DESIGN.md`, `ROADMAP.md`, `STATE.md` (~66 KB read): about 345 KB, roughly 86k
  tokens, under the 150k budget - one builder
- The live proofs (C103, C105, C107, C109, C126, C127, C139, C160, C161) need the demo owner
  provisioned (auth item steps) and the extended seed run on the live project, which needs the
  user's go-ahead

- **Boundary:** C101-C106, C108, C110-C119, C121-C159 closed at `1c35d9d` (one builder; C157-C159 are the docs in the next commit). Not run: the live proofs (C103, C105 live half, C107, C109, C126, C127, C139 live halves, C160, C161) need the demo owner signed in; `seed supabase/tests/staff_screens.sql#C101` and `#C120` (and the changed `demo_seed.sql` C17) need an MCP `execute_sql` call on the live project, which was refused in the previous session; C106 passed (`next build` lists the five routes); C162 (advisors) waits for the seed run. A temporary preview route (removed) showed no horizontal scroll at 375, 768 and 1440 and no control under 44px below 1024px on the five screens
- **Settled mid-build:** C120 now says three contracts (the plan's "two" could not give two completed agreements); the singular "Updated 1 day ago" in C113; the settings reader and writer take the member's `orgId` (a user in several orgs would otherwise see all of them); `demo_seed.sql` C17 changed from 0 to 12 agreements, superseding the catalog-seed claim; 44px touch height added to in-row links after the preview probe found 15-20px links
- **Abandoned:** nothing

