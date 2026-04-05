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

  const minEnemies = level >= 10 ? 12 : level >= 5 ? 10 : 6;
  const maxEnemies = level >= 10 ? 15 : level >= 5 ? 12 : 8;

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
      spawnDelay: type === 'tank' ? 460 : type === 'zigzag' ? 300 : 360,
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
