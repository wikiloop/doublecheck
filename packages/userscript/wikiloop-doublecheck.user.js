// ==UserScript==
// @name         WikiLoop DoubleCheck
// @namespace    https://wikiloop-doublecheck.toolforge.org
// @version      5.0.0-alpha.0
// @description  Community tool for reviewing recent Wikipedia edits for vandalism and quality issues
// @author       WikiLoop contributors
// @match        https://*.wikipedia.org/wiki/Special:Diff/*
// @match        https://*.wikipedia.org/wiki/Special:RecentChanges*
// @match        https://*.wikipedia.org/w/index.php?*diff=*
// @grant        none
// @homepageURL  https://wikiloop-doublecheck.toolforge.org
// @supportURL   https://github.com/wikiloop/doublecheck/issues
// @license      Apache-2.0
// ==/UserScript==

(function () {
  "use strict";

  const API = "https://wikiloop-doublecheck.toolforge.org/api/health";

  // Inject a small status panel to confirm the userscript is working
  const panel = document.createElement("div");
  panel.id = "doublecheck-panel";
  panel.style.cssText =
    "position:fixed;bottom:16px;right:16px;padding:12px 16px;background:#fff;border:2px solid #36c;border-radius:8px;font:13px sans-serif;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.15)";
  panel.textContent = "WikiLoop DoubleCheck: connecting...";
  document.body.appendChild(panel);

  fetch(API)
    .then((r) => r.json())
    .then((data) => {
      panel.textContent = `WikiLoop DoubleCheck: ${data.status} · v${data.version}`;
      panel.style.borderColor = "#0a0";
    })
    .catch(() => {
      panel.textContent = "WikiLoop DoubleCheck: API unreachable";
      panel.style.borderColor = "#c00";
    });
})();
