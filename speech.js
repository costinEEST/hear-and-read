/** Supported practice languages and deterministic browser-voice recommendations. */
export const LANGUAGES = {
  hu: {
    name: "Hungarian",
    nativeName: "Magyar",
    locale: "hu-HU",
    sample: "Jó napot! Hallgasd meg ezt a mondatot, és olvass velem.",
    voices: ["tunde", "noemi", "tamas", "szabolcs"],
  },
  es: {
    name: "Spanish",
    nativeName: "Español",
    locale: "es-ES",
    sample: "¡Buenos días! Escucha esta frase y lee conmigo.",
    voices: [
      "monica",
      "jorge",
      "paulina",
      "marisol",
      "luciana",
      "helena",
      "elvira",
      "alvaro",
    ],
  },
  de: {
    name: "German",
    nativeName: "Deutsch",
    locale: "de-DE",
    sample: "Guten Tag! Hör dir diesen Satz an und lies mit mir.",
    voices: ["anna", "petra", "markus", "katja", "conrad", "stefan", "hedda"],
  },
};

export const DEMOS = {
  hu: {
    title: "Egy reggel Budapesten",
    text: "Jó reggelt! Ma szép, napos idő van Budapesten.\n\nReggel megiszom egy kávét, aztán sétálok a Duna-parton. A barátommal találkozom a piacon, és friss kenyeret veszünk.\n\nEste magyarul tanulok, és meghallgatok egy rövid hanganyagot.",
    translations: [
      "Good morning!",
      "Today the weather is beautiful and sunny in Budapest.",
      "In the morning I drink a coffee, then walk along the Danube.",
      "I meet my friend at the market, and we buy fresh bread.",
      "In the evening I study Hungarian and listen to a short recording.",
    ],
  },
  es: {
    title: "Una mañana en Madrid",
    text: "¡Buenos días! Hoy hace sol en Madrid.\n\nPor la mañana tomo un café y paseo por el parque. Me encuentro con una amiga y compramos pan fresco.\n\nPor la noche estudio español y escucho una grabación corta.",
    translations: [
      "Good morning!",
      "It is sunny in Madrid today.",
      "In the morning I have a coffee and walk through the park.",
      "I meet a friend and we buy fresh bread.",
      "At night I study Spanish and listen to a short recording.",
    ],
  },
  de: {
    title: "Ein Morgen in Berlin",
    text: "Guten Morgen! Heute scheint die Sonne in Berlin.\n\nAm Morgen trinke ich einen Kaffee und gehe im Park spazieren. Ich treffe eine Freundin und wir kaufen frisches Brot.\n\nAm Abend lerne ich Deutsch und höre eine kurze Aufnahme.",
    translations: [
      "Good morning!",
      "The sun is shining in Berlin today.",
      "In the morning I drink a coffee and walk in the park.",
      "I meet a friend and we buy fresh bread.",
      "In the evening I study German and listen to a short recording.",
    ],
  },
};

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

export function languageConfig(code) {
  if (!Object.hasOwn(LANGUAGES, code))
    throw new Error("Choose Hungarian, Spanish or German.");
  return LANGUAGES[code];
}

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
