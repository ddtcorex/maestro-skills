import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const refs = join(__dirname, '..', 'skills', 'magento2-performance-audit', 'references')
const template = () => readFileSync(join(refs, 'report.html.template'), 'utf-8')
const theme = () => readFileSync(join(refs, 'report-theme.md'), 'utf-8')
const themeStyle = () => theme().match(/<style>[\s\S]*?<\/style>/)?.[0] ?? ''

// Header surface tokens and their Maestro defaults: an overlay redefines
// these in its {{brand_colors}} block instead of overriding `.header` rules.
const headerDefaults = [
  '--header-bg:linear-gradient(135deg,#0f172a 0%,#1e40af 100%)',
  '--header-text:#ffffff',
  '--header-accent:#0a84ff',
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
  it('declares header tokens with Maestro defaults', () => {
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

  it.skipIf(!hasChrome())('default render keeps the Maestro header (needs headless Chrome)', () => {
    const html = template()
      .replace('{{brand_logo}}', '')
      .replace('{{brand_colors}}', '')
      .replace('{{brand_font}}', '')
    const probe = `(() => { const h = getComputedStyle(document.querySelector('.header')); return { bg: h.backgroundImage, color: h.color, border: h.borderBottomColor } })()`
    const styles = renderProbe(html, probe)
    expect(styles.bg.startsWith('linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 64, 175)')).toBe(true)
    expect(styles.color).toBe('rgb(255, 255, 255)')
    expect(styles.border).toBe('rgb(10, 132, 255)')
  }, 120_000)
})

const section = (text: string, heading: string) => {
  const start = text.indexOf(heading)
  if (start < 0) return ''
  const rest = text.slice(start + heading.length)
  const next = rest.search(/\n#{2,3} /)
  return next < 0 ? rest : rest.slice(0, next)
}
const words = (text: string) => text.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length

describe('perf-audit overlay token map', () => {
  const overlayTokens = ['--bg', '--card', '--border', '--text', '--muted', '--blue', '--header-bg', '--header-text', '--header-accent', '--header-code-bg']

  it('documents the overlay token map', () => {
    const map = section(theme(), '### Overlay token map')
    expect(map.length).toBeGreaterThan(0)
    for (const token of overlayTokens) expect(map, token).toContain(`\`${token}\``)
    for (const status of ['--green', '--yellow', '--red']) expect(map, status).not.toContain(`\`${status}\``)
  })

  it('states the slot fill shapes', () => {
    const map = section(theme(), '### Overlay token map')
    expect(map).toMatch(/`\{\{brand_colors\}\}`[^\n]*`:root\{/)
    expect(map).toMatch(/`\{\{brand_font\}\}`[^\n]*`body\{font-family:/)
  })

  it('theme rule lets the header rebrand through tokens', () => {
    const body = theme()
    expect(body).not.toContain('not brand-fixed surfaces')
    const ruleLine = body.split('\n').find((l) => l.startsWith('- Theme rule:')) ?? ''
    expect(ruleLine).toContain('--header-')
    expect(ruleLine).toMatch(/light and dark/)
  })

  it('overlay token map stays within the lesson budget', () => {
    const count = words(section(theme(), '### Overlay token map'))
    expect(count).toBeGreaterThanOrEqual(170)
    expect(count).toBeLessThanOrEqual(220)
  })

  it('brand defaults stays within the lesson budget', () => {
    const count = words(section(theme(), '### Brand defaults (Maestro)'))
    expect(count).toBeGreaterThanOrEqual(170)
    expect(count).toBeLessThanOrEqual(220)
  })
})

describe('perf-audit markdown template brand pointer', () => {
  it('points overlay authors at the token map', () => {
    const md = readFileSync(join(refs, 'report-template.md'), 'utf-8')
    const line = md.split('\n').find((l) => l.includes('Brand slots (Maestro defaults')) ?? ''
    expect(line).toContain('Overlay token map')
  })
})

describe('perf-audit link decoration token', () => {
  it('declares --link-decoration with a none default and the a rule reads it', () => {
    for (const css of [template(), themeStyle()]) {
      expect(css).toContain('--link-decoration:none')
      expect(rule(css, 'a')).toContain('text-decoration:var(--link-decoration)')
    }
  })

  it('lists --link-decoration in the overlay token map and words the font shape plainly', () => {
    const map = section(theme(), '### Overlay token map')
    expect(map).toContain('`--link-decoration`')
    expect(map).not.toContain('carrying the whole stack')
    expect(map.replace(/\s+/g, ' ')).toContain('whole family stack')
  })

  it.skipIf(!hasChrome())('default render leaves links undecorated (needs headless Chrome)', () => {
    const html = template().replace('{{brand_logo}}', '').replace('{{brand_colors}}', '').replace('{{brand_font}}', '')
    const styles = renderProbe(html, `({ deco: getComputedStyle(document.querySelector('.footer a')).textDecorationLine })`)
    expect(styles.deco).toBe('none')
  }, 120_000)
})
