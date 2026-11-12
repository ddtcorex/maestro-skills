# Deployment

The deploy recipe this framework ships, the resolved pipeline, the preflight, the rollback
and the flags each step takes. The safety rule is stated in `SKILL.md`.

WordPress ships a deploy recipe for the **classic layout only**: core files and `wp-content/` in the repository root. A Bedrock layout (core in `vendor/`, docroot `web/`) and a content-only checkout are not supported.

```bash
govard deploy plan production --branch main   # resolved pipeline: no connection, no Docker
govard deploy check production --branch main  # preflight over ssh
govard deploy production --branch main  # production change: ask before running
```

The remote needs a branch (`--branch`, `--revision`, `--tag`, or a configured `branch`) for `plan`, and a `deploy_path` (or an existing deploy layout) for `check`/`status`; otherwise they exit `4`. Add `--json` to `plan` for machine-readable output. See `govard deploy --help` for every flag.

| Step | Command on the target |
|---|---|
| `build:vendors` | `composer install ...` **only when** `composer.json` exists |
| `db:migrate` | `wp core update-db`, or `wp_upgrade()` through `wp-load.php` without wp-cli |
| `app:cache:flush` | `wp cache flush` + `wp rewrite flush --hard`, or the PHP equivalents |
| `maintenance:enable` / `disable` | writes/removes `.maintenance` and a marked `wp-content/maintenance.php` in the **served** path |
| `db:backup` / restore | `wp db export` / `wp db import` |
| `deploy:verify` (`app`) | `wp core is-installed`, or `is_blog_installed()` without wp-cli |

Three steps are **hybrids**: `wp` when the target has wp-cli, a `wp-load.php` PHP bootstrap when it does not.

- **Seed `shared/wp-config.php` before the first deploy.** `deploy:shared` links a shared entry only when it already exists, so an unseeded `shared/` leaves the release with the repository's `wp-config.php`, the one naming the development database. The first run fails at `db:migrate` ("Error establishing a database connection"), and the lock and release directory are kept. **Seeding afterwards does not repair that release:** `--resume` skips `deploy:shared` as already done (and `--from` does not re-run it), so link the shared file into the release by hand (`ln -sfn <deploy_path>/shared/wp-config.php <release>/wp-config.php`) before resuming, or start a fresh release. In one resumed run the unlinked release passed `db:migrate` and was **activated** before `app:cache:flush` failed with the same connection error, so an unseeded release can go live.
- `deploy:check` refuses a verify URL that redirects. A database copied from another environment keeps that environment's `siteurl`, so WordPress answers the verify URL with a 301 and the preflight stops. The sandbox seed rewrites `siteurl`/`home` to its own URL; for any other target point `siteurl`/`home` at the target URL (`wp option update`), or set `deploy.verify.follow_redirects: true`.
- Maintenance writes `time() + 86400`, not WordPress's own `time()`: a flag older than ten minutes expires, so a longer window would silently reopen the site mid-migration. The drop-in carries a marker, so a project's own maintenance page is kept. A deploy that fails after `maintenance:enable` leaves the flag and the lock behind; `--resume` (after `deploy unlock --force` if the lock is fresh) finishes the release and removes the flag.
- `--db-backup` uses `wp db export`/`wp db import` when the target has wp-cli, and otherwise a plain `mariadb-dump`/`mysqldump` that reads `wp-config.php` and hands the credentials to the client through a private option file (never on a command line). A target with none of the three is refused up front as a configuration error (exit `4`). Without the flag the `db:backup` row is reported as skipped, with the reason. With it the dump lands in `shared/backups/deploy/<release>/dump.sql`.
- `deploy rollback --with-db` restores the dump recorded by the release after the rollback target, and refuses (exit `1`) when that release has none, for example the newest one.
- `deploy unlock` refuses a fresh lock without `--force`. `deploy --resume` with nothing unfinished starts a new release, and says "already runs ... nothing to do" when the revision is already live (use `--force`).
- In artifact mode the only build step is the guarded `composer install`; the database steps still run on the target.
- Shared: `wp-config.php` (file), `wp-content/uploads` (dir); writable: `wp-content/{uploads,cache,upgrade,languages}`.

### Rehearsing on the sandbox

`govard sandbox up` gives a disposable target with wp-cli, a MySQL client, the usual PHP extensions and `mariadb` + `redis-server`, so a deploy can be rehearsed with `govard deploy --remote sandbox --yes`. The origin environment must be running to seed.

- A seed that fails half way is retried by the next `sandbox up`; the seed creates the deploy tree before it changes ownership, and the readiness, seed and import steps use the MariaDB client names (`mariadb-admin`, `mariadb`, `mariadb-dump`) when the image has no `mysql*` ones.
- The seed copies the database but writes no `wp-config.php` and no shared tree for WordPress. Seed `shared/wp-config.php` yourself (the sandbox database user keeps the origin credentials; set `DB_HOST` to `localhost`), over `ssh -p <port> -i .govard/sandbox/id_ed25519 deployer@127.0.0.1`.
- `sandbox ssh` is interactive; `sandbox ssh -- <cmd>` runs one command and returns its exit status. `govard remote exec sandbox -- <cmd>` is the deploy-aware alternative, which fails on the dangling `current` until the first deploy and again after `sandbox reset` (reset also wipes `shared/`, so re-seed `wp-config.php`).
- `govard remote exec`, `remote test`, `deploy plan|check|status|releases|rollback|unlock`, `db dump -e sandbox`, `snapshot create|list -e sandbox` and real `sync -s sandbox` (`--db`, `--file --path wp-content/themes`, `--media` which maps to `wp-content/uploads`) all work against it. `sync -s sandbox --db` needs a deployed `wp-config.php` on the target to detect credentials.
- `snapshot create -e <remote>` stores under `<deploy path>/shared/.govard/snapshots` when the remote has a deploy layout (`releases/`, `shared/`, `current`), so a deploy does not leave it behind; other remotes keep `<remote path>/.govard/snapshots` and get a warning. `list`, `restore`, `delete` and `pull` read both locations. `snapshot restore` asks for confirmation; pass `-y` without a TTY.
- `govard open admin` opens `/wp-admin`, and `open admin -e sandbox` resolves the synthetic remote and uses its published port.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-11-wordpress>.
