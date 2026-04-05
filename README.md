# Snake Game 🐍

A browser-based Snake game with 3 modes, built with pure HTML/CSS/JS.

**Live:** https://yishai.aryeh.win

## Game Modes

- **קלאסי (Classic)** — Standard snake gameplay
- **מכשולים (Obstacles)** — Random rocks that reshuffle every time you eat an apple. 7-tile safe zone ahead of the snake
- **צבעוני (Colorful)** — Rainbow-cycling snake with color-shifting effects

## Features

- Hebrew RTL UI, dark theme with neon green accents
- Username login with per-mode high scores (localStorage)
- Settings: speed per mode, sound, snake color, starting length
- Keyboard (arrows/WASD) + mobile touch/swipe controls
- Web Audio API sound effects (no external files)
- Particle effects on food pickup
- Speed increases every 50 points

## Deploy

```bash
# After making changes:
./deploy.sh   # Bumps cache version
git add -A && git commit -m "description" && git push
```

## Tech

Pure HTML + CSS + JS. No frameworks, no build step, no dependencies. Served as static files via nginx.
