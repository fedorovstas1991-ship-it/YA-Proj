# Chat-First UI Redesign

**Date:** 2026-02-22
**Status:** Approved

## Цель

Переработать чат-окно и сопутствующий UI в стиле Claude.ai / ChatGPT:
- Чат занимает центральное место
- Минимум визуального шума вокруг
- Акцент на контенте, а не на хроме

## Решения (утверждены)

| Элемент | Решение |
|---|---|
| Компоновка | Подход 3: chat-first, sidebar не меняется структурно |
| Стиль сообщений | Claude-стиль (B): юзер — серый фон, ассистент — чистый текст |
| Compose-бар | Floating card (border-radius 16px, тень, max-width 760px) |
| NDA-переключатель | Иконка слева в compose-баре |
| Telegram CTA | Компактный banner под thread, скрывается если Telegram подключён |
| Code blocks | Кнопка «Копировать» на каждом блоке кода отдельно |

## Детали дизайна

### 1. Сообщения (Claude-стиль)

**Сообщение пользователя:**
- Лёгкий серый фон (`var(--bg-accent)`)
- Нет рамки, нет пузыря
- padding: 12px 16px, border-radius: 12px
- max-width: 85%, выравнивание текста слева

**Сообщение ассистента:**
- Белый/прозрачный фон — никакого выделения
- Просто текст с отступами
- Разделитель между сообщениями: `margin: 24px 0`

### 2. Compose-бар (floating card)

**Было:** белый бар на всю ширину с `border-top` и `background: #ffffff`

**Стало:**
- `background: transparent` на `.chat-compose`
- Внутри: `.chat-compose__wrapper` с `border-radius: 16px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.08)`, `border: 1px solid var(--border)`
- `padding: 12px 16px`
- Убрать `border-top` у `.chat-compose`
- Добавить `padding-bottom: 20px` для воздуха снизу

**Иконка NDA в compose-баре:**
- Кнопка-иконка левее textarea
- Активен NDA: иконка закрашена акцентным цветом (`var(--accent)`)
- Неактивен: серая
- Tooltip при hover: «Обычный режим» / «NDA режим»

### 3. Code blocks — кнопка Copy

**Каждый блок кода** получает header-полоску:
```
╔═══════════════════════════════════╗
│ typescript               [Copy] │
╠═══════════════════════════════════╣
│ const x = 1;                     │
╚═══════════════════════════════════╝
```

- Header: `background: var(--bg-accent)`, `border-bottom: 1px solid var(--border)`
- Кнопка «Copy»: при клике копирует только содержимое блока
- После копирования: «Copied ✓» на 2 секунды

**Файлы для изменения:** `markdown.ts` (или где рендерится markdown), `ui/src/styles/components.css`

### 4. Telegram CTA — compact banner

**Было:** карточка-в-чате `chat-first-greeting-cta` с заголовком и текстом

**Стало:**
- Тонкая полоска `48px` высотой
- Иконка + краткий текст + кнопка «Подключить»
- Класс `.chat-cta-banner`

**Баг-фикс:** скрывать, если у активного агента уже подключён канал Telegram.
- Файл: `ui/src/ui/views/chat.ts` или `app-render.ts`
- Логика: проверять `state.channels` для текущего агента

## Файлы для изменения

| Файл | Что меняется |
|---|---|
| `ui/src/styles/chat/layout.css` | `.chat-compose` (убрать border-top, фон), `.chat-compose__wrapper` (floating card) |
| `ui/src/styles/components.css` | Стили code block header + copy button, `.chat-cta-banner` |
| `ui/src/ui/markdown.ts` | Добавить copy-кнопку в рендер code blocks |
| `ui/src/ui/views/chat.ts` | NDA-иконка в compose, compact CTA banner, логика показа CTA |
| `ui/src/ui/app-render.ts` | Если chat.ts не покрывает — скорректировать рендер сообщений |

## Что НЕ меняется

- Структура sidebar (ширина, навигация)
- Rail (иконки слева)
- Routing / state management
- Топбар
