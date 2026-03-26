import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountDiffPanel, unmountDiffPanel } from "../../injection/diff-panel.js";

function setupMwGlobal() {
  const g = globalThis as Record<string, unknown>;
  g.mw = {
    user: {
      isNamed: vi.fn(() => true),
      isTemp: vi.fn(() => false),
      isAnon: vi.fn(() => false),
    },
    config: {
      get: vi.fn((k: string) => {
        if (k === "wgUserName") return "TestUser";
        if (k === "wgDiffNewId") return 12345;
        if (k === "wgDBname") return "enwiki";
        if (k === "wgRevisionId") return 12345;
        if (k === "wgUserGroups") return ["*", "user"];
        return null;
      }),
    },
    messages: { set: vi.fn() },
    message: vi.fn(() => ({
      text: () => "",
      exists: () => false,
    })),
  };
}

describe("diff-panel injection", () => {
  beforeEach(() => {
    setupMwGlobal();
    document.body.innerHTML = '<div id="bodyContent"><table class="diff"></table></div>';
  });

  afterEach(() => {
    unmountDiffPanel();
    document.body.innerHTML = "";
    delete (globalThis as Record<string, unknown>).mw;
  });

  it("mounts the floating review button", () => {
    mountDiffPanel();
    const btn = document.getElementById("dc-review-button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("DoubleCheck");
  });

  it("does not mount twice", () => {
    mountDiffPanel();
    mountDiffPanel();
    const buttons = document.querySelectorAll("#dc-review-button");
    expect(buttons.length).toBe(1);
  });

  it("unmount removes the button", () => {
    mountDiffPanel();
    expect(document.getElementById("dc-review-button")).not.toBeNull();

    unmountDiffPanel();
    expect(document.getElementById("dc-review-button")).toBeNull();
  });

  it("does nothing if no revision ID found", () => {
    const g = globalThis as Record<string, unknown>;
    g.mw = {
      ...g.mw as object,
      config: {
        get: vi.fn(() => null),
      },
    };
    // Clear URL params too
    Object.defineProperty(window, "location", {
      value: new URL("https://en.wikipedia.org/wiki/Test"),
      writable: true,
      configurable: true,
    });
    mountDiffPanel();
    expect(document.getElementById("dc-review-button")).toBeNull();
  });
});
