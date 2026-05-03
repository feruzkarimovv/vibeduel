import { test, expect, chromium } from '@playwright/test';

const PROD = 'https://vibeduel-peach.vercel.app';

test('prod: landing CTA renders', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(PROD);
  await expect(page.getByRole('button', { name: /ENTER THE ARENA/i })).toBeVisible({ timeout: 20000 });
  await browser.close();
});

test('prod: lobby renders with new private-duel button', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${PROD}/duel`);
  await expect(page.getByText('SELECT CHALLENGE', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /READY — FIND OPPONENT/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /CREATE PRIVATE DUEL/i })).toBeVisible();
  await browser.close();
});

test('prod: /me profile page renders', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${PROD}/me`);
  await expect(page.getByText('PROFILE', { exact: true })).toBeVisible({ timeout: 20000 });
  await browser.close();
});

test('prod: /auth page renders', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${PROD}/auth`);
  await expect(page.getByText(/SIGN IN/i).first()).toBeVisible({ timeout: 20000 });
  await browser.close();
});

test('prod: spectator route renders not-found gracefully for invalid id', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${PROD}/duel/00000000-0000-0000-0000-000000000000/watch`);
  await expect(page.getByText(/Duel Not Found/i)).toBeVisible({ timeout: 20000 });
  await browser.close();
});
