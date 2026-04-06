import { BULLET_HIT_LOCK_MS, BULLET_PIERCE_IFRAME_MS } from '../data/GameConstants.js';
import { enemyColorForLevel } from '../data/UpgradeDefinitions.js';

export default class CollisionManager {
  constructor(scene) {
    this.scene = scene;
  }

  onBulletHitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || this.scene.gameOver) return;
    const now = this.scene.time.now;
    const hitLockUntil = bullet.getData('hitLockUntil') || 0;
    if (hitLockUntil > now) return;
    bullet.setData('hitLockUntil', now + BULLET_HIT_LOCK_MS);
    const pierceLeft = bullet.getData('pierceLeft') || 0;
    const hasPierceThrough = pierceLeft > 0 || this.scene.powerupSystem?.hasPierceBuff?.() || this.scene.feverActive;
    const kind = bullet.getData('bulletKind') || 'core';

    const crit = Math.random() < this.scene.getCritChance();
    const kindMult = kind === 'plasma_beam' ? 5 : kind === 'frost_nova' ? 2 : kind === 'arc' ? 0.72 : kind === 'side' ? 0.86 : 1;
    const damage = Math.max(1, Math.round(this.scene.getBulletDamage() * kindMult * (crit ? 2 : 1)));
    this.scene.audio?.playHit();
    if (crit) {
      this.scene.audio?.playCrit();
      this.scene.showQuickFlash(0.18, 50);
    }

    const shieldHp = enemy.getData('shieldHp') || 0;
    if (shieldHp > 0) {
      const sideHit = Math.abs(bullet.x - enemy.x) > 10;
      if (!sideHit && !hasPierceThrough) {
        enemy.setData('shieldHp', Math.max(0, shieldHp - damage));
        this.scene.showFloatingText('BLOCK', enemy.x, enemy.y - 10, { color: '#9feaff', size: 13, duration: 380 });
        this.scene.emitImpactBurst(enemy.x, enemy.y, false);
        this.scene.recycleBullet(bullet);
        return;
      }
    }

    const hp = enemy.getData('health') - damage;
    enemy.setData('health', hp);
    const txt = enemy.getData('healthText');
    if (txt) txt.setText(String(Math.max(0, hp)));

    enemy.setTint(crit ? 0xffffaa : 0xffaaaa);

    let frostApplied = false;
    if (this.scene.frostLevel > 0 && Math.random() < this.scene.frostLevel * 0.18) {
      enemy.setData('slowUntil', this.scene.time.now + 1400 + this.scene.frostLevel * 350);
      frostApplied = true;
    }

    this.scene.emitImpactBurst(enemy.x, enemy.y, crit);
    this.scene.showDamagePopup(enemy.x, enemy.y, damage, crit, frostApplied);

    this.scene.time.delayedCall(70, () => {
      if (enemy.active) enemy.setTint(enemyColorForLevel(this.scene.currentLevel));
    });

    if (hp <= 0) this.scene.killEnemy(enemy);
    if (kind === 'arc' && hp > 0) {
      const splash = Math.max(1, Math.floor(damage * 0.45));
      this.scene.applySplashDamage(enemy, splash);
    }
    if (pierceLeft > 0) {
      const vx = bullet.body.velocity.x;
      const vy = bullet.body.velocity.y;
      bullet.setData('pierceLeft', Math.max(0, pierceLeft - 1));
      bullet.y -= 14;
      bullet.body.reset(bullet.x, bullet.y);
      bullet.setVelocity(vx, vy);
      bullet.body.checkCollision.none = true;
      this.scene.time.delayedCall(BULLET_PIERCE_IFRAME_MS, () => {
        if (bullet.active) bullet.body.checkCollision.none = false;
      });
      if (pierceLeft >= 2) {
        this.scene.showFloatingText(`PIERCE x${pierceLeft}`, bullet.x, bullet.y - 10, {
          color: '#ffd58a',
          size: 10,
          duration: 160,
        });
      }
      bullet.setAlpha(0.9);
      this.scene.time.delayedCall(60, () => {
        if (bullet.active) bullet.setAlpha(1);
      });
      return;
    }
    this.scene.recycleBullet(bullet);
  }

  onBulletHitEnemyBullet(playerBullet, enemyBullet) {
    if (!playerBullet.active || !enemyBullet.active) return;
    const pierceLeft = playerBullet.getData('pierceLeft') || 0;
    if (pierceLeft > 0) {
      playerBullet.setData('pierceLeft', Math.max(0, pierceLeft - 1));
      playerBullet.body.checkCollision.none = true;
      this.scene.time.delayedCall(BULLET_PIERCE_IFRAME_MS, () => {
        if (playerBullet.active) playerBullet.body.checkCollision.none = false;
      });
    } else {
      this.scene.recycleBullet(playerBullet);
    }
    this.scene.recycleEnemyBullet(enemyBullet);
    this.scene.emitImpactBurst(enemyBullet.x, enemyBullet.y, false);
  }

  onPlayerHitEnemy(player, enemy) {
    if (this.scene.gameOver || !enemy.active || this.scene.isChoosingUpgrade) return;

    if (this.scene.shieldCharges > 0) {
      this.scene.shieldFlashIndex = this.scene.shieldCharges - 1;
      this.scene.shieldFlashUntil = this.scene.time.now + 220;
      this.scene.shieldCharges -= 1;
      this.scene.tookDamageInLevel = true;
      this.scene.audio?.playShieldAbsorb();
      this.scene.killEnemy(enemy);
      if (this.scene.synergyExplosiveArmor > 0) this.scene.triggerExplosiveArmor();
      this.scene.updateHud();
      return;
    }

    this.scene.triggerGameOver(player);
  }

  onPlayerHitEnemyBullet(player, bullet) {
    if (this.scene.gameOver || !bullet.active || this.scene.isChoosingUpgrade) return;
    const isDeathOrb = Boolean(bullet.getData('isDeathOrb'));
    this.scene.recycleEnemyBullet(bullet);
    if (this.scene.shieldCharges > 0) {
      this.scene.shieldFlashIndex = this.scene.shieldCharges - 1;
      this.scene.shieldFlashUntil = this.scene.time.now + 220;
      this.scene.shieldCharges -= 1;
      this.scene.tookDamageInLevel = true;
      this.scene.audio?.playShieldAbsorb();
      if (isDeathOrb) {
        this.scene.showFloatingText('ORB BLOCK', player.x, player.y - 22, { color: '#ff9aa8', size: 12, duration: 340 });
      }
      if (this.scene.synergyExplosiveArmor > 0) this.scene.triggerExplosiveArmor();
      this.scene.updateHud();
      return;
    }
    if (isDeathOrb) this.scene.showQuickFlash(0.2, 80);
    this.scene.triggerGameOver(player);
  }
}
