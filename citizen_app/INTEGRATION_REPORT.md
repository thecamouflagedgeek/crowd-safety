# Citizen App + FastAPI Backend Integration — Final Report

Branch: **hazel**
Backend (live): http://localhost:8000 — **ALIVE** at report time (uvicorn on 0.0.0.0:8000)
Flutter SDK on PATH in this environment: **no** (integration validated by contract + live curl, not by `flutter run`)

---

## 1. Files changed inside citizen_app/

- `lib/services/api_service.dart` — centralized API client; base URL default `http://10.0.2.2:8000`; wraps `/incidents` and `/advisories` list responses; verify/chat/route contracts updated; 6s timeout; try-real→controlled-mock fallback.
- `lib/services/mock_service.dart` — demo fallback rewritten to mirror backend response shapes (incidents, advisories, verify, chat, route). Clearly internal/demo-only; never mixed with real responses.
- `lib/models/incident.dart` — new 17-param constructor matching backend incident schema; `fromJson` reads `latitude/longitude/confidence/severity/density/velocity/status/risk_score/factors/guidance/explanation/live`; derives `movement` from velocity; adds `displayDistance` (client-side haversine, Andheri ref) and `displayMinutes` when backend provides no distance; keeps `summary`/`action` local derivations.
- `lib/screens/home_screen.dart` — sorts incidents by `displayDistance`; card distance text uses `displayDistance`/`displayMinutes`.
- `lib/screens/incident_screen.dart` — shows `riskScore`, `live` CCTV pill, `displayDistance`; density stat uses rounded model value; guidance card shows backend `guidance` when present.
- `lib/screens/verify_screen.dart` — fully rewritten to render backend `/verify` fields: `status` (VERIFIED/UNDER_VALIDATION/UNVERIFIED), `confidence` bar, `severity`, `impact`, `supporting_sources` list, `corroborating_news` count, `incident_id` chip; derives location from claim text to help backend match.
- `lib/screens/guidance_screen.dart` — rewritten to render backend `/route` fields: `route` list as nodes, `recommended`, `reason`, `destination`, `severity`, `distance_m`/`duration_s` (OSRM when available), `routing_engine`; "Ask AI" keeps incident context.
- `lib/screens/advisory_screen.dart` — rewritten to render backend `/advisories` fields: `message`, `severity` (color-coded), `issued_by`, `timestamp`, `location`, `id`; polls every 10s.
- `lib/widgets/incident_card.dart` — distance/min text uses `displayDistance`/`displayMinutes`.

No changes to: `admin_web/`, `backend/`, `main.dart`, `theme.dart`, `bottom_nav.dart`, `map_view.dart`, `risk_badge.dart`, `login_screen.dart` (except none — login untouched).

## 2. API endpoints integrated (citizen app)

- GET  /incidents          → Home map + Explore list + Incident cards
- GET  /incidents/{id}     → (incident detail screen receives a full Incident from the list; the detail screen currently uses the list item. The backend detail endpoint is wired-ready: `Incident.fromJson` handles the detail shape identically. The current UI opens detail from the list item, which is fine and avoids a second network call.)
- POST /verify             → VerifyScreen (claim + optional location)
- POST /chat               → ChatSheet from Incident detail + Guidance screen (message + incident_id context)
- POST /route              → GuidanceScreen (incident_id)
- GET  /advisories         → AdvisoryScreen (polling 10s)

Endpoints available but not wired to a citizen UI action (by design — no citizen screen needs them): GET /health, GET /cameras, GET /evidence/{id}, GET /sources/{id}, POST /validation, GET /news, GET /videos/{file}. /chat is wired; the backend also sends `incident_id` context when the UI supplies it (it does).

## 3. Base URL used

Default: **`http://10.0.2.2:8000`** (set in `Api.base` via `String.fromEnvironment('API', defaultValue: ...)`).

- On Android emulator: backend must be running on the host at port 8000. The emulator reaches the host via `10.0.2.2`, so the default works out of the box.
- Override with: `flutter run --dart-define=API=http://<host-ip>:8000`
- Force demo/mock (offline preview): `flutter run --dart-define=API=` (empty → mock path).
- No API keys in Flutter. Gemini/SerpApi/NewsAPI keys stay server-side in backend/.env.

## 4. Android emulator tested: NO (environment limitation)

The workspace has no Flutter SDK on PATH and no Android emulator available in this session, so `flutter run` could not be executed here. The integration was validated by:

- Reading the live backend source + running every integrated endpoint via curl against the live backend (incidents, incident detail, verify, chat, route, advisories) and confirming exact JSON shapes.
- Aligning every Flutter field access to those shapes.
- Confirming the backend is live and healthy (`/health` → cv=yolo, gemini=true, serpapi=true, newsapi=true).

**To complete the emulator test on your machine**, run the backend on the host and then from `citizen_app/`:

```
flutter pub get
flutter analyze
flutter run -d <emulator-id>
```

The default base URL already targets `10.0.2.2:8000`, so no extra flags are needed if the backend is on the host at port 8000.

## 5. Per-feature pass/fail

| Feature | Status | Notes |
|---|---|---|
| Home / incidents | **PASS (contract)** | Maps `GET /incidents → {"incidents":[]}`; markers/cards use backend id/type/location/lat/lon/severity/confidence/density/movement(dist. from velocity)/live. Distance shown is client-side haversine where backend is silent. |
| Incident details | **PASS (contract)** | Shows severity badge, confidence, crowd density/area impact, movement (velocity-derived), risk score, live pill, backend guidance. |
| Verification | **PASS (contract)** | Renders backend `status/confidence/severity/impact/supporting_sources/corroborating_news`. Live test: claim "Gate 3 is completely closed." → UNVERIFIED, 28%, "Insufficient supporting evidence", no supporting sources, 5 REPORTED news items consulted. Claim without "closed" → VERIFIED, 94%, supporting sources listed. |
| Chat | **PASS (contract)** | Sends message + incident_id; renders `reply` (+shows source/model when gemini responds). Live test: "Is Gate 3 safe?" with INC001 → gemini reply recommending avoiding Gate 3 and using Road B to Gate 5. |
| Route | **PASS (contract)** | Renders backend `route[]/recommended/reason/destination/severity/distance_m/duration_s/routing_engine`. Live test INC001 → recommended=true, route [Current Location, Road B, Gate 5], OSRM 1.2km/1.8min. |
| Advisories | **PASS (contract)** | GET /advisories → {"advisories":[]}; polls every 10s; renders message/severity/issued_by/timestamp/location/id. Live test → ADV001 "Severe congestion near Gate 3…", HIGH, Event Authority, 18:23. A newly POSTed advisory would appear on next poll. |
| Mock fallback | **PASS (design)** | Controlled demo fallback mirrors backend shapes; used only when backend unreachable or API=empty; never interleaved with real responses. |

## 6. Golden citizen flow (design intent)

LOGIN → LOCATION (map asks GPS via geolocator; falls back to Andheri) → HOME MAP (live incidents from /incidents) → NEARBY INCIDENT (INC001 Gate 3, HIGH) → OPEN INCIDENT (severity, confidence, density, movement, live, guidance) → ASK "Is this area safe?" via Chat (sends incident_id INC001) → GET SAFE ROUTE (POST /route INC001 → alternate via Road B/Gate 5) → SUBMIT CLAIM "Gate 3 is completely closed." → VERIFY (UNVERIFIED, 28%, no supporting sources, news consulted) → OPEN ALERTS (AdvisoryScreen, ADV001). All steps now map to real backend endpoints.

## 7. Remaining integration issues / notes

1. **Emulator run not executed here.** Validate with `flutter run` on an Android emulator on your machine; backend must be on host:8000. If the app is launched from a different host/network, pass `--dart-define=API=http://<host-ip>:8000`.
2. **Incident detail screen opens from the list item, not from a fresh `/incidents/{id}` call.** This is fine for the demo and avoids a redundant call; `Incident.fromJson` already handles the detail shape (which additionally includes `claims`/`advisories` arrays that the UI currently ignores). If you want the detail screen to refresh from `/incidents/{id}` on open, that is a small addition on top of the current wiring.
3. **Client-side distance.** Backend does not return `distance`. The app computes haversine km from a fixed Andheri reference when backend distance is 0, and labels it as a local estimate (the model/method comments state this). It is not presented as backend data.
4. **News is REPORTED-only.** The verify screen shows corroborating news count with an explicit "REPORTED only — not proof on their own" note, matching the backend contract. The frontend does not treat news as proof.
5. **Verify location hint.** VerifyScreen derives a location string from the claim text (Gate 3 / Gate 5 / Marine Drive Junction / CSMT Platform 4) and sends it to `/verify` to improve backend matching. For arbitrary claims it sends no location, and the backend falls back to seeded-claim matching.
6. **Unused field cleaned.** Removed an unused `lastClaim` field from VerifyScreen.
7. **`backend/backend_uvicorn.log` is untracked** (uvicorn stdout). It is not committed. We should restart the backend if this session resumes, since the log is from this session's start.

## 8. Scope adherence

- Only `citizen_app/lib/` files changed.
- No admin_web changes.
- No backend business-logic changes, no endpoint renames, no new backend endpoints, no keys in Flutter, no second verification/routing engine, no redesign, no hardcoded incidents in UI (backend-provided), no fabricated verification results (backend fields rendered), no scraping from Flutter.
