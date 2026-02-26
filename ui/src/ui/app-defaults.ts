import type { LogLevel } from "./types.ts";
import type { CronFormState, CronWizardState } from "./ui-types.ts";

export const DEFAULT_LOG_LEVEL_FILTERS: Record<LogLevel, boolean> = {
  trace: true,
  debug: true,
  info: true,
  warn: true,
  error: true,
  fatal: true,
};

export const DEFAULT_CRON_FORM: CronFormState = {
  name: "",
  description: "",
  agentId: "",
  enabled: true,
  scheduleKind: "every",
  scheduleAt: "",
  everyAmount: "30",
  everyUnit: "minutes",
  cronExpr: "0 7 * * *",
  cronTz: "",
  sessionTarget: "isolated",
  wakeMode: "now",
  payloadKind: "agentTurn",
  payloadText: "",
  deliveryMode: "announce",
  deliveryChannel: "last",
  deliveryTo: "",
  timeoutSeconds: "",
};

export const DEFAULT_CRON_WIZARD: CronWizardState = {
  mode: "guided",
  step: 1,
  scenario: "reminder",
  schedulePreset: "in",
  inAmount: "30",
  inUnit: "minutes",
  dailyTime: "09:00",
  weekDays: [1, 2, 3, 4, 5],
  weekTime: "09:00",
  text: "",
  error: null,
};
