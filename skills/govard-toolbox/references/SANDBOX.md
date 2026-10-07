# Sandbox Rehearsal Target

A derived project that plays a production remote over real SSH/rsync: `govard sandbox up` renders the origin project's own blueprint (PHP series, services) into one container, so `govard deploy --remote sandbox --yes` rehearses the exact deploy path. See `SKILL.md` Deployment for the deploy side.

```bash
govard sandbox up --profile full --php <series> --docroot symlink  # fresh: seeds once from the running origin env
govard sandbox status     # absent | dormant | running (+ profile/PHP from container labels)
govard sandbox ssh        # shell into the rehearsal target
govard deploy --remote sandbox --yes   # rehearse; also db dump -e sandbox, remote exec sandbox -- …, sync -e sandbox
govard sandbox reset      # wipe deploy dirs (--docroot reshapes); re-seed shared files after
govard sandbox down       # stop + remove container, keep volumes; --volumes deletes them, --purge also removes image+key+mirror
```

## Synthetic remote (nothing is configured, ever)

While the container runs, the literal name `sandbox` resolves as a synthetic remote from live Docker state; no `remotes.sandbox` block is written. `govard remote list` always prints its row (`sandbox | (implicit) | running|dormant|absent`). `sandbox` is reserved: `govard remote add sandbox` is refused, and a leftover `remotes.sandbox` block is shadowed with a warning (delete it).

## Seed-once gate

The seed runs only on a fresh container from the still-running origin env (DB dump with DEFINER-strip then import, one media tree, one framework-rewritten env file with `base_url` on the sandbox URL). Origin down: `up` refuses and says to start it with `govard env up` first, or pass `--no-seed`; `--no-seed` starts deliberately empty; `--recreate` rebuilds the image and container; `--reseed` refreshes the database and files from the origin even when the sandbox already holds them; plain reuse keeps data. Magento note: `env.php` is rewritten and service hosts are localized to loopback.

## Profiles and docroot

`basic` (sshd/rsync/git) / `php` (default; adds php-cli, composer, node) / `full` (adds a database and a cache). `--php` picks the PHP series (default: the project's `stack.php_version` when it names a series; an existing sandbox keeps its series), `--db` picks the `full` profile's database (`mariadb:<series>`; a MySQL stack is refused rather than rehearsed on another engine), and `--docroot absent|symlink|real` shapes the target: `absent`/`symlink` select the atomic swap, `real` selects in-place publish. An explicit conflicting `--profile` on a running sandbox is refused with a `--recreate` hint.

## Traps

- Fresh `symlink` sandbox: `remote exec` fails on the dangling `current` until the first deploy. Deploy first or use `--docroot real`.
- No search service is provided by the sandbox, so a search-dependent step can fail. If `setup:upgrade` does, disable the search modules in a scratch release, or join the origin env's network and borrow its engine (revert afterwards).
- The sandbox mirrors the project's **git repository**: the project must be a git repo with the work committed, and tracked build output (for example Magento's `pub/static`) breaks the release build. Keep `.govard/` and build output out of git.
- The origin must be installed and running: an empty origin database makes the seed fail on missing core tables.
- The seed copies the database and the framework's media tree. It does **not** seed environment files that live outside the repository, so a first deploy fails at the migrate step until the target has them (`shared/.env`, `shared/.env.local`, `shared/wp-config.php`: see the framework skill). `sandbox reset` wipes `shared/`, so re-seed afterwards. Write them non-interactively with `printf '...' | govard sandbox ssh`.
- The `full` profile waits for its database to answer. On a MariaDB series whose image ships `mariadb-admin` but not `mysqladmin`, `up` can exit 127: pass `--db mariadb:<older series>`. If the final seed step fails on `chown` of the deploy user's home, a second plain `up` reuses the seeded container.
- `sandbox ssh` opens an interactive shell and takes no command; use `govard remote exec sandbox -- <cmd>`. `govard open <target> -e sandbox` does not resolve the synthetic remote.
- `deploy unlock --force` clears the lock but not maintenance mode; a deploy that failed mid-way can leave the live release returning 503 until a later deploy or `--resume` completes.
- `up` waits for a real SSH login, not just an open TCP port. No Docker means exit `3` `CAPABILITY_MISSING`.

Recipe extras (`deploy.settings.sandbox_packages|extensions|services|tools`) REPLACE the recipe lists (`sandbox_tools` only takes binaries from the engine's known list). `up` best-effort registers the slug on the shared SSH gateway (`127.0.0.1:2222`); absence never fails sandbox ops.
