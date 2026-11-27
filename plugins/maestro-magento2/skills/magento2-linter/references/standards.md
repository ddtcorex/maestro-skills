# The standards the tools enforce

Installing the Magento coding standard and the Magento PHPStan extension, what to do
when either is unresolved in a container, and the standard each tool applies.


## Prerequisites

Ensure the project has required tools:

```bash
# PHPCS (Magento Coding Standard)
composer require --dev magento/magento-coding-standard --no-interaction

# PHPStan (Magento extension)
composer require --dev bitexpert/phpstan-magento --no-interaction
```

**If `phpcs --standard=Magento2` errors with "Referenced sniff ... does not
exist" or "the Magento2 coding standard is not installed"**, don't
immediately conclude the dependency is missing from the project. Check
first whether it's already resolved in `composer.lock` but just not
registered with phpcs:

```bash
vendor/bin/phpcs -i   # lists registered standards, is Magento2 there?
composer show magento/magento-coding-standard 2>&1   # resolved in the lock file?
```

If the package IS in `composer.lock` (common cause: `magento-coding-standard`
registers phpcs's `installed_paths` via a Composer plugin/post-install
script, and that script simply never ran in this container/environment), a
plain `composer install` fixes it, it re-runs the package scripts without
touching the lock file. Seeing `Nothing to install, update or remove` is the
expected, safe outcome; it's still worth then re-running `vendor/bin/phpcs
-i` to confirm `Magento2` now appears before assuming the fix worked. Only
report the ruleset as genuinely unavailable (an environment gap worth
surfacing in a review's Coverage note) if it's absent from `composer.lock`
entirely or `composer install` doesn't fix the registration.

**The same "try `composer install` before concluding coverage is blocked"
check applies to PHPStan when a reviewed diff adds a new `composer.json`
require.** A PHPStan run against a class that extends an unresolved
dependency reports every single method on it as undefined, `Class X
extends unknown class Y`, then every inherited call cascades into `Call to
an undefined method`. That looks identical whether the package genuinely
needs live private-repo credentials to resolve, or is already sitting in
`composer.lock`/the local Composer cache from a prior `composer install`
elsewhere in the same environment (dependencies get cached by version, not
by branch). Don't assume the latter requires network access you don't have, run `composer install` first and see what actually happens:

```bash
composer install --no-interaction   # uses the existing lock file, doesn't re-resolve
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon --memory-limit=1G
```

If it installs from cache with no prompt, re-run PHPStan, the "every
method undefined" noise for that dependency should disappear, and whatever
errors remain are real. Only report "PHPStan couldn't run, new dependency
not installed" in a review's Coverage note if `composer install` actually
fails or prompts for credentials you don't have.
