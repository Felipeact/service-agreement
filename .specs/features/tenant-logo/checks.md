# Tenant logo checks

Profile: standard
Plan: `.specs/features/tenant-logo/plan.md`

40 checks in 4 slices · 2 one-way doors (approved by "implement") · 2 open, of which 1 blocks go-live and 0 block the build

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C3300:`). This feature numbers from C3300 (the highest id used so far is C3217). `npx vitest run <file> -t "C3308:"` selects one.
- **SQL** recipe `tenant_logo` runs with `npm run test:db tenant_logo` from `web/` (new `supabase/tests/tenant_logo.sql`, registered in `RECIPES`, run after `fixture.sql`, rolled back). The migration is **not applied to the hosted project** without the owner's go-ahead (rule 8), so the recipe puts the migration file between the fixture and the test, inside the rolled-back transaction. Assertions are labelled with the check id; expected values come from the plan, never read back from the migration. Storage itself (the size and type refusal) is enforced by the Storage service, which a SQL recipe cannot drive: C3302 asserts the bucket's configuration and C3339 observes the refusal live.
- **Live** checks (C3338, C3339) follow AGENTS.md: Playwright MCP at 375, 768 and 1440 px, nothing committed. They need the migration applied (owner's go-ahead).
- Concurrency is not driven by any proof; see Swept.

## Checks

### S1 - Only an owner or admin can store a logo, only for their own org · 4 files · ~40 KB · ~12k

**C3300** - An owner and an admin of an org can each insert a PNG object and a JPEG object into bucket `logos` under `<their org id>/<uuid>.png` and `<their org id>/<uuid>.jpg` (AC 1)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3300`)

**C3301** - An estimator, a viewer, the owner of another org and `anon` each get `42501` inserting into `logos` under the org's folder, and each deleting that org's existing object removes no row (AC 2)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3301`)

**C3302** - Bucket `logos` has `file_size_limit` 1048576 and `allowed_mime_types` exactly `image/png` and `image/jpeg` (AC 3)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3302`)

**C3303** - An insert whose first key segment is not a uuid, or names an org the caller cannot write, answers `42501`, never `22P02` (AC 4)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3303`)

**C3304** - `org_settings.logo_path` accepts null, `<its org id>/<uuid>.png` and `<its org id>/<uuid>.jpg`, and refuses with `23514` another org's id as the prefix, a name with no uuid, a `.svg` ending and a value with no slash (AC 5)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3304`)

**C3305** - Bucket `logos` is public (`public = true`) and carries no `select` policy on `storage.objects`, so a read needs no session (AC 6)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3305`)

**C3306** - `public.portal_view` returns `tenant.logoPath` equal to the org's `logo_path`, null when it has none, and still returns `name`, `address`, `phone`, `accent`, `itemSingular` and `itemPlural` (AC 17, AC 18)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3306`)

**C3307** - `public.signature_view` returns `tenant.logoPath` equal to the org's `logo_path`, null when it has none, and still returns `name`, `address`, `phone` and `accent` (AC 17, AC 18)
Proof: `cd web && npm run test:db tenant_logo` (assertions labelled `C3307`)

### S2 - The owner adds, replaces and removes the logo · 14 files · ~120 KB · ~35k

**C3308** - A logo file is accepted for `image/png` and `image/jpeg` at 1 and 1048576 bytes, and refused (with "Use a PNG or JPEG under 1 MB") for 1048577 bytes, 0 bytes, `image/svg+xml`, `image/gif` and `image/webp` (AC 8, AC 9)
Proof: `cd web && npx vitest run domain/org-settings/logo.test.ts -t "C3308:"`

**C3309** - A submitted `logoPath` is accepted when empty or `<the caller's org id>/<uuid>.png` or `.jpg`, and refused for another org's id, a missing uuid, `.svg`, a leading slash and a path with two segments (AC 15)
Proof: `cd web && npx vitest run domain/org-settings/logo.test.ts -t "C3309:"`

**C3310** - `prepareLogoUpload` returns an error and no upload URL for a type or size outside the rule, and for an estimator, a viewer and a signed-in user with no membership (AC 9)
Proof: `cd web && npx vitest run app/logo-upload.test.ts -t "C3310:"`

**C3311** - `prepareLogoUpload` for an owner and for an admin with `image/png` returns a key `<org id>/<uuid>.png`, and with `image/jpeg` a key ending `.jpg`, plus the signed upload URL that Storage issued for exactly that key (AC 1, AC 7)
Proof: `cd web && npx vitest run app/logo-upload.test.ts -t "C3311:"`

**C3312** - Saving settings with a new valid `logoPath` stores it in `org_settings.logo_path` and deletes the previous object; saving the same path as the stored one deletes nothing (AC 10)
Proof: `cd web && npx vitest run app/\(app\)/settings/logo-actions.test.ts -t "C3312:"`

**C3313** - IF deleting the previous object fails THEN the save still reports success and exactly one error line is logged (AC 10)
Proof: `cd web && npx vitest run app/\(app\)/settings/logo-actions.test.ts -t "C3313:"`

**C3314** - Saving with an empty `logoPath` stores null and deletes the previous object (AC 11)
Proof: `cd web && npx vitest run app/\(app\)/settings/logo-actions.test.ts -t "C3314:"`

**C3315** - Saving settings or setup with a `logoPath` that fails the rule returns a field error on `logoPath`, stores nothing and deletes nothing (AC 15)
Proof: `cd web && npx vitest run app/\(app\)/settings/logo-actions.test.ts -t "C3315:"` and `cd web && npx vitest run app/setup/logo-actions.test.ts -t "C3315:"`

**C3316** - IF the save is refused (`forbidden`) or unavailable THEN the previous object is not deleted and `logo_path` keeps its stored value (AC 10, AC 12)
Proof: `cd web && npx vitest run app/\(app\)/settings/logo-actions.test.ts -t "C3316:"`

**C3317** - Continue on `/setup` with a valid `logoPath` stores it in `org_settings.logo_path` together with the profile and stamps setup (AC 7)
Proof: `cd web && npx vitest run app/setup/logo-actions.test.ts -t "C3317:"`

**C3318** - Skip for now on `/setup` changes no column, so `logo_path` is untouched (AC 13)
Proof: `cd web && npx vitest run app/setup/logo-actions.test.ts -t "C3318:"`

**C3319** - The browser-side upload helper refuses a file outside the rule with "Use a PNG or JPEG under 1 MB" and never calls `prepareLogoUpload` (AC 8)
Proof: `cd web && npx vitest run components/settings/logo-upload.test.ts -t "C3319:"`

**C3320** - IF the Storage upload fails THEN the helper returns "Logo upload failed, try again" and no new path, so the form keeps the stored `logoPath` (AC 12)
Proof: `cd web && npx vitest run components/settings/logo-upload.test.ts -t "C3320:"`

**C3321** - The logo field with a picked file renders the preview, the text "Logo ready" and a hidden input `logoPath` holding the new path; with no pick it holds the stored path (AC 7)
Proof: `cd web && npx vitest run components/settings/logo-field.test.tsx -t "C3321:"`

**C3322** - WHILE a logo is uploading the Save button on `/settings` and Continue on `/setup` render disabled with the text "Uploading logo" (AC 14)
Proof: `cd web && npx vitest run components/settings/logo-field.test.tsx -t "C3322:"`

**C3323** - For an estimator or viewer the settings page renders the stored logo with no choose or remove control (AC 23)
Proof: `cd web && npx vitest run components/settings/logo-field.test.tsx -t "C3323:"`

**C3324** - For an org with no logo the field renders "No logo yet" and "PNG or JPEG, up to 1 MB" (AC 24)
Proof: `cd web && npx vitest run components/settings/logo-field.test.tsx -t "C3324:"`

### S3 - The customer sees the logo · 16 files · ~120 KB · ~35k

**C3325** - The logo's draw box fits inside 160 by 48 pt keeping its aspect ratio, for a wide (400x100), a tall (100x400), a square (50x50) and a smaller-than-box (80x20) image (AC 16)
Proof: `cd web && npx vitest run infrastructure/documents/logo.test.ts -t "C3325:"`

**C3326** - The agreement PDF rendered with a logo contains an image object, and rendered with no logo contains none and extracts the same text as before this feature (AC 16, AC 18)
Proof: `cd web && npx vitest run infrastructure/documents/agreement-pdf.test.ts -t "C3326:"`
Proof: `cd web && npx vitest run infrastructure/documents/logo.test.ts -t "C3326:"`

**C3327** - The contract PDF rendered with a logo contains an image object, and rendered with no logo contains none and extracts the same text as before this feature (AC 16, AC 18)
Proof: `cd web && npx vitest run infrastructure/documents/contract-pdf.test.ts -t "C3327:"`

**C3328** - The logo loader returns null and logs exactly one line when the fetch takes longer than 3 s, answers `404`, answers `500`, returns bytes that start with neither the PNG nor the JPEG signature, or returns more than 1048576 bytes; for a PNG and a JPEG body it returns the bytes with format `png` and `jpg` (AC 19)
Proof: `cd web && npx vitest run infrastructure/supabase/org-logo.test.ts -t "C3328:"`
Proof: `cd web && npx vitest run composition/logo-wiring.test.ts -t "C3328:"`

**C3329** - IF the PDF renderer cannot decode a logo with a valid signature THEN it renders the PDF without it and logs one line, for the agreement and the contract (AC 19)
Proof: `cd web && npx vitest run infrastructure/documents/logo.test.ts -t "C3329:"`

**C3330** - `GET /agreements/[agreementId]/pdf` loads the logo of the org's current `logo_path` into the document (a replaced path loads the new one), and answers `200` when the loader returns null (AC 16, AC 19, AC 20)
Proof: `cd web && npx vitest run app/\(app\)/agreements/\[agreementId\]/pdf/route.test.ts -t "C3330:"`

**C3331** - `GET /contracts/[contractId]/pdf` loads the logo of the org's current `logo_path` into the document, and answers `200` when the loader returns null (AC 16, AC 19, AC 20)
Proof: `cd web && npx vitest run app/\(app\)/contracts/\[contractId\]/pdf/route.test.ts -t "C3331:"`

**C3332** - `GET /review/[token]/pdf` for an already sent version loads the org's current logo (the path `portal_view` returns now), and answers `200` when the loader returns null (AC 16, AC 19, AC 21)
Proof: `cd web && npx vitest run app/review/\[token\]/pdf/route.test.ts -t "C3332:"`

**C3333** - The use case that renders the contract PDF for signature loads the org's current logo into the document, and still sends when the loader returns null (AC 16, AC 19)
Proof: `cd web && npx vitest run application/use-cases/signing-documents.test.ts -t "C3333:"`
Proof: `cd web && npx vitest run application/use-cases/tenant-logo.test.ts -t "C3330:"`

**C3334** - The review page header renders an `<img>` with `src` the logo's public URL and `alt` the company name when the tenant has a `logoPath`, and renders no `<img>` otherwise, with the rest of the header unchanged (AC 17, AC 18)
Proof: `cd web && npx vitest run components/review/logo.test.ts -t "C3334:"`
Proof: `cd web && npx vitest run app/review/\[token\]/page.test.ts -t "C3334:"`

**C3335** - The signing page header renders an `<img>` with `src` the logo's public URL and `alt` the company name when the tenant has a `logoPath`, and renders no `<img>` otherwise, with the rest of the header unchanged (AC 17, AC 18)
Proof: `cd web && npx vitest run components/signing/signing.test.ts -t "C3335:"`
Proof: `cd web && npx vitest run app/sign/\[token\]/page.test.ts -t "C3335:"`

**C3336** - The portal reader and the signing reader map `tenant.logoPath` into the view's tenant, and a reply with no `logoPath` key maps to null (AC 17, AC 18)
Proof: `cd web && npx vitest run infrastructure/supabase/portal.test.ts -t "C3336:"` and `cd web && npx vitest run infrastructure/supabase/signing.test.ts -t "C3336:"`

**C3337** - `logoPublicUrl(base, path)` returns `<base>/storage/v1/object/public/logos/<path>` for a path and null for null (AC 17)
Proof: `cd web && npx vitest run domain/org-settings/logo.test.ts -t "C3337:"`

### S4 - The control works on every size · live · no files

**C3338** - At 375, 768 and 1440 px `/setup` and `/settings` show no horizontal scroll with the logo field, its buttons are at least 44 by 44 px on the two smaller sizes, and the console has 0 errors (AC 22)
Proof: Playwright MCP pass per AGENTS.md on the demo owner (author-run; needs the migration applied)

**C3339** - Against the hosted project with the migration applied: the demo owner uploads a PNG on `/setup`, sees it on `/settings` and on the agreement PDF, the contract PDF, the review page and the signing page; an SVG upload is refused by Storage; the public URL answers `200` to a request with no cookie; replacing the logo shows the new one on a freshly downloaded PDF; Remove returns every surface to its no-logo look; a broken image on the review page hides itself (AC 3, AC 6, AC 17, AC 18, AC 20)
Proof: Playwright MCP pass per AGENTS.md on the demo org, state restored after (author-run; needs the migration applied)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| accepted image types (2) | `image/png` C3308, C3311 · `image/jpeg` C3308, C3311 | - |
| refused files (5) | svg C3308 · gif C3308 · webp C3308 · empty C3308 · 1048577 bytes C3308 | - |
| logo size edges (2) | 1048576 C3308 · 1048577 C3308 | - |
| roles for writing a logo (4) | owner C3300 · admin C3300 · estimator C3301, C3310 · viewer C3301, C3310 | - |
| Storage callers refused (4) | estimator C3301 · viewer C3301 · other org's owner C3301 · anon C3301 | - |
| `logo_path` forms (6) | null C3304 · png C3304 · jpg C3304 · foreign org C3304 · no uuid or svg ending C3304 · no slash C3304 | - |
| `logoPath` form values (8) | empty C3309 · png C3309 · jpg C3309 · foreign org C3309 · missing uuid C3309 · svg C3309 · leading slash C3309 · two segments C3309 | - |
| `prepareLogoUpload` outcomes (3) | ok C3311 · rule error C3310 · permission error C3310 | - |
| settings and setup save outcomes with a logo (4) | saved with path C3312, C3317 · saved with removal C3314 · field error C3315 · forbidden or unavailable C3316 | - |
| places a PDF is rendered (4) | agreement route C3330 · contract route C3331 · portal route C3332 · signing use case C3333 | - |
| customer-facing surfaces showing the logo (4) | agreement PDF C3326 · contract PDF C3327 · review page C3334 · signing page C3335 | - |
| SQL reads returning `logoPath` (2) | `portal_view` C3306 · `signature_view` C3307 | - |
| loader failure modes (5) | timeout C3328 · `404` C3328 · `500` C3328 · wrong signature C3328 · over 1048576 bytes C3328 | - |
| `GET /agreements/[agreementId]/pdf` with a logo, status (1) | 200 C3330 | - |
| `GET /contracts/[contractId]/pdf` with a logo, status (1) | 200 C3331 | - |
| `GET /review/<token>` and `GET /sign/<token>` with a logo, status (1) | 200 C3334, C3335 | - |
| startup config: `NEXT_PUBLIC_SUPABASE_URL` read for the public logo URL (2 assemblies) | page route components read it through one shared `logoPublicUrl` base from `composition` C3334, C3335 · PDF loader reads the same through the container C3328 | - |

- Claims naming a status code, route or response shape: C3300 to C3304 (SQLSTATE), C3330 to C3333 (`200`) - each proof crosses the boundary it names
- The `404` and `503` of the two PDF routes and the `404` of `/review` and `/sign` are unchanged and not claimed here; they stay proven by the routes' and gates' own current tests (`route.test.ts`, `portal-gate.test.ts`, `signing-gate.test.ts`); this feature changes no condition that decides them
- No other check claims more than the single case its proof exercises

## Swept

- validation: C3308, C3309, C3302, C3304
- failure modes: C3316, C3319, C3320, C3328, C3329
- idempotency: C3312 (the same path twice deletes nothing; each upload gets a new key, so a retry never overwrites)
- authorization: C3301, C3303, C3310, C3323, existing - the `org_settings` update policy (AD-025) still decides who may save the path
- concurrency: n/a - two admins saving at once is last write wins, as with every settings field; each upload has its own uuid key, so two uploads never collide
- data lifecycle: C3312, C3314 (replaced and removed objects are deleted); a never-saved upload stays as an orphan, which is accepted in the plan's Assumptions
- dependency failure: C3328, C3329, C3330, C3331, C3332, C3333 (a Storage outage never fails a PDF)
- state transitions: n/a - the logo is a nullable pointer on a row, with no status or transition
- observability: C3313 (a failed delete logs once), C3328 and C3329 (one line when a logo is dropped from a PDF)

## Handoff

- Files: S1 about 4 files and 40 KB (a new migration with the two redefined functions, the recipe, `RECIPES`, types) = 10k; S2 about 14 files, 120 KB = 30k (settings and setup forms and actions, domain, the two stores, the new port, composition); S3 about 16 files, 130 KB = 33k (document builders, both PDF renderers, loader, three routes, signing use case, the two views, the two readers) plus the ports file at 57 KB = 14k read once; S4 no code. Total about 87k plus tests, under the 150k budget - one builder. No ask.
- Mechanism: one builder

## Test policy

Omitted. The repo already answers both questions for these layers: `AGENTS..md` and the closest analogues (first-login-setup, billing-page) prove decisions in domain files at their own layer with one asserted case per row, and the boundary at a route test; no new rows are proposed.
