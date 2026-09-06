// This file runs in the BROWSER (loaded by admin.html). It is the client
// counterpart to the Socket.IO server set up in server.js.

const socket = io();

// Regular players only ever get their own arena's roster (each arena is its
// own Socket.IO room). This subscribes to the admin room instead, which the
// server keeps updated with every player across every arena.
socket.on('connect', () => {
  socket.emit('admin-subscribe');
});

const playersEl = document.getElementById('players');
const chatEl = document.getElementById('chat');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const pendingKickIds = new Set();

// -------------------------------
// PLAYERS LIST
// -------------------------------
socket.on('players-list', (players) => {
  const ids = Object.keys(players || {});

  if (ids.length === 0) {
    playersEl.textContent = '(no players)';
    return;
  }

  playersEl.innerHTML = ids
    .map((id) => {
      const p = players[id];
      const name = p.name || 'Unknown';
      const health = p.health ?? '?';
      const alive = p.alive === false ? ' (dead)' : '';
      const location = p.arena
        ? `Arena: ${escapeHtml(p.arena)}`
        : escapeHtml(p.location || 'Lobby');
      const arena = ` — ${location}`;
      return `<div class="player"><div>${escapeHtml(name)} — HP: ${escapeHtml(String(health))}${alive}${arena}</div><button class="kick-btn" data-player-id="${escapeHtml(id)}">Kick</button></div>`;
    })
    .join('');

});

playersEl.addEventListener('click', (event) => {
  event.preventDefault();
  const button = event.target.closest('.kick-btn');
  if (!button || pendingKickIds.has(button.dataset.playerId)) return;

  const playerId = button.dataset.playerId;
  pendingKickIds.add(playerId);
  button.disabled = true;
  button.textContent = 'Kicking...';

  socket.emit('admin-kick-player', playerId, (result) => {
    pendingKickIds.delete(playerId);
    if (!result?.ok) {
      button.disabled = false;
      button.textContent = 'Kick';
      console.warn('[admin] kick failed:', result?.error || 'player not found');
    }
  });
});

// -------------------------------
// CHAT
// -------------------------------
socket.on('server-chat', (entry) => {
  const div = document.createElement('div');
  div.className = 'msg';

  const time = new Date(entry.ts || Date.now()).toLocaleTimeString();
  div.innerHTML = `<div class="meta">${escapeHtml(entry.from)} • ${time}</div><div>${escapeHtml(entry.text)}</div>`;

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
});

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  socket.emit('admin-message', text);
  msgInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}