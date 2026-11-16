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

---

# Round 2

**Verdict**: FAIL (round 2 verdict; round 1 above is kept as written)
**Profile**: ui
**Diff range**: c702243..HEAD (9764140), plus every round 1 gap and unproven check re-proven
**Round**: 2 - scoped (code and screen sections verified at 9764140; database sections carried from c702243, see below)
**Verifier**: independent sub-agent (author != verifier)

Summary: all six round 1 gaps are closed in code and checks except two things the Verifier could not close and three small screen elements. Open items, in order: (1) C5751 live browser pass is still Unproven (needs an emailed sign-in link to the owner, an agent cannot do it); (2) the database proof `npm run test:db reports` can no longer be re-run at HEAD, because the recipe re-applies the migration the owner already applied to the hosted project and Postgres answers `function "report_org" already exists`; (3) three screen elements have no selector check (revenue-by-type rows, the Apply range and Last 12 months controls, the pipeline value stat). Everything else is PASS: 169 code tests green at HEAD, 8 faults injected on the four new checks, 8 killed, tree clean. If the owner accepts C5751 as the live check left open, items (2) and (3) are the only other blockers; the repo's precedent is to tick with C5751 open and let the owner decide.

## Binding sources (round 2, verified at 9764140)

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| ROADMAP.md "Reporting" | yes, re-read | none: line 229 now reads "as of today (agreements in term now; amended 2026-11-15 ...)" which matches AC 11 and C5709/C5710; line 231 now says automatic renewals are "left out of the figures", which matches the code (excluded from win rate and losses) and removes the "shown separately" demand. Round 1 contradiction closed. ROADMAP line 226 still says "grouped by reason" while plan AC 8 says "grouped by outcome"; the build and C5761 follow the plan | - |
| plan AC 8, 7, 10, 11, 18 vs `reports-view.tsx` | yes | none: losses grouped Refused, Expired, Withdrawn with counts (`reports-view.tsx:189-209`, h3 at `:196`), empty groups return null (`:191`) | - |
| AGENTS..md web validation | yes (static only) | none | live pass is C5751, still not run |
| DESIGN.md / PRODUCT.md | yes | none | see enumeration |

### Per-screen enumeration, `/reports` (round 2)

| Element or arrangement | Checked by | Gap |
| --- | --- | --- |
| Page title "Reports" | `page.test.tsx:182` asserts the exact h1 | closed |
| Range form prefilled From, To | `page.test.tsx:179-180` (`name="from"` value 2026-06-16, `name="to"` value 2027-06-15) | closed for the inputs; the "Apply range" button and "Last 12 months" link are not asserted: open, minor |
| Section order | `page.test.tsx:174-176` indexOf order of the seven headings, sorted equals actual | closed |
| Stuck list links to agreements | `page.test.tsx:177` `/<a href="\/agreements\/a1"[^>]*>AG-1/` | closed (one row asserted, not ten) |
| Renewal links | `page.test.tsx:178` link `a3` | closed |
| Losses grouped, labels, count, reason, date, link | `page.test.tsx:157-163` | closed |
| Revenue by customer largest first | `page.test.tsx:179` Acme before Beta, `:178` neighbour `$2,399.98 a year` (lines 177-181 of the C5762 test, see file) | closed. The view does not sort, so this proves the page keeps the SQL order |
| Revenue by type rows | none: only the heading is asserted | open, minor |
| Funnel drop-off text | `page.test.tsx:181` `50% dropped off` | closed; the bar itself is not asserted (arrangement, browser only) |
| Headline pipeline value stat and "a year" notes | `$1,199.99` only (`page.test.tsx:78`) | open, minor |
| Regions, columns, bar rendering | none, a selector cannot reach them | C5751 |

## Checks (round 2)

New checks and every check that round 1 ranked as a gap or Unproven, re-proven.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5761 | Lost deals grouped under Refused, Expired, Withdrawn with count, empty groups left out, each row link, date, reason | `npx vitest run ... "app/(app)/reports"` exit 0, `C5761: lost deals are grouped ...` listed passed | `page.test.tsx:157` `toContain("Refused · 1")`, `:159` `not.toContain("Expired · ")`, `:160` Refused before Withdrawn, `:161` link regex `/<a href="\/agreements\/a2"[^>]*>AG-2/`, `:162` `Reason: Price`, `:163` `2027-03-13`. Code `reports-view.tsx:189-209` | PASS |
| C5762 | Stuck and renewal links, section order, revenue largest first, prefilled form, "50% dropped off", title | same run, `C5762: the screen links ...` passed | `page.test.tsx:175` `expect([...order].sort((a, b) => a - b)).toEqual(order)`, `:177` link a1, `:178` link a3, `:179-180` form values, `:181` `50% dropped off`, `:182` h1 | PASS |
| C5763 | `getContainer()` exposes `reports` on the session client and `renewals()` calls rpc `report_renewals` | same run, `C5731: getContainer() exposes the report reader ...` passed | `composition.test.ts:130` `toEqual({ ok: true, value: [] })`, `:131` `toHaveBeenCalledWith("report_renewals")`; assembly read directly at `composition/index.ts:203` `reports: supabaseReportReader(supabase)` | PASS |
| C5764 | Export `from` after today and no `to` is 400; `from=today` is 200 | same run, `C5741: a start date after today with no end ...` passed | `route.test.ts:60` `get("report=funnel&from=2027-06-16")).status).toBe(400)`, `:61` `from=2027-06-15 ... toBe(200)`. Code `route.ts:33` guard | PASS |
| C5751 | Live browser pass 375/768/1440, CSV, targets, console | not run | none | Unproven (not run) |
| C5743 | Nav shows Reports for four roles | `nav-gate.test.ts` and `nav-items.test.ts` both in the run | `nav-gate.test.ts:33` `expect(element.props.reports).toBe(expected)` over 4 roles; `nav-items.test.ts` link toggle. The Handoff now records that both files carry it (precision gap documented, not edited, as instructed) | PASS |
| C5712 | Estimator 42501 on headline and two revenue, null money elsewhere | carried from c702243 (SQL unchanged) | `reports.sql:275-277`, `:278`, `:281-284`; the precision gap (aging has no money column) is recorded in the checks.md Handoff, not edited | PASS (carried) |

Carried from c702243 (migration, recipe and SQL test are untouched by 9764140: `git diff --stat c702243 HEAD -- supabase` is empty): C5701 to C5716, PASS in round 1 with located evidence at `reports.sql:73` to `:310` (see the round 1 table). Their re-run at HEAD is open item (2).

Re-run in full at HEAD (`npx vitest run domain/reports infrastructure/supabase/reports.test.ts "app/(app)/reports" components/shell/nav-items.test.ts scripts/test-db/runner.test.ts composition/composition.test.ts --reporter=verbose`): 8 files, 169 passed, 0 failed. Each of C5721 to C5726, C5731, C5741, C5742, C5743 and the new C5761 to C5764 appears in the output as an individual passed test. No regression against round 1 (137 passed then; this run adds the composition file and the new tests).

## Coverage (round 2)

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| startup configuration: report reader wiring (1 assembly) | `composition/index.ts:203` read directly | C5763 boots the real `getContainer()` (`composition.test.ts:122-132`), killed by F11 | - |
| `GET /reports/export` statuses (5) | plan Surface, `route.ts` | 200 `route.test.ts:32`; 400 `:51,:55,:60`; 401; 403; 503. The `from`-after-today edge is now asserted | - |
| loss outcomes (3) on the screen | AC 8 | refused and withdrawn asserted rendered (`page.test.tsx:157-158`), expired asserted absent when empty (`:159`) | an expired group with rows is never rendered in a test (minor) |
| acceptance criteria 1 to 19 | plan Criteria | AC 7 link `page.test.tsx:177`; AC 8 grouping, link, reason `:157-163`; AC 10 link `:178`; AC 11 order `:179`; AC 18 `route.test.ts:60` plus parse tests; the rest as round 1 | - |
| viewport widths (3) | C5751 | 375, 768, 1440 | C5751 not run: all three Unproven |
| database functions (7), roles (4), events (3), buckets (3) | `reports.sql`, round 1 | carried from c702243 | re-run blocked, open item (2) |
| Landing doors (4) | plan Landing | door 3 now also proven through the real container (C5763); doors 1, 2, 4 as round 1 | - |

## Test policy rows (round 2)

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `public.report_*` | migration | `reports.sql` recipe | met in round 1 at c702243; cannot be re-run at HEAD (open item 2) |
| `domain/reports` | `index.ts` | `reports.test.ts` | yes, green at HEAD |
| `app/(app)/reports/export` | `route.ts` (touched) | `route.test.ts` | yes, now includes the future `from` rejection (`:60`) |
| adapter, page markup (instrumentation) | `reports.ts`, `reports-view.tsx` (touched) | C5731, C5742, C5761, C5762, C5763 | yes; links, reasons, outcome labels, section order and revenue-by-customer now exercised. Revenue by type rows still not |

## Faults injected (round 2)

Method: real tree mutated, reverted at once with `git checkout -- <file>` (no stash, no worktree); `git status --porcelain` was empty before and after.

| Mutation | Location | Killed |
| --- | --- | --- |
| F6: empty groups kept (`if (rows.length === 0) return null` to `if (false)`) | `components/reports/reports-view.tsx:191` | yes: C5761 `not to contain 'Expired · '` |
| F7: group filter inverted (`r.outcome === outcome` to `!==`) | `reports-view.tsx:190` | yes: C5761 failed |
| F8: agreement link points at `/agreement/${id}` | `reports-view.tsx:95` | yes: C5762 `to match /<a href="\/agreements\/a1"` |
| F9: Losses and Renewals sections swapped | `reports-view.tsx:311-312` | yes: C5762 order `toEqual` failed |
| F10: "dropped off" text changed to "lost" | `reports-view.tsx:137` | yes: C5762 `to contain '50% dropped off'` |
| F11: `reports:` line removed from the container | `composition/index.ts:203` | yes: C5763 `Cannot read properties of undefined (reading 'renewals')` |
| F12: future-`from` guard removed | `app/(app)/reports/export/route.ts:33` | yes: C5764 `expected 200 to be 400` |
| F13: guard off by one (`from > now` to `from >= now`) | `route.ts:33` | yes: C5764 `expected 400 to be 200` (the `from=today` half) |

8 injected, 8 killed. Every new check (C5761 to C5764) was made to fail at least once, C5762 on three separate surfaces. Round 1 faults F1 to F5 were not re-run (their files were not touched by 9764140); carried from c702243.

## Gate (round 2)

`cd web && npx vitest run domain/reports infrastructure/supabase/reports.test.ts "app/(app)/reports" components/shell/nav-items.test.ts scripts/test-db/runner.test.ts composition/composition.test.ts` - 169 passed, 0 failed (8 files).
`cd web && npm run test:db reports` - 0 passed, 1 failed: `FAIL reports: function "report_org" already exists with same argument types`. Cause: the recipe (`scripts/test-db/runner.mts:70`) applies `20261115110000_reports.sql` inside the test transaction, and the owner has already applied that migration to the hosted project the suite connects to. This is not a regression in the SQL (unchanged since c702243, where it passed) but the recipe cannot re-run on a database that already holds the migration; `npm run test:db db_freeze` still passes (PASS, 1 passed). The Verifier tried a rolled-back run of `fixture.sql` plus `reports.sql` without the migration step; the permission layer denied it and no workaround was attempted. Fix options for the owner: make the migration idempotent (`create or replace`), or point the recipe at a database that does not yet hold it.
Known pre-existing failures, not findings: `domain/purity.test.ts` C2021, components/kanban, pricing catalog, `components/vocabulary.test.ts` C2019, `components/shell/app-shell.test.ts` C1590.

## C5751, static review of `components/reports/reports-view.tsx`

Not run: sign-in needs an emailed link to the owner's address, so an agent cannot reach `/reports` signed in. Unproven. What a static read shows, and no more: one column of full-width panels (`Section`), headline grid `sm:grid-cols-2 lg:grid-cols-4`; agreement links `min-h-11 ... lg:min-h-0` (`:95`); buttons and date inputs inherit `h-11 lg:h-[34px]`; the widest fixed width is `sm:w-44` on the two date inputs (`:286-287`), applied only from the `sm` breakpoint; no `overflow-x`, no fixed pixel width at 375 px; rows use `flex-wrap` with `basis-full` for the reason line. Nothing found that would force horizontal scroll or a sub-44 px mobile target, but wrapped rows, the funnel bar, the real touch size of the date inputs and the CSV download are only settled by a browser.

## Ranked gaps (why FAIL)

1. C5751 - Unproven (not run; emailed sign-in link, owner only). Live 375/768/1440, 44 px targets, console and CSV download open.
2. Database proof not re-runnable at HEAD: `npm run test:db reports` fails with "function already exists" because the migration is live on the hosted project. C5701 to C5716 are carried from c702243 (SQL unchanged), not re-proven this round.
3. Screen elements still without a check: revenue-by-type rows, the "Apply range" button and "Last 12 months" link, the headline pipeline value stat; an expired group with rows is never rendered in a test. All minor and selector-reachable.

Closed since round 1: ROADMAP contradiction (lines 229, 231), AC 8 grouping (C5761), screen elements (C5762), real container wiring (C5763), future `from` on export (C5764), C5712 and C5743 precision gaps (recorded in the checks.md Handoff).

---

# Round 3

**Verdict**: FAIL (round 3 verdict; rounds 1 and 2 above are kept as written)
**Profile**: ui
**Diff range**: 9764140..HEAD (3c7b594), plus every round 2 open item re-proven
**Round**: 3 - scoped (proofs verified at 3c7b594; C5701 to C5716 re-proven this round; unchanged round 2 sections carried from 9764140)
**Verifier**: independent sub-agent (author != verifier)

Summary: both round 2 database and recipe items are closed (`npm run test:db reports` passes at HEAD and four SQL faults were killed), and C5765 is proven in all but one assertion. Two things keep this FAIL. (1) C5751, the live browser pass, is still Unproven: sign-in needs an emailed magic link to the owner's address, which an agent cannot receive. (2) One surviving mutant: C5765's pipeline-stat assertion does not pin the pipeline value (F18 below). So this is not the "FAIL only on C5751, an author/owner-run live check" case: it is FAIL on C5751 and on the weak pipeline-value assertion in C5765.

## Binding sources (round 3)

Carried from 9764140: 3c7b594 changes the recipe wiring, `reports.sql` and the page test only; the page view was not edited. Nothing re-opened. Per-screen enumeration: the round 2 minor gaps (type rows, Apply range, Last 12 months, pipeline stat, an Expired group) now have a check, C5765 (`page.test.tsx:185-196`); the pipeline stat is covered only by its label, see F18. Regions, columns and bar rendering remain C5751.

## Checks (round 3)

Recipe at HEAD: `web/scripts/test-db/runner.mts:70` is `plain("reports")`, so `reports.sql` runs against the applied functions. `cd web && npm run test:db reports` printed `PASS reports`, `1 passed, 0 failed` (rolled back, nothing applied). Each labelled assertion below exists in `supabase/tests/reports.sql` under its check id.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C5701 | Recurring revenue 119999 | `npm run test:db reports` PASS; F14 killed it | `reports.sql:73` `tests.ok('C5701 recurring revenue', h.recurring_cents = 119999, ...)` | PASS |
| C5702 | Pipeline counts sent and accepted-not-in-term, in-term zero times | same run | `reports.sql:75` `tests.ok('C5702 pipeline value', h.pipeline_cents = 239998, ...)` | PASS |
| C5703 | accepted 1, refused 1, expired 1; renewed adds 0 | same run | `reports.sql:76` `h.accepted_n = 1`, `:77` `h.refused_n = 1`, `:78` `h.expired_n = 1`, `:83` empty range zeros | PASS |
| C5704 | Average days to sign 4.0, null when none | same run | `reports.sql:80` `h.avg_days_to_sign = 4.0`, `:82` `n.avg_days_to_sign is null and n.signed_n = 0` | PASS |
| C5705 | Four funnel rows, each by its own event date, in range only | same run | `reports.sql:94` `got = 'created:4:479996 sent:2:239998 accepted:2:239998 signed:1:119999'`, `:96` empty range keeps four rows | PASS |
| C5706 | Three medians, at most ten stuck oldest first, none finished | same run | `reports.sql:112` medians string, `:123` `cnt = 10`, `:124` `first_id = tests.id('rpSt7')`, `:126` never-stuck check | PASS |
| C5707 | One row per refused, expired, withdrawn; reason Price, expired null | same run | `reports.sql:140` `got = 'withdrawn=Customer left=119999 expired=null=119999 refused=Price=119999'`, `:141` newest first | PASS |
| C5708 | 30 in bucket 30, 31 in bucket 60, 91 absent, auto only below threshold | same run; F17 killed it | `reports.sql:234` `got = 'AG-rpR30=30 AG-rpR31=60 ...'`, `:235` rpR91 absent, `:236` `kind = 'auto'`, `:240`, `:244` | PASS |
| C5709 | Customers largest first, ties by name, in-term only | same run | `reports.sql:200` `got = expected \|\| '=139998 Alpha Co=119999 Beta Co=119999'` | PASS |
| C5710 | 19999 line splits 10000 and 9999, total equals recurring | same run; F15 killed it | `reports.sql:201` `= 10000`, `:202` `= 9999`, `:204` total equals headline | PASS |
| C5711 | Viewer and non-member get 42501 from each of seven functions | same run | `reports.sql:265` `tests.expect_error('C5711 ' \|\| who \|\| ..., c, '42501')` over the seven calls (`:251-267`) | PASS |
| C5712 | Estimator 42501 on headline and two revenue; null money on funnel, losses, renewals | same run | `reports.sql:275-277` three `expect_error ... '42501'`, `:278` funnel `value_cents is null`, `:281`, `:283`; aging `:280` counts the 3 medians (no money column, recorded in the checks.md Handoff) | PASS |
| C5713 | Org B appears in none of org A's results | same run | `reports.sql:165` no org B loss, `:166` no org B revenue, `:167` headline `= 119999` | PASS |
| C5714 | Canceled-billing org still reads the headline | same run | `reports.sql:294` `recurring_cents ... > 0` | PASS |
| C5715 | 2030-07-02 03:00 UTC counted on 07-01, not 07-02 | same run; F16 killed it | `reports.sql:156` `on_first = 1`, `:157` `on_second = 0` | PASS |
| C5716 | Empty org: zeros and four funnel rows | same run | `reports.sql:308` zeros, `:310` `got = 'created:0:0 sent:0:0 accepted:0:0 signed:0:0'`, `:311` no rows elsewhere | PASS |
| C5765 | Type revenue rows, Apply range, Last 12 months, pipeline stat, an Expired group with no Reason line | `npx vitest run ... "app/(app)/reports"`, `C5765: ...` listed passed | `page.test.tsx:188` `toContain("Aaa Type")`, `:189` `"$100.00 a year"`, `:190` `"Apply range"`, `:191` `toMatch(/<a href="\/reports"[^>]*>Last 12 months/)`, `:192` `"Pipeline value"`, `:194` `"Expired · 1"`, `:195` `not.toContain("Reason:")`. Precision gap: `:193` `toContain("$2,399.98")` is also satisfied by the funnel's sent value (`page.test.tsx:15`) and the customer row (`:168`), so it does not pin the pipeline stat (F18 survives) | FAIL (a wrong pipeline value passes) |
| C5751 | Live browser pass 375/768/1440, CSV, targets, console | not run: sign-in needs an emailed magic link to the owner's address, which an agent cannot receive | none | Unproven (not run) |

Carried from 9764140 and re-run green in full at 3c7b594 (no source changed since): C5721 to C5726, C5731, C5741, C5742, C5743, C5761, C5762, C5763, C5764, each listed individually as passed in the verbose run (see Gate).

## Coverage (round 3)

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| report functions (7) | migration functions | headline `reports.sql:73`, funnel `:94`, aging `:112`, losses `:140`, renewals `:234`, by customer `:200`, by type `:201`, all re-run at HEAD | - |
| functions refused to viewer (7) | plan Landing door 1 | `reports.sql:251-267` | - |
| roles (4), decision events (3), renewal buckets (3) | plan | `reports.sql:265,275-277`; `:76-78`; `:234` | - |
| screen elements added by C5765 (5) | round 2 open list | type rows `page.test.tsx:188-189`, Apply range `:190`, Last 12 months `:191`, Expired group `:194-195`; pipeline value stat `:192-193` asserted only by label | pipeline value not pinned (F18) |
| viewport widths (3) | C5751 | 375, 768, 1440 | C5751 not run: all three Unproven |

## Test policy rows (round 3)

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `public.report_*` | migration | `reports.sql` recipe as uA, uE, uV, uX | yes, re-run at HEAD: each event, bucket and role asserted |
| `domain/reports` | `index.ts` | `reports.test.ts` | yes, green at HEAD |
| `app/(app)/reports/export` | `route.ts` | `route.test.ts` | yes, green at HEAD |
| adapter, page markup (instrumentation) | `reports.ts`, `reports-view.tsx` | C5731, C5742, C5761 to C5765 | yes, except the pipeline value in C5765 (F18) |

## Faults injected (round 3)

Method: the real tree was mutated in place and reverted at once with `git checkout -- <file>` (no stash, no worktree; the hosted database was never touched, every SQL run is the rolled-back recipe). `git status --porcelain` was empty before and after.

| Mutation | Location | Killed |
| --- | --- | --- |
| F14: expected recurring revenue 119999 -> 119998 | `supabase/tests/reports.sql:73` | yes: `FAIL reports: C5701 recurring revenue: recurring is 119999` |
| F15: expected second type share 9999 -> 9998 | `supabase/tests/reports.sql:202` | yes: `FAIL reports: C5710 second type: Zzz Type share` |
| F16: expected UTC-date count 0 -> 1 | `supabase/tests/reports.sql:157` | yes: `FAIL reports: C5715 not on the UTC date: on 07-02: 0` |
| F17: expected renewal kind 'auto' -> 'negotiate' | `supabase/tests/reports.sql:236` | yes: `FAIL reports: C5708 CPI below the threshold is auto: kind` |
| Type revenue rows: row name `r.type` -> `"x"` | `components/reports/reports-view.tsx:330` | yes: C5765 failed |
| "Apply range" label -> "Go" | `reports-view.tsx:289` | yes: C5765 failed |
| "Last 12 months" link `/reports` -> `/report` | `reports-view.tsx:291` | yes: C5765 failed |
| F18: pipeline stat shows recurring revenue (`pipelineCents` -> `recurringCents`) | `reports-view.tsx:109` | **no**: `Tests 14 passed (14)`, the mutant survived |
| Reason line shown for a null reason (`r.reason &&` -> `true &&`) | `reports-view.tsx:204` | yes: C5765 failed |
| Expired group dropped from the group list | `reports-view.tsx:191` | yes: C5765 failed |

10 injected, 9 killed, 1 survived (F18). Suggested fix, not applied: assert the stat next to its label (a regex on `Pipeline value` followed by `$2,399.98`), or give the headline a value no other element renders.

## Gate (round 3)

`cd web && npx vitest run domain/reports infrastructure/supabase/reports.test.ts "app/(app)/reports" components/shell/nav-items.test.ts composition/composition.test.ts scripts/test-db --reporter=verbose` - 9 files, 172 passed, 0 failed.
`cd web && npm run test:db reports` - `PASS reports`, 1 passed, 0 failed (rolled back).
Known pre-existing failures, not findings and outside this run's scope: `domain/purity.test.ts` C2021, components/kanban, pricing catalog, `components/vocabulary.test.ts` C2019, `components/shell/app-shell.test.ts` C1590.

## Ranked gaps (why FAIL)

1. C5751 - Unproven (not run; sign-in needs an emailed magic link to the owner's address). The live 375/768/1440 pass, 44 px targets, no horizontal scroll, console and CSV download are an author/owner-run live check.
2. Surviving mutant F18 - C5765's pipeline stat assertion (`page.test.tsx:193`) matches `$2,399.98`, which other elements also render, so a wrong pipeline value passes. Tighten the assertion.

Closed since round 2: the database proof re-run (C5701 to C5716, `plain("reports")` at `runner.mts:70`) and C5765 for type rows, range controls and the Expired group.
