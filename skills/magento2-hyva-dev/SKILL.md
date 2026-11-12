---
name: magento2-hyva-dev
description: Use when creating a Hyvä theme or child theme, building an Alpine.js component, making markup CSP-compliant, adding Tailwind classes, or converting Luma to Hyvä. DEPENDENT on magento2-dev-core.
compatibility: claude, codex, opencode, copilot, dsh
depends: [magento2-dev-core]
metadata:
  audience: frontend developers
  workflow: magento
  references:
    - https://github.com/hyva-themes/hyva-ai-tools
    - https://docs.hyva.io/
---

# Magento 2 Hyvä Developer

## When to use

Load this skill for Hyvä-specific patterns; it is DEPENDENT on magento2-dev-core for PHP and backend patterns.

- "create a Hyvä theme", "set up a child theme", "convert Luma to Hyvä", "migrate Knockout to Alpine"
- "build an Alpine.js component", "make this CSP-compliant", "add Tailwind CSS classes", "Tailwind configuration"
- "CSP nonce registration", "Hyvä React components"

Hyvä is a modern Magento 2 frontend framework with dramatically simplified JavaScript and CSS. This skill covers Hyvä-specific patterns.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first: it defines the PHP/backend patterns (DI, escaping, repositories) this skill assumes for any ViewModel or backend code behind a Hyvä template.

Hyvä and Luma (`magento2-frontend-dev`) are mutually exclusive theme stacks, check the theme's `theme.xml` parent (`Hyva/default`/`Hyva/reset` vs `Magento/blank`) and `composer.json` for `hyva-themes/*` packages before assuming either applies. Hybrid projects (e.g. dual-stack) keep both: `app/design/frontend/<Vendor>/hyva_*` → this skill, `app/design/frontend/<Vendor>/luma_child` → `magento2-frontend-dev`. Pair with `govard-magento` for the container/CLI side.

## Detect the project's actual setup first

> **If the detector does not apply:** read the theme.xml parent, <theme>/web/tailwind/package.json, tailwind.config.js or tailwind-source.css+hyva.config.json, and composer.lock; verify, don't memorize the table (verified 2026-08-26).

Hyvä/Tailwind conventions vary a lot by project age, check before applying a pattern:

- **Tailwind version**: v4 uses CSS-based config and `hyva.config.json` design tokens; v2/v3 use `tailwind.config.js`. Check `web/tailwind/package.json`.
- **CSP build**: `Hyva/default-csp` vs the plain `Hyva/default`/`Hyva/reset` parent in `theme.xml`. The parent decides which Alpine build runs (CSP build: dot-path expressions only). It does not decide whether to call `registerInlineScript()`: that call returns early when the policy already allows inline scripts, and also when no area code is set (rendering outside a Magento area), so it is cheap in every Hyvä template. Keep the `isset($hyvaCsp)` guard, which covers a block that was not given the view model.
- **Parent theme**: `Hyva/reset` (built from scratch) vs `Hyva/default` (full starter) changes how much markup/CSS already exists to extend rather than rewrite.

## Hyvä vs Luma Comparison

Read [references/theme-and-child.md](references/theme-and-child.md) when setting up a theme or child theme, or explaining what Hyvä changes from Luma.

## Theme Structure

### Creating a Child Theme

See `references/theme-and-child.md` for the child theme setup, its files and the CSP template source.

## CSP (Content Security Policy) Compliance

Every inline script MUST register with CSP, since strict CSP drops it silently otherwise. Read [references/csp.md](references/csp.md) when markup must stay CSP-compliant, when a nonce must be registered, or when Alpine fails silently under strict CSP.

## Alpine.js Component Structure

Read [references/alpine.md](references/alpine.md) when writing an Alpine component or reaching for a Hyvä utility helper.

## View Models

Read [references/view-models.md](references/view-models.md) when a template needs logic, or a view model needs registering.

## Tailwind CSS

Read [references/tailwind.md](references/tailwind.md) when building or configuring Tailwind, or when a class does not survive the build.

## Reviewing Tailwind/Hyvä Diffs: Verify Before Claiming

Read [references/review-checklist.md](references/review-checklist.md) before claiming a Hyvä or Tailwind change works: take its six checks in order, and never claim from the diff alone.

## Layout XML

### Hyvä-Specific Handles

```xml
<!-- Add Hyvä modal support -->
<update handle="hyva_modal"/>
```

Do not add Alpine components through `<head><script src=.../></head>`: Hyvä
components are inline scripts in the template that renders their markup (see
"Basic Component"), which keeps them overridable per theme and lets them render
only on pages that use them.

### Override Template
```xml
<referenceBlock name="product.info" template="MyCompany_MyTheme::product/view.phtml"/>
```

## Migration from Luma

Read [references/migration.md](references/migration.md) when converting a Luma theme or template to Hyvä.

## Third-Party Compatibility Modules

Read [references/compatibility-modules.md](references/compatibility-modules.md) when a third-party extension needs a Hyvä compatibility module.

## Hyvä UI & CMS Components

- **UI components** (`hyva-themes/hyva-ui`): prebuilt, template-based components installed into a theme, copy `src/*` into the theme, merge any layout XML, and add config to `etc/view.xml`.
- **CMS components**: custom Hyvä CMS blocks live in a module depending on `Hyva_CmsBase`, declared in a `components.json` schema. Key gotchas: `children` is a root-level property (not a field type), validation lives under `attributes`, and the default-value key is `default_value`, not `default`.

## Responsive Images

Use `Hyva\Theme\ViewModel\Media::getResponsivePictureHtml()` to generate `<picture>` markup instead of hand-rolling `srcset`. Set `loading="eager" fetchpriority="high"` on the LCP image (hero/first product image) and `loading="lazy"` on everything below the fold, getting this backwards is a common, easy-to-miss LCP regression.

## Testing with Playwright

Hyvä pages scatter hidden `x-show` elements around the DOM, always scope message assertions to `#messages`, never a bare `.message.error` selector, or the test will match a hidden element and give a false pass/fail. Prefer `getByRole` / `getByLabel` / scoped `getByText` over raw CSS selectors, and use web-first assertions with a longer timeout to account for Alpine's reactive re-render delay after form submits.

## Official Hyvä AI Tools

Hyvä provides official AI skills for various assistants:

| Tool | Purpose | Install |
|------|---------|---------|
| hyva-alpine-component | CSP-compatible Alpine components | `.opencode/skills/` |
| hyva-child-theme | Theme creation | `.opencode/skills/` |
| hyva-cms-component | CMS blocks | `.opencode/skills/` |
| hyva-ui-component | UI component installation | `.opencode/skills/` |

```bash
# Install Hyvä AI tools
curl -fsSL https://raw.githubusercontent.com/hyva-themes/hyva-ai-tools/main/install.sh | sh -s opencode
```

## Verification

```bash
# Build CSS
cd web/tailwind && npm run build

# Clear cache
bin/magento cache:clean layout block_html full_page

# Static content deploy
bin/magento setup:static-content:deploy -f
```

### CSP Console Check

**Chrome DevTools MCP (preferred, if available):** navigate to the page,
then `list_console_messages`, filter for CSP violation reports
(`Content-Security-Policy` directive errors, "Refused to execute inline
script" / "Refused to load the stylesheet" messages). No manual browser
interaction needed; test with CSP headers enabled the same way.

**Manual fallback (no MCP connected):** open the page in a browser, check
the DevTools console for CSP errors, and confirm again with CSP headers
enabled.

## Pitfalls recap

- Hyvä replaces Luma entirely: no RequireJS, Knockout, UI-component JS, jQuery, or LESS in Hyvä templates.
- Every inline `<script>` needs `$hyvaCsp->registerInlineScript()`, or it silently fails under CSP.
- Prefer the CSP-safe Alpine pattern (named `Alpine.data()` functions, no inline expression logic like `@click="count++"`) even on a non-CSP build, it's the cleaner default and avoids a rewrite if the project later enables CSP.
- Rebuild Tailwind (`npm run build`) after any style change, or the new classes won't be in the compiled CSS.
- Always escape output in `.phtml` with `$escaper`, same as any other Magento template.