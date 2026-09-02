# Govard Verify — 5-Phase Executable Checklist

Replaces manual `docs/checklists/govard-checklist-template.md` tick with `govard verify` (Go) + `verify-runs/` JSON.

## When to use

User asks `govard verify / checklist / QA harness / 5-phase verification` — this reference is the checklist UX.

## Phases

P1 Preflight (7) → P2 Bootstrap & Env (14) → P3 Dev Loop (15) → P4 Sync/Safety (12) → P5 Destructive QA (8)

Total 56 items, migrated 1-1 from template. Framework-specific items use `When` filter (e.g. Hyva tailwind only for `magento2`).

## Commands

```bash
govard verify --plan --json                # dry-run 56 items, no side effects
govard verify --phase 1 --json             # P1 only
govard verify --phase 2 --plan --json      # P2 plan
govard verify --phase 4 --json             # must PASS P4-08 snapshot create
govard verify --phase 5 --allow-destructive --json  # destructive last
govard verify --json                       # all 1..5 (P5 needs P4-08 + --allow-destructive)
govard verify --phase 3 --checks profiler --json
govard verify --phase 3 --timeout auto --lint-jobs 4 --json
```

Flags mirror audit: `--lint-jobs`, `--timeout auto|0|<dur>`, `--checks lint,profiler`, `--allow-xdebug`, `--base <ref>`, `--remote <name>`, `--project <path>`. `--allow-destructive` alias `--yes`.

## Gates

- `P5` requires BOTH `P4-08 exit 0` in latest `~/.govard/verify-runs/*phase4.json` AND `--allow-destructive` — else exit 3 (`ErrNeedSnapshot` / `ErrNeedAllowDestructive`).
- `READ-ONLY-REMOTE` items (`bootstrap --clone --plan`, `sync --plan`, `remote test`) block without `--plan`.
- `DESTRUCTIVE-LOCAL` items (`env down -v`, `snapshot restore`, `lock drift`) only in P5.

## Outputs

`~/.govard/verify-runs/<ISO>-phaseN.json` (migrated from `checklist-runs/` on first run, no symlink):

```json
{ "govard_version": "1.68.0", "project_sha": "abc", "phase": "phase1", "items": [ {"id":"P1-01","command":"govard doctor","duration_ms":799,"exit_code":0,"retries":0,"evidence_excerpt":"..."} ] }
```

Human table to stderr when without `--json`.

Exit codes: `0` all PASS, `2` has FAIL, `3` gate block.

## Workflow for agent

```
1. govard verify --phase 1 --json → parse JSON, render P1, fix if FAIL
2. govard verify --phase 2 --plan --json → show plan, ask confirm, then --phase 2 --json
3. govard verify --phase 3 --json
4. govard verify --phase 4 --json → must PASS P4-08 snapshot
5. gate: if P4-08 exit !=0 → block P5, require snapshot
6. govard verify --phase 5 --allow-destructive --json → destructive last, after snapshot
7. full run done → 15-min retro Keep/Fix/Drop/Add, bump version, append Retro Log
```

Evidence before claim — read `exit_code` + `duration_ms` + `json_valid` from `govard verify --json`, never claim PASS alone.

## Retro

After every full run: collect `verify-runs/*.json` metrics (`duration_ms`, `exit_code`, `retries`), classify reds (`govard bug` / `project drift` / `checklist bug` / `env flake`), patch registry via `internal/verify/registry.go` + `make generate`, bump version.

## Generation

`docs/checklists/govard-checklist-template.md` is `go generate` from `internal/verify/registry.go` — do not hand-edit. Drift fails `make generate-check`.

See `govard/internal/verify/registry.go` for 56 items and `govard/internal/verify/runner.go` for gates.
