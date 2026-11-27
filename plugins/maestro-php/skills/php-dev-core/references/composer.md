# Composer

The validate, audit, install, outdated and update commands, and the autoloading and script
rules behind them.

Composer is the single source for dependencies, autoloading, and scripts.

```bash
composer validate --strict                           # validate before commit
composer audit                                       # known vulnerabilities (needs a lock file)
composer install --no-dev --optimize-autoloader      # CI/production
composer outdated                                    # check outdated
composer update vendor/package --with-dependencies   # update with care
```

Version constraints: prefer `^` (caret) for semver (`^8.1` allows `8.x` but not `9.0`). Never commit `vendor/`; always commit `composer.lock` for applications, omit for libraries.

`composer.json` essentials:

```json
{
  "name": "vendor/package",
  "description": "What the package does, one line",
  "type": "library",
  "license": "proprietary",
  "require": { "php": "^8.1" },
  "autoload": { "psr-4": { "Vendor\\Package\\": "src/" } },
  "autoload-dev": { "psr-4": { "Vendor\\Package\\Tests\\": "tests/" } },
  "scripts": {
    "lint": "phpcs --standard=PSR12 src tests",
    "analyse": "phpstan analyse -c phpstan.neon",
    "test": "phpunit --testdox"
  }
}
```

`description` and `license` are not optional: `composer validate --strict` fails without them,
and a library without `autoload-dev` has nowhere to autoload its own tests.

Private package auth belongs in `auth.json` (gitignored) or env vars, never in `composer.json`.
