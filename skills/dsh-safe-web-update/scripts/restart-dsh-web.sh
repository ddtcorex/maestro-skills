#!/usr/bin/env bash
# Restart the DSH Web process tree only after the caller has obtained consent.
set -euo pipefail

repo="${DSH_REPO:-}"
log="${DSH_RESTART_LOG:-/tmp/dsh-web-restart.log}"
# Coordination with dsh-web-supervisor (see workspace docs/specs/
# 2026-08-28-supervisor-planned-restart-design.md): the supervisor treats a
# down poll as a crash unless this marker is fresh, so it never races this
# script's own kill -> dry-boot -> relaunch sequence with its own rollback.
marker="${DSH_SUPERVISOR_MARKER:-$HOME/.dsh/.supervisor/planned-restart}"
confirmed=false
dry_run=false
auto_mode=false

dry_boot_and_verify() {
  local dsh_repo="$1"
  local port="${2:-0}"
  local marker="${3:-}"
  local dsh_home
  dsh_home="$(mktemp -d)"
  local log_tmp
  log_tmp="$(mktemp)"
  # ephemeral boot with isolated DSH_HOME
  DSH_HOME="$dsh_home" pnpm --dir "$dsh_repo" exec dsh web --port "$port" --no-open >"$log_tmp" 2>&1 &
  local pid=$!
  local ok=false
  for _ in $(seq 1 15); do
    if curl -s "http://127.0.0.1:$port/" 2>/dev/null | grep -q "${marker:-}"; then
      ok=true
      break
    fi
    if ! kill -0 "$pid" 2>/dev/null; then break; fi
    sleep 1
  done
  kill -TERM "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -rf "$dsh_home" "$log_tmp"
  [[ "$ok" == true ]]
}

usage() {
  cat <<'EOF'
Usage: restart-dsh-web.sh --repo <deepseek-harness> [--log <path>] [--confirm|--auto] [--dry-run]

Safely hand over the DSH Web process that owns ports 3000 and 3080.

Options:
  --repo <path>  DeepSeek Harness checkout (or set DSH_REPO).
  --log <path>   Append-only launch log (or set DSH_RESTART_LOG).
  --confirm      Permit a real process handover (human-gated). Required unless --dry-run.
  --auto         Permit auto handover (supervisor, no consent prompt). Alias for --confirm with auto log prefix.
  --dry-run      Print the resolved process tree; never stop or launch anything.
  -h, --help     Show this help text.
EOF
}

fail() {
  printf '[restart] FAIL: %s\n' "$1" >&2
  exit "${2:-1}"
}

while (($#)); do
  case "$1" in
    --repo)
      (($# >= 2)) || fail '--repo requires a path' 64
      repo="$2"
      shift 2
      ;;
    --log)
      (($# >= 2)) || fail '--log requires a path' 64
      log="$2"
      shift 2
      ;;
    --confirm)
      confirmed=true
      shift
      ;;
    --auto)
      confirmed=true
      auto_mode=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1" 64
      ;;
  esac
done

[[ -n "$repo" ]] || fail 'provide --repo or DSH_REPO' 64
[[ -f "$repo/package.json" ]] || fail "repo has no package.json: $repo" 64
if [[ "$dry_run" != true && "$confirmed" != true ]]; then
  fail 'refusing live restart without --confirm' 64
fi

for command in ss ps grep sort; do
  command -v "$command" >/dev/null 2>&1 || fail "required command is unavailable: $command"
done

listener_pids="$({ ss -tlnp 2>/dev/null || true; } | grep -E ':(3000|3080)([[:space:]]|$)' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
[[ -n "$listener_pids" ]] || fail 'no listeners found on ports 3000 or 3080'

resolve_tree() {
  local current="$1"
  local parent command_line
  while [[ -n "$current" && "$current" != 1 ]]; do
    command_line="$(ps -o cmd= -p "$current" 2>/dev/null || true)"
    # Never walk into a service manager: when dsh-web runs as a systemd
    # --user unit (ExecStart=node ... directly, no intervening pnpm
    # wrapper), the parent of the listener process IS the manager itself.
    # Without this guard the loop keeps climbing (no "pnpm" match, parent
    # != 1 yet) and includes the manager's own PID in tree_pids -- SIGTERM
    # to it tears down every user unit, not just dsh-web (2026-08-28
    # incident: killed the whole systemd --user session).
    case "$command_line" in
      *systemd\ --user*) break ;;
    esac
    printf '%s\n' "$current"
    [[ "$command_line" == *pnpm* ]] && break
    parent="$(ps -o ppid= -p "$current" 2>/dev/null | tr -d '[:space:]')"
    [[ "$parent" == "$current" ]] && break
    current="$parent"
  done
}

tree_pids="$(for pid in $listener_pids; do resolve_tree "$pid"; done | sort -u)"
[[ -n "$tree_pids" ]] || fail 'could not resolve a process tree for the listeners'

# dsh-web.service has Restart=always: a raw `kill -TERM` on its MainPID looks
# like a crash to systemd, which immediately relaunches it -- racing this
# script's own relaunch for ports 3000/3080 (observed live 2026-08-28: restart
# counter climbed past 20 before either side won). When systemd owns it,
# defer the whole stop/start to systemctl instead of managing PIDs directly.
systemd_managed=false
systemctl --user is-active --quiet dsh-web.service 2>/dev/null && systemd_managed=true

printf '[restart] listener pids: %s\n' "$(tr '\n' ' ' <<<"$listener_pids")"
printf '[restart] process tree: %s\n' "$(tr '\n' ' ' <<<"$tree_pids")"
printf '[restart] managed by: %s\n' "$([[ "$systemd_managed" == true ]] && echo 'systemd (dsh-web.service)' || echo 'raw process (no systemd unit)')"

if [[ "$dry_run" == true ]]; then
  printf '[restart] dry-run: no process will be stopped or launched\n'
  exit 0
fi

# --- safe-guard: don't restart while tools are still running (torn prevention) ---
# Scan for dangling open turns (turn/start without turn/end) within last 5m.
# If found, wait up to 30s for them to finish, then require --auto to force.
check_dangling() {
  local count_dangling
  count_dangling() {
    node --input-type=module <<'NODE' 2>/dev/null || echo 0
import fs from 'node:fs'
import { execSync } from 'node:child_process'
try{
  const root = (process.env.DSH_HOME || (await import('node:os')).homedir() + '/.dsh') + '/sessions'
  let count=0
  for(const proj of fs.readdirSync(root)){
    const pp = root + '/' + proj
    try{ if(!fs.statSync(pp).isDirectory()) continue }catch{continue}
    for(const sess of fs.readdirSync(pp)){
      const p = pp + '/' + sess + '/session.jsonl.zstd'
      try{ fs.statSync(p) }catch{continue}
      try{
        const st = fs.statSync(p)
        if(Date.now() - st.mtimeMs > 5*60*1000) continue
      }catch{continue}
      try{
        const out = execSync(`zstd -d -c ${JSON.stringify(p)} 2>/dev/null | tail -n 20`, {encoding:'utf8', timeout:2000})
        const lastStart = out.lastIndexOf('"type":"turn/start"')
        if(lastStart!==-1 && !out.slice(lastStart).includes('"type":"turn/end"')) count++
      }catch{}
    }
  }
  console.log(count)
}catch{ console.log(0) }
NODE
  }
  local dangling
  dangling="$(count_dangling)"
  if [[ "$dangling" != "0" && -n "$dangling" ]]; then
    printf '[restart] WARN: %s dangling open turn(s) within 5m — tools may be running\n' "$dangling" | tee -a "$log" >&2
    if [[ "$auto_mode" != true ]]; then
      printf '[restart] waiting 30s for tools to finish (re-run with --auto to force)\n' | tee -a "$log" >&2
      for _ in $(seq 1 30); do sleep 1; done
      local dangling2
      dangling2="$(count_dangling)"
      if [[ "$dangling2" != "0" && -n "$dangling2" ]]; then
        printf '[restart] still %s dangling after wait — aborting (use --auto to force)\n' "$dangling2" | tee -a "$log" >&2
        fail "refusing restart with $dangling2 dangling turn(s) — tools still running" 64
      fi
    fi
  fi
}
check_dangling

mkdir -p "$(dirname "$log")"
printf '[restart] stopping process tree: %s\n' "$(tr '\n' ' ' <<<"$tree_pids")" >> "$log"

# Mark this as an intentional restart before the port goes down, so
# dsh-web-supervisor's health poll does not race us with its own rollback.
# Removed on every exit path (success or failure) via the trap.
mkdir -p "$(dirname "$marker")"
date -Iseconds > "$marker"
trap 'rm -f "$marker"' EXIT

if [[ "$systemd_managed" == true ]]; then
  # systemctl stop is a clean, intentional stop -- Restart=always does not
  # fire for it, unlike an out-of-band kill of the unit's MainPID.
  printf '[restart] stopping dsh-web.service via systemctl\n' >> "$log"
  systemctl --user stop dsh-web.service 2>>"$log" || fail 'systemctl --user stop dsh-web.service failed'
else
  kill -TERM $tree_pids 2>/dev/null || true

  tree_stopped=false
  for _ in $(seq 1 20); do
    alive=false
    for pid in $tree_pids; do
      if kill -0 "$pid" 2>/dev/null; then
        alive=true
        break
      fi
    done
    if [[ "$alive" == false ]]; then
      tree_stopped=true
      break
    fi
    sleep 0.5
  done

  if [[ "$tree_stopped" != true ]]; then
    printf '[restart] process tree did not stop after TERM; sending KILL\n' >> "$log"
    kill -KILL $tree_pids 2>/dev/null || true
    sleep 1
  fi
fi

for port in 3000 3080; do
  if ss -tln 2>/dev/null | grep -q ":$port "; then
    fail "port $port remains held; refusing to double-boot"
  fi
done

command -v curl >/dev/null 2>&1 || fail 'required command is unavailable: curl'

if [[ "$systemd_managed" == true ]]; then
  printf '[restart] starting dsh-web.service via systemctl\n' >> "$log"
  systemctl --user start dsh-web.service 2>>"$log" || fail 'systemctl --user start dsh-web.service failed'
else
  command -v setsid >/dev/null 2>&1 || fail 'required command is unavailable: setsid'
  command -v pnpm >/dev/null 2>&1 || fail 'required command is unavailable: pnpm'

  printf '[restart] launching DSH Web from %s\n' "$repo" >> "$log"
  (
    cd "$repo"
    setsid nohup "$(command -v pnpm)" dsh web --no-open </dev/null >> "$log" 2>&1 &
  )
fi

for _ in $(seq 1 90); do
  # 401 is healthy: dsh-web is up but requires the browser token (matches
  # dsh-web-supervisor's own health-poller convention since DSH 0.1.2).
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/ || true)"
  if [[ "$code" == 200 || "$code" == 401 ]]; then
    printf '[restart] DSH Web is serving HTTP %s on port 3080\n' "$code"
    exit 0
  fi
  sleep 1
done

fail 'DSH Web did not serve HTTP 200/401 on port 3080 before timeout'
