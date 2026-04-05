import * as Phaser from 'phaser';

const DROP_CHANCE = 0.08;
const PIERCE_MS = 5000;
const SLOW_MS = 4000;
const STUCK_CHECK_EPS = 0.35;
const STUCK_NUDGE_MS = 700;
const STUCK_RECYCLE_MS = 1800;

export default class PowerupSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.pierceUntil = 0;
    this.slowUntil = 0;
  }

  create() {
    this.group = this.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.scene.physics.add.overlap(this.scene.players, this.group, (_player, pickup) => {
      if (!pickup.active) return;
      const type = pickup.getData('powerupType');
      this.collect(type, pickup);
    });
  }

  update(now) {
    if (!this.group) return;
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
    if (this.pierceUntil < now) this.pierceUntil = 0;
    if (this.slowUntil < now) this.slowUntil = 0;
  }

  maybeDropAt(x, y) {
    if (Math.random() > DROP_CHANCE || !this.group) return false;
    const roll = Math.random();
    let type = 'shield';
    if (roll > 0.66) type = 'slow';
    else if (roll > 0.33) type = 'pierce';
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
    const now = this.scene.time.now;
    if (type === 'shield') {
      this.scene.shieldCharges = Math.min(5, this.scene.shieldCharges + 1);
      this.scene.showFloatingText('SHIELD +1', pickup.x, pickup.y, { color: '#7fc4ff', size: 14, duration: 520 });
    } else if (type === 'pierce') {
      this.pierceUntil = Math.max(this.pierceUntil, now + PIERCE_MS);
      this.scene.showFloatingText('PIERCE 5s', pickup.x, pickup.y, { color: '#ffcf6e', size: 14, duration: 520 });
    } else if (type === 'slow') {
      this.slowUntil = Math.max(this.slowUntil, now + SLOW_MS);
      this.scene.showFloatingText('SLOW 4s', pickup.x, pickup.y, { color: '#89ffd0', size: 14, duration: 520 });
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
    return this.pierceUntil > this.scene.time.now;
  }

  getGlobalSlowMultiplier() {
    return this.slowUntil > this.scene.time.now ? 0.5 : 1;
  }

  getActiveBuffs() {
    const now = this.scene.time.now;
    const buffs = [];
    if (this.pierceUntil > now) buffs.push({ key: 'PIERCE', remainingMs: this.pierceUntil - now, maxMs: PIERCE_MS });
    if (this.slowUntil > now) buffs.push({ key: 'SLOW', remainingMs: this.slowUntil - now, maxMs: SLOW_MS });
    return buffs;
  }
}
