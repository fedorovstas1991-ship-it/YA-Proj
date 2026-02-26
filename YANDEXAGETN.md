# YAgent: текущий статус и бэклог

Обновлено: 2026-02-26 (фикс wildcard allowlist для bundled skills, починен Telegram-плагин, включена память, NDA dual-bot)

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
- Скрипт локального старта `yagent-onboard-ui.command` запускает UI/gateway с чистым профилем для тестов (включая очистку localStorage через URL-параметр).
- Рабочий каталог профиля для локального сценария: `~/.YA-yagent`.
- Скриншоты/изображения в чате: работают (вложение доходит до модели).
- Технические бэкапы и мусорные артефакты вынесены из рабочих путей в `ignored-unused/`.
- **Автономная локальная сборка реализована (2026-02-24):**
  - Superpowers skills bundled в `./skills/` (14 skills)
  - Скрипты автоматизации: `build-autonomous.sh`, `sync-skills.sh`, `verify-isolation.sh`
  - Integration и E2E тесты для проверки autonomous setup
  - Полная изоляция от global OpenClaw и GitHub openclaw
  - CI/CD скрипт: `test-autonomous-setup.sh`
- Скрипт `yagent-onboard-ui.command` при сбросе профиля создаёт начальный `openclaw.json` с:
  - `agents.list` — агенты `main` (Обычный) и `nda` (NDA) с workspace и моделями;
  - `skills.allowBundled = ["*"]` — разрешены все bundled скиллы;
  - `mcpServers` — `one-search` (DuckDuckGo, autostart через npx);
  - `plugins.slots.memory = "memory-core"` — автоматическая память через Ollama.
- **Фикс blocked allowlist для встроенных skills (2026-02-26):**
  - **Причина:** wildcard `skills.allowBundled=["*"]` не учитывался в проверке allowlist, поэтому UI показывал `заблокирован allowlist` для bundled skills.
  - **Фикс:** в `isBundledSkillAllowed` добавлена поддержка `*` как allow-all для `openclaw-bundled`.
  - **Проверка:** добавлен регрессионный тест `treats wildcard bundled allowlist as allow-all`.
- **Память включена (2026-02-24):**
  - `plugins.slots.memory = "memory-core"` + `enabled: true` в `plugins.entries`.
  - `memory.backend = "qmd"` — QMD читает из workspace каждого агента автоматически (без хардкоженных путей).
  - После каждого сообщения Ollama (`qwen2.5:7b-instruct`) извлекает факты/решения/задачи → daily log.
  - При компакте: промоушен → обновляет `MEMORY.md` агента.
  - Каждый агент (main, nda, будущие) пишет в свой workspace — изолированно.
  - Capture исправлен: Ollama получает только последний обмен (не всю историю) — нет дублей, нет роста нагрузки.
- **Telegram-плагин восстановлен и включён (2026-02-24):**
  - Воссозданы `extensions/telegram/openclaw.plugin.json` и `extensions/telegram/index.ts`.
  - В `~/.YA-yagent/openclaw.json` добавлена запись `plugins.entries.telegram.enabled = true`.
  - **Важно:** плагины из `extensions/` имеют origin `"bundled"` и **отключены по умолчанию** — без явного `enabled: true` в конфиге gateway их игнорирует. Это касается всех будущих плагинов в этой папке.
- **NDA-агент починен (2026-02-24):**
  - Переключение в NDA-режим больше не перезапускает gateway (если `nda_internal` уже настроен).
  - Telegram-панель разделена: отдельные секции «Обычный» и «NDA» — каждый агент может иметь своего бота.
  - Конфиг NDA-бота: `channels.telegram.accounts.nda` + binding `agentId: nda → accountId: nda`.
  - NDA Telegram CTA показывается только если NDA-бот не настроен (проверяет `channels.telegram.accounts.nda.botToken`).

## Текущее поведение модели
- Базовая модель (main): `openrouter/moonshotai/kimi-k2.5`.
- NDA-модель (агент `nda`): `qwen3_235b_a22b` через internal OpenAI-compatible endpoint.

## Бэклог

### P0 (Chat-First Redesign — в работе)

- [x] **Claude-стиль сообщений** — CSS-only:
- [x] **Floating compose bar + NDA-иконка в compose**
- [x] **Кнопка «Копировать» на каждом блоке кода**
- [x] **Компактный Telegram CTA banner + баг-фикс**

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

**Telegram не подключается / "канал не настроен":**

Два возможных источника проблемы:

1. Отсутствуют файлы плагина — проверить наличие:
   - `extensions/telegram/openclaw.plugin.json`
   - `extensions/telegram/index.ts`

2. Плагин не включён в конфиге — проверить `~/.YA-yagent/openclaw.json`:
```json
"plugins": {
  "entries": {
    "telegram": { "enabled": true }
  }
}
```
Без этой записи gateway видит плагин, но молча его игнорирует (все bundled-плагины отключены по умолчанию).

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
