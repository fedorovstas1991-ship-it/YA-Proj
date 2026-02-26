# Keychain Secrets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Перевести хранение секретов (config + auth-profiles) на `OS Keychain` с `secret://`-ссылками, `fail-closed` и без plaintext в runtime-файлах.

**Architecture:** Добавляем общий `SecretStore` (darwin `security` CLI), `secretRef`-резолвер и миграцию plaintext->ref в двух местах записи (`openclaw.json`, `auth-profiles.json`). Runtime получает секрет только в момент интеграционного вызова через резолвер. Если keychain недоступен или ref неразрешим — операция падает (`fail-closed`) без fallback в plaintext.

**Tech Stack:** TypeScript, Node.js (`child_process`), Vitest, текущие модули `config/*`, `agents/auth-profiles/*`, `ui/gateway`.

---

### Task 1: Базовый SecretStore и SecretRef утилиты

**Files:**
- Create: `src/infra/secrets/ref.ts`
- Create: `src/infra/secrets/store.ts`
- Create: `src/infra/secrets/store.darwin.ts`
- Create: `src/infra/secrets/ref.test.ts`
- Create: `src/infra/secrets/store.darwin.test.ts`

**Step 1: Write the failing test**

```ts
it("parses secret://ya/openrouter/main", () => {
  expect(parseSecretRef("secret://ya/openrouter/main")).toEqual({
    namespace: "ya",
    provider: "openrouter",
    scope: "main",
  });
});

it("fails on invalid secret ref", () => {
  expect(parseSecretRef("secret://bad")).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infra/secrets/ref.test.ts`
Expected: FAIL (helpers not implemented).

**Step 3: Write minimal implementation**

```ts
export const SECRET_REF_RE = /^secret:\/\/([a-z0-9_-]+)\/([a-z0-9._-]+)\/([a-z0-9._\/-]+)$/i;
export function isSecretRef(value: unknown): value is string { ... }
export function parseSecretRef(value: string): SecretRefParts | null { ... }
export function buildSecretRef(parts: SecretRefParts): string { ... }
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/infra/secrets/ref.test.ts`
Expected: PASS.

**Step 5: Add keychain adapter test-first**

```ts
it("reads generic password via security CLI", async () => {
  const store = createDarwinSecretStore({ execFile: mockExecFile });
  await expect(store.get("secret://ya/openrouter/main")).resolves.toBe("sk-test");
});
```

Run: `pnpm vitest run src/infra/secrets/store.darwin.test.ts` (expect RED), then implement and re-run (GREEN).

---

### Task 2: Безопасная обработка секретов в config write/load

**Files:**
- Create: `src/config/secrets.ts`
- Create: `src/config/secrets.test.ts`
- Modify: `src/config/io.ts`
- Modify: `src/config/redact-snapshot.ts`

**Step 1: Write the failing test**

```ts
it("writeConfigFile stores botToken as secret ref", async () => {
  await writeConfigFile({ channels: { telegram: { botToken: "123:abc" } } });
  const onDisk = JSON.parse(fs.readFileSync(configPath, "utf8"));
  expect(onDisk.channels.telegram.botToken).toMatch(/^secret:\/\/ya\/telegram\//);
});
```

**Step 2: Run RED**

Run: `pnpm vitest run src/config/secrets.test.ts`
Expected: FAIL (plaintext still stored).

**Step 3: Implement minimal conversion**

```ts
export async function externalizeConfigSecrets(cfg: OpenClawConfig, store: SecretStore): Promise<OpenClawConfig>
export async function hydrateConfigSecretRefs(cfg: OpenClawConfig, store: SecretStore): Promise<OpenClawConfig>
```

Integrate in `writeConfigFile` before JSON serialization and in `loadConfig`/`readConfigFileSnapshot` runtime branch (no mutation of on-disk snapshot).

**Step 4: Run GREEN**

Run: `pnpm vitest run src/config/secrets.test.ts`
Expected: PASS.

**Step 5: Fail-closed test**

Add test: `hydrateConfigSecretRefs` throws if `secret://...` not found.
Run target test again.

---

### Task 3: Миграция/хранение секретов в auth-profiles

**Files:**
- Create: `src/agents/auth-profiles.secrets.test.ts`
- Modify: `src/agents/auth-profiles/profiles.ts`
- Modify: `src/agents/auth-profiles/store.ts`
- Modify: `src/agents/auth-profiles/oauth.ts`
- Modify: `src/agents/auth-profiles/types.ts`

**Step 1: Write the failing test**

```ts
it("upsertAuthProfile stores api key in keychain and keeps only secret ref in auth-profiles.json", async () => {
  upsertAuthProfile({ profileId: "openrouter:default", credential: { type: "api_key", provider: "openrouter", key: "sk" } });
  const stored = loadAuthProfileStore();
  expect(stored.profiles["openrouter:default"]).toMatchObject({ key: expect.stringMatching(/^secret:\/\//) });
});
```

**Step 2: Run RED**

Run: `pnpm vitest run src/agents/auth-profiles.secrets.test.ts`
Expected: FAIL.

**Step 3: Minimal implementation**

- On `upsertAuthProfile`: plaintext `key/token/access/refresh` -> keychain; persist ref.
- On store load: auto-migrate legacy plaintext records to refs and rewrite file.
- On resolve (`resolveApiKeyForProfile`): if field is ref, resolve from keychain; if missing -> throw fail-closed.

**Step 4: Run GREEN**

Run: `pnpm vitest run src/agents/auth-profiles.secrets.test.ts`
Expected: PASS.

---

### Task 4: Runtime provider/channel integration (без утечек)

**Files:**
- Modify: `src/agents/model-auth.ts`
- Modify: `src/channels/plugins/onboarding/telegram.ts`
- Modify: `src/channels/plugins/onboarding/slack.ts`
- Modify: `src/config/types*.ts` (если нужны уточнения типов)
- Test: `src/agents/model-auth*.test.ts`, `src/channels/plugins/*telegram*.test.ts`

**Step 1: Write failing tests**

- `resolveApiKeyForProvider` корректно разрешает `secret://...`.
- Telegram onboarding/health-probe корректно работает при `botToken=secret://...`.

**Step 2: Run RED**

Run targeted tests по файлам выше.

**Step 3: Implement minimal changes**

- Все runtime чтения credential/token проходят через единый `resolveSecretRefOrPlain`.
- В fail-closed режиме (`OPENCLAW_SECRET_FAIL_CLOSED=1`, default `1`) отсутствие секрета -> ошибка.

**Step 4: Run GREEN**

Run targeted tests again; all PASS.

---

### Task 5: Gateway/UI безопасный write-path и миграция при старте

**Files:**
- Create: `src/config/secrets-migrate.ts`
- Modify: `src/config/config.ts` (или место bootstrap gateway)
- Modify: `src/gateway/server-methods/config.ts`
- Modify: `ui/src/ui/app.ts` (error surface, без отправки/логирования лишних деталей)
- Test: `src/gateway/server-methods/config*.test.ts`, `src/config/secrets*.test.ts`

**Step 1: Write failing test**

- После `config.patch` с plaintext секретом на диске сохраняется ref, а не plaintext.
- При старте gateway с legacy config выполняется авто-миграция и idempotent rewrite.

**Step 2: Run RED**

Run targeted tests.

**Step 3: Implement minimal changes**

- Перед `writeConfigFile` применять externalize.
- На старте gateway запускать `migrateSecretsAtStartup()`.
- Ошибки keychain отдавать пользователю на русском + технический detail.

**Step 4: Run GREEN**

Run targeted tests; PASS.

---

### Task 6: Проверка безопасности и регресса

**Files:**
- Modify: `src/security/audit-extra.*.ts` (если нужны новые проверки)
- Create: `src/security/secrets-regression.test.ts`
- Optional docs: `docs/security/keychain-secrets.md`

**Step 1: Write failing regression test**

- `grep`-эквивалент на runtime-файлы state dir не находит исходный токен после миграции.

**Step 2: Run RED**

Run: `pnpm vitest run src/security/secrets-regression.test.ts`

**Step 3: Implement minimal fix**

- Добавить/расширить audit checks на plaintext token patterns.

**Step 4: Run GREEN + sanity suite**

Run:
- `pnpm vitest run src/infra/secrets/*.test.ts src/config/secrets.test.ts src/agents/auth-profiles.secrets.test.ts src/security/secrets-regression.test.ts`
- `pnpm vitest run src/onboarding/onboarding-wizard.test.ts ui/src/ui/views/channels.telegram.ts` (если есть unit tests в ui пакете — запускать через `pnpm --dir ui test` targeted).

Expected: PASS; без сохранения plaintext секретов в `openclaw.json` и `auth-profiles.json`.

---

## Notes
- По запросу пользователя не делаем git-операции (без commit/branch/PR).
- Если macOS Keychain недоступен: возвращаем понятную ошибку и останавливаем интеграцию (`fail-closed`).
