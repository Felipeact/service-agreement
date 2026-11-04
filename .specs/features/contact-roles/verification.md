# Contact roles verification

**Verdict**: PASS
**Profile**: light
**Diff range**: cacbf4e..176854c
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

No binding design sources (plan.md Sources are ROADMAP/CONTEXT prose only); step 1, Coverage fault injection and Test policy are not run under `light`. Coverage is recomputed anyway below.

## Checks

Vitest proof (one call, all 23 named tests listed individually as passed, `23 passed | 281 skipped`, exit 0):
`npx vitest run domain/records/records.test.ts infrastructure/supabase/records.test.ts infrastructure/supabase/readers.test.ts components/customers/customers.test.ts components/sites/sites.test.ts components/records/records.test.ts "app/(app)/record-forms.test.ts" -t "C14(4[0-9]|5[0-9]|6[0-2]):"`.
SQL proof (one call): `npm run test:db contact_roles outbox_dispatch` - `PASS contact_roles`, `PASS outbox_dispatch`, `2 passed, 0 failed`, exit 0. The runner reports per recipe, not per assertion; the recipe fails on any false `tests.ok`, so each cited line below ran and held.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1440 | approver among allowed ids kept | vitest `-t "C1440:"` ran, passed | `web/domain/records/records.test.ts:152` - `validateSite({...site, approverContactId: APPROVER}, [APPROVER, OTHER])` `toMatchObject` approver kept | PASS |
| C1441 | blank approver -> null | vitest ran, passed | `web/domain/records/records.test.ts:159` - `toMatchObject({ ok: true, value: { approverContactId: null } })` | PASS |
| C1442 | foreign approver refused with message | vitest ran, passed | `web/domain/records/records.test.ts:163` - `toEqual({ ok: false, errors: { approverContactId: REFUSED } })` | PASS |
| C1443 | billing contact kept | vitest ran, passed | `web/domain/records/records.test.ts:167` - `validateCustomer({name, billingContactId: APPROVER}, [APPROVER])` `toEqual` | PASS |
| C1444 | blank billing -> null | vitest ran, passed | `web/domain/records/records.test.ts:174` - `validateCustomer({name, billingContactId: ""}, ...)` `toEqual` | PASS |
| C1445 | foreign billing refused | vitest ran, passed | `web/domain/records/records.test.ts:181` - `toEqual` with `billingContactId` error | PASS |
| C1446 | site update sends exactly 4 fields | vitest ran, passed | `web/infrastructure/supabase/records.test.ts:185` - `toEqual({ name: "Tower A", address: null, site_contact_id: PARENT, approver_contact_id: ID })`; `:186` eq id | PASS |
| C1447 | site insert carries org, customer, 4 fields | vitest ran, passed | `web/infrastructure/supabase/records.test.ts:193` - `calls.find(insert).args[0]` `toEqual({...})` | PASS |
| C1448 | customer update exactly name + billing | vitest ran, passed | `web/infrastructure/supabase/records.test.ts:207` - `toEqual({ name: "Acme", billing_contact_id: PARENT })` | PASS |
| C1449 | customer insert only org_id, name | vitest ran, passed | `web/infrastructure/supabase/records.test.ts:215` - `toEqual({ org_id: ORG, name: "Acme" })` | PASS |
| C1450 | reader returns roles per contact | vitest ran, passed | `web/infrastructure/supabase/readers.test.ts:819` - `toEqual([{ kind: "billing" }, { kind: "approver", site: "Late site" }])`; `:820` site role | PASS |
| C1451 | site reader approver id/name, null when none | vitest ran, passed | `web/infrastructure/supabase/readers.test.ts:841` `toMatchObject({ approverContactId: "c2", approverName: "Avery", ...})`; `:843` nulls | PASS |
| C1452 | `Billing` beside billing contact | vitest ran, passed | `web/components/customers/customers.test.ts:275` - `toMatch(/Avery[\s\S]*>Billing</)` | PASS |
| C1453 | `Approver · <site>` and `Site · <site>` | vitest ran, passed | `web/components/customers/customers.test.ts:288-289` - `toContain("Approver · Tower A")`, `toContain("Site · Tower B")` | PASS |
| C1454 | no role -> no labels | vitest ran, passed | `web/components/customers/customers.test.ts:294` - `not.toContain(label)` for `Billing`, `Approver ·`, `Site ·` | PASS |
| C1455 | viewer: labels, no Add contact, no edit link | vitest ran, passed | `web/components/customers/customers.test.ts:299-301` - `toContain(">Billing<")`, `not.toContain("Add contact")`, `not.toContain("/contacts/")` | PASS |
| C1456 | register `Approver: <name>` / `Approver: -` | vitest ran, passed | `web/components/sites/sites.test.ts:256-257` - `toContain("Approver: Avery Chen")`, `toMatch(/Approver: (<span[^>]*>)?-/)` | PASS |
| C1457 | Approver select, No approver first, contacts, saved selected | vitest ran, passed | `web/components/records/records.test.ts:260` `options(out,"approverContactId")` `toEqual([...])`; `:265` `name="approverContactId"` | PASS |
| C1458 | no contacts -> only No approver | vitest ran, passed | `web/components/records/records.test.ts:269` - `toEqual([{ value: "", selected: true, text: "No approver" }])` | PASS |
| C1459 | error message under Approver | vitest ran, passed | `web/components/records/records.test.ts:277` - `<p id="approverContactId-error">${message}</p>`; `:276` aria-invalid | PASS |
| C1460 | Billing contact select; none given -> none | vitest ran, passed | `web/components/records/records.test.ts:284` options `toEqual`; `:289` select name; `:292` `not.toContain("billingContactId")` | PASS |
| C1461 | foreign approver -> invalid, no store call | vitest ran, passed | `web/app/(app)/record-forms.test.ts:418` `updateSiteAction(...)` `toEqual({...invalid...})`; `:423` `expect(storeCalls()).toBe(0)` | PASS |
| C1462 | foreign billing -> invalid, no store call | vitest ran, passed | `web/app/(app)/record-forms.test.ts:427` `toEqual({...})`; `:432` `expect(storeCalls()).toBe(0)` | PASS |
| C1463 | both FKs store same-customer, refuse foreign with 23503 | `test:db contact_roles` PASS | `supabase/tests/contact_roles.sql:31` stored; `:33-34` `expect_error(..., '23503')` site approver of ct2A (other customer); `:36` stored; `:38-39` `expect_error(..., '23503')` billing of ct2A. Crosses the real composite FK (UPDATE on the real tables) | PASS |
| C1464 | delete of approver / billing contact refused 23503, rows remain | `test:db contact_roles` PASS | `supabase/tests/contact_roles.sql:50` `expect_error('C1464 approver', delete ..., '23503')`; `:51` billing 23503; `:52-53` `count = 2` | PASS |
| C1465 | estimator sets both; viewer changes no row | `test:db contact_roles` PASS | `supabase/tests/contact_roles.sql:61-62` `expect_rows(..., 1)` site; `:63-64` customer `1`; `:70` viewer site `0`; `:71` viewer customer `0`; `:77` values unchanged | PASS |
| C1466 | resolver, six cases | `test:db contact_roles` PASS | `supabase/tests/contact_roles.sql:90` both emails = approver (padded `'  ap@customer.ca  '` trimmed); `:92` approver only; `:93` blank approver -> `sc@`; `:94` no approver -> `sc@`; `:95` neither `is null`; `:96` both blank `is null` | PASS |
| C1467 | anon / authenticated cannot execute resolver | `test:db contact_roles` PASS | `supabase/tests/contact_roles.sql:102` `not has_function_privilege('anon', ..., 'execute')`; `:103` authenticated | PASS |
| C1468 | link email to approver (site contact also has an email) | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1305` `tests.ok('C1468', l ->> 'decision'='send' and tests.od_msg(l) -> 'to' = '["approver@customer.ca"]')`; site contact `site@customer.ca` set at the `od_sent('cr68', ...)` fixture, so approver-over-site precedence is genuinely discriminated | PASS |
| C1469 | day-3 reminder to approver | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1306` `to = '["approver@customer.ca"]'` on the `day3` claim, same two-email fixture | PASS |
| C1470 | renewal notice to approver | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1363` `mine ->> 'kind' = 'customer_renewal' and mine -> 'to' = '["approver@customer.ca"]'`; `od_due('cr70')` defaults the site contact to `pat@customer.ca` (`:842`), so a site-contact-first implementation would fail | PASS |
| C1471 | link + reminder fall back to site contact (no approver, blank-email approver) | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1326` link `to = '["site@customer.ca"]'`; `:1327` reminder; loops `cr71a` (no approver) and `cr71b` (approver email `'  '`) | PASS |
| C1472 | renewal fallback to site contact | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1365` `to = '["site@customer.ca"]'` for `AG-cr72` (no approver) | PASS |
| C1473 | neither has email -> skipped `no_recipient`, no message | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1341` link and day3: `decision = 'skip' and reason = 'no_recipient' and jsonb_array_length(messages) = 0 and skip_reason = 'no_recipient'`; `:1367` renewal `status = 'skipped' and skip_reason = 'no_recipient'` and absent from messages | PASS |
| C1474 | exactly one recipient, the approver's | `test:db outbox_dispatch` PASS | `supabase/tests/outbox_dispatch.sql:1307` link `recipients = array['approver@customer.ca']`; `:1309` reminder (stored row, both contacts have emails). Renewal row not asserted (C1474 text names "the notification row" generally; plan AC 11 covers all three) - see Gaps | PASS |
| C1475 | existing outbox_dispatch behaviour unchanged | `npm run test:db outbox_dispatch` exit 0 `PASS outbox_dispatch` | whole recipe, which still ends `select 'outbox_dispatch: pass'` (`supabase/tests/outbox_dispatch.sql` last lines); diff to that file is append-only (86 insertions, 0 deletions) | PASS |
| C1476 | types compile, lint clean, tests green | `npx tsc --noEmit` exit 0 (no output); `npm run lint` exit 0 (eslint, no output); `npm test` not re-run in full, but the 7 touched vitest files ran above | tsc/lint output, exit 0 | PASS |
| C1477 | live: demo owner sets approver / billing, labels shown, no console errors, 375/768/1440 | not redone, per brief; recorded in checks.md Handoff by the author | `.specs/features/contact-roles/checks.md:221` is specific (Brookhaven Community Centre; Hannah Okafor; `No billing contact` / `No approver` options; `Billing`, `Site · ...`, `Approver: Hannah Okafor`, `Approver · Brookhaven Community Centre` shown; scrollWidth = clientWidth; 44 px / 34 px controls; console clean; roles reset) and consistent with the code (`site-form.tsx:43-47` Approver select; `Approver: ` header C1456; labels C1453). **Author-recorded, not independently re-run** | PASS (author-recorded) |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Landing door 1: two role FKs (2) | migration `20261104203234_contact_roles.sql:7,11` | `sites_approver_contact_fkey` C1463 `:33`, C1464 `:50`; `customers_billing_contact_fkey` C1463 `:38`, C1464 `:51` | - |
| Landing door 2: resolver (1) | migration `:20-33` | behaviour C1466, grants C1467 `:102-103` | - |
| Landing door 3: three customer-to-contact embeds | plan Landing; `readers.test.ts:850-858` | named FK hint pinned by the unnumbered test "every query that embeds a customer's contacts names the foreign key" (`readers.test.ts:850`); not a numbered check, but it exists and is covered by the author-added test | - |
| Relations edges (4) | plan Relations | customers-contacts has C1463; billing C1463/C1464; site contact existing; approver C1463/C1464 | - |
| resolution cases (6) | plan/C1466 | `contact_roles.sql:90,92,93,94,95,96` | - |
| customer-addressed kinds (3) | `customer_link`, `customer_reminder`, `customer_renewal` | C1468 `:1305`, C1469 `:1306`, C1470 `:1363` | - |
| fallback / skip per kind (6) | checks Coverage | link/reminder fallback C1471 `:1326-1327`; renewal fallback C1472 `:1365`; skip link/reminder C1473 `:1341`; skip renewal `:1367` | - |
| role validation outcomes (6) | domain | C1440-C1445 | - |
| roles shown (3), role selects (2), viewer/writer (2) | views | C1452/C1453, C1457/C1460, C1455/C1457 | - |
| live definitions inline-join sweep | migration grep | `automation_claim` (`:118`, resolver call `:263`) and `claim_renewals` (`:36`, resolver call `:76`) both call `private.customer_recipient`; the only `site_contact_id` join left in the migration is inside the resolver (`:30`) | - |

## Test policy rows

No `Test policy` section in checks.md; nothing to judge.

## Faults injected

Not run: `light` profile skips fault injection. The brief's named concern was checked by reading instead: C1468-C1470 fixtures give the site contact an email as well, so a wrong implementation that picks the site contact first would fail them; the C1463/C1464 assertions run `UPDATE`/`DELETE` against the real tables and the real composite FKs (`23503`).

## Swept existing

- AC 5 "existing delete-refused message": `web/infrastructure/supabase/records.ts:30` maps `23503` on delete to `in_use`; pinned by `records.test.ts:91-93` (C334). The constraint and message path exist.
- data lifecycle "existing sites keep emailing the site contact": resolver falls back to `site_contact_id` (migration `:29-31`), C1471 `cr71a` proves it. Holds.

## Gaps (non-blocking, do not change the verdict)

1. C1474 is proven for link and reminder only; the renewal notice's single-recipient shape is asserted by C1470's `to = [approver]` (one element) but not by a stored `notifications.recipients` read.
2. Door 3 (named embeds) has an unnumbered test, not a check; the plan lists it as a one-way door but checks.md has no `C14xx` for it.
3. SQL runner reports per recipe; per-assertion execution is inferred from the recipe's fail-on-any-false behaviour.
4. C1477 not independently re-run (as instructed).

## Gate

`npx vitest run <7 files> -t "C14(4[0-9]|5[0-9]|6[0-2]):"` - 23 passed, 0 failed; `npm run test:db contact_roles outbox_dispatch` - 2 passed, 0 failed; `npx tsc --noEmit` exit 0; `npm run lint` exit 0.
