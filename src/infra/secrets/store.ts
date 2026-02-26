import { createDarwinSecretStore } from "./store.darwin.js";

export type SecretStoreBackend = "darwin-keychain" | "disabled";

export type SecretStore = {
  backend: SecretStoreBackend;
  available: boolean;
  get(ref: string): string | null;
  set(ref: string, value: string): void;
  delete(ref: string): void;
  has(ref: string): boolean;
};

function createUnavailableSecretStore(reason: string): SecretStore {
  const fail = () => {
    const error = new Error(reason) as Error & { code?: string };
    error.code = "OPENCLAW_SECRET_STORE_UNAVAILABLE";
    throw error;
  };
  return {
    backend: "disabled",
    available: false,
    get: fail,
    set: fail,
    delete: fail,
    has: fail,
  };
}

export function resolveSecretStoreBackend(params?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): SecretStoreBackend {
  const env = params?.env ?? process.env;
  const platform = params?.platform ?? process.platform;
  const forced = env.OPENCLAW_SECRET_BACKEND?.trim().toLowerCase();
  if (forced === "disabled" || forced === "off" || forced === "0") {
    return "disabled";
  }
  if (forced === "darwin-keychain" || forced === "keychain") {
    return "darwin-keychain";
  }
  return platform === "darwin" ? "darwin-keychain" : "disabled";
}

let cachedStore: SecretStore | null = null;

export function clearSecretStoreCacheForTests(): void {
  cachedStore = null;
}

export function setSecretStoreForTests(store: SecretStore): void {
  cachedStore = store;
}

export function createSecretStore(params?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): SecretStore {
  const backend = resolveSecretStoreBackend(params);
  if (backend === "disabled") {
    return createUnavailableSecretStore(
      "Secret storage backend disabled. Enable macOS keychain or set OPENCLAW_SECRET_BACKEND.",
    );
  }
  if ((params?.platform ?? process.platform) !== "darwin") {
    return createUnavailableSecretStore("macOS Keychain backend is available only on darwin.");
  }
  return createDarwinSecretStore();
}

export function getSecretStore(params?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): SecretStore {
  if (cachedStore) {
    return cachedStore;
  }
  cachedStore = createSecretStore(params);
  return cachedStore;
}
