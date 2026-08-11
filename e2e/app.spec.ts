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
  await expect(page.locator('.route-transition-marker')).toHaveCSS('transform', /matrix/);
});

test('keeps primary map controls usable on a mobile viewport', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'Mobile control journey.');
  const planner = page.getByRole('region', { name: 'Route planner' });
  const editRoute = page.getByRole('button', { name: 'Edit route' });
  const plannerBox = await planner.boundingBox();
  const editRouteBox = await editRoute.boundingBox();
  expect(plannerBox).not.toBeNull();
  expect(editRouteBox).not.toBeNull();
  expect(plannerBox!.width).toBeLessThanOrEqual(editRouteBox!.width + 20);

  await page.getByRole('button', { name: 'Map tools' }).click();
  await expect(page.getByRole('button', { name: 'North-up view' })).toBeVisible();
  await page.getByRole('button', { name: 'All floors' }).click();
  await expect(page.getByRole('radio', { name: 'Emphasize B1 floor' })).toBeVisible();
});

test('finds destinations in either language on desktop and mobile', async ({ page }) => {
  const editRoute = page.getByRole('button', { name: 'Edit route' });
  if (await editRoute.isVisible()) await editRoute.click();
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

test('switches the interface language and restores it after reload', async ({ page }) => {
  await expect(page).toHaveURL(/profile=shortest/);
  const originalUrl = page.url();
  if (test.info().project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Map tools' }).click();
  }
  await page.getByLabel('Map settings').click();
  await page.getByRole('radio', { name: '日本語' }).click();

  await expect(page.getByRole('region', { name: '新宿駅の多層屋内地図' })).toBeVisible();
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
