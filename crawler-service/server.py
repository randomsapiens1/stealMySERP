"""Local SERP crawler bridge for StealMySERP.

Runs a real, visible Chromium browser on your machine (via Playwright) and
exposes an HTTP API that the Next.js app calls instead of scraping Google
directly. A real browser with a persistent profile gets past the
"JavaScript required" gate that a plain fetch() can never pass, and running
from your own residential IP avoids the pre-flagged datacenter IP ranges
that cloud-hosted scrapers run into.

This is for local, personal use only — see ../README.md and
crawler-service/README.md.

Usage:
    pip install -r requirements.txt
    playwright install chromium
    python server.py
"""

from __future__ import annotations

import asyncio
import random
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator
from urllib.parse import urlencode

from fastapi import FastAPI
from playwright.async_api import Page, async_playwright
from pydantic import BaseModel

from serp_parser import looks_blocked, parse_serp_html

PROFILE_DIR = Path(__file__).parent / ".browser-profile"
MIN_DELAY_SECONDS = 4
MAX_DELAY_SECONDS = 9
CAPTCHA_POLL_INTERVAL_SECONDS = 3
CAPTCHA_TIMEOUT_SECONDS = 180
NAVIGATION_TIMEOUT_MS = 20_000

_state: dict[str, Any] = {}
_lock = asyncio.Lock()


async def _accept_consent_if_present(page: Page) -> None:
    """Best-effort click on Google's cookie-consent dialog, if shown."""
    try:
        import re

        button = page.get_by_role("button", name=re.compile("accept all", re.I))
        await button.click(timeout=3000)
    except Exception:
        pass


def _build_search_url(query: str, hl: str, gl: str) -> str:
    params = {"q": query, "num": "10", "hl": hl, "gl": gl, "pws": "0"}
    return f"https://www.google.com/search?{urlencode(params)}"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    PROFILE_DIR.mkdir(exist_ok=True)
    playwright = await async_playwright().start()
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=False,
        viewport={"width": 1280, "height": 900},
    )
    page = await context.new_page()
    await page.goto("https://www.google.com", timeout=NAVIGATION_TIMEOUT_MS)
    await _accept_consent_if_present(page)

    _state["playwright"] = playwright
    _state["context"] = context
    _state["page"] = page

    print("StealMySERP crawler bridge ready on http://localhost:8787")
    print("A Chrome window is open — leave it running while the web app makes requests.")
    print("If Google shows a verification challenge, solve it in that window; the")
    print("in-flight request will pick back up automatically once it clears.")

    yield

    await context.close()
    await playwright.stop()


app = FastAPI(lifespan=lifespan)


class SerpRequest(BaseModel):
    query: str
    hl: str = "en"
    gl: str = "us"


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/serp")
async def serp(req: SerpRequest) -> dict[str, Any]:
    page: Page = _state["page"]
    base = {"query": req.query, "hl": req.hl, "gl": req.gl}

    async with _lock:
        # Randomized human-like pacing between searches, on top of whatever
        # delay the calling app already applies between requests.
        await asyncio.sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))

        url = _build_search_url(req.query, req.hl, req.gl)
        try:
            await page.goto(url, timeout=NAVIGATION_TIMEOUT_MS)
        except Exception as err:
            return {
                **base,
                "top10": [],
                "paa": [],
                "relatedSearches": [],
                "error": f"Navigation failed: {err}",
            }

        html = await page.content()
        waited = 0
        while looks_blocked(html) and waited < CAPTCHA_TIMEOUT_SECONDS:
            if waited == 0:
                print(
                    f'Google is showing a verification challenge for "{req.query}" — '
                    f"solve it in the open browser window; waiting up to "
                    f"{CAPTCHA_TIMEOUT_SECONDS}s..."
                )
            await asyncio.sleep(CAPTCHA_POLL_INTERVAL_SECONDS)
            waited += CAPTCHA_POLL_INTERVAL_SECONDS
            html = await page.content()

        parsed = parse_serp_html(html)

        if parsed.blocked:
            return {
                **base,
                "top10": [],
                "paa": [],
                "relatedSearches": [],
                "blocked": True,
                "error": "Google is still blocking this request after waiting for manual verification.",
            }

        return {
            **base,
            "top10": [r.__dict__ for r in parsed.top10],
            "paa": parsed.paa,
            "relatedSearches": parsed.related_searches,
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8787)
