# Memory-core: поэтапное внедрение, дизайн и структура

## 0) Цель и ограничения
- Полностью локальная память (VPS), без внешних сервисов.
- Логи по дням: `~/.openclaw/agents/main/memory/YYYY-MM-DD.md`.
- Долгосрочная память: `~/.openclaw/agents/main/MEMORY.md`.
- Индексация через QMD каждые 5 минут, векторизация отдельно.
- Индексируются только последние 90 дней + `MEMORY.md`.
- Автопромоушен каждые 6 часов.
- Язык: русский, таймзона: Europe/Moscow.
- Fallback (при падении семантики): текстовый поиск + явное предупреждение.

## 1) Архитектура (кратко)
```
conversation -> daily-log (append)
              -> recent-index (hardlink, 90 дней)
              -> promote (rules) -> MEMORY.md

QMD:
  memory/recent + MEMORY.md -> qmd update -> qmd embed -> qmd query
```

## 2) Структура кода (основные файлы)
**Расширение memory-core (extensions/memory-core):**
- `config.ts` — схема/парсинг конфига (добавлен `promote.mode` = rules/ollama).
- `index.ts` — сервис/хуки: планировщик промоушена, индекс recent, захват данных.
- `daily-log.ts` — запись в дневной лог по таймзоне.
- `state.ts` — JSON‑состояние (lastPromotedAt и т.д.).
- `capture.ts` — извлечение “кандидатов” из диалога.
- `promote.ts` — промоушен в MEMORY.md.
- `recent-index.ts` — hardlink “последних 90 дней” для QMD.
- `ollama.ts` — клиент Ollama (используется только в режиме ollama).
- `openclaw.plugin.json` — schema для конфига плагина.

**Встроенная память (core):**
- `src/memory/qmd-manager.ts` — обвязка QMD (update/embed/query, XDG пути и т.п.).
- `src/agents/tools/memory-tool.ts` — fallback‑предупреждение при падении семантики.

## 3) Конфиг memory-core (актуально)
```jsonc
plugins.entries.memory-core.config = {
  "timezone": "Europe/Moscow",
  "language": "ru",
  "memoryDir": "memory",
  "memoryFile": "MEMORY.md",
  "recent": { "maxDays": 90 },
  "promote": {
    "intervalHours": 6,
    "aggressiveness": "broad",
    "mode": "rules" // <-- без Ollama
  },
  "clarify": { "minMessages": 20 },
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "model": "qwen2.5:3b-instruct",
    "timeoutMs": 30000
  }
}
```

> В режиме `rules` Ollama не вызывается, все новые записи автоматически промоутятся.

## 4) Пошагово: что было настроено
1. **QMD**
   - Установлен `@tobilu/qmd` через npm global (`/usr/bin/qmd`).
   - XDG пути QMD вынесены в агент‑директории:
     - `~/.openclaw/agents/main/qmd/xdg-config`
     - `~/.openclaw/agents/main/qmd/xdg-cache`
   - Коллекции:
     - `memory-recent` → `~/.openclaw/agents/main/memory/recent/**.md`
     - `memory-root` → `~/.openclaw/agents/main/MEMORY.md`

2. **Memory-core**
   - Добавлены/подключены daily log, recent index, promote и state.
   - Сервис в `index.ts` запускает:
     - `syncRecentIndex` (6h)
     - `promoteEntries` (каждые 6h)
   - Добавлен `promote.mode = rules`, чтобы убрать зависимость от Ollama.

3. **Fallback предупреждение**
   - В `memory-tool.ts` отображается предупреждение при падении qmd query.

4. **Промоушен без Ollama**
   - В `promote.ts` добавлена ветка `rules`: все новые записи идут в MEMORY.md.
   - `openclaw.json` обновлён: `promote.mode = "rules"`.
   - Схема плагина обновлена (`openclaw.plugin.json`), и копия синхронизирована в `/usr/lib/node_modules/openclaw/extensions/memory-core/`.

## 5) Проверка полного цикла
- Скрипт: `tmp/simulate-memory-cycle.ts` (локальный прогон)
- Результат: записи попали в `MEMORY.md`.

## 6) Текущее состояние
- **Оллама не нужна** (rules mode).
- **QMD embed** работает на CPU.
- **QMD query** иногда падает `SIGKILL` (вероятно OOM при query expansion).

## 7) Известные проблемы
- QMD `query` → SIGKILL на VPS (мало RAM/CPU).
  - Варианты: меньшая модель для query expansion, снижение параллелизма, swap.

## 8) Как вручную прогнать цикл
```bash
# 1) Append (любой текст в дневной лог)
# 2) Промоушен (rules):
#    выполняется сервисом каждые 6 часов

# 3) Индексация и эмбеддинги
XDG_CONFIG_HOME=... XDG_CACHE_HOME=... qmd update
XDG_CONFIG_HOME=... XDG_CACHE_HOME=... qmd embed

# 4) Поиск
XDG_CONFIG_HOME=... XDG_CACHE_HOME=... qmd query "запрос"
```

---
Если хочешь — расширю документ под формат “инструкции для развертывания с нуля”.
