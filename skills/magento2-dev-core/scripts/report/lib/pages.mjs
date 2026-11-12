// Reader-facing page descriptions, derived from the url set and the
// capture: a subtitle per page, the page mix of a run, the stack line.

const PRODUCT_TYPES = {
  simple: 'Simple product page',
  configurable: 'Configurable product page',
  grouped: 'Grouped product page',
  bundle: 'Bundle product page',
  virtual: 'Virtual product page',
  downloadable: 'Downloadable product page',
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// entry merges the url set entry (subtitle, type) and the measured page
// (listedCount, listingTotal); the configured subtitle always wins.
export function pageSubtitle(entry) {
  if (entry.subtitle) return entry.subtitle
  const label = entry.label ?? ''
  if (label === 'home') return 'Home page'
  if (label.startsWith('category')) {
    const { listedCount: listed, listingTotal: total } = entry
    if (typeof total !== 'number') return 'Category'
    const products = `Category · ${plural(total, 'product', 'products')}`
    return typeof listed === 'number' && listed < total ? `${products} (${listed} per page)` : products
  }
  if (label.startsWith('product')) return PRODUCT_TYPES[entry.type] ?? 'Product page'
  return ''
}

// "home page, 3 categories, 3 product pages"
export function pageMix(labels) {
  const count = (prefix) => labels.filter((l) => l.startsWith(prefix)).length
  const parts = []
  if (labels.includes('home')) parts.push('home page')
  const categories = count('category')
  if (categories) parts.push(plural(categories, 'category', 'categories'))
  const products = count('product')
  if (products) parts.push(plural(products, 'product page', 'product pages'))
  return parts.join(', ')
}

export function stackLine(data) {
  if (data.meta?.stack) return data.meta.stack
  return (data.themeChain ?? []).some((t) => t.startsWith('Hyva/')) ? 'Magento 2 · Hyvä' : 'Magento 2'
}

// The url set entry names the page and its type; the measured page adds
// the listing counts the subtitle needs.
export function pageSubtitleFor(data, label) {
  const entry = (data.urlSet ?? []).find((u) => u.label === label) ?? {}
  const page = (data.pages ?? []).find((p) => p.label === label) ?? {}
  return pageSubtitle({ ...entry, ...page, label, subtitle: entry.subtitle })
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "2026-10-28" reads "28 October 2026"; anything else stays as written.
export function longDate(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? '')
}

