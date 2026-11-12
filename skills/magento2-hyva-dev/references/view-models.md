# View models

The view model contract, registration and the patterns the theme expects.

Prefer view models (Magento's `Magento\Framework\View\Element\Block\ArgumentInterface`, which Hyva's own view models implement) over blocks for passing data to templates: they keep PHP logic out of the theme directory (which should hold only templates, layout, `i18n`, and `web/` assets) and in a proper `app/code` module where Magento's DI can autoload the class.

```php
// app/code/Vendor/Module/ViewModel/ProductInfo.php
declare(strict_types=1);

namespace Vendor\Module\ViewModel;

use Magento\Framework\View\Element\Block\ArgumentInterface;
use Magento\Framework\View\LayoutInterface;

class ProductInfo implements ArgumentInterface
{
    public function __construct(
        private readonly LayoutInterface $layout
    ) {}

    public function isInStock(): bool
    {
        $product = $this->layout->getBlock('product.info')->getProduct();
        return $product && $product->isInStock();
    }
}
```

```xml
<!-- Magento_Theme/layout/default.xml -->
<referenceBlock name="product.info">
    <arguments>
        <argument name="product_info_view_model" xsi:type="object">Vendor\Module\ViewModel\ProductInfo</argument>
    </arguments>
</referenceBlock>
```

```php
<?php
/** @var \Vendor\Module\ViewModel\ProductInfo $productInfoViewModel */
// A layout <argument> is block data, not a template variable: read it from the block.
$productInfoViewModel = $block->getData('product_info_view_model');
?>
<?php if ($productInfoViewModel->isInStock()): ?>
    <button class="btn-cart">Add to Cart</button>
<?php endif; ?>
```
