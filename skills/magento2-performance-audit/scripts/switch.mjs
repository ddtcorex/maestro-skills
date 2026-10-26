import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { govardRedis, govardSh } from './lib/govard.mjs'
import { fetchPage } from './lib/http.mjs'
import { ClosedReason } from './lib/status.mjs'

const php = join(dirname(fileURLToPath(import.meta.url)), 'php', 'cache-config.php')
const isRedis = (frontend) => /redis/i.test(frontend?.backend ?? '')

// Which cache stores a branch switch must flush. The session database is
// never flushed, even when a cache frontend shares it.
export function cacheTargets(env) {
  const frontend = env?.cache?.frontend ?? {}
  const sessionDb = env?.session?.save === 'redis' && env.session.redis?.database !== undefined ? Number(env.session.redis.database) : null
  if (!isRedis(frontend.default) && !isRedis(frontend.page_cache)) return { kind: 'file', databases: [], sessionDb }
  const databases = []
  for (const name of ['default', 'page_cache']) {
    if (!isRedis(frontend[name])) continue
    const db = Number(frontend[name].backend_options?.database ?? 0)
    if (db !== sessionDb && !databases.includes(db)) databases.push(db)
  }
  return { kind: 'redis', databases, sessionDb }
}

function git(root, ...args) {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf-8' })
  return { code: res.status, out: `${res.stdout}${res.stderr}`.trim() }
}

function mustGit(root, ...args) {
  const res = git(root, ...args)
  if (res.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.out}`)
  return res.out
}

async function sh(root, cmd) {
  const res = await govardSh(root, cmd)
  if (res.code !== 0) throw new Error(`${cmd} failed (${res.code}): ${res.stderr || res.stdout}`)
  return res.stdout
}

function enabledInConfig(root) {
  const text = readFileSync(join(root, 'app', 'etc', 'config.php'), 'utf-8')
  return [...text.matchAll(/'([A-Za-z0-9]+_[A-Za-z0-9]+)'\s*=>\s*1\b/g)].map((m) => m[1])
}

// Switches the checkout to <branch> and rebuilds what a module or lock change
// needs, in order, then proves the switch is complete.
export async function switchBranch(config, branch) {
  const root = config.projectRoot
  const steps = []
  const step = (name) => steps.push(name)

  mustGit(root, 'fetch', '--all', '--prune')
  step('fetch')
  const previous = mustGit(root, 'rev-parse', 'HEAD')
  const checkout = git(root, 'checkout', branch)
  if (checkout.code !== 0) throw new ClosedReason('switch', `Skipped: checkout of ${branch} blocked: ${checkout.out}`)
  step('checkout')
  const pull = git(root, 'pull', '--ff-only', 'origin', branch)
  if (pull.code !== 0) {
    if (/fast-forward|diverg/i.test(pull.out)) throw new ClosedReason('switch', 'Skipped: local diverged')
    throw new Error(`git pull failed: ${pull.out}`)
  }
  step('pull')

  const lock = (ref) => git(root, 'rev-parse', `${ref}:composer.lock`).out
  if (lock(previous) !== lock('HEAD')) {
    await sh(root, 'composer install --no-interaction')
    step('composer install')
  }
  await sh(root, 'rm -rf generated/code generated/metadata')
  step('clear generated')

  // Flushed directly: bin/magento cannot bootstrap while the cache still
  // references modules the new branch does not have.
  const targets = cacheTargets(JSON.parse((await govardSh(root, 'php', { stdin: readFileSync(php, 'utf-8') })).stdout || '{}'))
  if (targets.kind === 'file') await sh(root, 'rm -rf var/cache var/page_cache')
  for (const db of targets.databases) {
    const res = await govardRedis(root, ['-n', String(db), 'FLUSHDB'])
    if (res.code !== 0) throw new Error(`redis FLUSHDB ${db} failed: ${res.stderr || res.stdout}`)
  }
  step('flush cache')

  await sh(root, 'bin/magento setup:upgrade')
  step('setup:upgrade')

  const enabled = new Set((await sh(root, 'bin/magento module:status --enabled')).split('\n').map((l) => l.trim()))
  const missing = enabledInConfig(root).filter((m) => !enabled.has(m))
  if (missing.length > 0) throw new ClosedReason('switch', `module list mismatch: enabled in app/etc/config.php but not in Magento: ${missing.join(', ')}`)
  step('module check')

  const broken = []
  for (const page of config.urlSet) {
    const res = await fetchPage(`${config.baseUrl}${page.uri}`, config)
    if (res.status !== 200) broken.push(`${page.uri} (${res.status})`)
  }
  if (broken.length > 0) throw new ClosedReason('switch', `frozen URLs not returning 200 after the switch: ${broken.join(', ')}`)
  step('url check')
  return { branch, steps, cache: targets }
}

