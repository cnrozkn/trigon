import * as Phaser from 'phaser';
import { advanceBuffRemainingMs, extendBuffRemainingMs } from './buffTimers.js';

const BASE_DROP_CHANCE = 0.08;
const MAX_DROP_CHANCE = 0.18;
const BASE_PIERCE_MS = 5000;
const BASE_SLOW_MS = 4000;
const STUCK_CHECK_EPS = 0.35;
const STUCK_NUDGE_MS = 700;
const STUCK_RECYCLE_MS = 1800;

export default class PowerupSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.pierceRemainingMs = 0;
    this.slowRemainingMs = 0;
    this.lastBuffTickAt = 0;
    this.pierceMaxMs = BASE_PIERCE_MS;
    this.slowMaxMs = BASE_SLOW_MS;
    this.slowStrength = 0.5;
  }

  create() {
    this.group = this.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.scene.physics.add.overlap(this.scene.players, this.group, (_player, pickup) => {
      if (!pickup.active) return;
      const type = pickup.getData('powerupType');
      this.collect(type, pickup);
    });
  }

  update(now, { timersPaused = false } = {}) {
    if (!this.group) return;
    if (this.lastBuffTickAt === 0) this.lastBuffTickAt = now;
    const deltaMs = Math.max(0, now - this.lastBuffTickAt);
    this.lastBuffTickAt = now;
    const minX = this.scene.playLeft + 14;
    const maxX = this.scene.playRight - 14;
    this.group.children.iterate((pickup) => {
      if (!pickup || !pickup.active) return true;
      pickup.angle += 1.5;
      if (pickup.x < minX) {
        pickup.x = minX;
        pickup.body.setVelocityX(Math.abs(pickup.body.velocity.x) * 0.55 + 8);
      } else if (pickup.x > maxX) {
        pickup.x = maxX;
        pickup.body.setVelocityX(-Math.abs(pickup.body.velocity.x) * 0.55 - 8);
      }

      const prevX = pickup.getData('lastX') ?? pickup.x;
      const prevY = pickup.getData('lastY') ?? pickup.y;
      const moved = Math.abs(pickup.x - prevX) + Math.abs(pickup.y - prevY);
      let stuckSince = pickup.getData('stuckSince') ?? now;

      if (moved <= STUCK_CHECK_EPS) {
        if (now - stuckSince >= STUCK_RECYCLE_MS) {
          this.recycle(pickup);
          return true;
        }
        if (now - stuckSince >= STUCK_NUDGE_MS) {
          pickup.body.setVelocity(
            Phaser.Math.Between(-18, 18),
            Phaser.Math.Between(34, 44),
          );
          stuckSince = now;
        }
      } else {
        stuckSince = now;
      }
      pickup.setData('stuckSince', stuckSince);
      pickup.setData('lastX', pickup.x);
      pickup.setData('lastY', pickup.y);

      if (pickup.y > this.scene.scale.height + 60 || pickup.y < -120) this.recycle(pickup);
      return true;
    });
    this.pierceRemainingMs = advanceBuffRemainingMs({
      remainingMs: this.pierceRemainingMs,
      deltaMs,
      timersPaused,
    });
    this.slowRemainingMs = advanceBuffRemainingMs({
      remainingMs: this.slowRemainingMs,
      deltaMs,
      timersPaused,
    });
    if (this.slowRemainingMs <= 0) {
      this.slowStrength = 0.5;
      this.slowMaxMs = BASE_SLOW_MS;
    }
  }

  getDropChanceForLevel(level) {
    const earlyRamp = Math.max(0, Math.min(level - 4, 8)) * 0.0035;
    const latePenalty = Math.max(0, level - 14) * 0.0065;
    return Phaser.Math.Clamp(BASE_DROP_CHANCE + earlyRamp - latePenalty, 0.035, MAX_DROP_CHANCE);
  }

  pickDropTypeForLevel(level) {
    const shieldWeight = level >= 15 ? 6 : level >= 9 ? 4 : 4;
    const pierceWeight = level >= 15 ? 2 : level >= 8 ? 4 : 3;
    const slowWeight = level >= 15 ? 2 : level >= 8 ? 4 : 3;
    const total = shieldWeight + pierceWeight + slowWeight;
    let roll = Math.random() * total;
    if (roll < shieldWeight) return 'shield';
    roll -= shieldWeight;
    if (roll < pierceWeight) return 'pierce';
    return 'slow';
  }

  maybeDropAt(x, y) {
    if (!this.group) return false;
    const level = this.scene.currentLevel || 1;
    if (Math.random() > this.getDropChanceForLevel(level)) return false;
    const type = this.pickDropTypeForLevel(level);
    this.spawn(type, x, y);
    return true;
  }

  spawn(type, x, y) {
    if (!this.group) return;
    const key = `powerup_${type}`;
    const pickup = this.group.get(x, y, key);
    if (!pickup) return;
    // Re-enable pooled bodies explicitly; otherwise reused pickups can appear frozen.
    pickup.enableBody(true, x, y, true, true);
    pickup.body.setAllowGravity(false);
    pickup.body.reset(x, y);
    pickup.body.setVelocity(Phaser.Math.Between(-24, 24), Phaser.Math.Between(30, 40));
    pickup.setCollideWorldBounds(false);
    pickup.setDepth(6);
    pickup.setData('powerupType', type);
    pickup.setCircle(12, 6, 6);
    pickup.setAlpha(0.95);
    pickup.setData('lastX', x);
    pickup.setData('lastY', y);
    pickup.setData('stuckSince', this.scene.time.now);
  }

  collect(type, pickup) {
    const level = this.scene.currentLevel || 1;
    if (type === 'shield') {
      const gain = 1;
      const before = this.scene.shieldCharges;
      this.scene.shieldCharges = Math.min(5, this.scene.shieldCharges + gain);
      if (this.scene.shieldCharges > before) {
        this.scene.showFloatingText(`SHIELD +${this.scene.shieldCharges - before}`, pickup.x, pickup.y, { color: '#7fc4ff', size: 14, duration: 520 });
      } else {
        const bonus = Math.round(12 + level * 1.6);
        this.scene.addScaledScore?.(bonus);
        this.scene.showFloatingText(`SHIELD FULL +${bonus}`, pickup.x, pickup.y, { color: '#9ed2ff', size: 13, duration: 520 });
      }
    } else if (type === 'pierce') {
      const duration = level > 15
        ? Math.round((BASE_PIERCE_MS + Math.max(0, Math.min(level - 8, 6)) * 120) * 0.62)
        : BASE_PIERCE_MS + Math.max(0, Math.min(level - 8, 6)) * 120;
      this.pierceMaxMs = duration;
      this.pierceRemainingMs = extendBuffRemainingMs({
        remainingMs: this.pierceRemainingMs,
        addedMs: duration,
      });
      this.scene.showFloatingText(`PIERCE ${Math.ceil(duration / 1000)}s`, pickup.x, pickup.y, { color: '#ffcf6e', size: 14, duration: 520 });
    } else if (type === 'slow') {
      const duration = level > 15
        ? Math.round((BASE_SLOW_MS + Math.max(0, Math.min(level - 8, 6)) * 100) * 0.6)
        : BASE_SLOW_MS + Math.max(0, Math.min(level - 8, 6)) * 100;
      const targetSlow = level > 15
        ? Phaser.Math.Clamp(0.56 + Math.max(0, level - 15) * 0.01, 0.56, 0.68)
        : Phaser.Math.Clamp(0.5 - Math.max(0, level - 10) * 0.008, 0.44, 0.5);
      this.slowStrength = targetSlow;
      this.slowMaxMs = duration;
      this.slowRemainingMs = extendBuffRemainingMs({
        remainingMs: this.slowRemainingMs,
        addedMs: duration,
      });
      this.scene.showFloatingText(`SLOW x${this.slowStrength.toFixed(2)} ${Math.ceil(duration / 1000)}s`, pickup.x, pickup.y, {
        color: '#89ffd0',
        size: 14,
        duration: 520,
      });
    }

    this.scene.audio?.playUpgradeSelect?.();
    this.scene.showPickupFlash?.();
    this.scene.updateHud();
    this.recycle(pickup);
  }

  recycle(pickup) {
    pickup.disableBody(true, true);
    this.group.killAndHide(pickup);
  }

  clearActivePickups() {
    if (!this.group) return;
    this.group.children.iterate((pickup) => {
      if (pickup && pickup.active) this.recycle(pickup);
      return true;
    });
  }

  hasPierceBuff() {
    return this.pierceRemainingMs > 0;
  }

  forceGlobalSlow(strength, durationMs) {
    this.slowStrength = strength;
    this.slowMaxMs = durationMs;
    this.slowRemainingMs = extendBuffRemainingMs({
      remainingMs: this.slowRemainingMs,
      addedMs: durationMs,
    });
  }

  getGlobalSlowMultiplier() {
    return this.slowRemainingMs > 0 ? this.slowStrength : 1;
  }

  getActiveBuffs() {
    const buffs = [];
    if (this.pierceRemainingMs > 0) buffs.push({ key: 'PIERCE', remainingMs: this.pierceRemainingMs, maxMs: this.pierceMaxMs });
    if (this.slowRemainingMs > 0) buffs.push({ key: 'SLOW', remainingMs: this.slowRemainingMs, maxMs: this.slowMaxMs });
    return buffs;
  }
}
