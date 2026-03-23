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

describe("Panel injection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a mount point for the review panel", async () => {
    // Set up a mock diff page
    setLocation("https://en.wikipedia.org/w/index.php?diff=12345&oldid=12344");

    const diffTable = document.createElement("table");
    diffTable.className = "diff";
    document.body.appendChild(diffTable);

    // Import and call the injection function
    const { injectReviewPanel, cleanupReviewPanel } = await import(
      "../../content/inject-panel.js"
    );

    injectReviewPanel("enwiki", 12345);

    const mountPoint = document.getElementById("dc-review-panel-root");
    expect(mountPoint).not.toBeNull();
    expect(mountPoint?.shadowRoot).not.toBeNull();

    // Clean up
    cleanupReviewPanel();
    expect(document.getElementById("dc-review-panel-root")).toBeNull();
  });

  it("cleans up previous panel before injecting a new one", async () => {
    setLocation("https://en.wikipedia.org/w/index.php?diff=12345&oldid=12344");

    const diffTable = document.createElement("table");
    diffTable.className = "diff";
    document.body.appendChild(diffTable);

    const { injectReviewPanel, cleanupReviewPanel } = await import(
      "../../content/inject-panel.js"
    );

    injectReviewPanel("enwiki", 12345);
    injectReviewPanel("enwiki", 12346);

    const mountPoints = document.querySelectorAll("#dc-review-panel-root");
    expect(mountPoints.length).toBe(1);

    cleanupReviewPanel();
  });
});
