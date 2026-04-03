import SoundEngine from './SoundEngine.js';
import MusicEngine from './MusicEngine.js';
import { loadAudioSettings, saveAudioSettings } from '../utils/Storage.js';

export function createAudioFacade() {
  const sound = new SoundEngine(loadAudioSettings());
  const music = new MusicEngine(sound);

  const persist = () => saveAudioSettings(sound.getSettings());

  return {
    async resume() {
      const ok = await sound.resumeIfNeeded();
      if (ok) music.start();
      return ok;
    },
    destroy() {
      music.stop();
    },
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
    setMusicVolume(v) {
      sound.setMusicVolume(v);
      persist();
    },
    setMuted(v) {
      sound.setMuted(v);
      persist();
    },
    // scene state
    setSceneState(state) {
      music.setState(state);
    },
    stopMusic() {
      music.stop();
    },
    startMusic() {
      music.start();
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
  };
}
