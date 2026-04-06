export const UPGRADE_MAX = {
  fire: 6,
  damage: 5,
  shield: 5,
  triangle: 6, // imported MAX_PLAYER_COUNT initially, using literal to avoid loop if possible. 6 is MAX_PLAYER_COUNT
  pierce: 3,
  multi: 2,
  crit: 4,
  frost: 3,
  synergy_frost_nova: 1,
  synergy_plasma_beam: 1,
  synergy_explosive_armor: 1,
};

export const SYNERGY_DEFS = [
  { key: 'synergy_frost_nova', label: 'Frost Nova', desc: 'Max Frost + Multi', rarity: 'Legendary', weight: 8, color: 0xaaccff, requires: { frost: 3, multi: 2 } },
  { key: 'synergy_plasma_beam', label: 'Plasma Beam', desc: 'Max Fire + Crit', rarity: 'Legendary', weight: 8, color: 0xff44aa, requires: { fire: 6, crit: 4 } },
  { key: 'synergy_explosive_armor', label: 'Explosive Armor', desc: 'Max Shield + DMG', rarity: 'Legendary', weight: 8, color: 0xffaa22, requires: { shield: 5, damage: 5 } },
];

export const UPGRADE_DEFS = [
  { key: 'fire', label: 'Rapid Fire', desc: '+Fire rate', rarity: 'Common', weight: 6, color: 0x22cc88 },
  { key: 'damage', label: 'Heavy Rounds', desc: '+Bullet damage', rarity: 'Common', weight: 6, color: 0xcc8822 },
  { key: 'shield', label: 'Shield Core', desc: '+1 shield charge', rarity: 'Common', weight: 6, color: 0x4488ff },
  { key: 'triangle', label: 'Tri-Fleet', desc: '+1 triangle', rarity: 'Rare', weight: 3, color: 0x55aaff },
  { key: 'pierce', label: 'Piercing Shots', desc: '+bullet pierce', rarity: 'Rare', weight: 3, color: 0xffcc66 },
  { key: 'multi', label: 'Multi Shot', desc: 'Add side bullets', rarity: 'Rare', weight: 3, color: 0xff66cc },
  { key: 'crit', label: 'Critical Core', desc: '+crit chance', rarity: 'Rare', weight: 3, color: 0xff9966 },
  { key: 'frost', label: 'Frost Rounds', desc: 'Hit can slow enemy', rarity: 'Epic', weight: 1, color: 0x66e6ff },
];

export const ENDLESS_UPGRADE_DEFS = [
  { key: 'endlessOverclock', label: 'Overclock Loop', desc: 'Slightly faster fire rate', rarity: 'Rare', weight: 2, color: 0x44ddaa, repeatable: true },
  { key: 'endlessBounty', label: 'Bounty Protocol', desc: 'Small permanent score gain', rarity: 'Common', weight: 5, color: 0xffd36a, repeatable: true },
  { key: 'endlessCloseCall', label: 'Close Call Engine', desc: 'Near-miss rewards improve', rarity: 'Epic', weight: 2, color: 0xff99cc, repeatable: true },
];

export const COSMETIC_COLORS = {
  pink: 0xff66cc,
  lime: 0x66ff66,
  gold: 0xffd700,
};

export function playerTintForLevel(level, cosmeticId) {
  if (cosmeticId && cosmeticId !== 'default' && COSMETIC_COLORS[cosmeticId]) {
    return COSMETIC_COLORS[cosmeticId];
  }
  if (level < 5) return 0xffffff;
  if (level < 10) return 0x00ff88;
  if (level < 15) return 0x00ffff;
  return 0xff66cc;
}

export function enemyColorForLevel(level) {
  if (level < 5) return 0xff66aa;
  if (level < 10) return 0xff8877;
  if (level < 15) return 0xffaa55;
  return 0xff4444;
}

export function enemySpeedMultiplier(level) {
  return 0.8 + 2.2 / (1 + Math.exp(-0.25 * (level - 8)));
}

export function regularEnemySpeedMultiplier(level) {
  if (level <= 2) return 1;
  if (level <= 6) return 1 + (level - 2) * 0.052;
  if (level <= 12) return 1.208 + (level - 6) * 0.043;
  if (level <= 15) return 1.48 + (level - 12) * 0.05;
  return Math.min(2.45, 1.63 + (level - 15) * 0.075);
}

export function backgroundToneForLevel(level) {
  if (level < 5) return 0x0a1022;
  if (level < 10) return 0x1a0d2a;
  if (level < 15) return 0x2a1018;
  return 0x2a1d08;
}
