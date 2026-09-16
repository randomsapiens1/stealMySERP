"""Local SERP crawler bridge for StealMySERP.

Launches your REAL, installed Google Chrome (not Playwright's bundled
Chromium) from a local copy of your actual Default profile — real cookies,
history, and Google session, not a freshly-fingerprinted automation
profile — and connects to it over the Chrome DevTools Protocol. Exposes an
HTTP API that the Next.js app calls instead of scraping Google directly.

Why a real profile: a brand-new Playwright-launched browser has no
history and detectable automation fingerprints (navigator.webdriver, CDP
quirks), which can itself look suspicious to Google — sometimes more
suspicious than a plain fetch(). A copy of your years-old real profile
looks like, well, you.

Why a COPY, not your live Chrome: attaching to an already-running Chrome
requires it to have been launched with --remote-debugging-port from the
start, which means quitting your actual Chrome (closing your tabs) to
relaunch it — disruptive, and opens your live logged-in session to full
remote control. A copy avoids both: your real Chrome is never touched,
and only a curated subset of your profile (cookies, history, bookmarks,
preferences, favicons — not saved passwords, not extensions, not the
multi-GB cache/IndexedDB/Service Worker data) is duplicated locally into
.real-chrome-profile/ (gitignored), once.

This is for local, personal use only — see ../README.md and
crawler-service/README.md.

Usage:
    pip install -r requirements.txt
    playwright install chromium   # only used as the driver, not the browser
    python server.py
"""

from __future__ import annotations

import asyncio
import os
import random
import shutil
import subprocess
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator
from urllib.parse import urlencode

from fastapi import FastAPI
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from pydantic import BaseModel

from serp_parser import looks_blocked, parse_serp_html

CHROME_BINARY = os.environ.get(
    "CHROME_BINARY", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)
REAL_PROFILE_NAME = os.environ.get("CHROME_PROFILE_NAME", "Default")
REAL_CHROME_USER_DATA_DIR = Path.home() / "Library/Application Support/Google/Chrome"
PROFILE_COPY_DIR = Path(__file__).parent / ".real-chrome-profile"
CDP_PORT = 9222

# Identity-establishing files worth copying — not the huge, irrelevant
# caches (Service Worker/IndexedDB/File System can easily be 1GB+), not
# Login Data (OS-keychain-encrypted, won't decrypt from a copy anyway),
# not Extensions (we don't want random extensions running here).
PROFILE_FILES_TO_COPY = [
    "Cookies",
    "History",
    "Web Data",
    "Preferences",
    "Secure Preferences",
    "Bookmarks",
    "Favicons",
]

MIN_DELAY_SECONDS = 4
MAX_DELAY_SECONDS = 9
CAPTCHA_POLL_INTERVAL_SECONDS = 3
CAPTCHA_TIMEOUT_SECONDS = 180
NAVIGATION_TIMEOUT_MS = 20_000

_state: dict[str, Any] = {}


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


def _ensure_profile_copy() -> None:
    """Clone the real profile's identity files once. Re-running the server
    won't re-copy (and won't pick up newer cookies from your real Chrome)
    — delete .real-chrome-profile/ manually to force a fresh clone."""
    dest_profile = PROFILE_COPY_DIR / REAL_PROFILE_NAME
    if dest_profile.exists():
        return

    source_profile = REAL_CHROME_USER_DATA_DIR / REAL_PROFILE_NAME
    dest_profile.mkdir(parents=True, exist_ok=True)

    for name in PROFILE_FILES_TO_COPY:
        src = source_profile / name
        if not src.exists():
            continue
        dst = dest_profile / name
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    source_local_state = REAL_CHROME_USER_DATA_DIR / "Local State"
    if source_local_state.exists():
        shutil.copy2(source_local_state, PROFILE_COPY_DIR / "Local State")


def _clear_stale_singleton_locks() -> None:
    """Locks copied alongside the profile could reference your real
    Chrome's live PID/socket — clear them so this copy starts clean."""
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        p = PROFILE_COPY_DIR / name
        if p.exists() or p.is_symlink():
            p.unlink()


async def _wait_for_cdp_ready(port: int, timeout_s: float = 20) -> None:
    url = f"http://127.0.0.1:{port}/json/version"
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except Exception:
            await asyncio.sleep(0.5)
    raise RuntimeError(f"Chrome didn't expose its CDP endpoint on port {port} in time")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _ensure_profile_copy()
    _clear_stale_singleton_locks()

    chrome_process = subprocess.Popen(
        [
            CHROME_BINARY,
            f"--user-data-dir={PROFILE_COPY_DIR}",
            f"--profile-directory={REAL_PROFILE_NAME}",
            f"--remote-debugging-port={CDP_PORT}",
            "--no-first-run",
            "--no-default-browser-check",
        ]
    )
    _state["chrome_process"] = chrome_process

    playwright = await async_playwright().start()
    await _wait_for_cdp_ready(CDP_PORT)
    browser: Browser = await playwright.chromium.connect_over_cdp(
        f"http://127.0.0.1:{CDP_PORT}"
    )
    context: BrowserContext = browser.contexts[0] if browser.contexts else await browser.new_context()
    page: Page = context.pages[0] if context.pages else await context.new_page()

    await page.goto("https://www.google.com", timeout=NAVIGATION_TIMEOUT_MS)
    await _accept_consent_if_present(page)

    _state["playwright"] = playwright
    _state["browser"] = browser
    _state["context"] = context
    _state["page"] = page
    # Created here, not at module level, so it binds to the event loop
    # uvicorn actually runs (module-level asyncio.Lock() binds too early
    # on Python <3.10 and raises "attached to a different loop").
    _state["lock"] = asyncio.Lock()

    print("StealMySERP crawler bridge ready on http://localhost:8787")
    print(f"Using a copy of your real Chrome profile ({REAL_PROFILE_NAME}) — a Chrome")
    print("window is open; leave it running while the web app makes requests.")
    print("If Google shows a verification challenge, solve it in that window; the")
    print("in-flight request will pick back up automatically once it clears.")

    yield

    try:
        await browser.close()
    except Exception:
        pass
    await playwright.stop()
    chrome_process.terminate()


app = FastAPI(lifespan=lifespan)


class SerpRequest(BaseModel):
    query: str
    hl: str = "en"
    gl: str = "us"


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def _get_stable_content(page: Page, retries: int = 5) -> str:
    """page.content() races with Google's post-load client-side navigation
    (redirects/rewrites after the initial "load" event) and can raise
    "page is navigating and changing the content" — retry through it."""
    for attempt in range(retries):
        try:
            return await page.content()
        except Exception:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(0.5)
    raise RuntimeError("unreachable")


@app.post("/serp")
async def serp(req: SerpRequest) -> dict[str, Any]:
    page: Page = _state["page"]
    lock: asyncio.Lock = _state["lock"]
    base = {"query": req.query, "hl": req.hl, "gl": req.gl}

    async with lock:
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

        try:
            # Google's page keeps mutating (redirects, client-side rewrites)
            # briefly after "load" fires — give it a moment to settle. Not
            # fatal if this itself times out; _get_stable_content retries.
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass

        try:
            html = await _get_stable_content(page)
        except Exception as err:
            return {
                **base,
                "top10": [],
                "paa": [],
                "relatedSearches": [],
                "error": f"Couldn't read page content: {err}",
            }

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
            html = await _get_stable_content(page)

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
