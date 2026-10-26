# Phase 1 validation verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 66df3c5..5ee0adc
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

FAIL because 6 of 22 checks have no proof run: C215, C216 (need the live database, which needs the user's go-ahead and `SUPABASE_DB_URL`) and C219-C222 (need the demo owner, open question 1). These are blocked, not broken. All 16 runnable checks pass with located evidence. No check is contradicted by the code.

## Binding sources

The plan marks no source as binding (Sources: ROADMAP, AGENTS..md, earlier specs; Surface: none). Profile `light`, so step 1 does not run.

## Checks

Vitest run: `cd web && npx vitest run scripts --reporter=verbose` at 5ee0adc, exit 0, 25 passed, every named test listed individually below. Test files `web/scripts/test-db/runner.test.ts` and `web/scripts/test-db/wiring.test.ts` are both new in 2a6c2df.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C201 | recipe list and parts, in order | `C201: the recipe list and each recipe's parts` passed | `web/scripts/test-db/runner.test.ts:80` - `expect(RECIPES.map((recipe) => recipe.name)).toEqual(ALL)`; `:83` `toEqual(["fixture.sql", \`${name}.sql\`])`; `:87` `expect(parts.demo_seed).toEqual(["fixture.sql", "SEED_BODY", "demo_seed.sql", "SEED_BODY", "demo_seed_rerun.sql"])` | PASS |
| C202 | seed body drops only begin;/commit;, exact SEED_BODY line replaced, parts joined in order | `C202: ...` passed | `web/scripts/test-db/runner.test.ts:92` - `expect(seedBody(seed)).toBe("-- head\ninsert into a values (1);\n  -- begin; inside a comment stays\n")`; `:103-107` - staff_screens keeps `  SEED_BODY x`, demo_seed `toBe(["F1\n", body, "D\n", body, "R\n"].join("\n"))` | PASS |
| C203 | no arg: 9 connections in order, one query each, closed, PASS each | `C203: ...` passed | `web/scripts/test-db/runner.test.ts:114-117` - `expect(f.connects).toBe(9)`, `expect(f.sent).toHaveLength(9)`, `expect(f.ended).toBe(9)`, `expect(f.out.slice(0, 9)).toEqual(ALL.map((name) => \`PASS ${name}\`))` | PASS |
| C204 | `9 passed, 0 failed`, exit 0 | `C204: ...` passed | `web/scripts/test-db/runner.test.ts:123-124` - `expect(f.out.at(-1)).toBe("9 passed, 0 failed")`; `expect(code).toBe(0)` | PASS |
| C205 | third recipe fails, rest run, `8 passed, 1 failed`, exit 1 | `C205: ...` passed | `web/scripts/test-db/runner.test.ts:132-136` - `toContain("FAIL events_outbox: C3: anon can read")`, `connects` 9, 8 PASS lines, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C206 | pass only on last row `<last file>: pass`; demo_seed expects `demo_seed: pass` | 5 `C206:` tests passed | `web/scripts/test-db/runner.test.ts:147-149` - `toMatch(/^FAIL rls_roles: /)`, `toBe("0 passed, 1 failed")`, `code` 1 over no rows / different text / pass not last / other file's pass; `:154` - `expect(await runSuite(f.io)).toBe(0)` for `demo_seed: pass` | PASS |
| C207 | `rls_roles rls_isolation` runs only those, in that order | `C207: ...` passed | `web/scripts/test-db/runner.test.ts:166-167` - `expect(f.out).toEqual(["PASS rls_roles", "PASS rls_isolation", "2 passed, 0 failed"])`, `connects` 2 | PASS |
| C208 | `nope`: message, 9 names, exit 2, 0 connections | `C208: ...` passed | `web/scripts/test-db/runner.test.ts:174-177` - `toBe("Unknown recipe: nope")`, each name in output, `connects` 0, `code` 2 | PASS |
| C209 | URL unset / "" / "  ": message, exit 2, 0 connections | 3 `C209:` tests passed | `web/scripts/test-db/runner.test.ts:187-189` - `expect(f.out).toEqual(["SUPABASE_DB_URL is not set (see web/.env.example)"])`, `connects` 0, `code` 2 | PASS |
| C210 | orphan file refused; all 11 real files in a recipe | `C210: ...` passed | `web/scripts/test-db/runner.test.ts:195-201` - `toEqual(["Not in any recipe: orphan.sql"])`, `connects` 0, `code` 2, `expect(REAL_FILES).toHaveLength(11)`, `expect(covered.has(file), file).toBe(true)` | PASS |
| C211 | commit (any case, `commit work;`) refused before connecting; real recipes do not trip | 5 `C211:` tests passed | `web/scripts/test-db/runner.test.ts:211-213` - `toEqual(["Refusing rls_roles: it would commit"])`, `connects` 0, `code` 2 over `commit;`, `COMMIT;`, `  commit work;`, `Commit Work ;`; `:222-223` real files `toBe(0)`, `connects` 9 | PASS |
| C212 | ECONNREFUSED fails that recipe, rest run, exit 1 | `C212: ...` passed | `web/scripts/test-db/runner.test.ts:229-232` - `toBe("FAIL catalog_seed: connect ECONNREFUSED")`, `connects` 9, `toBe("8 passed, 1 failed")`, `code` 1 | PASS |
| C213 | no output contains password or URL (pass, fail, connection error) | `C213: ...` passed | `web/scripts/test-db/runner.test.ts:244-245` - `expect(all).not.toContain("s3cr3t-pw")`, `expect(all).not.toContain(URL_VALUE)` over the 3 runs at `:236-240` | PASS |
| C214 | script, exact pg devDependency, env example line, no public variant; `npm run test:db nope` exits 2 | `C214: ...` passed; shell `cd web && npm run test:db nope; echo $?` printed `Unknown recipe: nope`, the recipe list, exit 2 | `web/scripts/test-db/wiring.test.ts:20-29` - `toMatch(/^\d+\.\d+\.\d+$/)` on `devDependencies.pg`, `dependencies.pg` `toBeUndefined()`, `toContain("SUPABASE_DB_URL=")`, `expect(offenders).toEqual([])`; `web/package.json:29` `"pg": "8.23.1"` | PASS |
| C215 | live: `npm run test:db` twice, 9 PASS, exit 0 | not run - needs `SUPABASE_DB_URL` and the user's go-ahead (touches the live production project) | no evidence | BLOCKED - not proven |
| C216 | live: 4 recipes pass | not run - same reason as C215 | no evidence | BLOCKED - not proven |
| C217 | advisors: exactly `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection` | MCP `get_advisors(gnxebrtcpbujhvcamtoe, security)` run 2026-10-26 | response: 2 lints - `rls_enabled_no_policy` count 1, finding `public.outbox`; `auth_leaked_password_protection` count 1; nothing else. Recorded at `CONTEXT.md:163-164` | PASS |
| C218 | CONTEXT.md names both findings with reasons and a "How to run the tests" section with the three commands | `C218: ...` passed | `web/scripts/test-db/wiring.test.ts:36-43` - `expect(outbox).toMatch(/AD-016/)`, `expect(password).toMatch(/magic link/i)`, section `toContain("npm test")`, `toContain("npm run test:db")`, `toMatch(/Playwright/)` | PASS |
| C219 | live journey at 2 sizes, 200s, org name | not run - demo owner not provisioned (open question 1) | no evidence | BLOCKED - not proven |
| C220 | live: no console error/warning, no failed request | not run - same as C219 | no evidence | BLOCKED - not proven |
| C221 | live: "Settings saved" | not run - same as C219 | no evidence | BLOCKED - not proven |
| C222 | live: sign out to `/login`, `/pipeline` 307 | not run - same as C219 | no evidence | BLOCKED - not proven |

## Findings

1. Unproven (blocked): C215, C216, C219, C220, C221, C222 - no proof run, no evidence. These keep the verdict FAIL until run.
2. Precision gap, C218 - `web/scripts/test-db/wiring.test.ts:43` asserts only that the word `Playwright` appears in the section, while the check claims "the live Playwright procedure". The section does carry it (`CONTEXT.md` "Web validation" bullet, read by hand), but the test would pass on a section that only mentions the word.
3. Precision gap, C206 - `web/scripts/test-db/runner.test.ts:152-154` proves `demo_seed` passes on `demo_seed: pass`, but no case shows that `demo_seed_rerun: pass` (the literal last file name) fails for `demo_seed`. The claim is met by the positive case; the negative is unasserted.
4. Minor, C214 - `web/scripts/test-db/wiring.test.ts:20` asserts only that `scripts["test:db"]` is a string; the shell proof (exit 2 with `Unknown recipe: nope`) is what shows it reaches the runner. Together they meet the check.

No proof contradicts its check, and the code (`web/scripts/test-db/runner.mts`) contradicts no check.

## Swept existing

- failure modes, "a recipe that raises aborts its own transaction": `supabase/tests/fixture.sql:3` is `begin;` and every test file that ends a recipe has a `rollback` line (`demo_seed.sql` has none but is followed by `demo_seed_rerun.sql`, which does). Constraint present.
- data lifecycle / idempotency: same `begin;` ... `rollback` shape, plus the commit guard at `web/scripts/test-db/runner.mts:41` (`/^\s*commit(\s+work)?\s*;/im`) checked before any connection (`:111-115`). Present.
- concurrency: n/a (approved policy).

## Gate

`npx vitest run scripts --reporter=verbose` - 25 passed, 0 failed. `npm run test:db nope` - exit 2.
