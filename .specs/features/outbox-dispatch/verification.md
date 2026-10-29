# Outbox dispatch, n8n W1/W3/W5 and transactional email - verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: aae1901..1b6ca07
**Round**: 1 - full (all 51 checks, C1001-C1051), verified at `1b6ca07`
**Verifier**: independent sub-agent (author != verifier). The builders of batches 1 and 2 were other agents; this Verifier wrote no code and changed nothing but this file.

What blocks PASS:

1. C1049 (live dispatch, email, n8n) is unproven. It has not run and waits on the user's go-ahead.
2. C1050 (browser validation of the delivery line at 3 sizes) is unproven. It could not run: the live project has no `sent` agreement, and `PORTAL_LINK_KEY` is not set locally.
3. C1035 is only partly met. The approved check says the Crypto node uses "the credential secret". The export reads `$env.SA_AUTOMATION_HMAC_SECRET` instead (Landing row 12, added mid-build). No user ratification is recorded for that change to door 2 (F1).
4. One coverage member is unproven: n8n retrying a `503`/`409`, which is what makes AC 16's "send the email when the same key is claimed again" happen end to end (F2).

Everything else is proven at `HEAD` with located evidence, and all 5 injected faults were killed.

## Binding sources

Profile is `standard`, not `ui`, so step 1 is not owed. The binding sources were still opened for the narrow comparison:

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 5, M12, M13, n8n table (W1, W3, W5) | yes - `ROADMAP.md:117` | - (see F6: the ticked line still names an `EventPublisher` port, superseded by the user's database-dispatch answer recorded in the plan) | - |
| STATE.md AD-015, AD-016, AD-068 to AD-079 | yes - `.specs/STATE.md:73-88` | - (AD-074 still says "also an n8n credential", which contradicts AD-079 and Landing 12; recorded as F1, not as a check contradiction) | - |
| Design mock | none binding (profile is not `ui`) | - | - |

## Checks

Proof runs at `1b6ca07`, from `web/`:

- **SQL two-recipe run:** `npm run test:db outbox_dispatch customer_portal` gave `PASS outbox_dispatch`, `PASS customer_portal`, 2 passed, 0 failed, exit 0.
- **SQL full run:** `npm run test:db` gave 18 passed, 0 failed, exit 0.
- **vitest:** one invocation, `npx vitest run --reporter=verbose`, gave 1715 passed (84 files), exit 0. Every named `C10xx:` test appears individually as `✓` in that output: 113 lines, counted per check below.
- **Lint, types, build:**
  - `npm run lint` exit 0.
  - `npx tsc --noEmit` exit 0.
  - `npm run build` exit 0, with `ƒ /api/automation/notify`.

SQL assertions raise on failure (`tests.ok` / `tests.expect_error`, `supabase/tests/fixture.sql:34-63`), and the recipe passes only when its last row is `outbox_dispatch: pass`. So a green recipe means every labelled assertion below ran and held.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1001 | 1 due row -> 1 signed POST, 8 body keys, row `sending` with `request_id`; row due in 1 min waits | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:195` `tests.od_queue() = q0 + 1`; `:197` `q.method = 'POST' and q.url = 'https://n8n.test/webhook/events' and q.headers ->> 'Content-Type' = 'application/json' and q.headers ? 'X-SA-Timestamp' ...`; `:201-203` keys `= array['deliveryId','entityId','entityType','eventId','occurredAt','orgId','payload','type']`; `:207` `status = 'sending' and request_id = q.id`; `:209` later row `pending` and `request_id is null` | PASS |
| C1002 | signature over `<ts>.<queued bytes>`; fixed vector equal in SQL and Node | test:db PASS; vitest `n8n-workflows ... C1002:` ✓ | `supabase/tests/outbox_dispatch.sql:213-216` `X-SA-Signature = 'sha256=' \|\| encode(extensions.hmac(ts \|\| '.' \|\| convert_from(q.body,'UTF8'), 'test-secret','sha256'),'hex')`; `:222-224` `= '8cb2c335...47a9f'`; `web/n8n-workflows.test.ts:50` `expect(hex).toBe("8cb2c335...47a9f")` | PASS |
| C1003 | 200/204/299 -> `sent`, `sent_at`, attempts unchanged | test:db PASS | `supabase/tests/outbox_dispatch.sql:241-242` `status = 'sent' and sent_at is not null and attempts = 0` over `array[200, 204, 299]` | PASS |
| C1004 | 300/404/500/timeout/error/11-min silence -> pending, attempts+1, last_error; 9 min stays; backoff 1..1440 within 1 s | test:db PASS | `supabase/tests/outbox_dispatch.sql:263-264` `status = 'pending' and attempts = 1 and length(last_error) > 0` for 6 inputs; `:266` silent9 `= 'sending'`; `:274-276` `attempts = k and abs(extract(epoch from available_at - (now() + make_interval(mins => backoff[k])))) < 1` | PASS |
| C1005 | attempt 8 -> `failed`, never queued again | test:db PASS | `supabase/tests/outbox_dispatch.sql:288` `status = 'failed' and attempts = 8`; `:292` `tests.od_queue() = q0 and status = 'failed'` | PASS |
| C1006 | two runs queue 1; 51 rows -> 50 then 1; def has `for update skip locked` and the advisory lock | test:db PASS | `supabase/tests/outbox_dispatch.sql:307` `= q0 + 1`; `:315` `= q0 + 50`; `:317` `= q0 + 51`; `:318-319` `position('for update skip locked' in def) > 0 and position('pg_try_advisory_xact_lock(hashtext(''outbox-dispatch''))' in def) > 0` | PASS |
| C1007 | either secret missing -> nothing queued, no row changed | test:db PASS | `supabase/tests/outbox_dispatch.sql:337-338` `tests.od_queue() = q0 and before = (string_agg(id\|\|status\|\|attempts\|\|available_at))` over both secret names | PASS |
| C1008 | live: 0 pre-migration `pending`, all were set `failed` with the stated error | mcp `execute_sql` (read-only, this Verifier) | live `outbox` now holds 8 rows, all `status = failed`, `last_error = 'enqueued before dispatch existed'`, created 2026-10-27 to 2026-10-28, and 0 `pending`. The "before" count of 8 is the author's record at `.specs/features/outbox-dispatch/checks.md:413` and matches | PASS |
| C1009 | anon and uE get 42501 on the dispatcher and on outbox; no execute grant | test:db PASS | `supabase/tests/outbox_dispatch.sql:348-349,353-354` `expect_error(..., '42501')`; `:359-360` `not has_function_privilege('anon'/'authenticated', 'private.dispatch_outbox()', 'execute')` | PASS |
| C1010 | 5 malformed header inputs -> 401, 0 claim calls | vitest 5 ✓ | `web/app/api/automation/notify/route.test.ts:60-62` `expect(response.status).toBe(401); expect(claim).toHaveBeenCalledTimes(0); expect(getAutomationContainer).toHaveBeenCalledTimes(0)` (test.each over 5 at `:52-57`) | PASS |
| C1011 | wrong secret, body changed, ±301 s -> 42501, nothing written; 299 s ok; adapter 42501->unauthorized; route 401 | test:db PASS; vitest 3 ✓ | `supabase/tests/outbox_dispatch.sql:386-389` 4x `'42501'`; `:390` notifications count `= n0` and `n8n_execution_id is null`; `:392` `= 'ok'`; `web/infrastructure/supabase/automation.test.ts:100` `toEqual({ ok: false, code: "unauthorized" })` (row `:94`); `web/app/api/automation/notify/route.test.ts:67` `.toBe(401)` | PASS |
| C1012 | 6 malformed bodies -> 22023, nothing written, route 400; 5 key formats pass | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:415` `expect_error(..., '22023')` over the 6 bodies at `:405-411`; `:417` nothing written; `:432-433` `<> '22023'` for the 5 formats; `web/app/api/automation/notify/route.test.ts:79` `.toBe(400)` | PASS |
| C1013 | first execution id stored, a later one kept out | test:db PASS | `supabase/tests/outbox_dispatch.sql:441` `= 'exec-1'`; `:443` still `= 'exec-1'` after `exec-2` | PASS |
| C1014 | sent or skipped key -> `duplicate`, no row change; route 200 `duplicate`, 0 sends | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:458-459` `decision = 'duplicate' and messages length 0 and row::text = before`; `:465-466` same for skipped; `web/app/api/automation/notify/route.test.ts:86-88` `200`, `toEqual({ outcome: "duplicate" })`, `send` 0 calls | PASS |
| C1015 | 9 min `in_flight` / 409; 11 min or failed -> `send`, 1 row; new key send then in_flight | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:476-477` `'send'` then `'in_flight'`; `:479` 9 min `'in_flight'`; `:481-482` 11 min `'send'` and count `= 1`; `:484-485` failed `'send'`, count 1, `status = 'claimed'`; `web/app/api/automation/notify/route.test.ts:93-94` `.toBe(409)`, send 0 | PASS |
| C1016 | provider unavailable/rejected -> complete `failed` + error, route 503; retry sends | vitest 5 ✓ | `web/application/use-cases/notify.test.ts:91-92` `toEqual({ ok: false, code: "unavailable" })`, `complete` with `[{ id: "n1", outcome: "failed", error: code }]`; `:98-101` second notify `sent`; `web/app/api/automation/notify/route.test.ts:99-100` `.toBe(503)`, `complete.mock.calls[0][1]` failed | PASS |
| C1017 | unknown event / org-B event under org-A agreement -> P0002, nothing written, route 404; unexpected error 503 + logged | test:db PASS; vitest 4 ✓ | `supabase/tests/outbox_dispatch.sql:498,500` `'P0002'`; `:501-502` no row and `n8n_execution_id is null`; `web/app/api/automation/notify/route.test.ts:105` `.toBe(404)`; `:112-113` `.toBe(503)`, `log` called with `(expect.any(String), cause)` | PASS |
| C1018 | no `RESEND_API_KEY` -> 503, logs `email not configured`, no fetch | vitest ✓ | `web/composition/automation-container.test.ts:39-41` `.toBe(503)`; log includes `"email not configured"`; `fetchMock` 0 calls | PASS |
| C1019 | claim message facts; built email subject, button href, site, `$3,870.00 ... before tax`, phone, no `null`, no product name | test:db PASS; vitest 5 ✓ | `supabase/tests/outbox_dispatch.sql:511-517` 1 message, `to = '["pat@customer.ca"]'`, legal name and phone, `number = 'AG-fa'`, site, `annualCents = 387000`, `tokenSealed = od_sealed('fa')`; `web/domain/notifications/notifications.test.ts:24-32` subject `toBe("Service agreement AG-1052 from Northwind Mechanical Ltd.")`, `hrefOf(html,"Review the agreement")` = `${BASE}/review/${TOKEN}`, `toMatch(/\$3,870\.00[^<\n]*before tax/)`, `not.toContain("Service Agreement")`, `not.toContain("felipeviana")`; `:39-41` no `null`/`undefined`; `web/application/use-cases/notify.test.ts:108` `href="${BASE}/review/${TOKEN}"` after unseal | PASS |
| C1020 | day3/day7 reminder subject and facts; after reissue the reminder carries the new sealed token | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:542-544` day3 facts and `tokenSealed = od_sealed('f20')`; `:550-551` day7 `tokenSealed = od_sealed('f20-new')`; `web/domain/notifications/notifications.test.ts:47` `toBe("Reminder: service agreement AG-1052 from Northwind Mechanical Ltd.")` | PASS |
| C1021 | reminder skipped `decided` (4 statuses), `superseded`, `viewed` | test:db PASS | `supabase/tests/outbox_dispatch.sql:570-573` `decision = 'skip' and reason = c.reason and messages 0 and stored status = 'skipped' and skip_reason = c.reason` over the 6 rows at `:567-568` | PASS |
| C1022 | no contact / null email -> `no_recipient` | test:db PASS | `supabase/tests/outbox_dispatch.sql:587-588` `reason = 'no_recipient'` and stored `skip_reason = 'no_recipient'` for `f22none`, `f22null` | PASS |
| C1023 | revoked-only link / null sealed token -> `no_link_secret` | test:db PASS | `supabase/tests/outbox_dispatch.sql:603-604` `reason = 'no_link_secret'` for `f23revoked`, `f23unsealed` | PASS |
| C1024 | 5 reserved domains skipped, completed, 0 fetch; 3 controls sent | vitest 25 ✓ | `web/application/use-cases/notify.test.ts:119-121` `{ outcome: "skipped", reason: "reserved_domain" }`, `send` 0 calls, complete with `reserved_domain`; `:127-128` controls `sent`; `web/infrastructure/email/resend.test.ts:85-86` `{ ok: false, code: "reserved_domain" }`, `fetchMock` 0 calls; `:91-92` controls fetch 1 | PASS |
| C1025 | replyTo = uE's email; absent with null actor; email sent with it | test:db PASS; vitest ✓ | `supabase/tests/outbox_dispatch.sql:521` `m ->> 'replyTo' = (select email from auth.users where id = uE)`; `:532` `not m ? 'replyTo'`; `web/application/use-cases/notify.test.ts:134,137` `.toBe("estimator@northwind.ca")`, `not.toHaveProperty("replyTo")` | PASS |
| C1026 | seal/unseal round trip, random IV, format, 3 tamper inputs throw, use cases pass a sealed value hashing to the hash, DB stores it | vitest 9 ✓; test:db PASS | `web/infrastructure/portal-tokens.test.ts:30` `toBe(TOKEN)`; `:34` `not.toBe`; `:38` `toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/)`; `:44-47` 3x `toThrow()`; `web/app/(app)/sendAgreement.test.ts:135,146` `expect(sha256(token)).toBe(hash)`; `supabase/tests/outbox_dispatch.sql:522-523` live link `token_sealed = od_sealed('fa')` | PASS |
| C1027 | refusal / change request -> 1 message to uE with name, number, reason; subjects; body reason and link | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:626-629` `to = jsonb_build_array(uE email)`, `customer name = 'Customer A'`, number, `decision = c.d`, `reason = c.reason`; `web/domain/notifications/notifications.test.ts:69-72` `toBe("Harbourview Strata refused AG-1052")`, reason, `href="${BASE}/agreements/a1"`; `:78` `toBe("Harbourview Strata asked for changes to AG-1052")` | PASS |
| C1028 | null actor / departed actor -> exactly org A owner + admin | test:db PASS | `supabase/tests/outbox_dispatch.sql:653-654` `recipients = (select array_agg(email order by email) from auth.users where id in (uA, uD))` for both inputs | PASS |
| C1029 | W5: 1 message for org A to owner+admin listing exactly the 2 stale; stored key `w5:<date>:<orgA>`; subjects plural/singular; links | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:673` 1 message for org A; `:674` `to` = uA,uD emails; `:676-678` ids `= array[w5stale1, w5stale2]`, customer and `sentAt = now() - 8 days`; `:680-681` count `= 1` for `k`; `web/domain/notifications/notifications.test.ts:89-90,97` `toBe("2 agreements not viewed after 7 days")`, `hrefOf(...,"AG-1039")` = `${BASE}/agreements/a1`, `toBe("1 agreement not viewed after 7 days")` | PASS |
| C1030 | org B: no message, no row | test:db PASS | `supabase/tests/outbox_dispatch.sql:683-684` `not exists (... orgId = orgB)` and `not exists (notifications where key = 'w5:2026-10-29:' \|\| orgB)` | PASS |
| C1031 | same-day second claim: no message, no row; next day again | test:db PASS | `supabase/tests/outbox_dispatch.sql:695-696` no org A message and `count = n0`; `:698` org A message for `w5:2026-10-30` | PASS |
| C1032 | delivery line: emailed / 4 not-emailed phrases / pending; draft none; reader asks for current `agreement.sent` `customer_link` | vitest 12 ✓ | `web/components/agreements/agreements.test.ts:377` `toContain("Emailed to pat@customer.ca on Oct 29, 2026")`; `:387-392` 4 distinct non-empty phrases without `_`, `new Set(lines).size` `toBe(4)`; `:396-397` `"Email pending"`; `:402` draft shows none; `web/infrastructure/supabase/agreements.test.ts:410-420` events eq `["type","agreement.sent"]`, order `created_at desc`, notifications eq `["event_id","evt-1"],["kind","customer_link"]` | PASS |
| C1033 | exactly 4 exports; no credential value, `test-secret` or 64-hex; W1 waits 3 then 4 days; notify bodies carry kind, door-4 key, `$execution.id`; W5 daily 08:00 | vitest 7 ✓ | `web/n8n-workflows.test.ts:54` `readdirSync(DIR).sort()` `toEqual(FILES)`; `:66-70` `not.toContain("test-secret")`, `not.toMatch(/[0-9a-fA-F]{64}/)`, credential keys only id/name; `:81-84` 3 then 4 days, ordered; `:102-104` kind, key regex, `executionId: $execution.id`; `:122` `{ field: "days", daysInterval: 1, triggerAtHour: 8, triggerAtMinute: 0 }` | PASS |
| C1034 | webhook `onReceived`; Switch routes exactly 3 values; fallback starts no workflow | vitest ✓ | `web/n8n-workflows.test.ts:129` `toBe("onReceived")`; `:139` `toEqual(["agreement.sent","agreement.refused","agreement.changes_requested"])`; `:147-149` W1, W3, W3; `:153` fallback reaches no `executeWorkflow` | PASS |
| C1035 | Crypto HMAC over `<ts>.<raw body>` "with the credential secret"; IF on signature and 300 s; false branch no workflow | vitest ✓ | `web/n8n-workflows.test.ts:163` value `={{ ...x-sa-timestamp }}.{{ $json.rawBody }}`; `:165` `secret` `toMatch(/^=\{\{ \$env\.[A-Z_]+ \}\}$/)`, not a credential; `:170-179` equals and `lte 300`; `:186` false branch reaches no workflow or switch. The structure is proven. The "credential secret" clause is not met: the test asserts the opposite (F1) | PARTIAL - credential clause not met |
| C1036 | notifications constraints, RLS, no user writes | test:db PASS | `supabase/tests/outbox_dispatch.sql:707` `'23505'`; `:711` `'23514'` (sms); `:718` `'23514'` (queued); `:720,722` `'23514'`; `:724` `'23503'`; `:730,735` uA/uB read own org only; `:740` anon `= 0`; `:747-750` uE, uA insert/update/delete `'42501'` | PASS |
| C1037 | `token_sealed` format; old signatures store null; customer_portal passes; C907 lists `token_sealed` | test:db outbox_dispatch and customer_portal PASS | `supabase/tests/outbox_dispatch.sql:759-760` `'plain-token'` -> `'23514'`; `:761-762` format `= 'ok'`; `:764` send without sealed `is null`; `:771-772` reissue without sealed `is null`; `supabase/tests/customer_portal.sql:267-270` C907 columns `= array[..., 'token_hash', 'token_sealed']` | PASS |
| C1038 | proxy passes signed-out `POST /api/automation/notify`; redirects 3 look-alikes; `no-store` | vitest 5 ✓ | `web/proxy.automation.test.ts:25-26` `.toBe(200)`, location null; `:31-32` `.toBe(307)`, pathname `"/login"`; `web/app/api/automation/notify/route.test.ts:131` `Cache-Control` `toBe("no-store")` on 401, 200, 400, 503 | PASS |
| C1039 | Resend request shape; 200->id, 422 rejected, 500/429/network unavailable; `"` escaped | vitest 8 ✓ | `web/infrastructure/email/resend.test.ts:38-50` url, `POST`, `Bearer re_test_key`, `Idempotency-Key`, body `toEqual({ from: '"Northwind Mechanical Ltd." <agreements@felipeviana.com>', ... reply_to ... })`; `:55` no `reply_to`; `:60` `{ ok: true, providerMessageId: "re_1" }`; `:65` `rejected`; `:74` `unavailable` x3; `:79` `'"The \\"Best\\" Heating" <...>'` | PASS |
| C1040 | claim/complete definer, `search_path=""`, anon+authenticated execute, not public; anon calls work | test:db PASS | `supabase/tests/outbox_dispatch.sql:783-785` `prosecdef and proconfig @> array['search_path=""'] and has_function_privilege('anon'...) and ... and not has_function_privilege('public'...)`; `:799-800` anon claim `'send'`, complete -> `'sent'` | PASS |
| C1041 | advisors: exactly the 8 prior lints + 4 new = 12, no `extension_in_public` | mcp `get_advisors` security (this Verifier, 2026-10-29) | live result: `rls_enabled_no_policy` (outbox) 1, `anon_security_definer_function_executable` 5 (`automation_claim`, `automation_complete`, `portal_decide`, `portal_record_view`, `portal_view`), `authenticated_security_definer_function_executable` 5 (same), `auth_leaked_password_protection` 1 = 12; no `extension_in_public`. Cross-reference `.specs/features/outbox-dispatch/checks.md:414` | PASS |
| C1042 | 1 cron job, both extensions, `sending` accepted, `queued` refused | test:db PASS | `supabase/tests/outbox_dispatch.sql:365-367` job `schedule = '* * * * *' and command = 'select private.dispatch_outbox()'`, count 1; `:368` extensions `= 2`; `:371` insert `'sending'` succeeds; `:372-373` `'queued'` -> `'23514'` | PASS |
| C1043 | complete records sent with `re_1` + `sent_at` or failed + error; other key or unknown id P0002, nothing changed; wrong sig 42501; route 200 `sent` | test:db PASS; vitest 2 ✓ | `supabase/tests/outbox_dispatch.sql:816,818` `'P0002'`; `:820` `'42501'`; `:822` `before =` unchanged; `:826-828` `status = 'sent' and provider_message_id = 're_1' and sent_at is not null`; `:830-831` `failed` and `error = 'provider down'`; `web/app/api/automation/notify/route.test.ts:119-121` `200`, `{ outcome: "sent" }` | PASS |
| C1044 | use case send / skip / 2 messages | vitest 3 ✓ | `web/application/use-cases/notify.test.ts:45,52-53` 1 send, 1 complete with `sent`, `re_1`; `:58-60` skip -> `{ outcome: "skipped", reason: "viewed" }`, 0 sends, 0 completes; `:76-85` 2 sends with keys `w5:2026-10-29:orga/orgb`, 1 complete with 2 results | PASS |
| C1045 | plain recipe, 18 recipes, 20 SQL files, C830 pins moved | vitest ✓ | `web/scripts/test-db/runner.test.ts:108-111` `RECIPES` `toHaveLength(18)`, parts `["fixture.sql","outbox_dispatch.sql"]`, `REAL_FILES` `toHaveLength(20)`; `:100-105` C830 now 18/20 | PASS |
| C1046 | the 3 env names read only under `composition/`, never `NEXT_PUBLIC_`, `.env.example` names them with no value | vitest ✓ | `web/boundaries.test.ts:170-177` non-`composition/` readers `toEqual([])`, `exposed` `toEqual([])`, `.env.example` `toMatch(^NAME=[ \t]*$)`; source `web/.env.example:21,23,25` | PASS |
| C1047 | types regenerated; lint, tsc, build succeed | `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run build` exit 0 | `web/infrastructure/supabase/database.types.ts:589` `notifications: {`, `:802` `token_sealed: string \| null`, `:989` `automation_claim: {` | PASS |
| C1048 | `npm test` exit 0; `npm run test:db` 18 passed, 0 failed | `npx vitest run` 1715 passed (84 files), exit 0; `npm run test:db` 18 passed, 0 failed, exit 0 | runner pass condition `web/scripts/test-db/runner.mts:134` (`value !== expectedPass(recipe)` throws) | PASS |
| C1049 | live dispatch, email from `@felipeviana.com`, n8n W1 on Railway | not run. Not run by the builders either: it waits on the user's go-ahead for each action (Vault secrets, `RESEND_API_KEY`, Railway deploy). Live state read-only: 0 Vault secrets named `n8n_events_url`/`automation_hmac_secret`, 0 notifications, 0 queued requests | no evidence - `.specs/features/outbox-dispatch/checks.md:437-440` lists the steps only | UNPROVEN |
| C1050 | Playwright at 375/768/1440, delivery line readable, no scroll, console clean | not run. The live project has no `sent` agreement, so the line never renders. `PORTAL_LINK_KEY` is unset locally, so Send answers unavailable | no evidence - `.specs/features/outbox-dispatch/checks.md:436` | UNPROVEN |
| C1051 | CONTEXT entry and build log; STATE AD entries and AD-070 amended; ROADMAP tick; PRODUCT drops Resend vs Postmark | shell: `grep -c "outbox-dispatch\|automation_claim" ../CONTEXT.md` prints `6`; `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` prints 1 line | `CONTEXT.md:160` entry heading, `CONTEXT.md:223` dated build log; `ROADMAP.md:117` `- [x] Outbox dispatcher`; `PRODUCT.md:46` no Postmark; `.specs/STATE.md:76` AD-070 "amended by AD-077" (row malformed, F5) | PASS |

**Count:** 48 PASS, 1 PARTIAL (C1035), 2 UNPROVEN (C1049, C1050). 48 of 51 proven with located evidence.

## Coverage

Recomputed from the authority over each set: the migration and route source for statuses and decisions, the plan's Surface and Landing for doors, and Resend's documented statuses as the builder reported them. Members were taken from the code or plan, then matched to an asserting proof above.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| outbound webhook statuses (6) | `supabase/migrations/20261029165430_outbox_dispatch.sql:52-59` (2xx branch; else answered / 10-min) | 200, 204, 299 C1003 · 404, 500 (plus 300, error) C1004 · timeout C1004 | - |
| route statuses (6) | `web/app/api/automation/notify/route.ts:7,20,28,32` | 200 C1014, C1043 · 400 C1012 · 401 C1010, C1011 · 404 C1017 · 409 C1015 · 503 C1016, C1017, C1018 | - |
| `automation_claim` raises (4) | migration `:271,277-320,449-453` | returned C1019 · 42501 C1011 · 22023 C1012 · P0002 C1017 | - |
| `automation_complete` outcomes (4) | migration `:559-603` | recorded C1043 · 42501 C1043 · 22023 C1012 (`:421-425`) · P0002 C1043 | - (route-level mapping of these: F8) |
| send/reissue statuses, unchanged (5) | customer-portal recipe re-run | 200, 404, 409, 403, 422 via `customer_portal` PASS (C1037) | - |
| claim decisions (4) | migration `:344-356,437-441,461,527,532` | send C1015, C1019 · skip C1021 · duplicate C1014 · in_flight C1015 | - |
| notification kinds (4) | migration `:101` | customer_link C1019 · customer_reminder C1020 · staff_decision C1027 · staff_stale C1029 | - |
| key formats (5) | migration `:296,316-319` | link, day3, day7, w3, w5 C1012 (`:428-433`) plus C1013, C1020, C1027, C1029 | - |
| skip reasons (6) | migration `:105` | decided, superseded, viewed C1021 · no_recipient C1022 · no_link_secret C1023 · reserved_domain C1024 | - |
| statuses that are `decided` (4) | migration `:509` (`status <> 'sent'`) | accepted, refused, changes_requested, withdrawn C1021 | - |
| reserved domains (5) | `web/domain/notifications/index.ts:17-22` | example.com/.org/.net, .test, .invalid C1024 (3 layers) | - |
| notification statuses (4) | migration `:104` | claimed C1015, C1036 · sent C1043 · skipped C1021 · failed C1043, C1015 | - |
| outbox statuses (4) | migration `:11` | pending C1001, C1004 · sending C1001, C1042 · sent C1003 · failed C1005, C1008 | - |
| backoff schedule (7) | migration `:27` | 1..1440 C1004 table-driven `:270-277` | - |
| outbound body keys (8) | migration `:77-78` | all 8 C1001 `:201-203` | - |
| signature failures (4) | migration `:268-270` | wrong secret, body changed, 301 past, 301 future C1011 | - |
| route header rejections (5) | `route.ts:4-5,19` | 5 inputs C1010 | - |
| missing secrets (2) | migration `:34-38` | both C1007 | - |
| W3 recipients (3) | migration `:470-479` | sender C1027 · null actor, departed C1028 | - |
| W5 inclusion (5) | migration `:402-419` | 8-day unviewed, 6-day, viewed, accepted C1029 · other org C1030 | - |
| Resend responses (5) | `web/infrastructure/email/index.ts:39-52` | 200, 422, 429, 500, network C1039 (409 is mapped `unavailable` in code with no assertion. It is not a check member, noted F7) | - |
| delivery line states (6) | `web/components/agreements/agreement-view.tsx:43-47` | sent, 4 reasons, none C1032 | - |
| sealing failures (3) | `web/infrastructure/portal-tokens.ts:41-49` | wrong key, ciphertext, tag C1026 | - |
| n8n exports (4) | `automation/n8n/` listing | events C1033-C1035 · W1, W3, W5 C1033 | - |
| one-way doors (12, incl. Landing 9-12) | plan Landing | 1 C1042, C1006 · 2 C1002, C1035 (partial, F1) · 3 C1040, C1011 · 4 C1036 · 5 C1037, C1026 · 6 C1038 · 7 C1039 · 8 C1033 · 9 C1004 (`dispatched_at` drives 9/11-min) · 10 C1037 · 11 C1019, C1029, C1043 · 12 C1033, C1035 | - |
| proxy paths (4) | `web/infrastructure/supabase/session.ts:11` | 4 C1038 | - |
| startup config `PORTAL_LINK_KEY` (3 places) | `web/composition/index.ts:98,182` | send C1026 (use case + adapter) · reissue C1026 · automation assembly: the test stubs it (`automation-container.test.ts:13`) and the wiring test at `:44-48` asserts only that `notify` is a function. Real unseal in that assembly is unasserted, covered only by C1049 live | - |
| AC 16 end to end: provider failure -> 503 -> n8n retries -> same key re-claimed and sent (plan Flow step 5) | `automation/n8n/W1-agreement-sent.json` notify nodes `retryOnFail: true, maxTries: 5, waitBetweenTries: 5000, onError: continueRegularOutput` | DB re-claim of a failed key C1015; use-case retry with a mock C1016; the n8n retry that makes it happen has no check | n8n retry on 503/409 - no check asserts the export's retry settings, and 5 tries x 5 s cannot outlast a 10-min `in_flight` (F2) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `supabase/migrations/20261029165430_outbox_dispatch.sql` (dispatcher, claim, complete), `web/app/api/automation/notify/route.ts`, `web/infrastructure/email/index.ts` | boundary: SQL recipe over the queue table and RPCs (C1001-C1043), route via `POST` (C1010-C1017, C1043), adapter via stubbed `fetch` (C1039). Own layer: one labelled case per decision-table row (backoff, response classes, skip reasons, W3/W5 rows) | yes |
| Decides, not reached across a boundary | `web/domain/notifications/index.ts`, `web/infrastructure/portal-tokens.ts`, `web/application/use-cases/notify.ts` | own layer: C1019, C1020, C1024, C1027, C1029, C1032 words; C1026 sealing; C1044, C1016, C1024, C1025 use case | yes |
| Instrumentation | `web/composition/index.ts`, `web/infrastructure/supabase/automation.ts`, `automation/n8n/*.json` | none of its own; consumer proofs; exports asserted structurally C1033-C1035 | yes (with F1 on C1035's clause and F2 on the unasserted retry settings) |

## Faults injected

Isolation: `git worktree add <scratchpad>/wt HEAD`, with `web/node_modules` junctioned to the real one. SQL faults were applied as `create or replace function` prepended to the worktree's `supabase/tests/outbox_dispatch.sql`. That file runs after `fixture.sql`'s `begin;` and ends in `rollback;` on one connection, and `web/scripts/test-db/runner.mts:120-122` refuses any recipe containing `commit`. So the mutated function existed only inside the rolled-back transaction, and nothing was applied to the live project.

Each fault was run on its own. Two first-draft SQL mutants (backoff index +1, `skipped` treated as re-claimable) were also killed, but by constraint errors rather than a labelled assertion. They were replaced by the cleaner mutants below.

Baseline `git status --porcelain` of the real tree was empty before and empty after `git worktree remove`.

| Mutation | Location | Killed |
| --- | --- | --- |
| backoff after attempt 7: `1440` -> `1441` minutes | `supabase/migrations/20261029165430_outbox_dispatch.sql:27` | yes - `FAIL outbox_dispatch: C1004 backoff 7: attempt 7 is not due in 1440 minutes` |
| in-flight window `10 minutes` -> `8 minutes` | `supabase/migrations/20261029165430_outbox_dispatch.sql:352` | yes - `FAIL outbox_dispatch: C1015 9 minutes: a 9-minute claim was taken over` |
| route status for `in_flight` `409` -> `503` | `web/app/api/automation/notify/route.ts:7` | yes - `× C1015: a claim in flight is 409 and nothing is sent` |
| reserved-domain filter removed from the use case (`const to = message.to`) | `web/application/use-cases/notify.ts:56` | yes - 5 x `× C1024: ... never handed to the sender` |
| Resend `429` no longer `unavailable` (falls to `rejected`) | `web/infrastructure/email/index.ts:51` | yes - `× C1039: a 429 maps to unavailable` |

5 injected, 5 killed. The builders' seven batch-1 mutants (`checks.md:415`) were not re-run.

## Findings

- **F1 - C1035, door 2, Landing 12 (blocks PASS).**
  - Door 2 says the secret is "also held as an n8n credential", and C1035 as approved says "with the credential secret". Landing row 12 was appended by the batch-2 builder mid-build. It moves the secret to `$env.SA_AUTOMATION_HMAC_SECRET` (`automation/n8n/events.json` "Sign raw body" node) and requires `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. No user ratification of that change is recorded.
  - `checks.md` C1035 and STATE AD-074 (`.specs/STATE.md:80`, "also an n8n credential") were not updated, so they now contradict AD-079.
  - Enabling env access exposes the whole n8n process environment, including its Postgres credentials, to every workflow expression. That is a wider exposure than a credential.
  - The builder's reason (the Crypto node's `secret` cannot take a credential without a Code node) is plausible, but it is a one-way door changed without approval.
- **F2 - AC 16, coverage (blocks PASS).** AC 16's end-to-end retry depends on n8n.
  - The notify nodes retry 5 times, 5 s apart, reusing one signed timestamp, then `continueRegularOutput`.
  - A Resend outage longer than about 25 s, or any `409 in_flight` (which lasts 10 min), means that key is never claimed again. For W1 the link email is lost and the flow continues to the day-3 wait.
  - No check asserts the export's retry settings, and C1016 proves the retry only with a mocked second call.
- **F3 - door 6, `runtime` nodejs:** the route has no `export const runtime`. The builder's reason holds: `next.config.ts` enables Cache Components, which refuses that option, and Node.js is the default. No check asserts it. Accepted as a deviation in wording only.
- **F4 - Landing rows 9, 10, 11 (mid-build):**
  - Row 9 (`dispatched_at`) is exercised by C1004's 9 and 11 minute cases.
  - Row 10's overloads without a default are consistent with C1037 and keep customer-portal's C943 green (`customer_portal` PASS).
  - Row 11's message shape is what C1019, C1029 and C1043 assert.
  - The edit to `supabase/tests/rls_isolation.sql:16` (C35 now lists `notifications`, 19 tables) follows the customer-portal precedent and is a necessary consequence of door 4.
  - The runner pin moves are what C1045 requires.
  - None of these four is a finding against the checks. They were still added by builders without recorded user approval.
- **F5 - C1051, STATE AD-070 row:** `.specs/STATE.md:76` lost its status cell. The row has 4 cells where the table has 5, so `2026-10-28` sits in the Status column and the Date column is empty. The amendment text is present, so C1051's literal claim holds, but the table is malformed.
- **F6 - ROADMAP:** `ROADMAP.md:117` is ticked while its text still names an `EventPublisher` port. No such port exists: dispatch is in the database, per the user's answer. It was also ticked before this verification and before the plan's Independent test (C1049) ran.
- **F7 - precision gaps in the checks:**
  - C1019 "`$3,870.00` followed by `before tax`": the email reads `$3,870.00 per year before tax`, and the test regex `[^<\n]*` accepts anything in between.
  - The Resend adapter maps `409` to `unavailable` (AD-078) with no assertion.
  - The C1032 reader table omits `no_link_secret`. The view test covers it, and the reader branch is generic.
- **F8 - Surface vs code:** the Surface row for `automation_complete` lists `401`/`400`/`404`. The adapter throws on any complete error (`web/infrastructure/supabase/automation.ts:103`), so the route answers `503` for all of them. That is defensible, because n8n then retries and the claim re-checks. It is not what the Surface table reads like, and no check pins it.
- **F9 - observation:** the signature compare in `private.automation_request` (`migration:270`) uses `is distinct from`, which is not constant-time. The practical risk over HTTPS and PostgREST is negligible. It is not a check.
- **F10 - live-only uncertainty:** whether n8n's Webhook v2 `rawBody` option yields the binary `data` that "Raw body" (`extractFromFile`) reads, so that the HMAC is computed over the exact bytes, can only be proven by C1049's n8n step.

## Gate

- `npx vitest run` - 1715 passed, 0 failed (84 files)
- `npm run test:db` - 18 passed, 0 failed
- `npm run test:db outbox_dispatch customer_portal` - 2 passed, 0 failed
- `npm run lint`, `npx tsc --noEmit`, `npm run build` - exit 0
