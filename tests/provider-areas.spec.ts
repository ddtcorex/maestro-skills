import { describe, expect, it, vi } from 'vitest'
import { apply, type Config } from '../src/index.ts'
import { AREAS } from '../src/areas.ts'

async function listWith(config: Config) {
  let provider: { list(o: unknown): Promise<Array<{ name: string }>> } | undefined
  const warn = vi.fn()
  const ctx = {
    skills: { registerProvider: (factory: (c: unknown) => typeof provider) => { provider = factory({}); return () => {} } },
    effect: () => {},
    logger: { info: () => {}, warn },
  }
  apply(ctx as never, config)
  const names = (await provider!.list({})).map(c => c.name).sort()
  return { names, warn }
}

describe('cordis provider areas', () => {
  it('lists every skill from every area by default', async () => {
    const { names } = await listWith({})
    expect(names).toEqual(Object.values(AREAS).flat().sort())
  })

  it('areas narrows the list to the named plugins', async () => {
    const { names } = await listWith({ areas: ['maestro-php'] })
    expect(names).toEqual(['php-dev-core'])
  })

  it('an unknown area yields no candidates and one warning, never a throw', async () => {
    const { names, warn } = await listWith({ areas: ['nope'] })
    expect(names).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('nope')
  })
})
