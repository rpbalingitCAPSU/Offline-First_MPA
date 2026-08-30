# MPA Monitor — Offline-First Edge AI App Plan

## Top-Level Overview

Build an **offline-first, Multi-Page Application (MPA)** that runs on an NVIDIA Jetson (or similar GPU-enabled edge device) inside a browser. The app enables marine rangers and scientists to monitor **fish biomass**, **hard coral cover**, and **carbon sequestration** across Marine Protected Areas (MPAs).

**Core approach:**
- Vanilla HTML/CSS/JS — no build tooling, runs directly on edge devices
- `sql.js` (SQLite via WASM) for fully offline local data storage
- Service Worker for offline caching and background sync to cloud
- A local **Python/FastAPI inference microservice** (separate process on the Jetson) handles AI detection from camera feeds; the frontend calls it via HTTP
- When connectivity is restored, queued data syncs to a configurable REST endpoint (IBM Cloud / Appwrite / Knack)
- Authentication via a login screen before any data is accessible

**Non-goals:**
- No server-side rendering
- No npm build pipeline (all dependencies loaded as self-hosted or CDN with offline fallback)
- No native mobile packaging (browser-based only)

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffolding & Directory Structure

**Intent:** Establish the file layout, static asset structure, and foundational HTML shell that all other sub-tasks build on. Sets the conventions for how pages link to each other in the MPA.

**Expected Outcomes:**
- Root directory has a clear, documented folder structure
- Each MPA page has its own HTML file
- Shared CSS, JS utilities, and vendor assets live in dedicated folders
- `README.md` explains how to run the app locally on the Jetson

**Todo List:**
1. Create `README.md` — explain the project, how to run the FastAPI service, and how to open the app in a browser
2. Create `index.html` — redirects unauthenticated users to `login.html`
3. Create the following page stubs (HTML files): `login.html`, `dashboard.html`, `survey.html`, `map.html`, `alerts.html`, `reports.html`
4. Create `css/` folder: `reset.css`, `theme.css` (dark/ocean theme), `components.css`
5. Create `js/` folder with module stubs: `auth.js`, `db.js`, `sync.js`, `inference.js`, `charts.js`, `map.js`, `alerts.js`, `reports.js`, `utils.js`
6. Create `vendor/` folder — placeholder for offline copies of Chart.js, Leaflet, jsPDF, sql.js
7. Create `service-worker.js` at root (stub)
8. Create `manifest.json` for PWA metadata
9. Create `.vscode/settings.json` with recommended extensions note

**Relevant Context:**
- Workspace is currently empty except `.vscode/settings.json`
- MPA means each page is a full HTML document — no client-side routing framework needed
- All JS should use ES modules (`type="module"`)

**Status:** [ ] pending

---

### Sub-Task 2 — Authentication Layer

**Intent:** Protect all app pages behind a login screen so only authorized rangers/scientists can access MPA data. Because the app runs offline, authentication must work without a network (local credential check with optional cloud verification when online).

**Expected Outcomes:**
- `login.html` shows a username/password form
- Credentials are checked against a local user store in SQLite
- On success, a session token is stored in `sessionStorage`
- All other pages redirect to `login.html` if no valid session exists
- Logout clears the session and redirects to `login.html`

**Todo List:**
1. In `db.js` — create a `users` table schema (id, username, password_hash, role, last_login)
2. In `auth.js` — implement `login(username, password)`, `logout()`, `requireAuth()`, `currentUser()`
3. Implement password hashing using the Web Crypto API (`SHA-256`)
4. Seed one default admin user (username: `admin`, password: `mpa2026`) on first DB initialization
5. Build the `login.html` UI — form with username/password, error message area, submit button
6. Add `requireAuth()` call at the top of each protected page's JS module
7. Add a logout button component to the shared nav bar

**Relevant Context:**
- No backend auth endpoint — fully local for offline support
- Web Crypto API is available in modern browsers and on Chromium-based Electron
- `sessionStorage` is cleared when the browser tab closes (appropriate for shared devices)

**Status:** [ ] pending

---

### Sub-Task 3 — Local Database (SQLite WASM via sql.js)

**Intent:** Establish the offline data store using `sql.js` (SQLite compiled to WASM). All survey observations, MPA sites, alerts, and user data persist locally. This is the single source of truth for the UI.

**Expected Outcomes:**
- `db.js` initializes `sql.js` and loads/persists a database binary to `localStorage` or `IndexedDB`
- All required tables exist with correct schemas
- CRUD helper functions are exported for each entity
- DB version/migration mechanism exists for schema updates

**Todo List:**
1. Download `sql-wasm.js` and `sql-wasm.wasm` from the sql.js release and place in `vendor/sqljs/`
2. In `db.js` — initialize the sql.js engine, load persisted DB from IndexedDB (or create new)
3. Implement `persistDB()` — serialize and save DB binary back to IndexedDB after writes
4. Define and create the following tables:
   - `users` (id, username, password_hash, role, last_login)
   - `mpa_sites` (id, name, lat, lng, area_km2, description, created_at)
   - `surveys` (id, site_id, surveyor_id, timestamp, method, notes, sync_status)
   - `fish_biomass` (id, survey_id, species, count, avg_weight_kg, total_biomass_kg, confidence, source)
   - `coral_cover` (id, survey_id, cover_percent, bleaching_percent, species_composition, confidence, source)
   - `carbon_seq` (id, survey_id, estimated_tons_per_year, methodology, notes)
   - `alerts` (id, site_id, type, severity, message, created_at, acknowledged)
   - `sync_queue` (id, table_name, record_id, operation, payload_json, created_at, retry_count)
5. Seed 3 sample MPA sites on first initialization
6. Export CRUD helpers: `insertSurvey`, `getSurveys`, `getSiteById`, `getRecentAlerts`, etc.

**Relevant Context:**
- `sql.js` runs entirely in the browser — no Node.js required at runtime
- DB must be re-persisted to IndexedDB after every write (no auto-persist)
- `sync_queue` table is the backbone for Sub-Task 6 (Background Sync)
- `source` field on `fish_biomass` and `coral_cover` distinguishes `"ai"` from `"manual"`

**Status:** [ ] pending

---

### Sub-Task 4 — AI Inference Integration (FastAPI Microservice Client)

**Intent:** Connect the frontend to the local Python/FastAPI inference microservice running on the Jetson. The microservice handles camera frame analysis; the frontend sends frames and receives structured detection results.

**Expected Outcomes:**
- `inference.js` module can POST a video frame (base64 or blob) to `http://localhost:8000/infer`
- Returns structured JSON: `{ fish_biomass, coral_cover_percent, confidence, bounding_boxes }`
- Graceful degradation when the microservice is unreachable (offline indicator)
- Results populate the survey form for human review/correction before saving

**Todo List:**
1. Create `inference.js` — `callInferenceAPI(imageData)` function that POSTs to `http://localhost:8000/infer`
2. Handle CORS (microservice must allow `localhost` origins — note in README)
3. Implement a `checkInferenceService()` health check call to `http://localhost:8000/health`
4. Show an "AI Service Offline" badge in the UI when the service is unreachable
5. In `survey.html` — add a camera capture section: webcam feed preview, "Capture Frame" button, "Analyse with AI" button
6. Wire AI results into the survey form fields (pre-populate `fish_biomass`, `coral_cover` fields with AI values, marked as `source: "ai"`)
7. Create a stub `inference_service/` folder with `main.py`, `requirements.txt`, and `README.md` explaining how to run the FastAPI service on the Jetson

**Relevant Context:**
- The FastAPI service is a **separate process** — not bundled into the frontend
- `inference_service/` is documentation/reference only; the AI models themselves are not provided in this plan
- The service stub should define the expected API contract (`/health`, `/infer` endpoints)

**Status:** [ ] pending

---

### Sub-Task 5 — Dashboard, Survey, and Data Entry Pages

**Intent:** Build the core UI pages where rangers enter survey data, view monitoring metrics, and correct AI-detected values.

**Expected Outcomes:**
- `dashboard.html` — shows KPI cards (total biomass, avg coral cover, carbon estimate, active alerts), recent surveys list, and sparkline charts
- `survey.html` — full survey entry form: site selector, date/time, method, camera capture + AI analysis, manual fields for fish biomass / coral cover / carbon, confidence ratings, save button
- All forms validate input before saving to SQLite

**Todo List:**
1. Build `dashboard.html`:
   - Nav bar with user name + logout
   - KPI cards: Total Fish Biomass (kg), Average Hard Coral Cover (%), Estimated Carbon Sequestration (tons/year), Active Alerts count
   - Recent Surveys table (last 10, with site name, date, surveyor)
   - Two chart placeholders (wired in Sub-Task 7)
   - "New Survey" button → `survey.html`
2. Build `survey.html`:
   - Site dropdown (populated from `mpa_sites` table)
   - Survey method radio: `Visual Census`, `AI-Assisted`, `Transect`
   - Camera preview section (wired to `inference.js`)
   - Fish Biomass fields: species, count, avg weight, calculated total, confidence slider
   - Hard Coral Cover fields: cover %, bleaching %, species notes, confidence slider
   - Carbon Sequestration fields: estimated tons/year, methodology, notes
   - Save button → writes to SQLite + adds to `sync_queue`
   - Cancel / Back button
3. Add shared `components/nav.html` snippet (or inline nav) to all pages
4. Implement client-side form validation in `utils.js`

**Relevant Context:**
- Carbon sequestration estimation formula: `estimated_tons_per_year = coral_cover_percent * area_km2 * 0.21` (a commonly used proxy; ranger can override)
- All saves must call `persistDB()` after inserting

**Status:** [ ] pending

---

### Sub-Task 6 — Service Worker, Offline Caching & Background Sync

**Intent:** Make the app fully available offline using a Service Worker that caches all static assets and queues data submissions for sync when connectivity returns.

**Expected Outcomes:**
- Service Worker (`service-worker.js`) caches all HTML, CSS, JS, and vendor files on install
- App loads fully when the device has no network
- When online, items in `sync_queue` are POSTed to the configured cloud endpoint
- Sync status is visible in the UI (pending count badge)
- `manifest.json` enables PWA install prompt

**Todo List:**
1. In `service-worker.js` — implement cache-first strategy for all static assets (cache name versioned)
2. Implement `install` event — pre-cache all app shell assets
3. Implement `activate` event — clean up old caches
4. Implement `fetch` event — serve from cache, fall back to network
5. Implement Background Sync registration in `sync.js` (`navigator.serviceWorker.ready.then(...)`)
6. Implement sync handler in `service-worker.js` — on `sync` event, read `sync_queue`, POST each record to `SYNC_ENDPOINT` (configurable constant), mark as synced, remove from queue
7. Implement `sync.js` — `queueForSync(tableName, recordId, operation, payload)`, `getSyncQueueCount()`, `getSyncStatus()`
8. Display sync queue count badge on dashboard nav
9. Complete `manifest.json` — name, short_name, icons, start_url, display, theme_color, background_color
10. Register service worker in each HTML page's `<script>` block

**Relevant Context:**
- Background Sync API requires the Service Worker to be registered and the device to be online when the sync fires
- `SYNC_ENDPOINT` should be a configurable constant in `sync.js` — default `http://localhost:8000/api/sync` for local testing, with a comment to change to cloud URL
- sql.js DB is in IndexedDB — the Service Worker cannot access it directly; sync payloads must be serialized to the `sync_queue` table as JSON strings by the main thread

**Status:** [ ] pending

---

### Sub-Task 7 — Charts and Data Visualization

**Intent:** Provide time-series charts and trend visualizations for fish biomass, hard coral cover, and carbon sequestration using Chart.js (bundled for offline use).

**Expected Outcomes:**
- Dashboard has a line chart showing biomass trend over time
- Dashboard has a bar chart showing coral cover % per site
- Dedicated visualization sections on `dashboard.html` for all three metrics
- Charts update dynamically from SQLite data on page load

**Todo List:**
1. Download Chart.js standalone build and place in `vendor/chartjs/chart.umd.min.js`
2. In `charts.js` — implement `renderBiomassTrend(canvasId, data)`, `renderCoralCoverBySite(canvasId, data)`, `renderCarbonTrend(canvasId, data)`
3. Query SQLite for chart data on dashboard load — last 30 days of surveys, grouped by site
4. Wire charts into `dashboard.html` canvas elements
5. Add a simple color scheme consistent with the ocean theme (blues, greens, coral orange for alerts)

**Relevant Context:**
- Chart.js must be loaded from `vendor/` not CDN to work fully offline
- Chart data comes from `db.js` query helpers

**Status:** [ ] pending

---

### Sub-Task 8 — Map Page (Leaflet.js with Offline Tiles)

**Intent:** Show MPA sites on an interactive map with site markers, survey count bubbles, and alert indicators. Offline tile support via cached tiles.

**Expected Outcomes:**
- `map.html` shows a Leaflet map centered on configured MPA region
- Each `mpa_site` is a marker with a popup showing name, area, last survey date, and current metrics
- Alert sites show a red indicator
- Tiles are cached in Service Worker for offline use (OpenStreetMap tiles pre-cached for the MPA region)

**Todo List:**
1. Download Leaflet.js and CSS, place in `vendor/leaflet/`
2. Build `map.html` with a full-screen map container
3. In `map.js` — initialize Leaflet map, load MPA sites from SQLite, place markers
4. Implement marker popup with site details + "New Survey" quick-link
5. Add tile caching strategy to `service-worker.js` — cache tile requests (stale-while-revalidate for tiles)
6. Add a map legend (biomass level, alert status)

**Relevant Context:**
- Default map center and zoom should be configurable constants in `map.js`
- Leaflet tiles use `{z}/{x}/{y}` URL pattern — tile caching in Service Worker intercepts `tile.openstreetmap.org` requests

**Status:** [ ] pending

---

### Sub-Task 9 — Alerts System

**Intent:** Automatically generate alerts when monitored metrics fall below configurable thresholds (e.g., coral cover drops below 20%, biomass below a site baseline), and allow rangers to acknowledge alerts.

**Expected Outcomes:**
- `alerts.html` lists all active and recent alerts with severity badges
- Alerts are auto-generated when a survey is saved and metrics breach thresholds
- Rangers can acknowledge/dismiss alerts
- Alert count badge shows on dashboard nav

**Todo List:**
1. Define alert thresholds as configurable constants in `alerts.js`:
   - `CORAL_COVER_CRITICAL = 20` (%)
   - `CORAL_COVER_WARNING = 35` (%)
   - `BIOMASS_CRITICAL_KG = 50`
   - `CARBON_SEQ_CRITICAL = 0.5` (tons/year)
2. In `alerts.js` — implement `checkAndGenerateAlerts(surveyId)` — called after each survey save
3. Build `alerts.html` — table of alerts with columns: site, type, severity, message, time, status
4. Implement acknowledge button — updates `acknowledged = 1` in SQLite
5. Show unacknowledged count badge on nav bar

**Relevant Context:**
- Alerts are stored in the `alerts` table (created in Sub-Task 3)
- `checkAndGenerateAlerts` should be called from the survey save handler in `survey.html`

**Status:** [ ] pending

---

### Sub-Task 10 — Reports & Export (CSV + PDF)

**Intent:** Allow rangers and scientists to export monitoring data as CSV for spreadsheet analysis or PDF reports for stakeholders.

**Expected Outcomes:**
- `reports.html` has a date-range filter and site selector
- Export to CSV downloads a flat file of all filtered surveys with all metrics
- Export to PDF generates a formatted report with site info, metrics table, and chart snapshots

**Todo List:**
1. Download jsPDF standalone build, place in `vendor/jspdf/jspdf.umd.min.js`
2. Build `reports.html` — filter form (site, date from/to, metric type) + Export CSV + Export PDF buttons
3. In `reports.js` — implement `exportCSV(filters)` using `Blob` + `URL.createObjectURL`
4. In `reports.js` — implement `exportPDF(filters)` using jsPDF — include report title, site info, metrics table, generation date
5. Add chart-to-image snapshot in PDF export using `Chart.js` `toBase64Image()`

**Relevant Context:**
- jsPDF must be loaded from `vendor/` for offline use
- CSV export uses browser's native download via `<a download>` element trick

**Status:** [ ] pending

---

## Architecture Reference

```
Offline-First_MPA/
├── index.html                  # Entry point — redirects to login or dashboard
├── login.html
├── dashboard.html
├── survey.html
├── map.html
├── alerts.html
├── reports.html
├── manifest.json
├── service-worker.js
├── css/
│   ├── reset.css
│   ├── theme.css
│   └── components.css
├── js/
│   ├── auth.js
│   ├── db.js
│   ├── sync.js
│   ├── inference.js
│   ├── charts.js
│   ├── map.js
│   ├── alerts.js
│   ├── reports.js
│   └── utils.js
├── vendor/
│   ├── sqljs/
│   ├── chartjs/
│   ├── leaflet/
│   └── jspdf/
├── inference_service/
│   ├── main.py
│   ├── requirements.txt
│   └── README.md
└── README.md
```

## Configuration Constants (to be set before deployment)

| Constant | File | Default | Description |
|---|---|---|---|
| `SYNC_ENDPOINT` | `sync.js` | `http://localhost:8000/api/sync` | Cloud REST endpoint for background sync |
| `INFERENCE_URL` | `inference.js` | `http://localhost:8000` | Local FastAPI service URL |
| `MAP_CENTER` | `map.js` | `[14.5994, 120.9842]` | Default map lat/lng |
| `DB_NAME` | `db.js` | `mpa_monitor_v1` | IndexedDB key for persisted SQLite DB |
