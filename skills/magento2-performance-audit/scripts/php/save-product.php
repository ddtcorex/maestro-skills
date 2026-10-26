<?php
// Piped to `php --` inside the project container; never copied into the
// project. Saves one product through the repository in the adminhtml area so
// plugins, observers, indexers and cache tag cleaning run as on an admin
// save. The SKU arrives as $argv[1], never interpolated into this source.
require 'app/bootstrap.php';
$om = \Magento\Framework\App\Bootstrap::create(BP, $_SERVER)->getObjectManager();
$om->get(\Magento\Framework\App\State::class)->setAreaCode('adminhtml');
$repository = $om->get(\Magento\Catalog\Api\ProductRepositoryInterface::class);
$product = $repository->get($argv[1]);
// AbstractDb::save() returns early without changes; force the full save path.
$product->setHasDataChanges(true);
$repository->save($product);
echo "saved\n";
