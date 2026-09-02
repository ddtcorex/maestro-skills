import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type MaterializeMode = 'auto' | 'keep' | 'force'
export type FileAction = 'install' | 'upgrade' | 'no-op' | 'skip' | 'adopt'

export interface PresetStamp {
  version: string
  files: Record<string, { sha256: string }>
}

export interface DecideInput {
  srcHash: string
  dstHash: string | undefined
  stampHash: string | undefined
  mode: MaterializeMode
}

export function decideFileAction(input: DecideInput): FileAction {
  const { srcHash, dstHash, stampHash, mode } = input
  if (dstHash === undefined) return 'install'
  if (mode === 'force') return 'upgrade'
  if (stampHash === undefined) return 'adopt'
  if (dstHash !== stampHash) return 'skip'
  if (mode === 'keep') return 'skip'
  if (srcHash !== stampHash) return 'upgrade'
  return 'no-op'
}

export async function sha256File(path: string): Promise<string> {
  const data = await readFile(path)
  return createHash('sha256').update(data).digest('hex')
}

export async function readStamp(path: string): Promise<PresetStamp | undefined> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { version, files } = parsed as { version?: unknown; files?: unknown }
    if (typeof version !== 'string' || typeof files !== 'object' || files === null) return undefined
    return { version, files: files as Record<string, { sha256: string }> }
  } catch {
    return undefined
  }
}

export async function writeStamp(path: string, stamp: PresetStamp): Promise<void> {
  await writeFile(path, JSON.stringify(stamp, null, 2) + '\n', 'utf8')
}

export async function readPackageVersion(hereDir: string): Promise<string> {
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const parsed: unknown = JSON.parse(await readFile(join(hereDir, rel), 'utf8'))
      if (typeof parsed === 'object' && parsed !== null) {
        const v = (parsed as { version?: unknown }).version
        if (typeof v === 'string' && v.length > 0) return v
      }
    } catch {
      // try the next candidate
    }
  }
  return 'unknown'
}