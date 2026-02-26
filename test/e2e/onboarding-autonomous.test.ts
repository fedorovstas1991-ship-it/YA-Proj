import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import fs from "node:fs";

describe("Onboarding autonomous flow", () => {
  const projectRoot = path.join(__dirname, "../..");
  const stateDir = path.join(process.env.HOME!, ".YA-yagent-test");
  let gatewayProcess: ChildProcess | null = null;
  const testPort = 18790;  // Different port for testing
  const testToken = "test-token-123";

  beforeAll(async () => {
    // Clean test state
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Kill gateway
    if (gatewayProcess) {
      gatewayProcess.kill();
    }
    // Clean up
    if (fs.existsSync(stateDir)) {
      fs.rmSync(stateDir, { recursive: true });
    }
  });

  it("starts gateway with local code", async () => {
    // Set environment
    const env = {
      ...process.env,
      OPENCLAW_STATE_DIR: stateDir,
      OPENCLAW_BUNDLED_PLUGINS_DIR: path.join(projectRoot, "extensions"),
      NODE_OPTIONS: "--use-system-ca"
    };

    // Start gateway
    gatewayProcess = spawn(
      "node",
      [
        "scripts/run-node.mjs",
        "--profile", "yagent-test",
        "gateway",
        "--allow-unconfigured",
        "--force",
        "--port", testPort.toString(),
        "--bind", "loopback",
        "--token", testToken
      ],
      {
        cwd: projectRoot,
        env,
        stdio: "pipe"
      }
    );

    // Wait for gateway to start
    await setTimeout(5000);

    // Check if running
    expect(gatewayProcess.killed).toBe(false);
  }, 15000);

  it("gateway responds to HTTP requests", async () => {
    const response = await fetch(`http://127.0.0.1:${testPort}/`);
    expect(response.ok).toBe(true);
  }, 10000);

  it("creates config in isolated state directory", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    
    // Config should be created
    expect(fs.existsSync(configPath)).toBe(true);
    
    // Verify it's isolated
    expect(configPath).toContain(".YA-yagent-test");
    expect(configPath).not.toContain(".openclaw");
  });

  it("loads skills from bundled directory", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check skills config
    const skillsConfig = config.skills?.load?.extraDirs;
    expect(skillsConfig).toBeDefined();
    expect(Array.isArray(skillsConfig)).toBe(true);
    expect(skillsConfig[0]).toContain("/skills");
  });

  it("MCP one-search is available", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check MCP config
    const mcpServers = config.mcpServers;
    expect(mcpServers).toBeDefined();
    expect(mcpServers["one-search"]).toBeDefined();
    expect(mcpServers["one-search"].command).toBe("npx");
  });

  it("uses local extensions directory", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check plugins config
    const plugins = config.plugins;
    expect(plugins).toBeDefined();
    expect(plugins.slots).toBeDefined();
  });

  it("has correct agent configuration", () => {
    const configPath = path.join(stateDir, "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    // Check agents
    expect(config.agents).toBeDefined();
    expect(config.agents.list).toBeDefined();
    expect(Array.isArray(config.agents.list)).toBe(true);
    
    // Should have main and nda agents
    const agentIds = config.agents.list.map((a: any) => a.id);
    expect(agentIds).toContain("main");
    expect(agentIds).toContain("nda");
  });
});