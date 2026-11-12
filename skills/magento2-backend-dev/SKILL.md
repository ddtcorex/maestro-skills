---
name: magento2-backend-dev
description: Use when creating a Magento 2 REST, SOAP or GraphQL endpoint, CLI command, cron job, message queue or data provider. Keywords API endpoint, CLI command. DEPENDENT on magento2-dev-core.
compatibility: claude, codex, opencode, copilot, dsh
depends: [magento2-dev-core]
metadata:
  audience: backend developers
  workflow: magento
---

# Magento 2 Backend Developer

## When to use

Load this skill for Magento 2 backend development; it is DEPENDENT on magento2-dev-core for security and architecture patterns.

- "create an API endpoint", "build a REST API", "REST/SOAP/GraphQL APIs", "add a GraphQL resolver", "implement a web API", "add a SOAP service"
- "create a CLI command", "add a cron job", "set up a message queue", "create a data provider"

This skill covers API development (REST, SOAP, GraphQL), CLI commands, cron jobs, and message queues.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first: it defines the DI, repository, and security patterns (constructor injection, service contracts, escaping, discouraged functions) this skill assumes without repeating.

Pairs with `magento2-security-scan` when the API/resolver you're building touches authentication, ACL, or user input, and with `magento2-performance-audit` for queue/consumer and N+1 concerns once the endpoint is built. In a Govard environment, use `govard-magento` for the CLI/container side (`bin/magento`, cache, indexers).

## REST API

Read [references/rest-api.md](references/rest-api.md) when adding or changing a REST endpoint: the service contract and data interfaces, the repository implementation, the `webapi.xml` declaration and its ACL entry.

## GraphQL

Read [references/graphql.md](references/graphql.md) when adding a GraphQL field: the schema definition, the resolver, and why a duplicated field fails the schema build.

## CLI Commands

Read [references/cli-commands.md](references/cli-commands.md) when adding a `bin/magento` command: the command class and its registration.

## Cron Jobs

Read [references/cron-jobs.md](references/cron-jobs.md) when adding a cron job: the cron class, its `crontab.xml` entry and cron groups.

## Message Queue

Read [references/message-queue.md](references/message-queue.md) when publishing to or consuming from a queue: which XML files a case needs, the publisher, the consumer and its registration.

## Pitfalls recap

- The `resource ref` in `webapi.xml` must match an actual `id` declared in `acl.xml`, a typo here fails silently with a 403, not a config error.
- Always throw `NoSuchEntityException` (not return `null`) when a repository can't find an entity, the WebAPI framework maps it to a proper 404.
- A configured consumer (`queue_consumer.xml`) does nothing on its own: it must actually be running as a process via cron or a supervisor (`bin/magento queue:consumers:start`), or messages just pile up in the `queue_message` tables. See `magento2-performance-audit`.
- GraphQL resolvers get no automatic ACL check, validate the customer/admin context explicitly inside `resolve()` if the field exposes anything sensitive.

`cron_schedule` rows move through `pending` → `running` → `success`/`error`/`missed`. Never `TRUNCATE cron_schedule` to "fix" a stuck cron, query it (`WHERE status IN ('error','missed')`) to diagnose the actual cause instead, since truncating destroys the run history you'd need to find it.

## Verification

```bash
# Test CLI command
bin/magento vendor:products:sync --dry-run --limit=10

# List registered commands
bin/magento list | grep vendor

# Run cron manually
bin/magento cron:run --group=custom

# Check queue consumers
bin/magento queue:consumers:list

# Start message queue consumer
bin/magento queue:consumers:start vendor.product.update.consumer

# Test REST API
curl -X GET "http://localhost/rest/V1/vendor/product/1" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json"

# Clear API cache (webapi.xml routes are cached in config_webservice)
bin/magento cache:clean config config_webservice
```