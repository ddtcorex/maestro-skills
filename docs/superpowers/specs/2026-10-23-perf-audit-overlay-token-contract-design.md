# Performance Report Overlay Token Contract - Design Record

Shipped in 2.19.0 (#112, on top of #110 and #111). Design record kept after shipping; the
working spec and plan lived in the maintainer workspace.

## Intent

`magento2-performance-audit` renders one self-contained HTML report. A private client overlay
must be able to rebrand that report completely (header, palette, type, logo) without forking the
template, and the public package must never carry any client brand.

## What went wrong before

Version 2.18.x documented three brand slots but the overlay contract was too loose to follow:

- The header gradient, text color and accent border were literals, and the theme rule barred
  overlays from touching brand surfaces, so an overlay could recolor links but never the header.
  A dark client wordmark landed on the navy header at about 1.5:1 contrast.
- Nothing said what each slot takes. One overlay filled the colors slot with new custom
  properties that no rule reads, and the font slot with a bare `font-family:...;` declaration.
  At the top level of a style block that declaration merges into the next selector, so the
  browser drops that whole rule: the font never applied and links lost their styling.
- The overlay's tests filled a hand-written stand-in template, so string assertions passed
  against markup that does not exist.

## Decisions

1. Header surface tokens inside the existing `{{brand_colors}}` slot: `--header-bg`,
   `--header-text`, `--header-accent`, `--header-code-bg`. Rejected: a fourth slot (breaks the
   three-slot contract) and overlay selector overrides (break silently on a class rename).
2. `--link-decoration` (default `none`) so an overlay whose links share the text color can
   underline them.
3. `report-theme.md` "Overlay token map" lists the only tokens an overlay may set and the exact
   construct per slot: one `:root{...}` block for `{{brand_colors}}`, one complete
   `body{font-family:...}` rule for `{{brand_font}}`. Status colors are never overlay tokens.
4. Report defaults carry the Maestro brand: Maestro M lockup, links `#2563eb`, header accent
   `#0a84ff`, Inter with JetBrains Mono, palette copied from the Maestro design system with a
   source stamp that tests pin. The allowlist gate fails on any other brand term in the skill.

## Verification

- Headless Chrome computed-style probes (run in CI on `ubuntu-latest`): default header gradient
  and accent, undecorated default links.
- A fresh-context agent given only `report-theme.md` produced a correct overlay for a fictional
  brand: one `:root` block, a full `body` rule, the bright accent on `--header-accent`, the
  default lockup removed.
- Consumers should test fills against a byte copy of the real template and assert computed
  styles, not source strings.
