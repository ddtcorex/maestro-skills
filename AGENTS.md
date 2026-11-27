# AGENTS.md

Instructions for AI agents working in this repository. `CLAUDE.md` at the repo
root is a symlink to this file, so Claude Code follows the same rules; Codex CLI
reads `AGENTS.md` directly. Edit `AGENTS.md` only — never edit `CLAUDE.md`
directly or replace the symlink with a copy.

## Workflow: Superpowers skills are mandatory

Every change to this repository MUST follow the Superpowers skill workflow, in order:

1. **brainstorming** — explore intent and design before writing anything; record the
   outcome in the PR description (`YYYY-MM-DD-<topic>-design.md` style).
2. **writing-plans** — turn the approved spec into a task-by-task plan with exact
   test and implementation sketches; plans are transient working files, deleted
   once their batch ships.
3. **executing-plans** — implement task by task with strict TDD: failing test first,
   verify RED, implement, verify GREEN, then commit that task before starting the next.

Do not skip ahead to implementation or commit while a task's tests are red.

Specs and plans: active work lives at the meta root, in
`maestro-harness/docs/specs/` and `maestro-harness/docs/plans/`, named
`YYYY-MM-DD-maestro-skills-<name>.md`. Plans are transient and deleted once the
batch ships. Once shipped, this repo commits the design record under
`docs/superpowers/{specs,plans}/`, as the meta-root `AGENTS.md` states. That
`docs/` directory does not exist in this checkout yet; create it with the first
record you commit, and never create it for in-progress work. Describe durable
outcomes in the PR description as well.

## Git workflow

- Never commit to `master` directly; start a feature branch per work session
  (`fix/...`, `feat/...`, `docs/...`). One TDD task = one commit while executing
  a plan; squash at merge time if the history reads better squashed.
- Conventional commit subjects (`fix:`, `feat:`, `docs:`, `chore:`), imperative mood.
- Open a pull request once the branch is green; link it to the plan that produced it.

## What this repo is

A dual-ecosystem plugin (`maestro-skills`, npm `@ddtcorex/maestro-skills`)
bundling the Magento 2, Govard and web framework domain skills written here,
split into one plugin per area (`src/areas.ts`). It carries no process-skill library: the forked process skills
was removed in v5, so contributors install their own process skills. Distributed via self-listing marketplaces for both
Claude Code and Codex CLI, and as a DeepSeek Harness Cordis plugin. There is no
application code beyond `src/` (the Cordis plugin); `tests/` is a vitest suite
that guards the packaged skill catalog and the plugin's own contracts, and
`pnpm verify` + `pnpm test` are the local gate. The repository *is* the plugin
(in every ecosystem at once), and its content is Markdown (`SKILL.md`) plus
a marketplace and per-area plugin manifests for each ecosystem, and one install script.

## Architecture

### Single source of truth: `plugins/<area>/skills/<name>/SKILL.md`

Every skill lives under `plugins/<area>/skills/<name>/SKILL.md` and **nowhere
else**. Each `plugins/<area>/` is a complete plugin root, which satisfies the
Claude Code loader rule (it only auto-discovers `skills/<subdir>/SKILL.md` at
the plugin root). `src/areas.ts` maps every area to its skills; the manifest
tests, the Cordis provider and the catalog tests read it, and
`tests/plugin-manifests.spec.ts` fails when a skill directory on disk and the
map disagree. Do not reintroduce a second copy of skill content anywhere (no
symlinks, no build-generated duplicates). Areas exist because Claude Code
cannot disable one skill inside a plugin: a project enables only the areas it
needs.

### One marketplace, one plugin per area, two ecosystems

- **Claude Code**: `.claude-plugin/marketplace.json` lists every area with
  `"source": "./plugins/<area>"`; each area has
  `plugins/<area>/.claude-plugin/plugin.json`. An install copies only that
  plugin directory, so a skill script must never read a file outside its own
  plugin (the perf audit reads its version from the area `plugin.json`).
- **Codex CLI**: `.agents/plugins/marketplace.json` lists the same areas with
  `{"source": "local", "path": "./plugins/<area>"}`; each area has
  `plugins/<area>/.codex-plugin/plugin.json` with `"skills": "./skills/"` (the
  Codex compatibility location; the docs prefer a root `plugin.json`, kept off
  until it can be verified against a real `codex` binary).

The marketplace `name` is `ddtcorex`, so installs read `<area>@ddtcorex`.
The **version must match everywhere**: `package.json`, the Claude
marketplace (`metadata.version` and every entry), and every area's Claude and
Codex `plugin.json`. `tests/plugin-manifests.spec.ts` enforces it.

### One SKILL.md format, four incompatible project-level paths, two plugin loaders

Every skill follows the [Agent Skills standard](https://agentskills.io) (a
`SKILL.md` file with `name`/`description` YAML frontmatter) — a format Claude
Code, OpenCode, Codex CLI, and GitHub Copilot all read identically. What
differs is which directory name each tool scans in a *consuming project* for
loose (non-plugin) skills, and none of them can be pointed at an arbitrary
path:

| Tool | Project-level path |
|---|---|
| Claude Code | `.claude/skills/` |
| OpenCode | `.opencode/skills/` (also checks `.claude/skills/`, `.agents/skills/`) |
| Codex CLI | `.agents/skills/` only |
| GitHub Copilot | `.github/skills/` (also checks `.claude/skills/`, `.agents/skills/`, or `chat.agentSkillsLocations`) |

This repo's `plugins/<area>/skills/` folders match **none** of those project-level
paths — it works for two tools, but for two different reasons:

- **Claude Code**'s *plugin* loader (a separate mechanism from project-level
  skill scanning) specifically looks for `skills/` at plugin root.
- **Codex CLI**, since its plugin marketplace launch, has an equivalent
  separate plugin loader — a `.codex-plugin/plugin.json` with its own
  `skills` pointer — that is likewise independent of the `.agents/skills/`
  project-level scan in the table above.

OpenCode and GitHub Copilot have no plugin-loader equivalent as of this
writing. `install.sh` exists to bridge the gap for direct (non-plugin) use on
those two tools only: it never tries to make one folder satisfy both tools,
it links per-tool into whichever directory each one actually scans. Claude
Code, Codex CLI and DSH are not installer targets — each has its own plugin
loader, and a loose copy linked beside a plugin install shadows it with a
stale cache. On DSH the Cordis plugin is the single source of truth
there, so `dsh plugin add` alone is a complete *skill* install. The agent preset is a
separate step — see the next section.

### The agent preset is a declaration row, not a directory (2026-09-22)

A DSH agent preset is an `@deepseek-ai/dsh-agent-preset` **declaration row**
carried by some bundle: row id `preset-<id>`, `config` with `id`, `plugins`,
and optional `name` / `description` / `order`. Nothing reads
`$DSH_HOME/.agent-presets/<id>/` any more — upstream states it outright:
"Before declaration rows, a user preset was a directory … Nothing reads that
directory any more."

This plugin used to materialize the base preset and the subagents variant into
that dead directory on every boot and log `DSH agent preset installed at …`.
The write changed nothing and the log misled, so the path, the
`installPreset` / `installSubagentPreset` / `presetUpgrade` config fields and
`src/preset-materialize.ts` were removed on 2026-09-29. The shipped profile
carries the real rows — `preset-maestro-skills` and
`preset-maestro-skills-subagents` in `~/.dsh/profiles/web/cordis.patch.yml`.

`.dsh-plugin/` still ships (`package.json#files`) and is the **source the
declaration rows are hand-copied from**; `tests/preset-persona-row.spec.ts`
guards the base template. `tests/no-preset-materialization.spec.ts` fails the
build if the write path or its success log ever comes back.

### Optional subagents-enabled preset variant

`src/subagent-variant.ts` is the executable definition of the
`maestro-skills-subagents` derivation: the identical `.dsh-plugin/` template
with `disabled: true` stripped from the `tool-subagent-codex` and
`tool-subagent-claude-code` rows and a `preset.yml` advertising "Maestro
Skills + Subagents (Codex + Claude)". The shipped base template keeps both rows
`disabled` (upstream default). The functions are **not called at runtime** —
regenerating the declaration row from the template is a manual edit, and these
are the tested steps for it.

Machines that installed the optional `@deepseek-ai/dsh-subagent-codex` /
`@deepseek-ai/dsh-subagent-claude-code` bundles get both delegation tools by
picking that preset; sessions must be started after the preset appears
(presets bind at session start). Design record:
`docs/specs/2026-09-02-dsh-maestro-preset-materialize-design.md`.

### Skill dependency chain

Some skills declare a non-enforced `depends:` frontmatter field documenting a
conceptual prerequisite (Claude Code's schema ignores it; it's a
cross-tool-sharing convention along with `compatibility` and `metadata`):

- `magento2-dev-core` is the foundation; `magento2-linter`,
  `magento2-performance-audit`, `magento2-security-scan`,
  `magento2-hyva-dev`, `magento2-frontend-dev`, `magento2-backend-dev`, and
  `magento2-code-review` all declare `depends: [magento2-dev-core]`.
- `govard-toolbox` is the foundation; `govard-magento` declares
  `depends: [govard-toolbox]`, and `govard-laravel`, `govard-symfony` and
  `govard-wordpress` declare `depends: [govard-toolbox, php-dev-core]`.
  `php-dev-core` itself declares `depends: [govard-toolbox]`.
- `maestro-design`, `diagram-studio` and `review-in-worktree` declare no
  `depends:` field.

When editing a dependency's SKILL.md (`magento2-dev-core`, `govard-toolbox`),
check whether the change invalidates guidance in the skills that depend on it.

### Skill names

Skill **name collisions** shadow across providers: never name a skill after a
widely installed process skill (`brainstorming`, `writing-plans` and the like).

### Adding a lesson to a skill reference file

**Version/threshold tables in prose are drift candidates.** Any table mapping versions,
thresholds, or environment facts (e.g. "Hyvä 1.4.x ships Tailwind v4") must either be replaced by
a deterministic tool call that returns the live value, or carry an explicit *verified-on date +
source* next to it. Unstamped tables rot silently and gate wrong decisions downstream.

**MUST:** load the `superpowers:writing-skills` skill before writing content, not
just as a style check afterward — it governs testing and structure, not only length.

**MUST:** budget ~170–220 words of prose per lesson (a `>` callout or `##` section
documenting one real finding), excluding code blocks — this hub's own established
house style. Measure the section in isolation before calling it done:
```bash
sed -n '/## Lesson Heading/,/## Next Heading/p' path/to/file.md | sed '/```/,/```/d' | wc -w
```
This has been missed and fixed after the fact **twice** (0.4.13→0.4.14,
0.4.14→0.4.15 — see CHANGELOG.md). Both times the overage came from narrating the
investigation ("first I thought X was the cause, then I discovered Y") — state the
corrected mechanism directly, don't walk the reader through how you got there.

### `install.sh` design

One-line installer/updater (`curl -fsSL .../install.sh | bash`). Key points if
modifying it:

- **Clone-once-to-cache, link-out-per-tool**: clones this repo into
  `~/.maestro-skills` (override: `MAESTRO_SKILLS_HOME`; the legacy
  `AGENT_DEV_SKILLS_HOME` still works when the new var is unset); re-running
  the same command is the update path (`git pull --ff-only` + re-link) — there
  is no separate `update.sh`. Only tools without a plugin loader are
  installer targets (OpenCode, Copilot): Claude Code, Codex CLI and DSH each
  have their own plugin loader, and a loose copy linked beside a plugin
  install shadows it with a stale cache (on DSH the preset-layer
  `skill-filesystem` wins duplicate names outright).
- **TTY handling follows the rustup-init.sh pattern**: `[ -t 0 ]` for a real
  interactive stdin, else fall back to `< /dev/tty` if `[ -t 1 ]` (stdout is
  still a real terminal even though stdin was consumed by the `curl | bash`
  pipe), else silently use defaults (CI-safe). Don't replace this with a
  plain `read` — it will hang or misbehave under `curl | bash`.
- **Manifest-based safety**: every path it creates is recorded in
  `$CACHE_DIR/.manifest`. A pre-existing path not in that manifest is treated
  as user-owned and skipped unless `--force` — this is what stops the
  installer from clobbering a user's own hand-written skill of the same name.
  Don't remove this check to "simplify" the linking loop.
- Env vars mirror the flags and are prefixed `MAESTRO_SKILLS_*` (`_HOME`,
  `_SCOPE`, `_TARGET`, `_SKILLS`, `_MODE`) — keep this prefix if adding new
  configurable behavior. The old `AGENT_DEV_SKILLS_*` names remain as fallbacks
  for existing setups.

## Commands

The DSH plugin half is gated by `pnpm verify` (typecheck) and `pnpm test`
(vitest: packaged skill catalog, manifests, and the plugin's own contracts).
Everything else validates structurally (does the plugin manifest resolve
correctly?) and, for `install.sh`, behaviorally (does it actually link/unlink
files correctly?).

```bash
# Validate plugin + marketplace manifest (must be run from repo root)
claude plugin validate . --strict

# Inspect what the plugin loader actually resolves (skills found, token cost)
claude --plugin-dir plugins/maestro-magento2 plugin details maestro-magento2

# Full local install/uninstall round-trip against the working tree (not a
# published release) -- always clean up after testing, this registers real
# state in the local Claude Code config:
claude plugin marketplace add .
claude plugin install maestro-magento2@ddtcorex
# ... test ...
claude plugin uninstall maestro-magento2@ddtcorex
claude plugin marketplace remove ddtcorex

# Codex CLI has no `plugin validate` subcommand -- the only real check is a
# live round-trip. Use $CODEX_HOME to keep it out of your real Codex config:
export CODEX_HOME=$(mktemp -d)
codex plugin marketplace add .
codex plugin list --available --json   # confirm every <area>@ddtcorex is listed
codex plugin add maestro-magento2@ddtcorex
codex plugin list --json               # confirm it installed and every skill resolved
unset CODEX_HOME                       # the temp dir is disposable -- nothing else to clean up

# install.sh: syntax check and dry test in an isolated scratch dir (never
# test --scope personal against your real $HOME -- override HOME and
# MAESTRO_SKILLS_HOME to a scratch path first). Note: install.sh's REPO_URL
# points at GitHub, so testing local/uncommitted changes to skills/ requires
# either a temporary local git remote (init+commit a scratch copy and point
# REPO_URL at it) or pushing first -- git clone never sees uncommitted work.
bash -n install.sh
bash install.sh --help
```

## Release checklist

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which
validates the manifests, extracts the matching `## [X.Y.Z]` section from
`CHANGELOG.md`, and publishes a GitHub Release automatically — there is no
manual release step in the GitHub UI.

1. Add a new `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`
   (Keep a Changelog format: `### Added` / `### Changed` / `### Fixed` etc.).
2. Bump `"version"` to the same value in `package.json`,
   `.claude-plugin/marketplace.json` (`metadata.version` and every entry) and
   every `plugins/<area>/.claude-plugin/plugin.json` and
   `plugins/<area>/.codex-plugin/plugin.json`. `pnpm test` fails on any
   mismatch.
3. If a skill changed, run `claude plugin validate . --strict` and
   `claude --plugin-dir plugins/<area> plugin details <area>` locally first; for a
   change that affects Codex specifically, also run the
   `codex plugin marketplace add .` / `codex plugin add` round-trip from the
   Commands section above. If `src/` (the DSH Cordis plugin) changed, run
   `npm run build` (`tsc`), this is the only local DSH-side check available;
   there is no local equivalent of the Claude/Codex marketplace-add round-trip
   (`npx cordis` fails locally: the installed `@deepseek-ai/cordis` package
   depends on `@deepseek-ai/cordis-plugin-loader`, which is not a project
   dependency here). The real DSH validation gate is external and CI-only,
   the `awesome-dsh-plugin` submission check that reads `dsh.bundle.patch`
   (see the `[1.0.4]` CHANGELOG entry for the manifest shape it expects).
4. Merge the release-prep PR first (master is never a push target), then tag and push only the tag:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z - <one-line summary>"
   git push origin vX.Y.Z
   ```
5. Confirm the workflow succeeded and the release published:
   ```bash
   gh run list --repo ddtcorex/maestro-skills --limit 1
   gh release view vX.Y.Z --repo ddtcorex/maestro-skills
   ```
6. If the workflow fails on the changelog-extraction step, it's almost always
   because the `## [X.Y.Z]` header in `CHANGELOG.md` doesn't exactly match the
   pushed tag's version (the workflow strips a leading `v` from the tag and
   looks for `[X.Y.Z]` literally). The release workflow's manifest-validation
   step also runs `jq empty` on every area `plugin.json` and
   `.agents/plugins/marketplace.json` now, a JSON syntax error in either
   fails the release the same way a bad `.claude-plugin/*.json` always did.

## Lessons from past incidents

- **Hand-rolled frontmatter parsing must be tested against real skill files.**
  The original parser silently returned an empty description for every
  `description: |` block scalar, which crippled skill selection in plugin
  mode for all domain skills. `src/frontmatter.ts` folds block scalars and
  `tests/skills-catalog.spec.ts` guards the whole catalog against the
  filesystem — extend that spec (not ad-hoc greps) when adding catalog rules.
- **Command samples must match how Govard actually dispatches.** `govard tool`
  is a host-side Cobra command; no Govard binary ships inside project
  containers, so `govard sh -c "govard tool …"` nests a missing binary and
  always fails. The catalog spec rejects that nesting pattern — keep it that
  way when writing new command examples.
- **Do not claim Govard-native coverage the audit subsystem lacks.**
  `govard audit` implements the `lint` check (PHPCS + PHPStan + the pub/media
  PHP guard), the `profiler` check (since v1.64.0), and the container-free
  `integrity` check; any other `--checks` value is rejected. QA-trio skills
  must state that boundary instead of implying native security/performance
  gates exist.
- **Skill lists are duplicated across README and AGENTS.md.** README prose
  carries no skill counts on purpose (`src/areas.ts` is the truth). When adding or
  removing a skill, update the README tree and compatibility matrix and the
  `depends:` chain above in the same change; the catalog spec fails when a
  shipped domain skill is missing from README or a dependent skill is missing
  from AGENTS.md. `package.json` and `.dsh-plugin/` descriptions still carry
  counts and must be kept in step by hand.

- **Always request approval before merge or release:** never merge a PR/MR or publish a release (`git tag`/`pnpm publish`/`gh release`) without an explicit human approval — request review (`gh pr ready` / `gh pr request-review` / ask in chat) and wait for `APPROVED`.
