const WS_URL = location.host
  ? (location.protocol === 'https:' ? `wss://${location.host}` : `ws://${location.host}`)
  : 'ws://localhost:3001';

const SUIT_SYMBOL = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUIT_CLASS = { D: 'd', C: 'c', H: 'h', S: 's' };

// Restore session
const session = JSON.parse(sessionStorage.getItem('big2_ws_state') || 'null');
if (!session) { window.location.href = 'index.html'; }

let ws;
let myId = session.playerId;
let isHost = session.isHost;
let myHand = [];
let selected = new Set();
let myTurn = false;

// DOM
const roomCodeDisplay = document.getElementById('room-code-display');
const statusMsg = document.getElementById('status-msg');
const startBtn = document.getElementById('start-btn');
const playersBar = document.getElementById('players-bar');
const lastPlayLabel = document.getElementById('last-play-label');
const lastPlayCards = document.getElementById('last-play-cards');
const handEl = document.getElementById('hand');
const playBtn = document.getElementById('play-btn');
const passBtn = document.getElementById('pass-btn');
const gameError = document.getElementById('game-error');

roomCodeDisplay.textContent = `Room: ${session.roomCode}`;
if (isHost) startBtn.classList.remove('hidden');
renderPlayers(session.players);

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'rejoin',
      playerId: session.playerId,
      roomCode: session.roomCode,
    }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    statusMsg.textContent = 'Disconnected. Refresh to reconnect.';
  };
}

// On page load, reconnect
connect();

function handleMessage(msg) {
  clearError();
  switch (msg.type) {
    case 'room_joined':
      myId = msg.playerId;
      isHost = msg.isHost;
      renderPlayers(msg.players);
      if (msg.gamePhase === 'playing') {
        // Rejoining mid-game — restore state
        startBtn.classList.add('hidden');
        if (msg.hand) { myHand = msg.hand; renderHand(); }
        updateFromState(msg);
        const isMyTurn = msg.currentPlayerId === myId;
        if (isMyTurn) {
          myTurn = true;
          statusMsg.textContent = 'Your turn!';
          playBtn.disabled = false;
          passBtn.disabled = !msg.lastPlay;
        }
      } else {
        if (isHost) startBtn.classList.remove('hidden');
        statusMsg.textContent = `${msg.players.length}/4 players in room`;
      }
      break;

    case 'player_joined':
      renderPlayers(msg.players);
      statusMsg.textContent = `${msg.players.length}/4 players joined`;
      break;

    case 'game_started':
      myHand = msg.hand;
      statusMsg.textContent = 'Game started!';
      startBtn.classList.add('hidden');
      renderHand();
      updateFromState(msg);
      break;

    case 'game_state':
      updateFromState(msg);
      break;

    case 'your_turn':
      myHand = msg.hand;
      myTurn = true;
      renderHand();
      updateFromState(msg);
      statusMsg.textContent = 'Your turn!';
      playBtn.disabled = false;
      passBtn.disabled = !msg.lastPlay; // can't pass if leading
      break;

    case 'your_turn_hand':
      myHand = msg.hand;
      renderHand();
      break;

    case 'invalid_play':
      showError(msg.reason);
      break;

    case 'player_finished':
      statusMsg.textContent = `${msg.playerName} finished in place #${msg.rank}!`;
      updateFromState(msg);
      break;

    case 'game_over': {
      const rankings = msg.rankings.map(r => `#${r.rank} ${r.name}`).join(' · ');
      statusMsg.textContent = `Game over! ${rankings}`;
      playBtn.disabled = true;
      passBtn.disabled = true;
      break;
    }

    case 'error':
      showError(msg.message);
      break;
  }
}

function updateFromState(state) {
  if (state.players) renderPlayers(state.players);

  if (state.lastPlay) {
    lastPlayLabel.textContent = `${state.lastPlayerName} played ${state.lastPlay.type}`;
    renderCards(lastPlayCards, state.lastPlay.cards);
  } else {
    lastPlayLabel.textContent = 'No cards played yet';
    lastPlayCards.innerHTML = '';
  }

  if (state.currentPlayerId !== myId) {
    myTurn = false;
    playBtn.disabled = true;
    passBtn.disabled = true;
    if (state.currentPlayerName) {
      statusMsg.textContent = `${state.currentPlayerName}'s turn`;
    }
  }
}

function renderPlayers(players) {
  playersBar.innerHTML = players.map(p => `
    <div class="player-chip ${p.id === myId ? 'me' : ''}">
      <span>${p.name}</span>
      ${p.cardCount !== undefined ? `<span class="card-count">${p.cardCount} cards</span>` : ''}
      ${p.finishRank ? `<span class="rank">#${p.finishRank}</span>` : ''}
    </div>
  `).join('');
}

function renderHand() {
  handEl.innerHTML = '';
  const sorted = [...myHand].sort(cardSortValue);
  for (const card of sorted) {
    const el = makeCardEl(card);
    if (selected.has(card.id)) el.classList.add('selected');
    el.onclick = () => toggleSelect(card.id, el);
    handEl.appendChild(el);
  }
}

function renderCards(container, cards) {
  container.innerHTML = '';
  for (const card of cards) {
    container.appendChild(makeCardEl(card));
  }
}

function makeCardEl(card) {
  const el = document.createElement('div');
  el.className = `card ${SUIT_CLASS[card.suit]}`;
  el.dataset.id = card.id;
  el.innerHTML = `<span class="rank">${card.rank}</span><span class="suit">${SUIT_SYMBOL[card.suit]}</span>`;
  return el;
}

function toggleSelect(cardId, el) {
  if (!myTurn) return;
  if (selected.has(cardId)) {
    selected.delete(cardId);
    el.classList.remove('selected');
  } else {
    selected.add(cardId);
    el.classList.add('selected');
  }
}

function cardSortValue(a, b) {
  const RANK_ORDER = { '3':0,'4':1,'5':2,'6':3,'7':4,'8':5,'9':6,'10':7,'J':8,'Q':9,'K':10,'A':11,'2':12 };
  const SUIT_ORDER = { D:0, C:1, H:2, S:3 };
  return (RANK_ORDER[a.rank] * 4 + SUIT_ORDER[a.suit]) - (RANK_ORDER[b.rank] * 4 + SUIT_ORDER[b.suit]);
}

startBtn.onclick = () => {
  ws.send(JSON.stringify({ type: 'start_game' }));
};

playBtn.onclick = () => {
  if (selected.size === 0) return showError('Select cards to play');
  ws.send(JSON.stringify({ type: 'play_cards', cardIds: [...selected] }));
  selected.clear();
  myTurn = false;
  playBtn.disabled = true;
  passBtn.disabled = true;
};

passBtn.onclick = () => {
  ws.send(JSON.stringify({ type: 'pass' }));
  selected.clear();
  myTurn = false;
  playBtn.disabled = true;
  passBtn.disabled = true;
};

function showError(msg) {
  gameError.textContent = msg;
  gameError.classList.remove('hidden');
  setTimeout(() => gameError.classList.add('hidden'), 3000);
}

function clearError() {
  gameError.classList.add('hidden');
}
