# Tenant logo verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: f3cea51..a833f2c (HEAD)
**Round**: 3 - full (every proof re-run at a833f2c; assertion citations re-read; the files untouched since c03ede9 keep their round 2 line numbers, re-checked by grep)
**Verifier**: independent sub-agent (author != verifier)

Verified at a833f2c. 40 checks: 37 PASS, 1 FAIL (C3333), 2 author-run self-reports (C3338, C3339: not PASS, see rows). All 47 `cd web && ...` proof commands in checks.md were run exactly as written at HEAD: all exit 0, none "No test files found", none vacuous. Faults: 5 injected this round, 4 killed, 1 survived (M2, the signing-documents wiring at `composition/index.ts:267`). Round 2's F4 and F5 are killed; C3314's label and the C3330/C3331 container wiring are fixed; C3333's own production wiring is not.

## Binding sources

Step 1 did not run: the profile is `standard` and the step is `ui`-only.

## Round 2 survivors and FAILs, re-tested

| Round 2 item | Now | How shown |
| --- | --- | --- |
| F4 `tenantLogo` in the container answers null | killed for `container.tenantLogo` (M1); a sibling wire survives (M2) | M1: line 137 replaced by `async () => null`: `composition/logo-wiring.test.ts` `C3330` fails `expected null to deeply equal { bytes: Uint8Array[ 1, 2, 3 ], ...}`; wide run of composition, application, agreement and contract routes, review, sign: 1 failed, 594 passed. M2 below |
| F5 PDF format hard-coded `png` | killed | M3: `pdf-sections.tsx:53` `format: "png" as const`: `logo.test.ts` `C3326: a decodable JPEG logo is drawn too` fails |
| C3314 proof names labels absent from the recipe | fixed | `supabase/tests/tenant_logo.sql:152` is now `tests.ok('C3312 C3314 delete ' || v_user, v_n = 1, ...)`; `grep -n C3314` hits `:5`, `:142`, `:152` |
| C3330, C3331 (wiring) | PASS | M1 killed; see rows for the precision note |
| C3333 (wiring) | still FAIL | M2: `composition/index.ts:267` `makeContractDocuments(..., settings.get, tenantLogo)` replaced by `async () => null` passes composition, application, contract routes, sign: 47 files, 422 tests |
| unlabelled test "a save with no logoPath leaves the column alone" | guarded, but has no check | M4 kills it, see Findings 2 |
| C3338, C3339 | author-run self-reports, not PASS | rows below |

## Checks

Proofs run from `web/`. Pass counts (`N passed | M skipped`) of the 47 commands: C3308 1, C3309 1, C3310 8, C3311 2, C3312 3 (+ SQL), C3313 1, C3314 1 (+ SQL), C3315 3 + 2, C3316 2, C3317 2, C3318 1, C3319 4, C3320 2, C3321 2, C3322 2, C3323 2, C3324 1, C3325 1, C3326 1 + 2, C3327 1, C3328 7 + 1, C3329 3, C3330 2 + 1 (use case), C3331 2, C3332 2, C3333 2 + 1, C3334 2 + 1, C3335 2 + 1, C3336 1 + 1, C3337 1. SQL: `npm run test:db tenant_logo` printed `PASS tenant_logo`, `1 passed, 0 failed`, exit 0. It now runs against the real applied policies on the hosted project inside a rolled-back transaction (the recipe is `plain("tenant_logo")`, `scripts/test-db/runner.mts:61`); nothing was written. Grep of labels in `supabase/tests/tenant_logo.sql`: C3300 to C3307 and the combined `C3312 C3314 delete` exist as assertion labels.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C3300 | owner and admin insert png and jpg under own org | `npm run test:db tenant_logo` exit 0 | `supabase/tests/tenant_logo.sql:41` `perform tests.ok('C3300 four objects', (select count(*) ... name like orgA/%) = 4, ...)` | PASS |
| C3301 | estimator, viewer, other-org owner, anon get 42501; delete removes no row | same | `tenant_logo.sql:54` `expect_error('C3301 insert ' || v_user, ..., '42501')`; `:61` anon; `:57` and `:64` `v_n = 0`; `:66` object kept | PASS |
| C3302 | bucket limit and mime types | same | `tenant_logo.sql:75` `b.file_size_limit = 1048576`; `:76` `array_agg(t order by t) = array['image/jpeg','image/png']` | PASS |
| C3303 | non-uuid or foreign org first segment gives 42501 | same | `tenant_logo.sql:84` `expect_error('C3303 not a uuid', ..., '42501')`; `:85` empty; `:86` other org `'42501'` | PASS |
| C3304 | `logo_path` shape, 23514 | same | `tenant_logo.sql:107` `expect_error('C3304 ' || v_bad, ..., '23514')` over `:101-105`; `:97-99` null, png, jpg accepted | PASS |
| C3305 | bucket public; no select policy applies to anon, estimator, viewer, other owner | same | `tenant_logo.sql:116` `(select public from storage.buckets ...) is true`; `:129` `count(*) ... = 0` for uE, uV, uB; `:133` anon `= 0`; `:137` owner and admin `>= 4`. The cookie-less public read is C3339 only | PASS |
| C3306 | `portal_view` returns `tenant.logoPath`, null, other keys | same | `tenant_logo.sql:169` `v #>> '{tenant,logoPath}' = tests.lg_key(...)`; `:177` `jsonb_typeof(...) = 'null'` | PASS |
| C3307 | `signature_view` the same | same | `tenant_logo.sql:210` `v #>> '{tenant,logoPath}' = ...`; `:217` null | PASS |
| C3308 | accept png/jpeg at 1 and 1048576; refuse 1048577, 0, svg, gif, webp | `domain/org-settings/logo.test.ts -t "C3308:"` 1 passed | `logo.test.ts:10` `toEqual({ ok: true, ext: "png" })`; `:20` `toEqual({ ok: false, error: LOGO_FILE_ERROR })` over `:14-18` | PASS |
| C3309 | `logoPath` accepted and refused forms | `-t "C3309:"` 1 passed | `logo.test.ts:25-27` `isOwnLogoPath(ORG, ...)).toBe(true)`; `:38` `expect(isOwnLogoPath(ORG, path), path).toBe(false)` over `:29-36` | PASS |
| C3310 | no upload URL for rule violations and no permission | `app/logo-upload.test.ts -t "C3310:"` 8 passed | `logo-upload.test.ts:27` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:39` `answer.ok).toBe(false)`; `:41` `prepareUpload).not.toHaveBeenCalled()` | PASS |
| C3311 | owner and admin get key and signed URL | `-t "C3311:"` 2 passed | `logo-upload.test.ts:46` `toEqual({ ok: true, path: ${ORG}/id.png, signedUrl: "https://s/sign/png", contentType: "image/png" })`; `:48` `prepareUpload.mock.calls).toEqual([[ORG, "png"], [ORG, "jpg"]])` | PASS |
| C3312 | new path stored, previous deleted; same path deletes nothing | `settings/logo-actions.test.ts -t "C3312:"` 3 passed; SQL exit 0 | `app/(app)/settings/logo-actions.test.ts:50` `toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))`; `:52` `remove).toHaveBeenCalledWith(OLD)`; `:58` `not.toHaveBeenCalled()`; `tenant_logo.sql:152` `tests.ok('C3312 C3314 delete ' || v_user, v_n = 1, ...)` for owner and admin | PASS |
| C3313 | failed delete: success, one error line | `-t "C3313:"` 1 passed | `logo-actions.test.ts:78` `state.status).toBe("saved")`; `:80` `error).toHaveBeenCalledTimes(1)` | PASS |
| C3314 | empty `logoPath` stores null, deletes previous | `-t "C3314:"` 1 passed; SQL exit 0 | `logo-actions.test.ts:87` `objectContaining({ logoPath: null })`; `:88` `remove).toHaveBeenCalledWith(OLD)`; `tenant_logo.sql:152` label `C3312 C3314 delete` asserts `v_n = 1` | PASS |
| C3315 | bad `logoPath` is a field error, nothing stored or deleted | both commands, 3 + 2 passed | `logo-actions.test.ts:97` `toMatchObject({ status: "invalid", errors: { logoPath: REFUSED } })`; `:98` `saveOrgSettings).not.toHaveBeenCalled()`; `app/setup/logo-actions.test.ts:59-61` the same | PASS |
| C3316 | forbidden or unavailable save does not delete | `-t "C3316:"` 2 passed | `logo-actions.test.ts:105` `state.status).toBe(code)`; `:106` `remove).not.toHaveBeenCalled()` | PASS |
| C3317 | Continue stores `logoPath` with the profile | `setup/logo-actions.test.ts -t "C3317:"` 2 passed | `app/setup/logo-actions.test.ts:46` `rejects.toThrow("NEXT_REDIRECT /pipeline")`; `:47` `saveSetupProfile).toHaveBeenCalledWith(ORG, objectContaining({ ..., logoPath: NEW }))` | PASS |
| C3318 | Skip changes no column | `-t "C3318:"` 1 passed | `app/setup/logo-actions.test.ts:72` `skipSetup).toHaveBeenCalledWith(ORG)`; `:73` `saveSetupProfile).not.toHaveBeenCalled()` | PASS |
| C3319 | browser helper refuses, never calls `prepareLogoUpload` | `components/settings/logo-upload.test.ts -t "C3319:"` 4 passed | `logo-upload.test.ts:18` `toEqual({ ok: false, error: "Use a PNG or JPEG under 1 MB" })`; `:19` `prepare).not.toHaveBeenCalled()` | PASS |
| C3320 | Storage failure gives retry message, no path | `-t "C3320:"` 2 passed | `logo-upload.test.ts:34` `toEqual({ ok: false, error: "Logo upload failed, try again" })`; `:37` `not.toContain(PATH)` | PASS |
| C3321 | pick shows preview, "Logo ready", hidden `logoPath` | `logo-field.test.tsx -t "C3321:"` 2 passed | `logo-field.test.tsx:35` `toContain("Logo ready")`; `:36` `toMatch(<input ... type="hidden" ... name="logoPath" ... value="${PATH}")` | PASS |
| C3322 | Save and Continue disabled with "Uploading logo" | `-t "C3322:"` 2 passed | `logo-field.test.tsx:86` `toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Uploading logo<\/button>/)`; `:95` Continue | PASS |
| C3323 | estimator and viewer: stored logo, no controls | `-t "C3323:"` 2 passed | `logo-field.test.tsx:64` `expect(markup).not.toContain(absent)`; `:71` `toContain(${BASE}/storage/v1/object/public/logos/${PATH})` | PASS |
| C3324 | no logo copy | `-t "C3324:"` 1 passed | `logo-field.test.tsx:48` `toContain("No logo yet")`; `:49` `toContain("PNG or JPEG, up to 1 MB")` | PASS |
| C3325 | draw box fits 160 by 48 | `infrastructure/documents/logo.test.ts -t "C3325:"` 1 passed | `logo.test.ts:15` `logoBox(400,100)).toEqual({ width: 160, height: 40 })`; `:16` `{12,48}`; `:17` `{48,48}`; `:18` `{80,20}` | PASS |
| C3326 | agreement PDF has image with logo (png and jpg), none without, same words | agreement-pdf 1 passed; `logo.test.ts` 2 passed | `agreement-pdf.test.ts:271` `toContain("/Subtype /Image")`; `:272` `not.toContain(...)`; `:275` `expect(words(drawn)).toEqual(words(plain))`; `logo.test.ts:114` `toMatch(/\b160 0 0 -48 0 48 cm\n\/I1 Do/)`; JPEG: `:122` `toContain("/Subtype /Image")`, `:123` `toMatch(/\b1 0 0 -1 \S+ \S+ cm\n\/I1 Do/)` over a real 1x1 JPEG (`:128`). M3 killed | PASS |
| C3327 | contract PDF the same | `contract-pdf.test.ts -t "C3327:"` 1 passed | `contract-pdf.test.ts:242` `toContain("/Subtype /Image")`; `:243` `not.toContain(...)`; `:246` words equal. The JPEG path is the shared `LetterHead` (`pdf-sections.tsx:53`), drawn in the agreement test | PASS |
| C3328 | loader failures and formats; container builds it on the project URL | `org-logo.test.ts` 7 passed; `composition/logo-wiring.test.ts` 1 passed | `infrastructure/supabase/org-logo.test.ts:32` `toEqual({ bytes: PNG, format: "png" })`; `:52-53` `toBeNull()` and `error).toHaveBeenCalledTimes(1)`; `:65-66` timeout; `composition/logo-wiring.test.ts:27` the `baseUrl` test `toHaveBeenCalledWith({ baseUrl: "https://example.supabase.co" })` | PASS |
| C3329 | undecodable logo: PDF without it, one line | `logo.test.ts -t "C3329:"` 3 passed | `logo.test.ts:50` `not.toContain("/Subtype /Image")`; `:52` `error).toHaveBeenCalledTimes(1)`; `:75` contract. PNG body only (no undecodable JPEG case) | PASS |
| C3330 | agreement route loads the current logo; 200 when null | route 2 passed; `tenant-logo.test.ts` 1 passed | `app/(app)/agreements/[agreementId]/pdf/route.test.ts:209` `status).toBe(200)`; `:210` `tenantLogo).toHaveBeenCalledWith(ORG)`; `application/use-cases/tenant-logo.test.ts:34` and `:39`; container: `composition/logo-wiring.test.ts:38` `expect(await container.tenantLogo("org-1")).toEqual(LOGO)`, `:39` `load).toHaveBeenCalledWith(STORED)`, `:40` `toBeNull()`. M1 killed. Precision note: no Proof line in checks.md names `logo-wiring.test.ts -t "C3330:"`, so the proof as written does not run the wiring test (it runs in the full suite and in the C3328 line for that file only by luck of the filter being per label) | PASS |
| C3331 | contract route the same | route 2 passed | `contracts/[contractId]/pdf/route.test.ts:187` `tenantLogo).toHaveBeenCalledWith(ORG)`; `:188` `contractor.logo).toEqual(first)`; `:197` 200; route reads `container.tenantLogo` (`route.ts:18`), covered by the same wiring test, M1 killed. No labelled wiring test of its own | PASS |
| C3332 | portal PDF loads the current logo from `portal_view`'s path | route 2 passed | `app/review/[token]/pdf/route.test.ts:175` `loadLogo).toHaveBeenCalledWith(PATH)`; `:181` 200; `:182` `toHaveBeenCalledWith(null)`; the adapter assembly is killed by the `baseUrl` test | PASS |
| C3333 | signing use case loads the logo, still sends when null | `signing-documents.test.ts` 2 passed; `tenant-logo.test.ts -t "C3330:"` 1 passed | `application/use-cases/signing-documents.test.ts:122` `loadLogo).toHaveBeenCalledWith("org-1")`; `:123` `contractor.logo).toEqual(logo)`; `:128` `toEqual({ number: "AG-1052", document: built })`. The production argument `tenantLogo` at `composition/index.ts:267` replaced by `async () => null` (M2) passes 47 files, 422 tests: the contract that goes out for signature can lose its logo unseen | FAIL (production wiring at `composition/index.ts:267` unproven, M2 survives) |
| C3334 | review header `<img>` with src and alt, none without | `components/review/logo.test.ts` 2 passed; `page.test.ts` 1 passed | `components/review/logo.test.ts:14` `toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/...\/o\/l\.png"/)`; `:15` `toContain('alt="Kettle Ridge Mechanical Ltd."')`; `:17` `not.toContain("<img")`; `app/review/[token]/page.test.ts:317` `toMatch(/<img[^>]*src="org\/logo\.png"/)` | PASS |
| C3335 | signing header the same | `signing.test.ts` 2 passed; `app/sign/[token]/page.test.ts` 1 passed | `components/signing/signing.test.ts:151` src regex; `:152` alt; `:154` `not.toContain("<img")`; `app/sign/[token]/page.test.ts:55` `props.logoUrl).toBe("org/logo.png")` | PASS |
| C3336 | readers map `tenant.logoPath` | `portal.test.ts`, `signing.test.ts` 1 + 1 passed | `infrastructure/supabase/portal.test.ts:218` `tenant?.logoPath).toBe(path)`; `:220` `toBeNull()`; `signing.test.ts:179` and `:181` | PASS |
| C3337 | `logoPublicUrl` shape | `-t "C3337:"` 1 passed | `domain/org-settings/logo.test.ts:43` `toBe("https://x.supabase.co/storage/v1/object/public/logos/<org>/<id>.png")`; `:45` `toBeNull()` | PASS |
| C3338 | 375, 768, 1440 px, no horizontal scroll, 44 px controls | author-run live pass, not observable by a Verifier | `.specs/STATE.md` handoff (Latest feature): 375, 768, 1440 px on `/setup` and `/settings`, no horizontal scroll, 44 px controls on the two smaller sizes. Console errors are not mentioned in that note | Self-report (author-run), not PASS |
| C3339 | live end to end | author-run live pass, partly observed | `.specs/STATE.md` handoff: observed PNG upload, Save, public URL 200 with no cookie, SVG refused by Storage (400), replace deleted the old object, Remove restored the no-logo look, the agreement PDF carried and then lost its image object. NOT observed: contract PDF, `/review`, `/sign`, broken-image hiding | Self-report (author-run), partial, not PASS |

The validator allows a PASS verdict only when no check row's Result is something other than PASS, so C3338 and C3339 rows read as self-reports keep the verdict at FAIL by the rows alone; a Verifier cannot turn them into PASS. The unobserved parts (contract PDF, `/review`, `/sign` visuals, broken-image hiding) rest on component, use-case and SQL checks only.

## Coverage

Recomputed from the plan's Landing, Relations, Surface and Criteria and from the code. Callers of `renderAgreement` and `renderContract` outside tests: `agreements/[agreementId]/pdf/route.ts:32`, `contracts/[contractId]/pdf/route.ts:32`, `review/[token]/pdf/route.ts:22`, `application/use-cases/signing.ts:66` (fed by `composition/index.ts:267`). The set of four is complete.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| accepted image types (2), refused files (5), size edges (2) | plan AC 8, `logo.ts:12` | C3308 `logo.test.ts:10`, `:20`; C3311 `logo-upload.test.ts:46-47` | - |
| roles and Storage callers (owner, admin, estimator, viewer, other owner, anon) | plan AC 1, 2, door 4 | C3300 `tenant_logo.sql:41`; C3301 `:54`, `:61`; select `:129`, `:133`, `:137`; delete 1 row `:152` | - |
| `logo_path` forms (6) and `logoPath` form values (8 plus dot) | plan AC 5, 15 | C3304 `tenant_logo.sql:97-107`; C3309 `logo.test.ts:25-38` | - |
| `prepareLogoUpload` outcomes (3); save outcomes (4) | `logo-upload.ts`, plan Flow | C3310, C3311; C3312, C3314, C3315, C3316, C3317 | - |
| places a PDF is rendered (4) | grep above | agreement C3330; contract C3331; portal C3332; signing C3333 | the production wire `composition/index.ts:267` for the signing documents: M2 survives (the other three wires, `:137` and `:190`, are killed by M1) |
| customer-facing surfaces (4) | plan AC 16, 17 | C3326 `agreement-pdf.test.ts:271`; C3327 `:242`; C3334 `page.test.ts:317`; C3335 `page.test.ts:55` | - |
| logo formats drawn in a PDF (2) | door 2, AC 1 | png `logo.test.ts:114`; jpg `logo.test.ts:122-123` (M3 killed) | - |
| SQL reads returning `logoPath` (2); loader failure modes (5) | door 3, AC 19 | C3306, C3307; `org-logo.test.ts:52-53`, `:65-66` | - |
| route statuses with a logo | plan Surface | 200 C3330 `:209`, C3331 `:186`, C3332 `:174` | - |
| startup config `NEXT_PUBLIC_SUPABASE_URL` (2 assemblies) | `composition/index.ts:99`, `:136`; `logo-field.tsx:131` | `logo-wiring.test.ts:27` (baseUrl); `logo-field.test.tsx:71` | - |
| Storage's own refusal (AC 3) and cookie-less public read (AC 6) | plan door 1 | bucket config C3302 `tenant_logo.sql:75-76`, C3305 `:116` | the refusal and the anonymous 200 are observable only live; C3339 records them as author-observed (SVG PUT 400, public URL 200), not Verifier-proven |
| broken image hides itself (Observable, AC 18) | `components/ui/tenant-logo.tsx` `onError` | none | no check, no test, not observed live by the author either (C3339 names it) |
| a save that leaves `logoPath` out leaves the column alone (door 3) | plan Landing 3, AD-180 | `logo-actions.test.ts:111` `not.toHaveProperty("logoPath")` (killed by M4); setup side not asserted | no check carries it: an unlabelled test, so a check-id proof run never selects it |

## Test policy rows

checks.md still reads "Omitted", justified as "the repo already answers both questions". Round 2 priced composition-root wiring as the unanswered question. Re-judged at a833f2c: `logo-wiring.test.ts` now proves `container.tenantLogo` end to end (M1 killed), but the same container's second use of `tenantLogo` (`composition/index.ts:267`) is unproven (M2). No rows exist, so none can be unmet by the rules; the written omission is still not true for composition wiring, and the one surviving mutant sits there.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| (none: section omitted) | `composition/index.ts` | each place the container hands `tenantLogo` or `logo` to a consumer is asserted through `getContainer` | gap: `:137` and `:190` now proven; `:267` (signing documents) not (M2) |

## Faults injected

Each fault was applied to the real tree, the narrowest covering proof run, and the file restored with `git checkout -- <file>` (no stash, no reset, nothing committed); `git status --porcelain` was empty before and after. The SQL surfaces (policies, bucket, constraint) cannot be mutated this round: the migration is applied, and the recipe tests the hosted database rather than the file, so editing the migration file changes nothing the recipe reads; round 2's SQL faults F1 and F2 killed at c03ede9 and the SQL assertions were unchanged since apart from the `C3312 C3314` label.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1 container `tenantLogo` is `async () => null` instead of `makeTenantLogo(logo)` | `web/composition/index.ts:137` | yes - `logo-wiring.test.ts` `C3330` `expected null to deeply equal { bytes: Uint8Array[ 1, 2, 3 ], ... }` |
| M2 signing documents get `async () => null` instead of `tenantLogo` | `web/composition/index.ts:267` | no - survived: composition, application, contract routes and sign pass (47 files, 422 tests) |
| M3 PDF image format hard-coded `"png"` instead of `logo.format` | `web/infrastructure/documents/pdf-sections.tsx:53` | yes - `logo.test.ts` `C3326: a decodable JPEG logo is drawn too` fails |
| M4 settings save always carries `logoPath` (`formData.has("logoPath")` -> `true`) | `web/app/(app)/settings/actions.ts:35` | yes - `logo-actions.test.ts:111` `expected { ...(19) } to not have property "logoPath"` |

## Findings

Ranked. The first fails the feature on its own.

1. M2, C3333: `composition/index.ts:267` passes `tenantLogo` to `makeContractDocuments` for the contract sent for signature; replacing it with a function that answers null fails no test. `application/use-cases/signing-documents.test.ts:122` injects its own loader, and `logo-wiring.test.ts` builds the container but never drives `sendForSignature`. The same seam round 2 flagged as F4, closed for the routes and left open here. Fix: one assertion through the container's `sendForSignature` documents, or a labelled wiring test (`C3333`) added to checks.md and run.
2. The test "a form that carries no logoPath leaves the stored logo alone" (`app/(app)/settings/logo-actions.test.ts:109-113`) guards AD-180's "a save that leaves them out never touches the column" and door 3; M4 shows it kills a real regression, but it has no check id, so no proof line selects it and the setup action has no equivalent assertion at all. It deserves a check (for settings and setup) in checks.md. Coverage row above.
3. Precision gap in checks.md: C3330's wiring proof `logo-wiring.test.ts` `C3330:` (`:35`) is not named by any Proof line, and C3331 has no wiring proof of its own; the checks only pass the wiring through the full suite. Add `cd web && npx vitest run composition/logo-wiring.test.ts -t "C3330:"` to C3330 and C3331.
4. SQL proofs now run against the hosted database, not the migration file: a future edit to the migration is invisible to `npm run test:db tenant_logo` until applied. That is intended after apply, and recorded here so a mutation on the file is not mistaken for coverage.
5. Test policy: still "Omitted" while composition-root wiring (finding 1) is the one place the repo's conventions leave a mutant alive.
6. C3338 and C3339 are author-run self-reports (see rows). C3338's console-error clause (0 errors) is not recorded in the handoff; C3339's contract PDF, `/review`, `/sign` and broken-image hiding were not observed. The plan's open question 1 (go-live) is a human decision.
7. C3329 has no undecodable-JPEG case and no contract-PDF JPEG draw; both are covered by the shared `LetterHead` and are not worth a check on their own.

New things looked for and found fine: the new wiring test `logo-wiring.test.ts:35-41` asserts the real `makeTenantLogo(logo)` reading the stored path (not a mock of `tenantLogo`); the JPEG test uses a decodable 1x1 file and an operator regex, so the format reaching the renderer is the thing proven (M3); the diff since c03ede9 touches only tests, the recipe parts and docs (no product code), so no behaviour changed under the round 2 verdict.

## Gate

`cd web && npx vitest run` (whole suite) - 239 files passed, 2 failed (`components/billing/billing-view.test.ts`, `app/(app)/settings/billing/page.test.ts`: the missing package `@stripe/react-stripe-js`, untouched by this diff, same as rounds 1 and 2), 4255 tests passed, 0 failed.
All 47 `cd web && ...` proof commands of checks.md as written - 47 exit 0, each printing `N passed` with N >= 1.
`cd web && npm run test:db tenant_logo` - 1 passed, 0 failed (rolled back; the hosted database was not otherwise written).
