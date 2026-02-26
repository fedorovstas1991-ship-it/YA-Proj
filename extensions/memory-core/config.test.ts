import { describe, it, expect } from "vitest";
import { parseMemoryCoreConfig, resolveMemoryPaths } from "./config.js";

describe("memory-core config", () => {
  it("applies defaults", () => {
    const cfg = parseMemoryCoreConfig({});
    expect(cfg.timezone).toBe("Europe/Moscow");
    expect(cfg.language).toBe("ru");
    expect(cfg.memoryDir).toBe("memory");
    expect(cfg.memoryFile).toBe("MEMORY.md");
    expect(cfg.promote.intervalHours).toBe(6);
    expect(cfg.promote.aggressiveness).toBe("broad");
    expect(cfg.promote.mode).toBe("ollama");
    expect(cfg.promote.messageThreshold).toBe(50);
    expect(cfg.promote.onCompaction).toBe(true);
    expect(cfg.clarify.minMessages).toBe(20);
    expect(cfg.ollama.model).toBe("qwen2.5:7b-instruct");
    expect(cfg.ollama.timeoutMs).toBe(60_000);
  });

  it("rejects unknown keys", () => {
    expect(() => parseMemoryCoreConfig({ nope: true })).toThrow(/unknown keys/i);
  });

  it("resolves relative paths against agent root", () => {
    const cfg = parseMemoryCoreConfig({});
    const paths = resolveMemoryPaths({ agentRootDir: "/tmp/agent", config: cfg });
    expect(paths.memoryDir).toBe("/tmp/agent/memory");
    expect(paths.memoryFile).toBe("/tmp/agent/MEMORY.md");
    expect(paths.recentDir).toBe("/tmp/agent/memory/recent");
  });
});
