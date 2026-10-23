import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')
const theme = () => readFileSync(join(refs, 'report-theme.md'), 'utf-8')
// Prose only: fenced code blocks carry the neutral defaults verbatim, so the
// brand-free wording rule applies to the text outside them.
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '')

describe('perf-audit brand slots', () => {
  it('implements {{brand_logo}}, {{brand_colors}}, {{brand_font}} in the HTML template', () => {
    expect(template()).toContain('{{brand_logo}}')
    expect(template()).toContain('{{brand_colors}}')
    expect(template()).toContain('{{brand_font}}')
  })

  it('documents all three slots with neutral defaults and no brand value', () => {
    expect(theme()).toContain('{{brand_logo}}')
    expect(theme()).toContain('{{brand_colors}}')
    expect(theme()).toContain('{{brand_font}}')
    expect(theme()).toMatch(/neutral defaults?/i)
    const body = prose(theme())
    expect(body).toMatch(/neutral defaults?/i)
    // Brand-free prose: no color values, font names, company names, or client
    // mentions outside code blocks.
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(body).not.toMatch(/Inter|Roboto|Helvetica|Segoe|Arial|system-ui|sans-serif/i)
    expect(body).not.toMatch(/sutunam/i)
    expect(body).not.toMatch(/client/i)
  })
})
