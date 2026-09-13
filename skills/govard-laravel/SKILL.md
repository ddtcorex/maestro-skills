---
name: govard-laravel
description: |
  This skill should be used when the user asks to "run migrations", "run artisan commands",
  "clear Laravel cache", "config:cache", "run queue operations", "schedule:run", "tinker into
  app", "artisan tinker", "run Laravel Pint", "lint Laravel project", "audit Laravel",
  "govard audit", "npm dev/prod", "deploy Laravel", or "govard deploy". Provides Laravel-specific Govard shortcuts and commands.
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

**Docker requirement:** stack commands here (`govard up/down/sh`, `govard db`,
`govard tool ...`) need Docker. On a host without it they exit `3` with
`CAPABILITY_MISSING`; `govard audit run --checks integrity` still works and
covers manifest/lock and Magento module/DI checks without a container.


For generic PHP (strict_types/PSR-12/PHPStan/Security) see php-dev-core.

## Artisan Commands

Laravel's `artisan` CLI runs inside the PHP container via `govard tool artisan`. Govard exposes every artisan command without entering the container shell:

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

## Audit

For generic PHP (strict_types/PSR-12/PHPStan/Security) see `php-dev-core`. For 4-framework matrix and `govard audit run --checks lint --lint-provider govard --mode project --format json` see `govard-toolbox` ## Audit.

**Laravel lint excludes (since `v1.68.0`):** `bootstrap/cache/*` and `storage/*` (`storage/framework/cache|sessions|views`, `storage/logs`) are **always ignored** — both `phpcs --ignore=*/bootstrap/cache/*,*/storage/*` and `phpstan excludePaths` in `docker/audit/bin/glint` and Go-side `filterGeneratedFindings` in `internal/audit/lint_govard.go`. Fresh `laravel 11` audit no longer fails on `bootstrap/cache/packages.php`/`services.php` or `storage/framework/views/*.php`; remaining findings are real project files (`config/`, `app/`, `tests/`).

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

Govard `stack.php_version` defaults to 8.4 for Laravel 11; verify with `govard config get stack.php_version` before running fresh migrations.

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

```bash
# Run tests
govard tool artisan test

# With PHPUnit
govard tool php artisan test
govard tool php vendor/bin/phpunit

# Specific test
govard tool php vendor/bin/phpunit --filter=UserTest
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

Laravel has no Govard `frontend_sync` watcher (unlike Hyvä/Luma). Use `govard tool npm run watch` for live builds.

## Environment (.env)

Govard injects `APP_KEY`, `DB_CONNECTION`, `DB_HOST`, and `APP_ENV` via `.env`. Check values:

```bash
govard config get stack.php_version
cat .env | grep -E 'APP_ENV|DB_'
govard tool artisan env
```

- `APP_ENV` defaults to `local`; Govard does not overwrite a committed `.env`.
- `DB_CONNECTION` is auto-wired to Govard MariaDB (`mariadb 11.4` default).
- `APP_KEY` is generated on `govard env up` if missing.

## Logging

```bash
# View logs
tail -f storage/logs/laravel.log

# Clear logs
govard tool artisan log:clear

# Laravel Debugbar (if installed)
curl -s https://local.test/_debugbar/open
```

## Deployment

Laravel ships a deploy recipe, so `govard deploy` runs Laravel's own commands instead of the engine's neutral defaults. Watch before you run:

```bash
govard deploy plan production          # the resolved pipeline — no connection, no Docker
govard deploy check production         # preflight over ssh
govard deploy production --yes
```

| Step | Command on the target |
|---|---|
| `build:vendors` | `composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist` |
| `build:frontend` | `frontend_command` inside each `frontend_dir`; an empty `frontend_dir` skips it |
| `app:configure` | `artisan storage:link` |
| `db:migrate` | `artisan migrate --force --no-interaction` |
| `maintenance:enable` / `disable` | `artisan down` / `artisan up`, run in the **served** release |
| `app:workers:pause` | with `worker_control: true`: `artisan queue:restart`, plus `horizon:terminate` if Horizon is installed |
| `app:cache:flush` | `artisan optimize:clear` then `artisan optimize` |
| `deploy:verify` (`app`) | `artisan db:show`; `migrate:status` on Laravel 10 and older |
| `db:backup` | **none** — `--db-backup` fails naming the reason instead of producing no dump |

`.env` is a shared **file** and `storage` a shared **directory** (the maintenance flag lives at `storage/framework/down`); `sync_paths` is `vendor` and `public/build` for an in-place docroot. Settings: `frontend_dir`, `frontend_command`, `worker_control`, `runtime_reload_command`.

- The caches are built **on the target**: `artisan optimize` writes `bootstrap/cache/config.php`, and once that file exists the process environment no longer overrides `.env`.
- Maintenance is guarded on `artisan` **and** `vendor/autoload.php` in the served path: on a first in-place deploy onto a fresh docroot both are absent, both steps exit 0, and **no window opens** — silently.
- `queue:restart` exits 0 whatever the cache store is, so `worker_control: true` only means something with a persistent store (Redis).
- **First deploy:** seed the target's `.env` first, or the release keeps the repository's copy, which names the local database.
- **In artifact mode** no Laravel step stays on the target — nothing is marked *needs the application* — so the artifact must carry `vendor/` and `public/build`; `app:cache:flush` still runs on the target.
- Sandbox: `default-mysql-client`, extensions `bcmath curl gd intl mbstring mysql sqlite3 xml zip`, services `mariadb` + `redis-server`.

> **On DSH:** `govard_deploy_plan {remote:"production"}` prints this pipeline without connecting; `govard_deploy_check` runs the preflight. Running it stays in the terminal.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> · worked config: <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-9-laravel>.

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
