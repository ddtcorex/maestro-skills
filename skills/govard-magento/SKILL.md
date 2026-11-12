---
name: govard-magento
description: Use when clearing Magento or redis cache, running bin/magento, deploying static content, setup:di:compile, reindexing, or frontend live reload. Keywords clear Magento cache, run bin/magento commands, govard frontend.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: magento
---

# Govard Magento Commands

## When to use

Load this skill for Magento shortcuts on a Govard project; it is DEPENDENT on govard-toolbox for the base commands.

- "clear Magento cache", "flush redis cache", "run Magento CLI", "run bin/magento commands"
- "deploy static content", "setup:di:compile", "reindex catalog", "run indexer commands", "enable/disable modules"
- "start frontend sync", "run browser-sync", "set up live reload for Hyva/Luma", "govard frontend"

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

- The **profiler** check refuses to run while Xdebug is enabled, because it measures timing; `lint` and `integrity` run anyway. Pass `--allow-xdebug` to accept the overhead, or turn Xdebug off with `govard debug off`. (The error text suggests `govard config set stack.features.xdebug false`, but `config set` rejects that key.)
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

Read [references/FRONTEND.md](references/FRONTEND.md) when starting, stopping or debugging `govard frontend`, or when live reload is silently off.

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

Read [references/WORKFLOWS.md](references/WORKFLOWS.md) when running a routine sequence (after a pull, after a database sync, a production deploy prep) and you want the exact command order.
