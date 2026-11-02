# Renewal - checks

Profile: light
Plan: `.specs/features/renewal/plan.md`

54 checks in 7 slices · 8 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1166:`). This feature numbers
  from C1166, because term-dates owns up to `C1165:`.
  - Pure domain code (`validateOrgSettings`, the renewal email content in `domain/notifications`, the Expiring soon state
    labels) is tested with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup`: `SettingsView`, `AgreementView`, the kanban card and the
    Expiring soon view.
  - The notify use case is tested in `application/use-cases` with its fakes, and the route in
    `app/api/automation/notify`.
- **test:db** - `npm run test:db <recipe>` in `web/` (AD-026), against project `gnxebrtcpbujhvcamtoe`, rolled back, so
  they pass only once the migration is applied there. The renewal rule's assertions go into `agreement_builder.sql`, the
  W7 claim's into `outbox_dispatch.sql`, the bounds into `domain_constraints.sql`, isolation into `rls_isolation.sql`,
  and the seed into `demo_seed.sql` / `demo_seed_rerun.sql`, each labelled with its check id. No new recipe, so the
  runner's pinned counts (C830, C203-C212) do not move. This settles the plan's orientation note about a new
  `renewal.sql`.
  - Each run date in these tests is a literal (2027-12-01 and so on). The W7 claim tests use `current_date` for the key,
    because door 5 bounds it, and give the fixture's term an end of `current_date + 20` days.
- **mcp** - a Supabase MCP `execute_sql` or `get_advisors` on project `gnxebrtcpbujhvcamtoe`. The query and its result
  go in the Handoff.
- **live** - an author-side run against the deployed app and project, recorded in the Handoff, as customer-portal and
  outbox-dispatch did.

Terms:
- "the fixture" is the `fixture.sql` org A, extended with: an accepted agreement **A**, whose latest version runs
  2027-01-01 for 12 months, has frozen terms `cpiCapPct` 5, `cpiRenegotiationThresholdPct` 5 and `renewalNoticeDays` 30,
  and two lines (4 × 25000 and 1 × 19999, the second covering two asset types); and org A's `renewal_cpi_pct` 3.20 as of
  2027-10-15. A test that needs another value sets it inside the test.
- "R" is the agreement `run_renewals` creates for A.
- "the W7 body" is `{"kind": "renewal_daily", "idempotencyKey": "w7:<yyyy-mm-dd>", "executionId": "<id>"}`, signed per
  AD-074 with the test secret, as the outbox-dispatch W5 assertions sign theirs.

## Checks

### S1 - tenant CPI for renewals · 7 files · 20 KB · ~5k

**C1166** - After the migration, the count of `org_settings` rows on the project with `renewal_cpi_pct` or
`renewal_cpi_as_of` not null is `0` (AC 1)
Proof: mcp `execute_sql` (query and result recorded in the Handoff)

**C1167** - Each of these `org_settings` updates is refused with `23514`: `renewal_cpi_pct` -20.01 and 100.01 (with a
date), `renewal_cpi_as_of` 1999-12-31 and 2100-01-01 (with a CPI), a CPI with a null date, and a date with a null CPI.
These are accepted: -20 and 100 with a date, 3.20 with 2027-10-15, and both null (AC 2, door 2)
Proof: `npm run test:db domain_constraints` (assertions `C1167`)

**C1168** - `validateOrgSettings` accepts `renewalCpiPct` `"3.2"`, `"-20"`, `"0"`, `"100"`, `"4.75"` with
`renewalCpiAsOf` `"2027-10-15"`, and returns the number and the date. With both `""` it returns both `null`. It gives:
- `CPI must be a number from -20 to 100 with at most two decimals` for `"-20.01"`, `"100.01"`, `"3.123"`, `"abc"`
- `Enter the date this CPI was published` for `"2027-02-30"`, `"1999-12-31"`, `"2100-01-01"`, `"15/10/2027"`
- `Set both CPI and its date, or neither` for a CPI with `""` as the date, and for a date with `""` as the CPI

(AC 3, AC 4, AC 5, AC 6)
Proof: `npx vitest run domain/org-settings -t "C1168:"`

**C1169** - `OrgSettingsStore.save` sends `renewal_cpi_pct` and `renewal_cpi_as_of` with the validated values, or both
`null`. `getOrgSettings` maps them back to `renewalCpiPct` (number or `null`) and `renewalCpiAsOf` (`YYYY-MM-DD` or
`null`) (AC 3)
Proof: `npx vitest run infrastructure/supabase -t "C1169:"`

**C1170** - `saveSettingsAction` with each of the three C1168 errors returns that error on its field and calls no store
write (AC 4, AC 5, AC 6)
Proof: `npx vitest run components/settings -t "C1170:"`

**C1171** - `SettingsView` renders `CPI for renewals` and `As of` as inputs for an owner and an admin, and as read-only
text for an estimator and a viewer (`3.2%` and `Oct 15, 2027`, or `Not set`) (AC 7)
Proof: `npx vitest run components/settings -t "C1171:"`

### S2 - auto-renewal below the threshold · 4 files · 75 KB · ~19k

**C1172** - `private.run_renewals('2027-12-01')` on the fixture returns exactly one id, R. R has status `accepted`,
`renews_agreement_id` = A, A's `org_id` and site, and a number `AG-<n>` one above the org's highest (AC 8, door 4)
Proof: `npm run test:db agreement_builder` (assertions `C1172`)

**C1173** - R has one version, `version_no` 1, with `term_start` 2028-01-01, `term_months` 12 and `term_end` 2028-12-31
(AC 9)
Proof: `npm run test:db agreement_builder` (assertions `C1173`)

**C1174** - R's lines keep A's descriptions, visit months, visits per year, positions and coverage asset types.
`cost_per_visit_cents` changes as follows:
- CPI 3.20, cap 5: 25000 becomes 25800 and 19999 becomes 20639
- CPI 4.00, cap 2.5: 19999 becomes 20499
- CPI -1.00: 25000 stays 25000

(AC 10, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1174`)

**C1175** - R's version 1 `snapshot` equals A's latest version's `snapshot` (AC 11)
Proof: `npm run test:db agreement_builder` (assertions `C1175`)

**C1176** - R has exactly one event, `agreement.renewed`, whose payload is `renewsAgreementId` = A, `cpiPct` 3.2,
`appliedPct` 3.2 and `cpiAsOf` `"2027-10-15"`, and exactly one outbox row for that event (AC 12)
Proof: `npm run test:db agreement_builder` (assertions `C1176`)

**C1177** - `run_renewals('2027-11-30')` returns no rows, and no agreement renews A. `run_renewals('2027-12-01')` then
returns one (AC 13)
Proof: `npm run test:db agreement_builder` (assertions `C1177`)

**C1178** - After C1172, `run_renewals('2027-12-01')` and `run_renewals('2027-12-02')` each return no rows, and the
count of agreements renewing A is `1`. Writing the link by hand is also refused: a second agreement with
`renews_agreement_id` = A gets `23505`, an agreement renewing itself gets `23514`, and one renewing an agreement of
another org gets `23503` (AC 14, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C1178`)

**C1179** - Inside the transaction that called `run_renewals`, `pg_locks` holds the advisory lock with key
`hashtext('renewals')`, granted. So a second concurrent call waits for the first to commit, and then finds A already
renewed (AC 15, door 4)
Proof: `npm run test:db agreement_builder` (assertions `C1179`)

**C1180** - After A's terms are frozen, the org changes `cpi_cap_pct` to 0, `cpi_renegotiation_threshold_pct` to 1 and
`renewal_notice_days` to 90. `run_renewals('2027-11-30')` still renews nothing, and `run_renewals('2027-12-01')` still
gives an `accepted` R with `appliedPct` 3.2 (AC 16, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1180`)

**C1181** - With A's frozen `terms` lacking `renewalNoticeDays` and `cpiRenegotiationThresholdPct`, the org's current 30
and 5 are used: nothing on 2027-11-30, auto on 2027-12-01. With A's frozen `cpiCapPct` null, R is a `draft` with reason
`cpi_unset` (door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1181`)

**C1182** - `run_renewals('2028-06-01')` creates nothing for an agreement in each of `draft`, `sent`,
`changes_requested`, `refused`, `expired` and `withdrawn` whose latest version ended 2027-12-31, nor for an `accepted`
one whose latest version has `term_start` null (AC 17)
Proof: `npm run test:db agreement_builder` (assertions `C1182`)

**C1183** - `has_function_privilege` on `private.run_renewals(date)` is `false` for `anon` and `authenticated` (door 4)
Proof: `npm run test:db agreement_builder` (assertions `C1183`)

### S3 - renewal draft at or above the threshold · 2 files · 30 KB · ~8k

**C1184** - With CPI 5.00 and threshold 5.00, R is a `draft` with version 1 `snapshot` `{}`, lines at A's prices (25000
and 19999), and one event `agreement.renewal_drafted` with payload `renewsAgreementId` = A, `cpiPct` 5, `cpiAsOf`
`"2027-10-15"` and `reason` `"at_threshold"`. With CPI 4.99, R is `accepted` (AC 18, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1184`)

**C1185** - With org A's CPI and date both null, R is a `draft` and its event's `reason` is `"cpi_unset"` (AC 19)
Proof: `npm run test:db agreement_builder` (assertions `C1185`)

**C1186** - On run date 2027-12-01: with `renewal_cpi_as_of` 2026-10-31, R is a `draft` with `reason` `"cpi_stale"`;
with 2026-11-01, R is `accepted` (AC 20)
Proof: `npm run test:db agreement_builder` (assertions `C1186`)

**C1187** - With a `draft` agreement D open on A's site, and a second due accepted agreement B on another site of org A,
`run_renewals('2027-12-01')` returns only B's renewal. No agreement renews A, no event names A in `renewsAgreementId`,
and no `notifications` row exists for A. The same holds with D in `sent` and in `changes_requested` (AC 21)
Proof: `npm run test:db agreement_builder` (assertions `C1187`)

**C1188** - A draft R's version 1 has `term_start` 2028-01-01, `term_months` 12 and `term_end` 2028-12-31 (AC 22)
Proof: `npm run test:db agreement_builder` (assertions `C1188`)

**C1189** - As org A's estimator, a draft R accepts `save_service_line` (a new line) and `save_agreement_term`, and
`send_agreement` moves it to `sent` with a frozen `snapshot` (AC 23)
Proof: `npm run test:db agreement_builder` (assertions `C1189`)

### S4 - W7 and renewal emails · 12 files · 120 KB · ~30k

**C1190** - The W7 body for `current_date`, with A due, makes `automation_claim` renew A and return `decision` `send`
with one message of kind `customer_renewal`:
- `to` is `[<A's site contact email>]`
- `agreement {id: R, number}`, `renews {number: A's number}`, `site {name}`
- `oldAnnualCents` 119999, `annualCents` 123839 and `appliedPct` 3.2
- `term {start, end, months}` for R

A `notifications` row exists with key `w7:<R>:customer`, kind `customer_renewal` and status `claimed` (AC 24, door 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1190`)

**C1191** - With CPI unset, the same call returns one message of kind `staff_renewal`:
- `to` is org A's owner and admin emails
- `agreement {id: R, number}`, `renews {number, termEnd}`, `site {name}`, `customer {name}`
- `reason` `"cpi_unset"` and `cpiPct` null

Its row has key `w7:<R>:staff` (AC 25, door 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1191`)

**C1192** - The renewal email content:
- `customer_renewal`, for a renewal starting 2028-01-01: subject `Your service agreement renews on Jan 1, 2028`. The text
  holds `$1,199.99`, `$1,238.39`, `3.2%` and `Jan 1, 2028 – Dec 31, 2028`.
- `staff_renewal`: subject `AG-1013 needs renegotiation before Dec 31, 2027`. The text holds
  `<appBaseUrl>/agreements/<id>` and one sentence per reason, each distinct: `at_threshold`, `cpi_unset` and
  `cpi_stale`.
- Every interpolated name is HTML-escaped in `html`.

(AC 24, AC 25)
Proof: `npx vitest run domain/notifications -t "C1192:"`

**C1193** - After C1190, `automation_complete` with outcome `failed` for that notification, then the W7 body for the
next day (`current_date + 1`), claims `w7:<R>:customer` again and returns its message. No second agreement renews A
(AC 26)
Proof: `npm run test:db outbox_dispatch` (assertions `C1193`)

**C1194** - After C1190, `automation_complete` with outcome `sent`, then the W7 body for `current_date` and for
`current_date + 1`, returns no message for R. The decision is `duplicate` when nothing else is due (AC 27)
Proof: `npm run test:db outbox_dispatch` (assertions `C1194`)

**C1195** - The notify use case, given a `customer_renewal` message whose recipient is `@example.com`, sends nothing
and completes it `skipped` with `reserved_domain` (AC 28)
Proof: `npx vitest run application/use-cases -t "C1195:"`

**C1196** - With A's site having no site contact email, the W7 claim leaves `w7:<R>:customer` `skipped` with
`no_recipient` and returns no message for it. With org A having no owner or admin email, `w7:<R>:staff` is `skipped`
with `no_recipient` (AC 28)
Proof: `npm run test:db outbox_dispatch` (assertions `C1196`)

**C1197** - The W7 body is refused with `22023`, and no agreement renews A, for `idempotencyKey` `w7:2027-1-01`,
`w7:2027-02-30`, `w7:today`, `w5:<current_date>`, and the dates `current_date + 2` and `current_date - 2`. The dates
`current_date + 1` and `current_date - 1` are accepted (AC 29, door 5)
Proof: `npm run test:db outbox_dispatch` (assertions `C1197`)

**C1198** - The W7 body with a wrong signature, and with a timestamp 301 s old, is refused with `42501`, and no
agreement renews A (AC 30)
Proof: `npm run test:db outbox_dispatch` (assertions `C1198`)

**C1199** - `POST /api/automation/notify` with `kind: renewal_daily` answers:
- `200` `sent` when the claim returns messages and every send succeeds
- `200` `duplicate`
- `400` when the claim raises `22023`
- `401` on `42501`
- `409` on `in_flight`
- `503` on a provider `unavailable`

(AC 29, AC 30, Surface)
Proof: `npx vitest run app/api/automation/notify -t "C1199:"`

**C1200** - The automation adapter parses a claim result holding one `customer_renewal` and one `staff_renewal`
message into the typed messages with every C1190 and C1191 field. It rejects a renewal message missing `agreement` as a
malformed claim (door 6)
Proof: `npx vitest run infrastructure/supabase -t "C1200:"`

**C1201** - The notify use case sends each renewal message with `idempotencyKey` equal to its notification key
(`w7:<R>:customer` or `w7:<R>:staff`), and completes each with its `providerMessageId` (door 6)
Proof: `npx vitest run application/use-cases -t "C1201:"`

**C1202** - `automation/n8n/W7-renewal-daily.json`:
- a Schedule trigger at 08:00
- Set, then Crypto HMAC with secret `__SA_HMAC_SECRET__`, then HTTP Request `POST`
  `__SA_APP_BASE_URL__/api/automation/notify` with a raw body
- the body's `kind` is `renewal_daily` and its key is `w7:` plus the date as `yyyy-MM-dd`
- Never Error and full response on, and an error output to an IF on `$runIndex < 6` and a 10-minute Wait back to Set
- no `credentials` and no `$env` anywhere in the file

(door 8)
Proof: `npx vitest run n8n-workflows -t "C1202:"`

**C1203** - `has_function_privilege` stays `false` for `anon` and `authenticated` on `private.claim_notification`, and
`notifications.kind` accepts `customer_renewal` and `staff_renewal` while still refusing `other` with `23514`
(door 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1203`)

### S5 - links and the board · 8 files · 50 KB · ~13k

**C1204** - `AgreementReader.get` returns:
- `renews: {id, number}` from `renews_agreement_id`
- `renewedBy: {id, number}` from the agreement whose `renews_agreement_id` is this one
- `null` for either when absent

(AC 31, AC 32)
Proof: `npx vitest run infrastructure/supabase -t "C1204:"`

**C1205** - `AgreementView` renders:
- `Renewal of AG-1004` as a link to `/agreements/<A id>` when `renews` is set
- `Renewed by AG-1013` as a link to `/agreements/<R id>` when `renewedBy` is set
- neither text when both are `null`

(AC 31, AC 32)
Proof: `npx vitest run components/agreements -t "C1205:"`

**C1206** - `PipelineReader.board` maps:
- an accepted agreement with a renewal in `accepted` or `draft`: no card
- an accepted agreement whose only renewal is `withdrawn`: a card
- a renewal: its card, with `isRenewal: true`
- an agreement with no link: `isRenewal: false`

(AC 33, door 7)
Proof: `npx vitest run infrastructure/supabase -t "C1206:"`

**C1207** - The kanban card renders the marker `Renewal` when `isRenewal` is true, and no such text otherwise (AC 34)
Proof: `npx vitest run components/kanban -t "C1207:"`

**C1208** - As org B's member, a select on `agreements` returns no row of org A, including R, and none whose
`renews_agreement_id` is A (AC 35)
Proof: `npm run test:db rls_isolation` (assertions `C1208`)

### S6 - Expiring soon · 7 files · 35 KB · ~9k

**C1209** - `PipelineReader.expiring(today)` with today 2027-12-01 returns, earliest end first, the accepted agreements
whose latest version ends on 2027-12-01, 2027-12-31 and 2028-02-29 (today + 90). It leaves out 2027-11-30 and
2028-03-01, and leaves out a `sent` agreement ending 2027-12-31. Each row carries site, customer, number, end date,
annual cents, notice date and the renewal (`{number, status}` or `null`) (AC 36)
Proof: `npx vitest run infrastructure/supabase -t "C1209:"`

**C1210** - The Expiring soon state labels, for today 2027-12-01:
- no renewal and a notice date of 2027-12-15: `Renews on Dec 15, 2027: automatic or renegotiated by CPI`
- an `accepted` renewal AG-1013: `Auto-renewed as AG-1013`
- a `draft` renewal AG-1013: `Renewal draft AG-1013`
- no renewal, notice date 2027-11-20, site's open agreement AG-1009: `Renewal blocked: AG-1009 is open`

(AC 37, AC 38, AC 39, AC 40)
Proof: `npx vitest run domain/pipeline -t "C1210:"`

**C1211** - `PipelineReader.expiring` returns the site's open agreement number for a past-notice row with no renewal,
read from the site's agreement in `draft`, `sent` or `changes_requested` (AC 40)
Proof: `npx vitest run infrastructure/supabase -t "C1211:"`

**C1212** - The Expiring soon view renders one row per agreement, with site, customer, number, `Dec 31, 2027`, the
annual total and its C1210 label. With no rows, it renders `No agreements end in the next 90 days.` (AC 36, AC 41)
Proof: `npx vitest run components/kanban -t "C1212:"`

**C1213** - The board renders a link `Expiring soon` to `/pipeline?view=expiring`, and the Expiring soon view renders a
link back to `/pipeline` (AC 42)
Proof: `npx vitest run components/kanban -t "C1213:"`

**C1214** - `/pipeline` with `view=expiring` calls `PipelineReader.expiring` and renders the Expiring soon view. With
no `view`, or with `view=other`, it calls `board` and renders the board (Surface)
Proof: `npx vitest run app -t "C1214:"`

### Delivery · 5 files · 25 KB · ~6k

**C1215** - `demo_seed` finds at least one demo org agreement in `accepted` whose latest version has `term_start` set,
and `demo_seed_rerun` finds every demo version's `term_start` and every demo agreement count unchanged after a second
run (plan assumption: demo data)
Proof: `npm run test:db demo_seed` and `npm run test:db demo_seed_rerun` (assertions `C1215`)

**C1216** - From `web/`, `npm run lint`, `npx tsc --noEmit` and `npm test` each exit 0
Proof: `npm run lint && npx tsc --noEmit && npm test`

**C1217** - Security advisors on the project list no finding that was not on the list before the migration (12 rows, AD-075)
Proof: mcp `get_advisors` security, before and after (recorded in the Handoff)

**C1218** - Live: a signed W7 body sent to the deployed `POST /api/automation/notify` for the demo org answers `200`. A
renewal of the seeded demo agreement exists afterwards, with one `agreement.renewed` or `agreement.renewal_drafted`
event and a `notifications` row `sent` or `skipped` (`reserved_domain` for demo contacts)
Proof: live run plus mcp `execute_sql` (request, response and query recorded in the Handoff)

**C1219** - Live: `/pipeline?view=expiring` as the demo owner, at 1440 and 375 px, shows the demo agreement's row with
its state label and no horizontal page scroll, in one signed-in Playwright context
Proof: Playwright MCP session (screenshots and `scrollWidth <= innerWidth` result recorded in the Handoff)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `org_settings` CPI refused (6) | pct -20.01 C1167 · pct 100.01 C1167 · date 1999-12-31 C1167 · date 2100-01-01 C1167 · pct only C1167 · date only C1167 | - |
| `org_settings` CPI accepted (4) | -20 C1167 · 100 C1167 · 3.20 with date C1167 · both null C1167 | - |
| settings form errors (3) | CPI C1168, C1170 · date C1168, C1170 · pairing C1168, C1170 | - |
| settings roles (4) | owner C1171 · admin C1171 · estimator C1171 · viewer C1171 | - |
| decision outcomes (6) | auto C1172, C1176 · `at_threshold` C1184 · `cpi_unset` no CPI C1185 · `cpi_unset` no cap C1181 · `cpi_stale` C1186 · threshold edge 4.99 C1184 | - |
| price examples (4) | 3.2/5 on 25000 C1174 · 3.2/5 on 19999 C1174 · 4.0/2.5 C1174 · -1.0 C1174 | - |
| due date edges (2) | day before notice C1177 · notice day C1177 | - |
| where cap, threshold, notice come from (2) | frozen C1180 · org fallback C1181 | - |
| not renewable statuses (7) | `draft` C1182 · `sent` C1182 · `changes_requested` C1182 · `refused` C1182 · `expired` C1182 · `withdrawn` C1182 · accepted with no start C1182 | - |
| blocking live statuses (3) | `draft` C1187 · `sent` C1187 · `changes_requested` C1187 | - |
| renewal link refusals (3) | duplicate `23505` C1178 · self `23514` C1178 · other org `23503` C1178 | - |
| renewal email kinds (2) | `customer_renewal` C1190, C1192, C1195 · `staff_renewal` C1191, C1192 | - |
| staff reasons (3) | `at_threshold` C1192 · `cpi_unset` C1191, C1192 · `cpi_stale` C1192 | - |
| notification retry states (2) | `failed` reclaimed C1193 · `sent` not resent C1194 | - |
| skip reasons (2) | `reserved_domain` C1195 · `no_recipient` C1196 | - |
| W7 key refusals (6) | malformed date C1197 · impossible date C1197 · not a date C1197 · wrong prefix C1197 · +2 days C1197 · -2 days C1197 | - |
| W7 key accepted edges (2) | +1 day C1197 · -1 day C1197 | - |
| `POST /api/automation/notify` statuses (6) | `200` sent C1199 · `200` duplicate C1199 · `400` C1199, C1197 · `401` C1199, C1198 · `409` C1199 · `503` C1199 | - |
| `rpc automation_claim` results (3) | `200` jsonb C1190 · `42501` C1198 · `22023` C1197 | - |
| `GET /pipeline?view=expiring` results (3) | `expiring` C1214 · absent C1214 · other value C1214 | - |
| board rule cases (4) | renewal accepted C1206 · renewal draft C1206 · renewal withdrawn C1206 · no link C1206 | - |
| agreement page link states (3) | renews C1205 · renewed by C1205 · neither C1205 | - |
| Expiring soon states (5) | notice ahead C1210 · auto-renewed C1210 · draft C1210, C1211 · blocked C1210, C1211 · empty C1212 | - |
| Expiring soon window edges (4) | today C1209 · today + 90 C1209 · today - 1 C1209 · today + 91 C1209 | - |
| Landing doors (8) | 1 C1178, C1208 · 2 C1167 · 3 C1174, C1180, C1181, C1184 · 4 C1172, C1179, C1183 · 5 C1197 · 6 C1190, C1191, C1201, C1203 · 7 C1206 · 8 C1202 | - |

- Claims naming a status or response shape: C1167, C1178, C1190, C1191, C1197, C1198, C1199, C1200, C1203. The SQL ones
  cross the database boundary, and C1199 and C1200 are at the route and adapter the app answers through.
- No other check claims more than the cases its proof lists.

## Swept

- validation: C1167, C1168, C1197
- failure modes: C1187 - a `23505` rolls back one agreement's subtransaction and the run goes on; C1193 - a failed
  send stays claimable; existing - a migration applies in one transaction
- idempotency: C1178 (one renewal per agreement, unique), C1194 (a sent email is never resent), C1201 (provider
  idempotency key = notification key), C1215 (seed rerun)
- authorization: C1183, C1203 (no client can call the writer), C1198 (signature before any read), C1208 (org
  isolation), C1171 (settings read-only), existing - `org_settings` writes are owner and admin only by RLS (`0001_init`)
- concurrency: C1179 - `run_renewals` holds `hashtext('renewals')` for the transaction, and the unique link (C1178)
  backs it; existing - `claim_notification`'s in-flight rule (AD-076) stops two n8n retries sending twice
- data lifecycle: C1166 (backfill null), C1182 (old and unfinished agreements never renew); n/a - nothing is deleted or
  archived
- dependency failure: C1193 and C1199 `503` - a Resend outage leaves the notification `failed` and W7's retry loop
  (C1202) or the next day's run sends it; existing - AD-079's retry on `409` and `5xx`
- state transitions: C1172, C1184 (created as `accepted` or `draft` only by the writer), C1189 (a renewal draft follows
  the normal machine), C1182 (only `accepted` is renewed)
- observability: C1176, C1184 (each renewal writes an event with its CPI and reason), C1218 (n8n execution id on the
  notification, AD-075); n/a - no new logging requirement

## Handoff

- **Precondition:** term-dates (C1130-C1165) must have a Verifier PASS and its commits must land before the first
  line of this build. Met: committed through `102bb12`, Verifier round 1 PASS (2026-11-02). Feature base `102bb12`.
- Read set, measured with `wc -c` on 2026-11-02:
  - Migrations, SQL and n8n: the outbox-dispatch and term-dates migrations, `seed.sql`, the `outbox_dispatch`,
    `agreement_builder`, `domain_constraints`, `demo_seed` and `fixture` SQL suites, and the W5 export. 167,176 bytes.
  - App: ports, `database.types.ts`, the readers, agreements, settings and automation adapters, the notify use case and
    route, `domain/notifications`, `domain/org-settings`, the settings and agreement components, the pipeline page,
    `n8n-workflows.test.ts` and the notify, automation and container tests. 218,019 bytes.
  - The kanban components and the readers and settings tests: 32,266 bytes.
  - About 417 KB in all, about 104k tokens.
- Written: migration and SQL assertions about 45 KB; app code and tests about 40 KB; W7 export and docs about 15 KB.
  About 100 KB, about 25k tokens. Test output about 10k.
- S1-S6 and delivery come to about 139k against the 150k budget, so one builder. The cut, had it been needed, would
  fall after S4, where the surface moves from the database and automation to the screens.
- Mechanism: one builder (under the budget, no ask)
- **Asks before build (blast radius):**
  - Applying the migration to `gnxebrtcpbujhvcamtoe` through mcp `apply_migration`, with C1166 and C1217 run before and
    after.
  - The live W7 run (C1218), which writes a renewal and a notification on the demo org.
  - The expected test moves, each keeping its claim:
    - `fixture.sql` gains agreement A and org A's CPI.
    - The `OrgSettingsValue` fixtures gain the two fields.
    - The `PipelineCard` and `AgreementDetail` fixtures gain `isRenewal` and `renews` / `renewedBy`.
  - Each is asked when the build starts, and goes under `Settled mid-build` once answered.

## Settled mid-build

- 2026-11-02, user: the migration may be applied to `gnxebrtcpbujhvcamtoe` by mcp `apply_migration`, with C1166 and
  C1217 run before and after. The live W7 run (C1218) is approved once the build is green. Nothing is pushed or deployed.
- 2026-11-02, user: all three fixture moves are approved. They add fields only, and no assertion is weakened.
- 2026-11-02, build: `seed.sql` is left unchanged. Giving AG-1035 a soon-ending term broke term-dates' C1158, and that
  check is not this feature's to weaken. C1215's claim does not depend on it. The live run (C1218) sets AG-1035's
  `term_start` on the demo org by mcp `execute_sql` before the W7 POST, and the Handoff records it.
- 2026-11-02, user: a second session adopted the build after the first left it at `84ac75e` plus uncommitted S1
  work ("adopt and continue"). The first session was still running and committed `7246368` while this one worked.
  `7246368` names C1168-C1171, but it holds the renewal message types (`ports`) and the two email builders
  (`domain/notifications`) of S4, written by this session; S1 is `c567790`. The user then told this session to finish.
- 2026-11-02, build: C1215's second command names a recipe that does not exist (`demo_seed_rerun`). The `demo_seed`
  recipe runs `fixture.sql`, the seed, `demo_seed.sql`, the seed again and `demo_seed_rerun.sql`
  (`web/scripts/test-db/runner.mts:48`), so `npm run test:db demo_seed` proves both halves. The check is unchanged.
- 2026-11-02, build: test moves that keep their claims. `n8n-workflows.test.ts` lists five exports, not four, and
  C1035's count of notify calls goes from 5 to 6, both for W7. W7 joins C1052's retry cases. C1133's stubbed
  `org_settings` row gains `renewal_cpi_pct` and `renewal_cpi_as_of` as null, which `c567790` expected but did not add.
- 2026-11-02, build: the renewal links and Expiring soon use plain `eq` / `in` queries, not a self-referencing embed
  over the composite foreign key, whose PostgREST form this session could not confirm. The board rule reads the
  renewals from the same newest-first read, since a renewal is always newer than the agreement it renews.
- 2026-11-02, build: `domain/pipeline/expiring.ts` adds days with civil-date arithmetic, because C33 bans `new Date(`
  in the domain.

## Delivery results

- **C1166** (2026-11-02, after the migration): `select count(*) filter (where renewal_cpi_pct is not null or
  renewal_cpi_as_of is not null) as set_rows, count(*) as all_rows from public.org_settings;` gave
  `[{"set_rows":0,"all_rows":1}]`. The before run was not recorded by the session that applied the migration.
- **C1217** (2026-11-02, after): `get_advisors` security lists 13 findings: `rls_enabled_no_policy` on `outbox` (1),
  `anon_security_definer_function_executable` (5: `automation_claim`, `automation_complete`, `portal_decide`,
  `portal_record_view`, `portal_view`), `authenticated_security_definer_function_executable` (the same 5 and
  `save_agreement_term`, from term-dates), and `auth_leaked_password_protection` (1). That is AD-075's 12 plus
  term-dates' one; none names a function of this migration (`run_renewals` and `claim_renewals` are in `private`).
  The before list was not recorded, so this compares against the lists those features recorded.
- **C1215:** `npm run test:db demo_seed` passes (2026-11-02).
- **C1216:** `npm run lint` and `npx tsc --noEmit` exit 0. Plain `npm test` (`vitest run`) exits 1 on this machine:
  5 of 2090 fail, every one a 5-second timeout in the known rotating set (C930, C22, C32, C873, C1018 on this run;
  STATE Handoff, and term-dates' C1161 note). `npx vitest run --testTimeout=60000` passes 2090 of 2090.
- **C1218, C1219:** pending the user's choice of where they run (the deployed Railway app runs code from before
  term-dates).
