import fs from "node:fs/promises";
import path from "node:path";

export type DailyKind = "Facts" | "Decisions" | "Todos";

type AppendParams = {
  memoryDir: string;
  timezone: string;
  kind: DailyKind;
  text: string;
  now?: Date;
};

function formatDate(date: Date, timezone: string): { date: string; iso: string } {
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const y = parts.year;
  const m = parts.month;
  const d = parts.day;
  const h = parts.hour;
  const min = parts.minute;
  const s = parts.second;
  return {
    date: `${y}-${m}-${d}`,
    iso: `${y}-${m}-${d}T${h}:${min}:${s}+03:00`,
  };
}

function ensureSections(content: string): string {
  const hasFacts = content.includes("## Facts");
  const hasDecisions = content.includes("## Decisions");
  const hasTodos = content.includes("## Todos");
  let next = content.trimEnd();
  if (!next) {
    next = "# Daily Log\n\n";
  }
  if (!hasFacts) next += "\n## Facts\n";
  if (!hasDecisions) next += "\n## Decisions\n";
  if (!hasTodos) next += "\n## Todos\n";
  return `${next.trimEnd()}\n`;
}

function insertUnderHeading(content: string, heading: DailyKind, line: string): string {
  const marker = `## ${heading}`;
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return `${content.trimEnd()}\n${marker}\n${line}\n`;
  }
  const start = idx + marker.length;
  const next = content.slice(start);
  return content.slice(0, start) + "\n" + line + "\n" + next;
}

export async function appendDailyEntry(params: AppendParams): Promise<string> {
  await fs.mkdir(params.memoryDir, { recursive: true });
  const now = params.now ?? new Date();
  const stamp = formatDate(now, params.timezone);
  const filePath = path.join(params.memoryDir, `${stamp.date}.md`);
  const existing = await fs.readFile(filePath, "utf-8").catch(() => "");
  const base = ensureSections(existing);
  const line = `- [${stamp.iso}] ${params.text.trim()}`;
  const updated = insertUnderHeading(base, params.kind, line);
  await fs.writeFile(filePath, updated, "utf-8");
  return filePath;
}
