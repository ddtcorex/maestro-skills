# Migrating from Luma

The migration steps: dependency analysis, replacing JavaScript, LESS to Tailwind, and the
template updates. The rule that a migration is not done until each step is checked is in
`SKILL.md`.

### Step 1: Analyze Dependencies
```bash
# List jQuery dependencies
grep -r "require.*jquery" app/design/frontend/Vendor/Theme/web/js/

# Check Knockout bindings
grep -r "data-bind=" app/design/frontend/Vendor/Theme/templates/
```

### Step 2: Replace JavaScript
```javascript
// Luma Knockout
define(['ko'], function(ko) {
    return {
        items: ko.observableArray([]),
        addItem: function(item) {
            this.items.push(item);
        }
    };
});

// Hyvä Alpine
function initComponent() {
    return {
        items: [],
        addItem(item) {
            this.items.push(item);
        }
    }
}
```

### Step 3: Replace LESS with Tailwind
```less
// Luma LESS
.product-card {
    .lib-card();
    .lib-respond-to(@mobile, { width: 100%; });
}

// Hyvä Tailwind
<div class="bg-white rounded-lg shadow-md p-4 w-full md:w-1/2">
```

### Step 4: Update Templates
```php
// Luma (Knockout)
<span data-bind="text: product.name"></span>

// Hyvä (Alpine)
<span x-text="product.name"></span>
```
