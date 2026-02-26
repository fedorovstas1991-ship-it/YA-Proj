# Kimi 2.5 Onboarding + Default Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Перевести онбординг и дефолтную модель на Kimi 2.5 (OpenRouter через Eliza URL) и сделать экран токена понятным, прикладным и без кнопки пропуска.

**Architecture:** Вынести единый Kimi preset в отдельный модуль и использовать его в онбординг-компонентах, чтобы исключить рассинхрон текстов/patch-значений. UI-валидация токена выполняется в компоненте ввода, а `onboarding-wizard` строит `config.patch` только из preset.

**Tech Stack:** TypeScript, Lit web components, Vitest, текущий onboarding/UI поток.

---

### Task 1: Вынести единый Kimi preset

**Files:**
- Create: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/kimi-preset.ts`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/kimi-preset.test.ts`

**Step 1: Write the failing test (preset constants + token validator)**

```ts
import { describe, expect, it } from "vitest";
import {
  KIMI_PROVIDER,
  KIMI_BASE_URL,
  KIMI_MODEL_ID,
  KIMI_MODEL_REF,
  QUOTA_URL,
  isLikelyYandexQuotaToken,
} from "./kimi-preset.js";

describe("kimi preset", () => {
  it("exposes Kimi/OpenRouter defaults", () => {
    expect(KIMI_PROVIDER).toBe("openrouter");
    expect(KIMI_BASE_URL).toBe("https://api.eliza.yandex.net/raw/openrouter/v1");
    expect(KIMI_MODEL_ID).toBe("moonshotai/kimi-k2.5");
    expect(KIMI_MODEL_REF).toBe("openrouter/moonshotai/kimi-k2.5");
    expect(QUOTA_URL).toBe("https://ai.yandex-team.ru/quota");
  });

  it("validates y1_ token format", () => {
    expect(isLikelyYandexQuotaToken("y1__xDov6eRpdT1234567890")).toBe(true);
    expect(isLikelyYandexQuotaToken("sk-ant-123")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/kimi-preset.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

```ts
export const QUOTA_URL = "https://ai.yandex-team.ru/quota";
export const KIMI_PROVIDER = "openrouter";
export const KIMI_BASE_URL = "https://api.eliza.yandex.net/raw/openrouter/v1";
export const KIMI_MODEL_ID = "moonshotai/kimi-k2.5";
export const KIMI_MODEL_REF = "openrouter/moonshotai/kimi-k2.5";

export function isLikelyYandexQuotaToken(value: string): boolean {
  const v = value.trim();
  return v.startsWith("y1_") && v.length >= 16;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/kimi-preset.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем по требованию работы локально без git-операций.

### Task 2: Переписать экран ввода токена под реальный путь подключения

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/onboarding-api-key.ts`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/onboarding-api-key.test.ts`

**Step 1: Write the failing test (no Skip + disabled connect + quota hints)**

```ts
it("renders quota instructions and disables connect for invalid token", async () => {
  const el = document.createElement("onboarding-api-key") as OnboardingApiKey;
  document.body.appendChild(el);
  await el.updateComplete;

  expect(el.shadowRoot?.textContent).toContain("ai.yandex-team.ru/quota");
  expect(el.shadowRoot?.textContent).toContain("Получить токен");
  expect(el.shadowRoot?.querySelector(".btn-ghost")).toBeNull();

  const connectBtn = el.shadowRoot?.querySelector(".btn-primary") as HTMLButtonElement;
  expect(connectBtn.disabled).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-api-key.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Подключить preset-константы и validator.
- Обновить тексты (quota -> получить токен -> вставить `y1_...`).
- Удалить кнопку `Пропустить` и событие `skip-onboarding`.
- Сделать `Подключить` disabled до валидного токена.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-api-key.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 3: Перевести onboarding patch на OpenRouter + Kimi 2.5

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/onboarding-wizard.ts`
- Test: `/Users/fedorovstas/Projects/YandexAgetn/src/onboarding/onboarding-wizard.test.ts`

**Step 1: Write the failing test (patch payload)**

```ts
it("builds config.patch for openrouter/kimi-k2.5", async () => {
  // mock client.request(config.get/config.patch)
  // trigger _handleConnectApiKey with y1 token
  // assert config.patch raw contains provider=openrouter, baseUrl, model id/ref
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-wizard.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Импортировать preset-константы.
- Сформировать patch с:
  - `models.providers.openrouter.baseUrl = https://api.eliza.yandex.net/raw/openrouter/v1`
  - `api = openai-completions`
  - `models = [{ id: moonshotai/kimi-k2.5, name: Kimi K2.5 }]`
  - `agents.defaults.model.primary = openrouter/moonshotai/kimi-k2.5`
- Удалить legacy Sonnet-значения.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-wizard.test.ts`
Expected: PASS.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 4: Обновить связанные UI-лейблы/placeholder в product UI

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-product.ts`
- Test (if needed): `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-product.test.ts`

**Step 1: Write the failing test (labels/placeholder)**

```ts
it("shows neutral API key label and Kimi model placeholder", () => {
  // assert text contains "API ключ Eliza/OpenRouter"
  // assert model placeholder contains "moonshotai/kimi-k2.5"
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/app-render-product.test.ts`
Expected: FAIL on old text.

**Step 3: Write minimal implementation**
- Заменить `Anthropic API Key` на нейтральный лейбл.
- Заменить модельный placeholder на `moonshotai/kimi-k2.5`.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui test -- ui/src/ui/app-render-product.test.ts`
Expected: PASS targeted assertion.

**Step 5: Checkpoint (local-only)**
- Коммит пропускаем.

### Task 5: Интеграционная проверка end-to-end (локально)

**Files:**
- Modify (if needed): `/Users/fedorovstas/Projects/YandexAgetn/yagent-onboard-ui.command`

**Step 1: Run focused tests**

Run:
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/kimi-preset.test.ts`
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-api-key.test.ts`
- `pnpm -C /Users/fedorovstas/Projects/YandexAgetn test -- src/onboarding/onboarding-wizard.test.ts`

Expected: PASS.

**Step 2: Build UI**

Run: `pnpm -C /Users/fedorovstas/Projects/YandexAgetn/ui build`
Expected: build success.

**Step 3: Run launcher from zero**

Run: `cd /Users/fedorovstas/Projects/YandexAgetn && ./yagent-onboard-ui.command`
Expected:
- открывается onboarding,
- нет кнопки `Пропустить`,
- токен `y1_...` проходит,
- после подключения чаты работают.

**Step 4: Manual config smoke**
- Проверить в активном config snapshot:
  - provider `openrouter`,
  - baseUrl `https://api.eliza.yandex.net/raw/openrouter/v1`,
  - primary `openrouter/moonshotai/kimi-k2.5`.

**Step 5: Checkpoint (local-only)**
- Подтвердить итоги без git-операций.

---

## Notes
- Для каждой поведенческой правки использовать @test-driven-development.
- При любой неожиданной ошибке в процессе применить @systematic-debugging.
- Не править `.bak.*` файлы и legacy-артефакты.
