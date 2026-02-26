import fs from "node:fs/promises";
import path from "node:path";

export async function syncRecentIndex(params: {
  memoryDir: string;
  recentDir: string;
  now?: Date;
  maxDays?: number;
}): Promise<void> {
  const now = params.now ?? new Date();
  const maxDays = params.maxDays ?? 90;
  await fs.mkdir(params.recentDir, { recursive: true });
  const files = (await fs.readdir(params.memoryDir)).filter((f) => f.endsWith(".md"));
  const cutoff = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000).getTime();

  const keep = new Set<string>();
  for (const file of files) {
    const date = Date.parse(file.replace(".md", "T00:00:00Z"));
    if (!Number.isFinite(date) || date < cutoff) {
      continue;
    }
    keep.add(file);
    const src = path.join(params.memoryDir, file);
    const dest = path.join(params.recentDir, file);
    await fs.link(src, dest).catch(() => undefined);
  }

  const existing = (await fs.readdir(params.recentDir)).filter((f) => f.endsWith(".md"));
  for (const file of existing) {
    if (!keep.has(file)) {
      await fs.rm(path.join(params.recentDir, file), { force: true });
    }
  }
}
