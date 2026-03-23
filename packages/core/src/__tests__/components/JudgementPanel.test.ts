import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import JudgementPanel from "../../components/JudgementPanel.vue";

describe("JudgementPanel", () => {
  const tallies = {
    ShouldRevert: 5,
    NotSure: 2,
    LooksGood: 10,
  } as const;

  it("shows tally counts for each action", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies },
    });

    expect(wrapper.text()).toContain("5");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("10");
    expect(wrapper.text()).toContain("Should Revert");
    expect(wrapper.text()).toContain("Not Sure");
    expect(wrapper.text()).toContain("Looks Good");
  });

  it("highlights the user action", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies, userAction: "LooksGood" },
    });

    const userTally = wrapper.find('[data-action="LooksGood"]');
    expect(userTally.classes()).toContain("dc-tally--user");
  });

  it("does not highlight when no userAction", () => {
    const wrapper = mount(JudgementPanel, {
      props: { tallies },
    });

    const items = wrapper.findAll(".dc-tally");
    items.forEach((item) => {
      expect(item.classes()).not.toContain("dc-tally--user");
    });
  });

  it("handles zero tallies", () => {
    const wrapper = mount(JudgementPanel, {
      props: {
        tallies: { ShouldRevert: 0, NotSure: 0, LooksGood: 0 },
      },
    });

    const counts = wrapper.findAll(".dc-tally__count");
    counts.forEach((count) => {
      expect(count.text()).toBe("0");
    });
  });
});
