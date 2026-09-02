import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
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

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
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

export interface MaterializeOptions {
  presetId: string
  /** Directory containing the bundled preset files (e.g. .../.dsh-plugin). */
  srcDir: string
  /** Override for homedir() — tests point this at a temp dir. */
  homeDir?: string
  presetFiles: readonly string[]
  /**
   * Per-file content transforms applied before hashing and writing. A
   * transformed file's stamp hash covers the *transformed* bytes, so an
   * upgrade fires only when the transformed output changes (bundle template
   * OR transform result), not when the raw source churns.
   */
  transforms?: Record<string, (content: string) => string>
  mode: MaterializeMode
  version: string
}

export interface MaterializeResult {
  dest: string
  actions: Record<string, FileAction>
}

export async function materializePreset(opts: MaterializeOptions): Promise<MaterializeResult | undefined> {
  try {
    const home = opts.homeDir ?? homedir()
    const dest = join(home, '.dsh', '.agent-presets', opts.presetId)
    await mkdir(dest, { recursive: true })

    const stampPath = join(dest, 'preset.materialize.json')
    const stamp = await readStamp(stampPath)
    const actions: Record<string, FileAction> = {}
    const nextFiles: PresetStamp['files'] = {}

    for (const file of opts.presetFiles) {
      const srcPath = join(opts.srcDir, file)
      const dstPath = join(dest, file)
      const transform = opts.transforms?.[file]

      // Hash first: a transformed file's stamp covers the transformed bytes,
      // a plain copy covers the raw bytes. Reads stay read-only so a later
      // `skip`/`adopt` never overwrites a user-owned file.
      let srcHash: string | undefined
      let out: string | undefined
      if (transform !== undefined) {
        out = await readFile(srcPath, 'utf8').then(
          (raw) => transform(raw),
          () => undefined,
        )
        if (out === undefined) return undefined // degraded bundle source: skip whole run
        srcHash = sha256Text(out)
      } else {
        srcHash = await sha256File(srcPath).catch(() => undefined)
        if (srcHash === undefined) return undefined // degraded bundle source: skip whole run
      }

      const dstStat = await stat(dstPath).catch(() => undefined)
      const dstHash = dstStat ? await sha256File(dstPath) : undefined
      const stampHash = stamp?.files[file]?.sha256
      const action = decideFileAction({ srcHash, dstHash, stampHash, mode: opts.mode })
      actions[file] = action

      if (action === 'install' || action === 'upgrade') {
        if (out !== undefined) await writeFile(dstPath, out, 'utf8')
        else await copyFile(srcPath, dstPath)
        nextFiles[file] = { sha256: srcHash }
      } else if (action === 'adopt') {
        nextFiles[file] = { sha256: dstHash as string }
      } else {
        // no-op / skip: keep the prior stamp entry when present
        if (stampHash !== undefined) nextFiles[file] = { sha256: stampHash }
      }
    }

    const wrote = Object.values(actions).some(a => a === 'install' || a === 'upgrade' || a === 'adopt')
    if (wrote) {
      await writeStamp(stampPath, { version: opts.version, files: nextFiles })
    }
    return { dest, actions }
  } catch {
    return undefined
  }
}