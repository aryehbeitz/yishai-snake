# Snake Game

## Overview

Browser-based Snake game for ישי. Pure HTML/CSS/JS, no frameworks. Served at https://yishai.aryeh.win.

## Files

- `index.html` — HTML structure (home screen, game screen, settings panel)
- `style.css` — All styling (dark theme, neon green, RTL, responsive)
- `game.js` — Game engine, state management, rendering, sound
- `deploy.sh` — Cache-bust script (bumps `?v=` timestamps in index.html)
- `version.txt` — Current deploy timestamp

## Architecture

Single-page app with 3 screens toggled via JS:
- **Home**: mode cards, user login, settings button
- **Game**: canvas rendering, score, mobile controls
- **Settings**: slide-in panel from right

Game loop: `setInterval` → `gameTick()` → move snake → check collisions → render via canvas.

Scores stored in `localStorage` keyed by `snake_scores_{username}`.

## Game Modes

| Mode | Key | Special |
|------|-----|---------|
| Classic | `classic` | Standard snake |
| Obstacles | `obstacles` | Random rocks, reshuffle on food eat, 7-tile safe zone ahead |
| Colorful | `colorful` | Rainbow snake body, HSL-cycling food/particles |

## Deploy

```bash
./deploy.sh          # Bumps ?v= cache buster
git add -A && git commit -m "msg" && git push
```

No build step. Nginx serves static files directly from this directory.

## Server

- **Nginx**: `/etc/nginx/sites-available/yishai.aryeh.win`
- **SSL**: Let's Encrypt via certbot (auto-renew)
- **Root**: `/home/admin/dev/yishai-snake/`

## Requirements from ישי (via WhatsApp)

- 3 game modes with cards on home page (name + thumbnail)
- Username login (no password) with scores per mode
- Settings: speed per mode, sound, snake color, starting length
- Obstacles mode: rocks reshuffle every apple, 7 tiles ahead always clear
- Hebrew UI
