---
name: govard-laravel
description: |
  This skill should be used when the user asks to "run migrations", "run artisan commands",
  "clear Laravel cache", "config:cache", "run queue operations", "schedule:run", "tinker into
  app", "artisan tinker", "run Laravel Pint", "lint Laravel project", "audit Laravel",
  "govard audit", or "npm dev/prod". Provides Laravel-specific Govard shortcuts and commands.
  DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: laravel
---

# Govard Laravel Commands

Laravel-specific shortcuts for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Laravel-specific shortcuts layered on top of Govard's base commands (`govard up`, `govard sh`, `govard db`).

For generic PHP (strict_types/PSR-12/PHPStan/Security) see php-dev-core.

## Artisan Commands

```bash
# Cache management
govard tool artisan config:cache
govard tool artisan config:clear
govard tool artisan cache:clear
govard tool artisan route:cache
govard tool artisan view:clear
```

## Audit

For generic PHP (strict_types/PSR-12/PHPStan/Security) see `php-dev-core`. For 4-framework matrix and `govard audit run --checks lint --provider govard --mode project --format json` see `govard-toolbox` ## Audit.

## Database

```bash
govard tool artisan migrate
govard tool artisan migrate:fresh
govard tool artisan migrate:status
govard tool artisan db:seed --class=UserSeeder
govard tool artisan tinker
govard db connect
```

## Queue Operations

```bash
govard tool artisan queue:work
govard svc up
govard tool artisan queue:failed
govard tool artisan queue:retry all
```

## Scheduler

```bash
govard tool artisan schedule:run
govard tool artisan schedule:list
```

## Development

```bash
govard tool artisan make:command MyCommand
govard tool artisan make:controller MyController
govard tool artisan make:model Post -mcr
govard tool artisan route:list --path=api
govard tool artisan tinker
```

## Testing

Laravel testing through Govard — verified 2026-08-28 via `internal/cmd/test_project.go` + `internal/frameworks/laravel/laravel.go` (govard v1.65.0).

```bash
govard test
govard test -- --filter UserTest --stop-on-failure
govard test phpunit -- --filter UserTest --testsuite Feature
govard tool artisan test --parallel
govard tool php -d memory_limit=-1 vendor/bin/phpunit --filter=UserTest
```

Coverage requires Xdebug (`govard debug on`): `govard tool artisan test --coverage --min=80`.

## Frontend Assets

```bash
govard tool npm install
govard tool npm run dev
govard tool npm run prod
rm -rf node_modules/.vite  # clear Vite cache
```

## Logging

```bash
tail -f storage/logs/laravel.log
govard tool artisan log:clear
```

## Common Workflows

```bash
# After pulling code
govard tool composer install
govard tool artisan migrate
govard tool artisan cache:clear

# Deployment prep
govard tool artisan config:cache
govard tool artisan route:cache
govard tool artisan view:cache
govard tool npm run prod
```
