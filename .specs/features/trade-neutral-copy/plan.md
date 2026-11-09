# Trade-neutral copy

Roadmap Phase 4.5 item 6: "Trade-neutral product copy (`app/layout.tsx`, PRODUCT.md)". The Trades and packs section adds the scope: HVAC wording becomes trade-neutral "where it describes the product rather than the demo tenant". The org's item word (item-vocabulary), spellings and trade context (synonyms-as-data) and the starter packs are separate features and already built.

## Problem

The product still introduces itself as an HVAC tool in every place that speaks before a tenant exists or in the product's own voice. The browser description reads "Preventive-maintenance service agreements for HVAC and mechanical contractors." The sign-in page says the same on desktop, and its headline and mobile line say "equipment list" and "Maintenance agreements". The Pipeline subtitle says "PM agreement", HVAC shorthand that a plumber or electrician does not use. PRODUCT.md, which `/impeccable` and later agents read as the product's definition, calls the buyer someone who "maintains equipment", the deal a "PM contract" and the first positioning reason "PM agreement". A plumbing contractor who finds the product, or who is invited to it (Phase 5), reads on the first screen that it is not for them, even though the catalog, vocabulary and extraction prompt already serve their trade. The roadmap gives no figure or request for this; the pilot trade (decision 2) is still open.

When this ships, the sign-in page, the browser description, the Pipeline subtitle, PRODUCT.md and DESIGN.md describe "recurring service agreements for trade contractors" and name no trade, except where the text says HVAC is the first trade or describes the HVAC pack. Nothing a tenant sees about its own data changes.

## Flow

Reuses `itemText` (the one helper that swaps the org's item word into default-wording copy), so the Pipeline subtitle keeps taking the org's word and no second substitution appears.

1. `app/layout.tsx` (exists) - `metadata.description` is the browser and search description
2. `app/login/page.tsx` (exists) - the Night panel: mobile line, headline and desktop footer line; no org exists yet, so no org word can be used
3. `components/kanban/pipeline-view.tsx` (exists) - subtitle string passed through `itemText` with the org's words
4. `PRODUCT.md` (exists), `DESIGN.md` (exists), `CONTEXT.md` (exists) - the product's definition, the page-header paragraph that quotes the subtitle, and the Tenant entry
5. `app/product-copy.test.ts` (exists) - replaces the check that pinned the old copy

## Impact

| Front | What changes |
| --- | --- |
| domain | existing term: "PM agreement" meant the HVAC name for the proposal; it now reads "service agreement". Nothing branches on it: no identifier, column, route or event contains "PM" (`agreement` is the name everywhere). The `CONTEXT.md` heading "Service agreement (PM agreement)" loses the alias |
| domain | existing term: "equipment" in the sign-in page is read by a visitor with no org, so it cannot follow the org's word; it is replaced by a neutral "list" |
| tests | `app/product-copy.test.ts` C2022 pins the old login and layout text and says item 6 changes it. It is replaced by checks on the new copy, not edited to pass |
| docs | `DESIGN.md` line 3 (description) and the Page header paragraph quote the old subtitle; `PRODUCT.md` Users, Purpose, Positioning and Inputs; `CONTEXT.md` Tenant entry |
| stored data | nothing to migrate: no copy is stored. A tenant's own text (service line descriptions, task names, trade context) is not touched |
| not changed | `RooftopScene` (a rooftop air-handler drawing on the sign-in page), the demo seed (the demo tenant is an HVAC company), test fixtures and the HVAC pack, PRODUCT.md's sentence naming HVAC as the first trade, and its Direction section |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside`

(`metadata.description` is read by search engines and link previews. It is a sentence, not a contract, and changing it later is a one-line edit.)

## Landing

`None - every change is a string or a document line and reverses with an edit; no schema, route, dependency, identifier or persisted value is touched.`

- Nothing in this change is hard to reverse

## Criteria

### S1: The sign-in page and browser description name no trade (P1)

A visitor with no account reads what the product is for, and the words fit any recurring-service trade.

**Acceptance Criteria**

1. The root layout's `metadata.description` SHALL be exactly "Recurring service agreements for trade contractors, from the customer's list to signature."
2. The sign-in page's mobile line (shown below 1024 px) SHALL be exactly the same sentence as criterion 1
3. The sign-in page's headline SHALL be exactly "From service list to signed agreement." (38 characters, at most the 40 of today's headline, so it wraps in the same `13ch` column)
4. The sign-in page's desktop footer line SHALL be exactly "Recurring service agreements for trade contractors."
5. The system SHALL contain none of the words "HVAC", "mechanical contractors", "PM agreement" or "Preventive-maintenance" in the non-test source under `web/app`, `web/components`, `web/application`, `web/domain`, `web/infrastructure` and `web/lib`
6. WHILE the sign-in page is shown at 375, 768 or 1440 px wide the system SHALL show no horizontal scroll and no cut-off headline

**Independent test:** open `/login` signed out at the three widths and read the four strings; run the source scan.

### S2: The Pipeline subtitle uses the org's word and no trade shorthand (P1)

**Acceptance Criteria**

7. WHEN an org's item words are the default ("equipment") THEN the Pipeline subtitle SHALL read "Keep every service agreement moving from equipment list to signature."
8. WHEN an org's item words are "station" and "stations" THEN the Pipeline subtitle SHALL read "Keep every service agreement moving from station list to signature."

**Independent test:** render the Pipeline view with the default words and with `station`/`stations`.

### S3: The product documents describe the product, not one trade (P2)

**Acceptance Criteria**

9. The system SHALL have no "PM" abbreviation and no "preventive-maintenance" in `PRODUCT.md`
10. The system SHALL name HVAC in `PRODUCT.md` only on a line that also says it is the first trade or the starter catalog (today's lines 11 and 36), and nowhere in its Product Purpose and Positioning sections
11. The `DESIGN.md` description (line 3) SHALL name no trade, and its Page header paragraph SHALL quote the subtitle of criterion 7
12. The `CONTEXT.md` Tenant entry SHALL not say "(HVAC or mechanical)", and its Service agreement heading SHALL not say "PM agreement"

**Independent test:** read the four documents; the vitest scan reads `PRODUCT.md` and `DESIGN.md`.

### S4: The old pin gives way to the new copy (P1)

**Acceptance Criteria**

13. The system SHALL have no test asserting the old strings "Preventive-maintenance service agreements for HVAC and mechanical contractors." or "From equipment list to signed agreement.", and a test for each of criteria 1 to 4 and 7 to 10

**Independent test:** `npm test` in `web/` is green with C2022 replaced.

## Out of scope

| Excluded | Why |
| --- | --- |
| A new sign-in drawing in place of `RooftopScene` | Artwork is a design task, not copy; a rooftop unit stays a fair picture of a service visit until the brand is decided (see Assumptions) |
| Rewriting PRODUCT.md's Direction section or marking the vocabulary, synonyms and packs as built | It records the plan's status, not how the product is described; Phase 5 changes the status |
| A product tagline, marketing page or brand name | The brand is undecided (PRODUCT.md Undecided); `/pricing` is Phase 5 |
| Trade-specific wording per org (a plumber's "PM" or "service call") | Decision 4: one per-org label for the item, no per-trade wording |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| The exact strings of criteria 1 to 4 | "Recurring service agreements for trade contractors", "from service list to signed agreement" | Uses the roadmap's own words for what the product is ("recurring service", "trades and service businesses"); "service list" avoids "equipment" for a visitor with no org word | n |
| The sign-in drawing stays | `RooftopScene` unchanged | A drawing is not copy; replacing it needs a design pass, and the roadmap item names copy only | n |
| HVAC stays where it names the first trade, the HVAC pack or the demo tenant | PRODUCT.md lines 11 and 36 keep HVAC; seed, fixtures and `trade_context` test data are untouched | Those lines are true; "trade-neutral" applies where the text describes the product (Trades and packs, Cleanup) | n |
| The `ports/index.ts` doc comment example `("HVAC and mechanical")` changes to a neutral example | `("plumbing, electrical")` | It is source text the criterion 5 scan reads, and a plumbing example matches the new packs | n |
| `illustrations.tsx` comment "preventive-maintenance agreement" stays | lowercase, describes the drawing; the scan pattern is the capitalised "Preventive-maintenance" | It is accurate about the HVAC drawing and is not copy | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/login` | empty, loading, error and unauthorised states | existing - the sign-in form and its link-invalid state are unchanged; only three text strings change |
| screen `/login` | density and ordering | AC 3, AC 6 (headline no longer than today's; no overflow at 375, 768, 1440) |
| screen `/login`, `/` browser description | the reader's next step | existing - the sign-in form beside the text is the next step |
| screen Pipeline | subtitle in every state | AC 7, AC 8 (the subtitle shows in empty and populated states alike; unchanged by this) |
| screen Pipeline | destructive actions | n/a - copy only, no action |
| document `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md` | structure, tone, depth, next step | AC 9 to AC 12; headings and structure unchanged; `CONTEXT.md` gains one dated build-log line (AGENTS.md rule) |
| collection of product strings | grouping, duplicates, the exception that does not fit | AC 5 (one scan over non-test source) with the Assumptions rows naming what stays |

## Sources

- `ROADMAP.md` Phase 4.5 item 6 and Trades and packs, Cleanup - the item and its scope ("where it describes the product rather than the demo tenant")
- `web/app/product-copy.test.ts` C2022 - says the old copy is changed by this item, not by item-vocabulary
