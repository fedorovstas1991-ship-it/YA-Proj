#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 YA OpenClaw One-Click Installer${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo -e "${YELLOW}⏳ Starting Docker Desktop...${NC}"
    open -a Docker
    echo "Waiting for Docker to start..."
    sleep 10
    
    # Wait up to 30 seconds for Docker to be ready
    for i in {1..30}; do
        if docker ps &> /dev/null; then
            echo -e "${GREEN}✅ Docker is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Docker failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Installing Node.js via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install node@22
    export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⏳ Installing pnpm...${NC}"
    npm install -g pnpm
fi

# Setup directory
YA_HOME="${HOME}/.ya-app"
YA_REPO="${YA_HOME}/repo"

echo -e "${YELLOW}⏳ Setting up installation directory...${NC}"
mkdir -p "$YA_HOME"

# Setup environment variables for Docker
export OPENCLAW_CONFIG_DIR="${HOME}/.openclaw"
export OPENCLAW_WORKSPACE_DIR="${HOME}/.openclaw/workspace"

mkdir -p "$OPENCLAW_CONFIG_DIR"
mkdir -p "$OPENCLAW_WORKSPACE_DIR"

# Clone or update repo
if [ -d "$YA_REPO/.git" ]; then
    echo -e "${YELLOW}⏳ Updating YA repository...${NC}"
    cd "$YA_REPO"
    git pull origin main
else
    echo -e "${YELLOW}⏳ Cloning YA repository...${NC}"
    git clone https://github.com/fedorovstas1991-ship-it/YA.git "$YA_REPO"
    cd "$YA_REPO"
fi

# Install dependencies
echo -e "${YELLOW}⏳ Installing dependencies...${NC}"
pnpm install --frozen-lockfile || pnpm install

# Export required environment variables for Docker Compose
export OPENCLAW_CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-${HOME}/.openclaw}"
export OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-${HOME}/.openclaw/workspace}"
export OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
export OPENCLAW_BRIDGE_PORT="${OPENCLAW_BRIDGE_PORT:-18790}"

# Ensure config and workspace directories exist
mkdir -p "$OPENCLAW_CONFIG_DIR"
mkdir -p "$OPENCLAW_WORKSPACE_DIR"

# Generate or reuse gateway token (idempotent — same token across restarts)
ENV_FILE="$YA_REPO/.env"
if [ -f "$ENV_FILE" ] && grep -q "^OPENCLAW_GATEWAY_TOKEN=" "$ENV_FILE"; then
    # Reuse existing token
    export OPENCLAW_GATEWAY_TOKEN=$(grep "^OPENCLAW_GATEWAY_TOKEN=" "$ENV_FILE" | cut -d= -f2)
    echo -e "${GREEN}🔑 Reusing existing gateway token${NC}"
else
    export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
    echo -e "${GREEN}🔑 Generated new gateway token${NC}"
fi

# Write .env file BEFORE any docker compose calls (persists for all invocations)
cat > "$ENV_FILE" <<EOF
OPENCLAW_CONFIG_DIR=${OPENCLAW_CONFIG_DIR}
OPENCLAW_WORKSPACE_DIR=${OPENCLAW_WORKSPACE_DIR}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
OPENCLAW_BRIDGE_PORT=${OPENCLAW_BRIDGE_PORT}
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_IMAGE=openclaw:local
EOF

# Start Docker containers (docker compose auto-reads .env in current dir)
echo -e "${YELLOW}⏳ Starting gateway (Docker)...${NC}"
docker compose -f docker-compose.yml down 2>/dev/null || true
docker compose -f docker-compose.yml up -d openclaw-gateway

# Get gateway token
GATEWAY_TOKEN=$(docker compose -f docker-compose.yml exec -T openclaw-gateway node dist/index.js health --token "dummy" 2>/dev/null | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "unknown")

# Wait for gateway to be ready
echo -e "${YELLOW}⏳ Waiting for gateway to be ready...${NC}"
sleep 3

# Build and start UI in the background
echo -e "${YELLOW}⏳ Building UI...${NC}"
cd "$YA_REPO/ui"
pnpm install
pnpm build
pnpm dev &
UI_PID=$!
echo $UI_PID > "$YA_HOME/ui.pid"

# Wait for UI to start
sleep 5

# Open browser
echo -e "${GREEN}✅ Opening browser...${NC}"
open "http://localhost:5173"

echo ""
echo -e "${GREEN}🎉 YA is ready!${NC}"
echo ""
echo "Gateway Token: $GATEWAY_TOKEN"
echo "Gateway URL: ws://localhost:${OPENCLAW_GATEWAY_PORT}"
echo "UI: http://localhost:5173"
echo ""
echo "To stop: run 'stop-ya.command' or kill process $UI_PID"
echo ""

# Keep script running
wait $UI_PID
