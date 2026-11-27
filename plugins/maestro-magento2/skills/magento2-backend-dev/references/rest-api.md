# REST endpoints

The service contract, the data interface, the repository implementation, the
`webapi.xml` declaration and the ACL entry. The rules that bite are in `SKILL.md`.

### Service Contract Structure

```
Vendor/Module/
├── Api/
│   ├── ProductRepositoryInterface.php    # Declaration
│   └── Data/
│       └── ProductInterface.php          # Data entity
└── Model/
    └── ProductRepository.php              # Implementation
```

### Data Interface

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Api\Data;

use Magento\Framework\Api\ExtensibleDataInterface;

/**
 * Product entity interface
 */
interface ProductInterface extends ExtensibleDataInterface
{
    const ENTITY_ID = 'entity_id';
    const NAME = 'name';
    const SKU = 'sku';
    const PRICE = 'price';

    /**
     * Types live in PHPDoc only: see the note below this sample.
     *
     * @return int|null
     */
    public function getId();

    /**
     * @param int $id
     * @return $this
     */
    public function setId($id);

    /**
     * @return string
     */
    public function getName(): string;

    /**
     * @param string $name
     * @return self
     */
    public function setName(string $name): self;

    // ... other getters/setters
}
```

**PHPDoc is not optional here**: the REST serializer reads `@param`/`@return`/`@throws` PHPDoc on `Api/` interfaces via reflection to build the request/response schema, a type hint alone is not enough for the WebAPI framework to expose the field correctly.

**`getId()`/`setId()` stay untyped in the signature**: the model implementing this interface extends `AbstractModel`, whose `setId($value)` and `getId()` are untyped, so a typed `setId(int $id): self` is an incompatible signature (fatal at class load), and a `?int` return would throw a `TypeError` under `strict_types` because the database hands ids back as strings.

### Repository Implementation

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Model;

use Vendor\Module\Api\Data\ProductInterface;
use Vendor\Module\Api\Data\ProductSearchResultsInterface;
use Vendor\Module\Api\ProductRepositoryInterface;
use Vendor\Module\Model\ResourceModel\Product as ProductResource;
use Vendor\Module\Model\ResourceModel\Product\Collection as ProductCollection;
use Vendor\Module\Model\ResourceModel\Product\CollectionFactory as ProductCollectionFactory;
use Magento\Framework\Api\SearchCriteriaInterface;
use Magento\Framework\Api\SearchResultsInterfaceFactory;

class ProductRepository implements ProductRepositoryInterface
{
    public function __construct(
        private readonly ProductFactory $productFactory,
        private readonly ProductCollectionFactory $productCollection,
        private readonly ProductResource $resource,
        private readonly SearchResultsInterfaceFactory $searchResultsFactory,
        private readonly \Magento\Framework\Api\SearchCriteria\CollectionProcessorInterface $searchCriteriaApplier
    ) {}

    public function save(ProductInterface $product): ProductInterface
    {
        $this->resource->save($product);
        return $product;
    }

    public function getById(int $id): ProductInterface
    {
        $product = $this->productFactory->create();
        $this->resource->load($product, $id);
        if (!$product->getId()) {
            throw new \Magento\Framework\Exception\NoSuchEntityException(
                __('Product with ID %1 does not exist', $id)
            );
        }
        return $product;
    }

    // The service-contract name is getList: a webapi.xml route that declares
    // method="getList" resolves to nothing if the class only has get().
    public function getList(SearchCriteriaInterface $searchCriteria): ProductSearchResultsInterface
    {
        $searchResults = $this->searchResultsFactory->create();
        $searchResults->setSearchCriteria($searchCriteria);
        $collection = $this->productCollection->create();
        $this->searchCriteriaApplier->process($searchCriteria, $collection);
        $searchResults->setItems($collection->getItems());
        $searchResults->setTotalCount($collection->getSize());
        return $searchResults;
    }
}
```

`CollectionProcessorInterface::process(SearchCriteriaInterface $searchCriteria, AbstractDb $collection)`
takes the criteria first and is called `process`, not `apply`; it is what applies filters,
sorts and paging to the collection.

### WebAPI Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- etc/webapi.xml -->
<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Webapi:etc/webapi.xsd">
    <!-- Route for single resource -->
    <route method="GET" url="/V1/vendor/product/:id">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="getById"/>
        <resources>
            <resource ref="Vendor_Module::product_read"/>
        </resources>
    </route>

    <!-- Route for collection -->
    <route method="GET" url="/V1/vendor/products">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="getList"/>
        <resources>
            <resource ref="Vendor_Module::product_read"/>
        </resources>
    </route>

    <!-- Route for create/update -->
    <route method="POST" url="/V1/vendor/product">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="save"/>
        <resources>
            <resource ref="Vendor_Module::product_write"/>
        </resources>
    </route>
</routes>
```

### ACL Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- etc/acl.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:framework:Acl/etc/acl.xsd">
    <acl>
        <resources>
            <resource id="Magento_Backend::admin">
                <resource id="Vendor_Module::product" title="Product" sortOrder="10">
                    <resource id="Vendor_Module::product_read" title="Read Product" sortOrder="10"/>
                    <resource id="Vendor_Module::product_write" title="Write Product" sortOrder="20"/>
                    <resource id="Vendor_Module::product_delete" title="Delete Product" sortOrder="30"/>
                </resource>
            </resource>
        </resources>
    </acl>
</config>
```
