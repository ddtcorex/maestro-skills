---
name: dsh-safe-web-update
description: Use before updating any dsh-maestro-* client bundle or DSH Web asset, or before reloading the running dsh web host process; validate first and perform a user-approved host restart through the bundled guarded recipe.
compatibility: dsh
---

# Safe DSH Web Update

## Purpose

One `dsh web` process serves both the live Web UI on port 3080 and the
GitLab-webhook service on port 3000. A host restart drops the live socket and
the in-flight turn, although sessions rehydrate from the append-only log when
the browser reconnects. Treat a restart as disruptive: validate first and get
explicit user consent before a real swap.

## Classify the change before touching the live process

- **Static asset in `apps/web/dist/`** — patch the asset and verify served
  bytes with `curl`; no restart.
- **Client plugin bundle** (client JavaScript, CSS, slots, React) — run that
  package's `build:client`, confirm a bundle marker, then refresh the browser;
  no host restart.
- **Host Node library, `cordis.patch.yml`, or profile plugin composition** —
  validate a candidate and restart only after the user says to do so.

## Required preflight for a host restart

1. Run relevant package tests and build steps, then check the output really
   carries the expected marker.
2. Dry-boot the candidate on an ephemeral port with an isolated `DSH_HOME`.
   Keep the live process and its sessions/settings untouched. If the review
   webhook conflicts on port 3000, exclude that provider for the candidate or
   run a no-server composition check instead.
3. Verify HTTP 200 and the new marker on the candidate. Retain last-known-good
   assets until the real swap has passed post-swap checks.
4. Ask for explicit consent and timing. “restart đi” is consent; silence is
   not.

## Run the bundled helper only after consent

The skill loader provides this directory as the skill resource base. Substitute
that real path for `<skill-resource-base>`; never use a copied, machine-specific
path from documentation.

```bash
# Safe inspection only: resolves the serving tree but changes nothing.
bash <skill-resource-base>/scripts/restart-dsh-web.sh \
  --repo /path/to/deepseek-harness --dry-run

# Only after explicit user consent. Run detached because the current DSH turn
# can be interrupted as the process tree stops.
setsid nohup bash <skill-resource-base>/scripts/restart-dsh-web.sh \
  --repo /path/to/deepseek-harness --confirm \
  </dev/null >/dev/null 2>&1 &
```

`--repo` may be replaced by `DSH_REPO`; `--log` or `DSH_RESTART_LOG` changes
the append-only log destination. The helper refuses a real swap without
`--confirm`, dynamically resolves listeners rather than trusting saved PIDs,
and refuses to launch if ports are still occupied. `--dry-run` never runs
`kill` or `setsid`.

## Post-swap checks

Do not read the top of an old append-only log as liveness evidence. Instead:

1. Confirm exactly one healthy listener tree owns ports 3000 and 3080 with
   `ss -tlnp`.
2. Confirm HTTP 200 from port 3080.
3. Check served bytes contain the **new**, unique marker; or make a fresh
   browser/Playwright probe for the changed UI. Shared third-party markers are
   not sufficient proof.
4. If a marker or live behaviour is wrong, restore the retained last-known-good
   assets and relaunch with the same guarded process.

## Never do these

- Kill the process from an inline agent shell; the killing action can terminate
  that shell before it relaunches DSH.
- **Never invoke this skill from inside a DSH chat session's agent turn.** The agent itself runs inside `dsh web`; killing `dsh web` from its own turn interrupts that turn (`interrupted` in the append-only log) and the `setsid nohup` relaunch never completes from the killed shell. If you are an agent, stop and hand the restart to the human: print the exact `setsid nohup ... --confirm` command for the human to run in their own terminal, do not execute it.
- Restart for a client-only or static change.
- Hard-code a PID or a local developer's workspace path.
- Treat a 200 response alone as proof that a rebuilt plugin was loaded.

## Agent handoff (required when you are an agent)

If you are running inside `dsh web` (any `dsh-*` skill, `maestro-*` skill, or subagent), you **must not** execute the restart yourself:

1. Run all preflight checks (`--dry-run`, `pnpm verify`, marker grep) and report the results.
2. Print the exact detached command the human should run, e.g.:

   ```bash
   setsid nohup bash <skill-resource-base>/scripts/restart-dsh-web.sh \
     --repo /path/to/deepseek-harness --confirm \
     </dev/null >/dev/null 2>&1 &
   ```

3. Wait for explicit human confirmation in a new terminal. The interrupted turn will rehydrate from the log when the browser reconnects — no data is lost.
