import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { RuntimeEnv } from "../runtime.js";
import {
  readConfigFileSnapshot,
  resolveGatewayPort,
  type OpenClawConfig,
  writeConfigFile,
} from "../config/config.js";
import { resolveGatewayStateDir } from "../daemon/paths.js";
import { resolveGatewayService } from "../daemon/service.js";
import { copyToClipboard } from "../infra/clipboard.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import { inspectPortUsage } from "../infra/ports.js";
import { defaultRuntime } from "../runtime.js";
import { buildGatewayInstallPlan } from "./daemon-install-helpers.js";
import { DEFAULT_GATEWAY_DAEMON_RUNTIME } from "./daemon-runtime.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  resolveControlUiLinks,
  waitForGatewayReachable,
} from "./onboard-helpers.js";

export type EasyCommandOptions = {
  noOpen?: boolean;
  fullUi?: boolean;
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function shouldReinstallService(params: {
  desiredArgs: string[];
  desiredWorkingDirectory?: string;
  desiredEnvironment?: Record<string, string | undefined>;
  current: {
    programArguments: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
  } | null;
}): boolean {
  const current = params.current;
  if (!current) {
    return true;
  }
  if (!arraysEqual(current.programArguments, params.desiredArgs)) {
    return true;
  }
  const desiredWorkingDirectory = params.desiredWorkingDirectory?.trim() || "";
  const currentWorkingDirectory = current.workingDirectory?.trim() || "";
  if (desiredWorkingDirectory !== currentWorkingDirectory) {
    return true;
  }
  const desiredEnvironment = params.desiredEnvironment ?? {};
  const currentEnvironment = current.environment ?? {};
  for (const [key, desiredValueRaw] of Object.entries(desiredEnvironment)) {
    if (desiredValueRaw === undefined) {
      continue;
    }
    const desiredValue = desiredValueRaw.trim();
    const currentValue = currentEnvironment[key]?.trim() ?? "";
    if (desiredValue !== currentValue) {
      return true;
    }
  }
  return false;
}

function buildDashboardUrl(params: {
  baseUrl: string;
  simpleUi: boolean;
  forceOnboarding: boolean;
  token?: string;
}): string {
  const parsed = new URL(params.baseUrl);
  if (params.simpleUi) {
    parsed.searchParams.set("simple", "1");
  }
  if (params.forceOnboarding) {
    parsed.searchParams.set("onboarding", "1");
  }
  const withoutHash = parsed.toString();
  if (!params.token) {
    return withoutHash;
  }
  return `${withoutHash}#token=${encodeURIComponent(params.token)}`;
}

function fail(runtime: RuntimeEnv, message: string): never {
  runtime.error(message);
  runtime.exit(1);
}

function buildSpawnEnv(
  overrides: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
      continue;
    }
    env[key] = value;
  }
  return env;
}

async function startGatewayDetachedFallback(params: {
  runtime: RuntimeEnv;
  programArguments: string[];
  workingDirectory?: string;
  environment: Record<string, string | undefined>;
}) {
  if (params.programArguments.length === 0) {
    return { ok: false, detail: "missing gateway command" } as const;
  }
  const [command, ...args] = params.programArguments;
  const env = buildSpawnEnv(params.environment);
  const stateDir = resolveGatewayStateDir(env);
  const logDir = path.join(stateDir, "logs");
  const stdoutPath = path.join(logDir, "easy-fallback.log");
  const stderrPath = path.join(logDir, "easy-fallback.err.log");
  await fs.promises.mkdir(logDir, { recursive: true });

  let stdoutFd: number | undefined;
  let stderrFd: number | undefined;
  try {
    stdoutFd = fs.openSync(stdoutPath, "a");
    stderrFd = fs.openSync(stderrPath, "a");
    const child = spawn(command, args, {
      cwd: params.workingDirectory,
      env,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    child.unref();
    return { ok: true, pid: child.pid } as const;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    params.runtime.log(`Direct gateway fallback failed: ${detail}`);
    return { ok: false, detail } as const;
  } finally {
    if (stdoutFd !== undefined) {
      fs.closeSync(stdoutFd);
    }
    if (stderrFd !== undefined) {
      fs.closeSync(stderrFd);
    }
  }
}

export async function easyCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: EasyCommandOptions = {},
) {
  const simpleUi = !options.fullUi;
  const noOpen = Boolean(options.noOpen);
  const snapshot = await readConfigFileSnapshot();
  let config: OpenClawConfig = snapshot.valid ? snapshot.config : {};
  let configChanged = false;

  if (snapshot.exists && !snapshot.valid) {
    fail(runtime, "Config is invalid. Run `openclaw doctor --repair`, then retry `openclaw easy`.");
  }

  const authMode = config.gateway?.auth?.mode;
  const authPassword =
    typeof config.gateway?.auth?.password === "string" ? config.gateway.auth.password.trim() : "";
  const hasPasswordAuth = authMode === "password" && authPassword.length > 0;
  const existingToken =
    typeof config.gateway?.auth?.token === "string" ? config.gateway.auth.token.trim() : "";
  if (!hasPasswordAuth && !existingToken) {
    const generatedToken = randomBytes(24).toString("hex");
    runtime.log("No gateway token found. Generated a local token for easy startup.");
    config = {
      ...config,
      gateway: {
        ...config.gateway,
        auth: {
          ...config.gateway?.auth,
          mode: "token",
          token: generatedToken,
        },
      },
    };
    configChanged = true;
  }

  if (config.gateway?.mode !== "local") {
    runtime.log("Configuring gateway.mode=local for easy startup...");
    config = {
      ...config,
      gateway: {
        ...config.gateway,
        mode: "local",
      },
    };
    configChanged = true;
  }

  if (configChanged) {
    await writeConfigFile(config);
  }

  const assets = await ensureControlUiAssetsBuilt(runtime);
  if (!assets.ok) {
    fail(runtime, assets.message ?? "Control UI assets are missing.");
  }

  const port = resolveGatewayPort(config);
  const token = config.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const shouldForceOnboarding = simpleUi && !config.wizard?.lastRunAt;
  const password =
    config.gateway?.auth?.mode === "password"
      ? (config.gateway?.auth?.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD)
      : undefined;

  const service = resolveGatewayService();
  const loaded = await service.isLoaded({ env: process.env });
  const plan = await buildGatewayInstallPlan({
    env: process.env,
    port,
    token: token || undefined,
    runtime: DEFAULT_GATEWAY_DAEMON_RUNTIME,
    warn: (message) => runtime.log(message),
    config,
  });
  const programArguments = plan.programArguments.includes("--allow-unconfigured")
    ? plan.programArguments
    : [...plan.programArguments, "--allow-unconfigured"];

  let installRequired = !loaded;
  if (loaded) {
    const current = await service.readCommand(process.env);
    installRequired = shouldReinstallService({
      desiredArgs: programArguments,
      desiredWorkingDirectory: plan.workingDirectory,
      desiredEnvironment: plan.environment,
      current,
    });
  }

  if (installRequired) {
    runtime.log(
      loaded
        ? "Gateway service command is outdated. Reinstalling service for current workspace..."
        : "Gateway service is not installed. Installing now...",
    );
    await service.install({
      env: process.env,
      stdout: process.stdout,
      programArguments,
      workingDirectory: plan.workingDirectory,
      environment: plan.environment,
    });
  } else {
    runtime.log("Gateway service already installed.");
  }

  runtime.log("Starting Gateway service...");
  await service.restart({ env: process.env, stdout: process.stdout });

  const links = resolveControlUiLinks({
    port,
    bind: config.gateway?.bind ?? "loopback",
    customBindHost: config.gateway?.customBindHost,
    basePath: config.gateway?.controlUi?.basePath,
  });

  let probe = await waitForGatewayReachable({
    url: links.wsUrl,
    token: token || undefined,
    password,
    deadlineMs: 20_000,
  });
  if (!probe.ok) {
    runtime.log(`Gateway service is not ready yet${probe.detail ? ` (${probe.detail})` : ""}.`);
    let portBusy = false;
    try {
      const usage = await inspectPortUsage(port);
      portBusy = usage.status === "busy";
    } catch {
      // ignore probe helper errors and try detached fallback anyway
    }

    if (!portBusy) {
      runtime.log("Trying direct gateway start fallback...");
      const fallback = await startGatewayDetachedFallback({
        runtime,
        programArguments,
        workingDirectory: plan.workingDirectory,
        environment: plan.environment,
      });
      if (fallback.ok) {
        runtime.log(
          `Fallback gateway started${fallback.pid ? ` (pid ${fallback.pid})` : ""}. Waiting for readiness...`,
        );
        probe = await waitForGatewayReachable({
          url: links.wsUrl,
          token: token || undefined,
          password,
          deadlineMs: 20_000,
        });
      }
    }

    if (!probe.ok) {
      let listenerReady = portBusy;
      if (!listenerReady) {
        try {
          const usage = await inspectPortUsage(port);
          listenerReady = usage.status === "busy";
        } catch {
          // ignore; fallback to fail below
        }
      }
      if (listenerReady) {
        runtime.log(
          `Gateway listener is up, but health check still fails${probe.detail ? ` (${probe.detail})` : ""}. Opening UI anyway...`,
        );
      } else {
        fail(
          runtime,
          `Could not start local gateway automatically. Run \`openclaw gateway run --port ${port} --allow-unconfigured\`, then retry \`openclaw easy\`.`,
        );
      }
    }
  }

  const dashboardUrl = buildDashboardUrl({
    baseUrl: links.httpUrl,
    simpleUi,
    forceOnboarding: shouldForceOnboarding,
    token: token || undefined,
  });

  runtime.log(`OpenClaw URL: ${dashboardUrl}`);
  const copied = await copyToClipboard(dashboardUrl).catch(() => false);
  runtime.log(copied ? "Copied link to clipboard." : "Copy to clipboard unavailable.");

  if (noOpen) {
    runtime.log("Browser launch disabled (--no-open).");
    return;
  }

  let opened = false;
  const browserSupport = await detectBrowserOpenSupport();
  if (browserSupport.ok) {
    opened = await openUrl(dashboardUrl);
  }

  if (opened) {
    runtime.log("Opened in browser.");
    return;
  }

  const sshHint = formatControlUiSshHint({
    port,
    basePath: config.gateway?.controlUi?.basePath,
    token: token || undefined,
  });
  runtime.log(sshHint);
  if (simpleUi) {
    const simpleUrl = buildDashboardUrl({
      baseUrl: links.httpUrl,
      simpleUi: true,
      forceOnboarding: shouldForceOnboarding,
      token: token || undefined,
    });
    runtime.log(`Simple mode URL: ${simpleUrl}`);
  }
}
