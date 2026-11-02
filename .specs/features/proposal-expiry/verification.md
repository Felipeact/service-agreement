# Proposal expiry verification

**Verdict**: PASS
**Profile**: light
**Diff range**: c2f23eb..51c87c1
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 50 checks (C1220-C1269) proven at `51c87c1`, each with a located assertion. Four precision findings, none of
which leaves an approved obligation unproven, are listed under `## Precision findings`.

## Binding sources

Not run: profile `light` (step 1 runs under `ui` only). The plan marks no design or contract source as binding.

## Proof runs at HEAD (51c87c1)

Real tree, clean before and after (`git status --porcelain` empty).

- **vitest, one invocation**, from `web/`:
  `npx vitest run domain/org-settings components/settings/settings.test.ts components/settings/save-action.test.ts infrastructure/supabase/settings.test.ts infrastructure/supabase/agreements.test.ts components/agreements/agreements.test.ts components/review composition/staff-pdf-terms.test.ts composition/review-pdf.test.ts domain/portal infrastructure/supabase/portal.test.ts "app/review/[token]/page.test.ts" domain/notifications application/use-cases/notify.test.ts n8n-workflows.test.ts app/api/automation/notify components/kanban infrastructure/supabase/readers.test.ts --reporter=verbose -t "C1222:|C1223:|C1224:|C1225:|C1234:|C1235:|C1236:|C1237:|C1238:|C1239:|C1242:|C1243:|C1256:|C1257:|C1260:|C1033:|C1035:|C1269:|C1261:|C1262:"`
  exit 0: 18 files passed (7 skipped, matching no id), **54 tests passed, 0 failed**. Each of the 20 ids appeared
  individually as `✓` in the verbose output (C1222 x8, C1223 x3, C1224, C1225, C1234 x2, C1235 x3, C1236 x2, C1237,
  C1238, C1239 x5, C1242, C1243, C1256, C1257 x2, C1260 x5, C1033 x7, C1035 x2, C1269 x5, C1261 x2, C1262). No
  filter matched nothing.
- **test:db**, from `web/`, sequentially: `npm run test:db domain_constraints` PASS, `customer_portal` PASS,
  `outbox_dispatch` PASS, `demo_seed` PASS, `agreement_builder` PASS (each `1 passed, 0 failed`, exit 0). Every
  labelled assertion raises on failure (`tests.ok`, `tests.expect_error` at `supabase/tests/fixture.sql:51-63`
  compares SQLSTATE exactly), so a recipe PASS means each labelled assertion below held.
- **C1263**: `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm test` (plain) exit 0: 110 files, 2155 passed.
- **mcp / live** (C1221, C1233, C1264, C1266, C1267, C1268): not re-runnable here. Judged from the author's recorded
  results in `checks.md` `## Delivery results`; each recorded value was checked against the claim.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1220 | `proposal_validity_days` 0/366 `23514`, null `23502`, 1/365 ok, default 30 | test:db domain_constraints PASS | `supabase/tests/domain_constraints.sql:267` - `tests.ok('C1220 default', got = 30, ...)`; `:268-270` - `expect_error('C1220 0' ... '23514')`, `('C1220 366' ... '23514')`, `('C1220 null' ... '23502')`; `:271-272` - `expect_rows('C1220 1' ..., 1)`, `('C1220 365' ..., 1)` | PASS |
| C1221 | no `org_settings` row with days != 30 after migration | author's recorded mcp run | `.specs/features/proposal-expiry/checks.md:472-473` - "`c1221_not_30 0` of 1 settings row" (author's recorded run; value 0 satisfies the claim) | PASS |
| C1222 | validator accepts "1","30","365" as numbers; refuses "0","366","1.5","abc","" with the message | vitest, 8 x C1222 passed | `web/domain/org-settings/org-settings.test.ts:177` - `toMatchObject({ ok: true, value: { proposalValidityDays: days } })` over `[["1",1],["30",30],["365",365]]`; `:181-183` - `toEqual({ ok: false, errors: { proposalValidityDays: "Proposal validity must be a whole number of days from 1 to 365" } })` over all 5 inputs | PASS |
| C1223 | input labelled `Proposals valid for` holds 14 / 30; read-only for viewer | vitest, 3 x C1223 passed | `web/components/settings/settings.test.ts:196` - `toMatch(/<label[^>]*for="proposalValidityDays"[^>]*>Proposals valid for/)`; `:198` - `toContain(\`value="${value}"\`)` for 14 and 30 (`:191-192`); `:206` - `expect(hasAttr(tag, "readOnly")).toBe(true)` for viewer | PASS |
| C1224 | save action with "0" returns the C1222 error, never saves | vitest C1224 passed | `web/components/settings/save-action.test.ts:46` - `expect(saveOrgSettings).not.toHaveBeenCalled()`; `:47-49` - errors `toEqual({ proposalValidityDays: "Proposal validity must be ..." })` | PASS |
| C1225 | adapter reads 14 as `proposalValidityDays: 14`; save sends `proposal_validity_days: 14` | vitest C1225 passed | `web/infrastructure/supabase/settings.test.ts:107` - `expect(read?.proposalValidityDays).toBe(14)`; `:110` - update args `toMatchObject({ proposal_validity_days: 14 })` | PASS |
| C1226 | send stamps T+30, T+14; older versions null | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:860` - `tests.pe_valid('pe1226') = tests.pe_today() + 30`; `:862` - `pe_valid('pe1226b') = pe_today() + 14`; `:864-865` - `pe_valid('pe1226c', 2) = pe_today() + 30 and pe_valid('pe1226c', 1) is null` (T = `pe_today()` = Vancouver date, `:825-826`) | PASS |
| C1227 | setting 30 -> 7 after send leaves T+30 | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:873` - `tests.pe_valid('pe1227') = tests.pe_today() + 30` (after setting 7 at `:871`) | PASS |
| C1228 | reissue keeps 2027-01-15 | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:886` - `tests.pe_valid('pe1228') = '2027-01-15'` after `reissue_portal_link` at `:882` | PASS |
| C1229 | revise: v2 null, v1 kept; sending v2 stamps v2 only | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:901-902` - two versions and `pe_valid('pe1229', 2) is null`; `:903` - v1 `= '2027-01-20'`; `:910` - `pe_valid('pe1229', 2) = pe_today() + 30`; `:912` - v1 still `'2027-01-20'` | PASS |
| C1230 | owner update of `valid_until` refused `42501`, value kept | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:919-920` - `expect_error('C1230 owner update', 'update public.agreement_versions set valid_until = ''2030-01-01'' ...', '42501')` as uA; `:925` - `pe_valid('pe1230') = pe_today() + 30` | PASS |
| C1231 | failed sends (no line `23514`, no term start `23514` hint `no_term_start`, already sent `40001`) stamp nothing | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:936-938` - `expect_error('C1231 no line' ..., '23514')`, `('C1231 no term start' ..., '23514')`, `('C1231 already sent' ..., '40001')`; `:943-945` - count of those versions with `valid_until is not null` `= 0`. Hint not asserted here (see Precision findings 2) | PASS |
| C1232 | `valid_until` 1999-12-31 / 2100-01-01 `23514`; 2000-01-01, 2099-12-31, null ok | test:db domain_constraints PASS | `supabase/tests/domain_constraints.sql:285-286` - `expect_error('C1232 1999-12-31' ..., '23514')`, `('C1232 2100-01-01' ..., '23514')`; `:287-289` - `expect_rows(... '2000-01-01' ..., 1)`, `('2099-12-31', 1)`, `(null, 1)` | PASS |
| C1233 | backfill mismatch counts both 0 | author's recorded mcp run | `.specs/features/proposal-expiry/checks.md:473-475` - "`c1233_latest_mismatch 0` and `c1233_other_set 0`", rule stated as last `agreement.sent` Vancouver date + 30 (author's recorded run; both 0) | PASS |
| C1234 | reader maps `valid_until` 2026-12-02 / null to `validUntil` | vitest, 2 x C1234 passed | `web/infrastructure/supabase/agreements.test.ts:494` - `expect((await supabaseAgreementReader(typed).get(AGR))?.validUntil).toBe(shown)` over `[["2026-12-02","2026-12-02"],[null,null]]` (`:492`) | PASS |
| C1235 | AgreementView validity line: sent Dec 2; Jan 1 not Dec 31; expired line without Withdraw / Get a new link; null no line | vitest, 3 x C1235 passed | `web/components/agreements/agreements.test.ts:381` - `toContain("Valid until Dec 2, 2026")`; `:383-384` - `toContain("Valid until Jan 1, 2027")`, `not.toContain("Dec 31, 2026")`; `:389-391` - `toContain("Expired · was valid until Dec 2, 2026")`, `has(out, "Withdraw")` false, `has(out, "Get a new link")` false; `:395` - `not.toContain("Valid until")` | PASS |
| C1236 | ReviewView open: Dec 2, Jan 1, null no line | vitest, 2 x C1236 passed | `web/components/review/validity.test.ts:23` - `toContain("Valid until Dec 2, 2026")`; `:25` - `toContain("Valid until Jan 1, 2027")`; `:30` - `open(null)` `not.toContain("Valid until")` | PASS |
| C1237 | staff PDF route text holds `Valid until Dec 2, 2026`; null none | vitest C1237 passed | `web/composition/staff-pdf-terms.test.ts:119-120` - `expect(await render({ status: "sent", validUntil: "2026-12-02" })).toContain("Valid until Dec 2, 2026")`, null `not.toContain("Valid until")`; `render` calls the route `GET` with the real renderer (`:72-75`) | PASS |
| C1238 | review PDF route text holds the line; null none | vitest C1238 passed | `web/composition/review-pdf.test.ts:24-25` - `toContain("Valid until Dec 2, 2026")`, null `not.toContain("Valid until")`; route `GET` from `app/review/[token]/pdf/route` with `reactPdfDocumentRenderer`, status 200 at `:18` | PASS |
| C1239 | `portalState` 5 cases | vitest, 5 x C1239 passed | `web/domain/portal/portal.test.ts:57` - `expect(portalState(input)).toBe(expected)` over the 5 rows at `:51-55` (on date `open`, day after `expired`, null `open`, accepted `decided`, revoked `replaced`) | PASS |
| C1240 | `portal_view` returns `validUntil` "2027-01-15", `today` = T, null for null | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:959` - `v -> 'version' ->> 'validUntil' = '2027-01-15'`; `:960` - `v ->> 'today' = to_char(tests.pe_today(), 'YYYY-MM-DD')`; `:961` - `n -> 'version' -> 'validUntil' = 'null'::jsonb` | PASS |
| C1241 | T-1: accept/refuse/changes `40001`, stays sent, no event, no outbox; T and null accept | test:db customer_portal PASS | `supabase/tests/customer_portal.sql:981-984` - three `expect_error(... '40001')`; `:985`, `:987` - `od_state_cp(...) = 'ok'` for T and null; `:993-997` - still `sent`, events sum `= 0`, outbox grew by exactly 2 (the two allowed accepts); `:999` - pe1241t and pe1241n `accepted` | PASS |
| C1242 | portal reader maps `validUntil` and `today` | vitest C1242 passed | `web/infrastructure/supabase/portal.test.ts:99` - `toMatchObject({ validUntil: "2027-01-15", today: "2026-11-02" })`; `:101` - null case | PASS |
| C1243 | `/review/[token]` sent view past date shows expired message, no Accept | vitest C1243 passed | `web/app/review/[token]/page.test.ts:306` - `toContain("This agreement has expired.")`; `:307` - `not.toMatch(/<button[^>]*>[^<]*Accept/)` | PASS |
| C1244 | `run_expiries('2027-02-01')` expires X once, actor null, exact payload, one outbox row | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1088` - `tests.id('x1244') = any (tests.pe_ids('C1244'))`; `:1089` - status `'expired'`; `:1090` - events `= 1`; `:1091` - `e.actor_id is null`; `:1092` - `e.payload = '{"from": "sent", "to": "expired", "versionNo": 1, "validUntil": "2027-01-31", "via": "w8"}'::jsonb`; `:1094` - outbox count `= 1` | PASS |
| C1245 | run on the date returns nothing, stays sent | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1110` - `tests.pe_ids('C1245') = '{}'`; `:1111` - `pe_status('x1245') = 'sent' and pe_events(..., 'agreement.expired') = 0` | PASS |
| C1246 | 6 other statuses, sent-null, older-version-due all unchanged | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1132` - per status in `['draft','accepted','refused','changes_requested','withdrawn','expired']`: `pe_status = s and pe_events(...) = 0`; `:1135` - null date stays `sent`; `:1137` - v1 2027-01-31 / v2 2027-03-01 stays `sent` | PASS |
| C1247 | run twice + next day: one event, 2nd and 3rd return nothing | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1146` - `pe_events('x1244', 'agreement.expired') = 1`; `:1147` - `pe_ids('C1247b') = '{}' and pe_ids('C1247c') = '{}'` | PASS |
| C1248 | decide-then-expire stays accepted; expire-then-decide `40001`, stays expired; advisory lock `hashtext('expiries')` granted in the run's transaction | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1099-1103` - `exists (select 1 from pg_locks where locktype = 'advisory' and granted and pid = pg_backend_pid() and classid/objid = hashtext('expiries') halves)`; `:1162-1163` - `expect_error('C1248 decide after expiry', ... '40001')`; `:1168` - x1248a `accepted`, 0 expired events; `:1170` - x1248b `expired`, 0 accepted events | PASS |
| C1249 | 6 bad W8 keys `22023`, nothing expired; T+1, T-1 accepted | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1204` - `tests.od_state(...) = '22023'` over the 6 keys at `:1201-1202`; `:1207` - `pe_status('x1249') = 'sent'`; `:1210` - `= 'ok'` for `current_date ± 1`. Keys are built on `current_date`, not T (see Precision findings 1) | PASS |
| C1250 | after expiry, `create_agreement` on X's site returns a draft | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1179` - `(select status from public.agreements where id = a) = 'draft'` where `a := public.create_agreement(tests.id('x1244:site'))` as uA | PASS |
| C1251 | W1 day-3 reminder for expired X skips `decided` | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1191` - `res ->> 'decision' = 'skip' and res ->> 'reason' = 'decided'` (key `w1:<ev>:day3`, `:1188`) | PASS |
| C1252 | `run_expiries`, `claim_expiries` `42501` as uA and anon | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1037-1038` - `expect_error('C1252 run as uA' ..., '42501')`, `('C1252 claim as uA' ..., '42501')`; `:1042-1043` - same as anon; `:1030` - no `execute` privilege for anon | PASS |
| C1253 | W7/W5/W3/W1 claim assertions and whole `customer_portal` still pass | test:db outbox_dispatch PASS, customer_portal PASS | `supabase/tests/outbox_dispatch.sql:1287` - `select 'outbox_dispatch: pass'` reached (labels C1001-C1037, C1190-C1198 present and raising); `supabase/tests/customer_portal.sql:1004` - `select 'customer_portal: pass'` reached | PASS |
| C1254 | W8 body expires X; one `staff_expired` to uE with agreement, customer, site, `validUntil` T-1; notification row claimed | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1228` - `pe_status('x1254') = 'expired'`; `:1229-1230` - `decision = 'send'`, 1 message, `kind = 'staff_expired'`; `:1231` - `lower((m -> 'to')::text) = '["ue@example.test"]'`; `:1232-1234` - agreement `{id, number}`, customer, site, `validUntil = to_char(pe_t() - 1, ...)`; `:1235-1236` - `n.kind = 'staff_expired' and n.status = 'claimed'`, recipients `{ue@example.test}`, key `w8:<eventId>` (`:1226`) | PASS |
| C1255 | uE removed: to owners/admins; none left: skipped `no_recipient`, decision skip | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1072-1075` - `decision = 'send'`, 1 message, `to` = `['ua@example.test','ud@example.test']`; `:1058` - `n.status = 'skipped' and n.skip_reason = 'no_recipient'`; `:1059` - `decision = 'skip' and messages = '[]'` | PASS |
| C1256 | `staff_expired` email subject, text, escaped html | vitest C1256 passed | `web/domain/notifications/expiry-email.test.ts:15` - `subject toBe("AG-1004 expired without a decision")`; `:16-19` - text contains `Acme <Holdings>`, `Plant 2`, `Valid until Dec 2, 2026`, `https://agreements.northwind.ca/agreements/a1`; `:20-21` - html contains `Acme &lt;Holdings&gt;`, not `Acme <Holdings>` | PASS |
| C1257 | notify sends one email with subject and key, completes sent; reserved domain skipped | vitest, 2 x C1257 passed | `web/application/use-cases/notify.test.ts:228-233` - `send` once, `toMatchObject({ to: ["estimator@northwind.ca"], subject: "AG-1004 expired without a decision", idempotencyKey: "w8:e1" })`; `:234` - `complete` with `{ id: "n8", outcome: "sent", providerMessageId: "re_1" }`; `:240-241` - `send` 0 times, `complete` with `{ outcome: "skipped", reason: "reserved_domain" }` | PASS |
| C1258 | failed then T+1 reclaims, one expiry; sent then T and T+1 duplicate | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1270` - status `'failed'`; `:1272-1274` - T+1 `decision = 'send'`, same notificationId, status `claimed`; `:1275` - expired events `= 1`; `:1280-1281` - `decision = 'duplicate' and messages = '[]'` for T and T+1; `:1282-1283` - still `sent`, provider id `re_w8` | PASS |
| C1259 | complete for `expiry_daily`: staff_expired ok; staff_renewal and customer_link `P0002`; malformed `22023`; wrong secret `42501`, nothing recorded | test:db outbox_dispatch PASS | `supabase/tests/outbox_dispatch.sql:1249-1252` - `expect_error('C1259 staff_renewal' ..., 'P0002')`, `('C1259 customer_link' ..., 'P0002')`; `:1253-1254` - `('C1259 malformed' ... 'outcome', 'maybe' ..., '22023')`; `:1255-1256` - `('C1259 wrong signature' ..., '42501')`; `:1257` - notifications snapshot unchanged; acceptance of a staff_expired result at `:1076-1077` / `:1276-1277` (`od_complete` with `outcome 'sent'` succeeds) | PASS |
| C1260 | W8 export: Schedule 08:00 Vancouver -> Set -> Crypto -> POST; body kind/key; retry IF `$runIndex lt 6` -> 10-min Wait -> Set; no credential, no `$env`; 6 exports, 7 notify calls | vitest, 5 x C1260 + 7 x C1033 + 2 x C1035 passed | `web/n8n-workflows.test.ts:401-404` - interval `triggerAtHour: 8`, `timezone` `America/Vancouver`; `:406-414` - set, crypto, `httpRequest` `url: "__SA_APP_BASE_URL__/api/automation/notify"`, `method: "POST"`; `:425-426` - `kind: 'expiry_daily'`, key regex `w8:` + `toFormat('yyyy-MM-dd')`; `:439` - `{ leftValue: "={{ $runIndex }}", rightValue: 6, operator: { type: "number", operation: "lt" } }`; `:441-442` - Wait `amount: 10, unit: "minutes"`, back to `set`; `:446-448` - no credentials, no `$env`; `:452-453` - `FILES` length 6, notify calls 7; `:140` (C1033) - `readdirSync(DIR)` equals the 6 `FILES` (`:8`); `:255` (C1035) - `notifyCount toBe(7)` | PASS |
| C1261 | expired card in Refused shows neutral `Expired` pill; refused none | vitest, 2 x C1261 passed | `web/components/kanban/pipeline-view.test.ts:189` - `expect(html("expired")).toMatch(/>Expired</)` with `stage: "refused"` (`:186`); `:193` - `html("refused")` `not.toContain("Expired")`. Neutral tone read from code, not asserted (see Precision findings 3) | PASS |
| C1262 | pipeline reader carries `status: "expired"` | vitest C1262 passed | `web/infrastructure/supabase/readers.test.ts:457` - `toMatchObject({ id: "gone", stage: "refused", status: "expired" })` | PASS |
| C1263 | lint, tsc, plain `npm test` each exit 0 | ran at HEAD: lint 0, tsc 0, `npm test` 0 (110 files, 2155 tests) | `web/package.json:9-10` - `"lint": "eslint"`, `"test": "vitest run"`; run output: `Test Files 110 passed (110)`, `Tests 2155 passed (2155)` | PASS |
| C1264 | advisors: no finding beyond renewal's 13; none names `run_expiries`/`claim_expiries` | author's recorded mcp run | `.specs/features/proposal-expiry/checks.md:476-479` - 13 findings, same categories and counts as C1217's list (`.specs/features/renewal/checks.md:454-457`), "none names `run_expiries`, `claim_expiries` or `stamp_valid_until`" (author's recorded run) | PASS |
| C1265 | `demo_seed`, `agreement_builder`, `domain_constraints` pass; `seed.sql` unchanged | test:db demo_seed PASS, agreement_builder PASS, domain_constraints PASS; `git diff --quiet c2f23eb..HEAD -- supabase/seed.sql` exit 0 | `supabase/tests/demo_seed_rerun.sql:84` - `'demo_seed: pass'`; `supabase/tests/agreement_builder.sql:759` - `'agreement_builder: pass'`; `supabase/tests/domain_constraints.sql:293` - `'domain_constraints: pass'` | PASS |
| C1266 | live W8: `200`, agreement expired with one event, notification sent or skipped | author's recorded live run | `.specs/features/proposal-expiry/checks.md:486-494` - `200 {"outcome":"sent"}`; AG-1046 `expired`, 1 `agreement.expired` event with the door-4 payload and 1 outbox row; notification `w8:56074b4e-...` `staff_expired`, `sent` with provider id (author's recorded run; each value satisfies the claim) | PASS |
| C1267 | live Playwright at 1440/768/375: settings label, expired line, valid line, Expired card; no overflow, no console error, 44 px targets | author's recorded live run | `.specs/features/proposal-expiry/checks.md:501-508` - label `Proposals valid for (days)`; `Expired · was valid until Nov 1, 2026`; `Valid until Nov 29, 2026`; card reads `... Expired ...` and neutral pill in Refused tab at 375; `scrollWidth` never exceeds `innerWidth`; 0 controls under 44 px at 768 and 375; console 0 errors (author's recorded run) | PASS |
| C1268 | live review link: `Valid until` at 1440 and 375, no h-scroll; past date shows expired message, no buttons | author's recorded live run | `.specs/features/proposal-expiry/checks.md:495-500` - `Valid until Nov 29, 2026` at 1440 and 375 with `scrollWidth` 1425/1440 and 360/375; after `valid_until` 2026-11-01, `This agreement has expired.` with no button (author's recorded run) | PASS |
| C1269 | notify route `expiry_daily`: 401 no signature, 400 on `22023`, 409 in flight, 503 unavailable, 200 `{outcome: "sent"}` | vitest, 5 x C1269 passed | `web/app/api/automation/notify/route.test.ts:204` - `status toBe(401)`, claim not called (`:205`); `:210` - `toBe(400)` for `code: "malformed"` (adapter maps `"22023": "malformed"` at `web/infrastructure/supabase/automation.ts:8`); `:215` - `toBe(409)`; `:221` - `toBe(503)`; `:227-228` - `toBe(200)`, `json()` `toEqual({ outcome: "sent" })` | PASS |

## Level and sampling

- Claims naming a status or response shape (C1220, C1230, C1231, C1232, C1240, C1241, C1244, C1249, C1252, C1254,
  C1259) are proven at the database boundary in `test:db`, not below it. C1269 is proven at the route with the claim
  port faked; the `22023` -> `malformed` mapping it relies on is the existing adapter table
  (`web/infrastructure/supabase/automation.ts:8`). No level gap.
- C1237 and C1238 call the real route handlers with the real PDF renderer, so they prove the route, not only the
  document component.
- Every enumerated case in a claim has its own proof row or table-driven case: C1222 (8), C1239 (5), C1246 (6 + 2),
  C1249 (6 + 2), C1255 (2), C1259 (5), C1269 (5). No claim over n cases proven on fewer.

## Coverage

Not run: profile `light`. The author's `Coverage` table was not recomputed. Members were read only as far as each
check's own enumerations, listed above under Level and sampling.

## Faults injected

Not run: profile `light` (fault injection runs under `standard` and `ui`).

## Swept rows marked `existing`

| Row | Cited constraint | Found |
| --- | --- | --- |
| failure modes: a migration applies in one transaction | the migration holds no `begin`/`commit`/`rollback` of its own, so `apply_migration` runs it as one unit | yes - no transaction control statement in `supabase/migrations/20261102222043_proposal_expiry.sql` (searched `^\s*(begin|commit|rollback)\s*;`, 0 hits) |
| authorization: signature before any read | `private.automation_request` checks the HMAC first and raises `42501` before parsing the body | yes - `supabase/migrations/20261102222043_proposal_expiry.sql:367-372`; renewal-era proof `supabase/tests/outbox_dispatch.sql:380` (C1011, nothing written before) still passes |
| authorization: `org_settings` writes owner and admin only by RLS | insert and update policies use `has_org_role(org_id, array['owner','admin'])` | yes - `supabase/migrations/20261019174738_init.sql:289-293`; not redefined in any later migration |
| dependency failure: AD-079's retry loop, asserted for W8 in C1260 | IF on `$runIndex lt 6` then a 10-minute Wait back to Set | yes - `web/n8n-workflows.test.ts:439-442` |

## Precision findings

None of these leaves an approved obligation unproven, so none changes the verdict. They are ranked by how much a
reader of the check could be misled.

1. **C1249 (also C1254, C1258): T in the check, `current_date` in the code and test.** The check states the key window
   in T (Vancouver date). Door 5 and AC 25 state it against `current_date` / "the database's date", the code compares
   with `current_date` (`supabase/migrations/20261102222043_proposal_expiry.sql:417` - `abs(v_date - current_date) > 1`),
   and the test builds its keys from `current_date` (`supabase/tests/outbox_dispatch.sql:1201-1202`, `:1208`). The
   test proves the approved door, but the check's wording is false in the window where the UTC date is T + 1 (about
   16:00-24:00 Vancouver): there `w8:<T + 2>` is accepted. W8 runs at 08:00 Vancouver, so the production effect is nil.
2. **C1231: the `no_term_start` hint is claimed but not asserted in the C1231 block.** `tests.expect_error` compares
   SQLSTATE only (`supabase/tests/fixture.sql:57`), so `supabase/tests/customer_portal.sql:937` proves `23514` but not
   the hint. The same refusal's hint is asserted by term-dates' C1149 (`supabase/tests/customer_portal.sql:743`) in the
   same recipe, and the fixture for pe1231b has a service line, so `23514` there can only be the term-start check.
3. **C1261: "neutral" is claimed, only the text is asserted.** `web/components/kanban/pipeline-view.test.ts:189`
   asserts `>Expired<`; the tone comes from `web/components/kanban/kanban-card.tsx:22`
   (`<StatusPill tone="neutral" label="Expired" />`). The live run (C1267) records the neutral pill.
4. **C1033 test name is stale.** `web/n8n-workflows.test.ts:139` still reads "exactly the four exports" while its
   assertion compares against the six-entry `FILES` (`:8`). The assertion is right; the name misleads.

## Notes on `Settled mid-build`

- **C1259 `P0002` instead of `22023`:** does not weaken the obligation. The refusal of another body's notification is
  kept and proven (`outbox_dispatch.sql:1249-1252`); only its code follows the pre-existing `automation_complete`
  behaviour (route `404`). The plan's Surface row carries a correction line, but AC 32 in `plan.md:171` still says
  `22023`, so the plan now disagrees with itself on that one code.
- **C1248 lock proof restated:** narrows the evidence for AC 24 ("at once"), but not the guarantee. A real two-session
  race is not exercised. What is proven is that the lock is held for the run's transaction and that both sequential
  orders end in one status with one event. The code backs the restated reasoning: `run_expiries` takes
  `pg_advisory_xact_lock(hashtext('expiries'))` and expires with a compare-and-set
  `update ... where id = d.id and status = 'sent'` followed by `continue when not found`
  (`supabase/migrations/20261102222043_proposal_expiry.sql:248`, `:259-260`). Door 4's literal shape names a
  `for update` that the code does not contain. The `UPDATE` takes the row lock itself, so the semantics hold, but the
  door text and the code differ on that word.
- **C1237/C1238 proofs moved to `composition/`:** strengthens them. They now go through the real route and the real
  renderer instead of a fake.
- **The PDF-after-expiry assumption:** no check claims it, and none was weakened.

## Gate

- `npm run lint && npx tsc --noEmit && npm test` (from `web/`, at 51c87c1): lint 0, tsc 0, 110 files, 2155 passed,
  0 failed.
- `npm run test:db` domain_constraints, customer_portal, outbox_dispatch, demo_seed, agreement_builder: 5 passed,
  0 failed.
- Targeted vitest batch: 54 passed, 0 failed, all 20 ids present.
- `python .claude/skills/tlc-spec-lean/scripts/validate_verification.py proposal-expiry`: exit 0 (0 errors, 0 warnings).
