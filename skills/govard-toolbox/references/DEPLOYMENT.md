# Deployment

The plan/apply split, a rehearsal against a container playing the target, the rollback and
the bootstrap into a live remote. The safety rule is stated in `SKILL.md`.

Ships a git revision to a remote from `.govard.yml`.

A deploy, a rollback, `--with-db` and a bootstrap into a live remote change a running
site. State the remote, the exact command and the way back, then wait for an explicit
yes before running one; never pass `--yes` to approve a production target on the
user's behalf, and never chain a plan and an apply on one line. Read-only first,
always:

```bash
govard deploy plan production          # every task with what it runs, or why this mode skips it (no ssh, no rsync, no Docker)
govard deploy plan production --json   # same plan machine-readable (carries schema_version, per-step skip_reason, run_on, needs_migration); timestamp-free, so two runs can be diffed in CI. `check` has no --json
govard deploy check production         # connectivity, permissions, layout, and the strategy that layout implies (ssh)
govard deploy releases production      # what the target has (a positional remote or --remote <name>)
govard deploy status production        # which revision the target serves (no remote: every configured remote)
govard deploy production               # ask the human first: this is a production change
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
