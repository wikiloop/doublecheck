import { createApp } from "vue";
import { createI18n } from "vue-i18n";
import App from "./App.vue";
import en from "@doublecheck/core/i18n/en.json";

const locale = typeof chrome !== "undefined" && chrome.i18n
  ? chrome.i18n.getUILanguage()
  : "en";

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "en",
  messages: { en },
});

const app = createApp(App);
app.use(i18n);
app.mount("#app");
