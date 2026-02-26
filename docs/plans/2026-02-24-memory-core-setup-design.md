# Design: Включение memory-core

Date: 2026-02-24

## Цель

Автоматически собирать контекст задач при каждом компакте, чтобы агент не терял информацию в длинных сессиях.

## Архитектура

Два компонента работают вместе:

- **Ollama** (memory-core plugin) — пишет: после каждого сообщения извлекает факты/решения/задачи → daily log, при компакте промоутит → обновляет MEMORY.md
- **QMD** — читает: индексирует те же файлы, предоставляет агенту инструменты `memory_search` / `memory_get`

Каждый агент (main, nda, будущие) пишет в свой workspace:
- `~/.YA-yagent/workspace/<agentId>/MEMORY.md`
- `~/.YA-yagent/workspace/<agentId>/memory/YYYY-MM-DD.md`

QMD автоматически использует workspace каждого агента — хардкоженные пути не нужны.

## Изменения

### 1. `~/.YA-yagent/openclaw.json`

**`memory` секция** — упростить (убрать хардкоженные пути, оставить только backend):
```json
"memory": {
  "backend": "qmd"
}
```

**`plugins.slots.memory`** — `"none"` → `"memory-core"`

**`plugins.entries.memory-core`** — добавить `"enabled": true`:
```json
"memory-core": {
  "enabled": true,
  "config": {
    "timezone": "Europe/Moscow",
    "language": "ru"
  }
}
```

### 2. `extensions/memory-core/index.ts`

В обработчике `agent_end` — capture только последнего обмена (не всей истории):

```ts
// Было:
const transcript = buildTranscript(event.messages);

// Станет:
const lastExchange = extractLastExchange(event.messages);
const transcript = buildTranscript(lastExchange);
```

`extractLastExchange` берёт последний `user` + последний `assistant` из конца массива.

**Причина:** без этой правки Ollama получает всю историю сессии при каждом сообщении → дубли в daily log + растущее время обработки.

## Почему не удаляем memory секцию

Без `memory.backend = "qmd"` дефолт = `"builtin"` (vector embeddings) — не работает без настройки embedding-модели.

## Требования

- Ollama запущена: `http://127.0.0.1:11434`
- Модель: `qwen2.5:7b-instruct` (уже скачана)

## Поведение при недоступной Ollama

Capture и promote падают с `warn` в логах, агент продолжает работать. `memory_search` через QMD не зависит от Ollama.
