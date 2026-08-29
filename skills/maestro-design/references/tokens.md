# Tokens — Design Tokens and Theming

## Tokens

Tokens are the single source for color, typography, spacing, radius, and shadow. Use semantic names such as primary and muted instead of raw hex so themes stay consistent. Each token maps to a CSS variable and a Tailwind entry.

Color sets hierarchy and accessibility. Primary drives brand actions, secondary supports surfaces, CTA drives conversion, background is the canvas, text carries body copy, muted handles metadata. Verify every pair for WCAG 4.5 to 1 body and 3 to 1 large headings, and ship a dark variant swapping background and foreground while preserving ratios.

Typography pairs heading and body deliberately. Inter is the neutral default for both due to legibility. Override per vertical: Cormorant with Montserrat for spa warmth, Playfair with Lora for editorial. Use scale 12, 14, 16, 18, 24, 32 with line height 1.5 to 1.625 and Google Fonts display swap.

Spacing follows a 4 point grid. Use gap 4 for related items, gap 6 for groups, gap 8 for sections. Constrain layout with max width 7xl and prose at 65 to 75 characters.

Radius and shadow convey depth. Default to rounded lg 8 pixels, 2xl 16 pixels for bento, and none for brutalism. Use shadow sm at rest and shadow lg elevated; dual shadows only for neumorphism.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", xl: "calc(var(--radius) + 4px)", "2xl": "1rem" },
      boxShadow: { sm: "0 1px 2px rgba(0,0,0,0.05)", lg: "0 10px 15px rgba(0,0,0,0.08)" },
    },
  },
}
```
