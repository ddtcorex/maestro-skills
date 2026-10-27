import http from 'node:http'
import { describe, expect, it } from 'vitest'
import { perfScripts } from './helpers/perf-harness'
import { join } from 'node:path'

const lib = () => import(join(perfScripts, 'lib', 'http.mjs'))

// A server that accepts the connection but never responds, simulating a hung backend.
const hangingServer = () =>
  new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = http.createServer(() => {})
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${port}/hung`, close: () => new Promise((r) => server.close(() => r())) })
    })
  })

describe('fetchPage timeout', () => {
  it('rejects naming the URL when the backend hangs past timeoutMs', async () => {
    const { fetchPage } = await lib()
    const { url, close } = await hangingServer()
    try {
      await expect(fetchPage(url, { timeoutMs: 200 })).rejects.toThrow(/timed out/)
    } finally {
      await close()
    }
  })
})
