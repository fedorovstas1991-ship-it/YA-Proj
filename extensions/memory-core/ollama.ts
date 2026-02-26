export type ClassificationResult = {
  text: string;
  promote: boolean;
  question?: string | null;
};

type RunParams = {
  baseUrl: string;
  model: string;
  prompt: string;
  input: string;
  timeoutMs: number;
};

export async function runClassification(params: RunParams): Promise<ClassificationResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await fetch(`${params.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: "Return ONLY valid JSON." },
          { role: "user", content: `${params.prompt}\n\n${params.input}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ollama error ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content ?? "";
    const parsed = JSON.parse(raw) as ClassificationResult[];
    return Array.isArray(parsed) ? parsed : [];
  } finally {
    clearTimeout(timer);
  }
}
