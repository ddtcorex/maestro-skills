import { CONTRACT_META } from './contract.mjs'

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c])
}

// Fills {{key}} placeholders; unknown keys render empty so no marker survives.
export function fillTemplate(template, slots) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (slots[key] ?? ''))
}

// Default render: brand marker lines are dropped and the shipped defaults stay.
export function dropBrandMarkers(html) {
  return html.replace(/^[ \t]*\{\{brand_(?:colors|font|logo)\}\}[ \t]*\n/gm, '')
}

// Body-only form for hosts that wrap pages in their own skeleton. Contract 1:
// the contract meta, then the whole inline <style> block, then the body content.
export function toFragment(fullHtml) {
  const style = fullHtml.match(/<style>[\s\S]*?<\/style>/)
  const body = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (!style || !body) throw new Error('toFragment: document has no <style> or <body>')
  return `${CONTRACT_META}\n${style[0]}\n${body[1].trim()}\n`
}
