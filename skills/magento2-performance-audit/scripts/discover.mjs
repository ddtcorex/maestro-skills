import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { govardSh } from './lib/govard.mjs'
import { ClosedReason } from './lib/status.mjs'

const php = join(dirname(fileURLToPath(import.meta.url)), 'php', 'discover.php')
const TRACE = ['home', 'category_large', 'product_1']

const toUri = (url) => {
  const parsed = new URL(url)
  return `${parsed.pathname}${parsed.search}`
}

// Frozen URL set: home, the smallest, median and largest non-empty category
// by product count, and three products of distinct types (filled with other
// products when the catalog has fewer types).
export function pickUrlSet(candidates) {
  const categories = candidates.categories.filter((c) => c.productCount > 0).sort((a, b) => a.productCount - b.productCount)
  const set = [{ label: 'home', uri: '/' }]
  if (categories.length > 0) {
    set.push({ label: 'category_small', uri: toUri(categories[0].url) })
    set.push({ label: 'category_medium', uri: toUri(categories[Math.floor(categories.length / 2)].url) })
    set.push({ label: 'category_large', uri: toUri(categories[categories.length - 1].url) })
  }
  const byType = []
  const seen = new Set()
  for (const p of candidates.products) {
    if (!seen.has(p.type)) {
      seen.add(p.type)
      byType.push(p)
    }
  }
  const products = [...byType, ...candidates.products.filter((p) => !byType.includes(p))].slice(0, 3)
  products.forEach((p, i) => set.push({ label: `product_${i + 1}`, uri: toUri(p.url) }))
  return set
}

export async function discover(projectRoot, baseUrl, outPath, { refresh = false } = {}) {
  if (existsSync(outPath) && !refresh) {
    throw new ClosedReason('discover', `Skipped: ${outPath} exists and later audits compare against it; pass --refresh to rewrite it`)
  }
  const res = await govardSh(projectRoot, 'php', { stdin: readFileSync(php, 'utf-8') })
  if (res.code !== 0) throw new Error(`discovery failed: ${res.stderr || res.stdout}`)
  const candidates = JSON.parse(res.stdout)
  const urlSet = pickUrlSet(candidates)
  const config = {
    projectRoot,
    baseUrl: baseUrl.replace(/\/$/, ''),
    urlSet,
    trace: TRACE.filter((label) => urlSet.some((u) => u.label === label)),
    themeChain: candidates.themeChain,
    themeOverrides: candidates.themeOverrides,
    invalidation: candidates.products[0] ? { sku: candidates.products[0].sku } : undefined,
  }
  writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`)
  return config
}
