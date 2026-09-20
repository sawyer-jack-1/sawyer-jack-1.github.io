import datetime as dt
import unittest
import urllib.error
from unittest import mock

from update import fetch_papers, oai_set_spec, parse_oai_feed, rank_papers, score_paper


CONFIG = {
    "ranking": {
        "minimum_score": 3,
        "maximum_papers_per_day": 40,
        "title_match_multiplier": 2.5,
        "abstract_match_multiplier": 1,
    },
    "topics": {
        "resistance": {"weight": 10, "phrases": ["effective resistance", "graph Laplacian"]}
    },
    "authors": {"weight": 12, "names": ["Ada Lovelace"]},
    "negative_phrases": ["resistance training"],
}


def paper(title, abstract="", authors=None, paper_id="2609.00001"):
    return {
        "id": paper_id,
        "url": f"https://arxiv.org/abs/{paper_id}",
        "title": title,
        "authors": authors or ["Grace Hopper"],
        "abstract": abstract,
        "published": "2026-09-18",
        "categories": ["math.CO"],
    }


class RankingTests(unittest.TestCase):
    def test_title_matches_outweigh_abstract_matches(self):
        title_score, _ = score_paper(paper("Effective resistance on graphs"), CONFIG)
        abstract_score, _ = score_paper(paper("A graph paper", "We study effective resistance."), CONFIG)
        self.assertGreater(title_score, abstract_score)

    def test_author_match_is_supported(self):
        score, _ = score_paper(paper("Unrelated title", authors=["Ada Lovelace"]), CONFIG)
        self.assertEqual(score, 12)

    def test_author_groups_use_highest_weight(self):
        config = dict(CONFIG)
        config["authors"] = {
            "primary": {"weight": 6, "names": ["Ada Lovelace"]},
            "secondary": {"weight": 1, "names": ["Ada Lovelace"]},
        }
        score, _ = score_paper(paper("Unrelated title", authors=["Ada Lovelace"]), config)
        self.assertEqual(score, 6)

    def test_negative_phrase_excludes_false_positive(self):
        score, _ = score_paper(paper("Effective resistance training methods"), CONFIG)
        self.assertEqual(score, float("-inf"))

    def test_public_output_contains_no_score(self):
        ranked = rank_papers([paper("Effective resistance on graphs")], CONFIG)
        self.assertEqual(len(ranked), 1)
        self.assertNotIn("score", ranked[0])
        self.assertEqual(ranked[0]["tags"], ["effective resistance"])


class OaiTests(unittest.TestCase):
    def test_category_becomes_oai_set(self):
        self.assertEqual(oai_set_spec("math.CO"), "math:math:CO")
        self.assertEqual(oai_set_spec("cs.DS"), "cs:cs:DS")

    def test_oai_metadata_has_the_same_public_shape(self):
        payload = b"""<?xml version='1.0'?>
        <OAI-PMH xmlns='http://www.openarchives.org/OAI/2.0/'
          xmlns:oai_dc='http://www.openarchives.org/OAI/2.0/oai_dc/'
          xmlns:dc='http://purl.org/dc/elements/1.1/'>
          <ListRecords><record><header><identifier>oai:arXiv.org:2609.01234</identifier>
          <setSpec>math:math:CO</setSpec><setSpec>cs:cs:DM</setSpec></header>
          <metadata><oai_dc:dc><dc:identifier>https://arxiv.org/abs/2609.01234</dc:identifier>
          <dc:date>2026-09-18</dc:date><dc:date>2026-09-20</dc:date>
          <dc:creator>Lovelace, Ada</dc:creator><dc:title> A graph paper </dc:title>
          <dc:description> An abstract. </dc:description></oai_dc:dc></metadata></record>
          <resumptionToken>next-page</resumptionToken></ListRecords>
        </OAI-PMH>"""
        papers, token = parse_oai_feed(payload)
        self.assertEqual(token, "next-page")
        self.assertEqual(papers[0]["authors"], ["Ada Lovelace"])
        self.assertEqual(papers[0]["published"], "2026-09-18")
        self.assertEqual(papers[0]["categories"], ["math.CO", "cs.DM"])
        self.assertEqual(papers[0]["url"], "https://arxiv.org/abs/2609.01234")

    @mock.patch("update.fetch_oai_papers")
    @mock.patch("update.fetch_api_papers")
    def test_http_406_uses_oai_fallback(self, api_fetch, oai_fetch):
        api_fetch.side_effect = urllib.error.HTTPError("https://export.arxiv.org", 406, "No", {}, None)
        oai_fetch.return_value = [paper("Fallback paper")]
        result = fetch_papers(CONFIG, dt.date(2026, 9, 18), dt.date(2026, 9, 18))
        self.assertEqual(result, oai_fetch.return_value)
        oai_fetch.assert_called_once()


if __name__ == "__main__":
    unittest.main()
