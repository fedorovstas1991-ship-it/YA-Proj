import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveApiKeyForProfile, upsertAuthProfile } from "./auth-profiles.js";
import { ensureAuthProfileStore } from "./auth-profiles/store.js";
import { clearSecretStoreCacheForTests, setSecretStoreForTests } from "../infra/secrets/store.js";

function createMemorySecretStore() {
  const entries = new Map<string, string>();
  return {
    backend: "darwin-keychain" as const,
    available: true,
    get(ref: string) {
      return entries.get(ref) ?? null;
    },
    set(ref: string, value: string) {
      entries.set(ref, value);
    },
    delete(ref: string) {
      entries.delete(ref);
    },
    has(ref: string) {
      return entries.has(ref);
    },
  };
}

describe("auth profiles secrets", () => {
  it("writes api key credentials as secret refs and resolves them at runtime", async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-auth-secret-"));
    const secretStore = createMemorySecretStore();
    setSecretStoreForTests(secretStore);
    try {
      upsertAuthProfile({
        profileId: "openrouter:default",
        agentDir,
        credential: {
          type: "api_key",
          provider: "openrouter",
          key: "or-key-123",
        },
      });

      const authPath = path.join(agentDir, "auth-profiles.json");
      const raw = fs.readFileSync(authPath, "utf8");
      const parsed = JSON.parse(raw) as {
        profiles?: Record<string, { key?: string }>;
      };
      const storedKey = parsed.profiles?.["openrouter:default"]?.key;
      expect(storedKey).toBe("secret://ya/openrouter/auth.openrouter-default.key");
      expect(secretStore.get("secret://ya/openrouter/auth.openrouter-default.key")).toBe(
        "or-key-123",
      );

      const store = ensureAuthProfileStore(agentDir);
      const resolved = await resolveApiKeyForProfile({
        store,
        profileId: "openrouter:default",
        agentDir,
      });
      expect(resolved?.apiKey).toBe("or-key-123");
    } finally {
      clearSecretStoreCacheForTests();
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
