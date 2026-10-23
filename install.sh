#!/usr/bin/env bash
# maestro-skills one-line installer / updater.
#
#   curl -fsSL https://raw.githubusercontent.com/ddtcorex/maestro-skills/master/install.sh | bash
#
# NOTE: on DeepSeek Harness you do NOT need this script -- add the package as a
# plugin and it serves all skills itself and installs its agent preset:
#   dsh plugin --profile web add github:ddtcorex/maestro-skills
# This installer is for loose (non-plugin) skill files, and only on tools
# without a plugin loader (OpenCode, GitHub Copilot). Tools that already
# support plugins (Claude Code, Codex CLI, DeepSeek Harness) are
# intentionally NOT targets: a loose copy linked beside a plugin install
# shadows it with a stale cache and drifts on every release. Install the
# plugin on those tools instead (see README).
#
# Re-running this script (locally, or via the same one-liner) updates the
# cached clone and re-links everything -- that IS the update path, there is
# no separate update.sh.
#
# Each supported tool scans its own directory name for SKILL.md folders and
# none of them can be pointed at an arbitrary path, so this script places a
# real symlink (or copy, with --mode copy) per tool:
#   opencode  -> .opencode/skills        (~/.config/opencode/skills)
#   copilot   -> .github/skills          (~/.copilot/skills)
# NOTE: Claude Code, Codex CLI and DeepSeek Harness (DSH) are intentionally
# NOT targets (see above). On DSH the Cordis plugin serves the packaged
# skills itself, and a second copy linked into ~/.dsh/skills shadows the
# plugin via the preset-layer skill-filesystem provider (stale cache wins
# duplicate names outright).
set -euo pipefail

REPO_URL="https://github.com/ddtcorex/maestro-skills.git"
CACHE_DIR="${MAESTRO_SKILLS_HOME:-$HOME/.maestro-skills}"
ALL_TOOLS="opencode copilot"

scope="project"
targets="all"
skills="all"
mode="symlink"
non_interactive="no"
force="no"
do_uninstall="no"

usage() {
  cat <<'EOF'
Usage: install.sh [options]

  --scope <project|personal>  Where to link skills (default: project; prompted if interactive)
  --target <list|all>         Comma list of: opencode,copilot (default: all)
  --skills <list|all>         Comma list of skill names to install (default: all)
  --mode <symlink|copy>       How to place files in the target dirs (default: symlink)
  --force                     Overwrite existing paths not created by this installer
  --uninstall                 Remove everything this installer previously linked
  -y, --yes                   Never prompt; use defaults/flags only
  -h, --help                  Show this help

Environment variables mirror the flags: MAESTRO_SKILLS_HOME, MAESTRO_SKILLS_SCOPE,
MAESTRO_SKILLS_TARGET, MAESTRO_SKILLS_SKILLS, MAESTRO_SKILLS_MODE.
(Legacy AGENT_DEV_SKILLS_* variables are still honored when their new counterparts are unset.)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) scope="$2"; shift 2 ;;
    --target) targets="$2"; shift 2 ;;
    --skills) skills="$2"; shift 2 ;;
    --mode) mode="$2"; shift 2 ;;
    --force) force="yes"; shift ;;
    --uninstall) do_uninstall="yes"; shift ;;
    -y|--yes) non_interactive="yes"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done
scope="${MAESTRO_SKILLS_SCOPE:-${AGENT_DEV_SKILLS_SCOPE:-$scope}}"
targets="${MAESTRO_SKILLS_TARGET:-${AGENT_DEV_SKILLS_TARGET:-$targets}}"
skills="${MAESTRO_SKILLS_SKILLS:-${AGENT_DEV_SKILLS_SKILLS:-$skills}}"
mode="${MAESTRO_SKILLS_MODE:-${AGENT_DEV_SKILLS_MODE:-$mode}}"

# TTY-safe prompt: when piped via `curl | bash`, stdin is the script itself,
# not the user, so fall back to reading straight from /dev/tty (same trick
# rustup's installer uses) -- and skip prompting entirely if there's no
# terminal at all (e.g. CI).
ask() {
  __var="$1"; __question="$2"; __default="$3"; __ans=""
  if [ "$non_interactive" = "yes" ]; then
    eval "$__var=\"\$__default\""
    return
  fi
  if [ -t 0 ]; then
    printf '%s [%s]: ' "$__question" "$__default" >&2
    IFS= read -r __ans
  elif [ -t 1 ]; then
    printf '%s [%s]: ' "$__question" "$__default" >&2
    IFS= read -r __ans < /dev/tty
  fi
  eval "$__var=\"\${__ans:-\$__default}\""
}

command -v git >/dev/null 2>&1 || { echo "git is required." >&2; exit 1; }

if [ -d "$CACHE_DIR/.git" ]; then
  echo "Updating $CACHE_DIR ..." >&2
  git -C "$CACHE_DIR" pull --ff-only
else
  echo "Cloning maestro-skills into $CACHE_DIR ..." >&2
  git clone --depth 1 "$REPO_URL" "$CACHE_DIR"
fi

manifest="$CACHE_DIR/.manifest"
touch "$manifest"

if [ "$do_uninstall" = "yes" ]; then
  while IFS= read -r path; do
    [ -n "$path" ] && [ -e "$path" ] && rm -rf "$path" && echo "Removed: $path"
  done < "$manifest"
  : > "$manifest"
  echo "Uninstalled. (Cache left at $CACHE_DIR -- remove it yourself if you want that gone too.)"
  exit 0
fi

ask scope "Install scope -- 'project' (current dir) or 'personal' (all projects, ~)?" "$scope"
ask targets "Target tools -- comma list of opencode,copilot, or 'all'" "$targets"

case "$scope" in
  project|personal) ;;
  *) echo "Invalid --scope: $scope (must be 'project' or 'personal')" >&2; exit 1 ;;
esac

if [ "$targets" = "all" ]; then
  tool_list="$ALL_TOOLS"
else
  tool_list="$(echo "$targets" | tr ',' ' ')"
fi

if [ "$skills" = "all" ]; then
  skill_list=""
  for d in "$CACHE_DIR"/skills/*/; do
    name="$(basename "$d")"
    [ -f "$d/SKILL.md" ] && skill_list="$skill_list $name"
  done
else
  skill_list="$(echo "$skills" | tr ',' ' ')"
fi

target_dir_for() {
  case "$1" in
    opencode) [ "$scope" = personal ] && echo "$HOME/.config/opencode/skills" || echo "$PWD/.opencode/skills" ;;
    copilot)  [ "$scope" = personal ] && echo "$HOME/.copilot/skills"        || echo "$PWD/.github/skills" ;;
    claude) echo "Target 'claude' was removed: Claude Code supports plugins, so install the plugin instead (/plugin marketplace add ddtcorex/maestro-skills, then /plugin install maestro-skills@ddtcorex). A loose copy linked into .claude/skills shadows the plugin with a stale cache." >&2; return 1 ;;
    codex) echo "Target 'codex' was removed: Codex CLI supports plugins, so install the plugin instead (codex plugin marketplace add ddtcorex/maestro-skills, then codex plugin add maestro-skills@ddtcorex). A loose copy linked into .agents/skills shadows the plugin with a stale cache." >&2; return 1 ;;
    dsh) echo "Target 'dsh' was removed: on DeepSeek Harness install the Cordis plugin instead (dsh plugin --profile web add github:ddtcorex/maestro-skills). A copy linked into ~/.dsh/skills shadows the plugin with a stale cache." >&2; return 1 ;;
    *) echo "Unknown target: $1" >&2; return 1 ;;
  esac
}

installed=0
skipped=0
for tool in $tool_list; do
  dir="$(target_dir_for "$tool")" || continue
  mkdir -p "$dir"
  for skill in $skill_list; do
    src="$CACHE_DIR/skills/$skill"
    dest="$dir/$skill"
    if [ ! -d "$src" ]; then
      echo "Skipping unknown skill: $skill" >&2
      continue
    fi

    if [ -e "$dest" ] && ! grep -qxF "$dest" "$manifest" && [ "$force" != "yes" ]; then
      echo "Skip (exists, not managed by this installer): $dest" >&2
      skipped=$((skipped + 1))
      continue
    fi

    rm -rf "$dest"
    if [ "$mode" = "copy" ]; then
      cp -r "$src" "$dest"
    else
      ln -sfn "$src" "$dest"
    fi
    grep -qxF "$dest" "$manifest" || echo "$dest" >> "$manifest"
    installed=$((installed + 1))
  done
done

echo
echo "Done. $installed skill link(s) created/updated, $skipped skipped."
echo "Scope: $scope | Targets: $tool_list | Mode: $mode"
echo "Update anytime by re-running this script (it re-pulls $CACHE_DIR and re-links)."
echo "Uninstall with: install.sh --uninstall"
