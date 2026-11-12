# Security Best Practices Reference

This document covers security patterns and vulnerabilities in Magento 2.

## XSS Prevention

### Template Escaping

```php
<?php
/** @var \Magento\Framework\Escaper $escaper */
?>

<!-- HTML Content -->
<?= $escaper->escapeHtml($productName) ?>

<!-- HTML Attributes -->
<div class="<?= $escaper->escapeHtmlAttr($cssClass) ?>"
     data-id="<?= $escaper->escapeHtmlAttr($id) ?>">

<!-- URLs (ensure safe protocol) -->
<a href="<?= $escaper->escapeUrl($url) ?>">Link</a>

<!-- JavaScript Strings -->
<script>
    // JSON_HEX_* is what makes this safe: without it a value containing
    // "</script>" closes the tag and injects markup. escapeJs is for a
    // single quoted JS string, never for JSON.
    var config = <?= /* @noEscape */ json_encode($config, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
    var productName = '<?= $escaper->escapeJs($productName) ?>';
</script>

<!-- CSS (escape for style attributes) -->
<div style="color: <?= $escaper->escapeCss($color) ?>">

<!-- Attribute values -->
<input value="<?= $escaper->escapeHtmlAttr($value) ?>">
```

### Block Method Escaping

```php
// Nothing escapes by itself: DataObject::getData() returns the raw _data value
// and AbstractBlock::getHtml() returns _toHtml(). Neither goes through the
// escaper, so a block reading getData() and printing it is an XSS hole.
$this->getData('product_name'); // RAW: escape it before printing

// Explicit escaping, one per output context. `$block->escapeHtml()` and friends
// are deprecated since 103.0.0 (AbstractBlock), so templates use $escaper:
$escaper->escapeHtml($text);
$escaper->escapeHtmlAttr($text);
$escaper->escapeJs($text);
$escaper->escapeUrl($url);
$escaper->escapeQuote($text);
$escaper->escapeCss($text);
```

### HTML Purifier (For Rich Content)

```php
// For user-generated HTML content
use Magento\Cms\Model\Template\FilterProvider;

public function __construct(
    private readonly FilterProvider $filterProvider
) {}

public function getFilteredContent(string $html): string
{
    return $this->filterProvider->getPageFilter()->filter($html);
}
```

## CSRF Protection

### Form Key in Forms

```php
<form action="<?= $escaper->escapeUrl($block->getSubmitUrl()) ?>" method="post">
    <?= $block->getBlockHtml('formkey') ?>
    <!-- or, from an explicit FormKey block, still escaped: -->
    <input name="form_key" type="hidden"
           value="<?= $escaper->escapeHtmlAttr($block->getBlockHtml('formkey')) ?>"/>
</form>
```

### AJAX Requests

```php
// JavaScript - include form key
define([
    'jquery',
    'mage/cookies'
], function ($) {
    'use strict';

    return function (url, data) {
        // 'mage/cookies' provides $.mage.cookies; $.cookie needs the
        // separate jquery/jquery.cookie plugin and is not loaded here.
        var formKey = $.mage.cookies.get('form_key');
        return $.ajax({
            url: url,
            type: 'POST',
            data: {
                ...data,
                form_key: formKey
            }
        });
    };
});
```

### Adminhtml Controllers

```php
use Magento\Backend\App\Action;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\ResultFactory;
use Magento\Framework\Data\Form\FormKey\Validator as FormKeyValidator;

class Save extends Action
{
    // Without ADMIN_RESOURCE the controller is reachable by any admin user,
    // and _isAllowed() defaults to true.
    public const ADMIN_RESOURCE = 'Vendor_Module::thing';

    public function __construct(
        Action\Context $context,
        private readonly RequestInterface $request,
        private readonly FormKeyValidator $formKeyValidator,
        private readonly ResultFactory $resultFactory
    ) {
        parent::__construct($context);
    }

    public function execute()
    {
        if (!$this->formKeyValidator->validate($this->request)) {
            return $this->resultFactory->create(ResultFactory::TYPE_JSON)
                ->setData(['success' => false, 'error' => 'Invalid form key']);
        }
        // Continue processing
    }
}
```

`$this->_formKeyValidator` and `$this->getRequest()` come from
`Magento\Backend\App\AbstractAction`, which is deprecated since 102.0.0 (use
`ActionInterface`); inject the request and the form key validator instead.


## SQL Injection Prevention

### Wrong - Direct SQL

```php
// WRONG - SQL Injection vulnerability
$id = $this->getRequest()->getParam('id');
$collection = $this->_resource->getConnection()
    ->fetchAll("SELECT * FROM products WHERE id = $id");
```

### Correct - Parameterized Queries

```php
// CORRECT - Using Magento's resource
$collection = $this->productCollection->create()
    ->addFieldToFilter('entity_id', $id);

// OR using resource connection with binding
$connection = $this->resource->getConnection();
$select = $connection->select()
    ->from($this->resource->getTableName('products'))
    ->where('entity_id = :id');
$bind = ['id' => (int)$id];
$product = $connection->fetchRow($select, $bind);
```

## Direct Object Instantiation

### Wrong

```php
// WRONG - Service Locator anti-pattern
use Magento\Framework\App\ObjectManager;
$objectManager = ObjectManager::getInstance();
$product = $objectManager->create(\Magento\Catalog\Model\Product::class);
```

### Correct

```php
// CORRECT - Use Dependency Injection
public function __construct(
    private readonly \Magento\Catalog\Api\ProductRepositoryInterface $productRepository,
    private readonly \Magento\Catalog\Model\ProductFactory $productFactory
) {}

public function createProduct(): \Magento\Catalog\Api\Data\ProductInterface
{
    // For reading
    $product = $this->productRepository->getById($id);

    // For creation
    $product = $this->productFactory->create();
}
```

## File Inclusion

### Wrong

```php
// WRONG - Path traversal vulnerability
$file = $this->getRequest()->getParam('file');
include '/path/to/files/' . $file;
```

### Correct

```php
// CORRECT - Validate and sanitize
$file = $this->getRequest()->getParam('file');
$allowedFiles = ['config.json', 'metadata.xml', 'data.csv'];
if (!in_array($file, $allowedFiles, true)) {
    throw new \Magento\Framework\Exception\LocalizedException(
        __('Invalid file specified')
    );
}
$safePath = $this->directoryList->getPath('var') . DIRECTORY_SEPARATOR . $file;
```

## Password Hashing

### Wrong

```php
// WRONG - Plain text comparison
if ($password === $storedHash) { }
```

### Correct

```php
// CORRECT - Use Magento's encryption
use Magento\Framework\Encryption\EncryptorInterface;

public function __construct(
    private readonly EncryptorInterface $encryptor
) {}

public function verify(string $password, string $hash): bool
{
    return $this->encryptor->verifyHash($password, $hash);
}

public function hash(string $password): string
{
    return $this->encryptor->getHash($password, 10);
}
```

## Session and Cookie Security

```php
// Secure cookie settings
use Magento\Framework\Stdlib\Cookie\CookieMetadataFactory;

public function setSecureCookie(string $value): void
{
    $metadata = $this->cookieMetadataFactory->createPublicCookieMetadata()
        ->setPath('/')
        ->setDuration(86400)
        ->setSecure(true)
        ->setHttpOnly(true)
        ->setSameSite('Strict');

    $this->cookieManager->setPublicCookie('my_cookie', $value, $metadata);
}
```

## Security Checklist

- [ ] All user input escaped before output
- [ ] Form keys in all POST forms
- [ ] No direct SQL queries (use Models/Collections)
- [ ] No ObjectManager instantiation in production code
- [ ] Passwords hashed (never stored plain text)
- [ ] File uploads validated and sanitized
- [ ] Rate limiting on sensitive endpoints
- [ ] Admin URL not predictable (`/admin` changed)
- [ ] Two-factor authentication enforced for admin
- [ ] CSP allowlist declared in `csp_whitelist.xml`; report-only vs restrict mode is set per area under the `csp/mode/*` config paths (for example `csp/mode/storefront/report_only`)