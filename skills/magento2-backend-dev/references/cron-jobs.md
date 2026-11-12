# Cron jobs

The cron class, `crontab.xml` and cron groups for large scale.

### Cron Class

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Cron;

use Vendor\Module\Api\ProductRepositoryInterface;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Psr\Log\LoggerInterface;

class CleanupExpired
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly SearchCriteriaBuilder $searchCriteriaBuilder,
        private readonly LoggerInterface $logger
    ) {}

    public function execute(): void
    {
        $this->logger->info('Running expired product cleanup');

        try {
            $expiredProducts = $this->findExpiredProducts();
            foreach ($expiredProducts as $product) {
                $product->setStatus(Status::STATUS_DISABLED);
                $this->productRepository->save($product);
            }

            $this->logger->info(sprintf('Cleaned up %d expired products', count($expiredProducts)));
        } catch (\Exception $e) {
            $this->logger->error('Cleanup failed: ' . $e->getMessage());
        }
    }

    /**
     * @return \Magento\Catalog\Api\Data\ProductInterface[]
     */
    private function findExpiredProducts(): array
    {
        $criteria = $this->searchCriteriaBuilder
            ->addFilter('updated_at', (new \DateTimeImmutable('-30 days'))->format('Y-m-d H:i:s'), 'lt')
            ->create();

        return $this->productRepository->getList($criteria)->getItems();
    }
}
```

`findExpiredProducts()` is the one piece the sample leaves to the module: it is whatever
query selects the rows, here a `SearchCriteriaBuilder` injected beside the repository.

### Cron Configuration

```xml
<!-- etc/crontab.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Cron:etc/crontab.xsd">
    <group id="default">
        <job name="vendor_module_cleanup" instance="Vendor\Module\Cron\CleanupExpired" method="execute">
            <schedule>0 2 * * *</schedule>
        </job>
        <job name="vendor_module_sync" instance="Vendor\Module\Cron\Sync" method="execute">
            <schedule>*/5 * * * *</schedule>
        </job>
    </group>
</config>
```

Custom jobs go in `default` (or a custom group declared in `cron_groups.xml`, below). The core `index` group belongs to the indexer and mview jobs; parking a module job there ties it to that group's schedule and separate-process settings.

### Cron Groups (for large scale)

```xml
<!-- etc/cron_groups.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Cron:etc/cron_groups.xsd">
    <group id="custom">
        <schedule_generate_every>1</schedule_generate_every>
        <schedule_ahead_for>4</schedule_ahead_for>
        <schedule_lifetime>2</schedule_lifetime>
        <history_cleanup_every>10</history_cleanup_every>
        <history_success_lifetime>60</history_success_lifetime>
        <history_failure_lifetime>1440</history_failure_lifetime>
        <use_separate_process>1</use_separate_process>
    </group>
</config>
```
