---
name: govard-toolbox
description: |
  This skill should be used when the user asks to "start/stop environment", "govard up",
  "govard down", "run commands in container", "govard sh", "do database operations", "db dump",
  "db import", "sync with remote", "bootstrap from staging", "debug configuration", or "set up
  Xdebug". Provides high-level shortcuts and references for the Govard development environment
  orchestrator. This is the BASE skill — for framework-specific shortcuts, also load
  govard-magento or govard-laravel.
compatibility: claude, codex, opencode, copilot, dsh
metadata:
  audience: developers
  workflow: general
---

# Govard Toolbox

Govard is a containerized development environment orchestrator. This skill provides high-level shortcuts and references.

## Quick Reference

### Environment Lifecycle

| Shortcut | Full Command | Purpose |
|----------|--------------|---------|
| `govard up` | `govard env up` | Start project |
| `govard down` | `govard env down` | Stop project |
| `govard sh` | `govard shell` | Interactive shell |
| `govard ps` | `govard env ps` | List containers |

### Common Commands

```bash
# Start environment
govard up

# Stop environment
govard down

# Stop with volumes (clean slate)
govard down -v

# Shell into PHP container
govard sh

# Run single command
govard sh -c "ls -la"

# View logs
govard logs -f

# Restart services
govard restart
```

### Database Operations

```bash
# Connect to MySQL
govard db connect

# Run query -- table names may need a framework-specific prefix (e.g. Magento's
# db.table_prefix in app/etc/env.php, WordPress's $table_prefix) if one is configured
govard db query "SELECT * FROM admin_user LIMIT 1"

# Import dump
govard db import --file backup.sql --drop

# Export database
govard db dump --no-noise -e staging

# Direct sync from remote
govard db import --stream-db -e staging --drop
```

### Remote Sync

```bash
# Add remote
govard remote add staging ssh://user@staging.server/path

# Test connection
govard remote test staging

# Sync everything
govard sync --source staging --full

# Plan before sync (preview)
govard sync --source staging --full --plan

# Skip noise (cache, logs)
govard sync --source staging --full --no-noise --no-pii
```

### Bootstrap

```bash
# From staging (full setup)
govard bootstrap --clone -e staging --no-pii --no-noise --yes

# Preview plan
govard bootstrap --clone -e staging --plan
```

## Tool Execution

```bash
# Run framework CLI
govard tool magento cache:flush
govard tool magerun cache:clear
govard tool artisan migrate
govard tool drush cr

# Node tools
govard tool npm install
govard tool composer install
```

## Services

```bash
# Redis
govard redis flush
govard redis cli

# Varnish
govard varnish purge

# Open URLs
govard open app      # Main site
govard open admin    # Admin panel
govard open db       # PHPMyAdmin
govard open mail     # Mailhog
```

## Debugging

```bash
# Xdebug control
govard debug on
govard debug off
govard debug status

# Diagnostics
govard diag            # human-readable health report
govard diag --json     # machine-readable verdict — one call answers "is this env healthy"
govard diag --fix      # Auto-fix issues
```

**Agent guidance:** before chaining `govard ps` / `govard logs` probes, run
`govard diag --json` once and branch on its result; keep `down && up` escalation for
diagnosed failures only.

### Connecting an IDE

Xdebug listens on port `9003`. `govard debug on` only enables the extension inside the container — the IDE side still needs to be configured to listen and map paths, or nothing will connect.

**VSCode** (`.vscode/launch.json`):
```json
{
    "name": "Listen for Govard Xdebug",
    "type": "php",
    "request": "launch",
    "port": 9003,
    "pathMappings": { "/var/www/html": "${workspaceFolder}" }
}
```

**PhpStorm**: Settings → PHP → Debug → set debug port to `9003`; Settings → PHP → Servers → add a server named to match the project, host `<project-domain>.test`, port `443`, debugger `Xdebug`, path mapping `/var/www/html` → project directory.

If it still doesn't connect: check `govard debug status`, confirm the `XDEBUG_SESSION` cookie matches `stack.xdebug_session` in `.govard.yml`, and confirm the IDE is actually listening on 9003 before triggering a request. Disable Xdebug (`govard debug off`) when not actively debugging — it slows down every request noticeably.

## Configuration

The `.govard.yml` at the project root defines the framework, PHP/Node/DB versions, services, and domain — it's committed to the repo, so **no `govard init` is needed** for an existing project. Config is layered (later overrides earlier), and only `.govard.yml` is writable via `govard config set`:

| File | Purpose |
|---|---|
| `.govard.yml` | Team-shared base config (committed) |
| `.govard.local.yml` (or `.govard/.govard.local.yml`) | Developer-local overrides (gitignored) |
| `.govard.<env>.yml` | Environment overrides, activated via `GOVARD_ENV=<env>` |

```yaml
project_name: myproject
framework: magento2          # magento2, laravel, symfony, wordpress, nextjs, …
framework_version: 2.4.7
domain: myproject.test
stack:
  php_version: "8.3"
  node_version: "20"
  db_version: "10.6"
  services:
    web_server: apache        # apache | nginx
    db: mariadb               # mariadb | mysql | none
    search: opensearch        # opensearch | elasticsearch | none
    cache: redis              # redis | valkey | none
  features:
    xdebug: false
    varnish: false
```

```bash
# Auto-config after DB sync (rebuilds app-level config, e.g. Magento's env.php)
govard config auto

# Read a value without opening the file
govard config get stack.php_version

# Write a value — only .govard.yml is writable this way
govard config set stack.php_version 8.4
```

## Audit

> For generic PHP patterns (strict_types/PSR-12/Composer/PHPStan/PDO) see `php-dev-core`.

Govard's persistent audit gate for Magento 2/Mage-OS **and** Laravel/Symfony/WordPress -- see `magento2-linter` for full Magento policy (`target --mode`, PHP matrix, provider rules, caching/rerun identity) and this section for the 4-framework matrix. Text streams live like `vendor/bin/phpcs` (TTY colorized + uncapped, piped capped + plain); `json` stays a single object on stdout for AI agents. A failed/cancelled run still renders before exiting non-zero.

### Audit Matrix — 4 Frameworks

Govard `audit run --checks lint --lint-provider govard --mode project --format json` is native for all 4 frameworks. Detection is via framework markers; no project-level `phpcs.xml`/`phpstan.neon` required for fallback. PHPStan level `5` and linters `phpcs + phpstan` are fixed across the matrix.

| Framework | Detection Marker | CodingStandard | PHP | PHPStan | Linters |
|-----------|----------------|----------------|-----|---------|---------|
| Laravel | `artisan` file or `laravel/framework` in `composer.json` | `PSR12` | `8.1`–`8.4` | `5` | `phpcs`, `phpstan` |
| Symfony | `bin/console` + `symfony/skeleton` or `symfony/framework-bundle` | `Symfony` | `8.1`–`8.4` | `5` | `phpcs`, `phpstan` |
| WordPress | `wp-includes/version.php` or Bedrock `web/wp/wp-includes/version.php` | `WordPress` | `8.1`–`8.4` | `5` | `phpcs`, `phpstan` |
| Magento 2 / Mage-OS | `bin/magento` + `magento/magento2` requirement | `Magento2` | `8.1`–`8.4` (standalone `8.1`–`8.5`, `7.4`/`8.0` only for `project`/`module_in_project`) | `5` | `phpcs`, `phpstan` |

`--lint-provider govard` is the native provider (alias `--provider` kept for back-compat but deprecated). Use `--mode project` for the common case; `--mode standalone` only for isolated packages, `--mode module_in_project` only for Magento `app/code` modules.

> **On DSH:** call `govard_audit_lint {worktreePath?}` → {lint:{phpcs,phpstan},pubMediaGuard,rawJson,summary}. Do not hand-parse text/exit codes.
> **Otherwise:** `govard audit run --checks lint --format json` (machine-clean, one JSON on stdout, diagnostics on stderr; text mode capped at 10 and colorized — not for agents).

```bash
govard audit run --checks lint                    # project or module_in_project, default text streams live
govard audit run --checks lint --format json      # machine-clean for agents, diagnostics on stderr
govard audit run --checks lint,profiler --url https://shop.test/  # also capture profiler CSV (v1.64.0+)
govard audit rerun --session SESSION_ID           # exact rerun by session, profiler URL included
govard audit toolchain status                     # lint image health
```

`--mode` validates early (`auto`, `project`, `module_in_project`, `standalone`) -- typo `module` fails with `unknown audit target mode (valid modes: ...)`. `govard env up/pull` now uses resilient per-image pulls (`--ignore-buildable`, reuse compatible local image or build Govard image locally). Stale `diagnostics` lease (`is already held`) -- `rm ~/.govard/audit/<project>/leases/diagnostics.json` and `.govard/*/custom/govard-audit-profiler-*.conf`; 7-page manual audit costs ~2.5-3 min on reference project -- keep all 7 with `timeout 300` and trap single, not fewer pages.

### Lint scope — quick (diff) vs deep (project) — quick vs deep

Lint supports **quick** (PR) vs **deep** (release) scope — keep this quick.*deep mapping in sync with `magento2-performance-audit`'s `Scope: quick` / `Scope: deep` header.

| Mode | Govard scope | Base | Time | What it lints |
|------|--------------|------|------|---------------|
| quick | `--scope diff --base origin/master` | `origin/master` (or `origin/main` if master missing — validate with `git rev-parse --verify origin/master` first) | ~15–30s (diff of <500 files vs 9743 project) | Changed files only via `git diff --name-only --diff-filter=ACMRT origin/master...HEAD` intersected with `.magelintignore` quick profile (ignore `vendor`/`dev/tests`/`lib`/`m2-hotfixes` to keep quick under 500 findings) — still honors always-ignore `pub/media`/`pub/static`/`var`/`generated`/`node_modules`/`.worktrees`/`.git` |
| deep | `--scope project` | — | ~45–127s | Full project to the always-ignore boundary only — includes `vendor`/`dev/tests`/`lib`/`m2-hotfixes` when that boundary applies, but never `pub/media`/`var`/`generated` — report every `Scope: deep` finding with evidence or `Skipped: <reason>` |

On DSH: call `govard_audit_lint {worktreePath?, scope?: "diff"|"project", base?: "origin/master"}` → `{lint:{phpcs,phpstan},pubMediaGuard,rawJson,summary}`; it already uses `scope diff` + `jobs min(nproc,4)` + stale `diagnostics` cleanup internally. Otherwise: shell `govard audit run --checks lint --scope diff --base origin/master --format json` (quick) or `--scope project --format json` (deep). Text mode caps at 10 and is colorized — use `--format json` for agents and never hand-parse text/exit codes. For workflow-level lint quick/deep, prefer `govard_audit_lint` on DSH and `govard audit run --checks lint --scope diff --base origin/master` otherwise — keep skills vs plugins separate (A).

## Detailed References

See bundled documents:
- [COMMANDS.md](COMMANDS.md) - Exhaustive command reference
- [GUIDES.md](GUIDES.md) - Case studies and patterns
- [FAQ.md](FAQ.md) - Troubleshooting

For Magento-specific: Load `govard-magento` skill
For Laravel-specific: Load `govard-laravel` skill