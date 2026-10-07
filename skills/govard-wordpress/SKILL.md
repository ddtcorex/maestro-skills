---
name: govard-wordpress
description: |
  This skill should be used when the user asks to "clear WordPress cache", "run wp cli", "run wp commands", "flush rewrite rules", "manage WordPress plugins via govard", "wordpress wp-config", "audit WordPress", "lint WordPress", "govard audit", "deploy WordPress", or "govard deploy". Provides WordPress-specific Govard shortcuts. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: wordpress
---

# Govard WordPress Commands

WordPress-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first. This skill only covers WordPress-specific behavior layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup). For generic PHP (strict_types, PSR-12, PHPStan, security) see `php-dev-core`.

**Docker requirement:** stack commands here need Docker. Check what a command needs with `govard capabilities`. Unlike some frameworks, WordPress has **no** container-free `govard audit run --checks integrity` (it fails with "does not support integrity audit").

## WP-CLI

`wp` runs inside the PHP container. `govard up` installs it when missing.

```bash
govard tool wp --info
govard tool wp core version
govard tool wp plugin list

# Alternative: open a shell, then run wp directly
govard sh
wp --info
```

Most `wp` commands that touch the database (`plugin list`, `theme list`, `cache flush`, `rewrite flush`) fail with "The site you have requested is not installed" until the site is installed. A checkout brought up with `govard up` has `wp-config.php` wired to the Govard database but an empty database, so installing is your step, not a red flag:

```bash
govard tool wp core install --url=https://<project-domain> --title="Local" --admin_user=admin --admin_email=admin@example.com
govard tool wp core is-installed && govard db query "SHOW TABLES"
```

(`govard bootstrap --fresh` runs the install itself.) Read the project's runtime values instead of assuming them:

```bash
govard config get stack.php_version
govard config get stack.db_version
govard config get domain
```

`govard bootstrap --framework-version <v>` is **pinned, not "latest"**: a bare `6` is normalised to `6.0` and that exact archive is downloaded from wordpress.org. Omit the flag to track latest. Bedrock layout (`web/wp/wp-includes/version.php`) is auto-detected (see `govard-toolbox` for provider details).

## Audit

Lint is the supported check: `govard audit run --checks lint --lint-provider govard --mode project --format json` (see `govard-toolbox` ## Audit for the cross-framework matrix). On WordPress:

- `--checks integrity` and `--checks profiler` are **not supported** (exit 1, "framework wordpress does not support ... audit").
- With Xdebug enabled (the default in many `.govard.yml` files) audit refuses to run: pass `--allow-xdebug` or run `govard config set stack.features.xdebug false` first.
- Linting a full WordPress tree can take minutes and exits 1 when it reports findings; scope with `--scope diff --base <ref>` for day-to-day use.

## Cache Management

```bash
# Object cache (needs an installed site; a no-op without an object-cache drop-in)
govard tool wp cache flush

# Transients
govard tool wp transient delete --all

# Caching plugins expose their own wp subcommands; they only work once the plugin is installed
govard tool wp rocket clean --confirm
```

There is no Govard-level `frontend_sync` for WordPress; use `govard tool npm run watch` if the theme has a build step.

## Plugin & Theme Management

```bash
govard tool wp plugin list
govard tool wp theme list

govard tool wp plugin install query-monitor --activate
govard tool wp theme install twentytwentyfour --activate

govard tool wp plugin update --all
govard tool wp theme update --all
```

Must-use plugins live in `wp-content/mu-plugins` and are not managed by `wp plugin`.

## Rewrite & Core

```bash
# After CPT/taxonomy changes. Warns "Rewrite rules are empty" until a permalink structure is set.
govard tool wp rewrite flush
govard tool wp rewrite list

govard tool wp core verify-checksums   # exits 1 if any core file was modified

# After a domain change (e.g. staging sync); try --dry-run first
govard tool wp search-replace 'https://staging.example.com' 'https://<project-domain>' --all-tables
```

`wp-config.php` is generated (DB credentials, fresh salts, proxy/HTTPS support) only when it is **missing** at bootstrap time. `govard up` does not rewrite an existing `wp-config.php` or regenerate its salts. For multisite, add `extra_domains` in `.govard.yml` for each site domain, then `govard env up`:

```yaml
extra_domains:
  - shop.<project-domain>
```

`govard domain add|remove|list` manages the same list.

## Database

```bash
govard db info                                  # connection details, never the password
govard db query "SHOW TABLES"
govard db query "SELECT option_value FROM wp_options WHERE option_name='siteurl'"

govard db dump --file backup.sql
govard db import --file backup.sql --drop       # --drop recreates the database first
govard db dump --no-noise --no-pii -e staging   # privacy-filtered dump from a remote

# Same thing through WP-CLI inside the container
govard tool wp db query "SHOW TABLES"
govard tool wp db export --add-drop-table
```

**Privacy filters need `table_prefix` set, and a remote ignores it.** `--no-noise` and `--no-pii` exclude WordPress tables by name (`users`, `usermeta`, `comments`, `commentmeta` for PII; a few cache/log tables for noise) with the project's `table_prefix` prepended. Govard does not read the prefix from `wp-config.php` for WordPress. On a **local** dump the filters match only after `govard config set table_prefix wp_`; without it `wp_users` is dumped in full. Against a **remote** (`db dump -e <remote>`, `sync -s <remote> --db`, `bootstrap`, `db import --stream-db`) the configured `table_prefix` is not applied at all for WordPress: the filters name the unprefixed tables (`users`, `comments`), match nothing, and `wp_users` and `wp_comments` come through even with the prefix set.

```bash
govard config set table_prefix wp_
govard config get table_prefix
```

So never trust `--no-pii` on a WordPress remote. Verify every "sanitized" dump before sharing it (`grep -c 'INSERT INTO `wp_users`'` must be 0), and prefer importing first, then dumping locally with the prefix set. `db dump -e <remote> --file <path>` writes `<path>` on the **remote**; add `--local` to stream the dump into the project's `var/` directory.

## Environment

- Do not commit `wp-config.php` secrets.
- For staging/prod overrides use `GOVARD_ENV=staging govard env up` (loads `.govard.staging.yml`).
- Xdebug: `govard debug on|off|status` (`off` rewrites `.govard.yml` and re-runs `env up`).
- `govard shell -c "..."` / `govard sh -c "..."` run one command in the PHP container.

## Deployment

WordPress ships a deploy recipe for the **classic layout only**: core files and `wp-content/` in the repository root. A Bedrock layout (core in `vendor/`, docroot `web/`) and a content-only checkout are not supported.

```bash
govard deploy plan production --branch main   # resolved pipeline: no connection, no Docker
govard deploy check production --branch main  # preflight over ssh
govard deploy production --branch main --yes
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
- `deploy:check` refuses a verify URL that redirects. A database copied from another environment keeps that environment's `siteurl`, so WordPress answers the verify URL with a 301 and the preflight stops. Point `siteurl`/`home` at the target URL (`wp option update`), or set `deploy.verify.follow_redirects: true`.
- Maintenance writes `time() + 86400`, not WordPress's own `time()`: a flag older than ten minutes expires, so a longer window would silently reopen the site mid-migration. The drop-in carries a marker, so a project's own maintenance page is kept. A deploy that fails after `maintenance:enable` leaves the flag and the lock behind; `--resume` (after `deploy unlock --force` if the lock is fresh) finishes the release and removes the flag.
- `--db-backup` needs **wp-cli on the target**: `wp db export`/`wp db import` have no `wp-load.php` fallback. Without wp-cli the deploy stops at `db:backup` and exits `127` (the failing command's status, not the documented `1`). Without the flag the `db:backup` row still prints a green tick but dumps nothing. With it the dump lands in `shared/backups/deploy/<release>/dump.sql`.
- `deploy rollback --with-db` restores the dump recorded by the release after the rollback target, and refuses (exit `1`) when that release has none, for example the newest one.
- `deploy unlock` refuses a fresh lock without `--force`. `deploy --resume` with nothing unfinished starts a new release, and says "already runs ... nothing to do" when the revision is already live (use `--force`).
- In artifact mode the only build step is the guarded `composer install`; the database steps still run on the target.
- Shared: `wp-config.php` (file), `wp-content/uploads` (dir); writable: `wp-content/{uploads,cache,upgrade,languages}`.

### Rehearsing on the sandbox

`govard sandbox up` gives a disposable target with wp-cli, a MySQL client, the usual PHP extensions and `mariadb` + `redis-server`, so a deploy can be rehearsed with `govard deploy --remote sandbox --yes`. The origin environment must be running to seed.

- `--profile full` probes its database with `mysqladmin`, which the newer MariaDB image does not ship (only `mariadb-admin`). A stack on that image fails with "the sandbox database ... never answered" (exit `127`); pass `--db mariadb:<older series>` (after `sandbox down --purge`, because the volume refuses an older engine) or use `--profile php`. A seed that produces no shared tree can also stop at `chown ... .deployer: No such file`; a second `up` then succeeds without re-seeding.
- The seed copies the database but writes no `wp-config.php` and no shared tree for WordPress. Seed `shared/wp-config.php` yourself (the sandbox database user keeps the origin credentials; set `DB_HOST` to `localhost`), over `ssh -p <port> -i .govard/sandbox/id_ed25519 deployer@127.0.0.1`.
- `sandbox ssh` is interactive only and takes no command. Use `govard remote exec sandbox -- <cmd>`, which fails on the dangling `current` until the first deploy and again after `sandbox reset` (reset also wipes `shared/`, so re-seed `wp-config.php`).
- `govard remote exec`, `remote test`, `deploy plan|check|status|releases|rollback|unlock`, `db dump -e sandbox`, `snapshot create|list -e sandbox` and real `sync -s sandbox` (`--db`, `--file --path wp-content/themes`, `--media` which maps to `wp-content/uploads`) all work against it. `sync -s sandbox --db` needs a deployed `wp-config.php` on the target to detect credentials.
- `snapshot create -e <remote>` writes into `<current>/.govard/snapshots/` inside the served release, so the next deploy leaves it behind in the previous release directory.
- `govard open admin` opens `/admin`, not `/wp-admin` (local and remote), and `open admin -e sandbox` is refused as an unknown remote because `open` does not resolve the synthetic name; use a configured remote.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-11-wordpress>.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install        # only if the project has composer.json
govard tool wp plugin update --all
govard tool wp rewrite flush
govard tool wp cache flush
```

### Sync from Staging

`--no-pii` and `--no-noise` do not protect `wp_users` against a remote (see Database), so treat the copy as containing real users:

```bash
govard bootstrap --clone -e staging --yes     # --yes (or -y) is required non-interactively
# or DB-only
govard sync -s staging --db
govard tool wp search-replace 'https://staging.example.com' 'https://<project-domain>' --all-tables
```

A `bootstrap -e <remote>` run rewrites `siteurl`/`home` to the local domain after the import. Preview any of these with `--plan` first (`govard sync ... --plan`, `govard bootstrap ... --plan`); `sync --db --plan` still probes the remote over ssh for DB credentials. The clone plan lists Magento-only excludes (`app/etc/env.php`, `pub/static`) that mean nothing for WordPress.
