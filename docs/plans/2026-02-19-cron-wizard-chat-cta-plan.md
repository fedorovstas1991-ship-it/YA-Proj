# Cron Wizard + Chat CTA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Добавить понятный пошаговый мастер для cron-задач + гибридную подсказку «можно через чат», и CTA под первым приветствием для Telegram/быстрого старта.

**Architecture:** Оставляем backend API без изменений (`cron.add/list/status`). Весь новый UX реализуется на фронте: state-мастер, mapper «человеческих» расписаний в cron payload, обновленный рендер `Планировщика`, и CTA-блок в чате. Старая форма сохраняется как `Расширенный режим`.

**Tech Stack:** TypeScript, Lit, Vitest, существующие UI controllers/views.

---

### Task 1: Ввести типы и state для Cron-мастера

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/ui-types.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-defaults.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-view-state.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app.ts`

**Step 1: Write the failing test (state defaults)**

```ts
// ui/src/ui/views/cron.test.ts
it("shows wizard by default", () => {
  const props = createProps();
  expect(props.wizard.mode).toBe("guided");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/cron.test.ts`
Expected: FAIL (wizard state does not exist yet).

**Step 3: Write minimal implementation**

```ts
// ui-types.ts
export type CronWizardState = {
  mode: "guided" | "advanced";
  step: 1 | 2 | 3 | 4;
  scenario: "reminder" | "auto_event";
  schedulePreset: "in" | "daily" | "weekdays";
  inAmount: string;
  inUnit: "minutes" | "hours";
  dailyTime: string; // HH:MM
  weekDays: number[]; // 1..7
  weekTime: string; // HH:MM
  text: string;
  error: string | null;
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/cron.test.ts`
Expected: PASS for new default checks.

**Step 5: Checkpoint (local-only)**
- Зафиксировать, что Git-коммиты пропущены по текущему требованию «работаем локально».

### Task 2: Сделать mapper из wizard в `cron.add` payload

**Files:**
- Create: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/controllers/cron-wizard.ts`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/controllers/cron-wizard.test.ts`

**Step 1: Write the failing test (preset -> schedule mapping)**

```ts
it("maps 'daily 09:30' to cron schedule", () => {
  const payload = buildCronJobFromWizard({ schedulePreset: "daily", dailyTime: "09:30", ... });
  expect(payload.schedule).toEqual({ kind: "cron", expr: "30 9 * * *", tz: expect.any(String) });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/controllers/cron-wizard.test.ts`
Expected: FAIL (file/function missing).

**Step 3: Write minimal implementation**

```ts
export function buildCronJobFromWizard(w: CronWizardState): CronAddParams {
  if (w.schedulePreset === "in") {
    const deltaMs = Number(w.inAmount) * (w.inUnit === "hours" ? 3_600_000 : 60_000);
    return { schedule: { kind: "at", at: new Date(Date.now() + deltaMs).toISOString() }, ... };
  }
  if (w.schedulePreset === "daily") {
    const [hh, mm] = w.dailyTime.split(":").map(Number);
    return { schedule: { kind: "cron", expr: `${mm} ${hh} * * *`, tz: localTz() }, ... };
  }
  const [hh, mm] = w.weekTime.split(":").map(Number);
  const days = [...w.weekDays].sort((a, b) => a - b).join(",");
  return { schedule: { kind: "cron", expr: `${mm} ${hh} * * ${days}`, tz: localTz() }, ... };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/controllers/cron-wizard.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 3: Перерисовать вкладку Планировщик под мастер + сноску

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/views/cron.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/styles/components.css`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/views/cron.test.ts`

**Step 1: Write the failing test (wizard content + footnote)**

```ts
it("renders guided scheduler and chat footnote", () => {
  render(renderCron(props), container);
  expect(container.textContent).toContain("Пошаговая настройка");
  expect(container.textContent).toContain("можно через чат");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/cron.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Добавить UI шагов + прогресс.
- Добавить переключатель `Пошагово / Расширенный режим`.
- В расширенном режиме рендерить существующую форму (без удаления).
- Добавить кнопку `Сформулировать в чате` и callback `onDraftInChatTemplate`.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/cron.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 4: Подключить wizard submit к текущему cron controller

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/controllers/cron.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app.ts`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/controllers/cron-wizard.test.ts`

**Step 1: Write the failing test (submit calls `cron.add` with mapped payload)**

```ts
it("submits wizard as cron.add payload", async () => {
  await addCronJobFromWizard(state);
  expect(client.request).toHaveBeenCalledWith("cron.add", expect.objectContaining({
    sessionTarget: "main",
    wakeMode: "now",
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/controllers/cron-wizard.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Добавить `addCronJobFromWizard(state)`.
- По успеху: refresh `cron.list` + `cron.status`, сброс мастера в шаг 1.
- По ошибке: русское сообщение + details.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/controllers/cron-wizard.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 5: CTA под первым приветствием в чате

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/views/chat.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-product.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/styles/chat/layout.css`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/views/chat.test.ts`

**Step 1: Write the failing test (CTA block exists in first-open state)**

```ts
it("renders onboarding CTA under first greeting", () => {
  render(renderChat(createProps({ showFirstGreetingCta: true })), container);
  expect(container.textContent).toContain("Подключить Telegram");
  expect(container.textContent).toContain("Сформулировать в чате");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/chat.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- В `ChatProps` добавить поля CTA + callbacks.
- Рендерить CTA после первого приветствия только при `Telegram not configured`.
- Обработчики:
  - `Подключить Telegram` -> переключение на панель Telegram.
  - `Сформулировать в чате` -> подставить шаблон текста в draft.
  - `Позже` -> скрыть CTA для текущей сессии.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/chat.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 6: Финальная интеграционная проверка и smoke

**Files:**
- Modify (if needed): `/Users/fedorovstas/Projects/YandexAgetn/yagent-onboard-ui.command`

**Step 1: Run focused UI tests**

Run:
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/controllers/cron-wizard.test.ts`
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/cron.test.ts`
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/views/chat.test.ts`

Expected: PASS.

**Step 2: Build UI**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui build`
Expected: build success.

**Step 3: Run local launcher**

Run: `cd /Users/fedorovstas/Projects/YandexAgetn && ./yagent-onboard-ui.command`
Expected: gateway up, onboarding URL opened, no `pnpm ENOENT`, chat responds.

**Step 4: Manual UX smoke**
- Создать задачу через мастер (каждый день).
- Создать задачу по дням недели.
- Нажать `Сформулировать в чате` и убедиться в заполнении draft.
- Проверить CTA под первым приветствием и переход в Telegram.

**Step 5: Checkpoint (local-only)**
- Итог без git-операций, по текущему требованию.

---

## Notes
- Использовать @test-driven-development для каждой поведенческой правки.
- Для багов во время реализации применять @systematic-debugging.
- Не удалять старую cron-форму: только прятать в `Расширенный режим`.
