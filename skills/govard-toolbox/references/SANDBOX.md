# Sandbox Rehearsal Target

A derived project that plays a production remote over real SSH/rsync: `govard sandbox up` renders the origin project's own blueprint (PHP series, services) into one container, so `govard deploy --remote sandbox --yes` rehearses the exact deploy path. See `SKILL.md` Deployment for the deploy side.

```bash
govard sandbox up --profile full --php 8.3 --docroot symlink  # fresh: seeds once from the running origin env
govard sandbox status     # absent | dormant | running (+ profile/PHP from container labels)
govard sandbox ssh        # shell into the rehearsal target
govard deploy --remote sandbox --yes   # rehearse; also db dump -e sandbox, remote exec sandbox -- …, sync -e sandbox
govard sandbox reset      # wipe deploy dirs (+ reshape docroot); re-seed shared files after
govard sandbox down       # stop + remove container, keep volumes; --volumes deletes them, --purge also removes image+key+mirror
```

## Synthetic remote (nothing is configured, ever)

While the container runs, the literal name `sandbox` resolves as a synthetic remote from live Docker state — no `remotes.sandbox` block is written. `govard remote list` always prints its row (`sandbox | (implicit) | running|dormant|absent`). `sandbox` is reserved: `govard remote add sandbox` is refused, and a leftover `remotes.sandbox` block is shadowed with a warning (delete it).

## Seed-once gate

The seed runs only on a fresh container from the still-running origin env (DB dump with DEFINER-strip → import, one media tree, one framework-rewritten env file with `base_url` on the sandbox URL). Origin down → `up` refuses (`start it with govard env up first, or pass --no-seed`); `--no-seed` starts deliberately empty; `--recreate` refreshes; reuse keeps data. Magento note: `env.php` rewritten, service hosts localized to loopback.

## Profiles and docroot

`basic` (sshd/rsync/git, no web tier) / `php` (default) / `full` (+DB+cache+web). `--php` is an override (default: origin series) and `--docroot absent|symlink(default)|real` picks atomic-swap vs in-place publish. Conflicting `--profile`/`--php` on reuse is refused with a `--recreate` hint.

## Traps

- Fresh `symlink` sandbox: `remote exec` fails on the dangling `current` until the first deploy — deploy first or `--docroot real`.
- No search service ships in any recipe: search-dependent `setup:upgrade` fails — disable search modules in a scratch release, or join the origin env's network and borrow its engine (revert after).
- `up` waits for a real SSH login (`DialSandboxSSH`), not just TCP; no Docker → exit `3` `CAPABILITY_MISSING`.

Recipe extras (`deploy.settings.sandbox_packages|extensions|services|tools`) REPLACE the recipe lists (`sandbox_tools` only takes engine-known binaries, today `wp-cli`). `up` best-effort registers the slug on the shared SSH gateway (`127.0.0.1:2222`); absence never fails sandbox ops.
