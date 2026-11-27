# CLI commands

The command class, the `di.xml` registration and the argument and option contract.

### Command Class

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Console\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class SyncProductsCommand extends Command
{
    protected $commandName = 'vendor:products:sync';
    protected $commandDescription = 'Synchronize products from external source';

    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly ExternalApiClient $apiClient
    ) {
        parent::__construct($this->commandName);
    }

    protected function configure(): void
    {
        $this->setDescription($this->commandDescription);
        $this->addOption(
            'dry-run',
            'd',
            InputOption::VALUE_NONE,
            'Run without making changes'
        );
        $this->addOption(
            'limit',
            'l',
            InputOption::VALUE_REQUIRED,
            'Limit number of products',
            100
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Product Synchronization');

        $limit = (int) $input->getOption('limit');
        $dryRun = $input->getOption('dry-run');

        if ($dryRun) {
            $io->note('Running in dry-run mode');
        }

        try {
            $externalProducts = $this->apiClient->fetchProducts($limit);
            $io->progressStart(count($externalProducts));

            foreach ($externalProducts as $externalProduct) {
                if (!$dryRun) {
                    $this->syncProduct($externalProduct);
                }
                $io->progressAdvance();
            }

            $io->progressFinish();
            $io->success(sprintf('Synchronized %d products', count($externalProducts)));

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $io->error('Synchronization failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
```

### Register Command

```xml
<!-- etc/di.xml -->
<type name="Magento\Framework\Console\CommandList">
    <arguments>
        <argument name="commands" xsi:type="array">
            <item name="vendor_products_sync"
                  xsi:type="object">Vendor\Module\Console\Command\SyncProductsCommand</item>
        </argument>
    </arguments>
</type>

<!-- The di.xml entry above is what registers the command: Magento never scans
     Symfony attributes, so a command declared only with #[AsCommand] never
     appears in `bin/magento list`. The attribute below only names it. -->
<!-- Vendor/Module/Console/Command/SyncCommand.php -->
<?php

declare(strict_types=1);

namespace Vendor\Module\Console\Command;

use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(
    name: 'vendor:products:sync',
    description: 'Synchronize products',
)]
class SyncCommand extends Command
{
    // ...
}
```

If the command touches store-scoped config, catalog, or anything area-aware, set the area code explicitly before use: `$this->state->setAreaCode(Area::AREA_ADMINHTML)` (or `AREA_FRONTEND`/`AREA_GLOBAL`). A bare CLI command defaults to no area, and area-dependent services throw a `LocalizedException` otherwise.
