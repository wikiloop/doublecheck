import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const userscriptHeader = readFileSync(
  resolve(__dirname, "src/header.txt"),
  "utf-8",
).trimEnd();

/**
 * Single plugin that:
 * 1. Inlines extracted CSS into the JS bundle via <style> injection
 * 2. Prepends the userscript metadata header
 *
 * Combined into one plugin to guarantee correct ordering:
 * header must be first line for Tampermonkey/Greasemonkey.
 */
function userscriptBundlePlugin(): Plugin {
  return {
    name: "userscript-bundle",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // 1. Collect and remove CSS assets
      const cssChunks: string[] = [];
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "asset" && fileName.endsWith(".css")) {
          cssChunks.push(String(chunk.source));
          delete bundle[fileName];
        }
      }

      // 2. Process entry chunks
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.isEntry) continue;

        // Prepend CSS injection if there is CSS
        if (cssChunks.length > 0) {
          const cssCode = cssChunks.join("\n");
          const injection = `(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(cssCode)};document.head.appendChild(s)})();`;
          chunk.code = injection + "\n" + chunk.code;
        }

        // Prepend userscript header (must be very first line)
        chunk.code = userscriptHeader + "\n" + chunk.code;
      }
    },
  };
}

export default defineConfig({
  plugins: [vue(), userscriptBundlePlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "WikiLoopDoubleCheck",
      formats: ["iife"],
      fileName: () => "wikiloop-doublecheck.user.js",
    },
    outDir: "dist",
    rollupOptions: {
      external: ["vue", "@wikimedia/codex", "@wikimedia/codex-icons"],
      output: {
        globals: {
          vue: "Vue",
          "@wikimedia/codex": "codex",
          "@wikimedia/codex-icons": "codexIcons",
        },
      },
    },
    minify: true,
    target: "es2020",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
