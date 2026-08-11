const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const RETRY_COUNT = 20;
const RETRY_DELAY_MS = 500;

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

async function waitForResponse(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not reach ${url}`);
}

function requireHeader(response: Response, name: string, expected: RegExp): void {
  const value = response.headers.get(name);
  if (!value || !expected.test(value)) {
    throw new Error(`Expected ${name} to match ${expected}, received ${value ?? 'no header'}`);
  }
}

export async function verifyContainer(baseUrl = DEFAULT_BASE_URL): Promise<void> {
  const normalized = normalizedBaseUrl(baseUrl);
  const health = await waitForResponse(`${normalized}/healthz`);
  if ((await health.text()).trim() !== 'ok') throw new Error('Container health response was not "ok".');

  const app = await waitForResponse(`${normalized}/a/deep/spa/path`);
  const html = await app.text();
  if (!html.includes('<div id="root"></div>')) throw new Error('SPA fallback did not return the application shell.');
  requireHeader(app, 'content-security-policy', /default-src 'none'/);
  requireHeader(app, 'x-content-type-options', /^nosniff$/);
  requireHeader(app, 'x-frame-options', /^DENY$/);
  requireHeader(app, 'referrer-policy', /^strict-origin-when-cross-origin$/);
  requireHeader(app, 'strict-transport-security', /^max-age=31536000$/);

  const data = await waitForResponse(`${normalized}/data/processed/shinjuku-full-map.json`);
  requireHeader(data, 'content-type', /application\/json/);
  const dataset = await data.json() as { schemaVersion?: unknown; features?: unknown[] };
  if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.features) || dataset.features.length === 0) {
    throw new Error('The container did not serve the expected processed map dataset.');
  }

  const rawData = await fetch(`${normalized}/shapefile/`);
  if (rawData.status !== 200) {
    console.log(`Container verification passed for ${normalized}.`);
    return;
  }
  throw new Error('Raw shapefile paths must not be published by the container.');
}

if (process.argv[1]?.endsWith('verify-container.js')) {
  verifyContainer(process.argv[2]).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
