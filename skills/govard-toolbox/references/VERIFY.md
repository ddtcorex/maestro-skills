# Govard Verify — 5-Phase Executable Checklist

`govard verify` is the executable form of the old manual checklist: 56 registry
items across 5 phases, driven by `internal/verify/registry.go`, with one JSON
artifact per phase. There is no `docs/checklists/govard-checklist-template.md`
in the repo — this file is the reference for the behaviour that exists.

## When to use

User asks `govard verify / checklist / QA harness / 5-phase verification` — this
reference is the checklist UX, its output contract, and what it does **not**
cover (see "Remote coverage" — it is much narrower than it looks).

## Phases

P1 Preflight (7) → P2 Bootstrap & Env (14) → P3 Dev Loop (15) → P4 Sync/Safety (12) → P5 Destructive QA (8)

Total 56 items. Phase sizes are fixed in the registry; `make generate` does not
touch them (it regenerates `internal/frameworks/all_generated.go`).

## Framework coverage — Magento 2 only

`registry.go` defines exactly **one** predicate, `isMagento2`. It gates **10** of
the 56 items:

| Gated item | What is lost on the other frameworks |
|---|---|
| P2-09 | npm/tailwind build in the Hyvä theme |
| P2-11 | `magento --version`, `module:status` |
| P3-01 | cache flush + status |
| P3-02 | `setup:upgrade` |
| P3-03 | `setup:di:compile` |
| P3-04 | `setup:static-content:deploy` |
| P3-05 | `indexer:reindex` |
| P3-06 | `cron:run` |
| P3-09 | `frontend start/stop` (Hyvä/Luma live reload) |
| P5-07 | `deploy:mode:show` + `cache:flush` after restore |

Consequences to state plainly rather than paper over:

- A **Laravel, Symfony or WordPress** project runs **46** items. Nothing is
  substituted for the 10 skipped ones: `P3-01` is titled
  "cache:flush + cache:status **(or framework equiv)**" but its `When: isMagento2`
  means the framework equivalent never runs, so a non-Magento project gets **no**
  cache/setup/migration/indexer step at all. P3-07 (`phpstan`/`phpcs --help`),
  P3-08 (Xdebug), P3-10…P3-12 (audit) and P3-13…P3-15 are framework-neutral.
- There is **no `isHyva`, `isLaravel`, `isWordPress` or `isSymfony` predicate**.
  P2-09 is titled "(Hyva only)" but is gated on `isMagento2`, which is how it
  came to run `npm install` inside a **Luma** project (left a stray
  `web/tailwind/package-lock.json`).
- `P5-03` substitutes `cfg.Framework` for `{{FRAMEWORK}}`, so it does adapt — but
  the title's `--framework-version {{VERSION}}` is never passed.

Treat non-Magento `verify` runs as **P1 + P2 + env/audit only**: they verify the
Govard environment and the audit pipeline, not the framework's dev loop.

The gap is cheap to close: `govard tool` already ships the per-framework CLIs
(`artisan`, `wp`, `symfony`, `composer`, `npm`, `php`), so a Laravel
`artisan migrate` or `artisan cache:clear`, a WordPress `wp cache flush`, and a
Symfony `cache:clear` are all reachable today — the registry simply never asks
for them.

### Remote hooks per framework

The deploy engine is framework-owned (`internal/frameworks/<fw>/deploy_recipe.go`),
and the hooks a remote verification would lean on are unevenly implemented:

| Hook | Magento 2 | Laravel | Symfony | WordPress |
|---|---|---|---|---|
| `TaskVendors` | ✔ | ✔ | ✔ | ✔ (only when the project has composer) |
| `TaskFrontend` | ✔ | ✔ | ✔ | ✔ |
| `TaskAssets` | — | — | ✔ | — |
| `TaskDBMigrate` | `setup:upgrade` | `artisan migrate` | Doctrine migrations | core DB upgrade |
| `TaskMaintenanceEnable/Disable` | ✔ | ✔ (`artisan down/up`) | **not filled** | ✔ (`.maintenance` + drop-in) |
| `TaskWorkersPause/Resume` | cron + consumers | queue workers | Messenger consumers | — |
| `TaskAppCacheFlush` | ✔ | ✔ | container cache | object cache + rewrite rules |
| `TaskDBBackup` | ✔ | **—** | **—** | ✔ (`wp db export`) |
| `MigrationProbe` | ✔ | — | — | — |
| `VerifyRejectPaths` | ✔ | — | — | — |
| `SandboxSeed` | ✔ | — | — | — |
| `TablePrefixDetector` | ✔ | — | — | **—** |
| `ResolveRemoteAdminPath` | ✔ (probes the target) | — | — | — |
| `Paths.RemoteMedia` | `pub/media` | `public/media` | `public/media` | `wp-content/uploads` |

Two of these are **verification gaps**, not deploy bugs:

- **Symfony has no maintenance window** in its recipe, so a release swap and its
  Doctrine migration are visible to live traffic. Verify deliberately.
- **WordPress has no `TablePrefixDetector`** (only magento2, magento1, mageos,
  openmage and prestashop register one), so `wp-config.php`'s `$table_prefix` is
  never read. `config.TablePrefix` stays empty
  (`internal/engine/config_normalize.go:34-35`), and `buildIgnoredTableArgs`
  (`internal/cmd/db_credentials.go:548`) then builds `--ignore-table=<db>.<table>`
  with **no prefix** while the WordPress manifest lists prefix-less names
  (`options_bak`, `commentmeta`, `users`, …). On a stock WordPress (prefix
  `wp_`) `--no-noise` / `--no-pii` therefore **match nothing**, for local *and*
  remote dumps. Wordpress media/ignore lists are correct; only the prefix is
  missing. Set `table_prefix: wp_` in `.govard.yml` until a detector lands.
- `DefaultAdminPath` is `admin` for every framework that does not override it
  (`internal/conventions/credentials.go:7`); only magento2 probes the target and
  only `emdash` declares a static default. So `govard open admin -e <remote>`
  on **WordPress** opens `/admin`, not `/wp-admin` — verify the admin route by
  hand.

## Commands

```bash
govard verify --plan --json                # dry run: every item exits 0, nothing runs
govard verify --phase 1 --json             # P1 only
govard verify --phase 2 --plan --json      # P2 plan
govard verify --phase 4 --json             # must PASS P4-08 (snapshot create)
govard verify --phase 5 --allow-destructive --json  # destructive last
govard verify --json                       # all 1..5 (P5 needs the gate + --allow-destructive)
govard verify --phase 3 --checks profiler --json
govard verify --phase 3 --timeout auto --lint-jobs 4 --json
```

Flags: `--phase 0..5` (0 = all), `--json`, `--plan`, `--allow-destructive`
(alias `--yes`), `--allow-xdebug`, `--lint-jobs`, `--timeout auto|0|<dur>`,
`--checks lint,profiler`, `--base <ref>`, `--remote <name>`, `--project <path>`.

**Only `--base`, `--allow-xdebug` and `--allow-destructive` change what runs.**
`--checks`, `--lint-jobs` and `--timeout` are accepted and ignored — `opts.Checks`,
`opts.LintJobs` and `opts.Timeout` have zero readers, and the items hardcode
`--checks lint`, `--lint-jobs 4` and `--timeout auto|0` — so `--checks profiler`
selects nothing (P3-12 is unconditional). An out-of-range `--phase` is an
execution error (exit 1); an unknown flag is a usage error (exit 2). `--plan` is
a true dry run: `RunPhase` never calls an item's `Run` in plan mode and records
`Evidence{ExitCode: 0, OutputExcerpt: "plan: <title>"}`.

`{{REMOTE}}` in an item **defaults to the literal `staging`** when `--remote` is
not given, and `ResolveAutoRemote` separately prefers `staging` then `dev`. On a
project with a real company remote, `govard verify --phase 2` without
`--remote sandbox` will pull a live dump from it (P2-05 / P2-08 are non-plan
bootstraps). Always pass `--remote` explicitly.

## Gates

- **Phase 5** needs both, or the command exits **1** with `ErrNeedSnapshot` /
  `ErrNeedAllowDestructive` (with `--json` the block is reported as a
  `{"error": "..."}` document on stdout):
  1. `--allow-destructive`, and
  2. a **non-plan** `*-phase4.json` artifact **for the same project** whose P4-08
     recorded a snapshot that is still on disk **and genuinely restorable** —
     metadata `db: true` *and* a `db.sql.gz` that decompresses to ≥ 1 byte.
     `--plan` bypasses the gate entirely, so `verify --phase 5 --plan` is green
     with no snapshot.
- **`READ-ONLY-REMOTE` / `DESTRUCTIVE-LOCAL` are labels, not enforcement.**
  `Item.Guard` and `Item.Precond` are populated for all 56 items and have **zero
  non-test readers**: nothing blocks a non-`--plan` run of a remote item, and
  nothing confines a `DESTRUCTIVE-LOCAL` item to P5. The only guard that is
  enforced is the `--allow-destructive` flag above. Because
  `P5-03` carried `READ-ONLY-REMOTE` with a `--plan` title and still reached a
  working tree, treat every label as documentation of intent.

### Items known to be un-runnable

Report these as checklist defects, not project drift:

| Item | Why it is permanently red |
|---|---|
| P2-03 | `govard env up --build` — unknown flag `--build` (exit 2) |
| P2-09 | titled Hyvä-only, gated `isMagento2`; no `isHyva` predicate exists |
| P2-13, P4-11 | `govard tool curl …` — `curl` is not a registered `tool` subcommand (the real ones are `artisan`, `composer`, `magento`, `npm`, `php`, `symfony`, `wp`, …) |
| P3-13, P3-14 | need a custom module / `/tmp/govard-audit-standalone`, no `When` filter |
| P3-15 | `audit status --session <id>` — the `<id>` placeholder is never substituted |
| P4-05, P4-06, P4-07 | titles promise 3–4 invocations; each runs exactly 1. P4-07's `{{REMOTE_STAGING}}` title implies a fixed target but the body uses `--remote` like every other item |
| P5-07 | `deploy:mode:show` + `cache:flush` only — a completed wipe/restore still leaves a schema-current but unreconciled DB; a `setup:upgrade` belongs in this phase |

## Remote coverage

`govard capabilities --json` reports **18** command rows whose `requires`
contains `ssh`, `rsync` or `cloudflared`. The checklist covers **4** of them.

| Command | requires | Item | Note |
|---|---|---|---|
| `govard remote test` | ssh,rsync | P4-01 | one remote, not the 4 the title claims |
| `govard remote audit tail` | ssh,rsync | P4-02 | |
| `govard remote audit stats` | ssh,rsync | P4-02 | |
| `govard sync` | ssh,rsync | P4-03…P4-07 | `--plan` only; never a real transfer |
| `govard deploy` | ssh,rsync | — | **none** |
| `govard deploy check` | ssh | — | **none** |
| `govard deploy releases` | ssh | — | **none** |
| `govard deploy rollback` | ssh,rsync | — | **none** |
| `govard deploy status` | ssh | — | **none** |
| `govard deploy unlock` | ssh | — | **none** |
| `govard remote add` | ssh,rsync | — | **none** |
| `govard remote copy-id` | ssh,rsync | — | **none** |
| `govard remote exec` | ssh,rsync | — | **none** |
| `govard remote list` | ssh,rsync | — | **none** (P4-01 assumes it) |
| `govard tunnel`, `tunnel start`, `tunnel status`, `tunnel stop` | cloudflared | — | **none of the four** |

The whole **deploy** and **tunnel** surfaces are absent — 10 of the 18 rows, and
both are the surfaces where a mistake is expensive.

Six more surfaces reach a remote while declaring only `docker`, so they are
invisible to the capability table *and* to the checklist:

| Surface | Remote interaction | Checklist |
|---|---|---|
| `govard db <sub> -e <remote>` | dump/query/info/connect/top over ssh; `import` **writes** into the target | `-e` never exercised |
| `govard snapshot <sub> -e <remote>` | create/list/restore/export/delete over ssh | none |
| `govard open <target> -e <remote>` | admin / sftp / shell URL on the target | none |
| `govard bootstrap -e <remote>` | P2-04…P2-08 | plan mode only; P2-05/P2-08 are non-plan |
| `govard sandbox <sub>` | materializes the synthetic `sandbox` remote | none |
| `govard verify --remote <name>` | threads the remote into the items above | the flag itself |

### Required verifications the checklist does not perform

Run these by hand (or add them to the registry) before trusting a remote
workflow. Each maps to a filed defect — read the issue before reporting a
surprise as a new bug.

```bash
# Deploy lifecycle — read the plan first, never write to a shared remote
govard deploy plan   --remote <r> --build auto     # 25 tasks, no connection
govard deploy check  --remote <r>                  # NOT read-only: creates deploy_path (#468)
govard deploy status --remote <r>                  # lock holder + live release
govard deploy unlock --remote <r> --help           # recovery path exists at all
govard deploy releases --remote <r>                # what rollback could target
govard deploy rollback --remote <r> --help         # and what it would restore

# Sandbox rehearsal
govard sandbox up --profile full --docroot symlink
govard deploy --remote sandbox --yes               # the only end-to-end rehearsal
govard sandbox down --purge                        # container, image, key, mirror

# Remote DB and snapshots
govard db dump   -e <r> --file /tmp/r.sql.gz --no-pii   # check the prefix filter (#471)
govard db info   -e <r>                                  # and `db import -e <r>` protection (#466)
govard snapshot create <name> -e <r> && govard snapshot list -e <r>
govard snapshot restore <name> -e <r>                    # restore is the risky half

# Remote execution and tunnel
govard remote list && govard remote test <r> && govard remote exec <r> -- hostname
govard tunnel status && govard tunnel start && govard tunnel stop   # stop pkills every cloudflared (#469)

# Files and framework routes
govard sync -s <r> --db --no-noise --plan && govard sync -s <r> --file --path pub/media --plan
govard open admin -e <r>        # Magento probes the route; WordPress/Laravel/Symfony do not
govard open sftp  -e <r>        # confirm the media path per framework (table above)
```

### Known-bad spots in the remote surface

Do not re-file these; they are open issues:

| Issue | Behaviour |
|---|---|
| [#466](https://github.com/ddtcorex/govard/issues/466) | db write protection is inverted: reads refused on a protected remote, `db import -e production` allowed |
| [#467](https://github.com/ddtcorex/govard/issues/467) | `remote test` (and `db *-e`, `open *-e`, `sync`) offer to write the local public key into the target's `authorized_keys`, default Yes |
| [#468](https://github.com/ddtcorex/govard/issues/468) | `deploy check` is not read-only: `mkdir -p <deploy_path>` on the target, plus `.dep/` probe entries |
| [#469](https://github.com/ddtcorex/govard/issues/469) | `tunnel stop` runs `pkill cloudflared` — every tunnel on the host, not just the project's |
| [#470](https://github.com/ddtcorex/govard/issues/470) | `sync -e sandbox` / `bootstrap -e sandbox` fail: `ResolveAutoRemote` has no synthetic branch |
| [#471](https://github.com/ddtcorex/govard/issues/471) | the sandbox cannot be configured: `remote add sandbox` refused, hand-written block shadowed, no `sandbox_php` / credential hook |
| [#472](https://github.com/ddtcorex/govard/issues/472) | `--checks`, `--lint-jobs` and `--timeout` parse and then do nothing |

## Output contract

`--json` leaves **stdout as exactly one JSON document** (the `RunResult`); the
human verdict line goes to **stderr**. Without `--json` the per-item table is
printed by `pterm`, which writes to **stdout**, and only the verdict line goes to
stderr. Do not assume the human table is on stderr.

```json
{
  "govard_version": "1.77.0",
  "project_sha": "885c165dbff78fdc579d53ad91dd7870d18d8e2f",
  "project_id": "project-35322aefe766ba6b",
  "phase": "phase1",
  "mode": "run",
  "status": "passed",
  "items": [
    {"id":"P1-01","command":"govard doctor","duration_ms":799,"exit_code":0,
     "retries":0,"evidence_excerpt":"...","json_valid":false}
  ]
}
```

- `mode` is `plan` or `run`; `phase` is `phase1`…`phase5`, or `all` for a full run.
- `status` is recomputed from the items; a merged all-phase result is refreshed
  after every phase has run.
- `artifacts` appears only on items that recorded one (P4-08 records the snapshot
  name P5-05 then restores).
- A source build reports `govard_version: "dev"`; a release writes its semver.
- Checklist items run **the invoked executable**, and `GOVARD_VERIFY_BIN` pins it
  explicitly. Prepending a build dir to `PATH` is no longer needed — but for the
  same reason, a stale `bin/govard` will not be picked up by accident either.
- `GOVARD_VERIFY_FAKE=1` makes every item return exit 0 (hermetic tests);
  `GOVARD_VERIFY_SHA` pins `project_sha`.

### Where the artifacts live

`<govard home>/verify-runs/<project-id>/<ISO>-phaseN.json`, where `<govard home>`
is `$GOVARD_HOME_DIR` or `~/.govard`, and
`project-id` = `"project-" + sha256(canonical project path)[:16]`. The store is
**project-scoped on purpose**: pre-scoping flat files carry no identity and can
never satisfy another project's gate. Legacy flat files under `verify-runs/` are
read once to migrate, not to satisfy a gate.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | every item passed (and any gate was satisfied) |
| `1` | execution failure — a red item, `ErrItemsFailed`, or a gate block (`ErrNeedSnapshot`, `ErrNeedAllowDestructive`) |
| `2` | usage error (unknown flag / bad argument) |
| `3` | `CAPABILITY_MISSING` — a required capability (`docker`, `ssh`, `rsync`, `cloudflared`, …) is absent |
| `4` | configuration error |

Codes are frozen in `internal/cli/exit.go`. `verify` does **not** use `2` for a
failed checklist — a run that completed with red items is an execution failure.
When the verdict is already on stderr, `verify` suppresses the `--error-json`
envelope so `--json --error-json` still prints a single document.

## Workflow for agent

```
1. govard verify --phase 1 --json → parse JSON, render P1, fix if FAIL
2. govard verify --phase 2 --plan --json → show the plan, ask confirm, then --phase 2 --remote <r> --json
3. govard verify --phase 3 --json                     (Magento 2 only for P3-01…P3-06, P3-09)
4. govard verify --phase 4 --json → P4-08 must record a restorable snapshot
5. gate: no phase-4 artifact (mode run, this project) → block P5
6. govard verify --phase 5 --allow-destructive --json → destructive last, after the snapshot
7. run the "Required verifications" recipes for the remote surfaces no phase covers
8. full run done → 15-min retro, classify reds, patch internal/verify/registry.go
```

Evidence before claim — read `exit_code`, `duration_ms` and `status` from
`govard verify --json`, never claim PASS from the table alone. A red item is one
of: `govard bug`, `project drift`, `checklist bug`, `env flake`; classify it
before "fixing" the project.

## Retro

After every full run: collect `verify-runs/<project-id>/*.json` metrics
(`duration_ms`, `exit_code`, `retries`), classify the reds, patch the registry in
`internal/verify/registry.go`, bump the version, append the Retro Log.

## Version note

The output contract above (exit `1` on a red run, the project-scoped store, the
restorable-snapshot gate, `GOVARD_VERIFY_BIN`, the "dead label" caveat) is the
hardened behaviour. Earlier 1.7x builds exit **0** on a red run, resolve the
snapshot gate against a flat global `verify-runs/`, and run items through the
`PATH` `govard`. Confirm the binary before trusting the contract:

```bash
govard capabilities --json | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["commands"]),"command rows")'
```

See `govard/internal/verify/registry.go` for the 56 items,
`govard/internal/verify/runner.go` for the gates and the store, and
`govard/internal/verify/exec.go` for how items are launched.
