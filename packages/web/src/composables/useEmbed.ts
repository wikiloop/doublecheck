import { ref, readonly } from "vue";

const isEmbed = ref(false);
const embedWikiUser = ref<{ username: string | null; groups: string[] } | null>(null);

let initDone = false;

export function useEmbed() {
  function init() {
    if (initDone) return;
    initDone = true;

    const params = new URLSearchParams(window.location.search);
    isEmbed.value = params.get("embed") === "true";

    if (isEmbed.value) {
      window.addEventListener("message", (event) => {
        if (event.data?.type === "dc-embed-init") {
          embedWikiUser.value = event.data.user;
        }
      });
    }
  }

  /**
   * Send a request to the parent window to perform a Wikipedia action.
   * Only works in embed mode when loaded inside a content script iframe.
   */
  function requestWikiAction<T = unknown>(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!isEmbed.value) {
        reject(new Error("Not in embed mode"));
        return;
      }

      const id = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      function onMessage(event: MessageEvent) {
        if (event.data?.type === "dc-wiki-response" && event.data?.id === id) {
          window.removeEventListener("message", onMessage);
          clearTimeout(timer);
          if (event.data.success) {
            resolve(event.data.data as T);
          } else {
            reject(new Error(event.data.error || "Action failed"));
          }
        }
      }

      window.addEventListener("message", onMessage);

      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Request timed out"));
      }, 30_000);

      window.parent.postMessage(
        { type: "dc-wiki-action", id, action, payload },
        "*",
      );
    });
  }

  return {
    isEmbed: readonly(isEmbed),
    embedWikiUser: readonly(embedWikiUser),
    init,
    requestWikiAction,
  };
}
