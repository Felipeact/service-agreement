---
name: Service Agreement
description: Familiar, precise SaaS for trade-contractor estimators, warmed up. The category standard built to the craft of Linear, Stripe, Attio and Jobber, on a navy shell with a display face, stage-tinted wells and authored drawings.
colors:
  ground: "#f3f5f9"
  surface: "#ffffff"
  board: "#e9edf3"
  hairline: "#e2e6ec"
  field: "#7d8798"
  ink: "#101b2c"
  ink-2: "#5b6779"
  ink-nav: "#344158"
  night: "#0f1c2e"
  night-ink: "#b4c0d0"
  action: "#2563eb"
  action-tint: "#eef2ff"
  stage-in-progress: "#2563eb"
  stage-sent: "#f59e0b"
  stage-accepted: "#8b5cf6"
  stage-completed: "#10b981"
  stage-refused: "#ef4444"
  tint-in-progress: "#e8effd"
  tint-sent: "#fdf1d8"
  tint-accepted: "#eee9fd"
  attention-bg: "#fef3c7"
  attention-fg: "#92400e"
typography:
  headline:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
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
  control: "8px"
  panel: "12px"
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
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-ink}"
    width: "240px"
---

# Design System: Service Agreement

## Overview

**Creative North Star: "The Well-Run Office"**

The user chose the category standard on purpose, and on 2026-11-06 asked for it to be warmer ("too dry"). The structure stays the one anyone who has used a modern SaaS tool knows: a left sidebar, a page header with search and one primary action, white cards on column wells. What changed is the richness: a deep navy shell, a display face for titles, stage-tinted wells, layered depth and authored drawings in the quiet moments. The benchmark is four products the user named: **Linear** (density, speed, keyboard reach), **Stripe Dashboard** (money in tables, statuses, forms and detail pages), **Attio / HubSpot CRM** (deal pipelines, record pages with properties and activity) and **Jobber / Housecall Pro** (plain, friendly language for the trades and a clear quote-to-job flow). A screen is done when it could sit next to any of these and not look like the cheaper one.

Density is moderate to high: the base text size is 13px and desktop controls are 34px tall, so lists and boards show a lot without crowding; below 1024px everything a finger touches grows to 44px. Expression lives in precise details (tabular figures, honest status labels, exact counts and annual totals in column headers) and in a few authored moments: a display face for titles, columns tinted with their stage, cards that settle into place once when the board loads, and small line drawings where a column or list is empty. Decoration never carries meaning and never competes with the money. Customer-facing surfaces (review portal, PDFs, emails) are not warmed yet; when they are, they use the same structure but wear the **tenant's** logo and accent colour, never the product's mark, navy or illustrations.

The palette is closed in code: `web/app/globals.css` clears Tailwind's default colours (`--color-*: initial`) and declares only the role tokens below, so a component can only reach for a role, never a raw hue.

**Key Characteristics:**
- Familiar SaaS layout: a 240px navy left sidebar, a page header with a one-line standing, search and one primary action, and the work area below.
- Cool-grey ground, white surfaces, a navy shell and one blue accent for action and selection; the three open stages are tinted with their own hue.
- Five stage colours that carry pipeline meaning, always paired with a text label.
- Tabular money in CAD, whole dollars without decimals, per-year amounts ending in `/yr`, and a count plus total on every pipeline column.
- Plain trade language ("Sent to customer", "Accepted, awaiting signature"), not jargon.

## Colors

A restrained, closed palette of 24 role tokens: cool neutrals, a navy shell, one blue for action, a fixed set of stage colours that only ever mean status (and their three well tints), one attention pair, and one danger red for field errors. Each token is exposed by Tailwind 4 as utilities (`bg-*`, `text-*`, `border-*`), e.g. `--color-ink-2` is `text-ink-2`.

### Primary
- **Action Blue** (`--color-action`, #2563eb): the primary button ("New agreement"), the active sidebar item (white text on blue), the selected stage tab's text and border, the product mark and the 2px focus ring. Used for actions and selection, never for decoration. Primary hover is the same blue at 90% opacity.
- **Action Tint** (`--color-action-tint`, #eef2ff): the ground of the selected stage tab and the filter toggle when pressed.

### Neutral
- **Ink** (`--color-ink` / `text-ink`, #101b2c): body text, headings, card titles and money figures. At 50% opacity it is the drawer backdrop.
- **Slate Secondary** (`--color-ink-2` / `text-ink-2`, #5b6779): metadata, captions, column counts and totals, empty-state text, placeholder text and the search icon. 5.74:1 on white, 5.26:1 on Cool Ground, 4.88:1 on Board Grey and at least 4.84:1 on every stage well tint.
- **Nav Ink** (`--color-ink-nav` / `text-ink-nav`, #344158): secondary text on light surfaces, one step softer than Ink.
- **Hairline** (`--color-hairline` / `border-hairline`, #e2e6ec): secondary-button borders, unselected stage tabs, panel borders and dividers. It is a divider, not a control boundary: against white it measures 1.25:1.
- **Field Grey** (`--color-field` / `border-field`, #7d8798): the border of every form field (search, text input, select, textarea, the read-only link fields). 3.63:1 on white and 3.32:1 on Cool Ground, so a field's edge meets WCAG 1.4.11. Never used for dividers or panels.
- **Board Grey** (`--color-board` / `bg-board`, #e9edf3): the wells of the closed stages (at 60%) and the neutral pill ground.
- **Cool Ground** (`--color-ground` / `bg-ground`, #f3f5f9): the page background behind the work area, and the hover ground for secondary buttons.
- **Surface White** (`--color-surface` / `bg-surface`, #ffffff): cards, panels, inputs and secondary buttons; also the label colour on Action Blue and on the navy shell.

### The shell
- **Night** (`--color-night` / `bg-night`, #0f1c2e): the desktop sidebar, the mobile top bar, the drawer and the sign-in panel. The shell is the product's own and is never used on customer-facing surfaces.
- **Night Ink** (`--color-night-ink` / `text-night-ink`, #b4c0d0): resting nav text, the tenant's company name and the email on Night (9.29:1). Hover and active text is Surface White (17.13:1). A field on Night is Surface White at 10% with a Surface White 40% border (3.78:1, so its edge holds 3:1); a divider on Night is Surface White at 10%.

### Stage colors (status only)
Each stage has its own token even where the hue repeats, so stage meaning and action meaning can diverge later without a hunt.
- **In progress** (`--color-stage-in-progress`, #2563eb): the same blue as Action Blue, deliberately.
- **Sent to customer** (`--color-stage-sent`, #f59e0b): amber.
- **Accepted, awaiting signature** (`--color-stage-accepted`, #8b5cf6): violet.
- **Completed** (`--color-stage-completed`, #10b981): green.
- **Refused** (`--color-stage-refused`, #ef4444): red.

Stage colours appear only as an 8px dot beside the stage label (column headers, stage tabs). They are never used as text. The three open stages also tint their column well (the stage hue at about 8%: `--color-tint-in-progress` #e8effd, `--color-tint-sent` #fdf1d8, `--color-tint-accepted` #eee9fd), so the work in play reads by colour at a glance; the closed stages stay a quiet neutral. Cards stay white on every well.

- **Attention pill** (`--color-attention-bg` #fef3c7 ground, `--color-attention-fg` #92400e text): "Changes requested", "Awaiting countersignature", "Not viewed" and the follow-up labels ("Idle for 19 days", "No reply in 9 days", "Unsigned for 12 days") on a card that needs the estimator's action. A column header and a mobile stage tab use the same pair for the count of such cards ("3 to follow up"). The same pair is the tinted notice on the sign-in screen (expired link, rate limit).
- **Danger** (`--color-danger`, #b91c1c): a field's error message and its border. 6.47:1 on white.

### Named Rules
**The Status Is Never Colour Alone Rule.** Every stage dot sits next to its text label; `StatusPill` makes `label` a required prop. Colour speeds up scanning but never carries meaning by itself.

**The Closed Palette Rule.** The 18 tokens in `globals.css` are the only colours in the app. A new colour is a new role token added there and recorded here, never an arbitrary value in a component.

**The Tenant Wears the Accent Rule.** Action Blue, Night and the product mark belong to the product's own screens. On the customer portal, PDFs and emails, the tenant's accent colour takes the action and brand roles, falling back to Ink when the tenant's colour fails 4.5:1 against white. (Not yet built; it binds the first customer-facing surface.)

## Typography

**Display Font:** Bricolage Grotesque, loaded through `next/font/google` as `--font-bricolage` (utility `font-display`), for the voice of a screen: page titles, stage names, the product name, empty-state titles and the sign-in headline. It is never used for money, counts, dates or body text.

**UI Font:** Inter, loaded through `next/font/google` as `--font-inter`, with system-ui, -apple-system, "Segoe UI", sans-serif behind it. It carries everything else.

**Character:** Inter is the neutral workhorse the category expects; Bricolage Grotesque adds a confident, slightly condensed voice so titles feel authored rather than default.

`font-variant-numeric: tabular-nums` is set on `body`, so every figure in the app (money, counts, dates) lines up without per-element opt-in.

### Hierarchy
- **Page title** (display, 600, 26px, 1.25, tracking -0.025em): one per page ("Pipeline"), with an optional one-line standing beneath it in Slate Secondary 13px ("3 need follow-up · $59,890/yr open"). The product name on the shell is display 600 at 16px.
- **Empty-state title** (display, 600, 16px): e.g. `No agreements match "…"`. A stage name in a column header is display 600 at 14px.
- **Card title** (600, 13.5px, 1.375): the site name on a kanban card, wrapped, never truncated.
- **Body** (400, 13px, 1.45): the base size for the whole app; buttons (600), nav items (500), stage tabs and column headers (600) all sit at 13px.
- **Meta** (400 or 500, 12px): card metadata, visits per year, column totals, "No agreements".
- **Pill label** (600, 11px, 16px line): attention and neutral pills.

### Named Rules
**The Money Lines Up Rule.** Money is always tabular and in CAD, formatted by `formatCad` (`web/lib/money.ts`) from integer cents with `en-CA` currency formatting: whole-dollar amounts drop the decimals ($14,280), any amount with cents keeps two ($14,280.50). Per-year amounts end in `/yr`. Never format money inline.

## Layout

**Breakpoints** (Tailwind defaults): mobile below 768px, tablet 768-1023px (`md`), desktop 1024px and up (`lg`). The page header's control row also goes horizontal from 640px (`sm`).

**Shell.** On desktop the shell is a two-column grid: a sticky, full-height **Night sidebar** (240px, 12px side padding) and the work area. The sidebar holds the product mark and name over the tenant's company name (wrapped, never truncated), then a search field (a GET form to `/search?q=`, 34px tall, the Night field), then Pipeline, Agreements, Customers, Sites & equipment, Imports, Task library, with Settings pinned to the bottom above a divider. A resting item is Night Ink, hover lifts to a Surface White 10% ground and white text, the current page is white on Action Blue. Items without a page render disabled at 60% Night Ink (none today). Below 1024px the sidebar is replaced by a sticky 56px Night top bar with a 44px menu button that opens a **drawer**: a 272px Night panel from the left over an Ink 50% backdrop, a modal dialog with focus moved to its close button, closed by Escape, the backdrop or navigating, with focus returned to the menu button. The top bar also carries a 44px Search link to `/search` at its right edge.

**Work area.** Cool Ground, with horizontal padding 16px (mobile), 24px (tablet), 32px (desktop) and 24px vertical (28px on desktop). **Every page fills the width it is given: there is no centred maximum width**, so a wide screen shows more columns and longer rows rather than empty margins, and the content's left and right edges are the same on every page. The page always reserves its scrollbar's width (`scrollbar-gutter: stable`), so moving between a long page and a short one never shifts the layout. On desktop a slim **top bar** (56px, Cool Ground at 90% with a Hairline bottom edge) sits over the work area: today's date at the left; at the right the **follow-up bell** (a link to `/pipeline?followups=1`, the board narrowed to the agreements that need follow-up, with a red count badge when any do) and the company name over "Workspace". Below 1024px the bell sits in the Night top bar beside Search as a 44px target with a red dot. Each page opens with a **page header**: the title (and an optional badge) on the left, then search/filters and the single primary action on the right; it stacks vertically on mobile.

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
- **Desktop (>=1024px):** a five-column grid that fits the work area with no scroll. From 1280px the open stages (In progress, Sent, Accepted) are 15% wider than the closed ones (Completed, Refused), so the columns an estimator works in get the room.

Columns are wells with 10px padding and 8px between cards; columns sit 14px apart. An open stage's well is tinted with its stage hue; a closed stage is a paler neutral (Board Grey at 60%). Each column header is two lines so every column's first card starts at the same height: the stage dot, label and card count with an attention pill "N to follow up" at the right when any card needs it, then the column's annual total beneath. A closed column's total says what the money was ("$18,800/yr signed", "$31,480/yr not won") so it is never read as pipeline value. Below 768px the stage tab already names the stage and its count, so the header keeps only the total (and the pill) and leaves the name to screen readers.

Open columns list the longest-waiting deal first; closed columns list newest first.

**Page header.** The title, a one-line standing under it, and the single primary action on the right (a plus icon and its label). The app has one search, the sidebar's (a `/` key focuses it); a page adds its own only to narrow a list on that page (Agreements, Customers). The Pipeline has none: its title is a greeting ("Good morning, Jamie", the name read from the member's email when it plainly holds one, otherwise just "Good morning") at 30-34px, over the line "Keep every service agreement moving from equipment list to signature."

**Control height.** Every interactive control (buttons, search, nav items, stage tabs, icon buttons) is 44px tall below 1024px; on desktop buttons and search are 34px and nav items 36px.

### Named Rules
**The Board Never Scrolls the Page Rule.** Horizontal overflow on the pipeline is contained in the board; the page itself never scrolls sideways.

## Elevation & Depth

Depth is layered and soft: Cool Ground, then a stage well, then a Surface White card resting on a soft bed. Three shadow tokens, all tinted with Night rather than black, each with an offset and a blur.

### Shadow Vocabulary
- **Card** (`--shadow-card`, `0 1px 2px` and `0 2px 8px -2px`, Night at 6% and 8%): kanban cards and the empty-state panel at rest.
- **Lift** (`--shadow-lift`, `0 2px 4px` and `0 12px 24px -10px`, Night at 8% and 22%): a kanban card on hover, with a 1px rise (200ms).
- **Panel** (`--shadow-panel`, `0 1px 2px` and `0 16px 40px -16px`, Night at 6% and 28%): the sign-in card and the navigation drawer, the surfaces that float.

### Named Rules
**The Above-Its-Ground Rule.** A shadow means "this sits above its ground". Surfaces separate by tone first; the shadow tokens are the only depth, and none is a coloured halo or a hard offset.

## Shapes

Softly rounded corners throughout, from two radius tokens: controls and cards at 8px (`--radius-control`: buttons, search, nav items, stage tabs, kanban cards) and wells and panels at 12px (`--radius-panel`: kanban columns, the empty-state and sign-in panels). Pills and stage dots are fully round. Borders are 1px Hairline. There are no thick coloured side borders and no hard offset shadows.

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
- **Kanban card:** white, 6px radius, 10px 12px padding, Card shadow, no border. Site name (card title), the customer beneath it (omitted when it is the site's own name), the number and version, the age ("Updated 9 days ago"), neutral pills (Renewal, Expired) then attention pills (the attention label, then the follow-up label once the deal has sat past its stage's threshold: In progress 14 days, Sent 7, Accepted 7), then a footer row with visits per year on the left and the annual amount (600 Ink, `/yr`) on the right. A card with no service lines says "No service lines yet" in that slot. A closed-stage card recedes: 500-weight title and a Slate Secondary amount.
- **Kanban column:** a well at 12px radius and 10px padding: tinted with the stage hue for the three open stages, Board Grey at 60% for the closed two; two-line header (see Layout), the stage name in the display face; each stage's own empty text with a small line drawing above it for the open stages (a clipboard, an envelope, a signed page), text only for the closed ones: "No drafts in progress", "Nothing is waiting on a customer", "Nothing is waiting on a signature", "No signed contracts yet", "No refused or expired agreements".
- **Pipeline summary cards:** three cards under the greeting. **Open pipeline** is a Night card with white text: the annual CAD total of the open stages in the display face at 32px, and "N agreements in motion, per year". **Waiting on customer** is a white card with a clock: the count of Sent agreements and "Sent, no decision yet". **Follow-ups due** is the board's filter as a pressed-state button: an attention-tinted card with a bell while some are due ("Needs attention. Tap to filter the board."), an Action Tint card with a border while the filter is on, and a plain white one with "Nothing is overdue" at zero. On phones the first card is full width and the other two share a row.
- **Product mark:** a rounded square in Action Blue holding a three-quarter cycle and a tick in Surface White strokes, beside the product name on the Night sidebar (32px), top bar (24px), drawer (32px) and sign-in page (36px). The tenant's company name sits under the name in Night Ink, 500 at 12px, and wraps rather than truncates. The mark is the product's own and is never used on the portal, PDFs or emails.
- **Illustrations** ([web/components/ui/illustrations.tsx](web/components/ui/illustrations.tsx)): authored line drawings at one 1.6px weight in the current text colour, with Action Blue for the one thing that matters in each, always `aria-hidden` and always beside text that says the same thing. Three 64px spot drawings (`clipboard`, `envelope`, `signature`) for empty open columns and the all-clear panel, and one rooftop air-handling unit under a sun and a snowflake joined by a dotted arc (the two service seasons) for the sign-in panel and the empty board. They fill quiet moments only: never behind data, never in a list or a table.
- **Sign-in page:** two panels from 1024px, the Night panel (the mark, the headline "From equipment list to signed agreement." in the display face at 48px, the rooftop scene, one purpose line) beside the form card on Cool Ground; below 1024px the panel is a short band with the mark and one purpose line over the card, and the drawing is left out so the form is the first thing a phone shows.
- **Empty-state panel:** white, 12px radius, 1px Hairline border and the Card shadow, centred, 48px vertical padding, an optional drawing above a display-face title, and a secondary button to recover (e.g. "Clear search").

### Inputs / Fields
- **Search:** white, 1px Field Grey border, 6px radius, a 14px magnifier icon in Slate Secondary inset on the left, placeholder in Slate Secondary; 44px tall below 1024px, 34px on desktop. It has no visible label, so an accessible name is required. The sidebar's search is the Night field (Surface White at 10% with a 40% border) with a `/` key hint at its right edge on desktop; the key focuses it from anywhere unless the visitor is typing in a field.
- **Focus:** the global ring (below).
- **TextInput** ([web/components/ui/text-input.tsx](web/components/ui/text-input.tsx)): a visible 13px label (500) above the field; the field matches Search without the icon. With an error, the border turns Danger, a 12px Danger message sits under the field, and the input gets `aria-invalid` and `aria-describedby` pointing at it. First used on `/login`.
- **Select** ([web/components/ui/select.tsx](web/components/ui/select.tsx)): a native `<select>` with the same visible label, 44px/34px height, Danger border and linked message as TextInput. First used for the governing province on `/settings`.
- **Checkbox** (first used in the service line form, [web/components/agreements/line-form.tsx](web/components/agreements/line-form.tsx)): a native `<input type="checkbox">` at 16px tinted with `accent-action`, wrapped with its text in one `<label>` that is the touch target: 44px tall below 1024px and 34px on desktop, 6px radius, 1px Hairline border on Surface White; checked (`has-[:checked]`) the border turns Action Blue on Action Tint. A group sits in a `<fieldset>` with a 13px (500) `<legend>`, and its error is a 12px Danger message under the group linked by `aria-describedby`. The visit-month grid is twelve such labels, six columns below md (each cell about 44px wide, so the box sits above its three-letter month) and twelve from md (box beside the month), under the preset buttons (secondary); colour never carries the checked state alone, the box itself shows it.
- **Seasonal task** (Service included and Visit schedule, [web/components/agreements/service-scope.tsx](web/components/agreements/service-scope.tsx), [web/components/agreements/visit-schedule.tsx](web/components/agreements/visit-schedule.tsx)): in a checklist, a task that applies at some visits only reads `Check belts (Apr–Sep visits)`, with its months as runs joined by an en dash and nothing extra for a task done at every visit. On the staff page only, a seasonal task no line visits gets an attention-pair tag after it, `No visit in these months` (12px 500, 2px radius, 2px 6px padding); the customer page and the PDF never show it. In the Visit schedule, a month row keeps its equipment names in Slate Secondary and lists each seasonal task due that month beneath them in Ink, as `Rooftop unit: Inspect heat exchanger during heating season`; the PDF prints the same lines under the month.
- **Term section** ([web/components/agreements/term-section.tsx](web/components/agreements/term-section.tsx)): a panel between the send controls and Service lines, 13px semibold "Term" heading over one Slate Secondary line (`Term: Jan 1, 2027 – Dec 31, 2027 · 12 months` or `Start date not set · 12 months`). For a writer on an editable draft, a native date input and a months input (TextInput, 44px below desktop, 34px on desktop) and a secondary "Save term" button, stacked on phones and in one row from md; errors sit under their field. On the PDF and the review page the term is one plain line under the agreement's meta line.
- **Expiring soon** ([web/components/kanban/expiring-view.tsx](web/components/kanban/expiring-view.tsx)): an action-coloured "Back to the board" link above a "Expiring soon" page header, then one hairline-divided panel of rows. Each row: the site as a 13.5px semibold link, customer and number in 12px Slate Secondary, the state label under them (wraps), and "Ends <date>" with the bold `$x/yr` total on the right from sm, stacked under it on phones. Empty: the centred panel "No agreements end in the next 90 days." The board links to it from beside its title.
- **Renewal pill:** a renewal's kanban card shows a neutral `StatusPill` "Renewal" before any attention pill; the agreement page lists "Renewal of AG-x" / "Renewed by AG-y" links beside the customer and site links.
- **Empty-state panel** is the shared `EmptyPanel`; list screens (Customers, site register) use it with a title, one line of text and, for a search with no match, a Clear search button.

### Focus
Every focusable element gets the global `:focus-visible` treatment: a 2px solid Action Blue outline with a 2px offset. Components do not override it.

### Navigation
- **Sidebar items:** 500 weight at 13px, 10px padding, 8px radius, 2px apart, a 150ms colour transition; resting in Night Ink; hover a Surface White 10% ground with white text; the active item (`aria-current="page"`) white on Action Blue; items without a page are disabled at 60% Night Ink (none today).
- **Mobile and tablet:** the top bar and drawer described in Layout; drawer items are 44px tall.
- **Stage tabs (mobile pipeline):** 44px, 8px radius, 1px border; unselected white with Hairline border and Ink label, count in Slate Secondary; selected Action Tint with Action Blue border, label and count. A tab with cards to follow up carries an attention-pair count after its own.

## Screens
These pages carry the system's richer pieces. Ideas for several were taken from reference screens the owner shared (2026-11-06); the palette, shell and voice stay the navy and blue they chose.

- **Pipeline:** the greeting and three summary cards (see Components), then "Agreement pipeline" (a display-face heading, "Aging starts when an agreement enters each stage." and a "View list" link). The board is six columns in a row that scrolls inside its own container from tablet up: the five stages, then **Expiring soon** beside Refused with the same header and card structure (an attention pill "Ends Dec 31", a clock and the days left in red, the site, the customer, the number, what renewal does, the annual amount and a chevron; its title links to the full list). A card opens with its number and an age beside a clock (red once the deal needs follow-up), then the site, the customer, any pills, and the money over a hairline with a chevron.
- **Recent equipment imports:** under the Pipeline board, a white panel (display-face heading, "Messy files, structured into priceable assets.", a "View all" link to Imports) listing the three newest imports: the file, its site and customer, how much was recognized ("27 of 31 rows recognized", or its outcome line) and a status pill with a chevron; a reviewable list links to its rows, any other to its site's import page. With no imports the panel is left out.
- **Agreements:** four summary cards (all, with the customer, need follow-up, open value with the accepted amount beneath), a segmented status control in a Board Grey tray (each segment a link; the current one white on a card shadow) beside an "Expiring soon" toggle link and a list search, then a panel of rows: the site in the display face with the customer, number and version under it, a tinted stage pill (the stage's soft ground and its darker ink), the annual amount, the age with a clock (red when stale) and a chevron. A `?site=` filter shows as a line with "Show every site".
- **Customers:** a two-column grid of cards: an initials tile, the name in the display face, Sites and Assets figures between hairlines, and the primary contact with a chevron. The header's standing line totals customers, sites and assets.
- **Sites & equipment:** laid out like Agreements: four summary cards (sites, assets, live agreements, and **Ready to quote**: sites with equipment and no live agreement), a segmented control (All, With a live agreement, No live agreement) beside a customer picker that navigates on change, a "Show inactive" toggle link and a list search, then a panel of rows: the site in the display face over its address, the customer, the equipment types as small tiles ("RTU ×4", the first three and then "+n more") over the asset count, and the live agreement with its tinted stage pill.
- **Imports:** a dashed drop banner first (a sheet-with-arrow drawing, "Drop a customer equipment list here", "Choose file"): a file dropped or chosen there opens the New agreement dialog with it. Status chips follow, then one card per import: a file tile, the name, site, customer, size, who and when, its status pill, and beneath a hairline either a **Recognition** bar with "N recognized · M flagged" (once the rows are found) or its outcome line, and a link to review it.
- **Settings:** a section list at the left on desktop (Company, Default terms, Renewal, and a link out to Members) beside three white cards, each with a display-face heading, a line saying what the section is for and a two-column grid of fields. The Company card opens with a **brand preview**: a tile in the tenant's accent colour holding the initials of the company name in whichever of white or near-black reads better on it (`contrastText`), the name and the address and phone, updated as the form is typed; the accent field has a swatch beside it. Saving is a solid white bar pinned to the bottom of the page, so the button is never a scroll away; a member who cannot edit sees the fields read-only and a quiet note.
- **Members:** three summary cards (members, owners and admins, and for those who manage, pending invitations), an **Invite someone** card (a plus tile, a heading, one line, and the email, role and send controls in a row), then the people as rows: an initials disc, the email with a "You" pill, the join date, and a role pill at the right (Owner in Action Tint, the others neutral). For an owner or admin each other member has a **Manage** disclosure that opens the role picker and the two-step Remove, so the list reads as people first and controls second. Pending invitations are the same rows with a mail disc, the invited and expiry dates, and Resend and Revoke.
- **New agreement dialog:** a native modal on a blurred Ink 40% backdrop, 16px radius, Panel shadow. It leads with the equipment-list drop zone (drag a file in or choose one; a bad file is refused with its reason under the zone), then "Who is it for?": a customer select that ends in "+ Add a new customer…", then a site select (the customer's sites without a live agreement, busy ones disabled with their number, ending in "+ Add a new site…"); a new customer always gets a new site. One button creates what is missing, starts the draft, sends the list to the site, reads it, finds the equipment and opens its review with a way back to the agreement.

## Public site

The marketing pages (`/`, `/product`, `/demo`, `/trades`, `/pricing`, `/about`, `/faq`, `/contact`, `/register`) are a Persuade surface on the same tokens. They are built from [web/components/site/](web/components/site/): a header on the first section's own ground (light, Night or Action Blue), one 1180px content width, alternating Surface and Cool Ground bands, Night closing band and footer, and display-face headlines up to 76px on the home. Product visuals are synthetic sample-data components (`BoardMock`, `AgreementMock`, `ScheduleMock`, `PortalMock`), each labelled "Sample data". Motion is two authored moments (a signature drawing itself, visit months rising), both off under reduced motion. On Night and Action grounds the focus ring turns white (`.ring-on-dark`). Three home concepts exist for the owner to choose from (see CONTEXT.md, Public site); the others are deleted once one is chosen.

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
- **Don't** add texture, gradients, glass or colour that carries no meaning. Colour in the app is the navy shell, Action Blue, the stage colours and tints, and the attention pair; drawings stay in empty and sign-in moments (they were forbidden entirely until 2026-11-06).
- **Don't** use stage colours for anything other than status.
- **Don't** use arbitrary hex values or Tailwind's default palette in components; the palette is closed.
- **Don't** hard-code any company name or brand into customer-facing output.
- **Don't** use a coloured `border-left` stripe above 1px on cards or alerts. Use a pill or a tinted note instead.
- **Don't** let the board scroll the whole page sideways.
