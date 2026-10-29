# Outbox dispatch, n8n W1/W3/W5 and transactional email - checks

Profile: standard
Plan: `.specs/features/outbox-dispatch/plan.md`

51 checks in 7 slices plus doors and delivery · 8 one-way doors · 4 open (3 block go-live, none blocks the build)

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1001:`). This feature numbers from C1001, because customer-portal ends at `C952`. Proofs name the folder or file filter their test sits in; the file inside it is the builder's call.
  - Pure code (the email builders, reason wording, key formats) is tested with literal values.
  - Adapters are tested with the recording `stubClient` (`infrastructure/supabase/stub-client.ts`) or a stubbed `fetch`.
  - The route is tested like `app/auth/confirm/route.test.ts`: `vi.mock("@/composition")` supplies the container, and the test calls `POST` with a `NextRequest`.
  - Views are asserted with `renderToStaticMarkup`, as `components/agreements` does.
  - The n8n exports are read as JSON from `automation/n8n/` by a test under `web/` (file name contains `n8n-workflows`).
- **test:db** - `npm run test:db outbox_dispatch` in `web/` (AD-026) runs `fixture.sql`, then the new `supabase/tests/outbox_dispatch.sql`, all rolled back. The file joins `RECIPES` as `plain("outbox_dispatch")` and passes only when its last row is `outbox_dispatch: pass`. Each assertion is labelled with its check id (`assertions C1001`).
  - The test sets its own Vault secrets inside the transaction: `n8n_events_url` = `https://n8n.test/webhook/events` and `automation_hmac_secret` = `test-secret`. If secrets with those names already exist, it updates them in the transaction, and the rollback undoes that.
  - pg_net requests only start after commit, so each rolled-back request stays in `net.http_request_queue`, where the test reads it. Responses are faked by inserting rows into `net._http_response`.
  - Signed callbacks are built in SQL with `extensions.hmac` and `test-secret`. The test signs in as `anon`, as the org A owner `uA`, estimator `uE` and viewer `uV`, and as the org B owner `uB`.
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated output.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real run against the dev server or the live project, recorded in the Handoff. Anything that commits to the live project, or writes Vault secrets there, waits for the user's go-ahead for that action (blast radius).

Terms:

- "the dispatcher" is `private.dispatch_outbox()`; "a due row" is an `outbox` row in `pending` whose `available_at <= now()`.
- "a signed body" is a body sent with `X-SA-Timestamp` = now in unix seconds and `X-SA-Signature` = `sha256=` + hex HMAC-SHA256(`test-secret`, `<timestamp>.<body>`).
- "the route" is `POST /api/automation/notify`; "claim" and "complete" are `public.automation_claim` and `public.automation_complete`.
- **Fixture agreement**: org A's agreement, `sent`, version 1, whose site has a contact with email `pat@customer.ca`, and whose `agreement.sent` event has actor `uE`. It has a live link with a sealed token, and legal name, phone and accent from the fixture settings. Built in the test file on top of `fixture.sql`.
- **Skip reasons** are the 7 values `decided`, `superseded`, `viewed`, `no_recipient`, `no_link_secret`, `reserved_domain` and, for W5 only, none (no row stored).

## Checks

### S1 - Outbox rows reach n8n, signed, at least once · ~4 files · ~30k

**C1001** - With both secrets set and 1 due row, the dispatcher inserts exactly 1 `net.http_request_queue` row with method `POST`, url `https://n8n.test/webhook/events`, and headers holding `Content-Type: application/json`, `X-SA-Timestamp` and `X-SA-Signature`. Its body JSON has exactly the 8 keys `deliveryId`, `eventId`, `type`, `entityType`, `entityId`, `orgId`, `payload`, `occurredAt`, with `eventId` and `type` equal to the event's. The outbox row becomes `sending` with `request_id` equal to the queue row's id. A `pending` row with `available_at` 1 minute in the future is not queued (AC 1)
Proof: `npm run test:db outbox_dispatch` (assertions `C1001`)

**C1002** - The queued `X-SA-Signature` equals `'sha256=' || encode(extensions.hmac(<X-SA-Timestamp> || '.' || convert_from(<queued body>, 'UTF8'), 'test-secret', 'sha256'), 'hex')`, computed from the queued bytes. A fixed vector (secret `test-secret`, timestamp `1700000000`, body `{"a":1}`) gives the same 64-hex string in SQL and in Node `crypto.createHmac`, the function n8n's Crypto node uses. The literal hex is written once in each test (AC 2)
Proof: `npm run test:db outbox_dispatch` (assertions `C1002`)
Proof: `npm test -- n8n-workflows -t "C1002:"`

**C1003** - For a `sending` row whose request has a `net._http_response` with status `200`, `204` or `299` (3 inputs), the next dispatcher run sets the row `sent`, with `sent_at` not null and `attempts` unchanged (AC 3)
Proof: `npm run test:db outbox_dispatch` (assertions `C1003`)

**C1004** - For a `sending` row whose response is status `300`, `404` or `500`, or has `timed_out = true`, or has an `error_msg` with a null status (5 inputs), the next run increments `attempts`, stores a non-empty `last_error` and sets the row `pending`. A `sending` row with no response 11 minutes after dispatch is treated the same, and one dispatched 9 minutes ago stays `sending`. Table-driven over attempts 1 to 7: `available_at` is now + 1, 5, 15, 60, 240, 720 and 1440 minutes, each within 1 second (AC 4)
Proof: `npm run test:db outbox_dispatch` (assertions `C1004`)

**C1005** - A row at `attempts = 7` that fails again ends with `attempts = 8` and status `failed`. A further run queues nothing for it (the queue count is unchanged) and leaves it `failed` (AC 5)
Proof: `npm run test:db outbox_dispatch` (assertions `C1005`)

**C1006** - Running the dispatcher twice in a row with 1 due row queues 1 request, not 2. With 51 due rows, the first run queues exactly 50 and the second the remaining 1. `pg_get_functiondef` of the dispatcher contains `for update skip locked` and `pg_try_advisory_xact_lock(hashtext('outbox-dispatch'))` (AC 6)
Proof: `npm run test:db outbox_dispatch` (assertions `C1006`)

**C1007** - With `n8n_events_url` missing, and separately with `automation_hmac_secret` missing (2 inputs), a run with 1 due row queues nothing and leaves every outbox row's `status`, `attempts` and `available_at` unchanged (AC 7)
Proof: `npm run test:db outbox_dispatch` (assertions `C1007`)

**C1008** - On the live project after the migration, `select count(*) from outbox where status = 'pending' and created_at < '<migration time>'` is 0. Every row that was `pending` before (count recorded in the Handoff before applying) is `failed` with `last_error = 'enqueued before dispatch existed'` (AC 8)
Proof: mcp `execute_sql` before and after `apply_migration`, numbers recorded in the Handoff

**C1009** - As `anon` and as `uE` (2 roles), `select private.dispatch_outbox()` raises `42501` and `select * from public.outbox` raises `42501`. `has_function_privilege('anon', 'private.dispatch_outbox()', 'execute')` and the same for `authenticated` are false (AC 9)
Proof: `npm run test:db outbox_dispatch` (assertions `C1009`)

### S2 - Signed callbacks are verified once, in the database · ~6 files · ~35k

**C1010** - The route answers `401` without calling the container's claim for each of: no `X-SA-Timestamp`, no `X-SA-Signature`, a timestamp that is not 1 to 12 digits (`12a`), and a signature not matching `^sha256=[0-9a-f]{64}$` (`sha256=XYZ`, `md5=<64 hex>`). That is 5 inputs, and the recorded claim mock has 0 calls (AC 10)
Proof: `npm test -- app/api/automation -t "C1010:"`

**C1011** - `automation_claim` raises `42501` and inserts no `notifications` row and writes no `events.n8n_execution_id` for: a signature made with `wrong-secret`, a body changed by 1 character after signing, a timestamp 301 s in the past, and one 301 s in the future (4 inputs). A timestamp 299 s in the past is accepted. The adapter maps `42501` to `unauthorized` and the route answers `401` (AC 11)
Proof: `npm run test:db outbox_dispatch` (assertions `C1011`)
Proof: `npm test -- app/api/automation -t "C1011:"`

**C1012** - Each signed body below makes claim raise `22023` and write nothing, and the route answers `400`. That is 6 inputs:
- not JSON
- `kind` = `fax`
- `customer_link` without `eventId`
- `staff_decision` without `eventId`
- no `idempotencyKey`
- a `customer_link` whose key is not `w1:<its eventId>:link`

The 5 valid key formats each pass the format check: `w1:<eventId>:link`, `w1:<eventId>:day3`, `w1:<eventId>:day7`, `w3:<eventId>` and `w5:<yyyy-mm-dd>` (AC 12)
Proof: `npm run test:db outbox_dispatch` (assertions `C1012`)
Proof: `npm test -- app/api/automation -t "C1012:"`

**C1013** - A verified `customer_link` callback with `executionId` `exec-1` on the fixture's `agreement.sent` event (whose `n8n_execution_id` is null) sets it to `exec-1`. A second verified callback with key `w1:<id>:day3` and `exec-2` leaves it at `exec-1` (AC 13)
Proof: `npm run test:db outbox_dispatch` (assertions `C1013`)

**C1014** - Claiming a key whose notification is `sent`, and one whose notification is `skipped` (2 inputs), returns `decision = duplicate`, changes no row, and the route answers `200` with `outcome: "duplicate"`, with 0 calls to `EmailSender.send` (AC 14)
Proof: `npm run test:db outbox_dispatch` (assertions `C1014`)
Proof: `npm test -- app/api/automation -t "C1014:"`

**C1015** - Claiming a key whose notification is `claimed` and 9 minutes old returns `in_flight`, and the route answers `409` without sending. Claiming one `claimed` 11 minutes ago, or `failed` (2 inputs), returns `send` and leaves exactly 1 row for the key. Two claims of a new key in sequence give `send`, then `in_flight` (AC 15)
Proof: `npm run test:db outbox_dispatch` (assertions `C1015`)
Proof: `npm test -- app/api/automation -t "C1015:"`

**C1016** - When `EmailSender.send` returns `unavailable`, the use case calls complete with outcome `failed` and the error, and the route answers `503`. When it returns `rejected`, the result is the same. A `failed` row claimed again returns `send` (C1015), so the email goes out on the retry (AC 16)
Proof: `npm test -- application/use-cases -t "C1016:"`
Proof: `npm test -- app/api/automation -t "C1016:"`

**C1017** - A signed `customer_link` callback naming an event id that does not exist, or whose `agreement.sent` event belongs to org B while the body names org A's agreement (2 inputs), makes claim raise `P0002`, write nothing, and the route answer `404`. If the claim adapter throws an unexpected error, the route answers `503` and logs the cause with `console.error` (Surface `404`, `503`)
Proof: `npm run test:db outbox_dispatch` (assertions `C1017`)
Proof: `npm test -- app/api/automation -t "C1017:"`

**C1018** - With `RESEND_API_KEY` unset, the route answers `503` for a valid signed request and logs `email not configured`, and no `fetch` is made (Assumption: dev without the key)
Proof: `npm test -- composition -t "C1018:"`

### S3 - The customer gets the link and two reminders · ~6 files · ~35k

**C1019** - For the fixture agreement, claim of `customer_link` returns 1 message with:
- `to` = `pat@customer.ca`
- the tenant's legal name and phone
- the agreement number, the site name and `annualCents`
- the live link's `token_sealed`

The built email has:
- `fromName` = the legal name
- subject `Service agreement <number> from <legal name>`
- a link with text `Review the agreement` whose `href` is `<APP_BASE_URL>/review/<unsealed token>`
- the site name, the total formatted as `$3,870.00` followed by `before tax`, and the phone. With phone `null`, there is no `null` or `undefined` text

Neither the html nor the text contains `Service Agreement` (title case, the working product name) or `felipeviana` (AC 17)
Proof: `npm run test:db outbox_dispatch` (assertions `C1019`)
Proof: `npm test -- domain/notifications -t "C1019:"`
Proof: `npm test -- application/use-cases -t "C1019:"`

**C1020** - A `customer_reminder` (`day3` and `day7`, 2 inputs) has subject `Reminder: service agreement <number> from <legal name>` and the same body facts as C1019. After `reissue_portal_link` with a new sealed token, the reminder's claim returns the new link's `token_sealed`, not the revoked one (AC 18)
Proof: `npm run test:db outbox_dispatch` (assertions `C1020`)
Proof: `npm test -- domain/notifications -t "C1020:"`

**C1021** - A `customer_reminder` is stored `skipped` with no email sent. The reason is `decided` for agreement status `accepted`, `refused`, `changes_requested` and `withdrawn` (4 inputs), `superseded` when the event's version is no longer the newest, and `viewed` when the live link has `first_viewed_at` set (AC 19)
Proof: `npm run test:db outbox_dispatch` (assertions `C1021`)

**C1022** - A `customer_link` for a site with no `site_contact_id`, and one whose contact's `email` is null (2 inputs), is stored `skipped` with `no_recipient` (AC 20)
Proof: `npm run test:db outbox_dispatch` (assertions `C1022`)

**C1023** - A `customer_link` for a version whose only link is revoked, and one whose live link has `token_sealed` null (2 inputs), is stored `skipped` with `no_link_secret` (AC 21)
Proof: `npm run test:db outbox_dispatch` (assertions `C1023`)

**C1024** - Recipients `a@example.com`, `a@example.org`, `a@example.net`, `a@shop.test` and `a@x.invalid` (5 inputs) give `skipped` with `reserved_domain`, complete stores it, and `fetch` is called 0 times. `a@felipeviana.com`, `a@notexample.com` and `a@example.community` (3 controls) are sent (AC 22)
Proof: `npm test -- application/use-cases -t "C1024:"`
Proof: `npm test -- infrastructure/email -t "C1024:"`

**C1025** - With the `agreement.sent` actor `uE`, the claim returns `replyTo` = `uE`'s `auth.users.email`, and the email is sent with that `replyTo`. With actor null, `replyTo` is absent (AC 23)
Proof: `npm run test:db outbox_dispatch` (assertions `C1025`)
Proof: `npm test -- application/use-cases -t "C1025:"`

**C1026** - Sealing and unsealing:
- `unseal(seal(t))` returns `t` for a 43-character token.
- Two seals of one token differ, because of a random IV.
- The sealed value matches `^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$`.
- Unseal with another 32-byte key, with 1 changed ciphertext character, or with 1 changed tag character (3 inputs) throws.
- The send and reissue use cases pass the RPC a sealed value whose unsealed token's SHA-256 equals the hash argument.
- After `send_agreement` with a sealed value, `portal_links.token_sealed` holds it (AC 24)

Proof: `npm test -- infrastructure/portal-tokens -t "C1026:"`
Proof: `npm test -- sendAgreement -t "C1026:"`
Proof: `npm run test:db outbox_dispatch` (assertions `C1026`)

### S4 - The estimator hears about a refusal or a change request · ~3 files · ~15k

**C1027** - The fixture agreement is moved to `refused` with reason `Too expensive`, and separately to `changes_requested` with reason `Add the boiler` (2 inputs). Each `staff_decision` claim returns 1 message to `uE`'s email with the customer name, number and reason. The built subject is `<customer name> refused <number>` or `<customer name> asked for changes to <number>`. The body contains the reason and a link `<APP_BASE_URL>/agreements/<agreement id>` (AC 25)
Proof: `npm run test:db outbox_dispatch` (assertions `C1027`)
Proof: `npm test -- domain/notifications -t "C1027:"`

**C1028** - With the `agreement.sent` actor null, and with the actor's membership deleted (2 inputs), `staff_decision` returns messages to exactly org A's owner and admin emails. The estimator and the viewer are not among them, and org B's owner is not either (AC 26)
Proof: `npm run test:db outbox_dispatch` (assertions `C1028`)

### S5 - Owners see stale agreements once a day · ~3 files · ~15k

**C1029** - Org A has 2 `sent` agreements whose `agreement.sent` event is 8 days old and whose live link has no first view. It also has 1 sent 6 days ago, 1 sent 8 days ago but viewed, and 1 `accepted` 8 days ago. A `staff_stale` claim with key `w5:2026-10-29` returns 1 message for org A, addressed to its owner and admin, listing exactly the 2 agreements (number, customer, send date). It stores 1 notification with key `w5:2026-10-29:<org A id>`. The built subject is `2 agreements not viewed after 7 days`, and with 1 agreement `1 agreement not viewed after 7 days`. Each listed number links to `<APP_BASE_URL>/agreements/<id>` (AC 27)
Proof: `npm run test:db outbox_dispatch` (assertions `C1029`)
Proof: `npm test -- domain/notifications -t "C1029:"`

**C1030** - In the same claim, org B, which has no stale agreement, gets no message and no `notifications` row (AC 28)
Proof: `npm run test:db outbox_dispatch` (assertions `C1030`)

**C1031** - A second `staff_stale` claim with key `w5:2026-10-29` after the first completed `sent` returns no message for org A and adds no row. A claim with `w5:2026-10-30` returns org A's message again (AC 29)
Proof: `npm run test:db outbox_dispatch` (assertions `C1031`)

### S6 - Staff can see whether the link went out · ~5 files · ~20k

**C1032** - The agreement view for a `sent` agreement renders:
- `Emailed to pat@customer.ca on <date>` for a `sent` `customer_link` notification
- `Not emailed: <words>` for each of `no_recipient`, `no_link_secret`, `reserved_domain` and `failed` (4 inputs), each with a distinct non-empty phrase containing no `_`
- `Email pending` when the reader returns none

A `draft` renders none of the three. The reader asks for the notification of the current version's `agreement.sent` event with kind `customer_link` (AC 30)
Proof: `npm test -- components/agreements -t "C1032:"`
Proof: `npm test -- infrastructure/supabase -t "C1032:"`

### S7 - The workflows are reviewable · ~5 files · ~15k

**C1033** - `automation/n8n/` holds exactly `events.json`, `W1-agreement-sent.json`, `W3-agreement-decided.json` and `W5-stale-daily.json`, each valid JSON with `nodes` and `connections`. No file contains a `credentials` entry with a value other than `id` and `name`, the string `test-secret`, or a 64-hex string. W1 has 2 Wait nodes, 3 days then 4 days, in that order. Every HTTP Request node that calls `/api/automation/notify` sends `kind`, an `idempotencyKey` built as door 4's formats (`w1:…:link`, `…:day3`, `…:day7`, `w3:…`, `w5:…`), and `executionId` from `$execution.id`. W5's Schedule trigger is daily at 08:00 (AC 31)
Proof: `npm test -- n8n-workflows -t "C1033:"`

**C1034** - In `events.json`:
- The Webhook node has `responseMode` `onReceived` (answer 200 on receipt).
- The Switch on `type` has exactly 3 routed values: `agreement.sent` goes to W1; `agreement.refused` and `agreement.changes_requested` go to W3.
- The fallback output connects to no node that executes a workflow (AC 32)

Proof: `npm test -- n8n-workflows -t "C1034:"`

**C1035** - `events.json` checks the signature before routing. A Crypto node computes HMAC SHA256 over `<X-SA-Timestamp>.<raw body>` with the credential secret. An IF node compares it with `X-SA-Signature` and the 300 s window, and its false branch connects to no workflow call (door 2)
Proof: `npm test -- n8n-workflows -t "C1035:"`

### Doors and delivery · ~8 files · ~25k

**C1036** - `notifications` (door 4):
- Inserting a second row with an existing `idempotency_key` raises `23505`.
- `kind` accepts the 4 kinds and refuses `sms` with `23514`.
- `status` accepts `claimed`, `sent`, `skipped` and `failed` and refuses `queued` with `23514`.
- A `skipped` row without `skip_reason`, and a `sent` row with one, raise `23514`.
- A row whose `agreement_id` belongs to org B under org A raises `23503`.
- `uA` selects only org A's rows and `uB` selects only org B's. `anon` selects 0 rows.
- `uE` and `uA` get `42501` on insert, update and delete (3 commands).

Proof: `npm run test:db outbox_dispatch` (assertions `C1036`)

**C1037** - `portal_links.token_sealed` (door 5):
- A value `plain-token` raises `23514`, and a value matching the format is accepted.
- `send_agreement` and `reissue_portal_link` called without `p_token_sealed` still succeed and store null, so every existing caller in `customer_portal.sql` stays valid: `npm run test:db customer_portal` passes.
- customer-portal's `C907 columns` assertion lists `token_sealed` as well, per the approved plan's Impact. Its `C907 token refused` and `C907 hash only` assertions are unchanged.

Proof: `npm run test:db outbox_dispatch` (assertions `C1037`)
Proof: `npm run test:db customer_portal`

**C1038** - `proxy.ts` lets a signed-out `POST /api/automation/notify` through with no redirect. It still redirects `/api/automationx`, `/api/other` and `/automation/notify` (3 inputs) to `/login`. The route's responses carry `Cache-Control: no-store` (door 6)
Proof: `npm test -- proxy -t "C1038:"`
Proof: `npm test -- app/api/automation -t "C1038:"`

**C1039** - The Resend adapter (door 7):
- It sends `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, `Idempotency-Key: <key>` and a JSON body with `from` = `"<legal name>" <EMAIL_FROM>`, `to`, `reply_to` (only when given), `subject`, `html` and `text`.
- A `200` with `{ "id": "re_1" }` maps to `{ ok: true, providerMessageId: "re_1" }`. A `422` maps to `rejected`. A `500`, a `429` and a thrown network error (3 inputs) map to `unavailable`.
- A legal name containing `"` is escaped in `from`.

Proof: `npm test -- infrastructure/email -t "C1039:"`

**C1040** - `automation_claim` and `automation_complete` (door 3):
- Both are `security definer`, have `search_path` set to `''`, are executable by `anon` and `authenticated`, and are not executable by `public`.
- Called as `anon` with a correct signature, both work.

Proof: `npm run test:db outbox_dispatch` (assertions `C1040`)

**C1041** - Security advisors after the migration report exactly the 8 lints of customer-portal plus `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable` for `automation_claim` and `automation_complete`: 12 in all, with no other new lint (`extension_in_public` included) (Impact)
Proof: mcp `get_advisors` type `security`, result recorded in the Handoff

**C1042** - `cron.job` has exactly 1 row named `outbox-dispatch` with schedule `* * * * *` and command `select private.dispatch_outbox()`. `pg_extension` lists `pg_cron` and `pg_net`. `outbox.status` accepts `sending` and refuses `queued` with `23514` (door 1)
Proof: `npm run test:db outbox_dispatch` (assertions `C1042`)

**C1043** - `automation_complete` with a correct signature:
- It sets the named notification `sent`, with `provider_message_id` `re_1` and `sent_at`, or `failed` with the error text.
- A notification id that is not one of this body's key raises `P0002` and changes nothing.
- A wrong signature raises `42501`.
- The route answers `200` with `outcome: "sent"` after a successful complete.

Proof: `npm run test:db outbox_dispatch` (assertions `C1043`)
Proof: `npm test -- app/api/automation -t "C1043:"`

**C1044** - The use case, with fakes:
- **`send`:** claim `send` with 1 message, then `EmailSender.send` once with the built email and `idempotencyKey`, then complete once with `sent` and the provider id, then result `sent`.
- **`skip`:** claim `skip` with reason `viewed`, then 0 sends and 0 completes (the claim already stored `skipped`), then result `skipped` with `viewed`.
- **`send` with 2 messages (W5 or W3 fallback):** 2 sends and 1 complete carrying 2 results.

Proof: `npm test -- application/use-cases -t "C1044:"`

**C1045** - `outbox_dispatch` is a plain recipe, `RECIPES` has 18 entries and `supabase/tests` holds 20 SQL files. The C830 pins move from 17 and 19 to 18 and 20; this consequence of the new recipe is listed in the Handoff
Proof: `npm test -- scripts/test-db -t "C1045:"`

**C1046** - `PORTAL_LINK_KEY`, `RESEND_API_KEY` and `EMAIL_FROM` are read only under `web/composition/`; a test scans `web/` (excluding `node_modules` and tests) and finds no other `process.env.<name>` for them. No `NEXT_PUBLIC_` variable holds them. `.env.example` lists the 3 names with no value
Proof: `npm test -- boundaries -t "C1046:"`

**C1047** - `database.types.ts` is regenerated, and lint, type check and production build succeed
Proof: `npm run lint`
Proof: `npx tsc --noEmit`
Proof: `npm run build`

**C1048** - The whole suite stays green: `npm test` exits 0, and `npm run test:db` reports every recipe passed (18) and 0 failed
Proof: `npm test`
Proof: `npm run test:db`

**C1049** - Live, with the user's go-ahead for each action:
- **Dispatch:** the Vault secrets point at an echo receiver, and one demo transition reaches the receiver within 2 minutes. The outbox row becomes `sent`, and the receiver shows a body and headers that verify with the secret.
- **Email:** with `RESEND_API_KEY` set, one signed `customer_link` callback for a demo agreement, whose contact email is temporarily the Resend account owner's, delivers 1 email from `@felipeviana.com`. The notification is `sent` with a provider id.
- **n8n:** once n8n runs on Railway (open question 1), the same callback comes from W1.

Proof: live, recorded in the Handoff

**C1050** - The agreement page with the delivery line is validated in the browser at 375×812, 768×1024 and 1440×900 (AGENTS.md):
- no horizontal scroll
- the line is readable
- console clean
- one signed-in context only (memory: Playwright single context)

Proof: live (Playwright MCP), recorded in the Handoff

**C1051** - `CONTEXT.md` has the "Events, outbox and n8n automation" entry updated (dispatcher, callbacks, notifications, sealed token, Railway, Resend domain) and a dated Build log line. `STATE.md` holds the new AD entries and marks AD-070 as amended. `ROADMAP.md` ticks Phase 3 item 5. `PRODUCT.md`'s "Undecided" line no longer lists Resend versus Postmark
Proof: shell `grep -c "outbox-dispatch\|automation_claim" ../CONTEXT.md` prints at least 2, and `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` prints 1 line

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| outbound webhook statuses (Surface: delivered, retried) (6) | `200` C1003 · `204` C1003 · `299` C1003 · `404` C1004 · `500` C1004 · timeout C1004 | - |
| `POST /api/automation/notify` statuses (6) | `200` C1014, C1043 · `400` C1012 · `401` C1010, C1011 · `404` C1017 · `409` C1015 · `503` C1016, C1017, C1018 | - |
| `automation_claim` outcomes (4) | `200` returned C1019 · `401`/`42501` C1011 · `400`/`22023` C1012 · `404`/`P0002` C1017 | - |
| `automation_complete` outcomes (4) | `200` C1043 · `401`/`42501` C1043 · `400`/`22023` C1012 · `404`/`P0002` C1043 | - |
| `send_agreement`, `reissue_portal_link` statuses, unchanged (5) | `200` C1037 · `404` C1037 · `409` C1037 · `403` C1037 · `422` C1037 (customer-portal recipe re-run) | - |
| claim decisions (4) | `send` C1015, C1019 · `skip` C1021 · `duplicate` C1014 · `in_flight` C1015 | - |
| notification kinds (4) | `customer_link` C1019 · `customer_reminder` C1020 · `staff_decision` C1027 · `staff_stale` C1029 | - |
| key formats (5) | `w1:<e>:link` C1012, C1013 · `w1:<e>:day3` C1012, C1013 · `w1:<e>:day7` C1012, C1020 · `w3:<e>` C1012, C1027 · `w5:<date>` C1012, C1029 | - |
| skip reasons (6) | `decided` C1021 · `superseded` C1021 · `viewed` C1021 · `no_recipient` C1022 · `no_link_secret` C1023 · `reserved_domain` C1024 | - |
| statuses that are `decided` (4) | `accepted` C1021 · `refused` C1021 · `changes_requested` C1021 · `withdrawn` C1021 | - |
| reserved recipient domains (5) | `example.com` C1024 · `example.org` C1024 · `example.net` C1024 · `.test` C1024 · `.invalid` C1024 | - |
| notification statuses (4) | `claimed` C1015, C1036 · `sent` C1043 · `skipped` C1021 · `failed` C1016, C1043 | - |
| outbox statuses (4) | `pending` C1001, C1004 · `sending` C1001, C1042 · `sent` C1003 · `failed` C1005, C1008 | - |
| backoff schedule (7) | 1 C1004 · 5 C1004 · 15 C1004 · 60 C1004 · 240 C1004 · 720 C1004 · 1440 C1004 (table-driven) | - |
| outbound body keys (8) | `deliveryId` C1001 · `eventId` C1001 · `type` C1001 · `entityType` C1001 · `entityId` C1001 · `orgId` C1001 · `payload` C1001 · `occurredAt` C1001 | - |
| signature failures (4) | wrong secret C1011 · body changed C1011 · 301 s past C1011 · 301 s future C1011 | - |
| route header rejections (5) | no timestamp C1010 · no signature C1010 · bad timestamp C1010 · bad hex C1010 · wrong prefix C1010 | - |
| missing secrets (2) | `n8n_events_url` C1007 · `automation_hmac_secret` C1007 | - |
| W3 recipients (3) | sender C1027 · actor null C1028 · sender no longer member C1028 | - |
| W5 inclusion (5) | 8 days unviewed C1029 · 6 days C1029 · viewed C1029 · accepted C1029 · other org C1030 | - |
| Resend responses (5) | `200` C1039 · `422` C1039 · `429` C1039 · `500` C1039 · network error C1039 | - |
| delivery line states (6) | sent C1032 · `no_recipient` C1032 · `no_link_secret` C1032 · `reserved_domain` C1032 · `failed` C1032 · none C1032 | - |
| sealing failures (3) | wrong key C1026 · ciphertext changed C1026 · tag changed C1026 | - |
| n8n exports (4) | `events.json` C1033, C1034, C1035 · W1 C1033 · W3 C1033 · W5 C1033 | - |
| one-way doors (8) | door 1 C1042, C1006 · door 2 C1002, C1035 · door 3 C1040, C1011 · door 4 C1036 · door 5 C1037, C1026 · door 6 C1038 · door 7 C1039 · door 8 C1033 | - |
| entities (Relations) (3) | Notification C1036 · SealedToken on PortalLink C1037 · Outbox `sending` C1042 | - |
| startup config: `PORTAL_LINK_KEY` (3 places) | send action C1026 · reissue action C1026 · automation route assembly C1019 | - |
| startup config: `RESEND_API_KEY`, `EMAIL_FROM` (1 assembly) | automation route assembly C1018, C1039 | - |
| proxy paths (4) | `/api/automation/notify` C1038 · `/api/automationx` C1038 · `/api/other` C1038 · `/automation/notify` C1038 | - |

- Claims naming a status code, route or response shape: C1001, C1003, C1004, C1010 to C1018, C1038, C1039, C1043. Each has a proof that crosses the boundary it names: the queue table, the RPC, the route or the fetch.
- C1002 crosses the language boundary with one shared vector, so the DB signer and n8n's verifier cannot drift apart unnoticed.
- No other check claims more than the single case its proof exercises.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (claim, complete, the dispatcher, the route, the Resend adapter) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (email builders, reason wording, reserved domain test, sealing) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (container wiring, the claim/complete adapter's argument forwarding, n8n JSON as data) | none of its own | covered by its consumer's proof; the exports are data, asserted structurally by C1033 to C1035 |

Evidence:

- `automation_claim`: 4 kinds × eligibility (6 skip reasons, 4 decisions, 3 W3 recipients, 5 W5 inclusion rows), signature and age gate, key format gate -> decides (C1011 to C1031)
- `private.dispatch_outbox`: 2 phases, 6 response classes, a 7-step schedule, a batch bound, a secret gate -> decides (C1001 to C1007)
- the route: 6 statuses from header checks and 4 adapter outcomes -> decides (C1010 to C1018, C1043)
- the Resend adapter: 5 response classes -> decides (C1039)
- closest analogues in the repo: `supabase/tests/customer_portal.sql` proves the definer RPCs with labelled assertions per refusal; `app/auth/confirm/route.test.ts` proves a route over a mocked container; `infrastructure/portal-tokens.test.ts` proves the token helper at its own layer

Cost: about 34 proofs across 8 test files and one new SQL recipe. Without these rows, the claim's eligibility table would be proven only by the one live email of C1049.

## Swept

- validation: C1010 (header shapes), C1012 (body and key format), C1024 (recipient domains), C1036 and C1037 (column checks)
- failure modes: C1004 and C1005 (failed delivery, retry, give up), C1016 (provider failure becomes `failed`, then retried), C1017 (database failure is `503` and logged), C1007 (missing secrets do nothing)
- idempotency: C1014 (one email per key), C1013 (execution id written once), C1031 (one W5 email per org per day), C1006 (no row sent twice per attempt), C1039 (`Idempotency-Key` to Resend for a crash between send and complete)
- authorization: C1011 (only the secret holder can call back), C1009 (no user role reaches the dispatcher or outbox), C1036 (notification RLS and no user writes), C1040 (grants), C1046 (secrets stay server-side)
- concurrency: C1006 (`skip locked` plus advisory lock; a second run is a no-op), C1015 (`claimed` blocks a second claim for 10 minutes; the unique key settles a tie). The SQL runner has one connection per recipe, so two truly simultaneous transactions are not exercised. The guarantee rests on the unique index (C1036) and row locks, the AD-015 precedent
- data lifecycle: C1008 (old pending rows retired), C1004 (pg_net keeps responses 6 h, and the 10-minute rule covers a purged or lost one). n/a for deleting notifications: they are the delivery record and nothing deletes an agreement (CONTEXT.md)
- dependency failure: C1004 (n8n down), C1016 and C1039 (Resend down), C1007 (Vault not configured), C1018 (key not configured)
- state transitions: C1021 (agreement status decides reminders), outbox `pending -> sending -> sent | pending | failed` C1001, C1003 to C1005, notification `claimed -> sent | failed`, `skipped` C1015, C1043
- observability: `outbox.last_error` and `attempts` C1004, `notifications.status`, `skip_reason` and `provider_message_id` C1036 and C1043, `events.n8n_execution_id` C1013, `console.error` on `503` C1017, `cron.job_run_details` per run (existing pg_cron behaviour). No metrics or tracing requirement

## Out of scope

- Everything in the plan's `Out of scope`
- Deploying n8n to Railway and setting live secrets (open questions 1 to 3): C1049 records the live half when the user gives the go-ahead

## Handoff

Measured with `wc -c` before any code:

- **Read set:** 205 KB, about 51k tokens. It covers:
  - `customer_portal` migration 17.7 KB and `transition_rpcs` 4.5 KB
  - `fixture.sql` 11 KB and `customer_portal.sql` 40.7 KB (only the C907 block and helpers need reading)
  - `ports/index.ts` 22.2 KB and `composition/index.ts` 7.3 KB
  - `portal-tokens.ts` and `portal-links.ts` 2.1 KB
  - the agreement page and views 16.8 KB, and the agreements and portal adapters 17.1 KB
  - `database.types.ts` 31.8 KB (regenerated)
  - `session.ts`, `proxy.test.ts` and `boundaries.test.ts` 11.9 KB, and `eslint.config.mjs` 4.8 KB
  - runner and its test 15.8 KB, and `.env.example` 0.9 KB
- **Writing:** about 85k. It covers:
  - the migration (extensions, outbox change, retire old rows, `notifications`, `token_sealed`, `issue_portal_link`/`send_agreement`/`reissue_portal_link` re-signed, the dispatcher, claim, complete, cron) about 12k
  - `outbox_dispatch.sql` (about 30 labelled assertion groups) about 18k
  - domain email builders, ports, use case, route, Resend adapter, sealing, the claim adapter and composition about 16k
  - the delivery line about 3k
  - tests for all of it about 22k
  - four n8n exports and their test about 8k
  - docs (CONTEXT.md, STATE.md, ROADMAP.md, PRODUCT.md) about 6k
- **Live** (C1049 and C1050, three sizes): about 15k.
- **Total:** about 151k, over the 150k budget. S1 and S2's database part plus doors 1 to 5 and the SQL halves of S3 to S5 come to about 54k: the read set of migrations, fixture, runner and types (about 22k) plus the migration, the SQL test and the AD entries (about 32k). The app side (route, use case, email, view, n8n exports, live) enters at about 100k on top.
- **Proposed cut, if a handoff is chosen:**
  - Batch 1 is the database: the migration, the `outbox_dispatch` recipe, the C907 and C830 pin edits, the advisors and the C1008 data run. It closes C1001 to C1009, the SQL halves of C1011 to C1031, and C1036, C1037, C1040 to C1042, C1043 (SQL) and C1045.
  - Batch 2 is everything else, which includes the live run.
- **Mechanism:** handoff (the user's choice, 2026-10-29). Batches run sequentially and only on green, and the parent dispatches the Verifier after batch 2.

Expected follow-ons the build must report, not hide:
- `database.types.ts` regeneration
- the AD entries in `STATE.md`: amend AD-070 (sealed token) and AD-072 (second public prefix); add the dispatcher, the signature format, the callback RPCs, `notifications`, `EmailSender` and the n8n exports
- the C907 column list and the C830 pins (both named above)
- the `CONTEXT.md` entries and the ROADMAP tick
- the plan's AC 27 subject reads `<n> agreements …`, and C1029 also pins the singular `1 agreement …`, a wording refinement the user can overrule

### Build record

#### Batch 1 (database, 2026-10-29)

- **Boundary:** closed C1001-C1009, the SQL halves of C1011-C1015, C1017, C1019-C1023, C1025-C1031, and C1036, C1037, C1040, C1041, C1042, C1043 (SQL half), C1045, in the two batch 1 commits: `7f42252` (migration, types, Landing rows, AD entries) and the `test(outbox)` commit that adds this record. Left for batch 2: C1010, C1016, C1018, C1024, C1032-C1035, C1038, C1039, C1044, C1046-C1051 and the vitest halves of C1002, C1011, C1012, C1014, C1015, C1017, C1019, C1020, C1025-C1027, C1029, C1043.
- **Migration:** `apply_migration` recorded `20261029165430` / `outbox_dispatch`; the file is `supabase/migrations/20261029165430_outbox_dispatch.sql`. Applied with the user's go-ahead of 2026-10-29. No Vault secret was written on the live project, so the live `outbox-dispatch` job runs every minute as a no-op (5 runs checked, all `succeeded`, nothing queued).
- **C1008 (live):** before applying, `outbox` held 8 rows, all `pending` (16:52:49 UTC). After: `select count(*) from outbox where status = 'pending' and created_at < '2026-10-29 16:54:30+00'` is 0, and all 8 rows are `failed` with `last_error = 'enqueued before dispatch existed'`.
- **C1041 (live), `get_advisors` security after the migration:** 12 findings: `rls_enabled_no_policy` (`public.outbox`), `auth_leaked_password_protection`, and `anon_security_definer_function_executable` plus `authenticated_security_definer_function_executable` for exactly `automation_claim`, `automation_complete`, `portal_decide`, `portal_record_view`, `portal_view`. No `extension_in_public` (`pg_net` is in `extensions`, `pg_cron` in `pg_catalog`).
- **Proofs:** `npm run test:db outbox_dispatch` and `customer_portal` pass; `npm run test:db` 18 passed, 0 failed; `npm test` 1600 passed (76 files); `npx tsc --noEmit` exit 0. Seven mutants of the migration (backoff value, 300 s window, `viewed` skip, owner/admin filter, batch size, 7-day rule, execution id overwrite) each failed the `outbox_dispatch` recipe.
- **Settled mid-build:**
  - Landing rows 9 (`outbox.dispatched_at`), 10 (the old RPC signatures kept as overloads; the new parameter has no default) and 11 (claim message shape, `to` as an array, extra `notifications` columns, complete's result shape) were appended to the plan before the code.
  - Consequences of door 4 and the new recipe, edited and listed: `rls_isolation.sql` C35 (the public table list) now names `notifications` (19 tables), the same edit customer-portal made for `portal_links`; `runner.test.ts` counts 18 recipes and 20 files in C830, C203, C204, C205, C210, C211 and C212, and gains a `C1045:` test; customer-portal `C907 columns` lists `token_sealed`.
  - A W1 event's version is the newest version created at or before the event (`agreement.sent` carries no `versionNo`); a reminder checks `superseded`, then `decided`, then `viewed`, then `no_recipient`, then `no_link_secret`. A W5 claim with no stale org returns `decision: skip`, `reason: none` and stores nothing.
  - `web/node_modules` lacked the declared `@react-pdf/renderer`; `npm install` restored it from the lockfile (no lockfile change) so `tsc` could run.
- **Abandoned:** dropping the old `send_agreement`/`reissue_portal_link`/`issue_portal_link` signatures (C943 looks them up); adding `versionNo` to the `agreement.sent` payload (changes an existing event shape that `transitions.sql` pins).

#### Batch 2 (app, n8n, docs, 2026-10-29)

- **Boundary:** closed C1010, C1016, C1018, C1024, C1032-C1035, C1038, C1039, C1044, C1046-C1048 and the vitest halves of C1002, C1011, C1012, C1014, C1015, C1017, C1019, C1020, C1025, C1026, C1027, C1029, C1043 in the `feat(automation)` commit; C1051 in the `docs(outbox)` commit that follows it. Not closed: C1049 (awaits the user's go-ahead, below) and C1050 (could not run, below).
- **Proofs:** every named selector passes (31 runs, e.g. `app/api/automation -t "C1010:"` 5 passed, `application/use-cases -t "C1024:"` 8 passed, `n8n-workflows -t "C1033:"` 7 passed); `npm test` 1715 passed (84 files); `npm run test:db` 18 passed, 0 failed; `npm run lint` clean; `npx tsc --noEmit` exit 0; `npm run build` succeeded, with `/api/automation/notify` dynamic (`ƒ`).
- **Settled mid-build:**
  - Landing row 12 (n8n reads the secret and the app address from its environment through `$env`; Set -> Crypto -> HTTP Request so the bytes signed are the bytes sent) was appended to the plan in the same commit as the exports, after they were first drafted and before anything was committed.
  - The route has no `export const runtime = "nodejs"`: `next.config.ts` enables Cache Components, which refuses the `runtime` segment option (Next 16 `route-segment-config/runtime.md`); Node.js is the default runtime, so door 6's runtime holds.
  - Resend's `Idempotency-Key` confirmed in Resend's docs (send-email reference and idempotency-keys page): 1 to 256 characters, kept 24 hours, the same key and payload return the first email's id; another payload, or a concurrent request, is `409`. The adapter maps `409`, `429` and `5xx` to `unavailable`, other `4xx` to `rejected`. The provider key is the notification's own key: the body's key for W1 and W3, `w5:<date>:<orgId>` per W5 message.
  - `PortalTokens` gained `seal`/`unseal`; `makePortalTokens(PORTAL_LINK_KEY)` throws only when sealing or unsealing without a valid 32-byte key, so the customer side keeps working without it, while Send and "Get a new link" answer `unavailable` until the key is set (open question 3). `AgreementSender.send` and `PortalLinkStore.reissue` take an optional `tokenSealed`; the adapters send `p_token_sealed` only when given, so PostgREST picks the batch 1 overload by name.
  - Reserved recipients are dropped by the use case before `EmailSender.send` (all reserved: `skipped`, `reserved_domain`, completed as such) and refused again by the Resend adapter before any request.
  - `AgreementDetail` gained `linkEmail` (`sent` with address and date, `not_sent` with a reason, `pending`), read from the latest `agreement.sent` event's `customer_link` notification; existing fixtures gained `linkEmail: null` (type completeness only; no assertion changed). The send and reissue test fakes gained reversible `seal`/`unseal` stand-ins.
  - No ESLint boundary rule was added: the email adapter uses `fetch` only, with no library to fence.
- **Abandoned:** none.
- **C1050 (live) - could not run as specified.** The browser profile was signed in (one context; `/pipeline` and `/agreements/577e841b-504c-4938-b296-dad72a58cf0e` (AG-1052, accepted) loaded, no horizontal scroll at 1440 wide, 0 console errors or warnings). But the live project has no `sent` agreement (4 draft, 6 accepted, 3 refused, 1 changes_requested, 2 withdrawn), so the delivery line is never rendered there, and making one sent would change live data beyond viewing; with no `PORTAL_LINK_KEY` in `.env.local`, Send would also answer `unavailable`. It needs: `PORTAL_LINK_KEY` set, the user's go-ahead to send one demo draft (or to run `seed.sql`'s restore), then the three sizes.
- **C1049 (live) - awaits the user's go-ahead for each action:**
  1. Dispatch: store Vault `n8n_events_url` (an echo receiver first, then the n8n events webhook) and `automation_hmac_secret` on project `gnxebrtcpbujhvcamtoe`; make one demo transition; within 2 minutes check the outbox row is `sent` and the receiver's body and headers verify with the secret.
  2. Email: set `PORTAL_LINK_KEY`, `RESEND_API_KEY` (account holding `felipeviana.com`) and `EMAIL_FROM=agreements@felipeviana.com` in the app's environment; temporarily set one demo site contact's email to the Resend account owner's; send that agreement; post one signed `customer_link` callback; check 1 email arrives from `@felipeviana.com` and the notification is `sent` with a provider id; restore the contact.
  3. n8n: deploy n8n on Railway with `DB_TYPE=postgresdb`, `GENERIC_TIMEZONE=America/Vancouver`, `SA_AUTOMATION_HMAC_SECRET` (= the Vault secret), `SA_APP_BASE_URL`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`; import the four exports, pick W1 and W3 in the events workflow's two Execute Workflow nodes, activate events, W1, W3 and W5; point `n8n_events_url` at the events webhook; repeat step 2 with the callback coming from W1.
