import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const devCoreRefs = join(__dirname, '..', '..', 'skills', 'magento2-dev-core', 'references')

export function loadThemeCss(): string {
  return readFileSync(join(devCoreRefs, 'report-theme.css'), 'utf-8')
}

export function loadPerfTemplate(): string {
  const template = readFileSync(join(devCoreRefs, 'report-perf.html.template'), 'utf-8')
  return template.replace('{{theme_css}}', () => loadThemeCss())
}

export function loadThemeDoc(): string {
  return readFileSync(join(devCoreRefs, 'report-theme.md'), 'utf-8')
}
