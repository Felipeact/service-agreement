# Phase 1 validation verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 66df3c5..957d76d
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

All 22 checks pass. **C215** now passes at HEAD on the live project: two runs in a row each print `9 passed, 0 failed` and exit 0. The live demo org has 1 org, 12 agreements and 1 membership before and after. **C220** passes against its narrowed wording, which the user approved. The author ran it, not this Verifier. C219, C221 and C222 also pass on the author's record.

Previous rounds:
- **Round 1** (at 5ee0adc): 16/22 passed. C215, C216 and C219-C222 were blocked: no DB URL and no demo owner. There were two precision gaps, in C206 and C218.
- **Round 2** (at 2ead534): 20/22 passed. C215 failed because `demo_owner` C23 and `demo_seed` C17 assumed the demo org had no members, but the live org had its owner seeded. C220 failed as written because of `ERR_ABORTED` `?_rsc=` cancels at 375 px.

Since round 2, `3589944` adds one statement to `supabase/tests/fixture.sql:158-160`, and `62aeaf0` and `957d76d` change docs only (`CONTEXT.md`, `ROADMAP.md`, `plan.md` AC 15, `checks.md` C220 and the Handoff). No file under `web/` changed, and no other file under `supabase/tests/` changed. This round's scope is therefore:
- C215 and C220, the checks round 2 failed.
- Every check whose proof reads `fixture.sql`. Those are C210, C211 and C216, plus C215 and C201-C213, all re-run through the full vitest batch.
- C218, whose proof reads `CONTEXT.md`.
- C219, because its evidence was re-recorded.

Every proof re-ran at 957d76d. The one exception is C217, an MCP advisors call this round's brief does not cover. Its row is carried from 2ead534 and says so.

## Binding sources

The plan marks no source as binding. Profile `light`, so step 1 does not run.

## Checks

Proofs run by this Verifier at 957d76d on 2026-10-26:
- **Vitest:** `cd web && npx vitest run scripts composition --reporter=verbose` exited 0 with 30 passed. Each `C2xx:` test is listed by name: 25 in `runner.test.ts` and `wiring.test.ts`, plus 5 composition tests.
- **Unknown recipe:** `npm run test:db nope` exited 2.
- **Live DB** (approved; every recipe rolls back): `npm run test:db` ran twice and gave the same result both times. `npm run test:db rls_isolation rls_roles transitions staff_screens` ran once.
- **MCP read-only SELECT:** demo org `00000000-0000-4000-8000-00000000de30`. Before the runs: orgs 1, agreements 12, memberships 1, contracts 3. After the runs: orgs 1, agreements 12, memberships 1, contracts 3.

The author ran C219-C222, not this Verifier. They need the user's signed-in browser, and this Verifier did not sign in. Their rows judge the evidence in the `checks.md` Handoff: the line at `checks.md:192` re-records the live run after `3589944`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C201 | recipe list and parts, in order | `C201: the recipe list and each recipe's parts` passed at 957d76d | `web/scripts/test-db/runner.test.ts:80` - `expect(RECIPES.map((recipe) => recipe.name)).toEqual(ALL)`; `:87` - `expect(parts.demo_seed).toEqual(["fixture.sql", "SEED_BODY", "demo_seed.sql", "SEED_BODY", "demo_seed_rerun.sql"])` (file unchanged since 2ead534) | PASS |
| C202 | seed body drops only begin;/commit;, exact SEED_BODY replaced, joined in order | `C202: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:92` - `expect(seedBody(seed)).toBe(...)`; `:103`, `:106` - `assembleRecipe(...)` `toBe(...)` | PASS |
| C203 | 9 connections in order, one query each, closed, PASS each | `C203: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:114-117` - `expect(f.connects).toBe(9)`, `expect(f.sent).toHaveLength(9)`, `expect(f.ended).toBe(9)`, `expect(f.out.slice(0, 9)).toEqual(ALL.map((name) => \`PASS ${name}\`))` | PASS |
| C204 | `9 passed, 0 failed`, exit 0 | `C204: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:123-124` - `expect(f.out.at(-1)).toBe("9 passed, 0 failed")`; `expect(code).toBe(0)` | PASS |
| C205 | third recipe fails, rest run, `8 passed, 1 failed`, exit 1 | `C205: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:132-136` - `toContain("FAIL events_outbox: C3: anon can read")`, `connects` 9, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C206 | pass only on last row `<last file>: pass`; demo_seed expects `demo_seed: pass` | 5 `C206:` tests passed at 957d76d | `web/scripts/test-db/runner.test.ts:147-149` - `toMatch(/^FAIL rls_roles: /)`, `toBe("0 passed, 1 failed")`, `code` 1; `:154` - `expect(await runSuite(f.io)).toBe(0)`; `:156-157` - `demo_seed_rerun: pass` gives `toBe(1)` and `toMatch(/^FAIL demo_seed: /)` | PASS |
| C207 | `rls_roles rls_isolation` only, in that order | `C207: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:169` - `expect(f.out).toEqual(["PASS rls_roles", "PASS rls_isolation", "2 passed, 0 failed"])` | PASS |
| C208 | `nope`: message, 9 names, exit 2, 0 connections | `C208: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:177-180` - `toBe("Unknown recipe: nope")`, each name, `connects` 0, `code` 2 | PASS |
| C209 | URL unset / "" / "  ": message, exit 2, 0 connections | 3 `C209:` tests passed at 957d76d | `web/scripts/test-db/runner.test.ts:190-192` - `expect(f.out).toEqual(["SUPABASE_DB_URL is not set (see web/.env.example)"])`, `connects` 0, `code` 2 | PASS |
| C210 | orphan refused; all 11 real files in a recipe | `C210: ...` passed at 957d76d (reads the real `supabase/tests/`, including the changed `fixture.sql`) | `web/scripts/test-db/runner.test.ts:198-204` - `toEqual(["Not in any recipe: orphan.sql"])`, `connects` 0, `code` 2, `expect(REAL_FILES).toHaveLength(11)`, `expect(covered.has(file), file).toBe(true)` | PASS |
| C211 | commit refused before connecting; real recipes do not trip | 5 `C211:` tests passed at 957d76d. `none of the real recipes would commit` assembles the changed `fixture.sql`, and the new `delete` does not trip the guard | `web/scripts/test-db/runner.test.ts:214-216` - `toEqual(["Refusing rls_roles: it would commit"])`, `connects` 0, `code` 2; `:225-226` - real files `toBe(0)`, `connects` 9 | PASS |
| C212 | ECONNREFUSED fails that recipe, rest run, exit 1 | `C212: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:232-235` - `toBe("FAIL catalog_seed: connect ECONNREFUSED")`, `connects` 9, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C213 | no output contains password or URL | `C213: ...` passed at 957d76d | `web/scripts/test-db/runner.test.ts:247-248` - `expect(all).not.toContain("s3cr3t-pw")`, `expect(all).not.toContain(URL_VALUE)` | PASS |
| C214 | script, exact pg devDependency, env example line, no public variant; `test:db nope` exits 2 | `C214: ...` passed at 957d76d; shell `npm run test:db nope` exit 2 | `web/scripts/test-db/wiring.test.ts:21-29` - `toMatch(/^\d+\.\d+\.\d+$/)`, `dependencies.pg` `toBeUndefined()`, `toContain("SUPABASE_DB_URL=")`, `expect(offenders).toEqual([])`; `web/package.json:29` `"pg": "8.23.1"` | PASS |
| C215 | live: `npm run test:db` twice, 9 PASS, `9 passed, 0 failed`, exit 0 | `npm run test:db` run twice at 957d76d by this Verifier | both runs: `PASS catalog_seed`, `PASS domain_constraints`, `PASS events_outbox`, `PASS rls_isolation`, `PASS rls_roles`, `PASS transitions`, `PASS demo_owner`, `PASS staff_screens`, `PASS demo_seed`, `9 passed, 0 failed`, exit 0. The round-2 failures now hold: `supabase/tests/demo_owner.sql:20` (`C23`, `= 0`) and `supabase/tests/demo_seed.sql:114` (`C17 memberships`, `= 0`), because `supabase/tests/fixture.sql:160` removes the demo org inside the transaction. The live demo org is unchanged afterwards (MCP SELECT: 1 org, 12 agreements, 1 membership) | PASS |
| C216 | live: 4 recipes pass | `npm run test:db rls_isolation rls_roles transitions staff_screens` at 957d76d by this Verifier | output `PASS rls_isolation`, `PASS rls_roles`, `PASS transitions`, `PASS staff_screens`, `4 passed, 0 failed`, exit 0; `staff_screens` start guard still asserts at `supabase/tests/staff_screens.sql:47` | PASS |
| C217 | advisors: exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` | carried from 2ead534: MCP `get_advisors(gnxebrtcpbujhvcamtoe, security)` run by the round-2 Verifier on 2026-10-26; not re-run (no schema or migration changed since) | response had 2 lints: `rls_enabled_no_policy` (1 finding, `public.outbox`) and `auth_leaked_password_protection` (1), and nothing else. Recorded at `CONTEXT.md:163-164` (lines re-confirmed at 957d76d) | PASS |
| C218 | CONTEXT.md names both findings with reasons; "How to run the tests" has the three commands | `C218: ...` passed at 957d76d against the edited `CONTEXT.md` | `web/scripts/test-db/wiring.test.ts:36-37` - `toMatch(/AD-016/)`, `toMatch(/magic link/i)`; `:41-46` - `toContain("npm test")`, `toContain("npm run test:db")`, `toMatch(/Playwright MCP/)`, widths 375/768/1440, `/touch/`, `/console/` | PASS |
| C219 | live journey at 2 sizes, documents 200, org name in the shell | author-run (Playwright MCP, 2026-10-26, after 3589944), not run by this Verifier | `.specs/features/phase1-validation/checks.md:192` - at 1440x900 and at 375x812 (touch emulation), all five pages show "Kettle Ridge Mechanical Ltd.". At 375 px the drawer was opened on every page, which closes round 2's precision note. The 200 for each document is at `:188-189`. The emailed-link sign-in is at `:186` | PASS |
| C220 | live: no console error/warning; no request >= 400 or failed, except a router cancel (`ERR_ABORTED`) after a `200` response (narrowed, user-approved) | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:192` - both sizes: 0 console errors or warnings, 0 responses >= 400, 0 failed requests other than router cancels, each of which received `200` first (desktop 4: three `?_rsc=` GETs + the settings POST; mobile 5: four `?_rsc=` GETs + the settings POST). Narrowed wording at `checks.md:125-128`, plan AC 15 at `plan.md:113` | PASS |
| C221 | live: unchanged save shows "Settings saved" | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:192` - "Settings saved" at both sizes | PASS |
| C222 | live: sign out lands on `/login`; `GET /pipeline` answers 307 to `/login` | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:192` - mobile "Sign out" -> `/login`; `GET /pipeline` -> `307`, `location: /login` | PASS |

## Findings

None of these fails the feature.

1. **Live proofs not reproduced (C219-C222).** They rest on the author's record at `checks.md:192`. The independence this gate gives is weaker for these rows.
2. **Precision note, C220.** The narrowed exception names "a request the Next.js router cancels". The author counts the settings form POST as one of these cancels at both sizes (`checks.md:192`). A server-action POST that answered `200` and was then aborted reads as inside the exception, but the record does not show the request list. If the user meant the exception to cover only `?_rsc=` navigation streams, the POST is outside it.
3. **Redundancy, not a defect.** `supabase/tests/staff_screens.sql:45` still deletes the demo org, and `supabase/tests/fixture.sql:160` now does too. The second delete is a no-op.

## Round-3 code review: `supabase/tests/fixture.sql:158-160`

- **Correct.** The statement is the last one in the fixture, so it runs after `begin;` at `fixture.sql:3` and inside the recipe's transaction. Every recipe ends in `rollback`, and the live counts after both runs confirm the rollback (1 org, 12 agreements, 1 membership, as before). The `delete` cascades: every tenant table references `public.orgs (id) on delete cascade` (`supabase/migrations/20261019174738_init.sql:17` onward). The memberships table also cascades from `auth.users`, so the live demo owner's `auth.users` row is untouched. The fixture hardcodes the UUID because `tests.demo()` is defined only in the test files. The value matches `demo_owner.sql:6`, `demo_seed.sql:19` and `staff_screens.sql:7`.
- **Does any recipe rely on the demo org existing?** No. Only `demo_owner.sql`, `demo_seed.sql` and `staff_screens.sql` reference the demo org (searched for `de30` and `tests.demo` across `supabase/tests/*.sql`). All three run the seed themselves through `SEED_BODY` (`demo_owner.sql:9-17`, `staff_screens.sql:49`, and the `demo_seed` recipe's two seed bodies), so they start from "no demo org", as they were written to. No other recipe counts `public.orgs` without an id filter: `domain_constraints.sql:193-199` and `rls_isolation.sql:101` filter by their own fixture org ids. All 9 recipes pass live.
- **Did any assertion weaken?** No. The diff since round 2 touches only `fixture.sql`, and only to add the `delete`. No `tests.ok(...)` call changed. `demo_owner` C23 (`demo_owner.sql:20`) and `demo_seed` C17 (`demo_seed.sql:114`) still assert `= 0` memberships after a seed run without `app.demo_owner_email`. That is still meaningful, because the start state now really has zero.

## Swept existing

Re-read at 957d76d:

- **Failure modes:** present. `supabase/tests/fixture.sql:3` opens with `begin;`, and every recipe ends in `rollback`. Two identical live runs leave the demo org's counts unchanged.
- **Data lifecycle and idempotency:** present. The commit guard in `web/scripts/test-db/runner.mts` runs before any connection (C211), and the real recipes, including the new `delete`, do not trip it. The fixture's `delete` is undone by the rollback, so the suite still creates and removes nothing that outlives its run.
- **Concurrency:** n/a (approved policy).

## Gate

- `npx vitest run scripts composition --reporter=verbose`: 30 passed, 0 failed.
- `npm run test:db nope`: exit 2.
- `npm run test:db` (x2): 9 passed, 0 failed, exit 0 each.
- `npm run test:db rls_isolation rls_roles transitions staff_screens`: 4 passed, 0 failed, exit 0.
