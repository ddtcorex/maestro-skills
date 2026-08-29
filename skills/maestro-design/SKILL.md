---
name: maestro-design
description: |
  Use when creating UI components, pages, design systems, or converting Figma/mockups to code.
  Covers Tailwind + shadcn/ui + Radix primitives, design tokens, responsive, a11y (WCAG 2.2),
  motion, and Figma→code workflow. Use for scaffolding a design system or generating production-ready UI.
  Triggers: figma, tailwind, shadcn, design system, a11y, responsive, component, landing page, dashboard, scaffold UI.
compatibility: claude, codex, opencode, copilot, dsh
metadata:
  audience: frontend developers
  workflow: design-system
---

# Maestro Design

Professional UI/UX implementation — design tokens, Figma→code, Tailwind + shadcn/Radix component system, a11y, responsive and motion.

## When to Use

Trigger keywords: figma, tailwind, shadcn, design system, a11y, responsive, component, landing page, dashboard, scaffold UI, UI/UX.

Use this skill when you need to scaffold a design system, generate a component or page, convert a Figma file or image mockup to code, or audit UI for accessibility and responsive quality. Pairs with `verification-before-completion` for visual/Lighthouse/axe checks and with `magento2-hyva-dev` when `theme.xml` parent is Hyvä.

## Design System Generator

Every generation starts by emitting a Design System Box for user approval before writing code. Adapted from ui-ux-pro-max v2.0, Maestro-opinionated:

```
+----------------------------------------------------------------------------------------+
|  TARGET: <Project Name> - RECOMMENDED DESIGN SYSTEM                                    |
+----------------------------------------------------------------------------------------+
|  PATTERN: <e.g., Hero-Centric + Social Proof>                                          |
|     Sections: Hero -> Features -> Testimonials -> Pricing -> FAQ -> CTA                |
|  STYLE: <e.g., Minimalism + Bento Grid>                                                |
|     Keywords: clean, grid, whitespace, soft shadows, rounded 16px                      |
|     Best For: SaaS, dashboards                                                         |
|     Performance: cost:low | Accessibility: risk:low                                    |
|  COLORS:                                                                               |
|     Primary: #...  Secondary: #...  CTA: #...                                          |
|     Background: #...  Text: #...  Muted: #...                                          |
|     Notes: <contrast rationale, 4.5:1 verified>                                       |
|  TYPOGRAPHY: <Heading / Body> — e.g., Inter / Inter                                   |
|     Mood: professional, readable                                                       |
|     Google Fonts: https://fonts.google.com/...                                         |
|  KEY EFFECTS: subtle hover 200ms, soft shadow, focus ring 2px                          |
|  AVOID (Anti-patterns): neon gradients for finance, emoji-as-icon, no focus ring      |
|  PRE-DELIVERY CHECKLIST: [ ] 8 items (see Pre-delivery Checklist)                      |
+----------------------------------------------------------------------------------------+
```

Pattern/style/colors/typography come from curated catalogs below and Figma extraction when available. See `references/figma-workflow.md` for the hybrid extract flow and `references/tokens.md` for token definitions. Do not write code until the user approves the Box or asks to proceed.

## Curated Styles (15)

Fifteen Tailwind and shadcn viable styles distilled from ui-ux-pro-max 79. Each maps directly to Tailwind classes and shadcn variants with clear best for and do not use for guidance. Prefer these names in the Design System Box STYLE field so the style choice remains reviewable and searchable.

| # | Style | When to use | Tailwind cue | Do-not-use-for |
|---|-------|-------------|--------------|----------------|
| 1 | Minimalism & Swiss | SaaS, dashboards, docs | `grid, gap-8, rounded-none, shadow-none` | Playful onboarding, luxury |
| 2 | Bento Grid | Feature dashboards, marketing | `grid auto-fit, rounded-2xl, gap-5, bg-[#F5F5F7]` | Dense editorial |
| 3 | Glassmorphism | Overlays, nav, premium SaaS | `backdrop-blur-xl, bg-white/15, border-white/20` | Low-end devices, heavy content |
| 4 | Claymorphism | Onboarding, children, playful | `rounded-[20px], border-[3px], shadow-inner+outer, pastels` | Finance, enterprise |
| 5 | Neumorphism | Wellness, minimal | `rounded-[14px], shadow soft dual, pastels` | High contrast needs |
| 6 | Brutalism | Portfolio, editorial, counter-culture | `rounded-none, transition-none, font-mono, primary only` | SaaS trust, healthcare |
| 7 | Aurora / Mesh Gradient | Hero, branding, music | `conic-gradient, animate 8-12s, screen blend` | Data-dense tables |
| 8 | Editorial / Magazine | Blogs, news, long-form | `grid asymmetric, serif body, drop-cap, pull-quote` | Dashboard CRUD |
| 9 | Dark OLED | Coding, entertainment, night | `bg-[#000], text-white, neon accents, 7:1 contrast` | Default light SaaS |
| 10 | Tactile / Deformable | Mobile playful, consumer | `active:scale-95, spring physics, framer-motion` | Enterprise data |
| 11 | Nature Distilled | Wellness, artisan, sustainable | `terracotta #C67B5C, sand, olive, grain texture` | Fintech, gaming |
| 12 | 3D Product Preview | E-commerce, furniture | `Three.js/model-viewer, orbit controls, drag-to-spin` | Text-heavy docs |
| 13 | Motion-Driven | Storytelling, portfolio | `Intersection Observer, parallax 3-5 layers, 300-400ms` | Performance critical |
| 14 | Flat Design | MVP, cross-platform, startup | `shadow-none, 4-6 flat colors, 150-200ms` | Premium luxury |
| 15 | Spatial / VisionOS | VR/AR, immersive | `blur 40px, glass, depth layering` | Standard web forms |

Each style in the Box should include keywords, performance cost, accessibility risk, and implementation checklist. For Tailwind details see `references/tokens.md`.

## Industry Rules (12)

Twelve vertical rules curated for Maestro client work. The agent matches the prompt to the closest rule, refines with Figma tokens if present, and records conflicts in the Box AVOID field. If the user insists on an anti-pattern combination such as brutalism for banking, emit a warning and proceed only after explicit confirmation.

| # | Vertical | Pattern | Style priority | Color mood | Typography | Avoid |
|---|----------|---------|----------------|------------|------------|-------|
| 1 | SaaS / B2B | Hero + Features + Pricing + FAQ | Minimalism, Bento | Blue/neutral, high contrast | Inter / Inter | Neon, harsh motion |
| 2 | E-commerce (general) | Hero + Categories + Products + Reviews | Bento, Minimalism | Vibrant CTA, warm BG | Poppins / Inter | Dark mode as default |
| 3 | Beauty / Spa | Hero-centric + Social Proof | Soft UI, Nature Distilled | Soft pink #E8B4B8, sage, gold | Cormorant / Montserrat | Bright neon, dark mode |
| 4 | Restaurant / Hotel | Hero + Menu/Rooms + Gallery + Booking | Editorial, Aurora | Warm earth, terracotta | Playfair / Lora | Brutalism |
| 5 | Healthcare / Clinic | Trust + Services + Doctors + Contact | Minimalism, Accessible | Blue/white, 7:1 contrast | Inter / Source Sans | Playful clay, chaos |
| 6 | Education / Course | Hero + Curriculum + Instructors + Pricing | Minimalism, Editorial | Blue/orange, friendly | Nunito / Inter | Dark, neon |
| 7 | Real Estate | Hero + Listings + Map + Contact | Bento, Minimalism | Navy/white, gold accent | Merriweather / Open Sans | Chaos, brutalism |
| 8 | Portfolio / Agency | Hero + Work + About + Contact | Brutalism, Editorial, Motion | Monochrome + accent | Space Grotesk / Inter | Corporate flat |
| 9 | Marketplace (P2P) | Search + Listings + Trust | Bento, Minimalism | White, primary accent | Inter | Dark |
| 10 | Finance / Fintech | Hero + Features + Security + Compliance | Minimalism, Swiss | Navy, muted, no purple/pink AI gradients | IBM Plex Sans | AI gradients |
| 11 | Fitness / Wellness | Hero + Programs + Trainers + Pricing | Tactile, Nature | Green/sand, energetic | Montserrat | Brutalism |
| 12 | Booking / Appointment | Hero + Services + Calendar + Confirm | Minimalism, Tactile | Calm, clear CTA | Inter | Chaos |

Typography mood links to Google Fonts. For token mapping see `references/tokens.md`.

## Workflows

### Scaffold vs Generate

**Scaffold** creates a durable design system that future generations reuse. Use when starting a project or when `design-system/MASTER.md` does not exist.

Steps:
1. Emit Design System Box and await confirmation.
2. Run `npx shadcn@latest add` for required primitives (Button, Card, Input, etc.).
3. Write `tailwind.config.ts` with tokens from `references/tokens.md` (colors, fontFamily, borderRadius, boxShadow).
4. Write `app/globals.css` CSS variables (`--background`, `--foreground`, `--primary`, `--radius`).
5. Write `components/ui/*` primitives and `design-system/MASTER.md` via `maestro_write_file`.
6. Optionally scaffold `stories/` for Storybook.

```ts
// tailwind.config.ts — scaffold output
export default {
  theme: { extend: { colors: { primary: "hsl(var(--primary))" }, borderRadius: { lg: "var(--radius)" } } }
}
```

**Generate** creates a single component or page and reuses the existing system. Use when `design-system/MASTER.md` exists or for one-off pages.

Steps:
1. Read `design-system/MASTER.md` and `design-system/pages/<page>.md` if it exists; page rules override master.
2. Emit Design System Box referencing the master so drift is visible.
3. Write the component or page file importing from `@/components/ui/*` with `cursor-pointer` on clickable and `focus-visible:ring-2` on focusable elements.
4. Ensure responsive at 375, 768, 1024, 1440 and no horizontal scroll.
5. Run the Pre-delivery Checklist before handoff.

Hierarchical retrieval prompt for Generate:

> I am building [Page]. Read design-system/MASTER.md, check design-system/pages/[page].md, prioritize page rules over master, and emit the Design System Box before coding.

See `references/components.md` for primitive variant tables and `references/figma-workflow.md` for Figma mapping.

## Persist Pattern

Persisted design decisions live in `design-system/` so future sessions and sub-agents share the same source.

```
design-system/
├── MASTER.md           # Global Source of Truth (pattern, style, colors, typography, spacing, effects, avoid, checklist)
└── pages/
    ├── dashboard.md    # Page-specific overrides (only deviations from MASTER.md)
    └── checkout.md
```

Workflow:
1. First generation in a project writes `design-system/MASTER.md` via `maestro_write_file` after Box approval.
2. Per-page generation reads `MASTER.md` plus `pages/<page>.md` if it exists; page rules override master.
3. The hierarchical retrieval prompt above governs every Generate turn. The directory is git-ignored by default unless the team commits it.

Example `MASTER.md` header:

```md
# MASTER — <Project> Design System
Pattern: Hero + Features + Pricing
Style: Minimalism + Bento Grid
Colors: primary #3B82F6, background #FFFFFF, text #0F172A (4.5:1)
Typography: Inter / Inter — https://fonts.google.com/specimen/Inter
```

## Pre-delivery Checklist

Run this checklist verbatim before handing off any generated UI. Block delivery until every item passes; suggest an accessible alternative palette when contrast fails.

- [ ] No emoji as icons (use `lucide-react`/`heroicons` SVG)
- [ ] `cursor-pointer` on all clickable, `focus-visible` ring visible (2px)
- [ ] `prefers-reduced-motion` respected (motion tokens, `motion` prop)
- [ ] Text contrast 4.5:1 minimum (7:1 for enhanced), verified against chosen palette
- [ ] Text/chips/badges reflow without clipping at 375px, 200% zoom, user spacing overrides
- [ ] Responsive: 375, 768, 1024, 1440 tested (no horizontal scroll)
- [ ] Touch targets: 44pt iOS / 48dp Android / 24px web minimum + 8px gap (WCAG Target Size)
- [ ] Images have `alt`, icons have `aria-label` or `aria-hidden`, form has `label` + `aria-describedby` for errors

For the 20 resilient rules behind items 5 and 7 see `references/a11y-motion.md`.

## Hyva Adapter

When the project has a Hyvä theme (detect via `app/design/frontend/<Vendor>/<theme>/theme.xml` parent `Hyva/default` or `tailwind.config.js` with Hyvä preset), adapt React and shadcn patterns to Alpine and Tailwind:

- Map shadcn Button variant and size props to Alpine `x-data` toggle plus Tailwind utility classes instead of Radix state. Keep `cursor-pointer` and `focus-visible:ring-2`.
- Keep the same design tokens (`references/tokens.md`) and Box workflow; only the interaction layer changes from Radix to Alpine.
- Pair with `magento2-hyva-dev` for Hyvä CLI, Tailwind setup, and Magento layout integration.

For Hyvä-specific scaffolding defer to `magento2-hyva-dev` after the Box is approved.

## References

- `references/tokens.md` — color/typography/spacing/radius/shadow tokens, CSS variables, Tailwind config
- `references/components.md` — 15 shadcn/Radix primitives with variant tables and composition patterns
- `references/figma-workflow.md` — hybrid Figma→code: extract auto-layout→flex/grid, variants→shadcn props
- `references/a11y-motion.md` — WCAG 2.2 AA, focus-not-obscured, target-size, resilient text, motion tokens
