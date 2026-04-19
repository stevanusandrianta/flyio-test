import { Room, Player, Card, ClassifiedHand } from './types';
import { createDeck, shuffle, deal } from './engine/deck';
import { validatePlay } from './engine/validator';
import { beats } from './engine/ranking';

export function startGame(room: Room): void {
  const deck = shuffle(createDeck());
  const hands = deal(deck, room.players.length);

  room.phase = 'playing';
  room.lastPlay = null;
  room.lastPlayerId = null;
  room.passCount = 0;
  room.finishCount = 0;

  room.players.forEach((player, i) => {
    player.hand = hands[i];
    player.finishRank = undefined;
  });

  // Find who has 3 of Diamonds
  room.currentPlayerIndex = room.players.findIndex(p =>
    p.hand.some(c => c.id === '3D'),
  );
}

export function handlePlay(
  room: Room,
  playerId: string,
  cardIds: string[],
): { success: boolean; reason?: string } {
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== room.currentPlayerIndex) {
    return { success: false, reason: 'Not your turn' };
  }

  const player = room.players[playerIndex];

  // First play of the game must include 3D
  const isFirstPlay = room.lastPlay === null && room.lastPlayerId === null;
  if (isFirstPlay && !cardIds.includes('3D')) {
    return { success: false, reason: 'First play must include 3♦' };
  }

  const cards = cardIds.map(id => player.hand.find(c => c.id === id)!).filter(Boolean);
  if (cards.length !== cardIds.length) {
    return { success: false, reason: 'Invalid card selection' };
  }

  const result = validatePlay(cards, player.hand, room.lastPlay);
  if (!result.valid) {
    return { success: false, reason: result.reason };
  }

  const hand = result.hand!;

  // Must beat the last play
  if (room.lastPlay && !beats(room.lastPlay, hand)) {
    return { success: false, reason: 'Does not beat the current play' };
  }

  // Remove cards from hand
  const playedIds = new Set(cardIds);
  player.hand = player.hand.filter(c => !playedIds.has(c.id));

  room.lastPlay = hand;
  room.lastPlayerId = playerId;
  room.passCount = 0;

  return { success: true };
}

export function handlePass(
  room: Room,
  playerId: string,
): { success: boolean; reason?: string; newTrick: boolean } {
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== room.currentPlayerIndex) {
    return { success: false, reason: 'Not your turn', newTrick: false };
  }

  if (!room.lastPlay) {
    return { success: false, reason: 'Cannot pass when leading a new trick', newTrick: false };
  }

  room.passCount++;

  // Count active players (still have cards)
  const activePlayers = room.players.filter(p => p.hand.length > 0);

  // If everyone else passed, last player leads new trick
  if (room.passCount >= activePlayers.length - 1) {
    room.lastPlay = null;
    room.lastPlayerId = null;
    room.passCount = 0;
    advanceTurn(room); // Move to the trick winner
    return { success: true, newTrick: true };
  }

  advanceTurn(room);
  return { success: true, newTrick: false };
}

export function advanceTurn(room: Room): void {
  let next = (room.currentPlayerIndex + 1) % room.players.length;
  // Skip players who have finished
  while (room.players[next].hand.length === 0 && room.players[next].finishRank !== undefined) {
    next = (next + 1) % room.players.length;
  }
  room.currentPlayerIndex = next;
}

export function checkFinished(room: Room, player: Player): boolean {
  if (player.hand.length === 0) {
    room.finishCount++;
    player.finishRank = room.finishCount;
    return true;
  }
  return false;
}

export function isGameOver(room: Room): boolean {
  // Game ends when all but one player have finished (or all finished)
  const remaining = room.players.filter(p => p.finishRank === undefined);
  return remaining.length <= 1;
}

export function finalizeGame(room: Room): void {
  // Assign last place to remaining player
  const remaining = room.players.find(p => p.finishRank === undefined);
  if (remaining) {
    room.finishCount++;
    remaining.finishRank = room.finishCount;
  }
  room.phase = 'finished';
}

export function publicGameState(room: Room) {
  return {
    currentPlayerId: room.players[room.currentPlayerIndex]?.id,
    currentPlayerName: room.players[room.currentPlayerIndex]?.name,
    lastPlay: room.lastPlay
      ? { type: room.lastPlay.type, cards: room.lastPlay.cards }
      : null,
    lastPlayerId: room.lastPlayerId,
    lastPlayerName: room.lastPlayerId
      ? room.players.find(p => p.id === room.lastPlayerId)?.name
      : null,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      finishRank: p.finishRank,
    })),
    passCount: room.passCount,
  };
}
