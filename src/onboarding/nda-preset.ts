export const NDA_PROVIDER = "nda_internal";
export const NDA_BASE_URL = "https://api.eliza.yandex.net/internal/zeliboba/qwen3_235b_a22b/v1";
export const NDA_MODEL_ID = "qwen3_235b_a22b";
export const NDA_MODEL_NAME = "Qwen3 235B A22B (NDA)";
export const NDA_MODEL_REF = `${NDA_PROVIDER}/${NDA_MODEL_ID}`;
export const NDA_CONTEXT_WINDOW = 128000;
export const NDA_MAX_INPUT_TOKENS = 40960;

export function buildNdaModelsPatch(sharedApiKeyRef: string) {
  const apiKeyRef = sharedApiKeyRef.trim();
  if (!apiKeyRef) {
    throw new Error("NDA preset requires shared API key reference.");
  }

  return {
    models: {
      providers: {
        [NDA_PROVIDER]: {
          baseUrl: NDA_BASE_URL,
          apiKey: apiKeyRef,
          api: "openai-completions",
          models: [
            {
              id: NDA_MODEL_ID,
              name: NDA_MODEL_NAME,
              api: "openai-completions",
              reasoning: true,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: NDA_CONTEXT_WINDOW,
              maxTokens: NDA_MAX_INPUT_TOKENS,
            },
          ],
        },
      },
    },
  };
}
