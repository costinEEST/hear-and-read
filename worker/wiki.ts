import { LANGUAGES, wikiHosts } from "../languages.js";
import { scanHtml, inside, normalize } from "./html";
import { fetchPage, publicUrl, type Fetcher } from "./http";
import { InputError, type Document } from "./types";

const HOSTS = wikiHosts;
const SKIP = new Set([
  "jegyzetek",
  "források",
  "külső hivatkozások",
  "további információk",
  "kapcsolódó szócikkek",
  "fordítások",
  "ragozás",
  "kiejtés",
  "lásd még",
  "references",
  "external links",
  "see also",
  "further reading",
  "translations",
  "pronunciation",
  "declension",
  "conjugation",
  "note",
  "bibliografie",
  "legături externe",
  "pronunție",
  "traduceri",
  "referințe",
  "примітки",
  "джерела",
  "посилання",
  "переклади",
  "вимова",
  "примечания",
  "источники",
  "ссылки",
  "перевод",
  "произношение",
  "бележки",
  "източници",
  "външни препратки",
  "преводи",
  "произношение",
  "референце",
  "спољашње везе",
  "преводи",
  "изговор",
  "referencias",
  "enlaces externos",
  "traducciones",
  "pronunciación",
  "bibliografia",
  "collegamenti esterni",
  "traduzioni",
  "pronuncia",
  "przypisy",
  "linki zewnętrzne",
  "tłumaczenia",
  "wymowa",
  "einzelnachweise",
  "weblinks",
  "übersetzungen",
  "aussprache",
  "beispiele",
  "übersetzungen",
  "sinonime",
  "antonime",
  "znaczenia pokrewne",
  "przykłady",
  "tłumaczenia",
  "exemples",
  "traductions",
  "notes et références",
  "liens externes",
  "traductions",
  "prononciation",
]);

export function validateWiki(raw: string, host: string): string {
  const message = `Use an article or entry URL such as https://${host}/wiki/alma.`;
  if (!HOSTS.includes(host)) throw new InputError(message);
  const url = publicUrl(raw, [host], message);
  let title: string;
  try {
    title = decodeURIComponent(url.pathname.slice(6));
  } catch {
    throw new InputError(message);
  }
  if (
    !url.pathname.startsWith("/wiki/") ||
    !title.trim() ||
    /[:?]/u.test(title) ||
    title.startsWith("/") ||
    title.split("/").some((p) => p === "." || p === "..")
  ) {
    throw new InputError(message);
  }
  url.search = "";
  return url.href;
}

export async function extractWiki(
  html: string,
  url: string,
  dictionary: boolean,
): Promise<Document> {
  const language = new URL(url).hostname.split(".")[0];
  const config = LANGUAGES[language];
  if (!config) throw new InputError("Choose a supported practice language.");
  const records = await scanHtml(
    html,
    "script, style, sup.reference, .mw-editsection, table, figure, .thumb, .toc, .navbox, .reflist, .references, .noprint, .hatnote, .ambox, .metadata, .catlinks, .mw-empty-elt",
    {
      roots: { selector: ".mw-parser-output" },
      titles: { selector: "#firstHeading, h1" },
      fields: {
        selector:
          ".mw-parser-output h1, .mw-parser-output h2, .mw-parser-output h3, .mw-parser-output h4, .mw-parser-output h5, .mw-parser-output h6, .mw-parser-output p, .mw-parser-output ol > li, .mw-parser-output dl > dd, .mw-parser-output a, .mw-parser-output source",
        exclude:
          "li p, dd p, nav p, aside p, li li, dd li, nav li, aside li, dd dd, li dd, nav dd, aside dd",
      },
    },
  );
  const root = records.roots.sort((a, b) => b.text.length - a.text.length)[0];
  if (!root)
    throw new InputError(
      "No readable article found. Check the page URL or paste text manually.",
    );
  const title =
    records.titles[0]?.text ||
    decodeURIComponent(new URL(url).pathname.slice(6)).replaceAll("_", " ");
  const texts: string[] = [],
    pronunciations: string[] = [];
  const matchesLanguage = (heading: string) =>
    config.section.some((name) => {
      const label = name.toLocaleLowerCase(language);
      return (
        heading === label ||
        heading.endsWith(`(${label})`) ||
        heading.startsWith(`${label} (`)
      );
    });
  let active = !dictionary,
    foundLanguage = false,
    skipLevel = 0,
    languageLevel = 0;
  for (const tag of records.fields.filter((record) => inside(record, root))) {
    const name = tag.tag;
    if (/^h[1-6]$/u.test(name)) {
      const level = Number(name[1]),
        heading = normalize(tag.text).toLocaleLowerCase(language);
      if (
        dictionary &&
        (matchesLanguage(heading) || level <= (languageLevel || 2))
      ) {
        active = matchesLanguage(heading);
        if (active) languageLevel = level;
        foundLanguage ||= active;
        skipLevel = 0;
        continue;
      }
      if (!active) continue;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (SKIP.has(heading)) skipLevel = level;
      continue;
    }
    if (!active) continue;
    if (dictionary && ["a", "source"].includes(name)) {
      try {
        const media = new URL(
          tag.attributes.href || tag.attributes.src || "",
          url,
        );
        if (
          media.protocol === "https:" &&
          media.hostname === "upload.wikimedia.org" &&
          !media.username &&
          !media.password &&
          !media.port &&
          /\.(mp3|ogg|wav)$/iu.test(media.pathname) &&
          !pronunciations.includes(media.href)
        )
          pronunciations.push(media.href);
      } catch {
        /* A malformed publisher link is not a pronunciation clip. */
      }
    }
    if (skipLevel || tag.excluded) continue;
    if (name === "p" || (dictionary && ["li", "dd"].includes(name)))
      texts.push(tag.text);
  }
  if (dictionary && !foundLanguage)
    throw new InputError(
      "This entry has no matching language section. Choose another word or paste text manually.",
    );
  const blocks = texts.filter(Boolean),
    included: string[] = [];
  if (!blocks.length)
    throw new InputError("No readable text found on this page.");
  let size = 0;
  for (const text of blocks) {
    if (size + text.length + 2 > 100_000) break;
    included.push(text);
    size += text.length + 2;
  }
  if (!included.length)
    throw new InputError(
      "This article's first text block is too large. Paste a shorter excerpt.",
    );
  const name = dictionary ? "Wiktionary" : "Wikipedia";
  const history = new URL("/w/index.php", url);
  history.search = new URLSearchParams({
    title: decodeURIComponent(new URL(url).pathname.slice(6)),
    action: "history",
  }).toString();
  return {
    title,
    language,
    text: included.join("\n\n"),
    audioUrl: "",
    duration: 0,
    segments: [],
    timingSource: "estimated",
    sourceUrl: url,
    pronunciationUrl:
      pronunciations.find((p) => p.endsWith(".mp3")) || pronunciations[0] || "",
    source: {
      name,
      url,
      licenseName: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      historyUrl: history.href,
    },
    notice:
      included.length < blocks.length
        ? "The article was shortened to fit the 100,000-character limit. Use a matching browser voice or recording."
        : "Text imported. Use a matching browser voice or add a recording.",
  };
}

export async function importWiki(
  raw: string,
  fetcher?: Fetcher,
): Promise<Document> {
  const host = new URL(raw).hostname;
  const { html, url } = await fetchPage(
    raw,
    (value) => validateWiki(value, host),
    fetcher,
  );
  return extractWiki(html, url, host.endsWith(".wiktionary.org"));
}
