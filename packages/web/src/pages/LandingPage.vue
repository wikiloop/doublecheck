<script setup lang="ts">
import { onMounted } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import {
  cdxIconRobot,
  cdxIconUserGroup,
  cdxIconArticleSearch,
  cdxIconGlobe,
  cdxIconPuzzle,
  cdxIconCode,
  cdxIconLinkExternal,
} from "@wikimedia/codex-icons";

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
        <router-link
          to="/review"
          class="dc-hero__btn-link"
        >
          <CdxButton
            action="progressive"
            weight="primary"
            size="large"
            class="dc-hero__btn dc-hero__btn--primary"
          >
            <CdxIcon :icon="cdxIconArticleSearch" />
            Start Reviewing
          </CdxButton>
        </router-link>
      </div>
    </section>

    <!-- Features -->
    <section class="dc-features">
      <div class="dc-feature">
        <div class="dc-feature__icon">
          <CdxIcon :icon="cdxIconRobot" />
        </div>
        <h3>AI-Assisted Review</h3>
        <p>
          LiftWing (ORES) scores highlight edits most likely to be damaging, so
          reviewers focus on what matters.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          <CdxIcon :icon="cdxIconUserGroup" />
        </div>
        <h3>Community Judgement</h3>
        <p>
          Multiple reviewers judge each edit. Consensus-driven decisions improve
          quality and reduce bias.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          <CdxIcon :icon="cdxIconArticleSearch" />
        </div>
        <h3>Real-Time Feed</h3>
        <p>
          Live stream of recent edits with SSE updates. Never miss a potentially
          vandalized revision.
        </p>
      </div>
      <div class="dc-feature">
        <div class="dc-feature__icon">
          <CdxIcon :icon="cdxIconGlobe" />
        </div>
        <h3>Multi-Wiki Support</h3>
        <p>
          Review edits across dozens of Wikipedia language editions from one
          unified interface.
        </p>
      </div>
    </section>

    <!-- Use It -->
    <section class="dc-use">
      <h2>Use It</h2>
      <div class="dc-use__grid">
        <a
          href="https://doublecheck.toolforge.org"
          class="dc-use__card"
          target="_blank"
          rel="noopener"
        >
          <div class="dc-use__card-icon">
            <CdxIcon :icon="cdxIconLinkExternal" />
          </div>
          <div class="dc-use__card-text">
            <strong>Use on Toolforge</strong>
            <span>doublecheck.toolforge.org</span>
          </div>
        </a>
        <a
          href="https://doublecheck.wikiloop.org"
          class="dc-use__card"
          target="_blank"
          rel="noopener"
        >
          <div class="dc-use__card-icon">
            <CdxIcon :icon="cdxIconGlobe" />
          </div>
          <div class="dc-use__card-text">
            <strong>Use on wikiloop.org</strong>
            <span>doublecheck.wikiloop.org</span>
          </div>
        </a>
        <a
          href="https://chromewebstore.google.com/detail/wikiloop-doublecheck/efpakmfbfkbeoejabnbamnmpbmncippn"
          class="dc-use__card"
          target="_blank"
          rel="noopener"
        >
          <div class="dc-use__card-icon">
            <CdxIcon :icon="cdxIconPuzzle" />
          </div>
          <div class="dc-use__card-text">
            <strong>Chrome Extension</strong>
            <span>Install from Chrome Web Store</span>
          </div>
        </a>
        <a
          href="https://github.com/wikiloop/doublecheck/raw/master/packages/userscript/wikiloop-doublecheck.user.js"
          class="dc-use__card"
          target="_blank"
          rel="noopener"
        >
          <div class="dc-use__card-icon">
            <CdxIcon :icon="cdxIconCode" />
          </div>
          <div class="dc-use__card-text">
            <strong>Install UserScript</strong>
            <span>For Tampermonkey / Greasemonkey</span>
          </div>
        </a>
      </div>
    </section>

    <!-- How It Works -->
    <section class="dc-how">
      <h2>How It Works</h2>
      <div class="dc-how__steps">
        <div class="dc-how__step">
          <div class="dc-how__step-num">
            1
          </div>
          <p>A Wikipedia edit appears with its AI risk score.</p>
        </div>
        <div class="dc-how__step">
          <div class="dc-how__step-num">
            2
          </div>
          <p>
            You review the diff and judge: <strong>Should Revert</strong>,
            <strong>Not Sure</strong>, or <strong>Looks Good</strong>.
          </p>
        </div>
        <div class="dc-how__step">
          <div class="dc-how__step-num">
            3
          </div>
          <p>Community consensus drives quality across all Wikis.</p>
        </div>
      </div>
      <router-link
        to="/review"
        class="dc-how__cta-link"
      >
        <CdxButton
          action="progressive"
          weight="primary"
          size="large"
        >
          <CdxIcon :icon="cdxIconArticleSearch" />
          Start Reviewing
        </CdxButton>
      </router-link>
    </section>
  </div>
</template>

<style scoped>
.dc-landing {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Hero */
.dc-hero {
  text-align: center;
  padding: 4rem 1rem 3rem;
}

.dc-hero__logo {
  height: 96px;
  margin-bottom: 1.25rem;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08));
}

.dc-hero__title {
  font-size: 2.4rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  letter-spacing: -0.02em;
}

.dc-hero__subtitle {
  font-size: 1.2rem;
  color: var(--color-subtle);
  max-width: 560px;
  margin: 0 auto 2rem;
  line-height: 1.6;
}

.dc-hero__cta {
  display: flex;
  justify-content: center;
}

.dc-hero__btn-link {
  text-decoration: none;
}

.dc-hero__btn--primary {
  font-size: 1.1rem;
  padding: 0.75rem 2rem;
  gap: 0.5rem;
}

/* Features */
.dc-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  padding: 3rem 0;
  border-top: 1px solid var(--border-color-subtle);
}

.dc-feature {
  text-align: center;
  padding: 1.5rem 1rem;
  border-radius: 12px;
  transition: background 0.15s ease;
}

.dc-feature:hover {
  background: var(--background-color-interactive-subtle);
}

.dc-feature__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--background-color-progressive-subtle);
  color: var(--color-progressive);
  margin-bottom: 1rem;
}

.dc-feature__icon .cdx-icon {
  width: 24px;
  height: 24px;
}

.dc-feature h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.dc-feature p {
  font-size: 0.875rem;
  color: var(--color-subtle);
  margin: 0;
  line-height: 1.5;
}

/* Use It */
.dc-use {
  text-align: center;
  padding: 3rem 0;
  border-top: 1px solid var(--border-color-subtle);
}

.dc-use h2 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.dc-use__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  max-width: 640px;
  margin: 0 auto;
}

.dc-use__card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dc-use__card:hover {
  border-color: var(--border-color-progressive);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.dc-use__card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--background-color-neutral-subtle);
  color: var(--color-progressive);
  flex-shrink: 0;
}

.dc-use__card-text {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.dc-use__card-text strong {
  font-size: 0.95rem;
  font-weight: 600;
}

.dc-use__card-text span {
  font-size: 0.8rem;
  color: var(--color-subtle);
  margin-top: 0.15rem;
}

/* How It Works */
.dc-how {
  text-align: center;
  padding: 3rem 0 4rem;
  border-top: 1px solid var(--border-color-subtle);
}

.dc-how h2 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 2rem;
}

.dc-how__steps {
  display: flex;
  gap: 2rem;
  justify-content: center;
  max-width: 720px;
  margin: 0 auto 2rem;
}

.dc-how__step {
  flex: 1;
  text-align: center;
}

.dc-how__step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-progressive);
  color: var(--color-inverted);
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.dc-how__step p {
  font-size: 0.9rem;
  color: var(--color-subtle);
  margin: 0;
  line-height: 1.5;
}

.dc-how__cta-link {
  text-decoration: none;
}

/* Responsive */
@media (max-width: 768px) {
  .dc-features {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .dc-use__grid {
    grid-template-columns: 1fr;
  }

  .dc-how__steps {
    flex-direction: column;
    gap: 1.25rem;
  }

  .dc-hero__title {
    font-size: 1.8rem;
  }
}

@media (max-width: 480px) {
  .dc-features {
    grid-template-columns: 1fr;
  }

  .dc-hero {
    padding: 2.5rem 0.5rem 2rem;
  }
}
</style>
