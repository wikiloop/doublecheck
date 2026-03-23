import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
  test: {
    environment: "happy-dom",
    globals: true,
  },
});
