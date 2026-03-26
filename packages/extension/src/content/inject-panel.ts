// Inject a floating DoubleCheck button on diff pages that opens the review modal

import { openReviewModal, closeReviewModal, isModalOpen } from "./inject-modal.js";

const BUTTON_ID = "dc-review-button";

/**
 * Inject the floating review button on a Wikipedia diff page.
 */
export function injectReviewPanel(wiki: string, revId: number): void {
  cleanupReviewPanel();

  // Floating button — fixed position, bottom-right corner
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
    transition: "background 0.15s, transform 0.15s",
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

/**
 * Remove the review button and close any open modal.
 */
export function cleanupReviewPanel(): void {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) existing.remove();
  closeReviewModal();
}
