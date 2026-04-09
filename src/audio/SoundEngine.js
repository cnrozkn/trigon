import { getDefaultAudioSettings } from '../utils/Storage.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export default class SoundEngine {
  constructor(settings = getDefaultAudioSettings()) {
    this.settings = {
      masterVolume: clamp01(settings.masterVolume ?? 0.9),
      sfxVolume: clamp01(settings.sfxVolume ?? 0.85),
      muted: Boolean(settings.muted),
    };
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.activeSfxSources = new Set();
  }

  ensureContext() {
    if (this.context) return this.context;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.context = new Ctx();

    this.masterGain = this.context.createGain();
    this.sfxGain = this.context.createGain();

    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    this.noiseBuffer = this.createNoiseBuffer();
    this.applySettingsToGraph();
    return this.context;
  }

  createNoiseBuffer() {
    if (!this.context) return null;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 1.2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  async resumeIfNeeded() {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    try {
      await ctx.resume();
      return ctx.state === 'running';
    } catch (_err) {
      return false;
    }
  }

  /** DOM tap handler: call synchronously inside pointer/touch (no await before this). */
  unlockSyncFromUserGesture() {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    try {
      // iOS WKWebView requires playing an actual (silent) buffer to unlock AudioContext,
      // not just calling resume(). This is the standard iOS audio unlock technique.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      void ctx.resume();
      return true;
    } catch (_err) {
      return false;
    }
  }

  getContext() {
    return this.ensureContext();
  }

  applySettingsToGraph() {
    if (!this.masterGain || !this.sfxGain) return;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.value = master;
    this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  getSettings() {
    return { ...this.settings };
  }

  setMasterVolume(volume) {
    this.settings.masterVolume = clamp01(volume);
    this.applySettingsToGraph();
  }

  setSfxVolume(volume) {
    this.settings.sfxVolume = clamp01(volume);
    this.applySettingsToGraph();
  }

  setMuted(muted) {
    this.settings.muted = Boolean(muted);
    this.applySettingsToGraph();
  }

  playOsc({
    type = 'sine',
    frequency = 440,
    durationMs = 100,
    gain = 0.2,
    attackMs = 2,
    releaseMs = 80,
    detune = 0,
    filter = null,
  }) {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running' || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;

    const amp = ctx.createGain();
    const now = ctx.currentTime;
    const attack = Math.max(0.001, attackMs / 1000);
    const total = Math.max(0.012, durationMs / 1000);
    const releaseStart = now + Math.max(0.001, total - releaseMs / 1000);
    const stopAt = now + total + 0.02;

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(Math.max(0.0001, gain), now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, Math.max(now + attack + 0.001, releaseStart));

    if (filter) {
      const biq = ctx.createBiquadFilter();
      biq.type = filter.type || 'lowpass';
      biq.frequency.value = filter.frequency || 1200;
      biq.Q.value = filter.q || 0.8;
      osc.connect(biq);
      biq.connect(amp);
    } else {
      osc.connect(amp);
    }
    amp.connect(this.sfxGain);

    this.trackSfxSource(osc);
    osc.start(now);
    osc.stop(stopAt);
  }

  playNoise({
    durationMs = 80,
    gain = 0.12,
    filter = { type: 'highpass', frequency: 1200, q: 0.7 },
  }) {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running' || !this.noiseBuffer || !this.sfxGain) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const biq = ctx.createBiquadFilter();
    biq.type = filter.type || 'highpass';
    biq.frequency.value = filter.frequency || 1000;
    biq.Q.value = filter.q || 0.7;

    const amp = ctx.createGain();
    const now = ctx.currentTime;
    const total = Math.max(0.01, durationMs / 1000);
    amp.gain.setValueAtTime(Math.max(0.0001, gain), now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + total);

    src.connect(biq);
    biq.connect(amp);
    amp.connect(this.sfxGain);

    this.trackSfxSource(src);
    src.start(now);
    src.stop(now + total + 0.01);
  }

  trackSfxSource(sourceNode) {
    this.activeSfxSources.add(sourceNode);
    const prevEnded = sourceNode.onended;
    sourceNode.onended = (...args) => {
      this.activeSfxSources.delete(sourceNode);
      if (typeof prevEnded === 'function') prevEnded.apply(sourceNode, args);
    };
  }

  stopAllSfx() {
    this.activeSfxSources.forEach((source) => {
      try {
        source.stop();
      } catch (_err) {
        // source may already be stopped
      }
    });
    this.activeSfxSources.clear();
  }

  // ----- SFX events -----
  playFire() {
    this.playNoise({ durationMs: 50, gain: 0.06, filter: { type: 'highpass', frequency: 2200, q: 0.7 } });
    this.playOsc({ type: 'triangle', frequency: 760, durationMs: 45, gain: 0.045, releaseMs: 38 });
  }

  playHit() {
    this.playOsc({ type: 'triangle', frequency: 170, durationMs: 80, gain: 0.08, releaseMs: 70 });
    this.playNoise({ durationMs: 70, gain: 0.03, filter: { type: 'bandpass', frequency: 900, q: 1.1 } });
  }

  playCrit() {
    this.playOsc({ type: 'square', frequency: 1280, durationMs: 100, gain: 0.09, releaseMs: 90 });
    this.playOsc({ type: 'triangle', frequency: 1680, durationMs: 95, gain: 0.06, releaseMs: 85, detune: 5 });
  }

  playEnemyDeath() {
    this.playNoise({ durationMs: 150, gain: 0.11, filter: { type: 'bandpass', frequency: 980, q: 1.2 } });
    this.playOsc({ type: 'square', frequency: 210, durationMs: 110, gain: 0.085, releaseMs: 96 });
    this.playOsc({ type: 'triangle', frequency: 132, durationMs: 135, gain: 0.07, releaseMs: 120 });
  }

  playBossDeath() {
    this.playNoise({ durationMs: 420, gain: 0.16, filter: { type: 'lowpass', frequency: 760, q: 0.7 } });
    this.playOsc({ type: 'sawtooth', frequency: 90, durationMs: 520, gain: 0.16, releaseMs: 450 });
    this.playOsc({ type: 'square', frequency: 124, durationMs: 280, gain: 0.09, releaseMs: 240 });
  }

  playShieldAbsorb() {
    this.playOsc({ type: 'sine', frequency: 720, durationMs: 150, gain: 0.07, releaseMs: 140 });
    this.playOsc({ type: 'sine', frequency: 980, durationMs: 120, gain: 0.045, releaseMs: 110 });
  }

  playLevelUp() {
    this.playOsc({ type: 'triangle', frequency: 523.25, durationMs: 100, gain: 0.05 });
    this.playOsc({ type: 'triangle', frequency: 659.25, durationMs: 130, gain: 0.05 });
    this.playOsc({ type: 'triangle', frequency: 783.99, durationMs: 170, gain: 0.05 });
  }

  playGameOver() {
    this.playOsc({ type: 'sawtooth', frequency: 320, durationMs: 800, gain: 0.12, releaseMs: 740 });
    this.playNoise({ durationMs: 500, gain: 0.05, filter: { type: 'lowpass', frequency: 700, q: 0.8 } });
  }

  playUpgradeSelect() {
    this.playOsc({ type: 'square', frequency: 920, durationMs: 60, gain: 0.06, releaseMs: 55 });
    this.playOsc({ type: 'square', frequency: 1220, durationMs: 80, gain: 0.05, releaseMs: 75 });
  }

  playReroll() {
    this.playNoise({ durationMs: 200, gain: 0.08, filter: { type: 'bandpass', frequency: 1200, q: 0.9 } });
  }

  playBanish() {
    this.playNoise({ durationMs: 250, gain: 0.07, filter: { type: 'highpass', frequency: 800, q: 0.7 } });
    this.playOsc({ type: 'triangle', frequency: 420, durationMs: 180, gain: 0.03, releaseMs: 170 });
  }

  playKillStreakNote(streakIndex) {
    const tones = [440, 523.25, 587.33, 659.25, 783.99, 880];
    const idx = Math.max(0, (streakIndex - 1) % tones.length);
    this.playOsc({ type: 'triangle', frequency: tones[idx], durationMs: 95, gain: 0.05, releaseMs: 80 });
  }

  playComboBreak() {
    this.playNoise({ durationMs: 180, gain: 0.09, filter: { type: 'lowpass', frequency: 760, q: 0.7 } });
    this.playOsc({ type: 'sawtooth', frequency: 210, durationMs: 180, gain: 0.06, releaseMs: 165 });
  }

  playNearMissWhoosh() {
    this.playNoise({ durationMs: 90, gain: 0.06, filter: { type: 'bandpass', frequency: 1900, q: 1.1 } });
    this.playOsc({ type: 'triangle', frequency: 970, durationMs: 80, gain: 0.035, releaseMs: 70 });
  }

  playFeverStart() {
    this.playOsc({ type: 'square', frequency: 523.25, durationMs: 120, gain: 0.08, releaseMs: 100 });
    this.playOsc({ type: 'square', frequency: 659.25, durationMs: 150, gain: 0.08, releaseMs: 130 });
    this.playOsc({ type: 'triangle', frequency: 880, durationMs: 210, gain: 0.07, releaseMs: 190 });
  }
}
