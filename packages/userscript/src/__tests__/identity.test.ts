import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectIdentity } from "../identity.js";

function setupMwGlobal(overrides: {
  isNamed?: boolean;
  isTemp?: boolean;
  isAnon?: boolean;
  wgUserName?: string | null;
} = {}) {
  const g = globalThis as Record<string, unknown>;
  g.mw = {
    user: {
      isNamed: vi.fn(() => overrides.isNamed ?? false),
      isTemp: vi.fn(() => overrides.isTemp ?? false),
      isAnon: vi.fn(() => overrides.isAnon ?? false),
    },
    config: {
      get: vi.fn((key: string) => {
        if (key === "wgUserName") return overrides.wgUserName ?? null;
        return null;
      }),
    },
  };
}

function clearMwGlobal() {
  delete (globalThis as Record<string, unknown>).mw;
}

describe("detectIdentity", () => {
  beforeEach(() => {
    clearMwGlobal();
  });

  it("detects named users", () => {
    setupMwGlobal({ isNamed: true, wgUserName: "ExampleUser" });
    const identity = detectIdentity();
    expect(identity.type).toBe("named");
    expect(identity.username).toBe("ExampleUser");
    expect(identity.verified).toBe(false);
  });

  it("detects temp accounts", () => {
    setupMwGlobal({ isTemp: true, wgUserName: "~2024-12345-1" });
    const identity = detectIdentity();
    expect(identity.type).toBe("temp");
    expect(identity.username).toBe("~2024-12345-1");
  });

  it("detects anonymous users", () => {
    setupMwGlobal({ isAnon: true, wgUserName: null });
    const identity = detectIdentity();
    expect(identity.type).toBe("anon");
    expect(identity.username).toBeNull();
  });

  it("falls back to anon when mw is not available", () => {
    clearMwGlobal();
    const identity = detectIdentity();
    expect(identity.type).toBe("anon");
    expect(identity.username).toBeNull();
  });

  it("uses heuristic when mw.user methods are not functions", () => {
    const g = globalThis as Record<string, unknown>;
    g.mw = {
      user: {},
      config: {
        get: vi.fn((key: string) => {
          if (key === "wgUserName") return "SomeUser";
          return null;
        }),
      },
    };
    const identity = detectIdentity();
    expect(identity.type).toBe("named");
    expect(identity.username).toBe("SomeUser");
  });
});
