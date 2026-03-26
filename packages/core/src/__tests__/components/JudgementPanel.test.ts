import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import JudgementPanel from "../../components/JudgementPanel.vue";
import { withI18n } from "../helpers.js";

describe("JudgementPanel", () => {
  const tallies = { ShouldRevert: 5, NotSure: 2, LooksGood: 10 } as const;

  it("shows tally counts for each action", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies },
      ...withI18n(),
    });

    expect(wrapper.text()).toContain("5");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("10");
  });

  it("renders with userAction prop", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies, userAction: "LooksGood" },
      ...withI18n(),
    });

    expect(wrapper.text()).toContain("10");
  });

  it("does not crash with no userAction", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies },
      ...withI18n(),
    });

    expect(wrapper.html()).toBeTruthy();
  });

  it("handles zero tallies", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies: { ShouldRevert: 0, NotSure: 0, LooksGood: 0 } },
      ...withI18n(),
    });

    expect(wrapper.text()).toContain("0");
  });
});
