#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🧪 Testing autonomous YandexAgetn setup..."
echo "================================================"

# 1. Clean environment
echo "Step 1: Cleaning test environment..."
rm -rf ~/.YA-yagent-test
echo "✓ Environment cleaned"

# 2. Verify isolation
echo ""
echo "Step 2: Verifying isolation..."
./scripts/verify-isolation.sh

# 3. Run unit tests
echo ""
echo "Step 3: Running unit tests..."
if [[ -d "test" ]] && ls test/*.test.* >/dev/null 2>&1; then
  pnpm test
  echo "✓ Unit tests passed"
else
  echo "⚠️ No unit tests found, skipping"
fi

# 4. Run integration tests
echo ""
echo "Step 4: Running integration tests..."
pnpm test:integration
echo "✓ Integration tests passed"

# 5. Run E2E tests
echo ""
echo "Step 5: Running E2E tests..."
pnpm test:e2e:autonomous
echo "✓ E2E tests passed"

# 6. Test actual startup (optional, commented by default)
# echo ""
# echo "Step 6: Testing actual startup..."
# OPENCLAW_STATE_DIR=~/.YA-yagent-test OPENCLAW_GATEWAY_PORT=18791 ./yagent-onboard-ui.command &
# STARTUP_PID=$!
# sleep 10
# curl -f http://127.0.0.1:18791/ && echo "✓ Gateway started" || echo "❌ Gateway failed"
# kill $STARTUP_PID 2>/dev/null || true

echo ""
echo "================================================"
echo "✅ All tests passed!"
echo ""
echo "Autonomous setup is working correctly."