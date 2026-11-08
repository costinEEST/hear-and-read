"""Serve the local studio and a narrow publisher-import endpoint."""

import argparse
import json
import logging
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from content_import import import_content, source_catalog

WEB = Path(__file__).parent
LOGGER = logging.getLogger(__name__)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "media-src 'self' https: blob:; connect-src 'self'; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def send_head(self):
        path = urlsplit(self.path).path
        # Serve only the browser application, never archives, environment or source.
        if path not in {
            "/",
            "/index.html",
            "/styles.css",
            "/app.js",
            "/timing.js",
            "/speech.js",
            "/speech-playback.js",
            "/assets/logo.svg",
            "/assets/favicon.svg",
            "/assets/wordmark.svg",
            "/assets/social-card.svg",
            "/assets/social-card.png",
        }:
            self.send_error(404)
            return
        return super().send_head()

    def do_POST(self):
        if self.path != "/api/import":
            self.send_error(404)
            return
        expected_origin = f"http://{self.headers.get('Host', '')}"
        if self.headers.get("Origin") not in (None, expected_origin):
            self.reply(403, {"error": "Import requests must come from this studio."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 8192:
                raise ValueError("Import request is empty or too large.")
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict) or not isinstance(payload.get("url"), str):
                raise ValueError("Provide a supported page URL.")
            source = payload.get("source", "auto")
            if not isinstance(source, str):
                raise ValueError("Select a supported content source.")
            document = import_content(payload["url"], source)
        except (ValueError, KeyError, TypeError) as error:
            self.reply(400, {"error": str(error)})
        except httpx.HTTPStatusError as error:
            refused = error.response.status_code in {403, 429}
            self.reply(
                502,
                {
                    "error": "The website declined automated access. Open the page and paste its text manually, or try again later."
                    if refused
                    else "The website could not serve this page. Check the URL or paste its text manually."
                },
            )
        except httpx.HTTPError:
            self.reply(
                502,
                {
                    "error": "The selected website could not be reached or refused the request. "
                    "Try again, or paste text and choose a voice or recording manually."
                },
            )
        except Exception:
            LOGGER.exception("Unexpected publisher import failure")
            self.reply(
                500, {"error": "Import failed. Paste text and load audio manually."}
            )
        else:
            self.reply(200, document)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/sources":
            self.reply(200, {"sources": source_catalog()})
        else:
            super().do_GET()

    def reply(self, status: int, value: dict):
        content = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Hear & Read: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
