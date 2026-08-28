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

Magento-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Magento-specific shortcuts layered on top of Govard's base environment commands.

This skill covers only container/CLI shortcuts. For module architecture, DI, and security patterns, see `magento2-dev-core` and `magento2-backend-dev`; for code quality and performance checks, see `magento2-linter`, `magento2-security-scan`, and `magento2-performance-audit`.

## Code Quality Audit

`govard audit run --checks lint` is the native, persistent lint gate for this
project — target-mode resolution, the PHP matrix, provider rules, and
caching/rerun identity are all covered in `magento2-linter`'s
"Govard-Native Lint Audit Is the Real Gate" section; this skill doesn't
duplicate that policy. To re-check the exact same session (e.g. after a
fix) instead of starting a fresh, non-comparable run:

```bash
govard audit rerun --session SESSION_ID
```

To also capture a page-profile artifact in the same run (Govard v1.64.0+):

```bash
govard audit run --checks lint,profiler --url 'https://<domain>/'
```

The profiler CSV lands under the run's `artifacts/profiler/` with its SHA-256 recorded in the
result — open it in a spreadsheet to read per-timer costs. Policy details live in
`magento2-linter`.

## Magento CLI

```bash
# Cache management
govard tool magento cache:flush
govard tool magento cache:clean full_page

# Specific cache types
govard tool magento cache:enable layout block_html
govard tool magento cache:disable config

# Module management
govard tool magento module:enable Vendor_Module
govard tool magento module:disable Vendor_Module
govard tool magento module:status

# Setup commands
govard tool magento setup:di:compile
govard tool magento setup:static-content:deploy -f
govard tool magento setup:upgrade --keep-generated

# Deploy mode
govard tool magento deploy:mode:set developer
govard tool magento deploy:mode:set production
govard tool magento deploy:mode:show
```

## Code Generation

```bash
# Generate plugin
govard tool magento generate:plugin Vendor Module

# Generate observer
govard tool magento generate:observer Vendor Module Event

# Create admin grid
govard tool magento admin:user:create
```

## Indexer Commands

```bash
# Check status
govard tool magento indexer:status

# Reindex all
govard tool magento indexer:reindex

# Single indexer
govard tool magento indexer:reindex catalog_product_price

# Change mode
govard tool magento indexer:set-mode schedule
govard tool magento indexer:set-mode realtime
```

## Cron Commands

```bash
# Run cron manually
govard tool magento cron:run
govard tool magento cron:run --group=default

# Install crontab
govard tool magento cron:install

# Remove crontab
govard tool magento cron:remove
```

## Development Tools

```bash
# Template hints (dev only)
govard tool magento dev:template-hints:enable
govard tool magento dev:template-hints:disable

# Query logging
govard tool magento dev:query-log:enable
govard tool magento dev:query-log:disable

# JS/CSS bundling
govard tool magento dev:js:enable_js_bundling
govard tool magento dev:css:minify_files
```

## Frontend Development (BrowserSync / LiveReload)

Requires `stack.features.frontend_sync: true` in `.govard.yml` (Magento 2 / Mage-OS only). `govard env up` never starts this — it's a separate, explicit, on-demand lifecycle:

```bash
govard env up                    # app/db/etc. up — no frontend services yet
govard frontend start            # renders + starts BrowserSync/LiveReload + watchers
govard frontend logs -f          # sync/injector container
govard frontend logs watch-<theme> -f
govard frontend stop             # removes only frontend services, keeps their volumes
```

**Prerequisites (Govard never creates or edits these files):**

Let `govard frontend start` be the discovery oracle — it validates all of the below and fails
fast with the exact reason. Only read theme files to fix a specific failure ("no owner found" /
conflicting setups); don't pre-verify by hand.

- **Hyva:** exactly one `scripts.browser-sync` owner under `app/design/frontend/<Vendor>/<Theme>/web/tailwind`, with a committed `package-lock.json`. The theme's own `browser-sync.config.js` must read `GOVARD_FRONTEND_SYNC_TARGET`/`_PORT` from the environment and set `changeOrigin: false`, `cookies.stripDomain: false`, `open: false`, and `socket.path: '/browser-sync/socket.io'`.
- **Luma:** root `Gruntfile.js`, `package.json`, `package-lock.json` (copy Magento's `.sample` files, then `npm install`). No BrowserSync config needed.
- Hyva and Luma discovery are mutually exclusive project-wide — only one setup may be valid at a time.

**Switching the active Hyva theme:** move the `scripts.browser-sync` entry (plus its `browser-sync.config.js` and `package-lock.json`) from the old theme's `web/tailwind/package.json` to the new theme, then run `govard frontend start` again — it re-discovers whichever theme is now the sole owner.

| Symptom | Fix |
|---|---|
| `frontend start` reports success but the page redirects to a different host or drops the session | Theme's `browser-sync.config.js` has `changeOrigin`/`cookies.stripDomain` wrong — both must be `false` |
| Discovery fails ("no owner found" / conflicting setups) | Confirm exactly one theme owns `scripts.browser-sync`, and that Hyva and Luma prerequisites aren't both satisfied at once |

## Database Operations

```bash
# Direct MySQL
govard db connect

# Run SQL -- table names here have no prefix; if this project uses one (db.table_prefix in
# app/etc/env.php), prepend it, e.g. `m2_core_config_data` instead of `core_config_data`
govard db query "SELECT * FROM core_config_data WHERE path LIKE '%template%'

# Import with streaming (fast)
govard db import --stream-db -e staging --drop

# Export from remote
govard db dump -e staging --no-noise --no-pii --local
```

## Configuration

```bash
# Show config
govard tool magento config:show system/smtp/host

# Set config
govard tool magento config:set web/secure/base_url https://local.test/
govard tool magento config:set design/theme/theme_id 0

# Import/export config
govard tool magento app:config:dump
govard tool magento app:config:import

# Show a config value in every scope it's set (default/website/store) in one
# call -- bin/magento config:show only reads a single scope at a time
govard tool magerun config:store:get web/secure/base_url
```

## Diagnostics

```bash
# Environment health check -- missing files/folders, base URL & cookie
# domain settings, required PHP extensions, MySQL InnoDB
govard tool magerun sys:check

# System snapshot (Magento version/edition, app mode, cache backend,
# search engine, module count)
govard tool magerun sys:info
```

## Multi-Website / Multi-Store Setup

Register additional store domains in `.govard.yml` under `store_domains`, then let Govard wire up the vhost/DNS side:

```yaml
domain: "primary.test
store_domains:
  brand-b.test:
    code: base
    type: website
```

```bash
govard domain add brand-b.test
govard config auto
govard tool magento cache:flush
```

Store codes are also selectable via URL path (`/fr/`, `/admin/`) without a separate domain — reserve `store_domains` for genuinely separate hostnames/websites.

## Redis Cache

```bash
# Flush Redis cache only
govard redis flush

# Redis CLI
govard redis cli

# Check cache info
govard redis info
```

## Varnish (if configured)

```bash
# Purge all
govard varnish purge

# Purge by tag
govard tool magento cache:clean cache_tag_frontend

# Varnish status
govard varnish status
```

## Testing

Magento testing through Govard — verified 2026-08-28 via `internal/cmd/test_project.go` + `internal/frameworks/magento2/magento2.go` (govard v1.65.0). Every snippet uses host-side `govard test` dispatch (no `govard sh -c "govard"` nesting).

### Unit Tests

```bash
# Default suite (PHPUnit, memory_limit=-1)
govard test unit
govard test phpunit -- --filter Vendor_ModuleTest --stop-on-failure

# Direct PHPUnit for fine-grained control
govard tool magento --help  # verify binary path
govard tool php -d memory_limit=-1 vendor/bin/phpunit --testsuite unit --filter MyFilter
```

`govard test unit` runs `php -d memory_limit=-1 vendor/bin/phpunit` inside the PHP container (`govard-test-wordpress`/`symfony` envs confirm memory wrapper).

### Integration Tests

Requires `dev/tests/integration/etc/install-config-mysql.php` (copy from `.dist`) and a dedicated test DB:

```bash
# Prepare (once)
cp dev/tests/integration/etc/install-config-mysql.php.dist dev/tests/integration/etc/install-config-mysql.php
# edit DB credentials to match Govard DB (govard db info → wordpress/magento / db:3306)
govard db query "CREATE DATABASE magento_integration_tests"

# Run — Govard maps to php -c dev/tests/integration/phpunit.xml vendor/bin/phpunit
govard test integration
govard test integration -- --filter CatalogProductTest --stop-on-failure

# Verbose via direct binary
govard tool php -c dev/tests/integration/phpunit.xml -d memory_limit=-1 vendor/bin/phpunit --filter MyTest
```

`govard test integration` resolves via `frameworkTestCommand("magento2","integration")` → `php -c dev/tests/integration/phpunit.xml vendor/bin/phpunit` (`magento2.go:58`). Without `install-config-mysql.php` it exits explaining the missing file — not a Govard bug.

### MFTF (Magento Functional Testing Framework)

```bash
# Generate and run acceptance tests
govard tool php vendor/bin/mftf generate:tests
govard test mftf -- --verbose
# Direct
govard tool php vendor/bin/codecept run -- --steps
```

Requires `dev/tests/acceptance` suite and Selenium/Chrome container (not part of default Govard stack — document as opt-in).

### Static / Coverage Helpers

- Static analysis is via `govard audit run --checks lint` (PHPCS + PHPStan), not `govard test phpstan` — see `magento2-linter` for provider matrix. `govard test phpstan` runs `vendor/bin/phpstan analyze app src` directly if needed.
- Coverage (requires Xdebug — `govard debug on`):
  ```bash
  govard tool php -d xdebug.mode=coverage vendor/bin/phpunit --coverage-html var/coverage
  ```

Prerequisites: `vendor/bin/phpunit` must exist (`composer install`); integration/MFTF need DB/Selenium. `govard test --help` lists `phpunit|phpstan|mftf|unit|integration`; unknown suite returns `unknown test suite: <name>`.

## Logging

For agents, prefer bounded tail reads (no `-f` follow — it never returns):

```bash
govard sh -c "tail -n 50 var/log/system.log"
govard sh -c "tail -n 50 var/log/exception.log"
govard sh -c "tail -n 50 var/log/debug.log"
govard sh -c "tail -n 50 var/log/my-module.log"
```

## Common Issues & Solutions

| Symptom | Fix |
|---|---|
| "There are no commands defined" after pulling code | `govard tool magento setup:di:compile"` |
| Static assets not updating | `govard tool magento setup:static-content:deploy -f"` + `cache:flush`, then hard-refresh the browser |
| Database connection refused | `govard ps` (is the DB container up?), `govard logs db`, then `govard down && govard up` if needed |
| Container won't start | `govard doctor`, then `govard logs` |
| Xdebug not connecting | `govard debug on`, confirm the IDE is listening on port 9003, check the `XDEBUG_SESSION` cookie matches `.govard.yml` — see `govard-toolbox` for the full IDE setup |

Template-only changes don't need `setup:di:compile` — only `setup:static-content:deploy`. Recompiling DI on every template edit wastes time for no benefit.

## Common Workflows

### After Pulling Code

```bash
govard tool magento setup:upgrade --keep-generated
govard tool magento setup:static-content:deploy -f
govard tool magento cache:flush
```

### After Database Sync

```bash
govard config auto   # Rebuild env.php
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