import { scanHtml, inside, type HtmlRecord } from "./html";
import { fetchPage, publicUrl, type Fetcher } from "./http";
import { InputError, type Document, type Segment } from "./types";

export function validateJw(raw: string, metadata = false): string {
  const message = "Use a public https://www.jw.org/hu/ page URL.";
  const url = publicUrl(
    raw,
    metadata ? ["b.jw-cdn.org"] : ["www.jw.org", "jw.org"],
    message,
  );
  if (
    metadata
      ? url.pathname !== "/apis/pub-media/GETPUBMEDIALINKS"
      : !url.pathname.startsWith("/hu/")
  )
    throw new InputError(message);
  return url.href;
}

export function mediaRequest(links: HtmlRecord[], pageUrl: string): string {
  const candidates: { score: number; params: URLSearchParams }[] = [];
  for (const tag of links) {
    let url: URL;
    try {
      url = new URL(
        tag.attributes["data-jsonurl"] || tag.attributes.href || "",
        pageUrl,
      );
    } catch {
      continue;
    }
    if (!url.pathname.includes("GETPUBMEDIALINKS")) continue;
    const params = url.searchParams,
      formats = params.get("fileformat") || "";
    const score =
      4 * Number(/MP3|AAC/u.test(formats)) +
      3 * Number(!!params.get("track")) +
      3 * Number(!!params.get("docid")) -
      5 * Number(/PDF|EPUB|JWPUB/u.test(formats));
    if (score > 0) candidates.push({ score, params });
  }
  candidates.sort((a, b) => b.score - a.score);
  const params = candidates[0]?.params;
  if (!params)
    throw new InputError(
      "No audio link found. Paste the text and load its MP3 manually.",
    );
  params.set("output", "json");
  params.set("fileformat", "MP3");
  params.set("alllangs", "0");
  if (!params.has("langwritten")) params.set("langwritten", "H");
  return `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?${params}`;
}

export function seconds(value: string | number): number {
  let result = 0;
  for (const part of String(value).split(":")) {
    if (!part.trim() || !Number.isFinite(Number(part)))
      throw new InputError("Invalid publisher timestamp.");
    result = result * 60 + Number(part);
  }
  if (!Number.isFinite(result) || result < 0)
    throw new InputError("Invalid publisher timestamp.");
  return result;
}

const JW_NOISE =
  "sup, .verseNum, .chapterNum, .footnoteLink, .xrefLink, .fn, .b, .studyNoteLink, script, style";
export async function readJw(html: string) {
  return scanHtml(html, JW_NOISE, {
    articleId: { selector: "#article" },
    subcontent: { selector: "article .docSubContent" },
    articles: { selector: "article" },
    mains: { selector: "main" },
    titles: { selector: "h1" },
    pageTitles: { selector: "title" },
    links: { selector: "[data-jsonurl], a[href*='GETPUBMEDIALINKS']" },
    fields: {
      selector: "[id], [data-pid], p",
      exclude: "nav p, footer p, aside p",
    },
  });
}

interface Marker {
  verseNumber?: number;
  mepsParagraphId?: number;
  startTime: string | number;
  duration: string | number;
}
interface Item {
  track?: number;
  docid?: number;
  booknum?: number;
  duration?: string | number;
  file: { url: string };
  markers?: {
    bibleBookNumber?: number;
    bibleBookChapter?: number;
    markers?: Marker[];
  };
}
export interface Metadata {
  files?: Record<string, { MP3?: Item[] }>;
  pubName?: string;
}

export function extractJw(
  records: Awaited<ReturnType<typeof readJw>>,
  metadata: Metadata,
  request: string,
): Omit<Document, "sourceUrl"> {
  const params = new URL(request).searchParams;
  const items = metadata.files?.[params.get("langwritten") || "H"]?.MP3 || [];
  if (!items.length)
    throw new InputError(
      "This page has no MP3 recording in the selected language.",
    );
  const item = items.find(
    (value) =>
      (!params.has("track") || String(value.track) === params.get("track")) &&
      (!params.has("docid") || String(value.docid) === params.get("docid")),
  );
  if (!item)
    throw new InputError("No recording matches this chapter or article.");
  const audio = new URL(item.file.url);
  if (
    audio.protocol !== "https:" ||
    !audio.hostname.endsWith(".jw-cdn.org") ||
    audio.username ||
    audio.password ||
    audio.port
  )
    throw new InputError(
      "The recording URL is not on the publisher's HTTPS CDN.",
    );
  const root =
    records.articleId[0] ||
    records.subcontent[0] ||
    records.articles[0] ||
    records.mains[0];
  const fields = root
    ? records.fields.filter((record) => inside(record, root))
    : records.fields;
  const markers = item.markers || {},
    segments: Segment[] = [];
  for (const marker of markers.markers || []) {
    let elements;
    if (marker.verseNumber !== undefined) {
      const number = Number(marker.verseNumber);
      if (number === 99) continue;
      const book = Number(markers.bibleBookNumber ?? item.booknum ?? 0),
        chapter = Number(markers.bibleBookChapter ?? item.track ?? 0);
      const pattern = new RegExp(
        `^v${book}${String(chapter).padStart(3, "0")}${String(number).padStart(3, "0")}(?:-\\d+)?$`,
        "u",
      );
      elements = fields.filter((node) =>
        pattern.test(node.attributes.id || ""),
      );
    } else {
      if (marker.mepsParagraphId === undefined) continue;
      const number = Number(marker.mepsParagraphId);
      if (!Number.isInteger(number)) continue;
      elements = fields.filter(
        (node) => node.attributes["data-pid"] === String(number),
      );
      if (!elements.length)
        elements = records.fields.filter(
          (node) => node.attributes.id === `p${number}`,
        );
    }
    const text = elements
      .map((node) => node.text)
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    const start = seconds(marker.startTime),
      end = start + seconds(marker.duration);
    if (end > start) segments.push({ text, start, end });
  }
  segments.sort((a, b) => a.start - b.start);
  let blocks = fields.filter(
    (node) =>
      ["p", "h2", "h3"].includes(node.tag) &&
      node.attributes["data-pid"] !== undefined,
  );
  if (!blocks.length)
    blocks = fields.filter((node) => node.tag === "p" && !node.excluded);
  const text = segments.length
    ? segments.map((s) => s.text).join("\n\n")
    : blocks
        .map((node) => node.text)
        .filter(Boolean)
        .join("\n\n");
  if (!text)
    throw new InputError(
      "No readable article text found. Paste the text manually.",
    );
  return {
    title:
      records.titles[0]?.text ||
      records.pageTitles[0]?.text ||
      metadata.pubName ||
      "JW.org",
    text,
    audioUrl: audio.href,
    duration: seconds(item.duration ?? 0),
    segments,
    timingSource: segments.length ? "publisher" : "estimated",
  };
}

export async function importJw(
  raw: string,
  fetcher?: Fetcher,
): Promise<Document> {
  const { html, url } = await fetchPage(raw, validateJw, fetcher);
  const records = await readJw(html);
  const request = mediaRequest(records.links, url);
  const { html: json } = await fetchPage(
    request,
    (value) => validateJw(value, true),
    fetcher,
  );
  let metadata: Metadata;
  try {
    metadata = JSON.parse(json);
  } catch {
    throw new InputError(
      "The publisher returned invalid media metadata. Try again later.",
    );
  }
  return { ...extractJw(records, metadata, request), sourceUrl: url };
}
