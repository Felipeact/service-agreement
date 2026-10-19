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
**What we built:** nothing yet. Planned for Phase 1.

### Company profile and default terms (M2)
**What it is:** each tenant's branding and contract defaults. Branding is legal name, address, phone, logo and accent colour. Default terms are repair discount %, CPI cap %, cancellation notice days, payment days, governing province and tax note (GST/PST/HST). Branding is data, not code: no company name is hard-coded, and seed or demo data uses a fictitious company.
**What we built:** nothing yet. Planned for Phase 1.

### Customer (M3)
**What it is:** the client company that owns the equipment and receives the service agreement, for example a property-management firm.
**What we built:** nothing yet. Planned for Phase 1.

### Contact / site contact (M3)
**What it is:** the person at the customer, usually a facility or property manager, who reviews the agreement through the portal and signs the contract. Their email approval counts as written approval. They are non-technical and use the portal rarely.
**What we built:** nothing yet. Planned for Phase 1.

### Site (M3)
**What it is:** a physical address belonging to a customer, where the equipment is installed. A customer can have several sites.
**What we built:** nothing yet. Planned for Phase 1.

### Asset and asset type (M4)
**What it is:** one piece of equipment at a site. Fields: asset type, unit #, type/model, location/access, and source (manual or import). The asset type comes from a catalog of about 40 equipment types, for example RTU (rooftop unit) and MUA (make-up air unit).
**What we built:** nothing yet. Planned for Phase 1.

### Asset import (M5)
**What it is:** turning a customer's messy equipment list (xlsx, csv, docx or pdf) into assets. The steps are upload, parse by format, extract with Claude structured output, normalize types with a synonym table (for example "Rooftop unit" → RTU), review in a grid, then commit. Uncertain rows are flagged, never hidden. Extraction sits behind the `AssetExtractor` port.
**What we built:** nothing yet. Planned for Phase 2.

### Maintenance task library (M6)
**What it is:** a preventive-maintenance checklist for each equipment type. Each tenant can edit it, and it is snapshotted into each agreement version so later edits don't change sent agreements.
**What we built:** nothing yet. Seed planned for Phase 1. Its source is a "proposal template" that is not in the repo yet.

### Service agreement (PM agreement) (M7, M8)
**What it is:** the preventive-maintenance proposal the contractor sends to the customer for review. It is not yet a signed contract. It contains:
- Visit frequency.
- Service price lines (visits per year × cost per visit). Money is stored in integer cents, in CAD.
- "Service included", built from the asset types on site and their checklists.
- The equipment list, grouped by type.
- Versions: requesting changes creates a new version.

It is rendered as a tenant-branded PDF behind the `DocumentRenderer` port (`@react-pdf/renderer`).
Statuses: `draft` (shown as "In progress") → `sent` → `accepted` | `refused` | `changes_requested`. `changes_requested` returns to `draft` as a new version. `sent` can become `expired`, and `draft` or `sent` can become `withdrawn`.
**What we built:** nothing yet. Planned for Phase 3.

### Customer review portal (M9)
**What it is:** a magic-link page with no customer account. The site contact can view and download the agreement, then Accept, Refuse (a reason is required) or Request changes. It records when the agreement was viewed. It wears the tenant's brand, never the product's.
**What we built:** nothing yet. Planned for Phase 3.

### Contract and e-signature (M10)
**What it is:** the legally binding document generated from the accepted agreement version. The client signs first, then the tenant countersigns. The signed PDF and its audit log are stored. E-signature runs through DocuSeal behind the `SignatureProvider` port and must be valid under Canadian provincial electronic transactions law.
Statuses: `pending_signature` → `client_signed` → `completed`. `pending_signature` or `client_signed` can become `declined` or `voided`.
**What we built:** nothing yet. Planned for Phase 4.

### Pipeline / status engine (M11)
**What it is:** a pure state machine for agreements and contracts. Every transition writes an event and an outbox row. Each deal is shown at one stage: **In progress → Sent to customer → Accepted (awaiting signature) → Completed**, with **Refused** as the exit. The dashboard shows deals by stage and age.
**What we built:**
- **Stage keys:** `in_progress`, `sent`, `accepted`, `completed` and `refused` live in [web/lib/pipeline-stage.ts](web/lib/pipeline-stage.ts) (AD-001). The Phase 1 domain layer takes ownership of them.
- **Board UI:** `/pipeline` ([web/app/(app)/pipeline/page.tsx](web/app/(app)/pipeline/page.tsx)) shows the five-column board on fictitious sample data from [web/lib/sample-pipeline.ts](web/lib/sample-pipeline.ts).
  - Each column shows its card count and its CAD total per year, formatted by `formatCad` from [web/lib/money.ts](web/lib/money.ts).
  - Search by customer name runs client-side.
  - On mobile the board becomes stage tabs; on tablet it scrolls inside its own container.
- **Redirect:** `/` redirects to `/pipeline` with a 307 ([web/next.config.ts](web/next.config.ts)).
- **Not built yet:** the state machine, real data, filters and drag-and-drop.

### Events, outbox and n8n automation (M11, M12, M13)
**What it is:** the app owns all status, and n8n only automates emails, reminders and timing. Outbox events go to n8n signed with HMAC, and n8n calls back app endpoints with idempotency keys. n8n execution IDs are written back to the event log as audit evidence. Workflows W1–W6 are defined in [ROADMAP.md](ROADMAP.md#n8n-workflows). Customers never see or build workflows.
**What we built:** nothing yet. Planned for Phases 3–4.

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
- **Deferred:** `TextInput`, `Select` and the field error state come with the Phase 1 Company settings form.
- **Design record:** [DESIGN.md](DESIGN.md) and [.impeccable/design.json](.impeccable/design.json) are regenerated from the code.
- **Spec:** [.specs/features/design-system-base/](.specs/features/design-system-base/).

---

## Build log

Newest first. Use one line per completed change: date, what was done, and the key files.

- **2026-10-19:** Phase 0.5 tokens and base components ([.specs/features/design-system-base/](.specs/features/design-system-base/)).
  - Added `@theme` role tokens, Inter, the app shell with a mobile drawer, `Button`, `SearchInput`, `StatusPill`, and the pipeline kanban on sample data at `/pipeline`. `/` now redirects to `/pipeline`.
  - Regenerated [DESIGN.md](DESIGN.md) from the code and added [.impeccable/design.json](.impeccable/design.json).
  - Removed the `create-next-app` page and its SVGs.
  - The code is committed in the nested `web/` repo.

- **2026-10-16:** Added this file and the rule in `AGENTS..md` and `ROADMAP.md` that every change keeps it up to date.
- **2026-10-16:** Phase 0.5 design work. Wrote [PRODUCT.md](PRODUCT.md). Created the visual direction variants in [.impeccable/mocks/decision/](.impeccable/mocks/decision/); the chosen one is `canon.html`. Wrote the seed [DESIGN.md](DESIGN.md).
- **Project start:** scaffolded Next.js 16 / React 19 / Tailwind 4 in [web/](web/). `web/` is its own git repo (branch `master`), recorded in this repo as a gitlink with no `.gitmodules`.
