<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { CdxButton, CdxMessage } from "@wikimedia/codex";

const props = defineProps<{
  wiki: string;
  revId: number;
  revisionUser: string;
}>();

const { t } = useI18n();

// --- MW Thanks (notify) ---
const notifying = ref(false);
const notifyResult = ref<{ success: boolean; error?: string } | null>(null);

async function doNotifyThank() {
  notifying.value = true;
  notifyResult.value = null;
  try {
    const res = await fetch("/api/thank/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wiki: props.wiki, revId: props.revId }),
    });
    notifyResult.value = await res.json();
  } catch {
    notifyResult.value = { success: false, error: "Network error" };
  } finally {
    notifying.value = false;
  }
}

// --- Talk page thank ---
const talkPosting = ref(false);
const talkResult = ref<{ success: boolean; error?: string } | null>(null);
const talkPageExists = ref<boolean | null>(null); // null = still checking

async function doTalkPageThank() {
  talkPosting.value = true;
  talkResult.value = null;
  try {
    const res = await fetch("/api/thank/talkpage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wiki: props.wiki, revId: props.revId }),
    });
    talkResult.value = await res.json();
  } catch {
    talkResult.value = { success: false, error: "Network error" };
  } finally {
    talkPosting.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await fetch(
      `/api/thank/talkpage-exists?wiki=${encodeURIComponent(props.wiki)}&user=${encodeURIComponent(props.revisionUser)}`,
      { credentials: "include" },
    );
    const data = await res.json();
    talkPageExists.value = !!data.exists;
  } catch {
    talkPageExists.value = false;
  }
});

// --- Helpers ---
function wikiBase(): string {
  const match = props.wiki.match(/^(\w+)wiki$/);
  return match ? `https://${match[1]}.wikipedia.org` : `https://${props.wiki}`;
}

function userUrl(): string {
  return `${wikiBase()}/wiki/User:${encodeURIComponent(props.revisionUser)}`;
}

function talkPageUrl(): string {
  return `${wikiBase()}/wiki/User_talk:${encodeURIComponent(props.revisionUser)}`;
}
</script>

<template>
  <div class="dc-thank-panel">
    <!-- Status messages row — full width -->
    <div v-if="notifyResult || talkResult" class="dc-thank-panel__messages">
      <CdxMessage v-if="notifyResult?.success" type="success">
        {{ t("Message-ThankNotifySuccess") }}
      </CdxMessage>
      <CdxMessage v-else-if="notifyResult && !notifyResult.success" type="error">
        {{ t("Message-ThankFailed") }}: {{ notifyResult.error }}
      </CdxMessage>

      <CdxMessage v-if="talkResult?.success" type="success">
        {{ t("Message-ThankTalkPageSuccess") }}
      </CdxMessage>
      <CdxMessage v-else-if="talkResult && !talkResult.success" type="error">
        {{ t("Message-ThankFailed") }}: {{ talkResult.error }}
      </CdxMessage>
    </div>

    <!-- Action buttons row — 12-col grid -->
    <div class="dc-thank-panel__actions">
      <div class="dc-thank-panel__col dc-thank-panel__col--btn">
        <CdxButton
          v-if="!notifyResult"
          action="progressive"
          weight="primary"
          :disabled="notifying"
          class="dc-thank-panel__btn"
          @click="doNotifyThank"
        >
          <template v-if="notifying">{{ t("Label-Thanking") }}</template>
          <template v-else>{{ t("Button-ThankAuthor", { user: revisionUser }) }}</template>
        </CdxButton>
      </div>

      <div class="dc-thank-panel__col dc-thank-panel__col--btn">
        <CdxButton
          v-if="!talkResult"
          action="progressive"
          weight="quiet"
          :disabled="talkPosting || talkPageExists === false"
          :title="talkPageExists === false ? t('Message-NoTalkPage') : ''"
          class="dc-thank-panel__btn"
          @click="doTalkPageThank"
        >
          <template v-if="talkPosting">{{ t("Label-PostingTalkPage") }}</template>
          <template v-else>{{ t("Button-ThankOnTalkPage") }}</template>
        </CdxButton>
      </div>

      <div class="dc-thank-panel__col dc-thank-panel__col--links">
        <a
          v-if="!notifyResult && !talkResult"
          :href="userUrl()"
          target="_blank"
          rel="noopener"
          class="dc-thank-panel__user-link"
        >{{ t("Label-ViewUserPage") }}</a>

        <a
          v-if="talkPageExists && !talkResult"
          :href="talkPageUrl()"
          target="_blank"
          rel="noopener"
          class="dc-thank-panel__user-link"
        >{{ t("Label-ViewTalkPage") }}</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dc-thank-panel {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.dc-thank-panel__messages {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.dc-thank-panel__actions {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

.dc-thank-panel__col--btn {
  grid-column: span 4;
}

.dc-thank-panel__col--links {
  grid-column: span 4;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dc-thank-panel__btn {
  width: 100%;
}

.dc-thank-panel__user-link {
  font-size: 0.85rem;
  color: var(--color-progressive);
  text-decoration: none;
  white-space: nowrap;
}

.dc-thank-panel__user-link:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .dc-thank-panel__actions {
    grid-template-columns: repeat(12, 1fr);
  }

  .dc-thank-panel__col--btn {
    grid-column: span 6;
  }

  .dc-thank-panel__col--links {
    grid-column: span 12;
  }
}
</style>
