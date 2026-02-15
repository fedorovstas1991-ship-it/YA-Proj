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
    <div class="product-dev-drawer ${state.productDevDrawerOpen ? "open" : ""}" role="dialog" aria-labelledby="dev-drawer-title" aria-modal="true">
      <div class="product-dev-drawer__header">
        <div id="dev-drawer-title">Для разработчиков</div>
        <button class="btn btn--sm" aria-label="Закрыть панель разработчика" title="Закрыть" @click=${() => (state.productDevDrawerOpen = false)}>
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
    <div class="product-modal-backdrop ${state.productCreateProjectOpen ? "open" : ""}" role="presentation" @click=${() => (state.productCreateProjectOpen = false)}>
      <div class="product-modal" role="dialog" aria-labelledby="create-project-title" aria-modal="true" @click=${(e: Event) => e.stopPropagation()}>
        <div class="product-modal__title" id="create-project-title">Новый проект</div>
        <label class="field">
          <span>Название</span>
          <input
            .value=${state.productCreateProjectName}
            @input=${(e: Event) => (state.productCreateProjectName = (e.target as HTMLInputElement).value)}
            placeholder="Например: Маркетинг"
            aria-label="Название проекта"
          />
        </label>
        <label class="field">
          <span>Описание (опционально)</span>
          <input
            .value=${state.productCreateProjectDesc}
            @input=${(e: Event) => (state.productCreateProjectDesc = (e.target as HTMLInputElement).value)}
            placeholder="Что делать в этом проекте"
            aria-label="Описание проекта"
          />
        </label>
        <div class="row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn" aria-label="Отменить создание" @click=${() => (state.productCreateProjectOpen = false)}>Отмена</button>
          <button class="btn primary" aria-label="Создать новый проект" @click=${() => void state.productCreateProject()}>Создать</button>
        </div>
      </div>
    </div>
  `;
}

function renderConfirmDeleteProjectModal(state: AppViewState) {
  if (!state.productConfirmDeleteProjectOpen) {
    return nothing;
  }
  return html`
    <div class="product-modal-backdrop ${state.productConfirmDeleteProjectOpen ? "open" : ""}" role="presentation" @click=${() => (state.productConfirmDeleteProjectOpen = false)}>
      <div class="product-modal" role="dialog" aria-labelledby="confirm-delete-project-title" aria-modal="true" @click=${(e: Event) => e.stopPropagation()}>
        <div class="product-modal__title" id="confirm-delete-project-title">Удалить проект "${state.productConfirmDeleteProjectName}"?</div>
        <div class="product-modal__body">
          <p>Выверены, что хотите удалить проект "${state.productConfirmDeleteProjectName}"?</p>
          <p>Это действие необратимо и удалит все связанные чаты.</p>
        </div>
        <div class="row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn" aria-label="Отменить удаление" @click=${() => (state.productConfirmDeleteProjectOpen = false)}>Отмена</button>
          <button class="btn danger" aria-label="Подтвердить удаление проекта" @click=${() => void state.productDeleteProject(state.productConfirmDeleteProjectId!)}>Удалить</button>
        </div>
      </div>
    </div>
  `;
}

function renderConfirmDeleteChatModal(state: AppViewState) {
  if (!state.productConfirmDeleteChatOpen) {
    return nothing;
  }
  return html`
    <div class="product-modal-backdrop ${state.productConfirmDeleteChatOpen ? "open" : ""}" role="presentation" @click=${() => (state.productConfirmDeleteChatOpen = false)}>
      <div class="product-modal" role="dialog" aria-labelledby="confirm-delete-chat-title" aria-modal="true" @click=${(e: Event) => e.stopPropagation()}>
        <div class="product-modal__title" id="confirm-delete-chat-title">Удалить чат "${state.productConfirmDeleteChatDisplayName}"?</div>
        <div class="product-modal__body">
          <p>Вы уверены, что хотите удалить чат "${state.productConfirmDeleteChatDisplayName}"?</p>
          <p>Это действие необратимо.</p>
        </div>
        <div class="row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn" aria-label="Отменить удаление" @click=${() => (state.productConfirmDeleteChatOpen = false)}>Отмена</button>
          <button class="btn danger" aria-label="Подтвердить удаление чата" @click=${() => void state.productDeleteChat(state.productConfirmDeleteChatSessionKey!)}>Удалить</button>
        </div>
      </div>
    </div>
  `;
}

function renderProjectsPanel(state: AppViewState) {
  const sessions = state.productSessionsResult?.sessions ?? [];
  const projects = state.productProjects ?? [];
  const chatReady = state.connected && state.simpleOnboardingDone;

  // Get sessions not in any project
  const projectSessionKeys = new Set(projects.flatMap((p) => p.sessionKeys ?? []));
  const ungroupedSessions = sessions.filter((s) => !projectSessionKeys.has(s.key));

  return html`
    <div class="product-projects-panel">
      ${
        projects.length > 0
          ? html`
            ${projects.map(
              (project) => html`
                <div class="product-project-group">
                  <button
                    class="product-project-header"
                    @click=${() => state.productToggleProjectCollapsed(project.id)}
                  >
                    <span class="product-project-icon">${state.productCollapsedProjects.has(project.id) ? "▶" : "▼"}</span>
                    <span class="product-project-name">📁 ${project.name}</span>
                    <button class="btn btn--sm" title="Новый чат в проекте" @click=${(e: Event) => {
                      e.stopPropagation();
                      void state.productNewChatInProject(project.id);
                    }}>+
                    </button>
                    <button class="btn btn--sm danger" title="Удалить проект" @click=${(
                      e: Event,
                    ) => {
                      e.stopPropagation();
                      state.productConfirmDeleteProject(project.id);
                    }}>
                      ${icons.trash}
                    </button>
                  </button>
                  ${
                    !state.productCollapsedProjects.has(project.id)
                      ? html`
                        <div class="product-project-chats">
                          ${(project.sessionKeys ?? [])
                            .map((key) => sessions.find((s) => s.key === key))
                            .filter(Boolean)
                            .map(
                              (s) => html`
                                <button
                                  class="product-item product-item--nested ${s?.key === state.sessionKey ? "active" : ""}"
                                  ?disabled=${!chatReady}
                                >
                                  <div class="product-item__title" @click=${() => {
                                    if (s?.key) {
                                      void state.productOpenSession(s.key);
                                    }
                                  }}>└ ${s?.displayName ?? s?.label ?? s?.key}</div>
                                  <div class="product-item__sub" @click=${() => {
                                    if (s?.key) {
                                      void state.productOpenSession(s.key);
                                    }
                                  }}>${s?.lastMessage?.text ?? ""}</div>
                                  <button class="btn btn--sm danger" title="Удалить чат" @click=${(
                                    e: Event,
                                  ) => {
                                    e.stopPropagation();
                                    state.productConfirmDeleteChat(s.key!);
                                  }}>
                                    ${icons.trash}
                                  </button>
                                </button>
                              `,
                            )}
                        </div>
                      `
                      : nothing
                  }
                </div>
              `,
            )}
          `
          : nothing
      }

      ${
        ungroupedSessions.length > 0
          ? html`
            <div class="product-project-group">
              <div class="product-project-header product-project-header--ungrouped">
                <span class="product-project-name">Без проекта</span>
              </div>
              <div class="product-project-chats">
                ${ungroupedSessions.map(
                  (s) => html`
                    <button
                      class="product-item product-item--nested ${s.key === state.sessionKey ? "active" : ""}"
                      ?disabled=${!chatReady}
                    >
                      <div class="product-item__title" @click=${() => {
                        void state.productOpenSession(s.key);
                      }}>└ ${s.displayName ?? s.label ?? s.key}</div>
                      <div class="product-item__sub" @click=${() => {
                        void state.productOpenSession(s.key);
                      }}>${s.lastMessage?.text ?? ""}</div>
                      <button class="btn btn--sm danger" title="Удалить чат" @click=${(
                        e: Event,
                      ) => {
                        e.stopPropagation();
                        state.productConfirmDeleteChat(s.key);
                      }}>
                        ${icons.trash}
                      </button>
                    </button>
                  `,
                )}
              </div>
            </div>
          `
          : nothing
      }
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
                    <div class="wizard-container" style="margin: -20px -24px -16px; padding: 20px 24px 16px;">
                      <div class="wizard-card">
                        <!-- Progress Bar -->
                        <div class="wizard-progress">
                          <span class="wizard-step-label">
                            Step ${state.onboardingWizardCurrentStep ?? 1} of ${state.onboardingWizardTotalSteps ?? 1}
                          </span>
                          <div class="wizard-progress-bar">
                            ${Array.from({ length: state.onboardingWizardTotalSteps ?? 1 }).map(
                              (_, i) => html`
                                <div
                                  class="wizard-segment"
                                  data-state=${
                                    i < (state.onboardingWizardCurrentStep ?? 0)
                                      ? "completed"
                                      : i === (state.onboardingWizardCurrentStep ?? 0)
                                        ? "current"
                                        : "upcoming"
                                  }
                                ></div>
                              `,
                            )}
                          </div>
                        </div>

                        <!-- Step Content -->
                        <div class="wizard-step-content">
                          ${
                            state.onboardingWizardStep.title
                              ? html`<h2 class="wizard-title">${state.onboardingWizardStep.title}</h2>`
                              : nothing
                          }
                          ${
                            state.onboardingWizardStep.message
                              ? html`<p class="wizard-description">${state.onboardingWizardStep.message}</p>`
                              : nothing
                          }

                          <!-- Text Input -->
                          ${
                            state.onboardingWizardStep.type === "text"
                              ? html`
                                <input
                                  type="text"
                                  class="wizard-input"
                                  .value=${state.onboardingWizardTextAnswer}
                                  @input=${(e: Event) =>
                                    (state.onboardingWizardTextAnswer = (
                                      e.target as HTMLInputElement
                                    ).value)}
                                  placeholder=${state.onboardingWizardStep.placeholder ?? "Введите значение"}
                                  ?disabled=${state.onboardingWizardBusy}
                                  @keydown=${(e: KeyboardEvent) => {
                                    if (e.key === "Enter") {
                                      void state.advanceOnboardingWizard();
                                    }
                                  }}
                                  aria-label="Text input"
                                />
                                <button
                                  class="wizard-button primary"
                                  ?disabled=${state.onboardingWizardBusy || !state.onboardingWizardTextAnswer.trim()}
                                  @click=${() => void state.advanceOnboardingWizard()}
                                >
                                  ${state.onboardingWizardBusy ? "⏳ Сохраняю…" : "Продолжить"}
                                </button>
                              `
                              : nothing
                          }

                          <!-- Password Input -->
                          ${
                            state.onboardingWizardStep.type === "password"
                              ? html`
                                <input
                                  type="password"
                                  class="wizard-input"
                                  .value=${state.onboardingWizardTextAnswer}
                                  @input=${(e: Event) =>
                                    (state.onboardingWizardTextAnswer = (
                                      e.target as HTMLInputElement
                                    ).value)}
                                  placeholder=${state.onboardingWizardStep.placeholder ?? "Введите пароль"}
                                  ?disabled=${state.onboardingWizardBusy}
                                  @keydown=${(e: KeyboardEvent) => {
                                    if (e.key === "Enter") {
                                      void state.advanceOnboardingWizard();
                                    }
                                  }}
                                  aria-label="Password input"
                                />
                                <button
                                  class="wizard-button primary"
                                  ?disabled=${state.onboardingWizardBusy || !state.onboardingWizardTextAnswer.trim()}
                                  @click=${() => void state.advanceOnboardingWizard()}
                                >
                                  ${state.onboardingWizardBusy ? "⏳ Сохраняю…" : "Продолжить"}
                                </button>
                              `
                              : nothing
                          }

                          <!-- Confirm Buttons -->
                          ${
                            state.onboardingWizardStep.type === "confirm"
                              ? html`
                                <div class="wizard-confirm-buttons">
                                  <button
                                    class="wizard-button secondary"
                                    ?disabled=${state.onboardingWizardBusy}
                                    @click=${() => void state.advanceOnboardingWizard(false)}
                                    aria-label="No"
                                  >
                                    ${state.onboardingWizardBusy ? "…" : "Нет"}
                                  </button>
                                  <button
                                    class="wizard-button primary"
                                    ?disabled=${state.onboardingWizardBusy}
                                    @click=${() => void state.advanceOnboardingWizard(true)}
                                    aria-label="Yes"
                                  >
                                    ${state.onboardingWizardBusy ? "…" : "Да"}
                                  </button>
                                </div>
                              `
                              : nothing
                          }

                          <!-- Select Options -->
                          ${
                            state.onboardingWizardStep.type === "select"
                              ? html`
                                <div class="wizard-select-options">
                                  ${
                                    (state.onboardingWizardStep.options ?? []).length > 0
                                      ? (state.onboardingWizardStep.options ?? []).map(
                                          (opt) => html`
                                            <button
                                              class="wizard-option"
                                              ?disabled=${state.onboardingWizardBusy}
                                              @click=${() => void state.advanceOnboardingWizard(opt.value)}
                                              title=${opt.hint ?? ""}
                                              aria-label="Select: ${opt.label}"
                                            >
                                              <span>${opt.label}</span>
                                              ${opt.hint ? html`<span style="font-size: 12px; color: var(--wizard-text-light);">${opt.hint}</span>` : nothing}
                                              <div class="wizard-option-checkmark"></div>
                                            </button>
                                          `,
                                        )
                                      : html`
                                          <div style="opacity: 0.6; font-style: italic">Нет доступных опций</div>
                                        `
                                  }
                                </div>
                              `
                              : nothing
                          }

                          <!-- Multiselect Options -->
                          ${
                            state.onboardingWizardStep.type === "multiselect"
                              ? html`
                                <div class="wizard-multiselect-options">
                                  ${
                                    (state.onboardingWizardStep.options ?? []).length > 0
                                      ? (state.onboardingWizardStep.options ?? []).map(
                                          (opt, idx) => html`
                                            <button
                                              class="wizard-multiselect-item ${state.onboardingWizardMultiAnswers.includes(idx) ? "selected" : ""}"
                                              ?disabled=${state.onboardingWizardBusy}
                                              @click=${() => {
                                                const checked =
                                                  state.onboardingWizardMultiAnswers.includes(idx);
                                                if (checked) {
                                                  state.onboardingWizardMultiAnswers =
                                                    state.onboardingWizardMultiAnswers.filter(
                                                      (i) => i !== idx,
                                                    );
                                                } else {
                                                  state.onboardingWizardMultiAnswers = [
                                                    ...state.onboardingWizardMultiAnswers,
                                                    idx,
                                                  ].toSorted((a, b) => a - b);
                                                }
                                              }}
                                              aria-label="Select: ${opt.label}"
                                            >
                                              <div class="wizard-checkbox"></div>
                                              <div class="wizard-multiselect-label">
                                                <div class="wizard-multiselect-text">${opt.label}</div>
                                                ${
                                                  opt.hint
                                                    ? html`<div class="wizard-multiselect-hint">${opt.hint}</div>`
                                                    : nothing
                                                }
                                              </div>
                                            </button>
                                          `,
                                        )
                                      : html`
                                          <div style="opacity: 0.6; font-style: italic">Нет доступных опций</div>
                                        `
                                  }
                                </div>
                                <button
                                  class="wizard-button primary"
                                  ?disabled=${state.onboardingWizardBusy}
                                  @click=${() => void state.advanceOnboardingWizard()}
                                  style="margin-top: 12px;"
                                >
                                  ${state.onboardingWizardBusy ? "⏳ Продолжаю…" : "Продолжить"}
                                </button>
                              `
                              : nothing
                          }

                          <!-- Note and Action Messages -->
                          ${
                            state.onboardingWizardStep.type === "note" ||
                            state.onboardingWizardStep.type === "action"
                              ? html`
                                <div
                                  class="wizard-${state.onboardingWizardStep.type}"
                                  style="margin-top: 16px;"
                                >
                                  <div class="wizard-note-icon">
                                    ${state.onboardingWizardStep.type === "action" ? "⚙️" : "ℹ️"}
                                  </div>
                                  <div class="wizard-note-content">
                                    ${
                                      state.onboardingWizardStep.type === "action"
                                        ? state.onboardingWizardStep.message
                                        : html`<p>${state.onboardingWizardStep.message}</p>`
                                    }
                                  </div>
                                </div>
                                <button
                                  class="wizard-button primary"
                                  ?disabled=${state.onboardingWizardBusy}
                                  @click=${() => void state.advanceOnboardingWizard(true)}
                                  style="margin-top: 16px;"
                                >
                                  ${state.onboardingWizardBusy ? "⏳ Обработка…" : "OK"}
                                </button>
                              `
                              : nothing
                          }

                          <!-- Progress Spinner -->
                          ${
                            state.onboardingWizardStep.type === "progress"
                              ? html`
                                  <div class="wizard-progress-spinner">
                                    <div class="spinner"></div>
                                    <span class="spinner-text">Обработка…</span>
                                  </div>
                                `
                              : nothing
                          }
                        </div>
                      </div>
                    </div>
                  `
                : nothing
            }
          </section>
        `
      : state.productPanel === "projects"
        ? renderProjectsPanel(state)
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
      <aside class="product-rail" role="navigation" aria-label="Главная навигация">
        <button class="product-rail__btn" title="Новый чат" aria-label="Новый чат" ?disabled=${!chatReady} @click=${() => void state.productNewChat()}>
          +
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "projects"}
          title="Проекты"
          aria-label="Панель проектов"
          aria-pressed=${state.productPanel === "projects"}
          @click=${() => (state.productPanel = "projects")}
        >
          ${icons.folder}
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "telegram"}
          title="Telegram"
          aria-label="Панель Telegram"
          aria-pressed=${state.productPanel === "telegram"}
          @click=${() => (state.productPanel = "telegram")}
        >
          ${icons.link}
        </button>
        <div style="flex:1"></div>
      </aside>

      <aside class="product-sidebar" role="complementary" aria-label="Sidebar with projects and chats">
        <div class="product-sidebar__header">
          <div class="product-title">OpenClaw</div>
          <div class="product-sub">Проекты</div>
        </div>
        <div class="product-sidebar__section">
          <button class="btn" aria-label="Create new project" @click=${() => (state.productCreateProjectOpen = true)}>Создать проект</button>
        </div>
        <div class="product-sidebar__list">
          ${projectList.map(
            (p) => html`
              <button
                class="product-item ${p.id === agentId ? "active" : ""}"
                aria-label="${p.identity?.name ?? p.name ?? p.id} проект"
                aria-current=${p.id === agentId ? "page" : "false"}
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
          <button class="btn btn--sm" aria-label="New chat" ?disabled=${!chatReady} @click=${() => void state.productNewChat()}>+</button>
        </div>
        <div class="product-sidebar__list">
          ${sessions.map(
            (s) => html`
              <button
                class="product-item ${s.key === state.sessionKey ? "active" : ""}"
                ?disabled=${!chatReady}
                aria-label="Чат: ${s.displayName ?? s.label ?? s.key}"
                aria-current=${s.key === state.sessionKey ? "page" : "false"}
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
    ${renderConfirmDeleteProjectModal(state)}
    ${renderConfirmDeleteChatModal(state)}
  `;
}
