# Message queues

Which of the four queue XML files a case needs, the publisher, the consumer, the message
class and consumer registration.

Not every project needs all four queue XML files, `communication.xml` (topic schema) is the one that's always required. Add `queue_topology.xml`, `queue_publisher.xml`, `queue_consumer.xml` only for what the use case actually needs (e.g. just `queue_publisher.xml` when publishing to a queue a third party already owns).

### Publisher Configuration

```xml
<!-- etc/queue_publisher.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:framework-message-queue:etc/publisher.xsd">
    <publisher topic="vendor.product.updated" queue="vendor_product_update"/>
</config>
```

### Queue Consumer

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Model\Consumer;

use Vendor\Module\Api\Data\ProductUpdateInterface;

// A queue_consumer.xml handler is a plain class with the method the XML names;
// it receives the message body. Do NOT implement MessageQueue\ConsumerInterface
// here: that interface is for a consumer runner that pulls messages itself and
// takes $maxNumberOfMessages, not a message.
class ProductUpdateConsumer
{
    public function __construct(
        private readonly ProductUpdateHandler $handler
    ) {}

    public function process(string $message): void
    {
        /** @var ProductUpdateInterface $data */
        // A queue payload is Magento-managed data: decode it with the JSON
        // serializer injected in the constructor in real code (Serializer\Json),
        // not with the raw function.
        $data = json_decode($message, true);
        $this->handler->process($data);
    }
}
```

### Message Class

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Api\Data;

interface ProductUpdateInterface
{
    public function getProductId(): int;
    public function setProductId(int $id): self;
    public function getAction(): string;
    public function setAction(string $action): self;
    public function getTimestamp(): \DateTimeInterface;
    public function setTimestamp(\DateTimeInterface $timestamp): self;
}
```

### Consumer Registration

```xml
<!-- etc/queue_consumer.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:framework-message-queue:etc/consumer.xsd">
    <consumer name="vendor.product.update.consumer"
              queue="vendor_product_update"
              connection="db"
              handler="Vendor\Module\Model\Consumer\ProductUpdateConsumer::process"/>
</config>
```
