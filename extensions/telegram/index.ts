import type { ChannelPlugin, OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { ResolvedTelegramAccount } from "../../src/telegram/accounts.js";
import {
  listTelegramAccountIds,
  resolveDefaultTelegramAccountId,
  resolveTelegramAccount,
} from "../../src/telegram/accounts.js";
import { telegramOnboardingAdapter } from "../../src/channels/plugins/onboarding/telegram.js";
import { telegramOutbound } from "../../src/channels/plugins/outbound/telegram.js";
import { collectTelegramStatusIssues } from "../../src/channels/plugins/status-issues/telegram.js";
import { monitorTelegramProvider } from "../../src/telegram/monitor.js";
import { probeTelegram } from "../../src/telegram/probe.js";

const telegramPlugin: ChannelPlugin<ResolvedTelegramAccount> = {
  id: "telegram",
  meta: {
    id: "telegram",
    label: "Telegram",
    selectionLabel: "Telegram",
    docsPath: "/channels/telegram",
    blurb: "Connect via a Telegram bot token",
    order: 1,
    systemImage: "logo.telegram",
  },
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    reactions: true,
    reply: true,
    media: true,
    nativeCommands: true,
    blockStreaming: true,
  },
  onboarding: telegramOnboardingAdapter,
  config: {
    listAccountIds: (cfg) => listTelegramAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveTelegramAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultTelegramAccountId(cfg),
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => Boolean(account.token),
    unconfiguredReason: () => "Telegram bot token not configured",
    disabledReason: () => "Telegram is disabled",
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token),
      tokenSource: account.tokenSource !== "none" ? account.tokenSource : undefined,
      dmPolicy: account.config.dmPolicy,
      allowFrom: account.config.allowFrom?.map(String),
    }),
  },
  gateway: {
    startAccount: async ({ cfg, accountId, account, runtime, abortSignal }) => {
      await monitorTelegramProvider({
        token: account.token,
        accountId,
        config: cfg,
        runtime,
        abortSignal,
      });
    },
  },
  outbound: telegramOutbound,
  status: {
    probeAccount: async ({ account, timeoutMs }) => {
      return probeTelegram(account.token, timeoutMs, account.config.proxy);
    },
    collectStatusIssues: (accounts) => collectTelegramStatusIssues(accounts),
  },
};

const plugin = {
  id: "telegram",
  name: "Telegram",
  description: "Telegram channel plugin",
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: telegramPlugin });
  },
};

export default plugin;
