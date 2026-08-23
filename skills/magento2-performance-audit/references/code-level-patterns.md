# Code-Level Performance Patterns

Full detail for Workflow step 8.

## Scanning `app/code` for These Patterns

Don't rely on reading through custom modules by eye — grep for the shapes below across custom code first (scope to `app/code`, not `vendor/`, so results are actually yours to fix; see the vendor-code note in `references/database-query-profiling.md` for anything that turns up in a third-party extension instead):

> **Choose the recipe for the shell that executes it.** The audit container reached through `govard sh` uses BusyBox `grep`, which does not implement GNU `--include`; a command such as `grep -rn --include='*.php'` therefore fails before it searches anything. Inside that container, use the `find … -type f -exec grep … {} +` forms below. `find` performs the filename filtering itself, `grep -Hn` preserves the file and line evidence needed by the report, and `{} +` batches inputs so the audit does not spawn one process per file. Do not replace `+` with `\;` unless the command must run once per path.
>
> The same GNU-grep one-liner remains valid on a host shell that actually has GNU grep, but do not copy it into `govard sh` just because it is shorter. Scope searches to `app/code` first: vendor hits are evidence about an extension dependency, not a custom-code finding. If `app/code` is absent or the command returns no hits, record that negative result under the code-level section instead of silently treating the grep as skipped. These searches are heuristics; inspect every hit before reporting an N+1, collection-count, or uncacheable-layout finding. The command only finds candidate shapes and cannot establish request frequency, cache scope, or production impact by itself.

```bash
# N+1: a ->load()/->create()->load() call sitting inside a foreach loop
# (BusyBox-safe; on a GNU-grep host the --include one-liner form also works)
find app/code -name '*.php' -type f -exec grep -Hn -A3 'foreach' {} + | grep -B3 -- '->load('

# Full collection load just to count items (should be ->getSize() instead)
find app/code -name '*.php' -type f -exec grep -Hn 'count(\$.*[Cc]ollection' {} +

# Blocks marked uncacheable (prevents FPC for whatever layout handle references them)
find app/code -name '*.xml' -type f -exec grep -Hl 'cacheable="false"' {} +
```

The `foreach`/`->load()` grep is a heuristic, not a proof — read each hit to confirm it's actually iterating a list (a false positive: a single `->load()` inside a `foreach` that only ever runs once). For the `cacheable="false"` grep, check what page/layout handle it's declared under before flagging it — Magento's own core layout XML uses it by default on inherently personalized pages (customer account, checkout, wishlist, order history), where it's correct and expected, not a bug.

## N+1 Query Detection (From magento2-dev-core)

```php
// WRONG - N+1 query
foreach ($productIds as $id) {
    $product = $this->productFactory->create()->load($id); // Query per iteration
    $result[] = $product->getName();
}

// CORRECT - Batch load
$collection = $this->productCollection->create()
    ->addFieldToFilter('entity_id', ['in' => $productIds]);
foreach ($collection as $product) {
    $result[] = $product->getName();
}
```

> **A textual match isn't proof of a scaling bug — check what the collection is scoped to.** A `Ui\...\Form\DataProvider::getData()` (not `Grid\DataProvider`) matching this exact shape is usually harmless: Magento filters Form providers to the one entity id from the request, so it's one extra query on one row, not an N+1.

## Collection Counting

```php
// WRONG - Loads all items
$count = count($this->collection->create()->getItems());

// CORRECT - Lightweight count query
$count = $this->collection->create()->getSize();
```

> **Check whether the collection was already loaded earlier in the same method.** `count($collection->getItems())` only queries if the collection hasn't loaded yet — after an earlier `foreach`/`->load()` on the same instance, `getItems()` is free (cached array), and switching it to `getSize()` changes behavior (a fresh count) for no benefit.

## Uncacheable Blocks

```xml
<!-- WRONG - Prevents FPC -->
<referenceBlock name="content" cacheable="false">
    <!-- This block will prevent full page caching -->
</referenceBlock>

<!-- CORRECT - Use esi:inline directive if needed -->
<referenceBlock name="dynamic.block" template="Magento_Cms::dynamic.phtml">
    <arguments>
        <argument name="cache_lifetime" xsi:type="number">3600</argument>
    </arguments>
</referenceBlock>
```

## Batch-Preload Plugins Must Stay FPC-Safe

A batch-preload plugin (the standard fix for a per-item N+1 — see the Known Core-Magento Pattern in `references/database-query-profiling.md`) usually sits on a listing block's collection method (`getLoadedProductCollection()`, `createCollection()`), which commonly renders on `full_page`-cached pages. **Any** `SessionManagerInterface`-backed session — `Customer\Model\Session`, `Checkout\Model\Session`/quote session, not just customer group — starts a PHP session on first read. Reading one here forces a session for anonymous visitors on every cache miss, or risks a session-derived value leaking into a response FPC serves to other visitors.

```php
// WRONG - opens a session inside code that renders on an FPC-cached page
public function __construct(private Session $customerSession) {}
$groupId = $this->customerSession->getCustomerGroupId();

// CORRECT - the same Vary-cookie signal core's own FPC-safe price code uses
// (Layer\Filter\Price, Indexer\Product\Price\Plugin\TableResolver)
public function __construct(private HttpContext $httpContext) {}
$groupId = (int)($this->httpContext->getValue(CustomerContext::CONTEXT_GROUP) ?? Group::NOT_LOGGED_IN_ID);
```

Rule of thumb: if the target method's block is one Magento normally serves from FPC, no code in the plugin may touch a session object, however small or read-only the read looks.

## Heavy Constructors

```php
// WRONG - Expensive operation in constructor
public function __construct(
    private readonly ExpensiveApiService $expensiveService
) {
    // This runs every time the class is instantiated
    $this->data = $this->expensiveService->fetchData();
}

// CORRECT - Lazy initialization via Proxy
public function __construct(
    private readonly ExpensiveApiServiceProxy $expensiveService
) {}

public function getData(): array
{
    if ($this->data === null) {
        $this->data = $this->expensiveService->fetchData();
    }
    return $this->data;
}
```

## Inefficient Cache Invalidation

```php
// WRONG - blanket flush on every save, regardless of what actually changed
class FlushFullPageCache implements ObserverInterface
{
    public function execute(Observer $observer): void
    {
        $this->cacheTypeList->cleanType(\Magento\PageCache\Model\Cache\Type::TYPE_IDENTIFIER); // clears ALL of full_page
    }
}

// WRONG - "just in case" full flush from a cron job or deploy script,
// unconditional and unrelated to whether anything relevant changed
// bin/magento cache:flush

// CORRECT - targeted invalidation scoped to the entity that actually changed
public function execute(Observer $observer): void
{
    $product = $observer->getEvent()->getProduct();
    $this->cache->clean(
        \Zend_Cache::CLEANING_MODE_MATCHING_TAG,
        [\Magento\Catalog\Model\Product::CACHE_TAG . '_' . $product->getId()]
    );
}

// EVEN BETTER - don't add a parallel custom flush at all; make sure the
// affected block/data actually participates in the entity's native getIdentities()
// cache tags, so Magento's own save-time invalidation already covers it
```
