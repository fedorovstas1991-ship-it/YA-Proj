import { beforeEach, describe, expect, it, vi } from "vitest";
import { easyCommand } from "./easy.js";

const mocks = vi.hoisted(() => ({
  readConfigFileSnapshot: vi.fn(),
  resolveGatewayPort: vi.fn(),
  writeConfigFile: vi.fn(),
  buildGatewayInstallPlan: vi.fn(),
  resolveGatewayService: vi.fn(),
  copyToClipboard: vi.fn(),
  ensureControlUiAssetsBuilt: vi.fn(),
  detectBrowserOpenSupport: vi.fn(),
  formatControlUiSshHint: vi.fn(),
  openUrl: vi.fn(),
  resolveControlUiLinks: vi.fn(),
  waitForGatewayReachable: vi.fn(),
}));

vi.mock("../config/config.js", () => ({
  readConfigFileSnapshot: mocks.readConfigFileSnapshot,
  resolveGatewayPort: mocks.resolveGatewayPort,
  writeConfigFile: mocks.writeConfigFile,
}));

vi.mock("./daemon-install-helpers.js", () => ({
  buildGatewayInstallPlan: mocks.buildGatewayInstallPlan,
}));

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: mocks.resolveGatewayService,
}));

vi.mock("../infra/clipboard.js", () => ({
  copyToClipboard: mocks.copyToClipboard,
}));

vi.mock("../infra/control-ui-assets.js", () => ({
  ensureControlUiAssetsBuilt: mocks.ensureControlUiAssetsBuilt,
}));

vi.mock("./onboard-helpers.js", () => ({
  detectBrowserOpenSupport: mocks.detectBrowserOpenSupport,
  formatControlUiSshHint: mocks.formatControlUiSshHint,
  openUrl: mocks.openUrl,
  resolveControlUiLinks: mocks.resolveControlUiLinks,
  waitForGatewayReachable: mocks.waitForGatewayReachable,
}));

type RuntimeDouble = {
  log: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  exit: ReturnType<typeof vi.fn>;
};

function createRuntimeDouble(): RuntimeDouble {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(() => {
      throw new Error("exit");
    }),
  };
}

function mockValidSnapshot(token = "abc123") {
  mocks.readConfigFileSnapshot.mockResolvedValue({
    path: "/tmp/openclaw.json",
    exists: true,
    raw: "{}",
    parsed: {},
    valid: true,
    config: {
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: {
          mode: "token",
          token,
        },
      },
    },
    issues: [],
    legacyIssues: [],
  });
}

describe("easyCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolveGatewayPort.mockReturnValue(18789);
    mocks.writeConfigFile.mockResolvedValue(undefined);
    mocks.buildGatewayInstallPlan.mockResolvedValue({
      programArguments: ["node", "dist/index.js", "gateway", "--port", "18789"],
      workingDirectory: undefined,
      environment: {},
    });
    mocks.ensureControlUiAssetsBuilt.mockResolvedValue({ ok: true, built: false });
    mocks.resolveControlUiLinks.mockReturnValue({
      httpUrl: "http://127.0.0.1:18789/",
      wsUrl: "ws://127.0.0.1:18789",
    });
    mocks.waitForGatewayReachable.mockResolvedValue({ ok: true });
    mocks.copyToClipboard.mockResolvedValue(true);
    mocks.detectBrowserOpenSupport.mockResolvedValue({ ok: true });
    mocks.openUrl.mockResolvedValue(true);
    mocks.formatControlUiSshHint.mockReturnValue("ssh hint");
  });

  it("installs service when missing and opens simple dashboard", async () => {
    const runtime = createRuntimeDouble();
    mockValidSnapshot("abc123");
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(false),
      readCommand: vi.fn().mockResolvedValue(null),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);
    mocks.buildGatewayInstallPlan.mockResolvedValue({
      programArguments: ["node", "dist/index.js", "gateway", "start"],
      workingDirectory: "/tmp/openclaw",
      environment: { OPENCLAW_GATEWAY_TOKEN: "abc123" },
    });

    await easyCommand(runtime);

    expect(service.install).toHaveBeenCalledOnce();
    expect(service.restart).toHaveBeenCalledOnce();
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/?simple=1&onboarding=1#token=abc123",
    );
    expect(runtime.log).toHaveBeenCalledWith("Opened in browser.");
  });

  it("keeps full dashboard URL when --full-ui and --no-open are set", async () => {
    const runtime = createRuntimeDouble();
    mockValidSnapshot("abc123");
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(true),
      readCommand: vi.fn().mockResolvedValue({
        programArguments: [
          "node",
          "dist/index.js",
          "gateway",
          "--port",
          "18789",
          "--allow-unconfigured",
        ],
      }),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);

    await easyCommand(runtime, { fullUi: true, noOpen: true });

    expect(service.install).not.toHaveBeenCalled();
    expect(service.restart).toHaveBeenCalledOnce();
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
    expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://127.0.0.1:18789/#token=abc123");
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("forces local mode when config is remote", async () => {
    const runtime = createRuntimeDouble();
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/openclaw.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {
        gateway: {
          mode: "remote",
          bind: "loopback",
          auth: { mode: "token", token: "abc" },
        },
      },
      issues: [],
      legacyIssues: [],
    });
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(true),
      readCommand: vi.fn().mockResolvedValue({
        programArguments: [
          "node",
          "dist/index.js",
          "gateway",
          "--port",
          "18789",
          "--allow-unconfigured",
        ],
      }),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);

    await easyCommand(runtime, { noOpen: true });

    expect(mocks.writeConfigFile).toHaveBeenCalledOnce();
    expect(mocks.writeConfigFile).toHaveBeenCalledWith({
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "token", token: "abc" },
      },
    });
    expect(service.restart).toHaveBeenCalledOnce();
  });

  it("reinstalls service when command does not match desired program args", async () => {
    const runtime = createRuntimeDouble();
    mockValidSnapshot("abc123");
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(true),
      readCommand: vi.fn().mockResolvedValue({
        programArguments: ["node", "/old/openclaw/dist/index.js", "gateway", "--port", "18789"],
      }),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);
    mocks.buildGatewayInstallPlan.mockResolvedValue({
      programArguments: ["node", "/new/openclaw/dist/index.js", "gateway", "--port", "18789"],
      workingDirectory: "/new/openclaw",
      environment: {},
    });

    await easyCommand(runtime, { noOpen: true });

    expect(service.install).toHaveBeenCalledOnce();
    expect(service.restart).toHaveBeenCalledOnce();
  });

  it("does not force onboarding param after wizard has completed once", async () => {
    const runtime = createRuntimeDouble();
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/openclaw.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {
        gateway: {
          mode: "local",
          bind: "loopback",
          auth: { mode: "token", token: "abc123" },
        },
        wizard: {
          lastRunAt: "2026-02-12T12:00:00.000Z",
        },
      },
      issues: [],
      legacyIssues: [],
    });
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(true),
      readCommand: vi.fn().mockResolvedValue({
        programArguments: [
          "node",
          "dist/index.js",
          "gateway",
          "--port",
          "18789",
          "--allow-unconfigured",
        ],
      }),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);

    await easyCommand(runtime);

    expect(mocks.openUrl).toHaveBeenCalledWith("http://127.0.0.1:18789/?simple=1#token=abc123");
  });

  it("fails fast on invalid config", async () => {
    const runtime = createRuntimeDouble();
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/openclaw.json",
      exists: true,
      raw: "{",
      parsed: {},
      valid: false,
      config: {},
      issues: [{ path: "gateway.auth", message: "invalid" }],
      legacyIssues: [],
    });

    await expect(easyCommand(runtime)).rejects.toThrow("exit");
    expect(runtime.error).toHaveBeenCalledWith(
      "Config is invalid. Run `openclaw doctor --repair`, then retry `openclaw easy`.",
    );
  });

  it("generates and persists a token when config has no gateway auth token", async () => {
    const runtime = createRuntimeDouble();
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/openclaw.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: {
        gateway: {
          mode: "local",
          bind: "loopback",
        },
      },
      issues: [],
      legacyIssues: [],
    });
    const service = {
      loadedText: "loaded",
      notLoadedText: "not loaded",
      isLoaded: vi.fn().mockResolvedValue(true),
      readCommand: vi.fn().mockResolvedValue({
        programArguments: [
          "node",
          "dist/index.js",
          "gateway",
          "--port",
          "18789",
          "--allow-unconfigured",
        ],
      }),
      install: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
    };
    mocks.resolveGatewayService.mockReturnValue(service);

    await easyCommand(runtime);

    expect(mocks.writeConfigFile).toHaveBeenCalledOnce();
    expect(mocks.writeConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: expect.objectContaining({
          mode: "local",
          auth: expect.objectContaining({
            mode: "token",
            token: expect.stringMatching(/^[a-f0-9]{48}$/),
          }),
        }),
      }),
    );
    expect(runtime.log).toHaveBeenCalledWith(
      "No gateway token found. Generated a local token for easy startup.",
    );
  });
});
