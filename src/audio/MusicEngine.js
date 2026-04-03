const PENTATONIC_A_MINOR = [220, 261.63, 293.66, 329.63, 392];

export default class MusicEngine {
  constructor(soundEngine) {
    this.sound = soundEngine;
    this.running = false;
    this.step = 0;
    this.intervalId = null;
    this.tempoBpm = 126;
    this.level = 1;
    this.isBoss = false;
    this.inUpgrade = false;
  }

  setState({ level, isBoss, inUpgrade }) {
    if (Number.isFinite(level)) this.level = level;
    if (typeof isBoss === 'boolean') this.isBoss = isBoss;
    if (typeof inUpgrade === 'boolean') this.inUpgrade = inUpgrade;
    this.sound.setMusicDuck(this.inUpgrade ? 0.3 : 1, 160);
  }

  getIntensityTier() {
    if (this.isBoss) return 4;
    if (this.level >= 10) return 3;
    if (this.level >= 5) return 2;
    return 1;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.step = 0;
    const stepMs = (60_000 / this.tempoBpm) / 4; // 16th note
    this.intervalId = window.setInterval(() => this.tick(), stepMs);
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  tick() {
    if (!this.running) return;
    const tier = this.getIntensityTier();
    const s = this.step;

    // Ambient pad
    if (s % 8 === 0) {
      const root = PENTATONIC_A_MINOR[(Math.floor(s / 8) + tier) % PENTATONIC_A_MINOR.length];
      this.sound.playMusicNote(root * 0.5, 520, 0.08, 'sine');
      this.sound.playMusicNote(root, 440, 0.04, 'triangle');
    }

    // Bass line for tier 2+
    if (tier >= 2 && s % 4 === 0) {
      const bass = PENTATONIC_A_MINOR[(Math.floor(s / 4) + 1) % PENTATONIC_A_MINOR.length] * 0.5;
      this.sound.playMusicNote(bass, 180, 0.07, 'sine');
    }

    // Arp melody for tier 3+
    if (tier >= 3 && s % 2 === 0) {
      const note = PENTATONIC_A_MINOR[(s + 2) % PENTATONIC_A_MINOR.length] * (tier >= 4 ? 2 : 1);
      this.sound.playMusicNote(note, 120, tier >= 4 ? 0.08 : 0.055, 'triangle');
    }

    // Boss pulse/percussion substitute
    if (tier >= 4 && s % 4 === 2) {
      this.sound.playMusicNote(82.41, 95, 0.1, 'square');
    }

    this.step = (this.step + 1) % 64;
  }
}
