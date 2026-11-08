<img src="assets/wordmark.svg" alt="Hear & Read — Listen. Follow. Repeat." width="400">

# Hear & Read

**Listen. Follow. Repeat.**

A personal listening practice studio for **Hungarian, Spanish and German**, with audio, highlighted text, sentence looping, and editable word timings. Import Hungarian content from supported websites, or bring your own audio and text in any of the three practice languages. Built with plain HTML, CSS and JavaScript, with a small Python backend for website imports.

## Contents

- [Run locally](#run-locally)
- [Start practicing](#start-practicing)
- [Timing accuracy](#timing-accuracy)
- [Save your practice](#save-your-practice)
- [Development](#development)

## Run locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run these commands from the repository root:

```sh
uv sync --locked
uv run --locked python server.py
```

Open **http://127.0.0.1:8765** in your browser. Keep the terminal running; press **Ctrl+C** to stop the server. There is no frontend package installation or build step.

For environment details, another port, dependency changes and development checks, see the [Python environment reference](.agents/skills/maintain-hear-and-read/references/python-environment.md).

## Start practicing

- **Website content:** under **Choose your content**, select a website or **Detect from URL**, paste a page URL, and select **Import content**. **Use an example** fills in a sample URL without importing it automatically.
- **Practice language:** choose **Magyar / Hungarian**, **Español / Spanish**, or **Deutsch / German**. This sets pronunciation and sentence handling; it does not translate your text. Custom text, drafts and recordings are preserved. When viewing an untouched demo, choosing a language loads that language's demo.
- **Your own recording:** select **Original recording**, expand **Use your own audio** and select a file or paste an HTTPS audio URL. Paste matching text in the selected language, then press **Apply text**.
- **Browser voice:** leave the voice on **Auto · best available**, use **Test voice**, then press **Play**. Only the highest available quality tier is offered; natural/neural, premium and enhanced variants are preferred over standard voices. Recommendations use voice metadata, not a measured audio-quality score. If only a standard voice exists, the app says so; it never substitutes another language. Use **Refresh voices** after installing voices on your device.

Click words to seek. Repeat a sentence, add 1.8-second shadowing pauses, blur/hide the text, or switch off **Follow words** to move the highlight manually. English translations are provided only for the built-in demos. Keyboard shortcuts outside controls are Space to play/pause and ← / → to change sentence. Native buttons, inputs and word controls also work from the keyboard.

Voice choices are remembered separately for each language in this browser. Sessions also save their practice language and voice preference. Available voices vary across browser/device combinations. Some voices need an online speech service; the app identifies them. Natural/premium quality and word-boundary events are not guaranteed. Install enhanced/premium system voices for more choices, or use a human recording. Current website imports remain Hungarian and switch the practice language to Hungarian explicitly.

| Website | What is imported | How to listen |
| --- | --- | --- |
| JW.org (Hungarian) | Text, original recording, and publisher segment timings when available | Original recording is selected automatically. |
| Hungarian Wikipedia | Article paragraphs, excluding references/navigation | Browser voice is selected; you can add your own matching recording. |
| Hungarian Wiktionary | The entry's Hungarian definitions and available pronunciation clip | Browser voice reads the definitions. A separate player pronounces the word only. |

Website imports are independent of the listening method. More source adapters can be added; unsupported websites can still be used by pasting text manually. Import failures preserve your current practice. Some websites decline automated requests or impose rate limits; if this happens, open the page and paste its text, or try later. The importer does not bypass access restrictions.

Imported Wikipedia/Wiktionary text retains its original-page, contributor-history and license links in the reader and saved/exported sessions. Article text is limited to 100,000 characters, with a notice if shortened. Wiktionary entries without a Hungarian section cannot be imported automatically.

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

**Save session** stores text, timings, title, playback speed and remote audio URL in this browser. **Export session** creates a portable JSON file; import it on the same or another device. **Export timings** exports only word timings.

Uploaded audio stays in memory and is not saved or uploaded. Select the original local audio file again after reloading or importing its saved session. Browser storage may be cleared by your browser; export sessions you want to keep. If storage is blocked or full, practice and JSON export still work.

## Development

The [project maintenance skill](.agents/skills/maintain-hear-and-read/SKILL.md) covers the source layout, development workflow, checks, and when to use Modern Web Guidance. See [tooling.md](tooling.md) for implementation rationale, [BRANDING.md](BRANDING.md) for brand assets and publication metadata, and [verification.md](verification.md) for dated verification results. Assets, tests and agent skills retain their own folders; application source files live at the project root.

To practice pronunciation, choose **Speak this word** for the current word (also available in Word options), or select practice text in the reader and choose **Speak selection**. Both use your chosen browser voice and speed, pause existing playback, and stop after that text. **Stop pronunciation** cancels the sample. Normal word clicks continue to jump into sentence playback.

**Volume** adjusts recordings, pronunciation clips and browser speech; zero mutes them. **Advanced speech settings → Pitch** changes browser speech tone, defaults to `1`, and has a reset button. Pitch does not improve voice quality or change recordings. Changes stop active browser speech; press Play or test the voice again. Recording volume applies immediately, subject to device support. Sessions retain both settings.
