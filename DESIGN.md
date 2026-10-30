---
name: Service Agreement
description: Familiar, precise SaaS for HVAC estimators. The category standard, built to the craft of Linear, Stripe, Attio and Jobber.
colors:
  ground: "#f6f7f9"
  surface: "#ffffff"
  board: "#eef0f3"
  hairline: "#e5e7eb"
  ink: "#111827"
  ink-2: "#646b78"
  ink-nav: "#374151"
  action: "#2563eb"
  action-tint: "#eef2ff"
  stage-in-progress: "#2563eb"
  stage-sent: "#f59e0b"
  stage-accepted: "#8b5cf6"
  stage-completed: "#10b981"
  stage-refused: "#ef4444"
  attention-bg: "#fef3c7"
  attention-fg: "#92400e"
typography:
  headline:
    fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  meta:
    fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Inter, system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
rounded:
  control: "6px"
  panel: "8px"
  full: "9999px"
spacing:
  card-gap: "8px"
  column-pad: "10px"
  board-gap: "14px"
  page-x-mobile: "16px"
  page-x-tablet: "20px"
  page-x-desktop: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-primary-touch:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px 0 32px"
    height: "34px"
  nav-item:
    textColor: "{colors.ink-nav}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action}"
  pill-attention:
    backgroundColor: "{colors.attention-bg}"
    textColor: "{colors.attention-fg}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pill-neutral:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  kanban-column:
    backgroundColor: "{colors.board}"
    rounded: "{rounded.panel}"
    padding: "10px"
  kanban-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  sidebar:
    backgroundColor: "{colors.surface}"
    width: "232px"
---

# Design System: Service Agreement

## Overview

**Creative North Star: "The Well-Run Office"**

The user chose the category standard on purpose. The app should feel instantly familiar to anyone who has used a modern SaaS tool: a white sidebar, a cool grey work area, white cards on grey column wells, one blue accent. Nothing should need explaining. Its quality is in how it's executed, not in novelty. The benchmark is four products the user named: **Linear** (density, speed, keyboard reach), **Stripe Dashboard** (money in tables, statuses, forms and detail pages), **Attio / HubSpot CRM** (deal pipelines, record pages with properties and activity) and **Jobber / Housecall Pro** (plain, friendly language for the trades and a clear quote-to-job flow). A screen is done when it could sit next to any of these and not look like the cheaper one.

Density is moderate to high: the base text size is 13px and desktop controls are 34px tall, so lists and boards show a lot without crowding; below 1024px everything a finger touches grows to 44px. Expression lives in precise details: tabular figures everywhere, honest status labels, exact counts and annual totals in column headers, and short colour-only transitions (150ms). There is no texture, illustration or decorative colour inside the app. Customer-facing surfaces (review portal, PDFs, emails) are not built yet; when they are, they use the same quiet structure but wear the **tenant's** logo and accent colour, never the product's.

The palette is closed in code: `web/app/globals.css` clears Tailwind's default colours (`--color-*: initial`) and declares only the role tokens below, so a component can only reach for a role, never a raw hue.

**Key Characteristics:**
- Familiar SaaS layout: a 232px left sidebar, a page header with search and one primary action, and the work area below.
- Neutral cool-grey ground, white surfaces and one blue accent for action and selection.
- Five stage colours that carry pipeline meaning, always paired with a text label.
- Tabular money in CAD, whole dollars without decimals, per-year amounts ending in `/yr`, and a count plus total on every pipeline column.
- Plain trade language ("Sent to customer", "Accepted, awaiting signature"), not jargon.

## Colors

A restrained, closed palette of 17 role tokens: cool neutrals, one blue for action, a fixed set of stage colours that only ever mean status, one attention pair, and one danger red for field errors. Each token is exposed by Tailwind 4 as utilities (`bg-*`, `text-*`, `border-*`), e.g. `--color-ink-2` is `text-ink-2`.

### Primary
- **Action Blue** (`--color-action`, #2563eb): the primary button ("New agreement"), the active nav item text, the selected stage tab's text and border, and the 2px focus ring. Used for actions and selection, never for decoration. Primary hover is the same blue at 90% opacity.
- **Action Tint** (`--color-action-tint`, #eef2ff): the ground of the active nav item and the selected stage tab.

### Neutral
- **Ink** (`--color-ink` / `text-ink`, #111827): body text, headings, card titles and money figures. At 40% opacity it is the drawer backdrop.
- **Slate Secondary** (`--color-ink-2` / `text-ink-2`, #646b78): metadata, captions, column counts and totals, empty-state text, placeholder text, the search icon and disabled nav items. It was darkened from the original sketch value, which measured only 4.23:1 on Board Grey; #646b78 holds 4.70:1 on Board Grey and 5.36:1 on white.
- **Nav Ink** (`--color-ink-nav` / `text-ink-nav`, #374151): resting sidebar nav items, one step softer than Ink.
- **Hairline** (`--color-hairline` / `border-hairline`, #e5e7eb): sidebar edge, top-bar edge, search and secondary-button borders, unselected stage tabs, the Settings divider and the empty-state panel border.
- **Board Grey** (`--color-board` / `bg-board`, #eef0f3): kanban column wells and the neutral pill ground.
- **Cool Ground** (`--color-ground` / `bg-ground`, #f6f7f9): the page background behind the work area, and the hover ground for secondary buttons, nav items and icon buttons.
- **Surface White** (`--color-surface` / `bg-surface`, #ffffff): sidebar, mobile top bar, drawer, cards, inputs and secondary buttons; also the primary button's label colour.

### Stage colors (status only)
Each stage has its own token even where the hue repeats, so stage meaning and action meaning can diverge later without a hunt.
- **In progress** (`--color-stage-in-progress`, #2563eb): the same blue as Action Blue, deliberately.
- **Sent to customer** (`--color-stage-sent`, #f59e0b): amber.
- **Accepted, awaiting signature** (`--color-stage-accepted`, #8b5cf6): violet.
- **Completed** (`--color-stage-completed`, #10b981): green.
- **Refused** (`--color-stage-refused`, #ef4444): red.

Stage colours appear only as an 8px dot beside the stage label (column headers, stage tabs). They are never used as text or fills behind text.

- **Attention pill** (`--color-attention-bg` #fef3c7 ground, `--color-attention-fg` #92400e text): "Changes requested", "Not viewed" and similar states on a card that need the estimator's action. The same pair is the tinted notice on the sign-in screen (expired link, rate limit).
- **Danger** (`--color-danger`, #b91c1c): a field's error message and its border. 6.47:1 on white.

### Named Rules
**The Status Is Never Colour Alone Rule.** Every stage dot sits next to its text label; `StatusPill` makes `label` a required prop. Colour speeds up scanning but never carries meaning by itself.

**The Closed Palette Rule.** The 17 tokens in `globals.css` are the only colours in the app. A new colour is a new role token added there and recorded here, never an arbitrary value in a component.

**The Tenant Wears the Accent Rule.** Action Blue belongs to the product's own screens. On the customer portal, PDFs and emails, the tenant's accent colour takes the action and brand roles, falling back to Ink when the tenant's colour fails 4.5:1 against white. (Not yet built; it binds the first customer-facing surface.)

## Typography

**UI Font:** Inter, loaded through `next/font/google` as `--font-inter`, with system-ui, -apple-system, "Segoe UI", sans-serif behind it. One family for everything.

**Character:** a neutral workhorse sans, chosen for familiarity and legibility at small sizes, as the category expects.

`font-variant-numeric: tabular-nums` is set on `body`, so every figure in the app (money, counts, dates) lines up without per-element opt-in.

### Hierarchy
- **Page title** (700, 22px, 1.25): one per page ("Pipeline"). The product name in the sidebar and top bar is 700 at 15px.
- **Empty-state title** (600, 14px): e.g. `No agreements match "…"`.
- **Card title** (600, 13.5px, 1.375): the site name on a kanban card, wrapped, never truncated.
- **Body** (400, 13px, 1.45): the base size for the whole app; buttons (600), nav items (500), stage tabs and column headers (600) all sit at 13px.
- **Meta** (400 or 500, 12px): card metadata, visits per year, column totals, "No agreements".
- **Pill label** (600, 11px, 16px line): attention and neutral pills.

### Named Rules
**The Money Lines Up Rule.** Money is always tabular and in CAD, formatted by `formatCad` (`web/lib/money.ts`) from integer cents with `en-CA` currency formatting: whole-dollar amounts drop the decimals ($14,280), any amount with cents keeps two ($14,280.50). Per-year amounts end in `/yr`. Never format money inline.

## Layout

**Breakpoints** (Tailwind defaults): mobile below 768px, tablet 768-1023px (`md`), desktop 1024px and up (`lg`). The page header's control row also goes horizontal from 640px (`sm`).

**Shell.** On desktop the shell is a two-column grid: a sticky, full-height white **sidebar** (232px, 1px Hairline right edge, 12px side padding) and the work area. The sidebar holds the product name, then Pipeline, Agreements, Customers, Sites & equipment, Imports, Task library, with Settings pinned to the bottom above a Hairline divider. Items without a page yet render disabled in Slate Secondary. Below 1024px the sidebar is replaced by a sticky 56px white top bar with a 44px menu button that opens a **drawer**: a 264px white panel from the left over an Ink 40% backdrop, a modal dialog with focus moved to its close button, closed by Escape, the backdrop or navigating, with focus returned to the menu button.

**Work area.** Cool Ground, with horizontal padding 16px (mobile), 20px (tablet), 28px (desktop) and 20px vertical. Each page opens with a **page header**: the title (and an optional badge) on the left, then search/filters and the single primary action on the right; it stacks vertically on mobile.

**Pipeline board.** Five stages in order (`web/lib/pipeline-stage.ts`):

| Key | Label | Column / tab label |
| --- | --- | --- |
| `in_progress` | In progress | In progress |
| `sent` | Sent to customer | Sent to customer |
| `accepted` | Accepted, awaiting signature | Accepted |
| `completed` | Completed | Completed |
| `refused` | Refused | Refused |

- **Mobile (<768px):** a horizontally scrolling row of 44px stage tabs (dot, short label, count; arrow keys move between them) above a single column showing the selected stage.
- **Tablet (768-1023px):** all five columns in a row, each at least 240px wide, scrolling horizontally inside the board's own container, never the page.
- **Desktop (>=1024px):** a five-column grid that fits the work area with no scroll.

Columns are Board Grey wells with 10px padding and 8px between cards; columns sit 14px apart. Each column header shows the stage dot and label, the card count and the column's annual total.

**Control height.** Every interactive control (buttons, search, nav items, stage tabs, icon buttons) is 44px tall below 1024px; on desktop buttons and search are 34px and nav items 36px.

### Named Rules
**The Board Never Scrolls the Page Rule.** Horizontal overflow on the pipeline is contained in the board; the page itself never scrolls sideways.

## Elevation & Depth

The app is flat, built from tonal layers: Cool Ground, then Board Grey, then Surface White. There is exactly one shadow token, and it is a hair.

### Shadow Vocabulary
- **Card** (`--shadow-card`, `box-shadow: 0 1px 2px rgba(17,24,39,.08)`): kanban cards, and currently the navigation drawer.

### Named Rules
**The Flat-By-Default Rule.** Surfaces separate by tone and hairlines first. A shadow means "this sits above its ground", never decoration.

## Shapes

Gently rounded corners throughout, from two radius tokens: controls and cards at 6px (`--radius-control`: buttons, search, nav items, stage tabs, kanban cards) and wells and panels at 8px (`--radius-panel`: kanban columns, the empty-state panel). Pills and stage dots are fully round. Borders are 1px Hairline. There are no thick coloured side borders, no hard offset shadows and no decorative shapes.

## Components

Quiet, familiar, and exact. Every control is a native element styled with role tokens; there is no component library dependency.

### Buttons
- **Shape:** gently rounded (6px), 14px horizontal padding, 600 weight at 13px, 44px tall below 1024px and 34px on desktop.
- **Primary:** Action Blue ground, white label; hover at 90% opacity. One per page header.
- **Secondary (default variant):** white ground, 1px Hairline border, Ink label; hover to Cool Ground.
- **Disabled:** 50% opacity and a not-allowed cursor, with a `title` explaining why (e.g. "New agreement" until the builder ships).
- **Transition:** colour only, 150ms.

### Chips (status pills)
- **Stage:** an 8px round stage-colour dot beside the stage label in 600 Ink. Always labelled.
- **Tone pills:** fully rounded, 2px 8px padding, 600 at 11px. Attention (#fef3c7 / #92400e) for states needing action; neutral (Board Grey / Slate Secondary) for informational badges such as "Sample data".

### Cards / Containers
- **Kanban card:** white, 6px radius, 10px 12px padding, Card shadow, no border. Site name (card title), the customer beneath it and the meta line in Slate Secondary, an optional attention pill, then a footer row with visits per year on the left and the annual amount (600 Ink, `/yr`) on the right.
- **Kanban column:** Board Grey well, 8px radius, 10px padding; header with dot and label, count and right-aligned annual total; "No agreements" when empty.
- **Empty-state panel:** white, 8px radius, 1px Hairline border, centred, 48px vertical padding, with a secondary button to recover (e.g. "Clear search").

### Inputs / Fields
- **Search:** white, 1px Hairline border, 6px radius, a 14px magnifier icon in Slate Secondary inset on the left, placeholder in Slate Secondary; 44px tall below 1024px, 34px on desktop. It has no visible label, so an accessible name is required.
- **Focus:** the global ring (below).
- **TextInput** ([web/components/ui/text-input.tsx](web/components/ui/text-input.tsx)): a visible 13px label (500) above the field; the field matches Search without the icon. With an error, the border turns Danger, a 12px Danger message sits under the field, and the input gets `aria-invalid` and `aria-describedby` pointing at it. First used on `/login`.
- **Select** ([web/components/ui/select.tsx](web/components/ui/select.tsx)): a native `<select>` with the same visible label, 44px/34px height, Danger border and linked message as TextInput. First used for the governing province on `/settings`.
- **Empty-state panel** is the shared `EmptyPanel`; list screens (Customers, site register) use it with a title, one line of text and, for a search with no match, a Clear search button.

### Focus
Every focusable element gets the global `:focus-visible` treatment: a 2px solid Action Blue outline with a 2px offset. Components do not override it.

### Navigation
- **Sidebar items:** 500 weight at 13px, 10px padding, 6px radius, 2px apart; resting in Nav Ink with a Cool Ground hover; the active item (`aria-current="page"`) in Action Blue on Action Tint; items without a page are disabled in Slate Secondary.
- **Mobile and tablet:** the top bar and drawer described in Layout; drawer items are 44px tall.
- **Stage tabs (mobile pipeline):** 44px, 6px radius, 1px border; unselected white with Hairline border and Ink label, count in Slate Secondary; selected Action Tint with Action Blue border, label and count.

## Do's and Don'ts

### Do:
- **Do** benchmark every screen against Linear, Stripe Dashboard, Attio/HubSpot and Jobber/Housecall Pro. It should look at home next to them.
- **Do** show the count and the annual CAD total on every pipeline column and grouped list.
- **Do** pair every stage colour with its text label (The Status Is Never Colour Alone Rule).
- **Do** use the product's plain status language: "In progress", "Sent to customer", "Accepted, awaiting signature", "Completed", "Refused".
- **Do** format every amount with `formatCad` and end per-year amounts in `/yr`.
- **Do** keep every control at 44px tall below 1024px, and never hide an action behind hover alone.
- **Do** add a new colour, radius or shadow as a token in `globals.css` first, then record it here.
- **Do** let the tenant's logo and accent colour lead on everything the customer sees.

### Don't:
- **Don't** add texture, illustration, gradients, glass or decorative colour inside the app. The user chose the standard look, played straight.
- **Don't** use stage colours for anything other than status.
- **Don't** use arbitrary hex values or Tailwind's default palette in components; the palette is closed.
- **Don't** hard-code any company name or brand into customer-facing output.
- **Don't** use a coloured `border-left` stripe above 1px on cards or alerts. Use a pill or a tinted note instead.
- **Don't** let the board scroll the whole page sideways.
