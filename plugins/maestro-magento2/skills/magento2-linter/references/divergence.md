# Bare-tool runs and the native toolchain

Why a bare `vendor/bin/phpcs` or `phpstan` run can disagree with the native toolchain,
with the case that produced the rule.


`govard audit run`'s native toolchain image always includes Magento-aware PHPStan extensions
(`bitexpert/phpstan-magento`, the same package this skill's own Prerequisites section has you
install for local runs). A bare local `vendor/bin/phpcs`/`vendor/bin/phpstan` invocation that
skips those extensions doesn't see the same errors the native toolchain does, so don't assume a
bare-tool run matches what `govard audit run` (or any CI pipeline built on it) actually enforces.

**On one real audit**, `phpstan.neon` had inline `@phpstan-ignore` comments. A bare local
`vendor/bin/phpstan` run (no extensions installed) reported them as "unmatched", looking stale,
since nothing in that run triggered the errors they were suppressing, and they got deleted as
cleanup. The project's real lint gate installed `bitexpert/phpstan-magento`, a Magento-aware
PHPStan extension that resolves magic getters/setters and factory return types that vanilla
PHPStan can't see. With the extension active, those exact lines fired again as real errors; the
"cleanup" had silently reopened them. Two habits prevent this:

1. **Don't trust a bare local run's silence on `@phpstan-ignore` comments.** If a bare
   `vendor/bin/phpstan` run reports one as "unmatched," that's as likely to mean "this tool
   invocation is missing an extension the real gate uses" as "this suppression is genuinely
   stale", confirm against `govard audit run` (or the project's actual CI wrapper, if one still
   exists) before deleting it.
2. **Install the same PHPStan extensions the native toolchain does** (`phpstan/extension-installer`
   plus `bitexpert/phpstan-magento`, per this skill's Prerequisites) before deciding an
   `@phpstan-ignore` comment is stale or a finding is a false positive. A bare install without
   Magento-aware extensions reports far more "undefined method" noise than the native toolchain
   ever sees, AND can hide real findings that only surface once those extensions are active, verify both ways before touching an ignore list.

> **New findings that share an error message with an already-tolerated pattern still need their
> own check, don't dismiss a whole batch by shape alone.** On one real fix, several new findings
> got bucketed with older, already-accepted ones as "same pattern, not worth fixing." The real
> gate disagreed: only one of the *dismissed* findings actually failed it, and none of the old
> ones it was grouped with did. Verify each new finding against what the real gate reports, not
> against how similar its wording looks to already-tolerated noise.
