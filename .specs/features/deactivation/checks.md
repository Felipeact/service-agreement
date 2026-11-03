# Deactivation - checks

Profile: light
Plan: `.specs/features/deactivation/plan.md`

46 checks in 5 slices plus delivery · 8 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1270:`). This feature numbers
  from C1270, because proposal-expiry owns up to `C1269:`.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Server Actions are tested in `app/(app)/record-forms.test.ts` with the container fake.
  - Components are asserted with `renderToStaticMarkup`.
- **test:db** means `npm run test:db record_forms` in `web/` (AD-026), run against project `gnxebrtcpbujhvcamtoe` and
  rolled back. It passes only once the migration is applied there. Every assertion goes into
  `supabase/tests/record_forms.sql` and is labelled with its check id. No new recipe, so the runner's pinned counts
  (C830, C203-C212) do not move. Regression recipes are named where a check needs them.
- **mcp** means a Supabase MCP `execute_sql` or `get_advisors` call on project `gnxebrtcpbujhvcamtoe`. The query and
  its result go in the Handoff.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context), recorded
  in the Handoff.

Terms:
- T is `(now() at time zone 'America/Vancouver')::date`.
- "the fixture" is `fixture.sql` org A (uA owner, uE estimator, uV viewer; uB owner of org B; uX in no org), plus
  `tests.dz_site(<name>, <status>, <term_end_offset>)`. That helper creates a site `<name>` of `custA` with one asset and
  an agreement in the given status, whose version 1 has `term_start` set so that `term_end = T + offset` (null offset
  gives a null `term_start`). It is created as the table owner.
- "a writer" is uE unless a check says otherwise.

## Checks

### S1 - remove an asset from service, and link its replacement · 12 files · ~110 KB · ~28k

**C1270** - `set_asset_active(assetA, false)` called as uE sets `deactivated_at` (not null) and `deactivated_by = uE` on
assetA, and `replaced_by_asset_id` stays null (AC 1, door 3)
Proof: `npm run test:db record_forms` (assertions `C1270`)

**C1271** - `set_asset_active(a1, false, a2)` as uE, with a2 an active asset on the same site, stores
`replaced_by_asset_id = a2` (AC 3, door 4)
Proof: `npm run test:db record_forms` (assertions `C1271`)

**C1272** - `set_asset_active` raises `23514` with hint `replacement_invalid`, and leaves the asset active with no link,
when the replacement is the asset itself, an inactive asset, an asset on another site of org A, or an asset of org B
(AC 4)
Proof: `npm run test:db record_forms` (assertions `C1272`)

**C1273** - As the table owner, an `assets` row with `replaced_by_asset_id` set and `deactivated_at` null is refused
with `23514`; a row with `deactivated_at` set and `deactivated_by` null is refused with `23514` (on all three tables);
a `replaced_by_asset_id` naming an asset on another site is refused with `23503` (doors 1, 4)
Proof: `npm run test:db record_forms` (assertions `C1273`)

**C1274** - As uA and as uE, `delete from public.assets` raises `42501` and the row stays (AC 5, door 2)
Proof: `npm run test:db record_forms` (assertions `C1274`)

**C1275** - After assetA is removed, `site_service_scope(siteA)` lists no unit `RTU-1`; before it, it does. A version
whose snapshot was frozen before the removal keeps `RTU-1` in its snapshot (AC 6, door 7)
Proof: `npm run test:db record_forms` (assertions `C1275`)

**C1276** - `AssetStore.setActive(id, false, replacedBy)` calls rpc `set_asset_active` with `p_asset_id`, `p_active`
false and `p_replaced_by` (null when none). It maps `23514` to `invalid_replacement`, `55000` hint `site_inactive` to
`parent_inactive`, `42501` to `forbidden`, `P0002` to `not_found` and anything else to `unavailable` (AC 1, AC 4)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1276:"`

**C1277** - `removeAssetAction(assetId)` as a writer calls `setAssetActive(assetId, false, <replacedBy>)` with
`replacedBy` from the form (`""` becomes null) and redirects to `/sites/<siteId>`. An `invalid_replacement` result
returns that status and no redirect (AC 1, AC 4)
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1277:"`

**C1278** - The asset edit page's control, before confirming, shows a single `Remove from service` button. After
confirming, it shows `Replaced by` with `None` first and then each other active asset of the site as `<type code>
<unit no>` (RTU RTU-2), never the asset itself or an inactive one. With no other active asset there is no `Replaced
by` field. No `Delete asset` button is rendered (AC 2, AC 5)
Proof: `npx vitest run components/records/records.test.ts -t "C1278:"`

**C1279** - In the site register with `?show=inactive`, an inactive asset whose replacement has unit `RTU-2` shows
`Removed · replaced by RTU-2`; one without a replacement shows `Removed` (AC 3, AC 20)
Proof: `npx vitest run components/sites/sites.test.ts -t "C1279:"`

**C1280** - `deleteAssetAction`, `AssetStore.delete` and the container's `deleteAsset` no longer exist (AC 5)
Proof: `npx vitest run composition/composition.test.ts -t "C1280:"`

### S2 - deactivate a site · 10 files · ~120 KB · ~30k

**C1281** - `set_site_active(<site>, false)` as uE on a site with a `draft` agreement sets the site's
`deactivated_at` and `deactivated_by = uE`, sets the agreement `withdrawn`, writes exactly one `agreement.withdrawn`
event with payload `{"from": "draft", "to": "withdrawn", "via": "deactivation"}` and `actor_id = uE`, one outbox row for
it, and returns an array holding that agreement's id (AC 7, AC 8, door 3)
Proof: `npm run test:db record_forms` (assertions `C1281`)

**C1282** - The same on a site with a `sent` agreement writes payload `{"from": "sent", "to": "withdrawn", "via":
"deactivation"}` (AC 8)
Proof: `npm run test:db record_forms` (assertions `C1282`)

**C1283** - `set_site_active(<site>, false)` raises `55000` with hint `in_term`, and the site stays active, when the site
has an `accepted` agreement whose latest `term_end` is T, or T + 30, or null, or whose `term_end` is T - 1 with a
contract in `pending_signature`, `client_signed` or `completed`. The error detail carries the agreement number and the
`term_end` (AC 10, door 5)
Proof: `npm run test:db record_forms` (assertions `C1283`)

**C1284** - `set_site_active(<site>, false)` succeeds on a site whose only agreement is `accepted` with `term_end` T - 1
and no contract, and on one with `term_end` T - 1 and a contract `declined` or `voided`; the agreement stays `accepted`.
It also succeeds on sites whose only agreement is `refused`, `expired` or `withdrawn`, leaving that status unchanged
(AC 8, AC 10, door 5)
Proof: `npm run test:db record_forms` (assertions `C1284`)

**C1285** - `set_site_active(<site>, false)` raises `55000` with hint `changes_requested` on a site with a
`changes_requested` agreement, and the site and agreement are unchanged (AC 11)
Proof: `npm run test:db record_forms` (assertions `C1285`)

**C1286** - On a site with an in-term `accepted` agreement and a `draft` renewal, `set_site_active(<site>, false)`
raises `55000` / `in_term`, the draft stays `draft`, and no `agreement.withdrawn` event exists (AC 12)
Proof: `npm run test:db record_forms` (assertions `C1286`)

**C1287** - Each of `set_site_active`, `set_customer_active` and `set_asset_active` raises `42501` for uV, and `P0002`
for uB, uX and an unknown id, with nothing changed (AC 27, door 3)
Proof: `npm run test:db record_forms` (assertions `C1287`)

**C1288** - Deactivating an inactive site, customer or asset leaves its `deactivated_at` and `deactivated_by` unchanged
and writes no event; reactivating an active one changes nothing (door 3)
Proof: `npm run test:db record_forms` (assertions `C1288`)

**C1289** - `create_agreement(<inactive site>)` as uE raises `55000` with hint `site_inactive` and inserts no agreement;
on the same site reactivated it returns an id (AC 13, door 6)
Proof: `npm run test:db record_forms` (assertions `C1289`)

**C1290** - `private.run_renewals(<run date>)` creates no renewal for a due accepted agreement whose site is inactive,
and creates one for a due agreement on an active site in the same run (AC 14, door 6)
Proof: `npm run test:db record_forms` (assertions `C1290`)

**C1291** - As uE, an update of `deactivated_at`, `deactivated_by` (and on assets `replaced_by_asset_id`) on
`customers`, `sites` and `assets` raises `42501`. An update of customer `name`, site `name`, `address` and
`site_contact_id`, and asset `asset_type_id`, `unit_no`, `type_model` and `location` affects 1 row each (AC 15, door 2)
Proof: `npm run test:db record_forms` (assertions `C1291`)

**C1292** - `SiteStore.setActive(id, active)` calls rpc `set_site_active` and maps `55000` hint `in_term` to
`{ code: "in_term", number, termEnd }` read from the detail, `changes_requested` to `{ code: "changes_requested",
number }`, `customer_inactive` to `parent_inactive`, plus `42501`, `P0002` and other errors as in C1276 (AC 10, AC 11,
AC 26)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1292:"`

**C1293** - `deactivateSiteAction(siteId)` as a writer calls `setSiteActive(siteId, false)` and redirects to
`/sites/<siteId>`; an `in_term` result returns `{ status: "in_term", number, termEnd }` and no redirect (AC 7, AC 10)
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1293:"`

**C1294** - The site edit page's control asks `Deactivate <site>?` and, when the site has a draft or sent agreement
AG-1004, adds `This withdraws AG-1004.`. Given the `in_term` state for AG-1004 ending 2027-12-31 it shows `AG-1004 is
in term until Dec 31, 2027, so this site can't be deactivated yet.`; given `changes_requested` it shows `AG-1004 has
changes requested. Revise and withdraw it first.` (AC 9, AC 10, AC 11)
Proof: `npx vitest run components/records/records.test.ts -t "C1294:"`

**C1295** - The site register of an inactive site shows an `Inactive` pill and renders no `New agreement`, `Add asset`
or `Import equipment list` control for a writer (AC 7, AC 13)
Proof: `npx vitest run components/sites/sites.test.ts -t "C1295:"`

### S3 - deactivate a customer · 7 files · ~70 KB · ~18k

**C1296** - `set_customer_active(custA, false)` as uE sets custA and each of its active sites inactive with one and the
same `deactivated_at`, withdraws each site's `draft` or `sent` agreement per C1281, and returns their ids; a site
deactivated earlier keeps its earlier `deactivated_at` (AC 16)
Proof: `npm run test:db record_forms` (assertions `C1296`)

**C1297** - When one of custA's sites has an in-term agreement, `set_customer_active(custA, false)` raises `55000` /
`in_term` with the site name in the detail, and custA, every site and every agreement are unchanged (AC 17)
Proof: `npm run test:db record_forms` (assertions `C1297`)

**C1298** - `CustomerStore.setActive` maps a refusal to `{ code: "in_term", site, number, termEnd }` (and
`changes_requested` with `site`), and `deactivateCustomerAction` redirects to `/customers/<id>` on success; the
customer edit control renders `<site>: AG-1004 is in term until Dec 31, 2027, so this site can't be deactivated yet.`
(AC 16, AC 17)
Proof: `npx vitest run infrastructure/supabase/records.test.ts -t "C1298:"`
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1298:"`
Proof: `npx vitest run components/records/records.test.ts -t "C1298:"`

**C1299** - The detail page of an inactive customer shows an `Inactive` pill and no `Add site` for a writer (AC 18)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1299:"`

### S4 - inactive records are hidden by default · 9 files · ~80 KB · ~20k

**C1300** - `showInactive` is true for `{ show: "inactive" }` only; `{}`, `{ show: "all" }`, `{ show: ["inactive"] }`
and `{ show: "" }` give false (AC 19, door 8)
Proof: `npx vitest run domain/records -t "C1300:"`

**C1301** - `CustomersView` hides an inactive customer by default and shows it with an `Inactive` pill when showing
inactive; its toggle links to `/customers?show=inactive`, and back to `/customers` (AC 19, AC 20)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1301:"`

**C1302** - The customer detail's Sites list and the site register's asset list do the same, with toggles to
`/customers/<id>?show=inactive` and `/sites/<id>?show=inactive` and back; an inactive asset row carries `Removed` (AC 19,
AC 20)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1302:"`
Proof: `npx vitest run components/sites/sites.test.ts -t "C1302:"`

**C1303** - With only inactive rows and inactive hidden, the lists show `No active customers.`, `No active sites.` and
`No active assets.` with the `Show inactive` toggle (AC 22)
Proof: `npx vitest run components/customers/customers.test.ts -t "C1303:"`
Proof: `npx vitest run components/sites/sites.test.ts -t "C1303:"`

**C1304** - `CustomerDirectory.list` returns `active` per customer and counts only active sites and active assets on
active sites (a customer with one active site of 2 active and 1 inactive assets, and one inactive site of 3 assets,
reads `siteCount` 1 and `assetCount` 2) (AC 21)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1304:"`

**C1305** - `CustomerDirectory.detail` returns `active` for the customer and each site; `SiteRegister.get` returns
`active`, and per asset `active` and `replacedBy` (the replacement's unit no, else its type code) (AC 3, AC 19)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1305:"`

**C1306** - After deactivation, uV still selects the inactive customer, site and asset by id, and every agreement on the
site (AC 23)
Proof: `npm run test:db record_forms` (assertions `C1306`)

### S5 - reactivate · 6 files · ~40 KB · ~10k

**C1307** - `set_*_active(<id>, true)` as uE clears `deactivated_at` and `deactivated_by`, and on an asset
`replaced_by_asset_id`; an agreement withdrawn by the deactivation stays `withdrawn` (AC 24)
Proof: `npm run test:db record_forms` (assertions `C1307`)

**C1308** - Reactivating custA leaves its sites inactive (AC 25)
Proof: `npm run test:db record_forms` (assertions `C1308`)

**C1309** - `set_site_active(<site>, true)` under an inactive customer raises `55000` hint `customer_inactive`;
`set_asset_active(<asset>, true)` on an inactive site raises `55000` hint `site_inactive`; neither changes anything
(AC 26)
Proof: `npm run test:db record_forms` (assertions `C1309`)

**C1310** - The site and asset reactivate controls render `Reactivate <customer> first.` and `Reactivate <site>
first.` for a `parent_inactive` state (AC 26)
Proof: `npx vitest run components/records/records.test.ts -t "C1310:"`

**C1311** - A writer sees `Reactivate` on an inactive customer, site and asset edit page; a viewer sees none of
`Deactivate customer`, `Deactivate site`, `Remove from service` or `Reactivate` (AC 24, AC 27)
Proof: `npx vitest run components/records/records.test.ts -t "C1311:"`

**C1312** - Each of the six actions (`deactivate*`, `reactivate*`, `removeAssetAction`) returns `forbidden` for a
viewer and calls no store method (AC 27)
Proof: `npx vitest run "app/(app)/record-forms.test.ts" -t "C1312:"`

### Delivery - regressions, data and the live run

**C1313** - The redefined functions keep their earlier behaviour: the `agreement_builder`, `term_dates` assertions in
it, `service_included`, `cadence`, `outbox_dispatch` (W7 renewals) and `import_review` (commit inserts assets) recipes
pass (Impact rows on redefinitions and grants)
Proof: `npm run test:db agreement_builder service_included cadence outbox_dispatch import_review customer_portal`

**C1314** - Earlier assertions this plan supersedes now expect the refusal: record-forms C327 (`delete` an asset) and
C336 (viewer `delete` assets) expect `42501`; rls_roles C12 expects `42501` for a viewer's `update` of `customers`,
`sites`, `assets` (`org_id` is no longer an updatable column) and `delete` of `assets` (AD-030 superseded for assets,
door 2)
Proof: `npm run test:db rls_roles record_forms rls_isolation`

**C1315** - After the migration, the count of rows with `deactivated_at` not null across `customers`, `sites` and
`assets` on the project is `0` (Impact: no backfill)
Proof: mcp `execute_sql` (query and result recorded in the Handoff)

**C1316** - `get_advisors` security lists the earlier accepted findings plus exactly the
`authenticated_security_definer_function_executable` lint for `set_customer_active`, `set_site_active` and
`set_asset_active`, and nothing else new (door 3)
Proof: mcp `get_advisors` (result recorded in the Handoff)

**C1317** - The whole unit suite, lint and the production build pass with the regenerated `database.types.ts`
Proof: `npm test`
Proof: `npm run lint`
Proof: `npm run build`

**C1318** - Live, signed in as the demo owner in one context: a demo site with a sent agreement is deactivated, the
agreement turns `Withdrawn` and the site page shows `Inactive` with no `New agreement`; a site with an in-term accepted
agreement shows the in-term message; `/customers?show=inactive` lists an inactive customer; reactivating restores
`New agreement` (S2-S5 independent tests)
Proof: live (Playwright run, recorded in the Handoff)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `rpc set_site_active` statuses (6) | `200` C1281, C1284 · `P0002` C1287 · `42501` C1287 · `55000 in_term` C1283 · `55000 changes_requested` C1285 · `55000 customer_inactive` C1309 | - |
| `rpc set_customer_active` statuses (5) | `200` C1296 · `P0002` C1287 · `42501` C1287 · `55000 in_term` C1297 · `55000 changes_requested` C1297 | - |
| `rpc set_asset_active` statuses (5) | `200` C1270, C1271 · `P0002` C1287 · `42501` C1287 · `23514 replacement_invalid` C1272 · `55000 site_inactive` C1309 | - |
| `rpc create_agreement` statuses (4) | `200` C1289, C1313 · `P0002` C1313 · `42501` C1313 · `55000 site_inactive` C1289 | - |
| invalid replacements (4) | itself C1272 · inactive C1272 · other site C1272 · other org C1272 | - |
| in-term blockers (6) | `term_end` = T C1283 · T + 30 C1283 · null C1283 · contract `pending_signature` C1283 · `client_signed` C1283 · `completed` C1283 | - |
| not blocking (3) | `term_end` T - 1 no contract C1284 · contract `declined` C1284 · contract `voided` C1284 | - |
| agreement statuses on a deactivating site (7) | `draft` withdrawn C1281 · `sent` withdrawn C1282 · `changes_requested` refused C1285 · `accepted` C1283, C1284 · `refused` untouched C1284 · `expired` untouched C1284 · `withdrawn` untouched C1284 | - |
| locked columns (7) | customers `deactivated_at` C1291 · `deactivated_by` C1291 · sites `deactivated_at` C1291 · `deactivated_by` C1291 · assets `deactivated_at` C1291 · `deactivated_by` C1291 · `replaced_by_asset_id` C1291 | - |
| still-updatable columns (8) | customer `name` C1291 · site `name` C1291 · `address` C1291 · `site_contact_id` C1291 · asset `asset_type_id` C1291 · `unit_no` C1291 · `type_model` C1291 · `location` C1291 | - |
| roles calling the writers (5) | uE C1270, C1281, C1296 · uA C1274 · uV C1287 · uB C1287 · uX C1287 | - |
| lists with the filter (3) | customers C1301 · customer Sites C1302 · site assets C1302 | - |
| empty-active messages (3) | `No active customers.` C1303 · `No active sites.` C1303 · `No active assets.` C1303 | - |
| `show` values (5) | `inactive` C1300 · absent C1300 · `all` C1300 · array C1300 · empty C1300 | - |
| refusal messages (4) | `in_term` C1294, C1298 · `changes_requested` C1294 · customer inactive C1310 · site inactive C1310 | - |
| hidden controls on an inactive parent (4) | `New agreement` C1295 · `Add asset` C1295 · `Import equipment list` C1295 · `Add site` C1299 | - |
| actions (6) | `deactivateCustomerAction` C1298, C1312 · `reactivateCustomerAction` C1312 · `deactivateSiteAction` C1293, C1312 · `reactivateSiteAction` C1312 · `removeAssetAction` C1277, C1312 · `reactivateAssetAction` C1312 | - |
| redefined functions (3) | `create_agreement` C1289, C1313 · `run_renewals` C1290, C1313 · `site_service_scope` C1275, C1313 | - |
| superseded earlier assertions (3) | record-forms `327` C1314 · record-forms `336` C1314 · rls_roles `12` C1314 | - |
| Landing doors (8) | 1 C1270, C1273 · 2 C1274, C1291 · 3 C1281, C1287, C1288 · 4 C1271, C1273 · 5 C1283, C1284 · 6 C1289, C1290 · 7 C1275 · 8 C1300 | - |
| startup config: generated types (1 assembly) | `database.types.ts` used by every adapter C1317 | - |

- Claims naming a status or a response shape are C1272, C1273, C1274, C1276, C1283, C1285, C1287, C1289, C1291, C1292
  and C1309. Each crosses the database boundary or asserts the adapter's mapping.
- Door 5's America/Vancouver date: C1283 compares with T, so it tells Vancouver from UTC only between 00:00 UTC and
  Vancouver midnight. The literal shape is in the plan, and the Verifier reads the definition.
- No other check claims more than the cases its proof lists.

## Swept

- validation: C1272 (replacement), C1273 (column checks), C1300 (the `show` parameter)
- failure modes: C1286 (a refused deactivation withdraws nothing), C1297 (a refused customer changes no site); existing -
  each RPC is one transaction
- idempotency: C1288 (repeating a deactivation or reactivation changes nothing and writes no event)
- authorization: C1287 (roles and orgs), C1291 (locked columns), C1274 (no delete), C1312 (actions refuse viewers)
- concurrency: C1281 - each writer locks its row `for update`, and the withdraw is the compare-and-set
  `apply_agreement_transition` (AD-015), so a racing Send or decision makes the deactivation fail `40001` and roll back;
  n/a for a second proof - the plan adds no new shared counter
- data lifecycle: C1315 (no backfill, every row active), C1306 (inactive records stay readable), C1274 (assets no
  longer deleted)
- dependency failure: n/a - no external call; a withdrawn agreement's outbox row is delivered by the existing dispatcher
- state transitions: C1281, C1282 (`draft`/`sent` → `withdrawn`), C1285 (`changes_requested` refused), C1307 (no
  agreement restored), C1309 (reactivation guards)
- observability: C1281 (the event carries `via: "deactivation"` and the actor), C1270 (`deactivated_by`); n/a - no new
  logging requirement

## Handoff

- **Precondition:** proposal-expiry has a Verifier PASS and its commits are on `development` through `8cc6796`. Met.
  The feature base is `8cc6796`.
- Read set, measured with `wc -c` on 2026-11-03 over the files the slices touch: about 341 KB (the latest three
  migrations in part, `record_forms.sql`, `rls_roles.sql`, ports, composition, the records and readers adapters and
  their tests, the customer, site and record components and pages, and `record-forms.test.ts`). About 85k tokens.
- Written: migration and SQL assertions about 35 KB, app code and tests about 45 KB, docs about 8 KB. About 88 KB,
  about 22k tokens. Test output adds about 10k.
- S1-S5 and delivery come to about 117k against the 150k budget, so one builder. Had a cut been needed it would fall
  after S2, where the surface moves from the database writers to the lists.
- Mechanism: one builder (under the budget, no ask)
- **Asks before build (blast radius):** applying the migration to `gnxebrtcpbujhvcamtoe` through mcp
  `apply_migration` (the test:db proofs need it), and the live run C1318, which deactivates and reactivates demo
  records and withdraws one demo agreement.

- **Boundary:** C1270-C1318 closed at `bb0efa2` (the docs commit follows)
- **Proof runs (2026-11-03):** `npm run test:db` 19 passed, 0 failed (record_forms carries C1270-C1309; C1313 and C1314 recipes included). `npm test` 110 files, 2194 tests passed. `npm run lint` clean. `npm run build` passed.
- **C1315 (mcp `execute_sql`):** `select (select count(*) from public.customers where deactivated_at is not null) + (select count(*) from public.sites where deactivated_at is not null) + (select count(*) from public.assets where deactivated_at is not null)` right after the migration returned `inactive_rows: 0`.
- **C1316 (mcp `get_advisors` security, 2026-11-03 17:35 UTC):** `rls_enabled_no_policy` outbox (1), `anon_security_definer_function_executable` automation_claim, automation_complete, portal_decide, portal_record_view, portal_view (5), `authenticated_security_definer_function_executable` the same five plus save_agreement_term and the new set_asset_active, set_customer_active, set_site_active (9), `auth_leaked_password_protection` (1). The only new findings are the three new writers.
- **C1318 (live, local build of `bb0efa2` on port 3201, one signed-in context):** Harbourview Towers edit page asked "Deactivate Harbourview Towers?" with "This withdraws AG-1048."; after Deactivate the site page showed "Inactive" with no New agreement, Add asset or Import, and the database had AG-1048 `withdrawn` with one `agreement.withdrawn` event `{from: sent, to: withdrawn, via: deactivation}` with an actor and one outbox row. Glacier Valley Warehouse 2 refused with "AG-1035 is in term until Nov 22, 2026, so this site can't be deactivated yet." Harbourview Towers Strata deactivated, `/customers` no longer listed it and `/customers?show=inactive` listed it with "Inactive" and counts 0 / 0. Reactivating the site first said "Reactivate Harbourview Towers Strata first."; after reactivating the customer and then the site, the site page offered New agreement, Add asset and Import again, and AG-1048 stayed withdrawn.
- **Settled mid-build:** (1) `create_agreement` first read the site `for share` before the role check, which answered a viewer `P0002` and failed agreement-builder C738; migration `20261103173437_deactivation_create_lock` moves the share lock after the role check (door 6's literal shape unchanged). (2) C1314's superseded set grew during the build, beyond the three it names: import_review C633 (the member delete now expects `42501`, and the FK keep-the-row half runs as the table owner), service_included C808 (the unit leaves the scope by `set_asset_active`, not a delete), the vitest C327 (asserts there is no delete action and that removing redirects to the site) and composition C340 (AssetStore declares no `delete`). Fixtures gained `active` fields and page tests pass `searchParams`.
- **Abandoned:** counting active assets with an embedded `count` filter in PostgREST; the readers read `deactivated_at` rows and count in the adapter instead, since the stub cannot prove a server-side filter.
