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

**Privacy filters need `table_prefix` set.** `--no-noise` and `--no-pii` exclude WordPress tables by name (`users`, `usermeta`, `comments`, `commentmeta` for PII; a few cache/log tables for noise) with the project's `table_prefix` prepended. Govard does not read the prefix from `wp-config.php` for WordPress: with `table_prefix` unset in `.govard.yml` the filters match nothing and **`wp_users` is dumped in full**. Set it once and re-check:

```bash
govard config set table_prefix wp_
govard config get table_prefix
```

Verify any "sanitized" dump before sharing it (for example `grep -c 'INSERT INTO `wp_users`' backup.sql` must be 0).

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

- **Seed `shared/wp-config.php` before the first deploy.** `deploy:shared` links a shared entry only when it already exists, so an unseeded `shared/` leaves the release with the repository's `wp-config.php`, the one naming the development database. The release then fails at `db:migrate` ("Error establishing a database connection"), and the lock and release directory are kept; continue with `govard deploy --remote <name> --resume` or clear the lock with `govard deploy unlock`.
- Maintenance writes `time() + 86400`, not WordPress's own `time()`: a flag older than ten minutes expires, so a longer window would silently reopen the site mid-migration. The drop-in carries a marker, so a project's own maintenance page is kept.
- `--db-backup` needs **wp-cli on the target**: `wp db export`/`wp db import` have no `wp-load.php` fallback.
- In artifact mode the only build step is the guarded `composer install`; the database steps still run on the target.
- Shared: `wp-config.php` (file), `wp-content/uploads` (dir); writable: `wp-content/{uploads,cache,upgrade,languages}`.
- `govard sandbox up` gives a disposable PHP target with wp-cli, a MySQL client, the usual PHP extensions and `mariadb` + `redis-server`, so a deploy can be rehearsed locally with `govard deploy --remote sandbox --yes`. As above, seed `shared/wp-config.php` or the rehearsal fails at `db:migrate`.

Reference: <https://govard.ddtcorex.com/workflows/deployment#laravel-symfony-and-wordpress> and <https://govard.ddtcorex.com/workflows/deploy-case-studies#case-11-wordpress>.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install        # only if the project has composer.json
govard tool wp plugin update --all
govard tool wp rewrite flush
govard tool wp cache flush
```

### Sync from Staging (privacy-safe)

Set `table_prefix` first (see Database), then:

```bash
govard bootstrap --clone -e staging --no-pii --no-noise --yes
# or DB-only
govard sync -s staging --db --no-pii --no-noise
govard tool wp search-replace 'https://staging.example.com' 'https://<project-domain>' --all-tables
```

Preview any of these with `--plan` first (`govard sync ... --plan`, `govard bootstrap ... --plan`); `sync --db --plan` still probes the remote over ssh for DB credentials.
