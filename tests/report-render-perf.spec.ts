import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const renderCli = join(__dirname, '..', 'skills', 'magento2-dev-core', 'scripts', 'report', 'render.mjs')
const fixture = join(__dirname, 'fixtures', 'report', 'perf-audit-data.json')
const count = (text: string, needle: string) => text.split(needle).length - 1
const anchors = [
  '<meta name="maestro-report-contract" content="1">',
  ':root{--header-bg:',
  'code{font-family:',
  'aria-label="Maestro logo"',
  'data-report-title',
  'data-report-verdict',
]

function h2Texts(html: string): string[] {
  return [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1].replace(/<span[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim(),
  )
}

describe('report renderer, perf layout', () => {
  let out: string
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'report-perf-'))
    execFileSync('node', [renderCli, 'render', '--layout', 'perf', '--audience', 'dev', '--data', fixture, '--out', out])
  })
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('prints the contract number', () => {
    const res = spawnSync('node', [renderCli, '--contract'], { encoding: 'utf-8' })
    expect(res.stdout.trim()).toBe('1')
  })

  it('writes the markdown, full html and body fragment', () => {
    expect(readdirSync(out).sort()).toEqual(['report.body.html', 'report.html', 'report.md'])
  })

  it('carries every contract anchor exactly once in the full document', () => {
    const html = readFileSync(join(out, 'report.html'), 'utf-8')
    for (const anchor of anchors) expect(count(html, anchor), anchor).toBe(1)
    expect(html).not.toContain('{{')
  })

  it('keeps the meta and the full style block in the fragment, without document tags', () => {
    const body = readFileSync(join(out, 'report.body.html'), 'utf-8')
    for (const anchor of anchors) expect(count(body, anchor), anchor).toBe(1)
    expect(body).toMatch(/<style>[\s\S]*<\/style>/)
    expect(body).not.toMatch(/<!DOCTYPE|<html|<head|<body/i)
  })

  it('renders the same section headings in markdown and html', () => {
    const html = readFileSync(join(out, 'report.html'), 'utf-8')
    const md = readFileSync(join(out, 'report.md'), 'utf-8')
    const mdHeadings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
    expect(mdHeadings).toEqual(h2Texts(html))
  })

  it('fills the title and verdict from the data file', () => {
    const html = readFileSync(join(out, 'report.html'), 'utf-8')
    expect(html).toMatch(/<h1 data-report-title>Performance Audit - acme-shop<\/h1>/)
    expect(html).toMatch(/data-report-verdict>Uncached queries drop on every comparable page\.</)
  })
})
