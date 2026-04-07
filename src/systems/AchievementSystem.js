/**
 * Trigon Achievement System
 * Defines all unlockable achievements and their criteria.
 */

export const ACHIEVEMENTS = [
  // ── Combat ─────────────────────────────────────────────
  {
    id: 'first_kill',
    name: 'First Blood',
    desc: 'Destroy your first enemy.',
    icon: '🎯',
    reward: 50,
    check: (run, profile) => (profile.totalKills || 0) + (run?.runKills || 0) >= 1,
  },
  {
    id: 'kills_100',
    name: 'Centurion',
    desc: 'Destroy 100 enemies across all runs.',
    icon: '💀',
    reward: 150,
    check: (_run, profile) => (profile.totalKills || 0) >= 100,
  },
  {
    id: 'kills_1000',
    name: 'Void Reaper',
    desc: 'Destroy 1 000 enemies across all runs.',
    icon: '☠️',
    reward: 500,
    check: (_run, profile) => (profile.totalKills || 0) >= 1000,
  },
  {
    id: 'boss_slayer',
    name: 'Boss Slayer',
    desc: 'Defeat a boss enemy.',
    icon: '👾',
    reward: 200,
    check: (run) => (run?.bossKills || 0) >= 1,
  },
  {
    id: 'boss_veteran',
    name: 'Boss Veteran',
    desc: 'Defeat 10 bosses across all runs.',
    icon: '🏆',
    reward: 600,
    check: (_run, profile) => (profile.totalBossKills || 0) >= 10,
  },

  // ── Combos & Fever ─────────────────────────────────────
  {
    id: 'combo_master',
    name: 'Combo Master',
    desc: 'Reach a ×10 kill streak.',
    icon: '🔥',
    reward: 100,
    check: (run) => (run?.maxCombo || 0) >= 10,
  },
  {
    id: 'combo_god',
    name: 'Combo God',
    desc: 'Reach a ×25 kill streak.',
    icon: '🌋',
    reward: 350,
    check: (run) => (run?.maxCombo || 0) >= 25,
  },
  {
    id: 'fever_fan',
    name: 'Fever Dream',
    desc: 'Activate Fever Mode for the first time.',
    icon: '⚡',
    reward: 75,
    check: (run) => (run?.feverActivated || false),
  },
  {
    id: 'fever_addict',
    name: 'Fever Addict',
    desc: 'Activate Fever Mode 3 times in one run.',
    icon: '🌡️',
    reward: 200,
    check: (run) => (run?.feverCount || 0) >= 3,
  },

  // ── Survival ───────────────────────────────────────────
  {
    id: 'survivor_10',
    name: 'Survivor',
    desc: 'Reach Level 10 in a single run.',
    icon: '🛡️',
    reward: 100,
    check: (run) => (run?.level || 0) >= 10,
  },
  {
    id: 'sector_2',
    name: 'Magnetic Voyager',
    desc: 'Reach Level 11 (Sector 2).',
    icon: '🧲',
    reward: 150,
    check: (run) => (run?.level || 0) >= 11,
  },
  {
    id: 'sector_3',
    name: 'Gravity Master',
    desc: 'Reach Level 21 (Sector 3).',
    icon: '🌌',
    reward: 400,
    check: (run) => (run?.level || 0) >= 21,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    desc: 'Clear a level without taking any damage.',
    icon: '💎',
    reward: 125,
    check: (run) => (run?.perfectLevels || 0) >= 1,
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    desc: 'Clear 5 levels without taking damage in one run.',
    icon: '🔮',
    reward: 450,
    check: (run) => (run?.perfectLevels || 0) >= 5,
  },

  // ── Overdrive ──────────────────────────────────────────
  {
    id: 'overdrive_user',
    name: 'Overcharged',
    desc: 'Trigger Overdrive for the first time.',
    icon: '⚡',
    reward: 75,
    check: (run) => (run?.overdriveUses || 0) >= 1,
  },
  {
    id: 'overdrive_veteran',
    name: 'Overdrive Veteran',
    desc: 'Trigger Overdrive 5 times in one run.',
    icon: '🔋',
    reward: 250,
    check: (run) => (run?.overdriveUses || 0) >= 5,
  },

  // ── Economy ────────────────────────────────────────────
  {
    id: 'rich_1000',
    name: 'Wealthy',
    desc: 'Accumulate 1 000 total coins.',
    icon: '💰',
    reward: 100,
    check: (_run, profile) => (profile.coins || 0) >= 1000,
  },
  {
    id: 'rich_10000',
    name: 'Tycoon',
    desc: 'Accumulate 10 000 total coins.',
    icon: '💎',
    reward: 300,
    check: (_run, profile) => (profile.coins || 0) >= 10000,
  },
  {
    id: 'coin_run',
    name: 'Gold Rush',
    desc: 'Collect 500 coins in a single run.',
    icon: '⬡',
    reward: 200,
    check: (run) => (run?.coinsCollected || 0) >= 500,
  },

  // ── Meta ───────────────────────────────────────────────
  {
    id: 'veteran_10',
    name: 'Veteran',
    desc: 'Complete 10 runs.',
    icon: '🎖️',
    reward: 150,
    check: (_run, profile) => (profile.totalGamesPlayed || 0) >= 10,
  },
  {
    id: 'veteran_50',
    name: 'Elite',
    desc: 'Complete 50 runs.',
    icon: '🏅',
    reward: 500,
    check: (_run, profile) => (profile.totalGamesPlayed || 0) >= 50,
  },
  {
    id: 'ship_collector',
    name: 'Fleet Admiral',
    desc: 'Own all 4 ship classes.',
    icon: '🚀',
    reward: 400,
    check: (_run, profile) => (profile.ownedShips?.length || 0) >= 4,
  },
];

/**
 * Checks if any NEW achievements can be unlocked based on current state.
 * Returns an array of newly unlocked achievement IDs.
 */
export function checkNewAchievements(run, profile) {
  const currentIds = new Set(profile.achievements || []);
  const newlyUnlocked = [];

  ACHIEVEMENTS.forEach((ach) => {
    if (!currentIds.has(ach.id)) {
      if (ach.check(run, profile)) {
        newlyUnlocked.push(ach.id);
      }
    }
  });

  return newlyUnlocked;
}
