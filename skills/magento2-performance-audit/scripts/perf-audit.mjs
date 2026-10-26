#!/usr/bin/env node
// Performance audit CLI. Each subcommand reads and writes one run directory
// and ends with a single JSON status line (see lib/status.mjs).
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeRun } from './analyze.mjs'
import { capture } from './capture.mjs'
import { loadConfig } from './lib/config.mjs'
import { ClosedReason, closed, done, usage } from './lib/status.mjs'

const USAGE = 'usage: perf-audit.mjs <discover|switch|capture|analyze|cwv|invalidate|render|run> [options]'

function requireRun(args, stage) {
  if (!args._[0] || !args.run) throw new ClosedReason(stage, `usage: ${stage} <config> --run <dir>`)
  return { config: loadConfig(args._[0]), runDir: args.run, scope: args.scope ?? 'deep' }
}

export const COMMANDS = {
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
    if (err instanceof ClosedReason) return closed(err.stage, err.reason)
    closed(name, err.message)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.argv.slice(2))
}
