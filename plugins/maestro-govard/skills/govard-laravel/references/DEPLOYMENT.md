# Deployment

The deploy recipe this framework ships, the resolved pipeline, the preflight, the rollback
and the flags each step takes. The safety rule is stated in `SKILL.md`.

Laravel ships a deploy recipe, so `govard deploy` runs Laravel's own commands instead of the engine's neutral defaults. Watch before you run (the table below is the recipe; `govard deploy plan` is the source of truth):

```bash
govard deploy plan production          # the resolved pipeline, no connection, no Docker
govard deploy check production         # preflight over ssh
govard deploy production                # production change: ask before running
```

| Step | Command on the target |
|---|---|
| `build:vendors` | `composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist` |
| `build:frontend` | `frontend_command` inside each `frontend_dir`; an empty `frontend_dir` skips it |
| `app:configure` | `artisan storage:link` |
| `db:migrate` | `artisan migrate --force --no-interaction` |
| `maintenance:enable` / `disable` | `artisan down` / `artisan up`, run in the **served** release |
| `app:workers:pause` | with `worker_control: true`: `artisan queue:restart`, plus `horizon:terminate` if Horizon is installed |
| `app:cache:flush` | `artisan optimize:clear` then `artisan optimize`, then `runtime_reload_command` |
| `deploy:verify` (`app`) | `artisan db:show`, or `migrate:status` where `db:show` does not exist |
| `db:backup` | none: `--db-backup` is refused (exit 4) with a message naming the reason, instead of producing no dump |

`.env` is a shared **file** and `storage` a shared **directory** (the maintenance flag lives at `storage/framework/down`); `sync_paths` is `vendor` and `public/build` for an in-place docroot. Settings: `frontend_dir`, `frontend_command`, `worker_control`, `runtime_reload_command`.

- The caches are built **on the target**: `artisan optimize` writes `bootstrap/cache/config.php`, and once that file exists the process environment no longer overrides `.env`.
- Maintenance is guarded on `artisan` **and** `vendor/autoload.php` in the served path: on a first in-place deploy onto a fresh docroot both are absent, both steps exit 0, and **no window opens**, silently.
- `queue:restart` exits 0 whatever the cache store is, so `worker_control: true` only means something with a persistent store (Redis).
- **First deploy:** seed the target's `.env` first, or the release keeps the repository's copy, which names the local database. `deploy:shared` links an entry only when it already exists under the target's `shared/` at that moment, so `shared/.env` (and `shared/storage`, if you want the storage directory shared rather than living inside each release) must exist **before** the release is created. Without `shared/.env` the release has no `.env` at all and `artisan migrate` falls back to the sqlite defaults.
- **In artifact mode** the build steps do not run on the target, so the artifact must carry `vendor/` and `public/build`; `app:cache:flush` still runs on the target (`govard deploy build` makes the artifact, `govard deploy plan --build artifact --artifact-dir <dir>` shows the result).
- Rehearse against the disposable sandbox with `govard sandbox up` then `govard deploy --remote sandbox --yes`. A first run fails at `db:migrate` until the target has a `.env` (see above). The seed does not copy a Laravel `.env` or media into the sandbox, so write `shared/.env` yourself (as the deploy user, with the sandbox database host and credentials) before the first deploy; `govard sandbox reset` wipes it again. The target needs a working database login too: with `--profile full` the sandbox MariaDB refuses root to the deploy user (ERROR 1698) and there is no `sudo`, so create the database and a user with a password through the container (`docker exec <sandbox container> mariadb -e "CREATE DATABASE ...; CREATE USER ... IDENTIFIED BY '...'; GRANT ..."`), grant it for `127.0.0.1` and `localhost`, and put `DB_HOST=127.0.0.1`, `APP_ENV=production` and an `APP_KEY` in `shared/.env`. With those in place the first deploy runs every step through `db:migrate` and the site answers on the printed port; a second run of the same revision exits 0 with `already deployed`, and `deploy rollback` re-points `current`. `govard sandbox down` removes the sandbox. Package, extension and service needs are set via `deploy.settings.sandbox_*` in `.govard.yml`.
- **Recovering a first deploy that failed at `db:migrate`:** `--resume` does **not** pick up a `.env` seeded afterwards, because `deploy:shared` is already recorded as done for that release. Seed `shared/.env`, run `govard deploy unlock <remote> --force`, then run a fresh `govard deploy`; it creates a new release that links the file and migrates. The error line shows only the failed command, not artisan's own output: re-run `artisan migrate` in the release directory on the target to read the cause.
- **A failed migration leaves the live site in maintenance.** `maintenance:enable` runs in the served release before `db:migrate`, so when the migration fails the previous release keeps answering HTTP 503 and the lock is kept, until a later deploy succeeds (it runs `artisan up`) or you run `artisan up` there. `govard deploy unlock` without `--force` refuses a recent lock and names the holder.
- Redeploying the same revision is a no-op (`already deployed`, exit 0, `--force` to deploy again), so a second deploy needs a new commit. `govard deploy rollback` re-points the `current` symlink to the previous release and works against the sandbox; `rollback --with-db` is refused (exit 1) because the Laravel recipe records no dump, and `--db-backup` stays refused with exit 4.
- **Media:** `govard sync -s <remote> --media` reads `public/media`, which a stock Laravel app does not have, and a missing remote directory is reported by rsync while the command still exits 0. Use `--file --path <dir>` (for example `storage/app/public`) for what the project actually stores.

> **Deploy preflight:** `govard deploy plan [remote]` prints this pipeline without executing anything or connecting (add `--json` for machine-readable output). It needs the remote to have `deploy.branch` (or pass `--branch`/`--revision`/`--tag`), otherwise it exits 4. `govard deploy check [remote]` runs the connectivity and release-layout preflight and needs ssh. `deploy` needs no Docker, so it also runs in CI.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and worked config <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-9-laravel>.
