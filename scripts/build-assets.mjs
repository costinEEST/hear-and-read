import { mkdir, copyFile, writeFile, rm } from "node:fs/promises";

// Only these files are public. Never use the repository root as assets.directory.
export const publicFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "timing.js",
  "speech.js",
  "speech-playback.js",
  "robots.txt",
  "sitemap.xml",
  "assets/logo.svg",
  "assets/favicon.svg",
  "assets/wordmark.svg",
  "assets/social-card.svg",
  "assets/social-card.png",
];
await rm(new URL("../dist/public/", import.meta.url), {
  recursive: true,
  force: true,
});
for (const file of publicFiles) {
  const target = new URL(`../dist/public/${file}`, import.meta.url);
  await mkdir(new URL(".", target), { recursive: true });
  await copyFile(new URL(`../${file}`, import.meta.url), target);
}
await writeFile(
  new URL("../dist/public/_headers", import.meta.url),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' https: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
`,
);
