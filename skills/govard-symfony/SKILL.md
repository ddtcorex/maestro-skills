---
name: govard-symfony
description: |
  This skill should be used when the user asks to "clear Symfony cache", "run bin/console commands", "run doctrine migrations", "debug Symfony routes", "run Symfony CLI", "govard tool symfony", "symfony cache:clear", "lint Symfony project", "audit Symfony", "govard audit", "deploy Symfony", or "govard deploy". Provides Symfony-specific Govard shortcuts. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: symfony
---

# Govard Symfony Commands

Symfony-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first; this skill only covers Symfony-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

**Docker requirement:** `govard tool symfony|composer|npm`, `govard sh` and
`govard db` need Docker (see the `requires` field in `govard capabilities
--json`). `govard deploy plan` needs nothing beyond the host. `govard audit run --checks integrity` is **not** supported for Symfony
(it errors with `framework "symfony" does not support integrity audit`).

For generic PHP (strict_types/PSR-12/PHPStan/Security) see php-dev-core.

## Symfony CLI

Symfony console is `bin/console` inside the PHP container. Govard exposes it as `govard tool symfony`:

```bash
# Run any bin/console command
govard tool symfony cache:clear
govard tool symfony debug:router
govard tool symfony make:controller BlogController

# Alternative: open shell and run natively
govard sh
bin/console cache:clear
```

## Audit

For generic PHP (strict_types/PSR-12/PHPStan/Security) see `php-dev-core`. For the lint audit matrix see `govard-toolbox` ## Audit.

```bash
govard audit run --checks lint --lint-provider govard --mode project --format json
```

It runs PHPCS (Symfony coding standard) and PHPStan (with `phpstan/phpstan-symfony`) in the audit toolchain image and exits non-zero when any check fails. A fresh skeleton already reports PHPCS findings (missing license and class doc comments in `src/Kernel.php`, `config/reference.php`), so expect findings on generated code.

## Cache Management

```bash
# Clear cache (no warmup)
govard tool symfony cache:clear --no-warmup

# Warmup after clear
govard tool symfony cache:warmup

# Clear + warmup in one step (default)
govard tool symfony cache:clear

# Pool-specific clear (if using cache pools)
govard tool symfony cache:pool:clear cache.app
```

Govard's PHP runtime is `stack.php_version`. **Do not assume a number**, read it:

```bash
govard config get stack.php_version   # the series this project runs
govard doctor                         # advisory: flags a PHP series below the framework profile's recommendation
```

A bootstrap warning like `Cannot use symfony/skeleton ... as it requires
php >=8.x` means the resolved PHP is *below* what the skeleton demands: raise
`stack.php_version` (`govard config set stack.php_version <series>`) and re-run
`govard env up`. The merged config plus the running containers are the truth.

## Routing & Debug

```bash
# List all routes
govard tool symfony debug:router

# Single route (use a name printed by the full list)
govard tool symfony debug:router <route_name>

# Container services
govard tool symfony debug:container
govard tool symfony debug:container --parameters

# Environment info
govard tool symfony debug:config framework
```

## Doctrine ORM

> Prerequisite: the fresh `symfony/skeleton` ships without Doctrine, so `doctrine:*` is an undefined namespace until you install it: `govard tool composer require symfony/orm-pack doctrine/doctrine-migrations-bundle`. Add `symfony/maker-bundle` as a dev dependency if you want `make:*`.

Govard does **not** write `DATABASE_URL` on `govard env up`. Set it yourself (see Environment below), then:

```bash
govard tool symfony doctrine:database:create --if-not-exists
govard tool symfony doctrine:migrations:status
govard tool symfony doctrine:migrations:diff     # exits 1 with "No changes detected" when there is nothing to diff
govard tool symfony doctrine:migrations:migrate --dry-run
govard tool symfony doctrine:migrations:migrate --no-interaction
govard tool symfony doctrine:schema:validate

# Fixtures (dev only, needs doctrine/doctrine-fixtures-bundle)
govard tool symfony doctrine:fixtures:load --append

# Direct SQL through Govard's DB layer
govard db query "SHOW TABLES"
```

`migrate` (with or without `--dry-run`) exits 1 with `The version "latest" couldn't be reached, there are no registered migrations` while `migrations/` is empty; generate a migration first. The version table is `doctrine_migration_versions`.

## Assets

```bash
# Install bundle assets
govard tool symfony assets:install

# Webpack Encore (if used)
govard tool npm install
govard tool npm run dev
govard tool npm run build
```

`govard tool npm|pnpm|yarn|npx` run in a separate Node container whose image follows `stack.node_version`, with the project mounted at `/var/www/html`; they fail with ENOENT until a `package.json` exists. `govard frontend start` is a Magento-style sync watcher and refuses to run unless `stack.features.frontend_sync` is enabled, so for Symfony use `govard tool npm run watch` for live builds.

## Environment (.env)

`govard env up` does not touch the application's env files. `govard bootstrap` creates `.env.local` only when it is missing (`APP_ENV`, `APP_SECRET`, `DATABASE_URL`, `MAILER_DSN`), and `govard config auto` reports that Symfony is not supported yet. On a project you scaffolded yourself, create `.env.local` yourself:

```bash
govard config get stack.db_version
govard tool symfony debug:container --env-vars   # what the app actually resolves
```

- The default DB container uses user, password and database `symfony` on host `db`, port `3306`, so a working URL is `mysql://symfony:symfony@db:3306/symfony?serverVersion=<db_version>-MariaDB&charset=utf8mb4`. Match `serverVersion` to `stack.db_version`: the value `govard bootstrap` writes is fixed and may not match it.
- Mail: the Mailpit host resolves inside the PHP container as `mail` (port `1025`), so use `MAILER_DSN=smtp://mail:1025`. Check what `govard bootstrap` wrote: `mailpit` does not resolve there. UI: `govard open mail`.
- A committed `.env` is never overwritten.

For env-specific overrides use `GOVARD_ENV=staging govard env up` (loads `.govard.staging.yml`).

## Deployment

Symfony ships a deploy recipe. Its point is undoing Composer's `auto-scripts`, which run `cache:clear` and `assets:install` in the wrong place: both belong on the target, not on whichever machine ran `composer install`.

```bash
govard deploy plan production --branch main   # resolved pipeline, no connection, no Docker
govard deploy check production --branch main  # preflight over ssh
govard deploy production --yes
```

The remote needs a `branch` (or pass `--branch`/`--revision`/`--tag`) and a `deploy_path` (`remotes.<name>.deploy.deploy_path`), otherwise plan/check exit `4` (configuration). Run `govard deploy plan` to see the exact commands; the Symfony-specific tasks are:

| Step | Command on the target |
|---|---|
| `build:vendors` | `composer install --no-dev --optimize-autoloader ... --no-scripts` |
| `build:assets` | `bin/console assets:install public --symlink --relative` (no `--env` flag) |
| `build:frontend` | `frontend_command` (default `npm ci && npm run build`) inside each `frontend_dir` |
| `db:migrate` | `doctrine:migrations:migrate --env=<symfony_env> --no-interaction --allow-no-migration` |
| `app:cache:flush` | `cache:clear --no-warmup` then `cache:warmup`, both `--env=<symfony_env>`, then `runtime_reload_command` |
| `app:workers:pause` | only with `worker_control: true`: `messenger:stop-workers --env=<symfony_env>` |
| `maintenance:enable` / `disable` | none, reported as skipped (Symfony has no core mechanism) |
| `db:backup` | none, reported as skipped |

- `.env.local` is a shared file and `var/log` a shared directory; `var/cache` is deliberately not shared (the compiled container belongs to one release and one environment). `sync_paths` are `vendor` and `public/bundles`.
- `symfony_env` (default `prod`) sets `--env` on the migrate, cache and worker commands and is not validated, so a typo builds the wrong cache directory. `--allow-no-migration` is there because an empty `migrations/` directory is a healthy project.
- **`assets:install` takes no `--env`**, so it uses the target's own `APP_ENV`. With `--no-dev` vendors, a target whose `APP_ENV` resolves to `dev` dies with `Class "...MakerBundle" not found`. Set `APP_ENV=prod` in the shared `.env.local` (or the committed `.env`).
- Any bundle registered for all environments in `config/bundles.php` (for example `DoctrineMigrationsBundle`) must be in `require`, not `require-dev`, or the `--no-dev` install breaks the console on the target.
- **There is no maintenance window.** `db:migrate` runs against a live site; a project that needs a window anchors two `deploy.hooks` on `maintenance:enable` / `maintenance:disable`.
- Set `deploy.settings.runtime_reload_command` (FPM reload or opcache reset) when the target serves a symlinked release with a bytecode cache; `govard deploy check` warns about it.
- `govard deploy rollback`, `releases`, `status`, `unlock` and `build` exist; see `--help`. A failed deploy keeps its lock after publish starts; `govard deploy unlock` refuses a fresh lock without `--force`.
- Rehearse without a real server: `govard sandbox up`, then `govard deploy --remote sandbox --yes` (needs a git repo with a commit). The default `php` sandbox profile has no `pdo_mysql`, so `db:migrate` fails there for a Doctrine project; use `--profile full` or skip migrations in the rehearsal.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-10-symfony>.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool symfony doctrine:migrations:migrate --no-interaction   # needs at least one migration
govard tool symfony cache:clear
```

### Debugging Routes

```bash
govard tool symfony debug:router | grep api
govard tool symfony debug:router app_blog_show --show-controllers
```
