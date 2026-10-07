---
name: govard-magento
description: |
  This skill should be used when the user asks to "clear Magento cache", "flush redis cache",
  "run Magento CLI", "run bin/magento commands", "deploy static content", "setup:di:compile",
  "reindex catalog", "run indexer commands", "enable/disable modules", "start frontend sync",
  "run browser-sync", "set up live reload for Hyva/Luma", or "govard frontend". Provides
  Magento-specific Govard shortcuts and commands. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: magento
---

# Govard Magento Commands

Magento-specific shortcuts and commands for Govard environments. Run `govard <cmd> --help` for the current flag set and `govard capabilities` for what the installed binary supports.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first. This skill only covers Magento-specific shortcuts layered on top of Govard's base environment commands.

Stack commands need Docker running. `govard audit run --checks integrity` is the container-free exception (see `govard-toolbox`, "Host Without Docker").

This skill covers only container/CLI shortcuts. For module architecture, DI, and security patterns, see `magento2-dev-core` and `magento2-backend-dev`; for code quality and performance checks, see `magento2-linter`, `magento2-security-scan`, and `magento2-performance-audit`.

## Code Quality Audit

`govard audit run --checks lint` is the native, persistent lint gate for this project. Target-mode resolution, the PHP matrix, provider rules, and caching/rerun identity are covered in `magento2-linter` ("Govard-Native Lint Audit Is the Real Gate"); this skill does not duplicate that policy. To re-check the exact same session (for example after a fix) instead of starting a fresh, non-comparable run:

```bash
govard audit rerun --session SESSION_ID
```

Optionally capture a page-profile artifact in the same run:

```bash
govard audit run --checks lint,profiler --url 'https://<domain>/'
```

The profiler reads the CSV Magento writes to `var/log/profiler.csv`. If the run fails with "collect Magento profiler CSV ... No such file", Magento never wrote the file for that request, so the capture is unusable; try another uncached HTML URL. Policy details live in `magento2-linter`.

Gotchas:

- An audit refuses to run while Xdebug is enabled, to protect timing fidelity. Pass `--allow-xdebug` to accept the overhead, or turn Xdebug off with `govard debug off`. (The error text suggests `govard config set stack.features.xdebug false`, but `config set` rejects that key.)
- `audit rerun` reuses the session's stored checks. Passing a different `--checks` set than the session recorded can fail with "no persisted ... settings"; start a new `audit run` instead.

## Unit Tests

Magento's project root ships no `phpunit.xml`, so a bare `vendor/bin/phpunit` there prints usage and exits 1. That exit means "no configuration found", never "tests failed". The unit-suite configuration lives at `dev/tests/unit/phpunit.xml.dist`; always pass it explicitly with `-c` and scope the run with `--filter` (module or class name) so unrelated core suites never execute:

```bash
govard sh -c 'vendor/bin/phpunit -c dev/tests/unit/phpunit.xml.dist --filter "MyModuleBatchLoader|ExampleTest"'
```

For a direct path run (single module, no filter syntax), pair `--no-coverage` with the unit bootstrap:

```bash
govard sh -c 'vendor/bin/phpunit --no-coverage --bootstrap dev/tests/unit/framework/bootstrap.php app/code/Acme/Label/Test/Unit'
```

Never run the full suite bare inside review or automated checks: Magento core fixtures can conflict when loaded together and kill the run for reasons unrelated to the change under review. A healthy scoped run reports `OK` with its test/assertion counts (PHPUnit warnings about duplicate suite files are noise from Magento's own config). Treat a `Fatal error` naming a `vendor/` `_files` fixture as a pre-existing repo condition, not a regression. When piping output through `tail`, capture the real status via `${PIPESTATUS[0]}` (or `set -o pipefail`); a trailing `echo "EXIT:$?"` after a pipe reports `tail`'s status and masks PHPUnit failures as passes.

## Magento CLI

`govard tool magento <args>` runs `bin/magento` in the PHP container. Run `govard tool magento list` to see what the installed Magento provides, and do not assume a command exists (for example there is no `generate:*` namespace and no `dev:js:*` / `dev:css:*` namespace in stock Magento).

```bash
# Cache management
govard tool magento cache:flush
govard tool magento cache:clean full_page      # takes cache TYPES (see cache:status), not cache tags
govard tool magento cache:enable layout block_html
govard tool magento cache:disable config

# Module management (module:disable fails if enabled modules depend on it)
govard tool magento module:enable Vendor_Module
govard tool magento module:disable Vendor_Module
govard tool magento module:status

# Setup commands
govard tool magento setup:di:compile
govard tool magento setup:static-content:deploy -f
govard tool magento setup:upgrade --keep-generated
govard tool magento setup:db:status

# Deploy mode
govard tool magento deploy:mode:set developer
govard tool magento deploy:mode:show

# Admin user
govard tool magento admin:user:create
```

## Indexer Commands

```bash
govard tool magento indexer:status
govard tool magento indexer:reindex                       # all
govard tool magento indexer:reindex catalog_product_price # one (dependent indexers may rebuild too)
govard tool magento indexer:set-mode schedule             # or realtime
```

## Cron Commands

```bash
govard tool magento cron:run
govard tool magento cron:run --group=default
govard tool magento cron:install   # writes the container user's crontab
govard tool magento cron:remove
```

## Development Tools

```bash
govard tool magento dev:template-hints:enable    # dev only; also :disable / :status
govard tool magento dev:query-log:enable         # also :disable
```

## Frontend Development (BrowserSync / LiveReload)

Requires `stack.features.frontend_sync: true` in `.govard.yml` (Magento family only). Without it, `govard frontend ...` exits with "frontend sync is disabled". `govard env up` never starts this; it is a separate, explicit, on-demand lifecycle:

```bash
govard env up                    # app/db/etc. up, no frontend services yet
govard frontend start            # renders + starts BrowserSync/LiveReload + watchers
govard frontend logs -f          # sync/injector container
govard frontend logs watch-<theme> -f
govard frontend stop             # removes only frontend services, keeps their volumes
```

**Prerequisites (Govard never creates or edits these files):**

Let `govard frontend start` be the discovery oracle: it validates the setup and fails fast with the reason. Only read theme files to fix a specific failure; do not pre-verify by hand.

- **Hyva:** exactly one `scripts.browser-sync` owner under `app/design/frontend/<Vendor>/<Theme>/web/tailwind`, with a committed `package-lock.json`. The theme's `browser-sync.config.js` must read `GOVARD_FRONTEND_SYNC_TARGET` (and port) from the environment instead of hard-coding a host.
- **Luma:** root `Gruntfile.js`, `package.json`, `package-lock.json` (copy Magento's `.sample` files, then `govard tool npm install`). No BrowserSync config needed.
- Hyva and Luma discovery are exclusive: start fails unless exactly one setup is valid.

**Switching the active Hyva theme:** move the `scripts.browser-sync` entry (plus its `browser-sync.config.js` and `package-lock.json`) from the old theme's `web/tailwind/package.json` to the new theme, then run `govard frontend start` again.

| Symptom | Fix |
|---|---|
| `frontend start` reports success but the page redirects to a different host or drops the session | The theme's `browser-sync.config.js` proxy settings rewrite the origin or cookie domain; keep both unchanged |
| Discovery fails ("requires either exactly one Hyva ... or root Gruntfile.js and package.json") | Confirm exactly one theme owns `scripts.browser-sync`, or that the Luma root files exist, and not both |
| `frontend start` fails with "container ... health is unhealthy" | Read `govard frontend logs`; the sync container could not serve the project (for example Luma themes not yet compiled) |

## Database Operations

```bash
# Direct MySQL shell
govard db connect

# Run SQL. Table names here have no prefix; if this project uses one (db.table_prefix in
# app/etc/env.php), prepend it, e.g. m2_core_config_data instead of core_config_data
govard db query "SELECT * FROM core_config_data WHERE path LIKE '%template%'"

# Import a local dump with a clean reset (drops and recreates the database)
govard db import --file backup.sql --drop

# Stream a remote dump straight into the local database
govard db import --stream-db -e staging --drop

# Export from remote into the local var/ directory, excluding noise and PII tables
govard db dump -e staging --no-noise --no-pii --local
```

A failed remote dump can leave a tiny stub file in `var/`; delete it before retrying.

## Configuration

```bash
govard tool magento config:show system/smtp/host
govard tool magento config:set web/secure/base_url https://local.test/

# Show a value in every scope it is set (default/website/store) in one call;
# bin/magento config:show only reads a single scope at a time
govard tool magerun config:store:get web/secure/base_url

govard tool magento app:config:status
```

**Do not run `app:config:dump` on a Govard project casually.** It writes the dumped paths into `app/etc/config.php` and locks them. Afterwards `govard config auto` fails with "The value you set has already been locked" when it tries to set the same paths (for example Varnish or search settings). Dump only if the project really manages config through files, and use `app:config:import` to apply it.

## Diagnostics

```bash
# Environment health check: base URL and cookie domain settings, required
# PHP extensions, MySQL InnoDB, missing files/folders
govard tool magerun sys:check

# System snapshot: Magento version/edition, app mode, cache backend,
# search engine, module count
govard tool magerun sys:info
```

## Multi-Website / Multi-Store Setup

Register additional store domains in `.govard.yml` under `store_domains`, then let Govard wire up the vhost/DNS side:

```yaml
domain: "primary.test"
store_domains:
  brand-b.test:
    code: base
    type: website
```

```bash
govard domain add brand-b.test   # records an extra domain in .govard.yml
govard env up                    # applies it
govard config auto
govard tool magento cache:flush
```

Store codes are also selectable via URL path (`/fr/`, `/admin/`) without a separate domain; reserve `store_domains` for genuinely separate hostnames/websites.

## Redis Cache

```bash
govard redis flush   # flush all keys
govard redis cli
govard redis info
```

`govard valkey` is the equivalent when the cache service is Valkey.

## Varnish (only when `stack.features.varnish: true`)

```bash
govard varnish ban '/.*'   # purge everything (quote the pattern)
govard varnish stats
govard varnish ps
```

Without the feature, these fail with "no such service: varnish" or "Varnish container ... is unknown". For tag-based invalidation use Magento's own cache flow (`cache:clean full_page` / `cache:flush`).

## Logging

For agents, prefer bounded tail reads (no `-f` follow, it never returns):

```bash
govard sh -c "tail -n 50 var/log/system.log"
govard sh -c "tail -n 50 var/log/exception.log"
govard sh -c "tail -n 50 var/log/debug.log"
```

## Common Issues & Solutions

| Symptom | Fix |
|---|---|
| "There are no commands defined" after pulling code | `govard tool magento setup:di:compile` |
| Static assets not updating | `govard tool magento setup:static-content:deploy -f` + `cache:flush`, then hard-refresh the browser |
| Database connection refused | `govard ps` (is the DB container up?), `govard logs db`, then `govard down && govard up` if needed |
| Container won't start | `govard doctor`, then `govard logs` |
| Storefront 5xx and `exception.log` shows `NoNodesAvailableException` | The search service is still starting or down; `govard ps`, then `govard elasticsearch _cluster/health` (or `govard opensearch ...`) |
| `govard config auto` fails with "value ... already been locked" | `app/etc/config.php` locks that path (see `app:config:dump` above); remove it from the file or use Magento's `--lock-env` flow |
| Xdebug not connecting | `govard debug on`, confirm the IDE is listening on port 9003; see `govard-toolbox` for the IDE setup |

Template-only changes do not need `setup:di:compile`, only `setup:static-content:deploy`.

## Common Workflows

### After Pulling Code

```bash
govard tool magento setup:upgrade --keep-generated
govard tool magento setup:static-content:deploy -f
govard tool magento cache:flush
```

### After Database Sync

```bash
govard config auto   # re-applies local DB, search, Redis, Varnish, base URLs and developer mode
govard tool magento cache:flush
```

### Production Deployment Prep

```bash
govard tool magento maintenance:enable
govard tool magento setup:upgrade
govard tool magento setup:di:compile
govard tool magento setup:static-content:deploy -f --theme=Vendor/Theme
govard tool magento cache:flush
govard tool magento maintenance:disable
```

### Govard Deploy (conditional migrate)

`govard deploy <remote>` probes `setup:db:status` before the downtime block: exit 0 skips maintenance/workers/config-import/migrate, 1-2 runs them. `govard deploy plan <remote>` prints the resolved task list without executing anything (it needs a configured branch or `--branch`; the synthetic `sandbox` remote resolves the current branch by itself). See `govard-toolbox` (Deployment) for the full gate, verdict, and resume semantics.

Rehearsing it against `govard sandbox` (confirmed live on a real Magento project):

- **Seed needs an installed origin.** `sandbox up` dumps the running origin database and rewrites `core_config_data` base URLs. An origin with an empty database (no `bin/magento setup:install` yet) fails the seed with "Table ... core_config_data doesn't exist". Install the origin first.
- **Database profile.** `--profile full` follows `stack.db_version`. A MariaDB series that ships no `mysqladmin` binary (the newest series) never answers the readiness probe, so `up` fails with exit 127 on `mysqladmin ping`. Pass `--db mariadb:<older series>` for the rehearsal; a database volume written by another series is refused until `sandbox down --purge`.
- **Track source only.** The sandbox mirrors the git repository, so ignore `pub/static/*`, `generated/*`, `var/*`, `pub/media/*` and `app/etc/env.php`. A checkout that tracks built `pub/static` (dangling symlinks into the origin path) makes `build:assets` fail with "cannot be copied" warnings.
- **Shared files.** `app/etc/env.php` and `pub/media` are shared and come from the seed, not from git. `sandbox reset` removes them: afterwards `build:assets` fails with "The default website isn't defined" until `sandbox up --reseed` restores `env.php`.
- **Migrate step.** With an up-to-date schema the maintenance, worker-pause, config-import and migrate tasks are reported as skipped ("db up-to-date"). A pending schema change (for example a new module with `db_schema.xml`) runs maintenance, `setup:upgrade` (it completed on the sandbox without a search service), then maintenance off before the symlink swap. A failure after maintenance is enabled keeps the lock, the release directory and the maintenance flag: the live site answers 503 until `deploy --resume` completes or `deploy rollback` is run. `deploy unlock` alone does not clear maintenance, and refuses a young lock without `--force`.
- **`--db-backup`.** The task runs `bin/magento setup:backup --db`, which stock Magento refuses with "Backup functionality is disabled". The deploy stops at `db:backup` (even when no migration is needed) and exits 1, keeping the release and lock. Enable it with `config:set system/backup/functionality_enabled 1` on the target, then `deploy --resume --db-backup` (the flag is not remembered across `--resume`, repeat it). `deploy rollback --with-db` restores the dump recorded by the release being replaced.
- **Pulling files.** `sync -s <remote> --file --path app/etc` copies `env.php` as the symlink it is on a symlink-layout target, leaving the local file pointing at the remote shared path. Restore the local `env.php` afterwards, or avoid syncing `app/etc`.
- **Doc roots.** `remote exec <remote> -- <cmd>` fails with "cd: ... No such file or directory" until the first release is live on a `symlink` sandbox. `sandbox ssh` takes no command; use `remote exec` after the first deploy.
- **Open targets.** `govard open admin|sftp -e sandbox` is refused ("unknown remote environment"): the synthetic remote is not resolved by `open`. Use the printed sandbox URL and `ssh` line from `sandbox status`.
- **Local audits.** `audit run` refuses while `stack.features.xdebug` is on unless `--allow-xdebug` is passed; the lint rows report real findings when core code is tracked in the checkout.
