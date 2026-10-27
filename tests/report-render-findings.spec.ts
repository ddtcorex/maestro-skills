import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error untyped ESM script
import { validateFindings } from '../skills/magento2-dev-core/scripts/report/lib/validate.mjs'
// @ts-expect-error untyped ESM script
import { findingsVerdict } from '../skills/magento2-dev-core/scripts/report/lib/findings-layout.mjs'

const renderCli = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'render.mjs')
const fixturePath = join(__dirname, 'fixtures', 'report', 'findings.json')
const fixture = () => JSON.parse(readFileSync(fixturePath, 'utf-8'))
const count = (text: string, needle: string) => text.split(needle).length - 1
const anchors = [
  '<meta name="maestro-report-contract" content="1">',
  ':root{--header-bg:',
  'code{font-family:',
  'aria-label="Maestro logo"',
  'data-report-title',
  'data-report-verdict',
]

describe('report renderer, findings layout', () => {
  let out: string
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'report-findings-'))
    execFileSync('node', [renderCli, 'render', '--layout', 'findings', '--audience', 'dev', '--data', fixturePath, '--out', join(out, 'ok')])
  })
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('writes the three files with every contract anchor once', () => {
    const dir = join(out, 'ok')
    expect(readdirSync(dir).sort()).toEqual(['report.body.html', 'report.html', 'report.md'])
    for (const file of ['report.html', 'report.body.html']) {
      const html = readFileSync(join(dir, file), 'utf-8')
      for (const anchor of anchors) expect(count(html, anchor), `${file} ${anchor}`).toBe(1)
      expect(html).not.toContain('{{')
    }
  })

  it('renders the verdict from the sentence template over the counts', () => {
    const html = readFileSync(join(out, 'ok', 'report.html'), 'utf-8')
    const verdict = findingsVerdict(fixture().summary)
    expect(verdict).toBe('2 high, 1 medium findings; no critical')
    expect(html).toContain(`data-report-verdict>${verdict}<`)
  })

  it('accepts the valid fixture', () => {
    expect(validateFindings(fixture())).toEqual([])
  })

  it('rejects a summary that does not match the findings', () => {
    const data = fixture()
    data.summary.high = 3
    expect(validateFindings(data).join('\n')).toMatch(/summary\.high/)
  })

  it('rejects a severity outside the four levels', () => {
    const data = fixture()
    data.findings[0].severity = 'info'
    expect(validateFindings(data).join('\n')).toMatch(/severity/)
  })

  it('rejects a code that is neither an M2 code nor null with a rule', () => {
    const data = fixture()
    data.findings[2].code = 'PHPCS-1'
    const other = fixture()
    other.findings[2].rule = null
    expect(validateFindings(data).join('\n')).toMatch(/code/)
    expect(validateFindings(other).join('\n')).toMatch(/rule/)
  })

  it('rejects an M2 code that severity-and-codes.md does not define', () => {
    const data = fixture()
    data.findings[0].code = 'M2-ARCH-999'
    expect(validateFindings(data).join('\n')).toMatch(/M2-ARCH-999/)
  })

  it('exits 1 with a render status listing the errors for invalid data', () => {
    const data = fixture()
    data.summary.high = 3
    const bad = join(out, 'bad.json')
    writeFileSync(bad, JSON.stringify(data))
    const res = spawnSync('node', [renderCli, 'render', '--layout', 'findings', '--data', bad, '--out', join(out, 'bad')], { encoding: 'utf-8' })
    expect(res.status).toBe(1)
    const last = JSON.parse(res.stdout.trim().split('\n').pop() as string)
    expect(last.ok).toBe(false)
    expect(last.stage).toBe('render')
    expect(last.reason).toMatch(/summary\.high/)
  })
})
