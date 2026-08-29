# Figma Workflow — Hybrid Extract to Code

## Figma Workflow

This workflow follows hybrid C: text prompt alone uses curated fallback tokens, while Figma or image input extracts real values and overrides the fallback. Always emit the Design System Box for approval before coding so vibe and palette are confirmed.

Extract from Figma via Inspect. Capture colors for primary, secondary, CTA, background, text, muted, plus typography families and scale, spacing base 4 or 8 points, radius, and shadow. Map auto layout to Tailwind flex or grid: horizontal hug becomes flex with gap, vertical fill becomes grid or flex column, wrap maps to flex wrap. Translate variants to shadcn props: Figma variant Button Primary Large becomes Button variant default size lg. Replace icon layers with lucide-react or heroicons SVG, never emoji, and preserve accessible names from layer labels.

Fallback preset applies when no Figma exists. Use neutral slate with blue primary #3B82F6, distinct CTA, white background, slate text #0F172A at 4.5 to 1, Inter for heading and body, 4 point spacing, rounded lg 8 pixels and 2xl for bento, and shadow sm default with shadow lg elevated.

Image only input needs inference. Sample dominant colors, infer style keywords such as soft pastel for claymorphism, and confirm via the Design System Box before coding so invented tokens do not ship unchecked.

```tsx
// Figma auto-layout "horizontal hug" → flex
<div className="flex gap-4 items-center">
  <span>Label</span><Button>Action</Button>
</div>

// Figma auto-layout "vertical fill" → grid
<div className="grid gap-6">
  <Card /><Card />
</div>

// Figma variant "Button/Primary/Large" → shadcn props
import { Button } from "@/components/ui/button"
<Button variant="default" size="lg">Primary</Button>

// Icon mapping — never emoji
import { ArrowRight, Sparkles } from "lucide-react"
<ArrowRight className="h-4 w-4" aria-hidden="true" />
```
