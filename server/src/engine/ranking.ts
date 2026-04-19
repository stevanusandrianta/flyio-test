import { Card, ClassifiedHand } from '../types';
import { cardValue, RANK_ORDER, SUIT_ORDER } from './deck';

// Returns the "key" card of a hand for comparison (highest card, or primary card)
function handKey(hand: ClassifiedHand): number {
  switch (hand.type) {
    case 'single':
      return cardValue(hand.cards[0]);
    case 'pair': {
      // highest suit among the pair cards
      const sorted = [...hand.cards].sort((a, b) => SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit]);
      return cardValue(sorted[0]);
    }
    case 'triple':
      return RANK_ORDER[hand.cards[0].rank];
    case 'straight': {
      // highest card in straight
      return Math.max(...hand.cards.map(cardValue));
    }
    case 'flush': {
      // compare suit first, then highest card
      const maxSuit = Math.max(...hand.cards.map(c => SUIT_ORDER[c.suit]));
      const maxRank = Math.max(...hand.cards.map(c => RANK_ORDER[c.rank]));
      return maxSuit * 100 + maxRank;
    }
    case 'fullhouse': {
      // compare by the triple's rank
      const rankGroups = groupByRank(hand.cards);
      const tripleRank = Object.entries(rankGroups).find(([, cards]) => cards.length === 3)![0];
      return RANK_ORDER[tripleRank as keyof typeof RANK_ORDER];
    }
    case 'fourofakind': {
      const rankGroups = groupByRank(hand.cards);
      const quadRank = Object.entries(rankGroups).find(([, cards]) => cards.length === 4)![0];
      return RANK_ORDER[quadRank as keyof typeof RANK_ORDER];
    }
    case 'straightflush': {
      return Math.max(...hand.cards.map(cardValue));
    }
  }
}

function groupByRank(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    groups[card.rank] = groups[card.rank] ?? [];
    groups[card.rank].push(card);
  }
  return groups;
}

const FIVE_CARD_RANK: Record<string, number> = {
  straight: 0,
  flush: 1,
  fullhouse: 2,
  fourofakind: 3,
  straightflush: 4,
};

// Returns true if challenger beats current
export function beats(current: ClassifiedHand, challenger: ClassifiedHand): boolean {
  if (current.cards.length !== challenger.cards.length) return false;
  if (current.type !== challenger.type) {
    // Only applicable for 5-card hands where type can differ
    if (current.cards.length !== 5) return false;
    return FIVE_CARD_RANK[challenger.type] > FIVE_CARD_RANK[current.type];
  }
  return handKey(challenger) > handKey(current);
}
