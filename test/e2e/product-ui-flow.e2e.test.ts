/**
 * UI E2E: drive the Product UI in a real browser (Playwright) like a user.
 *
 * Run:
 *   pnpm test:product:ui:e2e
 *
 * Headful (watch it):
 *   HEADFUL=1 pnpm test:product:ui:e2e
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sleep } from "../../src/utils.js";

const GATEWAY_START_TIMEOUT_MS = 180_000;
const E2E_TIMEOUT_MS = 180_000;

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

async function isVisible(locator: {
  isVisible: (opts?: { timeout?: number }) => Promise<boolean>;
}) {
  try {
    return await locator.isVisible({ timeout: 250 });
  } catch {
    return false;
  }
}

async function clickIfVisible(page: import("playwright-core").Page, role: "button", name: string) {
  const locator = page.getByRole(role, { name });
  if (await isVisible(locator)) {
    await locator.click();
    return true;
  }
  return false;
}

async function waitForAnyVisible(
  page: import("playwright-core").Page,
  selectors: string[],
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await isVisible(locator)) {
        return selector;
      }
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`timeout waiting for visible selector: ${selectors.join(", ")}`);
}

async function launchBrowser(opts: { headful: boolean; slowMoMs: number }) {
  const launchOptions = { headless: !opts.headful, slowMo: opts.slowMoMs };
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (executablePath && executablePath.trim()) {
    return chromium.launch({ ...launchOptions, executablePath });
  }

  try {
    return await chromium.launch({ ...launchOptions, channel: "chrome" });
  } catch (err) {
    try {
      return await chromium.launch(launchOptions);
    } catch (err2) {
      const error = new Error(
        "Failed to launch a browser for UI E2E. Install Google Chrome or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
      );
      (error as Error & { cause?: unknown }).cause = err2;
      throw error;
    }
  }
}

async function completeWizard(page: import("playwright-core").Page) {
  // Drive wizard steps until it disappears or times out.
  const wizard = page.locator(".wizard-card");
  await wizard.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  const deadline = Date.now() + 120_000;
  let sawWizard = false;

  while (Date.now() < deadline) {
    const visible = await wizard.isVisible().catch(() => false);
    if (!visible) {
      if (sawWizard) {
        return;
      }
      await page.waitForTimeout(200);
      continue;
    }
    sawWizard = true;

    // Surface errors early.
    const errCallout = page.locator(".callout.danger");
    if (await errCallout.isVisible().catch(() => false)) {
      const text = await errCallout.innerText().catch(() => "");
      if (text.toLowerCase().includes("error") || text.toLowerCase().includes("ошиб")) {
        throw new Error(`wizard error: ${text}`);
      }
    }

    // Progress spinner step: just wait for UI to advance.
    const spinner = page.locator(".wizard-progress-spinner");
    if (await spinner.isVisible().catch(() => false)) {
      await page.waitForTimeout(200);
      continue;
    }

    // Select step
    const selectOpt = page.locator(".wizard-option:enabled").first();
    if (await selectOpt.isVisible().catch(() => false)) {
      await selectOpt.click();
      continue;
    }

    // Multiselect step
    const multiItem = page.locator(".wizard-multiselect-item:enabled").first();
    if (await multiItem.isVisible().catch(() => false)) {
      await multiItem.click();
      const cont = page.locator("button.wizard-button.primary").filter({ hasText: "Продолжить" });
      if (await cont.isVisible().catch(() => false)) {
        if (await cont.isEnabled().catch(() => false)) {
          await cont.click();
        } else {
          await page.waitForTimeout(200);
        }
      }
      continue;
    }

    // Text/password step
    const input = page.locator("input.wizard-input").first();
    if (await input.isVisible().catch(() => false)) {
      let current = "";
      try {
        current = await input.inputValue({ timeout: 1000 });
      } catch {
        await page.waitForTimeout(200);
        continue;
      }
      if (!current.trim()) {
        try {
          await input.fill(`test-${randomUUID().slice(0, 8)}`, { timeout: 1000 });
        } catch {
          await page.waitForTimeout(200);
          continue;
        }
      }
      const cont = page.locator("button.wizard-button.primary").filter({ hasText: "Продолжить" });
      if (await cont.isVisible().catch(() => false)) {
        if (await cont.isEnabled().catch(() => false)) {
          await cont.click();
          continue;
        }
        await page.waitForTimeout(200);
        continue;
      }
    }

    // Confirm step
    const yes = page.locator("button.wizard-button.primary").filter({ hasText: "Да" });
    if (await yes.isVisible().catch(() => false)) {
      if (await yes.isEnabled().catch(() => false)) {
        await yes.click();
        continue;
      }
      await page.waitForTimeout(200);
      continue;
    }

    // Note/action step
    const ok = page.locator("button.wizard-button.primary").filter({ hasText: "OK" });
    if (await ok.isVisible().catch(() => false)) {
      if (await ok.isEnabled().catch(() => false)) {
        await ok.click();
        continue;
      }
      await page.waitForTimeout(200);
      continue;
    }

    // Fallback: click any enabled primary wizard button.
    const primary = page.locator("button.wizard-button.primary").first();
    if (await primary.isVisible().catch(() => false)) {
      if (await primary.isEnabled().catch(() => false)) {
        await primary.click();
        continue;
      }
    }

    await page.waitForTimeout(200);
  }

  throw new Error("wizard did not complete in time");
}

let port = 0;
let homeDir = "";
let gatewayToken = "";
let child: ChildProcessWithoutNullStreams | undefined;
let chunksOut: string[] = [];
let chunksErr: string[] = [];

describe(
  "product UI e2e flow (browser)",
  () => {
    beforeAll(async () => {
      port = await getFreePort();
      homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "ya-ui-e2e-"));
      gatewayToken = `ui-${randomUUID()}`;

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
            VITEST: "1",
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
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
        await sleep(500);
        if (child.exitCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }
      }
      await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
    });

    it(
      "drives the product UI with clicks (onboarding -> project -> new chat -> attachments -> telegram -> reset)",
      async () => {
        const headful = process.env.HEADFUL === "1";
        const slowMoMs = headful ? 40 : 0;
        const browser = await launchBrowser({ headful, slowMoMs });
        const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
        const page = await ctx.newPage();
        let keepArtifacts = false;

        // Reset-all uses window.confirm.
        page.on("dialog", (d) => d.accept().catch(() => {}));

        const artifactsDir = await fs.mkdtemp(path.join(os.tmpdir(), "ya-ui-e2e-artifacts-"));
        const imgPath = path.join(artifactsDir, "img.png");
        const txtPath = path.join(artifactsDir, "note.txt");
        const pngBase64 =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";
        await fs.writeFile(imgPath, Buffer.from(pngBase64, "base64"));
        // Ensure Playwright treats the attachment as image/png (so UI preview shows thumbnail).
        const imgFile = {
          name: "img.png",
          mimeType: "image/png",
          buffer: Buffer.from(pngBase64, "base64"),
        };
        const txtFile = {
          name: "note.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hello from ui e2e\n", "utf8"),
        };
        await fs.writeFile(txtPath, "hello from ui e2e\n", "utf8");

        const baseUrl = `http://127.0.0.1:${port}/`;
        const url = `${baseUrl}?token=${encodeURIComponent(gatewayToken)}&gatewayUrl=${encodeURIComponent(`ws://127.0.0.1:${port}`)}`;

        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });

          // If gatewayUrl was passed, UI will ask for confirmation before reconnecting.
          await clickIfVisible(page, "button", "Confirm");

          // If we're still on the connect screen, connect manually.
          try {
            await page.getByRole("button", { name: "Подключить" }).click({ timeout: 1000 });
          } catch {
            // likely already connected
          }

          // Wait for the onboarding card in product UI.
          await page.getByText("Настройка").waitFor({ timeout: 60_000 });

          // Start the wizard and drive it to completion.
          const startBtn = page.getByRole("button", { name: "Старт" });
          await startBtn.click();
          await completeWizard(page);

          // Chat should be enabled after onboarding.
          const newChatBtn = page.getByRole("button", { name: "Новый чат" }).first();
          for (let i = 0; i < 80; i++) {
            const enabled = await newChatBtn.isEnabled().catch(() => false);
            if (enabled) {
              break;
            }
            await page.waitForTimeout(250);
          }
          expect(await newChatBtn.isEnabled()).toBe(true);

          // Create project
          const projectName = `e2e-${randomUUID().slice(0, 6)}`;
          await page.getByRole("button", { name: "Create new project" }).click();
          await page.getByLabel("Название проекта").fill(projectName);
          await page.getByLabel("Описание проекта").fill("UI e2e");
          await page.getByRole("button", { name: "Создать новый проект" }).click();
          await page
            .getByRole("button", { name: `${projectName} проект` })
            .waitFor({ timeout: 30_000 });
          const backdrop = page.locator(".product-modal-backdrop");
          if (await backdrop.isVisible().catch(() => false)) {
            await backdrop.click({ position: { x: 10, y: 10 } }).catch(() => {});
          }
          await page.getByRole("button", { name: `${projectName} проект` }).click();

          // New chat triggers greet.
          await newChatBtn.click();
          await page
            .locator(".product-item__title", { hasText: "Чат" })
            .first()
            .waitFor({ timeout: 10_000 });
          await page.waitForTimeout(200);

          // Attachments: add image (preview) + text (chip).
          const fileInput = page.locator('input[type="file"][multiple]').first();
          await fileInput.setInputFiles([imgFile]);
          await page.locator(".chat-attachment__img").first().waitFor({ timeout: 10_000 });
          await fileInput.setInputFiles([txtFile]);
          await page
            .locator(".chat-attachment__file-name")
            .filter({ hasText: "note.txt" })
            .first()
            .waitFor({ timeout: 10_000 });

          await page.getByRole("button", { name: "Отправить" }).click();

          // User message should contain the attachment label.
          await page.getByText("Вложение: note.txt", { exact: false }).waitFor({ timeout: 30_000 });

          // Telegram connect (allowlist)
          await page.getByRole("button", { name: "Панель Telegram" }).click();
          await page.getByLabel("Bot token").fill("123:fake-token");
          await page.getByLabel("Твой user id").fill("123456789");
          await page.getByRole("button", { name: "Подключить Telegram" }).click();
          await page.getByText("Telegram подключен", { exact: false }).waitFor({ timeout: 30_000 });

          // Reset all via dev drawer.
          await page.getByRole("button", { name: "Инструменты разработчика" }).click();
          await page.getByRole("button", { name: "Сбросить все" }).click();

          // After reset we should see onboarding again.
          await page.getByText("Настройка").waitFor({ timeout: 60_000 });
        } catch (err) {
          keepArtifacts = true;
          const shot = path.join(artifactsDir, "failure.png");
          try {
            await page.screenshot({ path: shot, fullPage: true });
          } catch {
            // ignore
          }
          // Make the artifact location visible in test output.
          // eslint-disable-next-line no-console
          console.error(`UI E2E failure screenshot: ${shot}`);
          throw err;
        } finally {
          await browser.close();
          if (!keepArtifacts) {
            await fs.rm(artifactsDir, { recursive: true, force: true }).catch(() => {});
          }
        }
      },
      E2E_TIMEOUT_MS,
    );
  },
  E2E_TIMEOUT_MS,
);
