# Design system base: tokens and base components

## Problem

The web app still renders the default `create-next-app` page ([web/app/page.tsx](../../../web/app/page.tsx)).
Every Phase 1 screen (dashboard, customers, customer detail, site asset register, company settings)
needs the same shell, controls and status language that [DESIGN.md](../../../DESIGN.md) describes,
and none of it exists in code. The first screen built would therefore pick its own hex values,
spacing and stage labels, the next screen would copy or diverge from it, and the two rules that
carry meaning ("Status Is Never Colour Alone", "Money Lines Up") would hold only where an author
remembered them.

DESIGN.md also marks its own values provisional ("until implementation tokens exist") and carries
a SEED marker. It cannot become the real system record until there is code to document. One of
its values already fails its own rule: Slate Secondary `#6b7280` measures **4.23:1** on Board Grey
`#eef0f3`, below the 4.5:1 that DESIGN.md requires for column counts on tinted wells.

The source gives no user-facing evidence beyond the roadmap ordering; this is foundation work
that Phase 1 screens depend on.

When this ships, a Phase 1 author composes a screen from a fixed token set and the base
components, the pipeline board is visible at `/pipeline` on sample data at all three screen
sizes, and DESIGN.md describes the code instead of a sketch.

## Flow

Reuses Tailwind 4's CSS-first `@theme` in `web/app/globals.css` as the single token source - no
second token object in TypeScript - and Next's `next/font/google` for Inter.

1. `web/app/globals.css` (exists) - scaffold variables and the dark-mode block are replaced by the
   DESIGN.md roles under `@theme` (door 1); every component reads tokens only through the
   generated utilities (`bg-ground`, `text-ink-2`, `rounded-control` ...)
2. `web/app/layout.tsx` (exists) - loads Inter in place of Geist, sets the body to Ground / Ink /
   13px, sets the product metadata title
3. `web/lib/pipeline-stage.ts` (door 2) - the five stage keys, mapped to label, short label and
   stage colour token
4. base components (new, no door - placement per conventions, hand-built per door 3) - Button,
   SearchInput, StatusPill, AppSidebar, PageHeader, KanbanColumn, KanbanCard
5. `web/app/(app)/pipeline/page.tsx` (new, no door - placement) - composes the header and board
   from a static fictitious fixture, inside the `(app)` route-group layout that wraps every product
   screen in the shell; `web/app/page.tsx` is deleted and `web/next.config.ts` (exists) redirects
   `/` to `/pipeline` with `permanent: false` (307)
6. out: `impeccable-documenter` (exists, `.claude/agents/`) reads the shipped code and rewrites
   `DESIGN.md` and writes `.impeccable/design.json`

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `PipelineStage` - the one board stage a deal shows at (`in_progress`, `sent`, `accepted`, `completed`, `refused`), lives in `web/lib/pipeline-stage.ts` until the Phase 1 domain layer takes ownership of the same keys (AD-001) |
| domain | existing term: "Slate Secondary" meant `#6b7280`, now means `#646b78` (4.70:1 on Board Grey, 5.36:1 on white) - only DESIGN.md and the mocks reference it today; no code branches on it |
| web scaffold | the default page, Geist fonts, the `prefers-color-scheme: dark` block and the Next/Vercel SVGs in `web/public/` are removed; nothing references them besides the default page |
| repo | `web/` was its own git repo with no remote, recorded as a gitlink. The feature's code landed there (`web@4d293fa`), then `web/` was merged into this repo with its history at `c41da9a` so it can be pushed; `.playwright-mcp/` captures are now ignored |
| docs | DESIGN.md loses its SEED marker and is regenerated from code; CONTEXT.md M17 entry and Build log updated; ROADMAP Phase 0.5 items 4 and 5 ticked |
| stored data | nothing to migrate - no database exists yet |

## Relations

None - no stored-data shape change

## Surface

Only routes this adds or whose signature changes.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /` | nothing | redirect to `/pipeline` | `307` |
| `GET /pipeline` | nothing (search is client-side state, not a query param) | HTML: shell, header, board on sample data | `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. token names (every later screen copies them) | `@theme` roles: `--color-ground` `--color-surface` `--color-board` `--color-hairline` `--color-ink` `--color-ink-2` `--color-ink-nav` `--color-action` `--color-action-tint` `--color-stage-in-progress` `--color-stage-sent` `--color-stage-accepted` `--color-stage-completed` `--color-stage-refused` `--color-attention-bg` `--color-attention-fg`, `--radius-control: 6px`, `--radius-panel: 8px`, `--shadow-card: 0 1px 2px rgba(17,24,39,.08)`, `--font-sans: Inter` | Tailwind default palette classes in components (`bg-gray-50`, `text-blue-600`) - they name a hue, not a role, so swapping in the tenant accent on customer-facing surfaces or changing one value touches every file |
| 2. pipeline stage keys (Phase 1 domain, filters and any future URL param bind to them) | `type PipelineStage = "in_progress" \| "sent" \| "accepted" \| "completed" \| "refused"`, ordered as listed | reusing agreement statuses (`draft`, `sent` ...) - the `accepted` stage spans an accepted agreement **and** a contract in `pending_signature` or `client_signed`, which one status enum cannot express |
| 3. no component library - base components hand-built on native `<button>`, `<input>`, `<select>`, `<a>` | no new runtime dependency in `web/package.json` | shadcn/ui + Radix - brings its own role names (`--primary`, `--muted`, `--card`) as a second scheme beside door 1, and native elements already cover these controls |

- Nothing else in this change is hard to reverse

## Criteria

Breakpoints used below: **mobile** < 768px, **tablet** 768-1023px, **desktop** >= 1024px.

### S1: Tokens and type (P1)

The token set exists with DESIGN.md's values, and nothing in the components bypasses it.

**Acceptance Criteria**

1. The system SHALL define in `web/app/globals.css` `@theme` exactly these values: ground `#f6f7f9`, surface `#ffffff`, board `#eef0f3`, hairline `#e5e7eb`, ink `#111827`, ink-2 `#646b78`, ink-nav `#374151`, action `#2563eb`, action-tint `#eef2ff`, stage in-progress `#2563eb`, sent `#f59e0b`, accepted `#8b5cf6`, completed `#10b981`, refused `#ef4444`, attention-bg `#fef3c7`, attention-fg `#92400e`
2. The system SHALL render `body` in Inter at 13px with line-height 1.45, colour ink `#111827` on background ground `#f6f7f9`
3. The system SHALL contain no hex colour literal and no Tailwind default-palette colour class (`slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose`-`<n>`) in any `.tsx` file under `web/app`, `web/components` or `web/lib`
4. The system SHALL render every money amount and every count with `font-variant-numeric: tabular-nums`
5. The system SHALL format money from integer cents in CAD as `$` plus en-CA thousands separators, with no decimals for whole dollars and two decimals otherwise (`1428000` -> `$14,280`, `1428050` -> `$14,280.50`, `0` -> `$0`)

**Independent test:** open `/pipeline` and read the computed styles of `body` and a card amount; run the colour-literal grep over `web/`.

### S2: App shell (P1)

A familiar sidebar and page header, usable from 375px to 1440px.

**Acceptance Criteria**

6. The sidebar SHALL show the product name "Service Agreement" and the nav items in this order: Pipeline, Agreements, Customers, Sites & equipment, Imports, Task library, with Settings separated at the bottom
7. WHEN the current route is a nav item's route THEN that item SHALL render with background action-tint `#eef2ff`, text action `#2563eb` and `aria-current="page"`
8. IF a nav item's route has no page yet (every item except Pipeline in this change) THEN the item SHALL render with `aria-disabled="true"`, no `href`, and SHALL not navigate when activated
9. WHILE the viewport is desktop the sidebar SHALL be visible, 232px wide, beside the work area
10. WHILE the viewport is mobile or tablet the sidebar SHALL be hidden and a top bar SHALL show a menu button of at least 44x44px labelled "Open navigation"
11. WHEN the menu button is activated THEN the sidebar SHALL open as a drawer over the page with focus moved into it
12. WHEN the drawer is open and Escape is pressed, the backdrop is tapped, or a nav link is activated THEN the drawer SHALL close and focus SHALL return to the menu button
13. The page header SHALL render exactly one `h1` with the page title, a controls slot, and at most one primary action
14. WHILE the viewport is mobile the header controls SHALL wrap below the title, and the page SHALL have no horizontal scroll (`document.documentElement.scrollWidth` equals `clientWidth`)

**Independent test:** open `/pipeline` at 375, 768 and 1440 wide; open and close the drawer by tap and by Escape.

### S3: Controls and status pill (P1)

Buttons, the search input and pills that every later list reuses.

**Acceptance Criteria**

15. The Button SHALL offer `primary` (action background, white text) and `secondary` (surface background, 1px hairline border, ink text) variants, 34px tall on desktop and at least 44px tall on mobile and tablet
16. WHEN any button, input or nav link receives keyboard focus THEN it SHALL show a 2px action-colour focus ring that is not shown on pointer click (`:focus-visible`)
17. IF a Button is `disabled` THEN it SHALL set the native `disabled` attribute and SHALL not invoke its click handler
18. The SearchInput component SHALL render a 1px hairline border, radius 6px, ink-2 placeholder, 34px tall on desktop and at least 44px on mobile and tablet, and SHALL have an accessible name (a `<label>` or `aria-label`)
19. The StatusPill SHALL require a text label in its props and render, for each of the five stages, a dot in that stage's colour beside the stage label; the `attention` tone SHALL render its label in attention-fg `#92400e` on attention-bg `#fef3c7`

**Independent test:** tab through `/pipeline` header controls and see the ring; read a pill's label and colours in the accessibility snapshot.

### S4: Pipeline board on sample data (P1)

The five-column kanban from the approved direction, at all three sizes.

**Acceptance Criteria**

20. WHEN a browser requests `GET /` THEN the system SHALL respond `307` with `Location: /pipeline`
21. WHEN a browser requests `GET /pipeline` THEN the system SHALL respond `200` and render the page title "Pipeline", a SearchInput labelled "Search agreements", a "Sample data" pill, and a primary "New agreement" button that is `disabled` (no agreement builder exists yet)
22. The board SHALL render five columns in stage order with the headers "In progress", "Sent to customer", "Accepted", "Completed", "Refused", each showing its stage dot, its card count, and the CAD total of its cards' annual amounts followed by `/yr`
23. Each card SHALL show the customer name, then the agreement number and version or its status note (for example `AG-1048 · v3`, `Not viewed · 9 days`), then an attention pill when the fixture flags one, then visits per year on the left and the annual amount followed by `/yr` right-aligned
24. IF a card has no annual amount THEN it SHALL omit the visits-and-amount row and contribute `$0` to its column total
25. IF a column has no cards THEN it SHALL show the text "No agreements", a count of 0 and a total of `$0/yr`
26. WHEN text is typed in the search THEN the board SHALL show only cards whose customer name contains it case-insensitively, and each column's count and total SHALL reflect only the shown cards
27. IF the search matches no card THEN the board SHALL be replaced by the text `No agreements match "<query>"` and a secondary "Clear search" button that empties the search and restores every card
28. WHILE the viewport is desktop the five columns SHALL share the work-area width with no horizontal scroll inside or outside the board
29. WHILE the viewport is tablet the board SHALL scroll horizontally inside its own container, each column at least 240px wide, and the page SHALL have no horizontal scroll
30. WHILE the viewport is mobile the board SHALL show a stage selector (`role="tablist"`, five tabs each at least 44px tall, each labelled with the stage short label and its count) and only the selected stage's column, with "In progress" selected first
31. WHEN a stage tab is activated THEN the board SHALL show that stage's column, and the tab SHALL have `aria-selected="true"`
32. The sample fixture SHALL use only fictitious customer names and SHALL include, at minimum: a "Changes requested" attention pill with a version above v1, a "Not viewed" sent card, an "Awaiting countersignature" accepted card, a card with no amount, and at least one card in every column (the empty-column state of AC 25 is reached through search)

**Independent test:** open `/pipeline` at 375, 768 and 1440 wide; type a customer fragment, then a nonsense query, then Clear search; on mobile tap each stage tab.

### S5: The design system recorded from code (P2)

DESIGN.md describes what was built.

**Acceptance Criteria**

33. WHEN this feature's code has landed THEN `DESIGN.md` SHALL contain no `SEED` marker and every hex value it lists SHALL equal the matching token in `web/app/globals.css`
34. The system SHALL contain `.impeccable/design.json`, which SHALL parse as JSON

**Independent test:** grep DESIGN.md for `SEED` and diff its hex values against `globals.css`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Estimator and Province filters | no estimator or province data exists until Phase 1 models agreements; a filter that changes nothing would lie |
| Drag-and-drop between stages | transitions belong to the Phase 1 state machine; the surface brief leaves it unresolved |
| Sorting within a column | unresolved in the surface brief (age vs next deadline); fixture order is shown as written |
| Dark mode | DESIGN.md defines a light palette only, and the category-standard direction does not call for one |
| Tenant accent theming on customer-facing surfaces | no customer-facing surface exists until the Phase 3 portal; door 1's role names leave room for it |
| TextInput, Select and the field error state | no screen in this feature renders them, so nothing could prove them; they are built and proven with the Phase 1 Company settings form |
| Real data, auth, the other nav pages | Phase 1 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| How the web layer is proved, given AGENTS.md says web tests stay out of git | proofs are `npm run build`, `npm run lint`, a committed-free grep for colour literals, and the live Playwright MCP validation AGENTS.md mandates, each recorded by the Verifier; no Vitest or Testing Library is added | AGENTS.md: "Web - nothing in git"; Vitest arrives in Phase 1 for the pure domain layer | y |
| Where the components are shown | on the real `/pipeline` route with a static fictitious fixture, not a separate `/styleguide` page | the surface brief already targets `web/app/pipeline/page.tsx`, and Phase 1 swaps the fixture for data instead of building the page twice | y |
| Column header label for the accepted stage | the short label "Accepted"; the full "Accepted, awaiting signature" is the stage's `label` for pills and tooltips | at 1440px a column is about 220px wide; the full label wraps beside a count and a total. Matches the approved mock | y |
| Per-year money suffix | amounts on cards and column totals show `/yr` (`$14,280/yr`) | DESIGN.md "Money Lines Up" rule: per-year amounts say `/yr`; the mock omitted it | y |
| Slate Secondary darkened everywhere, not only on wells | one `ink-2` token at `#646b78` | DESIGN.md says darken it if it fails 4.5:1; one value avoids a second grey that authors would mix up | y |
| Touch sizing switch | by viewport width (< 1024px gets 44px controls), not `pointer: coarse` | the AGENTS.md validation is defined by screen sizes; Playwright resize does not change the pointer media query | y |
| Commits | `web/` repo on `master` for code; outer repo on `development` for the gitlink bump and docs. No push | matches how the scaffold is recorded today; push needs a separate go-ahead | y |
| Profile | `light` (no declaration in AGENTS.md) | skill default; `ui` would add a binding-source comparison of each screen against `canon.html` | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/pipeline` | empty state (a column with no cards) | AC 25 |
| screen `/pipeline` | empty state (search matches nothing) | AC 27 |
| screen `/pipeline` | loading state | n/a - the fixture is static and rendered on the server; nothing is fetched |
| screen `/pipeline` | error state | n/a - no data source can fail; Phase 1 adds one with the data |
| screen `/pipeline` | unauthorised state | n/a - no auth exists until Phase 1 (M1); the route is public in this change |
| screen `/pipeline` | density and ordering | AC 22, AC 23, AC 28 |
| screen `/pipeline` | destructive action confirms | n/a - the screen has no destructive action |
| screen app shell | navigation to unbuilt pages | AC 8 |
| screen app shell | small-screen navigation | AC 10, AC 11, AC 12 |
| route `GET /` | response | AC 20 |
| all new routes | versioning, rate limits, who may call | n/a - HTML pages for a browser, not an API anyone binds to; auth arrives with M1 |
| copy on screen | tone | AC 21, AC 22, AC 27 - plain trade language from DESIGN.md |
| collection: the board | grouping criterion | AC 22 - by `PipelineStage` |
| collection: the board | ordering within a group | n/a - fixture order; sorting is out of scope |
| collection: the board | duplicates | n/a - the fixture has one card per agreement and nothing merges |
| collection: the board | the exception that does not fit | AC 24 - a card with no amount yet (import pending) |

## Sources

- [DESIGN.md](../../../DESIGN.md) - colours, type, radii, shadow, shell layout, responsive intent, named rules
- [.impeccable/mocks/decision/canon.html](../../../.impeccable/mocks/decision/canon.html) - the approved direction the board reproduces
- [web/.impeccable/surfaces/web-app-pipeline-page-tsx.md](../../../web/.impeccable/surfaces/web-app-pipeline-page-tsx.md) - Pipeline surface brief and direction contract
