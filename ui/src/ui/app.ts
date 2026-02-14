import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { EventLogEntry } from "./app-events.ts";
import type { AppViewState } from "./app-view-state.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import type { ResolvedTheme, ThemeMode } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
  NostrProfile,
} from "./types.ts";
import type { WizardStep } from "./types.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import { normalizeAgentId } from "../../../src/routing/session-key.js";
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal,
} from "./app-channels.ts";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
} from "./app-chat.ts";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults.ts";
import { connectGateway as connectGatewayInternal } from "./app-gateway.ts";
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated,
} from "./app-lifecycle.ts";
import { renderApp } from "./app-render.ts";
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal,
} from "./app-scroll.ts";
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  onPopState as onPopStateInternal,
} from "./app-settings.ts";
import {
  resetToolStream as resetToolStreamInternal,
  type ToolStreamEntry,
  type CompactionStatus,
} from "./app-tool-stream.ts";
import { resolveInjectedAssistantIdentity } from "./assistant-identity.ts";
import { loadAssistantIdentity as loadAssistantIdentityInternal } from "./controllers/assistant-identity.ts";
import { loadConfig as loadConfigInternal } from "./controllers/config.ts";
import {
  advanceOnboardingWizard as advanceOnboardingWizardInternal,
  cancelOnboardingWizard as cancelOnboardingWizardInternal,
  setOnboardingWizardDone as setOnboardingWizardDoneInternal,
  startOnboardingWizard as startOnboardingWizardInternal,
} from "./controllers/onboarding.ts";
import { loadSettings, type UiSettings } from "./storage.ts";
import { type ChatAttachment, type ChatQueueItem, type CronFormState } from "./ui-types.ts";

declare global {
  interface Window {
    __OPENCLAW_CONTROL_UI_BASE_PATH__?: string;
  }
}

const injectedAssistantIdentity = resolveInjectedAssistantIdentity();

function resolveOnboardingMode(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("onboarding");
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveSimpleMode(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("simple");
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveProductMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("simple") === "1") {
    return false;
  }
  if (params.get("legacy") === "1" || params.get("dev") === "1") {
    return false;
  }
  const pathname = window.location.pathname || "/";
  // Default to product UI on root path only. Legacy tabs remain available at /chat, /channels, etc.
  return pathname === "/" || pathname.endsWith("/index.html");
}

const SIMPLE_ONBOARDING_DONE_KEY = "openclaw.control.simple.onboarding.done.v1";

function loadSimpleOnboardingDone(): boolean {
  if (resolveOnboardingMode()) {
    return false;
  }
  try {
    return localStorage.getItem(SIMPLE_ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSimpleOnboardingDone(next: boolean) {
  try {
    if (next) {
      localStorage.setItem(SIMPLE_ONBOARDING_DONE_KEY, "1");
      return;
    }
    localStorage.removeItem(SIMPLE_ONBOARDING_DONE_KEY);
  } catch {
    // Ignore localStorage errors in privacy-restricted environments.
  }
}

@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  @state() settings: UiSettings = loadSettings();
  @state() password = "";
  @state() tab: Tab = "chat";
  @state() onboarding = resolveOnboardingMode();
  @state() simpleMode = resolveSimpleMode();
  @state() productMode = resolveProductMode();
  @state() simpleOnboardingDone = loadSimpleOnboardingDone();
  @state() simpleDevToolsOpen = false;
  @state() productPanel: "chat" | "projects" | "telegram" = "chat";
  @state() productDevDrawerOpen = false;
  @state() productAgentId: string | null = null;
  @state() productCreateProjectOpen = false;
  @state() productCreateProjectName = "";
  @state() productCreateProjectDesc = "";
  @state() productSessionsLoading = false;
  @state() productSessionsError: string | null = null;
  @state() productSessionsResult: SessionsListResult | null = null;
  @state() productTelegramToken = "";
  @state() productTelegramAllowFrom = "";
  @state() productTelegramBusy = false;
  @state() productTelegramError: string | null = null;
  @state() productTelegramSuccess: string | null = null;
  @state() productProjects: Array<{
    id: string;
    name: string;
    expanded?: boolean;
    sessionKeys?: string[];
  }> = [];
  @state() productProjectsLoading = false;
  @state() productProjectsError: string | null = null;
  @state() productEditingProjectId: string | null = null;
  @state() productCollapsedProjects = new Set<string>();
  @state() connected = false;
  @state() theme: ThemeMode = this.settings.theme ?? "system";
  @state() themeResolved: ResolvedTheme = "dark";
  @state() hello: GatewayHelloOk | null = null;
  @state() lastError: string | null = null;
  @state() eventLog: EventLogEntry[] = [];
  private eventLogBuffer: EventLogEntry[] = [];
  private toolStreamSyncTimer: number | null = null;
  private sidebarCloseTimer: number | null = null;

  @state() assistantName = injectedAssistantIdentity.name;
  @state() assistantAvatar = injectedAssistantIdentity.avatar;
  @state() assistantAgentId = injectedAssistantIdentity.agentId ?? null;

  @state() sessionKey = this.settings.sessionKey;
  @state() chatLoading = false;
  @state() chatSending = false;
  @state() chatMessage = "";
  @state() chatMessages: unknown[] = [];
  @state() chatToolMessages: unknown[] = [];
  @state() chatStream: string | null = null;
  @state() chatStreamStartedAt: number | null = null;
  @state() chatRunId: string | null = null;
  @state() compactionStatus: CompactionStatus | null = null;
  @state() chatAvatarUrl: string | null = null;
  @state() chatThinkingLevel: string | null = null;
  @state() chatQueue: ChatQueueItem[] = [];
  @state() chatAttachments: ChatAttachment[] = [];
  @state() chatManualRefreshInFlight = false;
  @state() onboardingWizardSessionId: string | null = null;
  @state() onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error" = "idle";
  @state() onboardingWizardStep: WizardStep | null = null;
  @state() onboardingWizardError: string | null = null;
  @state() onboardingWizardBusy = false;
  @state() onboardingWizardMode: "local" | "remote" = "local";
  @state() onboardingWizardFlow: string = "";
  @state() onboardingWizardWorkspace = "";
  @state() onboardingWizardResetConfig = true;
  @state() onboardingWizardTextAnswer = "";
  @state() onboardingWizardMultiAnswers: number[] = [];
  @state() onboardingWizardCurrentStep = 0;
  @state() onboardingWizardTotalSteps = 0;
  // Sidebar state for tool output viewing
  @state() sidebarOpen = false;
  @state() sidebarContent: string | null = null;
  @state() sidebarError: string | null = null;
  @state() splitRatio = this.settings.splitRatio;

  @state() nodesLoading = false;
  @state() nodes: Array<Record<string, unknown>> = [];
  @state() devicesLoading = false;
  @state() devicesError: string | null = null;
  @state() devicesList: DevicePairingList | null = null;
  @state() execApprovalsLoading = false;
  @state() execApprovalsSaving = false;
  @state() execApprovalsDirty = false;
  @state() execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() execApprovalsForm: ExecApprovalsFile | null = null;
  @state() execApprovalsSelectedAgent: string | null = null;
  @state() execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() execApprovalsTargetNodeId: string | null = null;
  @state() execApprovalQueue: ExecApprovalRequest[] = [];
  @state() execApprovalBusy = false;
  @state() execApprovalError: string | null = null;
  @state() pendingGatewayUrl: string | null = null;

  @state() configLoading = false;
  @state() configRaw = "{\n}\n";
  @state() configRawOriginal = "";
  @state() configValid: boolean | null = null;
  @state() configIssues: unknown[] = [];
  @state() configSaving = false;
  @state() configApplying = false;
  @state() updateRunning = false;
  @state() applySessionKey = this.settings.lastActiveSessionKey;
  @state() configSnapshot: ConfigSnapshot | null = null;
  @state() configSchema: unknown = null;
  @state() configSchemaVersion: string | null = null;
  @state() configSchemaLoading = false;
  @state() configUiHints: ConfigUiHints = {};
  @state() configForm: Record<string, unknown> | null = null;
  @state() configFormOriginal: Record<string, unknown> | null = null;
  @state() configFormDirty = false;
  @state() configFormMode: "form" | "raw" = "form";
  @state() configSearchQuery = "";
  @state() configActiveSection: string | null = null;
  @state() configActiveSubsection: string | null = null;

  @state() channelsLoading = false;
  @state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() channelsError: string | null = null;
  @state() channelsLastSuccess: number | null = null;
  @state() whatsappLoginMessage: string | null = null;
  @state() whatsappLoginQrDataUrl: string | null = null;
  @state() whatsappLoginConnected: boolean | null = null;
  @state() whatsappBusy = false;
  @state() nostrProfileFormState: NostrProfileFormState | null = null;
  @state() nostrProfileAccountId: string | null = null;

  @state() presenceLoading = false;
  @state() presenceEntries: PresenceEntry[] = [];
  @state() presenceError: string | null = null;
  @state() presenceStatus: string | null = null;

  @state() agentsLoading = false;
  @state() agentsList: AgentsListResult | null = null;
  @state() agentsError: string | null = null;
  @state() agentsSelectedId: string | null = null;
  @state() agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron" =
    "overview";
  @state() agentFilesLoading = false;
  @state() agentFilesError: string | null = null;
  @state() agentFilesList: AgentsFilesListResult | null = null;
  @state() agentFileContents: Record<string, string> = {};
  @state() agentFileDrafts: Record<string, string> = {};
  @state() agentFileActive: string | null = null;
  @state() agentFileSaving = false;
  @state() agentIdentityLoading = false;
  @state() agentIdentityError: string | null = null;
  @state() agentIdentityById: Record<string, AgentIdentityResult> = {};
  @state() agentSkillsLoading = false;
  @state() agentSkillsError: string | null = null;
  @state() agentSkillsReport: SkillStatusReport | null = null;
  @state() agentSkillsAgentId: string | null = null;

  @state() sessionsLoading = false;
  @state() sessionsResult: SessionsListResult | null = null;
  @state() sessionsError: string | null = null;
  @state() sessionsFilterActive = "";
  @state() sessionsFilterLimit = "120";
  @state() sessionsIncludeGlobal = true;
  @state() sessionsIncludeUnknown = false;

  @state() usageLoading = false;
  @state() usageResult: import("./types.js").SessionsUsageResult | null = null;
  @state() usageCostSummary: import("./types.js").CostUsageSummary | null = null;
  @state() usageError: string | null = null;
  @state() usageStartDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageEndDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageSelectedSessions: string[] = [];
  @state() usageSelectedDays: string[] = [];
  @state() usageSelectedHours: number[] = [];
  @state() usageChartMode: "tokens" | "cost" = "tokens";
  @state() usageDailyChartMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeriesMode: "cumulative" | "per-turn" = "per-turn";
  @state() usageTimeSeriesBreakdownMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeries: import("./types.js").SessionUsageTimeSeries | null = null;
  @state() usageTimeSeriesLoading = false;
  @state() usageSessionLogs: import("./views/usage.js").SessionLogEntry[] | null = null;
  @state() usageSessionLogsLoading = false;
  @state() usageSessionLogsExpanded = false;
  // Applied query (used to filter the already-loaded sessions list client-side).
  @state() usageQuery = "";
  // Draft query text (updates immediately as the user types; applied via debounce or "Search").
  @state() usageQueryDraft = "";
  @state() usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors" = "recent";
  @state() usageSessionSortDir: "desc" | "asc" = "desc";
  @state() usageRecentSessions: string[] = [];
  @state() usageTimeZone: "local" | "utc" = "local";
  @state() usageContextExpanded = false;
  @state() usageHeaderPinned = false;
  @state() usageSessionsTab: "all" | "recent" = "all";
  @state() usageVisibleColumns: string[] = [
    "channel",
    "agent",
    "provider",
    "model",
    "messages",
    "tools",
    "errors",
    "duration",
  ];
  @state() usageLogFilterRoles: import("./views/usage.js").SessionLogRole[] = [];
  @state() usageLogFilterTools: string[] = [];
  @state() usageLogFilterHasTools = false;
  @state() usageLogFilterQuery = "";

  // Non-reactive (don’t trigger renders just for timer bookkeeping).
  usageQueryDebounceTimer: number | null = null;

  @state() cronLoading = false;
  @state() cronJobs: CronJob[] = [];
  @state() cronStatus: CronStatus | null = null;
  @state() cronError: string | null = null;
  @state() cronForm: CronFormState = { ...DEFAULT_CRON_FORM };
  @state() cronRunsJobId: string | null = null;
  @state() cronRuns: CronRunLogEntry[] = [];
  @state() cronBusy = false;

  @state() skillsLoading = false;
  @state() skillsReport: SkillStatusReport | null = null;
  @state() skillsError: string | null = null;
  @state() skillsFilter = "";
  @state() skillEdits: Record<string, string> = {};
  @state() skillsBusyKey: string | null = null;
  @state() skillMessages: Record<string, SkillMessage> = {};

  @state() debugLoading = false;
  @state() debugStatus: StatusSummary | null = null;
  @state() debugHealth: HealthSnapshot | null = null;
  @state() debugModels: unknown[] = [];
  @state() debugHeartbeat: unknown = null;
  @state() debugCallMethod = "";
  @state() debugCallParams = "{}";
  @state() debugCallResult: string | null = null;
  @state() debugCallError: string | null = null;

  @state() logsLoading = false;
  @state() logsError: string | null = null;
  @state() logsFile: string | null = null;
  @state() logsEntries: LogEntry[] = [];
  @state() logsFilterText = "";
  @state() logsLevelFilters: Record<LogLevel, boolean> = {
    ...DEFAULT_LOG_LEVEL_FILTERS,
  };
  @state() logsAutoFollow = true;
  @state() logsTruncated = false;
  @state() logsCursor: number | null = null;
  @state() logsLastFetchAt: number | null = null;
  @state() logsLimit = 500;
  @state() logsMaxBytes = 250_000;
  @state() logsAtBottom = true;

  client: GatewayBrowserClient | null = null;
  private chatScrollFrame: number | null = null;
  private chatScrollTimeout: number | null = null;
  private chatHasAutoScrolled = false;
  private chatUserNearBottom = true;
  @state() chatNewMessagesBelow = false;
  private nodesPollInterval: number | null = null;
  private logsPollInterval: number | null = null;
  private debugPollInterval: number | null = null;
  private logsScrollFrame: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  refreshSessionsAfterChat = new Set<string>();
  private productHistoryLoaded = new Set<string>();
  private productGreeted = new Set<string>();
  basePath = "";
  private popStateHandler = () =>
    onPopStateInternal(this as unknown as Parameters<typeof onPopStateInternal>[0]);
  private themeMedia: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private topbarObserver: ResizeObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
  }

  protected firstUpdated() {
    handleFirstUpdated(this as unknown as Parameters<typeof handleFirstUpdated>[0]);
  }

  disconnectedCallback() {
    handleDisconnected(this as unknown as Parameters<typeof handleDisconnected>[0]);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    handleUpdated(this as unknown as Parameters<typeof handleUpdated>[0], changed);
    if (this.productMode) {
      const connectedChanged = changed.has("connected");
      const agentsChanged = changed.has("agentsList");
      if ((connectedChanged || agentsChanged) && this.connected) {
        if (!this.productAgentId) {
          this.productAgentId =
            this.agentsList?.defaultId ?? this.agentsList?.agents?.[0]?.id ?? "main";
        }
        if (!this.productSessionsResult) {
          void this.productLoadSessions();
        }
        if (!this.configSnapshot && !this.configLoading) {
          void this.productReloadConfig();
        }
        // Load projects from localStorage
        if (this.productProjects.length === 0 && this.productCollapsedProjects.size === 0) {
          this.productLoadProjects();
        }
        void this.productEnsureChatLoaded();
      }
    }
  }

  connect() {
    connectGatewayInternal(this as unknown as Parameters<typeof connectGatewayInternal>[0]);
  }

  handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  handleLogsScroll(event: Event) {
    handleLogsScrollInternal(
      this as unknown as Parameters<typeof handleLogsScrollInternal>[0],
      event,
    );
  }

  exportLogs(lines: string[], label: string) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
  }

  resetChatScroll() {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
  }

  scrollToBottom(opts?: { smooth?: boolean }) {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
    scheduleChatScrollInternal(
      this as unknown as Parameters<typeof scheduleChatScrollInternal>[0],
      true,
      Boolean(opts?.smooth),
    );
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next: UiSettings) {
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], next);
  }

  setTab(next: Tab) {
    setTabInternal(this as unknown as Parameters<typeof setTabInternal>[0], next);
  }

  setTheme(next: ThemeMode, context?: Parameters<typeof setThemeInternal>[2]) {
    setThemeInternal(this as unknown as Parameters<typeof setThemeInternal>[0], next, context);
  }

  async loadOverview() {
    await loadOverviewInternal(this as unknown as Parameters<typeof loadOverviewInternal>[0]);
  }

  async loadCron() {
    await loadCronInternal(this as unknown as Parameters<typeof loadCronInternal>[0]);
  }

  async handleAbortChat() {
    await handleAbortChatInternal(this as unknown as Parameters<typeof handleAbortChatInternal>[0]);
  }

  removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  async handleSendChat(
    messageOverride?: string,
    opts?: Parameters<typeof handleSendChatInternal>[2],
  ) {
    await handleSendChatInternal(
      this as unknown as Parameters<typeof handleSendChatInternal>[0],
      messageOverride,
      opts,
    );
  }

  async startOnboardingWizard() {
    this.setSimpleOnboardingDone(false);
    await startOnboardingWizardInternal(this);
    if (this.onboardingWizardStatus === "done") {
      this.setSimpleOnboardingDone(true);
    }
  }

  async advanceOnboardingWizard(answer?: unknown) {
    await advanceOnboardingWizardInternal(this, answer);
    if (this.onboardingWizardStatus === "done") {
      this.setSimpleOnboardingDone(true);
    }
  }

  async cancelOnboardingWizard() {
    await cancelOnboardingWizardInternal(this);
  }

  private resolveProductActiveAgentId(): string {
    const fallback =
      this.productAgentId ??
      this.agentsList?.defaultId ??
      this.agentsList?.agents?.[0]?.id ??
      "main";
    return normalizeAgentId(fallback);
  }

  async productReloadConfig() {
    await loadConfigInternal(this);
  }

  async productEnsureChatLoaded() {
    if (!this.client || !this.connected) {
      return;
    }
    const key = this.sessionKey;
    if (!key) {
      return;
    }
    if (this.productHistoryLoaded.has(key)) {
      return;
    }
    this.productHistoryLoaded.add(key);
    await loadChatHistory(this);
    if (this.chatMessages.length === 0 && this.simpleOnboardingDone) {
      if (!this.productGreeted.has(key)) {
        this.productGreeted.add(key);
        void this.productGreet("first_open");
      }
    }
  }

  async productOpenSession(key: string) {
    this.productPanel = "chat";
    this.sessionKey = key;
    this.chatMessage = "";
    this.chatAttachments = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.chatQueue = [];
    this.resetToolStream();
    this.resetChatScroll();
    this.applySettings({
      ...this.settings,
      sessionKey: key,
      lastActiveSessionKey: key,
    });
    await loadChatHistory(this);
    if (this.chatMessages.length === 0 && this.simpleOnboardingDone) {
      if (!this.productGreeted.has(key)) {
        this.productGreeted.add(key);
        void this.productGreet("first_open");
      }
    }
    this.productHistoryLoaded.add(key);
  }

  async productSelectAgent(agentId: string) {
    const nextAgentId = normalizeAgentId(agentId);
    this.productAgentId = nextAgentId;
    const nextSessionKey = `agent:${nextAgentId}:main`;
    await this.productOpenSession(nextSessionKey);
    await this.productLoadSessions();
    void this.loadAssistantIdentity();
  }

  async productLoadSessions() {
    if (!this.client || !this.connected) {
      return;
    }
    if (this.productSessionsLoading) {
      return;
    }
    this.productSessionsLoading = true;
    this.productSessionsError = null;
    try {
      const agentId = this.resolveProductActiveAgentId();
      const res = await this.client.request<SessionsListResult>("sessions.list", {
        agentId,
        includeGlobal: false,
        includeUnknown: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
        limit: 80,
      });
      this.productSessionsResult = res;
    } catch (err) {
      this.productSessionsError = String(err);
    } finally {
      this.productSessionsLoading = false;
    }
  }

  async productNewChat() {
    if (!this.client || !this.connected) {
      return;
    }
    this.productPanel = "chat";
    const agentId = this.resolveProductActiveAgentId();
    const key = `agent:${agentId}:subagent:${crypto.randomUUID()}`.toLowerCase();
    try {
      await this.client.request("sessions.patch", {
        key,
        label: "Чат",
        spawnedBy: `agent:${agentId}:main`,
      });
    } catch {
      // Best-effort: session may be created lazily later.
    }
    this.sessionKey = key;
    this.chatMessage = "";
    this.chatAttachments = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.chatQueue = [];
    this.resetToolStream();
    this.resetChatScroll();
    this.applySettings({
      ...this.settings,
      sessionKey: key,
      lastActiveSessionKey: key,
    });
    await this.productLoadSessions();
    this.productHistoryLoaded.delete(key);
    this.productGreeted.delete(key);
    await loadChatHistory(this);
    this.productHistoryLoaded.add(key);
    void this.productGreet("new_chat");
  }

  async productResetChat() {
    if (!this.client || !this.connected) {
      return;
    }
    this.productPanel = "chat";
    const key = this.sessionKey;
    try {
      await this.client.request("sessions.reset", { key });
    } catch (err) {
      this.lastError = String(err);
      return;
    }
    this.chatMessage = "";
    this.chatAttachments = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.chatQueue = [];
    this.resetToolStream();
    this.resetChatScroll();
    await this.productLoadSessions();
    this.productHistoryLoaded.delete(key);
    this.productGreeted.delete(key);
    await loadChatHistory(this);
    this.productHistoryLoaded.add(key);
    void this.productGreet("reset");
  }

  async productGreet(reason: "new_chat" | "reset" | "first_open") {
    if (!this.client || !this.connected) {
      return;
    }
    const runId = `greet-${crypto.randomUUID()}`;
    this.chatRunId = runId;
    this.chatStream = "";
    this.chatStreamStartedAt = Date.now();
    try {
      await this.client.request("chat.greet", {
        sessionKey: this.sessionKey,
        reason,
        idempotencyKey: runId,
      });
    } catch (err) {
      this.lastError = String(err);
      this.chatRunId = null;
      this.chatStream = null;
      this.chatStreamStartedAt = null;
    }
  }

  async productCreateProject() {
    if (!this.client || !this.connected) {
      return;
    }
    const name = this.productCreateProjectName.trim();
    if (!name) {
      this.productSessionsError = "Нужно имя проекта.";
      return;
    }
    const agentId = normalizeAgentId(name);
    const workspaceBase =
      (this.configSnapshot?.config as { agents?: { defaults?: { workspace?: string } } } | null)
        ?.agents?.defaults?.workspace ?? "~/.openclaw/workspace";
    const workspace = `${workspaceBase}/${agentId}`;
    const desc = this.productCreateProjectDesc.trim();
    await this.client.request("agents.create", { name, workspace });
    const persona = [
      "Ты помощник в OpenClaw. Всегда отвечай по-русски.",
      "Когда начинается новый чат или чат сброшен, поздоровайся в 1-3 предложениях и спроси, что сделать.",
      "Предлагай понятные шаги кнопками (не проси вводить команды).",
      "Если пользователь прислал файлы, скажи что ты получил и что можешь сделать: кратко перечисли варианты.",
      "Если Telegram ещё не подключён, предложи подключить Telegram.",
      desc ? `Контекст проекта: ${desc}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await this.client.request("agents.files.set", { agentId, name: "USER.md", content: persona });
    } catch {
      // ignore
    }
    await loadAgents(this);
    this.productCreateProjectOpen = false;
    this.productCreateProjectName = "";
    this.productCreateProjectDesc = "";
    await this.productSelectAgent(agentId);
  }

  productLoadProjects() {
    import("./storage.projects.ts").then(({ loadProjects, loadCollapsedProjects }) => {
      this.productProjects = loadProjects();
      this.productCollapsedProjects = loadCollapsedProjects();
    });
  }

  productSaveProjects() {
    import("./storage.projects.ts").then(({ saveProjects, saveCollapsedProjects }) => {
      saveProjects(this.productProjects);
      saveCollapsedProjects(this.productCollapsedProjects);
    });
  }

  productToggleProjectCollapsed(projectId: string) {
    this.productCollapsedProjects = new Set(this.productCollapsedProjects);
    if (this.productCollapsedProjects.has(projectId)) {
      this.productCollapsedProjects.delete(projectId);
    } else {
      this.productCollapsedProjects.add(projectId);
    }
    this.productSaveProjects();
  }

  async productConnectTelegram() {
    if (!this.client || !this.connected) {
      return;
    }
    this.productTelegramBusy = true;
    this.productTelegramError = null;
    this.productTelegramSuccess = null;
    try {
      const baseHash = this.configSnapshot?.hash;
      if (!baseHash) {
        this.productTelegramError = "Нет hash конфига. Открой dev drawer и сделай Обновить конфиг.";
        return;
      }
      const token = this.productTelegramToken.trim();
      const allowFrom = this.productTelegramAllowFrom.trim();
      if (!token) {
        this.productTelegramError = "Нужен Telegram bot token.";
        return;
      }
      if (!allowFrom) {
        this.productTelegramError = "Нужен твой Telegram user id (цифры).";
        return;
      }
      const patch = {
        channels: {
          telegram: {
            enabled: true,
            botToken: token,
            dmPolicy: "allowlist",
            allowFrom: [allowFrom],
          },
        },
        bindings: [
          {
            agentId: "main",
            match: { channel: "telegram", accountId: "default" },
          },
        ],
      };
      await this.client.request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash,
        note: "product-ui telegram connect",
      });
      this.productTelegramToken = "";
      this.productTelegramAllowFrom = "";
      this.productTelegramSuccess = "Telegram подключен. Gateway перезапускается.";
    } catch (err) {
      this.productTelegramError = String(err);
    } finally {
      this.productTelegramBusy = false;
    }
  }

  async productResetAll() {
    if (!this.client || !this.connected) {
      return;
    }
    const confirmed = window.confirm("Сбросить конфиг и начать заново?");
    if (!confirmed) {
      return;
    }
    this.productHistoryLoaded.clear();
    this.productGreeted.clear();
    this.setSimpleOnboardingDone(false);
    this.onboardingWizardFlow = "eliza";
    this.onboardingWizardMode = "local";
    this.onboardingWizardWorkspace = "";
    this.onboardingWizardResetConfig = true;
    await this.startOnboardingWizard();
  }

  setOnboardingWizardDone() {
    setOnboardingWizardDoneInternal(this);
    this.setSimpleOnboardingDone(true);
  }

  setSimpleOnboardingDone(next: boolean) {
    this.simpleOnboardingDone = next;
    saveSimpleOnboardingDone(next);
  }

  async handleWhatsAppStart(force: boolean) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  async handleExecApprovalDecision(decision: "allow-once" | "allow-always" | "deny") {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) {
      return;
    }
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request("exec.approval.resolve", {
        id: active.id,
        decision,
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = `Exec approval failed: ${String(err)}`;
    } finally {
      this.execApprovalBusy = false;
    }
  }

  handleGatewayUrlConfirm() {
    const nextGatewayUrl = this.pendingGatewayUrl;
    if (!nextGatewayUrl) {
      return;
    }
    this.pendingGatewayUrl = null;
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], {
      ...this.settings,
      gatewayUrl: nextGatewayUrl,
    });
    this.connect();
  }

  handleGatewayUrlCancel() {
    this.pendingGatewayUrl = null;
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio: number) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  render() {
    return renderApp(this as unknown as AppViewState);
  }
}
