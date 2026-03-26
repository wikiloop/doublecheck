import { describe, it, expect, beforeEach } from "vitest";
import { detectPageType, extractRevisionId, extractWikiId } from "../../content/detection.js";

// Helper to set window.location for testing
function setLocation(url: string): void {
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

describe("Page type detection", () => {
  describe("detectPageType", () => {
    it("detects diff pages with query parameter", () => {
      setLocation("https://en.wikipedia.org/w/index.php?title=Test&diff=12345&oldid=12344");
      expect(detectPageType()).toBe("diff");
    });

    it("detects diff pages with Special:Diff URL", () => {
      setLocation("https://en.wikipedia.org/wiki/Special:Diff/12345");
      expect(detectPageType()).toBe("diff");
    });

    it("detects RecentChanges page", () => {
      setLocation("https://en.wikipedia.org/wiki/Special:RecentChanges");
      expect(detectPageType()).toBe("recentchanges");
    });

    it("detects Watchlist page", () => {
      setLocation("https://en.wikipedia.org/wiki/Special:Watchlist");
      expect(detectPageType()).toBe("watchlist");
    });

    it("returns unknown for regular article pages", () => {
      setLocation("https://en.wikipedia.org/wiki/Main_Page");
      expect(detectPageType()).toBe("unknown");
    });
  });

  describe("extractRevisionId", () => {
    it("extracts revision ID from diff query parameter", () => {
      setLocation("https://en.wikipedia.org/w/index.php?title=Test&diff=98765&oldid=98764");
      expect(extractRevisionId()).toBe(98765);
    });

    it("extracts revision ID from Special:Diff URL", () => {
      setLocation("https://en.wikipedia.org/wiki/Special:Diff/54321");
      expect(extractRevisionId()).toBe(54321);
    });

    it("returns null when no revision ID is found", () => {
      setLocation("https://en.wikipedia.org/wiki/Main_Page");
      expect(extractRevisionId()).toBeNull();
    });

    it("returns null for non-numeric diff parameter", () => {
      setLocation("https://en.wikipedia.org/w/index.php?diff=abc");
      expect(extractRevisionId()).toBeNull();
    });
  });

  describe("extractWikiId", () => {
    it("extracts wiki ID from English Wikipedia", () => {
      setLocation("https://en.wikipedia.org/wiki/Test");
      expect(extractWikiId()).toBe("enwiki");
    });

    it("extracts wiki ID from French Wikipedia", () => {
      setLocation("https://fr.wikipedia.org/wiki/Test");
      expect(extractWikiId()).toBe("frwiki");
    });

    it("extracts wiki ID from Japanese Wikipedia", () => {
      setLocation("https://ja.wikipedia.org/wiki/Test");
      expect(extractWikiId()).toBe("jawiki");
    });

    it("defaults to enwiki for unrecognized hostnames", () => {
      setLocation("https://example.com/wiki/Test");
      expect(extractWikiId()).toBe("enwiki");
    });
  });
});

describe("Panel injection (floating button)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a floating review button", async () => {
    setLocation("https://en.wikipedia.org/w/index.php?diff=12345&oldid=12344");

    const { injectReviewPanel, cleanupReviewPanel } = await import(
      "../../content/inject-panel.js"
    );

    injectReviewPanel("enwiki", 12345);

    const btn = document.getElementById("dc-review-button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("DoubleCheck");

    cleanupReviewPanel();
    expect(document.getElementById("dc-review-button")).toBeNull();
  });

  it("cleans up previous button before injecting a new one", async () => {
    setLocation("https://en.wikipedia.org/w/index.php?diff=12345&oldid=12344");

    const { injectReviewPanel, cleanupReviewPanel } = await import(
      "../../content/inject-panel.js"
    );

    injectReviewPanel("enwiki", 12345);
    injectReviewPanel("enwiki", 12346);

    const buttons = document.querySelectorAll("#dc-review-button");
    expect(buttons.length).toBe(1);

    cleanupReviewPanel();
  });
});
