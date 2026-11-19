<img src="assets/wordmark.svg" alt="Hear & Read — Listen. Follow. Repeat." width="400">

# Hear & Read

**Listen. Follow. Repeat.**

[**Open Hear & Read →**](https://hear-and-read.costineest.workers.dev/)

A personal listening practice studio for **English, Hungarian, Romanian, Ukrainian, Russian, Bulgarian, Serbian, Spanish, Italian, Polish, German and French**, with audio, highlighted text, sentence looping, and editable word timings. Import content from supported websites, or bring your own audio and text in any of the 12 practice languages. English is the default for both the page and practice content. Built with plain HTML, CSS and JavaScript, with a TypeScript Cloudflare Worker for website imports. HTML extraction uses Cloudflare's built-in HTMLRewriter; no browser automation service is needed.

## Contents

- [Hear \& Read](#hear--read)
  - [Contents](#contents)
  - [Run locally](#run-locally)
  - [Deploy to Cloudflare](#deploy-to-cloudflare)
  - [Start practicing](#start-practicing)
  - [Timing accuracy](#timing-accuracy)
  - [Save your practice](#save-your-practice)
  - [Install and use offline](#install-and-use-offline)
  - [Development](#development)
  - [Interface translations](#interface-translations)

## Run locally

Install [Node.js](https://nodejs.org/) **26.13.0 or a newer Node 26 LTS release**, then run these commands from the repository root:

```sh
npm ci
npm run dev
```

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm install` and `nvm use` from this directory first; both read the version pinned in `.nvmrc`. After updating Node, restart any running development servers. Update `.nvmrc` and the `package.json` engine requirement together when adopting a newer runtime baseline; `npm ci` does not upgrade Node itself. The project enables npm's strict engine check so dependency installation rejects an unsupported Node version.

Open **http://127.0.0.1:8765** in your browser. Keep the terminal running; press **Ctrl+C** to stop the server. Wrangler runs the Worker locally and prepares the public assets automatically. The browser interface uses no framework or bundler. No Python installation is needed.

For environment details, another port, dependency changes and development checks, see the [Worker environment reference](.agents/skills/maintain-hear-and-read/references/worker-environment.md).

## Deploy to Cloudflare

Create a Cloudflare account and select the **Workers Free** plan. This project uses **Workers with Static Assets**, rather than Pages. It requires no database, KV, R2 or Browser Run binding.

After installing dependencies with `npm ci`, verify the project:

```sh
npm run typecheck
npm test
npm run deploy:check
```

Sign in and deploy:

```sh
npx wrangler login
npm run deploy
```

The public studio is **[hear-and-read.costineest.workers.dev](https://hear-and-read.costineest.workers.dev/)**. Running `npm run deploy` updates the named Worker in the account you select. Wrangler prints your deployment URL; another account or Worker name produces a different address. To deploy from a connected Git repository using Workers Builds, use `npm run build` as the build command and `npm run deploy` as the deploy command.

When deploying your own copy or moving to a custom domain, update the public URLs in `index.html`, `robots.txt` and `sitemap.xml`, plus the links in this README and [BRANDING.md](BRANDING.md). The canonical page, social sharing images and structured data should all use your final public address.

Only allowlisted browser files are copied into `dist/public/`; backend source, tests and configuration stay private. Static requests bypass Worker execution; `/api/*` runs the Worker. Response headers preserve the studio's content security policy.

The [free plan limits](https://developers.cloudflare.com/workers/platform/limits/) apply to import API calls, including 100,000 Worker requests per day shared across your account and 10 ms of CPU time per invocation. Static asset requests are [free and unlimited](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Large imports may exceed the CPU allowance; measure production imports before relying on the free tier for heavy usage. Publishers may also decline automated access from Cloudflare's network. Custom domains are optional; the provided `workers.dev` address does not require buying a domain.

## Start practicing

- **Website content:** select **Import content** above the reader to open **Settings → Content and language**. Select a website or **Detect from URL**, paste a page URL, and select **Import content** in the drawer. **Use an example** fills in a sample URL without importing it automatically.
- **Page language:** use **Settings → Page language** to translate menus, help, dialogs and messages. Switching the language preserves drafts and the open drawer. The URL (`?lang=ro`, for example) overrides the remembered page preference; a first visit defaults to English. This choice is independent of the practice language.
- **Practice language:** choose any of the 12 languages in **Settings → Content and language**. This sets pronunciation and sentence handling; it does not translate your text. Custom text, drafts and recordings are preserved. When viewing an untouched demo, choosing a language loads that language's demo.
- **Your own recording:** in **Settings → Voice and audio**, select **Original recording**, expand **Use your own audio** and select a file or paste an HTTPS audio URL. Use **Edit text** above the reader to paste matching text, then press **Apply text**.
- **Browser voice:** in **Settings → Voice and audio**, leave the voice on **Auto · best available** and use **Test voice**. Close the drawer, then press **Play**. Only the highest available quality tier is offered; natural/neural, premium and enhanced variants are preferred over standard voices. Recommendations use voice metadata, not a measured audio-quality score. If only a standard voice exists, the app says so; it never substitutes another language. Use **Refresh voices** after installing voices on your device.

The main screen keeps the reader, playback, speed, repeat and demo translation controls visible. **Settings** opens a drawer on desktop and mobile; opening it stops playback. **Close**, **Read**, Escape or tapping outside dismisses it without discarding unapplied text or URL drafts. Playback resumes only when you press **Play**. **Sync editor** stays in a collapsible section on the main page so you can adjust timings while clicking words.

To practice pronunciation, expand **Word pronunciation** below the reader and choose **Speak this word** for the current word (also available in Word options), or select practice text in the reader and choose **Speak selection**. Both use your chosen browser voice and speed, pause existing playback, and stop after that text. **Stop pronunciation** cancels the sample. Normal word clicks continue to jump into sentence playback.

Under **Settings → Voice and audio**, **Volume** adjusts recordings, pronunciation clips and browser speech; zero mutes them. **Advanced speech settings → Pitch** changes browser speech tone, defaults to `1`, and has a reset button. Pitch does not improve voice quality or change recordings. Changes stop active browser speech; press Play or test the voice again. Recording volume applies immediately, subject to device support. Sessions retain both settings.

Choose **Settings → Reader settings → Highlight style**: **Background**, **Underline**, or **Background + underline**. The separate Highlight control selects words, sentences, both or Off. Underlines use a thicker stroke for the active word and a thinner stroke for the sentence. Text visibility, Follow words, Auto-scroll and shadowing pauses are in the same section.

Click words to seek. Repeat a sentence, add 1.8-second shadowing pauses, blur/hide the text, or switch off **Follow words** to move the highlight manually. Built-in demos offer authored translations into the selected page language. User and imported text is not automatically translated. Keyboard shortcuts outside controls are Space to play/pause and ← / → to change sentence. Native buttons, inputs and word controls also work from the keyboard.

Voice choices are remembered separately for each language in this browser. Sessions also save their practice language and voice preference. Available voices vary across browser/device combinations. Some voices need an online speech service; the app identifies them. Natural/premium quality and word-boundary events are not guaranteed. Install enhanced/premium system voices for more choices, or use a human recording. Website imports set the practice language from the source URL while preserving the page language. Example URLs and placeholders follow the practice language; your own pasted URL is retained. Legacy sessions without a language still load as Hungarian.

| Website    | What is imported                                                                          | How to listen                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| JW.org     | Text, original recording, and publisher segment timings when available                    | Original recording is selected automatically.                                    |
| Wikipedia  | Article paragraphs, excluding references/navigation                                       | Browser voice is selected; you can add your own matching recording.              |
| Wiktionary | The entry's definitions in the source edition’s language and available pronunciation clip | Browser voice reads the definitions. A separate player pronounces the word only. |

Website imports are independent of the listening method. More source adapters can be added; unsupported websites can still be used by pasting text manually. Import failures preserve your current practice. Some websites decline automated requests or impose rate limits; if this happens, open the page and paste its text, or try later. The importer does not bypass access restrictions.

Imported Wikipedia/Wiktionary text retains its original-page, contributor-history and license links in the reader and saved/exported sessions. Article text is limited to 100,000 characters, with a notice if shortened. Wiktionary entries without a matching language section cannot be imported automatically.

## Timing accuracy

The original Hungarian Matthew 5 page provides **48 publisher verse timestamps**. Those preserve real verse boundaries; word and sentence positions inside each verse are **estimated**. For recordings without publisher markers, all word timings are estimated from text length. No fixed timing-accuracy claim is made.

For better word timing:

1. Expand **Import or edit word timings** and import an array with exactly one entry per word, in text order:

   ```json
   [
     {"word":"Jó", "start":0, "end":0.4},
     {"word":"reggelt!", "start":0.4, "end":1.1}
   ]
   ```

2. Or enable **Sync mode**, play the recording and click a word when you hear it. Its start becomes a pin; words between pins are redistributed. Pins must follow the text's order.
3. Use **Word options** to edit the start and end of any word, copy it, or play its sentence. Double-clicking a word also opens this dialog.

Timings must be nonnegative and nonoverlapping, with end greater than start. If `word` is included, it must match the corresponding text token, including punctuation. Repeated words are matched by their position, never by the first matching spelling. Imported or manually edited timestamps survive audio metadata loading; **Apply text** and **Estimate all timings** explicitly reset alignment.

An external forced-alignment tool can prepare word timestamps, but its output must match this exact text and recording. No model downloads, WhisperX service or untested generated alignment script is included.

## Save your practice

Under **Settings → Saved sessions**, **Save session** stores text, timings, title, language, voice preference, playback speed, volume, pitch and remote audio URL in this browser. **Export session** creates a portable JSON file; import it on the same or another device. **Export timings** in the **Sync editor** exports only word timings.

Uploaded audio stays in memory and is not saved or uploaded. Select the original local audio file again after reloading or importing its saved session. Browser storage may be cleared by your browser; export sessions you want to keep. If storage is blocked or full, practice and JSON export still work.

## Install and use offline

Hear & Read can be installed as a standalone app from its HTTPS website. On Android, open it in Chrome and use the browser menu's **Install app** or **Add to Home screen** option. On iPhone or iPad, open it in Safari, choose **Share → Add to Home Screen**, and enable **Open as Web App** if offered. Installation remains optional; the browser version has the same practice features.

Open the app online first and allow its initial resources to finish downloading before going offline. The app caches its interface, all 12 interface languages, demos and icons. Saved text sessions, text editing, timing tools and session import/export work offline. Save or export a practice before closing the app; unsaved edits are not automatically restored.

For offline listening, use a downloaded audio file or a locally available system voice. Online voices, website imports, remote recordings and pronunciation clips require a connection and are not downloaded for offline use. Local audio files must be selected again after reopening a session. If website imports were unavailable when the app opened, reopen or reload it after reconnecting to restore the source list.

Updates download in the background while online and take effect after all app tabs and installed-app windows have closed. Updates do not force a reload during practice. Browsers can reclaim cached files or local storage, so export sessions for a portable backup; installation does not add cloud sync or permanent storage. Offline support requires HTTPS (or localhost for development); opening `index.html` directly is not supported.

## Development

The [project maintenance skill](.agents/skills/maintain-hear-and-read/SKILL.md) covers the source layout, development workflow, checks, and when to use Modern Web Guidance. See [BRANDING.md](BRANDING.md) for brand assets and publication metadata. Browser source files live at the project root, the TypeScript backend in `worker/`, build tooling in `scripts/`, and regression checks in `tests/`. `robots.txt` and `sitemap.xml` describe the public landing page; imported documents and browser sessions do not create public pages.

Run `npm run typecheck` and `npm test`. Tests cover browser parsing, timing, session validation, voice ranking and speech-controller lifecycle behavior using injected speech engines, plus source extraction and API safeguards in Cloudflare's local Workers runtime. PWA checks cover offline shell caching, cache cleanup, installation metadata and icon sizes, and public asset delivery without redirects. `npm run deploy:check` bundles the Worker and assets without publishing. Detailed checks and browser smoke-test procedures are documented in the maintenance skill. Synthetic speech tests do not establish native voice quality or availability, fixture imports do not establish live publisher availability, and automated PWA checks do not establish installation on a physical mobile device.

The studio is intended for personal listening practice. Sessions stay in each browser; deployment does not add accounts or cross-device storage. Website extraction can change or fail, background tabs can delay loop/shadowing boundaries, and device/browser speech capabilities vary. Playback is a listening aid rather than a sample-accurate audio editor.

## Interface translations

The app remains plain browser JavaScript. `languages.js` shares the supported language registry and localized source examples with the Worker. `demos.js` contains parallel authored practice sentences. `i18n.js` binds static text and dynamic messages without replacing reader or audio nodes; `locales/<code>.json` holds each UI dictionary. English message text is the dictionary key. `{p0}`, `{p1}`, etc. are substitution slots and must survive translation; `count.*` objects use `Intl.PluralRules`.

When editing UI copy, update the English dictionary and every enabled translation. Keep user text, titles, voice identifiers, source names and URLs independent of UI translation. Run `npm run test:browser-logic` for dictionary coverage, placeholder safety, plural rules, locale-loading races and practice/session checks. Locale files and client modules must remain in the asset allowlist and Wrangler watch list. Language changes happen in the current document. These client translations do not create separately rendered multilingual SEO pages.

For Hungarian copy, use the project’s [Interpreting Hungarian skill](.agents/skills/interpreting-hungarian/SKILL.md) and its UI conventions to review grammar, terminology and consistency of address. Preserve message meaning and substitution slots when improving wording.
