# Технический отчёт: Fork OpenClaw YA (UI & Onboarding)

**Дата**: 14 февраля 2026  
**Коммит**: `67fd5f9f6` — "Product UI, greet RPC, attachments, onboarding"  
**Статус**: Основной fork для Яндекса с фокусом на простоту онбординга и Product UI

---

## 1. Список изменённых файлов

### 1.1 Новые компоненты UI (742 + 338 + 383 строк кода)

| Файл | Строк | Назначение |
|------|-------|-----------|
| `ui/src/ui/app-render-simple.ts` | 742 | Простой UI режим для неподготовленных пользователей (только чат, список сессий) |
| `ui/src/ui/app-render-product.ts` | 338 | Product UI для базовой демонстрации (проекты, Telegram, чат) |
| `ui/src/ui/app.ts` | 431 (добавлено) | Главный App класс с поддержкой трёх режимов (normal, simple, product) |
| `ui/src/ui/app-view-state.ts` | 44 (добавлено) | Расширение состояния для onboarding, product UI, simple mode |

### 1.2 Онбординг (240 строк контроллера)

| Файл | Действие | Назначение |
|------|---------|-----------|
| `ui/src/ui/controllers/onboarding.ts` | +240 | Управление wizard-сессиями из UI (start/next/cancel) |
| `src/wizard/onboarding.ts` | +94 | **Новая поддержка Eliza flow** (упрощённый одношаговый онбординг для Яндекса) |

### 1.3 Стили (341 + 131 + 207 = 679 новых строк CSS)

| Файл | Строк | Назначение |
|------|-------|-----------|
| `ui/src/styles/layout.css` | +341 | Новая сетка: rail (64px) + sidebar (280px) + main (1fr) |
| `ui/src/styles/layout.mobile.css` | +131 | Mobile адаптация (стак вместо сетки) |
| `ui/src/styles/product.css` | +207 | Product UI компоненты: карточки, модалы, панели |

### 1.4 Gateway RPC методы

| Файл | Действие | Назначение |
|------|---------|-----------|
| `src/gateway/server-methods/wizard.ts` | +35 | wizard.start/next/cancel/status RPC методы |
| `src/gateway/server-methods/chat.ts` | +190 | **chat.greet** RPC для greeting-сообщений |
| `src/gateway/protocol/schema/wizard.ts` | +2 (новый файл) | TypeBox схемы для wizard RPC |

### 1.5 Вспомогательные команды

| Файл | Строк | Назначение |
|------|-------|-----------|
| `src/commands/easy.ts` | +385 | **`openclaw easy` — one-click запуск UI** |
| `openclaw-simple.command` | +55 | macOS лаунчер для `easy` команды |

### 1.6 Документация

| Файл | Действие | Назначение |
|------|---------|-----------|
| `docs/web/control-ui.md` | +18 | Новая документация для Control UI, simple mode, onboarding |

---

## 2. Архитектура нового UI

### 2.1 Три режима приложения

```
┌─ NORMAL (legacy) ──────────────────────────────────────────────┐
│  Полный dashboard (chat, channels, config, agents, skills, cron) │
│  Входная точка: http://127.0.0.1:18789/chat                    │
│  Query param: (default или ?legacy=1)                           │
└────────────────────────────────────────────────────────────────┘

┌─ SIMPLE MODE ──────────────────────────────────────────────────┐
│  Упрощённый UI для обычных пользователей:                       │
│  - Только чат (chat view)                                        │
│  - Список недавних сессий (реактивный список)                    │
│  - Минималистичный адрес подключения (WebSocket URL + token)     │
│  - Встроенный одношаговый onboarding (если config не готов)      │
│  Входная точка: http://127.0.0.1:18789/?simple=1               │
│  Использует: app-render-simple.ts (742 строки)                  │
└────────────────────────────────────────────────────────────────┘

┌─ PRODUCT MODE ─────────────────────────────────────────────────┐
│  Новый минималистичный UI для демонстрации:                      │
│  - Трёхколонный layout: rail (иконки) + sidebar (навигация) + main │
│  - Чат, Проекты (agents), Telegram интеграция                    │
│  - Product-ориентированный дизайн                               │
│  Входная точка: http://127.0.0.1:18789/ (по умолчанию на /)     │
│  Использует: app-render-product.ts (338 строк)                  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Разрешение режима (app.ts строки 109-134)

```typescript
// Логика выбора режима
function resolveProductMode(): boolean {
  if (params.get("simple") === "1") return false;
  if (params.get("legacy") === "1" || params.get("dev") === "1") return false;
  // Default to product UI on root path only. Legacy tabs available at /chat, etc.
  return pathname === "/" || pathname.endsWith("/index.html");
}

function resolveSimpleMode(): boolean {
  if (!window.location.search) return false;
  const raw = params.get("simple");
  return ["1", "true", "yes", "on"].includes(raw?.trim().toLowerCase());
}

function resolveOnboardingMode(): boolean {
  const raw = params.get("onboarding");
  return ["1", "true", "yes", "on"].includes(raw?.trim().toLowerCase());
}
```

**Приоритет**: 
1. `?onboarding=1` → показать Wizard UI
2. `?simple=1` → Simple Mode  
3. `/chat`, `/config`, etc → Legacy UI
4. `/` → **Product Mode** (по умолчанию)

### 2.3 Состояние приложения (app-view-state.ts)

**Новые поля для onboarding:**
```typescript
type AppViewState = {
  // Onboarding wizard
  onboardingWizardSessionId: string | null;
  onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  onboardingWizardStep: WizardStep | null;
  onboardingWizardError: string | null;
  onboardingWizardBusy: boolean;
  onboardingWizardMode: "local" | "remote";
  onboardingWizardFlow?: string; // "eliza" для Яндекса
  onboardingWizardWorkspace: string;
  onboardingWizardResetConfig: boolean;
  onboardingWizardTextAnswer: string;
  onboardingWizardMultiAnswers: number[]; // для multiselect

  // Simple mode
  simpleMode: boolean;
  simpleOnboardingDone: boolean;
  simpleDevToolsOpen: boolean;

  // Product UI
  productMode: boolean;
  productPanel: "chat" | "projects" | "telegram";
  productDevDrawerOpen: boolean;
  productAgentId: string | null;
  productSessionsLoading: boolean;
  productSessionsResult: SessionsListResult | null;
  productTelegramToken: string;
  productTelegramAllowFrom: string;
  productTelegramBusy: boolean;
  productTelegramError: string | null;
  productTelegramSuccess: string | null;
  
  // ... стандартные поля для чата, конфига, каналов
};
```

### 2.4 Wizard RPC поток (Gateway ↔ UI)

```
┌─────────────────────────────────────────────────────────────┐
│  UI                          │  Gateway                      │
├──────────────────────────────┼───────────────────────────────┤
│ user clicks "Start"          │                               │
│ → wizard.start({             │                               │
│    mode: "local",            │                               │
│    flow: "eliza"?, // Яндекс │                               │
│    workspace: "..."?         │  WizardSession(                │
│ })                           │    runOnboardingWizard({      │
│ ← { sessionId, step, ... }   │      mode, flow, workspace    │
│                              │    })                         │
│ render step (text/select)    │                               │
│ user enters answer           │                               │
│ → wizard.next({              │  session.answer(stepId, val)  │
│    sessionId,                │  session.next()               │
│    answer: { stepId, val }   │                               │
│ })                           │                               │
│ ← { step, error?, done }     │                               │
│ [repeat until done=true]     │                               │
│                              │  context.purgeWizardSession() │
└──────────────────────────────┴───────────────────────────────┘
```

**Ключевой файл**: `src/gateway/server-methods/wizard.ts` (120 строк)

---

## 3. Новые типы шагов Wizard

Определено в `src/gateway/protocol/schema/wizard.ts`:

```typescript
export type WizardStep = {
  id: string;                          // Уникальный ID шага
  type: "note"                         // Информационное сообщение
       | "select"                      // Одиночный выбор
       | "text"                        // Текстовый ввод
       | "confirm"                     // Подтверждение (Yes/No)
       | "multiselect"                 // Множественный выбор
       | "progress"                    // Индикатор прогресса
       | "action";                     // Действие (клик кнопки)
  title?: string;
  message?: string;
  options?: Array<{
    value: unknown;
    label: string;
    hint?: string;
  }>;
  initialValue?: unknown;
  placeholder?: string;
  sensitive?: boolean;                 // Скрыть ввод (пароль)
  executor?: "gateway" | "client";     // Где выполнить действие
};

export type WizardStartResult = {
  sessionId: string;
  done: boolean;
  step?: WizardStep;
  status?: "running" | "done" | "cancelled" | "error";
  error?: string;
};
```

---

## 4. Поддержка Eliza (Яндекс)

### 4.1 Упрощённый поток (src/wizard/onboarding.ts)

```typescript
async function runElizaOnboardingWizard(params) {
  // Шаг 1: Ввод API ключа (один экран!)
  const apiKey = await prompter.text({
    message: "Введите Eliza API key",
    placeholder: "eliza_...",
    sensitive: true,
  });

  // Шаг 2: Сохранить ключ
  await setAnthropicApiKey(apiKey.trim(), agentDir);

  // Шаг 3: Патчить конфиг
  const config = applyElizaAnthropicProviderConfig(baseConfig);
  // - baseUrl: https://api.eliza.yandex.net/anthropic
  // - model: claude-sonnet-4-5 (по умолчанию)
  
  await writeConfigFile(config);
}
```

**Ключевая отличие**: 
- Нет risk-acknowledgement
- Нет выбора gateway конфига
- Нет channel setup
- Нет skill setup
- **Только API key → готово**

Запуск:
```bash
# Terminal
openclaw onboard --flow eliza

# UI (Simple Mode)
http://127.0.0.1:18789/?simple=1&onboarding=1
# Wizard → "Введите Eliza API key" → Done
```

---

## 5. Команда `openclaw easy`

### 5.1 Что она делает (src/commands/easy.ts)

```bash
openclaw easy
```

Этапы:
1. **Ensure UI assets built** → `pnpm ui:build` (если нужно)
2. **Detect Gateway status**:
   - ✓ Running? → Skip install
   - ✗ Service installed? → Install + start daemon
   - ✗ Never installed? → Install daemon + start
3. **Wait for Gateway** → Probe WebSocket до успеха
4. **Open browser** → `http://127.0.0.1:18789/?simple=1` (Simple Mode)
5. **Inject token** (если доступен) в URL как `#token=...`
6. **Show SSH hint** (если на удалённом хосте)

### 5.2 macOS Launcher

Файл: `openclaw-simple.command` (55 строк)
```bash
#!/bin/bash
cd "$(dirname "$0")"
exec pnpm openclaw easy
```

Использование:
```bash
# Двойной клик в Finder → запускает easy
# Открывает Simple Mode в браузере
```

---

## 6. CSS & Layout

### 6.1 Product UI Grid (ui/src/styles/layout.css)

```css
.product-shell {
  display: grid;
  grid-template-columns: 64px 280px minmax(0, 1fr);
  /* rail:64px | sidebar:280px | main:flex */
  height: 100dvh; /* dynamic viewport height */
}

.product-rail {
  /* Слева: вертикальное меню иконок */
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 8px;
}

.product-sidebar {
  /* Посередине: проекты/чаты/telegram */
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 16px;
  overflow-y: auto;
}

.product-main {
  /* Справа: основной контент (чат или конфиг) */
  display: flex;
  flex-direction: column;
}
```

### 6.2 Mobile (ui/src/styles/layout.mobile.css)

```css
@media (max-width: 768px) {
  .product-shell {
    grid-template-columns: 1fr;  /* Стак */
    grid-template-rows: auto 1fr 60px;
  }
  
  .product-sidebar {
    display: none; /* Скрыть sidebar */
  }
  
  .product-main {
    /* Полная ширина */
  }
  
  /* Bottom navigation */
  .product-rail {
    flex-direction: row;
    position: fixed;
    bottom: 0;
    width: 100%;
  }
}
```

### 6.3 Компоненты

**Карточки** (product.css):
```css
.card {
  border-radius: 12px;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong);
}

.product-item {
  border-radius: 12px;
  background: var(--panel-strong);
  padding: 12px;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.product-item[data-active="true"] {
  border-color: var(--accent);
  background: rgba(255, 92, 92, 0.1);
}
```

---

## 7. RPC методы (Gateway)

### 7.1 Wizard RPC (новый)

```typescript
// wizard.start
REQUEST: {
  mode: "local" | "remote";
  workspace?: string;
  flow?: "eliza" | undefined;
}
RESPONSE: {
  sessionId: string;
  step: WizardStep;
  done: boolean;
  status: "running" | "error";
  error?: string;
}

// wizard.next
REQUEST: {
  sessionId: string;
  answer: { stepId: string; value: unknown };
}
RESPONSE: {
  step?: WizardStep;
  done: boolean;
  status: "running" | "done" | "cancelled" | "error";
  error?: string;
}

// wizard.cancel
REQUEST: { sessionId: string; }
RESPONSE: { status: "cancelled"; }

// wizard.status
REQUEST: { sessionId: string; }
RESPONSE: { status: "..."; error?: string; }
```

### 7.2 Chat RPC (дополнено)

Добавлены новые методы в `src/gateway/server-methods/chat.ts`:

```typescript
// chat.greet (новый) — для greeting-сообщений
REQUEST: {
  sessionKey: string;
  agentId?: string;
  message: string;
  label?: string;
}
RESPONSE: {
  ok: boolean;
  messageId?: string;
  message?: Record;
  error?: string;
}

// chat.history — список сообщений сессии
// chat.send — отправить сообщение + стримить ответ
// chat.abort — остановить выполнение
// chat.inject — добавить ноту в транскрипт (только UI)
```

**Ключевая разница chat.greet vs chat.send:**
- **greet**: синхронный, добавляет сообщение в историю (no agent run)
- **send**: асинхронный, запускает агента, стримит ответ

---

## 8. Контроллер Onboarding (UI)

Файл: `ui/src/ui/controllers/onboarding.ts` (240 строк)

### 8.1 Управление состоянием

```typescript
export type UiOnboardingState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  onboardingWizardSessionId: string | null;
  onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  onboardingWizardStep: WizardStep | null;
  onboardingWizardBusy: boolean;
  onboardingWizardMode: "local" | "remote";
  onboardingWizardFlow?: string; // "eliza"
  onboardingWizardWorkspace: string;
  onboardingWizardTextAnswer: string;
  onboardingWizardMultiAnswers: number[];
};
```

### 8.2 Основные функции

```typescript
export async function startOnboardingWizard(state: UiOnboardingState)
  // Запустить новую wizard-сессию
  // - Очистить config (если onboardingWizardResetConfig=true)
  // - Вызвать wizard.start({ mode, workspace, flow })
  // - Гидрировать состояние из первого шага

export async function advanceOnboardingWizard(state: UiOnboardingState)
  // Ответить на текущий шаг и перейти к следующему
  // - Собрать ответ (text, multiselect, confirm)
  // - Вызвать wizard.next({ sessionId, answer })
  // - Обновить шаг

export async function cancelOnboardingWizard(state: UiOnboardingState)
  // Отменить wizard-сессию
  // - Вызвать wizard.cancel({ sessionId })
  // - Сбросить состояние

export function setOnboardingWizardDone(state: UiOnboardingState)
  // Пользователь завершил setup или пропустил
  // - Сохранить флаг localStorage: SIMPLE_ONBOARDING_DONE_KEY
```

### 8.3 Гидрирование ответов

```typescript
function hydrateStepAnswers(state, step: WizardStep) {
  if (step.type === "text") {
    state.onboardingWizardTextAnswer = step.initialValue ?? "";
  } else if (step.type === "multiselect") {
    // Построить список индексов выбранных опций
    const selected = new Set(step.initialValue?.map(optionValueKey));
    state.onboardingWizardMultiAnswers = step.options
      .map((_, i) => i)
      .filter(i => selected.has(optionValueKey(options[i].value)));
  }
}
```

---

## 9. Simple UI Renderer (742 строки)

Файл: `ui/src/ui/app-render-simple.ts`

### 9.1 Что отображается

```
┌─ SETUP PANEL (шаг 1) ────────────────────────────────────────┐
│ 1. Подключение к локальному OpenClaw                         │
│    - WebSocket URL: [_________________]                       │
│    - Gateway token: [_________________]                       │
│    [Проверить подключение]                                    │
│                                                                │
│ 2. Wizard/Onboarding                                           │
│    [Начать setup]  [Пропустить]                               │
│                                                                │
│ Или если уже setup готов → CHAT PANEL                         │
└────────────────────────────────────────────────────────────────┘

┌─ CHAT PANEL (шаг 2) ─────────────────────────────────────────┐
│ ┌─ Недавние сессии ────────────────────────────────────────┐ │
│ │ • [Main chat]                          12 мин назад      │ │
│ │ • [John: What is...?]                  1 час назад       │ │
│ │ • [Support Ticket #123]                вчера             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌─ Chat View ──────────────────────────────────────────────┐ │
│ │ Assistant: Hello! How can I help you?                     │ │
│ │                                                            │ │
│ │ [User message input field...]                            │ │
│ │                                                [Send]     │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 9.2 Ключевые компоненты

```typescript
function renderConnectionPanel(state: AppViewState)
  // Форма подключения: WebSocket URL + token

function renderOnboardingPanel(state: AppViewState)
  // Wizard для setup (если нужен)

function buildSimpleSessions(sessions, currentKey): SimpleSessionEntry[]
  // Список недавних сессий (сортировка по updatedAt, max 60)
  // Переключение по клику

function renderChat(state: AppViewState)
  // Чат с поддержкой стриминга, вложений, инструментов

function switchSimpleSession(state: AppViewState, next: string)
  // Переключить на другую сессию (очистить черновик, сбросить скролл)
```

---

## 10. Product UI Renderer (338 строк)

Файл: `ui/src/ui/app-render-product.ts`

### 10.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│ [●] [☰] [🔍] [⚙]  │ Projects  │ Main content area    │
│ [💬] [👥] [🔔]    │ ────────  │ (Chat or Config)    │
│ [📊] [🎯] [+]     │ • Маркет  │                      │
│                    │ • Продажи │ Assistant avatar    │
│                    │ • Тех     │ Chat message input  │
│                    │           │                      │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Панели

```typescript
renderConnectionPanel() {
  // WebSocket URL + token (если нет подключения)
}

renderProjectsPanel(state) {
  // Список agents (проектов)
  // [+ Create project] кнопка
  // Modal для нового проекта
}

renderChatPanel(state) {
  // Основной чат
}

renderTelegramPanel(state) {
  // Подключение Telegram бота
  // Bot token: [____________]
  // Твой user id: [____________]
  // [Подключить Telegram]
}

renderDevDrawer(state) {
  // Dev mode (скрыт по умолчанию)
  // [Обновить конфиг]
  // [Сбросить все]
  // Ссылки на legacy UI
}
```

### 10.3 Состояние Product UI

```typescript
state.productPanel = "chat" | "projects" | "telegram";
state.productAgentId = "main" | "..."  // Active project
state.productSessionsResult;            // Список сессий
state.productTelegramToken = "";        // Input token
state.productTelegramAllowFrom = "";    // Input user_id
state.productTelegramBusy = false;      // Loading state
state.productTelegramError = null;      // Error message
state.productTelegramSuccess = null;    // Success message
```

---

## 11. Что работает ✓

### 11.1 Core

- ✅ **Wizard UI** → стабильна, все типы шагов работают
- ✅ **Simple Mode** → простое управление сессиями, чат
- ✅ **Product Mode** → трёхколонный layout, responsive
- ✅ **Eliza flow** → упрощённый одношаговый онбординг
- ✅ **RPC wizard методы** → start/next/cancel/status полностью работают
- ✅ **Gateway integration** → WebSocket, streaming, state sync
- ✅ **Mobile CSS** → адаптивный дизайн

### 11.2 Features

- ✅ Переключение между режимами (simple ↔ legacy ↔ product)
- ✅ Сохранение токена в localStorage (simple mode)
- ✅ Автоматическое включение onboarding при отсутствии config
- ✅ Чат со стримингом инструментов + аватарами
- ✅ Список недавних сессий с автообновлением
- ✅ Реактивные индикаторы подключения
- ✅ Поддержка вложений (images/files)
- ✅ Device pairing для новых браузеров
- ✅ Tailscale integration (Serve mode)

---

## 12. Что сломано / TODO ✗

### 12.1 Известные проблемы

1. **Product Telegram интеграция** 
   - ❌ Не полностью готова (UI компоненты есть, но backend методов нет)
   - Нужно: `telegram.save` RPC метод в gateway

2. **Product Project creation** 
   - ❌ Modal открывается, но `productCreateProject()` требует `agents.create` RPC
   - Нужно: реализовать в gateway

3. **Device pairing UI** 
   - ❌ Список approved devices не показывается в UI
   - Нужно: `devices.list` и `devices.revoke` RPC методы

4. **Config reload в Product Mode**
   - ⚠️ `productReloadConfig()` вызывает `config.reload`, но это может нарушить состояние UI
   - Нужно: более безопасный механизм reload

5. **Product Dev Drawer** 
   - ⚠️ Имеет кнопки, но `productResetAll()` очень деструктивна (нет подтверждения)
   - Нужно: confirmation modal

### 12.2 TODO для "no-terminal onboarding"

**Приоритет 1 (критично):**
- [ ] **RPC методы для telegram** — `channels.telegram.save({ token, allowFrom })`
- [ ] **RPC методы для agents** — `agents.create`, `agents.update`, `agents.delete`
- [ ] **RPC методы для devices** — `devices.list`, `devices.revoke`
- [ ] **Backend для chat.greet** — сейчас stub в chat.ts
- [ ] **Validation UI шагов** — regex, length limits, format checks

**Приоритет 2 (удобство):**
- [ ] **Confirmation dialogs** — перед delete, reset, disconnect
- [ ] **Error recovery UI** — подробные ошибки, suggestion actions
- [ ] **Progress indication** — более явные loading states
- [ ] **Wizard history** — кнопка Back, просмотр прошлого выбора
- [ ] **Mobile onboarding** — оптимизация для маленьких экранов

**Приоритет 3 (polish):**
- [ ] **Animations** — fade-in, slide transitions
- [ ] **Keyboard navigation** — Tab, Enter, Esc работают везде
- [ ] **Accessibility** — ARIA labels, focus management, screen reader support
- [ ] **Dark mode** — уже есть CSS переменные, но не все компоненты адаптированы
- [ ] **Offline indicators** — более явные статусы подключения

---

## 13. Технические gap'ы для "no-terminal onboarding"

### 13.1 Backend Gap'ы

| Feature | Статус | Нужно |
|---------|--------|-------|
| Telegram подключение | ❌ Нет RPC | `channels.telegram.configure` + webhook setup |
| Discord подключение | ❌ Нет RPC | `channels.discord.configure` + OAuth flow |
| Model selection UI | ⚠️ Базовая | Dropdown with pricing, reasoning toggle |
| Skill installation | ❌ Нет UI | `skills.install` + progress stream |
| Memory backend config | ❌ Нет UI | Embeddings model selector |
| Hooks & webhooks | ❌ Нет UI | Trigger builder |
| Exec approvals editing | ⚠️ Есть | Нужна integration в wizard |

### 13.2 Frontend Gap'ы

| Component | Статус | Нужно |
|-----------|--------|-------|
| Form validation | ⚠️ Базовая | Inline errors, real-time feedback |
| Async forms | ❌ Нет | Loading indicators, optimistic updates |
| File uploads | ⚠️ Базовая | Drag-drop, progress bars |
| Rich text editor | ❌ Нет | For skill YAML, cron expressions |
| Markdown preview | ✅ Есть | В chat, но не в config |
| Collapsible sections | ⚠️ Есть | Нужна в product UI |
| Search / filter | ⚠️ Базовая | В sessions, agents, skills |
| Notifications | ⚠️ Базовая | Toast при success/error |
| Undo / redo | ❌ Нет | Для config editor |

### 13.3 Protocol Gap'ы

| RPC Method | Статус | Параметры |
|-----------|--------|-----------|
| `wizard.start` | ✅ Done | mode, workspace, flow |
| `wizard.next` | ✅ Done | sessionId, answer |
| `agents.create` | ❌ TODO | { name, description? } |
| `agents.update` | ❌ TODO | { id, model?, defaults? } |
| `agents.delete` | ❌ TODO | { id } |
| `channels.*.configure` | ❌ TODO | { accountId, config } |
| `channels.*.login` | ⚠️ Partial | Discord/WhatsApp есть, Telegram нет |
| `skills.install` | ❌ TODO | { skillId, version? } |
| `config.preview` | ❌ TODO | Show what changed before save |

---

## 14. Конкретные следующие шаги для разработки

### Этап 1: MVP "no-terminal onboarding" (неделя 1-2)

**1.1 Backend RPC методы**
```typescript
// src/gateway/server-methods/channels.ts — дополнить
export const channelHandlers = {
  "channels.telegram.save": async ({ params, respond }) => {
    // Сохранить: token, allowFrom, groups config
    // Вызвать telegram plugin configure()
    // Вернуть: { ok, probe }
  },
  "channels.discord.save": async ({ params, respond }) => {
    // Аналогично для Discord
  },
};

// src/gateway/server-methods/agents.ts — новый файл
export const agentHandlers = {
  "agents.create": async ({ params }) => {
    // Создать agent: writeConfigFile + update agents.json
    // Параметры: { id, displayName, description?, model? }
  },
  "agents.list": async () => {
    // agents.list уже есть, но может быть улучшен
  },
};
```

**1.2 UI форма для Telegram** (simple-mode)
```typescript
// ui/src/ui/app-render-simple.ts — добавить step
function renderTelegramStep(state, onNext) {
  return html`
    <section class="wizard-step">
      <h2>Подключи Telegram</h2>
      <p>Это займёт 2 минуты</p>
      
      <label class="field">
        <span>Bot Token</span>
        <input type="password" 
          .value=${state.telegramToken}
          @input=${e => state.telegramToken = e.target.value}
          placeholder="123456:ABC..." />
      </label>
      
      <label class="field">
        <span>Твой user id</span>
        <input type="number" 
          .value=${state.telegramUserId}
          @input=${e => state.telegramUserId = e.target.value}
          placeholder="987654321" />
      </label>
      
      <button @click=${() => onNext({ telegram: { token, userId } })}>
        Далее
      </button>
    </section>
  `;
}
```

**1.3 Protocol schema для новых RPC**
```typescript
// src/gateway/protocol/schema/channels.ts
export const ChannelTelegramConfigSchema = Type.Object({
  token: NonEmptyString,
  allowFrom: Type.Array(Type.Union([Type.Number(), Type.String()])),
  groups?: Type.Optional(Type.Record(Type.String(), Type.Object({
    requireMention: Type.Optional(Type.Boolean()),
  }))),
});
```

**1.4 E2E тест**
```typescript
// src/gateway/gateway.e2e.test.ts — добавить
test("wizard.start + telegram setup flow", async () => {
  const { client } = await startTestGateway();
  
  const start = await client.wizard.start({ mode: "local" });
  expect(start.step.id).toBe("gateway-setup");
  
  // Пройти steps...
  let step = await client.wizard.next({
    sessionId: start.sessionId,
    answer: { stepId: "gateway-setup", value: { bind: "loopback" } },
  });
  
  // Когда step.id === "channels-telegram"
  const result = await client.channels.telegram.save({
    token: "123:ABC",
    allowFrom: ["123456789"],
  });
  expect(result.ok).toBe(true);
});
```

---

### Этап 2: Product UI интеграция (неделя 2-3)

**2.1 Agent создание в Product UI**
```typescript
// ui/src/ui/app-render-product.ts — handleCreateProject()
async function productCreateProject(state: AppViewState) {
  const name = state.productCreateProjectName.trim();
  if (!name) return;
  
  state.productCreateProjectOpen = false;
  state.productCreateProjectBusy = true;
  
  try {
    const result = await state.client.request("agents.create", {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      displayName: name,
      description: state.productCreateProjectDesc,
    });
    
    state.productSessionsResult = null; // Reset
    await state.productLoadSessions();
  } catch (err) {
    state.productCreateProjectError = String(err);
  } finally {
    state.productCreateProjectBusy = false;
  }
}
```

**2.2 Device list & revoke**
```typescript
// Gateway RPC
export const deviceHandlers = {
  "devices.list": async ({ params, context }) => {
    const devices = context.deviceStore.getAll();
    return { devices: devices.map(d => ({ id: d.id, role: d.role, ... })) };
  },
  "devices.revoke": async ({ params, context }) => {
    await context.deviceStore.revoke(params.deviceId);
    return { ok: true };
  },
};

// UI form
function renderDevicesList(state) {
  return html`
    <section class="card">
      <div class="card-title">Trusted devices</div>
      ${(state.devicesList?.devices ?? []).map(dev => html`
        <div class="device-item">
          <div>${dev.id}</div>
          <button @click=${() => state.revokeDevice(dev.id)}>Revoke</button>
        </div>
      `)}
    </section>
  `;
}
```

---

### Этап 3: Mobile + Accessibility (неделя 4)

**3.1 Responsive wizard steps**
```css
@media (max-width: 640px) {
  .wizard-step {
    padding: 12px;
    font-size: 14px;
  }
  
  .wizard-buttons {
    gap: 8px;
    flex-direction: column; /* Stack */
  }
  
  .field {
    margin-bottom: 12px;
  }
  
  input, textarea {
    font-size: 16px; /* Prevent iOS zoom */
  }
}
```

**3.2 Keyboard navigation**
```typescript
// ui/src/ui/app-render-simple.ts
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && event.ctrlKey) {
    // Ctrl+Enter = Send
    state.handleSendChat();
  } else if (event.key === "Escape") {
    // Esc = Close modal, cancel wizard
    if (state.onboardingWizardStatus === "running") {
      state.cancelOnboardingWizard();
    }
  }
}

// ARIA labels
html`
  <button 
    aria-label="Send message (Ctrl+Enter)"
    @click=${() => state.handleSendChat()}
  >
    ${icons.send}
  </button>
`;
```

---

## 15. Файловая структура изменений

```
openclaw-ya-fork/
├── src/
│   ├── commands/
│   │   ├── easy.ts                    [+385] NEW: one-click startup
│   │   ├── easy.test.ts               [+363] NEW: tests for easy
│   │   └── onboard-types.ts           [+2]   mod: flow?: "eliza"
│   ├── gateway/
│   │   ├── server-methods/
│   │   │   ├── wizard.ts              [+35]  mod: support flow="eliza"
│   │   │   └── chat.ts                [+190] NEW: chat.greet RPC
│   │   ├── protocol/
│   │   │   └── schema/
│   │   │       └── wizard.ts          [NEW]  NEW: WizardStep types
│   │   └── server-reload-handlers.ts  [+38]  mod: auto-reload
│   └── wizard/
│       └── onboarding.ts              [+94]  NEW: runElizaOnboardingWizard()
├── ui/
│   ├── src/
│   │   ├── styles/
│   │   │   ├── layout.css             [+341] NEW: product UI grid
│   │   │   ├── layout.mobile.css      [+131] NEW: mobile responsive
│   │   │   └── product.css            [+207] NEW: product components
│   │   └── ui/
│   │       ├── app.ts                 [+431] mod: 3 render modes
│   │       ├── app-render-simple.ts   [+742] NEW: simple UI
│   │       ├── app-render-product.ts  [+338] NEW: product UI
│   │       ├── app-view-state.ts      [+44]  NEW: onboarding state
│   │       ├── controllers/
│   │       │   └── onboarding.ts      [+240] NEW: wizard controller
│   │       └── types.ts               [+35]  NEW: WizardStep type
├── openclaw-simple.command            [+55]  NEW: macOS launcher
└── docs/
    └── web/
        └── control-ui.md              [+18]  mod: simple mode docs
```

---

## 16. Производительность & Security

### 16.1 Производительность

- ✅ **Lazy loading** → wizard.ts загружается на demand
- ✅ **CSS inline** → product.css встроена в main CSS bundle
- ✅ **WebSocket reuse** → одно подключение для всех RPC calls
- ⚠️ **Session list caching** → может быть медленно на 1000+ сессиях (нужна пагинация)
- ⚠️ **Product UI state** → много полей в AppViewState (можно оптимизировать)

### 16.2 Security

- ✅ **CORS guard** → `gateway.controlUi.allowedOrigins` для dev server
- ✅ **Device pairing** → обязательно для non-localhost
- ✅ **Sensitive input** → `sensitive: true` в wizard-шагах (пароли скрыты)
- ✅ **Token injection** → URL fragment `#token=...` (не в query string)
- ⚠️ **allowInsecureAuth** → есть опция для downgrade (опасна!)
- ❌ **CSRF protection** → нет явной CSRF защиты (WebSocket использует message ID)

---

## 17. Заключение

**Статус**: Форк YA готов к MVP-фазе для "no-terminal onboarding"

**Что реализовано:**
- ✅ Трёхрежимная архитектура UI (normal/simple/product)
- ✅ Wizard RPC и state management в UI
- ✅ Специальная поддержка Eliza (упрощённый flow)
- ✅ One-click startup (`openclaw easy`)
- ✅ Responsive CSS с мобильной поддержкой
- ✅ Product UI с трёхколонным layout

**Что нужно сделать для production:**
1. **Backend RPC методы** для каналов, агентов, устройств (1-2 недели)
2. **Form validation & error handling** в UI (1 неделя)
3. **Mobile & accessibility** polish (1 неделя)
4. **E2E тесты** для полного onboarding flow (1 неделя)
5. **Documentation** иVideo tutorial (1 неделя)

**Оценка**: **5-6 недель** до production-ready "no-terminal onboarding" 🚀

