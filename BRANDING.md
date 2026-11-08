# Hear & Read

**Repository slug:** `hear-and-read`  
**Tagline:** Listen. Follow. Repeat.  
**Short description:** A personal listening practice studio with audio, highlighted text, sentence looping, and editable word timings.

Use **Hear & Read** in interface text and prose; use `hear-and-read` for repository/package names and filenames. The practice languages are Hungarian, Spanish and German; interface text remains English and website imports currently provide Hungarian content. Do not imply automatic translation, universal language support or guaranteed neural voices. Keep timing claims explicit: publisher segment boundaries and interpolated word timings have different accuracy.

## Visual identity

The symbol combines an open book, three sound bars and an amber highlighted line. Keep its proportions and colors together. Leave at least one quarter of the symbol's width clear around it. Use the simplified favicon at small sizes, not a cropped wordmark.

| Role | Color |
| --- | --- |
| Logo green | `#215A45` |
| Warm cream | `#FFF8EC` |
| Highlight amber | `#F4A340` |
| Reading ink | `#252820` |
| Muted text | `#616259` |
| Soft green | `#E4EDDF` |

Keep system sans-serif for controls and the wordmark, with Georgia for reading text. Amber identifies the active word; green identifies the current sentence. Preserve visible focus indicators and meaningful text alongside visual state.

## Assets

- [Logo](assets/logo.svg): standalone 64×64 vector symbol with an accessible title/description.
- [Favicon](assets/favicon.svg): simplified 32×32 vector symbol, legible on light and dark browser chrome.
- [Wordmark](assets/wordmark.svg): cream-backed horizontal identity for the README and shared materials.
- [Social source](assets/social-card.svg) and [PNG](assets/social-card.png): 1200×630 sharing image. The PNG is a browser rasterization of the SVG; edit the SVG first, then regenerate its PNG.

The header uses an empty image alt because the adjacent heading already names the app. Standalone brand images should name Hear & Read. The SVG symbol is handcrafted; it has no runtime font or external asset dependencies. Wordmark/social SVG text uses system fonts.

## SEO and publication

`index.html` contains the title, description, application name, light/dark theme colors, Open Graph/Twitter card metadata and a Schema.org `WebApplication` JSON-LD block. Its feature claims reflect the current app. Structured data describes the application; it does not guarantee a search rich result.

Once the public **web app** URL is confirmed:

1. Add an absolute canonical URL and matching `og:url`.
2. Replace both relative social-image metadata values with the absolute public URL of `assets/social-card.png`, retaining any GitHub Pages repository subpath.
3. Add the real application URL to JSON-LD. Add repository/author links only after those identities are confirmed.
4. Check the deployed page and image are publicly accessible, then validate the structured data and sharing preview. Do not use localhost, a guessed domain or a GitHub source-code page as the application's canonical URL.

GitHub repository publication and web-app hosting are separate. GitHub Pages alone cannot run the Python import endpoint. Set the repository's social preview manually to the supplied PNG if desired; application HTML metadata does not control the repository page's preview.

Session storage uses `hear-and-read.sessions.v1`.
