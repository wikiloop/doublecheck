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

    expect(wrapper.text()).toContain("Test Article");
    expect(wrapper.text()).toContain("TestUser");
  });

  it("renders LiftWing scores when provided", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision, liftWingScore: mockScore },
    });

    expect(wrapper.text()).toContain("85%");
  });

  it("does not crash without scores", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision },
    });

    expect(wrapper.html()).toBeTruthy();
  });

  it("renders with loading state", () => {
    const wrapper = mount(RevisionCard, {
      props: { revision: mockRevision, loading: true },
    });

    expect(wrapper.html()).toBeTruthy();
  });
});
