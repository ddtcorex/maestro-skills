---
name: govard-toolbox
description: |
  This skill should be used when the user asks to "start/stop environment", "govard up",
  "govard down", "run commands in container", "govard sh", "do database operations", "db dump",
  "db import", "sync with remote", "bootstrap from staging", "debug configuration", "set up
  Xdebug", "govard verify", "checklist", "QA harness", "deploy to a remote", "govard deploy", "deploy plan", "deploy check",
  "rollback a deploy", "sandbox rehearsal", or "rehearse a deploy". Provides high-level shortcuts and references for the Govard development environment
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
| `govard verify` | `govard verify --phase 1 --json` | 5-phase executable checklist (replaces manual tick) |

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

## Deployment

Ships a git revision to a remote from `.govard.yml`. Read-only first, always:

```bash
govard deploy plan production          # every task with what it runs, or why this mode skips it (no ssh, no rsync, no Docker)
govard deploy plan production --json   # same plan machine-readable: kind:"plan", schema_version 1, build.mode, publish.strategy + decided_by, per-step implementation(engine|command|none), skipped/skip_reason, run_on, needs_migration — timestamp-free, diff two runs in CI (check has no --json)
govard deploy check production         # connectivity, permissions, layout, and the strategy that layout implies (ssh)
govard deploy releases production      # what the target has (or --remote production)
govard deploy status production        # what it serves, and whether a release is half-published (or --remote production)
govard deploy production --yes         # run it
govard deploy rollback production [--with-db]   # previous release; --with-db also restores its dump
govard deploy production --resume      # continue a half-published release (or --from <task>)
govard deploy unlock production [--force]       # lock left by an interrupted run (or --remote production)
```

Capabilities: `plan`/`build` need nothing; `check`, `releases`, `status` and `unlock` need `ssh`; `deploy`/`rollback` also `rsync`; `sandbox *` alone needs Docker. A missing runtime is exit `3` `CAPABILITY_MISSING`, never a half-run. Recover a failed run with `--resume` (or `--from <task>`), never by unlocking and starting over. Resume adopts a recorded *migrate* verdict without re-probing; a recorded *skip* is discarded and re-probed; prior-`ok` steps are not repeated.

**Topology.** Project-wide defaults live in a `deploy:` block (`repository`, `branch`, `publish`, `deploy_path`); per-remote overrides live ONLY under `remotes.<name>.deploy:` — the flat keys (`remotes.<name>.branch|repository|publish|deploy_path`) were removed and the loader rejects them (exit 4, e.g. `remotes.staging: "branch" was removed; move it under remotes.staging.deploy.branch`). Unset `deploy_path` probes the target, adopted only when exactly one layout candidate matches.

**Conditional migrate (Magento only).** Before the downtime block the recipe probes `cd {{release_path}} && {{php_bin}} bin/magento setup:db:status`: exit 0 skips `maintenance:enable`, `app:workers:pause`, `app:config:import`, `db:migrate`, `app:workers:resume`, `maintenance:disable` (`db up-to-date (probe exit 0)`); 1/2 runs them; any other exit fails the deploy. Always-run: `build:compile`, `app:cache:flush`, `db:backup`. Laravel/Symfony/WordPress have no probe — their migrate steps always run.

What the target runs comes from the framework **recipe** — Magento 2, Mage-OS (inherits it), Laravel, Symfony and WordPress ship one; any other framework gets the neutral pipeline with the application steps empty, filled by `deploy.hooks`.

**Build modes.** `--build=auto` resolves by presence (an artifact directory means the build already happened); `server` builds on the target; `artifact` skips the five build tasks the artifact replaces, except those a recipe marks *needs the application*, which always run on the target. `govard deploy build --output <dir>` makes the artifact.

**Backups.** `--db-backup` defaults off; when on, the dump lands in `shared/backups/deploy/<n>/` before the first database-mutating task, and `rollback --with-db` restores it. Magento and WordPress have a dump; **Laravel and Symfony do not**, so `--db-backup` on them is refused before the run starts (exit 4), naming the recipe.

```bash
# Rehearse the whole thing against a container playing the target
govard sandbox up --profile full --php 8.3 --docroot symlink   # profile, PHP series, target shape
govard deploy --remote sandbox --yes
govard sandbox down --purge          # also removes the image, key and mirror
```

Sandbox lists come from the recipe; `deploy.settings.sandbox_{packages,extensions,services,tools}` **replace** them. `sandbox reset` also wipes `shared/`, so re-seed shared files.

> **On DSH:** `govard_deploy_plan {remote, build?, artifactDir?}` and `govard_deploy_check {remote, build?, artifactDir?}` — both read-only, `remote` required. Running a deploy stays in the terminal; there is no tool for it.

Per-framework detail: `govard-magento`, `govard-laravel`, `govard-symfony`, `govard-wordpress`. Full reference: <https://govard.ddtcorex.com/workflows/deployment>.

## Host Without Docker

Govard works without a container runtime. Every command declares its runtime
requirement, and the requirement-free set is derived from that manifest:

```bash
govard capabilities          # command, requirement, host status
govard capabilities --json   # machine-readable, schema_version 1
```

- `CAPABILITY_MISSING` / exit code `3` means a declared capability (docker, ssh,
  rsync, cloudflared, net) is unavailable. The message names the capability, and
  `govard env up --error-json` prints it as a versioned JSON envelope. Do not
  hand-parse the text form.
- `govard doctor` exits `0` when only optional capabilities are missing and
  reports `required`/`severity`/`affects` per check; `govard doctor --strict`
  restores the old hard gate for bootstrap scripts.
- Container-free analysis: `govard audit run --checks integrity --format json`
  runs Go analyzers on the checkout — no Docker, no PHP, no toolchain. It
  reports composer manifest/lock problems and Magento module/DI wiring problems
  (`govard-integrity` findings). `--checks lint` still needs Docker and, without
  it, exits `3` pointing at `--checks integrity`.
- Commands that forward their arguments (`govard tool php ...`,
  `govard redis cli ...`) cannot parse `--error-json`; their exit codes are
  unchanged.

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
govard varnish ban /.*   # purge URL pattern (no purge subcommand)
govard varnish ps        # container status (or `stats` for varnishstat)

# Open URLs
govard open admin    # Admin panel
govard open db       # PHPMyAdmin
govard open mail     # Mailhog
govard open shell    # project shell (also: sftp, portainer, mftf, elasticsearch/opensearch, db --client)
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
| `.govard.<profile>.yml` | Team-shared scope file for the active profile (committed; wins over base) |
| `.govard.local.yml` (or `.govard/.govard.local.yml`) | Developer-local overrides (gitignored) |
| `.govard.<env>.yml` | Environment overrides, activated via `GOVARD_ENV=<env>` |

The profile name resolves from `--profile`, else the per-project registry (`~/.govard/projects.json`), else none — `govard config profile` shows the active one. **Never hand-edit `.govard.yml` to chase drift warnings while a profile layer is active**: `diag` compares the base file against detected runtime, but the running stack and every audit use the merged config with the profile applied, so a stale base is expected noise, not a bug. Verify with `govard config profile` (its values must match the running containers) instead of syncing the base — converging the base is a team decision via `govard doctor --fix` in a real TTY.

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
| quick | `--scope diff --base origin/master` | `origin/master` (or `origin/main` if master missing — validate with `git rev-parse --verify origin/master` first) | ~15–30s (diff of <500 files vs 9743 project) | Changed files only via `git diff --name-only --diff-filter=ACMRT origin/master...HEAD` intersected with `.glintignore` quick profile (ignore `vendor`/`dev/tests`/`lib`/`m2-hotfixes` to keep quick under 500 findings) — still honors always-ignore `pub/media`/`pub/static`/`var`/`generated`/`node_modules`/`.worktrees`/`.git` |
| deep | `--scope project` | — | ~45–127s | Full project to the always-ignore boundary only — includes `vendor`/`dev/tests`/`lib`/`m2-hotfixes` when that boundary applies, but never `pub/media`/`var`/`generated` — report every `Scope: deep` finding with evidence or `Skipped: <reason>` |

On DSH: call `govard_audit_lint {worktreePath?, scope?: "diff"|"project", base?: "origin/master"}` → `{lint:{phpcs,phpstan},pubMediaGuard,rawJson,summary}`; it already uses `scope diff` + `jobs min(nproc,4)` + stale `diagnostics` cleanup internally. CLI `govard audit run` now also defaults `--lint-jobs min(nproc,4)` (4 on typical 12-core, was 2) and `scope diff` lints only changed files via `diff-files.txt` mounted as `GOVARD_LINT_DIFF_FILE` (`php/phtml` under target, `vendor/generated/var/pub/media` excluded, empty diff short-circuits as `passed` with `diff-empty` cache). Otherwise: shell `govard audit run --checks lint --scope diff --base origin/master --format json` (quick, ~3-5s for 1 file vs 9m full) or `--scope project --format json` (deep). Text mode caps at 10 and is colorized — use `--format json` for agents and never hand-parse text/exit codes. For workflow-level lint quick/deep, prefer `govard_audit_lint` on DSH and `govard audit run --checks lint --scope diff --base origin/master` otherwise — keep skills vs plugins separate (A).

> **Timeout — use govard's `auto` (default), never shell `timeout`:** since `v1.67.0` `govard audit` has `--timeout auto` (default, 90s–30m framework-aware: 80ms/file magento2, 70ms wordpress, 20ms symfony/laravel + 60s base + 50% headroom, at least **15m** for magento2/wordpress since `v1.68.0` — was 10m). Verified `2026-08-29` + `2026-08-31`: `symfony` 11k files → `2m15s` auto, `wordpress` fresh 1.5k → `~4m`, large `wordpress` 8k → `15m` auto (actual `219s`/`450s`), large `magento2` 10k non-vendor → `30m` auto (actual `590s` cold / `178s` warm, `1197s` cold for 20k findings). **Never wrap `govard audit` with shell `timeout 120/300`** — it causes `cancelled` + orphan `govard-audit-*` containers + stale `~/.govard/audit/<id>/lock` (v1.68.0 auto-removes stale lock if mtime>10m or holder PID dead, but still wastes run). Govard's internal `context.WithTimeout` cancels cleanly and prints `INFO audit timeout 2m15s (auto-estimated…)` in text (silent in `json`). Override only when needed: `--timeout 300s`/`10m`/`0` (no limit); default `auto` is correct for all 4 frameworks — `example-magento2`/`example-wordpress` failed at `timeout 120` in `2026-08-31` validation because outer `timeout` killed `auto`'s `15m` estimate.

> **Toolchain & image — verify after build:** after `make build` (which embeds `ContextDigest` SHA256 of `docker/audit/Dockerfile+bin+toolchains+tests`), run `govard audit toolchain build` then `govard audit toolchain status` must show `Present: yes` and same `Context digest`. Runner is `bin/glint` (`/usr/local/bin/glint`). Since `v1.67.0` the toolchain natively bundles `WPCS 3.4.1` + `Symfony CS 3.16.0` via `composer global config allow-plugins` then `installed_paths` fallback, and `RestrictedCodeSniff.php` is patched `file_exists ? include : []` (commit `2011f24`) because `magento-coding-standard 40` (used on php 8.1+) may ship without `_files/restricted_classes.php` per-toolchain. Quick check: `docker run --rm govard-local/glint:… /opt/govard/toolchains/php-8.3/vendor/bin/phpcs -i` must list `WordPress, Symfony, Magento2`. Wrong `ENTRYPOINT` on `docker commit` gives `sh: Illegal option --` — always `commit --change='ENTRYPOINT ["/usr/local/bin/glint"]'`. Lock `audit lock ... already held (waited 30s)` → `rm -f ~/.govard/audit/<projectId>/lock` + `docker rm -f govard-audit-*` if holder crashed (since `v1.68.0` stale lock auto-removed if mtime>10m or holder PID dead). Global `govard 1.65.0 != bin 1.67.0` → manual `sudo cp govard/bin/govard /usr/local/bin/govard` (approval prompts disabled, TTY required).

## Detailed References

See bundled documents:
- [COMMANDS.md](COMMANDS.md) - Exhaustive command reference
- [GUIDES.md](GUIDES.md) - Case studies and patterns
- [FAQ.md](FAQ.md) - Troubleshooting

For Magento-specific: Load `govard-magento` skill
For Laravel-specific: Load `govard-laravel` skill