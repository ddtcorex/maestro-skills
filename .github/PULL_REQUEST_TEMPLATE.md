## Summary

Describe the change in 2–3 bullets.

## Why

Explain the problem this PR solves and why this approach was chosen.

## Changes

- [ ] Code / skill content updated
- [ ] Tests added or updated (if behavior changed)
- [ ] Documentation updated (if needed)
- [ ] Version bumped in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, and `package.json` (if release-relevant)

## Validation

Paste exact commands and outcomes (do not claim verified without evidence):

```bash
pnpm verify
pnpm test
pnpm build
```

Additional checks (when relevant):

```bash
claude plugin validate . --strict
bash -n install.sh
```

## Linked Issues

Fixes #

## Checklist

- [ ] Branch is `feat/...`, `fix/...`, or `docs/...` off `master` (no direct commits to `master`)
- [ ] Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) in imperative mood
- [ ] Followed the Superpowers 3-phase workflow (brainstorming → writing-plans → executing-plans with TDD) where applicable
- [ ] `pnpm verify` / `pnpm test` / `pnpm build` are green
