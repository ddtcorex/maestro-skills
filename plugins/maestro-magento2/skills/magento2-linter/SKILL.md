---
name: magento2-linter
description: Use when running phpcs, PHPStan or PHPMD, checking coding standards, code smells or unused code, or verifying quality before commit. Keywords phpcs, PHPStan, PHPMD. DEPENDENT on magento2-dev-core.
compatibility: claude, codex, opencode, copilot, dsh
depends: [magento2-dev-core]
metadata:
  audience: developers
  workflow: magento
---

# Magento 2 Linter

## When to use

Load this skill to run the automated quality checks; it is DEPENDENT on magento2-dev-core for the standards it validates.

- "check coding standards", "run phpcs", "lint my code", "run PHPStan analysis", "run static analysis on this module"
- "find security issues in code", "check code complexity", "find code smells", "detect unused code"
- "audit custom code", "verify code quality before commit"

This skill runs automated code quality checks to verify Magento 2 coding standards compliance.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first, this skill validates code against the coding/security standards that skill defines, and its patterns are what you fix findings with.

Part of the QA trio with `magento2-security-scan` (deeper vulnerability scanning) and `magento2-performance-audit` (runtime/infrastructure checks), run all three before a release. Fix findings using the patterns in `magento2-dev-core` (or the relevant frontend/backend/Hyvä skill).

## Govard-Native Lint Audit Is the Real Gate

`govard audit run --checks lint` is Govard's persistent, native lint gate for Magento 2 projects
and modules, and running it for real is a **required step before telling a user a branch is
"verified" or "ready to push", not an optional nice-to-have**. Govard implements (since v1.64.0)
three audit checks: `lint` (PHPCS + PHPStan + the pub/media PHP guard, see
`references/native-audit.md`), `profiler` (the Magento stock profiler CSV through the project's
own web server, step 2 below) and `integrity` (no container); any other `--checks` value fails
with `audit check %q is not implemented`. A bare local `vendor/bin/phpcs`/`phpstan` invocation
(see "Scoping" below) is a fast pre-check, not proof the branch is clean, since it can diverge
from the native run in either direction (see `references/divergence.md`). Never substitute a
bare-tool "0 errors" for a real `govard audit run`, and never present local-only results as if
the real gate had passed.

Work through the audit in this order:

1. **Resolve target.** `--mode` (`auto`, `project`, `module_in_project`, or `standalone`) picks what gets analyzed: `auto` (the default) classifies the current directory itself, and forcing a mode fails outright when the directory does not support it. Read [references/native-audit.md](references/native-audit.md) when you need the three classifications spelled out.
2. **Run it:** `govard audit run --checks lint` (`lint` is the default `--checks` value, so plain
   `govard audit run` is equivalent). Add `,profiler` plus `--url` to capture a page profile too:
   `govard audit run --checks lint,profiler --url https://<domain>/`; a bare `govard audit rerun
   --session <id>` repeats the latest run's check selection, profiler URL included. Use
   `--format json` for agents (one machine-clean object on stdout, diagnostics on stderr) and
   `--format text` (the default) for humans (live Docker logs, findings colorized and uncapped on a TTY, plain and
   capped at 10 when piped); a `FAILED`/`CANCELLED` run still prints the full summary before
   exiting non-zero.
3. **For standalone iteration only**, optionally narrow the PHP matrix with `--php 8.1,8.4`.
   `--php` on `project`/`module_in_project` targets is only accepted when it repeats the
   project's own active `stack.php_version`, it can't widen or narrow those targets'
   single-version run.
4. **Treat these outcomes distinctly, none of them means "clean code" except the last:** an `infra_error` never produced a real lint result, so never present it as "no findings", and only a completed run with zero findings is a clean result. Read [references/native-audit.md](references/native-audit.md) when a run reports `unsupported_php`, `infra_error` or `cancelled`.
5. **If the team has configured an external provider** (`audit.lint.external_providers` in the
   project config), run it explicitly as an *additional* policy gate, not a substitute for the
   native run: `govard audit run --lint-provider team-ci`, `team-ci` here is just an example
   name; `--lint-provider` takes the provider's name directly, and that name and its definition
   come entirely from the project's own config (there's no bundled vendor-specific provider, and
   no separate flag for it). An external provider is never inferred and never a fallback for the
   native backend: an unknown `--lint-provider` name is an error, and a native failure stays a
   native failure. A `standalone` target has no project configuration to source
   `audit.lint.external_providers` from, so `govard` is the only provider available there.
6. **Never describe a host-project approximation as standalone matrix proof.** Running bare
   `vendor/bin/phpcs`/`phpstan` against a module nested inside a large host project is a fast
   local pre-check, not evidence of what an isolated `standalone` matrix run would find, the
   host project's own `vendor/`/`generated/` can hide or fabricate results in either direction
   (see `references/standalone-packages.md`). If the module qualifies
   as `standalone`, `govard audit run` is the authoritative check; fall back to a manual isolated
   install only when Govard itself isn't available.

**Scoping is a target, not a file list.** `govard audit run --scope diff --base <ref>` does
narrow the lint: Govard resolves the changed PHP/phtml files, writes them to `diff-files.txt`,
hands that file to the container (`GOVARD_LINT_DIFF_FILE`) and short-circuits as `passed` when
nothing relevant changed. What it cannot take is a file list you resolved yourself, so a review
that already has one still runs the native gate by diff or by module (`module_in_project`) and
splits its findings into diff-introduced and pre-existing afterwards (see
`magento2-code-review`'s scope-modes reference). One caveat remains: the evidence block still
reports `effective_scope: project` whatever the base ref, so read the run's file scope from
`diff-files.txt`, not from that field.

### The lint run's pub/media PHP guard (M2-LINT-MEDIA)

Read [references/native-audit.md](references/native-audit.md) when a run reports `M2-LINT-MEDIA`, asks about PHP versions, or needs a rerun, a status or a result for an earlier session.

## Running the Linter

> **Lint:** run `govard audit run --checks lint --format json` on the host and read the JSON (phpcs, phpstan, pub/media guard). It is machine-clean: one JSON document on stdout, diagnostics on stderr. Never hand-parse text output or exit codes; text mode is capped at 10 findings and colorized, so it is not for agents.

## Prerequisites

Read [references/standards.md](references/standards.md) when a toolchain is missing, when phpcs does not list `Magento2`, when PHPStan reports every inherited method as undefined, or when you need the standard each tool enforces.

## Local Bare-Tool Runs Can Diverge from the Native Toolchain

Read [references/divergence.md](references/divergence.md) when a bare-tool run and the native run disagree, or before trusting a bare-tool result in a review.

## Standalone Composer Packages Need Isolated Verification

Read [references/standalone-packages.md](references/standalone-packages.md) when the module has no Magento project above it, or when a private dependency will not resolve.

## In-Project `app/code/` Modules: Native `module_in_project` Scoping

Never `cd` into the module to lint it: the native toolchain mounts the whole project read only so the autoloader resolves. Read [references/module-in-project.md](references/module-in-project.md) when linting one module inside a larger Magento project.

## Capabilities

Read [references/capabilities.md](references/capabilities.md) when you need what a check covers, the code it reports, or the severity a rule maps to.

## Usage

### Basic Scan

Run against custom modules:

```bash
# PHPCS only
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --colors

# PHPStan only
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon --memory-limit=1G

# Both (recommended)
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module && \
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon
```

### Targeted Scan

Scan specific file types:

```bash
# PHP files only
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=php

# PHTML templates
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=phtml

# XML (layout, config)
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=xml,xsl
```

### In Govard Environment

```bash
govard sh -c "vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module"
govard sh -c "vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon"
```

## Scoping

Accepts either a directory (the examples above) or an explicit space-separated
file list, both PHPCS and PHPStan take file arguments natively:

```bash
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php
vendor/bin/phpstan analyse app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php -c phpstan.neon
```

The Security Pattern Detection greps need the same file list looped instead
of a directory glob:

```bash
for f in app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php; do
  grep -Hn "ObjectManager::getInstance\|\$_GET\|\$_POST\|\$_REQUEST\|eval(" "$f"
done
```

`magento2-code-review` derives this file list from a git diff or an MR fetch
and calls this skill with it directly, the git/glab mechanics themselves
live there, not here.

## Interpreting Results

A bare `phpcs`/`phpstan` run is judged by its exit code, never by whether the output looks like the clean examples: a PHP 8.4 deprecation flood from the tool's own code does not change that code. Read [references/interpreting-results.md](references/interpreting-results.md) when reading real output or mapping a finding to its code.

## Auto-fix Capabilities

Read [references/autofix-and-ci.md](references/autofix-and-ci.md) when fixing what phpcs can fix, or wiring the tools into a pipeline or a pre-commit hook.

## Findings report

PHPCS, PHPStan and the custom pattern greps feed one report. Write every finding to `findings.json` in the shared schema (`magento2-dev-core/references/findings-schema.md`): `tool: "magento2-linter"`, the four severities only, a code from `severity-and-codes.md` (or `code: null` with the tool's rule id in `rule`), and `summary` counts that match the findings. Then render it:

```bash
node <skills>/magento2-dev-core/scripts/report/render.mjs render --layout findings --audience dev --data findings.json --out <report-dir>
```

The engine writes `report.md`, `report.html` and `report.body.html` with the shared theme and report contract, so a brand overlay works on this report the same way as on a performance audit. It refuses mismatched counts and unknown codes with exit 1; fix the data, never the rendered file.

## Exit Codes

Neither PHPCS nor PHPStan combines into a project-wide table. PHPCS exits `0` on a clean run, `1` on errors it cannot fix, `2` on errors some of which
are fixable (`phpcbf` fixes those), and `3` on a processing error; PHPStan exits `1` on
findings and `2` on an internal error. A shell snippet chaining them reports only the last
code, so a hook that special-cases `1` misses the commonest PHPCS failure.
Govard has its own, capability-first contract: `3` = `CAPABILITY_MISSING` (a
declared runtime capability such as docker is unavailable), `2` = usage, `4` =
project configuration, and `govard audit` findings surface as run status, not as
an exit code. So read each tool's own status and the run report, never a single
shared `0` to `4` table.

## Workflow Integration

Run it before commits (pre-commit hooks), in CI/CD, during code review and after major
refactoring; for a full codebase audit including performance, see `magento2-performance-audit`.