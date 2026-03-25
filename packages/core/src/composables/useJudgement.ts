import { ref, watchEffect, type Ref } from "vue";
import type { Judgement, JudgementAction } from "../types/index.js";
import { getApiClient } from "../api/client.js";

export function useJudgement(wiki: Ref<string> | string, revId: Ref<number> | number) {
  const judgements = ref<Judgement[]>([]);
  const tallies = ref<Record<JudgementAction, number>>({
    ShouldRevert: 0,
    NotSure: 0,
    LooksGood: 0,
  });
  const userAction = ref<JudgementAction | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  let abortController: AbortController | null = null;

  function fetch() {
    const wikiVal = typeof wiki === "string" ? wiki : wiki.value;
    const revIdVal = typeof revId === "number" ? revId : revId.value;

    if (!wikiVal || !revIdVal) return;

    abortController?.abort();
    abortController = new AbortController();

    loading.value = true;
    error.value = null;

    const client = getApiClient();
    client
      .getJudgements(wikiVal, revIdVal, abortController.signal)
      .then((res) => {
        judgements.value = res.judgements;
        tallies.value = res.tallies;
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        error.value = err instanceof Error ? err : new Error(String(err));
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function submit(action: JudgementAction): Promise<void> {
    const wikiVal = typeof wiki === "string" ? wiki : wiki.value;
    const revIdVal = typeof revId === "number" ? revId : revId.value;

    loading.value = true;
    error.value = null;
    try {
      const client = getApiClient();
      const result = await client.submitJudgement({
        wiki: wikiVal,
        revId: revIdVal,
        action,
      });
      const previousAction = userAction.value;
      userAction.value = result.action;
      // Update tallies locally — decrement previous vote if changing judgement
      const updated = { ...tallies.value };
      if (previousAction && previousAction !== action && updated[previousAction] > 0) {
        updated[previousAction]--;
      }
      if (!previousAction || previousAction !== action) {
        updated[action] = (updated[action] ?? 0) + 1;
      }
      tallies.value = updated;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  }

  watchEffect(() => {
    fetch();
  });

  return { judgements, tallies, userAction, submit, loading, error };
}
