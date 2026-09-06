const express = require('express');
const path = require('path');
const app = express();

const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files (Index.html, admin.html, style.css, Index.js, admin.js, etc)
// from the public/ folder.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// -------------------------------
// GAME STATE
// -------------------------------
// arenas[code] = { players: {} }
// Each arena is its own Socket.IO "room" (the room name is just the code),
// so events emitted with io.to(code) only reach clients deployed into that
// arena. A socket that hasn't created/joined/queued into an arena yet
// (i.e. still sitting in the client-side lobby) isn't in any players{} map
// and won't show up to anyone.
const arenas = {};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const CODE_LENGTH = 5;
const SPAWN_PROTECTION_MS = 3000;

function generateJoinCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (arenas[code]); // guarantee it isn't already in use
  return code;
}

function makePlayerEntry(name) {
  return {
    name: name || 'Player',
    x: 0,
    y: 1.7,
    z: 42,
    rotY: 0,
    weapon: 'rifle',
    health: 100,
    alive: true,
    spawnProtectionUntil: Date.now() + SPAWN_PROTECTION_MS
  };
}

function broadcastArena(code) {
  if (!arenas[code]) return;
  const players = Object.fromEntries(
    Object.entries(arenas[code].players).map(([id, player]) => [
      id,
      Object.assign({}, player, {
        spawnProtected: player.spawnProtectionUntil > Date.now()
      })
    ])
  );
  io.to(code).emit('players-list', players);
  broadcastAdminState();
}

// Admin dashboard aggregates every arena into one flat roster, tagged with
// which arena each player is in, and lives in its own room so it keeps
// working even though regular players only ever see their own arena.
function broadcastAdminState() {
  const flat = {};
  for (const code of Object.keys(arenas)) {
    for (const [id, p] of Object.entries(arenas[code].players)) {
      flat[id] = Object.assign({}, p, { arena: code });
    }
  }
  for (const [id, connectedSocket] of io.sockets.sockets) {
    if (connectedSocket.data.isAdmin || connectedSocket.data.arenaCode) continue;
    const location = connectedSocket.data.location || 'Login Page';
    flat[id] = {
      name: location === 'Login Page' ? '<UNKNOWN>' : (connectedSocket.data.playerName || '<UNKNOWN>'),
      health: '?',
      alive: true,
      location
    };
  }
  io.to('__admin__').emit('players-list', flat);
}

// Moves (or places) a socket into the given arena room, removing it from
// whatever arena it was previously in.
function enterArena(socket, code, name) {
  const prevCode = socket.data.arenaCode;
  if (prevCode && arenas[prevCode]) {
    delete arenas[prevCode].players[socket.id];
    socket.leave(prevCode);
    broadcastArena(prevCode);
  }

  socket.data.arenaCode = code;
  socket.join(code);
  arenas[code].players[socket.id] = makePlayerEntry(name);

  socket.emit('init-players', Object.fromEntries(
    Object.entries(arenas[code].players).map(([id, player]) => [
      id,
      Object.assign({}, player, {
        spawnProtected: player.spawnProtectionUntil > Date.now()
      })
    ])
  ));
  broadcastArena(code);
}

// -------------------------------
// SOCKET.IO EVENTS
// -------------------------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin page subscribes to the aggregated cross-arena roster.
  socket.on('admin-subscribe', () => {
    socket.data.isAdmin = true;
    socket.join('__admin__');
    broadcastAdminState();
  });

  socket.on('player-status', (data = {}) => {
    if (socket.data.isAdmin || socket.data.arenaCode) return;
    socket.data.playerName = typeof data.name === 'string' ? data.name.trim().substring(0, 24) : '';
    socket.data.location = data.location === 'Lobby' ? 'Lobby' : 'Login Page';
    broadcastAdminState();
  });

  socket.on('admin-kick-player', (targetId, callback) => {
    const respond = typeof callback === 'function' ? callback : () => {};
    if (typeof targetId !== 'string') {
      respond({ ok: false, error: 'Invalid player id' });
      return;
    }

    for (const code of Object.keys(arenas)) {
      const target = arenas[code].players[targetId];
      if (!target) continue;

      const targetSocket = io.sockets.sockets.get(targetId);
      delete arenas[code].players[targetId];
      if (targetSocket) {
        targetSocket.leave(code);
        targetSocket.data.arenaCode = null;
        targetSocket.data.location = 'Lobby';
        targetSocket.emit('kicked-from-arena');
      }
      broadcastArena(code);
      broadcastAdminState();
      respond({ ok: true });
      return;
    }

    const lobbySocket = io.sockets.sockets.get(targetId);
    if (lobbySocket && !lobbySocket.data.isAdmin) {
      lobbySocket.data.playerName = '';
      lobbySocket.data.location = 'Login Page';
      lobbySocket.emit('kicked-from-arena');
      broadcastAdminState();
      respond({ ok: true });
      return;
    }

    respond({ ok: false, error: 'Player is no longer connected' });
  });

  // Create a brand-new arena with a fresh, unused join code and deploy
  // this socket straight into it.
  socket.on('create-arena', (data, cb) => {
    const name = data && data.name;
    const code = generateJoinCode();
    arenas[code] = { players: {} };
    enterArena(socket, code, name);
    console.log(`Arena ${code} created by ${socket.id} (${name || 'Player'})`);
    if (typeof cb === 'function') cb({ ok: true, code });
  });

  // Join a specific arena by its code.
  socket.on('join-arena', (data, cb) => {
    const code = String((data && data.code) || '').trim().toUpperCase();
    const name = data && data.name;
    if (!code || !arenas[code]) {
      console.log(`Join attempt failed — code "${code}" not found. Known codes: [${Object.keys(arenas).join(', ')}]`);
      if (typeof cb === 'function') cb({ ok: false, error: 'That join code doesn\'t exist.' });
      return;
    }
    enterArena(socket, code, name);
    console.log(`${socket.id} (${name || 'Player'}) joined arena ${code} — now ${Object.keys(arenas[code].players).length} player(s)`);
    if (typeof cb === 'function') cb({ ok: true, code });
  });

  // Matchmake into a random existing arena. If there are none yet, make one.
  // If there's exactly one, use it regardless of whether anyone's in it.
  socket.on('join-random-arena', (data, cb) => {
    const name = data && data.name;
    const codes = Object.keys(arenas);
    let code;
    if (codes.length === 0) {
      code = generateJoinCode();
      arenas[code] = { players: {} };
    } else {
      code = codes[Math.floor(Math.random() * codes.length)];
    }
    enterArena(socket, code, name);
    if (typeof cb === 'function') cb({ ok: true, code });
  });

  socket.on('respawn', () => {
    const code = socket.data.arenaCode;
    const player = code && arenas[code] && arenas[code].players[socket.id];
    if (!player || player.alive) return;
    player.health = 100;
    player.alive = true;
    player.spawnProtectionUntil = Date.now() + SPAWN_PROTECTION_MS;
    broadcastArena(code);
  });

  // Index.js sends this ~10x/sec with position, rotation, weapon, health, alive
  socket.on('update', (data) => {
    const code = socket.data.arenaCode;
    if (!code || !arenas[code] || !arenas[code].players[socket.id]) return;
    const { spawnProtectionUntil, ...playerUpdate } = data || {};
    Object.assign(arenas[code].players[socket.id], playerUpdate);
    broadcastArena(code);
  });

  // A client fired — relay to everyone else in the same arena so they can
  // show tracers/projectiles
  socket.on('fire', (payload) => {
    const code = socket.data.arenaCode;
    if (!code) return;
    socket.to(code).emit('player-fired', socket.id, payload);
  });

  // A client reports it hit another player — tell that player they took damage
  socket.on('hit', ({ targetId, damage } = {}) => {
    const code = socket.data.arenaCode;
    if (!code || !arenas[code] || !targetId || typeof damage !== 'number') return;
    const target = arenas[code].players[targetId];
    if (!target) return; // target must be in the same arena
    if (target.spawnProtectionUntil > Date.now()) return;
    io.to(targetId).emit('player-hit', targetId, damage);
    target.health = Math.max(0, (target.health ?? 100) - damage);
    if (target.health <= 0) target.alive = false;
    broadcastArena(code);
  });

  // Admin sends a chat message — broadcast to every connected client across
  // every arena, since it's a server-wide announcement.
  socket.on('admin-message', (text) => {
    const entry = {
      from: 'admin',
      text,
      ts: Date.now()
    };
    io.emit('server-chat', entry);
  });

  // Arena chat stays scoped to that arena; lobby chat is visible to other
  // lobby players and the admin dashboard.
  socket.on('chat', (text) => {
    const code = socket.data.arenaCode;
    if (typeof text !== 'string' || !text.trim()) return;
    const name = code
      ? (arenas[code]?.players[socket.id]?.name || '<UNKNOWN>')
      : (socket.data.playerName || '<UNKNOWN>');
    const entry = {
      from: name,
      text: text.trim().substring(0, 200),
      ts: Date.now(),
      arena: code || null
    };
    io.to('__admin__').emit('server-chat', entry);
    if (code && arenas[code]) {
      io.to(code).emit('server-chat', entry);
      return;
    }
    for (const [id, connectedSocket] of io.sockets.sockets) {
      if (!connectedSocket.data.arenaCode && !connectedSocket.data.isAdmin) {
        connectedSocket.emit('server-chat', entry);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const code = socket.data.arenaCode;
    if (code && arenas[code] && arenas[code].players[socket.id]) {
      delete arenas[code].players[socket.id];
      broadcastArena(code);
    }
    broadcastAdminState();
  });
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});