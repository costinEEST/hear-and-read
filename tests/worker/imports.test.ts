import { describe, it, expect, vi } from "vitest";
import { env } from "cloudflare:workers";
import bible from "../fixtures/bible.html?raw";
import nomarkers from "../fixtures/nomarkers.html?raw";
import wikipedia from "../fixtures/wikipedia.html?raw";
import wiktionary from "../fixtures/wiktionary.html?raw";
import {
  extractJw,
  readJw,
  mediaRequest,
  validateJw,
  seconds,
} from "../../worker/jw";
import { extractWiki, validateWiki } from "../../worker/wiki";
import { fetchPage, MAX_RESPONSE, type Fetcher } from "../../worker/http";
import { importContent, sourceCatalog } from "../../worker/sources";
import worker, { handleRequest } from "../../worker/index";

const page = "https://hu.wikipedia.org/wiki/Test";
const assetEnv = {
  ASSETS: { fetch: async () => new Response("Asset", { status: 200 }) },
};
const mockFetch = (
  fn: (url: string, init?: RequestInit) => Response | Promise<Response>,
) =>
  vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(fn(String(input), init)),
  ) as unknown as Fetcher;

describe("native HTMLRewriter imports", () => {
  it("preserves Bible tracks, split verses, publisher boundaries and plain text", async () => {
    const records = await readJw(bible);
    const request = mediaRequest(records.links, "https://www.jw.org/hu/");
    expect(request).toContain("track=5");
    expect(request).toContain("fileformat=MP3");
    const item = {
      track: 5,
      booknum: 40,
      duration: 14,
      file: { url: "https://cfp2.jw-cdn.org/test.mp3" },
      markers: {
        bibleBookNumber: 40,
        bibleBookChapter: 5,
        markers: [1, 2, 3, 99].map((number) => ({
          verseNumber: number,
          startTime: number * 2,
          duration: 2,
        })),
      },
    };
    const result = extractJw(
      records,
      { files: { H: { MP3: [item] } } },
      request,
    );
    expect(result.segments).toHaveLength(3);
    expect(result.segments[2]).toEqual({
      text: "„Boldogok, akik tudják, hogy szükségük van Istenre.",
      start: 6,
      end: 8,
    });
    expect(result.timingSource).toBe("publisher");
    expect(result.text).not.toContain("<span");
  });

  it("keeps inline punctuation and decodes entities exactly once", async () => {
    const records = await readJw(
      '<p>Boldogok<a class="fn">*</a>, akik &eacute;lnek &amp; &#x151; &amp;amp;.</p>',
    );
    expect(records.fields[0].text).toBe("Boldogok, akik élnek & ő &amp;.");
  });

  it("uses plain paragraphs without markers and prefers h1 over title", async () => {
    const records = await readJw(nomarkers);
    const result = extractJw(
      records,
      {
        files: {
          H: {
            MP3: [
              {
                docid: 999,
                duration: 14,
                file: { url: "https://cfp2.jw-cdn.org/a.mp3" },
              },
            ],
          },
        },
      },
      mediaRequest(records.links, "https://www.jw.org/hu/"),
    );
    expect(result.title).toBe("Cím nélküli cikk");
    expect(result.text).toContain("Első bekezdés");
    expect(result.segments).toEqual([]);
    expect(result.timingSource).toBe("estimated");
  });

  it("uses paragraph markers and refuses a mismatched recording", async () => {
    const records = await readJw(
      '<article><p data-pid="1">First.</p><p id="p2">Second.</p></article>',
    );
    const item = {
      docid: 999,
      file: { url: "https://cfp2.jw-cdn.org/a.mp3" },
      markers: {
        markers: [1, 2].map((n) => ({
          mepsParagraphId: n,
          startTime: n,
          duration: 1,
        })),
      },
    };
    expect(
      extractJw(
        records,
        { files: { H: { MP3: [item] } } },
        "https://b.jw-cdn.org/?docid=999",
      ).segments.map((s) => s.text),
    ).toEqual(["First.", "Second."]);
    expect(() =>
      extractJw(
        records,
        { files: { H: { MP3: [item] } } },
        "https://b.jw-cdn.org/?track=5",
      ),
    ).toThrow(/matches/u);
    expect(() => seconds("NaN")).toThrow(/timestamp/u);
  });

  it("keeps Wikipedia paragraphs and credits, excluding references and chrome", async () => {
    const result = await extractWiki(wikipedia, page, false);
    expect(result.text).toBe(
      "First reading paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    );
    expect(result.source?.licenseName).toBe("CC BY-SA 4.0");
    expect(result.source?.historyUrl).toContain("action=history");
    expect(result.audioUrl).toBe("");
  });

  it("keeps only Hungarian definitions and a separate pronunciation clip", async () => {
    const result = await extractWiki(
      wiktionary,
      "https://hu.wiktionary.org/wiki/alma",
      true,
    );
    expect(result.text).toContain("Hungarian definition.");
    expect(result.text).not.toMatch(/Foreign|Pronunciation controls/u);
    expect(result.pronunciationUrl).toBe(
      "https://upload.wikimedia.org/example/Hu-alma.ogg.mp3",
    );
    expect(result.audioUrl).toBe("");
    expect(result.segments).toEqual([]);
  });

  it("rejects missing Hungarian sections and reports truncation at whole blocks", async () => {
    await expect(
      extractWiki(
        '<div class="mw-parser-output"><h2>English</h2><p>Other.</p></div>',
        page,
        true,
      ),
    ).rejects.toThrow(/no matching language/u);
    const result = await extractWiki(
      `<div class="mw-parser-output"><p>${"a".repeat(60_000)}</p><p>${"b".repeat(60_000)}</p></div>`,
      page,
      false,
    );
    expect(result.text).toBe("a".repeat(60_000));
    expect(result.notice).toContain("shortened");
  });

  it("handles optional paragraph end tags without combining blocks", async () => {
    const result = await extractWiki(
      '<div class="mw-parser-output"><p>First<p>Second</div>',
      page,
      false,
    );
    expect(result.text).toBe("First\n\nSecond");
  });

  it("closes optional paragraphs at headings and preserves nested definition text", async () => {
    const result = await extractWiki(
      '<div class="mw-parser-output"><p>First<h2>Források</h2><p>Noise<h2>Culture</h2><p>Second</div>',
      page,
      false,
    );
    expect(result.text).toBe("First\n\nSecond");
    const entry = await extractWiki(
      '<div class="mw-parser-output"><h2>Magyar</h2><ol><li>Outer<ol><li>Inner</li></ol> Tail</li><li>Next</li></ol></div>',
      "https://hu.wiktionary.org/wiki/Test",
      true,
    );
    expect(entry.text).toBe("OuterInner Tail\n\nNext");
  });

  it("decodes publisher URL attributes before selecting metadata", async () => {
    const records = await readJw(
      '<a href="https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=nwt&amp;track=5&amp;fileformat=MP3">Audio</a>',
    );
    expect(
      new URL(
        mediaRequest(records.links, "https://www.jw.org/hu/"),
      ).searchParams.get("track"),
    ).toBe("5");
  });

  it("keeps article/root boundaries when elements match multiple selectors", async () => {
    const records = await readJw(
      '<article id="article"><p>Inside.</p></article><footer><p>Outside.</p></footer>',
    );
    const result = extractJw(
      records,
      {
        files: {
          H: { MP3: [{ file: { url: "https://cfp2.jw-cdn.org/a.mp3" } }] },
        },
      },
      "https://b.jw-cdn.org/",
    );
    expect(result.text).toBe("Inside.");
    const wiki = await extractWiki(
      '<div class="mw-parser-output"><p>Small.</p></div><p>Between.</p><div class="mw-parser-output"><p>Actual article text.</p></div><p>Outside.</p>',
      page,
      false,
    );
    expect(wiki.text).toBe("Actual article text.");
  });
});

describe("URL and network policy", () => {
  it.each([
    "http://www.jw.org/hu/test/",
    "https://www.jw.org.evil.test/hu/test/",
    "https://127.0.0.1/hu/test/",
    "https://user:pass@www.jw.org/hu/test/",
    "https://www.jw.org:444/hu/test/",
    "https://www.jw.org/zz/test/",
  ])("rejects JW URL %s", (url) => {
    expect(() => validateJw(url)).toThrow();
  });
  it.each([
    "http://hu.wikipedia.org/wiki/Test",
    "https://hu.wikipedia.org.evil.test/wiki/Test",
    "https://user:pass@hu.wikipedia.org/wiki/Test",
    "https://hu.wikipedia.org:444/wiki/Test",
    "https://hu.wikipedia.org/wiki/Special:Random",
    "https://hu.wikipedia.org/wiki/../w/api.php",
    "https://hu.wikipedia.org/",
  ])("rejects Wiki URL %s", (url) => {
    expect(() => validateWiki(url, "hu.wikipedia.org")).toThrow();
  });
  it("strips fragments and wiki queries; restricts metadata endpoint", () => {
    expect(validateJw("https://www.jw.org/hu/test/#fragment")).toBe(
      "https://www.jw.org/hu/test/",
    );
    expect(
      validateWiki(`${page}?action=edit#fragment`, "hu.wikipedia.org"),
    ).toBe(page);
    expect(() => validateJw("https://b.jw-cdn.org/private", true)).toThrow();
  });
  it("validates redirects before making the next connection", async () => {
    const fetcher = mockFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/private" },
        }),
    );
    await expect(
      fetchPage(page, (u) => validateWiki(u, "hu.wikipedia.org"), fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds redirects and streamed body size", async () => {
    const fetcher = mockFetch(
      () => new Response(null, { status: 302, headers: { location: page } }),
    );
    await expect(
      fetchPage(page, (u) => validateWiki(u, "hu.wikipedia.org"), fetcher),
    ).rejects.toThrow(/redirects/u);
    expect(fetcher).toHaveBeenCalledTimes(5);
    await expect(
      fetchPage(
        page,
        (u) => u,
        mockFetch(() => new Response("a".repeat(MAX_RESPONSE + 1))),
      ),
    ).rejects.toThrow(/too large/u);
  });
  it("registers three sources and returns the original document contract", async () => {
    expect(sourceCatalog()).toHaveLength(3);
    await expect(importContent("https://localhost/private")).rejects.toThrow(
      /not supported/u,
    );
    await expect(importContent(page, "jw")).rejects.toThrow(/does not match/u);
    const result = await importContent(
      page,
      "auto",
      mockFetch(() => new Response(wikipedia)),
    );
    expect(result.source?.id).toBe("wikipedia");
    expect(result.language).toBe("hu");
    expect(result.pronunciationUrl).toBe("");
  });
});

describe("Worker API", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("https://studio.example/api/import", {
      method: "POST",
      body,
      headers,
    });
  it("lists sources and routes API failures without static fallback", async () => {
    const response = await handleRequest(
      new Request("https://studio.example/api/sources"),
      assetEnv,
    );
    expect(
      ((await response.json()) as { sources: unknown[] }).sources,
    ).toHaveLength(3);
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(
      (
        await handleRequest(
          new Request("https://studio.example/api/missing"),
          assetEnv,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleRequest(
          new Request("https://studio.example/api/import"),
          assetEnv,
        )
      ).status,
    ).toBe(405);
  });
  it("rejects cross-origin, malformed, oversized and invalid requests", async () => {
    expect(
      (
        await handleRequest(
          post("{}", { Origin: "https://evil.example" }),
          assetEnv,
        )
      ).status,
    ).toBe(403);
    for (const body of [
      "{",
      "[]",
      "null",
      '{"url":42}',
      JSON.stringify({ url: page, source: 2 }),
      "a".repeat(8193),
    ]) {
      expect((await handleRequest(post(body), assetEnv)).status).toBe(400);
    }
  });
  it("imports over HTTPS with same-origin validation", async () => {
    const response = await handleRequest(
      post(JSON.stringify({ url: page }), { Origin: "https://studio.example" }),
      assetEnv,
      mockFetch(() => new Response(wikipedia)),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { language: string }).language).toBe(
      "hu",
    );
  });
  it.each([403, 429])(
    "returns manual paste guidance for upstream %s",
    async (status) => {
      const response = await handleRequest(
        post(JSON.stringify({ url: page })),
        assetEnv,
        mockFetch(() => new Response(null, { status })),
      );
      expect(response.status).toBe(502);
      expect(((await response.json()) as { error: string }).error).toContain(
        "declined automated access",
      );
    },
  );

  it("serves generated public assets and never exposes source/configuration", async () => {
    const bindings = env as unknown as Parameters<typeof worker.fetch>[1];
    const home = await worker.fetch(
      new Request("https://studio.example/"),
      bindings,
    );
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("Hear &amp; Read");
    for (const path of [
      "/worker/index.ts",
      "/package.json",
      "/.git/config",
      "/README.md",
    ]) {
      const response = await worker.fetch(
        new Request(`https://studio.example${path}`),
        bindings,
      );
      expect(response.status).toBe(404);
      await response.arrayBuffer();
    }
    const catalog = await worker.fetch(
      new Request("https://studio.example/api/sources"),
      bindings,
    );
    expect(catalog.status).toBe(200);
    await catalog.arrayBuffer();
  });

  it("serves every offline shell resource without redirects and publishes install metadata", async () => {
    const bindings = env as unknown as Parameters<typeof worker.fetch>[1];
    const get = (path: string) =>
      worker.fetch(new Request(`https://studio.example${path}`), bindings);
    const script = await get("/sw.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("Cache-Control")).toBe("no-cache");
    const source = await script.text();
    const urls = JSON.parse(
      source.match(/const SHELL_URLS = (\[[^;]+\]);/u)![1],
    ) as string[];
    expect(urls).toContain("/");
    expect(urls).not.toContain("/index.html");
    for (const url of urls) {
      const response = await get(url);
      expect(response.status, url).toBe(200);
      expect(response.headers.get("Location"), url).toBeNull();
      await response.arrayBuffer();
    }
    const manifest = await get("/manifest.webmanifest");
    expect(manifest.headers.get("Content-Type")).toContain(
      "application/manifest+json",
    );
    expect(await manifest.json()).toMatchObject({
      id: "/",
      display: "standalone",
    });
  });
});

describe("multilingual sources", () => {
  const cases = [
    ["en", "English"],
    ["hu", "Magyar"],
    ["ro", "Română"],
    ["uk", "Українська"],
    ["ru", "Русский"],
    ["bg", "Български"],
    ["sr", "Српски"],
    ["es", "Español"],
    ["it", "Italiano"],
    ["pl", "język polski"],
    ["de", "Deutsch"],
    ["fr", "Français"],
  ];
  it.each(cases)(
    "imports %s Wiki text and only that dictionary language",
    async (code, heading) => {
      const url = `https://${code}.wikipedia.org/wiki/Test`;
      expect(validateWiki(url, `${code}.wikipedia.org`)).toBe(url);
      const article = await importContent(
        url,
        "auto",
        mockFetch(
          () =>
            new Response(
              '<div class="mw-parser-output"><p>Article text.</p></div>',
            ),
        ),
      );
      expect(article.language).toBe(code);
      const entry = await extractWiki(
        `<div class="mw-parser-output"><h2>${heading}</h2><ol><li>Matching definition.</li></ol><h2>Other language</h2><ol><li>Foreign definition.</li></ol></div>`,
        `https://${code}.wiktionary.org/wiki/Test`,
        true,
      );
      expect(entry.language).toBe(code);
      expect(entry.text).toBe("Matching definition.");
      const examples = sourceCatalog(code);
      expect(
        examples.find((source) => source.id === "wikipedia")?.example,
      ).toContain(`https://${code}.wikipedia.org/`);
      expect(
        examples.find((source) => source.id === "wiktionary")?.example,
      ).toContain(`https://${code}.wiktionary.org/`);
      expect(() =>
        validateJw(examples.find((source) => source.id === "jw")!.example),
      ).not.toThrow();
    },
  );
  it.each([
    ["de", "Apfel (Deutsch)"],
    ["pl", "jabłko (język polski)"],
  ])(
    "handles %s dictionary language headings and definition lists",
    async (code, heading) => {
      const entry = await extractWiki(
        `<div class="mw-parser-output"><h2>${heading}</h2><dl><dd>Matching definition.</dd></dl><h2>Other</h2><dl><dd>Foreign.</dd></dl></div>`,
        `https://${code}.wiktionary.org/wiki/Test`,
        true,
      );
      expect(entry.text).toBe("Matching definition.");
    },
  );
  it.each([
    ["uk", "Українська"],
    ["ru", "Русский"],
  ])(
    "handles %s level-one language sections without including foreign content",
    async (code, heading) => {
      const entry = await extractWiki(
        `<div class="mw-parser-output"><h1>${heading}</h1><h3>Definitions</h3><ol><li>Matching.</li></ol><h1>Other</h1><ol><li>Foreign.</li></ol></div>`,
        `https://${code}.wiktionary.org/wiki/Test`,
        true,
      );
      expect(entry.text).toBe("Matching.");
    },
  );
  it("uses English by default and keeps JW media metadata in the page language", async () => {
    expect(sourceCatalog()[1].example).toBe(
      "https://en.wikipedia.org/wiki/London",
    );
    const records = await readJw(
      '<article><p>Hello.</p><a href="https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=nwt&amp;track=5&amp;fileformat=MP3">Audio</a></article>',
    );
    expect(
      new URL(
        mediaRequest(records.links, "https://www.jw.org/en/library/"),
      ).searchParams.get("langwritten"),
    ).toBe("E");
    expect(
      new URL(
        mediaRequest(records.links, "https://www.jw.org/ro/biblioteca/"),
      ).searchParams.get("langwritten"),
    ).toBe("M");
    expect(
      new URL(
        mediaRequest(records.links, "https://www.jw.org/sr-cyrl/библиотека/"),
      ).searchParams.get("langwritten"),
    ).toBe("SB");
  });
  it("blocks unregistered language subdomains and cross-host Wiki redirects", async () => {
    expect(() =>
      validateWiki("https://xx.wikipedia.org/wiki/Test", "xx.wikipedia.org"),
    ).toThrow();
    const fetcher = mockFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.test/wiki/Test" },
        }),
    );
    await expect(
      importContent("https://en.wikipedia.org/wiki/Test", "auto", fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
