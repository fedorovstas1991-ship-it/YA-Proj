const REDACTED_MARKER = "__OPENCLAW_REDACTED__";

export function sanitizeApiKeyCandidate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(REDACTED_MARKER)) {
    return "";
  }
  return trimmed;
}

export function pickSharedApiKeyRef(
  candidates: unknown[],
  fallbackRef = "secret://ya/openrouter/apikey",
): string {
  for (const candidate of candidates) {
    const resolved = sanitizeApiKeyCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return sanitizeApiKeyCandidate(fallbackRef);
}
