"""Computer vision package: detection, video processing, risk scoring."""

# Load .env as early as possible so the CV layer sees its configuration no
# matter which module is imported first.
try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass

from cv import risk_engine  # noqa: E402,F401
