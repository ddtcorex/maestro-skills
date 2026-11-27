# Quick and deep scope

The two modes, their page sets, thresholds, file scope, time caps and transport, with the
observed floor for a deep audit.

This skill accepts a `scope` param: `quick` (PR check, cap 5-10m) or `deep` (release audit, 30-45m). The value `quick.*deep` on one line is intentional for tooling checks, keep the param name `scope` with those two literal values. Default to `deep` when the caller does not specify; callers that need a fast PR signal pass `scope=quick`.

Observed floor (reference large-project audit, verified 2026-09-21, deep scope): ~22m / 144 tool calls / ~332k tokens for the **whole audit**: setup, 7 captures, both passes, analysis, and report writing. Captures alone are only ~2.5-3 min of that (see `references/per-page-type-audit.md`); the rest is reading, cross-page analysis and the report. Use the total for the foreground/background + budget decision; it is an observation, not a commitment.

> **Report header (mandatory):** every report starts with `Scope: quick` or `Scope: deep` on its first line (see `references/report-template.md`). Quick uses `Scope: quick, 3 pages (1 home + 1 category + 1 product)`, Deep uses `Scope: deep, 7 pages (1 home + 3 category small/medium/large + 3 product)`. Do not start a report without that line, it is how a reader tells PR vs release coverage at a glance.

| Mode | Pages | Query-log call-stack | Query-time threshold | Files scope | grid_per_page | Time cap | Transport & restore |
|------|-------|----------------------|----------------------|-------------|---------------|----------|---------------------|
| quick | 3 pages (1 home + 1 category + 1 product), call-stack false, threshold 1, quick files, grid_per_page 48, cap 5-10m | `--include-call-stack=false` | `--query-time-threshold=1` | quick files (`app/code` + `app/design` + `app/etc` sampled, batch govard sh) | 48 | 5-10m | `grep -c '## QUERY'` recipes; batch govard sh single setup cmd; trap single |
| deep | 7 pages double-pass (1 home + 3 category small/medium/large + 3 product), call-stack true, threshold 0, deep files, 30-45m | `--include-call-stack=true` (two-pass: pass 1 false for counts, pass 2 true for 1-2 traces) | `--query-time-threshold=0` | deep files (full `app/code` + `vendor`/`dev`/`lib`/`m2-hotfixes` to the ignore boundary) | prod `grid_per_page`/`list_per_page` | 20-30m | Same native-or-grep split; batch govard sh where possible; trap single (one `trap ... EXIT` for the whole session) |

Key verbatim mapping for quick 3 pages small/medium/large call-stack false threshold 1 quick files grid_per_page 48 cap 5-10m vs deep 7 pages double-pass call-stack true threshold 0 deep files 30-45m, keep these values in sync with `references/per-page-type-audit.md` and `references/database-query-profiling.md`.

> **Use the recipes, not hand-reading:** do not open 50k lines of `var/debug/db.log` as a spreadsheet. Use the `grep -c '## QUERY'` / `mysqldumpslow` / `pt-query-digest` recipes in `references/database-query-profiling.md`. For lint use `govard audit run --checks lint --format json` on the host.

> **No stats tool exists for the query log.** Do not hand-grep 16-50k lines; use the `grep -c '## QUERY'` / `mysqldumpslow` recipes below.

> **Batch govard sh + trap single:** collapse multi-step container setup (`mkdir .performance-audit.lock`, `dev:profiler:enable`, `dev:query-log:enable`, `cache:disable`, `cache:flush`, warmup) into one `govard sh -c '...'` round-trip where sequencing allows, single-quoted outer, `;`-sequenced (never `&&` around `grep`), see `govard-toolbox` § *govard sh -c quoting*; captures themselves stay sequential under the same lock. Always install a single `trap 'govard sh -c '\''bin/magento cache:enable; bin/magento cache:flush; bin/magento dev:profiler:disable; bin/magento dev:query-log:disable; rm -rf var/debug/.performance-audit.lock'\''' EXIT`, one trap for the entire audit, not per page, so a timeout restores caches/log/lock.
