# Supported Cases — Diagram Studio

All cases that `diagram-studio` skill + `dsh-maestro-diagram` plugin handle. Rows marked `verified` are live-verified (see `packages/dsh-maestro-diagram/tests/` 8/8, `/tmp/diagram-studio-coverage.mmd`, `maestro-workspace -r verify` 13 packages Done); rows marked `unverified` are mapped by convention and await plugin coverage.

## 1. Diagram Types (5 Mermaid grammars)

Covers 52/52 upstream ordinals from `cathrynlavery/diagram-design` v2.6.32 (gallery ordinals 01–52, enumerated 2026-09-19; ordinals win over `type-*.md` on mismatch — sub-variants such as Streamgraph ride under their parent ordinal):

| Upstream ordinal(s) | Nearest grammar | Status |
|---|---|---|
| 02 Flowchart | `flowchart TB/LR` | `verified` — `mermaid_verify` + `mermaid_drift` (missingInCode 0) |
| 01 Architecture | `flowchart TB/LR` | `verified` — `docs/architecture.md §1.1` (10 plugins + meta, density 4/10) |
| 06 Timeline, 07 Swimlane, 09 Nested, 10 Tree, 11 Org chart, 12 Layers, 17 Loop, 18 Data lake, 25 High-Level, 26 Process, 27 Data flow, 28 DP integration, 29 High-Level / Parametric, 31 DP security matrix, 32 IT current-state, 34 Fishbone, 36 Kanban, 37 User journey, 38 Deployment, 39 Dependency graph, 41 Story map, 47 Loop terminal, 48 Policy trace, 49 Fan-in queue, 50 Secure paved road, 51 Tree block decomposition | `flowchart TB/LR` | `unverified` — mapped by containment/connection convention |
| 03 Sequence | `sequenceDiagram` | `verified` — `mermaid_verify` + SVG 28K via `mermaid-cli 11.16.0` |
| 43 Sequence OAuth | `sequenceDiagram` | `unverified` — same participant/message convention as 03 |
| 40 UML class | `classDiagram` | `verified` — `cheatsheet.md#class` (`ReviewProvider <|-- GitLabProvider`), `verifyMermaid` 5/5 |
| 05 ER | `erDiagram` | `verified` — `cheatsheet.md#er` (`PROJECT ||--o{ MEMORY`), `verifyMermaid` 5/5 |
| 42 Database schema | `erDiagram` | `unverified` — same entity/field convention as 05 |
| 04 State (incl. lifecycle variant) | `stateDiagram` | `verified` — `cheatsheet.md#state` (`[*] --> queued`), `verifyMermaid` 5/5 |

### 1.1 Behavior first (adapted from upstream semantic-patterns)

Describe the story with a pattern first, then reuse the nearest grammar above — new behaviors must not grow the grammar list:

| If the story is… | Pattern (ordinal) → Nearest grammar |
|---|---|
| Fan-in, queues, bottlenecks | Fan-in queue (49) → `flowchart TB` |
| Two policy traces, first divergence | Paired traces (48) → `flowchart` |
| Trust boundaries / paved road | Secure paved road (50) → `flowchart` (architecture) |
| Repeated stage slots | Stage framework (26) → `flowchart` (process) |
| Messy input becomes a durable artifact | Unstructured → structured (27) → `flowchart` (data flow) |
| Controls by enforcement layer | Governance catalog (31) → `flowchart` (layers) |
| Compensating defenses, residual risk | Compensating layers → `flowchart` (layers) |

### 1.2 Out of scope (18 ordinals, with reason)

| Upstream ordinal(s) | Reason |
|---|---|
| 19 Bar, 21 Line (incl. slopegraph, ridgeline, Streamgraph, bump variants), 23 Scatter (incl. bubble, beeswarm variants) | Chart grammars outside the 5 supported |
| 15 Radar, 16 Polar | Multi-axis plots outside the 5 supported |
| 20 Waterfall | Cumulative bars outside the 5 supported |
| 30 Treemap (incl. Marimekko variant) | Hierarchy-by-area outside the 5 supported |
| 13 Venn, 14 Pyramid | Set/stratified shapes outside the 5 supported |
| 24 Medallion | Badge visual, no diagram grammar |
| 08 Quadrant, 46 Quadrant consultant | Two-axis positioning outside the 5 supported |
| 22 Gantt | Scheduling bars outside the 5 supported |
| 33 Sankey | Weighted flow bands `flowchart` cannot encode |
| 35 Wardley map | Evolution-vs-value axes, no Mermaid convention yet |
| 44 Import draw.io, 45 Import Mermaid, 52 Import Excalidraw | Redraw workflows, not diagram types |

All share tokens `paper/ink/accent/muted/link` from `style-guide.md` (`classDef focal` for 1-2 nodes, `muted` for rest, no shadow, rx:6).

## 2. Audiences (2) — controls 4 elements per HTML

See `SKILL.md` § Audience Rules for the exact checklist.

| Audience | Trigger | Mermaid source | Tokens card | Technical footer | Example files |
|---|---|---|---|---|---|
| Team / Internal | `team|internal` or "cho team / keep source" | Yes (`<details>` collapsed) | Yes | Yes ("About" with verify/drift) | `harness-architecture.html` 16K (1 svg,1 pre), `harness-turn-flow-sequence.html` 31K |
| Client / External | `client|pitch|deck` or "cho khách / clean" | **No** | **No** | **No** (1 line `Generated via diagram-studio — 2026-08-27`) | `...-client.html` 12K/30K (1 svg,0 pre), PNG 124K/65K |

## 3. Outputs (3)

| Output | Path | Audience rule | Render | Verification |
|---|---|---|---|---|
| GitHub-native Mermaid | `docs/architecture.md §1.1`, `docs/specs/*-design.md` | Always show source | GitHub auto-renders ```mermaid | `mermaid_verify` + `mermaid_drift` |
| Editorial HTML | `docs/diagrams/<slug>.html` (inline SVG/CSS, no JS) | Team vs Client | Chrome `screenshot 980×1100` → PNG | `grep -c "<svg"` + `file` + 0 external deps |
| Deck PDF | `docs/diagrams/maestro-harness-deck.pdf` (A4 landscape, 3 pages) | Always Client | `chrome --print-to-pdf` (303K) | `pdfinfo Pages:3` |

## 4. Verification Cases (3)

| Case | Tool | Input | Expected |
|---|---|---|---|
| Parse ok | `mermaid_verify` | Valid 5 types | `{ok:true}` — 5/5 PASS |
| Parse fail | `mermaid_verify` | `A-->` or empty | `{ok:false, line:2}` |
| Anti-pattern (strict) | `mermaid_verify` strict:true | `shadow:true` | `{warnings:1}` |
| Drift | `mermaid_drift` | `docs/architecture.md` vs `packages/*` | `{missingInCode:0}` |
| Missing file | `mermaid_drift` | `docs/nonexistent.md` | throws `ENOENT` |

## 5. Live Case Studies (2) — on this harness

| Study | Internal + Client-clean | PNG | PDF |
|---|---|---|---|
| Architecture flowchart | `harness-architecture.html` 16K → `...-client.html` 12K | 238K → 124K | Deck p1 |
| Turn flow sequence | `harness-turn-flow-sequence.html` 31K (svg 28K) → `...-client.html` 30K | 100K → 65K + `...-rendered.png` 20K | Deck p2 |
