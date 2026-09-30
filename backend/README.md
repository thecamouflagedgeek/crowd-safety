# Public Safety CV Backend

FastAPI backend + OpenCV/YOLO pipeline for **PS 06 — Real-Time Computer Vision for Public Safety**.
Single source of truth shared by the Flutter citizen app and the React authority dashboard.

```
CCTV/video -> OpenCV capture -> YOLO person detection -> density/motion/velocity
   -> risk & severity engine -> incident -> multi-source verification
   -> evidence timeline -> authority validation -> advisory -> citizen app
```

## Install

```bash
cd backend
pip install -r requirements.txt
```

`ultralytics` ships with `torch`. The first run auto-downloads `yolo26n.pt` (~5 MB)
into `backend/`; after that it loads from disk. No training is performed.

## Run

```bash
cd backend
python main.py
# or
uvicorn main:app --reload --port 8000
```

Docs: http://localhost:8000/docs   Health: http://localhost:8000/health

## Computer vision

* **Primary detector: YOLO** (`ultralytics`, model `yolo26n.pt`), person class only.
  Detection runs on a downscaled frame at `CV_PROCESS_FPS` per camera.
* **Fail-safe chain:** YOLO -> OpenCV HOG people detector -> MOG2 blob counting.
  If `ultralytics` is missing, the weights cannot load, or a frame fails, the
  pipeline degrades automatically and the server still starts.
* **Motion/velocity:** per-frame absolute difference + foreground-centroid shift
  (EMA-smoothed), normalised against the observed free-flow maximum.
* **Background model:** MOG2 warmed on the sparse opening frames, then frozen so a
  slow-moving crowd is not absorbed into the background.
* **Multi-camera:** `camera_01` and `camera_02` run in independent threads and
  both publish into **INC001**; the store averages density and takes the max
  motion across cameras, so camera 02 "confirms" camera 01.
* **Demo footage:** if `videos/camera_0*.mp4` are missing they are generated once
  with OpenCV by compositing alpha-matted real-person sprites (from the
  Ultralytics sample `bus.jpg`) over a gate/plaza scene, so YOLO gets real
  targets. Drop in real CCTV clips with the same names to use them instead.

## Environment (`.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Chat. Blank/invalid -> deterministic fallback. | `YOUR_KEY` |
| `SERPAPI_KEY` | Google News corroboration (SerpApi). | empty |
| `NEWS_API_KEY` | NewsAPI.org corroboration. | empty |
| `NEWS_WINDOW_HOURS`, `NEWS_MAX_RESULTS`, `NEWS_COUNTRY`, `NEWS_LANG` | News tuning | `72`, `5`, `in`, `en` |
| `NEWS_TIMEOUT_SECONDS` | Hard budget for concurrent news fetch | `6` |
| `OSRM_BASE_URL`, `ROUTING_ENABLED` | Routing; unreachable -> fallback | public OSRM / `1` |
| `CV_USE_YOLO` | `1` YOLO primary, `0` force HOG/MOG2 | `1` |
| `YOLO_MODEL` | Model id/path | `yolo26n.pt` |
| `CV_PROCESS_FPS`, `CV_LOOP_VIDEO`, `CV_START_AT` | Pipeline tuning | `8`, `1`, `0.55` |

Keys are read only on the server and never sent to the apps.

## Risk engine

```
risk = 0.35*density + 0.25*motion_anomaly + 0.20*persistence + 0.20*citizen_support
LOW <0.40 | MEDIUM <0.60 | HIGH <0.80 | CRITICAL >=0.80
```

Every incident response includes the contributing `factors` and an explanation.

## Verification and news

`POST /verify` compares a claim against seeded CCTV / citizen / official / news /
social records plus optional **live** public-safety news. Live news is always
`status: REPORTED` and:

* is only listed as corroboration when the claim is **already** supported, and
  only when the article actually names the place (`locality_match`), and
* can **never** turn a claim into `VERIFIED` on its own.

Searches are location-anchored and topic-restricted (protest, rally, crowd,
stampede, accident, traffic diversion, road closure, fire, evacuation, police
advisory, ...). They are triggered by a claim/incident, never run as a feed.
Results are cached 10 minutes and fetched concurrently under a hard time budget.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | API / CV / Gemini / SerpApi / NewsAPI status |
| GET | `/incidents`, `/incidents/{id}` | Incidents (live CV severity) |
| GET | `/cameras` | Camera config + live YOLO metrics + zone + timestamp |
| POST | `/verify` | Multi-source verification (+ corroborating news) |
| GET | `/evidence/{id}` | Evidence timeline + references |
| GET | `/sources/{id}?live=true` | Source graph (optionally + live news) |
| POST | `/validation` | Authority claim/source validation |
| POST | `/advisories`, GET `/advisories` | Advisory publish / retrieve |
| POST | `/chat` | Contextual chat (Gemini or fallback) |
| POST | `/route` | Safe route (OSRM or fallback) |
| GET | `/news` | Incident/location public-safety news |
| GET | `/videos/{file}` | Static camera video |

## Quick checks

```bash
curl http://localhost:8000/health
curl http://localhost:8000/incidents
curl -X POST http://localhost:8000/verify -H "Content-Type: application/json" \
  -d '{"claim":"Heavy crowd congestion near Gate 3.","location":"Gate 3"}'
curl http://localhost:8000/evidence/INC001
curl "http://localhost:8000/news?incident_id=INC001"
curl -X POST http://localhost:8000/chat -H "Content-Type: application/json" \
  -d '{"message":"Is Gate 3 safe?","incident_id":"INC001"}'
curl -X POST http://localhost:8000/route -H "Content-Type: application/json" \
  -d '{"incident_id":"INC001","user_lat":19.070,"user_lon":72.870}'
curl http://localhost:8000/advisories
```
