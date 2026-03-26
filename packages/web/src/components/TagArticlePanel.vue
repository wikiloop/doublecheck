<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { CdxButton, CdxMessage, CdxCheckbox } from "@wikimedia/codex";
import { useAuth } from "../composables/useAuth";

const props = defineProps<{
  wiki: string;
  title: string;
}>();

const { t } = useI18n();
const { isLoggedIn } = useAuth();

const TAG_OPTIONS = [
  { key: "unreferenced", labelKey: "Tag-Unreferenced" },
  { key: "refimprove", labelKey: "Tag-Refimprove" },
  { key: "POV", labelKey: "Tag-POV" },
  { key: "cleanup", labelKey: "Tag-Cleanup" },
  { key: "original research", labelKey: "Tag-OriginalResearch" },
  { key: "notability", labelKey: "Tag-Notability" },
] as const;

const selectedTags = ref<Set<string>>(new Set());
const submitting = ref(false);
const result = ref<{ success: boolean; error?: string } | null>(null);

const hasSelection = computed(() => selectedTags.value.size > 0);

function toggleTag(key: string) {
  const s = new Set(selectedTags.value);
  if (s.has(key)) {
    s.delete(key);
  } else {
    s.add(key);
  }
  selectedTags.value = s;
}

function isSelected(key: string): boolean {
  return selectedTags.value.has(key);
}

async function submitTags() {
  if (!hasSelection.value || submitting.value) return;
  submitting.value = true;
  result.value = null;

  try {
    const res = await fetch("/api/tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        wiki: props.wiki,
        title: props.title,
        tags: [...selectedTags.value],
      }),
    });
    result.value = await res.json();
    if (result.value?.success) {
      selectedTags.value = new Set();
    }
  } catch {
    result.value = { success: false, error: "Network error" };
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="isLoggedIn"
    class="dc-tag-panel"
  >
    <div class="dc-tag-panel__label">
      {{ t("Label-SelectTags") }}
    </div>

    <div class="dc-tag-panel__options">
      <CdxCheckbox
        v-for="opt in TAG_OPTIONS"
        :key="opt.key"
        :model-value="isSelected(opt.key)"
        :inline="true"
        @update:model-value="toggleTag(opt.key)"
      >
        {{ t(opt.labelKey) }}
      </CdxCheckbox>
    </div>

    <div class="dc-tag-panel__actions">
      <CdxButton
        action="progressive"
        weight="primary"
        :disabled="!hasSelection || submitting"
        @click="submitTags"
      >
        <template v-if="submitting">{{ t("Label-Tagging") }}</template>
        <template v-else>{{ t("Button-TagArticle") }}</template>
      </CdxButton>
    </div>

    <div
      v-if="result"
      class="dc-tag-panel__messages"
    >
      <CdxMessage
        v-if="result.success"
        type="success"
      >
        {{ t("Message-TagSuccess") }}
      </CdxMessage>
      <CdxMessage
        v-else
        type="error"
      >
        {{ t("Message-TagFailed") }}: {{ result.error }}
      </CdxMessage>
    </div>
  </div>
</template>

<style scoped>
.dc-tag-panel {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.dc-tag-panel__label {
  font-weight: 600;
  font-size: 0.9rem;
}

.dc-tag-panel__options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.dc-tag-panel__actions {
  display: flex;
  gap: 0.5rem;
}

.dc-tag-panel__messages {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
