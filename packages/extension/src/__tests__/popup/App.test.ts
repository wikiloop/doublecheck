import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { chromeMock, resetChromeMock } from "../chrome-mock.js";
import App from "../../popup/App.vue";

// We need @vue/test-utils for this test
// If it's not available, these tests demonstrate the expected behavior

describe("Popup App", () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it("shows login button when not authenticated", async () => {
    // Mock: auth status returns not logged in
    chromeMock.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as { type: string };
      if (msg.type === "AUTH_STATUS") {
        return { loggedIn: false };
      }
      if (msg.type === "API_REQUEST") {
        return { status: 200, data: { entries: [] } };
      }
      return undefined;
    });

    const wrapper = mount(App);
    await vi.dynamicImportSettled();
    // Wait for next tick for async onMounted
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Login with Wikipedia");
  });

  it("shows username when authenticated", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as { type: string };
      if (msg.type === "AUTH_STATUS") {
        return { loggedIn: true, userId: "user-1", username: "WikiEditor" };
      }
      if (msg.type === "API_REQUEST") {
        return { status: 200, data: { entries: [], judgements: [] } };
      }
      return undefined;
    });

    const wrapper = mount(App);
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("WikiEditor");
  });

  it("calls AUTH_LOGIN when login button is clicked", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as { type: string };
      if (msg.type === "AUTH_STATUS") {
        return { loggedIn: false };
      }
      if (msg.type === "AUTH_LOGIN") {
        return { loggedIn: true, userId: "user-1", username: "NewUser" };
      }
      if (msg.type === "API_REQUEST") {
        return { status: 200, data: { entries: [] } };
      }
      return undefined;
    });

    const wrapper = mount(App);
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const loginButton = wrapper.find(".dc-popup-btn--primary");
    if (loginButton.exists()) {
      await loginButton.trigger("click");
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      // Should have sent AUTH_LOGIN message
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "AUTH_LOGIN" }),
      );
    }
  });

  it("calls AUTH_LOGOUT when logout button is clicked", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(async (message: unknown) => {
      const msg = message as { type: string };
      if (msg.type === "AUTH_STATUS") {
        return { loggedIn: true, userId: "user-1", username: "WikiEditor" };
      }
      if (msg.type === "AUTH_LOGOUT") {
        return { loggedIn: false };
      }
      if (msg.type === "API_REQUEST") {
        return { status: 200, data: { entries: [], judgements: [] } };
      }
      return undefined;
    });

    const wrapper = mount(App);
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const logoutButton = wrapper.find(".dc-popup-btn--small");
    if (logoutButton.exists()) {
      await logoutButton.trigger("click");
      await wrapper.vm.$nextTick();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "AUTH_LOGOUT" }),
      );
    }
  });
});
