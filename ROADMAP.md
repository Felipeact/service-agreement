# Roadmap: Service Agreement micro-SaaS

A multi-tenant SaaS for trades and service businesses that maintain things on a recurring schedule. HVAC and mechanical contractors are the first trade; plumbing, electrical and others follow (see [Trades and packs](#trades-and-packs)). It imports a customer's list of equipment (or other serviced items), builds a recurring service agreement for review, tracks it until the customer accepts or refuses it, then turns the accepted agreement into a contract for e-signature. n8n automates the steps in between.

Tenant branding (legal name, address, phone, logo, terms) comes from each tenant's settings. No company name is hard-coded, and seed or demo data uses a fictitious company.

## Product overview

The working name is "Service Agreement" (the brand is undecided). This section says what the product is, who buys it, how a deal moves, how signing works and what it costs. It describes the plan, not what is shipped; the phases below say what is built. There are no customers, testimonials or measured results yet, so none are claimed here.

### What it is

A web app that takes a trade contractor from a customer's list of equipment to a signed recurring service contract. The office imports the list, reviews a priced agreement built from it, sends it, follows it up and, once the customer accepts, sends the contract for signature. Reminders and emails run on their own.

### Who it is for

- **Buyer and daily user:** the owner, estimator or office manager of a small or mid-sized trade contractor that services things on a schedule. HVAC and mechanical first; plumbing, electrical and others follow (see [Trades and packs](#trades-and-packs)).
- **Not for:** large field-service suites (dispatch, GPS, payroll), or project and construction contracts (decision 1).
- **Customer side:** the facility or property manager. No account, no app to learn; they get a link.

### How a deal moves

| Step | What happens | Who |
|---|---|---|
| 1. Import | Upload the customer's Excel, CSV, Word or PDF. Claude extracts the rows, the app maps them to the tenant's equipment types, and the estimator fixes doubts in a review grid | Estimator |
| 2. Build | Price lines (visits per year × cost per visit), visit months on a 12-month grid, "Service included" built from the types on site, term dates, default terms | Estimator |
| 3. Send | A branded PDF and a review link are emailed. Reminders go out on day 3 and day 7 unless the customer has viewed or decided | Automatic (n8n) |
| 4. Decide | The customer views, downloads, accepts, refuses (reason required) or requests changes. A change request opens a new version | Customer |
| 5. Sign | The accepted version becomes a contract. The customer signs, then the contractor countersigns | Customer, owner |
| 6. Renew | Near the end of the term, a low-CPI contract renews on its own with the increase applied; a high-CPI one becomes a renewal draft for staff | Automatic, staff |

Throughout, the pipeline shows every deal by stage and age, so nothing sits unnoticed.

### What the customer sees

Everything customer-facing carries the contractor's name, logo and accent colour: the review page, the PDFs, the emails and the signing page. The product's own name does not appear. The customer needs no account and uses a magic link.

### E-signature

- **Flow:** staff send a pending contract for signature. The customer signs on a branded `/sign/<token>` page with the signing form embedded. An owner or admin then countersigns inside the contract page. The status moves to `completed` only when both have signed.
- **Provider:** DocuSeal through the API, behind `SignatureProvider`, so the provider can change without touching the app. Our database holds the contract wording and the status; DocuSeal places the signature and date fields (decision 16).
- **Evidence:** the signed PDF and the audit log (who, when, from where) are stored with the contract, and each automated action is written to the event log. The DocuSeal webhook, signed PDF storage and audit log are still open in Phase 4.
- **Legal:** at launch the product targets Canada outside Quebec, where e-signature law follows the UECA model. Each tenant owns its contract wording and confirms validity under its province. Starter wording is reviewed by a lawyer before go-live (decision 14).
- **Cost to us:** DocuSeal's API needs a Pro seat (US$20 a month, or US$200 a year) plus US$0.20 per completed document. A document signed by several parties counts once, and the sandbox is free.

### Pricing (draft)

Price points are **not decided** (decision 10, needs you). The table is a starting proposal to test with the pilot contractor, in CAD.

| Plan | Per month | Live agreements | AI imports a month | Seats included |
|---|---|---|---|---|
| Starter | $49 | 15 | 10 | 2 |
| Team | $99 | 60 | 40 | 5 |
| Business | $199 | 200 | 120 | 10 |

- **Axis:** plans limit volume and include some seats; every seat beyond that is $15 a month in CAD, one price for all plans (draft, decisions 10 and 20 as amended 2026-11-09). Features, templates and reports are the same on every plan. What counts as a "live agreement" is defined in Phase 5.
- **Trial and billing:** 14 days free with the card collected up front, then monthly. An annual option at two months free is worth testing. Stripe handles Checkout, the Customer Portal and failed-payment retries.
- **Cost floor per tenant (third-party figures, unchecked against Stripe's own page):** Stripe takes about 2.9% + C$0.30 per card payment, and Stripe Billing adds about 0.7% on US pricing. On a $99 plan that is about $4 a month. Each completed signature costs about US$0.20. Claude extraction is the cost to measure: record tokens per import job in the first pilot and size the allowances with the `ai-pricing` skill before fixing numbers.
- **Where it sits:** the market anchors below are third-party reports that disagree with each other; check each vendor's page before quoting them.

| Product | Reported price | Note |
|---|---|---|
| Jobber | About US$49 to US$199 a month for Core, Connect and Grow | Field-service suite for home-service trades |
| Housecall Pro | About US$59 to US$299 a month on annual billing, 1 to 8 users included | Charges for extra users; 14-day trial |
| ServiceTitan | About US$250 to US$500 a technician a month, plus setup | Quote-only; built for large shops |

Our position is a single-job tool priced below the suites, with a few seats included and a flat fee for each extra one. It does not replace a field-service suite; it feeds one later (Phase 6).

### Not in the product

Dispatch and GPS, payroll, project or construction contracts, a Word-style document editor, and any per-estimator ranking (decision 18). Quebec is a later, separate item.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Web app | Next.js 16 (App Router), React 19, Tailwind 4 | Already scaffolded in `web/` |
| Data, auth, files | Supabase (Postgres + RLS, Auth, Storage) | Shared schema, `org_id` on every row, isolation enforced by RLS |
| Automation | n8n, self-hosted on Railway (Postgres-backed) | The app owns state; n8n owns emails, reminders and timing. Customers never see or build workflows |
| E-signature | DocuSeal API, behind `SignatureProvider` | Free sandbox, about $0.20 per completed document, `form.completed` webhook, React embed. DocuSeal places signature and date fields only; template content lives in our database (see [Document templates](#document-templates)). Its embedded template builder is a Pro feature and is not used |
| Document extraction | Claude API (PDF input + structured outputs), behind `AssetExtractor` | Handles messy tables; JSON-schema output |
| PDF generation | `@react-pdf/renderer`, behind `DocumentRenderer` | Serverless-friendly, no headless Chrome |
| Email | Resend, domain `felipeviana.com` | Transactional email |
| SaaS billing | Stripe (subscriptions, Checkout, Customer Portal) | Idempotent webhook handling |
| Design workflow | Impeccable skill (`/impeccable init`, `shape`, `document`) | Product context, variant directions, and a DESIGN.md generated from the chosen direction |

## Modules

| # | Module | Scope | Phase |
|---|---|---|---|
| M1 | Tenancy & access | Orgs, members, roles (owner, admin, estimator, viewer), magic-link auth, RLS | 1 |
| M2 | Company profile & branding | Legal name, address, phone, logo, accent colour. Default terms: repair discount %, CPI cap %, cancellation notice days, payment days, governing province, tax note. Renewal terms: default term months, renewal notice days (30), CPI renegotiation threshold % (5) | 1, 3.5 |
| M3 | Customers, contacts, sites | Client company, designated site contact (their email approval counts as written approval), site addresses. Contact roles (site, billing, approver). Deactivating sites and customers | 1, 3.5 |
| M4 | Asset register | Assets per site: asset type, unit #, type/model, location/access, source (manual or import). Deactivating assets and linking a replacement to the unit it replaces. Photos and attachments | 1, 3.5 |
| M5 | Asset import | Upload Excel, CSV, Word or PDF, extract, normalize types, review, commit | 2 |
| M6 | Maintenance task library | About 40 equipment types with checklists, editable per tenant and snapshotted into each agreement version. Default visit months per equipment type, and seasonal tasks that apply only to some visits. Adding, renaming and removing types | 1 (seed), 3.5, 4.5 **The `/task-library` screen was removed on 2026-11-10 at the owner's request; the data and readers stay, and nothing edits a type in the app now.** |
| M7 | Agreement builder | Visit frequency, service price lines (visits/yr × cost/visit), "Service included" built from the asset types on site, equipment list by type, versions. Each line covers equipment types and has its own visit months. Term dates, version comparison and history | 3, 3.5 |
| M8 | Document generation | Tenant-branded agreement and contract PDFs | 3 |
| M9 | Customer review portal | Magic link with no customer account. The customer can view, download, Accept, Refuse (reason required) or Request changes. Records when it was viewed | 3 |
| M10 | Contract & e-signature | Contract built from the accepted version, client signs then the tenant countersigns, signed PDF and audit log stored | 4 |
| M11 | Status engine & pipeline | Pure state machine. Every transition writes an event and an outbox row. Dashboard by status and age. Pipeline cards by site, with $ totals per stage and an "Expiring soon" view | 1, 3.5 |
| M12 | Automation (n8n) | Outbox events go to n8n (HMAC-signed). n8n calls back app endpoints with idempotency keys | 3–4 |
| M13 | Email | Portal links, reminders, signed copies | 3 |
| M14 | SaaS billing & onboarding | Public pricing page, Stripe plans per tenant, plan limits, workspace provisioning from the Stripe webhook, setup screen on first login | 5 |
| M15 | Audit, files, security | Org-scoped storage, event log, portal rate limits, Supabase advisors clean | 1+ |
| M16 | Post-contract operations | Visit schedule, deficiency reports, per-visit invoicing, annual CPI adjustment, renewals and cancellations, mid-term amendments, billing schedule | 6 |
| M17 | Design system & UX | PRODUCT.md, variant mockups (three directions plus the category standard), the chosen direction recorded in DESIGN.md and `.impeccable/design.json`, tokens and components | 0.5 |
| M18 | Trades, packs & vocabulary | Starter packs per trade (types, checklists, default months, synonyms, extraction context), a per-org label for the serviced item ("Equipment", "Areas", "Stations"), per-org synonyms, catalog drafted by Claude for other trades | 4.5, 5 |
| M19 | Document templates | Tenant-owned agreement and contract templates built from text blocks with merge variables and fixed system blocks, versioned and frozen into each agreement and contract | 5.5 |
| M21 | Public site | Marketing front door at `/`: home, product, demo, trades, pricing, about, FAQ, contact and register. Sample-data visuals, no invented proof. Sign-in is a link | 5 |
| M20 | Reporting | Tenant reports from `events` and agreements: recurring revenue, funnel, win rate, aging, loss reasons, renewals, revenue breakdown, CSV export | 5.6 |

## Status model

The **agreement** (the proposal for review) moves through these states:
- `draft` is shown as "In progress".
- `draft` → `sent` ("Sent to customer").
- `sent` → `accepted`, `refused` or `changes_requested`.
- `changes_requested` → `draft` as a new version.
- `sent` → `expired`.
- `draft` or `sent` → `withdrawn`.

The **contract** (sent for signature) moves through these states:
- `pending_signature` → `client_signed` → `completed` ("Completed", meaning both parties signed).
- `pending_signature` or `client_signed` → `declined` or `voided`.

The pipeline shows one stage for each deal: **In progress → Sent to customer → Accepted (awaiting signature) → Completed**, with **Refused** as the exit. Each card is titled with the site, with the customer underneath, since an agreement belongs to one site.

## Cadence

Visit months are set per site and per type of service. HVAC can be serviced in March, June, September and December while the boiler at the same site is serviced in October only.
- A service line covers one or more equipment types (for example "HVAC maintenance" covers RTU, AHU and split units) and holds its own visit months. The number of months is its visits per year.
- The builder picks months on a 12-month grid, with presets: quarterly, semi-annual (spring and fall) and monthly.
- Each equipment type in the task library has default months that prefill a new line.
- A checklist task can apply to some visits only, for example the cooling start-up in spring and the heating start-up in fall.
- The PDF and the portal show a visit schedule: each month and the equipment serviced in it.
- **Limit:** cadence is a 12-month grid, so it cannot say "every week" or "every other week". Trades that work weekly (janitorial, landscaping, pest control) need a second cadence kind. That waits for a first customer who needs it (Phase 6).

## Term and renewal

A contract has a start date and a term (12 months by default), from which its end date follows. It renews by default:
- **CPI below the renegotiation threshold (5% by default, a tenant setting):** the contract renews for another term with the CPI increase applied, never above the CPI cap. The customer is notified 30 days before the end date. Nobody signs again.
- **CPI at or above the threshold:** the contract does not renew on its own. 30 days before the end date the app creates a renewal draft and flags it for staff. Staff negotiate, and the customer signs a new agreement.

A renewal is a new agreement linked to the one it renews (AG-1012 renews AG-1004), not another version of it, so each contract term keeps its own history. Until Phase 4 ships, the term runs on the accepted agreement and moves to the contract once there is one.

## Deactivation

Sites, customers and assets are deactivated, never deleted, so their history and past agreements stay readable.
- Inactive records are hidden from lists by default, with a "Show inactive" filter. An inactive site cannot start a new agreement.
- Deactivating a site withdraws its draft or sent agreement. A site with a live contract cannot be deactivated until the contract is cancelled, with the cancellation notice days applied.
- Deactivating a customer deactivates all of their sites.
- A removed asset can be linked to the unit that replaces it.

## Asset import pipeline

1. **Upload:** xlsx, csv, docx or pdf goes to Supabase Storage, and an `import_jobs` row is created.
2. **Parse by format:**
   - xlsx/csv: SheetJS rows plus a header heuristic.
   - docx: `mammoth` converts it to text.
   - pdf: sent straight to Claude as PDF input.
3. **Extract:** a Claude structured output returns `{asset_type_raw, unit_no, type_model, location, confidence, source_ref}` for each row.
4. **Normalize:** a synonym table maps each type to the catalog, for example "Rooftop unit" → RTU and "MAU" → MUA. Types that don't match are flagged.
5. **Review grid:** edit rows, merge duplicates, map unknown types.
6. **Commit:** rows are written to `assets`, and the job keeps a record of each row.

## n8n workflows

The app is the source of truth for status. DocuSeal webhooks go to the app, not to n8n. n8n execution IDs are written back to the event log as audit evidence.

| ID | Trigger | Action |
|---|---|---|
| W1 | `agreement.sent` | Email the portal link. Remind on day 3 and day 7 unless the agreement is viewed or decided |
| W2 | `agreement.accepted` | Call the app to generate the contract and send it for signature. Notify the owner |
| W3 | `agreement.refused` / `changes_requested` | Notify the estimator with the reason |
| W4 | `contract.completed` | Email the signed PDF to both parties. Notify internally |
| W5 | Daily cron | Remind on stale items: unviewed after 7 days, unsigned after 5 days |
| W6 | Contract anniversary | Propose the annual CPI adjustment, capped by the contract (Phase 6) |
| W7 | Daily cron, 30 days before a term ends | CPI below the threshold: notify the customer of the auto-renewal and the new price. At or above it: create the renewal draft and notify staff (Phase 3.5) |
| W8 | Daily cron | Expire sent agreements past their validity date (`sent` → `expired`) and notify the estimator (Phase 3.5) |

## Trades and packs

The product's shape is **a serviced item, a checklist for it, and a cadence**. "Equipment" is the HVAC name for the item; the same model fits areas (janitorial), zones (landscaping), stations (pest control) and pools. The schema is already neutral: `asset_types`, `asset_type_tasks` and `default_visit_months` are per-org tables. What is HVAC today is the content (the 40-type catalog), the synonym table in code, the extraction prompt, and some copy.

- **Boundary:** recurring service on a site with a list of things, a checklist and a cadence. Project work (construction) and one-off contracts are a non-goal, because they need a different scope model (milestones, change orders, progress billing, holdbacks).
- **Pack:** data, not code. It holds asset types with checklists and default visit months, a synonym list, a one-line trade context for the extraction prompt, and a starter agreement and contract template. `private.seed_org_catalog(org, pack)` copies a pack into an org; from then on the org owns its copy.
- **Starter packs:** HVAC (the existing catalog), plumbing and electrical first. Safety-critical trades (fire, elevators) need a practitioner to review the pack before it ships.
- **Several trades per tenant:** allowed. Types are per-org rows, so picking two packs seeds both. The vocabulary comes from the first.
- **Other trades:** the tenant describes the trade, or uploads their current proposal, and Claude drafts a catalog (types, checklists, default months) that the tenant reviews. Drafts take too long for a webhook, so they run from the setup screen.
- **Vocabulary:** one per-org label for the serviced item drives the UI, PDFs and portal. No per-trade wording beyond that.
- **Per-org synonyms:** the synonym table moves from code (`SYNONYMS` in `web/domain/imports`) to data, per pack and per org. The extraction prompt takes the trade's context instead of the fixed "HVAC and mechanical" sentence.
- **Geography:** Canada outside Quebec at launch. Quebec has its own e-signature framework and language rules; add it as a separate item with counsel.
- **Cleanup:** HVAC wording in `app/layout.tsx`, PRODUCT.md and the demo seed becomes trade-neutral where it describes the product rather than the demo tenant.

## Onboarding

Public site, then register (trades and plan), then Stripe, then a ready workspace on first login:

1. The public site (`/`) leads to `/pricing`, which shows plans only. A plan button opens `/register?plan=<key>`, where the visitor picks their trade (one or more, or "Other") and confirms the plan before Checkout, which starts a 14-day trial with the card collected up front. The trade rides on the Checkout session as metadata, and the Checkout email is the owner's identity.
2. The Stripe webhook (`checkout.session.completed`, idempotent on the event id) provisions the workspace in one transaction: the org and its `org_settings`, the seeded catalog for the chosen trades, the vocabulary, the Stripe customer and subscription ids, and an owner invitation for the Checkout email. For "Other" it creates an empty catalog with a flag.
3. Sign-in reuses the invitation flow (`/auth/confirm`, `accept_invitations`, the Before User Created hook). Provisioning runs as the service role, so it may create an org with an owner invitation, which the members page does not do.
4. The first login opens a short setup screen: legal name, province, accent colour, logo, a review of the starter catalog ("We set up 38 plumbing items"), a preview of the starter templates, and for "Other" the Claude draft with a review step.

Edge cases to design for: payment succeeded but the webhook is late (the success page polls, and "No workspace yet" says "Setting up your workspace"); a retried or duplicate webhook does nothing twice; a returning email that already belongs to an org (refused with a clear message, since there is no org switcher; decision 9); a wrong trade choice (settings can add or remove packs later without re-seeding existing types). The Supabase Auth SMTP sender must be on the verified Resend domain before launch, or invitations reach only the account owner.

## Document templates

Agreement and contract wording becomes tenant-owned data. Today `contractClauses()` returns six hard-coded sentences, and the legal review of them blocks go-live.

- **Where it lives:** in our database, not in DocuSeal. A template stored in DocuSeal would sit outside the version snapshot, so we could not show which text a signed contract carried. DocuSeal keeps one job: the signature and date fields, drawn by the renderer as text tags.
- **Blocks:** an ordered list. Text blocks (heading, paragraph, clause list) use merge variables from a fixed whitelist, such as `{{customer.name}}`, `{{term.start}}`, `{{terms.paymentDays}}`, `{{province}}` and `{{tenant.legalName}}`. System blocks (price lines, visit schedule, "Service included", equipment list, signatures) the tenant can move or hide, except the price table and the signature block, which stay.
- **Two kinds:** an agreement template (cover and intro text, which sections show, footer terms) and a contract template (clauses, then the fixed signature block).
- **Versioning:** a template edit makes a new immutable template version. A sent agreement or generated contract records the template version it used, as scope and terms freeze today. Editing a template never changes anything already sent.
- **Editor:** a block editor with a live preview that renders the same PDF. Not a Word-style editor, and no DOCX upload.
- **Seam:** `buildAgreementDocument` and `buildContractDocument` already feed the agreement PDF, the portal and the contract PDF. Blocks replace the `clauses: string[]` field there.
- **Safety:** variables come from the fixed list only, rendering takes plain strings, and the editor states that the tenant owns their wording and that e-signature validity under provincial law is theirs to confirm.
- **Later:** "upload your existing contract" lets Claude split it into clauses and variables for the tenant to review.

## Reporting

Tenant reports for the contractor's owner and office, read from data that already exists (`events`, agreements, versions, lines). Read-only SQL functions or views with `security invoker`, so RLS isolates tenants, as `search_records` does. No separate warehouse. Dates use America/Vancouver, and a deal counts under the date of the event being measured (sent, decided, signed).

- **Headline:** recurring revenue (annual totals of agreements in term), pipeline value, win rate, average days to sign.
- **Funnel:** created, sent, accepted, signed, with counts, value and drop-off.
- **Aging and speed:** median time per stage and the oldest stuck items.
- **Losses:** refused, expired and withdrawn grouped by reason, each linking to its agreement.
- **Renewals:** contracts ending in 30, 60 and 90 days, with value and type (auto or needs negotiation).
- **Revenue breakdown:** by customer and by serviced-item type, filterable by date range.
- **CSV export** on every table, and a useful empty state for a new tenant.
- **Rules:** win rate is per agreement, not per version. Automatic renewals (W7) are accepted without a customer decision, so they are excluded from win rate and shown separately.
- **Access:** owners and admins see money; estimators see operational reports; viewers see none (decision 17). No per-estimator ranking in v1.
- **Not here:** the product's own SaaS metrics (MRR, churn, signups by trade). Stripe and product analytics cover those; onboarding only has to store the trade on the org.
- **Later (Phase 6):** visit workload per month and invoicing reports, once visit data exists.

## Phases

When you complete a roadmap item, mark it done here **and** update `CONTEXT.md` with what was built (see `AGENTS..md`).

### Phase 0.5: Design system & UX (M17)
- [x] PRODUCT.md: users, positioning, constraints and principles (`/impeccable init`)
- [x] Visual direction variants with a kanban pipeline: Pipe Marker, Equipment Schedule, Departures Board and the category standard (`.impeccable/mocks/decision/`)
- [x] Chosen direction (category standard, benchmarked against Linear, Stripe Dashboard, Attio/HubSpot and Jobber/Housecall Pro) recorded as a seed DESIGN.md, plus the Pipeline surface brief
- [x] Tokens and base components (sidebar, page header, buttons, search input, status pill, kanban column and card) implemented in `web/`. Text input, select and the field error state moved to Phase 1
- [x] DESIGN.md regenerated from code with real tokens, and `.impeccable/design.json` written (`/impeccable document`)

### Phase 1: Foundation
- [x] Supabase project and `0001_init` migration (orgs, memberships, settings, customers, contacts, sites, asset types/tasks, assets, agreements, service lines, contracts, events, outbox) with RLS on every table
- [x] Seed the equipment-type catalog and task library from the proposal template, with a fictitious demo org
- [x] Pure domain layer: agreement and contract state machines, pipeline stage, money in integer cents
- [x] Ports (repositories, `Clock`) and Supabase adapters, plus a composition root. Each transition writes its status, event and outbox row in one transaction; the outbound `EventPublisher` (outbox to n8n) moved to Phase 3 with W1
- [x] Auth (magic link) and the `proxy.ts` session refresh (proven live 2026-10-26: emailed link, demo owner, sign out; custom SMTP via Resend)
- [x] Screens built to DESIGN.md: dashboard, customers, customer detail, site asset register, company settings
- [x] Form control `Select`, built with the company settings form (`TextInput` and the field error state shipped with auth)
- [x] Vitest unit tests, RLS isolation check, Playwright validation: `npm test`, `npm run test:db` (every SQL test, rolled back), security advisors clean apart from two accepted findings, and the signed-in journey validated live at 1440 and 375 px
- [x] Customer, site and asset forms: staff add and edit customers, contacts, sites and assets by hand (M3, M4 `source: manual`)

### Phase 2: Asset import
- [x] Upload to Storage and import jobs
- [x] xlsx/csv, docx and pdf parsers behind `ImportParser`, whose output `AssetExtractor` consumes
- [x] Claude structured extraction and type normalization
- [x] Review grid and commit

### Phase 3: Agreement & customer review
- [x] Agreement builder with versions and service price lines
- [x] "Service included" generated from the asset types on site
- [x] Agreement PDF
- [x] Customer review portal (Accept, Refuse, Request changes), with the staff Send action and the terms frozen at send. Live halves of four checks accepted as an author-side run (2026-10-28)
- [x] Outbox dispatcher (the database dispatches the outbox to n8n, HMAC-signed), n8n W1, W3 and W5, plus transactional email. Live run 2026-10-30: n8n and the app on Railway, link email delivered through Resend (inbox confirmed)

### Phase 3.5: Cadence, terms, renewals and missing pages
- [x] Pipeline cards by site, with the customer underneath; search matches either. $ total per stage in the column header
- [x] Cadence: service lines cover equipment types and hold visit months; month grid and presets in the builder; default months per equipment type; visit schedule on the PDF and the portal
- [x] Seasonal tasks: a checklist task can apply to selected visits only
- [x] Term dates (start, term months, end) and tenant renewal settings (default term, notice days, CPI renegotiation threshold)
- [x] Renewal: auto-renew with CPI applied below the threshold; at or above it, a renewal draft linked to the agreement it renews. "Expiring soon" view and n8n W7
- [x] Proposal validity date and automatic expiry of sent agreements (n8n W8)
- [x] Deactivate sites, customers and assets, with the live-agreement and live-contract rules; asset replacement link
- [x] Versioning: compare two versions (lines, prices, months, equipment, annual total change); the reason for each version (the customer's change request or a staff note); who created it and its sent, viewed and decided history from `events`; mark the version that was sent and the one accepted
- [x] Agreements page: list with filters (status, site, expiring); enable the New agreement button on Pipeline
- [x] Sites & equipment page: every site across customers
- [x] Imports page: import job history
- [x] Task library page: view and edit checklists and default months per equipment type
- [x] Contact roles: site, billing and approver
- [x] Agreement activity timeline from `events`
- [x] Members page: invite and set roles (owner, admin, estimator, viewer). Live halves accepted as owner-run (2026-11-05); Verifier round 1 failed on test gaps that were closed, round 2 not run
- [x] Global search across customers, sites and unit numbers

### Phase 4: Contract & e-signature
- [x] Contract generated from the accepted agreement version
- [x] `SignatureProvider` with a DocuSeal adapter and embedded signing. Staff send a pending contract for signature; the customer signs on a tenant-branded `/sign/<token>` page; the owner or admin countersigns inside the contract page. The status still moves only with item 3's webhook. Live run 2026-11-06 on the demo (sandbox key); countersigning is proven with the fake provider until item 3
- [x] Verified DocuSeal webhook, storage of the signed PDF and audit log. Built 2026-11-07 (`POST /api/webhooks/docuseal`, `contract_signed_documents`, AD-148, AD-149). Live run 2026-11-08 passed on production; it found that this DocuSeal account sends `combined_document_url: null` (signed PDF in `documents[0].url`), fixed by migration `20261108210000`. Verifier round 1 failed on one test gap (closed by C1822); two non-blocking SQL gaps stay open (a `completed` request receiving `form.declined`/`form.completed`; `anon` write refusal on `contract_signed_documents`)
- [x] n8n W2 and W4 (`.specs/features/contract-automation/`, AD-150 to AD-153): W2 makes the contract on accept and tells the owners, emails the customer's signer the signing link on Send; W4 emails both signers the signed PDF and audit log. Verifier round 4 PASS (42 of 42 checks), live run 2026-11-08 on production (migrations `20261108100000`, `20261108210000`, `20261108220000` applied; workflows imported and active in n8n)

### Phase 4.5: Multi-trade catalog (M18, M6)
- [x] Add, rename and remove equipment types in the task library, and reset a type to its pack. A new type gets a code made from its name, and the code never changes after that (frozen snapshots, `?type=` links and import matching all key on it); a rename changes the name only. Names are unique per org, ignoring case. A type can be removed only while no asset, service line or import row uses it
- [x] `seed_org_catalog(org, pack)`: the catalog template tables gain a pack, and the current 40-type catalog becomes the `hvac` pack. Each org type records the pack it came from, so "reset to pack" knows which template row to restore (null for a type made by hand). The one-argument call keeps working and defaults to `hvac`
- [x] Per-org vocabulary for the serviced item, used by the UI, PDFs and portal. Owners and admins set a singular and a plural in Company settings (default "equipment"); the staff screens, the agreement and contract PDFs and the customer review page say them (`.specs/features/item-vocabulary/`, AD-157 to AD-159, migration `20261109140000`). Verifier rounds 1 to 3 failed on test gaps that were closed; three rounds ended with two dialog wiring gaps the owner accepted (2026-11-09)
- [x] Synonyms as data (per pack and per org) and a trade context in the extraction prompt. Each type holds its own spellings (pack template and org copy); packs are registered with a trade phrase; `org_settings.trade_context` feeds the extraction prompt; `SYNONYMS` is gone (`.specs/features/synonyms-as-data/`, AD-160 to AD-162, migration `20261109154806`). Applied 2026-11-09 with the owner's go-ahead. Verifier round 1 and 2 failed on test gaps that were closed and on C2127's claim text, which the owner corrected; round 3 PASS (27 of 27 checks). No screen edits spellings or the trade context yet
- [x] Plumbing and electrical starter packs, reviewed by a practitioner. Drafted and built 2026-11-09 (`.specs/features/starter-packs/`, AD-163 to AD-165, migration `20261109163948`): 20 types each in the template behind a release gate (`seed_org_catalog` refuses a pack with no release time). Released 2026-11-09 (migration `20261109171002`). Reviewed by the owner, Felipe Viana, on 2026-11-09 from `private.pack_review_sheet`, with no corrections; the owner took the practitioner's role for now, so a review by a plumber and an electrician stays welcome and any change lands as its own migration
- [x] Trade-neutral product copy (`app/layout.tsx`, PRODUCT.md). The root layout description, the sign-in page and the Pipeline subtitle name no trade, and PRODUCT.md, DESIGN.md and CONTEXT.md lose the HVAC-only wording (`.specs/features/trade-neutral-copy/`, no migration). The sign-in `RooftopScene` drawing is unchanged. Verifier round 1 PASS (16 of 16, 5 faults killed), 2026-11-09

### Phase 5: SaaS billing & onboarding (M14)
- [x] Public `/pricing` page with plan and trade selection. Built 2026-11-09 (`.specs/features/pricing-page/`, AD-166, no migration): three draft plans in CAD, four trades, one start-trial button per plan; the choice goes through `makeStartTrial` to the `CheckoutStarter` port, whose only starter answers `not_configured` until the Stripe item. Verifier round 1 failed on a surviving mutant on the port, a Test policy gap and an overstated `303` row; round 2 PASS (36 of 36, 5 faults injected and killed). Linked from the public site since 2026-11-09 (trades moved to `/register`); the price points (decision 10) are still drafts
- [x] Public site as the front door (M21): `/` home, `/product`, `/demo`, `/trades`, `/about`, `/faq`, `/contact`, with Sign in as a link. Built 2026-11-09 (AD-167, no migration), with three home-page concepts under `/concepts/a|b|c` to choose from (the owner deletes two). Sample-data visuals only; `SITE.contactEmail` and `DEMO_VIDEO_URL` in `web/components/site/content.ts` are yours to confirm and fill
- [x] Trades chosen at `/register`, not on `/pricing`: `/pricing` is plans only and each plan links to `/register?plan=<key>`; `/register` takes the trades and the plan, then the same `makeStartTrial` hand-off. Built 2026-11-09 (AD-167)
- [ ] Record the demo video and set `DEMO_VIDEO_URL` (the `/demo` page shows a "coming soon" panel until then)
- [x] Stripe Checkout with a 14-day trial, card collected up front, and the signed, idempotent webhook ledger (`.specs/features/billing-checkout/`, AD-168 to AD-171, migration `20261109190000`). Built 2026-11-09 against a fake `fetch` and rolled-back SQL; the live run in Stripe test mode and applying the migration wait for the owner. Go-live blockers: the Stripe webhook endpoint and its secret in Vault, and do not set `STRIPE_SECRET_KEY` in production until provisioning ships
- [x] Stripe Customer Portal, and the rule that cancels a subscription when payment fails after the trial (a Stripe dashboard setting the owner makes; the session already asks for a card up front and cancels a trial with none). The portal needs the Stripe customer id that provisioning stores on the org Portal half built 2026-11-10 (`.specs/features/billing-portal/`, AD-177, no migration): a Billing section on `/settings` opens Stripe's portal for the member's own org. Still open, and yours: save the Customer portal configuration in the Stripe dashboard (test, then live) and set the cancel-on-failed-payment rule; the live Stripe run waits for your test keys Replaced on 2026-11-10 by an in-app billing page at `/settings/billing` (`.specs/features/billing-page/`, AD-178, no migration): plan, status, next date, card and invoices read live from Stripe; update the card (Stripe's embedded field), cancel at period end and resume, all inside the product. The owner set the cancel-on-failed-payment rule in the Stripe dashboard. Go-live: in the Stripe Dashboard turn off every payment method except Cards (test and live) and set `STRIPE_PUBLISHABLE_KEY` in each environment
- [x] Workspace provisioning from the webhook: org, settings, seeded packs, the chosen trades stored on the org (`org_billing`), Stripe ids, owner invitation, and the owner's sign-in link (`.specs/features/workspace-provisioning/`, AD-173 to AD-175, migration `20261110100000`). Built 2026-11-10 on rolled-back SQL and fakes; migration applied by the owner on 2026-11-10, the live test-mode run waits for the owner. Vocabulary stays the default "equipment" (packs carry no word for it). Go-live blockers: the Auth SMTP sender below, and Stripe's own dashboard rules. Refusals (`email_in_use`, `invalid_metadata`) are only a code on the stored event for now: no alert, no refund flow
- [x] First-login setup screen, company profile and catalog review (`.specs/features/first-login-setup/`, AD-176, migration `20261110110000`). Built 2026-11-10 on rolled-back SQL and fakes; the migration was applied 2026-11-10 and the live browser pass was run 2026-11-10 (two defects found and fixed). An owner or admin of a freshly paid org lands on `/setup` once from Pipeline; Skip for now is allowed
- [ ] Setup screen: logo upload (needs a Storage bucket for logos) and the starter template preview (needs Phase 5.5 templates)
- [ ] "Other" trade: Claude drafts a catalog from a description or an uploaded proposal, with a tenant review step
- [ ] "Setting up your workspace" state while a paid org is pending
- [ ] Checkout refuses an email that already belongs to an org, with a clear message
- [ ] Change plan from the billing page: list Starter, Team and Business, switch with a confirming step, prorated, seats follow the sign-up rule, the app's record of the plan follows (`.specs/features/plan-change/`, planned 2026-11-10, built 2026-11-10, AD-179; the `set_org_plan` migration (`20261110190000`) is written and proven on a rolled-back recipe but not yet applied to the hosted project, and the live Stripe run waits for that; tick when the Verifier passes and the owner has applied the migration)
- [ ] Plan limits by live agreements and an AI-import allowance; seats beyond the included ones are billed through the Stripe quantity set at sign-up (register-seats), and enforcing the paid seat count at invite time is a later item
- [ ] Supabase Auth SMTP sender on the verified Resend domain (blocks launch)

### Phase 5.5: Document templates (M19)
- [ ] Template and template-version tables; agreements and contracts record the template version used
- [ ] Block model, merge-variable whitelist and validation; blocks replace `clauses: string[]` in the document models
- [ ] Block editor with live PDF preview, plus clone
- [ ] Starter agreement and contract templates in each pack, province-aware, legally reviewed
- [ ] Upload an existing contract and let Claude split it into blocks and variables

### Phase 5.6: Reporting (M20)
- [ ] Report functions and views (`security invoker`), with the event-date rules above
- [ ] Reports page: headline row, funnel, aging, loss reasons, renewals, revenue breakdown
- [ ] CSV export and empty states
- [ ] Role access: money for owner and admin, operational for estimators

### Phase 6: Post-contract operations
- [ ] Visit scheduling and deficiency reports after each visit
- [ ] Per-visit invoicing (QuickBooks sync)
- [ ] Annual CPI adjustment (W6) and renewal or cancellation tracking
- [ ] Generate the year's visits from each line's cadence: visit list and calendar, mark done, workload forecast per month
- [ ] Cancellation flow: notice period, effective date, final visit
- [ ] Mid-term amendments: equipment added during the term, with a prorated price, without restarting the contract
- [ ] Billing schedule: per visit, quarterly or annual
- [ ] Recurring revenue from active contracts on the dashboard
- [ ] Photos and attachments on sites and assets (nameplates, access notes)
- [ ] Finer cadence: weekly and every-N-weeks visits, for trades that do not work by month. Wait for a first customer who needs it

## Decisions

The 22 questions raised on 2026-11-06 were delegated to Claude to answer from research and the code, and the user accepted the recommendations the same day ("go with your recommended"). Change any row and the phases above follow. Items marked **needs you** cannot be settled by research and are still open.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Boundary | Recurring service on a list of things, a checklist and a cadence. Construction and one-off contracts are a non-goal | Every strength of the product (import, "Service included", cadence, renewal) assumes it. PRODUCT principle 4 |
| 2 | Pilot trade | **Needs you.** Find one or two plumbing or electrical contractors before Phase 5 launches | Research cannot replace a real customer. Their lists and wording shape packs, templates and cadence |
| 3 | Geography | Canada outside Quebec at launch. Quebec later | Every province and territory except Quebec has e-signature law based on the UECA; Quebec has its own framework (and French-language rules to confirm with counsel) |
| 4 | Vocabulary | One per-org label for the serviced item | Cheap, covers every trade in scope; per-trade wording is a rewrite for little gain |
| 5 | Starter packs | Claude drafts, a practitioner reviews. Ship HVAC (exists), plumbing, electrical. Fire and elevators wait for a reviewer | Safety-critical checklists must not ship unreviewed. **Needs you** for the reviewer |
| 6 | Several trades per tenant | Yes, multi-select at signup | Types are per-org rows, so it costs nothing and fits mixed contractors |
| 7 | "Other" trade | Both routes. "Upload your proposal" first, "describe your trade" second | A catalog read from a real document is less likely to invent tasks than one drafted from a sentence |
| 8 | Trial | 14-day trial with the card collected up front. Cancel the subscription if payment fails at the end | Card-required trials convert about 5x better than no-card ones (ChartMogul bands: 25-35% against 4-6%), at the cost of fewer trial starts. Third-party reports say Jobber and Housecall Pro both use 14 days (unchecked against their own pages). Stripe Checkout does this by default (`trial_period_days`) |
| 9 | Returning email | Refuse with a clear message | There is no org switcher; attaching a plan to an existing org is a separate feature |
| 10 | Plan limits | Limit by live agreements and an AI-import allowance. Charge a flat monthly fee per seat beyond the seats each plan includes (amended 2026-11-09: 2, 5 and 10 included, $15 an extra seat, all draft). Price points still open | Field-service tools charge per user add-on; flat seats is a simple edge for a small office. Imports have a real Claude cost; each completed signature costs about $0.20 plus a DocuSeal Pro seat. Numbers: size with the `ai-pricing` skill. **Needs you** for the price points |
| 11 | SMTP sender | Move Supabase Auth's sender to the verified Resend domain before launch | Otherwise invitations reach only the account owner. Launch blocker |
| 12 | Template editor | Block editor with variables, live PDF preview | Predictable output; no DOCX-to-PDF step |
| 13 | Templates per org | One default plus clone | A picker on every new agreement is friction; several templates can follow a real request |
| 14 | Starter contract wording | Claude drafts, a lawyer reviews per province. The tenant owns their wording and the editor says so. **Needs you** for the lawyer | The legal review of the six clauses already blocks go-live |
| 15 | Upload an existing contract | After the editor ships | It depends on the block model |
| 16 | DocuSeal | API only. Do not use the Pro template builder | Templates live in our database for the audit trail. The API still needs one Pro seat ($20/month) for its keys |
| 17 | Money reports | Owner and admin see money; estimators see operational reports; viewers none | Least privilege; revenue figures are sensitive |
| 18 | Per-estimator performance | Not in v1 | Events hold a role, not a person, and ranking staff is a product call |
| 19 | v1 report list | As written in Reporting | Every number comes from data that exists |
| 20 | Reporting as a plan tier | No. Plans limit volume and include seats (amended 2026-11-09); features, templates and reports are the same on every plan | One pricing axis is easier to explain and build |
| 21 | Build order | Finish Phase 4, then 4.5, 5, 5.5, then reporting (5.6) | Nobody can be sold a contract that cannot complete (the DocuSeal webhook, signed PDF and audit log are still open). Templates decide whether a contractor adopts the product; reports need real tenant data to say anything |
| 22 | Planning | One feature at a time, starting with the type editor and `seed_org_catalog(pack)` | The `tlc-spec-lean` workflow in this repo is built for it |

**Needs you:** a pilot contractor (2), a lawyer for the starter wording (14), plan price points (10), and the Supabase SMTP change (11).

## Research sources
- n8n license FAQ (backend-only use is allowed; Cloud has separate terms): https://docs.n8n.io/n8n-community-license/community-license/license-faq
- DocuSeal signing API and pricing: https://www.docuseal.com/signing-api, https://www.docuseal.com/on-premises
- Documenso webhooks and embedding (the alternative): https://docs.documenso.com/developers/webhooks, https://docs.documenso.com/developers/embedding
- Multi-tenant RLS pattern: https://makerkit.dev/blog/tutorials/multi-tenant-saas-architecture
- Claude structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Document parsing options: https://www.file2markdown.ai/blog/docling-vs-llamaparse
- BC Electronic Transactions Act and e-signatures: https://www.cwilson.com/electronic-documents-and-the-enforceability-of-electronic-signatures/
- Service agreement features (ServiceTitan): https://help.servicetitan.com/how-to/create-a-service-agreement-step-4-scope-of-work
- PDF generation options: https://www.pkgpulse.com/guides/react-pdf-vs-react-pdf-renderer-vs-jspdf-pdf-in-react-2026
- DocuSeal API reference (templates from PDF, DOCX and HTML; text tags), pricing and the embedded builder (Pro): https://www.docuseal.com/docs/api, https://www.docuseal.com/pricing, https://www.docuseal.com/docs/embedded/builder
- Free trial conversion, card required against not (ChartMogul): https://chartmogul.com/reports/saas-conversion-report/
- Stripe Checkout free trials (`trial_period_days`, `payment_method_collection`): https://docs.stripe.com/payments/checkout/free-trials
- Field-service pricing anchors (third-party reports that disagree; check Jobber and Housecall Pro directly before using): https://www.costbench.com/compare/housecall-pro-vs-jobber/
- Product overview pricing anchors (third-party, checked 2026-11-06; vendors' own pages not read): Jobber https://pricingsaas.com/companies/jobber, Housecall Pro https://projul.com/blog/housecall-pro-pricing-analysis-2026, ServiceTitan https://projul.com/blog/servicetitan-pricing-analysis-2026
- DocuSeal API cost (Pro seat plus $0.20 a document): https://www.docuseal.com/pricing
- Stripe Canada card fees (aggregators; confirm on stripe.com/en-ca/pricing): https://www.venn.ca/resources/how-to-save-on-your-stripe-payments-for-canadian-businesses
- Canadian e-signature law, UECA and the Quebec exception (vendor guides; confirm with counsel): https://www.blueink.com/electronic-signature-law/canada, https://juro.com/esignature-legality/canada
