import { html, nothing } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { loadChatHistory, type ChatState } from "./controllers/chat.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, pathForTab } from "./navigation.ts";
import { renderChat } from "./views/chat.ts";

function buildHref(tab: string, basePath: string): string {
  const base = normalizeBasePath(basePath ?? "");
  const path = pathForTab(tab as never, base);
  return path;
}

function renderDevDrawer(state: AppViewState) {
  if (!state.productDevDrawerOpen) {
    return nothing;
  }
  return html`
    <div class="product-dev-drawer ${state.productDevDrawerOpen ? 'open' : ''}">
      <div class="product-dev-drawer__header">
        <div>Для разработчиков</div>
        <button class="btn btn--sm" @click=${() => (state.productDevDrawerOpen = false)}>
          ${icons.x}
        </button>
      </div>
      <div class="product-dev-drawer__body">
        <button class="btn" @click=${() => void state.productReloadConfig()}>
          Обновить конфиг
        </button>
        <button class="btn danger" @click=${() => void state.productResetAll()}>
          Сбросить все
        </button>
        <a class="btn" href=${buildHref("chat", state.basePath)}>Legacy: Chat</a>
        <a class="btn" href=${buildHref("overview", state.basePath)}>Legacy: Overview</a>
        <a class="btn" href=${buildHref("channels", state.basePath)}>Legacy: Channels</a>
        <a class="btn" href=${buildHref("agents", state.basePath)}>Legacy: Agents</a>
        <a class="btn" href=${buildHref("skills", state.basePath)}>Legacy: Skills</a>
        <a class="btn" href=${buildHref("config", state.basePath)}>Legacy: Config</a>
        <a class="btn" href=${buildHref("logs", state.basePath)}>Legacy: Logs</a>
        <div class="callout" style="margin-top:12px;">
          Legacy UI доступен только здесь. Product UI остается минимальным.
        </div>
      </div>
    </div>
  `;
}

function renderCreateProjectModal(state: AppViewState) {
  if (!state.productCreateProjectOpen) {
    return nothing;
  }
  return html`
    <div class="product-modal-backdrop ${state.productCreateProjectOpen ? 'open' : ''}" @click=${() => (state.productCreateProjectOpen = false)}>
      <div class="product-modal" @click=${(e: Event) => e.stopPropagation()}>
        <div class="product-modal__title">Новый проект</div>
        <label class="field">
          <span>Название</span>
          <input
            .value=${state.productCreateProjectName}
            @input=${(e: Event) => (state.productCreateProjectName = (e.target as HTMLInputElement).value)}
            placeholder="Например: Маркетинг"
          />
        </label>
        <label class="field">
          <span>Описание (опционально)</span>
          <input
            .value=${state.productCreateProjectDesc}
            @input=${(e: Event) => (state.productCreateProjectDesc = (e.target as HTMLInputElement).value)}
            placeholder="Что делать в этом проекте"
          />
        </label>
        <div class="row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn" @click=${() => (state.productCreateProjectOpen = false)}>Отмена</button>
          <button class="btn primary" @click=${() => void state.productCreateProject()}>Создать</button>
        </div>
      </div>
    </div>
  `;
}

function renderTelegramPanel(state: AppViewState) {
  return html`
    <section class="card">
      <div class="card-title">Telegram</div>
      <div class="card-sub">Подключение бота (доступ по allowlist).</div>
      <label class="field">
        <span>Bot token</span>
        <input
          type="password"
          .value=${state.productTelegramToken}
          @input=${(e: Event) => (state.productTelegramToken = (e.target as HTMLInputElement).value)}
          placeholder="123456:ABC..."
        />
      </label>
      <label class="field">
        <span>Твой user id</span>
        <input
          .value=${state.productTelegramAllowFrom}
          @input=${(e: Event) => (state.productTelegramAllowFrom = (e.target as HTMLInputElement).value)}
          placeholder="Например: 123456789"
        />
      </label>
      ${state.productTelegramError ? html`<div class="callout danger">${state.productTelegramError}</div>` : nothing}
      ${state.productTelegramSuccess ? html`<div class="callout ok">${state.productTelegramSuccess}</div>` : nothing}
      <div class="row" style="margin-top:12px;">
        <button
          class="btn primary"
          ?disabled=${state.productTelegramBusy}
          @click=${() => void state.productConnectTelegram()}
        >
          ${state.productTelegramBusy ? "Подключаю..." : "Подключить Telegram"}
        </button>
      </div>
    </section>
  `;
}

export function renderProductApp(state: AppViewState) {
  const chatDisabledReason = state.connected ? null : "Нет подключения к gateway.";
  const chatReady = state.connected && state.simpleOnboardingDone;
  const agentId =
    state.productAgentId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    "main";

  const sessions = state.productSessionsResult?.sessions ?? [];
  const projectList = state.agentsList?.agents ?? [];

  const main = !state.connected
    ? html`
        <section class="card">
          <div class="card-title">Подключение</div>
          <div class="card-sub">Введи URL и токен gateway.</div>
          <div class="form-grid">
            <label class="field">
              <span>WebSocket URL</span>
              <input
                .value=${state.settings.gatewayUrl}
                @input=${(e: Event) => state.applySettings({ ...state.settings, gatewayUrl: (e.target as HTMLInputElement).value })}
                placeholder="ws://127.0.0.1:18789"
              />
            </label>
            <label class="field">
              <span>Gateway token</span>
              <input
                .value=${state.settings.token}
                @input=${(e: Event) => state.applySettings({ ...state.settings, token: (e.target as HTMLInputElement).value })}
                placeholder="OPENCLAW_GATEWAY_TOKEN"
              />
            </label>
            <label class="field">
              <span>Password (если есть)</span>
              <input
                type="password"
                .value=${state.password}
                @input=${(e: Event) => (state.password = (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
          <div class="row" style="margin-top:12px;">
            <button class="btn primary" @click=${() => state.connect()}>Подключить</button>
          </div>
          ${state.lastError ? html`<div class="callout danger" style="margin-top:12px;">${state.lastError}</div>` : nothing}
        </section>
      `
    : !state.simpleOnboardingDone
      ? html`
          <section class="card">
            <div class="card-title">Настройка</div>
            <div class="card-sub">Нужно только ввести Eliza API key (сохраняется локально на gateway).</div>
            ${
              state.onboardingWizardStatus !== "running"
                ? html`
                    <div class="row">
                      <button
                        class="btn primary"
                        ?disabled=${state.onboardingWizardBusy}
                        @click=${() => {
                          state.onboardingWizardFlow = "eliza";
                          state.onboardingWizardMode = "local";
                          state.onboardingWizardWorkspace = "";
                          state.onboardingWizardResetConfig = false;
                          void state.startOnboardingWizard();
                        }}
                      >
                        ${state.onboardingWizardBusy ? "Запуск..." : "Старт"}
                      </button>
                    </div>
                  `
                : nothing
            }
            ${state.onboardingWizardError ? html`<div class="callout danger" style="margin-top:12px;">${state.onboardingWizardError}</div>` : nothing}
            ${
              state.onboardingWizardStatus === "running" && state.onboardingWizardStep
                ? html`
                    <div style="margin-top: 12px;">
                      ${state.onboardingWizardStep.title
                        ? html`<div class="card-sub" style="margin-bottom:6px;">${state.onboardingWizardStep.title}</div>`
                        : nothing}
                      ${state.onboardingWizardStep.message
                        ? html`<div style="margin-bottom:8px; font-size:0.9em;">${state.onboardingWizardStep.message}</div>`
                        : nothing}
                      ${state.onboardingWizardStep.type === "text"
                        ? html`
                            <label class="field">
                              <input
                                type=${state.onboardingWizardStep.sensitive ? "password" : "text"}
                                .value=${state.onboardingWizardTextAnswer}
                                @input=${(e: Event) =>
                                  (state.onboardingWizardTextAnswer = (
                                    e.target as HTMLInputElement
                                  ).value)}
                                placeholder=${state.onboardingWizardStep.placeholder ?? "Введите значение"}
                                ?disabled=${state.onboardingWizardBusy}
                                @keydown=${(e: KeyboardEvent) => {
                                  if (e.key === "Enter") void state.advanceOnboardingWizard();
                                }}
                              />
                            </label>
                            <div class="row" style="margin-top:8px;">
                              <button
                                class="btn primary"
                                ?disabled=${state.onboardingWizardBusy || !state.onboardingWizardTextAnswer.trim()}
                                @click=${() => void state.advanceOnboardingWizard()}
                              >
                                ${state.onboardingWizardBusy ? "Сохраняю…" : "Продолжить"}
                              </button>
                            </div>
                          `
                        : state.onboardingWizardStep.type === "note" ||
                            state.onboardingWizardStep.type === "action"
                          ? html`
                              <div class="row" style="margin-top:8px;">
                                <button
                                  class="btn primary"
                                  ?disabled=${state.onboardingWizardBusy}
                                  @click=${() => void state.advanceOnboardingWizard(true)}
                                >
                                  ${state.onboardingWizardBusy ? "…" : "OK"}
                                </button>
                              </div>
                            `
                          : nothing}
                    </div>
                  `
                : nothing
            }
          </section>
        `
      : state.productPanel === "telegram"
        ? renderTelegramPanel(state)
        : html`
            ${renderChat({
              sessionKey: state.sessionKey,
              onSessionKeyChange: () => undefined,
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
                  refreshChatAvatar(state as unknown as Parameters<typeof refreshChatAvatar>[0]),
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
              onNewSession: () => void state.productNewChat(),
              onResetSession: () => void state.productResetChat(),
              allowNewSession: true,
              newSessionLabel: "Новый чат",
              resetLabel: "Сбросить чат",
              stopLabel: "Стоп",
              sendLabel: "Отправить",
              attachmentsLabel: "Вложения",
              messageLabel: "Сообщение",
              showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
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
          `;

  return html`
    <div class="product-shell">
      <aside class="product-rail">
        <button class="product-rail__btn" title="Новый чат" ?disabled=${!chatReady} @click=${() => void state.productNewChat()}>
          +
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "projects"}
          title="Проекты"
          @click=${() => (state.productPanel = "projects")}
        >
          ${icons.folder}
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "telegram"}
          title="Telegram"
          @click=${() => (state.productPanel = "telegram")}
        >
          ${icons.link}
        </button>
        <div style="flex:1"></div>
        <button class="product-rail__btn" title="Для разработчиков" @click=${() => (state.productDevDrawerOpen = true)}>
          &lt;/&gt;
        </button>
      </aside>

      <aside class="product-sidebar">
        <div class="product-sidebar__header">
          <div class="product-title">OpenClaw</div>
          <div class="product-sub">Проекты</div>
        </div>
        <div class="product-sidebar__section">
          <button class="btn" @click=${() => (state.productCreateProjectOpen = true)}>Создать проект</button>
        </div>
        <div class="product-sidebar__list">
          ${projectList.map(
            (p) => html`
              <button
                class="product-item ${p.id === agentId ? "active" : ""}"
                @click=${() => void state.productSelectAgent(p.id)}
              >
                <div class="product-item__title">${p.identity?.name ?? p.name ?? p.id}</div>
                <div class="product-item__sub">${p.id}</div>
              </button>
            `,
          )}
        </div>

        <div class="product-sidebar__header" style="margin-top:12px;">
          <div class="product-sub">Чаты</div>
          <button class="btn btn--sm" ?disabled=${!chatReady} @click=${() => void state.productNewChat()}>+</button>
        </div>
        <div class="product-sidebar__list">
          ${sessions.map(
            (s) => html`
              <button
                class="product-item ${s.key === state.sessionKey ? "active" : ""}"
                ?disabled=${!chatReady}
                @click=${() => {
                  void state.productOpenSession(s.key);
                }}
              >
                <div class="product-item__title">${s.displayName ?? s.label ?? s.key}</div>
                <div class="product-item__sub">${s.lastMessage?.text ?? ""}</div>
              </button>
            `,
          )}
        </div>
      </aside>

      <main class="product-main">
        ${main}
      </main>
    </div>
    ${renderDevDrawer(state)}
    ${renderCreateProjectModal(state)}
  `;
}
