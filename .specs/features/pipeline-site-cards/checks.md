# Pipeline cards by site - checks

Profile: light
Plan: `.specs/features/pipeline-site-cards/plan.md`

7 checks in 2 slices · 0 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1053:`).
  The reader is proven with the recording stub client (`infrastructure/supabase/stub-client.ts`),
  the board with `renderToStaticMarkup`, as the existing pipeline tests do.
- The repo has no DOM test environment, so C1056-C1058 render `PipelineView` with an optional
  `initialQuery` prop that seeds the same `query` state the search input writes; filtering and the
  column headers then run through the real render path. No new test dependency.

## Checks

### S1 - card by site · 5 files · ~57 KB · ~14k

**C1053** - `supabasePipelineReader.board()` selects `sites(name, customers(name))` from `agreements`, and for a
row whose site is "Harbourview Tower A" under customer "Harbourview Towers Strata" returns a card with
`site: "Harbourview Tower A"` and `customer: "Harbourview Towers Strata"` (AC 1)
Proof: `npx vitest run infrastructure/supabase/readers -t "C1053:"`

**C1054** - A card with site "Harbourview Tower A", customer "Harbourview Towers Strata", number "AG-1048",
version 3 renders an `h3` whose text is exactly "Harbourview Tower A", followed by an element whose text is
"Harbourview Towers Strata", followed by "AG-1048 · v3"; the customer name is not inside the `h3` (AC 2)
Proof: `npx vitest run components/kanban -t "C1054:"`

**C1055** - The card's site `h3` carries none of the classes `truncate`, `line-clamp-*`, `whitespace-nowrap`
or `overflow-hidden`, and a 120-character site name appears in the markup in full (AC 3)
Proof: `npx vitest run components/kanban -t "C1055:"`

### S2 - search either name · 2 files · ~10 KB · ~3k

**C1056** - On a board of three cards (A: site "Harbourview Tower A" / customer "Harbourview Towers Strata";
B: site "Fernwood Clinic" / customer "Fernwood Dental"; C: site "Main office" / customer "Kestrel Logistics"),
the query `  CLINIC ` shows only B, `kestrel` shows only C, and `harbourview` shows only A (site match, customer
match, and both) (AC 4)
Proof: `npx vitest run components/kanban -t "C1056:"`

**C1057** - On the same board, the query `zzz` shows `No agreements match "zzz"` and a Clear search button,
and no card (AC 5)
Proof: `npx vitest run components/kanban -t "C1057:"`

**C1058** - On a board with two `in_progress` cards (site "Fernwood Clinic", 400000 cents; site "Main office",
1000000 cents) and one `sent` card (site "Fernwood Annex", 250000 cents), the query `fernwood` makes the
`in_progress` header read count 1 and `$4,000/yr`, and the `sent` header count 1 and `$2,500/yr` (AC 6)
Proof: `npx vitest run components/kanban -t "C1058:"`

**C1059** - The search input has `placeholder="Search sites or customers…"` and the accessible label
`Search agreements`; the text "Search customers…" no longer appears (AC 7)
Proof: `npx vitest run components/kanban -t "C1059:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| search match field (2) | site C1056 · customer C1056 | - |
| search outcome (3) | site-only match C1056 · customer-only match C1056 · no match C1057 | - |
| card lines in order (3) | site `h3` C1054 · customer C1054 · number and version C1054 | - |
| column header under a query (2) | count C1058 · `/yr` total C1058 | - |
| search input attributes (2) | placeholder C1059 · label C1059 | - |

- No route in the plan's `Surface`; no door in `Landing`; no entity in `Relations`

## Swept

- validation: C1056 (query trimmed and case-folded)
- failure modes: existing - a failed board read reaches `(app)/error.tsx` (staff-screens feature)
- idempotency: n/a - read-only screen, nothing is written
- authorization: existing - the board reads under the member's RLS behind `MemberGate` (staff-screens feature, AD-022)
- concurrency: n/a - read-only screen, no shared write
- data lifecycle: n/a - no data is created, retained or deleted
- dependency failure: existing - Supabase unreachable on the board read reaches `(app)/error.tsx` (staff-screens feature)
- state transitions: existing - status to stage mapping unchanged (`pipelineStage`, AD-001)
- observability: n/a - no logging requirement; the error path already logs its digest

## Handoff

- S1 touches `application/ports/index.ts` (26 KB), `infrastructure/supabase/readers.ts` and its test
  (27 KB), `kanban-card.tsx` and `pipeline-view.test.ts` (6 KB); S2 adds `pipeline-view.tsx` (5 KB);
  docs `DESIGN.md`, `ROADMAP.md`, `CONTEXT.md` (101 KB read): about 167 KB, roughly 42k tokens, under
  the 150k budget - one builder
