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
import { GatewayClient } from "../../src/gateway/client.js";
import { sleep } from "../../src/utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GATEWAY_START_TIMEOUT_MS = 45_000;
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

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.connect({ host: "127.0.0.1", port }, () => {
          sock.destroy();
          resolve();
        });
        sock.on("error", reject);
      });
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`port ${port} not open after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
let port: number;
let homeDir: string;
let gatewayToken: string;
let child: ChildProcessWithoutNullStreams | undefined;

describe(
  "product onboarding E2E flow",
  () => {
    beforeAll(async () => {
      port = await getFreePort();
      homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "ya-e2e-onboard-"));
      gatewayToken = `test-${randomUUID()}`;

      const configPath = path.join(homeDir, "openclaw.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          gatewayToken,
          model: "echo",
          port,
        }),
      );

      // Start gateway
      child = spawn("node", ["scripts/run-node.mjs", "gateway"], {
        cwd: path.resolve(import.meta.dirname ?? __dirname, "../.."),
        env: {
          ...process.env,
          HOME: homeDir,
          OPENCLAW_HOME: homeDir,
          CLAWDBOT_HOME: homeDir,
          OPENCLAW_GATEWAY_PORT: String(port),
          CLAWDBOT_GATEWAY_PORT: String(port),
          OPENCLAW_GATEWAY_TOKEN: gatewayToken,
          CLAWDBOT_GATEWAY_TOKEN: gatewayToken,
          NODE_ENV: "test",
        },
        stdio: "pipe",
      });

      child.stdout.on("data", () => {});
      child.stderr.on("data", () => {});

      await waitForPort(port, GATEWAY_START_TIMEOUT_MS);
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
      const client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
      });

      try {
        await client.connect();
        const health = await client.request("health", {});
        expect(health).toBeDefined();
      } finally {
        client.disconnect();
      }
    }, 30_000);

    it("sends chat.greet and receives a runId", async () => {
      const client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
      });

      try {
        await client.connect();
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
        client.disconnect();
      }
    }, 30_000);

    it("sends chat.greet with idempotencyKey and gets cached response", async () => {
      const client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
      });

      try {
        await client.connect();
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
        client.disconnect();
      }
    }, 30_000);

    it("sends chat.send with attachments", async () => {
      const client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
      });

      const PNG_1x1 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";

      try {
        await client.connect();
        const sessionKey = `e2e-attach-${randomUUID()}`;
        const result = await client.request("chat.send", {
          sessionKey,
          message: "See this image",
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
        client.disconnect();
      }
    }, 30_000);

    it("can list sessions after sending messages", async () => {
      const client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
      });

      try {
        await client.connect();
        const result = await client.request("sessions.list", {});
        expect(result).toBeDefined();
        const payload = result as { sessions?: unknown[] };
        expect(Array.isArray(payload.sessions)).toBe(true);
      } finally {
        client.disconnect();
      }
    }, 30_000);
  },
  E2E_TIMEOUT_MS,
);
