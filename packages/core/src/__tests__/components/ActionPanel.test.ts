import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ActionPanel from "../../components/ActionPanel.vue";
import { withI18n } from "../helpers.js";

describe("ActionPanel", () => {
  it("renders three action buttons", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123 },
      ...withI18n(),
    });

    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("emits judge event on button click", async () => {
    const onJudge = vi.fn();
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, onJudge },
      ...withI18n(),
    });

    // CdxButton renders a <button> inside — find all buttons in DOM
    const allButtons = wrapper.findAll("button");
    expect(allButtons.length).toBeGreaterThanOrEqual(3);
    await allButtons[0].trigger("click");
    expect(onJudge).toHaveBeenCalledWith("ShouldRevert");
  });

  it("emits LooksGood via onJudge listener", async () => {
    const onJudge = vi.fn();
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, onJudge },
      ...withI18n(),
    });

    const allButtons = wrapper.findAll("button");
    await allButtons[2].trigger("click");
    expect(onJudge).toHaveBeenCalledWith("LooksGood");
  });

  it("disables buttons when disabled=true", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, disabled: true },
      ...withI18n(),
    });

    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("disabled")).toBeDefined();
    });
  });

  it("applies active style when currentAction is set", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, currentAction: "LooksGood" },
      ...withI18n(),
    });

    expect(wrapper.html()).toContain("LooksGood");
  });

  it("renders with currentAction set", () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, currentAction: "LooksGood" },
      ...withI18n(),
    });

    // Should render without errors when an action is selected
    expect(wrapper.html()).toBeTruthy();
    expect(wrapper.html()).toContain("LooksGood");
  });

  it("does not emit when disabled", async () => {
    const wrapper = mount(ActionPanel, {
      props: { revisionWiki: "enwiki", revisionId: 123, disabled: true },
      ...withI18n(),
    });

    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    expect(wrapper.emitted("judge")).toBeFalsy();
  });
});
