---
name: magento2-frontend-dev
description: Use when creating a Knockout.js component, a UI Component, or changing layout XML, a template, LESS CSS, a RequireJS module, the cart page or checkout in Luma. DEPENDENT on magento2-dev-core.
compatibility: claude, codex, opencode, copilot, dsh
depends: [magento2-dev-core]
metadata:
  audience: frontend developers
  workflow: magento
---

# Magento 2 Frontend Developer

## When to use

Load this skill for Magento 2 frontend work on the Luma or Blank theme; it is DEPENDENT on magento2-dev-core for backend patterns and escaping.

- "create a Knockout.js component", "add a UI Component", "modify layout XML", "customize a template"
- "write LESS CSS", "style with the Magento UI library", "add a RequireJS module", "extend JavaScript"
- "customize checkout", "modify the cart page"

This skill covers Luma/Blank theme development, Knockout.js, RequireJS, LESS CSS, and UI Components.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first: it defines the escaping (`escapeHtml`/`escapeHtmlAttr`/`escapeJs`) and backend patterns this skill's templates and view models rely on.

This skill targets Luma/Blank-derived themes. If the project's `theme.xml` parent is `Hyva/default` or `Hyva/reset` (or `composer.json` requires `hyva-themes/*`), use `magento2-hyva-dev` instead, the two frontend stacks are mutually exclusive and share almost no code patterns. Hybrid projects (e.g. dual-stack) keep both: `app/design/frontend/<Vendor>/luma_child` → this skill, `app/design/frontend/<Vendor>/hyva_*` → `magento2-hyva-dev` (check both `theme.xml` parent **and** `composer.json` `hyva-themes/*` before assuming either applies).

## Theme Structure

```
app/design/frontend/Vendor/Theme/
├── registration.php
├── theme.xml
├── composer.json
├── media/
│   └── preview.jpg
├── web/
│   ├── css/
│   │   └── source/
│   │       ├── _extend.less
│   │       ├── _theme.less
│   │       └── _variables.less
│   ├── js/
│   │   └── namespace/
│   │       └── module.js
│   └── images/
└── Magento_Theme/
    ├── layout/
    │   ├── default.xml
    │   └── default_head_blocks.xml
    └── templates/
        └── header.phtml
```

## RequireJS Modules

### Creating a Module

```javascript
// web/js/namespace/module.js
define([
    'jquery',
    'ko',
    'uiComponent',
    'Magento_Customer/js/customer-data'
], function ($, ko, Component, customerData) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Namespace_Module/template-name',
            exports: {
                value: '${ $.provider }:data.value'
            },
            tracks: {
                value: true
            }
        },

        /** @inheritdoc */
        initialize: function () {
            this._super();
            // Initialization logic
        },

        /** @inheritdoc */
        initObservable: function () {
            this._super()
                .observe('value');
            return this;
        },

        /**
         * Example method
         * @returns {string}
         */
        getFormattedValue: function () {
            return this.value() + ' formatted';
        }
    });
});
```

### Using a Module in Template

```html
<!-- In .phtml -->
<script type="text/x-magento-init">
{
    "*": {
        "Namespace_Module/js/module": {
            "config": "value"
        }
    }
}
</script>

<!-- In Knockout template -->
<div data-bind="scope: 'module'">
    <span data-bind="text: value"></span>
    <button data-bind="click: doAction">Click</button>
</div>

<script type="text/x-magento-init">
{
    "*": {
        "Magento_Ui/js/core/app": {
            "components": {
                "module": {
                    "component": "Namespace_Module/js/module"
                }
            }
        }
    }
}
</script>
```

## Knockout.js Patterns

### ViewModel Structure

```javascript
define(['ko', 'jquery'], function (ko, $) {
    'use strict';

    return function (config, element) {
        var self = this;

        // Observable properties
        self.products = ko.observableArray(config.products || []);
        self.isLoading = ko.observable(false);
        self.selectedId = ko.observable(null);

        // Computed properties
        self.hasProducts = ko.computed(function () {
            return self.products().length > 0;
        });

        self.selectedProduct = ko.computed(function () {
            return self.products().find(function (p) {
                return p.id === self.selectedId();
            });
        });

        // Methods
        self.selectProduct = function (product) {
            self.selectedId(product.id);
        };

        self.loadMore = function () {
            self.isLoading(true);
            // Magento has no global jQuery inside an AMD module: it is the
            // dependency declared above, or the call throws ReferenceError.
            $.get('/api/products', function (data) {
                self.products(self.products().concat(data));
                self.isLoading(false);
            });
        };

        // Initialize
        self.init = function () {
            if (config.enableAutoLoad) {
                self.loadMore();
            }
        }();
    };
});
```

### Knockout Template

```html
<!-- web/template/product/list.html -->
<!-- ko if: hasProducts() -->
<div class="product-list">
    <!-- ko foreach: products() -->
    <div class="product-item" data-bind="click: $parent.selectProduct">
        <img data-bind="attr: { src: image, alt: name }" />
        <span data-bind="text: name"></span>
        <span data-bind="text: price"></span>
    </div>
    <!-- /ko -->
</div>
<!-- /ko -->

<!-- ko ifnot: hasProducts() -->
<div class="no-products">No products available</div>
<!-- /ko -->

<button data-bind="enable: !isLoading(), click: loadMore">
    <!-- ko if: isLoading() -->Loading...<!-- /ko -->
    <!-- ko ifnot: isLoading() -->Load More<!-- /ko -->
</button>
```

## Layout XML

> **Finding the layout that owns a block:** `grep -R "referenceBlock\|move " --include="*.xml" app/code app/design`, then read the files it names.

### Reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <head>
        <!-- Add JS -->
        <script src="Vendor_Module::js/component.js"/>

        <!-- Add CSS -->
        <css src="Vendor_Module::css/styles.css"/>

        <!-- Add meta -->
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
    </head>
    <body>
        <!-- Move block -->
        <move element="product.info.main" destination="product.info.extra"/>

        <!-- Remove block -->
        <referenceBlock name="product.info.review" remove="true"/>

        <!-- Reference block -->
        <referenceBlock name="header.container">
            <container name="custom.container" as="customContainer" label="Custom Container" htmlTag="div" htmlClass="custom-class">
                <block class="Vendor\Module\Block\Custom" name="custom.block" template="Vendor_Module::custom.phtml"/>
            </container>
        </referenceBlock>

        <!-- Arguments -->
        <referenceBlock name="product.info.price">
            <arguments>
                <argument name="css_class" xsi:type="string">custom-price</argument>
            </arguments>
        </referenceBlock>
    </body>
</page>
```

### Adding JS with Layout

```xml
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <head>
        <!-- External JS -->
        <script src="https://example.com/external.js" src_type="url"/>

        <!-- Module JS: attributes are attributes of <script> itself. A child node
             is ignored by the head reader, so <attributes name="defer"/> is dropped. -->
        <script src="Vendor_Module::js/tracker.js" defer="defer"/>
    </head>
</page>
```

## LESS CSS

### Structure

```less
// web/css/source/_extend.less
// Main entry point for theme customizations

// Import lib (Magento UI library)
@import 'lib/_lib.less';

// Import vendor styles
@import '_components.less';

// Your theme variables
@color-primary: #1979c3;
@color-secondary: #f0f0f0;

// Extend parent theme
@import '_theme.less';

// Custom styles
.block-product {
    margin-bottom: @indent__l;

    &__title {
        font-size: 20px;
        color: @color-primary;
    }

    &__image {
        width: 100%;
    }
}
```

### UI Library Mixins

```less
// Using Magento UI library mixins
.product-grid {
    .lib-css(display, flex);
    .lib-css(flex-wrap, wrap);
    .lib-css(gap, 20px);

    .lib-list-reset();
}

// Buttons
.action.primary {
    .lib-button-replace();
    .lib-button-primary();
}

// Forms
.field {
    .lib-form-field();
}

// Links
a {
    .lib-link($_linkColor: @color-primary);
}
```

### Responsive Breakpoints

```less
// Mobile first approach
@mobile: 640px;
@tablet: 768px;
@desktop: 1024px;

.product-card {
    width: 100%;

    @media (min-width: @tablet) {
        width: 50%;
    }

    @media (min-width: @desktop) {
        width: 33.333%;
    }
}
```

## UI Components (Magento 2.3+)

Read [references/ui-components.md](references/ui-components.md) when adding or changing a UI component, its XML definition or its Knockout view model.

## Cache Configuration

`cacheable` and `ttl` are attributes of a block, not of a reference to one:
`blockReferenceType` in `elements.xsd` allows only name, template, class, group,
display and remove, so `<referenceBlock cacheable="...">` is invalid layout and is
ignored. Declare the block (or override the one you own) instead:

```xml
<!-- A block that may be cached for an hour -->
<block name="product.info" template="Vendor_Module::product/info.phtml" cacheable="true" ttl="3600"/>

<!-- Dynamic content: opt the block out, never the reference -->
<block name="dynamic.content" template="Vendor_Module::dynamic.phtml" cacheable="false"/>
```

## Verification

```bash
# Deploy static content
bin/magento setup:static-content:deploy -f --theme=Vendor/Theme

# Clean caches
bin/magento cache:clean layout block_html

# Enable template hints (dev only; storefront only, the command takes no options)
bin/magento dev:template-hints:enable
bin/magento dev:template-hints:disable

# Check RequireJS config
bin/magento config:set dev/js/merge_files 0
```

## Pitfalls recap

- Don't mix Knockout/UI Component patterns into a Hyvä theme (or vice versa), check `theme.xml` first if unsure which stack the project uses.
- A block marked `cacheable="false"` blocks full-page caching for the whole containing page, not just that block, and the attribute does not exist on `referenceBlock` at all; prefer a block `ttl` instead where possible (with Varnish, a block with `ttl` is served as an ESI include, so it refreshes on its own schedule without disabling the page cache).
- Clear the right cache after a change: `layout`/`block_html` for layout XML, `full_page` for FPC-visible content, and always redeploy static content (`setup:static-content:deploy`) after CSS/JS changes when the project runs in production mode (run it in the build step, never on the production server; your project's house conventions skill, if any, may forbid compiling there outright).
- RequireJS module paths are case-sensitive and must match the `requirejs-config.js` map exactly, or the module silently fails to resolve.