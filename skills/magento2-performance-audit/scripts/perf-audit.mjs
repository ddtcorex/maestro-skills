#!/usr/bin/env node
// Performance audit CLI. Each subcommand reads and writes one run directory
// and ends with a single JSON status line (see lib/status.mjs).
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeRun } from './analyze.mjs'
import { capture } from './capture.mjs'
import { cwv } from './cwv.mjs'
import { discover } from './discover.mjs'
import { invalidate } from './invalidate.mjs'
import { loadConfig } from './lib/config.mjs'
import { ClosedReason, closed, done, usage, UsageError } from './lib/status.mjs'
import { renderRun } from './render.mjs'
import { runAudit } from './run.mjs'
import { switchBranch } from './switch.mjs'

const USAGE = 'usage: perf-audit.mjs <discover|switch|capture|analyze|cwv|invalidate|render|run> [options]'

function requireRun(args, stage) {
  if (!args._[0] || !args.run) throw new UsageError(`usage: ${stage} <config> --run <dir>`)
  return { config: loadConfig(args._[0]), runDir: args.run, scope: args.scope ?? 'deep' }
}

export const COMMANDS = {
  async run(args) {
    if (!args._[0] || typeof args.out !== 'string') throw new UsageError('usage: run <config> --out <dir> [--branch <b>] [--run-name <n>] [--compare <before-run-dir>] [--scope deep|quick] [--audience dev|client]')
    const str = (v) => (typeof v === 'string' ? v : undefined)
    const result = await runAudit(loadConfig(args._[0]), { out: args.out, branch: str(args.branch), runName: str(args['run-name']), compare: str(args.compare), scope: args.scope ?? 'deep', audience: args.audience ?? 'dev' })
    done('run', [result.runDir])
  },
  async render(args) {
    const { config, runDir } = requireRun(args, 'render')
    const result = await renderRun(runDir, config, { compare: typeof args.compare === 'string' ? args.compare : undefined, audience: args.audience ?? 'dev' })
    done('render', [...result.files, join(runDir, 'findings.json')])
  },
  async discover(args) {
    if (!args.root || typeof args['base-url'] !== 'string' || typeof args.out !== 'string') throw new UsageError('usage: discover --root <project> --base-url <url> --out <perf-audit.config.json> [--refresh]')
    await discover(args.root, args['base-url'], args.out, { refresh: args.refresh === true })
    done('discover', [args.out])
  },
  async switch(args) {
    if (!args._[0] || typeof args.branch !== 'string') throw new UsageError('usage: switch <config> --branch <branch>')
    const result = await switchBranch(loadConfig(args._[0]), args.branch)
    done('switch', result.steps)
  },
  async invalidate(args) {
    const { config, runDir } = requireRun(args, 'invalidate')
    await invalidate(config, runDir)
    done('invalidate', [join(runDir, 'invalidation.json')])
  },
  async cwv(args) {
    const { config, runDir, scope } = requireRun(args, 'cwv')
    await cwv(config, runDir, { scope })
    done('cwv', [join(runDir, 'cwv', 'cwv.json')])
  },
  async capture(args) {
    const { config, runDir, scope } = requireRun(args, 'capture')
    await capture(config, runDir, { scope })
    done('capture', [join(runDir, 'capture', 'summary.csv')])
  },
  async analyze(args) {
    const { config, runDir, scope } = requireRun(args, 'analyze')
    analyzeRun(runDir, config, { scope })
    done('analyze', [join(runDir, 'audit-data.json')])
  },
}

export function parseArgs(argv) {
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

export async function main(argv) {
  const [name, ...rest] = argv
  const command = COMMANDS[name]
  if (!command) return usage(name ? `unknown subcommand "${name}"; ${USAGE}` : USAGE)
  try {
    await command(parseArgs(rest))
  } catch (err) {
    if (err instanceof UsageError) return usage(err.message)
    if (err instanceof ClosedReason) return closed(err.stage, err.reason)
    closed(name, err.message)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.argv.slice(2))
}
