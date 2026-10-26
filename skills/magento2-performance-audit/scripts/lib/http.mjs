import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { join } from 'node:path'

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
}

// Node does not read the system CA store, so the Govard local CA is passed
// explicitly: `caFile` from perf-audit.config.json, else Govard's own root CA.
export function resolveCaFile(config = {}, env = process.env) {
  if (config.caFile) return config.caFile
  const govardCa = env.HOME ? join(env.HOME, '.govard', 'ssl', 'root.crt') : null
  return govardCa && existsSync(govardCa) ? govardCa : undefined
}

// One GET without following redirects. TLS verification always stays on.
export function fetchPage(url, config = {}) {
  const client = url.startsWith('https:') ? https : http
  const caFile = url.startsWith('https:') ? resolveCaFile(config) : undefined
  const ca = caFile ? readFileSync(caFile) : undefined
  const started = process.hrtime.bigint()
  const seconds = () => Number(process.hrtime.bigint() - started) / 1e9
  return new Promise((resolve, reject) => {
    const req = client.get(url, { headers: HEADERS, ca }, (res) => {
      const ttfb = seconds()
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (d) => (body += d))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, ttfb, total: seconds() }))
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

export const settle = () => new Promise((r) => setTimeout(r, Number(process.env.PERF_AUDIT_SETTLE_MS ?? 1000)))

// FPC state from response headers: built-in FPC debug header (developer
// mode), then Varnish X-Cache, then Age. source 'none' means no signal.
export function cacheHit(rawHeaders) {
  const headers = Object.fromEntries(Object.entries(rawHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]))
  if (headers['x-magento-cache-debug'] !== undefined) return { hit: /HIT/i.test(headers['x-magento-cache-debug']), source: 'x-magento-cache-debug' }
  if (headers['x-cache'] !== undefined) return { hit: /HIT/i.test(headers['x-cache']), source: 'x-cache' }
  if (headers.age !== undefined) return { hit: Number(headers.age) > 0, source: 'age' }
  return { hit: false, source: 'none' }
}
