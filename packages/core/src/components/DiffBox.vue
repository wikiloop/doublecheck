<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import { ref, computed, watch, onMounted } from "vue";

const props = defineProps<{
  diffHtml: string;
  loading?: boolean;
  wiki?: string;
  revId?: number;
  parentRevId?: number;
}>();

type DiffMode = "wikitext" | "visual";
const diffMode = ref<DiffMode>("visual");
const visualHtml = ref("");
const visualLoading = ref(false);
const visualError = ref(false);

function mwApiUrl(wiki: string): string {
  const match = wiki.match(/^(\w+)wiki$/);
  if (match) return `https://${match[1]}.wikipedia.org/w/api.php`;
  return `https://${wiki}/w/api.php`;
}

function mwBaseUrl(wiki: string): string {
  const match = wiki.match(/^(\w+)wiki$/);
  if (match) return `https://${match[1]}.wikipedia.org`;
  return `https://${wiki}`;
}

// Load Wikipedia's diff and content styles
const mwStylesLoaded = ref(false);
function loadMwStyles(wiki: string) {
  if (mwStylesLoaded.value) return;
  const base = mwBaseUrl(wiki);
  const modules = "mediawiki.diff.styles|ext.cite.styles|mediawiki.skinning.content";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${base}/w/load.php?modules=${modules}&only=styles`;
  document.head.appendChild(link);
  mwStylesLoaded.value = true;
}

async function fetchVisualDiff() {
  if (!props.wiki || !props.revId) return;
  visualLoading.value = true;
  visualError.value = false;
  visualHtml.value = "";
  try {
    const url = new URL(mwApiUrl(props.wiki));
    url.searchParams.set("action", "compare");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("origin", "*");
    url.searchParams.set("torev", String(props.revId));
    url.searchParams.set("prop", "diff");
    // Use inline difftype for visual rendering
    url.searchParams.set("difftype", "inline");
    if (props.parentRevId && props.parentRevId > 0) {
      url.searchParams.set("fromrev", String(props.parentRevId));
    } else {
      url.searchParams.set("fromslots", "main");
      url.searchParams.set("fromcontentmodel", "wikitext");
      url.searchParams.set("fromtext", "");
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const body = data?.compare?.body ?? "";
      if (body) {
        // Wrap in table structure — API returns <tr> rows
        visualHtml.value = `<table class="diff diff-contentalign-ltr"><tbody>${body}</tbody></table>`;
        loadMwStyles(props.wiki!);
      } else {
        visualError.value = true;
      }
    } else {
      visualError.value = true;
    }
  } catch {
    visualError.value = true;
  } finally {
    visualLoading.value = false;
  }
}

const showVisual = computed(() => diffMode.value === "visual" && !visualError.value);

// Fetch visual diff when toggled on or revision changes
watch(
  () => [diffMode.value, props.revId],
  () => {
    if (diffMode.value === "visual" && !visualHtml.value) {
      fetchVisualDiff();
    }
  },
  { immediate: true },
);

// Reset visual diff when revision changes
watch(
  () => props.revId,
  () => {
    visualHtml.value = "";
    visualError.value = false;
    if (diffMode.value === "visual") {
      fetchVisualDiff();
    }
  },
);
</script>

<template>
  <div class="dc-diff-box">
    <div
      v-if="wiki"
      class="dc-diff-box__toggle"
    >
      <button
        :class="['dc-diff-box__toggle-btn', { 'dc-diff-box__toggle-btn--active': diffMode === 'visual' }]"
        @click="diffMode = 'visual'"
      >
        Visual diff
      </button>
      <button
        :class="['dc-diff-box__toggle-btn', { 'dc-diff-box__toggle-btn--active': diffMode === 'wikitext' }]"
        @click="diffMode = 'wikitext'"
      >
        Wikitext diff
      </button>
    </div>

    <div
      v-if="loading || (showVisual && visualLoading)"
      class="dc-diff-box__loading"
    >
      Loading diff...
    </div>
    <div
      v-else-if="showVisual && visualHtml"
      class="dc-diff-box__content dc-diff-box__content--visual"
      v-html="visualHtml"
    />
    <div
      v-else-if="diffHtml"
      class="dc-diff-box__content"
      v-html="diffHtml"
    />
    <div
      v-else
      class="dc-diff-box__empty"
    >
      No diff available
    </div>
  </div>
</template>

<style scoped>
.dc-diff-box {
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  padding: 1rem;
  background: var(--background-color-base);
  overflow-x: auto;
}

.dc-diff-box__toggle {
  display: flex;
  gap: 0;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
}

.dc-diff-box__toggle-btn {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  border: none;
  background: var(--background-color-base);
  color: var(--color-base);
  cursor: pointer;
}

.dc-diff-box__toggle-btn:not(:last-child) {
  border-right: 1px solid var(--border-color-subtle);
}

.dc-diff-box__toggle-btn--active {
  background: var(--background-color-progressive-subtle);
  color: var(--color-progressive);
  font-weight: bold;
}

.dc-diff-box__loading,
.dc-diff-box__empty {
  color: var(--color-placeholder);
  font-style: italic;
}

.dc-diff-box__content :deep(ins) {
  background: #a3d3a3;
  text-decoration: none;
}

.dc-diff-box__content :deep(del) {
  background: #e88e8e;
  text-decoration: none;
}

/* MediaWiki action=compare diff table styles — match Wikipedia */
.dc-diff-box__content :deep(.diff) {
  width: 100%;
  border-collapse: collapse;
  border: none;
  font-size: 0.875em;
}

.dc-diff-box__content :deep(.diff col.diff-marker) {
  width: 2%;
}

.dc-diff-box__content :deep(.diff col.diff-content) {
  width: 48%;
}

.dc-diff-box__content :deep(.diff td) {
  padding: 0.33em 0.66em;
  font-family: monospace, monospace;
  font-size: inherit;
  vertical-align: top;
  white-space: pre-wrap;
  word-wrap: break-word;
  border: none;
}

.dc-diff-box__content :deep(.diff-addedline) {
  background: #cfc;
  border-color: #9f9;
}

.dc-diff-box__content :deep(.diff-deletedline) {
  background: #ffc;
  border-color: #ff9;
}

.dc-diff-box__content :deep(.diff-addedline .diffchange),
.dc-diff-box__content :deep(.diff-deletedline .diffchange) {
  font-weight: bold;
}

.dc-diff-box__content :deep(.diff-addedline .diffchange) {
  background: #9f9;
}

.dc-diff-box__content :deep(.diff-deletedline .diffchange) {
  background: #ff9;
}

.dc-diff-box__content :deep(.diff-context) {
  background: #f9f9f9;
  color: #333;
}

.dc-diff-box__content :deep(td.diff-marker) {
  text-align: right;
  font-weight: bold;
  font-size: 1.25em;
  line-height: 1;
  user-select: none;
  padding-right: 0.5em;
}

.dc-diff-box__content :deep(td.diff-marker::before) {
  content: none;
}

.dc-diff-box__content :deep(td.diff-lineno) {
  font-weight: bold;
  background: #f0f0f0;
  border-bottom: 1px solid #bbb;
  padding: 0.25em 0.66em;
  text-align: right;
  color: #666;
}

/* Visual/inline diff styles — match Wikipedia's inline diff */
.dc-diff-box__content--visual :deep(.mw-diff-inline-added) {
  background: #cfc;
  font-weight: bold;
}

.dc-diff-box__content--visual :deep(.mw-diff-inline-deleted) {
  background: #ffc;
  text-decoration: line-through;
}

.dc-diff-box__content--visual :deep(.mw-diff-inline-moved) {
  background: #fff3cd;
}

.dc-diff-box__content--visual :deep(.mw-diff-inline-changed) {
  background: #eaf3ff;
}

/* Wikipedia content rendering within visual diff */
.dc-diff-box__content--visual :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

.dc-diff-box__content--visual :deep(h1),
.dc-diff-box__content--visual :deep(h2),
.dc-diff-box__content--visual :deep(h3),
.dc-diff-box__content--visual :deep(h4) {
  font-family: 'Linux Libertine', 'Georgia', 'Times', serif;
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 0.25em;
  margin-top: 1em;
}

.dc-diff-box__content--visual :deep(a) {
  color: #0645ad;
  text-decoration: none;
}

.dc-diff-box__content--visual :deep(a:hover) {
  text-decoration: underline;
}
</style>
