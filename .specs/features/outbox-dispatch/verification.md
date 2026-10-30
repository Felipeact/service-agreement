# Outbox dispatch, n8n W1/W3/W5 and transactional email - verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: aae1901..a767e35 (this round's scope: the diff `a915c69..a767e35`)
**Round**: 4 - scoped, verified at `a767e35`. Scope:
- the diff `a915c69..a767e35`:
  - `8bb23a4` (F17): C1052 is reworded so every status outside the six triggers never loops, asserted with 422, 429 and 501 too;
  - `a58d65e` and `a767e35`: the live records for C1050 and C1049, the ROADMAP tick, and the CONTEXT and STATE updates;
- every round 3 verdict that was not PASS: C1049, C1050, C1051 and the F17 surviving mutant.

Everything else is carried from `aec4fb0` (round 3, kept at `a915c69`). Round 3 had itself carried most rows from `5c4237b` (round 2, kept at `a03cab1`).

**Verifier**: independent sub-agent (author != verifier). The orchestrator session wrote this round's changes and ran the live checks. This Verifier wrote no code, changed no live system, and wrote only this file.

What blocks PASS:

1. **C1049 is unproven on one clause: "delivers 1 email".**
   - This Verifier corroborated every other part of C1049 live.
   - The orchestrator's own record leaves the inbox open: "The user confirms whether the email arrived in their inbox" (`.specs/features/outbox-dispatch/checks.md:532`). Nobody has recorded that it arrived.
   - Resend accepting the message (`provider_message_id` is set) shows the message was sent. It does not show it was delivered, and this Verifier cannot see the inbox.
   - To close it, the user confirms that the email from `agreements@felipeviana.com`, sent at 15:55 UTC on 2026-10-30, arrived. Nothing else needs to change.

Resolved this round:

- **F17.** Round 3's surviving mutant (`$json.statusCode >= 409 || $json.statusCode === undefined`) is now killed by 3 tests: 422, 429 and 501.
- **C1050** passes on the orchestrator's recorded live run. This Verifier corroborated its data preconditions but did not see the screenshots.
- **C1051** passes at HEAD, because ROADMAP Phase 3 item 5 is now ticked. See F20: the tick came before C1049 fully passed, and the ROADMAP wording overclaims.

51 of 52 checks are proven. 4 faults were injected, and all 4 were killed.

## Binding sources

Refreshed at `a767e35` for the files the diff touched (`ROADMAP.md`, `.specs/STATE.md`). `plan.md` and `PRODUCT.md` are unchanged since `5c4237b`, so the plan row is carried.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 5, M12, M13, n8n table (W1, W3, W5) | re-read at `a767e35`: `ROADMAP.md:117` reads `- [x] Outbox dispatcher ... Live run 2026-10-30: n8n and the app on Railway, link email delivered through Resend` | - (the word "delivered" outruns the evidence, F20) | - |
| STATE.md AD-015, AD-016, AD-068 to AD-079, Handoff | re-read at `a767e35`. The AD rows are unchanged since `aec4fb0`: `.specs/STATE.md:76` AD-070 reads `active, amended by AD-077`, and `:85` is AD-079. Only the Handoff block changed (Vault names, Railway, AG-1046 and AG-1048) | - | - |
| Plan Landing rows 1-13 (row 13 supersedes row 12) | carried from `5c4237b` (`.specs/features/outbox-dispatch/plan.md:86-99`, unchanged) | - (F12 carried) | - |

## Checks

### Proof runs at `a767e35` (all from `web/`)

- **`npx vitest run n8n-workflows --reporter=verbose`**: 111 passed (1 file), exit 0.
  - There are 100 `✓ ... C1052:` lines and 0 `×`: round 3's 85 plus 15 new ones (3 statuses x 5 calls).
  - Each new status has 5 `✓`. `grep -c "✓.*C1052: a <s> is read"` gives `422: 5`, `429: 5` and `501: 5`. For example: `✓ n8n-workflows.test.ts > the n8n workflow exports > C1052: notify call W1-agreement-sent.json #0 (link) > C1052: a 429 is read without failing the run and never loops`.
- **`npm test`** (`vitest run`):
  - First run: 1816 passed and 2 failed (84 files), exit 1. Both failures are F15's lint-driven timeouts again, each `Test timed out in 5000ms`: C32 (`domain/purity.test.ts`, 6364 ms) and C873 (`boundaries.test.ts`, 6400 ms). Nothing else was running.
  - Immediate rerun: 1818 of 1818 passed (84 files), exit 0. That is round 3's 1803 plus the 15 new C1052 cases.
- **Not re-run, so carried** from `aec4fb0` or `5c4237b`: `npm run lint`, `npx tsc --noEmit`, `npm run test:db` and `npm run build`. The only code file changed in `a915c69..a767e35` is `web/n8n-workflows.test.ts`, with 1 insertion and 1 deletion. No SQL, app code or export changed.

### Live reads by this Verifier (read-only, 2026-10-30, about 15:58 to 16:01 UTC)

From mcp `execute_sql` (`select` only) on `gnxebrtcpbujhvcamtoe`:

| What | Result |
| --- | --- |
| AG-1046 `agreement.sent` (event `d8dc2c92-…`) | The agreement is `sent`. Outbox row: `sent`, attempts 0, `last_error` null; created 15:28:04, dispatched 15:53:00, `sent_at` 15:54:00; pg_net response `200`, not timed out. `events.n8n_execution_id = '4'`. Notification `w1:d8dc2c92-…:link`: `customer_link`, `skipped` / `reserved_domain`, 1 recipient at `example.com`, no provider id |
| AG-1048 `agreement.sent` (event `22b6eb12-…`) | The agreement is `sent`. Outbox row: created 15:54:13.43, dispatched 15:55:00.01, pg_net response `200` at 15:55:00.03, `sent` with `sent_at` 15:56:00.03, attempts 0. `events.n8n_execution_id = '6'`. Notification `w1:22b6eb12-…:link`: `customer_link`, `sent` at 15:55:01.45, `provider_message_id = '01a18d85-8881-79bd-b6f0-1553eb085817'`, error null, 1 recipient at `gmail.com` (the address itself is not copied here) |
| Vault | names only, from `vault.secrets`: `automation_hmac_secret` and `n8n_events_url`. No value was read |
| cron | job `outbox-dispatch`: 1 job, `* * * * *`, active. `cron.job_run_details` for the last hour: 60 runs, all `succeeded`, the latest at 15:57:00 (`1 row`) |
| contact `407bc94f-fd6b-c64d-5eca-3e93da22cbf9` | Dana Whitfield, email domain `example.com` again |
| totals | 2 notifications in all. Outbox: 4 `sent` and 8 `failed` (the 8 rows C1008 retired) |
| advisors (`get_advisors`, security) | still 12 lints: `rls_enabled_no_policy` 1, `anon_security_definer_function_executable` 5, `authenticated_security_definer_function_executable` 5, `auth_leaked_password_protection` 1. C1041 still holds |

From `curl`:

| Request | Answer |
| --- | --- |
| unsigned `POST https://web-production-bde48d.up.railway.app/api/automation/notify` (body `{}`) | `401` |
| `GET https://web-production-bde48d.up.railway.app/login` | `200` |
| `GET https://web-production-bde48d.up.railway.app/pipeline`, signed out | `307` to `/login` |
| `GET https://n8n-production-297b.up.railway.app/healthz` | `200` |

What this Verifier could not reproduce:

- the inbox;
- the n8n editor and its execution list (the owner account is the user's);
- the Railway variables, such as `EMAIL_FROM`;
- the Resend dashboard;
- C1050's browser run and its screenshots. No browser was driven, so the demo owner's session was not put at risk.

### Re-verified at `a767e35` (in scope)

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1052 (reworded in `8bb23a4`) | 5 notify calls read the status without failing; `409`/`500`/`502`/`503`/`504`/network loop through a 10-minute Wait back to the same call (same key, fresh timestamp and signature); stop after 6 retries; W1 goes on, W3 and W5 end; every other status never loops, asserted with 200/400/401/404/422/429/501 | vitest 100 `C1052:` ✓ (20 per call x 5), exit 0 | exports unchanged: `automation/n8n/W1-agreement-sent.json:331,390,449`, `automation/n8n/W3-agreement-decided.json:119`, `automation/n8n/W5-stale-daily.json:128`, each `[409, 500, 502, 503, 504].includes($json.statusCode) \|\| $json.statusCode === undefined`; tests: `web/n8n-workflows.test.ts:307` `test.each([200, 400, 401, 404, 422, 429, 501])`, `:309-311` `run.failed` `toBe(false)`, `run.calls` `toBe(1)`, `run.tenMinuteWaits` `toBe(0)`; `:315-322` over the 6 triggers: `calls` `toBe(3)`, `tenMinuteWaits` `toBe(2)`, `new Set(run.keys).size` `toBe(1)`, `signedBeforeEachCall` `toBe(true)`; `:326-331` `calls` `toBe(7)`, `tenMinuteWaits` `toBe(6)`, exit `toBe(expectedExit)` | PASS |
| C1049 | dispatch reaches the receiver within 2 min, the outbox row becomes `sent`, and the body and headers verify with the secret; email: one signed `customer_link` callback delivers 1 email from `@felipeviana.com`, and the notification is `sent` with a provider id; n8n: the same callback comes from W1 | live, run by the orchestrator (`.specs/features/outbox-dispatch/checks.md:523-533`), corroborated by this Verifier's read-only queries and requests above | **Dispatch:** AG-1048's transition at 15:54:13 got n8n's `200` at 15:55:00, 47 s later, and the row was `sent` at 15:56:00, within 2 minutes. "Verify with the secret" is shown by n8n's own gate, not by an echo receiver (F19): the IF's false branch reaches no workflow (C1035, `web/n8n-workflows.test.ts:288`), yet W1 ran and wrote `n8n_execution_id` 4 and 6. **n8n:** the callbacks came from W1, as the execution ids on both events and the `w1:<event>:link` keys show. **Email:** AG-1048's notification is `sent` with provider id `01a18d85-…`, and AG-1046's is `skipped` / `reserved_domain`. **Not shown: "delivers 1 email".** No one has recorded that the email arrived (`checks.md:532`), and `EMAIL_FROM` is known only from the record (`checks.md:525`) | UNPROVEN - the delivery clause waits on the user's inbox confirmation |
| C1050 | Playwright at 375/768/1440; no horizontal scroll; the line is readable; console clean; one signed-in context | live, run by the orchestrator (`.specs/features/outbox-dispatch/checks.md:480-498`); not re-run here | Record: the line box is `[16,317,328,19]` at 375 (right edge 344 <= 375, 13px), `[20,234,713,19]` at 768 (733 <= 768) and `[260,143,1137,19]` at 1440 (1397 <= 1440). Horizontal scroll is "none" at each size, the console had 0 errors and 0 warnings, and there was one signed-in context (`checks.md:482`). Corroborated: AG-1046 is `sent` with an `agreement.sent` event, which the line needs in order to render, and the box arithmetic fits the stated sizes. This Verifier did not see the screenshots | PASS (on the recorded live run) |
| C1051 | CONTEXT entry and build log; STATE AD entries and AD-070 amended; ROADMAP ticks Phase 3 item 5; PRODUCT drops Postmark | shell at `a767e35`: `grep -c "outbox-dispatch\|automation_claim" CONTEXT.md` prints `7` (at least 2); `grep -n "Outbox dispatcher" ROADMAP.md` prints 1 line, `117:- [x] Outbox dispatcher ...` | `ROADMAP.md:117` `- [x] Outbox dispatcher`; `CONTEXT.md:174` new n8n instance bullet (Railway, Vault names); `CONTEXT.md:222` dated `2026-10-30` Build log line; `.specs/STATE.md:76` AD-070 `active, amended by AD-077`; `grep -c Postmark PRODUCT.md` prints 0. The doc defects are in F20 | PASS |

### Carried from `aec4fb0` (round 3, at `a915c69`; most rows first verified at `5c4237b`)

These verdicts and their evidence are carried, not re-derived. Their vitest proofs re-ran green at `a767e35` in the full suite above, with 1818 passed on the rerun.

The citations in `web/n8n-workflows.test.ts` (C1002, C1033-C1035) still hold, because `8bb23a4` edited line 307 in place and moved no line. No other cited file changed in `a915c69..a767e35`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1001 | 1 due row -> 1 signed POST with the 8 body keys, and the row becomes `sending` with `request_id`. A row due in 1 minute waits | test:db PASS | `supabase/tests/outbox_dispatch.sql:195` `tests.od_queue() = q0 + 1`; `:197` `q.method = 'POST' and q.url = 'https://n8n.test/webhook/events' and ... ? 'X-SA-Signature'`; `:201-203` keys `= array['deliveryId','entityId','entityType','eventId','occurredAt','orgId','payload','type']`; `:207` `status = 'sending' and request_id = q.id`; `:209` later row `pending`, `request_id is null` | PASS |
| C1002 | signature over `<ts>.<queued bytes>`; fixed vector equal in SQL and Node | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:213` queued signature recomputed with `extensions.hmac`; `:222` vector `= '8cb2c335...47a9f'`; `web/n8n-workflows.test.ts:136` `expect(hex).toBe("8cb2c3355fca388e9ac2caec004f4d5d7045d74937ab5faad61dc11682247a9f")` | PASS |
| C1003 | 200/204/299 -> `sent`, `sent_at`, attempts unchanged | test:db PASS | `supabase/tests/outbox_dispatch.sql:241-242` `status = 'sent' and sent_at is not null and attempts = 0` | PASS |
| C1004 | 300/404/500/timeout/error/11-min silence -> retried; 9 min stays; backoff 1..1440 | test:db PASS | `supabase/tests/outbox_dispatch.sql:263-264` `status = 'pending' and attempts = 1 and length(last_error) > 0`; `:266` 9 min `= 'sending'`; `:274-276` `attempts = k and abs(extract(epoch from available_at - (now() + make_interval(mins => backoff[k])))) < 1` | PASS |
| C1005 | attempt 8 -> `failed`, never queued again | test:db PASS | `supabase/tests/outbox_dispatch.sql:288` `status = 'failed' and attempts = 8`; `:292` `tests.od_queue() = q0 and status = 'failed'` | PASS |
| C1006 | two runs queue 1; 51 -> 50 then 1; lock and skip locked in def | test:db PASS | `supabase/tests/outbox_dispatch.sql:307` `q0 + 1`; `:315` `q0 + 50`; `:317` `q0 + 51`; `:318` `position('for update skip locked' in def) > 0 and position('pg_try_advisory_xact_lock(...)')` | PASS |
| C1007 | either secret missing -> nothing queued, no row changed | test:db PASS | `supabase/tests/outbox_dispatch.sql:337` `tests.od_queue() = q0 and before = string_agg(...)` over both names | PASS |
| C1008 | live: 0 pre-migration `pending`, all 8 retired | mcp `execute_sql`, read-only, run by this Verifier | live: `outbox_total 8`, `old_pending 0` (`created_at < '2026-10-29 16:54:30+00'`), `retired 8` (`failed` with `'enqueued before dispatch existed'`). The before count of 8 is from `.specs/features/outbox-dispatch/checks.md:418` | PASS |
| C1009 | anon and uE get 42501; no execute grant | test:db PASS | `supabase/tests/outbox_dispatch.sql:348-349,353-354` `expect_error(..., '42501')`; `:359` `not has_function_privilege(...)` | PASS |
| C1010 | 5 bad header inputs -> 401, 0 claim calls | vitest 5 ✓ | `web/app/api/automation/notify/route.test.ts:60-62` `toBe(401)`, `claim` 0 calls, `getAutomationContainer` 0 calls | PASS |
| C1011 | 4 signature failures -> 42501, nothing written; 299 s ok; adapter maps it; route 401 | test:db PASS; vitest 3 ✓ | `supabase/tests/outbox_dispatch.sql:386-389` 4x `'42501'`; `:390` nothing written; `:392` 299 s ok; `web/infrastructure/supabase/automation.test.ts:100` `{ ok: false, code: "unauthorized" }`; `web/app/api/automation/notify/route.test.ts:67` `toBe(401)` | PASS |
| C1012 | 6 bad bodies -> 22023, nothing written, route 400; 5 key formats pass | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:415` `'22023'`; `:417` nothing written; `:432` `<> '22023'` per format; `web/app/api/automation/notify/route.test.ts:79` `toBe(400)` | PASS |
| C1013 | execution id written once | test:db PASS | `supabase/tests/outbox_dispatch.sql:441` `= 'exec-1'`; `:443` still `'exec-1'` | PASS |
| C1014 | sent/skipped key -> duplicate, no row change; route 200 duplicate, 0 sends | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:458,465` `decision = 'duplicate'`, row unchanged; `web/app/api/automation/notify/route.test.ts:86-88` `toBe(200)`, `{ outcome: "duplicate" }`, `send` 0 calls | PASS |
| C1015 | 9 min `in_flight`/409; 11 min or failed -> send, 1 row; send then in_flight | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:476-477` `'send'` then `'in_flight'`; `:479` 9 min `'in_flight'`; `:481-482` 11 min `'send'`, count 1; `:484-485` failed -> `'send'`, `'claimed'`; `web/app/api/automation/notify/route.test.ts:93-94` `toBe(409)`, send 0 | PASS |
| C1016 | provider failure -> complete `failed`, route 503; retry sends | vitest 5 ✓ | `web/application/use-cases/notify.test.ts:91-92` complete `[{ id: "n1", outcome: "failed", error: code }]`; `:98-101` second notify `sent`; `web/app/api/automation/notify/route.test.ts:99-100` `toBe(503)`, complete `failed` | PASS |
| C1017 | unknown or cross-org event -> P0002, nothing written, 404; unexpected -> 503 logged | test:db PASS; vitest 4 ✓ | `supabase/tests/outbox_dispatch.sql:498,500` `'P0002'`; `:501` nothing written; `web/app/api/automation/notify/route.test.ts:105` `toBe(404)`; `:112-113` `toBe(503)`, log called with cause | PASS |
| C1018 | no `RESEND_API_KEY` -> 503, `email not configured`, no fetch | vitest ✓ | `web/composition/automation-container.test.ts:39-41` `toBe(503)`, log contains `"email not configured"`, `fetchMock` 0 calls | PASS |
| C1019 | claim facts; built email subject, button href, total, phone, no product name | test:db PASS; vitest 5 ✓ | `supabase/tests/outbox_dispatch.sql:511-517` decision, `to`, tenant, agreement, token; `web/domain/notifications/notifications.test.ts:24-32` subject `toBe("Service agreement AG-1052 from Northwind Mechanical Ltd.")`, href `${BASE}/review/${TOKEN}`, `toMatch(/\$3,870\.00[^<\n]*before tax/)`, `not.toContain("Service Agreement")`, `not.toContain("felipeviana")`; `:39-41` no `null`/`undefined`; `web/application/use-cases/notify.test.ts:108` unsealed href | PASS |
| C1020 | day3/day7 subject and facts; new sealed token after reissue | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:542` day3; `:550` day7 `tokenSealed = od_sealed('f20-new')`; `web/domain/notifications/notifications.test.ts:47` `toBe("Reminder: service agreement AG-1052 from Northwind Mechanical Ltd.")` | PASS |
| C1021 | decided x4, superseded, viewed -> skipped | test:db PASS | `supabase/tests/outbox_dispatch.sql:570-573` `decision = 'skip' and reason = c.reason and messages 0 and status = 'skipped' and skip_reason = c.reason` | PASS |
| C1022 | no contact / null email -> `no_recipient` | test:db PASS | `supabase/tests/outbox_dispatch.sql:587` `'no_recipient'` x2 | PASS |
| C1023 | revoked-only / null sealed -> `no_link_secret` | test:db PASS | `supabase/tests/outbox_dispatch.sql:603` `'no_link_secret'` x2 | PASS |
| C1024 | 5 reserved domains skipped, 0 fetch; 3 controls sent | vitest 25 ✓ | `web/application/use-cases/notify.test.ts:119-121` `{ outcome: "skipped", reason: "reserved_domain" }`, `send` 0 calls; `:127-128` controls `sent`; `web/infrastructure/email/resend.test.ts:88` refused with no request; `:96` controls `{ ok: true, providerMessageId: "re_1" }` | PASS |
| C1025 | replyTo = uE email; absent with null actor | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:521` `replyTo = (select email ... uE)`; `:532` `not m ? 'replyTo'`; `web/application/use-cases/notify.test.ts:134,137` | PASS |
| C1026 | seal/unseal, random IV, format, 3 tampers throw, use cases hash match, DB stores sealed | vitest 9 ✓; test:db PASS | `web/infrastructure/portal-tokens.test.ts:30` `toBe(TOKEN)`; `:34` `not.toBe`; `:38` `toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/)`; `:44-47` `toThrow()` x3; `web/app/(app)/sendAgreement.test.ts:135,146` `expect(sha256(token)).toBe(hash)`; `supabase/tests/outbox_dispatch.sql:522` stored sealed | PASS |
| C1027 | W3 to uE with name, number, reason; subjects; link | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:626` `to = jsonb_build_array(uE email)`, decision, reason; `web/domain/notifications/notifications.test.ts:69-72` `toBe("Harbourview Strata refused AG-1052")`, href `${BASE}/agreements/a1`; `:78` changes subject | PASS |
| C1028 | null/departed actor -> exactly owner + admin | test:db PASS | `supabase/tests/outbox_dispatch.sql:653-654` `recipients = (select array_agg(email order by email) from auth.users where id in (uA, uD))` | PASS |
| C1029 | W5: 1 message, owner+admin, exactly 2 stale, stored key, subjects, links | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:673,674,676,680`; `web/domain/notifications/notifications.test.ts:89-90,97` `toBe("2 agreements not viewed after 7 days")`, `toBe("1 agreement not viewed after 7 days")` | PASS |
| C1030 | org B: no message, no row | test:db PASS | `supabase/tests/outbox_dispatch.sql:683` | PASS |
| C1031 | same day: nothing; next day: again | test:db PASS | `supabase/tests/outbox_dispatch.sql:695` no message, count `= n0`; `:698` next day message | PASS |
| C1032 | delivery line states; draft none; reader query | vitest 13 ✓ | `web/components/agreements/agreements.test.ts:377` `toContain("Emailed to pat@customer.ca on Oct 29, 2026")`; `:387-392` 4 distinct phrases without `_`; `:396-397` `"Email pending"`; `:402` draft none; `web/infrastructure/supabase/agreements.test.ts:410-420` eq `["type","agreement.sent"]`, `["kind","customer_link"]`; `:434-436` (extra) `no_link_secret` -> `{ status: "not_sent", reason: "no_link_secret" }` | PASS |
| C1033 (reworded) | 4 exports; no credential value, `test-secret` or 64-hex; W1 has exactly 2 day-scale Waits, 3 then 4 days; notify bodies carry kind, key, `$execution.id`; W5 at 08:00 | vitest 7 ✓ | `web/n8n-workflows.test.ts:140` `readdirSync(DIR).sort()` `toEqual`; `:152-156` `not.toContain("test-secret")`, `not.toMatch(/[0-9a-fA-F]{64}/)`, credential keys id/name only; `:164-170` `unit === "days"` filter `toHaveLength(2)`, `{amount: 3, unit: "days"}` then `{amount: 4}`, order by reachability; `:188-190` kind, key regex, `executionId: $execution.id`; `:208` `{ field: "days", daysInterval: 1, triggerAtHour: 8, triggerAtMinute: 0 }` | PASS |
| C1034 | webhook `onReceived`; 3 routed values; fallback starts no workflow | vitest ✓ | `web/n8n-workflows.test.ts:215` `toBe("onReceived")`; `:225` `toEqual(["agreement.sent","agreement.refused","agreement.changes_requested"])`; `:233-235` W1, W3, W3; `:239` fallback reaches no `executeWorkflow` | PASS |
| C1035 (reworded) | Crypto HMAC over `<ts>.<raw body>` with `__SA_HMAC_SECRET__`; IF on signature and 300 s, false branch no workflow; no `$env`; notify URLs start `__SA_APP_BASE_URL__` | vitest 2 ✓ | `web/n8n-workflows.test.ts:245` `not.toContain("$env")`; `:249` URL `startsWith("__SA_APP_BASE_URL__")`; `:252` every signer `toBe("__SA_HMAC_SECRET__")`; `:255` `notifyCount` `toBe(5)`; `:265` value over `x-sa-timestamp` and `$json.rawBody`; `:267` `secret` `toBe("__SA_HMAC_SECRET__")`; `:272-281` `equals` on `x-sa-signature` and `lte 300`; `:288` false branch reaches no `executeWorkflow` or `switch` | PASS |
| C1036 | notifications constraints, RLS, no user writes | test:db PASS | `supabase/tests/outbox_dispatch.sql:707` `'23505'`; `:711,718,720,722` `'23514'`; `:724` `'23503'`; `:730,735,740` RLS; `:747-750` `'42501'` | PASS |
| C1037 | `token_sealed` format; old signatures store null; customer_portal passes; C907 lists it | test:db outbox_dispatch and customer_portal PASS | `supabase/tests/outbox_dispatch.sql:759` `'23514'`; `:761` format ok; `:764,771` `is null`; `supabase/tests/customer_portal.sql:267-270` C907 columns include `'token_sealed'` | PASS |
| C1038 | proxy lets the route through; 3 look-alikes redirect; `no-store` | vitest 5 ✓ | `web/proxy.automation.test.ts:25-26` `toBe(200)`; `:31-32` `toBe(307)`, `"/login"`; `web/app/api/automation/notify/route.test.ts:131` `Cache-Control` `toBe("no-store")` | PASS |
| C1039 | Resend request shape; status mapping; `"` escaped | vitest 9 ✓ | `web/infrastructure/email/resend.test.ts:35` `{ ok: true, providerMessageId: "re_1" }`; `:38-50` request shape; `:60` 200 -> id; `:65` `{ ok: false, code: "rejected" }`; `:74` `unavailable` x3; `:79` (extra) 409 `unavailable`; `:84` `toBe('"The \\"Best\\" Heating" <agreements@felipeviana.com>')` | PASS |
| C1040 | claim/complete definer, `search_path`, grants; anon works | test:db PASS | `supabase/tests/outbox_dispatch.sql:783` `prosecdef and proconfig @> ... and has_function_privilege('anon'...) and not ... 'public'`; `:799-800` anon claim `'send'`, complete `'sent'` | PASS |
| C1041 | advisors: exactly 12, no `extension_in_public` | mcp `get_advisors` security, run by this Verifier at HEAD | live: `rls_enabled_no_policy` 1 (outbox); `anon_security_definer_function_executable` 5 (`automation_claim`, `automation_complete`, `portal_decide`, `portal_record_view`, `portal_view`); `authenticated_...` 5 (same); `auth_leaked_password_protection` 1. Total 12, no `extension_in_public`. Author's record: `.specs/features/outbox-dispatch/checks.md:419` | PASS |
| C1042 | 1 cron job; both extensions; `sending` ok, `queued` refused | test:db PASS; live read | `supabase/tests/outbox_dispatch.sql:365` job schedule and command; `:368` extensions `= 2`; `:372` `'queued'` -> `'23514'`; live `cron.job` count for `outbox-dispatch` = 1 | PASS |
| C1043 | complete records sent/failed; other key/unknown id P0002; wrong sig 42501; route 200 `sent` | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:816,818` `'P0002'`; `:820` `'42501'`; `:822` unchanged; `:826` `status = 'sent' and provider_message_id = 're_1' and sent_at is not null`; `:830` failed with error; `web/app/api/automation/notify/route.test.ts:119-121` `toBe(200)`, `{ outcome: "sent" }` | PASS |
| C1044 | use case send / skip / 2 messages | vitest 3 ✓ | `web/application/use-cases/notify.test.ts:45,52-53` 1 send, 1 complete `sent`; `:58-60` skip `viewed`, 0 sends, 0 completes; `:76-85` 2 sends, 1 complete with 2 results | PASS |
| C1045 | plain recipe; 18 recipes; 20 files; C830 pins moved | vitest ✓ | `web/scripts/test-db/runner.test.ts:108-111` `RECIPES` `toHaveLength(18)`, `REAL_FILES` `toHaveLength(20)`; `:100-105` C830 18/20 | PASS |
| C1046 | 3 env names read only in `composition/`; no `NEXT_PUBLIC_`; `.env.example` names them | vitest ✓ | `web/boundaries.test.ts:170-177` outside readers `toEqual([])`, exposed `toEqual([])`, `.env.example` `toMatch(^NAME=[ \t]*$)`; `web/.env.example:21,23,25` | PASS |
| C1047 | types regenerated; lint, tsc, build | lint exit 0; tsc exit 0; build exit 0 | `web/infrastructure/supabase/database.types.ts:589` `notifications: {`; `:802` `token_sealed: string \| null`; `:989` `automation_claim: {` | PASS |
| C1048 | `npm test` exit 0; test:db 18/0 | vitest at `a767e35`: first run 1816 passed and 2 failed (the F15 timeouts), rerun 1818 passed, exit 0; test:db 18 passed and 0 failed (carried) | runner pass condition `web/scripts/test-db/runner.mts:134`. See F15 | PASS |

**Count:** 51 PASS and 1 UNPROVEN (C1049). 51 of 52 checks are proven.

- 47 were carried unchanged.
- C1048 was carried, with its vitest half re-run.
- C1050, C1051 and C1052 were re-verified this round.

## Coverage

These rows were recomputed at `a767e35`, because the diff touched their authority:

- **statuses that never loop:** C1052's text changed in `8bb23a4`.
- **startup config** and **AC 16:** the live run now supplies the layer these rows had left to C1049.

The retry-trigger row was re-read from the exports, which are unchanged. `grep -n "includes(\$json.statusCode)" automation/n8n/*.json` gives 5 hits, all with the same predicate.

Every other row is carried from `aec4fb0`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| outbound webhook statuses (6) | `supabase/migrations/20261029165430_outbox_dispatch.sql:52` (`status_code between 200 and 299`) | 200, 204, 299 C1003 · 404, 500 (plus 300, error) C1004 · timeout C1004 | - |
| route statuses (6) | `web/app/api/automation/notify/route.ts` | 200 C1014, C1043 · 400 C1012 · 401 C1010, C1011 · 404 C1017 · 409 C1015 · 503 C1016, C1017, C1018 | - |
| `automation_claim` outcomes (4) | migration `automation_claim` / `automation_request` | returned C1019 · 42501 C1011 · 22023 C1012 · P0002 C1017 | - |
| `automation_complete` outcomes (4) | migration `automation_complete` | recorded C1043 · 42501 C1043 · 22023 C1012 · P0002 C1043 | - (the route maps all of them to 503, F8 carried) |
| send/reissue statuses, unchanged (5) | customer-portal recipe | 200, 404, 409, 403, 422 via `customer_portal` PASS (C1037) | - |
| claim decisions (4) | migration | send C1015, C1019 · skip C1021 · duplicate C1014 · in_flight C1015 | - |
| notification kinds (4) | migration kind check | customer_link C1019 · customer_reminder C1020 · staff_decision C1027 · staff_stale C1029 | - |
| key formats (5) | migration key check; exports' Set bodies | link, day3, day7, w3, w5 C1012 (SQL), C1033 (exports) | - |
| skip reasons (6) | migration skip check | decided, superseded, viewed C1021 · no_recipient C1022 · no_link_secret C1023 · reserved_domain C1024 | - |
| statuses that are `decided` (4) | migration (`status <> 'sent'`) | accepted, refused, changes_requested, withdrawn C1021 | - |
| reserved domains (5) | `web/domain/notifications/index.ts` | all 5 C1024 | - |
| notification statuses (4) | migration | claimed C1015, C1036 · sent C1043 · skipped C1021 · failed C1043 | - |
| outbox statuses (4) | migration | pending C1001, C1004 · sending C1001, C1042 · sent C1003 · failed C1005, C1008 | - |
| backoff schedule (7) | migration backoff array | 1..1440 C1004, table-driven | - |
| outbound body keys (8) | migration | all 8 C1001 | - |
| signature failures (4) | migration | wrong secret, body changed, 301 s past, 301 s future C1011 | - |
| route header rejections (5) | `route.ts` | 5 inputs C1010 | - |
| missing secrets (2) | migration | both C1007 | - |
| W3 recipients (3) | migration | sender C1027 · null actor, departed C1028 | - |
| W5 inclusion (5) | migration | 8-day unviewed, 6-day, viewed, accepted C1029 · other org C1030 | - |
| Resend responses (6, with 409) | `web/infrastructure/email/index.ts` | 200, 422, 429, 500, network C1039 · 409 C1039 (extra), `resend.test.ts:77-79` | - |
| delivery line states (6) | `web/components/agreements/agreement-view.tsx` | sent, 4 reasons, none C1032 (view); the reader's `no_link_secret` mapping is now asserted at `agreements.test.ts:434` | - |
| sealing failures (3) | `web/infrastructure/portal-tokens.ts` | wrong key, ciphertext, tag C1026 | - |
| n8n exports (4) | `automation/n8n/` listing | events C1033-C1035 · W1, W3, W5 C1033, C1052 | - |
| notify calls that retry (5) | recomputed at `aec4fb0`: 5 `httpRequest` nodes to `/api/automation/notify`, each followed by a `Retry <call>?` IF | all 5 C1052 (`describe.each(CALLS)`, `web/n8n-workflows.test.ts:294-300`), and C1035's `notifyCount` 5 (`:255`) | - |
| retry triggers (6) | recomputed at `aec4fb0`: `automation/n8n/W1-agreement-sent.json:331,390,449`, `W3-agreement-decided.json:119`, `W5-stale-daily.json:128`: `[409, 500, 502, 503, 504].includes($json.statusCode) \|\| $json.statusCode === undefined`, with `$runIndex < 6` | 409, 500, 502, 503, 504 and network C1052 (`web/n8n-workflows.test.ts:315,326`), each over 5 calls and 2 tests | - |
| statuses that never loop (7 named; the set is every status outside the 6 triggers) | recomputed from C1052's text at `8bb23a4` (`.specs/features/outbox-dispatch/checks.md:206`) | 200, 400, 401, 404, 422, 429, 501 C1052 (`web/n8n-workflows.test.ts:307`), each over 5 calls. A predicate widened to `>= 409` is now killed (Faults) | - |
| exit after the last retry (5) | IF false outputs: link -> `Wait 3 days`, day 3 -> `Wait 4 days`, day 7 / W3 / W5 -> none | all 5 C1052 (`expectedExit`) | - |
| one-way doors (13 Landing rows) | plan Landing | 1 C1042, C1006 · 2 C1002, C1035 · 3 C1040, C1011 · 4 C1036 · 5 C1037, C1026 · 6 C1038 · 7 C1039 · 8 C1033, C1052 · 9 C1004 · 10 C1037 · 11 C1019, C1029, C1043 · 12 superseded · 13 C1035 | - |
| proxy paths (4) | `web/infrastructure/supabase/session.ts` | 4 C1038 | - |
| startup config `PORTAL_LINK_KEY` (3 places) | `web/composition/index.ts` | send C1026 · reissue C1026 · automation assembly: stubbed in `automation-container.test.ts`. Live, the Railway app built and sent AG-1048's link email from a token sealed by the local dev server, so the key matches across the two (`checks.md:525,531`, and the notification read `sent` here) | - |
| AC 16 end to end: provider failure -> 503 -> n8n retries -> same key re-claimed and sent | DB C1015, use case C1016, export loop C1052 | all three layers are proven. The live run had no provider failure, so the real n8n runtime's retry path is still shown only by the simulator (F14) | - |

## Test policy rows

The Instrumentation row was re-judged, because the diff touched `web/n8n-workflows.test.ts`, which proves the exports that row classifies. The other two rows are carried from `aec4fb0`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration (dispatcher, claim, complete), `web/app/api/automation/notify/route.ts`, `web/infrastructure/email/index.ts` | boundary: SQL recipe over the queue table and RPCs, route via `POST`, adapter via stubbed `fetch`. Own layer: one labelled case per decision-table row | yes (carried) |
| Decides, not reached across a boundary | `web/domain/notifications/index.ts`, `web/infrastructure/portal-tokens.ts`, `web/application/use-cases/notify.ts` | own layer: C1019, C1020, C1024, C1027, C1029, C1032, C1026, C1044, C1016, C1025 | yes (carried) |
| Instrumentation | `web/composition/index.ts`, `web/infrastructure/supabase/automation.ts`, `automation/n8n/*.json` | none of its own. C1033-C1035 assert the exports' structure and C1052's walker their behaviour. The walker now also pins the statuses that never loop | yes (re-judged at `a767e35`) |

## Faults injected

Isolation: `git worktree add --detach <scratchpad>/wt4 HEAD` at `a767e35`, with `web/node_modules` junctioned to the real tree's copy. `git stash` was not used. For each fault:

- apply it alone with `sed`;
- run `npx vitest run n8n-workflows --reporter=verbose`;
- revert with `git checkout -- .`. Porcelain was empty after each revert.

The real tree's `git status --porcelain` was empty before the worktree was made. Afterwards, the junction was removed first, then the worktree (`git worktree remove --force`). The real tree's porcelain was still empty after that, before this report was written. The real `web/node_modules` was intact, with 387 entries before and after.

| Mutation | Location | Killed |
| --- | --- | --- |
| round 3's F17 survivor re-injected: the W1 day 3 predicate widened to `$json.statusCode >= 409 \|\| $json.statusCode === undefined` | `automation/n8n/W1-agreement-sent.json:390` | yes - 3 failed, 108 passed: `× ... W1-agreement-sent.json #1 (day3) > C1052: a 422 is read without failing the run and never loops`, and the same for `a 429` and `a 501` |
| `422` added to W1 link's retry list (`[409, 422, 500, 502, 503, 504]`) | `automation/n8n/W1-agreement-sent.json:331` | yes - 1 failed: `× ... W1-agreement-sent.json #0 (link) > C1052: a 422 is read without failing the run and never loops` |
| `429` added to W3's retry list (`[409, 429, 500, 502, 503, 504]`) | `automation/n8n/W3-agreement-decided.json:119` | yes - 1 failed: `× ... W3-agreement-decided.json #0 (W3) > C1052: a 429 is read without failing the run and never loops` |
| `501` added to W5's retry list (`[409, 500, 502, 503, 504, 501]`) | `automation/n8n/W5-stale-daily.json:128` | yes - 1 failed: `× ... W5-stale-daily.json #0 (W5) > C1052: a 501 is read without failing the run and never loops` |

4 injected, 4 killed. Each new status (422, 429, 501) has now been made to fail once, each in a different workflow file.

Rounds 1 to 3 injected 15 faults and killed 14. The one survivor, round 3's F17, is the first fault above and is now killed.

## Earlier findings - status at `a767e35`

| Finding | Status | Evidence |
| --- | --- | --- |
| F1, F2, F5, F13, F16 | resolved in earlier rounds, carried | round 2 report at `a03cab1`, round 3 report at `a915c69` |
| F3, F4, F8, F9 | observations, unchanged, carried | no file they cite was touched |
| F6 / F11 - C1051 vs the unticked ROADMAP item | resolved: ticked in `a767e35` (but see F20) | `ROADMAP.md:117` |
| F7 - precision gaps | carried (the C1019 `[^<\n]*` is unchanged) | no file it cites was touched |
| F10 - byte fidelity of the Webhook `rawBody` | resolved live. The database's signature verified in n8n's Crypto/IF gate, because W1 ran for both events (`n8n_execution_id` 4 and 6) | live reads above |
| F12 - stale wording in door 2 and open question 1 | carried, not blocking | `plan.md` unchanged |
| F14 - C1052 is proven by a simulator | partly resolved. A `200` path through n8n's notify call ran for real. The retry path (an error item with no `statusCode`, `$runIndex` across a persisted Wait, a gateway 5xx) has not happened live | live reads above; `web/n8n-workflows.test.ts:79-131` |
| F15 - lint-driven test timeouts under load | recurred. The first `npm test` this round had C32 and C873 time out (6364 ms and 6400 ms), and the rerun was green | see Proof runs |
| F17 - C1052 did not pin the statuses it does not name | resolved. The user's decision reworded C1052 in `8bb23a4` (`checks.md:500-502`), which added 15 `✓`, and the mutant is killed | Faults |
| F18 - doc consistency | superseded by F20 | - |

## Findings (new in round 4)

- **F19 - C1049's dispatch step used n8n as the receiver, not an echo receiver (observation, not blocking).**
  - C1049 says "the Vault secrets point at an echo receiver ... the receiver shows a body and headers that verify with the secret". The run pointed Vault straight at the n8n events webhook (`checks.md:529`).
  - What the echo receiver was meant to show is still shown:
    - the outbox row reached a receiver and became `sent` within 2 minutes;
    - the body and headers verified with the secret, because W1 ran and the signature gate is the only way into W1 (C1035).
  - This Verifier judges the dispatch clause met in substance. The user may want to reword C1049 to match what was run.
- **F20 - the docs claim more than the evidence (does not affect C1051's proof).**
  - `ROADMAP.md:117` says "link email delivered through Resend", but delivery is unconfirmed (`checks.md:532`). The item was therefore ticked before C1049 fully passed. The user's rule of 2026-10-29 (`checks.md:468`) was to tick it only once C1049 and C1050 pass.
  - `CONTEXT.md:175` still ends with "Not deployed yet: the deploy, the Vault secrets and the Resend key wait for the user's go-ahead (check C1049)". That contradicts the new bullet at `CONTEXT.md:174`.
  - The new Build log line at `CONTEXT.md:222` sits above the section's "Newest first. ..." instruction line at `:223`, not below it.
- **F21 - live data left behind (observation).**
  - AG-1046 and AG-1048 stay `sent`.
  - AG-1048's W1 execution is now in its 3-day and 4-day Waits. Both reminders will be skipped as `reserved_domain`, because the contact is back on `example.com` (verified here).
  - This matches the record (`checks.md:532`) and STATE's Handoff.

## Gate

- `npx vitest run n8n-workflows --reporter=verbose`: 111 passed, 0 failed. There are 100 `C1052:` ✓, including 5 each for 422, 429 and 501.
- `npm test`: the first run had 1816 passed and 2 failed (the F15 timeouts, C32 and C873). The rerun had 1818 passed, exit 0.
- Live reads, at about 16:00 UTC on 2026-10-30:
  - mcp `execute_sql` (`select` only);
  - `get_advisors` security, 12 lints;
  - `curl` on the Railway app (`401`, `200`, `307`) and n8n `/healthz` (`200`).
- Carried: `npm run lint` and `npx tsc --noEmit` exit 0 (`aec4fb0`); `npm run test:db` 18 passed and 0 failed, and `npm run build` exit 0 (`5c4237b`).
