# P0 launch fixes checks

Profile: ui
Plan: `.specs/features/p0-launch-fixes/plan.md`

26 checks in 3 slices · 3 one-way doors · 3 open, of which 2 block go-live

## How proofs run

- **vitest** - run from `web/` in PowerShell (`npx vitest run <file> -t "<id>:"`). Every test name starts with its check id and a colon.
- **test:db** - `npm run test:db p0_launch_fixes` in `web/` runs `fixture.sql` then `supabase/tests/p0_launch_fixes.sql`, rolled back. It needs the migration applied to the project that `SUPABASE_DB_URL` points at, which needs the owner's go-ahead.
- **live** - Playwright MCP on `npm run dev`, one signed-in context. Not committed.

Terms: "the scope function" is `public.agreement_service_scope`; "the exclusion RPC" is `public.set_scope_exclusion`; "the gate" is `companyDetailsReady` in `web/domain/org-settings`.

## Checks

### S1 - Scope follows the priced lines

**C6001** - With lines covering `AHU` and `RTU` on a site that also has `BOILER`, `CHILLER` and `BACKFLOW` assets, the scope function returns exactly the `AHU` and `RTU` types, and `uncovered` lists the other 3 with their asset counts (AC 1, AC 2, door 1)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6001`)

**C6002** - Removing `RTU` from the line's coverage drops `RTU` from the scope and the RTU asset rows stay (AC 3)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6002`)

**C6003** - `set_scope_exclusion(version, asset, true)` by `uE` removes that one asset from the scope; the asset row stays with `deactivated_at` null, and another agreement's scope still lists it (AC 4, door 2)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6003`)

**C6004** - `set_scope_exclusion(version, asset, false)` puts the asset back in the scope, and excluding twice leaves one row (AC 5)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6004`)

**C6005** - After `apply_agreement_transition` sends the draft, the snapshot `types` equal the last scope the draft showed, the exclusion is respected, and the snapshot has no `uncovered` key (AC 6, door 1)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6005`)

**C6006** - `set_scope_exclusion` on a version that is not the current version of a draft raises `P0001` and writes no row (AC 7)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6006`)

**C6007** - `set_scope_exclusion` by viewer `uV` and by org B's owner raises `42501` and writes no row; an anonymous call is refused with `42501` (AC 8)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6007`)

**C6008** - Revising a `changes_requested` agreement copies its exclusion rows to version n+1 (AC 9)
Proof: `npm run test:db p0_launch_fixes` (assertions `C6008`)

**C6009** - A draft with no line shows `No equipment is covered until you add a service line` and no type (AC 10)
Proof: `npx vitest run components/agreements -t "C6009:"`

**C6010** - `sendAgreementAction` on a site with 3 uncovered types and no `confirmUncovered` returns `{status: "needs_confirmation", uncovered: [{name, assetCount} x3]}` and does not send (AC 11)
Proof: `npx vitest run "app/(app)/sendAgreement.test.ts" -t "C6010:"`

**C6011** - With `confirmUncovered` true the same send proceeds and returns `sent` (AC 12)
Proof: `npx vitest run "app/(app)/sendAgreement.test.ts" -t "C6011:"`

**C6012** - A version that is already frozen is read from its stored snapshot with `source: "frozen"`, and the migration leaves every existing snapshot byte-for-byte unchanged (AC 13)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C6012:"`
Proof: pre-apply replay, run once on 2026-11-16 before the owner applied the migration (a snapshot written before the migration was unchanged after it); not repeatable now the migration is applied

**C6013** - The Scope control renders an exclude button per asset on a draft, an include button for an excluded one, and nothing editable for a viewer or a frozen version (AC 4, AC 5, AC 8)
Proof: `npx vitest run components/agreements -t "C6013:"`

### S2 - Company details gate

**C6014** - `companyDetailsReady` returns not ready naming `legalName`, `address` or `phone` for each of 3 empty values, table-driven over all 3 (AC 14)
Proof: `npx vitest run domain/org-settings/company-details.test.ts -t "C6014:"`

**C6015** - `companyDetailsReady` with real values and `confirmedAt` null returns not ready, problem `unconfirmed` (AC 15)
Proof: `npx vitest run domain/org-settings/company-details.test.ts -t "C6015:"`

**C6016** - With `confirmedAt` set, `companyDetailsReady` returns not ready for each of 4 placeholders: legal name `Kettle Ridge Mechanical Ltd.`, address `100 Sample Street, Burnaby, BC V5A 0A0`, address `12 Main St, Burnaby, BC V5A 0A0`, phone `604-555-0100`; and returns ready for `Acme Heating Ltd.`, `12 Main St, Surrey, BC V3T 1A1`, `604-555-2368` (AC 16)
Proof: `npx vitest run domain/org-settings/company-details.test.ts -t "C6016:"`

**C6017** - `sendAgreementAction` with an unready company returns `{status: "company_unconfirmed", problems}` and calls neither the recipient store nor `sendAgreement` (AC 14, AC 15, AC 16)
Proof: `npx vitest run "app/(app)/sendAgreement.test.ts" -t "C6017:"`

**C6018** - `saveSettingsAction` with real values saves with `confirmedAt` set to the clock's now; with a placeholder value it saves the other fields and leaves `confirmedAt` out of the update (AC 17)
Proof: `npx vitest run infrastructure/supabase/settings.test.ts -t "C6018:"`
Proof: `npm run test:db p0_launch_fixes` (assertions `C6018`, only an owner or admin can stamp it)

**C6019** - The send dialog shows, for `company_unconfirmed`, the names of the failing details and a link to `/settings` (AC 18)
Proof: `npx vitest run components/agreements -t "C6019:"`

**C6020** - The settings page shows `Confirm your company details before you send agreements` while unconfirmed or placeholder-shaped, and not otherwise (AC 19)
Proof: `npx vitest run "app/(app)/settings/page.test.ts" -t "C6020:"`

**C6021** - The migration sets `company_confirmed_at` for an org with real values and leaves it null for the demo org and for an org with an empty phone (AC 20)
Proof: pre-apply replay, run once on 2026-11-16 (real org confirmed, demo-shaped and phoneless orgs left null); on the hosted project the demo org reads `company_confirmed_at` null after the apply


### S3 - Public legal pages

**C6022** - A signed-out request to `/terms`, `/privacy` and `/security` is not redirected, and `/terms/x` still is (AC 21)
Proof: `npx vitest run infrastructure/supabase/session.test.ts -t "C6022:"`

**C6023** - Each page renders `Starter text, pending review by a lawyer` and no string `lawyer-reviewed` or `reviewed by a lawyer` (AC 22)
Proof: `npx vitest run app/legal-pages.test.ts -t "C6023:"`

**C6024** - The site footer links `/terms`, `/privacy` and `/security` (AC 23)
Proof: `npx vitest run app/legal-pages.test.ts -t "C6024:"`

**C6025** - `/register` renders links to `/terms` and `/privacy` (AC 24)
Proof: `npx vitest run app/legal-pages.test.ts -t "C6025:"`

**C6026** - `/security` names no hosting region while open question 1 is unanswered, and a live run of the three pages at 375x812, 768x1024 and 1440x900 has no horizontal scroll (AC 25, AC 26)
Proof: `npx vitest run app/legal-pages.test.ts -t "C6026:"`
(also asserts each factual claim on /security has its source file in the repo)
Proof: live Playwright run at 375x812, 768x1024, 1440x900

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /terms` `/privacy` `/security` statuses (1) | `200` C6022 · C6023 | - |
| `/rest/v1/rpc/agreement_service_scope` statuses (2) | `200` C6001 · `401` anon C6007 | - |
| `/rest/v1/rpc/set_scope_exclusion` statuses (5) | `204` C6003 · `401` anon C6007 · `42501` C6007 · `P0001` C6006 · re-include C6004 | - |
| scope paths on freeze (3) | line removed C6002 · asset excluded C6005 · frozen untouched C6012 | - |
| `companyDetailsReady` problems (5) | legalName C6014 · address C6014 · phone C6014 · unconfirmed C6015 · placeholder C6016 | - |
| placeholder patterns (4) | `Kettle Ridge` C6016 · `Sample Street` C6016 · `0A0` C6016 · `555-01\d\d` C6016 | - |
| new send outcomes (3) | `needs_confirmation` C6010 · confirmed send C6011 · `company_unconfirmed` C6017 | - |
| entity `agreement_scope_exclusions` (2) | unique pair C6004 · cascade and copy C6008 | - |
| entity `org_settings.company_confirmed_at` (2) | set on save C6018 · backfill C6021 | - |
| door 1 `uncovered` never stored (1) | C6005 | - |
| legal pages (3) | terms C6023 · privacy C6023 · security C6026 | - |
| startup config: public paths (2 places) | `session.ts` C6022 · footer links C6024 | - |

- Claims naming a status, route or response shape: C6001, C6006, C6007, C6010, C6017, C6022 - each has a proof that crosses the boundary
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides (`companyDetailsReady`, the scope function) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing (legal pages) | one at the boundary | each rendered page |

Evidence:

- `domain/org-settings/company-details.ts` (new): 3 empties, 1 unconfirmed, 4 placeholder patterns -> decides
- `agreement_service_scope`: covered-type join, exclusion anti-join, uncovered list -> decides
- closest analogue in the repo: `domain/org-settings/logo.test.ts`, a pure rule proven with a table

Cost: 3 proofs at their own layer.

## Swept

- validation: C6014, C6016
- failure modes: C6006, C6017
- idempotency: C6004
- authorization: C6007
- concurrency: n/a - exclusions are an idempotent toggle on a primary key, and the draft transition is already a compare-and-set
- data lifecycle: C6008, C6012
- dependency failure: existing - sendAgreementAction already maps a thrown store call to `unavailable`
- state transitions: C6005, C6006
- observability: n/a - no logging requirement in these slices

## Handoff

- S1 ~ 14 files ~ 60k; S2 ~ 8 files ~ 25k; S3 ~ 8 files ~ 20k; total ~105k, under the 150k budget - one builder
- Mechanism: one builder
