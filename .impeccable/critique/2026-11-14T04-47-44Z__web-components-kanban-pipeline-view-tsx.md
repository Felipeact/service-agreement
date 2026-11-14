---
target: Pipeline screen after layout/$0/refresh fixes
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\stock\\source\\service-agreement\\web\\components\\kanban\\pipeline-view.tsx"
target_fingerprint: "sha256:e56b8d5c7a720bcd4c62a82dc268928a5bd855c031c04035994b3c94e1e885bc"
target_path: "C:\\Users\\stock\\source\\service-agreement\\web\\components\\kanban\\pipeline-view.tsx"
timestamp: 2026-11-14T04-47-44Z
slug: web-components-kanban-pipeline-view-tsx
---
Method: dual-agent. Score 26/40 (Good, 65%). Detector CLI 0 findings; overlay 1 (overused-font Inter 83%, accepted trade-off).
[P1] Columns print $0/yr over unpriced cards (kanban-column.tsx:74) -> clarify
[P1] No keyboard/batch path for 30 agreements -> layout, adapt
[P2] Overdue signal repeated 4x; LiveRefresh has no failure/paused state -> distill, harden
[P2] Card/column spacing and radius drift from DESIGN.md -> document
[P3] Expiring soon link clipped 8px at 768; Expiring column 2px off at 1440; rule sentence wraps -> polish
