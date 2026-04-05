import * as Phaser from 'phaser';

function randBetween(min, max) {
  return Phaser.Math.Between(min, max);
}

function scaleHealth(base, level, mult = 1) {
  const bonus = Math.floor(level * 0.25);
  return Math.max(1, Math.floor((base + bonus) * mult));
}

export function buildEnemyConfig(type, level) {
  if (type === 'boss') {
    const usePentagon = Math.floor(level / 5) % 2 === 1;
    return {
      type,
      texture: usePentagon ? 'boss_pentagon' : 'boss_hexagon',
      tint: null,
      hp: 35 + level * 6,
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
    hp: scaleHealth(1, level, 1),
    body: 'circle',
    baseVx: randBetween(-20, 20),
    baseVy: randBetween(36, 58),
  };

  if (type === 'zigzag') {
    return {
      ...base,
      texture: 'enemy_zigzag',
      hp: scaleHealth(1, level, 1),
      baseVy: randBetween(56, 84),
      zigzagAmp: randBetween(95, 130),
      zigzagFreq: 4.4,
    };
  }

  if (type === 'tank') {
    return {
      ...base,
      texture: 'enemy_tank',
      hp: scaleHealth(2, level, 2.5),
      baseVx: randBetween(-8, 8),
      baseVy: randBetween(20, 34),
      shrapnelOnDeath: true,
    };
  }

  if (type === 'splitter') {
    return {
      ...base,
      texture: 'enemy_splitter',
      hp: scaleHealth(2, level, 1.3),
      splitOnDeath: true,
    };
  }

  if (type === 'splitterMini') {
    return {
      ...base,
      texture: 'enemy_splitter_mini',
      hp: 1,
      baseVy: randBetween(48, 80),
      baseVx: randBetween(-120, 120),
    };
  }

  if (type === 'shooter') {
    return {
      ...base,
      texture: 'enemy_shooter',
      hp: scaleHealth(2, level, 1.25),
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
      hp: scaleHealth(2, level, 1.15),
      shieldHp: 2,
    };
  }

  return base;
}
