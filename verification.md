# Verification

Verified locally on November 8, 2026. These results describe the standalone app.

## Three-language speech selection

On November 8, 2026, all thirteen JavaScript and twelve Python tests passed. JavaScript syntax checks and project skill validation also passed. Voice tests cover quality metadata in names/URIs, language isolation, excluded engines/novelty voices, dialect choices, asynchronous catalog changes, three demo translations, and legacy/current session validation.

Chrome DevTools MCP confirmed real exposed recommendations on this Mac: Hungarian Tünde, Spanish Mónica with Paulina as an alternative, and German Anna. These voices report standard metadata; the UI labels them accordingly and suggests installing better variants. A real voice preview entered the browser's speaking state. This establishes playback initiation, not a comparative listening assessment.

Synthetic browser catalogs verified automatic upgrades to a newly exposed natural voice, a missing-language state without cross-language fallback, Spanish locale selection for preview, and per-language/session preference persistence. Custom text and unsaved editor drafts survived language changes. Synthetic voices do not establish cloud availability or audible quality. Fixture overrides were restored afterward.

The new language and voice controls reflowed without horizontal document overflow at 320×640 with 200% root text sizing in dark/reduced-motion mode, and at 640×320 with forced colors. Current website adapters still import Hungarian; Spanish and German use pasted text, local recordings or their demos.

## Automated checks

- Five Node tests covering Hungarian offsets/paragraphs, repeated words, publisher introduction/gaps/outro, complete and ordered timing imports, multiple sync pins and session validation.
- Five standard-library Python tests: URL restrictions, chapter/track and split verse extraction, no-marker text fallback, missing-track rejection, and inline-footnote/punctuation handling.
- Locked uv environment check, Ruff lint and format checks, and ty type checking.
- Browser module syntax checked with `node --check`.

## Chrome DevTools MCP

- Opened the standalone page through the actual Python server.
- Imported the user's Hungarian Matthew 5 URL through `/api/import`: 48 publisher segments, original MP3, and 853 words after removing footnote artifacts. Confirmed real audio playback with advancing `currentTime`, duration 411.04s, and the expected verse-4 sentence at 19 seconds.
- Verified 0.75× playback, saved a session, reloaded it, and confirmed both restored speed and publisher alignment. Found and fixed native `audio.load()` resetting playback speed by preserving `defaultPlaybackRate`.
- Verified sentence repeat naturally crossing its end and returning playback to the same sentence. Verified shadowing pauses and cancellation preventing delayed resumption.
- Loaded a browser-generated local 3-second WAV after importing two word timestamps for repeated “Jó.” tokens. Imported timing mode and both distinct timestamps remained intact after metadata loading.
- Confirmed Hungarian TTS started and highlighted the current sentence. Voice word-boundary coverage varies; this observation does not establish word events for every device/voice.
- Verified sync pin creation and rejection of an out-of-order pin without replacing the prior alignment.
- Tested malformed timing import, denied browser storage, invalid/backend-private/lookalike import URLs and project-file access. Errors were shown and working text remained available; invalid import URLs returned 400 and project-source access returned 404.
- Used keyboard Enter/Escape on the native word dialog and confirmed focus returned to its opener. Used Space on the Play button and confirmed playback started once.
- Checked 320×640 touch reflow, expanded disclosures, equivalent 200% text sizing, a 640×320 landscape viewport, dark theme and reduced-motion emulation. No horizontal document overflow was observed.
- Inspected console messages after the response-header fix: no warnings or errors in the clean app state.
- Final Lighthouse snapshot audit requested with the mobile option: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 100. It analyzed the loaded page; this was not a performance/navigation benchmark. A previous audit caught undersized word targets, corrected with a 24px minimum inline size.

## Select controls and typography

On November 8, 2026, checked the CSS/HTML update in Chrome DevTools MCP: themed `base-select` menus render; ArrowDown/Enter changed the Highlight value to Word and returned focus to the select; small text computes to 15px and body text to 16px. At a 320px touch viewport with 200% text, including a long voice-name option, the document stays 320px wide after correcting playback button wrapping. Also checked short landscape, dark/reduced-motion settings and forced colors; the latter restores `appearance: auto` on both select and picker and removes the decorative arrow. The console contained no warnings/errors. A Lighthouse snapshot requested with the mobile option scored 100 in accessibility, best practices and SEO. This did not test other browser engines or repeat audio/import tests, since playback logic was unchanged.

## Root layout cleanup

Moved browser files to the project root and retained `assets/`, `tests/` and `.agents/skills/`. The five active JavaScript and five Python tests pass, as do JavaScript syntax, Ruff and ty checks. A temporary HTTP server verified the root page, modules, stylesheet and assets return 200, while Python source, configuration, skills and old `/web/` paths return 404 for both GET and HEAD. Documentation links resolve after the move. Existing `.venv/` is retained as the ignored local development environment.

## Multiple content sources

On November 8, 2026, six JavaScript and twelve Python tests pass, along with syntax, Ruff, ty and lock consistency checks. Added coverage for Wikipedia extraction without navigation/references, Wiktionary's Hungarian-only definitions and separate pronunciation, missing Hungarian sections, oversized article truncation, source mismatches, URL/redirect restrictions, and saved source credits/clip URLs. A local HTTP smoke test checked source discovery, explicit declined-access feedback, unsupported hosts, and GET/HEAD restrictions on adapter source files.

Initial live backend requests extracted Budapest article text (77,465 characters) and the alma Hungarian entry (144 characters), discovering its pronunciation MP3. Subsequent Wiktionary requests returned HTTP 403 under the site's robot policy. Live Wikimedia import availability is therefore limited in this environment. No alternative route or access-control bypass was attempted.

Chrome MCP confirmed all three source choices, a successful live Matthew 5 import with 48 timed segments, and preservation of the working text on a failed Wikimedia import. Wikipedia/Wiktionary UI success paths were then checked using explicit fixture responses: imported text selects browser speech, pronunciation remains a separate optional player, license/contributor links appear, and credits/clip URLs survive save/reload. These fixture checks do not establish live Wikimedia playback or consistent remote availability. The fixture fetch override was restored afterward.

The four-step setup reflows at 320px with 200% text sizing and at 640×320 landscape; dark/reduced-motion and forced-colors settings were checked. The clean UI console had no warnings/errors. A Lighthouse snapshot requested with the mobile option scored 100 for accessibility, best practices and SEO. The existing server on port 8765 was left untouched; testing used a separate server on 8766.

## Import error feedback

Chrome MCP checks with explicit mocked responses verified the declined-access JSON/HTTP 502 message, a non-JSON HTTP 502 response, a failed network request, and a timeout. Each displayed a readable import error, re-enabled the import button, and preserved the current text. The HTTP failure error box received focus; editing the URL cleared the message. The visible error reflows at 320px with 200% text in dark mode, and the browser console had no errors. JavaScript syntax passed. These checks exercised UI error handling without making additional requests to a blocked website.

## Speech playback extraction

On November 8, 2026, eighteen JavaScript and twelve Python tests passed after extracting `speech-playback.js`. Five new controller tests cover lifecycle forwarding, cancellation (including synchronous cancel errors), preview replacement, pause/resume, terminal cleanup, sentence chaining, unavailable APIs and synchronous engine failures. Browser module syntax, the server Ruff checks and whitespace checks passed.

Chrome DevTools MCP loaded the controller through the actual server (HTTP 200), confirmed a real German preview and narration entered the speaking state, verified narration replaced the preview, and observed paused/resumed engine state after allowing asynchronous engine updates. Changing practice language canceled speech without an error. No layout changes were made or layout matrix repeated. Testing used an owned server on port 8766.

## Observed word-boundary support

On November 8, 2026, twenty JavaScript tests passed, including named-word detection, malformed/sentence event rejection, completion without word events, and cancellation/error isolation. Chrome DevTools MCP observed real German preview speech and word events. Explicit fixture callbacks verified the no-word completion message, sentence fallback in Word mode, ignoring sentence events, transition to active word highlighting, and clearing observations on a language change. The overridden speech method was restored. The status reflowed at 320px with 200% text in dark/reduced-motion mode without horizontal overflow. Observations apply to individual utterances, not a permanent voice capability guarantee.

## Event-driven speech controls

On November 8, 2026, twenty-one JavaScript tests passed, including delayed start/pause/resume acknowledgement and stale-start cancellation. Chrome DevTools MCP verified a real German utterance transitioned from Cancel start to Pause, then Resume after the pause event and Pause after resumption. Language changes restored Play. Explicit fixture engine calls verified canceling startup suppresses late start events, pending pause/resume controls remain cancelable, and a network error restores Play. Browser method overrides were restored. At 320px with 200% text, dark mode and reduced motion, no horizontal overflow was observed. Module syntax and whitespace checks passed.

## Speech-controller interaction regression coverage

On November 8, 2026, all twenty-six JavaScript tests passed. Five additional controller tests exercise rapid Hungarian/Spanish/German voice replacements, narration interrupting a playing preview, preview interrupting paused narration, repeated pause/resume followed by cancellation, and word-support observations resetting between preview and narration. Interrupted utterances receive late start, pause, resume, boundary, error and end callbacks to verify they cannot alter replacement state or advance sentences. These deterministic Node tests use injected speech-engine fixtures; they do not assess installed voices, audible quality or real browser engine behavior. No application code changed and browser checks were not repeated for this test-only update.
