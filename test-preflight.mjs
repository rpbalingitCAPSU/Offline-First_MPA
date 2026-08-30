#!/usr/bin/env node
/**
 * test-preflight.mjs — MPA Monitor Pre-flight Test Suite
 * Validates that all required files exist and are structurally correct
 * before launching the app. Runs entirely offline.
 *
 * Usage:  node test-preflight.mjs
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;

let passed = 0;
let failed = 0;
const results = [];

function pass(label) {
  passed++;
  results.push({ ok: true, label });
}

function fail(label, reason) {
  failed++;
  results.push({ ok: false, label, reason });
}

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) fail(label, 'returned false');
    else pass(label);
  } catch (err) {
    fail(label, err.message);
  }
}

// ── 1. Critical HTML pages ────────────────────────────────────────────────────
const htmlPages = [
  'index.html', 'login.html', 'dashboard.html', 'survey.html',
  'map.html', 'alerts.html', 'reports.html',
];
htmlPages.forEach(f => {
  check(`HTML: ${f} exists`, () => {
    if (!existsSync(join(root, f))) throw new Error('File not found');
    return statSync(join(root, f)).size > 200;
  });
});

// ── 2. JS modules ─────────────────────────────────────────────────────────────
const jsModules = [
  'js/auth.js', 'js/db.js', 'js/sync.js', 'js/inference.js',
  'js/charts.js', 'js/map.js', 'js/alerts.js', 'js/reports.js',
  'js/utils.js', 'js/watsonx.js',
];
jsModules.forEach(f => {
  check(`JS: ${f} exists and has exports`, () => {
    const content = readFileSync(join(root, f), 'utf8');
    if (!content.includes('export')) throw new Error('No exports found');
    if (content.includes('TODO (Sub-Task')) throw new Error('Unimplemented TODO stub found');
    return true;
  });
});

// ── 3. CSS files ──────────────────────────────────────────────────────────────
['css/reset.css', 'css/theme.css', 'css/components.css'].forEach(f => {
  check(`CSS: ${f} exists`, () => existsSync(join(root, f)) || (() => { throw new Error('Not found'); })());
});

// ── 4. Vendor libraries (offline-critical) ────────────────────────────────────
const vendors = [
  { f: 'vendor/sqljs/sql-wasm.js',         minKB: 40  },
  { f: 'vendor/sqljs/sql-wasm.wasm',        minKB: 500 },
  { f: 'vendor/chartjs/chart.umd.min.js',   minKB: 150 },
  { f: 'vendor/leaflet/leaflet.js',         minKB: 100 },
  { f: 'vendor/leaflet/leaflet.css',        minKB: 10  },
  { f: 'vendor/jspdf/jspdf.umd.min.js',    minKB: 300 },
];
vendors.forEach(({ f, minKB }) => {
  check(`Vendor: ${f} (≥${minKB} KB)`, () => {
    const p = join(root, f);
    if (!existsSync(p)) throw new Error('File not found');
    const kb = statSync(p).size / 1024;
    if (kb < minKB) throw new Error(`Too small: ${kb.toFixed(0)} KB (expected ≥${minKB} KB)`);
    return true;
  });
});

// ── 5. Service Worker ─────────────────────────────────────────────────────────
check('service-worker.js: install event', () => {
  const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  return sw.includes("addEventListener('install'") && sw.includes('APP_SHELL');
});
check('service-worker.js: fetch cache-first', () => {
  const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  return sw.includes("addEventListener('fetch'") && sw.includes('caches.match');
});
check('service-worker.js: background sync', () => {
  const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  return sw.includes("addEventListener('sync'") && sw.includes('TRIGGER_SYNC');
});
check('service-worker.js: IBM CDN bypass', () => {
  const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  return sw.includes('watson.appdomain.cloud');
});

// ── 6. Manifest ───────────────────────────────────────────────────────────────
check('manifest.json: valid PWA manifest', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  if (!manifest.name)       throw new Error('Missing name');
  if (!manifest.start_url)  throw new Error('Missing start_url');
  if (!manifest.display)    throw new Error('Missing display');
  return true;
});

// ── 7. Every HTML page has SW registration ────────────────────────────────────
htmlPages.forEach(f => {
  check(`SW reg: ${f}`, () => {
    const html = readFileSync(join(root, f), 'utf8');
    if (!html.includes('service-worker.js')) throw new Error('Missing SW registration script');
    return true;
  });
});

// ── 8. Auth guard on all protected pages ─────────────────────────────────────
const protectedPages = ['dashboard.html', 'survey.html', 'map.html', 'alerts.html', 'reports.html'];
protectedPages.forEach(f => {
  check(`Auth guard: ${f}`, () => {
    const html = readFileSync(join(root, f), 'utf8');
    if (!html.includes('requireAuth')) throw new Error('Missing requireAuth() call');
    return true;
  });
});

// ── 9. watsonx integration ────────────────────────────────────────────────────
check('watsonx: js/watsonx.js exports initWatsonxChat', () => {
  const src = readFileSync(join(root, 'js/watsonx.js'), 'utf8');
  return src.includes('export function initWatsonxChat');
});
protectedPages.forEach(f => {
  check(`watsonx: ${f} imports initWatsonxChat`, () => {
    const html = readFileSync(join(root, f), 'utf8');
    if (!html.includes('initWatsonxChat')) throw new Error('Missing initWatsonxChat import/call');
    return true;
  });
});

// ── 10. Inference service ─────────────────────────────────────────────────────
check('inference_service/main.py: /health endpoint', () => {
  const py = readFileSync(join(root, 'inference_service/main.py'), 'utf8');
  return py.includes('/health') && py.includes('/infer');
});
check('inference_service/requirements.txt: fastapi listed', () => {
  const req = readFileSync(join(root, 'inference_service/requirements.txt'), 'utf8');
  return req.includes('fastapi') && req.includes('uvicorn');
});

// ── 11. DB schema completeness ────────────────────────────────────────────────
const requiredTables = ['users','mpa_sites','surveys','fish_biomass','coral_cover','carbon_seq','alerts','sync_queue'];
check('db.js: all 8 tables defined', () => {
  const db = readFileSync(join(root, 'js/db.js'), 'utf8');
  requiredTables.forEach(t => {
    if (!db.includes(`CREATE TABLE IF NOT EXISTS ${t}`)) throw new Error(`Missing table: ${t}`);
  });
  return true;
});

// ── 12. Launcher scripts ──────────────────────────────────────────────────────
['start-app.bat', 'start-inference.bat', 'start-frontend.bat'].forEach(f => {
  check(`Launcher: ${f} exists`, () => existsSync(join(root, f)) || (() => { throw new Error('Not found'); })());
});

// ── Print Report ──────────────────────────────────────────────────────────────
const width = 70;
console.log('\n' + '═'.repeat(width));
console.log('  MPA Monitor — Pre-flight Test Report');
console.log('═'.repeat(width));

results.forEach(r => {
  const icon   = r.ok ? '  ✓' : '  ✗';
  const status = r.ok ? 'PASS' : 'FAIL';
  const line   = `${icon}  ${status}  ${r.label}`;
  console.log(r.ok ? line : `${line}\n       → ${r.reason}`);
});

console.log('═'.repeat(width));
console.log(`  Passed: ${passed}   Failed: ${failed}   Total: ${passed + failed}`);
console.log('═'.repeat(width));

if (failed > 0) {
  console.log('\n  ⚠  Some checks failed. Fix the issues above before deploying.\n');
  process.exit(1);
} else {
  console.log('\n  ✓  All checks passed. App is ready to run.\n');
  console.log('  Start with:  start-app.bat  (Windows)');
  console.log('          or:  bash start-frontend-wsl.sh  (WSL2)\n');
  process.exit(0);
}
