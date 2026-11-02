# Term dates

## Problem

An agreement has no dates. A version says what is serviced and what it costs per year, but not when the year starts or ends. The customer accepts a price with no period attached, and staff cannot see when an accepted agreement runs out. ROADMAP's "Term and renewal" section sets the rule: "A contract has a start date and a term (12 months by default), from which its end date follows", and "Until Phase 4 ships, the term runs on the accepted agreement". The renewal rule needs three tenant settings that do not exist yet: default term months, renewal notice days (30) and the CPI renegotiation threshold % (5). The source gives no usage figures.

When this ships:
- Company settings holds the three renewal settings.
- Each version of an agreement carries a start date and term months, and its end date follows from them.
- A draft cannot be sent until it has a start date.
- The customer sees the term, and a renewal clause built from the frozen settings, on the PDF and the review page.

## Flow

This reuses what exists instead of adding a second version of it:
- the settings form, `validateOrgSettings` (exists) and `OrgSettingsStore` (exists)
- the one snapshot writer `freeze_agreement_version` through `private.org_terms` (AD-071)
- `parseTerms` / `termsOf`, and the one PDF layout
- the single transition RPC and its revise copy (AD-055), and `create_agreement` (AD-053)

The path:

1. `/settings` (exists) posts to `saveSettingsAction` (exists). `validateOrgSettings` (exists, extended) passes the three renewal fields to `OrgSettingsStore.save` (exists), which writes the `org_settings` columns (door 2).
2. `create_agreement` (exists, redefined) gives version 1 its `term_months` from `org_settings.default_term_months` (door 6).
3. The term form on `/agreements/[agreementId]` (exists) posts to a Server Action. The action calls the `AgreementTermStore` port (no door, placement per AD-057), which calls `public.save_agreement_term` (door 3). That writes `term_start` and `term_months` on the latest version of a draft, and `term_end` follows (door 1).
4. `apply_agreement_transition` on `agreement.revised` (exists, redefined) copies the term into version n + 1 (door 6).
5. `send_agreement` (exists, redefined) refuses a latest version with no `term_start` (door 4). `freeze_agreement_version` (exists, unchanged) writes `private.org_terms` (exists, redefined), which now carries the two renewal keys (door 5).
6. `AgreementReader.get` (exists) and `portal_view` (exists, redefined, door 7) return the shown version's term. `parseTerms` (exists, extended) reads the renewal keys. `buildAgreementDocument` and `termsOf` (exist) give the Term line and the Renewal row to the staff page, `/review/[token]` and both PDF routes.

## Impact

| Front | What changes |
| --- | --- |
| domain | New term `term`: a version's start date, term months and end date (start + months − 1 day). Lives in `web/domain/agreement`. |
| domain | New term `renewal settings`: the tenant's default term months, renewal notice days and CPI renegotiation threshold %. Lives in `web/domain/org-settings`. |
| domain | Existing term `AgreementTerms` gains `renewalNoticeDays` and `cpiRenegotiationThresholdPct`, nullable. Who reads it today: `termsOf`, `buildAgreementDocument`, `review-view.tsx` and the fixtures in `agreements.test.ts`, `portal.test.ts` and `portal-view.testing.ts`. |
| domain | Existing term `OrgSettingsValue` / `OrgSettingsInput` gain three fields. Who reads them today: the settings form and state, `settings.ts`, `getOrgSettings` callers (both PDF routes, notify) and their fixtures. |
| behaviour | `send_agreement` gains a refusal. A draft that could be sent before this cannot be sent until it has a start date. |
| stored data | Every existing version gets `term_months = 12` and `term_start = null`. Every `org_settings` row gets 12 / 30 / 5.00. No snapshot is rewritten: versions frozen before this have no renewal keys and no start date, and show "Not recorded for this version" for the term. Only demo data exists; `seed.sql` gives the demo versions a start date (assumption). |
| SQL functions | Redefined: `create_agreement`, `apply_agreement_transition`, `send_agreement` (5-argument; the 4-argument overload calls it), `private.org_terms` and `portal_view`. New: `save_agreement_term`. |
| docs | CONTEXT.md (company profile, service agreement, portal), ROADMAP tick, STATE.md rows for the doors, `database.types.ts` regenerated. |

## Relations

None. No new entity and no cardinality change. Door 1 adds columns to `agreement_versions`, and door 2 adds columns to `org_settings`.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `rpc public.save_agreement_term` (new) | `p_agreement_id`, `p_term_start`, `p_term_months` | the version id | `200` uuid; `55000` not draft; `42501` not a writer; `P0002` missing or another org; `23514` out of bounds |
| `rpc public.send_agreement` (signature unchanged) | unchanged | unchanged | `200` uuid (unchanged); adds `23514` when the latest version has no `term_start` |
| `rpc public.portal_view` (signature unchanged) | `p_token_hash` | adds `term: {start, months, end}` (ISO dates, start and end null when unset); `terms` may carry the two renewal keys | `200` jsonb, or `200` null (unchanged) |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. term on a version | `agreement_versions.term_start date null check (term_start between '2000-01-01' and '2099-12-31')`, `term_months smallint not null default 12 check (term_months between 1 and 60)`, `term_end date generated always as ((term_start + make_interval(months => term_months))::date - 1) stored` | Term on `agreements`: a revision could change the term with no record of what the customer saw in version n. End computed in the app: the renewal cron (next item) is SQL and would need a second implementation. |
| 2. renewal settings | `org_settings.default_term_months smallint not null default 12 check (between 1 and 60)`, `renewal_notice_days integer not null default 30 check (between 0 and 365)`, `cpi_renegotiation_threshold_pct numeric(5,2) not null default 5 check (between 0 and 100)` | Nullable columns: every reader and the renewal cron would branch on "not set" for a rule ROADMAP gives defaults for. |
| 3. term writer | `public.save_agreement_term(p_agreement_id uuid, p_term_start date, p_term_months smallint) returns uuid`, security definer, `search_path = ''`, writer check via `private.has_org_role`, agreement `for update`, `55000` unless `draft`, writes the highest version only | A column grant `update (term_start, term_months)` plus a frozen trigger: it reopens member updates on a table AD-060 closed, and a grant mistake exposes `snapshot`. |
| 4. send needs a start | inside `send_agreement`, after the transition and beside the "no service line" check: `raise ... using errcode = '23514'` when the latest version's `term_start is null` | An app-only check: a direct RPC call, or two tabs, could send a version with no dates. |
| 5. frozen renewal terms | `snapshot.terms` gains `renewalNoticeDays` (int) and `cpiRenegotiationThresholdPct` (number), written by `private.org_terms`. `parseTerms` reads either key as `null` when absent. Amends AD-071. | Backfilling frozen snapshots: that rewrites what a customer was sent, and the clause did not exist then. Reading the live settings at renewal time: Company settings could change a promise the customer already accepted. |
| 6. term seeding and copy | `create_agreement` sets version 1 `term_months = coalesce(settings.default_term_months, 12)`. `agreement.revised` copies `term_start` and `term_months` with the lines. Amends AD-053 and AD-055. | Copying in the app: a second request can leave n + 1 with no term (the AD-055 reason). |
| 7. portal term key | `portal_view` adds `"term": {"start": "YYYY-MM-DD" \| null, "months": int, "end": "YYYY-MM-DD" \| null}` | A preformatted string: the review page could not format dates the way the staff page does. |

- Nothing else in this change is hard to reverse. Field labels, the Term section's layout and the renewal clause wording are settled in the diff.

## Criteria

### S1: tenant renewal settings (P1)

Owners and admins set the renewal defaults in Company settings.

**Acceptance Criteria**

1. WHEN the migration runs THEN every `org_settings` row SHALL hold `default_term_months` 12, `renewal_notice_days` 30 and `cpi_renegotiation_threshold_pct` 5.00.
2. IF an `org_settings` write sets `default_term_months` outside 1–60, `renewal_notice_days` outside 0–365, or `cpi_renegotiation_threshold_pct` outside 0–100, THEN the database SHALL refuse it with `23514`.
3. WHEN an owner or admin saves `/settings` with valid renewal values THEN the system SHALL store them, and `/settings` SHALL show them after a reload.
4. IF a renewal field is invalid on save THEN `/settings` SHALL show its error and store nothing: `Default term must be a whole number of months from 1 to 60`, `Renewal notice must be a whole number from 0 to 365`, `CPI renegotiation threshold must be a number from 0 to 100 with at most two decimals`.
5. WHILE the member is an estimator or viewer, `/settings` SHALL show the three renewal values read-only.

**Independent test:** set the default term to 24 on `/settings`, reload, and see 24. Then type 0 and see the error.

### S2: a version carries a term (P1)

An estimator sets when the agreement starts and how long it runs.

**Acceptance Criteria**

6. WHEN `create_agreement` creates an agreement THEN version 1 SHALL have `term_months` equal to the org's `default_term_months` (12 when the org has no settings row) and `term_start` null.
7. The system SHALL store `term_end` as `term_start` + `term_months` months − 1 day, and null while `term_start` is null. Examples: 2027-01-01 + 12 gives 2027-12-31; 2027-03-15 + 6 gives 2027-09-14; 2027-01-31 + 1 gives 2027-02-27.
8. WHEN a writer saves a start date and term months on the current version of a draft THEN the system SHALL store them on that version, and `/agreements/[agreementId]` SHALL show `Term: Jan 1, 2027 – Dec 31, 2027 · 12 months`.
9. IF `save_agreement_term` runs on an agreement that is not `draft`, THEN it SHALL refuse with `55000` (shown "This version can no longer be changed."). IF the caller is a viewer, THEN it SHALL refuse with `42501`. IF the agreement is missing or in another org, THEN it SHALL refuse with `P0002`. In each case nothing changes.
10. IF the term months are not a whole number from 1 to 60, or the start date is empty or outside 2000–2099, THEN the term form SHALL show `Term must be a whole number of months from 1 to 60` or `Enter a start date between 2000 and 2099` and store nothing; the database SHALL refuse the same values with `23514`.
11. WHEN `revise` creates version n + 1 THEN it SHALL carry version n's `term_start` and `term_months`, and version n SHALL stay unchanged.
12. WHILE the current version of a draft has no start date, `/agreements/[agreementId]` SHALL show `Start date not set` in the Term section.
13. WHEN the migration runs THEN every existing version SHALL hold `term_months` 12 and `term_start` null, and no `agreement_versions.snapshot` SHALL change.
14. The system SHALL show a term date as the calendar date stored, with no time-zone shift: `2027-01-01` reads `Jan 1, 2027` on every page and PDF.

**Independent test:** on a new draft, the Term section shows `Start date not set · 12 months`. Save Jan 1, 2027 and it shows `Jan 1, 2027 – Dec 31, 2027`.

### S3: send needs a term, and freezes the renewal terms (P1)

What the customer accepts has dates and a renewal rule that later settings changes cannot touch.

**Acceptance Criteria**

15. IF Send is pressed on a draft whose latest version has no `term_start` THEN `send_agreement` SHALL refuse with `23514`, the status, events, outbox and portal links SHALL be unchanged, and the page SHALL show `Set the term start date before sending`.
16. WHEN an agreement leaves draft THEN its frozen `snapshot.terms` SHALL hold `renewalNoticeDays` and `cpiRenegotiationThresholdPct` from the org's settings, beside the six existing keys. A later change to those settings SHALL leave the snapshot unchanged.
17. WHEN `parseTerms` reads a `terms` object without the two renewal keys THEN it SHALL return the six existing terms with both renewal values `null`. IF a renewal key is present but not a valid value, THEN it SHALL return `null`, as for the other six.

**Independent test:** try to send a draft with no start date and see the message; set one, send, change the threshold in settings, and the sent version's PDF keeps the old threshold.

### S4: the customer sees the term and the renewal clause (P1)

The PDF and the review page say when the agreement runs and how it renews.

**Acceptance Criteria**

18. The agreement PDF (both routes), `/review/[token]` and `/agreements/[agreementId]` SHALL show the shown version's term as `Term: <start> – <end> (<months> months)`.
19. IF the shown version has no start date THEN the current draft's PDF SHALL print `Term: start date to be set (<months> months)`, and a frozen version SHALL show `Term: not recorded for this version`.
20. WHERE the version's terms hold both renewal values (from the settings for the current draft, frozen otherwise), the Terms block SHALL include a `Renewal` row: `Renews automatically for another <months> months with the CPI increase, capped at <cap>%. If CPI is <threshold>% or more, the renewal is renegotiated. Notice is given <notice> days before the end date.`
21. IF a frozen version's terms lack the renewal values THEN the Terms block SHALL show no `Renewal` row.
22. The system SHALL make `portal_view` return `term` with `start` and `end` as `YYYY-MM-DD` (or null) and `months` as an integer.
23. The PDF from `/review/[token]/pdf` SHALL print the same Term line and Renewal row as `/agreements/[agreementId]/pdf?version=<n>` for that version.

**Independent test:** send a draft starting Jan 1, 2027. The customer page and its PDF read `Term: Jan 1, 2027 – Dec 31, 2027 (12 months)` and the Renewal row with 5% and 30 days.

## Out of scope

| Excluded | Why |
| --- | --- |
| Auto-renewal, renewal drafts, the "Expiring soon" view, n8n W7 | ROADMAP Phase 3.5 item 5 |
| Moving the term to the contract | ROADMAP Phase 4 (contract) |
| Showing the term or end date on pipeline cards and lists | the Agreements page item and "Expiring soon" |
| Proposal validity date and expiry | ROADMAP Phase 3.5 item 6 |
| Cancellation flow and notice period | ROADMAP Phase 6 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Where the term lives | on each version (door 1) | the customer accepts a version; a revision may change the dates | n |
| Start date required to send | yes (AC 15) | user chose it on 2026-11-02 | y |
| Freeze and print the renewal settings now | yes (S3, S4) | user chose it on 2026-11-02 | y |
| Term months bound | 1 to 60 | annual is the norm and multi-year PM contracts rarely exceed five years; a check is cheap to widen (AD-005) | n |
| Start date bound | any date from 2000 to 2099, past dates allowed | an estimator may write up an agreement for a term already running; the bound only stops typos like year 0202 | n |
| Default term months frozen | no; the version's own `term_months` is what the customer sees | the default only prefills a new agreement | n |
| Demo data | `seed.sql` sets `term_start` on demo versions with none, the first of the month after `created_at`, guarded by `term_start is null` | demo agreements should show a term, and only fictitious data exists (AD-009) | n |
| Renewal clause wording | AC 20 | carries the ROADMAP rule in one sentence; open to rewording at review | n |

**Open questions:** none. Everything is resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/settings` renewal fields | error state | AC 4 |
| screen `/settings` renewal fields | unauthorised (read-only) | AC 5 |
| screen `/settings` | empty, loading | existing - the settings page's no-row and `loading.tsx` states |
| screen `/agreements/[id]` Term section | empty state | AC 12 |
| screen `/agreements/[id]` Term section | error state | AC 9, AC 10 |
| screen `/agreements/[id]` Term section | unauthorised | existing - viewers and non-draft versions see read-only, as the line form does |
| screen `/agreements/[id]` Send | refusal copy | AC 15 |
| screen any | destructive action confirms | n/a - saving a term is reversible while draft; Send keeps its existing confirm |
| document agreement PDF, `/review/[token]` | structure | AC 18, AC 19, AC 20 |
| document old frozen versions | what an old reader sees | AC 19, AC 21 |
| API `rpc save_agreement_term` | error shape and codes | AC 9, AC 10 |
| API `rpc portal_view` | versioning | n/a - an added key; existing readers ignore unknown keys |
| all new and changed rpcs | rate limits | n/a - staff-only or unchanged anonymous surface; portal rate limiting is carried as an outbox-dispatch open question |

## Sources

- ROADMAP.md, the "Term and renewal" section, M2 and Phase 3.5 item 4: the start date, the 12-month default, the end date following from them, the three settings and their defaults.
- `.specs/STATE.md` AD-053, AD-055, AD-060 and AD-071: the creation, revise copy, snapshot writer and frozen terms that doors 3, 5 and 6 amend.
