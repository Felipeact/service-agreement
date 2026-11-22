---
name: Field Protocol
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-tabular:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style
This design system is engineered specifically for commercial and residential trade contractors—HVAC technicians, master plumbers, and licensed electrical contractors across Canada. The product addresses service agreements, preventative maintenance schedules, and warranty execution, where operational clarity directly drives revenue and field accountability.

The interface aesthetic pairs Modern Corporate clarity with pragmatic Swiss Utility. Visual noise is actively eliminated to accommodate fast-paced workflows between office dispatchers, estimators, and operations heads. The emotional posture is dependable, lucid, and rigorously organized: it projects institutional trust without bureaucratic weight. High information density is balanced by absolute typographic discipline, structured slate delineations, and immediate status recognition across large inventories of recurring service contracts.

## Colors
The palette leverages a crisp, hyper-legible light mode framework with high contrast ratios exceeding WCAG AAA standards for data integrity.

### Core Canvas & Structure
- **Canvas Base:** `#FFFFFF` serves as the primary card and table surface.
- **Canvas Sub-layer:** `#F8FAFC` anchors the overarching viewport background and page headers.
- **Surface Muted:** `#F1F5F9` is reserved for table header tracks, disabled states, and nested section bars.
- **Border Default:** `#E2E8F0` provides crisp structural demarcation without visual distraction.
- **Border Strong:** `#CBD5E1` delineates active inputs, active table rows, and dividers.

### Typography Hierarchy
- **Text Primary:** `#0F172A` (deep slate navy) for all headlines, contract titles, currency totals, and table data.
- **Text Secondary:** `#334155` for table column labels, section descriptions, and sub-headers.
- **Text Muted:** `#64748B` for meta captions, timestamps, and secondary identifiers.

### Brand & Interactive States
- **Primary Base:** `#2563EB` (vivid royal blue) driving standard primary actions, focused controls, and critical navigational highlights.
- **Primary Hover:** `#1D4ED8`.
- **Primary Active/Pressed:** `#1E40AF`.
- **Primary Subtle:** `#EFF6FF` for selection indicators and active navigation pills.

### Workflow Stage Semantics
Lifecycle status badges and pipeline progress bars adhere strictly to consistent, purpose-built chromatic roles:
- **In Progress:** Blue (`#3B82F6` text/border on `#EFF6FF` fill).
- **Sent:** Amber (`#F59E0B` text/border on `#FFFBEB` fill).
- **Accepted:** Purple (`#8B5CF6` text/border on `#F5F3FF` fill).
- **Completed:** Emerald (`#10B981` text/border on `#ECFDF5` fill).
- **Refused / At Risk:** Red (`#EF4444` text/border on `#FEF2F2` fill).

## Typography
Typographic precision is essential for contract ledgers, service tier breakdowns, and equipment serial logs. `Inter` is utilized universally to maximize legibility across varying viewports and data densities.

### Rules & Formatting
- **Tabular Numerics:** All currency indicators (CAD), recurring service billing values, metrics, and timestamps must render with `font-feature-settings: "tnum" on, "cv05" on` to enforce fixed-width alignment inside data matrices.
- **Section Headers:** Uppercase tracking is constrained solely to table headers and micro-labels (`label-sm`), styled with `letter-spacing: 0.05em` and transformed to uppercase to cleanly isolate meta-descriptors from real-world agreement data.
- **Hierarchy Restraint:** Avoid gratuitous font scale jumps. The density of B2B workflows favors compact body scales (`body-md` at 14px as standard workhorse) to ensure comprehensive screen real estate utilization.

## Layout & Spacing
The layout architecture utilizes an anchored responsive grid designed for heavy administrative utilization on desktop displays, paired with reliable tablet reflow for site managers and dispatch monitors.

### Grid Specifications
- **Desktop (>= 1280px):** 12-column fluid grid locked within a maximum canvas width of `1600px`. Gutters sit at `gutter-lg` (`2rem`) with page margins at `margin-lg` (`2.5rem`).
- **Tablet / Laptop (768px - 1279px):** 8-column layout. Gutters scale to `gutter-md` (`1.5rem`) with outer padding of `margin-md` (`1.5rem`). Complex tables toggle horizontal overflow container panning.
- **Mobile (< 768px):** 4-column layout with `gutter` (`1rem`) and `margin` (`1rem`). Data grids collapse into vertical transactional cards.

### Layout Principles
- **Density Stacking:** Vertical space within cards and panels is kept tight (`space-sm` to `space-md`) to ensure critical workflow actions—such as sign-off triggers, technician allocations, and revision logs—remain visible above the fold.
- **Spatial Consistency:** Use `space-md` (`1rem`) as the baseline rhythm token for internal component cell padding and form group separation.

## Elevation & Depth
Depth is produced through subtle structural hierarchy, crisp 1px borders, and shallow ambient drop shadows. Heavy blurs and floating elevations are deliberately avoided to prevent visual distraction during detailed contract drafting.

### Tiers & Elevation Strategy
- **Layer 0 (Canvas):** `#F8FAFC`. The foundational backdrop for the web application shell.
- **Layer 1 (Surfaces & Cards):** `#FFFFFF` paired with an outline of `1px solid #E2E8F0`. Shadows are minimal and neutral: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Layer 2 (Dropdowns, Popovers, & Context Actions):** `#FFFFFF` with `1px solid #E2E8F0` and an ambient shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Layer 3 (Modals, Service Pact Approvals, Drawer Overlays):** `#FFFFFF` surfaced above an backdrop overlay (`#0F172A` at 40% opacity), elevated with `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.
- **Surface Transitions:** Active, selected, or drag-hover records shed shadows entirely in favor of an inset primary boundary (`2px solid #2563EB`) or a surface tone switch to `#F8FAFC`.

## Shapes
A clean, soft geometry (`roundedness: 1`) provides professional restraint. Components use slight corner radials (`0.25rem` / 4px) to retain structural authority without feeling rigid.

### Specific Geometry Assignments
- **Input Fields, Dropdowns, and Buttons:** `0.25rem` (4px). Keeps interactive zones sharp, functional, and consistent with administrative tooling.
- **Cards, Modals, and Surface Panels:** `rounded-lg` (`0.5rem` / 8px). Defines parent grouping borders cleanly.
- **Status Badges & Value Counts:** Strictly pill-shaped (`9999px`) to maintain unmistakable differentiation between actionable button interfaces and passive state identifiers.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, radius `4px`, padding `8px 16px`. Hover `#1D4ED8`. Active state `#1E40AF`.
- **Secondary:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`, radius `4px`. Hover background `#F8FAFC`, border `#CBD5E1`.
- **Destructive:** Background `#FEF2F2`, text `#EF4444`, border `1px solid #FCA5A5`. Hover background `#EF4444`, text `#FFFFFF`.
- **Sizes:** Small (32px height, 12px font), Standard (38px height, 14px font), Large (44px height, 16px font).

### Badges & Status Pills
- Shape: Full pill (`9999px`), height `22px`, font size `11px`, font weight `600`, padding `0 10px`.
- Stage variants:
  - **In Progress:** Surface `#EFF6FF`, text `#2563EB`, border `1px solid #BFDBFE`.
  - **Sent:** Surface `#FFFBEB`, text `#D97706`, border `1px solid #FDE68A`.
  - **Accepted:** Surface `#F5F3FF`, text `#7C3AED`, border `1px solid #DDD6FE`.
  - **Completed:** Surface `#ECFDF5`, text `#059669`, border `1px solid #A7F3D0`.
  - **Refused:** Surface `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`.
- **Count Indicator:** Embedded inline counters within tabs use `#F1F5F9` background with `#475569` text, transitioning to `#DBEAFE` background and `#1D4ED8` text when the parent tab is active.

### Data Tables
- **Container:** Wrapped in a `1px solid #E2E8F0` bordered card with `8px` corner radius.
- **Header Cell:** Height `40px`, background `#F8FAFC`, border bottom `1px solid #E2E8F0`, typography `label-sm` (`12px`, uppercase, color `#64748B`).
- **Body Cell:** Height `48px`, border bottom `1px solid #F1F5F9`, typography `body-md` (`14px`, color `#0F172A`). Currency and numbers right-aligned with `mono-tabular` styling.
- **Row States:** Hover background `#F8FAFC`. Selected background `#EFF6FF`, with a `2px solid #2563EB` left border anchor.

### Form Inputs & Selectors
- **Input Canvas:** Background `#FFFFFF`, border `1px solid #E2E8F0`, height `38px`, padding `0 12px`, text `14px` (`#0F172A`).
- **Focus State:** Border `#2563EB`, with an ambient ring: `0 0 0 3px rgba(37, 99, 235, 0.15)`.
- **Labels:** Positioned atop the field, `13px`, medium weight (`#334155`), margin-bottom `4px`.
- **Prefix / Suffix Adornments:** CAD currency prefix (`$`) and interval suffixes (`/mo`, `/yr`) styled in `#64748B` using `#F1F5F9` container tracks.

### App Shell
- **Sidebar:** dark navy (`night`, `#0B1424`) with a workspace switcher, `⌘K` search, nav items with count badges, a plan-quota card and the account footer, as in the pipeline and agreements mockups. Content sits on the light canvas. This is the one dark surface in the staff app; below 1024px it becomes a drawer.
- **Input borders:** the `field` token (`#7D8798`) is used instead of Hairline on form controls to hold 3:1 non-text contrast (WCAG 1.4.11). Dividers and cards stay Hairline.

### Navigation Bar & Tabs
- **App Bar:** Fixed top `56px` height, background `#FFFFFF`, bottom border `1px solid #E2E8F0`. Clean typography with company/branch switcher on the leading edge.
- **Active Tab Links:** Positioned with a bottom indicator bar (`2px solid #2563EB`) extending the width of the label, text color `#2563EB`, font weight `600`. Inactive tab links use `#64748B` with hover color `#0F172A`.

### Service Pact Summary Cards
- **Overview Stat Cards:** Padding `16px`, background `#FFFFFF`, border `1px solid #E2E8F0`, rounded `8px`. Metric displayed in `headline-lg` (`#0F172A`), subtitle in `body-sm` (`#64748B`), with absolute right-aligned status pill or interval delta indicator.