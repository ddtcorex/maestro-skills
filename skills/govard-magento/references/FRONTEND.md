# Frontend live reload

The `frontend_sync` feature, the on-demand lifecycle, the theme watchers and the port and
proxy rules.

Requires `stack.features.frontend_sync: true` in `.govard.yml` (Magento family only). Without it, `govard frontend ...` exits with "frontend sync is disabled". `govard env up` never starts this; it is a separate, explicit, on-demand lifecycle:

```bash
govard env up                    # app/db/etc. up, no frontend services yet
govard frontend start            # renders + starts BrowserSync/LiveReload + watchers
govard frontend logs -f          # sync/injector container
govard frontend logs watch-<theme> -f
govard frontend stop             # removes only frontend services, keeps their volumes
```

**Prerequisites (Govard never creates or edits these files):**

Let `govard frontend start` be the discovery oracle: it validates the setup and fails fast with the reason. Only read theme files to fix a specific failure; do not pre-verify by hand.

- **Hyva:** exactly one `scripts.browser-sync` owner under `app/design/frontend/<Vendor>/<Theme>/web/tailwind`, with a committed `package-lock.json`. The theme's `browser-sync.config.cjs` (stock Hyva filename) must read `GOVARD_FRONTEND_SYNC_TARGET` (and port) from the environment instead of hard-coding a host.
- **Luma:** root `Gruntfile.js`, `package.json`, `package-lock.json` (copy Magento's `.sample` files, then `govard tool npm install`). No BrowserSync config needed.
- Hyva and Luma discovery are exclusive: start fails unless exactly one setup is valid.

**Switching the active Hyva theme:** move the `scripts.browser-sync` entry (plus its `browser-sync.config.cjs` and `package-lock.json`) from the old theme's `web/tailwind/package.json` to the new theme, then run `govard frontend start` again.

| Symptom | Fix |
|---|---|
| `frontend start` reports success but the page redirects to a different host or drops the session | The theme's `browser-sync.config.cjs` proxy settings rewrite the origin or cookie domain; keep both unchanged |
| Discovery fails ("requires either exactly one Hyva ... or root Gruntfile.js and package.json") | Confirm exactly one theme owns `scripts.browser-sync`, or that the Luma root files exist, and not both |
| `frontend start` fails with "container ... health is unhealthy" | Read `govard frontend logs`; the sync container could not serve the project (for example Luma themes not yet compiled) |
