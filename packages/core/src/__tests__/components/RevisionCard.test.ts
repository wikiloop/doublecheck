import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RevisionCard from "../../components/RevisionCard.vue";
import type { Revision, LiftWingScore } from "../../types/index.js";

const mockRevision: Revision = {
  wiki: "enwiki",
  revId: 12345,
  parentRevId: 12344,
  title: "Test Article",
  timestamp: "2024-01-15T10:30:00Z",
  user: "TestUser",
  comment: "Fixed typo",
  pageId: 999,
};

const mockScore: LiftWingScore = {
  damaging: 0.85,
  goodfaith: 0.12,
};

describe("RevisionCard", () => {
  it("renders revision metadata", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision },
    });

    expect(wrapper.text()).toContain("enwiki");
    expect(wrapper.text()).toContain("Test Article");
    expect(wrapper.text()).toContain("TestUser");
    expect(wrapper.text()).toContain("Fixed typo");
  });

  it("renders LiftWing scores as progress bars", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision, liftWingScore: mockScore },
    });

    expect(wrapper.text()).toContain("85.0%"); // damaging
    expect(wrapper.text()).toContain("88.0%"); // bad faith = 1 - 0.12
    expect(wrapper.find(".dc-score__fill--damaging").exists()).toBe(true);
    expect(wrapper.find(".dc-score__fill--badfaith").exists()).toBe(true);
  });

  it("does not render scores when liftWingScore is not provided", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision },
    });

    expect(wrapper.find(".dc-revision-card__scores").exists()).toBe(false);
  });

  it("shows loading skeleton when loading=true", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision, loading: true },
    });

    expect(wrapper.find(".dc-revision-card__skeleton").exists()).toBe(true);
    expect(wrapper.find(".dc-revision-card__header").exists()).toBe(false);
  });
});
