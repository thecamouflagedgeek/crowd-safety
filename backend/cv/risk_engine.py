"""Deterministic, explainable risk / severity engine.

risk_score = 0.35 * density
           + 0.25 * motion_anomaly
           + 0.20 * persistence
           + 0.20 * citizen_reports

Thresholds are demo thresholds only.
"""

from __future__ import annotations

from typing import Dict, List

WEIGHTS: Dict[str, float] = {
    "density": 0.35,
    "motion_anomaly": 0.25,
    "persistence": 0.20,
    "citizen_reports": 0.20,
}

# (upper_bound_exclusive, severity)
THRESHOLDS = [
    (0.40, "LOW"),
    (0.60, "MEDIUM"),
    (0.80, "HIGH"),
    (1.01, "CRITICAL"),
]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    try:
        value = float(value)
    except (TypeError, ValueError):
        return low
    if value != value:  # NaN
        return low
    return max(low, min(high, value))


def severity_for_score(score: float) -> str:
    score = _clamp(score)
    for bound, name in THRESHOLDS:
        if score < bound:
            return name
    return "CRITICAL"


def compute_risk(
    density_score: float,
    motion_anomaly_score: float,
    persistence_score: float,
    report_score: float,
) -> Dict:
    """Combine normalized (0..1) signals into an explainable risk result."""

    factors = {
        "density": round(_clamp(density_score), 3),
        "motion_anomaly": round(_clamp(motion_anomaly_score), 3),
        "persistence": round(_clamp(persistence_score), 3),
        "citizen_reports": round(_clamp(report_score), 3),
    }

    score = sum(WEIGHTS[key] * factors[key] for key in WEIGHTS)
    score = round(_clamp(score), 3)

    contributions: List[Dict] = sorted(
        (
            {
                "signal": key,
                "value": factors[key],
                "weight": WEIGHTS[key],
                "contribution": round(WEIGHTS[key] * factors[key], 3),
            }
            for key in WEIGHTS
        ),
        key=lambda item: item["contribution"],
        reverse=True,
    )

    return {
        "severity": severity_for_score(score),
        "risk_score": score,
        "factors": factors,
        "contributions": contributions,
        "explanation": explain(factors, score),
    }


def explain(factors: Dict[str, float], score: float) -> str:
    """Human-readable, signal-based explanation (no invented facts)."""
    drivers = sorted(factors.items(), key=lambda kv: kv[1] * WEIGHTS[kv[0]], reverse=True)
    top = [name for name, _ in drivers[:2]]
    readable = {
        "density": "increasing crowd density",
        "motion_anomaly": "reduced/abnormal movement",
        "persistence": "sustained anomaly over time",
        "citizen_reports": "citizen reports",
    }
    reasons = " and ".join(readable[name] for name in top)
    return f"{severity_for_score(score)} risk score {round(score, 2)} driven mainly by {reasons}."
