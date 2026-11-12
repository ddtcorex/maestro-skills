# Interpreting results

Real tool output, including the PHP 8.4 deprecation flood, the exit code to trust, and
the shape of a PHPCS, PHPStan and security finding.


The examples below show clean, isolated tool output. On PHP 8.4+ (older PHPCS,
PHPMD and PHPStan builds included; the pinned toolchain ships PHPCS 3.13.6 and
PHPStan 2.2.9), running these commands for
real against a modern stack commonly prints dozens of lines of
`Deprecated: strpos(): Passing null...`-style PHP-8.4-compatibility notices
mixed in with the actual findings, this is noise from the tool's own code,
not a project finding, and it does not change the tool's exit code. Never
judge success/failure by whether the output "looks like" the clean examples
below; always check the real exit code explicitly:

```bash
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module; echo "EXITCODE:$?"
```

A batch run that's actually clean still exits `0` underneath the
deprecation noise, an exit-code check is what tells the two apart, not the
shape of the printed output.

### PHPCS Output

```
FILE: app/code/Vendor/Module/Controller/Index/Index.php
---------------------------------------------------------------------------
FOUND 3 ERRORS AFFECTING 2 LINES
---------------------------------------------------------------------------
 12 | ERROR | Missing license header
 45 | ERROR | [x] Expected 1 space after TYPE hint; 0 found
 67 | ERROR | [x] Public property name "_products" must not be prefixed with
      |       | an underscore
---------------------------------------------------------------------------
```

### PHPStan Output

```
 ------ ---------------------------------------------------------------
  Line   Model/ProductRepository.php
 ------ ---------------------------------------------------------------
  23     Call to an undefined method ProductInterface::getSkuAttribute().
         💡 Did you mean getCustomAttribute()?
 ------ ---------------------------------------------------------------

 [ERROR] 1 error
```

**`Call to an undefined method Vendor\Class::setFoo()`/`getFoo()` is a
common false positive**, not just noise from missing extensions in
general, specifically, almost every Magento Block/Model class extends
`Magento\Framework\DataObject` (directly or via `AbstractBlock`/
`AbstractModel`), which implements a magic `__call()` covering arbitrary
`get*`/`set*`/`has*`/`unset*` accessors backed by an internal data array.
`bitexpert/phpstan-magento` teaches PHPStan about this; without it, every
such call reports as undefined, real or not. Before accepting *or*
rejecting one of these findings, look for a **working precedent of the
exact same method name on the exact same class (or a sibling that clearly
shares the pattern) elsewhere in the codebase**, a genuinely-working
`$obj->setRows($x)` / `$obj->getRows()` pair used successfully by other
callers of the same class is strong evidence it's a real (if PHPStan-blind)
magic accessor, not a defect. Conversely, a method call with no such
precedent anywhere in the class's actual ancestor chain, especially one
copied from a *different, unrelated sibling class* that happens to define
its own same-named real method, is worth escalating rather than dismissing
as "probably just PHPStan noise." On one real review, `Renderer::setRows()`
turned out to be the legitimate magic-accessor pattern (the vendor's own
`Rows.php`/`MultiService.php` call it identically, and its own
`.phtml` template consumes it via `getRows()`), while a sibling class's
`$this->getLinkUrl($url)` call, no such method existed anywhere in *that*
class's ancestor chain, only on unrelated sibling widget classes that each
define their own, was a real, previously-undetected bug: it silently fell
through to the magic getter and always returned an empty URL instead of
throwing, making it easy to miss without checking the ancestor chain
directly.

### Security Findings

```
⚠️  Security Pattern Detected
File: app/code/Vendor/Module/Controller/SearchController.php:34
Pattern: $_GET
Recommendation: Use Magento\Framework\App\RequestInterface

⚠️  Direct SQL Query
File: app/code/Vendor/Module/Model/ResourceModel/Custom.php:12
Recommendation: Use Collection or Repository
```
