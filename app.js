import {
  DEMO,
  parseText,
  estimate,
  publisherTimings,
  activeAt,
  validateTimings,
  pinTimings,
  validateSession,
  validateSource,
  validatePronunciation,
  formatTime,
} from "./timing.js";
import { LANGUAGES, DEMOS, bestVoices, languageConfig } from "./speech.js";

import { createSpeechPlayback } from "./speech-playback.js";

const speech = createSpeechPlayback({ onstatechange: renderSpeechState });
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const pronunciation = $("pronunciation");
const STORE = "magyar-studio.sessions.v1";
const VOICE_STORE = "hear-and-read.voice-preferences.v1";
const state = {
  language: "hu",
  selectionText: "",
  voiceChoices: { hu: "auto", es: "auto", de: "auto" },
  voiceEntries: [],
  text: DEMO.text,
  title: DEMO.title,
  parsed: parseText(DEMO.text),
  timings: [],
  timingSource: "estimated",
  mode: "tts",
  activeWord: -1,
  activeSentence: -1,
  selectedWord: 0,
  repeat: false,
  loopSentence: 0,
  sync: false,
  anchors: new Map(),
  playing: false,
  voices: [],
  speechToken: 0,
  wordStatus: "idle",
  timer: null,
  raf: null,
  objectUrl: "",
  audioName: "",
  duration: 0,
  lastTime: 0,
  revealed: false,
  sentences: [],
  wordElements: [],
  sentenceElements: [],
  sessions: [],
  storageOK: true,
  documentEpoch: 0,
  speed: 1,
  source: null,
  pronunciationUrl: "",
  sources: [],
};
state.timings = estimate(state.parsed.words, state.parsed.words.length * 0.48);
const notice = (message) => {
  $("notice").textContent = message;
};
const error = (message) => {
  $("error").textContent = message;
};
const guard = (fn) => async (event) => {
  try {
    await fn(event);
  } catch (failure) {
    error(failure.message || "Something went wrong. Please try again.");
  }
};
const on = (id, event, fn) => $(id).addEventListener(event, guard(fn));

function cancelGap() {
  clearTimeout(state.timer);
  state.timer = null;
  $("your-turn").hidden = true;
}
function renderSpeechState({ status, kind }) {
  $("stop-pronunciation").hidden = kind !== "pronunciation" || ["idle", "error"].includes(status);
  if (kind === "pronunciation") return;
  const labels = {
    idle: "Play", starting: "Cancel start", speaking: "Pause",
    pausing: "Cancel pause", paused: "Resume", resuming: "Cancel resume", error: "Play",
  };
  if (kind === "preview") {
    $("preview-voice").textContent = status === "starting" ? "Cancel sample" :
      ["idle", "error"].includes(status) ? "Test voice" : "Stop sample";
    return;
  }
  if (state.mode !== "tts") return;
  state.playing = status === "speaking" || status === "pausing";
  $("play").textContent = labels[status];
}
function showWordStatus(status) {
  const changed = state.wordStatus !== status;
  state.wordStatus = status;
  const messages = {
    idle: "Word highlighting is checked during playback, including voice samples.",
    checking: "Listening for word events. Sentence highlighting is used until they arrive.",
    word: "Word events detected in this playback. Word highlighting is available when enabled.",
    sentence: "No word events received in the completed playback. Sentence highlighting was used; another voice may support words.",
  };
  const message = messages[status];
  if ($("word-status").textContent !== message) $("word-status").textContent = message;
  if (changed && state.activeSentence >= 0) setActive(state.activeWord, state.activeSentence, false);
}
function stopSpeech() {
  state.speechToken++;
  speech.stop();
  showWordStatus("idle");
  $("preview-voice").textContent = "Test voice";
}
function stop() {
  pronunciation.pause();
  cancelGap();
  stopSpeech();
  audio.pause();
  cancelAnimationFrame(state.raf);
  state.playing = false;
  $("play").textContent = "Play";
}
function renderCredit() {
  const source = state.source;
  $("content-credit").hidden = !source;
  if (!source) return;
  $("credit-name").textContent =
    `${source.edited ? "Edited text from" : "Content from"} ${source.name}`;
  $("credit-link").href = source.url;
  $("credit-license-wrap").hidden = !source.licenseUrl;
  if (source.licenseUrl) {
    $("credit-license").href = source.licenseUrl;
    $("credit-license").textContent =
      `${source.licenseName} (opens in new tab)`;
    $("credit-history").href = source.historyUrl;
  }
  const hasPronunciation = Boolean(state.pronunciationUrl);
  pronunciation.hidden = !hasPronunciation;
  $("pronunciation-note").hidden = !hasPronunciation;
  if (
    hasPronunciation &&
    pronunciation.getAttribute("src") !== state.pronunciationUrl
  )
    pronunciation.src = state.pronunciationUrl;
}
function clearCredit() {
  state.source = null;
  state.pronunciationUrl = "";
  pronunciation.pause();
  pronunciation.removeAttribute("src");
  pronunciation.load();
  $("content-credit").hidden = true;
}
function sourceSelection() {
  return document.querySelector('input[name="content-source"]:checked').value;
}
function updateSourceHelp() {
  const selected = state.sources.find(
    (source) => source.id === sourceSelection(),
  );
  $("source-help").textContent = selected
    ? selected.description
    : "Supported now: " +
      state.sources.map((source) => source.name).join(", ") +
      ". Paste a page URL to detect its source.";
  $("content-url").placeholder = selected?.example || "https://…";
  $("source-example").disabled = !state.sources.length;
}
async function loadSources() {
  try {
    const response = await fetch("/api/sources");
    if (!response.ok) throw new Error("Source list unavailable");
    const { sources } = await response.json();
    state.sources = sources;
    for (const source of sources) {
      const label = document.createElement("label"),
        input = document.createElement("input"),
        span = document.createElement("span"),
        help = document.createElement("small");
      input.type = "radio";
      input.name = "content-source";
      input.value = source.id;
      input.id = `content-${source.id}`;
      label.htmlFor = input.id;
      span.textContent = source.name;
      help.textContent = source.description;
      span.append(help);
      label.append(input, span);
      $("content-sources").append(label);
    }
    updateSourceHelp();
  } catch {
    $("source-help").textContent =
      "Website imports require the Python server. You can still paste text and choose a voice or audio file.";
    $("content-import").disabled = true;
  }
}
function sentenceTimes(index) {
  const sentence = state.parsed.sentences[index];
  if (!sentence) return null;
  return {
    start: state.timings[sentence.words[0].index]?.start || 0,
    end: state.timings[sentence.words.at(-1).index]?.end || 0,
  };
}
function updateTimingLabel() {
  const labels = {
    estimated: [
      "Estimated words",
      "Word timings are estimated from text length. Use the sync editor or import timestamps to improve them.",
    ],
    publisher: [
      "Publisher segments · estimated words",
      "Verse/paragraph boundaries come from JW.org. Word and sentence positions inside them are estimates.",
    ],
    imported: [
      "Imported word timings",
      "Following your imported timestamps. Their accuracy depends on the source and the matching recording.",
    ],
    manual: [
      "Manually adjusted timings",
      "Following your edited timestamps, with estimated timings between sync pins.",
    ],
  };
  const [badge, note] =
    state.mode === "tts"
      ? [
          "Browser voice",
          "Word highlighting follows voice boundary events when available. The timeline is an estimate; seeking starts a sentence.",
        ]
      : labels[state.timingSource];
  $("timing-badge").textContent = badge;
  $("timing-note").textContent = note;
  $("pin-count").textContent =
    `${state.anchors.size} ${state.anchors.size === 1 ? "pin" : "pins"}`;
  $("sync").disabled = state.mode !== "audio";
  $("distribute").disabled = state.mode !== "audio";
}
function refreshTimeline(time = 0) {
  const total =
    state.mode === "audio" && Number.isFinite(audio.duration)
      ? audio.duration
      : state.timings.at(-1)?.end || 0;
  $("seek").max = String(total || 1);
  $("seek").value = String(Math.min(time, total));
  $("elapsed").textContent = formatTime(time);
  $("duration").textContent = formatTime(total);
  $("seek").disabled = !state.parsed.words.length;
}
function updateReaderOptions() {
  const hidden = $("hide-text").value === "hidden" && !state.revealed;
  $("reader").hidden = hidden;
  $("listening-test").hidden = !hidden;
  $("reader").classList.toggle(
    "blur",
    $("hide-text").value === "blur" && !state.revealed,
  );
  const showTranslation =
    $("translation").getAttribute("aria-pressed") === "true";
  document
    .querySelectorAll(".translation")
    .forEach((el) => (el.hidden = !showTranslation));
  setActive(state.activeWord, state.activeSentence, false);
}
function setActive(wordIndex, sentenceIndex, scroll = true) {
  const changed =
    wordIndex !== state.activeWord || sentenceIndex !== state.activeSentence;
  state.wordElements[state.activeWord]?.classList.remove("active");
  state.sentenceElements[state.activeSentence]?.classList.remove("active");
  state.wordElements[state.activeWord]?.removeAttribute("aria-current");
  state.activeWord = wordIndex;
  state.activeSentence = sentenceIndex;
  if (wordIndex >= 0) {
    state.selectedWord = wordIndex;
    state.wordElements[wordIndex]?.setAttribute("aria-current", "true");
  }
  const highlight = $("highlight").value;
  if (highlight === "both" || highlight === "word")
    state.wordElements[wordIndex]?.classList.add("active");
  if (highlight === "both" || highlight === "sentence" ||
      (highlight === "word" && state.mode === "tts" && state.wordStatus !== "word"))
    state.sentenceElements[sentenceIndex]?.classList.add("active");
  if (
    changed &&
    scroll &&
    $("scroll").checked &&
    state.playing &&
    !$("reader").hidden
  ) {
    const element =
      state.wordElements[wordIndex] || state.sentenceElements[sentenceIndex];
    if (element) {
      const rect = element.getBoundingClientRect(),
        bounds = $("reader").getBoundingClientRect();
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
        // Scroll only the reading pane, keeping setup fields and keyboard focus stable.
        $("reader").scrollTop += rect.top - bounds.top - bounds.height / 2;
      }
    }
  }
}
function renderReader() {
  state.selectionText = "";
  $("speak-selection").disabled = true;
  const demo = DEMOS[state.language];
  const fragment = document.createDocumentFragment();
  state.wordElements = [];
  state.sentenceElements = [];
  let paragraph = null,
    previousParagraph = -1;
  state.parsed.sentences.forEach((sentence, index) => {
    if (previousParagraph !== sentence.paragraph) {
      paragraph = document.createElement("p");
      fragment.append(paragraph);
      previousParagraph = sentence.paragraph;
    }
    const span = document.createElement("span");
    span.className = "sentence";
    span.dataset.sentence = String(index);
    for (const word of sentence.words) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "word";
      button.textContent = word.text;
      button.dataset.word = String(word.index);
      span.append(button, document.createTextNode(" "));
      state.wordElements.push(button);
    }
    paragraph.append(span, document.createTextNode(" "));
    state.sentenceElements.push(span);
    if (state.text === demo.text) {
      const translation = document.createElement("span");
      translation.className = "translation";
      translation.lang = "en";
      translation.textContent = demo.translations[index] || "";
      translation.hidden = true;
      paragraph.append(translation);
    }
  });
  $("reader").replaceChildren(fragment);
  if (!state.parsed.words.length)
    $("reader").textContent = `Add ${languageConfig(state.language).name} text to start practicing.`;
  $("translation").disabled = state.text !== demo.text;
  if (state.text !== demo.text)
    $("translation").setAttribute("aria-pressed", "false");
  $("reading-title").textContent = state.title;
  $("title").value = state.title;
  $("text").value = state.text;
  $("word-count").textContent =
    `${state.parsed.words.length} words · ${state.parsed.sentences.length} sentences`;
  $("edit-word").max = String(state.parsed.words.length);
  $("play").disabled = !state.parsed.words.length;
  $("word-options").disabled = !state.parsed.words.length;
  renderCredit();
  setActive(-1, -1, false);
  updateReaderOptions();
  refreshTimeline();
  updateTimingLabel();
}
function setSync(enabled) {
  state.sync = enabled && state.mode === "audio";
  $("sync").setAttribute("aria-pressed", String(state.sync));
  $("sync-hint").hidden = !state.sync;
}
function setMode(mode) {
  stop();
  state.mode = mode;
  state.documentEpoch++;
  $("source-tts").checked = mode === "tts";
  $("source-audio").checked = mode === "audio";
  $("tts-panel").hidden = mode !== "tts";
  $("audio-panel").hidden = mode !== "audio";
  setSync(false);
  setActive(-1, -1, false);
  updateTimingLabel();
  refreshTimeline();
}
function releaseAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = "";
  state.audioName = "";
  state.duration = 0;
}
function setAudio(url, name) {
  releaseAudio();
  audio.defaultPlaybackRate = state.speed;
  audio.src = url;
  audio.playbackRate = state.speed;
  audio.preservesPitch = true;
  state.audioName = name;
  $("audio-name").textContent = name;
  // Load metadata only after the user explicitly selects a recording.
  audio.preload = "metadata";
  audio.load();
}
function resetText(text, title) {
  if (text.length > 100000)
    throw new Error("Text must be at most 100,000 characters.");
  stop();
  state.documentEpoch++;
  state.text = text;
  state.title = title || "Untitled practice";
  clearCredit();
  state.parsed = parseText(text, state.language);
  state.anchors.clear();
  state.selectedWord = 0;
  state.timings = estimate(
    state.parsed.words,
    state.duration || state.parsed.words.length * 0.48,
  );
  state.timingSource = "estimated";
  state.revealed = false;
  state.repeat = false;
  $("repeat").setAttribute("aria-pressed", "false");
  setSync(false);
  if (audio.hasAttribute("src")) audio.currentTime = 0;
  renderReader();
  error("");
}
function applySoundSettings() {
  const volume = Number($("volume").value), pitch = Number($("pitch").value);
  audio.volume = volume;
  pronunciation.volume = volume;
  const volumeLabel = volume === 0 ? "Muted" : `${Math.round(volume * 100)}%`;
  $("volume-value").value = volumeLabel;
  $("volume").setAttribute("aria-valuetext", volumeLabel);
  $("pitch-value").value = `${pitch.toFixed(2)}${pitch === 1 ? " (default)" : ""}`;
  $("pitch").setAttribute("aria-valuetext", `${pitch.toFixed(2)}${pitch === 1 ? ", default" : ""}`);
}
function speechSoundOptions() {
  return { volume: Number($("volume").value), pitch: Number($("pitch").value) };
}
function loadSession(value) {
  const data = validateSession(value);
  stop();
  releaseAudio();
  setPracticeLanguage(data.language);
  state.voiceChoices[data.language] = data.voiceChoice;
  loadVoices();
  setMode(data.mode);
  resetText(data.text, data.title);
  state.timings = data.timings;
  state.timingSource = data.timingSource;
  state.source = data.source;
  state.pronunciationUrl = data.pronunciationUrl;
  renderCredit();
  $("volume").value = String(data.volume);
  $("pitch").value = String(data.pitch);
  applySoundSettings();
  state.speed = data.speed;
  $("speed").value = String(data.speed);
  $("speed-value").value = `${data.speed.toFixed(2)}×`;
  if (data.audioUrl)
    setAudio(data.audioUrl, data.audioName || "Saved recording");
  else if (data.mode === "audio") {
    $("audio-name").textContent =
      "Select the original audio file again; its saved word timings are preserved.";
  }
  updateTimingLabel();
  refreshTimeline();
  notice(
    `Loaded “${state.title}”.${data.mode === "audio" && !data.audioUrl ? " Select your audio file again." : ""}`,
  );
}
function snapshot() {
  return validateSession({
    version: 1,
    title: $("title").value || state.title,
    text: state.text,
    language: state.language,
    voiceChoice: state.voiceChoices[state.language],
    timings: state.timings,
    timingSource: state.timingSource,
    speed: Number($("speed").value),
    ...speechSoundOptions(),
    mode: state.mode,
    audioUrl: audio.getAttribute("src")?.startsWith("https:") ? audio.src : "",
    audioName: state.audioName,
    source: state.source,
    pronunciationUrl: state.pronunciationUrl,
  });
}

async function playAudio() {
  if (speech.active) stopSpeech();
  pronunciation.pause();
  if (!audio.hasAttribute("src"))
    throw new Error("Select a recording first, or choose Browser voice.");
  cancelGap();
  try {
    await audio.play();
    error("");
  } catch {
    state.playing = false;
    $("play").textContent = "Play";
    throw new Error(
      "The recording could not play. Check its URL or choose a local audio file.",
    );
  }
}
function currentVoice() {
  const choice = state.voiceChoices[state.language];
  return $("voice").value === "auto" ? state.voices[0] : state.voices.find((voice) => voice.voiceURI === choice);
}
function speakSentence(index, fromWord = null) {
  pronunciation.pause();
  if (!speech.available)
    throw new Error(
      "Speech synthesis is unavailable. Use an original recording instead.",
    );
  const voice = currentVoice();
  if (!voice)
    throw new Error(
      `No suitable ${languageConfig(state.language).name} voice is available in this browser. Install a matching voice, refresh voices, or use a recording.`,
    );
  const sentence = state.parsed.sentences[index];
  if (!sentence) return;
  stopSpeech();
  cancelGap();
  const token = state.speechToken;
  const firstWord = fromWord ?? sentence.words[0].index;
  const charStart = state.parsed.words[firstWord].start;
  const end = sentence.words.at(-1).start + sentence.words.at(-1).text.length;
  setActive(-1, index);
  refreshTimeline(state.timings[firstWord]?.start);
  const onboundary = (event) => {
    if (token !== state.speechToken || !$("follow").checked) return;
    const position = charStart + event.charIndex;
    const word = sentence.words.find(
      (word) =>
        position >= word.start && position < word.start + word.text.length,
    );
    if (word) {
      setActive(word.index, index);
      refreshTimeline(state.timings[word.index].start);
    }
  };
  const onerror = (event) => {
    if (token !== state.speechToken) return;
    state.playing = false;
    $("play").textContent = "Play";
    if (!["interrupted", "canceled"].includes(event.error))
      error(
        "The selected voice could not speak. Test another available voice or use a recording.",
      );
  };
  const onend = guard(() => {
    if (token !== state.speechToken) return;
    const next = state.repeat ? state.loopSentence : index + 1;
    if (next >= state.parsed.sentences.length) {
      state.playing = false;
      $("play").textContent = "Play";
      state.revealed = true;
      setActive(-1, -1, false);
      updateReaderOptions();
      refreshTimeline(state.timings.at(-1)?.end);
      return;
    }
    if ($("shadow").checked) {
      state.playing = false;
      $("play").textContent = "Play";
      $("your-turn").hidden = false;
      state.timer = setTimeout(
        guard(() => {
          if (token === state.speechToken) speakSentence(next);
        }),
        1800,
      );
    } else speakSentence(next);
  });
  try {
    speech.play({
      ...speechSoundOptions(),
      text: state.text.slice(charStart, end), voice,
      lang: languageConfig(state.language).locale, rate: Number($("speed").value),
      onboundary, onerror, onend, onwordstatus: showWordStatus,
    });
  } catch (failure) {
    state.playing = false;
    $("play").textContent = "Play";
    throw failure;
  }
  error("");
}
function togglePlay() {
  if (!state.parsed.words.length)
    throw new Error("Add some text in your practice language first.");
  if (state.timer) {
    stop();
    return;
  }
  if (state.mode === "audio") return audio.paused ? playAudio() : stop();
  if (["preview", "pronunciation"].includes(speech.kind)) { stop(); speakSentence(Math.max(0, state.activeSentence)); }
  else if (["starting", "pausing", "resuming"].includes(speech.status)) stop();
  else if (speech.status === "speaking") speech.pause();
  else if (speech.paused) speech.resume();
  else speakSentence(Math.max(0, state.activeSentence));
}
async function jumpSentence(index, play = true) {
  if (!state.parsed.sentences.length) return;
  index = Math.max(0, Math.min(state.parsed.sentences.length - 1, index));
  cancelGap();
  state.loopSentence = index;
  const first = state.parsed.sentences[index].words[0].index;
  if (state.mode === "tts") {
    if (play) speakSentence(index);
    else setActive(first, index);
  } else {
    if (!audio.hasAttribute("src"))
      throw new Error("Select a recording first.");
    state.lastTime = state.timings[first].start;
    audio.currentTime = state.lastTime;
    setActive(first, index, false);
    refreshTimeline(state.lastTime);
    if (play) await playAudio();
  }
}
function tick(fromSeek = false) {
  const time = audio.currentTime;
  const current = state.activeSentence;
  const target = state.repeat ? state.loopSentence : current;
  const boundary = sentenceTimes(target);
  // Evaluate the old sentence before changing the active word; otherwise loops
  // accidentally follow the next sentence. Explicit seeks never trigger shadowing.
  if (
    !fromSeek &&
    state.playing &&
    !audio.seeking &&
    boundary &&
    state.lastTime < boundary.end &&
    time >= boundary.end
  ) {
    if (state.repeat) {
      audio.currentTime = boundary.start;
      state.lastTime = boundary.start;
      setActive(state.parsed.sentences[target].words[0].index, target);
      return;
    }
    if ($("shadow").checked && current >= 0) {
      audio.pause();
      $("your-turn").hidden = false;
      $("play").textContent = "Cancel pause";
      state.timer = setTimeout(
        guard(async () => {
          cancelGap();
          if (current + 1 < state.parsed.sentences.length) {
            audio.currentTime = sentenceTimes(current + 1).start;
            state.lastTime = audio.currentTime;
            await playAudio();
          } else {
            state.revealed = true;
            updateReaderOptions();
          }
        }),
        1800,
      );
    }
  }
  state.lastTime = time;
  if ($("follow").checked) {
    const word = activeAt(state.timings, time);
    setActive(word, word < 0 ? -1 : state.parsed.words[word].sentence);
  }
  refreshTimeline(time);
}
function animation() {
  tick();
  if (!audio.paused) state.raf = requestAnimationFrame(animation);
}

function setPracticeLanguage(code) {
  const config = languageConfig(code);
  stop();
  state.documentEpoch++;
  state.language = code;
  document.querySelector(`#language-${code}`).checked = true;
  for (const id of ["reader", "reading-title", "text", "selected-word"]) $(id).lang = code;
  $("voice-label").textContent = `${config.name} voice`;
  $("text-label").textContent = `${config.name} text`;
  $("demo").textContent = `Load ${config.name} demo ↗`;
  loadVoices();
}
function readVoicePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_STORE) || "{}");
    for (const code of Object.keys(LANGUAGES)) {
      if (typeof saved?.[code] === "string") state.voiceChoices[code] = saved[code];
    }
  } catch {
    notice("Voice preferences could not be read. Automatic voice selection is still available.");
  }
}
function saveVoicePreferences() {
  try { localStorage.setItem(VOICE_STORE, JSON.stringify(state.voiceChoices)); }
  catch { notice("Voice preference works for this visit but could not be saved in this browser."); }
}
function updateVoiceNote() {
  const config = languageConfig(state.language);
  const voice = currentVoice();
  const entry = state.voiceEntries.find(item => item.voice === voice);
  if (!voice) {
    $("voice-note").textContent = `No suitable ${config.name} voice is available here. Install a matching system voice, then Refresh voices, or use a recording. Other languages will not be substituted.`;
    return;
  }
  const connection = voice.localService ? "On-device voice." : "Online voice: text may be sent to its speech service.";
  const availability = entry.tier === 1 ? "Only a standard voice is available; install an enhanced/premium voice for more natural speech." : "Best available quality tier in this browser.";
  $("voice-note").textContent = `${state.voiceChoices[state.language] === "auto" ? "Auto recommends" : "Selected"}: ${voice.name} · ${voice.lang} · ${entry.quality}. ${availability} ${connection} Word highlighting depends on voice support.`;
}
function loadVoices() {
  const voices = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  state.voiceEntries = bestVoices(voices, state.language);
  state.voices = state.voiceEntries.map(entry => entry.voice);
  const choice = state.voiceChoices[state.language];
  // An unavailable preference is kept for a later voiceschanged event. Auto is
  // used now, and a voice from a different language is never substituted.
  const available = choice === "auto" || state.voices.some(voice => voice.voiceURI === choice);
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = state.voices.length ? "Auto · best available" : "No matching voice available";
  $("voice").replaceChildren(auto, ...state.voiceEntries.map(entry => {
    const option = document.createElement("option");
    option.value = entry.voice.voiceURI;
    option.textContent = `${entry.voice.name} · ${entry.voice.lang} · ${entry.quality}`;
    return option;
  }));
  $("voice").value = available ? choice : "auto";
  $("voice").disabled = !state.voices.length;
  $("preview-voice").disabled = !state.voices.length;
  if (state.mode === "tts" && speech.active && speech.paused) stopSpeech();
  if (!available) {
    const best = state.voices[0];
    $("voice-note").textContent = best
      ? `Your saved voice is unavailable in the current quality tier. Auto recommends ${best.name} (${best.lang}) for now. Select Auto to keep this choice, or refresh after installing voices.`
      : `No suitable ${languageConfig(state.language).name} voice is available. Install a matching voice or use a recording.`;
  } else updateVoiceNote();
}
function captureReaderSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) {
    if (!["speak-selection", "stop-pronunciation"].includes(document.activeElement?.id)) {
      state.selectionText = "";
      $("speak-selection").disabled = true;
    }
    return false;
  }
  const range = selection.getRangeAt(0);
  const inTranslation = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(".translation");
  if (!$("reader").contains(range.startContainer) || !$("reader").contains(range.endContainer) ||
      inTranslation(range.startContainer) || inTranslation(range.endContainer)) {
    state.selectionText = "";
  } else {
    const fragment = range.cloneContents();
    fragment.querySelectorAll(".translation").forEach(node => node.remove());
    state.selectionText = fragment.textContent.trim();
  }
  $("speak-selection").disabled = !state.selectionText;
  return Boolean(state.selectionText);
}
function speakPronunciation(text) {
  if (!text?.trim()) throw new Error("Select text in the reader or choose a word first.");
  const voice = currentVoice();
  if (!voice) throw new Error(`No suitable ${languageConfig(state.language).name} voice is available. Install a matching voice and refresh voices.`);
  stop();
  speech.play({
    ...speechSoundOptions(),
    text, voice, lang: languageConfig(state.language).locale,
    rate: Number($("speed").value), kind: "pronunciation",
    onwordstatus: showWordStatus,
    onerror: event => {
      if (!["interrupted", "canceled"].includes(event.error))
        error("Pronunciation could not play. Try another voice.");
    },
  });
  error("");
}
function previewVoice() {
  if (speech.kind === "preview") { stop(); return; }
  const voice = currentVoice();
  if (!voice) throw new Error("No matching voice is available. Refresh voices or use a recording.");
  stop();
  $("preview-voice").textContent = "Stop sample";
  try {
    speech.play({
      ...speechSoundOptions(),
      text: languageConfig(state.language).sample, voice,
      lang: languageConfig(state.language).locale, kind: "preview",
      onwordstatus: showWordStatus,
      onend: () => { $("preview-voice").textContent = "Test voice"; },
      onerror: event => {
        $("preview-voice").textContent = "Test voice";
        if (!["interrupted", "canceled"].includes(event.error))
          error("The voice sample could not play. Try another voice or a recording.");
      },
    });
  } catch (failure) {
    $("preview-voice").textContent = "Test voice";
    throw failure;
  }
}

function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) || "[]");
    if (!Array.isArray(value)) throw new Error("Invalid saved sessions.");
    state.sessions = value.map((entry) => ({
      id: String(entry.id),
      value: validateSession(entry.value),
    }));
  } catch {
    state.storageOK = false;
    state.sessions = [];
    notice(
      "Saved sessions could not be read. You can still practice and export your session; existing storage has not been overwritten.",
    );
  }
  renderSessions();
}
function writeSessions(sessions) {
  if (!state.storageOK)
    throw new Error(
      "Browser storage is unavailable or invalid. Export this session instead.",
    );
  try {
    localStorage.setItem(STORE, JSON.stringify(sessions));
  } catch {
    throw new Error(
      "Could not save in this browser. Storage may be full or blocked. Export your session instead.",
    );
  }
  state.sessions = sessions;
  renderSessions();
}
function renderSessions() {
  $("sessions").replaceChildren();
  for (const entry of state.sessions) {
    const li = document.createElement("li"),
      title = document.createElement("strong"),
      actions = document.createElement("div");
    title.textContent = entry.value.title;
    actions.className = "actions";
    const load = document.createElement("button");
    load.textContent = "Load";
    load.setAttribute("aria-label", `Load ${entry.value.title}`);
    load.addEventListener(
      "click",
      guard(() => loadSession(entry.value)),
    );
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${entry.value.title}`);
    remove.addEventListener(
      "click",
      guard(() => {
        writeSessions(state.sessions.filter((item) => item.id !== entry.id));
        $("save").focus();
        notice(`Deleted “${entry.value.title}”.`);
      }),
    );
    actions.append(load, remove);
    li.append(title, actions);
    $("sessions").append(li);
  }
  if (!state.sessions.length) {
    const li = document.createElement("li");
    li.textContent = "No saved sessions yet.";
    $("sessions").append(li);
  }
}
function wordDialog(index = state.selectedWord) {
  if (!state.parsed.words.length) return;
  index = Math.max(0, Math.min(state.parsed.words.length - 1, index));
  state.selectedWord = index;
  $("edit-word").value = String(index + 1);
  $("selected-word").textContent = state.parsed.words[index].text;
  $("word-start").value = String(state.timings[index].start);
  $("word-end").value = String(state.timings[index].end);
  $("word-error").textContent = "";
}

document.addEventListener("selectionchange", captureReaderSelection);
on("speak-word", "click", () => speakPronunciation(state.parsed.words[state.selectedWord]?.text));
on("speak-selection", "click", () => speakPronunciation(state.selectionText));
on("stop-pronunciation", "click", stop);
on("speak-dialog-word", "click", () => {
  try {
    speakPronunciation(state.parsed.words[state.selectedWord]?.text);
    $("word-dialog").close();
  }
  catch (failure) { $("word-error").textContent = failure.message; }
});
on("play", "click", togglePlay);
on("previous", "click", () =>
  jumpSentence(Math.max(0, state.activeSentence - 1)),
);
on("next", "click", () => jumpSentence(state.activeSentence + 1));
on("repeat", "click", () => {
  state.repeat = !state.repeat;
  state.loopSentence = Math.max(0, state.activeSentence);
  $("repeat").setAttribute("aria-pressed", String(state.repeat));
  if (state.repeat) {
    $("shadow").checked = false;
    return jumpSentence(state.loopSentence, false);
  }
});
on("shadow", "change", () => {
  cancelGap();
  if ($("shadow").checked) {
    state.repeat = false;
    $("repeat").setAttribute("aria-pressed", "false");
  }
});
on("seek", "input", () => {
  cancelGap();
  state.repeat = false;
  $("repeat").setAttribute("aria-pressed", "false");
  const time = Number($("seek").value);
  if (state.mode === "tts") {
    const word = activeAt(state.timings, time);
    return jumpSentence(
      word >= 0 ? state.parsed.words[word].sentence : 0,
      state.playing,
    );
  }
  if (!audio.hasAttribute("src")) return;
  state.lastTime = time;
  audio.currentTime = time;
  tick(true);
});
for (const id of ["volume", "pitch"]) {
  on(id, "input", () => {
    applySoundSettings();
    if (speech.active) { stop(); notice("Speech settings updated. Press Play or test the voice again."); }
  });
}
on("reset-pitch", "click", () => {
  $("pitch").value = "1";
  $("pitch").dispatchEvent(new Event("input"));
});
on("speed", "input", () => {
  const rate = Number($("speed").value);
  state.speed = rate;
  $("speed-value").value = `${rate.toFixed(2)}×`;
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
  if (state.mode === "tts" && speech.kind === "narration" && !speech.paused)
    speakSentence(Math.max(0, state.activeSentence));
});
["highlight", "hide-text"].forEach((id) =>
  on(id, "change", updateReaderOptions),
);
on("reveal", "click", () => {
  state.revealed = true;
  updateReaderOptions();
});
on("translation", "click", () => {
  $("translation").setAttribute(
    "aria-pressed",
    String($("translation").getAttribute("aria-pressed") !== "true"),
  );
  updateReaderOptions();
});
on("follow", "change", () => {
  if ($("follow").checked && state.mode === "audio") tick(true);
});
on("voice", "change", () => {
  state.voiceChoices[state.language] = $("voice").value;
  saveVoicePreferences();
  updateVoiceNote();
  if (["preview", "pronunciation"].includes(speech.kind)) stop();
  if (state.mode === "tts" && speech.kind === "narration" && !speech.paused)
    speakSentence(Math.max(0, state.activeSentence));
  else if (state.mode === "tts" && speech.active) stopSpeech();
});
on("preview-voice", "click", previewVoice);
on("refresh-voices", "click", () => { loadVoices(); });
for (const code of Object.keys(LANGUAGES)) {
  on(`language-${code}`, "change", () => {
    const oldDemo = DEMOS[state.language];
    const draft = $("text").value, draftTitle = $("title").value;
    const replaceDemo = state.text === oldDemo.text && draft === state.text && !state.source && !audio.hasAttribute("src");
    setPracticeLanguage(code);
    if (replaceDemo) {
      const demo = DEMOS[code];
      setMode("tts"); resetText(demo.text, demo.title);
      notice(`${languageConfig(code).name} demo loaded. Test the recommended voice, then press Play.`);
    } else {
      const parsed = parseText(state.text, code);
      const sameWords = parsed.words.length === state.parsed.words.length && parsed.words.every((word,index) => word.text === state.parsed.words[index].text);
      state.parsed = parsed;
      if (!sameWords) {
        state.timings = estimate(parsed.words, state.duration || parsed.words.length * .48);
        state.timingSource = "estimated"; state.anchors.clear();
      }
      renderReader();
      $("text").value = draft; $("title").value = draftTitle;
      refreshTimeline(audio.currentTime);
      notice(`Practice language changed to ${languageConfig(code).name}. Your text and recording are unchanged; this does not translate text.${!sameWords ? " Word boundaries changed, so timings were reset." : ""}`);
    }
  });
}
on("source-tts", "change", () => setMode("tts"));
on("source-audio", "change", () => setMode("audio"));
on("apply-text", "click", () => {
  const source = state.source;
  resetText($("text").value, $("title").value);
  if (source) {
    state.source = { ...source, edited: true };
    renderCredit();
  }
  notice("Text applied. Word timings have been reset.");
});
on("title", "change", () => {
  state.title = $("title").value || "Untitled practice";
  $("reading-title").textContent = state.title;
});
on("demo", "click", () => {
  releaseAudio();
  setMode("tts");
  const demo = DEMOS[state.language];
  resetText(demo.text, demo.title);
  notice(`${languageConfig(state.language).name} demo loaded. Test the recommended voice, then press Play.`);
});
on("reader", "click", async (event) => {
  if (captureReaderSelection()) return;
  const button = event.target.closest("button[data-word]");
  if (!button) return;
  const index = Number(button.dataset.word);
  state.selectedWord = index;
  if (state.sync) {
    if (!audio.hasAttribute("src") || !Number.isFinite(audio.duration))
      throw new Error("Load a recording before pinning words.");
    const next = new Map(state.anchors);
    next.set(index, audio.currentTime);
    const result = pinTimings(state.parsed.words, audio.duration, next);
    state.anchors = next;
    state.timings = result;
    state.timingSource = "manual";
    setActive(index, state.parsed.words[index].sentence, false);
    updateTimingLabel();
    notice(
      `Pinned “${state.parsed.words[index].text}” at ${audio.currentTime.toFixed(3)}s.`,
    );
    return;
  }
  const sentence = state.parsed.words[index].sentence;
  state.loopSentence = sentence;
  if (!$("follow").checked) {
    setActive(index, sentence, false);
    return;
  }
  if (state.mode === "tts") speakSentence(sentence, index);
  else {
    if (!audio.hasAttribute("src"))
      throw new Error("Select a recording first.");
    cancelGap();
    state.lastTime = state.timings[index].start;
    audio.currentTime = state.lastTime;
    setActive(index, sentence, false);
    await playAudio();
  }
});
on("reader", "dblclick", (event) => {
  const button = event.target.closest("button[data-word]");
  if (button) {
    wordDialog(Number(button.dataset.word));
    $("word-dialog").showModal();
  }
});
on("word-options", "click", () => {
  wordDialog();
  $("word-dialog").showModal();
});
on("edit-word", "change", () => wordDialog(Number($("edit-word").value) - 1));
on("apply-word", "click", () => {
  try {
    const next = state.timings.map((entry, index) =>
      index === state.selectedWord
        ? {
            start: Number($("word-start").value),
            end: Number($("word-end").value),
          }
        : entry,
    );
    state.timings = validateTimings(next, state.parsed.words);
    state.timingSource = "manual";
    state.anchors.clear();
    updateTimingLabel();
    refreshTimeline(audio.currentTime);
    notice("Word timing updated.");
    $("word-dialog").close();
  } catch (failure) {
    $("word-error").textContent = failure.message;
  }
});
on("copy-word", "click", async () => {
  try {
    await navigator.clipboard.writeText(
      state.parsed.words[state.selectedWord].text,
    );
    notice("Word copied.");
    $("word-dialog").close();
  } catch {
    $("word-error").textContent =
      "Clipboard access was denied. Select the word above and copy it manually.";
  }
});
on("repeat-word-sentence", "click", async () => {
  await jumpSentence(state.parsed.words[state.selectedWord].sentence);
  $("word-dialog").close();
});
on("sync", "click", () => setSync(!state.sync));
on("distribute", "click", () => {
  state.timings = estimate(
    state.parsed.words,
    state.duration || state.parsed.words.length * 0.48,
  );
  state.timingSource = "estimated";
  state.anchors.clear();
  updateTimingLabel();
  refreshTimeline(audio.currentTime);
  notice("Word timings estimated; sync pins cleared.");
});
on("import-timings", "click", () => {
  const result = validateTimings(
    JSON.parse($("timings-json").value),
    state.parsed.words,
  );
  stop();
  state.timings = result;
  state.timingSource = "imported";
  state.anchors.clear();
  updateTimingLabel();
  refreshTimeline(audio.currentTime);
  notice(`Imported ${result.length} word timestamps in text order.`);
  error("");
});
on("timings-file", "change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5_000_000)
    throw new Error("Timings file must be smaller than 5 MB.");
  $("timings-json").value = await file.text();
  notice("Timings file read. Press Apply timings to validate and use it.");
});
on("export-timings", "click", () =>
  download(
    "timings.json",
    state.parsed.words.map((word, index) => ({
      word: word.text,
      ...state.timings[index],
    })),
  ),
);
on("export-session", "click", () =>
  download("hear-and-read-session.json", snapshot()),
);
on("session-file", "change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5_000_000)
    throw new Error("Session file must be smaller than 5 MB.");
  loadSession(JSON.parse(await file.text()));
  event.target.value = "";
  error("");
});
on("save", "click", () => {
  if ($("text").value !== state.text)
    throw new Error("Apply your edited text before saving.");
  writeSessions([
    { id: crypto.randomUUID(), value: snapshot() },
    ...state.sessions,
  ]);
  notice(`Saved “${state.title}” in this browser.`);
  error("");
});
on("audio-file", "change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  stop();
  state.documentEpoch++;
  const url = URL.createObjectURL(file);
  setAudio(url, file.name);
  state.objectUrl = url;
  notice(
    "Audio selected. Imported or edited word timings are preserved; estimated timings use the new duration.",
  );
  error("");
});
on("audio-form", "submit", (event) => {
  event.preventDefault();
  const url = new URL($("audio-url").value);
  if (url.protocol !== "https:")
    throw new Error("Use an HTTPS audio URL or choose a local file.");
  stop();
  state.documentEpoch++;
  setAudio(url.href, "Linked recording");
  notice(
    "Recording loaded. Word timings are estimated unless you have imported or edited them.",
  );
  error("");
});
on("content-sources", "change", () => {
  state.documentEpoch++;
  $("content-error").textContent = "";
  updateSourceHelp();
});
on("content-url", "input", () => {
  state.documentEpoch++;
  $("content-url").setCustomValidity("");
  $("content-error").textContent = "";
});
on("source-example", "click", () => {
  const source =
    state.sources.find((source) => source.id === sourceSelection()) ||
    state.sources[0];
  if (source) {
    state.documentEpoch++;
    $("content-error").textContent = "";
    $("content-url").value = source.example;
    $("content-url").focus();
  }
});
on("content-form", "submit", async (event) => {
  event.preventDefault();
  const epoch = ++state.documentEpoch;
  $("content-error").textContent = "";
  $("content-form").setAttribute("aria-busy", "true");
  $("content-import").disabled = true;
  $("content-import").textContent = "Importing…";
  let importFailure = "";
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: $("content-url").value,
        source: sourceSelection(),
      }),
      signal: AbortSignal.timeout(60000),
    });
    const document = await response.json().catch(() => null);
    if (epoch !== state.documentEpoch) return;
    if (!response.ok)
      throw new Error(
        `Import failed (HTTP ${response.status}). ${document?.error || "The server could not import this page. Try again or paste its text manually."}`,
      );
    if (!document || typeof document.text !== "string" || !Array.isArray(document.segments))
      throw new Error("The server returned an invalid import response. Try again or paste the text manually.");
    const importLanguage = document.language ?? "hu";
    languageConfig(importLanguage);
    const languageChanged = importLanguage !== state.language;
    const parsed = parseText(document.text, importLanguage);
    const timings = document.segments.length
      ? publisherTimings(parsed, document.segments)
      : estimate(parsed.words, document.duration || parsed.words.length * 0.48);
    const source = validateSource(document.source),
      clip = validatePronunciation(document.pronunciationUrl);
    stop();
    releaseAudio();
    setPracticeLanguage(importLanguage);
    setMode(document.audioUrl ? "audio" : "tts");
    resetText(document.text, document.title);
    state.timings = timings;
    state.timingSource = document.timingSource;
    state.source = source;
    state.pronunciationUrl = clip;
    renderCredit();
    if (document.audioUrl)
      setAudio(document.audioUrl, `Original ${source.name} recording`);
    else
      $("audio-name").textContent =
        "No full-text recording supplied. Use Browser voice or add a matching recording.";
    state.duration = document.duration;
    updateTimingLabel();
    refreshTimeline();
    notice(
      (document.notice ||
        `Imported “${document.title}” from ${source.name}. ${document.segments.length ? `${document.segments.length} publisher segments; words inside each are estimated.` : "Word positions are estimated."}`) + (languageChanged ? ` Practice language switched to ${languageConfig(importLanguage).name}.` : ""),
    );
    error("");
  } catch (failure) {
    if (epoch === state.documentEpoch) {
      if (failure.name === "TimeoutError")
        importFailure = "Import failed. The website took too long to respond. Try again or paste its text manually.";
      else if (failure instanceof TypeError && /fetch|network|load/i.test(failure.message))
        importFailure = "Import failed. Could not connect to the import server. Check that the Python server is running, then try again.";
      else
        importFailure = failure.message.startsWith("Import failed")
          ? failure.message
          : `Import failed. ${failure.message || "Try again or paste the text manually."}`;
    }
  } finally {
    $("content-import").disabled = false;
    $("content-import").textContent = "Import content";
    $("content-form").removeAttribute("aria-busy");
    if (importFailure && epoch === state.documentEpoch) {
      const message = $("content-error");
      message.textContent = importFailure;
      message.focus({ preventScroll: true });
      message.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
});
pronunciation.addEventListener("play", () => {
  cancelGap();
  stopSpeech();
  audio.pause();
  state.playing = false;
  $("play").textContent = "Play";
});
pronunciation.addEventListener("error", () => {
  if (pronunciation.hasAttribute("src"))
    error(
      "The word pronunciation could not load. Browser voice is still available for the text.",
    );
});

audio.addEventListener(
  "loadedmetadata",
  guard(() => {
    if (!Number.isFinite(audio.duration)) return;
    state.duration = audio.duration;
    if (state.timingSource === "estimated")
      state.timings = estimate(state.parsed.words, audio.duration);
    updateTimingLabel();
    refreshTimeline(audio.currentTime);
  }),
);
audio.addEventListener("play", () => {
  pronunciation.pause();
  if (state.mode !== "audio") {
    audio.pause();
    return;
  }
  state.playing = true;
  $("play").textContent = "Pause";
  cancelGap();
  cancelAnimationFrame(state.raf);
  animation();
});
audio.addEventListener("pause", () => {
  state.playing = false;
  $("play").textContent = "Play";
  cancelAnimationFrame(state.raf);
});
audio.addEventListener("seeking", () => {
  state.lastTime = audio.currentTime;
  cancelGap();
});
audio.addEventListener("seeked", () => tick(true));
audio.addEventListener("timeupdate", () => tick());
audio.addEventListener(
  "ended",
  guard(async () => {
    if (state.repeat) {
      audio.currentTime = sentenceTimes(state.loopSentence).start;
      state.lastTime = audio.currentTime;
      await playAudio();
      return;
    }
    state.revealed = true;
    updateReaderOptions();
    state.playing = false;
    $("play").textContent = "Play";
    setActive(-1, -1, false);
  }),
);
audio.addEventListener("error", () => {
  if (audio.hasAttribute("src"))
    error(
      "The recording could not load. Check the URL or choose the downloaded audio file.",
    );
});
audio.addEventListener("ratechange", () => {
  $("speed").value = String(audio.playbackRate);
  $("speed-value").value = `${audio.playbackRate.toFixed(2)}×`;
});
document.addEventListener(
  "keydown",
  guard((event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.repeat ||
      event.target.closest(
        "button,a,input,textarea,select,summary,[contenteditable],dialog",
      ) ||
      $("word-dialog").open
    )
      return;
    if (event.code === "Space") {
      event.preventDefault();
      return togglePlay();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      return jumpSentence(state.activeSentence + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      return jumpSentence(Math.max(0, state.activeSentence - 1));
    }
  }),
);
window.addEventListener("pagehide", () => {
  stop();
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
});
try {
  readVoicePreferences();
  renderReader();
  loadVoices();
  readSessions();
  loadSources();
  if ("speechSynthesis" in window)
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
} catch (failure) {
  error(`Studio could not initialize: ${failure.message}`);
}
