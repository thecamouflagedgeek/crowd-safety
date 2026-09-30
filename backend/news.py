"""Incident-specific public-safety news retrieval (corroboration only).

This is deliberately NOT a general news feed:
  * every query is built from a location + a public-safety keyword family
  * results are labelled ``REPORTED`` (never ``VERIFIED``)
  * a news hit alone can never confirm an incident
  * every provider call is optional and fails soft to seeded source data

Providers: SerpApi (Google News) and NewsAPI.org. If a key is missing or a call
fails, the module simply returns no live items.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx

try:  # load .env regardless of import order
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass

# Public-safety keyword families. Searches stay inside these topics.
PUBLIC_SAFETY_TERMS: Dict[str, List[str]] = {
    "CONGESTION": ["crowd", "crowd congestion", "public gathering", "stampede"],
    "CLOSURE": ["road closure", "traffic diversion", "restriction", "diversion"],
    "ACCIDENT": ["accident", "collision", "traffic accident", "road accident"],
    "SUSPICIOUS_OBJECT": ["unattended baggage", "suspicious object", "security alert"],
    "GENERAL": [
        "protest",
        "rally",
        "procession",
        "festival",
        "police advisory",
        "traffic advisory",
        "emergency",
        "evacuation",
        "fire",
    ],
}

_SAFETY_KEYWORDS = {
    "protest", "rally", "procession", "crowd", "crowded", "congestion", "stampede",
    "gathering", "festival", "accident", "collision", "crash", "traffic", "diversion",
    "closure", "closed", "restriction", "police", "advisory", "fire", "emergency",
    "evacuation", "security", "alert", "unattended", "baggage", "suspicious", "road",
    "jam", "surge", "mob",
}

_CACHE: Dict[str, Tuple[float, List[Dict]]] = {}
_CACHE_TTL = 600.0  # seconds
_MAX_QUERIES = 4


def _api_key(name: str) -> Optional[str]:
    value = os.getenv(name, "").strip()
    if value in ("", "YOUR_KEY", "changeme", "none"):
        return None
    return value


def _cache_get(key: str) -> Optional[List[Dict]]:
    hit = _CACHE.get(key)
    if hit and (time.time() - hit[0]) < _CACHE_TTL:
        return hit[1]
    return None


def _cache_put(key: str, value: List[Dict]) -> None:
    _CACHE[key] = (time.time(), value)


# ------------------------------------------------------------------ query builder
def build_queries(location: str, intents: Optional[set] = None, incident_type: str = "") -> List[str]:
    """Contextual, location-anchored public-safety queries (never generic global news)."""
    place = (location or "").strip()
    if not place:
        return []

    families: List[str] = []
    intents = intents or set()
    for intent in ("CONGESTION", "CLOSURE", "ACCIDENT", "SUSPICIOUS_OBJECT"):
        if intent in intents:
            families.extend(PUBLIC_SAFETY_TERMS[intent])

    type_hint = (incident_type or "").lower()
    if "crowd" in type_hint:
        families = PUBLIC_SAFETY_TERMS["CONGESTION"] + families
    elif "accident" in type_hint:
        families = PUBLIC_SAFETY_TERMS["ACCIDENT"] + families
    elif "baggage" in type_hint:
        families = PUBLIC_SAFETY_TERMS["SUSPICIOUS_OBJECT"] + families

    families.extend(PUBLIC_SAFETY_TERMS["GENERAL"])

    seen, queries = set(), []
    for term in families:
        query = f"{place} {term}"
        if query not in seen:
            seen.add(query)
            queries.append(query)
        if len(queries) >= _MAX_QUERIES:
            break
    return queries


# --------------------------------------------------------------------- providers
def _serpapi(query: str, limit: int) -> List[Dict]:
    key = _api_key("SERPAPI_KEY")
    if key is None:
        return []
    try:
        response = httpx.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_news",
                "q": query,
                "gl": os.getenv("NEWS_COUNTRY", "in"),
                "hl": os.getenv("NEWS_LANG", "en"),
                "api_key": key,
            },
            timeout=5.0,
        )
        response.raise_for_status()
        data = response.json()
        items = []
        for row in (data.get("news_results") or [])[:limit]:
            source = row.get("source") or {}
            items.append(
                {
                    "provider": "serpapi",
                    "title": row.get("title") or "",
                    "url": row.get("link") or "",
                    "publisher": source.get("name") if isinstance(source, dict) else str(source),
                    "claim": (row.get("snippet") or row.get("title") or "").strip(),
                    "published_at": row.get("date"),
                }
            )
        return items
    except Exception:
        return []


def _newsapi(query: str, limit: int, window_hours: int) -> List[Dict]:
    key = _api_key("NEWS_API_KEY")
    if key is None:
        return []
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).strftime("%Y-%m-%dT%H:%M:%S")
        response = httpx.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "language": os.getenv("NEWS_LANG", "en"),
                "sortBy": "publishedAt",
                "pageSize": limit,
                "from": since,
                "apiKey": key,
            },
            timeout=5.0,
        )
        response.raise_for_status()
        data = response.json()
        items = []
        for row in (data.get("articles") or [])[:limit]:
            source = row.get("source") or {}
            items.append(
                {
                    "provider": "newsapi",
                    "title": row.get("title") or "",
                    "url": row.get("url") or "",
                    "publisher": source.get("name") if isinstance(source, dict) else str(source),
                    "claim": (row.get("description") or row.get("title") or "").strip(),
                    "published_at": row.get("publishedAt"),
                }
            )
        return items
    except Exception:
        return []


# ----------------------------------------------------------------------- facade
def is_public_safety(text: str) -> bool:
    """True if the text mentions a public-safety topic (relevance gate)."""
    words = set((text or "").lower().replace("-", " ").split())
    return bool(words & _SAFETY_KEYWORDS)


_LOCATION_STOPWORDS = {"the", "and", "near", "road", "street", "area", "zone", "gate", "platform"}


def _location_tokens(location: str) -> List[str]:
    tokens = re.findall(r"[a-z]{3,}", (location or "").lower())
    return [t for t in tokens if t not in _LOCATION_STOPWORDS]


def locality_match(location: str, text: str) -> bool:
    """True only if the text actually names the searched place."""
    tokens = _location_tokens(location)
    if not tokens:
        return False
    lowered = (text or "").lower()
    return any(token in lowered for token in tokens)


def normalize(item: Dict, location: str) -> Dict:
    """Normalized source object. Live news is always status REPORTED."""
    raw = f"{item.get('provider')}|{item.get('url') or item.get('title')}"
    slug = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8]
    published = item.get("published_at") or ""
    timestamp = ""
    try:
        timestamp = datetime.fromisoformat(str(published).replace("Z", "+00:00")).strftime("%H:%M")
    except Exception:
        timestamp = str(published)[:5]
    return {
        "id": f"news_{slug}",
        "source": "News",
        "type": "news",
        "provider": item.get("provider"),
        "label": item.get("publisher") or "News",
        "title": item.get("title", ""),
        "url": item.get("url", ""),
        "claim": item.get("claim", ""),
        "location": location,
        "timestamp": timestamp,
        "published_at": published,
        "status": "REPORTED",
        "credibility": 0.5,
        "locality_match": locality_match(location, f"{item.get('title', '')} {item.get('claim', '')}"),
    }


def fetch_news(
    location: str,
    intents: Optional[set] = None,
    incident_type: str = "",
    limit: int = 5,
) -> Dict:
    """Return {items: [...], providers: {...}, queries: [...]}."""
    queries = build_queries(location, intents, incident_type)
    providers = {"serpapi": _api_key("SERPAPI_KEY") is not None, "newsapi": _api_key("NEWS_API_KEY") is not None}
    if not queries:
        return {"items": [], "providers": providers, "queries": []}

    limit = int(os.getenv("NEWS_MAX_RESULTS", str(limit)) or limit)
    window_hours = int(os.getenv("NEWS_WINDOW_HOURS", "72") or 72)

    def _one(query: str) -> List[Dict]:
        cache_key = f"{query}|{limit}"
        cached = _cache_get(cache_key)
        if cached is None:
            cached = _serpapi(query, limit) + _newsapi(query, limit, window_hours)
            _cache_put(cache_key, cached)
        return cached

    # Fetch queries concurrently and bound total latency so /verify stays snappy.
    raw: List[Dict] = []
    budget = float(os.getenv("NEWS_TIMEOUT_SECONDS", "6") or 6)
    with ThreadPoolExecutor(max_workers=min(4, max(1, len(queries)))) as pool:
        futures = [pool.submit(_one, query) for query in queries]
        try:
            for future in as_completed(futures, timeout=budget):
                try:
                    raw.extend(future.result())
                except Exception:
                    continue
        except Exception:
            pass  # budget exceeded - return whatever arrived (cache keeps it cheap)

    collected: List[Dict] = []
    seen = set()
    for item in raw:
        text = f"{item.get('title', '')} {item.get('claim', '')}"
        if not is_public_safety(text):
            continue  # keep the feed incident-specific, not generic news
        dedupe = (item.get("url") or item.get("title") or "").strip().lower()
        if not dedupe or dedupe in seen:
            continue
        seen.add(dedupe)
        collected.append(normalize(item, location))

    # Most recent first when a timestamp is available.
    collected.sort(key=lambda i: i.get("published_at") or "", reverse=True)
    return {"items": collected[: max(limit, 5)], "providers": providers, "queries": queries}


def provider_status() -> Dict[str, bool]:
    return {
        "serpapi": _api_key("SERPAPI_KEY") is not None,
        "newsapi": _api_key("NEWS_API_KEY") is not None,
    }
