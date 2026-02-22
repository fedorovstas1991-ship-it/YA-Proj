# YAgent: текущий статус и бэклог

Обновлено: 2026-02-22 (добавлен план Chat-First Redesign)

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
- Установлены Superpowers skills для агента (brainstorming, TDD, debugging, writing-plans и др.) в `~/.openclaw/workspace-yagent/skills/`.
- Скрипт `yagent-onboard-ui.command` при сбросе профиля создаёт начальный `openclaw.json` с:
  - `agents.list` — агенты `main` (Обычный) и `nda` (NDA) с workspace и моделями;
  - `skills.allowBundled = ["*"]` — разрешены все bundled скиллы;
  - `mcpServers` — `one-search` (DuckDuckGo, autostart через npx);
  - `plugins.slots.memory = "none"` — без памяти.

## Текущее поведение модели
- Базовая модель (main): `openrouter/moonshotai/kimi-k2.5`.
- NDA-модель (агент `nda`): `qwen3_235b_a22b` через internal OpenAI-compatible endpoint.

## Бэклог

### P0 (Chat-First Redesign — в работе)

- [ ] **Claude-стиль сообщений** — CSS-only:
  - Юзер: серый фон (`var(--bg-accent)`), rounded, без пузыря/рамки
  - AI: чистый текст, без фона
  - Файл: `ui/src/styles/chat/grouped.css`
  - План: `docs/plans/2026-02-22-chat-redesign-design.md`

- [ ] **Floating compose bar + NDA-иконка в compose** — убираем `border-top`, делаем floating card с тенью и `border-radius: 16px`. NDA-переключатель переезжает из шапки чата в иконку-щит слева в поле ввода.
  - Файлы: `ui/src/styles/chat/layout.css`, `ui/src/ui/views/chat.ts`

- [ ] **Кнопка «Копировать» на каждом блоке кода** — кастомный `marked` renderer добавляет header с lang + copy-кнопкой над `<pre>`. Клик копирует только код блока (не всё сообщение). 2-sec «Скопировано ✓» feedback.
  - Файлы: `ui/src/ui/markdown.ts`, `ui/src/styles/components.css`

- [ ] **Компактный Telegram CTA banner + баг-фикс** — заменить карточку `chat-first-greeting-cta` на тонкий баннер. Скрывать, если Telegram уже подключён к активному агенту (текущий баг: показывается даже после подключения).
  - Файлы: `ui/src/ui/views/chat.ts`, `ui/src/styles/chat/layout.css`
  - Новый prop `ChatProps.telegramConnected?: boolean` — передаётся из `app.ts`/`app-render.ts`

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

## Куда править
- Telegram UI/flow: `ui/src/ui/views/channels.telegram.ts`, `ui/src/ui/app.ts`
- Чат + CTA + NDA-переключатель: `ui/src/ui/views/chat.ts`, `ui/src/ui/app-render.ts`, `ui/src/ui/app-render-product.ts`
- Агенты (модели/лейблы): `ui/src/ui/views/agents.ts`
- Стили сообщений: `ui/src/styles/chat/grouped.css`
- Стили compose/layout: `ui/src/styles/chat/layout.css`
- Глобальные компоненты (code block): `ui/src/styles/components.css`
- Markdown рендер: `ui/src/ui/markdown.ts`
- Онбординг/пресеты: `src/onboarding/*`, `yagent-onboard-ui.command`
