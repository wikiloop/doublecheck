// Modal iframe overlay for the full DoubleCheck review interface (userscript version)

const OVERLAY_ID = "dc-modal-overlay";
const WEB_APP_BASE = "https://wikiloop-doublecheck.toolforge.org";

let overlayEl: HTMLElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Open the DoubleCheck review modal with the full web interface.
 */
export function openReviewModal(wiki: string, revId: number): void {
  closeReviewModal();

  // Overlay backdrop
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

  // Modal container
  const modal = document.createElement("div");
  Object.assign(modal.style, {
    width: "80vw",
    height: "80vh",
    background: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    position: "relative",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  });

  // Close button (X) — top right
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u2715";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "8px",
    right: "12px",
    zIndex: "10",
    background: "#fff",
    border: "1px solid #a2a9b1",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#202122",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    lineHeight: "1",
  });
  closeBtn.title = "Close (Esc)";
  closeBtn.addEventListener("click", closeReviewModal);
  closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "#f8f9fa"; });
  closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "#fff"; });

  // Iframe
  const iframe = document.createElement("iframe");
  iframe.src = `${WEB_APP_BASE}/review/${encodeURIComponent(wiki)}/${revId}?embed=true`;
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
  });
  iframe.setAttribute("allow", "clipboard-read; clipboard-write");

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  // Send init info once iframe loads
  iframe.addEventListener("load", () => {
    iframe.contentWindow?.postMessage({
      type: "dc-embed-init",
      user: getWikiUser(),
      wiki,
    }, "*");
  });
  setupPostMessageBridge(iframe, wiki);

  // Close on Escape
  escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeReviewModal();
  };
  window.addEventListener("keydown", escHandler);
}

/**
 * Close and clean up the review modal.
 */
export function closeReviewModal(): void {
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

// ---- PostMessage bridge ----

function setupPostMessageBridge(iframe: HTMLIFrameElement, wiki: string): void {
  window.addEventListener("message", async (event) => {
    if (event.data?.type !== "dc-wiki-action") return;

    const { id, action, payload } = event.data;
    try {
      let result: unknown;
      switch (action) {
        case "revert":
          result = await performRevert(
            payload.wiki || wiki,
            payload.revId,
            payload.baseRevId,
            payload.mode,
            payload.reason,
          );
          break;
        case "thank":
          result = await performThank(payload.wiki || wiki, payload.revId);
          break;
        case "warn":
          result = await performWarn(
            payload.wiki || wiki,
            payload.username,
            payload.level,
            payload.articleTitle,
          );
          break;
        case "get-user":
          result = getWikiUser();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      iframe.contentWindow?.postMessage(
        { type: "dc-wiki-response", id, success: true, data: result },
        "*",
      );
    } catch (e) {
      iframe.contentWindow?.postMessage(
        { type: "dc-wiki-response", id, success: false, error: e instanceof Error ? e.message : String(e) },
        "*",
      );
    }
  });
}

// ---- Wikipedia API helpers (same-origin via mw.Api or fetch) ----

function getWikiUser(): { username: string | null; groups: string[] } | null {
  try {
    return {
      username: mw.config.get("wgUserName") as string | null,
      groups: (mw.config.get("wgUserGroups") as string[]) || [],
    };
  } catch { /* mw not available */ }
  return null;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/w/api.php?action=query&meta=tokens&type=csrf&format=json", {
    credentials: "include",
  });
  const data = await res.json();
  const token = data?.query?.tokens?.csrftoken;
  if (!token || token === "+\\") throw new Error("Not logged in to Wikipedia");
  return token;
}

async function performRevert(
  wiki: string,
  revId: number,
  baseRevId: number | undefined,
  mode: string,
  reason?: string,
): Promise<{ success: boolean; newRevId?: number; error?: string }> {
  const currentWiki = getCurrentWiki();
  if (currentWiki && currentWiki !== wiki) {
    return { success: false, error: `Cannot revert ${wiki} edits from ${currentWiki}` };
  }

  try {
    const token = await getCsrfToken();

    const revRes = await fetch(
      `/w/api.php?action=query&prop=revisions&revids=${revId}&rvprop=ids|user&format=json&formatversion=2`,
      { credentials: "include" },
    );
    const revData = await revRes.json();
    const page = revData?.query?.pages?.[0];
    if (!page?.title) return { success: false, error: "Could not find page for revision" };

    const revUser = page.revisions?.[0]?.user || "unknown";
    const summary =
      reason?.trim() ||
      (mode === "vandalism"
        ? `Reverted edit(s) by [[Special:Contributions/${revUser}|${revUser}]] ([[User talk:${revUser}|talk]]): vandalism ([[WP:DC|DoubleCheck]])`
        : `Reverted edit(s) by [[Special:Contributions/${revUser}|${revUser}]] ([[User talk:${revUser}|talk]]): good-faith revert ([[WP:DC|DoubleCheck]])`);

    const form = new URLSearchParams();
    form.set("action", "edit");
    form.set("title", page.title);
    form.set("undo", String(revId));
    if (baseRevId) form.set("undoafter", String(baseRevId));
    form.set("summary", summary);
    form.set("token", token);
    form.set("format", "json");
    form.set("formatversion", "2");

    const editRes = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const editData = await editRes.json();

    if (editData?.edit?.result === "Success") {
      return { success: true, newRevId: editData.edit.newrevid };
    }
    return {
      success: false,
      error: editData?.error?.info || editData?.edit?.result || "Revert failed",
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function performThank(
  wiki: string,
  revId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getCsrfToken();
    const form = new URLSearchParams();
    form.set("action", "thank");
    form.set("rev", String(revId));
    form.set("token", token);
    form.set("format", "json");

    const res = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();

    if (data?.result?.success) return { success: true };
    return { success: false, error: data?.error?.info || "Thank failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function performWarn(
  wiki: string,
  username: string,
  level: number | string,
  articleTitle: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getCsrfToken();
    const talkPage = `User talk:${username}`;

    const templateMap: Record<string, string> = {
      "1": `{{subst:uw-vandalism1|${articleTitle}}} ~~~~`,
      "2": `{{subst:uw-vandalism2|${articleTitle}}} ~~~~`,
      "3": `{{subst:uw-vandalism3|${articleTitle}}} ~~~~`,
      "4": `{{subst:uw-vandalism4|${articleTitle}}} ~~~~`,
      "4im": `{{subst:uw-vandalism4im|${articleTitle}}} ~~~~`,
    };
    const templateText = templateMap[String(level)] || templateMap["1"];

    const form = new URLSearchParams();
    form.set("action", "edit");
    form.set("title", talkPage);
    form.set("section", "new");
    form.set("sectiontitle", `Warning: Editing on [[${articleTitle}]]`);
    form.set("text", templateText);
    form.set("summary", `Level ${level} warning re: [[${articleTitle}]] ([[WP:DC|DoubleCheck]])`);
    form.set("token", token);
    form.set("format", "json");
    form.set("formatversion", "2");

    const res = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();

    if (data?.edit?.result === "Success") return { success: true };
    return { success: false, error: data?.error?.info || "Warning failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

function getCurrentWiki(): string | null {
  const match = window.location.hostname.match(/^(\w+)\.wikipedia\.org$/);
  return match ? `${match[1]}wiki` : null;
}
