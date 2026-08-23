# Magento performance-audit runtime guards design

## Goal

Make the Magento 2 performance-audit skill steer agents toward the supported,
repeatable profiler workflow when Govard containers differ from a normal host
shell.

## Scope

Document four observed operational boundaries:

1. Enable/disable Magento HTML profiling and query logging with the supported
   Magento CLI commands; never edit `app/etc/env.php` or invent flags.
2. Use BusyBox-safe code-search commands when executing inside `govard sh`.
3. Send storefront requests from the host while using `govard sh` only for
   container-local log operations.
4. Treat denied database-global logging privileges as an explicit skipped
   diagnostic level, while retaining app-level query-log analysis.

## Design

`SKILL.md` remains the workflow index. It states the non-negotiable safety
rules and links to the relevant reference before an agent attempts the step.
The canonical commands and environment-specific rationale remain in the four
reference files, so the command surface has one owner and can evolve without
duplicated instructions drifting.

Each added lesson is a standalone 170-220 word reference callout, excluding
code blocks. It states the observable environment condition, the supported
command or fallback, and the report behavior when a capability is unavailable.
The wording prevents unsafe recovery attempts but does not claim a browser
audit can be replaced by curl.

## Verification

Before merge, validate Markdown fences and internal reference links, inspect
the added lessons for the required word budget, run repository tests/build
after installing declared development dependencies, and run the Claude plugin
manifest validation if the CLI is available. A pressure review must confirm
that a future agent chooses the documented commands, reports a privilege
blocker, and keeps curl on the host.

## Non-goals

This change does not add a Govard performance CLI, modify Magento runtime
configuration, change audit scope rules, or claim completion of the separate
Govard-native Magelint implementation.
