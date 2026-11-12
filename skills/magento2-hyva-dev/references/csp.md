# CSP compliance

PCI-DSS 4.0, nonce registration, the Alpine patterns that survive strict CSP, and how a
component is registered with a nonce.

### Critical: PCI-DSS 4.0

PCI DSS v4.0 was published in March 2022 and replaced v3.2.1 in 2024. Its future-dated client-side script requirements, 6.4.3 (payment page script inventory and integrity) and 11.6.1 (change and tamper detection), became mandatory in 2025. Check the effective date with the client's QSA rather than trusting a date in this skill.

Hyvä reads 6.4.3 as requiring payment-related pages to run without the following `script-src` keywords, which is what the CSP theme build exists for:
- `unsafe-eval`
- `unsafe-inline`

### CSP Nonce Registration

**Every inline script MUST register with CSP:**

```php
<?php
/** @var \Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
?>

<script>
    // CSP-compliant code
</script>
<!-- Register right AFTER the closing tag: it allows the script immediately before it -->
<?php if (isset($hyvaCsp)) {
    $hyvaCsp->registerInlineScript();
} ?>
```

> **$hyvaCsp is ambient, never demand an assignment.** The Hyvä theme
> provides the `$hyvaCsp` view model to every template: a `/** @var */`
> docblock (as above) is the complete setup, no
> `$viewModels->require(HyvaCsp::class)` needed. `isset($hyvaCsp)` guards
> are the correct pattern for templates that must also render without
> Hyvä/CSP, never flag them as dead code, and never claim `isset()` is
> always false from template text alone. If CSP registration genuinely
> looks unwired, check layout XML / theme wiring first (a missing call to
> a mechanism the project doesn't have is "not applicable", not a finding).

### CSP-Compatible Alpine.js Patterns

**WRONG (CSP violations):**
```html
<!-- These patterns break CSP -->
<button @click="count++">Add</button>
<span x-show="!loading">Ready</span>
<input :value="name" @input="name = $event.target.value">
```

**CORRECT (CSP-compliant):**
```html
<!-- Use methods for mutations -->
<button @click="increment">Add</button>
<span x-show="isNotLoading">Ready</span>
<input :value="name" @input="updateName">
```

```javascript
function initComponent() {
    return {
        count: 0,
        loading: true,
        name: '',

        increment() {
            this.count++;
        },

        isNotLoading() {
            return !this.loading;
        },

        updateName(event) {
            this.name = event.target.value;
        }
    }
}
window.addEventListener('alpine:init', () => {
    Alpine.data('initComponent', initComponent);
}, {once: true})
```

### Registering Alpine Components

```php
<?php
/** @var Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
?>

<script>
function initProductSlider() {
    return {
        products: [],
        currentIndex: 0,

        init() {
            // Initialization
        },

        next() {
            this.currentIndex = (this.currentIndex + 1) % this.products.length;
        },

        prev() {
            this.currentIndex = (this.currentIndex - 1 + this.products.length) % this.products.length;
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initProductSlider', initProductSlider), {once: true})
</script>
<?php if (isset($hyvaCsp)) {
    $hyvaCsp->registerInlineScript();
} ?>
```
