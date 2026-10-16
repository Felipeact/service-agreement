# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the office estimator.** An estimator or office manager at an HVAC or mechanical contractor, working at a desk on a desktop screen. They take a customer's equipment list, build a preventive-maintenance (PM) service agreement, send it for review, follow it up, and turn the accepted ones into signed contracts. They work through many agreements at once, so they need to see which ones are stuck and which need a reply.

**Secondary: the owner.** Checks the pipeline (what's out, what's accepted, what's signed, what's aging) and countersigns contracts. Roles in the app: owner, admin, estimator, viewer.

**External: the customer's site contact.** A facility or property manager at the client company. They get a magic link with no account and use it to view and download the agreement, then Accept, Refuse (a reason is required) or Request changes. Their email approval counts as written approval. They then sign the contract. They use the portal rarely and are not technical, and the page must look like it comes from the contractor, not from this product.

## Product Purpose

A multi-tenant micro-SaaS that takes a contractor from a customer's equipment list to a signed PM contract. It imports the equipment list, builds a priced and branded agreement for review, tracks it until the customer accepts or refuses, then turns the accepted version into a contract for e-signature. n8n handles the emails, reminders and timing in between.

Success: an estimator goes from a messy equipment list to a sent agreement in minutes, always knows where every agreement stands, and none slips through the cracks before it is signed.

## Positioning

The user confirmed three reasons, all of equal weight:

1. **From equipment list to agreement, fast.** Import any messy equipment list (Excel, CSV, Word or PDF) and get a priced, tenant-branded PM agreement whose "Service included" scope is built from the equipment types actually on site.
2. **Tracked to signature.** One status for each deal (In progress → Sent to customer → Accepted (awaiting signature) → Completed, with Refused as the exit), plus automatic reminders and an audit trail.
3. **Focused and affordable.** It does this one job well for small and mid-sized shops that don't want a full field-service suite such as ServiceTitan, or a pile of Word templates and spreadsheets.

## Operating Context

- **Market:** contractors across Canada from launch. Money is in CAD. Tenants set a governing province and a tax note (for example GST/PST/HST) in their default terms. E-signature has to be valid under provincial electronic transactions law. All site content is in English.
- **Inputs:** customers' equipment lists in xlsx, csv, docx or pdf, often messy tables. Each asset has a type, unit #, type/model and location/access. There are about 40 equipment types (RTU, MUA, and so on), each with a maintenance checklist.
- **Agreement anatomy:** visit frequency, service price lines (visits per year × cost per visit), "Service included" built from the asset types on site, an equipment list grouped by type, and versions. The default terms are repair discount %, CPI cap %, cancellation notice days, payment days, governing province and tax note.
- **Documents:** tenant-branded agreement and contract PDFs. The client signs first, then the tenant countersigns. The signed PDF and its audit log are stored.
- **Statuses:** agreement states are `draft` (shown as "In progress"), `sent`, `accepted`, `refused`, `changes_requested`, `expired` and `withdrawn`. Contract states are `pending_signature`, `client_signed`, `completed`, `declined` and `voided`.

## Capabilities and Constraints

- **Stack:** Next.js 16 (App Router), React 19, Tailwind 4 in `web/`. Supabase (Postgres with RLS, Auth, Storage), n8n Cloud, DocuSeal behind `SignatureProvider`, Claude API extraction behind `AssetExtractor`, `@react-pdf/renderer` behind `DocumentRenderer`, Resend or Postmark for email, Stripe for billing. See `ROADMAP.md` for module and phase detail.
- **Tenant branding is data, not code.** Legal name, address, phone, logo, accent colour and terms come from each tenant's settings. No company name is hard-coded. Customer-facing surfaces (the portal, PDFs, emails) must take on the tenant's identity, including an arbitrary accent colour.
- **Seed and demo data** use a fictitious company.
- **Customers never see or build workflows.** The app owns all status; n8n only automates.
- **Engineering:** SOLID, ports and adapters, money in integer cents. Every change to the web app must pass Playwright validation at 375, 768 and 1440 px wide, with touch targets of at least 44 px (see `AGENTS..md`).
- **Undecided:** the product name and brand (the working name is "Service Agreement"), plans and pricing (Phase 5), and the choice between Resend and Postmark.

## Brand Commitments

- Customer-facing output carries the tenant's brand, never a hard-coded one.
- **Visual stance (chosen 2026-10-16):** the user deliberately chose the familiar category standard over distinctive directions. The quality bar is Linear, Stripe Dashboard, Attio/HubSpot CRM and Jobber/Housecall Pro. See `DESIGN.md`.

## Evidence on Hand

- `ROADMAP.md` defines the modules, status model, import pipeline and n8n workflows.
- The roadmap mentions a "proposal template" as the source of the equipment catalog and task library, but no such file is in the repo yet.
- There are no customers, testimonials, case studies, metrics or pricing yet. Future work must not invent any of these.

## Product Principles

1. **Status is never in doubt.** Every agreement and contract has one clear current state, how long it has been there, and what happens next.
2. **The messy input is our problem.** Accept equipment lists as customers actually send them. Flag uncertainty for review, never hide it, and never make the estimator retype.
3. **The tenant's brand faces the customer.** Anything the customer sees must look like it came from the contractor.
4. **Built for one job, done thoroughly.** Prefer depth in the list → agreement → signature path over breadth. Leave field-service-suite features out until Phase 6 earns them.
5. **Audit-ready by default.** Approvals, signatures and automated actions leave verifiable evidence.

## Accessibility & Inclusion

No product-specific standard has been confirmed yet. The working baseline from `AGENTS..md` is readable text, no horizontal scroll, touch targets of at least 44×44 px on mobile and tablet, and nothing that works on hover only. Customer-portal users are non-technical and use it rarely, so the portal needs plain language and obvious actions.
