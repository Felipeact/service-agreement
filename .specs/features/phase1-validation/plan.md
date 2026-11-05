# Phase 1 validation: one command for the SQL suite, RLS and advisors, and the signed-in journey

## Problem

Phase 1 cannot be called done, and nobody but an agent can tell whether it still works.

- The 11 files in `supabase/tests/` prove RLS isolation, roles, constraints, the transition RPCs
  and the seeds, but they only run when an agent with the Supabase MCP pastes `fixture.sql` and a
  test file into `execute_sql`. Three of them need hand assembly first: `demo_owner.sql` and
  `staff_screens.sql` need the `SEED_BODY` line replaced by `seed.sql` without its
  `begin;`/`commit;` lines, and `demo_seed.sql` needs the seed body twice and
  `demo_seed_rerun.sql` after it. The owner cannot run any of them from a terminal, and a new test
  file that nobody adds to the routine is never run.
- 17 proofs from the two last features have never been run: auth-magic-link C8, C18, C21, C22,
  C23 and 12 of staff-screens (its verification is `FAIL`, "12 owe a proof nobody has run"). All
  of them wait on the demo owner being provisioned on the live project.
- Nobody has walked the whole signed-in path in one session: each feature proved its own pages.
- The Supabase security advisors report two findings today (`rls_enabled_no_policy` on
  `public.outbox`, `auth_leaked_password_protection`), and nothing records whether either is
  accepted.

The source (ROADMAP.md Phase 1, last item: "Vitest unit tests, RLS isolation check, Playwright
validation") gives no further evidence. Vitest already exists (AD-013, 390 tests green).

When this ships, the owner runs `npm run test:db` and sees every SQL test pass or fail by name;
the advisors list only accepted findings; and Phase 1 is ticked because every one of its proofs
has run, not because the code exists.

## Flow

Reuses the existing SQL test files, `fixture.sql`, `tests.ok` / `tests.expect_error`, the
`<name>: pass` last line every file already returns, and the live-proof procedure of AGENTS.md. No
test is rewritten.

1. `npm run test:db [recipe...]` in `web/` -> the runner (door 1) reads `SUPABASE_DB_URL` and the
   recipe list (door 2), and checks that every `supabase/tests/*.sql` file belongs to a recipe.
2. the runner assembles each recipe's text from `supabase/tests/*.sql` and `supabase/seed.sql`
   (exist), refuses it if it contains a `commit`, and sends it on its own connection as one
   simple query.
3. Postgres (exists) runs it inside the fixture's transaction; the file's `rollback` leaves
   nothing behind, and an exception aborts the transaction.
4. out: one line per recipe and a summary on stdout, exit code 0, 1 or 2.
5. the Supabase security advisors (exist, MCP `get_advisors`) are compared with the accepted
   list in `CONTEXT.md`.
6. a real browser on `npm run dev` walks login -> `/pipeline` -> `/customers` -> a customer ->
   a site -> `/settings` -> sign out as the demo owner, through `web/proxy.ts`, `MemberGate` and
   the read ports (exist).

## Impact

| Front | What changes |
| --- | --- |
| tooling | new script `test:db` in `web/package.json`; new dev dependency `pg` (door 1) |
| config | new server-only variable `SUPABASE_DB_URL` in `web/.env.local`, listed with an empty value in `web/.env.example` |
| test files | none edited; each gets a recipe (door 2). Their header comments keep describing the MCP path, which still works |
| stored data | nothing to migrate. Every recipe rolls back. Provisioning the demo owner (open question 1) changes live data once and needs the user's go-ahead |
| earlier features | auth-magic-link and staff-screens get their pending proofs run and a scoped re-verification; neither changes its checks |
| docs | `CONTEXT.md` gets "How to run the tests" and the accepted advisor findings; `ROADMAP.md` ticks the auth item and this item once both re-verifications pass |

## Relations

None - no stored-data shape change.

## Surface

None - nothing consumed outside. The new command is walked in `## Observable`.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. how the SQL suite runs (every later migration's tests run this way) | `npm run test:db [recipe...]` in `web/`, a Node script using `pg` (dev dependency, exact version) with `SUPABASE_DB_URL` = the project's session-pooler connection string (port 5432), loaded from `web/.env.local`, never `NEXT_PUBLIC_`. One connection per recipe, simple-query protocol | Supabase CLI local stack + `supabase test db` (pgTAP) - needs Docker, which this machine does not have, and rewriting 11 files into pgTAP; MCP `execute_sql` only - needs an agent session and hand assembly, which is the problem |
| 2. the recipe convention (every new test file must join one) | a recipe is a name and an ordered list of parts: `fixture.sql`, a test file, or `SEED_BODY` (= `supabase/seed.sql` without its `begin;` and `commit;` lines). A test file's own `SEED_BODY` line is replaced by the same text. Recipes: `catalog_seed`, `domain_constraints`, `events_outbox`, `rls_isolation`, `rls_roles`, `transitions`, `demo_owner`, `staff_screens`, and `demo_seed` = fixture, seed body, `demo_seed.sql`, seed body, `demo_seed_rerun.sql` | one file per run with no list - `demo_seed` needs five parts in order; globbing files with a header comment saying how to run - a comment cannot fail when it is wrong |

- Nothing else in this change is hard to reverse

## Criteria

### S1: The SQL suite runs from one command (P1)

The owner runs every SQL test from a terminal and reads the result by name.

**Acceptance Criteria**

1. WHEN `npm run test:db` runs with no argument THEN the system SHALL run all 9 recipes, each on its own connection, and print one line per recipe, `PASS <recipe>` or `FAIL <recipe>: <Postgres error message>`.
2. WHEN every recipe passes THEN the system SHALL print `<n> passed, 0 failed` and exit 0.
3. IF a recipe fails THEN the system SHALL keep running the remaining recipes, print `<p> passed, <f> failed` and exit 1.
4. The system SHALL count a recipe as passed only when its last result row is `<file>: pass` for the recipe's last test file.
5. WHEN `npm run test:db <recipe> [<recipe>...]` runs THEN the system SHALL run only the named recipes, in the given order.
6. IF a named recipe does not exist THEN the system SHALL print `Unknown recipe: <name>` and the list of recipe names, and exit 2 without connecting.
7. IF `SUPABASE_DB_URL` is unset or empty THEN the system SHALL print `SUPABASE_DB_URL is not set (see web/.env.example)` and exit 2 without connecting.
8. IF a `.sql` file in `supabase/tests/` belongs to no recipe THEN the system SHALL print `Not in any recipe: <file>` and exit 2 without connecting.
9. IF an assembled recipe contains a `commit` statement THEN the system SHALL print `Refusing <recipe>: it would commit` and exit 2 without connecting.
10. IF the database cannot be reached THEN the system SHALL print `FAIL <recipe>: <connection error>` for that recipe and continue as in AC 3.
11. The system SHALL NOT print the value of `SUPABASE_DB_URL` in any output.

**Independent test:** with `.env.local` filled, run `npm run test:db`, then `npm run test:db rls_isolation`, then `npm run test:db nope`.

### S2: Tenant isolation and the security advisors (P1)

**Acceptance Criteria**

12. WHEN `npm run test:db rls_isolation rls_roles transitions staff_screens` runs against the live project THEN the system SHALL report all four recipes `PASS`.
13. The system SHALL leave the Supabase security advisors with no finding other than `rls_enabled_no_policy` on `public.outbox` and `auth_leaked_password_protection`, and SHALL record each of those two in `CONTEXT.md` with the reason it is accepted.

**Independent test:** run the four recipes, then MCP `get_advisors` with type `security`.

### S3: The signed-in journey works end to end (P1)

**Acceptance Criteria**

14. WHEN the demo owner signs in with an emailed link and opens, in one session, `/pipeline`, `/customers`, a demo customer, one of its sites and `/settings` THEN the system SHALL answer each with `200` and show the demo org's name in the shell.
15. WHILE the demo owner walks the journey of AC 14 the system SHALL log no console error or warning and SHALL have no failed network request other than one the Next.js router cancels after its response arrived with `200` (narrowed with the user's approval on 2026-10-26).
16. WHEN the demo owner saves `/settings` with an unchanged form during the journey THEN the system SHALL show "Settings saved".
17. WHEN the demo owner signs out at the end of the journey THEN the system SHALL land on `/login`, and a following `GET /pipeline` SHALL redirect `307` to `/login`.

**Independent test:** run the journey in the Playwright MCP at 1440x900, then again at 375x812 with touch emulation.

## Out of scope

| Excluded | Why |
| --- | --- |
| An RLS test through the Data API with real signed-in users | PostgREST applies the same `authenticated` role and JWT claims that `tests.act_as` sets, and it would create and delete users on the live project on every run |
| A committed Playwright e2e suite | AGENTS.md: web validation runs live and is not committed |
| A CI pipeline | none exists; the command is CI-ready and adding a pipeline is its own decision |
| Coverage thresholds for Vitest | no source asks for one; Vitest needs nothing built here |
| Enabling leaked password protection | sign-in is magic link only, so no password is ever set |
| Customer, site and asset forms | not in this item; see open question 3 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Who may run `test:db` against the live project | the user, or an agent after the user's go-ahead in that session | it rolls back, but it still runs on the only (live) database, and an `execute_sql` run was declined before | y - approved with the plan |
| Recipes run in parallel or one after another | one after another | output stays in order; the suite is small | y - approved with the plan |
| Runner language | TypeScript run by Node 24 (`node --env-file=.env.local`), no `tsx` | Node 24.16 strips types natively, so no second dependency | y - approved with the plan |
| The `outbox` advisor finding | accepted | AD-016 keeps `outbox` unreadable by every user role on purpose | y - approved with the plan |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks | Provision the demo owner: invite your email from the Supabase dashboard (Auth > Users), then give the go-ahead to run `supabase/seed.sql` on the live project with `app.demo_owner_email` set (AD-021) | AC 14-17 and the 17 pending proofs cannot run |
| 2 | blocks | Put the session-pooler connection string (Supabase > Connect > Session pooler, with the database password) into `web/.env.local` as `SUPABASE_DB_URL`. I never read or print it | AC 1-5, 10 and 12 can only be proven by the unit tests of the runner, not against the database |
| 3 | open | Add a "Customer, site and asset forms" item to ROADMAP Phase 1 (staff-screens open question 1)? Recommended: yes, right after this item | the lists stay read-only |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| command `npm run test:db` | output format and verbosity | AC 1-3 |
| command `npm run test:db` | every flag and its default | AC 5 (recipe names; none means all); no other flag |
| command `npm run test:db` | exit codes | AC 2 (0), AC 3 (1), AC 6-9 (2) |
| command `npm run test:db` | what it prints when it fails halfway | AC 3, 10 - the failed recipe's line, then the rest, then the summary; a rolled-back recipe leaves nothing to clean up |
| command `npm run test:db` | secret in output | AC 11 |
| screens of the journey | empty, loading, error, unauthorised, density, destructive action | existing - staff-screens AC 2-4, 14, 21, 26, 32, 37 and auth-magic-link; this feature adds only the journey (AC 14-17) |
| document `CONTEXT.md` "How to run the tests" | structure, and what the reader does next | AC 13; one paragraph per runner (`npm test`, `npm run test:db`, live Playwright) with the command to copy |

## Sources

- ROADMAP.md Phase 1, item "Vitest unit tests, RLS isolation check, Playwright validation"; M15 "Supabase advisors clean"
- AGENTS..md "Web validation - Playwright screen & touch" - live, not committed
- `.specs/features/staff-screens/verification.md` and `.specs/features/auth-magic-link/checks.md` `## Handoff` - the pending proofs
