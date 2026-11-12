# Configuration

The layered config files, which one is writable, and how a value is read or written.

The `.govard.yml` at the project root defines the framework, PHP/Node/DB versions, services, and domain. It is committed to the repo, so **no `govard init` is needed** for an existing project. Config is layered (later overrides earlier), and only `.govard.yml` is writable via `govard config set`:

| File | Purpose |
|---|---|
| `.govard.yml` | Team-shared base config (committed) |
| `.govard.<profile>.yml` | Team-shared scope file for the active profile (committed; wins over base) |
| `.govard.local.yml` (or `.govard/.govard.local.yml`) | Developer-local overrides (gitignored) |
| `.govard.<env>.yml` | Environment overrides, activated via `GOVARD_ENV=<env>` |

The profile name resolves from `--profile`, else the per-project registry (`~/.govard/projects.json`), else none. `govard config profile` shows the active one. **Never hand-edit `.govard.yml` to chase drift warnings while a profile layer is active**: `diag` compares the base file against detected runtime, but the running stack and every audit use the merged config with the profile applied, so a stale base is expected noise, not a bug. Verify with `govard config profile` (its values must match the running containers) instead of syncing the base. Converging the base is a team decision made through `govard doctor --fix`, which asks for confirmation interactively.

```yaml
project_name: myproject
framework: magento2          # magento2, laravel, symfony, wordpress, nextjs, …
framework_version: 2.4.7     # illustrative values throughout
domain: myproject.test
stack:
  php_version: "8.3"
  node_version: "20"
  db_version: "10.6"
  services:
    web_server: apache        # apache | nginx
    db: mariadb               # mariadb | mysql | none
    search: opensearch        # opensearch | elasticsearch | none
    cache: redis              # redis | valkey | none
  features:
    xdebug: false
    varnish: false
```

```bash
# Auto-config after DB sync (rebuilds app-level config, e.g. Magento's env.php)
govard config auto

# Read a value without opening the file
govard config get stack.php_version

# Write a value, only .govard.yml is writable this way
govard config set stack.php_version 8.4
```
