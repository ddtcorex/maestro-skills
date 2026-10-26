<?php
// Read only: the default store's theme chain, the themes overriding the
// listing and product templates, and category and product candidates with
// their URLs. Piped to `php` inside the project container.
require 'app/bootstrap.php';
$om = \Magento\Framework\App\Bootstrap::create(BP, $_SERVER)->getObjectManager();
$om->get(\Magento\Framework\App\State::class)->setAreaCode('frontend');
$storeManager = $om->get(\Magento\Store\Model\StoreManagerInterface::class);
$store = $storeManager->getDefaultStoreView();
$storeManager->setCurrentStore($store->getId());

$themeId = $om->get(\Magento\Framework\App\Config\ScopeConfigInterface::class)
    ->getValue('design/theme/theme_id', \Magento\Store\Model\ScopeInterface::SCOPE_STORE, $store->getId());
$theme = $om->get(\Magento\Theme\Model\ResourceModel\Theme\CollectionFactory::class)->create()->getItemById((int) $themeId);
$chain = [];
$overrides = [];
while ($theme) {
    $code = $theme->getCode();
    $chain[] = $code;
    foreach (['product/list.phtml', 'product/view.phtml'] as $template) {
        if (is_file(BP . "/app/design/frontend/$code/Magento_Catalog/templates/$template")) {
            $overrides[$code] = true;
        }
    }
    $theme = $theme->getParentTheme();
}

$categories = [];
$collection = $om->get(\Magento\Catalog\Model\ResourceModel\Category\CollectionFactory::class)->create()
    ->setStore($store->getId())
    ->addAttributeToSelect(['name', 'url_key'])
    ->addIsActiveFilter()
    ->addAttributeToFilter('level', ['gt' => 1])
    ->addUrlRewriteToResult();
foreach ($collection as $category) {
    $categories[] = ['url' => $category->getUrl(), 'productCount' => (int) $category->getProductCount()];
}

$products = [];
$collection = $om->get(\Magento\Catalog\Model\ResourceModel\Product\CollectionFactory::class)->create()
    ->setStoreId($store->getId())
    ->addAttributeToSelect(['name'])
    ->addAttributeToFilter('status', \Magento\Catalog\Model\Product\Attribute\Source\Status::STATUS_ENABLED)
    ->addAttributeToFilter('visibility', ['in' => [2, 4]])
    ->addUrlRewrite()
    ->setPageSize(200);
foreach ($collection as $product) {
    $products[] = ['sku' => $product->getSku(), 'url' => $product->getProductUrl(), 'type' => $product->getTypeId()];
}

echo json_encode([
    'themeChain' => $chain,
    'themeOverrides' => array_keys($overrides),
    'categories' => $categories,
    'products' => $products,
]);
