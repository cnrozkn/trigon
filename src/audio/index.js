import SoundEngine from './SoundEngine.js';
import { loadAudioSettings, saveAudioSettings } from '../utils/Storage.js';
import { HapticService } from '../platform/HapticService.js';

export function createAudioFacade() {
  const sound = new SoundEngine(loadAudioSettings());
  let _hapticEnabled = loadAudioSettings().hapticEnabled !== false;

  const haptic = (fn) => { if (_hapticEnabled) fn(); };

  const persist = () => {
    saveAudioSettings(sound.getSettings());
    _hapticEnabled = sound.getSettings().hapticEnabled !== false;
  };

  return {
    unlockSyncFromUserGesture() {
      return sound.unlockSyncFromUserGesture();
    },
    async resume() {
      return sound.resumeIfNeeded();
    },
    destroy() {},
    // settings
    getSettings() {
      return sound.getSettings();
    },
    setMasterVolume(v) {
      sound.setMasterVolume(v);
      persist();
    },
    setSfxVolume(v) {
      sound.setSfxVolume(v);
      persist();
    },
    setMuted(v) {
      sound.setMuted(v);
      persist();
    },
    stopAllSfx() {
      sound.stopAllSfx();
    },
    // semantic SFX events
    playFire() { sound.playFire(); },
    playHit() { sound.playHit(); haptic(() => HapticService.impact('LIGHT')); },
    playCrit() { sound.playCrit(); haptic(() => HapticService.impact('HEAVY')); },
    playEnemyDeath() { sound.playEnemyDeath(); haptic(() => HapticService.impact('MEDIUM')); },
    playBossDeath() { sound.playBossDeath(); haptic(() => HapticService.notification('SUCCESS')); },
    playShieldAbsorb() { sound.playShieldAbsorb(); haptic(() => HapticService.impact('HEAVY')); },
    playLevelUp() { sound.playLevelUp(); haptic(() => HapticService.notification('SUCCESS')); },
    playGameOver() { sound.playGameOver(); haptic(() => HapticService.notification('ERROR')); },
    playUpgradeSelect() { sound.playUpgradeSelect(); haptic(() => HapticService.impact('MEDIUM')); },
    playReroll() { sound.playReroll(); haptic(() => HapticService.impact('LIGHT')); },
    playBanish() { sound.playBanish(); haptic(() => HapticService.impact('MEDIUM')); },
    playKillStreakNote(streakIndex) { sound.playKillStreakNote(streakIndex); haptic(() => HapticService.impact('LIGHT')); },
    playComboBreak() { sound.playComboBreak(); haptic(() => HapticService.impact('HEAVY')); },
    playNearMissWhoosh() { sound.playNearMissWhoosh(); haptic(() => HapticService.impact('LIGHT')); },
    playFeverStart() { sound.playFeverStart(); haptic(() => HapticService.notification('WARNING')); },
  };
}
