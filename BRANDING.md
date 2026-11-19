# Hear & Read

**Repository slug:** `hear-and-read`  
**Tagline:** Listen. Follow. Repeat.  
**Short description:** A free listening practice studio for 12 languages, with audio, highlighted text, sentence loops and editable word timings.

**Public app:** [hear-and-read.costineest.workers.dev](https://hear-and-read.costineest.workers.dev/)

Use **Hear & Read** in interface text and prose; use `hear-and-read` for repository/package names and filenames. English is the default page and practice language. Both selectors support English, Hungarian, Romanian, Ukrainian, Russian, Bulgarian, Serbian, Spanish, Italian, Polish, German and French. Website examples follow the practice language; imported content carries its source language. The page language is independent of the practice language. Do not imply automatic translation, universal language support or guaranteed neural voices. Keep timing claims explicit: publisher segment boundaries and interpolated word timings have different accuracy.

## Visual identity

The symbol combines an open book, three sound bars and an amber highlighted line. Keep its proportions and colors together. Leave at least one quarter of the symbol's width clear around it. Use the simplified favicon at small sizes, not a cropped wordmark.

| Role            | Color     |
| --------------- | --------- |
| Logo green      | `#215A45` |
| Warm cream      | `#FFF8EC` |
| Highlight amber | `#F4A340` |
| Reading ink     | `#252820` |
| Muted text      | `#616259` |
| Soft green      | `#E4EDDF` |

Keep system sans-serif for controls and the wordmark, with Georgia for reading text. Amber identifies the active word; green identifies the current sentence. Preserve visible focus indicators and meaningful text alongside visual state.

## Assets

- [Logo](assets/logo.svg): standalone 64×64 vector symbol with an accessible title/description.
- [Favicon](assets/favicon.svg): simplified 32×32 vector symbol, legible on light and dark browser chrome.
- [Wordmark](assets/wordmark.svg): cream-backed horizontal identity for the README and shared materials.
- [Social source](assets/social-card.svg) and [PNG](assets/social-card.png): 1200×630 sharing image. The PNG is a browser rasterization of the SVG; edit the SVG first, then regenerate its PNG.

The header uses an empty image alt because the adjacent heading already names the app. Standalone brand images should name Hear & Read. The SVG symbol is handcrafted; it has no runtime font or external asset dependencies. Wordmark/social SVG text uses system fonts.

## SEO and publication

The production origin is `https://hear-and-read.costineest.workers.dev`. Use the trailing-slash home URL as the canonical application URL: `https://hear-and-read.costineest.workers.dev/`.

`index.html` contains a descriptive search title, description, application name, light/dark theme colors, canonical link, Open Graph/Twitter card metadata and a Schema.org `WebApplication` JSON-LD block. Social titles retain the tagline; search metadata describes multilingual practice. Static structured data defaults to English; client language switching updates its language and description. It describes current features, links to the live app and brand images, and identifies free access without adding invented ratings or author claims. It does not guarantee a search rich result.

Publication URLs must stay aligned:

- Canonical link, `og:url`, JSON-LD `url` and the sitemap entry: `https://hear-and-read.costineest.workers.dev/`.
- Open Graph and Twitter sharing image: `https://hear-and-read.costineest.workers.dev/assets/social-card.png` (1200×630).
- `robots.txt`: allows ordinary search crawling, excludes `/api/`, disallows listed AI training/search/user-fetch agents, and points to `https://hear-and-read.costineest.workers.dev/sitemap.xml`. The additional `Content-Signal` preference allows search and declines AI training/input use. These are voluntary crawler preferences, not access control; they do not guarantee exclusion from every AI feature or stop unidentified bots. Keep verified crawler names current using the [Cloudflare documentation](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) and crawler operators' documentation.
- `sitemap.xml`: lists only the home page. Client-side language choices do not produce separately rendered pages; do not add misleading `hreflang` alternates or URLs for imported content or saved sessions.

For a domain change or fork, update `index.html`, `robots.txt`, `sitemap.xml`, this document and the README together. The asset build allowlists the crawler files. After deploying, check the page and PNG are publicly accessible and validate structured data and sharing previews. Search and social services can cache older metadata. Do not use localhost or a GitHub source-code page as the application's canonical URL.

GitHub repository publication and web-app hosting are separate. The app deploys to Cloudflare Workers with Static Assets; GitHub Pages alone cannot run its import endpoint. Set the repository's social preview manually to the supplied PNG if desired; application HTML metadata does not control the repository page's preview.

Session storage uses `hear-and-read.sessions.v1`.
