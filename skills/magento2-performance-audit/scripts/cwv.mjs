import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { govardSh } from './lib/govard.mjs'
import { fetchPage } from './lib/http.mjs'
import { INSTALL_HINT, median, readRun, resolveLighthouse, runLighthouse } from './lib/lighthouse.mjs'
import { ClosedReason } from './lib/status.mjs'

const NO_HIT = 'Skipped: no FPC HIT'
const NO_SIGNAL = 'Skipped: no HIT signal (production mode, built-in FPC)'

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
    runs: kept.map(({ score, lcpMs, cls, ttfbMs, source }) => ({ score, lcpMs, cls, ttfbMs, hitSource: source })),
    median: { score: metric('score'), lcpMs: metric('lcpMs'), cls: metric('cls'), ttfbMs: metric('ttfbMs') },
    spread: runs > 1 ? { score: range('score'), lcpMs: range('lcpMs') } : 'Skipped: quick',
    hitSource: kept[0].source,
  }
}

// Warm Core Web Vitals: each page primed, then measured from the FPC.
export async function cwv(config, runDir, { scope = 'deep' } = {}) {
  const cli = resolveLighthouse(process.env)
  if (!cli) throw new ClosedReason('cwv', `Skipped: Lighthouse CLI not found (${INSTALL_HINT})`)
  const status = await govardSh(config.projectRoot, 'bin/magento cache:status')
  if (/full_page:\s*0/.test(status.stdout)) throw new ClosedReason('cwv', 'Skipped: page cache disabled')

  const deep = scope === 'deep'
  const pages = deep ? config.urlSet : config.urlSet.slice(0, 3)
  const dir = join(runDir, 'cwv')
  mkdirSync(dir, { recursive: true })
  const result = {}
  for (const page of pages) result[page.label] = await measurePage(cli, config, dir, page, deep ? 3 : 1)
  writeFileSync(join(dir, 'cwv.json'), `${JSON.stringify(result, null, 1)}\n`)
  return result
}
