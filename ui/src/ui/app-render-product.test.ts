/**
 * UI render tests for the Product UI layout (app-render-product.ts).
 *
 * Uses lit render() to produce DOM and verifies key elements are present.
 */
import { render, html } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { AppViewState } from "./app-view-state.ts";
import { renderProductApp } from "./app-render-product.ts";

/** Minimal stub of AppViewState with defaults for product UI rendering */
function createProductState(overrides: Partial<AppViewState> = {}): AppViewState {
  return {
    connected: true,
    simpleOnboardingDone: true,
    sessionKey: "main",
    basePath: "/",
    password: "",
    lastError: null,
    sidebarOpen: false,
    sidebarContent: null,
    sidebarError: null,
    splitRatio: 0.5,
    settings: { gatewayUrl: "ws://localhost:18789", token: "test" },
    applySettings: vi.fn(),
    connect: vi.fn(),
    productPanel: "chat",
    productDevDrawerOpen: false,
    productCreateProjectOpen: false,
    productCreateProjectName: "",
    productCreateProjectDesc: "",
    productTelegramToken: "",
    productTelegramAllowFrom: "",
    productTelegramError: null,
    productTelegramSuccess: null,
    productTelegramBusy: false,
    productAgentId: null,
    productSessionsResult: {
      ts: 0,
      path: "",
      count: 0,
      defaults: { model: null, contextTokens: null },
      sessions: [],
    },
    productProjects: [],
    productCollapsedProjects: new Set(),
    agentsList: { defaultId: "main", agents: [] },
    chatThinkingLevel: null,
    chatLoading: false,
    chatSending: false,
    compactionStatus: null,
    chatAvatarUrl: null,
    chatMessages: [],
    chatToolMessages: [],
    chatStream: null,
    chatStreamStartedAt: null,
    chatMessage: "",
    chatQueue: [],
    chatRunId: null,
    chatAttachments: [],
    chatNewMessagesBelow: false,
    chatManualRefreshInFlight: false,
    sessionsResult: {
      ts: 0,
      path: "",
      count: 0,
      defaults: { model: null, contextTokens: null },
      sessions: [],
    },
    assistantName: "OpenClaw",
    assistantAvatar: null,
    onboardingWizardStatus: null,
    onboardingWizardBusy: false,
    onboardingWizardError: null,
    onboardingWizardStep: null,
    onboardingWizardFlow: null,
    onboardingWizardMode: null,
    onboardingWizardWorkspace: "",
    onboardingWizardResetConfig: false,
    onboardingWizardTextAnswer: "",
    focusMode: false,
    // Methods
    productNewChat: vi.fn(),
    productResetChat: vi.fn(),
    productOpenSession: vi.fn(),
    productSelectAgent: vi.fn(),
    productToggleProjectCollapsed: vi.fn(),
    productCreateProject: vi.fn(),
    productConnectTelegram: vi.fn(),
    productReloadConfig: vi.fn(),
    productResetAll: vi.fn(),
    handleSendChat: vi.fn(),
    handleAbortChat: vi.fn(),
    removeQueuedMessage: vi.fn(),
    handleChatScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    handleOpenSidebar: vi.fn(),
    handleCloseSidebar: vi.fn(),
    handleSplitRatioChange: vi.fn(),
    startOnboardingWizard: vi.fn(),
    advanceOnboardingWizard: vi.fn(),
    ...overrides,
  } as unknown as AppViewState;
}

function renderToContainer(state: AppViewState): HTMLElement {
  const container = document.createElement("div");
  render(renderProductApp(state), container);
  return container;
}

describe("Product UI — shell layout", () => {
  it("renders the product-shell with rail, sidebar, and main", () => {
    const el = renderToContainer(createProductState());
    expect(el.querySelector(".product-shell")).toBeTruthy();
    expect(el.querySelector(".product-rail")).toBeTruthy();
    expect(el.querySelector(".product-sidebar")).toBeTruthy();
    expect(el.querySelector(".product-main")).toBeTruthy();
  });
});

describe("Product UI — icon rail buttons", () => {
  it("renders 'Новый чат' button in the rail", () => {
    const el = renderToContainer(createProductState());
    const btn = el.querySelector('.product-rail__btn[title="Новый чат"]');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute("aria-label")).toBe("Новый чат");
  });

  it("renders 'Проекты' button in the rail", () => {
    const el = renderToContainer(createProductState());
    const btn = el.querySelector('.product-rail__btn[title="Проекты"]');
    expect(btn).toBeTruthy();
  });

  it("renders 'Telegram' button in the rail", () => {
    const el = renderToContainer(createProductState());
    const btn = el.querySelector('.product-rail__btn[title="Telegram"]');
    expect(btn).toBeTruthy();
  });

  it("renders developer tools button", () => {
    const el = renderToContainer(createProductState());
    const btn = el.querySelector('.product-rail__btn[title="Для разработчиков"]');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute("aria-label")).toBe("Инструменты разработчика");
  });
});

describe("Product UI — sidebar", () => {
  it("renders sidebar with OpenClaw title", () => {
    const el = renderToContainer(createProductState());
    const title = el.querySelector(".product-title");
    expect(title?.textContent).toContain("OpenClaw");
  });

  it("renders 'Создать проект' button", () => {
    const el = renderToContainer(createProductState());
    const btn = Array.from(el.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Создать проект"),
    );
    expect(btn).toBeTruthy();
  });

  it("renders session list section", () => {
    const el = renderToContainer(createProductState());
    const sub = Array.from(el.querySelectorAll(".product-sub")).find((s) =>
      s.textContent?.includes("Чаты"),
    );
    expect(sub).toBeTruthy();
  });

  it("renders new chat + button in sidebar", () => {
    const el = renderToContainer(createProductState());
    // The small "+" button next to "Чаты" header
    const btns = el.querySelectorAll('.btn.btn--sm[aria-label="New chat"]');
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Product UI — main area chat view", () => {
  it("renders chat area when connected and onboarded", () => {
    const el = renderToContainer(createProductState());
    // The chat view should be in main area
    const main = el.querySelector(".product-main");
    expect(main).toBeTruthy();
    // Should not show connection card
    expect(el.querySelector(".card-title")?.textContent).not.toBe("Подключение");
  });

  it("shows connection card when disconnected", () => {
    const el = renderToContainer(createProductState({ connected: false }));
    const title = el.querySelector(".card-title");
    expect(title?.textContent).toContain("Подключение");
  });

  it("shows onboarding card when connected but not onboarded", () => {
    const el = renderToContainer(createProductState({ simpleOnboardingDone: false }));
    const title = el.querySelector(".card-title");
    expect(title?.textContent).toContain("Настройка");
  });
});

describe("Product UI — dev drawer", () => {
  it("does not render dev drawer when closed", () => {
    const el = renderToContainer(createProductState({ productDevDrawerOpen: false }));
    expect(el.querySelector(".product-dev-drawer")).toBeFalsy();
  });

  it("renders dev drawer when open", () => {
    const el = renderToContainer(createProductState({ productDevDrawerOpen: true }));
    const drawer = el.querySelector(".product-dev-drawer");
    expect(drawer).toBeTruthy();
    // Has legacy links
    const links = drawer?.querySelectorAll("a.btn");
    expect(links?.length).toBeGreaterThan(0);
  });
});

describe("Product UI — Telegram panel", () => {
  it("renders Telegram setup when panel=telegram", () => {
    const el = renderToContainer(createProductState({ productPanel: "telegram" as never }));
    const title = el.querySelector(".card-title");
    expect(title?.textContent).toContain("Telegram");
    // Has bot token input
    const inputs = el.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Product UI — hidden slash-commands", () => {
  it("does not expose /new or /reset commands in the UI text", () => {
    const el = renderToContainer(createProductState());
    const text = el.textContent ?? "";
    expect(text).not.toContain("/new");
    expect(text).not.toContain("/reset");
    expect(text).not.toContain("/stop");
  });
});

describe("Product UI — create project modal", () => {
  it("does not render modal when closed", () => {
    const el = renderToContainer(createProductState({ productCreateProjectOpen: false }));
    expect(el.querySelector(".product-modal")).toBeFalsy();
  });

  it("renders modal when open", () => {
    const el = renderToContainer(createProductState({ productCreateProjectOpen: true }));
    const modal = el.querySelector(".product-modal");
    expect(modal).toBeTruthy();
    expect(modal?.textContent).toContain("Новый проект");
  });
});
