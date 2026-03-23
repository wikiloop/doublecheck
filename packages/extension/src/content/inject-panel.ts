// Inject the review panel on diff pages

import { createApp, type App } from "vue";
import ReviewPanel from "../components/ReviewPanel.vue";

const MOUNT_ID = "dc-review-panel-root";
let app: App | null = null;

/**
 * Inject the review panel below the diff on a Wikipedia diff page.
 */
export function injectReviewPanel(wiki: string, revId: number): void {
  // Clean up any existing panel first
  cleanupReviewPanel();

  // Find the diff table to inject after
  const diffTable =
    document.querySelector(".diff") ??
    document.querySelector("#mw-content-text");

  if (!diffTable) return;

  // Create a shadow DOM host for style isolation
  const host = document.createElement("div");
  host.id = MOUNT_ID;
  diffTable.parentNode?.insertBefore(host, diffTable.nextSibling);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = getReviewPanelStyles();
  shadow.appendChild(style);

  // Create the Vue mount point inside the shadow DOM
  const mountPoint = document.createElement("div");
  mountPoint.id = "dc-app";
  shadow.appendChild(mountPoint);

  // Mount the Vue app
  app = createApp(ReviewPanel, { wiki, revId });
  app.mount(mountPoint);
}

/**
 * Remove the review panel and clean up the Vue app.
 */
export function cleanupReviewPanel(): void {
  if (app) {
    app.unmount();
    app = null;
  }

  const existing = document.getElementById(MOUNT_ID);
  if (existing) {
    existing.remove();
  }
}

function getReviewPanelStyles(): string {
  return `
    .dc-panel {
      margin: 16px 0;
      padding: 16px;
      border: 1px solid #a2a9b1;
      border-radius: 4px;
      background: #f8f9fa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #202122;
    }
    .dc-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .dc-panel-title {
      font-weight: 600;
      font-size: 15px;
    }
    .dc-scores {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .dc-score {
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
    }
    .dc-score--high { background: #fee7e6; color: #d33; }
    .dc-score--medium { background: #fef6e7; color: #ac6600; }
    .dc-score--low { background: #d5fdf4; color: #14866d; }
    .dc-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .dc-btn {
      padding: 8px 16px;
      border: 1px solid #a2a9b1;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      background: #fff;
      transition: background-color 0.15s;
    }
    .dc-btn:hover { background: #eaecf0; }
    .dc-btn--revert { border-color: #d33; color: #d33; }
    .dc-btn--revert:hover { background: #fee7e6; }
    .dc-btn--revert.dc-btn--active { background: #d33; color: #fff; }
    .dc-btn--notsure { border-color: #ac6600; color: #ac6600; }
    .dc-btn--notsure:hover { background: #fef6e7; }
    .dc-btn--notsure.dc-btn--active { background: #ac6600; color: #fff; }
    .dc-btn--good { border-color: #14866d; color: #14866d; }
    .dc-btn--good:hover { background: #d5fdf4; }
    .dc-btn--good.dc-btn--active { background: #14866d; color: #fff; }
    .dc-tallies {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #54595d;
    }
    .dc-tally { display: flex; align-items: center; gap: 4px; }
    .dc-loading {
      text-align: center;
      padding: 24px;
      color: #72777d;
    }
    .dc-error {
      padding: 12px;
      background: #fee7e6;
      border-radius: 4px;
      color: #d33;
      font-size: 13px;
    }
  `;
}
