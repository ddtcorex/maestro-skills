---
name: govard-laravel
description: |
  This skill should be used when the user asks to "run migrations", "run artisan commands",
  "clear Laravel cache", "config:cache", "run queue operations", "schedule:run", "tinker into
  app", "artisan tinker", "run Laravel Pint", or "npm dev/prod". Provides Laravel-specific
  Govard shortcuts and commands. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: laravel
---

# Govard Laravel Commands

Laravel-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Laravel-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

## Artisan Commands

```bash
# Cache management
govard tool artisan config:cache
govard tool artisan config:clear
govard tool artisan cache:clear

# Route cache
govard tool artisan route:cache
govard tool artisan route:clear

# View cache
govard tool artisan view:cache
govard tool artisan view:clear
```

## Database

```bash
# Migrations
govard tool artisan migrate
govard tool artisan migrate:fresh
govard tool artisan migrate:refresh
govard tool artisan migrate:rollback
govard tool artisan migrate:status

# Seeders
govard tool artisan db:seed
govard tool artisan db:seed --class=UserSeeder

# Factory
govard tool artisan make:factory PostFactory
govard tool artisan tinker

# Direct SQL
govard db connect
```

## Queue Operations

```bash
# Start queue worker
govard tool artisan queue:work

# Queue withSupervisor
govard svc up

# Retry failed jobs
govard tool artisan queue:retry all
govard tool artisan queue:failed

# Clear queue
govard tool artisan queue:flush
```

## Scheduler

```bash
# Run scheduler (keep in cron)
govard tool artisan schedule:run

# List scheduled
govard tool artisan schedule:list
```

## Development

```bash
# Create commands
govard tool artisan make:command MyCommand
govard tool artisan make:controller MyController
govard tool artisan make:model Post
govard tool artisan make:migration create_posts_table

# Tinker (interactive REPL)
govard tool artisan tinker

# Show routes
govard tool artisan route:list
govard tool artisan route:list --path=api
```

## Testing

Laravel testing through Govard — verified 2026-08-28 fresh `govard-test-laravel` (Laravel 13.29.0 via `laravel/laravel` latest, PHP 8.3.33, PHPUnit 12.5.34, `govard test` → `php artisan test` 2/2 pass) via `internal/cmd/test_project.go` + `internal/frameworks/laravel/laravel.go` (govard v1.65.0). Note: `--framework-version 11` currently installs latest Laravel 13 (`bootstrap.go:46` unpinned `laravel/laravel` for 11/12; only 10/9 pinned) — `phpunit`/`artisan test` behavior identical. `pest` not installed by default (`vendor/bin/pest` missing, `allow-plugins: pestphp/pest-plugin` true). `govard test` dispatches inside the PHP container with `memory_limit=-1` for PHPUnit.

### Govard Test Shortcuts

```bash
# Default suite — Govard maps to php artisan test (laravel DefaultTestCommand)
govard test
govard test -- --filter UserTest --stop-on-failure

# Explicit PHPUnit (bypasses Artisan wrapper, uses memory wrapper)
govard test unit
govard test phpunit -- --filter UserTest --testsuite Feature

# Static analysis via PHPStan (if vendor/bin/phpstan exists)
govard test phpstan
govard test phpstan -- --level=8 app
```

`govard test --help` lists `phpunit|phpstan|mftf|unit|integration`; unknown suite → `unknown test suite: <name>`.

### Artisan Test (framework-native)

```bash
# All tests
govard tool artisan test

# Parallel (requires pestphp/pest or phpunit 10+ with --parallel support)
govard tool artisan test --parallel

# Filter / stop on failure
govard tool artisan test --filter=UserTest --stop-on-failure

# Pest (if pestphp/pest installed — drop-in for PHPUnit)
govard tool pest -- --filter="creates user"
govard tool php vendor/bin/pest --filter="UserTest"

# Direct PHPUnit
govard tool php -d memory_limit=-1 vendor/bin/phpunit --filter=UserTest --testsuite Feature
govard tool php -d memory_limit=-1 vendor/bin/phpunit --stop-on-failure --testdox
```

### Coverage (requires Xdebug)

```bash
# Enable Xdebug for coverage (Govard)
govard debug on  # or govard debug --mode=coverage

# Artisan coverage
govard tool artisan test --coverage --min=80

# PHPUnit coverage directly
govard tool php -d xdebug.mode=coverage vendor/bin/phpunit --coverage-html coverage
govard tool php -d xdebug.mode=coverage vendor/bin/phpunit --coverage-text --min=80

# Via phpdbg (no Xdebug)
govard tool phpdbg -qrr vendor/bin/phpunit --coverage-html coverage
```

Coverage HTML lands in `coverage/` at project root — open `coverage/index.html` via `https://laravel.test/coverage/` or `govard open` if web root exposes it.

### VSCode Integration

If `govard vscode` is used, PHPUnit path mapping is auto-wired:

```bash
govard vscode phpunit -- --filter=UserTest
# Maps to php -d memory_limit=-1 vendor/bin/phpunit inside container (see internal/cmd/vscode_setup.go)
```

## Frontend Assets

```bash
# Node modules
govard tool npm install
govard tool npm run dev
govard tool npm run prod
govard tool npm run watch

# Laravel Mix (if using)
govard tool npm run dev
govard tool npm run production

# Clear Vite cache
# node_modules is bind-mounted into the container; clearing from the host is safe
rm -rf node_modules/.vite
```

## Logging

```bash
# View logs
tail -f storage/logs/laravel.log

# Clear logs
govard tool artisan log:clear

# Laravel Debugbar (if installed)
curl -s https://local.test/_debugbar/open
```

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool artisan migrate
govard tool artisan cache:clear
govard tool npm install && govard tool npm run dev
```

### Creating Features

```bash
govard tool artisan make:model Post -mcr  # Model + Migration + Controller
govard tool artisan migrate
govard tool artisan route:list
```

### Deployment Prep

```bash
govard tool artisan config:cache
govard tool artisan route:cache
govard tool artisan view:cache
govard tool npm run prod
```