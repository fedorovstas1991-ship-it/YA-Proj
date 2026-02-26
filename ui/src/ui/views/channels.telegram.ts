import { html, nothing } from "lit";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types.ts";
import type { ChannelsProps, TelegramConnectFlowState } from "./channels.types.ts";
import { formatRelativeTimestamp } from "../format.ts";

const FLOW_STEPS: Array<{ key: TelegramConnectFlowState; label: string }> = [
  { key: "validating", label: "Проверка данных" },
  { key: "patching", label: "Сохранение конфига" },
  { key: "waiting_restart", label: "Перезапуск gateway" },
  { key: "waiting_reconnect", label: "Восстановление связи" },
  { key: "probing", label: "Проверка Telegram" },
];

function flowProgressPercent(flow: TelegramConnectFlowState): number {
  switch (flow) {
    case "validating":
      return 15;
    case "patching":
      return 35;
    case "waiting_restart":
      return 55;
    case "waiting_reconnect":
      return 72;
    case "probing":
      return 88;
    case "success":
      return 100;
    case "error":
      return 100;
    case "idle":
    default:
      return 0;
  }
}

function isFlowBusy(flow: TelegramConnectFlowState): boolean {
  return (
    flow === "validating" ||
    flow === "patching" ||
    flow === "waiting_restart" ||
    flow === "waiting_reconnect" ||
    flow === "probing"
  );
}

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = telegramAccounts.length > 1;
  const flow = props.telegramConnectFlow;
  const busy = isFlowBusy(flow) || props.configSaving;
  const allowFromValue =
    ((props.configForm?.channels as Record<string, unknown> | undefined)?.telegram as
      | { allowFrom?: unknown }
      | undefined)?.allowFrom;
  const allowFromSingle = Array.isArray(allowFromValue)
    ? String(allowFromValue[0] ?? "").trim()
    : typeof allowFromValue === "string"
      ? allowFromValue.trim()
      : "";
  const flowStepIndex =
    flow === "success"
      ? FLOW_STEPS.length
      : flow === "error"
        ? FLOW_STEPS.length - 1
        : FLOW_STEPS.findIndex((step) => step.key === flow);

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Запущен</span>
            <span>${account.running ? "Да" : "Нет"}</span>
          </div>
          <div>
            <span class="label">Настроен</span>
            <span>${account.configured ? "Да" : "Нет"}</span>
          </div>
          <div>
            <span class="label">Последнее входящее</span>
            <span>${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : "н/д"}</span>
          </div>
          ${account.lastError
        ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
        : nothing
      }
        </div>
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">Telegram</div>
      <div class="card-sub">Настройка и статус телеграм-бота.</div>
      ${accountCountLabel}

      <div class="form-grid" style="margin-top: 16px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
        <label class="field">
          <span>Токен бота (Bot Token)</span>
          <div class="row">
            <input
              type="password"
              style="flex: 1;"
              .value=${(props.configForm?.channels as any)?.telegram?.botToken || ""}
              placeholder="1234567890:ABCDEF..."
              ?disabled=${busy}
              @input=${(e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      props.onConfigPatch(["channels", "telegram", "botToken"], val);
    }}
            />
            <button
              class="btn primary"
              ?disabled=${busy}
              @click=${() => props.onTelegramConnect()}
            >
              ${busy ? "Подключение..." : "Подключить"}
            </button>
          </div>
          <div class="muted" style="margin-top: 4px;">
            Получить токен: <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> → <span class="mono">/newbot</span>
          </div>
        </label>

        <label class="field" style="margin-top: 12px;">
          <span>Ваш Telegram логин или ID</span>
          <input
            .value=${allowFromSingle}
            placeholder="@my_username или 123456789"
            ?disabled=${busy}
            @input=${(e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      const trimmed = val.trim();
      props.onConfigPatch(["channels", "telegram", "allowFrom"], trimmed ? [trimmed] : []);
    }}
          />
          <div class="muted" style="margin-top: 4px;">
            Только ваш аккаунт — бот будет отвечать только вам.
          </div>
        </label>
      </div>

      <details class="telegram-guide" style="margin-top: 12px;">
        <summary class="telegram-guide__title">
          📖 Пошаговая инструкция подключения
        </summary>
        <div class="telegram-guide__content">
          <ol style="margin: 8px 0; padding-left: 24px; line-height: 1.8;">
            <li>
              Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> в Telegram
            </li>
            <li>
              Отправьте команду <code>/newbot</code> и следуйте инструкциям — придумайте имя и username бота
            </li>
            <li>
              Скопируйте полученный <strong>токен</strong> (формат: <code>1234567890:ABCDefGHI...</code>) и вставьте в поле выше
            </li>
            <li>
              В поле «Ваш Telegram логин или ID» укажите свой username (например, <code>@my_name</code>) или числовой ID — это защитит бота от посторонних
            </li>
            <li>
              Нажмите <strong>«Подключить»</strong> — система проверит токен, перезапустит gateway и убедится, что бот отвечает
            </li>
          </ol>
          <div class="muted" style="margin-top: 8px;">
            <strong>Безопасность:</strong> токен хранится локально в <code>~/.YA-yagent/openclaw.json</code> и не передаётся третьим лицам. Поле «логин» ограничивает доступ только вашим аккаунтом.
          </div>
        </div>
      </details>

      ${flow !== "idle"
      ? html`
            <div class="telegram-connect-flow ${flow === "error" ? "telegram-connect-flow--error" : ""}" style="margin-top: 12px;">
              <div class="telegram-connect-flow__title">
                ${flow === "success"
          ? "Подключение завершено"
          : flow === "error"
            ? "Подключение не завершено"
            : "Подключаем Telegram..."}
              </div>
              <div class="telegram-connect-flow__status">${props.telegramConnectStatus ?? ""}</div>
              <div class="progress-bar ${isFlowBusy(flow) ? "striped" : ""}">
                <div
                  class="progress-bar-fill"
                  style="width: ${flowProgressPercent(flow)}%;"
                ></div>
              </div>
              <div class="telegram-connect-flow__steps">
                ${FLOW_STEPS.map(
              (step, index) => html`
                    <span
                      class="
                        telegram-connect-flow__step
                        ${index < flowStepIndex ? "is-done" : ""}
                        ${index === flowStepIndex ? "is-active" : ""}
                      "
                    >
                      ${step.label}
                    </span>
                  `,
            )}
              </div>
              ${flow === "error" && props.telegramConnectDetails
          ? html`
                    <details class="telegram-connect-flow__details">
                      <summary>Технические детали</summary>
                      <pre>${props.telegramConnectDetails}</pre>
                    </details>
                  `
          : nothing
        }
            </div>
          `
      : nothing
    }

      ${hasMultipleAccounts
      ? html`
            <div class="account-card-list">
              ${telegramAccounts.map((account) => renderAccountCard(account))}
            </div>
          `
      : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Настроен</span>
                <span>${telegram?.configured ? "Да" : "Нет"}</span>
              </div>
              <div>
                <span class="label">Запущен</span>
                <span>${telegram?.running ? "Да" : "Нет"}</span>
              </div>
              <div>
                <span class="label">Режим</span>
                <span>${telegram?.mode ?? "н/д"}</span>
              </div>
              <div>
                <span class="label">Последний запуск</span>
                <span>${telegram?.lastStartAt ? formatRelativeTimestamp(telegram.lastStartAt) : "н/д"}</span>
              </div>
              <div>
                <span class="label">Последняя проверка</span>
                <span>${telegram?.lastProbeAt ? formatRelativeTimestamp(telegram.lastProbeAt) : "н/д"}</span>
              </div>
            </div>
          `
    }

      ${telegram?.lastError
      ? html`<div class="callout danger" style="margin-top: 12px;">
            ${telegram.lastError}
          </div>`
      : nothing
    }

      ${telegram?.probe
      ? html`<div class="callout" style="margin-top: 12px;">
            Проверка ${telegram.probe.ok ? "успешно" : "ошибка"} ·
            ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
          </div>`
      : nothing
    }

      <div class="row" style="margin-top: 12px; gap: 8px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          Проверить статус
        </button>
        <button class="btn" @click=${() => props.onConfigReload()}>
          Обновить из конфига
        </button>
      </div>
    </div>
  `;
}
