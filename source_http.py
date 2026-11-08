"""Bounded HTTP fetching shared by source adapters."""

from collections.abc import Callable
from urllib.parse import urljoin

import httpx

MAX_RESPONSE = 6_000_000


def fetch_page(url: str, validate: Callable[[str], str]) -> tuple[bytes, str]:
    """Revalidate every redirect before connecting; bound time and body size."""
    with httpx.Client(
        timeout=20, headers={"User-Agent": "HearAndRead/0.1 (personal reading tool)"}
    ) as client:
        for _ in range(5):
            url = validate(url)
            with client.stream("GET", url) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers["location"])
                    continue
                response.raise_for_status()
                chunks = bytearray()
                for chunk in response.iter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > MAX_RESPONSE:
                        raise ValueError("Source response is too large.")
                return bytes(chunks), url
    raise ValueError("Too many source redirects.")
