#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi

PROFILE="${OPENCLAW_PROFILE:-yagent-product}"
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
BIND_MODE="${OPENCLAW_GATEWAY_BIND:-loopback}"
RESET="${OPENCLAW_RESET:-1}"

# Generate a stable-ish token for this run if not provided.
if [[ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  TOKEN="$OPENCLAW_GATEWAY_TOKEN"
else
  if command -v uuidgen >/dev/null 2>&1; then
    TOKEN="yagent-$(uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]' | cut -c1-24)"
  else
    TOKEN="yagent-$(date +%s)-$$"
  fi
  export OPENCLAW_GATEWAY_TOKEN="$TOKEN"
fi

STATE_DIR="$HOME/.openclaw-${PROFILE}"
TOKEN_FILE="$STATE_DIR/gateway.token"
LOG_DIR="${TMPDIR:-/tmp}/yagent"
LOG_FILE="$LOG_DIR/gateway-${PROFILE}.log"

if [[ "$RESET" == "1" ]]; then
  rm -rf "$STATE_DIR"
fi
mkdir -p "$STATE_DIR" "$LOG_DIR"
printf "%s\n" "$TOKEN" > "$TOKEN_FILE"

if [[ ! -f "$ROOT_DIR/dist/control-ui/index.html" ]]; then
  echo "UI assets missing; building UI..."
  pnpm ui:build
fi

URL_UI="http://127.0.0.1:${PORT}/?token=${TOKEN}&gatewayUrl=ws://127.0.0.1:${PORT}"

# Start the gateway in the background.
nohup node scripts/run-node.mjs --profile "$PROFILE" gateway \
  --allow-unconfigured \
  --force \
  --port "$PORT" \
  --bind "$BIND_MODE" \
  --token "$TOKEN" \
  >"$LOG_FILE" 2>&1 &

GW_PID=$!
echo "$GW_PID" > "$STATE_DIR/gateway.pid"

# Wait until the HTTP surface responds (best-effort).
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo "Opening: $URL_UI"
if command -v open >/dev/null 2>&1; then
  open "$URL_UI" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL_UI" || true
fi

echo "\nIf the UI didn't open, paste this into your browser:\n$URL_UI"
echo "Logs: $LOG_FILE"
echo "To stop: kill $(cat "$STATE_DIR/gateway.pid" 2>/dev/null || echo "$GW_PID")"
