# Context: Service Agreement micro-SaaS

The shared knowledge base for agents. Read this first, before searching the codebase or the internet.

**Maintenance rule (see `AGENTS..md`):** every change to the app updates this file in the same change. Update the concept's *What it is* / *What we built* entry and add a line to the [Build log](#build-log). If you had to look a concept up online, write the answer here.

Other sources:
- [ROADMAP.md](ROADMAP.md): modules (M1–M17), phases, stack, status model, n8n workflows.
- [PRODUCT.md](PRODUCT.md): users, positioning, constraints, product principles.
- [DESIGN.md](DESIGN.md): visual system and UI rules.

---

## Domain glossary

### Tenant (Org) and roles (M1)
**What it is:** a contractor company (HVAC or mechanical) that subscribes to the app. The schema is shared, every row carries an `org_id`, and Postgres RLS enforces isolation. Members have one role: owner, admin, estimator or viewer. Login is by magic link.
**What we built:** tables `orgs` and `memberships` (one role per user per org, `unique (org_id, user_id)`) in [supabase/migrations/20261019174738_init.sql](supabase/migrations/20261019174738_init.sql), on the Supabase project `service-agreement` (ref `gnxebrtcpbujhvcamtoe`, region `ca-central-1`).
- **Isolation:** every tenant table has `org_id not null`, and child rows reference parents through `(id, org_id)` composite foreign keys, so a reference cannot cross orgs (AD-003).
- **RLS:** enabled on all 16 `public` tables. Policies call `private.is_org_member(org)` and `private.has_org_role(org, roles[])`, which are security definer with an empty `search_path`, in a `private` schema the Data API does not expose (AD-004).
- **Who writes what:** members read everything in their org except `outbox`. Owner and admin write settings, memberships and the equipment catalog. Owner, admin and estimator write customers, contacts, sites, assets, agreements, versions, service lines, contracts and events. Viewers only read. `anon` can read no rows and write nothing.
- **Sign-in (staff):** a **sign-in link** by email, not a password. Customers get a different **portal link** (M9), with no account.
  - `/login` ([web/app/login/](web/app/login/)) asks Supabase for a link with `shouldCreateUser: false`, so only existing users get one. An unknown address sees the same "Check your email" answer and gets no account (Supabase answers 422 `otp_disabled`).
  - The email links to `GET /auth/confirm?token_hash=…&type=email` ([web/app/auth/confirm/route.ts](web/app/auth/confirm/route.ts)), which calls `verifyOtp`, sets the session cookies and redirects to `/pipeline`. A missing, wrong, used or expired link redirects to `/login?error=link_invalid` (Supabase answers 403 `otp_expired`).
  - **Supabase config outside the repo:** the Magic link email template's link must be `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and the Site URL `http://localhost:3000` in dev. Supabase only allows editing the templates with custom SMTP, so the project sends through Resend (`smtp.resend.com`); until a domain is verified there, it delivers only to the Resend account's own address.
  - **Session refresh:** [web/proxy.ts](web/proxy.ts) runs `updateSession` ([web/infrastructure/supabase/session.ts](web/infrastructure/supabase/session.ts)) on every request except build assets and images. `getClaims()` refreshes an expired token and the new cookies go on the response. Signed out, any path except `/login` and `/auth/confirm` redirects to `/login`; signed in, `/login` redirects to `/pipeline`.
  - **Who is signed in:** `currentMember()` from `getContainer()` returns `signed_out`, `no_membership` or `member` (user, email, org, org name, role). Identity comes from `getClaims` (`sub`), never `getSession`. `getContainer()` first awaits `connection()`, so the session (and the clock Supabase reads for token expiry) is read only at request time, never during a prerender or prefetch (AD-027). A user with several memberships acts for the earliest one. Adapters: [web/infrastructure/supabase/auth.ts](web/infrastructure/supabase/auth.ts).
  - **The `(app)` gate:** [web/app/(app)/layout.tsx](web/app/(app)/layout.tsx) renders `MemberGate` inside `<Suspense>` (Cache Components cannot prerender a session read). Signed out redirects to `/login`; no membership shows "No workspace yet" with Sign out; a member gets the shell with the org name, their email and Sign out (scope `local`, this browser only).
  - **Members before onboarding:** invite the user in the Supabase dashboard, then run [supabase/seed.sql](supabase/seed.sql) after `select set_config('app.demo_owner_email', '<email>', false);` to make them owner of the demo org. The address is never committed.
- **Not yet:** org creation is done by the service role only (onboarding is Phase 5). No invite or members screen, and no org switcher.
- **Tests:** [supabase/tests/](supabase/tests/), run with `npm run test:db` (see "How to run the tests"); each run rolls back. Spec: [.specs/features/supabase-init/](.specs/features/supabase-init/).

### Company profile and default terms (M2)
**What it is:** each tenant's branding and contract defaults. Branding is legal name, address, phone, logo and accent colour. Default terms are repair discount %, CPI cap %, cancellation notice days, payment days, governing province and tax note (GST/PST/HST). Branding is data, not code: no company name is hard-coded, and seed or demo data uses a fictitious company.
**What we built:** table `org_settings`, one row per org (primary key `org_id`). Percent terms are `numeric(5,2)` between 0 and 100. `accent_color` is `#rrggbb`. `logo_path` will point into Storage once buckets exist; the logo is not shown or edited yet.
- **Settings screen:** `/settings` ([web/app/(app)/settings/](web/app/(app)/settings/)) shows the legal name, address, phone, accent colour and the default terms. Owners and admins edit and save; estimators and viewers see it read-only. `saveSettingsAction` validates with `validateOrgSettings` ([web/domain/org-settings/index.ts](web/domain/org-settings/index.ts)), then `OrgSettingsStore.save` updates the row under RLS (an empty result means `forbidden`). The province is stored as a two-letter code (AD-025). Last write wins. The form uses the new `Select` ([web/components/ui/select.tsx](web/components/ui/select.tsx)).
- **Demo org:** [supabase/seed.sql](supabase/seed.sql) creates the fictitious tenant `Kettle Ridge Mechanical Ltd.`, with fixed id `00000000-0000-4000-8000-00000000de30`. Its address is `100 Sample Street, Burnaby, BC`, its phone `604-555-0100` (the 555-01xx fiction range) and its accent `#1f6f8b`. Its default terms are 10 % repair discount (a placeholder, since the source template leaves it blank), 5 % CPI cap, 30 days' notice, payment in 30 days and BC. It has 12 agreements (one per site, version 1, mirroring the twelve mock cards; 3 contracts) and no events yet; its owner is attached with `app.demo_owner_email` (see Tenant). The seed has run once on the live project; re-running it changes nothing.

### Customer (M3)
**What it is:** the client company that owns the equipment and receives the service agreement, for example a property-management firm.
**What we built:** table `customers` (per org). The demo org has 12 customers, each with one contact (`@example.com` email) and one site.
- **Screens:** `/customers` lists customers by name with the primary contact (the earliest-created contact), site count and asset count, and a search. `/customers/[customerId]` shows contacts, sites and the customer's agreements; each agreement row links to `/agreements/[agreementId]`. Code: [web/components/customers/](web/components/customers/).
- **Forms (record-forms):** owners, admins and estimators get "New customer" on `/customers`, and "Edit", "Add contact" and "Add site" on a customer. Create pages nest under the parent (`/customers/new`, `/customers/[id]/contacts/new`, `/customers/[id]/sites/new`); edit pages are flat (`/customers/[id]/edit`, `/contacts/[id]/edit`) (AD-028). Viewers see no write controls, and a form route shows them "Only owners, admins and estimators can change customer records." Each form posts to a Server Action in [web/app/(app)/record-actions.ts](web/app/(app)/record-actions.ts): it refuses viewers, validates with [web/domain/records](web/domain/records/index.ts), then writes through a per-entity store port ([web/infrastructure/supabase/records.ts](web/infrastructure/supabase/records.ts), AD-029) and redirects to the record. Customers cannot be deleted. Field bounds: names 1-120, addresses 300, phone 40. Last write wins. Spec: [.specs/features/record-forms/](.specs/features/record-forms/).

### Contact / site contact (M3)
**What it is:** the person at the customer, usually a facility or property manager, who reviews the agreement through the portal and signs the contract. Their email approval counts as written approval. They are non-technical and use the portal rarely.
**What we built:** table `contacts`, belonging to a customer. A site's `site_contact_id` must name a contact of that site's customer, enforced by the composite FK `(site_contact_id, customer_id)`.
- **Forms:** add and edit contacts (name, optional email and phone). A contact can be deleted from its edit page after a confirm prompt; a contact that is some site's contact is refused (FK `23503`, AD-030).

### Site (M3)
**What it is:** a physical address belonging to a customer, where the equipment is installed. A customer can have several sites.
**What we built:** table `sites`, belonging to a customer, with an optional site contact. A site that has an agreement cannot be deleted.
- **Screen:** `/sites/[siteId]` ([web/app/(app)/sites/[siteId]/](web/app/(app)/sites/[siteId]/)) is the equipment register: assets grouped by asset type (ordered by type name, rows by unit with numbers compared as numbers), a search, and a link back to the customer. Writers get "Edit site", "Add asset" and per-asset "Edit".
- **Agreement on the site (agreement-builder):** a site has at most one **live** agreement (`draft`, `sent` or `changes_requested`). While it has one, every member sees a link `<number> · <stage label>` to it; while it has none, writers get "New agreement", which creates one and opens it. `SiteView.liveAgreement` comes from `SiteRegister` ([web/infrastructure/supabase/readers.ts](web/infrastructure/supabase/readers.ts)).
- **Forms:** add a site to a customer (`/customers/[id]/sites/new`) and edit it (`/sites/[id]/edit`): name, address and a site contact chosen only from that customer's contacts. The customer never changes. Sites cannot be deleted (agreements hang off them).

### Asset and asset type (M4)
**What it is:** one piece of equipment at a site. Fields: asset type, unit #, type/model, location/access, and source (manual or import). The asset type comes from a catalog of about 40 equipment types, for example RTU (rooftop unit) and MUA (make-up air unit).
**What we built:** tables `asset_types` (catalog per org, `unique (org_id, code)`) and `assets` (per site, `source` is `manual` or `import`).
- **Codes:** an asset type code must match `^[A-Z][A-Z0-9_]*$`, for example `RTU`, `MUA` or `HWT_HIGH_EFFICIENCY` (check `asset_types_code_format`). Phase 2 synonyms map onto these codes.
- **Demo assets:** 57 assets across the 12 demo sites, using 27 of the 40 types, all `source = 'manual'`.
- **Forms:** `/sites/[id]/assets/new` and `/assets/[id]/edit`: equipment type (the org's `asset_types`, shown as `Name (CODE)`), unit #, type/model, location/access. New assets get `source = 'manual'`; an edit keeps `source`. An asset can be deleted after a confirm prompt (hard delete, AD-030). With an empty catalog the add page says "Your equipment catalog is empty."

### Asset import (M5)
**What it is:** turning a customer's messy equipment list (xlsx, csv, docx or pdf) into assets. The steps are upload, parse by format, extract with Claude structured output, normalize types with a synonym table (for example "Rooftop unit" → RTU), review in a grid, then commit. Uncertain rows are flagged, never hidden. Extraction sits behind the `AssetExtractor` port.
**What we built (step 1, upload):** spec [.specs/features/import-upload/](.specs/features/import-upload/).
- **Import job:** table `import_jobs`, one uploaded file for one site (`site_id` composite FK), status `uploading` -> `uploaded`, with original name, size, canonical content type, `created_by` and `created_by_email` from the JWT. RLS as `assets`: members read, owner/admin/estimator write (AD-031). Migration [supabase/migrations/20261026200326_import_upload.sql](supabase/migrations/20261026200326_import_upload.sql).
- **Storage:** private bucket `imports`, 20 MB, pdf/csv/xlsx/docx only (AD-032). Key `<org_id>/<job_id>`; a file can only be inserted for a job of that org still `uploading`; no overwrite; the first `storage.objects` policies in the project (AD-033). Direct SQL deletes on `storage.objects` need `set_config('storage.allow_delete_query','true', true)` (Supabase's `protect_delete` trigger).
- **Screen:** `/sites/[siteId]/import` ([web/app/(app)/sites/[siteId]/import/](web/app/(app)/sites/[siteId]/import/)), linked from the site register as "Import equipment list" for writers. Writers pick one file and press Upload; everyone sees the site's jobs newest first (name, size, uploader, date, "Uploaded" / "Upload not finished"); writers can Discard after a confirm prompt.
- **Upload path (AD-034):** `startImportAction` validates with `validateImportFile` ([web/domain/imports](web/domain/imports/index.ts)) and calls `ImportJobStore.start`, which inserts the job and signs an upload URL; the browser `PUT`s the bytes straight to Storage ([web/components/imports/state.ts](web/components/imports/state.ts) `uploadFile`); `confirmImportAction` checks the stored size and marks the job uploaded. Adapter: [web/infrastructure/supabase/imports.ts](web/infrastructure/supabase/imports.ts).
**What we built (step 2, read):** spec [.specs/features/import-parse/](.specs/features/import-parse/).
- **Read:** right after an upload is confirmed, `readImportAction` reads the stored file once and records the outcome on the job: `uploaded` -> `parsed` ("Read", with "48 rows in 1 table", "Text only, no table" or "PDF, read at extraction") or `unreadable` ("Can't read", with one of five reasons and its advice). A job whose read did not finish stays "Uploaded" with a "Read file" button. Migration [supabase/migrations/20261026220638_import_parse.sql](supabase/migrations/20261026220638_import_parse.sql) (AD-035).
- **Parsers:** `ImportParser` in [web/infrastructure/import-parsers/](web/infrastructure/import-parsers/) (AD-036). Spreadsheets and CSV through SheetJS 0.20.3 (installed from the SheetJS CDN tarball, because npm's `xlsx@0.18.5` has two high advisories): the header is the first row in a sheet's first 20 rows with at least 2 text cells (no numbers or dates) and a data row below; hidden sheets are skipped; CSV delimiters `,` `;` and tab are detected, and a CSV that is not UTF-8 is decoded as Windows-1252 (Excel's "CSV" on Windows). Word through `mammoth` (top-level tables with 2+ columns, plus the raw text). PDFs are only checked for `%PDF-` and passed on whole: Claude reads them in step 3. More than 2,000 data rows is refused. Password-protected Office files are recognised by their OLE signature.
- **Output for step 3:** `ParsedImport` is tables (header, rows with refs like `Units!4` or `Table 2, row 1`) plus document text, or the PDF bytes. It is not stored; extraction parses again.
- **Reads as the member:** `ImportJobStore.fileOf` downloads under RLS, never with a service-role key, and `recordRead` writes only while the job is `uploaded`, so two reads write once (AD-037).
- **Not yet:** download or preview of the file; cleanup of jobs left "Upload not finished".
**What we built (step 3, extract):** spec [.specs/features/import-extract/](.specs/features/import-extract/).
- **Flow:** on a "Read" job a writer presses "Extract equipment". The browser calls `extractImportAction` once per chunk (up to 100 data rows of one table, or the whole text of a table-less Word file, or a whole PDF) until the job is `extracted`. Each chunk: `ImportJobStore.sourceOf` (file bytes as the member, only while `parsed` / `extracting`) -> `ImportParser` re-parses -> `AssetExtractor` (Claude, structured output) -> `matchAssetType` -> `record_extraction_chunk` (AD-038 to AD-044). A closed tab leaves the job `extracting` with a "Continue extraction" button; a stale call stores nothing twice.
- **Claude:** [web/infrastructure/claude/](web/infrastructure/claude/) calls `claude-opus-5-5` (effort low, `json_schema` output, server-side refusal fallback). Only the chunk is sent: no org, customer, site or member identity. A refusal, bad answer or API error is `unavailable` ("We couldn't read this list. Try again."); a text or PDF answer that hits the output limit is `too_large`. `ANTHROPIC_API_KEY` is server-side only ([web/.env.example](web/.env.example)).
- **Matching:** `matchAssetType` in [web/domain/imports/index.ts](web/domain/imports/index.ts) compares code or name (lowercased, punctuation collapsed), then a built-in synonym table (`SYNONYMS`, by catalog code, e.g. "Rooftop unit" -> RTU, "MAU" -> MUA); no match or more than one gives no type, and the row is stored with `asset_type_id` null and counted as needing a type.
- **Data:** `import_rows`, the extraction columns on `import_jobs`, the `record_extraction_chunk` function and the `import_row_counts` view, in [supabase/migrations/20261027045548_import_extract.sql](supabase/migrations/20261027045548_import_extract.sql). `import_rows` joined the tenant-table inventory (17 tables).
- **Screen:** the job list shows "Extract equipment", "Extracting" with `n of m`, and "Extracted" with `338 rows, 14 need an equipment type` ("No equipment found" for none).
- **Not yet:** per-org synonyms; spend limits.
**What we built (step 4, review and commit):** spec [.specs/features/import-review/](.specs/features/import-review/).
- **Screen:** "Review rows" on an extracted or committed job opens `/imports/[jobId]` ([web/app/(app)/imports/[jobId]/](web/app/(app)/imports/[jobId]/), [web/components/imports/review-view.tsx](web/components/imports/review-view.tsx)): every row in file order, 100 a page, with the matched type beside what the file said, and a "Needs attention" filter. Writers edit a row (the asset form's fields and limits), skip or include it, give one type to every untyped row with the same spelling, then press "Add N assets to <site>" and confirm. Below 768px rows are stacked cards.
- **Flags** (`flagRows` in [web/domain/imports/index.ts](web/domain/imports/index.ts)): "Needs a type" and "Too long" block the commit; "Check this row" (low confidence), "Same as row n" (same type and unit #) and "Already on this site" only ask for a look. A row with no unit # is never a duplicate. Merging duplicates means skipping all but one; nothing is skipped automatically.
- **Commit:** `public.commit_import` adds every included row as an asset (`source = 'import'`) on the job's site in one transaction and marks the job `committed` ("Added to site: 336 assets, 2 skipped"); a repeat adds nothing. Rows keep `skipped` and the `asset_id` they became; deleting that asset clears the link. A trigger freezes a job's rows unless it is `extracted`, and a committed job cannot be discarded (AD-045 to AD-050). Migration [supabase/migrations/20261027162030_import_review.sql](supabase/migrations/20261027162030_import_review.sql).
- **Not yet:** updating an existing asset from a row flagged "Already on this site"; undoing a commit as a whole; adding rows the file did not have.

### Maintenance task library (M6)
**What it is:** a preventive-maintenance checklist for each equipment type. Each tenant can edit it, and it is snapshotted into each agreement version so later edits don't change sent agreements.
**What we built:** table `asset_type_tasks`, a checklist per asset type and per org, ordered by `position`. Agreements show it as "Service included", and a version freezes it into `agreement_versions.snapshot` when the agreement leaves draft (see Service agreement below).
- **Catalog template:** the product's standard catalog is `private.catalog_asset_types` (40 types) and `private.catalog_asset_type_tasks` (174 tasks), filled from the "Service included" section of the maintenance proposal template, without the source company. It is in [supabase/migrations/20261019191509_catalog_template.sql](supabase/migrations/20261019191509_catalog_template.sql) (AD-007). The "AHU (Metro Tower)" variant is excluded, and two typos are corrected ("preventer", "hot spots").
- **Copying it into an org:** `private.seed_org_catalog(org)` copies the template into one org and returns the number of types inserted (40 on an empty org, 0 on a re-run). It skips codes the org already has, and keeps their own checklists. From then on the org owns its copy: template changes never reach it and its edits never reach the template (AD-008). Only the service role can call it; Phase 5 onboarding will call it for new orgs.
- **Not yet:** a catalog editing screen, per-task frequency (for example the ERV's quarterly vs annual tasks), and service-line templates.
- **Tests and spec:** [supabase/tests/catalog_seed.sql](supabase/tests/catalog_seed.sql) and [supabase/tests/demo_seed.sql](supabase/tests/demo_seed.sql); [.specs/features/catalog-seed/](.specs/features/catalog-seed/).

### Service agreement (PM agreement) (M7, M8)
**What it is:** the preventive-maintenance proposal the contractor sends to the customer for review. It is not yet a signed contract. It contains:
- Visit frequency.
- Service price lines (visits per year × cost per visit). Money is stored in integer cents, in CAD.
- "Service included", built from the asset types on site and their checklists.
- The equipment list, grouped by type.
- Versions: requesting changes creates a new version.

It is rendered as a tenant-branded PDF behind the `DocumentRenderer` port (`@react-pdf/renderer`).
Statuses: `draft` (shown as "In progress") → `sent` → `accepted` | `refused` | `changes_requested`. `changes_requested` returns to `draft` as a new version. `sent` can become `expired`, and `draft` or `sent` can become `withdrawn`.
**What we built:** the agreement builder (Phase 3 item 1, spec [.specs/features/agreement-builder/](.specs/features/agreement-builder/)).
- **Screen:** `/agreements/[agreementId]` ([web/app/(app)/agreements/[agreementId]/page.tsx](web/app/(app)/agreements/[agreementId]/page.tsx), flat by uuid, `?version=<n>` for a past version, AD-056) shows the number, stage, customer and site links, the shown version's service lines with each annual amount, and `Total per year` (before tax). From md up the line columns are headed. Writers on the current version of a `draft` add, edit and remove lines (remove asks first); a `changes_requested` agreement offers "Start version <n + 1>"; `draft` and `sent` offer "Withdraw" (asks first). Past versions and non-draft agreements are read-only. Views: [web/components/agreements/](web/components/agreements/). Pipeline cards, customer agreement rows and the site's live-agreement link all open it. The sidebar "Agreements" item stays disabled.
- **Create:** "New agreement" on a site calls `createAgreementAction` ([web/app/(app)/agreement-actions.ts](web/app/(app)/agreement-actions.ts)) -> `AgreementStore.create` -> RPC `public.create_agreement(site)`: one transaction inserts the agreement in `draft` with its number and version 1, no lines (AD-053). A second live agreement on the site is refused by the partial unique index `agreements_one_live_per_site` and answered `open_exists` with a link (AD-052).
- **Numbering:** `AG-<n>`, given once at creation: one more than the highest `AG-<digits>` in the org, `AG-1001` in an empty org; an advisory lock per org serialises creates and `unique (org_id, number)` backs it up (AD-051). Never typed, never edited.
- **Service lines:** description (1-200 characters), visits per year (1-365; this is the "visit frequency") and cost per visit ($0 to $999,999.99, parsed by `validateServiceLine` in [web/domain/agreement/index.ts](web/domain/agreement/index.ts) to integer cents); annual = visits x cost; at most 50 lines a version (app-side). Writes go through `ServiceLineStore` ([web/infrastructure/supabase/agreements.ts](web/infrastructure/supabase/agreements.ts)). The trigger `private.service_lines_frozen` refuses a member's line write (`55000`, shown "This version can no longer be changed.") unless the agreement is `draft` and the line is on its latest version; seed and migrations (no `auth.uid()`) pass (AD-054).
- **Versions:** "Start version <n + 1>" runs the `revise` transition; `apply_agreement_transition` now also copies version n's lines into version n + 1 in the same transaction, and version n stays unchanged (AD-055). Ports: `AgreementReader`, `AgreementStore`, `ServiceLineStore` (AD-057).
- **Migration:** [supabase/migrations/20261027202354_agreement_builder.sql](supabase/migrations/20261027202354_agreement_builder.sql); SQL proofs [supabase/tests/agreement_builder.sql](supabase/tests/agreement_builder.sql).
- **Service included and equipment (Phase 3 item 2, spec [.specs/features/service-included/](.specs/features/service-included/)):** below the lines, "Service included" lists each equipment type on the site (`Rooftop unit, 2 units`) with its checklist, and "Equipment" groups the site's assets by type in closed disclosures (`Rooftop unit · 2`), in the site register's order. Both come from one document built by `public.site_service_scope(site)` (security invoker, `{schema: 1, types: [{code, name, tasks, assets: [{unitNo, typeModel, location}]}]}`). While the agreement is a draft and its current version is shown, the page reads it live, so asset and checklist changes appear on the next load. When the agreement leaves draft (sent or withdrawn), `apply_agreement_transition` calls `private.freeze_agreement_version` in the same transaction, which writes the document with `takenAt` into the highest version; that version then shows "As recorded on <date>" whatever the site holds later. Members can no longer update `agreement_versions` at all. Parsed by `parseServiceScope` in [web/domain/agreement/index.ts](web/domain/agreement/index.ts), read by the agreement reader, rendered by [web/components/agreements/service-scope.tsx](web/components/agreements/service-scope.tsx). Migration [supabase/migrations/20261027212052_service_included.sql](supabase/migrations/20261027212052_service_included.sql) backfilled every non-editable version with its site's scope as of 2026-10-27 (demo data only); `seed.sql` repeats that on re-runs (AD-058 to AD-062).
- **Not built yet:** editing Service included per agreement, per-task frequency, the PDF, sending and the portal, line reordering, deleting an agreement.
- **Tables:** `agreements` (exactly one site, no `customer_id`; the customer comes through the site), `agreement_versions` (`unique (agreement_id, version_no)`, `version_no >= 1`) and `service_lines`, which hang off a version, not the agreement.
- **Status:** `text` with a check constraint over the seven values above, default `draft`. There are no Postgres enums (AD-005).
- **Money:** `cost_per_visit_cents bigint >= 0`, and `visits_per_year >= 1`. In code, money is the branded type `Cents` from [web/domain/money/index.ts](web/domain/money/index.ts). `cents(n)` throws `RangeError` unless `n` is a non-negative safe integer, and `lineAnnualCents(visits, cost)` and `sumCents(list)` do the arithmetic (AD-012). `formatCad` in [web/lib/money.ts](web/lib/money.ts) stays the display formatter.

### Customer review portal (M9)
**What it is:** a magic-link page with no customer account. The site contact can view and download the agreement, then Accept, Refuse (a reason is required) or Request changes. It records when the agreement was viewed. It wears the tenant's brand, never the product's.
**What we built:** nothing yet. Planned for Phase 3.

### Contract and e-signature (M10)
**What it is:** the legally binding document generated from the accepted agreement version. The client signs first, then the tenant countersigns. The signed PDF and its audit log are stored. E-signature runs through DocuSeal behind the `SignatureProvider` port and must be valid under Canadian provincial electronic transactions law.
Statuses: `pending_signature` → `client_signed` → `completed`. `pending_signature` or `client_signed` can become `declined` or `voided`.
**What we built:** table `contracts`, at most one per agreement version (`agreement_version_id unique`). `status` is text with a check over the five values above, default `pending_signature`. Signing is Phase 4.

### Pipeline / status engine (M11)
**What it is:** a pure state machine for agreements and contracts. Every transition writes an event and an outbox row. Each deal is shown at one stage: **In progress → Sent to customer → Accepted (awaiting signature) → Completed**, with **Refused** as the exit. The dashboard shows deals by stage and age.
**What we built:**
- **Domain layer:** pure TypeScript in [web/domain/](web/domain/), with no framework, database or UI imports. An ESLint `no-restricted-imports` rule on `domain/**` enforces this (AD-010). Spec: [.specs/features/domain-layer/](.specs/features/domain-layer/).
  - **Agreement machine:** `applyAgreementCommand(status, command)` in [web/domain/agreement/index.ts](web/domain/agreement/index.ts). It allows 8 moves: `send` (draft→sent), `accept`, `refuse`, `request_changes` and `expire` (all from sent), `revise` (changes_requested→draft, new version `n + 1`), and `withdraw` (from draft or sent). `refuse` and `request_changes` need a reason of 1–2000 characters after trimming.
  - **Contract machine:** `applyContractCommand(status, command)` in [web/domain/contract/index.ts](web/domain/contract/index.ts). `client_sign` (pending_signature→client_signed) and then `countersign` (→completed); `decline` and `void` work from either open status.
  - **Result:** a refused move returns `{ ok: false, error: { code, from, command } }` with code `invalid_transition`, `reason_required` or `reason_too_long`; it never throws. A successful move returns `{ ok: true, status, event }`. The event's type is `<entity>.<to-status>` (`agreement.sent`, `agreement.revised`, `contract.completed`...). It carries `from`, `to` and `data` (`reason` or `versionNo`) (AD-011). The transition use cases below record it.
  - **Stage:** `pipelineStage(agreement, contract?)` in [web/domain/pipeline/index.ts](web/domain/pipeline/index.ts). draft and changes_requested → In progress; sent → Sent; accepted → Accepted until the contract completes (→ Completed). Customer-side endings (refused, expired, contract declined) → Refused. Contractor-side endings (withdrawn, contract voided) → `null`, off the board.
- **Stage keys:** `in_progress`, `sent`, `accepted`, `completed` and `refused` are owned by [web/domain/pipeline/index.ts](web/domain/pipeline/index.ts) (AD-001). [web/lib/pipeline-stage.ts](web/lib/pipeline-stage.ts) re-exports them and keeps only the UI labels and dot classes.
- **Board UI:** `/pipeline` ([web/app/(app)/pipeline/page.tsx](web/app/(app)/pipeline/page.tsx)) shows the five-column board on the member's agreements.
  - Each column shows its card count and its CAD total per year, formatted by `formatCad` from [web/lib/money.ts](web/lib/money.ts).
  - Search by customer name runs client-side.
  - On mobile the board becomes stage tabs; on tablet it scrolls inside its own container.
- **Redirect:** `/` redirects to `/pipeline` with a 307 ([web/next.config.ts](web/next.config.ts)).
- **Recording a transition:** server code calls `getContainer()` from [web/composition/index.ts](web/composition/index.ts) (`server-only`, one per request, built from the request cookies) and then `transitionAgreement({ agreementId, command })` or `transitionContract({ contractId, command })`. The use case ([web/application/use-cases/index.ts](web/application/use-cases/index.ts)) loads the record through a repository port ([web/application/ports/index.ts](web/application/ports/index.ts)), lets the domain machine decide, and commits. It returns `{ ok: true, status, eventId }`, a domain refusal, or `not_found`, `conflict` (someone changed it first) or `forbidden` (viewer). Unexpected database or network errors are thrown. `revise` reads the current version itself, so callers pass no version number.
  - **Adapters:** [web/infrastructure/supabase/index.ts](web/infrastructure/supabase/index.ts) calls the RPCs below and maps SQLSTATE `40001`, `P0002` and `42501` to those codes. [web/infrastructure/supabase/database.types.ts](web/infrastructure/supabase/database.types.ts) is generated with MCP `generate_typescript_types`; regenerate it after each migration.
  - **Clock:** the `Clock` port has `systemClock` and `fixedClock(d)` in [web/infrastructure/clock/index.ts](web/infrastructure/clock/index.ts). Nothing reads it yet; deal age will be its first reader.
  - **Layer rules:** ESLint keeps `application/` free of framework and database imports, keeps `infrastructure/` away from UI, and stops `app/`, `components/` and `lib/` importing adapters or `@supabase/*` (AD-014).
  - **Config:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `web/.env.local` (untracked); [web/.env.example](web/.env.example) lists them. A transition runs as the signed-in member.
  - Spec: [.specs/features/ports-adapters/](.specs/features/ports-adapters/).
- **Real data:** `/pipeline` reads the member's agreements through `PipelineReader` ([web/infrastructure/supabase/readers.ts](web/infrastructure/supabase/readers.ts)). A card shows the customer, `<number> · v<n>`, the age (whole days since `agreements.updated_at`, via `Clock`) and the annual amount of the latest version's service lines. Withdrawn agreements and voided contracts are off the board. The sample data is gone.
- **Card links:** each card opens `/agreements/[agreementId]` (agreement-builder). The board's "New agreement" button stays disabled; agreements start from a site.
- **Not built yet:** filters, drag-and-drop and the "Not viewed" pill (needs the portal).

### Events, outbox and n8n automation (M11, M12, M13)
**What it is:** the app owns all status, and n8n only automates emails, reminders and timing. Outbox events go to n8n signed with HMAC, and n8n calls back app endpoints with idempotency keys. n8n execution IDs are written back to the event log as audit evidence. Workflows W1–W6 are defined in [ROADMAP.md](ROADMAP.md#n8n-workflows). Customers never see or build workflows.
**What we built:** schema only.
- **`events`:** append-only for app users. Members read and writers insert. `update` and `delete` are revoked from `anon` and `authenticated`. The `n8n_execution_id` column is for the service role.
- **`outbox`:** `event_id unique`, so a retried dispatch cannot double-send. Status is `pending`, `sent` or `failed`, with `attempts` and `available_at`. All privileges are revoked from `anon` and `authenticated`, so only the service role (the dispatcher) can use it.
- **Write path:** `public.apply_agreement_transition` and `public.apply_contract_transition` in [supabase/migrations/20261023222239_transition_rpcs.sql](supabase/migrations/20261023222239_transition_rpcs.sql) update the status only if it still equals the expected one, insert the event (`actor_id = auth.uid()`, payload `{from, to, reason?, versionNo?}`), insert the next `agreement_versions` row on `agreement.revised` (copying the previous snapshot, not its service lines), and enqueue the outbox row, in one transaction. They run as the caller, so RLS applies, and only owner, admin and estimator may call them; `anon` cannot (AD-015, AD-017).
- **Outbox writer:** `private.enqueue_outbox(event_id)` is the only thing that inserts outbox rows. No trigger enqueues, so events such as `agreement.viewed` never reach n8n (AD-016).
- **Not yet:** the dispatcher that sends pending outbox rows to n8n (the `EventPublisher` port, HMAC) is Phase 3 with W1. Service-role callers (DocuSeal webhook, n8n expiry) get their own path in Phases 3-4. Workflows are Phases 3–4.
- **Tests:** [supabase/tests/transitions.sql](supabase/tests/transitions.sql).

### SaaS billing (M14)
**What it is:** Stripe subscription plans per tenant, with Checkout, Customer Portal, plan limits and idempotent webhooks. Plans and pricing are undecided.
**What we built:** nothing yet. Planned for Phase 5.

### Post-contract operations (M16)
**What it is:**
- Visit scheduling.
- Deficiency reports: problems found during a visit.
- Per-visit invoicing (QuickBooks sync).
- Annual CPI adjustment: the price rises with the Consumer Price Index, capped by the contract's CPI cap %.
- Renewals and cancellations.

**What we built:** nothing yet. Planned for Phase 6.

### Design system (M17)
**What it is:** the visual direction. The user chose the familiar SaaS category standard, benchmarked against Linear, Stripe Dashboard, Attio/HubSpot and Jobber/Housecall Pro.
**What we built:**
- **Tokens:** Tailwind 4 `@theme` role tokens in [web/app/globals.css](web/app/globals.css) are the only colour, radius and shadow values. The default palette is cleared (`--color-*: initial`), so components use `bg-ground`, `text-ink-2`, `bg-stage-sent`, `rounded-control` and so on (AD-002 in [.specs/STATE.md](.specs/STATE.md)). Slate Secondary was darkened from `#6b7280` to `#646b78` to hold 4.5:1 on Board Grey. Inter loads through `next/font` in [web/app/layout.tsx](web/app/layout.tsx).
- **Base components:**
  - [web/components/ui/](web/components/ui/): `Button` (primary and secondary), `SearchInput` and `StatusPill` (stage dot plus label, or the attention and neutral tones). Controls are 44px tall below 1024px and 34px on desktop.
  - [web/components/shell/](web/components/shell/): `AppShell` (232px sidebar on desktop, top bar and drawer below 1024px), `SidebarNav` (nav items without a page are `aria-disabled`) and `PageHeader`.
  - [web/components/kanban/](web/components/kanban/): `KanbanColumn`, `KanbanCard` and `PipelineView`.
- **Form controls:** `TextInput` and `Select` ([web/components/ui/select.tsx](web/components/ui/select.tsx)) share the label, 44/34px height and field-error contract; `EmptyPanel` is the shared empty state.
- **Design record:** [DESIGN.md](DESIGN.md) and [.impeccable/design.json](.impeccable/design.json) are regenerated from the code.
- **Spec:** [.specs/features/design-system-base/](.specs/features/design-system-base/).

---

## How to run the tests

- **Unit tests:** `npm test` in `web/` (Vitest, `*.test.ts` beside the code, AD-013). No network.
- **Database tests:** `npm run test:db [recipe...]` in `web/` runs [supabase/tests/](supabase/tests/) against the live project, one connection per recipe, every recipe rolled back ([web/scripts/test-db/runner.mts](web/scripts/test-db/runner.mts)). It needs `SUPABASE_DB_URL` (Supabase > Connect > Session pooler, with the database password) in `web/.env.local`. No argument runs all 15 recipes; exit 0 all passed, 1 a recipe failed, 2 setup error (unknown recipe, no URL, a test file in no recipe, or a recipe that would commit). A new test file must join a recipe in `RECIPES`; `SEED_BODY` stands for `seed.sql` without its `begin;`/`commit;` lines.
- **Web validation:** live, in a real browser through the Playwright MCP, as AGENTS..md describes (375, 768 and 1440 px, touch, console and network). Not committed.
- **Security advisors** (Supabase MCP `get_advisors`, type `security`) report two accepted findings, and any other finding is a bug:
  - `rls_enabled_no_policy` on `public.outbox`: on purpose. No user role may read or write the outbox; only `private.enqueue_outbox` writes it (AD-016).
  - `auth_leaked_password_protection`: staff sign in by magic link only, so no password is ever set or checked.

---

## Build log

Newest first. Use one line per completed change: date, what was done, and the key files.

- **2026-10-27:** Phase 3 item 2, Service included ([.specs/features/service-included/](.specs/features/service-included/)): "Service included" and "Equipment" sections on `/agreements/[agreementId]`, live from the site while editable and frozen into the version when it leaves draft; migration `service_included` (`site_service_scope`, `freeze_agreement_version`, members lose update on `agreement_versions`, backfill of the 10 non-editable demo versions, AD-058 to AD-062), `service_included` SQL recipe (`npm run test:db` now runs 16; `rls_roles` C12 no longer loops over `agreement_versions`, approved 2026-10-27).
- **2026-10-27:** Phase 3 item 1, agreement builder ([.specs/features/agreement-builder/](.specs/features/agreement-builder/)): `/agreements/[agreementId]` with service lines, totals and versions; "New agreement" on a site; pipeline cards and customer rows link to the agreement; migration `agreement_builder` (`create_agreement`, `AG-<n>` numbering unique per org, one live agreement per site, the `service_lines_frozen` trigger, revise copies the lines, AD-051 to AD-057), `agreement_builder` SQL recipe (`npm run test:db` now runs 15). Live check passed 2026-10-27 (C756: AG-1052 on Fernwood Dental at $3,870.00 a year, AG-1048 version 2); the run added line column headers and fixed two customer-page touch targets.

- **2026-10-27:** Phase 2 item 4, review extracted rows and add them to the site ([.specs/features/import-review/](.specs/features/import-review/)): review grid at `/imports/[jobId]`, row flags, spelling mapping, skip, migration `import_review` (`skipped` / `asset_id` on `import_rows`, `committed` on `import_jobs`, `commit_import`, the `import_rows_frozen` trigger, AD-045 to AD-050), `import_review` SQL recipe (`npm run test:db` now runs 14). Live check passed 2026-10-27 (C658: extract, flags, mapping, skip, commit on Brookhaven); the run fixed the mapping message, the phone commit button, a 768 px sideways scroll and "Already on this site" on committed rows.

- **2026-10-27:** Phase 2 item 3, extract equipment rows with Claude and match their types ([.specs/features/import-extract/](.specs/features/import-extract/)): `AssetExtractor` on the Claude API, `matchAssetType` and synonyms, migration `import_extract` (`import_rows`, cursor on `import_jobs`, `record_extraction_chunk`, `import_row_counts`, AD-038 to AD-044), "Extract equipment" on the import page, `import_extract` SQL recipe (`npm run test:db` now runs 13; table-inventory pins C35 and C19 now count 17). Live checks passed 2026-10-27 (C561 without a key, C562 against the real API with xlsx, docx and pdf and a resumed run); the run also fixed the progress label ("Extracting… 1 of 2").

- **2026-10-26:** Phase 2 item 2, read each uploaded file ([.specs/features/import-parse/](.specs/features/import-parse/)): `ImportParser` on SheetJS 0.20.3 and mammoth 1.13.0, migration `import_parse` (statuses `parsed` / `unreadable`, read columns, AD-035 to AD-037), "Read file" on the import page, `import_parse` SQL recipe (`npm run test:db` now runs 12).

- **2026-10-26:** Phase 2 item 1, upload to Storage and import jobs ([.specs/features/import-upload/](.specs/features/import-upload/)): migration `import_upload` (table `import_jobs`, private bucket `imports`, storage policies, AD-031 to AD-033), signed-URL upload (AD-034), `/sites/[siteId]/import`, `import_upload` SQL recipe (`npm run test:db` now runs 11; the earlier table-inventory pins C35 and C19 now count 16).

- **2026-10-26:** Phase 1 customer, site and asset forms built ([.specs/features/record-forms/](.specs/features/record-forms/)): eight form pages, ten Server Actions, per-entity store ports (AD-028 to AD-030), `record_forms` SQL recipe (`npm run test:db` now runs 10). Validated live as the demo owner at 375, 768 and 1440 px with touch.

- **2026-10-26:** Phase 1 items 5 and 8 done. Live sign-in as the demo owner works end to end (custom SMTP, demo seed with owner); `getContainer()` awaits `connection()` (AD-027) to stop the prerender clock error on every `(app)` page. New Phase 1 item: customer, site and asset forms.

- **2026-10-26:** Phase 1 validation: `npm run test:db` runs every SQL test file from a terminal, rolled back ([web/scripts/test-db/](web/scripts/test-db/), dev dependency `pg`); the two accepted security advisor findings are recorded ([.specs/features/phase1-validation/](.specs/features/phase1-validation/)).

- **2026-10-24:** Phase 1 item 6, the staff screens on real data ([.specs/features/staff-screens/](.specs/features/staff-screens/)).
  - `/pipeline` on real agreements; `/customers`, `/customers/[customerId]`, `/sites/[siteId]` (equipment register grouped by type) and `/settings`, each with loading, error and not-found states. Read ports `PipelineReader`, `CustomerDirectory`, `SiteRegister` and `OrgSettingsStore` (AD-023), flat URLs (AD-024), province codes (AD-025).
  - `Select`, `EmptyPanel`; `lib/sample-pipeline.ts` removed; `seed.sql` adds 12 demo agreements (earlier `demo_seed.sql` C17 now expects 12).
  - Known limits: lists are read-only; a user in several orgs sees all of them until an org switcher exists.

- **2026-10-23:** Phase 1 item 5, staff sign-in with a magic link and the `proxy.ts` session refresh ([.specs/features/auth-magic-link/](.specs/features/auth-magic-link/)).
  - `/login`, `GET /auth/confirm`, [web/proxy.ts](web/proxy.ts), the `AuthGateway` and `MemberDirectory` ports with Supabase adapters, and the `(app)` member gate with "No workspace yet" and Sign out.
  - `TextInput` with its field-error state ([web/components/ui/text-input.tsx](web/components/ui/text-input.tsx)) and the `--color-danger` token. `Select` stays with the settings form.
  - `supabase/seed.sql` attaches the demo owner from `app.demo_owner_email`; rolled-back test in [supabase/tests/demo_owner.sql](supabase/tests/demo_owner.sql).

- **2026-10-23:** Phase 1 item 4, ports, Supabase adapters and the composition root ([.specs/features/ports-adapters/](.specs/features/ports-adapters/)).
  - Migration `transition_rpcs`: one-transaction transition RPCs and the private outbox writer ([supabase/migrations/20261023222239_transition_rpcs.sql](supabase/migrations/20261023222239_transition_rpcs.sql)), applied to the live project. Rolled-back tests in [supabase/tests/transitions.sql](supabase/tests/transitions.sql).
  - `web/application` (ports, use cases), `web/infrastructure` (Supabase and clock adapters, generated DB types) and `web/composition` (`getContainer()`), with ESLint layer rules. Added `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7 and `server-only` 0.0.1, pinned exact.
  - `EventPublisher` now means the Phase 3 outbound dispatcher; the ROADMAP lines say so. The domain-layer purity test's control file moved from `lib/` to `composition/`, because `lib/` now forbids `@supabase/*`.

- **2026-10-23:** Phase 1 item 3, the pure domain layer ([.specs/features/domain-layer/](.specs/features/domain-layer/)).
  - Agreement and contract state machines, `pipelineStage`, and `Cents` money in [web/domain/](web/domain/). The stage keys moved there from `web/lib/pipeline-stage.ts`, which re-exports them.
  - Added Vitest (`vitest@5.0.3`, `npm test` in `web/`, config [web/vitest.config.mts](web/vitest.config.mts)), with tests beside the code. `@types/node` moved to `^24.19.1`, which Vitest 5 requires.
  - ESLint keeps `web/domain/**` free of Next, React, Supabase and UI imports ([web/eslint.config.mjs](web/eslint.config.mjs)).

- **2026-10-19:** Phase 1 item 2, the equipment catalog, task library and fictitious demo org ([.specs/features/catalog-seed/](.specs/features/catalog-seed/)).
  - Migration `catalog_template` adds the 40-type, 174-task template in `private`, `private.seed_org_catalog(org)`, and the upper-case code check on `asset_types` ([supabase/migrations/20261019191509_catalog_template.sql](supabase/migrations/20261019191509_catalog_template.sql)).
  - [supabase/seed.sql](supabase/seed.sql) creates the demo org `Kettle Ridge Mechanical Ltd.` with settings, the catalog and 12 customers with contacts, sites and assets. It has run on the live project.
  - Known gap: the seed proof ran after the real seed, so seeding an empty database is not yet proven. It gets proven the next time `seed.sql` runs on a fresh database.

- **2026-10-19:** Phase 1 item 1, the Supabase project and the init migration ([.specs/features/supabase-init/](.specs/features/supabase-init/)).
  - New project `service-agreement` (`gnxebrtcpbujhvcamtoe`, `ca-central-1`).
  - 15 tables, all with RLS, plus the `private` RLS helpers, in [supabase/migrations/20261019174738_init.sql](supabase/migrations/20261019174738_init.sql).
  - Rolled-back SQL tests in [supabase/tests/](supabase/tests/).

- **2026-10-19:** Phase 0.5 tokens and base components ([.specs/features/design-system-base/](.specs/features/design-system-base/)).
  - Added `@theme` role tokens, Inter, the app shell with a mobile drawer, `Button`, `SearchInput`, `StatusPill`, and the pipeline kanban on sample data at `/pipeline`. `/` now redirects to `/pipeline`.
  - Regenerated [DESIGN.md](DESIGN.md) from the code and added [.impeccable/design.json](.impeccable/design.json).
  - Removed the `create-next-app` page and its SVGs.
  - Merged the nested `web/` repo into this repo with its history, and stopped tracking `.playwright-mcp/` captures (now in `.gitignore`).

- **2026-10-16:** Added this file and the rule in `AGENTS..md` and `ROADMAP.md` that every change keeps it up to date.
- **2026-10-16:** Phase 0.5 design work. Wrote [PRODUCT.md](PRODUCT.md). Created the visual direction variants in [.impeccable/mocks/decision/](.impeccable/mocks/decision/); the chosen one is `canon.html`. Wrote the seed [DESIGN.md](DESIGN.md).
- **Project start:** scaffolded Next.js 16 / React 19 / Tailwind 4 in [web/](web/). `web/` started as its own nested git repo; on 2026-10-19 it was merged into this repo with its history, so it is ordinary files here.
