<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RevertCheckResponse, RevertResponse } from "@doublecheck/core";
import { CdxButton, CdxMessage } from "@wikimedia/codex";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
  title: string;
  consecutiveRevIds?: number[];
  baseRevId?: number;
}>();

const { t } = useI18n();

function revertRevisionUrl(newRevId: number): string {
  const match = props.wiki.match(/^(\w+)wiki$/);
  const base = match ? `https://${match[1]}.wikipedia.org` : `https://${props.wiki}`;
  return `${base}/w/index.php?diff=${newRevId}`;
}

const checking = ref(false);
const eligibility = ref<RevertCheckResponse | null>(null);
const reverting = ref(false);
const revertResult = ref<RevertResponse | null>(null);

async function checkEligibility() {
  checking.value = true;
  eligibility.value = null;
  revertResult.value = null;
  try {
    const res = await fetch(
      `/api/revert/check/${encodeURIComponent(props.wiki)}/${props.revId}`,
      { credentials: "include" },
    );
    if (res.ok) {
      eligibility.value = await res.json();
    }
  } catch {
    // API unavailable
  } finally {
    checking.value = false;
  }
}

async function doRevert() {
  reverting.value = true;
  revertResult.value = null;
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
    <CdxMessage
      v-else-if="revertResult?.success"
      type="success"
    >
      {{ t("Message-RevertSuccess") }}
      <template v-if="revertResult.newRevId">
        (<a
          :href="revertRevisionUrl(revertResult.newRevId)"
          target="_blank"
          rel="noopener"
        >rev {{ revertResult.newRevId }}</a>)
      </template>
    </CdxMessage>

    <!-- Revert failed -->
    <CdxMessage
      v-else-if="revertResult && !revertResult.success"
      type="error"
    >
      {{ t("Message-RevertFailed") }}: {{ revertResult.error }}
    </CdxMessage>

    <!-- Eligible: show revert button -->
    <template v-else-if="eligibility?.eligible">
      <CdxButton
        action="destructive"
        weight="primary"
        :disabled="reverting"
        @click="doRevert"
      >
        <template v-if="reverting">
          {{ t("Label-Reverting") }}
        </template>
        <template v-else-if="eligibility.consecutiveRevIds && eligibility.consecutiveRevIds.length > 1">
          {{ t("Button-DirectRevertMultiple", { count: eligibility.consecutiveRevIds.length, user: eligibility.consecutiveEditUser ?? revisionUser }) }}
        </template>
        <template v-else>
          {{ t("Button-DirectRevert") }}
        </template>
      </CdxButton>
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
</style>
