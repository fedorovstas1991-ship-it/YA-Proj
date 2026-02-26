import { describe, expect, it } from "vitest";
import { buildKimiOnboardingPatch } from "./onboarding-wizard.js";

describe("onboarding-wizard patch", () => {
  it("builds openrouter + kimi patch with provided token", () => {
    const patch = buildKimiOnboardingPatch("y1__xDov6eRpdT1234567890");
    const openrouter = patch.models.providers.openrouter;

    expect(patch.models.mode).toBe("replace");
    expect(openrouter.baseUrl).toBe("https://api.eliza.yandex.net/raw/openrouter/v1");
    expect(openrouter.api).toBe("openai-completions");
    expect(openrouter.apiKey).toBe("y1__xDov6eRpdT1234567890");
    expect(openrouter.models).toEqual([
      {
        id: "moonshotai/kimi-k2.5",
        name: "Kimi K2.5",
        api: "openai-completions",
        input: ["text", "image"],
        reasoning: true,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ]);
    expect(patch.agents.defaults.model.primary).toBe("openrouter/moonshotai/kimi-k2.5");
    expect(patch.plugins.slots.memory).toBe("none");
  });
});
