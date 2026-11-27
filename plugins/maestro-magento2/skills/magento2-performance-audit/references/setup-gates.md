# Setup gates: branch, environment and discovery

What the branch switch proves, how the environment gate resolves a `Down` project, and what
`discover` records. The commands and the rules are in `SKILL.md`.

## Step 0, branch and environment gate

> **Step 0, branch and environment gate:** switch branches only with `perf-audit.mjs switch perf-audit.config.json --branch <branch>`. It runs fetch, checkout (never a forced checkout: a checkout blocked by local changes stops with a closed reason, ask before stashing), `pull --ff-only` (`Skipped: local diverged` when it cannot fast-forward), `composer install` when `composer.lock` changed, clears `generated/`, flushes the cache and page cache stores directly (never the session database; `bin/magento cache:flush` cannot bootstrap while the cache names a module the branch lacks), runs `setup:upgrade`, then proves the switch: enabled modules match `app/etc/config.php` and every frozen URL returns 200. When no branch is requested and the runtime supports questions, ask which branch to audit. Then `govard status`; if the project is `Down`, `govard env up` and wait for a 200 on the base URL before step 1.

## Step 0b, discovery

> **Step 0b, discovery:** `perf-audit.mjs discover` writes `perf-audit.config.json`: home, the smallest, median and largest category by product count, three products of distinct types, the store's theme chain and every theme overriding `product/list.phtml` or `product/view.phtml`, plus an invalidation SKU. It never overwrites an existing config without `--refresh`, because later audits compare against it. Each url set entry carries a human `name` (categories also `productCount`, products `type`); `discover --enrich` adds those fields to an older config by URI without adding, removing or reordering pages. Manual fallback: `references/per-page-type-audit.md` section 0.
