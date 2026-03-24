#!/usr/bin/env node
/**
 * Generate PNG/WebP derivatives from the SVG logo.
 * Run: npx --yes sharp-cli is not ideal; use this script instead:
 *   npm install sharp && node v5-assets/branding/generate-icons.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(resolve(__dirname, "wikiloop-doublecheck-logo.svg"));

const sizes = [
  { name: "icon-16.png", size: 16 },
  { name: "icon-48.png", size: 48 },
  { name: "icon-128.png", size: 128 },
  { name: "icon.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

// OG image: 1200x630 with logo centered on blue background
const bgSvg = Buffer.from(
  `<svg width="1200" height="630"><rect width="1200" height="630" fill="#36c"/></svg>`,
);
const logoResized = await sharp(svg, { density: 300 })
  .resize(200, 200)
  .png()
  .toBuffer();
await sharp(bgSvg)
  .composite([{ input: logoResized, top: 215, left: 500 }])
  .webp({ quality: 90 })
  .toFile(resolve(__dirname, "og-image.webp"));
console.log("Generated og-image.webp (1200x630)");

// Copy to packages
const webPublic = resolve(__dirname, "../../packages/web/public");
const extIcons = resolve(__dirname, "../../packages/extension/icons");

for (const file of ["icon.png", "og-image.webp"]) {
  const src = resolve(__dirname, file);
  const dest = resolve(webPublic, file);
  await sharp(src).toFile(dest);
  console.log(`Copied ${file} → packages/web/public/`);
}

for (const size of [16, 48, 128]) {
  const file = `icon-${size}.png`;
  const src = resolve(__dirname, file);
  const dest = resolve(extIcons, file);
  await sharp(src).toFile(dest);
  console.log(`Copied ${file} → packages/extension/icons/`);
}

console.log("\nDone! SVG favicon is used directly (no ICO needed for modern browsers).");
