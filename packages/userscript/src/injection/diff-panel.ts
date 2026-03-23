import { createApp, ref, onMounted, defineComponent, h, type App } from "vue";
import type { JudgementAction, LiftWingScore } from "@doublecheck/core";
import { fetchLiftWingScore, fetchJudgements, submitJudgement } from "../api.js";
import { msg } from "../i18n.js";

const MOUNT_ID = "dc-review-panel";

/** Extract wiki identifier from the current page. */
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

/** Extract the revision ID from the current page URL or mw.config. */
function getRevisionId(): number | null {
  try {
    const diffNewId = mw.config.get("wgDiffNewId") as number | null;
    if (diffNewId) return diffNewId;

    const revId = mw.config.get("wgRevisionId") as number;
    if (revId) return revId;
  } catch {
    // Fall through to URL parsing
  }

  // Parse from URL
  const url = new URL(window.location.href);
  const diffParam = url.searchParams.get("diff");
  if (diffParam) return parseInt(diffParam, 10) || null;

  const pathMatch = url.pathname.match(/Special:Diff\/(\d+)/);
  if (pathMatch) return parseInt(pathMatch[1], 10) || null;

  return null;
}

/** Vue component for the review panel injected below diffs. */
const ReviewPanel = defineComponent({
  name: "DcReviewPanel",
  setup() {
    const wiki = getWikiId();
    const revId = getRevisionId();
    const loading = ref(true);
    const error = ref<string | null>(null);
    const score = ref<LiftWingScore | null>(null);
    const tallies = ref<Record<JudgementAction, number>>({
      ShouldRevert: 0,
      NotSure: 0,
      LooksGood: 0,
    });
    const currentAction = ref<JudgementAction | null>(null);
    const submitting = ref(false);

    onMounted(async () => {
      if (!revId) {
        error.value = "Could not determine revision ID";
        loading.value = false;
        return;
      }

      try {
        const [scoreResult, judgementsResult] = await Promise.allSettled([
          fetchLiftWingScore(wiki, revId),
          fetchJudgements(wiki, revId),
        ]);

        if (scoreResult.status === "fulfilled") {
          score.value = scoreResult.value;
        }
        if (judgementsResult.status === "fulfilled") {
          tallies.value = judgementsResult.value.tallies;
        }
      } catch {
        error.value = msg("dc-error");
      } finally {
        loading.value = false;
      }
    });

    async function handleVote(action: JudgementAction): Promise<void> {
      if (!revId || submitting.value) return;
      submitting.value = true;
      try {
        await submitJudgement(wiki, revId, action);
        currentAction.value = action;
        tallies.value = { ...tallies.value, [action]: tallies.value[action] + 1 };
      } catch {
        // Silently fail — user can retry
      } finally {
        submitting.value = false;
      }
    }

    return { loading, error, score, tallies, currentAction, submitting, handleVote };
  },
  render() {
    const scoreBar = (label: string, value: number | undefined) => {
      const pct = value != null ? Math.round(value * 100) : 0;
      const color = pct > 70 ? "#d33" : pct > 40 ? "#fc3" : "#14866d";
      return h("div", { class: "dc-score-row" }, [
        h("span", { class: "dc-score-label" }, label),
        h("div", { class: "dc-progress-bar" }, [
          h("div", {
            class: "dc-progress-fill",
            style: { width: `${pct}%`, backgroundColor: color },
          }),
        ]),
        h("span", { class: "dc-score-value" }, `${pct}%`),
      ]);
    };

    const voteButton = (action: JudgementAction, label: string, btnClass: string) => {
      const isActive = this.currentAction === action;
      return h(
        "button",
        {
          class: `dc-btn ${btnClass}${isActive ? " dc-btn-active" : ""}`,
          disabled: this.submitting || this.currentAction != null,
          onClick: () => this.handleVote(action),
        },
        [
          label,
          h("span", { class: "dc-tally" }, ` (${this.tallies[action]})`),
        ],
      );
    };

    return h("div", { class: "dc-panel" }, [
      h("div", { class: "dc-panel-header" }, [
        h("span", { class: "dc-panel-logo" }, msg("dc-panel-title")),
      ]),
      h("div", { class: "dc-panel-body" }, [
        this.loading
          ? h("div", { class: "dc-loading" }, msg("dc-loading"))
          : this.error
            ? h("div", { class: "dc-error" }, this.error)
            : h("div", null, [
                // Score bars
                this.score
                  ? h("div", { class: "dc-scores" }, [
                      scoreBar(msg("dc-damaging-label"), this.score.damaging),
                      scoreBar(msg("dc-goodfaith-label"), this.score.goodfaith),
                    ])
                  : null,
                // Vote buttons
                h("div", { class: "dc-actions" }, [
                  voteButton("ShouldRevert", msg("dc-should-revert"), "dc-btn-revert"),
                  voteButton("NotSure", msg("dc-not-sure"), "dc-btn-unsure"),
                  voteButton("LooksGood", msg("dc-looks-good"), "dc-btn-good"),
                ]),
              ]),
      ]),
    ]);
  },
});

let app: App | null = null;

/** Mount the review panel below the diff on the current page. */
export function mountDiffPanel(): void {
  if (document.getElementById(MOUNT_ID)) return;

  // Find the diff table or content area to inject after
  const diffTable =
    document.querySelector(".diff") ??
    document.querySelector("#mw-content-text") ??
    document.querySelector("#bodyContent");

  if (!diffTable) {
    console.warn("[DoubleCheck] Could not find diff container to inject panel");
    return;
  }

  const mountEl = document.createElement("div");
  mountEl.id = MOUNT_ID;
  diffTable.parentNode?.insertBefore(mountEl, diffTable.nextSibling);

  app = createApp(ReviewPanel);
  app.mount(mountEl);
}

/** Unmount the review panel (for cleanup). */
export function unmountDiffPanel(): void {
  if (app) {
    app.unmount();
    app = null;
  }
  const el = document.getElementById(MOUNT_ID);
  el?.remove();
}
