#!/bin/bash
set -euo pipefail

echo "🛑 Stopping YA..."

YA_HOME="${HOME}/.ya-app"

# Stop Docker containers
if command -v docker &> /dev/null; then
    echo "Stopping Docker containers..."
    cd "${YA_HOME}/repo" 2>/dev/null || true
    docker compose -f docker-compose.yml down 2>/dev/null || true
fi

# Stop UI process
if [ -f "$YA_HOME/ui.pid" ]; then
    UI_PID=$(cat "$YA_HOME/ui.pid")
    kill $UI_PID 2>/dev/null || true
    rm "$YA_HOME/ui.pid"
    echo "Stopped UI (PID: $UI_PID)"
fi

echo "✅ YA stopped"
