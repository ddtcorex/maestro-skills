# The audit gate

The persistent audit gate across the four frameworks: the provider, the per-framework
standard, the checks, the scopes and the output contract.

> For generic PHP patterns (strict_types/PSR-12/Composer/PHPStan/PDO) see `php-dev-core`.

Govard's persistent audit gate for Magento 2/Mage-OS, Laravel, Symfony and WordPress. See `magento2-linter` for the full Magento policy (`--mode`, PHP matrix, provider rules, caching/rerun identity). Text output streams live like `vendor/bin/phpcs` (colorized on a TTY, capped and plain when piped); `--format json` prints a single object on stdout for agents, with diagnostics on stderr. A failed or cancelled run still renders before exiting non-zero.

The native `govard` lint provider works for all four frameworks. Detection uses framework markers (no project-level `phpcs.xml` or `phpstan.neon` is required), and each framework gets its own coding standard:

| Framework | Detection marker | Coding standard |
|-----------|------------------|-----------------|
| Laravel | `artisan` file or `laravel/framework` in `composer.json` | `PSR12` |
| Symfony | `bin/console` + `symfony/skeleton` or `symfony/framework-bundle` | `Symfony` |
| WordPress | `wp-includes/version.php` or Bedrock `web/wp/wp-includes/version.php` | `WordPress` |
| Magento 2 / Mage-OS | `bin/magento` + `magento/magento2` requirement | `Magento2` |

The supported PHP series differ per framework and per `--mode`; read them from `govard audit run --help` and the project's resolved target, not from a copy here.

> **Agents:** run `govard audit run --checks lint --format json` on the host and read the JSON (phpcs, phpstan, pub/media guard). Do not hand-parse text output or exit codes.

```bash
govard audit run --checks lint                    # text, streams live
govard audit run --checks lint --format json      # machine-clean for agents
govard audit run --checks lint,profiler --url https://shop.test/  # also capture profiler CSV
govard audit rerun --session SESSION_ID           # exact rerun by session, profiler URL included
govard audit toolchain status                     # lint image health (never pulls or builds)
```

`--mode` is validated early (`auto`, `project`, `module_in_project`, `standalone`): a typo fails with `unknown audit target mode (valid modes: ...)`. Use `--mode project` for the common case, `standalone` only for isolated packages, `module_in_project` only for Magento `app/code` modules. `--lint-provider govard` is the native provider (`--provider` is a hidden alias).

A stale lease or lock error (`is already held`) means a previous run crashed: read the message, then run `govard audit cleanup --older-than 1h` and retry. Do not delete files under `~/.govard/audit/` by hand unless the message says to.

### Lint scope: quick (diff) vs deep (project)

Keep this quick/deep mapping in sync with `magento2-performance-audit`'s `Scope: quick` / `Scope: deep` header.

| Mode | Govard scope | What it lints |
|------|--------------|---------------|
| quick | `--scope diff --base origin/master` (use `origin/main` when master is missing; check with `git rev-parse --verify origin/master`) | Changed PHP/phtml files only, from `git diff` against the base. An empty diff short-circuits as `passed`. `vendor`, `generated`, `var` and `pub/media` are always excluded |
| deep | `--scope project` | The full project up to the always-ignore boundary. Report every `Scope: deep` finding with evidence or `Skipped: <reason>` |

```bash
govard audit run --checks lint --scope diff --base origin/master --format json   # quick
govard audit run --checks lint --scope project --format json                      # deep
```

`--lint-jobs` defaults to `nproc` capped at 4 (floor 2) and must stay between 1 and the number of PHP versions the framework declares.

> **Timeout: use govard's `auto` (default), never a shell `timeout`.** `--timeout auto` estimates a framework-aware budget from the file count. Wrapping `govard audit` in `timeout 120` or `timeout 300` kills it from outside, which leaves a `cancelled` run, orphan `govard-audit-*` containers and a stale lock. Govard's own timeout cancels cleanly and prints `audit timeout ... (auto-estimated ...)` in text mode (silent in `json`). Override only when needed: `--timeout 300s`, `--timeout 10m` or `--timeout 0` (no limit).

> **Toolchain image:** `govard audit toolchain status` reports whether the lint image is present and which context digest it carries; `toolchain pull` fetches the pinned official image and `toolchain build` builds it locally. A `govard env up/pull` that cannot pull Govard's images falls back to building them locally (`--fallback-local-build`, on by default).
