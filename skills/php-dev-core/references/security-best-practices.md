# Security Best Practices Reference

Framework-agnostic PHP security patterns. Each section shows the vulnerable pattern, the correct fix, and the verification step.

## XSS Prevention — Escape on Output

**NEVER** echo raw user input. Escape at the rendering boundary with `htmlspecialchars`.

```php
// WRONG — XSS
echo $_GET['name'];
echo "<div>$userInput</div>";

// CORRECT — htmlspecialchars with ENT_QUOTES | ENT_SUBSTITUTE and explicit UTF-8
echo htmlspecialchars($userInput, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
echo '<div data-id="' . htmlspecialchars($id, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">';
echo '<a href="' . htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">Profile</a>';

// JavaScript context — json_encode with hex flags
echo '<script>var name = ' . json_encode($name, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) . ';</script>';
```

Framework escapers (`Magento Escaper`, `Laravel e()`, `Twig autoescape`) build on the same `htmlspecialchars` principle — use them when available, fall back to `htmlspecialchars` in plain PHP.

Verification: `vendor/bin/phpcs --standard=PSR12` does not catch XSS; rely on code review and grep for `echo` without `htmlspecialchars` or escaper.

## SQL Injection — Prepared Statements Only

**NEVER** interpolate variables into SQL strings. Use `PDO::prepare` with bound parameters.

```php
// WRONG — SQL injection via string interpolation
$email = $_GET['email'];
$pdo->query("SELECT * FROM users WHERE email = '$email'");

// CORRECT — PDO::prepare with named placeholders and bindValue
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email AND status = :status');
$stmt->bindValue(':email', $email, \PDO::PARAM_STR);
$stmt->bindValue(':status', $status, \PDO::PARAM_STR);
$stmt->execute();
$rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

// Also correct — execute with array
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
$stmt->execute([':id' => $id]);
$user = $stmt->fetch(\PDO::FETCH_ASSOC);
```

Best practices:

- Disable emulated prepares: `$pdo->setAttribute(\PDO::ATTR_EMULATE_PREPARES, false);`
- Set error mode to exceptions: `$pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);`
- Use `PDO::PARAM_INT` / `PARAM_STR` explicitly for `bindValue`.
- Never use `PDO::query` with variable input — always `PDO::prepare`.

## CSRF Protection

Generate tokens with `random_bytes`, store in session, validate with `hash_equals`.

```php
// Generate token (on form render)
$token = bin2hex(random_bytes(32));
$_SESSION['csrf_token'] = $token;
echo '<input type="hidden" name="csrf_token" value="' . htmlspecialchars($token, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">';

// Validate token (on form submit) — use filter_input, timing-safe compare
$submitted = filter_input(INPUT_POST, 'csrf_token', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
$expected = $_SESSION['csrf_token'] ?? '';
if (!is_string($submitted) || !hash_equals($expected, $submitted)) {
    throw new \RuntimeException('Invalid CSRF token');
}
```

Additional rules:

- Tokens must be per-form or per-session, not global constants.
- Rotate tokens after use for sensitive actions (password change, payment).
- SameSite cookies (`SameSite=Lax` or `Strict`) complement but do not replace tokens.

## Cryptography — random_bytes vs md5/uniqid

| Vulnerable | Secure Replacement | Use Case |
|------------|-------------------|----------|
| `md5()`, `sha1()` | `password_hash()` / `password_verify()` | Password storage |
| `uniqid()`, `rand()`, `mt_rand()` | `random_bytes()` / `random_int()` | Tokens, nonces, salts |
| `serialize()` / `unserialize()` | `json_encode()` / `json_decode()` | Data serialization |

```php
// Passwords — NEVER md5
$hash = password_hash($password, PASSWORD_DEFAULT);
if (!password_verify($password, $hash)) {
    throw new \RuntimeException('Invalid credentials');
}
// Rehash if algorithm upgraded
if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
    $hash = password_hash($password, PASSWORD_DEFAULT);
}

// Tokens — NEVER uniqid() or rand()
$token = bin2hex(random_bytes(32));          // 256-bit token
$numericCode = random_int(100000, 999999);   // 6-digit OTP

// Serialization — NEVER unserialize() on user input
$json = json_encode($data, JSON_THROW_ON_ERROR);
$decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
```

Store secrets in `.env` (never in code or `composer.json`). Validate secrets are loaded before use and fail closed if missing.

## Input Validation — filter_input

```php
// Validate integer
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if ($id === false || $id === null) {
    throw new \InvalidArgumentException('Invalid id');
}

// Validate email
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
if ($email === false || $email === null) {
    throw new \InvalidArgumentException('Invalid email');
}

// Sanitize string for storage (escape on output instead for display)
$raw = filter_input(INPUT_POST, 'name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
```

## Severity Codes

Security findings use `PHP-SEC-xxx` codes; architecture findings use `PHP-ARCH-xxx`. Reference these codes in code review comments instead of free-form descriptions.
