# Customer, site and asset forms verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 9e237b5..HEAD
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2, HEAD `4cf20ce`. Round 1 (at `4503797`) failed on C339 only. The fix, `4cf20ce`, touches
only `web/app/(app)/record-forms.test.ts`: the page-level C339 test now pins the exact Cancel href
per route. All proofs were re-run in full at `4cf20ce`, C339 was re-judged and is proven, and the
other 47 checks carry their round 1 evidence (no source file changed; `git diff 4503797..HEAD --stat`
lists only the test file). 48 of 48 checks are proven.

## Binding sources

Carried from `4503797`: no binding source. The plan marks no source binding, and step 1 runs only under `ui`.

## Proofs run at HEAD (`4cf20ce`)

Verified at `4cf20ce`.

| Command (from `web/`) | Result |
| --- | --- |
| `npx vitest run domain/records infrastructure/supabase components "app/(app)" composition scripts --reporter=verbose` | exit 0, 319 passed, 0 failed. Every check id with a vitest proof (C301-C314, C316-C320, C322-C335, C337-C341, C345, C348) appears as passed (`✓`) lines, none fails. Per-id passed counts are identical to round 1: C306 2, C309 4, C312 2, C314 2, C316 2, C318 3, C319 2, C320 2, C322 2, C323 2, C324 4, C325 2, C326 2, C329 7, C330 8, C331 11, C332 9, C333 11, C334 6, C335 4, C337 10, C338 2, C339 16, C340 2, C341 8, C345 8, C348 2, every other id 1 |
| `npm test` | exit 0, 35 files, 568 tests passed |
| `npm run lint` | exit 0 |
| `npx next build` | exit 0; the route list contains all 8 form routes (C342) |
| `npm run test:db` | exit 0, 10 recipes including `PASS record_forms`, `10 passed, 0 failed` (covers C315, C321, C327 SQL, C336, C346) |
| C344 greps (from `web/`) | `record-forms` in `../CONTEXT.md`: 2; ROADMAP `[x]` line: 1; AD-028/029/030 `active`: 3; all exit 0 |

Real-tree `git status --porcelain` before and after every run (including the scratch-worktree
fault check): `?? .specs/features/record-forms/verification.md` only. The only file this
verifier wrote in the repo is this report.

## Checks

Rows other than C339 are `carried from 4503797`: their proofs were re-run green at `4cf20ce`, their
evidence is carried. Only line numbers in the touched file were refreshed (C341; every other
citation into `record-forms.test.ts` sits above line 316 and did not move).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C301 | writer `/customers` shows "New customer" in the header and in the empty state | re-run at `4cf20ce`: vitest batch, `C301:` passed | carried from `4503797`: `web/components/customers/customers.test.ts:152` - `expect(empty.match(/<a[^>]*href="\/customers\/new"[^>]*>New customer<\/a>/g)).toHaveLength(2)`; `:153` - `toMatch(/No customers yet[\s\S]*<a[^>]*href="\/customers\/new"/)` | PASS |
| C302 | `validateCustomer` trims and enforces 1-120 | re-run at `4cf20ce`: vitest batch, `C302:` passed | carried from `4503797`: `web/domain/records/records.test.ts:10` - `toEqual({ ok: true, value: { name: "Acme" } })`; `:13-16` - `["", "   ", chars(121)]` each `toEqual({ ok: false, errors: { name: "Customer name must be 1 to 120 characters" } })` | PASS |
| C303 | createCustomer calls store `(orgId, {name})` once, redirects to `/customers/<id>` | re-run at `4cf20ce`: vitest batch, `C303:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:106` - `rejects.toThrow(\`NEXT_REDIRECT /customers/${NEW_ID}\`)`; `:108` - `toHaveBeenCalledWith(ORG, { name: "Acme" })` | PASS |
| C304 | invalid name returns `invalid` with message and typed value, no store call | re-run at `4cf20ce`: vitest batch, `C304:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:113-117` - `toEqual({ status: "invalid", errors: { name: "Customer name must be 1 to 120 characters" }, values: { name: typed } })`; `:118` - `expect(storeCalls()).toBe(0)` | PASS |
| C305 | invalid field: message in `aria-describedby`, `aria-invalid`, value kept | re-run at `4cf20ce`: vitest batch, `C305:` passed | carried from `4503797`: `web/components/records/records.test.ts:38-41` - `toContain('aria-invalid="true"')`, `toContain(\`value="${typed}"\`)`, `toMatch(<p id="${describedBy}">Customer name must be 1 to 120 characters</p>)` | PASS |
| C306 | writer detail shows Edit link; edit page prefilled | re-run at `4cf20ce`: vitest batch, 2 `C306:` passed | carried from `4503797`: `web/components/customers/customers.test.ts:157` - `toMatch(/<a[^>]*href="\/customers\/c1\/edit"[^>]*>Edit<\/a>/)`; `web/app/(app)/record-forms.test.ts:282` - `toMatch(/<input[^>]*id="name"[^>]*value="Kettle Test"/)` | PASS |
| C307 | updateCustomer calls `(id, {name})` once, redirects | re-run at `4cf20ce`: vitest batch, `C307:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:122` - `rejects.toThrow(\`NEXT_REDIRECT /customers/${CUSTOMER}\`)`; `:124` - `toHaveBeenCalledWith(CUSTOMER, { name: "Acme Two" })` | PASS |
| C308 | Add contact link and per-row Edit | re-run at `4cf20ce`: vitest batch, `C308:` passed | carried from `4503797`: `web/components/customers/customers.test.ts:162-163` - `href="\/customers\/c1\/contacts\/new"...>Add contact`; `href="\/contacts\/ct1\/edit"...>Edit` | PASS |
| C309 | `validateContact` bounds and messages | re-run at `4cf20ce`: vitest batch, 4 `C309:` passed | carried from `4503797`: `web/domain/records/records.test.ts:25` - `value: { name: "Dana", email: null, phone: null }`; `:32` - `errors: { name: "Contact name must be 1 to 120 characters" }`; `:40-44` - `["ab.co", "a@b", "a b@c.co", email(255)]` give `errors: { email: "Enter an email like name@company.com" }`; `:39` 254 accepted; `:50` - `errors: { phone: "Phone must be 40 characters or fewer" }` | PASS |
| C310 | createContact calls `(orgId, customerId, {..., email: null})`, redirects | re-run at `4cf20ce`: vitest batch, `C310:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:132` - `toHaveBeenCalledWith(ORG, CUSTOMER, { name: "Dana", email: null, phone: "604-555-0111" })`; `:130` - redirect `/customers/${CUSTOMER}` | PASS |
| C311 | updateContact calls `(contactId, value)`, redirects to its customer | re-run at `4cf20ce`: vitest batch, `C311:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:136-137` - `rejects.toThrow(\`NEXT_REDIRECT /customers/${CUSTOMER}\`)`; `:140` - `toHaveBeenCalledWith(CONTACT, {...})` | PASS |
| C312 | two-step delete prompt (component + live) | re-run at `4cf20ce`: vitest batch, 2 `C312:` passed; live is author-reported | carried from `4503797`: `web/components/records/records.test.ts:46-47` - `toMatch(/<button[^>]*type="button"[^>]*>Delete contact</)`, `not.toContain('type="submit"')`; `:52-54` - `toContain("Delete Dana? This can't be undone.")`, submit `Delete` inside `<form>`, `type="button"` Cancel. Live: author-reported (checks.md Handoff, Boundary (live)). Corroborated by `.playwright-mcp/touch-journey.js`, which waits for the prompt text, taps Cancel, then taps "Delete contact" again. That button exists only when not confirming (`delete-control.tsx:26-39`), so the prompt was hidden. The later confirmed delete redirected to the customer, which `deleteContactAction` does only if the contact still existed (`record-actions.ts:113-117`), so Cancel deleted nothing. Judged adequate | PASS |
| C313 | deleteContact calls `(contactId)`, redirects to customer | re-run at `4cf20ce`: vitest batch, `C313:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:144` - `rejects.toThrow(\`NEXT_REDIRECT /customers/${CUSTOMER}\`)`; `:146` - `toHaveBeenCalledWith(CONTACT)` | PASS |
| C314 | `in_use` state and its alert text | re-run at `4cf20ce`: vitest batch, 2 `C314:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:151` - `toEqual({ status: "in_use" })`; `web/components/records/records.test.ts:58-59` - `toMatch(/<p[^>]*role="alert"[^>]*>This contact is a site contact\. Choose another site contact for that site first\.<\/p>/)` | PASS |
| C315 | SQL: estimator deletes unused contact (1 row); site contact refused 23503 and kept | re-run at `4cf20ce`: `npm run test:db record_forms` exit 0 | carried from `4503797`: `supabase/tests/record_forms.sql:56-57` - `tests.expect_error('C315 delete a site contact', ... ctA, '23503')`; `:58` - `count(*) ... ctA = 1`; `:59` - `tests.expect_rows('C315 delete an unused contact', ... ct2A, 1)` | PASS |
| C316 | Add site on customer, Edit site on site page | re-run at `4cf20ce`: vitest batch, 2 `C316:` passed | carried from `4503797`: `web/components/customers/customers.test.ts:167` - `href="\/customers\/c1\/sites\/new"...>Add site`; `web/components/sites/sites.test.ts:121` - `href="\/sites\/s1\/edit"...>Edit site` | PASS |
| C317 | site contact select: "No site contact", then contacts by name | re-run at `4cf20ce`: vitest batch, `C317:` passed | carried from `4503797`: `web/components/records/records.test.ts:67-71` - `options(...)` `toEqual([{ value: "", ..., text: "No site contact" }, { value: "c-amy", ... "Amy" }, { value: "c-zed", ... "Zed" }])`; `:74` - exactly one option `value: ""` | PASS |
| C318 | `validateSite` bounds, address, contact membership | re-run at `4cf20ce`: vitest batch, 3 `C318:` passed | carried from `4503797`: `web/domain/records/records.test.ts:61` - `errors: { name: "Site name must be 1 to 120 characters" }`; `:67-70` - `errors: { address: "Address must be 300 characters or fewer" }`; `:74` - `siteContactId: null`; `:76-79` - `errors: { siteContactId: "Choose a contact of this customer" }` | PASS |
| C319 | createSite reads the customer's contacts, calls store once, redirects; foreign contact refused | re-run at `4cf20ce`: vitest batch, 2 `C319:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:158` - `customerDetail toHaveBeenCalledWith(CUSTOMER)`; `:160` - `createSite toHaveBeenCalledWith(ORG, CUSTOMER, {...})`; `:157` - redirect `/sites/${NEW_ID}`; `:165-166` - `toMatchObject({ status: "invalid", errors: { siteContactId: "Choose a contact of this customer" } })`, `storeCalls()).toBe(0)` | PASS |
| C320 | updateSite action + adapter payload has exactly 3 keys | re-run at `4cf20ce`: vitest batch, 2 `C320:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:170-172` - redirect `/sites/${SITE}`, `toHaveBeenCalledWith(SITE, {...})`; `web/infrastructure/supabase/records.test.ts:25` - `expect(update?.args[0]).toEqual({ name: "Tower A", address: null, site_contact_id: PARENT })` | PASS |
| C321 | SQL: a foreign-customer site contact refused 23503 on insert and update | re-run at `4cf20ce`: `npm run test:db record_forms` exit 0 | carried from `4503797`: `supabase/tests/record_forms.sql:50-52` - `expect_error('C321 insert with another customer''s contact', ..., '23503')`; `:53-54` - `expect_error('C321 update to another customer''s contact', ..., '23503')` | PASS |
| C322 | Add asset (header + empty register), per-row Edit | re-run at `4cf20ce`: vitest batch, 2 `C322:` passed | carried from `4503797`: `web/components/sites/sites.test.ts:126-128` - `href="\/sites\/s1\/assets\/new"...>Add asset`, `href="\/assets\/a-1\/edit"...>Edit`; `:133-134` - `toHaveLength(2)`, `No equipment recorded yet[\s\S]*href="\/sites\/s1\/assets\/new"` | PASS |
| C323 | `listAssetTypes` ordered by name; select empty-first, `name (code)` | re-run at `4cf20ce`: vitest batch, 2 `C323:` passed | carried from `4503797`: `web/infrastructure/supabase/readers.test.ts:314` - `toContainEqual({ table: "asset_types", method: "order", args: ["name"] })`; `web/components/records/records.test.ts:83-87` - `toEqual([{ value: "", selected: true, ... }, { ... "Boiler (BOILER)" }, { ... "Rooftop unit (RTU)" }])` | PASS |
| C324 | `validateAsset` type membership and length bounds | re-run at `4cf20ce`: vitest batch, 4 `C324:` passed | carried from `4503797`: `web/domain/records/records.test.ts:92` - `errors: { assetTypeId: "Choose an equipment type" }` for `""` and `"t9"`; `:101-102` - table over unitNo 40, typeModel 120, location 300 with exact messages; `:89` - empty optionals `null` | PASS |
| C325 | createAsset action + insert payload `source: "manual"`, org and site from args | re-run at `4cf20ce`: vitest batch, 2 `C325:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:180` - `toHaveBeenCalledWith(ORG, SITE, {...})`; `web/infrastructure/supabase/records.test.ts:35-43` - `toEqual({ org_id: ORG, site_id: PARENT, ..., source: "manual" })` | PASS |
| C326 | updateAsset action + update payload keys, no `source` | re-run at `4cf20ce`: vitest batch, 2 `C326:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:184-186` - redirect `/sites/${SITE}`, `toHaveBeenCalledWith(ASSET, {...})`; `web/infrastructure/supabase/records.test.ts:51` - `Object.keys(...).sort()).toEqual(["asset_type_id", "location", "type_model", "unit_no"])` | PASS |
| C327 | deleteAsset action redirects; SQL estimator deletes 1 row | re-run at `4cf20ce`: vitest `C327:` passed; `test:db record_forms` exit 0 | carried from `4503797`: `web/app/(app)/record-forms.test.ts:190-192` - redirect `/sites/${SITE}`, `toHaveBeenCalledWith(ASSET)`; `supabase/tests/record_forms.sql:61` - `expect_rows('C327 delete an asset', ..., 1)` | PASS |
| C328 | no asset types: empty-catalog message, no submit | re-run at `4cf20ce`: vitest batch, `C328:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:288-289` - `toContain("Your equipment catalog is empty.")`, `not.toContain('type="submit"')` | PASS |
| C329 | `canWriteRecords` per role; viewer views show no write controls | re-run at `4cf20ce`: vitest batch, 7 `C329:` passed | carried from `4503797`: `web/components/records/records.test.ts:91-94` - owner/admin/estimator `true`, viewer `false`; `web/components/customers/customers.test.ts:177-178` and `web/components/sites/sites.test.ts:142-143` - `not.toMatch(...)` on any `href` ending `/new` or `/edit` (the regex alternation is not reproduced here because a pipe would break this table) and none of the control texts, over populated and empty lists | PASS |
| C330 | viewer on each of 8 form pages: reason, no `<form>` | re-run at `4cf20ce`: vitest batch, 8 `C330:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:295-296` - `toContain("Only owners, admins and estimators can change customer records.")`, `not.toContain("<form")`, `test.each` over all 8 page routes (`:292`) | PASS |
| C331 | 10 actions refuse a viewer with no store call; forbidden alert | re-run at `4cf20ce`: vitest batch, 11 `C331:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:213-214` - `toEqual({ status: "forbidden" })`, `storeCalls()).toBe(0)` over all 10 (`:196-207`); `web/components/records/records.test.ts:98` - `role="alert"...>You don't have permission to change customer records\.` | PASS |
| C332 | 7 id pages call `notFound()` on null; by-id readers reject non-uuid with 0 calls | re-run at `4cf20ce`: vitest batch, 9 `C332:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:311-312` - `rejects.toThrow("NEXT_NOT_FOUND")`, `notFound toHaveBeenCalledTimes(1)` over all 7; `web/infrastructure/supabase/readers.test.ts:275-277` - `contact("not-a-uuid")).toBeNull()`, `asset("not-a-uuid")).toBeNull()`, `calls).toHaveLength(0)`; `:281-282` - no row gives `toBeNull()` | PASS |
| C333 | store `not_found` becomes state `not_found` (+values); alert links to `/customers` | re-run at `4cf20ce`: vitest batch, 11 `C333:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:220-221` - `toMatchObject({ status: "not_found" })`, `toHaveProperty("values")` for the 8 non-delete actions; `web/components/records/records.test.ts:103-104` - `toContain("This record no longer exists.")`, `role="alert"[\s\S]*<a[^>]*href="\/customers"` | PASS |
| C334 | store error mapping, 6 rows | re-run at `4cf20ce`: vitest batch, 6 `C334:` passed | carried from `4503797`: `web/infrastructure/supabase/records.test.ts:80` - `42501` gives `forbidden`; `:85-89` - `23503` create/update gives `not_found`; `:94` - `23503` delete gives `in_use`; `:99-100` - `[]` gives `not_found`; `:106-107` - `XX000` gives `unavailable` and `spy...toContain("XX000")`; `:116-117` - thrown gives `unavailable` and `toContain("fetch failed")` | PASS |
| C335 | create actions ignore org/parent/source form fields | re-run at `4cf20ce`: vitest batch, 4 `C335:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:248` - `expect(args.slice(0, -1)).toEqual(expectedIds)` (expected `[ORG]` / `[ORG, CUSTOMER]` / `[ORG, SITE]`, while `extra()` at `:256-257` sets every id field to `...0000bb` and `source` to `import`); `:250` - `value).not.toHaveProperty(key)` for all 7 keys. If an action passed a form-supplied id, `:248` would fail | PASS |
| C336 | SQL: estimator inserts 4; viewer inserts 42501, update/delete 0 rows; foreign parent 23503; foreign update 0 | re-run at `4cf20ce`: `npm run test:db record_forms` exit 0 | carried from `4503797`: `supabase/tests/record_forms.sql:41-48` - four `expect_rows(..., 1)` as `uE`; `:8-15` - four `expect_error(..., '42501')` as `uV`; `:17-25` - eight `expect_rows(..., 0)`; `:32-33` - `expect_error('C336 foreign parent', ..., '23503')` as `uA`; `:34` - `expect_rows('C336 foreign asset update', ..., 0)` | PASS |
| C337 | store `unavailable` becomes state with typed values; alert and inputs keep values | re-run at `4cf20ce`: vitest batch, 10 `C337:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:235` - `toEqual({ status: "unavailable", values: typed })`; `:227-229` - status `unavailable` and non-empty string values over all 8 form actions; `web/components/records/records.test.ts:110-113` - `role="alert"...>We couldn't save your changes\. Try again\.`, inputs `value="Dana Typed"`, `value="dana@example.com"`, `value="604-555-0111"` | PASS |
| C338 | pending save "Saving…" disabled; pending delete "Deleting…" disabled | re-run at `4cf20ce`: vitest batch, 2 `C338:` passed | carried from `4503797`: `web/components/records/records.test.ts:117` - `toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Saving…<\/button>/)`; `:121` - `...disabled=""[^>]*>Deleting…<\/button>` | PASS |
| C339 | each of 8 forms renders Cancel with its exact href | vitest batch at `4cf20ce`, 16 `C339:` passed (8 component + 8 page, each page row naming its expected href) | verified at `4cf20ce`: `web/app/(app)/record-forms.test.ts:316-324` - table of route to exact href: `/customers/new` -> `/customers`; customer edit, contact new/edit, site new/edit -> `/customers/${CUSTOMER}`; asset new/edit -> `/sites/${SITE}`; `:327` - `expect(cancels).toEqual([href])`, where `:326` collects every `<a href>` whose text is `Cancel`, so exactly one Cancel with exactly that target; `:328` - `toMatch(/<form[\s\S]*>Cancel<\/a>/)` keeps it inside the form page. The ids are distinct uuids (`:51-54` CUSTOMER/CONTACT/SITE/ASSET), so a page passing its own record id or the wrong kind yields a different href. The mapping itself stays proven at `web/components/records/records.test.ts:135-136` (carried from `4503797`). Fault check: in a scratch worktree, `contacts/[contactId]/edit/page.tsx:25` changed to `cancelHrefFor("edit-contact", { customerId: contactId })` made `C339: a writer on /contacts/[contactId]/edit ...` fail (expected `/customers/1111...`, received `/customers/2222...`) | PASS |
| C340 | container exposes 13 functions; 4 store ports, delete only on contact/asset; no UI import of adapters | re-run at `4cf20ce`: vitest 2 `C340:` passed; `npm run lint` exit 0 | carried from `4503797`: `web/composition/composition.test.ts:80` - `expect(typeof container[name], name).toBe("function")` over all 13 names; `:87-90` - ContactStore/AssetStore `toContain("delete(id: string)")`, CustomerStore/SiteStore `not.toContain("delete(")`; `web/eslint.config.mjs:74-86` - `no-restricted-imports` `["@/infrastructure", "@/infrastructure/*", "@supabase/*"]` on `app/**` and `components/**`, lint exit 0 | PASS |
| C341 | 8 loading routes show `<h1>` and `role="status"` "Loading…" | re-run at `4cf20ce`: vitest batch, 8 `C341:` passed | carried from `4503797`: `web/app/(app)/record-forms.test.ts:346-347` (line refreshed at `4cf20ce`; touched file) - `toMatch(new RegExp(\`<h1[^>]*>${title}</h1>\`))`, `toMatch(/<p[^>]*role="status"[^>]*>Loading…<\/p>/)` | PASS |
| C342 | `next build` exits 0 and lists the 8 routes | re-run at `4cf20ce`: `npx next build` exit 0 | carried from `4503797`: Build route list at HEAD: `/customers/new`, `/customers/[customerId]/edit`, `/customers/[customerId]/contacts/new`, `/contacts/[contactId]/edit`, `/customers/[customerId]/sites/new`, `/sites/[siteId]/edit`, `/sites/[siteId]/assets/new`, `/assets/[assetId]/edit` all present. Route files: `web/app/(app)/customers/new/page.tsx:11` - `export default async function NewCustomerPage()` (and the 7 sibling `page.tsx`) | PASS |
| C343 | live journey S1-S4 at 375/768/1440, no hscroll, ≥44 px, clean console/network | re-run at `4cf20ce`: not re-runnable by the verifier (no signed-in browser); assessed from author evidence | carried from `4503797`: Author-reported: checks.md `## Handoff`, Boundary (live), `.specs/features/record-forms/checks.md:438-443`. Partly corroborated on disk: `.playwright-mcp/touch-journey.js` runs S1-S4 by `tap()` at 375x812 and 768x1024 with `hasTouch/isMobile`, measures `hscroll` and controls under 44 px on each state, and collects console errors/warnings, failed requests and ≥400 responses. `.playwright-mcp/console-2026-10-26T19-10-03-484Z.log:41` (the post-`e503c3a` session) has one `[ERROR]`, a hydration mismatch whose diff is `style={{caret-color:"transparent"}}` on the search input, which matches the author's screenshot-injection explanation; it has no other error or warning. Screenshots `record-forms-site-375.png` / `-768.png` exist. Two deviations from the claim's literal wording, judged harness artifacts and not app defects: that hydration error, and router-cancelled `net::ERR_ABORTED` RSC fetches. The 375/768 script output and the 1440 click run are author-reported only. Judged adequate | PASS |
| C344 | STATE AD-028/029/030 active; CONTEXT mentions record-forms, not read-only; ROADMAP ticked | re-run at `4cf20ce`: the three greps exit 0 | carried from `4503797`: `../CONTEXT.md` count 2 (`CONTEXT.md:43` - `**Forms (record-forms):** owners, admins and estimators get "New customer"...`); `ROADMAP.md` `^- \[x\] Customer, site and asset forms` count 1; `.specs/STATE.md:34-36` - the `AD-028` .. `AD-030` table rows, `active` count 3. The diff removes "Both are read-only (no screen creates customers yet)" and the site "Read-only." from CONTEXT.md (the remaining "lists are read-only" is the dated 2026-10-24 build-log entry) | PASS |
| C345 | signed out, the 8 form routes get 307 to `/login` | re-run at `4cf20ce`: vitest batch, 8 `C345:` passed | carried from `4503797`: `web/infrastructure/supabase/session.test.ts:131-132` - `expect(response.status).toBe(307)`, `expect(locationPath(response)).toBe("/login")`, `test.each` over all 8 paths (`:117-126`) | PASS |
| C346 | `npm run test:db` exits 0 and runs `record_forms` | re-run at `4cf20ce`: `npm run test:db` exit 0, `PASS record_forms`, `10 passed, 0 failed` | carried from `4503797`: `web/scripts/test-db/runner.mts:38` - `plain("record_forms")`; `web/scripts/test-db/runner.test.ts:88` - `expect(parts.record_forms).toEqual(["fixture.sql", "record_forms.sql"])` | PASS |
| C347 | whole Vitest suite passes | re-run at `4cf20ce`: `npm test` exit 0, 35 files, 568 passed | carried from `4503797`: Suite summary `Tests 568 passed (568)`. Regression-sensitive witness: `web/app/(app)/screens.test.ts:38`, the only change to that file, adds `currentMember.mockResolvedValue({ ..., role: "owner" })` in `beforeEach`; no assertion changed | PASS |
| C348 | writer views still show all contact, site, agreement and asset rows | re-run at `4cf20ce`: vitest batch, 2 `C348:` passed | carried from `4503797`: `web/components/customers/customers.test.ts:183-187` - `toContain("dana@example.com")`, `href="\/sites\/s1"...>Tower A`, `"1 Main St"`, `"AG-1 · v1"`, `"$1,200/yr"`; `web/components/sites/sites.test.ts:148-151` - `"B-7"`, `"Condensing boiler"`, `"Roof"`, `"Manual"` | PASS |

## Level and sampling judgment

- **C339 (verified at `4cf20ce`, closed).** The page test now renders each of the 8 form pages
  through its real Server Component and asserts the full list of Cancel targets equals the one
  expected href. Wrong kind or wrong id on any page changes the href and fails the row; this was
  shown by one injected fault (wrong id on edit-contact), killed. The gap from round 1 is closed.

The remaining judgments are carried from `4503797`:

- **C330**: proven by invoking each page's Server Component and rendering it. The claim names a
  message and the absence of `<form>`, not a status, so the level is right. The Surface `200` is
  covered by the live run (C343).
- **C332**: the claim names `notFound()`, and the proof asserts it at each of the 7 pages. The HTTP
  `404` itself comes from Next's `notFound()` contract plus the existing `(app)/not-found.tsx`, and
  no proof observes it over HTTP. I accept this because the framework, not this code, decides the
  status. Observation, not a gap.
- **C342**: at the boundary. The real build's route list contains all 8 routes.
- **C345**: at the boundary. The real `updateSession` asserts `307` and the `Location` path for all 8.
- **C335**: it would fail on a wrong implementation. `extra()` writes foreign ids into every
  org, parent and source field. `:248` pins the leading store arguments to the member's org and the
  bound route id, and `:250` keeps those keys out of `value`. The claim is limited to creates;
  update and delete take only the bound id (`record-actions.ts:73`, `:105`, `:115`, `:142`, `:166`, `:176`).
- **C337 sampling**: exact typed values are asserted for one action (`updateContact`, `:235`). The
  other 7 are asserted for status and string-valued `values` only. All 8 return the same `values`
  object read from the form (`record-actions.ts:59`, `:74`, `:89`, `:106`, `:129`, `:143`, `:154`,
  `:167` via `refused(code, values)`), so one exact witness is acceptable at `light`. Observation.
- **phase1-validation count change (C201/C203/C204/C210 and C205/C212)**: this only extends the
  pinned values. `record_forms` is inserted into the ordered `ALL` list (`runner.test.ts:18`), and
  its parts are pinned at `:88`. The numbers move 9→10 recipes, 8→9 passing, `8 passed, 1 failed`
  → `9 passed, 1 failed`, and 11→12 files. Every assertion still uses `toBe`/`toEqual`/`toHaveLength`
  on an exact value, and none was loosened or removed.
- **`screens.test.ts`**: one added line in `beforeEach` (a `currentMember` default). No assertion
  changed (`git diff 9e237b5..HEAD -- "web/app/(app)/screens.test.ts"`).

## Swept existing

Carried from `4503797` (no migration or source file changed since).

The Swept rows cite checks, not pre-existing constraints. The existing constraints the plan's
Relations and door 3 depend on are present at HEAD:

- `supabase/migrations/20261019174738_init.sql:74`:
  `foreign key (site_contact_id, customer_id) references public.contacts (id, customer_id)`. It
  has no `on delete` clause, so a referenced contact is refused with `23503`, as C315 shows live.
- `supabase/migrations/20261019174738_init.sql:73`:
  `foreign key (customer_id, org_id) references public.customers (id, org_id)` (AD-003 composite
  parent).
- `supabase/migrations/20261019174738_init.sql:110`:
  `source text not null default 'manual' check (source in ('manual', 'import'))`.
- `supabase/migrations/20261019174738_init.sql:305` / `:321`: the write policies use
  `array['owner', 'admin', 'estimator']` / `private.has_org_role(org_id, array['owner', 'admin', 'estimator'])`.

`n/a` rows (idempotency, concurrency, state transitions) are approved policy, so there is nothing
to check them against.

## Coverage

Carried from `4503797`: not run at `light` (a `standard`/`ui` step).

## Faults injected

Verified at `4cf20ce`. Not required at `light`; one optional fault on the surface the fix created.

| Mutation | Location | Killed |
| --- | --- | --- |
| edit-contact page passes the contact's own id instead of `contact.customerId` to `cancelHrefFor` (scratch `git worktree`, removed after; real-tree porcelain unchanged) | `web/app/(app)/contacts/[contactId]/edit/page.tsx:25` | yes - `C339: a writer on /contacts/[contactId]/edit ...` failed, 1 failed / 7 passed |

## Gate

Verified at `4cf20ce`.

- `npx vitest run domain/records infrastructure/supabase components "app/(app)" composition scripts --reporter=verbose`: 319 passed, 0 failed
- `npm test`: 568 passed, 0 failed (35 files)
- `npm run test:db`: 10 passed, 0 failed (`record_forms` among them)
- `npm run lint`: exit 0
- `npx next build`: exit 0, 8 form routes listed

**Ranked gaps**: none.
