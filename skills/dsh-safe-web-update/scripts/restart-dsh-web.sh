#!/usr/bin/env bash
# Restart the DSH Web process tree only after the caller has obtained consent.
set -euo pipefail

repo="${DSH_REPO:-}"
log="${DSH_RESTART_LOG:-/tmp/dsh-web-restart.log}"
confirmed=false
dry_run=false

usage() {
  cat <<'EOF'
Usage: restart-dsh-web.sh --repo <deepseek-harness> [--log <path>] [--confirm] [--dry-run]

Safely hand over the DSH Web process that owns ports 3000 and 3080.

Options:
  --repo <path>  DeepSeek Harness checkout (or set DSH_REPO).
  --log <path>   Append-only launch log (or set DSH_RESTART_LOG).
  --confirm      Permit a real process handover. Required unless --dry-run.
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
    printf '%s\n' "$current"
    command_line="$(ps -o cmd= -p "$current" 2>/dev/null || true)"
    [[ "$command_line" == *pnpm* ]] && break
    parent="$(ps -o ppid= -p "$current" 2>/dev/null | tr -d '[:space:]')"
    [[ "$parent" == "$current" ]] && break
    current="$parent"
  done
}

tree_pids="$(for pid in $listener_pids; do resolve_tree "$pid"; done | sort -u)"
[[ -n "$tree_pids" ]] || fail 'could not resolve a process tree for the listeners'

printf '[restart] listener pids: %s\n' "$(tr '\n' ' ' <<<"$listener_pids")"
printf '[restart] process tree: %s\n' "$(tr '\n' ' ' <<<"$tree_pids")"

if [[ "$dry_run" == true ]]; then
  printf '[restart] dry-run: no process will be stopped or launched\n'
  exit 0
fi

mkdir -p "$(dirname "$log")"
printf '[restart] stopping process tree: %s\n' "$(tr '\n' ' ' <<<"$tree_pids")" >> "$log"
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

for port in 3000 3080; do
  if ss -tln 2>/dev/null | grep -q ":$port "; then
    fail "port $port remains held; refusing to double-boot"
  fi
done

command -v curl >/dev/null 2>&1 || fail 'required command is unavailable: curl'
command -v setsid >/dev/null 2>&1 || fail 'required command is unavailable: setsid'
command -v pnpm >/dev/null 2>&1 || fail 'required command is unavailable: pnpm'

printf '[restart] launching DSH Web from %s\n' "$repo" >> "$log"
(
  cd "$repo"
  setsid nohup "$(command -v pnpm)" dsh web --no-open </dev/null >> "$log" 2>&1 &
)

for _ in $(seq 1 90); do
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/ || true)" == 200 ]]; then
    printf '[restart] DSH Web is serving HTTP 200 on port 3080\n'
    exit 0
  fi
  sleep 1
done

fail 'DSH Web did not serve HTTP 200 on port 3080 before timeout'
