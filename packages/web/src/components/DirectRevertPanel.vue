<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RevertCheckResponse, RevertResponse, RevertMode, WarnLevelResponse, WarnResponse } from "@doublecheck/core";
import { CdxButton, CdxMessage, CdxTextInput } from "@wikimedia/codex";
import { useEmbed } from "../composables/useEmbed";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
  title: string;
  consecutiveRevIds?: number[];
  baseRevId?: number;
}>();

const { t } = useI18n();
const { isEmbed, requestWikiAction } = useEmbed();

function revertRevisionUrl(newRevId: number): string {
  const match = props.wiki.match(/^(\w+)wiki$/);
  const base = match ? `https://${match[1]}.wikipedia.org` : `https://${props.wiki}`;
  return `${base}/w/index.php?diff=${newRevId}`;
}

const checking = ref(false);
const eligibility = ref<RevertCheckResponse | null>(null);
const reverting = ref(false);
const revertResult = ref<RevertResponse | null>(null);
const revertMode = ref<RevertMode>("vandalism");
const reason = ref("");
const showReasonField = ref(false);

async function checkEligibility() {
  checking.value = true;
  eligibility.value = null;
  revertResult.value = null;
  try {
    if (isEmbed.value) {
      // Embed mode (extension iframe): check via parent window's Wikipedia session
      eligibility.value = await requestWikiAction<RevertCheckResponse>("check-eligibility", {
        wiki: props.wiki,
        revId: props.revId,
        revisionUser: props.revisionUser,
        title: props.title,
      });
    } else {
      // Standalone web app: check via server (OAuth)
      const res = await fetch(
        `/api/revert/check/${encodeURIComponent(props.wiki)}/${props.revId}`,
        { credentials: "include" },
      );
      if (res.ok) {
        eligibility.value = await res.json();
      }
    }
  } catch {
    // API unavailable — allow attempt
    if (isEmbed.value) {
      eligibility.value = { eligible: true };
    }
  } finally {
    checking.value = false;
  }
}

async function doRevert(mode: RevertMode) {
  revertMode.value = mode;
  reverting.value = true;
  revertResult.value = null;

  if (isEmbed.value) {
    // Embed mode: revert via parent window's Wikipedia session (postMessage bridge)
    try {
      const result = await requestWikiAction<RevertResponse>("revert", {
        wiki: props.wiki,
        revId: props.revId,
        baseRevId: props.baseRevId ?? eligibility.value?.baseRevId,
        mode,
        reason: reason.value.trim() || undefined,
      });
      revertResult.value = result;
    } catch (e) {
      revertResult.value = {
        success: false,
        error: e instanceof Error ? e.message : "Revert failed",
      };
    } finally {
      reverting.value = false;
    }
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("/api/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        wiki: props.wiki,
        revId: props.revId,
        baseRevId: props.baseRevId ?? eligibility.value?.baseRevId,
        mode,
        reason: reason.value.trim() || undefined,
      }),
      signal: controller.signal,
    });
    revertResult.value = await res.json();
  } catch (e) {
    const msg = controller.signal.aborted
      ? "Request timed out — the revert may still be processing. Check the page history."
      : "Network error";
    revertResult.value = { success: false, error: msg };
  } finally {
    clearTimeout(timer);
    reverting.value = false;
  }
}

// ---- Warn user after revert ----
const warnState = ref<"idle" | "detecting" | "ready" | "posting" | "done" | "error">("idle");
const warnLevel = ref<WarnLevelResponse | null>(null);
const selectedWarnLevel = ref<string>("auto");
const warnResult = ref<WarnResponse | null>(null);

async function startWarn() {
  warnState.value = "detecting";
  warnLevel.value = null;
  warnResult.value = null;
  try {
    const res = await fetch(
      `/api/warn/level?wiki=${encodeURIComponent(props.wiki)}&user=${encodeURIComponent(props.revisionUser)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      warnLevel.value = await res.json();
      selectedWarnLevel.value = String(warnLevel.value!.autoLevel);
      warnState.value = "ready";
    } else {
      warnState.value = "error";
      warnResult.value = { success: false, error: "Failed to detect warning level" };
    }
  } catch {
    warnState.value = "error";
    warnResult.value = { success: false, error: "Network error" };
  }
}

async function postWarning() {
  warnState.value = "posting";
  try {
    const level = selectedWarnLevel.value === "4im" ? "4im" : parseInt(selectedWarnLevel.value, 10);

    if (isEmbed.value) {
      warnResult.value = await requestWikiAction<WarnResponse>("warn", {
        wiki: props.wiki,
        username: props.revisionUser,
        articleTitle: props.title,
        level,
      });
    } else {
      const res = await fetch("/api/warn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wiki: props.wiki,
          username: props.revisionUser,
          articleTitle: props.title,
          level,
        }),
      });
      warnResult.value = await res.json();
    }
    warnState.value = warnResult.value!.success ? "done" : "error";
  } catch {
    warnResult.value = { success: false, error: "Network error" };
    warnState.value = "error";
  }
}

// Check eligibility whenever the revision changes
watch(
  () => [props.wiki, props.revId],
  () => checkEligibility(),
  { immediate: true },
);
</script>

<template>
  <div class="dc-direct-revert">
    <!-- Loading -->
    <div
      v-if="checking"
      class="dc-direct-revert__checking"
    >
      {{ t("Label-CheckingEligibility") }}
    </div>

    <!-- Already reverted -->
    <template v-else-if="revertResult?.success">
      <CdxMessage type="success">
        {{ t("Message-RevertSuccess") }}
        <template v-if="revertResult.newRevId">
          (<a
            :href="revertRevisionUrl(revertResult.newRevId)"
            target="_blank"
            rel="noopener"
          >rev {{ revertResult.newRevId }}</a>)
        </template>
      </CdxMessage>

      <!-- Warn user after successful revert -->
      <div class="dc-direct-revert__warn">
        <!-- Warn: initial button -->
        <CdxButton
          v-if="warnState === 'idle'"
          action="destructive"
          weight="quiet"
          @click="startWarn"
        >
          {{ t("Button-WarnUser") }}
        </CdxButton>

        <!-- Warn: detecting level -->
        <div
          v-else-if="warnState === 'detecting'"
          class="dc-direct-revert__checking"
        >
          {{ t("Label-DetectingLevel") }}
        </div>

        <!-- Warn: ready to post — show level selector and confirm -->
        <div
          v-else-if="warnState === 'ready'"
          class="dc-direct-revert__warn-controls"
        >
          <label class="dc-direct-revert__warn-label">
            {{ t("Label-WarningLevel") }}:
          </label>
          <select
            v-model="selectedWarnLevel"
            class="dc-direct-revert__warn-select"
          >
            <option value="1">{{ t("Label-WarnLevel1") }}</option>
            <option value="2">{{ t("Label-WarnLevel2") }}</option>
            <option value="3">{{ t("Label-WarnLevel3") }}</option>
            <option value="4">{{ t("Label-WarnLevel4") }}</option>
            <option value="4im">{{ t("Label-WarnLevel4im") }}</option>
          </select>
          <CdxButton
            action="destructive"
            weight="primary"
            @click="postWarning"
          >
            {{ t("Button-WarnUser") }}
          </CdxButton>
        </div>

        <!-- Warn: posting -->
        <div
          v-else-if="warnState === 'posting'"
          class="dc-direct-revert__checking"
        >
          {{ t("Label-PostingWarning") }}
        </div>

        <!-- Warn: success -->
        <CdxMessage
          v-else-if="warnState === 'done'"
          type="success"
        >
          {{ t("Message-WarnSuccess") }}
        </CdxMessage>

        <!-- Warn: error -->
        <CdxMessage
          v-else-if="warnState === 'error' && warnResult"
          type="error"
        >
          {{ t("Message-WarnFailed") }}: {{ warnResult.error }}
        </CdxMessage>
      </div>
    </template>

    <!-- Revert failed -->
    <CdxMessage
      v-else-if="revertResult && !revertResult.success"
      type="error"
    >
      {{ t("Message-RevertFailed") }}: {{ revertResult.error }}
    </CdxMessage>

    <!-- Eligible: show revert buttons -->
    <template v-else-if="eligibility?.eligible">
      <div class="dc-direct-revert__actions">
        <CdxButton
          action="destructive"
          weight="primary"
          :disabled="reverting"
          @click="doRevert('vandalism')"
        >
          <template v-if="reverting && revertMode === 'vandalism'">
            {{ t("Label-Reverting") }}
          </template>
          <template v-else-if="eligibility.consecutiveRevIds && eligibility.consecutiveRevIds.length > 1">
            {{ t("Button-DirectRevertMultiple", { count: eligibility.consecutiveRevIds.length, user: eligibility.consecutiveEditUser ?? revisionUser }) }}
          </template>
          <template v-else>
            {{ t("Button-DirectRevert") }}
          </template>
        </CdxButton>

        <CdxButton
          action="progressive"
          weight="quiet"
          :disabled="reverting"
          @click="doRevert('goodfaith')"
        >
          <template v-if="reverting && revertMode === 'goodfaith'">
            {{ t("Label-Reverting") }}
          </template>
          <template v-else>
            {{ t("Button-RevertGoodFaith") }}
          </template>
        </CdxButton>

        <button
          class="dc-direct-revert__reason-toggle"
          type="button"
          @click="showReasonField = !showReasonField"
        >
          {{ showReasonField ? t("Label-HideReason") : t("Label-AddReason") }}
        </button>
      </div>

      <div v-if="showReasonField" class="dc-direct-revert__reason">
        <CdxTextInput
          v-model="reason"
          :placeholder="t('Placeholder-RevertReason')"
          class="dc-direct-revert__reason-input"
        />
      </div>
    </template>

    <!-- Not eligible: consecutive edits -->
    <CdxMessage
      v-else-if="eligibility?.reason === 'consecutive_edits'"
      type="warning"
    >
      {{ t("Message-ConsecutiveEdits", { user: eligibility.consecutiveEditUser ?? revisionUser }) }}
      <a
        :href="eligibility.pageHistoryUrl"
        target="_blank"
        rel="noopener"
      >{{ t("Label-PageHistory") }}</a>.
    </CdxMessage>

    <!-- Not eligible: not current revision -->
    <CdxMessage
      v-else-if="eligibility?.reason === 'not_current'"
      type="warning"
    >
      {{ t("Message-NotCurrentRevision") }}
    </CdxMessage>

    <!-- Not logged in -->
    <CdxMessage
      v-else-if="eligibility?.reason === 'not_logged_in'"
      type="notice"
    >
      {{ t("Message-LoginToRevert") }}
    </CdxMessage>
  </div>
</template>

<style scoped>
.dc-direct-revert {
  margin-top: 0.5rem;
}

.dc-direct-revert__checking {
  color: var(--color-placeholder);
  font-style: italic;
  font-size: 0.9rem;
}

.dc-direct-revert__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dc-direct-revert__reason-toggle {
  background: none;
  border: none;
  color: var(--color-progressive);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  text-decoration: underline;
}

.dc-direct-revert__reason-toggle:hover {
  text-decoration: none;
}

.dc-direct-revert__reason {
  margin-top: 0.5rem;
  max-width: 400px;
}

.dc-direct-revert__warn {
  margin-top: 0.75rem;
}

.dc-direct-revert__warn-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dc-direct-revert__warn-label {
  font-size: 0.9rem;
  font-weight: 500;
}

.dc-direct-revert__warn-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color-base, #a2a9b1);
  border-radius: 2px;
  font-size: 0.9rem;
  background: var(--background-color-base, #fff);
}
</style>
