// Every subcommand ends with exactly one JSON status line on stdout:
// {"ok":boolean,"stage":string,"reason"?:string,"outputs"?:string[]}
// Exit 0 when ok, 1 on a closed reason, 2 on a usage error.
function print(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

export function done(stage, outputs = []) {
  print({ ok: true, stage, outputs })
  process.exitCode = 0
}

export function closed(stage, reason) {
  print({ ok: false, stage, reason })
  process.exitCode = 1
}

export function usage(message) {
  print({ ok: false, stage: 'usage', reason: message })
  process.exitCode = 2
}

// Thrown by a stage to stop with a closed reason the agent can act on.
export class ClosedReason extends Error {
  constructor(stage, reason) {
    super(reason)
    this.stage = stage
    this.reason = reason
  }
}
