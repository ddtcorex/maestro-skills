---
name: govard-wordpress
description: Use when clearing WordPress cache, running wp cli, flushing rewrite rules, managing plugins through Govard, or auditing and deploying WordPress. Keywords wp cli, wp-config, govard deploy.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: wordpress
---

# Govard WordPress Commands

## When to use

Load this skill for WordPress shortcuts on a Govard project; it is DEPENDENT on govard-toolbox for the base commands.

- "clear WordPress cache", "run wp cli", "run wp commands", "flush rewrite rules"
- "manage WordPress plugins via govard", "wordpress wp-config"
- "audit WordPress", "lint WordPress", "govard audit", "deploy WordPress", "govard deploy"

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
- With Xdebug enabled (the default in many `.govard.yml` files) the profiler check refuses to run; `lint` and `integrity` still do. For the profiler pass `--allow-xdebug`, or turn Xdebug off with `govard debug off` (the error text suggests `govard config set stack.features.xdebug false`, but `config set` rejects that key).
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

**Privacy filters match by table name, so they need the prefix.** `--no-noise` and `--no-pii` exclude WordPress tables (`users`, `usermeta`, `comments`, `commentmeta` for PII; a few cache/log tables for noise) with the table prefix prepended. Govard reads the literal `$table_prefix` from `wp-config.php`, locally and, for a remote, from the remote's own `wp-config.php` through the credentials probe. It never borrows the local prefix for a remote.

`--no-pii` fails closed: when no table can match (the remote's prefix cannot be read, or `$table_prefix` is built dynamically, for example from `getenv()`), the command is refused instead of writing a dump that still holds `wp_users`. `--no-noise` and `--plan` only warn. Still spot-check a dump before sharing it (`grep -c 'INSERT INTO `wp_users`'` must be 0). `db dump -e <remote> --file <path>` writes `<path>` on the **remote**; add `--local` to stream the dump into the project's `var/` directory.

## Environment

- Do not commit `wp-config.php` secrets.
- For staging/prod overrides use `GOVARD_ENV=staging govard env up` (loads `.govard.staging.yml`).
- Xdebug: `govard debug on|off|status` (`off` rewrites `.govard.yml` and re-runs `env up`).
- `govard shell -c "..."` / `govard sh -c "..."` run one command in the PHP container.

## Deployment

`govard deploy production` changes a live site: state the remote, the exact command and the
way back, then wait for an explicit yes before running it. `govard deploy plan` is the source of
truth for the pipeline, and `govard deploy check` is the preflight.

Read [references/DEPLOYMENT.md](references/DEPLOYMENT.md) when planning, checking, rehearsing or running a deploy, or when a deploy exits `4`.

## Common Workflows

### After Pulling Code

```bash
govard tool composer install        # only if the project has composer.json
govard tool wp plugin update --all
govard tool wp rewrite flush
govard tool wp cache flush
```

### Sync from Staging

`--no-pii` refuses to run when the remote's table prefix cannot be read (see Database); without that flag the copy contains real users, so treat it accordingly:

```bash
govard bootstrap --clone -e staging --yes     # --yes (or -y) is required non-interactively
# or DB-only
govard sync -s staging --db
govard tool wp search-replace 'https://staging.example.com' 'https://<project-domain>' --all-tables
```

A `bootstrap -e <remote>` run rewrites `siteurl`/`home` to the local domain after the import. Preview any of these with `--plan` first (`govard sync ... --plan`, `govard bootstrap ... --plan`); `sync --db --plan` still probes the remote over ssh for DB credentials. The clone plan lists Magento-only excludes (`app/etc/env.php`, `pub/static`) that mean nothing for WordPress.
