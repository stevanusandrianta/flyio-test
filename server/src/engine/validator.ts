import { Card, ClassifiedHand, HandType } from '../types';
import { RANK_ORDER, SUIT_ORDER } from './deck';

function groupByRank(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    groups[card.rank] = groups[card.rank] ?? [];
    groups[card.rank].push(card);
  }
  return groups;
}

function isStraight(cards: Card[]): boolean {
  const ranks = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  // Check consecutive
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function isFlush(cards: Card[]): boolean {
  return cards.every(c => c.suit === cards[0].suit);
}

export function classifyHand(cards: Card[]): ClassifiedHand | null {
  const n = cards.length;

  if (n === 1) {
    return { type: 'single', cards };
  }

  if (n === 2) {
    const groups = groupByRank(cards);
    const counts = Object.values(groups).map(g => g.length);
    if (counts.includes(2)) return { type: 'pair', cards };
    return null;
  }

  if (n === 3) {
    const groups = groupByRank(cards);
    const counts = Object.values(groups).map(g => g.length);
    if (counts.includes(3)) return { type: 'triple', cards };
    return null;
  }

  if (n === 5) {
    const straight = isStraight(cards);
    const flush = isFlush(cards);
    const groups = groupByRank(cards);
    const counts = Object.values(groups).map(g => g.length).sort((a, b) => b - a);

    if (straight && flush) return { type: 'straightflush', cards };
    if (counts[0] === 4) return { type: 'fourofakind', cards };
    if (counts[0] === 3 && counts[1] === 2) return { type: 'fullhouse', cards };
    if (flush) return { type: 'flush', cards };
    if (straight) return { type: 'straight', cards };
    return null;
  }

  return null;
}

// Validate that a play is legal given the current trick
export function validatePlay(
  cards: Card[],
  playerHand: Card[],
  lastPlay: ClassifiedHand | null,
): { valid: boolean; reason?: string; hand?: ClassifiedHand } {
  // All cards must be in player's hand
  const handIds = new Set(playerHand.map(c => c.id));
  for (const card of cards) {
    if (!handIds.has(card.id)) {
      return { valid: false, reason: 'Card not in your hand' };
    }
  }

  const hand = classifyHand(cards);
  if (!hand) {
    return { valid: false, reason: 'Invalid combination' };
  }

  // Leading a new trick — any valid hand is ok
  if (!lastPlay) {
    return { valid: true, hand };
  }

  // Must match card count
  if (cards.length !== lastPlay.cards.length) {
    return { valid: false, reason: `Must play ${lastPlay.cards.length} card(s)` };
  }

  return { valid: true, hand };
}
