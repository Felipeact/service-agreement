# Pack release verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 92fa834..HEAD (paths: supabase, .specs/features/pack-release)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

HEAD at verification: 846ed4e (the range holds three changed paths: the new migration, `supabase/tests/starter_packs.sql`, `checks.md`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C2301 | After the release migration `released_at` is not null and not in the future for `plumbing` and `electrical`, and `seed_org_catalog` accepts both with no in-transaction release | `cd web && npm run test:db starter_packs catalog_seed type_editor synonyms_as_data cadence service_included demo_seed` - `PASS starter_packs`, 7 passed, 0 failed | `supabase/tests/starter_packs.sql:229` - `tests.ok('C2301 plumbing', (select released_at ... where pack = 'plumbing') <= now(), ...)`; `:230` same for `'electrical'` (a null `released_at` makes the expression null and `tests.ok` raises unless `p_cond is not true` is false, `fixture.sql:37`). Seeding without release: `:355` `tests.ok('C2214 plumbing', n = 20, ...)`, `:368` `tests.ok('C2214 electrical', n = 20, ...)`, `:357` `C2215 template`, `:370` `C2216 template`; `rg -n "update private.catalog_packs"` over the recipe returns only the three C2213 role-denied attempts (`:311`), so no release statement remains | PASS |
| C2302 | `hvac`, `plumbing`, `electrical` are three released packs; `sp_new` and `sp_new2` are not; seeding either test pack raises `55000` and changes nothing | same invocation (`PASS starter_packs`) | `:270` - `tests.ok('C2302 shipped', (select count(*) ... where pack in ('hvac','plumbing','electrical') and released_at is not null and released_at <= now()) = 3, ...)`; `:272` - `tests.ok('C2302 test packs', (select count(*) ... where pack in ('sp_new','sp_new2') and released_at is null) = 2, ...)`; refusal, loop over both members: `:254` `foreach p in array array['sp_new', 'sp_new2']`, `:258` `expect_error` labelled `C2210 <pack> null context` with SQLSTATE `'55000'`, `:259` `C2210 <pack> null unchanged` (digest equal, count 0, ctx null), `:261` `expect_error` labelled `C2210 <pack> held context` with SQLSTATE `'55000'`, `:262` `C2210 <pack> held unchanged` (digest equal, ctx `'HVAC and mechanical'`); registration of both packs at `:236`-`:241` | PASS |

Other proofs run at HEAD, each named test appears individually in the output:

- `npm run test:db starter_packs catalog_seed type_editor synonyms_as_data cadence service_included demo_seed`: `PASS` on all seven, 7 passed, 0 failed. `customer_portal` not run (known stale failure).
- `npx vitest run scripts/test-db domain/imports/starter-packs.test.ts`: 3 files, 34 passed, 0 failed.
- `npm test`: 185 files, 3,548 tests passed, 0 failed.

The check ids C2301 and C2302 are also used by trade-neutral-copy (a vitest feature; `.specs/STATE.md:177` records the collision). The ids in this report are the SQL assertions in `supabase/tests/starter_packs.sql` only.

### Other things the Intent establishes

- **Hosted state (read-only)**: `list_migrations` on project `service-agreement` returns exactly one entry `20261109171002` named `release_starter_packs`, after `20261109163948` `starter_packs`. `select pack, released_at is not null, released_at <= now() from private.catalog_packs` returns three rows only: `electrical` true/true, `hvac` true/true, `plumbing` true/true; no other pack is registered. Nothing applied or written. Observation outside this range: the hosted history does not list every local migration version (for example `type_editor`, `item_vocabulary` and `global_search` are not in it), which is earlier drift and not this feature's.
- **Migration**: `supabase/migrations/20261109171002_release_starter_packs.sql` is exactly two statements, `update private.catalog_packs set released_at = now() where pack = 'plumbing' and released_at is null;` and the same for `'electrical'`. Both touch only `private.catalog_packs`, so no tenant row is reachable. The header names the reviewer ("Reviewed by: Felipe Viana (owner), for both packs, on 2026-11-09. Interim review ... a practitioner's review of the checklists is still open").
- **Folder and range hygiene**: `supabase/packs/` holds only `sheet.sql`; `pending/` does not exist. `git diff --name-status 92fa834..HEAD -- supabase` lists only `A migrations/20261109171002_release_starter_packs.sql` and `M tests/starter_packs.sql`, so no other migration is new in the range.
- **Superseded checks** (`git diff 92fa834..HEAD -- supabase/tests/starter_packs.sql`, and a before/after listing of every `tests.ok(` / `expect_error(` label, 73 before and 73 after):
  - (a) The only removed or rewritten assertions are: `C2209 plumbing` and `C2209 electrical` (shipped-state null, rewritten as `C2301 plumbing` and `C2301 electrical`); the C2210 loop target moved from `['plumbing','electrical']` to `['sp_new','sp_new2']`; C2225 (`expect_error('C2225 '` and `ok('C2225 '`) replaced by `C2302 shipped` and `C2302 test packs`; the in-transaction `update private.catalog_packs set released_at = now() where pack in ('plumbing','electrical')` removed. Header comments updated.
  - (b) The label diff shows only those changes; C2201-C2208, C2211-C2224 (the C2213 grant and read/update assertions at `:307`-`:311`, strengthened in round 2 of starter-packs, included) are untouched and still present.
  - (c) C2210 still asserts `55000` and unchanged digest, count and context, for a null context (`:258`-`:259`) and a held context (`:261`-`:262`), now over two members; `sp_new2` is registered with a type at `:240`-`:241` so it reaches the release check rather than the `22023` unknown-pack check.
- **Honest reporting**: `CONTEXT.md:117` says "released ... on the owner's interim review (Felipe Viana ...; a practitioner's review is still open)" and `:118` lists "a practitioner's review of the two packs" under Not yet; `.specs/STATE.md:180` says "a practitioner's review is still open and ROADMAP item 5 stays unticked"; `ROADMAP.md:299` is `- [ ] Plumbing and electrical starter packs, reviewed by a practitioner ... tick this when a practitioner has reviewed them`. No document claims a practitioner reviewed the packs. `.specs/STATE.md:169` (AD-163) and `:179` still say the packs "ship null"/"unreleased"; these describe the earlier state at the time of that feature and are not contradicted by `:180`, so a note, not a finding.
- **Swept rows**: the `authorization: existing` row cites the grant and outcome assertions of the starter-packs recipe; they are present (`:307`-`:311`, C2213) and the recipe passes. Other rows are `n/a` by approved policy.
- **Test policy**: `checks.md` has a `## Test policy` section but no rows table (one prose line: decision proofs sit in starter-packs, this change adds data and moves two assertions). Nothing to give a per-row verdict on.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| packs released by the migration (2) | `20261109171002_release_starter_packs.sql`, two `update` statements | `plumbing` C2301 (`:229`) · `electrical` C2301 (`:230`) | - |
| released packs after the migration (3) | hosted `catalog_packs` read plus the `hvac` stamp in `20261109163948_starter_packs.sql:13` and the two updates | `hvac`, `plumbing`, `electrical` C2302 (`:270`, count = 3 over the three named packs; also `C2209 hvac` `:228`) | - |
| unreleased test packs (2) | recipe setup `:236`, `:240` | `sp_new` C2302 · `sp_new2` C2302 (`:272`, count = 2 over both) | - |
| refusal on an unreleased pack (2) | the `55000` raise at `20261109163948_starter_packs.sql:276`-`:277`; loop at `:254` | `sp_new` `55000` (`:258`, `:261`) · `sp_new2` `55000` (`:258`, `:261`), each for null and held context | - |
| seed of the shipped packs without an in-transaction release (2) | recipe has no release `update` (rg above) | `plumbing` C2214 (`:355`) · `electrical` C2214 (`:368`) | - |
| startup configuration (0 assemblies) | no env var, flag or assembly step in the diff; the migration is the only prerequisite | n/a | - |

Sweep for sets named in prose with no row: the Intent's "hvac, plumbing and electrical" and the "two superseded halves" are covered above; no other enumeration found. C2302 `55000` crosses the boundary (real `seed_org_catalog` call through `expect_error`).

## Faults injected

Isolation: `git worktree add` of HEAD under the OS temp directory with `node_modules` junctioned, mutated copies of the recipe run against the hosted project through `scripts/test-db/main.mts` (rolled-back transaction, nothing applied), then worktree removed. Real-tree `git status --porcelain` before and after: identical (`?? .specs/features/trade-neutral-copy/verification.md` only). A control run of the unmutated scratch copy printed `PASS starter_packs`.

| Mutation | Location | Killed |
| --- | --- | --- |
| `update private.catalog_packs set released_at = null where pack = 'electrical'` prepended before the tests | recipe scratch copy, top of file (target `electrical` release, `:230`) | yes - FAIL C2301 electrical: electrical is not released |
| `update ... set released_at = now() + interval '1 day' where pack = 'plumbing'` prepended (future release time) | recipe scratch copy, top of file (target `:229`) | yes - FAIL C2301 plumbing: plumbing is not released |
| `update ... set released_at = now() where pack = 'sp_new'` placed after the C2209 block, before C2210 | recipe scratch copy, before `:246` (targets `:258`, `:272`) | yes - FAIL C2210 sp_new null context: expected SQLSTATE 55000, statement succeeded |
| same release applied to `sp_new2` only (second member of the pair) | recipe scratch copy, before `:246` (targets `:258` second iteration) | yes - FAIL C2210 sp_new2 null context: expected SQLSTATE 55000, statement succeeded |
| the `released_at` guard removed from `seed_org_catalog` (copy of the function from `20261109163948_starter_packs.sql:264` with the `55000` branch deleted, placed before the tests) | `20261109163948_starter_packs.sql:276`-`:278` (target `:239`) | yes - FAIL C2209 new pack seed: expected SQLSTATE 55000, statement succeeded |

## Gate

`cd web && npm test` - 185 files, 3,548 passed, 0 failed. `npm run test:db starter_packs catalog_seed type_editor synonyms_as_data cadence service_included demo_seed` - 7 passed, 0 failed. `npx vitest run scripts/test-db domain/imports/starter-packs.test.ts` - 34 passed, 0 failed.
