import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { govardSh } from './lib/govard.mjs'
import { cacheHit, fetchPage } from './lib/http.mjs'
import { shellQuote } from './lib/shell.mjs'
import { ClosedReason } from './lib/status.mjs'

const snippet = join(dirname(fileURLToPath(import.meta.url)), 'php', 'save-product.php')
export const INVALIDATION_METHOD = 'save via product repository, adminhtml area'

async function hitMap(config, { prime }) {
  const map = {}
  for (const page of config.urlSet) {
    const url = `${config.baseUrl}${page.uri}`
    if (prime) await fetchPage(url, config)
    map[page.label] = cacheHit((await fetchPage(url, config)).headers).hit
  }
  return map
}

// Step 5 without admin credentials: record which frozen URLs are FPC HIT,
// save one product through the repository, then read each URL once more.
export async function invalidate(config, runDir) {
  const sku = config.invalidation?.sku
  if (!sku) throw new ClosedReason('invalidate', 'Skipped: invalidation sku missing')
  const before = await hitMap(config, { prime: true })
  const res = await govardSh(config.projectRoot, `php -- ${shellQuote(sku)}`, { stdin: readFileSync(snippet, 'utf-8') })
  if (res.code !== 0) throw new Error(`product save failed for SKU ${sku}: ${res.stderr || res.stdout}`)
  const after = await hitMap(config, { prime: false })
  const result = {
    sku,
    method: INVALIDATION_METHOD,
    before,
    after,
    invalidated: Object.keys(before).filter((label) => before[label] && !after[label]),
  }
  writeFileSync(join(runDir, 'invalidation.json'), `${JSON.stringify(result, null, 1)}\n`)
  return result
}
