export const QUOTA_URL = "https://ai.yandex-team.ru/quota";
export const QUOTA_TOKEN_EXAMPLE = "y1__xDov6eRpdT...";

export const KIMI_PROVIDER = "openrouter";
export const KIMI_BASE_URL = "https://api.eliza.yandex.net/raw/openrouter/v1";
export const KIMI_MODEL_ID = "moonshotai/kimi-k2.5";
export const KIMI_MODEL_NAME = "Kimi K2.5";
export const KIMI_MODEL_REF = `${KIMI_PROVIDER}/${KIMI_MODEL_ID}`;

export function isLikelyYandexQuotaToken(value: string): boolean {
  const token = value.trim();
  return token.startsWith("y1_") && token.length >= 16;
}
