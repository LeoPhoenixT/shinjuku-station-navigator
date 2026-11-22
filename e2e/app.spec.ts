import { expect, test } from '@playwright/test';

const START_ID = 'gate:59da841748574ff1bdc9408b504e3b85';
const DESTINATION_ID = 'gate:a628691805db44e2b65d427271a8bc24';
const MULTI_FLOOR_START_ID = 'facility:phase7b:1.JR新宿駅改札/B1/JrSin_B1_Facility:a6544518cd5640398cfb2a58e8d47f8d';
const MULTI_FLOOR_DESTINATION_ID = 'connector:6e09f033cda0472cb754fef74c313d83:0';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Shinjuku multi-floor indoor map' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
});

test('plans a route and preserves it in a shareable URL', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'Desktop route-planner journey.');
  const start = page.getByRole('combobox', { name: 'Search start place' });
  const destination = page.getByRole('combobox', { name: 'Search destination place' });

  await start.fill('中央改札');
  await page.getByRole('option', { name: /Central Gate/ }).first().click();
  await destination.fill('Central West Gate');
  await page.getByRole('option', { name: /^Central West Gate\b/ }).click();
  await page.getByRole('button', { name: 'Show route' }).click();

  await expect(page).toHaveURL(/start=gate/);
  await expect(page).toHaveURL(/destination=gate/);
  await expect(page.getByRole('region', { name: /Central Gate.*Central West Gate/ })).toBeVisible();
});

test('restores route and profile state from the URL', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'Desktop URL-restoration journey.');
  const params = new URLSearchParams({
    start: START_ID,
    destination: DESTINATION_ID,
    profile: 'shortest',
  });
  await page.goto(`/?${params.toString()}`);

  await expect(page.getByRole('region', { name: /Central Gate.*Central West Gate/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Edit route' }).click();
  await expect(page.getByRole('combobox', { name: 'Search start place' })).toHaveValue(/Central Gate/);
  await expect(page.getByRole('combobox', { name: 'Search destination place' })).toHaveValue(/Central West Gate/);
  await expect(page.getByRole('combobox', { name: 'Route profile' })).toHaveValue('shortest');
});

test('projects floor transitions as an unbroken green screen-space route', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'Desktop multi-floor route rendering.');
  const params = new URLSearchParams({
    start: MULTI_FLOOR_START_ID,
    destination: MULTI_FLOOR_DESTINATION_ID,
    profile: 'shortest',
  });
  await page.goto(`/?${params.toString()}`);

  const transition = page.locator('.route-screen-transition-line');
  await expect(transition).toHaveAttribute('d', /M.+L/);
  await expect.poll(() => transition.evaluate((path) => (path as SVGPathElement).getTotalLength())).toBeGreaterThan(0);
  await expect(transition).toHaveCSS('stroke', 'rgb(34, 197, 94)');
  const marker = page.locator('.route-transition-marker');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS('transform', /matrix/);
  const map = page.getByRole('group', { name: 'Interactive station map' });
  const previousPath = await transition.getAttribute('d');
  await map.press('ArrowRight');
  await expect.poll(() => transition.getAttribute('d')).not.toBe(previousPath);
  await page.getByRole('button', { name: 'North-up view' }).click();
  await expect(marker).toBeVisible();
  await page.reload();
  await expect(marker).toBeVisible();
});

test('keeps primary map controls usable on a mobile viewport', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'Mobile control journey.');
  const planner = page.getByRole('region', { name: 'Route planner' });
  const planRoute = page.getByRole('button', { name: 'Plan a route' });
  await expect(planner.getByText('Shinjuku Station', { exact: true })).toBeVisible();
  await expect(planRoute).toBeVisible();
  const plannerBox = await planner.boundingBox();
  expect(plannerBox?.width).toBeLessThan(page.viewportSize()!.width - 20);

  await page.getByRole('button', { name: 'Map tools' }).click();
  await expect(page.getByRole('button', { name: 'North-up view' })).toBeVisible();
  for (const name of ['Fit route', 'Fit station', 'Zoom out', 'Zoom in']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await page.getByRole('button', { name: 'All floors' }).click();
  await expect(page.getByRole('radio', { name: 'Emphasize B1 floor' })).toBeVisible();
});

test('identifies floors in the overview and keeps gate detail tied to the emphasized floor', async ({ page, isMobile }) => {
  const landmarks = page.locator('.surface-landmark');
  await expect(landmarks).toHaveCount(3);
  await expect(page.getByText('East Exit Plaza', { exact: true })).toBeVisible();
  await expect(page.getByText('West Exit Plaza', { exact: true })).toBeVisible();
  await expect(page.getByText('Busta Shinjuku', { exact: true })).toBeVisible();
  await expect(page.locator('.place-label')).toHaveCount(0);
  await expect(page.locator('.gate-badge').first()).toHaveText('GT');
  const floorCallouts = page.locator('[data-map-floor]');
  await expect(floorCallouts).toHaveCount(8);
  for (const [floorId, code] of [['0', 'G'], ['B1', 'B1'], ['B2', 'B2']]) {
    const label = floorCallouts.and(page.locator(`[data-map-floor="${floorId}"]`));
    await expect(label).toHaveText(code);
    await expect(label).toBeInViewport();
  }

  await page.getByRole('radio', { name: 'Emphasize B1 floor' }).click();
  await expect(landmarks).toHaveCount(3);
  await expect(floorCallouts).toHaveText(['B1']);
  await expect(page.locator('.place-label')).toHaveCount(0);
  if (isMobile) {
    await page.getByRole('button', { name: 'Map tools' }).click();
  }
  for (let clicks = 0; clicks < 3; clicks += 1) await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.place-label').first()).toBeVisible();
  await expect(page.locator('[data-floor-id="B1"] .gate-badge')).toHaveCount(0);
  await expect(page.locator('[data-floor-id]:not([data-floor-id="B1"]) .place-label')).toHaveCount(0);
  await expect(page.locator('.gate-badge-context').first()).toBeVisible();

  await page.getByLabel('Map settings').click();
  const roads = page.getByRole('checkbox', { name: /Surface roads/ });
  await expect(roads).toBeChecked();
  await roads.uncheck();
  await expect(landmarks).toHaveCount(0);
  await roads.check();
  await expect(landmarks).toHaveCount(3);
});

test('keeps a tall desktop overview clear until the user zooms in', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tall desktop viewport.');
  await page.setViewportSize({ width: 1694, height: 1300 });
  await expect(page.getByText('East Exit Plaza', { exact: true })).toBeInViewport();
  await expect(page.locator('.place-label')).toHaveCount(0);
  const badges = page.locator('.gate-badge');
  await expect(badges.first()).toBeVisible();
  const gateCount = await badges.count();
  for (let clicks = 0; clicks < 3; clicks += 1) await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.place-label')).toHaveCount(gateCount);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.locator('.place-label')).toHaveCount(0);
  await expect(badges).toHaveCount(gateCount);
});

test('continues showing a route if the optional surface data is unavailable', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'Desktop route and layer retry.');
  const asset = '**/shinjuku-surface-context.json';
  await page.route(asset, (route) => route.fulfill({ status: 503 }));
  const params = new URLSearchParams({ start: START_ID, destination: DESTINATION_ID, profile: 'shortest' });
  const failedAsset = page.waitForResponse((response) => response.url().endsWith('shinjuku-surface-context.json') && response.status() === 503);
  await page.goto(`/?${params}`);
  await failedAsset;
  const directions = page.getByRole('region', { name: /Central Gate.*Central West Gate/ });
  await expect(directions).toBeVisible();
  await expect(page.locator('.surface-landmark')).toHaveCount(0);
  const routeUrl = page.url();

  await page.unroute(asset);
  await page.getByLabel('Map settings').click();
  const roads = page.getByRole('checkbox', { name: /Surface roads/ });
  await roads.uncheck();
  await roads.check();
  await expect(page.locator('.surface-landmark')).toHaveCount(3);
  await expect(directions).toBeVisible();
  await expect(page).toHaveURL(routeUrl);
});

test('finds destinations in either language on desktop and mobile', async ({ page }) => {
  const planRoute = page.getByRole('button', { name: 'Plan a route' });
  if (await planRoute.isVisible()) await planRoute.click();
  const start = page.getByRole('combobox', { name: 'Search start place' });
  await start.fill('中央改札');
  await expect(page.getByRole('option', { name: /Central Gate/ }).first()).toBeVisible();
  await start.fill('CENTRAL GATE');
  await expect(page.getByRole('option', { name: /Central Gate/ }).first()).toBeVisible();
  await start.fill('EV_K-10');
  const fallback = page.getByRole('option', { name: /EV_K-10/ }).first();
  await expect(fallback).toBeVisible();
  const fallbackBox = await fallback.boundingBox();
  const viewport = page.viewportSize();
  expect(fallbackBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(fallbackBox!.x + fallbackBox!.width).toBeLessThanOrEqual(viewport!.width);
});

test('allows selecting both endpoints and submitting on a short mobile screen', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'Short mobile route-planner journey.');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Plan a route' }).click();
  await page.getByRole('combobox', { name: 'Search start place' }).fill('中央改札');
  await page.getByRole('option', { name: /Central Gate/ }).first().click();
  await page.getByRole('combobox', { name: 'Search destination place' }).fill('Central West');
  await page.getByRole('option', { name: /^Central West Gate\b/ }).click();
  await page.getByRole('button', { name: 'Show route' }).click();
  await expect(page.getByRole('region', { name: /Central Gate.*Central West Gate/ })).toBeVisible();
});

test('keeps the keyboard-active search option visible', async ({ page }) => {
  const planRoute = page.getByRole('button', { name: 'Plan a route' });
  if (await planRoute.isVisible()) await planRoute.click();
  const start = page.getByRole('combobox', { name: 'Search start place' });
  await start.focus();
  for (let index = 0; index < 18; index += 1) await start.press('ArrowDown');
  const active = page.getByRole('listbox').getByRole('option', { selected: true });
  await expect(active).toBeInViewport({ ratio: 0.9 });
  await start.press('Enter');
  await expect(start).toHaveAttribute('aria-expanded', 'false');
});

test('switches the interface language and restores it after reload', async ({ page }) => {
  await expect(page).toHaveURL(/profile=shortest/);
  const originalUrl = page.url();
  if (test.info().project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Map tools' }).click();
  }
  await page.getByLabel('Map settings').click();
  await page.getByRole('radio', { name: '日本語' }).click();

  await expect(page.getByRole('region', { name: '新宿駅の多層屋内地図' })).toBeVisible();
  await expect(page.getByText('東口駅前広場', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '地図設定を閉じる' })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  expect(await page.locator('html').getAttribute('lang')).toBe('ja');

  await page.reload();
  await expect(page.getByRole('region', { name: '新宿駅の多層屋内地図' })).toBeVisible();
  expect(await page.locator('html').getAttribute('lang')).toBe('ja');
});

test('keeps an active route unchanged while localizing its directions', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'Desktop live-route localization journey.');
  const params = new URLSearchParams({
    start: START_ID,
    destination: DESTINATION_ID,
    profile: 'shortest',
  });
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByRole('region', { name: /Central Gate.*Central West Gate/ })).toBeVisible({ timeout: 30_000 });
  const routeUrl = page.url();

  await page.getByLabel('Map settings').click();
  await page.getByRole('radio', { name: '日本語' }).click();

  await expect(page.getByRole('region', { name: /中央改札から中央西改札まで/ })).toBeVisible();
  await expect(page.getByText(/歩行者ネットワークまで.*進みます/).first()).toBeVisible();
  expect(page.url()).toBe(routeUrl);
});
