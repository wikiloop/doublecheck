<script setup lang="ts">
import { ref } from "vue";
import { performThank } from "../composables/useWikiAction.js";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
}>();

const thanking = ref(false);
const thankResult = ref<{ success: boolean; error?: string } | null>(null);

async function doThank() {
  thanking.value = true;
  thankResult.value = null;
  thankResult.value = await performThank(props.wiki, props.revId);
  thanking.value = false;
}
</script>

<template>
  <div class="dc-thank-panel">
    <div v-if="thankResult?.success" class="dc-thank-panel__success">
      Thanks sent to {{ revisionUser }}!
    </div>
    <div v-else-if="thankResult && !thankResult.success" class="dc-thank-panel__error">
      Thank failed: {{ thankResult.error }}
    </div>
    <div v-else class="dc-thank-panel__actions">
      <button
        class="dc-btn dc-btn--thank"
        :disabled="thanking"
        @click="doThank"
      >
        {{ thanking ? 'Sending...' : `Thank ${revisionUser}` }}
      </button>
      <a
        :href="`/wiki/User:${encodeURIComponent(revisionUser)}`"
        target="_blank"
        class="dc-thank-panel__link"
      >
        View user page
      </a>
      <a
        :href="`/wiki/User_talk:${encodeURIComponent(revisionUser)}`"
        target="_blank"
        class="dc-thank-panel__link"
      >
        Talk page
      </a>
    </div>
  </div>
</template>

<style scoped>
.dc-thank-panel {
  padding: 8px 0;
}

.dc-thank-panel__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dc-btn--thank {
  padding: 8px 16px;
  border: 1px solid #14866d;
  border-radius: 4px;
  background: #14866d;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
}

.dc-btn--thank:hover:not(:disabled) {
  background: #0e6d58;
}

.dc-btn--thank:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dc-thank-panel__link {
  font-size: 13px;
  color: #36c;
}

.dc-thank-panel__success {
  color: #14866d;
  font-weight: 500;
  font-size: 13px;
}

.dc-thank-panel__error {
  color: #d33;
  font-size: 13px;
}
</style>
