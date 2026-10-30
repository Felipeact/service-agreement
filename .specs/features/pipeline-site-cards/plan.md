# Pipeline cards by site

## Problem

An estimator scanning `/pipeline` sees every card titled by customer. A customer with several sites
(a property manager, a strata company) shows several identical headings, told apart only by the
`AG-` number, although an agreement belongs to one site and staff refer to a deal by its building.
Typing a building name into the board search finds nothing, because the filter matches customer
names only. The source gives no usage figures; ROADMAP's status model now states that each card is
titled with the site, with the customer underneath.

When this ships, each card leads with its site, the customer sits on the line beneath it, and the
search finds a deal by either name.

## Flow

Reuses `supabasePipelineReader`, `PipelineView`, `KanbanColumn` and `KanbanCard`; no new module.

1. `/pipeline` page (exists) -> `pipelineBoard()` -> `supabasePipelineReader.board()` (exists) selects `sites(name, customers(name))` and hands `site` and `customer` on each `PipelineCard`
2. `PipelineView` (exists) keeps the cards whose site or customer contains the trimmed, lower-cased query, then groups them by stage
3. `KanbanColumn` (exists, unchanged) counts and totals the filtered cards; `KanbanCard` (exists) renders the site as its heading and the customer beneath it
4. out: HTML for the board; nothing persists

## Impact

| Front | What changes |
| --- | --- |
| domain | `PipelineCard` gains `site` - the agreement's `sites.name`. Readers of `PipelineCard` today: `KanbanCard`, `KanbanColumn`, `PipelineView` and their tests only |
| UI | the card heading changes from customer to site; the search placeholder changes from "Search customers…" to "Search sites or customers…" |
| already shipped | the column count and annual total (C112) are already computed over the searched cards; unchanged, now pinned by AC 6 |
| docs | DESIGN.md "Pipeline board" gains the card anatomy line; ROADMAP item ticked and CONTEXT.md updated (AGENTS..md) |
| stored data | nothing to migrate |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside; `/pipeline` keeps its route and signature

## Landing

None - a field on a view type and the card markup reverse with a refactor; no schema, contract or dependency is added

## Criteria

### S1: card by site (P1)

Each card names its site first and its customer second.

**Acceptance Criteria**

1. The pipeline reader SHALL return, for each card, `site` equal to the agreement's `sites.name` and `customer` equal to that site's `customers.name`
2. The pipeline card SHALL render the site name as its `h3` heading and the customer name on the next line, before the `<number> · v<n>` line
3. IF a site name is longer than the card width THEN the card SHALL wrap it onto further lines and SHALL NOT truncate it

**Independent test:** render the board with one card whose site is "Harbourview Tower A" and customer "Harbourview Towers Strata"; the heading reads the site and the next line the customer.

### S2: search either name (P1)

The board search finds a deal by its site or its customer.

**Acceptance Criteria**

4. WHEN the trimmed query is a case-insensitive substring of a card's site name or of its customer name THEN the board SHALL show that card in its stage
5. IF the query matches neither name on any card THEN the board SHALL show `No agreements match "<query>"` and a Clear search button
6. WHILE a query is active each column header SHALL show the count and the `/yr` total of only that stage's matching cards
7. The search input SHALL have the placeholder `Search sites or customers…` and keep the accessible label `Search agreements`

**Independent test:** type a site name that no customer contains; only that site's cards remain, and each column total sums only them.

## Out of scope

| Excluded | Why |
| --- | --- |
| Matching agreement number, address or unit numbers | ROADMAP's later "Global search across customers, sites and unit numbers" item |
| $ total on the mobile stage tabs | ROADMAP asks for the column header, which renders under the tabs on mobile |
| "Expiring soon" view | ROADMAP's renewal item |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Card ordering inside a column | unchanged: `updated_at` descending | not part of the roadmap item | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/pipeline` | empty state | existing - C118 "No agreements yet" |
| screen `/pipeline` | loading state | existing - `pipeline/loading.tsx` |
| screen `/pipeline` | error state | existing - `(app)/error.tsx` |
| screen `/pipeline` | unauthorised state | existing - `MemberGate` redirect (AD-022) |
| screen `/pipeline` | density | AC 2, AC 3 |
| screen `/pipeline` | ordering | Assumptions - unchanged `updated_at` descending |
| screen `/pipeline` | destructive action confirms | n/a - the board has no destructive action |
| screen `/pipeline` | no-match search state | AC 5 |
| collection cards by stage | grouping criterion | existing - `pipelineStage` (AD-001) |
| collection cards by stage | duplicates | AC 2 - the same site name under two customers is told apart by the customer line |

## Sources

- ROADMAP.md Phase 3.5 item 1 and the Status model paragraph ("Each card is titled with the site…") - settles the card order and the search scope
- DESIGN.md "Pipeline board" - binding layout for columns and the header total
