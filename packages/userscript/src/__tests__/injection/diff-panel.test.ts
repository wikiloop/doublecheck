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
      get: vi.fn((key: string) => {
        if (key === "wgUserName") return "TestUser";
        if (key === "wgDiffNewId") return 12345;
        if (key === "wgDBname") return "enwiki";
        if (key === "wgRevisionId") return 12345;
        return null;
      }),
    },
    messages: { set: vi.fn() },
    message: vi.fn((_key: string) => ({
      text: () => "",
      exists: () => false,
    })),
  };
}

describe("diff-panel injection", () => {
  beforeEach(() => {
    setupMwGlobal();
    // Create a fake diff container
    document.body.innerHTML = '<div id="bodyContent"><table class="diff"></table></div>';
  });

  afterEach(() => {
    unmountDiffPanel();
    document.body.innerHTML = "";
    delete (globalThis as Record<string, unknown>).mw;
  });

  it("mounts the panel after the diff table", () => {
    mountDiffPanel();
    const panel = document.getElementById("dc-review-panel");
    expect(panel).not.toBeNull();
  });

  it("does not mount twice", () => {
    mountDiffPanel();
    mountDiffPanel();
    const panels = document.querySelectorAll("#dc-review-panel");
    expect(panels.length).toBe(1);
  });

  it("unmount removes the panel", () => {
    mountDiffPanel();
    expect(document.getElementById("dc-review-panel")).not.toBeNull();

    unmountDiffPanel();
    expect(document.getElementById("dc-review-panel")).toBeNull();
  });

  it("warns if no diff container found", () => {
    document.body.innerHTML = "";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountDiffPanel();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not find diff container"),
    );
    warnSpy.mockRestore();
  });
});
