"""Evidence reconstruction timeline and the source network graph."""

from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, HTTPException, Query

import news
import store

router = APIRouter(tags=["evidence"])

SOURCE_TYPE_MAP = {
    "CCTV": "cctv",
    "Citizen": "citizen",
    "News": "news",
    "Social": "social",
    "Official": "official",
}


@router.get("/evidence/{incident_id}")
def evidence(incident_id: str) -> Dict:
    incident = store.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    sources = store.get_sources(incident_id)
    cameras = sorted({s.get("label") for s in sources if s.get("source") == "CCTV"})
    return {
        "incident_id": incident_id,
        "incident": incident,
        "timeline": store.get_evidence(incident_id),
        "cameras": cameras,
        "sources": [
            {
                "id": s.get("id"),
                "source": s.get("source"),
                "label": s.get("label"),
                "status": s.get("status"),
                "timestamp": s.get("timestamp"),
            }
            for s in sources
        ],
        "metrics": {
            "density": incident.get("density"),
            "velocity": incident.get("velocity"),
            "confidence": incident.get("confidence"),
            "risk_score": incident.get("risk_score"),
        },
    }


@router.get("/sources/{incident_id}")
def source_graph(incident_id: str, live: bool = Query(default=False)) -> Dict:
    incident = store.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    sources = list(store.get_sources(incident_id))
    if live:
        # Optional live enrichment: attached as REPORTED news nodes.
        try:
            result = news.fetch_news(
                incident.get("location", ""), set(), incident.get("type", "")
            )
            known = {s.get("id") for s in sources}
            for item in result.get("items", []):
                if item["id"] not in known:
                    sources.append(item)
        except Exception:
            pass

    nodes = [
        {"id": incident_id, "label": incident.get("type", incident_id), "type": "incident"}
    ]
    edges = []
    for source in sources:
        node_type = SOURCE_TYPE_MAP.get(source.get("source"), "other")
        nodes.append(
            {
                "id": source["id"],
                "label": source.get("label", source["id"]),
                "type": node_type,
                "status": source.get("status"),
                "credibility": source.get("credibility"),
                "location": source.get("location"),
                "timestamp": source.get("timestamp"),
                "url": source.get("url"),
                "provider": source.get("provider"),
                "title": source.get("title"),
            }
        )
        edges.append(
            {
                "source": source["id"],
                "target": incident_id,
                "relation": source.get("status", "supports"),
                "weight": source.get("credibility", 0.5),
            }
        )

    return {"incident_id": incident_id, "nodes": nodes, "edges": edges}
