# P0 launch fixes verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 88017a0^..HEAD (88017a0, badb61f, fee4c5d, f86d906)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Reasons for FAIL (details below): (1) the database proofs C6001-C6008, C6012 (DB half) and C6021 passed once at the start of the run, then could not be re-run or mutated because the migration's objects appeared on the hosted project mid-run (not by this Verifier), so the replay now fails with `column "company_confirmed_at" ... already exists`; no DB fault was injected, which is the surface that carries 10 checks; (2) the live half of C6026 was not reproduced; (3) coverage gaps listed below.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| plan.md `Sources`: QA report 2026-11-16 | no - not in the repo, not marked binding | none found | - |
| plan.md `Sources`: `.specs/features/service-included/plan.md` | referenced only; the plan does not mark it binding | none found | - |
| design / mock | none - the plan marks no design source binding | n/a | no screen has a drawn arrangement to compare; structure of the Scope panel and send dialog is covered only by the author's own copy and button assertions (`components/agreements/scope-controls.test.ts:24-90`). Arrangement (what sits inside what) is asserted nowhere; recorded as a gap, not a contradiction, because no source decides it. |

## Checks

All vitest proofs run in one invocation from `web/` in PowerShell (34 files, 821 tests, 0 failed; each named test appeared in verbose output). DB recipe run once at the start: `PASS p0_launch_fixes, 1 passed, 0 failed`. Later runs fail on replay (see Gaps).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C6001 | scope = AHU, RTU; uncovered = 3 others with counts | test:db p0_launch_fixes (first run PASS) | `supabase/tests/p0_launch_fixes.sql:67-69` `tests.p0_codes(doc,'types') = array['AHU','RTU']`, uncovered `= array['BACKFLOW','BOILER','CHILLER']`, counts `= 1` | PASS (not re-runnable now) |
| C6002 | removing RTU coverage drops RTU; assets stay | same | `p0_launch_fixes.sql:92-94` types `= array['AHU']`; `count(*) ... = 2` | PASS (not re-runnable now) |
| C6003 | exclusion removes one asset, asset live, other agreement keeps it | same | `p0_launch_fixes.sql:106-108` RTU assets `= 1`, `deactivated_at is null`, other agreement `= 2` | PASS (not re-runnable now) |
| C6004 | re-include restores; double exclude = one row | same | `p0_launch_fixes.sql:115` `= 2`; `:120` `count(*) = 1` | PASS (not re-runnable now) |
| C6005 | snapshot types = draft scope, exclusion respected, no `uncovered` | same | `p0_launch_fixes.sql:128-132` snapshot `-> 'types' = shown`; `not (snapshot ? 'uncovered' or snapshot ? 'controls')`; `not like '%RTU-1%'` | PASS (not re-runnable now) |
| C6006 | not-current/non-draft version raises P0001, writes nothing | same | `p0_launch_fixes.sql:144-146` three `expect_error(... 'P0001')`; `:149` count `= 1` | PASS (not re-runnable now) |
| C6007 | viewer, other org, anon refused 42501 | same | `p0_launch_fixes.sql:154,156,158` `expect_error(... '42501')`; `:82` anon scope `42501`; `:162` nothing written | PASS (not re-runnable now) |
| C6008 | revise copies exclusions to v+1 | same | `p0_launch_fixes.sql:178` `array_agg(asset_id) = array[tests.id('p0r:R-1')]`; migration `20261116120000_p0_launch_fixes.sql:273` | PASS (not re-runnable now) |
| C6009 | no-line draft reads the empty-state sentence | `vitest components/agreements` exit 0 | `components/agreements/scope-controls.test.ts:47,54` `toContain("No equipment is covered until you add a service line.")` | PASS |
| C6010 | 3 uncovered, no flag -> `needs_confirmation`, nothing sent | vitest `sendAgreement.test.ts` exit 0 | `app/(app)/sendAgreement.test.ts:133-135` `toEqual({status:"needs_confirmation", uncovered: types})`, `send` not called | PASS |
| C6011 | with `confirmUncovered` send proceeds | same | `sendAgreement.test.ts:140-142` `status` `toBe("sent")`, `uncovered` not called | PASS |
| C6012 | frozen version read from snapshot; migration leaves snapshots unchanged | vitest `agreements.test.ts` exit 0; test:db first run | `infrastructure/supabase/agreements.test.ts:324` `source: "frozen"`; `supabase/tests/p0_launch_fixes.sql:188-190` snapshot `= '{...}'::jsonb` | PASS (DB half not re-runnable now) |
| C6013 | exclude/include buttons, nothing for viewer or frozen | vitest exit 0 | `scope-controls.test.ts:26-27` button regexes `Leave out`/`Include`; `:34` `not.toContain("<button")`; `:43` `toBe("")`; `agreements.test.ts:326` `scopeDraft` undefined for frozen | PASS |
| C6014 | each of 3 empties named | vitest exit 0 | `domain/org-settings/company-details.test.ts:13` `toEqual({ready:false, problems:[field]})` over 3 rows; `:17` all three | PASS |
| C6015 | real + unconfirmed -> `unconfirmed` | same | `company-details.test.ts:21` `problems:["unconfirmed"]` | PASS |
| C6016 | 4 placeholders refused; 3 real accepted | same | `company-details.test.ts:30` over 4 rows; `:34` `{ready:true}`; `:38` | PASS (see precision gap on the 3 ready values) |
| C6017 | unready company -> `company_unconfirmed`, nothing called | vitest `sendAgreement.test.ts` exit 0 | `sendAgreement.test.ts:152-156` `toEqual({status:"company_unconfirmed", problems})`; recipient, scope, send not called | PASS |
| C6018 | real save stamps now; placeholder leaves it out | vitest `settings.test.ts` exit 0 | `infrastructure/supabase/settings.test.ts:60-61` `toMatchObject({company_confirmed_at:"2026-10-24T12:00:00.000Z"})`; `:69` `not.toHaveProperty("company_confirmed_at")` | PASS |
| C6019 | dialog names failing details, links `/settings` | vitest exit 0 | `scope-controls.test.ts:70-72` `"Your company legal name, phone number"`, `href="/settings"` | PASS |
| C6020 | banner while unconfirmed/placeholder, not otherwise | vitest `settings/page.test.ts` exit 0 | `app/(app)/settings/page.test.ts:82` `toContain(BANNER)` x3; `:86` `not.toContain(BANNER)` | PASS |
| C6021 | backfill sets real org, leaves demo and empty-phone null | test:db first run | `p0_launch_fixes.sql:196-198` `is not null` / `is null` / `is null` | PASS (not re-runnable now) |
| C6022 | 3 paths not redirected, `/terms/x` is | vitest `session.test.ts` exit 0 | `infrastructure/supabase/session.test.ts:60` `headers.has("location") toBe(redirects)`, `:61` to `/login`; `session.ts:10` | PASS |
| C6023 | notice present, no "reviewed by a lawyer" | vitest `legal-pages.test.ts` exit 0 | `app/legal-pages.test.ts:22-24` `toContain("Starter text, pending review by a lawyer")`, two `not.toContain` | PASS |
| C6024 | footer links 3 pages | same | `legal-pages.test.ts:29` `arrayContaining(["/terms","/privacy","/security"])` | PASS |
| C6025 | `/register` links terms and privacy | same | `legal-pages.test.ts:34-36` `toContain('href="/terms"')`, `'href="/privacy"'`, order after checkout button | PASS |
| C6026 | `/security` names no region; no horizontal scroll at 3 widths | vitest `legal-pages.test.ts` exit 0; live run NOT reproduced | `legal-pages.test.ts:41-44` loop `not.toContain(region)` over 11 strings, `:45` `toContain("we have not yet confirmed")` | UNPROVEN (live half: author-reported only; AC 26 has no proof this Verifier saw) |

AC 25 ("only facts verified in the repo"): the `/security` copy claims DocuSeal signing, one-time-link sign-in, Stripe card handling and database isolation (`web/app/security/page.tsx:16-21`). DocuSeal and OTP sign-in exist in the repo (`infrastructure/documents/contract-pdf.tsx`, `infrastructure/supabase/auth.test.ts`); "audit log with signer time and network address" and "never store a card number" were not traced. No check asserts these claims; AC 25 is covered only by the region test.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| legal page statuses/pages (3) | plan Surface | terms/privacy/security each rendered in `legal-pages.test.ts:20` (table over 3) | - |
| `agreement_service_scope` outcomes (2) | plan Surface | 200 `p0_launch_fixes.sql:67`; anon `:82` | - |
| `set_scope_exclusion` outcomes (5 named; code raises 7 paths) | migration `:111-148` | 204 `:102`; 42501 `:154-158`; P0001 `:144-146`; re-include `:113`; plus P0002 `:147`, 23514 `:148` | none of the plan's 5; 401 via PostgREST is not testable in SQL (anon 42501 stands in) |
| scope paths on freeze (3) | plan Landing | line removed C6002; excluded C6005; frozen untouched C6012 | - |
| `companyDetailsReady` problems (4 values) | `company-details.ts:3` | legalName/address/phone `company-details.test.ts:13`; unconfirmed `:21` | - |
| placeholder patterns (4) | `company-details.ts:17-21` (`/kettle ridge/`, `/sample street/`, `/0a0$/`, `/555[-. ]?01\d\d/`) | `company-details.test.ts:30` rows 1-4 | - |
| new send outcomes (3) | plan Flow | C6010, C6011, C6017 | - |
| `agreement_scope_exclusions` entity (2) | plan Relations/Landing | unique pair `p0_launch_fixes.sql:120`; copy `:178` | **cascade on delete (version and asset) has no assertion anywhere** although checks.md cites C6008 for "cascade and copy"; C6008 asserts copy only |
| `company_confirmed_at` (2) | plan Landing | set on save C6018; backfill C6021 | - |
| `uncovered` never stored (1) | plan Landing | `p0_launch_fixes.sql:130` | - |
| scope function decision table (covered join, exclusion anti-join, uncovered, **inactive-asset filter**) | migration `:61-70` | join C6001; anti-join C6003; uncovered C6001; deactivated filter `a.deactivated_at is null` (`:68`) | **deactivated-asset filter has no assertion in this feature's tests** (grep `deactivated` in `supabase/tests/p0_launch_fixes.sql` hits only `:107`, which checks the excluded asset stays live). The Test policy demands one asserted case per row. A DB mutant on it could not be run. |
| startup config: public paths (2 places) | `session.ts:10`, `content.ts:26` read directly | session C6022; footer C6024 | - |
| `LINK_MESSAGES.company_unconfirmed` (`state.ts`) | diff | dialog renders its own copy in C6019 | n/a |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides (`companyDetailsReady`, scope function) | `domain/org-settings/company-details.ts`; `agreement_service_scope` in the migration | one at own layer; one case per decision row | company gate: yes (`company-details.test.ts:13-38`). scope function: own-layer proof exists (`p0_launch_fixes.sql`) but the inactive-asset row has no case - **no** |
| Entry point that decides nothing (legal pages) | `app/terms|privacy|security/page.tsx` | one at the boundary; each rendered page | yes (`legal-pages.test.ts:20` over all 3) |

## Faults injected

Isolated in a `git worktree` of HEAD; real-tree porcelain before and after identical (`?? node_modules/` only); worktree removed.

| Mutation | Location | Killed |
| --- | --- | --- |
| drop `confirmedAt === null` -> `unconfirmed` push | `web/domain/org-settings/company-details.ts:31` | yes - C6015 failed |
| skip the `confirmUncovered` check (`if (false)`) | `web/app/(app)/agreement-actions.ts` `sendAgreementAction` | yes - C6010 failed |
| always stamp `company_confirmed_at` | `web/infrastructure/supabase/settings.ts:62` | yes - C6018 (3 rows) failed |
| remove `/security` from `PUBLIC_PATHS` | `web/infrastructure/supabase/session.ts:10` | yes - C6022 `/security` failed |
| SQL: drop `not l.excluded`; SQL: drop `deactivated_at is null` | migration `:87`, `:68` | NOT RUN - the recipe could not replay because the migration objects now exist on the hosted project (`column "company_confirmed_at" ... already exists`). Neither mutant was observed. Inactive-asset mutant is predicted to survive (no assertion). |

## Gate

`npx vitest run` over 34 files (components/agreements, sendAgreement, agreements, company-details, settings, settings/page, session, legal-pages, domain/agreement) - 821 passed, 0 failed.
`npm run test:db p0_launch_fixes` - first run 1 passed, 0 failed; later runs FAIL on replay because the hosted project now holds the migration (confirmed read-only: column, table and both functions present; `list_migrations` does not list it). This Verifier never applied it.

## Gaps and findings (ranked)

1. DB proofs were reproduced once only and no DB mutant could be injected; 10 checks (C6001-C6008, C6012, C6021) rest on a single run. The recipe is no longer replayable on this project state; it needs the migration-already-applied case handled or a scratch database.
2. C6026 live half (AC 26, no horizontal scroll at 375/768/1440) not reproduced by the Verifier; author-reported only.
3. Coverage gap: cascade delete of `agreement_scope_exclusions` (both FKs) has no proof; checks.md row cites C6008 wrongly.
4. Coverage gap and likely surviving mutant: inactive-asset filter in `agreement_service_scope` unasserted.
5. AC 25 content of `/security` (audit log fields, card handling) is unasserted and not traced; only the region is tested.
6. Precision gap: C6016 names `12 Main St, Surrey, BC V3T 1A1` and `Acme Heating Ltd.` as ready values, but the test's ready case at `company-details.test.ts:34` uses the shared REAL object (same values, ok) while AC 17's owner/admin role restriction on stamping has no check (settings role gating is pre-existing in `settings/actions.ts`, not asserted for this stamp).
7. Arrangement of the Scope panel and send dialog is unchecked (no binding design); stated as a note.
8. Pre-existing failures not counted: none appeared in the files run (the listed unrelated suites were not in scope of the batch).
