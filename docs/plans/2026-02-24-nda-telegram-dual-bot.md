# NDA Telegram Dual-Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix NDA gateway restart bug and add separate NDA Telegram bot setup in the product UI panel.

**Architecture:** App.ts holds reactive state + logic. AppViewState declares the shape. app-render-product.ts renders. Changes touch 4 files: app.ts, app-view-state.ts, app-render-product.ts (two places), and no backend changes needed — gateway already supports `channels.telegram.accounts.<id>`.

**Tech Stack:** Lit (LitElement + @state), TypeScript, config.patch RPC

---

### Task 1: Fix ensureNdaProviderConfigured — stop unnecessary gateway restart

**Files:**
- Modify: `ui/src/ui/app.ts:754-787`

**Problem:** Every NDA mode switch patches config even when `nda_internal` is already configured, triggering a gateway restart, losing response streams, and resetting Telegram channel status.

**Step 1: Read the current function**

```bash
sed -n '754,787p' /Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app.ts
```

**Step 2: Add early-return guard**

In `ensureNdaProviderConfigured`, after the `if (!this.client)` check, add:

```ts
// Skip patch if NDA provider already configured
const existingNdaProvider = (config as Record<string, unknown> | null)
  ?.models as Record<string, unknown> | undefined;
const ndaProviders = existingNdaProvider?.providers as Record<string, unknown> | undefined;
const existingNda = ndaProviders?.[NDA_PROVIDER] as Record<string, unknown> | undefined;
if (existingNda?.baseUrl && existingNda?.apiKey) {
  return;
}
```

Full updated function:
```ts
private async ensureNdaProviderConfigured(config: Record<string, unknown> | null) {
  if (!this.client) {
    throw new Error("Gateway клиент недоступен.");
  }

  // Skip patch if NDA provider already configured
  const modelsSection = (config as Record<string, unknown> | null)?.models as Record<string, unknown> | undefined;
  const providersSection = modelsSection?.providers as Record<string, unknown> | undefined;
  const existingNda = providersSection?.[NDA_PROVIDER] as Record<string, unknown> | undefined;
  if (existingNda?.baseUrl && existingNda?.apiKey) {
    return;
  }

  const sharedApiKeyRef = this.resolveSharedApiKeyRef(config);
  if (!sharedApiKeyRef) {
    throw new Error("Не найден API-ключ основной модели. Сначала завершите обычный onboarding.");
  }

  const patch = buildNdaModelsPatch(sharedApiKeyRef);

  let baseHash = this.configSnapshot?.hash;
  if (!baseHash) {
    await loadConfigInternal(this);
    baseHash = this.configSnapshot?.hash;
  }
  if (!baseHash) {
    throw new Error("Не удалось прочитать hash конфига.");
  }
  await this.client.request("config.patch", {
    raw: JSON.stringify(patch),
    baseHash,
    note: "product-ui nda setup",
  }).catch((err) => {
    const details = String(err).toLowerCase();
    const restartInProgress =
      details.includes("gateway closed") || details.includes("gateway not connected");
    if (!restartInProgress) {
      throw err;
    }
  });
  await this.waitForGatewayReconnect(30000);
  await loadConfigInternal(this);
}
```

**Step 3: Verify build passes**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -20
```
Expected: build succeeds, no TypeScript errors.

**Step 4: Manual smoke test**

Start gateway, switch to NDA mode in UI. Verify:
- No "gateway closed" error banner
- Agent responds normally
- Telegram banner not duplicated

**Step 5: Commit**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn
git add ui/src/ui/app.ts
git commit -m "fix: skip NDA provider config patch when already configured"
```

---

### Task 2: Add NDA Telegram state fields to AppViewState and App

**Files:**
- Modify: `ui/src/ui/app-view-state.ts:76-80`
- Modify: `ui/src/ui/app.ts:268-272`

**Step 1: Add to app-view-state.ts** — after `productTelegramSuccess` (line 80):

```ts
productTelegramNdaToken = "";
productTelegramNdaAllowFrom = "";
productTelegramNdaBusy = false;
productTelegramNdaError: string | null = null;
productTelegramNdaSuccess: string | null = null;
```

**Step 2: Add @state() declarations to app.ts** — after `@state() productTelegramSuccess` (~line 272):

```ts
@state() productTelegramNdaToken = "";
@state() productTelegramNdaAllowFrom = "";
@state() productTelegramNdaBusy = false;
@state() productTelegramNdaError: string | null = null;
@state() productTelegramNdaSuccess: string | null = null;
```

**Step 3: Verify build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add ui/src/ui/app-view-state.ts ui/src/ui/app.ts
git commit -m "feat: add NDA Telegram state fields"
```

---

### Task 3: Add productConnectTelegramNda() method to app.ts

**Files:**
- Modify: `ui/src/ui/app.ts` — after `productConnectTelegram()` (~line 1286)

**Step 1: Add method after `productConnectTelegram()`**

```ts
async productConnectTelegramNda() {
  this.productTelegramNdaError = null;
  this.productTelegramNdaSuccess = null;
  if (!this.client || !this.connected) {
    this.productTelegramNdaError = "Нет соединения с gateway.";
    return;
  }
  this.productTelegramNdaBusy = true;
  try {
    let baseHash = this.configSnapshot?.hash;
    if (!baseHash) {
      await loadConfigInternal(this);
      baseHash = this.configSnapshot?.hash;
    }
    if (!baseHash) {
      this.productTelegramNdaError = "Не удалось получить hash конфига. Попробуй еще раз.";
      return;
    }
    const token = this.productTelegramNdaToken.trim();
    const allowFrom = this.productTelegramNdaAllowFrom.trim();
    if (!token) {
      this.productTelegramNdaError = "Нужен Telegram bot token для NDA-бота.";
      return;
    }
    if (!allowFrom) {
      this.productTelegramNdaError = "Нужен твой Telegram user id (цифры).";
      return;
    }
    const defaultAgentId = normalizeAgentId(this.agentsList?.defaultId ?? "main");
    const patch = {
      channels: {
        telegram: {
          accounts: {
            nda: {
              enabled: true,
              botToken: token,
              dmPolicy: "allowlist",
              allowFrom: [allowFrom],
            },
          },
        },
      },
      bindings: [
        {
          agentId: defaultAgentId,
          match: { channel: "telegram", accountId: "default" },
        },
        {
          agentId: PRODUCT_NDA_AGENT_ID,
          match: { channel: "telegram", accountId: "nda" },
        },
      ],
    };
    await this.client.request("config.patch", {
      raw: JSON.stringify(patch),
      baseHash,
      note: "product-ui telegram nda connect",
    });
    this.productTelegramNdaToken = "";
    this.productTelegramNdaAllowFrom = "";
    this.productTelegramNdaSuccess = "NDA-бот подключен. Gateway перезапускается.";
  } catch (err) {
    this.productTelegramNdaError = String(err);
  } finally {
    this.productTelegramNdaBusy = false;
  }
}
```

Note: `PRODUCT_NDA_AGENT_ID` is already defined as `"nda"` at line ~156 of app.ts.

**Step 2: Verify build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git add ui/src/ui/app.ts
git commit -m "feat: add productConnectTelegramNda method"
```

---

### Task 4: Add NDA section to renderTelegramPanel in app-render-product.ts

**Files:**
- Modify: `ui/src/ui/app-render-product.ts:318-358`

**Step 1: Replace `renderTelegramPanel` with two-section version**

```ts
function renderTelegramPanel(state: AppViewState) {
  return html`
    <section class="product-panel">
      <div class="product-panel__header">Telegram</div>

      <div class="product-panel__sub" style="margin-bottom: 16px;">Обычный режим (агент «Обычный»)</div>
      <label class="product-field">
        <span>Bot token</span>
        <input
          class="product-input"
          type="password"
          .value=${state.productTelegramToken}
          @input=${(e: Event) => (state.productTelegramToken = (e.target as HTMLInputElement).value)}
          placeholder="123456:ABC..."
        />
      </label>
      <label class="product-field">
        <span>Твой user id</span>
        <input
          class="product-input"
          .value=${state.productTelegramAllowFrom}
          @input=${(e: Event) => (state.productTelegramAllowFrom = (e.target as HTMLInputElement).value)}
          placeholder="Например: 123456789"
        />
        <div class="product-field__help">
          Чтобы бот отвечал только вам. Получить ID: напишите @userinfobot.
        </div>
      </label>
      ${state.productTelegramError ? html`<div class="product-callout danger">${state.productTelegramError}</div>` : nothing}
      ${state.productTelegramSuccess ? html`<div class="product-callout ok">${state.productTelegramSuccess}</div>` : nothing}
      <div class="product-panel__section">
        <button
          class="product-btn primary"
          ?disabled=${state.productTelegramBusy}
          @click=${() => void state.productConnectTelegram()}
        >
          ${state.productTelegramBusy ? "Подключаю..." : "Подключить"}
        </button>
      </div>

      <div style="margin: 20px 0 12px; border-top: 1px solid var(--border-color, #333); padding-top: 16px;">
        <div class="product-panel__sub">🔒 NDA-режим (агент «NDA»)</div>
        <div class="product-field__help" style="margin-bottom: 12px;">Отдельный бот — NDA-контент не смешивается с обычным.</div>
      </div>
      <label class="product-field">
        <span>Bot token (NDA)</span>
        <input
          class="product-input"
          type="password"
          .value=${state.productTelegramNdaToken}
          @input=${(e: Event) => (state.productTelegramNdaToken = (e.target as HTMLInputElement).value)}
          placeholder="123456:ABC..."
        />
      </label>
      <label class="product-field">
        <span>Твой user id</span>
        <input
          class="product-input"
          .value=${state.productTelegramNdaAllowFrom}
          @input=${(e: Event) => (state.productTelegramNdaAllowFrom = (e.target as HTMLInputElement).value)}
          placeholder="Например: 123456789"
        />
      </label>
      ${state.productTelegramNdaError ? html`<div class="product-callout danger">${state.productTelegramNdaError}</div>` : nothing}
      ${state.productTelegramNdaSuccess ? html`<div class="product-callout ok">${state.productTelegramNdaSuccess}</div>` : nothing}
      <div class="product-panel__section">
        <button
          class="product-btn primary"
          ?disabled=${state.productTelegramNdaBusy}
          @click=${() => void state.productConnectTelegramNda()}
        >
          ${state.productTelegramNdaBusy ? "Подключаю..." : "Подключить NDA-бота"}
        </button>
      </div>
    </section>
  `;
}
```

**Step 2: Verify build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git add ui/src/ui/app-render-product.ts
git commit -m "feat: add NDA bot section to Telegram panel"
```

---

### Task 5: Fix NDA CTA logic in app-render-product.ts

**Files:**
- Modify: `ui/src/ui/app-render-product.ts:44-55`

**Problem:** `shouldShowNdaTelegramCta` hides when "any Telegram is ready" but should hide when "NDA telegram account is configured".

**Step 1: Add helper function and update `shouldShowNdaTelegramCta`**

Add before `shouldShowNdaTelegramCta`:

```ts
function isNdaTelegramConfigured(state: AppViewState): boolean {
  const cfg = state.configSnapshot?.config as Record<string, unknown> | null | undefined;
  const telegram = (cfg?.channels as Record<string, unknown> | undefined)?.telegram as Record<string, unknown> | undefined;
  const accounts = telegram?.accounts as Record<string, unknown> | undefined;
  const ndaAccount = accounts?.nda as Record<string, unknown> | undefined;
  return Boolean(ndaAccount?.botToken);
}
```

Replace `shouldShowNdaTelegramCta`:

```ts
function shouldShowNdaTelegramCta(state: AppViewState): boolean {
  if (state.productChatMode !== "nda") {
    return false;
  }
  if (state.productNdaTelegramCtaDismissed) {
    return false;
  }
  if (isNdaTelegramConfigured(state)) {
    return false;
  }
  return true;
}
```

**Step 2: Verify build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git add ui/src/ui/app-render-product.ts
git commit -m "fix: NDA CTA hides when NDA bot is configured, not on any telegram"
```

---

### Task 6: Fix NDA CTA logic in app-render.ts

**Files:**
- Modify: `ui/src/ui/app-render.ts:147-155`

Same change as Task 5 but in the non-product render path.

**Step 1: Read current function**

```bash
sed -n '130,160p' /Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render.ts
```

**Step 2: Add `isNdaTelegramConfigured` helper (same as Task 5) and update `shouldShowNdaTelegramCta`**

Replace the function at line ~147:

```ts
function isNdaTelegramConfigured(state: AppViewState): boolean {
  const cfg = state.configSnapshot?.config as Record<string, unknown> | null | undefined;
  const telegram = (cfg?.channels as Record<string, unknown> | undefined)?.telegram as Record<string, unknown> | undefined;
  const accounts = telegram?.accounts as Record<string, unknown> | undefined;
  const ndaAccount = accounts?.nda as Record<string, unknown> | undefined;
  return Boolean(ndaAccount?.botToken);
}

function shouldShowNdaTelegramCta(state: AppViewState): boolean {
  if (!isNdaSession(state) && state.productChatMode !== "nda") {
    return false;
  }
  if (state.productNdaTelegramCtaDismissed) {
    return false;
  }
  if (isNdaTelegramConfigured(state)) {
    return false;
  }
  return true;
}
```

**Step 3: Verify build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add ui/src/ui/app-render.ts
git commit -m "fix: NDA CTA in app-render.ts uses NDA account config check"
```

---

### Task 7: Full build + update YANDEXAGETN.md

**Step 1: Full build**

```bash
cd /Users/fedorovstas/Projects/YandexAgetn && node scripts/ui.js build 2>&1 | tail -20
```

**Step 2: Update YANDEXAGETN.md**

Add to "Текущие фичи" section:
- NDA-агент теперь работает без рестарта gateway при переключении
- Telegram-панель разделена на секции: Обычный / NDA — каждый агент может иметь своего бота
- NDA CTA показывается только если NDA-бот не настроен

Update header date.

**Step 3: Commit**

```bash
git add YANDEXAGETN.md
git commit -m "docs: update YANDEXAGETN.md with NDA Telegram dual-bot changes"
```
