// Product counts of a category page, read from Magento core toolbar markup:
// the total is the largest `toolbar-number` ("Items 1-24 of 40" prints
// three), the page size is `limitDefault` of the productListToolbarForm
// widget. A theme without that markup yields nulls, never a guess: without a
// page size the listed count stays unknown, since the total may span pages.
export function listingCounts(html) {
  const numbers = [...String(html ?? '').matchAll(/class="toolbar-number">\s*(\d+)\s*</g)].map((m) => Number(m[1]))
  const total = numbers.length ? Math.max(...numbers) : null
  const limit = String(html ?? '').match(/"productListToolbarForm"\s*:\s*\{[^}]*?"limitDefault"\s*:\s*"?(\d+)/)
  const perPage = limit ? Number(limit[1]) : null
  const listed = total === null || perPage === null ? null : Math.min(total, perPage)
  return { total, perPage, listed }
}
