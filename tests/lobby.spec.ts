import { test, expect } from '@playwright/test';
import { joinRoom, cleanup } from './helpers';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

test.describe('Lobby', () => {
  test('host can create a room and gets a room code', async ({ page }) => {
    await page.goto('/');
    await page.fill('#create-name', 'Alice');
    await page.click('#create-btn');

    await page.waitForURL('**/game.html');
    const code = await page.locator('#room-code-display').textContent();
    expect(code).toMatch(/Room:\s*[A-Z0-9]{4}/);
  });

  test('player can join with a valid room code', async ({ browser }) => {
    const session = await joinRoom(browser, 2);
    const guest = session.players[1];

    await expect(guest.page.locator('#room-code-display')).toContainText(session.code);
    await cleanup(session);
  });

  test('joining with an invalid code shows an error', async ({ page }) => {
    await page.goto('/');
    await page.fill('#join-name', 'Alice');
    await page.fill('#join-code', 'ZZZZ');
    await page.click('#join-btn');

    await expect(page.locator('#lobby-error')).toBeVisible();
    await expect(page.locator('#lobby-error')).toContainText('not found');
  });

  test('cannot join without a name', async ({ page }) => {
    await page.goto('/');
    await page.fill('#join-code', 'AB12');
    await page.click('#join-btn');

    await expect(page.locator('#lobby-error')).toBeVisible();
  });

  test('room shows correct player count as players join', async ({ browser }) => {
    const session = await joinRoom(browser, 3);
    const host = session.players[0];

    // Host's lobby should show 3 player chips
    const chips = host.page.locator('.player-chip');
    await expect(chips).toHaveCount(3);
    await cleanup(session);
  });

  test('only host sees the Start button', async ({ browser }) => {
    const session = await joinRoom(browser, 2);
    const [host, guest] = session.players;

    await expect(host.page.locator('#start-btn')).toBeVisible();
    await expect(guest.page.locator('#start-btn')).toBeHidden();
    await cleanup(session);
  });

  test('cannot join a full room (5th player gets error)', async ({ browser }) => {
    const session = await joinRoom(browser, 4);

    // 5th player tries to join
    const extra = await browser.newContext({ baseURL: BASE_URL });
    const extraPage = await extra.newPage();
    await extraPage.goto('/');
    await extraPage.fill('#join-name', 'Extra');
    await extraPage.fill('#join-code', session.code);
    await extraPage.click('#join-btn');

    await expect(extraPage.locator('#lobby-error')).toBeVisible();
    await expect(extraPage.locator('#lobby-error')).toContainText('full');

    await extra.close();
    await cleanup(session);
  });
});
