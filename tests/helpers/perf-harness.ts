import { chmodSync, mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const shimBin = join(__dirname, '..', 'fixtures', 'perf', 'bin')
export const perfScripts = join(__dirname, '..', '..', 'skills', 'magento2-performance-audit', 'scripts')
export const perfCli = join(perfScripts, 'perf-audit.mjs')

export interface FakePage {
  status: number
  html?: string
  headers?: Record<string, string>
  dbLog?: string
  destroy?: boolean
  headerSeq?: Record<string, string>[]
}

export interface FakeProject {
  root: string
  configPath: string
  logPath: string
  env: NodeJS.ProcessEnv
  server: { url: string; setPage(uri: string, page: FakePage): void; requests: string[] }
  shimLog(): string[]
  close(): Promise<void>
}

// bin/magento stand-in: logs its argv and answers module:status from PERF_FAKE_MODULES.
const fakeMagento = `#!/bin/sh
echo "magento: $*" >> "$PERF_SHIM_LOG"
case "$1" in
  module:status) printf '%s\\n' $PERF_FAKE_MODULES ;;
  cache:status) printf '%s\\n' "$PERF_FAKE_CACHE_STATUS" ;;
esac
exit 0
`

export async function makeProject(config: Record<string, unknown> = {}): Promise<FakeProject> {
  const root = mkdtempSync(join(tmpdir(), 'perf-project-'))
  mkdirSync(join(root, 'bin'))
  mkdirSync(join(root, 'var', 'debug'), { recursive: true })
  writeFileSync(join(root, 'bin', 'magento'), fakeMagento)
  chmodSync(join(root, 'bin', 'magento'), 0o755)
  const logPath = join(root, '.shim.log')
  writeFileSync(logPath, '')

  const pages = new Map<string, FakePage>()
  const requests: string[] = []
  const server: Server = createServer((req, res) => {
    const uri = req.url ?? '/'
    requests.push(uri)
    const page = pages.get(uri) ?? { status: 404, html: 'not found' }
    if (page.destroy) return req.socket.destroy()
    if (page.dbLog !== undefined) writeFileSync(join(root, 'var', 'debug', 'db.log'), page.dbLog)
    const seq = page.headerSeq?.length ? page.headerSeq.shift() : undefined
    res.writeHead(page.status, { 'content-type': 'text/html', ...(page.headers ?? {}), ...(seq ?? {}) })
    res.end(page.html ?? '<html></html>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const url = `http://127.0.0.1:${port}`

  const configPath = join(root, 'perf-audit.config.json')
  writeFileSync(configPath, JSON.stringify({ projectRoot: root, baseUrl: url, urlSet: [{ label: 'home', uri: '/' }], trace: [], ...config }, null, 2))

  const env = { ...process.env, PATH: `${shimBin}:${process.env.PATH}`, PERF_SHIM_LOG: logPath, PERF_AUDIT_SETTLE_MS: '0' }
  return {
    root,
    configPath,
    logPath,
    env,
    server: { url, setPage: (uri, page) => pages.set(uri, page), requests },
    shimLog: () => (existsSync(logPath) ? readFileSync(logPath, 'utf-8').split('\n').filter(Boolean) : []),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

// Applies a project's env to this process for in-process stage calls.
export function useEnv(env: NodeJS.ProcessEnv): () => void {
  const saved = { ...process.env }
  Object.assign(process.env, env)
  return () => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
}
