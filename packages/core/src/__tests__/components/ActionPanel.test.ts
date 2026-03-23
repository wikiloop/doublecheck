import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ActionPanel from "../../components/ActionPanel.vue";

describe("ActionPanel", () => {
  it("renders three action buttons", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123 },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].text()).toBe("Should Revert");
    expect(buttons[1].text()).toBe("Not Sure");
    expect(buttons[2].text()).toBe("Looks Good");
  });

  it("emits judge event with correct action via onJudge listener", async () => {
    const onJudge = vi.fn();
    const wrapper = mount(ActionPanel, {
      props: {
        revisionWiki: "enwiki",
        revisionId: 123,
        onJudge,
      },
    });

    await wrapper.find('[data-action="LooksGood"]').trigger("click");
    expect(onJudge).toHaveBeenCalledWith("LooksGood");
  });

  it("emits ShouldRevert action", async () => {
    const onJudge = vi.fn();
    const wrapper = mount(ActionPanel, {
      props: {
        revisionWiki: "enwiki",
        revisionId: 123,
        onJudge,
      },
    });

    await wrapper.find('[data-action="ShouldRevert"]').trigger("click");
    expect(onJudge).toHaveBeenCalledWith("ShouldRevert");
  });

  it("disables buttons when disabled=true", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, disabled: true },
    });

    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("disabled")).toBeDefined();
    });
  });

  it("disables buttons when currentAction is set", () => {
    const wrapper = mount(ActionPanel, {
      props: {
        revisionWiki: "enwiki",
        revisionId: 123,
        currentAction: "LooksGood",
      },
    });

    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("disabled")).toBeDefined();
    });
  });

  it("highlights the current action", () => {
    const wrapper = mount(ActionPanel, {
      props: {
        revisionWiki: "enwiki",
        revisionId: 123,
        currentAction: "LooksGood",
      },
    });

    const activeBtn = wrapper.find('[data-action="LooksGood"]');
    expect(activeBtn.classes()).toContain("dc-action-btn--active");
  });

  it("does not emit when currentAction is already set", async () => {
    const onJudge = vi.fn();
    const wrapper = mount(ActionPanel, {
      props: {
        revisionWiki: "enwiki",
        revisionId: 123,
        currentAction: "LooksGood",
        onJudge,
      },
    });

    await wrapper.find('[data-action="ShouldRevert"]').trigger("click");
    expect(onJudge).not.toHaveBeenCalled();
  });
});
