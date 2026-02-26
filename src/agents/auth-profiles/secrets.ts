import { buildSecretRef, isSecretRef } from "../../infra/secrets/ref.js";
import { getSecretStore } from "../../infra/secrets/store.js";
import type { AuthProfileCredential, AuthProfileStore, OAuthCredential } from "./types.js";

type SecretField = "key" | "token" | "access" | "refresh";

function normalizeSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "main"
  );
}

function buildProfileSecretRef(provider: string, profileId: string, field: SecretField): string {
  return buildSecretRef({
    namespace: "ya",
    provider: normalizeSegment(provider),
    scope: normalizeSegment(`auth.${profileId}.${field}`),
  });
}

function resolveSecretRefValue(ref: string): string {
  const store = getSecretStore();
  const value = store.get(ref);
  if (!value) {
    const error = new Error(`Missing auth secret for ref "${ref}"`) as Error & { code?: string };
    error.code = "OPENCLAW_SECRET_MISSING";
    throw error;
  }
  return value;
}

function externalizeSecretField(params: {
  provider: string;
  profileId: string;
  field: SecretField;
  value: string | undefined;
}): { value: string | undefined; mutated: boolean } {
  const raw = params.value?.trim();
  if (!raw) {
    return { value: params.value, mutated: false };
  }
  if (isSecretRef(raw)) {
    return { value: raw, mutated: false };
  }
  const store = getSecretStore();
  if (!store.available) {
    return { value: raw, mutated: false };
  }
  const ref = buildProfileSecretRef(params.provider, params.profileId, params.field);
  store.set(ref, raw);
  return { value: ref, mutated: true };
}

export function resolveCredentialSecretValue(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (!isSecretRef(normalized)) {
    return normalized;
  }
  return resolveSecretRefValue(normalized);
}

export function externalizeAuthCredentialSecrets(params: {
  profileId: string;
  credential: AuthProfileCredential;
}): {
  credential: AuthProfileCredential;
  mutated: boolean;
} {
  const { profileId, credential } = params;

  if (credential.type === "api_key") {
    const next = externalizeSecretField({
      provider: credential.provider,
      profileId,
      field: "key",
      value: credential.key,
    });
    return {
      credential: { ...credential, ...(next.value ? { key: next.value } : {}) },
      mutated: next.mutated,
    };
  }

  if (credential.type === "token") {
    const next = externalizeSecretField({
      provider: credential.provider,
      profileId,
      field: "token",
      value: credential.token,
    });
    return {
      credential: { ...credential, token: next.value ?? credential.token },
      mutated: next.mutated,
    };
  }

  const access = externalizeSecretField({
    provider: credential.provider,
    profileId,
    field: "access",
    value: credential.access,
  });
  const refresh = externalizeSecretField({
    provider: credential.provider,
    profileId,
    field: "refresh",
    value: credential.refresh,
  });
  return {
    credential: {
      ...credential,
      access: access.value ?? credential.access,
      refresh: refresh.value ?? credential.refresh,
    },
    mutated: access.mutated || refresh.mutated,
  };
}

export function externalizeAuthProfileStoreSecrets(store: AuthProfileStore): {
  store: AuthProfileStore;
  mutated: boolean;
} {
  let mutated = false;
  const nextProfiles: Record<string, AuthProfileCredential> = {};
  for (const [profileId, credential] of Object.entries(store.profiles)) {
    const next = externalizeAuthCredentialSecrets({ profileId, credential });
    nextProfiles[profileId] = next.credential;
    if (next.mutated) {
      mutated = true;
    }
  }
  if (!mutated) {
    return { store, mutated: false };
  }
  return {
    mutated: true,
    store: {
      ...store,
      profiles: nextProfiles,
    },
  };
}

export function resolveOAuthCredentialSecrets(credential: OAuthCredential): OAuthCredential {
  const access = resolveCredentialSecretValue(credential.access) ?? credential.access;
  const refresh = resolveCredentialSecretValue(credential.refresh) ?? credential.refresh;
  return {
    ...credential,
    access,
    refresh,
  };
}

export function hydrateAuthCredentialSecrets(credential: AuthProfileCredential): AuthProfileCredential {
  if (credential.type === "api_key") {
    const key = resolveCredentialSecretValue(credential.key);
    return {
      ...credential,
      ...(typeof key === "string" ? { key } : {}),
    };
  }
  if (credential.type === "token") {
    const token = resolveCredentialSecretValue(credential.token) ?? credential.token;
    return {
      ...credential,
      token,
    };
  }
  return resolveOAuthCredentialSecrets(credential);
}

export function hydrateAuthProfileStoreSecrets(store: AuthProfileStore): AuthProfileStore {
  const nextProfiles: Record<string, AuthProfileCredential> = {};
  let mutated = false;
  for (const [profileId, credential] of Object.entries(store.profiles)) {
    const hydrated = hydrateAuthCredentialSecrets(credential);
    nextProfiles[profileId] = hydrated;
    if (hydrated !== credential) {
      mutated = true;
    }
  }
  if (!mutated) {
    return store;
  }
  return {
    ...store,
    profiles: nextProfiles,
  };
}
