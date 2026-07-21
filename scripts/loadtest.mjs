/* =====================================================================
 * Re:Verse — 의존성 없는 부하/레이턴시 측정 스크립트 (Node ESM)
 * ---------------------------------------------------------------------
 * 사용법:
 *   node scripts/loadtest.mjs <url> [concurrency=20] [total=300] [bearerToken]
 * 예:
 *   node scripts/loadtest.mjs https://reverse-growthlog.com/api/health/db 20 300
 *   node scripts/loadtest.mjs https://reverse-growthlog.com/api/verses/recommendations?emotion=joy 20 300 <JWT>
 *
 * 출력: RPS · 성공/에러 · p50/p90/p95/p99/max 레이턴시(ms) · 상태코드 분포.
 * ⚠ Gemini 손글씨(handwriting-check)는 비용/쿼터 때문에 대상에서 제외할 것.
 * ===================================================================== */
import http from 'node:http';
import https from 'node:https';

const url = process.argv[2];
const concurrency = Number(process.argv[3] || 20);
const total = Number(process.argv[4] || 300);
const token = process.argv[5];

if (!url) {
  console.error('usage: node scripts/loadtest.mjs <url> [concurrency] [total] [bearerToken]');
  process.exit(1);
}

const lib = url.startsWith('https') ? https : http;
const headers = token ? { Authorization: `Bearer ${token}` } : {};

function once() {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const req = lib.get(url, { headers }, (res) => {
      res.on('data', () => {}); // 바디 소비
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ ms, status: res.statusCode });
      });
    });
    req.on('error', (e) => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve({ ms, status: 0, error: e.code || e.message });
    });
    req.setTimeout(30000, () => { req.destroy(); resolve({ ms: 30000, status: 0, error: 'timeout' }); });
  });
}

const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

const results = [];
let launched = 0;

async function worker() {
  while (launched < total) {
    launched += 1;
    results.push(await once());
  }
}

const wallStart = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const wallMs = Date.now() - wallStart;

const lat = results.map((r) => r.ms).sort((a, b) => a - b);
const ok = results.filter((r) => r.status >= 200 && r.status < 400).length;
const byStatus = results.reduce((m, r) => { const k = r.error ? `ERR:${r.error}` : r.status; m[k] = (m[k] || 0) + 1; return m; }, {});
const mean = lat.reduce((a, b) => a + b, 0) / lat.length;

console.log(`\n=== ${url}`);
console.log(`동시성 ${concurrency} · 총 ${total}요청 · 벽시계 ${(wallMs / 1000).toFixed(2)}s · ${(total / (wallMs / 1000)).toFixed(1)} req/s`);
console.log(`성공 ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%) · 에러율 ${(((total - ok) / total) * 100).toFixed(1)}%`);
console.log(`레이턴시(ms): mean ${mean.toFixed(0)} · p50 ${pct(lat, 50).toFixed(0)} · p90 ${pct(lat, 90).toFixed(0)} · p95 ${pct(lat, 95).toFixed(0)} · p99 ${pct(lat, 99).toFixed(0)} · max ${lat[lat.length - 1].toFixed(0)}`);
console.log(`상태코드:`, byStatus);
