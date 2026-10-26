import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeRun } from './analyze.mjs'
import { capture } from './capture.mjs'
import { cwv } from './cwv.mjs'
import { invalidate } from './invalidate.mjs'
import { renderRun } from './render.mjs'
import { switchBranch } from './switch.mjs'

export const DEFAULT_STAGES = {
  switch: (config, ctx) => switchBranch(config, ctx.branch),
  capture: (config, ctx) => capture(config, ctx.runDir, ctx),
  analyze: (config, ctx) => analyzeRun(ctx.runDir, config, ctx),
  cwv: (config, ctx) => cwv(config, ctx.runDir, ctx),
  invalidate: (config, ctx) => invalidate(config, ctx.runDir),
  render: (config, ctx) => renderRun(ctx.runDir, config, ctx),
}

export function runDirFor(out, name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return join(out, slug || 'current')
}

function currentBranch(root) {
  const res = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf-8' })
  return res.status === 0 ? res.stdout.trim() : 'current'
}

// The default deep or quick audit: switch (only with a branch), capture,
// analyze, cwv, invalidate, render. The first closed reason stops the run;
// each stage can then be rerun alone on the same run directory.
export async function runAudit(config, { out, branch, runName, compare, scope = 'deep', audience = 'dev' }, stages = DEFAULT_STAGES) {
  const runDir = runDirFor(out, runName ?? branch ?? currentBranch(config.projectRoot))
  mkdirSync(runDir, { recursive: true })
  const ctx = { runDir, branch, compare, scope, audience }
  const order = [...(branch ? ['switch'] : []), 'capture', 'analyze', 'cwv', 'invalidate', 'render']
  const completed = []
  for (const name of order) {
    await stages[name](config, ctx)
    completed.push(name)
  }
  return { runDir, completed }
}
