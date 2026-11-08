import { InputError, UpstreamError } from "./types";

export type Fetcher = typeof fetch;
export const MAX_RESPONSE = 6_000_000;

/** Bound streamed/decompressed bytes, including requests without Content-Length. */
export async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new InputError("Source response is too large.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function fetchPage(
  raw: string,
  validate: (url: string) => string,
  fetcher: Fetcher = fetch,
) {
  // One deadline covers redirects and reading the body, rather than headers alone.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let url = raw;
  try {
    for (let hop = 0; hop < 5; hop++) {
      url = validate(url);
      const response = await fetcher(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "HearAndRead/0.1 (personal reading tool)" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new UpstreamError(response.status);
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new UpstreamError(response.status);
      }
      return {
        html: new TextDecoder().decode(
          await readBounded(response, MAX_RESPONSE),
        ),
        url,
      };
    }
    throw new InputError("Too many source redirects.");
  } finally {
    clearTimeout(timer);
  }
}

export function publicUrl(
  raw: string,
  hosts: readonly string[],
  message: string,
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InputError(message);
  }
  if (
    url.protocol !== "https:" ||
    !hosts.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new InputError(message);
  }
  url.hash = "";
  return url;
}
