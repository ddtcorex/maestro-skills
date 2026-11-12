---
name: magento2-dev-core
description: "Use for Magento 2 module work: architecture, dependency injection, repositories, plugins, secure backend code, CLI, cron. Core skill, always load it first. Keywords dependency injection, plugin."
compatibility: claude, codex, opencode, copilot, dsh
metadata:
  audience: developers
  workflow: magento
  # no `requires`: the other Magento skills declare this one as their dependency
---

# Magento 2 Developer Core

## When to use

Load this skill before any other Magento 2 skill: it is the CORE skill the rest depend on for architecture, security and escaping.

- "new Magento 2 module", "module customization", "Dependency Injection", "di.xml", "Repository", "Plugin", "interceptor"
- "secure Magento code", "escaping", "backend logic", "CLI command", "cron job"

This skill provides the foundational patterns all Magento 2 developers must follow. It covers architectural decisions, security, and best practices that apply to every part of a Magento project.

## Related Skills

This is the foundation the other Magento 2 skills build on: `magento2-frontend-dev` and `magento2-hyva-dev` cover the two mutually exclusive theme stacks (check the theme's `theme.xml` parent to see which one the project actually uses, Luma vs Hyvä), `magento2-backend-dev` covers APIs/CLI/cron, and `magento2-linter`, `magento2-security-scan`, `magento2-performance-audit` verify the patterns below, `magento2-code-review` orchestrates all three (plus this skill's own anti-pattern checks) into one report scoped to a PR/module/theme/project. In a Govard environment, pair this with `govard-magento` for the container/CLI side.

## Core Architectural Standards

> Note: For framework-agnostic PHP (PSR-12/Composer/PDO) see `php-dev-core`. This skill covers Magento-specific DI/Repository/Plugin.

### Dependency Injection (DI)

**DO**: Use Constructor Injection for all dependencies.

```php
class MyService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly LoggerInterface $logger
    ) {}

    /**
     * @throws \Magento\Framework\Exception\NoSuchEntityException
     */
    public function getProduct(int $id): ProductInterface
    {
        // get() takes a SKU; getById() takes the entity id and throws
        // NoSuchEntityException instead of returning null.
        return $this->productRepository->getById($id);
    }
}
```

**NEVER**: Use `ObjectManager::getInstance()` (Service Locator anti-pattern).

```php
// WRONG - Never do this
$objectManager = \Magento\Framework\App\ObjectManager::getInstance();
$product = $objectManager->create(Product::class);

// CORRECT
public function __construct(ProductFactory $productFactory) {
    $this->productFactory = $productFactory;
}
```

### Service Contracts

Always prefer interfaces in `Api/` folders over concrete classes:

```php
// WRONG
public function __construct(Product $product) { }

// CORRECT
public function __construct(ProductInterface $product) { }
```

### Repositories

Always use repositories for data operations. Never call `load()`, `save()`, or `delete()` directly on models.

```php
// WRONG
$product = $this->productFactory->create();
$product->load($id);

// CORRECT
$product = $this->productRepository->getById($id);

// WRONG
$this->productFactory->create()->save($product);

// CORRECT
$this->productRepository->save($product);
```

### Plugins (Interceptors)

Prefer `before` and `after` plugins over `around` plugins:

| Plugin Type | Use Case |
|-------------|----------|
| `before` | Modify arguments before method execution |
| `after` | Modify return value after method execution |
| `around` | **Avoid unless necessary** - wraps the original method; it is skipped only when `$proceed` is not called |

```php
// Prefer this pattern
public function beforeExecute(
    SaveProduct $subject,
    ProductInterface $product
): array {
    // Validate or modify $product before save
    return [$product];
}

// Instead of around plugins that wrap the entire method
```

Plugins only intercept **public** methods, must be stateless, and should not target a module's own classes or data objects. Register them in `di.xml` with an explicit `sortOrder` when order matters. Observer order is *not* guaranteed by contrast, if the sequence matters, use a plugin instead of an observer. Before adding a new plugin or observer, check for existing ones on the same target class/event, `magento2-code-review`'s plugin/observer conflict check (`magento2-code-review/references/plugin-observer-conflict-check.md`) covers the grep procedure.

### Declarative Schema

Use `db_schema.xml` for all database changes. Never modify database directly:

```xml
<?xml version="1.0"?>
<!-- app/code/Vendor/Module/etc/db_schema.xml -->
<schema xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:Setup/Declaration/Schema/etc/schema.xsd">
    <table name="vendor_module_custom_table" resource="default">
        <column xsi:type="int" name="id" padding="10" unsigned="true" nullable="false" identity="true"/>
        <column xsi:type="varchar" name="name" nullable="false" length="255"/>
        <column xsi:type="timestamp" name="created_at" nullable="false" default="CURRENT_TIMESTAMP"/>
        <constraint xsi:type="primary" referenceId="PRIMARY">
            <column name="id"/>
        </constraint>
    </table>
</schema>
```

## Coding Standards

### PHPCS (Magento2 Ruleset)

| Rule | Example |
|------|---------|
| Class naming | `PascalCase` - `ProductRepository` |
| Method naming | `camelCase` - `getProductById()` |
| Property naming | `camelCase` - `$productId`, `$cacheIdPrefix` (legacy core code still has `$_underscore` names; do not copy them in new properties, but a subclass keeps inherited core names such as `$_eventPrefix` or `$_template`) |
| Visibility | Always explicit - `public`, `protected`, or `private` |
| Indentation | 4 spaces (no tabs) |
| Line endings | LF (Unix) |

### PHPStan Requirements

Run PHPStan with `bitexpert/phpstan-magento` for Magento's magic classes. Note the level you actually get: a project config at 6+ is what you want, but `govard audit run --checks lint` writes its own `phpstan.neon` at level 5 into the lint image and ignores the project one (`internal/frameworks/magento2/magento2.go` sets `PHPStanLevel: 5`), so the native gate is a level-5 run and there is no CLI flag to raise it. Keep the project's own `phpstan.neon` at 6+ as the stricter local gate, and treat the native run as the portable floor.

```bash
# In a Govard environment
govard sh -c "vendor/bin/phpstan analyse app/code -c phpstan.neon"
```

### Strict Typing

Always include at the top of new PHP files:

```php
<?php

declare(strict_types=1);
```

## Security Standards

### No Superglobals

**NEVER** use `$_GET`, `$_POST`, `$_REQUEST`, `$_SESSION`, `$_COOKIE` directly.

```php
// WRONG
$id = $_GET['id'];

// CORRECT - Use RequestInterface
public function __construct(
    private readonly \Magento\Framework\App\RequestInterface $request
) {}

$id = (int) $this->request->getParam('id');
```

### XSS Prevention

Always escape output in templates:

```php
// HTML content
<?= $escaper->escapeHtml($userInput) ?>

// HTML attributes
<div data-id="<?= $escaper->escapeHtmlAttr($id) ?>">

// JavaScript strings
<script>var name = '<?= $escaper->escapeJs($productName) ?>';</script>

// URLs
<a href="<?= $escaper->escapeUrl($url) ?>">

// CSS values
<div style="color: <?= $escaper->escapeCss($color) ?>">
```

The `Magento2.Security.XssTemplate` PHPCS sniff treats any method whose name contains `html` (e.g. `getLabelHtml()`) as already safe, do not wrap it in `escapeHtml()` again, that double-escapes the output.

### CSRF Protection

Include form key in all forms:

```php
<form action="<?= $escaper->escapeUrl($block->getSubmitUrl()) ?>" method="post">
    <?= $block->getBlockHtml('formkey') ?>
</form>
```

### Discouraged Functions

Use Magento wrappers instead of native PHP:

| Native PHP | Use Instead |
|------------|-------------|
| `serialize/unserialize` | `SerializerInterface` |
| `json_encode/decode` | `\Magento\Framework\Serialize\Serializer\Json` (raw `json_encode` only when embedding into HTML/JS, and then with the `JSON_HEX_*` flags) |
| `curl_*` | `Magento\Framework\HTTP\ClientInterface` |
| `date()`, `time()` | `\Magento\Framework\Stdlib\DateTime\DateTime` |
| `md5()`, `sha1()` | `EncryptorInterface` |

## Verification Workflow

Run these checks before completing any backend task:

```bash
# 1. PHPCS Linting
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module

# 2. PHPStan Analysis
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon

# 3. DI Compilation
bin/magento setup:di:compile

# 4. Flush cache
bin/magento cache:flush
```

## Usage Patterns

### Creating a Module

> **If it is unavailable:** verify registration.php, the etc/module.xml sequence, and that each etc/*.xml parses, by hand.

1. Create registration file: `app/code/Vendor/Module/registration.php`
2. Create `etc/module.xml` with correct sequence
3. Define `etc/di.xml` for preferences and plugins
4. Use `db_schema.xml` for database schema
5. Run `bin/magento module:enable Vendor_Module`

### CLI Commands

```php
// etc/di.xml
<type name="Magento\Framework\Console\CommandList">
    <arguments>
        <argument name="commands" xsi:type="array">
            <item name="vendor_module_sync" xsi:type="object">Vendor\Module\Console\Command\SyncCommand</item>
        </argument>
    </arguments>
</type>
```

### Cron Jobs

```xml
<!-- etc/crontab.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Cron:etc/crontab.xsd">
    <group id="default">
        <job name="vendor_module_cleanup" instance="Vendor\Module\Cron\Cleanup" method="execute">
            <schedule>0 2 * * *</schedule>
        </job>
    </group>
</config>
```

## Configuration File Reference

Read [references/config-files.md](references/config-files.md) when a module needs a new `etc/` file, or when you need to know what each one declares.

## Anti-Pattern Severity (for code review)

Full severity scale and stable finding codes (shared with `magento2-linter`,
`magento2-security-scan`, `magento2-performance-audit`, and
`magento2-code-review`): `references/severity-and-codes.md`. The
architecture anti-patterns this skill defines are catalogued there under the
`M2-ARCH-xxx` namespace, map a new finding to an existing code before
minting a new one.

## Testing Conventions

- **Unit tests** (`Test/Unit/`): typed mocks only, never `ObjectManager::getInstance()`, never test private methods via reflection, if a private method needs its own test, it belongs in its own class.
- **Integration tests** (`Test/Integration/`): use `Bootstrap::getObjectManager()`, load data with `@magentoDataFixture` fixture files rather than creating entities inline, and annotate with `@magentoDbIsolation` so tests don't leak state between each other.
- **Functional tests**: MFTF (Magento Functional Testing Framework) for full user-journey coverage.

## References

For detailed patterns, see:
- `references/coding-standards.md` - Extended PHPCS/PHPStan guide
- `references/architecture-patterns.md` - Service contracts, repositories, plugins
- `references/config-files.md` - The `etc/` files a module ships, and what each declares
- `references/findings-schema.md`: the findings.json contract every report renderer takes
  (`code`, `rule`, `severity`, anchors).
- `references/report-theme.md`: the report theme and contract behind
  `scripts/report/render.mjs`.
- `references/security-best-practices.md` - Security checklist and patterns
- `references/severity-and-codes.md` - Shared severity scale and finding codes (used by the whole QA quartet)