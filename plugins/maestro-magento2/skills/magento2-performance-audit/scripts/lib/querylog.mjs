// Magento query log (`dev:query-log:enable`) parsing. A record starts with a
// date header line followed by `## <pid> ## <TYPE>`; only that pair splits
// records, so SQL text containing `## ` or `TIME:` stays inside its record.
// Magento writes the date line with "\r\n" (DB\Logger\File).
const HEADER = /^## \d{4}-\d\d-\d\d \d\d:\d\d:\d\d\r?\n## \d+ ## (\w+)\r?\n/gm

export function parseQueryLog(text) {
  const heads = [...text.matchAll(HEADER)]
  const records = []
  heads.forEach((head, i) => {
    if (head[1] !== 'QUERY') return
    const start = head.index + head[0].length
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length
    const record = parseRecord(text.slice(start, end))
    if (record) records.push(record)
  })
  return records
}

// Body: `SQL: ...` [`BIND: ...`] `AFF: n` `TIME: t` [`TRACE: ...`]. The
// statistics lines are located from the end, so the SQL may span lines.
function parseRecord(body) {
  const stats = [...body.matchAll(/\nAFF: \d+\nTIME: ([0-9.]+)\n?/g)].pop()
  if (!body.startsWith('SQL: ') || !stats) return null
  let sql = body.slice(5, stats.index)
  const bind = sql.lastIndexOf('\nBIND: ')
  if (bind !== -1) sql = sql.slice(0, bind)
  const rest = body.slice(stats.index + stats[0].length)
  const trace = rest.startsWith('TRACE: ') ? rest.slice(7).trim() : ''
  return { sql, time: Number(stats[1]), trace }
}

export function normalizeSql(sql) {
  return sql
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/'(?:[^'\\]|\\.|'')*'/g, '?')
    // Temporary table suffixes (tmp_select_42): `_` and digits are both word
    // characters, so the number rule below never sees them.
    .replace(/_\d+\b/g, '_N')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\(\s*\?(?:\s*,\s*\?)*\s*\)/g, '(?)')
    .replace(/IN\s*\(\?\)/g, 'IN(?)')
}
