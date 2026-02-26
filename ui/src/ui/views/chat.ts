import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import type { SessionsListResult } from "../types.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import type { ChatAttachment, ChatQueueItem } from "../ui-types.ts";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat/grouped-render.ts";
import { normalizeMessage, normalizeRoleForGrouping } from "../chat/message-normalizer.ts";
import { icons } from "../icons.ts";
import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/resizable-divider.ts";

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};

export type ChatProps = {
  sessionKey: string;
  onSessionKeyChange: (next: string) => void;
  chatMode?: "regular" | "nda";
  ndaModeBusy?: boolean;
  ndaModeError?: string | null;
  onChatModeChange?: (mode: "regular" | "nda") => void;
  thinkingLevel: string | null;
  showThinking: boolean;
  loading: boolean;
  sending: boolean;
  canAbort?: boolean;
  compactionStatus?: CompactionIndicatorStatus | null;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  assistantAvatarUrl?: string | null;
  draft: string;
  queue: ChatQueueItem[];
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;
  sessions: SessionsListResult | null;
  // Focus mode
  focusMode: boolean;
  // Sidebar state
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  sidebarError?: string | null;
  splitRatio?: number;
  assistantName: string;
  assistantAvatar: string | null;
  // Image attachments
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Scroll control
  showNewMessages?: boolean;
  onScrollToBottom?: () => void;
  showFirstGreetingCta?: boolean;
  telegramConnected?: boolean;
  showNdaTelegramCta?: boolean;
  onOpenTelegramSetup?: () => void;
  onOpenNdaTelegramSetup?: () => void;
  onInsertAutomationPrompt?: () => void;
  onDismissFirstGreetingCta?: () => void;
  onDismissNdaTelegramCta?: () => void;
  // Event handlers
  onRefresh: () => void;
  onToggleFocusMode: () => void;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onQueueRemove: (id: string) => void;
  onNewSession: () => void;
  allowNewSession?: boolean;
  onResetSession?: () => void;
  newSessionLabel?: string;
  resetLabel?: string;
  stopLabel?: string;
  sendLabel?: string;
  attachmentsLabel?: string;
  messageLabel?: string;
  composePlaceholder?: string;
  onOpenSidebar?: (content: string) => void;
  onCloseSidebar?: () => void;
  onSplitRatioChange?: (ratio: number) => void;
  onChatScroll?: (event: Event) => void;
};

const COMPACTION_TOAST_DURATION_MS = 5000;

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }

  // Show "compacting..." while active
  if (status.active) {
    return html`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${icons.loader} Сжимаю контекст...
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${icons.check} Контекст сжат
        </div>
      `;
    }
  }

  return nothing;
}

function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function base64FromDataUrl(dataUrl: string): string | null {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  return match?.[1] ? match[1] : null;
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function addAttachmentFromFile(file: File, props: ChatProps) {
  if (!props.onAttachmentsChange) {
    return;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    window.alert(
      `Файл слишком большой: ${file.name} (${file.size} байт). Лимит: ${MAX_ATTACHMENT_BYTES}.`,
    );
    return;
  }
  const isImage = Boolean(file.type) && file.type.startsWith("image/");
  const isTextFile =
    Boolean(file.type) &&
    (file.type.startsWith("text/") ||
      file.type.includes("json") ||
      file.type.includes("xml") ||
      file.type.includes("pdf")); // Added check for text-like files and PDF
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const current = props.attachments ?? [];
    if (isImage) {
      const dataUrl = reader.result as string;
      const base64 = base64FromDataUrl(dataUrl);
      if (!base64) {
        return;
      }
      const next: ChatAttachment = {
        id: generateAttachmentId(),
        kind: "image",
        fileName: file.name || "image",
        dataUrl,
        base64,
        mimeType: file.type || "image/png",
        sizeBytes: file.size,
      };
      props.onAttachmentsChange?.([...current, next]);
      return;
    } else if (isTextFile) {
      // Handle text files
      const textContent = reader.result as string;
      const next: ChatAttachment = {
        id: generateAttachmentId(),
        kind: "file", // Still kind "file" but with textContent
        fileName: file.name || "text_file",
        textContent: textContent,
        mimeType: file.type || "text/plain",
        sizeBytes: file.size,
      };
      props.onAttachmentsChange?.([...current, next]);
      return;
    }

    // Default handling for other binary files (if any)
    const buffer = reader.result as ArrayBuffer;
    const next: ChatAttachment = {
      id: generateAttachmentId(),
      kind: "file",
      fileName: file.name || "file",
      base64: toBase64(buffer),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };
    props.onAttachmentsChange?.([...current, next]);
  });
  if (isImage) {
    reader.readAsDataURL(file);
  } else if (isTextFile) {
    // Read text files as text
    reader.readAsText(file);
  } else {
    // Read other files as ArrayBuffer
    reader.readAsArrayBuffer(file);
  }
}

function handlePaste(e: ClipboardEvent, props: ChatProps) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) {
    return;
  }

  const fileItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      fileItems.push(item);
    }
  }

  if (fileItems.length === 0) {
    return;
  }

  e.preventDefault();

  for (const item of fileItems) {
    const file = item.getAsFile();
    if (!file) {
      continue;
    }
    addAttachmentFromFile(file, props);
  }
}

function renderAttachmentPreview(props: ChatProps) {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return nothing;
  }

  return html`
    <div class="chat-attachments">
      ${attachments.map(
    (att) => html`
          <div class="chat-attachment">
            ${att.kind === "image" && att.dataUrl
        ? html`
                    <img
                      src=${att.dataUrl}
                      alt="Предпросмотр вложения"
                      class="chat-attachment__img"
                    />
                  `
        : html`
                    <div class="chat-attachment__file">
                      <div class="chat-attachment__file-name">${att.fileName}</div>
                      <div class="chat-attachment__file-meta">${att.mimeType}</div>
                    </div>
                  `
      }
            <button
              class="chat-attachment__remove"
              type="button"
              aria-label="Удалить вложение"
              @click=${() => {
        const next = (props.attachments ?? []).filter((a) => a.id !== att.id);
        props.onAttachmentsChange?.(next);
      }}
            >
              ${icons.x}
            </button>
          </div>
        `,
  )}
    </div>
  `;
}

/** Compact one-liner CTA banner above compose. Hidden when Telegram is already connected. */
function renderTelegramCtaBanner(props: ChatProps) {
  // Bug fix: hide if Telegram already connected to this agent
  if (!props.showFirstGreetingCta || props.telegramConnected) {
    return nothing;
  }
  return html`
    <div class="chat-cta-banner" role="note">
      <span class="chat-cta-banner__text">
        Подключи Telegram — получай уведомления прямо туда
      </span>
      <div class="chat-cta-banner__actions">
        <button class="btn btn--sm primary" type="button" @click=${props.onOpenTelegramSetup}>
          Подключить
        </button>
        <button class="btn btn--sm ghost" type="button" @click=${props.onDismissFirstGreetingCta}>
          Позже
        </button>
      </div>
    </div>
  `;
}

function renderChatModeSwitch(props: ChatProps) {
  const mode = props.chatMode ?? "regular";
  const busy = Boolean(props.ndaModeBusy);
  const onChange = props.onChatModeChange;
  if (!onChange) {
    return nothing;
  }

  return html`
    <div class="chat-mode-switch" role="group" aria-label="Режим чата">
      <button
        class="chat-mode-switch__btn ${mode === "regular" ? "is-active" : ""}"
        type="button"
        ?disabled=${busy}
        @click=${() => onChange("regular")}
      >
        Обычный
      </button>
      <button
        class="chat-mode-switch__btn ${mode === "nda" ? "is-active" : ""}"
        type="button"
        ?disabled=${busy}
        @click=${() => onChange("nda")}
      >
        NDA
      </button>
      ${busy ? html`<span class="chat-mode-switch__status">Переключаем режим…</span>` : nothing}
    </div>
  `;
}

function renderNdaTelegramCta(props: ChatProps) {
  if (!props.showNdaTelegramCta) {
    return nothing;
  }

  return html`
    <div class="chat-nda-telegram-cta" role="note" aria-live="polite">
      <div class="chat-nda-telegram-cta__title">NDA-режим</div>
      <div class="chat-nda-telegram-cta__text">
        Хотите получать NDA-уведомления в Telegram? Можно подключить отдельного NDA-бота.
      </div>
      <div class="chat-nda-telegram-cta__actions">
        <button class="btn primary" type="button" @click=${props.onOpenNdaTelegramSetup}>
          Подключить NDA-бота
        </button>
        <button class="btn ghost" type="button" @click=${props.onDismissNdaTelegramCta}>
          Позже
        </button>
      </div>
    </div>
  `;
}

export function renderChat(props: ChatProps) {
  const canCompose = props.connected;
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);
  const activeSession = props.sessions?.sessions?.find((row) => row.key === props.sessionKey);
  const reasoningLevel = activeSession?.reasoningLevel ?? "off";
  const showReasoning = props.showThinking && reasoningLevel !== "off";
  const assistantIdentity = {
    name: props.assistantName,
    avatar: props.assistantAvatar ?? props.assistantAvatarUrl ?? null,
  };

  const hasAttachments = (props.attachments?.length ?? 0) > 0;
  const composePlaceholder =
    props.composePlaceholder ??
    (props.connected
      ? hasAttachments
        ? "Добавь сообщение или приложи еще файлы..."
        : "Сообщение (Enter — отправить, Shift+Enter — перенос, вставка/драг&дроп файлов)"
      : "Подключись к gateway, чтобы начать чат...");

  const splitRatio = props.splitRatio ?? 0.6;
  const sidebarOpen = Boolean(props.sidebarOpen && props.onCloseSidebar);
  const showNdaTelegramCta = Boolean(props.showNdaTelegramCta);
  const showFirstGreetingCta = Boolean(props.showFirstGreetingCta) && !showNdaTelegramCta;
  let filePickerEl: HTMLInputElement | null = null;

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    for (const file of Array.from(files)) {
      addAttachmentFromFile(file, props);
    }
  };
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer) {
      return;
    }
    addFiles(event.dataTransfer.files);
  };
  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault();
    }
  };
  const thread = html`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${props.onChatScroll}
    >
      ${props.loading
      ? html`
              <div class="muted">Загружаю чат…</div>
            `
      : nothing
    }
      ${repeat(
      buildChatItems(props),
      (item) => item.key,
      (item) => {
        if (item.kind === "divider") {
          return html`
              <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${item.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `;
        }

        if (item.kind === "reading-indicator") {
          return renderReadingIndicatorGroup(assistantIdentity);
        }

        if (item.kind === "stream") {
          return renderStreamingGroup(
            item.text,
            item.startedAt,
            props.onOpenSidebar,
            assistantIdentity,
          );
        }

        if (item.kind === "group") {
          return renderMessageGroup(item, {
            onOpenSidebar: props.onOpenSidebar,
            showReasoning,
            assistantName: props.assistantName,
            assistantAvatar: assistantIdentity.avatar,
          });
        }

        return nothing;
      },
    )}
    </div>
  `;

  return html`
    <section class="card chat" @drop=${handleDrop} @dragover=${handleDragOver}>
      ${props.disabledReason ? html`<div class="callout">${props.disabledReason}</div>` : nothing}

      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
      ${props.ndaModeError ? html`<div class="callout danger">${props.ndaModeError}</div>` : nothing}

      ${props.focusMode
      ? html`
            <button
              class="chat-focus-exit"
              type="button"
              @click=${props.onToggleFocusMode}
              aria-label="Выйти из фокус-режима"
              title="Выйти из фокус-режима"
            >
              ${icons.x}
            </button>
          `
      : nothing
    }

      <div
        class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}"
      >
        <div
          class="chat-main"
          style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
        >
          ${thread}
        </div>

        ${sidebarOpen
      ? html`
              <resizable-divider
                .splitRatio=${splitRatio}
                @resize=${(e: CustomEvent) => props.onSplitRatioChange?.(e.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${renderMarkdownSidebar({
        content: props.sidebarContent ?? null,
        error: props.sidebarError ?? null,
        onClose: props.onCloseSidebar!,
        onViewRawText: () => {
          if (!props.sidebarContent || !props.onOpenSidebar) {
            return;
          }
          props.onOpenSidebar(`\`\`\`\n${props.sidebarContent}\n\`\`\``);
        },
      })}
              </div>
            `
      : nothing
    }
      </div>

      ${renderTelegramCtaBanner({ ...props, showFirstGreetingCta })}
      ${showNdaTelegramCta ? renderNdaTelegramCta(props) : nothing}

      ${props.queue.length
      ? html`
            <div class="chat-queue" role="status" aria-live="polite">
              <div class="chat-queue__title">Очередь (${props.queue.length})</div>
              <div class="chat-queue__list">
                ${props.queue.map(
        (item) => html`
                    <div class="chat-queue__item">
                      <div class="chat-queue__text">
                        ${item.text ||
          (item.attachments?.length ? `Вложение (${item.attachments.length})` : "")
          }
                      </div>
                      <button
                        class="btn chat-queue__remove"
                        type="button"
                        aria-label="Удалить сообщение из очереди"
                        @click=${() => props.onQueueRemove(item.id)}
                      >
                        ${icons.x}
                      </button>
                    </div>
                  `,
      )}
              </div>
            </div>
          `
      : nothing
    }

      ${renderCompactionIndicator(props.compactionStatus)}

      ${props.showNewMessages
      ? html`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${props.onScrollToBottom}
            >
              Новые сообщения ${icons.arrowDown}
            </button>
          `
      : nothing
    }

      <div class="chat-compose">
        ${renderAttachmentPreview(props)}
        <div class="chat-compose__wrapper">
          <input
            type="file"
            multiple
            style="display:none"
            ${ref((el) => (filePickerEl = el as HTMLInputElement))}
            @change=${(e: Event) => {
      const input = e.target as HTMLInputElement;
      addFiles(input.files);
      input.value = "";
    }}
          />

          <textarea
            ${ref((el) => el && adjustTextareaHeight(el as HTMLTextAreaElement))}
            class="chat-compose__input"
            .value=${props.draft}
            ?disabled=${!props.connected}
            @keydown=${(e: KeyboardEvent) => {
      if (e.key !== "Enter") {
        return;
      }
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      if (!props.connected) {
        return;
      }
      e.preventDefault();
      if (canCompose) {
        props.onSend();
      }
    }}
            @input=${(e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      adjustTextareaHeight(target);
      props.onDraftChange(target.value);
    }}
            @paste=${(e: ClipboardEvent) => handlePaste(e, props)}
            placeholder=${composePlaceholder}
          ></textarea>
          <button
            class="chat-compose__icon-btn"
            ?disabled=${!props.connected}
            title=${props.attachmentsLabel ?? "Прикрепить файл"}
            aria-label="Прикрепить файл"
            @click=${() => filePickerEl?.click()}
          >
            ${icons.paperclip}
          </button>
          <button
            class="chat-compose__icon-btn chat-compose__send-btn"
            ?disabled=${!props.connected}
            title=${isBusy ? "В очередь" : (props.sendLabel ?? "Отправить")}
            @click=${props.onSend}
          >
            ${icons.arrowDown ?? html`<span>→</span>`}
          </button>
        </div>
        <div class="chat-compose__toolbar">
          ${props.onChatModeChange
      ? html`
              <button
                class="chat-compose__tool-btn chat-compose__nda-pill ${(props.chatMode ?? "regular") === "nda" ? "is-active" : ""}"
                type="button"
                title="${(props.chatMode ?? "regular") === "nda" ? "NDA режим — нажми для обычного" : "Обычный режим — нажми для NDA"}"
                aria-label="Переключить NDA режим"
                ?disabled=${Boolean(props.ndaModeBusy)}
                @click=${() => props.onChatModeChange?.(
        (props.chatMode ?? "regular") === "nda" ? "regular" : "nda"
      )}
              >
                ${(props.chatMode ?? "regular") === "nda"
          ? html`🔒 NDA`
          : html`🔓 Обычный`}
              </button>
              `
      : nothing}
          ${canAbort
      ? html`
                <button
                  class="chat-compose__tool-btn"
                  ?disabled=${!props.connected}
                  @click=${props.onAbort}
                >
                  ${props.stopLabel ?? "Стоп"}
                </button>
              `
      : null
    }
          ${(props.allowNewSession ?? true)
      ? html`
                <button
                  class="chat-compose__tool-btn"
                  ?disabled=${!props.connected || props.sending}
                  @click=${props.onNewSession}
                >
                  ${props.newSessionLabel ?? "Новый чат"}
                </button>
              `
      : null
    }
          ${props.onResetSession
      ? html`
                <button
                  class="chat-compose__tool-btn"
                  ?disabled=${!props.connected || props.sending}
                  @click=${props.onResetSession}
                >
                  ${props.resetLabel ?? "Сбросить чат"}
                </button>
              `
      : null
    }
        </div>
      </div>
    </section>
  `;
}

const CHAT_HISTORY_RENDER_LIMIT = 200;

function groupMessages(items: ChatItem[]): Array<ChatItem | MessageGroup> {
  const result: Array<ChatItem | MessageGroup> = [];
  let currentGroup: MessageGroup | null = null;

  for (const item of items) {
    if (item.kind !== "message") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(item);
      continue;
    }

    const normalized = normalizeMessage(item.message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      if (currentGroup) {
        result.push(currentGroup);
      }
      currentGroup = {
        kind: "group",
        key: `group:${role}:${item.key}`,
        role,
        messages: [{ message: item.message, key: item.key }],
        timestamp,
        isStreaming: false,
      };
    } else {
      currentGroup.messages.push({ message: item.message, key: item.key });
    }
  }

  if (currentGroup) {
    result.push(currentGroup);
  }
  return result;
}

function buildChatItems(props: ChatProps): Array<ChatItem | MessageGroup> {
  const items: ChatItem[] = [];
  const history = Array.isArray(props.messages) ? props.messages : [];
  const tools = Array.isArray(props.toolMessages) ? props.toolMessages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);
  if (historyStart > 0) {
    items.push({
      kind: "message",
      key: "chat:history:notice",
      message: {
        role: "system",
        content: `Showing last ${CHAT_HISTORY_RENDER_LIMIT} messages (${historyStart} hidden).`,
        timestamp: Date.now(),
      },
    });
  }
  for (let i = historyStart; i < history.length; i++) {
    const msg = history[i];
    const normalized = normalizeMessage(msg);
    const raw = msg as Record<string, unknown>;
    const marker = raw.__openclaw as Record<string, unknown> | undefined;
    if (marker && marker.kind === "compaction") {
      items.push({
        kind: "divider",
        key:
          typeof marker.id === "string"
            ? `divider:compaction:${marker.id}`
            : `divider:compaction:${normalized.timestamp}:${i}`,
        label: "Compaction",
        timestamp: normalized.timestamp ?? Date.now(),
      });
      continue;
    }

    if (!props.showThinking && normalized.role.toLowerCase() === "toolresult") {
      continue;
    }

    items.push({
      kind: "message",
      key: messageKey(msg, i),
      message: msg,
    });
  }
  if (props.showThinking) {
    for (let i = 0; i < tools.length; i++) {
      items.push({
        kind: "message",
        key: messageKey(tools[i], i + history.length),
        message: tools[i],
      });
    }
  }

  if (props.stream !== null) {
    const key = `stream:${props.sessionKey}:${props.streamStartedAt ?? "live"}`;
    if (props.stream.trim().length > 0) {
      items.push({
        kind: "stream",
        key,
        text: props.stream,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    } else {
      items.push({ kind: "reading-indicator", key });
    }
  }

  return groupMessages(items);
}

function messageKey(message: unknown, index: number): string {
  const m = message as Record<string, unknown>;
  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  if (toolCallId) {
    return `tool:${toolCallId}`;
  }
  const id = typeof m.id === "string" ? m.id : "";
  if (id) {
    return `msg:${id}`;
  }
  const messageId = typeof m.messageId === "string" ? m.messageId : "";
  if (messageId) {
    return `msg:${messageId}`;
  }
  const timestamp = typeof m.timestamp === "number" ? m.timestamp : null;
  const role = typeof m.role === "string" ? m.role : "unknown";
  if (timestamp != null) {
    return `msg:${role}:${timestamp}:${index}`;
  }
  return `msg:${role}:${index}`;
}
