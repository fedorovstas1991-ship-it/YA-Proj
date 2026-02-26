import fs from "node:fs/promises";
import path from "node:path";

export type MemoryCoreState = {
  lastPromotedAt: number;
  messagesSinceClarify: number;
  messagesSincePromote: number;
  pendingQuestion?: string;
};

const DEFAULT_STATE: MemoryCoreState = {
  lastPromotedAt: 0,
  messagesSinceClarify: 0,
  messagesSincePromote: 0,
  pendingQuestion: undefined,
};

export async function loadState(dir: string): Promise<MemoryCoreState> {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "state.json");
  const raw = await fs.readFile(file, "utf-8").catch(() => "");
  if (!raw.trim()) {
    return { ...DEFAULT_STATE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MemoryCoreState>;
    return {
      lastPromotedAt: typeof parsed.lastPromotedAt === "number" ? parsed.lastPromotedAt : 0,
      messagesSinceClarify:
        typeof parsed.messagesSinceClarify === "number" ? parsed.messagesSinceClarify : 0,
      messagesSincePromote:
        typeof parsed.messagesSincePromote === "number" ? parsed.messagesSincePromote : 0,
      pendingQuestion:
        typeof parsed.pendingQuestion === "string" ? parsed.pendingQuestion : undefined,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(dir: string, state: MemoryCoreState): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "state.json");
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf-8");
}
