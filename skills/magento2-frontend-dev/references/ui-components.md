# UI components

A UI component from the Knockout view model to its XML definition: the JS, the template
and the `ui_component` XML, with a listing and a form as worked examples.

### Basic UI Component

```javascript
// web/js/view/checkout/summary/shipping-method.js
define([
    'uiComponent',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/action/select-shipping-method'
], function (Component, quote, selectShippingMethodAction) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_Checkout/shipping-method/shipping-method-list'
        },

        isVisible: function () {
            return quote.shippingMethod() !== null;
        },

        /** Get shipping method code */
        getMethodCode: function () {
            var method = quote.shippingMethod();
            return method ? method.carrier_code + '_' + method.method_code : '';
        },

        /** Select this shipping method */
        selectMethod: function (method) {
            selectShippingMethodAction(method);
        }
    });
});
```

### XML UI Component Definition

```xml
<!-- view/adminhtml/ui_component/sales_rule_form.xml -->
<form xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Ui:etc/ui_configuration.xsd">
    <argument name="data" xsi:type="array">
        <item name="js_config" xsi:type="array">
            <item name="provider" xsi:type="string">sales_rule_form.sales_rule_form_data_source</item>
        </item>
        <item name="label" xsi:type="string" translate="true">Cart Price Rules</item>
        <item name="template" xsi:type="string">templates/form/collapsible</item>
    </argument>
    <settings>
        <buttons>
            <button name="save" class="Magento\SalesRule\Block\Adminhtml\Promo\Quote\Edit\SaveButton"/>
        </buttons>
        <layout>
            <navContainerName>left</navContainerName>
            <type>tabs</type>
        </layout>
        <deps>
            <dep>sales_rule_form.sales_rule_form_data_source</dep>
        </deps>
    </settings>
    <dataSource name="sales_rule_form_data_source">
        <argument name="data" xsi:type="array">
            <item name="js_config" xsi:type="array">
                <item name="component" xsi:type="string">Magento_Ui/js/form/provider</item>
            </item>
        </argument>
        <settings>
            <submitUrl path="sales_rule/promo_quote/save"/>
        </settings>
        <dataProvider name="sales_rule_form_data_source" class="Magento\SalesRule\Model\Rule\DataProvider">
            <!-- AbstractDataProvider takes name, primaryFieldName and requestFieldName in its
                 constructor with no defaults; without these two settings the form loads and
                 saves against no record. -->
            <settings>
                <primaryFieldName>rule_id</primaryFieldName>
                <requestFieldName>id</requestFieldName>
            </settings>
        </dataProvider>
    </dataSource>
</form>
```
