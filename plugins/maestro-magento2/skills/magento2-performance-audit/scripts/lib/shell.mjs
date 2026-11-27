// Single-quotes a value for `sh -c`.
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}
