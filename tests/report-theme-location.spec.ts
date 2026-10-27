import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPerfTemplate } from './helpers/report-template'

const skills = join(__dirname, '..', 'skills')
const devCoreRefs = join(skills, 'magento2-dev-core', 'references')
const perfRefs = join(skills, 'magento2-performance-audit', 'references')

const count = (text: string, needle: string) => text.split(needle).length - 1

describe('report theme location', () => {
  it('keeps the theme, css and perf template in magento2-dev-core', () => {
    for (const file of ['report-theme.md', 'report-theme.css', 'report-perf.html.template']) {
      expect(existsSync(join(devCoreRefs, file)), file).toBe(true)
    }
    expect(existsSync(join(devCoreRefs, 'assets', 'maestro-lockup.svg'))).toBe(true)
  })

  it('removes the old perf-audit copies', () => {
    for (const file of ['report-theme.md', 'report.html.template', 'assets']) {
      expect(existsSync(join(perfRefs, file)), file).toBe(false)
    }
  })

  it('inlines the theme css into the perf template with each brand slot once', () => {
    const html = loadPerfTemplate()
    expect(html).not.toContain('{{theme_css}}')
    for (const slot of ['{{brand_colors}}', '{{brand_font}}', '{{brand_logo}}']) {
      expect(count(html, slot), slot).toBe(1)
    }
  })
})
