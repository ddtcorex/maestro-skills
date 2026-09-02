import { readdir, readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { Context } from '@deepseek-ai/cordis'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillLookupOptions,
  SkillProviderControl,
} from '@deepseek-ai/dsh-skill'
import { parseFrontmatter } from './frontmatter.js'
import { materializePreset, readPackageVersion } from './preset-materialize.js'
import type { MaterializeMode } from './preset-materialize.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SKILLS_DIR = resolve(__dirname, '../skills')

export const name = 'maestro-skills'
export const inject = ['skills']

export interface Config {
  /** Optional custom directory path holding skills folders. Defaults to `./skills`. */
  skillsDir?: string
  /** Provider precedence rank. Default: 350. */
  rank?: number
  /**
   * Copy the bundled DSH agent preset into `<dshHome>/.agent-presets/maestro-skills/`
   * on startup so the preset appears in the Web GUI agent picker without running
   * install.sh. Installs only when missing; upgrades pristine installs; never
   * overwrites a user-modified preset. Default: true.
   */
  installPreset?: boolean
  /**
   * Overwrite policy for an already-installed preset:
   * 'auto' — upgrade when pristine (user untouched), keep when edited;
   * 'keep' — never overwrite anything once installed;
   * 'force' — copy the bundled preset over any state, including user edits.
   * Default: 'auto'.
   */
  presetUpgrade?: MaterializeMode
}

/** Preset id and destination directory name under `<dshHome>/.agent-presets/`. */
const PRESET_ID = 'maestro-skills'
/** Files copied from .dsh-plugin/ into the preset directory. */
const PRESET_FILES = ['preset.yml', 'agent.cordis.yml'] as const
/** Bundled preset source directory (same layout in lib/ and src/). */
const PRESET_SRC_DIR = resolve(__dirname, '../.dsh-plugin')

export function apply(ctx: Context, config: Config = {}) {
  const skillsDir = config.skillsDir ? resolve(config.skillsDir) : DEFAULT_SKILLS_DIR
  const rank = config.rank ?? 350

  if (config.installPreset !== false) {
    void (async () => {
      const res = await materializePreset({
        presetId: PRESET_ID,
        srcDir: PRESET_SRC_DIR,
        presetFiles: PRESET_FILES,
        mode: config.presetUpgrade ?? 'auto',
        version: await readPackageVersion(__dirname),
      })
      if (res === undefined) {
        ctx.logger.warn('maestro-skills: could not install the DSH agent preset (see .dsh-plugin/)')
        return
      }
      const skipped = Object.entries(res.actions).filter(([, a]) => a === 'skip').map(([f]) => f)
      if (skipped.length > 0) {
        ctx.logger.warn(
          'maestro-skills: preset files kept as-is (user-modified): %s (bundle .dsh-plugin left untouched)',
          skipped.join(', '),
        )
      } else {
        ctx.logger.info('maestro-skills: DSH agent preset installed at %s', res.dest)
      }
    })()
  }

  const unregister = ctx.skills.registerProvider((_control: SkillProviderControl) => {
    return {
      name: 'maestro-skills',
      async list(_options: SkillLookupOptions) {
        const candidates: SkillCandidate[] = []
        try {
          const entries = await readdir(skillsDir)
          for (const entry of entries) {
            const skillFolder = join(skillsDir, entry)
            const st = await stat(skillFolder).catch(() => null)
            if (!st || !st.isDirectory()) continue

            const skillFilePath = join(skillFolder, 'SKILL.md')
            const fileSt = await stat(skillFilePath).catch(() => null)
            if (!fileSt || !fileSt.isFile()) continue

            const rawContent = await readFile(skillFilePath, 'utf-8').catch(() => '')
            const { metadata } = parseFrontmatter(rawContent)
            const skillName = metadata.name || entry
            const description = metadata.description || `Skill for ${skillName}`

            candidates.push({
              name: skillName,
              description,
              invocation: { modelInvocable: true, userInvocable: true },
              source: 'custom',
              provider: 'maestro-skills',
              rank,
              locator: skillFilePath,
              path: skillFilePath,
              resourceBase: { kind: 'directory', path: skillFolder },
              metadata,
            })
          }
        } catch {
          // If directory reading fails, return empty candidates
        }
        return candidates
      },

      async get(candidate: SkillCandidate, _options: SkillLookupOptions) {
        const filePath = candidate.locator as string
        try {
          const rawContent = await readFile(filePath, 'utf-8')
          const { metadata, body } = parseFrontmatter(rawContent)
          return {
            name: candidate.name,
            description: candidate.description,
            invocation: candidate.invocation,
            source: candidate.source,
            provider: candidate.provider,
            resourceBase: candidate.resourceBase,
            path: filePath,
            content: body,
            metadata,
          }
        } catch {
          return undefined
        }
      },
    }
  })

  ctx.effect(() => unregister)
}
