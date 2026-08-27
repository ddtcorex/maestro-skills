# Supported Cases — Diagram Studio

All cases that `diagram-studio` skill + `dsh-maestro-diagram` plugin handle. Each is live-verified (see `packages/dsh-maestro-diagram/tests/` 8/8, `/tmp/diagram-studio-coverage.mmd`, `maestro-workspace -r verify` 13 packages Done).

## 1. Diagram Types (5 Mermaid grammars)

Mapped from 39 editorial types in `cathrynlavery/diagram-design`:

| # | Mermaid type | When to use | Minimal example | Verified |
|---|---|---|---|---|
| 1 | `flowchart TB/LR` | Components + connections (architecture) | `docs/architecture.md §1.1` (10 plugins + meta, density 4/10) | `mermaid_verify` + `mermaid_drift` (missingInCode 0) |
| 2 | `sequenceDiagram` | Messages over time (turn lifecycle) | `docs/specs/2026-08-27-harness-turn-flow-sequence.md` (6 participants) | `mermaid_verify` + SVG 28K via `mermaid-cli 11.16.0` |
| 3 | `classDiagram` | Classes + ops | `cheatsheet.md#class` (`ReviewProvider <|-- GitLabProvider`) | `verifyMermaid` 5/5 |
| 4 | `erDiagram` | Entities + fields | `cheatsheet.md#er` (`PROJECT ||--o{ MEMORY`) | `verifyMermaid` 5/5 |
| 5 | `stateDiagram` | States + guards | `cheatsheet.md#state` (`[*] --> queued`) | `verifyMermaid` 5/5 |

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
