# Third-party compatibility modules

How a third-party extension gets a Hyvä compatibility module, and the naming and layout it
follows.

A Luma-built third-party extension needs a Hyvä compatibility module to override its templates and JS, check the vendor's GitHub for an existing one (many ship under `hyva-themes/*`) before writing your own.

To build one: create a module that requires the original module, copy only the `.phtml` templates you need to override, replace any jQuery/Knockout JS with CSP-compatible Alpine, and sequence it after both the original module and `Hyva_Theme` in `module.xml`. Then register it so Hyvä actually picks it up:

```xml
<!-- etc/frontend/di.xml -->
<type name="Hyva\CompatModuleFallback\Model\CompatModuleRegistry">
    <arguments>
        <argument name="compatModules" xsi:type="array">
            <item name="hyva_vendor_module" xsi:type="array">
                <item name="original_module" xsi:type="string">Vendor_Module</item>
                <item name="compat_module" xsi:type="string">Vendor_ModuleHyva</item>
            </item>
        </argument>
    </arguments>
</type>
```

Without this `CompatModuleRegistry` registration, Hyvä has no way to know the compat module should override the original's frontend output, the templates get copied but never actually take effect.
