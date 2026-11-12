# Reviewing Tailwind and Hyvä diffs

The six checks to run before claiming a Hyvä or Tailwind change works, in order.

When reviewing a diff against a Hyvä theme, never assert that a utility class "is missing", "compiles to nothing", or "will be purged" without verifying against the actual project. Work through this gate:

### 1. Detect the stack first

Read `<theme>/web/tailwind/package.json` for the `tailwindcss` major version. Hyvä default theme 1.4.x/1.5.x ships Tailwind v4, 1.2.x/1.3.x v3, older v2. The version decides what "exists":

- **Tailwind v3**: a utility exists only if it is in the default scale OR `theme.extend.*` OR produced by a plugin/safelist entry in `tailwind.config.js`.
- **Tailwind v4**: numeric spacing utilities are dynamic (`w-18`, `py-3.75` work out of the box); sources come from CSS `@source` directives and `hyva.config.json` (`tailwind.include/exclude`). Editing `hyva.config.json` on a v3 setup is a silent no-op.

### 2. Check the real config before claiming absence

Grep/read the theme's actual `tailwind.config.js` for `theme.extend.*`, `safelist`, and the `content` globs before any existence claim. Three traps:

- `safelist` entries survive purge scanning even when no scanned source uses them, "no usage found in markup" is NOT evidence that a class is missing.
- `content` globs may exclude whole trees (stock Hyvä child themes ship with the `app/code/**` glob commented out); classes outside scan scope need safelist or arbitrary-value syntax.
- CMS-content classes can live in `Hyva_CmsTailwindJit` **database-stored** CSS injected at render time, they never appear in `web/css/styles.css`, so absence from built CSS is not proof of absence.

### 3. Built CSS: only if actually present

If a compiled stylesheet is available (committed, or built locally), grep it for the escaped selector as final confirmation. Review worktrees usually have NO built CSS and NO `vendor/`, do not attempt to read either; infer composer dependencies from `composer.json`/`composer.lock`. If verification is impossible from where you stand, downgrade the finding to a question ("confirm X survives the build") instead of an assertion.

### 4. Dynamic class names

PHP-interpolated utilities (`class="columns-<?= $n ?>"`) are invisible to the scanner. Suggest the fix ladder: CSS-variable binding via arbitrary-value syntax, or a co-located PHP comment listing every variant (Tailwind scans comments), or safelist / `@source inline()` reserved for DB-sourced values only.

### 5. Alpine under strict CSP

Directive values must be dot paths, no operators, literals, globals, or spaces. Violations fail silently (console.warn only), so static review is the primary gate.

`x-model` on a CSP build is a failing finding, even with a plain dot path: it reads the value once, but writes back through `${expression} = __placeholder`, which the dot-path evaluator cannot resolve, so user input never reaches the component. The fix is `:value` (or `:checked`) plus `@input`/`@change` calling a method that assigns `this.$event.target.value`, or `x-modelable` on a component that exposes a setter method.

### 6. Alpine scope follows the DOM

Alpine 3 resolves an expression through every ancestor `x-data` in the rendered DOM, not only the closest component: a nested component reads the parent's properties, and `this.prop = value` writes back to the parent. A property missing from a component's own `return {...}` is therefore not evidence that a binding is undefined.

Before claiming `Alpine Expression Error: … is not defined` or "the value is never submitted":

- Find where the template is rendered. A child `.phtml` included through `$block->getLayout()->createBlock()` or `getChildHtml()` sits inside whatever element wraps that call, so read the caller and match the opening and closing tags around it.
- Check the sibling fields in the same component. If they use the same pattern (bound in the child, declared only on an ancestor) and work, the new binding works too.
- Only when no ancestor declares the property, and `Alpine.store` does not supply it, report the binding as broken. If the render chain cannot be traced from the worktree, ask instead of asserting.

The same rule holds for Knockout `$parent` / `$root` in Luma templates.

> Idea credits: verification-gate patterns distilled from makotokimura96/hyva-skills (CC BY 4.0) and hyva-themes/hyva-ai-tools (OSL-3.0).
