import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { parseSecretRef, toSecretAccount } from "./ref.js";
import type { SecretStore } from "./store.js";

const SERVICE_NAME = "YAgent Secrets";
const SECURITY_NOT_FOUND_STATUS = 44;

type ExecFileSyncFn = (
  file: string,
  args: readonly string[],
  options?: ExecFileSyncOptionsWithStringEncoding,
) => string;

function ensureAccount(ref: string): string {
  const parsed = parseSecretRef(ref);
  if (!parsed) {
    throw new Error(`Invalid secret ref: ${ref}`);
  }
  return toSecretAccount(parsed);
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybe = error as { status?: number; stderr?: string | Buffer };
  if (maybe.status === SECURITY_NOT_FOUND_STATUS) {
    return true;
  }
  const stderr =
    typeof maybe.stderr === "string"
      ? maybe.stderr
      : Buffer.isBuffer(maybe.stderr)
        ? maybe.stderr.toString("utf8")
        : "";
  return stderr.toLowerCase().includes("could not be found");
}

function runSecurity(execImpl: ExecFileSyncFn, args: string[]): string {
  return execImpl("security", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 8_000,
  }).trim();
}

export function createDarwinSecretStore(params?: { execFileSync?: ExecFileSyncFn }): SecretStore {
  const execImpl = params?.execFileSync ?? execFileSync;
  return {
    backend: "darwin-keychain",
    available: true,
    get(ref: string): string | null {
      const account = ensureAccount(ref);
      try {
        return runSecurity(execImpl, [
          "find-generic-password",
          "-s",
          SERVICE_NAME,
          "-a",
          account,
          "-w",
        ]);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw new Error(`Keychain read failed for ${ref}: ${String(error)}`);
      }
    },
    set(ref: string, value: string): void {
      const account = ensureAccount(ref);
      const normalized = value.trim();
      if (!normalized) {
        throw new Error(`Cannot store empty secret value for ${ref}`);
      }
      try {
        runSecurity(execImpl, [
          "add-generic-password",
          "-U",
          "-s",
          SERVICE_NAME,
          "-a",
          account,
          "-w",
          normalized,
        ]);
      } catch (error) {
        throw new Error(`Keychain write failed for ${ref}: ${String(error)}`);
      }
    },
    delete(ref: string): void {
      const account = ensureAccount(ref);
      try {
        runSecurity(execImpl, [
          "delete-generic-password",
          "-s",
          SERVICE_NAME,
          "-a",
          account,
        ]);
      } catch (error) {
        if (isNotFoundError(error)) {
          return;
        }
        throw new Error(`Keychain delete failed for ${ref}: ${String(error)}`);
      }
    },
    has(ref: string): boolean {
      return this.get(ref) !== null;
    },
  };
}
