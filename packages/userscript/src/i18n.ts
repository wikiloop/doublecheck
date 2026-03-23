/**
 * Internationalization support.
 *
 * Strategy:
 * 1. Try mw.msg() (MediaWiki's native i18n) if ResourceLoader is available
 * 2. Fall back to bundled English strings
 */

const bundledMessages: Record<string, string> = {
  "dc-panel-title": "WikiLoop DoubleCheck",
  "dc-looks-good": "Looks Good",
  "dc-not-sure": "Not Sure",
  "dc-should-revert": "Should Revert",
  "dc-damaging-label": "Damaging",
  "dc-goodfaith-label": "Good Faith",
  "dc-votes": "$1 votes",
  "dc-loading": "Loading...",
  "dc-error": "Error loading data",
  "dc-badge-high-risk": "High Risk",
  "dc-badge-medium-risk": "Medium Risk",
  "dc-badge-low-risk": "Low Risk",
};

let initialized = false;

/**
 * Register bundled messages with MediaWiki if available.
 * Safe to call multiple times — only runs once.
 */
export function initI18n(): void {
  if (initialized) return;
  initialized = true;

  try {
    if (typeof mw !== "undefined" && mw.messages && mw.messages.set) {
      mw.messages.set(bundledMessages);
    }
  } catch {
    // mw not available — fall back to bundled strings
  }
}

/**
 * Get a localized message string.
 * Tries mw.msg() first, falls back to bundled English strings.
 */
export function msg(key: string, ...params: Array<string | number>): string {
  initI18n();

  // Try MediaWiki i18n
  try {
    if (typeof mw !== "undefined" && mw.message) {
      const message = mw.message(key, ...params);
      if (message.exists()) {
        return message.text();
      }
    }
  } catch {
    // Fall through to bundled strings
  }

  // Fall back to bundled strings
  let text = bundledMessages[key] ?? key;
  params.forEach((param, i) => {
    text = text.replace(`$${i + 1}`, String(param));
  });
  return text;
}
