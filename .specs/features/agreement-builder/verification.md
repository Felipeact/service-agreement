# Agreement builder verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: a1a0ec4..a7dddf6
**Round**: 1 - full
**Verifier**: independent sub-agent "agreement-builder verifier" (fresh context; author != verifier, built none of this feature)

All 57 checks (C701-C757) are proven with a located assertion, every proof was run at `a7dddf6`, 5 faults were
injected and all 5 were killed, and every `Test policy` row is met. Three caveats come first, because the PASS
rests on them:

1. **C756 rests on the builder's evidence.** As instructed, I did not re-run it with Playwright and did not write
   to the live project. I judged it from the Handoff record (`checks.md:549-574`) and the code it describes. I did
   not observe it myself.
2. **No check's proof catches a wrong `editable` in the reader** (fault F2 below). C716's 28-case table passes
   `editable` computed by the test's own helper (`components/agreements/agreements.test.ts:36`), so its
   status-by-version axis tests the view's `writer && editable` rule and not the rule that decides editability.
   The mutant was killed only by an unlabelled test in the feature's diff
   (`infrastructure/supabase/agreements.test.ts:112-115`). I mark it killed, but the behaviour has no check id.
3. **C753 was compared hunk by hunk, not byte for byte.** I compared every hunk of
   `database.types.ts` changed in `a1a0ec4..HEAD` with the MCP `generate_typescript_types` output, plus the header
   and the `Functions` order. All matched. I did not write the whole 20 KB generator output to disk to `diff` it.

## Binding sources

The profile is `standard`, so step 1 (`ui`) does not run. The plan marks no design or contract as binding. Its
`Sources` are ROADMAP/PRODUCT text, the two earlier migrations and the STATE.md decisions. I read STATE.md AD-051 to
AD-057 against the migration and the ports, and they agree.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/STATE.md` AD-003..AD-057 (binding decisions) | yes - read in full | - | - |

## Checks

All vitest proofs ran in one invocation from `web/`:
`npx vitest run components/sites components/agreements components/kanban components/customers "app/(app)" infrastructure/supabase domain/agreement composition -t "C7[0-5][0-9]:" --reporter=verbose`.
It exited 0 with 183 passed. Each C7xx name appeared individually as passed (per-check counts: C701=2, C702=3,
C703=9, C704=1, C705=1, C710=4, C711=2, C712=2, C713=1, C714=1, C715=1, C716=28, C718=1, C719=2, C720=23, C721=3,
C722=3, C723=1, C724=2, C725=2, C726=1, C727=8, C728=1, C729=14, C731=1, C732=15, C733=1, C734=10, C737=3, C739=6,
C740=2, C741=9, C743=4, C744=10, C745=2, C746=1, C747=1, C748=1, C749=1).

The SQL proofs:
- `npm run test:db agreement_builder` printed `PASS agreement_builder` (exit 0).
- `supabase/tests/agreement_builder.sql` has no conditional skip. Each labelled assertion raises through
  `tests.ok` / `tests.expect_error` / `tests.expect_rows` (`fixture.sql:34-75`), so reaching
  `agreement_builder: pass` means every labelled assertion ran and held.

Paths: `web/` is implied for TS files. "app test" = `web/app/(app)/agreements.test.ts`, "comp test" =
`web/components/agreements/agreements.test.ts`, "infra test" = `web/infrastructure/supabase/agreements.test.ts`, and
"SQL" = `supabase/tests/agreement_builder.sql`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C701 | writer sees "New agreement" posting the bound create action; viewer does not | vitest components/sites + app/(app) `C701:` pass | `web/components/sites/sites.test.ts:182` `toMatch(/<form[^>]*>\s*<button type="submit"[^>]*>New agreement<\/button>\s*<\/form>/)`; `:184` viewer `not.toContain("New agreement")`; `web/app/(app)/agreements.test.ts:118` `newAgreement?.name).toBe("bound createAgreementAction")`, `:121` `create toHaveBeenCalledWith(SITE)`, `:124` viewer `toBeUndefined()` (declared deviation: the binding is proven in `app/(app)`, because static markup cannot name a Server Action. Accepted.) | PASS |
| C702 | live link `AG-1048 · <label>` for 3 statuses x 2 roles, no button | vitest components/sites `C702:` 3 pass | `web/components/sites/sites.test.ts:194` `toMatch(<a[^>]*href="/agreements/g1"[^>]*>${text}</a>)` in a loop over both roles, `:195` `not.toContain("New agreement")` | PASS |
| C703 | `SiteRegister.get` liveAgreement over 7 statuses + none | vitest infrastructure/supabase `C703:` 9 pass | `web/infrastructure/supabase/readers.test.ts:276` `expect(site?.liveAgreement).toEqual(live ? {id:"g1",number:"AG-1048",status:live} : null)`; `:283` select contains `agreements(id, number, status)` | PASS |
| C704 | RPC as uE: draft, site, org A, one version 1 `{}`, 0 lines, no event | `npm run test:db agreement_builder` PASS | `supabase/tests/agreement_builder.sql:81` `status = 'draft' and site_id = ... and org_id = tests.id('orgA')`; `:83` `count(*) = 1 and min(version_no) = 1 and bool_and(snapshot = '{}')`; `:85` lines `= 0`; `:87` events `= 0` | PASS |
| C705 | create once, redirect to exactly `/agreements/<id>` | vitest app/(app) `C705:` pass | `web/app/(app)/agreements.test.ts:88` `rejects.toThrow("NEXT_REDIRECT /agreements/${AGR}")`, `:89` `toHaveBeenCalledTimes(1)`, `:91` `redirect toHaveBeenCalledWith("/agreements/${AGR}")` | PASS |
| C706 | numbering AG-1001, AG-1052, AG-1053, other org ignored | test:db PASS | `supabase/tests/agreement_builder.sql:72` `= 'AG-1001'`; `:103` `= 'AG-1052'` (over AG-1048, AG-1051, X-9, null at `:93-96`); `:106` `= 'AG-1053'`; `:109` `= 'AG-1054'` with org B's AG-5000 at `:97` | PASS |
| C707 | duplicate 23505; other org ok; nulls ok | test:db PASS | `supabase/tests/agreement_builder.sql:121-123` `expect_error(... 'AG-1048' ..., '23505')`; `:124-126` org B `expect_rows(..., 1)`; `:127-130` two null numbers `1` row each | PASS |
| C708 | advisory lock taken before max() | test:db PASS | `supabase/tests/agreement_builder.sql:139` `position('pg_advisory_xact_lock(hashtextextended(''agreement_number:'' ' in d) > 0` (the literal continues with the concat operator); `:141` lock position `< position('max(' in d)` | PASS |
| C709 | 3 live statuses refuse 23505 and add nothing; 4 others succeed | test:db PASS | `supabase/tests/agreement_builder.sql:160` `expect_error(..., '23505')`, `:161` count unchanged; `:167` `= before + 1` for accepted/refused/expired/withdrawn | PASS |
| C710 | create maps 23505/P0002/42501/other, one console.error on other | vitest infrastructure/supabase `C710:` 4 pass | `web/infrastructure/supabase/agreements.test.ts:150` `toEqual(expected)` over the table at `:143-146` (`open_exists` with `agreementId:"live-1", number:"AG-1048"`, `not_found`, `forbidden`, `unavailable`), `:151` `console.error toHaveBeenCalledTimes(logged)` | PASS |
| C711 | action returns open_exists; prompt says "... already in progress" + link | vitest app/(app) + components/sites `C711:` 2 pass | `web/app/(app)/agreements.test.ts:96` `toEqual({status:"open_exists",agreementId:"g9",number:"AG-1048"})`; `web/components/sites/sites.test.ts:202` `toContain("AG-1048 is already in progress for this site.")`, `:203` `href="/agreements/g9"` | PASS |
| C712 | malformed id not_found without store; missing/other-org site P0002, nothing added | vitest app/(app) `C712:` 2 pass; test:db PASS | `web/app/(app)/agreements.test.ts:100` `toEqual({status:"not_found"})`, `:101` `create not.toHaveBeenCalled()`; `supabase/tests/agreement_builder.sql:175-176` `expect_error(..., 'P0002')`, `:177-178` counts unchanged | PASS |
| C713 | number, pill, links, version, lines, amounts, total, Before tax | vitest components/agreements `C713:` pass | `web/components/agreements/agreements.test.ts:56` `>AG-1052</h1>`; `:57` stage dot + `In progress`; `:58-59` `href="/customers/c1"`, `href="/sites/s1"`; `:60` `Version 2`; `:61` `$892.50`,`$150.00`,`$3,570.00`,`$300.00`; `:62-63` visits 4/2; `:64` `Total per year $3,870.00`; `:65` `Before tax` (declared deviation `formatCadExact`: the plan's own independent test reads `$3,870.00`, which `formatCad` cannot print. Accepted.) | PASS |
| C714 | lines by position then created_at | vitest infrastructure/supabase `C714:` pass | `web/infrastructure/supabase/agreements.test.ts:49` `toEqual(["p0","p1-early","p1-late","p2"])` | PASS |
| C715 | empty version text; writer form pre-filled; viewer no form | vitest components/agreements `C715:` pass | `web/components/agreements/agreements.test.ts:79` `No service lines yet.`; `:80` `value="Preventive maintenance visit"`; `:81` `value="4"`; `:82` cost `value=""`; `:85` viewer `not.toContain("<form")` | PASS |
| C716 | Add line/Edit/Remove only writer + current + draft, 28 cases | vitest components/agreements `C716:` 28 pass | `web/components/agreements/agreements.test.ts:95` `expect(has(html,label)).toBe(shown)` for all 3 labels, `shown = estimator && draft && current` (`:94`). Caveat 2: `editable` comes from the helper at `:36`. | PASS |
| C717 | uE insert/update/delete on current draft each 1 row | test:db PASS | `supabase/tests/agreement_builder.sql:186-188` insert `1`; `:190` update `1`; `:191` delete `1` | PASS |
| C718 | trimmed, parsed to cents, add once, revalidate, saved | vitest app/(app) `C718:` pass | `web/app/(app)/agreements.test.ts:131` `toEqual({status:"saved"})`, `:132` called once, `:133` `toHaveBeenCalledWith(AGR, {description:"Preventive maintenance visit",visitsPerYear:4,costPerVisitCents:89250})`, `:134` `revalidatePath("/agreements/${AGR}")` | PASS |
| C719 | add reads highest version, org_id from row, position max+1 / 0, exact keys | vitest infrastructure/supabase `C719:` 2 pass | `web/infrastructure/supabase/agreements.test.ts:182-183` order `version_no desc`, `limit 1`; `:186-193` insert payload `org_id:"org-from-row", position:5`; `:194-196` exact key set; `:205` position `0` | PASS |
| C720 | validator, 23 edges | vitest domain/agreement `C720:` 23 pass | `web/domain/agreement/service-line.test.ts:17` keys `["description"]`; `:26` trimmed value; `:32` keys `["visitsPerYear"]`; `:40` 1/365; `:46` keys `["costPerVisit"]`; `:56` 0/89250/123450/99999999; `:63` all three keys | PASS |
| C721 | invalid cost: no store call; message under field via aria-describedby | vitest app/(app) + components/agreements `C721:` 3 pass | `web/app/(app)/agreements.test.ts:142` `status toBe("invalid")`, `:143` `errors.costPerVisit`, `:144-145` store not called; `web/components/agreements/agreements.test.ts:163` `aria-describedby="new-line-costPerVisit-error"`, `:164` `<p id="new-line-costPerVisit-error">` | PASS |
| C722 | 50 lines: too_many, no insert; action and form copy | vitest 3 folders `C722:` 3 pass | `web/infrastructure/supabase/agreements.test.ts:211` `toEqual({ok:false,code:"too_many"})`, `:212` inserts `toHaveLength(0)`; `web/app/(app)/agreements.test.ts:150` `{status:"too_many"}`; `web/components/agreements/agreements.test.ts:169` `An agreement version can have at most 50 lines.` | PASS |
| C723 | remove prompt asks, submit Remove, Cancel type=button | vitest components/agreements `C723:` pass | `web/components/agreements/agreements.test.ts:176` `Remove Filter changes?`; `:177` `<form ...><button type="submit">Remove`; `:178` `<button type="button">Cancel` | PASS |
| C724 | remove and update call store once, removed / saved | vitest app/(app) `C724:` pass | `web/app/(app)/agreements.test.ts:155` `{status:"removed"}`, `:156-157` once with `LINE`; `:159` `{status:"saved"}`, `:160-161` once with `(LINE, VALUE)` | PASS |
| C725 | annualCents visits x cost and sum; empty 0 | vitest infrastructure/supabase `C725:` 2 pass | `web/infrastructure/supabase/agreements.test.ts:56` `toEqual([357000, 30000])`, `:57` `toBe(387000)`; `:71` `{lines: [], annualCents: 0}` | PASS |
| C726 | versions 3,2,1, dates en-CA medium Vancouver, Current only on 3, hrefs; single version no list | vitest components/agreements `C726:` pass | `web/components/agreements/agreements.test.ts:101` `toEqual(["3","2","1"])`; `:105` `href="/agreements/g1?version=N"`; `:106` date format; `:107` `>Current<` only on 3; `:109` `not.toContain("data-version")` | PASS |
| C727 | get(id,1) shows v1 not current; none/9/0 show v2; page maps abc/1.5/"" to none | vitest infrastructure/supabase + app/(app) `C727:` 8 pass | `web/infrastructure/supabase/agreements.test.ts:77` `{versionNo:1,current:false}`, `:78` v1 lines; `:90` `{versionNo:2,current:true}`; `web/app/(app)/agreements.test.ts:234` `get toHaveBeenCalledWith(AGR, undefined)`; `:240` `(AGR, 1)` | PASS |
| C728 | v1 of 3 read-only, no controls | vitest components/agreements `C728:` pass | `web/components/agreements/agreements.test.ts:114` `Version 1 of 3, read-only`; `:115` all 3 labels `toBe(false)` | PASS |
| C729 | Start version 3 only writer + changes_requested, 14 cases | vitest components/agreements `C729:` 14 pass | `web/components/agreements/agreements.test.ts:121` `toBe(role === "estimator" && status === "changes_requested")` | PASS |
| C730 | revise copies 2 lines with new ids, v1 unchanged | test:db PASS | `supabase/tests/agreement_builder.sql:210` status `draft`; `:213-217` v2 `(position, description, visits, cost)` equals the v1 snapshot; `:218` new ids; `:220-224` v1 `(id, ...)` unchanged | PASS |
| C731 | revise calls transition once, redirects | vitest app/(app) `C731:` pass | `web/app/(app)/agreements.test.ts:183` `NEXT_REDIRECT /agreements/${AGR}`; `:184` once; `:185` `toHaveBeenCalledWith({agreementId:AGR,command:{type:"revise"}})` | PASS |
| C732 | Withdraw only writer + draft/sent, 14 cases; prompt copy, submit, Cancel | vitest components/agreements `C732:` 15 pass | `web/components/agreements/agreements.test.ts:128` `toBe(role === "estimator" && (draft or sent))`; `:134` prompt text; `:135` submit `Withdraw` in form; `:136` `type="button"` Cancel | PASS |
| C733 | withdraw calls transition once, withdrawn | vitest app/(app) `C733:` pass | `web/app/(app)/agreements.test.ts:190` `{status:"withdrawn"}`, `:191-192` once with `command:{type:"withdraw"}` | PASS |
| C734 | 9 status labels; view says `<label>, read-only` | vitest domain/agreement + components/agreements `C734:` 10 pass | `web/domain/agreement/service-line.test.ts:81` `statusLabel(status, contract)).toBe(label)` over the 9 rows `:71-79`; `web/components/agreements/agreements.test.ts:140` `Sent to customer, read-only` | PASS |
| C735 | trigger 55000: older draft version and 6 non-draft statuses x 3 ops; owner insert ok | test:db PASS | `supabase/tests/agreement_builder.sql:246-247` older version `'55000'`; `:249-250` 6 statuses x insert/update/delete `'55000'`; `:257` table owner insert `1` row | PASS |
| C736 | after withdraw 55000; after revise v_n 55000, v_n+1 ok; for share | test:db PASS | `supabase/tests/agreement_builder.sql:268` `'55000'`; `:271` `'55000'`; `:272-274` v2 update `1`; `:281` `position('for share' ...) > 0` | PASS |
| C737 | 55000 -> locked in store; actions pass through; form and prompt copy | vitest 3 folders `C737:` 3 pass | `web/infrastructure/supabase/agreements.test.ts:217`, `:219`, `:220` `{ok:false,code:"locked"}`; `web/app/(app)/agreements.test.ts:168-170` `{status:"locked"}`; `web/components/agreements/agreements.test.ts:186`, `:190` `This version can no longer be changed.` | PASS |
| C738 | viewer: RPC 42501, nothing added; insert 42501; update/delete 0 rows | test:db PASS | `supabase/tests/agreement_builder.sql:294` `'42501'`; `:295` count unchanged; `:296` insert `'42501'`; `:297-298` update/delete `0`; `:303` line kept | PASS |
| C739 | viewer forbidden on all 6, no store / transition call | vitest app/(app) `C739:` 6 pass | `web/app/(app)/agreements.test.ts:206` `toEqual({status:"forbidden"})`; `:207` every write `not.toHaveBeenCalled()` | PASS |
| C740 | viewer page shows no control | vitest app/(app) `C740:` 2 pass | `web/app/(app)/agreements.test.ts:248` six labels `not.toContain(">label")`, against the positive control at `:254` | PASS |
| C741 | malformed id not_found on all 6; store no-row not_found; reader null; page notFound | vitest app/(app) + infrastructure/supabase `C741:` 9 pass | `web/app/(app)/agreements.test.ts:211-212`; `:258` and `:261` `rejects.toThrow("NEXT_NOT_FOUND")`; `web/infrastructure/supabase/agreements.test.ts:119-121` `toBeNull()`, no query; `:241-242` `{ok:false,code:"not_found"}` | PASS |
| C742 | uE sees 0 of org B; update/delete 0; insert fails; revise P0002 | test:db PASS | `supabase/tests/agreement_builder.sql:310-313` counts `= 0`; `:314-315` `0` rows; `:316-324` insert `42501`/`23503`; `:325-326` `'P0002'`; `:331` org B line kept | PASS |
| C743 | revise/withdraw pass conflict/invalid_transition/not_found; conflict copy | vitest app/(app) + components/agreements `C743:` 4 pass | `web/app/(app)/agreements.test.ts:197-198` `toEqual({status: code})` for both actions; `web/components/agreements/agreements.test.ts:196-197` `This agreement changed meanwhile. Reload to see it.` | PASS |
| C744 | unexpected errors -> unavailable + one console.error; actions pass through; copy | vitest 3 folders `C744:` 10 pass | `web/infrastructure/supabase/agreements.test.ts:167-168` and `:272-273` `{ok:false,code:"unavailable"}` + `toHaveBeenCalledTimes(1)` over the create rpc throw, the live read, the version read, the positions read, the insert, update, remove and a throw; `web/app/(app)/agreements.test.ts:222` all six `{status:"unavailable"}`; `web/components/agreements/agreements.test.ts:201` `We couldn't save this. Try again.` | PASS |
| C745 | one member client; grep 0; org fields ignored | vitest composition + app/(app) `C745:` 2 pass; grep printed `0` | `web/composition/composition.test.ts:224-228` the three adapters `(supabase)` and `createServerClient<` length 1; `web/app/(app)/agreements.test.ts:176` `mock.calls).toEqual([[AGR, VALUE]])` | PASS |
| C746 | 3 cards are links to `/agreements/a1..a3` | vitest components/kanban `C746:` pass | `web/components/kanban/pipeline-view.test.ts:81` `toEqual(["/agreements/a1","/agreements/a2","/agreements/a3"])` | PASS |
| C747 | customer rows link to `/agreements/g1`, `g2` | vitest components/customers `C747:` pass | `web/components/customers/customers.test.ts:145` `toEqual(["/agreements/g1","/agreements/g2"])` | PASS |
| C748 | ports with door 7 shapes; tsc 0 | `npx tsc --noEmit` exit 0; vitest composition `C748:` pass | `web/composition/composition.test.ts:268` `body("AgreementReader")).toContain("get(id: string, versionNo?: number): Promise<AgreementDetail or null>")`, and the typed literals of door 7 above it, which tsc checks | PASS |
| C749 | container exposes the three | vitest composition `C749:` pass | `web/composition/composition.test.ts:218` `typeof container.agreementReader.get).toBe("function")`, plus store and line methods below | PASS |
| C750 | searchParams read in a child inside Suspense; build 0; lint 0 | `npx next build` exit 0 (`/agreements/[agreementId]` partial prerender); `npm run lint` exit 0 | `web/app/(app)/agreements/[agreementId]/page.tsx:34` `const params = await searchParams;` inside `AgreementForRequest`, rendered within `<Suspense>` at `:54` | PASS |
| C751 | anon cannot execute either RPC; authenticated can | test:db PASS | `supabase/tests/agreement_builder.sql:338-340` anon `'42501'` for both; `:347` `has_function_privilege('authenticated','public.create_agreement(uuid)','execute')`; `:349-350` the revise RPC | PASS |
| C752 | file name version = remote version | MCP `list_migrations` (run by me): `20261027202354 agreement_builder`; `ls supabase/migrations` has `20261027202354_agreement_builder.sql` | `supabase/migrations/20261027202354_agreement_builder.sql:1` | PASS |
| C753 | types equal the generator | MCP `generate_typescript_types` (run by me); every hunk of `git diff a1a0ec4..HEAD -- database.types.ts` matches the generator output (import_rows key order, Functions order, `create_agreement`), header identical | `web/infrastructure/supabase/database.types.ts:863` `create_agreement: { Args: { p_site_id: string }; Returns: string }` (caveat 3: compared hunk by hunk) | PASS |
| C754 | advisors exactly the two accepted findings | MCP `get_advisors` security (run by me): `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection`, nothing else | `.specs/features/agreement-builder/checks.md:544` (Handoff record, matches my run); the migration's grants at `supabase/migrations/20261027202354_agreement_builder.sql:45-46` | PASS |
| C755 | all 15 recipes pass, demo_seed with trigger | `npm run test:db` exit 0: 15 PASS lines, `15 passed, 0 failed` | `web/scripts/test-db/runner.mts:43` `plain("agreement_builder")`; older fixtures compared with `a1a0ec4` below, with no assertion weakened | PASS |
| C756 | live run at 1440/768/375 | not re-run (instructed). Judged on the builder's Handoff record and the code | `.specs/features/agreement-builder/checks.md:549-574` (builder's evidence); the code agrees: touch classes `web/components/customers/customer-detail-view.tsx:41` (`min-w-11`), the `min-h-11` row link in the same file, and `web/components/sites/new-agreement.tsx` (`min-h-11` link). **Rests on the builder's evidence; I did not observe it.** | PASS |
| C757 | CONTEXT names the three, Build log line; ROADMAP ticked; AD-051+ | greps printed `6`, `1`; `AD-05[1-7]` 7 rows | `CONTEXT.md:206` dated Build log line; `ROADMAP.md:113` `- [x] Agreement builder ...`; `.specs/STATE.md:57` `AD-051` (through AD-057) | PASS |

## Coverage

Recomputed from the authority for each set, not from the author's table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| page `GET /agreements/[agreementId]` statuses (3) | plan Surface | 200 C740 (page renders, `agreements.test.ts:247-254`) · 404 C741 (`:258`, `:261`) · `/login` unlabelled `agreements.test.ts:264-267` (the page's own redirect, in the feature diff) plus the existing MemberGate | - |
| `createAgreementAction` outcomes (5 in Surface) | plan Surface + `agreement-actions.ts:30-38` | redirect C705 · open_exists C711 · forbidden C739 · not_found C712 (malformed) and C710 (P0002 -> not_found, passed through by the generic `{status: created.code}` at `:37`, the same line C701 `:120` and C744 drive) · unavailable C744 | - |
| `addServiceLineAction` outcomes (7) | plan Surface + `agreement-actions.ts:40-51` | saved C718 · invalid C721 · too_many C722 · locked C737 · forbidden C739 · not_found C741 · unavailable C744 | - |
| `updateServiceLineAction` outcomes (6) | plan Surface + `:53-64` | saved C724 · invalid C721 · locked C737 · forbidden C739 · not_found C741 · unavailable C744 | - |
| `removeServiceLineAction` outcomes (5) | plan Surface + `:66-74` | removed C724 · locked C737 · forbidden C739 · not_found C741 · unavailable C744 | - |
| `reviseAgreementAction` outcomes (5 in Surface; code adds `unavailable`) | plan Surface + `:79-100` | redirect C731 · conflict / invalid_transition / not_found C743 · forbidden C739 · `unavailable` (declared deviation, beyond Surface) C744 `:222` | - |
| `withdrawAgreementAction` outcomes (5 in Surface; code adds `unavailable`) | plan Surface + `:102-107` | withdrawn C733 · conflict / invalid_transition / not_found C743 · forbidden C739 · unavailable C744 | - |
| agreement statuses (7) at "live" | `AGREEMENT_STATUSES` in `domain/agreement`, `LIVE_STATUSES` | C703 (stub, 7 + none) · C709 (SQL, all 7) | - |
| line controls 2 roles x 7 statuses x 2 versions (28) | `agreement-view.tsx:39-45` | C716 all 28 (status axis is via `editable`; the reader's own rule is covered only by unlabelled `infrastructure/supabase/agreements.test.ts:112` plus C727, see caveat 2) | - |
| Start version 7 x 2 (14) | `agreement-view.tsx:44` | C729 all 14 | - |
| Withdraw 7 x 2 (14) | `agreement-view.tsx:45` | C732 all 14 | - |
| status labels (9) | `statusLabel` / `labelFor` over `pipelineStage` (5 stages + withdrawn + voided) | C734 all 9 | - |
| trigger cases | `private.service_lines_frozen` branches (migration `:62-86`) | non-member C735 `:257` · older version C735 · 6 non-draft C735 · after withdraw / revise C736 · current draft passes C717 · other org passes to RLS/FK C742 | - |
| numbering (4) | migration `:35-37` | empty C706 · after highest C706 · non-matching ignored C706 · other org C706 | - |
| number uniqueness (3) | constraint door 1 | C707 x3 | - |
| validator edges (23) | `validateServiceLine` bounds | C720: description 5 + visits 7 + cost 10 + all-bad 1 = 23 | - |
| `create` RPC error mapping (4) | `supabaseAgreementStore.create` | C710 x4, plus the read-failure branches in C744 | - |
| line store outcomes (6) | `failure()` and `written()` in `agreements.ts:22-28,136-140` | ok C719/C724 · too_many C722 · locked C737 · not_found C741 · unavailable C744 · forbidden unlabelled `agreements.test.ts:247-250` and SQL C738 | - |
| version selection (6) | `versionOf` (page `:24-26`) + reader `find ?? latest` | `1`, none, `9`, `0` C727 (reader) · `abc`, `1.5`, `""` C727 (page) | - |
| Landing doors (7) | plan Landing | 1 C706-C708 · 2 C709/C710 · 3 C704/C712/C738/C751 · 4 C735/C736/C717 · 5 C730/C751 · 6 C705/C750 · 7 C703/C719/C748/C749 | - |
| Relations (4) | plan erDiagram | sites->agreements C709 · agreements->versions C704/C730 · versions->lines C730/C719 · orgs->agreements number C706/C707 | - |
| alert copy (6) | `components/agreements/state.ts` `messageFor` + prompts | open_exists C711 · too_many C722 · locked C737 · conflict C743 · unavailable C744 · invalid C721 | - |
| links (5 places) | the diff's `href` sites | site live link C702 · open_exists link C711 · pipeline card C746 · customer row C747 · version links C726 | - |
| container assembly (1) | `web/composition/index.ts:109-112`, read directly | C749 + C745 (source regex at `composition.test.ts:224-228`) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | the RPC, revise RPC, trigger (`20261027202354_agreement_builder.sql`); reader and both stores (`infrastructure/supabase/agreements.ts`) | own layer: SQL C704-C709/C712/C717/C730/C735/C736/C738/C742/C751 and stub C703/C710/C714/C719/C722/C725/C727 · boundary: adapter mapping of the SQLSTATEs (C710, C737) and the actions and page over the ports (C705, C718, C727 page) | yes - one row of each decision table is asserted at its own layer; the reader's `editable` status rule only through an unlabelled test (caveat 2) |
| Decides, not across a boundary | `validateServiceLine`, `statusLabel` (`domain/agreement`), the view's control rules (`agreement-view.tsx`) | own layer | yes - C720 23/23, C734 9/9, C716 28, C729 14, C732 14 |
| Entry point deciding only validation | the six actions (`agreement-actions.ts`), the page | at the boundary: accepted, each rejected, each error path | yes - accepted C705/C718/C724/C731/C733, rejected C712/C721/C739/C741, error paths C710-through/C722/C737/C743/C744; page C727/C740/C741 + login redirect |
| Instrumentation | `composition/index.ts`, prompts (`line-row.tsx`, `move-controls.tsx`, `new-agreement.tsx`) | none of its own | yes - consumed by C749/C745 and C723/C732/C711/C737/C743 |

## Faults injected

Run in a scratch worktree at `HEAD` (`git worktree add --detach`, with `node_modules` linked as a junction and
`.env.local` copied). The real tree's `git status --porcelain` was empty before and after. Each fault was reverted
with `git checkout -- .` and the worktree was removed. The SQL fault was a `create or replace` placed after
`fixture.sql`'s `begin` inside the scratch copy of `agreement_builder.sql`. The recipe ends in `rollback` and the
runner refuses any `commit`, so nothing persisted. A rerun of `npm run test:db agreement_builder` on the real tree
afterwards passed, which shows the live trigger is the original.

| Mutation | Location | Proof run | Killed |
| --- | --- | --- | --- |
| F1 visits bound `<= 365` -> `<= 366` | `web/domain/agreement/index.ts:112` (`validateServiceLine`) | `vitest domain/agreement -t C720:` -> `C720: visits "366" are refused` failed | yes |
| F2 reader `editable: status === "draft" && current` -> `editable: current` | `web/infrastructure/supabase/agreements.ts:101` | all C7xx proofs in infrastructure/supabase, app/(app) and components/agreements: 141 passed. The whole file: `a sent agreement's current version is not editable` (`agreements.test.ts:112`, unlabelled) failed | yes - only by an unlabelled test; no check proof fails (caveat 2) |
| F3 Withdraw offered on every non-withdrawn status | `web/components/agreements/agreement-view.tsx:45` | `vitest components/agreements -t C732:`: 4 failed (accepted, refused, changes_requested, expired) | yes |
| F4 withdraw returns `withdrawn` after a refused transition (except forbidden) | `web/app/(app)/agreement-actions.ts:104` | `vitest "app/(app)" -t C743:`: 3 failed | yes |
| F5 trigger drops the latest-version condition (`not (v_status = 'draft')`) | `private.service_lines_frozen`, migration `:82`, replaced inside the rolled-back recipe | `npm run test:db agreement_builder`: `FAIL C735 older version insert: expected SQLSTATE 55000, statement succeeded` | yes |

The cap is five, so these five reach five distinct proof surfaces: domain, adapter, view, action and SQL. The site,
kanban, customer and composition proofs got no fault of their own. Their assertions are exact `href` lists and
source regexes, read directly above.

## Declared deviations and derived copy

- **`formatCadExact` for C713**: accepted. The plan's Criteria preamble says "Amounts are shown with `formatCad`",
  but the plan's own independent test (S2) and C713 pin `$300.00` / `$3,870.00`, which `formatCad` drops to
  `$300`. The plan's wording is a precision gap; the pipeline still uses `formatCad` (`kanban-card.tsx`).
- **C701 posting proof in `app/(app)`**: accepted. `agreements.test.ts:118-124` shows the site page passes
  `createAgreementAction` bound to the site id to writers and nothing to viewers. The view test shows the submit
  button inside a form.
- **Pipeline "New agreement" left disabled (C118)**: consistent with the plan (creation starts from a site, door 6).
  `components/kanban/pipeline-view.test.ts:69` (C118) still pins it. Minor copy note, outside every check: its
  title "The agreement builder arrives in a later release" (`pipeline-view.tsx:51`) is no longer true.
- **Older SQL fixtures**: I compared them with `a1a0ec4`, and no assertion was weakened.
  - `domain_constraints.sql` C16: the same 7 status inserts, `pending` -> `23514` and default `draft`. Only the
    site differs.
  - `rls_isolation.sql` C5: still `expect_error(..., '23503')`. The probe is `withdrawn`, so door 2's index cannot
    answer first.
  - `fixture.sql`: `insert_sql('agreements')` inserts `withdrawn`, `insert_sql('service_lines')` targets the latest
    version, and `lineA`/`lineB` move to `ver2`. `domain_constraints.sql:100` (`visits_per_year = 0` -> `23514`)
    keeps its expectation.
  - `runner.test.ts`: the pins move 14->15 recipes and 16->17 files. That is a count, not a looser assertion.
  - `transitions.sql` and `rls_roles.sql` are unchanged.
- **Two lint-driven tests timing out under full parallel runs** (`boundaries.test.ts` C539, `domain/purity.test.ts`
  C32): both files are unchanged in the diff. My full `npm test` run passed 54 files / 1227 tests, and the two run
  alone passed (51 tests). I saw no timeout, so this is a flakiness note only.
- **Derived copy flagged in the Handoff**:
  - `Withdrawn` and `Contract voided` (C734) follow from `pipelineStage` returning null for exactly those two cases
    (Terms, `checks.md:43-46`).
  - `Current` (C726) is a neutral pill beside the latest version only.
  - None of these contradicts the plan.

## Swept

The `Swept` rows cite checks of this feature (new behaviour), and none cites an existing constraint. Nothing resolves
to `existing`, so there is nothing to re-read against older code.

## Gate

- `npx vitest run ... -t "C7[0-5][0-9]:"`: 183 passed, 0 failed
- `npm test`: 54 files, 1227 passed, 0 failed
- `npm run test:db`: 15 passed, 0 failed
- `npm run test:db agreement_builder`: 1 passed
- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npx next build`: exit 0
- the C745 grep printed `0`
- C757 greps printed `6` and `1`
- MCP `list_migrations` / `get_advisors` / `generate_typescript_types`: as recorded above

## Ranked gaps (non-blocking)

1. The reader's `editable` status rule has no check-owned proof; C716 feeds `editable` from the test helper. The
   F2 mutant is killed only by the unlabelled `web/infrastructure/supabase/agreements.test.ts:112`. (C716 / C727)
2. C756 is not independently observed; it rests on the builder's record (`checks.md:549-574`).
3. The plan says `formatCad` where its own independent test needs two decimals (precision gap in plan wording; C713).
4. The pipeline's disabled button title is stale copy (`web/components/kanban/pipeline-view.tsx:51`), outside every
   check.
