import { describe, expect, it } from "vitest";
import {
  externalizeConfigSecrets,
  hasPlaintextConfigSecrets,
  hydrateConfigSecretRefs,
} from "./secrets.js";

function createMemoryStore() {
  const entries = new Map<string, string>();
  return {
    backend: "darwin-keychain" as const,
    available: true,
    entries,
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

describe("config secrets", () => {
  it("externalizes plaintext telegram bot token into secret ref", async () => {
    const store = createMemoryStore();
    const cfg = {
      channels: {
        telegram: {
          botToken: "123456:abcdef",
        },
      },
    };

    const next = await externalizeConfigSecrets(cfg, store);
    const token = (next.channels as { telegram?: { botToken?: string } }).telegram?.botToken;

    expect(token).toBe("secret://ya/telegram/bottoken");
    expect(store.get("secret://ya/telegram/bottoken")).toBe("123456:abcdef");
  });

  it("does not rewrite already externalized refs", async () => {
    const store = createMemoryStore();
    const cfg = {
      channels: {
        telegram: {
          botToken: "secret://ya/telegram/bottoken",
        },
      },
    };

    const next = await externalizeConfigSecrets(cfg, store);

    expect((next.channels as any).telegram.botToken).toBe("secret://ya/telegram/bottoken");
    expect(store.entries.size).toBe(0);
  });

  it("hydrates secret refs back to runtime values", async () => {
    const store = createMemoryStore();
    store.set("secret://ya/openrouter/apikey", "or-key");
    const cfg = {
      models: {
        providers: {
          openrouter: {
            apiKey: "secret://ya/openrouter/apikey",
          },
        },
      },
    };

    const hydrated = await hydrateConfigSecretRefs(cfg, store);

    expect((hydrated.models as any).providers.openrouter.apiKey).toBe("or-key");
  });

  it("fails closed when secret ref cannot be resolved", async () => {
    const store = createMemoryStore();
    const cfg = {
      channels: {
        telegram: {
          botToken: "secret://ya/telegram/bottoken",
        },
      },
    };

    expect(() => hydrateConfigSecretRefs(cfg, store)).toThrow(
      'Missing secret for ref "secret://ya/telegram/bottoken"',
    );
  });

  it("detects plaintext secret values in config", () => {
    expect(
      hasPlaintextConfigSecrets({
        channels: { telegram: { botToken: "123:abc" } },
      }),
    ).toBe(true);
    expect(
      hasPlaintextConfigSecrets({
        channels: { telegram: { botToken: "secret://ya/telegram/bottoken" } },
      }),
    ).toBe(false);
  });
});
