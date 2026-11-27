# Common workflows

The command sequences for the routine cases: after a pull, after a database sync, a
production deploy prep and a conditional-migrate deploy.

### After Pulling Code

```bash
govard tool magento setup:upgrade --keep-generated
govard tool magento setup:static-content:deploy -f
govard tool magento cache:flush
```

### After Database Sync

```bash
govard config auto   # re-applies local DB, search, Redis, Varnish, base URLs and developer mode
govard tool magento cache:flush
```

### Production Deployment Prep

```bash
govard tool magento maintenance:enable
govard tool magento setup:upgrade
govard tool magento setup:di:compile
govard tool magento setup:static-content:deploy -f --theme=Vendor/Theme
govard tool magento cache:flush
govard tool magento maintenance:disable
```

### Govard Deploy (conditional migrate)

`govard deploy <remote>` probes `setup:db:status` before the downtime block: exit 0 skips maintenance/workers/config-import/migrate, 1-2 runs them. `govard deploy plan <remote>` prints the resolved task list without executing anything (it needs a configured branch or `--branch`; the synthetic `sandbox` remote resolves the current branch by itself). See `govard-toolbox` (Deployment) for the full gate, verdict, and resume semantics.

Rehearsing it against `govard sandbox` (confirmed live on a real Magento project):

- **Seed needs an installed origin.** `sandbox up` dumps the running origin database and rewrites `core_config_data` base URLs. An origin with an empty database (no `bin/magento setup:install` yet) fails the seed with "Table ... core_config_data doesn't exist". Install the origin first.
- **Database profile.** `--profile full` follows `stack.db_version`. A MariaDB series that ships no `mysqladmin` binary (the newest series) never answers the readiness probe, so `up` fails with exit 127 on `mysqladmin ping`. Pass `--db mariadb:<older series>` for the rehearsal; a database volume written by another series is refused until `sandbox down --purge`.
- **Track source only.** The sandbox mirrors the git repository, so ignore `pub/static/*`, `generated/*`, `var/*`, `pub/media/*` and `app/etc/env.php`. A checkout that tracks built `pub/static` (dangling symlinks into the origin path) makes `build:assets` fail with "cannot be copied" warnings.
- **Shared files.** `app/etc/env.php` and `pub/media` are shared and come from the seed, not from git. `sandbox reset` removes them: afterwards `build:assets` fails with "The default website isn't defined" until `sandbox up --reseed` restores `env.php`.
- **Migrate step.** With an up-to-date schema the maintenance, worker-pause, config-import and migrate tasks are reported as skipped ("db up-to-date"). A pending schema change (for example a new module with `db_schema.xml`) runs maintenance, `setup:upgrade` (it completed on the sandbox without a search service), then maintenance off before the symlink swap. A failure after maintenance is enabled keeps the lock, the release directory and the maintenance flag: the live site answers 503 until `deploy --resume` completes or `deploy rollback` is run. `deploy unlock` alone does not clear maintenance, and refuses a young lock without `--force`.
- **`--db-backup`.** The task takes a plain `mariadb-dump`/`mysqldump` of the database named in `app/etc/env.php`, with the credentials in a private option file (stock Magento disables `setup:backup`, so it is not used). A target with no dump client is refused up front as a configuration error (exit `4`). The dump lands in the release's backup area; `deploy rollback --with-db` restores the dump recorded by the release being replaced and creates `var/backups` if it is missing. The flag is not remembered across `--resume`, repeat it.
- **Pulling files.** A pull does not follow symlinks that point outside the synced path (rsync `--safe-links`), so `sync -s <remote> --file --path app/etc` leaves the local `env.php` alone when the remote one is a symlink to a shared path. Add `--resolve-symlinks` only when you want the target's content copied.
- **Doc roots.** `remote exec <remote> -- <cmd>` fails with "cd: ... No such file or directory" until the first release is live on a `symlink` sandbox. `govard sandbox ssh -- <cmd>` runs one command without a tty and returns its exit status (a command without `--` is a usage error); `remote exec` still needs the first deploy.
- **Open targets.** `govard open admin|sftp -e sandbox` resolves the synthetic remote and uses the published port.
- **Local audits.** `audit run` refuses while `stack.features.xdebug` is on unless `--allow-xdebug` is passed; the lint rows report real findings when core code is tracked in the checkout.
