# Outbox dispatch, n8n W1/W3/W5 and transactional email - verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: aae1901..5c4237b
**Round**: 2 - full (all 52 checks, C1001-C1052), verified at `5c4237b`. Round 1 (at `1b6ca07`) is in git history at `46490af`.
**Verifier**: independent sub-agent (author != verifier). Other agents wrote batches 1 and 2 and the fix round. This Verifier wrote no code and changed only this file.

What blocks PASS:

1. **C1049 is unproven.** It covers the live dispatch, the email and n8n. It has not run, and it waits on the user's go-ahead for each action. Read-only live state: 0 Vault secrets named `n8n_events_url` or `automation_hmac_secret`, 0 `notifications` rows.
2. **C1050 is unproven.** It covers browser validation of the delivery line at 3 sizes. It has not run and waits on the user's go-ahead. The live project has 0 `sent` agreements, so the line cannot render there without changing data.
3. **C1051 fails at HEAD (F11, new).** Its shell proof `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` now prints 0 lines (grep exit 1). The fix round unticked `ROADMAP.md:117` to resolve round 1's F6. C1051 was not reworded, and it still says "`ROADMAP.md` ticks Phase 3 item 5".

Every other check (49 of 52) is proven at `5c4237b` with located evidence. All 5 injected faults were killed. Round 1's blockers F1 (C1035) and F2 (AC 16 retry) are resolved.

## Binding sources

The profile is `standard`, so step 1 is not owed. The binding sources were still opened for the narrow comparison.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md Phase 3 item 5, M12, M13, n8n table (W1, W3, W5) | yes - `ROADMAP.md:117` now reads `- [ ] Outbox dispatcher (the database dispatches the outbox to n8n, HMAC-signed) ... (code done; awaiting verification and the live run)` | - (the source is now correct; C1051 is the one that disagrees with it, see F11) | - |
| STATE.md AD-015, AD-016, AD-068 to AD-079 | yes - `.specs/STATE.md:73-88` | - (AD-074 and AD-079 now name the placeholders and Landing 13. The AD-070 row has 5 cells) | - |
| Plan Landing rows 1-13 (row 13 supersedes row 12) | yes - `.specs/features/outbox-dispatch/plan.md:86-99` | - (door 2 at `plan.md:87` and open question 1 at `plan.md:205` still say "n8n credential". Row 13 supersedes them, but the rows were not edited, see F12) | - |

## Checks

Proof runs at `5c4237b`, all from `web/`:

- **`npm run test:db`** (all recipes): 18 passed, 0 failed, exit 0. The output includes `PASS outbox_dispatch` and `PASS customer_portal`. The SQL test file is unchanged since `1b6ca07` (`git diff --stat 1b6ca07..HEAD -- supabase` is empty), and every label cited below was re-located with `grep -no "'C10..."` at HEAD.
- **vitest:** `npx vitest run --reporter=verbose`, one invocation over the whole suite. 1773 passed (84 files), exit 0. Every named `C10xx:` test appears individually as `✓`: 171 lines, 0 `×`. Counts per check: C1002 1, C1010 5, C1011 3, C1012 2, C1014 4, C1015 4, C1016 5, C1017 4, C1018 1, C1019 5, C1020 2, C1024 25, C1025 1, C1026 9, C1027 2, C1029 2, C1032 13, C1033 7, C1034 1, C1035 2, C1038 5, C1039 9, C1043 2, C1044 3, C1045 1, C1046 1, C1052 55.
  - A first run made concurrently with `test:db` had 2 timeouts. Both were pre-existing tests (C32 `domain/purity.test.ts:28`, C873 `boundaries.test.ts:56`, each over its 5000 ms limit). The clean rerun above passed them, see F15.
- **`npm run lint`**: exit 0.
- **`npx tsc --noEmit`**: exit 0.
- **`npm run build`**: exit 0, listing `ƒ /api/automation/notify`.

SQL assertions raise on failure (`tests.ok` / `tests.expect_error`). The recipe passes only when its last row is `outbox_dispatch: pass` (`supabase/tests/outbox_dispatch.sql` ends with `rollback; select 'outbox_dispatch: pass'`). So a green recipe means every labelled assertion ran and held.

Citations in files the fix did not touch are re-confirmed at HEAD: those files are byte-identical to `1b6ca07`. Citations in `n8n-workflows.test.ts`, `resend.test.ts` and `agreements.test.ts` are refreshed.

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
| C1049 | live dispatch, email from `@felipeviana.com`, n8n W1 on Railway | not run. It waits on the user's go-ahead for each action, and this Verifier was told not to run it | no evidence. Live read-only: 0 Vault secrets with either name, 0 notifications. Steps listed at `.specs/features/outbox-dispatch/checks.md:442-445` | UNPROVEN |
| C1050 | Playwright at 375/768/1440; line readable; no scroll; console clean | not run. It waits on the user's go-ahead, and the live project has 0 `sent` agreements | no evidence. The builder's note is at `.specs/features/outbox-dispatch/checks.md:441` | UNPROVEN |
| C1051 | CONTEXT entry and build log; STATE AD entries and AD-070 amended; ROADMAP ticks Phase 3 item 5; PRODUCT drops Postmark | shell: `grep -c "outbox-dispatch\|automation_claim" ../CONTEXT.md` prints `6` (passes). `grep -n "\[x\] Outbox dispatcher" ../ROADMAP.md` prints nothing, exit 1 (fails) | `ROADMAP.md:117` `- [ ] Outbox dispatcher ...`, which is not ticked; `.specs/STATE.md:76` AD-070 `active, amended by AD-077` (5 cells); `PRODUCT.md` has no `Postmark` | FAIL - ROADMAP half (F11) |
| C1052 (new) | 5 notify calls read the status without failing; 409/503/network loop through a 10-minute Wait to the same Set, so the same key is sent with a fresh timestamp and signature; stop after 6 retries; W1 goes on, W3 and W5 end; 200/400/401/404 never loop | vitest 55 ✓ (11 per call x 5) | `web/n8n-workflows.test.ts:294-300` the 5 calls and their next steps (`Wait 3 days`, `Wait 4 days`, end x3); `:309-312` per 200/400/401/404: `failed` false, `calls` `toBe(1)`, `tenMinuteWaits` `toBe(0)`, exit `toBe(expectedExit)`; `:317-323` per 409/503/network: `calls` `toBe(3)`, `tenMinuteWaits` `toBe(2)`, `new Set(run.keys).size` `toBe(1)`, `signedBeforeEachCall` `toBe(true)`; `:327-331` always failing: `calls` `toBe(7)`, `tenMinuteWaits` `toBe(6)`, exit `toBe(expectedExit)`; `:338-339` timestamp from `Date.now()`/`$now`, signer value `={{ $json.timestamp }}.{{ $json.body }}`. The walker's n8n semantics are at `:85-131` (Never Error, error output, IF with `$runIndex`) | PASS |

**Count:** 49 PASS, 1 FAIL (C1051), 2 UNPROVEN (C1049, C1050). 49 of 52 are proven with located evidence.

## Coverage

Recomputed at `5c4237b`. The SQL sets come from the migration (unchanged since round 1). The route sets come from `route.ts`. The n8n sets come from the exports themselves: node graphs dumped with `node -e` over `automation/n8n/*.json`.

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
| notify calls that retry (5) | exports: 5 `httpRequest` nodes to `/api/automation/notify` (W1 `Notify link`, `Notify day 3`, `Notify day 7`; W3 `Notify decision`; W5 `Notify stale`), each `onError: continueErrorOutput` with `fullResponse` and `neverError` | all 5 C1052 (`describe.each(CALLS)`), and C1035's `notifyCount` 5 | - |
| retry triggers (3) | the 5 `Retry <call>?` IF nodes: `statusCode === 409 \|\| === 503 \|\| === undefined` and `$runIndex < 6` | 409, 503, network C1052 | - |
| statuses that never loop (4) | C1052 text | 200, 400, 401, 404 C1052 | - (other non-2xx such as 500/502 also do not loop and are named by no check, F13) |
| exit after the last retry (5) | IF false outputs: link -> `Wait 3 days`, day 3 -> `Wait 4 days`, day 7 / W3 / W5 -> none | all 5 C1052 (`expectedExit`) | - |
| one-way doors (13 Landing rows) | plan Landing | 1 C1042, C1006 · 2 C1002, C1035 · 3 C1040, C1011 · 4 C1036 · 5 C1037, C1026 · 6 C1038 · 7 C1039 · 8 C1033, C1052 · 9 C1004 · 10 C1037 · 11 C1019, C1029, C1043 · 12 superseded · 13 C1035 | - |
| proxy paths (4) | `web/infrastructure/supabase/session.ts` | 4 C1038 | - |
| startup config `PORTAL_LINK_KEY` (3 places) | `web/composition/index.ts` | send C1026 · reissue C1026 · automation assembly: stubbed in `automation-container.test.ts`, real unseal is C1049 live | - |
| AC 16 end to end: provider failure -> 503 -> n8n retries -> same key re-claimed and sent | DB C1015, use case C1016, export loop C1052 | all three layers are proven. The real n8n runtime is C1049 (F14) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | migration (dispatcher, claim, complete), `web/app/api/automation/notify/route.ts`, `web/infrastructure/email/index.ts` | boundary: SQL recipe over the queue table and RPCs, route via `POST`, adapter via stubbed `fetch`. Own layer: one labelled case per decision-table row | yes |
| Decides, not reached across a boundary | `web/domain/notifications/index.ts`, `web/infrastructure/portal-tokens.ts`, `web/application/use-cases/notify.ts` | own layer: C1019, C1020, C1024, C1027, C1029, C1032, C1026, C1044, C1016, C1025 | yes |
| Instrumentation | `web/composition/index.ts`, `web/infrastructure/supabase/automation.ts`, `automation/n8n/*.json` | none of its own. The exports are asserted structurally by C1033-C1035 and behaviourally by C1052's walker | yes |

## Faults injected

Isolation: `git worktree add <scratchpad>/wt HEAD`, with `web/node_modules` junctioned to the real tree's copy and `web/.env.local` copied in. Each fault was applied alone, run, then reverted with `git checkout -- .` (porcelain empty after each).

The SQL fault was a `create or replace function private.dispatch_outbox()` prepended to the worktree's `supabase/tests/outbox_dispatch.sql`. That file runs inside `fixture.sql`'s transaction and ends in `rollback`. Afterwards, a read-only `execute_sql` confirmed the live `private.dispatch_outbox()` still contains `between 200 and 299`. No migration was applied.

Baseline `git status --porcelain` of the real tree was empty. It was still empty after `git worktree remove --force`, before this report was written.

| Mutation | Location | Killed |
| --- | --- | --- |
| C1052: W1 `Wait 10 minutes (link)` loops back to `Sign link` instead of `Link body`, so the retry reuses the old timestamp | `automation/n8n/W1-agreement-sent.json` connections | yes - 3 x `× C1052: a 409/503/network retries through a 10-minute Wait with the same key, freshly signed, until a 200` |
| C1052: W5 `Retry stale?` drops `\|\| $json.statusCode === undefined`, so a network error is not retried | `automation/n8n/W5-stale-daily.json` IF condition | yes - `× C1052: a network retries ...` and `× C1052: a network on every attempt stops after 6 retries ...` |
| C1035: the `Signature valid` false branch goes to `Event`, so an unsigned event is routed | `automation/n8n/events.json` connections | yes - `× C1035: the signature is checked before routing ...` (`expected true to be false`) |
| C1004: the dispatcher treats status `300` as delivered (`between 200 and 300`) | `supabase/migrations/20261029165430_outbox_dispatch.sql:52`, via `create or replace` in the test file | yes - `FAIL outbox_dispatch: C1004 300: 300 was not retried with an error` |
| C1029: the stale subject plural is inverted (`count === 1 ? "agreements" : "agreement"`) | `web/domain/notifications/index.ts:152` | yes - `× C1029: the stale digest counts, lists each agreement ...` |

5 injected, 5 killed. Together with round 1's 5 (dispatcher backoff, in-flight window, route 409, use-case reserved filter, Resend 429), every assertion surface the fix touched (exports, C1035, C1052) has now been made to fail at least once.

## Round 1 findings - status at `5c4237b`

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 - C1035 credential vs `$env` | resolved | The user chose placeholders (Landing 13, `plan.md:99`), and C1035 was reworded and approved. No export contains `$env` (`web/n8n-workflows.test.ts:245`), and every signer is `__SA_HMAC_SECRET__` (`:252`, `:267`). AD-074 and AD-079 were updated. Leftover wording in plan door 2 and open question 1, see F12 |
| F2 - AC 16 n8n retry unasserted | resolved | C1052 was added and approved. It covers 5 calls x 11 cases, and two faults were killed |
| F3 - door 6 `runtime` nodejs not exported | unchanged, accepted (wording only) | the route is unchanged |
| F4 - Landing 9-11 and test-pin edits added mid-build | unchanged, observation | no change since round 1 |
| F5 - STATE AD-070 row malformed | resolved | `.specs/STATE.md:76` has 5 cells, status `active, amended by AD-077` |
| F6 - ROADMAP ticked with stale `EventPublisher` text | resolved in ROADMAP, but it created F11 | `ROADMAP.md:117` was reworded and unticked. C1051 was not reworded to match |
| F7 - precision gaps | partly resolved | Resend 409 is now asserted (`resend.test.ts:77-79`), and the reader's `no_link_secret` is asserted (`agreements.test.ts:434`). The C1019 `[^<\n]*` between total and `before tax` is unchanged |
| F8 - complete's 401/400/404 all answer 503 at the route | unchanged, observation | `web/infrastructure/supabase/automation.ts` is unchanged |
| F9 - non-constant-time signature compare | unchanged, observation | migration unchanged |
| F10 - Webhook `rawBody` -> `extractFromFile` byte fidelity is live-only | unchanged, waits on C1049 | `events.json` changed only the secret |

## Findings (new in round 2)

- **F11 - C1051 fails (blocks PASS).**
  - C1051's literal claim and its shell proof require `ROADMAP.md` to tick Phase 3 item 5. The fix round unticked it (`ROADMAP.md:117`, `- [ ] ... (code done; awaiting verification and the live run)`), which resolved F6. C1051 was not reworded, and the Handoff says "Not changed: every other check".
  - Two ways out, and the user decides which: tick the item once C1049 passes, or reword C1051.
- **F12 - stale approved wording (C1035 / door 2, not blocking).**
  - Plan door 2 (`plan.md:87`, "also held as an n8n credential") and open question 1 (`plan.md:205`, "in the n8n credential") still describe the credential that Landing 13 replaced. Row 12 (`plan.md:97`) is left in place but marked as superseded by row 13.
  - The builder recorded this as deliberate (`checks.md:451`). The live operator steps in `checks.md:445` and `CONTEXT.md` correctly say to replace the placeholders.
- **F13 - C1052 precision gap.**
  - The retry predicate loops only on `409`, `503` and "no status" (`statusCode === undefined`). A `500`, `502` or `504` answered by the hosting platform's gateway, rather than the app, ends the call without a retry. For W1 that means the link email is lost.
  - C1052 names only 200/400/401/404 as non-looping and says nothing about other statuses, so this is not a contradiction. It is a gap in the check.
- **F14 - C1052 is proven by a simulator (live-only residue).**
  - The proof walks the export under the n8n semantics the builder took from n8n's docs and source (`web/n8n-workflows.test.ts:79-131`). Two behaviours are only exercised live, under C1049:
    - an error-output item carrying no `statusCode`
    - `$runIndex` surviving a persisted 10-minute Wait
- **F15 - suite flakiness under load (observation, not a feature check).**
  - Run concurrently with `test:db`, the pre-existing ESLint-driven tests C32 (`web/domain/purity.test.ts:28`) and C873 (`web/boundaries.test.ts:56`) timed out at 5000 ms. The first case of C873 took 3668 ms even in the clean run.
- **F16 - cosmetic.** `CONTEXT.md` (the n8n workflows bullet) is missing a full stop: "...so waits survive a redeploy) The exports carry...".

## Gate

- `npm run test:db` - 18 passed, 0 failed
- `npx vitest run --reporter=verbose` - 1773 passed, 0 failed (84 files)
- `npm run lint`, `npx tsc --noEmit`, `npm run build` - exit 0
- mcp `get_advisors` security - 12 lints, as C1041 expects
- mcp `execute_sql` (select only) - C1008 state, the live dispatcher definition unchanged, 0 Vault secrets, 0 notifications, 0 sent agreements
