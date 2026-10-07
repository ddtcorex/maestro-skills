# Govard Usage Guides & Recommended Patterns

Official case studies and best practice patterns for common development tasks.

## 1. Onboarding & Cloning

### Clone from Staging

Use `bootstrap` with the `--clone` flag and privacy filters for a full initial setup.

```bash
govard bootstrap --clone -e staging --no-pii --no-noise --yes
```

This performs the following, unless skipped by flags (`--code-only`, `--no-db`, `--no-media`, `--no-composer`):
- `rsync` of source code (`--clone`)
- `composer install`
- database import with privacy filters
- media sync
- Auto-configuration of local settings

Preview it first with `govard bootstrap --clone -e staging --plan`.

### Safe Data Review

Preview the synchronization plan before making any changes.

```bash
govard sync --source staging --destination local --full --plan
```

This shows exactly what files and database tables will be affected.

## 2. Framework Specific Patterns

### Magento 2 Multi-Website Setup

1. Map the extra domains in `.govard.yml`:
   ```yaml
   domain: "primary.test"
   store_domains:
     brand-b.test:
       code: base
       type: website
   ```
2. Register the domain with Govard:
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
4. Open the app: `govard open admin` (framework admin panel, where one exists)

## 3. Remote Operations & Optimization

Rehearse against a container playing the target first, see [SANDBOX.md](SANDBOX.md).

### Secure Remote Dump

Stream a remote database dump into the project's local `var/` directory instead of leaving it on the remote server.

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

- `govard svc sleep`: Stop all running Govard projects and persist the wake state
- `govard svc wake`: Start the projects recorded in that sleep state

### Clean Junk

When Docker storage gets full, run diagnostics and cleanup.

- `govard doctor --fix` (alias `diag`): Apply safe automatic fixes (Govard home, stale compose files, registry, config drift); it does not free busy ports
- `govard env cleanup`: Prune stale compose files and manifests
- `govard project orphans`: Show Docker resources that are not in the registry
- `govard project delete <name>`: Completely remove a project's containers and persistent volumes