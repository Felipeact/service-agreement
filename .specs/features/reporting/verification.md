# Reporting verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: a0d2ea6..HEAD (c702243)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Summary: every code and database proof that exists is green at HEAD and 5 of 5 injected faults were killed. The verdict is FAIL for four reasons that are not test failures: C5751 was not run (Unproven), one binding source contradicts the checks (ROADMAP revenue breakdown "filterable by date range" vs AC 11 as of today), AC 8's "grouped by outcome" has no check and the screen does not group, and several screen elements the design/plan decides have no selector check (see Binding sources).

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md "Reporting" (lines 220-236) | yes, read in full | "Revenue breakdown: by customer and by serviced-item type, filterable by date range" vs AC 11 / C5709 / C5710, which make both revenue reports "as of today" with no range (`report_revenue_by_customer()` and `report_revenue_by_type()` take no dates, `reports.sql:197`, `reports-view.tsx:305-322`). ROADMAP was not amended in the diff, so the binding source and the amended plan disagree. Needs the owner to either edit ROADMAP or restore the range | ROADMAP "Losses ... grouped by reason" and plan AC 8 "grouped by outcome": the screen is one flat list newest first (`reports-view.tsx:191-202`, SQL `order by ev.at desc`, `reports.sql:215`); C5707 asserts "newest first" (`reports.sql:141`) and nothing asserts grouping, so AC 8's grouping has neither code nor check. ROADMAP "Automatic renewals ... shown separately": no plan criterion, no check, nothing on screen (they are only left out of win rate and the stuck list) |
| ROADMAP decisions 17 to 19 (lines 370-372) | yes | none | - |
| plan Sources, Surface, Landing (4 doors) | yes | Landing door 1 says money functions guard with `private.has_org_role`; the migration uses its own `private.report_org` / `private.report_money` (`20261115110000_reports.sql:12-44`). Behaviour matches the roles but the literal shape in the plan differs. Recorded as a plan/code mismatch, not counted as a contradiction because C5711/C5712 prove the role outcome | - |
| AGENTS..md web validation (lines 25-41) | yes | none statically: buttons are `h-11 lg:h-[34px]` (`components/ui/button.tsx:13`), inputs `h-11 lg:h-[34px]` (`text-input.tsx:23`), agreement links `min-h-11 lg:min-h-0` (`reports-view.tsx:95`), no fixed widths over `w-44`, no `overflow-x`, `break-words` on stats | The live pass (375/768/1440, 44 px targets, console) is C5751, not run. Only a browser can settle real overflow of the `w-44`/`w-24` label spans plus wrapped rows at 375 px, the 44 px result of the date inputs, and the funnel bar rendering |
| DESIGN.md / PRODUCT.md | yes (shell, control height, empty panel, tables) | none. DESIGN.md's sidebar list (line 214) still names Pipeline ... Task library and has no Reports item or screen section, a stale doc, not a contradiction | Per-screen enumeration below |

### Per-screen enumeration, `/reports` (what a selector reaches, and whether a check pins it)

| Element or arrangement | Checked by | Gap |
| --- | --- | --- |
| Page title "Reports", subtitle range | none | gap (no assertion on title or subtitle) |
| Range form: From, To date inputs, "Apply range", "Last 12 months" link | none (`page.test.tsx` never asserts the form) | gap: AC 18's fallback is only proven through the `from=banana` param, not the control |
| Notice line for a bad range | `page.test.tsx:131-134` (`That date range was not valid`) | none |
| Sections in order Headline, Funnel, Speed and stuck deals, Lost deals, Renewals due, Revenue by customer, Revenue by type | headings present only (`page.test.tsx:77-81`), order not asserted | gap: order/arrangement unpinned |
| Four headline stats and their notes | text for revenue, 50%, 4.0 days (`page.test.tsx:77-80`); pipeline value and the "a year" notes not asserted | partial gap |
| Funnel: four rows, bar, count, value, drop-off | "No agreements at this stage" only (`page.test.tsx:122-125`); the 50% drop text and the bar are not asserted | gap |
| Stuck list: ten rows, each linking to `/agreements/{id}` (AC 7) | none (`grep "agreements/"` in the page test finds nothing) | gap |
| Losses: outcome labels, reason line, link (AC 8) | none for outcome labels, `Reason: Price`, or the link | gap |
| Renewals: three bucket headings | `page.test.tsx:143-148` | none; "Needs negotiation" and links unasserted |
| Revenue tables: "a year" values largest first | nothing asserts the rendering of either revenue table | gap |
| A Download CSV link per table | `page.test.tsx:80-81` (six hrefs with from/to) | none |
| Empty state: one panel, New agreement link to `/agreements`, no table | `page.test.tsx:101-107` | none |
| Estimator: no `$`, no Revenue, no Headline | `page.test.tsx:92-96` | none |
| Loading skeleton | `loading.tsx` exists; no check (plan marks it existing pattern) | none required |
| Regions: one column of full-width panels, headline grid 1/2/4 columns | none | arrangement unpinned; only a browser can settle it (C5751) |

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5701 | Recurring revenue 119999 | `npm run test:db reports` exit 0, `PASS reports` | `supabase/tests/reports.sql:73` `h.recurring_cents = 119999` | PASS |
| C5702 | Pipeline counts sent and accepted-not-in-term, in-term zero times | same run | `reports.sql:75` `h.pipeline_cents = 239998` (rpSent + rpFut; rpIn, rpAcc, rpRen excluded) | PASS |
| C5703 | accepted 1, refused 1, expired 1; renewed adds 0 | same run; fault F1 turned it red | `reports.sql:76` `h.accepted_n = 1`, `:77`, `:78`, `:83` | PASS |
| C5704 | Average days to sign 4.0, null when none | same run | `reports.sql:80` `h.avg_days_to_sign = 4.0`, `:82` `n.avg_days_to_sign is null and n.signed_n = 0` | PASS |
| C5705 | Four rows, each by its own event date, inside the range only | same run | `reports.sql:94` `got = 'created:4:479996 sent:2:239998 accepted:2:239998 signed:1:119999'`, `:96` empty range four zero rows | PASS |
| C5706 | Three medians, at most ten stuck oldest first, none finished | same run | `reports.sql:112` medians string, `:123` `cnt = 10`, `:124` `first_id = tests.id('rpSt7')`, `:126-128` | PASS |
| C5707 | One row per refused, expired, withdrawn; reason Price, expired null | same run | `reports.sql:140` `got = 'withdrawn=Customer left=119999 expired=null=119999 refused=Price=119999'` | PASS |
| C5708 | 30 in bucket 30, 31 in bucket 60, 91 absent, auto only below threshold | same run | `reports.sql:234` `got = 'AG-rpR30=30 AG-rpR31=60 AG-rpR60=60 AG-rpR61=90 AG-rpR90=90'`, `:235`, `:236`, `:240`, `:244` | PASS |
| C5709 | Customers largest first, ties by name, in-term only | same run | `reports.sql:200` `got = expected \|\| '=139998 Alpha Co=119999 Beta Co=119999'` | PASS |
| C5710 | 19999 line splits 10000 and 9999, total equals recurring | same run | `reports.sql:201` `= 10000`, `:202` `= 9999`, `:204` `total = 379996` and equals headline | PASS |
| C5711 | Viewer and non-member get 42501 from each of seven functions | same run | `reports.sql:265` `tests.expect_error(... , c, '42501')` looped over 7 calls and uV, uX (`:251-267`) | PASS |
| C5712 | Estimator 42501 on headline and two revenue; null money elsewhere | same run | `reports.sql:275-277` three `expect_error ... '42501'`, `:278` funnel `value_cents is null` x4, `:281-282` losses, `:283-284` renewals. Precision gap: the claim lists aging with null `value_cents`, but `report_aging` has no money column and `:280` only counts 3 medians | PASS |
| C5713 | Org B appears in none of org A's results | same run | `reports.sql:165-167` no org B loss, no org B customer, headline still 119999 | PASS |
| C5714 | Canceled-billing org still reads the headline | same run | `reports.sql:294` `recurring_cents ... > 0` after `status 'canceled'` (`:291-292`) | PASS |
| C5715 | 2030-07-02 03:00 UTC counted on 07-01 not 07-02 (door 2) | same run; fault F2 turned it red | `reports.sql:156` `on_first = 1`, `:157` `on_second = 0` | PASS |
| C5716 | Empty org: zeros and four funnel rows | same run | `reports.sql:308` zeros, `:310` `got = 'created:0:0 sent:0:0 accepted:0:0 signed:0:0'` | PASS |
| C5721 | parseReportRange default, given, from>to, banana | `npx vitest run domain/reports ...` 7 files, 137 passed | `domain/reports/reports.test.ts:8` `toEqual({ range: { from: "2026-06-16", to: "2027-06-15" }, notice: null })`, `:12`, `:16-18`, `:21-24` | PASS |
| C5722 | winRate "No decisions yet", 50% | same run | `reports.test.ts:34` `.toBe("No decisions yet")`, `:38` `.toBe("50%")` | PASS |
| C5723 | signLabel null and 4.0 days | same run | `reports.test.ts:46-47` `"No signed contracts yet"`, `"4.0 days"` | PASS |
| C5724 | dropOff 0%, 50%, no division by zero | same run | `reports.test.ts:54` `toEqual([0, 50])`, `:58-59` zeros and `[0, 100, 0]` | PASS |
| C5725 | toCsv header, 1199.99, quoting, doubled quote, formula prefix | same run | `reports.test.ts:71` `"Customer,Value,Ends\r\nAcme,1199.99,2027-03-31\r\n"`, `:79`, `:83` per `=`,`+`,`-`,`@`. Note: dates are passed through as given strings; no date formatting is tested at this layer | PASS |
| C5726 | reportAccess money, operational, none | same run | `reports.test.ts:97` `expect(reportAccess(role)).toBe(access)` over 4 roles, `:102` unknown role none | PASS |
| C5731 | Adapter calls each rpc with p_from/p_to, 42501 forbidden, else unavailable | same run; fault F4 turned it red | `infrastructure/supabase/reports.test.ts:26` `toHaveBeenCalledWith("report_headline", ARGS)`, `:52`, `:70`, `:82`, `:92-100`, `:105-106` forbidden, `:112` unavailable | PASS |
| C5741 | Export statuses 200, 400, 401, 403, 503 | same run; fault F3 turned it red | `app/(app)/reports/export/route.test.ts:32` `status).toBe(200)`, `:51` 400 key, `:55` 400 date, `:61` 401, `:73` viewer 403, `:79` estimator 403, `:101` 503, `:103` 403 | PASS |
| C5742 | Page: viewer redirect, estimator no `$`, one empty state, failed section | same run; fault F5 turned it red | `app/(app)/reports/page.test.tsx:67` `rejects.toThrow("NEXT_REDIRECT /pipeline")`, `:96` `not.toContain("$")`, `:103` `Nothing to report yet`, `:113` `Lost deals could not be read right now` with `:114-116` others render | PASS |
| C5743 | Nav shows Reports for owner, admin, estimator, not viewer | same run | `app/(app)/reports/nav-gate.test.ts:33` `expect(element.props.reports).toBe(expected)` over 4 roles. Precision gap: checks.md names `components/shell/nav-items.test.ts` as the proof command, which proves only the link toggle (`nav-items.test.ts` C5743 tests, `reports: true/false`); the four-role proof is in `nav-gate.test.ts` | PASS |
| C5751 | Live browser pass at 375/768/1440, CSV download, targets, console | not run: migration not applied to the hosted project (needs the owner's go-ahead) and sign-in needs an emailed link | none | Unproven (not run) |

All 24 checks are accounted for: 23 proven with located evidence, 1 Unproven (C5751).

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET /reports` statuses (3) | plan Surface | 200 `page.test.tsx:75-83`; 307 sign-in is `redirect("/login")` (`page.tsx:16`) proven `page.test.tsx:72`; 307 `/pipeline` `page.test.tsx:67` | - |
| `GET /reports/export` statuses (5) | plan Surface and `route.ts` returns | 200 `route.test.ts:32`; 400 `:51,:55`; 401 `:61`; 403 `:73,:79`; 503 `:101`. Edge not covered: `from` alone later than today is silently defaulted (200) rather than 400 (`route.ts:158-161`) because `from > to` needs both | edge: `from` after today with no `to` (AC 18 ambiguity) |
| `public.report_*` statuses (2) | plan Surface | 200 `reports.sql:73`; 42501 `reports.sql:265` | - |
| report functions (7) | `20261115110000_reports.sql` | headline `:73`, funnel `:94`, aging `:112`, losses `:140`, renewals `:234`, by customer `:200`, by type `:201` | - |
| functions refused to viewer (7) | plan Landing door 1 | all seven in the `calls` array, `reports.sql:251-258` | - |
| export report keys (6) | plan Landing door 4 | `route.test.ts:46-48` table-driven over `REPORT_KEYS` (6) | - |
| member roles (4) | member roles in the app | `reports.test.ts:92-98` | - |
| nav roles (4) | member roles | `nav-gate.test.ts:25-33` | - |
| decision events counted (3) | plan AC 3 | accepted/refused/expired `reports.sql:76-78` | - |
| loss outcomes (3) | plan AC 8 | refused/expired/withdrawn all in one string `reports.sql:140` | - |
| funnel stages (4) | plan AC 6 | `reports.sql:94` | - |
| renewal buckets (3) | plan AC 10 | 30, 60, 90 `reports.sql:234`; UI headings `page.test.tsx:143-148` | - |
| Landing doors (4) | plan Landing | door 1 `reports.sql:73`; door 2 `reports.sql:156-157`; door 3 `reports.test.ts:26` (adapter) plus both consumers share `supabaseReportReader` via `composition/index.ts:203`; door 4 `route.test.ts:46-52` | - |
| viewport widths (3) | plan/checks C5751 | 375, 768, 1440 | C5751 not run: all three widths Unproven |
| startup configuration: report reader wiring (1 assembly) | `web/composition/index.ts:203` `reports: supabaseReportReader(supabase)` read directly | the page and route tests build their own container mock (`page.test.tsx:89`, `route.test.ts:190`), so neither proves the real assembly; C5731 tests the adapter only. No check boots `getContainer()` | assembly line is correct by reading, but no test can fail on it |
| acceptance criteria 1 to 19 (19) | plan Criteria | AC1 C5701; AC2 C5702; AC3 C5703/C5722; AC4 C5722; AC5 C5704/C5723; AC6 C5705/C5724; AC7 C5706 (stuck list links not asserted on screen); AC8 C5707 (grouping and links not asserted); AC9 C5705/C5716/`page.test.tsx:122-125`; AC10 C5708; AC11 C5709; AC12 C5710; AC13 C5711/C5741/C5742; AC14 C5712/C5741/C5742; AC15 C5725/C5741; AC16 C5716/C5742; AC17 C5714 plus frozen tests `route.test.ts:95-98`, `page.test.tsx:150-154`; AC18 C5721/C5741/C5742; AC19 C5731/C5742 | AC 8 grouped by outcome; AC 7 and 8 "link" on the screen |
| Observable rows (12) | plan Observable | empty AC 4/9/16 ok; loading existing; error AC19 ok; unauthorised ok; density/ordering AC 7/11 ordering unpinned on screen (by-customer ordering proven in SQL only); export shape and codes ok | density and ordering on screen |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `public.report_*` (decides, across the Data API): one SQL recipe as the real roles, one asserted case per branch: each event type, each bucket, each role | `20261115110000_reports.sql` | `reports.sql` as uA, uE, uV, uX | yes. Each decision event, each bucket and each role has an assertion. Not branch-covered: `agreement.changes_requested` in "sent to decided", the `Unassigned` type branch, an accepted agreement with null `term_start` in pipeline. None are in the stated expectation |
| `domain/reports` (decides, pure): one asserted case per row of each decision table | `domain/reports/index.ts` | `reports.test.ts` | yes: range 4 branches, win rate 2, drop-off 2, CSV 4, access 4 |
| `app/(app)/reports/export` (entry point): accepted input, each rejected input, each error path | `route.ts`, `report-export.ts` | `route.test.ts` | yes (accepted, 400 x2, 401, 403 x3, 503). Note `from` alone in the future is not an asserted rejection |
| `infrastructure/supabase/reports.ts`, page markup (instrumentation): covered by C5731, C5742 | `reports.ts`, `page.tsx`, `reports-view.tsx` | C5731, C5742 | yes as written. The page markup rows for links, reasons, outcome labels and revenue tables are not exercised by C5742 (see per-screen enumeration) |

## Faults injected

Isolation: the real tree was mutated in place and reverted with `git checkout -- <file>` immediately after each run (no stash, no worktree); `git status --porcelain` was empty before and after every run (baseline empty).

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: drop the "not renewed" exclusion from the decision set (win rate counts an automatic renewal) | `supabase/migrations/20261115110000_reports.sql:109` | yes: `FAIL reports: C5703 accepted excludes the renewed one: accepted is 2` |
| F2: event date computed in UTC instead of America/Vancouver (both branches of `report_events`) | `supabase/migrations/20261115110000_reports.sql:73,76` | yes: `FAIL reports: C5715 counted on the Vancouver date: on 07-01: 0` |
| F3: export route lets an estimator download a money report (`access !== "money"` -> `access === "none"`) | `web/app/(app)/reports/export/route.ts:25` | yes: `C5741: an estimator asking revenue_customer is 403` and `revenue_type` failed |
| F4: adapter stops mapping SQLSTATE 42501 to `forbidden` | `web/infrastructure/supabase/reports.ts:19` | yes: `C5731: SQLSTATE 42501 is forbidden` failed |
| F5: page reads revenue by customer for an estimator | `web/app/(app)/reports/page.tsx:32` | yes: `C5742: an estimator sees the operational sections, reads no money report ...` failed |

F3, F4 and F5 were applied together in three different files and each failed a different test file, so each is attributable to its own proof. The cap of five was reached. Not injected: the CSV formula prefix (killed by both `reports.test.ts` C5725 and `route.test.ts`) and the nav role mapping (C5743). They share no assertion surface with the five above but were left to the cap.

## Gate

`cd web && npx vitest run domain/reports infrastructure/supabase/reports.test.ts "app/(app)/reports" components/shell/nav-items.test.ts scripts/test-db/runner.test.ts` - 137 passed, 0 failed (7 files; 82 tests carry C57xx ids)
`cd web && npm run test:db reports` - 1 passed, 0 failed (`PASS reports`; transaction rolled back, nothing applied)
Known pre-existing failures re-run and confirmed unrelated (none names a reporting file): `domain/purity.test.ts` C2021 (names `agreements-list.tsx` and `pipeline-view.tsx`), `components/shell/app-shell.test.ts` C1590, `components/vocabulary.test.ts` C2019.

## Ranked gaps (why FAIL)

1. C5751 - Unproven (not run: migration not applied, sign-in by emailed link). The live 375/768/1440 pass, 44 px targets, no horizontal scroll, console, and the CSV download are all unproven. Static review found no overflow class or sub-44 px mobile control, but that is not a browser result.
2. Binding-source contradiction - ROADMAP "Revenue breakdown ... filterable by date range" vs AC 11 and C5709/C5710 (as of today). Resolve by amending ROADMAP/decision log or adding a range to the two revenue functions.
3. AC 8 "grouped by outcome" (and ROADMAP "grouped by reason") - not grouped on screen (`reports-view.tsx:191-202`), asserted nowhere (`reports.sql:141` asserts newest first). ROADMAP "automatic renewals shown separately" - no criterion, check or screen element.
4. Screen elements with no check: stuck-list and loss/renewal links, loss reason line and outcome labels, revenue tables' rendering and order, section order, range form controls, funnel drop-off text and bar, page title.
5. Precision gaps in checks: C5743's proof command runs only the link toggle, the four-role proof is in an unnamed file; C5712 claims null `value_cents` from aging, which has no such column; no test boots the real `getContainer()` assembly for `reports`.
6. Edge: `/reports/export?from=<future date>` with no `to` answers 200 with the default range instead of 400 (`route.ts:158-161`, unasserted).
