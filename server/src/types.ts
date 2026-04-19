import { WebSocket } from 'ws';

export type Suit = 'D' | 'C' | 'H' | 'S'; // Diamonds < Clubs < Hearts < Spades
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string; // e.g. "3D", "AS", "2H"
  rank: Rank;
  suit: Suit;
}

export type HandType = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'fourofakind' | 'straightflush';

export interface ClassifiedHand {
  type: HandType;
  cards: Card[];
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  hand: Card[];
  finishRank?: number; // 1st, 2nd, 3rd, 4th
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  currentPlayerIndex: number;
  lastPlay: ClassifiedHand | null;
  lastPlayerId: string | null;
  passCount: number;
  finishCount: number;
}

// WebSocket message types
export interface ClientMessage {
  type: 'create_room' | 'join_room' | 'start_game' | 'play_cards' | 'pass';
  playerName?: string;
  roomCode?: string;
  cardIds?: string[];
}

export interface ServerMessage {
  type:
    | 'room_joined'
    | 'player_joined'
    | 'game_started'
    | 'game_state'
    | 'your_turn'
    | 'invalid_play'
    | 'player_finished'
    | 'game_over'
    | 'your_turn_hand'
    | 'error';
  [key: string]: unknown;
}
