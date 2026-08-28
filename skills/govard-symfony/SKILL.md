---
name: govard-symfony
description: |
  This skill should be used when the user asks to "clear Symfony cache", "run bin/console commands", "run doctrine migrations", "debug Symfony routes", "run Symfony CLI", "govard symfony", or "symfony cache:clear". Provides Symfony-specific Govard shortcuts. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: symfony
---

# Govard Symfony Commands

Symfony-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Symfony-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

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

Govard's `stack.php_version` (default `8.2` for the Symfony 7 skeleton; Symfony 8 requires `8.4`) determines the PHP runtime; `govard config get stack.php_version` shows the active version. Verified 2026-08-28 on fresh `symfony/skeleton` `7.4.17` (`govard-test-symfony`, PHP 8.2.33, MariaDB 10.11) — bootstrap warns `Cannot use symfony/skeleton v8.1.99 as it requires php >=8.4`.

## Routing & Debug

```bash
# List all routes
govard tool symfony debug:router

# Single route
govard tool symfony debug:router app_home

# Container services
govard tool symfony debug:container
govard tool symfony debug:container --parameters

# Environment info
govard tool symfony debug:config framework
```

## Doctrine ORM

> Prerequisite: the fresh `symfony/skeleton` ships without Doctrine. Install first: `govard tool composer require symfony/orm-pack`

```bash
# Migrations — always dry-run first on a fresh DB
govard tool symfony doctrine:migrations:migrate --dry-run
govard tool symfony doctrine:migrations:migrate --no-interaction

# Migration status
govard tool symfony doctrine:migrations:status

# Create migration from entity diff
govard tool symfony doctrine:migrations:diff

# Schema validation
govard tool symfony doctrine:schema:validate

# Fixtures (dev only)
govard tool symfony doctrine:fixtures:load --append

# Direct SQL via Govard DB layer (respects table_prefix if set)
govard db query "SELECT * FROM migration_versions LIMIT 5"
```

On a fresh Govard Symfony install the DB is empty — `migrate --dry-run` is safe after `symfony/orm-pack`; real migrate requires `govard env up` and a reachable `DATABASE_URL`. Verified 2026-08-28: fresh skeleton without `orm-pack` returns `There are no commands defined in the "doctrine:migrations" namespace`.

## Assets

```bash
# Install bundle assets
govard tool symfony assets:install

# Webpack Encore (if used)
govard tool npm install
govard tool npm run dev
govard tool npm run build

# Clear Encore cache
rm -rf node_modules/.vite
```

Symfony has no Govard `frontend_sync` watcher (unlike Hyvä/Luma). Use `govard tool npm run watch` for live builds.

## Environment (.env)

Govard injects `DATABASE_URL`, `MAILER_DSN`, and `APP_ENV` via `.env.local` (Symfony dotenv, not container env). Check current values:

```bash
govard config get stack.php_version
govard config get stack.db_version
cat .env.local
# or inside container
govard tool symfony debug:container --env-vars | grep -E 'APP_ENV|DATABASE_URL|MAILER_DSN'
```

- `APP_ENV` defaults to `dev` locally; Govard does not overwrite a committed `.env`.
- `DATABASE_URL` is auto-wired to the Govard MariaDB service (`mariadb 11.4` default). Override via `.govard.yml` `stack.db_version` or `GOVARD_ENV` layer if needed.
- `MAILER_DSN` points to Mailpit (`mail:1025`) — see `govard open mail` (`https://mail.govard.test`).

For env-specific overrides use `GOVARD_ENV=staging govard env up` (loads `.govard.staging.yml`).

## Audit (Lint)

```bash
# Govard-native lint (provider declared but resolver currently unsupported for Symfony)
govard audit run --checks lint
govard audit run --checks lint --format json
```

`audit.lint.provider: govard` is generated in `.govard.yml` but `govard audit run` currently returns `no framework can resolve audit target` for Symfony (verified 2026-08-28 — bootstrap warns `Auto configuration is not supported for framework "symfony" yet`). Use `govard tool php vendor/bin/phpstan` / `vendor/bin/phpcs` directly until Govard audit adds Symfony support.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool symfony doctrine:migrations:migrate --no-interaction
govard tool symfony cache:clear
```

### Debugging Routes

```bash
govard tool symfony debug:router | grep api
govard tool symfony debug:router app_blog_show --show-controllers
```
