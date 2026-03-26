import { createDoubleCheckI18n } from "../i18n/setup.js";

/** Shared mount options for components that use useI18n */
export function withI18n() {
  return {
    global: {
      plugins: [createDoubleCheckI18n()],
    },
  };
}
