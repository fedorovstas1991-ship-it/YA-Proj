export type ChatAttachment = {
  id: string;
  kind: "image" | "file";
  fileName: string;
  base64: string;
  dataUrl?: string;
  mimeType: string;
  sizeBytes: number;
  textContent?: string;
};

export type ChatQueueItem = {
  id: string;
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  refreshSessions?: boolean;
};

export const CRON_CHANNEL_LAST = "last";

export type CronFormState = {
  name: string;
  description: string;
  agentId: string;
  enabled: boolean;
  scheduleKind: "at" | "every" | "cron";
  scheduleAt: string;
  everyAmount: string;
  everyUnit: "minutes" | "hours" | "days";
  cronExpr: string;
  cronTz: string;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payloadKind: "systemEvent" | "agentTurn";
  payloadText: string;
  deliveryMode: "none" | "announce";
  deliveryChannel: string;
  deliveryTo: string;
  timeoutSeconds: string;
};

export type CronWizardState = {
  mode: "guided" | "advanced";
  step: 1 | 2 | 3 | 4;
  scenario: "reminder" | "auto_event";
  schedulePreset: "in" | "daily" | "weekdays";
  inAmount: string;
  inUnit: "minutes" | "hours";
  dailyTime: string;
  weekDays: number[];
  weekTime: string;
  text: string;
  error: string | null;
};
