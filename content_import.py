"""Source registry: add adapters here without changing the import endpoint/UI."""

from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit

import jw_import
import wiki_import


@dataclass(frozen=True)
class SourceAdapter:
    id: str
    name: str
    hosts: tuple[str, ...]
    description: str
    example: str
    importer: Callable[[str], dict]


SOURCES = (
    SourceAdapter(
        "jw",
        "JW.org",
        ("www.jw.org", "jw.org"),
        "Text and original recordings, with segment timings when available.",
        "https://www.jw.org/hu/konyvtar/biblia/nwt/konyvek/M%C3%A1t%C3%A9/5/",
        jw_import.import_page,
    ),
    SourceAdapter(
        "wikipedia",
        "Wikipedia",
        ("hu.wikipedia.org",),
        "Hungarian article text. Listen with a browser voice or add your own recording.",
        "https://hu.wikipedia.org/wiki/Budapest",
        wiki_import.import_page,
    ),
    SourceAdapter(
        "wiktionary",
        "Wiktionary",
        ("hu.wiktionary.org",),
        "Hungarian definitions, plus word pronunciation when available. Browser voice reads the definitions.",
        "https://hu.wiktionary.org/wiki/alma",
        wiki_import.import_page,
    ),
)


def source_catalog() -> list[dict]:
    return [
        {
            "id": source.id,
            "name": source.name,
            "description": source.description,
            "example": source.example,
        }
        for source in SOURCES
    ]


def import_content(url: str, source_id: str = "auto") -> dict:
    adapter = next(
        (source for source in SOURCES if urlsplit(url).hostname in source.hosts), None
    )
    if adapter is None:
        raise ValueError(
            "This website is not supported yet. Choose a listed source, or paste text and add audio manually."
        )
    if source_id != "auto" and source_id != adapter.id:
        raise ValueError(
            "The URL does not match the selected source. Change the source or paste its page URL."
        )
    result = adapter.importer(url)
    result.setdefault("source", {"name": adapter.name, "url": result["sourceUrl"]})
    result.setdefault("pronunciationUrl", "")
    result.setdefault("language", "hu")
    result["source"]["id"] = adapter.id
    return result
