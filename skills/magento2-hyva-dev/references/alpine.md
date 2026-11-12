# Alpine components and Hyvä utilities

The component skeleton, passing data from PHP, and the utility helpers the theme ships.

## Component structure

### Basic Component

One `.phtml` holds the markup, the factory and its registration. Under the CSP
build a directive cannot pass arguments or compare values, so a method called
from inside `x-for` reads the current iteration variable as `this.item`: the
build calls the method with the merged scope (component data plus the loop
scope) as `this`.

```php
<?php
/** @var \Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
?>
<div x-data="initExample">
    <button type="button" @click="toggle">Toggle</button>

    <div x-show="isOpen">
        <template x-for="item in items" :key="item.id">
            <div @click="select" :class="itemClass">
                <span x-text="item.name"></span>
            </div>
        </template>
    </div>
</div>
<script>
function initExample() {
    return {
        isOpen: false,
        items: [],
        selectedId: null,

        toggle() {
            this.isOpen = !this.isOpen;
        },

        // Called from inside x-for: `this.item` is the current iteration.
        select() {
            this.selectedId = this.item.id;
        },

        itemClass() {
            return this.item.id === this.selectedId ? 'selected' : '';
        },

        init() {
            fetch('/api/data')
                .then(res => res.json())
                .then(data => { this.items = data; });
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initExample', initExample), {once: true})
</script>
<?php if (isset($hyvaCsp)) {
    $hyvaCsp->registerInlineScript();
} ?>
```

Register each component name once: a second `Alpine.data()` with the same name
replaces the first, and the copy nobody edits is the one that drifts.

### Passing Data from PHP

```php
<?php
/** @var \Magento\Framework\Escaper $escaper */
/** @var \Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
$productsJson = json_encode($products, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?>

<div x-data="initProductList"
     data-products="<?= $escaper->escapeHtmlAttr($productsJson) ?>">
</div>

<script>
function initProductList() {
    return {
        products: [],

        init() {
            this.products = JSON.parse(this.$root.dataset.products || '[]');
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initProductList', initProductList), {once: true})
</script>
<?php if (isset($hyvaCsp)) {
    $hyvaCsp->registerInlineScript();
} ?>
```

## Utilities

Hyvä provides global utilities via the `hyva` object:

### Form Handling
```javascript
// Get form key
hyva.getFormKey()

// Submit form via POST
hyva.postForm({
    action: '/checkout',
    data: { product_id: 123, qty: 1 }
})

// Alternative with fetch
async function submitForm(url, data) {
    const formKey = hyva.getFormKey();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ ...data, form_key: formKey })
    });
    return response.json();
}
```

### Cookies
```javascript
hyva.getCookie('customer_segment')
hyva.setCookie('recent_viewed', productId, 30)
```

### Formatting
```javascript
hyva.formatPrice(price, showSign)
hyva.str('Hello %1', name)   // %1-based positional placeholders
hyva.safeParseNumber(value)
```

### DOM Manipulation
```javascript
hyva.replaceDomElement('#target', '<span>New content</span>')
hyva.trapFocus(modalElement)
```

### Events
```javascript
// After Alpine initialization
hyva.alpineInitialized(function() {
    console.log('Alpine ready');
})
```
