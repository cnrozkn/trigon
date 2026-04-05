const ENEMY_UNLOCK_LEVELS = {
  circle: 1,
  zigzag: 3,
  tank: 5,
  splitter: 7,
  shooter: 10,
  shieldBearer: 12,
};

const BASE_TYPES = ['circle', 'zigzag', 'tank', 'splitter', 'shooter', 'shieldBearer'];

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spawnDelayMultiplier(level) {
  // Keep level 1-2 baseline stable, ramp pressure after level 3.
  if (level <= 2) return 1.12;
  const base = 1.18 - 0.65 / (1 + Math.exp(-0.26 * (level - 7)));
  if (level === 5) return Math.max(0.56, base - 0.005);
  if (level > 15) return Math.max(0.42, base - 0.12);
  if (level >= 4 && level <= 8) return Math.max(0.56, base - 0.035);
  return base;
}

export function getEnemyUnlockLevels() {
  return { ...ENEMY_UNLOCK_LEVELS };
}

export function getActiveEnemyTypesForLevel(level) {
  return BASE_TYPES.filter((type) => level >= ENEMY_UNLOCK_LEVELS[type]);
}

export function buildLevelWaveSet(level) {
  const activeTypes = getActiveEnemyTypesForLevel(level);
  const waveCount = clamp(3 + Math.floor((level - 1) / 4), 3, 5);
  const patterns = ['sequential', 'burst', 'sides', 'v_formation'];
  const hasBossWave = level >= 5 && level % 5 === 0;
  const delayFactor = spawnDelayMultiplier(level);

  const minEnemies = level >= 14 ? 15 : level >= 10 ? 13 : level >= 6 ? 12 : level >= 3 ? 9 : 6;
  const maxEnemies = level >= 14 ? 19 : level >= 10 ? 17 : level >= 6 ? 15 : level >= 3 ? 11 : 8;

  const waves = [];
  for (let wave = 0; wave < waveCount; wave += 1) {
    const totalEnemies = randomInt(minEnemies, maxEnemies);
    const counts = new Map();
    for (let i = 0; i < totalEnemies; i += 1) {
      const idx = Math.floor(Math.random() * activeTypes.length);
      const type = activeTypes[idx];
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    const entries = [...counts.entries()].map(([type, count]) => ({
      type,
      count,
      spawnDelay: Math.round((type === 'tank' ? 460 : type === 'zigzag' ? 300 : 360) * delayFactor),
    }));

    waves.push({
      kind: 'normal',
      index: wave,
      enemies: entries,
      spawnPattern: patterns[(wave + level) % patterns.length],
    });
  }

  if (hasBossWave) {
    waves.push({
      kind: 'boss',
      index: waves.length,
      enemies: [{ type: 'boss', count: 1, spawnDelay: 0 }],
      spawnPattern: 'sequential',
    });
  }

  return { waveCount: waves.length, waves };
}
