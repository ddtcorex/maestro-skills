# GraphQL fields

`schema.graphqls` and a resolver, including the rule that a field another module already
declares needs a different name.

### Schema Definition

```graphql
# etc/schema.graphqls

# `products` is already declared by Magento_CatalogGraphQl; a second definition
# of the same field fails the schema build, so a module adds its own field name.
type Query {
    vendorProducts(filter: ProductFilterInput, pageSize: Int = 20, currentPage: Int = 1): Products
    @doc(description: "Get products list")
    @resolver(class: "Vendor\\Module\\Model\\Resolver\\ProductList")
    @cache(cacheable: false)
}

type Mutation {
    createProduct(input: ProductInput!): Product
    @doc(description: "Create a new product")
    @resolver(class: "Vendor\\Module\\Model\\Resolver\\CreateProduct")
}

input ProductFilterInput {
    entity_id: FilterTypeInput
    name: FilterTypeInput
    sku: FilterTypeInput
    price: FilterTypeInput
}

type Product {
    entity_id: Int
    name: String
    sku: String
    price: Float
}

input ProductInput {
    name: String!
    sku: String!
    price: Float!
}
```

### Resolver Implementation

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Model\Resolver;

use Magento\Framework\Api\FilterGroupBuilder;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlInputException;
use Magento\Framework\GraphQl\Query\ResolverInterface;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Vendor\Module\Api\ProductRepositoryInterface;

class ProductList implements ResolverInterface
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly SearchCriteriaBuilder $searchCriteriaBuilder,
        private readonly FilterGroupBuilder $filterGroupBuilder
    ) {}

    public function resolve(Field $field, $context, ResolveInfo $info, ?array $value = null, ?array $args = null)
    {
        if (!isset($args['pageSize'])) {
            $args['pageSize'] = 20;
        }

        $searchCriteria = $this->searchCriteriaBuilder
            ->setPageSize($args['pageSize'])
            ->setCurrentPage($args['currentPage'] ?? 1)
            ->create();

        $searchResults = $this->productRepository->getList($searchCriteria);

        return [
            'total_count' => $searchResults->getTotalCount(),
            'items' => $this->convertProducts($searchResults->getItems())
        ];
    }

    private function convertProducts(array $products): array
    {
        return array_map(function ($product) {
            return [
                'entity_id' => $product->getId(),
                'name' => $product->getName(),
                'sku' => $product->getSku(),
                'price' => $product->getPrice()
            ];
        }, $products);
    }
}
```

GraphQL queries are cacheable by default (mutations never are). To make the cached response invalidate correctly, name a separate identity class in the schema with `@cache(cacheIdentity: "Vendor\\Module\\Model\\Resolver\\Product\\Identity")`; that class implements `Magento\Framework\GraphQl\Query\Resolver\IdentityInterface::getIdentities(array $resolvedData): array` and returns the cache tags (for example `cat_p_<id>`) derived from the resolved data. Without an identity class the response is still cached but carries no entity tags, so saving the entity never purges it and it goes stale. Use `@cache(cacheable: false)` to opt a query out entirely, for customer- or session-specific data; the `vendorProducts` sample above opts out, so it needs no identity class.
