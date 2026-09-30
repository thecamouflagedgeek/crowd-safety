"""Sequential multi-model LLM fallback chain (Gemini -> Grok -> deterministic).

The system never depends on a single model. Each provider owns an *ordered* list
of candidate models; every model is attempted in turn and the chain stops the
moment one returns usable text.

    Gemini model 1 -> 2 -> 3 -> 4 -> 5
                              |
                              v  (only if the whole Gemini chain failed)
    Grok model 1 -> 2 -> 3
                              |
                              v  (only if every LLM failed)
    caller's deterministic fallback (see routes/chatbot.py)

Guarantees
----------
* One broken/retired/rate-limited model can never break the API. Any HTTP error
  (400/401/403/404/429/5xx), timeout, connection error or empty response simply
  advances to the next model.
* Every attempt is bounded, so chat never waits indefinitely.
* Keys stay server-side and are never logged.
* Providers are data, not code: append one ``_Provider`` entry and the chain
  picks it up - the chatbot itself needs no change.

Out of scope by design: this module only *phrases* facts. Incident state, CV
evidence, retrieval (SerpApi/NewsAPI) and claim verification remain the backend's
source of truth and are never decided by an LLM.
"""

from __future__ import annotations

import logging
import os
import re
import threading
import time
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import httpx

_LOG = logging.getLogger("backend.llm")

# Make fallback decisions observable. Under plain `uvicorn main:app` the root
# logger has no handler, so INFO lines (successful model) would be swallowed -
# attach a stderr handler of our own unless the host app already configured one.
if not _LOG.handlers and not logging.getLogger().handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s [llm] %(message)s"))
    _LOG.addHandler(_handler)
_LOG.setLevel(logging.INFO)

# --------------------------------------------------------------- model chains
# Current, supported text models. Order matters: cheapest/most-likely-good first.
DEFAULT_GEMINI_MODELS: Tuple[str, ...] = (
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
)

# Current xAI text models. Retired Grok IDs are deliberately absent.
DEFAULT_XAI_MODELS: Tuple[str, ...] = (
    "grok-4.7",
    "grok-4.6",
    "grok-4.3",
)

_DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1"
_PLACEHOLDER_KEYS = {"", "your_key", "your-key", "yourkey", "changeme", "none", "null", "xxx"}

# HTTP status -> short, operator-readable fallback reason.
_REASON_BY_STATUS = {
    400: "400 model unavailable",
    401: "401 auth failure",
    403: "403 access denied",
    404: "404 model unavailable",
    429: "429 rate limit",
    500: "500 provider error",
    502: "502 bad gateway",
    503: "503 unavailable",
    504: "504 upstream timeout",
}
_STATUS_RE = re.compile(r"(?<!\d)(400|401|403|404|429|500|502|503|504)(?!\d)")

# Some providers report a bad/unauthorised key as HTTP 400 rather than 401
# (xAI does). Detect that so the operator sees an auth problem, not a phantom
# "model unavailable".
_AUTH_HINTS = ("api key", "api_key", "apikey", "incorrect api key", "invalid api key", "unauthenticated", "unauthorized", "permission denied")

# Provider -> availability (None until the startup probe finishes).
_probe: Dict[str, Optional[bool]] = {"gemini": None, "grok": None}
# Last model that actually answered, surfaced through /health for debugging.
_last_working: Dict[str, Optional[str]] = {"gemini": None, "grok": None}


# ------------------------------------------------------------------- env util
def _api_key(name: str) -> Optional[str]:
    value = (os.getenv(name) or "").strip()
    return None if value.lower() in _PLACEHOLDER_KEYS else value


def _csv(name: str) -> List[str]:
    raw = os.getenv(name, "") or ""
    return [part.strip() for part in raw.replace("\n", ",").split(",") if part.strip()]


def _dedupe(models: Sequence[str]) -> List[str]:
    seen, result = set(), []
    for model in models:
        if model and model not in seen:
            seen.add(model)
            result.append(model)
    return result


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "") or default)
    except (TypeError, ValueError):
        return default


def model_timeout() -> float:
    """Per-model ceiling. Short enough for chat, long enough for a slow reply."""
    return max(1.0, _float_env("LLM_MODEL_TIMEOUT_SECONDS", 15.0))


def chain_budget() -> float:
    """Safety valve for the whole chain, so a chat request can never hang."""
    return max(5.0, _float_env("LLM_TOTAL_BUDGET_SECONDS", 45.0))


# ------------------------------------------------------------------- chains
def gemini_models() -> List[str]:
    """GEMINI_MODELS override, else the built-in default chain."""
    override = _csv("GEMINI_MODELS")
    return _dedupe(override) if override else list(DEFAULT_GEMINI_MODELS)


def xai_models() -> List[str]:
    """XAI_MODELS override, else the built-in default chain."""
    override = _csv("XAI_MODELS")
    return _dedupe(override) if override else list(DEFAULT_XAI_MODELS)


def xai_base_url() -> str:
    return (os.getenv("XAI_BASE_URL") or _DEFAULT_XAI_BASE_URL).rstrip("/")


# ---------------------------------------------------------------- diagnostics
def _ascii(text: str) -> str:
    """Keep log lines safe for cp1252 consoles/files (model text may hold emoji)."""
    return (text or "").encode("ascii", "replace").decode("ascii")


def _log_fallback(provider: str, model: str, reason: str) -> None:
    _LOG.warning("[LLM FALLBACK] %s %s failed: %s", provider, model, _ascii(reason))


def _log_success(provider: str, model: str) -> None:
    _LOG.info("[LLM] Success: %s %s", provider, model)


def _safe_text(response: httpx.Response, limit: int = 400) -> str:
    try:
        return (response.text or "")[:limit]
    except Exception:  # noqa: BLE001 - diagnostics must never raise
        return ""


def _looks_like_auth(text: str) -> bool:
    lowered = _ascii(text).lower()
    return any(hint in lowered for hint in _AUTH_HINTS)


def _classify(exc: BaseException) -> str:
    """Map any provider failure onto a short, secret-free reason string."""
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return "timeout"
    if isinstance(exc, httpx.ConnectError):
        return "connection error"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (400, 401, 403) and _looks_like_auth(_safe_text(exc.response)):
            return "auth failure (bad API key)"
        return _REASON_BY_STATUS.get(status, f"{status} http error")
    if isinstance(exc, UnicodeEncodeError):
        return "encoding error"

    status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(status, int) and status in _REASON_BY_STATUS:
        return _REASON_BY_STATUS[status]

    message = str(exc)
    if _looks_like_auth(message):
        return "auth failure (bad API key)"
    match = _STATUS_RE.search(message)
    if match:
        return _REASON_BY_STATUS[int(match.group(1))]
    lowered = message.lower()
    if "timeout" in lowered or "timed out" in lowered or "deadline" in lowered:
        return "timeout"
    if "quota" in lowered or "rate limit" in lowered or "resource_exhausted" in lowered:
        return "429 rate limit"

    return type(exc).__name__


def _attempt(fn: Callable[[], str], timeout: float) -> Tuple[Optional[str], Optional[str]]:
    """Run one model call under a hard deadline.

    Returns ``(text, None)`` on success or ``(None, reason)`` on failure. The
    call runs on its own ``daemon`` thread so a hung socket can never block the
    request: we abandon it and move to the next model instead.
    """
    box: Dict[str, object] = {}

    def target() -> None:
        try:
            box["text"] = fn()
        except BaseException as exc:  # noqa: BLE001 - any failure advances the chain
            box["reason"] = _classify(exc)

    worker = threading.Thread(target=target, daemon=True, name="llm-attempt")
    worker.start()
    worker.join(timeout)

    if worker.is_alive():
        return None, "timeout"
    if "reason" in box:
        return None, str(box["reason"])

    text = str(box.get("text") or "").strip()
    return (text, None) if text else (None, "empty response")


# ------------------------------------------------------------------ providers
def _gemini_attempt(model: str, prompt: str, timeout: float) -> str:
    key = _api_key("GEMINI_API_KEY")
    if key is None:
        raise RuntimeError("GEMINI_API_KEY not configured")
    from google import genai  # imported lazily so a missing SDK never breaks startup

    client = genai.Client(api_key=key)
    response = client.models.generate_content(model=model, contents=prompt)
    return (getattr(response, "text", None) or "").strip()


def _grok_attempt(model: str, prompt: str, timeout: float) -> str:
    key = _api_key("XAI_API_KEY")
    if key is None:
        raise RuntimeError("XAI_API_KEY not configured")
    response = httpx.post(
        f"{xai_base_url()}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 400,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    choices = (response.json() or {}).get("choices") or []
    if not choices:
        return ""
    return ((choices[0].get("message") or {}).get("content") or "").strip()


class _Provider:
    """One provider = an ordered model list plus a way to call any of them."""

    __slots__ = ("name", "source", "key_env", "models", "attempt")

    def __init__(
        self,
        name: str,
        source: str,
        key_env: str,
        models: Callable[[], List[str]],
        attempt: Callable[[str, str, float], str],
    ) -> None:
        self.name = name
        self.source = source
        self.key_env = key_env
        self.models = models
        self.attempt = attempt


# Append a new provider here and the chatbot picks it up with no other change.
_PROVIDERS: Tuple[_Provider, ...] = (
    _Provider("Gemini", "gemini", "GEMINI_API_KEY", gemini_models, _gemini_attempt),
    _Provider("Grok", "grok", "XAI_API_KEY", xai_models, _grok_attempt),
)


def provider_names() -> List[str]:
    return [provider.source for provider in _PROVIDERS]


# ------------------------------------------------------------------ the chain
def generate_llm_response(
    prompt: str,
    *,
    deadline: Optional[float] = None,
) -> Optional[Dict]:
    """Walk Gemini models, then Grok models, and stop at the first success.

    Returns ``{"reply": str, "source": "gemini"|"grok", "model": str}`` or
    ``None`` when every configured model failed - the caller then answers
    deterministically. Never raises.
    """
    if not (prompt or "").strip():
        return None

    budget = chain_budget() if deadline is None else deadline
    per_model = model_timeout()
    started = time.monotonic()

    for provider in _PROVIDERS:
        if _api_key(provider.key_env) is None:
            _log_fallback(provider.name, "-", f"{provider.key_env} not configured")
            continue

        for model in provider.models():
            remaining = budget - (time.monotonic() - started)
            if remaining <= 0.5:
                _log_fallback(provider.name, model, "chain budget exhausted")
                return None

            timeout = min(per_model, remaining)
            text, reason = _attempt(
                lambda m=model, t=timeout: provider.attempt(m, prompt, t), timeout
            )
            if text:
                _last_working[provider.source] = model
                _log_success(provider.name, model)
                return {"reply": text, "source": provider.source, "model": model}

            _log_fallback(provider.name, model, reason or "unknown failure")

    return None


# Backwards-compatible alias for earlier callers.
answer = generate_llm_response


# --------------------------------------------------------------- capability
def provider_status() -> Dict[str, bool]:
    """Availability per provider - True only when the probe got a real answer."""
    return {
        "gemini": bool(_probe["gemini"]),
        "grok": bool(_probe["grok"]),
    }


def configured() -> Dict[str, bool]:
    """Cheap pre-probe signal: a usable key is present."""
    return {provider.source: _api_key(provider.key_env) is not None for provider in _PROVIDERS}


def last_working_model(provider: str) -> Optional[str]:
    return _last_working.get(provider)


def health() -> Dict:
    """/health payload. Model names and counts only - never keys."""
    gemini, grok = gemini_models(), xai_models()
    return {
        "gemini_configured": _api_key("GEMINI_API_KEY") is not None,
        "grok_configured": _api_key("XAI_API_KEY") is not None,
        "gemini_models": gemini,
        "grok_models": grok,
        "gemini_model_count": len(gemini),
        "grok_model_count": len(grok),
        "gemini_available": bool(_probe["gemini"]),
        "grok_available": bool(_probe["grok"]),
        "gemini_last_ok": _last_working.get("gemini"),
        "grok_last_ok": _last_working.get("grok"),
    }


def _probe_provider(provider: _Provider) -> None:
    key = provider.source
    if _api_key(provider.key_env) is None:
        _probe[key] = False
        return
    _LOG.info("[LLM] Probing %s chain: %s", provider.name, ", ".join(provider.models()))
    per_model = model_timeout()
    for model in provider.models():
        text, reason = _attempt(
            lambda m=model: provider.attempt(m, "ping", per_model), per_model
        )
        if text:
            _probe[key] = True
            _last_working[key] = model
            _LOG.info("[LLM] Success: %s %s (probe)", provider.name, model)
            return
        _log_fallback(provider.name, model, reason or "unknown failure")
    _probe[key] = False


def probe() -> None:
    """One-shot capability check. Never raises; never blocks startup."""
    for provider in _PROVIDERS:
        try:
            _probe_provider(provider)
        except Exception:  # noqa: BLE001 - a probe must never take the server down
            _probe[provider.source] = False


def start_probe() -> None:
    threading.Thread(target=probe, daemon=True, name="llm-probe").start()
