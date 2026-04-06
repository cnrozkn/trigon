import * as Phaser from 'phaser';

function randBetween(min, max) {
  return Phaser.Math.Between(min, max);
}

function enemyBaseHP(level) {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  const base = Math.floor(2 + Math.log2(level - 1) * 1.35);
  if (level <= 15) return base;
  const over = level - 15;
  const extra = Math.floor(over * 1.8 + over * over * 0.16);
  return base + extra;
}

function scaleHealth(base, level, mult = 1) {
  const baseLevelHp = enemyBaseHP(level);
  return Math.max(1, Math.floor(baseLevelHp * base * mult));
}

export function buildEnemyConfig(type, level, mutators = {}) {
  const hpMult = mutators.enemyHp || 1;
  
  if (type === 'boss') {
    const usePentagon = Math.floor(level / 5) % 2 === 1;
    const baseBossHp = 38 + level * 7;
    let tunedBossHp = level === 5 ? baseBossHp - 4 : baseBossHp;
    if (level > 15) {
      const over = level - 15;
      tunedBossHp += Math.floor(over * 18 + over * over * 1.6);
    }
    return {
      type,
      texture: usePentagon ? 'boss_pentagon' : 'boss_hexagon',
      tint: null,
      hp: Math.max(1, Math.floor(tunedBossHp * hpMult)),
      body: 'boss',
      baseVy: 0,
      baseVx: 0,
      isBoss: true,
      pattern: usePentagon ? 0 : 1,
    };
  }

  const base = {
    type,
    texture: 'enemy',
    tint: null,
    hp: scaleHealth(1, level, hpMult),
    body: 'circle',
    baseVx: randBetween(-20, 20),
    baseVy: randBetween(36, 58),
  };

  if (type === 'zigzag') {
    return {
      ...base,
      texture: 'enemy_zigzag',
      hp: scaleHealth(1, level, hpMult),
      baseVy: randBetween(56, 84),
      zigzagAmp: randBetween(95, 130),
      zigzagFreq: 4.4,
    };
  }

  if (type === 'tank') {
    return {
      ...base,
      texture: 'enemy_tank',
      hp: scaleHealth(2, level, 2.5 * hpMult),
      baseVx: randBetween(-8, 8),
      baseVy: randBetween(20, 34),
      shrapnelOnDeath: true,
    };
  }

  if (type === 'splitter') {
    return {
      ...base,
      texture: 'enemy_splitter',
      hp: scaleHealth(2, level, 1.3 * hpMult),
      splitOnDeath: true,
    };
  }

  if (type === 'splitterMini') {
    return {
      ...base,
      texture: 'enemy_splitter_mini',
      hp: 1, // Splitter minis are always fragile
      baseVy: randBetween(48, 80),
      baseVx: randBetween(-120, 120),
    };
  }

  if (type === 'teleporter') {
    return {
      ...base,
      texture: 'enemy_teleporter',
      hp: scaleHealth(1, level, 1.3 * hpMult),
      baseVx: randBetween(-15, 15),
      baseVy: randBetween(30, 45),
      teleportEveryMs: 3800,
    };
  }

  if (type === 'bomber') {
    return {
      ...base,
      texture: 'enemy_bomber',
      hp: scaleHealth(2, level, 1.4 * hpMult),
      baseVx: randBetween(-10, 10),
      baseVy: randBetween(28, 42),
      bomberExplosion: true,
    };
  }

  if (type === 'shooter') {
    return {
      ...base,
      texture: 'enemy_shooter',
      hp: scaleHealth(2, level, 1.25 * hpMult),
      baseVx: 0,
      baseVy: randBetween(24, 35),
      shootEveryMs: 2000,
      stopY: randBetween(120, 250),
    };
  }

  if (type === 'shieldBearer') {
    return {
      ...base,
      texture: 'enemy_shield_bearer',
      hp: scaleHealth(2, level, 1.15 * hpMult),
      shieldHp: 2,
    };
  }

  return base;
}
