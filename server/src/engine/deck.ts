import { Card, Rank, Suit } from '../types';

const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS: Suit[] = ['D', 'C', 'H', 'S'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ id: `${rank}${suit}`, rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function deal(deck: Card[], players: number): Card[][] {
  const hands: Card[][] = Array.from({ length: players }, () => []);
  deck.forEach((card, i) => hands[i % players].push(card));
  return hands;
}

export const RANK_ORDER: Record<Rank, number> = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5,
  '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12,
};

export const SUIT_ORDER: Record<Suit, number> = {
  D: 0, C: 1, H: 2, S: 3,
};

export function cardValue(card: Card): number {
  return RANK_ORDER[card.rank] * 4 + SUIT_ORDER[card.suit];
}
