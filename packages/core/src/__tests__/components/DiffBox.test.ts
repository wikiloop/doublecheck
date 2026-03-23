import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DiffBox from "../../components/DiffBox.vue";

describe("DiffBox", () => {
  it("renders diff HTML", () => {
    const html = '<span class="diff-addedline">Added text</span>';
    const wrapper = mount(DiffBox, {
      props: { diffHtml: html },
    });

    const content = wrapper.find(".dc-diff-box__content");
    expect(content.exists()).toBe(true);
    expect(content.html()).toContain("Added text");
  });

  it("shows empty message when diffHtml is empty", () => {
    const wrapper = mount(DiffBox, {
      props: { diffHtml: "" },
    });

    expect(wrapper.find(".dc-diff-box__empty").exists()).toBe(true);
    expect(wrapper.text()).toContain("No diff available");
  });

  it("shows loading skeleton when loading=true", () => {
    const wrapper = mount(DiffBox, {
      props: { diffHtml: "<p>Some diff</p>", loading: true },
    });

    expect(wrapper.find(".dc-diff-box__skeleton").exists()).toBe(true);
    expect(wrapper.find(".dc-diff-box__content").exists()).toBe(false);
  });

  it("renders raw HTML via v-html", () => {
    const html = '<ins class="diffchange">new content</ins>';
    const wrapper = mount(DiffBox, {
      props: { diffHtml: html },
    });

    expect(wrapper.find(".dc-diff-box__content ins.diffchange").exists()).toBe(true);
  });
});
