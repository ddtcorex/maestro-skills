# Deployment

The deploy recipe this framework ships, the resolved pipeline, the preflight, the rollback
and the flags each step takes. The safety rule is stated in `SKILL.md`.

Symfony ships a deploy recipe. Its point is undoing Composer's `auto-scripts`, which run `cache:clear` and `assets:install` in the wrong place: both belong on the target, not on whichever machine ran `composer install`.

```bash
govard deploy plan production --branch main   # resolved pipeline, no connection, no Docker
govard deploy check production --branch main  # preflight over ssh
govard deploy production                # production change: ask before running
```

The remote needs a `branch` (or pass `--branch`/`--revision`/`--tag`) and a `deploy_path` (`remotes.<name>.deploy.deploy_path`), otherwise plan/check exit `4` (configuration). Run `govard deploy plan` to see the exact commands; the Symfony-specific tasks are:

| Step | Command on the target |
|---|---|
| `build:vendors` | `composer install --no-dev --optimize-autoloader ... --no-scripts` |
| `build:assets` | `bin/console assets:install public --symlink --relative` (no `--env` flag) |
| `build:frontend` | `frontend_command` (default `npm ci && npm run build`) inside each `frontend_dir` |
| `db:migrate` | `doctrine:migrations:migrate --env=<symfony_env> --no-interaction --allow-no-migration` |
| `app:cache:flush` | `cache:clear --no-warmup` then `cache:warmup`, both `--env=<symfony_env>`, then `runtime_reload_command` |
| `app:workers:pause` | only with `worker_control: true`: `messenger:stop-workers --env=<symfony_env>` |
| `maintenance:enable` / `disable` | none, reported as skipped (Symfony has no core mechanism) |
| `db:backup` | none, reported as skipped |

- `.env.local` is a shared file and `var/log` a shared directory; `var/cache` is deliberately not shared (the compiled container belongs to one release and one environment). `sync_paths` are `vendor` and `public/bundles`.
- `symfony_env` (default `prod`) sets `--env` on the migrate, cache and worker commands and is not validated, so a typo builds the wrong cache directory. `--allow-no-migration` is there because an empty `migrations/` directory is a healthy project.
- **`assets:install` takes no `--env`**, so it uses the target's own `APP_ENV`. With `--no-dev` vendors, a target whose `APP_ENV` resolves to `dev` dies with `Class "...MakerBundle" not found`. Set `APP_ENV=prod` in the shared `.env.local` (or the committed `.env`).
- Any bundle registered for all environments in `config/bundles.php` (for example `DoctrineMigrationsBundle`) must be in `require`, not `require-dev`, or the `--no-dev` install breaks the console on the target. Rehearsed on the sandbox: the first console call, `assets:install` in `build:assets`, dies with `Class "...DoctrineMigrationsBundle" not found`, before `db:migrate` is reached.
- **There is no maintenance window.** `db:migrate` runs against a live site; a project that needs a window anchors two `deploy.hooks` on `maintenance:enable` / `maintenance:disable`.
- Set `deploy.settings.runtime_reload_command` (FPM reload or opcache reset) when the target serves a symlinked release with a bytecode cache; `govard deploy check` warns about it.
- `govard deploy rollback`, `releases`, `status`, `unlock` and `build` exist; see `--help`. A failed deploy keeps its lock after publish starts; `govard deploy unlock` refuses a fresh lock without `--force`.
- `deploy:verify` needs a route that answers 2xx. A fresh `symfony/skeleton` has none, so `/` answers 404 and the deploy ends failed with its lock kept; add a controller first.
- `db:backup` is skipped and `govard deploy --db-backup` is refused with exit `4` ("needs a dump command this recipe does not provide"); anchor your own dump in a `deploy.hooks` entry on `db:backup`. `app:workers:pause` reports done even without `worker_control: true`, because the recipe only guards the `messenger:stop-workers` call, so a done mark there does not mean workers were stopped.
- `govard deploy rollback` re-points the live link at the previous release (the output names the release it replaced). Deploying the revision the target already runs is a no-op that exits `0` ("nothing to do"); pass `--force` to rehearse again.
- An interrupted deploy (process killed mid-run) leaves its lock and a `running` release. `govard deploy unlock <remote>` refuses a fresh lock, `--force` releases it, and `govard deploy --remote <remote> --resume` then finishes the same release.

### Rehearsing on the sandbox

Rehearse without a real server: `govard sandbox up --profile full`, then `govard deploy --remote sandbox --yes` (needs a git repo with a commit). Use the `full` profile for a Doctrine project: the `php` profile ships `pdo_mysql` but no database, so `db:migrate` fails there with `Connection refused`. Symfony has no sandbox seed definition, so the sandbox copies only the database and nothing else. Consequences:

- A fresh `full` sandbox (also with `--recreate`) exits `1` once with `chown: cannot access '/home/deployer/.deployer'`: the seed tries to hand over a deploy tree that was never created. The database is already imported; run the same `govard sandbox up --profile full` again and it completes.
- Nothing seeds the shared `.env.local`. Create it on the target before the first deploy, with `APP_ENV=prod` and a `DATABASE_URL` for the sandbox database (host `127.0.0.1`, same `symfony` user, password and database as the origin). Run the commands through `govard sandbox ssh -- '<cmd>'` (words after `--` are joined into one remote command, and piped input works), because `govard remote exec` fails on a fresh symlink sandbox until the first deploy. Without it the committed `.env` wins, and an `orm-pack` install ships a `postgresql` URL there, so `db:migrate` fails with `could not find driver` even though `pdo_mysql` is loaded.
- `deploy:shared` links the shared file only while it exists at that moment. A release created before you seeded `.env.local` never gets the link and `--resume` does not repair it: `govard deploy unlock <remote> --force` and start a new deploy.
- `govard sandbox reset` wipes the shared directory too, so seed `.env.local` again afterwards.
- The sandbox serves a symlinked release through FPM with a bytecode cache, and its deploy user cannot reload the FPM master. After a publish the pool can keep serving the previous release, so `deploy:verify` answers 404 until the pool is reloaded. A working `runtime_reload_command` is a committed `public/` script that calls `opcache_reset()` and `clearstatcache(true)`, run as `curl -fsS http://127.0.0.1/<script>`. It only helps once the served release already contains the script: the first deploy needs a one-off FPM reload from the host (`docker exec <sandbox container> pkill -USR2 -f "php-fpm: master"`).
- Add `.govard/` to the project `.gitignore`: it holds the sandbox git mirror, and a `git add -A` after `govard sandbox up` commits it and then ships it inside every release.
- `govard sync -s sandbox --media` targets `public/media`. A Symfony project without that directory still exits `0` and prints `Media sync completed with partial errors`, so read the output, not the exit code.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-10-symfony>.
