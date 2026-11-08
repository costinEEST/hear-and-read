"""Extract reading text from Hungarian Wikipedia and Wiktionary pages."""

import re
from urllib.parse import unquote, urlencode, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup, Tag

from source_http import fetch_page

HOSTS = {"hu.wikipedia.org", "hu.wiktionary.org"}
SKIP_SECTIONS = {
    "jegyzetek",
    "források",
    "külső hivatkozások",
    "további információk",
    "kapcsolódó szócikkek",
    "fordítások",
    "ragozás",
    "kiejtés",
    "lásd még",
}
MAX_TEXT = 100_000


def validate_url(url: str, host: str) -> str:
    parsed = urlsplit(url)
    title = unquote(parsed.path.removeprefix("/wiki/"))
    if (
        host not in HOSTS
        or parsed.scheme != "https"
        or parsed.hostname != host
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or not parsed.path.startswith("/wiki/")
        or not title.strip()
        or ":" in title
        or title.startswith("/")
        or "?" in title
        or any(part in {".", ".."} for part in title.split("/"))
    ):
        raise ValueError(
            f"Use an article or entry URL such as https://{host}/wiki/alma."
        )
    return urlunsplit(("https", parsed.netloc, parsed.path, "", ""))


def text_of(tag: Tag) -> str:
    return re.sub(r"\s+", " ", tag.get_text()).strip()


def extract_document(html: bytes, url: str, *, dictionary: bool) -> dict:
    soup = BeautifulSoup(html, "html.parser", from_encoding="utf-8")
    roots = soup.select(".mw-parser-output")
    if not roots:
        raise ValueError(
            "No readable article found. Check the page URL or paste text manually."
        )
    # A page can contain tiny parser-output fragments before the actual article.
    root = max(roots, key=lambda tag: len(tag.get_text()))
    title_tag = soup.select_one("#firstHeading, h1")
    title = (
        text_of(title_tag)
        if title_tag
        else unquote(urlsplit(url).path[6:]).replace("_", " ")
    )
    for noise in root.select(
        "script, style, sup.reference, .mw-editsection, table, figure, "
        ".thumb, .toc, .navbox, .reflist, .references, .noprint, .hatnote, "
        ".ambox, .metadata, .catlinks, .mw-empty-elt"
    ):
        noise.decompose()
    texts = []
    pronunciations = []
    active = not dictionary
    found_hungarian = False
    skip_level = 0
    for tag in root.find_all(["h2", "h3", "h4", "h5", "h6", "p", "ol", "a", "source"]):
        if re.fullmatch(r"h[2-6]", tag.name):
            level = int(tag.name[1])
            heading = text_of(tag).casefold()
            if dictionary and level == 2:
                active = heading == "magyar"
                found_hungarian |= active
                skip_level = 0
                continue
            if not active:
                continue
            if skip_level and level <= skip_level:
                skip_level = 0
            if heading in SKIP_SECTIONS:
                skip_level = level
            continue
        if not active:
            continue
        # Pronunciation is a separate word clip, never aligned to definition text.
        if dictionary and tag.name in {"a", "source"}:
            raw = str(tag.get("href") or tag.get("src") or "")
            media = urljoin(url, raw)
            parsed = urlsplit(media)
            if (
                parsed.scheme == "https"
                and parsed.hostname == "upload.wikimedia.org"
                and parsed.path.lower().endswith((".mp3", ".ogg", ".wav"))
                and media not in pronunciations
            ):
                pronunciations.append(media)
        if skip_level or tag.name not in {"p", "ol"}:
            continue
        if tag.find_parent(["li", "dd", "table", "nav", "aside"]):
            continue
        if tag.name == "ol":
            if dictionary:
                texts.extend(text_of(li) for li in tag.find_all("li", recursive=False))
        else:
            value = text_of(tag)
            if value:
                texts.append(value)
    if dictionary and not found_hungarian:
        raise ValueError(
            "This entry has no Hungarian (Magyar) section. Choose a Hungarian word or paste text manually."
        )
    texts = [text for text in texts if text]
    if not texts:
        raise ValueError("No readable Hungarian text found on this page.")
    # Keep whole blocks, report truncation instead of cutting a sentence silently.
    included = []
    size = 0
    for text in texts:
        if size + len(text) + 2 > MAX_TEXT:
            break
        included.append(text)
        size += len(text) + 2
    if not included:
        raise ValueError(
            "This article's first text block is too large. Paste a shorter excerpt."
        )
    name = "Wiktionary" if dictionary else "Wikipedia"
    history = f"https://{urlsplit(url).hostname}/w/index.php?" + urlencode(
        {"title": unquote(urlsplit(url).path[6:]), "action": "history"}
    )
    return {
        "title": title,
        "text": "\n\n".join(included),
        "audioUrl": "",
        "duration": 0,
        "segments": [],
        "timingSource": "estimated",
        "sourceUrl": url,
        "pronunciationUrl": next(
            (audio for audio in pronunciations if audio.endswith(".mp3")),
            next(iter(pronunciations), ""),
        ),
        "source": {
            "name": name,
            "url": url,
            "licenseName": "CC BY-SA 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
            "historyUrl": history,
        },
        "notice": f"{name} text imported. Use a Hungarian browser voice or add a matching recording."
        + (
            " The article was shortened to fit the 100,000-character limit."
            if len(included) < len(texts)
            else ""
        ),
    }


def import_page(url: str) -> dict:
    host = urlsplit(url).hostname or ""
    url = validate_url(url, host)
    html, final_url = fetch_page(url, lambda value: validate_url(value, host))
    return extract_document(html, final_url, dictionary=host == "hu.wiktionary.org")
