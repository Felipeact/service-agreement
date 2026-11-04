# Task library page verification

**Verdict**: PASS
**Profile**: light
**Diff range**: d9aab38..bd8621bbf57b26225af2cedbcfc2f58d5bf24d17
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

`light` is the profile floor: no fault injection, no Coverage recompute and no Test policy section were run. No binding sources are named in the plan, so there is no Step 1 comparison. Paths below are under `web/` unless they start with `supabase/` or `.specs/`.

**Re-run in this round (verified at bd8621b)**: the proofs (Gate section), C1439 and C1416. **Carried from 7c5db14**: the C1407-C1438 rows, the Level and precision notes, Swept existing rows and Diff hygiene. `git diff 7c5db14..HEAD --stat` shows only two files changed, both under `.specs/`: `checks.md` (+1 line, the Handoff sidebar observation) and `verification.md` (the round 1 report). No `.ts`, `.tsx`, `.sql` or test file changed, so every code-level verdict carries forward.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |

| C1439 | live as the demo owner: types listed, a default-months change and an added seasonal task save and survive a reload, sidebar item is current, console has no errors | not re-run by the Verifier: author-side live check, accepted under `light`; unit counterpart C1416 re-run at this HEAD (5 tests passed) | `.specs/features/task-library-page/checks.md:261` (Handoff "Live C1439") records the list of 40 types, the save and reload (defaults 4 and 10, 11 tasks, last `[3,4,5]`), the blank-description error and "Console: no errors after the restart". `.specs/features/task-library-page/checks.md:262` (Handoff "Live C1439, sidebar") now records that the Task library item has `aria-current="page"` on `/task-library` and on `/task-library?type=BOILER`, and has none on `/imports` (1440 px, same signed-in context). Unit level, re-run: `components/shell/nav-items.test.ts:79` - `expect(link.includes('aria-current="page"')).toBe(current)` over 5 paths (C1416, all 5 ran green) | PASS (round 1 gap closed: the sidebar clause now has a recorded observation; author-side, not independently re-run) |

## Level, sampling and precision

Carried from 7c5db14, non-failing notes:

- Level: C1411 and C1412 name a route and a redirect and are proven at the page-function level with `next/navigation` mocked; the checks defer the 200 and the redirect to live C1439, accepted under `light`. C1430 runs against the recording stub; C1427 and C1435 run in a real rolled-back transaction.
- Sampling: every set is proven over its whole set. The `admin` role has no action-level test (C1432 runs as owner only) although the coverage table lists `admin` under C1432; `canEditTaskLibrary` for admin is asserted in C1413, so this is a coverage-table precision gap, not an unproven behaviour.
- Precision gaps in the checks:
  - C1408 asserts month labels with `toContain("Oct")` and `toContain("Mar, Jun, Sep, Dec")`, not tied to the row of each type.
  - C1432 and C1433 claim `{ status, values }`; only `status` is asserted for `saved` and `forbidden`.
  - C1435 claims the "admin of another org"; the test acts as `uB`, an owner of org B (recorded in the Handoff). Both pass `has_org_role(owner, admin)`.
  - C1423 titles read "is accepted" for the three rejected cases (visible again in the verbose output this round); the assertion is correct.
  - C1416: the `/task-library?type=RTU` case passes only through the `pathname.split("?")[0]` added to `components/shell/sidebar-nav.tsx`; the real `usePathname` never carries a query string. The live observation on `?type=BOILER` (checks.md:262) is consistent with this.
  - C1427 atomicity is shown as one failed statement inside `tests.expect_error`'s exception block rolling back, then the old rows intact; matches a single rpc call.
  - Citation drift: the C1438 row cites `checks.md:262` for the Handoff "Live C1438" text; after the added line it sits at `checks.md:263`. The observation itself is unchanged.

## Swept existing rows

Carried from 7c5db14, unchanged (no code or migration changed): authorization (`init.sql:303-314`, function `security invoker`), concurrency (advisory lock at `migrations/20261104120000_task_library.sql:47`), dependency failure (`infrastructure/supabase/task-library.ts:26`, `app/(app)/error.tsx`), data lifecycle (`site_service_scope` reads live, C1437), `private.is_visit_months` exists (`migrations/20261030120000_cadence.sql:7`).

## Diff hygiene (edited pre-existing assertions)

Carried from 7c5db14: the only removed pre-existing assertions are the authorised `nav-items.test.ts` replacements and the one-step pins in `scripts/test-db/runner.test.ts`. Nothing since: `git diff 7c5db14..HEAD --stat` lists no test file.

## Gate

Verified at bd8621b:

`npx vitest run <8 targets> --reporter=verbose` (domain, infrastructure, month-grid, task-library view, page and action, nav-items, composition, `scripts/test-db`) - Test Files 9 passed (9), Tests 129 passed (129), 0 failed; every named `C1407:` to `C1434:` test appeared individually in the verbose output (C1407-C1420, C1422-C1425, C1428-C1434; C1421, C1426, C1427, C1435-C1437 are SQL assertions).
`npm run test:db task_library` - `PASS task_library`, 1 passed, 0 failed (rolled back; no other recipe run, nothing applied).
`npx tsc --noEmit` - exit 0, no output.
`npm run lint` - exit 0, no warnings.

## Ranked gaps

None blocking. The round 1 gap (C1439 sidebar clause) is closed by `.specs/features/task-library-page/checks.md:262`. The minor precision notes above stay non-failing.
