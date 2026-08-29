# Coding Standards Reference

Detailed PSR-12 checklist and static analysis configuration for generic PHP.

## PSR-12 Checklist

### File Header

Every file starts with strict types on line 2:

```php
<?php
declare(strict_types=1);

namespace Vendor\Package;

use Vendor\Package\Service\UserService;
use Vendor\Package\Dto\UserDto;
```

- Blank line after `declare(strict_types=1);`.
- One `declare` per file, never repeated.
- `namespace` on its own line, then grouped `use` imports.

### Braces and Structure

- Classes and methods: opening brace on next line.
- Control structures (`if`, `for`, `foreach`, `match`): opening brace on same line.
- Closing brace always on its own line.
- One class per file, file name matches class `PascalCase`.

```php
// Correct — class/method brace next line
final class UserService
{
    public function findById(int $id): ?UserDto
    {
        if ($id <= 0) {
            throw new \InvalidArgumentException('Invalid id');
        }
        return $this->repository->find($id);
    }
}
```

### Use Grouping

Group imports from the same namespace; one `use` per line for readability.

```php
// Preferred — grouped when same vendor
use Vendor\Package\Dto\UserDto;
use Vendor\Package\Exception\NotFoundException;
use Vendor\Package\Repository\UserRepository;

// Alternative grouped syntax (also valid PSR-12)
use Vendor\Package\Dto\{UserDto, CreateUserDto};
```

Remove unused imports — PHPCS flags them.

### Visibility and Modifiers

- Always explicit: `public`, `protected`, `private`.
- Order: `public`/`protected`/`private` then `static`, `readonly`, `final`.
- Prefer `readonly` properties and `readonly class` for DTOs.
- Mark classes `final` by default.

```php
final readonly class CreateUserDto
{
    public function __construct(
        public string $email,
        public string $name,
    ) {}
}
```

### Line Length and Formatting

- Soft limit 120 characters; PHPCS hard limit 120.
- 4 spaces indentation, no tabs, LF endings.
- One blank line between methods, no trailing whitespace.

## PHPStan Configuration

Minimum level 6 for generic PHP. Raise to 8 when codebase allows.

```neon
# phpstan.neon
parameters:
  level: 6
  paths: [src]
  checkMissingIterableValueType: false
```

Extended example with stricter settings:

```neon
parameters:
  level: 6
  paths:
    - src
  excludePaths:
    - tests
  checkMissingIterableValueType: false
  reportUnmatchedIgnoredErrors: false
  ignoreErrors:
    - '#Missing return statement#'  # only for legacy, with comment

includes:
  - vendor/phpstan/phpstan/conf/bleedingEdge.neon
```

Run analysis:

```bash
vendor/bin/phpstan analyse -c phpstan.neon
govard audit run --checks lint --lint-provider govard --mode project --format json
```

Treat every error as a defect — add types instead of extending `ignoreErrors`. Baseline only for third-party legacy code with an expiry comment.

## PHPCS Configuration

```xml
<!-- phpcs.xml -->
<?xml version="1.0"?>
<ruleset name="VendorPackage">
    <description>PSR-12 for generic PHP</description>
    <file>src</file>
    <file>tests</file>
    <arg name="standard">PSR12</arg>
    <arg name="encoding">utf-8</arg>
    <arg name="tab-width">4</arg>
</ruleset>
```

```bash
vendor/bin/phpcs --standard=PSR12 src tests
vendor/bin/phpcbf --standard=PSR12 src  # auto-fix
```

## Common Violations

| Error | Fix |
|-------|-----|
| Missing `declare(strict_types=1)` | Add on line 2 |
| Unused `use` | Remove import |
| Line too long (>120) | Split arguments or chain |
| Missing visibility | Add `public`/`private` |
| No blank line after `use` block | Insert blank line before `class` |
