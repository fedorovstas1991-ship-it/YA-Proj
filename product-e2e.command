#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi

echo "Running product E2E..."
pnpm install
pnpm test:product:e2e

