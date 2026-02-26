import { describe, expect, it } from "vitest";
import {
  buildNdaToolPolicy,
  buildNdaToolsDenyList,
  isNdaToolPolicyReady,
  isNdaWebToolsDenyConfigured,
  NDA_LOCAL_MODEL_REF,
  NDA_OLLAMA_API_KEY_PLACEHOLDER,
  buildNdaOllamaProviderConfig,
  isNdaOllamaProviderReady,
  pickSharedApiKeyRef,
  resolveNdaRuntimeModelRef,
  sanitizeApiKeyCandidate,
} from "./nda-mode.ts";

describe("nda mode key selection", () => {
  it("drops redacted marker values", () => {
    expect(sanitizeApiKeyCandidate("__OPENCLAW_REDACTED__")).toBe("");
    expect(sanitizeApiKeyCandidate("secret://ya/openrouter/apikey")).toBe(
      "secret://ya/openrouter/apikey",
    );
  });

  it("falls back when all candidates are redacted", () => {
    const picked = pickSharedApiKeyRef([
      "__OPENCLAW_REDACTED__",
      "  __OPENCLAW_REDACTED__  ",
      "",
      null,
    ]);

    expect(picked).toBe("secret://ya/openrouter/apikey");
  });

  it("prefers first explicit non-redacted candidate", () => {
    const picked = pickSharedApiKeyRef([
      "__OPENCLAW_REDACTED__",
      "secret://ya/custom/key",
      "secret://ya/openrouter/apikey",
    ]);

    expect(picked).toBe("secret://ya/custom/key");
  });
});

describe("nda runtime model", () => {
  it("uses configured local ollama model when provided", () => {
    expect(resolveNdaRuntimeModelRef("ollama/qwen2.5:14b")).toBe("ollama/qwen2.5:14b");
  });

  it("falls back to local default when config points to non-ollama model", () => {
    expect(resolveNdaRuntimeModelRef("nda_internal/qwen3_235b_a22b")).toBe(NDA_LOCAL_MODEL_REF);
  });

  it("falls back to local default when model is empty", () => {
    expect(resolveNdaRuntimeModelRef("   ")).toBe(NDA_LOCAL_MODEL_REF);
    expect(resolveNdaRuntimeModelRef(null)).toBe(NDA_LOCAL_MODEL_REF);
  });
});

describe("nda ollama provider config", () => {
  it("marks provider as not ready when missing", () => {
    expect(isNdaOllamaProviderReady(null)).toBe(false);
  });

  it("marks provider as not ready when model is missing", () => {
    const provider = {
      baseUrl: "http://127.0.0.1:11434/v1",
      api: "openai-completions",
      apiKey: "ollama-local",
      models: [],
    };
    expect(isNdaOllamaProviderReady(provider)).toBe(false);
  });

  it("marks provider as ready when apiKey and nda model are configured", () => {
    const provider = {
      baseUrl: "http://127.0.0.1:11434/v1",
      api: "openai-completions",
      apiKey: "ollama-local",
      models: [{ id: "qwen2.5:7b-instruct" }],
    };
    expect(isNdaOllamaProviderReady(provider)).toBe(true);
  });

  it("builds provider config with placeholder api key when missing", () => {
    const provider = buildNdaOllamaProviderConfig(null);
    expect(provider.apiKey).toBe(NDA_OLLAMA_API_KEY_PLACEHOLDER);
    expect(provider.models[0]?.id).toBe("qwen2.5:7b-instruct");
  });

  it("preserves existing non-empty api key", () => {
    const provider = buildNdaOllamaProviderConfig({
      apiKey: "custom-key",
      models: [{ id: "qwen2.5:7b-instruct" }],
    });
    expect(provider.apiKey).toBe("custom-key");
  });
});

describe("nda tool policy", () => {
  it("detects web deny policy when group:web is set", () => {
    expect(isNdaWebToolsDenyConfigured(["group:web", "tts"])).toBe(true);
  });

  it("detects web deny policy when both web tools are denied", () => {
    expect(isNdaWebToolsDenyConfigured(["web_search", "web_fetch"])).toBe(true);
  });

  it("marks policy as not ready when deny list is empty", () => {
    expect(isNdaWebToolsDenyConfigured([])).toBe(false);
    expect(isNdaWebToolsDenyConfigured(null)).toBe(false);
  });

  it("adds group:web and tts when deny list is not ready", () => {
    expect(buildNdaToolsDenyList(["exec"])).toEqual([
      "exec",
      "group:web",
      "tts",
      "session_status",
    ]);
  });

  it("keeps deny list unchanged when already ready", () => {
    expect(buildNdaToolsDenyList(["group:web", "tts", "session_status", "exec"])).toEqual([
      "group:web",
      "tts",
      "session_status",
      "exec",
    ]);
  });

  it("marks full nda policy as ready only with minimal profile and deny entries", () => {
    expect(
      isNdaToolPolicyReady({ profile: "minimal", deny: ["group:web", "tts", "session_status"] }),
    ).toBe(true);
    expect(isNdaToolPolicyReady({ profile: "full", deny: ["group:web", "tts", "session_status"] })).toBe(
      false,
    );
    expect(isNdaToolPolicyReady({ profile: "minimal", deny: ["group:web"] })).toBe(false);
  });

  it("builds nda policy with minimal profile and required deny entries", () => {
    expect(buildNdaToolPolicy({ deny: ["exec"] })).toEqual({
      deny: ["exec", "group:web", "tts", "session_status"],
      profile: "minimal",
    });
  });
});
