import { test, expect } from '@playwright/test';
import {
  joinRoom,
  startGame,
  findPlayerWithCard,
  waitForCurrentPlayer,
  selectCard,
  playSelected,
  pass,
  cleanup,
} from './helpers';

test.describe('Game start', () => {
  test('all players receive 13 cards', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    for (const player of session.players) {
      await expect(player.page.locator('#hand .card')).toHaveCount(13);
    }
    await cleanup(session);
  });

  test('start button disappears after game begins', async ({ browser }) => {
    const session = await joinRoom(browser, 2);
    await startGame(session);

    await expect(session.players[0].page.locator('#start-btn')).toBeHidden();
    await cleanup(session);
  });

  test('host cannot start with only 1 player', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');
    await page.fill('#create-name', 'Solo');
    await page.click('#create-btn');
    await page.waitForURL('**/game.html');
    await page.click('#start-btn');

    await expect(page.locator('#game-error')).toBeVisible();
    await context.close();
  });
});

test.describe('Turn enforcement', () => {
  test('only the player with 3♦ can act on the first turn', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    const others = session.players.filter((p) => p !== leader);

    // Leader's play button is enabled
    await expect(leader.page.locator('#play-btn')).toBeEnabled();

    // Everyone else is disabled
    for (const other of others) {
      await expect(other.page.locator('#play-btn')).toBeDisabled();
      await expect(other.page.locator('#pass-btn')).toBeDisabled();
    }
    await cleanup(session);
  });

  test('status bar shows the current player name on other screens', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    const spectator = session.players.find((p) => p !== leader)!;

    await expect(spectator.page.locator('#status-msg')).toContainText(leader.name);
    await cleanup(session);
  });
});

test.describe('First play rules', () => {
  test('first play must include 3♦ — other singles are rejected', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');

    // Pick any card that is NOT 3♦
    const otherCardId = await leader.page
      .locator('#hand .card:not([data-id="3D"])')
      .first()
      .getAttribute('data-id');

    await selectCard(leader, otherCardId!);
    await leader.page.click('#play-btn');

    await expect(leader.page.locator('#game-error')).toBeVisible();
    await expect(leader.page.locator('#game-error')).toContainText('3♦');
    await cleanup(session);
  });

  test('playing 3♦ as a single succeeds', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    await selectCard(leader, '3D');
    await playSelected(leader);

    await expect(leader.page.locator('#hand .card')).toHaveCount(12);
    await expect(leader.page.locator('#last-play-cards .card[data-id="3D"]')).toBeVisible();
    await cleanup(session);
  });

  test('cannot pass when leading a new trick', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    await expect(leader.page.locator('#pass-btn')).toBeDisabled();
    await cleanup(session);
  });
});

test.describe('Play validation', () => {
  test('playing wrong hand size is rejected', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    // Leader plays 3♦ as single
    const leader = await findPlayerWithCard(session.players, '3D');
    await selectCard(leader, '3D');
    await playSelected(leader);

    // Next player tries to play 2 cards when the trick is singles
    const next = await waitForCurrentPlayer(session.players);
    const cards = next.page.locator('#hand .card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await next.page.click('#play-btn');

    await expect(next.page.locator('#game-error')).toBeVisible();
    await expect(next.page.locator('#game-error')).toContainText('1 card');
    await cleanup(session);
  });
});

test.describe('Passing', () => {
  test('can pass after someone else has played', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    // Leader plays 3♦
    const leader = await findPlayerWithCard(session.players, '3D');
    await selectCard(leader, '3D');
    await playSelected(leader);

    // Next player passes
    const next = await waitForCurrentPlayer(session.players);
    await pass(next);

    // Next player still has 13 cards (didn't play anything)
    await expect(next.page.locator('#hand .card')).toHaveCount(13);
    await cleanup(session);
  });

  test('when all others pass the trick resets and leader plays again', async ({ browser }) => {
    const session = await joinRoom(browser, 2);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    const [other] = session.players.filter((p) => p !== leader);

    // Leader plays 3♦
    await selectCard(leader, '3D');
    await playSelected(leader);

    // Other player passes
    await pass(other);

    // Table should clear — new trick
    await expect(leader.page.locator('#last-play-label')).toContainText('No cards played yet');
    // Leader's pass button disabled again (leading)
    await expect(leader.page.locator('#pass-btn')).toBeDisabled();
    await cleanup(session);
  });
});

test.describe('Card count tracking', () => {
  test('opponents see the correct card count decrease after a play', async ({ browser }) => {
    const session = await joinRoom(browser, 4);
    await startGame(session);

    const leader = await findPlayerWithCard(session.players, '3D');
    const spectator = session.players.find((p) => p !== leader)!;

    const leaderChip = spectator.page.locator(
      `.player-chip:has-text("${leader.name}") .card-count`,
    );
    await expect(leaderChip).toContainText('13');

    await selectCard(leader, '3D');
    await playSelected(leader);

    await expect(leaderChip).toContainText('12');
    await cleanup(session);
  });
});
