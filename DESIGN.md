---
name: Service Agreement
description: Familiar, precise SaaS for HVAC estimators. The category standard, built to the craft of Linear, Stripe, Attio and Jobber.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Service Agreement

## Overview

**Creative North Star: "The Well-Run Office"**

The user chose the category standard on purpose. The app should feel instantly familiar to anyone who has used a modern SaaS tool: a white sidebar, a cool grey work area, white cards and tables, one blue accent. Nothing should need explaining. Its quality is in how it's executed, not in novelty. The benchmark is four products the user named: **Linear** (density, speed, keyboard reach), **Stripe Dashboard** (money in tables, statuses, forms and detail pages), **Attio / HubSpot CRM** (deal pipelines, record pages with properties and activity) and **Jobber / Housecall Pro** (plain, friendly language for the trades and a clear quote-to-job flow). A screen is done when it could sit next to any of these and not look like the cheaper one.

Density is moderate to high: an estimator works through dozens of agreements a day on a desktop, so lists and boards show a lot without crowding. Expression lives in precise details: tabular money figures, honest status labels, exact counts and totals in column headers, and calm, quick transitions. There is no texture, illustration or decorative colour inside the app. Customer-facing surfaces (review portal, PDFs, emails) use the same quiet structure but wear the **tenant's** logo and accent colour, never the product's.

**Key Characteristics:**
- Familiar SaaS layout: a left sidebar, a page header with filters and one primary action, and the work area below.
- Neutral cool-grey ground, white surfaces and one blue accent for action and selection.
- Five stage colours that carry pipeline meaning, always paired with a text label.
- Tabular, right-aligned money in CAD, and exact counts and totals wherever a group is shown.
- Plain trade language ("Sent to customer", "Awaiting your countersignature"), not jargon.

## Colors

A restrained palette: cool neutrals, one blue for action, and a fixed set of stage colours that only ever mean status. These values come from the approved sketch (`.impeccable/mocks/decision/canon.html`) and are provisional until implementation tokens exist.

### Primary
- **Action Blue** (#2563eb): primary buttons ("New agreement"), links, the active nav item (on a #eef2ff tint), selection and focus rings. It is used for actions and selection, never for decoration.

### Neutral
- **Ink** (#111827): headings, card titles and money figures.
- **Slate Secondary** (#6b7280): metadata, captions, column counts and placeholder text. On tinted column grounds, check it holds 4.5:1 and darken it if not.
- **Hairline** (#e5e7eb): sidebar edge, input borders, table rules and dividers.
- **Board Grey** (#eef0f3): kanban column wells and other grouped containers.
- **Cool Ground** (#f6f7f9): the app background behind the work area.
- **Surface White** (#ffffff): sidebar, cards, tables, panels and inputs.

### Stage colors (status only)
- **In progress**: blue (#2563eb).
- **Sent to customer**: amber (#f59e0b).
- **Accepted, awaiting signature**: violet (#8b5cf6).
- **Completed**: green (#10b981).
- **Refused**: red (#ef4444).
- **Attention pill** (#fef3c7 ground, #92400e text): "Changes requested", "Not viewed" and similar states that need the estimator's action.

### Named Rules
**The Status Is Never Colour Alone Rule.** Every stage dot, pill or bar sits next to its text label. Colour speeds up scanning but never carries meaning by itself.

**The Tenant Wears the Accent Rule.** Action Blue belongs to the product's own screens. On the customer portal, PDFs and emails, the tenant's accent colour takes the action and brand roles. Contrast against white is checked at runtime, falling back to Ink when the tenant's colour fails 4.5:1.

## Typography

**UI Font:** Inter (with system-ui, -apple-system, "Segoe UI", sans-serif). Use tabular figures (`font-variant-numeric: tabular-nums`) for all money, counts and dates in tables.

**Character:** a neutral workhorse sans, chosen for familiarity and legibility at small sizes, as the category expects.

### Hierarchy
The sketch set these sizes. The full scale is to be resolved during implementation.
- **Page title** (700, ~22px): one per page ("Pipeline", "Customers").
- **Section / column header** (600, ~13–14px): kanban column names and panel titles, with counts and totals in Slate Secondary.
- **Card title** (600, ~13.5px): customer or site name.
- **Body / meta** (400, 12–13px, line-height ~1.45): metadata, notes, table cells.
- **Pill label** (600, ~11px): status pills.

### Named Rules
**The Money Lines Up Rule.** Money is always tabular, in CAD with a `$` and thousands separators, right-aligned in tables and columns. Per-year amounts say `/yr`.

## Layout

The app shell is a fixed white **sidebar** (~232px) holding these items: Pipeline, Agreements, Customers, Sites & equipment, Imports, Task library, with Settings at the bottom. Beside it is the **work area** on Cool Ground, with ~20–28px padding. Each page opens with a header row: the title on the left, then filters (Estimator, Province), search and the single primary action on the right.

The **Pipeline** is a five-column kanban: In progress, Sent to customer, Accepted (awaiting signature), Completed, and Refused as the exit. Columns are Board Grey wells with ~10px padding and ~8px gaps between cards, and each column header shows its count and total. Responsive behaviour is provisional. On tablet the board scrolls horizontally inside its own container, never the page. On mobile it becomes a stage selector (segmented control or tabs) showing one column at a time, with touch targets of at least 44px.

## Elevation & Depth

The app is mostly flat, built from tonal layers (Cool Ground, then Board Grey, then Surface White). Cards lift by a hair. Overlays such as menus, popovers and drawers take a soft, offset shadow, to be resolved during implementation.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgba(17,24,39,.08)`): kanban cards and small raised surfaces.

### Named Rules
**The Flat-By-Default Rule.** Surfaces separate by tone and hairlines first. A shadow means "this floats" (a card being dragged, a menu, a drawer), never decoration.

## Shapes

Gently rounded corners throughout: small controls and cards at about 6px, column wells and panels at about 8px, and status pills fully rounded (999px). Borders are 1px Hairline. There are no thick coloured side borders, no hard offset shadows and no decorative shapes.

## Do's and Don'ts

### Do:
- **Do** benchmark every screen against Linear, Stripe Dashboard, Attio/HubSpot and Jobber/Housecall Pro. It should look at home next to them.
- **Do** show count and total in CAD on every pipeline column and grouped list.
- **Do** pair every stage colour with its text label (The Status Is Never Colour Alone Rule).
- **Do** use the product's plain status language: "In progress", "Sent to customer", "Accepted, awaiting signature", "Completed", "Refused".
- **Do** let the tenant's logo and accent colour lead on everything the customer sees.
- **Do** keep touch targets at 44×44px or larger on mobile and tablet, and never hide an action behind hover alone.

### Don't:
- **Don't** add texture, illustration, gradients, glass or decorative colour inside the app. The user chose the standard look, played straight.
- **Don't** use stage colours for anything other than status.
- **Don't** hard-code any company name or brand into customer-facing output.
- **Don't** use a coloured `border-left` stripe above 1px on cards or alerts. Use a pill or a tinted note instead.
- **Don't** let the board scroll the whole page sideways.
