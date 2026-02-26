import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import path from "node:path";
import { extractDailyEntries } from "./capture.js";
import { memoryCoreConfigSchema, parseMemoryCoreConfig, resolveMemoryPaths } from "./config.js";
import { appendDailyEntry } from "./daily-log.js";
import { promoteEntries } from "./promote.js";
import { syncRecentIndex } from "./recent-index.js";
import { loadState, saveState } from "./state.js";

type TextBlock = { text?: string };

type MaybeMessage = {
  role?: string;
  content?: string | TextBlock[] | null;
};

function extractContentText(content: MaybeMessage["content"]): string {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) => (block && typeof block.text === "string" ? block.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractLastExchange(messages: unknown[]): unknown[] {
  const arr = messages as MaybeMessage[];
  let lastAssistant = -1;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.role === "assistant") {
      lastAssistant = i;
      break;
    }
  }
  if (lastAssistant === -1) return [];
  let lastUser = -1;
  for (let i = lastAssistant - 1; i >= 0; i--) {
    if (arr[i]?.role === "user") {
      lastUser = i;
      break;
    }
  }
  if (lastUser === -1) return [arr[lastAssistant]];
  return [arr[lastUser], arr[lastAssistant]];
}

function buildTranscript(messages: unknown[]): string {
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return "";
      }
      const { role, content } = message as MaybeMessage;
      if (role !== "user" && role !== "assistant") {
        return "";
      }
      const text = extractContentText(content);
      if (!text) {
        return "";
      }
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function resolveStatePath(stateDir: string): string {
  return path.join(stateDir, "memory-core");
}

const memoryCorePlugin = {
  id: "memory-core",
  name: "Memory (Core)",
  description: "File-backed memory search tools and CLI",
  kind: "memory",
  configSchema: memoryCoreConfigSchema,
  register(api: OpenClawPluginApi) {
    const cfg = parseMemoryCoreConfig(api.pluginConfig ?? {});

    api.registerTool(
      (ctx) => {
        const memorySearchTool = api.runtime.tools.createMemorySearchTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        const memoryGetTool = api.runtime.tools.createMemoryGetTool({
          config: ctx.config,
          agentSessionKey: ctx.sessionKey,
        });
        if (!memorySearchTool || !memoryGetTool) {
          return null;
        }
        return [memorySearchTool, memoryGetTool];
      },
      { names: ["memory_search", "memory_get"] },
    );

    api.registerCli(
      ({ program }) => {
        api.runtime.tools.registerMemoryCli(program);
      },
      { commands: ["memory"] },
    );

    api.on("message_received", async () => {
      const stateDir = api.runtime.state.resolveStateDir();
      const statePath = resolveStatePath(stateDir);
      const state = await loadState(statePath);
      state.messagesSinceClarify += 1;
      state.messagesSincePromote += 1;
      await saveState(statePath, state);
    });

    api.on("before_agent_start", async (_event, ctx) => {
      const stateDir = api.runtime.state.resolveStateDir();
      const statePath = resolveStatePath(stateDir);
      const state = await loadState(statePath);
      if (!state.pendingQuestion) {
        return undefined;
      }

      const question = state.pendingQuestion;
      state.pendingQuestion = undefined;
      state.messagesSinceClarify = 0;
      await saveState(statePath, state);

      const prompt =
        cfg.language === "ru"
          ? `Задай пользователю уточняющий вопрос: ${question}`
          : `Ask the user a clarification question: ${question}`;

      return {
        prependContext: `<memory-clarification>${prompt}</memory-clarification>`,
      };
    });

    api.on("agent_end", async (event, ctx) => {
      if (!event.success || !event.messages || event.messages.length === 0) {
        return;
      }
      const workspaceDir = ctx.workspaceDir ?? process.cwd();
      const { memoryDir, memoryFile } = resolveMemoryPaths({ agentRootDir: workspaceDir, config: cfg });
      const transcript = buildTranscript(extractLastExchange(event.messages));
      if (!transcript.trim()) {
        return;
      }

      try {
        const capture = await extractDailyEntries({
          baseUrl: cfg.ollama.baseUrl,
          model: cfg.ollama.model,
          timeoutMs: cfg.ollama.timeoutMs,
          language: cfg.language,
          transcript,
        });

        for (const fact of capture.facts) {
          await appendDailyEntry({
            memoryDir,
            timezone: cfg.timezone,
            kind: "Facts",
            text: fact,
          });
        }
        for (const decision of capture.decisions) {
          await appendDailyEntry({
            memoryDir,
            timezone: cfg.timezone,
            kind: "Decisions",
            text: decision,
          });
        }
        for (const todo of capture.todos) {
          await appendDailyEntry({
            memoryDir,
            timezone: cfg.timezone,
            kind: "Todos",
            text: todo,
          });
        }
      } catch (err) {
        api.logger.warn(`memory-core: capture failed: ${String(err)}`);
      }

      // Промоушен по сообщениям или компакту
      const stateDir = api.runtime.state.resolveStateDir();
      const statePath = resolveStatePath(stateDir);
      const state = await loadState(statePath);

      let shouldPromote = false;
      
      // Проверка по счётчику сообщений
      if (state.messagesSincePromote >= cfg.promote.messageThreshold) {
        shouldPromote = true;
        api.logger.info(`memory-core: promoting due to message threshold (${state.messagesSincePromote} messages)`);
      }
      
      // Проверка по компакту
      if ((event as any).compactionCompleted && cfg.promote.onCompaction) {
        shouldPromote = true;
        api.logger.info(`memory-core: promoting due to compaction`);
      }

      if (shouldPromote) {
        try {
          const result = await promoteEntries({
            memoryDir,
            memoryFile,
            since: state.lastPromotedAt,
            baseUrl: cfg.ollama.baseUrl,
            model: cfg.ollama.model,
            aggressiveness: cfg.promote.aggressiveness,
            timeoutMs: cfg.ollama.timeoutMs,
            mode: cfg.promote.mode,
          });
          state.lastPromotedAt = result.lastSeen;
          state.messagesSincePromote = 0;
          if (!state.pendingQuestion && result.questions.length > 0) {
            if (state.messagesSinceClarify >= cfg.clarify.minMessages) {
              state.pendingQuestion = result.questions[0];
            }
          }
          await saveState(statePath, state);
        } catch (err) {
          api.logger.warn(`memory-core: promote failed: ${String(err)}`);
        }
      }
    });

    let promoteTimer: NodeJS.Timeout | null = null;
    let indexTimer: NodeJS.Timeout | null = null;

    api.registerService({
      id: "memory-core",
      start: async (ctx) => {
        const workspaceDir = ctx.workspaceDir ?? process.cwd();
        const paths = resolveMemoryPaths({ agentRootDir: workspaceDir, config: cfg });
        const statePath = resolveStatePath(ctx.stateDir);

        const promote = async () => {
          const state = await loadState(statePath);
          const result = await promoteEntries({
            memoryDir: paths.memoryDir,
            memoryFile: paths.memoryFile,
            since: state.lastPromotedAt,
            baseUrl: cfg.ollama.baseUrl,
            model: cfg.ollama.model,
            aggressiveness: cfg.promote.aggressiveness,
            timeoutMs: cfg.ollama.timeoutMs,
            mode: cfg.promote.mode,
          });
          state.lastPromotedAt = result.lastSeen;
          if (!state.pendingQuestion && result.questions.length > 0) {
            if (state.messagesSinceClarify >= cfg.clarify.minMessages) {
              state.pendingQuestion = result.questions[0];
            }
          }
          await saveState(statePath, state);
        };

        await syncRecentIndex({
          memoryDir: paths.memoryDir,
          recentDir: paths.recentDir,
          maxDays: cfg.recent.maxDays,
        });

        // Убрали таймер промоушена - теперь промоушен по сообщениям и компакту
        indexTimer = setInterval(
          () => {
            void syncRecentIndex({
              memoryDir: paths.memoryDir,
              recentDir: paths.recentDir,
              maxDays: cfg.recent.maxDays,
            }).catch(() => undefined);
          },
          6 * 60 * 60 * 1000,
        );
      },
      stop: async () => {
        if (promoteTimer) {
          clearInterval(promoteTimer);
          promoteTimer = null;
        }
        if (indexTimer) {
          clearInterval(indexTimer);
          indexTimer = null;
        }
      },
    });
  },
};

export default memoryCorePlugin;
