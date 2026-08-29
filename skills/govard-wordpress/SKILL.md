---
name: govard-wordpress
description: |
  This skill should be used when the user asks to "clear WordPress cache", "run wp cli", "run wp commands", "flush rewrite rules", "manage WordPress plugins via govard", "wordpress wp-config", "audit WordPress", "lint WordPress", or "govard audit". Provides WordPress-specific Govard shortcuts. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox, php-dev-core]
metadata:
  audience: developers
  workflow: wordpress
---

# Govard WordPress Commands

WordPress-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers WordPress-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

For generic PHP (strict_types/PSR-12/PHPStan/Security) see php-dev-core.

## WP-CLI

WP-CLI (`wp`) runs inside the PHP container via Govard:

```bash
# Any wp command
govard tool wp --info
govard tool wp core version
govard tool wp plugin list

# Alternative: open shell
govard sh
wp --info
```

Govard default for WordPress (verified 2026-08-28 `govard-test-wordpress`): `stack.php_version 8.0` (PHP 8.0.30), `web_root /`, `db mariadb 10.6`. Verify with `govard config get stack.php_version`. Note: request `--framework-version 6` currently installs WP 7.1 (latest); PHP/DB versions are template defaults and may differ per bootstrap.

## Audit

For generic PHP (strict_types/PSR-12/PHPStan/Security) see `php-dev-core`. For 4-framework matrix and `govard audit run --checks lint --provider govard --mode project --format json` see `govard-toolbox` ## Audit.

Bedrock layout `web/wp/wp-includes/version.php` is auto-detected via `web/wp/wp-includes/version.php` (see `govard-toolbox` for provider details).

## Cache Management

```bash
# Object cache flush (requires installed site; object-cache drop-in else no-op)
govard tool wp cache flush  # fresh DB without install returns "The site you have requested is not installed"

# Transients
govard tool wp transient delete --all

# If using a caching plugin (e.g. WP Rocket, W3 Total Cache)
govard tool wp rocket clean --confirm
```

Verified 2026-08-28: `cache flush` succeeds after `wp core install` (`Success: The cache was flushed`), fails pre-install.

No Govard-level `frontend_sync` for WordPress — use `govard tool npm run watch` if the theme uses a build step.

## Plugin & Theme Management

```bash
# List — requires installed site (verified: fresh govard-test-wordpress shows akismet 5.7.2 + hello 1.7.2 after install, fails pre-install)
govard tool wp plugin list
govard tool wp theme list

# Install / activate
govard tool wp plugin install query-monitor --activate
govard tool wp theme install twentytwentyfour --activate

# Update
govard tool wp plugin update --all
govard tool wp theme update --all

# Must-use plugins are in wp-content/mu-plugins (not managed by wp plugin)
```

## Rewrite & Core

```bash
# Flush rewrite rules (after CPT/taxonomy changes) — requires installed site; fresh install with empty DB warns "Rewrite rules are empty"
govard tool wp rewrite flush
govard tool wp rewrite list

# Verify core checksums
govard tool wp core verify-checksums

# Search-replace (after domain change, e.g. staging sync)
govard tool wp search-replace 'https://staging.example.com' 'https://wordpress.test' --all-tables

# Fresh install — Govard bootstrap creates wp-config.php but leaves DB empty (verified 2026-08-28: govard-test-wordpress required manual install)
govard tool wp core install --url=https://wordpress.test --title="Local" --admin_user=admin --admin_email=admin@example.com
# After install: govard tool wp core is-installed && govard tool wp db query "SHOW TABLES" shows wp_* tables
```

Govard injects `wp-config.php` salts automatically on `govard env up`. For multisite (`WP_ALLOW_MULTISITE true`), add `extra_domains` in `.govard.yml` for each site domain.

## Database

```bash
# Via WP-CLI
govard tool wp db query "SHOW TABLES" 
govard tool wp db export --add-drop-table

# Via Govard DB layer (auto-handles table_prefix)
govard db query "SHOW TABLES"
govard db query "SELECT option_value FROM wp_options WHERE option_name='siteurl'"

# Prefix note: default $table_prefix is wp_ — if .govard.yml sets table_prefix, Govard's
# privacy filters (--no-pii/--no-noise) target prefixed tables automatically
govard db query "SELECT * FROM wp_users LIMIT 5"
```

Import/export also works via `govard db import --file backup.sql --drop` and `govard db dump --no-noise -e staging`.

## wp-config.php & Environment

Govard auto-generates salts and wires DB credentials into `wp-config.php` on `govard env up`:

```bash
# Inspect current Govard DB credentials
govard db info
govard config get stack.db_version

# Show wp-config.php salts section
govard shell -c "grep -A2 AUTH_KEY wp-config.php | head -10"
```

- Do not commit `wp-config.php` salts — Govard regenerates them if missing.
- For staging/prod overrides use `GOVARD_ENV=staging govard env up` (loads `.govard.staging.yml`).
- `extra_domains` example for additional vhosts:

```yaml
# .govard.yml
extra_domains:
  - shop.wordpress.test
```

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool wp plugin update --all
govard tool wp rewrite flush
govard tool wp cache flush
```

### Sync from Staging (privacy-safe)

```bash
govard bootstrap --clone -e staging --no-pii --no-noise --yes
# or DB-only
govard sync -s staging --db --no-pii --no-noise
govard tool wp search-replace 'https://staging.example.com' 'https://wordpress.test' --all-tables
```
