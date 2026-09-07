// This file runs in the BROWSER (loaded by admin.html). It is the client
// counterpart to the Socket.IO server set up in server.js.

const socket = io();

const playersEl = document.getElementById('players');
const chatEl = document.getElementById('chat');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const pendingKickIds = new Set();

let authenticated = false;

// -------------------------------
// ADMIN LOGIN
// -------------------------------

socket.on('connect', () => {
  showLogin();
});

function showLogin() {
  authenticated = false;

  playersEl.innerHTML = '';
  chatEl.innerHTML = '';

  msgInput.disabled = true;
  sendBtn.disabled = true;

  const password = window.prompt(
    'Enter the Rival Surge admin password:'
  );

  if (password === null) {
    return;
  }

  socket.emit(
    'admin-auth',
    password,
    (result) => {
      if (!result?.ok) {
        window.alert(
          result?.error || 'Admin login failed.'
        );

        return;
      }

      authenticated = true;

      msgInput.disabled = false;
      sendBtn.disabled = false;
    }
  );
}

// -------------------------------
// PLAYERS LIST
// -------------------------------

socket.on('players-list', (players) => {
  if (!authenticated) return;

  const ids = Object.keys(players || {});

  if (ids.length === 0) {
    playersEl.textContent = '(no players)';
    return;
  }

  playersEl.innerHTML = ids
    .map((id) => {
      const p = players[id];

      const name =
        p.location === 'Login Page'
          ? '<UNKNOWN>'
          : (p.name || '<UNKNOWN>');

      const health = p.health ?? '?';

      const alive =
        p.alive === false
          ? ' (dead)'
          : '';

      const location = p.arena
        ? `Arena: ${escapeHtml(p.arena)}`
        : escapeHtml(
            p.location || 'Lobby'
          );

      const arena = ` — ${location}`;

      const kickButton =
        p.location === 'Login Page'
          ? ''
          : `<button class="kick-btn" data-player-id="${escapeHtml(id)}">Kick</button>`;

      return `
        <div class="player">
          <div>
            ${escapeHtml(name)}
            — HP: ${escapeHtml(String(health))}
            ${alive}
            ${arena}
          </div>
          ${kickButton}
        </div>
      `;
    })
    .join('');
});

// -------------------------------
// KICK PLAYER
// -------------------------------

playersEl.addEventListener('click', (event) => {
  event.preventDefault();

  const button =
    event.target.closest('.kick-btn');

  if (
    !authenticated ||
    !button ||
    pendingKickIds.has(
      button.dataset.playerId
    )
  ) {
    return;
  }

  const playerId =
    button.dataset.playerId;

  pendingKickIds.add(playerId);

  button.disabled = true;
  button.textContent = 'Kicking...';

  socket.emit(
    'admin-kick-player',
    playerId,
    (result) => {
      pendingKickIds.delete(playerId);

      if (!result?.ok) {
        button.disabled = false;
        button.textContent = 'Kick';

        console.warn(
          '[admin] kick failed:',
          result?.error ||
            'player not found'
        );
      }
    }
  );
});

// -------------------------------
// CHAT
// -------------------------------

socket.on('server-chat', (entry) => {
  if (!authenticated) return;

  const div =
    document.createElement('div');

  div.className = 'msg';

  const time =
    new Date(
      entry.ts || Date.now()
    ).toLocaleTimeString();

  div.innerHTML =
    `<div class="meta">${escapeHtml(entry.from)} • ${time}</div>` +
    `<div>${escapeHtml(entry.text)}</div>`;

  chatEl.appendChild(div);

  chatEl.scrollTop =
    chatEl.scrollHeight;
});

function sendMessage() {
  if (!authenticated) {
    return;
  }

  const text =
    msgInput.value.trim();

  if (!text) return;

  socket.emit(
    'admin-message',
    text
  );

  msgInput.value = '';
}

sendBtn.addEventListener(
  'click',
  sendMessage
);

msgInput.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  }
);

// -------------------------------
// HTML ESCAPING
// -------------------------------

function escapeHtml(str) {
  const div =
    document.createElement('div');

  div.textContent = str;

  return div.innerHTML;
}