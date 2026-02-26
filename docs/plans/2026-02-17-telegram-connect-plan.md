# Telegram Connect (Product UI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Product UI Telegram tab handle real connection setup (config.patch + binding) while hiding legacy Channels UI and ensuring local startup scripts always reset config/history.

**Architecture:** Product UI continues to call gateway `config.patch` and binds Telegram to the default agent without exposing agent terminology. Legacy Channels UI remains routed but is hidden from navigation and product links. Local startup script wipes `~/.openclaw-<profile>` each run.

**Tech Stack:** Lit (UI), Vitest (browser tests), Bash (startup script)

---

### Task 1: Hide legacy Channels UI from navigation and links

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/navigation.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-product.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-simple.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/focus-mode.browser.test.ts`

**Step 1: Write the failing test**

Update the focus mode test to assert the channels link is absent and to use a visible tab link (Usage) to exit focus mode.

```ts
// focus-mode.browser.test.ts
const link = app.querySelector<HTMLAnchorElement>('a.nav-item[href="/channels"]');
expect(link).toBeNull();

const usageLink = app.querySelector<HTMLAnchorElement>('a.nav-item[href="/usage"]');
expect(usageLink).not.toBeNull();
usageLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm --dir ui test -- focus-mode.browser.test.ts
```
Expected: FAIL because `/channels` still exists in navigation.

**Step 3: Implement minimal code changes**

1) Remove `channels` from `TAB_GROUPS` in `navigation.ts`.
2) Remove the "Legacy: Channels" link from Product UI in `app-render-product.ts`.
3) Remove the "Телеграм и каналы" link from Simple UI dev links in `app-render-simple.ts`.

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm --dir ui test -- focus-mode.browser.test.ts
```
Expected: PASS.

**Step 5: Commit**

Skip commit (user requested no git operations).

---

### Task 2: Ensure Product UI Telegram connect writes config + binds to default agent

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app.ts`
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/ui/src/ui/app-render-product.ts`

**Step 1: Write the failing test**

No automated test coverage available for this Product UI flow. Document manual checks instead.

**Step 2: Implement minimal code changes**

1) In `app.ts`, ensure `productConnectTelegram()`:
- validates `connected` and `configSnapshot.hash` (load via `config.get` if missing)
- builds patch with `channels.telegram.enabled`, `botToken`, `dmPolicy: "allowlist"`, `allowFrom: [userId]`
- binds to `agentsList.defaultId ?? "main"`

2) In `app-render-product.ts`, show user-id help text explaining security and how to get it from `@userinfobot`.

**Step 3: Manual verification**

- Empty token -> error.
- Empty user id -> error.
- Valid token+id -> success message, config updated.
- Check `~/.openclaw-<profile>/openclaw.json` for `channels.telegram` and `bindings`.

**Step 4: Commit**

Skip commit (user requested no git operations).

---

### Task 3: Reset local profile config/history on each startup

**Files:**
- Modify: `/Users/fedorovstas/Projects/YandexAgetn/yagent-onboard-ui.command`

**Step 1: Write the failing test**

No automated tests. Manual verification only.

**Step 2: Implement minimal code changes**

Add removal of the OpenClaw profile directory:
```bash
rm -rf "$HOME/.openclaw-${PROFILE}"
```

**Step 3: Manual verification**

- Run script twice; ensure `~/.openclaw-<profile>/openclaw.json` is recreated and does not retain prior config/history.

**Step 4: Commit**

Skip commit (user requested no git operations).
