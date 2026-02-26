import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CRON_FORM, DEFAULT_CRON_WIZARD } from "../app-defaults.ts";
import type { CronWizardState } from "../ui-types.ts";
import { addCronJobFromWizard, type CronState } from "./cron.ts";
import { buildCronJobFromWizard, buildCronPromptTemplate } from "./cron-wizard.ts";

function createWizard(overrides: Partial<CronWizardState> = {}): CronWizardState {
  return {
    ...DEFAULT_CRON_WIZARD,
    ...overrides,
  };
}

describe("cron wizard mapper", () => {
  it("maps daily 09:30 to cron schedule", () => {
    const payload = buildCronJobFromWizard(
      createWizard({
        schedulePreset: "daily",
        dailyTime: "09:30",
        text: "Проверить отчеты",
      }),
    );
    expect(payload.schedule).toEqual({
      kind: "cron",
      expr: "30 9 * * *",
      tz: expect.any(String),
    });
    expect(payload.payload).toEqual({
      kind: "systemEvent",
      text: "Проверить отчеты",
    });
  });

  it("maps in 15 minutes to one-shot schedule", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const payload = buildCronJobFromWizard(
      createWizard({
        schedulePreset: "in",
        inAmount: "15",
      }),
    );
    expect(payload.schedule).toEqual({
      kind: "at",
      at: new Date(1_700_000_000_000 + 15 * 60_000).toISOString(),
    });
    nowSpy.mockRestore();
  });

  it("maps weekdays + time to cron by day list", () => {
    const payload = buildCronJobFromWizard(
      createWizard({
        schedulePreset: "weekdays",
        weekDays: [1, 3, 5],
        weekTime: "18:45",
      }),
    );
    expect(payload.schedule).toEqual({
      kind: "cron",
      expr: "45 18 * * 1,3,5",
      tz: expect.any(String),
    });
  });

  it("builds a chat prompt template for scheduler setup", () => {
    const prompt = buildCronPromptTemplate(
      createWizard({
        scenario: "auto_event",
        schedulePreset: "daily",
        dailyTime: "10:00",
        text: "Собери дайджест по задачам и пришли кратко",
      }),
    );
    expect(prompt).toContain("Настрой задачу");
    expect(prompt).toContain("каждый день");
    expect(prompt).toContain("10:00");
  });
});

describe("addCronJobFromWizard", () => {
  it("submits wizard as cron.add payload", async () => {
    const request = vi.fn(async () => ({}));
    const state: CronState & { cronWizard: CronWizardState } = {
      client: {
        request,
      } as unknown as CronState["client"],
      connected: true,
      cronLoading: false,
      cronJobs: [],
      cronStatus: null,
      cronError: null,
      cronForm: { ...DEFAULT_CRON_FORM },
      cronWizard: createWizard({
        schedulePreset: "daily",
        dailyTime: "08:10",
        text: "Проверить входящие задачи",
      }),
      cronRunsJobId: null,
      cronRuns: [],
      cronBusy: false,
    };

    await addCronJobFromWizard(state);

    expect(request).toHaveBeenCalledWith(
      "cron.add",
      expect.objectContaining({
        sessionTarget: "main",
        wakeMode: "now",
      }),
    );
    expect(state.cronWizard.step).toBe(1);
  });
});
