#!/bin/bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

pause_on_error() {
  echo
  echo "Press Enter to close..."
  read -r _
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install Node.js 22+ and run this launcher again."
  pause_on_error
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed."
  echo "Install pnpm (or enable corepack) and run this launcher again."
  pause_on_error
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first launch only)..."
  if ! pnpm install; then
    echo "Dependency install failed."
    pause_on_error
    exit 1
  fi
fi

echo "Preparing web UI..."
if ! pnpm ui:build; then
  echo "UI build failed."
  pause_on_error
  exit 1
fi

echo "Starting OpenClaw simple mode..."
if ! pnpm openclaw easy; then
  echo
  echo "OpenClaw launch failed."
  pause_on_error
  exit 1
fi
