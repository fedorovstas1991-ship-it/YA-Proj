import path from "node:path";

export type MemoryCoreConfig = {
  timezone: string;
  language: "ru" | "en";
  memoryDir: string;
  memoryFile: string;
  recent: {
    maxDays: number;
  };
  promote: {
    intervalHours: number;
    aggressiveness: "broad" | "narrow";
    mode: "ollama" | "rules";
    messageThreshold: number;
    onCompaction: boolean;
  };
  clarify: {
    minMessages: number;
  };
  ollama: {
    baseUrl: string;
    model: string;
    timeoutMs: number;
  };
};

const DEFAULTS: MemoryCoreConfig = {
  timezone: "Europe/Moscow",
  language: "ru",
  memoryDir: "memory",
  memoryFile: "MEMORY.md",
  recent: { maxDays: 90 },
  promote: {
    intervalHours: 6,
    aggressiveness: "broad",
    mode: "ollama",
    messageThreshold: 50,
    onCompaction: true,
  },
  clarify: { minMessages: 20 },
  ollama: {
    baseUrl: "http://127.0.0.1:11434",
    model: "qwen2.5:7b-instruct",
    timeoutMs: 60_000,
  },
};

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

export function parseMemoryCoreConfig(value: unknown): MemoryCoreConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULTS);
  }

  const raw = value as Record<string, unknown>;
  assertAllowedKeys(
    raw,
    ["timezone", "language", "memoryDir", "memoryFile", "recent", "promote", "clarify", "ollama"],
    "memory-core config",
  );

  const recent =
    typeof raw.recent === "object" && raw.recent ? (raw.recent as Record<string, unknown>) : {};
  const promote =
    typeof raw.promote === "object" && raw.promote ? (raw.promote as Record<string, unknown>) : {};
  const clarify =
    typeof raw.clarify === "object" && raw.clarify ? (raw.clarify as Record<string, unknown>) : {};
  const ollama =
    typeof raw.ollama === "object" && raw.ollama ? (raw.ollama as Record<string, unknown>) : {};

  return {
    timezone: typeof raw.timezone === "string" ? raw.timezone : DEFAULTS.timezone,
    language: raw.language === "en" ? "en" : "ru",
    memoryDir: typeof raw.memoryDir === "string" ? raw.memoryDir : DEFAULTS.memoryDir,
    memoryFile: typeof raw.memoryFile === "string" ? raw.memoryFile : DEFAULTS.memoryFile,
    recent: {
      maxDays: parseNumber(recent.maxDays, DEFAULTS.recent.maxDays),
    },
    promote: {
      intervalHours: parseNumber(promote.intervalHours, DEFAULTS.promote.intervalHours),
      aggressiveness: promote.aggressiveness === "narrow" ? "narrow" : "broad",
      mode: promote.mode === "rules" ? "rules" : "ollama",
      messageThreshold: parseNumber(promote.messageThreshold, DEFAULTS.promote.messageThreshold),
      onCompaction: typeof promote.onCompaction === "boolean" ? promote.onCompaction : DEFAULTS.promote.onCompaction,
    },
    clarify: {
      minMessages: parseNumber(clarify.minMessages, DEFAULTS.clarify.minMessages),
    },
    ollama: {
      baseUrl: typeof ollama.baseUrl === "string" ? ollama.baseUrl : DEFAULTS.ollama.baseUrl,
      model: typeof ollama.model === "string" ? ollama.model : DEFAULTS.ollama.model,
      timeoutMs: parseNumber(ollama.timeoutMs, DEFAULTS.ollama.timeoutMs),
    },
  };
}

export function resolveMemoryPaths(params: { agentRootDir: string; config: MemoryCoreConfig }): {
  memoryDir: string;
  memoryFile: string;
  recentDir: string;
} {
  const base = params.agentRootDir;
  const memoryDir = path.isAbsolute(params.config.memoryDir)
    ? params.config.memoryDir
    : path.join(base, params.config.memoryDir);
  const memoryFile = path.isAbsolute(params.config.memoryFile)
    ? params.config.memoryFile
    : path.join(base, params.config.memoryFile);
  return {
    memoryDir,
    memoryFile,
    recentDir: path.join(memoryDir, "recent"),
  };
}

export const memoryCoreConfigSchema = {
  parse: parseMemoryCoreConfig,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      timezone: { type: "string" },
      language: { type: "string", enum: ["ru", "en"] },
      memoryDir: { type: "string" },
      memoryFile: { type: "string" },
      recent: {
        type: "object",
        additionalProperties: false,
        properties: {
          maxDays: { type: "number" },
        },
      },
      promote: {
        type: "object",
        additionalProperties: false,
        properties: {
          intervalHours: { type: "number" },
          aggressiveness: { type: "string", enum: ["broad", "narrow"] },
          mode: { type: "string", enum: ["ollama", "rules"] },
          messageThreshold: { type: "number" },
          onCompaction: { type: "boolean" },
        },
      },
      clarify: {
        type: "object",
        additionalProperties: false,
        properties: {
          minMessages: { type: "number" },
        },
      },
      ollama: {
        type: "object",
        additionalProperties: false,
        properties: {
          baseUrl: { type: "string" },
          model: { type: "string" },
          timeoutMs: { type: "number" },
        },
      },
    },
  },
  uiHints: {
    timezone: {
      label: "Timezone",
      help: "Timezone for daily log filenames",
    },
    language: {
      label: "Language",
      help: "Language used in prompts (ru/en)",
    },
    memoryDir: {
      label: "Daily log directory",
      help: "Relative to agent root (~/ .openclaw/agents/<id>) by default",
      advanced: true,
    },
    memoryFile: {
      label: "Memory file",
      help: "Relative to agent root by default",
      advanced: true,
    },
    "recent.maxDays": {
      label: "Recent index max days",
      help: "Number of days to keep in the recent index",
      advanced: true,
    },
    "promote.intervalHours": {
      label: "Promotion interval (hours)",
    },
    "promote.aggressiveness": {
      label: "Promotion aggressiveness",
    },
    "promote.mode": {
      label: "Promotion mode",
      help: "ollama (LLM classification) or rules (auto-promote all entries)",
    },
    "promote.messageThreshold": {
      label: "Promotion message threshold",
      help: "Trigger promotion every N messages (default: 50)",
      advanced: true,
    },
    "promote.onCompaction": {
      label: "Promotion on compaction",
      help: "Trigger promotion after compaction events (default: true)",
      advanced: true,
    },

    "clarify.minMessages": {
      label: "Clarification rate-limit",
      help: "Minimum messages between clarification questions",
      advanced: true,
    },
    "ollama.baseUrl": {
      label: "Ollama base URL",
      placeholder: "http://127.0.0.1:11434",
    },
    "ollama.model": {
      label: "Ollama model",
      placeholder: "qwen2.5:3b-instruct",
    },
    "ollama.timeoutMs": {
      label: "Ollama timeout (ms)",
      advanced: true,
    },
  },
};
