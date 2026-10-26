import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { cacheHit } from './http.mjs'

export const INSTALL_HINT = 'install with `npm install -g @lhci/cli` or set LIGHTHOUSE_CLI to a lighthouse binary or cli/index.js'

function npmRootGlobal(env) {
  if (env.PERF_AUDIT_NPM_ROOT !== undefined) return env.PERF_AUDIT_NPM_ROOT
  try {
    return execFileSync('npm', ['root', '-g'], { encoding: 'utf-8', env }).trim()
  } catch {
    return null
  }
}

// Order: LIGHTHOUSE_CLI, `lighthouse` on PATH, the copy bundled in a global @lhci/cli.
export function resolveLighthouse(env = process.env) {
  if (env.LIGHTHOUSE_CLI && existsSync(env.LIGHTHOUSE_CLI)) return env.LIGHTHOUSE_CLI
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir && existsSync(join(dir, 'lighthouse'))) return join(dir, 'lighthouse')
  }
  const root = npmRootGlobal(env)
  const bundled = root && join(root, '@lhci', 'cli', 'node_modules', 'lighthouse', 'cli', 'index.js')
  return bundled && existsSync(bundled) ? bundled : null
}

export function runLighthouse(cli, url, outPath) {
  const args = [url, '--preset=desktop', '--throttling-method=devtools', '--save-assets', '--output=json', `--output-path=${outPath}`, '--quiet', '--chrome-flags=--headless=new']
  const [cmd, argv] = cli.endsWith('.js') ? [process.execPath, [cli, ...args]] : [cli, args]
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: ['ignore', 'ignore', 'pipe'], env: process.env })
    let stderr = ''
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr }))
  })
}

// FPC state of the document request, from the run's own devtools log.
export function hitSignal(devtoolsLog, finalUrl) {
  const docs = devtoolsLog.filter((e) => e.method === 'Network.responseReceived' && e.params?.type === 'Document')
  const strip = (u) => String(u).replace(/\/$/, '')
  const doc = docs.find((e) => strip(e.params.response.url) === strip(finalUrl)) ?? docs[0]
  if (!doc) return { hit: null, source: null }
  return cacheHit(doc.params.response.headers)
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

export function readRun(outPath) {
  // --save-assets writes a ~50 MB trace per run next to the devtools log; only
  // the devtools log (HIT proof) is needed, so the trace is dropped at once.
  rmSync(outPath.replace(/\.json$/, '-0.trace.json'), { force: true })
  const report = JSON.parse(readFileSync(outPath, 'utf-8'))
  const logPath = outPath.replace(/\.json$/, '-0.devtoolslog.json')
  const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf-8')) : []
  const value = (id) => report.audits?.[id]?.numericValue ?? null
  const score = report.categories?.performance?.score
  return {
    score: score === null || score === undefined ? null : Math.round(score * 100),
    lcpMs: value('largest-contentful-paint') === null ? null : Math.round(value('largest-contentful-paint')),
    cls: value('cumulative-layout-shift') === null ? null : Math.round(value('cumulative-layout-shift') * 1000) / 1000,
    ttfbMs: value('server-response-time') === null ? null : Math.round(value('server-response-time')),
    runtimeError: report.runtimeError?.code ?? null,
    ...hitSignal(log, report.finalDisplayedUrl ?? report.requestedUrl),
  }
}
