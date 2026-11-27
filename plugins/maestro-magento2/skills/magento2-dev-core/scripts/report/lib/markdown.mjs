export function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function mdTable(headers, rows) {
  if (rows.length === 0) return '_No rows._'
  const head = `| ${headers.map(mdEscape).join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  return [head, sep, ...rows.map((r) => `| ${r.map(mdEscape).join(' | ')} |`)].join('\n')
}

// sections: [{title, body}] rendered in order, one "## title" each.
export function renderMarkdown(title, metaLines, sections) {
  const parts = [`# ${title}`, '', ...metaLines, '']
  for (const s of sections) parts.push(`## ${s.title}`, '', s.body || '_Skipped: no data._', '')
  return parts.join('\n')
}
