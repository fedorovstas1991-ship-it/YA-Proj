import { describe, expect, it } from "vitest";
import { applyElizaOpenrouterKimiProviderConfig } from "./onboarding.js";

describe("runElizaOnboardingWizard config", () => {
  it("applies OpenRouter + Kimi defaults and preserves fallbacks", () => {
    const next = applyElizaOpenrouterKimiProviderConfig({
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4-5",
            fallbacks: ["openrouter/deepseek/deepseek-r1"],
          },
        },
      },
    });

    expect(next.models?.providers?.openrouter?.baseUrl).toBe(
      "https://api.eliza.yandex.net/raw/openrouter/v1",
    );
    expect(next.models?.providers?.openrouter?.api).toBe("openai-completions");
    expect(next.models?.providers?.openrouter?.models).toEqual([
      {
        id: "moonshotai/kimi-k2.5",
        name: "Kimi K2.5",
        api: "openai-completions",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ]);
    expect(next.agents?.defaults?.model).toEqual({
      primary: "openrouter/moonshotai/kimi-k2.5",
      fallbacks: ["openrouter/deepseek/deepseek-r1"],
    });
  });
});
