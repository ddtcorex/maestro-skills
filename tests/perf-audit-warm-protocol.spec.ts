import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const skill = join(__dirname, '..', 'skills', 'magento2-performance-audit')
const read = (...parts: string[]) => readFileSync(join(skill, ...parts), 'utf-8')
const cwv = () => read('references', 'core-web-vitals.md')
const skillMd = () => read('SKILL.md')
const template = () => read('references', 'report-template.md')

const CWV_REASONS = [
  'Skipped: no FPC HIT',
  'Skipped: no HIT signal (production mode, built-in FPC)',
  'Skipped: page cache disabled',
  'Skipped: Lighthouse CLI not found',
  'Skipped: quick',
]

describe('warm CWV protocol', () => {
  it('scores warm pages with the Lighthouse CLI and devtools throttling', () => {
    const body = cwv()
    expect(body).toContain('--throttling-method=devtools')
    expect(body).toContain('X-Magento-Cache-Debug')
    expect(body).toMatch(/median of 3/)
    expect(body).toContain('perf-audit.mjs cwv')
  })

  it('lists every CWV closed reason', () => {
    for (const reason of CWV_REASONS) expect(cwv(), reason).toContain(reason)
  })

  it('no longer defines a cold load after cache:flush', () => {
    expect(cwv()).not.toMatch(/first load after `cache:flush`/)
    expect(cwv()).not.toMatch(/\bcold\b/i)
  })

  it('keeps the DevTools MCP trace for the LCP phase breakdown only', () => {
    expect(cwv()).toMatch(/DevTools MCP[^\n]*phase breakdown/)
    expect(cwv()).toMatch(/no performance score/)
  })
})

describe('skill workflow points at the CLI', () => {
  it('uses the run and switch subcommands as the default path', () => {
    const body = skillMd()
    for (const cmd of ['perf-audit.mjs run', 'perf-audit.mjs switch', 'perf-audit.mjs discover', 'perf-audit.mjs invalidate', 'sections.json']) expect(body, cmd).toContain(cmd)
    expect(body).not.toContain('checkout -f')
  })

  it('budgets 30 to 45 minutes for a deep audit', () => {
    expect(skillMd()).toContain('30 to 45 minutes')
  })

  it('asks the publish question in the conversation language, not a hardcoded one', () => {
    expect(skillMd()).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i)
    expect(skillMd()).toMatch(/conversation language/)
  })
})

describe('report template rules', () => {
  it('lists both non-200 closed reasons and the older-protocol reason', () => {
    for (const reason of ['Skipped: non-200 on before side', 'Skipped: non-200 on after side (regression)', 'Skipped: before side measured on an older protocol, re-measure with switch']) {
      expect(template(), reason).toContain(reason)
    }
  })

  it('drops the legacy cold-only grandfather rule', () => {
    expect(template()).not.toContain('Skipped: legacy audit, cold only')
  })

  it('defines the client audience as one page', () => {
    expect(template()).toMatch(/audience: client[^\n]*verdict, comparison matrix, top 5 recommendations, coverage note/)
  })

  it('states the evidence rule for agent sections', () => {
    expect(template()).toMatch(/sections\.json/)
    expect(template()).toMatch(/evidence/)
  })
})

describe('step references', () => {
  it('runs cache invalidation through the repository save', () => {
    const body = read('references', 'cache-invalidation-audit.md')
    expect(body).toContain('perf-audit.mjs invalidate')
    expect(body).toContain('save via product repository, adminhtml area')
    expect(body).toContain('setHasDataChanges(true)')
  })

  it('records the template path per sample', () => {
    const body = read('references', 'html-profiler-audit.md')
    expect(body).toMatch(/template path per sample/i)
    expect(body).toContain('themeOverrides')
  })
})
