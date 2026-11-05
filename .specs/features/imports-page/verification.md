# Imports page verification

**Verdict**: PASS
**Profile**: light
**Diff range**: ea0a16a482d93557a68d06020d9d9c0e59d8993a..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Checks

Paths are under `web/`. Every named test was shown individually as run and passed (vitest verbose, 47 + 5 tests, 8 files).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1387 | one row per job, shape, newest first, limit 500 | `npx vitest run infrastructure/supabase/imports.test.ts -t "C1387:"` exit 0 | `infrastructure/supabase/imports.test.ts:329` - `expect(calls).toContainEqual(["import_jobs", "order", ["created_at", { ascending: false }]])`, `["import_jobs", "limit", [500]]`, and `expect(list[5]).toEqual({... site: {id, name}, customer: {id, name}})` | PASS |
| C1388 | reader fills outcome/extraction/committed | same file, `-t "C1388:"` | `imports.test.ts:349` - `expect(byId.j6.extraction).toEqual({ status: "extracted", rows: 40, unmatched: 3 })`, `expect(byId.j7.committed).toEqual({ added: 336, skipped: 2 })` (parsed, unreadable, extracting at :353-:355) | PASS |
| C1389 | outcome line per status, 7 table-driven | `components/imports/import-history.test.ts -t "C1389:"` 7 tests ran | `components/imports/import-history.test.ts:51` - `expect(html).toContain(line)`; none-cases `expect(html).not.toMatch(...)` over the outcome-line patterns (rows in, n of m, Added to site, No table) | PASS (precision gap, see below) |
| C1390 | pill label and link per status, 7 table-driven | same file, `-t "C1390:"` 7 tests ran | `import-history.test.ts:66` - `expect(html).toContain(\`>${label}<\`)`; `toContain(\`href="/imports/${id}"\`)` / `toContain(\`href="/sites/${SITE}/import"\`)` with `not.toContain` of the other link | PASS |
| C1391 | site/customer links, Former member | same file, `-t "C1391:"` | `import-history.test.ts:80` - `toContain(\`href="/sites/${SITE}"\`)`, `toContain(\`href="/customers/${CUSTOMER}"\`)`, `toContain("Former member")` | PASS |
| C1392 | no Read/Extract/Discard, one button | same file, `-t "C1392:"` | `import-history.test.ts:90` - `expect(html.match(/<button\b/g)).toHaveLength(1)`; `not.toContain(text)` for the three labels | PASS |
| C1393 | Imports href `/imports`, Task library none | `components/shell/nav-items.test.ts -t "C1393:"` | `components/shell/nav-items.test.ts:23` - `expect(hrefOf("Imports")).toBe("/imports")`, `expect(hrefOf("Task library")).toBeUndefined()`; source `components/shell/nav-items.ts:12` | PASS |
| C1394 | current on `/imports`, `/imports/j-1`; not on `/pipeline`, `/sites` | same file, `-t "C1394:"` 4 tests ran | `nav-items.test.ts:63` - `expect(link.includes('aria-current="page"')).toBe(current)` with `expect(link).not.toBe("")` | PASS |
| C1395 | signed out redirects to /login, nothing read | `"app/(app)/imports-history.test.ts" -t "C1395:"` | `app/(app)/imports-history.test.ts:46` - `rejects.toThrow("NEXT_REDIRECT /login")`; `expect(listImportHistory).not.toHaveBeenCalled()` | PASS |
| C1396 | page passes parsed filter, fills sites, renders; container exposes `listImportHistory` | page file `-t "C1396:"` (2 tests) and `composition/composition.test.ts -t "C1396:"` | `imports-history.test.ts:33` - `toHaveBeenCalledWith({ status: "attention", siteId: SITE })`, `listSites toHaveBeenCalledWith({ showInactive: true })`; `composition/composition.test.ts:115` - `expect(typeof (await getContainer()).listImportHistory).toBe("function")` | PASS |
| C1397 | filter keeps 7 status values | `domain/imports/index.test.ts -t "C1397:"` 7 tests ran | `domain/imports/index.test.ts:77` - `expect(parseImportFilter({ status })).toEqual({ status })` | PASS |
| C1398 | drops 5 bad statuses and non-uuid site; keeps uuid; both | same file, `-t "C1398:"` 6 tests ran | `index.test.ts:83` - `expect(parseImportFilter({ status })).toEqual({})`; `:87` - `toEqual({ status: "attention", siteId: SITE_ID })` | PASS |
| C1399 | each of 6 statuses adds `eq("status", s)`; none adds none | `infrastructure/supabase/imports.test.ts -t "C1399:"` 7 tests ran | `imports.test.ts:360` - `toContainEqual(["import_jobs", "eq", ["status", status]])`; `:367` - `.filter(... args[0] === "status")).toEqual([])` | PASS |
| C1400 | attention adds `in(status, [uploading, unreadable])`, no eq | same file, `-t "C1400:"` | `imports.test.ts:372` - `toContainEqual(["import_jobs", "in", ["status", ["uploading", "unreadable"]]])`; eq-on-status filter `toEqual([])` | PASS |
| C1401 | site adds `eq("site_id")`; with status both | same file, `-t "C1401:"` | `imports.test.ts:378` - `toContainEqual(["import_jobs", "eq", ["site_id", SITE]])` and `["status", "parsed"]` on the same run | PASS |
| C1402 | empty, no filter: "No imports yet" + `/sites` link | `import-history.test.ts -t "C1402:"` | `import-history.test.ts:97` - `toContain("No imports yet")`, `toMatch(/<a[^>]*href="\/sites"[^>]*>/)` | PASS |
| C1403 | empty with filter: no-match + Clear filters to `/imports`; rows: none | same file, `-t "C1403:"` | `import-history.test.ts:104` - `toMatch(/<a[^>]*href="\/imports"[^>]*>Clear filters</)`; `expect(render([row(...)])).not.toContain("Clear filters")` | PASS |
| C1404 | GET form to `/imports`, 8 status options, site select, selected follows filter | same file, `-t "C1404:"` | `import-history.test.ts:111` - `expect(values(status)).toEqual(["", "attention", "uploaded", ... "committed"])`, `expect(values(site)).toEqual(["", SITE])`, `toMatch(/<form[^>]*action="\/imports"/i)` | PASS |
| C1405 | live 375/768/1440: no h-scroll, no overlap, 44 px at 375/768 | none rerunnable (live) | `checks.md` Handoff "Live C1405": scrollWidth equals clientWidth at all three widths; no control/link under 44 px and zero overlaps at 375 and 768; 1440 desktop sizing 34 px / 19 px. Concrete observations recorded; accepted as an author-side run under `light` | PASS (accepted author-side) |
| C1406 | live signed-in: list, sidebar current, filters narrow, Clear returns, no console errors | none rerunnable (live) | `checks.md` Handoff "Live C1406": 3 jobs across two sites, `?status=committed&site=` still 3 rows, `Needs attention` gave no-match, Clear filters returned 3 rows, console no errors. Accepted author-side under `light` | PASS (accepted author-side) |

## Level, sampling and precision

- Level: C1395 and C1396 name a route/redirect and are proven at the page-function level with `next/navigation` mocked; the checks already record this and defer the 200 and the 307 to the live C1406 (accepted under `light`, same as sites-page). C1387-C1401 assert the recorded Supabase call chain with the stub client (not a real PostgREST filter); acceptable for the plan's no-migration scope.
- Sampling: C1389 and C1390 are table-driven over all 7 statuses; C1397 over all 7 values; C1399 over all 6 plus none. No claim exceeds its cases.
- Precision gap (C1389): the claim text says `parsed` prints "n tables, m rows"; the test asserts "15 rows in 2 tables" (`import-history.test.ts:51` table, row `j-parsed`). Source `components/imports/job-list.tsx:32` returns `readSummary(tables, rows)`, which the site page uses, so the test matches the site page's real output and the claim defers to it. Acceptable; the author recorded it in the Handoff. The checks text, not the code, is imprecise.
- Minor: the C1389 "none" cases (`uploading`, `uploaded`) assert absence by regex over the row markup, which is weaker than an exact line, but it is the stated claim ("none").

## Swept existing rows

- failure modes / dependency failure ("reader throws, `error.tsx` renders"): there. `infrastructure/supabase/imports.ts:352` `if (error) throw new Error(...)` in `supabaseImportHistory.list`; `app/(app)/error.tsx` exists. Note the plan says "through `unexpected`"; the history reader throws a plain `Error` with the same text format as `forSite` at :336, which is the file's existing convention, so no gap.
- authorization (`import_jobs` select policy is org-member, AD-031): out of the diff (no RLS change in `ea0a16a..HEAD`); the page-side member gate is there, `app/(app)/imports/page.tsx:15` `if (member.status !== "member") redirect("/login")`. The policy itself was not re-read (no migration in range).

## Diff hygiene (edited pre-existing assertions)

`git diff ea0a16a..HEAD -- '*.test.ts'` removed lines: (1) `test.each(["Imports", "Task library"])("C156: %s has no page yet"...` in `components/shell/nav-items.test.ts`, replaced by `test.each(["Task library"])("C156: ...")` plus C1393 - the authorized replacement; (2) the import line in `domain/imports/index.test.ts` extended with `parseImportFilter` (additive); (3) the import line in `infrastructure/supabase/imports.test.ts` extended with `supabaseImportHistory` (additive). No other pre-existing assertion was edited.

## Gate

`npx vitest run <6 files> -t "C13(8[7-9]|9[0-9]):|..."` plus `-t "C140[0-4]:"` - 52 passed, 0 failed (Test Files 6 + 2); every C1387 to C1404 test listed individually.
`npx tsc --noEmit` - exit 0, no output.
`npm run lint` - exit 0, no warnings.
