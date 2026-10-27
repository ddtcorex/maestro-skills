// Magento HTML profiler table. The timer name is read from the title
// attribute (cell text is truncated and indented); titles may contain `->`
// and entities, so attributes are matched by their quotes, never by `>`.
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m])

export function parseProfiler(html) {
  const table = html.match(/<table border="1"[\s\S]*?<\/table>/)
  if (!table) return []
  const rows = []
  for (const tr of table[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<td title="([^"]*)">([\s\S]*?)<\/td>/g)]
    if (cells.length < 4) continue
    const num = (i) => Number(cells[i][2].replace(/,/g, '').trim())
    const row = { timer: decode(cells[0][1]).trim(), time: num(1), avg: num(2), count: num(3) }
    if (Number.isFinite(row.time) && Number.isFinite(row.count)) rows.push(row)
  }
  return rows
}

// Path of the template rendering a listing or product page, relative to the
// Magento root, from the TEMPLATE: segments of the profiler timers.
export function templatePath(rows, pattern) {
  for (const row of rows) {
    for (const segment of row.timer.split('->')) {
      if (!segment.startsWith('TEMPLATE:')) continue
      const path = segment.slice(9).replace(/^\/var\/www\/html\//, '')
      if (pattern.test(path)) return path
    }
  }
  return null
}
