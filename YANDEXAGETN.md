# YAgent: текущий статус и бэклог

Обновлено: 2026-02-26 (фикс истории чата при clearLocalStorage, фикс exit 1 при настроенном Telegram, таймаут health-check, фикс Connection error из-за Node runtime, фикс зависания NDA-сессии в tool-loop)

## Текущие фичи (реализовано)
- Product UI и основная навигация русифицированы (кроме `Docs`).
- Основной UX заточен под один канал: `Telegram`.
- Подключение Telegram упрощено:
  - поле `Bot Token`;
  - поле `Ваш Telegram логин или ID` (single-user allowlist);
  - пошаговый прогресс подключения (`validating → patching → waiting_restart → waiting_reconnect → probing → success/error`).
- Ошибки подключения Telegram показываются с пользовательским текстом + техническими деталями в `details`.
- Первый быстрый CTA в чате: подключить Telegram или сформулировать задачу для напоминаний.
- Добавлен `NDA`-режим:
  - второй агент `nda`;
  - переключатель `Обычный / NDA` в чате;
  - отдельный CTA на подключение NDA-бота в Telegram.
- Модель по умолчанию переведена на Kimi 2.5 (`openrouter/moonshotai/kimi-k2.5`) через API Eliza/OpenRouter URL.
- Скрипт локального старта `yagent-onboard-ui.command` запускает UI/gateway:
  - Пересобирает Control UI (если не задан `OPENCLAW_SKIP_UI_BUILD=1`).
  - Открывает браузер с онбордингом (`?product=1&onboarding=1&clearLocalStorage=1`) — экран «Добро пожаловать в YA!» → ввод токена → product UI.
  - **Не открывать браузер вручную** (`open http://...`) одновременно со скриптом — скрипт сам открывает нужный URL.
- Рабочий каталог профиля для локального сценария: `~/.YA-yagent`.
- Скриншоты/изображения в чате: работают (вложение доходит до модели).
- Технические бэкапы и мусорные артефакты вынесены из рабочих путей в `ignored-unused/`.
- **Автономная локальная сборка реализована (2026-02-24):**
  - Superpowers skills bundled в `./skills/` (14 skills)
  - Скрипты автоматизации: `build-autonomous.sh`, `sync-skills.sh`, `verify-isolation.sh`
  - Integration и E2E тесты для проверки autonomous setup
  - Полная изоляция от global OpenClaw и GitHub openclaw
  - CI/CD скрипт: `test-autonomous-setup.sh`
- Скрипт `yagent-onboard-ui.command` (обновлён 2026-02-26):
  - **Всегда делает полный reset профиля** перед запуском (конфиг/сессии/workspace для профиля очищаются).
  - При первом запуске создаёт `openclaw.json` с: агентами `main`/`nda`, `skills.allowBundled=["*"]`, `one-search` MCP, `plugins.slots.memory="memory-core"`, `telegram.enabled=true`, `memory-core.enabled=true`, `includeDefaultMemory=true`.
  - Конкурирующий глобальный LaunchAgent `ai.openclaw.gateway` отключён (`launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist`) — он захватывал порт 18789 раньше yagent.
- **Память включена (2026-02-24, исправлена 2026-02-25):**
  - `plugins.slots.memory = "memory-core"` + `enabled: true` в `plugins.entries`.
  - `memory.backend = "qmd"`, `includeDefaultMemory: true` — QMD автоматически находит MEMORY.md и `memory/` в workspace каждого агента. Хардкоженные пути больше не нужны.
  - Каждый агент (main, nda, будущие) изолирован: читает только из своего workspace.
  - После каждого сообщения Ollama (`qwen2.5:7b-instruct`) извлекает факты/решения/задачи → daily log.
  - При компакте: промоушен → обновляет `MEMORY.md` агента.
  - Capture исправлен: Ollama получает только последний обмен (не всю историю) — нет дублей, нет роста нагрузки.
  - **Важно:** `plugins.slots.memory` и `memory-core.enabled` UI может сбросить при сохранении конфига — при проблемах проверить оба поля.
- **Telegram-плагин восстановлен и включён (2026-02-24, стабилизирован 2026-02-25):**
  - Воссозданы `extensions/telegram/openclaw.plugin.json` и `extensions/telegram/index.ts`.
  - В `~/.YA-yagent/openclaw.json` добавлена запись `plugins.entries.telegram.enabled = true`.
  - **Важно:** плагины из `extensions/` имеют origin `"bundled"` и **отключены по умолчанию** — без явного `enabled: true` в конфиге gateway их игнорирует. Это касается всех будущих плагинов в этой папке.
  - Probe-таймаут увеличен с 10 до 30 сек (`probeTelegramStatusWithRetry(25, 1200)`) — бот успевает подняться после рестарта gateway до того как UI покажет ошибку.
- **NDA-агент починен (2026-02-24):**
  - Переключение в NDA-режим больше не перезапускает gateway (если `nda_internal` уже настроен).
  - Telegram-панель разделена: отдельные секции «Обычный» и «NDA» — каждый агент может иметь своего бота.
  - Конфиг NDA-бота: `channels.telegram.accounts.nda` + binding `agentId: nda → accountId: nda`.
  - NDA Telegram CTA показывается только если NDA-бот не настроен (проверяет `channels.telegram.accounts.nda.botToken`).

## Текущее поведение модели
- Базовая модель (main): `openrouter/moonshotai/kimi-k2.5`.
- NDA-модель (агент `nda`): `qwen3_235b_a22b` через internal OpenAI-compatible endpoint.

## Исследование архитектуры UI (2026-02-25)

### Ключевые факты про `app-view-state.ts`
- **`app-view-state.ts` — ТОЛЬКО TypeScript-тип**, не реальный код. Импортируется везде как `import type { AppViewState }`. Его код никогда не компилируется в бандл vite. Правки там **не работают**.
- Весь реальный код инициализации и логики — в `ui/src/ui/app.ts`.

### Два разных онбординга
1. **`<onboarding-wizard>`** (полноэкранный, из `src/onboarding/onboarding-wizard.ts`) — показывается когда `this.onboarding=true && !this.simpleOnboardingDone`. Шаги: "Добро пожаловать" → ввод Kimi-токена.
2. **Inline product wizard** — `startOnboardingWizard()` / `advanceOnboardingWizard()` — встроен в product UI чат.

### Почему `clearLocalStorage=1` не очищает историю чата
- После `localStorage.clear()`, `loadSettings()` возвращает дефолты: `sessionKey: "main"`, `lastActiveSessionKey: "main"`.
- `host.applySessionKey = "main"` → gateway грузит существующую сессию `main` с историей.
- **Фикс нужен:** после clearLocalStorage генерировать новый sessionKey (не "main"), или вызывать `productNewChat()`.

### Ключи localStorage
- Онбординг: `SIMPLE_ONBOARDING_DONE_KEY = "openclaw.control.simple.onboarding.done.v1"` (значение `"1"`)
- UI-настройки: `"ui-settings"` (JSON)
- `loadSimpleOnboardingDone()` возвращает `false` если `onboarding=1` есть в URL → онбординг должен показываться при правильном URL.

### Почему браузер не открывается из `yagent-onboard-ui.command`
- Скрипт запускает gateway и ждёт health-check, но tsdown пересобирает TypeScript **внутри процесса gateway** при старте.
- Health-check таймаутится раньше чем tsdown заканчивает → скрипт считает gateway упавшим и не открывает браузер.
- Gateway при этом реально стартует и работает — нужно открывать браузер вручную или увеличить таймаут.

### Что было исправлено (2026-02-25)
- `scripts/build-autonomous.sh`: убрано условие "use existing dist/", теперь всегда пересобирает TypeScript через `tsdown`.

### Что было исправлено (2026-02-26)

**Баг: история предыдущего чата отображается при `clearLocalStorage=1`**
- **Файл:** `ui/src/ui/app-settings.ts`
- **Причина:** После `localStorage.clear()` вызов `loadSettings()` возвращал дефолт `sessionKey: "main"` → gateway грузил старую сессию `"main"` с историей.
- **Фикс:** Генерируется свежий UUID-ключ `agent:main:subagent:<uuid>` вместо `"main"` → gateway не находит старой сессии и создаёт чистую.

**Баг: браузер не открывается когда Telegram уже настроен** (исторический)
- **Файл:** `yagent-onboard-ui.command`
- **Причина:** Post-check проверял отсутствие `botToken` в конфиге и делал `exit 1` если находил — даже когда конфиг был намеренно сохранён (Telegram уже настроен). Браузер никогда не открывался в этом случае.
- **Фикс:** После перехода на всегда полный reset проверка `botToken` снова выполняется безусловно.

**Баг: Gateway failed to start — health-check таймаут**
- **Файл:** `yagent-onboard-ui.command`
- **Причина:** Health-check ждал 30 секунд (150 × 0.2s), но tsdown компилирует TypeScript внутри gateway при старте — это занимает дольше.
- **Фикс:** Таймаут увеличен до 90 секунд (450 × 0.2s).

**Баг: `Connection error` в чате при валидном токене**
- **Файл:** `yagent-onboard-ui.command`
- **Причина:** gateway запускался на `Node v25.x`, на котором поток `openrouter/moonshotai/kimi-k2.5` в webchat падал с `stopReason: "error"` и `errorMessage: "Connection error."`.
- **Фикс:** в скрипт добавлен выбор совместимого Node runtime (`v20-v22`, приоритет `nvm`) для запуска gateway.
- **Проверка:** после перезапуска через скрипт gateway поднимается на `Node v22.22.0`, чат отвечает в `main`-сессии без `Connection error`.

**Баг: `agent:nda:main` зависал (вечный спиннер / tool-loop)**
- **Файлы:** `ui/src/ui/app.ts`, `ui/src/ui/nda-mode.ts`, `ui/src/ui/nda-mode.test.ts`.
- **Причина:** локальная Ollama-модель в NDA-сессии зацикливалась на инструментах (`web_search` без Brave key и `tts`) и не завершала ход финальным текстом.
- **Фикс:**
  - UI при переключении в NDA теперь гарантирует локальный provider `ollama`.
  - Для агента `nda` принудительно применяется policy: `tools.profile = "minimal"` и `tools.deny += ["group:web", "tts", "session_status"]`.
  - Добавлены unit-тесты на модель/провайдер/policy для NDA режима.
- **Результат:** NDA-сессия отвечает финальным текстом (без бесконечного tool-loop), спиннер в UI не зависает.

**Текущий статус после фикса**
- Запуск через `yagent-onboard-ui.command`: работает.
- Диалог в UI (`main` агент): работает.
- Telegram статус в `main` агенте: OK (подтверждено в UI).

### Сессионный ключ в product-режиме
- Новая сессия: `agent:${agentId}:subagent:${crypto.randomUUID()}` — `ui/src/ui/app.ts:940`
- Главная сессия агента: `agent:${agentId}:main` — `ui/src/ui/app.ts:1206`
- Дефолт из `loadSettings()`: `"main"` — это НЕ product-ключ, gateway может маппить по-разному.

## Бэклог

### P0 (Chat-First Redesign — в работе)

- [x] **Claude-стиль сообщений** — CSS-only:
- [x] **Floating compose bar + NDA-иконка в compose**
- [x] **Кнопка «Копировать» на каждом блоке кода**
- [x] **Компактный Telegram CTA banner + баг-фикс**
- [x] **Двойная плашка CTA (2026-02-25):**
  - `renderTelegramCtaBanner` в `chat.ts` получал оригинальный `props` вместо локального override `showFirstGreetingCta && !showNdaTelegramCta`.
  - Фикс: `renderTelegramCtaBanner({ ...props, showFirstGreetingCta })` — при активной NDA CTA основная плашка скрыта.

### P0 (old)
- [x] Починить автоотправку первого сообщения в чате (сейчас нестабильно/не срабатывает).
  - **Причина:** в `productNewChat()` и `productNewChatInProject()` вызов `productGreet()` был без проверки пустого чата.
  - **Фикс:** добавлены проверки `chatMessages.length === 0` и `simpleOnboardingDone` перед отправкой приветствия, аналогично `productOpenSession()`.
  - **Файл:** `ui/src/ui/app.ts`.

### P1
- [x] Усилить производительность через compaction (главный рычаг) и ограничение bootstrap:

```json
"agents": {
  "defaults": {
    "compaction": {
      "reserveTokens": 40000,
      "keepRecentTokens": 25000,
      "reserveTokensFloor": 25000
    },
    "bootstrapMaxChars": 12000
  }
}
```

Примечание: `bootstrapMaxChars` ограничивает длину загружаемого системного промпта на старте; целевое значение — `12000`.
  - **Статус:** ✅ Реализовано в коде — функция `applyCompactionDefaults` в `src/config/defaults.ts` применяет merge-логику (не перезаписывает пользовательские значения).
  - **Для применения:** рестарт gateway.

- [x] Добавить `one-search-mcp` через `npx` (локально, без VPS, DuckDuckGo без ключей):

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

Примечание: конфиг-блок добавляется в `~/.YA-yagent/openclaw.json`.
  - **Статус:** ✅ Реализовано — функция `applyDefaultMcpServers` добавлена в `src/config/defaults.ts`, вызывается в трёх цепочках `src/config/io.ts`.
  - **Детали:** Автоматически добавляет `one-search` с DuckDuckGo при первом запуске (если нет других MCP-серверов).

### P2
- [x] Доработать UX вкладки `Агенты`: упрощено объяснение «основная/запасные модели» прямо в форме.
  - **Файл:** `ui/src/ui/views/agents.ts`, функция `renderAgentOverview`
  - **Детали:** inline-подсказки под полями, callout-блок «Да работают модели», конкретный placeholder для запасных моделей.
- [x] Вынести тексты подсказок Telegram в единый мини-гайд внутри карточки (без перегруза интерфейса).
  - **Файл:** `ui/src/ui/views/channels.telegram.ts`, `ui/src/styles/components.css`
  - **Детали:** Сокращены inline-подсказки, добавлен `<details>` с 5-шаговой инструкцией и заметкой о безопасности.

## Как работать в новых сессиях Codex

- Всегда начинать с локального пути проекта: `/Users/fedorovstas/Projects/YandexAgetn`.
- Всегда указывать ветку для работы: например `main` или `codex/<task-name>`.
- Формулировать задачу сразу с ожидаемым результатом: «починить X, закоммитить, запушить, дать PR».
- GitHub-ссылку использовать как контекст (`origin` и база PR), а не как замену локальному workspace.
- Репозиторий проекта: `https://github.com/fedorovstas1991-ship-it/YA-Proj`.
- Весь workflow и исторический контекст хранится в этом файле: `YANDEXAGETN.md`.

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

# Автоматическая сборка (рекомендуется) - проверяет зависимости,
# устанавливает пакеты, синхронизирует skills, собирает UI
./scripts/build-autonomous.sh

# Или пошагово:
pnpm install              # Установка зависимостей
./scripts/sync-skills.sh  # Синхронизация из ../superpowers
pnpm build               # Сборка TypeScript (если нужно)
node scripts/ui.js build # Сборка Control UI
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
# Проверить изоляцию и полноту компонентов
./scripts/verify-isolation.sh

# Запустить все тесты
pnpm test                 # Unit тесты
pnpm test:integration     # Integration тесты autonomous setup
pnpm test:e2e:autonomous  # E2E тесты onboarding flow
pnpm test:autonomous      # Полное тестирование (все выше + verify)
```

### Созданные скрипты

**Сборка и синхронизация:**
- `./scripts/build-autonomous.sh` - полная автоматическая сборка
- `./scripts/sync-skills.sh` - синхронизация skills из Superpowers

**Проверка и тестирование:**
- `./scripts/verify-isolation.sh` - проверка автономности
- `./scripts/test-autonomous-setup.sh` - CI/CD полное тестирование

**Тесты:**
- `test/integration/autonomous-setup.test.ts` - integration тесты
- `test/e2e/onboarding-autonomous.test.ts` - E2E тесты onboarding

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

**Gateway не запускается / порт 18789 занят:**

Конкурирующие LaunchAgent-ы захватывают порт. Проверить и отключить:
```bash
launchctl list | grep openclaw
# Отключить глобальный gateway если активен:
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl unload ~/Library/LaunchAgents/ai.openclaw.node.plist
# Освободить порт принудительно:
lsof -tiTCP:18789 -sTCP:LISTEN | xargs kill -9
```

**Telegram не подключается / "канал не настроен":**

Проверить три условия в `~/.YA-yagent/openclaw.json`:

1. Файлы плагина присутствуют:
   - `extensions/telegram/openclaw.plugin.json`
   - `extensions/telegram/index.ts`

2. Плагин включён:
```json
"plugins": {
  "slots": { "memory": "memory-core" },
  "entries": {
    "telegram": { "enabled": true },
    "memory-core": { "enabled": true }
  }
}
```

3. Канал включён:
```json
"channels": { "telegram": { "enabled": true, "botToken": "..." } }
```

UI может сбросить `plugins.slots.memory` на `"none"` при сохранении конфига — проверять после изменений через UI.

**"Telegram сконфигурирован, но канал еще запускается" в UI:**

Это нормально сразу после рестарта gateway — бот стартует ~5–15 сек. Probe-таймаут в UI — 30 сек. Если ошибка остаётся дольше, нажать «Проверить статус» или проверить логи:
```bash
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -v DEBUG
```

**Память не работает / "plugin disabled (memory slot disabled)":**

```bash
node -e "
const fs=require('fs'), p=require('os').homedir()+'/.YA-yagent/openclaw.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.plugins.slots.memory='memory-core';
c.plugins.entries['memory-core']={enabled:true,config:{timezone:'Europe/Moscow',language:'ru'}};
fs.writeFileSync(p,JSON.stringify(c,null,2));
"
```

**Ollama не найдена:**
```bash
# Установить Ollama
brew install ollama

# Или скачать с https://ollama.ai
```

## Куда править
- Telegram UI/flow: `ui/src/ui/views/channels.telegram.ts`, `ui/src/ui/app.ts`
- Чат + CTA + NDA-переключатель: `ui/src/ui/views/chat.ts`, `ui/src/ui/app-render.ts`, `ui/src/ui/app-render-product.ts`
- Агенты (модели/лейблы): `ui/src/ui/views/agents.ts`
- Стили сообщений: `ui/src/styles/chat/grouped.css`
- Стили compose/layout: `ui/src/styles/chat/layout.css`
- Глобальные компоненты (code block): `ui/src/styles/components.css`
- Markdown рендер: `ui/src/ui/markdown.ts`
- Онбординг/пресеты: `src/onboarding/*`, `yagent-onboard-ui.command`
