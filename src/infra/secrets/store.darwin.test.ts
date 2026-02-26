import { describe, expect, it } from "vitest";
import { createDarwinSecretStore } from "./store.darwin.js";

type ExecCall = { file: string; args: string[] };

describe("infra/secrets/store.darwin", () => {
  it("reads secret value through security find-generic-password", () => {
    const calls: ExecCall[] = [];
    const store = createDarwinSecretStore({
      execFileSync: (file, args) => {
        calls.push({ file, args: args.map(String) });
        return "token-123";
      },
    });

    const value = store.get("secret://ya/openrouter/main");

    expect(value).toBe("token-123");
    expect(calls).toEqual([
      {
        file: "security",
        args: [
          "find-generic-password",
          "-s",
          "YAgent Secrets",
          "-a",
          "ya/openrouter/main",
          "-w",
        ],
      },
    ]);
  });

  it("writes secret value through security add-generic-password", () => {
    const calls: ExecCall[] = [];
    const store = createDarwinSecretStore({
      execFileSync: (file, args) => {
        calls.push({ file, args: args.map(String) });
        return "";
      },
    });

    store.set("secret://ya/telegram/main", "123456:abc");

    expect(calls).toEqual([
      {
        file: "security",
        args: [
          "add-generic-password",
          "-U",
          "-s",
          "YAgent Secrets",
          "-a",
          "ya/telegram/main",
          "-w",
          "123456:abc",
        ],
      },
    ]);
  });

  it("deletes secret via security delete-generic-password", () => {
    const calls: ExecCall[] = [];
    const store = createDarwinSecretStore({
      execFileSync: (file, args) => {
        calls.push({ file, args: args.map(String) });
        return "";
      },
    });

    store.delete("secret://ya/openrouter/main");

    expect(calls).toEqual([
      {
        file: "security",
        args: [
          "delete-generic-password",
          "-s",
          "YAgent Secrets",
          "-a",
          "ya/openrouter/main",
        ],
      },
    ]);
  });
});
