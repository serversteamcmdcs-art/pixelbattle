# 🎮 PIXEL BATTLE

Real-time multiplayer pixel art game. Paint pixels on a shared 100×100 canvas with players worldwide!

## Features
- 🌐 Real-time multiplayer via WebSockets
- 🎨 50-color palette + custom color picker
- 🏆 Live leaderboard
- 💬 In-game chat
- 🔍 Zoom (2x–32x) & pan
- 📱 Full mobile & touch support (pinch-to-zoom)
- ⌛ 1-second cooldown per player
- 🛠 Tools: Draw, Pan, Color Pick

## Deploy to Render.com

1. Push this project to a **GitHub** repository
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
5. Click **Deploy** — done! ✅

Alternatively, Render will auto-detect `render.yaml` if you use **Blueprint**.

## Local Development

```bash
npm install
node server.js
# Open http://localhost:3000
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Z | Draw tool |
| X | Pan tool |
| C | Color pick |
| Space | Toggle Draw/Pan |
| +/- | Zoom in/out |
| R | Reset view |

## Stack
- **Server**: Node.js + Express + ws (WebSockets)
- **Client**: Vanilla HTML/CSS/JS (no framework)
- **Canvas**: HTML5 Canvas API, pixel-perfect rendering
