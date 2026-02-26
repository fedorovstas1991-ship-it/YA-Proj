import { html } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import type { GatewaySessionRow, SessionsListResult, WizardStep } from "./types.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { syncUrlWithSessionKey } from "./app-settings.ts";
import { loadChatHistory, type ChatState } from "./controllers/chat.ts";
import { formatRelativeTimestamp } from "./format.ts";
import { normalizeBasePath, pathForTab } from "./navigation.ts";
import { renderChat } from "./views/chat.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";

const SIMPLE_SESSION_LIMIT = 60;

type SimpleSessionEntry = {
  key: string;
  title: string;
  subtitle: string;
};

function resolveSimpleSessionTitle(key: string, row?: GatewaySessionRow): string {
  const displayName = row?.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const label = row?.label?.trim();
  if (label) {
    return label;
  }
  if (key === "main" || key.endsWith(":main")) {
    return "Main chat";
  }
  if (key.includes(":dm:")) {
    return "Direct chat";
  }
  if (key.includes(":group:")) {
    return "Group chat";
  }
  return key.length > 46 ? `${key.slice(0, 46)}...` : key;
}

function resolveSimpleSessionSubtitle(key: string, row?: GatewaySessionRow): string {
  if (row?.updatedAt) {
    return formatRelativeTimestamp(row.updatedAt);
  }
  return key.length > 62 ? `${key.slice(0, 62)}...` : key;
}

function buildSimpleSessions(
  sessions: SessionsListResult | null,
  currentSessionKey: string,
): SimpleSessionEntry[] {
  const rows = (sessions?.sessions ?? []).filter((row) => row.kind !== "global");
  const currentRow = rows.find((row) => row.key === currentSessionKey);
  const dedup = new Set<string>();
  const sorted = [...rows]
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, SIMPLE_SESSION_LIMIT);

  const entries: SimpleSessionEntry[] = [];

  if (currentSessionKey) {
    entries.push({
      key: currentSessionKey,
      title: resolveSimpleSessionTitle(currentSessionKey, currentRow),
      subtitle: resolveSimpleSessionSubtitle(currentSessionKey, currentRow),
    });
    dedup.add(currentSessionKey);
  }

  for (const row of sorted) {
    if (dedup.has(row.key)) {
      continue;
    }
    dedup.add(row.key);
    entries.push({
      key: row.key,
      title: resolveSimpleSessionTitle(row.key, row),
      subtitle: resolveSimpleSessionSubtitle(row.key, row),
    });
  }

  return entries;
}

function switchSimpleSession(state: AppViewState, next: string) {
  const sessionKey = next.trim();
  if (!sessionKey || sessionKey === state.sessionKey) {
    return;
  }
  state.sessionKey = sessionKey;
  state.chatMessage = "";
  state.chatAttachments = [];
  state.chatStream = null;
  state.chatStreamStartedAt = null;
  state.chatRunId = null;
  state.chatQueue = [];
  state.resetToolStream();
  state.resetChatScroll();
  state.applySettings({
    ...state.settings,
    sessionKey,
    lastActiveSessionKey: sessionKey,
  });
  void state.loadAssistantIdentity();
  syncUrlWithSessionKey(
    state as unknown as Parameters<typeof syncUrlWithSessionKey>[0],
    sessionKey,
    false,
  );
  void loadChatHistory(state as unknown as ChatState);
  void refreshChatAvatar(state as unknown as Parameters<typeof refreshChatAvatar>[0]);
}

function resetSimpleOnboardingState(state: AppViewState) {
  state.onboardingWizardSessionId = null;
  state.onboardingWizardStatus = "idle";
  state.onboardingWizardStep = null;
  state.onboardingWizardError = null;
  state.onboardingWizardTextAnswer = "";
  state.onboardingWizardMultiAnswers = [];
}

async function skipOnboardingAndOpenChat(state: AppViewState) {
  const hasActiveWizard =
    state.onboardingWizardStatus === "running" && Boolean(state.onboardingWizardSessionId);
  if (hasActiveWizard) {
    await state.cancelOnboardingWizard();
  }
  state.setOnboardingWizardDone();
}

function buildTabHref(
  tab: "chat" | "overview" | "channels",
  basePath: string,
  sessionKey: string,
): string {
  const path = pathForTab(tab, basePath);
  if (!sessionKey) {
    return path;
  }
  if (tab !== "chat") {
    return path;
  }
  return `${path}?session=${encodeURIComponent(sessionKey)}`;
}

function isAuthErrorMessage(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized.includes("unauthorized") || normalized.includes("token mismatch");
}

function isWizardRunning(state: AppViewState): boolean {
  return state.onboardingWizardStatus === "running" && Boolean(state.onboardingWizardSessionId);
}

function normalizeWizardValueKey(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") {
    return `${t}:${String(value)}`;
  }
  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return `raw:${String(value)}`;
  }
}

function renderConnectionPanel(state: AppViewState) {
  const authError = isAuthErrorMessage(state.lastError);
  return html`
    <section class="card simple-setup-card">
      <div class="card-title">1. Подключение к локальному Yagent</div>
      <div class="card-sub">
        Репозиторий уже есть, шаг скачивания пропущен. Здесь только подключение и запуск настройки.
      </div>

      <div class="form-grid simple-form-grid">
        <label class="field">
          <span>WebSocket URL</span>
          <input
            .value=${state.settings.gatewayUrl}
            @input=${(event: Event) => {
      const value = (event.target as HTMLInputElement).value;
      state.applySettings({ ...state.settings, gatewayUrl: value });
    }}
            placeholder="ws://127.0.0.1:18789"
          />
        </label>

        <label class="field">
          <span>Gateway token</span>
          <input
            .value=${state.settings.token}
            @input=${(event: Event) => {
      const value = (event.target as HTMLInputElement).value;
      state.applySettings({ ...state.settings, token: value });
    }}
            placeholder="YAGENT_GATEWAY_TOKEN"
          />
        </label>

        <label class="field">
          <span>Password (если используется)</span>
          <input
            type="password"
            .value=${state.password}
            @input=${(event: Event) => {
      state.password = (event.target as HTMLInputElement).value;
    }}
            placeholder="gateway password"
          />
        </label>
      </div>

      <div class="row simple-actions">
        <button class="btn primary" type="button" @click=${() => state.connect()}>Подключить</button>
        <button
          class="btn"
          type="button"
          @click=${() => {
      state.applySettings({ ...state.settings, token: "" });
      state.password = "";
      state.lastError = null;
    }}
        >
          Сбросить токен/пароль
        </button>
        <a class="btn" href=${buildTabHref("overview", state.basePath, state.sessionKey)}>
          Расширенные настройки
        </a>
      </div>

      ${state.lastError
      ? html`
              <div class="callout danger simple-callout">${state.lastError}</div>
              ${authError
          ? html`
                      <div class="callout simple-callout">
                        Токен не совпадает с gateway. Вставьте актуальный токен или нажмите “Сбросить токен/пароль” и
                        подключитесь снова.
                      </div>
                    `
          : null
        }
            `
      : html`
              <div class="callout simple-callout">
                Если сервис не поднят, запустите локальный gateway и вернитесь на этот экран.
              </div>
            `
    }
    </section>
  `;
}

function renderWizardStep(state: AppViewState, step: WizardStep) {
  const title = step.title?.trim() || "Шаг онбординга";
  const message = step.message?.trim() ?? "";

  const renderBody = () => {
    if (step.type === "select") {
      const options = Array.isArray(step.options) ? step.options : [];
      return html`
        <div class="simple-choice-grid">
          ${options.map((option) => {
        const active =
          step.initialValue !== undefined &&
          normalizeWizardValueKey(step.initialValue) === normalizeWizardValueKey(option.value);
        return html`
              <button
                class="btn simple-choice ${active ? "active" : ""}"
                type="button"
                ?disabled=${state.onboardingWizardBusy}
                @click=${() => void state.advanceOnboardingWizard(option.value)}
              >
                <span class="simple-choice__label">${option.label}</span>
                ${option.hint ? html`<span class="simple-choice__hint">${option.hint}</span>` : null}
              </button>
            `;
      })}
        </div>
      `;
    }

    if (step.type === "text") {
      return html`
        <div class="simple-step-stack">
          <label class="field">
            <span>${step.sensitive ? "Ключ" : "Ответ"}</span>
            <input
              .value=${state.onboardingWizardTextAnswer}
              type=${step.sensitive ? "password" : "text"}
              placeholder=${step.placeholder ?? "Введите значение"}
              ?disabled=${state.onboardingWizardBusy}
              @keydown=${(event: KeyboardEvent) => {
          if (event.key !== "Enter" || event.shiftKey) {
            return;
          }
          event.preventDefault();
          void state.advanceOnboardingWizard();
        }}
              @input=${(event: Event) => {
          state.onboardingWizardTextAnswer = (event.target as HTMLInputElement).value;
        }}
            />
          </label>
          <div class="row">
            <button
              class="btn primary"
              type="button"
              ?disabled=${state.onboardingWizardBusy}
              @click=${() => void state.advanceOnboardingWizard()}
            >
              Далее
            </button>
          </div>
        </div>
      `;
    }

    if (step.type === "confirm") {
      return html`
        <div class="row">
          <button
            class="btn primary"
            type="button"
            ?disabled=${state.onboardingWizardBusy}
            @click=${() => void state.advanceOnboardingWizard(true)}
          >
            Да
          </button>
          <button
            class="btn"
            type="button"
            ?disabled=${state.onboardingWizardBusy}
            @click=${() => void state.advanceOnboardingWizard(false)}
          >
            Нет
          </button>
        </div>
      `;
    }

    if (step.type === "multiselect") {
      const options = Array.isArray(step.options) ? step.options : [];
      const selected = new Set(state.onboardingWizardMultiAnswers);
      return html`
        <div class="simple-step-stack">
          <div class="simple-check-list">
            ${options.map(
        (option, index) => html`
                <label class="field checkbox simple-check-item">
                  <input
                    type="checkbox"
                    .checked=${selected.has(index)}
                    ?disabled=${state.onboardingWizardBusy}
                    @change=${(event: Event) => {
            const checked = (event.target as HTMLInputElement).checked;
            const next = new Set(state.onboardingWizardMultiAnswers);
            if (checked) {
              next.add(index);
            } else {
              next.delete(index);
            }
            state.onboardingWizardMultiAnswers = [...next].toSorted((a, b) => a - b);
          }}
                  />
                  <span>${option.label}</span>
                </label>
              `,
      )}
          </div>
          <div class="row">
            <button
              class="btn primary"
              type="button"
              ?disabled=${state.onboardingWizardBusy}
              @click=${() => void state.advanceOnboardingWizard()}
            >
              Далее
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="row">
        <button
          class="btn primary"
          type="button"
          ?disabled=${state.onboardingWizardBusy}
          @click=${() => void state.advanceOnboardingWizard()}
        >
          Далее
        </button>
      </div>
    `;
  };

  return html`
    <div class="simple-step-card">
      <div class="simple-step-title">${title}</div>
      ${message ? html`<div class="simple-step-message">${message}</div>` : null}
      ${renderBody()}
    </div>
  `;
}

function renderOnboardingPanel(state: AppViewState) {
  const running = isWizardRunning(state);
  const step = state.onboardingWizardStep;
  const elizaOnly = true;

  return html`
    <section class="card simple-setup-card">
      <div class="card-title">2. Настройка</div>
      <div class="card-sub">
        ${elizaOnly
      ? "Нужно только ввести Eliza API key. Ключ сохраняется локально на gateway и не хранится в браузере."
      : "Все шаги выполняются тут, без ручного редактирования config в консоли."
    }
      </div>

      ${elizaOnly
      ? null
      : html`
              <div class="form-grid simple-form-grid">
                <label class="field">
                  <span>Режим</span>
                  <select
                    .value=${state.onboardingWizardMode}
                    ?disabled=${running || state.onboardingWizardBusy}
                    @change=${(event: Event) => {
          const value = (event.target as HTMLSelectElement).value;
          state.onboardingWizardMode = value === "remote" ? "remote" : "local";
        }}
                  >
                    <option value="local">Local gateway (рекомендуется)</option>
                    <option value="remote">Remote gateway</option>
                  </select>
                </label>

                <label class="field">
                  <span>Рабочая папка (опционально)</span>
                  <input
                    .value=${state.onboardingWizardWorkspace}
                    ?disabled=${running || state.onboardingWizardBusy}
                    @input=${(event: Event) => {
          state.onboardingWizardWorkspace = (event.target as HTMLInputElement).value;
        }}
                    placeholder="~/yagent-workspace"
                  />
                </label>

                <label class="field checkbox">
                  <input
                    type="checkbox"
                    .checked=${state.onboardingWizardResetConfig}
                    ?disabled=${running || state.onboardingWizardBusy}
                    @change=${(event: Event) => {
          state.onboardingWizardResetConfig = (
            event.target as HTMLInputElement
          ).checked;
        }}
                  />
                  <span>Очистить конфиг перед онбордингом</span>
                </label>
              </div>
            `
    }

      <div class="row simple-actions">
        <button
          class="btn primary"
          type="button"
          ?disabled=${state.onboardingWizardBusy || running}
          @click=${() => {
      state.onboardingWizardFlow = "eliza";
      state.onboardingWizardMode = "local";
      state.onboardingWizardWorkspace = "";
      state.onboardingWizardResetConfig = false;
      void state.startOnboardingWizard();
    }}
        >
          ${state.onboardingWizardBusy ? "Запуск..." : elizaOnly ? "Старт" : "Запустить онбординг"}
        </button>
        ${elizaOnly
      ? null
      : html`
              <button
                class="btn"
                type="button"
                ?disabled=${!running || state.onboardingWizardBusy}
                @click=${() => void state.cancelOnboardingWizard()}
              >
                Отменить
              </button>
              <button
                class="btn"
                type="button"
                ?disabled=${state.onboardingWizardBusy}
                @click=${() => void skipOnboardingAndOpenChat(state)}
              >
                Уже настроено, открыть чат
              </button>
            `
    }
      </div>

      ${state.onboardingWizardError
      ? html`<div class="callout danger simple-callout">${state.onboardingWizardError}</div>`
      : null
    }

      ${running && step
      ? renderWizardStep(state, step)
      : running
        ? html`
                <div class="callout simple-callout">Ожидание следующего шага...</div>
              `
        : null
    }
    </section>
  `;
}

export function renderSimpleApp(state: AppViewState) {
  const chatReady = state.connected && state.simpleOnboardingDone;
  const chatDisabledReason = state.connected
    ? null
    : "Нет подключения к локальному gateway. Проверьте адрес и токен.";
  const simpleSessions = buildSimpleSessions(state.sessionsResult, state.sessionKey);
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconHref = basePath ? `${basePath}/favicon.svg` : "/favicon.svg";

  return html`
    <div class="simple-shell">
      <aside class="simple-sidebar">
        <div class="simple-brand">
          <div class="simple-brand__mark">
            <img src="/ya_logo_pixel.png" alt="Yandex Agent" />
          </div>
          <div>
            <div class="simple-brand__title">Yandex Agent</div>
            <div class="simple-brand__sub">Простой режим</div>
          </div>
        </div>

        <button
          class="btn primary simple-new-chat"
          type="button"
          ?disabled=${!chatReady}
          @click=${() => state.handleSendChat("/new", { restoreDraft: true })}
        >
          + Новый чат
        </button>

        <div class="simple-section-title">Последние чаты</div>
        <div class="simple-session-list">
          ${simpleSessions.length === 0
      ? html`
                  <div class="simple-empty">Пока нет чатов.</div>
                `
      : simpleSessions.map(
        (entry) => html`
                    <button
                      class="simple-session ${entry.key === state.sessionKey ? "active" : ""}"
                      type="button"
                      ?disabled=${!chatReady}
                      @click=${() => switchSimpleSession(state, entry.key)}
                    >
                      <span class="simple-session__title">${entry.title}</span>
                      <span class="simple-session__meta">${entry.subtitle}</span>
                    </button>
                  `,
      )
    }
        </div>

        <div class="simple-sidebar-footer">
          <button
            class="btn simple-nav-link"
            type="button"
            @click=${() => (state.simpleDevToolsOpen = !state.simpleDevToolsOpen)}
          >
            Для разработчиков
          </button>
          ${state.simpleDevToolsOpen
      ? html`
                <div class="simple-dev-links">
                  <a class="btn simple-nav-link" href=${buildTabHref("overview", state.basePath, state.sessionKey)}>
                    Расширенные настройки
                  </a>
                </div>
              `
      : null
    }
        </div>
      </aside>

      <main class="simple-main">
        <header class="simple-topbar">
          <div class="simple-topbar__left">
            <div class="simple-status ${state.connected ? "ok" : "off"}">
              <span class="simple-status__dot"></span>
              <span>${state.connected ? "Подключено" : "Оффлайн"}</span>
            </div>
            <div class="simple-session-pill">
              ${state.sessionKey || "main"}
            </div>
          </div>
          <div class="simple-topbar__right">
            ${state.connected && !state.simpleOnboardingDone
      ? html`
                    <button
                      class="btn btn--sm"
                      type="button"
                      ?disabled=${state.onboardingWizardBusy}
                      @click=${() => void skipOnboardingAndOpenChat(state)}
                    >
                      Открыть чат
                    </button>
                  `
      : null
    }
            ${state.connected && state.simpleOnboardingDone
      ? html`
                    <button
                      class="btn btn--sm"
                      type="button"
                      @click=${() => {
          state.setSimpleOnboardingDone(false);
          resetSimpleOnboardingState(state);
        }}
                    >
                      Онбординг заново
                    </button>
                  `
      : null
    }
            ${state.simpleDevToolsOpen
      ? html`
                  <a class="btn btn--sm" href=${buildTabHref("chat", state.basePath, state.sessionKey)}>
                    Полный интерфейс
                  </a>
                `
      : null
    }
          </div>
        </header>

        ${!state.connected
      ? html`<div class="simple-main-content">${renderConnectionPanel(state)}</div>`
      : !state.simpleOnboardingDone
        ? html`<div class="simple-main-content">${renderOnboardingPanel(state)}</div>`
        : html`
                  <div class="simple-chat-wrap">
                    ${renderChat({
          sessionKey: state.sessionKey,
          onSessionKeyChange: (next) => switchSimpleSession(state, next),
          thinkingLevel: state.chatThinkingLevel,
          showThinking: false,
          loading: state.chatLoading,
          sending: state.chatSending,
          compactionStatus: state.compactionStatus,
          assistantAvatarUrl: state.chatAvatarUrl,
          messages: state.chatMessages,
          toolMessages: state.chatToolMessages,
          stream: state.chatStream,
          streamStartedAt: state.chatStreamStartedAt,
          draft: state.chatMessage,
          queue: state.chatQueue,
          connected: state.connected,
          canSend: state.connected,
          disabledReason: chatDisabledReason,
          error: state.lastError,
          sessions: state.sessionsResult,
          focusMode: false,
          onRefresh: () =>
            Promise.all([
              loadChatHistory(state as unknown as ChatState),
              refreshChatAvatar(
                state as unknown as Parameters<typeof refreshChatAvatar>[0],
              ),
            ]),
          onToggleFocusMode: () => undefined,
          onChatScroll: (event) => state.handleChatScroll(event),
          onDraftChange: (next) => (state.chatMessage = next),
          attachments: state.chatAttachments,
          onAttachmentsChange: (next) => (state.chatAttachments = next),
          onSend: () => state.handleSendChat(),
          canAbort: Boolean(state.chatRunId),
          onAbort: () => void state.handleAbortChat(),
          onQueueRemove: (id) => state.removeQueuedMessage(id),
          onNewSession: () => state.handleSendChat("/new", { restoreDraft: true }),
          allowNewSession: state.simpleDevToolsOpen,
          showNewMessages:
            state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
          onScrollToBottom: () => state.scrollToBottom(),
          sidebarOpen: state.sidebarOpen,
          sidebarContent: state.sidebarContent,
          sidebarError: state.sidebarError,
          splitRatio: state.splitRatio,
          onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
          onCloseSidebar: () => state.handleCloseSidebar(),
          onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
          assistantName: state.assistantName,
          assistantAvatar: state.assistantAvatar,
        })}
                  </div>
                `
    }
      </main>
    </div>
    ${renderExecApprovalPrompt(state)}
    ${renderGatewayUrlConfirmation(state)}
  `;
}
