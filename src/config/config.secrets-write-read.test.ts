import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigIO } from "./io.js";

function createMemorySecretStore() {
  const map = new Map<string, string>();
  return {
    backend: "darwin-keychain" as const,
    available: true,
    get(ref: string) {
      return map.get(ref) ?? null;
    },
    set(ref: string, value: string) {
      map.set(ref, value);
    },
    delete(ref: string) {
      map.delete(ref);
    },
    has(ref: string) {
      return map.has(ref);
    },
  };
}

describe("config io secrets", () => {
  it("writes refs to disk and hydrates runtime values", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-config-secrets-"));
    try {
      const configDir = path.join(home, ".openclaw");
      const configPath = path.join(configDir, "openclaw.json");
      await fs.mkdir(configDir, { recursive: true });
      const secretStore = createMemorySecretStore();
      const io = createConfigIO({
        configPath,
        secretStore,
      });

      await io.writeConfigFile({
        plugins: {
          slots: {
            memory: "none",
          },
        },
        channels: {
          telegram: {
            botToken: "123456:abcdef",
          },
        },
      });

      const onDiskRaw = await fs.readFile(configPath, "utf8");
      const onDisk = JSON.parse(onDiskRaw) as {
        channels?: { telegram?: { botToken?: string } };
      };
      expect(onDisk.channels?.telegram?.botToken).toBe("secret://ya/telegram/bottoken");
      expect(secretStore.get("secret://ya/telegram/bottoken")).toBe("123456:abcdef");

      const runtime = io.loadConfig();
      expect(runtime.channels?.telegram?.botToken).toBe("123456:abcdef");
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
