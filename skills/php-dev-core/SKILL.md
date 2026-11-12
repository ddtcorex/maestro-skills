---
name: php-dev-core
description: Use when writing generic PHP, building a Composer package, following PSR-4 or PSR-12, running PHPStan or PHPCS, handling PHP security, or framework-agnostic logic. DEPENDENT on govard-toolbox.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: php
---

# PHP Developer Core

## When to use

Load this skill for PHP work outside a specific framework; it is DEPENDENT on govard-toolbox for environment commands.

- "write generic PHP", "create a Composer package", "PSR-4/PSR-12"
- "run PHPStan", "run PHPCS", "PHP security", "framework-agnostic PHP logic"

Foundation skill for framework-agnostic PHP. Covers coding standards, Composer, static analysis, security, and testing across Magento 2, Laravel, Symfony, and WordPress. Pair with `govard-toolbox` for container and environment commands (`govard up`, `govard sh`, `govard audit`). For framework-specific tooling see `govard-laravel`, `govard-symfony`, `govard-wordpress`, or `magento2-dev-core` for Magento DI and service contracts.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first for environment lifecycle and audit matrix. This skill adds language-level patterns. Framework skills (`govard-laravel`, `govard-symfony`, `govard-wordpress`) depend on both `govard-toolbox` and `php-dev-core`; `magento2-dev-core` cross-references this skill for generic PHP and owns Magento-specific DI and plugins.

## 1. Coding Standards & Types

Every new PHP file MUST start with strict types:

```php
<?php

declare(strict_types=1);
```

The blank line is part of PSR-12 (`PSR12.Files.FileHeader.SpacingAfterBlock`):
PHPCS flags a header block glued to `declare` and `phpcbf` re-adds it.

PSR-12 is the default. When framework conventions diverge, PSR-12 wins for generic code.

| Rule | PSR-12 | Notes |
|------|--------|-------|
| Opening tag | `<?php` then `declare(strict_types=1);` | Blank line after declare |
| Braces | Next line for classes/methods | Same line for controls |
| Visibility | Always explicit: `public`, `protected`, `private` | Include `readonly` where needed |
| Naming | Classes `PascalCase`, methods `camelCase` | Constants `UPPER_SNAKE` |
| Use grouping | Grouped `use` for same namespace | One `use` per line for clarity |
| Indentation | 4 spaces, no tabs, LF | Soft limit 120, no hard limit |

PSR-4 autoloading is required. Map namespaces in `composer.json`:

```json
{
  "autoload": {
    "psr-4": { "Vendor\\Package\\": "src/" }
  }
}
```

PHP 8.1 and later idioms to prefer (8.5 is current; `magento2-linter` owns the per-version
toolchain matrix):

- `readonly` properties for DTOs (8.1+), `readonly class` only on 8.2+, constructor promotion
  (unless your project's house conventions skill, if any, asks for explicit declaration).
- `enum` for closed sets instead of class constants (8.1+).
- `match` over `switch` for exhaustive mapping; `never` for functions that always throw.
- Intersection types (`X&Y`) and `mixed` where genuinely needed; avoid untyped parameters.
- `final` classes by default; open only with documented reason.

Example with promotion and readonly:

```php
<?php

declare(strict_types=1);

namespace Vendor\Package;

use Vendor\Package\Dto\Status;

final class UserDto
{
    public function __construct(
        public readonly int $id,
        public readonly string $email,
        public readonly string $name,
    ) {
    }
}

function resolveStatus(string $raw): Status
{
    return match ($raw) {
        'active' => Status::Active,
        'inactive' => Status::Inactive,
        default => throw new \InvalidArgumentException("Unknown status: $raw"),
    };
}
```

On 8.2+ `final readonly class UserDto` says the same thing in one keyword. The expanded
constructor body is not style: PSR-12 wants the closing brace on its own line
(`Squiz.WhiteSpace.ScopeClosingBrace.ContentBefore`), so `) {}` fails the gate below.

Run `composer dump-autoload --optimize` after changing autoload maps and verify with `composer validate --strict`.

## 2. Composer

Never commit `vendor/`, and always commit `composer.lock` for applications (omit it for libraries). Read [references/composer.md](references/composer.md) when validating, auditing, installing or updating dependencies, adding a private repository, or packaging a library.

## 3. Static Analysis

Two gates: PHPCS for style, PHPStan for types. Both must pass before merge.

### PHPCS (PSR-12)

```bash
vendor/bin/phpcs --standard=PSR12 src tests
```

If the package is part of a Laravel, Symfony, WordPress or Magento project, the same
gate runs through Govard, which brings its own PHPCS/PHPStan toolchain:

```bash
govard audit run --checks lint --lint-provider govard --mode project --format json
govard audit run --checks lint --lint-provider govard --mode project  # text, capped
```

Fix auto-fixable violations with `phpcbf --standard=PSR12 src`.

### PHPStan (Level 6+)

Level 6 is the minimum; raise to 8 when possible.

```bash
vendor/bin/phpstan analyse -c phpstan.neon
```

Sample `phpstan.neon` (full config in `references/coding-standards.md`):

```neon
parameters:
  level: 6
  paths: [src]
```

The PHPStan 1.x switches `checkMissingIterableValueType` and
`checkGenericClassInNonGenericObjectType` are gone in 2.0; ignore those findings by
error identifier (`missingType.iterableValue`, `missingType.generics`) if you must.

For a framework-less package the gate is `phpcs --standard=PSR12` plus `phpstan analyse`:
Govard's lint audit only resolves for the frameworks it knows (Magento 2, Laravel, Symfony,
WordPress) and answers `framework "custom" does not support lint audit` for a plain Composer
package, pointing back at `govard tool php vendor/bin/phpcs`. Inside one of those frameworks
Govard audit is the source of truth for CI, running PHPCS PSR12 plus PHPStan and the pub/media
guard; there use `--mode project` for full scans, `--mode standalone` for isolated packages and
`--scope diff --base origin/master` for PR quick scans (see `govard-toolbox` ## Audit). Treat
every PHPStan error as a defect: add types instead of baseline ignores.

## 4. Security Baseline

Apply these rules to every PHP change regardless of framework.

### Input: Never Trust Superglobals

**NEVER** read `$_GET`, `$_POST`, `$_REQUEST` or `$_COOKIE` directly: use `filter_input` or the framework request object. Session state belongs behind a session abstraction, and even there prefer the framework session object.

```php
// WRONG
$id = $_GET['id'];

// CORRECT, filter_input with explicit filter
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$name = filter_input(INPUT_POST, 'name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);

// Only where filter_input cannot be used (CLI, a test double), same validation
$raw = $_GET['id'] ?? null;
$id = filter_var($raw, FILTER_VALIDATE_INT);
if ($id === false || $id === null) {
    throw new \InvalidArgumentException('Invalid id');
}
```

### Output: Escape on Render

Escape at the boundary where data becomes HTML, JS, URL, or CSS:

```php
echo htmlspecialchars($userInput, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
echo '<div data-id="' . htmlspecialchars($id, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">';
echo '<script>var name = ' . json_encode($name, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) . ';</script>';
```

For plain PHP templates, `htmlspecialchars` with `ENT_QUOTES | ENT_SUBSTITUTE` and explicit `UTF-8` is the baseline. Framework escapers (`Magento Escaper`, `Laravel e()`, `Symfony Twig autoescape`) build on the same principle.

### Database: Prepared Statements Only

**NEVER** interpolate variables into SQL. Use `PDO::prepare` with bound parameters:

```php
// WRONG, SQL injection
$pdo->query("SELECT * FROM users WHERE email = '$email'");

// CORRECT, PDO::prepare with named placeholders
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email AND status = :status');
$stmt->bindValue(':email', $email, \PDO::PARAM_STR);
$stmt->bindValue(':status', $status, \PDO::PARAM_STR);
$stmt->execute();
$rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

// Also correct, execute with array
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
$stmt->execute([':id' => $id]);
```

Disable emulated prepares when possible (`PDO::ATTR_EMULATE_PREPARES => false`).

### Cryptography: Use Modern Primitives

| Instead of | Use |
|------------|-----|
| `md5()`, `sha1()` | `password_hash()` / `password_verify()` for passwords |
| `uniqid()`, `rand()`, `mt_rand()` | `random_bytes()` / `random_int()` for tokens |
| `serialize()` / `unserialize()` | `json_encode()` / `json_decode()` with `JSON_THROW_ON_ERROR` |

```php
$hash = password_hash($password, PASSWORD_DEFAULT);
if (!password_verify($password, $hash)) {
    throw new \RuntimeException('Invalid credentials');
}
$token = bin2hex(random_bytes(32));
$json = json_encode($data, JSON_THROW_ON_ERROR);
```

Store secrets in `.env` (never in code). Generate CSRF tokens with `random_bytes` and validate with `hash_equals`. Finding codes: `PHP-SEC-xxx` / `PHP-ARCH-xxx`, see `references/security-best-practices.md`.

## 5. Testing & Verification

### Test Layout

- **PHPUnit** (or Pest) under `tests/` mirroring `src/` via PSR-4 `autoload-dev`.
- Unit tests: typed mocks, no real I/O; integration tests: real container/DB with isolation.

```bash
vendor/bin/phpunit --testdox          # needs the phpunit.xml.dist below
vendor/bin/pest --coverage            # needs a coverage driver (pcov or xdebug)

Minimal `phpunit.xml.dist` for the layout above (without it PHPUnit prints its usage and
exits 1):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="vendor/autoload.php" colors="true">
    <testsuites>
        <testsuite name="unit">
            <directory>tests</directory>
        </testsuite>
    </testsuites>
</phpunit>
```
php -l src/Service/UserService.php
vendor/bin/phpcs --standard=PSR12 src tests
vendor/bin/phpstan analyse -c phpstan.neon
composer validate --strict
composer audit
```

### Verification Checklist (Run Before Every Commit)

```bash
find src -name '*.php' -exec php -l {} \;                         # 1. Syntax, one file per call
vendor/bin/phpcs --standard=PSR12 src tests  # 2. Style PSR-12
vendor/bin/phpstan analyse -c phpstan.neon  # 3. Types L6+
composer validate --strict                   # 4. Manifest valid
composer audit                               # 5. No known CVEs
vendor/bin/phpunit --testdox                 # 6. Tests green
```

Inside a Magento, Laravel, Symfony or WordPress project add the same gate through Govard
(`govard audit run --checks lint --lint-provider govard --mode project --format json`), which
bundles its own PHPCS, PHPStan and the pub/media guard. A framework-less package has no such
target: Govard refuses lint audit for it, so steps 2 to 6 are the gate.

## Audit

For the 4-framework audit matrix (quick vs deep scope, `--scope diff` vs `--scope project`, base branch, timing, provider rules) see `govard-toolbox` ## Audit. This skill delegates all audit-mode and provider specifics there. Fallback without Govard is `phpcs --standard=PSR12` plus `phpstan analyse -c phpstan.neon` at level 6+. No nesting, `govard audit` and `govard tool` are host-side commands, not container-nested (do not wrap them with `govard sh -c`).

## References

- `references/coding-standards.md`: PSR-12 checklist, phpstan.neon sample, and strict-types patterns.
- `references/security-best-practices.md`: XSS, SQL injection, CSRF, and cryptography examples.
- `references/architecture-patterns.md`: Service, DTO (readonly class), factory, and PSR-11 container patterns.
- `references/composer.md`: validate, audit, install, outdated and update, with autoloading and scripts.
