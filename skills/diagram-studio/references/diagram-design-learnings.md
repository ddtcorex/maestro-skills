# Diagram Design Learnings

5 editorial learnings distilled from [`cathrynlavery/diagram-design`](https://github.com/cathrynlavery/diagram-design) (MIT, 39 editorial types). That repo's tokens, density scale, and confirm-before-drawing discipline inform `diagram-studio`'s `SKILL.md` → `style-guide.md` → `cheatsheet.md` chain.

> License: MIT — see https://github.com/cathrynlavery/diagram-design/blob/main/LICENSE

## 1. Density 4/10 Is the Default — Whitespace Is Information

Generous whitespace beats dense packing. Editorial diagrams target density 4/10: 40% ink, 60% air. Every node must earn its place; if removing it doesn't weaken the story, remove it. Applies directly to `SKILL.md` → *Editorial Discipline*.

Source: `diagram-design` § Density scale — 10 is a data dump, 4 is a magazine explain.

## 2. >9 Nodes → Split Into Overview + Detail

Cognitive load caps at ~9 chunks. Beyond that, split into an overview (system-level) and one detail per subsystem, linked rather than crammed. Mermaid `flowchart` with >9 nodes should become two diagrams: `overview.mmd` + `detail-<subsystem>.mmd`.

Source: `diagram-design` § Chunking — "if it doesn't fit on a phone screen, it's two diagrams."

## 3. Accent 1–2 Max — One Focal Path

Color is a ranking device. Use one accent (`#eb6c36`) for the single focal path (1–2 nodes) and mute everything else (`#8a94a6` / `#f5f5f5`). Never accent everything — then nothing is accent.

Mermaid: `classDef focal fill:#eb6c36,stroke:#2d3142,color:#fff` + `class HotNode focal`. See `style-guide.md`.

Source: `diagram-design` § Color — tokens `paper/ink/accent/muted/link`.

## 4. Confirm Before Drawing — State Budget, Wait for Redirect

Before generating a diagram, state: `type, size preset (85%/100%), what will be cut due to budget` and wait for redirect if the user is reachable. Never assume scope or fill in missing entities. This avoids the most common editorial failure: a technically correct but story-wrong diagram.

Source: `diagram-design` § Brief — "confirm the cut before you draw."

## 5. GitHub-Native First, Editorial Export Second

Default output is diffable Mermaid in `docs/` (`docs/architecture.md §1.1`, `docs/specs/*-design.md`) so review lives in git history. Editorial HTML+SVG (`docs/diagrams/<slug>.html`, self-contained, inline CSS, no JS) is an explicit `export: html` step only when `audience: client`. No Figma dependency, no drag UI.

Source: `diagram-design` § Output — 39 editorial types mapped to 5 Mermaid grammars (`flowchart`, `sequenceDiagram`, `classDiagram`, `erDiagram`, `stateDiagram`) in `cheatsheet.md`.

---

Attribution: learnings and tokens adapted from [`cathrynlavery/diagram-design`](https://github.com/cathrynlavery/diagram-design) under MIT. Original repo holds the 39-type taxonomy and full editorial theory; this skill trims it to 5 GitHub-native Mermaid types + 1 HTML template for day-one SA use.

