# Tenant logo verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: f3cea51..c03ede9 (HEAD)
**Round**: 2 - full (every check re-proven at c03ede9; nothing carried forward)
**Verifier**: independent sub-agent (author != verifier)

Verified at c03ede9. All 40 checks accounted for: 34 PASS, 4 FAIL (C3314, C3330, C3331, C3333), 2 Unproven (C3338, C3339: live passes, author-run pending, the migration is not applied and this Verifier did not apply it). Of round 1's 7 surviving faults, 6 are now killed and 1 survives in a narrower form; one new surviving fault (JPEG never drawn) is added.

## Binding sources

Step 1 did not run: the profile is `standard` and the step is `ui`-only.

## Round 1 survivors and FAILs, re-run

| Round 1 item | Now | How shown |
| --- | --- | --- |
| fault 4: delete policy `using (false and ...)` survived | killed | F1 below: `FAIL tenant_logo: C3312 delete uA: rows deleted: 0`. A positive owner and admin delete assertion exists now (`supabase/tests/tenant_logo.sql:152`) and the select policy (`migration:19-23`) exists; the owner delete removes 1 row |
| fault 6: `\.` a bare dot in `isOwnLogoPath` survived | killed | F3: the regex re-broken to `\.`, C3309 fails on `...Xpng: expected true to be false`; the refused list now holds `${ORG}/${ID}Xpng` (`logo.test.ts:35`) and `-jpg` (`:36`); shipped code is `\\.` (`logo.ts:32`) |
| fault 12: PDF draws at natural size survived | killed | F6: `logoBox` bypassed, `logo.test.ts:112` C3326 fails on `/\b160 0 0 -48 0 48 cm\n\/I1 Do/` |
| fault 13: composition `tenantLogo` ignores the stored path survived | split: the read-then-load logic now killed (F10); the composition line that wires it SURVIVES (F4) | F10: `logo.load(null)` fails `tenant-logo.test.ts` (C3330). F4: `const tenantLogo = async () => null` at `composition/index.ts:137` passes 51 files, 587 tests |
| fault 14: `baseUrl: ""` survived | killed | F9: `composition/logo-wiring.test.ts:81` `toHaveBeenCalledWith({ baseUrl: "https://example.supabase.co" })` fails |
| fault 15: review page drops `logoUrl` survived | killed | F7: `app/review/[token]/page.test.ts:317` fails |
| fault 16: sign page drops `logoUrl` survived | killed | F8: `app/sign/[token]/page.test.ts:55` fails (`expected null to be 'org/logo.png'`) |
| FAIL C3301 (delete half vacuous) | PASS | F1 and F2 kill; see row |
| FAIL C3309 (dot) | PASS | F3 |
| FAIL C3312 (level gap, delete broken) | PASS | SQL `:152` removes 1 row under the real policies, for owner and admin |
| FAIL C3314 | still FAIL | the new second proof names assertions labelled `C3314` that exist nowhere in `supabase/tests/tenant_logo.sql` (see row) |
| FAIL C3330, C3331, C3333 (wiring) | still FAIL | the composition seam survives F4 |
| Unproven C3321-C3324 | PASS | `vitest.config.mts:8` now `**/*.test.{ts,tsx}`; the four proof commands run, 2+2+2+1 tests, each named test listed; config reverted to `.test.ts` makes the proof exit 1 `No test files found` (F11) |
| proofs naming missing files (C3333, C3334, C3335) | resolved | checks.md now names `signing-documents.test.ts`, `components/review/logo.test.ts`, `components/signing/signing.test.ts` plus `app/review/[token]/page.test.ts`, `app/sign/[token]/page.test.ts`; every proof command below ran as written |
| Test policy omission unjustified | partly addressed, still unjustified in writing | see Test policy rows |
| C3338, C3339 | still Unproven (author-run pending) | migration not applied |

## Checks

Proofs run from `web/`. Every one of the 38 `cd web && ...` commands in checks.md was run exactly as written (extracted from the Proof lines, run one by one): all 38 exit 0, none "No test files found", none a filter matching nothing (each printed `N passed | M skipped`, N >= 1). SQL: `npm run test:db tenant_logo` printed `PASS tenant_logo`, `1 passed, 0 failed` (rolled back; the hosted database was not written). A verbose run with `-t "C33[0-3][0-9]:"` listed every named test individually: C3308 1, C3309 1, C3310 8, C3311 2, C3312 3, C3313 1, C3314 1, C3315 5, C3316 2, C3317 2, C3318 1, C3319 4, C3320 2, C3321 2, C3322 2, C3323 2, C3324 1, C3325 1, C3326 2, C3327 1, C3328 8, C3329 3, C3330 3, C3331 2, C3332 2, C3333 2, C3334 3, C3335 3, C3336 2, C3337 1 (73 tests passed). Every C33xx label in the SQL recipe was checked by grep: C3300 to C3307 and C3312 exist; **`C3314` appears only in comments (`tenant_logo.sql:5`, `:142`), never as an assertion label**.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3300 | owner and admin insert png and jpg under own org | `npm run test:db tenant_logo` exit 0 | `supabase/tests/tenant_logo.sql:41` `perform tests.ok('C3300 four objects', (select count(*) ... name like orgA/%) = 4, ...)` | PASS |
| C3301 | estimator, viewer, other-org owner, anon get 42501 on insert; delete removes no row | same | `tenant_logo.sql:54` `expect_error('C3301 insert ' || v_user, ..., '42501')`; `:61` anon the same; `:57` `v_n = 0`; `:64` anon `v_n = 0`; `:66` object kept. A delete by a caller the select policy hides is 0 rows, which is the claimed outcome; the delete policy itself is killed by F1 | PASS |
| C3302 | bucket limit 1048576, mime types exactly png and jpeg | same | `tenant_logo.sql:75` `b.file_size_limit = 1048576`; `:76` `array_agg(t order by t) = array['image/jpeg','image/png']` | PASS |
| C3303 | non-uuid first segment or foreign org gives 42501 not 22P02 | same | `tenant_logo.sql:84` `expect_error('C3303 not a uuid', ..., '42501')`; `:85` empty segment; `:86` other org `'42501'` | PASS |
| C3304 | `logo_path` shape, 23514 on bad forms | same | `tenant_logo.sql:107` `expect_error('C3304 ' || v_bad, ..., '23514')` over the 5 bad forms `:101-105`; `:97-99` null, png, jpg accepted; `:109` row kept | PASS |
| C3305 | bucket public; no select policy applies to anon, estimator, viewer, other org's owner; API lists nothing to them | same | `tenant_logo.sql:116` `(select public from storage.buckets ...) is true`; `:117-119` `not exists (select 1 from pg_policies ... cmd in ('SELECT','ALL') ... and not (roles = array['authenticated']::name[]))`; `:129` `count(*) ... = 0` for uE, uV, uB; `:133` anon `= 0`; `:137` owner and admin `>= 4`. F2 killed. The live cookie-less public read is C3339 | PASS |
| C3306 | `portal_view` returns `tenant.logoPath`, null when none, other keys kept | same | `tenant_logo.sql:169` `v #>> '{tenant,logoPath}' = tests.lg_key(...)`; `:170-172` other keys; `:177` `jsonb_typeof(...) = 'null'` | PASS |
| C3307 | `signature_view` the same | same | `tenant_logo.sql:210` `v #>> '{tenant,logoPath}' = ...`; `:211-212` other keys; `:217` null | PASS |
| C3308 | accept png/jpeg at 1 and 1048576, refuse 1048577, 0, svg, gif, webp | `vitest ... logo.test.ts -t "C3308:"` 1 passed | `domain/org-settings/logo.test.ts:10` `toEqual({ ok: true, ext: "png" })` at 1048576; `:20` `expect(checkLogoFile({ type, size })).toEqual({ ok: false, error: LOGO_FILE_ERROR })` over `:14-18`; `:21` message | PASS |
| C3309 | `logoPath` accepted when empty or own-org png/jpg, refused for foreign org, no uuid, svg, leading slash, two segments | `-t "C3309:"` 1 passed | `logo.test.ts:25-27` `isOwnLogoPath(ORG, ...)).toBe(true)`; `:38` `expect(isOwnLogoPath(ORG, path), path).toBe(false)` over `:29-36` including `${ORG}/${ID}Xpng`. F3 killed | PASS |
| C3310 | no upload URL for rule violations, estimator, viewer, no membership | `app/logo-upload.test.ts -t "C3310:"` 8 passed | `app/logo-upload.test.ts:27` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:39` `answer.ok).toBe(false)`; `:41` `prepareUpload).not.toHaveBeenCalled()` | PASS |
| C3311 | owner and admin get `<org>/<id>.png|jpg` and the issued URL | `-t "C3311:"` 2 passed | `app/logo-upload.test.ts:46` `toEqual({ ok: true, path: ${ORG}/id.png, signedUrl: "https://s/sign/png", contentType: "image/png" })`; `:47` jpg; `:48` `prepareUpload.mock.calls).toEqual([[ORG, "png"], [ORG, "jpg"]])` | PASS |
| C3312 | new valid path stored and previous object deleted; same path deletes nothing | `settings/logo-actions.test.ts -t "C3312:"` 3 passed; SQL exit 0 | `app/(app)/settings/logo-actions.test.ts:50` `toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))`; `:52` `remove).toHaveBeenCalledWith(OLD)`; `:58` `remove).not.toHaveBeenCalled()`; boundary: `supabase/tests/tenant_logo.sql:152` `tests.ok('C3312 delete ' || v_user, v_n = 1, ...)` for owner and admin under the real policies. F1 killed | PASS |
| C3313 | failed delete: save succeeds, exactly one error line | `-t "C3313:"` 1 passed | `logo-actions.test.ts:78` `expect(state.status).toBe("saved")`; `:79` the real `supabaseOrgLogo.remove` was asked for `[[[OLD]]]` over a failing stub; `:80` `expect(error).toHaveBeenCalledTimes(1)` | PASS |
| C3314 | empty `logoPath` stores null and deletes previous | `-t "C3314:"` 1 passed; SQL proof `assertions labelled C3314` | `logo-actions.test.ts:87` `objectContaining({ logoPath: null })`; `:88` `remove).toHaveBeenCalledWith(OLD)` (mock). The second proof line names assertions labelled `C3314`; `grep -n C3314 supabase/tests/tenant_logo.sql` hits only comments (`:5`, `:142`); the real delete is asserted under the label `C3312` (`:152`). A proof name that exists nowhere | FAIL (proof names a label that is not in the recipe) |
| C3315 | bad `logoPath` is a field error, nothing stored or deleted (settings and setup) | both commands, 3 + 2 passed | `logo-actions.test.ts:97` `toMatchObject({ status: "invalid", errors: { logoPath: REFUSED } })`; `:98` `saveOrgSettings).not.toHaveBeenCalled()`; `app/setup/logo-actions.test.ts:59-61` the same for setup | PASS |
| C3316 | forbidden or unavailable save does not delete | `-t "C3316:"` 2 passed | `logo-actions.test.ts:105` `state.status).toBe(code)`; `:106` `remove).not.toHaveBeenCalled()` | PASS |
| C3317 | Continue stores `logoPath` with the profile | `setup/logo-actions.test.ts -t "C3317:"` 2 passed | `app/setup/logo-actions.test.ts:46` `rejects.toThrow("NEXT_REDIRECT /pipeline")`; `:47` `saveSetupProfile).toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))` | PASS |
| C3318 | Skip changes no column | `-t "C3318:"` 1 passed | `app/setup/logo-actions.test.ts:72` `skipSetup).toHaveBeenCalledWith(ORG)`; `:73` `saveSetupProfile).not.toHaveBeenCalled()`; `:75` `remove).not.toHaveBeenCalled()` | PASS |
| C3319 | browser helper refuses bad files, never calls `prepareLogoUpload` | `components/settings/logo-upload.test.ts -t "C3319:"` 4 passed | `logo-upload.test.ts:18` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:19` `prepare).not.toHaveBeenCalled()` | PASS |
| C3320 | Storage failure gives "Logo upload failed, try again" and no path | `-t "C3320:"` 2 passed | `logo-upload.test.ts:34` `toEqual({ ok: false, error: "Logo upload failed, try again" })`; `:37` `JSON.stringify([refused, thrown])).not.toContain(PATH)` | PASS |
| C3321 | field with a pick shows preview, "Logo ready", hidden `logoPath` | `components/settings/logo-field.test.tsx -t "C3321:"` 2 passed (collected now) | `logo-field.test.tsx:35` `toContain("Logo ready")`; `:36` `toMatch(<input ... type="hidden" ... name="logoPath" ... value="${PATH}")`; `:41` stored path when no pick | PASS |
| C3322 | Save and Continue disabled with "Uploading logo" | `-t "C3322:"` 2 passed | `logo-field.test.tsx:86` `toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Uploading logo<\/button>/)`; `:95` Continue the same | PASS |
| C3323 | estimator and viewer: stored logo, no choose or remove | `-t "C3323:"` 2 passed | `logo-field.test.tsx:64` `expect(markup).not.toContain(absent)` over Choose, Replace, Remove, `type="file"`, `name="logoPath"`; `:71` `toContain(${BASE}/storage/v1/object/public/logos/${PATH})` | PASS |
| C3324 | no logo: "No logo yet" and "PNG or JPEG, up to 1 MB" | `-t "C3324:"` 1 passed | `logo-field.test.tsx:48` `toContain("No logo yet")`; `:49` `toContain("PNG or JPEG, up to 1 MB")` | PASS |
| C3325 | draw box inside 160 by 48, aspect kept | `infrastructure/documents/logo.test.ts -t "C3325:"` 1 passed | `logo.test.ts:15` `logoBox(400,100)).toEqual({ width: 160, height: 40 })`; `:16` `{12,48}`; `:17` `{48,48}`; `:18` `{80,20}`. The PDF draws at that size: `:112` C3326 `toMatch(/\b160 0 0 -48 0 48 cm\n\/I1 Do/)`, killed under F6 | PASS |
| C3326 | agreement PDF has an image with a logo, none without, same words | agreement-pdf and logo.test.ts `-t "C3326:"` 1 + 1 passed | `agreement-pdf.test.ts:271` `toContain("/Subtype /Image")`; `:272` `not.toContain("/Subtype /Image")`; `:275` `expect(words(drawn)).toEqual(words(plain))`; `logo.test.ts:114` and `:116` draw size. Only PNG is ever drawn (Coverage) | PASS |
| C3327 | contract PDF the same | `contract-pdf.test.ts -t "C3327:"` 1 passed | `contract-pdf.test.ts:242` `toContain("/Subtype /Image")`; `:243` `not.toContain(...)`; `:246` words equal | PASS |
| C3328 | loader: null and one line on timeout, 404, 500, wrong signature, over 1 MB; bytes and format for png and jpg; wiring | `org-logo.test.ts` 7 passed; `composition/logo-wiring.test.ts` 1 passed | `infrastructure/supabase/org-logo.test.ts:32` `toEqual({ bytes: PNG, format: "png" })`; `:33` jpg; `:52-53` `toBeNull()` and `error).toHaveBeenCalledTimes(1)` over 4 failures; `:63` `error).not.toHaveBeenCalled()` before 3 s, `:65-66` `toBeNull()` and one line; `composition/logo-wiring.test.ts:81` `toHaveBeenCalledWith({ baseUrl: "https://example.supabase.co" })` | PASS |
| C3329 | undecodable logo with valid signature: PDF without it, one line, agreement and contract | `logo.test.ts -t "C3329:"` 3 passed | `infrastructure/documents/logo.test.ts:50` `not.toContain("/Subtype /Image")`; `:51` name still extracted; `:52` `error).toHaveBeenCalledTimes(1)`; `:75-77` contract; `:89-93` retry path. PNG only (no JPEG case) | PASS |
| C3330 | agreement route loads the org's current logo; 200 when null | route `-t "C3330:"` 2 passed; `tenant-logo.test.ts -t "C3330:"` 1 passed | `app/(app)/agreements/[agreementId]/pdf/route.test.ts:209` `status).toBe(200)`; `:210` `tenantLogo).toHaveBeenCalledWith(ORG)`; `:215` second path; `application/use-cases/tenant-logo.test.ts:34` `(await tenantLogo(ORG))?.bytes).toEqual(...PATH)`, `:39` `load).toHaveBeenLastCalledWith(replaced)`. The route test takes `tenantLogo` from a mock container and `logo-wiring.test.ts:82-83` asserts only `toBeDefined()` and `typeof container.tenantLogo).toBe("function")`: F4, the production line `makeTenantLogo(logo)` (`composition/index.ts:137`) replaced by a function that answers null, passes 51 files | FAIL (composition wiring unproven, F4) |
| C3331 | contract route the same | route `-t "C3331:"` 2 passed | `app/(app)/contracts/[contractId]/pdf/route.test.ts:187` `tenantLogo).toHaveBeenCalledWith(ORG)`; `:188` `contractor.logo).toEqual(first)`; `:197` 200; same seam | FAIL (F4) |
| C3332 | portal PDF loads the current logo from the path `portal_view` returns | route `-t "C3332:"` 2 passed | `app/review/[token]/pdf/route.test.ts:175` `loadLogo).toHaveBeenCalledWith(PATH)`; `:176` `tenant.logo).toEqual(logo)`; `:181` 200; `:182` `toHaveBeenCalledWith(null)`. The route calls `logo.load` from the container's `logo`, whose assembly is killed by F9 | PASS |
| C3333 | signing use case loads the logo, still sends when null | `signing-documents.test.ts -t "C3333:"` 2 passed; `tenant-logo.test.ts -t "C3330:"` | `application/use-cases/signing-documents.test.ts:122` `loadLogo).toHaveBeenCalledWith("org-1")`; `:123` `contractor.logo).toEqual(logo)`; `:128` `toEqual({ number: "AG-1052", document: built })`. Production argument is `tenantLogo` from `composition/index.ts:267`, the same F4 seam | FAIL (F4) |
| C3334 | review header `<img>` with src and alt, none without; page passes `logoUrl` | `components/review/logo.test.ts` 2 passed; `app/review/[token]/page.test.ts` 1 passed | `components/review/logo.test.ts:14` `toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/...\/o\/l\.png"/)`; `:15` `toContain('alt="Kettle Ridge Mechanical Ltd."')`; `:17` `not.toContain("<img")`; `app/review/[token]/page.test.ts:317` `toMatch(/<img[^>]*src="org\/logo\.png"/)`, `:319` `not.toContain("<img")`. F7 killed | PASS |
| C3335 | signing header the same | `signing.test.ts` 2 passed; `app/sign/[token]/page.test.ts` 1 passed | `components/signing/signing.test.ts:151` src regex; `:152` alt; `:154` `not.toContain("<img")`; `app/sign/[token]/page.test.ts:55` `props.logoUrl).toBe("org/logo.png")`, `:57` and `:59` `toBeNull()`. F8 killed | PASS |
| C3336 | both readers map `tenant.logoPath`, absent key gives null | `portal.test.ts` and `signing.test.ts -t "C3336:"` 1 + 1 passed | `infrastructure/supabase/portal.test.ts:218` `tenant?.logoPath).toBe(path)`; `:220` `toBeNull()`; `infrastructure/supabase/signing.test.ts:179` `toBe(path)`; `:181` `toBeNull()` | PASS |
| C3337 | `logoPublicUrl` shape and null | `logo.test.ts -t "C3337:"` 1 passed | `domain/org-settings/logo.test.ts:43` `toBe("https://x.supabase.co/storage/v1/object/public/logos/<org>/<id>.png")`; `:45` `toBeNull()` | PASS |
| C3338 | live Playwright at 375, 768, 1440 px | not run | none: needs the migration applied to the hosted project, which has not been done and was not done here | Unproven (author-run pending) |
| C3339 | live end to end on the hosted project | not run | none: same | Unproven (author-run pending) |

## Coverage

Recomputed from the plan's Landing doors 1 to 4, Relations, Surface, Flow, Observable and Criteria, and from the code, not from checks.md's table. Callers of `renderAgreement` and `renderContract` outside tests: `app/(app)/agreements/[agreementId]/pdf/route.ts:32`, `app/(app)/contracts/[contractId]/pdf/route.ts:32`, `app/review/[token]/pdf/route.ts:22` and `application/use-cases/signing.ts:66` (fed by `makeContractDocuments(..., tenantLogo)` at `composition/index.ts:267`). The set of four is complete.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| accepted image types (2) | plan door 1, `logo.ts:12` | png, jpeg: C3308 `logo.test.ts:9-12`, C3311 `logo-upload.test.ts:46-47` | - |
| refused files (5) and size edges (2) | plan AC 8 | svg, gif, webp, empty, 1048577: C3308 `logo.test.ts:20` over `:14-18`; 1048576 accepted `:10` | - |
| roles for writing a logo (4) | plan AC 1, 2 | owner, admin: C3300 `tenant_logo.sql:41`; estimator, viewer: C3301 `:54`, C3310 `logo-upload.test.ts:39` | - |
| Storage callers refused (4) | plan AC 2 | estimator, viewer, other-org owner, anon: insert `tenant_logo.sql:54`, `:61`; delete 0 rows `:57`, `:64` | - |
| bucket select and delete (door 4: owner, admin yes; estimator, viewer, other-org owner, anon no) (6) | plan door 4, `migration:19-29` | owner, admin delete 1 row C3312 `tenant_logo.sql:152`; owner, admin select `:137`; estimator, viewer, other-org owner select 0 `:129`; anon `:133`; policy roles `:117-119`. F1 and F2 killed | - |
| `logo_path` forms (6) | plan AC 5, `migration:34` | null, png, jpg `tenant_logo.sql:97-99`; foreign org, no uuid, svg, no slash and leading slash `:101-105`, `:107` | - |
| `logoPath` form values (8 plus the dot) | plan AC 15, `logo.ts:32` | empty, png, jpg `logo.test.ts:25-27`; foreign org, missing uuid, svg, leading slash, two segments, non-dot separators `:29-36`, `:38` | - |
| `prepareLogoUpload` outcomes (3) | `app/logo-upload.ts:16-25` | ok C3311; rule error, permission error C3310 | - |
| save outcomes with a logo (4) | plan Flow 2, 3 | saved C3312, C3317; removal C3314; field error C3315; forbidden or unavailable C3316 | - |
| places a PDF is rendered (4) | grep above | agreement route C3330; contract route C3331; portal route C3332; signing use case C3333 | the production wiring of `tenantLogo` at `composition/index.ts:137`: `logo-wiring.test.ts:83` asserts only `typeof ... === "function"` (F4 survives). Its failure branch (read throws, PDF still renders) is proven inside `tenant-logo.test.ts:48-52` |
| customer-facing surfaces showing the logo (4) | plan AC 16, 17 | agreement PDF C3326 `agreement-pdf.test.ts:271`; contract PDF C3327 `:242`; review page C3334 `page.test.ts:317`; signing page C3335 `page.test.ts:55` | - |
| logo formats drawn in a PDF (2) | door 2 `format` png or jpg; AC 1 allows both | png: C3326, C3327, `logo.test.ts:114` | jpg: no test draws a JPEG into a PDF. `jpegHeaderBytes` (`logo.testing.ts:38`) is a header stub that "enough to read its size, not to decode it", so only `logoSize` for jpg is proven (`logo.test.ts:24`). F5 (`format: "png"` hard-coded at `pdf-sections.tsx:53`) survives |
| SQL reads returning `logoPath` (2) | door 3 | `portal_view` C3306 `tenant_logo.sql:169`; `signature_view` C3307 `:210` | - |
| loader failure modes (5) | plan AC 19 | timeout `org-logo.test.ts:63-66`; 404, 500, wrong signature, over 1048576 bytes `:52-53` | - |
| route statuses with a logo (2 PDF routes, portal route, 2 pages) | plan Surface | `200`: C3330 `route.test.ts:209`, C3331 `:186`, C3332 `:174`; pages: the existing page tests | - |
| startup config: `NEXT_PUBLIC_SUPABASE_URL` for the public logo URL (2 assemblies, read directly) | `composition/index.ts:99` and `:136` (`baseUrl: url`); `components/settings/logo-field.tsx:131` (`process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""`) | composition: `logo-wiring.test.ts:81` boots `getContainer` and asserts the option (F9 killed); client field `logo-field.test.tsx:71` under `vi.stubEnv` (`:25`) | - |
| Storage's own refusal of oversize and non-image uploads (AC 3) and the anonymous public read (AC 6) | plan door 1 | bucket configuration: C3302 `tenant_logo.sql:75-76`, C3305 `:116` | the refusal and the cookie-less `200` are observable only live (C3339, pending) |
| review page broken image hides itself (Observable, AC 18) | `components/ui/tenant-logo.tsx` `onError` | none | no check and no test; live only (C3339 names it, pending) |
| a save that leaves `logoPath` out does not touch the column (door 3) | plan Landing 3 | `logo-actions.test.ts:111` `not.toHaveProperty("logoPath")` (no check id) | no check carries it; protected only by an unlabelled test |

## Test policy rows

checks.md still has `## Test policy` reading "Omitted", justified by "`AGENTS..md` and the closest analogues ... prove decisions in domain files ... and the boundary at a route test". Round 1 judged that unjustified because three questions were not answered by the conventions: (a) a public Storage bucket whose behaviour must be proven across the real policy path; (b) a `.test.tsx` the runner did not collect; (c) composition-root wiring, where the repo mocks the container so a wrong wire never fails. Re-judged at c03ede9: (a) is answered in practice (SQL asserts select and delete under the real policies, F1 and F2 killed) and (b) is fixed (`vitest.config.mts:8`, F11), but the Test policy text in checks.md was not changed, so the written justification is the same; and (c) is only half met: `logo-wiring.test.ts` proves the logo adapter's `baseUrl` (F9 killed) but not that `tenantLogo` is the real function (F4). No rows exist to meet or miss, so no row is unmet by the rules; the omission is still not justified for composition-root wiring, and that is the one place a mutant survives.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| (none: section omitted) | `composition/index.ts` | a proof that the container's `tenantLogo` is `makeTenantLogo(logo)` over the container's own `logo` | gap: one surviving mutant (F4); the Storage-policy and collected-test questions are now answered |

## Faults injected

Each fault was applied to the real working tree, the one relevant proof run, and the file restored with `git checkout -- <file>` (no stash, no reset, nothing committed); `git status --porcelain` was empty before and after every fault. Cap exceeded on purpose: every surface a round 1 survivor or a changed file introduced forces a different proof.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 delete policy gains `false and` (cannot delete) | `supabase/migrations/20261111100000_tenant_logo.sql:27` | yes - `FAIL tenant_logo: C3312 delete uA: rows deleted: 0` |
| F2 select policy role list gains `estimator` | `supabase/migrations/20261111100000_tenant_logo.sql:22` | yes - `FAIL tenant_logo: C3305 select uE: rows visible` |
| F3 `isOwnLogoPath` regex `\\.` back to a bare `.` | `web/domain/org-settings/logo.ts:32` | yes - C3309 `...Xpng: expected true to be false` |
| F4 `const tenantLogo = makeTenantLogo(logo)` replaced by a function answering null | `web/composition/index.ts:137` | no - survived: composition, application/use-cases, both PDF route dirs and `app/review` all pass (51 files, 587 tests) |
| F5 PDF image format hard-coded `"png"` instead of `logo.format` | `web/infrastructure/documents/pdf-sections.tsx:53` | no - survived: `infrastructure/documents` 6 files, 55 tests pass (no JPEG is ever drawn) |
| F6 PDF draws at natural size (`logoBox` bypassed) | `web/infrastructure/documents/pdf-sections.tsx:53` | yes - `logo.test.ts` C3326 `expected ... to match /\b160 0 0 -48 0 48 cm\n\/I1 Do/` |
| F7 review page stops passing `logoUrl` (`null`) | `web/app/review/[token]/page.tsx:19` | yes - C3334 `expected ... to match /<img[^>]*src="org\/logo\.png"/` |
| F8 sign page stops passing `logoUrl` (`null`) | `web/app/sign/[token]/page.tsx:10` | yes - C3335 `expected null to be 'org/logo.png'` |
| F9 container builds the loader with `baseUrl: ""` | `web/composition/index.ts:136` | yes - C3328 `logo-wiring.test.ts` `expected "vi.fn()" to be called with arguments` |
| F10 `tenantLogo` loads `null` instead of the stored path | `web/application/use-cases/tenant-logo.ts:11` | yes - C3330 `tenant-logo.test.ts` `expected undefined to deeply equal Uint8Array` and the failing-read test |
| F11 vitest include back to `**/*.test.ts` only | `web/vitest.config.mts:8` | yes - the C3321 proof command exits 1, `No test files found` |

## Findings

Ranked. Each fails the feature on its own.

1. F4: the one line that wires the document logo, `composition/index.ts:137` (`const tenantLogo = makeTenantLogo(logo)`, passed to the routes at `:190` and to the signing documents at `:267`), can be replaced by a function that always answers null and no test fails. C3330, C3331 and C3333 claim the org's current `logo_path` reaches the document; each route and use-case test injects its own `tenantLogo`, and `composition/logo-wiring.test.ts:82-83` asserts only `toBeDefined()` and `typeof container.tenantLogo === "function"`. The fix is one assertion that calls `container.tenantLogo(orgId)` against the stub the wiring test already builds (stub `current` returns a path, `load` records it). C3330, C3331, C3333.
2. F5, JPEG: no proof draws a JPEG into either PDF. `LetterHead` passes `format: logo.format` (`pdf-sections.tsx:53`); hard-coding `"png"` there fails nothing; `jpegHeaderBytes` (`logo.testing.ts:38`) is a header stub and `logoSize` for jpg is the only JPEG path proven (`logo.test.ts:24`). JPEG is half of what AC 1 and AC 16 accept and C3329 has no JPEG case. This is a coverage member with no check: it needs its own check (a real JPEG, a PDF with `/Subtype /Image`, and the decode-failure fallback for a JPEG). The checks.md Coverage table has no formats-drawn row. C3326, C3327, C3329 (Coverage).
3. C3314's second proof names SQL assertions labelled `C3314` that do not exist (`supabase/tests/tenant_logo.sql` carries `C3312 delete` at `:152`; `C3314` appears only in comments at `:5` and `:142`). Either label the delete assertions for both or drop the proof line. Added by the author after approval; a proof that names nothing.
4. Test policy: the omission is still written as "the repo already answers both questions" while composition-root wiring (item 1) is the one question the repo did not answer; no row prices it.
5. Observable "a broken image on the review page hides itself" (`components/ui/tenant-logo.tsx` `onError`) and "a save that leaves `logoPath` out" (`logo-actions.test.ts:111`) have no check. The first is live-only by C3339 (pending); the second is guarded only by an unlabelled test.
6. C3338 and C3339 are not provable here; they stay author-run pending the owner's go-ahead on the migration, and the plan's open question 1 still blocks go-live. Storage's size and type refusal (AC 3) and the cookie-less public read (AC 6) have no proof at any other level. Do not read C3305 (a policy-structure and RLS-visibility check) as covering the public read.

New things looked for and found fine: `logos_select` (`migration:19-23`) is limited to owner and admin of the key's org and to `authenticated`; the recipe proves no other role or org sees a row (`tenant_logo.sql:129`, `:133`) and that the owner and admin each delete 1 row (`:152`); the select policy does not widen the public read (the bucket flag does that). The checks.md edits after approval (C3305 reworded, extra Proof lines, three corrected file names) are consistent with the code: each corrected proof command ran and passed. The test-edits to existing composition, page and `runner.test.ts` files are additive (new `tenantLogo`/`logo` members on doubles, one more recipe counted); no assertion was loosened.

## Gate

`cd web && npx vitest run` (whole suite, `.test.ts` and `.test.tsx`) - 239 files passed, 2 failed (`components/billing/billing-view.test.ts`, `app/(app)/settings/billing/page.test.ts`: the missing package `@stripe/react-stripe-js`, not touched by this diff, same as round 1), 4253 tests passed, 0 failed.
`cd web && npx vitest run -t "C33[0-3][0-9]:" --reporter=verbose` - 73 named tests passed, listed individually (C3308 to C3337, counts above).
All 38 `cd web && ...` proof commands of checks.md as written - 38 exit 0, none vacuous.
`cd web && npm run test:db tenant_logo` - 1 passed, 0 failed (rolled back; the hosted database was not written and the migration was not applied).
