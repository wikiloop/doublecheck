<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CdxButton } from "@wikimedia/codex";

const props = defineProps<{
  title: string;
  comment: string;
}>();

const { t } = useI18n();

/** Build a Google search URL from the article title and edit summary. */
const searchUrl = computed(() => {
  // Start with the article title
  let query = props.title;
  // If the edit summary has useful keywords, append them (strip wikitext markup)
  if (props.comment) {
    const cleaned = props.comment
      .replace(/\/\*.*?\*\//g, "") // remove section links like /* Section */
      .replace(/\[\[|\]\]/g, "")   // remove wikilink brackets
      .trim();
    if (cleaned.length > 3) {
      query += ` ${cleaned}`;
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
});
</script>

<template>
  <div class="dc-search-panel">
    <CdxButton
      action="progressive"
      weight="primary"
      :href="searchUrl"
      target="_blank"
      rel="noopener"
      @click.stop
    >
      {{ t("Button-SearchGoogle") }}
    </CdxButton>
  </div>
</template>

<style scoped>
.dc-search-panel {
  margin-top: 0.5rem;
}
</style>
