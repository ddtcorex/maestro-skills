# Theme structure and the Luma comparison

What changes from Luma, the theme layout, and the child theme setup including the CSP
template source. The rules are in `SKILL.md`.

## Comparison with Luma

| Aspect | Luma | Hyvä |
|--------|------|------|
| JavaScript | ~200 resources (RequireJS/Knockout) | 2 resources (Alpine.js) |
| CSS | LESS-based | Tailwind CSS |
| Bundle Size | 500KB+ | <50KB |
| Core Web Vitals | Challenging | Optimized |
| Learning Curve | Steep | Gentle |
| Maintenance | Complex | Simple |

## Creating a child theme

Always copy `web/` from the parent theme rather than creating it from scratch: it carries the Tailwind config and build tooling the theme needs:

```bash
mkdir -p app/design/frontend/<Vendor>/<Theme>/web
cp -r vendor/hyva-themes/magento2-default-theme/web/* app/design/frontend/<Vendor>/<Theme>/web/
# For a CSP theme, copy from magento2-default-theme-csp instead
```

Then add `registration.php`, `theme.xml` (parent: `Hyva/default`, `Hyva/reset`, or `Hyva/default-csp`), and `composer.json`; install the Tailwind deps, run the build, then `bin/magento setup:upgrade && bin/magento cache:flush` to pick up the new theme.

```
app/design/frontend/Vendor/Theme/
├── registration.php
├── theme.xml
├── composer.json
├── web/
│   ├── tailwind/
│   │   ├── package.json    # Theme build tooling (npm)
│   │   ├── tailwind-source.css  # Entry point (v4: @source and @theme live here)
│   │   ├── tailwind.config.js   # Tailwind v2/v3 only
│   │   ├── base/           # Preflight, resets
│   │   ├── generated/      # Written by the build (hyva-source.css, hyva-tokens.css), do not edit
│   │   ├── components/     # Reusable components
│   │   │   ├── button.css
│   │   │   ├── forms.css
│   │   │   └── messages.css
│   │   ├── utilities/     # Custom utilities
│   │   └── theme/         # Page-specific
│   └── css/
│       └── styles.css     # Build output
├── Magento_Theme/
│   ├── layout/
│   │   └── default.xml    # theme layout lives under <Module>/, never at the root
│   └── templates/         # Alpine components live inline here, next to their markup
```

Hyvä has no per-theme JS directory convention: an Alpine component is an inline
`<script>` in the `.phtml` that renders it, followed by `registerInlineScript()`.
