<script setup lang="ts">
import { onMounted } from "vue";
import { CdxButton } from "@wikimedia/codex";

onMounted(() => {
  // SEO: JSON-LD structured data
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "WikiLoop DoubleCheck",
    url: "https://doublecheck.wikiloop.org",
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web",
    description:
      "Community tool for reviewing Wikipedia edits using AI-assisted scoring and human judgement.",
  });
  document.head.appendChild(script);
});
</script>

<template>
  <div class="dc-landing">
    <!-- Hero -->
    <section class="dc-hero">
      <img
        src="/wikiloop-doublecheck-logo.svg"
        alt="WikiLoop DoubleCheck"
        class="dc-hero__logo"
      >
      <h1 class="dc-hero__title">
        WikiLoop DoubleCheck
      </h1>
      <p class="dc-hero__subtitle">
        Community tool for reviewing Wikipedia edits using AI-assisted scoring
        and human judgement.
      </p>
      <div class="dc-hero__cta">
        <CdxButton
          action="progressive"
          weight="primary"
          size="large"
          :href="'https://doublecheck.toolforge.org'"
          class="dc-hero__btn"
        >
          Use on Toolforge
        </CdxButton>
        <CdxButton
          weight="normal"
          size="large"
          :href="'https://doublecheck.wikiloop.org'"
          class="dc-hero__btn"
        >
          Use on wikiloop.org
        </CdxButton>
      </div>
    </section>

    <!-- Features -->
    <section class="dc-features">
      <div class="dc-feature">
        <div class="dc-feature__icon">
          &#128270;
        </div>
        <h3>AI-Assisted Review</h3>
        <p>
          LiftWing (ORES) scores highlight edits most likely to be damaging, so
          reviewers focus on what matters.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          &#128101;
        </div>
        <h3>Community Judgement</h3>
        <p>
          Multiple reviewers judge each edit. Consensus-driven decisions improve
          quality and reduce bias.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          &#9889;
        </div>
        <h3>Real-Time Feed</h3>
        <p>
          Live stream of recent edits with SSE updates. Never miss a potentially
          vandalized revision.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          &#127760;
        </div>
        <h3>Multi-Wiki Support</h3>
        <p>
          Review edits across dozens of Wikipedia language editions from one
          unified interface.
        </p>
      </div>
    </section>

    <!-- Extension links -->
    <section class="dc-extensions">
      <h2>Additional Tools</h2>
      <div class="dc-extensions__links">
        <a
          href="#"
          class="dc-extension-link"
        >
          Install UserScript
        </a>
        <a
          href="#"
          class="dc-extension-link"
        >
          Chrome Extension
        </a>
      </div>
    </section>

    <!-- Preview -->
    <section class="dc-preview">
      <h2>How It Works</h2>
      <div class="dc-preview__card">
        <p>
          1. A Wikipedia edit appears with its AI risk score.<br>
          2. You review the diff and judge: <strong>Should Revert</strong>,
          <strong>Not Sure</strong>, or <strong>Looks Good</strong>.<br>
          3. Community consensus drives quality across all Wikis.
        </p>
        <router-link to="/review">
          <CdxButton
            action="progressive"
            weight="primary"
          >
            Start Reviewing
          </CdxButton>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dc-landing {
  max-width: 900px;
  margin: 0 auto;
}

.dc-hero {
  text-align: center;
  padding: 3rem 1rem;
}

.dc-hero__logo {
  height: 80px;
  margin-bottom: 1rem;
}

.dc-hero__title {
  font-size: 2rem;
  margin: 0 0 0.5rem;
}

.dc-hero__subtitle {
  font-size: 1.15rem;
  color: var(--color-subtle);
  max-width: 600px;
  margin: 0 auto 1.5rem;
}

.dc-hero__cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.dc-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 2rem 0;
}

.dc-feature {
  text-align: center;
  padding: 1rem;
}

.dc-feature__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.dc-feature h3 {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}

.dc-feature p {
  font-size: 0.9rem;
  color: var(--color-subtle);
  margin: 0;
}

.dc-extensions {
  text-align: center;
  padding: 2rem 0;
  border-top: 1px solid var(--background-color-neutral);
}

.dc-extensions h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
}

.dc-extensions__links {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.dc-extension-link {
  color: var(--color-progressive);
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
}

.dc-extension-link:hover {
  background: var(--background-color-neutral);
}

.dc-preview {
  text-align: center;
  padding: 2rem 0;
  border-top: 1px solid var(--background-color-neutral);
}

.dc-preview h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
}

.dc-preview__card {
  background: var(--background-color-neutral-subtle);
  border: 1px solid var(--border-color-subtle);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: left;
  max-width: 600px;
  margin: 0 auto;
}

.dc-preview__card p {
  margin: 0 0 1rem;
  line-height: 1.7;
}
</style>
