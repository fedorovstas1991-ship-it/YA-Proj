#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔍 Verifying isolation from global OpenClaw..."
echo "================================================"

# 1. Check that we're not using global openclaw command
echo "1. Checking for global openclaw..."
if command -v openclaw >/dev/null 2>&1; then
  GLOBAL_OPENCLAW="$(which openclaw)"
  echo "⚠️ Global OpenClaw found: $GLOBAL_OPENCLAW"
  echo "   (This is OK, we just won't use it)"
else
  echo "✓ No global OpenClaw (perfect)"
fi

# 2. Verify local entry points exist
echo ""
echo "2. Checking local entry points..."
[[ -f "$ROOT_DIR/openclaw.mjs" ]] && echo "✓ openclaw.mjs" || { echo "❌ openclaw.mjs missing"; exit 1; }
[[ -f "$ROOT_DIR/scripts/run-node.mjs" ]] && echo "✓ scripts/run-node.mjs" || { echo "❌ run-node.mjs missing"; exit 1; }
[[ -f "$ROOT_DIR/dist/entry.js" ]] && echo "✓ dist/entry.js" || { echo "❌ dist/entry.js missing"; exit 1; }

# 3. Verify extensions
echo ""
echo "3. Checking local extensions..."
[[ -d "$ROOT_DIR/extensions/memory-core" ]] && echo "✓ extensions/memory-core" || { echo "❌ memory-core missing"; exit 1; }
[[ -f "$ROOT_DIR/extensions/memory-core/config.ts" ]] && echo "✓ memory-core/config.ts" || { echo "❌ config.ts missing"; exit 1; }

# 4. Verify skills
echo ""
echo "4. Checking bundled skills..."
if [[ -d "$ROOT_DIR/skills" ]]; then
  SKILL_COUNT=$(ls -1 "$ROOT_DIR/skills" | wc -l | tr -d ' ')
  echo "✓ Skills directory exists ($SKILL_COUNT skills)"
  
  # Check key skills
  for skill in brainstorming systematic-debugging writing-plans executing-plans; do
    if [[ -d "$ROOT_DIR/skills/$skill" ]]; then
      echo "  ✓ $skill"
    else
      echo "  ⚠️ $skill missing"
    fi
  done
else
  echo "⚠️ Skills not synced. Run: ./scripts/sync-skills.sh"
fi

# 5. Verify Control UI
echo ""
echo "5. Checking Control UI..."
[[ -d "$ROOT_DIR/dist/control-ui" ]] && echo "✓ control-ui built" || { echo "❌ control-ui missing"; exit 1; }
[[ -f "$ROOT_DIR/dist/control-ui/index.html" ]] && echo "✓ index.html" || { echo "❌ index.html missing"; exit 1; }

# 6. Check node_modules
echo ""
echo "6. Checking dependencies..."
[[ -d "$ROOT_DIR/node_modules" ]] && echo "✓ node_modules present" || { echo "❌ node_modules missing - run: pnpm install"; exit 1; }

echo ""
echo "================================================"
echo "✅ Isolation verification complete!"
echo ""
echo "Project is autonomous and ready to run."