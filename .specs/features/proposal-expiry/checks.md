# Proposal expiry - checks

Profile: light
Plan: `.specs/features/proposal-expiry/plan.md`

50 checks in 7 slices · 8 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1220:`). This feature numbers
  from C1220, because renewal owns up to `C1219:`.
  - Pure domain code (`validateOrgSettings`, `portalState`, the `staff_expired` email in `domain/notifications`) is
    tested with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup`: `SettingsView`, `AgreementView`, `ReviewView` and the kanban
    card.
  - PDFs are read with `pdf-text.testing.ts` (AD-066).
  - The notify use case is tested in `application/use-cases` with its fakes.
- **test:db** means `npm run test:db <recipe>` in `web/` (AD-026). It runs against project `gnxebrtcpbujhvcamtoe` and
  is rolled back, so it passes only once the migration is applied there.
  - The send, portal and display assertions go into `customer_portal.sql`. The W8 claim and the expiry writer go into
    `outbox_dispatch.sql`. The bounds go into `domain_constraints.sql`, and the site and version guards into
    `agreement_builder.sql`. Each assertion is labelled with its check id.
  - No new recipe, so the runner's pinned counts (C830, C203-C212) do not move.
- **mcp** means a Supabase MCP `execute_sql` or `get_advisors` call on project `gnxebrtcpbujhvcamtoe`. The query and
  its result go in the Handoff.
- **live** means an author-side run, recorded in the Handoff, as renewal's C1218 and C1219 were.

Terms:
- "today" is `(now() at time zone 'America/Vancouver')::date`, written as T in the SQL claims.
- "the fixture" is the `fixture.sql` org A, extended with `tests.pe_sent(<name>, <valid_until>)`. That helper creates a
  `sent` agreement of org A on its own site, whose contact has an email at `example.org`. Its version 1 has one line and
  a term start, and `valid_until` is the given date. It has an `agreement.sent` event whose actor is uE (the estimator)
  and one live portal link. It is created as the table owner, as renewal's `tests.rn_agreement` is.
- "the W8 body" is `{"kind": "expiry_daily", "idempotencyKey": "w8:<yyyy-mm-dd>", "executionId": "<id>"}`. It is
  signed per AD-074 with the test secret, as the W7 assertions sign theirs.

## Checks

### S1 - the tenant sets how long a proposal is valid · 8 files · 45 KB · ~11k

**C1220** - `org_settings.proposal_validity_days` is refused at 0 and 366 with `23514`, and at null with `23502`. It
is accepted at 1 and 365. A new `org_settings` row with no value gets 30 (AC 1, door 2)
Proof: `npm run test:db domain_constraints` (assertions `C1220`)

**C1221** - After the migration, the count of `org_settings` rows on the project whose `proposal_validity_days` is not
30 is `0` (AC 1, door 2)
Proof: mcp `execute_sql` (query and result recorded in the Handoff)

**C1222** - `validateOrgSettings` accepts `proposalValidityDays` `"1"`, `"30"` and `"365"` and returns the numbers 1,
30 and 365. It returns `Proposal validity must be a whole number of days from 1 to 365` for the field on `"0"`,
`"366"`, `"1.5"`, `"abc"` and `""` (AC 2)
Proof: `npx vitest run domain/org-settings -t "C1222:"`

**C1223** - `SettingsView` renders an input labelled `Proposals valid for` holding the saved value (14 renders `14`,
and an org with no change renders `30`). For a viewer that input is read-only, as the term months input is
(AC 1, AC 3)
Proof: `npx vitest run components/settings/settings.test.ts -t "C1223:"`

**C1224** - The settings save action given `proposalValidityDays` `"0"` returns the field error of C1222 and never
calls `OrgSettingsStore.save` (AC 2)
Proof: `npx vitest run components/settings/save-action.test.ts -t "C1224:"`

**C1225** - The settings adapter reads `proposal_validity_days` 14 as `proposalValidityDays: 14`. `save` sends
`proposal_validity_days: 14` in the update it records (AC 1)
Proof: `npx vitest run infrastructure/supabase/settings.test.ts -t "C1225:"`

### S2 - Send stamps the validity date · 3 files · 70 KB · ~18k

**C1226** - With org A's `proposal_validity_days` 30, `send_agreement` on a draft sets the latest version's
`valid_until` to T + 30. With 14, it sets T + 14. Every older version of that agreement keeps null (AC 4, door 3)
Proof: `npm run test:db customer_portal` (assertions `C1226`)

**C1227** - After a send, changing org A's `proposal_validity_days` from 30 to 7 leaves the sent version's
`valid_until` at T + 30 (AC 5)
Proof: `npm run test:db customer_portal` (assertions `C1227`)

**C1228** - `reissue_portal_link` on a sent agreement whose version has `valid_until` 2027-01-15 leaves it at 2027-01-15
(AC 6)
Proof: `npm run test:db customer_portal` (assertions `C1228`)

**C1229** - The `revise` transition from `changes_requested` creates version 2 with `valid_until` null and keeps version
1's date. Sending version 2 sets version 2's `valid_until` to T + 30 and leaves version 1's unchanged (AC 7)
Proof: `npm run test:db customer_portal` (assertions `C1229`)

**C1230** - As uA (owner), a PostgREST-shaped `update public.agreement_versions set valid_until = '2030-01-01'` on an
org A version is refused with `42501`. The column keeps its value (AC 8, door 1)
Proof: `npm run test:db customer_portal` (assertions `C1230`)

**C1231** - Each of these `send_agreement` calls fails, and every version of that agreement keeps `valid_until` null:
- a draft with no service line (`23514`)
- a draft with no term start (`23514`, hint `no_term_start`)
- an agreement already `sent` (`40001`)

(AC 9)
Proof: `npm run test:db customer_portal` (assertions `C1231`)

**C1232** - `agreement_versions.valid_until` is refused at 1999-12-31 and 2100-01-01 with `23514`, and accepted at
2000-01-01, 2099-12-31 and null, when written as the table owner (door 1)
Proof: `npm run test:db domain_constraints` (assertions `C1232`)

**C1233** - After the migration, the project holds no mismatch against the backfill rule. Each of these counts is `0`:
- latest versions of `sent` agreements whose `valid_until` is not their last `agreement.sent` date in America/Vancouver
  plus 30
- versions with `valid_until` set that are not the latest version of a `sent` agreement

(Impact, stored data)
Proof: mcp `execute_sql` (query and result recorded in the Handoff)

### S3 - everyone can see the date · 9 files · 75 KB · ~19k

**C1234** - `AgreementReader.get` returns `validUntil: "2026-12-02"` for a shown version whose `valid_until` is
`2026-12-02`, and `validUntil: null` for one whose `valid_until` is null (AC 10, AC 14)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1234:"`

**C1235** - `AgreementView` renders the validity line as follows:
- `sent` with `validUntil` `"2026-12-02"`: the text `Valid until Dec 2, 2026`
- `sent` with `"2027-01-01"`: `Valid until Jan 1, 2027`, never `Dec 31, 2026`
- `expired` with `"2026-12-02"`: `Expired · was valid until Dec 2, 2026`, with no `Withdraw` and no `Get a new link`
- `sent` with `null`: no `Valid until` text

(AC 10, AC 11, AC 14, AC 15)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1235:"`

**C1236** - `ReviewView` in state `open` renders the validity line as follows:
- `validUntil` `"2026-12-02"`: `Valid until Dec 2, 2026`
- `"2027-01-01"`: `Valid until Jan 1, 2027`
- `null`: no `Valid until` text

(AC 12, AC 14, AC 15)
Proof: `npx vitest run components/review -t "C1236:"`

**C1237** - The staff PDF route for a sent version with `valid_until` `2026-12-02` returns a PDF whose text holds
`Valid until Dec 2, 2026`. For a version with null it holds no `Valid until` (AC 13, AC 14)
Proof: `npx vitest run composition/staff-pdf-terms.test.ts -t "C1237:"`

**C1238** - `GET /review/[token]/pdf` for a view with `version.validUntil` `"2026-12-02"` returns a PDF whose text holds
`Valid until Dec 2, 2026`. With null it holds no `Valid until` (AC 13, AC 14)
Proof: `npx vitest run composition/review-pdf.test.ts -t "C1238:"`

### S4 - the customer cannot decide after the date · 7 files · 75 KB · ~19k

**C1239** - `portalState` answers these cases, for a current, unrevoked link unless stated:
- `sent`, `validUntil` `"2026-12-02"`, today `"2026-12-02"`: `open`
- `sent`, the same date, today `"2026-12-03"`: `expired`
- `sent`, `validUntil` null, today `"2030-01-01"`: `open`
- `accepted`, `validUntil` `"2026-12-02"`, today `"2026-12-03"`: `decided`
- a revoked link, `sent`, the date past: `replaced`

(AC 16, AC 17, AC 19, door 7)
Proof: `npx vitest run domain/portal -t "C1239:"`

**C1240** - `portal_view` for a link of the fixture's sent agreement with `valid_until` 2027-01-15 returns
`version.validUntil` `"2027-01-15"` and `today` equal to T as `YYYY-MM-DD`. A version with null returns
`version.validUntil` null (door 7, Surface)
Proof: `npm run test:db customer_portal` (assertions `C1240`)

**C1241** - `portal_decide` gives these results:
- a version with `valid_until` T - 1: accept, refuse and request changes each raise `40001`. The agreement stays
  `sent`, with no new event and no new outbox row.
- `valid_until` T: accept succeeds.
- `valid_until` null: accept succeeds.

(AC 16, AC 18, AC 19, door 7)
Proof: `npm run test:db customer_portal` (assertions `C1241`)

**C1242** - The portal reader maps `version.validUntil` and `today` from the `portal_view` payload onto `PortalView`
(`validUntil: "2027-01-15"`, `today: "2026-11-02"`) (door 7)
Proof: `npx vitest run infrastructure/supabase/portal.test.ts -t "C1242:"`

**C1243** - `/review/[token]` for a `sent` view whose `validUntil` is the day before its `today` renders
`This agreement has expired.` with no `Accept` button (AC 17)
Proof: `npx vitest run "app/review/[token]/page.test.ts" -t "C1243:"`

### S5 - W8 expires overdue proposals · 3 files · 115 KB · ~29k

**C1244** - `private.run_expiries('2027-02-01')` with the fixture agreement X at `valid_until` 2027-01-31 returns X's
id. X is then `expired`, with exactly one `agreement.expired` event:
- `actor_id` is null
- the payload is exactly `{"from": "sent", "to": "expired", "versionNo": 1, "validUntil": "2027-01-31", "via": "w8"}`
- one `outbox` row exists for that event

(AC 20, door 4)
Proof: `npm run test:db outbox_dispatch` (assertions `C1244`)

**C1245** - `private.run_expiries('2027-01-31')` with X at `valid_until` 2027-01-31 returns no row. X stays `sent`, and
no `agreement.expired` event exists (AC 21)
Proof: `npm run test:db outbox_dispatch` (assertions `C1245`)

**C1246** - `private.run_expiries('2027-02-01')` leaves each of these unchanged, with no `agreement.expired` event, even
when its latest version holds `valid_until` 2027-01-31: `draft`, `accepted`, `refused`, `changes_requested`,
`withdrawn` and `expired`. A `sent` agreement whose latest version has `valid_until` null is unchanged too. So is a
`sent` agreement whose version 1 has 2027-01-31 and whose latest version 2 has 2027-03-01 (AC 22)
Proof: `npm run test:db outbox_dispatch` (assertions `C1246`)

**C1247** - `run_expiries('2027-02-01')` twice, then `run_expiries('2027-02-02')`, leaves exactly one
`agreement.expired` event for X. The second and third calls return no row (AC 23)
Proof: `npm run test:db outbox_dispatch` (assertions `C1247`)

**C1248** - These results hold for a race between a decision and an expiry, with X at `valid_until` 2027-01-31:
- `portal_decide` accept first, then `run_expiries('2027-02-01')`: X stays `accepted`, with no `agreement.expired`
  event.
- `run_expiries` first, then `portal_decide`: `40001`, and X stays `expired`, with no decision event.
- Inside the transaction that called `run_expiries`, `pg_locks` holds the advisory lock with key
  `hashtext('expiries')`, granted, so a second concurrent run waits for the first to commit (as renewal's C1179).

(AC 24, door 4)
Proof: `npm run test:db outbox_dispatch` (assertions `C1248`)

**C1249** - `automation_claim` with the W8 body raises `22023` and expires nothing for each of these keys:
- `w8:2027-13-01`
- `w8:2027-02-30`
- `w8:tomorrow`
- `w7:<T>`
- `w8:<T + 2>`
- `w8:<T - 2>`

The keys `w8:<T + 1>` and `w8:<T - 1>` are accepted (AC 25, door 5)
Proof: `npm run test:db outbox_dispatch` (assertions `C1249`)

**C1250** - After `run_expiries` expires X, `create_agreement` on X's site as uA returns a new agreement id in `draft`
(AC 26)
Proof: `npm run test:db outbox_dispatch` (assertions `C1250`)

**C1251** - After X has expired, a signed W1 `customer_reminder` body for X's `agreement.sent` event with key
`w1:<eventId>:day3` returns `decision` `skip` with reason `decided` (AC 27)
Proof: `npm run test:db outbox_dispatch` (assertions `C1251`)

**C1252** - `private.run_expiries` and `private.claim_expiries` raise `42501` when called as `authenticated` (uA) and
as `anon` (door 4)
Proof: `npm run test:db outbox_dispatch` (assertions `C1252`)

**C1253** - After the redefinition of the three automation functions, the W7, W5, W3 and W1 claim assertions still pass
(C1190-C1199, C1003-C1032 in `outbox_dispatch.sql`), and so does the whole `customer_portal` recipe (Impact, stored
data)
Proof: `npm run test:db outbox_dispatch` and `npm run test:db customer_portal` (each recipe's last row is `pass`)

### S6 - the estimator is told · 9 files · 110 KB · ~28k

**C1254** - The W8 body for T, with X at `valid_until` T - 1, makes `automation_claim` expire X. It returns `decision`
`send` with one message of kind `staff_expired`:
- `to` is `[<uE's email>]`
- `agreement {id: X, number}`, `customer {name}`, `site {name}`, `validUntil: "<T - 1>"`

A `notifications` row exists with key `w8:<eventId>`, kind `staff_expired`, status `claimed` and `recipients` `[<uE's
email>]` (AC 28, door 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1254`)

**C1255** - The `staff_expired` recipient falls back as follows:
- uE's membership removed before the claim: `to` is org A's owner and admin emails.
- uE removed and org A with no owner or admin left: the notification is `skipped` with `no_recipient`, and the claim's
  `decision` is `skip`.

(AC 29, door 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1255`)

**C1256** - The `staff_expired` email for agreement `AG-1004` (customer `Acme <Holdings>`, site `Plant 2`, `validUntil`
`"2026-12-02"`) has:
- the subject `AG-1004 expired without a decision`
- a text holding `Acme <Holdings>`, `Plant 2`, `Valid until Dec 2, 2026` and `<appBaseUrl>/agreements/<id>`
- an html holding `Acme &lt;Holdings&gt;` and never `Acme <Holdings>`

(AC 30)
Proof: `npx vitest run domain/notifications -t "C1256:"`

**C1257** - The notify use case, given a claim answer with one `staff_expired` message, does this:
- sends one email to the message's `to` with the C1256 subject and `idempotencyKey` = the notification's key
- completes it `sent` with the provider id
- with a `reserved_domain` recipient, completes it `skipped` with no send

(AC 28, AC 30)
Proof: `npx vitest run application/use-cases/notify.test.ts -t "C1257:"`

**C1258** - These results hold after C1254:
- `automation_complete` with outcome `failed`, then the W8 body for T + 1, claims `w8:<eventId>` again and returns its
  message. X has one `agreement.expired` event.
- With outcome `sent` instead, the W8 body for T and for T + 1 returns no message for X, with `decision` `duplicate`
  when nothing else is due.

(AC 31)
Proof: `npm run test:db outbox_dispatch` (assertions `C1258`)

**C1259** - `automation_complete` treats an `expiry_daily` body's results as follows:
- it accepts a result naming that `staff_expired` notification
- it raises `P0002` for one naming a `staff_renewal` notification
- it raises `P0002` for one naming a `customer_link` notification
- it raises `22023` for a malformed result (outcome `maybe`)
- it raises `42501` for an `expiry_daily` body signed with another secret, and records nothing

(AC 32)
Proof: `npm run test:db outbox_dispatch` (assertions `C1259`)

**C1260** - `automation/n8n/W8-expiry-daily.json` and the n8n tests meet these claims:
- The export's Schedule runs at 08:00 in America/Vancouver and starts Set → Crypto HMAC → one signed POST to
  `__SA_APP_BASE_URL__/api/automation/notify`.
- The body is `kind` `expiry_daily` with key `w8:<yyyy-MM-dd>`.
- The error output goes to an IF whose condition is `$runIndex` with operator `lt` (number) and right value `6`, then
  to a 10-minute Wait back to Set.
- The file holds no credential and no `$env`.
- `n8n-workflows.test.ts` finds exactly six exports and seven notify calls.

(AC 33, door 8)
Proof: `npx vitest run n8n-workflows.test.ts -t "C1260:"`, and `npx vitest run n8n-workflows.test.ts -t "C1033:"` and
`-t "C1035:"` with their counts moved to six and seven

**C1269** - `POST /api/automation/notify` with an `expiry_daily` body answers as follows:
- `401` for a missing `X-SA-Signature`
- `400` when the claim raises `22023`
- `409` when it answers `in_flight`
- `503` when `EmailSender` answers `unavailable`
- `200` `{outcome: "sent"}` when the one `staff_expired` message is sent

(Surface)
Proof: `npx vitest run app/api/automation/notify -t "C1269:"`

### S7 - an expiry is told apart from a refusal · 3 files · 15 KB · ~4k

**C1261** - The kanban card of an `expired` agreement in the Refused column renders a neutral `Expired` pill. A
`refused` agreement's card renders none (AC 34)
Proof: `npx vitest run components/kanban -t "C1261:"`

**C1262** - The pipeline reader carries each card's agreement status, so an `expired` agreement's card gets `status:
"expired"` (AC 34)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1262:"`

### Delivery · 6 files · 30 KB · ~8k

**C1263** - From `web/`, `npm run lint`, `npx tsc --noEmit` and `npm test` each exit 0, the last with the plain command
(L-020)
Proof: `npm run lint && npx tsc --noEmit && npm test`

**C1264** - The security advisors on the project list no finding outside renewal's 13 (C1217). None names
`run_expiries` or `claim_expiries`
Proof: mcp `get_advisors` security, after (recorded in the Handoff, compared with C1217's list)

**C1265** - `npm run test:db demo_seed`, `agreement_builder` and `domain_constraints` each end in `pass`, with
`seed.sql` unchanged (plan assumption: seed)
Proof: `npm run test:db demo_seed`, `npm run test:db agreement_builder`, `npm run test:db domain_constraints`

**C1266** - Live: one sent demo agreement gets its latest version's `valid_until` set to yesterday (Vancouver) by mcp
`execute_sql`. A signed W8 body for today, posted to `POST /api/automation/notify` of the app running at HEAD, then
gives these results:
- the answer is `200`
- that agreement is `expired`, with one `agreement.expired` event
- its `w8:<eventId>` notification is `sent`, or `skipped` with `reserved_domain`

Proof: live run plus mcp `execute_sql` (request, response and queries recorded in the Handoff)

**C1267** - Live, in one signed-in Playwright context, at 1440, 768 and 375 px:
- `/settings` shows `Proposals valid for`.
- The expired demo agreement's page shows `Expired · was valid until <date>`.
- A sent demo agreement's page shows `Valid until <date>`.
- The board's Refused column shows its card with `Expired`.

Each page has `scrollWidth <= innerWidth`, no console error, and touch targets of at least 44 px at 768 and 375
(AGENTS.md)
Proof: Playwright MCP session (screenshots, scroll and console results recorded in the Handoff)

**C1268** - Live: the review link of a sent demo agreement shows `Valid until <date>` at 1440 and 375 px, with no
horizontal page scroll. After its version's `valid_until` is set to yesterday by mcp, the same link shows
`This agreement has expired.` with no decision buttons
Proof: Playwright MCP session (recorded in the Handoff)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `proposal_validity_days` bounds (6) | 0 C1220 · 366 C1220 · null C1220 · 1 C1220 · 365 C1220 · default 30 C1220, C1221 | - |
| validity form inputs refused (5) | `"0"` C1222 · `"366"` C1222 · `"1.5"` C1222 · `"abc"` C1222 · `""` C1222 | - |
| validity form inputs accepted (3) | `"1"` C1222 · `"30"` C1222 · `"365"` C1222 | - |
| settings roles (2) | writer editable C1223 · viewer read-only C1223 | - |
| `valid_until` bounds (5) | 1999-12-31 C1232 · 2100-01-01 C1232 · 2000-01-01 C1232 · 2099-12-31 C1232 · null C1232 | - |
| what leaves `valid_until` alone (5) | setting change C1227 · reissue C1228 · revise C1229 · member update C1230 · failed send C1231 | - |
| failed sends (3) | no line C1231 · no term start C1231 · not draft C1231 | - |
| validity line states (4) | sent C1235, C1236, C1237, C1238 · expired C1235 · null C1235, C1236, C1237, C1238 · Jan 1 date C1235, C1236 | - |
| `portalState` cases (5) | before or on the date C1239 · past the date C1239 · null C1239 · decided C1239 · revoked C1239 | - |
| `portal_decide` date cases (3) | T - 1 refused C1241 · T accepted C1241 · null accepted C1241 | - |
| `portal_decide` decisions refused past the date (3) | accept C1241 · refuse C1241 · request changes C1241 | - |
| run date edges (2) | `valid_until` = R - 1 expires C1244 · `valid_until` = R stays C1245 | - |
| statuses W8 never touches (6) | `draft` C1246 · `accepted` C1246 · `refused` C1246 · `changes_requested` C1246 · `withdrawn` C1246 · `expired` C1246 | - |
| sent but not due (2) | null date C1246 · older version due, latest not C1246 | - |
| race orders (2) | decide then expire C1248 · expire then decide C1248 | - |
| W8 key refusals (6) | `w8:2027-13-01` C1249 · `w8:2027-02-30` C1249 · `w8:tomorrow` C1249 · `w7:` prefix C1249 · T + 2 C1249 · T - 2 C1249 | - |
| W8 key accepted edges (2) | T + 1 C1249 · T - 1 C1249 | - |
| `staff_expired` recipients (3) | sender C1254 · owners and admins C1255 · none, `no_recipient` C1255 | - |
| notification retry states (2) | `failed` reclaimed C1258 · `sent` not resent C1258 | - |
| skip reasons (2) | `no_recipient` C1255 · `reserved_domain` C1257 | - |
| `automation_complete` result kinds for `expiry_daily` (3) | `staff_expired` C1259 · `staff_renewal` C1259 · `customer_link` C1259 | - |
| `rpc automation_claim` / `POST /api/automation/notify` statuses (5) | `200` C1254, C1269, C1266 · `400` C1249, C1269 · `401` C1269 · `409` C1269 · `503` C1269 | - |
| `rpc automation_complete` statuses (4) | `200` C1258 · `400` C1259 · `401` C1259 · `404` C1259 | - |
| `rpc portal_view` statuses (1) | `200` C1240 | - |
| `rpc portal_decide` statuses (2) | `200` C1241 · `40001` C1241, C1248 | - |
| who callers of `expired` stay correct (5) | `portalState` C1239 · `pipelineStage` existing C1262, C1261 · live index C1250 · W1 reminder C1251 · W5 digest C1253 | - |
| redefined functions (6) | `send_agreement` C1226, C1231, C1253 · `portal_view` C1240, C1253 · `portal_decide` C1241, C1253 · `automation_request` C1249, C1253 · `automation_claim` C1254, C1253 · `automation_complete` C1259, C1253 | - |
| startup config: the settings field (2 assemblies) | domain validator C1222 · adapter C1225 | - |
| Landing doors (8) | 1 C1230, C1232 · 2 C1220, C1221 · 3 C1226 · 4 C1244, C1248, C1252 · 5 C1249 · 6 C1254, C1255 · 7 C1239, C1240, C1241 · 8 C1260 | - |

- Claims naming a status or a response shape are C1220, C1230, C1231, C1232, C1240, C1241, C1244, C1249, C1252,
  C1254, C1259 and C1266. Each crosses the database or the route boundary.
- Door 3's America/Vancouver date: C1226 compares with T, so the proof tells it apart from a UTC `current_date` only
  between 00:00 UTC and Vancouver midnight. The literal shape is in the plan, and the Verifier reads the definition.
- No other check claims more than the cases its proof lists.

## Swept

- validation: C1220, C1222, C1232, C1249
- failure modes: C1231 (a failed send stamps nothing); C1258 (a failed email stays claimable); existing - a migration
  applies in one transaction
- idempotency: C1247 (one expiry per agreement), C1258 (a sent email is never resent), C1257 (provider idempotency key =
  notification key)
- authorization: C1230 (no member writes the date), C1252 (no client calls the writer), C1223 (settings read-only for a
  viewer); existing - signature before any read (renewal's signature-first claim test), `org_settings` writes are owner and admin only by RLS
- concurrency: C1248 - the expiry and a decision both lock the agreement row and compare-and-set on `sent`, and
  `run_expiries` holds `hashtext('expiries')`
- data lifecycle: C1233 (backfill of sent agreements only), C1221 (the setting's default on existing rows); n/a - nothing
  is deleted or archived, and an expired agreement keeps its link and its PDF
- dependency failure: C1258 - a Resend outage leaves the notification `failed` and the next run sends it; existing -
  AD-079's retry loop, asserted for W8 in C1260
- state transitions: C1244 (`sent` → `expired` only), C1246 (no other status moves), C1241 and C1248 (no decision after
  the date or after an expiry)
- observability: C1244 (each expiry writes an event carrying `validUntil` and `via: "w8"`), C1266 (n8n execution id on
  the notification, AD-075); n/a - no new logging requirement

## Handoff

- **Precondition:** renewal (C1166-C1219) has a Verifier PASS, and its commits are on `development` through
  `c2f23eb`. Met. The feature base is `c2f23eb`.
- Read set, measured with `wc -c` on 2026-11-02 over the files the slices touch: about 517 KB. That covers the latest
  three migrations, the `outbox_dispatch`, `customer_portal`, `domain_constraints` and `fixture` SQL suites, ports, the
  readers, agreements, portal, settings and automation adapters, the notify use case, `domain/notifications`,
  `domain/org-settings`, `domain/portal`, the settings, agreement, review and kanban components, both PDF routes, and
  `n8n-workflows.test.ts`.
  - The two largest suites (`outbox_dispatch.sql` 58 KB and `customer_portal.sql` 47 KB) and the migrations are read in
    part, at their W7 and send sections. The expected read is about 360 KB, about 90k tokens.
- Written: migration and SQL assertions about 50 KB, app code and tests about 35 KB, and the W8 export and docs about
  10 KB. About 95 KB, about 24k tokens. Test output adds about 10k.
- S1-S7 and delivery come to about 124k against the 150k budget, so one builder. The cut, had it been needed, would
  fall after S6, where the surface moves from the database and automation to the board.
- Mechanism: one builder (under the budget, no ask)
- **Asks before build (blast radius):**
  - Applying the migration to `gnxebrtcpbujhvcamtoe` through mcp `apply_migration`, with C1221 and C1233 run after it
    and C1264 compared with C1217.
  - The live runs (C1266, C1268). They set `valid_until` on demo versions, expire one demo agreement and write one
    notification on the demo org.
  - The expected test moves, each keeping its claim:
    - `n8n-workflows.test.ts` C1033 and C1035 counts go to six exports and seven notify calls.
    - The `OrgSettingsValue`, `AgreementDetail`, `PortalView` and `PipelineCard` fixtures gain the new fields.

## Settled mid-build

- 2026-11-02, user: the migration may be applied to `gnxebrtcpbujhvcamtoe` by mcp `apply_migration`. The live runs
  (C1266-C1268) on the demo org are approved, and so are the test moves listed above. They add fields only, and no
  assertion is weakened. Nothing is pushed or deployed.
- 2026-11-02, build: C1259 corrected before any test existed. `automation_complete` answers a result naming another
  body's notification with `P0002` (the route's `404`) for every kind (renewal migration, `automation_complete`), and
  the check had claimed `22023`. The check now claims `P0002` for that case and `22023` for a malformed result. The
  plan's Surface row keeps its approved text and gains a correction line below it.
- 2026-11-02, build: C1248 restated before any test existed. `test:db` runs in one session, which never blocks on
  its own advisory or row lock, so the `55P03` bullet and the `for update` bullet could not be proven as written. The
  lock bullet now reads `pg_locks`, as renewal's C1179 does. The row-lock bullet is dropped: the expiry is a
  compare-and-set `update ... where status = 'sent'`, and the two sequential orders prove that a decision committed
  first wins and an expiry committed first refuses the decision.
- 2026-11-02, build: the C1237 and C1238 proofs moved to `composition/`, with the claims unchanged. A test holds a
  route and the real PDF renderer only in `composition/` (the rule stated in `composition/staff-pdf-terms.test.ts`).
  Both route tests under `app/` use a fake renderer, which cannot read the PDF's text.
- 2026-11-02, build: the plan's assumption "the PDF still downloads" after expiry is wrong about today's code. The
  review PDF route already answers an empty `404` for a link in state `expired`, as it does for `withdrawn`. No check
  claims otherwise, and the behaviour is left as it is. The page still shows `This agreement has expired.`.
