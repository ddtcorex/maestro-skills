---
name: govard-laravel
description: |
  This skill should be used when the user asks to "run migrations", "run artisan commands",
  "clear Laravel cache", "config:cache", "run queue operations", "schedule:run", "tinker into
  app", "artisan tinker", "run Laravel Pint", or "npm dev/prod". Provides Laravel-specific
  Govard shortcuts and commands. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot, dsh
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: laravel
---

# Govard Laravel Commands

Laravel-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Laravel-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

## Artisan Commands

```bash
# Cache management
govard tool artisan config:cache
govard tool artisan config:clear
govard tool artisan cache:clear

# Route cache
govard tool artisan route:cache
govard tool artisan route:clear

# View cache
govard tool artisan view:cache
govard tool artisan view:clear
```

## Database

```bash
# Migrations
govard tool artisan migrate
govard tool artisan migrate:fresh
govard tool artisan migrate:refresh
govard tool artisan migrate:rollback
govard tool artisan migrate:status

# Seeders
govard tool artisan db:seed
govard tool artisan db:seed --class=UserSeeder

# Factory
govard tool artisan make:factory PostFactory
govard tool artisan tinker

# Direct SQL
govard db connect
```

## Queue Operations

```bash
# Start queue worker
govard tool artisan queue:work

# Queue withSupervisor
govard svc up

# Retry failed jobs
govard tool artisan queue:retry all
govard tool artisan queue:failed

# Clear queue
govard tool artisan queue:flush
```

## Scheduler

```bash
# Run scheduler (keep in cron)
govard tool artisan schedule:run

# List scheduled
govard tool artisan schedule:list
```

## Development

```bash
# Create commands
govard tool artisan make:command MyCommand
govard tool artisan make:controller MyController
govard tool artisan make:model Post
govard tool artisan make:migration create_posts_table

# Tinker (interactive REPL)
govard tool artisan tinker

# Show routes
govard tool artisan route:list
govard tool artisan route:list --path=api
```

## Testing

```bash
# Run tests
govard tool artisan test

# With PHPUnit
govard tool php artisan test
govard tool php vendor/bin/phpunit

# Specific test
govard tool php vendor/bin/phpunit --filter=UserTest
```

## Frontend Assets

```bash
# Node modules
govard tool npm install
govard tool npm run dev
govard tool npm run prod
govard tool npm run watch

# Laravel Mix (if using)
govard tool npm run dev
govard tool npm run production

# Clear Vite cache
# node_modules is bind-mounted into the container; clearing from the host is safe
rm -rf node_modules/.vite
```

## Logging

```bash
# View logs
tail -f storage/logs/laravel.log

# Clear logs
govard tool artisan log:clear

# Laravel Debugbar (if installed)
curl -s https://local.test/_debugbar/open
```

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard tool artisan migrate
govard tool artisan cache:clear
govard tool npm install && govard tool npm run dev
```

### Creating Features

```bash
govard tool artisan make:model Post -mcr  # Model + Migration + Controller
govard tool artisan migrate
govard tool artisan route:list
```

### Deployment Prep

```bash
govard tool artisan config:cache
govard tool artisan route:cache
govard tool artisan view:cache
govard tool npm run prod
```