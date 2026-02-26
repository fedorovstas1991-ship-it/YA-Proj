export type SecretRefParts = {
  namespace: string;
  provider: string;
  scope: string;
};

const SECRET_REF_REGEX = /^secret:\/\/([a-z0-9_-]+)\/([a-z0-9._-]+)\/([a-z0-9._/-]+)$/i;
const SEGMENT_REGEX = /^[a-z0-9._-]+$/i;
const SCOPE_REGEX = /^[a-z0-9._/-]+$/i;

export function isSecretRef(value: unknown): value is string {
  return typeof value === "string" && SECRET_REF_REGEX.test(value.trim());
}

export function parseSecretRef(value: string): SecretRefParts | null {
  const match = SECRET_REF_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, namespace, provider, scope] = match;
  return {
    namespace: namespace.toLowerCase(),
    provider: provider.toLowerCase(),
    scope,
  };
}

export function buildSecretRef(parts: SecretRefParts): string {
  const namespace = parts.namespace.trim().toLowerCase();
  const provider = parts.provider.trim().toLowerCase();
  const scope = parts.scope.trim();

  if (!SEGMENT_REGEX.test(namespace)) {
    throw new Error(`Invalid secret namespace: ${parts.namespace}`);
  }
  if (!SEGMENT_REGEX.test(provider)) {
    throw new Error(`Invalid secret provider: ${parts.provider}`);
  }
  if (!SCOPE_REGEX.test(scope)) {
    throw new Error(`Invalid secret scope: ${parts.scope}`);
  }

  return `secret://${namespace}/${provider}/${scope}`;
}

export function toSecretAccount(parts: SecretRefParts): string {
  return `${parts.namespace}/${parts.provider}/${parts.scope}`;
}
