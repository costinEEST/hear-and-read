# Implementation and tooling

The running application uses root-level HTML, CSS and JavaScript files, an `assets/` directory, and a Python backend for website imports. Tests and fixtures live in `tests/`; agent instructions live in `.agents/skills/`.

Use no frontend framework or build step. Keep native controls, safe text insertion, errors at recovery boundaries, and a non-package uv project with `.python-version`, ignored `.venv/`, a lockfile, Ruff and ty.

## Dependencies

All Python dependency declarations include their rationale in `pyproject.toml`. `uv.lock` records the resolved versions.

| Dependency | Scope | Purpose and reason |
| --- | --- | --- |
| Beautiful Soup | Backend runtime | Tolerant HTML parsing and DOM/CSS queries for publisher media links, verses and paragraphs; `html.parser` alone has no tree query API. It uses the standard-library parser. |
| HTTPX | Backend runtime | Explicit network timeouts, streamed response size limits, status handling and redirect control for publisher requests. |
| Ruff | Development | Linting, import sorting and formatting, absent from the standard library. |
| ty | Development | Python static type checks; execution and compilation cannot establish static type correctness. `uv check --locked` uses the enabled uv preview integration. |

The HTTP server, JSON, URL parsing, command-line arguments and Python tests use the standard library. JavaScript tests use Node's built-in test runner and assertions. There are no frontend npm dependencies, including development/browser automation packages. `package.json` is only a convenient test command.

## Import boundary

The server binds to `127.0.0.1`. `GET /api/sources` lists registered sources. `POST /api/import` selects an adapter by URL hostname and checks any explicit source selection. Only registered HTTPS hosts are accepted; each adapter validates paths, credentials, ports and every redirect before connecting. Fetching uses bounded response sizes and timeouts. The endpoint returns plain text and structured media/source information, never source HTML. Page data is inserted with `textContent`, not interpolated into HTML. Static serving uses an explicit allowlist for public application files, including HEAD requests; Python source, configuration, skills and the environment remain inaccessible. Audio streams directly in the browser.

`content_import.py` owns the adapter registry and source descriptions/examples used by the UI. `jw_import.py` extracts original recordings and publisher markers; `wiki_import.py` extracts Hungarian Wikipedia paragraphs and Wiktionary's Magyar definitions. `source_http.py` shares bounded fetching and redirect revalidation. To add a source, implement its path/host validation and importer, return the common document shape (`title`, `text`, `audioUrl`, `duration`, `segments`, `timingSource`, `sourceUrl`, `source`, optional `pronunciationUrl`/`notice`), register its description/example, extend browser source-link validation in `timing.js`, and add extraction/URL-policy tests. Do not turn the endpoint into an arbitrary URL proxy.

Wikipedia and Wiktionary imports select browser speech by default. Pronunciation clips remain separate from full-text recordings and never receive definition-word timings. Text attribution and license/contributor links survive saved/exported sessions. Editing imported text keeps attribution and labels it edited. HTTP 403/429 is reported as declined automated access with manual paste/retry guidance; do not work around source access controls. Long articles are capped at whole paragraph boundaries with a visible truncation notice.

The reader has one mounted full-text audio element and a separate optional word-pronunciation player. Only one listening mode plays at a time. A source replacement pauses old playback and revokes obsolete object URLs. Voice utterances and shadowing timers have explicit cancellation; an obsolete import response cannot overwrite a newer text/source selection. Imported word timings are validated completely before replacing the current alignment. Publisher verse timings anchor word estimates; imported timestamps have no claimed fixed accuracy.

Browser storage holds versioned session documents. It never stores audio bytes. Failed reads do not overwrite existing storage; failed writes leave the current session available for export. Native `dialog` supplies focus containment and restoration; copy failures are reported inside that dialog. Normal controls keep their native keyboard behavior, and document-level shortcuts ignore interactive elements.

## Practice languages and voice selection

`speech.js` defines the only supported practice languages (`hu`, `es`, `de`), demo text/translations, and pure ranking functions. Sentence segmentation uses the selected locale; reading/editor language attributes and utterance locale follow the practice language and selected voice. Interface language remains English. `content_import.py` returns an explicit language; current adapters return Hungarian. Imported text changes practice language before parsing, with notice when it changes the selection.

Voice discovery uses only `speechSynthesis.getVoices()` and updates on `voiceschanged` or manual refresh. Ranking excludes known novelty/eSpeak/MBROLA voices and never crosses language boundaries. Quality signals in names/URIs are ranked natural/neural, premium, enhanced, then browser/provider and standard families. Known language-specific system names, preferred locale, default and local flags break ties; `localService` alone is not a quality claim. Only the top tier is offered; for unlabeled standard voices, known language-specific families are preferred over unclassified voices. Auto reranks when discovery updates. Manual choices unavailable in the current top tier fall back visibly to Auto, without forgetting their saved preference.

The browser API has no quality score or guaranteed word-boundary capability. A quality label is a metadata heuristic, not a listening-test result. Do not assume Azure or a browser's built-in reader catalog is exposed to the page, or that installing a premium voice guarantees exposure. Online voices are identified as potentially sending text to a speech service. Missing/standard-only voice states offer install/refresh/recording guidance instead of hidden wrong-language or robotic fallbacks. Preview uses a short language-specific sentence at normal speed, the chosen locale, and the same cancellation path as full speech.

Voice preferences use `hear-and-read.voice-preferences.v1`, separately from saved practice sessions. Sessions include language and voice choice; older sessions default to Hungarian. Language changes preserve custom text, editor drafts, recording URLs and existing word alignment when tokenization is unchanged; they cancel speech/preview/shadowing work. Only untouched demos without attached recordings are automatically replaced with the newly selected demo. Language selection does not translate content.

## Select controls and typography

`styles.css` defines native select styling and shared typography roles. Selects use `appearance: base-select` and themed picker/options/checkmarks only inside a support query; other browsers retain a native options menu with a styled trigger. Forced-colors mode restores `appearance: auto` for both the control and picker. Keep native select semantics, labels and keyboard behavior; no JavaScript combobox is needed.

Use the shared `--text-*` and `--leading-*` tokens for new styles: small text starts at `.9375rem`, body/controls at `1rem`, and reading text remains a steady serif size. Headings combine rem and viewport units within bounded clamps. Do not shrink reading/UI text at mobile breakpoints or set the root font size. Check narrow layouts with 200% text sizing; playback actions wrap according to their content rather than being forced into equal half-width columns.

## Known limits

- Publisher selectors and metadata are undocumented and may change. Matthew 5 and initial Wikimedia extraction were checked live; fixtures cover extraction boundaries. Wikimedia subsequently returned HTTP 403 in this environment, so availability is not guaranteed.
- Original recording word timings are estimates unless supplied or edited. Sentence loop/shadowing boundaries derived from them have the same limitation.
- Voice availability, word-boundary events and audio playback depend on the browser/device. Browser voices can use an external voice service.
- Background tabs can throttle animation and media events, so loop/pause boundaries can overshoot. This is a listening aid, not a sample-accurate audio editor.
- A remote audio server can reject playback. Selecting the downloaded audio locally is supported.
- This server is for local personal use. Multiuser hosting, authentication, server persistence and the future browser extension are outside this refactor.

## Speech playback module

`speech-playback.js` owns browser utterances, strong references, pause/resume, cancellation and lifecycle callback filtering. It has no DOM or sentence-model dependencies; injected browser APIs allow lifecycle regression tests. Both previews and narration use this controller. Terminal events release the utterance before notifying the caller, allowing the next sentence to start safely. Cancellation invalidates callbacks before calling the engine, including synchronous cancellation errors.

`app.js` owns sentence sequencing, repeat/shadowing delays, highlighting and UI state. Its speech token also invalidates pending shadowing timers. Voice discovery and preferences remain in the app; ranking stays in `speech.js`. Keep the server asset allowlist synchronized when adding browser modules.

Word-boundary capability is observed per utterance (including previews), not inferred from voice quality or an event-handler property. Only named `word` events with valid character offsets establish support; sentence events are ignored for word mapping. Until then, enabled word highlighting falls back to the sentence. Completion without word events reports that observation without permanently classifying the voice; cancellation and errors do not establish missing support. The visible capability text is passive to avoid repeated screen-reader announcements during sentence chaining.

Speech controls follow controller lifecycle notifications: requests enter starting/pausing/resuming states, while `start`, `pause` and `resume` events acknowledge the actual engine state. Pending requests remain cancelable; repeated clicks do not queue extra utterances. Terminal events and explicit cancellation clear active playback, and obsolete events cannot restore it. Voice changes during startup restart the pending narration with the new selection; catalog refresh only cancels paused narration. Keep startup and preview state separate from actual narration playback and original-recording events.

Explicit word/selection pronunciation uses controller kind `pronunciation` without a sentence-completion callback, so it never advances or loops. It pauses existing media without changing the selected audio source or recording position. Capture only non-collapsed ranges wholly inside the reader, exclude translation text, and clear captured text on reader rebuilds. Preserve native text selection and do not trigger normal word-click playback when a range is selected. Errors in Word options remain inside the dialog.

Volume is shared by both HTML audio elements and all utterance kinds. Pitch is speech-only and defaults to 1. The controller clamps finite API values (volume 0–1, pitch 0–2) and preserves zero; invalid values default to 1. Session validation uses the same ranges with legacy defaults. Slider input updates media volume immediately and cancels active speech rather than assuming live utterance mutation is honored. Range controls retain native keyboard behavior and expose formatted values with aria-valuetext. Device volume/pitch implementation can vary.
