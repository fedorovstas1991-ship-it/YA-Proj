# Compaction + One-Search-MCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Встроить оптимальные настройки compaction и MCP-сервер поиска DuckDuckGo "из коробки" с UI-уведомлением.

**Architecture:** 
1. Изменить `applyCompactionDefaults` для merge-логики с оптимальными значениями (40000/25000/12000)
2. Создать `applyDefaultMcpServers` для автоматического добавления one-search-mcp
3. Добавить UI-уведомление при первом запуске о включённом поиске

**Tech Stack:** TypeScript, Node.js, YandexAgent config system

---

## Task 1: Обновить compaction defaults с merge-логикой

**Files:**
- Modify: `src/config/defaults.ts` (функция `applyCompactionDefaults`)
- Test: Проверить вручную через создание нового профиля

**Step 1: Найти текущую функцию applyCompactionDefaults**

```bash
grep -n "applyCompactionDefaults" src/config/defaults.ts
```

**Step 2: Заменить на merge-логику**

В `src/config/defaults.ts`, заменить функцию:

```typescript
export function applyCompactionDefaults(cfg: OpenClawConfig): OpenClawConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }
  
  const existingCompaction = defaults.compaction ?? {};
  const existingMode = existingCompaction.mode;
  
  // Применяем настройки только если не указаны пользователем
  const shouldApplyReserve = existingCompaction.reserveTokens === undefined;
  const shouldApplyKeep = existingCompaction.keepRecentTokens === undefined;
  const shouldApplyFloor = existingCompaction.reserveTokensFloor === undefined;
  const shouldApplyBootstrap = defaults.bootstrapMaxChars === undefined;
  
  if (!shouldApplyReserve && !shouldApplyKeep && !shouldApplyFloor && !shouldApplyBootstrap) {
    return cfg; // Все настройки уже есть
  }
  
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        compaction: {
          ...existingCompaction,
          mode: existingMode ?? "safeguard",
          ...(shouldApplyReserve && { reserveTokens: 40000 }),
          ...(shouldApplyKeep && { keepRecentTokens: 25000 }),
          ...(shouldApplyFloor && { reserveTokensFloor: 25000 }),
        },
        ...(shouldApplyBootstrap && { bootstrapMaxChars: 12000 }),
      },
    },
  };
}
```

**Step 3: Проверить порядок применения defaults**

Убедиться что `applyCompactionDefaults` вызывается при старте. Найти где вызывается:

```bash
grep -rn "applyCompactionDefaults" src/ --include="*.ts"
```

Если не вызывается — добавить в цепочку apply-функций (обычно в `src/config/io.ts` или `src/config/loader.ts`).

**Step 4: Проверить компиляцию**

```bash
cd ~/Projects/YandexAgetn && npm run build 2>&1 | head -50
```

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/config/defaults.ts
git commit -m "feat: apply optimal compaction defaults (40k/25k/12k) on first run"
```

---

## Task 2: Создать функцию applyDefaultMcpServers

**Files:**
- Modify: `src/config/defaults.ts` (добавить новую функцию)
- Test: `src/config/defaults.test.ts` (если есть) или ручной тест

**Step 1: Добавить функцию applyDefaultMcpServers**

В `src/config/defaults.ts`, после `applyCompactionDefaults`:

```typescript
export function applyDefaultMcpServers(cfg: OpenClawConfig): OpenClawConfig {
  // Если пользователь уже настроил MCP-серверы — не трогаем
  if (cfg.mcpServers && Object.keys(cfg.mcpServers).length > 0) {
    return cfg;
  }
  
  // Проверяем что один из search-провайдеров уже не настроен
  const hasExistingSearch = Object.entries(cfg.mcpServers ?? {}).some(
    ([name, server]) => {
      const env = (server as Record<string, unknown>)?.env as Record<string, string> | undefined;
      return env?.SEARCH_PROVIDER || name.includes("search");
    }
  );
  
  if (hasExistingSearch) {
    return cfg;
  }
  
  return {
    ...cfg,
    mcpServers: {
      "one-search": {
        command: "npx",
        args: ["-y", "one-search-mcp"],
        env: {
          SEARCH_PROVIDER: "duckduckgo",
        },
      },
    },
  };
}
```

**Step 2: Добавить в цепочку применения defaults**

Найти где вызываются apply-функции (обычно `src/config/io.ts` или подобный):

```bash
grep -rn "applyCompactionDefaults\|applyAgentDefaults\|applyAllDefaults" src/config/ --include="*.ts"
```

Добавить `applyDefaultMcpServers` в ту же цепочку вызовов.

Пример из `src/config/io.ts` (или где находится):

```typescript
// Найти функцию которая применяет все defaults
export function resolveConfigWithDefaults(raw: unknown): OpenClawConfig {
  let cfg = validateConfig(raw);
  cfg = applyMessageDefaults(cfg);
  cfg = applySessionDefaults(cfg);
  cfg = applyTalkApiKey(cfg);
  cfg = applyModelDefaults(cfg);
  cfg = applyAgentDefaults(cfg);
  cfg = applyLoggingDefaults(cfg);
  cfg = applyContextPruningDefaults(cfg);
  cfg = applyCompactionDefaults(cfg);      // <- уже есть
  cfg = applyDefaultMcpServers(cfg);       // <- добавить
  return cfg;
}
```

**Step 3: Проверить компиляцию**

```bash
cd ~/Projects/YandexAgetn && npm run build 2>&1 | head -50
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/config/defaults.ts
git commit -m "feat: auto-add one-search-mcp on first run (DuckDuckGo search)"
```

---

## Task 3: Добавить UI-уведомление о включённом поиске

**Files:**
- Modify: `ui/src/ui/app.ts` (или `ui/src/ui/controllers/onboarding.ts`)
- Modify: `ui/src/ui/types.ts` (если нужен новый тип)

**Step 1: Найти где определяется состояние онбординга**

```bash
grep -rn "simpleOnboardingDone\|onboarding" ui/src/ui/app.ts | head -20
```

**Step 2: Добавить флаг для показа уведомления**

В `ui/src/ui/app.ts`, добавить состояние:

```typescript
// Найти секцию с @state() декораторами, добавить:
@state() showSearchEnabledNotification = false;
@state() hasDismissedSearchNotification = false;
```

**Step 3: Добавить логику показа уведомления**

Найти `firstUpdated()` или `handleConnected()`:

```bash
grep -n "firstUpdated\|handleConnected\|onHello" ui/src/ui/app.ts | head -10
```

Добавить проверку MCP в `onHello` или `handleConnected`:

```typescript
// В функцию handleConnected или onHello, после установления соединения:
private checkMcpSearchStatus() {
  // Проверяем есть ли one-search в конфиге
  const hasOneSearch = this.configSnapshot?.config?.mcpServers?.["one-search"];
  const hasSeenNotification = localStorage.getItem("yagent.search.notification.seen");
  
  if (hasOneSearch && !hasSeenNotification && !this.hasDismissedSearchNotification) {
    this.showSearchEnabledNotification = true;
  }
}

// Или в render() добавить условие:
```

**Step 4: Создать компонент уведомления**

В `renderApp()` или `renderProductApp()` добавить:

```typescript
${this.showSearchEnabledNotification ? html`
  <div class="notification info" role="status">
    <span class="notification-icon">🔍</span>
    <span class="notification-text">
      Поиск DuckDuckGo включён автоматически. 
      Используйте команду /search для поиска в интернете.
    </span>
    <button 
      class="notification-close" 
      @click=${() => {
        this.showSearchEnabledNotification = false;
        this.hasDismissedSearchNotification = true;
        localStorage.setItem("yagent.search.notification.seen", "true");
      }}
      aria-label="Закрыть уведомление"
    >
      ×
    </button>
  </div>
` : nothing}
```

**Step 5: Добавить стили**

В `ui/src/styles/components.css` или `ui/src/styles/product.css`:

```css
.notification {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  margin: 12px 0;
}

.notification.info {
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  color: #0369a1;
}

.notification-icon {
  font-size: 20px;
}

.notification-text {
  flex: 1;
}

.notification-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  color: inherit;
  opacity: 0.6;
}

.notification-close:hover {
  opacity: 1;
}
```

**Step 6: Проверить компиляцию UI**

```bash
cd ~/Projects/YandexAgetn/ui && npm run build 2>&1 | tail -20
```

Expected: build successful

**Step 7: Commit**

```bash
git add ui/src/ui/app.ts ui/src/styles/components.css
git commit -m "feat: show notification when one-search-mcp is auto-enabled"
```

---

## Task 4: Интеграционное тестирование

**Files:**
- Test manually (no automated test file needed)

**Step 1: Создать чистый профиль для теста**

```bash
# Остановить текущий gateway
yagent gateway stop

# Переименовать/удалить текущий профиль
mv ~/.YA-yagent ~/.YA-yagent.backup
```

**Step 2: Запустить gateway с новым профилем**

```bash
cd ~/Projects/YandexAgetn
npm run start:gateway
```

**Step 3: Проверить compaction в конфиге**

```bash
cat ~/.YA-yagent/openclaw.json | grep -A 10 "compaction"
```

Expected:
```json
"compaction": {
  "mode": "safeguard",
  "reserveTokens": 40000,
  "keepRecentTokens": 25000,
  "reserveTokensFloor": 25000
}
```

**Step 4: Проверить bootstrapMaxChars**

```bash
cat ~/.YA-yagent/openclaw.json | grep "bootstrapMaxChars"
```

Expected: `"bootstrapMaxChars": 12000`

**Step 5: Проверить MCP-сервер**

```bash
cat ~/.YA-yagent/openclaw.json | grep -A 8 "mcpServers"
```

Expected:
```json
"mcpServers": {
  "one-search": {
    "command": "npx",
    "args": ["-y", "one-search-mcp"],
    "env": {
      "SEARCH_PROVIDER": "duckduckgo"
    }
  }
}
```

**Step 6: Проверить UI-уведомление**

1. Открыть UI в браузере
2. Убедиться что появилось уведомление "Поиск DuckDuckGo включён автоматически"
3. Закрыть уведомление
4. Перезагрузить страницу — уведомление не должно появиться снова

**Step 7: Восстановить бэкап (по желанию)**

```bash
rm -rf ~/.YA-yagent
mv ~/.YA-yagent.backup ~/.YA-yagent
```

**Step 8: Финальный commit**

```bash
git add .
git commit -m "feat: compaction + one-search-mcp out-of-the-box integration complete"
```

---

## Task 5: Обновить документацию

**Files:**
- Modify: `docs/plans/2026-02-22-compaction-onsearch-design.md` (отметить выполненным)
- Modify: `YANDEXAGETN.md` (обновить бэклог)

**Step 1: Отметить в дизайн-документе**

В `docs/plans/2026-02-22-compaction-onsearch-design.md` добавить в начало:

```markdown
---
**Статус:** ✅ Реализовано (2026-02-22)
**Коммит:** [sha]
---
```

**Step 2: Обновить YANDEXAGETN.md**

В раздел P1 добавить:

```markdown
- [x] Усилить производительность через compaction...
  - **Статус:** Реализовано в коде проекта
  - **Файлы:** `src/config/defaults.ts`
  - **Детали:** Автоматически применяются оптимальные значения при первом запуске

- [x] Добавить `one-search-mcp`...
  - **Статус:** Реализовано в коде проекта
  - **Файлы:** `src/config/defaults.ts`, `ui/src/ui/app.ts`
  - **Детали:** MCP-сервер добавляется автоматически, есть UI-уведомление
```

**Step 3: Commit**

```bash
git add docs/plans/2026-02-22-compaction-onsearch-design.md YANDEXAGETN.md
git commit -m "docs: mark compaction and one-search-mcp as implemented"
```

---

## Summary

**Всего задач:** 5  
**Примерное время:** 1-1.5 часа  
**Ключевые файлы:**
- `src/config/defaults.ts` — основная логика
- `ui/src/ui/app.ts` — UI-уведомление
- `ui/src/styles/components.css` — стили уведомления

**Риски:**
- `one-search-mcp` требует интернета при первом запуске (npx)
- Если npx не найден — MCP сервер не запустится (graceful degradation)
