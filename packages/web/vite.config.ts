import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
let gitHash = "unknown";
try {
  gitHash = execSync("git rev-parse --short=6 HEAD").toString().trim();
} catch {
  // git not available — try Vercel env or build-info.json fallback
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) {
    gitHash = vercelSha.slice(0, 6);
  } else {
    try {
      const info = JSON.parse(readFileSync("../../packages/server/build-info.json", "utf-8"));
      const match = (info.version as string)?.match(/\+([a-f0-9]+)$/);
      if (match) gitHash = match[1];
    } catch { /* no fallback available */ }
  }
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(gitHash),
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
  test: {
    environment: "happy-dom",
    globals: true,
  },
});
