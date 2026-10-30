# Outbox dispatch, n8n W1/W3/W5 and transactional email - verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: aae1901..8656e3f (this round's scope: the diff `f5b1dc6..8656e3f`)
**Round**: 5 - scoped, verified at `8656e3f`. Scope:
- the diff `f5b1dc6..8656e3f`: commit `8656e3f`, which adds only the section "C1049 inbox confirmation" to `.specs/features/outbox-dispatch/checks.md` (4 insertions, `checks.md:534-537`). No code, SQL, export, test or config file changed;
- round 4's only non-PASS verdict: C1049's "delivers 1 email" clause.

Everything else is carried from `a767e35` (round 4, kept at `f5b1dc6`), which itself carried most rows from `aec4fb0` (round 3) and `5c4237b` (round 2). Each carried section below says so.

**Verifier**: independent sub-agent, the round 5 Verifier (author != verifier). The orchestrator session wrote the recorded confirmation and every earlier change. This Verifier wrote no code, changed no live system, ran only `select` queries and the test suite, and wrote only this file.

Resolved this round:

1. **C1049 passes.** The one open clause, "delivers 1 email from `@felipeviana.com`", is now backed by the user's own inbox confirmation (`.specs/features/outbox-dispatch/checks.md:535-537`). This Verifier's live read still shows exactly one `customer_link` notification `sent`, with provider id `01a18d85-8881-79bd-b6f0-1553eb085817`. The kind of evidence used is noted in F22.
2. **F20 (round 4's doc findings) is resolved.** `f5b1dc6` changed `ROADMAP.md:117` to "link email accepted by Resend", removed the stale "Not deployed yet" sentence from `CONTEXT.md:175`, and moved the Build log line below the "Newest first." line (`CONTEXT.md:222-224`). This is outside the strict `f5b1dc6..HEAD` scope, because round 4 was written at `a767e35`, before that fix, so this Verifier read those three edits.

52 of 52 checks are proven. Round 4's 4 faults stay killed (carried). No fault was injected this round, because the diff touches no code, so there is no assertion surface to mutate.

In the tables below, a code `||` or a grep alternation is written as `OR`, because a pipe character would split the table cell.

## Proof runs at `8656e3f` (all from `web/`)

The tree at `8656e3f` has the same code as `a767e35`: `git diff --stat a767e35..8656e3f` touches only `checks.md`, `verification.md`, `CONTEXT.md` and `ROADMAP.md`. The vitest proofs still re-ran in full, as verify.md asks.

- **`npx vitest run`**:
  - First run: 1816 passed and 2 failed (84 files). The visible failure frame is `web/domain/purity.test.ts:29` (`restrictedImports`, the lint-driven helper), which is F15's timeout again. Nothing else changed, so this is the same flake.
  - Immediate rerun: 1818 of 1818 passed (84 files), exit 0. That is the same count as round 4.
- **`npx vitest run n8n-workflows --reporter=verbose`**: 111 passed, 0 `×`, with 100 `✓ ... C1052:` lines, the same as round 4.
- **Not re-run, so carried**: `npm run test:db`, `npm run lint`, `npx tsc --noEmit` and `npm run build`. No SQL, TypeScript or config changed since they last ran green (`aec4fb0` and `5c4237b`).

## Live read by this Verifier (read-only, 2026-10-30)

mcp `execute_sql`, `select` only, on `gnxebrtcpbujhvcamtoe`, over `public.notifications`:

| What | Result |
| --- | --- |
| AG-1048 `w1:22b6eb12-…:link` | `customer_link`, `sent` at `2026-10-30 15:55:01.448095+00`, `provider_message_id = '01a18d85-8881-79bd-b6f0-1553eb085817'`, error null, skip reason null, 1 recipient at `gmail.com` (the address itself is not copied here) |
| AG-1046 `w1:d8dc2c92-…:link` | `customer_link`, `skipped` / `reserved_domain`, 1 recipient at `example.com`, no provider id |
| totals | 2 notifications in all, and exactly 1 `customer_link` with status `sent` |

This matches round 4's read and the orchestrator's record (`checks.md:531`). Nothing moved after the send: no second send and no change to the row.

## Binding sources

Carried from `a767e35`. `ROADMAP.md:117` was re-read at `8656e3f`, and now reads "link email accepted by Resend", so the round 4 contradiction (F20) is gone.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 5, M12, M13, n8n table (W1, W3, W5) | re-read at `8656e3f`: `ROADMAP.md:117` reads `- [x] Outbox dispatcher ... link email accepted by Resend` | - (F20 resolved) | - |
| STATE.md AD-015, AD-016, AD-068 to AD-079, Handoff | carried from `a767e35` (`.specs/STATE.md:76` AD-070 `active, amended by AD-077`, `:85` AD-079); STATE is unchanged since | - | - |
| Plan Landing rows 1-13 (row 13 supersedes row 12) | carried from `5c4237b` (`.specs/features/outbox-dispatch/plan.md:86-99`, unchanged) | - (F12 carried) | - |

## Checks

### Re-verified at `8656e3f` (in scope)

C1049's wording (`.specs/features/outbox-dispatch/checks.md:284-289`) is judged clause by clause.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1049 | dispatch reaches the receiver within 2 min, the outbox row becomes `sent`, and the body and headers verify with the secret; email: one signed `customer_link` callback, for a demo agreement whose contact email is temporarily the account owner's, delivers 1 email from `@felipeviana.com`, and the notification is `sent` with a provider id; n8n: the same callback comes from W1 | live, run by the orchestrator (`.specs/features/outbox-dispatch/checks.md:523-533`); inbox confirmed by the user (`checks.md:535-537`); corroborated by this Verifier's `select` above, and in round 4 | **Dispatch, n8n:** carried from round 4. AG-1048's row got n8n's `200` 47 s after the transition and was `sent` within 2 minutes. The signature verified through n8n's gate (C1035, `web/n8n-workflows.test.ts:288`), which is the only way into W1, and W1 wrote `n8n_execution_id` 6 (F19 carried). **Email:** the notification is `sent` with provider id `01a18d85-…` (live read above), and it is the only sent `customer_link`, so this is 1 email. The user confirms it arrived in their inbox, not spam, from `agreements@felipeviana.com`, with the subject "Service agreement AG-1048 from Kettle Ridge Mechanical Ltd." (`checks.md:537`). That subject has the form C1019 pins (`web/domain/notifications/notifications.test.ts:24`), and the sender domain is `@felipeviana.com`. The contact was temporary and was restored to `example.com` (`checks.md:531`, read back in round 4). See F22 for how much weight a user-reported arrival carries | PASS |

### Carried from `a767e35` (round 4, at `f5b1dc6`)

The rows below are carried with their round 4 verdict and evidence. The vitest proofs re-ran green at `8656e3f` (1818 passed on the rerun). No cited file changed in `f5b1dc6..8656e3f`, and only `ROADMAP.md` and `CONTEXT.md` changed in `a767e35..f5b1dc6`. For C1051, this Verifier re-ran the shell proof at `8656e3f`: `grep -c "outbox-dispatch OR automation_claim" CONTEXT.md` prints `7`, `grep -c Postmark PRODUCT.md` prints `0`, and `ROADMAP.md:117` is still `- [x] Outbox dispatcher`. `CONTEXT.md:222` is now the "Newest first." line, with the dated Build log line at `:224`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1052 (reworded in `8bb23a4`) | 5 notify calls read the status without failing; `409`/`500`/`502`/`503`/`504`/network loop through a 10-minute Wait back to the same call (same key, fresh timestamp and signature); stop after 6 retries; W1 goes on, W3 and W5 end; every other status never loops, asserted with 200/400/401/404/422/429/501 | vitest 100 `C1052:` ✓ (20 per call x 5), exit 0 | exports unchanged: `automation/n8n/W1-agreement-sent.json:331,390,449`, `automation/n8n/W3-agreement-decided.json:119`, `automation/n8n/W5-stale-daily.json:128`, each `[409, 500, 502, 503, 504].includes($json.statusCode) OR $json.statusCode === undefined`; tests: `web/n8n-workflows.test.ts:307` `test.each([200, 400, 401, 404, 422, 429, 501])`, `:309-311` `run.failed` `toBe(false)`, `run.calls` `toBe(1)`, `run.tenMinuteWaits` `toBe(0)`; `:315-322` over the 6 triggers: `calls` `toBe(3)`, `tenMinuteWaits` `toBe(2)`, `new Set(run.keys).size` `toBe(1)`, `signedBeforeEachCall` `toBe(true)`; `:326-331` `calls` `toBe(7)`, `tenMinuteWaits` `toBe(6)`, exit `toBe(expectedExit)` | PASS (carried from `a767e35`) |
| C1050 | Playwright at 375/768/1440; no horizontal scroll; the line is readable; console clean; one signed-in context | live, run by the orchestrator (`.specs/features/outbox-dispatch/checks.md:480-498`); not re-run here | Record: the line box is `[16,317,328,19]` at 375 (right edge 344 <= 375, 13px), `[20,234,713,19]` at 768 (733 <= 768) and `[260,143,1137,19]` at 1440 (1397 <= 1440). Horizontal scroll is "none" at each size, the console had 0 errors and 0 warnings, and there was one signed-in context (`checks.md:482`). Corroborated: AG-1046 is `sent` with an `agreement.sent` event, which the line needs in order to render, and the box arithmetic fits the stated sizes. This Verifier did not see the screenshots | PASS (on the recorded live run) |
| C1051 | CONTEXT entry and build log; STATE AD entries and AD-070 amended; ROADMAP ticks Phase 3 item 5; PRODUCT drops Postmark | shell at `a767e35`: `grep -c "outbox-dispatch OR automation_claim" CONTEXT.md` prints `7` (at least 2); `grep -n "Outbox dispatcher" ROADMAP.md` prints 1 line, `117:- [x] Outbox dispatcher ...` | `ROADMAP.md:117` `- [x] Outbox dispatcher`; `CONTEXT.md:174` new n8n instance bullet (Railway, Vault names); `CONTEXT.md:222` dated `2026-10-30` Build log line; `.specs/STATE.md:76` AD-070 `active, amended by AD-077`; `grep -c Postmark PRODUCT.md` prints 0. The doc defects are in F20 | PASS |
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
| C1047 | types regenerated; lint, tsc, build | lint exit 0; tsc exit 0; build exit 0 | `web/infrastructure/supabase/database.types.ts:589` `notifications: {`; `:802` `token_sealed: string or null`; `:989` `automation_claim: {` | PASS |
| C1048 | `npm test` exit 0; test:db 18/0 | vitest at `a767e35`: first run 1816 passed and 2 failed (the F15 timeouts), rerun 1818 passed, exit 0; test:db 18 passed and 0 failed (carried) | runner pass condition `web/scripts/test-db/runner.mts:134`. See F15 | PASS |

**Count:** 52 PASS. 52 of 52 checks are proven.

- C1049 was re-verified this round.
- C1050, C1051 and C1052 are carried from round 4 (`a767e35`). C1051's shell proof was re-run at `8656e3f`.
- The other 48 are carried from round 4, which carried them from `aec4fb0` or `5c4237b`. C1048's vitest half re-ran green here.

## Coverage

Carried from `a767e35`. The diff touches no code and no authority behind any set, so no row was recomputed. The rows **startup config** and **AC 16** relied on C1049's live run. That run is unchanged, and it now has the delivery confirmation too. The `automation_complete` row's note (the route maps every outcome to 503) is F8, carried.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| outbound webhook statuses (6) | `supabase/migrations/20261029165430_outbox_dispatch.sql:52` (`status_code between 200 and 299`) | 200, 204, 299 C1003 · 404, 500 (plus 300, error) C1004 · timeout C1004 | - |
| route statuses (6) | `web/app/api/automation/notify/route.ts` | 200 C1014, C1043 · 400 C1012 · 401 C1010, C1011 · 404 C1017 · 409 C1015 · 503 C1016, C1017, C1018 | - |
| `automation_claim` outcomes (4) | migration `automation_claim` / `automation_request` | returned C1019 · 42501 C1011 · 22023 C1012 · P0002 C1017 | - |
| `automation_complete` outcomes (4) | migration `automation_complete` | recorded C1043 · 42501 C1043 · 22023 C1012 · P0002 C1043 | - |
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
| retry triggers (6) | recomputed at `aec4fb0`: `automation/n8n/W1-agreement-sent.json:331,390,449`, `W3-agreement-decided.json:119`, `W5-stale-daily.json:128`: `[409, 500, 502, 503, 504].includes($json.statusCode) OR $json.statusCode === undefined`, with `$runIndex < 6` | 409, 500, 502, 503, 504 and network C1052 (`web/n8n-workflows.test.ts:315,326`), each over 5 calls and 2 tests | - |
| statuses that never loop (7 named; the set is every status outside the 6 triggers) | recomputed from C1052's text at `8bb23a4` (`.specs/features/outbox-dispatch/checks.md:206`) | 200, 400, 401, 404, 422, 429, 501 C1052 (`web/n8n-workflows.test.ts:307`), each over 5 calls. A predicate widened to `>= 409` is now killed (Faults) | - |
| exit after the last retry (5) | IF false outputs: link -> `Wait 3 days`, day 3 -> `Wait 4 days`, day 7 / W3 / W5 -> none | all 5 C1052 (`expectedExit`) | - |
| one-way doors (13 Landing rows) | plan Landing | 1 C1042, C1006 · 2 C1002, C1035 · 3 C1040, C1011 · 4 C1036 · 5 C1037, C1026 · 6 C1038 · 7 C1039 · 8 C1033, C1052 · 9 C1004 · 10 C1037 · 11 C1019, C1029, C1043 · 12 superseded · 13 C1035 | - |
| proxy paths (4) | `web/infrastructure/supabase/session.ts` | 4 C1038 | - |
| startup config `PORTAL_LINK_KEY` (3 places) | `web/composition/index.ts` | send C1026 · reissue C1026 · automation assembly: stubbed in `automation-container.test.ts`. Live, the Railway app built and sent AG-1048's link email from a token sealed by the local dev server, so the key matches across the two (`checks.md:525,531`, and the notification read `sent` here) | - |
| AC 16 end to end: provider failure -> 503 -> n8n retries -> same key re-claimed and sent | DB C1015, use case C1016, export loop C1052 | all three layers are proven. The live run had no provider failure, so the real n8n runtime's retry path is still shown only by the simulator (F14) | - |

## Test policy rows

Carried from `a767e35`. The diff classifies no file, so no row needed re-judging.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration (dispatcher, claim, complete), `web/app/api/automation/notify/route.ts`, `web/infrastructure/email/index.ts` | boundary: SQL recipe over the queue table and RPCs, route via `POST`, adapter via stubbed `fetch`. Own layer: one labelled case per decision-table row | yes (carried) |
| Decides, not reached across a boundary | `web/domain/notifications/index.ts`, `web/infrastructure/portal-tokens.ts`, `web/application/use-cases/notify.ts` | own layer: C1019, C1020, C1024, C1027, C1029, C1032, C1026, C1044, C1016, C1025 | yes (carried) |
| Instrumentation | `web/composition/index.ts`, `web/infrastructure/supabase/automation.ts`, `automation/n8n/*.json` | none of its own. C1033-C1035 assert the exports' structure and C1052's walker their behaviour. The walker now also pins the statuses that never loop | yes (re-judged at `a767e35`) |

## Faults injected

None this round. The diff `f5b1dc6..8656e3f` touches no code, so there is no assertion surface to mutate. The table is carried from `a767e35` (round 4), where the faults were injected in an isolated worktree.

| Mutation | Location | Killed |
| --- | --- | --- |
| round 3's F17 survivor re-injected: the W1 day 3 predicate widened to `$json.statusCode >= 409 OR $json.statusCode === undefined` | `automation/n8n/W1-agreement-sent.json:390` | yes - 3 failed, 108 passed: `× ... W1-agreement-sent.json #1 (day3) > C1052: a 422 is read without failing the run and never loops`, and the same for `a 429` and `a 501` |
| `422` added to W1 link's retry list (`[409, 422, 500, 502, 503, 504]`) | `automation/n8n/W1-agreement-sent.json:331` | yes - 1 failed: `× ... W1-agreement-sent.json #0 (link) > C1052: a 422 is read without failing the run and never loops` |
| `429` added to W3's retry list (`[409, 429, 500, 502, 503, 504]`) | `automation/n8n/W3-agreement-decided.json:119` | yes - 1 failed: `× ... W3-agreement-decided.json #0 (W3) > C1052: a 429 is read without failing the run and never loops` |
| `501` added to W5's retry list (`[409, 500, 502, 503, 504, 501]`) | `automation/n8n/W5-stale-daily.json:128` | yes - 1 failed: `× ... W5-stale-daily.json #0 (W5) > C1052: a 501 is read without failing the run and never loops` |

Carried: 4 injected, 4 killed. Rounds 1 to 3 injected 15 faults and killed 14, and the one survivor (F17) is the first row above, killed in round 4.

## Earlier findings - status at `8656e3f`

| Finding | Status | Evidence |
| --- | --- | --- |
| F1, F2, F5, F13, F16, F17 | resolved in earlier rounds, carried | round 2 report at `a03cab1`, round 3 at `a915c69`, round 4 at `f5b1dc6` |
| F3, F4, F7, F8, F9, F12 | observations, unchanged, carried | no file they cite was touched |
| F10, F6 / F11 | resolved in round 4, carried | round 4 report at `f5b1dc6` |
| F14 - C1052 is proven by a simulator | partly resolved, carried. The live retry path has still not run | `web/n8n-workflows.test.ts:79-131` |
| F15 - lint-driven test timeouts under load | recurred. The first `npm test` this round had 2 failures in the lint-driven tests (`web/domain/purity.test.ts:29` frame), and the rerun was green | see Proof runs |
| F19 - C1049's dispatch used n8n as the receiver, not an echo receiver | carried, observation, not blocking. C1049's text still names an echo receiver (`checks.md:285`) | round 4 report |
| F20 - the docs claimed more than the evidence | resolved in `f5b1dc6`: `ROADMAP.md:117` says "accepted by Resend"; the stale "Not deployed yet" sentence is gone from `CONTEXT.md:175`; the Build log line is below "Newest first." (`CONTEXT.md:222-224`) | read at `8656e3f` |
| F21 - live data left behind | carried, observation. AG-1048's W1 is still in its Waits, and its reminders go to the restored `example.com` contact | round 4 report |

## Findings (new in round 5)

- **F22 - C1049's delivery clause rests on a user-reported inbox arrival, relayed by the orchestrator (observation, not blocking).**
  - This Verifier cannot see the inbox or the Resend dashboard. The confirmation was written into `checks.md:535-537` by the orchestrator, the author, as the user's statement. It is not a screenshot, a Resend `delivered` event or a message header.
  - This Verifier accepts it as proof. The only person who can see that inbox is the user, who owns both the inbox and the acceptance decision. The statement is specific: it names the sender, the exact subject and the send time. Those details match facts this Verifier read for itself: the provider id, the `sent_at` 15:55:01 UTC, the `gmail.com` recipient domain, and the C1019 subject form. C1049's own proof line is "live, recorded in the Handoff" (`checks.md:289`), so it does not ask for more than a record.
  - If a stronger record is ever wanted, Resend's `email.delivered` webhook or the message's `Received` headers would show delivery without relying on a person. Bounce webhooks are already listed as "Not yet" in `CONTEXT.md`.
- **F23 - ROADMAP now understates (cosmetic).** `ROADMAP.md:117` says "accepted by Resend", which was right at `f5b1dc6`. Since the inbox confirmation, "delivered" would be accurate. Changing it is optional.

## Gate

- `npx vitest run`: first run 1816 passed and 2 failed (F15). The rerun had 1818 passed, exit 0.
- `npx vitest run n8n-workflows --reporter=verbose`: 111 passed, with 100 `C1052:` ✓.
- Live read: mcp `execute_sql` (`select` only) on `public.notifications`. AG-1048's link is `sent` with its provider id, and there is 1 sent `customer_link` in all.
- Carried: `npm run test:db` 18 passed and 0 failed, `npm run lint`, `npx tsc --noEmit` and `npm run build` exit 0. Round 4's `get_advisors` read (12 lints) and its `curl` checks are also carried.
- No fault was injected this round. The diff touches no code, so there is no assertion surface to mutate. Round 4's 4 killed faults are carried.
- `git status --porcelain` was empty before this file was written.
