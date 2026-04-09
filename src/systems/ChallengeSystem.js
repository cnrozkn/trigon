/**
 * Trigonx Challenge System
 * Handles daily mutators and challenge run logic.
 */

const CHALLENGES = [
  {
    id: 'bullet_hell',
    name: 'Bullet Hell',
    desc: 'Enemies fire 2x faster, but earn 3x Coins!',
    mutators: { enemyFireRate: 2.0, coinMult: 3.0 }
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    desc: 'No shields allowed, but 4x Base Damage!',
    mutators: { noShields: true, damageMult: 4.0 }
  },
  {
    id: 'turbo',
    name: 'Turbo Mode',
    desc: 'Everything is 50% faster. 2x Score!',
    mutators: { globalSpeed: 1.5, scoreMult: 2.0 }
  },
  {
    id: 'pacifist_not',
    name: 'Aggressive Growth',
    desc: 'Enemies have 2x HP, but give 5x Score!',
    mutators: { enemyHp: 2.0, scoreMult: 5.0 }
  }
];

export function getTodayChallenge() {
  // Use current date as seed
  const today = new Date().toISOString().split('T')[0];
  const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);
  const index = seed % CHALLENGES.length;
  return { ...CHALLENGES[index], date: today };
}

export function isChallengeAttempted(profile) {
  const today = new Date().toISOString().split('T')[0];
  return profile.dailyChallenges?.lastPlayedDate === today;
}
