import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadState, saveState } from "./state.js";

describe("memory-core state", () => {
  it("loads default state when file doesn't exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "state-test-"));
    const state = await loadState(tmpDir);
    
    expect(state.lastPromotedAt).toBe(0);
    expect(state.messagesSinceClarify).toBe(0);
    expect(state.messagesSincePromote).toBe(0);
    expect(state.pendingQuestion).toBeUndefined();
    
    await fs.rm(tmpDir, { recursive: true });
  });

  it("saves and loads messagesSincePromote", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "state-test-"));
    
    const state = {
      lastPromotedAt: Date.now(),
      messagesSinceClarify: 5,
      messagesSincePromote: 25,
      pendingQuestion: undefined,
    };
    
    await saveState(tmpDir, state);
    const loaded = await loadState(tmpDir);
    
    expect(loaded.messagesSincePromote).toBe(25);
    expect(loaded.messagesSinceClarify).toBe(5);
    
    await fs.rm(tmpDir, { recursive: true });
  });

  it("resets messagesSincePromote after promotion", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "state-test-"));
    
    // Симулируем накопление сообщений
    let state = await loadState(tmpDir);
    state.messagesSincePromote = 50;
    await saveState(tmpDir, state);
    
    // Симулируем промоушен
    state = await loadState(tmpDir);
    expect(state.messagesSincePromote).toBe(50);
    state.messagesSincePromote = 0;
    await saveState(tmpDir, state);
    
    // Проверяем сброс
    state = await loadState(tmpDir);
    expect(state.messagesSincePromote).toBe(0);
    
    await fs.rm(tmpDir, { recursive: true });
  });
});