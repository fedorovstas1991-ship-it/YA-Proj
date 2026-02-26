import { describe, expect, it } from "vitest";
import {
  buildQuotaInstructions,
  isConnectButtonEnabled,
  normalizeQuotaTokenInput,
} from "./onboarding-api-key.js";

describe("onboarding-api-key helpers", () => {
  it("normalizes and validates quota token input", () => {
    expect(normalizeQuotaTokenInput("  y1__xDov6eRpdT1234567890 ")).toBe("y1__xDov6eRpdT1234567890");
    expect(isConnectButtonEnabled("y1__xDov6eRpdT1234567890")).toBe(true);
    expect(isConnectButtonEnabled("sk-ant-123")).toBe(false);
    expect(isConnectButtonEnabled("")).toBe(false);
  });

  it("contains explicit quota onboarding steps", () => {
    const copy = buildQuotaInstructions();
    expect(copy).toContain("https://ai.yandex-team.ru/quota");
    expect(copy).toContain("Получить токен");
    expect(copy).toContain("y1_");
  });
});
