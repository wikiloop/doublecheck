import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
let gitHash = "unknown";
try {
  gitHash = execSync("git rev-parse --short=6 HEAD").toString().trim();
} catch {
  // git not available (e.g. CI without .git)
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
