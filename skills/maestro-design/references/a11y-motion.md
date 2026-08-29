# A11y and Motion — WCAG 2.2 and Resilient UX

## A11y Motion

Accessibility and motion are gates. Every interface must meet WCAG 2.2 AA, stay resilient across zoom and content length, and respect motion preferences.

Contrast and keyboard form the baseline. Ensure 4.5 to 1 for body and 3 to 1 for large headings, provide 2 pixel focus ring via focus visible, support keyboard order with skip links, and use semantic HTML for headings, landmarks, and forms. Keep focus not obscured: set scroll padding top to header height, avoid fixed overlays covering focus, and ensure sticky nav adds padding equal to its height while using dvh not 100vh on mobile.

Target size protects touch users. Meet 44 points iOS, 48 dp Android, and 24 pixels web with 8 pixels gap, never shrinking chips or icon buttons below minima.

Resilient text prevents clipping. Use text wrap balance with max inline size 20 characters for headings. Use overflow wrap anywhere with min inline size 0 for long tokens, never word break break all on prose. Let chips flex wrap or collapse to plus n, keep badge meaning not color only, and give interactive chips role button with aria pressed.

Motion stays cancellable. Use duration 200 for hover, 300 to 400 for parallax, set final state directly, and honor prefers reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
html { scroll-padding-top: var(--header-height); }
.chip-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
```

```tsx
// Accessible chip
<button role="button" aria-pressed={selected} className="rounded-full px-3 py-1 cursor-pointer focus-visible:ring-2">
  {label}
</button>
```
