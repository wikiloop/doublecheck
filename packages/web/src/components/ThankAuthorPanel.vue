<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { CdxButton, CdxMessage } from "@wikimedia/codex";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
}>();

const { t } = useI18n();

const thanking = ref(false);
const thankResult = ref<{ success: boolean; error?: string } | null>(null);

function userUrl(): string {
  const match = props.wiki.match(/^(\w+)wiki$/);
  const base = match ? `https://${match[1]}.wikipedia.org` : `https://${props.wiki}`;
  return `${base}/wiki/User:${encodeURIComponent(props.revisionUser)}`;
}

async function doThank() {
  thanking.value = true;
  thankResult.value = null;
  try {
    const res = await fetch("/api/thank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wiki: props.wiki, revId: props.revId }),
    });
    thankResult.value = await res.json();
  } catch {
    thankResult.value = { success: false, error: "Network error" };
  } finally {
    thanking.value = false;
  }
}
</script>

<template>
  <div class="dc-thank-panel">
    <CdxMessage
      v-if="thankResult?.success"
      type="success"
    >
      {{ t("Message-ThankSuccess") }}
    </CdxMessage>

    <CdxMessage
      v-else-if="thankResult && !thankResult.success"
      type="error"
    >
      {{ t("Message-ThankFailed") }}: {{ thankResult.error }}
    </CdxMessage>

    <CdxButton
      v-else
      action="progressive"
      weight="primary"
      :disabled="thanking"
      @click="doThank"
    >
      <template v-if="thanking">
        {{ t("Label-Thanking") }}
      </template>
      <template v-else>
        {{ t("Button-ThankAuthor", { user: revisionUser }) }}
      </template>
    </CdxButton>

    <a
      v-if="!thankResult"
      :href="userUrl()"
      target="_blank"
      rel="noopener"
      class="dc-thank-panel__user-link"
    >{{ t("Label-ViewUserPage") }}</a>
  </div>
</template>

<style scoped>
.dc-thank-panel {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dc-thank-panel__user-link {
  font-size: 0.85rem;
  color: var(--color-progressive);
  text-decoration: none;
}

.dc-thank-panel__user-link:hover {
  text-decoration: underline;
}
</style>
