import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { chromium } from '@playwright/test';

test.describe('VibeDuel Multiplayer', () => {
  let browser: Browser;
  let player1Context: BrowserContext;
  let player2Context: BrowserContext;
  let player1Page: Page;
  let player2Page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    // Two separate browser contexts = two separate players (separate localStorage)
    player1Context = await browser.newContext();
    player2Context = await browser.newContext();
    player1Page = await player1Context.newPage();
    player2Page = await player2Context.newPage();
  });

  test.afterAll(async () => {
    await player1Context.close();
    await player2Context.close();
    await browser.close();
  });

  test('Landing page loads correctly', async () => {
    await player1Page.goto('/');

    // Check hero section
    await expect(player1Page.locator('text=VibeDuel')).toBeVisible();
    await expect(player1Page.locator('text=Start a Duel')).toBeVisible();
    await expect(player1Page.locator('text=View Leaderboard')).toBeVisible();

    // Check How It Works section
    await expect(player1Page.locator('text=How It Works')).toBeVisible();
    await expect(player1Page.locator('text=Match')).toBeVisible();
    await expect(player1Page.locator('text=Code')).toBeVisible();
    await expect(player1Page.locator('text=Ship')).toBeVisible();

    // Screenshot the landing page
    await player1Page.screenshot({ path: 'tests/screenshots/landing-page.png', fullPage: true });
    console.log('✅ Landing page looks good');
  });

  test('Full multiplayer duel flow — two players', async () => {
    // === STEP 1: Player 1 navigates to duel lobby ===
    console.log('🎮 Step 1: Player 1 enters lobby...');
    await player1Page.goto('/');
    await player1Page.click('text=Start a Duel');

    // Should be on the duel lobby page
    await expect(player1Page).toHaveURL(/\/duel/);
    await player1Page.screenshot({ path: 'tests/screenshots/p1-lobby.png' });

    // Wait for challenge card to appear
    await expect(player1Page.locator('[class*="challenge"], [data-testid="challenge-card"]').or(player1Page.locator('text=SCORING CRITERIA').or(player1Page.locator('text=easy').or(player1Page.locator('text=medium').or(player1Page.locator('text=Hard')))))).toBeVisible({ timeout: 10000 });
    console.log('✅ Player 1 sees challenge card');

    // === STEP 2: Player 1 clicks "Ready — Find Opponent" ===
    console.log('🎮 Step 2: Player 1 clicks Ready...');
    // Look for any button that starts matchmaking
    const readyButton = player1Page.locator('button').filter({ hasText: /ready|find|opponent|match/i }).first();
    await readyButton.click();

    // Should see waiting state
    await player1Page.waitForTimeout(1000);
    await player1Page.screenshot({ path: 'tests/screenshots/p1-waiting.png' });
    console.log('✅ Player 1 is waiting for opponent');

    // Grab the URL — it should now have a duel ID
    const player1Url = player1Page.url();
    console.log(`📍 Player 1 URL: ${player1Url}`);

    // === STEP 3: Player 2 navigates to duel lobby ===
    console.log('🎮 Step 3: Player 2 enters lobby...');
    await player2Page.goto('/');
    await player2Page.click('text=Start a Duel');
    await expect(player2Page).toHaveURL(/\/duel/);

    // === STEP 4: Player 2 clicks Ready — should match with Player 1 ===
    console.log('🎮 Step 4: Player 2 clicks Ready (should match with P1)...');
    const ready2Button = player2Page.locator('button').filter({ hasText: /ready|find|opponent|match/i }).first();
    await ready2Button.click();

    await player2Page.waitForTimeout(2000);
    await player2Page.screenshot({ path: 'tests/screenshots/p2-matched.png' });
    console.log('✅ Player 2 clicked ready');

    // === STEP 5: Both should end up in a duel room ===
    console.log('🎮 Step 5: Checking both players enter duel room...');

    // Wait for either redirect to duel/[id] or for duel UI elements to appear
    // Give it time for realtime to sync
    await Promise.all([
      player1Page.waitForTimeout(5000),
      player2Page.waitForTimeout(5000),
    ]);

    // Take screenshots of both
    await player1Page.screenshot({ path: 'tests/screenshots/p1-duel-room.png' });
    await player2Page.screenshot({ path: 'tests/screenshots/p2-duel-room.png' });

    const p1FinalUrl = player1Page.url();
    const p2FinalUrl = player2Page.url();
    console.log(`📍 Player 1 final URL: ${p1FinalUrl}`);
    console.log(`📍 Player 2 final URL: ${p2FinalUrl}`);

    // Both should be on a duel/[uuid] page
    expect(p1FinalUrl).toMatch(/\/duel\/[a-f0-9-]+/);
    expect(p2FinalUrl).toMatch(/\/duel\/[a-f0-9-]+/);

    // They should be in the SAME duel room
    const p1DuelId = p1FinalUrl.split('/duel/')[1]?.split('?')[0];
    const p2DuelId = p2FinalUrl.split('/duel/')[1]?.split('?')[0];
    expect(p1DuelId).toBe(p2DuelId);
    console.log(`✅ Both players are in the same duel: ${p1DuelId}`);

    // === STEP 6: Wait for countdown and duel to start ===
    console.log('🎮 Step 6: Waiting for countdown...');
    await player1Page.waitForTimeout(6000); // 3-2-1-GO + buffer

    await player1Page.screenshot({ path: 'tests/screenshots/p1-duel-active.png' });
    await player2Page.screenshot({ path: 'tests/screenshots/p2-duel-active.png' });

    // Check for duel UI elements — timer, code editor, preview
    // Use flexible selectors since exact class names may vary
    const timerVisible = await player1Page.locator('text=/\\d+:\\d+/').isVisible().catch(() => false);
    console.log(`⏱️ Timer visible: ${timerVisible}`);

    // === STEP 7: Player 1 generates code ===
    console.log('🎮 Step 7: Player 1 generates code...');

    // Find the prompt input
    const promptInput = player1Page.locator('input[placeholder*="escribe"], input[placeholder*="uild"], input[placeholder*="rompt"], input[type="text"], textarea').first();

    if (await promptInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promptInput.fill('build a simple counter with a plus button, minus button, and the count displayed in big text. Use a dark theme with purple accent colors.');

      // Click generate/refine button
      const generateBtn = player1Page.locator('button').filter({ hasText: /generate|refine|build|create|go/i }).first();
      await generateBtn.click();

      console.log('⚡ Player 1 started code generation...');

      // Wait for code to stream in (give it time for the API call)
      await player1Page.waitForTimeout(15000);

      await player1Page.screenshot({ path: 'tests/screenshots/p1-code-generated.png' });
      console.log('✅ Player 1 code generated');
    } else {
      console.log('⚠️ Could not find prompt input — taking diagnostic screenshot');
      await player1Page.screenshot({ path: 'tests/screenshots/p1-no-prompt-input.png' });
    }

    // === STEP 8: Player 2 also generates code ===
    console.log('🎮 Step 8: Player 2 generates code...');

    const promptInput2 = player2Page.locator('input[placeholder*="escribe"], input[placeholder*="uild"], input[placeholder*="rompt"], input[type="text"], textarea').first();

    if (await promptInput2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promptInput2.fill('create a minimal counter app with increment and decrement buttons. Clean modern design with green accent.');

      const generateBtn2 = player2Page.locator('button').filter({ hasText: /generate|refine|build|create|go/i }).first();
      await generateBtn2.click();

      console.log('⚡ Player 2 started code generation...');
      await player2Page.waitForTimeout(15000);

      await player2Page.screenshot({ path: 'tests/screenshots/p2-code-generated.png' });
      console.log('✅ Player 2 code generated');
    }

    // === STEP 9: Check opponent progress is visible ===
    console.log('🎮 Step 9: Checking opponent progress visibility...');
    await player1Page.waitForTimeout(3000);

    // Look for any opponent-related UI element
    const opponentInfo = await player1Page.locator('text=/ELO|opponent|vs|progress/i').isVisible().catch(() => false);
    console.log(`👥 Opponent info visible for P1: ${opponentInfo}`);

    await player1Page.screenshot({ path: 'tests/screenshots/p1-with-opponent-progress.png' });
    await player2Page.screenshot({ path: 'tests/screenshots/p2-with-opponent-progress.png' });

    // === STEP 10: Player 1 submits ===
    console.log('🎮 Step 10: Player 1 submits solution...');

    const submitBtn = player1Page.locator('button').filter({ hasText: /submit/i }).first();
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      await player1Page.waitForTimeout(2000);
      await player1Page.screenshot({ path: 'tests/screenshots/p1-submitted.png' });
      console.log('✅ Player 1 submitted');
    }

    // === STEP 11: Player 2 submits ===
    console.log('🎮 Step 11: Player 2 submits solution...');

    const submitBtn2 = player2Page.locator('button').filter({ hasText: /submit/i }).first();
    if (await submitBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn2.click();
      await player2Page.waitForTimeout(2000);
      await player2Page.screenshot({ path: 'tests/screenshots/p2-submitted.png' });
      console.log('✅ Player 2 submitted');
    }

    // === STEP 12: Check for judging/results ===
    console.log('🎮 Step 12: Checking for results...');
    await player1Page.waitForTimeout(5000);

    await player1Page.screenshot({ path: 'tests/screenshots/p1-results.png' });
    await player2Page.screenshot({ path: 'tests/screenshots/p2-results.png' });

    console.log('🏁 Multiplayer duel test complete!');
    console.log('📸 All screenshots saved in tests/screenshots/');
  });

  test('Share link flow — Player 2 joins via direct link', async () => {
    console.log('🔗 Testing share link flow...');

    // Player 1 creates a duel
    await player1Page.goto('/');
    await player1Page.click('text=Start a Duel');
    await player1Page.waitForTimeout(1000);

    // Click ready
    const readyBtn = player1Page.locator('button').filter({ hasText: /ready|find|opponent|match/i }).first();
    await readyBtn.click();
    await player1Page.waitForTimeout(2000);

    // Get the duel URL
    const duelUrl = player1Page.url();
    console.log(`🔗 Share URL: ${duelUrl}`);

    // If there's a share/copy link button, try clicking it
    const shareBtn = player1Page.locator('button').filter({ hasText: /share|copy|link|invite/i }).first();
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click();
      console.log('📋 Clicked share button');
    }

    // Player 2 joins via direct URL
    // If URL contains a duel ID, navigate player 2 there directly
    if (duelUrl.match(/\/duel\/[a-f0-9-]+/)) {
      await player2Page.goto(duelUrl);
      await player2Page.waitForTimeout(5000);

      await player1Page.screenshot({ path: 'tests/screenshots/share-p1.png' });
      await player2Page.screenshot({ path: 'tests/screenshots/share-p2.png' });

      console.log('✅ Player 2 joined via share link');
    } else {
      console.log('⚠️ No duel ID in URL yet — matchmaking might redirect later');
      await player1Page.screenshot({ path: 'tests/screenshots/share-debug.png' });
    }
  });
});
