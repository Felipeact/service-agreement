# PRD: Service Agreement micro-SaaS

Status: living document. Last updated 2026-11-04. Source of truth for delivery state is [ROADMAP.md](ROADMAP.md); for what is built, [CONTEXT.md](CONTEXT.md); for users and positioning, [PRODUCT.md](PRODUCT.md).

## 1. Problem

HVAC and mechanical contractors sell preventive-maintenance (PM) service agreements, and the work around each one is manual:

- A customer's equipment list arrives as a messy Excel, CSV, Word or PDF table. Someone retypes it.
- The agreement is a Word template and a spreadsheet, priced by hand, with the "Service included" text copied from the last job.
- After it is sent, nobody has one view of which agreements are unsent, unviewed, stuck, or accepted. Follow-ups depend on memory.
- Accepted agreements are re-typed into a contract and chased for signatures.

The people who pay for this are small and mid-sized shops that do not want a full field-service suite such as ServiceTitan. No customer, volume or revenue evidence exists yet, so none is claimed here.

## 2. Goal and success

Take a contractor from a customer's equipment list to a signed PM contract in one tool.

An estimator should:
- get from a messy equipment list to a sent, priced, tenant-branded agreement in minutes;
- always know where every agreement stands and how long it has been there;
- never lose an agreement between "sent" and "signed".

Measures are not set yet (no baseline, no customers). Candidate measures to agree before launch: time from upload to send, share of agreements with a decision within N days, agreements stuck without a follow-up.

## 3. Users

| User | Needs |
| --- | --- |
| Estimator / office manager (primary) | Import, build, send, follow up, many agreements at once |
| Owner (secondary) | Pipeline overview, aging, countersigning |
| Customer's site contact (external, no account) | View, download, Accept / Refuse (reason required) / Request changes from a magic link; looks like the contractor, not this product |
| Approver and billing contact (customer side) | Receive the agreement link; be recorded as the invoiced party |

Roles in the app: owner, admin, estimator, viewer. Each tenant's data is isolated.

## 4. Scope

### In scope (by module; phases per the roadmap)

| Module | Requirement |
| --- | --- |
| Tenancy and access (M1) | Orgs, members, roles, magic-link sign-in, row-level isolation on every table |
| Company profile and branding (M2) | Legal name, address, phone, logo, accent, default terms (repair discount, CPI cap, cancellation notice, payment days, province, tax note), renewal terms. No company name hard-coded |
| Customers, contacts, sites (M3) | Customers with contacts and sites; contact roles (site contact, approver per site, billing contact per customer); deactivate rather than delete |
| Asset register (M4) | Assets per site (type, unit, model, location), manual or imported; deactivate and link a replacement |
| Asset import (M5) | Upload xlsx, csv, docx, pdf; extract, normalize types, review grid, commit |
| Task library (M6) | About 40 equipment types with checklists and default visit months, editable per tenant, snapshotted into each agreement version |
| Agreement builder (M7) | Service lines (visits x cost), visit months per line, "Service included" from equipment on site, versions and comparison, term dates, renewals |
| Documents (M8) | Tenant-branded agreement PDF; contract PDF |
| Customer review portal (M9) | Magic link, no account; view, download, accept, refuse, request changes; records first view |
| Contract and e-signature (M10) | Contract from the accepted version; client signs, tenant countersigns; signed PDF and audit log |
| Status engine and pipeline (M11) | One status per deal, pipeline by stage with totals, expiring soon |
| Automation (M12, M13) | Outbox events to n8n; link email, reminders, decision and stale digests, renewal and expiry runs; transactional email |
| SaaS billing (M14) | Stripe plans per tenant and plan limits |
| Audit, files, security (M15) | Org-scoped storage, event log, portal rate limits, clean security advisors |
| Post-contract operations (M16) | Visit scheduling, deficiency reports, invoicing, CPI adjustment, amendments, billing schedule |

### Out of scope (for now)

- Full field-service features (dispatch, technician apps) until Phase 6 earns them.
- Customer-built workflows. Customers never see or build automation.
- Multiple approvers or CC recipients per notification.
- Role-specific portal permissions (the portal is a bearer link with no identity).
- Prices, plans and the product name (undecided; Phase 5).

## 5. Key flows and rules

**Agreement status.** `draft` (shown "In progress") -> `sent` -> `accepted`, `refused` or `changes_requested`; `changes_requested` -> new draft version; `sent` -> `expired`; `draft` or `sent` -> `withdrawn`.

**Contract status.** `pending_signature` -> `client_signed` -> `completed`; `declined` or `voided` from the first two.

**Pipeline stage.** In progress -> Sent to customer -> Accepted (awaiting signature) -> Completed; Refused is the exit. Each card is a site, with the customer underneath.

**Cadence.** Visit months are set per site and per service line (for example HVAC in Mar, Jun, Sep, Dec; boiler in Oct). Checklist tasks may apply to some visits only. The PDF and portal show a visit schedule.

**Term and renewal.** A contract has a start date and a term (12 months by default) and renews by default. Below the CPI renegotiation threshold (5% default) it renews with CPI applied, never above the cap, and the customer is told 30 days ahead. At or above it, it does not renew on its own: a renewal draft is created and flagged for staff, and the customer signs a new agreement. A renewal is a new agreement linked to the one it renews.

**Who gets customer email.** The site's approver, else the site contact, else the notification is skipped as `no_recipient`. Staff notifications go to the member who sent the agreement, else owners and admins.

**Deactivation.** Sites, customers and assets are never deleted. A site with a live contract cannot be deactivated until the contract is cancelled.

**Automation.** The app owns all state. n8n only sends emails and runs timers, calling the app back with HMAC-signed, idempotent requests. Workflows: link and reminders (W1), decision notice (W3), contract completed (W4), stale digest (W5), CPI adjustment (W6), renewals (W7), expiry (W8), accepted -> contract (W2).

## 6. Non-functional requirements

- **Isolation.** Every tenant table carries `org_id`; references cannot cross orgs even with the service role; policies decide membership in one place.
- **Money.** Integer cents; CAD.
- **Branding.** Anything the customer sees (portal, PDFs, emails) takes the tenant's identity, including an arbitrary accent colour.
- **Idempotency.** Automation callbacks and Stripe webhooks are safe to retry.
- **Signature validity.** E-signature must be valid under Canadian provincial electronic-transactions law.
- **Accessibility and responsiveness.** No horizontal scroll, readable text, touch targets of at least 44 px on mobile and tablet; checked at 375, 768 and 1440 px. Customer-portal language is plain.
- **Audit.** Approvals, signatures and automated actions leave verifiable evidence (event log, execution ids, signed-PDF audit log).
- **Language.** English throughout.

## 7. Architecture summary

Next.js 16 (App Router), React 19, Tailwind 4 in `web/`; Supabase (Postgres with RLS, Auth, Storage); n8n self-hosted on Railway with Postgres; Resend for email; Claude API for document extraction behind `AssetExtractor`; `@react-pdf/renderer` behind `DocumentRenderer`; DocuSeal behind `SignatureProvider` (Phase 4); Stripe (Phase 5). Layers: domain, application (ports, use cases), infrastructure (adapters), composition. Decisions are recorded in [.specs/STATE.md](.specs/STATE.md).

## 8. Delivery status

| Phase | Content | State |
| --- | --- | --- |
| 0.5 | Design system and UX | Done |
| 1 | Foundation: tenancy, schema, domain, auth, core screens, forms | Done |
| 2 | Asset import | Done |
| 3 | Agreement builder, PDF, customer portal, outbox, n8n W1/W3/W5, email | Done; live on Railway since 2026-10-30 |
| 3.5 | Cadence, terms, renewals, deactivation, versioning, list pages, task library, contact roles | Done except: agreement activity timeline, members page, global search |
| 4 | Contract and e-signature (DocuSeal), W2, W4 | Not started |
| 5 | Stripe billing, onboarding, plan limits | Not started |
| 6 | Post-contract operations | Not started |

## 9. Risks and open questions

| # | Question or risk | Effect until answered |
| --- | --- | --- |
| 1 | Product name, brand, plans and pricing are undecided | Blocks Phase 5 and any public launch |
| 2 | No customers or usage data | Success measures cannot be baselined; candidate measures only. Deferred until the app is done |
| 3 | The "proposal template" named as the catalog source is not in the repo | Catalog was seeded from the roadmap description. Not needed for now |

## 10. Sources

- [ROADMAP.md](ROADMAP.md), [PRODUCT.md](PRODUCT.md), [CONTEXT.md](CONTEXT.md), [DESIGN.md](DESIGN.md), [.specs/STATE.md](.specs/STATE.md).
