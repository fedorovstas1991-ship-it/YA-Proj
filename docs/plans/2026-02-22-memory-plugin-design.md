# Дизайн: Плагин памяти с QMD + Local Embeddings

## Дата
2026-02-22

## Контекст
Необходимо реализовать плагин памяти для агента, чтобы автоматически сохранять важную информацию из разговоров: имена, привычки, даты, структуры данных (YQL таблицы), задачи и контекст.

## Решение
Использовать OpenClaw memory plugin с QMD backend и локальными embeddings.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ memory-core  │──│    QMD       │──│ node-llama-cpp   │  │
│  │   plugin     │  │  sidecar     │  │  (local GGUF)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                                │
│         ▼                  ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Markdown файлы                       │   │
│  │  • memory/2026-02-22.md (daily log)                │   │
│  │  • memory/2026-02-21.md (вчера)                    │   │
│  │  • MEMORY.md (долгосрочная)                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Компоненты

### 1. QMD Backend
- Запускается как sidecar-процесс
- Объединяет BM25 (текстовый поиск) + векторный поиск + reranking
- Индексирует markdown файлы автоматически
- Хранит данные в `~/.openclaw/agents/main/qmd/`

### 2. Local Embeddings (node-llama-cpp)
- Загружает GGUF модель с HuggingFace при первом запуске
- Полностью локально — никаких API ключей
- Модель: `nomic-embed-text-v1.5.f16.gguf`

### 3. Файловая структура
```
workspace/
├── memory/
│   ├── 2026-02-22.md    # Сегодня (append-only)
│   ├── 2026-02-21.md    # Вчера
│   └── ...
└── MEMORY.md            # Долгосрочная память
```

### 4. Инструменты для агента
- `memory_search(query)` — семантический поиск
- `memory_get(path, lines)` — чтение файла
- `memory_write(path, content)` — запись

### 5. Автоматический flush
- Перед compaction сессии агент записывает важные факты
- Контролируется через `agents.defaults.compaction.memoryFlush`

## Конфигурация openclaw.json

```json
{
  "memory": {
    "backend": "qmd",
    "qmd": {
      "update": {
        "interval": "5m",
        "waitForBootSync": false
      },
      "searchMode": "search"
    }
  },
  "memorySearch": {
    "provider": "local",
    "local": {
      "modelPath": "nomic-embed-text-v1.5.f16.gguf"
    }
  },
  "agents": {
    "defaults": {
      "compaction": {
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000
        }
      }
    }
  }
}
```

## Поток работы

1. **Сессия стартует** → QMD индексирует memory файлы
2. **Разговор идёт** → Агент решает, что записать в память
3. **Запись** → `memory/YYYY-MM-DD.md` (задачи, факты) или `MEMORY.md` (важное)
4. **Поиск** → `memory_search("yql таблицы")` находит релевантные заметки
5. **Compaction** → Автоматический flush важных воспоминаний

## Требования к установке

- **Bun**: `curl -fsSL https://bun.sh/install | bash`
- **QMD CLI**: `bun install -g https://github.com/tobi/qmd`
- **SQLite с extensions**: `brew install sqlite` (macOS)

## Fallback

Если QMD не установлен — автоматический fallback на builtin SQLite backend.

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| QMD не установлен | Fallback на builtin SQLite |
| Первая загрузка модели долгая | Предварительная загрузка |
| Ресурсы CPU/RAM | Лёгкие модели (~100MB GGUF) |

## Принятое решение

- Backend: QMD
- Embeddings: Local (node-llama-cpp)
- Конфиг: В openclaw.json
- Структура: memory/*.md + MEMORY.md
