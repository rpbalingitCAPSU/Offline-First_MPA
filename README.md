# MPA Monitor — Offline-First Edge AI Application

An **offline-first, Multi-Page Application** that runs in a browser on an NVIDIA Jetson (or any GPU-enabled edge device). Enables marine rangers and scientists to monitor **fish biomass**, **hard coral cover**, and **carbon sequestration** across Marine Protected Areas (MPAs).

---

## Architecture Overview

```
Browser (Chromium on Jetson)
  └── HTML/CSS/JS (this repo, served via simple HTTP)
        ├── sql.js (SQLite via WASM) — local offline data store
        ├── Service Worker — offline caching + background sync
        └── inference.js — calls local FastAPI microservice

FastAPI Inference Service (separate process on Jetson)
  └── inference_service/main.py
        ├── /health  — liveness check
        └── /infer   — camera frame → fish biomass + coral cover detections
```

---

## Folder Structure

```
Offline-First_MPA/
├── index.html              # Entry point — redirects to login or dashboard
├── login.html
├── dashboard.html
├── survey.html
├── map.html
├── alerts.html
├── reports.html
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching + background sync
├── css/
│   ├── reset.css
│   ├── theme.css           # Dark ocean theme
│   └── components.css      # Nav, cards, buttons, tables, forms
├── js/
│   ├── auth.js             # Login / logout / session guard
│   ├── db.js               # sql.js init, table schemas, CRUD helpers
│   ├── sync.js             # Background sync queue management
│   ├── inference.js        # FastAPI microservice client
│   ├── charts.js           # Chart.js wrappers
│   ├── map.js              # Leaflet map initialisation
│   ├── alerts.js           # Alert generation and display
│   ├── reports.js          # CSV + PDF export
│   └── utils.js            # Shared utilities and form validation
├── vendor/
│   ├── sqljs/              # sql-wasm.js + sql-wasm.wasm (download separately)
│   ├── chartjs/            # chart.umd.min.js (download separately)
│   ├── leaflet/            # leaflet.js + leaflet.css (download separately)
│   └── jspdf/              # jspdf.umd.min.js (download separately)
├── inference_service/
│   ├── main.py             # FastAPI stub — /health + /infer endpoints
│   ├── requirements.txt
│   └── README.md           # Setup instructions for Jetson
└── README.md               # This file
```

---

## Prerequisites

- **NVIDIA Jetson** (Nano / Orin / AGX) or any Linux/Windows machine with a GPU
- Python 3.9+ with pip
- A Chromium-based browser (Chromium, Chrome, or Edge)
- A simple HTTP server (Python's built-in `http.server` works fine)

---

## 1. Run the FastAPI Inference Service

See [`inference_service/README.md`](inference_service/README.md) for full Jetson setup instructions.

**Quick start:**

```bash
cd inference_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:

```bash
curl http://localhost:8000/health
# {"status": "ok", "model_loaded": true}
```

> **CORS note:** The service allows `localhost` origins by default so the browser app can reach it. Change the `allow_origins` list in `main.py` if needed.

---

## 2. Download Vendor Libraries (offline bundles)

The app loads all libraries from `vendor/` — no CDN is used, so the app works fully offline.

| Library | Version | Download URL | Destination |
|---------|---------|-------------|-------------|
| sql.js  | 1.12.0  | https://github.com/sql-js/sql.js/releases | `vendor/sqljs/sql-wasm.js` + `sql-wasm.wasm` |
| Chart.js | 4.x    | https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js | `vendor/chartjs/chart.umd.min.js` |
| Leaflet | 1.9.x   | https://leafletjs.com/download.html | `vendor/leaflet/leaflet.js` + `leaflet.css` |
| jsPDF   | 2.5.x   | https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js | `vendor/jspdf/jspdf.umd.min.js` |

---

## 3. Serve the Frontend

From the repo root, start a simple HTTP server:

```bash
# Python 3
python -m http.server 3000

# Or Node (if available)
npx serve . -p 3000
```

Open Chromium on the Jetson and navigate to:

```
http://localhost:3000
```

You will be redirected to `login.html`. Default credentials (seeded on first launch):

- **Username:** `admin`
- **Password:** `mpa2026`

---

## 4. Configuration

Edit these constants before deployment:

| Constant | File | Default | Description |
|----------|------|---------|-------------|
| `SYNC_ENDPOINT` | `js/sync.js` | `http://localhost:8000/api/sync` | Cloud REST endpoint for background sync |
| `INFERENCE_URL` | `js/inference.js` | `http://localhost:8000` | Local FastAPI service base URL |
| `MAP_CENTER` | `js/map.js` | `[14.5994, 120.9842]` | Default map centre (lat, lng) |
| `DB_NAME` | `js/db.js` | `mpa_monitor_v1` | IndexedDB key for the persisted SQLite DB |

---

## Development Notes

- **No build step required.** All files are plain HTML/CSS/JS served directly.
- **ES Modules** — all JS files use `type="module"`. Browsers enforce CORS for modules, so you **must** use an HTTP server (not `file://`).
- **Service Worker** — registered by each HTML page. On first load it pre-caches all static assets. Subsequent loads work fully offline.
- **Data persistence** — sql.js keeps the SQLite database in IndexedDB under the key `mpa_monitor_v1`. Clearing site data in the browser will wipe all local records.

---

## Local Windows Deployment (this machine)

> **Tested & verified** — 55/55 pre-flight checks pass. Both servers confirmed live.

### Installed automatically by setup

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js LTS | v24.19.0 | Runs `serve` static file server |
| Python 3.12 | 3.12.10 | Runs FastAPI inference service |
| serve (npm) | global | Zero-config static HTTP server |
| FastAPI | 0.141.x | AI inference REST API |
| Uvicorn | 0.52.x | ASGI server for FastAPI |

### One-click launch (Windows)

Double-click **`start-app.bat`** — opens both servers and the browser automatically:

```
Frontend:   http://localhost:8080     (MPA Monitor app)
AI API:     http://localhost:8000     (FastAPI inference service)
API Docs:   http://localhost:8000/docs
Login:      admin / mpa2026
```

### Individual launchers

| Script | What it does |
|--------|-------------|
| `start-app.bat` | Starts everything + opens browser |
| `start-frontend.bat` | Frontend static server only (port 8080) |
| `start-inference.bat` | FastAPI AI service only (port 8000) |

### Pre-flight test

```powershell
# Run from project root — validates all 55 checks before launching
node test-preflight.mjs
```

---

## WSL2 / Linux VM Setup (Jetson-compatible environment)

Run once as Administrator to enable WSL2:

```
1. Right-click setup-wsl2.bat → Run as Administrator
2. Restart when prompted
3. Right-click post-restart-wsl2.bat → Run as Administrator
4. Open WSL terminal: wsl
5. Run: bash provision-ubuntu.sh
```

This installs Ubuntu 22.04 with:
- Python 3.12 + FastAPI + uvicorn + OpenCV + ONNX Runtime
- Node.js LTS + `serve`
- Symlink to the Windows project folder at `~/mpa-monitor`

Start from WSL:
```bash
bash ~/mpa-monitor/start-frontend-wsl.sh   # port 8080
bash ~/mpa-monitor/start-inference-wsl.sh  # port 8000
```

---

## IBM watsonx Assistant Setup

The chat widget is embedded on all pages. To activate:

1. Create an IBM watsonx Assistant instance at https://cloud.ibm.com
2. Copy your **Integration ID**, **Service Instance ID**, and **Region**
3. Edit [`js/watsonx.js`](js/watsonx.js):

```js
export const WATSONX_CONFIG = {
  integrationID:     'your-integration-id',
  region:            'us-south',
  serviceInstanceID: 'your-service-instance-id',
};
```

The assistant automatically receives live MPA context variables on each session open:
`total_fish_biomass_kg`, `avg_coral_cover_pct`, `total_carbon_seq_ty`, `active_alert_count`, `user_name`, `user_role`

When the device is fully offline, a graceful offline indicator replaces the chat button.

