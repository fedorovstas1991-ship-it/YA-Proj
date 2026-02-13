import { randomUUID } from "node:crypto";
import type { GatewayRequestHandlers } from "./types.js";
import { defaultRuntime } from "../../runtime.js";
import { WizardSession } from "../../wizard/session.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateWizardCancelParams,
  validateWizardNextParams,
  validateWizardStartParams,
  validateWizardStatusParams,
} from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";

export const wizardHandlers: GatewayRequestHandlers = {
  "wizard.start": async ({ params, respond, context }) => {
    if (!validateWizardStartParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.start params: ${formatValidationErrors(validateWizardStartParams.errors)}`,
        ),
      );
      return;
    }
    const flowRaw =
      typeof (params as { flow?: unknown }).flow === "string"
        ? (params as { flow: string }).flow
        : "";
    const requestedFlow:
      | import("../../commands/onboard-types.js").OnboardOptions["flow"]
      | undefined = flowRaw.trim() === "eliza" ? "eliza" : undefined;

    // Control UI "simple" flows should always start fresh, even if a previous wizard
    // is still running (otherwise the UI gets stuck resuming old multi-step wizards).
    const running = context.findRunningWizard();
    if (requestedFlow && running) {
      context.purgeWizardSession(running);
    }
    const runningAfterPurge = requestedFlow ? context.findRunningWizard() : running;
    if (runningAfterPurge) {
      const existingSession = context.wizardSessions.get(runningAfterPurge);
      if (existingSession) {
        const result = await existingSession.next();
        if (result.done) {
          context.purgeWizardSession(runningAfterPurge);
        }
        respond(true, { sessionId: runningAfterPurge, ...result }, undefined);
        return;
      }
      context.purgeWizardSession(runningAfterPurge);
    }
    const sessionId = randomUUID();
    const opts: import("../../commands/onboard-types.js").OnboardOptions = {
      mode: params.mode,
      workspace: typeof params.workspace === "string" ? params.workspace : undefined,
      ...(requestedFlow ? { flow: requestedFlow } : {}),
    };
    const session = new WizardSession((prompter) =>
      context.wizardRunner(opts, defaultRuntime, prompter),
    );
    context.wizardSessions.set(sessionId, session);
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, { sessionId, ...result }, undefined);
  },
  "wizard.next": async ({ params, respond, context }) => {
    if (!validateWizardNextParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.next params: ${formatValidationErrors(validateWizardNextParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    const answer = params.answer as { stepId?: string; value?: unknown } | undefined;
    if (answer) {
      if (session.getStatus() !== "running") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not running"));
        return;
      }
      try {
        await session.answer(String(answer.stepId ?? ""), answer.value);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
        return;
      }
    }
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, result, undefined);
  },
  "wizard.cancel": ({ params, respond, context }) => {
    if (!validateWizardCancelParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.cancel params: ${formatValidationErrors(validateWizardCancelParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    session.cancel();
    const status = {
      status: session.getStatus(),
      error: session.getError(),
    };
    context.purgeWizardSession(sessionId);
    respond(true, status, undefined);
  },
  "wizard.status": ({ params, respond, context }) => {
    if (!validateWizardStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.status params: ${formatValidationErrors(validateWizardStatusParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    const status = {
      status: session.getStatus(),
      error: session.getError(),
    };
    if (status.status !== "running") {
      context.purgeWizardSession(sessionId);
    }
    respond(true, status, undefined);
  },
};
