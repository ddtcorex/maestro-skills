# Contributing to maestro-skills

Thank you for contributing to **maestro-skills** (`@ddtcorex/maestro-skills`) — a unified skills library for AI coding agents (Magento 2 / Govard / superpowers), packaged as a Cordis plugin for DeepSeek Harness and as a Claude Code / Codex CLI plugin.

## Getting Started

1. **Fork and clone** `github.com/ddtcorex/maestro-skills`.
2. Install dependencies (requires Node.js 20+, pnpm 10+):

   ```bash
   pnpm install
   ```

3. Build the Cordis plugin (TypeScript → `lib/`):

   ```bash
   pnpm build        # runs tsc
   ```

4. Open the project in your editor. Each skill lives at `skills/<name>/SKILL.md` — the single source of truth. Do not create duplicate copies or symlinks.

## Superpowers 3-Phase Workflow (AGENTS.md)

Every change to this repository **MUST** follow the Superpowers skill workflow defined in `AGENTS.md`, in order:

1. **brainstorming** — explore intent, requirements, and design before writing code. Record the outcome in the PR description.
2. **writing-plans** — turn the approved design into a task-by-task plan with exact test and implementation sketches. Plans are transient working files — delete them once the batch ships.
3. **executing-plans** — implement task by task with strict **TDD**: write a failing test first, verify RED, implement, verify GREEN, then commit that task before starting the next. Do not commit while tests are red.

Do not skip ahead to implementation and do not bundle multiple TDD tasks into one commit during `executing-plans`. Describe durable outcomes in the PR body instead of committing dated spec/plan files.

## Branch Naming

Never commit directly to `master`. Start a feature branch per work session:

- `fix/<topic>` — bug fixes
- `feat/<topic>` — new features / new skills
- `docs/<topic>` — documentation-only changes

Rebase (not merge) when the base moves: `git fetch origin && git rebase origin/master`.

## Conventional Commits

All commit subjects **must** follow [Conventional Commits](https://www.conventionalcommits.org/) in imperative mood:

```
<type>(<scope>): <subject>

<body — why, not what>

Refs: #<issue>
```

- **Types (closed list):** `feat` `fix` `docs` `chore` `refactor` `perf` `test` `build` `ci` `revert`
- **Scope:** optional, without the `dsh-maestro-` prefix — e.g. `feat(skills):`, `fix(frontmatter):`, `docs(readme):`
- **Subject:** imperative, lowercase first word, ≤ 72 chars, no trailing period
- **Body:** explain *why* and trade-offs when non-trivial
- **Breaking changes:** `feat!: <subject>` plus a `BREAKING CHANGE:` footer

One TDD task = one commit while executing a plan; squash at merge time if the history reads better squashed.

## Validation

Run these before opening a PR (match depth to risk):

```bash
pnpm verify      # typecheck — tsc --noEmit (add a verify script if missing: "verify": "tsc --noEmit")
pnpm test        # vitest run
pnpm build       # tsc — ensures lib/ is not stale
```

Additional checks when relevant:

```bash
# Plugin manifests
claude plugin validate . --strict
claude --plugin-dir . plugin details maestro-skills

# install.sh
bash -n install.sh
bash install.sh --help

# Superpowers fork sync (only when updating the fork)
scripts/sync-superpowers.sh
```

Do not claim verified/done/clean without having actually run the checks — be ready to paste exact command output in the PR.

## Pull Requests

1. Push your branch and open a PR into `master`.
2. Fill out `.github/PULL_REQUEST_TEMPLATE.md` (Summary, Why, Changes, Validation, Linked Issues).
3. Link the PR to the plan that produced it when the Superpowers workflow was used.
4. Ensure CI (`pnpm verify` / `pnpm test` / `pnpm build` via `dsh-maestro-ci`) is green.

## Package Visibility

This package is public (`"private": false` — field omitted, defaults to public on npm). Never set `"private": true` in `package.json`. Publishing uses `pnpm publish --access public`.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to its terms.

## Questions or Security Reports

- General questions: open a GitHub Discussion or issue.
- Contact maintainer: [kaido4492@gmail.com](mailto:kaido4492@gmail.com)
- Security vulnerabilities: use GitHub's private advisory reporting at `https://github.com/ddtcorex/maestro-skills/security/advisories` — do not file a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
