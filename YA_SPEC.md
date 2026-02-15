# YA iPhone-Style Product UI — Полное ТЗ

## Контекст
Форк OpenClaw. Цель: менеджер скачал скрипт → запустил → получил UI с онбордингом (как Claude for Work на минималках). Без терминала, всё кнопками.

## 1. uiMode + навигация
- `/` открывает Product UI по умолчанию
- Dev mode через кнопку "Для разработчиков" (`?dev=1` + internal state)
- `app-render-product.ts` — новый рендер
- Legacy UI остаётся, но ссылки скрыты до dev drawer
- В product UI нет ссылок на /channels, /config, /logs пока не открыть dev drawer

## 2. Layout (3 колонки)
- **Icon rail** (64px): 💬 Новый чат, 📁 Проекты, 🔌 Telegram, </> Для разработчиков
- **Sidebar** (280px): список проектов (agents) + "Создать проект" ИЛИ список чатов
- **Main**: чат / домашний экран / экран Telegram

## 3. Проекты = Agents
- Кнопка "Создать проект" → модалка: название + описание
- Backend: `agents.create({ name, workspace })` + `agents.files.set` для persona
- Switching: `activeAgentId` → default chat: `agent:<agentId>:main`

## 4. Чаты = Subagent sessions
- Кнопка "Новый чат" (без команд)
- `sessionKey = agent:<agentId>:subagent:<uuid>`
- `sessions.patch({ label: "Чат N", spawnedBy: "agent:<agentId>:main" })`
- После создания → `chat.greet` (AI пишет первым)
- Листинг: `sessions.list({ agentId, includeDerivedTitles: true, includeLastMessage: true })`
- В UI: label || derived title || "Чат …"

## 5. Кнопки в чате (всегда видны, без slash-команд)
- **Новый чат**: создаёт subagent session + chat.greet
- **Сбросить чат**: `sessions.reset({ key })` + chat.greet({ reason: "reset" })
- **Вложения**: file picker + drag&drop + paste
- **Стоп**: `chat.abort({ sessionKey, runId? })`
- Slash-команды скрыты из UX (но работают если ввести вручную)

## 6. Новый gateway RPC: `chat.greet`
```typescript
// Method: chat.greet
// Params: { sessionKey: string, reason?: "new_chat" | "reset" | "first_open" }
// Запускает greeting без user-message в истории
// Appends assistant message в transcript
// Broadcasts chat event как final
// Idempotency: idempotencyKey или runId = "greet:<uuid>"
```
Добавить в `src/gateway/rpc/` рядом с chat.send/chat.inject

## 7. Вложения
UX: Picker + drag&drop + paste. Preview: images thumbnail, файлы chip (name, type, size).
Transport: `chat.send.attachments[]: { mimeType, fileName, content (base64) }`

Gateway parsing (`chat-attachments.ts`):
- `image/*` → images[] для модели (как сейчас)
- `application/pdf`, `text/*`, `application/json`, `text/csv`, `text/html` → extractFileContentFromSource (input-files.ts), добавить text в message + PDF images в images[]
- прочие типы (docx/pptx/mp4) → saveMediaBuffer (store.ts), добавить "файл сохранён: <id/path>" в message
- Limits: image max 10MB, file max 5MB, показать ошибки пользователю

## 8. Telegram подключение (один на gateway, allowlist)
UX — экран Telegram:
- Статус
- "Подключить Telegram": шаг 1: bot token → шаг 2: allowlist (user id) → Применить → "готово"
Backend: `config.patch(channels.telegram.*)` + binding channel telegram → agentId=main, config.apply

## 9. Reset + тест "с самого начала"
В dev drawer: кнопка "Сбросить всё":
- onboarding reset flow (scope full) + перезапуск gateway
После сброса product UI предлагает:
1. "Ввести Eliza API key"
2. "Создать проект"
3. "Подключить Telegram"

## 10. Tests
Gateway unit tests:
- `chat.greet`
- attachments parsing: image/pdf/text/other

UI render tests:
- панель кнопок

E2E сценарий:
чистый старт → eliza → проект → новый чат (assistant first) → reset → attachments → telegram setup

## Acceptance Criteria
- Product UI на `/`, iPhone-style, без команд как управляющего UX
- Новый чат/Сброс/Вложения/Стоп работают как кнопки
- Ассистент пишет первым через chat.greet (без /new в истории)
- Вложения: images → vision, PDF/текст → prompt, прочие файлы → save
- Все сложные настройки только через "Для разработчиков"

## Assumptions
- "Проект" = agent, "чат" = session (subagent для новых)
- Inbound Telegram → main agent; маршрутизация в проекты — через промпт/скиллы

## Test token (Telegram/gateway)
y1__xDov6eRpdT-ARiuKyDpl44DT3on8HFfT7P5dVdzNxBTw-Y5WYI

## Контекст репо
- Репо: /root/.openclaw/workspace/YA
- Технический отчёт: /root/.openclaw/workspace/TECHNICAL_REPORT_YA_FORK.md
- git remote: git@github.com:fedorovstas1991-ship-it/YA.git
- Стек: TypeScript, Lit, pnpm, Node.js 22
