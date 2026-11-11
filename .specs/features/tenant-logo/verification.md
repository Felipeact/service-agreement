# Tenant logo verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: f3cea51..937a3a1 (HEAD)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Verified at 937a3a1. All 40 checks accounted for: 27 PASS, 9 FAIL, 4 Unproven (C3321-C3324 not run by the repo's own gate; C3338 and C3339 are live passes the author has not run and the migration is not applied).

## Binding sources

Step 1 did not run: the profile is `standard` and the step is `ui`-only.

## Checks

Proofs run from `web/`. One batched vitest invocation over the 17 `.test.ts` files that hold the named tests, `-t "C33[0-3][0-9]:"`, verbose: 17 files passed, 61 tests passed, each named test listed individually. SQL: `npm run test:db tenant_logo` printed `PASS tenant_logo`, `1 passed, 0 failed`. The three proofs in checks.md that name a file that does not exist (C3333 `signing.test.ts`, C3334 `review-view.test.tsx`, C3335 `signing-view.test.tsx`) are a precision gap in the checks: the tests live in `application/use-cases/signing-documents.test.ts`, `components/review/logo.test.ts` and `components/signing/signing.test.ts`, and those were the ones run.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3300 | owner and admin insert png and jpg under own org | `npm run test:db tenant_logo` exit 0 | `supabase/tests/tenant_logo.sql:40` - `perform tests.ok('C3300 four objects', (select count(*) ... name like orgA/%) = 4, ...)` | PASS |
| C3301 | estimator, viewer, other-org owner, anon get 42501 on insert; delete removes no row | same | `tenant_logo.sql:53` `expect_error('C3301 insert ' || v_user, ..., '42501')`; `:60` anon the same; `:56` `v_n = 0`; `:65` object kept. The delete half is vacuous: see finding 1 (fault 4 survives) | FAIL (insert half proven, delete half cannot fail) |
| C3302 | bucket limit 1048576, mime types exactly png and jpeg | same | `tenant_logo.sql:74` `b.file_size_limit = 1048576`; `:75` `array_agg(t order by t) = array['image/jpeg','image/png']` | PASS |
| C3303 | non-uuid first segment or foreign org gives 42501 not 22P02 | same | `tenant_logo.sql:83` `expect_error('C3303 not a uuid', ..., '42501')`; `:85` other org `'42501'` | PASS |
| C3304 | `logo_path` shape, 23514 on bad forms | same | `tenant_logo.sql:106` `expect_error('C3304 ' || v_bad, ..., '23514')` over 5 bad forms; `:96-98` null, png, jpg accepted; `:108` row kept | PASS |
| C3305 | bucket public, no select policy | same | `tenant_logo.sql:115` `(select public from storage.buckets ...) is true`; `:116` `not exists (select 1 from pg_policies ... cmd in ('SELECT','ALL') ...)`. Structural only; the live public read is C3339 | PASS |
| C3306 | `portal_view` returns `tenant.logoPath`, null when none, other keys kept | same | `tenant_logo.sql:132` `v #>> '{tenant,logoPath}' = tests.lg_key(...)`; `:133-135` other keys; `:140` `jsonb_typeof(...) = 'null'` | PASS |
| C3307 | `signature_view` the same | same | `tenant_logo.sql:173` `v #>> '{tenant,logoPath}' = ...`; `:174-175` other keys; `:180` null | PASS |
| C3308 | accept png/jpeg at 1 and 1048576, refuse 1048577, 0, svg, gif, webp | `vitest ... -t "C3308:"` ran, passed | `domain/org-settings/logo.test.ts:10` `toEqual({ ok: true, ext: "png" })` at 1048576; `:20` `expect(checkLogoFile({ type, size })).toEqual({ ok: false, error: LOGO_FILE_ERROR })`; `:21` message text | PASS |
| C3309 | `logoPath` accepted when empty or own-org png/jpg, refused for foreign org, no uuid, svg, leading slash, two segments | ran, passed | `logo.test.ts:26-27` `isOwnLogoPath(ORG, ...)).toBe(true)`; `:36` `toBe(false)` over 6 refused forms. The code accepts `<org>/<uuid>Xpng` because the `\.` in a template literal is a bare `.` (`domain/org-settings/logo.ts:32`); no assertion tells a dot from a wildcard (finding 4) | FAIL (shipped code wrong, test cannot see it) |
| C3310 | no upload URL for rule violations, estimator, viewer, no membership | ran, passed | `app/logo-upload.test.ts:27` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:39` `answer.ok).toBe(false)`; `:41` `prepareUpload).not.toHaveBeenCalled()` | PASS |
| C3311 | owner and admin get `<org>/<id>.png|jpg` and the issued URL | ran, passed (2 tests) | `app/logo-upload.test.ts:46` `toEqual({ ok: true, path: ${ORG}/id.png, signedUrl: "https://s/sign/png", contentType: "image/png" })`; `:47` jpg; `:48` calls | PASS |
| C3312 | new valid path stored and previous object deleted; same path deletes nothing | ran, passed (3 tests) | `app/(app)/settings/logo-actions.test.ts:50` `toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))`; `:52` `remove).toHaveBeenCalledWith(OLD)`; `:58` `remove).not.toHaveBeenCalled()`. `remove` is a mock: the claim "deletes the previous object" crosses the Storage boundary and the migration's policies cannot perform it (finding 1) | FAIL (level gap, and the boundary behaviour is broken) |
| C3313 | failed delete: save succeeds, exactly one error line | ran, passed | `logo-actions.test.ts:73` real `supabaseOrgLogo.remove` over a stub that returns an error; `:78` `state.status).toBe("saved")`; `:80` `error).toHaveBeenCalledTimes(1)`. The proof reaches the claim: the real `remove` is the unit that logs, and fault 7 (drop the log) is killed | PASS |
| C3314 | empty `logoPath` stores null, deletes previous | ran, passed | `logo-actions.test.ts:87` `objectContaining({ logoPath: null })`; `:88` `remove).toHaveBeenCalledWith(OLD)` (mock; same boundary gap as C3312) | FAIL (level gap, finding 1) |
| C3315 | bad `logoPath` is a field error, nothing stored or deleted (settings and setup) | ran, passed (3 + 2 tests) | `logo-actions.test.ts:97` `toMatchObject({ status: "invalid", errors: { logoPath: REFUSED } })`; `:98` `saveOrgSettings).not.toHaveBeenCalled()`; `app/setup/logo-actions.test.ts:59-62` the same for setup | PASS |
| C3316 | forbidden or unavailable save does not delete | ran, passed (2 tests) | `logo-actions.test.ts:105` `state.status).toBe(code)`; `:106` `remove).not.toHaveBeenCalled()` | PASS |
| C3317 | Continue stores `logoPath` with the profile | ran, passed (2 tests) | `app/setup/logo-actions.test.ts:46` `rejects.toThrow("NEXT_REDIRECT /pipeline")`; `:47` `saveSetupProfile).toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))` | PASS |
| C3318 | Skip changes no column | ran, passed | `app/setup/logo-actions.test.ts:72` `skipSetup).toHaveBeenCalledWith(ORG)`; `:73` `saveSetupProfile).not.toHaveBeenCalled()`; `:75` `remove).not.toHaveBeenCalled()` | PASS |
| C3319 | browser helper refuses bad files, never calls `prepareLogoUpload` | ran, passed (4 tests) | `components/settings/logo-upload.test.ts:18` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:19` `prepare).not.toHaveBeenCalled()` | PASS |
| C3320 | Storage failure gives "Logo upload failed, try again" and no path | ran, passed (2 tests) | `logo-upload.test.ts:34` `toEqual({ ok: false, error: "Logo upload failed, try again" })`; `:37` `not.toContain(PATH)` | PASS |
| C3321 | field with a pick shows preview, "Logo ready", hidden `logoPath` | `vitest run components/settings/logo-field.test.tsx -t "C3321:"` exit 1, "No test files found": the repo config `include` is `**/*.test.ts` (`web/vitest.config.mts:8`), so a `.test.tsx` is never collected, by this proof or by `npm test` (238 files, none `.tsx`). Under a temporary config that includes `*.test.tsx` the test ran and passed | `components/settings/logo-field.test.tsx:35` `toContain("Logo ready")`; `:36` hidden input `value="${PATH}"` | Unproven (never run by the repo's gate) |
| C3322 | Save and Continue disabled with "Uploading logo" | same: not collected | `logo-field.test.tsx:86` `toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Uploading logo<\/button>/)`; `:95` Continue | Unproven (never run by the repo's gate) |
| C3323 | estimator and viewer: stored logo, no choose or remove | same: not collected | `logo-field.test.tsx:64` `expect(markup).not.toContain(absent)` over Choose/Replace/Remove/file input; `:71` stored URL | Unproven (never run by the repo's gate) |
| C3324 | no logo: "No logo yet" and "PNG or JPEG, up to 1 MB" | same: not collected | `logo-field.test.tsx:48` `toContain("No logo yet")`; `:49` `toContain("PNG or JPEG, up to 1 MB")` | Unproven (never run by the repo's gate) |
| C3325 | draw box inside 160 by 48, aspect kept | `vitest ... -t "C3325:"` ran, passed | `infrastructure/documents/logo.test.ts:14` `logoBox(400,100)).toEqual({ width: 160, height: 40 })`; `:15` tall; `:16` square `{48,48}`; `:17` small `{80,20}`. The function is proven; that the PDF draws at that size is not (fault 12 survives) | PASS |
| C3326 | agreement PDF has an image with a logo, none without, same words | ran, passed | `agreement-pdf.test.ts:271` `toContain("/Subtype /Image")`; `:272` `not.toContain("/Subtype /Image")`; `:276` `expect(words(drawn)).toEqual(words(plain))`. The "same text as before" half compares drawn to plain, not to a pre-feature baseline; the untouched older tests in the file carry that | PASS |
| C3327 | contract PDF the same | ran, passed | `contract-pdf.test.ts:242` `toContain("/Subtype /Image")`; `:243` `not.toContain(...)`; `:247` words equal | PASS |
| C3328 | loader: null and one line on timeout, 404, 500, wrong signature, over 1 MB; bytes and format for png and jpg | ran, passed (7 tests) | `infrastructure/supabase/org-logo.test.ts:32` `toEqual({ bytes: PNG, format: "png" })`; `:33` jpg; `:52-53` `toBeNull()` and `error).toHaveBeenCalledTimes(1)` over 4 failures; `:62-66` fake timers: no log at 2999 ms, `toBeNull()` and one log at 3000 ms. Faults 8 and 9 killed | PASS |
| C3329 | undecodable logo with valid signature: PDF without it, one line, agreement and contract | ran, passed (3 tests) | `infrastructure/documents/logo.test.ts:49` `not.toContain("/Subtype /Image")`; `:50` name still extracted; `:51` `error).toHaveBeenCalledTimes(1)`; `:74-76` the same for the contract; `:88-92` retry path. A corrupt PNG with a valid header is a real decoder miss, so the proof reaches the claim (PNG only; no JPEG case) | PASS |
| C3330 | agreement route loads the org's current logo; 200 when null | ran, passed (2 tests) | `app/(app)/agreements/[agreementId]/pdf/route.test.ts:209` `status).toBe(200)`; `:211` `renderAgreement.mock.calls[0][0].tenant.logo).toEqual(first)`; `:215` second; `:221` no logo key. `tenantLogo` is a mock: the composition function that reads `logo_path` is untested and fault 13 survives | FAIL (wiring of "current logo_path" unproven) |
| C3331 | contract route the same | ran, passed (2 tests) | `app/(app)/contracts/[contractId]/pdf/route.test.ts:188` `contractor.logo).toEqual(first)`; `:192` second; `:197` 200; same mock gap | FAIL (wiring unproven, fault 13) |
| C3332 | portal PDF loads the current logo from the path `portal_view` returns | ran, passed (2 tests) | `app/review/[token]/pdf/route.test.ts:175` `loadLogo).toHaveBeenCalledWith(PATH)`; `:176` `tenant.logo).toEqual(logo)`; `:181` 200; `:182` `toHaveBeenCalledWith(null)`. The route itself calls `logo.load(view.tenant?.logoPath ?? null)`, no composition wrapper in between | PASS |
| C3333 | signing use case loads the logo, still sends when null | ran, passed (2 tests) | `application/use-cases/signing-documents.test.ts:123` `loadLogo).toHaveBeenCalledWith("org-1")`; `:124` `contractor.logo).toEqual(logo)`; `:128` `toEqual({ number: "AG-1052", document: built })`. The loader is injected by hand; the production argument `tenantLogo` is composition and fault 13 survives | FAIL (wiring unproven, fault 13) |
| C3334 | review header `<img>` with src and alt, none without | ran, passed (2 tests) | `components/review/logo.test.ts:14` `toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/...l\.png"/)`; `:15` `toContain('alt="Kettle Ridge Mechanical Ltd."')`; `:17` `not.toContain("<img")`; `:22` rest unchanged. The view is proven; the page passing `logoUrl` is not (faults 15, 16 survive) | PASS (view level; page wiring in Coverage) |
| C3335 | signing header the same | ran, passed (2 tests) | `components/signing/signing.test.ts:152` src regex; `:153` alt; `:155` `html(shown())).not.toContain("<img")`; `:160` rest unchanged | PASS (view level; page wiring in Coverage) |
| C3336 | both readers map `tenant.logoPath`, absent key gives null | ran, passed (2 tests) | `infrastructure/supabase/portal.test.ts:218` `tenant?.logoPath).toBe(path)`; `:220` `toBeNull()`; `infrastructure/supabase/signing.test.ts:179` `toBe(path)`; `:181` `toBeNull()` | PASS |
| C3337 | `logoPublicUrl` shape and null | ran, passed | `domain/org-settings/logo.test.ts:41` `toBe("https://x.supabase.co/storage/v1/object/public/logos/<org>/<id>.png")`; `:43` `toBeNull()` | PASS |
| C3338 | live Playwright at 375, 768, 1440 px | not run | none: needs the migration applied to the hosted project, which has not been done; a Verifier cannot observe it | Unproven (author-run pending) |
| C3339 | live end to end on the hosted project | not run | none: same | Unproven (author-run pending) |

## Coverage

Recomputed from the plan's enumerations (Landing doors 1 to 3, Relations, Surface, Flow, Observable) and from the code, not from the author's table. The grep for every caller of `renderAgreement` and `renderContract` outside tests found exactly four: `app/(app)/agreements/[agreementId]/pdf/route.ts:32`, `app/(app)/contracts/[contractId]/pdf/route.ts:32`, `app/review/[token]/pdf/route.ts:22`, and `application/use-cases/signing.ts:66` (the contract sent for signature, fed by `makeContractDocuments` at `composition/index.ts:274`). There are no other places a PDF is rendered: emails carry no rendered PDF (`application/use-cases/notify.ts:140` attaches the provider's signed and audit PDFs, fetched not rendered) and the n8n workflows render nothing. The set of four is complete.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| accepted image types (2) | plan door 1, `logo.ts:12` | png, jpeg: C3308 `logo.test.ts:9-12`, C3311 `logo-upload.test.ts:46-47` | - |
| refused files (5) and size edges (2) | plan AC 8 | svg, gif, webp, empty, 1048577: C3308 `logo.test.ts:20`; 1048576 accepted `:10` | - |
| roles for writing a logo (4) | plan AC 1, 2 | owner, admin insert: C3300 `tenant_logo.sql:40`; estimator, viewer: C3301 insert `:53`, C3310 | owner or admin deleting their own object is asserted nowhere; an SQL probe (a temporary owner-delete assertion in the rolled-back recipe) removed 0 rows |
| Storage callers refused (4) | plan AC 2 | estimator, viewer, other-org owner, anon: insert C3301 `:53`, `:60` | the delete refusal: it passes with the delete policy replaced by `using (false and ...)` (fault 4), because with no select policy nobody can delete |
| `logo_path` forms (6) | plan AC 5, `migration:25-27` | null, png, jpg, foreign org, no uuid or svg, no slash: C3304 `tenant_logo.sql:96-108` | - |
| `logoPath` form values (8) | plan AC 15, `logo.ts:31` | empty, png, jpg: C3309 `logo.test.ts:25-27`; foreign org, missing uuid, svg, leading slash, two segments `:36` | a name that differs from `.png` in the dot position, which the shipped code accepts (`logo.ts:32`) |
| `prepareLogoUpload` outcomes (3) | `app/logo-upload.ts:16-25` | ok C3311; rule error, permission error C3310 | - |
| save outcomes with a logo (4) | plan Flow 2, 3 | saved C3312, C3317; removal C3314; field error C3315; forbidden or unavailable C3316 | the old object actually leaving Storage on replace or remove (finding 1) |
| places a PDF is rendered (4) | grep above | agreement route C3330; contract route C3331; portal route C3332; signing use case C3333 | the composition wrapper `tenantLogo` (`composition/index.ts:134-142`: stored path then bytes, never throws) is exercised by no test; fault 13 survives. Its failure branch (reading `logo_path` throws, PDF still renders) is also untested |
| customer-facing surfaces showing the logo (4) | plan AC 16, 17 | agreement PDF C3326, contract PDF C3327, review page C3334, signing page C3335 | the PDF draw size (AC 16: at most 48 by 160 pt) is not asserted end to end (fault 12 survives); the review and sign pages passing `logoUrl` into the view (faults 15, 16 survive) |
| logo formats drawn in a PDF (2) | door 2 `format` png or jpg | png: C3326, C3327 | jpg is never drawn into a PDF in any test |
| SQL reads returning `logoPath` (2) | door 3 | `portal_view` C3306 `:132`; `signature_view` C3307 `:173` | - |
| loader failure modes (5) | plan AC 19 | timeout `org-logo.test.ts:62-66`; 404, 500, wrong signature, over 1048576 bytes `:52-53` | - |
| route statuses with a logo (2 PDF routes, portal route, 2 pages) | plan Surface | `200`: C3330 `route.test.ts:209`, C3331 `:197`, C3332 `:181`; pages `200` is the existing page tests | - |
| startup config: `NEXT_PUBLIC_SUPABASE_URL` read for the public logo URL (2 assemblies, read directly) | `composition/index.ts:98` and `:135` (`baseUrl: url`); `components/settings/logo-field.tsx:131` (`process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""`) | client field: asserted by `logo-field.test.tsx:71` under `vi.stubEnv` (not collected by the gate, see C3321-C3324); the checks.md row cites C3334, C3335 and C3328, but those take `logoUrl` as a prop or `baseUrl` as an option and never touch an assembly | composition assembly: nothing boots it with a logo, and `baseUrl: ""` there (fault 14) fails no test |
| Storage's own refusal of oversize and non-image uploads (AC 3) and the anonymous public read (AC 6) | plan door 1 | bucket configuration only: C3302, C3305 | the refusal and the cookie-less `200` are observable only live (C3339, pending) |
| review page broken image hides itself (Observable, AC 18) | `components/ui/tenant-logo.tsx` `onError` | none | no check and no test; live only |
| a save that leaves `logoPath` out does not touch the column (door 3) | plan Landing 3 | `logo-actions.test.ts:111-113` (no C id; fault 11 is killed only by this test) | no check carries it, so it is unprotected by the approved set |

## Test policy rows

checks.md has a `## Test policy` heading with the text "Omitted", which asserts that the repo's conventions already answer where proofs go. That does not hold here, so the omission is wrong, and it is the reason several findings were not caught while building. The conventions the author cites (`AGENTS..md` and the first-login-setup and billing-page analogues) cover domain decisions and route boundaries. They do not answer: (a) a new public Storage bucket whose RLS behaviour must be proven across the real Storage path, not by a mock of `remove` (the missing-select-policy defect); (b) a client component test written as `.test.tsx` in a repo whose runner collects only `.test.ts`; (c) composition-root wiring, where the repo's pattern is to mock the container, so a wrong wire never fails. With no rows, nothing was priced for these, and the checks were written to the weaker ruler. No row exists to meet or miss.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| (none: section omitted) | `supabase/migrations/20261111100000_tenant_logo.sql`, `components/settings/logo-field.tsx`, `composition/index.ts`, `app/*/page.tsx` | a boundary proof for the Storage policies, a collected test for the client field, a wiring proof for composition and pages | gap: omission not justified, see above |

## Faults injected

Each fault was applied to the working tree, the one relevant proof run, and the file restored with `git checkout -- <file>`. Cap exceeded on purpose: the brief named these surfaces and each forces a different proof.

| Mutation | Location | Killed |
| --- | --- | --- |
| bucket `file_size_limit` 1048576 to 10485760 | `supabase/migrations/20261111100000_tenant_logo.sql:7` | yes - `C3302 size: limit 10485760` |
| insert policy role list gains `estimator` | `supabase/migrations/20261111100000_tenant_logo.sql:15` | yes - `C3301 insert uE: expected SQLSTATE 42501, statement succeeded` |
| `portal_view` stops returning `logoPath` | `supabase/migrations/20261111100000_tenant_logo.sql:61` | yes - `C3306 path: logoPath null` |
| delete policy replaced by `using (false and ...)` | `supabase/migrations/20261111100000_tenant_logo.sql:19` | no - survived: `PASS tenant_logo` |
| `isOwnLogoPath` org check dropped (any uuid prefix) | `web/domain/org-settings/logo.ts:32` | yes - C3309 `...000002/...png: expected true to be false` |
| `isOwnLogoPath` as shipped: `\.` is a bare dot, so `<org>/<uuid>Xpng` is accepted | `web/domain/org-settings/logo.ts:32` | no - survived: no refused form in `logo.test.ts:28-35` differs only at the dot (checked with node: the regex accepts it) |
| old-object delete removed | `web/app/(app)/settings/actions.ts:51` | yes - C3312 `expected "vi.fn()" to be called 1 times, but got 0` |
| `remove()` stops logging its failure | `web/infrastructure/supabase/org-logo.ts:52` | yes - C3313 `expected "error" to be called 1 times, but got 0` |
| `load` no longer checks `response.ok` (a 404 body is used) | `web/infrastructure/supabase/org-logo.ts:65` | yes - C3328 404 and 500 tests fail |
| 3 s abort timer removed; and default 3000 changed to 4000 | `web/infrastructure/supabase/org-logo.ts:22,62` | yes - C3328 timeout test fails in both |
| `withLogo` ignores the logo | `web/domain/org-settings/logo.ts:49` | yes - C3330, C3331, C3332, C3333 fail |
| settings action writes `logoPath` when the form has none | `web/app/(app)/settings/actions.ts:35` | yes - but only the test at `logo-actions.test.ts:109`, which carries no check id |
| PDF draws the logo at natural size, `logoBox` bypassed | `web/infrastructure/documents/pdf-sections.tsx:53` | no - survived: C3325, C3326, C3327, C3329 all pass |
| composition `tenantLogo` ignores the stored path (`logo.load(null)`) | `web/composition/index.ts:139` | no - survived: all 21 composition, route and use-case files pass |
| composition builds the loader with `baseUrl: ""` | `web/composition/index.ts:135` | no - survived: composition, review page and sign page tests pass |
| review page stops passing `logoUrl` to the view | `web/app/review/[token]/page.tsx:19` | no - survived: page and view tests pass |
| sign page stops passing `logoUrl` to the view | `web/app/sign/[token]/page.tsx:10` | no - survived: page and view tests pass |

## Findings

Ranked. Each fails the feature on its own.

1. The previous logo is never deleted from Storage, and nothing proves otherwise. The migration gives `logos` an insert and a delete policy but no select policy (`migration:11-22`, C3305 asserts that on purpose). A delete needs select visibility of the row, so under RLS it matches nothing. Probe: a temporary assertion in the rolled-back `tenant_logo` recipe (insert as owner, then `delete ... where name = <that key>`) reported `rows deleted: 0`. `OrgLogo.remove` calls Storage with the member's session (`infrastructure/supabase/org-logo.ts:51`), so AC 10 and 11 (replace and Remove delete the object) would silently leave every old file behind, and Storage returns no error, so nothing is even logged. C3301's delete half (`tenant_logo.sql:56`) passes because every delete is 0 rows (fault 4). C3312 and C3314 only assert a mock `remove` was called (`logo-actions.test.ts:52,88`). Fix needs a select policy for owners and admins (or a service-role delete) and a positive delete assertion in the recipe.
2. C3321 to C3324 are never run. `web/vitest.config.mts:8` includes only `**/*.test.ts`; `components/settings/logo-field.test.tsx` is the only `.test.tsx` in the repo, so `npm test` skips it and each check's own proof command exits 1 with "No test files found". Passing under an override config does not count as the gate. Either rename the file to `.test.ts` (it uses `createElement`, so it can be) or widen `include`.
3. The wiring from stored `logo_path` to a PDF and from a stored path to the customer pages is mocked everywhere. `composition/index.ts:134-142` (`tenantLogo`) and `:135` (`baseUrl: url`), and the `logoUrl={logo.url(...)}` props at `app/review/[token]/page.tsx:19` and `app/sign/[token]/page.tsx:10`, can each be broken without failing a test (faults 13 to 16). C3330, C3331 and C3333 claim the org's current `logo_path` and fail on that. The Coverage startup-config row cites proofs (C3334, C3335, C3328) that never touch an assembly.
4. `isOwnLogoPath` accepts a key whose dot is any character (`web/domain/org-settings/logo.ts:32`: the `\.` in a template literal is a plain `.`); verified, `<org>/<uuid>Xpng` returns true. The database check (`migration:27`, written in a plain SQL string) refuses it with 23514, so the user would meet a failed save instead of the field error. C3309's refused list has no such member.
5. AC 16's size ("at most 48 high and 160 wide") is proven only for `logoBox` in isolation (C3325), not for what the PDF draws (fault 12). Only PNG is ever drawn into a PDF; no test draws a JPEG.
6. Checks that name files that do not exist: C3333 (`application/use-cases/signing.test.ts`), C3334 (`components/review/review-view.test.tsx`), C3335 (`components/signing/signing-view.test.tsx`). `-t "C3333:"` on `signing.test.ts` matches nothing. The real tests are elsewhere and passed, but the approved proof line cannot be run as written (precision gap in the checks).
7. The `Test policy` omission is not justified (see section above).
8. C3338 and C3339 are not provable here; they stay author-run pending the owner's go-ahead on the migration, and the plan's open question 1 blocks go-live. Storage's size and type refusal (AC 3), the cookie-less public read (AC 6) and the review page's broken-image hiding have no proof at any other level.

Edits to existing tests were judged and are legitimate consequences of the feature, not weakened assertions: the `composition/*.test.ts` containers and `app/*/page.test.ts` doubles gain `tenantLogo` or `logo` members that the changed routes and pages now destructure (additive); `scripts/test-db/runner.test.ts` counts move 31 to 32 and 33 to 34 for exactly one new recipe and one new SQL file, with every assertion otherwise identical; `infrastructure/supabase/signing.test.ts` C1702's expected tenant gains `logoPath: null`, which the reader now always emits (an added key, no existing key loosened). The two billing test files (`components/billing/billing-view.test.ts`, `app/(app)/settings/billing/page.test.ts`) fail on a missing package `@stripe/react-stripe-js`, unrelated to this diff and not touched by it.

## Gate

`cd web && npx vitest run` (whole suite, `.test.ts` only) - 236 files passed, 2 failed (the two billing files above, missing package), 4237 tests passed, 0 failed.
`cd web && npx vitest run <17 files> -t "C33[0-3][0-9]:"` - 17 files passed, 61 tests passed, 0 failed; `logo-field.test.tsx` not collected (7 tests passed only under a temporary override config, which was deleted).
`cd web && npm run test:db tenant_logo` - 1 passed, 0 failed (rolled back; no commit, hosted database otherwise untouched).
