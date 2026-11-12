# Host without Docker

The runtime requirement manifest, the commands that need no container, and what a host-only
session can and cannot do.

Govard works without a container runtime. Every command declares its runtime
requirement, and the requirement-free set is derived from that manifest:

```bash
govard capabilities          # command, requirement, host status
govard capabilities --json   # machine-readable, schema_version 1
```

- `CAPABILITY_MISSING` / exit code `3` means a declared capability (docker, ssh,
  rsync, cloudflared, net) is unavailable. The message names the capability, and
  `govard env up --error-json` prints it as a versioned JSON envelope. Do not
  hand-parse the text form.
- `govard doctor` exits `0` when only optional capabilities are missing and
  reports `required`/`severity`/`affects` per check; `govard doctor --strict`
  treats optional warnings as failures (the hard gate for bootstrap scripts).
- Container-free analysis: `govard audit run --checks integrity --format json`
  runs Go analyzers on the checkout with no Docker, no PHP and no toolchain. It
  is supported on Magento 2 only (composer manifest/lock problems plus
  module/DI wiring problems, `govard-integrity` findings); Laravel, Symfony and
  WordPress exit 1 with "does not support integrity audit". **`--checks lint` still needs Docker** and, without it, exits `3`
  pointing at `--checks integrity`.
  Xdebug is orthogonal to the container: on a host with `stack.features.xdebug`
  on, the audit refuses to start and asks for `--allow-xdebug` (`govard verify`
  has the same flag). Pass the flag or turn Xdebug off; this is not a
  capability failure and the exit code is not `3`.
- Commands that forward their arguments (`govard tool php ...`,
  `govard redis cli ...`) cannot parse `--error-json`; their exit codes are
  unchanged.
