const AUDIO_SETTINGS_KEY = 'trigon.audio.settings.v1';
const GAME_PROFILE_KEY = 'trigon.game.profile.v1';

const DEFAULT_AUDIO_SETTINGS = {
  masterVolume: 0.9,
  sfxVolume: 0.85,
  muted: false,
  hapticEnabled: true,
};

const DEFAULT_GAME_PROFILE = {
  highScore: 0,
  bestLevel: 1,
  totalGamesPlayed: 0,
  totalKills: 0,
  totalPlayTimeMs: 0,
  coins: 0,
  upgrades: {
    baseDamage: 0,
    baseSpeed: 0,
    extraReroll: 0,
    baseShield: 0,
    coinMultiplier: 0,
    nearMissRange: 0,
  },
  cosmetics: {
    playerColor: 'default',
    bulletTrail: 'default',
    deathParticles: 'default',
  },
  achievements: [],
  claimedAchievementRewards: [],
  ownedShips: ['striker'],
  selectedShip: 'striker',
};

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function safeNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function safeReadJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function safeWriteJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_err) {
    // Ignore storage quota or private-mode errors.
  }
}

export function getDefaultAudioSettings() {
  return { ...DEFAULT_AUDIO_SETTINGS };
}

export function getDefaultGameProfile() {
  return { ...DEFAULT_GAME_PROFILE };
}

export function loadAudioSettings() {
  const parsed = safeReadJson(AUDIO_SETTINGS_KEY);
  if (!parsed) return getDefaultAudioSettings();

  return {
    masterVolume: clamp01(parsed.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    muted: Boolean(parsed.muted),
    hapticEnabled: parsed.hapticEnabled !== false,
  };
}

export function saveAudioSettings(settings) {
  const safe = {
    masterVolume: clamp01(settings.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    sfxVolume: clamp01(settings.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    muted: Boolean(settings.muted),
    hapticEnabled: settings.hapticEnabled !== false,
  };
  safeWriteJson(AUDIO_SETTINGS_KEY, safe);
}

export function loadGameProfile() {
  const parsed = safeReadJson(GAME_PROFILE_KEY);
  if (!parsed) return getDefaultGameProfile();

  return {
    highScore: safeNonNegativeInt(parsed.highScore, DEFAULT_GAME_PROFILE.highScore),
    bestLevel: Math.max(1, safeNonNegativeInt(parsed.bestLevel, DEFAULT_GAME_PROFILE.bestLevel)),
    totalGamesPlayed: safeNonNegativeInt(parsed.totalGamesPlayed, DEFAULT_GAME_PROFILE.totalGamesPlayed),
    totalKills: safeNonNegativeInt(parsed.totalKills, DEFAULT_GAME_PROFILE.totalKills),
    totalPlayTimeMs: safeNonNegativeInt(parsed.totalPlayTimeMs, DEFAULT_GAME_PROFILE.totalPlayTimeMs),
    coins: safeNonNegativeInt(parsed.coins, DEFAULT_GAME_PROFILE.coins),
    upgrades: { ...DEFAULT_GAME_PROFILE.upgrades, ...(parsed.upgrades || {}) },
    cosmetics: { ...DEFAULT_GAME_PROFILE.cosmetics, ...(parsed.cosmetics || {}) },
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    claimedAchievementRewards: Array.isArray(parsed.claimedAchievementRewards) ? parsed.claimedAchievementRewards : [],
    ownedShips: Array.isArray(parsed.ownedShips) ? parsed.ownedShips : ['striker'],
    selectedShip: parsed.selectedShip || 'striker',
  };
}

export function saveGameProfile(profile) {
  const safe = {
    highScore: safeNonNegativeInt(profile.highScore, DEFAULT_GAME_PROFILE.highScore),
    bestLevel: Math.max(1, safeNonNegativeInt(profile.bestLevel, DEFAULT_GAME_PROFILE.bestLevel)),
    totalGamesPlayed: safeNonNegativeInt(profile.totalGamesPlayed, DEFAULT_GAME_PROFILE.totalGamesPlayed),
    totalKills: safeNonNegativeInt(profile.totalKills, DEFAULT_GAME_PROFILE.totalKills),
    totalPlayTimeMs: safeNonNegativeInt(profile.totalPlayTimeMs, DEFAULT_GAME_PROFILE.totalPlayTimeMs),
    coins: safeNonNegativeInt(profile.coins, DEFAULT_GAME_PROFILE.coins),
    upgrades: { ...DEFAULT_GAME_PROFILE.upgrades, ...(profile.upgrades || {}) },
    cosmetics: { ...DEFAULT_GAME_PROFILE.cosmetics, ...(profile.cosmetics || {}) },
    achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    claimedAchievementRewards: Array.isArray(profile.claimedAchievementRewards) ? profile.claimedAchievementRewards : [],
    ownedShips: Array.isArray(profile.ownedShips) ? profile.ownedShips : ['striker'],
    selectedShip: profile.selectedShip || 'striker',
  };
  safeWriteJson(GAME_PROFILE_KEY, safe);
}
