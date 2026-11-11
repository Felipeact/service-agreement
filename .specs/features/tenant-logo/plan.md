# Tenant logo

Roadmap Phase 5 item "Setup screen: logo upload (needs a Storage bucket for logos) and the starter template preview". This plan takes the logo half only; the template preview stays open and waits for Phase 5.5. One feature at a time (decision 22). `org_settings.logo_path` has existed since `0001_init` and nothing reads or writes it.

## Problem

Every product document says the customer sees the contractor's logo (PRODUCT.md "Tenant branding is data", DESIGN.md "let the tenant's logo and accent colour lead on everything the customer sees"). Today it sees none: `logo_path` is never set, there is no bucket, the agreement and contract PDFs print the company name as text, and the review and signing pages show a name and an accent colour. A contractor who pays for the product sends a proposal that looks like the product's, not theirs, and has no way on `/setup` or `/settings` to fix it. The roadmap gives no sign-up, activation or support figure, so none is claimed here.

When this ships, an owner or admin can add, replace or remove the company logo on `/setup` and on `/settings`, and the customer sees it on the agreement PDF, the contract PDF, the review page and the signing page. An org with no logo looks exactly as it does today.

## Flow

Reuses the imports upload pattern (AD-068 area: the server issues a signed upload URL, the browser uploads straight to Storage under RLS), `org_settings` and its owner/admin row policy (AD-025), `getOrgSettings`, the settings and setup Server Actions, `buildAgreementDocument` / `buildContractDocument` and the two PDF renderers, instead of a second branding table, a file-through-the-action upload or a logo service.

1. Owner or admin picks a file on `/setup` or `/settings` -> `LogoField` (new component, placement per conventions) checks type and size in the browser -> Server Action `prepareLogoUpload` (new, in the existing settings and setup action files) -> `OrgLogo` port (new, `supabaseOrgLogo`, a sibling of `OrgSettingsStore`) returns a signed upload URL for a new key `<org_id>/<uuid>.<ext>` (door 1)
2. Browser uploads the bytes to the `logos` bucket (new, door 1) under the bucket's insert policy, then the form's Save writes `org_settings.logo_path` through the existing `org_settings` update (exists, changed: the validated value gains the path)
3. Remove -> same Save with an empty path; the port then deletes the old object (best effort, logged)
4. `GET /agreements/[agreementId]/pdf`, `GET /contracts/[contractId]/pdf` and the portal PDF (exist, changed) -> `OrgLogo.bytes(path)` (new method) reads the object -> `buildAgreementDocument` / `buildContractDocument` (exist) carry the bytes in `tenant.logo` -> `agreement-pdf.tsx`, `contract-pdf.tsx` and `LetterHead` in `pdf-sections.tsx` (exist) draw it above the name
5. `/review/<token>` and `/sign/<token>` (exist, changed) -> `portal_view` and the signing view (exist) already return `tenant`; they gain `logoUrl`, the object's public URL, which `review-view` and `signing-view` (exist) render in their header

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: logo - the org's picture, a PNG or JPEG of at most 1 MB, stored as `org_settings.logo_path`; lives in `domain/org-settings` (rules) and the `logos` bucket (bytes) |
| domain | existing term: `logo_path` meant "unused column", now means "object key inside the `logos` bucket, null for none". Who branches on it today: nobody (grep: only the generated types and the settings test fixtures) |
| domain | existing term: `tenant` on `AgreementDocument`, `ContractDocument`, `PortalView` and the signing view gains an optional logo. Readers of `tenant` today: both PDF renderers, `review-view`, `signing-view`, `portalDocument`, their tests (`document.test.ts` asserts `tenant` exactly, so it is extended, not rewritten) |
| stored data | no org has a logo, so nothing to migrate. `portal_view` and the signing read are redefined to return the path; existing rows return null and render as today |
| tests | `supabase/tests/customer_portal.sql` already fails on the old four-key `tenant` (stale since item-vocabulary); this feature does not fix it and does not make it worse. No approved check is rewritten |
| not changed | emails (they carry no branding block today), the sidebar and the product's own mark, `/members`, billing, the n8n workflows, default terms |

## Relations

```mermaid
erDiagram
    ORG ||--|| ORG_SETTINGS : "is configured by"
    ORG_SETTINGS ||--o| LOGO_OBJECT : "points at"
```

One-way constraint: the object key is `<org_id>/<uuid>.<ext>` and `logo_path` must start with its own org's id (door 1). No columns and no types here.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `prepareLogoUpload` (Server Action on `/setup` and `/settings`) | `contentType` (`image/png` or `image/jpeg`), `size` (bytes) | `{ uploadUrl, path }` or `{ error }` | `200`, field error as the form notice, permission notice |
| `POST /setup` and `POST /settings` (Server Actions, exist) | gain `logoPath` (empty string removes) | as today | `200`, `303`, permission notice |
| `GET /agreements/[agreementId]/pdf`, `GET /contracts/[contractId]/pdf`, the portal PDF | unchanged | PDF, now with the logo when the org has one | unchanged: `200`, `404`, `503` |
| `GET /review/<token>`, `GET /sign/<token>` | unchanged | pages, now with `<img>` of the logo when set | `200`, `404` as today |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Where the bytes live and who may write them | bucket `logos`: `public = true`, `file_size_limit = 1048576`, `allowed_mime_types = array['image/png','image/jpeg']`. Key `<org_id>/<uuid>.<ext>`, a new key per upload so a replaced logo is never served stale. Policies on `storage.objects` for `logos`: `insert` and `delete` to `authenticated` when `private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner','admin'])`; no `select` policy (public read is the bucket flag), no `update`. `org_settings.logo_path` gets `check (logo_path is null or logo_path ~ (concat('^', org_id::text, '/[0-9a-f-]{36}\.(png or jpg)$')))` | A private bucket with signed URLs: the review and signing pages are anonymous, so a definer function would have to sign for a token, and the PDF route would still fetch bytes; a logo is shown to every customer by design, so privacy buys nothing. Overwriting one key per org: browsers and the PDF fetch would cache the old picture. SVG: the PDF renderer cannot draw it and it can carry script |
| 2. What the customer-facing code receives | `tenant.logoUrl`, a string or null, on `portal_view` and the signing read (`<project url>/storage/v1/object/public/logos/<path>`), and `tenant.logo`, an object with `bytes` and `format` (png or jpg) or null, on the two document models; a fetch failure or a timeout over 3 s yields null, never a failed PDF | Embedding the image as a data URL in `portal_view`: up to 1.4 MB through a definer function on every page load. Failing the PDF when the logo is unreachable: a storage blip would stop a contractor sending a proposal |
| 3. What the two anonymous reads return (found while building; refines door 2) | `portal_view` and `signature_view` return `tenant.logoPath` (the object key or null), not a URL, because SQL does not know the project URL. The app derives the address with `logoPublicUrl(base, path)` through `OrgLogo.url`, so the pages take a `logoUrl` prop. `OrgSettingsValue.logoPath` and `SetupProfileValue.logoPath` are optional: a save that leaves them out does not touch `logo_path` | A `logoUrl` built in SQL: the URL would be a setting the database must carry. A required `logoPath` on the settings value: every existing save and its test would write the column |
| 4. Who may select from the bucket (found by the Verifier; amends door 1, which said no select policy) | `create policy logos_select on storage.objects for select to authenticated using (bucket_id = 'logos' and private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner','admin']))`. Storage's delete only sees rows a select policy shows, so without it replacing or removing a logo deleted nothing and raised no error. Public read stays the bucket flag, so `anon` and every other role still select nothing through the API | A delete policy alone: removes 0 rows silently. A select policy for every member of the org: viewers and estimators have no use for listing logo objects |

- Nothing else in this change is hard to reverse: the component, the upload helper, the draw size and the placement above the name are edits.
- Door 1 reaches past this feature: a public bucket is a new pattern for the codebase (imports is private); the template editor's preview and the emails will read the same path. It belongs in `STATE.md` as an AD at the end of the build.

## Criteria

### S1: Only an owner or admin can store a logo, only for their own org (P1)

**Acceptance Criteria**

1. WHEN an owner or admin of an org uploads a PNG or JPEG of at most 1,048,576 bytes to `logos/<their org id>/<uuid>.<ext>` THEN Storage SHALL accept it
2. IF an estimator, a viewer, a member of another org or `anon` uploads or deletes an object in `logos` THEN Storage SHALL refuse it with `42501`
3. IF an object is larger than 1,048,576 bytes or is not `image/png` or `image/jpeg` (including `image/svg+xml`) THEN the bucket SHALL refuse it
4. IF a key's first segment is not a uuid, or names an org the caller cannot write THEN the policy SHALL answer `42501`, not a cast error
5. IF `org_settings.logo_path` is set to a value that does not start with its own `org_id` followed by `/`, or does not end in a uuid and `.png` or `.jpg`, THEN the update SHALL fail `23514`
6. WHEN anyone requests the public URL of an existing logo THEN Storage SHALL serve it without a session

**Independent test:** the rolled-back SQL recipe `tenant_logo`: as owner insert and delete an object, as estimator and as another org's owner try both, set a good and a bad `logo_path`.

### S2: The owner adds, replaces and removes the logo on `/setup` and `/settings` (P1)

**Acceptance Criteria**

7. WHEN an owner or admin picks a PNG or JPEG of at most 1 MB THEN the form SHALL show a preview and "Logo ready", and SHALL write `logo_path` only when Save (or Continue on `/setup`) is pressed
8. IF the picked file is larger than 1,048,576 bytes or is not a PNG or JPEG THEN the form SHALL show "Use a PNG or JPEG under 1 MB" and SHALL NOT call `prepareLogoUpload`
9. WHEN `prepareLogoUpload` is called with a type or size outside the rule, or by a member who is not an owner or admin THEN it SHALL return an error and no upload URL
10. WHEN Save succeeds with a new `logoPath` THEN `org_settings.logo_path` SHALL equal it and the previous object, if any, SHALL be deleted; IF that delete fails THEN the system SHALL log it once and still report success
11. WHEN the owner presses "Remove logo" and saves THEN `logo_path` SHALL be null and the object deleted
12. IF the upload to Storage fails THEN the form SHALL show "Logo upload failed, try again", SHALL keep the stored `logo_path` and SHALL still let every other field save
13. WHEN `/setup` is skipped THEN the logo SHALL be left as it is
14. WHILE a logo is uploading the Save button SHALL be disabled and say "Uploading logo"
15. WHEN a form submits `logoPath` that does not match `<own org id>/<uuid>.(png|jpg)` THEN the action SHALL answer a field error and store nothing

**Independent test:** on `/setup` pick a PNG, Continue, open `/settings` and see it; replace it, then remove it.

### S3: The customer sees the logo (P1)

**Acceptance Criteria**

16. WHERE the org has a logo, the agreement PDF and the contract PDF SHALL draw it above the company name in the letterhead, at most 48 pt high and 160 pt wide, aspect ratio kept
17. WHERE the org has a logo, `/review/<token>` and `/sign/<token>` SHALL show it in the header next to the company name, with the company name as its `alt` text
18. WHERE the org has no logo, every one of those four surfaces SHALL render exactly as before this feature
19. IF the logo cannot be fetched within 3 seconds or is not a valid image THEN the PDF SHALL still render, without it, and one line SHALL be logged
20. WHEN an org replaces its logo THEN a PDF generated afterwards SHALL carry the new one
21. WHEN a sent version's PDF is opened THEN it SHALL show the org's current logo (the logo is branding like the accent colour, not frozen with the terms)

**Independent test:** set a logo on the demo org, download both PDFs and open the review and signing pages.

### S4: The control works on every size and for everyone it applies to (P1)

**Acceptance Criteria**

22. WHILE the page is at 375, 768 or 1440 px wide the logo field SHALL cause no horizontal scroll, and its buttons SHALL be at least 44 by 44 px on mobile and tablet
23. WHEN an estimator or viewer opens `/settings` THEN the logo field SHALL be read-only, showing the logo with no choose or remove control
24. WHEN an org has no logo THEN the field SHALL show "No logo yet" and the accepted types and size

**Independent test:** the AGENTS.md Playwright pass on `/setup` and `/settings` at the three sizes.

## Out of scope

| Excluded | Why |
| --- | --- |
| Template preview on `/setup` | Document templates are Phase 5.5; the roadmap item's second half stays open |
| Logo in emails and on the sign-in page | Emails carry no branding block today; a separate item |
| Cropping, resizing, background removal or format conversion | The owner uploads a ready image; we only bound its size |
| SVG, GIF, WebP | The PDF renderer draws PNG and JPEG only; SVG can carry script |
| A logo per agreement or per trade | One logo per org |
| Freezing the logo into a sent version | It is branding, like the accent colour (AC 21) |
| Image pixel-dimension limits | We cannot decode on the server without a new dependency; the 1 MB cap and the draw box bound the cost |
| Fixing `customer_portal.sql`'s stale `tenant` keys | Pre-existing, own item |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Scope covers where the customer sees it, not only the upload | Include PDFs, review and signing pages | An upload nobody sees would tick the roadmap item and change nothing for the customer | n |
| Public bucket | Yes (door 1) | A logo is shown to every customer; the anonymous pages need a plain URL | n |
| Accepted formats and size | PNG and JPEG, 1 MB | What `@react-pdf/renderer` draws; typical logos are far smaller | n |
| Roles | Owner and admin write, everyone in the org reads | Same as every other `org_settings` field (AD-025) | n |
| Upload mechanism | Signed upload URL, browser to Storage | The imports precedent; avoids a Server Action body limit | n |
| Orphaned objects | A failed delete is logged and left; a replaced logo whose Save never happened leaves one unreferenced file | Cheap and harmless at 1 MB; a sweeper is a later item | n |

**Open questions:** none block the build.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | The migration (bucket, policies, check constraint, two redefined reads) needs applying with the owner's go-ahead | Proven on rolled-back SQL and fakes first |
| 2 | open | Is the public-bucket choice acceptable to the owner? | Built as door 1; the alternative is a signing function and more code |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/setup`, `/settings` logo field | empty state | AC 24 |
| screen `/setup`, `/settings` logo field | loading state | AC 14 |
| screen `/setup`, `/settings` logo field | error state | AC 8, AC 12 |
| screen `/setup`, `/settings` logo field | unauthorised | AC 23, AC 9 |
| screen `/setup`, `/settings` logo field | destructive action confirms | n/a - Remove only clears the pointer until Save, the owner can re-pick, and nothing else is lost |
| screen `/setup`, `/settings` logo field | density and ordering | existing - the Settings form's section cards; the logo sits first in the branding card |
| screen `/review`, `/sign` | empty, error | AC 18 (no logo, and an image that fails to load hides itself) |
| API `prepareLogoUpload` | error shape and codes | AC 8, AC 9, AC 15 (the existing form notice pattern) |
| API `prepareLogoUpload` | who may call it | AC 9 |
| API `prepareLogoUpload` | versioning, rate limits | n/a - an authenticated Server Action on the member's own org; the bucket's 1 MB cap bounds each write |
| the four customer surfaces | document or copy structure | AC 16, AC 17 |
| PDF routes | error shape | AC 19 (unchanged codes; a bad logo never changes the status) |

## Sources

- `ROADMAP.md` Phase 5 item "Setup screen: logo upload ..." and Onboarding step 4 - the item
- `PRODUCT.md` "Tenant branding is data, not code" and `DESIGN.md` customer-facing rule - what the customer must see
- `.specs/features/first-login-setup/plan.md` Out of scope - why the logo was left out of that feature
- `.specs/STATE.md` AD-025, AD-176 - who writes `org_settings`, how `/setup` is gated
