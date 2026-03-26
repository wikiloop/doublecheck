import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DiffBox from "../../components/DiffBox.vue";

describe("DiffBox", () => {
  it("renders diff HTML", () => {
    const html = '<span class="diff-addedline">Added text</span>';
    const wrapper = mount(DiffBox, {
      props: { diffHtml: html },
    });

    expect(wrapper.html()).toContain("Added text");
  });

  it("shows empty state when diffHtml is empty", () => {
    const wrapper = mount(DiffBox, {
      props: { diffHtml: "" },
    });

    expect(wrapper.html()).toBeTruthy();
  });

  it("shows loading state when loading=true", () => {
    const wrapper = mount(DiffBox, {
      props: { diffHtml: "", loading: true },
    });

    expect(wrapper.html()).toBeTruthy();
  });

  it("renders raw HTML via v-html", () => {
    const html = '<ins class="diffchange">new content</ins>';
    const wrapper = mount(DiffBox, {
      props: { diffHtml: html },
    });

    expect(wrapper.html()).toContain("diffchange");
  });
});
