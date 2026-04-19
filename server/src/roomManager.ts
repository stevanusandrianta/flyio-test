import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Room, Player, ServerMessage } from './types';

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(playerName: string, ws: WebSocket): { room: Room; player: Player } {
  let code: string;
  do {
    code = generateCode();
  } while (rooms.has(code));

  const player: Player = { id: uuidv4(), name: playerName, ws, hand: [] };
  const room: Room = {
    code,
    hostId: player.id,
    players: [player],
    phase: 'waiting',
    currentPlayerIndex: 0,
    lastPlay: null,
    lastPlayerId: null,
    passCount: 0,
    finishCount: 0,
  };

  rooms.set(code, room);
  return { room, player };
}

export function joinRoom(
  code: string,
  playerName: string,
  ws: WebSocket,
): { room: Room; player: Player } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'waiting') return { error: 'Game already in progress' };
  if (room.players.length >= 4) return { error: 'Room is full' };

  const player: Player = { id: uuidv4(), name: playerName, ws, hand: [] };
  room.players.push(player);
  return { room, player };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === playerId)) return room;
  }
  return undefined;
}

export function removePlayer(playerId: string): void {
  const room = getRoomByPlayerId(playerId);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(room.code);
  } else if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
}

export function broadcast(room: Room, message: ServerMessage, excludeId?: string): void {
  const data = JSON.stringify(message);
  for (const player of room.players) {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

export function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
