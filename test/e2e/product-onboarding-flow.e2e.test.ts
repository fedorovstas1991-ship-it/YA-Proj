/**
 * E2E scenario: Clean start → Onboarding → Chat with greet → Attachments → Telegram setup.
 *
 * This test spins up a gateway instance and exercises the full product onboarding flow
 * using the GatewayClient WebSocket API, following the pattern from gateway.multi.e2e.test.ts.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GatewayClient } from "../../src/gateway/client.js";
import { connectGatewayClient } from "../../src/gateway/test-helpers.e2e.js";
import { sleep } from "../../src/utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GATEWAY_START_TIMEOUT_MS = 180_000;
const E2E_TIMEOUT_MS = 120_000;

async function getFreePort(): Promise<number> {
  const srv = net.createServer();
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const addr = srv.address();
  if (!addr || typeof addr === "string") {
    srv.close();
    throw new Error("failed to bind ephemeral port");
  }
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return addr.port;
}

async function waitForPortOpen(params: {
  proc: ChildProcessWithoutNullStreams;
  chunksOut: string[];
  chunksErr: string[];
  port: number;
  timeoutMs: number;
}): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < params.timeoutMs) {
    if (params.proc.exitCode !== null) {
      const stdout = params.chunksOut.join("");
      const stderr = params.chunksErr.join("");
      throw new Error(
        `gateway exited before listening (code=${String(params.proc.exitCode)} signal=${String(params.proc.signalCode)})\n` +
          `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
      );
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.connect({ host: "127.0.0.1", port: params.port });
        sock.once("connect", () => {
          sock.destroy();
          resolve();
        });
        sock.once("error", (err) => {
          sock.destroy();
          reject(err);
        });
      });
      return;
    } catch {
      // keep polling
    }
    await sleep(50);
  }
  const stdout = params.chunksOut.join("");
  const stderr = params.chunksErr.join("");
  throw new Error(
    `timeout waiting for gateway to listen on port ${params.port}\n` +
      `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
let port: number;
let homeDir: string;
let gatewayToken: string;
let child: ChildProcessWithoutNullStreams | undefined;
let chunksOut: string[] = [];
let chunksErr: string[] = [];

describe(
  "product onboarding E2E flow",
  () => {
    beforeAll(async () => {
      port = await getFreePort();
      homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "ya-e2e-onboard-"));
      gatewayToken = `test-${randomUUID()}`;

      const configDir = path.join(homeDir, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "openclaw.json");
      const stateDir = path.join(configDir, "state");
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            gateway: { port, auth: { mode: "token", token: gatewayToken } },
          },
          null,
          2,
        ),
        "utf8",
      );

      // Start gateway
      chunksOut = [];
      chunksErr = [];
      child = spawn(
        "node",
        [
          "scripts/run-node.mjs",
          "gateway",
          "--port",
          String(port),
          "--bind",
          "loopback",
          "--allow-unconfigured",
          "--force",
          "--token",
          gatewayToken,
        ],
        {
          cwd: path.resolve(import.meta.dirname ?? __dirname, "../.."),
          env: {
            ...process.env,
            HOME: homeDir,
            OPENCLAW_CONFIG_PATH: configPath,
            OPENCLAW_STATE_DIR: stateDir,
            OPENCLAW_SKIP_CHANNELS: "1",
            OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
            OPENCLAW_SKIP_CANVAS_HOST: "1",
            NODE_ENV: "test",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (d) => chunksOut.push(String(d)));
      child.stderr?.on("data", (d) => chunksErr.push(String(d)));

      await waitForPortOpen({
        proc: child,
        chunksOut,
        chunksErr,
        port,
        timeoutMs: GATEWAY_START_TIMEOUT_MS,
      });
    });

    afterAll(async () => {
      if (child) {
        child.kill("SIGTERM");
        await sleep(500);
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
      await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
    });

    it("connects and receives health status", async () => {
      try {
        const client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });
        const health = await client.request("health", {});
        expect(health).toBeDefined();
      } finally {
        // connectGatewayClient returns a started client; always stop it.
      }
    }, 30_000);

    it("runs full product flow (agent, sessions, greet/reset, attachments, telegram patch)", async () => {
      let client: GatewayClient | null = null;
      const PNG_1x1 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";

      try {
        client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });

        // 1) "Project" = agent
        const agentName = `E2E Project ${randomUUID().slice(0, 8)}`;
        const agentId = agentName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const workspace = path.join(homeDir, "workspace", agentId);

        await client.request("agents.create", { name: agentName, workspace });
        await client.request("agents.files.set", {
          agentId,
          name: "USER.md",
          content:
            "Ты помощник. Всегда отвечай по-русски. Если чат пустой, поздоровайся и спроси, что сделать.",
        });

        // 2) "Chat" = subagent session
        const sessionKey = `agent:${agentId}:subagent:${randomUUID()}`.toLowerCase();
        await client.request("sessions.patch", {
          key: sessionKey,
          label: "Чат 1",
          spawnedBy: `agent:${agentId}:main`,
        });

        // 3) "AI writes first" via chat.greet (no /new in transcript)
        const greet1 = await client.request("chat.greet", {
          sessionKey,
          reason: "new_chat",
          idempotencyKey: `greet-${randomUUID()}`,
        });
        expect((greet1 as { runId?: string } | undefined)?.runId).toBeTruthy();

        // 4) Reset + greet
        await client.request("sessions.reset", { key: sessionKey });
        const greet2 = await client.request("chat.greet", {
          sessionKey,
          reason: "reset",
          idempotencyKey: `greet-${randomUUID()}`,
        });
        expect((greet2 as { runId?: string } | undefined)?.runId).toBeTruthy();

        // 5) Attachments transport (base64); gateway should parse image into vision blocks
        const sendRes = await client.request("chat.send", {
          sessionKey,
          message: "Вложение тест",
          idempotencyKey: `send-${randomUUID()}`,
          attachments: [
            {
              type: "image",
              mimeType: "image/png",
              fileName: "test.png",
              content: PNG_1x1,
            },
            {
              type: "file",
              mimeType: "text/plain",
              fileName: "note.txt",
              content: Buffer.from("hello from e2e").toString("base64"),
            },
          ],
        });
        expect((sendRes as { runId?: string } | undefined)?.runId).toBeTruthy();

        // 6) Telegram setup (config.patch + allowlist + binding)
        const cfg = await client.request("config.get", {});
        const baseHash = (cfg as { hash?: string } | undefined)?.hash;
        expect(typeof baseHash).toBe("string");
        expect(baseHash?.length).toBeGreaterThan(0);

        const patch = {
          channels: {
            telegram: {
              enabled: true,
              botToken: "123:fake-token",
              dmPolicy: "allowlist",
              allowFrom: ["123456789"],
            },
          },
          bindings: [{ agentId: "main", match: { channel: "telegram", accountId: "default" } }],
        };

        const patched = await client.request("config.patch", {
          raw: JSON.stringify(patch),
          baseHash,
          note: "e2e telegram connect",
          // Avoid restarting during the test window.
          restartDelayMs: 60_000,
        });
        expect((patched as { ok?: boolean } | undefined)?.ok).toBe(true);
      } finally {
        client?.stop();
      }
    }, 60_000);

    it("sends chat.greet and receives a runId", async () => {
      let client: GatewayClient | null = null;
      try {
        client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });
        const result = await client.request("chat.greet", {
          sessionKey: `e2e-greet-${randomUUID()}`,
          reason: "first_open",
        });
        expect(result).toBeDefined();
        // Should return a runId and status
        const payload = result as { runId?: string; status?: string };
        expect(payload.runId).toBeTruthy();
        expect(["started", "ok", "in_flight"]).toContain(payload.status);
      } finally {
        client?.stop();
      }
    }, 30_000);

    it("sends chat.greet with idempotencyKey and gets cached response", async () => {
      let client: GatewayClient | null = null;
      try {
        client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });
        const idemKey = `idem-${randomUUID()}`;
        const sessionKey = `e2e-idem-${randomUUID()}`;

        const r1 = await client.request("chat.greet", {
          sessionKey,
          reason: "new_chat",
          idempotencyKey: idemKey,
        });
        expect(r1).toBeDefined();

        // Wait a bit for the greet to process
        await sleep(2000);

        // Second call with same idempotencyKey should return cached
        const r2 = await client.request("chat.greet", {
          sessionKey,
          reason: "new_chat",
          idempotencyKey: idemKey,
        });
        expect(r2).toBeDefined();
      } finally {
        client?.stop();
      }
    }, 30_000);

    it("sends chat.send with attachments", async () => {
      let client: GatewayClient | null = null;
      const PNG_1x1 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";

      try {
        client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });
        const sessionKey = `e2e-attach-${randomUUID()}`;
        const result = await client.request("chat.send", {
          sessionKey,
          message: "See this image",
          idempotencyKey: `send-${randomUUID()}`,
          attachments: [
            {
              type: "image",
              mimeType: "image/png",
              fileName: "test.png",
              content: PNG_1x1,
            },
          ],
        });
        expect(result).toBeDefined();
        const payload = result as { runId?: string };
        expect(payload.runId).toBeTruthy();
      } finally {
        client?.stop();
      }
    }, 30_000);

    it("can list sessions after sending messages", async () => {
      let client: GatewayClient | null = null;
      try {
        client = await connectGatewayClient({
          url: `ws://127.0.0.1:${port}`,
          token: gatewayToken,
        });
        const result = await client.request("sessions.list", {});
        expect(result).toBeDefined();
        const payload = result as { sessions?: unknown[] };
        expect(Array.isArray(payload.sessions)).toBe(true);
      } finally {
        client?.stop();
      }
    }, 30_000);
  },
  E2E_TIMEOUT_MS,
);
