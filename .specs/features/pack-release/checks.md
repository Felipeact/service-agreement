# Pack release checks

Profile: standard

## Intent

Roadmap Phase 4.5 item 5 ends when a practitioner has reviewed the `plumbing` and `electrical` packs and they are released (decision 5). Today the packs are built and unreleased (`.specs/features/starter-packs/`), and no reviewer is named. A release is one migration that sets `private.catalog_packs.released_at` for the two packs, plus the SQL recipe that stops pinning them as unreleased. This change prepares both and applies nothing: they live in `supabase/packs/pending/`, outside `supabase/migrations/`, so no `db push` can apply a release nobody has signed. The release migration holds a guard that raises until a reviewer and a date are filled in. No new one-way door: the gate is AD-163.

When the release lands, a tenant can be seeded with either pack, and the recipe proves the gate on two registered test packs instead of the shipped ones.

2 checks in 1 slice · 0 new one-way doors · 1 open, which blocks go-live (the reviewer)

**Supersedes, when this lands** (named here so no approved check is edited in silence): the shipped-state halves of starter-packs C2209 (`plumbing` and `electrical` are null), C2210 (the refusal is proven on `plumbing` and `electrical`) and C2225 (the shipped data cannot seed either pack). Their facts are true only until the release migration is applied; the refusal itself stays proven by C2210 on two test packs and by C2209's new-pack seed. C2214 to C2221 are unchanged and now seed the packs as shipped, without the in-transaction release.

## Checks

### S1 - The release and its recipe · 3 files · ~35 KB · ~9k

**C2301** - After the release migration `private.catalog_packs.released_at` is not null and not in the future for `plumbing` and for `electrical` (the pair), and `seed_org_catalog` accepts both without an in-transaction release
Proof: `npm run test:db starter_packs` (assertions `C2301 plumbing`, `C2301 electrical`, and `C2214 ...` to `C2221 ...` with no release line in the recipe)

**C2302** - After the release, `hvac`, `plumbing` and `electrical` are three released packs, and the two registered test packs `sp_new` and `sp_new2` are not; seeding either test pack raises `55000` and changes nothing (starter-packs C2210 on the test packs)
Proof: `npm run test:db starter_packs` (assertions `C2302 shipped`, `C2302 test packs`, `C2210 sp_new ...`, `C2210 sp_new2 ...`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| packs released by the migration (2) | `plumbing` C2301 · `electrical` C2301 | - |
| released packs after the migration (3) | `hvac` C2302 · `plumbing` C2302 · `electrical` C2302 | - |
| unreleased test packs (2) | `sp_new` C2302 · `sp_new2` C2302 | - |
| refusal on an unreleased pack (2) | `sp_new` `55000` C2302 · `sp_new2` `55000` C2302 | - |
| seed of the shipped packs without an in-transaction release (2) | `plumbing` C2301 · `electrical` C2301 | - |
| startup configuration (0 assemblies) | n/a - no env var, flag or assembly step; the migration is the only prerequisite | - |

- Claims naming a SQLSTATE: C2302 (`55000`), with a proof that crosses the boundary (the real function call)
- Proven now, before the migration is applied, by the simulation in the Handoff; proven for real by `npm run test:db starter_packs` once it is applied

## Test policy

Decided in starter-packs: decision proofs at the boundary and at their own layer; this change adds data and moves two assertions, and decides nothing new.

## Swept

- validation: C2301 (release time is not null and not in the future)
- failure modes: C2302 (an unreleased pack still raises `55000` and changes nothing)
- idempotency: n/a - the migration is applied once by the owner; it also updates only rows whose release time is null, so a repeat keeps the first release time
- authorization: existing - the gate and the seed are closed to `anon` and `authenticated`, proven by the grant and outcome assertions of the starter-packs recipe (strengthened in its round 2)
- concurrency: n/a - one `UPDATE` per pack, applied once by the owner
- data lifecycle: C2301 (the only data change); no org row changes
- dependency failure: n/a - database only
- state transitions: C2301 (unreleased to released is the one transition, forward only; nothing here un-releases)
- observability: n/a - no logging or metric requirement

## Out of scope

- Corrections to the packs from the reviewer - they land as their own migration before the release
- A screen to show a pack's release state - Phase 5 onboarding owns trade selection

## Handoff

- Built 2026-11-09 after the owner named the reviewer (Felipe Viana, interim) and gave the go-ahead: migration applied to the hosted project, recorded as `20261109171002_release_starter_packs` (file renamed from the placeholder version, AD-006); the draft in `supabase/packs/pending/` was moved into `supabase/migrations/` and `supabase/tests/starter_packs.sql` and the folder removed. `npm run test:db` 26 of 27 recipes pass, `starter_packs` included; `customer_portal` is still the stale one from item-vocabulary
- Simulation, in one rolled-back transaction against the hosted project, not persisted: fixture + the two `update` statements + the after-release recipe printed `starter_packs: pass`; the same recipe without the release statements failed at `C2301 plumbing: plumbing is not released`. The hosted state read afterwards is unchanged (`hvac` released, the two new packs not)
- Size: ~9k (one new migration of 10 lines, one recipe copy of ~29 KB, a README), one builder
- Mechanism: one builder
- Open: a practitioner's review of the checklists, which the interim review does not replace (blocks go-live in the sense of decision 5); the Verifier runs over every check here
