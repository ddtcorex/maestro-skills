# Govard Usage Guides & Recommended Patterns

Official case studies and best practice patterns for common development tasks.

## 1. Onboarding & Cloning

### Clone from Staging

Use `bootstrap` with the `--clone` flag and privacy filters for a full initial setup.

```bash
govard bootstrap --clone -e staging --no-pii --no-noise --yes
```

This performs:
- `rsync` of source code
- `db import` with privacy filters
- `media sync`
- `composer install`
- Auto-configuration of local settings

### Safe Data Review

Preview the synchronization plan before making any changes.

```bash
govard sync --source staging --destination local --full --plan
```

This shows exactly what files and database tables will be affected.

## 2. Framework Specific Patterns

### Magento 2 Multi-Website Setup

1. Add domains to `.govard.yml`:
   ```yaml
   domain: "primary.test"
   store_domains:
     brand-b.test:
       code: base
       type: website
   ```
2. Manually register domains:
   ```bash
   govard domain add brand-b.test
   ```
3. Auto-configure environments:
   ```bash
   govard config auto
   govard tool magento cache:flush
   ```

### Laravel Development

1. Open environment: `govard up`
2. Run migrations: `govard tool artisan migrate`
3. Generate key: `govard tool artisan key:generate`
4. Open admin: `govard open admin`

## 3. Remote Operations & Optimization

### Secure Remote Dump

Capture a remote database securely to your local `var/` directory without saving it on the remote server.

```bash
govard db dump -e staging --local --no-noise --no-pii
```

### Targeted File Sync

Synchronize a single file (like a config override) from a production environment.

```bash
govard sync --source prod --file --path app/etc/config.php
```

## 4. Resource Management

### Suspend & Resume

When working on many projects, use `svc sleep` and `svc wake` to manage global resources efficiently.

- `govard svc sleep`: Suspend all running Govard environments
- `govard svc wake`: Resume environments that were recently active

### Clean Junk

When Docker storage gets full, run diagnostics and cleanup.

- `govard diag --fix`: Fix common Docker/Compose port and permission issues
- `govard env cleanup`: Prune stale compose files and orphan resources
- `govard project delete <name>`: Completely remove a project's containers and persistent volumes