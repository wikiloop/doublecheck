import { describe, it, expect, beforeEach, vi } from "vitest";

// We need to reset module state between tests since i18n has `initialized` flag
let msg: typeof import("../i18n.js").msg;
let initI18n: typeof import("../i18n.js").initI18n;

function clearMwGlobal() {
  delete (globalThis as Record<string, unknown>).mw;
}

describe("i18n", () => {
  beforeEach(async () => {
    clearMwGlobal();
    // Re-import to reset initialized flag
    vi.resetModules();
    const mod = await import("../i18n.js");
    msg = mod.msg;
    initI18n = mod.initI18n;
  });

  it("returns bundled string when mw is not available", () => {
    expect(msg("dc-looks-good")).toBe("Looks Good");
    expect(msg("dc-should-revert")).toBe("Should Revert");
  });

  it("substitutes parameters in bundled strings", () => {
    expect(msg("dc-votes", 5)).toBe("5 votes");
  });

  it("returns the key itself for unknown keys", () => {
    expect(msg("dc-nonexistent-key")).toBe("dc-nonexistent-key");
  });

  it("uses mw.message when available and message exists", () => {
    const g = globalThis as Record<string, unknown>;
    g.mw = {
      messages: { set: vi.fn() },
      message: vi.fn((_key: string) => ({
        text: () => "Sieht gut aus",
        exists: () => true,
      })),
    };

    initI18n();
    expect(msg("dc-looks-good")).toBe("Sieht gut aus");
  });

  it("falls back to bundled when mw.message says key does not exist", () => {
    const g = globalThis as Record<string, unknown>;
    g.mw = {
      messages: { set: vi.fn() },
      message: vi.fn((_key: string) => ({
        text: () => "",
        exists: () => false,
      })),
    };

    initI18n();
    expect(msg("dc-looks-good")).toBe("Looks Good");
  });

  it("registers bundled messages via mw.messages.set", () => {
    const setFn = vi.fn();
    const g = globalThis as Record<string, unknown>;
    g.mw = {
      messages: { set: setFn },
      message: vi.fn(() => ({ text: () => "", exists: () => false })),
    };

    initI18n();
    expect(setFn).toHaveBeenCalledOnce();
    expect(setFn).toHaveBeenCalledWith(expect.objectContaining({
      "dc-looks-good": "Looks Good",
    }));
  });
});
