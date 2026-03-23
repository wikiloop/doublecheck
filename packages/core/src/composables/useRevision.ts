import { ref, watchEffect, type Ref } from "vue";
import type { Revision, LiftWingScore } from "../types/index.js";
import { getApiClient } from "../api/client.js";

export function useRevision(wiki: Ref<string> | string, revId: Ref<number> | number) {
  const revision = ref<Revision | null>(null);
  const liftWingScore = ref<LiftWingScore | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  let abortController: AbortController | null = null;

  function fetch() {
    const wikiVal = typeof wiki === "string" ? wiki : wiki.value;
    const revIdVal = typeof revId === "number" ? revId : revId.value;

    if (!wikiVal || !revIdVal) return;

    // Cancel previous request
    abortController?.abort();
    abortController = new AbortController();

    loading.value = true;
    error.value = null;

    const client = getApiClient();
    client
      .getRevision(wikiVal, revIdVal, abortController.signal)
      .then((res) => {
        const { liftWing, ...rev } = res;
        revision.value = rev;
        liftWingScore.value = liftWing ?? null;
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        error.value = err instanceof Error ? err : new Error(String(err));
      })
      .finally(() => {
        loading.value = false;
      });
  }

  watchEffect(() => {
    fetch();
  });

  return { revision, liftWingScore, loading, error };
}
