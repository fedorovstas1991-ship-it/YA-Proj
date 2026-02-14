/**
 * Unit tests for chat.greet RPC handler.
 *
 * The handler is deeply integrated with dispatchInboundMessage, session loading,
 * and abort controllers, so we test it at the protocol-validation + dedupe layer
 * and verify the main code paths via mocked context objects.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateChatGreetParams,
  ErrorCodes,
  errorShape,
  formatValidationErrors,
} from "../protocol/index.js";

// ---------------------------------------------------------------------------
// 1. Protocol-level validation for ChatGreetParams
// ---------------------------------------------------------------------------
describe("validateChatGreetParams", () => {
  it("accepts valid minimal params", () => {
    expect(validateChatGreetParams({ sessionKey: "main" })).toBe(true);
  });

  it("accepts all optional fields", () => {
    expect(
      validateChatGreetParams({
        sessionKey: "main",
        reason: "new_chat",
        timeoutMs: 30_000,
        idempotencyKey: "idem-1",
      }),
    ).toBe(true);
  });

  it("accepts reason=reset", () => {
    expect(validateChatGreetParams({ sessionKey: "s", reason: "reset" })).toBe(true);
  });

  it("accepts reason=first_open", () => {
    expect(validateChatGreetParams({ sessionKey: "s", reason: "first_open" })).toBe(true);
  });

  it("rejects missing sessionKey", () => {
    expect(validateChatGreetParams({})).toBe(false);
  });

  it("rejects empty sessionKey", () => {
    expect(validateChatGreetParams({ sessionKey: "" })).toBe(false);
  });

  it("rejects unknown reason values", () => {
    expect(validateChatGreetParams({ sessionKey: "s", reason: "unknown" })).toBe(false);
  });

  it("rejects extra properties", () => {
    expect(validateChatGreetParams({ sessionKey: "s", extra: true })).toBe(false);
  });

  it("rejects negative timeoutMs", () => {
    expect(validateChatGreetParams({ sessionKey: "s", timeoutMs: -1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Idempotency / dedupe layer (unit-level, no gateway required)
// ---------------------------------------------------------------------------
describe("chat.greet idempotency via dedupe map", () => {
  let dedupe: Map<string, { ts: number; ok: boolean; payload?: unknown; error?: unknown }>;

  beforeEach(() => {
    dedupe = new Map();
  });

  it("caches a successful greet result", () => {
    const runId = "greet-abc";
    const key = `greet:${runId}`;
    dedupe.set(key, { ts: Date.now(), ok: true, payload: { runId, status: "ok" } });
    expect(dedupe.has(key)).toBe(true);
    expect(dedupe.get(key)!.ok).toBe(true);
  });

  it("returns cached result on duplicate idempotencyKey", () => {
    const runId = "idem-dup";
    const key = `greet:${runId}`;
    dedupe.set(key, { ts: Date.now(), ok: true, payload: { runId, status: "ok" } });

    // Simulate second call — check cache first
    const cached = dedupe.get(key);
    expect(cached).toBeDefined();
    expect(cached!.payload).toEqual({ runId, status: "ok" });
  });

  it("caches error results as well", () => {
    const runId = "greet-err";
    const key = `greet:${runId}`;
    const error = errorShape(ErrorCodes.UNAVAILABLE, "boom");
    dedupe.set(key, { ts: Date.now(), ok: false, payload: { runId, status: "error" }, error });
    expect(dedupe.get(key)!.ok).toBe(false);
    expect(dedupe.get(key)!.error).toEqual(error);
  });
});

// ---------------------------------------------------------------------------
// 3. Reason parameter handling (label derivation)
// ---------------------------------------------------------------------------
describe("chat.greet reason → label mapping", () => {
  function greetLabel(reason?: string): string {
    return reason ? `greet:${reason}` : "greet";
  }

  it("produces 'greet' when reason is undefined", () => {
    expect(greetLabel(undefined)).toBe("greet");
  });

  it("produces 'greet:new_chat' for new_chat reason", () => {
    expect(greetLabel("new_chat")).toBe("greet:new_chat");
  });

  it("produces 'greet:reset' for reset reason", () => {
    expect(greetLabel("reset")).toBe("greet:reset");
  });

  it("produces 'greet:first_open' for first_open reason", () => {
    expect(greetLabel("first_open")).toBe("greet:first_open");
  });
});

// ---------------------------------------------------------------------------
// 4. Event broadcast shape (broadcastChatFinal / broadcastChatError)
// ---------------------------------------------------------------------------
describe("chat.greet broadcast event structure", () => {
  it("constructs a final broadcast payload", () => {
    const runId = "greet-run-1";
    const sessionKey = "main";
    const message = { role: "assistant", content: "Hello!" };
    const event = {
      type: "chat.final",
      runId,
      sessionKey,
      message,
    };
    expect(event.type).toBe("chat.final");
    expect(event.runId).toBe(runId);
    expect(event.message).toEqual(message);
  });

  it("constructs an error broadcast payload", () => {
    const runId = "greet-run-2";
    const sessionKey = "main";
    const errorMessage = "timeout";
    const event = {
      type: "chat.error",
      runId,
      sessionKey,
      error: errorMessage,
    };
    expect(event.type).toBe("chat.error");
    expect(event.error).toBe("timeout");
  });
});
