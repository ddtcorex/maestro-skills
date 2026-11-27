# Maestro Skills (`maestro-skills`)

A unified skills library for AI coding agents, packaged as a universal plugin for **DeepSeek Harness (DSH)**, **Claude Code**, **Codex CLI**, **OpenCode**, and **GitHub Copilot**:

- **Domain skills** — **Govard** development-environment orchestration and its supported web frameworks (**Magento 2**, Laravel, Symfony, WordPress, generic PHP): architecture, linting, performance auditing, security scanning, code review, Hyvä/Luma frontend, backend APIs, plus `php-dev-core` and `diagram-studio`.
Every skill follows the open [Agent Skills standard](https://agentskills.io) (a `SKILL.md` file with `name`/`description` frontmatter), which all major AI Agent tools understand.

> **Works best with [Govard](https://github.com/ddtcorex/govard).** Most command examples in the domain skills assume a Govard-managed dev environment (`govard sh -c "..."`, `govard tool magerun ...`) — without it, you'll need to adapt them to your own container/CLI setup. One-line install: `curl -fsSL https://raw.githubusercontent.com/ddtcorex/govard/master/install.sh | bash`.

---

## 📂 Directory Structure

Every skill lives under `plugins/<area>/skills/<name>/SKILL.md`, one plugin per area, so you enable only the areas a project needs:

| Area plugin | Skills |
|---|---|
| `maestro-govard` | govard-toolbox, govard-magento, govard-laravel, govard-symfony, govard-wordpress, review-in-worktree |
| `maestro-magento2` | magento2-dev-core, magento2-backend-dev, magento2-frontend-dev, magento2-hyva-dev, magento2-linter, magento2-code-review, magento2-performance-audit, magento2-security-scan |
| `maestro-php` | php-dev-core |
| `maestro-design` | maestro-design, diagram-studio |
| `maestro-craft` | prior-art-search |


```
maestro-skills/
├── README.md                        # Global documentation and guide
├── package.json                     # NPM package & DSH Cordis Plugin manifest (@ddtcorex/maestro-skills)
├── tsconfig.json                    # TypeScript compiler configuration
├── src/                             # DSH Cordis Plugin source code
│   ├── index.ts                     # Cordis plugin entrypoint: serves the packaged skills (the agent preset is a declaration row, see Installation)
│   └── dsh-types.d.ts               # DSH type definitions
├── .dsh-plugin/                     # DeepSeek Harness Agent Preset definition
│   ├── preset.yml                   # Web GUI preset display metadata ("Maestro Skills")
│   └── agent.cordis.yml             # DSH Agent preset composition
├── .claude-plugin/marketplace.json  # Claude Code marketplace: one entry per area plugin
├── .agents/plugins/marketplace.json # Codex marketplace: one entry per area plugin
├── src/areas.ts                     # The area to skills map that tests and the provider read
│
└── plugins/<area>/                  # one plugin per area (see the table above)
    ├── .claude-plugin/plugin.json
    ├── .codex-plugin/plugin.json
    └── skills/<name>/SKILL.md
```

---

## 🤖 Skill Compatibility Matrix

Every skill works identically on every listed tool.

| Group | Skills | Claude Code | Codex CLI | OpenCode | GitHub Copilot | DeepSeek Harness |
|---|---|---|---|---|---|---|
| Core & Standards | [magento2-dev-core](plugins/maestro-magento2/skills/magento2-dev-core/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Linting & Auditing | [magento2-linter](plugins/maestro-magento2/skills/magento2-linter/SKILL.md), [magento2-performance-audit](plugins/maestro-magento2/skills/magento2-performance-audit/SKILL.md), [magento2-security-scan](plugins/maestro-magento2/skills/magento2-security-scan/SKILL.md), [magento2-code-review](plugins/maestro-magento2/skills/magento2-code-review/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frameworks | [magento2-hyva-dev](plugins/maestro-magento2/skills/magento2-hyva-dev/SKILL.md), [magento2-frontend-dev](plugins/maestro-magento2/skills/magento2-frontend-dev/SKILL.md), [magento2-backend-dev](plugins/maestro-magento2/skills/magento2-backend-dev/SKILL.md), [maestro-design](plugins/maestro-design/skills/maestro-design/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toolchains (Govard) | [govard-toolbox](plugins/maestro-govard/skills/govard-toolbox/SKILL.md), [govard-magento](plugins/maestro-govard/skills/govard-magento/SKILL.md), [govard-laravel](plugins/maestro-govard/skills/govard-laravel/SKILL.md), [govard-symfony](plugins/maestro-govard/skills/govard-symfony/SKILL.md), [govard-wordpress](plugins/maestro-govard/skills/govard-wordpress/SKILL.md), [review-in-worktree](plugins/maestro-govard/skills/review-in-worktree/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| PHP Foundation | [php-dev-core](plugins/maestro-php/skills/php-dev-core/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Diagrams | [diagram-studio](plugins/maestro-design/skills/diagram-studio/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 💾 Installation

### 1. DeepSeek Harness (DSH) — as a plugin (recommended)

One command is a complete install. The plugin serves every area by default; set `areas` in its config row (for example `areas: [maestro-magento2, maestro-govard]`) to serve only some:

```bash
dsh plugin --profile web add github:ddtcorex/maestro-skills
```

Then restart `dsh web`. No install.sh needed.

**The agent preset is a separate, explicit step.** Skills and presets are two different
mechanisms: the plugin registers a skill provider, but a preset is an
`@deepseek-ai/dsh-agent-preset` **declaration row** that some bundle has to carry. To get
**"Maestro Skills"** in the Web GUI agent picker, copy the two files from this package's
`.dsh-plugin/` into a `dsh-agent-preset` row in the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: preset-maestro-skills
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: maestro-skills
        name: "Maestro Skills"
        description: "AI Agent preset bundling the maestro-skills library"
        plugins:          # the entry list from .dsh-plugin/agent.cordis.yml
          - id: …
```

> This plugin used to copy that directory into `~/.dsh/.agent-presets/maestro-skills/` on
> every boot and log that the preset was installed. DSH stopped reading that directory when
> presets became declaration rows (2026-09-22) — the write changed nothing and the log
> misled. The template still ships in `.dsh-plugin/` because declaration rows are copied
> from it by hand.

**Codex + Claude delegation preset (optional bundles, optional preset):** when the web
profile also installs the two optional subagent bundles (`@deepseek-ai/dsh-subagent-codex`
and `@deepseek-ai/dsh-subagent-claude-code`), add a second declaration row for
**"Maestro Skills + Subagents (Codex + Claude)"** — the same composition with
`subagent_codex` and `subagent_claude_code` tool rows enabled, so the model can delegate to
those products through their official app-server/SDK result contract instead of whichever
CLI happens to be on `PATH`. `src/subagent-variant.ts` is the executable definition of that
derivation. Both providers authenticate via their native subscription login, so
quota-limited accounts may see provider-side quota errors until the limit resets.

The package builds itself on install via its `prepare` script. pnpm ≥ 10 blocks git-dependency build scripts until you allow them — if the first add reports an ignored build, copy the key pnpm prints into the profile's `pnpm-workspace.yaml` and re-run:
```yaml
allowBuilds:
  '@ddtcorex/maestro-skills': true
```

To reference the plugin from a hand-written patch layer instead, the row must name the real package:
```yaml
- insert:
    - id: maestro-skills
      name: '@ddtcorex/maestro-skills'
```

> Do not link skills into `~/.dsh/skills/` (the old `install.sh --target dsh`
> path, removed): the preset-layer `skill-filesystem` provider would shadow
> the plugin with a stale cache. The plugin is the single source of truth
> on DSH.

---

### 2. Claude Code — as a plugin
```bash
/plugin marketplace add ddtcorex/maestro-skills
/plugin install maestro-magento2@ddtcorex   # one line per area you want
```
Updates: `/plugin marketplace update ddtcorex`.

---

### 3. Codex CLI — as a plugin
```bash
codex plugin marketplace add ddtcorex/maestro-skills
codex plugin add maestro-magento2@ddtcorex   # one line per area you want
```
Updates: `codex plugin marketplace upgrade ddtcorex`.

---

### 4. OpenCode & GitHub Copilot — loose skill files (no plugin loader there)

```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/maestro-skills/master/install.sh | bash
# or only some areas:
curl -fsSL https://raw.githubusercontent.com/ddtcorex/maestro-skills/master/install.sh | bash -s -- --area maestro-magento2,maestro-govard
```

| Tool | Scans (project scope) | Scans (personal scope) |
|------|------------------------|--------------------------|
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.copilot/skills/` |

> The installer only serves tools without a plugin loader. On Claude Code,
> Codex CLI and DSH, install the plugin (sections 1-3 above) instead of
> linking loose files: a loose copy shadows the plugin with a stale cache.
> Upgrading from an install that used the removed `claude`, `codex` or `dsh`
> targets: run `install.sh --uninstall` once (it removes every path the
> installer recorded, old targets included), then rerun the installer for
> OpenCode or Copilot only.

---

## ⚡ Extension Guide: Adding New Domain Skills

You can easily expand this hub with any new framework or toolchain supported by Govard (e.g., Laravel, Symfony, React, Vue, Docker, etc.).

### Step 1: Create the Skill Folder
Create `plugins/<area>/skills/[framework/tool]-[purpose]/` using kebab-case (e.g., `plugins/maestro-php/skills/laravel-dev-core/`), and add the name to that area in `src/areas.ts`. A new area also needs its two plugin manifests and an entry in both marketplaces.

### Step 2: Create a `SKILL.md` File
Every skill folder **must** contain a `SKILL.md` file at its root with valid YAML frontmatter:

```markdown
---
name: your-skill-name
description: |
  Describe exactly when the AI Agent should trigger this skill.
compatibility: claude, codex, opencode, copilot, dsh
depends: [any-dependencies-if-applicable]
---

# Your Skill Title

## Capabilities
Describe what this skill enables the agent to do.

## Best Practice Patterns
Provide code templates, standards, and typical commands.

## Verification
Step-by-step commands to verify output works properly.
```

---

*Govard domain expertise in one bundle.* 🚀

## Contributing

Changes follow the Superpowers workflow mandated in [AGENTS.md](AGENTS.md):
brainstorming → writing-plans → executing-plans with strict TDD. Feature
branches only; never commit to `master` directly.

## Credits & Attribution

- **Skills**: © DDTCoreX, MIT License (see `LICENSE`).
