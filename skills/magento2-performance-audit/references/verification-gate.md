# Step 10: the self-verification gate

The checkbox walk, the two states every checkbox must resolve to, and what a malformed URLs
section fails on. The rule is in `SKILL.md`.

**10. Self-verification gate, mandatory, run before presenting the report to the user:**

> **Pacing: do not inflate setup.** Run the reference-owned setup commands one at a time, then move directly into captures. If setup for a step takes more than a couple of calls, stop and read that step's reference file instead of iterating through unsupported variants.

Walk the draft report against every checkbox in the Audit Report Template (`references/report-template.md`), one by one. For each checkbox, exactly one of these must be true:
- It's checked, with evidence for it visible somewhere above in the report (a command output, a query-log count, a traced file:line).
- It's unchecked, with an explicit `Skipped: <reason>` line next to it (missing credentials, no Chrome DevTools MCP, environment doesn't apply).

A checkbox that is simply absent from the report, not checked, not marked skipped, just not mentioned, means step 10 hasn't been done yet. Go back and either run the missing step or add the skip reason; don't publish or hand off the report in that state. A report whose URLs section shows a cutoff URL without the full target visible (dev: absolute URL, client: full URI) fails the gate the same way. Only once every checkbox resolves to one of the two states above is the audit actually finished, both `report.md` and `report.html` (identical content, see step 9) must exist and have been checked against the template; publish `report.html` only if the user chose to in step 9 (otherwise keep both locally). A client report passes the same gate on its own: `render --audience client` exited clean (narrative present, every figure a token), and when it ships branded, the brand and PDF checks of a branded report skill, if your setup has one, passed.
