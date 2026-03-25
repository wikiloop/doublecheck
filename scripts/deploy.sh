#!/usr/bin/env bash
#
# deploy.sh — Unified deployment script for WikiLoop DoubleCheck
#
# Usage:
#   ./scripts/deploy.sh [targets...] [options]
#
# Targets (default: all):
#   vercel      Deploy web SPA + API to Vercel (doublecheck.wikiloop.org)
#   toolforge   Build & restart on Toolforge (wikiloop-doublecheck.toolforge.org)
#   extension   Build Chrome extension zip (manual CWS upload)
#   userscript  Build userscript (served from Toolforge)
#   all         All of the above
#
# Options:
#   --bump=patch|minor   Bump version before deploying (default: patch)
#   --no-bump            Skip version bump
#   --no-push            Build only, don't push/deploy
#   --dry-run            Print what would happen without doing it
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()   { echo -e "${RED}[deploy]${NC} $*" >&2; }
step()  { echo -e "\n${BOLD}==> $*${NC}"; }

# ─── Parse arguments ─────────────────────────────────────────────────────────
TARGETS=()
BUMP="minor"
DO_PUSH=true
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    vercel|toolforge|extension|userscript|all) TARGETS+=("$arg") ;;
    --bump=*)   BUMP="${arg#--bump=}" ;;
    --no-bump)  BUMP="" ;;
    --no-push)  DO_PUSH=false ;;
    --dry-run)  DRY_RUN=true; DO_PUSH=false ;;
    -h|--help)
      head -20 "$0" | tail -18
      exit 0
      ;;
    *)
      err "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# Default to all targets
if [ ${#TARGETS[@]} -eq 0 ] || [[ " ${TARGETS[*]} " == *" all "* ]]; then
  TARGETS=(vercel toolforge extension userscript)
fi

# ─── Load credentials ────────────────────────────────────────────────────────
if [ -f "$HOME/.env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.env"
fi

GIT_REMOTE_URL="https://xinbenlv:${XINBENLV_PAT_FOR_WIKILOOP:-}@github.com/wikiloop/doublecheck.git"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
GIT_HASH="$(git rev-parse --short=6 HEAD)"

# ─── Version bump ────────────────────────────────────────────────────────────
bump_version() {
  local current new
  current=$(node -p "require('./package.json').version")

  if [ -z "$BUMP" ]; then
    info "Skipping version bump (current: $current)"
    return
  fi

  # Parse semver (strip any pre-release tag — we no longer use them)
  local base
  if [[ "$current" == *-* ]]; then
    base="${current%%-*}"
  else
    base="$current"
  fi

  IFS='.' read -r major minor patch <<< "$base"

  case "$BUMP" in
    patch) new="$major.$minor.$((patch + 1))" ;;
    minor) new="$major.$((minor + 1)).0" ;;
    *)     err "Invalid bump type: $BUMP (use patch or minor)"; exit 1 ;;
  esac

  step "Bumping version: $current → $new"
  if $DRY_RUN; then
    info "[dry-run] Would update version in all packages"
    return
  fi

  # Update all package.json files
  for pkg in package.json packages/*/package.json; do
    if [ -f "$pkg" ]; then
      # Use node for reliable JSON editing
      node -e "
        const fs = require('fs');
        const p = JSON.parse(fs.readFileSync('$pkg','utf8'));
        if (p.version) { p.version = '$new'; fs.writeFileSync('$pkg', JSON.stringify(p, null, 2) + '\n'); }
      "
    fi
  done

  # Update manifest.json (Chrome extension uses X.Y.Z without prerelease)
  local manifest_ver="${major}.${minor}.$((patch + 1))"
  if [ "$BUMP" = "minor" ]; then
    manifest_ver="${major}.$((minor + 1)).0"
  fi
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('packages/extension/manifest.json','utf8'));
    m.version = '$manifest_ver';
    fs.writeFileSync('packages/extension/manifest.json', JSON.stringify(m, null, 2) + '\n');
  "

  # Update userscript header version
  sed -i '' "s|// @version.*|// @version      ${manifest_ver}|" packages/userscript/src/header.txt

  ok "Version bumped to $new (manifest: $manifest_ver)"
}

# ─── Build ────────────────────────────────────────────────────────────────────
build_all() {
  step "Building all packages"
  if $DRY_RUN; then
    info "[dry-run] Would run: pnpm run build"
    return
  fi

  # Write build-info.json with version+hash for the server health endpoint
  local ver
  ver=$(node -p "require('./package.json').version")
  echo "{\"version\":\"${ver}+${GIT_HASH}\"}" > packages/server/build-info.json

  pnpm run build
  ok "Build complete"
}

build_extension() {
  step "Building Chrome extension"
  if $DRY_RUN; then
    info "[dry-run] Would build extension and create zip"
    return
  fi

  pnpm --filter @doublecheck/extension build

  # Create zip for CWS upload
  local zip_name="doublecheck-extension-$(node -p "require('./packages/extension/package.json').version").zip"
  (cd packages/extension/dist && zip -r "$ROOT/dist/$zip_name" .)
  ok "Extension zip: dist/$zip_name"
}

# ─── Git push ─────────────────────────────────────────────────────────────────
git_push() {
  step "Pushing to GitHub ($GIT_BRANCH)"
  if $DRY_RUN; then
    info "[dry-run] Would commit version bump and push to $GIT_BRANCH"
    return
  fi

  # Stage version-bumped files
  git add -A package.json packages/*/package.json packages/extension/manifest.json packages/userscript/src/header.txt pnpm-lock.yaml 2>/dev/null || true

  if ! git diff --cached --quiet; then
    local ver
    ver=$(node -p "require('./package.json').version")
    git commit -m "chore: bump version to $ver for deployment"
  fi

  if [ -z "${XINBENLV_PAT_FOR_WIKILOOP:-}" ]; then
    err "XINBENLV_PAT_FOR_WIKILOOP not set. Cannot push."
    err "Set it in ~/.env or export it."
    return 1
  fi

  git push "$GIT_REMOTE_URL" "$GIT_BRANCH"
  GIT_HASH="$(git rev-parse --short=6 HEAD)"
  ok "Pushed $GIT_BRANCH ($GIT_HASH)"
}

# ─── Deploy: Vercel ───────────────────────────────────────────────────────────
deploy_vercel() {
  step "Deploying to Vercel (doublecheck.wikiloop.org)"
  if $DRY_RUN; then
    info "[dry-run] Would run: npx vercel deploy --prebuilt --prod"
    return
  fi

  # Generate Vercel build output from locally built dist/web
  npx vercel build --prod 2>&1 | tail -5
  npx vercel deploy --prebuilt --prod 2>&1 | tail -3
  ok "Vercel deployed"
}

# ─── Deploy: Toolforge ───────────────────────────────────────────────────────
deploy_toolforge() {
  step "Deploying to Toolforge (wikiloop-doublecheck.toolforge.org)"
  if $DRY_RUN; then
    info "[dry-run] Would trigger Toolforge build + restart"
    return
  fi

  info "Triggering build from $GIT_BRANCH..."
  ssh -o ConnectTimeout=10 xinbenlv@login.toolforge.org \
    "become wikiloop-doublecheck toolforge build start https://github.com/wikiloop/doublecheck.git --ref $GIT_BRANCH" \
    2>&1 | grep -E "^\[step-(detect|build|export)\]" | tail -5 || true

  info "Waiting for build to complete..."
  local attempts=0
  while [ $attempts -lt 30 ]; do
    local status
    status=$(ssh -o ConnectTimeout=10 xinbenlv@login.toolforge.org \
      "become wikiloop-doublecheck toolforge build list 2>&1 | head -2 | tail -1" 2>/dev/null | awk '{print $2}')
    if [ "$status" = "ok" ]; then
      ok "Build succeeded"
      break
    elif [ "$status" = "error" ]; then
      err "Build failed!"
      return 1
    fi
    sleep 5
    attempts=$((attempts + 1))
  done

  info "Restarting webservice..."
  ssh -o ConnectTimeout=10 xinbenlv@login.toolforge.org \
    "become wikiloop-doublecheck toolforge webservice restart" 2>&1

  # Wait for health check
  sleep 10
  local health
  health=$(curl -s --max-time 10 'https://wikiloop-doublecheck.toolforge.org/api/health' 2>/dev/null || echo '{}')
  if echo "$health" | grep -q '"status":"ok"'; then
    ok "Toolforge healthy: $health"
  else
    warn "Toolforge health check returned: $health"
  fi
}

# ─── Deploy: Extension ───────────────────────────────────────────────────────
deploy_extension() {
  build_extension
  step "Chrome Web Store"
  info "Extension zip ready for manual upload at:"
  info "  https://chrome.google.com/webstore/devconsole"
  info "  File: dist/doublecheck-extension-*.zip"
  warn "Automated CWS publishing not yet configured."
}

# ─── Deploy: Userscript ──────────────────────────────────────────────────────
deploy_userscript() {
  step "Userscript"
  info "Userscript is served from Toolforge at:"
  info "  https://wikiloop-doublecheck.toolforge.org/doublecheck.user.js"
  if [[ " ${TARGETS[*]} " == *" toolforge "* ]]; then
    ok "Will be updated as part of Toolforge deployment"
  else
    warn "Deploy to Toolforge to update the hosted userscript"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}WikiLoop DoubleCheck — Deploy${NC}"
  echo "  Branch:  $GIT_BRANCH"
  echo "  Commit:  $GIT_HASH"
  echo "  Targets: ${TARGETS[*]}"
  echo "  Bump:    ${BUMP:-none}"
  echo ""

  bump_version
  build_all

  if $DO_PUSH; then
    git_push
  fi

  for target in "${TARGETS[@]}"; do
    case "$target" in
      vercel)     deploy_vercel ;;
      toolforge)  deploy_toolforge ;;
      extension)  deploy_extension ;;
      userscript) deploy_userscript ;;
    esac
  done

  step "Summary"
  echo ""
  local ver
  ver=$(node -p "require('./package.json').version")
  ok "Version:    $ver ($GIT_HASH)"
  for target in "${TARGETS[@]}"; do
    case "$target" in
      vercel)     ok "  Vercel:     https://doublecheck.wikiloop.org" ;;
      toolforge)  ok "  Toolforge:  https://wikiloop-doublecheck.toolforge.org" ;;
      extension)  ok "  Extension:  dist/doublecheck-extension-*.zip (upload to CWS)" ;;
      userscript) ok "  Userscript: served from Toolforge" ;;
    esac
  done
  echo ""
}

main
