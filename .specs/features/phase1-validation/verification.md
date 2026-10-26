# Phase 1 validation verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 66df3c5..2ead534
**Round**: 2 - full
**Verifier**: independent sub-agent (author != verifier)

FAIL for two checks. **C215** fails at HEAD against the live project as it is now: `demo_owner` and `demo_seed` fail on both runs (`7 passed, 2 failed`, exit 1). The live journey needed the demo owner's membership seeded, and those two SQL tests assume the demo org has no members. **C220** fails as written: at 375x812 the recorded network log holds `ERR_ABORTED` requests, and the check forbids "a failed status" with no exception. The other 20 checks pass. C219, C221 and C222 pass on evidence the author recorded. I did not run them.

Round 1 (at 5ee0adc) found 16/22 passing. It found C215, C216 and C219-C222 blocked: no URL and no demo owner. It also found two precision gaps: C218 only checked for the word "Playwright", and C206 had no negative case for `demo_seed_rerun: pass`. Round 2 closes both gaps (e801e53, see C206 and C218 below).

All sections below verified at 2ead534.

## Binding sources

The plan marks no source as binding. Profile `light`, so step 1 does not run.

## Checks

Vitest: `cd web && npx vitest run scripts composition --reporter=verbose` at 2ead534. Exit 0, 30 passed (25 `C2xx:` tests in `web/scripts/test-db/runner.test.ts` and `wiring.test.ts`, 5 composition tests), and each test is listed by name. I also ran the full `npx vitest run` as a regression check: 31 files, 416 passed. Shell: `cd web && npm run test:db nope; echo $?` printed `Unknown recipe: nope`, then the recipe list, and `EXIT=2`. Live DB (approved, every recipe rolls back): `npm run test:db` ran twice and `npm run test:db rls_isolation rls_roles transitions staff_screens` ran once, at 2ead534 on 2026-10-26. MCP: `get_advisors(gnxebrtcpbujhvcamtoe, security)` ran 2026-10-26.

C219-C222 were **run by the author, not by this Verifier**. They need the user's signed-in browser session, and this Verifier was told not to sign in. Their rows judge the evidence recorded in the `checks.md` Handoff (2026-10-26 live bullets). Their code changed after round 1 (0562a7b). The Handoff records that the 1440x900 and 375x812 passes ran after that fix, and 2ead534 is docs only.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C201 | recipe list and parts, in order | `C201: the recipe list and each recipe's parts` passed | `web/scripts/test-db/runner.test.ts:80` - `expect(RECIPES.map((recipe) => recipe.name)).toEqual(ALL)`; `:87` - `expect(parts.demo_seed).toEqual(["fixture.sql", "SEED_BODY", "demo_seed.sql", "SEED_BODY", "demo_seed_rerun.sql"])` | PASS |
| C202 | seed body drops only begin;/commit;, exact SEED_BODY replaced, joined in order | `C202: ...` passed | `web/scripts/test-db/runner.test.ts:92` - `expect(seedBody(seed)).toBe("-- head\ninsert into a values (1);\n  -- begin; inside a comment stays\n")`; `:103`, `:106` - `assembleRecipe(...)` `toBe(...)` for staff_screens and demo_seed | PASS |
| C203 | 9 connections in order, one query each, closed, PASS each | `C203: ...` passed | `web/scripts/test-db/runner.test.ts:114-117` - `expect(f.connects).toBe(9)`, `expect(f.sent).toHaveLength(9)`, `expect(f.ended).toBe(9)`, `expect(f.out.slice(0, 9)).toEqual(ALL.map((name) => \`PASS ${name}\`))` | PASS |
| C204 | `9 passed, 0 failed`, exit 0 | `C204: ...` passed | `web/scripts/test-db/runner.test.ts:123-124` - `expect(f.out.at(-1)).toBe("9 passed, 0 failed")`; `expect(code).toBe(0)` | PASS |
| C205 | third recipe fails, rest run, `8 passed, 1 failed`, exit 1 | `C205: ...` passed | `web/scripts/test-db/runner.test.ts:132-136` - `toContain("FAIL events_outbox: C3: anon can read")`, `connects` 9, 8 PASS lines, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C206 | pass only on last row `<last file>: pass`; demo_seed expects `demo_seed: pass` | 5 `C206:` tests passed | `web/scripts/test-db/runner.test.ts:147-149` - `toMatch(/^FAIL rls_roles: /)`, `toBe("0 passed, 1 failed")`, `code` 1; `:154` - `expect(await runSuite(f.io)).toBe(0)`; `:156-157` (new) - `demo_seed_rerun: pass` gives `toBe(1)` and `toMatch(/^FAIL demo_seed: /)` | PASS |
| C207 | `rls_roles rls_isolation` only, in that order | `C207: ...` passed | `web/scripts/test-db/runner.test.ts:169` - `expect(f.out).toEqual(["PASS rls_roles", "PASS rls_isolation", "2 passed, 0 failed"])` | PASS |
| C208 | `nope`: message, 9 names, exit 2, 0 connections | `C208: ...` passed | `web/scripts/test-db/runner.test.ts:177-180` - `toBe("Unknown recipe: nope")`, each name, `connects` 0, `code` 2 | PASS |
| C209 | URL unset / "" / "  ": message, exit 2, 0 connections | 3 `C209:` tests passed | `web/scripts/test-db/runner.test.ts:190-192` - `expect(f.out).toEqual(["SUPABASE_DB_URL is not set (see web/.env.example)"])`, `connects` 0, `code` 2 | PASS |
| C210 | orphan refused; all 11 real files in a recipe | `C210: ...` passed | `web/scripts/test-db/runner.test.ts:198-204` - `toEqual(["Not in any recipe: orphan.sql"])`, `connects` 0, `code` 2, `expect(REAL_FILES).toHaveLength(11)`, `expect(covered.has(file), file).toBe(true)` | PASS |
| C211 | commit refused before connecting; real recipes do not trip | 5 `C211:` tests passed | `web/scripts/test-db/runner.test.ts:214-216` - `toEqual(["Refusing rls_roles: it would commit"])`, `connects` 0, `code` 2; `:225-226` - real files `toBe(0)`, `connects` 9 | PASS |
| C212 | ECONNREFUSED fails that recipe, rest run, exit 1 | `C212: ...` passed | `web/scripts/test-db/runner.test.ts:232-235` - `toBe("FAIL catalog_seed: connect ECONNREFUSED")`, `connects` 9, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C213 | no output contains password or URL | `C213: ...` passed | `web/scripts/test-db/runner.test.ts:247-248` - `expect(all).not.toContain("s3cr3t-pw")`, `expect(all).not.toContain(URL_VALUE)` | PASS |
| C214 | script, exact pg devDependency, env example line, no public variant; `test:db nope` exits 2 | `C214: ...` passed; shell exit 2 with `Unknown recipe: nope` | `web/scripts/test-db/wiring.test.ts:21-29` - `toMatch(/^\d+\.\d+\.\d+$/)`, `dependencies.pg` `toBeUndefined()`, `toContain("SUPABASE_DB_URL=")`, `expect(offenders).toEqual([])`; `web/package.json:29` `"pg": "8.23.1"` | PASS |
| C215 | live: `npm run test:db` twice, 9 PASS, `9 passed, 0 failed`, exit 0 | `npm run test:db` run twice at 2ead534: both runs `7 passed, 2 failed`, exit 1 | both runs: `FAIL demo_owner: C23: a membership was inserted without app.demo_owner_email` (`supabase/tests/demo_owner.sql:20`, `count(*) from public.memberships where org_id = tests.demo()) = 0`) and `FAIL demo_seed: C17 memberships: demo has members` (`supabase/tests/demo_seed.sql:114`, same `= 0`). The two runs match, so the rollback holds | FAIL |
| C216 | live: 4 recipes pass | `npm run test:db rls_isolation rls_roles transitions staff_screens` at 2ead534 | output `PASS rls_isolation`, `PASS rls_roles`, `PASS transitions`, `PASS staff_screens`, `4 passed, 0 failed`, exit 0; the `staff_screens` start guard is still at `supabase/tests/staff_screens.sql:47` | PASS |
| C217 | advisors: exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` | MCP `get_advisors(gnxebrtcpbujhvcamtoe, security)` run by this Verifier | response: 2 lints - `rls_enabled_no_policy` count 1, finding ``Table `public.outbox` ``; `auth_leaked_password_protection` count 1; nothing else. Recorded at `CONTEXT.md:163-164` | PASS |
| C218 | CONTEXT.md names both findings with reasons; "How to run the tests" has the three commands | `C218: ...` passed | `web/scripts/test-db/wiring.test.ts:36-37` - `toMatch(/AD-016/)`, `toMatch(/magic link/i)`; `:41-46` - `toContain("npm test")`, `toContain("npm run test:db")`, `toMatch(/Playwright MCP/)`, widths 375/768/1440, `/touch/`, `/console/` | PASS |
| C219 | live journey at 2 sizes, documents 200, org name in the shell | author-run (Playwright MCP, 2026-10-26), not run by this Verifier | `.specs/features/phase1-validation/checks.md:187` - 1440x900: five pages each document `200`, shell shows "Kettle Ridge Mechanical Ltd."; `:188` - 375x812 touch: same five pages, org name in the navigation drawer, which is part of the shell and visible after tapping "Open navigation". Sign-in by emailed link at `:185` | PASS |
| C220 | live: no console error/warning; no request >= 400 or failed | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:187` - 1440: 0 console, 0 >= 400, 0 failed; `:188` - 375: 0 console, 0 >= 400, but each client navigation's `?_rsc=` request is recorded as `ERR_ABORTED`, a failed status, which the check forbids without exception | FAIL |
| C221 | live: unchanged save shows "Settings saved" | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:187` and `:188` - "Settings saved" at both sizes | PASS |
| C222 | live: sign out lands on `/login`; `GET /pipeline` answers 307 to `/login` | author-run, not run by this Verifier | `.specs/features/phase1-validation/checks.md:188` - "Sign out" lands on `/login`; `GET /pipeline` answers `307`, `location: /login` | PASS |

## Findings

1. **C215 fails at HEAD against the live project.** See `supabase/tests/demo_owner.sql:20` and `supabase/tests/demo_seed.sql:114`. Both assert that the demo org has zero memberships. The seed run for the live journey (`checks.md:185`, "owner membership") made that false on the live project. The Handoff's C215 green (`checks.md:184`) was recorded before that seed run. It is stale at HEAD. Round 2 fixed the same class of bug only in `staff_screens.sql`, which now deletes the demo org inside its transaction. The suite and the live journey now need incompatible live states: C215 cannot be green while C219-C222 are possible. The carried claim that the same runs settle auth-magic-link C22 and C23 (`checks.md:184`) is also stale, because `demo_owner` holds C23. The likely fix is the same treatment as `staff_screens.sql`: delete the demo org or its memberships inside the transaction before the start state is asserted. That is a builder's call.
2. **C220 fails as written.** The check says "no request with status >= 400 or a failed status". At 375x812 the recorded log has `ERR_ABORTED` on `?_rsc=` streams (`checks.md:188`). The author explains these as the router closing a stream that had already answered 200, while the page stayed. That explanation is plausible, but it was not proven: the Handoff gives no request list, and I could not reproduce it. The check also has no exception for it. Fixing this means either amending C220 with the user's approval (for example, excluding `ERR_ABORTED` on `_rsc` requests whose response status was 200) or removing the aborts. It is not something to accept silently.
3. **Precision note, C219 (does not fail it).** At 375x812 the org name sits in the drawer, which is part of the mobile shell, so I read "shows the demo org's name in the shell" as met. The record does not say whether the drawer was opened on every page or only once.
4. **Live proofs not reproduced.** C219, C221 and C222 rest on the author's record alone. The independence this gate is meant to give is weaker for these rows.

## Round-2 code review

- `web/composition/index.ts:29-30`: `await connection()` comes before `cookies()`, after the two env checks. Next 16.4.2's `connection()` from `next/server` defers to request time, which is right for a client that reads the clock. Because it runs after `required(...)`, the C23 "names the missing env var" errors still throw first. Nothing in `web/app` or `web/composition` uses `use cache` or `generateStaticParams`, where `connection()` would conflict. Correct.
- `web/composition/composition.test.ts:9`: `vi.mock("next/server", () => ({ connection: async () => {} }))` matches the existing `next/headers` stub. No assertion changed (the diff is one added line). Full suite 416/416.
- `supabase/tests/staff_screens.sql:45`: `delete from public.orgs where id = tests.demo();` runs inside the fixture's transaction, which ends in rollback, so the live demo org is restored. The `C120 start` guard at `:47` is unchanged and still asserts count 0 before the seed, so the first-run insert is still real. `:97`: `orgB` now comes from `fixture.sql:112` instead of being inserted again. The membership insert at `:102` is for a different user (`userB`), so it does not clash with the fixture's `uB`. The diff changes no `tests.ok(...)` call. No assertion was weakened.
- Round-2 test edits strengthen the tests: `runner.test.ts:155-157` adds a negative case, and `wiring.test.ts:43-46` tightens a match and adds three more.

## Swept existing

Re-read at 2ead534:

- failure modes: `supabase/tests/fixture.sql` opens with `begin;`. Every recipe ends in a `rollback`, and the live runs confirm it: two identical runs, and the demo org and membership survive. Present.
- data lifecycle and idempotency: the commit guard in `web/scripts/test-db/runner.mts` runs before any connection (C211). Present. The live state did change between rounds, but through the seed run with the user's go-ahead, not through the suite.
- concurrency: n/a (approved policy).

## Gate

`npx vitest run scripts composition --reporter=verbose` - 30 passed, 0 failed. `npx vitest run` - 416 passed, 0 failed. `npm run test:db nope` - exit 2. `npm run test:db` (x2) - 7 passed, 2 failed, exit 1. `npm run test:db rls_isolation rls_roles transitions staff_screens` - 4 passed, 0 failed, exit 0.
