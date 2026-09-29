const DEFAULTS = {
  frontend: 'https://www.samyao.me/',
  edgeApi: 'https://api.samyao.me/api/posts?page=1&limit=1',
  directOrigin:
    'https://bananaboom-api-242273127238.asia-east1.run.app/api/posts?page=1&limit=1'
};

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

function target(name, fallback) {
  return process.env[name] || fallback;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'orion-production-smoke/1.0',
        ...init.headers
      }
    });
    return { response, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkFrontend() {
  const url = target('SMOKE_FRONTEND_URL', DEFAULTS.frontend);
  const { response, durationMs } = await fetchWithTimeout(url);
  const body = await response.text();

  assert(response.status === 200, `frontend expected 200, got ${response.status}`);
  assert(
    response.headers.get('content-type')?.includes('text/html'),
    `frontend content-type is not HTML: ${response.headers.get('content-type') || 'missing'}`
  );
  assert(body.includes('<div id="root">'), 'frontend HTML is missing #root mount point');

  const csp = response.headers.get('content-security-policy');
  assert(csp, 'frontend Content-Security-Policy header is missing');
  assert(
    response.headers.get('x-content-type-options') === 'nosniff',
    'frontend X-Content-Type-Options is not nosniff'
  );

  return {
    name: 'frontend',
    ok: true,
    status: response.status,
    durationMs,
    finalUrl: response.url,
    csp: true
  };
}

async function checkEdgeApi() {
  const url = target('SMOKE_EDGE_API_URL', DEFAULTS.edgeApi);
  const { response, durationMs } = await fetchWithTimeout(url, {
    headers: { accept: 'application/json' }
  });
  const text = await response.text();

  assert(
    response.status === 200,
    `edge API expected 200, got ${response.status}: ${text.slice(0, 200)}`
  );

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('edge API did not return valid JSON');
  }

  assert(json && Array.isArray(json.data), 'edge API response is missing data[]');

  return {
    name: 'edge-api',
    ok: true,
    status: response.status,
    durationMs,
    items: json.data.length
  };
}

async function checkDirectOriginGuard() {
  const url = target('SMOKE_DIRECT_ORIGIN_URL', DEFAULTS.directOrigin);
  const { response, durationMs } = await fetchWithTimeout(url, {
    headers: { accept: 'application/json' }
  });
  const text = await response.text();

  assert(
    response.status === 403,
    `SECURITY REGRESSION: direct Cloud Run origin expected 403, got ${response.status}: ${text.slice(0, 200)}`
  );

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `SECURITY REGRESSION: direct-origin 403 body is not JSON: ${text.slice(0, 200)}`
    );
  }

  assert(
    json?.msg === 'Direct origin access is not allowed',
    `SECURITY REGRESSION: unexpected direct-origin denial body: ${text.slice(0, 200)}`
  );

  return {
    name: 'direct-origin-guard',
    ok: true,
    status: response.status,
    durationMs,
    guard: json.msg
  };
}

async function checkNoOriginLeak() {
  const url = target('SMOKE_FRONTEND_URL', DEFAULTS.frontend);
  const { response } = await fetchWithTimeout(url);
  const html = await response.text();
  const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);

  assert(scriptSources.length > 0, 'frontend HTML contains no script assets to inspect');

  const origin = new URL(response.url).origin;
  const findings = [];

  for (const src of scriptSources) {
    const assetUrl = new URL(src, origin).toString();
    const { response: assetResponse } = await fetchWithTimeout(assetUrl);
    if (!assetResponse.ok) {
      throw new Error(
        `failed to inspect frontend asset ${assetUrl}: HTTP ${assetResponse.status}`
      );
    }
    const source = await assetResponse.text();
    if (/https?:\/\/[^"'\s]+\.run\.app/i.test(source)) findings.push(assetUrl);
  }

  assert(
    findings.length === 0,
    `SECURITY REGRESSION: frontend bundle leaks direct Cloud Run origin in: ${findings.join(', ')}`
  );

  return {
    name: 'bundle-origin-leak',
    ok: true,
    inspectedAssets: scriptSources.length
  };
}

const checks = [
  ['frontend', checkFrontend],
  ['edge-api', checkEdgeApi],
  ['direct-origin-guard', checkDirectOriginGuard],
  ['bundle-origin-leak', checkNoOriginLeak]
];

const results = [];
let failed = false;

for (const [name, run] of checks) {
  try {
    const result = await run();
    results.push(result);
    console.log(`✅ ${name}: ${JSON.stringify(result)}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

console.log('\nProduction smoke summary');
console.log(JSON.stringify({ ok: !failed, checkedAt: new Date().toISOString(), results }, null, 2));

if (failed) process.exit(1);
