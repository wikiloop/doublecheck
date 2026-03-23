import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectPageType, hasRLModule } from "../main.js";

function clearMwGlobal() {
  delete (globalThis as Record<string, unknown>).mw;
}

function setupMwGlobal(overrides: {
  specialPage?: string | null;
  rlModules?: Record<string, string>;
} = {}) {
  const g = globalThis as Record<string, unknown>;
  g.mw = {
    user: {
      isNamed: vi.fn(() => false),
      isTemp: vi.fn(() => false),
      isAnon: vi.fn(() => true),
    },
    config: {
      get: vi.fn((key: string) => {
        if (key === "wgCanonicalSpecialPageName") return overrides.specialPage ?? null;
        return null;
      }),
    },
    loader: {
      getState: vi.fn((mod: string) => overrides.rlModules?.[mod] ?? null),
      using: vi.fn(() => Promise.resolve()),
    },
    messages: { set: vi.fn() },
    message: vi.fn(() => ({ text: () => "", exists: () => false })),
  };
}

describe("detectPageType", () => {
  beforeEach(() => {
    clearMwGlobal();
  });

  it("detects diff pages from URL with diff= parameter", () => {
    // jsdom default location is about:blank, so we simulate with a spy
    const originalHref = window.location.href;
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "https://en.wikipedia.org/w/index.php?diff=12345" },
      writable: true,
    });

    setupMwGlobal();
    expect(detectPageType()).toBe("diff");

    Object.defineProperty(window, "location", {
      value: { ...window.location, href: originalHref },
      writable: true,
    });
  });

  it("detects diff pages from Special:Diff URL", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "https://en.wikipedia.org/wiki/Special:Diff/12345" },
      writable: true,
    });

    setupMwGlobal();
    expect(detectPageType()).toBe("diff");
  });

  it("detects RecentChanges from mw.config", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "https://en.wikipedia.org/wiki/Special:RecentChanges" },
      writable: true,
    });

    setupMwGlobal({ specialPage: "Recentchanges" });
    expect(detectPageType()).toBe("recentchanges");
  });

  it("detects Watchlist from mw.config", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "https://en.wikipedia.org/wiki/Special:Watchlist" },
      writable: true,
    });

    setupMwGlobal({ specialPage: "Watchlist" });
    expect(detectPageType()).toBe("watchlist");
  });

  it("returns unknown for unrecognized pages", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "https://en.wikipedia.org/wiki/Main_Page" },
      writable: true,
    });

    setupMwGlobal();
    expect(detectPageType()).toBe("unknown");
  });
});

describe("hasRLModule", () => {
  beforeEach(() => {
    clearMwGlobal();
  });

  it("returns true when module is registered", () => {
    setupMwGlobal({ rlModules: { vue: "ready" } });
    expect(hasRLModule("vue")).toBe(true);
  });

  it("returns false when module state is null", () => {
    setupMwGlobal({ rlModules: {} });
    expect(hasRLModule("vue")).toBe(false);
  });

  it("returns false when module state is error", () => {
    setupMwGlobal({ rlModules: { vue: "error" } });
    expect(hasRLModule("vue")).toBe(false);
  });

  it("returns false when mw is not available", () => {
    clearMwGlobal();
    expect(hasRLModule("vue")).toBe(false);
  });
});
