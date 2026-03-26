// Native Vue modal — mounts ReviewModal.vue directly into the Wikipedia page DOM

import { createApp, type App } from "vue";
import { createDoubleCheckI18n } from "@doublecheck/core";

const OVERLAY_ID = "dc-modal-overlay";
const LOG_PREFIX = "[DoubleCheck]";

let app: App | null = null;
let overlayEl: HTMLElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Open the DoubleCheck review modal with native Vue rendering.
 * Loads Vue + Codex via ResourceLoader, then mounts ReviewModal.vue.
 */
export async function openReviewModal(wiki: string, revId: number): Promise<void> {
  if (overlayEl) {
    closeReviewModal();
    return;
  }

  console.log(`${LOG_PREFIX} Opening native review modal — wiki: ${wiki}, revId: ${revId}`);

  // Create overlay + modal container
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0, 0, 0, 0.5)",
    zIndex: "999999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeReviewModal();
  });

  const container = document.createElement("div");
  container.id = "dc-modal-app";
  Object.assign(container.style, {
    width: "80vw",
    height: "80vh",
    background: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    position: "relative",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  });

  overlay.appendChild(container);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  // Escape key handler
  escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeReviewModal();
  };
  window.addEventListener("keydown", escHandler);

  try {
    // Dynamic import of ReviewModal (Vite will bundle it, Vue is external)
    const { default: ReviewModal } = await import("../components/ReviewModal.vue");

    app = createApp(ReviewModal, {
      wiki,
      revId: revId || undefined,
      onClose: closeReviewModal,
    });

    // Register i18n so shared core components (ActionPanel, JudgementPanel, etc.) work
    const i18n = createDoubleCheckI18n();
    app.use(i18n);

    app.mount(container);
    console.log(`${LOG_PREFIX} Review modal mounted`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to mount review modal:`, err);
    closeReviewModal();
  }
}

/**
 * Close and clean up the review modal.
 */
export function closeReviewModal(): void {
  if (app) {
    app.unmount();
    app = null;
  }
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  document.getElementById(OVERLAY_ID)?.remove();
  if (escHandler) {
    window.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
}

export function isModalOpen(): boolean {
  return overlayEl !== null;
}
