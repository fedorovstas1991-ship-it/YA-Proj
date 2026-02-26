import fs from "node:fs/promises";
import path from "node:path";
import { runClassification } from "./ollama.js";

const DAILY_LINE_REGEX = /^- \[(.+?)\]\s+(.*)$/;

type PromoteParams = {
  memoryDir: string;
  memoryFile: string;
  since: number;
  baseUrl: string;
  model: string;
  aggressiveness: "broad" | "narrow";
  timeoutMs?: number;
  mode: "ollama" | "rules";
};

type DailyEntry = {
  text: string;
  ts: number;
};

function parseDailyEntries(content: string, since: number): DailyEntry[] {
  const entries: DailyEntry[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(DAILY_LINE_REGEX);
    if (!match) continue;
    const ts = Date.parse(match[1] ?? "");
    if (!Number.isFinite(ts) || ts <= since) continue;
    const text = (match[2] ?? "").trim();
    if (!text) continue;
    entries.push({ ts, text });
  }
  return entries;
}

function buildPrompt(aggressiveness: "broad" | "narrow"): string {
  if (aggressiveness === "narrow") {
    return "Ты классификатор памяти. Промоутируй только критически важное. Верни JSON массив: [{text,promote,question}]";
  }
  return "Ты классификатор памяти. Агрессивно промоутируй важные факты/предпочтения/решения/проекты/контакты. Верни JSON массив: [{text,promote,question}]";
}

async function readDailyEntries(memoryDir: string, since: number): Promise<DailyEntry[]> {
  const entries: DailyEntry[] = [];
  const files = await fs.readdir(memoryDir, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    const content = await fs.readFile(path.join(memoryDir, file.name), "utf-8");
    entries.push(...parseDailyEntries(content, since));
  }
  return entries;
}

function normalizeQuestions(questions: Array<string | null | undefined>): string[] {
  return questions.map((q) => (typeof q === "string" ? q.trim() : "")).filter(Boolean);
}

export async function promoteEntries(
  params: PromoteParams,
): Promise<{ lastSeen: number; questions: string[] }> {
  const entries = await readDailyEntries(params.memoryDir, params.since);
  if (entries.length === 0) {
    return { lastSeen: params.since, questions: [] };
  }

  let results: ClassificationResult[] = [];
  if (params.mode === "rules") {
    results = entries.map((entry) => ({ text: entry.text, promote: true, question: null }));
  } else {
    const prompt = buildPrompt(params.aggressiveness);
    results = await runClassification({
      baseUrl: params.baseUrl,
      model: params.model,
      timeoutMs: params.timeoutMs ?? 30_000,
      prompt,
      input: JSON.stringify(entries, null, 2),
    });
  }

  let memory = await fs.readFile(params.memoryFile, "utf-8").catch(() => "");
  if (!memory.trim()) {
    memory = "# MEMORY.md\n\n";
  }

  const questions = normalizeQuestions(results.map((entry) => entry.question));
  for (const entry of results) {
    if (!entry.promote) continue;
    const text = entry.text.trim();
    if (!text) continue;
    memory += `- ${text}\n`;
  }
  await fs.writeFile(params.memoryFile, memory, "utf-8");

  const lastSeen = entries.reduce((acc, entry) => Math.max(acc, entry.ts), params.since);
  return { lastSeen, questions };
}
