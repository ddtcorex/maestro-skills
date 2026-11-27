import { spawn } from 'node:child_process'

function run(cmd, args, { cwd, stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(stdin ?? '')
  })
}

// Runs a shell command inside the project's php container. `govard sh -c`
// runs docker exec without -i, so stdin never reaches the container: input is
// base64-embedded in the command and piped there instead (nothing is written
// to the project).
export function govardSh(projectRoot, cmd, { stdin } = {}) {
  const full = stdin === undefined ? cmd : `printf '%s' '${Buffer.from(stdin).toString('base64')}' | base64 -d | ${cmd}`
  return run('govard', ['sh', '-c', full], { cwd: projectRoot })
}

// redis-cli through Govard; projects on Valkey answer to `govard valkey cli`.
export async function govardRedis(projectRoot, args) {
  const res = await run('govard', ['redis', 'cli', ...args], { cwd: projectRoot })
  if (res.code !== 0 && /unknown service|no such service|not (?:found|enabled)/i.test(res.stderr + res.stdout)) {
    return run('govard', ['valkey', 'cli', ...args], { cwd: projectRoot })
  }
  return res
}
