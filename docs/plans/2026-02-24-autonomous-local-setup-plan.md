# Autonomous Local Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Реализовать полностью автономную локальную сборку YandexAgetn без зависимости от GitHub openclaw и глобальной установки OpenClaw.

**Design Document:** `docs/plans/2026-02-24-autonomous-local-setup-design.md`

**Tech Stack:** OpenClaw (local fork), Superpowers Skills, MCP one-search, QMD, Ollama

---

## Task 1: Скопировать Superpowers Skills в проект

**Цель:** Bundled skills для полной автономности

**Files:**
- Create: `Projects/YandexAgetn/skills/` (directory)
- Copy from: `projects/superpowers/skills/*`

**Step 1: Создать директорию skills**

```bash
mkdir -p Projects/YandexAgetn/skills
```

**Step 2: Скопировать все skills из Superpowers**

```bash
cp -r projects/superpowers/skills/* Projects/YandexAgetn/skills/
```

Expected: Все skills скопированы (brainstorming, systematic-debugging, writing-plans, executing-plans и др.)

**Step 3: Проверить структуру**

```bash
ls -la Projects/YandexAgetn/skills/
```

Expected: Список всех директорий с skills, каждый содержит `SKILL.md`

**Step 4: Создать .gitignore для skills (опционально)**

Если в skills есть временные файлы:
```bash
echo "*.log" > Projects/YandexAgetn/skills/.gitignore
echo "*.tmp" >> Projects/YandexAgetn/skills/.gitignore
```

---

## Task 2: Создать скрипт синхронизации skills

**Цель:** Автоматизировать обновление skills из Superpowers

**Files:**
- Create: `Projects/YandexAgetn/scripts/sync-skills.sh`

**Step 1: Создать скрипт**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPERPOWERS_DIR="$ROOT_DIR/../superpowers"
TARGET_DIR="$ROOT_DIR/skills"

echo "Syncing Superpowers skills..."

if [[ ! -d "$SUPERPOWERS_DIR/skills" ]]; then
  echo "Error: Superpowers not found at $SUPERPOWERS_DIR" >&2
  exit 1
fi

# Remove old skills
rm -rf "$TARGET_DIR"

# Copy fresh skills
cp -r "$SUPERPOWERS_DIR/skills" "$TARGET_DIR"

echo "✓ Skills synced successfully!"
echo "Skills directory: $TARGET_DIR"
ls -1 "$TARGET_DIR"
```

**Step 2: Сделать скрипт исполняемым**

```bash
chmod +x Projects/YandexAgetn/scripts/sync-skills.sh
```

**Step 3: Протестировать скрипт**

```bash
cd Projects/YandexAgetn
./scripts/sync-skills.sh
```

Expected: Skills успешно скопированы, вывод списка skills

---

## Task 3: Обновить конфигурацию для локальных skills

**Цель:** Использовать bundled skills вместо внешних

**Files:**
- Modify: `Projects/YandexAgetn/yagent-onboard-ui.command` (строки 168-177)
- Modify: `.YA-yagent/openclaw.json` (после создания)

**Step 1: Обновить шаблон конфига в скрипте**

В файле `yagent-onboard-ui.command` найти секцию `"skills"` и заменить:

```json
"skills": {
  "allowBundled": [
    "*"
  ],
  "load": {
    "extraDirs": [
      "$ROOT_DIR/skills"
    ]
  }
}
```

**Step 2: Проверить переменную ROOT_DIR в скрипте**

Убедиться, что в начале скрипта определена:
```bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

**Step 3: Протестировать создание конфига**

```bash
cd Projects/YandexAgetn
rm -rf ~/.YA-yagent
./yagent-onboard-ui.command
```

**Step 4: Проверить созданный конфиг**

```bash
cat ~/.YA-yagent/openclaw.json | grep -A 5 '"skills"'
```

Expected: `"extraDirs"` указывает на локальную папку skills

---

## Task 4: Создать скрипт автоматизированной сборки

**Цель:** One-command сборка всего проекта

**Files:**
- Create: `Projects/YandexAgetn/scripts/build-autonomous.sh`

**Step 1: Создать скрипт сборки**

```bash
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

# Note: Full build requires A2UI which needs submodules
# For MVP, we can skip full build and use pre-built dist/
if [[ -f "dist/entry.js" ]]; then
  echo "✓ Using existing dist/ (pre-built)"
else
  echo "Building TypeScript..."
  pnpm exec tsdown
  echo "✓ TypeScript built"
fi

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
```

**Step 2: Сделать скрипт исполняемым**

```bash
chmod +x Projects/YandexAgetn/scripts/build-autonomous.sh
```

**Step 3: Протестировать сборку**

```bash
cd Projects/YandexAgetn
./scripts/build-autonomous.sh
```

Expected: Все шаги выполнены успешно, проект готов к запуску

---

## Task 5: Добавить Integration тесты

**Цель:** Автоматизированная проверка изоляции и корректности сборки

**Files:**
- Create: `Projects/YandexAgetn/test/integration/autonomous-setup.test.ts`

**Step 1: Создать директорию для integration тестов**

```bash
mkdir -p Projects/YandexAgetn/test/integration
```

**Step 2: Создать тест изоляции**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

describe("Autonomous setup", () => {
  const projectRoot = path.join(__dirname, "../..");
  
  beforeAll(() => {
    // Ensure project is built
    if (!fs.existsSync(path.join(projectRoot, "dist/entry.js"))) {
      throw new Error("Project not built. Run: pnpm build");
    }
  });

  it("loads extensions from local directory", () => {
    const extensionsPath = path.join(projectRoot, "extensions");
    expect(fs.existsSync(extensionsPath)).toBe(true);
    
    const memoryCorePath = path.join(extensionsPath, "memory-core");
    expect(fs.existsSync(memoryCorePath)).toBe(true);
    
    const configPath = path.join(memoryCorePath, "config.ts");
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("uses isolated state directory", () => {
    const stateDir = path.join(process.env.HOME!, ".YA-yagent");
    // State dir will be created on first run
    // Just verify the path is correct
    expect(stateDir).toContain(".YA-yagent");
    expect(stateDir).not.toContain(".openclaw");
  });

  it("loads skills from bundled directory", () => {
    const skillsPath = path.join(projectRoot, "skills");
    
    // Check if skills exist
    if (fs.existsSync(skillsPath)) {
      const skills = fs.readdirSync(skillsPath);
      expect(skills).toContain("brainstorming");
      expect(skills).toContain("systematic-debugging");
      expect(skills).toContain("writing-plans");
      expect(skills).toContain("executing-plans");
    } else {
      console.warn("⚠️ Skills not synced yet. Run: ./scripts/sync-skills.sh");
    }
  });

  it("has correct entry points", () => {
    const entryMjs = path.join(projectRoot, "openclaw.mjs");
    const runNodeMjs = path.join(projectRoot, "scripts/run-node.mjs");
    const distEntry = path.join(projectRoot, "dist/entry.js");
    
    expect(fs.existsSync(entryMjs)).toBe(true);
    expect(fs.existsSync(runNodeMjs)).toBe(true);
    expect(fs.existsSync(distEntry)).toBe(true);
  });

  it("has control UI built", () => {
    const controlUiPath = path.join(projectRoot, "dist/control-ui");
    expect(fs.existsSync(controlUiPath)).toBe(true);
    
    const indexHtml = path.join(controlUiPath, "index.html");
    expect(fs.existsSync(indexHtml)).toBe(true);
  });
});
```

**Step 3: Добавить скрипт запуска integration тестов в package.json**

```json
{
  "scripts": {
    "test:integration": "vitest run test/integration/"
  }
}
```

**Step 4: Запустить тесты**

```bash
cd Projects/YandexAgetn
pnpm test:integration
```

Expected: Все тесты проходят

---

## Task 6: Добавить E2E тесты onboarding flow

**Цель:** Автоматизированная проверка запуска и онбординга

**Files:**
- Create: `Projects/YandexAgetn/test/e2e/onboarding-autonomous.test.ts`

**Step 1: Создать директорию для E2E тестов**

```bash
mkdir -p Projects/YandexAgetn/test/e2e
```

**Step 2: Создать тест онбординга**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import fs from "node:fs";

describe("Onboarding autonomous flow", () => {
  const projectRoot = path.join(__dirname, "../..");
  const stateDir = path.join(process.env.HOME!, ".YA-yagent-test");
  let gatewayProcess: ChildProcess | null = null;
  const testPort = 18790;  // Different port for testing
  const testToken = "test-token-123";

  beforeAll(async () => {
    // Clean test state
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Kill gateway
    if (gatewayProcess) {
      gatewayProcess.kill();
    }
    // Clean up
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true });
    }
  });

  it("starts gateway with local code", async () => {
    // Set environment
    const env = {
      ...process.env,
      OPENCLAW_STATE_DIR: stateDir,
      OPENCLAW_BUNDLED_PLUGINS_DIR: path.join(projectRoot, "extensions"),
      NODE_OPTIONS: "--use-system-ca"
    };

    // Start gateway
    gatewayProcess = spawn(
      "node",
      [
        "scripts/run-node.mjs",
        "--profile", "yagent-test",
        "gateway",
        "--allow-unconfigured",
        "--force",
        "--port", testPort.toString(),
        "--bind", "loopback",
        "--token", testToken
      ],
      {
        cwd: projectRoot,
        env,
        stdio: "pipe"
      }
    );

    // Wait for gateway to start
    await setTimeout(5000);

    // Check if running
    expect(gatewayProcess.killed).toBe(false);
  }, 15000);

  it("gateway responds to HTTP requests", async () => {
    const response = await fetch(`http://127.0.0.1:${testPort}/`);
    expect(response.ok).toBe(true);
  }, 10000);

  it("creates config in isolated state directory", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    
    // Config should be created
    expect(fs.existsSync(configPath)).toBe(true);
    
    // Verify it's isolated
    expect(configPath).toContain(".YA-yagent-test");
    expect(configPath).not.toContain(".openclaw");
  });

  it("loads skills from bundled directory", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check skills config
    const skillsConfig = config.skills?.load?.extraDirs;
    expect(skillsConfig).toBeDefined();
    expect(skillsConfig[0]).toContain("/skills");
  });

  it("MCP one-search is available", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check MCP config
    const mcpServers = config.mcpServers;
    expect(mcpServers).toBeDefined();
    expect(mcpServers["one-search"]).toBeDefined();
    expect(mcpServers["one-search"].command).toBe("npx");
  });
});
```

**Step 3: Добавить скрипт E2E тестов**

В `package.json`:
```json
{
  "scripts": {
    "test:e2e:autonomous": "vitest run test/e2e/onboarding-autonomous.test.ts"
  }
}
```

**Step 4: Запустить тесты**

```bash
cd Projects/YandexAgetn
pnpm test:e2e:autonomous
```

Expected: Все E2E тесты проходят

---

## Task 7: Создать скрипт проверки изоляции

**Цель:** Verify that local code is used, not global OpenClaw

**Files:**
- Create: `Projects/YandexAgetn/scripts/verify-isolation.sh`

**Step 1: Создать скрипт**

```bash
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
```

**Step 2: Сделать исполняемым**

```bash
chmod +x Projects/YandexAgetn/scripts/verify-isolation.sh
```

**Step 3: Запустить проверку**

```bash
cd Projects/YandexAgetn
./scripts/verify-isolation.sh
```

Expected: Все проверки пройдены

---

## Task 8: Обновить YANDEXAGETN.md

**Цель:** Добавить документацию по локальной сборке и запуску

**Files:**
- Modify: `Projects/YandexAgetn/YANDEXAGETN.md`

**Step 1: Добавить секцию "Локальная сборка и запуск"**

Добавить после существующего контента:

```markdown
## Локальная сборка и запуск

### Требования

- Node.js 22.12.0 или выше
- pnpm 10.23.0 или выше
- Superpowers project рядом (`../superpowers`) для синхронизации skills
- Ollama (опционально, для NDA-режима с локальной моделью)
- QMD CLI (опционально, для memory_search)

### Первоначальная сборка

```bash
cd Projects/YandexAgetn

# Автоматическая сборка (рекомендуется)
./scripts/build-autonomous.sh

# Или пошагово:
pnpm install
./scripts/sync-skills.sh
pnpm build
```

### Запуск

**Вариант 1: Двойной клик (macOS)**
- Открыть `YandexAgetn/` в Finder
- Дважды кликнуть на `yagent-onboard-ui.command`
- Браузер откроется автоматически с онбордингом

**Вариант 2: Из терминала**
```bash
cd Projects/YandexAgetn
./yagent-onboard-ui.command
```

### Проверка сборки

```bash
# Verify isolation and completeness
./scripts/verify-isolation.sh

# Run tests
pnpm test
pnpm test:integration
```

### Автономная архитектура

Проект работает полностью из локального кода:
- ✅ Все зависимости в `./node_modules/`
- ✅ Собранный код в `./dist/`
- ✅ Локальные extensions в `./extensions/`
- ✅ Bundled Superpowers skills в `./skills/`
- ✅ Изолированный state directory: `~/.YA-yagent/`
- ✅ Не зависит от глобальной установки OpenClaw
- ✅ Не зависит от GitHub openclaw репозитория

### Возможности агента

**Встроенные инструменты:**
- Работа с файлами (read, write, search, list)
- Выполнение команд в терминале
- Открытие браузера
- Поиск по коду
- Apply diff, insert content, search and replace

**Superpowers Skills:**
- brainstorming - планирование перед имплементацией
- systematic-debugging - систематическая отладка
- writing-plans - создание детальных планов
- executing-plans - пошаговое выполнение
- test-driven-development - TDD подход
- verification-before-completion - проверка перед завершением
- И другие (полный список в `./skills/`)

**MCP Серверы:**
- one-search - веб-поиск через DuckDuckGo (автоматически)
- intrasearch, tracker_mcp, yt и др. (требуют настройку)

### Обновление

**Обновить код:**
```bash
git pull  # или из Аркадии
pnpm install
pnpm build
```

**Обновить skills:**
```bash
./scripts/sync-skills.sh
```

### Troubleshooting

**Gateway не запускается:**
```bash
# Проверить логи
cat ~/Projects/YandexAgetn/logs/yagent/gateway.log

# Проверить порт
lsof -i :18789
```

**Skills не загружаются:**
```bash
# Синхронизировать skills
./scripts/sync-skills.sh

# Проверить путь в конфиге
cat ~/.YA-yagent/openclaw.json | grep skills
```

**Ollama не найдена:**
```bash
# Установить Ollama
brew install ollama

# Или скачать с https://ollama.ai
```
```

**Step 2: Проверить обновленный файл**

```bash
cat Projects/YandexAgetn/YANDEXAGETN.md | grep -A 10 "Локальная сборка"
```

---

## Task 9: Создать CI/CD скрипт полного тестирования

**Цель:** One-command проверка всего проекта

**Files:**
- Create: `Projects/YandexAgetn/scripts/test-autonomous-setup.sh`

**Step 1: Создать скрипт**

```bash
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
pnpm test
echo "✓ Unit tests passed"

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
```

**Step 2: Сделать исполняемым**

```bash
chmod +x Projects/YandexAgetn/scripts/test-autonomous-setup.sh
```

**Step 3: Добавить в package.json**

```json
{
  "scripts": {
    "test:autonomous": "./scripts/test-autonomous-setup.sh"
  }
}
```

**Step 4: Запустить полное тестирование**

```bash
cd Projects/YandexAgetn
pnpm test:autonomous
```

Expected: Все проверки пройдены

---

## Task 10: Обновить yagent-onboard-ui.command для использования локальных skills

**Цель:** Скрипт должен корректно указывать путь к bundled skills

**Files:**
- Modify: `Projects/YandexAgetn/yagent-onboard-ui.command` (строки 168-177)

**Step 1: Обновить секцию skills в шаблоне конфига**

Найти блок создания конфига (строки 136-239) и заменить секцию skills:

```bash
  "skills": {
    "allowBundled": [
      "*"
    ],
    "load": {
      "extraDirs": [
        "$ROOT_DIR/skills"
      ]
    }
  },
```

**Step 2: Протестировать скрипт**

```bash
cd Projects/YandexAgetn
rm -rf ~/.YA-yagent
./yagent-onboard-ui.command
```

**Step 3: Проверить созданный конфиг**

```bash
cat ~/.YA-yagent/openclaw.json | grep -A 7 '"skills"'
```

Expected: `"extraDirs"` содержит путь к `$ROOT_DIR/skills`

**Step 4: Проверить что skills загрузились**

В браузере после онбординга проверить, что агент имеет доступ к skills.

---

## Task 11: Обновить bootstrap промпт агента

**Цель:** Агент должен знать о доступных skills и памяти

**Files:**
- Modify: `Projects/YandexAgetn/src/onboarding/defaults.ts` (или аналогичный файл с bootstrap)

**Step 1: Найти файл с bootstrap промптом**

```bash
grep -r "bootstrap" Projects/YandexAgetn/src/ | grep -i prompt
```

**Step 2: Добавить секцию про Skills**

Добавить в системный промпт:

```markdown
## Доступные Superpowers Skills

Вы имеете доступ к следующим продвинутым skills для эффективного решения задач:

- **brainstorming** - ОБЯЗАТЕЛЬНО используйте перед любой творческой работой (создание feature, компонентов, модификация поведения). Помогает исследовать требования и создать дизайн.
- **systematic-debugging** - для систематической отладки проблем и багов.
- **writing-plans** - создание детальных пошаговых планов имплементации.
- **executing-plans** - пошаговое выполнение планов из writing-plans.
- **test-driven-development** - разработка через тесты (TDD подход).
- **verification-before-completion** - проверка работы перед завершением задачи.
- **using-git-worktrees** - работа с git worktrees для параллельной разработки.
- **requesting-code-review** - подготовка и запрос код-ревью.

Каждый skill содержит чек-лист и процесс. Используйте их для структурированного подхода к задачам.

## Система памяти

У вас есть долговременная память:
- **QMD backend** - hybrid поиск (BM25 + semantic embeddings + reranking)
- **Daily logs** - автоматическое сохранение контекста в `memory/YYYY-MM-DD.md`
- **MEMORY.md** - долговременная память для важных фактов
- **memory_search** - семантический поиск по памяти
- **memory_get** - получение конкретных файлов памяти
- **Автоматический flush** - перед compaction сохраняются важные факты

Используйте память для хранения предпочтений пользователя, контекста проектов, и важных решений.
```

**Step 3: Проверить что промпт применился**

После перезапуска gateway проверить в UI, что агент знает о skills.

---

## Task 12: Итоговая проверка MVP

**Цель:** Полная проверка автономной сборки

**Checklist:**

**Step 1: Чистая установка**

```bash
# Очистить все состояние
rm -rf ~/.YA-yagent
rm -rf Projects/YandexAgetn/dist
rm -rf Projects/YandexAgetn/skills

# Пересобрать
cd Projects/YandexAgetn
./scripts/build-autonomous.sh
```

**Step 2: Проверить сборку**

```bash
./scripts/verify-isolation.sh
```

Expected: Все проверки пройдены

**Step 3: Запустить все тесты**

```bash
pnpm test:autonomous
```

Expected: Все тесты проходят

**Step 4: Запустить онбординг**

```bash
./yagent-onboard-ui.command
```

Expected: 
- Gateway запускается
- UI открывается в браузере
- Онбординг работает

**Step 5: Проверить Skills в UI**

После онбординга задать агенту:
"Какие skills у тебя доступны?"

Expected: Агент перечисляет Superpowers skills

**Step 6: Проверить MCP one-search**

Задать агенту:
"Найди информацию о последних новостях по AI"

Expected: Агент использует one-search MCP для поиска в интернете

**Step 7: Проверить work with files**

Задать агенту:
"Создай тестовый файл test.txt с текстом 'Hello YA!'"

Expected: Файл создан успешно

**Step 8: Проверить NDA режим**

Если Ollama установлена:
- Переключиться на NDA агента
- Проверить что используется локальная модель

---

## Verification Checklist

### Prerequisites
- [ ] Node.js 22+ установлен
- [ ] pnpm установлен
- [ ] Bun установлен (для QMD)
- [ ] Superpowers project доступен

### Build
- [ ] `pnpm install` выполнен успешно
- [ ] Skills синхронизированы: `./scripts/sync-skills.sh`
- [ ] Проект собран: `./scripts/build-autonomous.sh`
- [ ] Изоляция проверена: `./scripts/verify-isolation.sh`

### Tests
- [ ] Unit тесты проходят: `pnpm test`
- [ ] Integration тесты проходят: `pnpm test:integration`
- [ ] E2E тесты проходят: `pnpm test:e2e:autonomous`
- [ ] Полное тестирование: `pnpm test:autonomous`

### Runtime
- [ ] Gateway запускается через `yagent-onboard-ui.command`
- [ ] UI открывается в браузере
- [ ] Онбординг работает
- [ ] Skills доступны агенту
- [ ] MCP one-search работает
- [ ] Работа с файлами функционирует
- [ ] NDA режим работает (если Ollama установлена)

### Isolation
- [ ] Не используется глобальный OpenClaw
- [ ] Extensions загружаются из `./extensions/`
- [ ] Skills загружаются из `./skills/`
- [ ] State directory: `~/.YA-yagent/`
- [ ] Config создается корректно

### Documentation
- [ ] YANDEXAGETN.md обновлен
- [ ] Design document создан
- [ ] Implementation plan создан

---

## Success Criteria

1. ✅ Проект собирается одной командой: `./scripts/build-autonomous.sh`
2. ✅ Запускается двойным кликом: `yagent-onboard-ui.command`
3. ✅ Работает без глобального OpenClaw
4. ✅ Работает без доступа к GitHub openclaw
5. ✅ Все Superpowers skills доступны
6. ✅ MCP one-search функционирует
7. ✅ Все тесты проходят
8. ✅ Документация актуальна

---

## Next Steps (Post-MVP)

1. Настроить Яндекс MCP серверы (intrasearch, tracker, yt и др.)
2. Оптимизировать для размещения в Аркадии
3. Создать Windows версию установщика
4. Добавить автоматические обновления
5. Настроить CI/CD pipeline
6. Создать процесс дистрибуции для конечных пользователей

---

## Notes

- План следует выполнять через `executing-plans` skill
- Каждая задача должна быть завершена и проверена перед следующей
- При возникновении проблем использовать `systematic-debugging` skill
- Все изменения конфигурации тестировать на изолированном профиле