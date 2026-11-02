# Renewal verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 102bb12..6e752a83e3db666d172126ed2e74b0a48c890a83
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

53 of 54 checks proven with located evidence at `6e752a8`. One check fails as worded: C1216's `npm test` exits 1 on
this machine. The 5 failures are 5-second timeouts in composition-root tests that this feature did not change in
substance. The full suite passes 2090/2090 with `--testTimeout=60000`. The report states the literal result rather
than softening the row to fit.

## Binding sources

None. The plan's `Sources` are not marked binding and the profile is `light`, so step 1 does not run.

## Checks

How the proofs ran at HEAD `6e752a8`, in `web/`:
- **vitest**, one invocation:
  `npx vitest run --testTimeout=60000 --reporter=verbose -t "C11(6[6-9]|[7-9][0-9]):|C12(0[0-9]|1[0-9]):"`. Exit 0,
  with 65 passed and 2025 skipped. Each of the 20 vitest check ids appears individually as passed: C1168 ×15, C1169 ×2,
  C1170 ×3, C1171 ×4, C1192 ×3, C1195, C1199 ×6, C1200 ×2, C1201, C1202 ×4, C1204 ×2, C1205 ×3, C1206 ×3, C1207 ×2,
  C1209 ×3, C1210 ×4, C1211, C1212 ×2, C1213, C1214 ×3. Every test file is in the diff range.
- **test:db**, one invocation:
  `npm run test:db agreement_builder outbox_dispatch domain_constraints rls_isolation demo_seed`. Exit 0, with
  `5 passed, 0 failed`.
  - Each `tests.ok` / `tests.expect_error` / `tests.expect_rows` raises on failure (`supabase/tests/fixture.sql:34-75`).
    The runner passes a recipe only when its last row is `<name>: pass` (`web/scripts/test-db/runner.mts:131-133`). So
    a PASS means every labelled assertion below held.
  - `demo_seed` also runs `demo_seed_rerun.sql` (`runner.mts:48`).
- **mcp:** I re-ran C1166 and C1217 myself, read-only, against `gnxebrtcpbujhvcamtoe` (Supabase MCP `execute_sql`
  select and `get_advisors`). I also re-read C1218's post-state.
- **live:** C1219 is the author-side record only. It was not re-run (see the notes).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1166 | after migration, 0 `org_settings` rows with CPI or date set | mcp `execute_sql` re-run by verifier: `set_rows 0, all_rows 1` | `supabase/migrations/20261102180706_renewal.sql:15-16` - columns added with no default (null); query result `[{"set_rows":0,"all_rows":1}]` matches `checks.md:451-453`. No before run recorded (author admits) | PASS |
| C1167 | 6 CPI writes refused 23514, 4 accepted | test:db domain_constraints PASS | `supabase/tests/domain_constraints.sql:246-248` - `tests.expect_error('C1167 ' \|\| c.label, ... , '23514')` over the 6 literal rows at :241-244; `:253-254` - `tests.expect_rows(..., 1)` over -20, 100, 3.20, both null at :250-252 | PASS |
| C1168 | `validateOrgSettings` accepts/refuses CPI and date with the three messages | vitest, 15 tests passed | `web/domain/org-settings/org-settings.test.ts:152` - `toMatchObject({ ok: true, value: { renewalCpiPct: Number(pct), renewalCpiAsOf: "2027-10-15" } })`; `:156` both null; `:160-162` `errors: { renewalCpiPct: "CPI must be a number from -20 to 100 with at most two decimals" }`; `:167` `"Enter the date this CPI was published"`; `:171-172` `"Set both CPI and its date, or neither"` both ways | PASS |
| C1169 | store sends both columns; get maps them back | vitest, 2 passed | `web/infrastructure/supabase/settings.test.ts:81` - `toMatchObject({ renewal_cpi_pct: pct, renewal_cpi_as_of: asOf })` for `[3.2,"2027-10-15"]` and `[null,null]`; `:93` `{ renewalCpiPct: 3.2, renewalCpiAsOf: "2027-10-15" }` from `"3.20"`; `:95` both null | PASS |
| C1170 | each of the three errors returned on its field, no store write | vitest, 3 passed | `web/components/settings/save-action.test.ts:36` - `expect(saveOrgSettings).not.toHaveBeenCalled()`; `:37` - `toEqual({ [field]: message })` with the literal messages at `:31-33` | PASS |
| C1171 | inputs for owner/admin; read-only text for estimator/viewer | vitest, 4 passed | `web/components/settings/settings.test.ts:172-175` - labels `CPI for renewals` / `As of` and `value="3.2"`, `value="2027-10-15"`; `:180-185` - `control(...)` is `""`, text `3.2%`, `Oct 15, 2027`, `Not set` | PASS |
| C1172 | `run_renewals('2027-12-01')` returns only R, accepted, same org/site, next AG number | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:517` - `tests.rn_ret('C1172') = array[r.id]`; `:518-519` - `r.status = 'accepted' and r.org_id = a.org_id and r.site_id = a.site_id and r.number = (select number from tests.rn_expected)` (max + 1, computed at :506-508 before the run) | PASS |
| C1173 | one version, no 1, 2028-01-01, 12 months, ends 2028-12-31 | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:522-525` - `count(*) = 1 and v.version_no = 1`; `v.term_start = '2028-01-01' and v.term_months = 12 and v.term_end = '2028-12-31'` | PASS |
| C1174 | lines kept; 25800/20639; 20499 at cap 2.5; -1 unchanged | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:527` - `tests.rn_costs(r.id) = array[25800, 20639]`; `:528-539` description, visit_months, visits_per_year, position and coverage arrays equal A's; `:560` `array[25625, 20499]`; `:562` `array[25000, 19999]` | PASS |
| C1175 | R v1 snapshot = A's latest snapshot | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:541` - `v.snapshot = (select snapshot from public.agreement_versions where id = tests.id('r1172:v1'))` | PASS |
| C1176 | one `agreement.renewed` event with exact payload, one outbox row | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:545-546` - `count(*) ... = 1 and e.type = 'agreement.renewed'`; `:547-548` - `e.payload = jsonb_build_object('renewsAgreementId', ..., 'cpiPct', 3.2, 'appliedPct', 3.2, 'cpiAsOf', '2027-10-15')`; `:549` outbox count `= 1` | PASS |
| C1177 | nothing on 2027-11-30, one on 2027-12-01 | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:571` - `tests.rn_ret('C1177a') = '{}' and (tests.rn_of(...)).id is null`; `:576` - `tests.rn_ret('C1177b') = array[(tests.rn_of(tests.id('r1177'))).id]` | PASS |
| C1178 | reruns create nothing; link refuses duplicate 23505, self 23514, other org 23503 | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:583-584` - reruns `= '{}'`, renewals of A `= 1`; `:586-594` - `expect_error(... '23505')`, `('23514')`, `('23503')` | PASS |
| C1179 | advisory lock `hashtext('renewals')` held, granted | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:599-603` - `pg_locks ... l.locktype = 'advisory' and l.granted and l.pid = pg_backend_pid()` with classid/objid split of `hashtext('renewals')`; taken at `20261102180706_renewal.sql:47` | PASS |
| C1180 | frozen terms win over changed org settings | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:608-609` org set to cap 0 / threshold 1 / notice 90; `:613` - `tests.rn_ret('C1180a') = '{}'`; `:614-615` - status `'accepted'` and `payload -> 'appliedPct' = '3.2'` | PASS |
| C1181 | org fallback for notice/threshold; null frozen cap = `cpi_unset` draft | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:627-630` - `rn_ret('C1181a') = '{}'`; status `'accepted'`; `status = 'draft' and payload ->> 'reason' = 'cpi_unset'` | PASS |
| C1182 | six non-accepted statuses and accepted-without-start never renewed | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:646-648` - loop over `draft, sent, changes_requested, refused, expired, withdrawn, nostart`: `(tests.rn_of(...)).id is null` | PASS |
| C1183 | `run_renewals` not executable by anon/authenticated | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:654-655` - `not has_function_privilege('anon' / 'authenticated', 'private.run_renewals(date)', 'execute')` | PASS |
| C1184 | CPI 5 = threshold drafts at old prices with `at_threshold`; 4.99 auto | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:671` - `r.status = 'draft' and snapshot = '{}'`; `:673` `array[25000, 19999]`; `:674-677` `e.type = 'agreement.renewal_drafted'`, one event, payload `{renewsAgreementId, cpiPct 5, cpiAsOf '2027-10-15', reason 'at_threshold'}`; `:678` 4.99 `'accepted'` | PASS |
| C1185 | no CPI: draft, `cpi_unset` | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:686-687` - `status = 'draft' and payload ->> 'reason' = 'cpi_unset'` | PASS |
| C1186 | as-of 2026-10-31 stale draft; 2026-11-01 auto | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:698-700` - `status = 'draft' and reason = 'cpi_stale'`; `(r1186b).status = 'accepted'` | PASS |
| C1187 | open draft/sent/changes_requested on site blocks only that renewal | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:748` - `rn_ret('C1187draft') = array[(rn_of(r1187b)).id]`; `:751-754` - per status: no renewal of A, no event with `renewsAgreementId` = A, no `notifications` row for A | PASS |
| C1188 | draft R carries 2028-01-01 / 12 / 2028-12-31 | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:708` - `v.term_start = '2028-01-01' and v.term_months = 12 and v.term_end = '2028-12-31'` (on the C1185 draft) | PASS |
| C1189 | estimator can add a line, save term, send with frozen snapshot | test:db agreement_builder PASS | `supabase/tests/agreement_builder.sql:728-730` - lines `= 3`, `v.term_start = '2028-02-01'`, `status = 'sent' and v.snapshot ? 'takenAt'` (calls as `uE` at :716-721) | PASS |
| C1190 | W7 claim renews A and returns one `customer_renewal` with all fields; row claimed | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:897-909` - `r.status = 'accepted'`; `decision = 'send'` and 1 message; `kind = 'customer_renewal' and to = '["pat@customer.ca"]'`; agreement/renews/site; `oldAnnualCents = 119999 and annualCents = 123839 and appliedPct = 3.2`; term object; notif `status = 'claimed'`, kind `customer_renewal`, key `'w7:' \|\| r.id \|\| ':customer'` | PASS |
| C1191 | CPI unset: one `staff_renewal` to owner+admin with all fields; key `w7:<R>:staff` | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:958-968` - `status = 'draft'`; 1 message `staff_renewal`; `to = '["ua@example.test", "ud@example.test"]'`; agreement, `renews {number, termEnd}`, site, `customer.name = 'Customer A'`, `reason = 'cpi_unset' and cpiPct = null`; row kind at key `w7:<R>:staff` | PASS |
| C1192 | email subjects, amounts, term, link, three distinct reason sentences, HTML escaping | vitest, 3 passed | `web/domain/notifications/renewal-email.test.ts:18-22` - subject `"Your service agreement renews on Jan 1, 2028"`, text holds `$1,199.99`, `$1,238.39`, `3.2%`, `Jan 1, 2028 – Dec 31, 2028`, html escapes `<Ridge>` / `&`; `:37-40` subject `"AG-1013 needs renegotiation before Dec 31, 2027"`, link `https://app.example.ca/agreements/r1`, `&lt;Strata&gt;`; `:49-50` one own line per reason, 3 distinct | PASS |
| C1193 | failed send reclaimed next day; no second renewal | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:921` `status = 'failed'`; `:923-925` next-day claim `decision = 'send'`, 1 message with same `notificationId`, status `claimed`; `:926` renewals of A `= 1` | PASS |
| C1194 | sent notification never resent; `duplicate` | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:942-945` - today and tomorrow `decision = 'duplicate' and messages = '[]'`; row still `sent` with `provider_message_id = 're_w7'` | PASS |
| C1195 | reserved-domain `customer_renewal` sends nothing, completed `skipped`/`reserved_domain` | vitest, 1 passed | `web/application/use-cases/notify.test.ts:195` - `expect(send).toHaveBeenCalledTimes(0)`; `:196` - `complete` called with `[{ id: "n7c", outcome: "skipped", reason: "reserved_domain" }]` | PASS |
| C1196 | no contact email / no managers: `skipped` `no_recipient`, no message | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:983-988` - customer and staff rows `status = 'skipped' and skip_reason = 'no_recipient'`; no message whose agreement id is either renewal | PASS |
| C1197 | 6 bad keys/dates refused 22023, nothing renewed; ±1 day accepted | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:871-875` - loop over the 6 literal keys: `tests.od_state(...) = '22023'`; `:877` `(rn_of(w1198)).id is null`; `:879-881` ±1 day `= 'ok'` | PASS |
| C1198 | wrong signature and 301 s stale refused 42501, nothing renewed | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:858-862` - `od_state(... 'wrong-secret') = '42501'`; `od_ts(-301)` `= '42501'`; `(rn_of(w1198)).id is null` | PASS |
| C1199 | route statuses 200 sent, 200 duplicate, 400, 401, 409, 503 | vitest, 6 passed | `web/app/api/automation/notify/route.test.ts:156-157` `200` + `{ outcome: "sent" }`; `:163-164` `200` + `duplicate`; `:168-172` `["22023","malformed",400]`, `["42501","unauthorized",401]` -> `status`; `:178` `409`; `:184` `503` | PASS |
| C1200 | adapter parses both renewal kinds with every field; missing `agreement` is malformed | vitest, 2 passed | `web/infrastructure/supabase/automation.test.ts:156` - `toEqual({ ok: true, decision: "send", messages: [customer, staff] })` with literals at `:125-151`; `:164` - `rejects.toThrow(/malformed customer_renewal/)` | PASS |
| C1201 | sends with notification key as idempotency key; completes with provider id | vitest, 1 passed | `web/application/use-cases/notify.test.ts:203` - idempotency keys `toEqual(["w7:r1:customer", "w7:r2:staff"])`; `:204-207` - completed with `providerMessageId: "re_c"` / `"re_s"` | PASS |
| C1202 | W7 export shape: schedule, HMAC, POST, body, retry loop, no creds/`$env` | vitest, 4 passed | `web/n8n-workflows.test.ts:350-352` 08:00 daily; `:358` crypto hmac with `__SA_HMAC_SECRET__`; `:361-367` POST `__SA_APP_BASE_URL__/api/automation/notify`, raw, `fullResponse: true, neverError: true`; `:374-375` `renewal_daily` and `w7:` + `yyyy-MM-dd`; `:382-385` `$runIndex` / `6`, 10-minute Wait back to Set; `:389-391` no credentials, no `$env` (see precision note) | PASS |
| C1203 | `claim_notification` closed; kinds accept both renewal kinds, refuse `other` 23514 | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:993-997` - `not has_function_privilege(anon/authenticated, 'private.claim_notification(...)')`; `:998-1001` `expect_rows(..., 1)` for `customer_renewal`, `staff_renewal`; `:1002-1003` `expect_error(... 'other' ..., '23514')` | PASS |
| C1204 | reader returns `renews` / `renewedBy` or null | vitest, 2 passed | `web/infrastructure/supabase/agreements.test.ts:462-463` - `renews toEqual({ id: OLD, number: "AG-1004" })`, `renewedBy toEqual({ id: NEW, number: "AG-1013" })`; `:465-466` queried by `id` / `renews_agreement_id`; `:475-476` both `toBeNull()` | PASS |
| C1205 | `Renewal of AG-1004` / `Renewed by AG-1013` links; neither when null | vitest, 3 passed | `web/components/agreements/agreements.test.ts:428` - `<a ... href="/agreements/old-id">Renewal of AG-1004</a>`; `:433` - `href="/agreements/new-id"` `Renewed by AG-1013`; `:438-439` neither text | PASS |
| C1206 | board hides renewed accepted (unless withdrawn); `isRenewal` flags | vitest, 3 passed | `web/infrastructure/supabase/readers.test.ts:363` - for `accepted` and `draft` renewals, ids `toEqual(["new"])`; `:369-370` withdrawn renewal leaves `["old"]`, `isRenewal false`; `:375-376` renewal `true`, unlinked `false` | PASS |
| C1207 | card marker `Renewal` only when `isRenewal` | vitest, 2 passed | `web/components/kanban/pipeline-view.test.ts:176` - `html(true)` `toMatch(/>Renewal</)`; `:180` - `html(false)` `not.toContain("Renewal")` | PASS |
| C1208 | org B member reads no org A agreement, nor A's renewal | test:db rls_isolation PASS | `supabase/tests/rls_isolation.sql:164-167` - as `uB`, `count(*) where org_id = orgA` `= 0`, and `where renews_agreement_id = i1208` `= 0` (after `run_renewals` at :160) | PASS |
| C1209 | expiring window today..today+90, earliest first, edges, `sent` excluded, row fields | vitest, 3 passed | `web/infrastructure/supabase/readers.test.ts:407-414` - input ends 2028-02-29, 2027-11-30, 2027-12-01, 2028-03-01, 2027-12-31 -> ids `toEqual(["a", "b", "c"])`; `:415-425` row `{ site, customer, number, termEnd, noticeDate "2027-12-15", annualCents 100000, renewal null, ... }`; `:433` only status filter `eq status accepted`; `:438` `renewal toEqual({ id: "r", number: "AG-1013", status: "draft" })` | PASS |
| C1210 | the four state labels | vitest, 4 passed | `web/domain/pipeline/expiring.test.ts:8-10` `"Renews on Dec 15, 2027: automatic or renegotiated by CPI"`; `:14-16` `"Auto-renewed as AG-1013"`; `:20-22` `"Renewal draft AG-1013"`; `:26` `"Renewal blocked: AG-1009 is open"` | PASS |
| C1211 | past-notice row carries the site's open agreement number from draft/sent/changes_requested | vitest, 1 passed | `web/infrastructure/supabase/readers.test.ts:447` - `openAgreement toBe("AG-1009")`; `:448` - `in status ["draft", "sent", "changes_requested"]`; `:449` - `in site_id ["s1"]` | PASS |
| C1212 | one row per agreement with fields and label; empty text | vitest, 2 passed | `web/components/kanban/expiring-view.test.ts:27` - `data-expiring` count `2`; `:28-30` contains site, customer, `AG-1004`, `Dec 31, 2027`, `$1,199.99`, both labels; `:35-36` `"No agreements end in the next 90 days."` and no rows | PASS |
| C1213 | board link to `/pipeline?view=expiring`; link back to `/pipeline` | vitest, 1 passed | `web/components/kanban/expiring-view.test.ts:40` - `<a ... href="/pipeline">Back to the board</a>`; `:43` - `<a ... href="/pipeline?view=expiring">Expiring soon</a>` | PASS |
| C1214 | `view=expiring` calls `expiring`; absent/other calls `board` | vitest, 3 passed | `web/app/(app)/pipeline.test.ts:26-28` - `pipelineExpiring toHaveBeenCalledWith("2027-12-01")`, board not called, `Expiring soon`; `:34-35` - for `undefined` / `"other"`: board called once, expiring not called | PASS |
| C1215 | an accepted demo agreement with a term start; seed rerun changes no version or count | test:db demo_seed PASS (runs `demo_seed_rerun.sql`) | `supabase/tests/demo_seed.sql:247-249` - `exists (... a.status = 'accepted' and v.term_start is not null)`; `supabase/tests/demo_seed_rerun.sql:76-80` - version-row md5 unchanged and agreement count unchanged (see precision note) | PASS |
| C1216 | `npm run lint`, `npx tsc --noEmit`, `npm test` each exit 0 | lint exit 0; tsc exit 0; `npm test` **exit 1**: 5 failed / 2085 passed (2090) | `web/composition/composition.test.ts` C22, C27, `web/composition/portal-container.test.ts` C930, `web/composition/automation-container.test.ts` C1018 + one unnamed, each `Error: Test timed out in 5000ms`. `npx vitest run --testTimeout=60000` passes 2090/2090 (exit 0). The claim as written is not met | FAIL |
| C1217 | security advisors: no new finding after the migration | mcp `get_advisors security` re-run by verifier: 13 findings | `supabase/migrations/20261102180706_renewal.sql:126` / `:218` / `:306` - the new private functions revoked from anon/authenticated. The 13 findings are `rls_enabled_no_policy` outbox (1), anon definer (5), authenticated definer (6, incl. term-dates' `save_agreement_term`), leaked-password (1), exactly the list at `checks.md:454-458`; none names this migration's objects. The before list was not recorded; compared against AD-075 + term-dates | PASS |
| C1218 | signed W7 POST answers 200; one renewal, one event, notification sent/skipped | author-side live run (`checks.md:470-477`); post-state re-read by verifier via mcp `execute_sql` | `.specs/features/renewal/checks.md:470-472` - `200 {"outcome":"sent"}`. Verifier's query: one renewal `AG-1057 draft renews AG-1035`, one `agreement.renewal_drafted` event `{reason: cpi_unset, cpiPct: null, cpiAsOf: null}`, notification `w7:0b63513d-...:staff` `staff_renewal` `sent` with provider id. Deviation: ran against a local build of HEAD on the live project, not the deployed app, by the user's choice (`checks.md:464-467`) | PASS |
| C1219 | `/pipeline?view=expiring` at 1440 and 375 px shows the row and label, no horizontal scroll | author-side Playwright record only (`checks.md:478-483`) | `.specs/features/renewal/checks.md:478-481` - row `... AG-1035 · Renewal draft AG-1057 · Ends Nov 22, 2026 · $8,800/yr`, `scrollWidth 1440 = innerWidth 1440` and `375 = 375`, one signed-in page; label from `web/domain/pipeline/expiring.ts:55`. Not re-run by the verifier. Same local-build deviation as C1218 | PASS |

## Swept rows marked "existing", re-read against the code

| Swept row | Cited constraint | Found |
| --- | --- | --- |
| failure modes: a migration applies in one transaction | the renewal migration has no `begin;` / `commit;` of its own, so the migration runner's transaction holds | yes: `rg "^\s*(begin\|commit)\s*;"` on `20261102180706_renewal.sql` has no hits |
| authorization: `org_settings` writes are owner and admin only by RLS | insert/update policies with `has_org_role(org_id, array['owner','admin'])` | yes: `supabase/migrations/20261019174738_init.sql:289-292`; the renewal migration creates or drops no policy |
| concurrency: `claim_notification`'s in-flight rule (AD-076) | a `claimed` row younger than 10 minutes answers `in_flight` | yes: `supabase/migrations/20261029165430_outbox_dispatch.sql:350-351`; the renewal migration calls it (`20261102180706_renewal.sql:395`) and does not redefine it |
| dependency failure: AD-079's retry on 409 and 5xx | the export's IF retries on `[409, 500, 502, 503, 504]` or no status | yes: `automation/n8n/W7-renewal-daily.json:128`, operator `lt` 6 at `:138-143` |

## Gate

- vitest batch, check-scoped: 65 passed, 0 failed (2025 skipped by the filter). Exit 0.
- `npm run test:db agreement_builder outbox_dispatch domain_constraints rls_isolation demo_seed`: 5 passed, 0
  failed. Exit 0.
- `npm run lint`: exit 0. `npx tsc --noEmit`: exit 0.
- `npm test`: exit 1, with 5 failed and 2085 passed (2090). Every failure is a 5000 ms timeout in a composition test
  (C22, C27, C930, C1018, and one more in `automation-container.test.ts`).
- `npx vitest run --testTimeout=60000`: 2090 passed, 0 failed. Exit 0.
- mcp `execute_sql` (C1166, C1218 post-state) and `get_advisors security` (C1217) were re-run read-only, with results
  as cited above.

Validator output: see the end of this file.

## Findings

1. **C1216 fails as written.** Plain `npm test` exits 1 at HEAD on this machine.
   - Cause: 5-second default-timeout failures in the composition-root tests (C22, C27 in
     `web/composition/composition.test.ts`, C930 in `web/composition/portal-container.test.ts`, C1018 and one more in
     `web/composition/automation-container.test.ts`). The diff touched `composition/composition.test.ts` and
     `composition/index.ts` (2 lines and 1 line), so these files are not wholly outside the feature.
   - These tests pass with a 60 s timeout, and the author recorded the same rotating set. So this looks
     environmental: slow module transform on first import.
   - The check still claims exit 0, and that is not what happens. Fix options: raise the timeout for these
     composition tests (or set `testTimeout` in the vitest config), or have the user re-word C1216 to the 60 s
     invocation.
2. **C1218 and C1219: a user-approved deviation.** Both ran against a local `next build`/`next start` of HEAD on the
   live project, not the deployed Railway app. The deployed app runs pre-term-dates code, per `checks.md:464-467`, so
   the deployed route would not pass this today.
   - I judged both PASS because the user explicitly chose the environment and the HEAD code was what ran.
   - The deployed app does not have this feature yet. That is a delivery gap for the user to close by deploying.
3. **C1219 was not re-run by the verifier.** The result rests on the author's Playwright record. The memory note warns
   that a second context signs the demo owner out, and no HEAD server was running. Prior features accepted this
   author-side form.
4. **C1166 and C1217 have no before run** (admitted at `checks.md:453` and `:458`).
   - C1166's claim is about the state after the migration only. My re-run settles it.
   - C1217's comparison uses the lists earlier features recorded (AD-075's 12 plus term-dates' 1). My re-run shows
     the same 13, none from this migration.

## Level and sampling notes

- **C1202, a precision gap in the test.** `n8n-workflows.test.ts:382` asserts the IF's `leftValue` `$runIndex` and
  `rightValue` `6` but not the operator. A `gt` / `gte` mutant would survive. The export does carry `"operation": "lt"`
  (`automation/n8n/W7-renewal-daily.json:140-142`). The check stays PASS; the test should assert the operator.
- **C1215, a precision gap.** The claim says "latest version has `term_start` set". `demo_seed.sql:247-249` checks any
  version of an accepted agreement. On the live demo org every accepted agreement has exactly one version (verifier
  query), so the two readings agree today, but the assertion is weaker than the claim. The value is seed-derived: the
  term-dates backfill runs inside the recipe (`supabase/seed.sql:187-191`). It is not the hand-set AG-1035 start.
- **C1199, level.** The route test stubs the claim result as `code: "malformed"` / `"unauthorized"`, not the raw
  SQLSTATE. The `22023 -> malformed` and `42501 -> unauthorized` mapping is existing adapter code
  (`web/infrastructure/supabase/automation.ts:8`). The SQL boundary side is proven by C1197 / C1198, so the chain is
  covered across the two levels.
- **C1209, level.** The `sent` exclusion is proven by the adapter sending `eq status accepted` (`readers.test.ts:433`).
  The database does the filtering. That is acceptable at the adapter layer the check names.
- **C1179** proves the lock is held and granted. The "second call waits" sentence follows from Postgres
  advisory-lock semantics and is not exercised with two sessions. Acceptable under `light`.
- Sampling: every enumerated set in `checks.md`'s Coverage is backed by a literal per-member assertion at the cited
  lines (C1167's 10 rows, C1182's 7, C1187's 3, C1197's 8, C1199's 6). No claim names more cases than its proof runs.

## Validator

`python .claude/skills/tlc-spec-lean/scripts/validate_verification.py renewal` - exit 1:

```
  ERROR renewal: verdict is FAIL - route the ranked gaps back as fixes, then re-verify

validate_verification: 1 error(s), 0 warning(s) across [renewal]
```

The only error is the FAIL verdict itself. The validator raised no structural errors.
