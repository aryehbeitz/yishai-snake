# Snake Game

## Overview

Browser-based Snake game for ישי. Pure HTML/CSS/JS, no frameworks. Served at https://yishai.aryeh.win.

## Files

- `index.html` — HTML structure (home screen, game screen, settings panel)
- `style.css` — All styling (dark theme, neon green, RTL, responsive)
- `game.js` — Game engine, state management, rendering, sound, API sync
- `server.js` — Scores API (Node.js, port 3460, JSON file storage)
- `scores.json` — Persisted scores (auto-created, gitignored)
- `deploy.sh` — Cache-bust + restart API
- `version.txt` — Current deploy timestamp

## Architecture

Single-page app with 3 screens toggled via JS:
- **Home**: mode cards, user login, settings button
- **Game**: canvas rendering, score, mobile controls
- **Settings**: slide-in panel from right

Game loop: `setInterval` → `gameTick()` → move snake → check collisions → render via canvas.

### Scores

Dual storage: localStorage (instant) + server API (persistent).
- On game over: saves to localStorage immediately, POSTs to `/api/scores`
- On page load: fetches `/api/scores`, merges with localStorage (higher score wins)
- Server stores in `scores.json` keyed by `{username: {mode: score}}`

### API Endpoints (port 3460)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scores` | Full scores object |
| GET | `/api/leaderboard?mode=classic&limit=10` | Sorted leaderboard for a mode |
| POST | `/api/scores` | Submit score `{user, mode, score}` |

## Game Modes

| Mode | Key | Special |
|------|-----|---------|
| Classic | `classic` | Standard snake |
| Obstacles | `obstacles` | Random rocks, reshuffle on food eat, 7-tile safe zone ahead |
| Colorful | `colorful` | Rainbow snake body, HSL-cycling food/particles |

## Deploy

```bash
./deploy.sh          # Bumps ?v= cache buster, restarts API
git add -A && git commit -m "msg" && git push
```

## Server

- **Nginx**: `/etc/nginx/sites-available/yishai.aryeh.win`
  - Static files served from `/home/admin/dev/yishai-snake/`
  - `/api/` proxied to `127.0.0.1:3460`
- **SSL**: Let's Encrypt via certbot (auto-renew)
- **PM2**: `snake-api` process

## Requirements from ישי (via WhatsApp)

- 3 game modes with cards on home page (name + thumbnail)
- Username login (no password) with scores per mode
- Settings: speed per mode, sound, snake color, starting length
- Obstacles mode: rocks reshuffle every apple, 7 tiles ahead always clear
- Hebrew UI
- Persistent scores across devices
