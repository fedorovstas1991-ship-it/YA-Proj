import { describe, expect, it } from "vitest";
import {
  NDA_BASE_URL,
  NDA_MAX_INPUT_TOKENS,
  NDA_MODEL_ID,
  NDA_MODEL_REF,
  NDA_PROVIDER,
  buildNdaModelsPatch,
} from "./nda-preset.js";

describe("nda preset", () => {
  it("builds internal provider patch with shared api key ref", () => {
    const patch = buildNdaModelsPatch("secret://ya/openrouter/apikey");
    const provider = patch.models.providers[NDA_PROVIDER];

    expect(provider.baseUrl).toBe(NDA_BASE_URL);
    expect(provider.api).toBe("openai-completions");
    expect(provider.apiKey).toBe("secret://ya/openrouter/apikey");
    expect(provider.models[0]).toMatchObject({
      id: NDA_MODEL_ID,
      api: "openai-completions",
      contextWindow: 128000,
      maxTokens: NDA_MAX_INPUT_TOKENS,
    });
    expect(NDA_MODEL_REF).toBe(`${NDA_PROVIDER}/${NDA_MODEL_ID}`);
  });

  it("rejects empty api key ref", () => {
    expect(() => buildNdaModelsPatch("   ")).toThrow(/api key/i);
  });
});
