import { createI18n } from "vue-i18n";
// TODO: replace with @doublecheck/core/i18n/en.json import when bundler resolves it
import en from "./en.json";

export const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: { en },
});
