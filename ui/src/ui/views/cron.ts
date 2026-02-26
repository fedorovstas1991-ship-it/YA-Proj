import { html, nothing } from "lit";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type { CronFormState, CronWizardState } from "../ui-types.ts";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { pathForTab } from "../navigation.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";

export type CronProps = {
  basePath: string;
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  wizard: CronWizardState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onWizardChange: (patch: Partial<CronWizardState>) => void;
  onWizardModeChange: (mode: CronWizardState["mode"]) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onAddWizard: () => void;
  onDraftInChatTemplate: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
};

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") {
    return "last";
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}

export function renderCron(props: CronProps) {
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const selectedRunTitle = selectedJob?.name ?? props.runsJobId ?? "(выберите задачу)";
  const orderedRuns = props.runs.toSorted((a, b) => b.ts - a.ts);
  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Планировщик</div>
        <div class="card-sub">Статус cron-планировщика gateway.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Включен</div>
            <div class="stat-value">
              ${props.status ? (props.status.enabled ? "Да" : "Нет") : "н/д"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Задач</div>
            <div class="stat-value">${props.status?.jobs ?? "н/д"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Следующий запуск</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Обновляем…" : "Обновить"}
          </button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Новая задача</div>
        <div class="card-sub">Создать плановый запуск или пробуждение агента.</div>
        <div class="cron-mode-switch" style="margin-top: 16px;">
          <button
            class="btn ${props.wizard.mode === "guided" ? "primary" : ""}"
            ?disabled=${props.busy}
            @click=${() => props.onWizardModeChange("guided")}
          >
            Пошагово
          </button>
          <button
            class="btn ${props.wizard.mode === "advanced" ? "primary" : ""}"
            ?disabled=${props.busy}
            @click=${() => props.onWizardModeChange("advanced")}
          >
            Расширенный режим
          </button>
        </div>

        ${props.wizard.mode === "guided"
          ? renderGuidedWizard(props)
          : renderAdvancedCronForm(props, channelOptions)}

        <div class="cron-chat-footnote" style="margin-top: 12px;">
          <span>Любое напоминание или автоматическое событие можно через чат.</span>
          <button class="btn" ?disabled=${props.busy} @click=${props.onDraftInChatTemplate}>
            Сформулировать в чате
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Задачи</div>
      <div class="card-sub">Все задачи, сохраненные в gateway.</div>
      ${
        props.jobs.length === 0
          ? html`
              <div class="muted" style="margin-top: 12px">Пока нет задач.</div>
            `
          : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props))}
            </div>
          `
      }
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">История запусков</div>
      <div class="card-sub">Последние запуски для ${selectedRunTitle}.</div>
      ${
        props.runsJobId == null
          ? html`
              <div class="muted" style="margin-top: 12px">Выберите задачу, чтобы посмотреть историю запусков.</div>
            `
          : orderedRuns.length === 0
            ? html`
                <div class="muted" style="margin-top: 12px">Пока нет запусков.</div>
              `
            : html`
              <div class="list" style="margin-top: 12px;">
                ${orderedRuns.map((entry) => renderRun(entry, props.basePath))}
              </div>
            `
      }
    </section>
  `;
}

function renderGuidedWizard(props: CronProps) {
  const wizard = props.wizard;
  return html`
    <div class="cron-wizard" style="margin-top: 14px;">
      <div class="card-sub" style="margin-top: 0;">Пошаговая настройка cron-задачи без терминов.</div>
      <div class="progress-bar" style="margin-top: 10px;">
        <div class="progress-bar-fill" style="width: ${(wizard.step / 4) * 100}%;"></div>
      </div>
      <div class="muted" style="margin-top: 8px;">Шаг ${wizard.step} из 4</div>

      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>Тип задачи</span>
          <select
            .value=${wizard.scenario}
            @change=${(e: Event) =>
              props.onWizardChange({
                scenario: (e.target as HTMLSelectElement).value as CronWizardState["scenario"],
              })}
          >
            <option value="reminder">Напоминание</option>
            <option value="auto_event">Автоматическое событие</option>
          </select>
        </label>

        <label class="field">
          <span>Когда запускать</span>
          <select
            .value=${wizard.schedulePreset}
            @change=${(e: Event) =>
              props.onWizardChange({
                schedulePreset: (e.target as HTMLSelectElement)
                  .value as CronWizardState["schedulePreset"],
              })}
          >
            <option value="in">Через N минут/часов</option>
            <option value="daily">Каждый день</option>
            <option value="weekdays">По дням недели</option>
          </select>
        </label>
      </div>

      ${
        wizard.schedulePreset === "in"
          ? html`
              <div class="form-grid" style="margin-top: 12px;">
                <label class="field">
                  <span>Через</span>
                  <input
                    .value=${wizard.inAmount}
                    @input=${(e: Event) =>
                      props.onWizardChange({ inAmount: (e.target as HTMLInputElement).value })}
                  />
                </label>
                <label class="field">
                  <span>Единица</span>
                  <select
                    .value=${wizard.inUnit}
                    @change=${(e: Event) =>
                      props.onWizardChange({
                        inUnit: (e.target as HTMLSelectElement).value as CronWizardState["inUnit"],
                      })}
                  >
                    <option value="minutes">Минуты</option>
                    <option value="hours">Часы</option>
                  </select>
                </label>
              </div>
            `
          : wizard.schedulePreset === "daily"
            ? html`
                <label class="field" style="margin-top: 12px;">
                  <span>Время</span>
                  <input
                    type="time"
                    .value=${wizard.dailyTime}
                    @input=${(e: Event) =>
                      props.onWizardChange({ dailyTime: (e.target as HTMLInputElement).value })}
                  />
                </label>
              `
            : html`
                <div class="form-grid" style="margin-top: 12px;">
                  <label class="field">
                    <span>Дни недели</span>
                    <div class="row" style="flex-wrap: wrap;">
                      ${[
                        [1, "Пн"],
                        [2, "Вт"],
                        [3, "Ср"],
                        [4, "Чт"],
                        [5, "Пт"],
                        [6, "Сб"],
                        [7, "Вс"],
                      ].map(
                        ([day, label]) => html`
                          <button
                            class="btn ${wizard.weekDays.includes(day as number) ? "primary" : ""}"
                            type="button"
                            @click=${() => {
                              const next = wizard.weekDays.includes(day as number)
                                ? wizard.weekDays.filter((value) => value !== day)
                                : [...wizard.weekDays, day as number];
                              props.onWizardChange({ weekDays: next });
                            }}
                          >
                            ${label}
                          </button>
                        `,
                      )}
                    </div>
                  </label>
                  <label class="field">
                    <span>Время</span>
                    <input
                      type="time"
                      .value=${wizard.weekTime}
                      @input=${(e: Event) =>
                        props.onWizardChange({ weekTime: (e.target as HTMLInputElement).value })}
                    />
                  </label>
                </div>
              `
      }

      <label class="field" style="margin-top: 12px;">
        <span>Что должен сделать агент</span>
        <textarea
          rows="4"
          .value=${wizard.text}
          placeholder="Например: напомни про ежедневный отчет в 18:00"
          @input=${(e: Event) => props.onWizardChange({ text: (e.target as HTMLTextAreaElement).value })}
        ></textarea>
      </label>

      ${wizard.error ? html`<div class="callout danger" style="margin-top: 10px;">${wizard.error}</div>` : nothing}

      <div class="row" style="margin-top: 14px;">
        <button class="btn primary" ?disabled=${props.busy} @click=${props.onAddWizard}>
          ${props.busy ? "Сохраняем…" : "Создать задачу"}
        </button>
      </div>
    </div>
  `;
}

function renderAdvancedCronForm(props: CronProps, channelOptions: string[]) {
  return html`
    <div class="form-grid" style="margin-top: 16px;">
      <label class="field">
        <span>Название</span>
        <input
          .value=${props.form.name}
          @input=${(e: Event) =>
            props.onFormChange({ name: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>Описание</span>
        <input
          .value=${props.form.description}
          @input=${(e: Event) =>
            props.onFormChange({ description: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>ID агента</span>
        <input
          .value=${props.form.agentId}
          @input=${(e: Event) =>
            props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
          placeholder="default"
        />
      </label>
      <label class="field checkbox">
        <span>Включена</span>
        <input
          type="checkbox"
          .checked=${props.form.enabled}
          @change=${(e: Event) =>
            props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
        />
      </label>
      <label class="field">
        <span>Расписание</span>
        <select
          .value=${props.form.scheduleKind}
          @change=${(e: Event) =>
            props.onFormChange({
              scheduleKind: (e.target as HTMLSelectElement).value as CronFormState["scheduleKind"],
            })}
        >
          <option value="every">Каждые</option>
          <option value="at">Время</option>
          <option value="cron">Cron</option>
        </select>
      </label>
    </div>
    ${renderScheduleFields(props)}
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>Сессия</span>
        <select
          .value=${props.form.sessionTarget}
          @change=${(e: Event) =>
            props.onFormChange({
              sessionTarget: (e.target as HTMLSelectElement).value as CronFormState["sessionTarget"],
            })}
        >
          <option value="main">Основная</option>
          <option value="isolated">Изолированная</option>
        </select>
      </label>
      <label class="field">
        <span>Режим запуска</span>
        <select
          .value=${props.form.wakeMode}
          @change=${(e: Event) =>
            props.onFormChange({
              wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
            })}
        >
          <option value="now">Сейчас</option>
          <option value="next-heartbeat">Следующий heartbeat</option>
        </select>
      </label>
      <label class="field">
        <span>Полезная нагрузка</span>
        <select
          .value=${props.form.payloadKind}
          @change=${(e: Event) =>
            props.onFormChange({
              payloadKind: (e.target as HTMLSelectElement).value as CronFormState["payloadKind"],
            })}
        >
          <option value="systemEvent">Системное событие</option>
          <option value="agentTurn">Сообщение агенту</option>
        </select>
      </label>
    </div>
    <label class="field" style="margin-top: 12px;">
      <span>${props.form.payloadKind === "systemEvent" ? "Системный текст" : "Сообщение агенту"}</span>
      <textarea
        .value=${props.form.payloadText}
        @input=${(e: Event) =>
          props.onFormChange({
            payloadText: (e.target as HTMLTextAreaElement).value,
          })}
        rows="4"
      ></textarea>
    </label>
    ${
      props.form.payloadKind === "agentTurn"
        ? html`
            <div class="form-grid" style="margin-top: 12px;">
              <label class="field">
                <span>Доставка</span>
                <select
                  .value=${props.form.deliveryMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      deliveryMode: (e.target as HTMLSelectElement).value as CronFormState["deliveryMode"],
                    })}
                >
                  <option value="announce">Отправить краткий итог (по умолчанию)</option>
                  <option value="none">Без доставки (внутренне)</option>
                </select>
              </label>
              <label class="field">
                <span>Таймаут (сек)</span>
                <input
                  .value=${props.form.timeoutSeconds}
                  @input=${(e: Event) =>
                    props.onFormChange({
                      timeoutSeconds: (e.target as HTMLInputElement).value,
                    })}
                />
              </label>
              ${
                props.form.deliveryMode === "announce"
                  ? html`
                      <label class="field">
                        <span>Канал</span>
                        <select
                          .value=${props.form.deliveryChannel || "last"}
                          @change=${(e: Event) =>
                            props.onFormChange({
                              deliveryChannel: (e.target as HTMLSelectElement).value,
                            })}
                        >
                          ${channelOptions.map(
                            (channel) =>
                              html`<option value=${channel}>
                                ${resolveChannelLabel(props, channel)}
                              </option>`,
                          )}
                        </select>
                      </label>
                      <label class="field">
                        <span>Кому</span>
                        <input
                          .value=${props.form.deliveryTo}
                          @input=${(e: Event) =>
                            props.onFormChange({
                              deliveryTo: (e.target as HTMLInputElement).value,
                            })}
                          placeholder="+1555… или id чата"
                        />
                      </label>
                    `
                  : nothing
              }
            </div>
          `
        : nothing
    }
    <div class="row" style="margin-top: 14px;">
      <button class="btn primary" ?disabled=${props.busy} @click=${props.onAdd}>
        ${props.busy ? "Сохраняем…" : "Добавить задачу"}
      </button>
    </div>
  `;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field" style="margin-top: 12px;">
        <span>Запустить в</span>
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>Каждые</span>
          <input
            .value=${form.everyAmount}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
          />
        </label>
        <label class="field">
          <span>Единица</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">Минуты</option>
            <option value="hours">Часы</option>
            <option value="days">Дни</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>Выражение</span>
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>Часовой пояс (опционально)</span>
        <input
          .value=${form.cronTz}
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
        />
      </label>
    </div>
  `;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable cron-job${isSelected ? " list-item-selected" : ""}`;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        ${renderJobPayload(job)}
        ${job.agentId ? html`<div class="muted cron-job-agent">Агент: ${job.agentId}</div>` : nothing}
      </div>
      <div class="list-meta">
        ${renderJobState(job)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? "включена" : "выключена"}
          </span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? "Выключить" : "Включить"}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            Запустить
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            История
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">Система</span>
      <span class="muted cron-job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  const delivery = job.delivery;
  const deliveryTarget =
    delivery?.channel || delivery?.to
      ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
      : "";

  return html`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">Промпт</span>
      <span class="muted cron-job-detail-value">${job.payload.message}</span>
    </div>
    ${
      delivery
        ? html`<div class="cron-job-detail">
            <span class="cron-job-detail-label">Доставка</span>
            <span class="muted cron-job-detail-value">${delivery.mode}${deliveryTarget}</span>
          </div>`
        : nothing
    }
  `;
}

function formatStateRelative(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "н/д";
  }
  return formatRelativeTimestamp(ms);
}

function renderJobState(job: CronJob) {
  const status = job.state?.lastStatus ?? "n/a";
  const statusClass =
    status === "ok"
      ? "cron-job-status-ok"
      : status === "error"
        ? "cron-job-status-error"
        : status === "skipped"
          ? "cron-job-status-skipped"
          : "cron-job-status-na";
  const nextRunAtMs = job.state?.nextRunAtMs;
  const lastRunAtMs = job.state?.lastRunAtMs;

  return html`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Статус</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${status}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">След.</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Послед.</span>
        <span class="cron-job-state-value" title=${formatMs(lastRunAtMs)}>
          ${formatStateRelative(lastRunAtMs)}
        </span>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry, basePath: string) {
  const chatUrl =
    typeof entry.sessionKey === "string" && entry.sessionKey.trim().length > 0
      ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(entry.sessionKey)}`
      : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ""}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${
          chatUrl
            ? html`<div><a class="session-link" href=${chatUrl}>Открыть чат запуска</a></div>`
            : nothing
        }
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
