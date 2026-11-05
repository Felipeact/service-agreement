# Deactivation verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 8cc6796..157506c
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2, scoped to the fix `b099435..157506c` (commit `157506c`) and to every verdict that was not PASS in round 1.
**All 49 checks (C1270-C1318) are now proven** with located assertions at `157506c`. Round 1's only FAIL, C1278,
is closed: the replacement filter moved into `replacementOptions`
(`web/components/records/active-control.tsx:17-21`), and a new test asserts that filter directly. The C1294 page-level
precision gap is closed the same way, by `withdrawnBy` (`active-control.tsx:24-26`). Precision gaps 3-6 from round 1
are unchanged and stay recorded. None of them leaves an obligation unproven.

The fix touched four files: the two edit pages, `active-control.tsx` and `records.test.ts`. The citations into
those files are refreshed and marked `verified at 157506c`. Every other row is `carried from b099435`. All proofs
re-ran in full at `157506c`.

## Binding sources - carried from b099435

Not run: profile `light` (step 1 runs under `ui` only). I read ROADMAP "Deactivation" and STATE AD-112 to AD-116
(and the AD-030 status row) only as context for the doors. None of them contradicts a check.

## Proof runs at HEAD (157506c) - verified at 157506c

Real tree, clean before and after (`git status --porcelain` empty).

- **vitest, one invocation**, from `web/`:
  `npx vitest run infrastructure/supabase/records.test.ts "app/(app)/record-forms.test.ts" components/records/records.test.ts components/sites/sites.test.ts composition/composition.test.ts components/customers/customers.test.ts domain/records infrastructure/supabase/readers.test.ts --reporter=verbose -t "C1276:|C1277:|C1278:|C1279:|C1280:|C1292:|C1293:|C1294:|C1295:|C1298:|C1299:|C1300:|C1301:|C1302:|C1303:|C1304:|C1305:|C1310:|C1311:|C1312:|C327:|C340:"`
  exit 0, 8 files passed, 46 tests. Each id appeared on its own `✓` line: C1276 x6, C1277 x2, C1278 x4, C1279, C1280,
  C1292, C1293, C1294 x3, C1295, C1298 x3 (adapter, action, control), C1299, C1300, C1301 x2, C1302 x2 (customers,
  sites), C1303 x2 (customers, sites), C1304, C1305 x2, C1310, C1311, C1312 x7, plus the superseded C327 and C340 x2.
  Every filter matched at least one test.
- **test:db, one invocation**, from `web/`:
  `npm run test:db record_forms agreement_builder service_included cadence outbox_dispatch import_review customer_portal rls_roles rls_isolation`
  exit 0: `9 passed, 0 failed`, each recipe on its own `PASS` line. `tests.ok` raises unless the condition `is true`
  (`supabase/tests/fixture.sql:37`), and `tests.expect_error` compares SQLSTATE exactly
  (`supabase/tests/fixture.sql:57`). So a PASS means every labelled assertion cited below held.
- **C1317**: `npm test` exit 0 (110 files, 2196 passed: round 1's 2194 plus the fix's two new tests). `npm run lint` exit 0. `npm run build` exit 0 ("Compiled
  successfully", 23/23 static pages).
- **mcp / live** (C1315, C1316, C1318): I cannot re-run these. I judged them from the author's recorded results in
  `checks.md` `## Handoff` and checked each recorded value against the claim.

## Checks

Rows C1278 and C1294 are `verified at 157506c`. C1311 and C1310 citations into `records.test.ts` are refreshed
(lines moved), `verified at 157506c`. Every other row is `carried from b099435`, and its proof re-ran green at `157506c`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1270 | asset removal stamps at/by uE, no link | test:db record_forms PASS | `supabase/tests/record_forms.sql:218-220` - `set_asset_active(RTU-3, false)` then `deactivated_at is not null and deactivated_by = tests.id('uE') and replaced_by_asset_id is null` | PASS |
| C1271 | replacement stored | test:db record_forms PASS | `supabase/tests/record_forms.sql:222-224` - `deactivated_at is not null and replaced_by_asset_id = tests.id('dz20:RTU-2')` | PASS |
| C1272 | 4 invalid replacements -> `23514`/`replacement_invalid`, unchanged | test:db record_forms PASS | `supabase/tests/record_forms.sql:207-216` - `tests.dz_fail(...) = '23514/replacement_invalid'` for itself, inactive RTU-4, other site dz21, other org assetB; `:215` `deactivated_at is null and replaced_by_asset_id is null` | PASS |
| C1273 | owner-level column checks `23514`, cross-site FK `23503` | test:db record_forms PASS | `supabase/tests/record_forms.sql:180-193` - `expect_error(... '23514')` replaced_by on active / itself / customers at-without-by / sites by-without-at / assets at-without-by; `:185-187` other site `'23503'` | PASS |
| C1274 | uA and uE delete asset -> `42501`, row stays | test:db record_forms PASS | `supabase/tests/record_forms.sql:239` estimator, `:244` owner `expect_error(... 'delete from public.assets ...', '42501')`; `:248` `exists (select 1 from public.assets where id = tests.id('dz21:U-1'))` | PASS |
| C1275 | scope drops removed unit; frozen snapshot keeps it | test:db record_forms PASS | `supabase/tests/record_forms.sql:201` before `doc like '%"unitNo": "U-1"%'`; `:231` after `doc not like '%"unitNo": "U-1"%'`; `:233-234` `snapshot::text like '%"unitNo": "U-1"%'` (fixture names the unit U-1, not RTU-1) | PASS |
| C1276 | asset adapter rpc args and 5 mappings | vitest `C1276:` x6 ✓ | `web/infrastructure/supabase/records.test.ts:129,131` - `toHaveBeenLastCalledWith("set_asset_active", { p_asset_id: ID, p_active: false, p_replaced_by: PARENT / null })`; `:135-139` table `23514`->`invalid_replacement`, `55000 site_inactive`->`parent_inactive`, `42501`->`forbidden`, `P0002`->`not_found`, `XX000`->`unavailable` | PASS |
| C1277 | removeAssetAction passes replacement (`""`->null), redirects, invalid no redirect | vitest `C1277:` x2 ✓ | `web/app/(app)/record-forms.test.ts:362-363` - `rejects.toThrow(NEXT_REDIRECT /sites/${SITE})`, `toHaveBeenCalledWith(ASSET, false, REPLACEMENT)`; `:368` `(ASSET, false, null)`; `:370-371` `toEqual({ status: "invalid_replacement" })`, `redirect` called once | PASS |
| C1278 | single Remove button; Replaced by None first + other active units by code/unit, never itself or an inactive one; none when no other; no Delete asset | vitest `C1278:` x4 ✓ (verified at 157506c) | `web/components/records/records.test.ts:152-153` one button `>Remove from service<`, `not.toContain("Delete asset")`; `:168-172` options `None`, `RTU RTU-2`, `MUA MUA-1`; `:177` `not.toContain("Replaced by")`; `:193-196` `expect(replacementOptions(site, "a1")).toEqual([{ id: "a2", label: "RTU RTU-2" }, { id: "a4", label: "MUA" }])` over a site holding a1 itself, active a2, removed a3, active a4; `:197` only self + removed gives `toEqual([])`. The page passes its site's assets and its own id straight in: `web/app/(app)/assets/[assetId]/edit/page.tsx:22` `replacementOptions((await siteRegister(asset.siteId))?.assets ?? [], assetId)` | PASS |
| C1279 | `Removed · replaced by RTU-2` / `Removed` | vitest `C1279:` ✓ | `web/components/sites/sites.test.ts:233-234` - `toContain(">Removed · replaced by RTU-2<")`, `toContain(">Removed<")` | PASS |
| C1280 | no deleteAssetAction / AssetStore.delete / container deleteAsset | vitest `C1280:` ✓ | `web/composition/composition.test.ts:96` `"deleteAsset" in container` false; `:101` `"deleteAssetAction" in records` false; `:103` `"delete" in supabaseAssetStore(...)` false | PASS |
| C1281 | draft site: stamps uE, withdraws, one event with exact payload + actor, one outbox row, returns id | test:db record_forms PASS | `supabase/tests/record_forms.sql:261` `r = array[tests.id('dz1:agr')]`; `:303-308` stamped by uE, `withdrawn`, one event, one outbox row; `:311-312` `payload = '{"from": "draft", "to": "withdrawn", "via": "deactivation"}'::jsonb and actor_id = tests.id('uE')` | PASS |
| C1282 | sent site payload | test:db record_forms PASS | `supabase/tests/record_forms.sql:263` returns dz2's id; `:313-314` `payload = '{"from": "sent", "to": "withdrawn", "via": "deactivation"}'::jsonb` | PASS |
| C1283 | in-term (T, T+30, null, 3 contract states at T-1) -> `55000`/`in_term`, unchanged; detail number + term_end | test:db record_forms PASS | `supabase/tests/record_forms.sql:265-269` loop dz3..dz8 `dz_fail(...) = '55000/in_term'` and `not dz_inactive(...) and dz_status = 'accepted'`; fixture offsets `:155-160`; `:272` `d ->> 'number' = 'AG-dz4' and d ->> 'termEnd' = (t + 30)::text` | PASS |
| C1284 | T-1 none/declined/voided and refused/expired/withdrawn deactivate, status unchanged | test:db record_forms PASS | `supabase/tests/record_forms.sql:277` `dz_inactive(...) and dz_status(n) = 'accepted' and r = '{}'` (dz9-11); `:282-283` dz12-14 keep `refused`/`expired`/`withdrawn` | PASS |
| C1285 | changes_requested -> `55000`/`changes_requested`, unchanged | test:db record_forms PASS | `supabase/tests/record_forms.sql:287` `= '55000/changes_requested'`; `:289` `not dz_inactive(...) and dz_status('dz15') = 'changes_requested'` | PASS |
| C1286 | in-term + draft renewal: refused, draft stays, no withdrawn event | test:db record_forms PASS | `supabase/tests/record_forms.sql:292` `= '55000/in_term'`; `:294` `status = 'draft'` and site active; `:315` `count(*) = 0 ... type = 'agreement.withdrawn'` | PASS |
| C1287 | 3 writers: uV `42501`; uB, uX, unknown `P0002`; nothing changed | test:db record_forms PASS | `supabase/tests/record_forms.sql:337` `dz_fail(f) like case u when 'uV' then '42501/%' else 'P0002/%' end` over all three functions; `:346` unknown `like 'P0002/%'`; `:351-352` nothing changed | PASS |
| C1288 | repeat deactivate keeps at/by and writes no event; reactivating active is a no-op | test:db record_forms PASS | `supabase/tests/record_forms.sql:363-368` `deactivated_at = '2026-02-02T00:00:00Z' and deactivated_by = tests.id('uA')` site/customer/asset; `:372` active rows stay active; `:374` `count(*) from public.events = before` | PASS |
| C1289 | create_agreement on inactive site `55000`/`site_inactive`, nothing inserted; reactivated returns id | test:db record_forms PASS | `supabase/tests/record_forms.sql:381` `= '55000/site_inactive'`; `:383` count `= before`; `:385` `create_agreement(...) is not null` | PASS |
| C1290 | run_renewals skips inactive site, renews active in same run | test:db record_forms PASS | `supabase/tests/record_forms.sql:492` `(tests.rn_of(tests.id('dzr1'))).id is null`; `:493` `dzr2 ... is not null` | PASS |
| C1291 | uE update of 7 locked columns `42501`; 8 editable columns 1 row each | test:db record_forms PASS | `supabase/tests/record_forms.sql:390-403` `expect_error(..., '42501')` x7; `:405-412` `expect_rows(..., 1)` x8 (runs under `act_as('uE')` from `:356`) | PASS |
| C1292 | site adapter rpc and mappings in_term/changes_requested/customer_inactive/42501/P0002 | vitest `C1292:` ✓ | `web/infrastructure/supabase/records.test.ts:150` `("set_site_active", { p_site_id: ID, p_active: false })`; `:153` `{ ok: false, code: "in_term", site: "Tower A", number: "AG-1004", termEnd: "2027-12-31" }`; `:157` changes_requested; `:159` `parent_inactive`; `:161,163` forbidden / not_found | PASS |
| C1293 | deactivateSiteAction redirects; in_term returns state, no redirect | vitest `C1293:` ✓ | `web/app/(app)/record-forms.test.ts:375-376` redirect `/sites/${SITE}`, `toHaveBeenCalledWith(SITE, false)`; `:378-379` `toEqual({ status: "in_term", ... number: "AG-1004", termEnd: "2027-12-31" })`, redirect once | PASS |
| C1294 | `Deactivate <site>?`, `This withdraws AG-1004.` for a draft or sent agreement, exact in_term and changes_requested copy | vitest `C1294:` x3 ✓ (verified at 157506c) | `web/components/records/records.test.ts:201-204` `withdrawnBy({... status: "draft"})` and `"sent"` `toBe("AG-1004")`, `"changes_requested"` and `null` `toBeNull()`; page `web/app/(app)/sites/[siteId]/edit/page.tsx:34` `withdraws={withdrawnBy(site.liveAgreement)}`; `records.test.ts:209-210` `"Deactivate Tower A?"`, `"This withdraws AG-1004."`; `:215-217` `"AG-1004 is in term until Dec 31, 2027, so this site can't be deactivated yet."`; `:218-220` `"AG-1004 has changes requested. Revise and withdraw it first."` | PASS |
| C1295 | inactive site: Inactive pill; no New agreement / Add asset / Import equipment list for a writer | vitest `C1295:` ✓ | `web/components/sites/sites.test.ts:245` `toContain(">Inactive<")`; `:246` each of the three `not.toContain(text)` | PASS |
| C1296 | customer + active sites same timestamp, withdraws, returns ids; earlier site keeps its time | test:db record_forms PASS | `supabase/tests/record_forms.sql:428` `r @> array[zs1:agr, zs2:agr] and cardinality(r) = 2`; `:432` `count(distinct deactivated_at) = 1 and bool_and(deactivated_by = uE)`; `:436` zs3 keeps `2026-01-01`; `:438-439` both withdrawn, 2 events `via = 'deactivation'` | PASS |
| C1297 | blocked customer `55000`/`in_term`, detail names site, nothing changed | test:db record_forms PASS | `supabase/tests/record_forms.sql:419` `= '55000/in_term'`; `:421-422` `->> 'site' = 'Plant ys2'`; `:423-425` customer, both sites, both agreements unchanged | PASS |
| C1298 | customer adapter refusal shape; action redirects; control prefixes site | vitest `C1298:` x3 ✓ | `web/infrastructure/supabase/records.test.ts:169,171,173` rpc args, `in_term` with `site`, `changes_requested` with `site`; `web/app/(app)/record-forms.test.ts:383-384` redirect `/customers/${CUSTOMER}`; `web/components/records/records.test.ts:224-226` (verified at 157506c) `"Tower A: AG-1004 is in term until Dec 31, 2027, so this site can't be deactivated yet."` | PASS |
| C1299 | inactive customer: pill, no Add site for writer | vitest `C1299:` ✓ | `web/components/customers/customers.test.ts:262-263` `inactive(out) toBe(1)`, `not.toContain("Add site")` (role estimator, `:261`) | PASS |
| C1300 | showInactive true only for `"inactive"` | vitest `C1300:` ✓ | `web/domain/records/records.test.ts:109-110` `showInactive({ show: "inactive" })` true; `{}`, `"all"`, `["inactive"]`, `""` false | PASS |
| C1301 | customers list hides/shows inactive, toggles to `?show=inactive` and back | vitest `C1301:` x2 ✓ | `web/components/customers/customers.test.ts:223-224` `not.toContain("Bravo")`, href `/customers?show=inactive`; `:229-231` `Bravo...>Inactive<`, href `/customers` `Hide inactive` | PASS |
| C1302 | customer Sites and site assets filter + toggles; `Removed` on asset row | vitest `C1302:` x2 ✓ | `web/components/customers/customers.test.ts:244-248` hidden Tower B, `/customers/c1?show=inactive`, pill, back link; `web/components/sites/sites.test.ts:223-228` RTU-1/RTU-3 hidden, `/sites/s1?show=inactive`, `RTU-3...>Removed<`, `/sites/s1` `Hide inactive` | PASS |
| C1303 | three empty-active messages with toggle | vitest `C1303:` x2 ✓ | `web/components/customers/customers.test.ts:253` `/No active customers\.[\s\S]*Show inactive/`, `:256-257` `"No active sites."`, `"Show inactive"`; `web/components/sites/sites.test.ts:239` `/No active assets\.[\s\S]*Show inactive/` | PASS |
| C1304 | list `active` and active-only counts (1 site, 2 assets) | vitest `C1304:` ✓ | `web/infrastructure/supabase/readers.test.ts:180` `toMatchObject({ active: true, siteCount: 1, assetCount: 2 })`; `:181` `inactive.active` false | PASS |
| C1305 | detail and register `active`; asset `replacedBy` unit no, else type code | vitest `C1305:` x2 ✓ | `web/infrastructure/supabase/readers.test.ts:268-269` detail `active` false and per-site active; `:320` `{ active: false, customerActive: true }`; `:321-326` `["a1", false, "RTU-2"]`, `["a4", false, "MUA"]` | PASS |
| C1306 | uV still selects inactive customer, site, asset and agreements | test:db record_forms PASS | `supabase/tests/record_forms.sql:446-449` `count(*) = 1` each under `act_as('uV')` (`:444`) | PASS |
| C1307 | reactivate clears at/by (+ replaced_by); withdrawn stays withdrawn | test:db record_forms PASS | `supabase/tests/record_forms.sql:474` site cleared; `:476-477` asset `... and replaced_by_asset_id is null`; `:478` `dz_status('zs2') = 'withdrawn'`; `:481-482` customer cleared | PASS |
| C1308 | reactivating custA leaves sites inactive | test:db record_forms PASS | `supabase/tests/record_forms.sql:468` customer back; `:469` `dz_inactive('sites', zs1) and dz_inactive('sites', zs2)` | PASS |
| C1309 | `customer_inactive` / `site_inactive` on reactivate, unchanged | test:db record_forms PASS | `supabase/tests/record_forms.sql:458-459` `= '55000/customer_inactive'`; `:462-463` `= '55000/site_inactive'`; `:464` both still inactive | PASS |
| C1310 | `Reactivate <customer> first.` / `Reactivate <site> first.` | vitest `C1310:` ✓ | `web/components/records/records.test.ts:230-231` (verified at 157506c) `toContain("Reactivate Kettle Test first.")`, `toContain("Reactivate Tower A first.")` | PASS |
| C1311 | writer sees Reactivate on 3 kinds; viewer sees none of 4 controls | vitest `C1311:` ✓ | `web/components/records/records.test.ts:236` (verified at 157506c) `toMatch(/<button type="submit"[^>]*>Reactivate<\/button>/)` per kind; `:247` viewer `not.toContain(text)` for the four labels | PASS |
| C1312 | six actions return `forbidden` for viewer, no store call | vitest `C1312:` x7 ✓ | `web/app/(app)/record-forms.test.ts:407-408` `toEqual({ status: "forbidden" })`, `storeCalls()).toBe(0)` over the six actions listed at `:398-404` | PASS |
| C1313 | redefined functions keep behaviour: 6 regression recipes pass | test:db `agreement_builder service_included cadence outbox_dispatch import_review customer_portal` each PASS | follow-up `create_agreement` keeps the term-dates body (`supabase/migrations/20261103173437_deactivation_create_lock.sql:14-36` vs `20261102164904_term_dates.sql`), adding only the guard at `:22-25`; `run_renewals` adds only `site.deactivated_at is null` (`supabase/migrations/20261103173318_deactivation.sql:312,318`); recipes raise on any labelled failure (`supabase/tests/fixture.sql:37,57`) | PASS |
| C1314 | superseded assertions now expect `42501` | test:db `rls_roles record_forms rls_isolation` PASS | `supabase/tests/record_forms.sql:63` `expect_error('C327 delete an asset', ..., '42501')`; `:26` `expect_error('C336 viewer delete assets', ..., '42501')`; `supabase/tests/rls_roles.sql:64-68` `expect_error('C12 update ' (concat) t, ..., '42501')` for customers/sites/assets and `'C12 delete assets' ... '42501'`. Extra superseded ones are strengthened, not deleted: `supabase/tests/import_review.sql:139` `C633 member delete refused ... '42501'`; `supabase/tests/service_included.sql:202` removes by `set_asset_active`; `web/app/(app)/record-forms.test.ts:199-200` `"deleteAssetAction" in actions` false; `web/composition/composition.test.ts:129` `not.toContain("delete(")` | PASS |
| C1315 | 0 inactive rows after migration | mcp (author-recorded) | `.specs/features/deactivation/checks.md:340` - the summed count query returned `inactive_rows: 0`, which matches the claim | PASS |
| C1316 | advisors: earlier findings + exactly the three new definer lints | mcp (author-recorded) | `.specs/features/deactivation/checks.md:341` - authenticated definer lint (9) = the five portal/automation functions + save_agreement_term (earlier) + set_asset_active, set_customer_active, set_site_active; the rls/anon/leaked-password rows match the prior accepted set; "only new findings are the three new writers" | PASS |
| C1317 | unit suite, lint, build | `npm test` / `npm run lint` / `npm run build` all exit 0 | `npm test` 110 files, 2196 passed; lint clean; build compiled (verified at 157506c). Types consumed at `web/infrastructure/supabase/records.ts` rpc calls (`set_asset_active` etc.), regenerated in `web/infrastructure/supabase/database.types.ts` (diff +40) | PASS |
| C1318 | live: sent-agreement site deactivates and withdraws; Inactive and no New agreement; in-term message; `?show=inactive` lists customer; reactivate restores New agreement | live (author-recorded) | `.specs/features/deactivation/checks.md:342` - AG-1048 `withdrawn` with one `{from: sent, to: withdrawn, via: deactivation}` event and outbox row; site page `Inactive` with no New agreement/Add asset/Import; "AG-1035 is in term until Nov 22, 2026, so this site can't be deactivated yet."; `/customers?show=inactive` listed the customer with `Inactive`; after reactivating, New agreement is back and AG-1048 is still withdrawn | PASS |

## Level and sampling

Verified at 157506c for C1278 and C1294. The rest is carried from b099435.

- Claims that name a status code or hint (C1272, C1273, C1274, C1283, C1285, C1287, C1289, C1291, C1309) are proven at
  the database boundary in `record_forms.sql` under real roles (`act_as`). The adapter mappings (C1276, C1292,
  C1298) are proven against the recording stub. No level gap.
- Enumerated cases each get their own case: C1272 (4), C1283 (6 plus the detail), C1284 (6), C1287 (3 functions x
  3 users plus unknown), C1291 (7 + 8), C1300 (5), C1303 (3), C1312 (6). C1278's exclusions (itself, removed) and
  C1294's statuses (draft, sent, changes_requested, none) now have their own cases too. No claim over n cases is
  proven on fewer.
- C1278 and C1294 are proven on the pure helpers the pages call, not by rendering the pages. Each page passes its
  inputs straight through on one line (`assets/[assetId]/edit/page.tsx:22`, `sites/[siteId]/edit/page.tsx:34`), so
  only a wrong argument at that call is left unasserted. The live run (C1318) shows the site page's `This withdraws
  AG-1048.` for a sent agreement. I judge this sufficient under `light`.

## Coverage - carried from b099435

Not run: profile `light`. I did not recompute the author's `Coverage` table. I read members only as far as each
check's own enumerations, listed above under Level and sampling.

## Faults injected - carried from b099435

Not run: profile `light` (fault injection runs under `standard` and `ui`).

## Swept rows marked `existing` - carried from b099435

| Row | Cited constraint | Found |
| --- | --- | --- |
| failure modes: each RPC is one transaction | each writer is a single plpgsql function. A raise aborts the whole call, and the customer path checks every site before it changes any | yes - `supabase/migrations/20261103173318_deactivation.sql:177-188` (assert loop, then deactivate loop); C1286/C1297 prove nothing changes on refusal |
| concurrency: row `for update` + compare-and-set withdraw | `for update` on the row in each writer; `apply_agreement_transition` updates `where status = p_expected_status`, else `40001` | yes - `supabase/migrations/20261103173318_deactivation.sql:117,157,179,206`; `supabase/migrations/20261102164904_term_dates.sql:105-107` |

## Door 6 follow-up migration - carried from b099435

`supabase/migrations/20261103173437_deactivation_create_lock.sql` matches door 6's literal shape: "`create_agreement`
raises `55000` hint `site_inactive` after the role check". The order is `P0002` (`:15-17`), the role check `42501`
(`:18-20`), then the `for share` read and the `site_inactive` raise (`:22-25`). The rest of the body is the
term-dates version unchanged, and `create or replace` keeps its grants. Recipes agreement_builder (viewer `42501`,
C738) and record_forms C1289 pass at HEAD. The first migration's ordering (`20261103173318_deactivation.sql:261`)
is fully superseded. One gap remains: neither migration's header ties it to AD-115. STATE AD-115 does cite
`20261103173437`, so the record is consistent.

## Precision findings

Ranked. None changes the verdict.

Closed in round 2 (verified at 157506c):
- *Round 1 #1, C1278 (was FAIL)*: the Replaced-by exclusions are now asserted on `replacementOptions`
  (`web/components/records/records.test.ts:193-197`).
- *Round 1 #2, C1294*: the draft / sent / changes_requested / none decision is now asserted on `withdrawnBy`
  (`web/components/records/records.test.ts:201-204`).

Still open, carried from b099435 (the fix did not touch these files):
1. **C1296 "per C1281" is checked only in part.** The customer path asserts both agreements are `withdrawn` and two
   `via = 'deactivation'` events (`supabase/tests/record_forms.sql:438-440`). It does not assert the outbox rows or
   `actor_id` per site. Both run through the same `private.deactivate_site` that C1281 proves, so the risk is low.
2. **C1292 "other errors as in C1276"**: the site test has no `unavailable` case. The mapping is the shared
   `setActive` helper in `web/infrastructure/supabase/records.ts`, and C1276 asserts `XX000`->`unavailable` on it.
3. **C1275 names `RTU-1`; the fixture unit is `U-1`** (`supabase/tests/record_forms.sql:201,231`). Same behaviour,
   different label from the check text.
4. **Stale test names**: `C808 asset deleted` (`supabase/tests/service_included.sql:204`) now removes the unit from
   service rather than deleting it.

## Notes on `Settled mid-build` - carried from b099435

- (1) The create_agreement lock reorder is reviewed above. It is correct against door 6 and AD-115.
- (2) C1314's superseded set grew past the three it names. Each extra assertion was changed to assert the new rule,
  and none was weakened or deleted:
  - import_review C633 gains `C633 member delete refused ... '42501'` (`supabase/tests/import_review.sql:139`) and
    keeps the FK keep-the-row half as the table owner (`:145-150`).
  - service_included C808 still asserts the unit leaves the scope (`:204-206`).
  - vitest C327 asserts there is no delete action and that removing a unit redirects (`record-forms.test.ts:199-200`).
  - composition C340 flips `toContain("delete(id: string)")` to `not.toContain("delete(")` for AssetStore
    (`composition.test.ts:129`).
  - rls_roles C12 keeps the row-count assertion for every other table and adds an explicit `42501` for the three
    narrowed tables (`rls_roles.sql:50-57,64-68`). Nothing is skipped silently.

## Gate

`npm run test:db record_forms agreement_builder service_included cadence outbox_dispatch import_review customer_portal rls_roles rls_isolation` - 9 passed, 0 failed.
Batched vitest - 8 files, 46 tests passed; every check id seen individually. `npm test` - 2196 passed, 0 failed. Lint and build exit 0. All re-run at 157506c.
`python .claude/skills/tlc-spec-lean/scripts/validate_verification.py deactivation` - exit 0 (round 2). Round 1 exited 1 on its FAIL verdict.
