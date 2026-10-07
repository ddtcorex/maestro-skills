# Govard Verify: Executable Checklist

`govard verify` is the executable form of the manual QA checklist: a base
registry of items grouped into 5 phases (`internal/verify/registry.go`), plus the
items each framework definition declares for itself, with one JSON artifact per
phase. The registry is the source of truth; this file explains how to read a run
and how to verify the rest of the command surface by hand. It deliberately holds
no item totals, because totals change with every release. Read them from the
binary instead:

```bash
govard verify --help              # phase names
govard verify --plan --json       # every item this project would run, nothing executed
govard capabilities --json        # every command and the host capability it needs
```

## When to use

User asks `govard verify / checklist / QA harness / 5-phase verification`, or
wants to know what has actually been proven about a project's Govard setup. The
sections below cover the checklist UX, its output contract, and which parts of
the command surface it does **not** reach.

## Phases

| Phase | Purpose |
|---|---|
| P1 Preflight | doctor, config, lock and status checks, nothing started |
| P2 Bootstrap & Env | bring the environment up, bootstrap from a remote (plan by default), config auto, site answers |
| P3 Dev Loop | framework CLI round trips, debug status, audit (lint, profiler, integrity) |
| P4 Sync/Safety | remote probes, sync plans, snapshot create and list, service probes, deploy read surface |
| P5 Destructive QA | lock overwrite, volume wipe and restore, framework install plan, re-lint |

## How a run decides which rows execute

**1. Framework gates.** A base item can carry a `When` predicate. An unmet
predicate is a **reported** skip: the row stays in the phase's JSON with
`skipped: true` and a `skip_reason` (for example `framework gate: P3-01 is
framework-specific and this project is laravel`). A missing row would be worse
than a red one, because a red is evidence. The base registry's Magento-specific
rows (cache flush, `setup:upgrade`, `setup:di:compile`, static content,
reindex, cron, `--version`, deploy mode) are gated on Magento 2, and the
Hyva npm build and `frontend start` rows are gated on what the project actually
contains or enables. There is no `isLaravel`, `isSymfony` or `isWordPress`
predicate in the base registry: those frameworks get their dev loop from
declared items (next point), not from gates.

**2. Framework-declared items.** Every framework definition may declare
`engine.VerifyToolItem` rows: `{ID, Phase, Title, Tool, Args}` that run as
`govard tool <Tool> <Args...>`. `RegistryFor(cfg)` appends them to the base
registry, so `RunPhase` always filters over the composed list. They are how the
non-Magento frameworks get their own dev loop:

| Framework | Shim | What the declared items prove |
|---|---|---|
| Magento 2 / Mage-OS | `tool magento` | DB schema state after a restore (the dev loop lives in the base registry) |
| Laravel | `tool artisan` | `--version`, `migrate:status`, `cache:clear`, `migrate:status` after restore |
| Symfony | `tool symfony` | `--version`, `cache:clear`, `debug:router`, `cache:clear` after restore |
| WordPress | `tool wp` | `core version`, `option get siteurl`, `cache flush`, `db check` after restore |

Framework ids must not collide with a static id (the composed list is appended,
never de-duplicated) and declared items carry no `Guard`. Adding a framework
means adding a `VerifyToolItems` entry to its definition, nothing under
`internal/verify`. List the exact rows with `govard verify --plan --json`.

**3. Guards.** `Item.Guard` is enforced before the plan stub, so a gated item is
one `skipped` row in every mode and its `Run` is never reached:

| Guard | Meaning | Needs |
|---|---|---|
| `REMOTE-PROBE` | contacts a remote, read-only | `--remote <name>` |
| `REMOTE-WRITE` | writes through a remote | `--remote <name>` and `--allow-remote-write` |
| `DESTRUCTIVE-LOCAL` | wipes or overwrites local state | phase 5 gate and `--allow-destructive` |

`Item.Precond` is documentation only: it records what a row assumes and is not
the skip reason. A fence test pins every row's label to what the row's argv
really does, so a label cannot drift.

An item never picks a remote for itself. Every remote-naming item takes the name
from `--remote` and nothing else, and a **run** without one skips those rows
with `no --remote named: this item contacts a remote`. The skip is **run-mode
only**: the no-remote decision lives inside `Run`, which plan mode replaces with
a stub, so a `--plan` run without `--remote` reports those rows as ordinary
`exit_code: 0` plan stubs, not as skipped. Only the guards are visible in plan
mode, so do not read a plan as a gate report.

## Commands

```bash
govard verify --plan --json                # dry run: every item exits 0, nothing runs
govard verify --phase 1 --json             # P1 only
govard verify --phase 2 --plan --json      # P2 plan
govard verify --phase 4 --json             # must PASS the snapshot item before phase 5
govard verify --phase 5 --allow-destructive --json  # destructive last
govard verify --json                       # all phases (P5 needs the gate and --allow-destructive)
govard verify --phase 3 --checks profiler --json
govard verify --phase 3 --timeout auto --lint-jobs 4 --json
```

`govard verify --help` is the authoritative flag list. Semantics worth knowing:

- `--phase 0..5` (0 = all). Out of range is an execution error (exit 1); an
  unknown flag is a usage error (exit 2).
- `--base`, `--allow-xdebug` and `--allow-destructive` (alias `--yes`) change
  **which rows** run. `--checks`, `--lint-jobs` and `--timeout` change **what
  the lint-style rows execute**: they are threaded into those items' argv, and
  each such row records the resolved argv as the first line of its evidence
  excerpt.
- `--lint-jobs` is not forwarded when it equals verify's own default, so
  `audit run` keeps its host-tuned worker count. `--timeout` falls back per item.
- `--checks` filters on the check an item declares; a row that declares none is
  not check-specific and always runs, and an excluded row stays as a `skipped`
  row naming the selection. An unknown check name is a usage error (exit 2).
- `--plan` is a true dry run: no item's `Run` is called, each item records an
  `Evidence{ExitCode: 0, OutputExcerpt: "plan: <title>"}`.
- `--remote <name>` supplies the remote for remote-naming rows;
  `--allow-remote-write` additionally unlocks the rows that write through it.

## Gates

**Phase 5** needs both, or the command exits **1** with `ErrNeedSnapshot` /
`ErrNeedAllowDestructive` (with `--json` the block is a `{"error": "..."}`
document on stdout):

1. `--allow-destructive`, and
2. a **non-plan** `*-phase4.json` artifact **for the same project** whose
   snapshot item recorded a snapshot that is still on disk **and genuinely
   restorable**: metadata `db: true` and a `db.sql.gz` that decompresses to at
   least 1 byte.

`--plan` bypasses the gate entirely, so `verify --phase 5 --plan` is green with
no snapshot.

## Command coverage: every command, four frameworks

`govard verify` exercises a deliberate subset of the CLI. A green run proves that
subset only. To verify **all** commands, enumerate them, then work through the
groups below.

```bash
# every distinct command and the capability it needs (a command can appear twice in the manifest, so dedupe)
govard capabilities --json | python3 -c 'import json,sys;[print(c) for c in sorted({c["command"] for c in json.load(sys.stdin)["commands"]})]'
```

To see which commands an item's argv reaches, read the `execGovard(ctx, cfg,
opts, ...)` call sites in `internal/verify/registry.go` plus each framework's
`VerifyToolItems`. Count a command as covered only when a call site begins with
exactly that command's words: grepping for a command name overstates coverage
(`tool artisan` and `audit rerun` are run by items even though no registry line
spells `govard tool artisan` as one literal).

Smoke every command's `--help` (read-only, no Docker needed) before any live
pass, so a renamed or removed command shows up as an exit code, not a surprise.
Skip `govard tool *`: those shims forward their arguments to the container, so
`--help` reaches the framework CLI (and fails outside a running project). Verify
them live instead.

```bash
govard capabilities --json | python3 -c 'import json,sys;[print(c) for c in sorted({c["command"] for c in json.load(sys.stdin)["commands"]})]' |
  grep -v '^govard tool ' |
  while read -r line; do $line --help >/dev/null 2>&1 || echo "no help: $line"; done
```

### Framework-neutral commands

These behave the same on Magento 2, Laravel, Symfony and WordPress, so one live
pass on any project covers them. Verify each group by hand where verify has no
item:

| Group | Commands | Verified by |
|---|---|---|
| Host and diagnostics | `doctor` (+ `trust`, which needs sudo and skips without it), `diag`, `status`, `capabilities`, `version`, `completion *`, `gateway status`, `audit toolchain status`, `sandbox status` | P1 items; `diag --json` by hand |
| Lifecycle | `env up/down/ps/logs/restart/exec/run/cp/build/cleanup`, `up`, `down`, `ps`, `logs`, `restart`, `shell`, `sh` | P2 items, by hand for the rest |
| Config and locking | `config get/set/auto/profile *`, `lock generate/check/diff`, `domain add/list/remove`, `blueprint cache *`, `custom list` | items cover `config get/auto/profile`, `lock`, `domain list` and `custom list`; `config set`, `domain add/remove`, `config profile apply/switch/clear` by hand |
| Database | `db connect/query/info/dump/import/top` | by hand (local); see Remote coverage for `-e` |
| Snapshots | `snapshot create/list/restore/export/pull/push/delete` | P4/P5 items cover create, list, restore and `--help` of export/pull; push and delete by hand |
| Services | `redis *`, `valkey`, `elasticsearch`, `opensearch`, `rabbitmq`, `varnish *`, `svc up/sleep/wake` | partial: P4 probes redis and search; run the rest against a stack that enables the service |
| Browser and IDE | `open <target>`, `debug on/off/status/shell`, `frontend start/stop/logs`, `vscode *` | P2/P3 cover `open --help`, `debug status`, `frontend start`; the IDE shims mean nothing in CI |
| Audit | `audit run/diff/rerun/status/result/cleanup`, `audit toolchain status/pull/build` | P3/P5 items cover run, rerun, status, result; toolchain and cleanup by hand |
| Host without Docker | `audit run --checks integrity`, `capabilities`, `doctor` | exit `3` `CAPABILITY_MISSING` is the expected result of a Docker-needing command |
| Project registry | `project list/open/orphans/delete`, `desktop doctor`, `self-update`, `upgrade` | `project orphans` has an item; the rest by hand, and `project delete`, `self-update` and `upgrade` mutate shared or project state |

### Framework-specific surfaces

Run each row on a sample project of that framework. A cell that says "verify"
means the behavior differs per framework and must be observed, not assumed.

| Surface | Magento 2 | Laravel | Symfony | WordPress |
|---|---|---|---|---|
| Native CLI shim | `tool magento`, `tool magerun` | `tool artisan` | `tool symfony` | `tool wp` |
| Dev loop in verify | base registry rows (gated on Magento 2) | declared items | declared items | declared items |
| `config auto` | rebuilds `app/etc/env.php` | unsupported, writes nothing | unsupported, writes nothing | verify |
| `env up` wires app config | verify | no: `.env` keeps its own DB settings until `bootstrap` rewrites it | no: set `DATABASE_URL` yourself | no: `wp-config.php` is generated only when missing at bootstrap |
| `audit run --checks integrity` | supported, container-free (still refused while Xdebug is on) | unsupported (exit 1) | unsupported (exit 1) | unsupported (exit 1) |
| `audit run --checks profiler` | supported, but verify the CSV is produced | verify | verify | unsupported (exit 1) |
| Audit coding standard | `Magento2` | `PSR12` | `Symfony` | `WordPress` |
| `open admin` | probes the route | opens `/admin`, a route Laravel does not have | verify | opens `/admin`, not `/wp-admin` |
| `frontend start` | needs `stack.features.frontend_sync`; check the sync container is healthy | needs `frontend_sync` (exit 1 otherwise) | needs `frontend_sync` | verify |
| `db dump --no-noise/--no-pii` | table-prefix aware | verify | verify | filters match nothing until `table_prefix` is set in `.govard.yml` (no detector), so grep the dump |
| Deploy: maintenance window | yes | yes | **none in the recipe** | yes |
| Deploy: conditional migrate probe | yes (`setup:db:status`) | always runs | always runs | always runs |
| Deploy: `--db-backup` | supported | refused (exit 4) | refused (exit 4) | supported |
| `deploy plan <remote>` | needs a branch (exit 4 without) | same | same | same |

Cells marked `verify` are intentionally not asserted here: read them from the
live run (`govard deploy plan <remote>`, `govard open admin -e <remote>`). Every
other cell was observed on a live project of that framework; re-observe it
before relying on it after a govard upgrade.

### Per-framework live pass

For each of the four frameworks, in a disposable copy of a sample project (never
a real client project), run the neutral groups once, then:

```bash
govard verify --plan --json                  # what this framework composes
govard verify --phase 1 --json && govard verify --phase 2 --json
govard verify --phase 3 --json               # the framework's own dev loop
govard verify --phase 4 --json               # snapshot item must record a restorable snapshot
govard verify --phase 5 --allow-destructive --json   # destructive last

govard tool <shim> --version                 # the shim from the table above
govard open admin ; govard db info ; govard config auto
govard deploy plan <remote> --json           # recipe, maintenance window, migrate step
govard audit run --checks integrity --format json
```

Record, per command: exit code, whether the framework gate or declared items
behaved as the table above says, and any command whose help text and observed
behavior disagree.

## Remote coverage

The remote-reaching commands are those whose `requires` contains `ssh`, `rsync`
or `cloudflared` in `govard capabilities --json`. The checklist reaches them
through `--remote <name>`; use `--remote sandbox` (see below) so no real host is
needed.

| Command | Reached by | Note |
|---|---|---|
| `remote test`, `remote list`, `remote exec`, `remote audit tail/stats` | probe rows | `remote exec` runs `hostname` only; the audit log is global, so its counts include other projects |
| `sync` | `--plan` rows (db, file, media, full) | never a real transfer from the checklist |
| `deploy plan`, `deploy releases`, `deploy status`, `deploy check` | read rows | `deploy status` uses human output on purpose: `deploy status --json` exits **0** on an unreachable remote, so the `--json` form is a false green |
| `deploy` | rehearsal row, `REMOTE-WRITE` | runs only with `--allow-remote-write`; point it at the sandbox |
| `deploy rollback`, `deploy unlock` | `--help` rows only | the real thing is a manual step, see below |
| `bootstrap -e <remote>` | plan rows, plus two `REMOTE-WRITE` rows | the write rows need `--allow-remote-write` |
| `remote add`, `remote copy-id`, `tunnel start` | none | by hand; `tunnel status` and `stop` act on one recorded pid and need no `cloudflared` |

Several surfaces reach a remote while declaring only `docker`, so they are
invisible to the capability table and to the checklist: `db <sub> -e <remote>`
(`import` **writes** into the target), `snapshot <sub> -e <remote>`,
`open <target> -e <remote>`, `bootstrap -e <remote>`, `sandbox <sub>` and
`verify --remote <name>`.

### Verify remote commands against the sandbox

`govard sandbox up` runs a container that plays a production target over real
SSH and rsync, and `sandbox` resolves as a remote name while it runs. It is the
only honest end-to-end check of the remote commands without a real host, and
every write lands in a disposable container. The sandbox mirrors the project's
git repository, so the project must be a git repo with the work committed.

```bash
govard env up
govard sandbox up --profile full          # seeds once from the running origin env; see SANDBOX.md for traps
govard verify --phase 1 --json
govard verify --phase 2 --remote sandbox --allow-remote-write --json
govard verify --phase 3 --json            # add --allow-xdebug when the project enables Xdebug
govard verify --phase 4 --remote sandbox --json   # must record a restorable snapshot
govard verify --phase 5 --allow-destructive --json
govard sandbox down --purge
```

Order matters. The phase-2 rehearsal deploy is what gives the sandbox a release.
The clone-bootstrap row in the same phase runs before it, so on a fresh sandbox
it can fail on rsync until a release exists (run the rehearsal deploy once by
hand first). Several phase-4 rows also read a deployed target: `sync --db` plans, `remote exec`
and the DB probes fail on a fresh sandbox until a release exists. If the
rehearsal row is red, expect those rows to fail as a cascade and fix the deploy
first. A row's JSON `evidence_excerpt` keeps only the head of the output, so
re-run a red row by hand to see its tail. A deploy to a fresh sandbox also needs the framework's shared files
seeded (see the framework skill: `shared/.env` for Laravel, `shared/.env.local`
for Symfony, `shared/wp-config.php` for WordPress), or it fails at the migrate
step and keeps its lock.

### Remote commands the checklist does not run

Run these by hand against the sandbox (never a shared remote):

```bash
# Deploy lifecycle
govard deploy --remote sandbox --yes && govard deploy releases --remote sandbox
govard deploy --remote sandbox --yes --force        # a second release
govard deploy rollback --remote sandbox --yes       # back to the previous release
govard deploy unlock --remote sandbox --force       # after an interrupted run
govard deploy --remote sandbox --resume

# Data movement: plan first, then the real transfer
govard sync -s sandbox --db --plan && govard sync -s sandbox --db --yes
govard sync -s sandbox --file --path <dir> --yes
govard sync -s sandbox --media --plan               # confirm the media path per framework
govard bootstrap -e sandbox --plan

# Remote DB, snapshots and execution
govard db dump -e sandbox --local --no-pii --no-noise   # then grep the dump for user tables
govard db info -e sandbox
govard snapshot create <name> -e sandbox && govard snapshot list -e sandbox
govard remote exec sandbox -- hostname
```

What this exercise established, so a run can be judged against it:

- `deploy` on an unchanged revision is a no-op (exit 0, "already deployed");
  pass `--force` to rehearse. `--db-backup` is accepted or refused per
  framework recipe.
- `deploy --resume` continues the newest unfinished release but does not redo
  steps already marked done, so a fix that belongs to an earlier step needs
  `deploy unlock --force` and a fresh deploy. `unlock --force` clears the lock,
  not maintenance mode.
- `db dump -e <remote> --file <path>` writes the file **on the remote**; use
  `--local` to land it on the host. Verify `--no-pii` / `--no-noise` on the dump
  itself: the table-prefix filter is honored for remote dumps only on frameworks
  that detect a prefix, so a remote WordPress dump can still contain user tables.
- `snapshot create -e <remote>` stores the snapshot on the target, inside the
  release directory it resolved, so it disappears when that release is pruned.
- `sync --media` on a framework whose media directory does not exist on the
  target can print an rsync error and still exit 0: read the output, not only
  the exit code.
- `open <target> -e sandbox` does not resolve the synthetic remote (it accepts
  configured remotes only), and `sandbox ssh` opens an interactive shell only:
  use `remote exec sandbox -- <cmd>` for commands.
- Remote media paths differ per framework (`pub/media` on Magento 2,
  `public/media` on Laravel and Symfony, `wp-content/uploads` on WordPress):
  confirm the path in the plan before a media sync.

## Output contract

`--json` leaves **stdout as exactly one JSON document** (the `RunResult`); the
human verdict line goes to **stderr**. Without `--json` the per-item table is
printed by `pterm`, which writes to **stdout**, and only the verdict line goes to
stderr. Do not assume the human table is on stderr.

```json
{
  "govard_version": "<semver, or dev for a source build>",
  "project_sha": "<sha of the project checkout>",
  "project_id": "project-<16 hex>",
  "phase": "phase1",
  "mode": "run",
  "status": "passed",
  "items": [
    {"id":"P1-01","command":"govard doctor","duration_ms":799,"exit_code":0,
     "retries":0,"evidence_excerpt":"...","json_valid":false}
  ]
}
```

- `mode` is `plan` or `run`; `phase` is `phase1`..`phase5`, or `all` for a full run.
- `status` is recomputed from the items; a merged all-phase result is refreshed
  after every phase has run.
- `artifacts` appears only on items that recorded one (the snapshot item records
  the snapshot name the restore item later uses).
- Checklist items run **the invoked executable**, and `GOVARD_VERIFY_BIN` pins it
  explicitly, so a stale binary is never picked up by accident.
- `GOVARD_VERIFY_FAKE=1` makes every item return exit 0 (hermetic tests);
  `GOVARD_VERIFY_SHA` pins `project_sha`.

### Where the artifacts live

`<govard home>/verify-runs/<project-id>/<ISO>-phaseN.json`, where `<govard home>`
is `$GOVARD_HOME_DIR` or `~/.govard`, and `project-id` is `"project-"` plus a
hash of the canonical project path. The store is **project-scoped on purpose**:
flat files carry no identity and can never satisfy another project's gate.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | every item passed (and any gate was satisfied) |
| `1` | execution failure: a red item, or a gate block (`ErrNeedSnapshot`, `ErrNeedAllowDestructive`) |
| `2` | usage error (unknown flag, bad argument) |
| `3` | `CAPABILITY_MISSING`: a required capability (`docker`, `ssh`, `rsync`, `cloudflared`, ...) is absent |
| `4` | configuration error |

`verify` does **not** use `2` for a failed checklist: a run that completed with
red items is an execution failure. When the verdict is already on stderr,
`verify` suppresses the `--error-json` envelope so `--json --error-json` still
prints a single document.

## Workflow for agent

```
1. govard verify --phase 1 --json     -> parse JSON, render P1, fix if FAIL
2. govard verify --phase 2 --plan --json -> show the plan, ask confirm, then run with --remote sandbox --allow-remote-write (or a named remote without the write flag)
3. govard verify --phase 3 --json     (Magento-gated rows report as skipped elsewhere; the framework's declared items run instead)
4. govard verify --phase 4 --json     -> the snapshot item must record a restorable snapshot
5. gate: no phase-4 artifact (mode run, this project) -> block P5
6. govard verify --phase 5 --allow-destructive --json -> destructive last, after the snapshot
7. work through "Command coverage" for what no phase reaches, then "Remote commands the checklist does not run" against the sandbox
```

Evidence before claim: read `exit_code`, `duration_ms` and `status` from
`govard verify --json`, never claim PASS from the table alone. A red item is one
of: `govard bug`, `project drift`, `checklist bug`, `env flake`; classify it
before "fixing" the project.

## Retro

After a full run, collect `verify-runs/<project-id>/*.json` metrics
(`duration_ms`, `exit_code`, `retries`), classify the reds, and patch
`internal/verify/registry.go` for any checklist bug.

## Confirm the binary

The output contract above (exit `1` on a red run, the project-scoped store, the
restorable-snapshot gate, `GOVARD_VERIFY_BIN`) describes current govard. Older
builds exit **0** on a red run and resolve the snapshot gate against a flat global
`verify-runs/`. Confirm with `govard version` and a deliberate red before
trusting the contract.

See `govard/internal/verify/registry.go` for the base items and the
`RegistryFor` composition, `internal/engine/verify_items.go` for the
framework-declared item shape, `internal/verify/runner.go` for the gates and the
store, and `internal/verify/exec.go` for how items are launched.
