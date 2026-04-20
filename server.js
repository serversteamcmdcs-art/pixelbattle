const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Game State ───────────────────────────────────────────────────────────────
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 100;
const COOLDOWN_MS = 1000; // 1 second between placements per player

// Initialize canvas as flat array of hex colors (null = empty)
let canvas = new Array(CANVAS_WIDTH * CANVAS_HEIGHT).fill('#1a1a2e');

// Track connected players
const players = new Map(); // ws -> { id, color, nickname, lastPlaced, pixelsPlaced }

let playerIdCounter = 0;

const PLAYER_COLORS = [
  '#FF4757', '#FF6B81', '#FFA502', '#ECCC68', '#2ED573',
  '#7BED9F', '#1E90FF', '#70A1FF', '#5352ED', '#A29BFE',
  '#FF6348', '#FF7F50', '#00B894', '#00CEC9', '#6C5CE7',
  '#E17055', '#FDCB6E', '#74B9FF', '#55EFC4', '#FD79A8'
];

function getPlayerColor(id) {
  return PLAYER_COLORS[id % PLAYER_COLORS.length];
}

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastAll(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function getStats() {
  const counts = {};
  canvas.forEach(color => {
    if (color) counts[color] = (counts[color] || 0) + 1;
  });
  // Top colors by pixel count
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { topColors: sorted, totalPlaced: canvas.filter(c => c !== '#1a1a2e').length };
}

function getPlayerList() {
  const list = [];
  players.forEach((p, ws) => {
    list.push({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      pixelsPlaced: p.pixelsPlaced
    });
  });
  return list.sort((a, b) => b.pixelsPlaced - a.pixelsPlaced).slice(0, 20);
}

// ─── WebSocket Handlers ───────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const id = ++playerIdCounter;
  const color = getPlayerColor(id);
  const nickname = `Player${id}`;

  players.set(ws, {
    id,
    color,
    nickname,
    lastPlaced: 0,
    pixelsPlaced: 0
  });

  console.log(`Player ${id} connected. Total: ${players.size}`);

  // Send initial state to new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId: id,
    playerColor: color,
    nickname,
    canvas,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    cooldown: COOLDOWN_MS,
    players: getPlayerList()
  }));

  // Notify others about new player
  broadcast({
    type: 'player_join',
    player: { id, nickname, color, pixelsPlaced: 0 },
    onlineCount: players.size
  }, ws);

  // ── Handle messages ──
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const player = players.get(ws);
    if (!player) return;

    switch (msg.type) {

      case 'place_pixel': {
        const { x, y, color: pixelColor } = msg;

        // Validate
        if (
          typeof x !== 'number' || typeof y !== 'number' ||
          x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT ||
          typeof pixelColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(pixelColor)
        ) return;

        const now = Date.now();
        const remaining = COOLDOWN_MS - (now - player.lastPlaced);
        if (remaining > 0) {
          ws.send(JSON.stringify({ type: 'cooldown', remaining }));
          return;
        }

        // Place pixel
        const idx = y * CANVAS_WIDTH + x;
        canvas[idx] = pixelColor;
        player.lastPlaced = now;
        player.pixelsPlaced++;

        // Broadcast to all
        broadcastAll({
          type: 'pixel',
          x, y,
          color: pixelColor,
          playerId: player.id,
          nickname: player.nickname
        });

        // Periodically broadcast leaderboard
        if (player.pixelsPlaced % 5 === 0) {
          broadcastAll({
            type: 'leaderboard',
            players: getPlayerList(),
            onlineCount: players.size
          });
        }
        break;
      }

      case 'set_nickname': {
        const name = String(msg.nickname || '').trim().slice(0, 20);
        if (name.length < 1) return;
        player.nickname = name;
        broadcast({
          type: 'player_update',
          id: player.id,
          nickname: name
        });
        break;
      }

      case 'chat': {
        const text = String(msg.text || '').trim().slice(0, 100);
        if (!text) return;
        broadcastAll({
          type: 'chat',
          playerId: player.id,
          nickname: player.nickname,
          color: player.color,
          text,
          ts: Date.now()
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (player) {
      console.log(`Player ${player.id} disconnected.`);
      players.delete(ws);
      broadcast({
        type: 'player_leave',
        id: player.id,
        onlineCount: players.size
      });
    }
  });

  ws.on('error', () => {
    players.delete(ws);
  });
});

// ─── Periodic stats broadcast ─────────────────────────────────────────────────
setInterval(() => {
  if (wss.clients.size > 0) {
    broadcastAll({
      type: 'stats',
      ...getStats(),
      onlineCount: players.size
    });
  }
}, 10000);

// ─── HTTP routes ──────────────────────────────────────────────────────────────
app.get('/api/canvas', (req, res) => {
  res.json({ canvas, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
});

app.get('/health', (req, res) => res.json({ status: 'ok', players: players.size }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Pixel Battle running on port ${PORT}`);
  console.log(`Canvas: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
});
