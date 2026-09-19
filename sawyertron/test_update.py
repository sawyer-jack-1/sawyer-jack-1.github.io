import unittest

from update import rank_papers, score_paper


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

    def test_negative_phrase_excludes_false_positive(self):
        score, _ = score_paper(paper("Effective resistance training methods"), CONFIG)
        self.assertEqual(score, float("-inf"))

    def test_public_output_contains_no_score(self):
        ranked = rank_papers([paper("Effective resistance on graphs")], CONFIG)
        self.assertEqual(len(ranked), 1)
        self.assertNotIn("score", ranked[0])
        self.assertEqual(ranked[0]["tags"], ["effective resistance"])


if __name__ == "__main__":
    unittest.main()
