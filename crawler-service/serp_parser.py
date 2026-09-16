"""Parses Google search result HTML into structured data.

Mirrors the heuristics in lib/serp/parseSerp.ts on the Next.js side (same
structural approach: look for #rso/#search, h3 + ancestor link for organic
results, data-q for People Also Ask, marker text for related searches).
Google's markup is obfuscated and drifts over time — if this starts
returning empty results, inspect a fresh page.content() dump and adjust
the selectors here; the rest of the service doesn't need to change.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from bs4 import BeautifulSoup

BLOCK_MARKERS = [
    'id="captcha-form"',
    "unusual traffic",
    "recaptcha",
    "sorry/index",
    "enablejs",
]

MAX_SNIPPET_LENGTH = 400
MAX_RELATED_TEXT_LENGTH = 100
MAX_PAA_TEXT_LENGTH = 200


@dataclass
class OrganicResult:
    position: int
    title: str
    url: str
    snippet: str


@dataclass
class ParsedSerp:
    top10: list[OrganicResult] = field(default_factory=list)
    paa: list[str] = field(default_factory=list)
    related_searches: list[str] = field(default_factory=list)
    blocked: bool = False


def looks_blocked(html: str) -> bool:
    lower = html.lower()
    return any(marker.lower() in lower for marker in BLOCK_MARKERS)


def _longest_text_child(tag) -> str:
    longest = ""
    for child in tag.find_all(["div", "span"]):
        text = child.get_text(strip=True)
        if len(text) > len(longest) and len(text) < MAX_SNIPPET_LENGTH:
            longest = text
    return longest


def _parse_organic_results(soup: BeautifulSoup) -> list[OrganicResult]:
    container = soup.find(id="rso") or soup.find(id="search")
    if container is None:
        return []

    results: list[OrganicResult] = []
    seen: set[str] = set()

    for h3 in container.find_all("h3"):
        title = h3.get_text(strip=True)
        if not title:
            continue

        link = h3.find_parent("a", href=True)
        if link is None:
            continue

        href = link["href"]
        if not href.startswith("http") or href in seen:
            continue

        block = (
            h3.find_parent("div", attrs={"data-hveid": True})
            or h3.find_parent("div", class_="g")
            or h3.find_parent("div")
        )
        if block is not None and block.get("data-text-ad") is not None:
            continue

        snippet = _longest_text_child(block) if block is not None else ""

        seen.add(href)
        results.append(
            OrganicResult(position=len(results) + 1, title=title, url=href, snippet=snippet)
        )
        if len(results) >= 10:
            break

    return results


def _parse_people_also_ask(soup: BeautifulSoup) -> list[str]:
    questions: list[str] = []
    seen: set[str] = set()

    for el in soup.find_all(attrs={"data-q": True}):
        q = (el.get("data-q") or "").strip()
        if q and q not in seen:
            seen.add(q)
            questions.append(q)

    if not questions:
        for el in soup.find_all(attrs={"role": "button"}):
            text = el.get_text(strip=True)
            if text.endswith("?") and len(text) < MAX_PAA_TEXT_LENGTH and text not in seen:
                seen.add(text)
                questions.append(text)

    return questions


def _parse_related_searches(soup: BeautifulSoup) -> list[str]:
    related: list[str] = []
    seen: set[str] = set()

    marker = None
    for el in soup.find_all(True):
        text = el.get_text(strip=True).lower()
        if text in ("related searches", "people also search for") or text.startswith(
            "searches related to"
        ):
            marker = el

    if marker is not None:
        container = marker
        for _ in range(2):
            if container.parent is not None:
                container = container.parent
        for a in container.find_all("a"):
            text = a.get_text(strip=True)
            if text and len(text) < MAX_RELATED_TEXT_LENGTH and text not in seen:
                seen.add(text)
                related.append(text)

    return related


def parse_serp_html(html: str) -> ParsedSerp:
    if looks_blocked(html):
        return ParsedSerp(blocked=True)

    soup = BeautifulSoup(html, "lxml")
    return ParsedSerp(
        top10=_parse_organic_results(soup),
        paa=_parse_people_also_ask(soup),
        related_searches=_parse_related_searches(soup),
        blocked=False,
    )
