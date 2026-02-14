#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi

CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME_PATH" ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROME_PATH"
fi

echo "Running product UI E2E (headful)..."
pnpm install
HEADFUL=1 pnpm test:product:ui:e2e
