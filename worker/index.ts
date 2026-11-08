import { importContent, sourceCatalog } from "./sources";
import { readBounded, type Fetcher } from "./http";
import { InputError, UpstreamError } from "./types";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' https: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
export function secure(response: Response): Response {
  const result = new Response(response.body, response);
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("Content-Security-Policy", CSP);
  return result;
}
function json(status: number, value: unknown) {
  return secure(
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } }),
  );
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetcher?: Fetcher,
): Promise<Response> {
  const url = new URL(request.url);
  if (
    url.pathname === "/api/sources" &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    const response = json(200, { sources: sourceCatalog() });
    return request.method === "HEAD" ? new Response(null, response) : response;
  }
  if (url.pathname !== "/api/import") {
    if (url.pathname.startsWith("/api/"))
      return json(404, { error: "Not found." });
    if (!["GET", "HEAD"].includes(request.method))
      return json(405, { error: "Method not allowed." });
    return secure(await env.ASSETS.fetch(request));
  }
  if (request.method !== "POST")
    return json(405, { error: "Method not allowed." });
  const origin = request.headers.get("Origin");
  if (
    (origin !== null && origin !== url.origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return json(403, { error: "Import requests must come from this studio." });
  try {
    const length = request.headers.get("Content-Length");
    if (
      length !== null &&
      (!/^\d+$/u.test(length) || Number(length) > 8192 || Number(length) === 0)
    )
      throw new InputError("Import request is empty or too large.");
    let payload: unknown;
    try {
      payload = JSON.parse(
        new TextDecoder().decode(
          await readBounded(new Response(request.body), 8192),
        ),
      );
    } catch {
      throw new InputError(
        "Provide a JSON import request no larger than 8192 bytes.",
      );
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      !("url" in payload) ||
      typeof payload.url !== "string"
    )
      throw new InputError("Provide a supported page URL.");
    const source = "source" in payload ? payload.source : "auto";
    if (typeof source !== "string")
      throw new InputError("Select a supported content source.");
    return json(200, await importContent(payload.url, source, fetcher));
  } catch (error) {
    if (error instanceof InputError) return json(400, { error: error.message });
    if (error instanceof UpstreamError)
      return json(502, {
        error: [403, 429].includes(error.status)
          ? "The website declined automated access. Open the page and paste its text manually, or try again later."
          : "The website could not serve this page. Check the URL or paste its text manually.",
      });
    if (
      error instanceof TypeError ||
      (error instanceof Error &&
        ["AbortError", "TimeoutError"].includes(error.name))
    )
      return json(502, {
        error:
          "The selected website could not be reached or refused the request. Try again, or paste text and choose a voice or recording manually.",
      });
    console.error("Unexpected publisher import failure", error);
    return json(500, {
      error: "Import failed. Paste text and load audio manually.",
    });
  }
}

export default {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
};
