#!/usr/bin/env bash
# fresh-audit.sh — always run LaunchAudit on the LATEST engine.
# The engine is updated on another machine; this pulls + reinstalls (only if the
# lockfile moved) before every run, so identified bugs resolve as fixes land.
# Usage: scripts/fresh-audit.sh --name "..." --app-url <url> [--repo <path>] [--out <dir>]
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── syncing audit engine ───────────────────────────────"
BEFORE="$(git rev-parse HEAD)"
LOCK_BEFORE="$(git hash-object package-lock.json 2>/dev/null || echo none)"
git pull --rebase --autostash
AFTER="$(git rev-parse HEAD)"
LOCK_AFTER="$(git hash-object package-lock.json 2>/dev/null || echo none)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "engine already at latest ($AFTER)"
else
  echo "engine updated: $BEFORE -> $AFTER"
  git --no-pager log --oneline "$BEFORE..$AFTER"
fi
if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ]; then
  echo "lockfile changed — npm install"; npm install
fi
echo "───────────────────────────────────────────────────────"
exec node --experimental-strip-types runner/audit.ts "$@"
