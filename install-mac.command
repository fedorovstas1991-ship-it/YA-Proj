#!/bin/bash
set -euo pipefail

echo '🚀 YA OpenClaw One-Click Installer'

if ! command -v docker &> /dev/null; then
    echo '❌ Docker not found. Install from https://www.docker.com/products/docker-desktop'
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo '⏳ Starting Docker...'
    open -a Docker
    sleep 15
fi

echo '📦 Building Docker image...'
cd /Users/fedorovstas/.ya-app/repo
docker compose build --quiet

echo '🔧 Setting up environment...'
TOKEN=$(openssl rand -hex 32)
cat > .env << EOF
OPENCLAW_CONFIG_DIR=/Users/fedorovstas/.openclaw
OPENCLAW_WORKSPACE_DIR=/Users/fedorovstas/.openclaw/workspace
OPENCLAW_IMAGE=openclaw:local
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_TOKEN=$TOKEN
EOF

echo '🚀 Starting gateway...'
docker compose down -v 2>/dev/null || true
docker compose up -d

echo '⏳ Waiting for gateway to be ready...'
sleep 5

echo '✅ Gateway is running on http://localhost:18789'
echo '🔑 Your gateway token: '$TOKEN
echo 'Opening browser...'
sleep 1
open 'http://localhost:18789'

echo '🎉 Done!'
echo 'Paste the token above in the "Gateway token" field when prompted'
