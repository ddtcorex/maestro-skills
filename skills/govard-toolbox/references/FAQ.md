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

---

## 3. Remote & Sync

### Q: Sync takes too long or times out

**A**: Use `--no-compress` (less CPU usage) and skip data with `--no-noise` or `--no-pii`.

```bash
govard sync -s staging --full --no-compress --no-noise
```

### Q: Authenticity of host can't be established

**A**: Use `govard remote copy-id <remote>` to add your SSH key to the remote host.

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