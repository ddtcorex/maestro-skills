# The shortcuts that truncate this audit

Every rationalization that has trimmed this checklist in practice, and the reality behind
each. The rule it serves is in `SKILL.md`: all 9 steps run on every invocation.

| Rationalization | Reality |
|---|---|
| "Infra/cache/indexer checks already give strong signal, that's enough" | Slow Query Analysis, Cache Invalidation Efficiency, and Client-Side AJAX Load each catch bug classes the others structurally cannot see, one being clean says nothing about the others |
| "I already found a solid N+1, that's enough for a report" | A real finding proves the audit found *something*; it doesn't prove the mandatory steps ran. Finding a bug early is not a reason to stop the checklist |
| "One category and one product page is representative enough" | Only 3 differently-sized samples per type can surface the size-scaling N+1 signal (`references/per-page-type-audit.md`), a single sample is provably unable to show it, however clean the one page looks |
| "This step needs admin credentials / a Chrome DevTools MCP I don't have" | Mark that section **unverified** with the reason, in the report, don't drop it from the conversation as if it were never in scope |
| "The draft report already has good findings, ship it" | Diff the draft against every checkbox in the Audit Report Template *before* presenting it as done, an unchecked box with no skip reason means the audit isn't finished, not that it's fine to omit |
| "This query shape (or profiler timer) repeats/is slow but I don't think it's a real bug" | Not your call to make silently, list it in the Repeated Query Shapes or Slowest Blocks/Templates table (`references/report-template.md`) with your assessment anyway. A borderline case left out of the report is indistinguishable from one that was never checked |
| "The user only asked about query counts, so I only ran that" | Correct *if* their own words named that one category, say so under a Scope heading. If their ask was general ("audit performance", "review this project"), this is the same shortcut as the rows above, just dressed up as scoping |
| "There's no `dev:profiler:enable` / `dev:query-log:enable` flag, so I'll add one to `env.php` / patch a bootstrap script" | These are CLI diagnostics, not config flags. Use the exact commands in `references/database-query-profiling.md` and `references/per-page-type-audit.md`; never edit `env.php` or add a one-off bootstrap script |
| "The reference's grep recipes don't work in `govard sh`, so I'll write my own" | The container's grep is BusyBox, no `--include`. `find app/code -name '*.php' -exec grep -Hn ... {} +` is the supported equivalent (recipes in `references/code-level-patterns.md` are already BusyBox-safe) |
