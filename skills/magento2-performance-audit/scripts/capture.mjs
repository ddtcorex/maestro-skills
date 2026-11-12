import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { govardSh } from './lib/govard.mjs'
import { fetchPage, settle } from './lib/http.mjs'
import { parseQueryLog } from './lib/querylog.mjs'
import { ClosedReason } from './lib/status.mjs'

const LOCK = 'var/debug/.performance-audit.lock'
const DB_LOG = 'var/debug/db.log'
const queryLog = (callStack, threshold) =>
  `bin/magento dev:query-log:enable --include-all-queries=true --include-call-stack=${callStack} --query-time-threshold=${threshold}`

async function sh(root, cmd) {
  const res = await govardSh(root, cmd)
  if (res.code !== 0) throw new Error(`govard sh failed (${res.code}): ${cmd}\n${res.stderr}`)
  return res
}

async function capturePage(config, runDir, pass, page) {
  const url = `${config.baseUrl}${page.uri}`
  await fetchPage(url, config)
  await settle()
  await sh(config.projectRoot, `: > ${DB_LOG}`)
  const res = await fetchPage(url, config)
  await settle()
  writeFileSync(join(runDir, 'capture', pass, `${page.label}.html`), res.body)
  const logFile = join(runDir, 'capture', pass, `${page.label}.db.log`)
  const source = join(config.projectRoot, DB_LOG)
  if (existsSync(source)) copyFileSync(source, logFile)
  else writeFileSync(logFile, '')
  const queries = parseQueryLog(readFileSync(logFile, 'utf-8')).length
  appendFileSync(join(runDir, 'capture', 'summary.csv'), `${pass},${page.label},${page.uri},${res.status},${res.total.toFixed(4)},${res.ttfb.toFixed(4)},${queries}\n`)
}

// The checkout the pages were served from, for the report subtitle. A
// project that is not the root of its own git checkout (none at all, or one
// nested in a parent repository) records nothing; a detached HEAD records
// the commit with no branch.
export function writeRevision(projectRoot, captureDir) {
  const git = (...args) => execFileSync('git', ['-C', projectRoot, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let revision
  try {
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(projectRoot)) return
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
    revision = { branch: branch === 'HEAD' ? null : branch, commit: git('rev-parse', '--short', 'HEAD') }
  } catch {
    return // not a git checkout, or no commit yet
  }
  writeFileSync(join(captureDir, 'revision.json'), `${JSON.stringify(revision)}\n`)
}

// Uncached capture: FPC, block and layout caches off, query log and HTML
// profiler on. The lock and the restore sequence keep a parallel or failed
// run from leaving the project with caches disabled.
export async function capture(config, runDir, { scope = 'deep' } = {}) {
  const root = config.projectRoot
  const deep = scope === 'deep'
  const pages = deep ? config.urlSet : config.urlSet.slice(0, 3)
  const passes = deep ? ['pass1', 'pass2'] : ['pass1']
  const token = `${Date.now()}-${process.pid}`

  const lock = await govardSh(root, `mkdir ${LOCK} && printf '%s\\n' '${token}' > ${LOCK}/owner`)
  if (lock.code !== 0) throw new ClosedReason('capture', 'Skipped: query-log capture already owned')

  for (const pass of [...passes, 'trace']) mkdirSync(join(runDir, 'capture', pass), { recursive: true })
  writeFileSync(join(runDir, 'capture', 'summary.csv'), 'pass,label,uri,http,timeTotal,ttfb,queries\n')
  writeRevision(root, join(runDir, 'capture'))
  try {
    await sh(root, [
      'bin/magento dev:profiler:enable html',
      queryLog(false, deep ? 0 : 1),
      'bin/magento cache:disable full_page block_html layout',
      'bin/magento cache:flush',
    ].join(' && '))
    for (const pass of passes) {
      for (const page of pages) await capturePage(config, runDir, pass, page)
    }
    if (deep && config.trace.length > 0) {
      await sh(root, queryLog(true, 0))
      for (const page of pages.filter((p) => config.trace.includes(p.label))) await capturePage(config, runDir, 'trace', page)
    }
  } finally {
    await govardSh(root, [
      `test "$(cat ${LOCK}/owner 2>/dev/null)" = '${token}' || exit 1`,
      'bin/magento cache:enable full_page block_html layout',
      'bin/magento cache:flush',
      'bin/magento dev:profiler:disable',
      'bin/magento dev:query-log:disable',
      `: > ${DB_LOG}`,
      `rm -f ${LOCK}/owner`,
      `rmdir ${LOCK}`,
    ].join('; '))
  }
}
