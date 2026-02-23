#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Ensure CLI tools are visible both in current shell and launchctl-spawned shell.
# Keep current PATH first so we preserve user's active Node (e.g. nvm), then add fallbacks.
RUNTIME_PATH="${PATH:-}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH="$RUNTIME_PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node.js first." >&2
  exit 1
fi
NODE_BIN="$(command -v node)"
# Clear any inherited ANTHROPIC_API_KEY that might override config
unset ANTHROPIC_API_KEY

# Always rebuild Control UI so Telegram flow uses current frontend code.
# Set OPENCLAW_SKIP_UI_BUILD=1 only for fast local debugging.
if [[ "${OPENCLAW_SKIP_UI_BUILD:-0}" != "1" ]]; then
  echo "Building Control UI..."
  rm -rf "$ROOT_DIR/dist/control-ui"
  node scripts/ui.js build
fi


PROFILE="${OPENCLAW_PROFILE:-yagent}"
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
BIND_MODE="${OPENCLAW_GATEWAY_BIND:-loopback}"
GATEWAY_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.YA-${PROFILE}}"
GATEWAY_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$GATEWAY_STATE_DIR/openclaw.json}"
export OPENCLAW_STATE_DIR="$GATEWAY_STATE_DIR"
export OPENCLAW_CONFIG_PATH="$GATEWAY_CONFIG_PATH"

BUNDLED_PLUGINS_DIR="${OPENCLAW_BUNDLED_PLUGINS_DIR:-}"
if [[ -z "$BUNDLED_PLUGINS_DIR" ]]; then
  if [[ -f "$ROOT_DIR/extensions/telegram/package.json" ]]; then
    BUNDLED_PLUGINS_DIR="$ROOT_DIR/extensions"
  elif [[ -f "/opt/homebrew/lib/node_modules/openclaw/extensions/telegram/package.json" ]]; then
    BUNDLED_PLUGINS_DIR="/opt/homebrew/lib/node_modules/openclaw/extensions"
  elif [[ -f "/usr/local/lib/node_modules/openclaw/extensions/telegram/package.json" ]]; then
    BUNDLED_PLUGINS_DIR="/usr/local/lib/node_modules/openclaw/extensions"
  fi
fi
if [[ -n "$BUNDLED_PLUGINS_DIR" ]]; then
  export OPENCLAW_BUNDLED_PLUGINS_DIR="$BUNDLED_PLUGINS_DIR"
fi

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

STATE_DIR="$HOME/.yagent-${PROFILE}"
TOKEN_FILE="$STATE_DIR/gateway.token"
LOG_DIR="$ROOT_DIR/logs/yagent"
LOG_FILE="$LOG_DIR/gateway.log"
PID_FILE="$STATE_DIR/gateway.pid"
JOB_LABEL="openclaw.yagent.${PROFILE}.gateway"

stop_pid_if_running() {
  local pid="$1"
  if [[ -z "$pid" || ! "$pid" =~ ^[0-9]+$ ]]; then
    return
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi
  kill "$pid" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done
  kill -9 "$pid" >/dev/null 2>&1 || true
}

echo "Profile: $PROFILE"
echo "Port: $PORT ($BIND_MODE)"
echo "Token: $TOKEN"
echo "Gateway state dir: $OPENCLAW_STATE_DIR"
if [[ -n "${OPENCLAW_BUNDLED_PLUGINS_DIR:-}" ]]; then
  echo "Bundled plugins: $OPENCLAW_BUNDLED_PLUGINS_DIR"
fi

# Stop previous gateway for this profile (if known)
if command -v launchctl >/dev/null 2>&1; then
  launchctl remove "$JOB_LABEL" >/dev/null 2>&1 || true
fi

if [[ -f "$PID_FILE" ]]; then
  stop_pid_if_running "$(cat "$PID_FILE" 2>/dev/null || true)"
fi

# Ensure target port is free (handles stale gateway with old token)
if command -v lsof >/dev/null 2>&1; then
  for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u); do
    stop_pid_if_running "$pid"
  done
fi

# Hard reset: remove both state dir AND workspace dir for clean start
rm -rf "$STATE_DIR"
rm -rf "$OPENCLAW_STATE_DIR"
rm -rf "$HOME/.openclaw-${PROFILE}"
rm -rf "$HOME/.openclaw/workspace-${PROFILE}"
rm -rf "$HOME/.YA-${PROFILE}"
rm -rf "$HOME/.yagent/workspace/${PROFILE}"
mkdir -p "$STATE_DIR" "$LOG_DIR"
printf "%s\n" "$TOKEN" > "$TOKEN_FILE"

# Создать начальный openclaw.json с one-search-mcp если конфига ещё нет.
# applyDefaultMcpServers работает в памяти; для пост-проверки нужен файл.
mkdir -p "$(dirname "$OPENCLAW_CONFIG_PATH")"
WORKSPACE_BASE="$HOME/.YA-${PROFILE}/workspace"
mkdir -p "$WORKSPACE_BASE/main" "$WORKSPACE_BASE/nda"
if [[ ! -f "$OPENCLAW_CONFIG_PATH" ]]; then
  cat > "$OPENCLAW_CONFIG_PATH" << INITCFG
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/moonshotai/kimi-k2.5"
      },
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    },
    "list": [
      {
        "id": "main",
        "name": "Обычный",
        "workspace": "$WORKSPACE_BASE/main"
      },
      {
        "id": "nda",
        "name": "NDA",
        "workspace": "$WORKSPACE_BASE/nda",
        "model": {
          "primary": "nda_internal/qwen3_235b_a22b"
        }
      }
    ]
  },
  "skills": {
    "allowBundled": [
      "*"
    ],
    "load": {
      "extraDirs": [
        "/Users/fedorovstas/Projects/superpowers/skills"
      ]
    }
  },
  "mcpServers": {
    "one-search": {
      "command": "npx",
      "args": [
        "-y",
        "one-search-mcp"
      ],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo"
      }
    }
  },
  "plugins": {
    "slots": {
      "memory": "none"
    }
  }
}
INITCFG
  echo "Created initial config: $OPENCLAW_CONFIG_PATH"
  echo "Workspace: main=$WORKSPACE_BASE/main, nda=$WORKSPACE_BASE/nda"
fi

RUN_ID="$(date +%s)"
URL_UI="http://127.0.0.1:${PORT}/?product=1&onboarding=1&clearLocalStorage=1&run=${RUN_ID}#token=${TOKEN}&gatewayUrl=ws://127.0.0.1:${PORT}"

# Start the gateway in the background.
# On macOS, prefer launchctl so process survives terminal/session interruptions.
GW_PID=""
if command -v launchctl >/dev/null 2>&1; then
  launchctl submit -l "$JOB_LABEL" -o "$LOG_FILE" -e "$LOG_FILE" -- /bin/sh -lc \
    "cd \"$ROOT_DIR\" && export PATH=\"$RUNTIME_PATH\" && export NODE_OPTIONS=\"--use-system-ca \${NODE_OPTIONS:-}\" && export OPENCLAW_BUNDLED_PLUGINS_DIR=\"${OPENCLAW_BUNDLED_PLUGINS_DIR:-}\" && export OPENCLAW_STATE_DIR=\"$OPENCLAW_STATE_DIR\" && export OPENCLAW_CONFIG_PATH=\"$OPENCLAW_CONFIG_PATH\" && exec \"$NODE_BIN\" scripts/run-node.mjs --profile \"$PROFILE\" gateway --allow-unconfigured --force --port \"$PORT\" --bind \"$BIND_MODE\" --token \"$TOKEN\""
  GW_PID="$(launchctl list | awk -v label=\"$JOB_LABEL\" '$3 == label { print $1 }' | head -n1 || true)"
else
  OPENCLAW_BUNDLED_PLUGINS_DIR="${OPENCLAW_BUNDLED_PLUGINS_DIR:-}" OPENCLAW_STATE_DIR="$OPENCLAW_STATE_DIR" OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH" NODE_OPTIONS="--use-system-ca ${NODE_OPTIONS:-}" nohup "$NODE_BIN" scripts/run-node.mjs --profile "$PROFILE" gateway \
    --allow-unconfigured \
    --force \
    --port "$PORT" \
    --bind "$BIND_MODE" \
    --token "$TOKEN" \
    >"$LOG_FILE" 2>&1 &
  GW_PID=$!
fi
if [[ -n "$GW_PID" ]]; then
  echo "$GW_PID" > "$PID_FILE"
fi

# Wait until the HTTP surface responds (best-effort).
READY=0
for i in {1..150}; do
  if [[ -n "$GW_PID" ]] && ! kill -0 "$GW_PID" >/dev/null 2>&1; then
    break
  fi
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.2
done

if [[ "$READY" -ne 1 ]]; then
  echo "Gateway failed to start on port ${PORT}. Last log lines:" >&2
  tail -n 80 "$LOG_FILE" >&2 || true
  exit 1
fi

# Post-check: fresh profile must not keep a persisted Telegram bot token.
CONFIG_CANDIDATES=(
  "$OPENCLAW_CONFIG_PATH"
  "$OPENCLAW_STATE_DIR/openclaw.json"
  "$OPENCLAW_STATE_DIR/config/openclaw.json"
  "$OPENCLAW_STATE_DIR/state/openclaw.json"
  "$HOME/.openclaw-${PROFILE}/openclaw.json"
  "$HOME/.openclaw-${PROFILE}/config/openclaw.json"
  "$HOME/.openclaw-${PROFILE}/state/openclaw.json"
)
for cfg in "${CONFIG_CANDIDATES[@]}"; do
  if [[ ! -f "$cfg" ]]; then
    continue
  fi
  if command -v rg >/dev/null 2>&1; then
    if rg -q '"botToken"\s*:\s*"[^"]+"' "$cfg"; then
      echo "Fresh-reset check failed: Telegram bot token still present in $cfg" >&2
      exit 1
    fi
  elif grep -Eq '"botToken"[[:space:]]*:[[:space:]]*"[^"]+"' "$cfg"; then
    echo "Fresh-reset check failed: Telegram bot token still present in $cfg" >&2
    exit 1
  fi
done

# Post-check: one-search-mcp должен появиться автоматически через applyDefaultMcpServers.
ONE_SEARCH_FOUND=0
for cfg in "${CONFIG_CANDIDATES[@]}"; do
  if [[ ! -f "$cfg" ]]; then
    continue
  fi
  if command -v rg > /dev/null 2>&1; then
    if rg -q '"one-search"' "$cfg" 2>/dev/null; then
      ONE_SEARCH_FOUND=1
      break
    fi
  elif grep -q '"one-search"' "$cfg" 2>/dev/null; then
    ONE_SEARCH_FOUND=1
    break
  fi
done
if [[ "$ONE_SEARCH_FOUND" -eq 1 ]]; then
  echo "✓ one-search-mcp (DuckDuckGo) зарегистрирован автоматически."
else
  echo "⚠ one-search-mcp не найден в конфиге — поиск в интернете недоступен. Проверьте наличие npx в PATH."
fi


echo "Opening: $URL_UI"
if command -v open >/dev/null 2>&1; then
  open "$URL_UI" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL_UI" || true
fi

echo "\nIf the UI didn't open, paste this into your browser:\n$URL_UI"
echo "Logs: $LOG_FILE"
if command -v launchctl >/dev/null 2>&1; then
  echo "To stop: launchctl remove $JOB_LABEL"
else
  echo "To stop: kill $(cat "$PID_FILE" 2>/dev/null || echo "$GW_PID")"
fi
