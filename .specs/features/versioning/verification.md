# Versioning verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 8dbc22b..329066e
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

All 28 checks have a located assertion. 26 are proven by a proof I ran at HEAD 329066e. C1341 and C1344 are author-side live runs that I did not re-run (single-context rule); they were never failing and the live proofs they need are not runnable by the Verifier. Round-2 scope: the fix diff `77c0581..329066e` plus every round-1 non-PASS verdict (C1324, C1325, C1328, C1341, C1344) and the new checks C1345 and C1346. Everything else is carried from round 1 at 77c0581 and marked so.

## Round 1 history (FAIL, 22/26, at 77c0581)

1. C1328 - `accepted` named in the claim but no test listed an accepted event in a version's history.
2. C1324 and C1325 - hints `note_too_long` and `not_editable` named in the claims but not asserted (`expect_error` compares SQLSTATE only).
3. Doors 4 and 5 had tests but no check and no Coverage row; `checks.md` counted 3 doors against 5 in the plan.
4. C1327 runs a copy of the migration's UPDATE; C1340 uses `withdrawn` as the stand-in for an inactive site; C1341 and C1344 are author-side live runs (non-blocking notes).

## Proofs run at HEAD 329066e (from `web/`)

- One vitest call over `domain/agreement/version-diff.test.ts`, `infrastructure/supabase/agreements.test.ts`, `components/agreements/agreements.test.ts`, `app/(app)/agreements.test.ts` with `--reporter=verbose`: 4 files, 242 tests passed (round 1: 240; +2 = the two new reader tests). Every `C1322:`-`C1346:` vitest name below appeared individually as passed.
- `npm test`: 111 files, 2237 passed, exit 0. `npm run lint` exit 0. `npx tsc --noEmit` exit 0.
- `npm run test:db agreement_builder`: PASS (1 passed, 0 failed), exit 0. `npm run test:db rls_isolation`: PASS (1 passed, 0 failed), exit 0. The runner reports per recipe, not per assertion, so the `C1324 hint`, `C1325 hint`, `C1345 *` assertions are shown to exist by `rg` and are proven by the recipe passing (a failing `tests.ok` fails the recipe).
- `npm run build` was not re-run this round (the fix touched only tests and docs, no build input); round 1 ran it at 77c0581 exit 0.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1319 | revise stores customer reason and uE as author | carried from 77c0581 | `supabase/tests/agreement_builder.sql:770` `created_by = tests.id('uE') and reason = 'Too expensive'`; recipe still passes at HEAD | PASS (carried from 77c0581) |
| C1320 | create_agreement v1 has creator, null reason | carried from 77c0581 | `agreement_builder.sql:785` `v.created_by = tests.id('uE') and v.reason is null` | PASS (carried from 77c0581) |
| C1321 | authenticated cannot update a version (42501) | carried from 77c0581 | `agreement_builder.sql:794` `expect_error('C1321 update', ..., '42501')` | PASS (carried from 77c0581) |
| C1322 | reader returns reason and author role per version | carried from 77c0581; vitest `C1322:` passed at HEAD | `infrastructure/supabase/agreements.test.ts:523` `toEqual([[2,"Too expensive","estimator"],[1,null,null]])` | PASS (carried from 77c0581) |
| C1323 | reason renders; null renders nothing | carried from 77c0581 | `components/agreements/agreements.test.ts:482,484` `toContain("Too expensive")`, `not.toContain("data-reason")` | PASS (carried from 77c0581) |
| C1324 | note stored; 500 ok; 501 raises 23514 hint `note_too_long`; value unchanged | test:db agreement_builder exit 0 (verified at 329066e) | `agreement_builder.sql:855` `tests.ok('C1324 hint', h = 'note_too_long', ...)`, where `h` is read with `get stacked diagnostics h = pg_exception_hint` after `save_version_note(tests.id('a1324'), repeat('n', 501))` (`:850`); a missing raise leaves `h` null so the assertion fails. Existing (carried): `:812` stored, `:817` 500 chars, `:819` `'23514'`, `:821` unchanged | PASS (verified at 329066e) |
| C1325 | non-draft raises 55000 hint `not_editable`; viewer 42501 | test:db agreement_builder exit 0 (verified at 329066e) | `agreement_builder.sql:862` `tests.ok('C1325 hint', h = 'not_editable', ...)` after `save_version_note(tests.id('a1325s'), 'x')` on the sent agreement; `h := null` reset before (`:857`). Existing (carried): `:832` `'55000'`, `:836` `'42501'`, `:841` unchanged | PASS (verified at 329066e) |
| C1326 | action trims; 501 field error on `note`; success once | carried from 77c0581; vitest `C1326:` x5 passed at HEAD | `app/(app)/agreements.test.ts:388` `toHaveBeenCalledExactlyOnceWith(AGR, "Added boiler")`; `:395-400` `errors: { note: ... }` | PASS (carried from 77c0581) |
| C1327 | backfill matches events; others null | carried from 77c0581 | `agreement_builder.sql:869` `created_by = tests.id('uE') and reason = 'Add a boiler'`; mcp count 0 (round 1). Caveat unchanged: the SQL test runs a copy of the migration's UPDATE | PASS (carried from 77c0581, caveat) |
| C1328 | per-version events oldest first, type/time/actor, own version only; accepted listed | vitest `C1328:` x4 passed (verified at 329066e) | NEW `agreements.test.ts:589` test `C1328: an accepted event is listed in its version's history with the customer who accepted`; asserts `:597` `expect(detail?.versions[0]?.events.map((e) => [e.type, e.by])).toEqual([["sent","estimator"],["accepted","customer"]])`. Existing: `:545-553` `history(1)`/`history(2)` sent/viewed/changes_requested and sent/refused; `:584-585` no-versionNo history. All five event types (sent, viewed, accepted, refused, changes_requested) now appear in an asserted list | PASS (verified at 329066e) |
| C1329 | markers 2/2 on full set; 1/null on the first two | vitest `C1329:` x3 passed at HEAD | `agreements.test.ts:569` `toMatchObject({ sentVersion: 2, acceptedVersion: 2 })`; `:571` `{ sentVersion: 1, acceptedVersion: null }`; `:621` older-than-every-version `{ sentVersion: null, versions: [{ events: [] }] }` | PASS (carried from 77c0581) |
| C1330 | Sent/Accepted markers on right versions only | carried from 77c0581 | `components/agreements/agreements.test.ts:490-494` `toContain(">Sent<")`, `not.toContain(">Accepted<")` | PASS (carried from 77c0581) |
| C1331 | "Not sent yet" only with no events | carried from 77c0581 | `components/agreements/agreements.test.ts:501-502` | PASS (carried from 77c0581) |
| C1332 | other org / no org null; page notFound | carried from 77c0581; rls_isolation PASS at HEAD | `app/(app)/agreements.test.ts:299` `rejects.toThrow("NEXT_NOT_FOUND")`; `rls_isolation.sql:96-101` | PASS (carried from 77c0581) |
| C1333 | two viewed events render one row | carried from 77c0581 | `agreements.test.ts:605` (line moved to about `:624-630` at HEAD) `toEqual([["sent",...],["viewed",...]])` | PASS (carried from 77c0581) |
| C1334 | 3 kinds, 5 fields | carried from 77c0581; vitest x7 passed | `domain/agreement/version-diff.test.ts:18,38,40,46` | PASS (carried from 77c0581) |
| C1335 | reordered equipment/months not changed | carried from 77c0581 | `version-diff.test.ts:53` `lines).toEqual([])` | PASS (carried from 77c0581) |
| C1336 | totals, delta -58000 | carried from 77c0581 | `version-diff.test.ts:60-62` | PASS (carried from 77c0581) |
| C1337 | identical lines: no entries; "No differences" | carried from 77c0581 | `version-diff.test.ts:67`; `components/agreements/agreements.test.ts:510` | PASS (carried from 77c0581) |
| C1338 | compare returned; null for equal/missing/unknown/non-number | carried from 77c0581 | `agreements.test.ts` reader `compare toMatchObject({versionNo:1, annualCents:357000})`; `app/(app)/agreements.test.ts:288,294` | PASS (carried from 77c0581) |
| C1339 | per-field old/new, totals, signed change | carried from 77c0581 | `components/agreements/agreements.test.ts:521-526,532` | PASS (carried from 77c0581) |
| C1340 | withdrawn-agreement stand-in renders comparison and history, no write control | carried from 77c0581 | `components/agreements/agreements.test.ts:540-542`; note: status is a proxy for "inactive site" | PASS (carried from 77c0581, proxy note) |
| C1341 | at 375 px no horizontal scroll, controls >= 44 px | author-side live run, not independently re-run | Code check at HEAD: `versions-section.tsx:8` `min-h-11` link, `version-compare.tsx:76` `overflow-hidden` (unchanged by the fix: `git diff 77c0581..329066e --stat` lists only 4 spec/test files). Author evidence in checks.md Handoff: `scrollWidth 360 = clientWidth 360`, no link or button under 44 px, 768 px `753 = 753`. No rendered 44 px assertion exists in the tree | PASS (author-side live run as checks.md defines "live"; not independently re-run by the Verifier) |
| C1342 | test, lint, build, test:db exit 0 on HEAD | run by me (verified at 329066e) | `npm test` 2237 passed; lint 0; tsc 0; test:db `agreement_builder` and `rls_isolation` PASS; build carried from 77c0581 (no build input changed) | PASS (verified at 329066e) |
| C1343 | advisors: no new finding beyond `save_version_note` | carried from 77c0581 | mcp `get_advisors` result in round 1; the fix touched no migration | PASS (carried from 77c0581) |
| C1344 | live as demo owner: revise, reason, author, markers, compare | author-side live run, not independently re-run | Code side (carried): reader history and markers, `version-compare.tsx`. Author evidence in Handoff: AG-1044 revised, reason and "by owner", comparison "$3,241.75 -> $3,700.00", totals $19,450.50 / $22,200.00 / +$2,749.50, AG-1052 and AG-1048 markers. Not re-run by me | PASS (author-side live run as checks.md defines "live"; not independently re-run by the Verifier) |
| C1345 | door 4: signed-in insert stamped `auth.uid()`; no user keeps the named value | test:db agreement_builder exit 0 (verified at 329066e) | NEW `agreement_builder.sql:877` `tests.ok('C1345 no user', (select created_by = tests.id('uA') ...where id = tests.id('a1345:v7'))` (insert at `:869` names uA with no claims, `reset role` and empty jwt claims); `:879` `tests.ok('C1345 spoof', (select created_by = tests.id('uE') ... where id = tests.id('a1345:v8'))` after `act_as('uE')` insert naming uA at `:872-873`. Trigger: `supabase/migrations/20261104090000_versioning.sql:7-19` `if auth.uid() is not null then new.created_by := auth.uid();` on `before insert` for each row; both branches match the two assertions | PASS (verified at 329066e) |
| C1346 | door 5: no-versionNo event takes the newest version at event time; older than all is on none; latest such sent/accepted sets the marker | vitest `C1346:` passed, plus `C1328:` and `C1329:` cases (verified at 329066e) | NEW `agreements.test.ts:603` `C1346`: `:612` `expect(detail?.acceptedVersion).toBe(2)`; `:613` v2 events `toEqual([["accepted","owner"]])`; `:614` v1 `events).toEqual([])` (accepted event with `{from,to}` payload, 2026-10-24, versions created 10-20 and 10-23). Cases named by the check: `:584-586` `C1328:` no-versionNo sent events land on v1 and v2 and `sentVersion` 2; `:621` `C1329:` event before every version `{ sentVersion: null, versions: [{ events: [] }] }`. Implementation `agreements.ts:83-88` `versionOfEvent`: payload `versionNo` else `Math.max` of `version_no` over versions with `created_at <= event time`, null when none. Boundary equality (`created_at == event time`) is not asserted (see gap 2) | PASS (verified at 329066e) |

## Coverage

Not recomputed (light). Rows checked against the plan:

| Plan item | Finding (verified at 329066e) |
| --- | --- |
| Door 4 (trigger stamps `created_by`) | Round-1 gap closed: `checks.md` Coverage row `door 4: author stamped by the database (2)` maps signed-in insert and no-user-keeps-value to C1345, both asserted (`agreement_builder.sql:877,879`) |
| Door 5 (event with no `versionNo`) | Round-1 gap closed: row `door 5 (3)` maps newest-at-time, older-than-every-version and staff-written decision to C1346; each has a located test (`agreements.test.ts:584-586`, `:621`, `:612-614`) |
| Door count | `checks.md` header now says 5 one-way doors, matching the plan's 5 (door 1, 2, 3, 4, 5) |
| History event types (5) | Row names accepted C1328; now backed by `agreements.test.ts:597` (sent, viewed, accepted, refused, changes_requested each appear in an asserted list) |
| `save_version_note` outcomes (4) | Hints now asserted: `agreement_builder.sql:855,862` |
| AC 1-15 | Carried from 77c0581: every criterion has a check (AC1 C1319 ... AC15 C1341) |

Swept existing: carried from 77c0581 (the fix touched no migration, RPC or grant).

## Fix diff review (77c0581..329066e)

`git diff 77c0581..329066e --stat`: `.specs/features/versioning/checks.md`, `.specs/features/versioning/verification.md`, `supabase/tests/agreement_builder.sql` (+40 -2), `web/infrastructure/supabase/agreements.test.ts` (+28). No production code changed.
- No assertion weakened: the two removed lines in `agreement_builder.sql` are the file header comment (extended with C1345); `agreements.test.ts` has additions only.
- No approved check edited: `checks.md` changes are the count line (26 -> 28 checks, 3 -> 5 doors), the new section "Doors found while building" with C1345 and C1346, two Coverage rows, and a Handoff paragraph. C1319-C1344 text is byte-identical.

## Gate

`npm test` (web/) - 111 files, 2237 passed, 0 failed. `npm run lint` exit 0, `npx tsc --noEmit` exit 0. `npm run test:db agreement_builder` PASS, `npm run test:db rls_isolation` PASS. Target vitest call: 242 passed, 0 failed.

Should C1341 and C1344 hold the verdict? No. They were author-side live runs in round 1 and the same evidence stands; the code they rely on is unchanged by the fix diff, the author's recorded numbers are specific and consistent with the code (`min-h-11`, `overflow-hidden`, reader fields), and the fix introduced no UI change. They remain an unproven-by-Verifier residual, stated rather than hidden.

Residual notes (non-blocking):
1. C1341 has no rendered 44 px or `scrollWidth` assertion in the tree; it rests on the live run and two class names.
2. C1346 does not assert the boundary where an event's time equals a version's `created_at` (`<=` in `agreements.ts:86`).
3. C1327's SQL test runs a copy of the migration's UPDATE (live count 0 from round 1 supports it).
4. C1340 uses `withdrawn` as a proxy for an inactive site.
