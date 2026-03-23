import { createI18n, useI18n } from "vue-i18n";
import type { I18n } from "vue-i18n";
import enMessages from "../../i18n/en.json";

export type { I18n };
export { useI18n };

export interface I18nSetupOptions {
  locale?: string;
  fallbackLocale?: string;
}

/**
 * Creates a vue-i18n instance pre-loaded with the English locale.
 * Additional locales can be lazy-loaded via `loadLocale()`.
 */
export function createDoubleCheckI18n(options: I18nSetupOptions = {}): I18n {
  const i18n = createI18n({
    legacy: false,
    locale: options.locale ?? "en",
    fallbackLocale: options.fallbackLocale ?? "en",
    messages: {
      en: enMessages,
    },
  });

  return i18n;
}

/**
 * Lazy-load a locale JSON file and register it with the i18n instance.
 * Expects locale files at `@doublecheck/core/i18n/{locale}.json`.
 */
export async function loadLocale(
  i18n: I18n,
  locale: string,
  messages: Record<string, string>,
): Promise<void> {
  const global = i18n.global;
  // vue-i18n v9 composition API
  if ("setLocaleMessage" in global) {
    (global as ReturnType<typeof useI18n>).setLocaleMessage(locale, messages);
  }
}
