import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')
const theme = () => readFileSync(join(refs, 'report-theme.md'), 'utf-8')
// Prose only: fenced code blocks carry the token values verbatim, so the
// allowlist wording rule applies to the text outside them.
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '')

// Token source stamp: every token copy states where it was copied from and
// when the copy was verified. Tests pin the stamp, not the values.
const stamp = 'Copied from www.ddtcorex.com/src/styles/tokens.css, verified 2026-10-23'
// DDTCoreX hex allowlist for prose: token values live in fenced code blocks,
// so any hex outside them must be a listed brand token.
const proseHexAllow = new Set(
  [
    '#3b82f6',
    '#1e40af',
    '#0f172a',
    '#64748b',
    '#ffffff',
    '#f5f5f7',
    '#e5e7eb',
    '#0b0f19',
    '#151b2b',
    '#e2e8f0',
    '#94a3b8',
    '#2a3242',
  ].map((h) => h.toLowerCase()),
)

describe('perf-audit brand slots', () => {
  it('implements {{brand_logo}}, {{brand_colors}}, {{brand_font}} in the HTML template', () => {
    expect(template()).toContain('{{brand_logo}}')
    expect(template()).toContain('{{brand_colors}}')
    expect(template()).toContain('{{brand_font}}')
  })

  it('renders the header logo as inline SVG carrying the brand wordmark', () => {
    const html = template()
    expect(html).toMatch(/<div class="header">[\s\S]*?<svg[\s\S]*?<h1>/)
    expect(html).toMatch(/<svg[\s\S]*?ddtcorex/i)
  })

  it('stamps every token copy with its source in both reference files', () => {
    expect(template()).toContain(stamp)
    expect(theme()).toContain(stamp)
  })

  it('accents the header with the DDTCoreX primary', () => {
    expect(template()).toMatch(/\.header[^{]*\{[^}]*#3b82f6/i)
  })

  it('documents all three slots with DDTCoreX defaults and allowlisted prose', () => {
    expect(theme()).toContain('{{brand_logo}}')
    expect(theme()).toContain('{{brand_colors}}')
    expect(theme()).toContain('{{brand_font}}')
    const body = prose(theme())
    expect(body).toMatch(/ddtcorex/i)
    expect(body).not.toMatch(/neutral defaults?/i)
    // Token values live in fenced code blocks: any hex in prose must be listed.
    for (const h of body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      expect(proseHexAllow.has(h.toLowerCase())).toBe(true)
    }
    // Only the allowlisted faces may be named in prose; fallback stacks stay
    // inside code blocks.
    expect(body).toMatch(/Inter/)
    expect(body).not.toMatch(
      /Roboto|Helvetica|Segoe|Arial|system-ui|sans-serif|monospace|Menlo|Consolas/i,
    )
    // Narrow brand ban: brand-claiming client language still fails, while
    // legitimate audience vocabulary (client-side, audience: client) passes.
    const brandClientBan = /client name/i
    expect(body).not.toMatch(brandClientBan)
    expect('client-side readout for audience: client').not.toMatch(brandClientBan)
    expect('never hard-code a client name in the template').toMatch(brandClientBan)
  })
})
