# Outbox dispatch, n8n W1/W3/W5 and transactional email - verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: aae1901..aec4fb0 (this round's scope: the fix diff `e4e1970..aec4fb0`)
**Round**: 3 - scoped, verified at `aec4fb0`. Scope: the fix diff `e4e1970..aec4fb0` (C1052 widened to retry on `409`, `500`, `502`, `503`, `504` and network errors) and every round 2 verdict that was not PASS (C1049, C1050, C1051). Everything else is carried from `5c4237b` (round 2, kept at `a03cab1`). This is the last allowed round, so the remaining gaps go back to the user.
**Verifier**: independent sub-agent (author != verifier). The orchestrator session wrote this fix round. This Verifier wrote no code and changed only this file.

What blocks PASS:

1. **C1049 is unproven.** It is the live check (dispatch, email from `@felipeviana.com`, n8n W1 on Railway). It waits on the user's go-ahead for each action, and this Verifier did not run it.
2. **C1050 is unproven.** It is the browser validation of the delivery line at 375, 768 and 1440. It waits on the user's go-ahead, and this Verifier did not run it.
3. **C1051 fails at HEAD.** `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` prints nothing (exit 1), and `ROADMAP.md:117` is still `- [ ] Outbox dispatcher ...`. This is the user's choice of 2026-10-29: tick ROADMAP Phase 3 item 5 only once C1049 and C1050 pass (`.specs/features/outbox-dispatch/checks.md:468`). So C1051 stays failing until then.

The fix itself holds. C1052, as reworded in `e4e1970`, passes at `aec4fb0`: 85 named `C1052:` tests, 0 failed. Each of 500, 502 and 504 ran 10 times (5 calls x 2 tests). Round 2's F13 is resolved.

Of the 5 faults injected on the retry statuses, 4 were killed. The survivor (`statusCode >= 409`) is a wider predicate that C1052's wording does not forbid, see F17. 49 of 52 checks are proven.

## Binding sources

Carried from `5c4237b`, except the STATE row. The fix touched `.specs/STATE.md` (AD-079) and `CONTEXT.md`, so that row is refreshed at `aec4fb0`. `ROADMAP.md`, `PRODUCT.md` and `plan.md` are unchanged since `5c4237b` (`git diff --stat 5c4237b..HEAD` is empty for them).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 5, M12, M13, n8n table (W1, W3, W5) | carried from `5c4237b`, re-read at `aec4fb0`: `ROADMAP.md:117` reads `- [ ] Outbox dispatcher ... (code done; awaiting verification and the live run)` | - (C1051 disagrees with it, by the user's choice, see C1051) | - |
| STATE.md AD-015, AD-016, AD-068 to AD-079 | refreshed at `aec4fb0`: `.specs/STATE.md:85` AD-079 now reads "a `409`, `500`, `502`, `503`, `504` or network error goes through an IF (`$runIndex < 6`)" | - | - |
| Plan Landing rows 1-13 (row 13 supersedes row 12) | carried from `5c4237b` (`.specs/features/outbox-dispatch/plan.md:86-99`, unchanged) | - (F12 carried) | - |

## Checks

### Proof runs at `aec4fb0` (all from `web/`)

- **`npx vitest run n8n-workflows --reporter=verbose`**: 96 passed (1 file), exit 0.
  - 85 `✓ ... C1052:` lines and 0 `×`.
  - Per retry answer, 10 `✓` each for `409`, `500`, `502`, `503`, `504` and `network`. For example: `✓ ... C1052: notify call W1-agreement-sent.json #0 (link) > C1052: a 502 retries through a 10-minute Wait with the same key, freshly signed, until a 200`.
  - C1033 7 ✓, C1034 1 ✓, C1035 2 ✓, C1002 1 ✓.
- **`npm test`** (`vitest run`):
  - First run: 1801 passed and 2 failed (84 files), exit 1. Both failures are the pre-existing lint-driven timeouts of round 2's F15: C32 (`domain/purity.test.ts`, 5400 ms) and C873 (`boundaries.test.ts`, 5414 ms), each `Test timed out in 5000ms`. Nothing else ran at the same time.
  - Immediate rerun: 1803 passed (84 files), exit 0.
  - A third run, `npx vitest run --reporter=verbose`: 1803 passed, exit 0, 0 `×`. The named `✓` lines per check match round 2: C1002 1, C1010 5, C1011 3, C1012 2, C1014 4, C1015 4, C1016 5, C1017 4, C1018 1, C1019 5, C1020 2, C1024 25, C1025 1, C1026 9, C1027 2, C1029 2, C1032 13, C1033 7, C1034 1, C1035 2, C1038 5, C1039 9, C1043 2, C1044 3, C1045 1, C1046 1. Only C1052 changed, from 55 to 85 (1773 + 30 = 1803).
- **`npm run lint`**: exit 0. **`npx tsc --noEmit`**: exit 0.
- `npm run test:db` and `npm run build` were not re-run, so those results are carried. Since `5c4237b` the fix touched only `automation/n8n/W1-agreement-sent.json`, `W3-agreement-decided.json`, `W5-stale-daily.json` and `web/n8n-workflows.test.ts` (`git diff --stat 5c4237b..HEAD -- web supabase automation`). No SQL or app code changed.

### Re-verified at `aec4fb0` (in scope)

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1052 (reworded in `e4e1970`) | 5 notify calls read the status without failing; `409`/`500`/`502`/`503`/`504`/network loop through a 10-minute Wait back to the same Set (same key, fresh timestamp and signature); stop after 6 retries; W1 goes on, W3 and W5 end; 200/400/401/404 never loop | vitest 85 ✓ (17 per call x 5) | exports: `automation/n8n/W1-agreement-sent.json:331,390,449`, `automation/n8n/W3-agreement-decided.json:119`, `automation/n8n/W5-stale-daily.json:128`, each `[409, 500, 502, 503, 504].includes($json.statusCode) \|\| $json.statusCode === undefined`; tests: `web/n8n-workflows.test.ts:307-312` 200/400/401/404 `calls` `toBe(1)`, `tenMinuteWaits` `toBe(0)`; `:315-323` over `[[409], [500], [502], [503], [504], ["network"]]`: `calls` `toBe(3)`, `tenMinuteWaits` `toBe(2)`, `new Set(run.keys).size` `toBe(1)`, `signedBeforeEachCall` `toBe(true)`; `:326-331` same list: `calls` `toBe(7)`, `tenMinuteWaits` `toBe(6)`, exit `toBe(expectedExit)`; `:338-339` fresh timestamp and signer value. The walker evaluates each IF expression itself (`:56-74`, `evaluate(leftValue, scope)`) | PASS |
| C1049 | live dispatch, email from `@felipeviana.com`, n8n W1 on Railway | not run. It waits on the user's go-ahead for each action, and this Verifier was told not to run it | no evidence. The steps are at `.specs/features/outbox-dispatch/checks.md:442-445` | UNPROVEN |
| C1050 | Playwright at 375/768/1440; line readable; no scroll; console clean | not run. It waits on the user's go-ahead | no evidence. The builder's note is at `.specs/features/outbox-dispatch/checks.md:441` | UNPROVEN |
| C1051 | CONTEXT entry and build log; STATE AD entries and AD-070 amended; ROADMAP ticks Phase 3 item 5; PRODUCT drops Postmark | shell at `aec4fb0`: `grep -c "outbox-dispatch\|automation_claim" ../CONTEXT.md` prints `6` (passes). `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` prints nothing, exit 1 (fails) | `ROADMAP.md:117` `- [ ] Outbox dispatcher ...`; `.specs/STATE.md:76` AD-070 amended; `grep -c Postmark ../PRODUCT.md` prints 0. The user's choice to leave the item unticked is at `.specs/features/outbox-dispatch/checks.md:468` | FAIL - ROADMAP half, held until C1049 and C1050 pass |

### Carried from `5c4237b` (round 2, at `a03cab1`)

These verdicts and their evidence are carried, not re-derived. Their vitest proofs re-ran green at `aec4fb0` in the full suite above.

The citations in `web/n8n-workflows.test.ts` (C1002, C1033-C1035) still hold, because the fix edited lines 315 and 326 in place and moved no line. Every other cited file is byte-identical to `5c4237b`.

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
| C1048 | `npm test` exit 0; test:db 18/0 | vitest 1773 passed, exit 0; test:db 18 passed, 0 failed | runner pass condition `web/scripts/test-db/runner.mts:134`. See F15 for the concurrent-run timeouts | PASS |

**Count:** 49 PASS (48 carried, C1052 re-verified), 1 FAIL (C1051), 2 UNPROVEN (C1049, C1050). 49 of 52 checks are proven.

## Coverage

The rows whose authority the fix touched were recomputed at `aec4fb0`. Those authorities are the 5 retry IF nodes in the exports and C1052's text. They were read with `grep -n "includes(\$json.statusCode)" automation/n8n/*.json`, which gives 5 hits, all with the same predicate.

The other rows are carried from `5c4237b`. Their authorities (migration, `route.ts`, domain, adapters) are unchanged.

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
| statuses that never loop (4) | recomputed from C1052's text (`e4e1970`) | 200, 400, 401, 404 C1052 (`web/n8n-workflows.test.ts:307`) | - (no check pins, either way, the statuses C1052 does not name, such as 408, 422, 429 or 501. See F17) |
| exit after the last retry (5) | IF false outputs: link -> `Wait 3 days`, day 3 -> `Wait 4 days`, day 7 / W3 / W5 -> none | all 5 C1052 (`expectedExit`) | - |
| one-way doors (13 Landing rows) | plan Landing | 1 C1042, C1006 · 2 C1002, C1035 · 3 C1040, C1011 · 4 C1036 · 5 C1037, C1026 · 6 C1038 · 7 C1039 · 8 C1033, C1052 · 9 C1004 · 10 C1037 · 11 C1019, C1029, C1043 · 12 superseded · 13 C1035 | - |
| proxy paths (4) | `web/infrastructure/supabase/session.ts` | 4 C1038 | - |
| startup config `PORTAL_LINK_KEY` (3 places) | `web/composition/index.ts` | send C1026 · reissue C1026 · automation assembly: stubbed in `automation-container.test.ts`, real unseal is C1049 live | - |
| AC 16 end to end: provider failure -> 503 -> n8n retries -> same key re-claimed and sent | DB C1015, use case C1016, export loop C1052 | all three layers are proven. The real n8n runtime is C1049 (F14) | - |

## Test policy rows

The Instrumentation row was re-judged, because it classifies `automation/n8n/*.json`, which the fix touched. The other two rows are carried from `5c4237b`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration (dispatcher, claim, complete), `web/app/api/automation/notify/route.ts`, `web/infrastructure/email/index.ts` | boundary: SQL recipe over the queue table and RPCs, route via `POST`, adapter via stubbed `fetch`. Own layer: one labelled case per decision-table row | yes (carried) |
| Decides, not reached across a boundary | `web/domain/notifications/index.ts`, `web/infrastructure/portal-tokens.ts`, `web/application/use-cases/notify.ts` | own layer: C1019, C1020, C1024, C1027, C1029, C1032, C1026, C1044, C1016, C1025 | yes (carried) |
| Instrumentation | `web/composition/index.ts`, `web/infrastructure/supabase/automation.ts`, `automation/n8n/*.json` | none of its own. The exports are asserted structurally by C1033-C1035 and behaviourally by C1052's walker, which now covers all 6 retry triggers | yes (re-judged at `aec4fb0`) |

## Faults injected

Isolation: `git worktree add --detach <scratchpad>/wt3 HEAD` at `aec4fb0`, with `web/node_modules` junctioned to the real tree's copy. `git stash` was not used. For each fault:

- apply it alone with `sed`;
- run `npx vitest run n8n-workflows --reporter=verbose`;
- revert with `git checkout -- .`. Porcelain was empty after each revert.

The real tree's `git status --porcelain` was empty before the worktree was made. It was still empty after the junction and the worktree were removed (`git worktree remove --force`), before this report was written. The real `web/node_modules` was intact afterwards, with 383 entries.

| Mutation | Location | Killed |
| --- | --- | --- |
| C1052: drop `502` from W1 `Retry link?` (`[409, 500, 503, 504]`) | `automation/n8n/W1-agreement-sent.json:331` | yes - 2 failed: `× C1052: notify call W1-agreement-sent.json #0 (link) > C1052: a 502 retries ...` and `× ... a 502 on every attempt stops after 6 retries ...` |
| C1052: drop `504` from W5 `Retry stale?` (`[409, 500, 502, 503]`) | `automation/n8n/W5-stale-daily.json:128` | yes - 2 failed: `× ... W5-stale-daily.json #0 (W5) > C1052: a 504 retries ...` and `× ... a 504 on every attempt ...` |
| C1052: `500` mistyped as `501` in W3 (`[409, 501, 502, 503, 504]`) | `automation/n8n/W3-agreement-decided.json:119` | yes - 2 failed: `× ... W3-agreement-decided.json #0 (W3) > C1052: a 500 retries ...` and `× ... a 500 on every attempt ...` |
| C1052: `404` added to the W1 day 7 retry list (`[404, 409, 500, 502, 503, 504]`) | `automation/n8n/W1-agreement-sent.json:449` | yes - 1 failed: `× ... W1-agreement-sent.json #2 (day7) > C1052: a 404 is read without failing the run and never loops` |
| C1052: W1 day 3 predicate widened to `$json.statusCode >= 409 \|\| $json.statusCode === undefined` | `automation/n8n/W1-agreement-sent.json:390` | no - survived, 96 passed. Every status C1052 names still behaves as the check says, but 410-499 and 501+ would now loop too. See F17 |

5 injected, 4 killed, 1 survived. The survivor is equivalent under C1052's wording, so it is not a failed check. It is a precision gap for the user to rule on (F17).

Rounds 1 and 2 injected 10 faults and killed all 10. With this round, each new retry status (`500`, `502`, `504`) has now been made to fail at least once.

## Earlier findings - status at `aec4fb0`

| Finding | Status | Evidence |
| --- | --- | --- |
| F1, F2, F5 | resolved in round 2, carried | round 2 report at `a03cab1` |
| F3, F4, F8, F9 | observations, unchanged, carried | no file they cite was touched |
| F6 / F11 - C1051 vs the unticked ROADMAP item | open, by the user's choice: the item is ticked only after C1049 and C1050 pass | `ROADMAP.md:117`; `.specs/features/outbox-dispatch/checks.md:468` |
| F7 - precision gaps | carried (the C1019 `[^<\n]*` is unchanged) | no file it cites was touched |
| F10 - byte fidelity of the Webhook `rawBody` can only be shown live | carried, waits on C1049 | `events.json` unchanged |
| F12 - stale wording in door 2 and open question 1 | carried, not blocking | `plan.md` unchanged since `5c4237b` |
| F13 - 500, 502 and 504 ended the call without a retry | resolved | C1052 reworded in `e4e1970` (the user's decision); exports and tests changed in `aec4fb0`; 30 new `✓`; 3 faults killed |
| F14 - C1052 is proven by a simulator | carried. The live residue under C1049 is an error-output item with no `statusCode`, `$runIndex` across a persisted Wait, and now also whether the platform's gateway really answers 500, 502 or 504 (the user's stated reason) | `web/n8n-workflows.test.ts:79-131` |
| F15 - lint-driven test timeouts under load | recurred. The first `npm test` this round had C32 and C873 time out at 5000 ms with nothing else running, and the reruns were green. The fix round's own record shows the same (`.specs/features/outbox-dispatch/checks.md:475`) | see Proof runs |
| F16 - missing full stop in `CONTEXT.md` | resolved | `CONTEXT.md` now reads "survive a redeploy). The exports carry" |

## Findings (new in round 3)

- **F17 - C1052 does not pin the statuses it does not name (precision gap, not blocking).**
  - The mutant `$json.statusCode >= 409 || $json.statusCode === undefined` survives all 96 tests. Under it, 410-499 (for example 422 or 429) and 501+ would also loop up to 6 times.
  - C1052 names only `200`, `400`, `401` and `404` as never looping, so the mutant is consistent with the check as written. It is not a contradiction.
  - The route itself answers only 200, 400, 401, 404, 409 and 503 (Coverage, route statuses), so in practice only what a gateway or proxy might answer is left open.
  - To pin the exact list, C1052 would have to name one more status that never loops, for example `429` or `501`.
- **F18 - doc consistency (observation).**
  - The fix updated `CONTEXT.md:174` and `.specs/STATE.md:85` (AD-079) to the 6 retry triggers.
  - `plan.md:40` ("Failure answers `503`, so n8n retries") describes the route, is still true, and needs no change.
  - No retry wording that lists only `409` and `503` remains in `CONTEXT.md`, `STATE.md`, `plan.md`, `ROADMAP.md` or the exports.

## Gate

- `npx vitest run n8n-workflows --reporter=verbose` - 96 passed, 85 `C1052:` ✓, 0 failed
- `npm test` - first run: 1801 passed, 2 failed (the F15 timeouts, C32 and C873). Rerun: 1803 passed, exit 0. Verbose run: 1803 passed, exit 0
- `npm run lint`, `npx tsc --noEmit` - exit 0
- carried from `5c4237b`: `npm run test:db` 18 passed, 0 failed; `npm run build` exit 0; mcp `get_advisors` 12 lints; mcp `execute_sql` live reads (C1008, C1041, C1042). This round touched no live project or external service.
