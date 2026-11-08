"""Adapter contracts, extraction boundaries and redirect restrictions."""

import unittest
from unittest.mock import patch

import httpx

from content_import import import_content, source_catalog
from source_http import fetch_page
from wiki_import import extract_document, validate_url

WIKIPEDIA = b"""<h1 id="firstHeading">Test article</h1>
<div class="mw-parser-output"><p></p></div>
<div class="mw-parser-output"><table><tr><td>Infobox noise</td></tr></table>
<p>First <b>reading</b> paragraph<sup class="reference">[1]</sup>.</p>
<h2>History</h2><p>Second paragraph.</p><h2>Forr\xc3\xa1sok</h2>
<p>Citation noise.</p><h2>Culture</h2><p>Third paragraph.</p></div>"""
WIKTIONARY = """<h1>alma</h1><div class="mw-parser-output">
<h2>Magyar</h2><h3>Kiejt\u00e9s</h3>
<a href="//upload.wikimedia.org/example/Hu-alma.ogg.mp3">Listen</a>
<p>Pronunciation controls.</p><h3>F\u0151n\u00e9v</h3><p>alma</p>
<ol><li>Hungarian definition.<dl><dd>Example.</dd></dl></li></ol>
<h3>Ford\u00edt\u00e1sok</h3><p>Foreign translations.</p>
<h2>Portug\u00e1l</h2><ol><li>Foreign definition.</li></ol>
<a href="//upload.wikimedia.org/foreign.mp3">Wrong clip</a></div>""".encode()


class SourceTests(unittest.TestCase):
    def test_wikipedia_excludes_chrome_and_references_keeps_main_text(self):
        result = extract_document(
            WIKIPEDIA, "https://hu.wikipedia.org/wiki/Test", dictionary=False
        )
        self.assertEqual(
            result["text"],
            "First reading paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
        )
        self.assertEqual(result["audioUrl"], "")
        self.assertEqual(result["source"]["licenseName"], "CC BY-SA 4.0")

    def test_wiktionary_only_hungarian_definitions_and_separate_pronunciation(self):
        result = extract_document(
            WIKTIONARY, "https://hu.wiktionary.org/wiki/alma", dictionary=True
        )
        self.assertIn("Hungarian definition.", result["text"])
        self.assertNotIn("Foreign", result["text"])
        self.assertNotIn("Pronunciation controls", result["text"])
        self.assertEqual(result["audioUrl"], "")
        self.assertEqual(result["segments"], [])
        self.assertEqual(
            result["pronunciationUrl"],
            "https://upload.wikimedia.org/example/Hu-alma.ogg.mp3",
        )

    def test_entry_without_hungarian_section_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "no Hungarian"):
            extract_document(
                b'<div class="mw-parser-output"><h2>English</h2><p>Other language.</p></div>',
                "https://hu.wiktionary.org/wiki/test",
                dictionary=True,
            )

    def test_long_articles_report_truncation_at_paragraph_boundaries(self):
        html = (
            '<h1>Long</h1><div class="mw-parser-output">'
            + "<p>"
            + "a" * 60000
            + "</p><p>"
            + "b" * 60000
            + "</p></div>"
        ).encode()
        result = extract_document(
            html, "https://hu.wikipedia.org/wiki/Long", dictionary=False
        )
        self.assertEqual(result["text"], "a" * 60000)
        self.assertIn("shortened", result["notice"])

    def test_article_urls_reject_other_hosts_credentials_ports_and_namespaces(self):
        for url in [
            "http://hu.wikipedia.org/wiki/Test",
            "https://hu.wikipedia.org.evil.test/wiki/Test",
            "https://user:pass@hu.wikipedia.org/wiki/Test",
            "https://hu.wikipedia.org:444/wiki/Test",
            "https://hu.wikipedia.org/wiki/Special:Random",
            "https://hu.wikipedia.org/wiki/../w/api.php",
            "https://hu.wikipedia.org/",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_url(url, "hu.wikipedia.org")

    def test_registry_rejects_unsupported_and_mismatched_sites(self):
        self.assertEqual(len(source_catalog()), 3)
        with self.assertRaisesRegex(ValueError, "not supported"):
            import_content("https://localhost/private")
        with self.assertRaisesRegex(ValueError, "does not match"):
            import_content("https://hu.wikipedia.org/wiki/Test", "jw")
        with patch(
            "wiki_import.fetch_page",
            return_value=(WIKIPEDIA, "https://hu.wikipedia.org/wiki/Test"),
        ):
            result = import_content("https://hu.wikipedia.org/wiki/Test")
        self.assertEqual(result["source"]["id"], "wikipedia")

    def test_redirects_are_validated_before_the_next_connection(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(
                302, headers={"location": "https://127.0.0.1/private"}
            )
        )
        original = httpx.Client
        with (
            patch(
                "source_http.httpx.Client",
                side_effect=lambda **kwargs: original(transport=transport, **kwargs),
            ),
            self.assertRaises(ValueError),
        ):
            fetch_page(
                "https://hu.wikipedia.org/wiki/Test",
                lambda url: validate_url(url, "hu.wikipedia.org"),
            )


if __name__ == "__main__":
    unittest.main()
