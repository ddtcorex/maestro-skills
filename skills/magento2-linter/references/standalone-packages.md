# Standalone Composer packages

Linting a module that has no Magento project above it, including the isolated install
when Govard is unavailable.


If the module under test is a standalone Composer package (own `composer.json`, developed as its
own git repo, installed into a host project's `vendor/<vendor>/<package>`), `govard audit run`
from inside that package's own directory (with no Magento project anywhere above it) resolves
`standalone` mode automatically and installs its dependencies into a scratch worktree for you, this is the native, authoritative way to get isolated results, and it's what "Never describe a
host-project approximation as standalone matrix proof" above is telling you to prefer. The manual
isolation procedure below is a fallback for when Govard itself isn't available, not the default
path.

- **Private Composer dependencies need `--allow-lint-ssh-agent`.** If the package requires a
  private Git/Composer dependency, the scratch-worktree install needs the host's SSH agent to
  fetch it: pass `--allow-lint-ssh-agent` (forwards `SSH_AUTH_SOCK` into the lint container). This
  is opt-in per run and never forwarded automatically, without it, expect the install to fail
  with `infra_error` rather than a clean or a findings result.

Running phpcs/phpstan against the package *nested inside* a large host project's
`vendor/<vendor>/<package>` (bypassing `govard audit run` entirely) can give misleading results in
both directions:
- PHPStan may resolve the host project's own `generated/code/` factory classes and report a
  narrower set of errors than the package's own CI ever sees, because a standalone package
  install has no `generated/` directory at all (no `bin/magento` context to generate one).
- Conversely it may fail to resolve classes the package's own dependency tree would otherwise
  provide, because the host project's autoloader silently takes precedence.

If `govard audit run` genuinely isn't available, install the module **in isolation** by hand
instead: copy it (excluding `.git`, `vendor`, `composer.lock`) into a scratch directory, run
`composer install --no-dev` there against its own `composer.json`, and run phpcs/phpstan against
that isolated copy instead of (or in addition to) the nested `vendor/` path. This reproduces
what `govard audit run --mode standalone` already automates, and it's the only manual way to
catch host-project-only false negatives/positives before they surface in the real gate.

> **`cd` into the scratch directory before invoking phpstan, isolating the `vendor/` being
> analysed isn't enough on its own.** PHPStan auto-detects `vendor/autoload.php` relative to the
> *current working directory*, not relative to wherever `-c`/`--configuration` points. On one
> real check, phpstan was invoked as `php <tools>/vendor/bin/phpstan analyse -c
> <scratch>/phpstan.neon <scratch>` from the *host* project's directory, it silently picked up
> the host's own `vendor/autoload.php` (which had `phpunit/phpunit` installed for the host's own
> test suite) instead of the scratch copy's. The isolated check reported 0 errors; the real
> isolated run, executed directly, reported 121, every test class extending PHPUnit's
> `TestCase` had cascaded into "undefined method" findings once the *actual* isolated autoloader
> (with no PHPUnit available) was in play. Always `cd` into the scratch directory first, then
> invoke phpcs/phpstan from there, don't just point `-c`/a target path at it from elsewhere.

> **A standalone package's `Test/` directory can be unanalysable under a real `--no-dev` CI
> install, even with correct isolation.** `phpunit/phpunit` is what makes
> `Magento\Framework\TestFramework\Unit\BaseTestCase` (and `PHPUnit\Framework\TestCase` itself)
> resolvable, but it only belongs in `require-dev`, and `--no-dev` skips it, so a package that
> never explicitly requires it (the common case: Magento doesn't force this dependency on you)
> will always fail to resolve every test class once truly isolated, independent of anything in
> the package's own code. Putting `phpunit/phpunit` in a real `require` "fixes" this but bloats
> every production install of the package with a test framework, not a trade worth making just
> to satisfy a lint pass. If the CI's install step can't be changed to include dev dependencies,
> the pragmatic fix is excluding `Test/` from that package's own `phpstan.neon`
> (`excludePaths: [Test/*]`) with a comment explaining why, rather than chasing a dependency
> placement that doesn't actually fix anything under `--no-dev`.

> **When the package uses a `src/`-rooted PSR-4 layout, `Test/` belongs inside `src/`, not next to
> it.** If `composer.json` maps the module's namespace to `src` (e.g. `"Vendor\\Module\\": "src"`),
> test classes need that same root to autoload, so `Test/` has to live at `src/Test/...`, not as
> a sibling directory at the package root. Placed outside `src/`, it silently fails to autoload,
> and a phpstan config scoped to `paths: [src]` will skip it entirely without any error, giving a
> false sense of full coverage.
