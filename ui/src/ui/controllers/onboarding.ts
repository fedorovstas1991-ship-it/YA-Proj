import type { GatewayBrowserClient } from "../gateway.ts";
import type { ConfigSnapshot, WizardNextResult, WizardStartResult, WizardStep } from "../types.ts";

export type UiOnboardingState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  lastError: string | null;
  onboardingWizardSessionId: string | null;
  onboardingWizardStatus: "idle" | "running" | "done" | "cancelled" | "error";
  onboardingWizardStep: WizardStep | null;
  onboardingWizardCurrentStep: number;
  onboardingWizardTotalSteps: number;
  onboardingWizardError: string | null;
  onboardingWizardBusy: boolean;
  onboardingWizardMode: "local" | "remote";
  onboardingWizardFlow?: string;
  onboardingWizardWorkspace: string;
  onboardingWizardResetConfig: boolean;
  onboardingWizardTextAnswer: string;
  onboardingWizardMultiAnswers: number[];
};

function normalizeWizardStatus(result: {
  status?: string;
  done?: boolean;
}): UiOnboardingState["onboardingWizardStatus"] {
  const status = (result.status ?? "").trim().toLowerCase();
  if (status === "running" || status === "done" || status === "cancelled" || status === "error") {
    return status;
  }
  return result.done ? "done" : "running";
}

function optionValueKey(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") {
    return `${t}:${String(value)}`;
  }
  try {
    return `json:${JSON.stringify(value)}`;
  } catch {
    return `raw:${String(value)}`;
  }
}

function hydrateStepAnswers(state: UiOnboardingState, step: WizardStep | undefined) {
  if (!step) {
    state.onboardingWizardTextAnswer = "";
    state.onboardingWizardMultiAnswers = [];
    return;
  }
  if (step.type === "text" || step.type === "password") {
    const initial = step.initialValue;
    state.onboardingWizardTextAnswer =
      initial === null || initial === undefined ? "" : String(initial);
    state.onboardingWizardMultiAnswers = [];
    return;
  }
  if (step.type === "multiselect") {
    const options = Array.isArray(step.options) ? step.options : [];
    const initialValues = Array.isArray(step.initialValue) ? step.initialValue : [];
    const selected = new Set(initialValues.map(optionValueKey));
    state.onboardingWizardMultiAnswers = options
      .map((opt, index) => ({ index, key: optionValueKey(opt.value) }))
      .filter((entry) => selected.has(entry.key))
      .map((entry) => entry.index);
    state.onboardingWizardTextAnswer = "";
    return;
  }
  state.onboardingWizardTextAnswer = "";
  state.onboardingWizardMultiAnswers = [];
}

function applyWizardResult(
  state: UiOnboardingState,
  result: WizardStartResult | WizardNextResult,
  sessionId?: string | null,
) {
  const status = normalizeWizardStatus(result);
  state.onboardingWizardStatus = status;
  state.onboardingWizardStep = result.step ?? null;
  state.onboardingWizardError = result.error ?? null;
  hydrateStepAnswers(state, result.step);

  // Update progress tracking
  if (result.step) {
    state.onboardingWizardCurrentStep = (state.onboardingWizardCurrentStep ?? 0) + 1;
  }
  if (
    !state.onboardingWizardTotalSteps ||
    state.onboardingWizardTotalSteps < (state.onboardingWizardCurrentStep ?? 1)
  ) {
    state.onboardingWizardTotalSteps = Math.max(
      state.onboardingWizardTotalSteps ?? 1,
      state.onboardingWizardCurrentStep ?? 1,
    );
  }

  if (sessionId !== undefined) {
    state.onboardingWizardSessionId = sessionId;
  }
  if (status !== "running") {
    state.onboardingWizardSessionId = null;
  }
}

async function clearConfigForOnboarding(state: UiOnboardingState) {
  if (!state.client || !state.connected) {
    return;
  }
  const snapshot = await state.client.request<ConfigSnapshot>("config.get", {});
  const baseHash =
    typeof snapshot.hash === "string" && snapshot.hash.trim() ? snapshot.hash : undefined;
  await state.client.request("config.set", {
    raw: "{}",
    ...(baseHash ? { baseHash } : {}),
  });
}

export async function startOnboardingWizard(state: UiOnboardingState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.onboardingWizardBusy) {
    return;
  }
  state.onboardingWizardBusy = true;
  state.onboardingWizardError = null;
  state.lastError = null;
  state.onboardingWizardCurrentStep = 0;
  state.onboardingWizardTotalSteps = 0;
  try {
    if (state.onboardingWizardResetConfig) {
      await clearConfigForOnboarding(state);
    }
    const workspace = state.onboardingWizardWorkspace.trim();
    const result = await state.client.request<WizardStartResult>("wizard.start", {
      mode: state.onboardingWizardMode,
      ...(workspace ? { workspace } : {}),
    });
    applyWizardResult(state, result, result.sessionId);
  } catch (err) {
    state.onboardingWizardStatus = "error";
    state.onboardingWizardError = String(err);
    state.lastError = String(err);
  } finally {
    state.onboardingWizardBusy = false;
  }
}

export async function cancelOnboardingWizard(state: UiOnboardingState) {
  if (!state.client || !state.connected) {
    return;
  }
  const sessionId = state.onboardingWizardSessionId;
  if (!sessionId || state.onboardingWizardBusy) {
    return;
  }
  state.onboardingWizardBusy = true;
  state.onboardingWizardError = null;
  try {
    await state.client.request("wizard.cancel", { sessionId });
    state.onboardingWizardSessionId = null;
    state.onboardingWizardStatus = "cancelled";
    state.onboardingWizardStep = null;
    state.onboardingWizardTextAnswer = "";
    state.onboardingWizardMultiAnswers = [];
  } catch (err) {
    state.onboardingWizardError = String(err);
    state.lastError = String(err);
  } finally {
    state.onboardingWizardBusy = false;
  }
}

function buildAnswerForCurrentStep(state: UiOnboardingState): unknown {
  const step = state.onboardingWizardStep;
  if (!step) {
    return true;
  }
  if (step.type === "text" || step.type === "password") {
    return state.onboardingWizardTextAnswer;
  }
  if (step.type === "multiselect") {
    const options = Array.isArray(step.options) ? step.options : [];
    return state.onboardingWizardMultiAnswers
      .filter((index) => Number.isInteger(index) && index >= 0 && index < options.length)
      .map((index) => options[index]!.value);
  }
  if (step.type === "confirm") {
    const initial = typeof step.initialValue === "boolean" ? step.initialValue : true;
    return initial;
  }
  if (step.type === "action") {
    return true;
  }
  if (step.type === "select") {
    // select is handled by explicit answer, return default
    return null;
  }
  if (step.type === "note") {
    return true;
  }
  if (step.type === "progress") {
    return null;
  }
  return true;
}

function isWizardNotFoundError(err: unknown): boolean {
  return String(err).toLowerCase().includes("wizard not found");
}

export async function advanceOnboardingWizard(state: UiOnboardingState, explicitAnswer?: unknown) {
  if (!state.client || !state.connected) {
    return;
  }
  const sessionId = state.onboardingWizardSessionId;
  const step = state.onboardingWizardStep;
  if (!sessionId || !step || state.onboardingWizardBusy) {
    return;
  }
  state.onboardingWizardBusy = true;
  state.onboardingWizardError = null;
  state.lastError = null;
  try {
    const answerValue =
      explicitAnswer === undefined ? buildAnswerForCurrentStep(state) : explicitAnswer;
    const result = await state.client.request<WizardNextResult>("wizard.next", {
      sessionId,
      answer: {
        stepId: step.id,
        value: answerValue,
      },
    });
    applyWizardResult(state, result, sessionId);
  } catch (err) {
    if (isWizardNotFoundError(err)) {
      state.onboardingWizardSessionId = null;
      state.onboardingWizardStep = null;
      state.onboardingWizardStatus = "idle";
      state.onboardingWizardTextAnswer = "";
      state.onboardingWizardMultiAnswers = [];
      state.onboardingWizardError = "Onboarding session expired. Start onboarding again.";
      state.lastError = state.onboardingWizardError;
      return;
    }
    state.onboardingWizardError = String(err);
    state.onboardingWizardStatus = "error";
    state.lastError = String(err);
  } finally {
    state.onboardingWizardBusy = false;
  }
}

export function setOnboardingWizardDone(state: UiOnboardingState) {
  state.onboardingWizardSessionId = null;
  state.onboardingWizardStep = null;
  state.onboardingWizardStatus = "done";
  state.onboardingWizardError = null;
  state.onboardingWizardTextAnswer = "";
  state.onboardingWizardMultiAnswers = [];
}
