---
name: maintain-hear-and-read
description: Maintain this repository's Hungarian, Spanish and German listening studio, including its vanilla browser interface, TypeScript Cloudflare Worker source adapters, Wrangler environment and regression checks. Use for implementation or development setup in this project, not unrelated repositories.
---

# Maintain Hear & Read

Keep the root-level browser files as plain HTML, CSS and browser-native JavaScript. Keep dependencies on the Worker/tooling side; do not introduce a frontend framework or browser bundler unless requested. The asset build copies only the explicit public-file allowlist into `dist/public/`. HTML extraction uses native HTMLRewriter; `entities` only decodes collected text.

## Read what the task needs

- For setup, running the app, Worker/tool changes, dependencies and backend validation, read [Worker environment and commands](references/worker-environment.md). Keep the two-command user quick start in the README; the reference links to it and owns detailed environment/development procedures.
- For importer, speech, persistence or styling changes, read the relevant section of [maintenance invariants and checks](references/maintenance.md). Dependency rationale stays in the Worker environment reference.
- For branding, SEO or publication metadata, read [BRANDING.md](../../../BRANDING.md). It owns the production URL and the metadata/domain-change checklist.
- Keep [README.md](../../../README.md) focused on using the studio and finding test commands. Put durable regression coverage in tests, maintenance constraints in this skill/reference, and actual check results in commit messages or task handoffs; do not maintain a separate dated verification log.

## Modern Web Guidance: when

Consult the available `modern-web-guidance` skill **before changing HTML structure, CSS layout/styles/motion, or client-side JavaScript behavior**, including browser APIs, accessibility, performance and frontend security. For mixed tasks, apply it only to the affected frontend portion.

Skip its skill and CLI for documentation/skill edits, backend-only work, tests, dependency/tooling configuration, Git, infrastructure and data-only changes that do not change browser behavior. Opening a browser to check an unchanged page does not itself trigger a lookup. Changing `worker/jw.ts` extraction alone does not trigger guidance; changing how `app.js` renders its response does.

## Modern Web Guidance: how

Read the installed `modern-web-guidance/SKILL.md` and follow its current search/retrieve workflow, version flag, permissions, saved-output reading and handoff requirements. Search a focused web capability; use returned guide IDs and proceed without forcing unrelated guidance when the catalog does not cover it. Do not duplicate or pin that skill's evolving CLI instructions here.

## Change the active application

- `index.html`: native controls, structure, dialogs and publication metadata.
- `robots.txt` and `sitemap.xml`: public crawler guidance and canonical home-page entry; keep them in the asset allowlist and Wrangler build watch list.
- `styles.css`: presentation and responsive styles.
- `app.js`: playback UI, sentence sequencing, voice discovery, sync editing and persistence.
- `speech-playback.js`: DOM-independent utterance lifecycle, previews/narration, pause/resume and cancellation. Keep callback invalidation inside the controller; app tokens also invalidate shadowing timers.
- `timing.js`: locale-aware parsing, timing and session validation; `speech.js`: language definitions, demos and pure voice ranking.
- `worker/index.ts`: API routing/security; `worker/sources.ts`: source registry; `worker/jw.ts` and `worker/wiki.ts`: source extraction; `worker/http.ts`: bounded fetching; `worker/html.ts`: native HTMLRewriter record collection.
- `wrangler.jsonc`: Worker/Static Assets deployment; `scripts/build-assets.mjs`: public-asset allowlist and static headers.
- `tests/`: active regression checks and fixtures.

Keep assets in `assets/`, regression tests and fixtures in `tests/`, and project skills in `.agents/skills/`. Build future extension work separately when requested.

Keep content-source selection independent of browser speech/full-text audio. Register new sources in `worker/sources.ts`; preserve source credits and separate word-pronunciation clips from full-text narration. Report declined automated access without bypassing it. Preserve publisher segment boundaries while labeling interpolated words/sentences as estimates. Preserve complete timing validation, position-based repeated-word matching, imported timings during metadata loading, saved speed, cancellation of obsolete imports/voice/shadowing work, and local-only audio-file handling.

## Language and voice goals

- Offer exactly Hungarian (`hu`), Spanish (`es`) and German (`de`) as practice languages. Keep controls in English; do not imply translated UI or automatic text translation. Current website adapters import Hungarian and must return their language explicitly.
- Use only voices actually exposed by `speechSynthesis.getVoices()`. Handle asynchronous `voiceschanged`, an initially empty catalog, refresh, and unavailable saved choices. Never infer voice availability from browser brand or a cloud-service catalog.
- Prefer natural/neural, premium and enhanced metadata signals, then known real language-specific system families. Exclude novelty, eSpeak and MBROLA voices. Offer only the highest available tier, retaining dialect choices within that tier. Do not substitute another language or label a standard voice neural.
- Treat ranking as a heuristic: the browser has no measured quality score, and better sound does not guarantee word-boundary events. Local/default flags are tie breakers, not evidence of premium quality. Identify potentially online voices and provide preview plus install/refresh/recording guidance for standard-only or missing voices.
- Set utterance language to the chosen voice locale and use the practice locale for segmentation. Update reader/editor language attributes. Cancel obsolete speech, previews and shadowing on language changes without discarding custom text, unsaved drafts or recordings. Preserve alignment when words are unchanged; explicitly report any necessary timing reset.
- Replace only untouched demo text automatically when choosing another language. Save per-language voice choices and session language/voice preferences; legacy sessions default to Hungarian. An unavailable saved voice must degrade visibly to a matching Auto choice, never silently to another language.
- Test ranking, exclusions, dialects, metadata variants and legacy sessions with synthetic catalogs. Separately verify real exposed voices and browser UI behavior; fixture voices are not proof of audible quality or cloud availability.

## Validate the affected behavior

- For JavaScript timing/parsing/session changes, run `npm run test:browser-logic`; use `node --check app.js` when changing the browser module. Node 22.12+ runs tooling; Wrangler runs the local Worker.
- For Worker/dependency changes, use the scoped checks in the Worker environment reference.
- For frontend behavior/layout changes, start Wrangler locally using that reference and use Chrome DevTools MCP when available. Test changed controls and relevant failure paths, inspect console/network, and confirm advancing audio before claiming playback works. An HTTP 200 alone is insufficient.
- For layout changes, check 320px touch reflow, short landscape and equivalent 200% text sizing. Check keyboard operation, focus restoration, reduced motion and high contrast when relevant. Lighthouse supports these observations; it does not prove every interaction.
- For documentation-only changes, check links and command accuracy. Validate skills with the skill-creator validator; do not run application tests or the browser matrix without a separate reason.

Report actual checks and limits in the task handoff or commit message. Distinguish injected-engine tests from native browser playback and fixtures from live imports. Moving documentation is not new behavioral verification.
