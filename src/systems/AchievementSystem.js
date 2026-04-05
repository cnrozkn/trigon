/**
 * Trigon Achievement System
 * Defines all unlockable achievements and their criteria.
 */

export const ACHIEVEMENTS = [
  {
    id: 'first_kill',
    name: 'First Blood',
    desc: 'Destroy your first enemy.',
    icon: '🎯',
    check: (run, profile) => (profile.totalKills || 0) + (run?.runKills || 0) >= 1,
  },
  {
    id: 'survivor_10',
    name: 'Survivor',
    desc: 'Reach Level 10 in a single run.',
    icon: '🛡️',
    check: (run) => (run?.level || 0) >= 10,
  },
  {
    id: 'rich_1000',
    name: 'Wealthy',
    desc: 'Accumulate 1000 total coins.',
    icon: '💰',
    check: (_run, profile) => (profile.coins || 0) >= 1000,
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    desc: 'Reach a x10 combo streak.',
    icon: '🔥',
    check: (run) => (run?.maxCombo || 0) >= 10,
  },
  {
    id: 'fever_fan',
    name: 'Fever Dream',
    desc: 'Activate Fever Mode for the first time.',
    icon: '⚡',
    check: (run) => (run?.feverActivated || false),
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    desc: 'Clear a level without taking damage.',
    icon: '💎',
    check: (run) => (run?.perfectLevels || 0) >= 1,
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
