import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderAgents, type AgentsProps } from "./agents.ts";

function createProps(overrides: Partial<AgentsProps> = {}): AgentsProps {
  return {
    loading: false,
    error: null,
    agentsList: {
      defaultId: "main",
      mainKey: "agent:main:main",
      scope: "global",
      agents: [
        {
          id: "main",
          name: "main",
          identity: {
            name: "Yandex Agent",
          },
        },
      ],
    },
    selectedAgentId: "main",
    activePanel: "overview",
    configForm: {
      agents: {
        defaults: {
          workspace: "/Users/fedorovstas/.yagent/workspace/main",
          model: "openrouter/moonshotai/kimi-k2.5",
        },
        list: [
          {
            id: "main",
            workspace: "/Users/fedorovstas/.yagent/workspace/main",
            model: "openrouter/moonshotai/kimi-k2.5",
          },
        ],
      },
    },
    configLoading: false,
    configSaving: false,
    configDirty: false,
    channelsLoading: false,
    channelsError: null,
    channelsSnapshot: null,
    channelsLastSuccess: null,
    cronLoading: false,
    cronStatus: { enabled: true, jobs: 0, nextWakeAtMs: null },
    cronJobs: [],
    cronError: null,
    agentFilesLoading: false,
    agentFilesError: null,
    agentFilesList: null,
    agentFileActive: null,
    agentFileContents: {},
    agentFileDrafts: {},
    agentFileSaving: false,
    agentIdentityLoading: false,
    agentIdentityError: null,
    agentIdentityById: {},
    agentSkillsLoading: false,
    agentSkillsReport: null,
    agentSkillsError: null,
    agentSkillsAgentId: null,
    skillsFilter: "",
    onRefresh: () => undefined,
    onSelectAgent: () => undefined,
    onSelectPanel: () => undefined,
    onLoadFiles: () => undefined,
    onSelectFile: () => undefined,
    onFileDraftChange: () => undefined,
    onFileReset: () => undefined,
    onFileSave: () => undefined,
    onToolsProfileChange: () => undefined,
    onToolsOverridesChange: () => undefined,
    onConfigReload: () => undefined,
    onConfigSave: () => undefined,
    onModelChange: () => undefined,
    onModelFallbacksChange: () => undefined,
    onChannelsRefresh: () => undefined,
    onCronRefresh: () => undefined,
    onSkillsFilterChange: () => undefined,
    onSkillsRefresh: () => undefined,
    onAgentSkillToggle: () => undefined,
    onAgentSkillsClear: () => undefined,
    onAgentSkillsDisableAll: () => undefined,
    ...overrides,
  };
}

describe("agents view", () => {
  it("uses plain-language model labels", () => {
    const container = document.createElement("div");
    render(renderAgents(createProps()), container);

    expect(container.textContent).toContain("Основная модель ответа");
    expect(container.textContent).toContain("Запасные модели (если основная недоступна)");
    expect(container.textContent).toContain(
      "Основная — модель, которой агент отвечает в первую очередь.",
    );
  });
});
