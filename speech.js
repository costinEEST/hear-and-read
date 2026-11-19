/** Supported practice languages and deterministic browser-voice recommendations. */
import { LANGUAGES, languageConfig } from "./languages.js";
export { LANGUAGES, languageConfig };

import { DEMO_LINES, DEMO_TITLES } from "./demos.js";
export const DEMOS = Object.fromEntries(
  Object.keys(LANGUAGES).map((code) => [
    code,
    {
      title: DEMO_TITLES[code],
      text: DEMO_LINES[code].join("\n\n"),
      translations: DEMO_LINES.en,
    },
  ]),
);
for (const [code, config] of Object.entries(LANGUAGES))
  config.sample = DEMO_LINES[code][2];

const NOVELTY = new Set([
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "good news",
  "jester",
  "junior",
  "kathy",
  "fred",
  "organ",
  "superstar",
  "ralph",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
]);
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function rankVoices(voices, code) {
  const config = languageConfig(code);
  const unique = new Map();
  for (const voice of voices) {
    const locale = String(voice.lang || "").replaceAll("_", "-");
    if (locale.split("-")[0].toLowerCase() !== code) continue;
    const name = normalize(voice.name),
      hints = `${name} ${normalize(voice.voiceURI)}`;
    const base = name.split("(")[0].trim();
    if (/espeak|mbrola/.test(hints) || NOVELTY.has(base)) continue;
    let tier = 1,
      quality = "Standard voice";
    if (/natural|neural|wavenet|chirp/.test(hints)) {
      tier = 5;
      quality = "Natural / neural";
    } else if (/premium/.test(hints)) {
      tier = 4;
      quality = "Premium";
    } else if (/enhanced/.test(hints)) {
      tier = 3;
      quality = "Enhanced";
    } else if (/google/.test(hints)) {
      tier = 2;
      quality = "Browser voice";
    }
    const known = config.voices.some((candidate) =>
      new RegExp(`\\b${candidate}\\b`).test(name),
    );
    const score =
      tier * 1000 +
      (known ? 80 : 0) +
      (locale.toLowerCase() === config.locale.toLowerCase() ? 30 : 0) +
      (voice.default ? 5 : 0) +
      (voice.localService ? 2 : 0);
    const key = `${voice.voiceURI}\u0000${locale}`;
    unique.set(key, { voice, tier, quality, score, preferred: known });
  }
  return [...unique.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.voice.name.localeCompare(b.voice.name) ||
      a.voice.voiceURI.localeCompare(b.voice.voiceURI),
  );
}

/** Offer only the highest exposed quality tier, keeping dialect alternatives. */
export function bestVoices(voices, code) {
  const ranked = rankVoices(voices, code);
  const tier = ranked.filter((entry) => entry.tier === ranked[0].tier);
  // With no provider quality labels, offer known language-specific system
  // families before unclassified voices. This is a heuristic, not a quality API.
  return tier[0]?.tier === 1 && tier.some((entry) => entry.preferred)
    ? tier.filter((entry) => entry.preferred)
    : tier;
}
