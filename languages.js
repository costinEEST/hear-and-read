/** Shared supported-language metadata. UI language and practice language are independent. */
export const LANGUAGES = {
  en: {
    name: "English",
    nativeName: "English",
    locale: "en-GB",
    jw: "E",
    wiki: "London",
    word: "apple",
    section: ["English"],
    voices: ["samantha", "daniel", "karen", "moira", "david", "zira"],
  },
  hu: {
    name: "Hungarian",
    nativeName: "Magyar",
    locale: "hu-HU",
    jw: "H",
    wiki: "Budapest",
    word: "alma",
    section: ["Magyar"],
    voices: ["tunde", "noemi", "tamas", "szabolcs"],
  },
  ro: {
    name: "Romanian",
    nativeName: "Română",
    locale: "ro-RO",
    jw: "M",
    wiki: "București",
    word: "măr",
    section: ["Română"],
    voices: ["ioana", "carmen", "emil"],
  },
  uk: {
    name: "Ukrainian",
    nativeName: "Українська",
    locale: "uk-UA",
    jw: "K",
    wiki: "Київ",
    word: "яблуко",
    section: ["Українська", "Українська мова"],
    voices: ["lesya", "ostap", "polina"],
  },
  ru: {
    name: "Russian",
    nativeName: "Русский",
    locale: "ru-RU",
    jw: "U",
    wiki: "Москва",
    word: "яблоко",
    section: ["Русский", "Русский язык"],
    voices: ["milena", "yuri", "irina", "dmitry", "svetlana"],
  },
  bg: {
    name: "Bulgarian",
    nativeName: "Български",
    locale: "bg-BG",
    jw: "BL",
    wiki: "София",
    word: "ябълка",
    section: ["Български", "Български език"],
    voices: ["daria", "ivan", "kalina", "borislav"],
  },
  sr: {
    name: "Serbian",
    nativeName: "Српски",
    locale: "sr-RS",
    jw: "SB",
    wiki: "Београд",
    word: "јабука",
    section: ["Српски", "Српски језик", "Srpski"],
    voices: ["nicholas", "milos", "sophie"],
  },
  es: {
    name: "Spanish",
    nativeName: "Español",
    locale: "es-ES",
    jw: "S",
    wiki: "Madrid",
    word: "manzana",
    section: ["Español"],
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
  it: {
    name: "Italian",
    nativeName: "Italiano",
    locale: "it-IT",
    jw: "I",
    wiki: "Roma",
    word: "mela",
    section: ["Italiano"],
    voices: ["alice", "luca", "paola", "elsa", "isabella", "diego"],
  },
  pl: {
    name: "Polish",
    nativeName: "Polski",
    locale: "pl-PL",
    jw: "P",
    wiki: "Warszawa",
    word: "jabłko",
    section: ["Polski", "język polski"],
    voices: ["zosia", "paulina", "marek", "zofia"],
  },
  de: {
    name: "German",
    nativeName: "Deutsch",
    locale: "de-DE",
    jw: "X",
    wiki: "Berlin",
    word: "Apfel",
    section: ["Deutsch"],
    voices: ["anna", "petra", "markus", "katja", "conrad", "stefan", "hedda"],
  },
  fr: {
    name: "French",
    nativeName: "Français",
    locale: "fr-FR",
    jw: "F",
    wiki: "Paris",
    word: "pomme",
    section: ["Français"],
    voices: ["amelie", "thomas", "audrey", "marie", "denise", "henri"],
  },
};
export function languageConfig(code) {
  if (!Object.hasOwn(LANGUAGES, code))
    throw new Error("Choose a supported practice language.");
  return LANGUAGES[code];
}
export function sourceExample(source, code = "en") {
  const config = languageConfig(code);
  if (source === "jw")
    return new URL(JW_EXAMPLES[code], "https://www.jw.org").href;
  const dictionary = source === "wiktionary";
  return `https://${code}.${dictionary ? "wiktionary" : "wikipedia"}.org/wiki/${encodeURIComponent(dictionary ? config.word : config.wiki)}`;
}
export const wikiHosts = Object.keys(LANGUAGES).flatMap((code) => [
  `${code}.wikipedia.org`,
  `${code}.wiktionary.org`,
]);

// Publisher paths are localized as well as their language prefix.
const JW_EXAMPLES = {
  en: "/en/library/bible/nwt/books/matthew/5/",
  hu: "/hu/konyvtar/biblia/nwt/konyvek/Máté/5/",
  ro: "/ro/biblioteca/biblia/nwt/carti/matei/5/",
  uk: "/uk/бібліотека/біблія/nwt/книги/Матвія/5/",
  ru: "/ru/библиотека/библия/nwt/содержание/Матфея/5/",
  bg: "/bg/библиотека/библии/nwt/съдържание/Матей/5/",
  sr: "/sr-cyrl/библиотека/свето-писмо/nwt/књиге/матеј/5/",
  es: "/es/biblioteca/biblia/nwt/libros/mateo/5/",
  it: "/it/biblioteca-digitale/bibbia/nwt/libri/matteo/5/",
  pl: "/pl/biblioteka/biblia/nwt/ksiegi-biblijne/mateusza/5/",
  de: "/de/bibliothek/bibel/nwt/bibelbuecher/Matthäus/5/",
  fr: "/fr/bibliothèque/bible/nwt/livres/matthieu/5/",
};
export function jwLanguage(url) {
  const prefix = new URL(url).pathname.split("/")[1];
  return ["sr-cyrl", "sr-latn"].includes(prefix) ? "sr" : prefix;
}
