#!/bin/bash
set -euo pipefail

echo "🔄 ПОЛНЫЙ RESET для E2E ONBOARDING тестирования"
echo "=================================================="

# 1. Остановить gateway
echo "1️⃣  Останавливаю gateway..."
openclaw gateway stop 2>/dev/null || true
sleep 2

# 2. Чистить состояние
echo "2️⃣  Чищу состояние..."
rm -rf ~/.openclaw/agents 2>/dev/null || true
rm -rf ~/.openclaw/subagents 2>/dev/null || true
rm -rf ~/.openclaw/sessions 2>/dev/null || true
rm -rf ~/.openclaw/logs 2>/dev/null || true
rm -rf ~/.openclaw/media 2>/dev/null || true

# 3. Сбросить конфиг до минимума
echo "3️⃣  Сбросываю конфиг..."
cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "meta": {
    "lastTouchedVersion": "2026.2.9",
    "lastTouchedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "controlUi": {
      "allowedOrigins": ["http://localhost:5173"],
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "none"
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      },
      "subagents": {
        "maxConcurrent": 8,
        "model": "antigravity/gemini-3-pro-high"
      }
    }
  },
  "models": {
    "providers": {
      "antigravity": {
        "baseUrl": "http://127.0.0.1:18045/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "gemini-3-pro-high",
            "name": "Gemini 3 Pro (High)",
            "reasoning": false,
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true
  }
}
EOF

# 4. Перезапустить gateway
echo "4️⃣  Запускаю gateway..."
openclaw gateway start
sleep 5

# 5. Открыть браузер с Product UI
echo "5️⃣  Открываю браузер..."
open "http://localhost:5173" 2>/dev/null || echo "⚠️  Браузер не открылся; откройте вручную: http://localhost:5173"

echo ""
echo "✅ RESET ЗАВЕРШЕН!"
echo "📍 Product UI: http://localhost:5173"
echo "🔌 Gateway: ws://localhost:18789"
echo ""
echo "Сценарий E2E:"
echo "1. UI загружает инициальный экран"
echo "2. Нажимаешь 'Создать проект'"
echo "3. Вводишь имя проекта"
echo "4. Нажимаешь 'Новый чат'"
echo "5. AI пишет первым через chat.greet"
echo "6. Отправляешь сообщение"
echo "7. AI отвечает"
echo ""
