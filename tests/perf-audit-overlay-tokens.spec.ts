import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')
const theme = () => readFileSync(join(refs, 'report-theme.md'), 'utf-8')
const themeStyle = () => theme().match(/<style>[\s\S]*?<\/style>/)?.[0] ?? ''

// Header surface tokens and their DDTCoreX defaults: an overlay redefines
// these in its {{brand_colors}} block instead of overriding `.header` rules.
const headerDefaults = [
  '--header-bg:linear-gradient(135deg,#0f172a 0%,#1e40af 100%)',
  '--header-text:#ffffff',
  '--header-accent:#3b82f6',
  '--header-code-bg:rgba(255,255,255,0.14)',
]

const rule = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|[}\\n])${escaped}\\{([^}]*)\\}`))?.[1] ?? ''
}

function hasChrome(): boolean {
  try {
    execFileSync('google-chrome', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Renders html in headless Chrome and returns what the injected probe wrote
// into document.title, so assertions read computed styles, not source text.
function renderProbe(html: string, probe: string): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'perf-audit-render-'))
  try {
    const file = join(dir, 'report.html')
    writeFileSync(file, html.replace('</body>', `<script>document.title = JSON.stringify(${probe})</script></body>`))
    const dom = execFileSync(
      'google-chrome',
      ['--headless', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(dir, 'profile')}`, '--dump-dom', `file://${file}`],
      { encoding: 'utf-8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const title = dom.match(/<title>([^<]*)<\/title>/)?.[1] ?? '{}'
    return JSON.parse(title.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('perf-audit header surface tokens', () => {
  it('declares header tokens with DDTCoreX defaults', () => {
    for (const body of [template(), themeStyle()]) {
      for (const token of headerDefaults) expect(body, token).toContain(token)
    }
  })

  it('header rules read only tokens', () => {
    for (const css of [template(), themeStyle()]) {
      const header = rule(css, '.header')
      expect(header).toContain('var(--header-bg)')
      expect(header).toContain('var(--header-text)')
      expect(header).toContain('var(--header-accent)')
      expect(header).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      const metaCode = rule(css, '.header .meta code')
      expect(metaCode).toContain('var(--header-code-bg)')
      expect(metaCode).not.toContain('rgba(')
    }
  })

  it('header tokens precede the colors slot', () => {
    const html = template()
    expect(html.indexOf('--header-bg:')).toBeGreaterThan(-1)
    expect(html.indexOf('--header-bg:')).toBeLessThan(html.indexOf('{{brand_colors}}'))
  })

  it.skipIf(!hasChrome())('default render keeps the DDTCoreX header (needs headless Chrome)', () => {
    const html = template()
      .replace('{{brand_logo}}', '')
      .replace('{{brand_colors}}', '')
      .replace('{{brand_font}}', '')
    const probe = `(() => { const h = getComputedStyle(document.querySelector('.header')); return { bg: h.backgroundImage, color: h.color, border: h.borderBottomColor } })()`
    const styles = renderProbe(html, probe)
    expect(styles.bg.startsWith('linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 64, 175)')).toBe(true)
    expect(styles.color).toBe('rgb(255, 255, 255)')
    expect(styles.border).toBe('rgb(59, 130, 246)')
  }, 120_000)
})
