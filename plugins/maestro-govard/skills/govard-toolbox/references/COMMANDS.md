# Exhaustive Govard Command Reference

Full canonical reference for all Govard subcommands.

## 1. Environment Lifecycle (`govard env`)

`govard env` is project-scoped and passes any subcommand it does not handle itself straight through to `docker compose` with the right project context, so compose flags work as-is. Root shortcuts `up`, `down`, `ps`, `logs`, `restart` and `shell` (alias `sh`) map onto it.

| Command | Purpose | Notes |
| :--- | :--- | :--- |
| `up` | Start project | `--pull`, `--quickstart`, `--force-recreate`, `--remove-orphans`, `--profile <p>`, `--update-lock`; name services to start only those |
| `down` | Remove project | compose flags pass through; `-v` also removes volumes |
| `ps` | List containers | compose flags pass through |
| `logs` | View output | compose flags (`-f`, `--tail`) pass through; Govard adds `--errors` to stream error lines |
| `restart`, `start`, `stop`, `build`, `exec`, `run`, `cp` | Compose passthrough | e.g. `govard env cp SERVICE:SRC DEST` |
| `cleanup` | Prune stale compose files and manifests from Govard home | takes no flags |
| `shell` / `sh` | Interactive shell in the app container | `govard sh -c "<cmd>"` runs one command; see `govard shell --help` |

Run `govard env --help` and `govard up --help` for the current flag set.

## 2. Database utilities (`govard db`)

| Command | Purpose | Example |
| :--- | :--- | :--- |
| `connect` | MySQL Shell | `govard db connect` |
| `query` | Run SQL | `govard db query "SELECT ..."` |
| `import` | Load SQL | `govard db import --file backup.sql --drop` |
| `dump` | Save SQL | `govard db dump --no-noise -e staging` |
| `info` | Connection Info | `govard db info` |
| `top` | Live Queries | `govard db top -e staging` |
| `import --stream-db` | Direct sync | `govard db import --stream-db -e staging --drop` |

## 3. Tool Execution (`govard tool`)

The full list is `govard tool --help`. Common ones:

- **`magento`** / **`magerun`**: Magento CLI / n98-magerun
- **`artisan`**: Laravel
- **`drush`**: Drupal
- **`symfony`**: Symfony
- **`wp`**: WordPress
- **`composer`**: PHP Package Manager
- **`npm`** / **`npx`** / **`yarn`** / **`pnpm`**: Node.js Package Managers

## 4. Synchronization & Remotes (`govard sync` / `govard remote`)

| Remote Command | Purpose | Sync Flag | Purpose |
| :--- | :--- | :--- | :--- |
| `remote add` | Add or update a remote | `-s, --source` | Source env (e.g. `staging`) |
| `remote test` | Test auth | `-d, --destination` | Destination env (default: `local`) |
| `remote list` | List remotes (plus the implicit `sandbox`) | `--db`, `--media`, `--file` | Scope of data sync |
| `remote exec <name> -- <cmd>` | Run on remote over SSH | `--full` | Sync code + db + media |
| `remote audit` | Inspect the remote operation log (`tail`, `stats`) | `--plan` | Preview before execution |
| `remote copy-id` | Copy SSH key | `--no-noise` | Skip cache, logs, tags |
| - | - | `--no-pii` | Skip customer/order PII |

The name `sandbox` is a synthetic remote (no config block), see [SANDBOX.md](SANDBOX.md).

## 5. Snapshots (`govard snapshot`)

- `snapshot create`: Capture local state or remote `-e <env>`
- `snapshot list`: List available snapshots
- `snapshot delete <name>` / `snapshot export <name>`: Remove a snapshot / export it to a tar.gz
- `snapshot restore <name>`: Roll back current environment (asks to confirm; `-y` skips the prompt, required without a TTY)
- `snapshot pull <name> -e <env>`: Fetch remote snapshot to local
- `snapshot push <name> -e <env>`: Send local snapshot to remote

## 6. Services & Shortcuts

- **`govard svc`**: global services (proxy, DNS, mail, PMA, Portainer, SSH gateway); `up`, `restart`, `logs`, `sleep`, `wake` (`sleep` stops all running projects and persists wake state, `wake` starts them again)
- **`govard redis`**: `flush`, `cli`, `info`
- **`govard varnish`**: `ban <pattern>`, `ps`, `stats`, `log` (no `purge`/`status` subcommands)
- **`govard open`**: `admin`, `mail`, `db`, `db --pma`, `db --client`, `shell`, `sftp`, `portainer`, `mftf`, `elasticsearch`/`opensearch` (no `app` target)
- **`govard debug`**: `on`, `off`, `status`, `shell`
- **`govard doctor`** (alias `diag`): `trust` (Root CA), `--fix` (`--dry-run`, `--commit`), `--json`, `--strict`, `--pack`
- **`govard config`** (alias `cfg`): `get`, `set`, `profile`, `auto`

## 7. Locking & Updates

- **`govard lock`**: `generate`, `check`, `diff`
- **`govard self-update`**: Update installed Govard binaries (`--channel`, `--version`)
- **`govard upgrade`**: Native framework upgrade pipeline (`--version` is required; `--dry-run` previews)
- **`govard tunnel`**: Public access tunnel via `cloudflared`

## 8. Project Management

- **`govard project list`**: List all projects
- **`govard project delete <name>`**: Remove project completely
- **`govard project orphans`**: Show Docker resources that are not in the registry
- **`govard env cleanup`**: Prune stale compose files and manifests

## 9. Auditing (`govard audit`)

Persistent, framework-declared project audits. Checks are `lint`
(PHPCS/PHPStan), `profiler`, and `integrity` (container-free). For
Magento 2, this is the native, authoritative lint
gate; the full decision tree (target-mode resolution, PHP matrix, provider
rules, caching/rerun identity) lives in the `magento2-linter` skill's
"Govard-Native Lint Audit Is the Real Gate" section. This table is
commands only, not policy.

| Command | Purpose | Example |
| :--- | :--- | :--- |
| `run` | Run an audit against the resolved target | `govard audit run --checks lint` |
| `run --mode standalone --php <list>` | Narrow the PHP matrix (standalone; see `magento2-linter` for `project`/`module_in_project`) | `govard audit run --mode standalone --php <list>` |
| `diff --base <ref>` | Record a diff audit against a base ref and run it: only changed files are linted (empty diff short-circuits `passed`) | `govard audit diff --base origin/master` |
| `run --allow-lint-ssh-agent` | Forward the host's `SSH_AUTH_SOCK` into the lint container, needed for a `standalone` target with a private Git/Composer dependency; opt-in per run, never forwarded automatically | `govard audit run --mode standalone --allow-lint-ssh-agent` |
| `run --lint-jobs <n>` | Lint worker count; must be between 1 and the number of PHP versions the framework declares, not just the ones selected for this run (default `nproc` capped at 4, floor 2) | `govard audit run --lint-jobs 1` |
| `rerun` | Rerun the exact prior session (never guesses "latest") | `govard audit rerun --session SESSION_ID` |
| `status` | Inspect a session | `govard audit status --session SESSION_ID` |
| `result` | Show one run's result within a session | `govard audit result --session SESSION_ID --run RUN_ID` |
| `toolchain status` | Inspect the local lint image; never pulls or builds | `govard audit toolchain status --format json` |
| `toolchain pull` / `toolchain build` | Fetch the pinned official image / build it locally | `govard audit toolchain pull` |
| `cleanup` | Prune old sessions | `govard audit cleanup --older-than 168h` |

`--lint-provider <name>` runs an external provider instead of the default
`govard` one for that run; run it in addition to the native run, never as a
replacement. For provider fallback/error policy, see `magento2-linter`
skill's workflow step 5:

```bash
govard audit run --lint-provider team-ci
```

`team-ci` above is just an example provider name from the project's own
`audit.lint.external_providers` config, not a built-in option.
