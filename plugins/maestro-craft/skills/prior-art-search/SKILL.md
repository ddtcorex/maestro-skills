---
name: prior-art-search
description: Use when about to create a new skill, script, tool, package or integration, before designing or writing it, to find an existing implementation to reuse or adapt. Not for edits to existing files.
compatibility: claude, codex, opencode, copilot, dsh
---

# Prior-art search

A search costs minutes; a rebuild costs days. Before you design anything new,
prove that nothing adequate already exists. Searching only the local machine is
not enough: most prior art lives in public registries and repositories.

## When it applies

- Creating a new skill, script, CLI, library, service or integration.
- Not for editing, fixing or extending a file that already exists.

## Search order

Stop at the first **adequate** hit (it does the core job, is maintained, and its
licence allows reuse), then adapt it instead of building.

1. **Installed skills and plugins** of every agent on the machine.
2. **Local skill and script directories** the user keeps, and the current codebase
   (an existing helper, command or module often covers it).
3. **The public skills registry.** Browse <https://skills.sh>, or run the registry
   CLI **pinned to an exact version**: `npx skills@1.9.0 find <query>`. Read the
   entry and its source before installing anything. Without a version, the CLI
   executes whatever was published last.
4. **Package registries** for the stack (npm, Packagist, PyPI, crates.io, Go modules).
5. **GitHub, and Hugging Face for models**: search by the job, not by your planned
   name ("html animation to mp4", not "video-render-skill").

## Judge each candidate

For every plausible hit note: what it does, last release or commit date, licence,
maintenance signal (issues answered, releases), and fit with the user's stack.
Prefer, in order: use as is, configure, wrap, fork. Build only when no candidate
fits, or when a dependency's risk (abandoned, licence, security) costs more than
the build.

## Record the outcome

Before any design or code, tell the user, and later put in the plan or PR body:

```
Prior art
- searched: <places, queries>
- found: <name, link, version, licence, fit>  (or "none adequate")
- decision: reuse | adapt | build, because <one line>
```

A build decision without this record is not justified yet.

## Red flags

- "I know there is nothing like this" without having searched.
- Only local directories were searched.
- A registry CLI or installer run without an exact version.
- Designing the new thing's structure before the search finished.
