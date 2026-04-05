import { buildLevelWaveSet } from './WaveDefinitions.js';

const BREAK_MS = 2500;
const VISIBLE_SPAWN_TOP = 116;
const VISIBLE_SPAWN_SPREAD = 64;

export default class WaveManager {
  constructor(scene, handlers = {}) {
    this.scene = scene;
    this.handlers = handlers;
    this.level = 1;
    this.waves = [];
    this.waveIndex = -1;
    this.spawnQueue = [];
    this.nextSpawnAt = 0;
    this.breakUntil = 0;
    this.spawning = false;
    this.levelCompleted = false;
    this.spawnedInLevel = 0;
    this.totalInLevel = 0;
    this.paused = false;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  startLevel(level) {
    this.level = level;
    const def = buildLevelWaveSet(level);
    this.waves = def.waves;
    this.waveIndex = -1;
    this.spawnQueue = [];
    this.breakUntil = this.scene.time.now + 650;
    this.spawning = false;
    this.levelCompleted = false;
    this.spawnedInLevel = 0;
    this.totalInLevel = this.waves.reduce(
      (acc, wave) => acc + wave.enemies.reduce((sum, entry) => sum + entry.count, 0),
      0,
    );
    this.handlers.onLevelStart?.(this.getWaveContext());
  }

  getWaveContext() {
    return {
      level: this.level,
      waveIndex: this.waveIndex,
      totalWaves: this.waves.length,
      inBreak: this.breakUntil > this.scene.time.now,
      breakRemainingMs: Math.max(0, this.breakUntil - this.scene.time.now),
      progressRatio: this.getProgressRatio(),
    };
  }

  getProgressRatio() {
    if (this.totalInLevel <= 0) return 0;
    const alive = this.scene.getActiveEnemyCount?.() ?? 0;
    const done = Math.max(0, this.spawnedInLevel - alive);
    return Math.max(0, Math.min(1, done / this.totalInLevel));
  }

  update() {
    if (this.paused || this.levelCompleted) return;
    const now = this.scene.time.now;
    if (this.breakUntil > now) return;

    if (this.waveIndex < 0 || (!this.spawning && this.spawnQueue.length === 0)) {
      if (!this.tryAdvanceWave()) {
        this.tryFinishLevel();
      }
      return;
    }

    if (this.spawning && now >= this.nextSpawnAt) {
      const spawn = this.spawnQueue.shift();
      if (spawn) {
        this.handlers.onSpawn?.(spawn, this.currentWave());
        this.spawnedInLevel += 1;
        this.nextSpawnAt = now + (spawn.spawnDelay ?? 340);
      }
      if (this.spawnQueue.length === 0) this.spawning = false;
    }

    this.tryFinishWave();
  }

  currentWave() {
    return this.waves[this.waveIndex] || null;
  }

  tryAdvanceWave() {
    if (this.waveIndex >= this.waves.length - 1) return false;
    this.waveIndex += 1;
    const wave = this.currentWave();
    this.spawnQueue = this.makeSpawnQueue(wave);
    this.spawning = this.spawnQueue.length > 0;
    this.nextSpawnAt = this.scene.time.now + 120;
    this.handlers.onWaveStart?.(this.getWaveContext(), wave);
    return true;
  }

  makeSpawnQueue(wave) {
    const queue = [];
    const widthLeft = this.scene.playLeft + 24;
    const widthRight = this.scene.playRight - 24;
    const centerX = (widthLeft + widthRight) * 0.5;
    const spawnTop = Math.min(this.scene.scale.height * 0.36, VISIBLE_SPAWN_TOP);
    let seq = 0;
    wave.enemies.forEach((entry) => {
      for (let i = 0; i < entry.count; i += 1) {
        const base = {
          type: entry.type,
          spawnDelay: entry.spawnDelay,
          x: centerX,
          y: spawnTop + ((i + seq) % 3) * (VISIBLE_SPAWN_SPREAD / 2),
        };

        if (wave.spawnPattern === 'burst') {
          base.x = widthLeft + ((i + seq) % 9) * ((widthRight - widthLeft) / 8);
          base.spawnDelay = i === 0 ? 150 : 19;
        } else if (wave.spawnPattern === 'sides') {
          const isLeft = (i + seq) % 2 === 0;
          base.x = isLeft ? widthLeft : widthRight;
          base.y = spawnTop + ((i + seq) % 3) * 16;
          base.vx = isLeft ? 58 : -58;
        } else if (wave.spawnPattern === 'v_formation') {
          const side = i % 2 === 0 ? -1 : 1;
          const rank = Math.floor(i / 2);
          base.x = centerX + side * rank * 34;
          base.y = spawnTop + rank * 12;
        } else {
          base.x = widthLeft + Math.random() * (widthRight - widthLeft);
          base.y = spawnTop + Math.random() * VISIBLE_SPAWN_SPREAD;
        }

        queue.push(base);
      }
      seq += entry.count;
    });
    return queue;
  }

  tryFinishWave() {
    if (this.spawning || this.spawnQueue.length > 0) return;
    if ((this.scene.getActiveEnemyCount?.() ?? 0) > 0) return;
    if ((this.scene.getActiveEnemyBulletCount?.() ?? 0) > 0) return;
    this.handlers.onWaveClear?.(this.getWaveContext(), this.currentWave());
    if (this.waveIndex < this.waves.length - 1) {
      this.breakUntil = this.scene.time.now + BREAK_MS;
    }
  }

  tryFinishLevel() {
    if (this.waveIndex < this.waves.length - 1) return;
    if ((this.scene.getActiveEnemyCount?.() ?? 0) > 0) return;
    if ((this.scene.getActiveEnemyBulletCount?.() ?? 0) > 0) return;
    this.levelCompleted = true;
    this.handlers.onLevelClear?.(this.getWaveContext());
  }
}
