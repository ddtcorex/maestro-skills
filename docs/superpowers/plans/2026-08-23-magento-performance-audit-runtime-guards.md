# Magento performance-audit runtime guards implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `maestro-skills:subagent-driven-development` or `maestro-skills:executing-plans` to implement this plan task-by-task.

**Goal:** Publish concise, operationally correct runtime guardrails for Magento performance audits under Govard.

**Architecture:** `SKILL.md` supplies the workflow-level safety rule and links to reference-owned commands. Four reference files own their individual environment lesson: Magento profiler setup, BusyBox-safe search, host-side HTTP capture, and database privilege fallback.

**Tech stack:** Markdown Agent Skills, Node.js plugin validation, Claude plugin manifest validation when available.

**Spec:** `docs/superpowers/specs/2026-08-23-magento-performance-audit-runtime-guards-design.md`

## Global constraints

- Do not modify Magento runtime configuration or invent Magento CLI flags.
- Keep command authority in the reference files; do not duplicate canonical capture commands in `SKILL.md`.
- Every new reference lesson is 170-220 prose words, excluding code blocks.
- Preserve the distinction between host-side storefront curl and container-local log operations.
- Do not claim a lint-only or curl-only result is a performance audit.

---

### Task 1: Complete and validate performance-audit runtime guardrails

**Files:**
- Modify: `skills/magento2-performance-audit/SKILL.md`
- Modify: `skills/magento2-performance-audit/references/database-query-profiling.md`
- Modify: `skills/magento2-performance-audit/references/code-level-patterns.md`
- Modify: `skills/magento2-performance-audit/references/per-page-type-audit.md`

**Interfaces:**
- Produces: a reference-owned command path for profiling, code search, capture, and DB privilege fallback.
- Consumes: the existing 9-step workflow and its `Full detail:` reference links.

- [ ] **Step 1: Capture documentation RED evidence**

Give a fresh reviewer the pre-change `HEAD` content for these four references
and this pressure scenario: “Profiler commands fail in `govard sh`, a grep
recipe uses `--include`, curl from the container returns HTTP `000`, and the DB
user receives `ERROR 1227`. Produce the next safe action and report wording.”
Record every unsafe or incomplete recommendation as baseline evidence.

- [ ] **Step 2: Write minimal reference-owned guidance**

Keep `SKILL.md` limited to the rule to read the referenced procedure and the
scope/reporting constraint. Put the exact supported commands and environment
fallback in the relevant reference file. Each lesson must state the observable
failure, the safe action, and the report behavior if blocked.

- [ ] **Step 3: Capture documentation GREEN evidence**

Run the same scenario against the changed skill. It passes only if it keeps
HTTP curl on the host, chooses BusyBox-safe `find ... -exec grep`, uses the
documented Magento CLI commands rather than editing `env.php`, and records
database privilege denial as skipped while retaining app-level profiling.

- [ ] **Step 4: Run structural validation**

```bash
node --input-type=module - <<'NODE'
import { readFileSync } from 'node:fs';
const files = [
  'skills/magento2-performance-audit/SKILL.md',
  'skills/magento2-performance-audit/references/database-query-profiling.md',
  'skills/magento2-performance-audit/references/code-level-patterns.md',
  'skills/magento2-performance-audit/references/per-page-type-audit.md',
];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if ((source.match(/^\s*(?:>\s*)?```/gm) || []).length % 2) throw new Error(`${file}: unbalanced Markdown fence`);
}
NODE
npm ci
npm test
npm run build
claude plugin validate . --strict
```

Record unavailable CLI tools separately; a missing executable is not a pass.

- [ ] **Step 5: Commit**

```bash
git add skills/magento2-performance-audit
git commit -m "docs: harden Magento performance audit runtime guidance"
```
