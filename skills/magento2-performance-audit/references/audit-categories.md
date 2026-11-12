# Audit categories and their reference files

The nine categories, each with full commands, thresholds and edge cases in its own file.

Nine categories, each with full commands/thresholds/edge-cases in its own reference file, read the relevant file when executing that step of the Workflow below, not all up front:

| Category | Reference |
|---|---|
| Infrastructure, cache, indexer, async consumers, asset optimization, cron, security probes | `references/infrastructure-checks.md` |
| Core Web Vitals (LCP/INP/CLS, Chrome DevTools MCP trace, Lighthouse fallback) | `references/core-web-vitals.md` |
| Database query profiling: query-count tiers, query log setup, common issues, Slow Query Analysis | `references/database-query-profiling.md` |
| HTML profiler: block/template timing, tracing custom-code cost, cross-page-type signals | `references/html-profiler-audit.md` |
| Per-page-type audit (homepage + 3 category + 3 product samples, uncached) | `references/per-page-type-audit.md` |
| Cache invalidation efficiency (built-in FPC debug log + Varnish BAN tracing) | `references/cache-invalidation-audit.md` |
| Client-side AJAX/Customer Data load (sections.xml, reload storms) | `references/ajax-load-audit.md` |
| Code-level performance patterns (N+1, collection counting, heavy constructors, cache invalidation code) | `references/code-level-patterns.md` |
| Audit report template + self-verification checklist | `references/report-template.md` |
