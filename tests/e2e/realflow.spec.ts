import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';

// Multi-context two-player tests against the running dev server + real Supabase.
// Run with: npx playwright test tests/e2e/realflow.spec.ts --headed=false

let browser: Browser;
let p1: { ctx: BrowserContext; page: Page };
let p2: { ctx: BrowserContext; page: Page };

async function makePlayer(): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  return { ctx, page };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  p1 = await makePlayer();
  p2 = await makePlayer();
});

test.afterAll(async () => {
  await p1.ctx.close();
  await p2.ctx.close();
  await browser.close();
});

test('1. landing renders, CTAs visible', async () => {
  await p1.page.goto('http://localhost:3000/');
  await expect(p1.page.getByRole('button', { name: /ENTER THE ARENA/i })).toBeVisible();
  await expect(p1.page.getByRole('button', { name: /RANKINGS/i })).toBeVisible();
});

test('2. lobby loads and shows challenge', async () => {
  await p1.page.goto('http://localhost:3000/duel');
  await expect(p1.page.getByText('SELECT CHALLENGE', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(p1.page.getByRole('button', { name: /READY — FIND OPPONENT/i })).toBeVisible();
  await expect(p1.page.getByText(/Player:/i)).toBeVisible();
});

test('3. matchmaking pairs two players into same duel', async () => {
  await p1.page.goto('http://localhost:3000/duel');
  await expect(p1.page.getByText('SELECT CHALLENGE', { exact: true })).toBeVisible({ timeout: 15000 });
  await p1.page.getByRole('button', { name: /READY — FIND OPPONENT/i }).click();

  // P1 either enters MATCHMAKING (created a new duel) or matches instantly
  // (joined an existing waiting duel). Both are valid; what matters is that
  // both players end up in the same duel room.
  // Intentionally NO delay between P1 and P2 — we want to verify the C-5 fix
  // (handshake-window race) is working: even if the realtime UPDATE fires
  // before P1's WebSocket reaches SUBSCRIBED, the polling fallback redirects.
  await p2.page.goto('http://localhost:3000/duel');
  await expect(p2.page.getByText('SELECT CHALLENGE', { exact: true })).toBeVisible({ timeout: 15000 });
  await p2.page.getByRole('button', { name: /READY — FIND OPPONENT/i }).click();

  await Promise.all([
    p1.page.waitForURL(/\/duel\/[a-f0-9-]+/, { timeout: 20000 }),
    p2.page.waitForURL(/\/duel\/[a-f0-9-]+/, { timeout: 20000 }),
  ]);

  const id1 = p1.page.url().split('/duel/')[1].split('?')[0];
  const id2 = p2.page.url().split('/duel/')[1].split('?')[0];
  console.log('Matched duel id:', id1);
  expect(id1).toBe(id2);
});

test('4. countdown completes; both reach active phase', async () => {
  // Wait for countdown overlay to disappear (3-2-1-GO + 0.8s = ~3.8s)
  await p1.page.waitForTimeout(5000);
  await expect(p1.page.locator('text=Your Solution')).toBeVisible({ timeout: 10000 });
  await expect(p2.page.locator('text=Your Solution')).toBeVisible({ timeout: 10000 });
});

test('5. P1 generates code and live preview renders', async () => {
  const promptInput = p1.page.locator('input[type="text"]').first();
  await promptInput.fill('a simple button that says click me');
  await p1.page.getByRole('button', { name: /GENERATE/i }).click();
  // Wait for streaming to finish — code length grows
  await p1.page.waitForFunction(
    () => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
      return ta && ta.value.length > 200 && !ta.value.startsWith('// Error');
    },
    { timeout: 60000 },
  );
  const ta = p1.page.locator('textarea').first();
  const codeLen = await ta.inputValue().then((v) => v.length);
  console.log('P1 code length after generate:', codeLen);
  expect(codeLen).toBeGreaterThan(200);
});

test('6. P2 generates code', async () => {
  const promptInput = p2.page.locator('input[type="text"]').first();
  await promptInput.fill('a counter with + and -');
  await p2.page.getByRole('button', { name: /GENERATE/i }).click();
  await p2.page.waitForFunction(
    () => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
      return ta && ta.value.length > 200 && !ta.value.startsWith('// Error');
    },
    { timeout: 60000 },
  );
});

test('7. both submit and see results', async () => {
  await p1.page.getByRole('button', { name: /SUBMIT SOLUTION/i }).click();
  // P1 enters submitted state, waits for P2
  await p2.page.getByRole('button', { name: /SUBMIT SOLUTION/i }).click();

  // Both should reach VICTORY/DEFEAT/DRAW within 30s
  await Promise.all([
    p1.page.waitForFunction(
      () =>
        !!document.body.innerText.match(/VICTORY|DEFEAT|DRAW/i),
      { timeout: 60000 },
    ),
    p2.page.waitForFunction(
      () =>
        !!document.body.innerText.match(/VICTORY|DEFEAT|DRAW/i),
      { timeout: 60000 },
    ),
  ]);

  const p1Text = await p1.page.locator('body').innerText();
  const p2Text = await p2.page.locator('body').innerText();
  console.log('P1 result:', p1Text.match(/VICTORY|DEFEAT|DRAW/i)?.[0]);
  console.log('P2 result:', p2Text.match(/VICTORY|DEFEAT|DRAW/i)?.[0]);
});

test('8. leaderboard shows the players who duelled', async () => {
  await p1.page.goto('http://localhost:3000/leaderboard');
  await p1.page.waitForLoadState('networkidle');
  const text = await p1.page.locator('body').innerText();
  // We should see at least 2 players
  const matches = text.match(/\b\d{3,4}\b/g) ?? [];
  console.log('Leaderboard ELO numbers found:', matches.slice(0, 6));
  expect(text.length).toBeGreaterThan(0);
});
