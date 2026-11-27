# What each check covers

The four checks the linter runs, the rules they apply and the codes they report.


### 1. PHPCS (Magento2 Ruleset)

Runs the official Magento coding standard against PHP, PHTML, and XML files.

**What it checks:**
- PSR-12 compliance
- Magento-specific patterns (class names, method names, property names)
- License headers
- Docblock completeness
- Line length limits

### 2. PHPStan (Static Analysis)

Runs deep static analysis with Magento magic class handling.

**What it checks:**
- Type safety violations
- Undefined method/property access
- Dead code detection
- Logic errors
- Unused parameters

### 3. Security Pattern Detection

Scans for common anti-patterns that PHPCS might miss.

**Detected patterns:**

| Pattern | Issue | Risk | Code |
|---------|-------|------|------|
| `SELECT * FROM` | Direct SQL | Medium | M2-ARCH-004 |
| `ObjectManager::getInstance` | Service Locator | Critical | M2-ARCH-001 |
| `$_GET`, `$_POST`, `$_REQUEST` | Superglobal access | High | M2-SEC-006 |
| `eval()` | Code execution | Critical | M2-SEC-007 |
| `base64_decode` on user input | Obfuscation | High | M2-SEC-008 |
| `file_get_contents($userInput)` | Path traversal | High | M2-SEC-009 |

Full scale and code catalogue: `magento2-dev-core/references/severity-and-codes.md`.
Two rows cite `M2-ARCH-xxx` codes rather than a `M2-SEC-xxx` one:
`ObjectManager::getInstance` cites `M2-ARCH-001`, the same underlying
pattern `magento2-dev-core` already catalogues, cited from here rather than
duplicated under a second code. `SELECT * FROM` cites `M2-ARCH-004` ("Raw
SQL outside a ResourceModel") rather than `M2-SEC-001` ("SQL Injection... with
user input"), this bare-string grep can't confirm user input is actually
involved, so it's the weaker raw-SQL-usage finding, not a confirmed
injection; `magento2-security-scan`'s own SQL Injection checks (which do
correlate with user input) are what earns `M2-SEC-001`.

### 4. PHPMD (Code Smell & Complexity)

Catches cyclomatic complexity, unused code, and code smells that PHPCS
(style) and PHPStan (types) don't check for, a 200-line method or a
15-parameter constructor passes both of those clean.

**Prerequisite:**

```bash
composer require --dev phpmd/phpmd --no-interaction
```

**Run it:**

```bash
govard sh -c "vendor/bin/phpmd app/code/Vendor/Module text phpmd.xml"
```

**What it checks (default ruleset, tune via a project `phpmd.xml`):**

| Check | Flags | Code |
|---|---|---|
| Cyclomatic complexity | Methods with too many branches/paths | M2-STYLE-001 |
| NPath complexity | Combinatorial explosion of execution paths | M2-STYLE-001 |
| Excessive method/class length | Methods/classes past a line-count threshold | M2-STYLE-002 |
| Excessive parameter lists | Constructors/methods with too many parameters | M2-STYLE-003 |
| Unused code | Unused local variables, parameters, private methods/fields | M2-STYLE-004 |
| Naming | Short/non-descriptive variable names | M2-STYLE-005 |

Full scale and code catalogue: `magento2-dev-core/references/severity-and-codes.md`.

No auto-fix, every PHPMD finding needs a manual refactor (usually: extract
method, reduce constructor dependencies via a factory/proxy, or delete dead
code).
