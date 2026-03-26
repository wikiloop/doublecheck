// Inject a floating DoubleCheck button on diff pages that opens the review modal

import { openReviewModal, closeReviewModal, isModalOpen } from "./native-modal.js";

const BUTTON_ID = "dc-review-button";

/** Get wiki ID from the current page. */
function getWikiId(): string {
  try {
    const dbName = mw.config.get("wgDBname") as string;
    return dbName || "enwiki";
  } catch {
    const host = window.location.hostname;
    const match = host.match(/^(\w+)\.wikipedia\.org$/);
    return match ? `${match[1]}wiki` : "enwiki";
  }
}

/** Get the revision ID from the current diff page. */
function getRevisionId(): number | null {
  try {
    const diffNewId = mw.config.get("wgDiffNewId") as number | null;
    if (diffNewId) return diffNewId;
    const revId = mw.config.get("wgRevisionId") as number;
    if (revId) return revId;
  } catch { /* fall through */ }

  const url = new URL(window.location.href);
  const diffParam = url.searchParams.get("diff");
  if (diffParam) return parseInt(diffParam, 10) || null;

  const pathMatch = url.pathname.match(/Special:Diff\/(\d+)/);
  if (pathMatch) return parseInt(pathMatch[1], 10) || null;

  return null;
}

/** Mount the floating review button on a diff page. */
export function mountDiffPanel(): void {
  if (document.getElementById(BUTTON_ID)) return;

  const wiki = getWikiId();
  const revId = getRevisionId();
  if (!revId) return;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Review with DoubleCheck";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "99998",
    padding: "10px 20px",
    background: "#36c",
    color: "#fff",
    border: "none",
    borderRadius: "24px",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    transition: "background 0.15s",
  });
  btn.addEventListener("mouseenter", () => { btn.style.background = "#2a4b8d"; });
  btn.addEventListener("mouseleave", () => { btn.style.background = "#36c"; });
  btn.addEventListener("click", () => {
    if (isModalOpen()) {
      closeReviewModal();
    } else {
      openReviewModal(wiki, revId);
    }
  });

  document.body.appendChild(btn);
}

/** Clean up the floating button and modal. */
export function unmountDiffPanel(): void {
  const el = document.getElementById(BUTTON_ID);
  el?.remove();
  closeReviewModal();
}
