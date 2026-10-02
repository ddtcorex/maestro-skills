# Govard Verify — 5-Phase Executable Checklist

`govard verify` is the executable form of the old manual checklist: a base
registry of 60 items across 5 phases (`internal/verify/registry.go`) plus the
items each framework definition declares for itself, with one JSON artifact per
phase. There is no `docs/checklists/govard-checklist-template.md` in the repo —
this file is the reference for the behaviour that exists.

## When to use

User asks `govard verify / checklist / QA harness / 5-phase verification` — this
reference is the checklist UX, its output contract, and what it does **not**
cover (see "Remote coverage" — it is much narrower than it looks).

## Phases

P1 Preflight (7) → P2 Bootstrap & Env (14) → P3 Dev Loop (15) → P4 Sync/Safety (16) → P5 Destructive QA (8)

Total 60 base items. Phase sizes are fixed in the registry, and `govard verify
--help` is compared against them by a test, so the two cannot drift; `make
generate` does not touch them (it regenerates
`internal/frameworks/all_generated.go`).

## Framework coverage — one Magento predicate plus per-framework items

Two mechanisms decide what a run asks for.

**1. `registry.go` gates 10 of the 60 base items on the single `isMagento2`
predicate.** An unmet `When` is a **reported** skip: the row stays in the phase's
JSON with `skipped: true` and a `skip_reason` naming the framework gate
(`framework gate: P3-01 is framework-specific and this project is laravel`). A
missing row is worse than a red, because a red is evidence.

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

- A **Laravel, Symfony or WordPress** project executes **50** of the 60 base
  items. `P3-01` is titled "cache:flush + cache:status **(or framework equiv)**"
  but its `When: isMagento2` means the framework equivalent never runs there —
  that dev loop is covered by the declared items in section 2 instead. P3-07
  (`phpstan`/`phpcs --help`), P3-08 (Xdebug), P3-10…P3-12 (audit) and
  P3-13…P3-15 are framework-neutral.
- There is still **no `isHyva`, `isLaravel`, `isWordPress` or `isSymfony`
  predicate**. P2-09 is titled "(Hyva only)" but is gated on `isMagento2`, which
  is how it came to run `npm install` inside a **Luma** project (left a stray
  `web/tailwind/package-lock.json`).
- `P5-03` substitutes `cfg.Framework` for `{{FRAMEWORK}}`, so it does adapt — but
  the title's `--framework-version {{VERSION}}` is never passed.

**2. Every framework declares its own `govard tool` items.** An
`engine.VerifyToolItem` is data the framework owns — `{ID, Phase, Title, Tool,
Args}` — and `frameworks.Register` projects it into the engine, so
`internal/verify` still names no framework. `RegistryFor(cfg)` appends
`VerifyToolItems(cfg.Framework)` to the base registry, which is why the composed
size is always `len(Registry) + len(declared)` and why `RunPhase` filters over
`RegistryFor`, never over `Registry`:

| Framework | Declared items | What they run |
|---|---|---|
| `magento2` | `P5-MAG-01` | `magento setup:db:status` after restore |
| `laravel` | `P3-LAR-01..03`, `P5-LAR-01` | `artisan --version`, `migrate:status`, `cache:clear`, `migrate:status` after restore |
| `symfony` | `P3-SYM-01..03`, `P5-SYM-01` | `symfony --version`, `cache:clear`, `debug:router`, `cache:clear` after restore |
| `wordpress` | `P3-WP-01..03`, `P5-WP-01` | `wp core version`, `option get siteurl`, `cache flush`, `db check` after restore |

Executed totals: **Magento 2 = 61** (60 base + `P5-MAG-01`), **Laravel, Symfony
and WordPress = 54** (50 base + 4). `mageos` inherits magento2's declaration
through the definition clone, and a framework that declares nothing composes
exactly the base registry. Framework ids must not collide with a static id — the
composed list is appended, never de-duplicated — and framework items carry
`Precond: "P2-01 up"` with no `Guard`.

This is what closed the old "non-Magento runs verify the environment only" gap.
The per-framework CLIs (`artisan`, `wp`, `symfony`) were always reachable through
`govard tool`; a framework now asks for them at register time instead of the core
registry hard-coding a list of frameworks. Adding a fifth framework means adding
a `VerifyToolItems` entry to its definition — no change under `internal/verify`.

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
`opts.LintJobs` and `opts.Timeout` are threaded into the argv of the items that run
the lint check (P3-10, P3-11, P3-13, P3-14, P5-04), and each records the resolved
argv as the first line of its evidence excerpt. Two deliberate details:
`--lint-jobs` is **not** forwarded at verify's own default (4), so `audit run`
keeps its host-tuned worker count — the literal `4` is the one inexpressible value;
and `--timeout` falls back per item (`auto` for the phase-3 lint rows, `0` for
P5-04's no-deadline re-lint). `--checks lint,profiler,integrity` filters on the
check an item declares (`Item.Checks`); a row that declares none is not
check-specific and always runs, and an excluded row stays as a `skipped` row
naming the selection. An unknown check name is a **usage error (exit 2)**, checked
against the same list `audit run --checks` accepts. An out-of-range `--phase` is an
execution error (exit 1); an unknown flag is a usage error (exit 2). `--plan` is
a true dry run: `RunPhase` never calls an item's `Run` in plan mode and records
`Evidence{ExitCode: 0, OutputExcerpt: "plan: <title>"}` — but note that a guarded row
is marked skipped **before** the plan stub, so plan mode still reports the gate.

An item never picks a remote for itself. Every remote-naming item takes the name
from `--remote` and nothing else, and a run without one **skips** those rows with
`no --remote named: this item contacts a remote` — there is no `staging` fallback
left in the registry. Pass `--remote` explicitly to run them; the two rows that
write through a remote also need `--allow-remote-write`.

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
- **`Item.Guard` is enforced, in four values.** `RunPhase` acts on the label before
  the plan stub, so a gated item is one `skipped` row in every mode and its `Run` is
  never reached. A row that would write through a remote needs
  `--allow-remote-write`; a remote row without a named remote skips as above.
  `Item.Precond` is the half that stays documentation — it records what a row
  assumes and is deliberately **not** the skip reason, because a precondition
  string reads like a prior step while the gate that fires is a framework
  predicate. `DESTRUCTIVE-LOCAL` is still confined to phase 5 by the phase gate
  above rather than by its label. A fence pins every row's label to what every
  invocation of that row actually does, so a label cannot drift from its argv.

### Items known to be un-runnable

Report these as checklist defects, not project drift:

| Item | Why it is permanently red |
|---|---|
| P5-07 | `deploy:mode:show` + `cache:flush` only — a completed wipe/restore still leaves a schema-current but unreconciled DB; a `setup:upgrade` belongs in this phase |

Rows that used to be here and are not any more, each with the shape of the fix worth
recognising: a command word the tree does not know (`P4-10` ran `tool redis-cli
ping`, whose group has no `RunE`, so cobra printed help and exited **0** — a green
from a page nobody ran); a flag the command does not declare (`P2-03` passed
`env up --build`); a tool shim that is not registered (`P2-13`/`P4-11` shelled out
to `tool curl` and now dial the site themselves, reporting the scheme they used);
a placeholder no item ever substituted (`P3-15` now creates its own container-free
`--checks integrity` session and decodes both ids); a title promising a fallback
the argv never performed (`P2-09` titled Hyva-only while gated on `isMagento2` —
it now gates on the Tailwind manifest, so a Luma project skips and writes nothing);
and items that needed structure they had no way to find (`P3-13`/`P3-14` now
discover a module under `app/code` and audit it with `audit run --path`).

`P4-05`, `P4-06` and `P4-07` titled 3–4 invocations while running 1; their titles have
been corrected since.

## Remote coverage

`govard capabilities --json` reports **18** command rows whose `requires`
contains `ssh`, `rsync` or `cloudflared`. The checklist covers **8** of them —
four read-only probe items in phase 4 close the deploy read surface:

| Command | requires | Item | Note |
|---|---|---|---|
| `govard remote test` | ssh,rsync | P4-01 | one remote, not the 4 the title claims |
| `govard remote audit tail` | ssh,rsync | P4-02 | |
| `govard remote audit stats` | ssh,rsync | P4-02 | |
| `govard sync` | ssh,rsync | P4-03…P4-07 | `--plan` only; never a real transfer |
| `govard deploy` | ssh,rsync | P4-13 | `deploy plan --json` only — renders the task plan without connecting |
| `govard deploy status` | ssh | P4-14 | human output on purpose: `deploy status --json` exits **0** on an unreachable remote, so the `--json` form is a false green |
| `govard deploy releases` | ssh | P4-15 | `--json` |
| `govard remote list` | ssh,rsync | P4-16 | the inventory P4-01 silently assumes |
| `govard deploy check` | ssh | — | **none** — connects, and leaves nothing behind (#468) |
| `govard deploy rollback` | ssh,rsync | — | **none** |
| `govard deploy unlock` | ssh | — | **none** |
| `govard remote add` | ssh,rsync | — | **none** |
| `govard remote copy-id` | ssh,rsync | — | **none** |
| `govard remote exec` | ssh,rsync | — | **none** |
| `govard tunnel`, `tunnel start`, `tunnel status`, `tunnel stop` | cloudflared | — | **none of the four** |

The four new items carry `Guard: "READ-ONLY-REMOTE"` like P4-01…P4-07, and that
label is enforced by the runner (see "Gates"). Deploy
**writes** (`deploy`, `deploy rollback`, `deploy unlock`) and the whole **tunnel**
surface stay absent: 10 of the 18 rows, and the surfaces where a mistake is
expensive.

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
surprise as a new bug. Lines marked `covered by` now run as checklist items, so
what stays here is the write half and the surfaces the checklist deliberately
refuses to touch.

```bash
# Deploy lifecycle — read the plan first, never write to a shared remote
govard deploy plan   --remote <r> --build auto     # covered by P4-13 (the item adds --json)
govard deploy check  --remote <r>                  # leaves nothing behind: its mv -T probe creates .dep and removes it (#468)
govard deploy status --remote <r>                  # covered by P4-14 (lock holder + live release)
govard deploy unlock --remote <r> --help           # recovery path exists at all
govard deploy releases --remote <r>                # covered by P4-15 (what rollback could target)
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
# remote list is covered by P4-16; remote test by P4-01; remote exec by nothing
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
3. govard verify --phase 3 --json                     (P3-01…P3-06, P3-09 are Magento 2 only;
                                                      Laravel/Symfony/WordPress get their own P3-xxx items)
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

See `govard/internal/verify/registry.go` for the 60 base items and the
`RegistryFor` composition, `internal/engine/verify_items.go` for the
framework-declared item shape, `govard/internal/verify/runner.go` for the gates
and the store, and `govard/internal/verify/exec.go` for how items are launched.
