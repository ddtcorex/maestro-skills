# Govard FAQ & Troubleshooting

Common questions, issues, and official solutions for Govard environments.

## 1. Installation & Environment

### Q: Installer fails with a permission error

**A**: Use the `--local` flag to install to `~/.local/bin` instead of `/usr/local/bin`.

```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/govard/master/install.sh | bash -s -- --local
```

### Q: Port conflict when starting environment

**A**: Run `govard doctor --fix` to identify and repair port-hogging processes.

### Q: Host/Domain identity collision

**A**: Change `project_name` or `domain` in `.govard.yml` to a unique value. Update with `govard cfg set`.

---

## 2. SSL & Network

### Q: Browser shows "Your connection is not private"

**A**: Run `govard svc up` (shared proxy) and `govard doctor trust` (re-import Root CA).

### Q: Domain doesn't resolve (.test)

**A**: Ensure `dnsmasq` service is running with `govard svc up`. Use `resolvectl query <domain>` for diagnostics.

### Q: RabbitMQ management UI not reachable

**A**: Check `stack.services.queue` is `rabbitmq` (not `none`), re-run `govard env up` once, and use `http://<domain>:15672` (plain HTTP, guest/guest) — never `https://`.

---

## 3. Remote & Sync

### Q: Sync takes too long or times out

**A**: Use `--no-compress` (less CPU usage) and skip data with `--no-noise` or `--no-pii`.

```bash
govard sync -s staging --full --no-compress --no-noise
```

### Q: Authenticity of host can't be established

**A**: Use `govard remote copy-id <remote>` to add your SSH key to the remote host.

### Q: Gateway SSH refused / sandbox unreachable at :2222

**A**: Check the chain: `govard svc up` (bastion) → `sandbox up` (target) → `gateway allow-key` (key). `gateway status` shows target/allowlist counts and warns if port 2222 is held by another process. Log in as the slugged name (`Foo_Bar` → `foo-bar`); pass the key as one quoted shell argument.

### Q: Remote dump fails after an update that used to succeed

**A**: Dumps fail loudly now instead of writing an empty file — read the credential warning first. Point the remote at the layout root is fine (Govard probes `<path>`, `public_html`, `current`); "no database configuration at …" lists every path tried.

---

## 4. Frameworks & Database

### Q: Magento 2 Database password is wrong after bootstrap

**A**: Run `govard config auto` to rebuild `app/etc/env.php` with the correct local credentials.

### Q: PHPMyAdmin doesn't show my project's database

**A**: Run `govard env up` to re-register the project with the global proxy/PMA.

---

## 5. Xdebug

### Q: Xdebug is not connecting to my IDE

**A**:
1. Check state: `govard debug status`
2. Match cookie: `XDEBUG_SESSION` must match `stack.xdebug_session` in `.govard.yml`
3. Check IDE: Port 9003 must be listening

### Q: Xdebug slows down my site

**A**: Use `govard debug off` to disable Xdebug when not in use. Xdebug routes only when the cookie is present.

---

## 6. Resources & Performance

### Q: Docker storage is full

**A**:
1. `govard project orphans` to find stale projects
2. `govard project delete <name>` for unused projects
3. `govard env cleanup` to prune compose files

### Q: Desktop App shows old data

**A**: Restart the desktop process. Use `govard self-update` to ensure all binaries are current.