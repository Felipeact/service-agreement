# Roadmap: Service Agreement micro-SaaS

A multi-tenant SaaS for HVAC and mechanical contractors. It imports a customer's equipment list, builds a preventive-maintenance service agreement for review, tracks it until the customer accepts or refuses it, then turns the accepted agreement into a contract for e-signature. n8n automates the steps in between.

Tenant branding (legal name, address, phone, logo, terms) comes from each tenant's settings. No company name is hard-coded, and seed or demo data uses a fictitious company.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Web app | Next.js 16 (App Router), React 19, Tailwind 4 | Already scaffolded in `web/` |
| Data, auth, files | Supabase (Postgres + RLS, Auth, Storage) | Shared schema, `org_id` on every row, isolation enforced by RLS |
| Automation | n8n, self-hosted on Railway (Postgres-backed) | The app owns state; n8n owns emails, reminders and timing. Customers never see or build workflows |
| E-signature | DocuSeal API, behind `SignatureProvider` | Free sandbox, about $0.20 per completed document, `form.completed` webhook, React embed |
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
| M6 | Maintenance task library | About 40 equipment types with checklists, editable per tenant and snapshotted into each agreement version. Default visit months per equipment type, and seasonal tasks that apply only to some visits | 1 (seed), 3.5 |
| M7 | Agreement builder | Visit frequency, service price lines (visits/yr × cost/visit), "Service included" built from the asset types on site, equipment list by type, versions. Each line covers equipment types and has its own visit months. Term dates, version comparison and history | 3, 3.5 |
| M8 | Document generation | Tenant-branded agreement and contract PDFs | 3 |
| M9 | Customer review portal | Magic link with no customer account. The customer can view, download, Accept, Refuse (reason required) or Request changes. Records when it was viewed | 3 |
| M10 | Contract & e-signature | Contract built from the accepted version, client signs then the tenant countersigns, signed PDF and audit log stored | 4 |
| M11 | Status engine & pipeline | Pure state machine. Every transition writes an event and an outbox row. Dashboard by status and age. Pipeline cards by site, with $ totals per stage and an "Expiring soon" view | 1, 3.5 |
| M12 | Automation (n8n) | Outbox events go to n8n (HMAC-signed). n8n calls back app endpoints with idempotency keys | 3–4 |
| M13 | Email | Portal links, reminders, signed copies | 3 |
| M14 | SaaS billing | Stripe plans per tenant, plan limits | 5 |
| M15 | Audit, files, security | Org-scoped storage, event log, portal rate limits, Supabase advisors clean | 1+ |
| M16 | Post-contract operations | Visit schedule, deficiency reports, per-visit invoicing, annual CPI adjustment, renewals and cancellations, mid-term amendments, billing schedule | 6 |
| M17 | Design system & UX | PRODUCT.md, variant mockups (three directions plus the category standard), the chosen direction recorded in DESIGN.md and `.impeccable/design.json`, tokens and components | 0.5 |

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
- [ ] Cadence: service lines cover equipment types and hold visit months; month grid and presets in the builder; default months per equipment type; visit schedule on the PDF and the portal
- [ ] Seasonal tasks: a checklist task can apply to selected visits only
- [ ] Term dates (start, term months, end) and tenant renewal settings (default term, notice days, CPI renegotiation threshold)
- [ ] Renewal: auto-renew with CPI applied below the threshold; at or above it, a renewal draft linked to the agreement it renews. "Expiring soon" view and n8n W7
- [ ] Proposal validity date and automatic expiry of sent agreements (n8n W8)
- [ ] Deactivate sites, customers and assets, with the live-agreement and live-contract rules; asset replacement link
- [ ] Versioning: compare two versions (lines, prices, months, equipment, annual total change); the reason for each version (the customer's change request or a staff note); who created it and its sent, viewed and decided history from `events`; mark the version that was sent and the one accepted
- [ ] Agreements page: list with filters (status, site, expiring); enable the New agreement button on Pipeline
- [ ] Sites & equipment page: every site across customers
- [ ] Imports page: import job history
- [ ] Task library page: view and edit checklists and default months per equipment type
- [ ] Contact roles: site, billing and approver
- [ ] Agreement activity timeline from `events`
- [ ] Members page: invite and set roles (owner, admin, estimator, viewer)
- [ ] Global search across customers, sites and unit numbers

### Phase 4: Contract & e-signature
- [ ] Contract generated from the accepted agreement version
- [ ] `SignatureProvider` with a DocuSeal adapter and embedded signing
- [ ] Verified DocuSeal webhook, storage of the signed PDF and audit log
- [ ] n8n W2 and W4

### Phase 5: SaaS billing & onboarding
- [ ] Stripe plans, Checkout, Customer Portal, idempotent webhooks
- [ ] Tenant onboarding and plan limits

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
