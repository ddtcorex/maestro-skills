import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { govardSh } from './lib/govard.mjs'
import { fetchPage } from './lib/http.mjs'
import { INSTALL_HINT, median, readRun, resolveLighthouse, runLighthouse } from './lib/lighthouse.mjs'
import { ClosedReason } from './lib/status.mjs'

const NO_HIT = 'Skipped: no FPC HIT'
const NO_SIGNAL = 'Skipped: no HIT signal (production mode, built-in FPC)'
const NO_MISS = 'Skipped: no cold MISS'
const NO_COLD_SIGNAL = 'Skipped: no cold signal (production mode, built-in FPC)'
const CLEAN_FPC = 'bin/magento cache:clean full_page'

// One measured run: a miss (or a run with no document response) is discarded
// and retried once; two misses in a row skip the page.
async function measuredRun(cli, url, dir, label, index) {
  const attempts = []
  for (const attempt of [0, 1]) {
    const out = join(dir, `${label}.warm${index}${attempt ? 'r' : ''}.json`)
    await runLighthouse(cli, url, out)
    const run = readRun(out)
    attempts.push(run)
    if (run.hit === true && run.score !== null && !run.runtimeError) return { run }
  }
  return { skipped: attempts.every((a) => a.source === 'none') ? NO_SIGNAL : NO_HIT }
}

// The cold run is the first load after the page cache was cleaned: a HIT
// means something else served the page, so the cache is cleaned again and
// the run retried once; a second failure skips the page.
export async function measureCold(label, { runOnce, flush }) {
  const attempts = []
  for (const attempt of [0, 1]) {
    if (attempt === 1) await flush()
    const run = await runOnce(label, attempt)
    attempts.push(run)
    if (run.hit === false && run.source !== 'none' && !run.runtimeError) {
      const { score, lcpMs, cls, ttfbMs, tbtMs, source } = run
      return { score, lcpMs, cls, ttfbMs, tbtMs, cacheState: 'MISS', source }
    }
  }
  return { skipped: attempts.every((a) => a.source === 'none') ? NO_COLD_SIGNAL : NO_MISS }
}

async function measurePage(cli, config, dir, page, runs) {
  const url = `${config.baseUrl}${page.uri}`
  await fetchPage(url, config)
  const kept = []
  for (let i = 0; i < runs; i++) {
    const res = await measuredRun(cli, url, dir, page.label, i)
    if (res.skipped) return { skipped: res.skipped }
    kept.push(res.run)
  }
  const metric = (key) => median(kept.map((r) => r[key]))
  const range = (key) => Math.max(...kept.map((r) => r[key])) - Math.min(...kept.map((r) => r[key]))
  return {
    runs: kept.map(({ score, lcpMs, cls, ttfbMs, tbtMs, source }) => ({ score, lcpMs, cls, ttfbMs, tbtMs, hitSource: source })),
    median: { score: metric('score'), lcpMs: metric('lcpMs'), cls: metric('cls'), ttfbMs: metric('ttfbMs'), tbtMs: metric('tbtMs') },
    spread: runs > 1 ? { score: range('score'), lcpMs: range('lcpMs') } : 'Skipped: quick',
    hitSource: kept[0].source,
  }
}

// cwv.json entries written before the cold run existed hold the warm result
// at the top level.
export function normalizeCwv(entry) {
  if (entry && typeof entry === 'object' && ('cold' in entry || 'warm' in entry)) return entry
  return { cold: undefined, warm: entry }
}

// Core Web Vitals per page: one cold run after the page cache is cleaned,
// then the warm runs primed and measured from the FPC.
export async function cwv(config, runDir, { scope = 'deep' } = {}) {
  const cli = resolveLighthouse(process.env)
  if (!cli) throw new ClosedReason('cwv', `Skipped: Lighthouse CLI not found (${INSTALL_HINT})`)
  const status = await govardSh(config.projectRoot, 'bin/magento cache:status')
  if (/full_page:\s*0/.test(status.stdout)) throw new ClosedReason('cwv', 'Skipped: page cache disabled')

  const deep = scope === 'deep'
  const pages = deep ? config.urlSet : config.urlSet.slice(0, 3)
  const dir = join(runDir, 'cwv')
  mkdirSync(dir, { recursive: true })
  const flush = async () => {
    await govardSh(config.projectRoot, CLEAN_FPC)
  }
  const cold = {}
  await flush()
  for (const page of pages) {
    const url = `${config.baseUrl}${page.uri}`
    const runOnce = async (label, attempt) => {
      const out = join(dir, `${label}.cold${attempt}.json`)
      await runLighthouse(cli, url, out)
      return readRun(out)
    }
    cold[page.label] = await measureCold(page.label, { runOnce, flush })
  }
  const result = {}
  for (const page of pages) result[page.label] = { cold: cold[page.label], warm: await measurePage(cli, config, dir, page, deep ? 3 : 1) }
  writeFileSync(join(dir, 'cwv.json'), `${JSON.stringify(result, null, 1)}\n`)
  return result
}
