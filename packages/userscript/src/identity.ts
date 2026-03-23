import type { WikiIdentity, WikiIdentityType } from "@doublecheck/core";

/**
 * Detect the current user's identity from the MediaWiki JS environment.
 * Falls back to anonymous if mw APIs are unavailable.
 */
export function detectIdentity(): WikiIdentity {
  try {
    const username = mw.config.get("wgUserName") as string | null;

    let type: WikiIdentityType;
    if (typeof mw.user.isNamed === "function" && mw.user.isNamed()) {
      type = "named";
    } else if (typeof mw.user.isTemp === "function" && mw.user.isTemp()) {
      type = "temp";
    } else if (typeof mw.user.isAnon === "function" && mw.user.isAnon()) {
      type = "anon";
    } else {
      // Fallback heuristic: if wgUserName exists, treat as named
      type = username ? "named" : "anon";
    }

    return {
      type,
      username: username ?? null,
      verified: false,
    };
  } catch {
    return {
      type: "anon",
      username: null,
      verified: false,
    };
  }
}
