# Staff screens verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 12375d4..HEAD
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Why FAIL: 15 of 62 checks are not fully proven. 12 owe a proof nobody has run (`live`, or `seed` / `mcp` against the live Supabase project), and 3 more have a vitest proof that asserts less than the check claims (C112, C145, C148). Every vitest, lint, type and build proof that was run is green. Nothing was mutated or fixed.

Note: the `checks.md` header says "63 checks" but C101-C162 is 62 checks. All 62 are covered below.

## Binding sources

Profile is `light`, so step 1 (checks against binding sources) did not run. `DESIGN.md` and `PRODUCT.md` were not compared with the checks.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `DESIGN.md`, `PRODUCT.md` | not run - `light` profile skips step 1 | - | - |

## Checks

Vitest proofs: one invocation, `cd web && npx vitest run --reporter=verbose`, exit 0, 390 passed. Each named test appears individually as a passing line in the output. `C101:` to `C156:` ids seen in the run: all except C103-live, C106, C107, C109, C120, C157-C162, which are not vitest proofs.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C101 | container exposes the six functions; no `@supabase/*` or `@/infrastructure` import under `app/(app)` or `components`; a member of org B sees 0 rows of org A | vitest `C101:` x2 ran green; `seed ...#C101` not run - needs user (MCP `execute_sql` on the live project) | `web/composition/composition.test.ts:55` - `expect(typeof container[name], name).toBe("function")`; `web/boundaries.test.ts:98` - `expect(offenders).toEqual([])` | PARTIAL - SQL isolation half not run |
| C102 | loading state of the 5 routes has the header title and a `role="status"` "Loading…" | vitest `C102:` x5 green | `web/app/(app)/screens.test.ts:44` - `toMatch(<h1>${title}</h1>)`; `:45` - `toMatch(/<p[^>]*role="status"[^>]*>Loading…<\/p>/)` | PASS |
| C103 | error boundary says "Something went wrong"; Try again calls `reset` once; live, the server log has a `digest` | vitest `C103:` green; live half not run - needs user | `web/app/(app)/screens.test.ts:51` - `toContain("Something went wrong")`; `:57` - `expect(reset).toHaveBeenCalledTimes(1)` | PARTIAL - the digest-logging half is live only; `error.tsx` itself logs nothing and relies on Next |
| C104 | non-uuid id returns `null` with 0 calls; no row returns `null`; error `XX000` throws | vitest `C104:` x4 green | `web/infrastructure/supabase/readers.test.ts:202` - `expect(calls).toHaveLength(0)`; `:207` - `rejects.toThrow("XX000")`; site: `:237`, `:243` | PASS |
| C105 | pages call `notFound()` on `null`; not-found page has "Not found" and `/customers` link; live `404` x2 | vitest `C105:` x3 green; live half not run - needs user | `web/app/(app)/screens.test.ts:68` - `rejects.toThrow("NEXT_NOT_FOUND")`; `:74` - `expect(notFound).not.toHaveBeenCalled()`; `:63` - `href="\/customers"` | PARTIAL - the `404` status is live only |
| C106 | `next build` exits 0; route table lists the 5 routes; no `customerId]/sites` | `cd web && npx next build` exit 0 (output saved to a scratch file) | route table lines `├ ◐ /customers`, `├   /customers/[customerId]`, `├ ◐ /pipeline`, `├ ◐ /settings`, `└   /sites/[siteId]`; `grep -c "customerId\]/sites"` returned 0 | PASS |
| C107 | no horizontal scroll at 375, 768, 1440 on 5 screens | live - not run - needs user | none (the author's removed preview probe is not evidence) | NOT PROVEN |
| C108 | signed-out `updateSession` gives `307` to `/login` for the 5 paths | vitest `C108:` x5 green | `web/infrastructure/supabase/session.test.ts:109` - `expect(response.status).toBe(307)`; `:110` - `expect(locationPath(response)).toBe("/login")` | PASS |
| C109 | live `200` for the 5 screens as the demo owner | live - not run - needs user | none | NOT PROVEN |
| C110 | 10 status/contract combinations land in the right column | vitest `C110:` green | `web/infrastructure/supabase/readers.test.ts:52` - `expect(cards.map((card) => [card.id, card.stage])).toEqual(cases.map(...))` over all 10 cases | PASS |
| C111 | `withdrawn` and `voided` contract absent | vitest `C111:` green | `readers.test.ts:61` - `expect(cards.map((card) => card.id)).toEqual(["d"])` | PASS |
| C112 | column header shows count 2 and `$35,880.50/yr`; an empty column shows count 0 and no total | vitest `C112:` green | `web/components/kanban/pipeline-view.test.ts:32-34` - `toMatch(/data-column-count[^>]*>2</)`, `toContain("$35,880.50/yr")`, `column(html,"sent")` `toMatch(...>0<)` | PARTIAL - nothing asserts "no total" in the empty column |
| C113 | "AG-1048 · v3"; "Updated 9 days ago"; 1 day; today; "Unnumbered · v2" | vitest `C113:` x5 green | `pipeline-view.test.ts:40-41`, `:48` (`toContain(label)` over 1 and 0), `:52` - `toContain("Unnumbered · v2")`; reader null number `readers.test.ts:118` | PASS |
| C114 | age 9 / 0 / 1 / 0 at the four edges, fixed clock | vitest `C114:` green | `readers.test.ts:71` - `toEqual({ nine: 9, almost: 0, exact: 1, future: 0 })` | PASS |
| C115 | highest version only: 500000 cents, 4 visits | vitest `C115:` green | `readers.test.ts:90` - `toMatchObject({ annualCents: 500000, visitsPerYear: 4, versionNo: 2 })` | PASS |
| C116 | no lines gives undefined amounts; the column totals `$4,000/yr` | vitest `C116:` x2 green | `readers.test.ts:95-96` - `toBeUndefined()` x2; `pipeline-view.test.ts:58-60` - count `>2<`, `$4,000/yr`, one `visits/yr` | PASS |
| C117 | attention labels and the pill | vitest `C117:` x2 green | `readers.test.ts:107` - `toEqual({cr:"Changes requested", cs:"Awaiting countersignature", d:undefined, s:undefined, ps:undefined})`; `pipeline-view.test.ts:65-66` - `data-tone="attention"` | PASS |
| C118 | empty board: panel text, "New agreement" disabled, no "No agreements match" | vitest `C118:` green | `pipeline-view.test.ts:72-74` - `toContain(...)`, `toMatch(/<button[^>]*disabled[^>]*>New agreement</)`, `not.toContain("No agreements match")` | PASS |
| C119 | no "Sample data"; `lib/sample-pipeline.ts` gone; no importer | vitest `C119:` green; `grep -rn "sample-pipeline" web ...` run | `pipeline-view.test.ts:78` - `not.toContain("Sample data")`; `:80` - `existsSync(...)).toBe(false)`; `:90` - `expect(importers).toEqual([])`; `ls web/lib` shows no `sample-pipeline.ts` | PASS - but see precision gap 1 |
| C120 | seed adds 12 agreements, 9 lines, 3 contracts, stage counts, idempotent | `seed ...#C120` not run - needs user (live MCP) | none | NOT PROVEN |
| C121 | customers ordered by name ignoring case; names are links | vitest `C121:` x2 green | `readers.test.ts:143` - `toEqual(["Alpha","bravo","charlie"])`; `customers.test.ts:24` - `toContain('href="/customers/1111..."')` | PASS - see precision gap 2 |
| C122 | counts 2 sites and 7 assets, shown in the row | vitest `C122:` x2 green | `readers.test.ts:148` - `toMatchObject({ siteCount: 2, assetCount: 7 })`; `customers.test.ts:30-31` - `/Sites <\/span>2</`, `/Assets <\/span>7</` | PASS |
| C123 | primary contact earliest `created_at`, ties by name | vitest `C123:` green | `readers.test.ts:157-159` - `toBe("Yan")`, `toBe("Amy")`, `toBeNull()` | PASS |
| C124 | no contact shows "-" | vitest `C124:` green | `customers.test.ts:35` - `toMatch(/<span[^>]*>-<\/span>/)` | PASS |
| C125 | "12 customers" / "1 customer" | vitest `C125:` x2 green | `customers.test.ts:43` - `toContain(`>${label}<`)` | PASS |
| C126 | `filterCustomers` cases; live "dana" leaves one row | vitest `C126:` green; live half not run - needs user | `customers.test.ts:68-74` - `toEqual(["Harbourview Towers Strata"])` ... `toEqual([])` | PARTIAL - live half not run |
| C127 | "No customers match "zzz"" and "Clear search"; live click empties and focuses the field | vitest `C127:` green; live half not run - needs user | `customers.test.ts:48` - `toContain('No customers match "zzz"')`; `:49` - `toMatch(/<button[^>]*>Clear search</)` | PARTIAL - empty-and-focus behaviour is live only |
| C128 | empty panel, no button | vitest `C128:` green | `customers.test.ts:54-56` - `toContain(...)`, `not.toContain("<button")` | PASS |
| C129 | title, "Customers" link, 3 headings | vitest `C129:` green | `customers.test.ts:92` - `href="\/customers"[^>]*>Customers<`; `:93` - `<h2>` per heading | PASS |
| C130 | mailto/tel links; dashes twice | vitest `C130:` green | `customers.test.ts:105-107` - `href="mailto:..."`, `href="tel:604-555-0101"`, `toHaveLength(2)` | PASS |
| C131 | site row: link, address, contact, 5 | vitest `C131:` green | `customers.test.ts:116-119` - `href="\/sites\/s1"`, address, contact, `toContain("5 assets")` | PASS |
| C132 | agreement row text; reader computes `$16,000` the same way | vitest `C132:` x2 green | `customers.test.ts:129-131` - `"AG-1048 · v1"`, `"Sent to customer"`, `"$16,000/yr"`; `readers.test.ts:212` - `toMatchObject({ id:"new", siteName:"Late site", stage:"sent", versionNo:1, annualCents:1600000 })` | PASS |
| C133 | three empty lines | vitest `C133:` green | `customers.test.ts:136` - `toContain(text)` for "No contacts yet", "No sites yet", "No agreements yet" | PASS |
| C134 | contacts and sites by `created_at` ascending, agreements by `updated_at` descending | vitest `C134:` green | `readers.test.ts:217-219` - `toEqual(["c-early","c-late"])`, `toEqual(["s-early","s-late"])`, `toEqual(["new","old"])` | PASS |
| C135 | title, address, customer link, contact, "5 assets" / "1 asset" | vitest `C135:` green | `web/components/sites/sites.test.ts:38` - `href="\/customers\/cust-1"`; `:40` - `toContain(">5 assets<")`; `:41` - `">1 asset<"` | PASS |
| C136 | groups ordered by type name, heading and count | vitest `C136:` green | `sites.test.ts:72-76` - `toEqual([["BOILER - Boiler",2],["EXPANSION_TANK - Expansion tank",1],["RTU - Rooftop unit",1]])` | PASS - see precision gap 5 |
| C137 | `B-1`, `B-2`, `B-10`, then two nulls | vitest `C137:` green | `sites.test.ts:87` - `toEqual(["B-1","B-2","B-10",null,null])` | PASS |
| C138 | unit, model, location, "Manual"/"Imported", dash | vitest `C138:` green | `sites.test.ts:46`, `:47` - `toContain("Imported")`, `:48` - `toMatch(/<span[^>]*>-<\/span>/)` | PASS |
| C139 | `filterAssets` four fields and empty-group removal; live search narrows rows | vitest `C139:` x2 green; live half not run - needs user | `sites.test.ts:97-101` - `toEqual([boiler])` ... `toEqual([])`; `:105` - `toEqual(["EXPANSION_TANK"])` | PARTIAL - live half not run |
| C140 | "No equipment matches "zzz"" and "Clear search" | vitest `C140:` green | `sites.test.ts:53-54` | PASS |
| C141 | empty register text | vitest `C141:` green | `sites.test.ts:59-60` | PASS |
| C142 | ten labelled controls hold the stored values | vitest `C142:` green | `web/components/settings/settings.test.ts:52` - `toMatch(<label ... for="${id}" ...>${label}</label>)`; `:53` - `expect(control(out, id), label).toContain(`value="${value}"`)`; `:56` - `<option value="BC" selected` | PASS |
| C143 | 10, 5.5, 5.25, 0, null formatting | vitest `C143:` x5 green | `web/domain/org-settings/org-settings.test.ts:92` - `expect(formatSettingNumber(value)).toBe(shown)` | PASS |
| C144 | owner and admin: editable, Save present | vitest `C144:` x2 green | `settings.test.ts:61-63` - `hasAttr(..."readOnly")).toBe(false)`, province `disabled` false, `type="submit"...Save changes` | PASS - see level gap 2 |
| C145 | estimator and viewer: every control read-only, message, no Save | vitest `C145:` x2 green | `settings.test.ts:69-73` - `readOnly` true on `legalName` and `repairDiscountPct`, province `disabled` true, message present, `not.toContain("Save changes")` | PARTIAL - the claim says every control; 3 of 10 are asserted |
| C146 | null settings gives the message and no form; the store returns `null` on no row | vitest `C146:` x2 green | `settings.test.ts:78-79` - `toContain("Company settings have not been set up ...")`, `not.toContain("<form")`; `web/infrastructure/supabase/settings.test.ts:27` - `.get(ORG)).toBeNull()` | PASS |
| C147 | 33 validation inputs | vitest `C147:` x7 green | `org-settings.test.ts:23` (`Object.keys(result.errors)).toEqual([field])`), `:28`; the inputs at `:34-37`, `:41-47`, `:51-55`, `:59-61`, `:65-68`, `:72-75` | PASS |
| C148 | invalid state: messages under their fields, exactly two `aria-invalid`, values kept; action makes 0 save calls | vitest `C148:` x2 green | `settings.test.ts:93` - `expect(out.match(/aria-invalid/g)).toHaveLength(2)`; `:94` - the `legalName-error` message; `:92`, `:95` - kept values; `web/app/(app)/screens.test.ts:115` - `expect(saveOrgSettings).not.toHaveBeenCalled()`; `:117` - error keys `["cpiCapPct","legalName"]` | PARTIAL - only 1 of the 2 messages is asserted under its field |
| C149 | trim and null; one `update` on `org_settings` filtered by `org_id`, `updated_at` from the clock, 0 `rpc`; "Settings saved" | vitest `C149:` x4 green | `org-settings.test.ts:80`; `settings.test.ts` (infra) `:35` - `toHaveLength(1)`, `:44` - `updated_at: "2026-10-24T12:00:00.000Z"`, `:46` - `eq ["org_id", ORG]`, `:47` - `expect(client.rpc).not.toHaveBeenCalled()`; `settings.test.ts` (component) `:99` - `toContain("Settings saved")`; `screens.test.ts:125-128` | PASS - see precision gap 4 |
| C150 | empty update result gives `forbidden`; message shown and values kept | vitest `C150:` x2 (+1 `C150/C151` each) green | `infra settings.test.ts:52` - `toEqual({ ok:false, code:"forbidden" })`; `component settings.test.ts:105-106` | PASS |
| C151 | `unavailable` plus `console.error` with the code, for an error reply and for a rejected request; message shown | vitest `C151:` x3 green | `infra settings.test.ts:58-59` - `toEqual({ok:false, code:"unavailable"})`, `spy.mock.calls[0][0]).toContain("XX000")`; `:69` - `toContain("fetch failed")`; `component settings.test.ts:112-113` | PASS |
| C152 | `pending` gives a disabled "Saving…"; idle gives an enabled "Save changes" | vitest `C152:` green | `settings.test.ts:118` - `hasAttr(saving, "disabled")).toBe(true)`; `:121` - `hasAttr(idleButton, "disabled")).toBe(false)` | PASS |
| C153 | `Select`: label, native select, same heights as `TextInput`; error gives aria, `border-danger` | vitest `C153:` x2 green | `web/components/ui/select.test.ts:22` - `expect(heights(select)).toEqual(heights(input))`; `:28-30` - `aria-invalid="true"`, `aria-describedby="province-error"`, `border-danger` | PASS (44px / 34px not asserted by value; both sides are `h-11 lg:h-[34px]` in `select.tsx:73` / `text-input.tsx:23`) |
| C154 | exactly 13 codes plus an empty option | vitest `C154:` x2 green | `org-settings.test.ts:98` - `toEqual([ "AB", ..., "YT" ])`; `settings.test.ts:127` - `expect(values).toEqual(["", ...PROVINCES])` | PASS |
| C155 | `.limit(500)` on customers, assets, agreements | vitest `C155:` x3 green | `readers.test.ts:124`, `:165`, `:255` - `toContainEqual({ table, method:"limit", args:[500...] })`; code `readers.ts:80`, `:125`, `:219` | PASS |
| C156 | nav hrefs | vitest `C156:` x7 green | `web/components/shell/nav-items.test.ts:12` - `toBe(href)`; `:17` - `toBeUndefined()` | PASS |
| C157 | ROADMAP shows 2 ticked lines | `grep -c -E "^- \[x\] (Screens built to DESIGN.md\|Form control \`Select\`)" ROADMAP.md` printed 2 | `ROADMAP.md` diff, 2 `[ ]` to `[x]` | PASS (ticked while 12 checks are unrun; see gap 7) |
| C158 | `AD-023..025` active | `grep -c -E "^\| AD-02[345] \|.*\| active \|" .specs/STATE.md` printed 3 | `.specs/STATE.md` diff, 3 added rows | PASS |
| C159 | CONTEXT Build log link; no "No screen yet"/"Not built yet: real data"; no "Select is built with the Phase 1" | greps printed 1 / 0 / 0 | `CONTEXT.md` (1), `DESIGN.md` (0) | PASS |
| C160 | live, controls at least 44px high at 375 and 768 | live - not run - needs user | none | NOT PROVEN |
| C161 | live, no console or network errors | live - not run - needs user | none | NOT PROVEN |
| C162 | `get_advisors(security)` shows no new lint | mcp - not run - needs user | none | NOT PROVEN |

## Coverage

Not required at `light`; the join was not recomputed. Gaps found while reading, as a short list.

Level gaps:
1. Status codes: `404` (C105) and `200` (C109) are claimed in `checks.md` but are proven only live, so no automated proof crosses the HTTP boundary. Page tests call the page function with a mocked `notFound()`.
2. C144 and C145 claim every control (10) and assert 2 and 3. A control that forgets `readOnly` or `disabled` passes (for example `phone`, `taxNote`, `accentColor`).
3. C148 claims "each message directly under its field". Only the `legalName` message is asserted by id and position, and the `cpiCapPct` message text is never asserted.
4. C112 says an empty column shows "no total". Nothing asserts the absence.
5. The `404` cause "another org's" (Coverage row, C101) is proven only by the unrun SQL block.

Precision gaps:
1. C119 shell proof says `grep -rn "sample-pipeline" web ...` "prints nothing". It prints two hits, both in `web/components/kanban/pipeline-view.test.ts:77,80`, which is the test itself. The vitest proof is the real one and passes; the shell line is unsatisfiable as written.
2. C121: the view test feeds already-sorted input (`customers.test.ts:23`), so the view's order proves nothing. Order is proven only at the reader (`readers.test.ts:143`). The check's "input order bravo, Alpha, charlie" at the view level is not exercised, and the test's name begins with the check id but asserts a weaker thing.
3. C103 "the dev server's output contains a digest": `error.tsx` has no logging, so the claim leans on Next's behaviour and is live-only. The check does not say who logs.
4. C149 "updated_at equal to the fixed clock's ISO time": the store test passes the time in as an argument (`settings.test.ts:30`, `AT`), and the wiring `systemClock.now()` in `composition/index.ts:62` is not asserted by any test. A wrong clock in the container would pass.
5. C136 "each group header as `<code> - <name>` with its count": asserted on `groupAssets` output (`heading`, `count`), not on the rendered markup of the register view.
6. C153 "44px below 1024px and 34px above" is checked as "same height classes as TextInput" (arrays equal), not by value. This is acceptable since the classes are `h-11 lg:h-[34px]`, but the 44/34 numbers appear nowhere in a test.
7. `checks.md` header says 63 checks; the list has 62 (C101-C162).

## Test policy rows

`checks.md` has no `Test policy` section; none apply at `light`.

## Faults injected

Not run - `light` profile skips fault injection. No source file was mutated, and no worktree was created.

## Swept `existing` rows

Plan "Observable" has `existing - MemberGate` for the unauthorised row of each screen. `web/app/(app)/member-gate.tsx` exists and is used by `web/app/(app)/layout.tsx`. The signed-out redirect is exercised by C108 at `updateSession`, not at `MemberGate`. No cited constraint is missing.

## Gate

- `cd web && npx vitest run --reporter=verbose` - 390 passed, 0 failed
- `cd web && npx eslint .` - exit 0
- `cd web && npx tsc --noEmit` - exit 0
- `cd web && npx next build` - exit 0; route table lists `/customers`, `/customers/[customerId]`, `/pipeline`, `/settings`, `/sites/[siteId]`; 0 hits for `customerId]/sites`
- greps for C119, C157, C158, C159 - results in the Checks table (C119's grep prints test-file hits, see precision gap 1)
- Not run, by instruction: live Playwright (C103, C105, C107, C109, C126, C127, C139, C160, C161) and `seed` / `mcp` proofs (C101 SQL half, C120, C162). All need the user.
