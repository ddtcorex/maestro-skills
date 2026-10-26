#!/usr/bin/env node
// Shared report engine: renders report.md, report.html and report.body.html
// from a data file. Usage:
//   render.mjs --contract
//   render.mjs render --layout perf|findings --audience dev|client --data <file> --out <dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPORT_CONTRACT } from './lib/contract.mjs'
import { dropBrandMarkers, fillTemplate, toFragment } from './lib/html.mjs'
import { renderMarkdown } from './lib/markdown.mjs'
import { buildFindings } from './lib/findings-layout.mjs'
import { buildPerf } from './lib/perf-layout.mjs'
import { validateFindings, validatePerf } from './lib/validate.mjs'

const refs = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references')

const LAYOUTS = {
  perf: { template: 'report-perf.html.template', build: buildPerf, validate: validatePerf },
  findings: { template: 'report-findings.html.template', build: buildFindings, validate: validateFindings },
}

export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '))
    this.errors = errors
  }
}

export function loadTemplate(name) {
  const template = readFileSync(join(refs, name), 'utf-8')
  const css = readFileSync(join(refs, 'report-theme.css'), 'utf-8')
  return template.replace('{{theme_css}}', () => css.trimEnd())
}

export async function renderReport({ layout, audience = 'dev', data, outDir }) {
  const spec = LAYOUTS[layout]
  if (!spec) throw new Error(`unknown layout: ${layout}`)
  const errors = spec.validate(data)
  if (errors.length > 0) throw new ValidationError(errors)
  const built = spec.build(data, audience)
  const html = fillTemplate(dropBrandMarkers(loadTemplate(spec.template)), { ...built.slots, contract: String(REPORT_CONTRACT) })
  mkdirSync(outDir, { recursive: true })
  const files = {
    'report.md': renderMarkdown(built.title, built.metaLines, built.sections),
    'report.html': html,
    'report.body.html': toFragment(html),
  }
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content)
  return { files: Object.keys(files).map((name) => join(outDir, name)) }
}

function status(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) args[key] = true
      else args[key] = argv[++i]
    } else args._.push(argv[i])
  }
  return args
}

async function main(argv) {
  const args = parseArgs(argv)
  if (args.contract) {
    process.stdout.write(`${REPORT_CONTRACT}\n`)
    return
  }
  if (args._[0] !== 'render' || !args.layout || !args.data || !args.out) {
    status({ ok: false, stage: 'render', reason: 'usage: render --layout perf|findings --audience dev|client --data <file> --out <dir>' })
    process.exitCode = 2
    return
  }
  const data = JSON.parse(readFileSync(args.data, 'utf-8'))
  const result = await renderReport({ layout: args.layout, audience: args.audience ?? 'dev', data, outDir: args.out })
  status({ ok: true, stage: 'render', outputs: result.files })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((err) => {
    status({ ok: false, stage: 'render', reason: err.message })
    process.exitCode = 1
  })
}
