---
name: magento2-performance-audit
description: "Use when auditing Magento 2 performance: Core Web Vitals, Lighthouse, Redis and Varnish, N+1 queries, indexers, cron, full_page cache flushes. Keywords Lighthouse, FPC invalidation."
compatibility: claude, codex, opencode, copilot, dsh
depends: [magento2-dev-core]
metadata:
  audience: developers
  workflow: magento
---

# Magento 2 Performance Audit

## When to use

Load this skill for a performance and health audit against Adobe Commerce best practices; it depends on `magento2-dev-core` for code-level patterns.

- "audit performance", "check Core Web Vitals", "run Lighthouse", "check server configuration"
- "verify Redis/Varnish setup", "analyze database queries", "find N+1 query issues", "review indexer configuration", "check cron health"
- "debug cache flush", "why does full_page cache keep flushing", "trace FPC invalidation"
- "too many ajax requests", "customer data section reload storm", "crawler overloading server"

This skill performs a comprehensive audit of Magento 2 performance, infrastructure, and code-level patterns.

## Govard-Native Audit Coverage

`govard audit run` runs PHPCS and PHPStan through Govard's pinned lint image, so it covers
coding-standard and static-analysis findings only: no `performance` check exists, and
`--checks performance` fails as "not implemented". The native `profiler`
check (`--checks lint,profiler --url <url>`) captures the stock profiler CSV for one URL and
complements the manual per-page audit without replacing it: no query log, no cross-page matrix, no
threshold analysis. The profiler needs a project target, never a `standalone` one; the URL and
lease rules are in `references/per-page-type-audit.md`. Manual per-page
captures (7 pages) cost ~2.5-3 min on their own, so keep all 7, run them with a 300s
timeout or background polling and trap restore, never by sampling fewer categories (that hides
per-item N+1s). Keep running this checklist yourself and treat `govard audit run --checks lint` as
the shared lint gate; never present a lint-only pass as a performance verdict.

> **This is a checklist, not a menu.** All 9 steps under **Workflow** run on every invocation.
> Picking the steps that feel highest-signal for the effort and quietly dropping the rest (no
> admin creds, no Chrome DevTools MCP, "I already found a good bug") is the single most common
> failure mode of this skill: it produces a confident report that silently covers less than half
> the checklist. If a step genuinely can't run, say so in the report, under that step's own
> heading, as `Skipped: <reason>`; never by omission. The report is not done until it has been
> checked against the Audit Report Template line by line (step 10).

> **Distinguish a scoped ask from an unscoped one.** A general ask ("audit performance", "review
> this project before launch") is unscoped: all 9 steps apply, none optional. When the user's own
> words name one specific category ("just check the MySQL query count", "audit N+1s only"),
> scope the work to that category and its reference files, because running the other 8 would
> answer a different question. Either way state the scope explicitly (a "Scope" line or heading
> in the report) so the result is never mistaken for a full audit, and let no scope creep run in
> either direction: never silently expand a scoped ask back to all 9 steps, never silently narrow
> an unscoped one to whichever step already found something.

> **Read the step's reference file before the first attempt at that step.** Each "Full detail:"
> link owns its supported commands and environment traps (BusyBox grep in `govard sh`, DNS,
> Laminas renames, DB privilege walls); if two attempts fail, read it end to end before attempt
> 3. Never hand-edit `app/etc/env.php` to enable a diagnostic: it is deployment configuration,
> and a syntax error takes every Magento CLI command down.

> **Shared query-log captures require ownership.** Before step 3, acquire the
> `.performance-audit.lock` session token described in `references/database-query-profiling.md`.
> A busy or foreign lock must fail fast; never remove a lock you do not own, and never treat its
> log as evidence.

### Common ways this gets shortcut (don't)

Read [references/shortcuts.md](references/shortcuts.md) when a step feels optional or the effort looks larger than the signal: it lists the rationalizations that truncate this audit and the reality behind each.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first, code-level fixes for N+1 queries and heavy constructors follow the patterns it defines.

Part of the "QA quartet" with `magento2-linter`, `magento2-security-scan` and `magento2-dev-core`, orchestrated at PR/module/theme/project scope by `magento2-code-review`. Findings use the shared `M2-PERF-xxx` codes in `magento2-dev-core/references/severity-and-codes.md`; async/queue findings often point back to `magento2-backend-dev`.

## Audit Categories

Each category has its own reference file; read the relevant one when executing that step, not all up front. [references/audit-categories.md](references/audit-categories.md) maps the nine categories to their files.

## Quick / Deep: scope param (quick vs deep, quick 5-10m vs deep 30-45m)

The report header is mandatory: every report starts with `Scope: quick` or `Scope: deep` on its first line (quick = 3 pages, deep = 7 pages), the param name stays `scope` with those two literal values, and `deep` is the default when the caller does not specify. Read [references/scope-quick-deep.md](references/scope-quick-deep.md) when picking a mode, its page set, its thresholds, its time cap or its transport, or when you need the observed floor.

## Scripted path (default)

The measurement steps run through the bundled CLI, `node <skills>/magento2-performance-audit/scripts/perf-audit.mjs` (`discover`, `run`, `switch`, `render`), and every subcommand ends with one JSON status line, so branch on that line and never on prose output. `render --audience client` renders the client summary into `<run-dir>/client/`. Read
[references/scripted-path.md](references/scripted-path.md) when running a stage, writing
`sections.json` or rendering a report.

## Workflow

> **Query-log analysis:** use the `grep -c '## QUERY'` / `mysqldumpslow` recipes in references/database-query-profiling.md. Do not hand-grep 16-50k lines or open the log as a spreadsheet.

> No `performance` check exists and `govard audit run --checks lint` covers lint only; for one URL's profiler CSV use `--checks profiler --url <absolute http(s) url>` where it helps, otherwise run the manual captures and grep scans below.
> **If `perf-audit.mjs` cannot run here (no container, no CLI):** run the same manual Workflow steps as written (profiler + query-log captures per `references/per-page-type-audit.md` and grep scans per `references/code-level-patterns.md`).

> **Step 0, branch and environment gate, and Step 0b, discovery:** switch branches only with
> `perf-audit.mjs switch perf-audit.config.json --branch <branch>` (a forced checkout is never
> used; a checkout blocked by local changes stops with a closed reason, ask before stashing),
> ask which branch to audit when none is named and questions are supported, and if the
> project is `Down` run `govard env up` and wait for a 200 on the base URL before step 1.
> `perf-audit.mjs discover` writes `perf-audit.config.json` and never overwrites an existing one
> without `--refresh`. Read [references/setup-gates.md](references/setup-gates.md) for what the
> switch proves, what `discover` records and what `discover --enrich` adds to an older config.

**When invoked, steps 1-9 are mandatory, run in order, none optional:**
1. Execute infrastructure checks (env.php, mode, cache status), first confirm whether the target is local dev, staging, or production, since expectations differ. Full detail: `references/infrastructure-checks.md`
2. Run indexer status check, and verify cron is actually running/draining `cron_schedule`. Full detail: `references/infrastructure-checks.md`
3. Run the Per-Page-Type Audit, homepage plus 3 category (small/medium/large) and 3 product URLs, with `full_page`/`block_html`/`layout` caches disabled, verify each test page is representative first, then capture profiler + query log together, watch for a query count (and a slow block/template timer) that scales with grid size across the 3 category samples, then restore state. `perf-audit.mjs capture` and `analyze` do this (lock, warmup, settle, pass 1 and pass 2, trace pass, restore); every theme override must be rendered by at least one sample or the gate fails.
   Full detail: `references/per-page-type-audit.md`, `references/database-query-profiling.md`, and `references/html-profiler-audit.md`
4. Run Slow Query Analysis (app-level `TIME:` sort, and/or MySQL's own slow_query_log for cron/import-triggered queries the app-level log can't see), `EXPLAIN` any candidate before reporting it, and turn slow_query_log back off when done. Full detail: `references/database-query-profiling.md`
5. Trace cache invalidation efficiency, enable temporary logging (debug.log for built-in Redis/file FPC, varnishlog/ban.list for Varnish), reproduce one isolated product save with `perf-audit.mjs invalidate` (repository save in the adminhtml area, no admin credentials needed), and flag any custom code causing broad/frequent flushes beyond Magento's default targeted invalidation. Full detail: `references/cache-invalidation-audit.md`
6. Confirm which reactive/AJAX mechanism the project actually uses (sections.xml/Customer Data vs. Magewire/PWA/GraphQL or similar), then capture the AJAX footprint of a fresh/anonymous page load (Network tab) and audit accordingly, for sections.xml, check for overly broad Customer Data invalidation rules; these uncacheable requests are what crawler/bot JS execution multiplies regardless of FPC hit rate. Full detail: `references/ajax-load-audit.md`
7. Run the Core Web Vitals audit with `perf-audit.mjs cwv`: one cold run per page right after `cache:clean full_page` (a HIT is retried once after another clean, then `Skipped: no cold MISS`), then the warm runs (Lighthouse CLI, median of 3 from the full page cache), TBT recorded on every run; the Chrome DevTools MCP trace explains an LCP but cannot score it), when render delay dominates an LCP, read it per the JS-hydration guidance rather than assuming a network/image problem. Full detail: `references/core-web-vitals.md`
8. Scan `app/code` for code-level performance patterns using the grep recipes. Full detail: `references/code-level-patterns.md`
9. Draft the report with recommendations, prioritizing any finding that repeats across all 3
   page types (site-wide impact) over page-specific ones. **Always produce** `report.md`,
   `report.html` and `report.body.html` with `perf-audit.mjs render` (shared engine in
   `magento2-dev-core/scripts/report/render.mjs`, theme and contract in
   `magento2-dev-core/references/report-theme.md`), then ask, in the conversation language,
   whether and where to publish `report.html` (local file, Govard static path, a static host, or
   not at all) before pushing anything, and whether the client needs a client report too. On yes
   write `clientSummary` into `sections.json` and run `perf-audit.mjs render perf-audit.config.json --run <run-dir> --audience client`; a later client
   report reruns the same render on the existing run dir and never re-measures. Read
   [references/report-step.md](references/report-step.md) for the three tables, the client-report
   schema and the render flags.

**10. Self-verification gate, mandatory, run before presenting the report to the user:** walk
the draft report against every checkbox in the Audit Report Template
(`references/report-template.md`), one by one. Each checkbox resolves to exactly one of two
states: checked with its evidence visible above in the report, or unchecked with an explicit
`Skipped: <reason>` line next to it. A checkbox that is simply absent means step 10 has not been
done, so go back and run the missing step or add the skip reason; never publish or hand off a
report in that state. Read [references/verification-gate.md](references/verification-gate.md) for
the full walk, including the URLs-section and client-report conditions.
