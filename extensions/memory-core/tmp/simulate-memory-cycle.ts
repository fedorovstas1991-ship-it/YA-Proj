import fs from "node:fs/promises";
import path from "node:path";
import { appendDailyEntry } from "../extensions/memory-core/daily-log.ts";
import { promoteEntries } from "../extensions/memory-core/promote.ts";
import { syncRecentIndex } from "../extensions/memory-core/recent-index.ts";
import { loadState, saveState } from "../extensions/memory-core/state.ts";

const cfgRaw = JSON.parse(await fs.readFile("/root/.openclaw/openclaw.json", "utf8"));
const memCfg = cfgRaw?.plugins?.entries?.["memory-core"]?.config;
if (!memCfg) {
  throw new Error("memory-core config not found");
}

const memoryDir = memCfg.memoryDir as string;
const memoryFile = memCfg.memoryFile as string;
const recentDir = path.join(memoryDir, "recent");
const timezone = memCfg.timezone as string;
const maxDays = memCfg.recent?.maxDays ?? 90;
const baseUrl = memCfg.ollama?.baseUrl as string;
const model = memCfg.ollama?.model as string;
const timeoutMs = (memCfg.ollama?.timeoutMs as number | undefined) ?? 30_000;
const aggressiveness = memCfg.promote?.aggressiveness ?? "broad";
const mode = memCfg.promote?.mode ?? "ollama";

const stateDir = "/root/.openclaw/agents/main/agent/memory-core";

await appendDailyEntry({
  memoryDir,
  timezone,
  kind: "Facts",
  text: "[SIMULATED] Проверка memory-core: QMD + Ollama работают.",
});
await appendDailyEntry({
  memoryDir,
  timezone,
  kind: "Decisions",
  text: "[SIMULATED] Тестовая запись для проверки автопромоушена.",
});
await appendDailyEntry({
  memoryDir,
  timezone,
  kind: "Todos",
  text: "[SIMULATED] Удалить тестовые записи после проверки.",
});

await syncRecentIndex({ memoryDir, recentDir, maxDays });

const state = await loadState(stateDir);
const result = await promoteEntries({
  memoryDir,
  memoryFile,
  since: state.lastPromotedAt,
  baseUrl,
  model,
  aggressiveness,
  timeoutMs,
  mode,
});
state.lastPromotedAt = result.lastSeen;
await saveState(stateDir, state);

console.log(JSON.stringify({ promoted: result }, null, 2));
