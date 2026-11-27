# Configuration files

The `etc/` files a module ships, what each one declares and when it is required.

Quick lookup for what each `etc/` XML file controls:

| File | Purpose |
|------|---------|
| `di.xml` | Dependency injection: preferences, plugins, virtual types |
| `events.xml` | Observer registration |
| `crontab.xml` / `cron_groups.xml` | Cron jobs / cron group tuning |
| `acl.xml` | Admin permission tree |
| `routes.xml` | Frontend/adminhtml controller routing |
| `webapi.xml` | REST route declarations |
| `system.xml` | Admin configuration fields |
| `config.xml` | Default config values |
| `indexer.xml` + `mview.xml` | Indexer declaration + its change tracker (enables schedule mode) |
| `extension_attributes.xml` | Extend a core entity without a preference |
| `view.xml` | Theme image/gallery sizing, layout config |
| `communication.xml` + `queue_topology.xml` + `queue_publisher.xml` + `queue_consumer.xml` | Message queue topics, exchanges and bindings, publishers, consumers (the single `queue.xml` is legacy since 2.2) |
| `widget.xml` | CMS widget declaration |
| `email_templates.xml` | Transactional email template registration |

**Rule of thumb**: stale *data* is an indexer problem (check `indexer:status`); stale *output* is a cache problem (`cache:clean`/`cache:flush`). Diagnose in that order rather than assuming a cache bug.
