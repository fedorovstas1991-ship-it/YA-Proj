import type { CronSchedule } from "../types.ts";
import type { CronWizardState } from "../ui-types.ts";

export type CronWizardJob = {
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  sessionTarget: "main";
  wakeMode: "now";
  payload: {
    kind: "systemEvent";
    text: string;
  };
};

function localTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function parseTime(value: string, fallbackHour: number, fallbackMinute: number) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    Number.isFinite(hour) &&
    Number.isFinite(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  ) {
    return { hour, minute };
  }
  return { hour: fallbackHour, minute: fallbackMinute };
}

function normalizeWeekDays(days: number[]) {
  const normalized = days
    .map((day) => Number(day))
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= 7);
  if (normalized.length === 0) {
    return [1];
  }
  return [...new Set(normalized)].sort((a, b) => a - b);
}

function buildScheduleFromWizard(wizard: CronWizardState): CronSchedule {
  if (wizard.schedulePreset === "in") {
    const amount = Math.max(1, Number(wizard.inAmount) || 0);
    const deltaMs = amount * (wizard.inUnit === "hours" ? 3_600_000 : 60_000);
    return { kind: "at", at: new Date(Date.now() + deltaMs).toISOString() };
  }
  if (wizard.schedulePreset === "daily") {
    const { hour, minute } = parseTime(wizard.dailyTime, 9, 0);
    return {
      kind: "cron",
      expr: `${minute} ${hour} * * *`,
      tz: localTz(),
    };
  }
  const days = normalizeWeekDays(wizard.weekDays);
  const { hour, minute } = parseTime(wizard.weekTime, 9, 0);
  return {
    kind: "cron",
    expr: `${minute} ${hour} * * ${days.join(",")}`,
    tz: localTz(),
  };
}

function buildName(wizard: CronWizardState): string {
  if (wizard.schedulePreset === "in") {
    const suffix = wizard.scenario === "reminder" ? "Напоминание" : "Автозадача";
    return `${suffix} через ${wizard.inAmount || "1"} ${wizard.inUnit === "hours" ? "ч" : "мин"}`;
  }
  if (wizard.schedulePreset === "daily") {
    return wizard.scenario === "reminder"
      ? `Ежедневное напоминание ${wizard.dailyTime || "09:00"}`
      : `Ежедневная автозадача ${wizard.dailyTime || "09:00"}`;
  }
  return wizard.scenario === "reminder"
    ? `Напоминание по дням ${wizard.weekTime || "09:00"}`
    : `Автозадача по дням ${wizard.weekTime || "09:00"}`;
}

export function buildCronJobFromWizard(wizard: CronWizardState): CronWizardJob {
  const trimmedText = wizard.text.trim();
  const fallbackText =
    wizard.scenario === "reminder"
      ? "Напомни о задаче и коротко уточни статус."
      : "Запусти автоматическую проверку и пришли краткий итог.";
  return {
    name: buildName(wizard),
    enabled: true,
    schedule: buildScheduleFromWizard(wizard),
    sessionTarget: "main",
    wakeMode: "now",
    payload: {
      kind: "systemEvent",
      text: trimmedText || fallbackText,
    },
  };
}

function describeScheduleForHuman(wizard: CronWizardState): string {
  if (wizard.schedulePreset === "in") {
    return `через ${wizard.inAmount || "1"} ${wizard.inUnit === "hours" ? "час(а/ов)" : "минут"}`;
  }
  if (wizard.schedulePreset === "daily") {
    return `каждый день в ${wizard.dailyTime || "09:00"}`;
  }
  const days = normalizeWeekDays(wizard.weekDays).join(", ");
  return `по дням недели (${days}) в ${wizard.weekTime || "09:00"}`;
}

export function buildCronPromptTemplate(wizard: CronWizardState): string {
  const intent = wizard.scenario === "reminder" ? "напоминание" : "автоматическую задачу";
  const text =
    wizard.text.trim() ||
    (wizard.scenario === "reminder"
      ? "Напомни мне о ключевых задачах."
      : "Проверь состояние проекта и пришли короткий итог.");
  return [
    `Настрой задачу как ${intent}.`,
    `Расписание: ${describeScheduleForHuman(wizard)}.`,
    `Текст для агента: ${text}`,
    "Запускай в основной сессии.",
  ].join("\n");
}
