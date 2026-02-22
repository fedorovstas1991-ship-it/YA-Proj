# Memory Plugin (QMD + Local Embeddings) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Настроить OpenClaw memory plugin с QMD backend и локальными embeddings для автоматического сохранения контекста разговоров.

**Architecture:** Используем встроенный memory-core плагин OpenClaw с QMD в качестве backend. QMD запускается как sidecar и объединяет BM25 + векторный поиск + reranking. Embeddings генерируются локально через node-llama-cpp без API ключей.

**Tech Stack:** OpenClaw Gateway, QMD (Bun), node-llama-cpp, SQLite, Markdown

---

## Prerequisites Check

### Task 0: Проверить окружение

**Step 1: Проверить наличие Bun**

```bash
bun --version
```
Expected: версия (например, 1.0.x)

Если нет:
```bash
curl -fsSL https://bun.sh/install | bash
```

**Step 2: Проверить наличие SQLite с extensions**

```bash
sqlite3 --version
```
Expected: версия 3.x

Если нет (macOS):
```bash
brew install sqlite
```

**Step 3: Установить QMD CLI**

```bash
bun install -g https://github.com/tobi/qmd
```

Проверка:
```bash
qmd --version
```
Expected: версия QMD

---

## Configuration

### Task 1: Обновить openclaw.json

**Files:**
- Modify: `~/.YA-yagent/openclaw.json`

**Step 1: Сделать backup текущего конфига**

```bash
cp ~/.YA-yagent/openclaw.json ~/.YA-yagent/openclaw.json.backup.$(date +%Y%m%d_%H%M%S)
```

**Step 2: Добавить memory backend configuration**

Добавить в корень JSON:

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
  }
}
```

**Step 3: Добавить memoryFlush в agents.defaults**

Внутри `agents.defaults` добавить:

```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000,
          "systemPrompt": "Session nearing compaction. Store durable memories now.",
          "prompt": "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store."
        }
      }
    }
  }
}
```

**Step 4: Проверить валидность JSON**

```bash
openclaw --profile yagent config validate
```
Expected: `valid: true`

**Step 5: Применить конфигурацию**

```bash
# Через gateway config.patch
# Или перезапустить gateway
```

**Step 6: Commit изменений конфига (если он в git)**

```bash
git add ~/.YA-yagent/openclaw.json
git commit -m "config: add memory plugin with QMD backend and local embeddings"
```

---

## Workspace Setup

### Task 2: Создать структуру памяти в workspace

**Files:**
- Create: `/Users/fedorovstas/Projects/YandexAgetn/main/memory/.gitkeep`
- Create: `/Users/fedorovstas/Projects/YandexAgetn/main/MEMORY.md`

**Step 1: Создать директорию memory**

```bash
mkdir -p /Users/fedorovstas/Projects/YandexAgetn/main/memory
```

**Step 2: Создать MEMORY.md с заголовком**

```markdown
# Memory

Long-term memory for important facts, preferences, and context.

## People

## Projects

## Preferences

## Technical Notes
```

**Step 3: Создать сегодняшний daily log**

```bash
TODAY=$(date +%Y-%m-%d)
cat > /Users/fedorovstas/Projects/YandexAgetn/main/memory/${TODAY}.md << 'EOF'
# ${TODAY}

## Notes

## Tasks

## Context
EOF
```

**Step 4: Commit структуру**

```bash
git add /Users/fedorovstas/Projects/YandexAgetn/main/memory/ /Users/fedorovstas/Projects/YandexAgetn/main/MEMORY.md
git commit -m "feat: add memory file structure"
```

---

## Testing

### Task 3: Проверить работу memory plugin

**Step 1: Проверить статус памяти**

```bash
openclaw --profile yagent memory status
```
Expected: информация о backend, индексе, embeddings

**Step 2: Принудительно проиндексировать**

```bash
openclaw --profile yagent memory index --verbose
```
Expected: прогресс индексации файлов

**Step 3: Тестовый поиск**

```bash
openclaw --profile yagent memory search "test query"
```
Expected: результаты поиска (может быть пусто если память пуста)

**Step 4: Записать тестовую заметку**

```bash
TODAY=$(date +%Y-%m-%d)
echo "- Test memory entry: user prefers dark mode" >> /Users/fedorovstas/Projects/YandexAgetn/main/memory/${TODAY}.md
```

**Step 5: Проиндексировать и найти**

```bash
openclaw --profile yagent memory index
openclaw --profile yagent memory search "dark mode"
```
Expected: найдена запись про dark mode

---

## Integration

### Task 4: Проверить интеграцию с агентом

**Step 1: Перезапустить Gateway для применения конфига**

```bash
# Через gateway config.patch с пустым объектом для триггера рестарта
```

**Step 2: Проверить доступность memory tools**

В сессии с агентом проверить, что доступны:
- `memory_search(query)`
- `memory_get(path, lines)`

**Step 3: Тестовый запрос к памяти**

Спросить агента: "Что ты знаешь о моих предпочтениях?"

Expected: Агент использует memory_search для поиска информации.

**Step 4: Проверить автоматический flush**

Создать длинный контекст (>4000 токенов) или подождать compaction.

Expected: Перед compaction агент записывает важные факты в memory.

---

## Fallback Verification

### Task 5: Проверить fallback на builtin backend

**Step 1: Временно отключить QMD**

Изменить в openclaw.json:
```json
{
  "memory": {
    "backend": "builtin"
  }
}
```

**Step 2: Перезапустить Gateway**

**Step 3: Проверить поиск**

```bash
openclaw --profile yagent memory search "test"
```
Expected: Работает поиск через builtin SQLite backend.

**Step 4: Вернуть QMD**

```bash
# Вернуть "backend": "qmd" в конфиг
```

---

## Documentation

### Task 6: Обновить документацию

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/main/MEMORY.md`

**Step 1: Добавить инструкцию по использованию**

```markdown
# Memory

## Как работает память

Автоматически сохраняются:
- Имена и контакты
- Предпочтения ( dark mode, любимые инструменты)
- Структуры данных (YQL таблицы)
- Текущие задачи и проекты
- Важные даты

## Файлы

- `memory/YYYY-MM-DD.md` — ежедневные заметки
- `MEMORY.md` — долгосрочная память

## Поиск

Агент автоматически использует семантический поиск по памяти.
Или вручную: `openclaw memory search "query"`
```

**Step 2: Commit**

```bash
git add /Users/fedorovstas/Projects/YandexAgetn/main/MEMORY.md
git commit -m "docs: add memory usage instructions"
```

---

## Verification Checklist

- [ ] Bun установлен
- [ ] QMD CLI установлен
- [ ] SQLite с extensions установлен
- [ ] openclaw.json обновлён с memory backend
- [ ] memoryFlush настроен
- [ ] Структура файлов создана (memory/, MEMORY.md)
- [ ] Индексация работает
- [ ] Поиск работает
- [ ] Агент видит memory tools
- [ ] Fallback на builtin работает
- [ ] Документация обновлена

---

## Troubleshooting

### QMD не найден
```bash
which qmd
# Если пусто — добавить в PATH или переустановить
```

### Первая загрузка модели долгая
Нормально — QMD загружает GGUF модель с HuggingFace (~100MB).

### Ошибка SQLite
```bash
brew install sqlite
# Или для Linux: sudo apt-get install sqlite3 libsqlite3-dev
```

### Память не индексируется
Проверить права на запись в `~/.openclaw/agents/main/qmd/`

---

## Success Criteria

1. Агент автоматически сохраняет важную информацию из разговоров
2. Можно искать по памяти через `memory_search`
3. Работает семантический поиск (по смыслу, не только ключевые слова)
4. Не требуется API ключ для embeddings
5. Автоматический flush перед compaction
