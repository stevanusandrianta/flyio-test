import { Browser, BrowserContext, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

export interface Player {
  page: Page;
  context: BrowserContext;
  name: string;
}

export interface GameSession {
  players: Player[];
  code: string;
}

/** Create a room with `count` players joined. Does NOT start the game. */
export async function joinRoom(browser: Browser, count: 2 | 3 | 4 = 4): Promise<GameSession> {
  const names = ['Alice', 'Bob', 'Carol', 'Dan'].slice(0, count);

  // Each player gets an isolated browser context (separate sessionStorage/cookies)
  const players: Player[] = await Promise.all(
    names.map(async (name) => {
      const context = await browser.newContext({ baseURL: BASE_URL });
      const page = await context.newPage();
      return { page, context, name };
    }),
  );

  // Host creates room
  const host = players[0];
  await host.page.goto('/');
  await host.page.fill('#create-name', host.name);
  await host.page.click('#create-btn');
  await host.page.waitForURL('**/game.html');

  const codeText = await host.page.locator('#room-code-display').textContent();
  const code = codeText!.replace('Room:', '').trim();

  // Others join sequentially so the lobby counter is predictable
  for (const player of players.slice(1)) {
    await player.page.goto('/');
    await player.page.fill('#join-name', player.name);
    await player.page.fill('#join-code', code);
    await player.page.click('#join-btn');
    await player.page.waitForURL('**/game.html');
  }

  return { players, code };
}

/** Start the game and wait for all players to receive their cards. */
export async function startGame(session: GameSession): Promise<void> {
  const host = session.players[0];
  await host.page.click('#start-btn');
  const minCards = Math.floor(52 / session.players.length);
  await Promise.all(
    session.players.map((p) =>
      p.page.waitForFunction(
        (min) => document.querySelectorAll('#hand .card').length >= min,
        minCards,
      ),
    ),
  );
}

/** Find which player holds a specific card (by card id, e.g. "3D"). */
export async function findPlayerWithCard(players: Player[], cardId: string): Promise<Player> {
  for (const player of players) {
    const count = await player.page.locator(`#hand .card[data-id="${cardId}"]`).count();
    if (count > 0) return player;
  }
  throw new Error(`No player holds card ${cardId}`);
}

/** Wait for a player's turn indicator to be active, then return that player. */
export async function waitForCurrentPlayer(players: Player[]): Promise<Player> {
  // The current player has #play-btn enabled
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const player of players) {
      const disabled = await player.page.locator('#play-btn').isDisabled();
      if (!disabled) return player;
    }
    await players[0].page.waitForTimeout(200);
  }
  throw new Error('No player became active within timeout');
}

/** Click a card in a player's hand to select/deselect it. */
export async function selectCard(player: Player, cardId: string): Promise<void> {
  await player.page.locator(`#hand .card[data-id="${cardId}"]`).click();
}

/** Play the currently selected cards. */
export async function playSelected(player: Player): Promise<void> {
  await player.page.click('#play-btn');
}

/** Pass the current turn. */
export async function pass(player: Player): Promise<void> {
  await player.page.click('#pass-btn');
}

/** Get the number of cards in a player's hand from the UI. */
export async function handSize(player: Player): Promise<number> {
  return player.page.locator('#hand .card').count();
}

/** Tear down all browser contexts after a test. */
export async function cleanup(session: GameSession): Promise<void> {
  await Promise.all(session.players.map((p) => p.context.close()));
}
