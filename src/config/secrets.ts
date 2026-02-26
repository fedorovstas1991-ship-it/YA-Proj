import { buildSecretRef, isSecretRef } from "../infra/secrets/ref.js";
import type { SecretStore } from "../infra/secrets/store.js";
import { REDACTED_SENTINEL } from "./redact-snapshot.js";

const SENSITIVE_KEY_PATTERNS = [/token/i, /password/i, /secret/i, /api.?key/i];

function createMissingSecretError(ref: string): Error & { code: string } {
  const error = new Error(`Missing secret for ref "${ref}"`) as Error & { code: string };
  error.code = "OPENCLAW_SECRET_MISSING";
  return error;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function normalizeSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return normalized || "main";
}

function buildConfigSecretRef(pathSegments: string[], key: string): string {
  if (pathSegments[0] === "channels" && pathSegments[1]) {
    const provider = normalizeSegment(pathSegments[1]);
    const scope = normalizeSegment([...pathSegments.slice(2), key].join("."));
    return buildSecretRef({ namespace: "ya", provider, scope });
  }

  if (pathSegments[0] === "models" && pathSegments[1] === "providers" && pathSegments[2]) {
    const provider = normalizeSegment(pathSegments[2]);
    const scope = normalizeSegment([...pathSegments.slice(3), key].join(".") || key);
    return buildSecretRef({ namespace: "ya", provider, scope });
  }

  const provider = "config";
  const scope = normalizeSegment([...pathSegments, key].join("."));
  return buildSecretRef({ namespace: "ya", provider, scope });
}

function externalizeValue(value: unknown, store: SecretStore, pathSegments: string[]): unknown {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => externalizeValue(entry, store, [...pathSegments, String(index)]));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (
      isSensitiveKey(key) &&
      typeof nested === "string" &&
      nested.trim() &&
      nested !== REDACTED_SENTINEL &&
      !isSecretRef(nested)
    ) {
      if (!store.available) {
        output[key] = nested;
        continue;
      }
      const ref = buildConfigSecretRef(pathSegments, key);
      store.set(ref, nested.trim());
      output[key] = ref;
      continue;
    }
    if (nested && typeof nested === "object") {
      output[key] = externalizeValue(nested, store, [...pathSegments, key]);
      continue;
    }
    output[key] = nested;
  }
  return output;
}

function hydrateValue(value: unknown, store: SecretStore, pathSegments: string[]): unknown {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => hydrateValue(entry, store, [...pathSegments, String(index)]));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key) && typeof nested === "string" && isSecretRef(nested)) {
      const resolved = store.get(nested);
      if (!resolved) {
        throw createMissingSecretError(nested);
      }
      output[key] = resolved;
      continue;
    }
    if (nested && typeof nested === "object") {
      output[key] = hydrateValue(nested, store, [...pathSegments, key]);
      continue;
    }
    output[key] = nested;
  }
  return output;
}

export function externalizeConfigSecrets<T>(config: T, store: SecretStore): T {
  return externalizeValue(config, store, []) as T;
}

export function hydrateConfigSecretRefs<T>(config: T, store: SecretStore): T {
  return hydrateValue(config, store, []) as T;
}

export function hasPlaintextConfigSecrets(config: unknown): boolean {
  if (config === null || config === undefined || typeof config !== "object") {
    return false;
  }
  if (Array.isArray(config)) {
    return config.some((entry) => hasPlaintextConfigSecrets(entry));
  }
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (
      isSensitiveKey(key) &&
      typeof value === "string" &&
      value.trim() &&
      value !== REDACTED_SENTINEL &&
      !isSecretRef(value)
    ) {
      return true;
    }
    if (value && typeof value === "object" && hasPlaintextConfigSecrets(value)) {
      return true;
    }
  }
  return false;
}
