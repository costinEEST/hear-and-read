"""Deterministic importer tests; these never download publisher content."""

import unittest
from pathlib import Path

from bs4 import BeautifulSoup

from jw_import import clean_text, extract_document, media_request, validate_url

FIXTURES = Path(__file__).parent / "fixtures"


class ImportTests(unittest.TestCase):
    def test_inline_footnotes_do_not_turn_punctuation_into_words(self):
        soup = BeautifulSoup(
            '<span>Boldogok<a class="fn">*</a>, akik itt vannak<a class="b">+</a>.</span>',
            "html.parser",
        )
        element = soup.find("span")
        assert element is not None
        self.assertEqual(clean_text([element]), "Boldogok, akik itt vannak.")

    def test_url_allowlist(self):
        for url in (
            "http://www.jw.org/hu/test/",
            "https://www.jw.org.evil.test/hu/test/",
            "https://127.0.0.1/hu/test/",
            "https://user:pass@www.jw.org/hu/test/",
            "https://www.jw.org:444/hu/test/",
            "https://www.jw.org/en/test/",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_url(url)
        self.assertEqual(
            validate_url("https://www.jw.org/hu/test/#fragment"),
            "https://www.jw.org/hu/test/",
        )

    def test_bible_track_and_split_verses(self):
        html = (FIXTURES / "bible.html").read_bytes()
        request = media_request(
            BeautifulSoup(html, "html.parser"), "https://www.jw.org/hu/"
        )
        self.assertIn("track=5", request)
        self.assertIn("fileformat=MP3", request)
        markers = [
            {
                "verseNumber": number,
                "startTime": f"00:00:{number * 2:02}",
                "duration": 2,
            }
            for number in (1, 2, 3, 99)
        ]
        item = {
            "track": 5,
            "booknum": 40,
            "duration": 14,
            "file": {"url": "https://cfp2.jw-cdn.org/test.mp3"},
            "markers": {
                "bibleBookNumber": 40,
                "bibleBookChapter": 5,
                "markers": markers,
            },
        }
        result = extract_document(html, {"files": {"H": {"MP3": [item]}}}, request)
        self.assertEqual(len(result["segments"]), 3)
        self.assertIn("Boldogok", result["segments"][2]["text"])
        self.assertEqual(result["timingSource"], "publisher")
        self.assertNotIn("<span", result["text"])

    def test_article_without_markers_uses_plain_text(self):
        html = (FIXTURES / "nomarkers.html").read_bytes()
        request = media_request(
            BeautifulSoup(html, "html.parser"), "https://www.jw.org/hu/"
        )
        item = {
            "docid": 999,
            "duration": 14,
            "file": {"url": "https://cfp2.jw-cdn.org/a.mp3"},
        }
        result = extract_document(html, {"files": {"H": {"MP3": [item]}}}, request)
        self.assertEqual(result["segments"], [])
        self.assertEqual(result["timingSource"], "estimated")
        self.assertTrue(result["text"])

    def test_missing_track_is_not_silently_substituted(self):
        html = b'<main><h1>Title</h1><p data-pid="1">Hello</p></main>'
        metadata = {"files": {"H": {"MP3": [{"track": 4}]}}}
        with self.assertRaisesRegex(ValueError, "matches"):
            extract_document(html, metadata, "https://b.jw-cdn.org/?track=5")


if __name__ == "__main__":
    unittest.main()
