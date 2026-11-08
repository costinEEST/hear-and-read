import { importJw } from "./jw";
import { importWiki } from "./wiki";
import { InputError } from "./types";
import type { Fetcher } from "./http";

const SOURCES = [
  {
    id: "jw",
    name: "JW.org",
    hosts: ["www.jw.org", "jw.org"],
    description:
      "Text and original recordings, with segment timings when available.",
    example:
      "https://www.jw.org/hu/konyvtar/biblia/nwt/konyvek/M%C3%A1t%C3%A9/5/",
    importer: importJw,
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    hosts: ["hu.wikipedia.org"],
    description:
      "Hungarian article text. Listen with a browser voice or add your own recording.",
    example: "https://hu.wikipedia.org/wiki/Budapest",
    importer: importWiki,
  },
  {
    id: "wiktionary",
    name: "Wiktionary",
    hosts: ["hu.wiktionary.org"],
    description:
      "Hungarian definitions, plus word pronunciation when available. Browser voice reads the definitions.",
    example: "https://hu.wiktionary.org/wiki/alma",
    importer: importWiki,
  },
];
export function sourceCatalog() {
  return SOURCES.map(({ id, name, description, example }) => ({
    id,
    name,
    description,
    example,
  }));
}

export async function importContent(
  raw: string,
  sourceId = "auto",
  fetcher?: Fetcher,
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InputError("Provide a supported page URL.");
  }
  const adapter = SOURCES.find((source) => source.hosts.includes(url.hostname));
  if (!adapter)
    throw new InputError(
      "This website is not supported yet. Choose a listed source, or paste text and add audio manually.",
    );
  if (sourceId !== "auto" && sourceId !== adapter.id)
    throw new InputError(
      "The URL does not match the selected source. Change the source or paste its page URL.",
    );
  const result = await adapter.importer(raw, fetcher);
  result.source ??= { name: adapter.name, url: result.sourceUrl };
  result.source.id = adapter.id;
  result.pronunciationUrl ??= "";
  result.language = "hu";
  return result;
}
