# Govard native audit detail

What each `--mode` classifies, what a non-finding outcome means, the pub/media PHP
guard's first response, the supported PHP matrix, and how a run is identified and
re-run. The workflow itself is in `SKILL.md`.

## The three `--mode` classifications

   - `project`: current directory is a Magento project root (`bin/magento` plus a Magento
     Composer requirement) with no enclosing module, the whole project is analyzed.
   - `module_in_project`: current directory is a module (`etc/module.xml`, or a Composer package
     of type `magento2-module`) inside a Magento project, only the module is analyzed, with the
     whole project mounted read only so its autoloader resolves correctly.
   - `standalone`: current directory is a module with no Magento project anywhere above it, only the module is analyzed, with its dependencies installed into a scratch worktree.
   `--mode project` / `--mode module_in_project` / `--mode standalone` all force that
   classification and fail outright when the directory doesn't support it, useful to catch a
   misresolved `auto` guess rather than silently linting the wrong scope.

## The non-finding outcomes

   - `unsupported_php`: the requested PHP version isn't valid for this target (see "PHP
     versions" below); no container ran.
   - `infra_error`: a pull/build/Docker/dependency-resolution/report-schema failure. The run
     never produced a real lint result; never present this as "no findings." For a `standalone`
     target, a dependency-resolution failure while pulling a private Git/Composer dependency is a
     common cause, see "Standalone Composer Packages Need Isolated Verification" below for the
     `--allow-lint-ssh-agent` remedy.
   - `cancelled`: the run was stopped before completing; not a pass.
   - lint findings, PHPCS/PHPStan findings on an otherwise-completed run. This is the actual
     signal to act on.
   Only a completed run with zero findings is a clean result.

## The pub/media PHP guard, PHP versions and run identity

Since Govard v1.64.0, every `govard audit run --checks lint` also flags each PHP file found
under `pub/media`, no extra flag, no opt-in. It reaches the report as `rule: M2-LINT-MEDIA`
with `code: null`: that string is not in `severity-and-codes.md`, and the renderer rejects it
as a `code` (`is not an M2 code; use null with rule for unmapped tool output`). Treat these findings as a security incident, never as style noise: PHP files under
`pub/media` are a classic webshell drop zone (often disguised as images with a `GIF89a` header
followed by PHP code) and, depending on server configuration, may be directly executable via
their public URL.

First response when they appear:

1. Extract the full file list from the report (findings whose `rule` is `M2-LINT-MEDIA`).
2. Quarantine the files (move them out of the webroot; do not just delete evidence).
3. Check web-server access logs for requests to those paths to determine whether they were
   ever executed.
4. Investigate the upload vector that planted them (custom options, quote uploads, third-party
   modules), then rerun the audit and expect zero media findings before calling the project
   clean.

### PHP versions

The lint image provides `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, and `8.5`.

- **`project` and `module_in_project`** analyze exactly one version, the project's active
  `stack.php_version`, and accept any of the seven. The run is refused outright when a running
  application container reports a different PHP than the configuration does.
- **`standalone`** accepts `8.1` through `8.5` and defaults to all five; `7.4` and `8.0` are
  **not** available there and are rejected (`unsupported_php`) before any image is pulled,
  built, or run.

PHP 8.0 is real, supported analysis input for `project`/`module_in_project` targets, not a
stub, but the toolchain has **two independent version splits**, not one:

- **PHPStan / `bitexpert/phpstan-magento`:** `8.0` alone pins an older major (PHPStan `^1.12`,
  `bitexpert/phpstan-magento` `^0.19`) than the other six versions (PHPStan `^2.2`,
  `bitexpert/phpstan-magento` `^0.43`).
- **PHPCS / `magento/magento-coding-standard`:** `7.4` and `8.0` both pin `^4.0`, while `8.1`
  through `8.5` pin `^40.0`, a *different* split that groups `8.0` with `7.4` instead of against
  it.

Because the two axes disagree on where the line falls, no PHP version's findings are safely
comparable to any other's across both tools at once. Treat every PHP version's run as its own
baseline: don't compare rule IDs or findings across different PHP versions at all, for either
tool.

### Caching, rerun identity, and read-only source

- **Cache:** reusable analyzer state lives under `~/.govard/cache/audit/lint/<target-id>/`, keyed
  per toolchain identity (image, runner, PHP matrix, analyzer policy). Changing
  `composer.json`/`composer.lock`/`phpcs.xml`/`phpstan.neon` (or their `.dist` variants) discards
  the cached analyzer state but keeps the Composer download cache warm, a lock change doesn't
  force a full dependency re-download. `--no-lint-result-cache` forces a fresh analyzer pass for
  one run (reported back as cache state `bypassed`) without discarding the Composer download
  cache. `audit cleanup --older-than <duration>` prunes old *sessions*, never this cache.
- **Rerun identity:** every run is recorded under an explicit `<session-id>/runs/<run-id>/`.
  `govard audit rerun`, `status`, and `result` all require the exact `--session` value returned
  by the original run (`result` also needs `--run`), Govard never guesses "the latest session,"
  so a rerun is always traceable to the run it's re-checking, not a fresh unrelated one.
- **Read-only source:** the source tree is always mounted read only into the lint container, a
  lint run cannot modify the code it analyzes. Auto-fix, if wanted, is still the separate bare
  `phpcbf` route (see "Auto-fix Capabilities" below).
