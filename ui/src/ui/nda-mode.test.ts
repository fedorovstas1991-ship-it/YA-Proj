import { describe, expect, it } from "vitest";
import { pickSharedApiKeyRef, sanitizeApiKeyCandidate } from "./nda-mode.ts";

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
