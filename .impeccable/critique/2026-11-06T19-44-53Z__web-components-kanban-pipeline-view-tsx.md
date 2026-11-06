---
target: Pipeline board and sign-in
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\dispa\\Music\\repos\\ServiceAgreement\\web\\components\\kanban\\pipeline-view.tsx"
target_fingerprint: "sha256:df926a95646a7c8fff94245819ed8ce12ac38235b35b424edcefa2b76663fc4e"
target_path: "C:\\Users\\dispa\\Music\\repos\\ServiceAgreement\\web\\components\\kanban\\pipeline-view.tsx"
timestamp: 2026-11-06T19-44-53Z
slug: web-components-kanban-pipeline-view-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector + browser evidence sub-agent), plus a live signed-in pass at 375/768/1440 by the parent.

# Critique: Pipeline board (/pipeline) and sign-in (/login)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Updated 32 days ago" is 12px grey on every card, identical to "Updated 1 day ago". |
| 2 | Match System / Real World | 3 | Plain trade language; full "Accepted, awaiting signature" only in a title tooltip. |
| 3 | User Control and Freedom | 3 | Clear search works; mobile tab resets on reload. |
| 4 | Consistency and Standards | 3 | Consistent; "Expiring soon" is a loose link above the title. |
| 5 | Error Prevention | 3 | Login well guarded. |
| 6 | Recognition Rather Than Recall | 2 | Mobile shows one of five stages; all cards equal weight. |
| 7 | Flexibility and Efficiency | 1 | No sort, no age/attention filter, no keyboard path; search ignores agreement number. |
| 8 | Aesthetic and Minimalist Design | 3 | Disciplined; five equal-weight metadata lines before money. |
| 9 | Error Recovery | 3 | Login messages specific; send failure gives no reason. |
| 10 | Help and Documentation | 2 | Empty board has no CTA or stage explanation. |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

LLM: category-interchangeable by choice (DESIGN.md records the familiar stance). Only trade signals are visits/yr and $/yr at 12px. Login has no mark, trade cue or tenant cue.
Deterministic scan: impeccable detect returned [] (exit 0) on kanban, shell, ui, login, (app). Detector does not see non-text contrast, hierarchy or age signalling; not verified that it reads .tsx.

## Overall Impression

Calm, rigorous, honest board. Biggest opportunity: it does not show which agreements are stuck, which is its own promise.

## What's Working

1. Column headers carry count and annual CAD total.
2. Status is never colour alone (dot plus label enforced in component).
3. Mobile/tablet shell: no control under 44px, no page overflow at 375 and 768, arrow-key stage tabs.

## Priority Issues

[P1] The board does not show which agreements are stuck. Age is grey 12px on every card (32- and 37-day Completed cards look like 1-day drafts). Fix: fixed age slot, escalate past per-stage thresholds, age sort. Command: clarify, then bolder.
[P1] No point of view; reads as a template. Tenant name is 12px grey under the product name, product mark is plain text. Fix: product mark, one line of purpose on login, a domain-specific card element (next visit month). Command: shape, then delight.
[P2] Every stage gets equal weight including closed ones. Refused shows $31,480/yr in pipeline-money style; an "Expired" card sits in Refused; empty Sent column same width as the rest. Fix: de-emphasise closed stages, label Expired clearly, keep Refused money out of pipeline totals. Command: layout, then quieter.
[P2] Power-user path is thin. Search ignores AG-number; no needs-attention filter though card.attention exists; no keyboard focus between cards. Command: adapt or harden.
[P2] Field borders fail non-text contrast. #e5e7eb on white is about 1.26:1 vs 3:1 required (WCAG 1.4.11). Fix: darker input-only border token (about #8a909b). Command: harden or audit.

## Persona Red Flags

Alex (estimator, power user): no sort, no age filter, no keyboard navigation between cards, search ignores AG-1052; Fernwood Dental appears three times in different columns with no grouping.
Sam (accessibility): input borders about 1.26:1; each card is one link wrapping a heading and up to five paragraphs; full status label is tooltip-only. Text contrast itself is solid (5.17:1 and up).
Casey (mobile): one stage visible with no sign of staleness elsewhere; header repeats under the selected tab; "Expiring soon" adds a full row above the title.

## Minor Observations

- Cards print the same name twice when site and customer match.
- In-progress drafts show no money or visits, so the column total exceeds any visible card.
- "Expiring soon" is 19px tall on desktop.
- "Unnumbered" could read "Draft".
- Bare count next to column title has no label.
- Next.js dev button overlaps Sign out (dev-only).

## Questions to Consider

- If the product name were removed, what tells an HVAC estimator this is not a generic CRM? Is "familiar" a reason or an excuse?
- Why does a 3-day-old card carry the same weight as a 45-day-old one?
- Does a Refused deal deserve the same real estate as one the estimator must act on today?
