import { produce } from "immer";
import { AppEvent, sendAppEvent } from "./app-events.ts";
import { getSessionAgentId, getSessionDisplayName } from "./app-util.ts";
import { ChatState, loadChatHistory, watchChatStream } from "./controllers/chat.ts";
import { GatewayBrowserClient } from "./gateway.ts";
import { parseLocation, Tab } from "./navigation.ts";
import { updateUiSettings } from "./storage.ts";
import { DEFAULT_UI_SETTINGS, UiSettings } from "./storage.ts";
import { detectTheme, ThemeMode, transitionTheme } from "./theme.ts";
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
  LogLevel,
  AgentGetResult, // Import AgentGetResult
  SkillGetResult, // Import SkillGetResult
  SkillUpdateParams, // Import SkillUpdateParams
} from "./types.ts";
import { PresenceEntry } from "./types.ts";
import { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types.ts";
import { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import {
  CostUsageSummary,
  SessionLogEntry,
  SessionUsageTimeSeries,
  SessionsUsageResult,
} from "./views/usage.ts";

export type AppViewState = {
  settings: UiSettings;
  password: string;
  tab: Tab;
  onboarding: boolean;
  simpleMode: boolean;
  productMode: boolean;
  simpleOnboardingDone: boolean;
  simpleDevToolsOpen: boolean;
  productPanel: "chat" | "projects" | "telegram" | "skills" | "settings";
  productDevDrawerOpen: boolean;
  productAgentId: string | null;
  productCreateProjectOpen: boolean;
  productCreateProjectName: string;
  productCreateProjectDesc: string;
  productConfirmDeleteProjectOpen: boolean;
  productConfirmDeleteProjectId: string | null;
  productConfirmDeleteProjectName: string;
  productConfirmDeleteChatOpen: boolean;
  productConfirmDeleteChatSessionKey: string | null;
  productConfirmDeleteChatDisplayName: string;
  productSessionsLoading: boolean;
  productSessionsError: string | null;
  productSessionsResult: SessionsListResult | null;
  productTelegramToken: string;
  productTelegramAllowFrom: string;
  productTelegramBusy: boolean;
  productTelegramError: string | null;
  productTelegramSuccess: string | null;
  productProjects: Array<{ id: string; name: string; expanded?: boolean; sessionKeys?: string[] }>;
  productProjectsLoading: boolean;
  productProjectsError: string | null;
  productEditingProjectId: string | null;
  productCollapsedProjects: Set<string>;
  basePath: string;
  connected: boolean;
  theme: ThemeMode;
  themeResolved: "light" | "dark";
  hello: GatewayHelloOk | null;
  lastError: string | null;
  eventLog: AppEvent[];
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  chatRunId: string | null;
  compactionStatus: CompactionStatus | null;
  chatAvatarUrl: string | null;
  chatThinkingLevel: string | null;
  chatQueue: ChatQueueItem[];
  chatManualRefreshInFlight: boolean;
  onboardingWizardSessionId: string | null;
  onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  onboardingWizardStep: WizardStep | null;
  onboardingWizardError: string | null;
  onboardingWizardBusy: boolean;
  onboardingWizardMode: "local" | "remote";
  onboardingWizardFlow?: string;
  onboardingWizardWorkspace: string;
  onboardingWizardResetConfig: boolean;
  onboardingWizardTextAnswer: string;
  onboardingWizardMultiAnswers: number[];
  onboardingWizardCurrentStep: number;
  onboardingWizardTotalSteps: number;
  nodesLoading: boolean;
  // NOTE: This property and related imports like fetchDevices, DevicePairingList, GatewayDevice were removed due to being unused.
  chatNewMessagesBelow: boolean;
  sidebarOpen: boolean;
  sidebarContent: string | null;
  sidebarError: string | null;
  splitRatio: number;
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
  // NOTE: These properties and related imports were removed due to being unused.
  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;
  execApprovalsTarget: "gateway" | "node";
  execApprovalsTargetNodeId: string | null;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalBusy: boolean;
  execApprovalError: string | null;
  pendingGatewayUrl: string | null;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  applySessionKey: string;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown;
  configSchemaVersion: string | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormMode: "form" | "raw";
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  configFormDirty: boolean;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: string | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  agentsSelectedId: string | null;
  agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron";
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileActive: string | null;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsError: string | null;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsAgentId: string | null;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  usageLoading: boolean;
  usageResult: SessionsUsageResult | null;
  usageCostSummary: CostUsageSummary | null;
  usageError: string | null;
  usageStartDate: string;
  usageEndDate: string;
  usageSelectedSessions: string[];
  usageSelectedDays: string[];
  usageSelectedHours: number[];
  usageChartMode: "tokens" | "cost";
  usageDailyChartMode: "total" | "by-type";
  usageTimeSeriesMode: "cumulative" | "per-turn";
  usageTimeSeriesBreakdownMode: "total" | "by-type";
  usageTimeSeries: SessionUsageTimeSeries | null;
  usageTimeSeriesLoading: boolean;
  usageSessionLogs: SessionLogEntry[] | null;
  usageSessionLogsLoading: boolean;
  usageSessionLogsExpanded: boolean;
  usageQuery: string;
  usageQueryDraft: string;
  usageQueryDebounceTimer: number | null;
  usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors";
  usageSessionSortDir: "asc" | "desc";
  usageRecentSessions: string[];
  usageTimeZone: "local" | "utc";
  usageContextExpanded: boolean;
  usageHeaderPinned: boolean;
  usageSessionsTab: "all" | "recent";
  usageVisibleColumns: string[];
  usageLogFilterRoles: import("./views/usage.js").SessionLogRole[];
  usageLogFilterTools: string[];
  usageLogFilterHasTools: boolean;
  usageLogFilterQuery: string;
  cronLoading: boolean;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  cronError: string | null;
  cronForm: CronFormState;
  cronRunsJobId: string | null;
  cronRuns: CronRunLogEntry[];
  cronBusy: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsFilter: string;
  skillEdits: Record<string, string>;
  skillMessages: Record<string, SkillMessage>;
  skillsBusyKey: string | null;
  productCreateSkillOpen: boolean;
  productCreateSkillId: string;
  productCreateSkillName: string;
  productCreateSkillDescription: string;
  productCreateSkillFileContent: string;
  debugLoading: boolean;
  debugStatus: StatusSummary | null;
  debugHealth: HealthSnapshot | null;
  debugModels: unknown[];
  debugHeartbeat: unknown;
  debugCallMethod: string;
  debugCallParams: string;
  debugCallResult: string | null;
  debugCallError: string | null;
  logsLoading: boolean;
  logsError: string | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsFilterText: string;
  logsLevelFilters: Record<LogLevel, boolean>;
  logsAutoFollow: boolean;
  logsTruncated: boolean;
  logsCursor: number | null;
  logsLastFetchAt: number | null;
  logsLimit: number;
  logsAtBottom: boolean;
  client: GatewayBrowserClient | null;
  refreshSessionsAfterChat: Set<string>;
  
  // Skill editing state
  productEditingSkillOpen: boolean;
  productEditingSkillId: string | null;
  productEditingSkillName: string;
  productEditingSkillDescription: string;
  productEditingSkillCode: string;

  // Agent Persona editing state
  productEditingAgentOpen: boolean;
  productEditingAgentId: string | null;
  productEditingAgentName: string;
  productEditingAgentDescription: string;
  productEditingAgentTemperament: string;
  productEditingAgentCommunicationStyle: string;
  productEditingAgentKnowledgeBaseSource: string; // New property


  // Dev Drawer activation
  private logoClickCount: number = 0;
  private lastLogoClickTime: number = 0;

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

    // Initialize skill creation state
    this.productCreateSkillOpen = false;
    this.productCreateSkillId = "";
    this.productCreateSkillName = "";
    this.productCreateSkillDescription = "";
    this.productCreateSkillFileContent = "";

    // Initialize skill editing state
    this.productEditingSkillOpen = false;
    this.productEditingSkillId = null;
    this.productEditingSkillName = "";
    this.productEditingSkillDescription = "";
    this.productEditingSkillCode = "";

    // Initialize agent persona editing state
    this.productEditingAgentOpen = false;
    this.productEditingAgentId = null;
    this.productEditingAgentName = "";
    this.productEditingAgentDescription = "";
    this.productEditingAgentTemperament = "";
    this.productEditingAgentCommunicationStyle = "";
    this.productEditingAgentKnowledgeBaseSource = ""; // Initialize new property

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

    window.addEventListener('keydown', this.handleKeyDown);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.theme === "system") {
        this.setTheme("system");
      }
    });

    this.loadLogs();
  }

  // --- Actions / Methods ---

  productOpenEditAgent = async (agentId: string) => {
    if (!this.client) {
      return;
    }
    this.agentsLoading = true; // Use agentsLoading to indicate busy state for agent operations
    this.agentsError = null;
    try {
      const agentDetails = await this.client.request<AgentGetResult>("agents.get", { agentId });
      this.productEditingAgentId = agentDetails.id;
      this.productEditingAgentName = agentDetails.name || "";
      this.productEditingAgentDescription = agentDetails.description || "";
      this.productEditingAgentTemperament = agentDetails.config?.temperament || "";
      this.productEditingAgentCommunicationStyle = agentDetails.config?.communicationStyle || "";
      this.productEditingAgentKnowledgeBaseSource = agentDetails.config?.knowledgeBaseSource || "";
      this.productEditingAgentOpen = true;
    } catch (e) {
      this.agentsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка загрузки агента "${agentId}" для редактирования: ${e}`,
      });
    } finally {
      this.agentsLoading = false;
    }
  };

  productSaveEditedAgent = async () => {
    if (!this.client || !this.productEditingAgentId) {
      return;
    }
    this.agentsLoading = true;
    this.agentsError = null;
    try {
      const updatePayload = {
        agentId: this.productEditingAgentId,
        name: this.productEditingAgentName,
        description: this.productEditingAgentDescription,
        config: {
          temperament: this.productEditingAgentTemperament,
          communicationStyle: this.productEditingAgentCommunicationStyle,
          knowledgeBaseSource: this.productEditingAgentKnowledgeBaseSource,
          // Note: Skills would typically be managed separately or merged carefully if part of this config
        },
      };
      await this.client.request("agents.update", updatePayload);
      sendAppEvent({
        type: "success",
        message: `Агент "${this.productEditingAgentName}" обновлен.`,
      });
      this.productEditingAgentOpen = false;
      this.productEditingAgentId = null;
      this.productEditingAgentName = "";
      this.productEditingAgentDescription = "";
      this.productEditingAgentTemperament = "";
      this.productEditingAgentCommunicationStyle = "";
      this.productEditingAgentKnowledgeBaseSource = "";
      await this.productLoadProjects(); // Reload projects to reflect updated agent names/descriptions
    } catch (e) {
      this.agentsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка сохранения агента "${this.productEditingAgentName}": ${e}`,
      });
    } finally {
      this.agentsLoading = false;
    }
  };

  productCancelEditAgent = () => {
    this.productEditingAgentOpen = false;
    this.productEditingAgentId = null;
    this.productEditingAgentName = "";
    this.productEditingAgentDescription = "";
    this.productEditingAgentTemperament = "";
    this.productEditingAgentCommunicationStyle = "";
    this.productEditingAgentKnowledgeBaseSource = "";
  };


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
      this.productLoadSkills(); // Load skills on connect
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
      sendAppEvent({
        type: "error",
        message: `Ошибка отмены онбординга: ${e}`,
      });
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

  // Dev Drawer activation (methods)
  productHandleLogoClick = () => {
    const now = Date.now();
    if (now - this.lastLogoClickTime < 500) {
      // 500ms for rapid clicks
      this.logoClickCount++;
      if (this.logoClickCount >= 5) {
        this.productDevDrawerOpen = !this.productDevDrawerOpen;
        this.logoClickCount = 0;
        this.lastLogoClickTime = 0;
        sendAppEvent({
          type: "info",
          message: `Dev Drawer toggled: ${this.productDevDrawerOpen ? "on" : "off"}`,
        });
      }
    } else {
      this.logoClickCount = 1;
    }
    this.lastLogoClickTime = now;
  };

  handleSendChat = async () => {
    if (!this.client || (!this.chatMessage.trim() && this.chatAttachments.length === 0)) {
      return;
    }
    this.chatSending = true;
    this.lastError = null;

    try {
      const chatContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      // Add text message if present
      if (this.chatMessage.trim()) {
        chatContent.push({ type: "text", text: this.chatMessage.trim() });
      }

      // Process attachments
      for (const attachment of this.chatAttachments) {
        if (attachment.kind === "image" && attachment.dataUrl) {
          chatContent.push({
            type: "image_url",
            image_url: { url: attachment.dataUrl },
          });
        } else if (attachment.kind === "file") {
          if (attachment.textContent) {
            // For text files, add content directly as text
            chatContent.push({
              type: "text",
              text: `File: ${attachment.fileName} (Type: ${attachment.mimeType})\n\`\`\`\n${attachment.textContent}\n\`\`\``,
            });
          } else if (attachment.base64 && attachment.fileName) {
            // For other binary files, fallback to base64 representation (as before)
            chatContent.push({
              type: "text",
              text: `Attached file: ${attachment.fileName} (Type: ${attachment.mimeType}, Size: ${attachment.sizeBytes} bytes). Content: data:${attachment.mimeType};base64,${attachment.base64}`,
            });
          }
        }
      }

      const messagePayload = {
        sessionKey: this.sessionKey,
        message: {
          role: "user",
          content: chatContent,
        },
      };

      await this.client.sessions.send(messagePayload);

      this.chatMessage = "";
      this.chatAttachments = []; // Clear attachments after sending
      await loadChatHistory(this as unknown as ChatState);
      this.scrollToBottom({ smooth: true });
    } catch (e) {
      this.lastError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to send chat message: ${e}`,
      });
    } finally {
      this.chatSending = false;
    }
  };

  handleAbortChat = async () => {
    if (!this.client || !this.chatRunId) {
      return;
    }
    try {
      await this.client.sessions.abort(this.sessionKey, this.chatRunId);
      this.chatRunId = null;
      sendAppEvent({ type: "info", message: "Chat run aborted." });
    } catch (e) {
      sendAppEvent({ type: "error", message: `Failed to abort chat: ${e}` });
    }
  };

  removeQueuedMessage = (id: string) => {
    this.chatQueue = this.chatQueue.filter((item) => item.id !== id);
  };

  handleChatScroll = (event: Event) => {
    const target = event.target as HTMLDivElement;
    // Determine if user has scrolled up to view older messages
    const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
    this.chatNewMessagesBelow = !isAtBottom;
  };

  scrollToBottom = (opts?: { smooth?: boolean }) => {
    const chatThread = document.querySelector(".chat-thread");
    if (chatThread) {
      chatThread.scrollTo({
        top: chatThread.scrollHeight,
        behavior: opts?.smooth ? "smooth" : "auto",
      });
    }
  };

  handleOpenSidebar = (content: string) => {
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  };

  handleCloseSidebar = () => {
    this.sidebarOpen = false;
    this.sidebarContent = null;
    this.sidebarError = null;
  };

  handleSplitRatioChange = (ratio: number) => {
    this.splitRatio = ratio;
  };

  // --- Logs
  logsLimit = 1000;
  logsCursor: number | null = null;
  logsLastFetchAt: number | null = null;
  logsEntries: LogEntry[] = [];
  logsError: string | null = null;
  logsLoading = false;
  logsFilterText = "";
  logsLevelFilters: Record<LogLevel, boolean> = {
    [LogLevel.Debug]: true,
    [LogLevel.Info]: true,
    [LogLevel.Warn]: true,
    [LogLevel.Error]: true,
    [LogLevel.Fatal]: true,
  };
  logsAutoFollow = true;
  logsTruncated = false;
  logsFile: string | null = null;

  productCreateSkillOpen: boolean;
  productCreateSkillId: string;
  productCreateSkillName: string;
  productCreateSkillDescription: string;
  productCreateSkillFileContent: string;

  private logsScrollListener?: () => void;
  private logsObserver?: MutationObserver;

  // --- Skill Management ---
  productLoadSkills = async () => {
    if (!this.client) {
      return;
    }
    this.skillsLoading = true;
    this.skillsError = null;
    try {
      this.skillsReport = await this.client.skills.status();
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Failed to load skills: ${e}`,
      });
    } finally {
      this.skillsLoading = false;
    }
  };

  productActivateSkill = async (skillId: string) => {
    if (!this.client) {
      return;
    }
    this.skillsBusyKey = skillId;
    this.skillsError = null;
    try {
      await this.client.skills.activate(skillId);
      sendAppEvent({
        type: "success",
        message: `Скилл "${skillId}" активирован.`,
      });
      await this.productLoadSkills();
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка активации скилла "${skillId}": ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  productDeactivateSkill = async (skillId: string) => {
    if (!this.client) {
      return;
    }
    this.skillsBusyKey = skillId;
    this.skillsError = null;
    try {
      await this.client.skills.deactivate(skillId);
      sendAppEvent({
        type: "success",
        message: `Скилл "${skillId}" деактивирован.`,
      });
      await this.productLoadSkills();
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка деактивации скилла "${skillId}": ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  productBulkAssignSkillToAllAgents = async (skillId: string) => {
    if (!this.client) {
      return;
    }

    const confirmMessage = `Вы уверены, что хотите добавить скилл "${skillId}" всем существующим агентам?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    this.skillsBusyKey = `bulk-assign-${skillId}`;
    this.skillsError = null;
    try {
      const agentsList = await this.client.agents.list();
      let successCount = 0;
      let errorCount = 0;

      for (const agent of agentsList.agents) {
        try {
          const agentGetResult = await this.client.request<AgentGetResult>("agents.get", { agentId: agent.id });
          const currentSkills = agentGetResult.config?.skills || [];
          
          if (!currentSkills.includes(skillId)) {
            const updatedSkills = [...currentSkills, skillId];
            await this.client.request("agents.update", {
              agentId: agent.id,
              config: { skills: updatedSkills },
            });
            successCount++;
          } else {
            // Skill already assigned, count as success for this agent
            successCount++; 
          }
        } catch (e) {
          console.error(`Failed to assign skill ${skillId} to agent ${agent.id}: ${e}`);
          errorCount++;
        }
      }

      let message = `Скилл "${skillId}" добавлен ${successCount} агентам.`;
      if (errorCount > 0) {
        message += ` Ошибка при добавлении к ${errorCount} агентам.`;
        sendAppEvent({ type: "warn", message });
      } else {
        sendAppEvent({ type: "success", message });
      }
      await this.productLoadProjects(); // Refresh projects to potentially show skill association (if UI supports it)
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка массового добавления скилла: ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  productOpenEditSkill = async (skillId: string) => {
    if (!this.client) {
      return;
    }
    this.skillsBusyKey = skillId;
    this.skillsError = null;
    try {
      const skillDetails = await this.client.request<SkillGetResult>("skills.get", { skillId });
      this.productEditingSkillId = skillDetails.skillId;
      this.productEditingSkillName = skillDetails.name;
      this.productEditingSkillDescription = skillDetails.description;
      this.productEditingSkillCode = skillDetails.code;
      this.productEditingSkillOpen = true;
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка загрузки скилла "${skillId}" для редактирования: ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  productSaveEditedSkill = async () => {
    if (!this.client || !this.productEditingSkillId) {
      return;
    }
    this.skillsBusyKey = this.productEditingSkillId;
    this.skillsError = null;
    try {
      const updateParams: SkillUpdateParams = {
        skillId: this.productEditingSkillId,
        name: this.productEditingSkillName,
        description: this.productEditingSkillDescription,
        code: this.productEditingSkillCode,
      };
      await this.client.request("skills.update", updateParams);
      sendAppEvent({
        type: "success",
        message: `Скилл "${this.productEditingSkillName}" обновлен.`,
      });
      this.productEditingSkillOpen = false;
      this.productEditingSkillId = null;
      this.productEditingSkillName = "";
      this.productEditingSkillDescription = "";
      this.productEditingSkillCode = "";
      await this.productLoadSkills();
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка сохранения скилла "${this.productEditingSkillName}": ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  productCancelEditSkill = () => {
    this.productEditingSkillOpen = false;
    this.productEditingSkillId = null;
    this.productEditingSkillName = "";
    this.productEditingSkillDescription = "";
    this.productEditingSkillCode = "";
  };


  productEditSkill = (skillId: string) => {
    this.productOpenEditSkill(skillId);
  };

  productCreateSkill = () => {
    this.productCreateSkillOpen = true;
    this.productCreateSkillId = "";
    this.productCreateSkillName = "";
    this.productCreateSkillDescription = "";
    this.productCreateSkillFileContent = `// Скилл ${this.productCreateSkillId || "нового скилла"}
// Описание: ${this.productCreateSkillDescription || "Описание скилла"}

// Пример простого скилла
export async function run(ctx: any, args: any) {
  ctx.log.info("Hello from new skill!");
  return \`Выполнил новый скилл с аргументами: \${JSON.stringify(args)}\`;
}
`;
  };

  productSaveSkill = async () => {
    if (!this.client || !this.productCreateSkillId || !this.productCreateSkillFileContent) {
      return;
    }
    this.skillsBusyKey = "create-skill";
    this.skillsError = null;
    try {
      await this.client.skills.install({
        skillId: this.productCreateSkillId,
        skillName: this.productCreateSkillName,
        description: this.productCreateSkillDescription,
        code: this.productCreateSkillFileContent,
      });
      sendAppEvent({
        type: "success",
        message: `Скилл "${this.productCreateSkillId}" создан и установлен.`,
      });
      this.productCreateSkillOpen = false;
      this.productCreateSkillId = "";
      this.productCreateSkillName = "";
      this.productCreateSkillDescription = "";
      this.productCreateSkillFileContent = "";
      await this.productLoadSkills();
    } catch (e) {
      this.skillsError = String(e);
      sendAppEvent({
        type: "error",
        message: `Ошибка создания скилла "${this.productCreateSkillId}": ${e}`,
      });
    } finally {
      this.skillsBusyKey = null;
    }
  };

  handleSendChat = async () => {

