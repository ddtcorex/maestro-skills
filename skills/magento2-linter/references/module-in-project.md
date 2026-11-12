# One module inside a Magento project

The `module_in_project` scoping path: what is analyzed, what is mounted read only, and
what the report reports.


The isolation advice above is for **standalone Composer packages** (own
`composer.json`, own git repo). An in-project `app/code/Vendor/Module` is
the opposite case, it has no `composer.json` of its own and depends on the
*whole host project's* `vendor/` to resolve Magento framework classes.

`govard audit run`, run from inside the module directory, resolves
`module_in_project` mode automatically: it analyzes only that module, with
the whole project mounted read only alongside it so the module's autoloader
resolves against the real project `vendor/`, no rsync'd full-project copy,
no synthetic `composer.json`, no external wrapper needed. This is the
native, module-scoped equivalent of what a CI wrapper's `--path=` flag might
look like it should do; prefer it over any manual scoping workaround.

For an in-project `app/code/Vendor/Module`, pick based on what's actually needed:

- **Module-scoped, native (the authoritative check for a PR/MR review)**:
  run `govard audit run` from inside `app/code/Vendor/Module`, see the
  workflow at the top of this doc. Not scoped to a diff either: it analyzes
  the whole module and surfaces every pre-existing finding in it, not just
  what the PR/MR introduced. Split diff-introduced findings from
  pre-existing ones (`magento2-code-review`'s scope-modes reference covers
  how) before treating this as a PR-only gate.
- **Module-scoped, using the project's own installed tools (fast local
  pre-check only, see "Local Bare-Tool Runs Can Diverge from the Native
  Toolchain" above)**: run the bare binaries directly, from the project
  root, with the module's path as the *target argument*, see "Scoping"
  below (`vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module`,
  `vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon`). This
  uses the exact tool versions this project's own `composer.lock` already
  pins, but without the Magento-aware PHPStan extensions or per-PHP-version
  isolation the native toolchain provides. **Never `cd` into the module
  directory first and expect either tool to find the project's own
  `vendor/autoload.php` from there**, invoke them from the project root,
  same autoloader hazard as the standalone-isolation case above.
- **Full-project audit**: run `govard audit run` from the project root, `auto` resolves to `project` mode there and analyzes the whole tree in one
  pass, surfacing every pre-existing repo-wide finding alongside whatever
  the new module introduces, not scoped to a diff. Only worth it for a
  genuine full-project audit, not a quick per-module check.
