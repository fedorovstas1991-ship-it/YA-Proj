const REDACTED_MARKER = "__OPENCLAW_REDACTED__";
export const NDA_LOCAL_MODEL_REF = "ollama/qwen2.5:7b-instruct";
export const NDA_LOCAL_MODEL_ID = "qwen2.5:7b-instruct";
export const NDA_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
export const NDA_OLLAMA_API_KEY_PLACEHOLDER = "ollama-local";
export const NDA_WEB_TOOL_GROUP = "group:web";
export const NDA_TOOL_PROFILE = "minimal";
export const NDA_TTS_TOOL = "tts";
export const NDA_SESSION_STATUS_TOOL = "session_status";

type NdaOllamaProviderConfig = {
  baseUrl: string;
  api: "openai-completions";
  apiKey: string;
  models: Array<{
    id: string;
    name: string;
    reasoning: boolean;
    input: string[];
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    };
    contextWindow: number;
    maxTokens: number;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeToolList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function sanitizeApiKeyCandidate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(REDACTED_MARKER)) {
    return "";
  }
  return trimmed;
}

export function pickSharedApiKeyRef(
  candidates: unknown[],
  fallbackRef = "secret://ya/openrouter/apikey",
): string {
  for (const candidate of candidates) {
    const resolved = sanitizeApiKeyCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return sanitizeApiKeyCandidate(fallbackRef);
}

export function resolveNdaRuntimeModelRef(configuredModel: unknown): string {
  if (typeof configuredModel !== "string") {
    return NDA_LOCAL_MODEL_REF;
  }
  const normalized = configuredModel.trim();
  if (!normalized) {
    return NDA_LOCAL_MODEL_REF;
  }
  if (normalized.toLowerCase().startsWith("ollama/")) {
    return normalized;
  }
  return NDA_LOCAL_MODEL_REF;
}

export function isNdaOllamaProviderReady(providerConfig: unknown): boolean {
  const provider = asRecord(providerConfig);
  const apiKey = typeof provider?.apiKey === "string" ? provider.apiKey.trim() : "";
  if (!apiKey) {
    return false;
  }
  const models = Array.isArray(provider?.models) ? provider.models : [];
  return models.some((entry) => {
    const model = asRecord(entry);
    return typeof model?.id === "string" && model.id.trim() === NDA_LOCAL_MODEL_ID;
  });
}

export function buildNdaOllamaProviderConfig(existingProviderConfig: unknown): NdaOllamaProviderConfig {
  const existingProvider = asRecord(existingProviderConfig);
  const existingApiKey =
    typeof existingProvider?.apiKey === "string" ? existingProvider.apiKey.trim() : "";
  const apiKey = existingApiKey || NDA_OLLAMA_API_KEY_PLACEHOLDER;

  return {
    baseUrl: NDA_OLLAMA_BASE_URL,
    api: "openai-completions",
    apiKey,
    models: [
      {
        id: NDA_LOCAL_MODEL_ID,
        name: "Qwen 2.5 7B Instruct (local)",
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  };
}

export function isNdaWebToolsDenyConfigured(denyList: unknown): boolean {
  const normalized = normalizeToolList(denyList).map((entry) => entry.toLowerCase());
  if (normalized.includes(NDA_WEB_TOOL_GROUP)) {
    return true;
  }
  return normalized.includes("web_search") && normalized.includes("web_fetch");
}

export function buildNdaToolsDenyList(denyList: unknown): string[] {
  const normalized = normalizeToolList(denyList);
  const normalizedLower = normalized.map((entry) => entry.toLowerCase());
  const next = [...normalized];
  if (!isNdaWebToolsDenyConfigured(normalizedLower)) {
    next.push(NDA_WEB_TOOL_GROUP);
  }
  if (!normalizedLower.includes(NDA_TTS_TOOL)) {
    next.push(NDA_TTS_TOOL);
  }
  if (!normalizedLower.includes(NDA_SESSION_STATUS_TOOL)) {
    next.push(NDA_SESSION_STATUS_TOOL);
  }
  return next;
}

export function isNdaToolPolicyReady(toolsConfig: unknown): boolean {
  const tools = asRecord(toolsConfig);
  const profile = typeof tools?.profile === "string" ? tools.profile.trim().toLowerCase() : "";
  if (profile !== NDA_TOOL_PROFILE) {
    return false;
  }
  const denyLower = normalizeToolList(tools?.deny).map((entry) => entry.toLowerCase());
  return (
    denyLower.includes(NDA_TTS_TOOL) &&
    denyLower.includes(NDA_SESSION_STATUS_TOOL) &&
    isNdaWebToolsDenyConfigured(denyLower)
  );
}

export function buildNdaToolPolicy(toolsConfig: unknown): Record<string, unknown> {
  const tools = asRecord(toolsConfig);
  return {
    ...(tools ?? {}),
    profile: NDA_TOOL_PROFILE,
    deny: buildNdaToolsDenyList(tools?.deny),
  };
}
