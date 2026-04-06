# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Trigon** is a hypercasual neon bullet-hell auto-shooter built with Phaser 3, Vite, and Capacitor. Web-first, deployable to iOS/Android via Capacitor. All visuals are generated at runtime using Phaser's Graphics API — zero external image assets.

**Stack:** Phaser 3.90.0 · Vite 8 · Vanilla JS (ES2022+) · Capacitor 8.3 · Node 22 LTS

## Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm run dev:host     # Dev server on local network
npm run build        # Production build → dist/
npm run preview      # Preview dist/ locally

# Mobile (requires native toolchain)
npm run cap:sync         # Build + sync to native projects
npm run cap:open:ios     # Open Xcode
npm run cap:open:android # Open Android Studio

# Tests (Node built-in runner, no framework)
node --test tests/combat-runtime.test.js
node --test tests/buff-timers.test.js
node --test tests/menu-unlock.test.js
node --test tests/            # Run all tests
```

## Architecture

### Scene Flow
```
Boot.js → Menu.js → PlayScene.js → (game over) → Menu.js
                          ↓
              PrestigeShop.js / AchievementsScene.js
```

- **Boot.js** — generates all textures procedurally at startup; no sprite sheets or image files
- **Menu.js** — title screen, settings, meta navigation
- **PlayScene.js** — monolithic gameplay core (~2,600 lines); owns player, bullets, enemies, upgrades, HUD, wave logic, prestige, achievements, and game-over flow
- **PrestigeShop.js** — permanent upgrade shop using coins earned during runs
- **AchievementsScene.js** — achievement list and daily challenge UI

### Systems (`src/systems/`)
| File | Purpose |
|------|---------|
| `WaveManager.js` | Schedules enemy spawns, tracks wave state |
| `WaveDefinitions.js` | Level-based wave patterns and configs |
| `EnemyFactory.js` | Enemy type definitions (normal, zigzag, tank, splitter, boss) |
| `PowerupSystem.js` | Drop rates and powerup pickup logic |
| `ChallengeSystem.js` | Daily challenge generation (seeded by date) |
| `AchievementSystem.js` | Achievement condition tracking |
| `combatRuntime.js` | Bullet/damage calculations, game-over cleanup helpers |
| `buffTimers.js` | Status effect duration management |

### Key Constants (PlayScene.js)
- `BASE_FIRE_MS = 380` / `MIN_FIRE_MS = 120` — auto-fire rate range
- `MAX_PLAYER_COUNT = 6` — max triangles in formation (36px spacing)
- `KILLS_PER_LEVEL = 10` — progression rate
- `DRAFT_REROLLS = 2` — reroll tokens per level-up draft

### Data Persistence (`src/utils/Storage.js`)
All state in `localStorage`. Key namespaces:
- **Audio:** `masterVolume`, `sfxVolume`, `muted`, `hapticEnabled`
- **Profile:** `highScore`, `bestLevel`, `totalKills`, `coins`, `upgrades`, `cosmetics`, `achievements`, `dailyChallenges`

### Audio (`src/audio/`)
Web Audio API wrapper with iOS user-gesture unlock. SFX events: `fire`, `hit`, `crit`, `enemyDeath`, `bossDeath`, `shieldAbsorb`, `levelUp`, `gameOver`, `upgradeSelect`, `reroll`, `banish`, `killStreakNote`, `comboBreak`, `nearMissWhoosh`, `feverStart`.

### Viewport (`src/platform/viewport.js`)
Handles responsive canvas resizing, safe-area insets (notch/home bar), and orientation changes. Called from `main.js` on init and resize.

## Visual Design Conventions
- Background: `#0a0a12`, Player: white + cyan stroke, Bullets: `#88ffff`, Enemies: `#ff66aa`, Bosses: purple
- All fonts: `system-ui` (no web fonts)
- Particle effects use `ADD` blend mode

## Important Notes

- **PlayScene.js is intentionally monolithic** — resist refactoring unless scoped as a specific task; changes here affect the entire gameplay loop
- Phaser registry is used for cross-scene shared state (not global variables)
- No TypeScript — plain ES2022 JS throughout
- Mobile native builds require Xcode 26+ (iOS) or Android Studio (Android); web build works without any native toolchain
- Docs in `docs/PRD.md` and `docs/ROADMAP.md` contain the full design spec and 8-phase roadmap
