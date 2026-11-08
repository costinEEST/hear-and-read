# Maintenance invariants and checks

Read the section relevant to the change. The main skill owns language/voice policy and general validation; the Python reference owns setup commands. Dependencies explain their rationale in `pyproject.toml`.

## Content imports and serving

- Bind the local server to loopback. Keep static GET/HEAD serving on an explicit public-asset allowlist; add browser modules there when introduced. Never expose source files, archives, environment or configuration.
- `content_import.py` owns source registration and UI descriptions/examples. New adapters validate HTTPS hosts, paths, credentials, ports and every redirect. Keep bounded fetching/timeouts in `source_http.py`; do not make an arbitrary URL proxy.
- Return plain text and the shared document shape: `title`, `text`, `language`, `audioUrl`, `duration`, `segments`, `timingSource`, `sourceUrl`, `source`, optional `pronunciationUrl`/`notice`. Extend source-link validation in `timing.js` and extraction/URL-policy tests when adding sources.
- Insert fetched content with textContent. Keep credits, license/history links and edited-source labels across session export/load. Truncate long articles at paragraph boundaries with a notice.
- Keep pronunciation clips separate from full-text audio and definition timings. Surface HTTP 403/429 with manual-paste/retry guidance; do not bypass declined access.
- Source replacement cancels obsolete imports/playback and revokes obsolete object URLs. Validate complete timing imports before replacing alignment; audio metadata must not overwrite imported timings or saved speed.

## Speech and pronunciation

- The controller owns utterance references, lifecycle notifications and stale-callback suppression; the app owns sequencing, highlighting and shadowing timers. Release a terminal utterance before calling completion, and invalidate callbacks before canceling the engine, which may call back synchronously.
- Starting/pausing/resuming are pending requests. Only engine start/pause/resume events acknowledge those states. Keep pending requests cancelable; never mark queued narration as playing. Preserve separate preview controls and original-recording events.
- Observe word support per utterance, including previews. Require named word events with valid character offsets. Sentence events do not establish word support. Fall back to sentence highlighting until words arrive; only successful completion without word events establishes that observation. Cancellation/errors do not prove missing support.
- Word/selection pronunciation must not chain or loop. It pauses existing media without changing recording position or listening mode. Capture non-collapsed selections wholly inside the reader, exclude translations and clear captured text on rebuilds. Preserve native selection and ordinary word-click behavior. Keep dialog errors inside the dialog.
- Volume applies to both media elements and all speech kinds; pitch affects speech only. Preserve mute (0), default both settings to 1, clamp volume to 0–1 and pitch to 0–2. Store both in sessions with legacy defaults. Stop active speech on slider changes; do not assume mutating an active utterance works. Pitch is not a quality upgrade.

## Persistence

- Read and write sessions only through `hear-and-read.sessions.v1`. Do not overwrite malformed storage after a failed read.
- Store versioned JSON, never audio bytes. Preserve source credits, language, voice preferences, alignment, speed, volume and pitch. Failed storage writes leave practice/export usable. Test defaults for legacy documents and validate URLs before loading saved remote media.

## Reader styling

- Keep native select semantics. Limit base-select enhancements to support queries and restore native appearance in forced colors. Use existing typography tokens; do not shrink text on mobile or set a root font size.
- Keep highlight target separate from background/underline/combined style. Use existing active elements, a thicker word underline, visible keyboard focus and system-color outlines in forced colors. Honor Off.
- Word targets retain native keyboard behavior; global shortcuts ignore interactive controls. Native dialogs contain/restore focus. Reader auto-scroll must not move setup fields or keyboard focus.

## Targeted browser smoke checks

For affected behavior, use the actual Python server and Chrome DevTools MCP when available. Stop any server you started; leave existing user servers alone.

- Speech: verify real startup and advancing playback, pause/resume acknowledgements, startup cancellation, previews, word/selection completion, rapid voice changes, missing-word fallback and late callback isolation. Inject engines for deterministic failure paths and restore overrides afterward; they do not prove audible quality.
- Recordings/timing: verify advancing currentTime, speed after metadata loading, repeat/shadowing cancellation, repeated-word timings and out-of-order pin rejection. Check that new audio metadata preserves imported alignment.
- Imports: verify source controls, successful fixtures, errors preserving current text, credits and separate pronunciation. Distinguish actual remote requests from fixtures; a site may decline live access.
- Persistence: check save/load/export, legacy defaults, blocked/malformed/full storage and portable local-audio re-selection. Restore temporary test records.
- UI: check native keyboard interaction, dialog focus, 320px/200% text reflow, short landscape, dark/reduced-motion and forced colors where relevant. Inspect console/network. An audit score or HTTP 200 does not establish playback or every interaction.

## TODO: extension speech adapter

- [ ] When implementing the extension, adapt chrome.tts lifecycle/boundary events to the controller interface. Use voice metadata and requiredEventTypes to select engines supporting word events; preserve cancellation and stale-callback isolation.

chrome.tts requires an extension context and is unavailable to the ordinary page. Word-event support does not guarantee better audio quality. See the [Chrome TTS documentation](https://developer.chrome.com/docs/extensions/reference/api/tts).
