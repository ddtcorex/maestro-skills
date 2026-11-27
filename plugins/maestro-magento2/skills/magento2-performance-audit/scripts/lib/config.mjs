import { readFileSync } from 'node:fs'

const REQUIRED = ['projectRoot', 'baseUrl', 'urlSet']

// perf-audit.config.json: written by discover, frozen for later audits.
export function loadConfig(path) {
  const config = JSON.parse(readFileSync(path, 'utf-8'))
  for (const key of REQUIRED) {
    if (config[key] === undefined) throw new Error(`perf-audit config ${path}: missing "${key}"`)
  }
  if (!Array.isArray(config.urlSet)) throw new Error(`perf-audit config ${path}: "urlSet" must be an array`)
  config.baseUrl = config.baseUrl.replace(/\/$/, '')
  config.trace ??= []
  return config
}
