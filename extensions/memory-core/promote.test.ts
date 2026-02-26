import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { promoteEntries } from "./promote.js";

const runClassification = vi.fn(async () => [
  { text: "Стас предпочитает прямоту", promote: true, question: null },
]);

vi.mock("./ollama.js", () => ({
  runClassification,
}));

describe("promote", () => {
  it("appends to MEMORY.md", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "memory-promote-"));
    const memoryDir = path.join(root, "memory");
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(
      path.join(memoryDir, "2026-02-23.md"),
      `# Daily Log

## Facts
- [2026-02-23T09:00:00+03:00] Стас предпочитает прямоту
`,
      "utf-8",
    );

    await promoteEntries({
      memoryDir,
      memoryFile: path.join(root, "MEMORY.md"),
      since: 0,
      baseUrl: "http://localhost:11434",
      model: "qwen2.5:7b-instruct",
      aggressiveness: "broad",
      mode: "ollama",
      timeoutMs: 60_000,
    });

    const memory = await fs.readFile(path.join(root, "MEMORY.md"), "utf-8");
    expect(memory).toContain("Стас предпочитает прямоту");
  });

  it("auto-promotes all entries in rules mode", async () => {
    runClassification.mockClear();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "memory-promote-"));
    const memoryDir = path.join(root, "memory");
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(
      path.join(memoryDir, "2026-02-23.md"),
      `# Daily Log

## Facts
- [2026-02-23T09:00:00+03:00] Стас предпочитает прямоту
`,
      "utf-8",
    );

    await promoteEntries({
      memoryDir,
      memoryFile: path.join(root, "MEMORY.md"),
      since: 0,
      baseUrl: "http://localhost:11434",
      model: "qwen2.5:7b-instruct",
      aggressiveness: "broad",
      mode: "rules",
      timeoutMs: 60_000,
    });

    const memory = await fs.readFile(path.join(root, "MEMORY.md"), "utf-8");
    expect(memory).toContain("Стас предпочитает прямоту");
    expect(runClassification).not.toHaveBeenCalled();
  });
});
