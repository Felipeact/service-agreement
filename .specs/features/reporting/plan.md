# Reporting

## Problem

A contractor who sends agreements through the product cannot answer basic questions about the business without opening agreements one by one: how much recurring revenue is in term, how many sent agreements turned into signed ones, where deals sit and why they were lost, and which contracts end soon. The data is already stored (`events`, `agreements`, `agreement_versions`, `service_lines`), but only the Pipeline board and the "Expiring soon" view read any of it, and neither gives a total, a rate or a history. ROADMAP Phase 5.6 and decisions 17 to 19 set the scope; there is no measured loss or customer request behind it, and no tenant has real data yet, so the page must say something useful on day one through an empty state.

What changes for a user: an owner or admin opens **Reports** and sees recurring revenue, pipeline value, win rate and days to sign, a funnel, stage speed, losses with reasons, renewals due in 30, 60 and 90 days, and revenue by customer and by equipment type, and downloads any table as CSV. An estimator sees the operational reports without money. A viewer sees none.

## Flow

Reuses the pattern of `search_records` (a read-only `security invoker` SQL function, so RLS isolates tenants), the `events` log as the source of dates, and the existing member and role resolution in `web/app/(app)/member-gate.tsx`.

1. Member opens `GET /reports` -> `(app)/layout` (exists) resolves the member and role -> `member-gate` (exists) refuses a viewer.
2. Reports page (new, no door - placement per conventions) calls one `ReportReader` port (new, door 3) for the sections the role may see.
3. `ReportReader` Supabase adapter (new, no door - placement per conventions) calls `public.report_*` functions (new, door 1) on the request's own client.
4. `public.report_*` (door 1) join `agreements`, the latest `agreement_versions`, `service_lines` and `events`; money functions refuse a non-owner/admin with `42501` through `private.has_org_role` (exists; AD-189 keeps reads open for a frozen org).
5. `domain/reports` (new, no door - placement per conventions) turns rows into figures: rates, days, empty-state decisions.
6. out: server-rendered sections, and `GET /reports/export?report=<key>&from=&to=` (door 4) returns the same rows as CSV.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: **live value** - annual total (visits per year x cost per visit, summed over lines) of an agreement's latest version; lives in `public.report_*` |
| domain | new term: **in term** - agreement `accepted` (an automatic renewal included) with today (America/Vancouver) between the latest version's `term_start` and `term_end` |
| domain | new term: **win rate** - accepted / (accepted + refused + expired), per agreement not per version, automatic renewals excluded; lives in `public.report_headline` |
| domain | existing term: `events.created_at` meant audit time; it now also decides which period a deal counts under. Branches on it today: activity timeline and outbox dispatch, neither changes |
| stored data | nothing to migrate; new read-only functions only. Events written before an event type existed are counted as they are |
| nav | a Reports link in the shell for owner, admin and estimator; hidden for viewer |

## Relations

None - no stored-data shape change

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /reports` | `from`, `to` (dates, default last 12 months) | HTML sections | `200`, `307` to sign-in, `307` to `/pipeline` for a viewer |
| `GET /reports/export` | `report` (`funnel`, `aging`, `losses`, `renewals`, `revenue_customer`, `revenue_type`), `from`, `to` | `text/csv` with a header row | `200`, `400` unknown report or bad date, `401`, `403` for a viewer, or an estimator asking a money report |
| `public.report_headline(p_from date, p_to date)` and one function per section (door 1) | dates | rows | `200`, `403` (SQL error `42501`) when the role may not see it |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Reports are SQL functions, not stored aggregates | `public.report_headline`, `report_funnel`, `report_aging`, `report_losses`, `report_renewals`, `report_revenue_by_customer`, `report_revenue_by_type`: `language sql stable security invoker set search_path = ''`, args `(p_from date, p_to date)` (headline, funnel, aging, losses; renewals and the two revenue reports take none); money ones guard with `private.has_org_role(org, array['owner','admin'])`, the rest with `array['owner','admin','estimator']` | A reporting table or materialized view refreshed by a job: a second copy that goes stale and needs a scheduler, for tenants with no data volume |
| 2. Dates count under the event measured, in America/Vancouver | `(e.created_at at time zone 'America/Vancouver')::date` on the event of the stage measured (sent, decided, signed); created uses `agreements.created_at` | UTC dates: a deal sent at 6 pm Vancouver lands on tomorrow. A per-org zone: no column holds one, so one fixed zone until a tenant needs another |
| 3. One port for the page and the export | `ReportReader` with `headline`, `funnel`, `aging`, `losses`, `renewals`, `revenueByCustomer`, `revenueByType`, each `(range) => Promise<Result>` | Page and CSV each running their own SQL: the two drift and a figure on screen differs from the file |
| 4. CSV is one route with a closed list of keys | `/reports/export?report=<key>`; the six keys above, anything else `400`; money keys refuse an estimator | A route per report: six copies of auth and range handling. A free-form report name: injection surface |

- Nothing else in this change is hard to reverse.

## Criteria

### S1: Headline figures (P1)

The owner sees recurring revenue, pipeline value, win rate and average days to sign for a date range.

**Acceptance Criteria**

1. WHEN an owner or admin opens `/reports` THEN the system SHALL show recurring revenue equal to the sum of live values of agreements in term, in CAD from integer cents.
2. The system SHALL show pipeline value equal to the sum of live values of agreements with status `sent`, plus `accepted` agreements whose term has not started and that have no completed contract (an in-term agreement counts once, as recurring revenue).
3. WHEN the range is set THEN the system SHALL show win rate as accepted / (accepted + refused + expired) over agreements decided in the range, excluding agreements with an `agreement.renewed` event.
4. IF no agreement was decided in the range THEN the system SHALL show the win rate as "No decisions yet" and not 0%.
5. The system SHALL show average days to sign as the mean of whole days between `agreement.sent` and `contract.completed` for contracts completed in the range, and "No signed contracts yet" when there are none.

**Independent test:** seed three agreements (one in term, one sent, one refused) and read the four figures.

### S2: Funnel, speed and losses (P1)

The office sees where deals drop and why.

**Acceptance Criteria**

6. WHEN the range is set THEN the system SHALL show counts and values for created, sent, accepted and signed, each counted by its own event date, with drop-off from the previous stage as a percentage.
7. The system SHALL show the median days spent in each stage (created to sent, sent to decided, accepted to signed) and the ten oldest agreements still `draft`, `sent` or `accepted` without a completed contract, each with a link.
8. The system SHALL list refused, expired and withdrawn agreements in the range grouped by outcome, each row with the reason when one exists (refused: the portal reason; withdrawn: the staff note; expired: "Expired") and a link to the agreement.
9. IF a stage has no data THEN the system SHALL show its row with 0 and an empty-state line, not hide it.

**Independent test:** seed a refused agreement with reason "Price" and open Losses.

### S3: Renewals and revenue breakdown (P2)

**Acceptance Criteria**

10. WHEN the page loads THEN the system SHALL list contracts whose term ends in the next 30, 60 and 90 days (buckets 0-30, 31-60, 61-90) with live value and type: "Auto" when the org's CPI is below its threshold, "Needs negotiation" otherwise.
11. WHEN the page loads THEN the system SHALL show live value of in-term agreements as of today by customer and by equipment type, largest first, ties by name.
12. WHERE a service line covers several equipment types THEN the system SHALL split that line's value equally between them, so the by-type total equals the headline recurring revenue.

**Independent test:** seed a line covering two types and check the two shares sum to the line.

### S4: Access, export, empty and frozen states (P1)

**Acceptance Criteria**

13. IF a viewer opens `/reports` THEN the system SHALL redirect to `/pipeline`, and IF a viewer calls `/reports/export` THEN the system SHALL answer 403; neither shows a figure.
14. IF an estimator opens `/reports` THEN the system SHALL show funnel counts, aging, loss counts and renewal counts with no money anywhere, and SHALL answer 403 to `/reports/export` for a money report.
15. WHEN a member downloads a report THEN the system SHALL return CSV with a header row, one row per table row, money in dollars with two decimals, dates as `YYYY-MM-DD`, and any cell starting with `=`, `+`, `-` or `@` prefixed with a single quote.
16. IF the org has no agreements THEN the system SHALL show one empty state with a link to New agreement and no table.
17. WHILE the org is frozen the system SHALL still serve reports, because they only read.
18. IF `from` is after `to`, or a date is not `YYYY-MM-DD`, THEN the system SHALL answer 400 on the export and fall back to the default range with a notice on the page.
19. IF one report function fails THEN the system SHALL show that section's error line and still render the others.

**Independent test:** sign in as each of the four roles and open `/reports`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Per-estimator performance | Decision 18: events hold a role, not a person, and ranking staff is a product call |
| The product's own SaaS metrics (MRR, churn, signups by trade) | Stripe and product analytics cover them |
| Visit workload and invoicing reports | Need visit data from Phase 6 |
| A per-org time zone | No column holds one; America/Vancouver is fixed (door 2) |
| Charts beyond a funnel bar and a table per section | Tables carry the numbers; a chart library is a new dependency |
| Scheduled report emails | A separate item with n8n |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Which version carries an agreement's value | The latest version | A revision replaces the earlier prices; only one is live | n |
| "In term" needs a completed contract | No: an accepted agreement inside its dates counts | ROADMAP Term and renewal: until a contract exists the term runs on the accepted agreement | n |
| Default range | Last 12 months, ending today | A year matches the term length | n |
| Withdrawn reason | The staff note from the event payload when present, else blank | `agreement.withdrawn` is the only withdraw event | n |
| Pipeline value includes accepted-unsigned | Yes | It is money not yet in term | n |
| Loss reasons are free text | Listed per row, not bucketed | Free text cannot be grouped without guessing | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/reports` | empty state | AC 4, AC 9, AC 16 |
| screen `/reports` | loading state | existing - route `loading.tsx` skeleton, as `settings/loading.tsx` |
| screen `/reports` | error state | AC 19 |
| screen `/reports` | unauthorised state | AC 13, AC 14 |
| screen `/reports` | density and ordering | AC 7, AC 11 |
| screen `/reports` | destructive action confirms | n/a - read-only page, nothing is destroyed |
| API `GET /reports/export` | response shape | AC 15 |
| API `GET /reports/export` | error shape and codes | AC 13, AC 14, AC 18 |
| API `GET /reports/export` | versioning | n/a - read by the browser only, no external caller |
| API `GET /reports/export` | rate limit | n/a - authenticated member reading their own org, as every staff route |
| all `public.report_*` | who may call | AC 13, AC 14 |
| document (CSV) | structure and depth | AC 15 |

## Sources

- ROADMAP.md "Reporting" and Phase 5.6 - the report list, the event-date rule and the access rule
- Decisions 17 to 19 - money for owner and admin, no per-estimator ranking, the v1 list
