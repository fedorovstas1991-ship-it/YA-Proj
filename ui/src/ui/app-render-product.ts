import { html, nothing, type TemplateResult } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { loadChatHistory, type ChatState } from "./controllers/chat.ts";
import { buildCronPromptTemplate } from "./controllers/cron-wizard.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, pathForTab } from "./navigation.ts";
import { renderChat } from "./views/chat.ts";

function extractMessageRole(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }
  const role = (message as { role?: unknown }).role;
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

function isTelegramReadyForCta(state: AppViewState): boolean {
  const telegram =
    (state.channelsSnapshot?.channels as
      | { telegram?: { configured?: boolean; running?: boolean; probe?: { ok?: boolean } | null } }
      | undefined)?.telegram;
  const configured = telegram?.configured === true;
  const running = telegram?.running === true;
  const probeOk = telegram?.probe?.ok === true;
  return configured && (running || probeOk);
}

function shouldShowFirstGreetingCta(state: AppViewState): boolean {
  if (state.chatFirstGreetingCtaDismissedSessionKey === state.sessionKey) {
    return false;
  }
  if (!state.connected || state.chatStream !== null || isTelegramReadyForCta(state)) {
    return false;
  }
  const messages = Array.isArray(state.chatMessages) ? state.chatMessages : [];
  if (messages.length === 0) {
    return false;
  }
  const hasAssistantMessage = messages.some((msg) => extractMessageRole(msg) === "assistant");
  return hasAssistantMessage;
}

function shouldShowNdaTelegramCta(state: AppViewState): boolean {
  if (state.productChatMode !== "nda") {
    return false;
  }
  if (state.productNdaTelegramCtaDismissed) {
    return false;
  }
  if (isTelegramReadyForCta(state)) {
    return false;
  }
  return true;
}


function renderSettingsPanel(state: AppViewState) {
  const agentId = state.productAgentId ?? state.agentsList?.defaultId ?? "main";
  const agent = state.agentsList?.agents?.find(a => a.id === agentId);

  return html`
    <div class="product-panel">
      <div class="product-panel__header">Настройки агента</div>
      
      <div class="product-panel__section">
        <label class="product-field">
          <span>Модель</span>
          <input 
            class="product-input"
            .value=${state.productEditingAgentModel || agent?.config?.model || ""} 
            @input=${(e: Event) => (state.productEditingAgentModel = (e.target as HTMLInputElement).value)}
            placeholder="moonshotai/kimi-k2.5" 
          />
        </label>
      </div>

      <div class="product-panel__section">
        <label class="product-field">
          <span>Системный промпт</span>
          <textarea 
            class="product-textarea"
            .value=${state.productEditingAgentPrompt || agent?.config?.systemPrompt || ""} 
            @input=${(e: Event) => (state.productEditingAgentPrompt = (e.target as HTMLTextAreaElement).value)}
            placeholder="Ты - полезный ассистент..."
          ></textarea>
        </label>
      </div>

      <div class="product-panel__section">
        <label class="product-field">
          <span>API ключ Eliza/OpenRouter</span>
          <input 
            class="product-input"
            type="password"
            .value=${state.productEditingAgentApiKey || ""} 
            @input=${(e: Event) => (state.productEditingAgentApiKey = (e.target as HTMLInputElement).value)}
            placeholder="y1__xDov6eRpdT..." 
          />
        </label>
      </div>

      <div class="product-panel__section">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">
          Статус подключения: 
          <span style="color: ${state.connected ? "#15803d" : "#b91c1c"}; font-weight: 600;">
            ${state.connected ? "Подключено" : "Отключено"}
          </span>
        </div>
      </div>

      <div class="product-panel__section">
        <button class="product-btn primary" style="width: 100%" @click=${() => void state.productSaveAgentSettings(agentId)}>
          Сохранить настройки
        </button>
      </div>
    </div>
  `;
}

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

  const renderChatItem = (s: { key: string; displayName?: string; label?: string; lastMessage?: { text?: string } }) => html`
    <button
      class="product-chat-item ${s.key === state.sessionKey ? "active" : ""}"
      ?disabled=${!chatReady}
      @click=${() => void state.productOpenSession(s.key)}
    >
      <div class="product-chat-item__name">${s.displayName ?? s.label ?? s.key}</div>
      ${s.lastMessage?.text
      ? html`<div class="product-chat-item__preview">${s.lastMessage.text}</div>`
      : nothing
    }
      <button
        class="product-chat-item__delete"
        title="Удалить"
        @click=${(e: Event) => {
      e.stopPropagation();
      state.productConfirmDeleteChat(s.key);
    }}
      >×</button>
    </button>
  `;

  return html`
    <div class="product-sidebar-panel">
      <div class="product-sidebar-panel__header">
        <span class="product-sidebar-panel__title">Чаты</span>
      </div>

      ${projects.length > 0
      ? projects.map(
        (project) => html`
              <div class="product-chat-group">
                <button
                  class="product-chat-group__header"
                  @click=${() => state.productToggleProjectCollapsed(project.id)}
                >
                  <span class="product-chat-group__icon">${state.productCollapsedProjects.has(project.id) ? "▸" : "▾"}</span>
                  <span class="product-chat-group__name">${project.name}</span>
                  <button class="product-chat-group__add" title="Новый чат" @click=${(e: Event) => {
            e.stopPropagation();
            void state.productNewChatInProject(project.id);
          }}>+</button>
                </button>
                ${!state.productCollapsedProjects.has(project.id)
            ? html`
                      <div class="product-chat-group__items">
                        ${(project.sessionKeys ?? [])
                .map((key) => sessions.find((s) => s.key === key))
                .filter((s): s is NonNullable<typeof s> => !!s)
                .map(renderChatItem)}
                      </div>
                    `
            : nothing
          }
              </div>
            `,
      )
      : nothing
    }

      ${ungroupedSessions.length > 0
      ? html`
            <div class="product-chat-group">
              ${ungroupedSessions.map(renderChatItem)}
            </div>
          `
      : nothing
    }
    </div>
  `;
}

function renderTelegramPanel(state: AppViewState) {
  return html`
    <section class="product-panel">
      <div class="product-panel__header">Telegram</div>

      <div class="product-panel__sub" style="margin-bottom: 16px;">Обычный режим (агент «Обычный»)</div>
      <label class="product-field">
        <span>Bot token</span>
        <input
          class="product-input"
          type="password"
          .value=${state.productTelegramToken}
          @input=${(e: Event) => (state.productTelegramToken = (e.target as HTMLInputElement).value)}
          placeholder="123456:ABC..."
        />
      </label>
      <label class="product-field">
        <span>Твой user id</span>
        <input
          class="product-input"
          .value=${state.productTelegramAllowFrom}
          @input=${(e: Event) => (state.productTelegramAllowFrom = (e.target as HTMLInputElement).value)}
          placeholder="Например: 123456789"
        />
        <div class="product-field__help">
          Чтобы бот отвечал только вам. Получить ID: напишите @userinfobot.
        </div>
      </label>
      ${state.productTelegramError ? html`<div class="product-callout danger">${state.productTelegramError}</div>` : nothing}
      ${state.productTelegramSuccess ? html`<div class="product-callout ok">${state.productTelegramSuccess}</div>` : nothing}
      <div class="product-panel__section">
        <button
          class="product-btn primary"
          ?disabled=${state.productTelegramBusy}
          @click=${() => void state.productConnectTelegram()}
        >
          ${state.productTelegramBusy ? "Подключаю..." : "Подключить"}
        </button>
      </div>

      <div style="margin: 20px 0 12px; border-top: 1px solid var(--border-color, #333); padding-top: 16px;">
        <div class="product-panel__sub">🔒 NDA-режим (агент «NDA»)</div>
        <div class="product-field__help" style="margin-bottom: 12px;">Отдельный бот — NDA-контент не смешивается с обычным.</div>
      </div>
      <label class="product-field">
        <span>Bot token (NDA)</span>
        <input
          class="product-input"
          type="password"
          .value=${state.productTelegramNdaToken}
          @input=${(e: Event) => (state.productTelegramNdaToken = (e.target as HTMLInputElement).value)}
          placeholder="123456:ABC..."
        />
      </label>
      <label class="product-field">
        <span>Твой user id</span>
        <input
          class="product-input"
          .value=${state.productTelegramNdaAllowFrom}
          @input=${(e: Event) => (state.productTelegramNdaAllowFrom = (e.target as HTMLInputElement).value)}
          placeholder="Например: 123456789"
        />
      </label>
      ${state.productTelegramNdaError ? html`<div class="product-callout danger">${state.productTelegramNdaError}</div>` : nothing}
      ${state.productTelegramNdaSuccess ? html`<div class="product-callout ok">${state.productTelegramNdaSuccess}</div>` : nothing}
      <div class="product-panel__section">
        <button
          class="product-btn primary"
          ?disabled=${state.productTelegramNdaBusy}
          @click=${() => void state.productConnectTelegramNda()}
        >
          ${state.productTelegramNdaBusy ? "Подключаю..." : "Подключить NDA-бота"}
        </button>
      </div>
    </section>
  `;
}

function renderSkillsPanel(state: AppViewState) {
  return html`
    <section class="product-panel">
      <div class="product-panel__header">Управление скиллами</div>
      <div class="product-panel__sub">Список доступных скиллов и их конфигурация.</div>
      <div class="product-skills-list">
        ${state.skillsReport?.skills && state.skillsReport.skills.length > 0
      ? state.skillsReport.skills.map(
        (skill) => html`
                <div class="product-skill-item">
                  <div class="product-skill-item__header">
                    <span class="product-skill-item__name">${skill.skillKey}</span>
                    ${!skill.disabled
            ? html`<span class="product-badge active">Активен</span>`
            : html`<span class="product-badge inactive">Неактивен</span>`
          }
                  </div>
                  <div class="product-skill-item__desc">${skill.description}</div>
                  <div class="product-skill-actions">
                    <button class="product-btn secondary product-btn--sm" @click=${() => state.productEditSkill(skill.skillKey)}>
                      ${icons.edit} Ред.
                    </button>
                    ${!skill.disabled
            ? html`
                          <button
                            class="product-btn danger product-btn--sm"
                            @click=${() => state.productDeactivateSkill(skill.skillKey)}
                            ?disabled=${state.skillsBusyKey === skill.skillKey}
                          >
                            ${state.skillsBusyKey === skill.skillKey ? "..." : "Откл."}
                          </button>
                        `
            : html`
                          <button
                            class="product-btn primary product-btn--sm"
                            @click=${() => state.productActivateSkill(skill.skillKey)}
                            ?disabled=${state.skillsBusyKey === skill.skillKey}
                          >
                            ${state.skillsBusyKey === skill.skillKey ? "..." : "Вкл."}
                          </button>
                        `
          }
                  </div>
                </div>
              `,
      )
      : html`<p class="product-panel__sub">Нет доступных скиллов.</p>`
    }
      </div>
      <div class="product-panel__section">
        <button class="product-btn primary" @click=${() => state.productCreateSkill()}>Добавить новый скилл</button>
      </div>
      ${state.skillsError ? html`<div class="product-callout danger" style="margin-top:12px;">${state.skillsError}</div>` : nothing}
    </section>
  `;
}

function renderCreateSkillModal(state: AppViewState) {
  if (!state.productCreateSkillOpen) {
    return nothing;
  }
  return html`
    <div class="product-modal-backdrop ${state.productCreateSkillOpen ? "open" : ""}" role="presentation" @click=${() => (state.productCreateSkillOpen = false)}>
      <div class="product-modal" role="dialog" aria-labelledby="create-skill-title" aria-modal="true" @click=${(e: Event) => e.stopPropagation()}>
        <div class="product-modal__title" id="create-skill-title">Создать новый скилл</div>
        <label class="field">
          <span>ID скилла (уникальный идентификатор)</span>
          <input
            .value=${state.productCreateSkillId}
            @input=${(e: Event) => (state.productCreateSkillId = (e.target as HTMLInputElement).value)}
            placeholder="Например: my-first-skill"
            aria-label="ID скилла"
          />
        </label>
        <label class="field">
          <span>Название скилла</span>
          <input
            .value=${state.productCreateSkillName}
            @input=${(e: Event) => (state.productCreateSkillName = (e.target as HTMLInputElement).value)}
            placeholder="Например: Мой первый скилл"
            aria-label="Название скилла"
          />
        </label>
        <label class="field">
          <span>Описание скилла (опционально)</span>
          <textarea
            .value=${state.productCreateSkillDescription}
            @input=${(e: Event) => (state.productCreateSkillDescription = (e.target as HTMLTextAreaElement).value)}
            placeholder="Описание того, что делает этот скилл"
            aria-label="Описание скилла"
          ></textarea>
        </label>
        <label class="field">
          <span>Код скилла</span>
          <textarea
            style="min-height: 200px; font-family: monospace;"
            .value=${state.productCreateSkillFileContent}
            @input=${(e: Event) => (state.productCreateSkillFileContent = (e.target as HTMLTextAreaElement).value)}
            aria-label="Код скилла"
          ></textarea>
        </label>
        <div class="row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn" aria-label="Отменить создание" @click=${() => (state.productCreateSkillOpen = false)}>Отмена</button>
          <button
            class="btn primary"
            aria-label="Создать скилл"
            ?disabled=${state.skillsBusyKey === "create-skill" || !state.productCreateSkillId.trim() || !state.productCreateSkillFileContent.trim()}
            @click=${() => void state.productSaveSkill()}
          >
            ${state.skillsBusyKey === "create-skill" ? "Создаю..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
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
            <div class="card-sub">
              Нужен токен из https://ai.yandex-team.ru/quota.
              Нажмите «Получить токен», затем вставьте его (формат <code>y1_...</code>).
            </div>
            ${state.onboardingWizardStatus !== "running"
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
            ${state.onboardingWizardStatus === "running" && state.onboardingWizardStep
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
                                  data-state=${i < (state.onboardingWizardCurrentStep ?? 0)
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
                          <img src="/ya_logo_pixel.png" alt="YA" class="wizard-logo" />
                          ${state.onboardingWizardStep.title
              ? html`<h2 class="wizard-title">${state.onboardingWizardStep.title}</h2>`
              : nothing
            }
                          ${state.onboardingWizardStep.message
              ? html`<p class="wizard-description">${state.onboardingWizardStep.message}</p>`
              : nothing
            }

                          <!-- Text Input -->
                          ${state.onboardingWizardStep.type === "text"
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
                          ${state.onboardingWizardStep.type === "password"
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
                          ${state.onboardingWizardStep.type === "confirm"
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
                          ${state.onboardingWizardStep.type === "select"
              ? html`
                                <div class="wizard-select-options">
                                  ${(state.onboardingWizardStep.options ?? []).length > 0
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
                          ${state.onboardingWizardStep.type === "multiselect"
              ? html`
                                <div class="wizard-multiselect-options">
                                  ${(state.onboardingWizardStep.options ?? []).length > 0
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
                                                ${opt.hint
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
                          ${state.onboardingWizardStep.type === "note" ||
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
                                    ${state.onboardingWizardStep.type === "action"
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
                          ${state.onboardingWizardStep.type === "progress"
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
      : state.productPanel === "telegram"
        ? renderTelegramPanel(state)
        : state.productPanel === "skills"
          ? renderSkillsPanel(state)
          : html`
            ${renderChat({
            sessionKey: state.sessionKey,
            onSessionKeyChange: () => undefined,
            chatMode: state.productChatMode,
            ndaModeBusy: state.productNdaBusy,
            ndaModeError: state.productNdaError,
            onChatModeChange: (mode) => void state.productSetChatMode(mode),
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
            showFirstGreetingCta: shouldShowFirstGreetingCta(state),
            telegramConnected: isTelegramReadyForCta(state),
            onOpenTelegramSetup: () => {
              state.chatFirstGreetingCtaDismissedSessionKey = state.sessionKey;
              state.productPanel = "telegram";
            },
            onInsertAutomationPrompt: () => {
              state.chatFirstGreetingCtaDismissedSessionKey = state.sessionKey;
              state.chatMessage = buildCronPromptTemplate(state.cronWizard);
              state.productPanel = "chat";
            },
            onDismissFirstGreetingCta: () => {
              state.chatFirstGreetingCtaDismissedSessionKey = state.sessionKey;
            },
            showNdaTelegramCta: shouldShowNdaTelegramCta(state),
            onOpenNdaTelegramSetup: () => {
              state.productNdaTelegramCtaDismissed = true;
              state.productPanel = "telegram";
            },
            onDismissNdaTelegramCta: () => {
              state.productNdaTelegramCtaDismissed = true;
            },
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
        <div class="product-rail__logo">
          <img src="/ya_logo_pixel.png" alt="YA" />
        </div>
        <div class="product-rail__divider"></div>
        <button 
          class="product-rail__btn product-rail__btn--new" 
          title="Новый чат" 
          aria-label="Новый чат" 
          ?disabled=${!chatReady} 
          @click=${() => void state.productNewChat()}
        >
          +
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "projects"}
          title="Чаты"
          aria-label="Панель чатов"
          aria-pressed=${state.productPanel === "projects"}
          @click=${() => (state.productPanel = "projects")}
        >
          <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Чат</span>
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "telegram"}
          title="Telegram"
          aria-label="Панель Telegram"
          aria-pressed=${state.productPanel === "telegram"}
          @click=${() => (state.productPanel = "telegram")}
        >
          <span class="product-rail__text-icon">TG</span>
        </button>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "skills"}
          title="Скиллы"
          aria-label="Панель скиллов"
          aria-pressed=${state.productPanel === "skills"}
          @click=${() => (state.productPanel = "skills")}
        >
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Скилл</span>
        </button>
        <div style="flex:1"></div>
        <button
          class="product-rail__btn"
          data-active=${state.productPanel === "settings"}
          title="Настройки"
          aria-label="Настройки"
          aria-pressed=${state.productPanel === "settings"}
          @click=${() => (state.productPanel = "settings")}
        >
          <svg viewBox="0 0 24 24">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span>Опции</span>
        </button>
      </aside>

      <aside class="product-sidebar" role="complementary" aria-label="Sidebar navigation">
        ${state.productPanel === "projects"
      ? renderProjectsPanel(state)
      : state.productPanel === "telegram"
        ? renderTelegramPanel(state)
        : state.productPanel === "skills"
          ? renderSkillsPanel(state)
          : state.productPanel === "settings"
            ? renderSettingsPanel(state)
            : nothing
    }
      </aside>

      <main class="product-main">
        ${main}
      </main>
    </div>
    ${renderDevDrawer(state)}
    ${renderCreateProjectModal(state)}
    ${renderConfirmDeleteProjectModal(state)}
    ${renderConfirmDeleteChatModal(state)}
    ${renderCreateSkillModal(state)}
  `;
}
