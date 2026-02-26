import { describe, expect, it } from "vitest";
import {
  KIMI_BASE_URL,
  KIMI_MODEL_ID,
  KIMI_MODEL_NAME,
  KIMI_MODEL_REF,
  KIMI_PROVIDER,
  QUOTA_TOKEN_EXAMPLE,
  QUOTA_URL,
  isLikelyYandexQuotaToken,
} from "./kimi-preset.js";

describe("kimi preset", () => {
  it("exposes expected OpenRouter defaults", () => {
    expect(QUOTA_URL).toBe("https://ai.yandex-team.ru/quota");
    expect(KIMI_PROVIDER).toBe("openrouter");
    expect(KIMI_BASE_URL).toBe("https://api.eliza.yandex.net/raw/openrouter/v1");
    expect(KIMI_MODEL_ID).toBe("moonshotai/kimi-k2.5");
    expect(KIMI_MODEL_NAME).toBe("Kimi K2.5");
    expect(KIMI_MODEL_REF).toBe("openrouter/moonshotai/kimi-k2.5");
    expect(QUOTA_TOKEN_EXAMPLE.startsWith("y1_")).toBe(true);
  });

  it("validates likely quota token format", () => {
    expect(isLikelyYandexQuotaToken("y1__xDov6eRpdT1234567890")).toBe(true);
    expect(isLikelyYandexQuotaToken(" y1_token_1234567890 ")).toBe(true);
    expect(isLikelyYandexQuotaToken("")).toBe(false);
    expect(isLikelyYandexQuotaToken("sk-ant-123")).toBe(false);
  });
});
