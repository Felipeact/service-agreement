---
version: 1
slug: "web-app-pipeline-page-tsx"
primary_target: "web/app/pipeline/page.tsx"
related_targets: []
---

# Surface: Pipeline (dashboard kanban)

**Mode:** Operate. The estimator triages every open agreement and contract by stage and age, then acts on the next one.

**Job:** see where every deal stands, spot what's stuck (not viewed, changes requested, awaiting countersignature), and jump to the action. The owner reads the same board for counts and CAD totals.

**States worth showing:** changes requested (with version), not viewed plus reminder sent, client signed and awaiting countersignature, import with unmapped types, empty column, filtered to no results.

**Unresolved:** sorting inside columns (age vs. next deadline); whether to allow drag-and-drop between stages (status transitions are owned by the state machine, so dragging may only offer valid moves); the mobile stage selector pattern.

## Direction contract

THESIS: The category-standard SaaS kanban, executed to Linear, Stripe, Attio and Jobber craft. It refuses novelty, not quality: familiarity is the feature.

OWN-WORLD: White sidebar with a blue-tint active item; Cool Ground (#f6f7f9) work area; Board Grey column wells; white 6px cards with a hairline lift; Inter with tabular figures; Action Blue for actions only; five stage colours, always paired with labels.

STORY: The estimator sees counts and CAD totals per stage, spots the deals that need them (pills: Changes requested, Not viewed, Awaiting countersignature), and opens or acts on one in a click.

FIRST VIEWPORT: Sidebar on the left. Header row with "Pipeline", the Estimator and Province filters, search and a blue "New agreement" button on the right. Below, five equal kanban columns fill the width, each headed by a coloured dot, the stage name, and the count and total. Cards show customer, agreement number and version, an attention pill, and visits/yr with the annual amount right-aligned.

FORM: canon (the category standard, chosen by the user over the roll; position n/a). seed:720f671e2e2ff527

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
