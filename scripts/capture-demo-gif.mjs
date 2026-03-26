#!/usr/bin/env node
/**
 * Capture a review flow demo GIF using Playwright + ffmpeg.
 * Usage: node scripts/capture-demo-gif.mjs [--url URL] [--output PATH]
 *
 * Requires: playwright (via npx), ffmpeg
 */
import { execSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const framesDir = resolve(ROOT, ".tmp-gif-frames");

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const outIdx = args.indexOf("--output");
const url = urlIdx >= 0 ? args[urlIdx + 1] : "https://doublecheck.wikiloop.org/review";
const output = outIdx >= 0 ? args[outIdx + 1] : resolve(ROOT, "docs/review-demo.gif");

// Clean
if (existsSync(framesDir)) rmSync(framesDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(dirname(output), { recursive: true });

// Capture screenshots
console.log(`Capturing from: ${url}`);
execSync(`npx playwright install chromium 2>/dev/null || true`, { stdio: "ignore" });
execSync(`node ${resolve(__dirname, "capture-frames.cjs")} "${url}" "${framesDir}"`, {
  cwd: ROOT,
  stdio: "inherit",
  timeout: 60000,
});

// Convert to GIF
console.log("Converting to GIF...");
execSync(
  `ffmpeg -y -framerate 0.67 -i "${framesDir}/frame-%03d.png" ` +
  `-vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" ` +
  `"${output}"`,
  { stdio: "inherit" },
);

rmSync(framesDir, { recursive: true });
console.log(`GIF saved: ${output}`);
