export type DailyCapture = {
  facts: string[];
  decisions: string[];
  todos: string[];
};

type CaptureParams = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  language: "ru" | "en";
  transcript: string;
};

export async function extractDailyEntries(params: CaptureParams): Promise<DailyCapture> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const prompt =
      params.language === "ru"
        ? "Выдели факты/решения/задачи из диалога. Верни JSON {facts:[], decisions:[], todos:[]}."
        : "Extract facts/decisions/todos from the dialogue. Return JSON {facts:[], decisions:[], todos:[]}.";

    const res = await fetch(`${params.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        messages: [
          { role: "system", content: "Return ONLY valid JSON." },
          { role: "user", content: `${prompt}\n\n${params.transcript}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ollama error ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content ?? "";
    const parsed = JSON.parse(raw) as DailyCapture;
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    };
  } finally {
    clearTimeout(timer);
  }
}
