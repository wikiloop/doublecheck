<script setup lang="ts">
import { ref, watch } from "vue";
import { performRevert, performWarn } from "../composables/useWikiAction.js";
import { fetchRevertCheck } from "../api.js";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
  title: string;
}>();

const checking = ref(false);
const eligible = ref<boolean | null>(null);
const eligibilityReason = ref("");
const baseRevId = ref<number | undefined>();

const reverting = ref(false);
const revertResult = ref<{ success: boolean; newRevId?: number; error?: string } | null>(null);
const reason = ref("");
const showReason = ref(false);

// Warn state
const warnState = ref<"idle" | "ready" | "posting" | "done" | "error">("idle");
const warnResult = ref<{ success: boolean; error?: string } | null>(null);
const warnLevel = ref("1");

async function checkEligibility() {
  checking.value = true;
  eligible.value = null;
  try {
    const data = await fetchRevertCheck(props.wiki, props.revId);
    eligible.value = data.eligible ?? false;
    eligibilityReason.value = data.reason ?? "";
    baseRevId.value = data.baseRevId;
  } catch {
    eligible.value = true; // Allow attempt if check fails
  } finally {
    checking.value = false;
  }
}

async function doRevert(mode: "vandalism" | "goodfaith") {
  reverting.value = true;
  revertResult.value = null;
  revertResult.value = await performRevert(
    props.wiki,
    props.revId,
    baseRevId.value,
    mode,
    reason.value.trim() || undefined,
  );
  reverting.value = false;
}

async function doWarn() {
  warnState.value = "posting";
  warnResult.value = await performWarn(
    props.wiki,
    props.revisionUser,
    warnLevel.value,
    props.title,
  );
  warnState.value = warnResult.value.success ? "done" : "error";
}

watch(() => [props.wiki, props.revId], checkEligibility, { immediate: true });
</script>

<template>
  <div class="dc-revert-panel">
    <!-- Checking eligibility -->
    <div v-if="checking" class="dc-revert-panel__status">
      Checking revert eligibility...
    </div>

    <!-- Revert succeeded -->
    <template v-else-if="revertResult?.success">
      <div class="dc-revert-panel__success">
        Reverted successfully!
        <a
          v-if="revertResult.newRevId"
          :href="`/w/index.php?diff=${revertResult.newRevId}`"
          target="_blank"
        >
          View diff (rev {{ revertResult.newRevId }})
        </a>
      </div>

      <!-- Warn after successful revert -->
      <div v-if="warnState === 'idle'" class="dc-revert-panel__warn">
        <button class="dc-btn dc-btn--warn" @click="warnState = 'ready'">
          Warn {{ revisionUser }}
        </button>
      </div>
      <div v-else-if="warnState === 'ready'" class="dc-revert-panel__warn">
        <label>Level:
          <select v-model="warnLevel">
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="4im">Level 4im</option>
          </select>
        </label>
        <button class="dc-btn dc-btn--warn" @click="doWarn">Post Warning</button>
      </div>
      <div v-else-if="warnState === 'posting'" class="dc-revert-panel__status">
        Posting warning...
      </div>
      <div v-else-if="warnState === 'done'" class="dc-revert-panel__success">
        Warning posted to {{ revisionUser }}'s talk page.
      </div>
      <div v-else-if="warnState === 'error'" class="dc-revert-panel__error">
        Warning failed: {{ warnResult?.error }}
      </div>
    </template>

    <!-- Revert failed -->
    <div v-else-if="revertResult && !revertResult.success" class="dc-revert-panel__error">
      Revert failed: {{ revertResult.error }}
    </div>

    <!-- Eligible: show revert buttons -->
    <template v-else-if="eligible">
      <div class="dc-revert-panel__actions">
        <button
          class="dc-btn dc-btn--revert"
          :disabled="reverting"
          @click="doRevert('vandalism')"
        >
          {{ reverting ? 'Reverting...' : 'Revert (vandalism)' }}
        </button>
        <button
          class="dc-btn dc-btn--goodfaith"
          :disabled="reverting"
          @click="doRevert('goodfaith')"
        >
          {{ reverting ? 'Reverting...' : 'Revert (good faith)' }}
        </button>
        <button
          class="dc-revert-panel__reason-toggle"
          @click="showReason = !showReason"
        >
          {{ showReason ? 'Hide reason' : 'Add reason' }}
        </button>
      </div>
      <input
        v-if="showReason"
        v-model="reason"
        class="dc-revert-panel__reason-input"
        placeholder="Custom revert reason (optional)"
      >
    </template>

    <!-- Not eligible -->
    <div v-else-if="eligible === false" class="dc-revert-panel__status">
      {{ eligibilityReason || 'Revert not available for this revision.' }}
    </div>
  </div>
</template>

<style scoped>
.dc-revert-panel {
  padding: 8px 0;
}

.dc-revert-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dc-btn {
  padding: 8px 16px;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
}

.dc-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dc-btn--revert {
  background: #d33;
  color: #fff;
  border-color: #d33;
}

.dc-btn--revert:hover:not(:disabled) {
  background: #b32424;
}

.dc-btn--goodfaith {
  background: #fff;
  color: #36c;
  border-color: #36c;
}

.dc-btn--goodfaith:hover:not(:disabled) {
  background: #eaf3ff;
}

.dc-btn--warn {
  background: #fc3;
  color: #202122;
  border-color: #ac6600;
}

.dc-revert-panel__reason-toggle {
  background: none;
  border: none;
  color: #36c;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
  padding: 0;
}

.dc-revert-panel__reason-input {
  display: block;
  width: 100%;
  max-width: 400px;
  margin-top: 8px;
  padding: 6px 8px;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.dc-revert-panel__status {
  color: #54595d;
  font-style: italic;
  font-size: 13px;
}

.dc-revert-panel__success {
  color: #14866d;
  font-weight: 500;
  font-size: 13px;
}

.dc-revert-panel__error {
  color: #d33;
  font-size: 13px;
}

.dc-revert-panel__warn {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dc-revert-panel__warn select {
  padding: 4px 8px;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  font-size: 13px;
}
</style>
