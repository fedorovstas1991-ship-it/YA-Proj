import { describe, expect, it } from "vitest";
import { buildSecretRef, isSecretRef, parseSecretRef } from "./ref.js";

describe("infra/secrets/ref", () => {
  it("detects and parses a valid secret ref", () => {
    const value = "secret://ya/openrouter/main";
    expect(isSecretRef(value)).toBe(true);
    expect(parseSecretRef(value)).toEqual({
      namespace: "ya",
      provider: "openrouter",
      scope: "main",
    });
  });

  it("returns null for invalid refs", () => {
    expect(isSecretRef("secret://bad")).toBe(false);
    expect(parseSecretRef("secret://bad")).toBeNull();
    expect(parseSecretRef("openrouter")).toBeNull();
  });

  it("builds canonical refs", () => {
    expect(
      buildSecretRef({
        namespace: "ya",
        provider: "telegram",
        scope: "main",
      }),
    ).toBe("secret://ya/telegram/main");
  });
});
