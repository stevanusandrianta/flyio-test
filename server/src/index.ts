import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage } from './types';
import {
  createRoom,
  joinRoom,
  getRoomByPlayerId,
  removePlayer,
  broadcast,
  send,
} from './roomManager';
import {
  startGame,
  handlePlay,
  handlePass,
  advanceTurn,
  checkFinished,
  isGameOver,
  finalizeGame,
  publicGameState,
} from './game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Big 2 server running');
});

const wss = new WebSocketServer({ server });

// Map ws → playerId for disconnect handling
const wsToPlayer = new Map<WebSocket, string>();

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    switch (msg.type) {
      case 'create_room': {
        if (!msg.playerName?.trim()) {
          send(ws, { type: 'error', message: 'Player name required' });
          return;
        }
        const { room, player } = createRoom(msg.playerName.trim(), ws);
        wsToPlayer.set(ws, player.id);
        send(ws, {
          type: 'room_joined',
          roomCode: room.code,
          playerId: player.id,
          isHost: true,
          players: room.players.map(p => ({ id: p.id, name: p.name })),
        });
        break;
      }

      case 'join_room': {
        if (!msg.playerName?.trim() || !msg.roomCode?.trim()) {
          send(ws, { type: 'error', message: 'Player name and room code required' });
          return;
        }
        const result = joinRoom(msg.roomCode.trim(), msg.playerName.trim(), ws);
        if ('error' in result) {
          send(ws, { type: 'error', message: result.error });
          return;
        }
        const { room, player } = result;
        wsToPlayer.set(ws, player.id);
        send(ws, {
          type: 'room_joined',
          roomCode: room.code,
          playerId: player.id,
          isHost: false,
          players: room.players.map(p => ({ id: p.id, name: p.name })),
        });
        broadcast(room, {
          type: 'player_joined',
          players: room.players.map(p => ({ id: p.id, name: p.name })),
        }, player.id);
        break;
      }

      case 'start_game': {
        const playerId = wsToPlayer.get(ws);
        if (!playerId) return;
        const room = getRoomByPlayerId(playerId);
        if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return; }
        if (room.hostId !== playerId) { send(ws, { type: 'error', message: 'Only host can start' }); return; }
        if (room.players.length < 2) { send(ws, { type: 'error', message: 'Need at least 2 players' }); return; }
        if (room.phase !== 'waiting') { send(ws, { type: 'error', message: 'Game already started' }); return; }

        startGame(room);

        // Send each player their hand
        for (const player of room.players) {
          send(player.ws, {
            type: 'game_started',
            hand: player.hand,
            ...publicGameState(room),
          });
        }
        break;
      }

      case 'play_cards': {
        const playerId = wsToPlayer.get(ws);
        if (!playerId) return;
        const room = getRoomByPlayerId(playerId);
        if (!room || room.phase !== 'playing') return;

        const result = handlePlay(room, playerId, msg.cardIds ?? []);
        if (!result.success) {
          send(ws, { type: 'invalid_play', reason: result.reason });
          return;
        }

        const player = room.players.find(p => p.id === playerId)!;
        const finished = checkFinished(room, player);

        if (finished) {
          broadcast(room, {
            type: 'player_finished',
            playerId,
            playerName: player.name,
            rank: player.finishRank,
            ...publicGameState(room),
          });

          if (isGameOver(room)) {
            finalizeGame(room);
            broadcast(room, {
              type: 'game_over',
              rankings: room.players
                .sort((a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99))
                .map(p => ({ id: p.id, name: p.name, rank: p.finishRank })),
            });
            return;
          }

          // Winner of trick leads next (reset trick, advance turn)
          room.lastPlay = null;
          room.lastPlayerId = null;
          room.passCount = 0;
        }

        advanceTurn(room);

        const state = publicGameState(room);
        broadcast(room, { type: 'game_state', ...state });

        // Send updated hand to the player who just played
        send(player.ws, { type: 'your_turn_hand', hand: player.hand, yourTurn: false });

        // Signal whose turn it is
        const currentPlayer = room.players[room.currentPlayerIndex];
        send(currentPlayer.ws, {
          type: 'your_turn',
          hand: currentPlayer.hand,
          ...state,
        });
        break;
      }

      case 'pass': {
        const playerId = wsToPlayer.get(ws);
        if (!playerId) return;
        const room = getRoomByPlayerId(playerId);
        if (!room || room.phase !== 'playing') return;

        const result = handlePass(room, playerId);
        if (!result.success) {
          send(ws, { type: 'invalid_play', reason: result.reason });
          return;
        }

        const state = publicGameState(room);
        broadcast(room, { type: 'game_state', ...state });

        const currentPlayer = room.players[room.currentPlayerIndex];
        send(currentPlayer.ws, {
          type: 'your_turn',
          hand: currentPlayer.hand,
          ...state,
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const playerId = wsToPlayer.get(ws);
    if (playerId) {
      const room = getRoomByPlayerId(playerId);
      if (room) {
        broadcast(room, {
          type: 'player_joined',
          players: room.players
            .filter(p => p.id !== playerId)
            .map(p => ({ id: p.id, name: p.name })),
        });
      }
      removePlayer(playerId);
      wsToPlayer.delete(ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Big 2 server listening on ws://localhost:${PORT}`);
});
