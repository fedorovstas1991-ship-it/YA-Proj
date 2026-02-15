#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export OPENCLAW_SKIP_CHANNELS=${OPENCLAW_SKIP_CHANNELS:-1}
export CLAWDBOT_SKIP_CHANNELS=${CLAWDBOT_SKIP_CHANNELS:-1}

if command -v pnpm >/dev/null 2>&1; then
  echo "-> Reset config + start gateway (pnpm)"
  pnpm gateway:dev:reset
else
  echo "-> Reset config + start gateway (node)"
  node scripts/run-node.mjs --dev gateway --reset
fi
