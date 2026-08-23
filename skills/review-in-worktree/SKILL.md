---
name: review-in-worktree
description: |
  Use this skill when reviewing code isolated in a Git worktree outside a
  Govard-managed project directory (for example Maestro merge-request review
  trees under /tmp), when "govard tool" cannot find the project configuration,
  or when asked to run Govard-managed commands against a detached review tree.
compatibility: claude, codex, opencode, copilot, dsh
---

# Reviewing in Detached Worktrees

## Why Govard Commands Fail Here

`govard tool …` resolves the project from a `.govard.yml` found upward from
the current directory and dispatches into that project's running app
container. A bare review worktree (created with `git worktree add` for a
merge request) carries neither the config nor a running environment, so
project-routed Govard commands fail by design.

## Option 1 — Point at the Owning Checkout (preferred, read-only intent)

If the branch under review belongs to a Govard project that is already up
(`govard up` ran in the real checkout), resolve the environment from there:

```bash
GOVARD_PROJECT_DIR=/path/to/real-checkout govard status
```

Verify with `govard status` before anything else. Treat this as read-only
context for your review; never run mutations (migrations, cache flushes,
indexers) against the owning project's database because a review asked for it.

## Option 2 — Bootstrap a Throwaway Config

Only when the review must execute code and no owning environment exists:

```bash
govard init          # detects the framework, writes .govard.yml in the worktree
govard up            # brings up an isolated stack named after this directory
```

Clean up afterwards so review trees do not leak containers:

```bash
govard down && git worktree remove ../<worktree>
```

## Option 3 — Static Analysis Only (most MR reviews)

Most automated reviews only need the diff, repository history, and the domain
skills (`magento2-code-review`, `magento2-linter` guidance). Prefer this
when the reviewer has no container rights or the MR is not meant to run.

## Guardrails

- Never point `GOVARD_PROJECT_DIR` at production or shared staging checkouts.
- A worktree shares the repository with its main checkout: rebases or
  `git worktree remove` affect both — coordinate before cleaning up.
- Database state is per project, not per worktree: two worktrees of one
  project share data through the same stack.
