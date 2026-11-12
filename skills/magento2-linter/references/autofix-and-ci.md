# Auto-fix and CI

What phpcs can fix by itself, and how to wire the bare tools into a pipeline or a hook
where Govard is not available.


Some PHPCS issues can be auto-fixed:

```bash
# Auto-fix fixable issues
vendor/bin/phpcbf --standard=Magento2 app/code/Vendor/Module

# Common auto-fixable issues:
# - Line ending normalization
# - Trailing whitespace
# - PSR-12 formatting
# - Docblock formatting
```

**Note:** PHPStan cannot auto-fix issues - requires manual correction.

## CI Integration

The examples below wire the bare tools directly into a pipeline, useful if a project doesn't
run Govard at all. Where Govard is available, `govard audit run --checks lint` (see
"Govard-Native Lint Audit Is the Real Gate" above) is the native equivalent and includes the
Magento-aware PHPStan extensions and per-PHP-version isolation these bare invocations don't.

### GitHub Actions

```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: php-actions/composer@v6
      - name: Run PHPCS
        run: vendor/bin/phpcs --standard=Magento2 app/code
      - name: Run PHPStan
        run: vendor/bin/phpstan analyse app/code -c phpstan.neon
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running code quality checks..."

vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module
if [ $? -ne 0 ]; then
    echo "PHPCS failed. Please fix errors before committing."
    exit 1
fi

vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon
if [ $? -ne 0 ]; then
    echo "PHPStan failed. Please fix errors before committing."
    exit 1
fi

echo "Code quality checks passed!"
```
