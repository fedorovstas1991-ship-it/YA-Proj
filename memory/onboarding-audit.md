# Onboarding Audit — 2026-02-13

**Repo:** /root/.openclaw/workspace/YA  
**Commit audited:** `67fd5f9f6 Product UI, greet RPC, attachments, onboarding`  
**Fix commit:** `c583b08bb fix(onboarding): render wizard step inline in product UI`

---

## Что реализовано и работает

### Backend (gateway)
- **`chat.greet` RPC** — полноценный хендлер в `src/gateway/server-methods/chat.ts`. Вызывает `/new` команду через `dispatchInboundMessage`, записывает ответ в транскрипт, бродкастит через WebSocket. Idempotency key, дедупликация, abort — всё есть.
- **`chat.inject` RPC** — инъекция сообщения в транскрипт от имени ассистента (без вызова LLM).
- **`wizard.start` RPC** — поддерживает `flow: "eliza"` (один шаг: текстовый ввод API key → патч конфига → готово). Purge запущенной wizard-сессии при старте нового "simple" flow.
- **`ChatGreetParamsSchema`** — зарегистрирован в протоколе, в server-methods-list.ts, типы экспортированы.

### Frontend (UI)
- **`ui/src/ui/controllers/onboarding.ts`** — полный контроллер: `startOnboardingWizard`, `advanceOnboardingWizard`, `cancelOnboardingWizard`, `setOnboardingWizardDone`. Нормализация статуса, hydration ответов для шагов.
- **`ui/src/ui/app.ts`** — все product* методы: `productNewChat`, `productResetChat`, `productOpenSession`, `productSelectAgent`, `productLoadSessions`, `productCreateProject`, `productConnectTelegram`, `productGreet`, `productEnsureChatLoaded`, `productReloadConfig`, `productResetAll`.
- **`ui/src/ui/app-render-simple.ts`** — полная wizard step UI (select, text, confirm, multiselect, note). Используется в Simple UI.
- **`ui/src/ui/app-render-product.ts`** — Product UI с rail-боковушкой, проектами, сессиями, чатом, Telegram-панелью, dev drawer.
- **`simpleOnboardingDone`** — персистируется в localStorage, проверяется при загрузке.
- **Attachments в чате** — полная поддержка: drag-and-drop, file picker, base64 конверсия, лимит 5MB.
- **`chat.greet`** вызывается из `productGreet()` при: новом чате, сбросе, первом открытии пустого чата.

---

## Что было сломано / не хватало (и что починено)

### Главный баг: wizard step UI не отображался в Product UI

**Проблема:** В `app-render-product.ts`, когда wizard запускался и возвращал шаг (ввод Eliza API key), вместо UI отображался только placeholder:
```html
<div class="callout">Следуй шагу вверху окна (wizard)…</div>
```
Пользователь видел эту бесполезную надпись, не имея способа ввести API key. Онбординг полностью "застревал".

**Исправление:**
- Убрана заглушка
- Добавлен inline wizard step рендер: title, message, password input (sensitive=true), Enter key handler
- Кнопка "Продолжить" задизейблена пока поле пустое
- Добавлена обработка `note`/`action` шагов через кнопку "OK"

### Баг: "Старт" кнопка видна пока wizard уже запущен

**Проблема:** Кнопка "Старт" показывалась даже когда wizard уже в статусе "running" — можно было случайно запустить повторно.

**Исправление:** Кнопка прячется при `status === "running"`.

### Незавершённые CSS-анимации (pre-existing uncommitted change)

**Проблема:** В `product.css` были незакоммиченные изменения: `.product-dev-drawer { opacity: 0 }` и `.product-modal-backdrop { opacity: 0 }` + классы `.open { opacity: 1 }`. Но Lit-рендер создаёт/удаляет элементы условно (`nothing` vs `html`), а класс `.open` нигде не добавлялся. Результат: drawer и modal стали бы **невидимы** при открытии.

**Исправление:** CSS-анимации переделаны через `@keyframes product-slide-in / product-fade-in` — они автоматически запускаются при вставке элемента в DOM (совместимо с Lit conditional rendering). Нет зависимости от `.open` класса.

---

## Что ещё может потребоваться

1. **Confirm/select step types в Product UI** — добавлена заглушка через `nothing` для нераспознанных типов шагов. Если у eliza-флоу появятся confirm/select шаги — нужно добавить рендер.

2. **Проверка конфига после онбординга** — после `wizard.done` Product UI вызывает `productEnsureChatLoaded` → `productGreet("first_open")`. Если gateway не успел перезапуститься с новым конфигом — greet-запрос может упасть. Нет retry или ожидания перезагрузки.

3. **Сессия при первом входе** — `productEnsureChatLoaded` вызывается в `updated()` только при `(connectedChanged || agentsChanged)`. Если connected=true и agentsList уже загружен до render product-mode, сессия не загрузится. Нужна инициализация в `connectedCallback` для product mode.

4. **`config.patch` в `productConnectTelegram`** — использует `baseHash` из `configSnapshot`. Если пользователь нажал "Telegram" без предварительного `productReloadConfig`, `configSnapshot === null` и показывается ошибка. Было бы лучше автоматически загружать конфиг перед патчем.

5. **Нет индикатора "gateway перезапускается"** после Telegram-подключения — только текст "Telegram подключен. Gateway перезапускается." Можно добавить polling статуса.

6. **TypeScript проверка** — `pnpm`/`tsgo` не установлены в sandbox, проверка типов не выполнялась. Нужно проверить при наличии среды.
