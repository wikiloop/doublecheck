import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/vue";
import { createRouter, createWebHistory } from "vue-router";
import { createI18n } from "vue-i18n";
import LandingPage from "../../pages/LandingPage.vue";
import en from "../../i18n/en.json";

function createTestPlugins() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/", component: { template: "<div />" } }, { path: "/review", component: { template: "<div />" } }],
  });

  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en },
  });

  return { router, i18n };
}

describe("LandingPage", () => {
  it("renders the project title", () => {
    const { router, i18n } = createTestPlugins();
    render(LandingPage, {
      global: { plugins: [router, i18n] },
    });
    expect(screen.getByText("WikiLoop DoubleCheck")).toBeTruthy();
  });

  it("renders the project description", () => {
    const { router, i18n } = createTestPlugins();
    render(LandingPage, {
      global: { plugins: [router, i18n] },
    });
    expect(
      screen.getByText(/Community tool for reviewing Wikipedia edits/)
    ).toBeTruthy();
  });

  it("renders CTA buttons", () => {
    const { router, i18n } = createTestPlugins();
    render(LandingPage, {
      global: { plugins: [router, i18n] },
    });
    expect(screen.getByText("Use on Toolforge")).toBeTruthy();
    expect(screen.getByText("Use on wikiloop.org")).toBeTruthy();
  });

  it("renders feature sections", () => {
    const { router, i18n } = createTestPlugins();
    render(LandingPage, {
      global: { plugins: [router, i18n] },
    });
    expect(screen.getByText("AI-Assisted Review")).toBeTruthy();
    expect(screen.getByText("Community Judgement")).toBeTruthy();
    expect(screen.getByText("Real-Time Feed")).toBeTruthy();
    expect(screen.getByText("Multi-Wiki Support")).toBeTruthy();
  });

  it("renders Start Reviewing link", () => {
    const { router, i18n } = createTestPlugins();
    render(LandingPage, {
      global: { plugins: [router, i18n] },
    });
    expect(screen.getByText("Start Reviewing")).toBeTruthy();
  });
});
