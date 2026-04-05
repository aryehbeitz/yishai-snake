# Yishai Games

A game hub with Snake and Car Racing, built with pure HTML/CSS/JS. Features an AI coding agent that implements changes via SMS.

**Live:** https://yishai.aryeh.win

## Games

### Snake (נחש)
5+ game modes with customizable layout:
- **קלאסי** — Standard snake
- **מכשולים** — Random rocks reshuffle on every apple, 7-tile safe zone ahead
- **צבעוני** — Rainbow-cycling snake with color-shifting effects
- **AI חמדן** — Greedy AI pathfinding
- **AI המילטוני** — Hamiltonian cycle AI
- **רב-ממדי** — Configurable board size

### Car Racing (מרוץ מכוניות)
Dodge cars, collect points. Canvas-based with touch controls.

## Features

- Hebrew RTL UI, dark theme with neon green accents
- Username login with per-mode high scores (server-persisted)
- Customization panel: drag to reorder cards, add/remove widgets from categorized menu
- Widgets: leaderboard, personal scores, sound control, theme picker, speed/length settings, live clock, tips, tilt control, head design, board size
- Settings: speed per mode, sound, snake color, starting length
- Keyboard (arrows/WASD) + mobile touch/swipe + tilt controls
- Web Audio API sound effects
- Death explosion particle effect
- Speed increases every 50 points
- Changelog page with version history

## Architecture

```
index.html          — Game hub (pick Snake or Cars)
snake.html          — Snake game page
cars.html           — Car racing page
changelog.html      — Version history page
game.js (3100 LOC)  — Snake engine, modes, AI, customization, rendering
cars.js             — Car racing engine
style.css           — Snake styling
cars.css            — Car racing styling
hub.css             — Hub page styling
server.js           — Scores API (Node.js, port 3460)
scores.json         — Persisted scores (gitignored)
version-toast.js    — Auto-reload toast on deploy
deploy.sh           — Cache bust + version bump
changelog.json      — Version history data
Dockerfile          — Node 24 + Claude CLI
docker-compose.yml  — Container config
```

## Scores API

Runs inside Docker on port 3460, proxied by nginx at `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scores` | All scores |
| GET | `/api/leaderboard?mode=classic&limit=10` | Sorted leaderboard |
| POST | `/api/scores` | Submit `{user, mode, score}` |

Dual storage: localStorage (instant) + server API (persistent across devices).

## AI Coding Agent

An SMS-driven coding agent lets the game creator (ישי) request changes via text message. The agent runs Claude inside the Docker container, implements changes, commits, deploys, and replies with a summary.

- Orchestrator in `sms-brain/snake-agent.js`
- Claude runs sandboxed in Docker with Edit/Write/Bash/Read tools
- Activity-based timeout: kills only if idle for 3 min, no total time limit
- Verification loop: checks files changed, retries if agent produced no output
- Auto-commits + deploys on success

## Deploy

```bash
./deploy.sh   # Bumps ?v= cache busters in all HTML files
git add -A && git commit -m "description" && git push
```

No build step. Nginx serves static files, proxies `/api/` to Docker container.

## Server Setup

- **Nginx:** `/etc/nginx/sites-available/yishai.aryeh.win`
- **SSL:** Let's Encrypt (auto-renew)
- **Docker:** `yishai-snake` container (scores API + Claude agent)
- **PM2:** Not used (migrated to Docker)

## Tech

Pure HTML + CSS + JS. No frameworks, no build step, no dependencies. Node.js scores API. Docker for sandboxed AI agent.
