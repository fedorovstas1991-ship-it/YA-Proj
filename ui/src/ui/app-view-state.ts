import { produce } from "immer";
import { AppEvent, sendAppEvent } from "./app-events.ts";
import { CompactionStatus } from "./app-tool-stream.ts";
import {
  findAndReplaceProjectReferencesInSession,
  getAgentName,
  getSessionAgentId,
  getSessionDisplayName,
} from "./app-util.ts";
import { ChatState, loadChatHistory, watchChatStream } from "./controllers/chat.ts";
import { fetchDevices, DevicePairingList, GatewayDevice } from "./controllers/devices.ts";
import { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import { calculateCostForSessionMessages, calculateTokensForSessionMessages } from "./cost.ts";
import { fetchGatewayLog, watchGatewayLog } from "./gateway-logs.ts";
import { GatewayBrowserClient } from "./gateway.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, parseLocation, pathForTab, Tab } from "./navigation.ts";
import { updateUiSettings } from "./storage.ts";
import { DEFAULT_UI_SETTINGS, UiSettings } from "./storage.ts";
import { detectTheme } from "./theme.ts";
import { getThemeFromSystem, ThemeMode, transitionTheme } from "./theme.ts";
import {
  GatewayHelloOk,
  AgentsListResult,
  SessionsListResult,
  ConfigSnapshot,
  ConfigUiHints,
  AgentIdentityResult,
  SkillStatusReport,
  CronStatus,
  CronJob,
  CronRunLogEntry,
  ChannelsStatusSnapshot,
  StatusSummary,
  HealthSnapshot,
  AgentsFilesListResult,
  WizardStep,
  GatewayEvent,
  LogLevel,
} from "./types.ts";
import { PresenceEntry } from "./types.ts";
import { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types.ts";
import { debounce } from "./util.ts";
import {
  createNostrProfileFormState,
  isNostrProfileFormStateDirty,
  mapNostrProfileToFormState,
  NostrProfileFormState,
} from "./views/channels.nostr-profile-form.ts";
import {
  CostUsageSummary,
  SessionLogEntry,
  SessionUsageTimeSeries,
  SessionsUsageResult,
} from "./views/usage.ts";

export class AppViewState {
  settings: UiSettings = DEFAULT_UI_SETTINGS;
  password = "";
  tab: Tab = "chat";
  onboarding = false;
  simpleMode = false;
  productMode = false;
  simpleOnboardingDone = false;
  simpleDevToolsOpen = false;
  productPanel: "chat" | "projects" | "telegram" = "projects";
  productDevDrawerOpen = false;
  productAgentId: string | null = null;
  productCreateProjectOpen = false;
  productCreateProjectName = "";
  productCreateProjectDesc = "";
  productConfirmDeleteProjectOpen = false;
  productConfirmDeleteProjectId: string | null = null;
  productConfirmDeleteProjectName = "";
  productConfirmDeleteChatOpen = false;
  productConfirmDeleteChatSessionKey: string | null = null;
  productConfirmDeleteChatDisplayName = "";
  productSessionsLoading = false;
  productSessionsError: string | null = null;
  productSessionsResult: SessionsListResult | null = null;
  productTelegramToken = "";
  productTelegramAllowFrom = "";
  productTelegramBusy = false;
  productTelegramError: string | null = null;
  productTelegramSuccess: string | null = null;
  productProjects: Array<{ id: string; name: string; expanded?: boolean; sessionKeys?: string[] }> =
    [];
  productProjectsLoading = false;
  productProjectsError: string | null = null;
  productEditingProjectId: string | null = null;
  productCollapsedProjects: Set<string> = new Set();
  basePath = "/";
  connected = false;
  theme: ThemeMode = "system";
  themeResolved: "light" | "dark" = "light";
  hello: GatewayHelloOk | null = null;
  lastError: string | null = null;
  eventLog: AppEvent[] = [];
  assistantName = "OpenClaw";
  assistantAvatar: string | null = null;
  assistantAgentId: string | null = null;
  sessionKey = "main";
  chatLoading = false;
  chatSending = false;
  chatMessage = "";
  chatAttachments: ChatAttachment[] = [];
  chatMessages: unknown[] = [];
  chatToolMessages: unknown[] = [];
  chatStream: string | null = null;
  chatStreamStartedAt: number | null = null;
  chatRunId: string | null = null;
  compactionStatus: CompactionStatus | null = null;
  chatAvatarUrl: string | null = null;
  chatThinkingLevel: string | null = null;
  chatQueue: ChatQueueItem[] = [];
  chatManualRefreshInFlight = false;
  onboardingWizardSessionId: string | null = null;
  onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error" = "idle";
  onboardingWizardStep: WizardStep | null = null;
  onboardingWizardError: string | null = null;
  onboardingWizardBusy = false;
  onboardingWizardMode: "local" | "remote" = "local";
  onboardingWizardWorkspace = "";
  onboardingWizardResetConfig = false;
  onboardingWizardTextAnswer = "";
  onboardingWizardMultiAnswers: number[] = [];
  onboardingWizardCurrentStep = 0;
  onboardingWizardTotalSteps = 0;
  nodesLoading = false;
  nodes: GatewayDevice[] = [];
  chatNewMessagesBelow = false;
  sidebarOpen = false;
  sidebarContent: string | null = null;
  sidebarError: string | null = null;
  splitRatio = 0.5;
  // This is a placeholder; actual implementation will be provided by the UI framework
  scrollToBottom: (opts?: { smooth?: boolean }) => void = () => {};
  devicesLoading = false;
  devicesError: string | null = null;
  devicesList: DevicePairingList | null = null;
  execApprovalsLoading = false;
  execApprovalsSaving = false;
  execApprovalsDirty = false;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  execApprovalsForm: ExecApprovalsFile | null = null;
  execApprovalsSelectedAgent: string | null = null;
  execApprovalsTarget: "gateway" | "node" = "gateway";
  execApprovalsTargetNodeId: string | null = null;
  execApprovalQueue: ExecApprovalRequest[] = [];
  execApprovalBusy = false;
  execApprovalError: string | null = null;
  pendingGatewayUrl: string | null = null;
  configLoading = false;
  configRaw = "";
  configRawOriginal = "";
  configValid: boolean | null = null;
  configIssues: unknown[] = [];
  configSaving = false;
  configApplying = false;
  updateRunning = false;
  applySessionKey = "";
  configSnapshot: ConfigSnapshot | null = null;
  configSchema: unknown = null;
  configSchemaVersion: string | null = null;
  configSchemaLoading = false;
  configUiHints: ConfigUiHints = {};
  configForm: Record<string, unknown> | null = null;
  configFormOriginal: Record<string, unknown> | null = null;
  configFormMode: "form" | "raw" = "form";
  configSearchQuery = "";
  configActiveSection: string | null = null;
  configActiveSubsection: string | null = null;
  channelsLoading = false;
  channelsSnapshot: ChannelsStatusSnapshot | null = null;
  channelsError: string | null = null;
  channelsLastSuccess: number | null = null;
  whatsappLoginMessage: string | null = null;
  whatsappLoginQrDataUrl: string | null = null;
  whatsappLoginConnected: boolean | null = null;
  whatsappBusy = false;
  nostrProfileFormState: NostrProfileFormState | null = null;
  nostrProfileAccountId: string | null = null;
  configFormDirty = false;
  presenceLoading = false;
  presenceEntries: PresenceEntry[] = [];
  presenceError: string | null = null;
  presenceStatus: string | null = null;
  agentsLoading = false;
  agentsList: AgentsListResult | null = null;
  agentsError: string | null = null;
  agentsSelectedId: string | null = null;
  agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron" = "overview";
  agentFilesLoading = false;
  agentFilesError: string | null = null;
  agentFilesList: AgentsFilesListResult | null = null;
  agentFileContents: Record<string, string> = {};
  agentFileDrafts: Record<string, string> = {};
  agentFileActive: string | null = null;
  agentFileSaving = false;
  agentIdentityLoading = false;
  agentIdentityError: string | null = null;
  agentIdentityById: Record<string, AgentIdentityResult> = {};
  agentSkillsLoading = false;
  agentSkillsError: string | null = null;
  agentSkillsReport: SkillStatusReport | null = null;
  agentSkillsAgentId: string | null = null;
  sessionsLoading = false;
  sessionsResult: SessionsListResult | null = null;
  sessionsError: string | null = null;
  sessionsFilterActive = "any";
  sessionsFilterLimit = "20";
  sessionsIncludeGlobal = true;
  sessionsIncludeUnknown = true;
  usageLoading = false;
  usageResult: SessionsUsageResult | null = null;
  usageCostSummary: CostUsageSummary | null = null;
  usageError: string | null = null;
  usageStartDate = "";
  usageEndDate = "";
  usageSelectedSessions: string[] = [];
  usageSelectedDays: string[] = [];
  usageSelectedHours: number[] = [];
  usageChartMode: "tokens" | "cost" = "tokens";
  usageDailyChartMode: "total" | "by-type" = "total";
  usageTimeSeriesMode: "cumulative" | "per-turn" = "cumulative";
  usageTimeSeriesBreakdownMode: "total" | "by-type" = "total";
  usageTimeSeries: SessionUsageTimeSeries | null = null;
  usageTimeSeriesLoading = false;
  usageSessionLogs: SessionLogEntry[] | null = null;
  usageSessionLogsLoading = false;
  usageSessionLogsExpanded = false;
  usageQuery = "";
  usageQueryDraft = "";
  usageQueryDebounceTimer: number | null = null;
  usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors" = "recent";
  usageSessionSortDir: "asc" | "desc" = "desc";
  usageRecentSessions: string[] = [];
  usageTimeZone: "local" | "utc" = "local";
  usageContextExpanded = false;
  usageHeaderPinned = false;
  usageSessionsTab: "all" | "recent" = "all";
  usageVisibleColumns: string[] = [
    "actions",
    "name",
    "agent",
    "model",
    "first",
    "last",
    "messages",
    "tokens",
    "cost",
  ];
  usageLogFilterRoles: ("user" | "tool" | "agent" | "system")[] = [];
  usageLogFilterTools: string[] = [];
  usageLogFilterHasTools = false;
  usageLogFilterQuery = "";
  cronLoading = false;
  cronJobs: CronJob[] = [];
  cronStatus: CronStatus | null = null;
  cronError: string | null = null;
  cronForm: CronFormState = {
    agentId: "main",
    skillId: "",
    schedule: "every-n-minutes",
    everyNMinutes: 15,
    prompt: "",
    enabled: false,
    startNow: false,
  };
  cronRunsJobId: string | null = null;
  cronRuns: CronRunLogEntry[] = [];
  cronBusy = false;
  skillsLoading = false;
  skillsReport: SkillStatusReport | null = null;
  skillsError: string | null = null;
  skillsFilter = "";
  skillEdits: Record<string, string> = {};
  skillMessages: Record<string, SkillMessage> = {};
  skillsBusyKey: string | null = null;
  debugLoading = false;
  debugStatus: StatusSummary | null = null;
  debugHealth: HealthSnapshot | null = null;
  debugModels: unknown[] = [];
  debugHeartbeat: unknown = null;
  debugCallMethod = "";
  debugCallParams = "";
  debugCallResult: string | null = null;
  debugCallError: string | null = null;
  logsLoading = false;
  logsError: string | null = null;
  logsFile: string | null = null;
  logsEntries: LogEntry[] = [];
  logsFilterText = "";
  logsLevelFilters: Record<LogLevel, boolean> = {
    error: true,
    warn: true,
    info: true,
    debug: false,
    trace: false,
  };
  logsAutoFollow = true;
  logsTruncated = false;
  logsCursor: number | null = null;
  logsLastFetchAt: number | null = null;
  logsLimit = 1000;
  logsMaxBytes = 100 * 1024;
  logsAtBottom = true;
  client: GatewayBrowserClient | null = null;
  refreshSessionsAfterChat: Set<string> = new Set();

  constructor() {
    const { tab, simple, onboarding, product } = parseLocation();

    this.simpleMode = simple;
    this.productMode = product;
    this.tab = tab;
    this.onboarding = onboarding;

    if (this.simpleMode) {
      this.productPanel = "chat";
    }

    const savedSettings = localStorage.getItem("ui-settings");
    if (savedSettings) {
      try {
        this.settings = { ...DEFAULT_UI_SETTINGS, ...JSON.parse(savedSettings) };
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }

    const storedOnboardingDone = localStorage.getItem("simpleOnboardingDone");
    this.simpleOnboardingDone = storedOnboardingDone === "true";

    const savedProjects = localStorage.getItem("productProjects");
    if (savedProjects) {
      try {
        this.productProjects = JSON.parse(savedProjects);
      } catch (e) {
        console.error("Failed to parse saved projects", e);
      }
    }

    // Set initial theme
    this.setTheme(this.settings.theme, {
      transition: false,
    });

    if (!this.onboarding && !this.simpleOnboardingDone) {
      this.onboarding = true;
    }

    // Attempt to connect immediately if not in onboarding and settings are present
    if (!this.onboarding && this.settings.token && this.settings.gatewayUrl) {
      this.connect();
    }

    window.addEventListener("popstate", () => {
      const { tab, simple, onboarding, product } = parseLocation();
      this.tab = tab;
      this.simpleMode = simple;
      this.onboarding = onboarding;
      this.productMode = product;
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.theme === "system") {
        this.setTheme("system");
      }
    });

    this.loadLogs();
  }

  // --- Actions / Methods ---

  connect = () => {
    this.client = new GatewayBrowserClient(this.settings.gatewayUrl, this.settings.token);
    this.connected = true;
    this.lastError = null;
    this.client.onHello = (hello) => {
      this.hello = hello;
      this.assistantName = hello.assistantName ?? "OpenClaw";
      this.assistantAvatar = hello.assistantAvatarUrl ?? null;
      if (hello.welcomeMessage) {
        sendAppEvent({
          type: "info",
          message: hello.welcomeMessage,
        });
      }
      this.loadOverview();
      this.loadAgents();
      this.productLoadProjects(); // Ensure projects are loaded on connect
      this.productLoadSessions();
    };
    this.client.onConnectionError = (error) => {
      this.connected = false;
      this.lastError = error.message;
      sendAppEvent({
        type: "error",
        message: `Gateway connection error: ${error.message}`,
      });
      // Try to reconnect after a delay
      setTimeout(this.connect, 5000);
    };
    this.client.onDisconnect = () => {
      this.connected = false;
      sendAppEvent({
        type: "warn",
        message: "Gateway disconnected. Attempting to reconnect...",
      });
      // Try to reconnect after a delay
      setTimeout(this.connect, 5000);
    };

    // Chat stream updates
    watchChatStream(this, this.client);
    // Gateway log updates
    watchGatewayLog(this, this.client);
  };

  setTab = (tab: Tab) => {
    this.tab = tab;
    history.pushState({}, "", pathForTab(tab, this.basePath));
  };

  setTheme = (theme: ThemeMode, context?: { transition: boolean }) => {
    this.theme = theme;
    this.themeResolved = detectTheme(theme);
    if (context?.transition) {
      transitionTheme(document.documentElement);
    }
    document.documentElement.dataset.theme = this.themeResolved;
    updateUiSettings(produce(this.settings, (draft) => void (draft.theme = theme)));
  };

  applySettings = (next: UiSettings) => {
    this.settings = next;
    updateUiSettings(this.settings);
    // If we're changing connection settings, try to reconnect
    if (this.client?.url !== next.gatewayUrl || this.client?.token !== next.token) {
      this.client?.disconnect(); // Disconnect to force a reconnect with new settings
      this.connect();
    }
  };

  loadOverview = async () => {
    if (!this.client) {
      return;
    }
    try {
      this.channelsLoading = true;
      this.channelsError = null;
      this.channelsSnapshot = await this.client.channels.status();
      this.channelsLastSuccess = Date.now();
    } catch (e) {
      this.channelsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to load channels status: ${e}`,
      });
    } finally {
      this.channelsLoading = false;
    }
  };

  loadAssistantIdentity = async () => {
    if (!this.client) {
      return;
    }
    try {
      if (this.assistantAgentId) {
        this.agentIdentityLoading = true;
        this.agentIdentityError = null;
        const identity = await this.client.agents.getIdentity(this.assistantAgentId);
        this.agentIdentityById = produce(this.agentIdentityById, (draft) => {
          draft[this.assistantAgentId!] = identity;
        });
      }
    } catch (e) {
      this.agentIdentityError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to load assistant identity: ${e}`,
      });
    } finally {
      this.agentIdentityLoading = false;
    }
  };

  // --- Telegram specific logic for product UI ---
  productConnectTelegram = async () => {
    if (!this.client) {
      return;
    }
    this.productTelegramBusy = true;
    this.productTelegramError = null;
    this.productTelegramSuccess = null;
    try {
      await this.client.channels.configureTelegram({
        botToken: this.productTelegramToken,
        allowFrom: this.productTelegramAllowFrom,
      });
      this.productTelegramSuccess = "Telegram успешно подключен!";
      this.productTelegramToken = ""; // Clear token after successful connection
      this.productTelegramAllowFrom = ""; // Clear allowFrom after successful connection
      sendAppEvent({
        type: "success",
        message: "Telegram успешно подключен.",
      });
      this.loadOverview(); // Refresh channels status
    } catch (e) {
      this.productTelegramError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка подключения Telegram: ${e}`,
      });
    } finally {
      this.productTelegramBusy = false;
    }
  };

  // --- Project Management ---
  productLoadProjects = async () => {
    if (!this.client) {
      return;
    }
    this.productProjectsLoading = true;
    this.productProjectsError = null;
    try {
      const agentsList = await this.client.agents.list();
      this.productProjects = agentsList.agents.map((agent) => ({
        id: agent.id,
        name: agent.name || agent.id,
        sessionKeys: [], // TODO: Populate this with actual session keys from sessions
      }));
      // Restore collapsed state
      const savedCollapsed = localStorage.getItem("productCollapsedProjects");
      if (savedCollapsed) {
        try {
          this.productCollapsedProjects = new Set(JSON.parse(savedCollapsed));
        } catch (e) {
          console.error("Failed to parse saved collapsed projects", e);
        }
      }
    } catch (e) {
      this.productProjectsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to load projects: ${e}`,
      });
    } finally {
      this.productProjectsLoading = false;
    }
  };

  productSaveProjects = () => {
    localStorage.setItem("productProjects", JSON.stringify(this.productProjects));
    localStorage.setItem(
      "productCollapsedProjects",
      JSON.stringify(Array.from(this.productCollapsedProjects)),
    );
  };

  productSelectAgent = async (agentId: string) => {
    this.productAgentId = agentId;
    await this.loadAssistantIdentity();
    await this.productLoadSessions(); // Reload sessions for the newly selected agent
    sendAppEvent({
      type: "info",
      message: `Выбран агент: ${agentId}`,
    });
  };

  productToggleProjectCollapsed = (projectId: string) => {
    if (this.productCollapsedProjects.has(projectId)) {
      this.productCollapsedProjects.delete(projectId);
    } else {
      this.productCollapsedProjects.add(projectId);
    }
    this.productCollapsedProjects = new Set(this.productCollapsedProjects); // Trigger reactivity
    this.productSaveProjects();
  };

  productCreateProject = async () => {
    if (!this.client || !this.productCreateProjectName) {
      return;
    }
    try {
      const newAgent = await this.client.agents.create({
        name: this.productCreateProjectName,
        description: this.productCreateProjectDesc,
      });
      this.productProjects = produce(this.productProjects, (draft) => {
        draft.push({ id: newAgent.id, name: newAgent.name || newAgent.id, sessionKeys: [] });
      });
      this.productSaveProjects();
      this.productCreateProjectOpen = false;
      this.productCreateProjectName = "";
      this.productCreateProjectDesc = "";
      await this.productLoadProjects(); // Reload projects to get full details
      await this.productSelectAgent(newAgent.id); // Select the new project
      sendAppEvent({
        type: "success",
        message: `Проект "${newAgent.name}" создан.`,
      });
    } catch (e) {
      sendAppEvent({
        type: "error",
        message: `Ошибка создания проекта: ${e}`,
      });
    }
  };

  productConfirmDeleteProject = async (projectId: string) => {
    const project = this.productProjects.find((p) => p.id === projectId);
    if (project) {
      this.productConfirmDeleteProjectId = projectId;
      this.productConfirmDeleteProjectName = project.name;
      this.productConfirmDeleteProjectOpen = true;
    }
  };

  productDeleteProject = async (projectId: string) => {
    if (!this.client || !projectId) {
      return;
    }
    try {
      await this.client.agents.delete(projectId);
      this.productProjects = this.productProjects.filter((p) => p.id !== projectId);
      this.productSaveProjects();
      this.productConfirmDeleteProjectOpen = false;
      this.productConfirmDeleteProjectId = null;
      this.productConfirmDeleteProjectName = "";

      if (this.productAgentId === projectId) {
        this.productAgentId = null; // Clear active project if deleted
        this.sessionKey = "main"; // Go to global chat
      }
      await this.productLoadProjects();
      await this.productLoadSessions(); // Sessions connected to project will also be deleted
      sendAppEvent({
        type: "success",
        message: `Проект "${projectId}" удален.`,
      });
    } catch (e) {
      sendAppEvent({
        type: "error",
        message: `Ошибка удаления проекта: ${e}`,
      });
    }
  };

  productLoadSessions = async () => {
    if (!this.client) {
      return;
    }
    this.productSessionsLoading = true;
    this.productSessionsError = null;
    try {
      const sessions = await this.client.sessions.list();
      this.productSessionsResult = sessions;

      // Assign sessions to projects based on agentId
      this.productProjects = produce(this.productProjects, (draft) => {
        for (const project of draft) {
          project.sessionKeys = sessions.sessions
            .filter((s) => getSessionAgentId(s) === project.id)
            .map((s) => s.key);
        }
      });
      this.productSaveProjects();
    } catch (e) {
      this.productSessionsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to load sessions: ${e}`,
      });
    } finally {
      this.productSessionsLoading = false;
    }
  };

  productNewChat = async (projectId?: string) => {
    if (!this.client) {
      return;
    }
    try {
      this.chatSending = true;
      const newSession = await this.client.sessions.create({ agentId: projectId });
      this.sessionKey = newSession.key;
      this.chatMessage = "";
      this.chatAttachments = [];
      this.chatMessages = [];
      this.chatToolMessages = [];
      this.chatStream = null;
      this.chatStreamStartedAt = null;
      this.chatRunId = null;
      this.compactionStatus = null;
      this.chatQueue = [];
      this.chatManualRefreshInFlight = false;
      await this.productLoadSessions(); // Refresh session list to include new chat
      sendAppEvent({
        type: "success",
        message: `Новый чат создан.`,
      });
    } catch (e) {
      sendAppEvent({
        type: "error",
        message: `Ошибка создания чата: ${e}`,
      });
    } finally {
      this.chatSending = false;
    }
  };

  productNewChatInProject = async (projectId: string) => {
    await this.productNewChat(projectId);
  };

  productOpenSession = async (sessionKey: string) => {
    this.sessionKey = sessionKey;
    this.chatMessage = "";
    this.chatAttachments = [];
    this.chatMessages = [];
    this.chatToolMessages = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.compactionStatus = null;
    this.chatQueue = [];
    this.chatManualRefreshInFlight = false;
    await loadChatHistory(this as unknown as ChatState);
    sendAppEvent({
      type: "info",
      message: `Открыт чат: ${sessionKey}`,
    });
  };

  productConfirmDeleteChat = async (sessionKey: string) => {
    const session = this.productSessionsResult?.sessions.find((s) => s.key === sessionKey);
    if (session) {
      this.productConfirmDeleteChatSessionKey = sessionKey;
      this.productConfirmDeleteChatDisplayName = getSessionDisplayName(session);
      this.productConfirmDeleteChatOpen = true;
    }
  };

  productDeleteChat = async (sessionKey: string) => {
    if (!this.client || !sessionKey) {
      return;
    }
    try {
      await this.client.sessions.delete(sessionKey);
      this.productConfirmDeleteChatOpen = false;
      this.productConfirmDeleteChatSessionKey = null;
      this.productConfirmDeleteChatDisplayName = "";

      if (this.sessionKey === sessionKey) {
        this.sessionKey = "main"; // Switch to main chat if deleted chat was active
      }
      await this.productLoadSessions();
      sendAppEvent({
        type: "success",
        message: `Чат "${sessionKey}" удален.`,
      });
    } catch (e) {
      sendAppEvent({
        type: "error",
        message: `Ошибка удаления чата: ${e}`,
      });
    }
  };

  productResetChat = async () => {
    if (!this.client) {
      return;
    }
    try {
      this.chatSending = true;
      await this.client.sessions.reset(this.sessionKey);
      this.chatMessage = "";
      this.chatAttachments = [];
      this.chatMessages = [];
      this.chatToolMessages = [];
      this.chatStream = null;
      this.chatStreamStartedAt = null;
      this.chatRunId = null;
      this.compactionStatus = null;
      this.chatQueue = [];
      this.chatManualRefreshInFlight = false;
      await loadChatHistory(this as unknown as ChatState);
      sendAppEvent({
        type: "success",
        message: `Чат сброшен.`,
      });
    } catch (e) {
      sendAppEvent({
        type: "error",
        message: `Ошибка сброса чата: ${e}`,
      });
    } finally {
      this.chatSending = false;
    }
  };

  // --- Dev Drawer and Reset ---
  productReloadConfig = async () => {
    if (this.client) {
      await this.client.config.reload();
      sendAppEvent({ type: "info", message: "Конфиг gateway перезагружен." });
    }
  };

  productResetAll = async () => {
    if (
      confirm(
        "Вы уверены, что хотите полностью сбросить все данные gateway? Это действие необратимо.",
      )
    ) {
      if (this.client) {
        await this.client.gateway.resetAll();
        sendAppEvent({ type: "warn", message: "Все данные gateway сброшены. Перезагрузка UI..." });
        location.reload();
      }
    }
  };

  // --- Onboarding Wizard Logic ---
  startOnboardingWizard = async () => {
    if (!this.client) {
      return;
    }
    this.onboardingWizardBusy = true;
    this.onboardingWizardError = null;
    this.onboardingWizardStatus = "running";
    this.onboardingWizardTextAnswer = "";
    this.onboardingWizardMultiAnswers = [];
    this.onboardingWizardCurrentStep = 0;
    this.onboardingWizardTotalSteps = 0;

    try {
      const response = await this.client.gateway.startOnboarding({
        flow: this.onboardingWizardFlow,
        mode: this.onboardingWizardMode,
        workspace: this.onboardingWizardWorkspace,
        resetConfig: this.onboardingWizardResetConfig,
      });
      this.onboardingWizardSessionId = response.sessionId;
      this.onboardingWizardStep = response.step;
      this.onboardingWizardCurrentStep = response.step.stepNum ?? 0;
      this.onboardingWizardTotalSteps = response.step.totalSteps ?? 0;
    } catch (e) {
      this.onboardingWizardError = String(e);
      this.onboardingWizardStatus = "error";
      sendAppEvent({ type: "error", message: `Ошибка запуска онбординга: ${e}` });
    } finally {
      this.onboardingWizardBusy = false;
    }
  };

  advanceOnboardingWizard = async (answer?: unknown) => {
    if (!this.client || !this.onboardingWizardSessionId || !this.onboardingWizardStep) {
      return;
    }
    this.onboardingWizardBusy = true;
    this.onboardingWizardError = null;

    let submitAnswer = answer;
    if (
      this.onboardingWizardStep.type === "text" ||
      this.onboardingWizardStep.type === "password"
    ) {
      submitAnswer = this.onboardingWizardTextAnswer;
    } else if (this.onboardingWizardStep.type === "multiselect") {
      submitAnswer = this.onboardingWizardMultiAnswers.map(
        (idx) => this.onboardingWizardStep!.options![idx].value,
      );
    }

    try {
      const response = await this.client.gateway.advanceOnboarding(
        this.onboardingWizardSessionId,
        submitAnswer,
      );
      this.onboardingWizardStep = response.step;
      this.onboardingWizardCurrentStep = response.step.stepNum ?? 0;
      this.onboardingWizardTotalSteps = response.step.totalSteps ?? 0;
      this.onboardingWizardTextAnswer = "";
      this.onboardingWizardMultiAnswers = [];

      if (response.status === "completed") {
        this.onboardingWizardStatus = "done";
        this.setOnboardingWizardDone();
        sendAppEvent({ type: "success", message: "Онбординг завершен!" });
      }
    } catch (e) {
      this.onboardingWizardError = String(e);
      this.onboardingWizardStatus = "error";
      sendAppEvent({ type: "error", message: `Ошибка онбординга: ${e}` });
    } finally {
      this.onboardingWizardBusy = false;
    }
  };

  cancelOnboardingWizard = async () => {
    if (!this.client || !this.onboardingWizardSessionId) {
      return;
    }
    try {
      await this.client.gateway.cancelOnboarding(this.onboardingWizardSessionId);
      this.onboardingWizardStatus = "cancelled";
      this.onboardingWizardSessionId = null;
      this.onboardingWizardStep = null;
      sendAppEvent({ type: "info", message: "Онбординг отменен." });
    } catch (e) {
      sendAppEvent({ type: "error", message: `Ошибка отмены онбординга: ${e}` });
    }
  };

  setOnboardingWizardDone = () => {
    this.simpleOnboardingDone = true;
    localStorage.setItem("simpleOnboardingDone", "true");
    this.onboarding = false; // Hide onboarding UI
    this.onboardingWizardStatus = "done";
    this.loadOverview(); // Refresh any relevant data after onboarding
    this.connect(); // Ensure we are connected with new settings
  };

  setSimpleOnboardingDone = (next: boolean) => {
    this.simpleOnboardingDone = next;
    localStorage.setItem("simpleOnboardingDone", next ? "true" : "false");
  };

  // --- Telegram specific logic for product UI ---
  // ... (rest of the class methods) ...
}
