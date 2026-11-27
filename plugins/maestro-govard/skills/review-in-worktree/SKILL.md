---
name: review-in-worktree
description: Use when reviewing code in a worktree outside a Govard project directory, when govard tool cannot find the project config, or when a detached review tree needs Govard commands.
compatibility: claude, codex, opencode, copilot, dsh
---

# Reviewing in Detached Worktrees

## When to use

Load this skill when a review tree sits outside the Govard-managed project directory, for example a merge-request review tree under /tmp.

- "govard tool cannot find the project"
- "review in a worktree"
- "detached review tree"
- "review tree under /tmp"

## Why Govard Commands Fail Here

`govard tool …` resolves the project from a `.govard.yml` found upward from
the current directory and dispatches into that project's running app
container. A bare review worktree (created with `git worktree add` for a
merge request) carries neither the config nor a running environment, so
project-routed Govard commands fail by design.

## Option 1: Point at the Owning Checkout (preferred, read-only intent)

If the branch under review belongs to a Govard project that is already up
(`govard up` ran in the real checkout), resolve the environment from there:

```bash
cd /path/to/real-checkout && govard status
```

There is no environment variable for this: Govard resolves its project from the
current directory, and the only path override in the CLI is
`govard verify --project <path>`. Verify with `govard status` before anything else. Treat this as read-only
context for your review; never run mutations (migrations, cache flushes,
indexers) against the owning project's database because a review asked for it.

## Option 2: Bootstrap a Throwaway Config

Only when the review must execute code and no owning environment exists:

```bash
govard init          # detects the framework, writes .govard.yml in the worktree
govard up            # brings up an isolated stack named after this directory
```

Clean up afterwards so review trees do not leak containers:

```bash
govard down && git worktree remove ../<worktree>
```

## Option 3: Static Analysis Only (most MR reviews)

Most automated reviews only need the diff, repository history, and the domain
skills (`magento2-code-review`, `magento2-linter` guidance). Prefer this
when the reviewer has no container rights or the MR is not meant to run.

The `integrity` check needs no container, but it still needs a project Govard can
resolve: run from a bare worktree with no `.govard.yml` it fails with
`no framework can resolve audit target` (or `load audit project config: .govard.yml not
found`), so it is not a way to analyse a detached tree on its own.

```bash
# From the owning checkout, or any directory inside a Govard project:
govard audit run --checks integrity --scope project --format json

# From a Magento module directory outside a project, with an explicit target:
govard audit run --checks integrity --mode standalone --path app/code/Vendor/Module --format json
```

For a truly detached worktree, run the analysers themselves (a `php:8.x-cli` container or
the host) rather than `govard audit`, or bootstrap the worktree first (Option 2).

It reports composer manifest/lock problems and Magento module/DI wiring problems
(`govard-integrity` findings) and is a different body of evidence from lint,
never present it as a substitute for `--checks lint`, which does need Docker.
Exit codes: `0` clean, `1` findings, `3` a required capability is missing
(`--error-json` prints the versioned envelope). Review the `integrity.json`
artifact referenced by the run result for the exact finding list.

## Guardrails

- Never run govard from inside a production or shared staging checkout.
- A worktree shares the repository with its main checkout: rebases or
  `git worktree remove` affect both, coordinate before cleaning up.
- Database state is per project, not per worktree: two worktrees of one
  project share data through the same stack.
