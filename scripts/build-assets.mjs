import { LANGUAGES } from "../languages.js";
import { mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";

// Only these files are public. Never use the repository root as assets.directory.
export const publicFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "settings-drawer.js",
  "pwa.js",
  "manifest.webmanifest",
  "timing.js",
  "speech.js",
  "languages.js",
  "demos.js",
  "i18n.js",
  ...Object.keys(LANGUAGES).map((code) => `locales/${code}.json`),
  "speech-playback.js",
  "robots.txt",
  "sitemap.xml",
  "assets/logo.svg",
  "assets/favicon.svg",
  "assets/wordmark.svg",
  "assets/social-card.svg",
  "assets/social-card.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/apple-touch-icon.png",
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
// A content-derived version updates the shell whenever any public asset changes.
const workerSource = await readFile(
  new URL("../sw.js", import.meta.url),
  "utf8",
);
const hash = createHash("sha256").update(workerSource);
for (const file of publicFiles) {
  hash
    .update(file)
    .update(await readFile(new URL(`../${file}`, import.meta.url)));
}
const shellFiles = publicFiles.filter(
  (file) =>
    ![
      "robots.txt",
      "sitemap.xml",
      "assets/social-card.svg",
      "assets/social-card.png",
      "assets/wordmark.svg",
    ].includes(file),
);
await writeFile(
  new URL("../dist/public/sw.js", import.meta.url),
  workerSource
    .replace("__BUILD_HASH__", hash.digest("hex").slice(0, 20))
    .replace(
      "/* __PRECACHE_URLS__ */ []",
      JSON.stringify(
        shellFiles.map((file) => (file === "index.html" ? "/" : `/${file}`)),
      ),
    ),
);
await writeFile(
  new URL("../dist/public/_headers", import.meta.url),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' https: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache
`,
);
