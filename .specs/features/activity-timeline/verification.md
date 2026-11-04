# Activity timeline verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 8d798db..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Checks

Proof run (one invocation, from `web/`, verified at 62ad37f): `npx vitest run domain/agreement/timeline.test.ts infrastructure/supabase/agreements.test.ts components/agreements/agreements.test.ts "app/(app)/agreements.test.ts" -t "C1478:|...|C1494:|C1332:"` exit 0 - 34 passed, 231 skipped; every named test appeared individually as passed (the 10 C1478 rows, 7 C1485 rows, and one row each for the rest). Existence confirmed with `rg -n "C14(7[89]|8\d|9[0-6]):|C1332:"` on the four files.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1478 | ten types labelled | vitest `-t "C1478:"` ran 10 rows, all passed | `web/domain/agreement/timeline.test.ts:29-31` - table of 10 `[type, label]` pairs, `expect(entries.filter((e) => e.type !== "created").map((e) => e.label)).toEqual([label])`; labels match the check text exactly | PASS |
| C1479 | Created at v1 with author role, or none | vitest `-t "C1479:"` passed | `timeline.test.ts:36` - `toEqual([{ type: "created", label: "Created", at: at(8, 20), versionNo: 1, by: "owner", ...}])`; `:38` - `expect(none[0]?.by).toBeNull()` | PASS |
| C1480 | entry carries event's version, or none | vitest `-t "C1480:"` passed | `timeline.test.ts:43-47` - `toEqual([["Sent to customer", null], ["Sent to customer", 2], ["Created", 1]])` | PASS |
| C1481 | newest first, tie reversed, Created last on tie | vitest `-t "C1481:"` passed | `timeline.test.ts:54` - `toEqual(["Accepted", "Viewed by customer", "Sent to customer", "Created"])`; two events and Created all at `at(8,20)`, so all three ordering cases land | PASS |
| C1482 | unknown type dropped, no error | vitest `-t "C1482:"` passed | `timeline.test.ts:60` - `toEqual(["Sent to customer", "Created"])` with `contract.completed` and `agreement.created` in input | PASS |
| C1483 | reader returns timeline over ten types, resolves version, history keeps five | vitest `-t "C1483:"` passed | `web/infrastructure/supabase/agreements.test.ts:700` - `expect(detail?.timeline?.map((e) => [e.type, e.versionNo])).toEqual([...12 pairs])` (versionless events resolve to 1/2); `:715` `expect(asked?.args[1]).not.toContain("contract.completed")`; `:718-719` `expect(history).toEqual(["accepted","changes_requested","refused","sent","sent","viewed"])`. `EVENT_KINDS` untouched in the diff (only `EventRow` type widened) | PASS |
| C1484 | page renders Activity newest first with label, version, Vancouver time | vitest `-t "C1484:"` passed | `web/components/agreements/agreements.test.ts:576-583` - `expect(out.indexOf("Accepted")).toBeLessThan(out.indexOf("Sent to customer"))`, `toContain("Version 2")`, `toMatch(/10:30\s?a\.m\./)`, `toMatch(/Oct 25, 2026.*1:05\s?p\.m\./)` (UTC 17:30 -> 10:30 PDT, so the zone is proven) | PASS |
| C1485 | actor: role / customer (portal, viewed no actor) / automatic | vitest `-t "C1485:"` ran 7 rows, all passed | `timeline.test.ts:71-72` - table of 7 cases (member, portal, viewed, expired, renewed, renewal_drafted, departed) `expect(build([event])[0]?.by).toBe(by)`; the check's 4 cases are covered and `automatic` is sampled on all 3 system types | PASS |
| C1486 | reader resolves role; departed member -> no actor, not automatic | vitest `-t "C1486:"` passed | `agreements.test.ts:727-731` - `toEqual([["withdrawn", null], ["sent", "owner"], ["created", "estimator"]])` | PASS |
| C1487 | reason on refused/changes_requested only; page wraps, no truncation | vitest domain + component `-t "C1487:"` passed | `timeline.test.ts:80-87` - `toMatchObject({ Refused: "Too expensive", "Changes requested": "Add a spring visit", "Sent to customer": null, Accepted: null })`; `components/agreements/agreements.test.ts:589-591` - `expect(text(html)).toContain(long)` (over 400 chars), `toMatch(/data-reason...break-words/)`, `html.match(/data-reason/g)).toHaveLength(1)` | PASS |
| C1488 | deactivation -> "Withdrawn · site deactivated", else "Withdrawn" | vitest `-t "C1488:"` passed | `timeline.test.ts:95` - `toEqual(["Withdrawn", "Withdrawn · site deactivated", "Created"])` | PASS |
| C1489 | "Valid until Dec 1, 2026"; "Renews AG-1004" only for the linked id; none when unreadable | vitest domain + reader `-t "C1489:"` passed | `timeline.test.ts:109` - `toEqual(["Renews AG-1004", null, "Renews AG-1004", "Valid until Dec 1, 2026"])`; `:110` unreadable (`renews` null) `.detail).toBeNull()`; `agreements.test.ts:745-748` - `toEqual([["renewal_drafted", null], ["renewed", "Renews AG-1004"]])`; `:750` unreadable `toEqual([null, null, null])` | PASS |
| C1490 | one version, no events -> exactly Created; page shows section | vitest reader + component `-t "C1490:"` passed | `agreements.test.ts:754` - `toEqual([["created", "Created", "2026-10-20T17:00:00.000Z", "estimator"]])`; `components/agreements/agreements.test.ts:597-599` - `toContain("Activity")`, `toContain("Created")`, `toContain("owner")` | PASS |
| C1491 | other org / no org -> null; page notFound | `npm run test:db rls_isolation` exit 0 (`PASS rls_isolation`, 1 passed, 0 failed; SUPABASE_DB_URL present in `web/.env.local`, not printed); vitest `-t "C1332:"` passed | `app/(app)/agreements.test.ts:299` - `container.agreementReader.get.mockResolvedValue(null)`, `:300` `rejects.toThrow("NEXT_NOT_FOUND")`; `supabase/tests/rls_isolation.sql:15-16,125,140` - isolation loops name `agreements` and `events` (existing assertions, not changed in the diff). The reader-level null is carried by RLS, not by a vitest stub, which matches the check's own proof line | PASS |
| C1492 | withdrawn agreement shows Activity, no write control | vitest `-t "C1492:"` passed | `components/agreements/agreements.test.ts:605` - `expect(text(section(html))).toContain("Withdrawn · site deactivated")`; `:606` `for (...) expect(has(html, label), label).toBe(false)` over 5 write labels. Fixture is status `withdrawn`, which is what the check names | PASS |
| C1493 | 375 px, 400-char reason, no horizontal scroll | live, author-side (cannot rerun a browser) | Located in `checks.md` Handoff: 375 px `360 = 360` with a 463-char reason substituted in the DOM, section right edge 344; 768 px `753 = 753`. Disclosed in the Handoff: the long reason was a DOM substitution, not stored data. Static half: `activity-section.tsx` reason `<p>` has `break-words`, asserted by C1487 | PASS |
| C1494 | failed events read rejects, no partial timeline | vitest `-t "C1494:"` passed | `agreements.test.ts:761` - `await expect(supabaseAgreementReader(typed).get(AGR)).rejects.toThrow(/XX000/)` | PASS |
| C1495 | `npm test`, lint, tsc, build, test:db exit 0 | re-run here: `npm test` 2500 passed (2500); `npm run lint` clean (eslint printed nothing); `npx tsc --noEmit` exit 0; `npm run test:db rls_isolation` PASS | build and the full `npm run test:db` (21 passed) are reported only in the `checks.md` Handoff, located but not re-run by the Verifier | PASS |
| C1496 | live as demo owner: entries, actors, refusal reason, 1440/768 px, new draft shows only Created | live, author-side (cannot rerun a browser) | Located in `checks.md` Handoff: AG-1044 at 1440 px showed Created, Viewed by customer, Changes requested with reason "Please add a spring visit", New version created (Version 2, owner); AG-1052 showed Created, Sent (owner), two Viewed, Accepted (customer); AG-1056 withdrawn. Handoff states what was not seen live. The demo data had a changes-requested reason, not a refusal reason, and no brand-new draft run is recorded; "new draft shows only Created" and the refusal reason are proven by C1490 and C1487 below the browser | PASS |

## Coverage

Light profile: the join was not recomputed. Plan acceptance criteria 1-18 each land on a check: AC1 C1478/C1483/C1484, AC2 C1478, AC3 C1479, AC4 C1480/C1483, AC5 C1484, AC6 C1481, AC7 C1482, AC8 C1485/C1486, AC9-10 C1485, AC11 C1487, AC12 C1488, AC13 C1489, AC14 C1490, AC15 C1491, AC16 C1492, AC17 C1493, AC18 C1494. No criterion without a proof.

Findings that are not gaps (recorded, no verdict effect):
- Mock-level only: the C1491 reader-null for another org and for a user in no org rests on the existing RLS SQL proof, as the check states; vitest `C1332:` covers the page's `notFound()` only.
- AC 16 names an inactive site; C1492 proves a withdrawn status, which is what the check defines. The renderer has no site-state input, so the test is not weaker than the claim.
- `Swept` rows that say "existing": the `events` select policy for org members is present in `supabase/tests/rls_isolation.sql` (lines 15-16, 125, 140 name `events` and `agreements`).

## Gate

`npx vitest run <4 files> -t "C1478:|...|C1494:|C1332:"` - 34 passed, 0 failed; `npm test` - 2500 passed, 0 failed; `npm run lint` clean; `npx tsc --noEmit` exit 0; `npm run test:db rls_isolation` - 1 passed, 0 failed
