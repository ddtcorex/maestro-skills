---
name: govard-laravel
description: Use when running Laravel artisan, migrations, queue or schedule commands, clearing cache, running Pint, or deploying a Laravel project. Keywords run artisan commands, config:cache, deploy Laravel.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: laravel
---

# Govard Laravel Commands

## When to use

Load this skill for Laravel shortcuts on a Govard project; it is DEPENDENT on govard-toolbox for the base commands.

- "run migrations", "run artisan commands", "clear Laravel cache", "config:cache"
- "run queue operations", "schedule:run", "tinker into app", "artisan tinker"
- "run Laravel Pint", "lint Laravel project", "audit Laravel", "govard audit"
- "npm dev/prod", "deploy Laravel", "govard deploy"

Laravel-specific shortcuts for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first. This skill only covers Laravel-specific shortcuts layered on top of Govard's base commands (`govard env up`, `govard sh`, `govard db`).

**Docker requirement:** stack commands here need Docker; without it they exit `3` `CAPABILITY_MISSING`. `govard deploy` needs only ssh and rsync. `govard audit run --checks integrity` is **not** available for Laravel (it exits 1: `framework "laravel" does not support integrity audit`), so the container-free audit path in `govard-toolbox` does not apply here.

For generic PHP (strict_types/PSR-12/PHPStan/Security) see `php-dev-core`.

## Artisan Commands

`govard tool artisan` runs Laravel's `artisan` inside the PHP container, from the project root, with no shell session. The exit code is artisan's own. Run `govard tool artisan list` for what the installed Laravel offers; `govard tool --help` lists the other wrapped tools (`composer`, `php`, `npm`, `npx`, `pnpm`, `yarn`).

```bash
# Cache management
govard tool artisan config:cache
govard tool artisan config:clear
govard tool artisan cache:clear
govard tool artisan route:cache
govard tool artisan route:clear
govard tool artisan view:cache
govard tool artisan view:clear
govard tool artisan optimize:clear
```

`artisan` commands that belong to optional packages (for example `log:clear`, Horizon, Pail) exist only when that package is installed; check with `artisan list` before relying on them.

## Audit

`govard audit run --checks lint --lint-provider govard --mode project --format json` runs the lint audit (PHPCS PSR-12, PHPCompatibility, PHPStan). For the cross-framework matrix and flags see `govard-toolbox` ## Audit. A stock Laravel skeleton reports real findings (PSR-12 style, PHPStan), so a non-zero exit on a fresh project is normal; judge the findings, not the exit code alone.

With `stack.features.xdebug: true` the audit refuses to start and says so; pass `--allow-xdebug` or set the feature to `false`. `--scope diff --base <ref>` needs a ref that exists locally (a repository with no `origin/master` silently audits the whole project instead).

`bootstrap/cache/*` and `storage/*` are always ignored by the lint audit, so generated caches and compiled views never show up as findings. Remaining findings are project files (`config/`, `app/`, `tests/`, `routes/`).

## Database

```bash
govard tool artisan migrate
govard tool artisan migrate:status
govard tool artisan migrate:rollback
govard tool artisan db:seed
govard tool artisan db:seed --class=UserSeeder
govard tool artisan migrate:fresh      # drops ALL tables
govard tool artisan migrate:refresh    # rolls back everything, then migrates
```

Add `--force` when running non-interactively with `APP_ENV=production`. `migrate:fresh` and `migrate:refresh` destroy data: on anything but a throwaway database take `govard snapshot create <name>` first.

Direct SQL and dumps use Govard's own DB commands (see `govard-toolbox` ## Database):

```bash
govard db connect                      # interactive client, needs a TTY
govard db query "select version()"
govard db info
govard db dump                         # writes to var/
```

**Which database does artisan use?** Govard runs MariaDB reachable inside the stack as host `db`, user `laravel`, database `laravel`, but `govard env up` does **not** edit `.env`. A freshly scaffolded Laravel `.env` says `DB_CONNECTION=sqlite`, and then `artisan migrate` writes to the sqlite file and ignores the Govard database. To use it, set `DB_CONNECTION=mariadb` (or `mysql`), `DB_HOST=db`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` in `.env` yourself (the user and database are shown by `govard db info`). Only `govard bootstrap` rewrites `.env` values (`APP_ENV`, `APP_DEBUG`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, and runs `key:generate`).

Check the PHP series the project runs before a fresh migration, since the framework's own minimum can be higher than the project's setting:

```bash
govard config get stack.php_version
```

If `composer install` or an artisan command reports a PHP constraint, raise `stack.php_version` (`govard config set stack.php_version <x.y>`) and re-run `govard env up`.

## Queue and Cache Services

There is no queue supervisor container. Run a worker in the foreground, or bounded:

```bash
govard tool artisan queue:work
govard tool artisan queue:work --stop-when-empty
govard tool artisan queue:retry all
govard tool artisan queue:failed
govard tool artisan queue:flush        # deletes all failed jobs
```

Redis is opt-in: set `stack.services.cache: redis` (or `valkey`) in `.govard.yml`, then `govard env up`. Until then `govard redis ...` fails with `Redis container <project>-redis-1 is unknown`. Once enabled: `govard redis cli ping`, `govard redis info`, `govard redis flush`. Point `.env` at it (`REDIS_HOST=redis`, `CACHE_STORE=redis` / `QUEUE_CONNECTION=redis`) yourself.

## Scheduler

```bash
govard tool artisan schedule:run       # one tick; wire a real cron around it if needed
govard tool artisan schedule:list
```

## Development

```bash
govard tool artisan make:model Post -mcr   # model + migration + resource controller
govard tool artisan make:command MyCommand
govard tool artisan make:controller MyController
govard tool artisan make:migration create_posts_table
govard tool artisan make:factory PostFactory
govard tool artisan route:list
govard tool artisan route:list --path=api
govard tool artisan tinker                 # REPL, needs a TTY
govard tool artisan tinker --execute='echo 1+1;'   # non-interactive
```

## Testing

```bash
govard test                                # default suite (artisan test)
govard test phpunit
govard tool artisan test
govard tool php vendor/bin/phpunit --filter=UserTest
```

## Frontend Assets

```bash
govard tool npm install
govard tool npm run build
govard tool npm run dev
```

Use the script names from the project's own `package.json`: current Laravel starter kits ship only `build` and `dev` (Vite), while older Mix projects use `development`/`production`/`watch`. Running a missing script exits 1 with `Missing script`. `npm run dev` is long-running and was not exercised here. Laravel has no Govard `frontend_sync` watcher (that is for Magento themes), and `govard frontend start` exits 1 with `frontend sync is disabled` unless `stack.features.frontend_sync` is set.

## Environment (.env)

Govard does not generate or rewrite `.env` on `govard env up`; it reads whatever is committed. Inspect:

```bash
govard config get stack.php_version
grep -E 'APP_ENV|DB_' .env
govard tool artisan env
```

If `.env` is missing, `govard bootstrap` copies `.env.example`, switches `APP_ENV=production` to `local`, and runs `key:generate`. Otherwise run `cp .env.example .env && govard tool artisan key:generate` yourself.

## Logging

```bash
tail -f storage/logs/laravel.log
govard logs                            # container logs (php, web, db)
```

## Deployment

`govard deploy production` changes a live site: state the remote, the exact command and the
way back, then wait for an explicit yes before running it. `govard deploy plan` is the source of
truth for the pipeline, and `govard deploy check` is the preflight.

Read [references/DEPLOYMENT.md](references/DEPLOYMENT.md) when planning, checking, rehearsing or running a deploy, or when a deploy exits `4`.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool artisan migrate
govard tool artisan cache:clear
govard tool npm install && govard tool npm run build
```

### Creating Features

```bash
govard tool artisan make:model Post -mcr
govard tool artisan migrate
govard tool artisan route:list
```

### Deployment Prep (local rehearsal)

```bash
govard tool artisan config:cache && govard tool artisan route:cache && govard tool artisan view:cache
govard tool npm run build
govard tool artisan optimize:clear     # undo the caches locally afterwards
```

A cached config (`bootstrap/cache/config.php`) makes the process environment stop overriding `.env`, so clear the caches before debugging local configuration. For a real deploy use `govard deploy`, which builds the caches on the target.
