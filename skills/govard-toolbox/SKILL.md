---
name: govard-toolbox
description: Use when starting or stopping a Govard environment, running container commands, database dump or import, syncing from staging, Xdebug, or a deploy and its rehearsal. Keywords govard up, govard sh, govard deploy.
compatibility: claude, codex, opencode, copilot, dsh
metadata:
  audience: developers
  workflow: general
---

# Govard Toolbox

## When to use

Load this skill first for the Govard development environment; it is the BASE skill, and the framework skills build on it.

- "start/stop environment", "govard up", "govard down", "run commands in container", "govard sh"
- "do database operations", "db dump", "db import", "sync with remote", "bootstrap from staging"
- "debug configuration", "set up Xdebug", "govard verify", "checklist", "QA harness"
- "deploy to a remote", "govard deploy", "deploy plan", "deploy check", "rollback a deploy", "sandbox rehearsal", "rehearse a deploy"

Also load govard-magento, govard-laravel, govard-symfony or govard-wordpress for framework-specific shortcuts.

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
govard remote add staging --host staging.server --user deploy --path '~/app'

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

A deploy, a rollback, `--with-db` and a bootstrap into a live remote change a running site.
State the remote, the exact command and the way back, then wait for an explicit yes before
running one; never pass `--yes` to approve a production target on the user's behalf, and never
chain a plan and an apply on one line. Read-only first, always.

Read [references/DEPLOYMENT.md](references/DEPLOYMENT.md) when shipping a revision, rehearsing a deploy, rolling back, or bootstrapping a live remote.

## Host Without Docker

Read [references/HOST-WITHOUT-DOCKER.md](references/HOST-WITHOUT-DOCKER.md) when no container runtime is available, or when you need to know which command requires what.

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
govard varnish ban '/.*' # purge URL pattern (no purge subcommand)
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

Only `.govard.yml` is writable from `govard config set`, and it is never hand-edited to chase drift warnings while a profile layer is active. Read [references/CONFIGURATION.md](references/CONFIGURATION.md) when reading or writing configuration, or when a value comes from an unexpected layer.

## Audit

Branch on the run's JSON status line and the report, never on prose: `--format json` is one object on stdout with diagnostics on stderr, and a failed or cancelled run still renders before exiting non-zero. Report every finding with its evidence, or mark it `Skipped: <reason>`. Read [references/AUDIT.md](references/AUDIT.md) when running or reading a `govard audit` on any framework, or when picking a check or a scope.

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
- [DEPLOYMENT.md](references/DEPLOYMENT.md) - Deploy plan/apply, rehearsal, rollback, bootstrap
- [AUDIT.md](references/AUDIT.md) - The audit gate per framework: provider, standard, checks, scopes, output
- [CONFIGURATION.md](references/CONFIGURATION.md) - Layered config files and which one is writable
- [HOST-WITHOUT-DOCKER.md](references/HOST-WITHOUT-DOCKER.md) - Runtime requirement manifest, host-only commands
- [SANDBOX.md](references/SANDBOX.md) - Sandbox rehearsal target (lifecycle, synthetic remote, seed-once, traps)
- [VERIFY.md](references/VERIFY.md) - `govard verify` checklist: output contract, framework coverage, remote coverage
- [GUIDES.md](references/GUIDES.md) - Case studies and patterns
- [FAQ.md](references/FAQ.md) - Troubleshooting

Framework-specific shortcuts: load `govard-magento`, `govard-laravel`, `govard-symfony` or `govard-wordpress`.