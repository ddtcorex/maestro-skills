# Findings Report Schema

Every QA skill (`magento2-linter`, `magento2-security-scan`,
`magento2-performance-audit`, `magento2-code-review`) writes `findings.json`
and renders it through the shared engine:

```bash
node <skills>/magento2-dev-core/scripts/report/render.mjs render --layout findings --audience dev --data findings.json --out <dir>
```

The engine writes `report.md`, `report.html` and `report.body.html` (report
contract 1, see `report-theme.md`). It refuses invalid data with exit 1 and a
status line listing every error, so a report never ships with wrong counts.

## Shape

```json
{"tool":"magento2-linter","scope":"module|theme|pr|project","target":"app/code/Acme/Catalog","generatedAt":"2026-10-26T00:00:00Z","skillVersion":"x.y.z","templateVersion":1,"verdict":"2 high, 1 medium findings; no critical","summary":{"critical":0,"high":2,"medium":1,"low":0},"findings":[{"code":"M2-ARCH-001","rule":null,"severity":"high","file":"app/code/Acme/Catalog/Model/Foo.php","line":42,"message":"ObjectManager used directly","fix":"Inject the dependency"}]}
```

## Rules

- `severity` is one of the four levels in `severity-and-codes.md`: `critical`, `high`, `medium`, `low`. There is no `info` level.
- `code` is an existing code from `severity-and-codes.md`. Raw PHPCS or PHPStan output with no mapping uses the matching `M2-STYLE-xxx` code when one fits, otherwise `code: null` with the tool's rule id in `rule`. Never invent a code.
- `summary` counts must equal the number of findings per severity. The renderer enforces it.
- The verdict is generated from the counts (`2 high, 1 medium findings; no critical`); do not type it by hand.
- `magento2-code-review` merges its inputs with `scripts/merge-findings.mjs` before rendering, so performance, lint and security findings land in one report.
