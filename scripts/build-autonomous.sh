#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔨 Building autonomous YandexAgetn bundle..."
echo "================================================"

# 1. Check dependencies
echo "Step 1: Checking dependencies..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found. Install Node.js 22+ first." >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ pnpm not found. Install pnpm first." >&2
  exit 1
fi
echo "✓ Node: $(node --version)"
echo "✓ pnpm: $(pnpm --version)"

# 2. Install npm dependencies
echo ""
echo "Step 2: Installing npm dependencies..."
pnpm install
echo "✓ Dependencies installed"

# 3. Sync Superpowers skills
echo ""
echo "Step 3: Syncing Superpowers skills..."
if [[ -d "../superpowers/skills" ]]; then
  ./scripts/sync-skills.sh
  echo "✓ Skills synced"
else
  echo "⚠️ Superpowers not found at ../superpowers, skipping skills sync"
  echo "   (Skills can be synced later with ./scripts/sync-skills.sh)"
fi

# 4. Build project
echo ""
echo "Step 4: Building project..."
echo "Building TypeScript..."
rm -rf dist/entry.js
pnpm exec tsdown
echo "✓ TypeScript built"

# 5. Build Control UI
echo ""
echo "Step 5: Building Control UI..."
rm -rf dist/control-ui
node scripts/ui.js build
echo "✓ Control UI built"

# 6. Verify build
echo ""
echo "Step 6: Verifying build..."
[[ -f "dist/entry.js" ]] || { echo "❌ dist/entry.js not found"; exit 1; }
[[ -d "dist/control-ui" ]] || { echo "❌ dist/control-ui not found"; exit 1; }
[[ -d "extensions/memory-core" ]] || { echo "❌ extensions/memory-core not found"; exit 1; }
[[ -d "node_modules" ]] || { echo "❌ node_modules not found"; exit 1; }
echo "✓ Build verified"

# 7. Summary
echo ""
echo "================================================"
echo "✅ Build complete!"
echo ""
echo "Project is ready to run:"
echo "  ./yagent-onboard-ui.command"
echo ""
echo "Or from terminal:"
echo "  cd Projects/YandexAgetn && ./yagent-onboard-ui.command"