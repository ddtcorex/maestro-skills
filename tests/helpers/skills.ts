import { join } from 'node:path'
import { AREAS } from '../../src/areas.ts'

export const repoRoot = join(__dirname, '..', '..')

/** The area plugin that ships a skill; throws for a name no area lists. */
export function areaOf(skill: string): string {
  const hit = Object.entries(AREAS).find(([, skills]) => skills.includes(skill))
  if (!hit) throw new Error(`no area ships ${skill}`)
  return hit[0]
}

/** Absolute path of a skill directory, or of a file under it with `rel`. */
export function skillPath(skill: string, ...rel: string[]): string {
  return join(repoRoot, 'plugins', areaOf(skill), 'skills', skill, ...rel)
}

export const ALL_SKILLS: string[] = Object.values(AREAS).flat()
