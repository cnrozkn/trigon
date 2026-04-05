import SoundEngine from './SoundEngine.js';
import { loadAudioSettings, saveAudioSettings } from '../utils/Storage.js';

export function createAudioFacade() {
  const sound = new SoundEngine(loadAudioSettings());

  const persist = () => saveAudioSettings(sound.getSettings());

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
    playHit() { sound.playHit(); },
    playCrit() { sound.playCrit(); },
    playEnemyDeath() { sound.playEnemyDeath(); },
    playBossDeath() { sound.playBossDeath(); },
    playShieldAbsorb() { sound.playShieldAbsorb(); },
    playLevelUp() { sound.playLevelUp(); },
    playGameOver() { sound.playGameOver(); },
    playUpgradeSelect() { sound.playUpgradeSelect(); },
    playReroll() { sound.playReroll(); },
    playBanish() { sound.playBanish(); },
    playKillStreakNote(streakIndex) { sound.playKillStreakNote(streakIndex); },
    playComboBreak() { sound.playComboBreak(); },
    playNearMissWhoosh() { sound.playNearMissWhoosh(); },
    playFeverStart() { sound.playFeverStart(); },
  };
}
