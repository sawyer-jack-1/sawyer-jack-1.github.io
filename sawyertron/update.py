#!/usr/bin/env python3
"""Fetch arXiv metadata, rank it deterministically, and write static JSON."""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import math
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

import yaml


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "sawyertron" / "config.yml"
DATA_DIR = ROOT / "assets" / "sawyertron" / "data"
API_URL = "https://export.arxiv.org/api/query"
USER_AGENT = "SawyerTRON/1.0 (https://sawyer-jack-1.github.io/)"
ATOM = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}


def normalized(value: str) -> str:
    value = value.casefold().replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def api_query(categories: Iterable[str], start: dt.date, end: dt.date) -> str:
    category_query = " OR ".join(f"cat:{category}" for category in categories)
    start_stamp = start.strftime("%Y%m%d") + "0000"
    end_stamp = end.strftime("%Y%m%d") + "2359"
    return f"({category_query}) AND submittedDate:[{start_stamp} TO {end_stamp}]"


def request_feed(url: str, attempts: int = 4) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, socket.timeout):
            if attempt == attempts - 1:
                raise
            time.sleep(max(3, 2 ** attempt))
    raise RuntimeError("unreachable")


def text(node: ET.Element, path: str) -> str:
    child = node.find(path, ATOM)
    return re.sub(r"\s+", " ", child.text or "").strip() if child is not None else ""


def parse_feed(payload: bytes) -> tuple[list[dict[str, Any]], int]:
    root = ET.fromstring(payload)
    total_node = root.find("{http://a9.com/-/spec/opensearch/1.1/}totalResults")
    total = int(total_node.text) if total_node is not None and total_node.text else 0
    papers: list[dict[str, Any]] = []

    for entry in root.findall("atom:entry", ATOM):
        raw_id = text(entry, "atom:id").rsplit("/", 1)[-1]
        paper_id = re.sub(r"v\d+$", "", raw_id)
        published = text(entry, "atom:published")[:10]
        categories = [node.attrib["term"] for node in entry.findall("atom:category", ATOM)]
        authors = [text(node, "atom:name") for node in entry.findall("atom:author", ATOM)]
        papers.append(
            {
                "id": paper_id,
                "url": f"https://arxiv.org/abs/{paper_id}",
                "title": text(entry, "atom:title"),
                "authors": authors,
                "abstract": text(entry, "atom:summary"),
                "published": published,
                "categories": categories,
            }
        )
    return papers, total


def fetch_papers(config: dict[str, Any], start: dt.date, end: dt.date) -> list[dict[str, Any]]:
    collection = config["collection"]
    page_size = int(collection["request_page_size"])
    delay = float(collection["request_delay_seconds"])
    window_days = int(collection.get("backfill_window_days", 30))
    papers: list[dict[str, Any]] = []

    window_start = start
    while window_start <= end:
        window_end = min(window_start + dt.timedelta(days=window_days - 1), end)
        query = api_query(config["categories"], window_start, window_end)
        offset = 0
        total = math.inf

        while offset < total:
            params = urllib.parse.urlencode(
                {
                    "search_query": query,
                    "start": offset,
                    "max_results": page_size,
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                }
            )
            page, total = parse_feed(request_feed(f"{API_URL}?{params}"))
            papers.extend(page)
            offset += len(page)
            if not page or offset >= total:
                break
            time.sleep(delay)

        window_start = window_end + dt.timedelta(days=1)
        if window_start <= end:
            time.sleep(delay)

    unique = {paper["id"]: paper for paper in papers}
    return [paper for paper in unique.values() if start.isoformat() <= paper["published"] <= end.isoformat()]


def phrase_present(phrase: str, haystack: str) -> bool:
    return normalized(phrase) in haystack


def score_paper(paper: dict[str, Any], config: dict[str, Any]) -> tuple[float, list[str]]:
    title = normalized(paper["title"])
    abstract = normalized(paper["abstract"])
    combined = f"{title} {abstract}"
    ranking = config["ranking"]

    if any(phrase_present(phrase, combined) for phrase in config.get("negative_phrases", [])):
        return -math.inf, []

    score = 0.0
    tags: list[str] = []
    for topic in config["topics"].values():
        weight = float(topic["weight"])
        for phrase in topic["phrases"]:
            if phrase_present(phrase, title):
                score += weight * float(ranking["title_match_multiplier"])
                tags.append(phrase)
            elif phrase_present(phrase, abstract):
                score += weight * float(ranking["abstract_match_multiplier"])
                tags.append(phrase)

    author_config = config.get("authors", {})
    # Accept the original single-group shape as well as named groups. When a
    # person belongs to multiple groups, membership should not compound.
    groups = [author_config] if "names" in author_config else author_config.values()
    matching_weights = []
    paper_authors = {normalized(author) for author in paper["authors"]}
    for group in groups:
        if not isinstance(group, dict) or "names" not in group:
            continue
        configured_names = {normalized(name) for name in group.get("names", [])}
        if paper_authors & configured_names:
            matching_weights.append(float(group["weight"]))
    if matching_weights:
        score += max(matching_weights)

    # Tags are literal configured phrases that actually occur in the title or abstract.
    return score, list(dict.fromkeys(tags))[:4]


def rank_papers(papers: Iterable[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    threshold = float(config["ranking"]["minimum_score"])
    daily_limit = int(config["ranking"]["maximum_papers_per_day"])
    by_day: dict[str, list[tuple[float, dict[str, Any]]]] = collections.defaultdict(list)

    for paper in papers:
        score, tags = score_paper(paper, config)
        if score < threshold:
            continue
        public_paper = dict(paper)
        public_paper["tags"] = tags
        by_day[paper["published"]].append((score, public_paper))

    ranked: list[dict[str, Any]] = []
    for day in sorted(by_day, reverse=True):
        day_papers = sorted(by_day[day], key=lambda item: (-item[0], item[1]["id"]))
        ranked.extend(paper for _, paper in day_papers[:daily_limit])
    return ranked


def month_key(date_string: str) -> str:
    return date_string[:7]


def read_month(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"papers": []}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def merge_and_write(papers: list[dict[str, Any]], start: dt.date, end: dt.date) -> None:
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    affected_months = set()
    cursor = start.replace(day=1)
    while cursor <= end:
        affected_months.add(cursor.strftime("%Y-%m"))
        cursor = (cursor.replace(day=28) + dt.timedelta(days=4)).replace(day=1)

    incoming_by_month: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for paper in papers:
        incoming_by_month[month_key(paper["published"])].append(paper)

    for month in affected_months:
        path = DATA_DIR / f"{month}.json"
        existing = read_month(path).get("papers", [])
        preserved = {
            paper["id"]: paper
            for paper in existing
            if not (start.isoformat() <= paper["published"] <= end.isoformat())
        }
        preserved.update({paper["id"]: paper for paper in incoming_by_month.get(month, [])})
        merged = sorted(preserved.values(), key=lambda paper: paper["published"], reverse=True)
        write_json(
            path,
            {
                "month": month,
                "generated_at": generated_at,
                "source": "arXiv metadata API",
                "papers": merged,
            },
        )

    write_index(end.strftime("%Y-%m"), generated_at)


def write_index(current_month: str, generated_at: str) -> None:
    months = []
    for path in sorted(DATA_DIR.glob("20??-??.json"), reverse=True):
        data = read_month(path)
        months.append({"month": data["month"], "count": len(data.get("papers", []))})
    write_json(
        DATA_DIR / "index.json",
        {
            "generated_at": generated_at,
            "current_month": current_month,
            "months": months,
        },
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, help="Number of days to fetch, including the end date")
    parser.add_argument(
        "--initial-backfill",
        action="store_true",
        help="Use collection.initial_backfill_days instead of the daily lookback",
    )
    parser.add_argument("--end-date", type=dt.date.fromisoformat, default=dt.date.today())
    parser.add_argument("--input", type=Path, help="Use a local Atom fixture instead of the network")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config()
    if args.days:
        days = args.days
    elif args.initial_backfill:
        days = int(config["collection"]["initial_backfill_days"])
    else:
        days = int(config["collection"]["daily_lookback_days"])
    start = args.end_date - dt.timedelta(days=days - 1)
    if args.input:
        papers, _ = parse_feed(args.input.read_bytes())
        papers = [paper for paper in papers if start.isoformat() <= paper["published"] <= args.end_date.isoformat()]
    else:
        papers = fetch_papers(config, start, args.end_date)
    ranked = rank_papers(papers, config)
    merge_and_write(ranked, start, args.end_date)
    print(f"Fetched {len(papers)} papers; published {len(ranked)} from {start} through {args.end_date}.")


if __name__ == "__main__":
    main()
