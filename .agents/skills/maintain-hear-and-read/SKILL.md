---
name: maintain-hear-and-read
description: Use when implementing, debugging or setting up Hear & Read in this repository, including browser speech, timed recordings, sessions and Worker importers.
metadata:
  author: Constantin Câmpean
  tags: [hear-and-read, speech, cloudflare-workers]
---

# Maintain Hear & Read

## Purpose

Maintain this repository's multilingual listening studio. Resolve file paths and run project commands from the repository root; links below are relative to this skill's directory.

Keep the root-level browser files as plain HTML, CSS and browser-native JavaScript. Keep dependencies on the Worker/tooling side; do not introduce a frontend framework or browser bundler unless requested. The asset build copies only the explicit public-file allowlist into `dist/public/`. HTML extraction uses native HTMLRewriter; `entities` only decodes collected text.

## Prerequisites

For application commands, use the Node version in `.nvmrc`; install dependencies with `npm ci` when setting up or restoring the committed lockfile. See the environment reference for setup. Documentation-only work does not require dependency installation. Browser verification needs a running local Wrangler instance and an available browser tool. Use the frontend guidance below when changing browser behavior or presentation.

## Instructions

- For setup, running the app, Worker/tool changes, dependencies and backend validation, read [Worker environment and commands](references/worker-environment.md). Keep the two-command user quick start in the README; the reference owns detailed environment/development procedures. See [local setup](../../../README.md#run-locally) and [deployment](../../../README.md#deploy-to-cloudflare) for user-facing commands.
- For importer, speech, persistence or styling changes, read the relevant section of [maintenance invariants and checks](references/maintenance.md). Dependency rationale stays in the Worker environment reference.
- For page-language switching, dictionaries, translated UI or localized examples, read [localization](references/localization.md).
- For practice-language selection, voice discovery/ranking and language/voice session preferences, read [language and voice goals](references/language-and-voices.md).
- For branding, SEO or publication metadata, read [BRANDING.md](../../../BRANDING.md). It owns the production URL and the metadata/domain-change checklist.
- Keep [README.md](../../../README.md) focused on using the studio and finding test commands. Put durable regression coverage in tests, maintenance constraints in this skill/reference, and actual check results in commit messages or task handoffs; do not maintain a separate dated verification log.

## Frontend guidance

Before HTML, CSS or client-side JavaScript changes, read the installed `modern-web-guidance` skill and follow its current search/retrieve workflow. Use focused capability searches and returned guide IDs; keep its evolving CLI instructions there. If unavailable, report the gap and consult current official platform documentation for affected APIs.

Documentation/skill edits, backend-only work (including `worker/jw.ts` extraction), tests, dependencies, tooling, Git and data-only changes do not trigger that workflow. Checking an unchanged page in a browser does not trigger it either; changing how `app.js` renders Worker data does.

## Change the active application

- `index.html`: native controls, structure, dialogs and publication metadata.
- `robots.txt` and `sitemap.xml`: public crawler guidance and canonical home-page entry; keep them in the asset allowlist and Wrangler build watch list.
- `styles.css`: presentation and responsive styles.
- `app.js`: playback UI, sentence sequencing, voice discovery, sync editing and persistence.
- `speech-playback.js`: DOM-independent utterance lifecycle, previews/narration, pause/resume and cancellation. Keep callback invalidation inside the controller; app tokens also invalidate shadowing timers.
- `languages.js`: shared language registry, Wiki hosts and localized publisher examples; `demos.js`: authored parallel demo sentences; `i18n.js` and `locales/`: interface translation.
- `timing.js`: locale-aware parsing, timing and session validation; `speech.js`: language definitions, demos and pure voice ranking.
- `worker/index.ts`: API routing/security; `worker/sources.ts`: source registry; `worker/jw.ts` and `worker/wiki.ts`: source extraction; `worker/http.ts`: bounded fetching; `worker/html.ts`: native HTMLRewriter record collection.
- `wrangler.jsonc`: Worker/Static Assets deployment; `scripts/build-assets.mjs`: public-asset allowlist and static headers.
- `tests/`: active regression checks and fixtures.

Keep assets in `assets/`, regression tests and fixtures in `tests/`, and project skills in `.agents/skills/`. Build future extension work separately when requested.

Keep source selection independent of browser speech and full-text audio. Preserve publisher segment boundaries; label interpolated word/sentence timings as estimates. Preserve complete timing validation and position-based repeated-word matching. Import, speech and persistence constraints live in the maintenance reference.

## Validate the affected behavior

- For speech/voice, timing/parsing or session changes, run `npm run test:browser-logic`; use `node --check app.js` when changing the browser module. The Node baseline in `.nvmrc` and `package.json` runs tooling; Wrangler runs the local Worker.
- For Worker/dependency changes, use the scoped checks in the Worker environment reference.
- For frontend behavior/layout changes, start Wrangler locally using that reference and use Chrome DevTools MCP when available. Test changed controls and relevant failure paths, inspect console/network, and confirm advancing audio before claiming playback works. An HTTP 200 alone is insufficient.
- For layout changes, check 320px touch reflow, short landscape and equivalent 200% text sizing. Check keyboard operation, focus restoration, reduced motion and high contrast when relevant. Lighthouse supports these observations; it does not prove every interaction.
- For documentation-only changes, check links and command accuracy. For skill edits, use the skill-creator validator when available; otherwise check YAML frontmatter, name/directory consistency and local reference targets, and report the validator gap. Do not run application tests or the browser matrix without a separate reason.

Report actual checks and limits in the task handoff or commit message. Distinguish injected-engine tests from native browser playback and fixtures from live imports. Moving documentation is not new behavioral verification.

## Examples

- “Fix German voice selection after loading a session”: read the language/voice reference and the persistence and speech sections of the maintenance reference, apply Modern Web Guidance, update the affected browser module and synthetic-catalog coverage, then verify the changed flow with exposed browser voices.
- “Add a website importer”: read the Worker environment reference and the content-import section of the maintenance reference, register the adapter in `worker/sources.ts`, preserve bounded fetching and the shared response shape, and run the backend checks. Apply Modern Web Guidance if browser rendering also changes.
- “Correct the setup documentation”: check commands against `package.json`, `.nvmrc` and `wrangler.jsonc`; follow the Worker environment reference without starting the speech/layout test matrix.

## Troubleshooting

- Dependency installation reports an engine mismatch: activate the version in `.nvmrc` and retry `npm ci`; keep strict engine checking enabled.
- Local Wrangler reports that port 8765 is occupied: leave the existing server alone and use `npm run dev -- --port 8766`.
- The browser exposes no suitable voice: wait for `voiceschanged`, refresh the catalog and use the existing install/refresh guidance. Preserve the chosen language and show the unavailable state.
- A live import returns 403/429: preserve the current text and offer manual paste/retry. Use fixtures to isolate extraction regressions from publisher access failures.

## Limitations

Browser voice quality and word events depend on the exposed engine. Synthetic catalogs and injected engines cannot establish audible quality; Worker fixtures cannot establish live publisher access. Local audio files require user re-selection after restoring a session. Deployment changes a live Cloudflare Worker; perform it only when the user's request authorizes publication, and otherwise use `npm run deploy:check` for packaging validation.
