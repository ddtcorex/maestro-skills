---
name: govard-toolbox
description: |
  This skill should be used when the user asks to "start/stop environment", "govard up",
  "govard down", "run commands in container", "govard sh", "do database operations", "db dump",
  "db import", "sync with remote", "bootstrap from staging", "debug configuration", "set up
  Xdebug", "govard verify", "checklist", "QA harness", "deploy to a remote", "govard deploy", "deploy plan", "deploy check",
  "rollback a deploy", "sandbox rehearsal", or "rehearse a deploy". Provides high-level shortcuts and references for the Govard development environment
  orchestrator. This is the BASE skill. For framework-specific shortcuts, also load
  govard-magento, govard-laravel, govard-symfony or govard-wordpress.
compatibility: claude, codex, opencode, copilot, dsh
metadata:
  audience: developers
  workflow: general
---

# Govard Toolbox

Govard is a containerized development environment orchestrator. This skill provides high-level shortcuts and references. The CLI is the source of truth: `govard <command> --help` for flags and `govard capabilities` for what each command needs, so prefer them over any list below when they disagree.

## Quick Reference

### Environment Lifecycle

| Shortcut | Full Command | Purpose |
|----------|--------------|---------|
| `govard up` | `govard env up` | Start project |
| `govard down` | `govard env down` | Stop project |
| `govard sh` | `govard shell` | Interactive shell |
| `govard ps` | `govard env ps` | List containers |
| `govard verify` | `govard verify --phase 1 --json` | 5-phase executable checklist (see VERIFY.md) |

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

A remote `path` may point at the layout root: Govard probes `<path>`, `<path>/public_html` and `<path>/current` over SSH. "no database configuration at ..." lists every path tried, so check the remote path instead of retrying blindly. A failed dump is reported as a failure, never as an empty-file success; read the credential warning first.

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

# Skip noise tables (cache, logs, sessions) and PII tables
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
govard deploy plan production --json   # same plan machine-readable (carries schema_version, per-step skip_reason, run_on, needs_migration); timestamp-free, so two runs can be diffed in CI. `check` has no --json
govard deploy check production         # connectivity, permissions, layout, and the strategy that layout implies (ssh)
govard deploy releases production      # what the target has (a positional remote or --remote <name>)
govard deploy status production        # which revision the target serves (no remote: every configured remote)
govard deploy production --yes         # run it
govard deploy rollback production [--to <release>] [--with-db]   # default: the release before the live one; --with-db also restores its dump (destroys data)
govard deploy production --resume      # continue the newest unfinished release (or --from <task>)
govard deploy unlock production [--force]       # lock left by an interrupted run; a lock younger than lock_stale_after needs --force
```

Capabilities (confirm with `govard capabilities`): `plan`/`build` need nothing; `check`, `releases`, `status` and `unlock` need `ssh`; `deploy`/`rollback` also `rsync`; `sandbox *` needs Docker. A missing runtime is exit `3` `CAPABILITY_MISSING`, never a half-run. Recover a failed run with `--resume` (or `--from <task>`), never by unlocking and starting over. Resume adopts a recorded *migrate* verdict without re-probing; a recorded *skip* is discarded and re-probed; steps that already succeeded are not repeated.

**Conditional migrate (Magento only).** Before the downtime block the recipe
probes `cd {{release_path}} && {{php_bin}} bin/magento setup:db:status`: exit 0
skips the whole downtime block (maintenance mode, worker pause, config import,
db migrate, worker resume; reason `db up-to-date (probe exit 0)`); 1 or 2 runs it;
any other exit fails the deploy. Compile, cache flush and the DB backup run
regardless. Laravel, Symfony and WordPress have no probe, so their migrate steps
always run. `govard deploy plan` shows which steps are gated (`needs_migration`).

**Topology.** Project-wide defaults live in a `deploy:` block (`repository`, `branch`, `publish`, `deploy_path`); per-remote overrides live ONLY under `remotes.<name>.deploy:`. Flat per-remote deploy keys are rejected by the loader (exit 4) with a message naming the key to move. Unset `deploy_path` probes the target and is adopted only when exactly one layout candidate matches.

What runs on the target comes from the framework **recipe**; `--build=auto|server|artifact` decides who builds, and `govard deploy build --output <dir>` makes the artifact. `--db-backup` defaults off; when on, the dump lands in `shared/backups/deploy/<n>/` and `rollback --with-db` restores it. A framework whose recipe has no dump command refuses `--db-backup` up front (exit 4); see the framework skill.

```bash
# Rehearse the whole thing against a container playing the target
govard sandbox up --profile full --php 8.3 --docroot symlink   # profile, PHP series, target shape
govard deploy --remote sandbox --yes
govard sandbox down --purge          # also removes the image, key and mirror
```

Sandbox lists come from the recipe; `deploy.settings.sandbox_{packages,extensions,services,tools}` **replace** them. `sandbox reset` wipes the deploy directories (including `shared/`), so re-seed shared files. Details: [SANDBOX.md](references/SANDBOX.md).

> **Deploy preflight:** `govard deploy plan [remote]` is read-only and never connects (`--json` for machine-readable output); `govard deploy check [remote]` connects over ssh and is meant to leave nothing behind on the target (its layout probe uses a scratch directory it removes again). Both accept `--build`, `--artifact-dir`, `--branch`, `--revision` and `--tag`; `check` prints human text only. `plan` reflects the configuration, not `--publish`, `--keep` or `--verify`, which only take effect on a real run. Run them on the host.

Per-framework detail (recipes, the conditional-migrate probe, and each
framework's own step table): `govard-magento`, `govard-laravel`,
`govard-symfony`, `govard-wordpress`. Full reference:
<https://govard.ddtcorex.com/workflows/deployment>.

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
  treats optional warnings as failures (the hard gate for bootstrap scripts).
- Container-free analysis: `govard audit run --checks integrity --format json`
  runs Go analyzers on the checkout with no Docker, no PHP and no toolchain. It
  is supported on Magento 2 only (composer manifest/lock problems plus
  module/DI wiring problems, `govard-integrity` findings); Laravel, Symfony and
  WordPress exit 1 with "does not support integrity audit". **`--checks lint` still needs Docker** and, without it, exits `3`
  pointing at `--checks integrity`.
  Xdebug is orthogonal to the container: on a host with `stack.features.xdebug`
  on, the audit refuses to start and asks for `--allow-xdebug` (`govard verify`
  has the same flag). Pass the flag or turn Xdebug off; this is not a
  capability failure and the exit code is not `3`.
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
govard open mail     # Mailpit
govard open shell    # shell access details (also: sftp, portainer, mftf, elasticsearch/opensearch, db --client)

# RabbitMQ management UI (when stack.services.queue is rabbitmq)
open http://<your-domain>:15672    # guest/guest, local-only, plain HTTP (never https)
```

## Sandbox SSH gateway

Bastion `govard-proxy-sshd` at `127.0.0.1:2222`: start it with `govard svc up`.

```bash
govard gateway allow-key "$(cat ~/.ssh/id_ed25519.pub)"   # one quoted key line; updates known fingerprints in place
ssh -p 2222 <project-slug>@127.0.0.1                       # stable address (vs the ephemeral sandbox port); sftp -P 2222 likewise
govard gateway status    # bastion running? plus target and allowlist counts (needs Docker); warns if port 2222 is held by another process
govard gateway revoke-key <exact-fingerprint-or-comment>   # exact match only, no substring; no match is an error
```

Prerequisites in order: `govard svc up` (bastion) → `sandbox up` (registers the slug; `Foo_Bar` logs in as `foo-bar`) → `allow-key`. Registration is best-effort and no deploy path goes through the gateway, so gateway breakage never blocks a real deploy.

## Debugging

```bash
# Xdebug control
govard debug on
govard debug off
govard debug status

# Diagnostics
govard diag            # alias of `govard doctor`: human-readable health report
govard diag --json     # machine-readable verdict, one call answers "is this env healthy"
govard diag --fix      # apply safe automatic fixes (--dry-run previews them)
```

**Agent guidance:** before chaining `govard ps` / `govard logs` probes, run
`govard diag --json` once and branch on its result; keep `down && up` escalation for
diagnosed failures only.

### Connecting an IDE

Xdebug listens on port `9003`. `govard debug on` only enables the extension inside the container; the IDE side still needs to be configured to listen and map paths, or nothing will connect.

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

**PhpStorm**: Settings → PHP → Debug → set debug port to `9003`; Settings → PHP → Servers → add a server named `<project_name>-docker` (the `PHP_IDE_CONFIG` server name Govard exports), host `<project-domain>`, port `443`, debugger `Xdebug`, path mapping `/var/www/html` → project directory.

If it still doesn't connect: check `govard debug status`, confirm the `XDEBUG_SESSION` cookie matches `stack.xdebug_session` in `.govard.yml`, and confirm the IDE is actually listening on 9003 before triggering a request. Disable Xdebug (`govard debug off`) when not actively debugging, because it slows down every request noticeably.

## Configuration

The `.govard.yml` at the project root defines the framework, PHP/Node/DB versions, services, and domain. It is committed to the repo, so **no `govard init` is needed** for an existing project. Config is layered (later overrides earlier), and only `.govard.yml` is writable via `govard config set`:

| File | Purpose |
|---|---|
| `.govard.yml` | Team-shared base config (committed) |
| `.govard.<profile>.yml` | Team-shared scope file for the active profile (committed; wins over base) |
| `.govard.local.yml` (or `.govard/.govard.local.yml`) | Developer-local overrides (gitignored) |
| `.govard.<env>.yml` | Environment overrides, activated via `GOVARD_ENV=<env>` |

The profile name resolves from `--profile`, else the per-project registry (`~/.govard/projects.json`), else none. `govard config profile` shows the active one. **Never hand-edit `.govard.yml` to chase drift warnings while a profile layer is active**: `diag` compares the base file against detected runtime, but the running stack and every audit use the merged config with the profile applied, so a stale base is expected noise, not a bug. Verify with `govard config profile` (its values must match the running containers) instead of syncing the base. Converging the base is a team decision made through `govard doctor --fix`, which asks for confirmation interactively.

```yaml
project_name: myproject
framework: magento2          # magento2, laravel, symfony, wordpress, nextjs, …
framework_version: 2.4.7     # illustrative values throughout
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

# Write a value, only .govard.yml is writable this way
govard config set stack.php_version 8.4
```

## Audit

> For generic PHP patterns (strict_types/PSR-12/Composer/PHPStan/PDO) see `php-dev-core`.

Govard's persistent audit gate for Magento 2/Mage-OS, Laravel, Symfony and WordPress. See `magento2-linter` for the full Magento policy (`--mode`, PHP matrix, provider rules, caching/rerun identity). Text output streams live like `vendor/bin/phpcs` (colorized on a TTY, capped and plain when piped); `--format json` prints a single object on stdout for agents, with diagnostics on stderr. A failed or cancelled run still renders before exiting non-zero.

The native `govard` lint provider works for all four frameworks. Detection uses framework markers (no project-level `phpcs.xml` or `phpstan.neon` is required), and each framework gets its own coding standard:

| Framework | Detection marker | Coding standard |
|-----------|------------------|-----------------|
| Laravel | `artisan` file or `laravel/framework` in `composer.json` | `PSR12` |
| Symfony | `bin/console` + `symfony/skeleton` or `symfony/framework-bundle` | `Symfony` |
| WordPress | `wp-includes/version.php` or Bedrock `web/wp/wp-includes/version.php` | `WordPress` |
| Magento 2 / Mage-OS | `bin/magento` + `magento/magento2` requirement | `Magento2` |

The supported PHP series differ per framework and per `--mode`; read them from `govard audit run --help` and the project's resolved target, not from a copy here.

> **Agents:** run `govard audit run --checks lint --format json` on the host and read the JSON (phpcs, phpstan, pub/media guard). Do not hand-parse text output or exit codes.

```bash
govard audit run --checks lint                    # text, streams live
govard audit run --checks lint --format json      # machine-clean for agents
govard audit run --checks lint,profiler --url https://shop.test/  # also capture profiler CSV
govard audit rerun --session SESSION_ID           # exact rerun by session, profiler URL included
govard audit toolchain status                     # lint image health (never pulls or builds)
```

`--mode` is validated early (`auto`, `project`, `module_in_project`, `standalone`): a typo fails with `unknown audit target mode (valid modes: ...)`. Use `--mode project` for the common case, `standalone` only for isolated packages, `module_in_project` only for Magento `app/code` modules. `--lint-provider govard` is the native provider (`--provider` is a hidden alias).

A stale lease or lock error (`is already held`) means a previous run crashed: read the message, then run `govard audit cleanup` and retry. Do not delete files under `~/.govard/audit/` by hand unless the message says to.

### Lint scope: quick (diff) vs deep (project)

Keep this quick/deep mapping in sync with `magento2-performance-audit`'s `Scope: quick` / `Scope: deep` header.

| Mode | Govard scope | What it lints |
|------|--------------|---------------|
| quick | `--scope diff --base origin/master` (use `origin/main` when master is missing; check with `git rev-parse --verify origin/master`) | Changed PHP/phtml files only, from `git diff` against the base. An empty diff short-circuits as `passed`. `vendor`, `generated`, `var` and `pub/media` are always excluded |
| deep | `--scope project` | The full project up to the always-ignore boundary. Report every `Scope: deep` finding with evidence or `Skipped: <reason>` |

```bash
govard audit run --checks lint --scope diff --base origin/master --format json   # quick
govard audit run --checks lint --scope project --format json                      # deep
```

`--lint-jobs` defaults to `nproc` capped at 4 (floor 2) and must stay between 1 and the number of PHP versions the framework declares.

> **Timeout: use govard's `auto` (default), never a shell `timeout`.** `--timeout auto` estimates a framework-aware budget from the file count. Wrapping `govard audit` in `timeout 120` or `timeout 300` kills it from outside, which leaves a `cancelled` run, orphan `govard-audit-*` containers and a stale lock. Govard's own timeout cancels cleanly and prints `audit timeout ... (auto-estimated ...)` in text mode (silent in `json`). Override only when needed: `--timeout 300s`, `--timeout 10m` or `--timeout 0` (no limit).

> **Toolchain image:** `govard audit toolchain status` reports whether the lint image is present and which context digest it carries; `toolchain pull` fetches the pinned official image and `toolchain build` builds it locally. A `govard env up/pull` that cannot pull Govard's images falls back to building them locally (`--fallback-local-build`, on by default).

## govard sh -c quoting

`govard sh -c` takes one shell string that is parsed twice, once by the host shell and once inside the container. Quote for the inner parse first: wrap the whole command in host-side single quotes and never nest double quotes inside double quotes. When a value itself needs quoting, close the outer quote, add an escaped quote, and reopen (`'...'\''...'`) or split the work into two sequential `govard sh` calls instead of one clever one.

Join steps with `;`, and never join `grep` with `&&`: a grep that matches nothing exits 1, which fails the whole chain and swallows every earlier output silently: the run looks empty rather than wrong. Sequence independent steps with `;` and guard match-dependent steps with `|| true` so an empty match reads as empty, not as failure. The same rule covers any probe used as a condition (`cron_schedule` counts, lock-owner reads): read first, branch on the captured value in the next command.

For file-scoped searches do not rely on `grep --include` inside the container (it is not guaranteed there): `find app/code -name '*.php' -exec grep -Hn <pattern> {} +` is the portable form; see the recipes linked from `magento2-performance-audit`.

```bash
# safe shape: single-quoted outer, ;-sequenced, match guarded
govard sh -c 'bin/magento cache:status; grep -c "## QUERY" var/debug/db.log || true'
```

## Detailed References

See bundled documents:
- [COMMANDS.md](references/COMMANDS.md) - Command map (`--help` is authoritative)
- [SANDBOX.md](references/SANDBOX.md) - Sandbox rehearsal target (lifecycle, synthetic remote, seed-once, traps)
- [VERIFY.md](references/VERIFY.md) - `govard verify` checklist: output contract, framework coverage, remote coverage
- [GUIDES.md](references/GUIDES.md) - Case studies and patterns
- [FAQ.md](references/FAQ.md) - Troubleshooting

Framework-specific shortcuts: load `govard-magento`, `govard-laravel`, `govard-symfony` or `govard-wordpress`.