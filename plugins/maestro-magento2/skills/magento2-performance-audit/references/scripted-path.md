# The scripted path

The bundled CLI: its subcommands, the stages `run` chains, what `sections.json` must hold
and what the render writes.

The measurement steps run through a bundled CLI; this file stays the specification, the scripts are the default way to satisfy it. Every subcommand ends with one JSON status line (`{"ok":true,...}` or `{"ok":false,"reason":"Skipped: ..."}`), so branch on that line, never on prose output.

```bash
CLI=<skills>/magento2-performance-audit/scripts/perf-audit.mjs
node $CLI discover --root <project> --base-url https://<domain> --out perf-audit.config.json   # once; frozen for later audits
node $CLI run perf-audit.config.json --out <audit-dir> --branch <base>                         # deep by default
node $CLI switch perf-audit.config.json --branch <changed>
node $CLI run perf-audit.config.json --out <audit-dir> --run-name <changed> --compare <audit-dir>/<base>
```

- `perf-audit.mjs run` chains `capture`, `analyze`, `cwv`, `invalidate` and `render` (plus `switch` when `--branch` is given) into `<audit-dir>/<branch-slug>/`. The first closed reason stops it; fix the cause and rerun only that stage (`perf-audit.mjs <stage> perf-audit.config.json --run <run-dir>`). A template update only needs `render`.
- The agent-run steps (1, 2, 4, 6, 8) and the recommendations go into `<run-dir>/sections.json` (`meta`, `sections.<name>`, `recommendations`, `coverageNote`). Every number there needs `evidence: {command, excerpt}`; `render` refuses a section number without it. Verdict, KPI subtitles and query bullets are generated from the data; never type them.
- Budget: a deep audit takes 30 to 45 minutes (two capture passes, a trace pass and a median of 3 warm Lighthouse runs per page); quick takes about 10 minutes.
- Output: `report.md`, `report.html`, `report.body.html` (for hosts that wrap pages, such as Claude Artifact) and `findings.json` (merged by `magento2-code-review`). `render --audience client` renders the client summary into `<run-dir>/client/`: four key figures, takeaways, prioritized next steps with client decisions, a results table with bars per page, how to read the results and a glossary, for a baseline or a comparison alike. It needs a `clientSummary` block in `sections.json` (schema and metric tokens: `references/report-template.md`, Client report); a missing or inconsistent block is a render error, never a fallback to developer content.
