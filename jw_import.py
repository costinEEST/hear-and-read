"""Read public Hungarian JW pages and their publisher-supplied media markers."""

import math
import re
from typing import Any, TypedDict
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup, Tag

from source_http import fetch_page


class Segment(TypedDict):
    text: str
    start: float
    end: float


def validate_url(url: str, *, metadata: bool = False) -> str:
    """Allow only the publisher page/API hosts, including every redirect hop."""
    parsed = urlsplit(url)
    hosts = {"b.jw-cdn.org"} if metadata else {"www.jw.org", "jw.org"}
    if (
        parsed.scheme != "https"
        or parsed.hostname not in hosts
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or (not metadata and not parsed.path.startswith("/hu/"))
        or (metadata and parsed.path != "/apis/pub-media/GETPUBMEDIALINKS")
    ):
        raise ValueError("Use a public https://www.jw.org/hu/ page URL.")
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))


def fetch_bytes(url: str, *, metadata: bool = False) -> bytes:
    """Bound response size, timeouts and redirects without proxying arbitrary URLs."""
    content, _ = fetch_page(url, lambda value: validate_url(value, metadata=metadata))
    return content


def media_request(soup: BeautifulSoup, page_url: str) -> str:
    """Prefer the chapter/individual article player over issue-wide downloads."""
    candidates: list[tuple[int, dict[str, list[str]]]] = []
    for element in soup.select("[data-jsonurl], a[href*='GETPUBMEDIALINKS']"):
        value = str(element.get("data-jsonurl") or element.get("href") or "")
        parsed = urlsplit(urljoin(page_url, value))
        if "GETPUBMEDIALINKS" not in parsed.path:
            continue
        params = parse_qs(parsed.query)
        formats = params.get("fileformat", [""])[0]
        score = 4 * bool(re.search("MP3|AAC", formats))
        score += 3 * bool(params.get("track")) + 3 * bool(params.get("docid"))
        score -= 5 * bool(re.search("PDF|EPUB|JWPUB", formats))
        if score > 0:
            candidates.append((score, params))
    if not candidates:
        raise ValueError(
            "No audio link found. Paste the text and load its MP3 manually."
        )
    _, params = max(candidates, key=lambda item: item[0])
    params.update(output=["json"], fileformat=["MP3"], alllangs=["0"])
    params.setdefault("langwritten", ["H"])
    return "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?" + urlencode(
        params, doseq=True
    )


def seconds(value: str | int | float) -> float:
    result = 0.0
    for part in str(value).split(":"):
        result = result * 60 + float(part)
    if not math.isfinite(result) or result < 0:
        raise ValueError("Invalid publisher timestamp.")
    return result


def clean_text(elements: list[Tag]) -> str:
    parts = []
    for element in elements:
        clone = BeautifulSoup(str(element), "html.parser")
        for noise in clone.select(
            "sup, .verseNum, .chapterNum, .footnoteLink, .xrefLink, .fn, .b, "
            ".studyNoteLink, script, style"
        ):
            noise.decompose()
        # Preserve inline spacing: adding a separator between every DOM text node
        # would turn punctuation after footnote links into extra standalone words.
        parts.append(clone.get_text())
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def extract_document(html: bytes, metadata: dict[str, Any], request_url: str) -> dict:
    """Return plain text segments; never return publisher markup to the browser."""
    soup = BeautifulSoup(html, "html.parser", from_encoding="utf-8")
    params = parse_qs(urlsplit(request_url).query)
    language = params.get("langwritten", ["H"])[0]
    items = metadata.get("files", {}).get(language, {}).get("MP3", [])
    if not items:
        raise ValueError("This page has no MP3 recording in the selected language.")
    track = params.get("track", [None])[0]
    docid = params.get("docid", [None])[0]
    item = next(
        (
            item
            for item in items
            if (track is None or str(item.get("track")) == track)
            and (docid is None or str(item.get("docid")) == docid)
        ),
        None,
    )
    if item is None:
        raise ValueError("No recording matches this chapter or article.")
    audio_url = item["file"]["url"]
    audio = urlsplit(audio_url)
    if audio.scheme != "https" or not (audio.hostname or "").endswith(".jw-cdn.org"):
        raise ValueError("The recording URL is not on the publisher's HTTPS CDN.")
    root = soup.select_one("#article, article .docSubContent, article, main") or soup
    marker_data = item.get("markers") or {}
    raw_markers = marker_data.get("markers", [])
    segments: list[Segment] = []
    for marker in raw_markers:
        if "verseNumber" in marker:
            number = int(marker["verseNumber"])
            if number == 99:
                continue
            book = int(marker_data.get("bibleBookNumber", item.get("booknum", 0)))
            chapter = int(marker_data.get("bibleBookChapter", item.get("track", 0)))
            pattern = re.compile(rf"^v{book}{chapter:03}{number:03}(?:-\d+)?$")
            elements = root.find_all(id=pattern)
        else:
            number = marker.get("mepsParagraphId")
            if number is None:
                continue
            elements = root.select(f'[data-pid="{int(number)}"]')
            if not elements:
                element = soup.find(id=f"p{int(number)}")
                elements = [element] if isinstance(element, Tag) else []
        text = clean_text(elements)
        if not text:
            continue
        start = seconds(marker["startTime"])
        end = start + seconds(marker["duration"])
        if end > start:
            segments.append({"text": text, "start": start, "end": end})
    segments.sort(key=lambda segment: segment["start"])
    blocks = root.select("p[data-pid], h2[data-pid], h3[data-pid]")
    if not blocks:
        blocks = [
            block
            for block in root.select("p")
            if block.find_parent(["nav", "footer", "aside"]) is None
        ]
    text = "\n\n".join(segment["text"] for segment in segments)
    if not text:
        text = "\n\n".join(filter(None, (clean_text([block]) for block in blocks)))
    if not text:
        raise ValueError("No readable article text found. Paste the text manually.")
    title = soup.find("h1") or soup.find("title")
    return {
        "title": title.get_text(" ", strip=True) if title else metadata.get("pubName"),
        "text": text,
        "audioUrl": audio_url,
        "duration": seconds(item.get("duration", 0)),
        "segments": segments,
        "timingSource": "publisher" if segments else "estimated",
    }


def import_page(url: str) -> dict:
    import json

    url = validate_url(url)
    html = fetch_bytes(url)
    request = media_request(BeautifulSoup(html, "html.parser"), url)
    metadata = json.loads(fetch_bytes(request, metadata=True))
    return {**extract_document(html, metadata, request), "sourceUrl": url}
